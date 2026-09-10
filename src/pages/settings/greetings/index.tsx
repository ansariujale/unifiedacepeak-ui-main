// import Breadcrumb from '@/components/custom/breadcrumb';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { handleAlert } from '@/lib/utils';
import { invalidateGlobalUsersDirectory } from '@/lib/invalidate-global-users-directory';
import {
  FORWARDING_TAB_CONSTANT,
  greetingsInitialState,
} from '@/pages/admin-settings/constants';
import GreetingNotification from '@/pages/admin-settings/people/update-forwarding/greetings';
import { upsertUserSettingsSchema } from '@/pages/admin-settings/people/update-forwarding/schema';
import { getUserDetails, updateUserSettings } from '@/services/api';
import { yupResolver } from '@hookform/resolvers/yup';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Info } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { FormProvider, useForm } from 'react-hook-form';

type GreetingValue = {
  label?: string;
  value?: string;
};

type GreetingItem = {
  enabled?: boolean;
  value?: GreetingValue;
};

type GreetingsMap = Record<string, GreetingItem>;

type GreetingKey = 'welcome_greeting' | 'voicemail' | 'ring_tone' | 'on_hold_music';

interface GreetingField {
  enabled: boolean;
  override: boolean; // <-- you were missing this
  value: {
    label: string;
    value: string;
  };
}

type GreetingsForm = Record<GreetingKey, GreetingField>;

const Greetings = () => {
  // const breadcrumbData = [{ label: 'Settings' }, { label: 'Greetings' }];
  const [schemaContext, setSchemaContext] = useState<any>(null);
  const hasHydratedGreetingsRef = useRef(false);
  /* The dropdown menu portal target — kept as a real DOM descendant of this
     page's own .acepeak-greetings scope (rather than react-select's default
     document.body) so the --select-option-*-bg/-fg variables set below
     actually reach the portaled option elements. Same technique as My
     Phone's own selectPortalNode. */
  const [selectPortalNode, setSelectPortalNode] = useState<HTMLDivElement | null>(null);
  /* Briefly self-reveals on load, the same as the other Settings pages' own
     info tooltip, so the icon reads as interactive before anyone hovers it. */
  const [showHeaderHint, setShowHeaderHint] = useState(true);
  useEffect(() => {
    const timer = setTimeout(() => setShowHeaderHint(false), 700);
    return () => clearTimeout(timer);
  }, []);
  const methods = useForm({
    mode: 'all',
    defaultValues: { greetings: greetingsInitialState },
    resolver: yupResolver(upsertUserSettingsSchema[FORWARDING_TAB_CONSTANT.GREETING_NOTIFICATION]),
    context: { schemaContext },
  });
  const queryClient: any = useQueryClient();

  const { data: userInfoData } = useQuery({
    queryKey: ['getUserDetailsForGreetings'],
    queryFn: getUserDetails,
    select: (data) => data?.data?.data?.result,
  });

  const { handleSubmit, reset, watch } = methods;
  const { dirtyFields } = methods.formState;
  const { mutate: mutateGreetingSettings, isPending: PendingGreetingSetting } = useMutation({
    mutationFn: updateUserSettings,
    onSuccess: () => {
      handleAlert({
        text: 'Greeting Setting updated successfully!',
        type: 'success',
      });
      queryClient.invalidateQueries(['getUserDetailsForGreetings', 'getUsersDetails'], {
        exact: true,
      });
      invalidateGlobalUsersDirectory(queryClient);
    },
  });

  const onSubmit = () => {
    const greetings: any = watch('greetings');
    const greetingsRequest = {
      welcome: getGreetingConfig('welcome_greeting', greetings),
      voicemail: getGreetingConfig('voicemail', greetings),
      ring_tone: getGreetingConfig('ring_tone', greetings),
      hold: getGreetingConfig('on_hold_music', greetings),
    };

    const payload = {
      key: 'greetings',
      value: greetingsRequest,
    };
    mutateGreetingSettings(payload);
  };

  const getGreetingConfig = (
    key: string,
    greetings: GreetingsMap,
  ): { enabled?: boolean; label?: string; value?: string } => ({
    enabled: greetings?.[key]?.enabled,
    label: greetings?.[key]?.value?.label,
    value: greetings?.[key]?.value?.value,
  });

  useEffect(() => {
    if (!userInfoData || hasHydratedGreetingsRef.current) return;

    const greetingInfo =
      typeof userInfoData.greetings === 'string'
        ? JSON.parse(userInfoData.greetings)
        : (userInfoData.greetings ?? {});

    const keys: GreetingKey[] = ['welcome_greeting', 'voicemail', 'ring_tone', 'on_hold_music'];

    const formattedGreetings = keys.reduce<GreetingsForm>((acc, key) => {
      const apiKey =
        key === 'welcome_greeting' ? 'welcome' : key === 'on_hold_music' ? 'hold' : key;
      const target = greetingInfo?.[key] || greetingInfo?.[apiKey];
      acc[key] = {
        enabled: !!target?.enabled,
        override: !!target?.override,
        value: {
          label: target?.label ?? '',
          value: target?.value ?? '',
        },
      };
      return acc;
    }, {} as GreetingsForm);

    hasHydratedGreetingsRef.current = true;
    reset(
      { greetings: formattedGreetings },
      {
        keepDirtyValues: true,
      },
    );
  }, [dirtyFields, reset, userInfoData]);

  useEffect(() => {
    const subscription = watch((value) => {
      setSchemaContext(value);
    });
    return () => subscription.unsubscribe();
  }, [watch]);

  return (
    <>
      <section className="acepeak-greetings w-full bg-gray-200/15 flex flex-col overflow-x-auto overflow-y-hidden">
        {/* <Breadcrumb breadcrumbs={breadcrumbData} /> */}
        {/* The dropdown menu portal target — see the comment on
            selectPortalNode above. Zero-size and unstyled; it exists only
            as an attachment point. */}
        <div ref={setSelectPortalNode} />
        {/* Same brand tokens and fixes as the Profile / My Phone /
            Notifications pages' own style blocks — duplicated per-page
            rather than shared, since each page owns its scope. Kept
            identical on purpose so every Settings page reads as one
            system. */}
        <style>{`
          .acepeak-greetings {
            font-family: 'Inter', ui-sans-serif, system-ui, -apple-system, sans-serif;
            --ap-primary: #DC2626;
            --ap-primary-hover: #B91C1C;
            --ap-secondary: #EF4444;
            --ap-secondary-2: #F87171;
            --ap-soft-bg: #FEF2F2;
            /* Dropdown option colours, read by the shared react-select
               overrides in index.css (--select-option-*-bg/-fg) rather than
               fighting their !important-in-@layer-base rule directly — see
               the My Phone page's own style block for the full explanation.
               Matches My Phone's own scheme exactly: the selected option
               reads this page's red, hover stays a neutral grey so the two
               states remain visually distinct. */
            --select-option-active-bg: var(--ap-secondary-2);
            --select-option-active-fg: #000;
            --select-option-hover-bg: #E5E7EB;
            --select-option-hover-fg: #000;
            --select-control-border: #DC2626;
          }
          .acepeak-greetings .acepeak-page-title {
            font-family: 'Instrument Serif', serif;
            font-style: italic;
            font-weight: 400;
            font-size: 27px;
            line-height: 41px;
            color: #171717;
          }
          .acepeak-greetings [data-slot='button'] {
            border-radius: 9999px !important;
          }
          /* index.css's own .custom-react-select__option--is-selected rule
             is itself !important inside @layer base — an unlayered
             !important here (this page's usual technique) would still lose
             to it regardless of specificity, since a layered !important
             always outranks an unlayered one. Joining the same layer name
             puts this back on normal specificity terms, where the page
             scope here wins. Only the text colour changes; the pink
             background/weight that mark a selected row stay as they are
             everywhere else. */
          @layer base {
            .acepeak-greetings .custom-react-select__option--is-selected,
            .acepeak-greetings .custom-react-select__option--is-selected:hover,
            .acepeak-greetings .custom-react-select__option--is-selected.custom-react-select__option--is-focused {
              color: #171717 !important;
            }
          }
          /* Matches the Numbers page's own coral eyebrow (mcm-page.css's
             .ident-coral-theme .mcm-adminpage-eyebrow) without pulling in
             that whole theme class — reusing mcm-adminpage-eyebrow for its
             family/case/tracking, only the 4 properties that variant
             changes are restated here, scoped to this page. */
          .acepeak-greetings .mcm-adminpage-eyebrow {
            font-size: 12px;
            font-weight: 800;
            line-height: 18px;
            color: #DC2626;
          }
          .acepeak-tooltip-content {
            background: #fdf7f5 !important;
            color: #000 !important;
            border: none !important;
            width: 395px !important;
            white-space: normal !important;
            text-wrap: normal !important;
            line-height: 1.5 !important;
            box-shadow: 0 6px 20px rgba(17, 17, 17, 0.18) !important;
          }
          .acepeak-tooltip-content svg {
            fill: #fdf7f5 !important;
          }
          .acepeak-greetings .acepeak-info-trigger:hover {
            color: var(--ap-primary);
          }
          .acepeak-greetings .mcm-fsec-t {
            font-size: 16px;
          }
          .acepeak-greetings [data-slot='button'][type='submit'] {
            background: #171717 !important;
            border-color: #171717 !important;
            color: #fff !important;
          }
          .acepeak-greetings [data-slot='button'][type='submit']:hover {
            background: #1a1a1a !important;
            border-color: #1a1a1a !important;
          }
          /* The toggle rides the app-wide --primary token by default, which
             is only this page's red for tenants configured that way —
             hardcoded here, the same as My Phone/Notifications, so it never
             depends on that resolving some other way (e.g. blue). */
          .acepeak-greetings [data-slot='switch'][data-state='checked'] {
            background-color: #DC2626 !important;
            border-color: #DC2626 !important;
          }
          .acepeak-greetings [data-slot='switch'][data-state='unchecked'] {
            background-color: #E5E7EB !important;
            border-color: #E5E7EB !important;
          }
          .acepeak-greetings .rounded-xl.border-gray-200 {
            border-color: #E5E7EB !important;
            box-shadow: none !important;
            /* Margin (not padding) so this added space stays outside the
               card's own white background — it reads as gray page
               background, just a little less of it than before, rather
               than growing the visible white card. */
            margin-bottom: 64px;
            max-width: calc(100% - 64px);
            margin-left: auto;
            margin-right: auto;
          }
          /* Compact row divider — only added when CommonGreetingNotification
             is rendered with acepeakTheme, so every other caller of that
             shared component keeps its current spacing untouched. */
          .acepeak-greetings .acepeak-greeting-row {
            border-bottom: 1px solid #E5E7EB;
          }
          .acepeak-greetings .acepeak-greeting-row:last-child {
            border-bottom: none;
          }
          /* Neutral by default, this page's red only while that media type
             is switched on — replacing the shared component's own
             per-item text-primary/orange-500/green-500/purple-500 classes,
             which only this page (acepeakTheme) opts out of. */
          .acepeak-greetings .acepeak-greeting-icon {
            color: #4B5563 !important;
          }
          .acepeak-greetings .acepeak-greeting-icon.is-active {
            color: #DC2626 !important;
          }
          /* Helper text beside each row's title, matching the Media
             section's own description ("The audio callers hear...") font
             size/weight/colour exactly — same values as mcm-page.css's
             .mcm-fsec-d, minus that rule's own margin-top, which was
             meant for a description stacked on its own line below a
             title rather than sitting inline beside one on the same
             line. Font family is already Inter from this page's own root
             rule above. */
          .acepeak-greetings .acepeak-greeting-row-desc {
            font-size: 12px;
            font-weight: 500;
            color: var(--ink-3);
            line-height: 1.45;
            /* Extra space before the description only — the icon-to-title
               gap is the row's own flex "gap-1" (4px), shared by every
               child in that row; adding margin here instead of raising
               that shared gap keeps the icon/title spacing untouched. */
            margin-left: 12px;
          }
          /* The play/upload icon buttons next to each dropdown — the shared
             Button's own "outline" variant rides the app-wide --primary
             token (border + text), reading as this tenant's default blue
             rather than a plain secondary action. Restyled to the same
             neutral bordered-chip treatment as this page's other secondary
             buttons (Edit/Cancel-style), still just an icon inside. */
          .acepeak-greetings .template-greeting-control [data-slot='button'] {
            background: #fff !important;
            border: 1px solid #E5E7EB !important;
            border-radius: 9999px !important;
            color: #374151 !important;
          }
          .acepeak-greetings .template-greeting-control [data-slot='button']:hover {
            background: #F9FAFB !important;
            border-color: #D1D5DB !important;
            color: #171717 !important;
          }
          /* Shared react-select control's height (2.5rem) is set inside
             index.css's @layer base with !important. Cascade layers
             outrank specificity for !important declarations — an unlayered
             !important here, even with a more specific selector, loses to
             that layered one. Re-declaring inside the same base layer
             lets normal specificity decide instead, scoped to this page. */
          @layer base {
            .acepeak-greetings .custom-react-select__control {
              height: 36px !important;
              min-height: 36px !important;
            }
          }
          /* The "Upload File" drawer — rendered inline (not portaled), so it
             stays a real DOM descendant of .acepeak-greetings and can be
             scoped the same way as everything else here, no prop threading
             through SelectGreeting/SideDrawer/AddGreeting needed. #drawer-
             example is SideDrawer's own fixed id; scoping it under
             .acepeak-greetings means this only ever matches the one opened
             from this page, never another page's drawer elsewhere in the
             app. */
          /* SideDrawer's own default is a full-height panel pinned to the
             right edge (its base classes and an inline width style both
             fight for that). Everything below is !important specifically
             to win over that inline style, per the same technique used
             elsewhere on this page — repositions/resizes it into a small
             centered modal instead, without touching SideDrawer itself
             (still mount/unmount driven by SelectGreeting exactly as
             before, so open/close behaviour is unchanged). */
          .acepeak-greetings #drawer-example {
            top: 50% !important;
            left: 50% !important;
            right: auto !important;
            transform: translate(-50%, -50%) !important;
            height: auto !important;
            max-height: 85vh !important;
            width: min(520px, 92vw) !important;
            min-width: 0 !important;
            border-radius: 16px !important;
            border: 1px solid #E5E7EB !important;
            box-shadow: 0 24px 60px -12px rgba(17, 17, 17, 0.28) !important;
          }
          .acepeak-greetings #drawer-example .min-h-11 {
            border-bottom: 1px solid #E5E7EB !important;
            padding-top: 14px !important;
            padding-bottom: 12px !important;
            margin-bottom: 2px !important;
          }
          /* SideDrawer's own content wrapper drops to overflow: hidden at
             the md breakpoint — correct for its original full-height,
             right-edge panel, but this page turns it into a small,
             height-capped centered modal instead, where the Text to
             Speech tab's fields can be taller than that cap. Overriding
             just overflow-y still leaves overflow-x hidden from that same
             rule, which clips a sliver off any field's border sitting
             flush against that edge (e.g. the textarea's left/right focus
             border). visible here computes to auto in practice (the spec
             upgrades "visible" to "auto" on this axis once the other axis
             actually scrolls), so nothing gets an unwanted horizontal
             scrollbar. */
          .acepeak-greetings #drawer-example > .overflow-auto {
            overflow-y: auto !important;
            overflow-x: visible !important;
          }
          /* The Text to Speech textarea stretches to fill this row
             exactly, so its own border sits flush against the row's edge
             with no room to render fully. A few px narrower leaves the
             border itself space to sit fully inside. */
          .acepeak-greetings #drawer-example textarea {
            width: calc(100% - 6px) !important;
            margin: 0 auto !important;
          }
          .acepeak-greetings #drawer-example #drawer-label {
            font-size: 17px !important;
            font-weight: 700 !important;
            color: #171717 !important;
          }
          .acepeak-greetings #drawer-example [data-slot='tabs-trigger'] {
            font-weight: 600 !important;
          }
          .acepeak-greetings #drawer-example [data-slot='tabs-trigger'][data-state='active'] {
            color: #DC2626 !important;
            border-bottom-color: #DC2626 !important;
          }
          /* The drop zone — a plain white dashed box by default; a light
             red wash and matching border make it read as this page's own
             upload target rather than a generic file input. */
          .acepeak-greetings #drawer-example label[for='file-upload'] {
            background: #FEF2F2 !important;
            border-color: #FCA5A5 !important;
            border-radius: 14px !important;
            height: 128px !important;
          }
          .acepeak-greetings #drawer-example label[for='file-upload']:hover {
            border-color: #DC2626 !important;
          }
          .acepeak-greetings #drawer-example label[for='file-upload'] svg {
            color: #DC2626 !important;
          }
          .acepeak-greetings #drawer-example [data-slot='input'] {
            border-color: #E5E7EB !important;
            border-radius: 10px !important;
          }
          .acepeak-greetings #drawer-example [data-slot='input']:focus {
            border-color: #DC2626 !important;
            outline: none !important;
          }
          /* Cancel (first) / Upload (second) — the shared Button's own
             "transparent" and "outline" variants read as this tenant's
             default palette; restyled to a plain neutral Cancel and a
             solid black primary Upload, matching this page's own Submit
             button treatment above. */
          .acepeak-greetings #drawer-example .justify-end.pt-4.mt-auto [data-slot='button'] {
            border-radius: 9999px !important;
          }
          .acepeak-greetings #drawer-example .justify-end.pt-4.mt-auto [data-slot='button']:first-child {
            background: #fff !important;
            border: 1px solid #6B7280 !important;
            color: #171717 !important;
          }
          .acepeak-greetings #drawer-example .justify-end.pt-4.mt-auto [data-slot='button']:first-child:hover {
            background: #F9FAFB !important;
            border-color: #4B5563 !important;
          }
          /* Upload's own disabled state (opacity-50 from the shared Button
             component) was reading as "broken/grey", not "not ready yet" —
             forced back to full black/white regardless of disabled state,
             per this page's own request. Still genuinely disabled/inert
             when the underlying condition isn't met (click does nothing),
             just no longer faded. */
          .acepeak-greetings #drawer-example .justify-end.pt-4.mt-auto [data-slot='button']:last-child {
            opacity: 1 !important;
            background: #171717 !important;
            border-color: #171717 !important;
            color: #fff !important;
          }
          .acepeak-greetings #drawer-example .justify-end.pt-4.mt-auto [data-slot='button']:last-child:hover {
            background: #1a1a1a !important;
            border-color: #1a1a1a !important;
          }
          /* Accounts-only compact toggle (38x22, red, white knob, no
             overflow). Opt-in via .accounts-switch-compact, passed down
             from common-greetings/index.tsx only when acepeakTheme is true
             (i.e. only on this page) — the shared Switch component and
             every other caller of CommonGreetingNotification (campaigns,
             call queues, IVR menus, admin per-user forwarding) are
             untouched, so a future main-branch change to the default
             Switch has nothing here to collide with. !important is enough
             to win: the component's own classes (and mcm-page.css's
             [data-slot='switch'] rules) are plain, non-!important
             utilities, so this beats them regardless of source order.
             Kept identical to the same rule on Notifications/Preferences/
             My Phone on purpose so all four read as one system. */
          .acepeak-greetings .accounts-switch-compact {
            position: relative !important;
            display: inline-block !important;
            width: 38px !important;
            height: 22px !important;
            min-width: 38px !important;
            border-width: 0 !important;
            border-radius: 9999px !important;
            overflow: hidden !important;
            padding: 0 !important;
          }
          .acepeak-greetings .accounts-switch-compact[data-state='checked'] {
            background-color: #dc2626 !important;
          }
          .acepeak-greetings .accounts-switch-compact[data-state='unchecked'] {
            background-color: #d1d5db !important;
          }
          .acepeak-greetings .accounts-switch-compact:disabled {
            opacity: 0.5 !important;
            cursor: not-allowed !important;
          }
          .acepeak-greetings .accounts-switch-compact [data-slot='switch-thumb'] {
            position: absolute !important;
            top: 50% !important;
            left: 2px !important;
            width: 18px !important;
            height: 18px !important;
            border-radius: 50% !important;
            transform: translateY(-50%) !important;
            translate: none !important;
            background-color: #fff !important;
            box-shadow: 0 1px 2px rgba(13, 21, 38, 0.25) !important;
            transition: left 0.15s ease !important;
          }
          .acepeak-greetings .accounts-switch-compact[data-state='checked'] [data-slot='switch-thumb'] {
            /* Anchored from the right edge with the same 2px inset the
               unchecked state uses from the left, so both states are
               inset by construction — no track/thumb arithmetic to keep
               in sync if either size ever changes. */
            left: auto !important;
            right: 2px !important;
            transform: translateY(-50%) !important;
            translate: none !important;
          }
        `}</style>
        <div className="flex shrink-0 items-center justify-between gap-2 px-4 py-3 border-b border-gray-200 bg-white">
          <div className="flex flex-col gap-0.5">
            <p className="mcm-adminpage-eyebrow">My Account</p>
            <div className="flex items-center gap-1.5">
              <p className="acepeak-page-title text-gray-900 font-semibold text-lg">Greetings</p>
              <Tooltip open={showHeaderHint || undefined}>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    className="acepeak-info-trigger inline-flex h-4 w-4 items-center justify-center rounded-full text-gray-400"
                    aria-label="About this page"
                  >
                    <Info className="h-3.5 w-3.5" />
                  </button>
                </TooltipTrigger>
                <TooltipContent className="acepeak-tooltip-content" side="right" align="center" textWrap="pretty">
                  The recordings callers hear on your extension — welcome message, hold music and
                  voicemail.
                </TooltipContent>
              </Tooltip>
            </div>
          </div>
        </div>
        <div className=" p-4 gap-4 flex flex-col h-full">
          <FormProvider {...methods}>
            <form
              onSubmit={handleSubmit(onSubmit)}
              className="w-full h-full flex flex-col gap-3 justify-between"
            >
              <GreetingNotification
                customClass="max-h-[calc(100vh_-_13rem)]"
                selectMenuPortalTarget={selectPortalNode}
                acepeakTheme
              />
              <div className="flex justify-end">
                <Button variant={'primary'} type="submit" disabled={PendingGreetingSetting}>
                  {PendingGreetingSetting ? 'Please wait...' : 'Submit'}
                </Button>
              </div>
            </form>
          </FormProvider>
        </div>
      </section>
    </>
  );
};

export default Greetings;
