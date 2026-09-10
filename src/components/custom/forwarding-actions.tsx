import { useUser } from '@/hooks/use-user';
import { useQueries, useQuery } from '@tanstack/react-query';
import ErrorTooltip from './error-tooltip';
import { forwardActionType, getGreetings } from '@/services/api';
import PhoneInput from 'react-phone-input-2';
import CustomSelect from './custom-select';
import SelectGreeting from './greeting-select';
import { RadioGroup, RadioGroupItem } from '../ui/radio-group';
import { Label } from '../ui/label';
import { ExtensionListView } from '@/pages/admin-settings/people/update-forwarding/call-rules/add-coworker';

/* IVR and DEPARTMENT were missing from this map while FORWARD_VALUE_OPTIONS below
   referenced FORWARD_TYPES.IVR and FORWARD_TYPES.DEPARTMENT — both resolved to
   `undefined`, so the two entries collapsed onto a single "undefined" key and the
   later one silently won. The lists were already being fetched; only the keys and
   the dropdown entries were absent. */
const FORWARD_TYPES: any = {
  VOICEMAIL: 'VOICEMAIL',
  GREETING: 'GREETING',
  EXTENSION: 'EXTENSION',
  PHONE: 'PHONE',
  HANGUP: 'HANGUP',
  MESSAGE: 'MESSAGE',
  QUEUE: 'QUEUE',
  IVR: 'IVR',
  DEPARTMENT: 'DEPARTMENT',
};

export const callForwardAgentAI = [
  {
    label: 'Forward to Queue',
    value: 'QUEUE',
  },
].filter(Boolean);

export const callForwardingOptions = [
  {
    label: 'Send to Voicemail',
    value: 'VOICEMAIL',
  },
  {
    label: 'Play an Announcement',
    value: 'MESSAGE',
  },
  {
    label: 'Forward to Extension',
    value: 'EXTENSION',
  },
  {
    label: 'Forward to External Number',
    value: 'PHONE',
  },
  /* Added so closed hours and holidays can reach the same places an IVR key can.
     Previously this list stopped at an announcement or an extension, which meant
     a business physically could not play a different menu after hours or send
     out-of-hours callers to a group — the single largest routing gap against
     established systems, whose closed-hours options match their open-hours ones.
     "Play an Announcement" deliberately keeps its existing MESSAGE type rather
     than switching to GREETING: which of the two the call switch accepts cannot
     be verified from here, and changing it could break announcements that work. */
  {
    label: 'Forward to IVR',
    value: 'IVR',
  },
  {
    label: 'Forward to Group',
    value: 'DEPARTMENT',
  },
  {
    label: 'Forward to Call Queue',
    value: 'QUEUE',
  },
  {
    label: 'Hangup',
    value: 'HANGUP',
  },
].filter(Boolean);
function getNestedValue(obj: any, path: any) {
  return path.split('.').reduce((acc: any, key: any) => acc && acc[key], obj) || {};
}

const FORWARD_TYPES_ARR = ['EXTENSION', 'DEPARTMENT', 'IVR', 'QUEUE'];

/* A strict canonical-UUID-only regex (8-4-4-4-12 hex, nothing else) missed
   real ids here: this system's Department/IVR ids apparently aren't
   always a clean 36-character UUID — some carry a trailing suffix (e.g.
   "...86ad-3"), which an exact-match pattern rejects outright, silently
   leaving the full id on screen. Loosened to "long enough and only
   hex/hyphen characters", which still matches a plain UUID, a UUID with a
   numeric suffix, and similar ids, while a real name — "Test IVR", "akash"
   — has letters outside a-f or a space and never matches. */
const UUID_LIKE_RE = /^[0-9a-f-]{20,}$/i;

/** Shortens a raw id ("badc7c8e-2837-451e-9a02-...") down to
 * "first6...last6" for display — a real name like "Test IVR" or "akash"
 * doesn't match the pattern and is returned as-is. Only changes the
 * `label` shown in the option row; `value` (the actual id used for
 * selection/submission) is never touched by this. */
const shortenIfUUID = (value: string) => (
  value && UUID_LIKE_RE.test(value) ? `${value.slice(0, 6)}...${value.slice(-6)}` : value
);

const ForwardingActions = ({
  setValue = () => {},
  watch = () => {},
  errors = {},
  forwardState = '',
  label = null,
  description = '',
  SITE_UUID = null,
  selectedUserExt = null,
  mainClasses = '',
  selectTwoWidth = 'w-fit',
  gap = 'gap-5',
  mainGapClasses = 'gap-4',
  mainValueDivClass = '',
  mainTypeDivClass = '',
  radioClass = '',
  mainValueJustifyClass = 'justify-center',
  isShowUpload = true,
  typeLabel = '',
  valueLabel = '',
  audioCustomClass = 'w-60',
  inputClass = '',
  extenstionClass = '',
  menuPlacement = 'top',
  selectCustomClassSecond = '',
  mode = 'default',
  optionsData = null,
  disableInternalFetch = false,
  /** Undefined by default — CustomSelect then falls back to its own default
   * (document.body). Only passed by callers that want their dropdown menus
   * kept inside their own page's scoped styling. */
  menuPortalTarget,
  /** Off by default — every existing caller keeps showing a Group/IVR's
   * full name (or, when the API has no name for it, its raw UUID) exactly
   * as before. Only My Phone opts in, to shorten a raw UUID id down to
   * "first6...last6" instead of showing the whole thing. */
  truncateOptionLabels = false,
}: any) => {
  const { user } = useUser();
  const { user_info } = user || {};

  const forwardType = `${forwardState}.type`;
  const forwardValue = `${forwardState}.value`;
  const isPersonalVoicemail = `${forwardState}.personal`;

  const watchForwardType = watch(forwardType) || { value: '' };
  const watchForwardValue = watch(forwardValue) || null;
  const watchIsPersonalVoicemail = watch(isPersonalVoicemail) || false;

  // Safely get error message
  const errorResponse =
    getNestedValue(errors, forwardState)?.value?.value?.message ||
    getNestedValue(errors, forwardState)?.value?.message ||
    '';

  const SITE_UUID_TEMP = SITE_UUID || watch('site')?.value || user_info?.site_uuid;
  const shouldUseExternalOptions = Boolean(optionsData);
  const shouldFetchInternally = !disableInternalFetch && !shouldUseExternalOptions;

  const queries = useQueries({
    queries: FORWARD_TYPES_ARR.map((type) => ({
      queryKey: ['forwardActionType-call-forwarding', SITE_UUID_TEMP, type],
      queryFn: () =>
        forwardActionType({
          page: 1,
          limit: 1000,
          filters: [],
          search: '',
          site_uuid: SITE_UUID_TEMP || undefined,
          type,
        }),
      enabled: shouldFetchInternally,
      select: (data: any) => data?.data?.data?.result?.rows || [],
    })),
  });

  const forwardActionTypeData: any = queries?.map((query) => query.data);

  const { data: greetingList = [], refetch } = useQuery({
    queryKey: ['greetings'],
    queryFn: () => getGreetings({ page: 1, limit: 1000, search: '', type: 'greeting' }),
    select: (res) => res?.data?.data?.result?.rows ?? [],
    enabled: shouldFetchInternally,
  });
  const [
    extensionListFetched = [],
    departmentListFetched = [],
    IVRListFetched = [],
    queueListFetched = [],
  ] = forwardActionTypeData;
  const extensionList = optionsData?.extensionList ?? extensionListFetched;
  const departmentList = optionsData?.departmentList ?? departmentListFetched;
  const IVRList = optionsData?.IVRList ?? IVRListFetched;
  const queueList = optionsData?.queueList ?? queueListFetched;
  const effectiveGreetingList = optionsData?.greetingList ?? greetingList;
  let extensionData = extensionList?.map((extension: any) => ({
    label: `${extension?.first_name}${extension?.last_name ? ` ${extension?.last_name}` : ''}`,
    value: extension?.extension,
    name: `${extension?.first_name}${extension?.last_name ? ` ${extension?.last_name}` : ''}`,
  }));

  if (selectedUserExt) {
    extensionData = extensionData?.filter((item: any) => item?.value !== selectedUserExt);
  }

  if (user_info?.extension) {
    extensionData = extensionData?.filter((ext: any) => ext.value !== user_info?.extension);
  }

  const greetingData = effectiveGreetingList?.map((greeting: any) => ({
    label: greeting?.name,
    value: greeting?.filename,
    name: greeting?.name,
  }));
  const departmentData = departmentList?.map((department: any) => ({
    label: department?.name,
    value: department?.uuid,
    name: department?.name,
  }));
  const IVRData = IVRList?.map((ivr: any) => ({
    label: ivr?.name,
    value: ivr?.uuid,
    name: ivr?.name,
  }));

  const queueData = queueList?.map((queue: any) => ({
    label: queue?.name,
    value: queue?.uuid || queue?._id || queue?.id || '',
    name: queue?.name,
  }));

  // console.log(IVRData, 'IVRData', queueData);

  const FORWARD_VALUE_OPTIONS = {
    [FORWARD_TYPES.VOICEMAIL]: extensionData,
    [FORWARD_TYPES.EXTENSION]: extensionData,
    [FORWARD_TYPES.GREETING]: greetingData,
    [FORWARD_TYPES.MESSAGE]: greetingData,
    [FORWARD_TYPES.DEPARTMENT]: departmentData,
    [FORWARD_TYPES.IVR]: IVRData,
    [FORWARD_TYPES.QUEUE]: queueData,
  };

  const getLabel = () => {
    const currentOptions = FORWARD_VALUE_OPTIONS[watchForwardType?.value] || [];
    const selectedValue =
      watchForwardValue && typeof watchForwardValue === 'object'
        ? watchForwardValue?.value
        : watchForwardValue;
    const foundItem = currentOptions.find((item: any) => item?.value === selectedValue);
    return foundItem?.label || '';
  };

  const selectedForwardValue =
    watchForwardValue !== undefined && watchForwardValue !== null
      ? typeof watchForwardValue === 'object'
        ? watchForwardValue
        : { label: '', value: watchForwardValue }
      : null;

  const resolvedForwardValue =
    selectedForwardValue?.value !== undefined &&
    selectedForwardValue?.value !== null &&
    String(selectedForwardValue?.value).trim() !== ''
      ? {
          label: selectedForwardValue?.label || getLabel(),
          value: selectedForwardValue?.value,
        }
      : null;

  const renderForwardValueOption = () => {
    const currentType = watchForwardType?.value;
    const currentValue = selectedForwardValue?.value || '';
    if (!currentType) return null;

    switch (currentType) {
      case 'PHONE':
        return (
          <>
            <div className="flex gap-1 flex-col w-full">
              {valueLabel && <Label>{valueLabel}</Label>}
              <PhoneInput
                inputClass={`${inputClass}`}
                country={'us'}
                dropdownStyle={{ top: '-220px' }}
                value={currentValue || ''}
                onChange={(val) => {
                  setValue(forwardValue, { label: val, value: val }, { shouldValidate: true });
                }}
                containerClass={errorResponse ? 'phone-error' : ''}
              />
            </div>
          </>
        );
      case 'HANGUP':
        return <div className="flex w-1/3"></div>;
      case 'MESSAGE':
        return (
          <div className="flex gap-1 flex-col w-full">
            {valueLabel && <Label>{valueLabel}</Label>}
            <SelectGreeting
              name={'greeting'}
              isShowUpload={isShowUpload}
              onChangeMedia={(e) => {
                setValue(forwardValue, e, { shouldValidate: true });
              }}
              options={FORWARD_VALUE_OPTIONS[currentType] || []}
              value={resolvedForwardValue}
              errors={''}
              audioCustomClass={audioCustomClass}
              selectCustomClass={`w-full`}
              selectCustomClassSecond={selectCustomClassSecond}
              refetch={() => {
                refetch();
              }}
              isRefetchable={false}
              menuPortalTarget={menuPortalTarget}
              selectMenuPortalTarget={menuPortalTarget}
            />
          </div>
        );
      case 'EXTENSION':
        return (
          <CustomSelect
            label={valueLabel}
            className={`${extenstionClass}`}
            placeholder="Select"
            menuPlacement={menuPlacement}
            menuPortalTarget={menuPortalTarget}
            options={FORWARD_VALUE_OPTIONS[currentType] || []}
            handleChange={(val) => setValue(forwardValue, val, { shouldValidate: true })}
            value={resolvedForwardValue}
            FormatOptionLabel={ExtensionListView}
          />
        );
      case 'QUEUE':
        return (
          <div className="flex gap-1 flex-col w-full">
            <CustomSelect
              label={valueLabel}
              className={`${extenstionClass}`}
              placeholder="Select"
              menuPlacement={menuPlacement}
              menuPortalTarget={menuPortalTarget}
              options={FORWARD_VALUE_OPTIONS[currentType] || []}
              handleChange={(val) => setValue(forwardValue, val, { shouldValidate: true })}
              value={resolvedForwardValue}
              // FormatOptionLabel={ExtensionListView}
            />
          </div>
        );

      default: {
        const rawOptions = FORWARD_VALUE_OPTIONS[currentType] || [];
        /* Purely a render-time transform of what CustomSelect is given —
           the underlying rawOptions (and, below, whatever gets saved) are
           never touched, so selection/submission still use the real value
           and full name exactly as before. Only Department/IVR, and only
           when the caller (My Phone) opts in via truncateOptionLabels. */
        const shouldTruncate =
          truncateOptionLabels && (currentType === 'DEPARTMENT' || currentType === 'IVR');
        /* CustomSelect's own normalizeOption falls back to showing an
           option's raw `value` whenever `label` is empty — which is
           exactly how a UUID with no name ends up on screen in the first
           place. Falling back to opt?.value here too, before shortening,
           makes sure that fallback text gets shortened as well, not just
           a `label` that happens to already hold one. */
        const displayLabel = (opt: any) => shortenIfUUID(opt?.label || opt?.value);
        /* ExtensionListView (this dropdown's FormatOptionLabel, below) also
           renders option.value as its own badge next to the label — a
           feature for the Extension picker, where that value is a short,
           meaningful extension number. Here it's the same raw UUID this
           truncation is shortening the label to hide, so it would otherwise
           still show the full id in that badge. showExtension: false turns
           the badge off for just these display copies. */
        const displayOptions = shouldTruncate
          ? rawOptions.map((opt: any) => ({ ...opt, label: displayLabel(opt), showExtension: false }))
          : rawOptions;
        const displayValue =
          shouldTruncate && resolvedForwardValue
            ? { ...resolvedForwardValue, label: displayLabel(resolvedForwardValue), showExtension: false }
            : resolvedForwardValue;

        return (
          <CustomSelect
            // label={valueLabel}
            placeholder="Select"
            menuPlacement={menuPlacement}
            menuPortalTarget={menuPortalTarget}
            options={displayOptions}
            handleChange={(val) => {
              /* val comes from displayOptions, so its label may be the
                 shortened display form — look the same id back up in
                 rawOptions to save its real, full label instead. */
              const original = rawOptions.find((opt: any) => opt?.value === val?.value);
              setValue(
                forwardValue,
                shouldTruncate && original ? { ...val, label: original?.label } : val,
                { shouldValidate: true },
              );
            }}
            value={displayValue}
            FormatOptionLabel={ExtensionListView}
          />
        );
      }
    }
  };

  return (
    <div className={`flex flex-col ${mainClasses} ${mainGapClasses}`}>
      <div className="flex items-center gap-1">
        {label && (
          <h6
            className={`font-semibold truncate text-md text-gray-900 ${errorResponse ? 'text-red' : ''}`}
          >
            {label}
          </h6>
        )}
      </div>
      {description && <p className="text-gray-800 text-sm">{description} </p>}
      <div className={`flex sm:flex-row flex-col w-full  items-start ${gap}`}>
        <div className={`flex w-full sm:w-auto ${mainTypeDivClass}`}>
          <CustomSelect
            options={mode === 'ai-agent' ? callForwardAgentAI : callForwardingOptions}
            label={typeLabel}
            placeholder="Select Type"
            menuPlacement={menuPlacement}
            menuPortalTarget={menuPortalTarget}
            handleChange={(val) => {
              setValue(forwardType, val || {}, { shouldValidate: true });
              if (val?.value === 'VOICEMAIL') {
                setValue(isPersonalVoicemail, true, { shouldValidate: true });
                setValue(
                  forwardValue,
                  {
                    label: 'My Voicemail',
                    value: user_info?.extension || '',
                  },
                  { shouldValidate: true },
                );
              } else if (val?.value === 'HANGUP') {
                setValue(
                  forwardValue,
                  {
                    label: 'Select',
                    value: 'HANGUP',
                  },
                  { shouldValidate: true },
                );
              } else {
                setValue(forwardValue, { label: 'Select', value: '' }, { shouldValidate: true });
              }
            }}
            value={watchForwardType}
          />
        </div>

        <div
          className={`flex w-full sm:w-auto ${mainValueDivClass} ${mainValueJustifyClass} flex-col gap-1.5`}
        >
          {/* The label is its own row, matching the type column's label row
              exactly (same element, same height) — so the row that follows on
              both sides starts at the same Y: the type select on the left,
              the radio row on the right. The value select then gets its own
              row underneath, since there's nothing on the left to match it. */}
          {valueLabel && watchForwardType?.value === 'VOICEMAIL' && (
            <div className="flex items-center justify-between">
              <Label>{valueLabel}</Label>
            </div>
          )}
          {/* Rendered only for VOICEMAIL — otherwise this div stayed in the
              flex-col with nothing inside it, and the column's own gap-1.5
              still applied around that empty box, pushing the value select
              below it down out of line with the type select beside it
              (which has no such placeholder above it). The "Another
              Voicemail" select now lives in this same flex row, right
              after the radio group, instead of the separate flex-col row
              below — so it sits beside "Another Voicemail" instead of
              underneath the whole row. */}
          {watchForwardType?.value === 'VOICEMAIL' && (
            <div className="flex flex-wrap items-center gap-4">
              <RadioGroup
                className={`flex flex-nowrap gap-6 items-center min-h-10 mb-0 ${radioClass}  `}
                value={String(watchIsPersonalVoicemail)}
                onValueChange={(value) => {
                  if (value === 'true') {
                    setValue(isPersonalVoicemail, true, { shouldValidate: true });
                    setValue(
                      forwardValue,
                      {
                        label: 'Select',
                        value: user_info?.extension,
                      },
                      { shouldValidate: true },
                    );
                  } else {
                    setValue(isPersonalVoicemail, false, { shouldValidate: true });
                    setValue(
                      forwardValue,
                      { label: 'Select', value: '' },
                      { shouldValidate: true },
                    );
                  }
                }}
              >
                <div className="flex items-center gap-2 shrink-0 whitespace-nowrap">
                  <RadioGroupItem
                    value="true"
                    id={`${forwardState}-true`}
                    className="cursor-pointer w-4 h-4"
                  />
                  <Label htmlFor={`${forwardState}-true`} className="cursor-pointer">
                    My Voicemail
                  </Label>
                </div>
                <div className="flex items-center gap-1 shrink-0 whitespace-nowrap">
                  <RadioGroupItem
                    value="false"
                    id={`${forwardState}-false`}
                    className="cursor-pointer"
                  />
                  <Label htmlFor={`${forwardState}-false`} className="cursor-pointer">
                    Another Voicemail
                  </Label>
                </div>
              </RadioGroup>
              {!watchIsPersonalVoicemail && (
                <div className={`flex gap-1 ${selectTwoWidth}`}>
                  {renderForwardValueOption()}
                  {errorResponse && (
                    <div className={`flex justify-end`}>
                      <ErrorTooltip
                        text={errorResponse}
                        extraClasses="bg-gray-800 text-white mb-1"
                      />
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
          {watchForwardType?.value !== 'VOICEMAIL' && (
            <div className="w-full flex flex-wrap items-start gap-2">
              <div className={`flex gap-1 ${selectTwoWidth}`}>
                {renderForwardValueOption()}
                {watchForwardType?.value !== 'HANGUP' && errorResponse && (
                  <div className={`flex justify-end`}>
                    <ErrorTooltip
                      text={errorResponse}
                      extraClasses="bg-gray-800 text-white mb-1"
                    />
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ForwardingActions;
