import * as React from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { DayPicker } from 'react-day-picker';

import { cn } from '@/lib/utils';
import { buttonVariants } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import './calendar.css';

/* Swaps react-day-picker's native <select> (month/year) for a real
   custom-rendered list — the only way to control its hover/selected
   colours, since a native select's own option-list chrome is drawn by
   the OS and can't be restyled via CSS in any browser. Built on the
   same `DropdownMenuItem` already used (and proven reliable) for every
   other menu in this app, rather than a fragile invisible-overlay-select
   trick, so this doesn't reintroduce the click-reliability issue that
   approach caused earlier. */
function CalendarDropdown({
  value,
  onChange,
  children,
  caption,
}: {
  value?: string | number;
  onChange?: React.ChangeEventHandler<HTMLSelectElement>;
  children?: React.ReactNode;
  caption?: React.ReactNode;
}) {
  const options = React.Children.toArray(children) as React.ReactElement<
    React.OptionHTMLAttributes<HTMLOptionElement>
  >[];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="inline-flex cursor-pointer items-center gap-0.5 text-sm font-medium"
        >
          {caption}
          <ChevronDown className="size-3 opacity-60" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="max-h-64">
        {options.map((option) => {
          const optionValue = option.props.value;
          const isSelected = String(optionValue) === String(value);
          return (
            <DropdownMenuItem
              key={String(optionValue)}
              data-selected={isSelected}
              className="focus:bg-gray-100 data-[selected=true]:bg-red-100 data-[selected=true]:text-red-900 data-[selected=true]:focus:bg-red-100"
              onSelect={() =>
                onChange?.({
                  target: { value: optionValue },
                } as unknown as React.ChangeEvent<HTMLSelectElement>)
              }
            >
              {option.props.children}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  captionLayout = 'dropdown',
  fromYear,
  toYear,
  footer,
  mode,
  onSelect,
  ...props
}: React.ComponentProps<typeof DayPicker>) {
  const currentYear = new Date().getFullYear();
  /* `MonthsDropdown`/`YearsDropdown` only render once both bounds are
     resolvable (react-day-picker derives them from fromYear/toYear when
     fromDate/toDate aren't set) — without a default range here the
     month/year dropdowns silently render nothing. */
  const resolvedFromYear = fromYear ?? (props.fromDate ? undefined : 2000);
  const resolvedToYear = toYear ?? (props.toDate ? undefined : currentYear + 10);

  /* Clear/Today only make sense for a single controlled date, and only
     `mode="single"` gives onSelect a plain Date argument — every other
     mode (multiple/range/undefined) is left exactly as the caller set it. */
  const isSingleMode = mode === 'single';
  const singleOnSelect = onSelect as ((date: Date | undefined) => void) | undefined;
  const defaultFooter =
    isSingleMode && singleOnSelect ? (
      <div className="flex items-center justify-between px-3 pt-2 text-sm font-medium">
        <button
          type="button"
          className="cursor-pointer text-red-500 hover:text-red-600"
          onClick={() => singleOnSelect(undefined)}
        >
          Clear
        </button>
        <button
          type="button"
          className="cursor-pointer text-red-500 hover:text-red-600"
          onClick={() => singleOnSelect(new Date())}
        >
          Today
        </button>
      </div>
    ) : undefined;

  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      captionLayout={captionLayout}
      fromYear={resolvedFromYear}
      toYear={resolvedToYear}
      mode={mode as any}
      onSelect={onSelect as any}
      footer={footer ?? defaultFooter}
      className={cn('p-3 w-full', className)}
      classNames={{
        months: 'flex flex-col sm:flex-row gap-2 w-full',
        month: 'flex flex-col gap-3 xxl:gap-4 flex-1',
        caption: 'flex justify-between items-center pt-1 relative w-full gap-2',
        caption_dropdowns: 'flex items-center gap-2',
        vhidden: 'hidden',
        nav: 'flex flex-col items-center gap-0',
        nav_button:
          'inline-flex items-center justify-center size-6 w-6 h-6 max-h-6 min-h-6 border-0 bg-transparent p-0 text-gray-400 hover:text-gray-600 cursor-pointer',
        nav_button_previous: '',
        nav_button_next: '',
        table: 'w-full border-collapse space-x-1',
        head_row: 'flex w-full',
        head_cell: 'flex-1 text-muted-foreground rounded-md font-normal text-[0.8rem] text-center',
        row: 'flex w-full mt-0.5 xxl:mt-2',
        cell: cn(
          'relative p-0 text-center text-sm flex-1',
          'focus-within:relative focus-within:z-20',
          mode === 'range'
            ? '[&:has(>.day-range-end)]:rounded-r-md [&:has(>.day-range-start)]:rounded-l-md first:[&:has([aria-selected])]:rounded-l-md last:[&:has([aria-selected])]:rounded-r-md'
            : '[&:has([aria-selected])]:rounded-md',
        ),
        day: cn(
          buttonVariants({ variant: 'ghost' }),
          'rdp-day size-6.5 xxl:size-8 text-xs xxl:text-sm p-0 font-normal aria-selected:opacity-100 hover:text-black cursor-pointer',
        ),
        day_range_start: 'day-range-start aria-selected:bg-red-500 aria-selected:text-white',
        day_range_end: 'day-range-end aria-selected:bg-red-500 aria-selected:text-white',
        day_selected:
          'bg-red-500 text-white hover:bg-red-500 hover:text-white focus:bg-red-500 focus:text-white',
        day_today: 'bg-accent text-accent-foreground',
        day_outside: 'day-outside text-muted-foreground aria-selected:text-muted-foreground',
        day_disabled: 'text-muted-foreground',
        day_range_middle: 'aria-selected:bg-red-100 aria-selected:text-red-900',
        day_hidden: 'invisible',
        ...classNames,
      }}
      components={{
        Dropdown: CalendarDropdown,
        IconLeft: ({ className, ...props }) => (
          <ChevronUp className={cn('size-3.5', className)} {...props} />
        ),
        IconRight: ({ className, ...props }) => (
          <ChevronDown className={cn('size-3.5', className)} {...props} />
        ),
      }}
      {...props}
    />
  );
}

export { Calendar };
