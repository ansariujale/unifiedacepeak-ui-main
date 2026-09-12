import { FC, useState } from 'react';
import CustomSelect from './custom-select';
import { ISELECTVALUE } from '@/interfaces/api-interfaces';
import AddGreeting from '@/pages/greetings/add-greeting';
import { Button } from '../ui/button';
import { CloseIcon, Play, UploadLineIcon } from '@/assets/icons';
import { DEFAULT_RECORDING_UUIDS, getEnv, MEDIA_URL } from '@/lib/utils';
import { useUser } from '@/hooks/use-user';
import ErrorTooltip from './error-tooltip';
import ReadyAudio from './ready-audio';
import { Dialog, DialogContent } from '../ui/dialog';

interface IGREETINGPROPS {
  options: ISELECTVALUE[];
  onChangeMedia: (e: ISELECTVALUE | null) => void;
  isShowUpload: boolean;
  name: string;
  value: ISELECTVALUE | null;
  errors: string;
  audioCustomClass?: string;
  selectCustomClass?: string;
  selectCustomClassSecond?: string;
  isRefetchable?: boolean;
  refetch?: () => void;
  onGreetingUploadStart?: () => void;
  onGreetingUploadSuccess?: () => void;
  width?: string;
  /** Undefined by default — CustomSelect then falls back to its own default
   * (document.body). Only passed by callers that want this dropdown's menu
   * kept inside their own page's scoped styling. */
  menuPortalTarget?: HTMLElement | null | boolean;
  /** Undefined by default. Forwarded to the "Upload File" drawer's own
   * AddGreeting/TextToSpeech selects (Language/Voice) — separate from
   * menuPortalTarget above, which is only for this component's own
   * greeting picker. Only passed by callers that want that drawer's
   * dropdown menus kept inside their own page's scoped styling too. */
  selectMenuPortalTarget?: any;
}

interface GreetingSelectValue extends ISELECTVALUE {
  uuid?: string;
}

const SelectGreeting: FC<IGREETINGPROPS> = ({
  options,
  onChangeMedia,
  isShowUpload,
  name,
  value,
  errors,
  audioCustomClass = '',
  selectCustomClass = '',
  selectCustomClassSecond = '',
  isRefetchable = true,
  refetch = () => {},
  onGreetingUploadStart = () => {},
  onGreetingUploadSuccess = () => {},
  menuPortalTarget,
  selectMenuPortalTarget,
}) => {
  const { user } = useUser();
  const { company_info } = user;
  const [isPlay, setIsPlay] = useState<boolean>(false);
  const [drawerState, setDrawerState] = useState({
    addGreeting: false,
    greetingType: '',
  });
  const selectedGreeting = options.find((option) => option.value === value?.value) as
    GreetingSelectValue | undefined;
  const greetingUuid = (value as GreetingSelectValue | null)?.uuid ?? selectedGreeting?.uuid;
  const recordingUrl = DEFAULT_RECORDING_UUIDS.includes(greetingUuid ?? '')
    ? `${getEnv().VITE_API_BASE_URL}/api/media/default/recording/${value?.value}`
    : `${MEDIA_URL}/${company_info?.uuid}/greeting/${value?.value}`;

  return (
    <>
      {isPlay ? (
        <div className={`flex items-center gap-2 ${audioCustomClass}`}>
          <ReadyAudio controls authenticated src={recordingUrl} />
          <Button
            type="button"
            variant={'outline'}
            className="w-10 h-10 min-w-10 text-red-500 text-lg font-bold border-red-500 hover:bg-red-500"
            onClick={() => setIsPlay(false)}
          >
            <CloseIcon className="w-3.5 h-3.5" />
          </Button>
        </div>
      ) : (
        <div className={`flex items-center gap-2 relative ${selectCustomClass}`}>
          <div className={`relative ${selectCustomClassSecond}`}>
            <CustomSelect
              options={options}
              handleChange={(e: ISELECTVALUE | null) => {
                onChangeMedia(e || { label: '', value: '' });
              }}
              value={value}
              isClearable={true}
              menuPortalTarget={menuPortalTarget}
            />
          </div>
          {errors && (
            <div className="flex shrink-0 items-center">
              <ErrorTooltip text={errors} />
            </div>
          )}
          {value?.value && (
            <Button
              type="button"
              variant={'dark'}
              className="w-10 h-10"
              onClick={() => setIsPlay(true)}
            >
              <Play className="w-5 h-5" />
            </Button>
          )}
          {isShowUpload && !isPlay && !value?.value && (
            <Button
              variant={'dark'}
              type="button"
              className="w-10 h-10"
              onClick={() => {
                onGreetingUploadStart();
                setDrawerState({
                  addGreeting: true,
                  greetingType: name,
                });
              }}
            >
              <UploadLineIcon className="w-5 h-5" />
            </Button>
          )}
        </div>
      )}

      <Dialog
        open={Boolean(drawerState?.addGreeting)}
        onOpenChange={(open) =>
          !open && setDrawerState((prev) => ({ ...prev, addGreeting: false, greetingType: '' }))
        }
      >
        <DialogContent className="flex w-full max-w-[560px] flex-col bg-white p-4 shadow-2xl sm:p-6">
          <div className="text-lg font-semibold text-gray-900">Upload File</div>
          <div className="min-h-0 bg-white">
            <AddGreeting
              drawerState={drawerState?.addGreeting}
              setDrawerState={(val) =>
                setDrawerState((prev) => ({ ...prev, addGreeting: val, greetingType: '' }))
              }
              greetingType={name}
              selectMenuPortalTarget={selectMenuPortalTarget}
              refetch={() => {
                refetch();
                onGreetingUploadSuccess();
              }}
              isRefetchable={isRefetchable}
            />
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default SelectGreeting;
