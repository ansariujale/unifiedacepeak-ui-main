import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import Loader from '@/components/custom/loader';

interface TermsModalationProps {
  open: boolean;
  setOpen: (open: boolean) => void;
  onConfirm: any;
  onCancel?: any;
  apiLoading?: boolean;
  descriptionTextComp?: any;
  closeBtnText?: string;
  confirmBtnText?: string;
}

/* The same head/body/foot bands as the wizard this opens on top of. It was a
   bare dialog -- unlabelled description text over a red Confirm button --
   which against the restyled wizard behind it read as a different product.
   No close control on purpose: the point of the thing is the acknowledgement,
   so OK stays the only way out (escape and outside clicks are still blocked
   below). */
const TermsModal = ({
  open,
  setOpen,
  onConfirm,
  apiLoading,
  descriptionTextComp,
  confirmBtnText,
}: TermsModalationProps) => {
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent
        className="w-[calc(100vw_-_2rem)] max-w-md p-0"
        showCloseButton={false}
        onEscapeKeyDown={(e) => e.preventDefault()}
        onPointerDownOutside={(e) => e.preventDefault()}
      >
        <div className="mcm-modal dlc-wizard dlc-terms">
          <div className="mcm-modal-head">
            <div className="mcm-modal-titlerow">
              <div className="min-w-0">
                {/* Titled, so the dialog says what it is before it says what
                    to agree to. It used to open on a sentence with no
                    heading at all. */}
                <div className="mcm-modal-eyebrow">Carrier Terms</div>
                <DialogTitle className="mcm-modal-title">Before you continue</DialogTitle>
              </div>
            </div>
          </div>

          <DialogDescription asChild>
            <div className="mcm-modal-body">
              <p className="mcm-modal-lede">
                {descriptionTextComp ||
                  'The terms displayed in this page may be subject to change at the sole discretion of the MNO.'}
              </p>
            </div>
          </DialogDescription>

          <div className="mcm-modal-foot dlc-wizard-footer">
            <Button
              variant="outline"
              type="button"
              className="dlc-wizard-footer-btn dlc-wizard-footer-btn--primary shrink-0"
              onClick={onConfirm}
              disabled={apiLoading}
            >
              {apiLoading ? <Loader variant="blue" /> : confirmBtnText || 'Confirm'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default TermsModal;
