import CustomSelect from '@/components/custom/custom-select';
import { CustomDatePicker } from '@/components/custom/custom-datepicker';
import countriesData from '@/assets/json/countries.json';
import { ISELECTVALUE } from '@/interfaces/api-interfaces';
import { Controller, useFormContext } from 'react-hook-form';
import { useEffect, useMemo, useState } from 'react';
import { useUser } from '@/hooks/use-user';
import parsePhoneNumberFromString from 'libphonenumber-js';
import { getTodayInTimezone } from '@/lib/utils';
import { Label } from '@/components/ui/label';
import moment from 'moment';
import { Switch } from '@/components/ui/switch';
import {
  ChevronDown,
  Disc,
  FileText,
  Headphones,
  ShieldCheck,
  SlidersHorizontal,
  X,
} from 'lucide-react';
import ClockTimePicker from './clock-time-picker';

const WEEKDAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'];
const DAY_GROUPS = [
  { key: 'weekdays', label: 'Mon - Fri', days: WEEKDAYS },
  { key: 'saturday', label: 'Saturday', days: ['saturday'] },
  { key: 'sunday', label: 'Sunday', days: ['sunday'] },
];

const PERMISSION_ITEMS = [
  {
    key: 'recording',
    icon: Disc,
    title: 'Call Recording',
    description: 'For quality and compliance.',
  },
  {
    key: 'monitoring',
    icon: Headphones,
    title: 'Call Monitoring',
    description: 'Supervisors can listen live.',
  },
  {
    key: 'transcription',
    icon: FileText,
    title: 'Transcription',
    description: 'Auto-transcribe every call.',
  },
] as const;

const SettingsAndPermission = ({ campaignStatus }: { campaignStatus: string }) => {
  const {
    watch,
    setValue,
    control,
    formState: { errors },
  } = useFormContext();
  const { user } = useUser();
  const { user_info } = user || {};
  const [timezonesList, setTimezonesList] = useState<any>([]);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  /* A pending Custom Date Override — held locally until "Add" commits it
     to `settings.operational_hours.overrides`, since it needs date +
     start + end all filled in together, unlike Holidays where a single
     date is enough to add an entry immediately. */
  const [overrideDraft, setOverrideDraft] = useState({ date: '', start: '09:00', end: '17:00' });
  const watchRegionalSettings = watch('settings.operational_hours.regional');
  const selectedTimezone = watch('settings.operational_hours.regional.timezone')?.value;
  const isAutomaticRecordingEnabled = watch('settings.recording.automatic.enabled');
  const isAiCallMonitoringEnabled = watch('settings.ai_call_monitoring.enabled');
  const isTranscriptionEnabled = watch('settings.transcription.enabled');
  const isLocked = campaignStatus === 'PROCESSING';

  const parsedNumber = useMemo(() => {
    if (user_info?.phone || user_info?.phone) {
      return parsePhoneNumberFromString(`+${user_info?.phone || user_info?.phone}`);
    }
    return null;
  }, [user_info?.phone || user_info?.phone]);

  const today = useMemo(() => {
    if (!selectedTimezone) return new Date().toISOString().split('T')[0];
    return getTodayInTimezone(selectedTimezone);
  }, [selectedTimezone]);

  useEffect(() => {
    const countryCode = watchRegionalSettings?.country_code?.value
      ? watchRegionalSettings?.country_code?.value
      : parsedNumber?.country || 'US';
    const index = countriesData?.findIndex((item) => item?.isoCode === countryCode);
    if (index !== -1) {
      const countryData = countriesData[index];
      const countryLabel = `${countryData.name} (${countryData.phonecode?.startsWith('+') ? countryData.phonecode : `+${countryData.phonecode}`})`;

      setValue('settings.operational_hours.regional.country_code', {
        label: countryLabel,
        value: countryData.isoCode,
        name: countryData.name || '',
      });
      setValue(
        'settings.operational_hours.regional.country',
        {
          label: countryData.name,
          value: countryData.name,
          name: countryData.name || '',
        },
        { shouldValidate: true },
      );
    }
  }, [parsedNumber]);
  const onCountryChange = (value: ISELECTVALUE | null) => {
    const index = countriesData?.findIndex((item: any) => item?.isoCode === value?.value);

    setValue('settings.operational_hours.regional.country', value, {
      shouldValidate: true,
    });

    const countryData = countriesData[index];
    const countryLabel = `${countryData.name} (${countryData.phonecode?.startsWith('+') ? countryData.phonecode : `+${countryData.phonecode}`})`;
    setValue(
      'settings.operational_hours.regional.country_code',
      { label: countryLabel, value: countryData.isoCode, name: countryData.name || '' },
      {
        shouldValidate: true,
      },
    );
    setValue('settings.operational_hours.regional.timezone', {
      label: 'Select',
      value: '',
    });
  };
  useEffect(() => {
    const selectedCountry = watchRegionalSettings?.country_code?.value;
    if (selectedCountry) {
      const country = countriesData.find((item) => item?.isoCode === selectedCountry);
      setTimezonesList(country?.timezones || []);
    } else {
      setTimezonesList([]);
    }
  }, [watchRegionalSettings?.country_code?.value]);

  useEffect(() => {
    if (timezonesList?.length > 0) {
      const firstTimezone = timezonesList[0];
      setValue(
        'settings.operational_hours.regional.timezone',
        {
          label: firstTimezone?.zoneName,
          value: firstTimezone?.zoneName,
        },
        { shouldValidate: true },
      );
    }
  }, [timezonesList]);

  // const today = new Date().toISOString().split('T')[0];
  const _start_date = watch('startDate');
  const _end_date = watch('endDate');
  const _holidays = watch('settings.operational_hours.holidays');
  const _overrides = watch('settings.operational_hours.overrides') || [];

  const watchBusinessHour = watch('settings.operational_hours');

  const startDate = watch('startDate') ? moment(watch('startDate')) : null;
  const endDate = watch('endDate') ? moment(watch('endDate')) : null;
  /* Plain calendar span, Start Date through End Date inclusive — not
     filtered by which Working hours day-groups are active below. */
  const totalSelectedDays =
    startDate && endDate ? endDate.diff(startDate, 'days') + 1 : 0;

  /* The Mon-Fri / Sat-Sun rows apply one change to every day in the group
     at once, writing into the same per-day shape (`operational_hours.value.
     <day>.{open,start,end}`) the payload builder and schema already read. */
  const applyGroupSchedule = (
    days: string[],
    patch: Partial<{ open: boolean; start: string; end: string }>,
  ) => {
    const current = watchBusinessHour?.value || {};
    const updated = { ...current };
    days.forEach((day) => {
      updated[day] = { ...updated[day], ...patch };
    });
    setValue('settings.operational_hours.value', updated, { shouldDirty: true });
  };

  const getGroupSummary = (days: string[]) => watchBusinessHour?.value?.[days[0]] || {};

  const addOverride = () => {
    if (!overrideDraft.date) return;
    setValue('settings.operational_hours.overrides', [..._overrides, overrideDraft], {
      shouldDirty: true,
    });
    setOverrideDraft({ date: '', start: '09:00', end: '17:00' });
  };

  const removeOverride = (index: number) => {
    setValue(
      'settings.operational_hours.overrides',
      _overrides.filter((_: any, i: number) => i !== index),
      { shouldDirty: true },
    );
  };

  return (
    <div className="flex w-full flex-col gap-1">
      {/* Permissions & Features is `md:absolute` — completely out of
          normal flow on desktop — so expanding Advanced settings inside
          it can never push Select Holidays (which lives in the left
          column below Working hours) down. Flex `items-start`/height
          matching wasn't enough: the row's own height still tracked
          whichever child was tallest, so this removes that coupling
          entirely instead of trying to out-flex it. */}
      <div className="flex w-full flex-col gap-3 md:relative">
        <div className="flex w-full flex-col gap-1.5 md:w-[65%]">
          <div className="grid grid-cols-1 gap-1.5 md:grid-cols-2 md:gap-3">
            <CustomSelect
              label={'Country'}
              isDisabled={isLocked}
              placeholder="Select Country"
              className="acp-compact-field"
              options={countriesData.map((country: { name: string; isoCode: string }) => ({
                label: country?.name,
                value: country?.isoCode,
              }))}
              handleChange={(e: ISELECTVALUE | null) => {
                onCountryChange(e);
              }}
              value={watch('settings.operational_hours.regional.country')}
              error={(errors.settings as any)?.operational_hours?.regional?.country?.value?.message}
            />
            <CustomSelect
              label={'Timezone'}
              isDisabled={isLocked}
              placeholder="Select Timezone"
              className="acp-compact-field"
              options={timezonesList.map((timezone: { zoneName: string }) => ({
                label: timezone?.zoneName,
                value: timezone?.zoneName,
              }))}
              handleChange={(e: ISELECTVALUE | null) => {
                setValue('settings.operational_hours.regional.timezone', e || {}, {
                  shouldValidate: true,
                });
              }}
              value={watch('settings.operational_hours.regional.timezone')}
              error={
                (errors.settings as any)?.operational_hours?.regional?.timezone?.value?.message
              }
            />
          </div>
          <div className="flex w-full flex-col gap-2 md:flex-row mt-2">
            <div className="flex flex-col gap-1 w-full">
              <Controller
                control={control}
                name="startDate"
                rules={{
                  required: 'Start date is required',
                  validate: (value) =>
                    !_end_date ||
                    moment(value).isBefore(moment(_end_date), 'day') ||
                    'Start date must be before end date',
                }}
                render={({ field }) => (
                  <CustomDatePicker
                    disabled={isLocked}
                    label="Start Date"
                    placeholder="Enter start date"
                    className="acp-compact-field"
                    value={field.value ? moment(field.value, 'YYYY-MM-DD').toDate() : null}
                    onChange={(date) =>
                      field.onChange(date ? moment(date).format('YYYY-MM-DD') : '')
                    }
                    error={errors?.startDate?.message}
                    minDate={moment(today, 'YYYY-MM-DD').toDate()}
                    maxDate={_end_date ? moment(_end_date).subtract(1, 'day').toDate() : undefined}
                  />
                )}
              />
            </div>

            <div className="flex flex-col gap-1 w-full">
              <Controller
                control={control}
                name="endDate"
                rules={{
                  required: 'End date is required',
                  validate: (value) =>
                    !_start_date ||
                    moment(value).isAfter(moment(_start_date), 'day') ||
                    'End date must be after start date',
                }}
                render={({ field }) => (
                  <CustomDatePicker
                    label="End Date"
                    disabled={isLocked}
                    placeholder="Enter end date"
                    className="acp-compact-field"
                    value={field.value ? moment(field.value, 'YYYY-MM-DD').toDate() : null}
                    onChange={(date) => field.onChange(date ? moment(date).format('YYYY-MM-DD') : '')}
                    error={errors?.endDate?.message}
                    minDate={
                      _start_date
                        ? moment(_start_date).add(1, 'day').toDate()
                        : moment(today, 'YYYY-MM-DD').toDate()
                    }
                  />
                )}
              />
            </div>

            <div className="flex flex-col gap-1 w-full">
              <Label>Duration</Label>
              <span className="bg-gray-100 rounded-lg text-gray-700 text-[12.5px] font-medium px-2.5 flex w-full items-center h-9">
                {totalSelectedDays} Days
              </span>
            </div>
          </div>

          {/* Working hours — a compact Mon-Fri / Sat-Sun summary; each row
            writes the same change to every day in that group. Always a
            single row (no stacking breakpoint) so the Active/Inactive
            pill stays at the far right instead of dropping below the
            time fields on a narrower window. */}
          <div className={`w-full ${isLocked ? 'pointer-events-none opacity-50' : ''}`}>
            <Label className="text-sm font-semibold">Working hours</Label>
            <p className="text-xs text-gray-500 mt-0.5 mb-1.5">
              Set the days and time range when agents are allowed to make calls.
            </p>

            <div className="flex flex-col gap-1.5">
              {DAY_GROUPS.map((group) => {
                const summary = getGroupSummary(group.days);
                const groupOpen = Boolean(summary?.open);
                return (
                  <div
                    key={group.key}
                    className="flex items-center gap-2 rounded-xl border border-gray-200 p-2"
                  >
                    <div className="flex items-center gap-1.5 flex-none">
                      <Label className="text-sm font-medium whitespace-nowrap">{group.label}</Label>
                      <Switch
                        disabled={isLocked}
                        checked={groupOpen}
                        onCheckedChange={(checked) =>
                          applyGroupSchedule(
                            group.days,
                            checked
                              ? { open: true, start: '10:00', end: '23:00' }
                              : { open: false },
                          )
                        }
                      />
                    </div>
                    <div className="flex flex-1 items-center gap-1.5 min-w-0">
                      <ClockTimePicker
                        disabled={isLocked || !groupOpen}
                        value={summary?.start || '10:00'}
                        onChange={(next) => applyGroupSchedule(group.days, { start: next })}
                      />
                      <span className="text-gray-400 text-xs flex-none">-</span>
                      <ClockTimePicker
                        disabled={isLocked || !groupOpen}
                        value={summary?.end || '23:00'}
                        onChange={(next) => applyGroupSchedule(group.days, { end: next })}
                      />
                    </div>
                    <span
                      className={`text-xs font-medium px-2 py-1 rounded-full whitespace-nowrap flex-none ${
                        groupOpen ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                      }`}
                    >
                      {groupOpen ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Lives inside the left column now, right under Working hours —
              not as a sibling of the row, so expanding Advanced settings
              in the right panel (which can only grow the row's overall
              height) never pushes this down. It only reacts to this
              column's own content. */}
          <div className="rounded-lg gap-1.5 flex flex-col">
            <div className="flex flex-col items-start gap-1.5">
              <div className="flex w-full flex-col gap-1 md:w-2/4">
                <Label>Select Holidays</Label>
                <div className="w-full flex flex-col">
                  <CustomDatePicker
                    className="acp-compact-field"
                    disabled={isLocked}
                    value={null}
                    placeholder="Pick a date"
                    onChange={(date) => {
                      if (!date) return;
                      const _selectedVal = moment(date).format('YYYY-MM-DD');
                      return setValue(
                        'settings.operational_hours.holidays',
                        _holidays.includes(_selectedVal)
                          ? _holidays.filter((_value: any) => _selectedVal !== _value)
                          : [..._holidays, _selectedVal],
                      );
                    }}
                  />
                </div>
              </div>
              {_holidays && _holidays?.length ? (
                <div className="flex flex-col gap-1">
                  <span className="font-semibold text-sm">Holidays:</span>
                  <div className="flex flex-wrap gap-2">
                    {_holidays?.map((day: any) => (
                      <div
                        key={day}
                        className="flex items-center gap-1.5 min-h-10 border border-gray-300 border-dashed px-3 py-2 rounded-md bg-gray-50 relative"
                      >
                        <Label>{moment(day)?.format('MMM DD, YYYY')}</Label>
                        <span className="text-sm text-gray-600">{moment(day).format('ddd')}</span>

                        <button
                          type="button"
                          onClick={() =>
                            setValue(
                              'settings.operational_hours.holidays',
                              _holidays?.filter((_value: any) => _value !== day),
                            )
                          }
                          className="absolute -top-1 -right-1 p-0.5 rounded-full bg-red-500 text-white hover:bg-red-600"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </div>

        <div className="w-full rounded-xl border border-gray-200 bg-white md:absolute md:right-0 md:top-0 md:w-[32%] md:mt-[22px]">
          <div className="flex items-center gap-1.5 px-2 pt-2 pb-1">
            <ShieldCheck className="w-3 h-3 text-primary" />
            <Label className="text-xs font-semibold">Permissions & Features</Label>
          </div>
          {PERMISSION_ITEMS.map((item, index) => {
            const checked =
              item.key === 'recording'
                ? isAutomaticRecordingEnabled
                : item.key === 'monitoring'
                  ? isAiCallMonitoringEnabled
                  : isTranscriptionEnabled;
            const Icon = item.icon;
            return (
              <div key={item.key}>
                {index > 0 && <div className="border-t border-gray-100" />}
                <div className="flex items-start gap-1.5 p-1.5">
                  <span className="grid place-items-center w-5 h-5 rounded-md bg-primary/10 text-primary flex-none mt-0.5">
                    <Icon className="w-3 h-3" />
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-gray-900 leading-tight">{item.title}</p>
                    <p className="text-[11px] text-gray-500 leading-snug mt-0.5">
                      {item.description}
                    </p>
                  </div>
                  <Switch
                    disabled={isLocked}
                    checked={checked}
                    className="mt-0.5"
                    onCheckedChange={(nextChecked) => {
                      if (item.key === 'recording') {
                        setValue(
                          'settings.recording.automatic',
                          {
                            enabled: nextChecked,
                            value: 'all',
                            label: 'All',
                            recording_on: 'ad98d65d-fcf8-4d4d-bc77-ee1426c34333.mp3',
                          },
                          { shouldDirty: true, shouldValidate: true },
                        );
                      } else if (item.key === 'monitoring') {
                        setValue(
                          'settings.ai_call_monitoring',
                          { enabled: nextChecked },
                          { shouldDirty: true, shouldValidate: true },
                        );
                        if (nextChecked) {
                          setValue(
                            'settings.transcription',
                            { enabled: true },
                            { shouldDirty: true, shouldValidate: true },
                          );
                        }
                      } else {
                        setValue(
                          'settings.transcription',
                          { enabled: nextChecked },
                          { shouldDirty: true, shouldValidate: true },
                        );
                        if (!nextChecked) {
                          setValue(
                            'settings.ai_call_monitoring',
                            { enabled: false },
                            { shouldDirty: true, shouldValidate: true },
                          );
                        }
                      }
                    }}
                  />
                </div>
              </div>
            );
          })}
          <div className="border-t-2 border-gray-200 mt-1.5" />
          <button
            type="button"
            className={`flex w-full items-center gap-2 p-2.5 mt-1.5 text-left bg-gray-50 ${advancedOpen ? '' : 'rounded-b-xl'}`}
            onClick={() => setAdvancedOpen((prev) => !prev)}
          >
            <span className="grid place-items-center w-6 h-6 rounded-md bg-gray-200 text-gray-600 flex-none">
              <SlidersHorizontal className="w-3.5 h-3.5" />
            </span>
            <span className="flex-1 min-w-0 text-sm font-semibold text-gray-900">
              Advanced settings
            </span>
            <ChevronDown
              className={`w-4 h-4 text-gray-400 flex-none transition-transform ${advancedOpen ? 'rotate-180' : ''}`}
            />
          </button>
          {advancedOpen && (
            <div className="px-2.5 pb-2.5 bg-gray-50 rounded-b-xl">
              {/* One-off override for a specific date — a half-day or a
                  special shift — kept separate from Holidays, which just
                  closes a day entirely rather than changing its hours. */}
              <div className="rounded-lg border border-gray-200 p-1.5 flex flex-col gap-1.5">
                <p className="text-[11px] font-semibold text-gray-700">Custom Date Override</p>
                <div className="flex items-center gap-1 flex-wrap">
                  <CustomDatePicker
                    className="acp-compact-field min-w-[110px]"
                    disabled={isLocked}
                    value={
                      overrideDraft.date
                        ? moment(overrideDraft.date, 'YYYY-MM-DD').toDate()
                        : null
                    }
                    onChange={(date) =>
                      setOverrideDraft((prev) => ({
                        ...prev,
                        date: date ? moment(date).format('YYYY-MM-DD') : '',
                      }))
                    }
                  />
                  <ClockTimePicker
                    className="min-w-[90px]"
                    disabled={isLocked}
                    value={overrideDraft.start}
                    onChange={(next) => setOverrideDraft((prev) => ({ ...prev, start: next }))}
                  />
                  <ClockTimePicker
                    className="min-w-[90px]"
                    disabled={isLocked}
                    value={overrideDraft.end}
                    onChange={(next) => setOverrideDraft((prev) => ({ ...prev, end: next }))}
                  />
                  <button
                    type="button"
                    disabled={isLocked || !overrideDraft.date}
                    onClick={addOverride}
                    className="flex-none h-[34px] px-2.5 rounded-md bg-primary text-white text-[11px] font-medium disabled:opacity-40"
                  >
                    Add
                  </button>
                </div>
                {_overrides.length > 0 && (
                  <div className="flex flex-col gap-1">
                    {_overrides.map((item: any, index: number) => (
                      <div
                        key={`${item.date}-${index}`}
                        className="flex items-center justify-between gap-2 rounded-md bg-gray-50 px-2 py-1"
                      >
                        <span className="text-[11px] text-gray-700">
                          {item.date ? moment(item.date).format('MMM DD, YYYY') : ''} · {item.start}
                          –{item.end}
                        </span>
                        <button
                          type="button"
                          disabled={isLocked}
                          onClick={() => removeOverride(index)}
                          className="flex-none p-0.5 rounded-full bg-red-500 text-white hover:bg-red-600"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
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

export default SettingsAndPermission;
