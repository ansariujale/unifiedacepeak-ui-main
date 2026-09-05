import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import moment from 'moment';
import Timer from '@/components/timer';
import { Ic, McmIconSprite } from '@/components/mcm/icons';

export type WallboardTile = {
  key: string;
  label: string;
  value: string;
  /** Live-timer tiles render a ticking clock instead of a static value. */
  timerStart?: number | null;
  /** Breaching its target — renders on the wallboard's critical treatment. */
  warn?: boolean;
  /** Comfortably inside target — renders on the wallboard's healthy treatment. */
  good?: boolean;
  /**
   * Optional three-level reading, for figures the console already grades more
   * finely than warn/good can carry. A service level of 73% is under target
   * but not critical; without this the wall would paint it the same red as a
   * 20% abandon rate while the KPI strip behind it shows amber.
   */
  tone?: 'good' | 'warn' | 'crit';
};

export type WallboardQueueRow = {
  uuid: string;
  name: string;
  waiting: number;
  longestWaitTimestamp: number | null;
  sla: number | null;
  handledToday: number | null;
};

/**
 * Both thresholds mirror the console behind the wallboard
 * (`performance/index.tsx`: `longestWaitSecs > 120`, "target 80% in 20s").
 * They live here as named constants so the wall and the page can't drift into
 * calling the same number healthy on one surface and breaching on the other.
 */
const BREACH_SECONDS = 120;
const SLA_TARGET = 80;

type Tone = 'good' | 'warn' | 'crit' | 'muted';

const slaTone = (sla: number | null): Tone => {
  if (sla === null) return 'muted';
  if (sla >= SLA_TARGET) return 'good';
  if (sla >= 60) return 'warn';
  return 'crit';
};

const tileTone = (tile?: WallboardTile): Tone => {
  if (!tile) return 'muted';
  if (tile.tone) return tile.tone;
  if (tile.warn) return 'crit';
  if (tile.good) return 'good';
  return 'muted';
};

/**
 * Counts are padded to two digits — "02", not "2".
 *
 * Every figure on the wall then occupies the same width whether it is showing
 * 2 or 12, so nothing shifts sideways as the numbers tick and the eye can sit
 * on one spot on the wall. Anything that isn't a bare single digit (times,
 * percentages, three-figure counts) is left exactly as it came.
 */
const padCount = (value: string) => (/^\d$/.test(value) ? `0${value}` : value);

/**
 * The wall is usually mounted on a room screen that nobody logs into, so the
 * choice has to survive a reopen without a round trip to the account. Reads
 * are wrapped because a locked-down browser profile throws on access rather
 * than returning null.
 */
const THEME_STORAGE_KEY = 'mcm-wallboard-theme';

const readStoredTheme = (): 'dark' | 'light' => {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    if (stored === 'light' || stored === 'dark') return stored;
  } catch {
    /* private mode / blocked site data — fall through to the room default */
  }
  return 'light';
};

/**
 * Seconds since `startTime`, ticking once a second.
 *
 * Deliberately the same `moment().diff(...)` the shared <Timer> uses, so the
 * breach reading and the clock beside it are always working from the same
 * elapsed figure rather than two subtly different ones.
 */
const useElapsedSeconds = (startTime?: number | null) => {
  const [seconds, setSeconds] = useState(0);

  useEffect(() => {
    if (!startTime) {
      setSeconds(0);
      return;
    }
    const read = () => setSeconds(Math.max(0, moment().diff(moment(startTime), 'seconds')));
    read();
    const interval = setInterval(read, 1000);
    return () => clearInterval(interval);
  }, [startTime]);

  return seconds;
};

/**
 * Room-facing wallboard — the full-screen takeover launched from Performance.
 *
 * Deliberately built without cards or panels: the figures sit straight on the
 * page and hairline rules do the dividing. At wall distance a border around
 * every number is just noise competing with the number, so structure comes
 * from type size, alignment and whitespace instead.
 *
 * The ordering is the point — the two figures that demand action now (who is
 * holding, and for how long) take the top band at display size, the four
 * supporting rates share the strip below, and the per-queue detail fills the
 * rest. Every figure is the same live data the KPI strip behind it reads, so
 * the wall and the console can never disagree.
 */
const Wallboard = ({
  tiles,
  queues,
  onClose,
}: {
  tiles: WallboardTile[];
  queues: WallboardQueueRow[];
  onClose: () => void;
}) => {
  const [clock, setClock] = useState(() => new Date());
  const [theme, setTheme] = useState<'dark' | 'light'>(readStoredTheme);

  useEffect(() => {
    const interval = setInterval(() => setClock(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(THEME_STORAGE_KEY, theme);
    } catch {
      /* not being able to remember the choice shouldn't break the wall */
    }
  }, [theme]);

  // Full-screen takeover — stop the page behind it drifting under the overlay.
  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  // Esc closes, matching the "Esc" affordance in the header.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  /* ---- which tile goes where -------------------------------------------
     Picked by key so the meaning drives the layout, with a positional
     fallback so an extra or renamed tile still lands somewhere sensible
     instead of vanishing off the wall. */
  const { lead, second, strip } = useMemo(() => {
    const byKey = new Map(tiles.map((tile) => [tile.key, tile]));
    const leadTile = byKey.get('waiting') ?? tiles[0];
    const secondTile = byKey.get('longest') ?? tiles.find((tile) => tile !== leadTile);
    return {
      lead: leadTile,
      second: secondTile,
      strip: tiles.filter((tile) => tile !== leadTile && tile !== secondTile),
    };
  }, [tiles]);

  const longestSeconds = useElapsedSeconds(second?.timerStart);
  const secondTone = tileTone(second);

  /* The headline count and the per-queue counts are two different reads — a
     call that is waiting but not yet matched to a queue lands in the first and
     not the second. When they disagree the wall has to say so: showing "02"
     over an "all clear" line is how a supervisor learns to distrust it. */
  const queueWaiting = queues.reduce((sum, queue) => sum + (queue.waiting || 0), 0);
  const leadCount = Number.parseInt(lead?.value ?? '', 10);
  const waitingCount = Number.isFinite(leadCount) ? leadCount : queueWaiting;
  const unrouted = waitingCount > 0 && queueWaiting === 0;

  const waitingCaption = () => {
    if (waitingCount === 0) return 'all clear';
    if (unrouted) return 'awaiting routing';
    return waitingCount === 1 ? 'customer' : 'customers';
  };

  const answeredTotal = queues.reduce((sum, queue) => sum + (queue.handledToday ?? 0), 0);

  return createPortal(
    <div
      className={`mcm-wall${theme === 'light' ? ' is-light' : ''}`}
      role="dialog"
      aria-modal="true"
      aria-label="Contact centre wallboard"
    >
      {/* The sprite lives on the page root, which this portal escapes. */}
      <McmIconSprite />

      <header className="wh">
        <div className="w-brand">
          <span className="w-live">
            <i className="w-beacon" aria-hidden="true" />
            Live
          </span>
          <h2>Wallboard</h2>
          <span className="w-brand-sub">Contact Centre</span>
        </div>

        {/* Centred at the top and nearly transparent: on a wall nobody is
            standing at, this only needs to answer "how do I get out of this?"
            for whoever walks up to it. It resolves into a real button on
            hover — the wall is as likely to be closed with a mouse as with
            the key. */}
        <button type="button" className="w-exit" onClick={onClose}>
          <kbd>Esc</kbd>
          <span>to exit</span>
        </button>

        <div className="w-head-right">
          <div className="w-clock-row">
            <div className="w-theme" role="group" aria-label="Wallboard appearance">
              <button
                type="button"
                className={theme === 'light' ? 'is-on' : ''}
                aria-pressed={theme === 'light'}
                title="Light"
                onClick={() => setTheme('light')}
              >
                <Ic n="sun" />
                <span className="w-sr">Light</span>
              </button>
              <button
                type="button"
                className={theme === 'dark' ? 'is-on' : ''}
                aria-pressed={theme === 'dark'}
                title="Dark"
                onClick={() => setTheme('dark')}
              >
                <Ic n="moon" />
                <span className="w-sr">Dark</span>
              </button>
            </div>

            {/* A two-column grid, so the date sits over the hours and minutes
                rather than over the whole clock — right-aligning both against
                the block would push the date out over the seconds. */}
            <div className="w-clock">
              <span className="w-date">{moment(clock).format('dddd, D MMMM')}</span>
              <span className="w-clock-time">{moment(clock).format('HH:mm')}</span>
              <span className="w-clock-secs">{moment(clock).format('ss')}s</span>
            </div>
          </div>
        </div>
      </header>

      <section className="w-hero">
        <div className="w-hero-cell">
          <span className="w-label">{lead?.label ?? 'Waiting'}</span>
          {/* Healthy until the queue depth trips the tile's own threshold —
              the console sets `warn` at more than five holding. */}
          <div className={`w-display tone-${lead?.warn ? 'crit' : 'good'}`}>
            {lead?.timerStart ? (
              <Timer startTime={lead.timerStart} />
            ) : (
              padCount(lead?.value ?? '0')
            )}
          </div>
          <span className={`w-hero-foot${unrouted ? ' is-pending' : ''}`}>{waitingCaption()}</span>
        </div>

        <div className="w-hero-cell">
          <span className="w-label">{second?.label ?? 'Longest wait'}</span>
          <div className={`w-display tone-${secondTone}`}>
            {second?.timerStart ? <Timer startTime={second.timerStart} /> : (second?.value ?? '—')}
          </div>
          {second?.timerStart ? (
            <span className={`w-hero-foot is-status tone-${secondTone}`}>
              <i className="w-dot" aria-hidden="true" />
              {second.warn
                ? 'Breaching'
                : `${Math.max(0, BREACH_SECONDS - longestSeconds)}s to target`}
            </span>
          ) : (
            <span className="w-hero-foot">nobody holding</span>
          )}
        </div>
      </section>

      {strip.length > 0 && (
        <section className="w-strip">
          {strip.map((tile) => (
            <div key={tile.key} className="w-cell">
              <span className={`w-cell-value tone-${tileTone(tile)}`}>
                {tile.timerStart ? <Timer startTime={tile.timerStart} /> : padCount(tile.value)}
              </span>
              <span className="w-label">{tile.label}</span>
            </div>
          ))}
        </section>
      )}

      <section className="w-queues">
        <div className="w-qhead">
          <h3>Queues</h3>
          <span className="w-qmeta">
            {queues.length} active <i aria-hidden="true">·</i> {answeredTotal} handled today
          </span>
        </div>

        <div className="w-table">
          <table>
            <thead>
              <tr>
                <th>Queue</th>
                <th className="mid">Waiting</th>
                <th className="mid">Longest</th>
                <th className="sla">
                  Service level
                  <span className="w-th-note">{SLA_TARGET}% target</span>
                </th>
                <th className="end">Handled</th>
              </tr>
            </thead>
            <tbody>
              {queues.length === 0 && (
                <tr>
                  <td colSpan={5} className="w-empty">
                    No queues configured yet
                  </td>
                </tr>
              )}
              {queues.map((queue) => {
                const tone = slaTone(queue.sla);
                return (
                  <tr key={queue.uuid}>
                    <td>
                      <span className={`w-queue-name tone-${tone}`}>
                        <i className="w-dot" aria-hidden="true" />
                        {queue.name}
                      </span>
                    </td>
                    <td className="mid">
                      <span className={queue.waiting > 0 ? 'w-hot' : 'w-zero'}>
                        {padCount(String(queue.waiting))}
                      </span>
                    </td>
                    <td className="mid">
                      {queue.longestWaitTimestamp ? (
                        <Timer startTime={queue.longestWaitTimestamp} />
                      ) : (
                        <span className="w-zero">—</span>
                      )}
                    </td>
                    <td className="sla">
                      <div className={`w-sla tone-${tone}`}>
                        <span className="w-sla-value">
                          {queue.sla === null ? '—' : `${Math.round(queue.sla)}%`}
                        </span>
                        {/* The tick is the 80% target, so a queue's standing is
                            readable from the bar alone at wall distance. */}
                        <span
                          className="w-meter"
                          style={{ '--target': `${SLA_TARGET}%` } as React.CSSProperties}
                        >
                          <i
                            style={{
                              width: `${queue.sla === null ? 0 : Math.min(100, queue.sla)}%`,
                            }}
                          />
                        </span>
                      </div>
                    </td>
                    <td className="end">
                      {queue.handledToday === null ? (
                        <span className="w-zero">—</span>
                      ) : (
                        padCount(String(queue.handledToday))
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>,
    document.body,
  );
};

export default Wallboard;
