import { Icon } from '@/assets/icons/icon';
import SelectGreeting from '@/components/custom/greeting-select';
import { Switch } from '@/components/ui/switch';
import { GreetingItem } from '@/hooks/common';
import { useIsStarterPlan } from '@/hooks/use-is-starter-plan';
import { ISELECTVALUE } from '@/interfaces/api-interfaces';
import { capitalizeFirstLetter } from '@/lib/utils';
import { FC, useRef } from 'react';
import { useFormContext } from 'react-hook-form';

/** Plain row labels for the Settings > Greetings page (acepeakTheme) only —
 * every other caller keeps the original "Do you want to add ... message ?"
 * copy built from its own `label` field below. Keyed by `name`, which is
 * only ever one of these four for that one page's own media options. */
const ACEPEAK_ROW_LABELS: Record<string, string> = {
  welcome_greeting: 'Welcome message',
  on_hold_music: 'On hold music',
  voicemail: 'Voicemail message',
  ring_tone: 'Ring tone',
};

/** Same acepeakTheme-only opt-in as the row labels above — a short helper
 * sentence shown beside each title, only on the Settings > Greetings page. */
const ACEPEAK_ROW_DESCRIPTIONS: Record<string, string> = {
  welcome_greeting: 'Play a greeting when callers first connect.',
  on_hold_music: 'Play music while callers are waiting on hold.',
  voicemail: 'Play a message when a call goes to voicemail.',
  ring_tone: 'Choose the sound played when an incoming call rings.',
};

interface IGREETINGPROPS {
  optionsData: Record<string, GreetingItem[]>;
  mediaOptionsGreetingNotifications: Array<any>;
  formParentKey?: string;
  customClass?: string;
  /** Undefined by default — SelectGreeting/CustomSelect then fall back to
   * their own default (document.body). Only passed by callers that want
   * these dropdowns' menus kept inside their own page's scoped styling. */
  selectMenuPortalTarget?: HTMLElement | null | boolean;
  /** Opt-in visual theme for the standalone Settings > Greetings page only
   * — every other caller (admin per-user forwarding, campaigns, call
   * queues, IVR menus, number forwarding media) leaves this unset and
   * keeps its current multi-coloured look untouched. When on, each row's
   * icon is recoloured (neutral, red only while that media type is
   * enabled) and rows get a class hook for that page's own row divider. */
  acepeakTheme?: boolean;
}

const CommonGreetingNotification: FC<IGREETINGPROPS> = ({
  optionsData,
  mediaOptionsGreetingNotifications,
  formParentKey = 'greetings',
  customClass = 'h-[calc(100vh_-_17rem)]',
  selectMenuPortalTarget,
  acepeakTheme = false,
}) => {
  const isStarterPlan = useIsStarterPlan();
  const greetingFormSnapshotRef = useRef<{
    value: any;
    wasDirty: boolean;
  } | null>(null);
  const {
    formState: { dirtyFields, errors },
    getValues,
    watch,
    setValue,
  } = useFormContext<any>();

  const watchMedia = watch(formParentKey);
  const visibleMediaOptions = mediaOptionsGreetingNotifications.filter(
    ({ name }) => !isStarterPlan || !['hold', 'on_hold_music'].includes(name),
  );

  const onChangeMedia = (name: string, status: boolean) => {
    setValue(`${formParentKey}.${name}.enabled`, status, {
      shouldDirty: true,
      shouldTouch: true,
    });
    setValue(`${formParentKey}.${name}.value`, { label: '', value: '' } as ISELECTVALUE, {
      shouldDirty: true,
      shouldTouch: true,
      // shouldValidate: true,
    });
  };

  const preserveGreetingForm = () => {
    const currentGreetings = getValues(formParentKey);
    let snapshot = currentGreetings;

    try {
      snapshot = JSON.parse(JSON.stringify(currentGreetings));
    } catch {
      // Greeting form values are plain data; retain the current object if cloning ever fails.
    }

    greetingFormSnapshotRef.current = {
      value: snapshot,
      wasDirty: Boolean((dirtyFields as any)?.[formParentKey]),
    };
  };

  const restoreGreetingForm = () => {
    const snapshot = greetingFormSnapshotRef.current;
    if (!snapshot) return;

    setValue(formParentKey, snapshot.value, {
      shouldDirty: snapshot.wasDirty,
      shouldTouch: snapshot.wasDirty,
      shouldValidate: snapshot.wasDirty,
    });
    greetingFormSnapshotRef.current = null;
  };

  return (
    <div className={`w-full ${customClass} overflow-y-auto`}>
      <div className="flex flex-col gap-4 p-4 rounded-xl bg-white border border-gray-200 ">
        <div className="w-full">
          {visibleMediaOptions.map(({ name, label, icon, iconClass, disabled }) => {
            const isEnabled = watchMedia?.[name]?.enabled ?? false;
            return (
              <div
                key={name}
                className={
                  acepeakTheme
                    ? `flex flex-col gap-2 w-full py-2.5 first:pt-0 last:pb-0 acepeak-greeting-row`
                    : 'flex flex-col gap-4 w-full py-2 first:pt-0 last:pb-0'
                }
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center flex-wrap gap-1">
                    <Icon
                      name={icon}
                      className={
                        acepeakTheme
                          ? `${iconClass} acepeak-greeting-icon${isEnabled ? ' is-active' : ''}`
                          : iconClass
                      }
                    />
                    <p className="text-gray-900 text-sm font-medium">
                      {acepeakTheme
                        ? (ACEPEAK_ROW_LABELS[name] ?? capitalizeFirstLetter(label))
                        : `Do you want to add "${capitalizeFirstLetter(label)} message" ?`}
                    </p>
                    {acepeakTheme && ACEPEAK_ROW_DESCRIPTIONS[name] && (
                      <span className="acepeak-greeting-row-desc">
                        {ACEPEAK_ROW_DESCRIPTIONS[name]}
                      </span>
                    )}
                  </div>

                  {name === 'waiting' ? null : (
                    <Switch
                      id={`switch-${name}`}
                      checked={isEnabled}
                      onCheckedChange={(checked) => onChangeMedia(name, checked)}
                      className={
                        acepeakTheme ? 'accounts-switch-compact cursor-pointer' : 'cursor-pointer'
                      }
                      disabled={disabled}
                    />
                  )}
                </div>
                {/* For every other caller this wrapper always renders (even
                    empty) to match its current, unchanged spacing. Only this
                    page skips it entirely while off, since an empty-but-
                    present flex child was reserving a full gap's worth of
                    vertical space for nothing. */}
                {(!acepeakTheme || isEnabled) && (
                  <div className="flex flex-col gap-2 w-1/2 template-greeting-control-wrap">
                    <div className="w-80 template-greeting-control">
                      {isEnabled && (
                        <>
                          <SelectGreeting
                            name={
                              name === 'voicemail'
                                ? 'voicemail'
                                : name === 'menu'
                                  ? 'prompt'
                                  : 'greeting'
                            }
                            isShowUpload={name !== 'ring_tone'}
                            onGreetingUploadStart={preserveGreetingForm}
                            onGreetingUploadSuccess={restoreGreetingForm}
                            onChangeMedia={(e) =>
                              setValue(`${formParentKey}.${name}.value`, e as ISELECTVALUE, {
                                shouldDirty: true,
                                shouldTouch: true,
                                shouldValidate: true,
                              })
                            }
                            options={optionsData[name]?.map((item: GreetingItem) => ({
                              label: item.name,
                              value: item.filename,
                              uuid: item.uuid,
                            }))}
                            value={watch(`${formParentKey}.${name}.value`) || null}
                            errors={
                              /* Turning the switch on makes this schema
                                 require a value, but the value field itself
                                 hasn't been touched yet at that point —
                                 without the dirty check this warning fired
                                 the instant the toggle went on, before the
                                 person had any chance to open the dropdown,
                                 reading as "empty is wrong" rather than
                                 "you cleared a required field". Only shown
                                 once the select itself has actually been
                                 interacted with. */
                              (dirtyFields as any)?.[formParentKey]?.[name]?.value &&
                              ((errors as any)?.[formParentKey]?.[name]?.value?.value?.message ||
                                (errors as any)?.[formParentKey]?.[name]?.value?.message)
                                ? `${label} is required`
                                : ''
                            }
                            menuPortalTarget={selectMenuPortalTarget}
                            selectMenuPortalTarget={selectMenuPortalTarget}
                          />
                        </>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default CommonGreetingNotification;
