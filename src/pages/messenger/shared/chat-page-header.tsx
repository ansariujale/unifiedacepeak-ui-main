import { useState, type ReactNode } from 'react';
import { SearchLine } from '@/assets/icons';

/**
 * The same header the Chat tab uses (`.mcm-chat-head` + the Instrument Serif
 * italic title + the search icon that expands in place), lifted out so the
 * Website and All Channels pages render an identical header instead of the
 * generic `PageSidebarLayout` bar they used to sit inside. One header, three
 * pages — so switching between them via the filter dropdown never feels like
 * switching apps.
 */
const ChatPageHeader = ({
  title,
  searchQuery,
  onSearchChange,
  searchPlaceholder = 'Search…',
  showSearch = true,
  actions,
}: {
  title: string;
  searchQuery: string;
  onSearchChange: (value: string) => void;
  searchPlaceholder?: string;
  /** Hide the search icon — used where the content below already has its
      own search (e.g. the Facebook/Instagram/WhatsApp/Telegram lists). */
  showSearch?: boolean;
  /** Extra icon buttons (e.g. the channel filter) rendered after search. */
  actions?: ReactNode;
}) => {
  const [searchOpen, setSearchOpen] = useState(false);

  return (
    <div className="mcm-chat-head flex items-center justify-between px-3.5 py-2">
      <div className="flex w-full gap-3">
        <div className="flex w-full items-center justify-between gap-2">
          <div
            className="w-full min-w-0 truncate text-[27px] font-normal italic leading-[1.5] text-gray-900"
            style={{ fontFamily: "'Instrument Serif', Georgia, 'Times New Roman', serif" }}
          >
            {title}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {!showSearch ? null : searchOpen ? (
              <input
                autoFocus
                value={searchQuery}
                onChange={(e) => onSearchChange(e.target.value)}
                onBlur={() => {
                  if (!searchQuery.trim()) setSearchOpen(false);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') {
                    onSearchChange('');
                    setSearchOpen(false);
                  }
                }}
                placeholder={searchPlaceholder}
                aria-label={searchPlaceholder}
                /* Inline outline/border wins over the admin shell's global
                   `input:focus-visible` red-ring rule regardless of CSS
                   specificity, without editing any shared stylesheet. */
                onFocus={(e) => {
                  e.currentTarget.style.outline = 'none';
                  e.currentTarget.style.borderColor = 'var(--mcm-accent-edge)';
                }}
                style={{ outline: 'none', borderColor: 'var(--mcm-accent-edge)' }}
                className="h-[34px] w-[190px] max-w-[46vw] rounded-full border bg-white px-4 text-[13px] text-gray-900 shadow-[0_1px_3px_rgba(17,17,17,0.06)] placeholder:text-[var(--mcm-ink-4)]"
              />
            ) : (
              <button
                type="button"
                aria-label="Search"
                title="Search"
                onClick={() => setSearchOpen(true)}
                className="mcm-chat-iconbtn"
              >
                <SearchLine className="h-[15px] w-[15px]" />
              </button>
            )}
            {actions}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChatPageHeader;
