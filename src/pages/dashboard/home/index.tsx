import { useMemo, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import moment from 'moment';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  LineElement,
  PointElement,
  LinearScale,
  CategoryScale,
  Filler,
  Tooltip as ChartTooltip,
} from 'chart.js';
import {
  Phone,
  MessageSquare,
  Video,
  Sparkles,
  ArrowUpRight,
  ArrowRight,
  MoreVertical,
  PhoneIncoming,
  PhoneOutgoing,
  PhoneMissed,
  Hash,
  Megaphone,
  CalendarClock,
  Bot,
  Globe2,
  ChevronDown,
  CheckCircle2,
  Info,
  Zap,
  Lightbulb,
  Layers,
  BarChart3,
  Users,
  Activity,
  ShieldCheck,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import CustomTooltip from '@/components/custom/custom-tooltip';
import Sparkline from '@/pages/performance/sparkline';
import GlobalPresenceMap, { PRESENCE_REGIONS } from './global-presence-map';
import { useUser } from '@/hooks/use-user';
import { fetchPhone, videoDashboardStats, getNumbersCount } from '@/services/api';
import '@/components/mcm/mcm-page.css';

/** Placeholder week-shaped series/totals. `messages`/`ai` back Total
    Messages and AI Agent Interactions, which have no backend source at all
    (see the file header) — swap those two for a real query + `select` once
    those endpoints exist. `calls`/`meetings` are a same-shaped fallback
    for when the real call-log / video-stats queries come back empty (no
    activity yet, or — same symptom — unreachable, as this sandbox's
    `api2.acepeak.com` proxy currently is), used only when the real value is
    falsy so genuine data always wins. */
const DUMMY_SERIES = {
  calls: [142, 168, 155, 190, 176, 205, 188],
  messages: [186, 224, 201, 268, 252, 311, 289],
  meetings: [8, 11, 9, 14, 12, 16, 13],
  ai: [34, 41, 38, 52, 57, 63, 71],
};
const dummyTotal = (series: number[]) => series.reduce((sum, n) => sum + n, 0);

/** No "most-called contacts" endpoint exists — a real version of this would
    read from the same call-log data as Recent Calls, ranked by frequency.
    Each row still does something real: it opens the Phone console, where
    that extension can actually be dialled. */
const DUMMY_QUICK_DIAL = [
  { name: 'Alex Turner', extension: '101', online: true },
  { name: 'Priya Nair', extension: '104', online: true },
  { name: 'Marcus Webb', extension: '108', online: false },
  { name: 'Chen Wei', extension: '112', online: true },
];

/** Global Presence placeholders — Countries and Uptime have no backend
    source at all (see `NeedsBackendFlag` next to each). Active Numbers
    falls back to this only when `getNumbersCount` hasn't returned yet. */
const DUMMY_GLOBAL_PRESENCE = {
  countries: 18,
  activeNumbers: 42,
  uptime: '99.9%',
};

/** The small stat line on each Quick Actions tile — no backend source for
    any of these (campaign/agent/meeting counts each live on their own
    pages, not as a single cross-feature summary), so all placeholder. */
const DUMMY_QUICK_ACTION_STATS = {
  numbers: 24,
  numberCountries: 8,
  campaigns: 3,
  smsSent: 1250,
  meetings: 12,
  agents: 4,
  activeAgents: 2,
};

/** Per-region connection quality — no backend source. `pct` lives directly
    on `PRESENCE_REGIONS` (global-presence-map.tsx) so the map's pins and
    this list always read the exact same numbers. */
const DUMMY_REGION_STATUS = PRESENCE_REGIONS;

/**
 * Home / Dashboard.
 *
 * Rebuilt to match the new mockup: a greeting hero, four quick actions, a
 * KPI strip, a communication-trend chart, a live-activity + quick-links
 * rail, a recent-calls table, and a global-presence / AI-promo footer.
 *
 * Real data sources (verified against existing call-sites elsewhere in the
 * app before wiring, not guessed):
 *  - Calls (stat + chart + recent-calls table): `fetchPhone`, the same call
 *    log endpoint the Phone console and the previous Home page both use.
 *  - Meetings Hosted (stat + chart): `videoDashboardStats`, already used
 *    as-is (no params) by the Video dashboard's own bar chart.
 *  - Active Numbers (Global Presence): `getNumbersCount`.
 *
 * Flagged placeholders — no backend aggregate exists for these anywhere in
 * the app today, confirmed by searching every service function before
 * giving up rather than inventing a number:
 *  - Total Messages (no SMS/chat count or analytics endpoint exists yet)
 *  - AI Agent Interactions (the AI analytics endpoints return raw per-agent
 *    rows the existing analytics page reduces with a fragile multi-key
 *    guess; there is no single reliable "total interactions" field to
 *    reuse safely here)
 *  - System status pill, and Countries / Uptime on Global Presence (no
 *    health/monitoring or tenant-geography endpoint exists at all)
 * Each is marked with the amber "Needs backend" flag chip in the UI below
 * rather than shown as if it were real.
 */

ChartJS.register(LineElement, PointElement, LinearScale, CategoryScale, Filler, ChartTooltip);

const greeting = () => {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
};

const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || '')
    .join('') || '—';

type CallKind = 'in' | 'out' | 'miss';

const mapCallRow = (row: any) => {
  const direction = String(row?.direction || '').toLowerCase();
  const billsec = Number(row?.billsec ?? row?.duration ?? 0);
  const isMissed = row?.hangup_cause === 'NO_ANSWER' || (direction === 'inbound' && billsec === 0);
  const kind: CallKind = isMissed ? 'miss' : direction === 'inbound' ? 'in' : 'out';
  const name =
    row?.caller_id_name ||
    row?.contact_name ||
    row?.destination_number ||
    row?.caller_id_number ||
    'Unknown';
  const number =
    direction === 'inbound'
      ? row?.caller_id_number
      : row?.destination_number || row?.caller_id_number;
  return {
    id: row?.uuid || `${row?.start_stamp}-${number}-${Math.random()}`,
    name,
    number: number || '—',
    kind,
    duration: billsec,
    time: row?.start_stamp,
  };
};

type CallRow = ReturnType<typeof mapCallRow>;

/** Same fallback pattern as `DUMMY_SERIES` — backs both Recent Calls and
    Live Activity (they share `recentCalls`) only when the real call-log
    query comes back empty, real data always wins. Timestamps are relative
    to page load so "time ago"/"today" formatting still reads sensibly. */
const buildDummyRecentCalls = (): CallRow[] => [
  { id: 'dummy-1', name: 'Sarah Johnson', number: '+1 555-123-4567', kind: 'in', duration: 272, time: moment().subtract(12, 'minutes').toISOString() },
  { id: 'dummy-2', name: 'Michael Brown', number: '+44 20 7123 4567', kind: 'out', duration: 138, time: moment().subtract(45, 'minutes').toISOString() },
  { id: 'dummy-3', name: 'Emma Wilson', number: '+91 98765 43210', kind: 'miss', duration: 0, time: moment().subtract(1, 'hours').toISOString() },
  { id: 'dummy-4', name: 'James Miller', number: '+1 555-765-4321', kind: 'out', duration: 326, time: moment().subtract(3, 'hours').toISOString() },
  { id: 'dummy-5', name: 'Olivia Davis', number: '+61 2 9876 5432', kind: 'in', duration: 192, time: moment().subtract(1, 'days').toISOString() },
  { id: 'dummy-6', name: 'David Lee', number: '+1 555-234-5678', kind: 'in', duration: 105, time: moment().subtract(1, 'days').subtract(2, 'hours').toISOString() },
];

const formatDuration = (secs: number) => {
  if (!secs) return '—';
  const m = Math.floor(secs / 60);
  const s = Math.round(secs % 60);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
};

/** No call-quality/MOS-score endpoint exists — this is a heuristic read off
    duration, not a real telemetry value (flagged next to the column
    header). Kept deterministic (not random) so the same call always shows
    the same quality rather than flickering on every re-render. */
const getCallQuality = (call: CallRow): { label: string; tone: string } => {
  if (call.kind === 'miss') return { label: 'No Answer', tone: '#dc2626' };
  if (call.duration >= 240) return { label: 'Excellent', tone: '#16a34a' };
  if (call.duration >= 90) return { label: 'Good', tone: '#16a34a' };
  return { label: 'Fair', tone: '#d97706' };
};

const CALL_FILTERS = [
  { key: 'all', label: 'All Calls' },
  { key: 'in', label: 'Incoming' },
  { key: 'out', label: 'Outgoing' },
  { key: 'miss', label: 'Missed' },
] as const;

/** No "calls/messages/meetings/agents happening right now" endpoint exists
    — these are placeholder counts. Each still links to the real page for
    that feature. */
const DUMMY_LIVE_METRICS = [
  { key: 'calls', label: 'Active Calls', value: 3, tone: '#dc2626', bg: '#fee2e2', to: '/phone' },
  { key: 'messages', label: 'Messages', value: 12, tone: '#0e7490', bg: '#cffafe', to: '/inbox' },
  { key: 'meetings', label: 'Meetings', value: 1, tone: '#7c3aed', bg: '#ede4ff', to: '/video' },
  {
    key: 'ai',
    label: 'AI Agents',
    value: 4,
    tone: '#c2670a',
    bg: '#fdf0dc',
    to: '/admin-settings/knowledge/ai-agent',
  },
];

type ActivityKind = CallKind | 'sms' | 'meeting' | 'ai';

interface ActivityItem {
  id: string;
  time: string;
  kind: ActivityKind;
  title: string;
  subtitle: string;
  status: string;
  statusTone: string;
}

/** SMS/meeting/AI events with no live feed behind them yet (see
    `NeedsBackendFlag` on Live Activity) — merged with the real (or
    dummy-fallback) call rows below into one time-ordered feed, the way the
    reference design shows every channel in a single timeline. */
const buildDummyExtraActivity = (): ActivityItem[] => [
  {
    id: 'extra-sms',
    time: moment().subtract(28, 'minutes').toISOString(),
    kind: 'sms',
    title: 'SMS sent',
    subtitle: 'Campaign: September Offers',
    status: 'Delivered',
    statusTone: '#0e7490',
  },
  {
    id: 'extra-meeting',
    time: moment().subtract(50, 'minutes').toISOString(),
    kind: 'meeting',
    title: 'Meeting started',
    subtitle: 'Product Team Sync',
    status: 'In Progress',
    statusTone: '#c2670a',
  },
  {
    id: 'extra-ai',
    time: moment().subtract(1, 'hours').subtract(15, 'minutes').toISOString(),
    kind: 'ai',
    title: 'AI Agent resolved query',
    subtitle: 'Customer: David Lee',
    status: 'Completed',
    statusTone: '#7c3aed',
  },
];

const CALL_STATUS_META: Record<CallKind, { label: string; tone: string }> = {
  in: { label: 'Connected', tone: '#16a34a' },
  out: { label: 'Completed', tone: '#0e7490' },
  miss: { label: 'No Answer', tone: '#dc2626' },
};

const buildActivityFeed = (calls: CallRow[], extra: ActivityItem[]): ActivityItem[] =>
  [
    ...calls.map((call) => ({
      id: call.id,
      time: call.time,
      kind: call.kind,
      title:
        call.kind === 'miss' ? 'Missed call' : call.kind === 'in' ? 'Incoming call' : 'Outgoing call',
      subtitle: `${call.name} ${call.number}`,
      status: call.kind === 'miss' ? CALL_STATUS_META.miss.label : formatDuration(call.duration),
      statusTone: CALL_STATUS_META[call.kind].tone,
    })),
    ...extra,
  ]
    .sort((a, b) => moment(b.time).valueOf() - moment(a.time).valueOf())
    .slice(0, 7);

const ACTIVITY_KIND_META: Record<ActivityKind, { icon: ReactNode; bg: string; tone: string }> = {
  in: { icon: <PhoneIncoming className="h-3.5 w-3.5" />, bg: '#dcf5f1', tone: '#0d9488' },
  out: { icon: <PhoneOutgoing className="h-3.5 w-3.5" />, bg: '#f2ecff', tone: '#7c3aed' },
  miss: { icon: <PhoneMissed className="h-3.5 w-3.5" />, bg: '#fde9e9', tone: '#d32f2f' },
  sms: { icon: <MessageSquare className="h-3.5 w-3.5" />, bg: '#cffafe', tone: '#0e7490' },
  meeting: { icon: <Video className="h-3.5 w-3.5" />, bg: '#fdf0dc', tone: '#c2670a' },
  ai: { icon: <Sparkles className="h-3.5 w-3.5" />, bg: '#f2ecff', tone: '#7c3aed' },
};

const CALL_KIND_META: Record<CallKind, { label: string; pill: string }> = {
  in: { label: 'Incoming', pill: 'dash-home__pill--in' },
  out: { label: 'Outgoing', pill: 'dash-home__pill--out' },
  miss: { label: 'Missed', pill: 'dash-home__pill--miss' },
};

/** Small info marker on a value that has no real backend source yet — see
    the file header for the full list and why each one is flagged. Icon-only
    so it sits inline with a label without crowding it; the tooltip carries
    the actual explanation. */
const NeedsBackendFlag = ({ note }: { note: string }) => (
  <CustomTooltip text={`Needs backend: ${note}`} side="top">
    <span className="dash-home__flag" aria-label="Needs backend">
      <Info className="h-3 w-3" />
    </span>
  </CustomTooltip>
);

interface QuickAction {
  key: string;
  title: string;
  subtitle: string;
  icon: ReactNode;
  to: string;
}

interface StatDef {
  key: string;
  label: string;
  icon: ReactNode;
  value: number | null;
  changePct: number | null;
  isLoading: boolean;
  flagNote?: string;
  /** Oldest-first, for the chart in the card's empty right side. */
  series: number[];
  /** True when `series`/`value` are `DUMMY_*` placeholders, not real data. */
  isDummy?: boolean;
  /** The console's own semantic colour for this kind of data — not a
      one-off pick. See :root in index.css (--mcm-accent / --mcm-live /
      --mcm-ai). */
  tone: string;
}

const Home = () => {
  const navigate = useNavigate();
  const { user }: any = useUser();
  const firstName = user?.user_info?.first_name || '';
  const fullName = `${firstName} ${user?.user_info?.last_name || ''}`.trim() || 'there';

  const [chartTab, setChartTab] = useState<'calls' | 'meetings'>('calls');

  const rangeEnd = useMemo(() => moment(), []);
  const rangeStart = useMemo(() => moment().subtract(6, 'days').startOf('day'), []);
  const prevRangeEnd = useMemo(() => moment().subtract(7, 'days').endOf('day'), []);
  const prevRangeStart = useMemo(() => moment().subtract(13, 'days').startOf('day'), []);

  /* ── calls: this week + last week, for the KPI tile, the chart and the
     recent-calls table ─────────────────────────────────────────────── */
  const { data: callsThisWeek, isLoading: isCallsLoading } = useQuery({
    queryKey: ['dashHomeCalls', rangeStart.format('YYYY-MM-DD')],
    queryFn: () =>
      fetchPhone({
        page: 1,
        limit: 500,
        filter: [],
        filter_date: { from: rangeStart.format('YYYY-MM-DD'), to: rangeEnd.format('YYYY-MM-DD') },
        sort: { key: 'start_stamp', desc: true },
      }),
    select: (res: any) => ({
      rows: res?.data?.data?.result?.rows || [],
      total: Number(res?.data?.data?.result?.totalRecords) || 0,
    }),
    refetchInterval: 60_000,
  });

  const { data: callsLastWeekTotal } = useQuery({
    queryKey: ['dashHomeCallsPrevWeek', prevRangeStart.format('YYYY-MM-DD')],
    queryFn: () =>
      fetchPhone({
        page: 1,
        limit: 1,
        filter: [],
        filter_date: {
          from: prevRangeStart.format('YYYY-MM-DD'),
          to: prevRangeEnd.format('YYYY-MM-DD'),
        },
        sort: { key: 'start_stamp', desc: true },
      }),
    select: (res: any) => Number(res?.data?.data?.result?.totalRecords) || 0,
  });

  const callRows = callsThisWeek?.rows || [];
  const realRecentCalls: CallRow[] = useMemo(
    () => callRows.slice(0, 6).map(mapCallRow),
    [callRows],
  );
  // Hooks can't be called conditionally, so this is always computed — it's
  // cheap (six static objects) and only ever read when realRecentCalls is
  // empty.
  const dummyRecentCalls: CallRow[] = useMemo(() => buildDummyRecentCalls(), []);
  const recentCallsAreDummy = !isCallsLoading && realRecentCalls.length === 0;
  const recentCalls: CallRow[] = recentCallsAreDummy ? dummyRecentCalls : realRecentCalls;

  const [callFilter, setCallFilter] = useState<(typeof CALL_FILTERS)[number]['key']>('all');
  const callFilterCounts = useMemo(
    () => ({
      all: recentCalls.length,
      in: recentCalls.filter((c) => c.kind === 'in').length,
      out: recentCalls.filter((c) => c.kind === 'out').length,
      miss: recentCalls.filter((c) => c.kind === 'miss').length,
    }),
    [recentCalls],
  );
  const filteredCalls =
    callFilter === 'all' ? recentCalls : recentCalls.filter((c) => c.kind === callFilter);

  const dummyExtraActivity = useMemo(() => buildDummyExtraActivity(), []);
  const activityFeed = useMemo(
    () => buildActivityFeed(recentCalls, dummyExtraActivity),
    [recentCalls, dummyExtraActivity],
  );

  const callsSeries = useMemo(() => {
    const days = Array.from({ length: 7 }).map((_, i) => moment().subtract(6 - i, 'days'));
    const counts = days.map(
      (day) => callRows.filter((row: any) => moment(row?.start_stamp).isSame(day, 'day')).length,
    );
    return { labels: days.map((d) => d.format('MMM D')), data: counts };
  }, [callRows]);

  const pctChange = (current: number, previous: number): number | null => {
    if (!previous) return current > 0 ? 100 : null;
    return Math.round(((current - previous) / previous) * 100);
  };

  /* ── meetings: `videoDashboardStats` takes no params — the Video
     dashboard's own chart calls it the exact same way, so its trailing
     window is whatever the backend already defaults it to. ───────────── */
  const { data: videoStats, isLoading: isVideoLoading } = useQuery({
    queryKey: ['dashHomeVideoStats'],
    queryFn: videoDashboardStats,
    select: (res: any) => res?.data?.data?.result?.data,
  });

  const meetingsSeries = useMemo(() => {
    const graph = videoStats?.graph_data;
    const hasLabels = graph?.labels?.some((l: string) => String(l || '').trim().length > 0);
    if (!hasLabels) return null;
    const pastDataset = graph.datasets?.find((d: any) =>
      String(d?.label || '')
        .toLowerCase()
        .includes('past'),
    );
    if (!pastDataset) return null;
    return { labels: graph.labels, data: (pastDataset.data || []).map((n: any) => Number(n) || 0) };
  }, [videoStats]);

  const meetingsTotal = useMemo(
    () => (meetingsSeries?.data || []).reduce((sum: number, n: number) => sum + n, 0),
    [meetingsSeries],
  );

  /* ── active numbers, for Global Presence ─────────────────────────────── */
  const { data: numbersCount } = useQuery({
    queryKey: ['dashHomeNumbersCount'],
    queryFn: () => getNumbersCount(),
    select: (res: any) => res?.data?.data?.result?.counts || null,
  });

  const activeNumbersTotal = useMemo(() => {
    if (!numbersCount) return null;
    if (typeof numbersCount.total === 'number') return numbersCount.total;
    const values = Object.values(numbersCount).filter((v) => typeof v === 'number') as number[];
    return values.length ? values.reduce((a, b) => a + b, 0) : null;
  }, [numbersCount]);

  const quickActions: QuickAction[] = [
    {
      key: 'call',
      title: 'Make a Call',
      subtitle: 'Start a new call',
      icon: <Phone className="h-4.5 w-4.5" />,
      to: '/phone',
    },
    {
      key: 'sms',
      title: 'Send SMS',
      subtitle: 'Send a message',
      icon: <MessageSquare className="h-4.5 w-4.5" />,
      to: '/inbox',
    },
    {
      key: 'meeting',
      title: 'Start Meeting',
      subtitle: 'Host a video meeting',
      icon: <Video className="h-4.5 w-4.5" />,
      to: '/video',
    },
    {
      key: 'ai',
      title: 'AI Agent',
      subtitle: 'Create / Manage agent',
      icon: <Sparkles className="h-4.5 w-4.5" />,
      to: '/admin-settings/knowledge/ai-agent',
    },
  ];

  const hasRealCalls = Boolean(callsThisWeek?.total);
  const hasRealMeetings = Boolean(meetingsTotal);

  const stats: StatDef[] = [
    {
      key: 'calls',
      label: 'Total Calls',
      icon: <Phone className="h-4.5 w-4.5" />,
      value: hasRealCalls ? callsThisWeek!.total : dummyTotal(DUMMY_SERIES.calls),
      changePct:
        hasRealCalls && callsThisWeek?.total != null && callsLastWeekTotal != null
          ? pctChange(callsThisWeek.total, callsLastWeekTotal)
          : null,
      isLoading: isCallsLoading,
      series: hasRealCalls ? callsSeries.data : DUMMY_SERIES.calls,
      isDummy: !isCallsLoading && !hasRealCalls,
      tone: '#dc2626',
      flagNote:
        !isCallsLoading && !hasRealCalls
          ? 'No calls in the last 7 days (or the call-log API is unreachable) — showing sample data.'
          : undefined,
    },
    {
      key: 'messages',
      label: 'Total Messages',
      icon: <MessageSquare className="h-4.5 w-4.5" />,
      value: dummyTotal(DUMMY_SERIES.messages),
      changePct: null,
      isLoading: false,
      flagNote: 'No SMS/chat count endpoint exists yet — this value and chart are placeholder data.',
      series: DUMMY_SERIES.messages,
      isDummy: true,
      tone: '#dc2626',
    },
    {
      key: 'meetings',
      label: 'Meetings Hosted',
      icon: <Video className="h-4.5 w-4.5" />,
      value: hasRealMeetings ? meetingsTotal : dummyTotal(DUMMY_SERIES.meetings),
      changePct: null,
      isLoading: isVideoLoading,
      series: hasRealMeetings ? meetingsSeries!.data : DUMMY_SERIES.meetings,
      isDummy: !isVideoLoading && !hasRealMeetings,
      tone: '#0d9488',
      flagNote:
        !isVideoLoading && !hasRealMeetings
          ? 'No meetings hosted yet (or the video-stats API is unreachable) — showing sample data.'
          : undefined,
    },
    {
      key: 'ai',
      label: 'AI Agent Interactions',
      icon: <Sparkles className="h-4.5 w-4.5" />,
      value: dummyTotal(DUMMY_SERIES.ai),
      changePct: null,
      isLoading: false,
      flagNote:
        'The AI analytics endpoints return raw per-agent rows, not a total — this value and chart are placeholder data.',
      series: DUMMY_SERIES.ai,
      isDummy: true,
      tone: '#7c3aed',
    },
  ];

  const quickLinks = [
    {
      title: 'Manage Phone Numbers',
      subtitle: 'DIDs, toll-free, international',
      icon: <Hash className="h-5 w-5" />,
      to: '/admin-settings/numbers/all',
      theme: 'red',
      statIcon: <Layers className="h-3.5 w-3.5" />,
      stats: `${DUMMY_QUICK_ACTION_STATS.numbers} Numbers  |  ${DUMMY_QUICK_ACTION_STATS.numberCountries} Countries`,
    },
    {
      title: 'Create SMS Campaign',
      subtitle: 'Send bulk or scheduled messages',
      icon: <Megaphone className="h-5 w-5" />,
      to: '/campaign/all-campaigns',
      theme: 'amber',
      statIcon: <BarChart3 className="h-3.5 w-3.5" />,
      stats: `${DUMMY_QUICK_ACTION_STATS.campaigns} Campaigns  |  ${DUMMY_QUICK_ACTION_STATS.smsSent.toLocaleString()} Sent`,
    },
    {
      title: 'Schedule Meeting',
      subtitle: 'Create virtual meeting room',
      icon: <CalendarClock className="h-5 w-5" />,
      to: '/video',
      theme: 'teal',
      statIcon: <Users className="h-3.5 w-3.5" />,
      stats: `${DUMMY_QUICK_ACTION_STATS.meetings} Meetings  |  This Week`,
    },
    {
      title: 'Configure AI Agent',
      subtitle: 'Set up intelligent voice/chat agents',
      icon: <Bot className="h-5 w-5" />,
      to: '/admin-settings/knowledge/ai-agent',
      theme: 'violet',
      statIcon: <Activity className="h-3.5 w-3.5" />,
      stats: `${DUMMY_QUICK_ACTION_STATS.agents} Agents  |  ${DUMMY_QUICK_ACTION_STATS.activeAgents} Active`,
    },
  ];

  const realChart = chartTab === 'calls' ? callsSeries : meetingsSeries;
  const chartHasRealData = Boolean(realChart?.data?.some((n: number) => n > 0));
  /* Same fallback as the stat cards above, and for the same reason (no
     activity yet, or the call-log/video-stats API being unreachable) —
     real day labels either way, dummy data only when the real series is
     empty, so the chart never sits blank. */
  const activeChart = chartHasRealData
    ? realChart!
    : {
        labels: callsSeries.labels,
        data: chartTab === 'calls' ? DUMMY_SERIES.calls : DUMMY_SERIES.meetings,
      };
  const chartIsDummy = !chartHasRealData;

  return (
    <div className="page w-full flex flex-col gap-4">
      {/* ── hero ─────────────────────────────────────────────────────── */}
      <div className="dash-home__hero flex flex-col gap-5 p-5 lg:flex-row lg:items-center lg:justify-between">
        <div className="relative z-10 min-w-0">
          <div className="mcm-adminhome-titlerow">
            <h1 className="dir-serif-heading flex items-center gap-2">
              {greeting()}, {firstName || fullName}
              <span aria-hidden="true">👋</span>
            </h1>
            <CustomTooltip
              text="Here's what's happening with your UCaaS platform today."
              side="right"
              className="w-max max-w-[260px] border-0 bg-[#fdf7f5] text-black shadow-none [&_svg]:fill-[#fdf7f5]"
            >
              <span className="mcm-adminhome-infobtn" aria-label="About this page">
                <Info className="h-4 w-4" />
              </span>
            </CustomTooltip>
          </div>
          <div className="dash-home__hero-chip">
            <Sparkles className="h-3.5 w-3.5 shrink-0" />
            Your system is running smoothly. Keep building great conversations!
          </div>
        </div>

        <div className="dash-home__hero-decor" aria-hidden="true">
          <span>Connect</span>
          <span>Communicate</span>
          <span>
            Do more
            <i />
          </span>
        </div>

        <div className="dash-home__hero-status-card relative z-10 shrink-0">
          <div className="flex items-center gap-3">
            <span className="dash-home__status-icon">
              <CheckCircle2 className="h-4.5 w-4.5" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-semibold text-[#0d1526]">
                Your system is running smoothly
              </div>
              <div className="text-xs text-[#6b7891]">All services are operational</div>
            </div>
            <span className="dash-home__hero-live-pill shrink-0">
              <span className="dash-home__live-dot" />
              Live
            </span>
          </div>
          <div className="dash-home__hero-divider" />
          <div className="flex items-center gap-5">
            <div>
              <div className="flex items-center gap-1 text-[11px] text-[#93a0b8]">
                Uptime
                <NeedsBackendFlag note="No health/monitoring endpoint exists yet — Uptime, the Live pill and Last checked's status are static/local, not real telemetry." />
              </div>
              <div className="text-sm font-bold text-[#0d1526] font-mono">99.9%</div>
            </div>
            <div>
              <div className="text-[11px] text-[#93a0b8]">Last checked</div>
              <div className="text-sm font-bold text-[#0d1526]">
                Today, {moment().format('h:mm A')}
              </div>
            </div>
            <button
              type="button"
              onClick={() => navigate('/performance')}
              className="ml-auto flex items-center gap-1 text-xs font-semibold text-[#dc2626] cursor-pointer"
            >
              View Details
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* ── quick actions ────────────────────────────────────────────── */}
      <div className="flex flex-wrap gap-3">
        {quickActions.map((action) => (
          <button
            key={action.key}
            type="button"
            onClick={() => navigate(action.to)}
            className="dash-home__quick-card text-left cursor-pointer flex-1 basis-[220px]"
          >
            <span className="dash-home__quick-icon">{action.icon}</span>
            <span className="flex flex-col min-w-0">
              <span className="text-sm font-semibold text-[#0d1526] truncate">{action.title}</span>
              <span className="text-xs text-[#6b7891] truncate">{action.subtitle}</span>
            </span>
          </button>
        ))}
      </div>

      {/* ── stat strip ───────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((stat) => (
          <div key={stat.key} className="dash-home__stat-card flex flex-col gap-3">
            <span
              className="dash-home__stat-icon"
              style={{ backgroundColor: `${stat.tone}1a`, color: stat.tone }}
            >
              {stat.icon}
            </span>
            <div className="flex items-end justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-[#6b7891]">
                  {stat.label}
                  {stat.flagNote ? <NeedsBackendFlag note={stat.flagNote} /> : null}
                </div>
                <div className="mt-1 flex items-baseline gap-2">
                  <span className="text-2xl font-bold text-[#0d1526] font-mono">
                    {stat.isLoading ? '—' : stat.value != null ? stat.value.toLocaleString() : '—'}
                  </span>
                  {stat.changePct != null && (
                    <span
                      className={`dash-home__stat-trend ${stat.changePct >= 0 ? 'dash-home__stat-trend--up' : ''}`}
                    >
                      <ArrowUpRight className="h-3.5 w-3.5" />
                      {stat.changePct}%
                    </span>
                  )}
                </div>
                <div className="mt-0.5 text-[11px] text-[#93a0b8]">vs last 7 days</div>
              </div>
              {stat.series.length >= 2 && (
                <div
                  className={`dash-home__stat-spark-wrap${stat.isDummy ? ' dash-home__stat-spark-wrap--dummy' : ''}`}
                >
                  <Sparkline points={stat.series} tone={stat.tone} />
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* ── communication overview ───────────────────────────────────── */}
      <div className="dash-home__card p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-sm font-semibold text-[#0d1526]">
                <Phone className="h-4 w-4 text-[#dc2626]" />
                Communication Overview
                {chartIsDummy && (
                  <NeedsBackendFlag
                    note={`No ${chartTab === 'calls' ? 'calls' : 'meetings'} in the last 7 days (or that API is unreachable) — showing sample data.`}
                  />
                )}
              </div>
              <div className="flex items-center gap-1 rounded-full border border-[#e5e5e5] px-2 py-1 text-xs text-[#6b7891]">
                Last 7 days
                <ChevronDown className="h-3.5 w-3.5" />
              </div>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={() => setChartTab('calls')}
                className={`dash-home__chart-tab ${chartTab === 'calls' ? 'dash-home__chart-tab--active' : ''}`}
              >
                Calls
              </button>
              <button
                type="button"
                onClick={() => setChartTab('meetings')}
                className={`dash-home__chart-tab ${chartTab === 'meetings' ? 'dash-home__chart-tab--active' : ''}`}
              >
                Meetings
              </button>
              <CustomTooltip text="No message-analytics endpoint exists yet." side="top">
                <span className="dash-home__chart-tab dash-home__chart-tab--disabled">Messages</span>
              </CustomTooltip>
              <CustomTooltip text="No AI-interactions total endpoint exists yet." side="top">
                <span className="dash-home__chart-tab dash-home__chart-tab--disabled">AI Agents</span>
              </CustomTooltip>
            </div>
            <div className="mt-4 h-64">
              <Line
                data={{
                  labels: activeChart.labels,
                  datasets: [
                    {
                      label: chartTab === 'calls' ? 'Calls' : 'Meetings',
                      data: activeChart.data,
                      borderColor: '#dc2626',
                      borderDash: chartIsDummy ? [6, 4] : undefined,
                      pointBackgroundColor: '#dc2626',
                      pointBorderColor: '#ffffff',
                      pointBorderWidth: 1.5,
                      pointRadius: chartIsDummy ? 0 : 3,
                      pointHoverRadius: chartIsDummy ? 3 : 5,
                      tension: 0.35,
                      fill: true,
                      backgroundColor: (context: any) => {
                        const { chart } = context;
                        const { ctx, chartArea } = chart;
                        if (!chartArea) return 'rgba(220, 38, 38, 0.08)';
                        const gradient = ctx.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
                        gradient.addColorStop(0, `rgba(220, 38, 38, ${chartIsDummy ? 0.14 : 0.28})`);
                        gradient.addColorStop(1, 'rgba(220, 38, 38, 0)');
                        return gradient;
                      },
                    },
                  ],
                }}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  interaction: { mode: 'index', intersect: false },
                  plugins: {
                    legend: { display: false },
                    tooltip: {
                      backgroundColor: '#0d1526',
                      padding: 10,
                      cornerRadius: 8,
                      callbacks: {
                        label: (item: any) =>
                          `${item.formattedValue} ${chartTab === 'calls' ? 'calls' : 'meetings'}${chartIsDummy ? ' (sample data)' : ''}`,
                      },
                    },
                  },
                  scales: {
                    x: { grid: { display: false }, ticks: { color: '#93a0b8', font: { size: 11 } } },
                    y: {
                      beginAtZero: true,
                      ticks: { precision: 0, color: '#93a0b8', font: { size: 11 } },
                      grid: { color: '#f0f0f0' },
                    },
                  },
                }}
              />
            </div>
          </div>

      {/* ── recent calls + live activity, side by side ──────────────────── */}
      <div className="grid grid-cols-1 items-start gap-4 sm:grid-cols-2">
        <div className="dash-home__card p-4">
          <div className="dash-home__section-head">
            <div className="flex items-start gap-3">
              <span className="dash-home__section-icon" style={{ background: '#fee2e2', color: '#dc2626' }}>
                <Phone className="h-4.5 w-4.5" />
              </span>
              <div>
                <div className="text-sm font-bold text-[#0d1526]">Recent Calls</div>
                <div className="flex items-center gap-1.5 text-xs text-[#6b7891]">
                  Your latest call activity and interactions
                  {recentCallsAreDummy && (
                    <NeedsBackendFlag note="No calls in the last 7 days (or the call-log API is unreachable) — showing sample data." />
                  )}
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => navigate('/phone')}
              className="dash-home__section-pill-btn shrink-0"
              style={{ background: '#fee2e2', color: '#b91c1c' }}
            >
              View All
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>

          <div className="dash-home__call-filters">
            {CALL_FILTERS.map((f) => (
              <button
                key={f.key}
                type="button"
                onClick={() => setCallFilter(f.key)}
                className={`dash-home__call-filter-tab${callFilter === f.key ? ' dash-home__call-filter-tab--active' : ''}`}
              >
                {f.label}
                <span className="dash-home__call-filter-count">{callFilterCounts[f.key]}</span>
              </button>
            ))}
            <span className="dash-home__call-date">
              <CalendarClock className="h-3.5 w-3.5" />
              Today, {moment().format('MMM D')}
            </span>
          </div>

          <div className="mt-2 overflow-x-auto">
            <table className="w-full border-collapse text-left text-sm">
              <thead>
                <tr className="text-[11px] font-semibold uppercase tracking-wide text-[#93a0b8]">
                  <th className="pb-2 pr-2 font-semibold">Contact</th>
                  <th className="pb-2 pr-2 font-semibold">Type</th>
                  <th className="pb-2 pr-2 font-semibold">Duration</th>
                  <th className="pb-2 pr-2 font-semibold">Time</th>
                  <th className="pb-2 pr-2 font-semibold">
                    <span className="flex items-center gap-1">
                      Quality
                      <NeedsBackendFlag note="No call-quality/MOS-score endpoint exists — this is a rough read off call duration, not real telemetry." />
                    </span>
                  </th>
                  <th className="pb-2 pr-2 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {isCallsLoading ? (
                  <tr>
                    <td colSpan={6} className="py-6 text-center text-sm text-[#93a0b8]">
                      Loading…
                    </td>
                  </tr>
                ) : filteredCalls.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-6 text-center text-sm text-[#93a0b8]">
                      No {callFilter === 'all' ? '' : CALL_FILTERS.find((f) => f.key === callFilter)?.label.toLowerCase()} calls.
                    </td>
                  </tr>
                ) : (
                  filteredCalls.map((call) => {
                    const quality = getCallQuality(call);
                    return (
                      <tr key={call.id} className="dash-home__call-row border-t border-[#f0f0f0]">
                        <td className="py-2 pr-2">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <span className="dash-home__avatar">{initials(call.name)}</span>
                            <span className="flex flex-col min-w-0">
                              <span className="truncate text-sm font-medium text-[#0d1526]">
                                {call.name}
                              </span>
                              <span className="truncate text-xs text-[#93a0b8]">{call.number}</span>
                            </span>
                          </div>
                        </td>
                        <td className="py-2 pr-2">
                          <span className={`dash-home__pill ${CALL_KIND_META[call.kind].pill}`}>
                            {call.kind === 'in' && <PhoneIncoming className="h-3 w-3" />}
                            {call.kind === 'out' && <PhoneOutgoing className="h-3 w-3" />}
                            {call.kind === 'miss' && <PhoneMissed className="h-3 w-3" />}
                            {CALL_KIND_META[call.kind].label}
                          </span>
                        </td>
                        <td className="py-2 pr-2 font-mono text-sm text-[#3d4a63]">
                          {formatDuration(call.duration)}
                        </td>
                        <td className="py-2 pr-2 text-sm text-[#6b7891]">
                          {call.time
                            ? moment(call.time).isSame(moment(), 'day')
                              ? moment(call.time).format('hh:mm A')
                              : moment(call.time).format('MMM D')
                            : '—'}
                        </td>
                        <td className="py-2 pr-2">
                          <span className="flex items-center gap-1.5 text-xs font-medium" style={{ color: quality.tone }}>
                            <span
                              className="dash-home__quality-dot"
                              style={{ backgroundColor: quality.tone }}
                            />
                            {quality.label}
                          </span>
                        </td>
                        <td className="py-2 pr-0">
                          <div className="flex items-center justify-end gap-1">
                            <CustomTooltip text={`Call ${call.name}`} side="top">
                              <button
                                type="button"
                                onClick={() => navigate('/phone')}
                                className="dash-home__row-action-btn"
                              >
                                <Phone className="h-3.5 w-3.5" />
                              </button>
                            </CustomTooltip>
                            <button
                              type="button"
                              onClick={() => navigate('/phone')}
                              className="dash-home__row-action-btn"
                            >
                              <MoreVertical className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="dash-home__card p-4">
          <div className="dash-home__section-head">
            <div className="flex items-start gap-3">
              <span className="dash-home__section-icon" style={{ background: '#fee2e2', color: '#dc2626' }}>
                <Sparkles className="h-4.5 w-4.5" />
              </span>
              <div>
                <div className="text-sm font-bold text-[#0d1526]">Live Activity</div>
                <div className="flex items-center gap-1.5 text-xs text-[#6b7891]">
                  Real-time communication events
                  <NeedsBackendFlag
                    note={
                      recentCallsAreDummy
                        ? 'No calls in the last 7 days (or the call-log API is unreachable) — the call entries here are sample data.'
                        : 'The call entries in this feed are real, polled on an interval — not a real-time socket push. The metrics strip and the SMS/meeting/AI entries have no live feed behind them yet.'
                    }
                  />
                </div>
              </div>
            </div>
            <span className="dash-home__hero-live-pill shrink-0">
              <span className="dash-home__live-dot" />
              Live
            </span>
          </div>

          <div className="dash-home__live-metrics">
            {DUMMY_LIVE_METRICS.map((metric) => (
              <button
                key={metric.key}
                type="button"
                onClick={() => navigate(metric.to)}
                className="dash-home__live-metric"
                style={{ background: metric.bg }}
              >
                <span className="text-lg font-bold font-mono" style={{ color: metric.tone }}>
                  {metric.value}
                </span>
                <span className="text-[10.5px] font-medium text-[#3d4a63]">{metric.label}</span>
                <ArrowRight className="dash-home__live-metric-arrow h-3 w-3" style={{ color: metric.tone }} />
              </button>
            ))}
          </div>

          <div className="dash-home__timeline">
            {isCallsLoading ? (
              <div className="py-6 text-center text-sm text-[#93a0b8]">Loading…</div>
            ) : (
              activityFeed.map((item) => (
                <div key={item.id} className="dash-home__timeline-row">
                  <div className="dash-home__timeline-rail">
                    <span
                      className="dash-home__timeline-dot"
                      style={{ backgroundColor: ACTIVITY_KIND_META[item.kind].tone }}
                    />
                  </div>
                  <span className="dash-home__timeline-time">
                    {item.time ? moment(item.time).format('hh:mm A') : ''}
                  </span>
                  <span
                    className="dash-home__timeline-icon"
                    style={{
                      background: ACTIVITY_KIND_META[item.kind].bg,
                      color: ACTIVITY_KIND_META[item.kind].tone,
                    }}
                  >
                    {ACTIVITY_KIND_META[item.kind].icon}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium text-[#0d1526]">{item.title}</div>
                    <div className="truncate text-xs text-[#93a0b8]">{item.subtitle}</div>
                  </div>
                  <span
                    className="dash-home__timeline-status"
                    style={{ color: item.statusTone, background: `${item.statusTone}1a` }}
                  >
                    {item.status}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
      {/* ── quick actions + global presence, side by side ───────────────── */}
      {/* `items-start` opts both columns out of the grid's default
          align-items: stretch — each one ends exactly where its own
          content ends instead of being forced to match its (often taller,
          e.g. the world map) sibling's height with empty space. */}
      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-2">
        <div className="flex flex-col gap-4">
        <div className="dash-home__card p-4">
          <div className="dash-home__section-head">
            <div className="flex items-start gap-3">
              <span className="dash-home__section-icon" style={{ background: '#fee2e2', color: '#dc2626' }}>
                <Zap className="h-4.5 w-4.5" />
              </span>
              <div>
                <div className="text-sm font-bold text-[#0d1526]">Quick Actions</div>
                <div className="text-xs text-[#6b7891]">Everything you need, right at your fingertips.</div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => navigate('/admin-settings')}
              className="dash-home__section-pill-btn shrink-0"
              style={{ background: '#fee2e2', color: '#b91c1c' }}
            >
              View All
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>

          <div className="dash-home__qa-grid">
            {quickLinks.map((link) => (
              <button
                key={link.title}
                type="button"
                onClick={() => navigate(link.to)}
                className={`dash-home__qa-tile dash-home__qa-tile--${link.theme}`}
              >
                <div className="dash-home__qa-tile-top">
                  <span className="dash-home__qa-tile-icon">{link.icon}</span>
                  <span className="dash-home__qa-tile-arrow">
                    <ArrowRight className="h-3.5 w-3.5" />
                  </span>
                </div>
                <div>
                  <div className="text-sm font-bold text-[#0d1526]">{link.title}</div>
                  <div className="text-xs text-[#6b7891]">{link.subtitle}</div>
                </div>
                <div className="dash-home__qa-tile-stats">
                  {link.statIcon}
                  {link.stats}
                </div>
              </button>
            ))}
          </div>

          <div className="dash-home__tip-banner">
            <span className="dash-home__tip-icon">
              <Lightbulb className="h-4 w-4" />
            </span>
            <span className="min-w-0 flex-1 text-xs text-[#3d4a63]">
              <strong className="font-semibold text-[#0d1526]">Tip:</strong> Set up an AI agent to handle
              repetitive customer queries and save time.
            </span>
            <button
              type="button"
              onClick={() => navigate('/admin-settings/knowledge/ai-agent')}
              className="flex shrink-0 items-center gap-1 text-xs font-semibold text-[#7c3aed] cursor-pointer"
            >
              Learn More
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        <div className="dash-home__card p-4">
          <div className="dash-home__section-head">
            <div className="flex items-start gap-3">
              <span className="dash-home__section-icon" style={{ background: '#fee2e2', color: '#dc2626' }}>
                <Phone className="h-4.5 w-4.5" />
              </span>
              <div>
                <div className="text-sm font-bold text-[#0d1526]">Quick Dial</div>
                <div className="flex items-center gap-1.5 text-xs text-[#6b7891]">
                  Your most-called contacts
                  <NeedsBackendFlag note="No call-frequency endpoint exists yet — this list is placeholder data. Each row still opens the real Phone console." />
                </div>
              </div>
            </div>
          </div>

          <div className="dash-home__quick-dial-grid">
            {DUMMY_QUICK_DIAL.map((contact) => (
              <button
                key={contact.extension}
                type="button"
                onClick={() => navigate('/phone')}
                className="dash-home__quick-dial-tile cursor-pointer"
              >
                <span className="dash-home__quick-dial-avatar-wrap">
                  <span className="dash-home__avatar">{initials(contact.name)}</span>
                  <span
                    className={`dash-home__quick-dial-dot ${contact.online ? 'dash-home__quick-dial-dot--online' : ''}`}
                  />
                </span>
                <span className="truncate text-sm font-medium text-[#0d1526]">{contact.name}</span>
                <span className="text-xs text-[#93a0b8]">Ext. {contact.extension}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="dash-home__promo-card flex w-full flex-col justify-between gap-4 p-4 sm:flex-row sm:items-center">
          <div>
            <span className="dash-home__pill dash-home__pill--out mb-2">
              <Sparkles className="h-3 w-3" />
              Featured
            </span>
            <h3 className="text-lg font-bold text-[#0d1526]">AI-Powered Voice Agents</h3>
            <p className="mt-1 text-sm text-[#6b7891]">
              Automate conversations, qualify leads and boost your productivity.
            </p>
          </div>
          <Button
            type="button"
            variant="primary"
            className="w-fit shrink-0 rounded-full !border-[#262626] !bg-[#262626] !text-[#b2b0b2] hover:!bg-[#262626]/90"
            onClick={() => navigate('/admin-settings/knowledge/ai-receptionist')}
          >
            Get Started
            <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
        </div>

        <div className="dash-home__card relative overflow-hidden p-4">
          <div className="dash-home__section-head">
            <div className="flex items-start gap-3">
              <span className="dash-home__section-icon" style={{ background: '#dcf5f1', color: '#0d9488' }}>
                <Globe2 className="h-4.5 w-4.5" />
              </span>
              <div>
                <div className="text-sm font-bold text-[#0d1526]">Global Presence</div>
                <div className="text-xs text-[#6b7891]">Your communication network around the world.</div>
              </div>
            </div>
            <span className="dash-home__hero-live-pill shrink-0">
              <span className="dash-home__live-dot" />
              Live
            </span>
          </div>

          <div className="dash-home__gp-stats">
            <div className="dash-home__gp-stat" style={{ background: '#fef2f2' }}>
              <div className="dash-home__gp-stat-top">
                <span className="dash-home__gp-stat-icon" style={{ background: '#fee2e2', color: '#dc2626' }}>
                  <Globe2 className="h-3.5 w-3.5" />
                </span>
                Countries
                <NeedsBackendFlag note="No tenant-geography endpoint exists yet — this value is placeholder data." />
              </div>
              <div className="mt-2 flex items-baseline justify-between gap-1">
                <span className="text-xl font-bold text-[#0d1526] font-mono">
                  {DUMMY_GLOBAL_PRESENCE.countries}
                </span>
                <span className="dash-home__gp-trend">
                  <ArrowUpRight className="h-3 w-3" />2
                </span>
              </div>
              <div className="mt-0.5 text-[10.5px] text-[#93a0b8]">vs last month</div>
            </div>

            <div className="dash-home__gp-stat" style={{ background: '#f0faf8' }}>
              <div className="dash-home__gp-stat-top">
                <span className="dash-home__gp-stat-icon" style={{ background: '#ccece6', color: '#0d9488' }}>
                  <Phone className="h-3.5 w-3.5" />
                </span>
                Active Numbers
              </div>
              <div className="mt-2 flex items-baseline justify-between gap-1">
                <span className="text-xl font-bold text-[#0d1526] font-mono">
                  {activeNumbersTotal != null
                    ? activeNumbersTotal.toLocaleString()
                    : DUMMY_GLOBAL_PRESENCE.activeNumbers}
                </span>
                <span className="dash-home__gp-trend">
                  <ArrowUpRight className="h-3 w-3" />1
                </span>
              </div>
              <div className="mt-0.5 text-[10.5px] text-[#93a0b8]">vs last month</div>
            </div>

            <div className="dash-home__gp-stat" style={{ background: '#f0faf8' }}>
              <div className="dash-home__gp-stat-top">
                <span className="dash-home__gp-stat-icon" style={{ background: '#ccece6', color: '#0d9488' }}>
                  <ShieldCheck className="h-3.5 w-3.5" />
                </span>
                Uptime
                <NeedsBackendFlag note="No health/monitoring endpoint exists yet — this would need real SLA telemetry, this value is placeholder data." />
              </div>
              <div className="mt-2 text-xl font-bold text-[#0d1526] font-mono">
                {DUMMY_GLOBAL_PRESENCE.uptime}
              </div>
              <div className="mt-0.5 text-[10.5px] font-semibold text-[#0d9488]">Excellent</div>
            </div>
          </div>

          <div className="relative">
            <GlobalPresenceMap />
            <div className="dash-home__region-panel">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-[#0d1526]">Region Status</span>
                <button
                  type="button"
                  onClick={() => navigate('/performance')}
                  className="flex items-center gap-1 text-xs font-semibold text-[#dc2626] cursor-pointer"
                >
                  View All
                  <ArrowRight className="h-3 w-3" />
                </button>
              </div>
              {DUMMY_REGION_STATUS.map((region) => (
                <div key={region.name} className="dash-home__region-row">
                  <span className="dash-home__region-dot" style={{ background: region.color }} />
                  <span className="dash-home__region-name">{region.name}</span>
                  <span className="dash-home__region-bar-track">
                    <span
                      className="dash-home__region-bar-fill"
                      style={{ width: `${region.pct}%`, background: region.color }}
                    />
                  </span>
                  <span className="dash-home__region-pct">{region.pct}%</span>
                </div>
              ))}
            </div>
          </div>

          <div className="dash-home__gp-banner">
            <span className="dash-home__tip-icon" style={{ background: '#ccece6', color: '#0d9488' }}>
              <BarChart3 className="h-4 w-4" />
            </span>
            <span className="min-w-0 flex-1 text-xs text-[#3d4a63]">
              Strong global connectivity with {DUMMY_GLOBAL_PRESENCE.uptime} uptime this month.
            </span>
            <button
              type="button"
              onClick={() => navigate('/admin-settings/numbers/coverage')}
              className="flex shrink-0 items-center gap-1 text-xs font-semibold text-[#0d9488] cursor-pointer"
            >
              View Network Details
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>

    </div>
  );
};

export default Home;
