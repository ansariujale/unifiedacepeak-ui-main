import type { ReactNode } from 'react';
import moment from 'moment';
import CustomAvatar from '@/components/custom/custom-avatar';

const getSimpleTime = (dateString?: string | number) => {
  if (!dateString) return '';
  const date = moment(dateString);
  if (!date.isValid()) return '';

  if (date.isSame(moment(), 'day')) return date.format('HH:mm');
  if (date.isSame(moment().subtract(1, 'day'), 'day')) return 'Yesterday';
  if (date.isSame(moment(), 'year')) return date.format('MMM D');
  return date.format('MMM D, YYYY');
};

/** Deterministic avatar colors for the Messenger/Instagram variants, so
    names don't all land on the same flat gray circle the way CustomAvatar
    defaults to. */
const AVATAR_COLORS = ['#7c6ee0', '#e0507a', '#3aa1e0', '#2fa96b', '#e0a13a', '#c25fdb'];
const colorForName = (name: string) => {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
};

const initialsOf = (name: string) =>
  name
    .trim()
    .split(/\s+/)
    .map((p) => p.charAt(0))
    .join('')
    .slice(0, 2)
    .toUpperCase();

const INSTAGRAM_GRADIENT =
  'linear-gradient(45deg, #feda75, #fa7e1e, #d62976, #962fbf, #4f5bd5)';

/**
 * The exact row the Chat tab's conversation list uses (`ListItem`'s core
 * markup: avatar, bold name, muted preview line, time on the right, the
 * left accent bar on hover/active) — pulled out so Website and All Channels
 * render the same row instead of their own bespoke button-with-a-badge shape.
 *
 * `variant="messenger"` recolors the row for the Facebook channel — blue
 * hover/accent, colored avatar initials, and the little Messenger bubble
 * badge. `variant="instagram"` does the same for Instagram — the signature
 * gradient story-ring around the avatar, a small camera badge, and a
 * gradient-toned hover/accent/timestamp. `variant="whatsapp"` mirrors
 * WhatsApp's own chat list — green accent/timestamp, a WhatsApp badge, and
 * a read-receipt double-check before the preview text — so each channel's
 * list reads like that platform's own inbox instead of the app's usual red
 * accent.
 */
const ChatListRow = ({
  name,
  preview,
  timestamp,
  avatarImage,
  badge,
  isActive,
  onClick,
  variant = 'default',
}: {
  name: string;
  preview: string;
  timestamp?: string | number;
  avatarImage?: string;
  /** Small tag shown beside the name, e.g. an "AI" / "Website" chip. */
  badge?: ReactNode;
  isActive?: boolean;
  onClick: () => void;
  variant?: 'default' | 'messenger' | 'instagram' | 'whatsapp' | 'telegram';
}) => {
  const isMessenger = variant === 'messenger';
  const isInstagram = variant === 'instagram';
  const isWhatsapp = variant === 'whatsapp';
  const isTelegram = variant === 'telegram';

  return (
    <button
      type="button"
      onClick={onClick}
      className="block w-full cursor-pointer pb-0 text-left text-xs text-(--color-text-black)"
    >
      <div className="flex w-full flex-col gap-1">
        <div
          className={`group relative flex min-h-15 w-full items-center justify-between border-b border-mcm-line-2 px-3.5 py-2.75 transition-all duration-200 before:absolute before:left-0 before:top-0 before:bottom-0 before:w-0.75 before:content-[''] ${
            isMessenger
              ? "hover:bg-[#eaf4ff] hover:before:bg-[#0084ff]"
              : isInstagram
                ? "hover:bg-[#fdf1f8] hover:before:bg-[#d62976]"
                : isWhatsapp
                  ? "hover:bg-[#e9f7ef] hover:before:bg-[#25d366]"
                  : isTelegram
                    ? "hover:bg-[#e8f6fd] hover:before:bg-[#229ed9]"
                    : "hover:bg-[#fff1f2] hover:before:bg-(--primary)"
          } ${
            isActive
              ? 'bg-(--mcm-surface-3) before:bg-(--mcm-ink-4)'
              : 'bg-transparent before:bg-transparent'
          }`}
        >
          <div className="flex w-full min-w-0 items-center gap-2">
            {isMessenger ? (
              <div className="relative shrink-0">
                <div
                  className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full text-[13px] font-semibold text-white"
                  style={{ background: colorForName(name || 'U') }}
                >
                  {avatarImage ? (
                    <img src={avatarImage} alt={name} className="h-full w-full object-cover" />
                  ) : (
                    initialsOf(name || 'U')
                  )}
                </div>
                <span className="absolute -bottom-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-[#0084ff] ring-2 ring-white">
                  <svg viewBox="0 0 24 24" className="h-2.5 w-2.5 fill-white">
                    <path d="M12 2C6.5 2 2 6.1 2 11.3c0 2.9 1.4 5.5 3.6 7.2V22l3.3-1.8c.9.2 1.8.4 2.8.4 5.5 0 10-4.1 10-9.3S17.5 2 12 2Zm.9 12.5-2.6-2.7-5 2.7 5.5-5.8 2.6 2.7 5-2.7-5.5 5.8Z" />
                  </svg>
                </span>
              </div>
            ) : isInstagram ? (
              <div className="relative shrink-0">
                <div
                  className="flex h-10 w-10 items-center justify-center rounded-full p-[2px]"
                  style={{ background: INSTAGRAM_GRADIENT }}
                >
                  <div
                    className="flex h-full w-full items-center justify-center overflow-hidden rounded-full border-2 border-white text-[12px] font-semibold text-white"
                    style={{ background: colorForName(name || 'U') }}
                  >
                    {avatarImage ? (
                      <img src={avatarImage} alt={name} className="h-full w-full object-cover" />
                    ) : (
                      initialsOf(name || 'U')
                    )}
                  </div>
                </div>
                <span
                  className="absolute -bottom-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full ring-2 ring-white"
                  style={{ background: INSTAGRAM_GRADIENT }}
                >
                  <svg viewBox="0 0 24 24" className="h-2.5 w-2.5 fill-white">
                    <path d="M12 7.2a4.8 4.8 0 1 0 0 9.6 4.8 4.8 0 0 0 0-9.6Zm0 7.9a3.1 3.1 0 1 1 0-6.2 3.1 3.1 0 0 1 0 6.2ZM17.5 6a1.1 1.1 0 1 1-2.2 0 1.1 1.1 0 0 1 2.2 0Z" />
                    <path d="M17 2H7a5 5 0 0 0-5 5v10a5 5 0 0 0 5 5h10a5 5 0 0 0 5-5V7a5 5 0 0 0-5-5Zm3 15a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3V7a3 3 0 0 1 3-3h10a3 3 0 0 1 3 3v10Z" />
                  </svg>
                </span>
              </div>
            ) : isWhatsapp ? (
              <div className="relative shrink-0">
                <div
                  className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full text-[13px] font-semibold text-white"
                  style={{ background: colorForName(name || 'U') }}
                >
                  {avatarImage ? (
                    <img src={avatarImage} alt={name} className="h-full w-full object-cover" />
                  ) : (
                    initialsOf(name || 'U')
                  )}
                </div>
                <span className="absolute -bottom-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-[#25d366] ring-2 ring-white">
                  <svg viewBox="0 0 24 24" className="h-2.5 w-2.5 fill-white">
                    <path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l4.9-1.3A10 10 0 1 0 12 2Zm5.5 14.1c-.2.6-1.3 1.2-1.8 1.3-.5.1-1 .1-3.2-.7-2.7-1-4.4-3.7-4.6-3.9-.1-.2-1.1-1.5-1.1-2.8s.7-2 .9-2.3c.2-.2.5-.3.7-.3h.5c.2 0 .4 0 .6.5.2.5.7 1.8.8 1.9.1.1.1.3 0 .5-.1.2-.2.3-.3.5-.2.2-.3.3-.1.6.2.3.9 1.5 2 2.4 1.3 1.2 2.4 1.5 2.7 1.7.3.2.5.1.6-.1.2-.2.7-.8.9-1.1.2-.3.4-.2.6-.1.2.1 1.5.7 1.8.8.3.1.5.2.5.3.1.2.1.6-.1 1.2Z" />
                  </svg>
                </span>
              </div>
            ) : isTelegram ? (
              <div className="relative shrink-0">
                <div
                  className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full text-[13px] font-semibold text-white"
                  style={{ background: colorForName(name || 'U') }}
                >
                  {avatarImage ? (
                    <img src={avatarImage} alt={name} className="h-full w-full object-cover" />
                  ) : (
                    initialsOf(name || 'U')
                  )}
                </div>
                <span className="absolute -bottom-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-[#229ed9] ring-2 ring-white">
                  <svg viewBox="0 0 24 24" className="h-2.5 w-2.5 fill-white">
                    <path d="M21.9 4.3 2.7 11.8c-1.3.5-1.3 1.2-.2 1.6l4.9 1.5 1.9 5.8c.2.6.4.9.9.9.4 0 .6-.2.9-.5l2.2-2.1 4.6 3.4c.8.5 1.4.2 1.6-.8l3-14c.3-1.3-.5-1.8-1.6-1.3ZM7.9 14.6 17.7 8.4c.5-.3.9-.1.6.3l-8.1 7.4-.3 3.3-1.2-3.8Z" />
                  </svg>
                </span>
              </div>
            ) : (
              <CustomAvatar name={name || ''} showPresence={false} size="36" image={avatarImage} />
            )}
            <div className="flex w-full min-w-0 flex-col gap-1">
              <div className="flex min-w-0 items-center gap-2 text-sm">
                <div className="min-w-0 truncate text-[13px] font-bold tracking-[-0.01em]">
                  {name || 'Unknown'}
                </div>
                {badge}
              </div>
              <div className="flex min-w-0 items-center gap-1 truncate text-xs text-gray-500">
                {isWhatsapp ? (
                  <svg viewBox="0 0 16 11" className="h-3 w-3.5 shrink-0 fill-none stroke-[#53bdeb] stroke-[1.4]">
                    <path d="M1 5.5 4 8.5 9.5 1.5" />
                    <path d="M6 5.5 9 8.5 14.5 1.5" />
                  </svg>
                ) : null}
                <span className="truncate">{preview || 'No message yet'}</span>
              </div>
            </div>
          </div>
          {timestamp ? (
            <div
              className={`shrink-0 whitespace-nowrap text-xs ${
                isMessenger
                  ? 'font-medium text-[#0084ff]'
                  : isInstagram
                    ? 'font-medium text-[#d62976]'
                    : isWhatsapp
                      ? 'font-medium text-[#25d366]'
                      : isTelegram
                        ? 'font-medium text-[#229ed9]'
                        : 'text-gray-500'
              }`}
            >
              {getSimpleTime(timestamp)}
            </div>
          ) : null}
        </div>
      </div>
    </button>
  );
};

export default ChatListRow;
