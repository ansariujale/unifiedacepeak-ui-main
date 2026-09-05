import type { ReactNode } from 'react';
import Sparkline from './sparkline';

/**
 * The stat tile every Performance tab is built from, on the MCM Unified
 * Console design system (`.stat` in `components/mcm/mcm-page.css`).
 * Tone maps onto the shared status tokens rather than raw colours so light
 * and dark stay in step.
 */
export type StatCardTone = 'default' | 'warning' | 'danger' | 'success';

const TONE_STYLE: Record<StatCardTone, string | undefined> = {
  default: undefined,
  warning: 'var(--warn)',
  danger: 'var(--crit)',
  success: 'var(--live)',
};

const PerfStatCard = ({
  label,
  value,
  sub,
  icon: Icon,
  tone = 'default',
  portrait = false,
  series,
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  icon?: any;
  tone?: StatCardTone;
  /** Taller layout with the chart on the floor of the card. */
  portrait?: boolean;
  /**
   * Real measurements over time, oldest first. Left undefined for a metric
   * that has no history behind it — the card then simply has no chart, rather
   * than a shape invented to fill the space.
   */
  series?: number[];
}) => (
  <div className={`stat${portrait ? ' stat-portrait' : ''}`}>
    <div
      style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}
    >
      <span className="k">{label}</span>
      {Icon && (
        <span
          style={{
            display: 'grid',
            placeItems: 'center',
            width: 22,
            height: 22,
            flex: 'none',
            borderRadius: 99,
            background: 'var(--accent-wash)',
            color: 'var(--accent-ink)',
          }}
        >
          <Icon style={{ width: 13, height: 13 }} />
        </span>
      )}
    </div>
    <div className="v num" style={{ color: TONE_STYLE[tone] }}>
      {value}
    </div>
    {sub && (
      <div className="d" style={{ color: 'var(--ink-3)', fontWeight: 500 }}>
        {sub}
      </div>
    )}
    {portrait && series && <Sparkline points={series} tone={TONE_STYLE[tone]} />}
  </div>
);

export default PerfStatCard;
