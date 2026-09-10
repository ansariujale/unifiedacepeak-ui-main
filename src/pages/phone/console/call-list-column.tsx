import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useInfiniteQuery } from '@tanstack/react-query';
import moment from 'moment';
import { fetchPhone } from '@/services/api';
import { useFetchContact } from '@/hooks/common';
import { useCompanyFeatures } from '@/hooks/rbac';
import Loader from '@/components/custom/loader';
import { dropdownCallInitialVal, handleDate } from '@/components/custom/date-dropdown/constant';
import { Ic } from './icons';
import { DialNumber, rememberDialLabel, useConsoleDialer } from './dial-number';
import { initialsOf, isNumberLike } from './copilot-adapter';
import { demoCallRows } from './demo-data';
import DateRangeMenu from '@/components/custom/date-range-menu';

/** The three call-log sources the old phone page exposed, same `tabType` values. */
export type ConsoleLogSource = 'call' | 'recording' | 'voicemail';

export type ConsoleCallRow = {
  id: string;
  raw: any;
  direction: 'in' | 'out' | 'miss';
  name: string;
  number: string;
  time: string;
  duration: string;
  topic: string;
  contactId: string | number | null;
  hasRecording: boolean;
  /** the shape `LogContent` consumes — matches call-list.tsx's buildLogData */
  logData: {
    main: any;
    count: number;
    acc_logs: any[];
    number: string;
  };
};

const DIRECTION_FILTERS: { key: 'all' | 'in' | 'out' | 'miss'; label: string; filter: any[] }[] = [
  { key: 'all', label: 'All', filter: [] },
  { key: 'in', label: 'Inbound', filter: [{ key: 'direction', value: 'Inbound' }] },
  { key: 'out', label: 'Outbound', filter: [{ key: 'direction', value: 'Outbound' }] },
  { key: 'miss', label: 'Missed', filter: [{ key: 'direction', value: 'Missed' }] },
];

/* Sorting key for a call row. Falls back through the stamp fields the API has
   used, and returns 0 rather than NaN so an unparseable row sinks instead of
   scrambling the order around it. */
const sortStamp = (raw: any): number => {
  const value = raw?.start_stamp || raw?.created_at || raw?.answer_stamp || raw?.end_stamp;
  if (!value) return 0;
  const parsed = moment(value as any);
  return parsed.isValid() ? parsed.valueOf() : 0;
};

/* Date-section label for a call, phone-log style: Today, Yesterday, then the
   weekday name for the past week, and the full date for anything older. Rows
   without a usable stamp fall under Today. */
const sectionLabel = (raw: any): string => {
  const value = raw?.start_stamp || raw?.created_at || raw?.answer_stamp || raw?.end_stamp;
  const m = value ? moment(value as any) : null;
  if (!m || !m.isValid()) return 'Today';
  if (m.isSame(moment(), 'day')) return 'Today';
  if (m.isSame(moment().subtract(1, 'day'), 'day')) return 'Yesterday';
  if (m.isAfter(moment().subtract(7, 'days').startOf('day'))) return m.format('dddd');
  return m.format('DD MMM YYYY');
};

const secondsToClock = (value: unknown) => {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return '—';
  const m = Math.floor(n / 60);
  const s = Math.floor(n % 60);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
};

const timeLabel = (stamp: unknown) => {
  if (!stamp) return '';
  const m = moment(stamp as any);
  if (!m.isValid()) return String(stamp);
  return m.isSame(moment(), 'day') ? m.format('HH:mm') : m.format('DD MMM');
};

/* Talk duration in seconds. Reads the usual duration fields, and falls back to
   the gap between answer and end timestamps when none is present (some outbound
   logs carry the stamps but not a billsec/duration number). */
const durationSeconds = (raw: any = {}): number => {
  const direct = Number(
    raw?.billsec ?? raw?.duration ?? raw?.talk_sec ?? raw?.talk_time ?? raw?.duration_seconds,
  );
  if (Number.isFinite(direct) && direct > 0) return direct;
  const answer = raw?.answer_stamp;
  const end = raw?.end_stamp || raw?.hangup_stamp;
  if (answer && end) {
    const diff = moment(end as any).diff(moment(answer as any), 'seconds');
    if (Number.isFinite(diff) && diff > 0) return diff;
  }
  return 0;
};

const getEntryLogs = (main: any = {}) => {
  const callLogs = Array.isArray(main?.call_logs)
    ? main.call_logs.filter((item: any) => item && typeof item === 'object')
    : [];
  return callLogs.length ? callLogs : main && Object.keys(main).length ? [main] : [];
};

const getEntryRawNumber = (main: any = {}) =>
  String(
    (main?.direction === 'Outbound' ? main?.destination_number : main?.caller_id_number) || '',
  );

const getEntryNumber = (main: any = {}) => getEntryRawNumber(main).replace(/ /g, '');

/**
 * The contact map is keyed by whatever the call log stored, which is not always
 * the same shape as the number we display — it may carry spaces, a leading "+",
 * or a country prefix the saved contact lacks. Looking up only the
 * space-stripped form meant saved contacts kept reading "Not in contacts", so
 * the usual variants are tried, then a digits-only match as a last resort.
 */
const digitsOf = (value: string) => value.replace(/\D/g, '');

/* Avatar disc, keyed off the name so a caller always gets the same one. Pale
   fills with their own darker ink — light enough to sit quietly in a long list,
   and every pair still clears AA for the initials. */
const AVATAR_TONES: { bg: string; fg: string }[] = [
  { bg: '#dbeafe', fg: '#1d4ed8' },
  { bg: '#ede9fe', fg: '#6d28d9' },
  { bg: '#dcfce7', fg: '#15803d' },
  { bg: '#ffedd5', fg: '#b45309' },
  { bg: '#ffe4e6', fg: '#be123c' },
  { bg: '#cffafe', fg: '#0e7490' },
  { bg: '#fae8ff', fg: '#a21caf' },
];

const avatarTone = (value: string) => {
  const s = String(value || '?');
  let h = 0;
  for (let i = 0; i < s.length; i += 1) h = (h * 31 + s.charCodeAt(i)) | 0;
  return AVATAR_TONES[Math.abs(h) % AVATAR_TONES.length];
};

export const findContact = (contactsByNumber: Record<string, any>, rawNumber: string) => {
  if (!contactsByNumber || !rawNumber) return null;

  const stripped = rawNumber.replace(/ /g, '');
  for (const key of [rawNumber, stripped, stripped.replace(/^\+/, ''), `+${stripped}`]) {
    if (key && contactsByNumber[key]) return contactsByNumber[key];
  }

  const digits = digitsOf(rawNumber);
  if (digits.length < 7) return null;
  const tail = digits.slice(-10);
  const match = Object.keys(contactsByNumber).find((key) => {
    const keyDigits = digitsOf(key);
    return keyDigits.length >= 7 && keyDigits.slice(-10) === tail;
  });
  return match ? contactsByNumber[match] : null;
};

export const toCallRow = (raw: any, contactsByNumber: Record<string, any>): ConsoleCallRow => {
  const rawDirection = String(raw?.direction || '').toLowerCase();
  const isMissed =
    rawDirection === 'missed' ||
    String(raw?.hangup_cause || '').toUpperCase() === 'NO_ANSWER' ||
    (rawDirection === 'inbound' && Number(raw?.billsec || raw?.duration || 0) === 0);
  const direction: ConsoleCallRow['direction'] = isMissed
    ? 'miss'
    : rawDirection === 'outbound'
      ? 'out'
      : 'in';

  const number = getEntryNumber(raw);
  const contact = findContact(contactsByNumber, getEntryRawNumber(raw)) || {};
  const savedName = contact?.first_name
    ? `${contact.first_name}${contact.last_name ? ` ${contact.last_name}` : ''}`.trim()
    : String(contact?.name || '').trim();
  // The carrier's caller-id name is only a fallback, and is often a
  // placeholder rather than a person.
  const carrierName = String(raw?.contact_name || raw?.caller_id_name || '').trim();
  const contactName =
    savedName ||
    (/^(unknown|anonymous|private|restricted|n\/?a)$/i.test(carrierName) ? '' : carrierName);

  const accLogs = getEntryLogs(raw);
  const hasRecording = accLogs.some((log: any) =>
    Boolean(log?.record_file || log?.recording || log?.recording_file || log?.record_path),
  );

  return {
    id: String(raw?.uuid || raw?.id || raw?.sip_call_id || `${number}-${raw?.start_stamp}`),
    raw,
    direction,
    name: contactName || number || 'Unknown',
    number,
    time: timeLabel(raw?.start_stamp),
    duration: secondsToClock(durationSeconds(raw)),
    topic: String(raw?.disposition || raw?.queue_name || '').trim(),
    contactId: contact?.id || null,
    hasRecording,
    logData: {
      main: raw,
      count: raw?.count ?? accLogs.length,
      acc_logs: accLogs,
      number,
    },
  };
};

type Props = {
  selectedId: string | null;
  onSelect: (row: ConsoleCallRow) => void;
  source: ConsoleLogSource;
  onSourceChange: (source: ConsoleLogSource) => void;
  liveNumber?: string;
};

const CallListColumn = ({ selectedId, onSelect, source, onSourceChange, liveNumber }: Props) => {
  const { dial } = useConsoleDialer();
  const navigate = useNavigate();
  const [direction, setDirection] = useState<'all' | 'in' | 'out' | 'miss'>('all');
  const [search, setSearch] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [dropdownVal, setDropdownVal] = useState(() => ({
    ...dropdownCallInitialVal,
    date_type: 'Today',
    value: handleDate('Today'),
  }));
  const DATE_PRESETS = ['All', 'Today', 'Yesterday', 'Last 7 Days', 'Last 30 Days', 'This Month'];
  const { data: contactsByNumber } = useFetchContact();
  const { features } = useCompanyFeatures();
  const callAccess = features?.plan_features?.advance_call_management?.access;

  const filterDate = dropdownVal?.value || {};
  const activeDirection =
    DIRECTION_FILTERS.find((f) => f.key === direction) || DIRECTION_FILTERS[0];
  /* "Missed" is not a direction the switch records — it is derived from the
     hangup cause, or from an inbound call that never got a talk second. Asking
     the API to filter on direction='Missed' therefore returns nothing. Inbound
     and outbound are real values and stay server-side; missed is fetched
     unfiltered and narrowed below, on the same rule `toCallRow` already uses. */
  const filterMissedLocally = source !== 'voicemail' && direction === 'miss';
  // Voicemails were never direction-filtered on the old page; keep that.
  const directionFilter =
    source === 'voicemail' || filterMissedLocally ? [] : activeDirection.filter;

  const { data, isPending, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useInfiniteQuery({
      queryKey: [
        'console-call-list',
        source,
        source === 'voicemail' ? 'all' : direction,
        filterDate?.from,
        filterDate?.to,
      ],
      queryFn: ({ pageParam = 1 }) =>
        fetchPhone({
          page: pageParam,
          limit: 50,
          type: source === 'call' ? undefined : source,
          filter: directionFilter,
          filter_date: { from: filterDate?.from, to: filterDate?.to },
          sort: { key: 'start_stamp', desc: true },
        }),
      initialPageParam: 1,
      getNextPageParam: (lastPage: any) => {
        const result = lastPage?.data?.data?.result;
        const { currentPage, totalPages } = result || {};
        if (!currentPage || !totalPages || currentPage >= totalPages) return undefined;
        return currentPage + 1;
      },
    });

  const rows = useMemo(() => {
    const flat =
      data?.pages.flatMap((page: any) => page?.data?.data?.result?.rows || []) || ([] as any[]);

    /* The API groups repeat calls: one entry per number, carrying `call_logs`
       and a `count`. Rendering the entry gave one row however many times
       somebody rang — five calls from the same number looked like one. Each
       log becomes its own row instead, so the list is a call history rather
       than a contact list.

       Log fields win over entry fields, but the entry is spread underneath:
       a log carries its own time, duration and hangup cause, and inherits
       direction and caller id from the group when it does not repeat them. */
    const expanded = flat.flatMap((entry: any) => {
      const logs = getEntryLogs(entry);
      if (logs.length <= 1) return [entry];
      return logs.map((log: any) => ({ ...entry, ...log, call_logs: [log], count: 1 }));
    });

    const mapped = expanded
      .map((raw: any, index: number) => {
        const row = toCallRow(raw, contactsByNumber || {});
        /* Two calls a second apart can share every field the id is built
           from. A positional suffix keeps React keys unique so neither row
           disappears. */
        return { ...row, id: `${row.id}#${index}` };
      })
      /* Expanding breaks the server's ordering, since a group's logs arrive
         together rather than in time order across groups. */
      .sort((a, b) => sortStamp(b.raw) - sortStamp(a.raw));

    /* Narrow to the exact mapped direction so the tabs are mutually exclusive:
       Inbound shows only answered incoming calls (a missed inbound is mapped to
       'miss', so it no longer appears under Inbound), Outbound only outgoing,
       Missed only missed. Voicemails and "All" are never direction-filtered. */
    const visible =
      source === 'voicemail' || direction === 'all'
        ? mapped
        : mapped.filter((row) => row.direction === direction);
    const q = search.trim().toLowerCase();
    if (!q) return visible;
    return visible.filter((r) =>
      `${r.name} ${r.number} ${r.topic}`.toLowerCase().includes(q.replace(/^\+/, '')),
    );
  }, [data, contactsByNumber, search, source, direction]);

  /* Sample rows, shown only when the platform returned an empty list — never
     mixed in alongside real calls. `DEMO_ENABLED` in demo-data.ts turns the
     whole thing off. */
  const isDemo = !isPending && rows.length === 0;
  const listRows = useMemo(() => {
    if (!isDemo) return rows;
    return demoCallRows(source)
      .filter((r) => source === 'voicemail' || direction === 'all' || r.direction === direction)
      .filter((r) => {
        const q = search.trim().toLowerCase();
        return !q || `${r.name} ${r.number}`.toLowerCase().includes(q.replace(/^\+/, ''));
      })
      .map((r) => ({
        ...r,
        raw: {},
        name: r.name || r.number,
        topic: '',
        contactId: null,
        logData: { main: {}, count: 1, acc_logs: [], number: r.number },
      })) as ConsoleCallRow[];
  }, [isDemo, rows, source, direction, search]);

  /* Counted off the rows on screen, so the tiles always agree with the list
     beneath them — change the date range or the tab and they move with it.
     Nothing here is estimated: the rate is answered over total, and when the
     list is empty the tiles read zero rather than inventing a trend. */
  const kpis = useMemo(() => {
    const total = listRows.length;
    const missed = listRows.filter((r) => r.direction === 'miss').length;
    const answered = total - missed;
    const pct = total ? Math.round((answered / total) * 1000) / 10 : 0;
    return [
      { key: 'total', label: 'Total calls', value: total, sub: 'in this range' },
      { key: 'answered', label: 'Answered', value: answered, sub: total ? `${pct}% rate` : 'no calls yet' },
      {
        key: 'missed',
        label: 'Missed',
        value: missed,
        sub: total ? `${Math.round((missed / total) * 100)}% of calls` : 'none missed',
      },
    ];
  }, [listRows]);

  const sources: { key: ConsoleLogSource; label: string; show: boolean }[] = [
    { key: 'call', label: 'Calls', show: true },
    { key: 'recording', label: 'Recordings', show: Boolean(callAccess?.RECORDING) },
    { key: 'voicemail', label: 'Voicemails', show: true },
  ];

  return (
    <div className="col calls">
      <div className="col-head">
        <div className="col-title">
          <h2>Phone</h2>
          {/* Right side: expandable search + date filter. */}
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
            {searchOpen ? (
              <input
                autoFocus
                className="cr-search-inline"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onBlur={() => {
                  if (!search.trim()) setSearchOpen(false);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') {
                    setSearch('');
                    setSearchOpen(false);
                  }
                }}
                placeholder="Search calls…"
                aria-label="Search calls"
              />
            ) : (
              <button
                type="button"
                aria-label="Search"
                title="Search"
                onClick={() => setSearchOpen(true)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 34,
                  height: 34,
                  padding: 0,
                  borderRadius: 9,
                  background: '#fff',
                  border: '1px solid var(--line)',
                  boxShadow: '0 1px 3px rgba(17,17,17,0.06)',
                  cursor: 'pointer',
                  color: 'var(--ink-2)',
                }}
              >
                <Ic n="search" size={15} />
              </button>
            )}

            {/* Date-range filter — the shared control, so this and the web chat
                manager stay the same thing. */}
            <DateRangeMenu
              options={DATE_PRESETS.map((preset) => ({ label: preset, value: preset }))}
              value={dropdownVal.date_type}
              onChange={(preset) =>
                setDropdownVal((prev) => ({
                  ...prev,
                  date_type: preset,
                  value: handleDate(preset),
                }))
              }
            />
          </div>
        </div>

        {/* Answer rate is a Calls figure — a recording or voicemail list has
            no notion of "missed", so the tiles would be meaningless there. */}
        {source === 'call' ? (
        <div className="cr-kpis">
          {kpis.map((k) => (
            <div className="cr-kpi" key={k.key}>
              <div className="cr-kpi-l">{k.label}</div>
              <div className="cr-kpi-v num">{k.value}</div>
              <div className="cr-kpi-s">{k.sub}</div>
            </div>
          ))}
        </div>
        ) : null}

        {/* source tabs — same tabType values the old phone page sent */}
        <div className="panel-tabs" style={{ padding: 0, margin: '0 0 2px' }}>
          {sources
            .filter((s) => s.show)
            .map((s) => (
              <button
                type="button"
                key={s.key}
                className={`ptab ${source === s.key ? 'on' : ''}`}
                onClick={() => {
                  /* Missed only exists on Calls — don't leave it stuck on. */
                  if (s.key !== 'call' && direction === 'miss') setDirection('all');
                  onSourceChange(s.key);
                }}
              >
                {s.label}
              </button>
            ))}
        </div>

        {source !== 'voicemail' ? (
          <div className="seg" role="tablist">
            {/* A recording only exists for a call that connected, so Missed
                is offered on the Calls list only. */}
            {DIRECTION_FILTERS.filter(
              (f) => f.key !== 'miss' || source === 'call',
            ).map((f) => (
              <button
                key={f.key}
                type="button"
                role="tab"
                aria-selected={direction === f.key}
                className={direction === f.key ? 'on' : ''}
                onClick={() => setDirection(f.key)}
              >
                {f.label}
              </button>
            ))}
          </div>
        ) : null}
      </div>

      <div className="list">
        {isPending ? (
          <div className="empty" style={{ height: 200 }}>
            <Loader />
          </div>
        ) : !listRows.length ? (
          <div className="empty" style={{ height: 200 }}>
            <Ic n="search" size={30} />
            <p>
              No{' '}
              {source === 'voicemail'
                ? 'voicemails'
                : source === 'recording'
                  ? 'recordings'
                  : 'calls'}{' '}
              in this date range.
            </p>
          </div>
        ) : (
          <>
            {isDemo ? (
              <div className="cr-section" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span className="src demo">
                  <Ic n="alert" size={9} />
                  Demo data
                </span>
                <span style={{ fontWeight: 500, color: 'var(--ink-4)' }}>
                  no calls in this range — showing samples
                </span>
              </div>
            ) : null}
            {listRows.map((row, index) => {
              const label = sectionLabel(row.raw);
              const showHeader =
                !isDemo && (index === 0 || sectionLabel(listRows[index - 1].raw) !== label);
              return (
                <div key={row.id} className="cr-group">
                  {showHeader ? <div className="cr-section">{label}</div> : null}
                  <div
                  role="button"
                  tabIndex={0}
                  className={`call-row ${selectedId === row.id ? 'on' : ''}`}
                  onClick={() => onSelect(row)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      onSelect(row);
                    }
                  }}
                >
                  {/* Contact-list style: a coloured disc, the name, then the
                      number and talk time beneath, with the clock time right. */}
                  <span
                    className="cr-av-init"
                    style={{
                      background: avatarTone(row.name || row.number).bg,
                      color: avatarTone(row.name || row.number).fg,
                    }}
                    aria-hidden
                  >
                    {initialsOf(row.name || row.number)}
                  </span>
                  <div className="cr-body">
                    <div className={`cr-name ${row.direction === 'miss' ? 'cr-name-miss' : ''}`}>
                      {isNumberLike(row.name) ? (
                        <DialNumber number={row.number} className="num" />
                      ) : (
                        row.name
                      )}
                    </div>
                    <div className="cr-sub">
                      {/* Which way the call went — inbound, outbound or missed. */}
                      <span
                        className={`cr-dir ${row.direction === 'miss' ? 'miss' : row.direction}`}
                        title={
                          row.direction === 'out'
                            ? 'Outgoing call'
                            : row.direction === 'miss'
                              ? 'Missed call'
                              : 'Incoming call'
                        }
                      >
                        <Ic
                          n={
                            row.direction === 'out'
                              ? 'arrow-out'
                              : row.direction === 'miss'
                                ? 'x'
                                : 'arrow-in'
                          }
                          size={13}
                        />
                      </span>
                      {!isNumberLike(row.name) ? (
                        <span className="num">{row.number}</span>
                      ) : null}
                      {row.duration !== '—' ? (
                        <>
                          {!isNumberLike(row.name) ? <span className="cr-dot">·</span> : null}
                          <Ic n="clock" size={11} />
                          <span className="num">{row.duration}</span>
                        </>
                      ) : null}
                      {row.hasRecording ? (
                        <Ic n="rec" size={11} className="cr-rec-ic" />
                      ) : null}
                    </div>
                  </div>
                  <span className="cr-time-right num">{row.time}</span>
                  {row.number ? (
                    <div className="cr-actions">
                      <button
                        type="button"
                        className="cr-act call"
                        aria-label={`Call ${row.name || row.number}`}
                        title="Call"
                        onClick={(e) => {
                          e.stopPropagation();
                          rememberDialLabel(row.number, row.name);
                          dial(row.number);
                        }}
                      >
                        <Ic n="phone" size={14} />
                      </button>
                      <button
                        type="button"
                        className="cr-act"
                        aria-label="Message"
                        title="Message"
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate('/inbox');
                        }}
                      >
                        <Ic n="chat" size={14} />
                      </button>
                      {/* Add contact only when the number isn't already saved
                          (the row shows a raw number rather than a contact name). */}
                      {isNumberLike(row.name) && !row.contactId ? (
                        <button
                          type="button"
                          className="cr-act"
                          aria-label="Add contact"
                          title="Add contact"
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate('/contact', { state: { number: row.number } });
                          }}
                        >
                          <Ic n="plus" size={14} />
                        </button>
                      ) : null}
                    </div>
                  ) : null}
                  </div>
                </div>
              );
            })}
            {hasNextPage ? (
              <div style={{ padding: 12 }}>
                <button
                  type="button"
                  className="btn ghost sm"
                  style={{ width: '100%' }}
                  disabled={isFetchingNextPage}
                  onClick={() => fetchNextPage()}
                >
                  {isFetchingNextPage ? 'Loading…' : 'Load more'}
                </button>
              </div>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
};

export default CallListColumn;
