import type { ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription } from '@/components/ui/dialog';
import Loader from './loader';
import { CloseIcon } from '@/assets/icons';
import { cn } from '@/lib/utils';

interface AlertConfirmationProps {
  open: boolean;
  setOpen: (open: boolean) => void;
  onConfirm: any;
  onCancel?: any;
  onClose?: () => void;
  apiLoading?: boolean;
  descriptionTextComp?: any;
  closeBtnText?: string;
  confirmBtnText?: string;
  showButton?: boolean;
  headerText?: string;
  singleButton?: boolean;
  singleButtonText?: string;
  singleButtonHandler?: any;
  className?: string;
  confirmBtnDisabled?: boolean;
  /** Optional icon shown in a tinted circle above the header — e.g. a
      warning glyph for a destructive confirmation. Omitted by default so
      existing callers render exactly as before. */
  icon?: ReactNode;
  /** Tint for the icon circle, matching the confirm button's own tone.
      Callers that pass `icon` typically pass this too. */
  iconTone?: 'default' | 'danger';
  /** A short label shown centered under the icon circle — e.g. "Delete" —
      naming the action the icon represents rather than leaving it to
      speak for itself. Only rendered when `icon` is also passed. */
  iconLabel?: string;
  /** Extra classes appended to the "Confirm"/`headerText` heading — for
      callers that want it to match a specific page's own title typography
      rather than the dialog's plain default. Omitted by default so
      existing callers render exactly as before. */
  headerClassName?: string;
  /** Extra classes appended to the confirm button, for callers that want
      it to match a specific theme (e.g. a page's own accent color) rather
      than the app's default primary color. */
  confirmBtnClassName?: string;
  /** Extra classes appended to the cancel/close button — the counterpart
      to confirmBtnClassName, for callers that want it to match the
      confirm button's shape (e.g. a fully-rounded pill) rather than the
      app's default. Omitted by default so existing callers render exactly
      as before. */
  closeBtnClassName?: string;
  /** A divider line between the description and the button row, and a
      little extra breathing room around it — off by default so existing
      callers render exactly as before. */
  showDivider?: boolean;
  /** Which side the Cancel/Confirm row sits on. 'end' (the app-wide
      default) matches every other dialog's button row; 'start' is for
      callers that want them left-aligned under the description instead. */
  buttonsAlign?: 'start' | 'end';
}

const AlertConfirm = ({
  open,
  setOpen,
  onConfirm,
  onCancel,
  onClose,
  apiLoading,
  descriptionTextComp,
  closeBtnText,
  confirmBtnText,
  showButton = true,
  headerText = 'Confirm',
  singleButton = false,
  singleButtonText = 'Confirm',
  singleButtonHandler = () => {},
  className,
  confirmBtnDisabled = false,
  icon,
  iconTone = 'default',
  iconLabel,
  headerClassName,
  confirmBtnClassName,
  closeBtnClassName,
  showDivider = false,
  buttonsAlign = 'end',
}: AlertConfirmationProps) => {
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent
        className={cn('w-full sm:w-1/2 md:w-1/3 lg:1/4 p-5', icon && 'p-6', className)}
        showCloseButton={false}
        onEscapeKeyDown={(e) => e.preventDefault()}
        onPointerDownOutside={(e) => e.preventDefault()}
      >
        <div className="flex flex-col gap-3 text-900/80">
          <div
            className={cn(
              'truncate flex items-center justify-between',
              icon ? 'text-2xl font-bold' : 'font-semibold text-md',
              headerClassName,
            )}
          >
            {headerText}
            <div
              onClick={() => {
                setOpen(false);
                onClose?.();
              }}
              className="cursor-pointer ring-offset-background focus:ring-ring data-[state=open]:bg-accent data-[state=open]:text-muted-foreground opacity-70 transition-opacity hover:opacity-100 focus:ring-2 focus:ring-offset-2 focus:outline-hidden disabled:pointer-events-none"
            >
              <CloseIcon className={icon ? 'w-4 h-4' : 'w-3 h-3'} />
            </div>
          </div>
          {icon && (
            <div className="flex flex-row items-center gap-3">
              <div className="relative w-16 h-16">
                <div
                  className={cn(
                    'absolute inset-0 rounded-full blur-md',
                    iconTone === 'danger' ? 'bg-red-100' : 'bg-gray-100',
                  )}
                />
                <div
                  className={cn(
                    'relative flex items-center justify-center w-16 h-16 rounded-full ring-4',
                    iconTone === 'danger'
                      ? 'bg-red-50 text-red-600 ring-red-50/60'
                      : 'bg-gray-100 text-gray-700 ring-gray-100/60',
                  )}
                >
                  {icon}
                </div>
              </div>
              {iconLabel && (
                <span className="text-lg font-semibold text-gray-900">{iconLabel}</span>
              )}
            </div>
          )}
        </div>
        {/* <DialogTitle className=" text-gray-900 text-xl font-medium"></DialogTitle> */}
        <DialogDescription className={icon ? 'text-base' : undefined}>
          {/* DialogDescription renders a <p>; a <div> fallback inside it is
              invalid HTML (block inside an implicit-inline context) and
              triggers a hydration warning, so this stays a <span>. */}
          {descriptionTextComp || (
            <span className="text-md">Are you sure, you want to delete this record?</span>
          )}
        </DialogDescription>
        {showDivider && <hr className="border-t border-gray-200" />}
        {singleButton && (
          <div className="flex justify-end gap-2 w-full">
            <Button
              variant={'outline'}
              className="min-w-[120px] rounded-full"
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setOpen(false);
                singleButtonHandler?.();
              }}
            >
              {singleButtonText || 'Confirm'}
            </Button>
          </div>
        )}
        {showButton && !singleButton && (
          <div className={cn('flex gap-2 w-full', buttonsAlign === 'start' ? 'justify-start' : 'justify-end')}>
            <Button
              variant={'transparent'}
              className={cn('min-w-[120px]', closeBtnClassName)}
              onClick={(e) => {
                e.stopPropagation();
                setOpen(false);
                onCancel?.();
              }}
            >
              {closeBtnText || 'Cancel'}
            </Button>
            <Button
              variant={'outline'}
              className={cn('min-w-[120px]', confirmBtnClassName)}
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onConfirm(e);
              }}
              disabled={apiLoading || confirmBtnDisabled}
            >
              {apiLoading ? <Loader variant="blue" /> : confirmBtnText || 'Confirm'}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default AlertConfirm;
