import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import moment, { type Moment } from 'moment';
import { Check, MessageSquare, Phone, Play, Search, Voicemail } from 'lucide-react';
import AudioModal from '@/pages/phone/audio-dialog';
import { callList, calendarMeetingList, updateEventTaskStatus } from '@/services/api';
import { formatPhoneNumber, getInitials, handleAlert, MEDIA_URL } from '@/lib/utils';
import { useUser } from '@/hooks/use-user';
import { useCompanyFeatures } from '@/hooks/rbac';
import { useDialpad } from '@/hooks/use-dialpad';
import { useSocketEvents } from '@/hooks/use-socket-events';
import { useRecordingAccess } from '@/hooks/use-recording-access';
import { formatSecsToClock, timeStringToSeconds } from './format';
import { PerfNotice } from './perf-surface';
import { DUMMY_TASKS } from './dummy-tab-data';
import './callbacks.css';

/* ---------------------------------------------------------------------------
   Performance ▸ Callbacks — the callbacks agents have promised, and the
   voicemail waiting for a reply.

   Callbacks are a work queue, so they aren't cut to the date range: one that
   went overdue yesterday still needs making today. Voicemail is read for the
   range picked in the header, like the rest of Performance.
   --------------------------------------------------------------------------- */

type Bucket = 'overdue' | 'today' | 'tomorrow' | 'week' | 'later' | 'unscheduled' | 'done';
type StatusFilter = 'open' | 'overdue' | 'done' | 'all';
type View = 'callbacks' | 'voicemail';

type Callback = {
  id: string;
  /** The calendar task behind it; missing on anything that can't be updated. */
  taskId: string | null;
  title: string;
  /** The number, shown under the name when there is a name to show. */
  detail: string;
  phone: string;
  contactName: string;
  note: string;
  source: string;
  owners: string[];
  due: Moment | null;
  created: Moment | null;
  bucket: Bucket;
  isDone: boolean;
  didNumber: string;
  haystack: string;
  digits: string[];
};

type VoicemailItem = {
  id: string;
  raw: any;
  caller: string;
  callerDetail: string;
  /** Who a call back would ring. */
  number: string;
  target: string;
  line: string;
  left: Moment | null;
  seconds: number;
  recordingUrl: string;
  haystack: string;
  digits: string[];
};

/** The name every dialpad and campaign callback is saved under — it says nothing about the call. */
const DEFAULT_TASK_NAME = 'call back schedule';
const TASKS_KEY = ['performanceCallbackTasks'];
const LIST_LIMIT = 200;
const SOON_MS = 60 * 60 * 1000;
const LATEST = Number.MAX_SAFE_INTEGER;

const SOURCE_LABEL: Record<string, string> = {
  QUEUE: 'Queue',
  LEAD: 'Campaign lead',
  CONTACT: 'Contact',
  CALLBACK: 'Callback',
  CALENDAR: 'Calendar',
  DIALER: 'Dialer',
  DEPARTMENT: 'Department',
};

const GROUPS: { key: Bucket; label: string }[] = [
  { key: 'overdue', label: 'Overdue' },
  { key: 'today', label: 'Today' },
  { key: 'tomorrow', label: 'Tomorrow' },
  { key: 'week', label: 'Next 7 days' },
  { key: 'later', label: 'Later' },
  { key: 'unscheduled', label: 'No due time' },
  { key: 'done', label: 'Done' },
];

const STATUS_FILTERS: { key: StatusFilter; label: string }[] = [
  { key: 'open', label: 'Open' },
  { key: 'overdue', label: 'Overdue' },
  { key: 'done', label: 'Done' },
  { key: 'all', label: 'All' },
];

/* ---- helpers ---- */

const capitalise = (value: string) => (value ? value[0].toUpperCase() + value.slice(1) : value);

/** A number as the rest of the app prints it, or as given when it won't parse. */
const prettyNumber = (value: string) => {
  if (!value) return '';
  try {
    return formatPhoneNumber(value) || value;
  } catch {
    return value;
  }
};

const digitsOf = (value: string) => value.replace(/\D/g, '');

const parseMoment = (value: unknown) => {
  if (!value) return null;
  const parsed = moment(value as string);
  return parsed.isValid() ? parsed : null;
};

const spanOf = (ms: number) => {
  const minutes = Math.max(0, Math.round(ms / 60000));
  if (minutes < 1) return 'under a minute';
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    const rest = minutes % 60;
    return rest ? `${hours} h ${rest} min` : `${hours} h`;
  }
  const days = Math.floor(hours / 24);
  return `${days} ${days === 1 ? 'day' : 'days'}`;
};

const dayOffset = (date: Moment, now: Moment) =>
  date.clone().startOf('day').diff(now.clone().startOf('day'), 'days');

const dayLabel = (date: Moment, now: Moment) => {
  const offset = dayOffset(date, now);
  if (offset === 0) return 'Today';
  if (offset === 1) return 'Tomorrow';
  if (offset === -1) return 'Yesterday';
  return date.format(date.isSame(now, 'year') ? 'ddd D MMM' : 'D MMM YYYY');
};

const bucketOf = (due: Moment | null, isDone: boolean, now: Moment): Bucket => {
  if (isDone) return 'done';
  if (!due) return 'unscheduled';
  if (due.isBefore(now)) return 'overdue';
  const offset = dayOffset(due, now);
  if (offset === 0) return 'today';
  if (offset === 1) return 'tomorrow';
  return offset <= 6 ? 'week' : 'later';
};

/** Owners arrive flat from the dialpad and nested under `user_detail` from the calendar. */
const ownersOf = (task: any): string[] => {
  const members = Array.isArray(task?.members) ? task.members : [];
  const people = members.flatMap((member: any) =>
    Array.isArray(member?.user_detail) ? member.user_detail : [member],
  );
  const names = people
    .filter((person: any) => String(person?.type || '').toUpperCase() !== 'GUEST')
    .map(
      (person: any) =>
        String(person?.name || '').trim() || String(person?.email || '').split('@')[0].trim(),
    )
    .filter(Boolean);
  return Array.from(new Set<string>(names));
};

const sourceOf = (task: any, hasPhone: boolean) => {
  const code = String(task?.source || '').trim().toUpperCase();
  if (SOURCE_LABEL[code]) return SOURCE_LABEL[code];
  if (code) return capitalise(code.toLowerCase().replace(/_/g, ' '));
  if (task?.contactId) return 'Campaign lead';
  return hasPhone ? 'Callback' : 'Task';
};

const toCallback = (task: any, index: number, now: Moment): Callback => {
  const contactName = String(task?.details?.contactName || '').trim();
  const phone = String(task?.details?.contactPhone || '').trim();
  const name = String(task?.name || task?.title || '').trim();
  const isNamed = Boolean(name) && name.toLowerCase() !== DEFAULT_TASK_NAME;
  const who = contactName || prettyNumber(phone);
  const title = who || name || 'Untitled task';
  const note = String(task?.description || '').trim() || (who && isNamed ? name : '');
  const due = parseMoment(task?.startTime);
  const isDone = String(task?.status || '').toUpperCase() === 'COMPLETED';
  const owners = ownersOf(task);
  const source = sourceOf(task, Boolean(phone));

  return {
    id: String(task?._id || `task-${index}`),
    taskId: task?._id ? String(task._id) : null,
    title,
    detail: contactName && phone ? prettyNumber(phone) : '',
    phone,
    contactName,
    note,
    source,
    owners,
    due,
    created: parseMoment(task?.createdAt),
    bucket: bucketOf(due, isDone, now),
    isDone,
    didNumber: String(task?.didNumber || '').trim(),
    haystack: [title, note, source, ...owners].join(' ').toLowerCase(),
    digits: [digitsOf(phone)],
  };
};

const toVoicemail = (row: any, index: number, companyUuid: string): VoicemailItem => {
  const isOutbound = String(row?.direction || '') === 'Outbound';
  const callerNumber = String(row?.caller_id_number || '').trim();
  const number = String((isOutbound ? row?.destination_number : row?.caller_id_number) || '').trim();
  // Anything five digits or shorter is an extension, the test the voicemail report uses.
  const isExternal = callerNumber.length > 5;
  const caller = isExternal
    ? prettyNumber(callerNumber)
    : String(row?.from_display_name || '').trim() || callerNumber || 'Unknown caller';
  const callerDetail = !isExternal && row?.extension ? `Ext ${row.extension}` : '';
  const target = String(row?.forward_name || row?.to_display_name || row?.destination_number || '').trim();
  const line = String(row?.via_did || '').trim();

  return {
    id: `${row?.uuid || row?.sipcall_id || row?.start_stamp || 'voicemail'}-${index}`,
    raw: row,
    caller,
    callerDetail,
    number,
    target,
    line,
    left: row?.start_stamp ? moment.utc(row.start_stamp).local() : null,
    seconds: Number(row?.billsectotal) || timeStringToSeconds(row?.billsec) || 0,
    recordingUrl:
      row?.recording_file && companyUuid
        ? `${MEDIA_URL}/${companyUuid}/recording/${row.recording_file}`
        : '',
    haystack: [caller, callerDetail, target].join(' ').toLowerCase(),
    digits: [digitsOf(callerNumber), digitsOf(number), digitsOf(line)],
  };
};

const byDue = (direction: 1 | -1) => (a: Callback, b: Callback) =>
  ((a.due?.valueOf() ?? LATEST) - (b.due?.valueOf() ?? LATEST)) * direction;

const byCreatedNewest = (a: Callback, b: Callback) =>
  (b.created?.valueOf() ?? 0) - (a.created?.valueOf() ?? 0);

/** Late ones oldest first, upcoming ones soonest first, done ones latest first. */
const sorterFor = (bucket: Bucket) =>
  bucket === 'done' ? byDue(-1) : bucket === 'unscheduled' ? byCreatedNewest : byDue(1);

const dueLineOf = (item: Callback, now: Moment) => {
  if (!item.due) return { when: 'No due time', hint: '', tone: '' };
  const when = `${dayLabel(item.due, now)}, ${item.due.format('h:mm A')}`;
  if (item.isDone) return { when, hint: 'Done', tone: '' };
  const diff = item.due.diff(now);
  if (diff < 0) return { when, hint: `${capitalise(spanOf(-diff))} overdue`, tone: 'late' };
  if (diff <= SOON_MS) return { when, hint: `Due in ${spanOf(diff)}`, tone: 'soon' };
  return { when, hint: `In ${spanOf(diff)}`, tone: '' };
};

/** The cached list with one task's status changed, so a tick lands before the refetch does. */
const withTaskStatus = (cached: any, taskId: string, status: string) => {
  const result = cached?.data?.data?.result;
  if (!Array.isArray(result?.rows)) return cached;
  return {
    ...cached,
    data: {
      ...cached.data,
      data: {
        ...cached.data.data,
        result: {
          ...result,
          rows: result.rows.map((row: any) => (String(row?._id) === taskId ? { ...row, status } : row)),
        },
      },
    },
  };
};

const matches = (item: { haystack: string; digits: string[] }, needle: string) => {
  if (!needle) return true;
  if (item.haystack.includes(needle)) return true;
  const needleDigits = digitsOf(needle);
  return needleDigits.length >= 3 && item.digits.some((digits) => digits.includes(needleDigits));
};

/** Relative times ("in 25 min") move on their own; half a minute is fine enough for them. */
const useClock = () => {
  const [now, setNow] = useState(() => moment());
  useEffect(() => {
    const interval = setInterval(() => setNow(moment()), 30000);
    return () => clearInterval(interval);
  }, []);
  return now;
};

const listResult = (res: any) => {
  const result = res?.data?.data?.result || {};
  const rows: any[] = Array.isArray(result?.rows) ? result.rows : [];
  const total = Number(result?.totalItems ?? result?.total ?? rows.length) || rows.length;
  return { rows, total };
};

/* ---- pieces ---- */

const Empty = ({
  title,
  copy,
  action,
}: {
  title: string;
  copy: string;
  action?: { label: string; onClick: () => void };
}) => (
  <div className="pf-list-empty">
    <h4>{title}</h4>
    <p>{copy}</p>
    {action && (
      <button type="button" className="pf-list-empty-btn" onClick={action.onClick}>
        {action.label}
      </button>
    )}
  </div>
);

const LoadingRows = () => (
  <ul className="pf-rows" aria-label="Loading">
    {[0, 1, 2, 3].map((row) => (
      <li key={row} className="pf-list-row cb-row pf-skel" aria-hidden="true">
        <i />
        <i />
        <i />
        <i />
        <i />
        <i />
      </li>
    ))}
  </ul>
);

type CallbacksTabProps = {
  selectedRange: { from: string; to: string };
  /** "today", "yesterday" or "in this range" — how the voicemail figures describe their range. */
  rangePhrase: string;
};

const CallbacksTab = ({ selectedRange, rangePhrase }: CallbacksTabProps) => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useUser();
  const { features } = useCompanyFeatures();
  /* Whether this person may play this particular recording, on top of the
     plan permission. */
  const { canPlayRecording } = useRecordingAccess();
  const { makeCall, sessions } = useDialpad();
  const { usersOnlineStatus } = useSocketEvents();
  const callLogAccess = features?.plan_features?.reports?.action || {};
  const companyUuid = String(user?.company_info?.uuid || '');
  const now = useClock();

  const [view, setView] = useState<View>('callbacks');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('open');
  const [query, setQuery] = useState('');
  const [recordingUrl, setRecordingUrl] = useState('');
  const [isAudioOpen, setIsAudioOpen] = useState(false);
  const [updatingIds, setUpdatingIds] = useState<string[]>([]);

  const tasksQuery = useQuery({
    queryKey: TASKS_KEY,
    queryFn: () =>
      calendarMeetingList({
        page: 1,
        limit: LIST_LIMIT,
        filters: [{ key: 'category', value: 'TASK' }],
      }),
    select: listResult,
    refetchInterval: 10000,
  });

  const voicemailQuery = useQuery({
    queryKey: ['performanceCallbackVoicemail', selectedRange?.from, selectedRange?.to],
    queryFn: () =>
      callList({ page: 1, limit: LIST_LIMIT, type: 'voicemail', filter_date: selectedRange }),
    select: listResult,
    refetchInterval: 10000,
    enabled: Boolean(selectedRange?.from && selectedRange?.to),
  });

  /* An account that has never scheduled a callback would open on an empty
     page, so it gets samples instead — said so above them, and inert. Only
     when the account truly has none: an error or a slow load never shows
     samples, and voicemail, which follows the range, never does. */
  const isSample = tasksQuery.isSuccess && !tasksQuery.data.rows.length;
  const taskRows: any[] | undefined = isSample ? DUMMY_TASKS : tasksQuery.data?.rows;
  const isTasksPending = tasksQuery.isPending;
  const isVoicemailPending = voicemailQuery.isPending;

  const callbacks = useMemo(
    () => (taskRows || []).map((task: any, index: number) => toCallback(task, index, now)),
    [taskRows, now],
  );
  const voicemails = useMemo(
    () =>
      (voicemailQuery.data?.rows || [])
        .map((row: any, index: number) => toVoicemail(row, index, companyUuid))
        .sort((a, b) => (b.left?.valueOf() ?? 0) - (a.left?.valueOf() ?? 0)),
    [voicemailQuery.data, companyUuid],
  );

  const counts = useMemo(() => {
    const result: Record<StatusFilter, number> = { open: 0, overdue: 0, done: 0, all: callbacks.length };
    callbacks.forEach((item) => {
      if (item.isDone) {
        result.done += 1;
        return;
      }
      result.open += 1;
      if (item.bucket === 'overdue') result.overdue += 1;
    });
    return result;
  }, [callbacks]);

  /* ---- overview figures ---- */

  const strip = useMemo(() => {
    const slots = [
      { key: 'overdue', label: 'Overdue', count: 0 },
      { key: 'd0', label: 'Today', count: 0 },
      { key: 'd1', label: 'Tomorrow', count: 0 },
      ...[2, 3, 4, 5].map((offset) => ({
        key: `d${offset}`,
        label: now.clone().add(offset, 'day').format('ddd D'),
        count: 0,
      })),
      { key: 'later', label: 'Later', count: 0 },
    ];
    const slotIndex = new Map(slots.map((slot, index) => [slot.key, index]));
    callbacks.forEach((item) => {
      if (item.isDone || !item.due) return;
      const offset = dayOffset(item.due, now);
      const key = item.bucket === 'overdue' ? 'overdue' : offset <= 5 ? `d${offset}` : 'later';
      const index = slotIndex.get(key);
      if (index !== undefined) slots[index].count += 1;
    });
    return slots;
  }, [callbacks, now]);
  const stripPeak = Math.max(1, ...strip.map((slot) => slot.count));

  const openCallbacks = useMemo(() => callbacks.filter((item) => !item.isDone), [callbacks]);
  const oldestOverdue = openCallbacks
    .filter((item) => item.bucket === 'overdue')
    .sort(byDue(1))[0];
  const nextDue = openCallbacks
    .filter((item) => item.due && item.bucket !== 'overdue')
    .sort(byDue(1))[0];
  const nextDay = nextDue?.due ? dayLabel(nextDue.due, now) : '';
  const headline = !callbacks.length
    ? 'No callbacks have been scheduled yet.'
    : oldestOverdue?.due
      ? `${counts.overdue} ${counts.overdue === 1 ? 'is' : 'are'} overdue, the oldest by ${spanOf(now.diff(oldestOverdue.due))}.`
      : nextDue?.due
        ? `Nothing overdue. The next is due ${
            ['Today', 'Tomorrow'].includes(nextDay) ? nextDay.toLowerCase() : `on ${nextDay}`
          } at ${nextDue.due.format('h:mm A')}.`
        : counts.open
          ? 'Nothing overdue, and none has a due time yet.'
          : 'Every callback is done.';

  const sources = useMemo(() => {
    const map = new Map<string, number>();
    callbacks.forEach((item) => map.set(item.source, (map.get(item.source) || 0) + 1));
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
  }, [callbacks]);
  const owners = useMemo(() => {
    const map = new Map<string, number>();
    openCallbacks.forEach((item) =>
      item.owners.forEach((owner) => map.set(owner, (map.get(owner) || 0) + 1)),
    );
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
  }, [openCallbacks]);
  const voicemailSeconds = voicemails.reduce((sum, item) => sum + item.seconds, 0);

  /* ---- the list ---- */

  const needle = query.trim().toLowerCase();
  const visibleCallbacks = callbacks.filter((item) => {
    if (!matches(item, needle)) return false;
    if (statusFilter === 'open') return !item.isDone;
    if (statusFilter === 'overdue') return item.bucket === 'overdue';
    if (statusFilter === 'done') return item.isDone;
    return true;
  });
  const groups = GROUPS.map((group) => ({
    ...group,
    items: visibleCallbacks.filter((item) => item.bucket === group.key).sort(sorterFor(group.key)),
  })).filter((group) => group.items.length);
  const visibleVoicemails = voicemails.filter((item) => matches(item, needle));

  /* ---- actions ---- */

  const myExtension = String(user?.user_info?.extension ?? '').trim();
  // The same two checks the Calendar and the voicemail report make before dialling.
  const isOnCall =
    Object.values(sessions || {}).some((session: any) =>
      ['ringing', 'connecting', 'confirmed', 'calling'].includes(
        String(session?.status || '').toLowerCase(),
      ),
    ) ||
    Boolean(
      myExtension &&
        (usersOnlineStatus || []).some(
          (entry: any) => String(entry?.userId) === myExtension && entry?.onCall,
        ),
    );

  const { mutate: updateStatus } = useMutation({
    mutationFn: updateEventTaskStatus,
    onMutate: async ({ eventTaskId, status }) => {
      setUpdatingIds((ids) => [...ids, eventTaskId]);
      await queryClient.cancelQueries({ queryKey: TASKS_KEY });
      const previous = queryClient.getQueryData(TASKS_KEY);
      queryClient.setQueryData(TASKS_KEY, (cached: any) => withTaskStatus(cached, eventTaskId, status));
      return { previous };
    },
    // The API client already reports the failure; this only puts the tick back.
    onError: (_error, _variables, context) => {
      if (context?.previous) queryClient.setQueryData(TASKS_KEY, context.previous);
    },
    onSuccess: (_data, { status }) => {
      handleAlert({
        text: status === 'COMPLETED' ? 'Callback marked as done' : 'Callback reopened',
        type: 'success',
      });
    },
    onSettled: (_data, _error, { eventTaskId }) => {
      setUpdatingIds((ids) => ids.filter((id) => id !== eventTaskId));
      // The Calendar and the due-now reminder read the same tasks.
      [
        TASKS_KEY,
        ['calendarMeetingList'],
        ['calendarMeetingListTodayEvents'],
        ['calendarMeetingListTaskList'],
      ].forEach((queryKey) => queryClient.invalidateQueries({ queryKey }));
    },
  });

  const toggleDone = (item: Callback) => {
    if (isSample || !item.taskId || updatingIds.includes(item.taskId)) return;
    updateStatus({ eventTaskId: item.taskId, status: item.isDone ? 'PENDING' : 'COMPLETED' });
  };

  const callBack = (item: Callback) => {
    if (isSample || item.isDone || isOnCall) return;
    if (!item.phone) {
      handleAlert({ text: 'Phone number not available', type: 'error' });
      return;
    }
    const extraHeaders = [`X-ContactName: ${item.contactName || ' '}`];
    if (item.didNumber) extraHeaders.push(`X-CallerId: ${item.didNumber}`);
    makeCall(item.phone, { extraHeaders });
  };

  const returnVoicemail = (item: VoicemailItem) => {
    if (isOnCall || !item.number) return;
    makeCall(item.number, { extraHeaders: item.line ? [`X-CallerId: ${item.line}`] : [] });
  };

  const playVoicemail = (item: VoicemailItem) => {
    if (!item.recordingUrl) return;
    setRecordingUrl(item.recordingUrl);
    setIsAudioOpen(true);
  };

  const clearSearch = () => setQuery('');

  const callbackEmpty = () => {
    if (needle) {
      return (
        <Empty
          title="No callbacks match"
          copy={`Nothing ${statusFilter === 'all' ? '' : `${statusFilter} `}matches “${query.trim()}”.`}
          action={{ label: 'Clear search', onClick: clearSearch }}
        />
      );
    }
    if (statusFilter === 'overdue') {
      return <Empty title="Nothing overdue" copy="Every open callback is still on time." />;
    }
    if (statusFilter === 'done') {
      return (
        <Empty title="Nothing done yet" copy="Callbacks you mark as done move here, so the open list stays short." />
      );
    }
    return (
      <Empty
        title="Every callback is done"
        copy="Nothing is waiting. New callbacks land here, with their due time, as agents schedule them."
        action={counts.done ? { label: 'Show done', onClick: () => setStatusFilter('done') } : undefined}
      />
    );
  };

  const tasksLoaded = tasksQuery.data?.rows.length || 0;
  const tasksTotal = tasksQuery.data?.total || 0;
  const voicemailLoaded = voicemailQuery.data?.rows.length || 0;
  const voicemailTotal = voicemailQuery.data?.total || 0;

  return (
    <div className="pf-wrap cb-wrap">
      {/* ---- overview ---- */}
      <section className="pf-overview cb-overview" aria-label="Callbacks at a glance">
        <div className={`pf-overview-lead${counts.overdue ? '' : ' is-calm'}`}>
          <p className="pf-eyebrow">
            <i aria-hidden="true" />
            Callback queue
            {isSample && <span className="pf-sample-chip">Sample</span>}
          </p>
          <div className="pf-total">
            <b>{isTasksPending ? '—' : counts.open}</b>
            <div>
              <strong>{counts.open === 1 ? 'callback to make' : 'callbacks to make'}</strong>
              <span>
                {isTasksPending
                  ? 'Loading callbacks…'
                  : tasksQuery.isError
                    ? 'Callbacks couldn’t be loaded.'
                    : headline}
              </span>
            </div>
          </div>
        </div>

        <ol className="cb-strip" aria-label="Open callbacks by the day they are due">
          {strip.map((slot) => (
            <li
              key={slot.key}
              className={[
                'cb-day',
                slot.key === 'overdue' ? 'is-overdue' : '',
                slot.key === 'd0' ? 'is-today' : '',
                slot.count ? 'has-items' : '',
              ]
                .filter(Boolean)
                .join(' ')}
            >
              <span>{slot.label}</span>
              <b>{isTasksPending ? '—' : slot.count}</b>
              <em aria-hidden="true">
                <i style={{ width: `${(slot.count / stripPeak) * 100}%` }} />
              </em>
            </li>
          ))}
        </ol>

        <dl className="pf-readouts">
          <div>
            <dt>Completed</dt>
            <dd>
              {isTasksPending ? '—' : counts.done}
              {!isTasksPending && <em>of {counts.all}</em>}
            </dd>
            <small>
              {counts.all
                ? `${Math.round((counts.done / counts.all) * 100)}% of callbacks closed`
                : 'Nothing scheduled yet'}
            </small>
          </div>
          <div>
            <dt>Voicemail {rangePhrase}</dt>
            <dd>{isVoicemailPending ? '—' : voicemails.length}</dd>
            <small>
              {voicemails.length
                ? `${formatSecsToClock(voicemailSeconds)} of messages`
                : isVoicemailPending
                  ? 'Loading voicemail'
                  : `No voicemail ${rangePhrase}`}
            </small>
          </div>
          <div>
            <dt>Top source</dt>
            <dd>
              <span>{sources[0]?.[0] || '—'}</span>
              {sources[0] && <em>{sources[0][1]}</em>}
            </dd>
            <small>
              {sources.length > 1
                ? sources
                    .slice(1, 3)
                    .map(([source, count]) => `${source} ${count}`)
                    .join(' · ')
                : sources.length
                  ? 'The only source so far'
                  : 'No callbacks yet'}
            </small>
          </div>
          <div>
            <dt>Owners</dt>
            <dd>
              {owners.length}
              <em>{owners.length === 1 ? 'person' : 'people'}</em>
            </dd>
            <small>
              {owners[0]
                ? `Most with ${owners[0][0]} (${owners[0][1]})`
                : 'Nobody has an open callback'}
            </small>
          </div>
        </dl>
      </section>

      {isSample && (
        <PerfNotice>
          No callbacks have been scheduled on this account yet, so the ones below are samples showing
          how the page reads. They can’t be called or marked done.
        </PerfNotice>
      )}

      {/* ---- switcher, filters and search: one row ---- */}
      <div className="pf-toolbar">
        <div className="mcm-segmented" role="group" aria-label="Show callbacks or voicemail">
          {(
            [
              { key: 'callbacks', label: 'Callbacks', count: isTasksPending ? null : counts.open },
              {
                key: 'voicemail',
                label: 'Voicemail',
                count: isVoicemailPending ? null : voicemails.length,
              },
            ] as const
          ).map((tab) => (
            <button
              key={tab.key}
              type="button"
              aria-pressed={view === tab.key}
              className={view === tab.key ? 'is-active' : ''}
              onClick={() => setView(tab.key)}
            >
              {tab.label}
              {tab.count !== null && <em>{tab.count}</em>}
            </button>
          ))}
        </div>
        {view === 'callbacks' && counts.all > 0 && (
          <div className="mcm-segmented" role="group" aria-label="Filter callbacks">
            {STATUS_FILTERS.map((filter) => (
              <button
                key={filter.key}
                type="button"
                aria-pressed={statusFilter === filter.key}
                className={statusFilter === filter.key ? 'is-active' : ''}
                onClick={() => setStatusFilter(filter.key)}
              >
                {filter.label}
                <em>{counts[filter.key]}</em>
              </button>
            ))}
          </div>
        )}
        <label className="pf-search pf-toolbar-search">
          <Search aria-hidden="true" />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={view === 'callbacks' ? 'Search name, number or owner' : 'Search caller or number'}
            aria-label={view === 'callbacks' ? 'Search callbacks' : 'Search voicemail'}
          />
        </label>
      </div>

      {view === 'callbacks' ? (
        <section className="pf-list" aria-label="Callbacks">
          <div className="pf-list-cols cb-cols" aria-hidden="true">
            <span />
            <span>Contact</span>
            <span>Source</span>
            <span>Due</span>
            <span>Owner</span>
            <span />
          </div>
          {isTasksPending ? (
            <LoadingRows />
          ) : tasksQuery.isError ? (
            <Empty
              title="Callbacks couldn’t be loaded"
              copy="The callback list didn’t come back. It will try again on its own, or you can try now."
              action={{ label: 'Try again', onClick: () => tasksQuery.refetch() }}
            />
          ) : groups.length ? (
            groups.map((group) => (
              <div key={group.key} className="pf-group" data-group={group.key}>
                <h4 className="pf-group-head">
                  {group.label}
                  <b>{group.items.length}</b>
                </h4>
                <ul className="pf-rows">
                  {group.items.map((item) => {
                    const due = dueLineOf(item, now);
                    const isUpdating = Boolean(item.taskId && updatingIds.includes(item.taskId));
                    const sub = [item.detail, item.note].filter(Boolean).join(' · ');
                    return (
                      <li
                        key={item.id}
                        className={`pf-list-row cb-row${item.isDone ? ' is-done' : ''}`}
                        data-bucket={item.bucket}
                      >
                        <button
                          type="button"
                          className={`cb-check${item.isDone ? ' is-checked' : ''}`}
                          aria-pressed={item.isDone}
                          aria-label={
                            item.isDone
                              ? `Reopen the callback for ${item.title}`
                              : `Mark the callback for ${item.title} as done`
                          }
                          data-tip={isSample ? 'Sample' : item.isDone ? 'Reopen' : 'Mark as done'}
                          // Not `disabled`: the app's base styles paint every disabled
                          // button grey with a visible glyph, which read as a tick.
                          aria-disabled={isSample || !item.taskId || isUpdating}
                          onClick={() => toggleDone(item)}
                        >
                          <Check aria-hidden="true" />
                        </button>
                        <div className="cb-who">
                          <b title={item.title}>{item.title}</b>
                          {sub ? (
                            <small title={sub}>{sub}</small>
                          ) : (
                            !item.phone && <small>No phone number</small>
                          )}
                        </div>
                        <span className="cb-source">{item.source}</span>
                        <div className="cb-due">
                          <b>{due.when}</b>
                          {due.hint && (
                            <small className={due.tone ? `is-${due.tone}` : undefined}>{due.hint}</small>
                          )}
                        </div>
                        <div className="cb-owner">
                          {item.owners.length ? (
                            <>
                              <span className="cb-avatar" aria-hidden="true">
                                {getInitials(item.owners[0])}
                              </span>
                              <span className="cb-owner-name" title={item.owners.join(', ')}>
                                {item.owners[0]}
                                {item.owners.length > 1 && <em> +{item.owners.length - 1}</em>}
                              </span>
                            </>
                          ) : (
                            <span className="cb-muted">Unassigned</span>
                          )}
                        </div>
                        <div className="cb-act">
                          {item.phone && !item.isDone && (
                            <button
                              type="button"
                              className="cb-call"
                              disabled={isSample || isOnCall}
                              title={
                                isSample
                                  ? 'Sample callback'
                                  : isOnCall
                                    ? 'You’re already on a call'
                                    : `Call ${item.title}`
                              }
                              aria-label={`Call ${item.title}`}
                              onClick={() => callBack(item)}
                            >
                              <Phone aria-hidden="true" />
                              <span className="cb-call-label">Call</span>
                            </button>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))
          ) : (
            callbackEmpty()
          )}
          {!isSample && tasksTotal > tasksLoaded && (
            <footer className="pf-list-foot">
              <span>
                Showing the latest {tasksLoaded} of {tasksTotal} tasks.
              </span>
              <button type="button" className="pf-text-btn" onClick={() => navigate('/calendar?view=task-list')}>
                See every task in Calendar
              </button>
            </footer>
          )}
        </section>
      ) : (
        <section className="pf-list" aria-label="Voicemail">
          <div className="pf-list-cols cb-cols" aria-hidden="true">
            <span />
            <span>Caller</span>
            <span>Line</span>
            <span>Left</span>
            <span>Length</span>
            <span />
          </div>
          {isVoicemailPending ? (
            <LoadingRows />
          ) : voicemailQuery.isError ? (
            <Empty
              title="Voicemail couldn’t be loaded"
              copy="The voicemail list didn’t come back. It will try again on its own, or you can try now."
              action={{ label: 'Try again', onClick: () => voicemailQuery.refetch() }}
            />
          ) : visibleVoicemails.length ? (
            <ul className="pf-rows">
              {visibleVoicemails.map((item) => {
                const canListen =
                  Boolean(callLogAccess?.call_recording_listen) && canPlayRecording(item.raw).allowed;
                const sub = [item.callerDetail, item.target ? `For ${item.target}` : '']
                  .filter(Boolean)
                  .join(' · ');
                return (
                  <li key={item.id} className="pf-list-row cb-row">
                    {canListen ? (
                      <button
                        type="button"
                        className="cb-play"
                        disabled={!item.recordingUrl}
                        aria-label={
                          item.recordingUrl
                            ? `Play the voicemail from ${item.caller}`
                            : 'No recording for this voicemail'
                        }
                        data-tip={item.recordingUrl ? 'Play' : 'No recording'}
                        onClick={() => playVoicemail(item)}
                      >
                        <Play aria-hidden="true" />
                      </button>
                    ) : (
                      <span className="cb-play is-static" aria-hidden="true">
                        <Voicemail />
                      </span>
                    )}
                    <div className="cb-who">
                      <b title={item.caller}>{item.caller}</b>
                      {sub && <small title={sub}>{sub}</small>}
                    </div>
                    <span className="cb-source">{item.line ? prettyNumber(item.line) : '—'}</span>
                    <div className="cb-due">
                      <b>{item.left ? `${dayLabel(item.left, now)}, ${item.left.format('h:mm A')}` : '—'}</b>
                      {item.left && <small>{`${capitalise(spanOf(now.diff(item.left)))} ago`}</small>}
                    </div>
                    <span className="cb-length">{item.seconds ? formatSecsToClock(item.seconds) : '—'}</span>
                    <div className="cb-act">
                      {callLogAccess?.sms && item.number && (
                        <button
                          type="button"
                          className="cb-icon"
                          aria-label={`Send ${item.caller} an SMS`}
                          data-tip="SMS"
                          onClick={() =>
                            navigate(`/inbox?formState=contact&number=${encodeURIComponent(item.number)}`)
                          }
                        >
                          <MessageSquare aria-hidden="true" />
                        </button>
                      )}
                      {callLogAccess?.call && item.number && (
                        <button
                          type="button"
                          className="cb-call"
                          disabled={isOnCall}
                          title={isOnCall ? 'You’re already on a call' : `Call ${item.caller} back`}
                          aria-label={`Call ${item.caller} back`}
                          onClick={() => returnVoicemail(item)}
                        >
                          <Phone aria-hidden="true" />
                          <span className="cb-call-label">Call back</span>
                        </button>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : needle ? (
            <Empty
              title="No voicemail matches"
              copy={`Nothing left ${rangePhrase} matches “${query.trim()}”.`}
              action={{ label: 'Clear search', onClick: clearSearch }}
            />
          ) : (
            <Empty
              title={`No voicemail ${rangePhrase}`}
              copy="Messages left on queues, extensions and voicemail boxes show up here. Pick a longer range at the top to see older ones."
            />
          )}
          {!isVoicemailPending && !voicemailQuery.isError && (
            <footer className="pf-list-foot">
              <span>
                {voicemailTotal > voicemailLoaded
                  ? `Showing the latest ${voicemailLoaded} of ${voicemailTotal}.`
                  : `Voicemail left ${rangePhrase}.`}
              </span>
              <button type="button" className="pf-text-btn" onClick={() => navigate('/reports/voicemail')}>
                Open the voicemail report
              </button>
            </footer>
          )}
        </section>
      )}

      <AudioModal
        modalState={isAudioOpen}
        setModalState={setIsAudioOpen}
        srcUrl={recordingUrl}
        serRecordingUrl={setRecordingUrl}
      />
    </div>
  );
};

export default CallbacksTab;
