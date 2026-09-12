import { CloseIcon } from '@/assets/icons';
import CustomSelect from '@/components/custom/custom-select';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { ModalProps } from '@/interfaces/common-interface';
import { getEnv } from '@/lib/utils';
import { AuthenticatedAudio } from '@/components/custom/authenticated-media';

import { FC } from 'react';
import { useFormContext } from 'react-hook-form';

export const automaticRecordArr = [
  // { value: 'none', label: 'None' },
  { value: 'all', label: 'All' },
  { value: 'incoming', label: 'Incoming' },
  { value: 'outgoing', label: 'Outgoing' },
];
const AutomaticCallRecordingModal: FC<ModalProps> = ({ modalState, setModalState }) => {
  const { watch, setValue } = useFormContext();
  return (
    <Dialog open={modalState} onOpenChange={(val) => setModalState(val)}>
      <DialogContent
        className="sm:w-1/2 lg:w-1/4 p-3 max-h-[85vh] overflow-hidden flex flex-col"
        showCloseButton={false}
      >
        <div className="flex flex-col gap-1.5  text-900/80">
          <div className="flex items-start justify-between gap-2">
            <span className="font-bold text-[20px]">Automatic & On Demand Call Recording</span>
            <div
              onClick={() => setModalState(false)}
              className="shrink-0 cursor-pointer ring-offset-background focus:ring-ring data-[state=open]:bg-accent data-[state=open]:text-muted-foreground opacity-70 transition-opacity hover:opacity-100 focus:ring-2 focus:ring-offset-2 focus:outline-hidden disabled:pointer-events-none"
            >
              <CloseIcon className="w-3 h-3" />
            </div>
          </div>
        </div>

        {/* The rounded box clips its own scrollbar: the outer layer only
            clips (rounded + overflow-hidden), the inner layer only scrolls
            (overflow-y-auto, no radius of its own) and fills it exactly, so
            the scrollbar sits flush against this box's edge instead of
            floating further out in the dialog's own padding. A concrete
            `max-h` (not `flex-1`/`h-full`) so the scroll reliably kicks in
            regardless of how the surrounding flex layout resolves. */}
        <div className="rounded-xl border border-gray-200 overflow-hidden">
        <div className="flex flex-col max-h-[55vh] overflow-y-auto">
          <div
            className={`flex justify-between p-3 cursor-pointer ${watch('settings.recording.automatic.enabled') ? 'items-start' : 'items-center'}`}
          >
            <div className="flex flex-col gap-3 w-full">
              <p className="font-semibold text-[16px] text-gray-900">Automatic Call Recording</p>
              <div className="flex flex-col gap-4">
                <Label>Enable Automatic Call Recording</Label>
                <Switch
                  onCheckedChange={(checked) => {
                    setValue('settings.recording.automatic', {
                      enabled: checked,
                      value: checked ? 'all' : '',
                      label: checked ? 'All' : '',
                      recording_on: 'ad98d65d-fcf8-4d4d-bc77-ee1426c34333.mp3',
                    });
                  }}
                  value={watch('settings.recording.automatic.enabled')}
                  checked={watch('settings.recording.automatic.enabled')}
                />

                {watch('settings.recording.automatic.enabled') && (
                  <CustomSelect
                    inputClass="co-grey-select"
                    label={'Recording Direction'}
                    options={automaticRecordArr.map(({ value, label }) => ({ value, label }))}
                    value={watch('settings.recording.automatic')}
                    handleChange={(value) => {
                      setValue('settings.recording.automatic.value', value.value);
                      setValue('settings.recording.automatic.label', value.label);
                    }}
                  />
                )}
              </div>
              <p className="text-gray-900 text-[12px]">
                Automatically records calls for this user or group extension. Recordings appear in
                your call log.
              </p>

              <div className="flex flex-col gap-3 mt-2">
                <Label>Call Recording Announcement</Label>
                <AuthenticatedAudio
                  controls
                  src={`${getEnv().VITE_API_BASE_URL}/api/media/default/recording/ad98d65d-fcf8-4d4d-bc77-ee1426c34333.mp3`}
                  className="w-full h-10"
                />
              </div>
            </div>
          </div>

          <hr className="text-gray-200 w-full" />

          <div
            className={`flex justify-between p-3 cursor-pointer ${watch('settings.recording.on_demand.enabled') ? 'items-start' : 'items-center'}`}
          >
            <div className="flex flex-col gap-3 w-full">
              <p className="font-semibold text-[16px] text-gray-900">On-demand Call Recording</p>
              <div className="flex items-center gap-2">
                <Switch
                  onCheckedChange={(checked) => {
                    setValue('settings.recording.on_demand', {
                      enabled: checked,
                      recording_on: 'ad98d65d-fcf8-4d4d-bc77-ee1426c34331.mp3',
                      recording_Off: 'ad98d65d-fcf8-4d4d-bc77-ee1426c34332.mp3',
                    });
                  }}
                  value={watch('settings.recording.on_demand.enabled')}
                  checked={watch('settings.recording.on_demand.enabled')}
                />
              </div>
              <p className="text-gray-900 text-[12px]">
                Enable your users to record call at any time on a phone dial pad.
              </p>
              <div className="flex flex-col gap-3">
                <div className="flex flex-col gap-1.5 w-full">
                  <Label>Announcement on Start</Label>
                  <AuthenticatedAudio
                    controls
                    src={`${getEnv().VITE_API_BASE_URL}/api/media/default/recording/ad98d65d-fcf8-4d4d-bc77-ee1426c34331.mp3`}
                    className="w-full h-10"
                  />
                </div>
                <div className="flex flex-col gap-1.5 w-full">
                  <Label>Announcement on Stop</Label>
                  <AuthenticatedAudio
                    controls
                    src={`${getEnv().VITE_API_BASE_URL}/api/media/default/recording/ad98d65d-fcf8-4d4d-bc77-ee1426c34332.mp3`}
                    className="w-full h-10"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
        </div>

        <DialogFooter>
          <div className="justify-end flex gap-2">
            <Button
              type="button"
              variant={'transparent'}
              className="rounded-full"
              onClick={() => setModalState(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant={'dark'}
              className="rounded-full"
              onClick={() => setModalState(false)}
            >
              Submit
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default AutomaticCallRecordingModal;
