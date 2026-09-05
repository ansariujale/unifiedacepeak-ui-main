import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogFooter, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { CUSTOM_HOURS_SCHEDULE_OPTIONS } from '@/constants/forwarding-consts';
import { ModalProps } from '@/interfaces/common-interface';
import { FC, useEffect, useState } from 'react';
import { Controller, useFieldArray, useFormContext } from 'react-hook-form';
import ErrorTooltip from './error-tooltip';
import { CustomDatePicker } from './custom-datepicker';
import moment from 'moment';
import ForwardingActions from './forwarding-actions';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { useUser } from '@/hooks/use-user';
import { cn, getHolidaysFormVal, handleAlert } from '@/lib/utils';
import { useQuery } from '@tanstack/react-query';
import { COMPANY_DEFAULTS_QUERY_KEY, fetchCompanyDefaults } from '@/lib/company-defaults';
import { buildHolidayImport, readCompanyHolidays } from '@/lib/company-holiday-import';
import ForwardingHolidaysActions from './forward-holidays-action';
import { OPERATIONAL_HOURS } from '../common-settings/constants';
import { CalendarClock, Clock3, Plus, Trash2, X } from 'lucide-react';

interface IBussinessModalProps extends ModalProps {
  setError: (value: string | null) => void;
  selectedUserExt?: string | null;
  aiMode?: boolean;
}

/* A line accepts at most this many holiday rows. Worth knowing when importing:
   the US federal list alone is 11, so a full import will not fit and the user
   has to be told which dates were left out rather than losing them silently. */
const MAX_HOLIDAYS = 10;

const TABS = {
  GENERAL_SETTINGS: 'General Settings',
  CUSTOM_SETTINGS: 'Custom Settings',
};

const BussinessHoursModal: FC<IBussinessModalProps> = ({
  modalState,
  setModalState,
  setError,
  data,
  selectedUserExt = null,
  aiMode = false,
}) => {
  const { settings = {} } = data || {};
  const { operational_hours = OPERATIONAL_HOURS } = settings;
  const {
    trigger,
    watch,
    setValue,
    register,
    control,
    setError: setFormError,
    clearErrors,
    formState: { errors },
  } = useFormContext();

  const { user } = useUser();
  const { user_info } = user;

  const { append, remove, fields } = useFieldArray({
    control,
    name: 'settings.operational_hours.holidays',
  });

  const watchBusinessHour = watch('settings.operational_hours');
  const [activeTab, setActiveTab] = useState(TABS.GENERAL_SETTINGS);
  const handleChangeScheduleOption = (checked: boolean, day: string) => {
    const currentScheduleOptions = watchBusinessHour?.value || {};
    const updatedScheduleOptions = {
      ...currentScheduleOptions,
      [day]: {
        ...currentScheduleOptions[day],
        open: checked,
        start: checked ? '10:00' : '',
        end: checked ? '23:00' : '',
      },
    };
    setValue('settings.operational_hours.value', updatedScheduleOptions);
    const isOpen = Object.values(updatedScheduleOptions || {}).some((day: any) => day?.open);

    if (isOpen) {
      setError(null);
    } else {
      setError('You must select at least one active working day.');
    }
  };

  useEffect(() => {
    checkErrors();
  }, [watchBusinessHour]);

  const checkErrors = () => {
    if (watchBusinessHour?.type !== 'weekly') return;

    const days = Object.keys(watchBusinessHour?.value || {});

    days.forEach((day) => {
      const start = watch(`settings.operational_hours.value.${day}.start`);
      const end = watch(`settings.operational_hours.value.${day}.end`);
      const open = watch(`settings.operational_hours.value.${day}.open`);

      if (open && start && end && start >= end) {
        setFormError(`settings.operational_hours.value.${day}.end`, {
          type: 'manual',
          message: 'End time must be after start time',
        });
      } else {
        clearErrors(`settings.operational_hours.value.${day}.end`);
      }
    });
  };

  const handleSubmit = async () => {
    checkErrors();
    const hasAnyEndTimeError = Object.values(
      (errors?.settings as any)?.operational_hours?.value || {},
    ).some((day: any) => !!day?.end);
    let hasAiClosedHourError = false;

    if (aiMode && watchBusinessHour?.type === 'weekly') {
      const closedHourAction = watch('settings.operational_hours.closed_hour_action') || {};
      const closedHourType = closedHourAction?.type?.value;
      const closedHourValue = closedHourAction?.value?.value;
      const requiresDestination = closedHourType && !['HANGUP'].includes(closedHourType);
      const typeMissing = !closedHourType;
      const valueMissing = Boolean(requiresDestination && !closedHourValue);

      if (typeMissing) {
        setFormError('settings.operational_hours.closed_hour_action.type.value', {
          type: 'manual',
          message: 'Closed hour type is required',
        });
      } else {
        clearErrors('settings.operational_hours.closed_hour_action.type.value');
      }

      if (valueMissing) {
        setFormError('settings.operational_hours.closed_hour_action.value.value', {
          type: 'manual',
          message: 'Closed hour value is required',
        });
      } else {
        clearErrors('settings.operational_hours.closed_hour_action.value.value');
      }
      hasAiClosedHourError = typeMissing || valueMissing;
    }

    const isValid = await trigger([
      'settings.operational_hours.holidays',
      'settings.operational_hours.closed_hour_action',
    ]);
    if (hasAnyEndTimeError || hasAiClosedHourError || !isValid) return;

    setModalState(false);
  };
  /* Only fetched while the dialog is open — this component is mounted on every
     queue, IVR, user and number screen, and the company record does not need
     loading until someone actually opens business hours. */
  const { data: companyDefaults } = useQuery({
    queryKey: COMPANY_DEFAULTS_QUERY_KEY,
    queryFn: fetchCompanyDefaults,
    enabled: Boolean(modalState),
    staleTime: 5 * 60 * 1000,
  });

  const companyHolidays = readCompanyHolidays(companyDefaults?.settings);

  /* Copies the company's declared dates onto this line and gives each one an
     action, since a holiday without one will not validate. Existing rows are
     left exactly as they are: someone who has already tuned Christmas on this
     queue should not have it overwritten by a bulk import. */
  const importCompanyHolidays = () => {
    const existing = watch('settings.operational_hours.holidays') || [];
    const { toAppend, skippedDuplicate, skippedCapacity, unresolvedAction } = buildHolidayImport({
      companyHolidays,
      existingHolidays: existing,
      closedHourAction: watch('settings.operational_hours.closed_hour_action'),
      fallbackExtension: selectedUserExt || user_info?.extension,
      capacity: MAX_HOLIDAYS - existing.length,
    });

    /* Refused rather than appending rows that cannot validate — that would
       block saving with an error pointing at a date field, not at the cause. */
    if (unresolvedAction) {
      return handleAlert({
        text: 'Set what happens outside opening hours first. Each holiday needs an action, and company holidays copy that one.',
        type: 'error',
      });
    }

    toAppend.forEach((holiday) => append(holiday));

    const added = toAppend.length;
    if (!added && !skippedCapacity) {
      return handleAlert({
        text: skippedDuplicate
          ? 'Those company holidays are already on this line.'
          : 'No company holidays have been set up yet.',
        type: 'info',
      });
    }

    /* The capacity message names the limit, because "3 could not be added" with
       no reason reads as a bug. */
    handleAlert({
      text: skippedCapacity
        ? `Added ${added}. ${skippedCapacity} did not fit — a line holds ${MAX_HOLIDAYS} holidays. Remove some, or add the rest by hand.`
        : `Added ${added} company ${added === 1 ? 'holiday' : 'holidays'}. Check the action on each, then save.`,
      type: skippedCapacity ? 'info' : 'success',
    });
  };

  const appendCustomDays = () => {
    if (fields && fields?.length >= MAX_HOLIDAYS) return;
    append({
      title: '',
      from: null,
      to: null,
      type: { label: '', value: '' },
      value: { label: '', value: '' },
      personal: false,
    });
  };

  const handleRadioChange = (value: string) => {
    const type = value === '24_hours' ? '' : 'VOICEMAIL';
    const typeValue = value === '24_hours' ? '' : user_info?.extension;
    setValue('settings.operational_hours.type', value);
    setValue(
      'settings.operational_hours.value',
      value === 'weekly' ? CUSTOM_HOURS_SCHEDULE_OPTIONS : '',
    );
    setValue('settings.operational_hours.holidays', value === '24_hours' ? [] : []);
    setValue('settings.operational_hours.closed_hour_action', {
      type: { label: 'Send to Voicemail', value: type },
      value: { label: '', value: typeValue },
      personal: value !== '24_hours',
      enabled: value !== '24_hours',
    });
  };

  const handleCancel = () => {
    setValue('settings.operational_hours.type', operational_hours?.type || '');
    setValue('settings.operational_hours.value', operational_hours?.value || {});
    setValue('settings.operational_hours.closed_hour_action', {
      type: {
        label: !data?.settings?.operational_hours
          ? operational_hours?.closed_hour_action?.type?.label
          : operational_hours?.closed_hour_action?.type_label || '',
        value: !data?.settings?.operational_hours
          ? operational_hours?.closed_hour_action?.type?.value
          : operational_hours?.closed_hour_action?.type || '',
      },
      value: {
        label: !data?.settings?.operational_hours
          ? operational_hours?.closed_hour_action?.value?.label
          : operational_hours?.closed_hour_action?.value_label || '',
        value: !data?.settings?.operational_hours
          ? operational_hours?.closed_hour_action?.value?.value
          : operational_hours?.closed_hour_action?.value || '',
      },
      enabled: operational_hours?.closed_hour_action?.enabled,
      personal: operational_hours?.closed_hour_action?.personal,
    });
    const holidays =
      operational_hours?.holidays && operational_hours?.holidays?.length
        ? getHolidaysFormVal(operational_hours?.holidays)
        : [];

    setValue('settings.operational_hours.holidays', holidays);
    setModalState(false);
  };

  return (
    <Dialog open={modalState} onOpenChange={(val) => setModalState(val)}>
      <DialogContent
        className="max-h-[92vh] overflow-y-auto rounded-2xl border border-neutral-200 p-0 shadow-[0_20px_60px_rgba(0,0,0,0.18)] md:w-1/2"
        showCloseButton={false}
      >
        <div className="flex flex-col gap-1.5 px-5 pt-5 text-900/80">
          <div className="flex items-center justify-between gap-3 truncate text-md font-semibold">
            <DialogTitle className="flex items-center gap-2.5 text-base font-bold text-neutral-950">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-red-50 text-red-600">
                <Clock3 className="h-4 w-4" />
              </span>
              Business Hours
            </DialogTitle>
            <button
              type="button"
              onClick={handleCancel}
              className="shrink-0 rounded-full p-1.5 text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-900"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <Tabs
          value={activeTab}
          onValueChange={setActiveTab}
          className="flex max-h-[calc(100vh-250px)] w-full flex-col overflow-auto px-5 pb-5"
        >
          <TabsList className="mb-4 mt-1 inline-flex h-auto w-fit gap-[3px] self-start rounded-full bg-neutral-100 p-1 text-sm">
            <TabsTrigger
              className="rounded-full px-4 py-1.5 text-xs font-semibold text-neutral-600 transition-colors data-[state=active]:bg-white data-[state=active]:text-neutral-950 data-[state=active]:shadow-[0_1px_3px_rgba(0,0,0,0.08)]"
              value={TABS.GENERAL_SETTINGS}
            >
              {TABS.GENERAL_SETTINGS}
            </TabsTrigger>
            <TabsTrigger
              className="rounded-full px-4 py-1.5 text-xs font-semibold text-neutral-600 transition-colors data-[state=active]:bg-white data-[state=active]:text-neutral-950 data-[state=active]:shadow-[0_1px_3px_rgba(0,0,0,0.08)]"
              value={TABS.CUSTOM_SETTINGS}
            >
              {TABS.CUSTOM_SETTINGS}
            </TabsTrigger>
          </TabsList>

          <TabsContent value={TABS.GENERAL_SETTINGS}>
            <div className="mb-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
              {[
                {
                  value: '24_hours',
                  label: '24 Hours, all times',
                  copy: 'The AI answers around the clock — no after-hours handling needed.',
                  icon: <Clock3 className="h-4 w-4" />,
                },
                {
                  value: 'weekly',
                  label: 'Weekly Schedule',
                  copy: 'Set specific open hours per day. Outside those hours, callers hit your after-hours flow.',
                  icon: <CalendarClock className="h-4 w-4" />,
                },
              ].map((option) => {
                const isSelected = watch('settings.operational_hours.type') === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => handleRadioChange(option.value)}
                    className={cn(
                      'flex items-start gap-3 rounded-xl border p-3.5 text-left transition-all duration-150',
                      isSelected
                        ? 'border-red-300 bg-red-50/60 shadow-[0_2px_8px_rgba(220,38,38,.12)]'
                        : 'border-neutral-200 bg-white hover:-translate-y-0.5 hover:border-red-200 hover:bg-red-50/30',
                    )}
                  >
                    <span
                      className={cn(
                        'grid h-9 w-9 shrink-0 place-items-center rounded-lg',
                        isSelected ? 'bg-red-600 text-white' : 'bg-neutral-100 text-neutral-500',
                      )}
                    >
                      {option.icon}
                    </span>
                    <div className="min-w-0">
                      <p
                        className={cn(
                          'text-sm font-bold',
                          isSelected ? 'text-red-700' : 'text-neutral-950',
                        )}
                      >
                        {option.label}
                      </p>
                      <p className="mt-0.5 text-xs leading-5 text-neutral-500">{option.copy}</p>
                    </div>
                  </button>
                );
              })}
            </div>
            {watchBusinessHour?.type === 'weekly' && (
              <div className="min-h-[350px]">
                <div className="flex flex-col gap-2">
                  {[
                    'monday',
                    'tuesday',
                    'wednesday',
                    'thursday',
                    'friday',
                    'saturday',
                    'sunday',
                  ].map((day, index) => {
                    const currentDayData = watchBusinessHour?.value?.[day];
                    if (!currentDayData) return null;

                    const { open } = currentDayData;

                    return (
                      <div
                        key={`${day}-${index}`}
                        className={cn(
                          'flex flex-wrap items-center justify-between gap-3 rounded-2xl px-5 py-4 transition-colors',
                          open ? 'bg-red-50/50' : 'bg-neutral-50',
                        )}
                      >
                        <div className="flex w-[152px] shrink-0 items-center justify-between gap-3">
                          <Label className="text-base font-bold capitalize text-neutral-950">
                            {day}
                          </Label>
                          <Switch
                            onCheckedChange={(checked) => {
                              handleChangeScheduleOption(checked, day);
                            }}
                            checked={open}
                          />
                        </div>
                        {open && (
                          <>
                            <div className="flex shrink-0 flex-nowrap items-center gap-3">
                              <Input
                                placeholder="Enter start"
                                type="time"
                                className="h-9 w-[118px] shrink-0 grow-0 rounded-full border-neutral-200 bg-white px-3 text-xs focus-visible:border-red-400 focus-visible:ring-4 focus-visible:ring-red-100"
                                {...register(`settings.operational_hours.value.${day}.start`)}
                              />
                              <span className="shrink-0 text-xs font-medium text-neutral-400">
                                to
                              </span>
                              <Input
                                placeholder="Enter end"
                                type="time"
                                className="h-9 w-[118px] shrink-0 grow-0 rounded-full border-neutral-200 bg-white px-3 text-xs focus-visible:border-red-400 focus-visible:ring-4 focus-visible:ring-red-100"
                                {...register(`settings.operational_hours.value.${day}.end`)}
                              />
                              {(errors?.settings as any)?.operational_hours?.value?.[day]?.end
                                ?.message && (
                                <ErrorTooltip
                                  text={
                                    (errors?.settings as any)?.operational_hours?.value?.[day]?.end
                                      ?.message
                                  }
                                />
                              )}
                            </div>

                            <div className="flex shrink-0 items-center gap-2">
                              <Checkbox
                                checked={watch(
                                  `settings.operational_hours.value.${day}.is_checked`,
                                )}
                                onCheckedChange={(checked: boolean) => {
                                  setValue(
                                    `settings.operational_hours.value.${day}.is_checked`,
                                    checked,
                                  );
                                  if (checked) {
                                    setValue(
                                      `settings.operational_hours.value.${day}.start`,
                                      '00:00',
                                    );
                                    setValue(
                                      `settings.operational_hours.value.${day}.end`,
                                      '23:59',
                                    );
                                  } else {
                                    setValue(
                                      `settings.operational_hours.value.${day}.start`,
                                      '10:00',
                                    );
                                    setValue(
                                      `settings.operational_hours.value.${day}.end`,
                                      '23:00',
                                    );
                                  }
                                }}
                                id={`check-${index}`}
                              />
                              <Label
                                htmlFor={`check-${index}`}
                                className="cursor-pointer whitespace-nowrap text-sm font-semibold text-neutral-600"
                              >
                                24 Hours
                              </Label>
                            </div>
                          </>
                        )}
                      </div>
                    );
                  })}

                  {!aiMode && (
                    <div className="p-3 border border-neutral-200 rounded-lg gap-3 flex flex-col">
                      <ForwardingActions
                        setValue={setValue}
                        watch={watch}
                        errors={errors}
                        forwardState={`settings.operational_hours.closed_hour_action`}
                        mainClasses="w-full"
                        selectWidth="w-1/2"
                        selectInnerWidth="w-fit"
                        selectTwoWidth="w-fit"
                        gap="sm:gap-2 xs:gap-2"
                        mainGapClasses="gap-0"
                        mainTypeDivClass="w-1/3"
                        radioClass="w-fit pr-2"
                        mainValueJustifyClass="justify-between w-full"
                        audioCustomClass="w-80"
                        typeLabel="Closed Hour Type"
                        valueLabel="Closed Hour Value"
                        selectedUserExt={watch('basic.extension') || selectedUserExt}
                        isShowUpload={false}
                        // label="Action during holiday"
                      />
                    </div>
                  )}
                </div>
              </div>
            )}
          </TabsContent>

          <TabsContent value={TABS.CUSTOM_SETTINGS}>
            {/* Custom Days */}
            <div className="flex flex-col gap-3 rounded-xl border border-neutral-200 bg-neutral-50/60 p-3.5">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-bold text-neutral-950">Custom Days Settings</p>
                <div className="flex items-center gap-2">
                  {/* Only offered when the company has actually declared holidays,
                      so the button never promises something that does nothing. */}
                  {companyHolidays.length > 0 && (
                    <button
                      type="button"
                      onClick={() => importCompanyHolidays()}
                      disabled={fields?.length >= MAX_HOLIDAYS}
                      title={
                        fields?.length >= MAX_HOLIDAYS
                          ? `This line already holds ${MAX_HOLIDAYS} holidays`
                          : 'Copy the holidays set up for your company onto this line'
                      }
                      className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full border! border-neutral-300! bg-white! px-3 text-xs font-semibold text-neutral-700 outline-none! transition-all duration-150 hover:-translate-y-0.5 hover:border-red-300! disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0"
                    >
                      Add company holidays ({companyHolidays.length})
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => appendCustomDays()}
                    disabled={fields.length >= MAX_HOLIDAYS}
                    className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full bg-red-600! px-3 text-xs font-bold text-white! shadow-[0_2px_6px_rgba(220,38,38,.25)] transition-all duration-150 hover:-translate-y-0.5 hover:bg-red-700! disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Add day
                  </button>
                </div>
              </div>

              {fields.map((field, index) => {
                const prevToDate = watch(`settings.operational_hours.holidays.${index - 1}.to`);
                const fromPath = `settings.operational_hours.holidays.${index}.from`;
                const toPath = `settings.operational_hours.holidays.${index}.to`;
                const currentFromDate = watch(fromPath);
                return (
                  <div
                    key={field.id}
                    className="flex flex-col gap-2 bg-white p-3 rounded-lg border border-red-100"
                  >
                    <div className="flex items-end gap-2 justify-between">
                      <div className="flex items-end gap-2 w-[calc(100%_-_2.5rem)]">
                        <div className="w-1/3">
                          <Input
                            {...register(`settings.operational_hours.holidays.${index}.title`)}
                            placeholder="Title"
                            type="text"
                            error={
                              (errors?.settings as any)?.operational_hours?.holidays?.[index]?.title
                                ?.message
                            }
                          />
                        </div>
                        <div className="w-1/3">
                          <Controller
                            control={control}
                            name={fromPath}
                            render={({ field }) => (
                              <CustomDatePicker
                                placeholder="Select From"
                                minDate={prevToDate ? moment(prevToDate).toDate() : new Date()}
                                value={field.value ? moment(field.value).toDate() : null}
                                onChange={(date) => {
                                  const formattedDate = moment(date).format('YYYY-MM-DD');
                                  field.onChange(formattedDate);
                                  setValue(toPath, '');
                                }}
                                error={
                                  (errors?.settings as any)?.operational_hours?.holidays?.[index]
                                    ?.from?.message
                                }
                              />
                            )}
                          />
                        </div>
                        <div className="w-1/3">
                          <Controller
                            control={control}
                            name={toPath}
                            render={({ field }) => (
                              <CustomDatePicker
                                placeholder="Select To"
                                minDate={
                                  currentFromDate ? moment(currentFromDate).toDate() : new Date()
                                }
                                value={field.value ? moment(field.value).toDate() : null}
                                onChange={(date) => {
                                  const formattedDate = moment(date).format('YYYY-MM-DD');
                                  field.onChange(formattedDate);
                                }}
                                error={
                                  (errors?.settings as any)?.operational_hours?.holidays?.[index]
                                    ?.to?.message
                                }
                              />
                            )}
                          />
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => remove(index)}
                        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border! border-neutral-200! bg-white! text-neutral-500 outline-none! transition-colors hover:border-red-300! hover:bg-red-50! hover:text-red-600"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>

                    {!aiMode && (
                      <ForwardingHolidaysActions
                        setValue={setValue}
                        watch={watch}
                        errors={errors}
                        forwardState={`settings.operational_hours.holidays.${index}`}
                        isShowUpload={false}
                        selectedUserExt={watch('basic.extension') || selectedUserExt}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          </TabsContent>
        </Tabs>

        <DialogFooter className="border-t border-neutral-100 px-5 py-4">
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={handleCancel}
              className="inline-flex h-10 items-center justify-center rounded-full border! border-neutral-200! bg-white! px-4 text-sm font-bold text-neutral-700 outline-none! transition-all duration-150 hover:-translate-y-0.5 hover:border-red-300! hover:bg-red-50! hover:text-red-700"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => handleSubmit()}
              className="inline-flex h-10 items-center justify-center rounded-full bg-red-600! px-4 text-sm font-bold text-white! shadow-[0_2px_6px_rgba(220,38,38,.25)] transition-all duration-150 hover:-translate-y-0.5 hover:bg-red-700!"
            >
              Submit
            </button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default BussinessHoursModal;
