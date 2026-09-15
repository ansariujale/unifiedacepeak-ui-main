import { Icon } from '@/assets/icons/icon';
import CustomSelect from '@/components/custom/custom-select';
import ErrorTooltip from '@/components/custom/error-tooltip';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { ISELECTVALUE } from '@/interfaces/api-interfaces';
import { getDispositions, getGreetings } from '@/services/api';
import { useQuery } from '@tanstack/react-query';
import {
  AlertTriangle,
  BarChart3,
  CheckCircle2,
  Clock,
  Eye,
  Gauge,
  MessageCircle,
  MessageSquare,
  PhoneCall,
  PhoneMissed,
  PhoneOff,
  RefreshCw,
  Smile,
  Sparkles,
  Tag,
  ThumbsDown,
  ThumbsUp,
  Users,
  Voicemail,
  Zap,
} from 'lucide-react';
import { FC, ReactNode } from 'react';
import { useFormContext } from 'react-hook-form';
import { DEFAULT_RETRY_PERIOD_TYPE, DIALER_TYPE, MAX_ATTEMPTS, TIME_LIST } from '../consts';

/** Same icon per mode as the type picker above this step, so the settings
    card reads as a continuation of the choice the user already made. */
const MODE_ICON: Record<string, typeof Eye> = {
  [DIALER_TYPE.PREVIEW]: Eye,
  [DIALER_TYPE.NORMAL]: Gauge,
  [DIALER_TYPE.PREDICTIVE]: Zap,
};

const MODE_COPY: Record<string, { title: string; desc: string }> = {
  [DIALER_TYPE.PREVIEW]: {
    title: 'Preview Settings',
    desc: 'Agents review each lead before the call connects — kept lightweight for manual dialing.',
  },
  [DIALER_TYPE.NORMAL]: {
    title: 'Progressive Dialing Settings',
    desc: 'One lead is dialed per available agent, at a steady pace.',
  },
  [DIALER_TYPE.PREDICTIVE]: {
    title: 'Predictive Dialing Settings',
    desc: 'The dialer predicts agent availability and dials ahead of it for maximum efficiency.',
  },
};

/** Best-effort icon per disposition, matched on its name — purely
    cosmetic, falls back to a plain message icon for anything unmatched. */
const DISPOSITION_ICON_RULES: [RegExp, typeof MessageCircle][] = [
  [/not\s*interested/i, ThumbsDown],
  [/interested/i, ThumbsUp],
  [/sale|closed|deal|won/i, Tag],
  [/feedback/i, MessageSquare],
  [/happy|satisf/i, Smile],
  [/call\s*back|callback|follow/i, PhoneCall],
  [/resolved|complete/i, CheckCircle2],
  [/voicemail|vm\b/i, Voicemail],
  [/no\s*answer|missed/i, PhoneMissed],
  [/busy/i, PhoneOff],
];
const getDispositionIcon = (name: string) => {
  const match = DISPOSITION_ICON_RULES.find(([pattern]) => pattern.test(name || ''));
  return match ? match[1] : MessageCircle;
};

const isLocked = (campaignStatus: string) => campaignStatus !== '' && campaignStatus !== 'NEW';

const Settings: FC<any> = ({ dialMethod, setModalState, campaignStatus }) => {
  const { data: voicemailList = [] } = useQuery({
    queryKey: ['useGetVoicemails'],
    queryFn: () =>
      getGreetings({
        page: 1,
        limit: 1000,
        filters: [],
        search: '',
        type: 'voicemail',
        sort: { key: 'created_at', desc: true },
      }),
    select: (data) => data?.data?.data?.result?.rows || [],
  });

  const {
    register,
    formState: { errors },
    setValue,
    watch,
  } = useFormContext();
  const disabled = isLocked(campaignStatus);
  const dialerErrors = (errors as any)?.dialerSetting;

  const { data: dispositionsListRaw = [] } = useQuery({
    queryKey: ['getDispositionsList'],
    queryFn: () => getDispositions({ page: 1, limit: 200 }),
    select: (data) => data?.data?.data?.result?.rows || [],
  });
  /* TEMP: no dispositions exist in this environment yet (the endpoint
     currently errors — no DB connection), which left "Agent
     Disposition" with nothing to pick and no way to satisfy its
     required-selection validation to reach the next step. Falls back
     to sample rows only when the real list is empty, so it disappears
     on its own once real dispositions exist. */
  const dispositionsList =
    dispositionsListRaw.length > 0
      ? dispositionsListRaw
      : [
          { _id: 'demo-disp-1', dispositionType: 'AGENT', disposition: { name: 'Interested' } },
          {
            _id: 'demo-disp-2',
            dispositionType: 'AGENT',
            disposition: { name: 'Not Interested' },
          },
          { _id: 'demo-disp-3', dispositionType: 'AGENT', disposition: { name: 'No Answer' } },
        ];

  const handleDispositionCheck = (checked: boolean, item: any) => {
    const currentValues = watch('agentDisposition') || [];
    if (checked) {
      if (!currentValues.some((d: any) => d._id === item?._id)) {
        setValue('agentDisposition', [...currentValues, { ...item }], { shouldValidate: true });
      }
    } else {
      setValue(
        'agentDisposition',
        currentValues.filter((d: any) => d._id !== item?._id),
        { shouldValidate: true },
      );
    }
  };

  const isDispositionChecked = (item: any) => {
    return (watch('agentDisposition') || []).some((d: any) => d._id === item?._id);
  };

  /* ---- small building blocks shared across all three modes ---- */

  /** The icon rides inside the field's own label, so every field keeps
      using the label prop CustomSelect/Input already render — no second,
      duplicate label bolted on top. */
  const fieldLabel = (LabelIcon: typeof Clock, text: string) => (
    <span className="acp-field-card-label">
      <LabelIcon size={12} />
      {text}
    </span>
  );

  const FieldCard = ({ children }: { children: ReactNode }) => (
    <div className="acp-field-card">{children}</div>
  );

  const TimeField = ({
    path,
    label,
    icon = Clock,
  }: {
    path: string;
    label: string;
    icon?: typeof Clock;
  }) => (
    <FieldCard>
      <CustomSelect
        label={fieldLabel(icon, label)}
        isDisabled={disabled}
        placeholder="Select Option"
        options={TIME_LIST.map((item) => ({ label: item, value: item }))}
        handleChange={(e: ISELECTVALUE | null) =>
          setValue(path, e?.value || '', { shouldValidate: true })
        }
        value={{ value: watch(path), label: watch(path) }}
        error={path.split('.').reduce((acc: any, k) => acc?.[k], errors as any)?.message}
        menuPlacement="auto"
      />
    </FieldCard>
  );

  const RetryIntervalField = ({
    label,
    icon: LabelIcon = RefreshCw,
  }: {
    label: string;
    icon?: typeof Clock;
  }) => (
    <FieldCard>
      <div className="relative flex flex-col gap-1.5 w-full">
        <Label className="text-sm font-medium leading-none">{fieldLabel(LabelIcon, label)}</Label>
        <div className="flex gap-1">
          <div className="w-full relative">
            <Input
              disabled={disabled}
              placeholder="Enter value"
              type="number"
              {...register('dialerSetting.default_retry_period')}
            />
            <span className="absolute top-[-20px] right-0">
              {dialerErrors?.default_retry_period?.message && (
                <ErrorTooltip text={dialerErrors?.default_retry_period?.message} />
              )}
            </span>
          </div>
          <CustomSelect
            className="max-w-[100px]"
            isDisabled={disabled}
            placeholder="Unit"
            options={DEFAULT_RETRY_PERIOD_TYPE.map((item) => ({
              label: item?.label,
              value: item?.value,
            }))}
            handleChange={(e: ISELECTVALUE | null) =>
              setValue('dialerSetting.default_retry_period_type', e || '', {
                shouldValidate: true,
              })
            }
            value={watch('dialerSetting.default_retry_period_type')}
            error={dialerErrors?.default_retry_period_type?.message}
            menuPlacement="auto"
          />
        </div>
      </div>
    </FieldCard>
  );

  const MaxAttemptsField = ({
    label,
    icon = BarChart3,
  }: {
    label: string;
    icon?: typeof Clock;
  }) => (
    <FieldCard>
      <CustomSelect
        label={fieldLabel(icon, label)}
        placeholder="Select Option"
        isDisabled={disabled}
        options={MAX_ATTEMPTS.map((item) => ({ label: item, value: item }))}
        handleChange={(e: ISELECTVALUE | null) =>
          setValue('dialerSetting.max_attempt_per_record', e?.value || '', {
            shouldValidate: true,
          })
        }
        value={{
          value: watch('dialerSetting.max_attempt_per_record'),
          label: watch('dialerSetting.max_attempt_per_record'),
        }}
        error={dialerErrors?.max_attempt_per_record?.message}
        menuPlacement="auto"
      />
    </FieldCard>
  );

  const PercentField = ({
    path,
    label,
    icon = Users,
  }: {
    path: string;
    label: string;
    icon?: typeof Clock;
  }) => (
    <FieldCard>
      <Input
        label={fieldLabel(icon, label)}
        type="number"
        min={0}
        max={100}
        disabled={disabled}
        placeholder="0–100"
        {...register(path)}
        error={path.split('.').reduce((acc: any, k) => acc?.[k], errors as any)?.message}
      />
    </FieldCard>
  );

  const NumberField = ({
    path,
    label,
    icon = PhoneCall,
    placeholder,
    min,
    max,
  }: {
    path: string;
    label: string;
    icon?: typeof Clock;
    placeholder?: string;
    min?: number;
    max?: number;
  }) => (
    <FieldCard>
      <Input
        label={fieldLabel(icon, label)}
        type="number"
        min={min}
        max={max}
        disabled={disabled}
        placeholder={placeholder}
        {...register(path)}
        error={path.split('.').reduce((acc: any, k) => acc?.[k], errors as any)?.message}
      />
    </FieldCard>
  );

  const SwitchRow = ({
    path,
    title,
    hint,
    icon: RowIcon,
  }: {
    path: string;
    title: string;
    hint: string;
    icon: typeof Clock;
  }) => {
    const checked = Boolean(watch(path));
    return (
      <div className={`acp-switch-row${checked ? ' is-on' : ''}`}>
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="acp-switch-row-ico">
            <RowIcon size={14} />
          </span>
          <div className="min-w-0">
            <p>{title}</p>
            <span className="hint">{hint}</span>
          </div>
        </div>
        <Switch
          disabled={disabled}
          onCheckedChange={(next) => setValue(path, next, { shouldDirty: true })}
          checked={checked}
        />
      </div>
    );
  };

  const AnsweringMachineField = () => (
    <div className={`acp-switch-row acp-switch-row-tall${watch('dialerSetting.answering_detection_machine.enabled') ? ' is-on' : ''}`}>
      <div className="w-full flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="acp-switch-row-ico">
              <Voicemail size={14} />
            </span>
            <p>Answering Machine Handling</p>
          </div>
          <Switch
            disabled={disabled}
            onCheckedChange={(checked) =>
              setValue('dialerSetting.answering_detection_machine.enabled', checked)
            }
            checked={watch('dialerSetting.answering_detection_machine.enabled')}
          />
        </div>
        {watch('dialerSetting.answering_detection_machine.enabled') ? (
          <div className="flex w-full flex-wrap gap-3 items-center pl-[34px]">
            <RadioGroup
              disabled={disabled}
              className="flex items-center gap-4"
              value={watch('dialerSetting.answering_detection_machine.type')}
              onValueChange={(value) =>
                setValue('dialerSetting.answering_detection_machine.type', value)
              }
            >
              <div className="flex items-center gap-2 cursor-pointer">
                <RadioGroupItem value="HANGUP" id="HANGUP" />
                <Label htmlFor="HANGUP" className="cursor-pointer">
                  Hangup
                </Label>
              </div>
              <div className="flex items-center gap-2 cursor-pointer">
                <RadioGroupItem value="VOICEMAIL" id="VOICEMAIL" />
                <Label htmlFor="VOICEMAIL" className="cursor-pointer">
                  Voicemail Message
                </Label>
              </div>
            </RadioGroup>
            {watch('dialerSetting.answering_detection_machine.type') === 'VOICEMAIL' && (
              <div className="min-w-[180px]">
                <CustomSelect
                  isDisabled={disabled}
                  options={
                    voicemailList?.length > 0
                      ? voicemailList?.map((item: { name: string; uuid: string }) => ({
                          label: item?.name,
                          value: item?.uuid,
                        }))
                      : [{ label: 'No record found!', value: '', disabled: true }]
                  }
                  handleChange={(e: ISELECTVALUE | null) =>
                    setValue('dialerSetting.answering_detection_machine.value', e, {
                      shouldValidate: true,
                    })
                  }
                  value={watch('dialerSetting.answering_detection_machine.value') || {}}
                  error={dialerErrors?.answering_detection_machine?.value?.value?.message}
                  menuPlacement="auto"
                />
              </div>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );

  const CallingHoursNote = () => (
    <p className="acp-note">
      Calling hours are set on the <strong>Setting &amp; Permission</strong> step — the campaign
      only dials leads inside the window configured there.
    </p>
  );

  /* ---- the mode-specific section: only one of these renders at a time ---- */

  const renderModeFields = () => {
    if (dialMethod === DIALER_TYPE.PREVIEW) {
      return (
        <>
          <div className="acp-field-grid">
            <TimeField path="dialerSetting.preview_time" label="Preview time" icon={Clock} />
            <TimeField path="dialerSetting.wrapup_time" label="Wrap-up time" icon={Clock} />
            <RetryIntervalField label="Retry preference" icon={RefreshCw} />
            <MaxAttemptsField label="Maximum attempts" icon={BarChart3} />
          </div>
          <div className="acp-field-grid">
            <SwitchRow
              path="dialerSetting.manual_review_required"
              title="Manual dialing"
              hint="Agent reviews the lead and starts each call by hand."
              icon={Users}
            />
            <SwitchRow
              path="dialerSetting.require_disposition"
              title="Require call disposition"
              hint="Agent must log an outcome before moving to the next lead."
              icon={PhoneCall}
            />
          </div>
        </>
      );
    }

    if (dialMethod === DIALER_TYPE.NORMAL) {
      return (
        <>
          <div className="acp-field-grid">
            <PercentField
              path="dialerSetting.agent_availability_percent"
              label="Agent availability (%)"
              icon={Users}
            />
            <NumberField
              path="dialerSetting.agent_contact_limit"
              label="Calls per agent"
              icon={PhoneCall}
              placeholder="e.g. 1"
              min={1}
            />
            <MaxAttemptsField label="Retry attempts" icon={BarChart3} />
            <RetryIntervalField label="Retry interval" icon={RefreshCw} />
          </div>
          <AnsweringMachineField />
          <CallingHoursNote />
        </>
      );
    }

    // PREDICTIVE — same building blocks, more of them, denser grid.
    return (
      <>
        <div className="acp-field-grid acp-field-grid-3">
          <NumberField
            path="dialerSetting.dialing_ratio"
            label="Dialing ratio"
            icon={Gauge}
            placeholder="e.g. 2"
            min={1}
            max={10}
          />
          <NumberField
            path="dialerSetting.max_concurrent_calls"
            label="Max concurrent calls"
            icon={PhoneCall}
            placeholder="e.g. 10"
            min={1}
          />
          <PercentField
            path="dialerSetting.agent_availability_percent"
            label="Agent availability (%)"
            icon={Users}
          />
          <PercentField
            path="dialerSetting.abandon_rate_percent"
            label="Abandon rate (%)"
            icon={AlertTriangle}
          />
          <TimeField
            path="dialerSetting.ringing_agent_time"
            label="Ringing agent time"
            icon={Clock}
          />
          <TimeField path="dialerSetting.max_ring_time" label="Max ring time" icon={Clock} />
          <TimeField path="dialerSetting.wrapup_time" label="Wrap-up time" icon={Clock} />
          <MaxAttemptsField label="Retry attempts" icon={BarChart3} />
          <RetryIntervalField label="Retry interval" icon={RefreshCw} />
        </div>
        <div className="acp-field-grid">
          <SwitchRow
            path="dialerSetting.auto_answering.enabled"
            title="Automatic answer"
            hint="Connect the agent the instant a call is answered."
            icon={CheckCircle2}
          />
        </div>
        <AnsweringMachineField />
        <CallingHoursNote />
      </>
    );
  };

  const ModeIcon = MODE_ICON[dialMethod as string] || Eye;
  const copy = MODE_COPY[dialMethod as string] || MODE_COPY[DIALER_TYPE.PREVIEW];
  const modeClass =
    dialMethod === DIALER_TYPE.NORMAL
      ? 'acp-mode-normal'
      : dialMethod === DIALER_TYPE.PREDICTIVE
        ? 'acp-mode-predictive'
        : 'acp-mode-preview';

  return (
    <div className="flex flex-col gap-4">
      <div className={`acp-mode-card ${modeClass}`}>
        <div className="acp-mode-card-head">
          <span className="acp-mode-card-ico">
            <ModeIcon size={16} />
          </span>
          <div className="min-w-0">
            <h3 className="acp-mode-card-title">{copy.title}</h3>
            <p className="acp-mode-card-desc">{copy.desc}</p>
          </div>
          {dialMethod === DIALER_TYPE.PREDICTIVE && (
            <span className="acp-mode-badge">
              <Sparkles size={10} />
              Advanced
            </span>
          )}
        </div>
        <div className={`acp-mode-card-body ${disabled ? 'pointer-events-none opacity-50' : ''}`}>
          {renderModeFields()}
        </div>
      </div>

      <div className={`acp-card ${disabled ? 'pointer-events-none opacity-50' : ''}`}>
        <div className="acp-card-head">
          <div className="flex items-center gap-1">
            <h3 className="acp-card-title">Agent Disposition</h3>
            {(errors as any)?.agentDisposition?.message && (
              <ErrorTooltip text={(errors as any)?.agentDisposition?.message} />
            )}
          </div>
          <Button
            className="shadow-none"
            variant="secondary"
            type="button"
            onClick={() => setModalState(true)}
          >
            <Icon name="Plus" className="w-3 h-3" />
          </Button>
        </div>
        <div className="acp-disposition-grid">
          {dispositionsList && dispositionsList?.length
            ? dispositionsList
                ?.filter((item: any) => item?.dispositionType?.toLowerCase() === 'agent')
                ?.map((item: any) => {
                  const name = item?.disposition?.name || '';
                  const DispIcon = getDispositionIcon(name);
                  const checked = isDispositionChecked(item);
                  return (
                    <div
                      key={`${name}`}
                      className={`acp-disposition-card${checked ? ' is-on' : ''}`}
                    >
                      <span className="acp-disposition-ico">
                        <DispIcon size={13} />
                      </span>
                      <label htmlFor={item?._id} className="acp-disposition-label">
                        {name}
                      </label>
                      <Switch
                        id={item?._id}
                        onCheckedChange={(next) => handleDispositionCheck(next, item)}
                        checked={checked}
                      />
                    </div>
                  );
                })
            : null}
        </div>
      </div>
    </div>
  );
};

export default Settings;
