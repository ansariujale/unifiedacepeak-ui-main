import { useMemo } from 'react';
import { useCallStats, computeCallStats } from '@/hooks/use-call-stats';
import {
  buildDummyCdrRows,
  buildDummyCallStatsSummary,
  type DummyEntityAgent,
  type DummyEntityQueue,
} from './dummy-call-data';

/**
 * Performance-only wrapper around the shared `useCallStats` hook.
 *
 * A brand-new or test account has no call history yet, which left every
 * range-based figure across Performance's tabs (Answered, Abandon rate, Avg
 * handle time, call charges, the Reports table...) reading 0 or "—". This
 * layers a realistic dummy dataset on top — only when the real range
 * genuinely has no calls in it — so the page has something to actually show.
 *
 * It deliberately does not touch `useCallStats` or `useLiveContactCentre`
 * themselves: Home's own dashboard reads those same hooks directly, and
 * showing it fabricated numbers was never asked for. This hook is only used
 * from inside `pages/performance/*`.
 */
export const usePerformanceCallStats = (
  selectedRange: { from: string; to: string },
  entities?: { queues?: DummyEntityQueue[]; agents?: DummyEntityAgent[] },
) => {
  const real = useCallStats(selectedRange);

  const queueKey = (entities?.queues || []).map((q) => q.uuid).join(',');
  const agentKey = (entities?.agents || []).map((a) => a.extension).join(',');

  return useMemo(() => {
    /* `isSample` lets a view say the figures are demo data rather than pass
       them off as the account's own; `isRealPending` says the real query hasn't
       answered yet, so "this range has no calls" isn't actually known. */
    if (real.totalCalls > 0) return { ...real, isSample: false, isRealPending: real.isPending };
    const rows = buildDummyCdrRows(entities?.queues || [], entities?.agents || []);
    const summary = buildDummyCallStatsSummary(rows);
    return {
      ...computeCallStats(rows, summary, rows.length, false),
      isSample: true,
      isRealPending: real.isPending,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [real, queueKey, agentKey]);
};

export default usePerformanceCallStats;
