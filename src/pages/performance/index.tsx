import { useMemo, useState, type ReactNode } from 'react';
import { Info } from 'lucide-react';
import { useSearchParamManager } from '@/hooks/use-search-params';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import DateDropdown from '@/components/custom/date-dropdown';
import { DateFilterTypes, handleDate } from '@/components/custom/date-dropdown/constant';
import Timer from '@/components/timer';
import { useLiveContactCentre } from '@/hooks/use-live-contact-centre';
import {
  getMonitoringCallTimestamp,
  isMonitoringCallForForwardValue,
} from '@/pages/monitoring/live-call-helpers';
import QueuesActivityTab from './queues-activity-tab';
import CampaignActivityTab from './campaign-activity-tab';
import AgentsTab from './agents-tab';
import InteractionsTab from './interactions-tab';
import DashboardsTab from './dashboards-tab';
import LiveInteractionsTab from './live-interactions-tab';
import CallbacksTab from './callbacks-tab';
import SpeechTextTab from './speech-text-tab';
import ReportsTab from './reports-tab';
import Wallboard, { type WallboardQueueRow, type WallboardTile } from './wallboard';
import { formatSecsToClock } from './format';
import { useAnimatedNumber } from './use-animated-number';
import '@/components/mcm/mcm-page.css';
import './kpi-card.css';

import LiveDashboard from '@/pages/dashboard/live-dashboard';
import AiWallboard from '@/pages/dashboard/ai-wallboard';
import VideoDashboard from '@/pages/dashboard/video-dashboard';
import CallQueueContent from '@/pages/dashboard/call-dashboard/Call-queue-content';

/**
 * Wallboards used to hang off Home as a second tab strip, which put a "Home"
 * tab inside Home. They are performance surfaces, so they live here — each one
 * still gated on the plan feature that gated it before.
 */
const WALLBOARD_TABS = [
  { key: 'live-wallboard', label: 'Live Wallboard', feature: null },
  { key: 'ai-wallboard', label: 'AI Wallboard', feature: 'ai' },
  { key: 'call-queue', label: 'Call Queue', feature: 'queue' },
  { key: 'video-dashboard', label: 'Video Dashboard', feature: 'video' },
] as const;

const TABS = [
  { key: 'queues-activity', label: 'Queues Activity' },
  { key: 'campaign-activity', label: 'Campaign Activity' },
  { key: 'agents', label: 'Agents' },
  { key: 'interactions', label: 'Interactions' },
  { key: 'dashboards', label: 'Dashboards' },
  { key: 'live-interactions', label: 'Live Interactions' },
  { key: 'callbacks', label: 'Callbacks' },
  { key: 'speech-text', label: 'Speech & Text' },
  { key: 'reports', label: 'Reports' },
];

const SHOW_KPI_HEADER_TABS = new Set(['queues-activity', 'campaign-activity', 'dashboards']);

/**
 * Which figures are live and which follow the date range. It used to sit above
 * the KPI band as body copy, which spent four lines of the page on a caveat;
 * it is now the header infotip, one hover away from the heading it qualifies.
 */
const RANGE_NOTE =
  'Waiting, Longest wait, Service level, On queue agents and Occupancy are live right now. Answered, Abandon rate and Avg handle time cover the selected date range.';

// Maps onto the shared status tokens in mcm-page.css rather than raw colours,
// so the band stays legible in dark mode.
/**
 * On-target is the expected state, so it stays in plain ink — colouring it
 * green as well would leave the band lit end to end and cost the two tones
 * that do mean something their weight.
 */
const KPI_TONE_STYLES: Record<string, string> = {
  default: '',
  success: '',
  warning: 'kpi-card__value--warn',
  danger: 'kpi-card__value--critical',
};

const slaTone = (sla: number | null): 'default' | 'success' | 'warning' | 'danger' => {
  if (sla === null) return 'default';
  if (sla >= 80) return 'success';
  if (sla >= 60) return 'warning';
  return 'danger';
};

/** The KPI band's four-way tone, in the wallboard's three-way vocabulary. */
const WALLBOARD_TONE_BY_KPI_TONE: Record<
  'default' | 'success' | 'warning' | 'danger',
  WallboardTile['tone']
> = {
  default: undefined,
  success: 'good',
  warning: 'warn',
  danger: 'crit',
};

const Performance = () => {
  // The open view lives in the URL, the same `?view=` convention the calendar
  // uses. That makes a Performance view shareable and survive a refresh, and it
  // is what lets the area rail highlight the view you are actually on.
  const { setParam, getParam } = useSearchParamManager();
  const allTabKeys = useMemo(
    () => [...TABS.map((tab) => tab.key), ...WALLBOARD_TABS.map((tab) => tab.key)],
    [],
  );
  const viewParam = getParam('view');
  const activeTab =
    viewParam && allTabKeys.includes(viewParam as string) ? (viewParam as string) : TABS[0].key;
  const setActiveTab = (key: string) => setParam({ view: key });
  const activeTabLabel =
    [...TABS, ...WALLBOARD_TABS].find((tab) => tab.key === activeTab)?.label ?? TABS[0].label;
  const [selectedQueueUuid, setSelectedQueueUuid] = useState<string | null>(null);
  const [isWallboardOpen, setIsWallboardOpen] = useState(false);
  const [dropdownVal, setDropdownVal] = useState(() => ({
    value: handleDate('Today'),
    date_type: 'Today',
    dateOptions: DateFilterTypes,
  }));
  const selectedRange = dropdownVal.value;
  // The band and the heading's infotip describe the same figures, so they
  // appear and disappear together.
  const showKpiBand =
    SHOW_KPI_HEADER_TABS.has(activeTab) && !(activeTab === 'queues-activity' && selectedQueueUuid);

  // Queues, agents and the headline figures come from the shared live hook so
  // Home and Performance can never disagree about them. Everything below is
  // this page's own presentation of them.
  const {
    activeQueueCalls,
    usersOnlineStatus,
    queues,
    agentRows,
    queueStatsByUuid,
    liveSlaByName,
    liveQueueStatsByName,
    waitingCalls,
    longestWaitTimestamp,
    longestWaitSecs,
    totals,
    onlineAgentsCount,
    avgSla,
    avgHandleTime,
    abandonRate,
    occupancy,
    callStats,
    cdrByQueueUuid,
    isCdrSampled,
    isQueuesLoading,
    isAgentsLoading,
  } = useLiveContactCentre(selectedRange);

  const waitingAnimated = useAnimatedNumber(waitingCalls.length);
  const answeredAnimated = useAnimatedNumber(totals.answered);
  const onlineAgentsAnimated = useAnimatedNumber(onlineAgentsCount);
  const slAnimated = useAnimatedNumber(avgSla);
  const abandonAnimated = useAnimatedNumber(abandonRate);
  const ahtAnimated = useAnimatedNumber(avgHandleTime);
  const occupancyAnimated = useAnimatedNumber(occupancy);

  const kpis: {
    label: string;
    value: ReactNode;
    sub?: ReactNode;
    /** Optional pill beside the figure, for a second reading of the same thing. */
    helper?: string;
    tone?: 'default' | 'success' | 'warning' | 'danger';
  }[] = [
    {
      label: 'Waiting',
      value: String(Math.round(waitingAnimated)),
      sub: `across ${queues.length} ${queues.length === 1 ? 'queue' : 'queues'}`,
    },
    {
      label: 'Longest wait',
      value: longestWaitTimestamp ? <Timer startTime={longestWaitTimestamp} /> : '00:00',
      sub:
        longestWaitSecs > 120 ? (
          <span style={{ color: 'var(--crit)' }}>breaching</span>
        ) : (
          'within target'
        ),
    },
    {
      label: 'Service level',
      value: avgSla === null ? '—' : `${Math.round(slAnimated)}%`,
      sub: 'target 80% in 20s',
      tone: slaTone(avgSla),
    },
    {
      label: 'Answered',
      value: String(Math.round(answeredAnimated)),
      sub: `of ${callStats.totalCalls} calls`,
    },
    {
      label: 'Abandon rate',
      value: abandonRate === null ? '—' : `${Math.round(abandonAnimated)}%`,
      sub: abandonRate === null ? undefined : `${callStats.missedCalls} missed`,
      tone: abandonRate !== null && abandonRate > 5 ? 'danger' : 'default',
    },
    {
      label: 'Avg handle time',
      value: avgHandleTime === null ? '—' : formatSecsToClock(ahtAnimated),
      sub: 'per answered call',
    },
    {
      label: 'On queue agents',
      value: String(Math.round(onlineAgentsAnimated)),
      helper: `${agentRows.length} active`,
      sub: 'signed in right now',
    },
    {
      label: 'Occupancy',
      value: occupancy === null ? '—' : `${Math.round(occupancyAnimated)}%`,
      sub: 'target 75–85%',
    },
  ];

  // The wallboard mirrors the KPI band and the live queue table on a dark,
  // room-facing full-screen layout, so it reads from the same live sources.
  const wallboardTiles: WallboardTile[] = [
    {
      key: 'waiting',
      label: 'Waiting',
      value: String(waitingCalls.length),
      warn: waitingCalls.length > 5,
    },
    {
      key: 'longest',
      label: 'Longest wait',
      value: '00:00',
      timerStart: longestWaitTimestamp,
      warn: longestWaitSecs > 120,
    },
    {
      key: 'sl',
      label: 'Service level',
      value: avgSla === null ? '—' : `${Math.round(avgSla)}%`,
      warn: avgSla !== null && avgSla < 80,
      good: avgSla !== null && avgSla >= 80,
      // Graded the same way the KPI band above grades it, so the wall never
      // paints an under-target service level the same red as a real breach.
      tone: WALLBOARD_TONE_BY_KPI_TONE[slaTone(avgSla)],
    },
    { key: 'answered', label: 'Answered today', value: String(totals.answered) },
    {
      key: 'abandon',
      label: 'Abandon rate',
      value: abandonRate === null ? '—' : `${Math.round(abandonRate)}%`,
      warn: abandonRate !== null && abandonRate > 5,
      good: abandonRate !== null && abandonRate <= 5,
    },
    {
      key: 'onqueue',
      label: 'On queue agents',
      value: String(onlineAgentsCount),
    },
  ];

  const wallboardQueues: WallboardQueueRow[] = queues.map((queue: any) => {
    const queueCalls = activeQueueCalls.filter((call: any) =>
      isMonitoringCallForForwardValue(call, queue.uuid),
    );
    const queueWaiting = queueCalls.filter((call: any) => call?.status === 'waiting');
    const queueLongest = queueWaiting.reduce((longest: any, call: any) => {
      if (!longest) return call;
      const callTimestamp = getMonitoringCallTimestamp(call) ?? Infinity;
      const longestTimestamp = getMonitoringCallTimestamp(longest) ?? Infinity;
      return callTimestamp < longestTimestamp ? call : longest;
    }, null);
    const nameKey = String(queue.name || '').toLowerCase();
    const liveStats = liveQueueStatsByName[nameKey];
    const sla = liveSlaByName[nameKey];
    return {
      uuid: queue.uuid,
      name: queue.name,
      waiting: queueWaiting.length,
      longestWaitTimestamp: queueLongest ? getMonitoringCallTimestamp(queueLongest) : null,
      sla: typeof sla === 'number' ? sla : null,
      handledToday: liveStats ? liveStats.totalCalls : null,
    };
  });

  return (
    // `mcm-page` scopes the shared console design system (stat tiles, panels,
    // buttons). PerfStatCard renders `.stat`, which is defined only inside
    // this scope, so without the wrapper every card on every tab loses its
    // styling entirely.
    //
    // Its base rule also swaps in its own typeface, which would leave this
    // page reading differently from the rest of the app — so the font is
    // handed back to the app's own while everything else is kept.
    <section
      className="mcm-page"
      style={
        {
          fontFamily: 'inherit',
          fontSize: 'inherit',
          lineHeight: 'inherit',
          // `--sans` and `--mono` are what the design system's own rules read
          // (`.num` puts every stat value in a monospace face, which turned
          // text values like a queue name into typewriter text). Pointing both
          // at the app's own stack keeps the layout while restoring the
          // typography; `.num` still gets its tabular figures.
          '--sans': 'inherit',
          '--mono': 'inherit',
          // The design system pins the page and scrolls one inner pane, which
          // left the tab content scrolling inside a short box. The whole page
          // scrolls as one instead.
          overflowY: 'auto',
        } as React.CSSProperties
      }
    >
      {/* The header row draws from three sources — the app's own date dropdown,
          the design system's chips and its buttons — each with a different
          control height and border colour, which is what made the row look
          unsettled. This puts them on one baseline. */}
      <style>{`
        /* Performance-only brand override: the console design system's
           --accent is blue (mcm-page.css), but this app is branded Acepeak,
           whose accent is red (#dc2626, from acepeak.com). Overridden here
           rather than in mcm-page.css so the other 30+ pages sharing that
           file keep the original blue. */
        .mcm-page {
          --accent: #dc2626;
          --accent-ink: #b91c1c;
          --accent-wash: #fee2e2;
          --accent-edge: #fecaca;
          /* The body is one flat ground — the KPI band used to sit on its own
             tinted, bottom-bordered strip, which drew a hard line between it
             and the filters below. */
          --ground: #efefef;
        }
        .mcm-page .page-band {
          background: transparent;
          border-bottom: 0;
          padding-bottom: 0;
        }
        .dark .mcm-page {
          --accent: #f87171;
          --accent-ink: #fca5a5;
          --accent-wash: #3a1616;
          --accent-edge: #5c2626;
        }
        /* The header is now identity only — heading, its infotip and the
           breadcrumb trail on the left, status and actions on the right. The
           three filters that used to crowd this row moved into the body. */
        .mcm-page .perf-head {
          display:flex; align-items:flex-start; gap:12px 16px;
          flex-wrap:wrap; padding:13px 0 14px;
        }
        .mcm-page .perf-head-main { min-width:0; }
        .mcm-page .perf-head-title { display:flex; align-items:center; gap:7px; }
        /* The display face, loaded in index.css. Instrument Serif ships one
           weight, so 400 is the regular — never bolded, and the fallback stack
           stays serif so a failed webfont degrades in kind, not to the UI sans. */
        .mcm-page .perf-head-title h1 {
          margin:0;
          font-family:'Instrument Serif', 'Times New Roman', Times, serif;
          font-style:italic; font-weight:400; font-size:27px; line-height:41px;
          letter-spacing:normal; color:var(--ink);
        }
        .mcm-page .perf-infotip {
          display:grid; place-items:center; flex:none; width:20px; height:20px;
          border-radius:99px; color:var(--ink-4);
          transition:color .14s ease, background-color .14s ease;
        }
        .mcm-page .perf-infotip svg { width:14px; height:14px; }
        .mcm-page .perf-infotip:hover,
        .mcm-page .perf-infotip:focus-visible {
          color:var(--accent-ink); background:var(--accent-wash);
        }
        .mcm-page .perf-crumbs {
          display:flex; align-items:center; flex-wrap:wrap; gap:6px;
          margin-top:2px; font-size:11.5px; font-weight:400; color:var(--ink-4);
        }
        .mcm-page .perf-crumbs .sep { color:var(--ink-4); opacity:.7; }
        .mcm-page .perf-crumbs [aria-current] { color:var(--ink-3); font-weight:500; }
        .mcm-page .perf-head-actions {
          display:flex; align-items:center; gap:8px; flex-wrap:wrap;
          margin-left:auto; padding-top:2px;
        }
        .mcm-page .perf-head-actions .fchip,
        .mcm-page .perf-head-actions .btn.sm { height:34px; border-radius:9px; }

        /* The filters, in the body. No strip around them and no "Filters"
           label: the controls already look like controls, so a frame and a
           heading only announced a row that reads perfectly well as itself. */
        .mcm-page .perf-filters {
          display:flex; align-items:center; gap:8px 10px; flex-wrap:wrap;
          margin:14px 22px 0;
        }
        .mcm-page .perf-filters .fchip { height:34px; border-radius:9px; }
        /* the date dropdown ships its own grey border — align it to the tokens */
        .mcm-page .perf-filters input,
        .mcm-page .perf-filters select,
        .mcm-page .perf-filters [role="combobox"] { border-color:var(--line); }
      `}</style>

      <div className="page-bar">
        {/* The views moved into the area rail, the way the console navigates
            Performance — a strip here as well would be a second row of the
            same navigation. The rail links through `?view=`, which is what
            `activeTab` reads. */}
        <div className="perf-head">
          <div className="perf-head-main">
            <div className="perf-head-title">
              <h1>{activeTabLabel}</h1>
              {showKpiBand && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      className="perf-infotip"
                      aria-label="Which figures are live and which follow the date range"
                    >
                      <Info aria-hidden="true" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent
                    side="bottom"
                    align="start"
                    className="max-w-[340px] text-left leading-relaxed"
                  >
                    {RANGE_NOTE}
                  </TooltipContent>
                </Tooltip>
              )}
            </div>
            <nav className="perf-crumbs" aria-label="Breadcrumb">
              <span>Performance</span>
              <span className="sep" aria-hidden="true">
                ›
              </span>
              <span aria-current="page">{activeTabLabel}</span>
            </nav>
          </div>

          <div className="perf-head-actions">
            <span className="fchip live">
              <span className="dot green pulsing" />
              Live — updates every 2s
            </span>
            {/* The page header that used to carry these was removed; keeping
                the actions here so the wallboard stays reachable. */}
            <button type="button" className="btn ghost sm" onClick={() => setIsWallboardOpen(true)}>
              Wallboard
            </button>
            <button
              type="button"
              className="btn primary sm"
              onClick={() => {
                setActiveTab('dashboards');
                setSelectedQueueUuid(null);
              }}
            >
              My dashboards
            </button>
          </div>
        </div>
      </div>

      {showKpiBand && (
        <div className="page-band">
          {/* The shared KPI Overview card (`kpi-card.css`), the same one the
                AI screens use. Eight stats, so `--cols-4` puts them in two
                clean rows rather than a row of five and a stub of three. */}
          <div className="kpi-section-heading">
            <span className="kpi-section-heading__label">Overview</span>
            <span className="kpi-section-heading__rule" />
          </div>
          <div className="kpi-grid kpi-grid--cols-4">
            {kpis.map((kpi) => (
              <div key={kpi.label} className="kpi-card">
                <span className="kpi-card__label">{kpi.label}</span>
                <span className="kpi-card__value-row">
                  <span
                    className={`kpi-card__value ${KPI_TONE_STYLES[kpi.tone || 'default']}`.trim()}
                  >
                    {kpi.value}
                  </span>
                  {kpi.helper && (
                    <span className="kpi-card__helper">
                      <span className="kpi-card__helper-dot" />
                      {kpi.helper}
                    </span>
                  )}
                </span>
                {kpi.sub && <span className="kpi-card__description">{kpi.sub}</span>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* The range and scope filters, out of the header and into the body.
          They apply to every view, so they lead the content rather than
          living inside any one tab. */}
      <div className="perf-filters">
        <DateDropdown dropdownVal={dropdownVal} setDropdownVal={setDropdownVal} />
        <span className="fchip">Division: All</span>
        <span className="fchip">Media: All</span>
      </div>

      {/* Flows in the page's own scroll rather than being a separate scroll pane. */}
      <div style={{ flex: 'none' }}>
        {activeTab === 'queues-activity' && (
          <QueuesActivityTab
            queues={queues}
            activeQueueCalls={activeQueueCalls}
            queueStatsByUuid={queueStatsByUuid}
            liveSlaByName={liveSlaByName}
            liveQueueStatsByName={liveQueueStatsByName}
            cdrByQueueUuid={cdrByQueueUuid}
            cdrRows={callStats.rows}
            isCdrSampled={isCdrSampled}
            usersOnlineStatus={usersOnlineStatus || []}
            isLoading={isQueuesLoading}
            selectedQueueUuid={selectedQueueUuid}
            setSelectedQueueUuid={setSelectedQueueUuid}
          />
        )}
        {activeTab === 'campaign-activity' && <CampaignActivityTab />}
        {activeTab === 'agents' && (
          <AgentsTab
            agentRows={agentRows}
            usersOnlineStatus={usersOnlineStatus || []}
            activeQueueCalls={activeQueueCalls}
            queues={queues}
            isLoading={isAgentsLoading}
          />
        )}
        {activeTab === 'interactions' && <InteractionsTab selectedRange={selectedRange} />}
        {activeTab === 'dashboards' && <DashboardsTab />}
        {activeTab === 'live-interactions' && <LiveInteractionsTab />}
        {activeTab === 'callbacks' && <CallbacksTab />}
        {activeTab === 'speech-text' && <SpeechTextTab />}
        {activeTab === 'reports' && <ReportsTab selectedRange={selectedRange} />}

        {/* The wallboards predate the console language and bring their own
            layout, so they get a plain scroll container. */}
        {activeTab === 'live-wallboard' && (
          <div className="dash-legacy">
            <LiveDashboard selectedRange={selectedRange} />
          </div>
        )}
        {activeTab === 'ai-wallboard' && (
          <div className="dash-legacy">
            <AiWallboard />
          </div>
        )}
        {activeTab === 'call-queue' && (
          <div className="dash-legacy">
            <div className="p-3">
              <CallQueueContent />
            </div>
          </div>
        )}
        {activeTab === 'video-dashboard' && (
          <div className="dash-legacy">
            <VideoDashboard />
          </div>
        )}
      </div>

      {isWallboardOpen && (
        <Wallboard
          tiles={wallboardTiles}
          queues={wallboardQueues}
          onClose={() => setIsWallboardOpen(false)}
        />
      )}
    </section>
  );
};

export default Performance;
