import { useEffect, useMemo, useRef, useState } from 'react';
import ReactCountryFlag from 'react-country-flag';
import {
  AsYouType,
  getCountries,
  getCountryCallingCode,
  isValidPhoneNumber,
  parsePhoneNumberFromString,
  type CountryCode,
} from 'libphonenumber-js';
import DialpadMaxiTabDispositions from '@/components/dialpad/components/dialpad-maxi-tab-dispositions';
import DialpadEndedScreen from '@/components/dialpad/components/dialpad-ended-screen';
import DialpadAddUserList from '@/components/dialpad/components/dialpad-add-user-list';
import DialpadMergeList from '@/components/dialpad/components/dialpad-merge-list';
import DialpadConferenceMembersList from '@/components/dialpad/components/dialpad-conference-members-list';
import DialpadMaxiScriptSidebar from '@/components/dialpad/components/dialpad-maxi-script-sidebar';
import { useDialpadCallerIdOptions } from '@/hooks/use-dialpad-caller-id-options';
import { useUsersDirectory } from '@/hooks/use-users-directory';
import type { DialpadSession } from '@/context/dialpad-context';
import type { ConsoleCallRow } from './call-list-column';
import { Ic } from './icons';
import { useConsoleDialer } from './dial-number';
import CallRecord from './call-record';
import { isTerminalSession, mmss, type ConsoleCallState } from './use-console-call';
import {
  CHECKLIST,
  contactDisplayName,
  initialsOf,
  lineHealth,
  type ConsoleTurn,
} from './copilot-adapter';

const KEYS: [string, string][] = [
  ['1', ''],
  ['2', 'ABC'],
  ['3', 'DEF'],
  ['4', 'GHI'],
  ['5', 'JKL'],
  ['6', 'MNO'],
  ['7', 'PQRS'],
  ['8', 'TUV'],
  ['9', 'WXYZ'],
  ['*', ''],
  ['0', '+'],
  ['#', ''],
];

/* Country list for the dialer's code selector: ISO, calling code and an English
   display name, sorted alphabetically. Built once from libphonenumber-js. */
const REGION_NAMES =
  typeof Intl !== 'undefined' && (Intl as any).DisplayNames
    ? new Intl.DisplayNames(['en'], { type: 'region' })
    : null;

type CountryOption = { iso: CountryCode; code: string; name: string };

const COUNTRY_OPTIONS: CountryOption[] = getCountries()
  .map((iso) => ({
    iso,
    code: getCountryCallingCode(iso),
    name: (REGION_NAMES?.of(iso) as string) || iso,
  }))
  .sort((a, b) => a.name.localeCompare(b.name));

/* Max national-number length for a country, read from the AsYouType template
   (count of digit placeholders). Used to stop input past the valid count. */
const maxNationalDigits = (iso: CountryCode): number => {
  try {
    const t = new AsYouType(iso);
    t.input('99999999999999999');
    const tmpl = t.getTemplate();
    const xs = tmpl ? (tmpl.match(/x/g) || []).length : 0;
    return xs >= 4 ? xs : 15;
  } catch {
    return 15;
  }
};

/* Consistent number grouping for every country (3-3-4 for a 10-digit national
   number, then blocks of 3) so India reads the same way as the US. */
const groupNumber = (value: string): string => {
  const plus = value.startsWith('+');
  const d = value.replace(/\D/g, '').slice(0, 15);
  if (!d) return plus ? '+' : '';
  if (plus) {
    const parts: string[] = [];
    for (let i = 0; i < d.length; i += 3) parts.push(d.slice(i, i + 3));
    return '+' + parts.join(' ');
  }
  if (d.length <= 3) return d;
  if (d.length <= 6) return `${d.slice(0, 3)} ${d.slice(3)}`;
  if (d.length <= 10) return `${d.slice(0, 3)} ${d.slice(3, 6)} ${d.slice(6)}`;
  let s = `${d.slice(0, 3)} ${d.slice(3, 6)} ${d.slice(6, 10)}`;
  for (let i = 10; i < d.length; i += 3) s += ' ' + d.slice(i, i + 3);
  return s;
};

type StageProps = {
  state: ConsoleCallState;
  session: DialpadSession | null;
  secs: number;
  dialpad: ReturnType<typeof import('@/hooks/use-dialpad').useDialpad>;
  turns: ConsoleTurn[];
  checklist: boolean[];
  onEndWrapup: () => void;
  /** a past call picked in the left column — shown in the stage while idle */
  selectedCall: ConsoleCallRow | null;
  onBackToDialer: () => void;
  onOpenTranscript: (leg: any) => void;
};

/* ---------------------------------------------------------------- caller ---- */

const CallerBlock = ({
  session,
  state,
  secs,
}: {
  session: DialpadSession | null;
  state: ConsoleCallState;
  secs: number;
}) => {
  const name = contactDisplayName(session);
  const pill =
    state === 'incoming'
      ? { cls: 'ringing', label: 'Incoming' }
      : state === 'dialing'
        ? { cls: 'ringing', label: 'Ringing' }
        : state === 'wrapup'
          ? { cls: 'wrap', label: 'Wrap-up' }
          : session?.isOnHold
            ? { cls: 'held', label: 'On hold' }
            : { cls: 'live', label: 'Connected' };

  const contact = session?.contactInfo;
  const queue = session?.queueMetaData?.response;

  return (
    <div className="card">
      <div className="caller">
        <div className="caller-av">{initialsOf(name)}</div>
        <div style={{ minWidth: 0 }}>
          <div className="caller-name">{name}</div>
          <div className="caller-num num">
            {session?.remoteNumber}
            {contact?.company ? ` · ${contact.company}` : ''}
          </div>
        </div>
        <div className="caller-state">
          <span
            className={`state-pill ${pill.cls} ${state === 'incoming' || state === 'dialing' ? 'pulsing' : ''}`}
          >
            {state === 'active' && !session?.isOnHold ? <span className="dot green" /> : null}
            {pill.label}
          </span>
          {state === 'active' || state === 'wrapup' ? (
            <div className="timer num">{mmss(secs)}</div>
          ) : null}
        </div>
      </div>
      <div className="popstrip">
        <div className="popcell">
          <div className="k">Contact</div>
          <div className="v">{contact ? name : 'Not in contacts'}</div>
        </div>
        <div className="popcell">
          <div className="k">Company</div>
          <div className="v">{contact?.company || '—'}</div>
        </div>
        <div className="popcell">
          <div className="k">Queue</div>
          <div className="v">{queue?.name || '—'}</div>
        </div>
        <div className="popcell">
          <div className="k">Direction</div>
          <div className="v">{session?.direction === 'incoming' ? 'Inbound' : 'Outbound'}</div>
        </div>
        <div className="popcell">
          <div className="k">Recording</div>
          <div className="v" style={{ color: session?.isRecording ? 'var(--crit)' : undefined }}>
            {session?.isRecording ? 'On' : 'Off'}
          </div>
        </div>
      </div>
    </div>
  );
};

/* -------------------------------------------------------- session switch ---- */

/**
 * Multiple concurrent calls. The dialpad overlay (which carries the platform's
 * own session switcher) renders nothing on /phone, so the console has to offer
 * this itself — otherwise a second inbound call while you are talking is
 * invisible and unanswerable on this page.
 */
const SessionStrip = ({
  sessions,
  activeId,
  onSwitch,
}: {
  sessions: DialpadSession[];
  activeId: string | null;
  onSwitch: (id: string) => void;
}) => {
  if (sessions.length < 2) return null;
  return (
    <div
      className="card card-pad"
      style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}
    >
      <span className="eyebrow" style={{ marginRight: 2 }}>
        {sessions.length} calls
      </span>
      {sessions.map((s) => {
        const ringing = !s.hasAnswered;
        return (
          <button
            type="button"
            key={s.id}
            className={`chip ${activeId === s.id ? 'on' : ''}`}
            onClick={() => onSwitch(s.id)}
          >
            <span
              className={`dot ${ringing ? 'amber' : s.isOnHold ? 'red' : 'green'} ${ringing ? 'pulsing' : ''}`}
            />
            {contactDisplayName(s)}
            <span className="num" style={{ opacity: 0.7 }}>
              {ringing
                ? s.direction === 'incoming'
                  ? 'ringing'
                  : 'calling'
                : s.isOnHold
                  ? 'hold'
                  : 'live'}
            </span>
          </button>
        );
      })}
    </div>
  );
};

/* ------------------------------------------------------------ enrichment ---- */

/* --------------------------------------------------------------- transfer ---- */

const TransferPanel = ({
  conference,
  onClose,
  onTransfer,
}: {
  conference: boolean;
  onClose: () => void;
  onTransfer: (target: string, type: 'speak_first' | 'transfer_now') => void;
}) => {
  const { users } = useUsersDirectory();
  const [query, setQuery] = useState('');

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = (users || []).map((u: any) => ({
      name: `${u?.first_name || ''} ${u?.last_name || ''}`.trim() || u?.email || 'User',
      extension: String(u?.extension || u?.user_info?.extension || '').trim(),
      role: u?.role || u?.department_name || 'Extension',
    }));
    const withExt = list.filter((u: any) => u.extension);
    if (!q) return withExt.slice(0, 6);
    return withExt
      .filter((u: any) => `${u.name} ${u.extension} ${u.role}`.toLowerCase().includes(q))
      .slice(0, 8);
  }, [users, query]);

  const target = query.trim();
  const isRawNumber = /^[+0-9*#]{2,}$/.test(target);

  return (
    <div className="card card-pad" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span className="sect-title">
          <Ic n={conference ? 'merge' : 'transfer'} size={13} />{' '}
          {conference ? 'Add to call' : 'Transfer'}
        </span>
        <button type="button" className="thumb" style={{ marginLeft: 'auto' }} onClick={onClose}>
          <Ic n="x" size={13} />
        </button>
      </div>
      <div className="search-mini">
        <Ic n="search" size={13} />
        <input
          placeholder="Search extensions, or type a number…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>
      <div className="dres">
        {results.map((r: any) => (
          <button
            type="button"
            className="dres-row"
            key={r.extension}
            onClick={() => setQuery(r.extension)}
          >
            <span className="dres-av">{initialsOf(r.name)}</span>
            <span style={{ flex: 1, minWidth: 0 }}>
              <span className="dres-n" style={{ display: 'block' }}>
                {r.name}
              </span>
              <span className="dres-m">
                {r.role} · <span className="num">ext {r.extension}</span>
              </span>
            </span>
          </button>
        ))}
        {!results.length && !isRawNumber ? (
          <div style={{ fontSize: 12, color: 'var(--ink-4)', padding: '6px 10px' }}>
            No matching extension. Type a full number to transfer externally.
          </div>
        ) : null}
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <button
          type="button"
          className="btn ghost"
          style={{ flex: 1 }}
          disabled={!target}
          onClick={() => onTransfer(target, 'transfer_now')}
        >
          <Ic n="transfer" />
          {conference ? 'Add now' : 'Transfer now'}
        </button>
        <button
          type="button"
          className="btn primary"
          style={{ flex: 1 }}
          disabled={!target}
          onClick={() => onTransfer(target, 'speak_first')}
        >
          <Ic n="headset" />
          Ask first
        </button>
      </div>
    </div>
  );
};

/* ------------------------------------------------------------------ stage ---- */

const StageColumn = ({
  state,
  session,
  secs,
  dialpad,
  turns,
  checklist,
  onEndWrapup,
  selectedCall,
  onBackToDialer,
  onOpenTranscript,
}: StageProps) => {
  const [dial, setDial] = useState('');
  const [transfer, setTransfer] = useState<null | { conference: boolean }>(null);
  const [dtmfOpen, setDtmfOpen] = useState(false);
  /* Keep the ringing UI up for at least 60s after pressing Call, even if the
     underlying session ends/fails quickly (e.g. no backend in the sandbox). */
  const [forcedRinging, setForcedRinging] = useState(false);
  const [ringingNumber, setRingingNumber] = useState('');
  const ringingTimerRef = useRef<number | null>(null);
  useEffect(() => {
    // A real connected/wrap-up call takes over from the forced ringing.
    if (state === 'active' || state === 'wrapup') {
      setForcedRinging(false);
      if (ringingTimerRef.current) window.clearTimeout(ringingTimerRef.current);
    }
  }, [state]);
  useEffect(() => () => {
    if (ringingTimerRef.current) window.clearTimeout(ringingTimerRef.current);
  }, []);
  const [contactsOpen, setContactsOpen] = useState(false);
  const [contactSearch, setContactSearch] = useState('');
  const [noteText, setNoteText] = useState('');
  const [notes, setNotes] = useState<string[]>([]);
  const [sidePanel, setSidePanel] = useState<null | 'notes' | 'transcript'>(null);
  const [panel, setPanel] = useState<null | 'add-user' | 'merge' | 'members' | 'script'>(null);
  const {
    callerIdOptions,
    defaultCallerIdOption,
    isCallerIdFallback,
    isCallerIdUpdating,
    updateCallerIdSelection,
  } = useDialpadCallerIdOptions();
  const [callerIdOpen, setCallerIdOpen] = useState(false);
  /* Placeholder caller IDs shown when the account has none configured, so the
     selector is usable in the demo. Selection is local only. */
  const DUMMY_CALLER_IDS = [
    { id: 'dummy-mobile', label: 'Mobile', number: '+91 98765 43210', iso: 'IN' },
    { id: 'dummy-office', label: 'Office', number: '+1 415 555 0132', iso: 'US' },
    { id: 'dummy-support', label: 'Support', number: '+44 20 7946 0958', iso: 'GB' },
  ];
  const [selectedDummy, setSelectedDummy] = useState<(typeof DUMMY_CALLER_IDS)[number] | null>(
    DUMMY_CALLER_IDS[0],
  );
  const callerIdList = [
    ...callerIdOptions.filter(
      (o: any) => o?.number && String(o.number).trim().toLowerCase() !== 'no caller id',
    ),
    ...DUMMY_CALLER_IDS,
  ];
  const displayedCallerId =
    selectedDummy?.number || defaultCallerIdOption?.number || DUMMY_CALLER_IDS[0].number;
  const { users } = useUsersDirectory();
  const { dial: dial2 } = useConsoleDialer();
  const [country, setCountry] = useState<CountryCode>('IN');
  const [countryOpen, setCountryOpen] = useState(false);
  const [countrySearch, setCountrySearch] = useState('');
  const selectedCountry = COUNTRY_OPTIONS.find((c) => c.iso === country) || COUNTRY_OPTIONS[0];
  const filteredCountries = useMemo(() => {
    const q = countrySearch.trim().toLowerCase();
    if (!q) return COUNTRY_OPTIONS;
    return COUNTRY_OPTIONS.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.iso.toLowerCase().includes(q) ||
        c.code.includes(q.replace(/^\+/, '')),
    );
  }, [countrySearch]);

  /* Whether what's typed is a valid phone number for the selected country
     (correct digit count per that country's numbering plan). Drives the Call
     button colour: black until valid, green once valid. */
  const isDialValid = useMemo(() => {
    const compact = dial.replace(/[^\d+]/g, '');
    if (!compact) return false;
    try {
      if (compact.startsWith('+')) return isValidPhoneNumber(compact);
      if (!/^[0-9]+$/.test(compact)) return false;
      return isValidPhoneNumber(compact, country);
    } catch {
      return false;
    }
  }, [dial, country]);

  /* Digit cap for the selected country, and an error flag for a full-length but
     invalid number. */
  const dialMax = useMemo(() => maxNationalDigits(country), [country]);
  const isDialError = useMemo(() => {
    const compact = dial.replace(/[^\d+]/g, '').replace(/^\+/, '');
    return !compact.startsWith('+') && compact.length >= dialMax && !isDialValid;
  }, [dial, dialMax, isDialValid]);

  // same resolution order the dialpad's maxi side panel uses
  const scriptId = String(
    session?.queueMetaData?.response?.script ||
      session?.campaignMetaData?.response?.script ||
      (session?.campaignMetaData as any)?.script ||
      session?.liveCallData?.scriptId ||
      session?.liveCallData?.script ||
      '',
  ).trim();

  const liveSessions = useMemo(
    () => Object.values(dialpad.sessions || {}).filter((s) => !isTerminalSession(s)),
    [dialpad.sessions],
  );
  const sessionStrip = (
    <SessionStrip
      sessions={liveSessions}
      activeId={dialpad.activeSessionId}
      onSwitch={dialpad.switchActiveSession}
    />
  );

  const directoryHits = useMemo(() => {
    const q = dial.trim().toLowerCase();
    if (!q) return [];
    return (users || [])
      .map((u: any) => ({
        name: `${u?.first_name || ''} ${u?.last_name || ''}`.trim() || u?.email || 'User',
        extension: String(u?.extension || u?.user_info?.extension || '').trim(),
        role: u?.role || u?.department_name || 'Extension',
      }))
      .filter((u: any) => u.extension && `${u.name} ${u.extension}`.toLowerCase().includes(q))
      .slice(0, 6);
  }, [users, dial]);

  /* Full contact list for the Contacts picker beside the Call button. */
  const contactList = useMemo(() => {
    const q = contactSearch.trim().toLowerCase();
    return (users || [])
      .map((u: any) => ({
        name: `${u?.first_name || ''} ${u?.last_name || ''}`.trim() || u?.email || 'User',
        extension: String(u?.extension || u?.user_info?.extension || '').trim(),
        number: String(
          u?.phone || u?.mobile || u?.user_info?.phone || u?.user_info?.mobile || '',
        ).trim(),
        role: u?.role || u?.department_name || 'Extension',
      }))
      .filter((u: any) => u.extension || u.number)
      .filter(
        (u: any) => !q || `${u.name} ${u.extension} ${u.number}`.toLowerCase().includes(q),
      )
      .slice(0, 60);
  }, [users, contactSearch]);

  const placeCall = (target: string) => {
    // Strip grouping spaces the display added, back to a dialable string.
    let t = (target || '').replace(/[^\d+]/g, '');
    /* Prepend the selected country's calling code only for a plain national
       number (digits only, no +, long enough to be a real phone number). Short
       digit strings stay untouched so internal extensions still dial, and names
       or already-international (+) numbers pass through as typed. */
    const digitsOnly = /^[0-9]+$/.test(t);
    if (t && digitsOnly && t.length >= 7 && !t.startsWith(selectedCountry.code)) {
      t = `+${selectedCountry.code}${t}`;
    }
    if (dial2(t)) setDial('');
    // Show the ringing screen for at least 60s from this Call press.
    setRingingNumber(t);
    setForcedRinging(true);
    if (ringingTimerRef.current) window.clearTimeout(ringingTimerRef.current);
    ringingTimerRef.current = window.setTimeout(() => setForcedRinging(false), 60000);
  };

  const stopRinging = () => {
    setForcedRinging(false);
    if (ringingTimerRef.current) window.clearTimeout(ringingTimerRef.current);
    if (session) dialpad.endCall(session.id);
  };

  const pressKey = (key: string) => {
    if (state === 'active' && session) {
      dialpad.sendDtmf(session.id, key);
      return;
    }
    setDial((d) => d + key);
  };

  /* Keys pressed on the in-call DTMF sheet: shown in the sheet's display and
     sent as tones when a call is connected. */
  const [dtmfEntry, setDtmfEntry] = useState('');
  const pressDtmf = (key: string) => {
    setDtmfEntry((s) => (s + key).slice(-24));
    if (session) dialpad.sendDtmf(session.id, key);
  };

  /* Local toggle state so Hold / Mute / Record / Speaker respond even before a
     call connects (no session yet); a live session's real state wins. */
  const [uiHold, setUiHold] = useState(false);
  const [uiMute, setUiMute] = useState(false);
  const [uiRecord, setUiRecord] = useState(false);
  const [uiSpeaker, setUiSpeaker] = useState(false);
  const isHold = session ? !!session.isOnHold : uiHold;
  const isMute = session ? !!session.isMuted : uiMute;
  const isRecording = session ? !!session.isRecording : uiRecord;
  const isSpeaker = session ? !session.isSpeakerOn : uiSpeaker;
  const toggleHold = () => {
    if (session) {
      session.isOnHold ? dialpad.unholdCall(session.id) : dialpad.holdCall(session.id);
    } else setUiHold((v) => !v);
  };
  const toggleMute = () => {
    if (session) {
      session.isMuted ? dialpad.unmuteCall(session.id) : dialpad.muteCall(session.id);
    } else setUiMute((v) => !v);
  };
  const toggleRecord = () => {
    if (session) dialpad.toggleRecordingCall(session.id);
    else setUiRecord((v) => !v);
  };
  const toggleSpeaker = () => {
    if (session) dialpad.toggleSpeakerCall(session.id);
    else setUiSpeaker((v) => !v);
  };

  /* Shared in-call control grid (Hold / Mute / Keypad / Recording / Notes /
     Speaker / Transcript), used on both the ringing and connected screens so
     the call UI looks the same throughout. */
  const callControls = (
    <>
      <div className="call-grid">
        <button
          type="button"
          className={`call-ctl ${isHold ? 'on' : ''}`}
          onClick={toggleHold}
        >
          <span className="call-ctl-ic">
            <Ic n={isHold ? 'play' : 'pause'} size={20} />
          </span>
          {isHold ? 'Resume' : 'Hold'}
        </button>
        <button
          type="button"
          className={`call-ctl ${isMute ? 'on' : ''}`}
          onClick={toggleMute}
        >
          <span className="call-ctl-ic">
            <Ic n={isMute ? 'micoff' : 'mic'} size={20} />
          </span>
          {isMute ? 'Unmute' : 'Mute'}
        </button>
        <button
          type="button"
          className={`call-ctl ${dtmfOpen ? 'on' : ''}`}
          onClick={() => setDtmfOpen((v) => !v)}
        >
          <span className="call-ctl-ic">
            <Ic n="grid" size={20} />
          </span>
          Keypad
        </button>
        <button
          type="button"
          className={`call-ctl ${isRecording ? 'on' : ''}`}
          onClick={toggleRecord}
        >
          <span className="call-ctl-ic">
            <Ic n="rec" size={20} />
          </span>
          {isRecording ? 'Recording' : 'Record'}
        </button>
        <button
          type="button"
          className={`call-ctl ${sidePanel === 'notes' ? 'on' : ''}`}
          onClick={() => setSidePanel((v) => (v === 'notes' ? null : 'notes'))}
        >
          <span className="call-ctl-ic">
            <Ic n="note" size={20} />
          </span>
          Notes
        </button>
        <button
          type="button"
          className={`call-ctl ${isSpeaker ? 'on' : ''}`}
          onClick={toggleSpeaker}
        >
          <span className="call-ctl-ic">
            <Ic n="mega" size={20} />
          </span>
          Speaker
        </button>
        <button
          type="button"
          className={`call-ctl ${sidePanel === 'transcript' ? 'on' : ''}`}
          onClick={() => {
            setSidePanel((v) => (v === 'transcript' ? null : 'transcript'));
            if (session && session.transcriptionHasStarted !== 'start') {
              dialpad.handleTranscription(session, 'start');
            }
          }}
        >
          <span className="call-ctl-ic">
            <Ic n="book" size={20} />
          </span>
          Transcript
        </button>
      </div>

      {/* DTMF pad slides up as an overlay so it never resizes the card. */}
      <div className={`dtmf-sheet ${dtmfOpen ? 'open' : ''}`} aria-hidden={!dtmfOpen}>
        <div className="dtmf-sheet-head">
          <span>Keypad</span>
          <button
            type="button"
            className="dtmf-close"
            aria-label="Close keypad"
            onClick={() => {
              setDtmfOpen(false);
              setDtmfEntry('');
            }}
          >
            <Ic n="x" size={15} />
          </button>
        </div>
        <div className="dtmf-display num">
          {dtmfEntry || <span className="dtmf-display-hint">Digits you press appear here</span>}
        </div>
        <div className="keypad">
          {KEYS.map(([d, l]) => (
            <button type="button" className="key" key={d} onClick={() => pressDtmf(d)}>
              <b>{d}</b>
              <i>{l}</i>
            </button>
          ))}
        </div>
      </div>
    </>
  );

  /* Right-side slide-over for Notes / Transcript, opened from the call controls
     or the floating tab, closed with its own X. */
  const addNote = () => {
    const t = noteText.trim();
    if (!t) return;
    setNotes((prev) => [t, ...prev]);
    setNoteText('');
  };
  const sidePanelEl = (
    <>
      <div className={`call-sidepanel ${sidePanel ? 'open' : ''}`} role="dialog" aria-label="Call notes and transcript">
        <div className="csp-head">
          <button
            type="button"
            className={`csp-tab ${sidePanel === 'notes' ? 'on' : ''}`}
            onClick={() => setSidePanel('notes')}
          >
            Notes
          </button>
          <button
            type="button"
            className={`csp-tab ${sidePanel === 'transcript' ? 'on' : ''}`}
            onClick={() => setSidePanel('transcript')}
          >
            Transcript
          </button>
          <button
            type="button"
            className="csp-close"
            aria-label="Close"
            onClick={() => setSidePanel(null)}
          >
            <Ic n="x" size={16} />
          </button>
        </div>

        {sidePanel === 'transcript' ? (
          <div className="csp-body">
            {turns.length ? (
              turns.map((t, i) => (
                <div className={`csp-turn ${t.speaker}`} key={i}>
                  <div className="csp-turn-who">{t.who}</div>
                  <div className="csp-turn-text">{t.text}</div>
                </div>
              ))
            ) : (
              <div className="csp-empty">No transcript yet</div>
            )}
          </div>
        ) : (
          <div className="csp-body">
            <textarea
              className="call-notes"
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              placeholder="Write a note about this call…"
              rows={3}
            />
            <button
              type="button"
              className="btn primary"
              style={{ width: '100%', marginTop: 8 }}
              disabled={!noteText.trim()}
              onClick={addNote}
            >
              Add note
            </button>
            <div style={{ borderTop: '1px solid var(--line)', margin: '12px 0' }} aria-hidden />
            {notes.length ? (
              notes.map((n, i) => (
                <div className="csp-note" key={i}>
                  {n}
                </div>
              ))
            ) : (
              <div className="csp-empty">No notes yet</div>
            )}
          </div>
        )}
      </div>

      {!sidePanel ? (
        <button
          type="button"
          className="csp-fab"
          aria-label="Open notes and transcript"
          title="Notes & transcript"
          onClick={() => setSidePanel('notes')}
        >
          <Ic n="note" size={18} />
        </button>
      ) : null}
    </>
  );

  /* --------------------------------------------------- idle · call record ---- */
  // A past call picked from the left column takes the stage while nothing is
  // live. `LogContent` is the platform's own call-record view — every leg,
  // authenticated recording playback, download, call-back and the call
  // intelligence / transcript view, with its plan gating intact.
  if (state === 'idle' && selectedCall) {
    return (
      <div className="col stage">
        <div className="stage-inner">
          <CallRecord
            row={selectedCall}
            onBack={onBackToDialer}
            onOpenTranscript={onOpenTranscript}
          />
        </div>
      </div>
    );
  }

  /* ---------------------------------------------------------------- idle ---- */
  if (state === 'idle' && !forcedRinging) {
    return (
      <div className="col stage">
        <div className="stage-inner">
          <div
            className="card card-pad"
            style={{ display: 'flex', flexDirection: 'column', gap: 13 }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span
                aria-hidden
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 34,
                  height: 34,
                  borderRadius: 10,
                  background: 'var(--accent-wash)',
                  color: 'var(--accent)',
                }}
              >
                <Ic n="phone" size={17} />
              </span>
              <span style={{ fontSize: 16, fontWeight: 700, letterSpacing: '-0.01em' }}>Dialer</span>

              {/* This was a static chip, so the number shown here could not be
                  changed without opening the floating dialpad — and when nothing
                  is stored on the account it shows whichever number happens to
                  be first. Picking one here writes it, which is the only way it
                  stops defaulting. */}
              <div style={{ marginLeft: 'auto', position: 'relative' }}>
                <span
                  className="eyebrow"
                  style={{ display: 'block', textAlign: 'right', marginBottom: 2 }}
                >
                  Caller ID
                </span>
                <button
                  type="button"
                  className="chip"
                  style={{
                    height: 26,
                    fontSize: 11,
                    cursor: 'pointer',
                    color: '#111111',
                    fontWeight: 600,
                  }}
                  disabled={isCallerIdUpdating}
                  aria-haspopup="listbox"
                  aria-expanded={callerIdOpen}
                  title="Choose which of your numbers people see"
                  onClick={() => setCallerIdOpen((open) => !open)}
                >
                  {(() => {
                    const iso =
                      selectedDummy?.iso ||
                      parsePhoneNumberFromString(String(displayedCallerId || ''))?.country;
                    return iso ? (
                      <ReactCountryFlag
                        countryCode={iso}
                        svg
                        style={{ width: 14, height: 14, borderRadius: 2, flex: 'none' }}
                      />
                    ) : (
                      <Ic n="globe" size={12} />
                    );
                  })()}
                  {isCallerIdUpdating ? 'Saving…' : displayedCallerId}
                  {callerIdList.length > 1 ? <Ic n="chev" size={11} /> : null}
                </button>

                {callerIdOpen ? (
                  <>
                    <div
                      onClick={() => setCallerIdOpen(false)}
                      style={{ position: 'fixed', inset: 0, zIndex: 40 }}
                      aria-hidden
                    />
                    <div
                      role="listbox"
                      aria-label="Caller ID"
                      className="card"
                      style={{
                        position: 'absolute',
                        top: 32,
                        right: 0,
                        zIndex: 41,
                        minWidth: 232,
                        padding: 5,
                        maxHeight: 280,
                        overflowY: 'auto',
                      }}
                    >
                      {callerIdList.map((option: any) => {
                        const isDummy = String(option.id).startsWith('dummy-');
                        const active = isDummy
                          ? selectedDummy?.id === option.id
                          : !selectedDummy && option.id === defaultCallerIdOption?.id;
                        return (
                          <button
                            key={option.id}
                            type="button"
                            role="option"
                            aria-selected={active}
                            className="popcell"
                            style={{
                              width: '100%',
                              display: 'flex',
                              alignItems: 'center',
                              gap: 8,
                              cursor: 'pointer',
                              textAlign: 'left',
                            }}
                            onClick={async () => {
                              setCallerIdOpen(false);
                              if (isDummy) {
                                setSelectedDummy(option);
                                return;
                              }
                              /* No-ops for the placeholder option, and the hook
                                 refreshes the user so the label follows. */
                              setSelectedDummy(null);
                              await updateCallerIdSelection(option);
                            }}
                          >
                            {(() => {
                              const iso =
                                option.iso ||
                                parsePhoneNumberFromString(String(option.number || ''))?.country;
                              return iso ? (
                                <ReactCountryFlag
                                  countryCode={iso}
                                  svg
                                  style={{ width: 18, height: 18, borderRadius: 3, flex: 'none' }}
                                />
                              ) : (
                                <Ic n="globe" size={14} />
                              );
                            })()}
                            <span className="v" style={{ flex: 1 }}>
                              {option.number}
                            </span>
                            {active ? <Ic n="check" size={12} /> : null}
                          </button>
                        );
                      })}
                    </div>
                  </>
                ) : null}
              </div>

              {/* Nothing chose this number — it is simply first in the assigned
                  list. Saying so before the call beats finding out from whoever
                  answered it. */}
              {isCallerIdFallback ? (
                <span
                  className="chip"
                  title="No caller ID is saved for you, so the first assigned number is being used. Pick one to save it."
                  style={{ height: 26, fontSize: 11, color: 'var(--warn, #c2670a)' }}
                >
                  default
                </span>
              ) : null}
            </div>
            <div
              className="dial-box"
              style={{
                position: 'relative',
                ...(isDialError ? { borderColor: '#e50914', background: '#fff5f5' } : {}),
              }}
            >
              <button
                type="button"
                className="dial-cc"
                aria-haspopup="listbox"
                aria-expanded={countryOpen}
                aria-label="Select country code"
                title={`${selectedCountry.name} (+${selectedCountry.code})`}
                onClick={() => setCountryOpen((o) => !o)}
                style={{ background: 'transparent', border: 0, cursor: 'pointer' }}
              >
                <ReactCountryFlag
                  countryCode={selectedCountry.iso}
                  svg
                  style={{ width: 18, height: 18, borderRadius: 3 }}
                />
                <span
                  className="num"
                  style={{ fontSize: 13, fontWeight: 600, color: '#111111' }}
                >
                  +{selectedCountry.code}
                </span>
                <Ic n="chev" size={12} />
              </button>

              {countryOpen ? (
                <>
                  <div
                    onClick={() => setCountryOpen(false)}
                    style={{ position: 'fixed', inset: 0, zIndex: 40 }}
                    aria-hidden
                  />
                  <div
                    role="listbox"
                    aria-label="Country"
                    style={{
                      position: 'absolute',
                      top: 46,
                      left: 0,
                      zIndex: 41,
                      width: 260,
                      maxHeight: 300,
                      display: 'flex',
                      flexDirection: 'column',
                      background: '#fff',
                      border: '1px solid var(--line)',
                      borderRadius: 12,
                      boxShadow: '0 12px 30px rgba(17,17,17,0.16)',
                      overflow: 'hidden',
                    }}
                  >
                    <div style={{ padding: 8, borderBottom: '1px solid var(--line)' }}>
                      <input
                        autoFocus
                        value={countrySearch}
                        onChange={(e) => setCountrySearch(e.target.value)}
                        placeholder="Search country or code…"
                        aria-label="Search country"
                        style={{
                          width: '100%',
                          border: '1px solid var(--line)',
                          borderRadius: 8,
                          padding: '7px 10px',
                          fontSize: 13,
                          outline: 'none',
                        }}
                      />
                    </div>
                    <div style={{ overflowY: 'auto', padding: 5 }}>
                      {filteredCountries.length === 0 ? (
                        <div
                          style={{ padding: '10px 8px', fontSize: 12.5, color: 'var(--ink-4)' }}
                        >
                          No matches
                        </div>
                      ) : (
                        filteredCountries.map((c) => {
                          const active = c.iso === selectedCountry.iso;
                          return (
                            <button
                              key={c.iso}
                              type="button"
                              role="option"
                              aria-selected={active}
                              onClick={() => {
                                setCountry(c.iso);
                                setCountryOpen(false);
                                setCountrySearch('');
                              }}
                              style={{
                                width: '100%',
                                display: 'flex',
                                alignItems: 'center',
                                gap: 9,
                                cursor: 'pointer',
                                textAlign: 'left',
                                padding: '8px 9px',
                                borderRadius: 8,
                                fontSize: 13,
                                border: 0,
                                fontWeight: active ? 700 : 500,
                                color: active ? 'var(--accent-ink)' : 'var(--ink-2)',
                                background: active ? 'var(--accent-wash)' : 'transparent',
                              }}
                            >
                              <ReactCountryFlag
                                countryCode={c.iso}
                                svg
                                style={{ width: 18, height: 18, borderRadius: 3, flex: 'none' }}
                              />
                              <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {c.name}
                              </span>
                              <span className="num" style={{ color: 'var(--ink-3)' }}>
                                +{c.code}
                              </span>
                            </button>
                          );
                        })
                      )}
                    </div>
                  </div>
                </>
              ) : null}

              <input
                className="dial-display num"
                placeholder="(555) 000-0000"
                value={dial}
                inputMode="tel"
                onChange={(e) => {
                  // Digits only, optional single leading +, capped at 15 digits,
                  // then grouped for readability per the selected country.
                  const raw = e.target.value.replace(/[^\d+]/g, '');
                  const plus = raw.startsWith('+');
                  const digits = raw.replace(/\+/g, '');
                  // National numbers stop at the country's expected length;
                  // international (+) numbers stop at the E.164 max of 15.
                  const cap = plus ? 15 : dialMax;
                  const v = (plus ? '+' : '') + digits.slice(0, cap);
                  setDial(groupNumber(v));
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') placeCall(dial);
                }}
                aria-label="Number or name to dial"
                autoComplete="off"
                style={{ flex: 1 }}
              />
            </div>
            {isDialError ? (
              <div style={{ fontSize: 12, color: '#e50914', paddingLeft: 4 }}>
                Enter a valid {selectedCountry.name} number.
              </div>
            ) : null}
            {directoryHits.length ? (
              <div className="dres">
                <div className="eyebrow" style={{ padding: '0 10px 4px' }}>
                  {directoryHits.length} match{directoryHits.length > 1 ? 'es' : ''} · directory
                </div>
                {directoryHits.map((d: any) => (
                  <button
                    type="button"
                    className="dres-row"
                    key={d.extension}
                    onClick={() => placeCall(d.extension)}
                  >
                    <span className="dres-av">{initialsOf(d.name)}</span>
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <span className="dres-n" style={{ display: 'block' }}>
                        {d.name}
                      </span>
                      <span className="dres-m">
                        {d.role} · <span className="num">ext {d.extension}</span>
                      </span>
                    </span>
                  </button>
                ))}
              </div>
            ) : (
              <div className="keypad">
                {KEYS.map(([d, l]) => (
                  <button type="button" className="key" key={d} onClick={() => pressKey(d)}>
                    <b>{d}</b>
                    <i>{l}</i>
                  </button>
                ))}
              </div>
            )}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 28,
                paddingTop: 4,
              }}
            >
              {/* Contacts — opens a searchable picker to dial from. */}
              <div style={{ position: 'relative' }}>
                <button
                  type="button"
                  className="btn ghost"
                  onClick={() => setContactsOpen((o) => !o)}
                  aria-haspopup="listbox"
                  aria-expanded={contactsOpen}
                  aria-label="Contacts"
                  title="Contacts"
                  style={{ width: 46, height: 46, padding: 0, borderRadius: 12 }}
                >
                  <Ic n="users" />
                </button>

                {contactsOpen ? (
                  <>
                    <div
                      onClick={() => setContactsOpen(false)}
                      style={{ position: 'fixed', inset: 0, zIndex: 40 }}
                      aria-hidden
                    />
                    <div
                      role="listbox"
                      aria-label="Contacts"
                      style={{
                        position: 'absolute',
                        bottom: 56,
                        left: 0,
                        zIndex: 41,
                        width: 280,
                        maxHeight: 320,
                        display: 'flex',
                        flexDirection: 'column',
                        background: '#fff',
                        border: '1px solid var(--line)',
                        borderRadius: 12,
                        boxShadow: '0 12px 30px rgba(17,17,17,0.16)',
                        overflow: 'hidden',
                      }}
                    >
                      <div style={{ padding: 8, borderBottom: '1px solid var(--line)' }}>
                        <input
                          autoFocus
                          value={contactSearch}
                          onChange={(e) => setContactSearch(e.target.value)}
                          placeholder="Search contacts…"
                          aria-label="Search contacts"
                          style={{
                            width: '100%',
                            border: '1px solid var(--line)',
                            borderRadius: 8,
                            padding: '7px 10px',
                            fontSize: 13,
                            outline: 'none',
                          }}
                        />
                      </div>
                      <div style={{ overflowY: 'auto', padding: 5 }}>
                        {contactList.length === 0 ? (
                          <div
                            style={{ padding: '12px 8px', fontSize: 12.5, color: 'var(--ink-4)' }}
                          >
                            No contacts found
                          </div>
                        ) : (
                          contactList.map((c: any, i: number) => (
                            <button
                              key={`${c.extension || c.number}-${i}`}
                              type="button"
                              role="option"
                              onClick={() => {
                                setDial(c.number || c.extension);
                                setContactsOpen(false);
                                setContactSearch('');
                              }}
                              style={{
                                width: '100%',
                                display: 'flex',
                                alignItems: 'center',
                                gap: 9,
                                cursor: 'pointer',
                                textAlign: 'left',
                                padding: '8px 9px',
                                borderRadius: 8,
                                border: 0,
                                background: 'transparent',
                              }}
                              onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--accent-wash)')}
                              onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                            >
                              <span
                                style={{
                                  width: 30,
                                  height: 30,
                                  borderRadius: '50%',
                                  flex: 'none',
                                  display: 'grid',
                                  placeItems: 'center',
                                  fontSize: 12,
                                  fontWeight: 700,
                                  background: 'var(--surface-3)',
                                  color: 'var(--ink-2)',
                                }}
                              >
                                {initialsOf(c.name)}
                              </span>
                              <span style={{ flex: 1, minWidth: 0 }}>
                                <span
                                  style={{
                                    display: 'block',
                                    fontSize: 13,
                                    fontWeight: 600,
                                    color: 'var(--ink)',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    whiteSpace: 'nowrap',
                                  }}
                                >
                                  {c.name}
                                </span>
                                <span className="num" style={{ fontSize: 11.5, color: 'var(--ink-4)' }}>
                                  {c.number || `ext ${c.extension}`}
                                </span>
                              </span>
                              <Ic n="phone" size={14} />
                            </button>
                          ))
                        )}
                      </div>
                    </div>
                  </>
                ) : null}
              </div>
              {/* Primary call — black until the number is valid, then green. */}
              <button
                type="button"
                onClick={() => placeCall(dial)}
                aria-label="Call"
                title={isDialValid ? `Call ${dial}` : 'Enter a valid number'}
                style={{
                  height: 52,
                  padding: '0 34px',
                  borderRadius: 999,
                  background: isDialValid ? '#16a34a' : '#111111',
                  color: '#fff',
                  border: 'none',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 9,
                  fontSize: 15,
                  fontWeight: 700,
                  cursor: 'pointer',
                  boxShadow: '0 2px 6px rgba(17,17,17,0.14)',
                  transition: 'background 0.18s ease, transform 0.18s ease',
                }}
                onMouseEnter={(e) => {
                  // Hover always turns the button green.
                  e.currentTarget.style.background = '#16a34a';
                  e.currentTarget.style.transform = 'scale(1.04)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = isDialValid ? '#16a34a' : '#111111';
                  e.currentTarget.style.transform = 'scale(1)';
                }}
                onMouseDown={(e) => (e.currentTarget.style.transform = 'scale(0.98)')}
                onMouseUp={(e) => (e.currentTarget.style.transform = 'scale(1.04)')}
              >
                <Ic n="phone" size={20} />
                Call
              </button>
              {/* Clear */}
              <button
                type="button"
                className="btn ghost"
                onClick={() => setDial('')}
                aria-label="Clear"
                title="Clear"
                style={{ width: 46, height: 46, padding: 0, borderRadius: 12, color: 'var(--accent)' }}
              >
                <Ic n="x" />
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  /* ----------------------------------------------------- dialing / incoming ---- */
  if (state === 'dialing' || state === 'incoming' || forcedRinging) {
    const callerName = contactDisplayName(session) || 'Unknown';
    const shownNumber = session?.remoteNumber || ringingNumber;
    return (
      <div className={`col stage ${sidePanel ? 'panel-open' : ''}`}>
        <div className="stage-inner">
          {sessionStrip}
          {/* One card holds the whole call, like the dialer's single-card layout. */}
          <div className="card call-card">
            <div className="call-av-lg">{initialsOf(callerName)}</div>
            <div className="call-name-lg">{callerName}</div>
            {shownNumber ? (
              <div className="num" style={{ color: 'var(--ink-3)', fontSize: 14 }}>
                {shownNumber}
              </div>
            ) : null}
            <span className="state-pill ringing pulsing" style={{ margin: '6px 0 12px' }}>
              {state === 'incoming' ? 'Incoming' : 'Ringing'}
            </span>

            {state === 'incoming' ? (
              <div style={{ display: 'flex', justifyContent: 'center', gap: 40, paddingTop: 2 }}>
                <button
                  type="button"
                  className="call-hangup"
                  style={{ background: '#16a34a', boxShadow: '0 2px 6px rgba(17,17,17,0.14)' }}
                  onClick={() => session && dialpad.answerCall(session.id)}
                  aria-label="Answer"
                  title="Answer"
                >
                  <Ic n="phone" size={24} />
                </button>
                <button
                  type="button"
                  className="call-hangup"
                  onClick={() => session && dialpad.endCall(session.id)}
                  aria-label="Decline"
                  title="Decline"
                >
                  <Ic n="hangup" size={24} fill />
                </button>
              </div>
            ) : (
              <>
                {callControls}
                <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 8 }}>
                  <button
                    type="button"
                    className="call-end-pill"
                    onClick={stopRinging}
                    aria-label="End call"
                    title="End call"
                  >
                    <Ic n="hangup" size={20} fill />
                    End call
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
        {sidePanelEl}
      </div>
    );
  }

  /* -------------------------------------------------------------- wrap-up ---- */
  if (state === 'wrapup') {
    return (
      <div className="col stage">
        <div className="stage-inner">
          <CallerBlock session={session} state={state} secs={secs} />
          <div
            className="card card-pad"
            style={{ display: 'flex', flexDirection: 'column', gap: 12 }}
          >
            <div className="sect-title">
              <Ic n="check" size={13} /> Disposition &amp; wrap-up
            </div>
            {/* The platform's own wrap-up panel: it owns the queue/campaign
                disposition payloads, the wrap-up timer and going back to
                Available. Reused rather than reimplemented so the console
                writes exactly what the rest of the app writes. */}
            <DialpadMaxiTabDispositions activeSession={session} />
          </div>

          <div className="card card-pad console-embed-panel">
            <div className="sect-title" style={{ marginBottom: 8 }}>
              <Ic n="cal" size={13} /> After the call
            </div>
            {/* schedule callback (createEventAndTask), session summary and call
                again — the platform's own ended screen, payloads unchanged */}
            <DialpadEndedScreen
              session={session}
              onAddNotes={() => undefined}
              onCallAgain={() => session?.remoteNumber && placeCall(session.remoteNumber)}
              onClose={onEndWrapup}
            />
          </div>
          <button
            type="button"
            className="btn ghost"
            style={{ width: '100%' }}
            onClick={onEndWrapup}
          >
            <Ic n="x" />
            Close wrap-up
          </button>
        </div>
      </div>
    );
  }

  /* --------------------------------------------------------------- active ---- */
  return (
    <div className={`col stage ${sidePanel ? 'panel-open' : ''}`}>
      <div className="stage-inner">
        {sessionStrip}
        <CallerBlock session={session} state={state} secs={secs} />

        <div
          className="card card-pad"
          style={{ display: 'flex', flexDirection: 'column', gap: 12 }}
        >
          <div className="controls">
            <button
              type="button"
              className={`ctl ${session?.isMuted ? 'on danger' : ''}`}
              onClick={() =>
                session &&
                (session.isMuted ? dialpad.unmuteCall(session.id) : dialpad.muteCall(session.id))
              }
            >
              <Ic n={session?.isMuted ? 'micoff' : 'mic'} />
              {session?.isMuted ? 'Unmute' : 'Mute'}
            </button>
            <button
              type="button"
              className={`ctl ${session?.isOnHold ? 'on hold' : ''}`}
              onClick={() =>
                session &&
                (session.isOnHold ? dialpad.unholdCall(session.id) : dialpad.holdCall(session.id))
              }
            >
              <Ic n={session?.isOnHold ? 'play' : 'pause'} />
              {session?.isOnHold ? 'Resume' : 'Hold'}
            </button>
            <button
              type="button"
              className="ctl"
              onClick={() => setTransfer({ conference: false })}
            >
              <Ic n="transfer" />
              Transfer
            </button>
            <button
              type="button"
              className={`ctl ${panel === 'add-user' ? 'on' : ''}`}
              onClick={() => setPanel(panel === 'add-user' ? null : 'add-user')}
            >
              <Ic n="plus" />
              Add
            </button>
            <button
              type="button"
              className={`ctl ${panel === 'merge' ? 'on' : ''}`}
              onClick={() => setPanel(panel === 'merge' ? null : 'merge')}
              disabled={liveSessions.length < 2}
              title={
                liveSessions.length < 2
                  ? 'Needs a second call to merge'
                  : 'Merge two calls into a conference'
              }
            >
              <Ic n="merge" />
              Merge
            </button>
            <button
              type="button"
              className={`ctl ${dtmfOpen ? 'on' : ''}`}
              onClick={() => setDtmfOpen((v) => !v)}
            >
              <Ic n="grid" />
              Keypad
            </button>
            <button
              type="button"
              className={`ctl ${session?.isRecording ? 'on rec' : ''}`}
              onClick={() => session && dialpad.toggleRecordingCall(session.id)}
            >
              <Ic n="rec" />
              {session?.isRecording ? 'Recording' : 'Record'}
            </button>
            <button
              type="button"
              className="ctl"
              onClick={() =>
                session &&
                dialpad.handleTranscription(
                  session,
                  session.transcriptionHasStarted === 'start' ? 'stop' : 'start',
                )
              }
            >
              <Ic n="book" />
              {session?.transcriptionHasStarted === 'start' ? 'Stop ASR' : 'Transcribe'}
            </button>
            <button
              type="button"
              className={`ctl ${!session?.isSpeakerOn ? 'on' : ''}`}
              onClick={() => session && dialpad.toggleSpeakerCall(session.id)}
            >
              <Ic n="mega" />
              Speaker
            </button>
            {scriptId ? (
              <button
                type="button"
                className={`ctl ${panel === 'script' ? 'on' : ''}`}
                onClick={() => setPanel(panel === 'script' ? null : 'script')}
              >
                <Ic n="list" />
                Script
              </button>
            ) : null}
            {session?.conferenceData ? (
              <button
                type="button"
                className={`ctl ${panel === 'members' ? 'on' : ''}`}
                onClick={() => setPanel(panel === 'members' ? null : 'members')}
              >
                <Ic n="users" />
                Members
              </button>
            ) : null}
          </div>

          {dtmfOpen ? (
            <div className="keypad">
              {KEYS.map(([d, l]) => (
                <button type="button" className="key" key={d} onClick={() => pressKey(d)}>
                  <b>{d}</b>
                  <i>{l}</i>
                </button>
              ))}
            </div>
          ) : null}

          <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 6 }}>
            <button
              type="button"
              className="call-hangup"
              onClick={() => session && dialpad.endCall(session.id)}
              aria-label="End call"
              title="End call"
            >
              <Ic n="hangup" size={24} fill />
            </button>
          </div>
        </div>

        {panel ? (
          <div className="card card-pad console-embed-panel">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <span className="sect-title">
                <Ic
                  n={
                    panel === 'script'
                      ? 'list'
                      : panel === 'merge'
                        ? 'merge'
                        : panel === 'members'
                          ? 'users'
                          : 'plus'
                  }
                  size={13}
                />
                {panel === 'script'
                  ? 'Call script'
                  : panel === 'merge'
                    ? 'Merge calls'
                    : panel === 'members'
                      ? 'Conference members'
                      : 'Add to call'}
              </span>
              <button
                type="button"
                className="thumb"
                style={{ marginLeft: 'auto' }}
                onClick={() => setPanel(null)}
              >
                <Ic n="x" size={13} />
              </button>
            </div>
            {/* the platform's own in-call panels: they carry the conference and
                merge socket protocol and the call-script fetch */}
            {panel === 'add-user' ? (
              <DialpadAddUserList
                session={session}
                mode={session?.conferenceData ? 'conference' : 'pre-conference'}
                onBack={() => setPanel(null)}
              />
            ) : null}
            {panel === 'merge' ? (
              <DialpadMergeList session={session} onBack={() => setPanel(null)} />
            ) : null}
            {panel === 'members' ? (
              <DialpadConferenceMembersList session={session} onBack={() => setPanel(null)} />
            ) : null}
            {panel === 'script' ? (
              <DialpadMaxiScriptSidebar scriptId={scriptId} sessionId={session?.id} />
            ) : null}
          </div>
        ) : null}

        {transfer ? (
          <TransferPanel
            conference={transfer.conference}
            onClose={() => setTransfer(null)}
            onTransfer={(target, type) => {
              dialpad.handleTransfer(type, target);
              setTransfer(null);
            }}
          />
        ) : null}

        <div className="card card-pad" style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
          <div className="sect-title">
            <Ic n="check" size={13} /> Quality checklist
            <span className="src" style={{ marginLeft: 'auto' }}>
              transcript · derived
            </span>
          </div>
          {CHECKLIST.map((item, i) => (
            <div
              key={item.label}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 9,
                fontSize: 12.5,
                color: checklist[i] ? undefined : 'var(--ink-3)',
              }}
            >
              <span
                style={{
                  width: 18,
                  height: 18,
                  borderRadius: 6,
                  display: 'grid',
                  placeItems: 'center',
                  flex: 'none',
                  background: checklist[i] ? 'var(--live)' : 'var(--surface-3)',
                  color: '#fff',
                }}
              >
                {checklist[i] ? <Ic n="check" size={11} /> : null}
              </span>
              {item.label}
              {checklist[i] ? (
                <span className="tag pos" style={{ marginLeft: 'auto' }}>
                  detected
                </span>
              ) : null}
            </div>
          ))}
          {!turns.length ? (
            <div style={{ fontSize: 11, color: 'var(--ink-4)' }}>
              Ticks appear once transcription is streaming.
            </div>
          ) : null}
        </div>

        <div className="card card-pad" style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
          <div className="sect-title">
            <Ic n="bolt" size={13} /> Line health · this leg
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10 }}>
            {lineHealth(session).map((m) => (
              <div key={m.k}>
                <div
                  style={{
                    fontSize: 9,
                    fontWeight: 700,
                    letterSpacing: '.08em',
                    textTransform: 'uppercase',
                    color: 'var(--ink-4)',
                  }}
                >
                  {m.k}
                </div>
                <div
                  className="num"
                  style={{
                    fontSize: 15,
                    fontWeight: 800,
                    letterSpacing: '-.03em',
                    marginTop: 2,
                    color: m.source === 'stub' ? 'var(--ink-4)' : 'var(--live)',
                  }}
                >
                  {m.v}
                </div>
              </div>
            ))}
          </div>
          <div style={{ fontSize: 11, color: 'var(--ink-4)' }}>
            MOS and jitter need WebRTC stats piped through the SIP layer — not wired yet, so they
            read <strong>n/a</strong> rather than showing a made-up score.
          </div>
        </div>
      </div>
      {sidePanelEl}
    </div>
  );
};

export default StageColumn;
