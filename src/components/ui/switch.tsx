import * as React from 'react';

import { cn } from '@/lib/utils';

/* A plain button, not Radix's SwitchPrimitive: Radix's data-state attribute
   selectors were not reliably driving the track colour or the thumb's
   slide-over, so a toggle sat flat and un-animated instead of reading as a
   switch. This mirrors the toggle already proven working elsewhere in the
   app (new-ai-receptionist.tsx's ToggleSwitch) — same sizing, same
   checked/unchecked classes, driven directly off the `checked` prop instead
   of a DOM attribute. */
interface SwitchProps extends Omit<React.ComponentPropsWithoutRef<'button'>, 'onChange'> {
  checked?: boolean;
  defaultChecked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
}

function Switch({
  className,
  checked,
  defaultChecked = false,
  onCheckedChange,
  disabled,
  ...props
}: SwitchProps) {
  const [uncontrolled, setUncontrolled] = React.useState(defaultChecked);
  const isChecked = checked ?? uncontrolled;

  return (
    <button
      type="button"
      role="switch"
      aria-checked={isChecked}
      data-slot="switch"
      data-state={isChecked ? 'checked' : 'unchecked'}
      disabled={disabled}
      onClick={() => {
        const next = !isChecked;
        if (checked === undefined) setUncontrolled(next);
        onCheckedChange?.(next);
      }}
      className={cn(
        'relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full outline-none! transition-colors disabled:cursor-not-allowed disabled:opacity-50 touch-manipulation',
        isChecked ? 'bg-primary!' : 'bg-gray-300!',
        className,
      )}
      {...props}
    >
      <span
        data-slot="switch-thumb"
        className={cn(
          'pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow-sm transition-transform',
          isChecked ? 'translate-x-[22px]' : 'translate-x-0.5',
        )}
      />
    </button>
  );
}

export { Switch };
