import { getUserDetails, updateUserSettings } from '@/services/api';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState, type CSSProperties } from 'react';
import { useForm } from 'react-hook-form';
import { NOTIFICATION_SETTINGS_INITIAL, NOTIFICATION_TYPES_LIST } from '../constant';
import { handleAlert } from '@/lib/utils';
import { invalidateGlobalUsersDirectory } from '@/lib/invalidate-global-users-directory';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Info,
  Mail,
  Globe,
  MessageSquare,
  Smartphone,
  Pencil,
  Trash2,
  CheckCircle2,
} from 'lucide-react';
import PhoneInput from 'react-phone-input-2';
import '@/components/mcm/mcm-page.css';

/** A small hover-only info icon, next to a section heading, carrying the
 * section's description as its tooltip — the same pattern Profile's Identity
 * / Workplace / Contact headings use, so a heading reads clean and the
 * explanation is a hover away instead of always-on text under it. */
const SectionInfo = ({ text }: { text: string }) => (
  <Tooltip>
    <TooltipTrigger asChild>
      <button
        type="button"
        className="acepeak-info-trigger inline-flex h-3.5 w-3.5 items-center justify-center rounded-full text-gray-400"
        aria-label={text}
      >
        <Info className="h-3.5 w-3.5" />
      </button>
    </TooltipTrigger>
    <TooltipContent className="acepeak-tooltip-content" side="right" align="center">
      {text}
    </TooltipContent>
  </Tooltip>
);

/** Subtle, text-sized icon beside a channel's own name — not decorative,
 * just enough to tell the four rows apart at a glance. */
const CHANNEL_ICONS: Record<string, typeof Mail> = {
  email: Mail,
  socket: Globe,
  sms: MessageSquare,
  push: Smartphone,
};

/** The right-hand visual for the empty "Add SMS Number" state only: a
 * phone with a speaker/home indicator and a chat bubble overlapping its
 * upper-right corner, plus a "kept private and secure" badge underneath —
 * the page's own primary red for the linework, kept out of the way of the
 * form and its two buttons. */
const SmsIllustration = ({ className }: { className?: string }) => (
  <div className={className} aria-hidden="true">
    <svg
      className="acepeak-popover-illustration-icon"
      width="160"
      height="160"
      viewBox="0 0 220 220"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M83 24C112 12 157 24 172 52C187 80 167 101 177 128C187 155 174 185 143 194C112 203 79 190 63 166C47 142 55 119 42 96C29 73 54 37 83 24Z"
        fill="#FEF2F2"
      />
      <rect x="78" y="49" width="48" height="101" rx="11" stroke="#DC2626" strokeWidth="4" />
      <path d="M96 56H108" stroke="#DC2626" strokeWidth="3" strokeLinecap="round" />
      <path d="M96 139H108" stroke="#DC2626" strokeWidth="3" strokeLinecap="round" />
      <path
        d="M109 68H144C151 68 156 73 156 80V101C156 108 151 113 144 113H128L117 124V113H109C102 113 97 108 97 101V80C97 73 102 68 109 68Z"
        fill="#DC2626"
      />
      <path d="M111 82H143" stroke="white" strokeWidth="3" strokeLinecap="round" />
      <path d="M111 90H137" stroke="white" strokeWidth="3" strokeLinecap="round" />
      <path d="M111 98H131" stroke="white" strokeWidth="3" strokeLinecap="round" />
      <path d="M165 53L170 43" stroke="#DC2626" strokeWidth="3" strokeLinecap="round" />
      <path d="M174 61L182 57" stroke="#DC2626" strokeWidth="3" strokeLinecap="round" />
      <path
        d="M59 128L62 135L69 138L62 141L59 148L56 141L49 138L56 135L59 128Z"
        fill="#DC2626"
      />
    </svg>
    <svg
      className="acepeak-popover-illustration-badge"
      width="200"
      height="55"
      viewBox="0 0 260 72"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect width="260" height="72" rx="10" fill="#FEF2F2" />
      <path
        d="M38 13
           L49 17
           V27
           C49 35 44 41 38 44
           C32 41 27 35 27 27
           V17
           L38 13Z"
        stroke="#DC2626"
        strokeWidth="3"
        strokeLinejoin="round"
      />
      <path
        d="M33 28L36 31L43 23"
        stroke="#DC2626"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <text
        x="62"
        y="28"
        fontFamily="Inter, Arial, sans-serif"
        fontSize="14"
        fontWeight="500"
        fill="#475569"
      >
        Your number is kept
      </text>
      <text
        x="62"
        y="47"
        fontFamily="Inter, Arial, sans-serif"
        fontSize="14"
        fontWeight="500"
        fill="#475569"
      >
        private and secure.
      </text>
    </svg>
  </div>
);

/** The SMS row's own number, kept out of the table entirely: an info icon
 * whose native title shows the number on hover, and whose click opens a
 * compact popover to read, edit or delete it — so the table never gains a
 * column, or a permanently-visible number, just for this one channel.
 *
 * The popover's own shape depends only on whether a number is already
 * saved (`hasNumber`): with a number on file it's a 3-action management
 * view — Keep, Edit, Delete — where Keep confirms/enables SMS with that
 * number. With none, it's a 2-action add form, starting from a blank
 * input — Save (stores the number and enables SMS) and Cancel (leaves SMS
 * off).
 *
 * Turning the Switch on always opens this popover first — the parent
 * never flips `sms` to true directly from the toggle, only this
 * popover's own Keep/Save actions do that, whichever view they land on.
 * Opening the popover by clicking the info icon behaves the same way.
 *
 * `phone` is the person's own saved SMS number and nothing else — it is
 * never defaulted from the account's phone, so that deleting it (below)
 * actually leaves this row with no number and a blank input next time,
 * rather than one that quietly reappears as something to keep. */
const SmsNumberControl = ({
  phone,
  onPhoneChange,
  isOpen,
  onOpenChange,
  onEnableSms,
  onDeleteNumber,
}: {
  phone: string;
  onPhoneChange: (value: string) => void;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  /** Confirms the current (or just-edited) number and turns SMS on —
   * called by Keep in the management view and Save in the add form. */
  onEnableSms: () => void;
  /** Clears the saved number and turns SMS back off — a number that no
   * longer exists cannot stay the channel's active one. */
  onDeleteNumber: () => void;
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [draftPhone, setDraftPhone] = useState(phone);
  const hasNumber = !!phone;
  // The illustration is only for the true "no number yet" add flow, never
  // for editing an already-saved one.
  const showIllustration = isEditing && !hasNumber;

  useEffect(() => {
    if (isOpen) {
      // No number saved yet: always start from a blank input, never a
      // leftover or suggested value — most importantly right after a
      // delete, where `phone` has just gone back to ''.
      setDraftPhone(hasNumber ? phone : '');
      setIsEditing(!hasNumber);
    }
    // Only re-sync when the popover opens, not on every keystroke elsewhere.
  }, [isOpen]);

  return (
    <Popover
      open={isOpen}
      onOpenChange={(nextOpen) => {
        onOpenChange(nextOpen);
        if (!nextOpen) setIsEditing(false);
      }}
    >
      <PopoverTrigger asChild>
        <button
          type="button"
          className="acepeak-info-trigger inline-flex h-3.5 w-3.5 items-center justify-center rounded-full text-gray-400"
          title={phone || 'No number set'}
          aria-label={phone ? `SMS number ${phone}` : 'Set SMS number'}
        >
          <Info className="h-3.5 w-3.5" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        sideOffset={8}
        className={`acepeak-popover-content p-5 ${showIllustration ? 'w-[500px]' : 'w-96'}`}
      >
        {isEditing ? (
          (() => {
            const formBody = (
              <>
                <div>
                  <p className="acepeak-popover-heading">
                    {hasNumber ? 'Edit SMS Number' : 'Add SMS Number'}
                  </p>
                  {!hasNumber && (
                    <p className="acepeak-popover-subtext">
                      Get voicemail and missed call alerts via text message.
                    </p>
                  )}
                </div>
                <div>
                  <p className="acepeak-popover-label">Phone number</p>
                  <PhoneInput country={'us'} value={draftPhone} onChange={setDraftPhone} />
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant={'primary'}
                    size="sm"
                    className="acepeak-popover-done"
                    disabled={!draftPhone}
                    onClick={() => {
                      onPhoneChange(draftPhone);
                      onEnableSms();
                      setIsEditing(false);
                    }}
                  >
                    Save
                  </Button>
                  <button
                    type="button"
                    className="acepeak-popover-secondary-btn"
                    onClick={() => {
                      if (hasNumber) {
                        setIsEditing(false);
                      } else {
                        onOpenChange(false);
                      }
                    }}
                  >
                    Cancel
                  </button>
                </div>
              </>
            );

            return showIllustration ? (
              // items-stretch: the illustration column carries no height of
              // its own (its two SVGs are absolutely positioned within it,
              // see .acepeak-popover-illustration below), so it stretches
              // to exactly match the form column's height — pinning the
              // icon to its top (level with the heading) and the badge to
              // its bottom (level with the Save/Cancel row) without moving
              // or resizing the form or either illustration.
              <div className="flex items-stretch gap-4">
                <div className="flex min-w-0 flex-1 flex-col gap-3">{formBody}</div>
                <SmsIllustration className="acepeak-popover-illustration shrink-0" />
              </div>
            ) : (
              <div className="flex flex-col gap-3">{formBody}</div>
            );
          })()
        ) : (
          <div className="flex flex-col gap-4">
            <div>
              <p className="acepeak-popover-heading">SMS Notifications</p>
              <p className="acepeak-popover-subtext">
                Receive voicemail and missed call alerts via text message.
              </p>
            </div>
            <div>
              <p className="acepeak-popover-label">Your saved number</p>
              <div className="acepeak-popover-number-box">
                <span className="acepeak-popover-number truncate">{phone}</span>
                <span className="acepeak-popover-saved-badge">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Saved
                </span>
              </div>
            </div>
            <div className="acepeak-popover-divider" />
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant={'primary'}
                size="sm"
                className="acepeak-popover-done"
                onClick={onEnableSms}
              >
                Keep
              </Button>
              <button
                type="button"
                className="acepeak-popover-secondary-btn"
                onClick={() => setIsEditing(true)}
              >
                <Pencil className="h-3.5 w-3.5" />
                Edit number
              </button>
              <button
                type="button"
                className="acepeak-popover-danger-btn"
                onClick={onDeleteNumber}
              >
                <Trash2 className="h-3.5 w-3.5" />
                Delete
              </button>
            </div>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
};

const SettingsNotification = () => {
  const { data: userInfoData } = useQuery({
    queryKey: ['getUserDetailsForNotification'],
    queryFn: getUserDetails,
    select: (data) => data?.data?.data?.result,
  });

  const queryClient: any = useQueryClient();
  const { setValue, watch, handleSubmit, reset } = useForm<any>({
    mode: 'all',
    defaultValues: NOTIFICATION_SETTINGS_INITIAL,
  });

  const { mutate, isPending } = useMutation({
    mutationFn: updateUserSettings,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['userInfo'] });
      invalidateGlobalUsersDirectory(queryClient);
      handleAlert({
        text: 'Notification settings saved successfully!',
        type: 'success',
      });
    },
  });

  useEffect(() => {
    if (userInfoData) {
      reset(userInfoData?.notification_settings?.notification_settings);
    }
  }, [userInfoData]);

  /* Surfaces the page's info tooltip on its own, briefly, on first load — the
     same reveal Profile's and My Phone's own page headings use. */
  const [showHeaderHint, setShowHeaderHint] = useState(true);
  useEffect(() => {
    const timer = setTimeout(() => setShowHeaderHint(false), 700);
    return () => clearTimeout(timer);
  }, []);

  /* Which section's SMS number popover is open — 'voicemail' | 'missed' |
     'sms' | null. Lifted up here (rather than local state inside
     SmsNumberControl) so the SMS Switch itself can open it: turning SMS on
     never flips the flag directly, it always opens this popover first —
     landing on the "keep this number" view or the add-number form
     depending on whether one is already saved — and only that popover's
     own confirm action actually enables SMS. */
  const [smsPromptFor, setSmsPromptFor] = useState<string | null>(null);

  const onSubmit = (data: any) => {
    /* A saved SMS number is meant to survive turning SMS off — someone
       switching it off for a while shouldn't have to retype it to switch
       it back on. Only the popover's own explicit "Delete" action clears
       the number now (setting `phone` to '' directly in the form), so
       there is nothing left to do here at submit time — the sms flag and
       the phone are independent facts, not one implying the other. */
    const payload = {
      key: 'notification_settings',
      value: {
        notification_settings: {
          ...data,
          forgot_password: {
            email: true,
            socket: false,
            sms: true,
            push: false,
          },
        },
      },
    };

    mutate(payload);
  };

  return (
    <section className="acepeak-notifications flex h-full w-full flex-col overflow-hidden bg-[#efefef]">
      {/* Same brand tokens and fixes as the Profile / My Phone pages' own
          style blocks — duplicated per-page rather than shared, since each
          page owns its scope. Kept identical on purpose so all three read as
          one system. */}
      <style>{`
        .acepeak-notifications {
          font-family: 'Inter', ui-sans-serif, system-ui, -apple-system, sans-serif;
          --ap-primary: #DC2626;
          --ap-primary-hover: #B91C1C;
          --ap-secondary: #EF4444;
          --ap-secondary-2: #F87171;
          --ap-soft-bg: #FFF1F2;
        }
        .acepeak-notifications .mcm-page {
          --accent: var(--ap-primary);
          --accent-ink: var(--ap-primary-hover);
          --accent-wash: var(--ap-soft-bg);
          --accent-edge: #FCA5A5;
          --sans: 'Inter', ui-sans-serif, system-ui, -apple-system, sans-serif;
        }
        .acepeak-notifications .acepeak-heading,
        .acepeak-notifications .mcm-fsec-t {
          color: #000;
          font-style: normal;
          font-weight: 700;
        }
        .acepeak-notifications .mcm-fsec-t {
          font-size: 15px;
        }
        /* The page's own main heading only. */
        .acepeak-notifications .acepeak-page-title {
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
        .acepeak-notifications,
        .acepeak-notifications [data-slot='input'],
        .acepeak-notifications [data-slot='button'],
        .acepeak-notifications .mcm-fsec {
          box-shadow: none !important;
        }
        .acepeak-notifications [data-slot='input']:not(:disabled) {
          border-color: #D1D5DB !important;
        }
        .acepeak-notifications [data-slot='input']:not(:disabled):hover,
        .acepeak-notifications [data-slot='input']:not(:disabled):focus {
          border-color: #9CA3AF !important;
          outline: none !important;
        }
        .acepeak-notifications .acepeak-info-trigger:hover {
          color: var(--ap-primary);
        }
        /* .mcm-notsaved (index.css) carries its own dark-mode variant —
           a near-black background with cream text — that kicks in purely
           off the OS/browser's prefers-color-scheme, regardless of this
           app's own light theme. Pinned back to its intended warm-yellow
           warning colours here so this banner reads as a warning on this
           page no matter the system setting. */
        .acepeak-notifications .mcm-notsaved {
          border-color: #f0c088 !important;
          border-left-color: #c2670a !important;
          background: #fdf5e9 !important;
          color: #7a4406 !important;
        }
        /* The SMS row's number popover — portaled outside .acepeak-notifications
           like the tooltip above, so it needs its own class rather than
           ancestor scoping. Unlike the rest of this page's flat, no-shadow
           chrome, this one keeps a real border and shadow: it floats over a
           table row rather than sitting in the page's own normal flow, and
           a table of white and soft-red rows gave it nothing else to read
           as "above" the page by — a border this close to white blended
           straight into it, so this is a step past #E5E7EB, still neutral
           gray rather than a themed/red outline. Sized and padded on the
           element itself (in the JSX below), not here — this rule only
           owns colour, radius and elevation, so there is exactly one place
           that controls each. */
        .acepeak-popover-content {
          background: #fff !important;
          border-width: 1px !important;
          border-style: solid !important;
          border-color: #D1D5DB !important;
          border-radius: 12px !important;
          box-shadow:
            0 16px 32px -8px rgba(17, 24, 39, 0.16),
            0 4px 10px -4px rgba(17, 24, 39, 0.08) !important;
        }
        /* No height of its own — stretched by the row (items-stretch on its
           parent) to exactly match the form column's height, so the two
           SVGs inside it can pin to its real top and bottom edges via
           absolute positioning below. */
        .acepeak-popover-illustration {
          position: relative;
          width: 200px;
        }
        .acepeak-popover-illustration-icon {
          position: absolute;
          top: 0;
          left: 50%;
          transform: translateX(-50%);
        }
        .acepeak-popover-illustration-badge {
          position: absolute;
          bottom: 0;
          left: 50%;
          transform: translateX(-50%);
        }
        @media (max-width: 480px) {
          .acepeak-popover-illustration {
            display: none;
          }
        }
        .acepeak-popover-heading {
          margin: 0 0 2px;
          font-size: 15px;
          font-weight: 700;
          color: #111827;
        }
        .acepeak-popover-subtext {
          margin: 0;
          font-size: 12.5px;
          line-height: 1.45;
          color: #6B7280;
        }
        /* Label over value, the same small-caps-over-headline shape the
           rest of this app's detail rows use — reads as "here is a fact",
           not as a form. */
        .acepeak-popover-label {
          margin: 0 0 4px;
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0.05em;
          text-transform: uppercase;
          color: #9CA3AF;
        }
        /* The saved number's own card — a quiet neutral box (not the
           table's pink wash) so the number itself, not its container,
           stays the thing your eye lands on. */
        .acepeak-popover-number-box {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          padding: 10px 12px;
          border: 1px solid #E5E7EB;
          border-radius: 10px;
          background: #F9FAFB;
        }
        .acepeak-popover-number {
          margin: 0;
          font-size: 16px;
          font-weight: 700;
          letter-spacing: 0.01em;
          color: #111111;
        }
        /* A subtle status pill, not a loud green "success" badge — kept to
           the page's own neutral/red palette rather than an unrelated
           colour just for this one indicator. */
        .acepeak-popover-saved-badge {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          padding: 3px 9px;
          border-radius: 999px;
          background: #F3F4F6;
          color: #374151;
          font-size: 11px;
          font-weight: 700;
          white-space: nowrap;
        }
        .acepeak-popover-divider {
          height: 1px;
          background: #E5E7EB;
        }
        /* Neutral action — Edit and Cancel both read as "safe", not the
           destructive move Delete is. */
        .acepeak-popover-secondary-btn {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 8px 13px;
          border: 1px solid #E5E7EB;
          border-radius: 9px;
          background: #fff;
          color: #111827;
          font-size: 13px;
          font-weight: 600;
        }
        .acepeak-popover-secondary-btn:hover {
          border-color: #D1D5DB;
          background: #F9FAFB;
        }
        /* The one destructive action — the page's soft-red wash so it reads
           as clearly different from Edit/Cancel at a glance. */
        .acepeak-popover-danger-btn {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 8px 13px;
          border: 1px solid #FCA5A5;
          border-radius: 9px;
          background: var(--ap-soft-bg);
          color: var(--ap-primary);
          font-size: 13px;
          font-weight: 600;
        }
        .acepeak-popover-danger-btn:hover {
          background: #FEE2E2;
          border-color: #F87171;
          color: var(--ap-primary-hover);
        }
        /* Buttons stay black on this page too, the same as Submit — the
           default primary variant rides the app-wide tenant colour, which
           read as an unrelated blue next to this page's red/black palette. */
        .acepeak-popover-content .acepeak-popover-done {
          background: #171717 !important;
          border-color: #171717 !important;
          color: #fff !important;
        }
        .acepeak-popover-content .acepeak-popover-done:hover {
          background: #000 !important;
          border-color: #000 !important;
        }
        /* react-phone-input-2's own chrome, nudged to the same rounded,
           soft-bordered language as the rest of this popover, with a red
           focus ring instead of its default blue. */
        .acepeak-popover-content .react-tel-input .form-control {
          width: 100%;
          height: 40px;
          border-radius: 9px;
          border-color: #E5E7EB;
          font-size: 13.5px;
        }
        .acepeak-popover-content .react-tel-input .form-control:focus {
          border-color: var(--ap-primary);
          box-shadow: 0 0 0 3px var(--ap-soft-bg);
        }
        .acepeak-popover-content .react-tel-input .flag-dropdown {
          border-radius: 9px 0 0 9px;
          border-color: #E5E7EB;
          background: #fff;
        }
        .acepeak-notifications [data-slot='button'][type='submit'] {
          background: #000 !important;
          border-color: #000 !important;
          color: #fff !important;
        }
        .acepeak-notifications [data-slot='button'][type='submit']:hover {
          background: #1a1a1a !important;
          border-color: #1a1a1a !important;
        }
        /* Section cards a touch tighter than the shared default, closer to
           the density Profile and My Phone use. */
        .acepeak-notifications .mcm-fsec {
          padding: 14px 16px;
        }
        .acepeak-notifications .mcm-fsec-h {
          margin-bottom: 10px;
        }
        .acepeak-notifications .mcm-fsec + .mcm-fsec {
          margin-top: 10px;
        }
        /* Each notification type is its own small three-column table —
           channel, how it works, toggle — rather than four separate cards.
           A fixed channel column and a fixed toggle column leave the middle
           one free to grow, so the description gets whatever width is left
           over and wraps into it rather than being squeezed. */
        .acepeak-notifications .acepeak-channel-table {
          border: 1px solid #E5E7EB;
          border-radius: 10px;
          overflow: hidden;
        }
        .acepeak-notifications .acepeak-channel-head,
        .acepeak-notifications .acepeak-channel-row {
          display: grid;
          grid-template-columns: 152px 1fr 44px;
          align-items: center;
          gap: 14px;
          padding: 10px 14px;
        }
        @media (max-width: 560px) {
          .acepeak-notifications .acepeak-channel-head,
          .acepeak-notifications .acepeak-channel-row {
            grid-template-columns: 112px 1fr 40px;
            gap: 8px;
            padding: 9px 10px;
          }
        }
        .acepeak-notifications .acepeak-channel-head {
          background: #F9FAFB;
          border-bottom: 1px solid #E5E7EB;
          font-size: 11.5px;
          font-weight: 700;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          color: #6B7280;
        }
        /* Left-aligned in its own column, immediately after the grid gap —
           centring it instead left a variable extra margin on top of that
           gap (half the column's leftover width), which is what made the
           space before the toggle read as bigger than the space between
           the first two columns. Left-aligned, the gap before it is always
           exactly the grid's own gap, matching the rest of the row, and any
           unused column width falls after it instead, as ordinary trailing
           padding. */
        .acepeak-notifications .acepeak-channel-head > :last-child,
        .acepeak-notifications .acepeak-channel-toggle {
          justify-self: start;
        }
        .acepeak-notifications .acepeak-channel-row {
          border-bottom: 1px solid #F0F2F6;
        }
        .acepeak-notifications .acepeak-channel-table > div:last-child > .acepeak-channel-row {
          border-bottom: 0;
        }
        .acepeak-notifications .acepeak-channel-name {
          display: flex;
          align-items: center;
          gap: 7px;
          min-width: 0;
        }
        .acepeak-notifications .acepeak-channel-icon {
          flex: none;
          color: #9CA3AF;
        }
        .acepeak-notifications .acepeak-channel-label {
          color: #111111;
          font-size: 13px;
          font-weight: 600;
        }
        .acepeak-notifications .acepeak-channel-desc {
          font-size: 12px;
          line-height: 1.55;
          color: #6B7280;
        }
        /* Submit is a normal-flow footer, not a fixed/sticky overlay — same
           treatment as My Phone's own Submit row. */
        .acepeak-notifications .acepeak-submit-row {
          position: static !important;
          border-top: 1px solid #f0f2f6;
          padding-top: 14px;
          margin-top: 4px;
        }
      `}</style>
      <div className="flex shrink-0 items-center justify-between gap-2 px-4 py-3 border-b border-gray-200 bg-white">
        <div className="flex items-center gap-1.5">
          <p className="acepeak-page-title text-gray-900 font-semibold text-lg">Notifications</p>
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
              What you get alerted about, and whether it arrives in the browser, by email or both.
            </TooltipContent>
          </Tooltip>
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
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
            {/* Voicemail, missed calls and SMS all save, and nothing reads them.
                The only key any service takes out of `notification_settings` is
                `security_alert`. The missed-call script on the switch is worse
                than unwired: it is referenced by no dialplan, it posts to a
                placeholder address, and it uses `!=`, which is not valid Lua.
                Remove this notice in the same change that makes the three real —
                not before. */}
            <div className="mcm-notsaved mb-3" role="status">
              <strong>Voicemail and missed-call alerts have stopped.</strong>
              <span> Saved here, but not sent since Aug 24 — SMS alerts have never gone out.</span>
            </div>
            <div className="flex flex-col">
              {NOTIFICATION_TYPES_LIST.map((item) => {
                /* Every channel off means this event reaches the person
                   nowhere. Nothing said so, so it looked configured rather
                   than silent. */
                const tellsNoOne = !item?.settingsType?.some(({ value }) =>
                  watch(`${item?.value}.${value}`),
                );

                return (
                  <section className="mcm-fsec" key={item.id}>
                    <div className="mcm-fsec-h flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5">
                        <div className="mcm-fsec-t">{item.name}</div>
                        <SectionInfo text={item.description} />
                      </div>
                      {tellsNoOne && (
                        <span className="shrink-0 rounded-md bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700">
                          You will not be told
                        </span>
                      )}
                    </div>
                    <div className="acepeak-channel-table">
                      <div className="acepeak-channel-head">
                        <span>Channel</span>
                        <span>How it works</span>
                        <span>Status</span>
                      </div>
                      {item?.settingsType?.map(({ label, value, hint }: any) => {
                        const checked = watch(`${item?.value}.${value}`);
                        const ChannelIcon = CHANNEL_ICONS[value];
                        return (
                          <div key={value}>
                            <div className="acepeak-channel-row">
                              <div className="acepeak-channel-name">
                                {ChannelIcon && (
                                  <ChannelIcon className="acepeak-channel-icon h-3.5 w-3.5" />
                                )}
                                <Label className="acepeak-channel-label">{label}</Label>
                                {value === 'sms' && (
                                  <SmsNumberControl
                                    phone={watch(`${item?.value}.phone`) || ''}
                                    onPhoneChange={(phoneValue) =>
                                      setValue(`${item?.value}.phone`, phoneValue)
                                    }
                                    isOpen={smsPromptFor === item.value}
                                    onOpenChange={(open) =>
                                      setSmsPromptFor(open ? item.value : null)
                                    }
                                    onEnableSms={() => {
                                      setValue(`${item?.value}.sms`, true);
                                      setSmsPromptFor(null);
                                    }}
                                    onDeleteNumber={() => {
                                      setValue(`${item?.value}.phone`, '');
                                      setValue(`${item?.value}.sms`, false);
                                      setSmsPromptFor(null);
                                    }}
                                  />
                                )}
                              </div>
                              <p className="acepeak-channel-desc">{hint}</p>
                              <Switch
                                disabled={item?.id === 3 && value === 'sms'}
                                className="acepeak-channel-toggle cursor-pointer"
                                onCheckedChange={(nextChecked) => {
                                  if (value === 'sms') {
                                    if (nextChecked) {
                                      /* Always opens SmsNumberControl's
                                         popover instead of enabling SMS
                                         directly — whether that lands on the
                                         "keep this number" view or the
                                         add-number form depends on whether a
                                         number is already saved, but either
                                         way only the popover's own confirm
                                         action actually flips this on. */
                                      setSmsPromptFor(item.value);
                                    } else {
                                      setValue(`${item?.value}.sms`, false);
                                    }
                                    return;
                                  }
                                  setValue(`${item?.value}.${value}`, nextChecked);
                                }}
                                checked={checked}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </section>
                );
              })}
            </div>
          </div>
          <div className="acepeak-submit-row flex justify-end gap-2">
            <Button variant={'primary'} type="submit" disabled={isPending}>
              {isPending ? 'Submitting...' : 'Submit'}
            </Button>
          </div>
        </form>
      </div>
    </section>
  );
};

export default SettingsNotification;