// import Breadcrumb from '@/components/custom/breadcrumb';
import CommonSettingPermission from '@/components/common-settings';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { POLICY_FIELDS, useCompanyPolicy, type PolicyField } from '@/lib/company-policy';
import { getHolidaysFormVal, getHolidaysPayload, handleAlert } from '@/lib/utils';
import { invalidateGlobalUsersDirectory } from '@/lib/invalidate-global-users-directory';
import { CUSTOM_HOURS_SCHEDULE_OPTIONS } from '@/pages/admin-settings/numbers/set-number-forwarding/constants';
import {
  FORWARDING_TAB_CONSTANT,
  settingsInitialState,
} from '@/pages/admin-settings/constants';
import { upsertUserSettingsSchema } from '@/pages/admin-settings/people/update-forwarding/schema';
import { getUserDetails, updateUserSettings } from '@/services/api';
import { yupResolver } from '@hookform/resolvers/yup';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Info } from 'lucide-react';
import { FC, useEffect, useState } from 'react';
import { FormProvider, useForm } from 'react-hook-form';

interface GeneralProps {
  heading?: string;
}

export const General: FC<GeneralProps> = ({ heading = 'General' }) => {
  // const breadcrumbData = [{ label: 'Settings' }, { label: 'General' }];
  const queryClient: any = useQueryClient();
  const [schemaContext, setSchemaContext] = useState<any>(null);
  /* react-select portals its open dropdown menu to document.body by
     default — outside this page's own DOM subtree, so page-scoped CSS
     (ancestor selectors) can never reach it. Giving it this node as its
     portal target instead keeps it a real descendant of the page. Same
     technique already used by My Phone's own selectPortalNode. */
  const [selectPortalNode, setSelectPortalNode] = useState<HTMLDivElement | null>(null);
  /* Briefly self-reveals on load, the same as the other My Account pages'
     own info tooltip, so the icon reads as interactive before anyone
     hovers it. */
  const [showHeaderHint, setShowHeaderHint] = useState(true);
  useEffect(() => {
    const timer = setTimeout(() => setShowHeaderHint(false), 700);
    return () => clearTimeout(timer);
  }, []);

  /* The same company rule the editor below reads, read once more here so the
     validation agrees with what is on screen. A setting the company has locked is
     greyed out, so requiring a value in it would leave this form permanently
     unsubmittable with an error pointing at a control the person cannot open.
     The query is shared with the editor, so this costs no extra request. */
  const companyPolicy = useCompanyPolicy({ enabled: true });
  const lockedFields = (Object.keys(POLICY_FIELDS) as PolicyField[]).filter(
    (field) => !companyPolicy.allows(field),
  );

  const methods = useForm({
    mode: 'all',
    defaultValues: { settings: settingsInitialState },
    resolver: yupResolver(upsertUserSettingsSchema[FORWARDING_TAB_CONSTANT.SETTING_PERMISSIONS]),
    context: {
      activeTab: FORWARDING_TAB_CONSTANT.SETTING_PERMISSIONS,
      schemaContext,
      lockedFields,
    },
  });

  const { handleSubmit, setValue, watch } = methods;

  useEffect(() => {
    const subscription = watch((value) => {
      setSchemaContext(value);
    });
    return () => subscription.unsubscribe();
  }, [watch]);

  const { data: userInfoData } = useQuery<any>({
    queryKey: ['getUserDetailsQueryFn'],
    queryFn: getUserDetails,
    select: (data) => data?.data?.data?.result,
  });

  const { mutate: mutateGeneralSettings, isPending: PendingGeneralSettings } = useMutation({
    mutationFn: updateUserSettings,
    onSuccess: () => {
      handleAlert({
        text: 'General Settings updated successfully!',
        type: 'success',
      });
      queryClient.invalidateQueries(['getUsersDetails', 'getUserDetailsQueryFn'], {
        exact: true,
      });
      invalidateGlobalUsersDirectory(queryClient);
    },
  });

  const onSubmit = () => {
    const {
      display_number: { masking = {}, incoming = {}, show_number_if_blocked = 'NO' } = {},
      operational_hours = {},
      ...restSettings
    }: any = watch('settings');
    const tempSettings = {
      ...restSettings,
      display_number: {
        incoming,
        masking: {
          type: masking?.type?.value,
          label: masking?.type?.label,
          value: masking?.value,
        },
        show_number_if_blocked,
      },

      operational_hours: {
        type: operational_hours?.type,
        value: operational_hours?.value || CUSTOM_HOURS_SCHEDULE_OPTIONS,
        holidays: operational_hours?.holidays?.length
          ? getHolidaysPayload(operational_hours.holidays)
          : [],
        regional: {
          country: operational_hours?.regional?.country,
          timezone: operational_hours?.regional?.timezone,
          time_format: operational_hours?.regional?.time_format,
          country_code: operational_hours?.regional?.country_code,
        },
        closed_hour_action: {
          type: operational_hours?.closed_hour_action?.type?.value,
          value: operational_hours?.closed_hour_action?.value?.value,
          enabled: operational_hours?.closed_hour_action?.enabled,
          personal: operational_hours?.closed_hour_action?.personal,
          type_label: operational_hours?.closed_hour_action?.type?.label,
          value_label: operational_hours?.closed_hour_action?.value?.label,
        },
      },
    };

    const payload = {
      key: 'settings',
      value: removeOverride(tempSettings),
    };
    mutateGeneralSettings(payload);
  };

  /* Company rule flags describe what the company does to a person; they are not
     part of that person's own settings. `override` was already stripped for that
     reason, and `apply`/`locked` are the same flag split in two, so all three go.
     Left in, this page would save the company's rule back onto the individual
     record, and the lock would then be read from the wrong level. */
  const RULE_FLAG_KEYS = ['override', 'apply', 'locked'];

  function removeOverride<T>(obj: T): T {
    if (Array.isArray(obj)) {
      return obj.map(removeOverride) as unknown as T;
    } else if (typeof obj === 'object' && obj !== null) {
      return Object.fromEntries(
        Object.entries(obj)
          .filter(([key]) => !RULE_FLAG_KEYS.includes(key))
          .map(([key, value]) => [key, removeOverride(value)]),
      ) as unknown as T;
    }
    return obj;
  }

  useEffect(() => {
    if (userInfoData) {
      const settingInfo: any =
        typeof userInfoData?.settings === 'string'
          ? JSON.parse(userInfoData?.settings)
          : userInfoData?.settings;
      setValue(
        'settings.operational_hours.regional.timezone',
        settingInfo?.operational_hours?.regional?.timezone || {},
      );
      setValue(
        'settings.operational_hours.regional.country_code',
        settingInfo?.operational_hours?.regional?.country_code || {},
      );
      setValue(
        'settings.operational_hours.regional.time_format',
        settingInfo?.operational_hours?.regional?.time_format || 12,
      );
      setValue(
        'settings.operational_hours.regional.country',
        settingInfo?.operational_hours?.regional?.country || {},
      );
      setValue('settings.recording', settingInfo?.recording || {});

      setValue('settings.operational_hours.type', settingInfo?.operational_hours?.type || '');
      setValue('settings.operational_hours.value', settingInfo?.operational_hours?.value || {});

      const holidays =
        settingInfo?.operational_hours?.holidays && settingInfo?.operational_hours?.holidays?.length
          ? getHolidaysFormVal(settingInfo?.operational_hours?.holidays)
          : [];

      setValue('settings.operational_hours.holidays', holidays);

      setValue('settings.operational_hours.closed_hour_action', {
        type: {
          label: settingInfo?.operational_hours?.closed_hour_action?.type_label || '',
          value: settingInfo?.operational_hours?.closed_hour_action?.type || '',
        },
        value: {
          label: settingInfo?.operational_hours?.closed_hour_action?.value_label || '',
          value: settingInfo?.operational_hours?.closed_hour_action?.value || '',
        },
        enabled: settingInfo?.operational_hours?.closed_hour_action?.enabled,
        personal: settingInfo?.operational_hours?.closed_hour_action?.personal,
      });

      setValue('settings.role', settingInfo?.role || { label: '', value: '' });
      setValue('settings.group', settingInfo?.group || { label: '', value: '' });

      setValue('settings.voicemail_pin.value', settingInfo?.voicemail_pin?.value || '');
      setValue('settings.voicemail_pin.users', settingInfo?.voicemail_pin?.users || []);
      setValue(
        'settings.voicemail_pin.voicemail_to_text',
        settingInfo?.voicemail_pin?.voicemail_to_text || 'NO',
      );

      setValue('settings.display_number.incoming', settingInfo?.display_number?.incoming || {});
      setValue('settings.display_number.masking', settingInfo?.display_number?.masking || {});
      setValue(
        'settings.display_number.show_number_if_blocked',
        settingInfo?.display_number?.show_number_if_blocked || 'NO',
      );
      setValue('settings.display_number.masking.type', {
        label: settingInfo?.display_number?.masking?.label || '',
        value: settingInfo?.display_number?.masking?.type || '',
      });
      setValue('settings.transcription', settingInfo?.transcription || false);
      setValue('settings.ai_call_monitoring', settingInfo?.ai_call_monitoring || false);
    }
  }, [userInfoData]);

  return (
    <>
      <section className="acepeak-preferences w-full h-full min-h-0 flex flex-col overflow-hidden bg-gray-200/15">
        {/* The dropdown menu portal target — see the comment on
            selectPortalNode above. Zero-size and unstyled; it exists only
            as an attachment point. */}
        <div ref={setSelectPortalNode} />
        {/* <Breadcrumb breadcrumbs={breadcrumbData} /> */}
        {/* Same brand tokens and header/tooltip/card conventions as the
            Profile / My Phone / Notifications / Greetings pages' own style
            blocks — duplicated per-page rather than shared, since each page
            owns its scope. Kept identical on purpose so every Settings page
            reads as one system. Nothing here touches the shared
            CommonSettingPermission component or its modals — only this
            page's own header markup and CSS reaching into their rendered
            output. */}
        <style>{`
          .acepeak-preferences {
            font-family: 'Inter', ui-sans-serif, system-ui, -apple-system, sans-serif;
            --ap-primary: #DC2626;
            --ap-primary-hover: #B91C1C;
          }
          /* More specific than the page-wide rule above, so the heading
             keeps its own serif italic instead of inheriting Inter. */
          .acepeak-preferences .acepeak-page-title {
            font-family: 'Instrument Serif', serif;
            font-style: italic;
            font-weight: 400;
            font-size: 27px;
            line-height: 41px;
            color: #171717;
          }
          .acepeak-preferences [data-slot='button'] {
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
            .acepeak-preferences .custom-react-select__option--is-selected,
            .acepeak-preferences .custom-react-select__option--is-selected:hover,
            .acepeak-preferences .custom-react-select__option--is-selected.custom-react-select__option--is-focused {
              color: #171717 !important;
            }
          }
          /* Matches the Numbers page's own coral eyebrow (mcm-page.css's
             .ident-coral-theme .mcm-adminpage-eyebrow) without pulling in
             that whole theme class — reusing mcm-adminpage-eyebrow for its
             family/case/tracking, only the 4 properties that variant
             changes are restated here, scoped to this page. */
          .acepeak-preferences .mcm-adminpage-eyebrow {
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
          .acepeak-preferences .acepeak-info-trigger:hover {
            color: var(--ap-primary);
          }
          /* Card hierarchy — the shared component renders every row (Regional
             Settings, Business Hours, Recording, Transcription, AI
             Monitoring) as its own separate bordered/shadowed box. On this
             page they're merged into two visually seamless cards —
             Regional (rows 1-2, a fixed pair since Role/Voicemail are both
             off here) and Calling (row 3 through the last row — reliably
             the end of the list now that Display Number no longer renders
             on this page at all) — by stripping each row's own corners/
             shadow and re-adding a border only where a group's own outer
             edge actually is, with a plain divider line between rows
             inside the same group. No markup change, purely CSS. */
          .acepeak-preferences .grid.grid-cols-1.gap-3 {
            gap: 0;
          }
          /* Real "Regional" / "Calling" headers (icon + title + description
             on one line) — actual <header> elements rendered by the shared
             component itself now (gated on isOwnSettingsPage, see
             common-settings/index.tsx), sitting as real siblings of the
             card rows inside this same grid, rather than something this
             page tries to position over them from outside. That's what
             makes this genuinely natural flow: the margins below are
             normal spacing between real adjacent siblings, not a pixel
             offset guessed against another element's assumed height, so
             there's nothing here to drift if a row ever renders taller or
             shorter than expected. <header>, not <div>, on purpose — every
             ":nth-of-type" rule below (used instead of ":nth-child" for
             exactly this reason) counts position only among <div>
             siblings, so these headers don't shift that counting despite
             sitting in the same list as the cards. */
          .acepeak-preferences .acepeak-section-header {
            display: flex;
            align-items: center;
            gap: 8px;
            margin-bottom: 8px;
          }
          .acepeak-preferences .acepeak-section-header--calling {
            /* No margin-top of its own — the 16px gap above it comes
               entirely from the Regional card's own margin-bottom
               (further down). Previously this added a further 24px on
               top of that (40px total), which read as too large a gap
               between the Regional card and the Calling heading.
               Deliberately NOT touching this header's own margin-bottom
               (right below), which is the separate, unrelated spacing
               between this heading and its own Calling card. */
            margin-top: 0;
          }
          .acepeak-preferences .acepeak-section-header-title {
            font-weight: 600;
            font-size: 15px;
            color: #171717;
          }
          .acepeak-preferences .acepeak-section-header-desc {
            font-size: 12px;
            color: #9CA3AF;
          }
          .acepeak-preferences .grid.grid-cols-1.gap-3 > div.rounded-xl {
            border-radius: 0 !important;
            box-shadow: none !important;
            border-top: none !important;
            border-bottom: 1px solid #E5E7EB !important;
            border-left-color: #E5E7EB !important;
            border-right-color: #E5E7EB !important;
            position: relative;
            /* The row's label/description and its Select button or Switch
               were top-aligned by the shared component's own flex default
               — barely visible on a single-line row, obvious wherever the
               description text wraps to two lines. Centering them relative
               to each other is a pure alignment fix, no markup involved. */
            align-items: center !important;
          }
          /* Top of the Regional group (row 1) and top of the Calling group
             (row 3) each get the group's own top border and rounded top
             corners. Row 3 only exists when a Calling row is actually
             present, so this rule simply doesn't match otherwise.
             ":nth-of-type" rather than ":nth-child" throughout this card
             list — the Regional/Calling <header> elements are real
             siblings in this same list now, and nth-of-type counts
             position only among same-tag (<div>) siblings, so the header
             elements don't shift row 1/2/3's numbering. */
          .acepeak-preferences .grid.grid-cols-1.gap-3 > div.rounded-xl:nth-of-type(1),
          .acepeak-preferences .grid.grid-cols-1.gap-3 > div.rounded-xl:nth-of-type(3) {
            border-top: 1px solid #E5E7EB !important;
            border-top-left-radius: 12px !important;
            border-top-right-radius: 12px !important;
          }
          /* Bottom of the Regional group (always exactly row 2) and bottom
             of the Calling group (always the last row, since Display
             Number is gone from this page) get rounded bottom corners. If
             a single Calling row happens to be both row 3 and the last
             row, it correctly picks up top rounding above and bottom
             rounding here, forming one complete standalone box. */
          .acepeak-preferences .grid.grid-cols-1.gap-3 > div.rounded-xl:nth-of-type(2) {
            border-bottom-left-radius: 12px !important;
            border-bottom-right-radius: 12px !important;
            margin-bottom: 16px;
          }
          .acepeak-preferences .grid.grid-cols-1.gap-3 > div.rounded-xl:last-child {
            border-bottom-left-radius: 12px !important;
            border-bottom-right-radius: 12px !important;
          }
          /* Regional Settings (row 1) and Business Hours (row 2) each
             render a "Set by your company, so you cannot change it here."
             note of their own (CompanyLockNote, shown only when that field
             is actually company-locked) — now said once in the Regional
             header above instead, so it's redundant here. Targeted as the
             2nd <p> in each row's own text stack (title is a separate
             <div>, not a <p>, in these two rows) rather than :last-child,
             so this only ever hits the lock note itself — never the
             "Europe/Bucharest, Romania" / "24 Hours, all times" value
             line, which stays the 1st <p> whether or not a lock note is
             present. */
          .acepeak-preferences .grid.grid-cols-1.gap-3 > div.rounded-xl:nth-of-type(1) p:nth-of-type(2),
          .acepeak-preferences .grid.grid-cols-1.gap-3 > div.rounded-xl:nth-of-type(2) p:nth-of-type(2) {
            display: none;
          }
          /* Regional Settings / Business Hours: title and value sit on
             their own stacked lines by default (the shared component's
             own flex-col wrapper around them) — put on one line instead,
             shortening these two rows so the Calling heading and card
             below them (real, in-flow siblings now) naturally move up
             with no separate spacing to adjust. */
          .acepeak-preferences .grid.grid-cols-1.gap-3 > div.rounded-xl:nth-of-type(1) > .flex.flex-col.gap-1\\.5,
          .acepeak-preferences .grid.grid-cols-1.gap-3 > div.rounded-xl:nth-of-type(2) > .flex.flex-col.gap-1\\.5 {
            flex-direction: row;
            align-items: baseline;
            gap: 8px;
          }
          /* Now that label + value sit on one line, the row's own p-4
             (16px on every side) leaves noticeably more empty space above
             and below that single line than a two-line stacked row
             needed. Trimming just the vertical padding — horizontal stays
             untouched — makes each row's own height match its content
             instead of the old two-line assumption. */
          .acepeak-preferences .grid.grid-cols-1.gap-3 > div.rounded-xl:nth-of-type(1),
          .acepeak-preferences .grid.grid-cols-1.gap-3 > div.rounded-xl:nth-of-type(2) {
            padding-top: 10px !important;
            padding-bottom: 10px !important;
          }
          /* Regional card text, 14px -> 13px only (the section header's
             own title is excluded — it's 15px, set above, alongside
             Calling's and Display Number's titles). Nothing here is 14px
             via an explicit Tailwind class — "Regional Settings" uses
             "text-md", which isn't a real Tailwind size (so it does
             nothing) and falls back to the 14px this whole page inherits
             from the shared .mcm-page layout wrapper further up the
             tree; the value line's "text-sm" (0.875rem) happens to equal
             that same 14px. Both are targeted explicitly rather than a
             blanket "all text in this card" rule, so the 12px lock note
             (already hidden above) and the 12px header description stay
             exactly 12px, untouched, if either is ever re-shown. */
          .acepeak-preferences .grid.grid-cols-1.gap-3 > div.rounded-xl:nth-of-type(1) .flex.items-center.gap-1 p,
          .acepeak-preferences .grid.grid-cols-1.gap-3 > div.rounded-xl:nth-of-type(2) .flex.items-center.gap-1 p,
          .acepeak-preferences .grid.grid-cols-1.gap-3 > div.rounded-xl:nth-of-type(1) p:nth-of-type(1),
          .acepeak-preferences .grid.grid-cols-1.gap-3 > div.rounded-xl:nth-of-type(2) p:nth-of-type(1),
          .acepeak-preferences .grid.grid-cols-1.gap-3 > div.rounded-xl:nth-of-type(1) .w-16[data-slot='button'],
          .acepeak-preferences .grid.grid-cols-1.gap-3 > div.rounded-xl:nth-of-type(2) .w-16[data-slot='button'] {
            font-size: 13px;
          }
          /* Calling card text, 14px -> 13px only — same rule, applied to
             row 3 onward (however many Calling rows actually render)
             instead of the two fixed Regional rows. Title is p:nth-of-
             type(1), description is p:nth-of-type(2), and the (already
             hidden) CompanyLockNote is p:nth-of-type(3) in every row here
             — excluding it keeps this from ever touching that 12px text
             if it's ever shown again. */
          .acepeak-preferences .grid.grid-cols-1.gap-3 > div.rounded-xl:nth-of-type(n+3) p:nth-of-type(1),
          .acepeak-preferences .grid.grid-cols-1.gap-3 > div.rounded-xl:nth-of-type(n+3):not(:last-child) p:nth-of-type(2),
          .acepeak-preferences .grid.grid-cols-1.gap-3 > div.rounded-xl:nth-of-type(n+3) .w-16[data-slot='button'] {
            font-size: 13px;
          }
          /* AI Call Monitoring's own description ("When enabled
             transcripts will be automatically triggered.") is excluded
             from the 13px rule above and instead carries its own
             text-xs text-gray-500 classes directly in
             common-settings/index.tsx (isOwnSettingsPage-gated) — needed
             a real class change, not just a font-size override, since it
             also has to pick up CompanyLockNote's grey colour, not just
             its size. */
          /* Automatic Transcription's own "Automatic transcription is
             enabled/disabled." line, hidden per this page's request —
             the toggle itself still reflects and controls the same state,
             this just drops the redundant sentence describing it.
             Targeted via :has() rather than a position guess: this row
             and AI Call Monitoring are the only two rows with a Switch,
             and AI Call Monitoring is always the last card on this page
             (Display Number no longer renders here), so "has a switch,
             but isn't the last card" can only ever be Automatic
             Transcription. Its title is a direct <p> sibling here (unlike
             Regional Settings/Business Hours above), so the description
             is the 2nd <p>, not the 1st. */
          .acepeak-preferences .grid.grid-cols-1.gap-3 > div.rounded-xl:has([data-slot='switch']):not(:last-child) p:nth-of-type(2) {
            display: none;
          }
          /* Company-locked notice — the shared component's own neutral
             grey reads as inert/informational, but this is actually a
             constraint on what the person can change, so it gets the same
             amber warning treatment already used elsewhere in Settings
             (e.g. the Notifications page's "You will not be told" chip)
             instead of a new colour. */
          .acepeak-preferences .rounded-md.border-gray-200.bg-gray-50 {
            background-color: #FFFBEB !important;
            border-color: #FDE68A !important;
            color: #92400E !important;
            /* Fixed, known height (rather than however many lines the text
               happens to wrap to) is what lets .acepeak-dn-panel below
               line its own top up with the Regional card using a plain
               CSS value instead of guessing — see that rule's own
               comment. Centers the text vertically within that height;
               clips it if it would ever need a 3rd line, which only
               happens on narrower widths right at the two-column
               breakpoint. */
            height: 56px !important;
            overflow: hidden !important;
            display: flex !important;
            align-items: center !important;
          }
          /* Two-column SaaS layout at wider viewports, applied to the
             shared component's own outer wrapper via CSS Grid placement
             only — its DOM order and every element's own behaviour is
             untouched. The warning spans both columns as a single
             full-width banner; the cards stay in the left column. The
             Display Number panel (.acepeak-dn-panel) is a SIBLING of this
             wrapper, not a child of it — rendered directly by
             CommonSettingPermission alongside it — so it's positioned by
             its own rule below rather than grid-placed here.
             ".gap-4.pr-1" (rather than a bare "> div") is what keeps this
             selector matched to that one wrapper and not to the panel,
             since both are plain <div>s at this level. Below the
             breakpoint none of this applies, so the page keeps its
             original single-column stacking, and the panel (a normal
             block with no positioning) just falls in after the cards. */
          @media (min-width: 1024px) {
            .acepeak-preferences .min-h-0.flex-1.overflow-y-auto.pr-1 {
              position: relative;
            }
            .acepeak-preferences .min-h-0.flex-1.overflow-y-auto.pr-1 > div.gap-4.pr-1 {
              display: grid;
              grid-template-columns: minmax(0, 1fr) 300px;
              align-items: start;
              gap: 16px;
            }
            .acepeak-preferences .min-h-0.flex-1.overflow-y-auto.pr-1 > div.gap-4.pr-1 > * {
              grid-column: 1;
            }
            .acepeak-preferences .min-h-0.flex-1.overflow-y-auto.pr-1 > div.gap-4.pr-1 > .rounded-md.border-gray-200.bg-gray-50 {
              grid-column: 1 / -1;
              margin: 0;
            }
            /* Absolute (not fixed) so the panel scrolls with the page
               instead of staying pinned to the viewport — it moves with
               everything else inside the scroll container above, which is
               the positioned ancestor this is relative to.

               The top offset has to land the panel level with the
               Regional Settings card specifically, skipping past whatever
               sits above it in column 1 — and what sits above it depends
               on whether the company-locked banner is showing. A single
               fixed guess (previously 100px, always) was wrong on any
               account with no company-locked fields — the common case —
               landing the panel ~72px too low, because it assumed the
               banner's height was always there to skip past. :has() picks
               the right value for each case instead of guessing at one:
                 - no banner (default below): just the "Regional" eyebrow
                   heading — its own ~20px line plus the 8px margin-bottom
                   set on .acepeak-section-header above = 28px.
                 - banner showing (overridden below): its own fixed 56px
                   height, plus the inner grid's 16px row gap before the
                   heading, plus the heading's own 28px = 100px. */
            .acepeak-preferences .acepeak-dn-panel {
              position: absolute;
              top: 28px;
              right: 16px;
              left: auto;
              width: 300px;
            }
            .acepeak-preferences
              .min-h-0.flex-1.overflow-y-auto.pr-1:has(
                > div.gap-4.pr-1 > .rounded-md.border-gray-200.bg-gray-50
              )
              .acepeak-dn-panel {
              top: 100px;
            }
          }
          /* Display Number panel text, 14px -> 13px only. "Incoming
             number" / "Masking" are explicit text-[14px] in the shared
             dialog's own markup; the Select controls and the Input
             inherit 14px from their own shared base styles (0.875rem /
             text-sm); the remaining Submit button is also text-sm. None
             of the 12px text here (the two field descriptions, and the
             "If number is blocked..." label) is targeted, so it stays
             exactly 12px. Scoped to .acepeak-dn-panel only — this is the
             one shared dialog used by every other caller of
             CommonSettingPermission too, and none of that is touched. */
          .acepeak-preferences .acepeak-dn-panel p.font-semibold.text-\\[14px\\],
          .acepeak-preferences .acepeak-dn-panel input[data-slot='input'],
          .acepeak-preferences .acepeak-dn-panel button[data-slot='button'] {
            font-size: 13px;
          }
          /* The react-select control's own font-size is set inside
             index.css's @layer base with !important — see the identical
             note on the Select-height fix elsewhere in this file's
             history. An unlayered override here, even at higher
             specificity, would still lose to that layered rule, so this
             is declared inside the same base layer instead. */
          @layer base {
            .acepeak-preferences .acepeak-dn-panel .custom-react-select__control {
              font-size: 13px !important;
            }
          }
          /* The Masking field's own helper text ("Choose how your
             number..." / "Invalid masking type") now carries
             text-xs text-gray-500 directly in
             display-number-dialog/index.tsx (anchorRight-gated), so it
             picks up CompanyLockNote's exact grey (#6B7891), not just a
             matching font-size. */
          /* A plain outline Button reading "Select" doesn't look like it
             opens a dropdown the way the app's own Select controls do
             elsewhere. A decorative chevron (no new element, so nothing
             about the button's own click behaviour changes) reads it as
             one at a glance. Scoped to the "Select" buttons specifically
             (they're the only [data-slot='button'] elements sized w-16
             here) — Radix's Switch also renders as a real <button
             type="button">, so matching on button[type='button'] alone
             was drawing this same chevron on top of every toggle knob. */
          .acepeak-preferences .grid.grid-cols-1.gap-3 .w-16[data-slot='button'] {
            position: relative;
            width: auto !important;
            min-width: 92px !important;
            padding-right: 26px !important;
            background-color: #F3F4F6 !important;
            border-color: #E5E7EB !important;
          }
          .acepeak-preferences .grid.grid-cols-1.gap-3 .w-16[data-slot='button']::after {
            content: '';
            position: absolute;
            right: 10px;
            top: 50%;
            width: 7px;
            height: 7px;
            border-right: 1.5px solid currentColor;
            border-bottom: 1.5px solid currentColor;
            transform: translateY(-65%) rotate(45deg);
            opacity: 0.6;
          }
          /* No card/border/background around the Submit row — just a
             small top margin so it isn't flush against the last card,
             now that it's a normal element inside the same scrollable
             region as everything else (moved there from being a sibling
             pinned outside it via the form's own flex-col/h-full split —
             a sticky-footer layout pattern even without literal
             position:sticky/fixed). Plain margin, not padding-in-a-box,
             so there's genuinely no container behind the button. */
          .acepeak-preferences .acepeak-submitbar {
            margin-top: 16px;
          }
          /* Both Submit buttons on this page — the one at the bottom and
             the one inside the Display Number panel — share this exact
             bg/text pair, replacing their own variant's colour
             (--primary for the bottom one, pure black for the panel's
             "dark" variant). */
          .acepeak-preferences .acepeak-submitbar button[data-slot='button'],
          .acepeak-preferences .acepeak-dn-panel button[data-slot='button'] {
            background-color: #171717 !important;
            border-color: #171717 !important;
            color: #FFFFFF !important;
          }
          .acepeak-preferences .acepeak-submitbar button[data-slot='button']:hover,
          .acepeak-preferences .acepeak-dn-panel button[data-slot='button']:hover {
            background-color: #1a1a1a !important;
            border-color: #1a1a1a !important;
          }
          /* Accounts-only compact toggle (38x22, red, white knob, no
             overflow). Opt-in via .accounts-switch-compact, passed down
             from common-settings/index.tsx only when isOwnSettingsPage is
             true (i.e. only on this page) — the shared Switch component
             and every other caller of common-settings are untouched, so a
             future main-branch change to the default Switch has nothing
             here to collide with. !important is enough to win: the component's
             own classes (and mcm-page.css's [data-slot='switch'] rules)
             are plain, non-!important utilities, so this beats them
             regardless of source order. Kept identical to the same rule
             on Notifications/My Phone on purpose so all three read as one
             system. */
          .acepeak-preferences .accounts-switch-compact {
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
          .acepeak-preferences .accounts-switch-compact[data-state='checked'] {
            background-color: #dc2626 !important;
          }
          .acepeak-preferences .accounts-switch-compact[data-state='unchecked'] {
            background-color: #d1d5db !important;
          }
          .acepeak-preferences .accounts-switch-compact:disabled {
            opacity: 0.5 !important;
            cursor: not-allowed !important;
          }
          .acepeak-preferences .accounts-switch-compact [data-slot='switch-thumb'] {
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
          .acepeak-preferences .accounts-switch-compact[data-state='checked'] [data-slot='switch-thumb'] {
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
        <div className="flex items-center justify-between p-3 border-b border-gray-200 min-h-[65px] bg-white">
          <div>
            <p className="mcm-adminpage-eyebrow">My Account</p>
            <div className="flex items-center gap-1.5">
              <p className="acepeak-page-title text-gray-900 font-semibold text-xl">{heading}</p>
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
                Your own regional settings, business hours and call handling. Company-wide rules
                live under Phone System → Preferences.
              </TooltipContent>
            </Tooltip>
            </div>
          </div>
        </div>
        <div className="flex min-h-0 flex-1 flex-col p-3">
          <FormProvider {...methods}>
            <form
              onSubmit={handleSubmit(onSubmit)}
              className="flex h-full min-h-0 w-full flex-col gap-3"
            >
              <div className="min-h-0 flex-1 overflow-y-auto pr-1">
                <CommonSettingPermission
                  type={'GENERAL_SETTING'}
                  data={{ user_info: userInfoData?.user_info, settings: userInfoData?.settings }}
                  IS_ADMIN={false}
                  origin={'general_settings'}
                  company_info={userInfoData?.company_info}
                  isChooseTemplate={false}
                  selectMenuPortalTarget={selectPortalNode}
                  /* These are the person's own settings — their timezone, their
                     hours, their recording preference — so they may edit them.
                     This used to be `isEditable={IS_ADMIN}`, which greyed out the
                     whole page for everyone who was not an admin, including every
                     tenant that has no company rule at all. Holding people back
                     from settings the company controls is the company rule's job,
                     and it does it per setting rather than per job title. */
                  isEditable={true}
                  // isShowVoicemail={true}
                  /* No forced min-height here — the shared component's own
                     default (customClass's fallback) is a fixed calc(100vh
                     ...) height regardless of how little content there is,
                     which is what was leaving the large empty gap under a
                     short card list. Letting the cards size to their own
                     content, inside the already-scrollable wrapper above,
                     means the page grows and scrolls naturally instead. */
                  customClass="w-full"
                  selectedUserExt={userInfoData?.user_info?.extension}
                  /* Powers the Display Number card's own "Save changes"
                     checkbox (replacing its Submit button) — the checkbox
                     has no separate save endpoint to call, so it runs this
                     same page-level submit, which already saves the whole
                     settings object display_number included. The page's
                     own Submit button below is untouched and still submits
                     everything the normal way. */
                  onDisplayNumberSave={() => handleSubmit(onSubmit)()}
                />
                {/* Moved inside the scrollable region above (it used to be
                   a sibling of it, pinned outside via the form's own
                   flex-col/h-full split — the classic sticky-footer
                   layout pattern even without literal position:sticky).
                   Now it's just the last thing in the same scroll flow as
                   everything else, so it scrolls away with the page
                   instead of staying anchored at the bottom. */}
                <div className="flex justify-start acepeak-submitbar">
                  {/* Saving before the company rule has arrived could write a value the
                      company does not allow, so the button waits for it. The query has
                      no retry, so this is one request long either way. */}
                  <Button
                    variant={'primary'}
                    type="submit"
                    disabled={PendingGeneralSettings || companyPolicy.isLoading}
                  >
                    {PendingGeneralSettings ? 'Submiting...' : 'Submit'}
                  </Button>
                </div>
              </div>
            </form>
          </FormProvider>
        </div>
      </section>{' '}
    </>
  );
};
