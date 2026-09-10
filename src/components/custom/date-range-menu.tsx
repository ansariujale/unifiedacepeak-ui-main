import { useState } from 'react';
import { Calendar, Check } from 'lucide-react';

export type DateRangeOption<T extends string = string> = { label: string; value: T };

/**
 * The date filter used by the phone console's call list and the web chat
 * manager's queue: a bordered icon button that opens a short preset list.
 *
 * Shared rather than duplicated so the two pages cannot drift — the phone had
 * this inline and the agent chat had a `CustomSelect`, which is why they looked
 * like different controls doing the same job. Callers keep their own option
 * lists and state; this owns only the open/closed presentation.
 */
const DateRangeMenu = <T extends string>({
  options,
  value,
  onChange,
  label = 'Filter by date',
}: {
  options: DateRangeOption<T>[];
  value: T;
  onChange: (next: T) => void;
  label?: string;
}) => {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative shrink-0">
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={label}
        title={label}
        onClick={() => setOpen((prev) => !prev)}
        className="flex h-[34px] w-[34px] items-center justify-center rounded-[9px] border border-gray-200 bg-white text-gray-500 shadow-[0_1px_3px_rgba(17,17,17,0.06)] transition-colors hover:border-primary hover:text-primary"
      >
        <Calendar className="h-[15px] w-[15px]" />
      </button>

      {open ? (
        <>
          {/* A full-screen catcher, so clicking anywhere else closes the menu
              without every caller needing an outside-click listener. */}
          <div
            className="fixed inset-0 z-40"
            aria-hidden
            onClick={() => setOpen(false)}
          />
          <div
            role="listbox"
            aria-label={label}
            className="absolute right-0 top-10 z-50 min-w-[170px] rounded-xl border border-gray-200 bg-white p-1.5 shadow-[0_10px_28px_rgba(17,17,17,0.14)]"
          >
            {options.map((option) => {
              const active = option.value === value;
              return (
                <button
                  key={option.value}
                  type="button"
                  role="option"
                  aria-selected={active}
                  onClick={() => {
                    onChange(option.value);
                    setOpen(false);
                  }}
                  className={`flex w-full cursor-pointer items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[13px] transition-colors ${
                    active
                      ? 'bg-gray-100 font-bold text-black'
                      : 'font-medium text-gray-600 hover:bg-rose-100 hover:text-primary'
                  }`}
                >
                  <span className="flex-1">{option.label}</span>
                  {active ? <Check className="h-3 w-3" /> : null}
                </button>
              );
            })}
          </div>
        </>
      ) : null}
    </div>
  );
};

export default DateRangeMenu;
