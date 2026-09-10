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

/**
 * The exact row the Chat tab's conversation list uses (`ListItem`'s core
 * markup: avatar, bold name, muted preview line, time on the right, the
 * left accent bar on hover/active) — pulled out so Website and All Channels
 * render the same row instead of their own bespoke button-with-a-badge shape.
 */
const ChatListRow = ({
  name,
  preview,
  timestamp,
  avatarImage,
  badge,
  isActive,
  onClick,
}: {
  name: string;
  preview: string;
  timestamp?: string | number;
  avatarImage?: string;
  /** Small tag shown beside the name, e.g. an "AI" / "Website" chip. */
  badge?: ReactNode;
  isActive?: boolean;
  onClick: () => void;
}) => (
  <button
    type="button"
    onClick={onClick}
    className="block w-full cursor-pointer pb-0 text-left text-xs text-[var(--color-text-black)]"
  >
    <div className="flex w-full flex-col gap-1">
      <div
        className={`group relative flex min-h-[60px] w-full items-center justify-between border-b border-[var(--mcm-line-2)] px-[14px] py-[11px] transition-all duration-200 before:absolute before:left-0 before:top-0 before:bottom-0 before:w-[3px] before:content-[''] hover:bg-[#fff1f2] hover:before:bg-[var(--primary)] ${
          isActive
            ? 'bg-[var(--mcm-surface-3)] before:bg-[var(--mcm-ink-4)]'
            : 'bg-transparent before:bg-transparent'
        }`}
      >
        <div className="flex w-full min-w-0 items-center gap-2">
          <CustomAvatar name={name || ''} showPresence={false} size="36" image={avatarImage} />
          <div className="flex w-full min-w-0 flex-col gap-1">
            <div className="flex min-w-0 items-center gap-2 text-sm">
              <div className="min-w-0 truncate text-[13px] font-bold tracking-[-0.01em]">
                {name || 'Unknown'}
              </div>
              {badge}
            </div>
            <div className="truncate text-xs text-gray-500">{preview || 'No message yet'}</div>
          </div>
        </div>
        {timestamp ? (
          <div className="shrink-0 whitespace-nowrap text-xs text-gray-500">
            {getSimpleTime(timestamp)}
          </div>
        ) : null}
      </div>
    </div>
  </button>
);

export default ChatListRow;
