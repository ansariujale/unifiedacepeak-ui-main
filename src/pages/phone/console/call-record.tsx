import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import moment from 'moment';
import { AuthenticatedAudio } from '@/components/custom/authenticated-media';
import { handleDownloadFile, MEDIA_URL } from '@/lib/utils';
import { fetchAuthenticatedMedia } from '@/hooks/use-authenticated-media';
import { useGetExtensions } from '@/hooks/common';
import { useCompanyFeatures } from '@/hooks/rbac';
import { useUser } from '@/hooks/use-user';
import { getUserNameByExtension } from '@/lib/extension-utility';
import { Ic } from './icons';
import { DialNumber, rememberDialLabel, useConsoleDialer } from './dial-number';
import { initialsOf, isNumberLike } from './copilot-adapter';
import { demoRecordLegs } from './demo-data';
import type { ConsoleCallRow } from './call-list-column';

/**
 * A past number, rendered in the console's own language.
 *
 * One header, then three history sections for the selected number — Call
 * History, Recording History and Voicemail History — each drawing on the same
 * loaded call legs and the same authenticated media components underneath
 * (AuthenticatedAudio and handleDownloadFile both go through the signed-URL
 * hook).
 */

const isMeaningful = (v: unknown) => {
  const s = String(v ?? '').trim();
  return Boolean(s) && s.toLowerCase() !== 'na' && s.toLowerCase() !== 'null';
};

const clock = (value: unknown) => {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return '00:00';
  return `${String(Math.floor(n / 60)).padStart(2, '0')}:${String(Math.floor(n % 60)).padStart(2, '0')}`;
};

export type RecordLeg = {
  id: string;
  raw: any;
  direction: 'in' | 'out' | 'miss';
  when: string;
  duration: string;
  by: string;
  viaDid: string;
  recordingUrl: string;
  transcriptUrl: string;
};

type TranscriptTurn = {
  who: 'agent' | 'caller';
  speaker: string;
  time: string;
  text: string;
};

/* Fallback summary when the call has no stored one: open with the caller's
   first turn and close with the agent's last, which is what a short call
   usually boils down to. */
const deriveSummary = (turns: TranscriptTurn[]): string[] => {
  const firstCaller = turns.find((t) => t.who === 'caller');
  const lastAgent = [...turns].reverse().find((t) => t.who === 'agent');
  return [
    firstCaller ? `Caller: ${firstCaller.text}` : '',
    lastAgent ? `Agent: ${lastAgent.text}` : '',
  ].filter(Boolean);
};

/* Deterministic waveform bar heights (0.15–1) so the wave looks organic but
   never jitters on re-render. */
const WAVE_BARS: number[] = Array.from({ length: 200 }, (_, i) => {
  const v = Math.abs(
    Math.sin(i * 2.3) * 0.5 + Math.sin(i * 0.7) * 0.3 + Math.sin(i * 5.1) * 0.2,
  );
  return 0.1 + (v % 1) * 0.9;
});

const fmtSecs = (s: number) => {
  if (!Number.isFinite(s) || s < 0) s = 0;
  const m = Math.floor(s / 60);
  const ss = Math.floor(s % 60);
  return `${String(m).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;
};

/* Waveform audio player used in the Recording History list. */
const WaveformPlayer = ({ src, onDownload }: { src: string; onDownload?: () => void }) => {
  const ref = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(true);
  const [cur, setCur] = useState(0);
  const [dur, setDur] = useState(0);
  const [rate, setRate] = useState(1);
  const [vol, setVol] = useState(1);

  const toggle = () => {
    const a = ref.current;
    if (!a) return;
    if (a.paused) {
      void a.play();
      setPlaying(true);
    } else {
      a.pause();
      setPlaying(false);
    }
  };
  const seek = (frac: number) => {
    const a = ref.current;
    if (!a || !dur) return;
    a.currentTime = Math.max(0, Math.min(1, frac)) * dur;
    setCur(a.currentTime);
  };
  const progress = dur ? cur / dur : 0;

  return (
    <div className="wave-player">
      <audio
        ref={ref}
        src={src}
        autoPlay
        preload="metadata"
        onLoadedMetadata={(e) => setDur(e.currentTarget.duration || 0)}
        onTimeUpdate={(e) => setCur(e.currentTarget.currentTime)}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => setPlaying(false)}
      />
      <button type="button" className="wave-play" onClick={toggle}>
        <Ic n={playing ? 'pause' : 'play'} size={16} />
      </button>
      <div className="wave-mid">
        <div
          className="wave-bars"
          onClick={(e) => {
            const r = e.currentTarget.getBoundingClientRect();
            seek((e.clientX - r.left) / r.width);
          }}
        >
          {WAVE_BARS.map((h, i) => (
            <span
              key={i}
              className={`wave-bar ${i / WAVE_BARS.length <= progress ? 'on' : ''}`}
              style={{ height: `${Math.round(h * 100)}%` }}
            />
          ))}
          <span className="wave-cursor" style={{ left: `${progress * 100}%` }} />
        </div>
        <div className="wave-times">
          <span className="num">{fmtSecs(cur)}</span>
          <span className="num">{fmtSecs(dur)}</span>
        </div>
      </div>
      <div className="wave-vol">
        <Ic n="mega" size={15} />
        <input
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={vol}
          onChange={(e) => {
            const v = Number(e.target.value);
            setVol(v);
            if (ref.current) ref.current.volume = v;
          }}
        />
      </div>
      <select
        className="wave-rate"
        value={rate}
        onChange={(e) => {
          const r = Number(e.target.value);
          setRate(r);
          if (ref.current) ref.current.playbackRate = r;
        }}
      >
        <option value={0.5}>0.5x</option>
        <option value={1}>1x</option>
        <option value={1.5}>1.5x</option>
        <option value={2}>2x</option>
      </select>
      <button
        type="button"
        className="wave-dl"
        title="Download recording"
        aria-label="Download recording"
        onClick={onDownload}
      >
        <Ic n="dl" size={14} />
      </button>
    </div>
  );
};

/* Group recording legs by their calendar day for the date section headers. */
const groupByDay = (legs: RecordLeg[]) => {
  const groups: { key: string; label: string; date: string; items: RecordLeg[] }[] = [];
  legs.forEach((leg) => {
    const stamp = String(leg.raw?.start_stamp ?? '').trim();
    const m = stamp && moment(stamp).isValid() ? moment(stamp) : moment(leg.when, 'D MMM YYYY, h:mm A', true);
    const valid = m.isValid();
    const key = valid ? m.format('YYYY-MM-DD') : leg.when;
    const date = valid ? m.format('D MMM YYYY') : (leg.when.split(',')[0] || '').trim();
    let label = date;
    if (valid) {
      if (m.isSame(moment(), 'day')) label = 'Today';
      else if (m.isSame(moment().subtract(1, 'day'), 'day')) label = 'Yesterday';
      else label = m.format('dddd');
    }
    let g = groups.find((x) => x.key === key);
    if (!g) {
      g = { key, label, date, items: [] };
      groups.push(g);
    }
    g.items.push(leg);
  });
  return groups;
};

const CallRecord = ({
  row,
  onBack,
  onOpenTranscript,
  initialTab = 'calls',
}: {
  row: ConsoleCallRow;
  onBack: () => void;
  onOpenTranscript: (leg: any) => void;
  /** which history the left column was showing when this row was picked */
  initialTab?: 'calls' | 'recordings' | 'voicemails';
}) => {
  const { user } = useUser();
  const { features } = useCompanyFeatures();
  const { dial } = useConsoleDialer();
  const navigate = useNavigate();
  const { data: extensionList } = useGetExtensions({
    page: 1,
    limit: 1000,
    filters: [],
    search: '',
  });
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [downloading, setDownloading] = useState<Record<string, boolean>>({});
  const [filter, setFilter] = useState<'all' | 'in' | 'out' | 'miss'>('all');
  const [filterOpen, setFilterOpen] = useState(false);
  const [tab, setTab] = useState<'calls' | 'recordings' | 'voicemails'>(initialTab);
  const [transcriptId, setTranscriptId] = useState<string | null>(null);
  /* Which view the open transcript panel is showing — the Transcript and
     Summary buttons flip between the two in the same space. */
  const [panelView, setPanelView] = useState<'transcript' | 'summary'>('transcript');

  const companyUuid = String(user?.company_info?.uuid || '').trim();
  const reportsActionAccess = features?.plan_features?.reports?.action;
  const canListen = Boolean(reportsActionAccess?.call_recording_listen);
  const canTranscribe = Boolean(
    features?.plan_features?.advance_call_management?.access?.TRANSCRIPTION,
  );

  const legs: RecordLeg[] = useMemo(() => {
    const source = row.logData?.acc_logs?.length ? row.logData.acc_logs : [row.raw];
    return source.filter(Boolean).map((log: any, i: number) => {
      const direction = String(log?.direction || '').trim();
      const isOutbound = direction === 'Outbound';
      const isMissed =
        direction === 'Missed' || String(log?.hangup_cause || '').toUpperCase() === 'NO_ANSWER';
      const recordingFile = String(log?.recording_file_url ?? '').trim();
      const transcriptFile = String(log?.transcript_file ?? '').trim();
      const selectedUser = extensionList?.find(
        (ex: any) => String(ex?.extension ?? '') === String(log?.extension ?? ''),
      );
      const by =
        (selectedUser
          ? `${selectedUser?.first_name || ''} ${selectedUser?.last_name || ''}`.trim()
          : '') ||
        getUserNameByExtension(extensionList as any, String(log?.extension ?? '')) ||
        String(log?.caller_id_name || '').trim() ||
        '—';
      const start = String(log?.start_stamp ?? '').trim();

      return {
        id: String(log?.uuid || log?.sipcall_id || log?.xml_cdr_uuid || `${i}`),
        raw: log,
        direction: isMissed ? 'miss' : isOutbound ? 'out' : 'in',
        when: start && moment(start).isValid() ? moment(start).format('DD MMM, h:mm A') : '—',
        duration: clock(log?.billsec ?? log?.duration),
        by,
        viaDid: isMeaningful(log?.via_did) ? String(log.via_did).trim() : '',
        recordingUrl:
          recordingFile && companyUuid
            ? `${MEDIA_URL}/${companyUuid}/recording/${recordingFile}`
            : '',
        transcriptUrl:
          transcriptFile && companyUuid
            ? `${MEDIA_URL}/${companyUuid}/recording/${transcriptFile}`
            : '',
      };
    });
  }, [row, extensionList, companyUuid]);

  /* History summary for this number, from its real call legs. */
  const summary = useMemo(() => {
    const outgoing = legs.filter((l) => l.direction === 'out').length;
    const incoming = legs.filter((l) => l.direction !== 'out').length;
    const stamp = row.raw?.start_stamp || legs[0]?.raw?.start_stamp;
    const lastCall = stamp && moment(stamp).isValid() ? moment(stamp).fromNow() : '—';
    return { total: legs.length, outgoing, incoming, lastCall };
  }, [legs, row]);

  const dateLabel = (leg: RecordLeg) => {
    const s = String(leg.raw?.start_stamp ?? '').trim();
    return s && moment(s).isValid() ? moment(s).format('D MMM YYYY, h:mm A') : leg.when;
  };

  const dirTitle = (d: RecordLeg['direction']) =>
    d === 'out' ? 'Outgoing call' : d === 'miss' ? 'Missed call' : 'Incoming call';

  const FILTERS: { key: typeof filter; label: string }[] = [
    { key: 'all', label: 'All calls' },
    { key: 'in', label: 'Incoming' },
    { key: 'out', label: 'Outgoing' },
    { key: 'miss', label: 'Missed' },
  ];
  const filterLabel = FILTERS.find((f) => f.key === filter)?.label ?? 'All calls';

  /* A missed call never connected, so it has nothing to record — those legs
     stay out of the recording list even if the log carries a stray file, and
     so does anything with no talk time (a zero-length file plays as silence). */
  const recordingLegs = useMemo(
    () =>
      legs.filter(
        (l) => l.recordingUrl && l.direction !== 'miss' && l.duration !== '00:00',
      ),
    [legs],
  );
  const voicemailLegs = useMemo(
    () => legs.filter((l) => isMeaningful((l.raw as any)?.voicemail_file_url)),
    [legs],
  );

  const TABS: { key: typeof tab; label: string; icon: string; count: number }[] = [
    { key: 'calls', label: 'Calls', icon: 'phone', count: legs.length },
    { key: 'recordings', label: 'Recordings', icon: 'rec', count: recordingLegs.length },
    { key: 'voicemails', label: 'Voicemails', icon: 'mic', count: voicemailLegs.length },
  ];
  const sectionTitle =
    tab === 'recordings' ? 'Recording History' : tab === 'voicemails' ? 'Voicemail History' : 'Call History';

  const realShown = useMemo(() => {
    if (tab === 'recordings') return recordingLegs;
    if (tab === 'voicemails') return voicemailLegs;
    return filter === 'all' ? legs : legs.filter((l) => l.direction === filter);
  }, [tab, legs, filter, recordingLegs, voicemailLegs]);

  /* Nothing of this kind on the contact: show samples rather than an empty
     list. Never mixed in with real legs, and chipped where they render. */
  const isDemo = realShown.length === 0;
  const shown: RecordLeg[] = useMemo(() => {
    if (!isDemo) return realShown;
    return demoRecordLegs(tab)
      .filter((l) => tab !== 'calls' || filter === 'all' || l.direction === filter)
      .map((l) => ({
        ...l,
        raw: {},
        recordingUrl: '',
        transcriptUrl: '',
      }));
  }, [isDemo, realShown, tab, filter]);

  /* Picking a row in the left column lands on the matching history here: the
     Recordings list for a recording, Voicemails for a voicemail, Calls
     otherwise — and the leg that was clicked opens and scrolls into view. */
  const focusId = String(
    row.raw?.uuid || row.raw?.sipcall_id || row.raw?.xml_cdr_uuid || '',
  ).trim();
  useEffect(() => {
    setTab(initialTab);
    setTranscriptId(null);
    setPlayingId(initialTab === 'calls' ? null : focusId || null);
  }, [initialTab, focusId]);

  const focusRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!focusId || tab === 'calls') return;
    const t = window.setTimeout(
      () => focusRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }),
      60,
    );
    return () => window.clearTimeout(t);
  }, [focusId, tab, shown]);

  /* Stored transcripts, fetched on demand and cached per leg. A real call has
     no inline turns — only a transcript file — so without this the Transcript
     and Summary panel could never appear at all. The file is the
     same JSON the call log's TranscriptInfo reads: { speaker: [...], summary }. */
  const [storedPanels, setStoredPanels] = useState<
    Record<string, { turns: TranscriptTurn[]; summary: string[]; state: 'loading' | 'done' | 'error' }>
  >({});

  useEffect(() => {
    if (!transcriptId) return;
    const leg = shown.find((l) => l.id === transcriptId);
    if (!leg || !leg.transcriptUrl) return;
    if (storedPanels[transcriptId]) return;

    let active = true;
    setStoredPanels((prev) => ({
      ...prev,
      [transcriptId]: { turns: [], summary: [], state: 'loading' },
    }));
    fetchAuthenticatedMedia(leg.transcriptUrl)
      .then((res) => {
        if (!res.ok) throw new Error(String(res.status));
        return res.json();
      })
      .then((data: any) => {
        if (!active) return;
        const items: any[] = Array.isArray(data?.speaker) ? data.speaker : [];
        const turns: TranscriptTurn[] = items.map((item, i) => {
          const role = String(item?.speakerDetails?.role || '').toLowerCase();
          const isAgent = role === 'agent' || String(item?.speaker ?? '') === '0';
          return {
            who: isAgent ? 'agent' : 'caller',
            speaker:
              String(item?.speakerDetails?.userName || '').trim() ||
              (isAgent ? 'Agent' : 'Caller'),
            time: String(item?.start_time || '').trim() || fmtSecs(i),
            text: String(item?.text || '').trim(),
          };
        });
        const summaryText = String(data?.summary || '').trim();
        setStoredPanels((prev) => ({
          ...prev,
          [transcriptId]: {
            turns: turns.filter((t) => t.text),
            summary: summaryText
              ? summaryText.split(/(?<=[.!?])\s+/).filter(Boolean)
              : deriveSummary(turns),
            state: 'done',
          },
        }));
      })
      .catch(() => {
        if (!active) return;
        setStoredPanels((prev) => ({
          ...prev,
          [transcriptId]: { turns: [], summary: [], state: 'error' },
        }));
      });
    return () => {
      active = false;
    };
  }, [transcriptId, shown, storedPanels]);

  /**
   * The one media card used by both the Recordings and the Voicemails list.
   *
   * Everything it shows — player, download, Transcript and Summary — comes off
   * the leg itself, never off which list opened it, so the same recording looks
   * and behaves identically wherever it is reached from.
   */
  const renderMediaCard = (leg: RecordLeg) => {
    const vmFile = String((leg.raw as any)?.voicemail_file_url ?? '').trim();
    const src =
      leg.recordingUrl ||
      (vmFile && companyUuid ? `${MEDIA_URL}/${companyUuid}/recording/${vmFile}` : '');
    const open = playingId === leg.id;
    const canPlayRec = canListen;
    const stored = storedPanels[leg.id];
    const turns = stored?.turns ?? [];
    /* The card is the same everywhere, so the Transcript / Summary button is
       always there: whether it has content is a property of the call, not of
       the list it was opened from. A call with no transcript says so. */
    const panelOpen = transcriptId === leg.id;
    const summaryBullets = stored?.summary ?? deriveSummary(turns);
    const doDownload = () =>
      handleDownloadFile({
        fileUrl: src,
        name: `${row.name || row.number}-${leg.when}`,
        setLoading: (value: any) =>
          setDownloading((prev) => ({
            ...prev,
            [leg.id]: typeof value === 'function' ? value(prev[leg.id]) : value,
          })),
      });

    return (
      <div
        className={`rec-card ${open ? 'open' : ''}`}
        key={leg.id}
        ref={leg.id === focusId ? focusRef : undefined}
      >
        <div className="rec-card-row">
          <span className={`rec-line-ic ${leg.direction === 'miss' ? 'miss' : leg.direction}`}>
            <Ic
              n={
                leg.direction === 'out'
                  ? 'arrow-out'
                  : leg.direction === 'miss'
                    ? 'x'
                    : 'arrow-in'
              }
              size={15}
            />
          </span>
          <div className="rec-card-title">
            <div className={`rec-line-title ${leg.direction === 'miss' ? 'miss' : leg.direction}`}>
              {dirTitle(leg.direction)}
            </div>
            {leg.viaDid ? (
              <div className="rec-line-sub">
                Via DID: <span className="num">{leg.viaDid}</span>
              </div>
            ) : null}
          </div>
          <div className="rec-line-when">
            <span>
              <Ic n="cal" size={13} /> {dateLabel(leg)}
            </span>
            <span>
              <Ic n="clock" size={13} /> <span className="num">{leg.duration}</span>
            </span>
          </div>
          <div className="rec-card-acts">
            <button
              type="button"
              className={`rec-act ${open ? 'on' : ''}`}
              title={
                !canPlayRec
                  ? 'Your plan does not allow listening'
                  : open
                    ? 'Hide player'
                    : 'Play'
              }
              disabled={!canPlayRec || !src}
              onClick={() => setPlayingId(open ? null : leg.id)}
            >
              <Ic n={open ? 'pause' : 'play'} size={14} />
            </button>
            <button
              type="button"
              className={`rec-act ${transcriptId === leg.id ? 'on' : ''}`}
              title="Transcript"
              onClick={() => setTranscriptId(transcriptId === leg.id ? null : leg.id)}
            >
              <Ic n="book" size={14} />
            </button>
          </div>
        </div>
        {open && src ? <WaveformPlayer src={src} onDownload={doDownload} /> : null}
        {panelOpen ? (
          <div className="rec-transcript">
            <div className="rec-transcript-col">
              <div className="rec-panel-tabs" role="tablist">
                <button
                  type="button"
                  role="tab"
                  aria-selected={panelView === 'transcript'}
                  className={`rec-panel-tab ${panelView === 'transcript' ? 'on' : ''}`}
                  onClick={() => setPanelView('transcript')}
                >
                  <Ic n="book" size={14} /> Transcript
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={panelView === 'summary'}
                  className={`rec-panel-tab ${panelView === 'summary' ? 'on' : ''}`}
                  onClick={() => setPanelView('summary')}
                >
                  <Ic n="list" size={14} /> Summary
                </button>
              </div>
              {stored?.state === 'loading' ? (
                <p className="rec-turn">Loading transcript…</p>
              ) : panelView === 'transcript' ? (
                turns.length ? (
                  turns.map((t, ti) => (
                    <p className={`rec-turn rt-${t.who}`} key={ti}>
                      <span className="rec-turn-time num">{t.time}</span>
                      <span className="rec-turn-who">{t.speaker}:</span> {t.text}
                    </p>
                  ))
                ) : (
                  <p className="rec-turn">No transcript for this call.</p>
                )
              ) : summaryBullets.length ? (
                <ul className="rec-summary-list">
                  {summaryBullets.map((s, si) => (
                    <li key={si}>{s}</li>
                  ))}
                </ul>
              ) : (
                <p className="rec-turn">No summary for this call.</p>
              )}
            </div>
          </div>
        ) : null}
      </div>
    );
  };

  return (
    <div className="record-view">
      {/* ---- contact header ---- */}
      <div className="record-head" style={{ borderBottom: 'none' }}>
        <button type="button" className="rec-back" onClick={onBack} title="Back to dialer">
          <Ic n="chev" size={16} className="flip" />
        </button>
        <div className="caller-av record-av">
          {initialsOf(row.name) || <Ic n="user" size={18} />}
        </div>
        <div className="record-id">
          <div className="record-name">
            {isNumberLike(row.name) ? <span className="num">{row.name}</span> : row.name}
            {row.contactId ? <span className="tag acc">Contact</span> : null}
          </div>
          <div className="record-sub num">
            <DialNumber number={row.number} />
          </div>
        </div>
        <div className="record-head-acts">
          <button
            type="button"
            aria-label="Call back"
            title="Call back"
            disabled={!row.number}
            onClick={() => {
              rememberDialLabel(row.number, row.name);
              dial(row.number);
            }}
            style={{
              width: 36,
              height: 36,
              borderRadius: '50%',
              display: 'grid',
              placeItems: 'center',
              border: '1px solid var(--line)',
              background: '#fff',
              color: 'var(--ink-2)',
              cursor: row.number ? 'pointer' : 'not-allowed',
              opacity: row.number ? 1 : 0.5,
            }}
          >
            <Ic n="phone" size={15} />
          </button>
          <button
            type="button"
            aria-label="Message"
            title="Message"
            onClick={() => navigate('/inbox')}
            style={{
              width: 36,
              height: 36,
              borderRadius: '50%',
              display: 'grid',
              placeItems: 'center',
              border: '1px solid var(--line)',
              background: '#fff',
              color: 'var(--ink-2)',
              cursor: 'pointer',
            }}
          >
            <Ic n="chat" size={15} />
          </button>
          {/* Add contact only when the number isn't already saved — a saved
              contact already carries a name, so `row.contactId` decides. */}
          {!row.contactId ? (
            <button
              type="button"
              aria-label="Add contact"
              title="Add contact"
              onClick={() => navigate('/contact', { state: { number: row.number } })}
              style={{
                width: 36,
                height: 36,
                borderRadius: '50%',
                display: 'grid',
                placeItems: 'center',
                border: '1px solid var(--line)',
                background: '#fff',
                color: 'var(--ink-2)',
                cursor: 'pointer',
              }}
            >
              <Ic n="plus" size={15} />
            </button>
          ) : null}
        </div>
      </div>

      {/* ---- compact statistics bar ---- */}
      <div className="record-statsbar">
        <div className="rec-stat">
          <Ic n="phone" size={15} className="rec-stat-ic total" />
          <span className="rec-stat-lbl">Total</span>
          <b>{summary.total}</b>
        </div>
        <div className="rec-stat">
          <Ic n="arrow-out" size={15} className="rec-stat-ic out" />
          <b>{summary.outgoing}</b>
          <span className="rec-stat-lbl">Outgoing</span>
        </div>
        <div className="rec-stat">
          <Ic n="arrow-in" size={15} className="rec-stat-ic in" />
          <b>{summary.incoming}</b>
          <span className="rec-stat-lbl">Incoming</span>
        </div>
        <div className="rec-stat">
          <Ic n="clock" size={15} className="rec-stat-ic time" />
          <span className="rec-stat-lbl">Last call</span>
          <b>{summary.lastCall}</b>
        </div>
      </div>

      {/* ---- source tabs (Calls / Recordings / Voicemails) ---- */}
      <div className="record-tabs" role="tablist">
        {TABS.map((t) => (
          <button
            type="button"
            role="tab"
            key={t.key}
            aria-selected={tab === t.key}
            className={`record-tab ${tab === t.key ? 'on' : ''}`}
            onClick={() => setTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ---- history section (content follows the active tab) ---- */}
      <div className="record-section">
        <div className="rec-sec-head">
          <h4>{sectionTitle}</h4>
          {tab === 'calls' ? (
            <div className="rec-filter">
              <button
                type="button"
                className="rec-filter-btn"
                onClick={() => setFilterOpen((v) => !v)}
              >
                <Ic n="list" size={14} />
                {filterLabel}
                <Ic n="chev" size={12} className="rec-filter-caret" />
              </button>
              {filterOpen ? (
                <>
                  <div className="rec-filter-backdrop" onClick={() => setFilterOpen(false)} />
                  <div className="rec-filter-menu" role="menu">
                    {FILTERS.map((f) => (
                      <button
                        type="button"
                        key={f.key}
                        className={`rec-filter-item ${filter === f.key ? 'on' : ''}`}
                        onClick={() => {
                          setFilter(f.key);
                          setFilterOpen(false);
                        }}
                      >
                        {f.label}
                        {filter === f.key ? <Ic n="check" size={13} /> : null}
                      </button>
                    ))}
                  </div>
                </>
              ) : null}
            </div>
          ) : null}
        </div>

        <div className="rec-sec-body">
          {shown.length ? (
            tab === 'recordings' || tab === 'voicemails' ? (
              /* One media list for both tabs — same card, same player, same
                 Transcript / Summary panel. What differs is only the audio
                 source (a recording file vs a voicemail file) and the noun in
                 the group header; nothing about the UI depends on where the
                 user came from. */
              groupByDay(shown).map((g) => (
                <div className="rec-group" key={g.key}>
                  <div className="rec-group-head">
                    <span className="rec-group-lbl">
                      <b>{g.label}</b>
                      <span>
                        {g.items.length} {tab === 'voicemails' ? 'voicemail' : 'recording'}
                        {g.items.length > 1 ? 's' : ''}
                      </span>
                    </span>
                    <span className="rec-group-date">{g.date}</span>
                  </div>
                  {g.items.map((leg) => renderMediaCard(leg))}
                </div>
              ))
            ) : (
            shown.map((leg) => {
              const vmFile = String((leg.raw as any)?.voicemail_file_url ?? '').trim();
              const vmUrl =
                vmFile && companyUuid
                  ? `${MEDIA_URL}/${companyUuid}/recording/${vmFile}`
                  : '';
              const canPlayRec = canListen;
              const vmKey = `vm-${leg.id}`;
              const recPlaying = playingId === leg.id;
              const vmPlaying = playingId === vmKey;
              return (
                <div
                  className={`rec-line ${recPlaying || vmPlaying ? 'open' : ''}`}
                  key={leg.id}
                >
                  <div className="rec-line-inner">
                    <span
                      className={`rec-line-ic ${leg.direction === 'miss' ? 'miss' : leg.direction}`}
                    >
                      <Ic
                        n={
                          leg.direction === 'out'
                            ? 'arrow-out'
                            : leg.direction === 'miss'
                              ? 'x'
                              : 'arrow-in'
                        }
                        size={15}
                      />
                    </span>
                    <div className="rec-line-main">
                      <div className={`rec-line-title ${leg.direction === 'miss' ? 'miss' : leg.direction}`}>
                        {dirTitle(leg.direction)}
                      </div>
                      {leg.viaDid ? (
                        <div className="rec-line-sub">
                          Via DID: <span className="num">{leg.viaDid}</span>
                        </div>
                      ) : null}
                    </div>

                    {(leg.recordingUrl || leg.transcriptUrl || vmUrl) && (
                      <div className="rec-line-acts">
                        {leg.recordingUrl ? (
                          <>
                            <button
                              type="button"
                              className={`rec-act ${recPlaying ? 'on' : ''}`}
                              title={
                                !canPlayRec
                                  ? 'Your plan does not allow listening'
                                  : recPlaying
                                    ? 'Hide player'
                                    : 'Play recording'
                              }
                              disabled={!canPlayRec}
                              onClick={() => setPlayingId(recPlaying ? null : leg.id)}
                            >
                              <Ic n={recPlaying ? 'pause' : 'play'} size={14} />
                            </button>
                            <button
                              type="button"
                              className="rec-act"
                              title="Download recording"
                              disabled={downloading[leg.id]}
                              onClick={() =>
                                handleDownloadFile({
                                  fileUrl: leg.recordingUrl,
                                  name: `${row.name || row.number}-${leg.when}`,
                                  setLoading: (value: any) =>
                                    setDownloading((prev) => ({
                                      ...prev,
                                      [leg.id]:
                                        typeof value === 'function' ? value(prev[leg.id]) : value,
                                    })),
                                })
                              }
                            >
                              <Ic n="dl" size={14} />
                            </button>
                          </>
                        ) : null}
                        {leg.transcriptUrl ? (
                          <button
                            type="button"
                            className="rec-act"
                            title={
                              !canTranscribe
                                ? 'Transcription is not on your plan'
                                : 'Open transcript'
                            }
                            disabled={!canTranscribe}
                            onClick={() => onOpenTranscript(leg.raw)}
                          >
                            <Ic n="book" size={14} />
                          </button>
                        ) : null}
                        {vmUrl ? (
                          <button
                            type="button"
                            className={`rec-act ${vmPlaying ? 'on' : ''}`}
                            title={vmPlaying ? 'Hide voicemail' : 'Play voicemail'}
                            onClick={() => setPlayingId(vmPlaying ? null : vmKey)}
                          >
                            <Ic n="mic" size={14} />
                          </button>
                        ) : null}
                      </div>
                    )}

                    <div className="rec-line-when">
                      <span>
                        <Ic n="cal" size={13} /> {dateLabel(leg)}
                      </span>
                      <span>
                        <Ic n="clock" size={13} /> <span className="num">{leg.duration}</span>
                      </span>
                    </div>
                  </div>

                  {recPlaying && leg.recordingUrl ? (
                    <div className="leg-audio">
                      <AuthenticatedAudio
                        src={leg.recordingUrl}
                        controls
                        autoPlay
                        preload="metadata"
                      />
                    </div>
                  ) : null}
                  {vmPlaying && vmUrl ? (
                    <div className="leg-audio">
                      <AuthenticatedAudio src={vmUrl} controls autoPlay preload="metadata" />
                    </div>
                  ) : null}
                </div>
              );
            })
            )
          ) : (
            <div className="rec-empty">
              <Ic n={tab === 'recordings' ? 'rec' : tab === 'voicemails' ? 'mic' : 'clock'} size={22} />
              <p>
                {tab === 'recordings'
                  ? 'No recordings for this number.'
                  : tab === 'voicemails'
                    ? 'No voicemails for this number.'
                    : `No ${filter === 'all' ? '' : `${filterLabel.toLowerCase()} `}calls for this number.`}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CallRecord;
