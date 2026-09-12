import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { FilterIcon } from '@/assets/icons';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useUser } from '@/hooks/use-user';
import { capitalizeFirstLetter } from '@/lib/utils';
import { CHANNELS_ICON, ChatChannels } from '../constants';
import ChatPageHeader from '../shared/chat-page-header';
import ChatListRow from '../shared/chat-list-row';
import { demoWebsiteChats } from '../demo-data';
import DateRangeMenu from '@/components/custom/date-range-menu';
import { handleDate } from '@/components/custom/date-dropdown/constant';

const DATE_PRESETS = ['All', 'Today', 'Yesterday', 'Last 7 Days', 'This Month'];

const CAPTAIN_API_BASE = '/captain-api/api/captain';

type ChannelType = keyof typeof CHANNELS_ICON;

type CaptainConversation = {
  id: string;
  visitor_name: string | null;
  visitor_email: string | null;
  page_url: string | null;
  status: 'open' | 'resolved';
  owner: 'ai' | 'human' | null;
  last_message: string | null;
  last_message_at: string | null;
  assistant_id: string;
  assistant_name: string;
};

/**
 * "Website" tab — same header and list-row treatment as the Chat tab (see
 * `ChatPageHeader` / `ChatListRow`), so switching channels via the filter
 * dropdown feels like moving within one page instead of into a different app.
 */
const CaptainChats = ({
  setSelectedChat,
  selectedChat,
  handleChatType,
  setselectedChannelType,
  allowedOmniChannels = [],
}: {
  setSelectedChat: (chat: any) => void;
  selectedChat?: any;
  isCompactLayout?: boolean;
  handleChatType?: (type: any) => void;
  setselectedChannelType?: (type: any) => void;
  allowedOmniChannels?: any[];
}) => {
  const { user } = useUser();
  const [searchQuery, setSearchQuery] = useState('');
  const [dateFilter, setDateFilter] = useState('All');

  const { data: conversations = [], isLoading } = useQuery({
    queryKey: ['captainConversations', user?.uuid],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (user?.uuid) params.set('agent_user_id', user.uuid);
      const res = await fetch(`${CAPTAIN_API_BASE}/messenger-conversations?${params.toString()}`);
      return res.json();
    },
    // Same lightweight polling approach as the native Website channel — no
    // dedicated realtime channel for Captain conversations yet.
    refetchInterval: 5000,
    select: (json: any) => (json?.data as CaptainConversation[]) ?? [],
  });

  const isDemo = !isLoading && conversations.length === 0;
  const rows = isDemo
    ? demoWebsiteChats.map((c) => ({
        id: c.id,
        visitor_name: c.visitor_name,
        visitor_email: c.visitor_email,
        owner: c.owner,
        assistant_name: c.assistant_name,
        last_message: c.last_message,
        last_message_at: c.last_message_at,
        isDemo: true,
      }))
    : conversations.map((c) => ({ ...c, isDemo: false }));

  const filteredRows = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const byName = q
      ? rows.filter((r) => (r.visitor_name || r.visitor_email || '').toLowerCase().includes(q))
      : rows;

    if (dateFilter === 'All') return byName;
    const { from, to } = handleDate(dateFilter);
    if (!from || !to) return byName;
    const rangeStart = new Date(`${from}T00:00:00`).getTime();
    const rangeEnd = new Date(`${to}T23:59:59.999`).getTime();
    return byName.filter((r) => {
      const ts = r.last_message_at ? new Date(r.last_message_at).getTime() : NaN;
      return Number.isFinite(ts) && ts >= rangeStart && ts <= rangeEnd;
    });
  }, [rows, searchQuery, dateFilter]);

  const filterMenu = handleChatType ? (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button type="button" className="mcm-chat-iconbtn" aria-label="Filter">
          <FilterIcon className="h-3.75 w-3.75" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="bg-white rounded-lg shadow-lg border border-gray-200 p-1 min-w-[200px]">
        {ChatChannels?.map((item: any, index: number) => (
          <DropdownMenuItem
            key={index}
            className={`cursor-pointer transition-colors focus:bg-[#fff1f2] focus:text-primary ${
              item.value === 'captain' ? 'bg-gray-100 text-gray-900' : ''
            }`}
            onClick={() => {
              handleChatType(item.value);
              setselectedChannelType?.(item);
            }}
          >
            {item.icon()} {item.label}
          </DropdownMenuItem>
        ))}
        {allowedOmniChannels.map((item: any, index: number) => (
          <DropdownMenuItem
            key={index}
            className="cursor-pointer transition-colors focus:bg-[#fff1f2] focus:text-primary"
            onClick={() => {
              handleChatType(item.type);
              setselectedChannelType?.(item);
            }}
          >
            {CHANNELS_ICON[item?.type as ChannelType]} {capitalizeFirstLetter(item.type)}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  ) : null;

  const dateMenu = (
    <DateRangeMenu
      options={DATE_PRESETS.map((preset) => ({ label: preset, value: preset }))}
      value={dateFilter}
      onChange={setDateFilter}
      label="Filter by date"
    />
  );

  return (
    <div className="flex h-full min-h-0 w-full flex-col bg-white">
      <ChatPageHeader
        title="Website"
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        searchPlaceholder="Search visitors…"
        actions={
          <>
            {dateMenu}
            {filterMenu}
          </>
        }
      />

      {isDemo ? (
        <div className="flex items-center gap-2 px-3.5 pb-1 pt-2">
          <span className="inline-flex items-center gap-1 rounded-md border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-[9.5px] font-bold uppercase tracking-wide text-amber-700">
            Demo data
          </span>
          <span className="text-[11px] font-medium text-gray-400">
            no conversations yet — showing samples
          </span>
        </div>
      ) : null}

      <div className="flex h-full min-h-0 flex-1 flex-col overflow-y-auto">
        {isLoading ? (
          <div className="p-4 text-sm text-gray-400">Loading…</div>
        ) : filteredRows.length ? (
          filteredRows.map((c: any) => {
            const isActive = selectedChat?.id === c.id;
            const label = c.visitor_name || c.visitor_email || 'Website visitor';
            return (
              <ChatListRow
                key={c.id}
                name={label}
                preview={c.last_message || ''}
                timestamp={c.last_message_at}
                isActive={isActive}
                onClick={() => setSelectedChat(c)}
                badge={
                  <span
                    className={`shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-medium ${
                      c.owner === 'human'
                        ? 'bg-amber-100 text-amber-700'
                        : 'bg-emerald-100 text-emerald-700'
                    }`}
                  >
                    {c.owner === 'human' ? 'You' : 'AI'}
                  </span>
                }
              />
            );
          })
        ) : (
          <div className="flex h-full items-center justify-center p-6 text-center text-sm text-gray-400">
            No conversations found
          </div>
        )}
      </div>
    </div>
  );
};

export default CaptainChats;
