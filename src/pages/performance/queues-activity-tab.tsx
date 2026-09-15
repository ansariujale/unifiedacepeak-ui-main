import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ArrowUpRight, BarChart3, Info, RefreshCw, Users } from 'lucide-react';
import TableManager from '@/components/custom/table-manager';
import Timer from '@/components/timer';
import { isMonitoringCallForMember } from '@/pages/monitoring/live-call-helpers';
import PerfStatCard from './stat-card';
import Sparkline from './sparkline';
import type { QueueCallStats } from '@/hooks/use-call-stats';
import { formatSecsToClock } from './format';
import buildQueueRows from './queue-rows';
import type { QueueRow, QueueStats, LiveQueueStats } from './queue-rows';

export type { QueueRow } from './queue-rows';

const STATUS_STYLES: Record<string, string> = {
  'On Call': 'state busy',
  Available: 'state q',
  Offline: 'state away',
};

/**
 * Calls accumulated across the loaded CDR range, oldest hour first.
 *
 * Cumulative rather than per-hour on purpose. Per-hour counts are the same
 * information, but on a quiet queue they are mostly zeroes with the odd single
 * call between them, which draws a row of spikes that looks like noise and
 * reads like nothing. The running total answers the question the card is
 * actually asking — how the day built up to the figure above it.
 *
 * This is the only history the page holds. The live figures (who is on the
 * roster, who is free, who is on a call right now) are point-in-time reads with
 * nothing behind them, so the cards built on those carry no chart at all rather
 * than a shape that isn't a measurement.
 */
const HOUR_MS = 60 * 60 * 1000;

export const callVolumeSeries = (rows: any[], queueUuid?: string): number[] => {
  if (!Array.isArray(rows) || rows.length === 0) return [];

  const buckets = new Map<number, number>();
  rows.forEach((row) => {
    if (queueUuid && String(row?.queue_uuid || '') !== queueUuid) return;
    const stamp = Date.parse(row?.start_stamp);
    if (Number.isNaN(stamp)) return;
    // Keyed by absolute hour so a range spanning midnight stays in order
    // instead of wrapping back round to 00:00.
    const hour = Math.floor(stamp / HOUR_MS);
    buckets.set(hour, (buckets.get(hour) || 0) + 1);
  });

  if (buckets.size < 2) return [];

  const hours = [...buckets.keys()].sort((a, b) => a - b);
  const series: number[] = [];
  let running = 0;
  for (let hour = hours[0]; hour <= hours[hours.length - 1]; hour += 1) {
    running += buckets.get(hour) || 0;
    series.push(running);
  }
  return series;
};

/** Whole-percent share, guarding the empty day so it reads 0% and not NaN. */
const share = (part: number, whole: number) => (whole > 0 ? Math.round((part / whole) * 100) : 0);

const DONUT_R = 52;
const DONUT_C = 2 * Math.PI * DONUT_R;

/** Mirrors the KPI band's grading so the dot and the console agree. */
const queueTone = (sla: number | null | undefined) => {
  if (sla === null || sla === undefined) return 'muted';
  if (sla >= 80) return 'good';
  if (sla >= 60) return 'warn';
  return 'crit';
};

const getMemberStatus = (member: any, usersOnlineStatus: any[], activeQueueCalls: any[]) => {
  const key = member?.user_uuid || member?.extension || member?.uuid;
  if (!key) return 'Offline';
  if (activeQueueCalls.some((call) => isMonitoringCallForMember(call, key))) return 'On Call';
  const presence = usersOnlineStatus?.find((u: any) => String(u?.userId) === String(key));
  return presence?.online ? 'Available' : 'Offline';
};

/**
 * This tab's own layout, scoped under `.mcm-page` so it reads the console's
 * tokens (and therefore Performance's red accent override) without leaking
 * into the ~30 other pages on the same sheet.
 */
const QA_CSS = `
.mcm-page .qa-wrap { display:flex; flex-direction:column; gap:22px; padding:20px 22px 40px; }

/* ---- the three summaries, side by side ---- */
.mcm-page .qa-mid-grid {
  display:grid; grid-template-columns:minmax(0,1fr) minmax(0,1.25fr) minmax(0,0.95fr);
  gap:18px; align-items:stretch;
}
@media (max-width: 1240px) { .mcm-page .qa-mid-grid { grid-template-columns:minmax(0,1fr) minmax(0,1fr); } }
@media (max-width: 820px) { .mcm-page .qa-mid-grid { grid-template-columns:minmax(0,1fr); } }

.mcm-page .qa-panel { box-shadow:var(--shadow-sm); display:flex; flex-direction:column; }
/* Just the glyph — no tinted chip behind it, so the panel heads read as
   titles with a mark rather than as another piece of card furniture. */
.mcm-page .qa-head-icon {
  display:grid; place-items:center; width:18px; height:18px; flex:none;
  color:var(--accent-ink);
}
.mcm-page .qa-head-icon svg { width:16px; height:16px; }
.mcm-page .qa-head-link {
  margin-left:auto; display:inline-flex; align-items:center; gap:5px;
  font-size:11.5px; font-weight:700; color:var(--accent-ink); cursor:pointer;
}
.mcm-page .qa-head-link svg { width:12px; height:12px; }
.mcm-page .qa-head-link:hover { text-decoration:underline; }
.mcm-page .qa-head-note { margin-left:auto; font-size:11.5px; font-weight:600; color:var(--ink-3); }

/* ---- queue overview (the compact list) ---- */
.mcm-page .qa-mini { padding:4px 18px 16px; overflow-x:auto; }
.mcm-page .qa-mini table { width:100%; border-collapse:collapse; }
.mcm-page .qa-mini th {
  padding:8px 6px; text-align:right; white-space:nowrap;
  font-size:10px; font-weight:700; letter-spacing:.08em; text-transform:uppercase;
  color:var(--ink-4); border-bottom:1px solid var(--line-2);
}
.mcm-page .qa-mini th:first-child, .mcm-page .qa-mini td:first-child { text-align:left; }
.mcm-page .qa-mini td {
  padding:11px 6px; text-align:right; white-space:nowrap;
  font-size:12.5px; font-weight:600; color:var(--ink-2);
  font-variant-numeric:tabular-nums; border-bottom:1px solid var(--line-2);
}
.mcm-page .qa-mini tbody tr:last-child td { border-bottom:0; }
.mcm-page .qa-mini-name {
  display:inline-flex; align-items:center; gap:8px; min-width:0;
  font-size:12.5px; font-weight:700; color:var(--ink); cursor:pointer; text-align:left;
}
.mcm-page .qa-mini-name:hover { color:var(--accent-ink); }
.mcm-page .qa-mini-name i { width:8px; height:8px; border-radius:99px; flex:none; background:currentColor; }
.mcm-page .qa-mini-name.tone-good i { color:var(--live); }
.mcm-page .qa-mini-name.tone-warn i { color:var(--warn); }
.mcm-page .qa-mini-name.tone-crit i { color:var(--crit); }
.mcm-page .qa-mini-name.tone-muted i { color:var(--ink-4); }
.mcm-page .qa-mini-sla { font-weight:700; }
.mcm-page .qa-mini-sla.tone-good { color:var(--live); }
.mcm-page .qa-mini-sla.tone-warn { color:var(--warn); }
.mcm-page .qa-mini-sla.tone-crit { color:var(--crit); }
.mcm-page .qa-mini-sla.tone-muted { color:var(--ink-4); }

/* ---- performance trend ---- */
.mcm-page .qa-trend { display:flex; flex-direction:column; flex:1; padding:10px 18px 18px; }
.mcm-page .qa-trend-art { flex:1; min-height:150px; color:var(--accent); }
.mcm-page .qa-trend-art svg { width:100%; height:100%; display:block; }
.mcm-page .qa-trend-empty {
  flex:1; min-height:150px; display:grid; place-items:center; text-align:center;
  font-size:12px; font-weight:600; color:var(--ink-4);
}
.mcm-page .qa-trend-foot {
  display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:10px;
  padding-top:16px; margin-top:14px; border-top:1px solid var(--line-2);
}
.mcm-page .qa-trend-foot > div { display:flex; flex-direction:column; gap:4px; min-width:0; }
.mcm-page .qa-trend-foot b {
  font-size:21px; font-weight:800; letter-spacing:-.03em; line-height:1;
  font-variant-numeric:tabular-nums; color:var(--ink);
}
.mcm-page .qa-trend-foot b.tone-good { color:var(--live); }
.mcm-page .qa-trend-foot b.tone-warn { color:var(--warn); }
.mcm-page .qa-trend-foot b.tone-crit { color:var(--crit); }
.mcm-page .qa-trend-foot b.tone-muted { color:var(--ink-4); }
.mcm-page .qa-trend-foot span { font-size:11px; font-weight:600; color:var(--ink-3); }

/* ---- agent summary ---- */
.mcm-page .qa-agents {
  display:flex; flex-direction:column; align-items:center; gap:20px;
  padding:18px; flex:1;
}
.mcm-page .qa-donut { position:relative; flex:none; width:148px; height:148px; }
.mcm-page .qa-donut svg { transform:rotate(-90deg); }
.mcm-page .qa-donut-mid {
  position:absolute; inset:0; display:grid; place-content:center; text-align:center;
}
.mcm-page .qa-donut-v {
  font-size:30px; font-weight:800; letter-spacing:-.045em; line-height:1;
  font-variant-numeric:tabular-nums;
}
.mcm-page .qa-donut-k { margin-top:6px; font-size:10.5px; font-weight:600; color:var(--ink-3); }
.mcm-page .qa-agent-keys { display:flex; flex-direction:column; gap:13px; width:100%; }
.mcm-page .qa-agent-keys > div {
  display:flex; align-items:center; gap:10px; font-size:12.5px; font-weight:600;
  color:var(--ink-2);
}
.mcm-page .qa-agent-keys i { width:9px; height:9px; border-radius:99px; flex:none; }
.mcm-page .qa-agent-keys b { margin-left:auto; font-weight:700; font-variant-numeric:tabular-nums; }

/* ---- sample-activity notice ---- */
.mcm-page .qa-banner {
  display:flex; align-items:flex-start; gap:10px; margin:0;
  padding:13px 16px; border-radius:12px;
  background:var(--accent-wash); border:1px solid var(--accent-edge);
  font-size:12.5px; font-weight:600; line-height:1.5; color:var(--accent-ink);
}
.mcm-page .qa-banner svg { width:15px; height:15px; flex:none; margin-top:1px; }

/* ---- the full table ---- */
.mcm-page .qa-table-body { padding:6px 0 0; min-width:0; }
.mcm-page .qa-legend {
  display:flex; align-items:center; justify-content:center; flex-wrap:wrap;
  gap:8px 22px; padding:14px 16px 18px;
}
.mcm-page .qa-legend span {
  display:inline-flex; align-items:center; gap:7px;
  font-size:11.5px; font-weight:600; color:var(--ink-3);
}
.mcm-page .qa-legend i { width:8px; height:8px; border-radius:99px; background:currentColor; }

/* Live status, in the column the queue's media type used to sit in — every
   queue on this account is voice, so the slot was spending a column on a
   constant. The grade is the same one the SLA meter and the row dot read. */
.mcm-page .queues-table .qt-status {
  display:inline-flex; align-items:center; white-space:nowrap;
  padding:4px 10px; border-radius:999px;
  font-size:10.5px; font-weight:800; letter-spacing:.06em; text-transform:uppercase;
}
.mcm-page .queues-table .qt-status.tone-good { background:var(--live-wash,#ecfdf5); color:var(--live); }
.mcm-page .queues-table .qt-status.tone-warn { background:var(--warn-wash,#fffbeb); color:var(--warn); }
.mcm-page .queues-table .qt-status.tone-crit { background:var(--crit-wash,#fef2f2); color:var(--crit); }
.mcm-page .queues-table .qt-status.tone-muted { background:var(--surface-3); color:var(--ink-4); }

/* Interacting carries a utilisation read underneath it — how much of the
   queue's roster is on a call right now, which is the same two numbers the
   cell already shows, drawn. */
.mcm-page .queues-table .qt-util { display:flex; flex-direction:column; gap:5px; align-items:center; }
.mcm-page .queues-table .qt-util-bar {
  position:relative; display:block; width:54px; height:4px;
  border-radius:99px; background:var(--surface-3); overflow:hidden;
}
.mcm-page .queues-table .qt-util-bar i {
  display:block; height:100%; border-radius:99px; background:var(--accent);
}

/* ---- footer ---- */
.mcm-page .qa-foot {
  display:flex; align-items:center; justify-content:center; gap:12px;
  font-size:11.5px; font-weight:600; color:var(--ink-3); padding-top:2px;
}
.mcm-page .qa-foot svg { width:13px; height:13px; }
.mcm-page .qa-foot .sep { width:4px; height:4px; border-radius:99px; background:var(--ink-4); }
`;

const QueuesActivityTab = ({
  queues,
  activeQueueCalls,
  queueStatsByUuid,
  liveSlaByName,
  liveQueueStatsByName,
  cdrByQueueUuid,
  cdrRows,
  isCdrSampled,
  isSampleActivity,
  usersOnlineStatus,
  isLoading,
  selectedQueueUuid,
  setSelectedQueueUuid,
}: {
  queues: QueueRow[];
  activeQueueCalls: any[];
  queueStatsByUuid: Record<string, QueueStats>;
  liveSlaByName: Record<string, number>;
  liveQueueStatsByName: Record<string, LiveQueueStats>;
  cdrByQueueUuid?: Record<string, QueueCallStats>;
  /** Raw CDR rows for the selected range — the source of the cards' history. */
  cdrRows?: any[];
  isCdrSampled?: boolean;
  /** The account has no calls of its own yet, so the volume figures on this
   *  tab are the demo dataset rather than its own history. */
  isSampleActivity?: boolean;
  usersOnlineStatus: any[];
  isLoading: boolean;
  selectedQueueUuid: string | null;
  setSelectedQueueUuid: (uuid: string | null) => void;
}) => {
  const rows = buildQueueRows({
    queues,
    activeQueueCalls,
    queueStatsByUuid,
    liveSlaByName,
    liveQueueStatsByName,
    cdrByQueueUuid,
  });

  const selectedRow = rows.find((row) => row.uuid === selectedQueueUuid) || null;

  const slaRows = rows.filter((row) => row.sla !== null);
  const totalMembers = new Set(rows.flatMap((row) => row.memberKeys)).size;

  // Agent summary counts one agent once, not once per queue: an agent on three
  // queues was getting counted three times by summing each queue's own count.
  const distinctMembersByKey = new Map<string, any>();
  queues.forEach((queue) => {
    (queue.members || []).forEach((member: any) => {
      const key = member?.user_uuid || member?.extension || member?.uuid;
      if (key && !distinctMembersByKey.has(String(key)))
        distinctMembersByKey.set(String(key), member);
    });
  });
  const agentCounts = Array.from(distinctMembersByKey.values()).reduce(
    (acc, member) => {
      const status = getMemberStatus(member, usersOnlineStatus, activeQueueCalls);
      if (status === 'On Call') acc.onCall += 1;
      else if (status === 'Available') acc.onQueue += 1;
      else acc.offline += 1;
      return acc;
    },
    { onQueue: 0, onCall: 0, offline: 0 },
  );
  const totalAgents = distinctMembersByKey.size;
  const totalAvailable = agentCounts.onQueue;
  const agentSlices = [
    { key: 'On queue', value: agentCounts.onQueue, color: 'var(--accent)' },
    { key: 'On call', value: agentCounts.onCall, color: 'var(--accent-ink)' },
    { key: 'Offline', value: agentCounts.offline, color: 'var(--surface-3)' },
  ];

  const totalInteracting = rows.reduce((sum, row) => sum + row.interacting, 0);

  // The headline service level. Averaged across the queues that report one
  // rather than across all queues, so a queue with no calls yet can't drag the
  // figure to zero.
  const avgSla = slaRows.length
    ? slaRows.reduce((sum, row) => sum + (row.sla as number), 0) / slaRows.length
    : null;
  const avgSlaTone = queueTone(avgSla);

  // The trend card's figures are the same CDR the table's volume columns come
  // from, summed across queues — nothing here is derived from anything the call
  // log doesn't already record. Handle time is weighted by each queue's own
  // answered count, so a quiet queue with one long call can't skew the average.
  const totals = rows.reduce(
    (acc, row) => {
      const cdr = cdrByQueueUuid?.[row.uuid];
      if (!cdr) return acc;
      acc.offered += cdr.total;
      acc.handled += cdr.answered;
      acc.abandoned += cdr.missed;
      if (cdr.avgHandleSec !== null && cdr.answered > 0) {
        acc.handleSecs += cdr.avgHandleSec * cdr.answered;
        acc.handleCalls += cdr.answered;
      }
      return acc;
    },
    { offered: 0, handled: 0, abandoned: 0, handleSecs: 0, handleCalls: 0 },
  );
  const avgHandleSec = totals.handleCalls ? totals.handleSecs / totals.handleCalls : null;
  const abandonPct = totals.offered ? share(totals.abandoned, totals.offered) : null;

  /** Calls building through the range, across every queue — the one piece of
   *  history this tab holds, and the only thing the trend card draws. */
  const trendSeries = callVolumeSeries(cdrRows || []);

  const tableRef = useRef<HTMLElement | null>(null);

  // The footer's "last updated" is a real reading, not a decoration: the stamp
  // moves when the live figures move, and the label re-renders on its own so it
  // ages between updates instead of saying "just now" forever.
  const signature = [
    rows.length,
    totalInteracting,
    totalAvailable,
    totalMembers,
    totals.offered,
    totals.handled,
    Math.round(avgSla ?? -1),
  ].join('|');
  const updatedAtRef = useRef(Date.now());
  const [, setClockTick] = useState(0);
  useEffect(() => {
    updatedAtRef.current = Date.now();
    setClockTick((tick) => tick + 1);
  }, [signature]);
  useEffect(() => {
    const id = window.setInterval(() => setClockTick((tick) => tick + 1), 10000);
    return () => window.clearInterval(id);
  }, []);
  const updatedAgoSecs = Math.max(0, Math.round((Date.now() - updatedAtRef.current) / 1000));
  const updatedLabel =
    updatedAgoSecs < 20
      ? 'just now'
      : updatedAgoSecs < 90
        ? `${updatedAgoSecs}s ago`
        : `${Math.round(updatedAgoSecs / 60)}m ago`;

  const columns = [
    {
      header: 'Queue',
      accessorKey: 'name',
      /* The name is the row's anchor, so it carries the most weight and the
         health dot rather than a badge. Left in ink rather than the accent —
         coloured, it read as a hyperlink; the accent arrives on hover, where
         it means "this is clickable". */
      cell: ({ row }: any) => (
        <button
          type="button"
          className={`qt-name tone-${queueTone(row.original.sla)}`}
          onClick={() => setSelectedQueueUuid(row.original.uuid)}
        >
          <i className="qt-dot" aria-hidden="true" />
          {row.original.name}
        </button>
      ),
    },
    {
      /* Every queue on this account is voice, so this slot used to spend a
         column on a constant. It now carries the row's standing, graded on the
         same service level the meter further along the row draws. */
      header: 'Live status',
      accessorKey: 'sla',
      id: 'liveStatus',
      cell: ({ row }: any) => {
        const tone = queueTone(row.original.sla);
        return (
          <span className={`qt-status tone-${tone}`}>
            {tone === 'good'
              ? 'Healthy'
              : tone === 'warn'
                ? 'At risk'
                : tone === 'crit'
                  ? 'Critical'
                  : 'No calls'}
          </span>
        );
      },
    },
    { header: 'Waiting', accessorKey: 'waiting' },
    {
      header: 'Longest',
      accessorKey: 'longestWaitTimestamp',
      cell: ({ row }: any) =>
        row.original.longestWaitTimestamp ? (
          <Timer startTime={row.original.longestWaitTimestamp} />
        ) : (
          '—'
        ),
    },
    { header: 'Members', accessorKey: 'membersCount' },
    {
      header: 'Interacting',
      accessorKey: 'interacting',
      /* The count with its own share of the roster underneath — "2" and "2 of
         3 members busy" are the same reading, and the bar is the one the eye
         catches while scanning the column. */
      cell: ({ row }: any) => {
        const members = row.original.membersCount || 0;
        const pct = members ? Math.min(100, (row.original.interacting / members) * 100) : 0;
        return (
          <span className="qt-util">
            {row.original.interacting}
            <span className="qt-util-bar" aria-hidden="true">
              <i style={{ width: `${pct}%` }} />
            </span>
          </span>
        );
      },
    },
    {
      header: 'Offered',
      accessorKey: 'offered',
      cell: ({ row }: any) => (row.original.offered === null ? '—' : row.original.offered),
    },
    {
      header: 'Handled',
      accessorKey: 'handledToday',
      cell: ({ row }: any) =>
        row.original.handledToday === null || row.original.handledToday === undefined
          ? '—'
          : row.original.handledToday,
    },
    {
      header: 'SL today',
      accessorKey: 'sla',
      /* The one column that earns a graphic: a hairline meter under the figure
         turns "which queue is in trouble" into something you catch without
         reading any of the numbers. It is also the only column allowed colour. */
      cell: ({ row }: any) => {
        if (row.original.sla === null) return <span className="qt-mute">—</span>;
        const pct = Math.round(row.original.sla);
        return (
          <span className={`qt-sla tone-${queueTone(row.original.sla)}`}>
            <span className="qt-sla-v">{pct}%</span>
            <span className="qt-sla-bar">
              <i style={{ width: `${Math.min(100, Math.max(0, pct))}%` }} />
            </span>
          </span>
        );
      },
    },
    {
      header: 'ASA',
      accessorKey: 'asa',
      cell: ({ row }: any) =>
        row.original.asa === null || row.original.asa === undefined ? (
          <span className="qt-mute">—</span>
        ) : (
          <span className="qt-mute">{formatSecsToClock(row.original.asa)}</span>
        ),
    },
    {
      header: 'AHT',
      accessorKey: 'aht',
      cell: ({ row }: any) =>
        row.original.aht === null ? (
          <span className="qt-mute">—</span>
        ) : (
          <span className="qt-mute">{formatSecsToClock(row.original.aht)}</span>
        ),
    },
    { header: 'Abandon', accessorKey: 'abandonRate' },
  ];

  if (selectedRow) {
    const memberRows = (selectedRow.members || []).map((member: any) => ({
      name: member?.name || 'Unknown',
      status: getMemberStatus(member, usersOnlineStatus, activeQueueCalls),
    }));

    const memberColumns = [
      { header: 'Agent', accessorKey: 'name' },
      {
        header: 'Status',
        accessorKey: 'status',
        cell: ({ row }: any) => (
          <span
            className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[row.original.status] || STATUS_STYLES.Offline}`}
          >
            {row.original.status}
          </span>
        ),
      },
    ];

    const detailKpis = [
      { label: 'Waiting', value: String(selectedRow.waiting) },
      {
        label: 'Longest wait',
        value: selectedRow.longestWaitTimestamp ? (
          <Timer startTime={selectedRow.longestWaitTimestamp} />
        ) : (
          '00:00'
        ),
      },
      { label: 'Interacting', value: String(selectedRow.interacting) },
      { label: 'Members', value: String(selectedRow.membersCount) },
      {
        label: 'Handled',
        value:
          selectedRow.handledToday === null || selectedRow.handledToday === undefined
            ? '—'
            : String(selectedRow.handledToday),
      },
      {
        label: 'Service level',
        value: selectedRow.sla === null ? '—' : `${Math.round(selectedRow.sla)}%`,
      },
      {
        label: 'ASA',
        value:
          selectedRow.asa === null || selectedRow.asa === undefined
            ? '—'
            : formatSecsToClock(selectedRow.asa),
      },
      { label: 'Abandon', value: selectedRow.abandonRate },
    ];

    return (
      <div className="flex flex-col gap-3 px-[22px] py-4">
        <div
          className="flex items-center gap-1.5"
          style={{ fontSize: 11.5, color: 'var(--ink-3)' }}
        >
          <button
            type="button"
            onClick={() => setSelectedQueueUuid(null)}
            className="cursor-pointer text-primary hover:underline"
          >
            Queues Activity
          </button>
          <span>›</span>
          <span style={{ fontWeight: 700, color: 'var(--ink-2)' }}>{selectedRow.name}</span>
        </div>
        <h2 style={{ margin: 0, fontSize: 21, fontWeight: 800, letterSpacing: '-.035em' }}>
          {selectedRow.name}
        </h2>

        <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
          {detailKpis.map((kpi) => (
            <PerfStatCard key={kpi.label} label={kpi.label} value={kpi.value} />
          ))}
        </div>

        <div>
          <h3 className="sect-title" style={{ marginBottom: 8 }}>
            Members — live status
          </h3>
          <TableManager
            columns={memberColumns}
            staticData={memberRows}
            showPagination={false}
            emptyTablePlaceholder="No members in this queue"
          />
        </div>
      </div>
    );
  }

  return (
    <div className="qa-wrap">
      <style>{QA_CSS}</style>

      {/* Three reads of the same feed, side by side: the queues as a list, the
          day as a curve, and the roster as a ring. The full table takes the
          whole width beneath them — it has twelve columns and was the one
          thing on the page that could actually use the room. */}
      <div className="qa-mid-grid">
        <section className="panel-card qa-panel">
          <div className="pc-head">
            <h3>Queue overview</h3>
            <button
              type="button"
              className="qa-head-link"
              onClick={() => tableRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
            >
              View all queues
              <ArrowUpRight aria-hidden="true" />
            </button>
          </div>
          <div className="qa-mini">
            <table>
              <thead>
                <tr>
                  <th>Queue</th>
                  <th>Waiting</th>
                  <th>Longest</th>
                  <th>Members</th>
                  <th>SLA</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={5} style={{ textAlign: 'center', color: 'var(--ink-4)' }}>
                      No queues configured
                    </td>
                  </tr>
                )}
                {rows.map((row) => (
                  <tr key={row.uuid}>
                    <td>
                      <button
                        type="button"
                        className={`qa-mini-name tone-${queueTone(row.sla)}`}
                        onClick={() => setSelectedQueueUuid(row.uuid)}
                      >
                        <i aria-hidden="true" />
                        {row.name}
                      </button>
                    </td>
                    <td>{row.waiting}</td>
                    <td>
                      {row.longestWaitTimestamp ? (
                        <Timer startTime={row.longestWaitTimestamp} />
                      ) : (
                        '00:00'
                      )}
                    </td>
                    {/* Free now out of the whole roster — the same two figures
                        the detail view opens on. */}
                    <td>
                      {row.available}/{row.membersCount}
                    </td>
                    <td className={`qa-mini-sla tone-${queueTone(row.sla)}`}>
                      {row.sla === null ? '—' : `${Math.round(row.sla)}%`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="panel-card qa-panel">
          <div className="pc-head">
            <span className="qa-head-icon" aria-hidden="true">
              <BarChart3 />
            </span>
            <h3>Performance trend</h3>
            <span className="qa-head-note">Calls answered, building through the range</span>
          </div>
          <div className="qa-trend">
            {trendSeries.length > 1 ? (
              <div className="qa-trend-art">
                <Sparkline points={trendSeries} tone="var(--accent)" />
              </div>
            ) : (
              <div className="qa-trend-empty">
                Not enough history in this range to draw a trend yet
              </div>
            )}
            <div className="qa-trend-foot">
              <div>
                <b className={`tone-${avgSlaTone}`}>
                  {avgSla === null ? '—' : `${Math.round(avgSla)}%`}
                </b>
                <span>Service level</span>
              </div>
              <div>
                <b>{avgHandleSec === null ? '—' : formatSecsToClock(avgHandleSec)}</b>
                <span>Avg handle time</span>
              </div>
              <div>
                <b>{abandonPct === null ? '—' : `${abandonPct}%`}</b>
                <span>Abandon rate</span>
              </div>
            </div>
          </div>
        </section>

        <section className="panel-card qa-panel">
          <div className="pc-head">
            <span className="qa-head-icon" aria-hidden="true">
              <Users />
            </span>
            <h3>Agent summary</h3>
          </div>
          <div className="qa-agents">
            <div className="qa-donut">
              <svg width="148" height="148" viewBox="0 0 148 148" aria-hidden="true">
                <circle
                  cx="74"
                  cy="74"
                  r={DONUT_R}
                  fill="none"
                  stroke="var(--surface-3)"
                  strokeWidth="14"
                />
                {/* Offsets accumulate so the slices sit end to end; an empty
                    roster draws nothing over the track, which is the honest
                    picture of nobody being signed in. */}
                {totalAgents > 0 &&
                  agentSlices.reduce<{ nodes: ReactNode[]; used: number }>(
                    (acc, slice) => {
                      if (slice.value > 0) {
                        const length = (slice.value / totalAgents) * DONUT_C;
                        acc.nodes.push(
                          <circle
                            key={slice.key}
                            cx="74"
                            cy="74"
                            r={DONUT_R}
                            fill="none"
                            stroke={slice.color}
                            strokeWidth="14"
                            strokeLinecap="butt"
                            strokeDasharray={`${length} ${DONUT_C - length}`}
                            strokeDashoffset={-acc.used}
                          />,
                        );
                        acc.used += length;
                      }
                      return acc;
                    },
                    { nodes: [], used: 0 },
                  ).nodes}
              </svg>
              <div className="qa-donut-mid">
                <div className="qa-donut-v">{totalAgents}</div>
                <div className="qa-donut-k">Total agents</div>
              </div>
            </div>

            <div className="qa-agent-keys">
              {agentSlices.map((slice) => (
                <div key={slice.key}>
                  <i style={{ background: slice.color }} aria-hidden="true" />
                  <span>{slice.key}</span>
                  <b>
                    {slice.value} ({share(slice.value, totalAgents)}%)
                  </b>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>

      {/* The account has no call history of its own yet, so the volume figures
          above and below are the demo dataset. Said out loud rather than left
          for the reader to work out. */}
      {isSampleActivity && (
        <p className="qa-banner">
          <Info aria-hidden="true" />
          Showing sample activity — real figures appear once calls start moving through these
          queues.
        </p>
      )}

      {isCdrSampled && (
        <p className="page-note">
          Offered, Handled, ASA, AHT and Abandon are counted from the most recent 1,000 calls in
          this range — older calls in the range aren't included in these columns.
        </p>
      )}

      <section className="panel-card qa-panel" ref={tableRef}>
        <div className="pc-head">
          <span className="qa-head-icon" aria-hidden="true">
            <BarChart3 />
          </span>
          <h3>Queue Performance</h3>
        </div>
        <div className="qa-table-body">
          <TableManager
            columns={columns}
            staticData={rows}
            loading={isLoading}
            showPagination={false}
            /* Scopes this page's table treatment — TableManager is shared by
                 ~84 screens, so none of it is applied globally. */
            customClass="queues-table"
            emptyTablePlaceholder="No queues configured"
            descriptionEmptyTable="Call queues you create will show live activity here."
          />
        </div>
        {/* A key for the four volume columns, which is what the dots in the
              table's SL meter and the ring on the right are graded against. */}
        <div className="qa-legend">
          <span style={{ color: 'var(--accent)' }}>
            <i aria-hidden="true" />
            <span style={{ color: 'var(--ink-3)' }}>Waiting</span>
          </span>
          <span style={{ color: 'var(--hold)' }}>
            <i aria-hidden="true" />
            <span style={{ color: 'var(--ink-3)' }}>Interacting</span>
          </span>
          <span style={{ color: 'var(--live)' }}>
            <i aria-hidden="true" />
            <span style={{ color: 'var(--ink-3)' }}>Offered</span>
          </span>
          <span style={{ color: 'var(--warn)' }}>
            <i aria-hidden="true" />
            <span style={{ color: 'var(--ink-3)' }}>Handled</span>
          </span>
        </div>
      </section>

      <div className="qa-foot">
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <RefreshCw aria-hidden="true" />
          Last updated: {updatedLabel}
        </span>
        <span className="sep" aria-hidden="true" />
        <span>Auto refresh: On</span>
      </div>
    </div>
  );
};

export default QueuesActivityTab;
