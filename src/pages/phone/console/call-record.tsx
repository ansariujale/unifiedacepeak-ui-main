import { useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import moment from 'moment';
import { AuthenticatedAudio } from '@/components/custom/authenticated-media';
import { handleDownloadFile, MEDIA_URL } from '@/lib/utils';
import { useGetExtensions } from '@/hooks/common';
import { useCompanyFeatures } from '@/hooks/rbac';
import { useUser } from '@/hooks/use-user';
import { getUserNameByExtension } from '@/lib/extension-utility';
import { Ic } from './icons';
import { DialNumber, useConsoleDialer } from './dial-number';
import { initialsOf, isNumberLike } from './copilot-adapter';
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
  /* Set on demo/sample rows: a directly-playable URL used instead of the
     authenticated media path, so the demo lists actually play. */
  audioUrl?: string;
  demo?: boolean;
  /* Inline transcript turns (used by demo rows; real rows open the side
     panel via onOpenTranscript instead). */
  transcript?: TranscriptTurn[];
};

type TranscriptTurn = {
  who: 'agent' | 'caller';
  speaker: string;
  time: string;
  text: string;
};

const DEMO_TRANSCRIPT: TranscriptTurn[] = [
  { who: 'caller', speaker: 'Caller', time: '00:02', text: 'Hi, I’m calling about my recent order — it hasn’t arrived yet.' },
  { who: 'agent', speaker: 'Agent', time: '00:09', text: 'I’m sorry to hear that. Could you share your order number so I can check?' },
  { who: 'caller', speaker: 'Caller', time: '00:18', text: 'Sure, it’s 48213-A.' },
  { who: 'agent', speaker: 'Agent', time: '00:24', text: 'Thanks. I can see it shipped yesterday and is out for delivery today.' },
  { who: 'caller', speaker: 'Caller', time: '00:37', text: 'Oh great, that’s a relief. Thank you for the quick help!' },
  { who: 'agent', speaker: 'Agent', time: '00:42', text: 'You’re welcome. Is there anything else I can help you with?' },
];

/* --- Demo/sample data so Calls, Recordings and Voicemails all show content
   even when the real call has no stored media. Mirrors the demo rows used in
   the call list; the audio points at small public sample clips. --- */
const SAMPLE_AUDIO = [
  'https://download.samplelib.com/mp3/sample-6s.mp3',
  'https://download.samplelib.com/mp3/sample-9s.mp3',
  'https://download.samplelib.com/mp3/sample-12s.mp3',
  'https://download.samplelib.com/mp3/sample-15s.mp3',
];

const demoLeg = (o: Partial<RecordLeg> & { id: string }): RecordLeg => ({
  raw: {},
  direction: 'in',
  when: '—',
  duration: '00:00',
  by: '—',
  viaDid: '',
  recordingUrl: '',
  transcriptUrl: '',
  demo: true,
  ...o,
});

const DEMO_CALLS: RecordLeg[] = [
  demoLeg({
    id: 'demo-call-1',
    direction: 'out',
    when: '3 Sep 2026, 6:12 PM',
    duration: '02:14',
    viaDid: '+1 (415) 555-0132',
  }),
  demoLeg({
    id: 'demo-call-2',
    direction: 'in',
    when: '2 Sep 2026, 11:40 AM',
    duration: '00:47',
    viaDid: '+1 (415) 555-0132',
  }),
  demoLeg({
    id: 'demo-call-3',
    direction: 'miss',
    when: '1 Sep 2026, 9:05 AM',
    duration: '00:00',
    viaDid: '+1 (415) 555-0132',
  }),
];

const DEMO_RECORDINGS: RecordLeg[] = [
  demoLeg({
    id: 'demo-rec-1',
    direction: 'in',
    when: '4 Sep 2026, 4:22 PM',
    duration: '03:00',
    viaDid: '+1 (415) 555-0132',
    recordingUrl: SAMPLE_AUDIO[0],
    audioUrl: SAMPLE_AUDIO[0],
    transcript: DEMO_TRANSCRIPT,
  }),
  demoLeg({
    id: 'demo-rec-2',
    direction: 'out',
    when: '4 Sep 2026, 1:18 PM',
    duration: '01:36',
    viaDid: '+1 (415) 555-0132',
    recordingUrl: SAMPLE_AUDIO[1],
    audioUrl: SAMPLE_AUDIO[1],
    transcript: DEMO_TRANSCRIPT,
  }),
  demoLeg({
    id: 'demo-rec-3',
    direction: 'in',
    when: '3 Sep 2026, 10:05 AM',
    duration: '04:41',
    viaDid: '+1 (415) 555-0132',
    recordingUrl: SAMPLE_AUDIO[2],
    audioUrl: SAMPLE_AUDIO[2],
    transcript: DEMO_TRANSCRIPT,
  }),
];

const DEMO_VOICEMAILS: RecordLeg[] = [
  demoLeg({
    id: 'demo-vm-1',
    direction: 'in',
    when: '3 Sep 2026, 8:02 AM',
    duration: '00:22',
    viaDid: '+1 (415) 555-0132',
    raw: { voicemail_file_url: 'demo-voicemail-1.mp3' },
    audioUrl: SAMPLE_AUDIO[2],
  }),
  demoLeg({
    id: 'demo-vm-2',
    direction: 'in',
    when: '31 Aug 2026, 7:44 PM',
    duration: '00:38',
    viaDid: '+1 (415) 555-0132',
    raw: { voicemail_file_url: 'demo-voicemail-2.mp3' },
    audioUrl: SAMPLE_AUDIO[3],
  }),
];

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
      <button type="button" className="wave-dl" onClick={onDownload}>
        <Ic n="dl" size={14} /> Download
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
}: {
  row: ConsoleCallRow;
  onBack: () => void;
  onOpenTranscript: (leg: any) => void;
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
  const [tab, setTab] = useState<'calls' | 'recordings' | 'voicemails'>('calls');
  const [transcriptId, setTranscriptId] = useState<string | null>(null);

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

  /* History summary — reflects the calls actually shown (real + demo). */
  const summary = useMemo(() => {
    const all = [...legs, ...DEMO_CALLS];
    const outgoing = all.filter((l) => l.direction === 'out').length;
    const incoming = all.filter((l) => l.direction !== 'out').length;
    const stamp = row.raw?.start_stamp || legs[0]?.raw?.start_stamp;
    const lastCall = stamp && moment(stamp).isValid() ? moment(stamp).fromNow() : '—';
    return { total: all.length, outgoing, incoming, lastCall };
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

  const recordingLegs = useMemo(() => legs.filter((l) => l.recordingUrl), [legs]);
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

  const shown = useMemo(() => {
    if (tab === 'recordings') return recordingLegs.length ? recordingLegs : DEMO_RECORDINGS;
    if (tab === 'voicemails') return voicemailLegs.length ? voicemailLegs : DEMO_VOICEMAILS;
    const base = filter === 'all' ? legs : legs.filter((l) => l.direction === filter);
    const demoCalls =
      filter === 'all' ? DEMO_CALLS : DEMO_CALLS.filter((l) => l.direction === filter);
    return [...base, ...demoCalls];
  }, [tab, legs, filter, recordingLegs, voicemailLegs]);

  return (
    <div className="record-view">
      {/* ---- contact header ---- */}
      <div className="record-head">
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
            className="rec-callback"
            disabled={!row.number}
            onClick={() => dial(row.number)}
          >
            <Ic n="phone" size={15} />
            Call back
          </button>
          <button type="button" className="rec-message" onClick={() => navigate('/inbox')}>
            <Ic n="chat" size={15} />
            Message
          </button>
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
            tab === 'recordings' ? (
              groupByDay(shown).map((g) => (
                <div className="rec-group" key={g.key}>
                  <div className="rec-group-head">
                    <span className="rec-group-lbl">
                      <b>{g.label}</b>
                      <span>
                        {g.items.length} recording{g.items.length > 1 ? 's' : ''}
                      </span>
                    </span>
                    <span className="rec-group-date">{g.date}</span>
                  </div>
                  {g.items.map((leg) => {
                    const src = leg.audioUrl || leg.recordingUrl;
                    const open = playingId === leg.id;
                    const canPlayRec = leg.demo || canListen;
                    const doDownload = () =>
                      handleDownloadFile({
                        fileUrl: leg.audioUrl || leg.recordingUrl,
                        name: `${row.name || row.number}-${leg.when}`,
                        setLoading: (value: any) =>
                          setDownloading((prev) => ({
                            ...prev,
                            [leg.id]:
                              typeof value === 'function' ? value(prev[leg.id]) : value,
                          })),
                      });
                    return (
                      <div className={`rec-card ${open ? 'open' : ''}`} key={leg.id}>
                        <div className="rec-card-row">
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
                          <div className="rec-card-title">
                            <div
                              className={`rec-line-title ${leg.direction === 'miss' ? 'miss' : leg.direction}`}
                            >
                              {dirTitle(leg.direction)}
                            </div>
                            {leg.viaDid ? (
                              <div className="rec-line-sub">
                                Via DID: <span className="num">{leg.viaDid}</span>
                              </div>
                            ) : null}
                          </div>
                          <div className="rec-card-who">
                            <span className="rec-card-who-ic">
                              <Ic n="user" size={14} />
                            </span>
                            <div className="rec-card-who-txt">
                              <div className="rec-card-num num">
                                <DialNumber number={row.number} />
                              </div>
                              {row.name && !isNumberLike(row.name) ? (
                                <div className="rec-card-name">{row.name}</div>
                              ) : null}
                            </div>
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
                                    : 'Play recording'
                              }
                              disabled={!canPlayRec}
                              onClick={() => setPlayingId(open ? null : leg.id)}
                            >
                              <Ic n={open ? 'pause' : 'play'} size={14} />
                            </button>
                            <button
                              type="button"
                              className="rec-act"
                              title="Download recording"
                              disabled={downloading[leg.id]}
                              onClick={doDownload}
                            >
                              <Ic n="dl" size={14} />
                            </button>
                            {leg.transcript?.length || (leg.transcriptUrl && canTranscribe) ? (
                              <button
                                type="button"
                                className={`rec-act ${transcriptId === leg.id ? 'on' : ''}`}
                                title="Transcript"
                                onClick={() => {
                                  if (leg.transcript?.length) {
                                    setTranscriptId(transcriptId === leg.id ? null : leg.id);
                                  } else {
                                    onOpenTranscript(leg.raw);
                                  }
                                }}
                              >
                                <Ic n="book" size={14} />
                              </button>
                            ) : null}
                          </div>
                        </div>
                        {open && src ? <WaveformPlayer src={src} onDownload={doDownload} /> : null}
                        {transcriptId === leg.id && leg.transcript?.length ? (
                          <div className="rec-transcript">
                            <div className="rec-transcript-head">
                              <Ic n="book" size={14} /> Transcript
                            </div>
                            {leg.transcript.map((t, ti) => (
                              <p className={`rec-turn rt-${t.who}`} key={ti}>
                                <span className="rec-turn-time num">{t.time}</span>
                                <span className="rec-turn-who">{t.speaker}:</span>{' '}
                                {t.text}
                              </p>
                            ))}
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              ))
            ) : (
            shown.map((leg) => {
              const vmFile = String((leg.raw as any)?.voicemail_file_url ?? '').trim();
              const vmUrl = vmFile
                ? leg.audioUrl ||
                  (companyUuid ? `${MEDIA_URL}/${companyUuid}/recording/${vmFile}` : '')
                : '';
              const canPlayRec = leg.demo || canListen;
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
                                  fileUrl: leg.audioUrl || leg.recordingUrl,
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
                      {leg.audioUrl ? (
                        <audio src={leg.audioUrl} controls autoPlay preload="metadata" />
                      ) : (
                        <AuthenticatedAudio
                          src={leg.recordingUrl}
                          controls
                          autoPlay
                          preload="metadata"
                        />
                      )}
                    </div>
                  ) : null}
                  {vmPlaying && vmUrl ? (
                    <div className="leg-audio">
                      {leg.audioUrl ? (
                        <audio src={leg.audioUrl} controls autoPlay preload="metadata" />
                      ) : (
                        <AuthenticatedAudio src={vmUrl} controls autoPlay preload="metadata" />
                      )}
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
