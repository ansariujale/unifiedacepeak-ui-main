import { useMemo, useState } from 'react';
import {
  ArrowDownUp,
  Headphones,
  Hourglass,
  PhoneCall,
  Search,
  Timer as TimerIcon,
  Trophy,
  Unlink,
  UserCheck,
} from 'lucide-react';
import TableManager from '@/components/custom/table-manager';
import Timer from '@/components/timer';
import CustomAvatar from '@/components/custom/custom-avatar';
import buildAgentRows, {
  AGENT_GROUP_OF_STATE,
  AGENT_GROUPS,
  AGENT_STATES,
  type AgentGroupKey,
  type LiveAgentRow,
} from './agent-rows';
import { formatMinutesAsDuration, formatSecsToClock } from './format';
import { PerfHero, PerfNotice, PerfSplit, PerfStat } from './perf-surface';

const STATUS_STYLES: Record<string, string> = {
  'On Call': 'state busy',
  Ringing: 'state acw',
  'On Hold': 'state hold',
  Available: 'state q',
  Busy: 'state acw',
  'Do Not Disturb': 'state nr',
  Offline: 'state away',
};

export type QueueMembership = {
  uuid?: string;
  name?: string;
  memberKeys: string[];
};

/* The four groups come from agent-rows.ts, so Boards' agents ring reads the
   floor exactly the way this page does. */
type GroupKey = AgentGroupKey;
const GROUP_OF_STATE = AGENT_GROUP_OF_STATE;
const GROUPS = AGENT_GROUPS;

/**
 * Scoped under `.mcm-page` so it reads the console's tokens — and Performance's
 * red accent override — without reaching the ~30 other pages on the same sheet.
 */
const AG_CSS = `
/* ---- the roster ---- */
.mcm-page .ag-panel {
  background:var(--surface); border-radius:16px; box-shadow:var(--pf-e1); overflow:hidden;
}
.mcm-page .ag-panel-head {
  display:flex; align-items:center; flex-wrap:wrap; gap:14px 16px; padding:18px 20px 16px;
}
.mcm-page .ag-panel-title { display:flex; align-items:center; gap:10px; min-width:0; }
.mcm-page .ag-panel-title h3 {
  margin:0; font-size:15px; font-weight:700; letter-spacing:-.015em; color:var(--ink);
}
.mcm-page .ag-panel-title span {
  padding:1px 8px; border-radius:99px; background:var(--surface-3);
  font-size:11.5px; font-weight:600; color:var(--ink-3); font-variant-numeric:tabular-nums;
}
.mcm-page .ag-search {
  display:flex; align-items:center; gap:8px; height:38px; width:min(280px,100%);
  padding:0 14px; border-radius:99px; border:1px solid transparent;
  background:color-mix(in oklab, var(--ink) 4%, var(--surface)); color:var(--ink-3); cursor:text;
  transition:border-color .15s ease, background-color .15s ease;
}
.mcm-page .ag-search:focus-within { border-color:var(--ink-4); background:var(--surface); }
.mcm-page .ag-search svg { width:15px; height:15px; flex:none; }
.mcm-page .ag-search input {
  flex:1; min-width:0; height:100%; border:0; outline:0; background:transparent;
  font-size:13px; color:var(--ink);
}
.mcm-page .ag-search input::placeholder { color:var(--ink-4); }

/* The chips are bare <button>s, which the console's own reset strips of border
   and background. The panel and [type] steps lift these rules above it rather
   than leaving them to lose on specificity. */
.mcm-page .ag-chips { flex-basis:100%; display:flex; flex-wrap:wrap; gap:8px; }
.mcm-page .ag-panel .ag-chips button.ag-chip[type='button'] {
  display:inline-flex; align-items:center; gap:8px; height:32px; padding:0 14px;
  border-radius:8px; border:1px solid var(--line); background:var(--surface);
  font-size:12.5px; font-weight:500; color:var(--ink-2); cursor:pointer;
  transition:background-color .15s ease, border-color .15s ease, color .15s ease;
}
.mcm-page .ag-panel .ag-chips button.ag-chip[type='button']:hover {
  background:color-mix(in oklab, var(--ink) 4%, var(--surface));
}
.mcm-page .ag-panel .ag-chips button.ag-chip[type='button'].is-on {
  background:#171717; border-color:#171717; color:#fff;
}
.mcm-page .ag-chip i { width:8px; height:8px; border-radius:2px; flex:none; }
.mcm-page .ag-chip b { font-weight:600; font-variant-numeric:tabular-nums; opacity:.6; }

.mcm-page .agents-table {
  border:0; border-radius:0;
  /* TableManager hard-codes bg-white on its scroll container; a Tailwind
     utility outranks this sheet whatever the specificity. */
  background-color:transparent !important;
}
.mcm-page .agents-table table { font-variant-numeric:tabular-nums; }
.mcm-page .agents-table thead, .mcm-page .agents-table thead tr { background-color:transparent; }
.mcm-page .agents-table th {
  padding:12px 16px; border:0; border-top:1px solid var(--line-2); border-bottom:1px solid var(--line-2);
  background:transparent; color:var(--ink-4);
  font-size:11.5px; font-weight:600; letter-spacing:.01em; text-transform:none; white-space:nowrap;
}
.mcm-page .agents-table td {
  height:60px; padding:0 16px; border:0; border-bottom:1px solid var(--line-2);
  font-size:13px; font-weight:500; color:var(--ink-2); vertical-align:middle; white-space:nowrap;
}
.mcm-page .agents-table tbody tr:last-child td { border-bottom:0; }
.mcm-page .agents-table tbody tr { transition:background-color .14s ease; }
.mcm-page .agents-table tbody tr:hover { background:color-mix(in oklab, var(--ink) 3%, var(--surface)); }
.mcm-page .agents-table th:first-child, .mcm-page .agents-table td:first-child { padding-left:20px; }
.mcm-page .agents-table th:last-child, .mcm-page .agents-table td:last-child { padding-right:20px; }
.mcm-page .agents-table .state::before {
  content:''; width:6px; height:6px; border-radius:99px; background:currentColor; flex:none;
}

.mcm-page .ag-who { display:flex; align-items:center; gap:12px; min-width:0; }
.mcm-page .ag-who-n { display:block; font-size:13.5px; font-weight:600; color:var(--ink); }
.mcm-page .ag-who-x { display:block; margin-top:1px; font-size:11.5px; color:var(--ink-4); }
.mcm-page .ag-mute { color:var(--ink-4); }
.mcm-page .ag-handled { display:flex; align-items:center; gap:10px; min-width:130px; }
.mcm-page .ag-handled b { min-width:24px; font-weight:600; color:var(--ink); text-align:right; }
.mcm-page .ag-handled-bar {
  flex:1; max-width:92px; height:4px; border-radius:99px;
  background:color-mix(in oklab, var(--ink) 8%, transparent); overflow:hidden;
}
.mcm-page .ag-handled-bar i { display:block; height:100%; border-radius:99px; background:var(--accent); }
.mcm-page .ag-noqueue {
  display:inline-flex; align-items:center; padding:2px 9px; border-radius:99px;
  background:var(--warn-wash); color:var(--warn); font-size:11px; font-weight:600;
}
`;

const AgentsTab = ({
  agentRows,
  usersOnlineStatus,
  activeQueueCalls,
  queues,
  isLoading,
  isSampleActivity = false,
  rangePhrase,
}: {
  agentRows: any[];
  usersOnlineStatus: any[];
  activeQueueCalls: any[];
  queues: QueueMembership[];
  isLoading: boolean;
  /** Call figures are the demo dataset, substituted while the account has no history. */
  isSampleActivity?: boolean;
  /** How the selected range reads in a sentence — "today", "yesterday", "in this range". */
  rangePhrase: string;
}) => {
  const [group, setGroup] = useState<GroupKey | 'all'>('all');
  const [search, setSearch] = useState('');

  const rows = buildAgentRows({ agentRows, queues, usersOnlineStatus, activeQueueCalls });
  const isPending = isLoading && !rows.length;

  const groupCounts = rows.reduce(
    (counts, row) => {
      counts[GROUP_OF_STATE[row.status] || 'offline'] += 1;
      return counts;
    },
    { live: 0, available: 0, away: 0, offline: 0 } as Record<GroupKey, number>,
  );

  /* "Signed in" is anyone not offline — which includes an agent on a live call
     whose presence ping hasn't landed yet, rather than calling them away. */
  const signedIn = rows.length - groupCounts.offline;
  const ringingCount = rows.filter((row) => row.status === 'Ringing').length;
  const zeroActivityCount = rows.filter(
    (row) => row.status !== 'Offline' && row.handledToday === 0,
  ).length;
  const noQueueCount = rows.filter((row) => row.queuesCount === 0).length;

  const answeredRows = rows.filter((row) => row.aht !== null && row.handledToday > 0);
  const weightedAhtCalls = answeredRows.reduce((sum, row) => sum + row.handledToday, 0);
  const avgAht = weightedAhtCalls
    ? answeredRows.reduce((sum, row) => sum + (row.aht as number) * row.handledToday, 0) /
      weightedAhtCalls
    : null;
  const totalIncoming = rows.reduce((sum, row) => sum + row.incomingCalls, 0);
  const totalOutgoing = rows.reduce((sum, row) => sum + row.outgoingCalls, 0);
  const totalTalkMinutes = rows.reduce((sum, row) => sum + row.timeOnCallsMinutes, 0);
  const topPerformer = rows.reduce(
    (top: LiveAgentRow | null, row) =>
      row.handledToday > 0 && (!top || row.handledToday > top.handledToday) ? row : top,
    null,
  );
  const maxHandled = rows.reduce((max, row) => Math.max(max, row.handledToday), 0);

  /* The floor read in order — live calls first, then who is free, then who is
     away — and busiest first within each, so the rows that need a supervisor's
     eye are never below the fold. */
  const visibleRows = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return rows
      .filter((row) => group === 'all' || GROUP_OF_STATE[row.status] === group)
      .filter(
        (row) =>
          !needle ||
          row.name.toLowerCase().includes(needle) ||
          String(row.extension || '').includes(needle),
      )
      .sort(
        (a, b) =>
          AGENT_STATES.indexOf(a.status as (typeof AGENT_STATES)[number]) -
            AGENT_STATES.indexOf(b.status as (typeof AGENT_STATES)[number]) ||
          b.handledToday - a.handledToday,
      );
  }, [rows, group, search]);

  const columns = [
    {
      header: 'Agent',
      accessorKey: 'name',
      cell: ({ row }: any) => {
        const data = row.original as LiveAgentRow;
        return (
          <div className="ag-who">
            <CustomAvatar
              name={data.name}
              image={data.image}
              extension={data.extension}
              showPresence
              isActivityInfo={false}
              size="36"
            />
            <span className="min-w-0">
              <span className="ag-who-n">{data.name}</span>
              <span className="ag-who-x">Ext {data.extension || '—'}</span>
            </span>
          </div>
        );
      },
    },
    {
      header: 'Status',
      accessorKey: 'status',
      cell: ({ row }: any) => (
        <span className={STATUS_STYLES[row.original.status] || STATUS_STYLES.Offline}>
          {row.original.status}
        </span>
      ),
    },
    {
      /* Only a live call has a start time to count from. Showing 00:00:00 for
         everyone else claimed they had just changed state. */
      header: 'On this call',
      accessorKey: 'callStart',
      cell: ({ row }: any) =>
        row.original.callStart ? (
          <Timer startTime={row.original.callStart} />
        ) : (
          <span className="ag-mute">—</span>
        ),
    },
    {
      header: 'Queue',
      accessorKey: 'queueOrCampaign',
      cell: ({ row }: any) =>
        row.original.queueOrCampaign && row.original.queueOrCampaign !== '--' ? (
          row.original.queueOrCampaign
        ) : (
          <span className="ag-mute">—</span>
        ),
    },
    {
      header: 'Caller ID',
      accessorKey: 'callerId',
      cell: ({ row }: any) =>
        row.original.callerId && row.original.callerId !== '--' ? (
          row.original.callerId
        ) : (
          <span className="ag-mute">—</span>
        ),
    },
    {
      /* Handled, measured against the busiest agent. This replaced a
         "Utilization" bar that was only ever 100% (on a call this second) or
         0% — a live flag drawn as if it were a rate. */
      header: 'Handled',
      accessorKey: 'handledToday',
      cell: ({ row }: any) => (
        <span className="ag-handled">
          <b>{row.original.handledToday}</b>
          <span className="ag-handled-bar" aria-hidden="true">
            <i
              style={{
                width: `${maxHandled ? (row.original.handledToday / maxHandled) * 100 : 0}%`,
              }}
            />
          </span>
        </span>
      ),
    },
    {
      header: 'AHT',
      accessorKey: 'aht',
      cell: ({ row }: any) =>
        row.original.aht === null ? (
          <span className="ag-mute">—</span>
        ) : (
          formatSecsToClock(row.original.aht)
        ),
    },
    {
      header: 'Talk time',
      accessorKey: 'timeOnCallsMinutes',
      cell: ({ row }: any) => (
        <span className={row.original.timeOnCallsMinutes ? undefined : 'ag-mute'}>
          {formatMinutesAsDuration(row.original.timeOnCallsMinutes)}
        </span>
      ),
    },
    {
      header: 'Queues',
      accessorKey: 'queuesCount',
      cell: ({ row }: any) =>
        row.original.queuesCount ? (
          row.original.queuesCount
        ) : (
          <span className="ag-noqueue" title="Not a member of any queue — can't take queue calls">
            None
          </span>
        ),
    },
  ];

  return (
    <div className="pf-wrap">
      <style>{AG_CSS}</style>

      <div className="pf-band">
        <PerfHero
          eyebrow="Live performance"
          title="Your team, at a glance."
          copy="Track agent availability, handle time and call activity across your team."
        >
          <PerfSplit
            value={isPending ? '—' : String(signedIn)}
            caption={`of ${rows.length} signed in`}
            items={GROUPS.map((item) => ({ ...item, count: groupCounts[item.key] }))}
          />
        </PerfHero>

        <div className="pf-stats">
          <PerfStat
            icon={UserCheck}
            label="Online"
            value={isPending ? '—' : String(signedIn)}
            sub={`of ${rows.length} agents`}
          />
          <PerfStat
            icon={Trophy}
            label="Top performer"
            value={topPerformer ? topPerformer.name : '—'}
            sub={
              topPerformer
                ? `${topPerformer.handledToday} handled ${rangePhrase}`
                : `no calls handled ${rangePhrase}`
            }
          />
          <PerfStat
            icon={PhoneCall}
            label="On a call"
            value={isPending ? '—' : String(groupCounts.live)}
            sub={`of ${signedIn} signed in${ringingCount ? ` · ${ringingCount} ringing` : ''}`}
          />
          <PerfStat
            icon={TimerIcon}
            label="Avg handle time"
            value={avgAht === null ? '—' : formatSecsToClock(avgAht)}
            sub={avgAht === null ? 'no answered calls yet' : 'per answered call'}
          />
          <PerfStat
            icon={Hourglass}
            label="Zero activity"
            value={isPending ? '—' : String(zeroActivityCount)}
            sub={`signed in, none handled ${rangePhrase}`}
          />
          <PerfStat
            icon={ArrowDownUp}
            label="In / out calls"
            value={`${totalIncoming} / ${totalOutgoing}`}
            sub="incoming / outgoing"
          />
          <PerfStat
            icon={Unlink}
            label="No queue assigned"
            value={isPending ? '—' : String(noQueueCount)}
            sub={noQueueCount ? "can't take queue calls" : 'everyone is in a queue'}
            warn={noQueueCount > 0}
          />
          <PerfStat
            icon={Headphones}
            label="Talk time"
            value={formatMinutesAsDuration(totalTalkMinutes)}
            sub={`all agents, ${rangePhrase}`}
          />
        </div>
      </div>

      {/* Sample figures are only ever laid over real agents, so with nobody on
          the account there is nothing sample on screen to warn about. */}
      {isSampleActivity && rows.length > 0 && (
        <PerfNotice>
          Showing sample activity — handled calls, AHT and talk time are sample figures until your
          agents start taking calls. Names and live status are real.
        </PerfNotice>
      )}

      <section className="ag-panel">
        <header className="ag-panel-head">
          <label className="ag-search">
            <Search aria-hidden="true" />
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search name or extension"
              aria-label="Search agents by name or extension"
            />
          </label>
          <div className="ag-panel-title">
            <h3>Agents</h3>
            <span>{visibleRows.length}</span>
          </div>
          <div className="ag-chips" role="group" aria-label="Filter agents by status">
            <button
              type="button"
              className={`ag-chip${group === 'all' ? ' is-on' : ''}`}
              aria-pressed={group === 'all'}
              onClick={() => setGroup('all')}
            >
              All <b>{rows.length}</b>
            </button>
            {GROUPS.map((item) => (
              <button
                key={item.key}
                type="button"
                className={`ag-chip${group === item.key ? ' is-on' : ''}`}
                aria-pressed={group === item.key}
                onClick={() => setGroup(item.key)}
              >
                <i style={{ background: item.color }} aria-hidden="true" />
                {item.label} <b>{groupCounts[item.key]}</b>
              </button>
            ))}
          </div>
        </header>

        <TableManager
          columns={columns}
          staticData={visibleRows}
          loading={isLoading}
          showPagination={false}
          customClass="agents-table"
          emptyTablePlaceholder={rows.length ? 'No agents match' : 'No agents yet'}
          descriptionEmptyTable={
            rows.length
              ? 'Try another status, or clear the search.'
              : 'Agents appear here once people are added to the account.'
          }
        />
      </section>
    </div>
  );
};

export default AgentsTab;
