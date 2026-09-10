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
import { demoAllChannelsChats } from '../demo-data';

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

type MergedRow = {
  key: string;
  kind: 'internal' | 'captain';
  name: string;
  preview: string;
  timestamp: number;
  raw: any;
};

/**
 * "All Channels" tab — same header and list-row treatment as the Chat tab
 * (see `ChatPageHeader` / `ChatListRow`), merging internal chats and Captain
 * (website) conversations into one list.
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
          kind: 'internal',
          name,
          preview: extractPreviewText(chat?.lastMessage?.message) || 'Attachment',
          timestamp: ts,
          raw: chat,
        };
      });

    const captainRows: MergedRow[] = captainConversations.map((c: any) => ({
      key: `captain-${c.id}`,
      kind: 'captain',
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
        kind: d.kind,
        name: d.name,
        preview: d.preview,
        timestamp: new Date(d.timestamp).getTime(),
        raw: { id: d.id, chatId: d.id, isDemo: true },
      }))
    : [];

  const rows = isDemo ? demoRows : merged;

  const filteredRows = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => r.name.toLowerCase().includes(q));
  }, [rows, searchQuery]);

  const filterMenu = handleChatType ? (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button type="button" className="mcm-chat-iconbtn" aria-label="Filter">
          <FilterIcon className="h-3.75 w-3.75" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        {ChatChannels?.map((item: any, index: number) => (
          <DropdownMenuItem
            key={index}
            className={`cursor-pointer transition-colors focus:bg-[#fff1f2] focus:text-primary ${
              item.value === 'all_channels' ? 'bg-gray-100' : ''
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

  return (
    <div className="flex h-full min-h-0 w-full flex-col bg-white">
      <ChatPageHeader
        title="All Channels"
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        searchPlaceholder="Search conversations…"
        actions={filterMenu}
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
        {filteredRows.length ? (
          filteredRows.map((row) => {
            const isActive =
              row.kind === 'internal'
                ? selectedChat?.chatId === row.raw.chatId
                : selectedChat?.id === row.raw.id;
            return (
              <ChatListRow
                key={row.key}
                name={row.name}
                preview={row.preview}
                timestamp={row.timestamp}
                isActive={isActive}
                onClick={() => setSelectedChat({ ...row.raw, __channelKind: row.kind })}
                badge={
                  row.kind === 'captain' ? (
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
            No conversations found
          </div>
        )}
      </div>
    </div>
  );
};

export default AllChannelsChats;
