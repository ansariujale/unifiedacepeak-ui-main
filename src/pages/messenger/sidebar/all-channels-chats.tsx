import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Globe } from 'lucide-react';
import { FilterIcon } from '@/assets/icons';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useSocketEvents } from '@/hooks/use-socket-events';
import { useUser } from '@/hooks/use-user';
import { capitalizeFirstLetter } from '@/lib/utils';
import { CHANNELS_ICON, ChatChannels } from '../constants';
import ChatPageHeader from '../shared/chat-page-header';
import ChatListRow from '../shared/chat-list-row';
import { demoAllChannelsChats, demoChannelChats, type ChannelKey } from '../demo-data';
import DateRangeMenu from '@/components/custom/date-range-menu';
import { handleDate } from '@/components/custom/date-dropdown/constant';

const DATE_PRESETS = ['All', 'Today', 'Yesterday', 'Last 7 Days', 'This Month'];

const CAPTAIN_API_BASE = '/captain-api/api/captain';

type ChannelType = keyof typeof CHANNELS_ICON;

// Best-effort preview text — internal chat messages are Slate documents,
// Captain messages are already plain strings.
function extractPreviewText(value: any): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) {
    try {
      return value
        .map((node: any) =>
          Array.isArray(node?.children) ? node.children.map((c: any) => c.text || '').join('') : '',
        )
        .join(' ')
        .trim();
    } catch {
      return '';
    }
  }
  if (typeof value === 'object' && typeof value.content === 'string') return value.content;
  return '';
}

/** The channel a row belongs to — this is the field the filter tabs match
    against, the same way Agent Chat's tabs match a chat's status. */
type RowChannel = 'chat' | 'website' | ChannelKey;

type MergedRow = {
  key: string;
  channel: RowChannel;
  name: string;
  preview: string;
  timestamp: number;
  raw: any;
  isDemo?: boolean;
};

/** Filter tabs shown under the header — one per channel, styled and driven
    exactly like Agent Chat's Unassigned/Active/Missed/Resolved tabs (see
    src/pages/agent-chat/index.tsx): a `selectedChannel` state, an
    active/inactive className switch, and the list below re-filtered from
    that one piece of state. No navigation, no route change. */
const CHANNEL_TABS: { value: 'all' | ChannelKey; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'facebook', label: 'Facebook' },
  { value: 'instagram', label: 'Instagram' },
  { value: 'whatsapp', label: 'WhatsApp' },
  { value: 'telegram', label: 'Telegram' },
];

/** Which `ChatListRow` variant renders each channel's rows, so each list
    reads like that platform's own inbox. */
const ROW_VARIANT: Record<string, 'messenger' | 'instagram' | 'whatsapp' | 'telegram'> = {
  facebook: 'messenger',
  instagram: 'instagram',
  whatsapp: 'whatsapp',
  telegram: 'telegram',
};

/**
 * "All Channels" tab — same header and list-row treatment as the Chat tab
 * (see `ChatPageHeader` / `ChatListRow`), merging internal chats, Captain
 * (website) conversations, and each social channel's conversations into one
 * list, filterable in place by the tabs below the header.
 */
const AllChannelsChats = ({
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
  const { allChats = [] } = useSocketEvents();
  const [searchQuery, setSearchQuery] = useState('');
  const [dateFilter, setDateFilter] = useState('All');
  // "all" is the default — the same convention as Agent Chat's tabs, where
  // one value drives which slice of the data is currently shown.
  const [selectedChannel, setSelectedChannel] = useState<'all' | ChannelKey>('all');

  const { data: captainConversations = [] } = useQuery({
    queryKey: ['captainConversations', user?.uuid],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (user?.uuid) params.set('agent_user_id', user.uuid);
      const res = await fetch(`${CAPTAIN_API_BASE}/messenger-conversations?${params.toString()}`);
      return res.json();
    },
    refetchInterval: 5000,
    select: (json: any) => json?.data ?? [],
  });

  const merged: MergedRow[] = useMemo(() => {
    const internalRows: MergedRow[] = (Array.isArray(allChats) ? allChats : [])
      .filter((chat: any) => !chat?.isDeleted)
      .map((chat: any) => {
        const otherUser = chat?.users?.find((u: any) => u?.uuid !== user?.uuid);
        const name = chat?.isGroupChat
          ? chat?.name || 'Group'
          : `${otherUser?.first_name || ''} ${otherUser?.last_name || ''}`.trim() || 'Unknown';
        const ts = chat?.lastMessage?.createdAt
          ? new Date(chat.lastMessage.createdAt).getTime()
          : chat?.createdAt
            ? new Date(chat.createdAt).getTime()
            : 0;
        return {
          key: `internal-${chat.chatId}`,
          channel: 'chat' as const,
          name,
          preview: extractPreviewText(chat?.lastMessage?.message) || 'Attachment',
          timestamp: ts,
          raw: chat,
        };
      });

    const captainRows: MergedRow[] = captainConversations.map((c: any) => ({
      key: `captain-${c.id}`,
      channel: 'website' as const,
      name: c.visitor_name || c.visitor_email || 'Website visitor',
      preview: c.last_message || '',
      timestamp: c.last_message_at ? new Date(c.last_message_at).getTime() : 0,
      raw: c,
    }));

    return [...internalRows, ...captainRows].sort((a, b) => b.timestamp - a.timestamp);
  }, [allChats, captainConversations, user?.uuid]);

  const isDemo = merged.length === 0;
  const demoRows: MergedRow[] = isDemo
    ? demoAllChannelsChats.map((d) => ({
        key: d.id,
        channel: d.kind === 'internal' ? ('chat' as const) : ('website' as const),
        name: d.name,
        preview: d.preview,
        timestamp: new Date(d.timestamp).getTime(),
        raw: { id: d.id, chatId: d.id, isDemo: true },
        isDemo: true,
      }))
    : [];

  // The four social channels' own conversations — sample data until each is
  // wired to its real feed. Always present (not gated on `isDemo`) so
  // clicking Facebook/Instagram/WhatsApp/Telegram always has something to
  // show, per channel, instead of reusing one generic placeholder set.
  const channelDemoRows: MergedRow[] = demoChannelChats.map((d) => ({
    key: d.id,
    channel: d.channel,
    name: d.name,
    preview: d.preview,
    timestamp: new Date(d.timestamp).getTime(),
    raw: { id: d.id, chatId: d.id, name: d.name, preview: d.preview, isDemo: true },
    isDemo: true,
  }));

  const rows = [...(isDemo ? demoRows : merged), ...channelDemoRows].sort(
    (a, b) => b.timestamp - a.timestamp,
  );

  const filteredRows = useMemo(() => {
    const byChannel =
      selectedChannel === 'all' ? rows : rows.filter((r) => r.channel === selectedChannel);
    const q = searchQuery.trim().toLowerCase();
    const byName = q ? byChannel.filter((r) => r.name.toLowerCase().includes(q)) : byChannel;

    if (dateFilter === 'All') return byName;
    const { from, to } = handleDate(dateFilter);
    if (!from || !to) return byName;
    const rangeStart = new Date(`${from}T00:00:00`).getTime();
    const rangeEnd = new Date(`${to}T23:59:59.999`).getTime();
    return byName.filter((r) => r.timestamp >= rangeStart && r.timestamp <= rangeEnd);
  }, [rows, selectedChannel, searchQuery, dateFilter]);

  const channelLabel = CHANNEL_TABS.find((t) => t.value === selectedChannel)?.label || 'All';

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
              item.value === 'all_channels' ? 'bg-gray-100 text-gray-900' : ''
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
        title="All Channels"
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        searchPlaceholder="Search conversations…"
        actions={
          <>
            {dateMenu}
            {filterMenu}
          </>
        }
      />

      {/* Channel filter tabs — same pattern as Agent Chat's
          Unassigned/Active/Missed/Resolved tabs: one active value, the list
          below re-filters from it, nothing navigates. */}
      <div className="border-b border-mcm-line px-3.5 pb-1.5 pt-0">
        <div className="flex flex-wrap items-center gap-6">
          {CHANNEL_TABS.map((tab) => {
            const isActive = selectedChannel === tab.value;
            return (
              <button
                key={tab.value}
                type="button"
                title={tab.label}
                aria-label={tab.label}
                className={`mcm-channel-tab inline-flex shrink-0 cursor-pointer items-center justify-center rounded-full transition-colors ${
                  isActive
                    ? 'bg-[#0b1220] text-white'
                    : 'bg-[#f5f5f5] text-[#64748b] hover:bg-red-50 hover:text-primary'
                }`}
                onClick={() => setSelectedChannel(tab.value)}
              >
                {tab.value !== 'all' ? (
                  <span className="mcm-channel-tab-icon">{CHANNELS_ICON[tab.value]}</span>
                ) : (
                  <span className="text-[13px] font-bold">All</span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {isDemo || selectedChannel !== 'all' ? (
        <div className="flex items-center gap-2 px-3.5 pb-1 pt-2">
          <span className="inline-flex items-center gap-1 rounded-md border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-[9.5px] font-bold uppercase tracking-wide text-amber-700">
            Demo data
          </span>
          <span className="text-[11px] font-medium text-gray-400">
            {selectedChannel === 'all'
              ? 'no conversations yet — showing samples'
              : `sample ${channelLabel} conversations`}
          </span>
        </div>
      ) : null}

      <div className="flex h-full min-h-0 flex-1 flex-col overflow-y-auto">
        {filteredRows.length ? (
          filteredRows.map((row) => {
            const isActive =
              row.channel === 'chat'
                ? selectedChat?.chatId === row.raw.chatId
                : selectedChat?.id === row.raw.id;
            return (
              <ChatListRow
                key={row.key}
                name={row.name}
                preview={row.preview}
                timestamp={row.timestamp}
                isActive={isActive}
                variant={ROW_VARIANT[row.channel] || 'default'}
                onClick={() => setSelectedChat({ ...row.raw, __channelKind: row.channel })}
                badge={
                  row.channel === 'website' ? (
                    <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">
                      <Globe className="h-2.5 w-2.5" />
                      Website
                    </span>
                  ) : null
                }
              />
            );
          })
        ) : (
          <div className="flex h-full items-center justify-center p-6 text-center text-sm text-gray-400">
            {selectedChannel === 'all'
              ? 'No conversations found'
              : `No ${channelLabel} conversations found`}
          </div>
        )}
      </div>
    </div>
  );
};

export default AllChannelsChats;
