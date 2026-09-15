import { useEffect, useState } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import { Button } from '../ui/button';
import { cn } from '@/lib/utils';
import { CalendarIcon } from '@/assets/icons';
import { Calendar } from '../ui/calendar';
import moment from 'moment';
import { Label } from '../ui/label';
import ErrorTooltip from './error-tooltip';

interface CustomDatePickerProps {
  value?: Date | null;
  onChange?: (date: Date | undefined) => void;
  placeholder?: string;
  disabled?: boolean;
  minDate?: Date;
  maxDate?: Date;
  label?: React.ReactNode;
  error?: any;
  className?: string;
}

export function CustomDatePicker({
  value,
  onChange = () => {},
  placeholder = 'Pick a date',
  disabled = false,
  minDate,
  maxDate,
  label = null,
  error = '',
  className,
}: CustomDatePickerProps) {
  const [open, setOpen] = useState(false);
  /* Picking a day only stages it here — the field/form value doesn't
     change until "OK" commits it. Resyncs to the real value whenever
     the popover (re)opens, so a previous unconfirmed pick never leaks
     into the next time this is opened. */
  const [draft, setDraft] = useState<Date | undefined>(value ?? undefined);
  /* `value` is rebuilt as a fresh Date object on every parent render
     (moment(...).toDate() never returns the same instance twice), so
     depending on `value` itself re-fired this effect — and reset the
     in-progress pick — on almost every render while the popover was
     open, not just when the committed value actually changed. Keying
     off the timestamp instead only resyncs when the real value moves. */
  const valueTime = value ? value.getTime() : null;
  useEffect(() => {
    if (open) setDraft(value ?? undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, valueTime]);

  return (
    <div className="flex flex-col gap-1.5 w-full">
      {(label || error) && (
        <div className="flex items-center justify-between">
          <Label>{label}</Label>
          <div className="flex items-start ">{error && <ErrorTooltip text={error} />}</div>
        </div>
      )}

      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            disabled={disabled}
            className={cn(
              'w-full justify-between text-left font-normal px-3 border-gray-300 text-gray-900 hover:bg-white hover:border-primary hover:text-gray-900 gap-2',
              error && 'border-red-500 hover:border-red-500',
              className,
            )}
          >
            {value ? moment(value).format('YYYY-MM-DD') : <span>{placeholder}</span>}
            <CalendarIcon className="w-5 h-5 text-primary" />
          </Button>
        </PopoverTrigger>

        <PopoverContent
          className="p-0"
          align="start"
          style={{
            width: 'var(--radix-popover-trigger-width)',
            minWidth: '260px',
            maxWidth: '280px',
          }}
        >
          <Calendar
            mode="single"
            selected={draft}
            onSelect={setDraft}
            initialFocus
            /* Keeps the year/month dropdown from ever offering a year
               that's entirely disabled (e.g. Start Date can't predate
               today, so nothing before this year is pickable anyway) —
               without this, navigating into a fully-disabled year looks
               like a broken picker when really every day in it is
               correctly blocked by `disabled` below. */
            fromYear={minDate?.getFullYear()}
            toYear={maxDate?.getFullYear()}
            disabled={(date) => {
              if (minDate && moment(date).isBefore(moment(minDate).startOf('day'))) return true;
              if (maxDate && moment(date).isAfter(moment(maxDate).endOf('day'))) return true;
              return false;
            }}
            footer={
              <div className="flex items-center justify-between px-3 pt-2 text-sm font-medium">
                <button
                  type="button"
                  className="cursor-pointer text-red-500 hover:text-red-600"
                  onClick={() => setDraft(undefined)}
                >
                  Clear
                </button>
                <button
                  type="button"
                  className="cursor-pointer text-red-500 hover:text-red-600"
                  onClick={() => {
                    onChange(draft);
                    setOpen(false);
                  }}
                >
                  OK
                </button>
              </div>
            }
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}
