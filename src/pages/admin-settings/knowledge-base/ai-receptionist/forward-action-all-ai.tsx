import { ISELECTVALUE } from '@/interfaces/api-interfaces';
import PhoneInput from 'react-phone-input-2';
import { Label } from '@/components/ui/label';
import ErrorTooltip from '@/components/custom/error-tooltip';
import { SetValueConfig } from 'react-hook-form';
import SelectGreeting from '@/components/custom/greeting-select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Check, ChevronDown } from 'lucide-react';
import { Grid } from '@/assets/icons';

const cx = (...classes: Array<string | false | null | undefined>) =>
  classes.filter(Boolean).join(' ');

const PillSelect = ({
  options,
  value,
  onChange,
  placeholder = 'Select',
  showExtension = false,
  disabled = false,
}: {
  options: ISELECTVALUE[];
  value: ISELECTVALUE | null;
  onChange: (option: ISELECTVALUE) => void;
  placeholder?: string;
  showExtension?: boolean;
  disabled?: boolean;
}) => (
  <DropdownMenu>
    <DropdownMenuTrigger asChild>
      <button
        type="button"
        disabled={disabled}
        className="flex h-10 w-full items-center justify-between rounded-xl border! border-neutral-300! bg-white! px-3 text-sm outline-none! transition-colors hover:border-black! disabled:cursor-not-allowed disabled:bg-neutral-50 disabled:text-neutral-500"
      >
        <span className={cx('truncate', value?.label ? 'text-neutral-900!' : 'text-neutral-400!')}>
          {value?.label || placeholder}
        </span>
        <ChevronDown className="h-3.5 w-3.5 shrink-0 opacity-60" />
      </button>
    </DropdownMenuTrigger>
    <DropdownMenuContent
      align="start"
      className="w-[var(--radix-dropdown-menu-trigger-width)] max-h-[280px] overflow-y-auto rounded-xl! border! border-neutral-200! bg-white p-1.5 shadow-lg z-50 animate-none"
    >
      {options.map((option) => {
        const isSelected = option.value === value?.value;
        return (
          <DropdownMenuItem
            key={String(option.value)}
            onClick={() => onChange(option)}
            className={cx(
              'flex cursor-pointer items-center justify-between gap-2 rounded-lg px-3 py-2.5 text-sm font-medium hover:bg-red-50! focus:bg-red-50!',
              isSelected ? 'bg-red-50! text-red-600! font-semibold' : 'text-neutral-900',
            )}
          >
            <span className="truncate">{option.label}</span>
            <span className="flex shrink-0 items-center gap-1.5">
              {showExtension && (option as any)?.value && (
                <span className="flex items-center gap-1 text-xs font-normal text-neutral-400">
                  <Grid className="h-3.5 w-3.5" />
                  {(option as any).value}
                </span>
              )}
              {isSelected && <Check className="h-3.5 w-3.5 shrink-0 text-red-600!" />}
            </span>
          </DropdownMenuItem>
        );
      })}
    </DropdownMenuContent>
  </DropdownMenu>
);

const FORWARD_TYPES = {
  VOICEMAIL: 'VOICEMAIL',
  GREETING: 'GREETING',
  EXTENSION: 'EXTENSION',
  PHONE: 'PHONE',
  IVR: 'IVR',
  QUEUE: 'QUEUE',
  DEPARTMENT: 'DEPARTMENT',
  HANGUP: 'HANGUP',
} as const;

type ForwardType = keyof typeof FORWARD_TYPES;

export interface ForwardActionAiOptions {
  extensionList?: any[];
  greetingList?: any[];
  departmentList?: any[];
  IVRList?: any[];
  queueList?: any[];
}

interface ForwardActionAiProps {
  setValue(name: string, value: any, options?: SetValueConfig): void;
  watch: (name: string) => any;
  forwardType?: string;
  forwardValue?: string;
  forwardTypeLabel?: string;
  forwardValueLabel?: string;
  forwardTypeError?: string;
  forwardValueError?: string;
  notInclude?: ForwardType[];
  initialData?: Record<string, any>;
  forwardTypeClass?: string;
  forwardValueClass?: string;
  selectCustomClassSecond?: string;
  menuPlacement?: 'auto' | 'top' | 'bottom';
  enableVoicemailChoice?: boolean;
  voicemailPersonalField?: string;
  userExtension?: string;
  optionsData?: ForwardActionAiOptions;
}

const FORWARD_TYPES_LABEL: Record<keyof typeof FORWARD_TYPES, string> = {
  VOICEMAIL: 'Send to Voicemail',
  GREETING: 'Play an Announcement',
  EXTENSION: 'Forward to Extension',
  PHONE: 'Forward to External Number',
  IVR: 'Forward to IVR',
  QUEUE: 'Forward to Call Queue',
  DEPARTMENT: 'Forward to Group',
  HANGUP: 'Hangup',
};

const ForwardActionAllAi: React.FC<ForwardActionAiProps> = ({
  setValue,
  watch,
  forwardType = '',
  forwardValue = '',
  forwardTypeLabel = '',
  forwardTypeError = '',
  forwardValueError = '',
  notInclude = [],
  initialData = { uuid: '' },
  forwardTypeClass = 'w-full',
  forwardValueClass = 'w-full',
  forwardValueLabel = '',
  selectCustomClassSecond = '',
  enableVoicemailChoice = false,
  voicemailPersonalField = '',
  userExtension = '',
  optionsData = {},
}) => {
  const extensionList = optionsData?.extensionList || [];
  const greetingList = optionsData?.greetingList || [];
  const departmentList = optionsData?.departmentList || [];
  const IVRList = optionsData?.IVRList || [];
  const queueList = optionsData?.queueList || [];

  const forwardTypesOptions = (Object.keys(FORWARD_TYPES) as ForwardType[])
    .filter((key) => !notInclude.includes(key))
    .map((key) => ({
      label: FORWARD_TYPES_LABEL[key],
      value: FORWARD_TYPES[key],
    }));

  const extensionData = extensionList?.map((extension: any) => ({
    label:
      `${extension?.first_name || ''}${extension?.last_name ? ` ${extension?.last_name}` : ''}`.trim(),
    value: extension?.extension,
  }));
  const greetingData = greetingList?.map((greeting: any) => ({
    label: greeting?.name,
    value: greeting?.filename,
  }));
  const departmentData = departmentList?.map((department: any) => ({
    label: department?.name,
    value: department?.uuid,
  }));
  const IVRData = IVRList?.filter((ivr: any) => ivr?.uuid !== initialData?.uuid).map(
    (ivr: any) => ({
      label: ivr?.name,
      value: ivr?.uuid,
    }),
  );
  const queueData = queueList
    ?.filter((queue: any) => {
      const queueId = queue?.uuid || queue?._id || queue?.id || '';
      const initialQueueId = initialData?.uuid || initialData?._id || initialData?.id || '';
      return queueId !== initialQueueId;
    })
    .map((queue: any) => ({
      label: queue?.name,
      value: queue?.uuid || queue?._id || queue?.id || '',
    }));

  const FORWARD_VALUE_OPTIONS: Partial<Record<ForwardType, ISELECTVALUE[]>> = {
    [FORWARD_TYPES.VOICEMAIL]: extensionData,
    [FORWARD_TYPES.EXTENSION]: extensionData,
    [FORWARD_TYPES.GREETING]: greetingData,
    [FORWARD_TYPES.DEPARTMENT]: departmentData,
    [FORWARD_TYPES.IVR]: IVRData,
    [FORWARD_TYPES.QUEUE]: queueData,
  };

  const watchForwardType = watch(forwardType) as ISELECTVALUE | undefined;
  const currentType = watchForwardType?.value as ForwardType | undefined;
  const forwardValueOptions = currentType ? (FORWARD_VALUE_OPTIONS[currentType] ?? []) : [];
  const watchForwardValue = watch(forwardValue);
  const watchIsPersonalVoicemail = voicemailPersonalField ? watch(voicemailPersonalField) : false;

  const getLabel = () => {
    const index = forwardValueOptions?.findIndex((item) => item.value === watchForwardValue?.value);
    return index !== -1 ? forwardValueOptions[index]?.label : '';
  };

  const selectedForwardValue =
    watchForwardValue?.value !== undefined &&
    watchForwardValue?.value !== null &&
    String(watchForwardValue?.value).trim() !== ''
      ? {
          label: watchForwardValue?.label || getLabel(),
          value: watchForwardValue?.value,
        }
      : null;

  const renderForwardValueOption = () => {
    switch (watchForwardType?.value) {
      case 'PHONE':
        return (
          <PhoneInput
            country={'us'}
            value={watchForwardValue?.value || ''}
            onChange={(val) => {
              setValue(
                forwardValue,
                { label: val, value: val },
                {
                  shouldValidate: true,
                },
              );
            }}
            containerClass={forwardValueError ? 'phone-error' : ''}
          />
        );
      case 'HANGUP':
        return <div className="flex w-1/3"></div>;
      case 'GREETING':
        return (
          <SelectGreeting
            width="100%"
            name={'greeting'}
            isShowUpload={true}
            onChangeMedia={(e) =>
              setValue(forwardValue, e, {
                shouldValidate: true,
              })
            }
            options={forwardValueOptions}
            value={selectedForwardValue}
            errors={''}
            selectCustomClassSecond={selectCustomClassSecond}
          />
        );
      case FORWARD_TYPES.EXTENSION:
      case FORWARD_TYPES.VOICEMAIL:
        return (
          <PillSelect
            options={forwardValueOptions}
            value={selectedForwardValue}
            onChange={(val) =>
              setValue(forwardValue, val, {
                shouldValidate: true,
              })
            }
            showExtension
          />
        );
      default:
        return (
          <PillSelect
            options={forwardValueOptions}
            value={selectedForwardValue}
            onChange={(val) =>
              setValue(forwardValue, val, {
                shouldValidate: true,
              })
            }
          />
        );
    }
  };

  return (
    <>
      <div className={`flex flex-col gap-1.5 ${forwardTypeClass}`}>
        <div className={`flex item-center justify-${forwardTypeLabel ? 'between' : 'end'}`}>
          {forwardTypeLabel && <Label>{forwardTypeLabel}</Label>}
          {forwardTypeError && (
            <div className="flex justify-end">
              <ErrorTooltip text={forwardTypeError} extraClasses="bg-gray-800 text-white mb-1 " />
            </div>
          )}
        </div>
        <PillSelect
          options={forwardTypesOptions}
          value={
            watchForwardType
              ? {
                  label:
                    watchForwardType?.label ||
                    (typeof watchForwardType.value === 'string' &&
                    watchForwardType.value in FORWARD_TYPES_LABEL
                      ? FORWARD_TYPES_LABEL[watchForwardType.value as ForwardType]
                      : ''),
                  value: watchForwardType?.value || '',
                }
              : null
          }
          onChange={(val) => {
            setValue(forwardType, val, { shouldValidate: true });
            if (
              enableVoicemailChoice &&
              voicemailPersonalField &&
              val?.value === FORWARD_TYPES.VOICEMAIL
            ) {
              setValue(voicemailPersonalField, true, { shouldValidate: true });
              setValue(
                forwardValue,
                { label: 'My Voicemail', value: userExtension || '' },
                { shouldValidate: true },
              );
            } else {
              setValue(forwardValue, { label: 'Select', value: '' }, { shouldValidate: true });
            }
          }}
        />
      </div>

      {watchForwardType?.value === FORWARD_TYPES.HANGUP && (
        <div className="flex flex-col gap-1.5 w-1/3"></div>
      )}
      {watchForwardType?.value && watchForwardType?.value !== FORWARD_TYPES.HANGUP && (
        <div className={`flex flex-col gap-1.5 ${forwardValueClass}`}>
          <div
            className={`flex item-center relative justify-${forwardValueLabel ? 'between' : 'end'}`}
          >
            {forwardValueLabel && <Label>{forwardValueLabel}</Label>}
            {forwardValueError && (
              <div className="flex justify-end absolute bottom-0 right-0">
                <ErrorTooltip
                  text={forwardValueError}
                  extraClasses="bg-gray-800 text-white mb-1 "
                />
              </div>
            )}
          </div>
          {enableVoicemailChoice &&
            voicemailPersonalField &&
            watchForwardType?.value === FORWARD_TYPES.VOICEMAIL && (
              <RadioGroup
                className="flex gap-4 items-center min-h-10 mb-0 w-fit"
                value={String(Boolean(watchIsPersonalVoicemail))}
                onValueChange={(value) => {
                  const isPersonal = value === 'true';
                  setValue(voicemailPersonalField, isPersonal, { shouldValidate: true });
                  if (isPersonal) {
                    setValue(
                      forwardValue,
                      { label: 'My Voicemail', value: userExtension || '' },
                      { shouldValidate: true },
                    );
                  } else {
                    setValue(
                      forwardValue,
                      { label: 'Select', value: '' },
                      { shouldValidate: true },
                    );
                  }
                }}
              >
                <div className="flex items-center gap-2">
                  <RadioGroupItem
                    value="true"
                    id={`${forwardType}-my-voicemail`}
                    className="cursor-pointer w-4 h-4 accent-primary"
                  />
                  <Label htmlFor={`${forwardType}-my-voicemail`} className="cursor-pointer">
                    My Voicemail
                  </Label>
                  <RadioGroupItem
                    value="false"
                    id={`${forwardType}-another-voicemail`}
                    className="cursor-pointer w-4 h-4 accent-primary"
                  />
                  <Label htmlFor={`${forwardType}-another-voicemail`} className="cursor-pointer">
                    Another Voicemail
                  </Label>
                </div>
              </RadioGroup>
            )}
          {enableVoicemailChoice &&
          watchForwardType?.value === FORWARD_TYPES.VOICEMAIL &&
          Boolean(watchIsPersonalVoicemail)
            ? null
            : renderForwardValueOption()}
        </div>
      )}
    </>
  );
};

export default ForwardActionAllAi;
