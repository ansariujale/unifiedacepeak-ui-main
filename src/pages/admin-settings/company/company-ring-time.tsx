import { useEffect, useMemo, useState } from 'react';
import { SettingCard, SettingRow, type SettingStatus } from '@/components/mcm/setting-card';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowRight, Info, PhoneCall, Timer, Users } from 'lucide-react';

import Loader from '@/components/custom/loader';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { handleAlert } from '@/lib/utils';
import {
  COMPANY_DEFAULTS_QUERY_KEY,
  fetchCompanyDefaults,
  saveCompanyDefaults,
} from '@/lib/company-defaults';

/**
 * Company ring time
 * -----------------------------------------------------------------------------
 * How long a phone rings before the call gives up is one of the two numbers a
 * customer changes first, and until now there was nowhere to say it once for the
 * whole company. It could only be set in three unrelated places:
 *
 *   - per queue member, in Call Queue > Ring strategy ("Ring For")
 *   - per department, as "Member Ring Timeout (Sec)"
 *   - per device on one person's phone, in their Call rules > device options
 *
 * A new person gets whatever the code happens to default to. This page is the
 * missing top level: one number, written down once, in the same reserved
 * "Company Default" record the rest of Company info uses. It is namespaced under
 * `settings.company_ring_time` and the rest of that blob is spread through
 * untouched on save.
 *
 * ---------------------------------------------------------------------------
 * WHAT READS THIS, AS OF 29 AUGUST 2026
 * ---------------------------------------------------------------------------
 * This header used to say "nothing reads this value", and warned against
 * leaving a stale reassurance behind. That warning now applies to the header
 * itself: the key IS read, and `RING_TIME_STATUS` is 'active'.
 *
 * The reader is `seedDeviceRingTime` in src/lib/company-ring-time.ts, which
 * returns a stored per-device value if one exists and otherwise falls back to
 * this company number instead of a hardcoded constant. Three call sites use it:
 *
 *   - people/update-forwarding/index.tsx      (Call rules > device options)
 *   - phone-systems/call-queue/add-edit-call-queue/index.tsx
 *   - phone-systems/call-queue/.../ring-strategy/index.tsx
 *
 * So a device or queue member saved through the interface without its own ring
 * time now inherits what is set here. What this page still does NOT do is
 * change anything already saved with an explicit value — those were somebody's
 * decision and are kept, unclamped, by design (see seedDeviceRingTime).
 *
 * If that ever stops being true, change this note in the same commit. An admin
 * who believes they have shortened the ring and has not will read every missed
 * call as a fault somewhere else.
 */

const RING_TIME_KEY = 'company_ring_time';
const RING_TIME_SCHEMA_VERSION = 1;

/* Change this only if something outside this file stops reading the key. */
const RING_TIME_STATUS: SettingStatus = 'active';

/* the safe default ships 30 seconds. other established systems ships 12 and refuses anything above 60, so
   60 is the ceiling here too: offering 90 would let an admin save a number that
   the stricter of the two vendors would reject outright. */
const COMMON_DEFAULT_SECONDS = 30;
const CONTACT_CENTRE_SECONDS = 12;
const MIN_SECONDS = 5;
const MAX_SECONDS = 60;

/**
 * `RINGING_OPTIONS` from '@/constants/forwarding-consts' — the list the queue
 * ring-time control uses — is deliberately NOT reused. It holds exactly two
 * entries, 15 and 30 seconds, which cannot express the 5-60 range this page is
 * meant to cover: an admin who wants the usual 12 seconds, or the full 60, has
 * no option to pick. Its labels are borrowed instead, because they are the good
 * part: it counts rings as well as seconds, at five seconds a ring, and "about
 * 6 rings" is how a person actually experiences the wait.
 */
const SECONDS_PER_RING = 5;

const ringCount = (seconds: number) => Math.round(seconds / SECONDS_PER_RING);

/* Where the "what happens next" half of this question is answered. A real route
   from src/router/index.tsx — a number's call handling, including its Business
   Hours step, is edited from the numbers list. */
const NUMBERS_IN_USE_PATH = '/admin-settings/numbers/in-use';

interface RingTimeForm {
  seconds: string;
  apply_to_new_people: boolean;
}

const DEFAULT_FORM: RingTimeForm = {
  /* the usual 30, not the usual 12. Thirty seconds is what most people expect a
     desk phone to do, and it is the value the rest of this product already falls
     back to, so writing anything else down here would quietly disagree with the
     behaviour on every existing line. */
  seconds: String(COMMON_DEFAULT_SECONDS),
  apply_to_new_people: true,
};

const toSettingsObject = (rawSettings: any): Record<string, any> => {
  if (!rawSettings) return {};
  if (typeof rawSettings === 'string') {
    try {
      const parsed = JSON.parse(rawSettings);
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
      return {};
    }
  }
  return typeof rawSettings === 'object' ? rawSettings : {};
};

const toGreetingsObject = (rawGreetings: any): Record<string, any> =>
  toSettingsObject(rawGreetings);

/* A stored value outside 5-60, or one this list does not offer, is kept rather
   than silently rounded — showing it as-is is the only way an admin can see that
   it is there and choose to replace it. */
const toSecondsString = (stored: any): string => {
  const parsed = Number(stored);
  if (!Number.isFinite(parsed) || parsed <= 0) return DEFAULT_FORM.seconds;
  return String(Math.round(parsed));
};

const buildFormFromSettings = (settings: Record<string, any>): RingTimeForm => {
  const ringTime = settings?.[RING_TIME_KEY] || {};

  return {
    seconds: toSecondsString(ringTime?.seconds),
    apply_to_new_people:
      typeof ringTime?.apply_to_new_people === 'boolean'
        ? ringTime.apply_to_new_people
        : DEFAULT_FORM.apply_to_new_people,
  };
};

const buildRingTimePayload = (form: RingTimeForm) => ({
  version: RING_TIME_SCHEMA_VERSION,
  updated_at: new Date().toISOString(),
  seconds: Number(form.seconds),
  apply_to_new_people: form.apply_to_new_people,
});

const CompanyRingTime = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [form, setForm] = useState<RingTimeForm>(DEFAULT_FORM);
  const [isDraggingRing, setIsDraggingRing] = useState(false);

  const {
    data: companyDefaultTemplate = null,
    isLoading,
    isError,
  } = useQuery({
    queryKey: COMPANY_DEFAULTS_QUERY_KEY,
    queryFn: fetchCompanyDefaults,
  });

  const savedSettings = useMemo(
    () => toSettingsObject(companyDefaultTemplate?.settings),
    [companyDefaultTemplate],
  );

  const savedForm = useMemo(() => buildFormFromSettings(savedSettings), [savedSettings]);

  useEffect(() => {
    setForm(savedForm);
  }, [savedForm]);

  const isDirty = useMemo(
    () => JSON.stringify(form) !== JSON.stringify(savedForm),
    [form, savedForm],
  );

  const { mutate: saveRingTime, isPending: isSaving } = useMutation({
    mutationFn: saveCompanyDefaults,
    onSuccess: (response: any) => {
      handleAlert({
        text: response?.data?.message || 'Company ring time saved',
        type: 'success',
      });
      /* The whole company record is invalidated, not just this card. Policies,
         holidays, security and phone rules all read the same row, so a save here
         must make them re-read — otherwise the next card saves a merge built on
         a stale blob and silently drops what was just written. */
      queryClient.invalidateQueries({ queryKey: COMPANY_DEFAULTS_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: ['userTemplateList'] });
    },
  });

  const updateForm = (patch: Partial<RingTimeForm>) => setForm((prev) => ({ ...prev, ...patch }));

  const handleSave = () => {
    // Merge, never replace: the Company Default row also carries the rest of the
    // company defaults blob, and other screens write into it.
    const nextSettings = {
      ...savedSettings,
      [RING_TIME_KEY]: buildRingTimePayload(form),
    };

    saveRingTime({
      uuid: companyDefaultTemplate?.uuid,
      settings: nextSettings,
      greetings: toGreetingsObject(companyDefaultTemplate?.greetings),
    });
  };

  if (isLoading) {
    return (
      <div className="flex w-full items-center justify-center py-10">
        <Loader />
      </div>
    );
  }

  return (
    <section className="company-ring-time-page flex w-full flex-col bg-gray-200/15">
      <div className="flex items-center gap-1.5 px-4 pt-3">
        <p className="text-lg leading-none font-semibold text-gray-900">Ring time</p>
        <Tooltip>
          <TooltipTrigger asChild>
            <Info className="h-3.5 w-3.5 shrink-0 cursor-help text-gray-400" />
          </TooltipTrigger>
          <TooltipContent
            side="right"
            className="w-max max-w-[280px] [text-wrap:pretty] text-black"
            style={{
              background: '#fdf7f5',
              border: 'none',
              color: '#000',
              boxShadow: '0 6px 20px rgba(17,17,17,0.18)',
            }}
          >
            How long a phone rings before moving on — one setting for the whole company.
          </TooltipContent>
        </Tooltip>
      </div>

      <div className="px-3 pt-3 pb-3 sm:px-4">
        <div className="mx-auto flex w-full max-w-[1040px] flex-col gap-4">
          {isError && (
            <div className="rounded-xl border border-dashed border-gray-300 bg-white px-4 py-6 text-center">
              <p className="text-sm font-semibold text-gray-900">
                We could not load the saved ring time
              </p>
              <p className="text-xs text-gray-500">
                What you see below is the built-in default, not your saved value. Reload before you
                save, or you may overwrite a setting you cannot currently see.
              </p>
            </div>
          )}

          {!companyDefaultTemplate && !isError && (
            <div className="rounded-xl border border-dashed border-gray-300 bg-white px-4 py-4">
              <p className="text-sm font-semibold text-gray-900">No ring time saved yet</p>
              <p className="text-xs text-gray-500">
                Nothing has been set for your company yet. Choose what you want below and save.
              </p>
            </div>
          )}

          <SettingCard
            icon={<Timer className="h-5 w-5" />}
            title="Default ring time"
            description="How many seconds a phone rings before the call gives up and moves on."
            status={RING_TIME_STATUS}
            note="Active. Used as the starting point: somebody with no ring time of their own gets this one. People already set up keep the time they have."
          >
            {(() => {
              const seconds = Number(form.seconds) || Number(DEFAULT_FORM.seconds);
              const percent = ((seconds - MIN_SECONDS) / (MAX_SECONDS - MIN_SECONDS)) * 100;
              return (
                <div className="flex flex-col gap-2">
                  <p className="text-sm font-semibold text-gray-900">Ring Duration</p>
                  <div className="flex items-center gap-3">
                    <span className="shrink-0 text-xs text-gray-500">Ring for</span>
                    <div className="relative w-full max-w-[420px]">
                      {isDraggingRing && (
                        <div
                          className="absolute -top-6 -translate-x-1/2 rounded-md border border-gray-200 bg-white px-1.5 py-0.5 text-[11px] font-medium whitespace-nowrap text-gray-700 shadow-sm"
                          style={{ left: `${percent}%` }}
                        >
                          {seconds} seconds
                        </div>
                      )}
                      <input
                        type="range"
                        min={MIN_SECONDS}
                        max={MAX_SECONDS}
                        step={SECONDS_PER_RING}
                        value={seconds}
                        onPointerDown={() => setIsDraggingRing(true)}
                        onPointerUp={() => setIsDraggingRing(false)}
                        onChange={(event) => updateForm({ seconds: event.target.value })}
                        className="h-1 w-full cursor-pointer appearance-none rounded-full"
                        style={{
                          accentColor: '#f87171',
                          background: `linear-gradient(to right, #f87171 ${percent}%, #e5e7eb ${percent}%)`,
                        }}
                      />
                      <div className="flex justify-between text-[11px] text-gray-400">
                        <span>{MIN_SECONDS}s</span>
                        <span>{COMMON_DEFAULT_SECONDS}s</span>
                        <span>{MAX_SECONDS}s</span>
                      </div>
                    </div>
                  </div>
                  <p className="text-[11px] text-gray-500">
                    Set the ring time from {MIN_SECONDS} to {MAX_SECONDS} seconds. Rings are
                    approximately {SECONDS_PER_RING} seconds each, as a caller hears.
                  </p>
                </div>
              );
            })()}

            {/* Reference material for the curious, not something every admin
                needs read every time — two short cards rather than the wall
                of prose this used to be. */}
            <div className="mt-5 flex flex-col gap-2">
              <p className="text-sm font-semibold text-gray-900">Where these numbers come from</p>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="group flex items-start gap-2.5 rounded-lg border border-gray-300 bg-white p-3 shadow-[0_4px_12px_rgba(17,17,17,0.08),0_1px_3px_rgba(17,17,17,0.05)] transition-all duration-200 hover:border-primary/40 hover:shadow-[0_8px_22px_rgba(17,17,17,0.12),0_2px_6px_rgba(17,17,17,0.07)]">
                  <PhoneCall className="mt-0.5 h-4 w-4 shrink-0 text-gray-400 transition-colors group-hover:text-primary" />
                  <div>
                    <p className="text-sm font-semibold text-gray-900">Most Desk Phones</p>
                    <p className="text-xs text-gray-500">
                      {COMMON_DEFAULT_SECONDS} seconds — about {ringCount(COMMON_DEFAULT_SECONDS)}{' '}
                      rings. Also used as the product fallback default.
                    </p>
                  </div>
                </div>
                <div className="group flex items-start gap-2.5 rounded-lg border border-gray-300 bg-white p-3 shadow-[0_4px_12px_rgba(17,17,17,0.08),0_1px_3px_rgba(17,17,17,0.05)] transition-all duration-200 hover:border-primary/40 hover:shadow-[0_8px_22px_rgba(17,17,17,0.12),0_2px_6px_rgba(17,17,17,0.07)]">
                  <Users className="mt-0.5 h-4 w-4 shrink-0 text-gray-400 transition-colors group-hover:text-primary" />
                  <div>
                    <p className="text-sm font-semibold text-gray-900">Contact Centres</p>
                    <p className="text-xs text-gray-500">
                      Use about {CONTACT_CENTRE_SECONDS} seconds. A short ring moves unanswered
                      calls quickly.
                    </p>
                  </div>
                </div>
              </div>
              <p className="text-[11px] text-gray-500">
                Capped at {MAX_SECONDS}s — most callers hang up before a minute anyway.
              </p>
            </div>
          </SettingCard>

          <SettingCard
            icon={<Users className="h-5 w-5" />}
            title="Who it applies to"
            description="Whether people added after today start with this ring time."
            status={RING_TIME_STATUS}
            note="Active. Used when somebody is set up who has no ring time of their own."
          >
            <SettingRow
              label="Use this for people added from now on"
              description="People already set up keep their ring time either way. Off, this number is just recorded — not offered as a starting point."
              control={
                <Switch
                  checked={form.apply_to_new_people}
                  onCheckedChange={(checked) => updateForm({ apply_to_new_people: checked })}
                />
              }
            />
          </SettingCard>

          {/* The honest other half of the question. Ring time only decides when
              ringing stops; what happens next is a different setting, in a
              different place, and an admin who changes one and not the other
              gets silence at the end of the call. */}
          <div className="flex flex-wrap items-center gap-2 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-ucass-primary-200 text-primary">
              <PhoneCall className="h-4 w-4" />
            </div>
            <div className="min-w-[220px] flex-1">
              <p className="text-sm font-semibold text-gray-900">
                Ring time is only half the answer
              </p>
              <p className="text-xs text-gray-500">
                What happens next — voicemail, another person, a queue — is set per number, on its
                Business Hours step, not here.
              </p>
            </div>
            <Button
              type="button"
              variant="dark"
              className="shrink-0"
              onClick={() => navigate(NUMBERS_IN_USE_PATH)}
            >
              Check your numbers
              <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </div>

          <div className="flex flex-col gap-2 rounded-xl border border-gray-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-gray-500">
              Saved for your whole company. Your other settings are not affected.
            </p>
            <Button
              type="button"
              variant="dark"
              onClick={handleSave}
              disabled={isSaving || !isDirty}
            >
              {isSaving ? 'Saving...' : 'Save ring time'}
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
};

export default CompanyRingTime;
