import AlertConfirm from '@/components/custom/alert-confirm';
// DUMMY DATA - remove this import together with DUMMY_DATA.ts
import { DUMMY_CHAT_AGENTS, DUMMY_FLAG, SHOW_DUMMY_DATA } from '../DUMMY_DATA';
import CustomAvatar from '@/components/custom/custom-avatar';
import CustomTooltip from '@/components/custom/custom-tooltip';
import TableManager from '@/components/custom/table-manager';
import { HoverPortalCard, SentimentAnalysisCard } from '@/components/custom/hover-portal-card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useCompanyFeatures } from '@/hooks/rbac';
import { handleAlert } from '@/lib/utils';
import { sanitizeAiAgentUpdateRecord, sanitizeAiSearchText } from '@/lib/ai-input-security';
import {
  deleteAIAgent,
  getAIAgentToken,
  getChatAgentList,
  getChatAgentMetrics,
  updateAIAgent,
  updateAgentStatus,
} from '@/services/api';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ColumnDef } from '@tanstack/react-table';
import {
  Plus,
  Search,
  ChevronDown,
  Loader2,
  RefreshCcw,
  MessageSquare,
  MoreVertical,
  PenLine,
  Play,
  Settings,
  Trash2,
  TrendingUp,
} from 'lucide-react';
import moment from 'moment';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import PromptModal from '../ai-receptionist/update-prompt';
import AgentAnalytics from './agent-analytics';
import ChatAgentConfigureModal from './chat-agent-configure-modal';

const getNestedValue = (source: any, path: string) =>
  path.split('.').reduce((value, key) => value?.[key], source);

const toNumber = (value: unknown) => {
  if (value === null || value === undefined || value === '') return null;

  const normalized =
    typeof value === 'string' ? value.replace('%', '').replace(/,/g, '').trim() : value;
  const parsed = Number(normalized);

  return Number.isFinite(parsed) ? parsed : null;
};

const pickNumber = (source: any, paths: string[]) => {
  for (const path of paths) {
    const parsed = toNumber(getNestedValue(source, path));
    if (parsed !== null) return parsed;
  }

  return null;
};

const normalizePercent = (value: number | null) => {
  if (value === null) return null;
  if (value > 0 && value <= 1) return Math.round(value * 100);
  return Math.round(value);
};

const formatNumber = (value: number | null) =>
  value === null ? '--' : Math.round(value).toLocaleString();

const formatPercent = (value: number | null) => {
  const normalized = normalizePercent(value);
  return normalized === null ? '--' : `${normalized}%`;
};

const average = (values: Array<number | null>) => {
  const realValues = values.filter((value): value is number => value !== null);
  if (!realValues.length) return null;

  return realValues.reduce((sum, value) => sum + value, 0) / realValues.length;
};

const normalizeSentiment = (value: any) => {
  const sentiment = String(value || '')
    .trim()
    .toLowerCase();
  return ['positive', 'neutral', 'negative'].includes(sentiment) ? sentiment : '';
};

const sentimentBadgeClass = (sentiment: string) => {
  if (sentiment === 'positive') return 'bg-green-50! text-green-700!';
  if (sentiment === 'negative') return 'bg-red-50! text-red-600!';
  if (sentiment === 'neutral') return 'bg-amber-50! text-amber-700!';
  return 'bg-gray-100! text-gray-500!';
};

const sentimentScoreRows = [
  { key: 'positive', label: 'Positive', colorClass: 'bg-green-500' },
  { key: 'negative', label: 'Negative', colorClass: 'bg-red-600' },
  { key: 'neutral', label: 'Neutral', colorClass: 'bg-neutral-400' },
] as const;

const sentimentScoreValue = (scores: any, key: (typeof sentimentScoreRows)[number]['key']) => {
  const score = Number(scores?.[key] || 0);
  if (!Number.isFinite(score)) return 0;

  return Math.max(0, Math.min(100, score));
};

const sentimentLabelFromScore = (score: number | null) => {
  if (!score) return '';
  if (score >= 75) return 'positive';
  if (score >= 50) return 'neutral';
  return 'negative';
};

const metricPaths = {
  conversations: [
    'analytics.conversations_7d',
    'analytics.conversations7d',
    'metrics.conversations_7d',
    'metrics.conversations7d',
    'conversations_7d',
    'conversations7d',
    'conversation_count_7d',
    'conversationCount7d',
    'conversation_count',
    'conversationCount',
    'total_conversations',
    'totalConversations',
    'stats.conversations',
    'counts.sessions',
    'conversations',
  ],
  resolution: [
    'analytics.resolution_rate',
    'analytics.resolutionRate',
    'metrics.resolution_rate',
    'metrics.resolutionRate',
    'resolution_rate',
    'resolutionRate',
    'resolved_rate',
    'resolvedRate',
    'resolution',
  ],
  confidence: [
    'analytics.avg_confidence',
    'analytics.avgConfidence',
    'metrics.avg_confidence',
    'metrics.avgConfidence',
    'stats.avg_confidence',
    'stats.avgConfidence',
    'stats.confidence',
    'avg_confidence',
    'avgConfidence',
    'confidence',
  ],
};

const getAgentId = (agent: any) =>
  String(agent?.agent_uuid || agent?.agentId || agent?.id || agent?.uuid || agent?._id || '');

const getMetricsByAgentId = (rows: any[] = []) => {
  const metricsByAgentId = new Map<string, any>();
  rows.forEach((row) => {
    const agentId = getAgentId(row);
    if (agentId) metricsByAgentId.set(agentId, row);
  });
  return metricsByAgentId;
};

const mergeAgentMetrics = (agent: any, metricsByAgentId: Map<string, any>) => {
  const row = { ...agent };
  delete row.analytics;
  delete row.metrics;
  delete row.stats;
  delete row.conversations_7d;
  delete row.conversations7d;
  delete row.conversation_count_7d;
  delete row.conversationCount7d;
  delete row.conversation_count;
  delete row.conversationCount;
  delete row.total_conversations;
  delete row.totalConversations;
  delete row.conversations;
  delete row.resolution_rate;
  delete row.resolutionRate;
  delete row.resolved_rate;
  delete row.resolvedRate;
  delete row.resolution;
  delete row.avg_confidence;
  delete row.avgConfidence;
  delete row.confidence;
  delete row.handoffs;
  delete row.sentiment_calls;
  delete row.avg_sentiment;
  delete row.sentiment_counts;
  delete row.sentiment_label;
  return {
    ...row,
    ...(metricsByAgentId.get(getAgentId(agent)) || {}),
  };
};

const isDeletedAgent = (agent: any) => Boolean(agent?.deletedAt || agent?.deleted_at);

const isLiveAgent = (agent: any) => {
  if (isDeletedAgent(agent)) return false;

  const status = String(agent?.status || agent?.agentStatus || '').toLowerCase();
  return status === 'active' || status === 'live';
};
const isDraftAgent = (agent: any) => Boolean(agent?.forward_call_actions?.chatbot_builder?.draft);

const getAgentName = (agent: any) => agent?.agentName || agent?.name || 'Untitled agent';

const getAgentSubtitle = (agent: any) => {
  const values = [
    agent?.companyName || agent?.company_name,
    agent?.department || agent?.category || agent?.agentType || agent?.type,
  ]
    .map((value) => String(value || '').trim())
    .filter(Boolean);

  return values.length ? values.join(' · ') : 'AI Chatbot Agent';
};

const getAgentAvatarImage = (agent: any) =>
  String(agent?.avatar || agent?.profile || agent?.image || agent?.agentAvatar || '').trim();

const getLastUpdated = (agent: any) => {
  const date = agent?.updatedAt || agent?.updated_at || agent?.createdAt || agent?.created_at;
  if (!date) return '--';

  const updatedAt = moment.utc(date).local();
  if (!updatedAt.isValid()) return '--';

  const seconds = Math.max(0, moment().diff(updatedAt, 'seconds'));
  if (seconds < 60) return 'now';

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;

  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;

  return `${Math.floor(months / 12)}y ago`;
};

const CHAT_AGENT_DATE_FILTERS = [
  { label: 'Today', value: 'today' },
  { label: '7d', value: '7_days' },
  { label: '30 days', value: '30_days' },
] as const;

type ChatAgentDateFilter = (typeof CHAT_AGENT_DATE_FILTERS)[number]['value'];

const getChatAgentDateFilters = (dateFilter: ChatAgentDateFilter) => {
  const today = moment().format('YYYY-MM-DD');

  if (dateFilter === '7_days') {
    return {
      from: moment().subtract(7, 'days').startOf('day').format('YYYY-MM-DD'),
      to: today,
    };
  }

  if (dateFilter === '30_days') {
    return {
      from: moment().subtract(30, 'days').startOf('day').format('YYYY-MM-DD'),
      to: today,
    };
  }

  return {
    from: today,
    to: today,
  };
};

const getChatAgentMetricDateFilters = (dateFilter: ChatAgentDateFilter) => {
  const filters = getChatAgentDateFilters(dateFilter);
  const rangeStart = new Date(`${filters.from}T00:00:00.000`);
  const rangeEnd = new Date(`${filters.to}T23:59:59.999`);

  return {
    ...filters,
    range_start: rangeStart.toISOString(),
    range_end: rangeEnd.toISOString(),
    analytics_from: rangeStart.toISOString().slice(0, 10),
    analytics_to: rangeEnd.toISOString().slice(0, 10),
  };
};

function AiChatbotAgents() {
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const { features } = useCompanyFeatures();
  const agentAccess = features?.plan_features?.ai?.action?.agent;

  const [search, setSearch] = useState('');
  const [isTableRefreshing, setIsTableRefreshing] = useState(false);
  const agentTableRef = useRef<any>(null);
  const [view, setView] = useState<'list' | 'analytics'>('list');
  const [statusFilter, setStatusFilter] = useState<'all' | 'live'>('all');
  const dateFilter: ChatAgentDateFilter = '7_days';
  const [deleteAgent, setDeleteAgent] = useState<any>(null);
  const [editData, setEditData] = useState<any>(null);
  const [promptModalOpen, setPromptModalOpen] = useState(false);
  const [isUpdatingPrompt, setIsUpdatingPrompt] = useState(false);
  const [configureAgent, setConfigureAgent] = useState<any>(null);
  const [configureTokenId, setConfigureTokenId] = useState('');

  useEffect(() => {
    const routeState = (location.state || {}) as any;
    if (!routeState?.configureAgent) return;

    setConfigureAgent(routeState.configureAgent);
    setConfigureTokenId(routeState.configureTokenId || '');
    navigate(location.pathname, { replace: true, state: {} });
  }, [location.pathname, location.state, navigate]);

  const selectedDateFilters = useMemo(() => getChatAgentDateFilters(dateFilter), [dateFilter]);
  const selectedMetricDateFilters = useMemo(
    () => getChatAgentMetricDateFilters(dateFilter),
    [dateFilter],
  );
  const selectedDateFilterLabel = useMemo(
    () => CHAT_AGENT_DATE_FILTERS.find((option) => option.value === dateFilter)?.label || 'Today',
    [dateFilter],
  );

  const invalidateChatAgentQueries = useCallback(() => {
    queryClient.invalidateQueries({
      predicate: (query) => String(query.queryKey?.[0] || '').includes('getChatAgent'),
    });
  }, [queryClient]);

  const { data: agentResult, isFetching: isStatsFetching } = useQuery({
    queryKey: ['getChatAgentList', 'stats', selectedDateFilters],
    queryFn: () =>
      getChatAgentList({
        page: 1,
        limit: 1000,
        filters: [],
        search: '',
        date_filters: selectedDateFilters,
      }),
    refetchOnWindowFocus: false,
    retry: false,
    select: (response: any) => response?.data?.data?.result || {},
  });

  // DUMMY DATA - local status flips for the preview rows.
  const [dummyStatusOverrides, setDummyStatusOverrides] = useState<Record<string, string>>(
    {},
  );
  const dummyChatAgents = useMemo(
    () =>
      DUMMY_CHAT_AGENTS.map((agent) => {
        const override = dummyStatusOverrides[agent.agentId];
        return override ? { ...agent, status: override, agentStatus: override } : agent;
      }),
    [dummyStatusOverrides],
  );

  const allAgents = useMemo(
    () => (Array.isArray(agentResult?.rows) ? agentResult.rows : []),
    [agentResult?.rows],
  );
  const metricAgentIds = useMemo(() => allAgents.map(getAgentId).filter(Boolean), [allAgents]);
  const { data: agentMetricsResult, isFetching: isMetricsFetching } = useQuery({
    queryKey: ['getChatAgentMetrics', 'stats', selectedMetricDateFilters, metricAgentIds],
    queryFn: () =>
      getChatAgentMetrics({
        agentIds: metricAgentIds,
        date_filters: selectedMetricDateFilters,
      }),
    enabled: metricAgentIds.length > 0,
    refetchOnWindowFocus: false,
    retry: false,
    select: (response: any) => response?.data?.data?.result || {},
  });
  const agentMetricsById = useMemo(
    () => getMetricsByAgentId(agentMetricsResult?.rows || []),
    [agentMetricsResult?.rows],
  );
  const agentsWithMetrics = useMemo(() => {
    const merged = allAgents.map((agent: any) => mergeAgentMetrics(agent, agentMetricsById));
    // DUMMY DATA - so the overview KPIs count the preview rows too.
    return SHOW_DUMMY_DATA ? [...merged, ...dummyChatAgents] : merged;
  }, [allAgents, agentMetricsById, dummyChatAgents]);

  // DUMMY DATA - the counts come from server aggregates, so the preview rows
  // are added on here too.
  const dummyAgentCounts = useMemo(() => {
    const rows = SHOW_DUMMY_DATA ? dummyChatAgents : [];
    return {
      count: rows.length,
      live: rows.filter((agent: any) =>
        ['active', 'live'].includes(String(agent?.status || '').toLowerCase()),
      ).length,
    };
  }, [dummyChatAgents]);

  const totalAgentsCount = useMemo(
    () =>
      (pickNumber(agentResult, ['counts.all', 'totalItems', 'total', 'totalRecords', 'count']) ??
        allAgents.length) + dummyAgentCounts.count,
    [agentResult, allAgents, dummyAgentCounts.count],
  );

  const liveAgents = useMemo(() => allAgents.filter(isLiveAgent), [allAgents]);
  const liveAgentsCount = useMemo(
    () =>
      (pickNumber(agentResult, ['counts.active', 'active', 'activeCount']) ?? liveAgents.length) +
      dummyAgentCounts.live,
    [agentResult, liveAgents.length, dummyAgentCounts.live],
  );

  const tableFilters = useMemo(
    () => (statusFilter === 'live' ? [{ key: 'status', value: 'active' }] : []),
    [statusFilter],
  );

  const selectTableAgents = useCallback(
    (response: any) => {
      const rows = response?.data?.data?.result?.rows || [];
      const mergedRows = rows.map((agent: any) => mergeAgentMetrics(agent, agentMetricsById));
      // DUMMY DATA - appended after the metric merge so their own figures survive.
      const rowsWithMetrics = SHOW_DUMMY_DATA
        ? [...mergedRows, ...dummyChatAgents]
        : mergedRows;
      return statusFilter === 'live' ? rowsWithMetrics.filter(isLiveAgent) : rowsWithMetrics;
    },
    [agentMetricsById, statusFilter, dummyChatAgents],
  );

  const stats = useMemo(() => {
    const conversations: Array<number | null> = agentsWithMetrics.map((agent: any) =>
      pickNumber(agent, metricPaths.conversations),
    );
    const resolution: Array<number | null> = agentsWithMetrics.map((agent: any) =>
      pickNumber(agent, metricPaths.resolution),
    );
    const confidence: Array<number | null> = agentsWithMetrics.map((agent: any) =>
      pickNumber(agent, metricPaths.confidence),
    );
    // DUMMY DATA - the preview rows carry their own figures, so averaging over
    // every row (server + preview) keeps the KPI strip in step with the table.
    const averageResolution = SHOW_DUMMY_DATA
      ? average(resolution)
      : (pickNumber(agentMetricsResult, ['resolution_rate', 'analytics.resolution_rate']) ??
        average(resolution));
    const averageConfidence = SHOW_DUMMY_DATA
      ? average(confidence)
      : (pickNumber(agentMetricsResult, [
          'avg_confidence',
          'analytics.avg_confidence',
          'confidence',
        ]) ?? average(confidence));
    const totalConversations = conversations.some((value) => value !== null)
      ? conversations.reduce<number>((sum, value) => sum + (value ?? 0), 0)
      : (pickNumber(agentMetricsResult, [
          'conversations',
          'conversation_count',
          'analytics.conversations',
        ]) ?? null);
    const resultSentimentCalls = pickNumber(agentMetricsResult, ['sentiment_calls']);
    const resultSentimentScore = pickNumber(agentMetricsResult, ['avg_sentiment']);
    const rowSentiment = agentsWithMetrics
      .map((agent: any) => ({
        calls: Number(agent?.sentiment_calls || 0),
        score: Number(agent?.avg_sentiment || 0),
      }))
      .filter((agent: any) => agent.calls > 0 && Number.isFinite(agent.score));
    const rowSentimentCalls = rowSentiment.reduce(
      (sum: number, agent: any) => sum + agent.calls,
      0,
    );
    const sentimentCalls =
      SHOW_DUMMY_DATA || resultSentimentCalls === null || resultSentimentCalls <= 0
        ? rowSentimentCalls
        : resultSentimentCalls;
    const averageSentiment =
      !SHOW_DUMMY_DATA &&
      resultSentimentCalls !== null &&
      resultSentimentCalls > 0 &&
      resultSentimentScore !== null
        ? resultSentimentScore
        : rowSentimentCalls
          ? rowSentiment.reduce((sum: number, agent: any) => sum + agent.score * agent.calls, 0) /
            rowSentimentCalls
          : null;
    return [
      {
        label: 'Total agents',
        value: totalAgentsCount.toLocaleString(),
        helper:
          totalAgentsCount && totalAgentsCount === liveAgentsCount
            ? 'All live'
            : `${liveAgentsCount.toLocaleString()} live`,
        description: 'Chat agents on this account',
      },
      {
        label: `Conversations (${selectedDateFilterLabel})`,
        value: formatNumber(totalConversations),
        helper: '',
        description: 'Inbound chats, this range',
      },
      {
        label: 'Resolution rate',
        value: formatPercent(averageResolution),
        helper: '',
        description: 'Resolved without a handoff',
        valueTone:
          averageResolution === null
            ? 'default'
            : averageResolution < 50
              ? 'critical'
              : averageResolution < 80
                ? 'warn'
                : 'default',
      },
      {
        label: 'Avg confidence',
        value: formatPercent(averageConfidence),
        helper: '',
        description: 'Model confidence per reply',
      },
      {
        label: 'Overall sentiment',
        value:
          sentimentCalls && averageSentiment !== null
            ? `${Math.round(averageSentiment)}`
            : 'Not analyzed',
        helper: '',
        description: sentimentCalls ? `${sentimentCalls} chats analyzed` : 'No chats analyzed yet',
      },
    ];
  }, [
    agentMetricsResult,
    agentsWithMetrics,
    liveAgentsCount,
    selectedDateFilterLabel,
    totalAgentsCount,
  ]);

  const { mutateAsync: mutateGetToken } = useMutation({
    mutationFn: getAIAgentToken,
    mutationKey: ['getAIAgentToken'],
  });

  const { mutate: mutateDeleteAgent, isPending: isDeletePending } = useMutation({
    mutationKey: ['deleteAIAgent'],
    mutationFn: deleteAIAgent,
    onSuccess: () => {
      setDeleteAgent(null);
      invalidateChatAgentQueries();
      handleAlert({
        text: 'Agent deleted successfully!',
        type: 'success',
      });
    },
  });

  const { mutate: submitAgent } = useMutation({
    mutationFn: updateAIAgent,
    onSuccess: () => {
      invalidateChatAgentQueries();
      handleAlert({
        text: 'AI Agent updated successfully!',
        type: 'success',
      });
    },
    onError: (err: any) => {
      console.error('Failed to update AI Agent:', err);
    },
  });

  const { mutate: updateStatusMutation } = useMutation({
    mutationFn: updateAgentStatus,
    onSuccess: () => {
      invalidateChatAgentQueries();
      handleAlert({
        text: 'AI Agent status updated successfully!',
        type: 'success',
      });
    },
    onError: (err: any) => {
      console.error('Failed to update AI Agent status:', err);
      handleAlert({
        text: 'Failed to update status.',
        type: 'error',
      });
    },
  });

  const handlePlaygroundClick = useCallback(
    (rowData: any) => {
      navigate('/admin-settings/knowledge/playground', {
        state: {
          activeTab: 'chat',
          selectedAgent: rowData,
          openAgentId: getAgentId(rowData),
        },
      });
    },
    [navigate],
  );

  const handleUpdatePrompt = useCallback(
    async (rowOriginal: any, newPrompt: string, onDone: () => void) => {
      setIsUpdatingPrompt(true);
      let token = '';

      try {
        const tokenRes = await mutateGetToken();
        token = tokenRes?.data?.data?.result?.tokenId || '';
      } catch (error) {
        console.error('Failed to fetch token:', error);
      }

      const safeRowOriginal = sanitizeAiAgentUpdateRecord(rowOriginal);
      const payload = {
        ...safeRowOriginal,
        agentId: rowOriginal.agent_uuid || rowOriginal.id,
        token,
        systemPrompt: newPrompt,
      };

      const {
        agent_uuid,
        uuid,
        did_uuid,
        company_uuid,
        created_at,
        useMessageExactly,
        ...updatedData
      } = payload;
      void agent_uuid;
      void uuid;
      void did_uuid;
      void company_uuid;
      void created_at;
      void useMessageExactly;

      submitAgent(updatedData, {
        onSuccess: () => {
          onDone();
          setIsUpdatingPrompt(false);
        },
        onError: () => {
          onDone();
          setIsUpdatingPrompt(false);
        },
      });
    },
    [mutateGetToken, submitAgent],
  );

  const handleStatusUpdate = useCallback(
    async (rowOriginal: any, newStatus: string) => {
      updateStatusMutation({
        agentType: 'chat',
        agentId: rowOriginal.agent_uuid || rowOriginal.id,
        status: newStatus === 'live' ? 'active' : 'inactive',
      });
    },
    [updateStatusMutation],
  );

  const openConfigureAgent = useCallback(
    (agent: any) => {
      navigate('/admin-settings/knowledge/create-agent', {
        state: { rowData: { isEdit: true, useWizard: true, formData: agent } },
      });
    },
    [navigate],
  );

  const openAgentDetails = useCallback(
    (agent: any) => {
      navigate('/admin-settings/knowledge/create-agent', {
        state: {
          rowData: { isEdit: true, readOnly: true, initialTab: 'overview', formData: agent },
        },
      });
    },
    [navigate],
  );

  const openPromptEditor = useCallback((agent: any) => {
    setEditData(agent);
    setPromptModalOpen(true);
  }, []);

  const openWidgetConfigure = useCallback((agent: any) => {
    setConfigureTokenId('');
    setConfigureAgent(agent);
  }, []);

  const columns = useMemo<ColumnDef<any>[]>(
    () => [
      {
        header: 'Agent',
        accessorKey: 'agentName',
        cell: ({ row }: any) => {
          const agent = row?.original;
          const agentName = getAgentName(agent);
          const live = isLiveAgent(agent);

          return (
            <div className="group flex w-full min-w-0 items-center gap-3">
              <div className="relative shrink-0">
                <div className="rounded-full ring-2 ring-white ring-offset-1 ring-offset-transparent group-hover:ring-slate-100">
                  <CustomAvatar
                    name={agentName}
                    image={getAgentAvatarImage(agent)}
                    size="28"
                    showPresence={false}
                    isActivityInfo={false}
                    textClass="text-[10px]"
                  />
                </div>
                <span
                  className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-white ${
                    live ? 'bg-green-500' : 'bg-slate-400'
                  }`}
                />
              </div>
              <div className="min-w-0 flex-1">
                <button
                  type="button"
                  title={agentName}
                  className="block max-w-full truncate text-left text-[13px] font-normal! leading-5 text-slate-950! transition-colors hover:text-slate-950! cursor-pointer"
                  onClick={(event) => {
                    event.stopPropagation();
                    openAgentDetails(agent);
                  }}
                >
                  {agentName}
                </button>
                <div className="mt-0.5 flex min-w-0 items-start text-[11px] leading-4 text-slate-500">
                  <span className="line-clamp-2">{getAgentSubtitle(agent)}</span>
                </div>
              </div>
            </div>
          );
        },
      },
      {
        header: 'Status',
        accessorKey: 'status',
        meta: { textAlign: 'left' },
        cell: ({ row }: any) => {
          const agent = row?.original;
          const live = isLiveAgent(agent);
          const draft = isDraftAgent(agent);

          if (isDeletedAgent(agent)) {
            return (
              <div className="flex justify-center">
                <span className="inline-flex items-center rounded-full bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-600">
                  Deleted
                </span>
              </div>
            );
          }

          const handleStatusChange = (newStatus: string) => {
            const currentStatus = live ? 'live' : 'inactive';
            if (newStatus === currentStatus) return;
            // DUMMY DATA - preview rows have no server record, so flip them locally.
            if (agent?.[DUMMY_FLAG]) {
              setDummyStatusOverrides((prev) => ({
                ...prev,
                [String(agent.agentId || agent.agent_uuid)]:
                  newStatus === 'live' ? 'active' : 'inactive',
              }));
              return;
            }
            handleStatusUpdate(agent, newStatus);
          };

          return (
            <div className="flex justify-start">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className={`inline-flex h-6 min-w-[76px] shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-full border! px-2.5 text-[11px] font-extrabold cursor-pointer outline-none transition-colors duration-200 ${
                    live
                      ? 'border-green-200! bg-green-100! text-green-800! hover:bg-green-100/80!'
                      : draft
                        ? 'border-amber-200! bg-amber-50! text-amber-700! hover:bg-amber-50/80!'
                        : 'border-slate-200! bg-slate-100! text-slate-600! hover:bg-slate-100/80!'
                  }`}
                >
                  <span
                    className={`h-2 w-2 shrink-0 rounded-full ${live ? 'bg-green-500' : draft ? 'bg-amber-500' : 'bg-slate-400'}`}
                  />
                  <span className="leading-none">{live ? 'Live' : draft ? 'Draft' : 'Paused'}</span>
                  <ChevronDown className="h-3 w-3 shrink-0 opacity-60" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="start"
                className="[&_[data-slot=dropdown-menu-item]]:focus:text-neutral-900! w-[140px] bg-white border border-slate-200 shadow-lg rounded-xl p-1 z-50 animate-none"
              >
                <DropdownMenuItem
                  onClick={() => handleStatusChange('live')}
                  className="flex items-center gap-2 px-2 py-1.5 text-xs font-medium cursor-pointer rounded-lg hover:bg-slate-50 text-slate-900"
                >
                  <span className="h-2 w-2 rounded-full bg-green-500" />
                  <span>Live</span>
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => handleStatusChange('inactive')}
                  className="flex items-center gap-2 px-2 py-1.5 text-xs font-medium cursor-pointer rounded-lg hover:bg-slate-50 text-slate-900"
                >
                  <span className="h-2 w-2 rounded-full bg-slate-400" />
                  <span>Paused</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            </div>
          );
        },
      },
      {
        header: () => <span>Conversations ({selectedDateFilterLabel})</span>,
        accessorKey: 'conversations',
        cell: ({ row }: any) => (
          <div className="text-center text-[12.5px] font-bold text-slate-950">
            {formatNumber(pickNumber(row?.original, metricPaths.conversations))}
          </div>
        ),
        meta: { textAlign: 'center' },
      },
      {
        header: 'Resolution',
        accessorKey: 'resolution',
        cell: ({ row }: any) => (
          <div className="text-center text-[12.5px] font-bold text-slate-950">
            {formatPercent(pickNumber(row?.original, metricPaths.resolution))}
          </div>
        ),
        meta: { textAlign: 'center' },
      },
      {
        header: 'Sentiment',
        accessorKey: 'avg_sentiment',
        meta: { textAlign: 'center' },
        cell: ({ row }: any) => {
          const data = row.original || {};
          const chats = Number(data.sentiment_calls || 0);
          const rawScore = Number(data.avg_sentiment || 0);
          const score = Number.isFinite(rawScore) ? Math.max(0, Math.min(100, rawScore)) : 0;
          const displayScore = Math.round(score);
          const label =
            normalizeSentiment(data.sentiment_label) || sentimentLabelFromScore(score) || 'neutral';
          const sentimentScoresData = data.sentiment_scores || {};
          const sentimentScores = sentimentScoreRows.map((item) => ({
            ...item,
            score: Math.round(sentimentScoreValue(sentimentScoresData, item.key)),
          }));
          const hasScores = sentimentScores.some((item) => item.score > 0);

          if (!chats || !score) {
            return (
              <div className="flex justify-center">
                <span className="inline-flex rounded-full bg-gray-100 px-2 py-1 text-xs font-semibold text-gray-500">
                  Not analyzed
                </span>
              </div>
            );
          }

          const pill = (
            <span
              className={`inline-flex w-fit items-center justify-center gap-1 rounded-full px-2.5 py-1 text-[12px] font-semibold capitalize ${sentimentBadgeClass(label)}`}
            >
              {label} · {displayScore}
            </span>
          );

          if (!hasScores) {
            return <div className="flex justify-center">{pill}</div>;
          }

          return (
            <div className="flex justify-center">
              <HoverPortalCard trigger={pill}>
                <SentimentAnalysisCard scores={sentimentScores} />
              </HoverPortalCard>
            </div>
          );
        },
      },
      {
        header: 'Last updated',
        accessorKey: 'updatedAt',
        cell: ({ row }: any) => (
          <div className="text-center text-[12.5px] text-slate-700">
            {getLastUpdated(row?.original)}
          </div>
        ),
        meta: { textAlign: 'center' },
      },
      {
        header: 'Actions',
        accessorKey: 'action',
        cell: ({ row }: any) => {
          const agent = row?.original;
          const deleted = isDeletedAgent(agent);
          const menuActions = [
            agentAccess?.edit && {
              key: 'configure',
              icon: <Settings className="h-3.5 w-3.5" />,
              onClick: () => openWidgetConfigure(agent),
              label: 'Configure',
              className: 'text-slate-700!',
              iconBadgeClassName: 'text-neutral-600',
            },
            agentAccess?.edit && {
              key: 'edit-prompt',
              icon: <MessageSquare className="h-3.5 w-3.5" />,
              onClick: () => openPromptEditor(agent),
              label: 'Edit prompt',
              className: 'text-slate-700!',
              iconBadgeClassName: 'text-neutral-600',
            },
            agentAccess?.edit && {
              key: 'edit-agent',
              icon: <PenLine className="h-3.5 w-3.5" />,
              onClick: () => openConfigureAgent(agent),
              label: 'Edit agent',
              className: 'text-slate-700!',
              iconBadgeClassName: 'text-neutral-600',
            },
            agentAccess?.delete &&
              !deleted && {
                key: 'delete',
                icon: <Trash2 className="h-3.5 w-3.5" />,
                onClick: () => setDeleteAgent(agent),
                label: 'Delete',
                className: 'text-red-600!',
                iconBadgeClassName: 'text-red-600',
              },
          ].filter(Boolean) as Array<{
            key: string;
            icon: ReactNode;
            onClick: () => void;
            label: string;
            className: string;
            iconBadgeClassName: string;
          }>;

          if (!menuActions.length) return '---';

          return (
            <div className="flex w-full items-center justify-center gap-2">
              <CustomTooltip text="Play" side="top">
                <button
                  type="button"
                  className="cursor-pointer flex h-8 w-8 items-center justify-center rounded-full transition-colors bg-blue-50! text-blue-600! hover:bg-blue-600! hover:text-white!"
                  onClick={(event) => {
                    event.stopPropagation();
                    handlePlaygroundClick(agent);
                  }}
                >
                  <Play className="h-3.5 w-3.5" />
                </button>
              </CustomTooltip>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    aria-label="More actions"
                    className="cursor-pointer flex h-8 w-8 items-center justify-center rounded-full transition-colors bg-neutral-100! text-neutral-500! hover:bg-neutral-200! hover:text-neutral-900!"
                    onClick={(event) => event.stopPropagation()}
                  >
                    <MoreVertical className="h-3.5 w-3.5" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="end"
                  className="[&_[data-slot=dropdown-menu-item]]:focus:text-neutral-900! flex w-[190px] flex-col gap-1 rounded-2xl! border! border-neutral-200! bg-white p-1.5 shadow-lg z-50 animate-none"
                >
                  {menuActions.map((action) => (
                    <DropdownMenuItem
                      key={action.key}
                      onClick={(event) => {
                        event.stopPropagation();
                        action.onClick();
                      }}
                      className={`group flex cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] font-medium hover:bg-[#f3f4f6]! focus:bg-[#f3f4f6]! ${action.className}`}
                    >
                      <span
                        className={`inline-flex h-5 w-5 shrink-0 items-center justify-center ${action.iconBadgeClassName}`}
                      >
                        {action.icon}
                      </span>
                      <span>{action.label}</span>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          );
        },
        meta: {
          textAlign: 'center',
        },
      },
    ],
    [
      agentAccess?.delete,
      agentAccess?.edit,
      handlePlaygroundClick,
      openAgentDetails,
      openConfigureAgent,
      openWidgetConfigure,
      openPromptEditor,
      handleStatusUpdate,
      selectedDateFilterLabel,
    ],
  );

  if (view === 'analytics') {
    return <AgentAnalytics onClose={() => setView('list')} agents={agentsWithMetrics} />;
  }

  return (
    <>
      <section className="flex h-full min-h-0 w-full flex-col overflow-hidden bg-[#efefef] text-neutral-900">
        <div className="flex min-h-[74px] items-center justify-between border-b border-neutral-200 bg-white px-7 py-2">
          <div className="flex items-center gap-3">
            <div>
              <button
                type="button"
                onClick={() => navigate('/admin-settings/knowledge/ai-agent')}
                className="block transition-colors hover:text-neutral-700"
                style={{
                  fontFamily: '"IBM Plex Mono", ui-monospace, "SF Mono", Menlo, monospace',
                  fontStyle: 'normal',
                  fontWeight: 800,
                  fontSize: '12px',
                  lineHeight: '18px',
                  letterSpacing: '0.04em',
                  color: 'rgb(220, 38, 38)',
                  textTransform: 'uppercase',
                }}
              >
                AI Tools
              </button>
              <div
                style={{
                  fontFamily: '"Instrument Serif", Georgia, serif',
                  fontStyle: 'italic',
                  fontWeight: 400,
                  fontSize: '27px',
                  lineHeight: '34px',
                  color: 'rgb(23, 23, 23)',
                }}
              >
                Chat Agents
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {agentAccess?.add && (
              <button
                type="button"
                onClick={() => setView('analytics')}
                className="inline-flex h-10 items-center gap-1.5 rounded-full border! border-neutral-200! bg-white! px-5 text-sm font-semibold text-neutral-700! shadow-[0_1px_2px_rgba(0,0,0,.03)] transition-colors hover:border-red-200! hover:bg-red-50! hover:text-red-600!"
              >
                <TrendingUp className="h-4 w-4 shrink-0" />
                <span>Analytics</span>
              </button>
            )}
            {agentAccess?.add && (
              <button
                type="button"
                onClick={() => navigate('/admin-settings/knowledge/create-agent')}
                className="inline-flex h-10 items-center gap-1.5 rounded-full bg-neutral-900! px-5 text-sm font-semibold text-white! shadow-none transition-colors hover:bg-neutral-800!"
              >
                <Plus className="h-4 w-4 shrink-0" />
                <span>Create New Chat Agent</span>
              </button>
            )}
          </div>
        </div>

        <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-auto bg-[#efefef] px-7 pt-4 pb-6">
          <div>
            <div className="mb-3 flex items-center gap-2.5">
              <h2 className="text-[12.5px] font-semibold uppercase tracking-[0.05em] text-red-600">
                Overview
              </h2>
              <span className="h-px flex-1 bg-neutral-200" />
            </div>
            <div className="relative grid grid-cols-1 rounded-[14px] border border-slate-200 bg-white shadow-[0_1px_2px_rgba(0,0,0,.04)] sm:grid-cols-2 lg:grid-cols-5">
              {(isStatsFetching || isMetricsFetching) && (
                <div className="absolute inset-0 z-10 flex items-center justify-center rounded-[inherit] bg-white/70 backdrop-blur-[1px]">
                  <Loader2 className="h-5 w-5 animate-spin text-neutral-600" />
                </div>
              )}
              {stats.map((stat, index) => (
                <div
                  key={stat.label}
                  className={`flex flex-col gap-1.5 p-4 ${
                    index !== stats.length - 1 ? 'border-b border-slate-100 sm:border-b-0 sm:border-r' : ''
                  }`}
                >
                  <span className="text-[11.5px] font-bold uppercase tracking-[0.06em] whitespace-nowrap text-neutral-700">
                    {stat.label}
                  </span>
                  <span className="flex items-baseline gap-1.5">
                    <span
                      className={`text-[26px] font-bold leading-tight tracking-tight whitespace-nowrap ${
                        stat.valueTone === 'critical'
                          ? 'text-red-600'
                          : stat.valueTone === 'warn'
                            ? 'text-amber-600'
                            : 'text-neutral-900'
                      }`}
                    >
                      {stat.value}
                    </span>
                    {stat.helper && (
                      <span className="whitespace-nowrap rounded-full bg-green-50 px-2 py-0.5 text-[10.5px] font-semibold text-green-700">
                        {stat.helper}
                      </span>
                    )}
                  </span>
                  {stat.description && (
                    <span className="text-xs text-neutral-400 whitespace-nowrap">{stat.description}</span>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-3 pb-4">
            <div className="flex items-center gap-2.5">
              <h2 className="text-[12.5px] font-semibold uppercase tracking-[0.05em] text-red-600">
                Chat Agents
              </h2>
              <span className="h-px flex-1 bg-neutral-200" />
            </div>

            <div id="chat-agents-table" className="chat-agents-table overflow-hidden rounded-[14px] border border-neutral-200 bg-white shadow-[0_1px_2px_rgba(0,0,0,.04)]">
            <style>{`
              #chat-agents-table .custom-react-select__control {
                border-radius: 9999px !important;
                border-color: #e5e5e5 !important;
              }
              #chat-agents-table .custom-react-select__control.custom-react-select__control:hover,
              #chat-agents-table .custom-react-select__control.custom-react-select__control--is-focused,
              #chat-agents-table .custom-react-select__control.custom-react-select__control--menu-is-open {
                border-color: #fca5a5 !important;
              }
              #chat-agents-table .custom-react-select__menu {
                border-color: #fecaca !important;
                border-radius: 12px !important;
              }
              #chat-agents-table .custom-react-select__option.custom-react-select__option--is-selected {
                background-color: #dc2626 !important;
              }
              #chat-agents-table .custom-react-select__option.custom-react-select__option--is-focused {
                background-color: #fef2f2 !important;
                color: #111827 !important;
              }
            `}</style>
            <TableManager
              disablePerPageMenuPortal
              tableRef={agentTableRef}
              columns={columns}
              fetcherKey="getChatAgentList"
              fetcherFn={getChatAgentList}
              search={search}
              extraParams={{ filters: tableFilters, date_filters: selectedDateFilters }}
              select={selectTableAgents}
              clientSideSearch={false}
              isHeightSet={false}
              hideFooterRefresh
              recordsPosition="right"
              centerPager
              pagerAccentClassName="border-red-600! text-white! bg-red-600!"
              customHeader={
                <div className="flex flex-col gap-3 py-1 sm:flex-row sm:items-center">
                  <div className="flex h-10 min-w-0 flex-1 items-center gap-2 rounded-full border! border-neutral-200! bg-white! pl-2 pr-3 shadow-[0_1px_2px_rgba(0,0,0,.03)] transition-all focus-within:border-neutral-400! sm:max-w-[320px]">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-red-600">
                      <Search className="h-[18px] w-[18px]" strokeWidth={2.25} />
                    </span>
                    <input
                      value={search}
                      onChange={(event) => setSearch(sanitizeAiSearchText(event.target.value, 50))}
                      placeholder="Search agents by name..."
                      maxLength={50}
                      className="min-w-0 flex-1 border-none bg-transparent text-sm text-neutral-900 outline-none! placeholder:text-neutral-400"
                    />
                  </div>
                  <button
                    type="button"
                    title="Refresh"
                    onClick={async () => {
                      setIsTableRefreshing(true);
                      try {
                        await agentTableRef.current?.refetchTable();
                      } finally {
                        setIsTableRefreshing(false);
                      }
                    }}
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-none! bg-transparent! text-neutral-500! shadow-none! transition-colors hover:text-neutral-900!"
                  >
                    <RefreshCcw className={`h-4 w-4 ${isTableRefreshing ? 'animate-spin' : ''}`} />
                  </button>
                  <div className="relative flex shrink-0 items-center gap-0.5 rounded-full border! border-neutral-200! bg-neutral-100! p-1 sm:ml-auto">
                    <span
                      aria-hidden="true"
                      className="absolute top-1 bottom-1 rounded-full bg-white! shadow-[0_1px_4px_rgba(17,17,17,.18)] border! border-neutral-200! transition-all duration-200 ease-out"
                      style={{
                        left: statusFilter === 'all' ? '4px' : '86px',
                        width: statusFilter === 'all' ? '80px' : '96px',
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => setStatusFilter('all')}
                      className={`relative z-10 flex h-8 w-[80px] shrink-0 items-center justify-center gap-1.5 rounded-full px-5 text-xs font-semibold transition-colors ${
                        statusFilter === 'all'
                          ? 'text-neutral-950!'
                          : 'text-neutral-500! hover:text-red-600!'
                      }`}
                    >
                      All
                      <span
                        className={statusFilter === 'all' ? 'text-neutral-500!' : 'text-neutral-400!'}
                      >
                        {totalAgentsCount}
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setStatusFilter('live')}
                      className={`relative z-10 flex h-8 w-[96px] shrink-0 items-center justify-center gap-1.5 rounded-full px-5 text-xs font-semibold transition-colors ${
                        statusFilter === 'live'
                          ? 'text-neutral-950!'
                          : 'text-neutral-500! hover:text-red-600!'
                      }`}
                    >
                      <span className="relative flex h-1.5 w-1.5 shrink-0">
                        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-neutral-900 opacity-75" />
                        <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-neutral-900" />
                      </span>
                      Live
                      <span
                        className={statusFilter === 'live' ? 'text-neutral-500!' : 'text-neutral-400!'}
                      >
                        {liveAgentsCount}
                      </span>
                    </button>
                  </div>
                </div>
              }
              customClass="!rounded-none !border-0 !shadow-none [&_table]:table-fixed [&_table]:border-separate [&_table]:border-spacing-0 [&_thead]:bg-neutral-50! [&_th]:bg-transparent! [&_th]:overflow-hidden! [&_th]:truncate! [&_th]:whitespace-nowrap! [&_th]:px-[10px]! [&_th]:py-[13px]! [&_th]:text-[12px]! [&_th]:font-bold! [&_th]:uppercase! [&_th]:tracking-[0.04em]! [&_th]:text-neutral-500! [&_th:first-child]:px-[18px]! [&_td:first-child]:px-[18px]! [&_th:first-child]:w-[260px] [&_td:first-child]:w-[260px] [&_th:nth-child(2)]:w-[110px] [&_td:nth-child(2)]:w-[110px] [&_th:nth-child(2)]:text-center! [&_td:nth-child(2)]:text-center! [&_th:nth-child(3)]:w-[190px] [&_td:nth-child(3)]:w-[190px] [&_th:nth-child(3)]:text-center! [&_td:nth-child(3)]:text-center! [&_th:nth-child(4)]:w-[130px] [&_td:nth-child(4)]:w-[130px] [&_th:nth-child(4)]:text-center! [&_td:nth-child(4)]:text-center! [&_th:nth-child(5)]:w-[140px] [&_td:nth-child(5)]:w-[140px] [&_th:nth-child(5)]:text-center! [&_td:nth-child(5)]:text-center! [&_th:nth-child(6)]:w-[150px] [&_td:nth-child(6)]:w-[150px] [&_th:nth-child(6)]:text-center! [&_td:nth-child(6)]:text-center! [&_th:last-child]:w-[110px] [&_td:last-child]:w-[110px] [&_th:last-child]:text-center! [&_td]:bg-transparent! [&_td]:h-auto! [&_td]:min-h-0! [&_td]:px-[18px]! [&_td]:py-2! [&_td]:align-middle"
              loaderTableClass="min-h-[320px]"
              getRowClassName={() => 'bg-white! transition-colors hover:bg-neutral-50!'}
              emptyTablePlaceholder="No chat agents found"
              descriptionEmptyTable="Try a different search or create a new chat agent."
            />
            </div>
          </div>
        </div>
      </section>

      {!!deleteAgent && (
        <AlertConfirm
          apiLoading={isDeletePending}
          onConfirm={async () => {
            mutateDeleteAgent({ agentId: getAgentId(deleteAgent) });
          }}
          open={!!deleteAgent}
          setOpen={() => setDeleteAgent(null)}
        />
      )}

      <PromptModal
        open={promptModalOpen}
        setOpen={setPromptModalOpen}
        data={editData}
        onUpdate={handleUpdatePrompt}
        isUpdating={isUpdatingPrompt}
      />

      <ChatAgentConfigureModal
        open={Boolean(configureAgent)}
        agent={configureAgent}
        initialTokenId={configureTokenId}
        onOpenChange={(open) => {
          if (!open) {
            setConfigureAgent(null);
            setConfigureTokenId('');
          }
        }}
        onSaved={(agent) => setConfigureAgent(agent)}
      />
    </>
  );
}

export default AiChatbotAgents;
