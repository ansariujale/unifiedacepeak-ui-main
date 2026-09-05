import { getAIReceptionistList, getChatAgentList, getSessionList } from '@/services/api';
import AiSessionDetailDrawer from '@/pages/admin-settings/knowledge-base/components/ai-session-detail-drawer';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowUpRight,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Circle,
  Download,
  History,
  Loader2,
  MessageSquare,
  Phone,
  PhoneForwarded,
  Search,
  X,
  type LucideIcon,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

type SessionChannel = 'all' | 'call' | 'chat';
type SelectOption = { label: string; value: string };
type SessionIntent = { label: string; summary: string };
type SentimentKey = 'positive' | 'neutral' | 'negative';

const dateRangeOptions: SelectOption[] = [
  { label: 'Today', value: 'today' },
  { label: 'Last 7 days', value: '7' },
  { label: 'Last 30 days', value: '30' },
  { label: 'All time', value: 'all' },
];

const allAgentsOption: SelectOption = { label: 'All agents', value: '' };
const allOutcomesOption: SelectOption = { label: 'All outcomes', value: '' };
const channelOptions: SelectOption[] = [
  { label: 'All channels', value: 'all' },
  { label: 'Voice', value: 'call' },
  { label: 'Chat', value: 'chat' },
];
const sessionPageSize = 10;
const sentimentScoreRows: Array<{
  key: SentimentKey;
  label: string;
  colorClass: string;
}> = [
  { key: 'positive', label: 'Positive', colorClass: 'bg-emerald-500' },
  { key: 'neutral', label: 'Neutral', colorClass: 'bg-amber-400' },
  { key: 'negative', label: 'Negative', colorClass: 'bg-rose-500' },
];

const cx = (...classes: Array<string | false | null | undefined>) =>
  classes.filter(Boolean).join(' ');

const safeNumber = (value: any) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
};

const toDate = (value: any) => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const formatDuration = (durationMs: any) => {
  const totalSeconds = Math.max(0, Math.floor(safeNumber(durationMs) / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  if (minutes >= 60) {
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    return `${hours}:${String(remainingMinutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }

  return `${minutes}:${String(seconds).padStart(2, '0')}`;
};

const formatCost = (value: any) => `$${safeNumber(value).toFixed(2)}`;

const hasSessionCost = (session: any) =>
  session?.totalCostUSD !== null && session?.totalCostUSD !== undefined;

const getCostBasis = (session: any) =>
  String(session?.costBasis || session?.cost?.basis || '').trim();

const formatTime = (value: any) => {
  const date = toDate(value);
  if (!date) return '-';
  return date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  });
};

const formatStarted = (value: any) => {
  const date = toDate(value);
  if (!date) return '-';

  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);

  const sameDate = (left: Date, right: Date) =>
    left.getFullYear() === right.getFullYear() &&
    left.getMonth() === right.getMonth() &&
    left.getDate() === right.getDate();

  if (sameDate(date, today)) return `Today · ${formatTime(date)}`;
  if (sameDate(date, yesterday)) return `Yesterday · ${formatTime(date)}`;

  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
};

const formatFullDateTime = (value: any) => {
  const date = toDate(value);
  if (!date) return '-';
  return date.toLocaleString('en-US', {
    month: '2-digit',
    day: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const getSessionIntents = (data: any): SessionIntent[] => {
  const seen = new Set<string>();
  return (Array.isArray(data?.intents) ? data.intents : [])
    .map((item: any) => ({
      label: String(item?.intent_label || '').trim(),
      summary: String(item?.intent_summary || '').trim(),
    }))
    .filter((item: any) => {
      const normalized = item.label.toLowerCase();
      if (!item.label || normalized === 'other' || seen.has(normalized)) return false;
      seen.add(normalized);
      return true;
    });
};

const getSentimentLabel = (session: any) => {
  const label = String(session?.sentiment || '')
    .trim()
    .toLowerCase();
  if (!label) return 'Not analyzed';
  return label;
};

const getSentimentScore = (session: any) => {
  const scores = session?.sentiment_scores || {};
  const sentiment = getSentimentLabel(session);
  const score = safeNumber(scores?.[sentiment]);
  return score > 0 ? Math.round(score) : 0;
};

const getSentimentScores = (session: any) => {
  const scores = session?.sentiment_scores || {};
  return sentimentScoreRows.map((row) => ({
    ...row,
    score: Math.max(0, Math.min(100, Math.round(safeNumber(scores?.[row.key])))),
  }));
};

const getOutcome = (session: any) => {
  if (session?.status === 'active') return 'Active';
  if (session?.handoff) return 'Handoff';
  if (session?.scheduledCallback) return 'Callback';
  return 'Resolved';
};

const getOutcomeClass = (outcome: string) => {
  if (outcome === 'Resolved') return 'text-emerald-600';
  if (outcome === 'Handoff') return 'text-amber-600';
  if (outcome === 'Callback') return 'text-amber-600';
  if (outcome === 'Active') return 'text-red-600';
  return 'text-red-600';
};

const getOutcomeBorderClass = (outcome: string) => {
  if (outcome === 'Resolved') return 'border-emerald-500';
  if (outcome === 'Handoff') return 'border-amber-500';
  if (outcome === 'Callback') return 'border-amber-500';
  if (outcome === 'Active') return 'border-red-500';
  return 'border-red-500';
};

const getOutcomeIcon = (outcome: string): LucideIcon => {
  if (outcome === 'Resolved') return Check;
  if (outcome === 'Handoff') return PhoneForwarded;
  if (outcome === 'Callback') return ArrowUpRight;
  if (outcome === 'Active') return Circle;
  return X;
};

const getContactTitle = (session: any) => {
  const collectedData = session?.collectedData || {};
  const name = String(
    collectedData?.name?.value ||
      collectedData?.first_name?.value ||
      collectedData?.full_name?.value ||
      '',
  ).trim();

  if (name) return name;
  return session?.channel === 'call' ? 'Inbound caller' : 'visitor · web widget';
};

const getContactSubText = (session: any) => {
  const collectedData = session?.collectedData || {};
  const callerId = String(session?.callerId || session?.caller_id || '').trim();
  const phone = String(
    collectedData?.phone?.value || collectedData?.phone_number?.value || '',
  ).trim();
  const email = String(collectedData?.email?.value || '').trim();

  if (session?.channel === 'call' && callerId) return callerId;
  if (phone && email) return `${phone} · ${email}`;
  if (phone) return phone;
  if (email) return email;
  return session?.sessionId ? `sess_${String(session.sessionId).slice(0, 6)}` : '-';
};

const getAgentName = (session: any, agentById: Map<string, any>) => {
  const agentId = String(session?.agentId || '').trim();
  const agent = agentById.get(agentId);
  return String(
    agent?.agentName || agent?.name || session?.agentName || session?.agent_name || 'Unnamed agent',
  );
};

const isDeletedAgent = (session: any, agentById: Map<string, any>) => {
  const agentId = String(session?.agentId || '').trim();
  if (!agentId) return false;
  return !agentById.has(agentId);
};

const isInDateRange = (session: any, dateRange: string) => {
  if (dateRange === 'all') return true;
  const startedAt = toDate(session?.startedAt || session?.createdAt);
  if (!startedAt) return false;

  const now = new Date();
  if (dateRange === 'today') {
    return (
      startedAt.getFullYear() === now.getFullYear() &&
      startedAt.getMonth() === now.getMonth() &&
      startedAt.getDate() === now.getDate()
    );
  }

  const days = safeNumber(dateRange);
  if (!days) return true;
  const rangeStart = new Date(now);
  rangeStart.setDate(now.getDate() - (days - 1));
  rangeStart.setHours(0, 0, 0, 0);
  return startedAt >= rangeStart;
};

const downloadTextFile = (fileName: string, text: string) => {
  const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
};

const ChannelPill = ({
  channel,
  isSessionLabel = false,
}: {
  channel: string;
  isSessionLabel?: boolean;
}) => {
  const isCall = channel === 'call';
  const Icon = isCall ? Phone : MessageSquare;
  const label = isCall
    ? isSessionLabel
      ? 'Voice call'
      : 'Voice'
    : isSessionLabel
      ? 'Chat session'
      : 'Chat';

  if (isSessionLabel) {
    return (
      <span
        className={`inline-flex w-fit items-center gap-1.5 rounded-full px-[9px] py-1 text-[11.5px] font-bold ${
          isCall ? 'bg-red-50 text-red-600' : 'bg-neutral-100 text-neutral-600'
        }`}
      >
        <Icon className="h-3 w-3" strokeWidth={2.5} />
        {label}
      </span>
    );
  }

  return (
    <span
      title={label}
      className={`inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${
        isCall ? 'bg-red-50 text-red-600' : 'bg-neutral-100 text-neutral-600'
      }`}
    >
      <Icon className="h-3.5 w-3.5" strokeWidth={2.5} />
    </span>
  );
};

const getSentimentPillClass = (session: any) => {
  const sentiment = getSentimentLabel(session);
  if (sentiment === 'positive') return 'bg-green-50! text-green-700!';
  if (sentiment === 'negative') return 'bg-red-50! text-red-600!';
  if (sentiment === 'neutral') return 'bg-amber-50! text-amber-700!';
  return 'bg-gray-100! text-gray-500!';
};

const SentimentGraph = ({ session }: { session: any }) => {
  const score = getSentimentScore(session);
  const label = getSentimentLabel(session) || 'neutral';
  const sentimentScores = getSentimentScores(session);
  const hasScores = sentimentScores.some((item) => item.score > 0);

  return (
    <div className="group relative flex w-fit items-center">
      <span
        className={`inline-flex w-fit items-center justify-center gap-1 whitespace-nowrap rounded-full px-2.5 py-1 text-[12px] font-semibold capitalize ${getSentimentPillClass(session)}`}
      >
        {label} · {Math.round(score)}
      </span>
      <div className="pointer-events-none absolute right-0 top-7 z-30 hidden w-[190px] rounded-2xl border border-neutral-200 bg-white p-3 text-left shadow-[0_8px_24px_rgba(0,0,0,.08)] group-hover:block">
        <div className="mb-2 text-[11px] font-bold uppercase tracking-[0.04em] text-red-600">
          Sentiment scores
        </div>
        {hasScores ? (
          <div className="space-y-2">
            {sentimentScores.map((item) => (
              <div key={item.key}>
                <div className="mb-1 flex items-center justify-between text-[11px] font-semibold text-slate-700">
                  <span>{item.label}</span>
                  <span>{item.score}/100</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                  <div
                    className={`h-full rounded-full ${item.colorClass}`}
                    style={{ width: `${item.score}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-xs font-semibold text-slate-500">Not analyzed</div>
        )}
      </div>
    </div>
  );
};

const StatCard = ({
  title,
  value,
  description,
  isLast = false,
  valueTone = 'default',
}: {
  title: string;
  value: string;
  description?: string;
  isLast?: boolean;
  valueTone?: 'default' | 'warn' | 'critical';
}) => (
  <div className={cx('flex flex-col gap-1.5 p-4', !isLast && 'border-b border-slate-100 sm:border-b-0 sm:border-r')}>
    <span className="text-[11.5px] font-bold uppercase tracking-[0.06em] whitespace-nowrap text-neutral-700">
      {title}
    </span>
    <span
      className={`text-[26px] font-bold leading-tight tracking-tight whitespace-nowrap ${
        valueTone === 'critical'
          ? 'text-red-600'
          : valueTone === 'warn'
            ? 'text-amber-600'
            : 'text-neutral-900'
      }`}
    >
      {value}
    </span>
    <span className="text-xs text-neutral-400 whitespace-nowrap">{description || '\u00a0'}</span>
  </div>
);

const SessionsBreakdownCard = ({
  total,
  voice,
  chat,
  isLast = false,
}: {
  total: number;
  voice: number;
  chat: number;
  isLast?: boolean;
}) => (
  <div className={cx('flex flex-col gap-1.5 p-4', !isLast && 'border-b border-slate-100 sm:border-b-0 sm:border-r')}>
    <span className="text-[11.5px] font-bold uppercase tracking-[0.06em] whitespace-nowrap text-neutral-700">
      Total sessions
    </span>
    <span className="text-[26px] font-bold leading-tight tracking-tight whitespace-nowrap text-neutral-900">
      {total}
    </span>
    <span className="flex items-center gap-1.5">
      <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full bg-indigo-50 px-2 py-0.5 text-[10.5px] font-semibold text-indigo-700">
        <span className="h-1.5 w-1.5 rounded-full bg-indigo-500" />
        {voice} voice
      </span>
      <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full bg-teal-50 px-2 py-0.5 text-[10.5px] font-semibold text-teal-700">
        <span className="h-1.5 w-1.5 rounded-full bg-teal-500" />
        {chat} chat
      </span>
    </span>
  </div>
);

const PillDropdown = ({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: SelectOption[];
  onChange: (option: SelectOption) => void;
}) => (
  <DropdownMenu>
    <DropdownMenuTrigger asChild>
      <button
        type="button"
        className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-full border! border-neutral-200! bg-white! px-4 text-sm font-semibold text-neutral-700! shadow-[0_1px_2px_rgba(0,0,0,.03)] transition-colors hover:border-red-300!"
      >
        {label}
        <ChevronDown className="h-3.5 w-3.5 opacity-60" />
      </button>
    </DropdownMenuTrigger>
    <DropdownMenuContent
      align="start"
      className="w-[200px] max-h-[280px] overflow-y-auto bg-white border border-slate-200 shadow-lg rounded-xl p-1 z-50 animate-none"
    >
      {options.map((option) => {
        const isSelected = value === option.value;
        return (
          <DropdownMenuItem
            key={option.value || `all-${label}`}
            onClick={() => onChange(option)}
            className={`flex items-center justify-between gap-2 px-2 py-1.5 text-xs font-medium cursor-pointer rounded-lg hover:bg-red-50! focus:bg-red-50! ${
              isSelected ? 'bg-red-50! text-red-600! font-semibold' : 'text-slate-900'
            }`}
          >
            <span className="truncate">{option.label}</span>
            {isSelected && <Check className="h-3.5 w-3.5 shrink-0 text-red-600" />}
          </DropdownMenuItem>
        );
      })}
    </DropdownMenuContent>
  </DropdownMenu>
);

const AiBotSession = () => {
  const navigate = useNavigate();
  const [activeChannel, setActiveChannel] = useState<SessionChannel>('all');
  const [selectedAgent, setSelectedAgent] = useState(allAgentsOption);
  const [selectedOutcome, setSelectedOutcome] = useState(allOutcomesOption);
  const [dateRange, setDateRange] = useState('7');
  const [searchText, setSearchText] = useState('');
  const [selectedSession, setSelectedSession] = useState<any>(null);
  const [currentPage, setCurrentPage] = useState(1);

  const { data: receptionistAgentList = [], isLoading: isLoadingReceptionists } = useQuery({
    queryKey: ['getAIReceptionistList', 'sessions-agent-list'],
    queryFn: () => getAIReceptionistList({ page: 1, limit: 1000 }),
    select: (data) => data?.data?.data?.result?.rows || [],
  });

  const { data: chatAgentList = [], isLoading: isLoadingChatAgents } = useQuery({
    queryKey: ['getChatAgentList'],
    queryFn: () => getChatAgentList(),
    select: (data) => data?.data?.data?.result?.rows || [],
  });

  const agentRows = useMemo(() => {
    const chatRows = (chatAgentList || []).map((agent: any) => ({
      ...agent,
      sessionChannel: 'chat',
    }));
    const callRows = (receptionistAgentList || []).map((agent: any) => ({
      ...agent,
      sessionChannel: 'call',
    }));
    return [...chatRows, ...callRows];
  }, [chatAgentList, receptionistAgentList]);

  const agentById = useMemo(() => {
    const map = new Map<string, any>();
    agentRows.forEach((agent: any) => {
      const agentId = String(agent?.agentId || agent?.agent_uuid || '').trim();
      if (agentId) map.set(agentId, agent);
    });
    return map;
  }, [agentRows]);

  const agentOptions = useMemo(() => {
    return [
      allAgentsOption,
      ...agentRows
        .filter((agent: any) => activeChannel === 'all' || agent?.sessionChannel === activeChannel)
        .map((agent: any) => ({
          label: String(agent?.agentName || agent?.name || 'Unnamed agent'),
          value: String(agent?.agentId || agent?.agent_uuid || ''),
        }))
        .filter((agent: any) => agent.value),
    ];
  }, [activeChannel, agentRows]);

  useEffect(() => {
    if (!selectedAgent.value) return;
    const stillVisible = agentOptions.some((option) => option.value === selectedAgent.value);
    if (!stillVisible) setSelectedAgent(allAgentsOption);
  }, [agentOptions, selectedAgent.value]);

  const { data: sessions = [], isLoading: isLoadingSessions } = useQuery({
    queryKey: ['getSessionList', activeChannel, selectedAgent.value],
    queryFn: () =>
      getSessionList({
        agentId: selectedAgent.value || undefined,
        channel: activeChannel === 'all' ? undefined : activeChannel,
        limit: 200,
      }),
    select: (data) => data?.data?.data?.result?.rows || [],
  });

  const rangeSessions = useMemo(
    () => (sessions || []).filter((session: any) => isInDateRange(session, dateRange)),
    [dateRange, sessions],
  );

  const tableRows = useMemo(() => {
    const normalizedSearch = searchText.trim().toLowerCase();
    return rangeSessions.filter((session: any) => {
      const outcome = getOutcome(session);
      if (selectedOutcome.value && outcome !== selectedOutcome.value) return false;

      if (!normalizedSearch) return true;

      const agentName = getAgentName(session, agentById);
      const intents = getSessionIntents(session)
        .map((item) => item.label)
        .join(' ');
      const haystack = [
        agentName,
        getContactTitle(session),
        getContactSubText(session),
        session?.sessionId,
        session?.room,
        session?.summary,
        intents,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      return haystack.includes(normalizedSearch);
    });
  }, [agentById, rangeSessions, searchText, selectedOutcome.value]);

  const totalPages = Math.max(1, Math.ceil(tableRows.length / sessionPageSize));
  const pageStart = tableRows.length ? (currentPage - 1) * sessionPageSize + 1 : 0;
  const pageEnd = Math.min(tableRows.length, currentPage * sessionPageSize);

  const pageWindow = useMemo(() => {
    const windowSize = 5;
    let start = Math.max(1, currentPage - Math.floor(windowSize / 2));
    const end = Math.min(totalPages, start + windowSize - 1);
    start = Math.max(1, end - windowSize + 1);
    return Array.from({ length: end - start + 1 }, (_, i) => start + i);
  }, [currentPage, totalPages]);

  const pagedTableRows = useMemo(() => {
    const start = (currentPage - 1) * sessionPageSize;
    return tableRows.slice(start, start + sessionPageSize);
  }, [currentPage, tableRows]);

  useEffect(() => {
    setCurrentPage(1);
  }, [activeChannel, dateRange, searchText, selectedAgent.value, selectedOutcome.value]);

  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages);
  }, [currentPage, totalPages]);

  const stats = useMemo(() => {
    const totalSessions = rangeSessions.length;
    const voiceCalls = rangeSessions.filter((session: any) => session?.channel === 'call').length;
    const chatSessions = rangeSessions.filter((session: any) => session?.channel === 'chat').length;
    const totalDuration = rangeSessions.reduce(
      (total: number, session: any) => total + safeNumber(session?.durationMs),
      0,
    );
    const resolved = rangeSessions.filter(
      (session: any) => getOutcome(session) === 'Resolved',
    ).length;
    const handoffs = rangeSessions.filter(
      (session: any) => getOutcome(session) === 'Handoff',
    ).length;
    const totalCost = rangeSessions.reduce(
      (total: number, session: any) => total + safeNumber(session?.totalCostUSD),
      0,
    );

    const resolutionRateNumeric = totalSessions ? Math.round((resolved / totalSessions) * 100) : 0;

    return {
      totalSessions,
      voiceCalls,
      chatSessions,
      avgDuration: totalSessions ? formatDuration(totalDuration / totalSessions) : '0:00',
      resolutionRate: totalSessions ? `${resolutionRateNumeric}%` : '0%',
      resolutionRateTone: !totalSessions
        ? 'default'
        : resolutionRateNumeric < 50
          ? 'critical'
          : resolutionRateNumeric < 80
            ? 'warn'
            : 'default',
      handoffs,
      totalCost: formatCost(totalCost),
    };
  }, [rangeSessions]);

  const outcomeOptions = useMemo<SelectOption[]>(() => {
    const options = Array.from(
      new Set<string>(rangeSessions.map((session: any) => getOutcome(session))),
    ).map((outcome) => ({
      label: outcome,
      value: outcome,
    }));
    return [allOutcomesOption, ...options];
  }, [rangeSessions]);

  const exportCsv = () => {
    const header = [
      'Channel',
      'Agent',
      'Contact',
      'Started',
      'Duration',
      'Outcome',
      'Cost',
      'Sentiment',
    ];
    const csvRows = tableRows.map((session: any) =>
      [
        session?.channel === 'call' ? 'Voice' : 'Chat',
        getAgentName(session, agentById),
        `${getContactTitle(session)} ${getContactSubText(session)}`,
        formatFullDateTime(session?.startedAt || session?.createdAt),
        formatDuration(session?.durationMs),
        getOutcome(session),
        formatCost(session?.totalCostUSD),
        getSentimentLabel(session),
      ]
        .map((value) => `"${String(value || '').replace(/"/g, '""')}"`)
        .join(','),
    );
    downloadTextFile('ai-sessions.csv', [header.join(','), ...csvRows].join('\n'));
  };

  return (
    <section className="flex h-full min-h-0 w-full flex-col overflow-hidden bg-[#eef1f8] text-neutral-900">
      <div className="flex min-h-[72px] items-center justify-between border-b border-neutral-200 bg-white px-7">
        <div className="flex items-center gap-3">
          <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-red-50 p-1.5">
            <span className="flex h-full w-full items-center justify-center rounded-xl border-2 border-red-200 bg-white text-red-600">
              <History className="h-5 w-5" strokeWidth={2.25} />
            </span>
          </span>
          <div>
            <div className="flex items-center gap-2 text-base font-medium text-neutral-500">
              <button
                type="button"
                onClick={() => navigate('/admin-settings/knowledge/ai-agent')}
                className="transition-colors hover:text-neutral-900"
              >
                AI Agents
              </button>
              <span>/</span>
              <span className="text-neutral-900">Sessions</span>
            </div>
            <p className="mt-0.5 text-xs font-normal text-neutral-400">
              Every AI receptionist call &amp; AI chatbot conversation — with transcripts,
              sentiment &amp; outcomes.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="inline-flex h-10 min-w-[140px] shrink-0 items-center gap-1.5 rounded-full border! border-neutral-200! bg-white! px-4 text-sm font-semibold text-neutral-700! shadow-[0_1px_2px_rgba(0,0,0,.03)] transition-colors hover:border-red-300!"
              >
                {dateRangeOptions.find((option) => option.value === dateRange)?.label ||
                  'Date range'}
                <ChevronDown className="h-3.5 w-3.5 opacity-60" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="start"
              className="w-[180px] bg-white border border-slate-200 shadow-lg rounded-xl p-1 z-50 animate-none"
            >
              {dateRangeOptions.map((option) => {
                const isSelected = dateRange === option.value;
                return (
                  <DropdownMenuItem
                    key={option.value}
                    onClick={() => setDateRange(option.value)}
                    className={`flex items-center justify-between gap-2 px-2 py-1.5 text-xs font-medium cursor-pointer rounded-lg hover:bg-red-50! focus:bg-red-50! ${
                      isSelected ? 'bg-red-50! text-red-600! font-semibold' : 'text-slate-900'
                    }`}
                  >
                    <span className="truncate">{option.label}</span>
                    {isSelected && <Check className="h-3.5 w-3.5 shrink-0 text-red-600" />}
                  </DropdownMenuItem>
                );
              })}
            </DropdownMenuContent>
          </DropdownMenu>
          <button
            type="button"
            onClick={exportCsv}
            className="inline-flex h-10 items-center gap-1.5 rounded-full border! border-neutral-200! bg-white! px-4 text-sm font-semibold text-neutral-700! shadow-[0_1px_2px_rgba(0,0,0,.03)] transition-colors hover:border-red-200! hover:bg-red-50! hover:text-red-600!"
          >
            <Download className="h-4 w-4 shrink-0" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-7 overflow-auto bg-[#eef1f8] px-7 py-6">
        <div>
          <div className="mb-3 flex items-center gap-2.5">
            <h2 className="text-[12.5px] font-semibold uppercase tracking-[0.05em] text-red-600">
              Overview
            </h2>
            <span className="h-px flex-1 bg-neutral-200" />
          </div>
          <div className="relative grid grid-cols-1 rounded-[14px] border border-slate-200 bg-white shadow-[0_1px_2px_rgba(0,0,0,.04)] sm:grid-cols-2 lg:grid-cols-5">
            <SessionsBreakdownCard
              total={stats.totalSessions}
              voice={stats.voiceCalls}
              chat={stats.chatSessions}
            />
            <StatCard title="Avg duration" value={stats.avgDuration} description="Per session" />
            <StatCard
              title="Resolution rate"
              value={stats.resolutionRate}
              description="Resolved without handoff"
              valueTone={stats.resolutionRateTone as 'default' | 'warn' | 'critical'}
            />
            <StatCard
              title="Escalations"
              value={String(stats.handoffs)}
              description="Handed off to a human"
            />
            <StatCard title="Total cost" value={stats.totalCost} description="This range" isLast />
          </div>
        </div>

        <div className="flex flex-col gap-3 pb-4">
          <div className="flex items-center gap-2.5">
            <h2 className="text-[12.5px] font-semibold uppercase tracking-[0.05em] text-red-600">
              Sessions
            </h2>
            <span className="h-px flex-1 bg-neutral-200" />
          </div>

        <div className="overflow-hidden rounded-[14px] border border-slate-200 bg-white shadow-[0_1px_2px_rgba(0,0,0,.04)]">
          <div className="flex flex-col gap-3 border-b border-neutral-200 bg-white px-[18px] py-3 sm:flex-row sm:items-center">
            <div className="flex h-10 min-w-0 flex-1 items-center gap-2 rounded-full border! border-neutral-200! bg-white! pl-2 pr-3 shadow-[0_1px_2px_rgba(0,0,0,.03)] transition-all focus-within:border-red-300! focus-within:shadow-[0_0_0_4px_rgba(220,38,38,.1)]!">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-red-50 text-red-600">
                <Search className="h-3.5 w-3.5" />
              </span>
              <input
                value={searchText}
                onChange={(event) => setSearchText(event.target.value)}
                placeholder="Search by contact, agent, intent..."
                className="min-w-0 flex-1 border-none bg-transparent text-sm text-neutral-900 outline-none! placeholder:text-neutral-400"
              />
            </div>

            <div className="flex shrink-0 items-center gap-2 sm:ml-auto">
              <PillDropdown
                label="Channel"
                value={activeChannel}
                options={channelOptions}
                onChange={(option) => setActiveChannel((option.value || 'all') as SessionChannel)}
              />
              <PillDropdown
                label="Agent"
                value={selectedAgent.value}
                options={agentOptions}
                onChange={(option) => setSelectedAgent(option)}
              />
              <PillDropdown
                label="Outcome"
                value={selectedOutcome.value}
                options={outcomeOptions}
                onChange={(option) => setSelectedOutcome(option)}
              />
            </div>
          </div>

          <div className="overflow-x-auto">
          <div className="min-w-[900px]">
          <div className="grid w-full grid-cols-[82px_1.8fr_1.2fr_1fr_0.8fr_1fr_0.6fr_1fr] items-center gap-3 border-b border-neutral-200 bg-neutral-50 px-[18px] py-[13px] text-[12px] font-bold uppercase tracking-[0.04em] text-neutral-500">
            <div className="text-center">Channel</div>
            <div>Agent</div>
            <div>Contact</div>
            <div>Started</div>
            <div className="text-center">Duration</div>
            <div>Outcome</div>
            <div>Cost</div>
            <div>Sentiment</div>
          </div>

          {isLoadingSessions || isLoadingReceptionists || isLoadingChatAgents ? (
            <div className="flex min-h-[260px] items-center justify-center text-slate-500">
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              Loading sessions...
            </div>
          ) : tableRows.length ? (
            pagedTableRows.map((session: any) => {
              const agentName = getAgentName(session, agentById);
              const outcome = getOutcome(session);
              const deletedAgent = isDeletedAgent(session, agentById);

              return (
                <div
                  key={session?.sessionId}
                  className="grid w-full min-w-0 cursor-pointer grid-cols-[82px_1.8fr_1.2fr_1fr_0.8fr_1fr_0.6fr_1fr] items-center gap-3 border-b border-neutral-100 px-[18px] py-2 transition-colors last:border-b-0 hover:bg-neutral-50"
                  onClick={() => setSelectedSession(session)}
                >
                  <div className="flex justify-center">
                    <ChannelPill channel={session?.channel} />
                  </div>
                  <div className="min-w-0">
                    <div
                      className="truncate text-[13px] font-normal text-slate-950"
                      title={agentName}
                    >
                      {agentName}
                    </div>
                    <div className="flex items-center gap-2 whitespace-nowrap text-[11px] text-slate-500">
                      {deletedAgent ? (
                        <span className="rounded-full bg-rose-50 px-2 py-0.5 text-[10px] font-bold text-rose-600">
                          Deleted
                        </span>
                      ) : session?.channel === 'call' ? (
                        'Receptionist'
                      ) : (
                        'Chat agent'
                      )}
                    </div>
                  </div>
                  <div className="min-w-0">
                    <div className="truncate text-[13px] font-semibold text-slate-800">
                      {getContactTitle(session)}
                    </div>
                    <div className="truncate font-mono text-[11px] text-slate-500">
                      {getContactSubText(session)}
                    </div>
                  </div>
                  <div className="min-w-0 truncate text-[12.5px] text-slate-700">
                    {formatStarted(session?.startedAt || session?.createdAt)}
                  </div>
                  <div className="min-w-0 truncate text-center text-[12.5px] text-slate-700">
                    {formatDuration(session?.durationMs)}
                  </div>
                  <div className="flex min-w-0 justify-start">
                    {(() => {
                      const OutcomeIcon = getOutcomeIcon(outcome);
                      return (
                        <span className="inline-flex min-w-0 items-center gap-1.5 truncate text-[12px] font-semibold text-neutral-900">
                          <span
                            className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-[1.5px] ${getOutcomeBorderClass(outcome)} ${getOutcomeClass(outcome)}`}
                          >
                            <OutcomeIcon
                              className="h-2.5 w-2.5 shrink-0"
                              strokeWidth={2.75}
                              fill={outcome === 'Active' ? 'currentColor' : 'none'}
                            />
                          </span>
                          {outcome}
                        </span>
                      );
                    })()}
                  </div>
                  <div
                    className="min-w-0 truncate text-[12.5px] font-bold text-slate-900"
                    title={getCostBasis(session)}
                  >
                    {hasSessionCost(session) ? formatCost(session?.totalCostUSD) : '-'}
                  </div>
                  <div className="flex justify-start">
                    <SentimentGraph session={session} />
                  </div>
                </div>
              );
            })
          ) : (
            <div className="flex min-h-[260px] items-center justify-center text-neutral-500">
              No sessions found.
            </div>
          )}
          </div>
          </div>
          {!isLoadingSessions &&
          !isLoadingReceptionists &&
          !isLoadingChatAgents &&
          tableRows.length ? (
            <div className="flex flex-col gap-2 border-t border-neutral-200 bg-white px-[18px] py-3 text-xs text-neutral-500 sm:flex-row sm:items-center sm:justify-between">
              <div className="font-medium">
                Showing {pageStart}-{pageEnd} of {tableRows.length} record(s)
              </div>
              <div className="flex items-center gap-0.5">
                <button
                  type="button"
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage(1)}
                  className="flex h-7 w-7 items-center justify-center rounded-full text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-neutral-900 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-neutral-500"
                >
                  <ChevronsLeft className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
                  className="flex h-7 w-7 items-center justify-center rounded-full text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-neutral-900 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-neutral-500"
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                </button>
                {pageWindow[0] > 1 && (
                  <span className="flex h-7 w-7 items-center justify-center text-neutral-400">
                    …
                  </span>
                )}
                {pageWindow.map((page) => {
                  const isActive = page === currentPage;
                  return (
                    <button
                      key={page}
                      type="button"
                      onClick={() => setCurrentPage(page)}
                      className={
                        isActive
                          ? 'flex h-7 w-7 items-center justify-center rounded-full border border-red-600! bg-red-600! text-[11px] font-bold text-white!'
                          : 'flex h-7 w-7 items-center justify-center rounded-full text-[11px] font-semibold text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-neutral-900'
                      }
                    >
                      {page}
                    </button>
                  );
                })}
                {pageWindow[pageWindow.length - 1] < totalPages && (
                  <span className="flex h-7 w-7 items-center justify-center text-neutral-400">
                    …
                  </span>
                )}
                <button
                  type="button"
                  disabled={currentPage === totalPages}
                  onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
                  className="flex h-7 w-7 items-center justify-center rounded-full text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-neutral-900 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-neutral-500"
                >
                  <ChevronRight className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  disabled={currentPage === totalPages}
                  onClick={() => setCurrentPage(totalPages)}
                  className="flex h-7 w-7 items-center justify-center rounded-full text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-neutral-900 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-neutral-500"
                >
                  <ChevronsRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ) : null}
        </div>
        </div>
      </div>

      {selectedSession ? (
        <AiSessionDetailDrawer
          session={selectedSession}
          agentById={agentById}
          onClose={() => setSelectedSession(null)}
        />
      ) : null}
    </section>
  );
};

export default AiBotSession;
