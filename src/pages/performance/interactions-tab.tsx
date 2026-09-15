import { useMemo } from 'react';
import {
  CircleDollarSign,
  Clock3,
  Phone,
  PhoneIncoming,
  PhoneMissed,
  Timer as TimerIcon,
} from 'lucide-react';
import CallHistory from '@/pages/reports/call-logs/call-history';
import { callTalkSeconds } from '@/hooks/use-call-stats';
import { CALL_KINDS as KINDS, countKinds, type CallKind } from './call-kinds';
import { usePerformanceCallStats } from './use-performance-call-stats';
import { formatSecsToClock } from './format';
import { PerfHero, PerfNotice, PerfSplit, PerfStat, type PerfSplitItem } from './perf-surface';

/** Same breach line the KPI band grades its abandon rate on. */
const MISSED_ALERT_PERCENT = 5;

const share = (part: number, whole: number) => (whole ? Math.round((part / whole) * 100) : 0);

/**
 * The embedded call log keeps its own markup (Reports ▸ Call logs renders the
 * same component), so it is restyled here by the class hooks it carries rather
 * than by editing it: count tiles become filter chips, and its toolbar rides
 * the panel's title row.
 */
const CL_CSS = `
.mcm-page .cl-panel { position:relative; }
.mcm-page .cl-panel .pf-panel-head { padding-right:420px; min-height:70px; }
.mcm-page .cl-panel .pf-panel-title { flex-direction:column; align-items:flex-start; gap:2px; }
.mcm-page .cl-body { padding:0 20px 6px; }
.mcm-page .cl-body .ch-embedded { gap:14px; }
.mcm-page .cl-body .ch-toolbar { position:absolute; top:16px; right:20px; }
@media (max-width:900px) {
  .mcm-page .cl-panel .pf-panel-head { padding-right:20px; }
  .mcm-page .cl-body .ch-toolbar { position:static; justify-content:flex-start; }
}

/* count tiles, as filter chips */
.mcm-page .cl-body .ch-tabs {
  display:flex; flex-wrap:wrap; gap:8px; overflow:visible; padding:0;
}
.mcm-page .cl-body .ch-tab {
  flex-direction:row-reverse; align-items:center; justify-content:center; gap:8px;
  min-width:0; min-height:0; height:32px; padding:0 14px;
  border-radius:8px; border:1px solid var(--line); background:var(--surface);
  transition:background-color .15s ease, border-color .15s ease, color .15s ease;
}
.mcm-page .cl-body .ch-tab:hover { background:color-mix(in oklab, var(--ink) 4%, var(--surface)); }
.mcm-page .cl-body .ch-tab-k {
  margin:0; font-size:12.5px; font-weight:500; letter-spacing:0; text-transform:none;
  color:var(--ink-2);
}
.mcm-page .cl-body .ch-tab-v {
  min-width:0; padding:0; font-size:12.5px; font-weight:600; color:var(--ink-3);
  font-variant-numeric:tabular-nums;
}
.mcm-page .cl-body .ch-tab.is-active { background:#171717; border-color:#171717; }
.mcm-page .cl-body .ch-tab.is-active .ch-tab-k,
.mcm-page .cl-body .ch-tab.is-active .ch-tab-v { color:#fff; }
.mcm-page .cl-body .ch-tab.is-active .ch-tab-v { opacity:.65; }

/* the log itself: no second frame inside the panel */
.mcm-page .cl-body .cl-table {
  border:0; border-radius:0;
  /* TableManager hard-codes bg-white on its scroll container. */
  background-color:transparent !important;
}
.mcm-page .cl-body table { font-variant-numeric:tabular-nums; }
.mcm-page .cl-body thead th {
  background:transparent; color:var(--ink-4);
  font-size:11.5px; font-weight:600; letter-spacing:.01em; text-transform:none;
  border-bottom:1px solid var(--line-2);
}
`;

const InteractionsTab = ({
  selectedRange,
  rangePhrase,
}: {
  selectedRange: { from: string; to: string };
  /** How the selected range reads in a sentence — "today", "yesterday", "in this range". */
  rangePhrase: string;
}) => {
  // Falls back to a realistic dummy dataset only when the account genuinely
  // has no calls in this range — see `use-performance-call-stats.ts`.
  const callStats = usePerformanceCallStats(selectedRange);
  const isPending = callStats.isSample && callStats.isRealPending;
  const showSample = callStats.isSample && !callStats.isRealPending;

  const kindCounts: Record<CallKind, number> = useMemo(
    () => countKinds(callStats.rows || []),
    [callStats.rows],
  );

  const classified = KINDS.reduce((sum, kind) => sum + kindCounts[kind.key], 0);
  const incoming = kindCounts.answered + kindCounts.missed + kindCounts.voicemail;
  const missedShare = share(kindCounts.missed, incoming);
  const answeredTalkCalls = (callStats.rows || []).filter((row: any) => callTalkSeconds(row) > 0)
    .length;

  const splitItems: PerfSplitItem[] = KINDS.filter(
    (kind) => kind.key !== 'other' || kindCounts.other > 0,
  ).map((kind) => ({
    key: kind.key,
    label: kind.label,
    color: kind.color,
    count: kindCounts[kind.key],
  }));

  const rangeLabel = rangePhrase === 'in this range' ? 'in the selected range' : rangePhrase;
  const dash = (value: string) => (isPending ? '—' : value);

  return (
    <div className="pf-wrap">
      <style>{CL_CSS}</style>

      <div className="pf-band pf-band--wide-hero">
        <PerfHero
          eyebrow="Call activity"
          title="Every call, accounted for."
          copy="How calls came in, how quickly they were picked up, and what they cost."
        >
          <PerfSplit
            value={String(classified)}
            caption={
              callStats.isQueueBreakdownSampled
                ? `most recent calls ${rangePhrase}`
                : `calls ${rangePhrase}`
            }
            items={splitItems}
            pending={isPending}
          />
        </PerfHero>

        <div className="pf-stats pf-stats--3">
          <PerfStat
            icon={Phone}
            label="Total calls"
            value={dash(String(callStats.totalCalls))}
            sub={rangeLabel}
          />
          <PerfStat
            icon={PhoneIncoming}
            label="Answered"
            value={dash(String(kindCounts.answered))}
            sub={
              isPending
                ? 'incoming, picked up'
                : incoming
                  ? `${share(kindCounts.answered, incoming)}% of incoming picked up`
                  : 'no incoming calls'
            }
          />
          <PerfStat
            icon={PhoneMissed}
            label="Missed"
            value={dash(String(kindCounts.missed))}
            sub={
              isPending
                ? 'incoming, not picked up'
                : incoming
                  ? `${missedShare}% of incoming`
                  : 'no incoming calls'
            }
            warn={!isPending && missedShare > MISSED_ALERT_PERCENT}
          />
          <PerfStat
            icon={Clock3}
            label="Avg wait time"
            value={
              isPending || callStats.avgWaitSec === null
                ? '—'
                : formatSecsToClock(callStats.avgWaitSec)
            }
            sub="before answer"
          />
          <PerfStat
            icon={TimerIcon}
            label="Avg call duration"
            value={
              isPending || callStats.avgHandleSec === null
                ? '—'
                : formatSecsToClock(callStats.avgHandleSec)
            }
            sub={
              isPending
                ? 'per connected call'
                : answeredTalkCalls
                  ? `across ${answeredTalkCalls} connected calls`
                  : 'no connected calls yet'
            }
          />
          <PerfStat
            icon={CircleDollarSign}
            label="Total call charge"
            value={dash(`$${callStats.totalCharge.toFixed(2)}`)}
            sub={
              callStats.isQueueBreakdownSampled
                ? `most recent ${callStats.sampledRowCount} calls`
                : rangeLabel
            }
          />
        </div>
      </div>

      {showSample && (
        <PerfNotice>
          Showing sample call figures — real totals appear once calls land in this range. The call
          log below lists your real calls.
        </PerfNotice>
      )}
      {!showSample && callStats.isQueueBreakdownSampled && (
        <PerfNotice quiet>
          This range holds more calls than one page of the log. Answered, missed, the split,
          averages and charge are counted from the most recent {callStats.sampledRowCount}; total
          calls covers the whole range.
        </PerfNotice>
      )}

      <section className="pf-panel cl-panel">
        <header className="pf-panel-head">
          <div className="pf-panel-title">
            <h3>Call log</h3>
            <p>Search, filter, play back or download individual calls.</p>
          </div>
        </header>
        <div className="cl-body">
          <CallHistory
            key={`${selectedRange.from}_${selectedRange.to}`}
            embedded
            hideDateFilter
            initialDateFilter={selectedRange}
            tableCustomClass="cl-table"
          />
        </div>
      </section>
    </div>
  );
};

export default InteractionsTab;
