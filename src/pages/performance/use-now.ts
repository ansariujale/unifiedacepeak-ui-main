import { useSyncExternalStore } from 'react';

/**
 * One clock for every live readout on a page. Each call's timer, pace bar and
 * the longest-call figure read the same second, so two timers for the same
 * call can't disagree, and a new one shows its real elapsed time on its first
 * paint rather than starting from 00:00. The interval only runs while
 * something is reading it.
 */
let now = Date.now();
let timer: ReturnType<typeof setInterval> | null = null;
const listeners = new Set<() => void>();

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  if (!timer) {
    now = Date.now();
    timer = setInterval(() => {
      now = Date.now();
      listeners.forEach((notify) => notify());
    }, 1000);
  }
  return () => {
    listeners.delete(listener);
    if (!listeners.size && timer) {
      clearInterval(timer);
      timer = null;
    }
  };
};

const getSnapshot = () => now;

export const useNow = () => useSyncExternalStore(subscribe, getSnapshot);

/** Elapsed seconds as a clock: "04:12", or "1:02:45" once a call passes an hour. */
export const formatElapsed = (totalSeconds: number) => {
  const seconds = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const rest = seconds % 60;
  const mmss = `${String(minutes).padStart(2, '0')}:${String(rest).padStart(2, '0')}`;
  return hours ? `${hours}:${mmss}` : mmss;
};

export default useNow;
