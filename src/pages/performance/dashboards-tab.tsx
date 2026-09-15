import { useContext, useEffect, useMemo, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { SocketEvents } from '@/context/socket-events-context';
import { useUser } from '@/hooks/use-user';
import { campaignList } from '@/services/api';
import buildAgentRows, { AGENT_GROUPS, countAgentGroups } from './agent-rows';
import type { QueueMembership } from './agents-tab';
import { CALL_KINDS, countKinds, kindOf } from './call-kinds';
import { formatSecsToClock } from './format';
import { countInto, makeBucketing } from './time-buckets';
import { PerfNotice } from './perf-surface';
import {
  BarRows,
  ChartKeys,
  DotMatrix,
  MicroColumns,
  ProgressSegments,
  SplitBar,
  StackedColumns,
  type ChartItem,
} from './board-charts';
import { DUMMY_AI_RESULT, DUMMY_CAMPAIGNS } from './dummy-tab-data';

/** Statuses the dialer uses for a campaign that is out dialling right now. */
const RUNNING_CAMPAIGN_STATUSES = ['ACTIVE', 'PROCESSING', 'RUNNING'];

/** The same grading the KPI band and the wallboard put on a service level. */
const SLA_TARGET = 80;
const slaColor = (sla: number | null) => {
  if (sla === null) return 'var(--ink-4)';
  if (sla >= SLA_TARGET) return 'var(--live)';
  if (sla >= 60) return 'var(--warn)';
  return 'var(--crit)';
};

/** Same breach line the KPI band grades its abandon rate on. */
const MISSED_ALERT_PERCENT = 5;
const QUEUE_ROWS = 6;

const percentOf = (part: number, whole: number) => (whole ? Math.round((part / whole) * 100) : 0);
const clockOrDash = (value: number | null | undefined) =>
  value === null || value === undefined ? '—' : formatSecsToClock(value);

const BD_CSS = `
/* ---- banner: the page's statement on one line, with three live readings ---- */
.mcm-page .bd-banner {
  display:flex; align-items:center; flex-wrap:wrap; gap:16px 28px;
  padding:18px 20px; border-radius:16px;
  background:color-mix(in oklab, var(--accent) 6%, var(--surface));
}
.mcm-page .bd-banner-text { flex:1 1 320px; min-width:0; }
.mcm-page .bd-eyebrow {
  display:inline-flex; align-items:center; gap:7px;
  font-size:10px; font-weight:700; letter-spacing:.1em; text-transform:uppercase; color:var(--accent-ink);
}
.mcm-page .bd-eyebrow i { width:6px; height:6px; border-radius:99px; background:var(--accent); }
.mcm-page .bd-banner h2 { margin:6px 0 0; font-size:19px; font-weight:700; letter-spacing:-.025em; color:var(--ink); }
.mcm-page .bd-banner p { margin:3px 0 0; font-size:12.5px; line-height:1.5; color:var(--ink-3); }
.mcm-page .bd-pills { display:flex; flex-wrap:wrap; gap:10px; }
.mcm-page .bd-pill { min-width:148px; padding:10px 14px; border-radius:12px; background:var(--surface); }
.mcm-page .bd-pill-k { font-size:11.5px; color:var(--ink-3); }
.mcm-page .bd-pill-v {
  display:flex; align-items:baseline; gap:6px; margin-top:2px;
  font-size:20px; font-weight:700; letter-spacing:-.02em; color:var(--ink); font-variant-numeric:tabular-nums;
}
.mcm-page .bd-pill-v small { font-size:11.5px; font-weight:500; letter-spacing:0; color:var(--ink-4); }
.mcm-page .bd-track { position:relative; height:4px; margin-top:7px; border-radius:99px; background:color-mix(in oklab, var(--ink) 8%, transparent); }
.mcm-page .bd-track i { position:absolute; inset:0 auto 0 0; border-radius:99px; }
.mcm-page .bd-track b { position:absolute; top:-3px; bottom:-3px; width:2px; margin-left:-1px; border-radius:99px; background:var(--ink-2); }

/* ---- strip: six figures in one panel, divided rather than boxed ---- */
.mcm-page .bd-strip {
  display:grid; grid-template-columns:repeat(6,minmax(0,1fr));
  border-radius:16px; background:var(--surface); box-shadow:var(--pf-e1); overflow:hidden;
}
.mcm-page .bd-fig { min-width:0; padding:14px 16px; border-left:1px solid var(--line-2); }
.mcm-page .bd-fig:first-child { border-left:0; }
@media (max-width:1180px) {
  .mcm-page .bd-strip { grid-template-columns:repeat(3,minmax(0,1fr)); }
  .mcm-page .bd-fig:nth-child(3n+1) { border-left:0; }
  .mcm-page .bd-fig:nth-child(n+4) { border-top:1px solid var(--line-2); }
}
@media (max-width:640px) {
  .mcm-page .bd-strip { grid-template-columns:repeat(2,minmax(0,1fr)); }
  .mcm-page .bd-fig { border-left:0; border-top:1px solid var(--line-2); }
  .mcm-page .bd-fig:nth-child(-n+2) { border-top:0; }
  .mcm-page .bd-fig:nth-child(2n) { border-left:1px solid var(--line-2); }
}
.mcm-page .bd-fig-k { font-size:11.5px; font-weight:600; color:var(--ink-3); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.mcm-page .bd-fig-v {
  margin-top:6px; font-size:24px; font-weight:700; line-height:1.1; letter-spacing:-.03em;
  color:var(--ink); font-variant-numeric:tabular-nums; white-space:nowrap;
}
.mcm-page .bd-fig.is-warn .bd-fig-v { color:var(--warn); }
.mcm-page .bd-fig-d { margin-top:3px; font-size:11.5px; color:var(--ink-4); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }

/* ---- rows of panels ---- */
.mcm-page .bd-mid { display:grid; grid-template-columns:minmax(0,2fr) minmax(290px,1fr); gap:14px; align-items:stretch; }
.mcm-page .bd-low { display:grid; grid-template-columns:minmax(0,1.7fr) minmax(290px,1fr); gap:14px; align-items:stretch; }
@media (max-width:1100px) {
  .mcm-page .bd-mid, .mcm-page .bd-low { grid-template-columns:minmax(0,1fr); }
}
.mcm-page .bd-mid > .pf-panel, .mcm-page .bd-low > .pf-panel { display:flex; flex-direction:column; min-width:0; }
.mcm-page .bd-body { padding:0 18px 16px; }
.mcm-page .bd-body--fill { display:flex; flex:1; flex-direction:column; }
.mcm-page .bd-head-sub { margin:1px 0 0; font-size:11.5px; font-weight:500; color:var(--ink-4); }
.mcm-page .pf-panel-title.is-stacked { flex-direction:column; align-items:flex-start; gap:0; }

/* ---- right now ---- */
.mcm-page .bd-now { display:flex; flex-direction:column; }
.mcm-page .bd-now-part { padding:12px 18px 14px; border-top:1px solid var(--line-2); }
.mcm-page .bd-now-part:first-child { border-top:0; padding-top:0; }
.mcm-page .bd-now-head { display:flex; align-items:baseline; gap:8px; margin-bottom:10px; }
.mcm-page .bd-now-head h4 { display:inline-flex; align-items:center; gap:7px; margin:0; font-size:12.5px; font-weight:600; color:var(--ink-2); }
.mcm-page .bd-now-head span { margin-left:auto; font-size:12px; color:var(--ink-4); font-variant-numeric:tabular-nums; }
.mcm-page .bd-now-head span b { font-weight:700; color:var(--ink); }
.mcm-page .bd-now-note { margin:8px 0 0; font-size:11.5px; color:var(--ink-4); }
.mcm-page .bd-sample {
  flex:none; padding:0 7px; border-radius:99px; background:var(--warn-wash); color:var(--warn);
  font-size:9.5px; font-weight:700; letter-spacing:.06em; line-height:17px; text-transform:uppercase;
}

/* ---- queue leaderboard ---- */
.mcm-page .bd-queues { width:100%; border-collapse:collapse; font-variant-numeric:tabular-nums; }
.mcm-page .bd-queues th {
  padding:8px 10px; border-bottom:1px solid var(--line-2); text-align:right;
  font-size:11px; font-weight:600; color:var(--ink-4); white-space:nowrap;
}
.mcm-page .bd-queues td {
  padding:9px 10px; border-bottom:1px solid var(--line-2); text-align:right;
  font-size:12.5px; color:var(--ink-2); white-space:nowrap;
}
.mcm-page .bd-queues tr:last-child td { border-bottom:0; }
.mcm-page .bd-queues th:first-child, .mcm-page .bd-queues td:first-child { padding-left:18px; text-align:left; }
.mcm-page .bd-queues th:last-child, .mcm-page .bd-queues td:last-child { padding-right:18px; }
.mcm-page .bd-queues tr.is-idle td { color:var(--ink-4); }
.mcm-page .bd-q-name { display:flex; align-items:center; gap:8px; min-width:0; font-weight:600; color:var(--ink); }
.mcm-page .bd-q-rank {
  display:grid; place-items:center; width:20px; height:20px; flex:none; border-radius:6px;
  background:color-mix(in oklab, var(--accent) 9%, var(--surface)); color:var(--accent-ink);
  font-size:10.5px; font-weight:700;
}
.mcm-page .is-idle .bd-q-rank { background:var(--surface-3); color:var(--ink-4); }
.mcm-page .is-idle .bd-q-name { color:var(--ink-3); }
.mcm-page .bd-q-calls { display:inline-flex; align-items:center; justify-content:flex-end; gap:8px; }
.mcm-page .bd-q-calls b { min-width:22px; font-weight:700; color:var(--ink); }
.mcm-page .bd-q-bar { width:70px; height:6px; border-radius:99px; background:color-mix(in oklab, var(--ink) 7%, transparent); overflow:hidden; }
.mcm-page .bd-q-bar i { display:block; height:100%; border-radius:99px; background:var(--accent); }
.mcm-page .bd-q-more { margin:0; padding:10px 18px 14px; font-size:11.5px; color:var(--ink-4); }
.mcm-page .bd-q-scroll { overflow-x:auto; }

/* ---- how calls ended ---- */
.mcm-page .bd-ended { display:flex; flex-wrap:wrap; align-items:center; gap:18px 24px; }
.mcm-page .bd-ended .bd-ended-list { flex:1 1 150px; min-width:150px; }
.mcm-page .bd-ended-list { display:flex; flex-direction:column; gap:8px; margin:0; padding:0; list-style:none; }
.mcm-page .bd-ended-list li { display:flex; align-items:center; gap:8px; font-size:12.5px; color:var(--ink-2); }
.mcm-page .bd-ended-list i { width:10px; height:10px; flex:none; border-radius:3px; }
.mcm-page .bd-ended-list b { margin-left:auto; font-weight:700; color:var(--ink); font-variant-numeric:tabular-nums; }
.mcm-page .bd-ended-list em { width:38px; font-style:normal; text-align:right; color:var(--ink-4); font-variant-numeric:tabular-nums; }
`;

const SamplePill = () => (
  <span className="bd-sample" title="No real data for this yet — these are sample figures">
    Sample
  </span>
);

const Figure = ({
  label,
  value,
  sub,
  warn = false,
  children,
}: {
  label: string;
  value: string;
  sub: string;
  warn?: boolean;
  children?: ReactNode;
}) => (
  <div className={`bd-fig${warn ? ' is-warn' : ''}`}>
    <div className="bd-fig-k">{label}</div>
    <div className="bd-fig-v">{value}</div>
    <div className="bd-fig-d">{sub}</div>
    {children}
  </div>
);

const DashboardsTab = ({
  queues,
  activeQueueCalls,
  usersOnlineStatus,
  agentRows,
  avgSla,
  callStats,
  selectedRange,
  rangePhrase,
}: {
  queues: (QueueMembership & { uuid?: string; name?: string })[];
  activeQueueCalls: any[];
  usersOnlineStatus: any[];
  agentRows: any[];
  /** The live service level the KPI band and wallboard read. */
  avgSla: number | null;
  /** The page's own `usePerformanceCallStats` result, sample flags included. */
  callStats: any;
  selectedRange: { from: string; to: string };
  /** How the selected range reads in a sentence — "today", "yesterday", "in this range". */
  rangePhrase: string;
}) => {
  const { campaignAiLiveCallData, getAiLiveWallboardData, isSocketConnected } =
    useContext(SocketEvents);
  const { user } = useUser();

  const canRefreshAi = Boolean(
    user?.sip_credentials?.domain &&
      user?.company_info?.uuid &&
      user?.user_info?.uuid &&
      isSocketConnected,
  );

  useEffect(() => {
    if (!canRefreshAi) return;
    getAiLiveWallboardData({
      domain: user?.sip_credentials?.domain,
      company_uuid: user?.company_info?.uuid,
      user_uuid: user?.user_info?.uuid,
    });
  }, [canRefreshAi]);

  /* No live AI result on a fresh account falls back to the demo figures — and
     the panel says so, instead of quoting them as the account's own. */
  const liveAi = campaignAiLiveCallData?.data?.result;
  const isAiSample = !liveAi || typeof liveAi !== 'object';
  const ai: any = isAiSample ? DUMMY_AI_RESULT : liveAi;

  const { data: realCampaigns = [], isPending: isCampaignsPending } = useQuery({
    queryKey: ['performanceDashboardCampaignList'],
    queryFn: () => campaignList({ page: 1, limit: 100, filters: [] }),
    select: (res: any) => res?.data?.data?.result?.rows || [],
  });
  const isCampaignSample = !isCampaignsPending && realCampaigns.length === 0;
  const campaigns: any[] = isCampaignSample ? [...DUMMY_CAMPAIGNS] : realCampaigns;
  const runningCampaigns = campaigns.filter((campaign) =>
    RUNNING_CAMPAIGN_STATUSES.includes(String(campaign?.campaignStatus || '').toUpperCase()),
  ).length;

  const isPending = Boolean(callStats?.isSample && callStats?.isRealPending);
  const showCallSample = Boolean(callStats?.isSample && !callStats?.isRealPending);
  const rows: any[] = useMemo(() => callStats?.rows || [], [callStats?.rows]);

  const bucketing = useMemo(() => makeBucketing(selectedRange), [selectedRange]);
  const kinds = useMemo(() => countKinds(rows), [rows]);
  const incoming = kinds.answered + kinds.missed + kinds.voicemail;
  const classified = CALL_KINDS.reduce((sum, kind) => sum + kinds[kind.key], 0);
  const missedShare = percentOf(kinds.missed, incoming);

  /* Which kinds the activity chart stacks — "other" only when there is some. */
  const chartKinds = CALL_KINDS.filter((kind) => kind.key !== 'other' || kinds.other > 0);
  const stacks = useMemo(() => {
    const perKind = Object.fromEntries(
      CALL_KINDS.map((kind) => [kind.key, countInto(bucketing, rows.filter((row) => kindOf(row) === kind.key))]),
    );
    return Array.from({ length: bucketing.size }, (_, index) =>
      Object.fromEntries(CALL_KINDS.map((kind) => [kind.key, perKind[kind.key][index]])),
    );
  }, [bucketing, rows]);
  const totalSeries = useMemo(() => countInto(bucketing, rows), [bucketing, rows]);
  /* A day is drawn from an hour before its first call to an hour after its
     last, and never narrower than eight hours; longer ranges show every day. */
  const chartWindow = useMemo((): [number, number] => {
    const last = bucketing.size - 1;
    if (bucketing.unit !== 'hour') return [0, last];
    const busy = totalSeries.map((value, index) => (value > 0 ? index : -1)).filter((index) => index >= 0);
    if (!busy.length) return [8, 17];
    let start = Math.max(0, busy[0] - 1);
    let end = Math.min(last, busy[busy.length - 1] + 1);
    while (end - start < 7) {
      if (start > 0) start -= 1;
      if (end - start < 7 && end < last) end += 1;
    }
    return [start, end];
  }, [bucketing, totalSeries]);

  /* Queues by the calls they took in the range, from the same call log. */
  const queueRows = useMemo(() => {
    const byQueue = callStats?.byQueueUuid || {};
    return queues
      .map((queue) => {
        const stats = byQueue?.[String(queue.uuid)];
        return {
          key: String(queue.uuid || queue.name),
          name: String(queue.name || 'Queue'),
          total: Number(stats?.total || 0),
          answered: Number(stats?.answered || 0),
          missed: Number(stats?.missed || 0),
          avgWaitSec: stats?.avgWaitSec ?? null,
          avgHandleSec: stats?.avgHandleSec ?? null,
        };
      })
      .sort((a, b) => b.total - a.total || a.name.localeCompare(b.name));
  }, [queues, callStats?.byQueueUuid]);
  const busyQueues = queueRows.filter((queue) => queue.total > 0).length;
  const busiestQueueCalls = queueRows[0]?.total || 0;

  const agentLiveRows = buildAgentRows({ agentRows, queues, usersOnlineStatus, activeQueueCalls });
  const agentCounts = countAgentGroups(agentLiveRows);
  const signedIn = agentLiveRows.length - agentCounts.offline;
  /* Bars, not a colour key: the label says which group, so only the one that
     matters most right now — who is on a call — takes the accent. */
  const AGENT_BAR_COLOR: Record<string, string> = {
    live: 'var(--accent)',
    available: 'var(--ink-2)',
    away: 'color-mix(in oklab, var(--ink) 40%, var(--surface))',
    offline: 'color-mix(in oklab, var(--ink) 18%, var(--surface))',
  };
  const agentItems: ChartItem[] = AGENT_GROUPS.map((group) => ({
    ...group,
    color: AGENT_BAR_COLOR[group.key],
    count: agentCounts[group.key],
  }));

  const containment =
    typeof ai?.ai_containment_percent === 'number' ? Math.round(ai.ai_containment_percent) : null;
  const aiTotal = Number(ai?.total_ai_calls ?? 0) || 0;
  const aiResolved = Number(ai?.ai_receptionist_performance?.handled_ai_only ?? NaN);
  const aiTransferred = Number(ai?.transferred_calls ?? NaN);
  /* Counts when the result carries them; otherwise the bar is drawn from the
     share alone rather than from zeros that contradict it. */
  const aiHasCounts =
    Number.isFinite(aiResolved) && Number.isFinite(aiTransferred) && aiResolved + aiTransferred > 0;
  const aiItems: ChartItem[] = [
    {
      key: 'ai',
      label: 'Resolved by AI',
      color: 'var(--accent)',
      count: !aiTotal ? 0 : aiHasCounts ? aiResolved : (containment ?? 0),
    },
    {
      key: 'human',
      label: 'Handed to a person',
      color: 'color-mix(in oklab, var(--ink) 22%, var(--surface))',
      count: !aiTotal ? 0 : aiHasCounts ? aiTransferred : 100 - (containment ?? 0),
    },
  ];

  const endedItems: ChartItem[] = chartKinds.map((kind) => ({ ...kind, count: kinds[kind.key] }));

  const rangeWord =
    rangePhrase === 'in this range' ? 'Selected range' : rangePhrase === 'today' ? 'Today' : 'Yesterday';
  const unitWord = bucketing.unit;
  const dash = (value: string) => (isPending ? '—' : value);

  return (
    <div className="pf-wrap pf-wrap--dense">
      <style>{BD_CSS}</style>

      <section className="bd-banner">
        <div className="bd-banner-text">
          <span className="bd-eyebrow">
            <i aria-hidden="true" />
            Live overview
          </span>
          <h2>Your contact centre, right now.</h2>
          <p>Queues, people, campaigns and the AI side by side — live where it can be, {rangePhrase} for everything counted.</p>
        </div>
        <div className="bd-pills">
          <div className="bd-pill">
            <div className="bd-pill-k">Service level</div>
            <div className="bd-pill-v">
              {avgSla === null ? '—' : `${Math.round(avgSla)}%`}
              <small>target {SLA_TARGET}%</small>
            </div>
            <div className="bd-track" aria-hidden="true">
              <i style={{ width: `${Math.max(0, Math.min(100, avgSla ?? 0))}%`, background: slaColor(avgSla) }} />
              <b style={{ left: `${SLA_TARGET}%` }} />
            </div>
          </div>
          <div className="bd-pill">
            <div className="bd-pill-k">On calls now</div>
            <div className="bd-pill-v">
              {agentCounts.live}
              <small>of {signedIn} signed in</small>
            </div>
          </div>
          <div className="bd-pill">
            <div className="bd-pill-k">Queues with calls</div>
            <div className="bd-pill-v">
              {dash(String(busyQueues))}
              <small>of {queues.length}</small>
            </div>
          </div>
        </div>
      </section>

      <section className="bd-strip">
        <Figure label="Calls" value={dash(String(classified))} sub={isPending ? rangePhrase : `${incoming} in · ${kinds.outgoing} out`}>
          <MicroColumns series={totalSeries} tone="var(--ink-4)" pending={isPending} />
        </Figure>
        <Figure
          label="Answered"
          value={dash(String(kinds.answered))}
          sub={isPending ? 'of incoming' : incoming ? `${percentOf(kinds.answered, incoming)}% of incoming` : 'no incoming calls'}
        >
          <MicroColumns series={stacks.map((stack) => stack.answered)} tone="var(--accent)" pending={isPending} />
        </Figure>
        <Figure
          label="Missed"
          value={dash(String(kinds.missed))}
          sub={isPending ? 'of incoming' : incoming ? `${missedShare}% of incoming` : 'no incoming calls'}
          warn={!isPending && missedShare > MISSED_ALERT_PERCENT}
        >
          <MicroColumns series={stacks.map((stack) => stack.missed)} tone="var(--ink-2)" pending={isPending} />
        </Figure>
        <Figure label="Avg wait" value={isPending ? '—' : clockOrDash(callStats?.avgWaitSec)} sub="before answer" />
        <Figure label="Avg handle" value={isPending ? '—' : clockOrDash(callStats?.avgHandleSec)} sub="per connected call" />
        <Figure
          label="Spend"
          value={dash(`$${Number(callStats?.totalCharge || 0).toFixed(2)}`)}
          sub={callStats?.isQueueBreakdownSampled ? `most recent ${callStats.sampledRowCount} calls` : `call charges ${rangePhrase}`}
        />
      </section>

      <PerfNotice quiet>
        Live now: service level, agents, campaigns, AI · {rangeWord}: calls, queues, spend and how
        calls ended.
      </PerfNotice>
      {showCallSample && (
        <PerfNotice>
          Showing sample call activity — calls, queues, spend and outcomes are sample figures until
          calls land in this range. Agent presence is real.
        </PerfNotice>
      )}

      <div className="bd-mid">
        <section className="pf-panel">
          <header className="pf-panel-head">
            <div className="pf-panel-title is-stacked">
              <h3>Activity by {unitWord}</h3>
              <p className="bd-head-sub">Calls per {unitWord}, split by how they ended</p>
            </div>
            <ChartKeys kinds={chartKinds} />
          </header>
          <div className="bd-body bd-body--fill">
            <StackedColumns
              stacks={stacks}
              kinds={chartKinds}
              window={chartWindow}
              labelOf={bucketing.labelOf}
              pending={isPending}
              emptyText={`No calls ${rangePhrase}`}
            />
          </div>
        </section>

        <section className="pf-panel">
          <header className="pf-panel-head">
            <div className="pf-panel-title is-stacked">
              <h3>Right now</h3>
              <p className="bd-head-sub">Live across the account</p>
            </div>
          </header>
          <div className="bd-now">
            <div className="bd-now-part">
              <div className="bd-now-head">
                <h4>Agents</h4>
                <span>
                  <b>{signedIn}</b> of {agentLiveRows.length} signed in
                </span>
              </div>
              <BarRows items={agentItems} total={agentLiveRows.length} />
            </div>

            <div className="bd-now-part">
              <div className="bd-now-head">
                <h4>
                  Campaigns
                  {isCampaignSample && <SamplePill />}
                </h4>
                <span>
                  <b>{isCampaignsPending ? '—' : runningCampaigns}</b> of {campaigns.length} running
                </span>
              </div>
              <ProgressSegments total={campaigns.length} on={runningCampaigns} />
            </div>

            <div className="bd-now-part">
              <div className="bd-now-head">
                <h4>
                  AI assistant
                  {isAiSample && <SamplePill />}
                </h4>
                <span>
                  <b>{containment === null ? '—' : `${containment}%`}</b> resolved by AI
                </span>
              </div>
              <SplitBar items={aiItems} />
              <p className="bd-now-note">
                {aiTotal
                  ? aiHasCounts
                    ? `${aiResolved} resolved · ${aiTransferred} handed to a person · ${aiTotal} AI calls`
                    : `${aiTotal} AI calls`
                  : 'No AI calls reported yet'}
              </p>
            </div>
          </div>
        </section>
      </div>

      <div className="bd-low">
        <section className="pf-panel">
          <header className="pf-panel-head">
            <div className="pf-panel-title is-stacked">
              <h3>Queues</h3>
              <p className="bd-head-sub">Busiest first, {rangePhrase}</p>
            </div>
          </header>
          <div className="bd-q-scroll">
            <table className="bd-queues">
              <thead>
                <tr>
                  <th>Queue</th>
                  <th>Calls</th>
                  <th>Answered</th>
                  <th>Missed</th>
                  <th>Avg wait</th>
                  <th>Avg handle</th>
                </tr>
              </thead>
              <tbody>
                {queueRows.slice(0, QUEUE_ROWS).map((queue, index) => {
                  const idle = isPending || !queue.total;
                  return (
                    <tr key={queue.key} className={idle ? 'is-idle' : undefined}>
                      <td>
                        <span className="bd-q-name">
                          <span className="bd-q-rank">{index + 1}</span>
                          {queue.name}
                        </span>
                      </td>
                      <td>
                        <span className="bd-q-calls">
                          <b>{isPending ? '—' : queue.total}</b>
                          <span className="bd-q-bar" aria-hidden="true">
                            <i style={{ width: `${idle || !busiestQueueCalls ? 0 : (queue.total / busiestQueueCalls) * 100}%` }} />
                          </span>
                        </span>
                      </td>
                      <td>{idle ? '—' : `${percentOf(queue.answered, queue.total)}%`}</td>
                      <td>{idle ? '—' : queue.missed}</td>
                      <td>{idle ? '—' : clockOrDash(queue.avgWaitSec)}</td>
                      <td>{idle ? '—' : clockOrDash(queue.avgHandleSec)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {!queues.length && <p className="bd-q-more">No queues on the account yet.</p>}
          {queueRows.length > QUEUE_ROWS && (
            <p className="bd-q-more">
              +{queueRows.length - QUEUE_ROWS} more {queueRows.length - QUEUE_ROWS === 1 ? 'queue' : 'queues'} — see Queues for all of them.
            </p>
          )}
        </section>

        <section className="pf-panel">
          <header className="pf-panel-head">
            <div className="pf-panel-title is-stacked">
              <h3>How calls ended</h3>
              <p className="bd-head-sub">
                {isPending ? 'Each dot is 2% of calls' : `${classified} calls · each dot is 2%`}
              </p>
            </div>
          </header>
          <div className="bd-body bd-ended">
            <DotMatrix items={endedItems} pending={isPending} />
            <ul className="bd-ended-list">
              {endedItems.map((item) => (
                <li key={item.key}>
                  <i style={{ background: item.color }} aria-hidden="true" />
                  {item.label}
                  <b>{isPending ? '—' : item.count}</b>
                  <em>{isPending ? '' : `${percentOf(item.count, classified)}%`}</em>
                </li>
              ))}
            </ul>
          </div>
        </section>
      </div>
    </div>
  );
};

export default DashboardsTab;
