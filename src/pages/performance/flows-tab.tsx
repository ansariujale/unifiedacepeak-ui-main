import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import moment from 'moment';
import {
  Download,
  GitBranch,
  PhoneForwarded,
  PhoneOff,
  Search,
  Timer as TimerIcon,
  TrendingUp,
  UserCheck,
} from 'lucide-react';
import TableManager from '@/components/custom/table-manager';
import { ivrList } from '@/services/api';
import { callTalkSeconds, callTotalSeconds, isMissedCall } from '@/hooks/use-call-stats';
import { usePerformanceCallStats } from './use-performance-call-stats';
import { formatSecsToClock } from './format';
import Sparkline from './sparkline';
import { axisTicksFor, countInto, makeBucketing } from './time-buckets';
import { PerfHero, PerfNotice, PerfSplit, PerfStat } from './perf-surface';

const getSiteLabel = (site: unknown) => {
  if (typeof site !== 'string' || !site) return '';
  try {
    return String(JSON.parse(site)?.label || '');
  } catch {
    return '';
  }
};

const normalise = (value: unknown) =>
  String(value ?? '')
    .trim()
    .toLowerCase();

const isIvrCall = (row: any) => String(row?.forward_type || '').toUpperCase() === 'IVR';

/** Same breach line the KPI band grades its abandon rate on. */
const ABANDON_ALERT_PERCENT = 5;

/** A flow with no site on its record, grouped and filtered under this label. */
const NO_SITE = '';
const siteName = (site: string) => site || 'No site';

const share = (part: number, whole: number) => (whole ? (part / whole) * 100 : 0);
const percentLabel = (part: number, whole: number) =>
  whole ? `${Math.round(share(part, whole))}%` : '—';

type FlowRow = {
  uuid: string;
  name: string;
  extension: string;
  site: string;
  entries: number;
  handled: number;
  abandoned: number;
  avgSeconds: number | null;
  lastEntry: number | null;
  /** Entries per chart bucket, so each row can draw its own shape of the range. */
  series: number[];
};

const FL_CSS = `
/* ---- chart beside the site breakdown ---- */
.mcm-page .fl-grid {
  display:grid; grid-template-columns:minmax(0,1.9fr) minmax(290px,1fr); gap:14px; align-items:stretch;
}
@media (max-width:1100px) { .mcm-page .fl-grid { grid-template-columns:minmax(0,1fr); } }
.mcm-page .fl-grid > .pf-panel { display:flex; flex-direction:column; min-width:0; }

.mcm-page .fl-facts { display:flex; flex-wrap:wrap; gap:4px 16px; font-size:12px; color:var(--ink-4); }
.mcm-page .fl-facts b { font-weight:600; color:var(--ink); font-variant-numeric:tabular-nums; }
.mcm-page .fl-chart { flex:1; display:flex; flex-direction:column; justify-content:flex-end; padding:0 18px 14px; }
/* Room above the bars for the peak's own count. */
.mcm-page .fl-plot { padding-top:18px; }
.mcm-page .fl-bars {
  position:relative; display:flex; align-items:flex-end; gap:3px; height:112px;
  border-bottom:1px solid var(--line);
  background:
    linear-gradient(var(--line-2), var(--line-2)) 0 0 / 100% 1px no-repeat,
    linear-gradient(var(--line-2), var(--line-2)) 0 50% / 100% 1px no-repeat;
}
.mcm-page .fl-bars i {
  position:relative; flex:1; min-width:3px; border-radius:3px 3px 0 0;
  background:color-mix(in oklab, var(--accent) 22%, var(--surface));
  transition:background-color .15s ease;
}
.mcm-page .fl-bars i.is-peak { background:var(--accent); }
.mcm-page .fl-bars i:hover { background:color-mix(in oklab, var(--accent) 55%, var(--surface)); }
.mcm-page .fl-bars i.is-peak:hover { background:var(--accent-ink); }
.mcm-page .fl-bars i[data-peak]::after {
  content:attr(data-peak); position:absolute; left:50%; bottom:100%; transform:translate(-50%,-3px);
  font-size:11px; font-weight:700; color:var(--accent-ink); font-style:normal; white-space:nowrap;
}
.mcm-page .fl-bars-empty {
  position:absolute; inset:0; display:grid; place-items:center; font-size:12.5px; color:var(--ink-4);
}
.mcm-page .fl-axis {
  display:flex; justify-content:space-between; margin-top:7px;
  font-size:11px; color:var(--ink-4); font-variant-numeric:tabular-nums;
}

/* ---- by site ---- */
.mcm-page .fl-site-list { display:flex; flex-direction:column; gap:2px; margin:0; padding:0 8px 10px; list-style:none; }
.mcm-page .pf-panel .fl-site-list button.fl-site-row[type='button'] {
  display:grid; grid-template-columns:minmax(0,1fr) auto; align-items:baseline; gap:5px 12px;
  width:100%; padding:10px; border:0; border-radius:10px; background:transparent;
  text-align:left; cursor:pointer; transition:background-color .15s ease;
}
.mcm-page .pf-panel .fl-site-list button.fl-site-row[type='button']:hover {
  background:color-mix(in oklab, var(--ink) 4%, var(--surface));
}
.mcm-page .pf-panel .fl-site-list button.fl-site-row[type='button'].is-on {
  background:color-mix(in oklab, var(--accent) 8%, var(--surface));
}
.mcm-page .fl-site-name { min-width:0; font-size:13px; font-weight:600; color:var(--ink); overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.mcm-page .fl-site-name em { margin-left:6px; font-style:normal; font-weight:500; color:var(--ink-4); }
.mcm-page .fl-site-count { font-size:13px; font-weight:700; color:var(--ink); font-variant-numeric:tabular-nums; }
.mcm-page .fl-site-bar {
  grid-column:1 / -1; height:4px; border-radius:99px; overflow:hidden;
  background:color-mix(in oklab, var(--ink) 8%, transparent);
}
.mcm-page .fl-site-bar i { display:block; height:100%; border-radius:99px; background:var(--accent); }
.mcm-page .fl-site-meta { grid-column:1 / -1; font-size:11.5px; color:var(--ink-4); }
.mcm-page .fl-site-top {
  grid-column:1 / -1; min-width:0; font-size:11.5px; color:var(--ink-4);
  overflow:hidden; text-overflow:ellipsis; white-space:nowrap;
}
.mcm-page .fl-site-top b { font-weight:600; color:var(--ink-2); }
.mcm-page .fl-site-empty { margin:0; padding:4px 18px 18px; font-size:12.5px; color:var(--ink-4); }

/* ---- table cells ---- */
.mcm-page .fl-name { display:flex; align-items:center; gap:10px; min-width:0; }
.mcm-page .fl-name-chip {
  display:grid; place-items:center; width:28px; height:28px; flex:none; border-radius:9px;
  background:color-mix(in oklab, var(--accent) 9%, var(--surface)); color:var(--accent-ink);
}
.mcm-page .fl-name-chip svg { width:14px; height:14px; }
.mcm-page .fl-name b { font-size:13px; font-weight:600; color:var(--ink); }
.mcm-page .fl-name-ext { display:block; margin-top:1px; font-size:11.5px; font-weight:500; color:var(--ink-4); }
.mcm-page .fl-site {
  display:inline-flex; align-items:center; padding:2px 9px; border-radius:99px;
  background:var(--surface-3); color:var(--ink-2); font-size:11.5px; font-weight:600;
}
.mcm-page .fl-status {
  display:inline-flex; align-items:center; gap:6px; padding:2px 9px; border-radius:99px;
  font-size:11.5px; font-weight:600;
}
.mcm-page .fl-status::before { content:''; width:6px; height:6px; border-radius:99px; background:currentColor; }
.mcm-page .fl-status.is-active { background:var(--live-wash); color:var(--live); }
.mcm-page .fl-status.is-idle { background:var(--surface-3); color:var(--ink-3); }
.mcm-page .fl-sub { display:block; margin-top:1px; font-size:11.5px; color:var(--ink-4); }
.mcm-page .fl-trend { display:block; width:92px; height:24px; }
.mcm-page .fl-trend svg { display:block; width:100%; height:100%; }
`;

const FlowsTab = ({
  selectedRange,
  rangePhrase,
}: {
  selectedRange: { from: string; to: string };
  /** How the selected range reads in a sentence — "today", "yesterday", "in this range". */
  rangePhrase: string;
}) => {
  const [search, setSearch] = useState('');
  const [site, setSite] = useState<string | null>(null);

  const { data: flows = [], isPending: isFlowsPending } = useQuery({
    queryKey: ['performanceFlowsSummary'],
    queryFn: () => ivrList({ page: 1, limit: 200 } as any),
    select: (res: any) => res?.data?.data?.result?.rows || [],
  });

  /* The same call log every other Performance view reads, on the page's own
     range — it used to be a separate query pinned to today, capped at 200. */
  const callStats = usePerformanceCallStats(selectedRange);
  const isPending = isFlowsPending || (callStats.isSample && callStats.isRealPending);
  /* Sample activity is only ever laid over flows that really exist; with none
     configured there is nothing to attribute it to, so nothing is shown. */
  const isSample = callStats.isSample && !isPending && flows.length > 0;

  const bucketing = useMemo(() => makeBucketing(selectedRange), [selectedRange]);

  const { flowRows, ivrCalls, unmatched } = useMemo(() => {
    /* Sample rows that can't be laid over a real flow aren't counted at all,
       so an account with no flows never shows sample entries. */
    const sourceRows = callStats.isSample && !isSample ? [] : callStats.rows || [];
    const allIvrCalls = sourceRows.filter(isIvrCall);
    const sampleNames = isSample
      ? Array.from(new Set(allIvrCalls.map((row: any) => normalise(row?.forward_name)))).sort()
      : [];

    const byName = new Map<string, number>();
    const byUuid = new Map<string, number>();
    const byExtension = new Map<string, number>();
    flows.forEach((flow: any, index: number) => {
      byName.set(normalise(flow?.name), index);
      if (flow?.uuid) byUuid.set(String(flow.uuid), index);
      if (flow?.extension) byExtension.set(String(flow.extension), index);
    });

    const buckets: any[][] = flows.map(() => []);
    let unmatchedCount = 0;
    allIvrCalls.forEach((row: any) => {
      let index: number | undefined;
      if (isSample) {
        /* Sample flow names are spread over the real flows in a fixed order,
           the way sample agent stats are laid over real agents. */
        const position = sampleNames.indexOf(normalise(row?.forward_name));
        index = position < 0 ? undefined : position % flows.length;
      } else {
        /* Reports ▸ Flow performance groups by the name on the call, so this
           does too; the id and extension catch a flow renamed since. */
        index =
          byName.get(normalise(row?.forward_name)) ??
          byUuid.get(String(row?.forward_value ?? row?.forward_uuid ?? '')) ??
          byExtension.get(String(row?.destination_number ?? ''));
      }
      if (index === undefined) unmatchedCount += 1;
      else buckets[index].push(row);
    });

    const rows: FlowRow[] = flows.map((flow: any, index: number) => {
      const calls = buckets[index];
      const times = calls.map(callTotalSeconds).filter((value: number) => value > 0);
      const stamps = calls
        .map((row: any) => moment(row?.start_stamp))
        .filter((stamp: moment.Moment) => stamp.isValid())
        .map((stamp: moment.Moment) => stamp.valueOf());
      return {
        uuid: String(flow?.uuid || index),
        name: String(flow?.name || 'Unnamed flow'),
        extension: String(flow?.extension || ''),
        site: getSiteLabel(flow?.site),
        entries: calls.length,
        handled: calls.filter((row: any) => callTalkSeconds(row) > 0).length,
        abandoned: calls.filter(isMissedCall).length,
        avgSeconds: times.length
          ? times.reduce((sum: number, value: number) => sum + value, 0) / times.length
          : null,
        lastEntry: stamps.length ? Math.max(...stamps) : null,
        series: countInto(bucketing, calls),
      };
    });

    return { flowRows: rows, ivrCalls: allIvrCalls, unmatched: unmatchedCount };
  }, [callStats.rows, callStats.isSample, flows, isSample, bucketing]);

  const totalEntries = ivrCalls.length;
  const matchedEntries = flowRows.reduce((sum, row) => sum + row.entries, 0);
  const totalHandled = ivrCalls.filter((row: any) => callTalkSeconds(row) > 0).length;
  const totalAbandoned = ivrCalls.filter(isMissedCall).length;
  const abandonShare = share(totalAbandoned, totalEntries);
  const entryTimes = ivrCalls.map(callTotalSeconds).filter((value: number) => value > 0);
  const avgTimeInCall = entryTimes.length
    ? entryTimes.reduce((sum: number, value: number) => sum + value, 0) / entryTimes.length
    : null;
  const activeCount = flowRows.filter((row) => row.entries > 0).length;
  const busiest = flowRows.reduce(
    (top: FlowRow | null, row) =>
      row.entries > 0 && (!top || row.entries > top.entries) ? row : top,
    null,
  );

  const counts = useMemo(() => countInto(bucketing, ivrCalls), [bucketing, ivrCalls]);
  const peakIndex = counts.reduce((best, value, index) => (value > counts[best] ? index : best), 0);
  const peakValue = counts[peakIndex] || 0;
  const axisTicks = useMemo(() => axisTicksFor(counts.length), [counts.length]);

  const isMultiDay = selectedRange.from !== selectedRange.to;
  const formatStamp = (value: number) =>
    moment(value).format(isMultiDay ? 'MMM D, h:mm A' : 'h:mm A');
  const entryStamps = ivrCalls
    .map((row: any) => moment(row?.start_stamp))
    .filter((stamp: moment.Moment) => stamp.isValid())
    .map((stamp: moment.Moment) => stamp.valueOf());
  const firstEntry = entryStamps.length ? Math.min(...entryStamps) : null;
  const lastEntry = entryStamps.length ? Math.max(...entryStamps) : null;

  /* Every site the flows sit at, busiest first; flows with no site on their
     record are grouped rather than dropped, so the sites always add up. */
  const siteRows = useMemo(() => {
    const groups = new Map<
      string,
      { key: string; flows: number; entries: number; handled: number; top: FlowRow | null }
    >();
    flowRows.forEach((row) => {
      const key = row.site || NO_SITE;
      const group = groups.get(key) || { key, flows: 0, entries: 0, handled: 0, top: null };
      group.flows += 1;
      group.entries += row.entries;
      group.handled += row.handled;
      if (row.entries > 0 && (!group.top || row.entries > group.top.entries)) group.top = row;
      groups.set(key, group);
    });
    return Array.from(groups.values()).sort(
      (a, b) => b.entries - a.entries || b.flows - a.flows || a.key.localeCompare(b.key),
    );
  }, [flowRows]);

  const visibleRows = useMemo(() => {
    const needle = normalise(search);
    return flowRows
      .filter((row) => site === null || row.site === site)
      .filter(
        (row) =>
          !needle || normalise(row.name).includes(needle) || row.extension.includes(needle),
      )
      .sort((a, b) => b.entries - a.entries || a.name.localeCompare(b.name));
  }, [flowRows, site, search]);

  const exportCsv = () => {
    const head = [
      'Flow',
      'Extension',
      'Site',
      'Entries',
      'Handled',
      'Abandoned in flow',
      'Avg time in call',
      'Last entry',
      'Status',
    ];
    const lines = visibleRows.map((row) =>
      [
        row.name,
        row.extension,
        row.site,
        String(row.entries),
        String(row.handled),
        String(row.abandoned),
        row.avgSeconds === null ? '' : formatSecsToClock(row.avgSeconds),
        row.lastEntry === null ? '' : moment(row.lastEntry).format('YYYY-MM-DD HH:mm'),
        row.entries ? 'Active' : 'Idle',
      ]
        .map((cell) => `"${String(cell).replace(/"/g, '""')}"`)
        .join(','),
    );
    const csv = [head.join(','), ...lines].join('\r\n');
    // A byte-order mark first, so Excel opens the file as UTF-8.
    const blob = new Blob([String.fromCharCode(0xfeff), csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `flows-${selectedRange.from}_${selectedRange.to}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const dash = (value: string) => (isPending ? '—' : value);
  const rangeLabel = rangePhrase === 'in this range' ? 'in the selected range' : rangePhrase;

  const columns = [
    {
      header: 'Flow',
      accessorKey: 'name',
      cell: ({ row }: any) => (
        <span className="fl-name">
          <span className="fl-name-chip" aria-hidden="true">
            <GitBranch />
          </span>
          <span className="min-w-0">
            <b>{row.original.name}</b>
            <span className="fl-name-ext">
              {row.original.extension ? `Ext ${row.original.extension}` : 'No extension'}
            </span>
          </span>
        </span>
      ),
    },
    {
      header: 'Site',
      accessorKey: 'site',
      cell: ({ row }: any) =>
        row.original.site ? (
          <span className="fl-site">{row.original.site}</span>
        ) : (
          <span className="pf-mute">—</span>
        ),
    },
    {
      header: 'Entries',
      accessorKey: 'entries',
      cell: ({ row }: any) => (
        <span>
          <span className="pf-meter">
            <b>{dash(String(row.original.entries))}</b>
            <span className="pf-meter-bar" aria-hidden="true">
              <i
                style={{
                  width: `${isPending ? 0 : share(row.original.entries, busiest?.entries || 0)}%`,
                }}
              />
            </span>
          </span>
          {!isPending && totalEntries > 0 && (
            <span className="fl-sub">
              {percentLabel(row.original.entries, totalEntries)} of entries
            </span>
          )}
        </span>
      ),
    },
    {
      /* The flow's own entries across the same buckets as the chart above. */
      header: `By ${bucketing.unit}`,
      accessorKey: 'series',
      cell: ({ row }: any) =>
        isPending || !row.original.entries ? (
          <span className="pf-mute">—</span>
        ) : (
          <span className="fl-trend">
            <Sparkline points={row.original.series} tone="var(--accent)" />
          </span>
        ),
    },
    {
      header: 'Handled',
      accessorKey: 'handled',
      cell: ({ row }: any) =>
        isPending || !row.original.entries ? (
          <span className="pf-mute">—</span>
        ) : (
          <span>
            {percentLabel(row.original.handled, row.original.entries)}
            <span className="fl-sub">{row.original.handled} handled</span>
          </span>
        ),
    },
    {
      header: 'Abandoned in flow',
      accessorKey: 'abandoned',
      cell: ({ row }: any) =>
        isPending || !row.original.entries ? (
          <span className="pf-mute">—</span>
        ) : (
          <span>
            {row.original.abandoned}
            <span className="fl-sub">
              {percentLabel(row.original.abandoned, row.original.entries)} of entries
            </span>
          </span>
        ),
    },
    {
      header: 'Avg time in call',
      accessorKey: 'avgSeconds',
      cell: ({ row }: any) =>
        isPending || row.original.avgSeconds === null ? (
          <span className="pf-mute">—</span>
        ) : (
          formatSecsToClock(row.original.avgSeconds)
        ),
    },
    {
      header: 'Last entry',
      accessorKey: 'lastEntry',
      cell: ({ row }: any) =>
        isPending || row.original.lastEntry === null ? (
          <span className="pf-mute">—</span>
        ) : (
          formatStamp(row.original.lastEntry)
        ),
    },
    {
      /* Active means callers reached it in the range, not that it is switched
         on — the platform has no enabled flag on an IVR to read. */
      header: 'Status',
      accessorKey: 'status',
      cell: ({ row }: any) =>
        isPending ? (
          <span className="pf-mute">—</span>
        ) : row.original.entries ? (
          <span className="fl-status is-active">Active</span>
        ) : (
          <span className="fl-status is-idle">Idle</span>
        ),
    },
  ];

  return (
    <div className="pf-wrap pf-wrap--dense">
      <style>{FL_CSS}</style>

      <div className="pf-band pf-band--wide-hero">
        <PerfHero
          eyebrow="Call flows"
          title="Where every caller is routed."
          copy="Which IVR menus callers reach, how many of those calls are handled, and how long they last."
        >
          <PerfSplit
            value={String(flows.length)}
            caption="flows configured"
            pending={isPending}
            items={[
              {
                key: 'active',
                label: `Took calls ${rangePhrase}`,
                color: 'var(--live)',
                count: activeCount,
              },
              {
                key: 'idle',
                label: 'Idle',
                color: 'var(--ink-4)',
                count: flows.length - activeCount,
              },
            ]}
          />
        </PerfHero>

        <div className="pf-stats pf-stats--3">
          <PerfStat
            icon={GitBranch}
            label="Total flows"
            value={isFlowsPending ? '—' : String(flows.length)}
            sub={
              siteRows.length
                ? `across ${siteRows.length} ${siteRows.length === 1 ? 'site' : 'sites'}`
                : 'IVR menus configured'
            }
          />
          <PerfStat
            icon={PhoneForwarded}
            label="Entries"
            value={dash(String(totalEntries))}
            sub={
              callStats.isQueueBreakdownSampled
                ? `most recent ${callStats.sampledRowCount} calls`
                : `calls into a flow, ${rangeLabel}`
            }
          />
          <PerfStat
            icon={UserCheck}
            label="Handled"
            value={dash(String(totalHandled))}
            sub={
              isPending
                ? 'of entries'
                : totalEntries
                  ? `${percentLabel(totalHandled, totalEntries)} of entries`
                  : 'no entries yet'
            }
          />
          <PerfStat
            icon={PhoneOff}
            label="Abandoned in flow"
            value={dash(String(totalAbandoned))}
            sub={
              isPending
                ? 'of entries'
                : totalEntries
                  ? `${percentLabel(totalAbandoned, totalEntries)} of entries`
                  : 'no entries yet'
            }
            warn={!isPending && abandonShare > ABANDON_ALERT_PERCENT}
          />
          <PerfStat
            icon={TimerIcon}
            label="Avg time in call"
            value={isPending || avgTimeInCall === null ? '—' : formatSecsToClock(avgTimeInCall)}
            sub="per entry"
          />
          <PerfStat
            icon={TrendingUp}
            label="Busiest flow"
            value={isPending || !busiest ? '—' : busiest.name}
            sub={
              isPending
                ? 'most entries'
                : busiest
                  ? `${busiest.entries} entries ${rangePhrase}`
                  : `no entries ${rangePhrase}`
            }
          />
        </div>
      </div>

      {isSample && (
        <PerfNotice>
          Showing sample flow activity — entries, handled and time in call are sample figures until
          calls route through your IVRs. Flow names, extensions and sites are real.
        </PerfNotice>
      )}
      {!callStats.isSample && !isPending && unmatched > 0 && (
        <PerfNotice quiet>
          {unmatched} {unmatched === 1 ? 'entry' : 'entries'} went to a flow that isn't configured
          any more — counted in the totals above, but not against any flow below.
        </PerfNotice>
      )}
      {!isSample && callStats.isQueueBreakdownSampled && (
        <PerfNotice quiet>
          This range holds more calls than one page of the log, so flow figures are counted from the
          most recent {callStats.sampledRowCount}.
        </PerfNotice>
      )}

      <div className="fl-grid">
        <section className="pf-panel">
          <header className="pf-panel-head">
            <div className="pf-panel-title">
              <h3>Entries by {bucketing.unit}</h3>
            </div>
            {!isPending && firstEntry !== null && lastEntry !== null && (
              <span className="fl-facts">
                <span>
                  First <b>{formatStamp(firstEntry)}</b>
                </span>
                <span>
                  Last <b>{formatStamp(lastEntry)}</b>
                </span>
                <span>
                  Busiest <b>{bucketing.labelOf(peakIndex)}</b>
                </span>
              </span>
            )}
          </header>
          <div className="fl-chart">
            <div className="fl-plot">
              <div
                className="fl-bars"
                role="img"
                aria-label={
                  peakValue
                    ? `Entries by ${bucketing.unit}; busiest ${bucketing.labelOf(peakIndex)} with ${peakValue}`
                    : `No entries ${rangePhrase}`
                }
              >
                {counts.map((value, index) => {
                  const isPeak = !isPending && value > 0 && index === peakIndex;
                  return (
                    <i
                      key={index}
                      className={isPeak ? 'is-peak' : undefined}
                      data-peak={isPeak ? value : undefined}
                      style={{
                        height: `${
                          isPending || !peakValue ? 0 : Math.max(value ? 4 : 0, (value / peakValue) * 100)
                        }%`,
                      }}
                      title={`${bucketing.labelOf(index)} · ${value} ${value === 1 ? 'entry' : 'entries'}`}
                    />
                  );
                })}
                {!isPending && !peakValue && (
                  <span className="fl-bars-empty">No calls reached a flow {rangePhrase}.</span>
                )}
              </div>
            </div>
            <div className="fl-axis" aria-hidden="true">
              {axisTicks.map((index) => (
                <span key={index}>{bucketing.labelOf(index)}</span>
              ))}
            </div>
          </div>
        </section>

        <section className="pf-panel">
          <header className="pf-panel-head">
            <div className="pf-panel-title">
              <h3>By site</h3>
              <span>{siteRows.length}</span>
            </div>
          </header>
          {siteRows.length ? (
            <ul className="fl-site-list">
              {siteRows.map((group) => (
                <li key={group.key || 'no-site'}>
                  {/* Picking a site narrows the table below to its flows. */}
                  <button
                    type="button"
                    className={`fl-site-row${site === group.key ? ' is-on' : ''}`}
                    aria-pressed={site === group.key}
                    onClick={() => setSite((current) => (current === group.key ? null : group.key))}
                  >
                    <span className="fl-site-name">
                      {siteName(group.key)}
                      <em>
                        {group.flows} {group.flows === 1 ? 'flow' : 'flows'}
                      </em>
                    </span>
                    <span className="fl-site-count">{dash(String(group.entries))}</span>
                    <span className="fl-site-bar" aria-hidden="true">
                      <i
                        style={{
                          width: `${isPending ? 0 : share(group.entries, matchedEntries)}%`,
                        }}
                      />
                    </span>
                    <span className="fl-site-meta">
                      {isPending
                        ? 'entries'
                        : group.entries
                          ? `${percentLabel(group.entries, matchedEntries)} of entries · ${percentLabel(group.handled, group.entries)} handled`
                          : `no entries ${rangePhrase}`}
                    </span>
                    {!isPending && group.top && (
                      <span className="fl-site-top">
                        Busiest <b>{group.top.name}</b> · {group.top.entries}
                      </span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="fl-site-empty">
              {isFlowsPending ? 'Loading sites…' : 'Sites appear once flows are configured.'}
            </p>
          )}
        </section>
      </div>

      <section className="pf-panel">
        <header className="pf-panel-head">
          <div className="pf-panel-title">
            <h3>All flows</h3>
            <span>{visibleRows.length}</span>
          </div>
          <label className="pf-search">
            <Search aria-hidden="true" />
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search name or extension"
              aria-label="Search flows by name or extension"
            />
          </label>
          <button
            type="button"
            className="pf-button"
            onClick={exportCsv}
            disabled={!visibleRows.length}
            title="Download the flows this view is showing"
          >
            <Download aria-hidden="true" />
            Export
          </button>
          {siteRows.length > 1 && (
            <div className="pf-chips" role="group" aria-label="Filter flows by site">
              <button
                type="button"
                className={`pf-chip${site === null ? ' is-on' : ''}`}
                aria-pressed={site === null}
                onClick={() => setSite(null)}
              >
                All sites <b>{flowRows.length}</b>
              </button>
              {siteRows.map((group) => (
                <button
                  key={group.key || 'no-site'}
                  type="button"
                  className={`pf-chip${site === group.key ? ' is-on' : ''}`}
                  aria-pressed={site === group.key}
                  onClick={() => setSite(group.key)}
                >
                  {siteName(group.key)} <b>{group.flows}</b>
                </button>
              ))}
            </div>
          )}
        </header>

        <TableManager
          columns={columns}
          staticData={visibleRows}
          loading={isFlowsPending}
          showPagination={false}
          customClass="pf-table"
          emptyTablePlaceholder={flowRows.length ? 'No flows match' : 'No call flows configured'}
          descriptionEmptyTable={
            flowRows.length
              ? 'Try another site, or clear the search.'
              : 'IVR menus you create under Admin ▸ Phone System show up here.'
          }
        />
      </section>
    </div>
  );
};

export default FlowsTab;
