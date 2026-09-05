import { useEffect, useRef, useState } from 'react';
import { Tooltip, TooltipContent, TooltipTrigger } from '../ui/tooltip';

const CustomTooltip = ({
  text,
  children,
  side = 'right',
  className = '',
  openOnMount = false,
  openOnMountDuration = 1600,
}: {
  text: string | React.ReactNode;
  children: React.ReactNode;
  side?: 'top' | 'right' | 'bottom' | 'left';
  className?: string;
  /** Shows the tooltip once, unprompted, right after mount — so a hover
      affordance that isn't obviously interactive (an info icon, say) gets
      noticed once instead of relying on someone finding it by accident. It
      hands control back to normal hover/focus behaviour once the timer
      fires, rather than staying open or locking hover out. */
  openOnMount?: boolean;
  openOnMountDuration?: number;
}) => {
  const [open, setOpen] = useState(openOnMount);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!openOnMount) return;
    timerRef.current = setTimeout(() => setOpen(false), openOnMountDuration);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Tooltip {...(openOnMount ? { open, onOpenChange: setOpen } : {})}>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent side={side} className={className}>
        {text}
      </TooltipContent>
    </Tooltip>
  );
};

export default CustomTooltip;
