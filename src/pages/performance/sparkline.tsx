/**
 * A small area chart for the foot of a stat card.
 *
 * Deliberately dumb: it draws the numbers it is handed and nothing else. There
 * is no smoothing, no padding of short series and no synthetic baseline — a
 * card with no history to show renders no chart rather than a decorative
 * squiggle, because a shape that isn't data is worse than no shape at all.
 *
 * `preserveAspectRatio="none"` lets one viewBox stretch to whatever width the
 * card ends up at, so every card's chart lines up on the same baseline.
 */
const VIEW_W = 100;
const VIEW_H = 30;

const Sparkline = ({ points, tone }: { points: number[]; tone?: string }) => {
  // Two points is the minimum that can describe a change over time.
  if (!points || points.length < 2) return null;

  const peak = Math.max(...points);
  // An all-zero series is real information — it should read as a flat line on
  // the floor, not divide by zero or spike to the top.
  const scale = peak > 0 ? peak : 1;
  const step = VIEW_W / (points.length - 1);

  const coords = points.map((value, index) => {
    const x = index * step;
    const y = VIEW_H - (value / scale) * VIEW_H;
    return `${x.toFixed(2)},${y.toFixed(2)}`;
  });

  const line = `M${coords.join(' L')}`;
  const area = `${line} L${VIEW_W},${VIEW_H} L0,${VIEW_H} Z`;
  const gradientId = `spark-${points.length}-${Math.round(peak)}`;

  return (
    <svg
      className="stat-spark"
      viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
      preserveAspectRatio="none"
      aria-hidden="true"
      style={tone ? { color: tone } : undefined}
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="currentColor" stopOpacity="0.18" />
          <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${gradientId})`} stroke="none" />
      <path
        d={line}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
};

export default Sparkline;
