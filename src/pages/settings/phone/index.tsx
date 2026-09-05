import CallRules from '@/pages/admin-settings/people/update-forwarding/call-rules';
import { getUserDetails, updateUserSettings, userUpdateStatus } from '@/services/api';
import { yupResolver } from '@hookform/resolvers/yup';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState, type CSSProperties } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { phoneSettingsSchema } from './schema';
import { handleAlert } from '@/lib/utils';
import { RING_TYPE_LABELS, RINGING_OPTIONS } from '@/constants/forwarding-consts';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Info } from 'lucide-react';
import { useSocketEvents } from '@/hooks/use-socket-events';
import { useUser } from '@/hooks/use-user';
import { invalidateGlobalUsersDirectory } from '@/lib/invalidate-global-users-directory';
import { mergeCallForwarding } from '@/lib/call-forwarding-record';
import '@/components/mcm/mcm-page.css';

const IncomingCalls = () => {
  const [schemaContext, setSchemaContext] = useState(null);
  const queryClient: any = useQueryClient();
  const { socketEventsManager } = useSocketEvents();
  const { user } = useUser();
  /* react-select portals its open dropdown menu to document.body by default
     — outside this page's own DOM subtree, which is why page-scoped CSS
     (ancestor selectors, or a custom class threaded through the option) can
     never reliably reach it: it isn't a descendant of .acepeak-myphone once
     rendered. Giving it this node as its portal target instead keeps it a
     real descendant of the page, so the *actual*, unmodified react-select
     classes (.custom-react-select__option--is-focused etc.) can be styled
     with a plain ancestor-scoped rule below — no custom class needed. This
     node sits as a direct child of the page's own <section>, not nested
     inside any of the scrolling/overflow-hidden cards, so the portaled menu
     (still absolutely positioned, matching how react-select already
     behaves when portaled to document.body) isn't clipped by them either. */
  const [selectPortalNode, setSelectPortalNode] = useState<HTMLDivElement | null>(null);
  /* Briefly self-reveals on load, the same as the Profile page's info
     tooltip, so the icon reads as interactive before anyone has hovered it. */
  const [showHeaderHint, setShowHeaderHint] = useState(true);
  useEffect(() => {
    const timer = setTimeout(() => setShowHeaderHint(false), 700);
    return () => clearTimeout(timer);
  }, []);
  const { data: userDetails } = useQuery({
    queryKey: ['userInfoForPhoneSettings'],
    queryFn: getUserDetails,
    select: (data) => data?.data?.data?.result || [],
  });
  const methods = useForm<any>({
    mode: 'all',
    defaultValues: { CallRules },
    resolver: yupResolver(phoneSettingsSchema),
    context: { schemaContext },
  });

  const { setValue, watch } = methods;

  useEffect(() => {
    const subscription = watch((value) => {
      setSchemaContext(value);
    });
    return () => subscription.unsubscribe();
  }, [watch]);

  const { handleSubmit } = methods;

  /* The dropdown below hydrates to "Send to Voicemail" whenever nothing is
     stored, so this screen shows voicemail on an account that has never saved
     one — and the switch, having no rule, hangs up on the caller instead. That
     mismatch is invisible, so it is called out rather than left to be
     discovered by someone ringing the number. */
  const storedRules =
    typeof userDetails?.call_forwarding === 'string'
      ? (() => {
          try {
            return JSON.parse(userDetails?.call_forwarding || '{}');
          } catch {
            return {};
          }
        })()
      : userDetails?.call_forwarding || {};
  const fallbackSaved = Boolean(storedRules?.incoming_calls?.failure_action?.type);

  const { mutate: mutateUpdateMember, isPending: isPendingUpdateMember } = useMutation({
    mutationFn: updateUserSettings,
    onSuccess: (data) => {
      queryClient.invalidateQueries(['userInfoForPhoneSettings', 'getUsersDetails'], {
        exact: true,
      });
      invalidateGlobalUsersDirectory(queryClient);
      handleAlert({
        text: data?.data?.message || 'Settings updated successfully!',
        type: 'success',
      });
    },
  });

  const onSubmit = () => {
    const callRules = watch('callRules');
    const settings =
      typeof userDetails?.settings === 'string'
        ? JSON.parse(userDetails?.settings || '{}')
        : userDetails?.settings;

    const is24Hours = settings?.operational_hours?.type === '24_hours';
    const deviceOptionsSorted = Object.entries(callRules?.incomingCall?.deviceOptions || {})
      .map(([key, value]) => ({ key, ...(value as { order: number }) }))
      .sort((a, b) => a.order - b.order);

    const selectedUser = {
      name: `${userDetails?.user_info?.first_name}${userDetails?.user_info?.last_name ? ` ${userDetails?.user_info?.last_name}` : ''}`,
      extension: userDetails?.user_info?.extension || '',
    };
    const callRuleRequest = {
      forward_calls: {
        enabled: callRules?.forwardCall?.enabled,
        type: callRules?.forwardCall?.type?.value,
        type_label: callRules?.forwardCall?.type?.label,
        value_label: callRules?.forwardCall?.value?.label || 'Select',
        value:
          callRules?.forwardCall?.type?.value === 'VOICEMAIL' && callRules?.forwardCall?.personal
            ? selectedUser?.extension
            : callRules?.forwardCall?.value?.value,
        name:
          callRules?.forwardCall?.type?.value === 'VOICEMAIL' && callRules?.forwardCall?.personal
            ? selectedUser?.name
            : callRules?.forwardCall?.value?.name || selectedUser?.name,
        personal: callRules?.forwardCall?.personal,
      },
      status: callRules?.status,
      incoming_calls: {
        enabled: callRules?.incomingCall?.enabled,
        device_options: transformPayloadNew(deviceOptionsSorted),
        type: callRules?.incomingCall?.deviceOptionValue?.value,
        failure_action: {
          enabled: true,
          type: callRules?.failureAction?.type?.value,
          type_label: callRules?.failureAction?.type?.label,
          value_label: callRules?.failureAction?.value?.label || 'Select',
          value:
            callRules?.failureAction?.type?.value === 'VOICEMAIL' &&
            callRules?.failureAction?.personal
              ? selectedUser?.extension || ''
              : callRules?.failureAction?.value?.value,
          name:
            callRules?.failureAction?.type?.value === 'VOICEMAIL' &&
            callRules?.failureAction?.personal
              ? selectedUser?.name
              : callRules?.failureAction?.value?.name || selectedUser?.name,
          personal: callRules?.failureAction?.personal,
        },
        ...(!is24Hours && {
          closed_hour_action: {
            enabled: true,
            type: callRules?.closedHoursAction?.type?.value,
            type_label: callRules?.closedHoursAction?.type?.label,
            value_label: callRules?.closedHoursAction?.value?.label || 'Select',
            value:
              callRules?.closedHoursAction?.type?.value === 'VOICEMAIL' &&
              callRules?.closedHoursAction?.personal
                ? selectedUser?.extension || ''
                : callRules?.closedHoursAction?.value?.value,
            name:
              callRules?.closedHoursAction?.type?.value === 'VOICEMAIL' &&
              callRules?.closedHoursAction?.personal
                ? selectedUser?.name
                : callRules?.closedHoursAction?.value?.name || selectedUser?.name,
            personal: callRules?.closedHoursAction?.personal,
          },
        }),
      },
      outgoing_calls: {
        enabled: callRules?.outgoingCall?.enabled,
        default_caller_id: callRules?.outgoingCall?.defaultCallerId?.value || '',
        default_fax_id: callRules?.outgoingCall?.defaultFaxId,
        default_text_id: callRules?.outgoingCall?.defaultTextId,
        ring_out: callRules?.outgoingCall?.ringOut,
        region: callRules?.outgoingCall?.region,
      },
    };
    /* Only the keys above belong to this screen. Everything else already on the
       record — the person's do-not-disturb among them — is carried through, so
       saving here does not delete what another screen owns. */
    const payload = {
      value: mergeCallForwarding(userDetails?.call_forwarding, callRuleRequest),
      key: 'call_forwarding',
    };

    const status = callRules?.status;

    socketEventsManager?.emit('user-presence-update', {
      doc: {
        userId: user?.user_info?.extension,
        domain: user?.sip_credentials?.domain,
        uuid: user?.uuid,
        status,
        onCall: false,
        timeObj: {
          holiday_start_date: null,
          holiday_end_date: null,
        },
      },
    });

    handleStatusChange(status);
    mutateUpdateMember(payload);
  };

  function transformPayloadNew(res: any) {
    return res.map((item: any) => ({
      type: item?.type || 'web',
      status: item.status ?? false,
      label: item.value.label || '',
      value:
        item?.key === 'web' ? userDetails?.user_info?.extension || '' : item.option?.value || '',
      name:
        item?.key === 'web'
          ? `${userDetails?.user_info?.first_name}${userDetails?.user_info?.last_name ? ` ${userDetails?.user_info?.last_name}` : ''}` ||
            ''
          : item.option?.label || '',
      timeout: item.value.value,
    }));
  }

  function statusChangeEvent(status: string, timeObj: any = undefined) {
    socketEventsManager?.emit(
      'user-presence-update',
      {
        doc: {
          userId: user?.user_info?.extension,
          domain: user?.sip_credentials?.domain,
          uuid: user?.uuid,
          status: status,
          onCall: false,
          timeObj,
        },
      },
      () => {},
    );
  }

  const { mutate: mutateUserUpdateStatus } = useMutation({
    mutationFn: userUpdateStatus,
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries(['getUsersDetails']);
      statusChangeEvent(variables?.socket_status, {
        holiday_start_date: null,
        holiday_end_date: null,
      });
    },
  });

  const handleStatusChange = async (status: string) => {
    if (user?.socket_status === status) return;
    mutateUserUpdateStatus({ socket_status: status });
  };
  useEffect(() => {
    if (userDetails?.call_forwarding) {
      const callHandlingData =
        typeof userDetails?.call_forwarding === 'string'
          ? JSON.parse(userDetails?.call_forwarding || '{}')
          : userDetails?.call_forwarding;
      const { incoming_calls = {}, outgoing_calls = {}, forward_calls = {} } = callHandlingData;

      const deviceOptionsArray = incoming_calls?.device_options || [];

      const deviceOptionsObject: any = {};

      if (deviceOptionsArray.length > 0) {
        deviceOptionsArray.forEach((item: any) => {
          const type = item?.type || 'web';
          const typeKey =
            userDetails?.user_info?.extension !== item?.value ? item?.name || 'web' : type;

          deviceOptionsObject[typeKey] = {
            status: item?.status,
            isDefault: item?.isDefault,
            type,
            value: {
              label: item?.label,
              value: item?.timeout,
            },
            option: {
              label: item?.name,
              value: item?.value,
            },
          };
        });

        if (!deviceOptionsObject.mobile) {
          deviceOptionsObject.mobile = {
            status: true,
            value: RINGING_OPTIONS?.[0],
            type: 'mobile',
            option: {
              label: `${userDetails?.user_info?.first_name}${userDetails?.user_info?.last_name ? ` ${userDetails?.user_info?.last_name}` : ''}`,
              value: userDetails?.user_info?.extension || '',
            },
          };
        }

        if (!deviceOptionsObject.pstn) {
          deviceOptionsObject.pstn = {
            status: true,
            value: RINGING_OPTIONS?.[0],
            type: 'pstn',
            option: {
              label: `${userDetails?.user_info?.first_name}${userDetails?.user_info?.last_name ? ` ${userDetails?.user_info?.last_name}` : ''}`,
              value: userDetails?.user_info?.extension || '',
            },
          };
        }
      } else {
        deviceOptionsObject.web = {
          status: true,
          value: RINGING_OPTIONS?.[0],
          type: 'web',
          option: {
            label: `${userDetails?.user_info?.first_name}${userDetails?.user_info?.last_name ? ` ${userDetails?.user_info?.last_name}` : ''}`,
            value: userDetails?.user_info?.extension || '',
          },
        };

        deviceOptionsObject.mobile = {
          status: true,
          value: RINGING_OPTIONS?.[0],
          type: 'mobile',
          option: {
            label: `${userDetails?.user_info?.first_name}${userDetails?.user_info?.last_name ? ` ${userDetails?.user_info?.last_name}` : ''}`,
            value: userDetails?.user_info?.extension || '',
          },
        };

        deviceOptionsObject.pstn = {
          status: true,
          value: RINGING_OPTIONS?.[0],
          type: 'pstn',
          option: {
            label: `${userDetails?.user_info?.first_name}${userDetails?.user_info?.last_name ? ` ${userDetails?.user_info?.last_name}` : ''}`,
            value: userDetails?.user_info?.extension || '',
          },
        };
      }

      setValue('callRules.forwardCall', {
        enabled: forward_calls?.enabled || false,
        type: {
          label: forward_calls?.type_label || 'Send to Voicemail',
          value: forward_calls?.type || 'VOICEMAIL',
        },
        value: {
          label: forward_calls?.value_label || 'Select',
          value: forward_calls?.value || userDetails?.user_info?.extension,
        },
        personal: forward_calls?.personal ?? true,
      });

      setValue('callRules.incomingCall', {
        enabled: true,
        deviceOptions: deviceOptionsObject,
        deviceOptionValue: {
          label: RING_TYPE_LABELS[incoming_calls?.type as keyof typeof RING_TYPE_LABELS],
          value: incoming_calls?.type || 'sequential',
        },
        type: 'number',
        number: '',
        name: '',
        extension: Object.keys(deviceOptionsObject)
          .filter(
            (key: any) =>
              deviceOptionsObject?.[key]?.option?.value !== userDetails?.user_info?.extension,
          )
          .map((key: any) => ({
            label: deviceOptionsObject?.[key]?.option?.label || '',
            value: deviceOptionsObject?.[key]?.option?.value || '',
          })),
      });

      setValue('callRules.status', callHandlingData?.status ?? 'online');

      setValue('basic.extension', userDetails?.user_info?.extension);
      setValue('callRules.outgoingCall', {
        enabled: outgoing_calls?.enabled || false,
        defaultCallerId: {
          label: outgoing_calls?.default_caller_id
            ? callHandlingData?.outgoing_calls?.default_caller_id.startsWith('+')
              ? `${callHandlingData?.outgoing_calls?.default_caller_id}`
              : `+${callHandlingData?.outgoing_calls?.default_caller_id}`
            : '',
          value: outgoing_calls?.default_caller_id || '',
        },
        defaultFaxId: outgoing_calls?.default_fax_id || '',
        defaultTextId: outgoing_calls?.default_text_id || '',
        ringOut: outgoing_calls?.ring_out || false,
        region: outgoing_calls?.region || '',
      });

      setValue('callRules.failureAction', {
        enabled: incoming_calls?.failure_action?.enabled || false,
        type: {
          label: incoming_calls?.failure_action?.type_label || 'Send to Voicemail',
          value: incoming_calls?.failure_action?.type || 'VOICEMAIL',
        },
        value: {
          label: incoming_calls?.failure_action?.value_label || 'Select',
          value: incoming_calls?.failure_action?.value || userDetails?.user_info?.extension,
        },
        personal: incoming_calls?.failure_action?.personal ?? true,
      });

      setValue('callRules.closedHoursAction', {
        enabled: incoming_calls?.closed_hour_action?.enabled || false,
        type: {
          label: incoming_calls?.closed_hour_action?.type_label || 'Send to Voicemail',
          value: incoming_calls?.closed_hour_action?.type || 'VOICEMAIL',
        },
        value: {
          label: incoming_calls?.closed_hour_action?.value_label || 'Select',
          value: incoming_calls?.closed_hour_action?.value || '',
        },
        personal: incoming_calls?.closed_hour_action?.personal ?? true,
      });
    } else {
      const fallbackLabel = `${userDetails?.user_info?.first_name}${userDetails?.user_info?.last_name ? ` ${userDetails?.user_info?.last_name}` : ''}`;
      const fallbackValue = userDetails?.user_info?.extension;

      setValue('callRules.incomingCall', {
        enabled: true,
        deviceOptions: {
          web: {
            status: true,
            value: RINGING_OPTIONS?.[0],
            option: {
              label: fallbackLabel || '',
              value: fallbackValue || '',
            },
          },
        },
        deviceOptionValue: {
          label: RING_TYPE_LABELS?.sequential,
          value: 'sequential',
        },
        type: 'number',
        number: '',
        name: '',
        extension: [],
      });

      setValue('callRules.failureAction.value', {
        label: fallbackLabel,
        value: fallbackValue,
      });
      setValue('callRules.failureAction.type', { label: 'Send to Voicemail', value: 'VOICEMAIL' });
      setValue('callRules.failureAction.personal', true);
      setValue('callRules.forwardCall.value', {
        label: fallbackLabel,
        value: fallbackValue,
      });
      setValue('callRules.forwardCall.type', { label: 'Send to Voicemail', value: 'VOICEMAIL' });

      /* Presence is not edited on this screen, but it is part of the payload it
         saves. With no stored rules there is nothing to hydrate it from, so it
         stayed undefined and Submit broadcast an undefined status and posted one
         to update-status. The person's current availability is the truthful
         value for a record that has never stored one. */
      setValue('callRules.status', user?.socket_status || 'online');
    }
  }, [userDetails]);

  useEffect(() => {
    const subscription = watch((value) => {
      setSchemaContext(value);
    });
    return () => subscription.unsubscribe();
  }, [watch]);

  return (
    <section className="acepeak-myphone flex h-full w-full flex-col overflow-hidden bg-[#efefef]">
      {/* The dropdown menu portal target — see the comment on
          selectPortalNode above. Zero-size and unstyled; it exists only as
          an attachment point. */}
      <div ref={setSelectPortalNode} />
      {/* Same brand tokens and fixes as the Profile page's own style block —
          duplicated per-page rather than shared, since each page owns its
          scope. Kept identical on purpose so the two screens read as one
          system. */}
      <style>{`
        .acepeak-myphone {
          font-family: 'Inter', ui-sans-serif, system-ui, -apple-system, sans-serif;
          --ap-primary: #DC2626;
          --ap-primary-hover: #B91C1C;
          --ap-secondary: #EF4444;
          --ap-secondary-2: #F87171;
          --ap-soft-bg: #FFF1F2;
          /* Every dropdown's focused/selected option was still the app-wide
             blue despite an earlier attempt to recolour it with an ancestor-
             scoped rule targeting react-select's own BEM classes
             (.custom-react-select__option--is-focused etc). The reason:
             that colour actually comes from a global !important rule in
             index.css, inside "@layer base". Per the CSS cascade layers
             spec, !important declarations invert layer priority — a named
             layer beats anything unlayered, however specific — so this
             page's own unlayered !important rule could never win against
             it, no matter how it was targeted.
             Fixed at the source instead: those global rules in index.css
             now read their colour from --select-option-active-bg / -fg,
             falling back to the same tokens (--color-gray-100, --primary,
             etc.) they always used, so every other page is unaffected.
             Setting the two variables here — plain custom-property
             inheritance, no !important or layer fight needed — is what
             actually reaches the portaled option elements, since
             selectPortalNode (below) keeps them real DOM descendants of
             this page rather than of document.body. Hover and the current
             selection are separate variables in index.css on purpose — only
             the selection reads this page's red; hover keeps its own
             medium-light grey rather than also turning red, so the two
             states of a dropdown stay visually distinct. */
          --select-option-active-bg: var(--ap-secondary-2);
          --select-option-active-fg: #000;
          --select-option-hover-bg: #E5E7EB;
          --select-option-hover-fg: #000;
          /* The closed dropdown box's own border — hover and focus/open —
             read the app-wide --primary too (same index.css, same
             !important-in-@layer-base pattern as the option colours
             above), which is why it showed blue rather than this page's
             own palette. A dark neutral grey here, not the page's red,
             since a field border reads as "active", not as an accent. */
          --select-control-border: #4B5563;
        }
        .acepeak-myphone .mcm-page {
          --accent: var(--ap-primary);
          --accent-ink: var(--ap-primary-hover);
          --accent-wash: var(--ap-soft-bg);
          --accent-edge: #FCA5A5;
          --sans: 'Inter', ui-sans-serif, system-ui, -apple-system, sans-serif;
        }
        .acepeak-myphone .acepeak-heading,
        .acepeak-myphone .mcm-fsec-t {
          color: #000;
          font-style: normal;
          font-weight: 700;
        }
        /* The page's own main heading only. */
        .acepeak-myphone .acepeak-page-title {
          font-family: 'Instrument Serif', serif;
          font-style: italic;
          font-weight: 400;
          font-size: 27px;
          line-height: 41px;
          color: #171717;
        }
        .acepeak-tooltip-content {
          background: #fdf7f5 !important;
          color: #000 !important;
          border: none !important;
          width: max-content !important;
          max-width: 340px !important;
          white-space: normal !important;
          line-height: 1.5 !important;
          box-shadow: 0 6px 20px rgba(17, 17, 17, 0.18) !important;
        }
        .acepeak-tooltip-content svg {
          fill: #fdf7f5 !important;
        }
        .acepeak-myphone,
        .acepeak-myphone [data-slot='input'],
        .acepeak-myphone [data-slot='button'],
        .acepeak-myphone .mcm-fsec,
        .acepeak-myphone .mcm-rule,
        .acepeak-myphone .rounded-xl {
          box-shadow: none !important;
        }
        .acepeak-myphone [data-slot='input']:not(:disabled) {
          border-color: #D1D5DB !important;
        }
        .acepeak-myphone [data-slot='input']:not(:disabled):hover,
        .acepeak-myphone [data-slot='input']:not(:disabled):focus {
          border-color: #9CA3AF !important;
          outline: none !important;
        }
        .acepeak-myphone .acepeak-info-trigger:hover {
          color: var(--ap-primary);
        }
        .acepeak-myphone [data-slot='button'][type='submit'] {
          background: #000 !important;
          border-color: #000 !important;
          color: #fff !important;
        }
        .acepeak-myphone [data-slot='button'][type='submit']:hover {
          background: #1a1a1a !important;
          border-color: #1a1a1a !important;
        }
        /* The voicemail-not-saved warning, restyled to the same compact,
           left-accented card the rest of the app's warnings use. */
        .acepeak-myphone .mcm-notsaved {
          padding: 10px 12px;
          border-radius: 10px;
          font-size: 12.5px;
        }
        /* The switch sits flush against the card's own padding, reading as
           closer to the edge than the chevrons on the rows below it (which
           are a much smaller control at the same padding). A touch more
           right padding gives it the same visual breathing room. */
        .acepeak-myphone .mcm-rule-h {
          padding-right: 18px;
        }
        /* CallRules' own root element (rendered as the last child of the
           .mcm-page wrapper below) carries "overflow-y-auto" unconditionally
           in its own source — see call-rules/index.tsx, it's baked into the
           className regardless of the customClass prop this page passes it.
           This form is meant to be the page's one scroll container; if
           anything ever gives that inner element a bounded height, its own
           overflow-y-auto activates as a second, nested, independently-
           scrolling region, and the mouse wheel scrolls THAT first — leaving
           the Submit row, which sits after it in the DOM but outside it,
           visually stationary until the inner scroll is exhausted. Neither
           element has any position other than static; this is what made a
           static, normal-flow Submit row read as pinned in place. Height and
           overflow are both cleared so that scroll can only ever happen
           here, at the form. */
        .acepeak-myphone .mcm-page > div:last-child {
          overflow: visible !important;
          height: auto !important;
          max-height: none !important;
        }
        /* No custom switch CSS here anymore. mcm-page.css already carries a
           complete, purpose-built switch design — 38x22px track, 18x18px
           thumb, translateX(17px) when checked (see the "Audit fixes for the
           user edit drawer" section there) — meant to apply everywhere
           .mcm-page is used. It was blocked only by mcm-page.css's own
           ".mcm-page button" reset stripping the switch's border before that
           was excluded at the source. Every override attempted on this page
           was fighting that already-correct, already-used-elsewhere system
           instead of just letting it apply. */
        /* Submit is a normal-flow footer, not a fixed/sticky overlay — this
           just gives it its own clearly separated action area so it can
           never read as floating over the content above it. position:
           static is already the default; asserted explicitly so nothing
           can turn it into an overlay. */
        .acepeak-myphone .acepeak-submit-row,
        .acepeak-myphone [data-slot='button'][type='submit'] {
          position: static !important;
          top: auto !important;
          bottom: auto !important;
          left: auto !important;
          right: auto !important;
          transform: none !important;
          z-index: auto !important;
        }
        .acepeak-myphone .acepeak-submit-row {
          border-top: 1px solid #f0f2f6;
          padding-top: 14px;
          margin-top: 4px;
        }
        /* Tighter rhythm between the rule cards — closer to the Profile
           page's density than the shared component's own default spacing,
           which was tuned for the roomier admin per-user screen. */
        .acepeak-myphone .mcm-rule + .mcm-rule {
          margin-top: 8px;
        }
        .acepeak-myphone .mcm-rule-h {
          min-height: 48px;
        }
        /* The "on" switch reads var(--accent), which this page already
           points at --ap-primary (#DC2626) above — a plain red, not orange.
           Hardcoded here anyway, !important, so the colour that actually
           renders is never at the mercy of that variable chain resolving
           some other way than intended. */
        .acepeak-myphone [data-slot='switch'][data-state='checked'] {
          background-color: #DC2626 !important;
          border-color: #DC2626 !important;
        }
      `}</style>
      <div className="flex shrink-0 items-center justify-between gap-2 px-4 py-3 border-b border-gray-200 bg-white">
        <div className="flex items-center gap-1.5">
          <p className="acepeak-page-title text-gray-900 font-semibold text-lg">My Phone</p>
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
            <TooltipContent className="acepeak-tooltip-content" side="right" align="center">
              Your devices, forwarding rules, and what happens when you miss a call.
            </TooltipContent>
          </Tooltip>
        </div>
      </div>
      {/* This div, not the <form> it contains, owns scrolling — the one and
          only scrollable region on the page. Everything inside it (CallRules,
          then Submit) is plain sequential content with no height/overflow of
          its own, so there is nothing left that could form a second,
          independently-scrolling region. */}
      <div className="min-h-0 flex-1 overflow-y-auto">
        <FormProvider {...methods}>
          <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-3 p-4 md:p-6">
            <div
              className="mcm-page"
              style={
                {
                  display: 'block',
                  height: 'auto',
                  minHeight: 0,
                  overflow: 'visible',
                  background: 'transparent',
                  fontFamily: 'inherit',
                  fontSize: 'inherit',
                  lineHeight: 'inherit',
                  '--sans': 'inherit',
                  '--mono': 'inherit',
                } as CSSProperties
              }
            >
              {!fallbackSaved ? (
                <div className="mcm-notsaved mb-3" role="status">
                  <strong>Voicemail isn&rsquo;t saved yet.</strong>
                  <span>Unanswered calls are hung up instead — press Submit to apply it.</span>
                </div>
              ) : null}
              <CallRules
                customClass=""
                compactDescriptions
                selectMenuPortalTarget={selectPortalNode}
              />
            </div>
            <div className="acepeak-submit-row flex justify-end gap-2">
              <Button variant={'primary'} type="submit" disabled={isPendingUpdateMember}>
                {isPendingUpdateMember ? 'Please wait...' : 'Submit'}
              </Button>
            </div>
          </form>
        </FormProvider>
      </div>
    </section>
  );
};

export default IncomingCalls;
