import type { ComponentType, ReactNode } from 'react';
import { Info } from 'lucide-react';
import './perf-surface.css';

/** The standing statement a view opens with, and the one picture it carries. */
export const PerfHero = ({
  eyebrow,
  title,
  copy,
  children,
}: {
  eyebrow: string;
  title: string;
  copy: string;
  children?: ReactNode;
}) => (
  <section className="pf-hero">
    <span className="pf-hero-chip">
      <i aria-hidden="true" />
      {eyebrow}
    </span>
    <h2 className="pf-hero-title">{title}</h2>
    <p className="pf-hero-copy">{copy}</p>
    {children}
  </section>
);

export type PerfSplitItem = {
  key: string;
  label: string;
  color: string;
  count: number;
  /** Optional aside after the label, e.g. a share of the whole. */
  note?: string;
};

/**
 * A whole split into parts that genuinely sum to it — the bar is only honest
 * when the items don't overlap, so callers pass mutually exclusive groups.
 */
export const PerfSplit = ({
  value,
  caption,
  items,
  pending = false,
}: {
  value: string;
  caption: string;
  items: PerfSplitItem[];
  /** Figures not in yet — draw the key without counts rather than a guess. */
  pending?: boolean;
}) => (
  <div className="pf-split">
    <div className="pf-split-head">
      <b>{pending ? '—' : value}</b>
      {caption}
    </div>
    <div
      className="pf-split-bar"
      role="img"
      aria-label={
        pending
          ? 'Loading'
          : items.map((item) => `${item.count} ${item.label.toLowerCase()}`).join(', ')
      }
    >
      {!pending &&
        items.map((item) =>
          item.count ? (
            <i key={item.key} style={{ flex: item.count, background: item.color }} />
          ) : null,
        )}
    </div>
    <ul className="pf-split-keys">
      {items.map((item) => (
        <li key={item.key}>
          <i style={{ background: item.color }} aria-hidden="true" />
          {item.label}
          {item.note ? <em>{item.note}</em> : null}
          <b>{pending ? '—' : item.count}</b>
        </li>
      ))}
    </ul>
  </div>
);

export const PerfStat = ({
  icon: Icon,
  label,
  value,
  sub,
  warn = false,
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  value: string;
  sub?: string;
  warn?: boolean;
}) => (
  <div className={`pf-stat${warn ? ' is-warn' : ''}`}>
    <div className="pf-stat-head">
      <span className="pf-stat-chip" aria-hidden="true">
        <Icon />
      </span>
      <span className="pf-stat-k">{label}</span>
    </div>
    <div className="pf-stat-v" title={value}>
      {value}
    </div>
    {sub && <div className="pf-stat-d">{sub}</div>}
  </div>
);

export const PerfNotice = ({
  quiet = false,
  children,
}: {
  quiet?: boolean;
  children: ReactNode;
}) => (
  <p className={`pf-notice${quiet ? ' pf-notice--quiet' : ''}`}>
    <Info aria-hidden="true" />
    <span>{children}</span>
  </p>
);
