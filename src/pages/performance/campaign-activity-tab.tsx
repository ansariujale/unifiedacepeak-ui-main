import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import moment, { type Moment } from 'moment';
import {
  CalendarClock,
  Eye,
  MoreHorizontal,
  Pause,
  Play,
  Plus,
  RefreshCw,
  Search,
  SlidersHorizontal,
  Trash2,
  type LucideIcon,
} from 'lucide-react';
import AlertConfirm from '@/components/custom/alert-confirm';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useCompanyFeatures } from '@/hooks/rbac';
import { capitalizeFirstLetter, getInitials, handleAlert } from '@/lib/utils';
import { campaignAnalytics, campaignList, deleteCampaign, playPauseCampaign } from '@/services/api';
import AddEditCampaign from '@/pages/auto-dialer/campaign/add-edit-campaign';
import { DIALER_TYPE } from '@/pages/auto-dialer/campaign/add-edit-campaign/consts';
import AgentDetailsModal from '@/pages/auto-dialer/campaign/modal/agent-details-modal';
import { DIAL_METHOD_LABEL, fmt, pct, readOutcomes } from '@/pages/auto-dialer/campaign/campaign-ui';
import type { ModalState } from '@/pages/auto-dialer/campaign';
import { PerfNotice } from './perf-surface';
import { DUMMY_CAMPAIGNS } from './dummy-tab-data';
import './campaigns.css';

/* ---------------------------------------------------------------------------
   Performance ▸ Campaigns — every outbound campaign, how far it has dialled,
   and what came of it, with the controls to run it.

   Every figure is the platform's own `campaignAnalytics`; nothing here is
   derived beyond adding campaigns together. The row actions are the campaign
   manager's, with its permissions and its rules for when each one applies.
   --------------------------------------------------------------------------- */

type Phase = 'running' | 'paused' | 'scheduled' | 'completed' | 'other';
type PhaseFilter = Phase | 'all';
type OutcomeKey = 'answered' | 'noAnswer' | 'dnc' | 'pending';

type CampaignItem = {
  id: string;
  /** The campaign behind the row; missing on anything that can't be acted on. */
  campaignId: string | null;
  raw: any;
  name: string;
  modeCode: string;
  mode: string;
  status: string;
  phase: Phase;
  created: Moment | null;
  start: Moment | null;
  end: Moment | null;
  isExpired: boolean;
  /** Completed, not started yet, or past its end date — the manager's test for "can't be run now". */
  outOfWindow: boolean;
  outcomes: ReturnType<typeof readOutcomes>;
  members: any[];
  haystack: string;
};

/* The API's own codes, plus the older names the sample data uses. */
const PHASE_OF_STATUS: Record<string, Phase> = {
  PROCESSING: 'running',
  RUNNING: 'running',
  ACTIVE: 'running',
  PAUSE: 'paused',
  PAUSED: 'paused',
  NEW: 'scheduled',
  SCHEDULED: 'scheduled',
  COMPLETED: 'completed',
  COMPLETE: 'completed',
};

const PHASES: { key: Phase; label: string }[] = [
  { key: 'running', label: 'Running' },
  { key: 'paused', label: 'Paused' },
  { key: 'scheduled', label: 'Scheduled' },
  { key: 'completed', label: 'Completed' },
  { key: 'other', label: 'Other' },
];

const MODES: { key: string; label: string }[] = [
  { key: 'all', label: 'All modes' },
  { key: DIALER_TYPE.PREDICTIVE, label: 'Predictive' },
  { key: DIALER_TYPE.NORMAL, label: 'Progressive' },
  { key: DIALER_TYPE.PREVIEW, label: 'Preview' },
];

const OUTCOMES: { key: OutcomeKey; label: string }[] = [
  { key: 'answered', label: 'Answered' },
  { key: 'noAnswer', label: 'No answer' },
  { key: 'dnc', label: 'DNC / blocked' },
  { key: 'pending', label: 'Still to dial' },
];

/** Shares the manager's key prefix, so creating, editing or refreshing a
 *  campaign anywhere refreshes this list too. */
const CAMPAIGNS_KEY = ['getCampaignListForPreview', 'performance'];
const CAMPAIGN_LIMIT = 500;
const ENDING_SOON_DAYS = 3;
const STACK_SIZE = 3;

/* ---- helpers ---- */

const plural = (count: number, one: string, many = `${one}s`) =>
  `${fmt(count)} ${count === 1 ? one : many}`;

const parseMembers = (members: unknown): any[] => {
  try {
    const parsed = typeof members === 'string' ? JSON.parse(members || '[]') : members;
    if (!Array.isArray(parsed)) return [];
    return Array.from(
      new Map(parsed.map((member: any, index: number) => [member?.user_uuid || `member-${index}`, member])).values(),
    );
  } catch {
    return [];
  }
};

const memberName = (member: any) =>
  String(member?.label || `${member?.first_name || ''} ${member?.last_name || ''}`).trim() || 'Unknown';

const dayOffset = (from: Moment, to: Moment) =>
  to.clone().startOf('day').diff(from.clone().startOf('day'), 'days');

const toCampaign = (raw: any, index: number, today: Moment): CampaignItem => {
  const status = String(raw?.campaignStatus || '').toUpperCase();
  const start = raw?.startDate ? moment.utc(raw.startDate).local() : null;
  const end = raw?.endDate ? moment.utc(raw.endDate).local() : null;
  const isExpired = Boolean(end && today.isAfter(end, 'day'));
  const modeCode = String(raw?.dialMethod || '').toUpperCase();
  const members = parseMembers(raw?.members);
  const name = capitalizeFirstLetter(String(raw?.name || '').trim()) || 'Untitled campaign';

  return {
    id: String(raw?._id || `campaign-${index}`),
    campaignId: raw?._id ? String(raw._id) : null,
    raw,
    name,
    modeCode,
    mode: DIAL_METHOD_LABEL[modeCode] || '',
    status,
    phase: PHASE_OF_STATUS[status] || 'other',
    created: raw?.createdAt ? moment.utc(raw.createdAt).local() : null,
    start,
    end,
    isExpired,
    outOfWindow:
      status === 'COMPLETED' || Boolean(start && today.isBefore(start, 'day')) || isExpired,
    outcomes: readOutcomes(raw?.campaignAnalytics),
    members,
    haystack: [name, DIAL_METHOD_LABEL[modeCode], ...members.map(memberName)]
      .filter(Boolean)
      .join(' ')
      .toLowerCase(),
  };
};

/** The date range, and where today sits in it. */
const datesOf = (item: CampaignItem, today: Moment) => {
  if (!item.start && !item.end) return { range: 'No dates set', hint: '', tone: '' };
  const range = [item.start?.format('D MMM'), item.end?.format('D MMM')].filter(Boolean).join(' – ');
  if (item.phase === 'completed') return { range, hint: 'Finished', tone: '' };
  if (item.start && today.isBefore(item.start, 'day')) {
    const days = dayOffset(today, item.start);
    return { range, hint: days === 1 ? 'Starts tomorrow' : `Starts in ${days} days`, tone: '' };
  }
  if (!item.end) return { range, hint: 'No end date', tone: '' };
  const days = dayOffset(today, item.end);
  if (days < 0) return { range, hint: `Ended ${plural(-days, 'day')} ago`, tone: 'late' };
  if (days === 0) return { range, hint: 'Ends today', tone: 'soon' };
  return {
    range,
    hint: days === 1 ? 'Ends tomorrow' : `Ends in ${days} days`,
    tone: days <= ENDING_SOON_DAYS ? 'soon' : '',
  };
};

/** The cached list with one campaign changed — its analytics, or its status. */
const withCampaign = (cached: any, campaignId: string, patch: Record<string, unknown>) => {
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
          rows: result.rows.map((row: any) => (row?._id === campaignId ? { ...row, ...patch } : row)),
        },
      },
    },
  };
};

const listResult = (res: any) => {
  const result = res?.data?.data?.result || {};
  const rows: any[] = Array.isArray(result?.rows) ? result.rows : [];
  const total = Number(result?.totalItems ?? result?.total ?? rows.length) || rows.length;
  return { rows, total };
};

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

const CampaignActivityTab = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { features } = useCompanyFeatures();
  const access = features?.plan_features?.campaign?.action || {};

  const [phaseFilter, setPhaseFilter] = useState<PhaseFilter>('all');
  const [modeFilter, setModeFilter] = useState('all');
  const [query, setQuery] = useState('');
  const [editor, setEditor] = useState<{ open: boolean; campaign: any }>({ open: false, campaign: null });
  const [membersModal, setMembersModal] = useState<ModalState>({ open: false, type: null, data: [] });
  const [toDelete, setToDelete] = useState<CampaignItem | null>(null);
  const [refreshingIds, setRefreshingIds] = useState<string[]>([]);
  const [switchingIds, setSwitchingIds] = useState<string[]>([]);

  const campaignsQuery = useQuery({
    queryKey: CAMPAIGNS_KEY,
    queryFn: () =>
      campaignList({
        page: 1,
        limit: CAMPAIGN_LIMIT,
        filters: [],
        sort: { key: 'createdAt', desc: true },
      }),
    select: listResult,
    refetchInterval: 10000,
  });

  /* An account with no campaigns yet would open on an empty page, so it gets
     samples instead — said so above them, and inert. Never on an error or a
     slow load. */
  const isSample = campaignsQuery.isSuccess && !campaignsQuery.data.rows.length;
  const rows: any[] | undefined = isSample
    ? (DUMMY_CAMPAIGNS as unknown as any[])
    : campaignsQuery.data?.rows;
  const isPending = campaignsQuery.isPending;
  // Windows are read by the day, so the list only needs working out again when the day turns.
  const todayKey = moment().format('YYYY-MM-DD');

  const campaigns = useMemo(() => {
    const today = moment(todayKey, 'YYYY-MM-DD');
    return (rows || []).map((raw, index) => toCampaign(raw, index, today));
  }, [rows, todayKey]);
  const today = moment(todayKey, 'YYYY-MM-DD');

  const phaseCounts = useMemo(() => {
    const counts: Record<PhaseFilter, number> = {
      all: campaigns.length,
      running: 0,
      paused: 0,
      scheduled: 0,
      completed: 0,
      other: 0,
    };
    campaigns.forEach((item) => {
      counts[item.phase] += 1;
    });
    return counts;
  }, [campaigns]);

  const modeCounts = useMemo(() => {
    const counts: Record<string, number> = { all: campaigns.length };
    campaigns.forEach((item) => {
      counts[item.modeCode] = (counts[item.modeCode] || 0) + 1;
    });
    return counts;
  }, [campaigns]);

  const totals = useMemo(() => {
    const sum = { assigned: 0, answered: 0, noAnswer: 0, dnc: 0, pending: 0, dialed: 0, pendingRunning: 0 };
    const allAgents = new Set<string>();
    const runningAgents = new Set<string>();
    let endingSoon = 0;
    campaigns.forEach((item) => {
      sum.assigned += item.outcomes.assigned;
      sum.answered += item.outcomes.answered;
      sum.noAnswer += item.outcomes.noAnswer;
      sum.dnc += item.outcomes.dnc;
      sum.pending += item.outcomes.pending;
      sum.dialed += item.outcomes.dialed;
      item.members.forEach((member, index) => {
        const key = String(member?.user_uuid || `${item.id}-${index}`);
        allAgents.add(key);
        if (item.phase === 'running') runningAgents.add(key);
      });
      if (item.phase === 'running') {
        sum.pendingRunning += item.outcomes.pending;
        const days = item.end ? dayOffset(moment(todayKey, 'YYYY-MM-DD'), item.end) : null;
        if (days !== null && days >= 0 && days <= ENDING_SOON_DAYS) endingSoon += 1;
      }
    });
    return { ...sum, allAgents: allAgents.size, runningAgents: runningAgents.size, endingSoon };
  }, [campaigns, todayKey]);

  const headline = (() => {
    if (!campaigns.length) return 'No campaigns yet.';
    const waiting = [
      phaseCounts.paused ? `${phaseCounts.paused} paused` : '',
      phaseCounts.scheduled ? `${phaseCounts.scheduled} scheduled` : '',
    ].filter(Boolean);
    if (phaseCounts.running) {
      const parts = [`${plural(totals.pendingRunning, 'lead')} still to dial.`];
      if (totals.endingSoon) {
        parts.push(
          `${totals.endingSoon} ${totals.endingSoon === 1 ? 'ends' : 'end'} within ${ENDING_SOON_DAYS} days.`,
        );
      }
      if (waiting.length) parts.push(`Also ${waiting.join(' and ')}.`);
      return parts.join(' ');
    }
    if (waiting.length) return `Nothing is dialling right now; ${waiting.join(' and ')}.`;
    return phaseCounts.completed === campaigns.length
      ? 'Every campaign has finished.'
      : 'Nothing is dialling right now.';
  })();

  /* ---- the list ---- */

  const needle = query.trim().toLowerCase();
  const visible = campaigns.filter(
    (item) =>
      (phaseFilter === 'all' || item.phase === phaseFilter) &&
      (modeFilter === 'all' || item.modeCode === modeFilter) &&
      (!needle || item.haystack.includes(needle)),
  );
  const groups = PHASES.map((phase) => ({
    ...phase,
    items: visible.filter((item) => item.phase === phase.key),
  })).filter((group) => group.items.length);

  /* ---- actions: the campaign manager's, with its rules ---- */

  const invalidateCampaigns = () => {
    queryClient.invalidateQueries({ queryKey: ['getCampaignList'] });
    queryClient.invalidateQueries({ queryKey: ['getCampaignListForPreview'] });
    queryClient.invalidateQueries({ queryKey: ['campaignListForKpis'] });
    queryClient.invalidateQueries({ queryKey: ['performanceDashboardCampaignList'] });
  };

  const { mutate: mutateStatus } = useMutation({
    mutationFn: playPauseCampaign,
    // Start and pause move the row at once; a refusal puts it back.
    onMutate: async (variables: any) => {
      const campaignId = String(variables?.campaignId);
      setSwitchingIds((ids) => [...ids, campaignId]);
      if (variables?.campaignStatus === 'RESCHEDULED') return { previous: undefined };
      await queryClient.cancelQueries({ queryKey: CAMPAIGNS_KEY });
      const previous = queryClient.getQueryData(CAMPAIGNS_KEY);
      queryClient.setQueryData(CAMPAIGNS_KEY, (cached: any) =>
        withCampaign(cached, campaignId, { campaignStatus: variables?.campaignStatus }),
      );
      return { previous };
    },
    onError: (_error, _variables, context) => {
      if (context?.previous) queryClient.setQueryData(CAMPAIGNS_KEY, context.previous);
    },
    onSuccess: (data: any, variables: any, context) => {
      if (data?.status !== 200) {
        if (context?.previous) queryClient.setQueryData(CAMPAIGNS_KEY, context.previous);
        return;
      }
      if (variables?.campaignStatus === 'RESCHEDULED') {
        handleAlert({ text: 'Campaign has been rescheduled successfully', type: 'success' });
      }
    },
    onSettled: (_data, _error, variables: any) => {
      setSwitchingIds((ids) => ids.filter((id) => id !== String(variables?.campaignId)));
      invalidateCampaigns();
    },
  });

  const { mutate: mutateDelete, isPending: isDeleting } = useMutation({
    mutationFn: deleteCampaign,
    onSuccess: (data: any) => {
      if (!data?.data?.success) return;
      handleAlert({ text: data?.data?.message || 'Campaign Deleted Successfully!', type: 'success' });
      setToDelete(null);
      invalidateCampaigns();
    },
  });

  const { mutate: mutateAnalytics } = useMutation({
    mutationFn: campaignAnalytics,
    onSuccess: (response: any, variables) => {
      const analytics = response?.data?.data?.result;
      if (!analytics || !variables?.campaignId) return;
      queryClient.setQueriesData({ queryKey: ['getCampaignListForPreview'] }, (cached: any) =>
        withCampaign(cached, variables.campaignId, { campaignAnalytics: analytics }),
      );
    },
    onSettled: (_data, _error, variables) =>
      setRefreshingIds((ids) => ids.filter((id) => id !== variables?.campaignId)),
  });

  const runOrPause = (item: CampaignItem) => {
    if (isSample || !item.campaignId || item.outOfWindow || switchingIds.includes(item.campaignId)) return;
    mutateStatus({
      campaignId: item.campaignId,
      campaignStatus: item.status === 'PROCESSING' ? 'PAUSE' : 'PROCESSING',
    });
  };

  const refreshAnalytics = (item: CampaignItem) => {
    if (isSample || !item.campaignId || refreshingIds.includes(item.campaignId)) return;
    setRefreshingIds((ids) => [...ids, item.campaignId as string]);
    mutateAnalytics({ campaignId: item.campaignId });
  };

  const openMonitor = (item: CampaignItem) =>
    navigate('/campaign/all-campaigns/compaign-record', {
      state: { campaignDetails: item.raw, campaignId: item.campaignId },
    });

  const openCallLogs = (type: 'ALL' | 'COMPLETED', item: CampaignItem) =>
    navigate('/campaign/all-campaigns/compaign-call-logs', { state: { type, data: item.raw } });

  const canAct = (item: CampaignItem) => !isSample && Boolean(item.campaignId);

  const menuFor = (item: CampaignItem) =>
    [
      access?.summary && {
        key: 'monitor',
        Icon: Eye,
        label: 'Open live monitor',
        run: () => openMonitor(item),
      },
      access?.pause && {
        key: 'reschedule',
        Icon: CalendarClock,
        label: 'Reschedule campaign',
        disabled: !(item.status !== 'COMPLETED' && item.isExpired),
        run: () => mutateStatus({ campaignId: item.campaignId, campaignStatus: 'RESCHEDULED' }),
      },
      access?.edit && {
        key: 'edit',
        Icon: SlidersHorizontal,
        label: 'Edit campaign',
        disabled: item.status === 'PROCESSING' || item.outOfWindow,
        run: () => setEditor({ open: true, campaign: item.raw }),
      },
      access?.delete && {
        key: 'delete',
        Icon: Trash2,
        label: 'Delete campaign',
        disabled: item.status === 'PROCESSING',
        danger: true,
        run: () => setToDelete(item),
      },
    ].filter(Boolean) as {
      key: string;
      Icon: LucideIcon;
      label: string;
      disabled?: boolean;
      danger?: boolean;
      run: () => void;
    }[];

  const listEmpty = () => {
    if (needle) {
      return (
        <Empty
          title="No campaigns match"
          copy={`Nothing matches “${query.trim()}” with these filters.`}
          action={{ label: 'Clear search', onClick: () => setQuery('') }}
        />
      );
    }
    const phaseLabel = PHASES.find((phase) => phase.key === phaseFilter)?.label.toLowerCase();
    return (
      <Empty
        title={phaseLabel ? `Nothing ${phaseLabel}` : 'No campaigns in this mode'}
        copy={
          phaseFilter === 'running'
            ? 'No campaign is dialling right now. Start a paused or scheduled one to see it here.'
            : 'Try another status or dialling mode.'
        }
        action={{
          label: 'Show every campaign',
          onClick: () => {
            setPhaseFilter('all');
            setModeFilter('all');
          },
        }}
      />
    );
  };

  const loaded = campaignsQuery.data?.rows.length || 0;
  const total = campaignsQuery.data?.total || 0;

  return (
    <div className="pf-wrap cg-wrap">
      {/* ---- overview ---- */}
      <section className="pf-overview cg-overview" aria-label="Campaigns at a glance">
        <div className={`pf-overview-lead${phaseCounts.running ? '' : ' is-calm'}`}>
          <p className="pf-eyebrow">
            <i className={phaseCounts.running && !isSample ? 'is-live' : undefined} aria-hidden="true" />
            Outbound
            {isSample && <span className="pf-sample-chip">Sample</span>}
          </p>
          <div className="pf-total">
            <b>{isPending ? '—' : phaseCounts.running}</b>
            <div>
              <strong>{phaseCounts.running === 1 ? 'campaign dialling' : 'campaigns dialling'}</strong>
              <span>
                {isPending
                  ? 'Loading campaigns…'
                  : campaignsQuery.isError
                    ? 'Campaigns couldn’t be loaded.'
                    : headline}
              </span>
            </div>
          </div>
        </div>

        <div className="cg-mix">
          <p className="cg-mix-head">
            Contact outcomes, every campaign
            <b>{isPending ? '—' : plural(totals.assigned, 'lead')}</b>
          </p>
          <div
            className="cg-ribbon"
            role="img"
            aria-label={OUTCOMES.map((outcome) => `${totals[outcome.key]} ${outcome.label.toLowerCase()}`).join(', ')}
          >
            {!isPending &&
              OUTCOMES.filter((outcome) => totals[outcome.key]).map((outcome) => (
                <i
                  key={outcome.key}
                  data-outcome={outcome.key}
                  style={{ flex: `${totals[outcome.key]} 1 0` }}
                />
              ))}
          </div>
          <ul className="cg-keys">
            {OUTCOMES.map((outcome) => (
              <li key={outcome.key} data-outcome={outcome.key}>
                <span>
                  <i aria-hidden="true" />
                  {outcome.label}
                </span>
                <b>{isPending ? '—' : fmt(totals[outcome.key])}</b>
                <em>{totals.assigned ? `${pct(totals[outcome.key], totals.assigned)}%` : ''}</em>
              </li>
            ))}
          </ul>
        </div>

        <dl className="pf-readouts">
          <div>
            <dt>Campaigns</dt>
            <dd>
              {isPending ? '—' : campaigns.length}
              {!isPending && <em>{phaseCounts.completed} completed</em>}
            </dd>
            <small>
              {[
                `${phaseCounts.paused} paused`,
                `${phaseCounts.scheduled} scheduled`,
              ].join(' · ')}
            </small>
          </div>
          <div>
            <dt>Dialled</dt>
            <dd>
              {isPending ? '—' : `${pct(totals.dialed, totals.assigned)}%`}
              {!isPending && <em>of leads</em>}
            </dd>
            <small>
              {totals.assigned
                ? `${fmt(totals.dialed)} of ${fmt(totals.assigned)} leads called`
                : 'No leads assigned yet'}
            </small>
          </div>
          <div>
            <dt>Answer rate</dt>
            <dd>{isPending ? '—' : totals.dialed ? `${pct(totals.answered, totals.dialed)}%` : '—'}</dd>
            <small>
              {totals.dialed ? `${fmt(totals.answered)} answered of ${fmt(totals.dialed)} dialled` : 'Nothing dialled yet'}
            </small>
          </div>
          <div>
            <dt>Agents dialling</dt>
            <dd>
              {isPending ? '—' : totals.runningAgents}
              {!isPending && <em>of {totals.allAgents} assigned</em>}
            </dd>
            <small>
              {totals.allAgents ? 'On the campaigns running now' : 'Nobody is assigned to a campaign'}
            </small>
          </div>
        </dl>
      </section>

      {isSample && (
        <PerfNotice>
          This account has no campaigns yet, so the ones below are samples showing how the page
          reads. They can’t be run or changed{access?.add ? ' — create a real one with New campaign.' : '.'}
        </PerfNotice>
      )}

      {/* ---- filters, search and the one primary action: one row ---- */}
      <div className="pf-toolbar">
        <div className="mcm-segmented" role="group" aria-label="Filter campaigns by status">
          {[{ key: 'all' as const, label: 'All' }, ...PHASES]
            .filter((phase) => phase.key !== 'other' || phaseCounts.other)
            .map((phase) => (
              <button
                key={phase.key}
                type="button"
                aria-pressed={phaseFilter === phase.key}
                className={phaseFilter === phase.key ? 'is-active' : ''}
                onClick={() => setPhaseFilter(phase.key)}
              >
                {phase.label}
                <em>{isPending ? '—' : phaseCounts[phase.key]}</em>
              </button>
            ))}
        </div>
        <div className="mcm-segmented" role="group" aria-label="Filter campaigns by dialling mode">
          {MODES.map((mode) => (
            <button
              key={mode.key}
              type="button"
              aria-pressed={modeFilter === mode.key}
              className={modeFilter === mode.key ? 'is-active' : ''}
              onClick={() => setModeFilter(mode.key)}
            >
              {mode.label}
              {mode.key !== 'all' && <em>{isPending ? '—' : modeCounts[mode.key] || 0}</em>}
            </button>
          ))}
        </div>
        <label className="pf-search pf-toolbar-search">
          <Search aria-hidden="true" />
          <input
            type="search"
            value={query}
            maxLength={50}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search campaigns or agents"
            aria-label="Search campaigns"
          />
        </label>
        {access?.add && (
          <button type="button" className="cg-new" onClick={() => setEditor({ open: true, campaign: null })}>
            <Plus aria-hidden="true" />
            New campaign
          </button>
        )}
      </div>

      <section className="pf-list" aria-label="Campaigns">
        <div className="pf-list-cols cg-cols" aria-hidden="true">
          <span>Campaign</span>
          <span className="cg-col-dates">Dates</span>
          <span>Progress</span>
          <span>Leads</span>
          <span>Answered</span>
          <span className="cg-col-agents">Agents</span>
          <span />
        </div>

        {isPending ? (
          <ul className="pf-rows" aria-label="Loading">
            {[0, 1, 2].map((row) => (
              <li key={row} className="pf-list-row cg-row pf-skel" aria-hidden="true">
                <i />
                <i />
                <i />
                <i />
                <i />
                <i />
                <i />
              </li>
            ))}
          </ul>
        ) : campaignsQuery.isError ? (
          <Empty
            title="Campaigns couldn’t be loaded"
            copy="The campaign list didn’t come back. It will try again on its own, or you can try now."
            action={{ label: 'Try again', onClick: () => campaignsQuery.refetch() }}
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
                  const dates = datesOf(item, today);
                  const { assigned, answered, noAnswer, dnc, pending, dialed } = item.outcomes;
                  const actionable = canAct(item);
                  const isSwitching = Boolean(item.campaignId && switchingIds.includes(item.campaignId));
                  const isRefreshing = Boolean(item.campaignId && refreshingIds.includes(item.campaignId));
                  const menu = actionable ? menuFor(item) : [];
                  const showRun = Boolean(access?.pause) && item.phase !== 'completed';
                  const runLabel =
                    item.phase === 'running' ? 'Pause' : item.phase === 'paused' ? 'Resume' : 'Start';
                  return (
                    <li key={item.id} className="pf-list-row cg-row" data-phase={item.phase}>
                      <div className="cg-name">
                        <span className="cg-mark" aria-hidden="true" />
                        <div className="cg-name-text">
                          <div className="cg-title">
                            {actionable && access?.summary ? (
                              <button
                                type="button"
                                className="cg-title-link"
                                title={`Open the live monitor for ${item.name}`}
                                onClick={() => openMonitor(item)}
                              >
                                {item.name}
                              </button>
                            ) : (
                              <b title={item.name}>{item.name}</b>
                            )}
                            {item.mode && <span className="cg-tag">{item.mode}</span>}
                          </div>
                          <small>
                            {item.created ? `Created ${item.created.format('D MMM YYYY')}` : ' '}
                          </small>
                        </div>
                      </div>

                      <div className="cg-dates">
                        <b>{dates.range}</b>
                        {dates.hint && (
                          <small className={dates.tone ? `is-${dates.tone}` : undefined}>{dates.hint}</small>
                        )}
                      </div>

                      <div className="cg-progress">
                        {assigned ? (
                          <span
                            className="cg-bar"
                            role="img"
                            aria-label={`${fmt(answered)} answered, ${fmt(noAnswer)} no answer, ${fmt(dnc)} DNC, ${fmt(pending)} still to dial`}
                            title={`${fmt(answered)} answered · ${fmt(noAnswer)} no answer · ${fmt(dnc)} DNC · ${fmt(pending)} still to dial`}
                          >
                            {(['answered', 'noAnswer', 'dnc'] as const)
                              .filter((key) => item.outcomes[key])
                              .map((key) => (
                                <i
                                  key={key}
                                  data-outcome={key}
                                  style={{ width: `${(item.outcomes[key] / assigned) * 100}%` }}
                                />
                              ))}
                          </span>
                        ) : null}
                        <div className="cg-progress-foot">
                          {assigned ? (
                            <span>
                              <b>{pct(dialed, assigned)}%</b> dialled
                            </span>
                          ) : (
                            <span>No leads assigned</span>
                          )}
                          <button
                            type="button"
                            className={`cg-refresh${isRefreshing ? ' is-spinning' : ''}`}
                            aria-label={`Refresh the figures for ${item.name}`}
                            data-tip={isSample ? 'Sample' : 'Refresh figures'}
                            aria-disabled={!actionable || isRefreshing}
                            onClick={() => refreshAnalytics(item)}
                          >
                            <RefreshCw aria-hidden="true" />
                          </button>
                        </div>
                      </div>

                      <div className="cg-figure">
                        {assigned && actionable ? (
                          <button
                            type="button"
                            className="cg-figure-link"
                            title="See every call in this campaign"
                            onClick={() => openCallLogs('ALL', item)}
                          >
                            {fmt(assigned)}
                          </button>
                        ) : (
                          <b>{assigned ? fmt(assigned) : '—'}</b>
                        )}
                        <small>{assigned ? `${fmt(pending)} left` : 'No leads'}</small>
                      </div>

                      <div className="cg-figure">
                        {dialed && actionable ? (
                          <button
                            type="button"
                            className="cg-figure-link"
                            title="See the answered calls"
                            onClick={() => openCallLogs('COMPLETED', item)}
                          >
                            {pct(answered, dialed)}%
                          </button>
                        ) : (
                          <b>{dialed ? `${pct(answered, dialed)}%` : '—'}</b>
                        )}
                        <small>{dialed ? `${fmt(answered)} answered` : 'Not dialled'}</small>
                      </div>

                      {item.members.length ? (
                        <button
                          type="button"
                          className="cg-agents"
                          title={item.members.map(memberName).join(', ')}
                          aria-disabled={!actionable}
                          onClick={() =>
                            actionable &&
                            setMembersModal({ open: true, type: 'members', data: item.members })
                          }
                        >
                          <span className="cg-stack" aria-hidden="true">
                            {item.members.slice(0, STACK_SIZE).map((member, index) => (
                              <i key={member?.user_uuid || index}>{getInitials(memberName(member))}</i>
                            ))}
                          </span>
                          <span className="cg-agents-count">
                            {item.members.length} {item.members.length === 1 ? 'agent' : 'agents'}
                          </span>
                        </button>
                      ) : (
                        <span className="cg-agents cg-muted">Unassigned</span>
                      )}

                      <div className="cg-act">
                        {showRun && (
                          <button
                            type="button"
                            className={`cg-run${item.phase === 'running' ? ' is-pause' : ''}`}
                            disabled={!actionable || item.outOfWindow || isSwitching}
                            title={
                              isSample
                                ? 'Sample campaign'
                                : item.outOfWindow
                                  ? 'Outside the campaign’s dates'
                                  : `${runLabel} ${item.name}`
                            }
                            aria-label={`${runLabel} ${item.name}`}
                            onClick={() => runOrPause(item)}
                          >
                            {item.phase === 'running' ? <Pause aria-hidden="true" /> : <Play aria-hidden="true" />}
                            <span className="cg-run-label">{runLabel}</span>
                          </button>
                        )}
                        {menu.length > 0 && (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <button type="button" className="cg-more" aria-label={`More for ${item.name}`}>
                                <MoreHorizontal aria-hidden="true" />
                              </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" sideOffset={6} className="cg-menu">
                              {menu.map((entry) => (
                                <DropdownMenuItem
                                  key={entry.key}
                                  disabled={entry.disabled}
                                  variant={entry.danger ? 'destructive' : 'default'}
                                  onSelect={entry.run}
                                >
                                  <entry.Icon />
                                  {entry.label}
                                </DropdownMenuItem>
                              ))}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))
        ) : (
          listEmpty()
        )}

        {!isPending && !campaignsQuery.isError && (
          <footer className="pf-list-foot">
            <span>
              {!isSample && total > loaded
                ? `Showing the latest ${loaded} of ${fmt(total)} campaigns.`
                : 'Figures refresh every few seconds while campaigns dial.'}
            </span>
            <span className="pf-list-foot-links">
              <button type="button" className="pf-text-btn" onClick={() => navigate('/campaign/leads')}>
                Lead groups
              </button>
              <button type="button" className="pf-text-btn" onClick={() => navigate('/campaign/all-campaigns')}>
                Open the campaign manager
              </button>
            </span>
          </footer>
        )}
      </section>

      {/* The manager's own form, members list and delete confirmation. */}
      <Dialog
        open={editor.open}
        onOpenChange={(open) => {
          if (!open) setEditor({ open: false, campaign: null });
        }}
      >
        <DialogContent className="acp-modal" showCloseButton={false}>
          <AddEditCampaign
            drawerState={editor.open}
            setDrawerState={() => setEditor({ open: false, campaign: null })}
            selectedCampaign={editor.campaign}
          />
        </DialogContent>
      </Dialog>

      {membersModal.open && <AgentDetailsModal modalState={membersModal} setModalState={setMembersModal} />}

      {!!toDelete && (
        <AlertConfirm
          apiLoading={isDeleting}
          onConfirm={() => toDelete?.campaignId && mutateDelete(toDelete.campaignId)}
          open={!!toDelete}
          setOpen={() => setToDelete(null)}
        />
      )}
    </div>
  );
};

export default CampaignActivityTab;
