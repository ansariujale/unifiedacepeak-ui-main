import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Activity, BarChart3, CalendarDays, RefreshCw } from 'lucide-react';
import TableManager from '@/components/custom/table-manager';
import Timer from '@/components/timer';
import { isMonitoringCallForMember } from '@/pages/monitoring/live-call-helpers';
import PerfStatCard from './stat-card';
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

const callVolumeSeries = (rows: any[], queueUuid?: string): number[] => {
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

/**
 * The hero's background curve, drawn from the same cumulative series the cards
 * use. It is a chart, not decoration — so when there is no history behind it
 * (fewer than two hours of calls in the range) the hero simply has no curve.
 *
 * The path is emitted in a 0..1 space and stretched by the SVG, which is what
 * lets the marker be positioned in plain percentages on top of it.
 */
const buildHeroWave = (points: number[]) => {
  if (!points || points.length < 2) return null;

  const peak = Math.max(...points, 1);
  // Kept off the floor and off the ceiling so the curve reads as a band of
  // movement across the card rather than a graph clipped by its own box.
  const coords = points.map((value, index) => ({
    x: index / (points.length - 1),
    y: 0.88 - (value / peak) * 0.62,
  }));

  let d = `M${coords[0].x.toFixed(4)},${coords[0].y.toFixed(4)}`;
  for (let i = 0; i < coords.length - 1; i += 1) {
    const from = coords[i];
    const to = coords[i + 1];
    const midX = (from.x + to.x) / 2;
    d += ` C${midX.toFixed(4)},${from.y.toFixed(4)} ${midX.toFixed(4)},${to.y.toFixed(4)} ${to.x.toFixed(4)},${to.y.toFixed(4)}`;
  }

  const last = coords[coords.length - 1];
  return { d, markerX: last.x, markerY: last.y };
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
.mcm-page .qa-wrap { display:flex; flex-direction:column; gap:16px; padding:16px 22px 26px; }

/* ---- hero ---- */
.mcm-page .qa-hero {
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: var(--r-lg);
  box-shadow: var(--shadow-sm);
  overflow: hidden;
  /* Column, so the stat strip stays on the floor of the card while the top
     block takes up the slack when the panel beside it is the taller of the two. */
  display: flex;
  flex-direction: column;
}
.mcm-page .qa-hero-top {
  position: relative;
  display: grid;
  grid-template-columns: minmax(0,1fr) minmax(70px,0.55fr) minmax(0,auto);
  align-items: center;
  gap: 18px;
  padding: 20px 22px 22px;
  flex: 1;
}
.mcm-page .qa-eyebrow {
  display:block; font-size:10.5px; font-weight:800; letter-spacing:.11em;
  text-transform:uppercase; color:var(--ink-4);
}
.mcm-page .qa-hero-name {
  margin: 7px 0 0;
  font-size: clamp(26px, 2.4vw, 36px);
  font-weight: 800;
  letter-spacing: -.045em;
  line-height: 1.02;
  color: var(--ink);
  overflow-wrap: anywhere;
}
.mcm-page .qa-hero-meta {
  display:flex; align-items:center; gap:8px; margin-top:9px;
  font-size:13px; font-weight:600; color:var(--ink-3);
}
.mcm-page .qa-hero-meta i {
  width:9px; height:9px; border-radius:99px; background:var(--accent); flex:none;
}

/* the curve sits behind the whole row, the marker rides its last point */
/* The right inset keeps the marker's outer ring off the service-level block,
   which the curve otherwise runs straight into at its last point. No
   min-height: the row is sized by the text beside it, so a queue with no
   history to plot doesn't hold the card open around an empty column. */
.mcm-page .qa-hero-art { position:relative; align-self:stretch; margin-right:24px; }
.mcm-page .qa-hero-wave {
  position:absolute; inset:0; width:100%; height:100%;
  color: var(--accent); opacity:.5; pointer-events:none;
}
.mcm-page .qa-hero-pulse {
  position:absolute; width:12px; height:12px; margin:-6px 0 0 -6px;
  border-radius:99px; background:var(--accent); pointer-events:none;
}
.mcm-page .qa-hero-pulse::before,
.mcm-page .qa-hero-pulse::after {
  content:''; position:absolute; inset:-16px; border-radius:99px;
  border:1px solid var(--accent); opacity:.28;
}
.mcm-page .qa-hero-pulse::after { inset:-34px; opacity:.14; }
@media (prefers-reduced-motion: no-preference) {
  .mcm-page .qa-hero-pulse::before { animation: qa-pulse 2.8s ease-out infinite; }
  .mcm-page .qa-hero-pulse::after  { animation: qa-pulse 2.8s ease-out .6s infinite; }
}
@keyframes qa-pulse {
  0%   { transform: scale(.55); opacity:.42; }
  70%  { opacity:.06; }
  100% { transform: scale(1.15); opacity:0; }
}

.mcm-page .qa-hero-sl { min-width:150px; }
.mcm-page .qa-hero-sl-v {
  margin-top:7px; font-size:clamp(26px,2.2vw,34px); font-weight:800;
  letter-spacing:-.045em; line-height:1; font-variant-numeric:tabular-nums;
}
.mcm-page .qa-hero-sl-v.tone-good, .mcm-page .qa-glance-sl-v.tone-good { color:var(--live); }
.mcm-page .qa-hero-sl-v.tone-warn, .mcm-page .qa-glance-sl-v.tone-warn { color:var(--warn); }
.mcm-page .qa-hero-sl-v.tone-crit, .mcm-page .qa-glance-sl-v.tone-crit { color:var(--crit); }
.mcm-page .qa-hero-sl-v.tone-muted, .mcm-page .qa-glance-sl-v.tone-muted { color:var(--ink-4); }
.mcm-page .qa-hero-sl-target { margin-top:6px; font-size:12px; font-weight:600; color:var(--ink-3); }
.mcm-page .qa-meter {
  margin-top:8px; height:4px; border-radius:99px; background:var(--surface-3); overflow:hidden;
}
.mcm-page .qa-meter i { display:block; height:100%; border-radius:99px; background:currentColor; }

/* The stat strip now runs across roughly two thirds of the row rather than
   the whole of it, so it tightens a step to keep all five upright and on one
   line each. The labels keep their ellipsis as the backstop. */
.mcm-page .qa-hero .kpi-card { padding:13px 12px; gap:5px; }
.mcm-page .qa-hero .kpi-card__label { font-size:10.5px; letter-spacing:.05em; }
.mcm-page .qa-hero .kpi-card__value { font-size:22px; }
.mcm-page .qa-hero .kpi-card__description { font-size:11px; }

/* ---- top row: the two summaries, side by side ---- */
.mcm-page .qa-top-grid {
  display:grid; grid-template-columns:minmax(0,1.55fr) minmax(0,1fr); gap:16px;
  align-items:stretch;
}
@media (max-width: 1180px) { .mcm-page .qa-top-grid { grid-template-columns:minmax(0,1fr); } }
@media (max-width: 1020px) {
  .mcm-page .qa-hero-top { grid-template-columns:minmax(0,1fr); }
  .mcm-page .qa-hero-art { display:none; }
}
.mcm-page .qa-panel { box-shadow:var(--shadow-sm); display:flex; flex-direction:column; }
/* Just the glyph — no tinted chip behind it, so the panel heads read as
   titles with a mark rather than as another piece of card furniture. */
.mcm-page .qa-head-icon {
  display:grid; place-items:center; width:18px; height:18px; flex:none;
  color:var(--accent-ink);
}
.mcm-page .qa-head-icon svg { width:16px; height:16px; }
.mcm-page .qa-table-body { padding:6px 0 0; min-width:0; }
.mcm-page .qa-legend {
  display:flex; align-items:center; justify-content:center; flex-wrap:wrap;
  gap:8px 22px; padding:14px 16px 16px;
}
.mcm-page .qa-legend span {
  display:inline-flex; align-items:center; gap:7px;
  font-size:11.5px; font-weight:600; color:var(--ink-3);
}
.mcm-page .qa-legend i { width:8px; height:8px; border-radius:99px; background:currentColor; }

/* ---- today at a glance ---- */
.mcm-page .qa-glance { display:flex; align-items:center; gap:18px; padding:20px 18px; flex:1; }
.mcm-page .qa-donut { position:relative; flex:none; width:132px; height:132px; }
.mcm-page .qa-donut svg { transform:rotate(-90deg); }
.mcm-page .qa-donut-mid {
  position:absolute; inset:0; display:grid; place-content:center; text-align:center;
}
.mcm-page .qa-donut-v {
  font-size:27px; font-weight:800; letter-spacing:-.045em; line-height:1;
  font-variant-numeric:tabular-nums;
}
.mcm-page .qa-donut-k { margin-top:5px; font-size:10.5px; font-weight:600; color:var(--ink-3); }
.mcm-page .qa-glance-keys { display:flex; flex-direction:column; gap:11px; min-width:0; flex:1; }
.mcm-page .qa-glance-keys > div {
  display:flex; align-items:center; gap:9px; font-size:12.5px; font-weight:600;
}
.mcm-page .qa-glance-keys i { width:9px; height:9px; border-radius:99px; flex:none; }
.mcm-page .qa-glance-keys b { margin-left:auto; font-weight:700; font-variant-numeric:tabular-nums; }
.mcm-page .qa-glance-sl {
  flex:none; width:150px; padding-left:18px; border-left:1px solid var(--line-2); text-align:center;
}
.mcm-page .qa-glance-sl .qa-head-icon { margin:0 auto; }
.mcm-page .qa-glance-sl-k { margin-top:9px; font-size:12.5px; font-weight:700; color:var(--ink-2); }
.mcm-page .qa-glance-sl-v {
  margin-top:7px; font-size:30px; font-weight:800; letter-spacing:-.045em; line-height:1;
  font-variant-numeric:tabular-nums;
}
.mcm-page .qa-glance-sl-t { margin-top:7px; font-size:11.5px; font-weight:600; color:var(--ink-3); }
@media (max-width: 620px) {
  .mcm-page .qa-glance { flex-wrap:wrap; }
  .mcm-page .qa-glance-sl { width:100%; padding:16px 0 0; border-left:0; border-top:1px solid var(--line-2); }
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

  // Prefer the queue with a live interacting call; when nothing is in progress
  // right now (common outside peak hours) fall back to who handled the most
  // today instead of always reading "—".
  const queuesWithInteracting = rows.filter((row) => row.interacting > 0);
  const busiestQueue = queuesWithInteracting.length
    ? queuesWithInteracting.reduce((top, row) => (row.interacting > top.interacting ? row : top))
    : rows.reduce((top: (typeof rows)[number] | null, row) => {
        if (row.handledToday === null) return top;
        if (!top || (top.handledToday ?? -1) < row.handledToday) return row;
        return top;
      }, null);

  const longestWaitingQueue = rows.reduce((top: (typeof rows)[number] | null, row) => {
    if (row.longestWaitTimestamp === null) return top;
    if (!top || top.longestWaitTimestamp === null) return row;
    return row.longestWaitTimestamp < top.longestWaitTimestamp ? row : top;
  }, null);
  const slaRows = rows.filter((row) => row.sla !== null);
  const lowestSlaQueue = slaRows.reduce(
    (worst: (typeof rows)[number] | null, row) =>
      !worst || (row.sla as number) < (worst.sla as number) ? row : worst,
    null,
  );
  const totalMembers = new Set(rows.flatMap((row) => row.memberKeys)).size;

  // Available Now — dedupe by agent, not by queue: an agent on 3 queues was
  // getting counted 3x by summing each queue's available_count directly.
  const distinctMembersByKey = new Map<string, any>();
  queues.forEach((queue) => {
    (queue.members || []).forEach((member: any) => {
      const key = member?.user_uuid || member?.extension || member?.uuid;
      if (key && !distinctMembersByKey.has(String(key)))
        distinctMembersByKey.set(String(key), member);
    });
  });
  const totalAvailable = Array.from(distinctMembersByKey.values()).filter(
    (member) => getMemberStatus(member, usersOnlineStatus, activeQueueCalls) === 'Available',
  ).length;

  const totalInteracting = rows.reduce((sum, row) => sum + row.interacting, 0);

  // The hero's headline service level. Averaged across the queues that report
  // one rather than across all queues, so a queue with no calls yet can't drag
  // the figure to zero.
  const avgSla = slaRows.length
    ? slaRows.reduce((sum, row) => sum + (row.sla as number), 0) / slaRows.length
    : null;
  const avgSlaTone = queueTone(avgSla);

  // "Today at a glance" is the same CDR the table's volume columns come from,
  // summed across queues — the three slices are the only outcomes the call log
  // actually distinguishes, so nothing here is invented to fill the ring.
  const glance = rows.reduce(
    (acc, row) => {
      const cdr = cdrByQueueUuid?.[row.uuid];
      if (!cdr) return acc;
      acc.offered += cdr.total;
      acc.handled += cdr.answered;
      acc.abandoned += cdr.missed;
      return acc;
    },
    { offered: 0, handled: 0, abandoned: 0 },
  );
  const glanceOther = Math.max(0, glance.offered - glance.handled - glance.abandoned);
  const glanceSlices = [
    { key: 'Handled', value: glance.handled, color: 'var(--live)' },
    { key: 'Abandoned', value: glance.abandoned, color: 'var(--hold)' },
    { key: 'Other', value: glanceOther, color: 'var(--ai)' },
  ];

  const heroWave = buildHeroWave(
    busiestQueue ? callVolumeSeries(cdrRows || [], busiestQueue.uuid) : [],
  );

  // The footer's "last updated" is a real reading, not a decoration: the stamp
  // moves when the live figures move, and the label re-renders on its own so it
  // ages between updates instead of saying "just now" forever.
  const signature = [
    rows.length,
    totalInteracting,
    totalAvailable,
    totalMembers,
    glance.offered,
    glance.handled,
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

  const heroStats: {
    key: string;
    label: string;
    value: ReactNode;
    helper?: string;
    description: string;
    tone?: 'warn' | 'critical';
  }[] = [
    {
      key: 'longest',
      label: 'Longest waiting',
      value:
        longestWaitingQueue && longestWaitingQueue.longestWaitTimestamp !== null ? (
          <Timer startTime={longestWaitingQueue.longestWaitTimestamp} />
        ) : (
          '00:00'
        ),
      description:
        longestWaitingQueue && longestWaitingQueue.longestWaitTimestamp !== null
          ? longestWaitingQueue.name
          : 'nobody waiting',
      // Same 2-minute breach line the KPI band grades "Longest wait" on.
      tone:
        longestWaitingQueue?.longestWaitTimestamp &&
        Date.now() - longestWaitingQueue.longestWaitTimestamp > 120000
          ? 'critical'
          : undefined,
    },
    {
      key: 'lowest-sla',
      label: 'Lowest SLA today',
      value: lowestSlaQueue ? `${Math.round(lowestSlaQueue.sla as number)}%` : '—',
      description: lowestSlaQueue ? lowestSlaQueue.name : 'no service level yet',
      tone: lowestSlaQueue
        ? (lowestSlaQueue.sla as number) < 60
          ? 'critical'
          : (lowestSlaQueue.sla as number) < 80
            ? 'warn'
            : undefined
        : undefined,
    },
    {
      key: 'members',
      label: 'Total members',
      value: String(totalMembers),
      description: 'across all queues',
    },
    {
      key: 'available',
      label: 'Available now',
      value: String(totalAvailable),
      description: 'free to take a call',
    },
    {
      key: 'interacting',
      label: 'Total interacting',
      value: String(totalInteracting),
      description: 'on a call right now',
    },
  ];

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
      header: 'Media',
      accessorKey: 'media',
      cell: () => <span className="qt-mute">Voice</span>,
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
    { header: 'Interacting', accessorKey: 'interacting' },
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

      {/* The two summaries share the top row and the table takes the whole
          width beneath them — it has twelve columns and was the one thing on
          the page that could actually use the room. */}
      <div className="qa-top-grid">
        {/* The hero answers the two questions the room asks first — which queue
          is carrying the day, and are we hitting the service level — at a size
          you can read from a desk away. Everything smaller sits under it. */}
        <section className="qa-hero">
          <div className="qa-hero-top">
            <div className="qa-hero-lead">
              <span className="qa-eyebrow">Busiest queue</span>
              <h2 className="qa-hero-name">{busiestQueue ? busiestQueue.name : '—'}</h2>
              <div className="qa-hero-meta">
                <i aria-hidden="true" />
                {busiestQueue
                  ? busiestQueue.interacting > 0
                    ? `${busiestQueue.interacting} interacting now`
                    : `${busiestQueue.handledToday ?? 0} handled today`
                  : 'no queue activity yet'}
              </div>
            </div>

            {/* The curve is that queue's call volume building through the range;
              the marker rides its latest point. No history, no curve. */}
            <div className="qa-hero-art" aria-hidden="true">
              {heroWave && (
                <>
                  <svg
                    className="qa-hero-wave"
                    viewBox="0 0 1 1"
                    preserveAspectRatio="none"
                    aria-hidden="true"
                  >
                    <path
                      d={heroWave.d}
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      vectorEffect="non-scaling-stroke"
                    />
                  </svg>
                  <span
                    className="qa-hero-pulse"
                    style={{
                      left: `${heroWave.markerX * 100}%`,
                      top: `${heroWave.markerY * 100}%`,
                    }}
                  />
                </>
              )}
            </div>

            <div className="qa-hero-sl">
              <span className="qa-eyebrow">Service level today</span>
              <div className={`qa-hero-sl-v tone-${avgSlaTone}`}>
                {avgSla === null ? '—' : `${Math.round(avgSla)}%`}
              </div>
              <div className="qa-hero-sl-target">Target: 80%</div>
              <div className={`qa-meter tone-${avgSlaTone}`}>
                <i
                  style={{
                    width: `${Math.min(100, Math.max(0, Math.round(avgSla ?? 0)))}%`,
                    background:
                      avgSlaTone === 'good'
                        ? 'var(--live)'
                        : avgSlaTone === 'warn'
                          ? 'var(--warn)'
                          : avgSlaTone === 'crit'
                            ? 'var(--crit)'
                            : 'var(--ink-4)',
                  }}
                />
              </div>
            </div>
          </div>

          {/* The shared KPI Overview card, seated inside the hero — `--flush`
            drops its own frame so the two read as one card. */}
          <div className="kpi-grid kpi-grid--flush">
            {heroStats.map((stat) => (
              <div key={stat.key} className="kpi-card">
                <span className="kpi-card__label">{stat.label}</span>
                <span className="kpi-card__value-row">
                  <span
                    className={`kpi-card__value${stat.tone ? ` kpi-card__value--${stat.tone}` : ''}`}
                  >
                    {stat.value}
                  </span>
                  {stat.helper && (
                    <span className="kpi-card__helper">
                      <span className="kpi-card__helper-dot" />
                      {stat.helper}
                    </span>
                  )}
                </span>
                <span className="kpi-card__description">{stat.description}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="panel-card qa-panel">
          <div className="pc-head">
            <span className="qa-head-icon" aria-hidden="true">
              <CalendarDays />
            </span>
            <h3>Today at a Glance</h3>
          </div>
          <div className="qa-glance">
            <div className="qa-donut">
              <svg width="132" height="132" viewBox="0 0 132 132" aria-hidden="true">
                <circle
                  cx="66"
                  cy="66"
                  r={DONUT_R}
                  fill="none"
                  stroke="var(--surface-3)"
                  strokeWidth="12"
                />
                {/* Offsets accumulate so the slices sit end to end; an empty
                    day draws nothing over the track, which is the honest
                    picture of nothing having happened yet. */}
                {glance.offered > 0 &&
                  glanceSlices.reduce<{ nodes: ReactNode[]; used: number }>(
                    (acc, slice) => {
                      if (slice.value > 0) {
                        const length = (slice.value / glance.offered) * DONUT_C;
                        acc.nodes.push(
                          <circle
                            key={slice.key}
                            cx="66"
                            cy="66"
                            r={DONUT_R}
                            fill="none"
                            stroke={slice.color}
                            strokeWidth="12"
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
                <div className="qa-donut-v">{glance.handled}</div>
                <div className="qa-donut-k">Total Handled</div>
              </div>
            </div>

            <div className="qa-glance-keys">
              {glanceSlices.map((slice) => (
                <div key={slice.key}>
                  <i style={{ background: slice.color }} aria-hidden="true" />
                  <span style={{ color: 'var(--ink-2)' }}>{slice.key}</span>
                  <b>
                    {slice.value} ({share(slice.value, glance.offered)}%)
                  </b>
                </div>
              ))}
            </div>

            <div className="qa-glance-sl">
              <span className="qa-head-icon" aria-hidden="true">
                <Activity />
              </span>
              <div className="qa-glance-sl-k">Service Level</div>
              <div className={`qa-glance-sl-v tone-${avgSlaTone}`}>
                {avgSla === null ? '—' : `${Math.round(avgSla)}%`}
              </div>
              <div className="qa-glance-sl-t">Target: 80%</div>
            </div>
          </div>
        </section>
      </div>

      {isCdrSampled && (
        <p className="page-note">
          Offered, Handled, ASA, AHT and Abandon are counted from the most recent 1,000 calls in
          this range — older calls in the range aren't included in these columns.
        </p>
      )}

      <section className="panel-card qa-panel">
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
