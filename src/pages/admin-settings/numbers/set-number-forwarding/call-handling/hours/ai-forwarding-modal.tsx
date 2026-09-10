import { CloseIcon } from '@/assets/icons';
import ForwardingActions from '@/components/custom/forwarding-actions';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter } from '@/components/ui/dialog';
import { FC } from 'react';
import { useFormContext } from 'react-hook-form';

interface AiForwardProps {
  modalState: boolean;
  setModalState: (state: boolean) => void;
}
const AiForward: FC<AiForwardProps> = ({ modalState, setModalState }) => {
  const {
    watch,
    setValue,
    trigger,
    formState: { errors },
  } = useFormContext();

  const handleSubmit = async () => {
    const isValid = await trigger(['callHandling.businessHours.ai_forward_to.value.value']);
    if (!isValid) return;
    setModalState(false);
  };
  const handleCancel = () => {
    setModalState(false);
  };
  return (
    <Dialog open={modalState} onOpenChange={(val) => setModalState(val)}>
      <DialogContent className="w-fit p-3 max-h-[99%]  overflow-y-auto" showCloseButton={false}>
        <div className="flex flex-col gap-1.5  text-900/80">
          <div className="ident-confirm-title truncate flex items-center justify-between">
            Forward to AI
            <button
              type="button"
              onClick={handleCancel}
              aria-label="Close"
              className="flex h-9 w-9 flex-none cursor-pointer items-center justify-center rounded-full text-gray-500 hover:bg-red-50 hover:text-black"
            >
              <CloseIcon className="h-3 w-4" />
            </button>
          </div>
        </div>
        <ForwardingActions
          setValue={setValue}
          watch={watch}
          errors={errors}
          forwardState="callHandling.businessHours.ai_forward_to"
          description="Set how you'd like your calls to be forwarded."
          isUser={true}
          SITE_UUID={watch('basic.site.value')}
          selectedUserExt={watch('basic.extension')}
        />
        <DialogFooter>
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant={'transparent'}
              className="rounded-full border border-gray-300! bg-white! text-gray-700! hover:bg-gray-50! hover:text-gray-700! focus-visible:ring-0! shadow-none!"
              onClick={handleCancel}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant={'outline'}
              className="rounded-full border-black! bg-black! px-5 text-white! hover:bg-gray-800! hover:text-white!"
              onClick={() => handleSubmit()}
            >
              Submit
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default AiForward;
