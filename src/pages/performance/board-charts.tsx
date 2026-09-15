import './board-charts.css';

/**
 * The graphics Performance ▸ Boards is built from. Each one draws only the
 * numbers it is handed: an empty series says so in words rather than as a
 * decorative shape, and a pending one draws nothing at all.
 */

export type ChartItem = { key: string; label: string; color: string; count: number };

/** A tiny per-bucket histogram, with its busiest bucket picked out. */
export const MicroColumns = ({
  series,
  tone = 'var(--accent)',
  pending = false,
}: {
  series: number[];
  tone?: string;
  pending?: boolean;
}) => {
  const peak = Math.max(0, ...series);
  const peakIndex = series.indexOf(peak);
  return (
    <div className="bc-micro" style={{ ['--bc-tone' as string]: tone }} aria-hidden="true">
      {series.map((value, index) => (
        <i
          key={index}
          className={!pending && peak > 0 && index === peakIndex ? 'is-peak' : undefined}
          style={{ height: `${pending || !peak ? 0 : Math.max(value ? 10 : 0, (value / peak) * 100)}%` }}
        />
      ))}
    </div>
  );
};

/**
 * One column per period, split by how the calls in it ended. Only the periods
 * in `window` are drawn — a day's calls sit in its working hours, and drawing
 * midnight to eight as empty columns squeezes the ones that matter.
 */
export const StackedColumns = ({
  stacks,
  kinds,
  window,
  labelOf,
  pending = false,
  emptyText,
}: {
  /** Counts per period, keyed by the `kinds` keys. */
  stacks: Record<string, number>[];
  kinds: { key: string; label: string; color: string }[];
  /** First and last period index to draw, inclusive. */
  window: [number, number];
  labelOf: (index: number) => string;
  pending?: boolean;
  emptyText: string;
}) => {
  const [start, end] = window;
  const shown = stacks.slice(start, end + 1);
  const totals = shown.map((stack) => kinds.reduce((sum, kind) => sum + (stack[kind.key] || 0), 0));
  const peak = Math.max(0, ...totals);
  const hasData = !pending && peak > 0;
  const count = shown.length;
  const tickIndexes = Array.from(
    new Set([0, Math.round((count - 1) / 3), Math.round(((count - 1) * 2) / 3), count - 1]),
  );

  return (
    <div className="bc-cols-chart">
      <div className="bc-cols-frame">
        <div className="bc-cols-scale" aria-hidden="true">
          <span>{hasData ? peak : ''}</span>
          <span>{hasData ? Math.round(peak / 2) : ''}</span>
          <span>{hasData ? 0 : ''}</span>
        </div>
        <div className="bc-cols-plot" role="img" aria-label={hasData ? 'Calls per period, by how they ended' : emptyText}>
          {hasData && (
            <div className="bc-cols">
              {shown.map((stack, offset) => {
                const index = start + offset;
                const total = totals[offset];
                const detail = kinds
                  .filter((kind) => stack[kind.key])
                  .map((kind) => `${stack[kind.key]} ${kind.label.toLowerCase()}`)
                  .join(' · ');
                return (
                  <span
                    key={index}
                    className="bc-col"
                    style={{ height: `${(total / peak) * 100}%` }}
                    title={`${labelOf(index)} — ${total} ${total === 1 ? 'call' : 'calls'}${detail ? `: ${detail}` : ''}`}
                  >
                    {kinds.map((kind) =>
                      stack[kind.key] ? (
                        <i
                          key={kind.key}
                          style={{ flexGrow: stack[kind.key], flexBasis: 0, minHeight: 3, background: kind.color }}
                        />
                      ) : null,
                    )}
                  </span>
                );
              })}
            </div>
          )}
          {!pending && !hasData && <span className="bc-empty">{emptyText}</span>}
        </div>
      </div>
      <div className="bc-cols-axis" aria-hidden="true">
        {tickIndexes.map((offset) => (
          <span key={offset}>{labelOf(start + offset)}</span>
        ))}
      </div>
    </div>
  );
};

/** A chart's key: one swatch per kind. */
export const ChartKeys = ({ kinds }: { kinds: { key: string; label: string; color: string }[] }) => (
  <ul className="bc-keys">
    {kinds.map((kind) => (
      <li key={kind.key}>
        <i style={{ background: kind.color }} aria-hidden="true" />
        {kind.label}
      </li>
    ))}
  </ul>
);

/** One horizontal bar per item, each measured against the whole. */
export const BarRows = ({
  items,
  total,
  pending = false,
}: {
  items: ChartItem[];
  total: number;
  pending?: boolean;
}) => (
  <ul className="bc-rows">
    {items.map((item) => (
      <li key={item.key}>
        <span>{item.label}</span>
        <em aria-hidden="true">
          <i style={{ width: `${pending || !total ? 0 : (item.count / total) * 100}%`, background: item.color }} />
        </em>
        <b>{pending ? '—' : item.count}</b>
      </li>
    ))}
  </ul>
);

/** Parts of a whole side by side in a single bar; nothing to split draws an empty track. */
export const SplitBar = ({ items, pending = false }: { items: ChartItem[]; pending?: boolean }) => {
  const parts = pending ? [] : items.filter((item) => item.count > 0);
  return (
    <div
      className="bc-split"
      role="img"
      aria-label={parts.map((item) => `${item.label} ${item.count}`).join(', ') || 'Nothing to show yet'}
    >
      {parts.map((item) => (
        <i key={item.key} style={{ flex: item.count, background: item.color }} />
      ))}
    </div>
  );
};

/** One segment per item, lit for the ones that are on. */
export const ProgressSegments = ({ total, on, max = 24 }: { total: number; on: number; max?: number }) => {
  const shown = Math.max(1, Math.min(total, max));
  const lit = total > max ? Math.round((on / total) * max) : on;
  return (
    <div className="bc-progress" aria-hidden="true">
      {Array.from({ length: shown }, (_, index) => (
        <i key={index} className={total && index < lit ? 'is-on' : undefined} />
      ))}
    </div>
  );
};

/**
 * Fifty dots, each two per cent of the whole, handed out by largest remainder
 * so they always add up to fifty.
 */
export const DotMatrix = ({ items, pending = false }: { items: ChartItem[]; pending?: boolean }) => {
  const CELLS = 50;
  const total = items.reduce((sum, item) => sum + item.count, 0);
  const exact = items.map((item) => (total ? (item.count / total) * CELLS : 0));
  const whole = exact.map(Math.floor);
  let left = total ? CELLS - whole.reduce((sum, value) => sum + value, 0) : 0;
  exact
    .map((value, index) => ({ index, remainder: value - Math.floor(value) }))
    .sort((a, b) => b.remainder - a.remainder)
    .forEach(({ index }) => {
      if (left > 0 && items[index].count > 0) {
        whole[index] += 1;
        left -= 1;
      }
    });
  const cells: string[] = [];
  if (!pending) {
    items.forEach((item, index) => {
      for (let cell = 0; cell < whole[index]; cell += 1) cells.push(item.color);
    });
  }
  return (
    <div
      className="bc-dots"
      role="img"
      aria-label={
        total
          ? items.map((item) => `${item.label} ${Math.round((item.count / total) * 100)}%`).join(', ')
          : 'No calls'
      }
    >
      {Array.from({ length: CELLS }, (_, index) => (
        <i key={index} style={cells[index] ? { background: cells[index] } : undefined} />
      ))}
    </div>
  );
};
