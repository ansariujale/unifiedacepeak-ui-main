/* A custom analog clock-face time picker.
 *
 * Native `<input type="time">` cannot be restyled or repositioned — the popup
 * it opens is rendered by the browser/OS outside the page, so no CSS reaches
 * it. This component reproduces the same "HH:mm" 24-hour value contract but
 * renders its own dropdown: a real clock dial (tap an hour, then a minute)
 * with a digital readout and AM/PM switch above it, so every pixel is ours
 * to theme.
 *
 * Picks are drafted locally and only reach the form on OK — Cancel (or a
 * click outside) discards them, same as the reference clock picker this
 * was modelled on.
 */

import { useEffect, useRef, useState } from 'react';
import { Clock } from 'lucide-react';
import { cn } from '@/lib/utils';

interface TimePickerProps {
  /** 24-hour "HH:mm", e.g. "14:30". Matches the native time input's value format. */
  value?: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

const PERIODS = ['AM', 'PM'] as const;
type Period = (typeof PERIODS)[number];

const to12Hour = (value?: string) => {
  if (!value) return { hour: 10, minute: 0, period: 'AM' as Period };
  const [rawHour, rawMinute] = value.split(':').map(Number);
  const period: Period = rawHour >= 12 ? 'PM' : 'AM';
  const hour = rawHour % 12 === 0 ? 12 : rawHour % 12;
  return { hour, minute: rawMinute || 0, period };
};

const to24Hour = (hour: number, minute: number, period: Period) => {
  const base = hour % 12;
  const fullHour = period === 'PM' ? base + 12 : base;
  return `${String(fullHour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
};

const formatDisplay = (value?: string) => {
  if (!value) return '';
  const { hour, minute, period } = to12Hour(value);
  return `${hour}:${String(minute).padStart(2, '0')} ${period}`;
};

const DIAL_SIZE = 156;
const DIAL_CENTER = DIAL_SIZE / 2;
const DIAL_RADIUS = 60;

/* Twelve positions shared by both the hour ring (1-12) and the minute ring
   (00, 05, ... 55) — a real clock only ever shows twelve marks regardless of
   which one it is standing in for at the moment. Index 0 sits at 12 o'clock;
   the rest follow clockwise, 30° apart. */
const clockPosition = (index: number) => {
  const angle = index * 30;
  const rad = (angle * Math.PI) / 180;
  return {
    angle,
    x: DIAL_CENTER + DIAL_RADIUS * Math.sin(rad),
    y: DIAL_CENTER - DIAL_RADIUS * Math.cos(rad),
  };
};

const HOUR_MARKS = Array.from({ length: 12 }, (_, i) => ({ index: i, value: i === 0 ? 12 : i }));
const MINUTE_MARKS = Array.from({ length: 12 }, (_, i) => ({ index: i, value: i * 5 }));

export function TimePicker({
  value,
  onChange,
  placeholder = 'Select time',
  className,
  disabled,
}: TimePickerProps) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<'hour' | 'minute'>('hour');
  const containerRef = useRef<HTMLDivElement>(null);

  const [draftHour, setDraftHour] = useState(10);
  const [draftMinute, setDraftMinute] = useState(0);
  const [draftPeriod, setDraftPeriod] = useState<Period>('AM');

  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  const openPicker = () => {
    const current = to12Hour(value);
    setDraftHour(current.hour);
    setDraftMinute(current.minute);
    setDraftPeriod(current.period);
    setMode('hour');
    setOpen(true);
  };

  const handleOk = () => {
    onChange(to24Hour(draftHour, draftMinute, draftPeriod));
    setOpen(false);
  };

  const marks = mode === 'hour' ? HOUR_MARKS : MINUTE_MARKS;
  const selectedValue = mode === 'hour' ? draftHour : draftMinute;
  const selectedIndex = marks.find((mark) => mark.value === selectedValue)?.index ?? 0;
  const handAngle = clockPosition(selectedIndex).angle;

  return (
    <div ref={containerRef} className={cn('relative', className)}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => (open ? setOpen(false) : openPicker())}
        className="flex h-9 w-[118px] shrink-0 items-center justify-between gap-1 rounded-full border border-neutral-200 bg-white px-3 text-xs text-neutral-900 outline-none transition-colors focus-visible:border-black focus-visible:ring-4 focus-visible:ring-black/10 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <span className={cn(!value && 'text-neutral-400')}>
          {value ? formatDisplay(value) : placeholder}
        </span>
        <Clock className="h-3.5 w-3.5 shrink-0 text-neutral-500" />
      </button>

      {open && (
        <div className="absolute left-0 top-full z-50 mt-1.5 w-[196px] rounded-2xl border border-neutral-200 bg-white p-3 shadow-xl">
          {/* Digital readout: tap either half to jump straight to that ring. */}
          <div className="mb-3 flex items-center justify-center gap-1">
            <button
              type="button"
              onClick={() => setMode('hour')}
              className={cn(
                'rounded-lg px-1.5 py-0.5 text-lg font-bold tabular-nums transition-colors',
                mode === 'hour' ? 'bg-red-50 text-red-600' : 'text-neutral-900',
              )}
            >
              {String(draftHour).padStart(2, '0')}
            </button>
            <span className="text-lg font-bold text-neutral-300">:</span>
            <button
              type="button"
              onClick={() => setMode('minute')}
              className={cn(
                'rounded-lg px-1.5 py-0.5 text-lg font-bold tabular-nums transition-colors',
                mode === 'minute' ? 'bg-red-50 text-red-600' : 'text-neutral-900',
              )}
            >
              {String(draftMinute).padStart(2, '0')}
            </button>
            <div className="ml-1.5 flex flex-col overflow-hidden rounded-md border border-neutral-200">
              {PERIODS.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setDraftPeriod(p)}
                  className={cn(
                    'px-1.5 py-0.5 text-[10px] font-bold transition-colors',
                    draftPeriod === p
                      ? 'bg-red-600 text-white'
                      : 'bg-white text-neutral-400 hover:bg-neutral-50',
                  )}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>

          {/* Clock face */}
          <div
            className="relative mx-auto rounded-full bg-neutral-100"
            style={{ width: DIAL_SIZE, height: DIAL_SIZE }}
          >
            <div
              className="absolute bg-red-600"
              style={{
                left: DIAL_CENTER,
                top: DIAL_CENTER,
                width: 2,
                height: DIAL_RADIUS - 6,
                transformOrigin: 'top center',
                transform: `translateX(-50%) rotate(${handAngle + 180}deg)`,
              }}
            />
            <div
              className="absolute h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-red-600"
              style={{ left: DIAL_CENTER, top: DIAL_CENTER }}
            />
            {marks.map((mark) => {
              const { x, y } = clockPosition(mark.index);
              const isSelected = mark.value === selectedValue;
              return (
                <button
                  key={mark.value}
                  type="button"
                  onClick={() => {
                    if (mode === 'hour') {
                      setDraftHour(mark.value);
                      setMode('minute');
                    } else {
                      setDraftMinute(mark.value);
                    }
                  }}
                  className={cn(
                    'absolute flex h-6 w-6 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full text-[10px] font-semibold transition-colors',
                    isSelected ? 'bg-red-600 text-white' : 'text-neutral-700 hover:bg-neutral-200',
                  )}
                  style={{ left: x, top: y }}
                >
                  {String(mark.value).padStart(2, '0')}
                </button>
              );
            })}
          </div>

          <div className="mt-3 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="text-[11px] font-semibold text-neutral-500 hover:text-neutral-800"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleOk}
              className="rounded-full bg-neutral-900 px-3 py-1 text-[11px] font-bold text-white transition-colors hover:bg-black"
            >
              OK
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
