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
  actions,
}: {
  title: string;
  searchQuery: string;
  onSearchChange: (value: string) => void;
  searchPlaceholder?: string;
  /** Extra icon buttons (e.g. the channel filter) rendered after search. */
  actions?: ReactNode;
}) => {
  const [searchOpen, setSearchOpen] = useState(false);

  return (
    <div className="mcm-chat-head flex items-center justify-between px-3.5 py-3">
      <div className="flex w-full gap-3">
        <div className="flex w-full items-center justify-between gap-2">
          <div
            className="w-full min-w-0 truncate text-[27px] font-normal italic leading-[1.5] text-gray-900"
            style={{ fontFamily: "'Instrument Serif', Georgia, 'Times New Roman', serif" }}
          >
            {title}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {searchOpen ? (
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
                className="h-[34px] w-[190px] max-w-[46vw] rounded-[9px] border border-[var(--mcm-accent-edge)] bg-white px-3 text-[13px] text-gray-900 outline-none shadow-[0_1px_3px_rgba(17,17,17,0.06)] placeholder:text-[var(--mcm-ink-4)]"
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
