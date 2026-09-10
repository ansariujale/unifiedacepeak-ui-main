import { SearchLine } from '@/assets/icons';
import EmojiPicker from 'emoji-picker-react';
import CustomAvatar from '@/components/custom/custom-avatar';
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer';
import { useSocketEvents } from '@/hooks/use-socket-events';
import { useUser } from '@/hooks/use-user';
import { demoAgentChats, demoAgentMessages } from './demo-data';
import DateRangeMenu from '@/components/custom/date-range-menu';
import moment from 'moment';
import {
  Pin,
  CircleCheck,
  ArrowLeft,
  CircleAlert,
  Monitor,
  Smile,
  SendHorizontal,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import AgentChat from './components/agent-chat';
import VisitorProfile from './components/visitor-profile';

type AgentChatTab = 'unassigned' | 'active' | 'missed' | 'resolved';
type AgentChatDateRange = 'all' | 'today' | '7_days' | '30_days';
const AGENT_CHAT_REQUEST_ACCEPTED_EVENT = 'agent-chat:request-accepted';

const AGENT_CHAT_TABS: AgentChatTab[] = ['unassigned', 'active', 'missed', 'resolved'];
const AGENT_CHAT_DATE_OPTIONS: Array<{ label: string; value: AgentChatDateRange }> = [
  { label: 'All', value: 'all' },
  { label: 'Today', value: 'today' },
  { label: 'Last 7 Days', value: '7_days' },
  { label: 'Last 30 Days', value: '30_days' },
];

const getAgentChatTabFromQuery = (value: string | null): AgentChatTab => {
  const normalized = `${value || ''}`.toLowerCase();
  return AGENT_CHAT_TABS.includes(normalized as AgentChatTab)
    ? (normalized as AgentChatTab)
    : 'unassigned';
};

const getChatTimestamp = (chat: any) => {
  if (chat?.lastMessage?.createdAt) return new Date(chat.lastMessage.createdAt).getTime();
  if (chat?.metaData?.lastMessageTimeStamp)
    return new Date(chat.metaData.lastMessageTimeStamp).getTime();
  if (chat?.createdAt) return new Date(chat.createdAt).getTime();
  return -Infinity;
};

const getSimpleDateString = (dateString?: string) => {
  if (!dateString) return '';
  const date = moment(dateString);
  if (!date.isValid()) return '';

  if (date.isSame(moment(), 'day')) return date.format('HH:mm');
  if (date.isSame(moment().subtract(1, 'day'), 'day')) return 'Yesterday';
  if (date.isSame(moment(), 'year')) return date.format('MMM D');
  return date.format('MMM D, YYYY');
};

const getSidebarRelativeTime = (dateString?: string) => {
  if (!dateString) return '';
  const date = moment(dateString);
  if (!date.isValid()) return '';

  const diffMinutes = moment().diff(date, 'minutes');
  if (diffMinutes <= 1) return 'Just now';
  if (diffMinutes < 60) return `${diffMinutes}m ago`;

  const diffHours = moment().diff(date, 'hours');
  if (diffHours < 24) return `${diffHours}h ago`;

  return getSimpleDateString(dateString);
};

const getAgentChatDateRange = (range: AgentChatDateRange) => {
  const today = moment();
  // "All" fetches everything up to today, so no start bound.
  if (range === 'all') {
    return {
      start_date: today.clone().subtract(10, 'years').format('YYYY-MM-DD'),
      end_date: today.format('YYYY-MM-DD'),
    };
  }
  const daysBack = range === '30_days' ? 29 : range === '7_days' ? 6 : 0;

  return {
    start_date: today.clone().subtract(daysBack, 'days').format('YYYY-MM-DD'),
    end_date: today.format('YYYY-MM-DD'),
  };
};

const isTimestampWithinDateRange = (dateString: string | undefined, range: AgentChatDateRange) => {
  if (range === 'all') return true;
  if (!dateString) return false;
  const date = moment(dateString);
  if (!date.isValid()) return false;

  const { start_date, end_date } = getAgentChatDateRange(range);
  return date.isBetween(
    moment(start_date, 'YYYY-MM-DD').startOf('day'),
    moment(end_date, 'YYYY-MM-DD').endOf('day'),
    undefined,
    '[]',
  );
};

const extractMessageText = (value: any): string => {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return String(value).trim();
  }

  if (Array.isArray(value)) {
    return value
      .map((item) => extractMessageText(item))
      .filter(Boolean)
      .join(' ')
      .trim();
  }

  if (typeof value === 'object') {
    if (typeof value?.text === 'string') return value.text.trim();
    if (typeof value?.message === 'string') return value.message.trim();
    if (typeof value?.value === 'string') return value.value.trim();
    if (Array.isArray(value?.children)) return extractMessageText(value.children);
    if (Array.isArray(value?.content)) return extractMessageText(value.content);
  }

  return '';
};

const getMessagePreviewText = (value: any): string => {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return '';
    try {
      const parsed = JSON.parse(trimmed);
      const fromParsed = extractMessageText(parsed);
      return fromParsed || trimmed;
    } catch {
      return trimmed;
    }
  }

  return extractMessageText(value);
};

const isConversationPinnedForUser = (chat: any, userId?: string) => {
  if (!chat || !userId) return false;

  const metaPinnedBy = chat?.metaData?.pinnedBy;
  if (Array.isArray(metaPinnedBy)) {
    const isPinnedFromMeta = metaPinnedBy.some((item: any) => {
      if (typeof item === 'string') return item === userId;
      return item?.uuid === userId;
    });
    if (isPinnedFromMeta) return true;
  }

  const candidatePinnedLists = [
    chat?.pinnedConversation,
    chat?.pinnedConversations,
    chat?.pinnedChats,
    chat?.pinnedBy,
    chat?.pinnedUsers,
    chat?.conversationPinnedBy,
  ];

  for (const pinnedList of candidatePinnedLists) {
    if (Array.isArray(pinnedList) && pinnedList.includes(userId)) return true;
  }

  if (typeof chat?.isPinnedConversation === 'boolean') return chat.isPinnedConversation;
  if (typeof chat?.isConversationPinned === 'boolean') return chat.isConversationPinned;
  if (typeof chat?.isPinned === 'boolean') return chat.isPinned;

  return false;
};

const tabOptions: Array<{ label: string; value: AgentChatTab }> = [
  { label: 'Unassigned', value: 'unassigned' },
  { label: 'Active', value: 'active' },
  { label: 'Missed', value: 'missed' },
  { label: 'Resolved', value: 'resolved' },
];

const getPinnedAtTimestampForUser = (chat: any, userId?: string) => {
  if (!chat || !userId) return 0;

  const metaPinnedBy = Array.isArray(chat?.metaData?.pinnedBy) ? chat.metaData.pinnedBy : [];
  const metaPinEntry = metaPinnedBy.find((item: any) => item?.uuid === userId);
  if (metaPinEntry?.pinnedAt) {
    const ts = new Date(metaPinEntry.pinnedAt).getTime();
    if (Number.isFinite(ts)) return ts;
  }

  const genericPinLists = [chat?.pinnedBy, chat?.pinnedUsers, chat?.conversationPinnedBy];
  for (const list of genericPinLists) {
    if (!Array.isArray(list)) continue;
    const entry = list.find((item: any) => item?.uuid === userId && item?.pinnedAt);
    if (entry?.pinnedAt) {
      const ts = new Date(entry.pinnedAt).getTime();
      if (Number.isFinite(ts)) return ts;
    }
  }

  return 0;
};

const NotificationBadge = ({ count = 0 }: { count?: number }) => {
  if (!count) return null;
  return (
    <span className="bg-destructive min-w-[14px] h-[14px] px-1 rounded-full flex items-center justify-center text-white text-[9px] font-bold border-2 border-white leading-none">
      {count > 99 ? '99+' : count}
    </span>
  );
};

const SidebarAvatar = ({
  name,
  image,
  unreadCount,
}: {
  name: string;
  image?: string;
  unreadCount?: number;
}) => {
  return (
    <div className="relative h-11 w-11 shrink-0">
      <CustomAvatar name={name || 'Unknown'} image={image || ''} size="44" isActivityInfo={false} />
      <div className="absolute -right-0.5 -top-1">
        <NotificationBadge count={unreadCount} />
      </div>
    </div>
  );
};

const getPendingRequestVisitor = (request: any, currentUserId?: string) => {
  const rawUsers = request?.users;
  const userList = Array.isArray(rawUsers) ? rawUsers : rawUsers ? [rawUsers] : [];
  const targetUser =
    userList.find((item: any) => item?.uuid && item?.uuid !== currentUserId) ||
    userList.find((item: any) => item?.name || item?.email) ||
    rawUsers;

  const fullName = `${targetUser?.first_name || ''} ${targetUser?.last_name || ''}`.trim();
  const displayName = targetUser?.name || fullName || 'Unknown Visitor';

  return {
    displayName,
    avatar: targetUser?.profile || targetUser?.avatar || '',
    requestedAt:
      request?.createdAt ||
      request?.requestedAt ||
      request?.timestamp ||
      request?.requestTime ||
      '',
  };
};

const PendingRequestItem = ({
  request,
  currentUserId,
  isSelected,
  onSelect,
  activeTab,
}: {
  request: any;
  currentUserId?: string;
  isSelected?: boolean;
  onSelect: (request: any) => void;
  activeTab?: string;
}) => {
  const { displayName, avatar, requestedAt } = getPendingRequestVisitor(request, currentUserId);
  const relativeTime = getSidebarRelativeTime(requestedAt) || 'Just now';

  return (
    <div className="px-3">
      <button
        type="button"
        onClick={() => onSelect(request)}
        className={`min-h-[84px] w-full cursor-pointer rounded-[12px] px-3 py-[10px] text-left transition-colors duration-200 ${
          isSelected ? 'bg-ucass-active-bg' : 'bg-transparent hover:bg-muted'
        }`}
      >
        <div className="flex items-start gap-3">
          <div className="relative h-11 w-11 shrink-0">
            <CustomAvatar
              name={displayName || 'Unknown Visitor'}
              image={avatar || ''}
              size="44"
              isActivityInfo={false}
            />
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-2">
              <div className="truncate text-[15px] leading-[18px] font-bold text-foreground">
                {displayName}
              </div>
              <div className="shrink-0 text-[11px] font-semibold leading-[18px] text-ucass-active">
                {relativeTime}
              </div>
            </div>

            <div className="mt-0.5 truncate text-[14px] leading-[18px] text-foreground">
              Waiting for an available agent...
            </div>

            {activeTab === 'missed' ? null : (
              <div className="mt-2 inline-flex items-center gap-1 rounded-full border border-destructive/30 bg-destructive/10 px-2 py-[2px] text-[11px] leading-none font-semibold text-destructive">
                <CircleAlert className="h-3 w-3" />
                <span>Response Overdue</span>
              </div>
            )}
          </div>
        </div>
      </button>
    </div>
  );
};

const ListItem = ({
  chat,
  onChatSelect,
  activeTab,
}: {
  chat: any;
  onChatSelect: (chat: any) => void;
  activeTab?: string;
}) => {
  const { user } = useUser();
  const [searchParams] = useSearchParams();
  const { typingList, chatWindows } = useSocketEvents();

  const chatIdFromQuery = searchParams.get('chatId') || '';
  const isGroupChat = !!chat?.isGroupChat;
  const isOwnChat = chat?.chatId === user?.uuid;
  const isConversationPinned = isConversationPinnedForUser(chat, user?.uuid);
  const otherUserData = chat?.users?.find((chatUser: any) => chatUser?.uuid !== user?.uuid);
  const myData = chat?.users?.find((chatUser: any) => chatUser?.uuid === user?.uuid);
  const unreadMsgCount = myData?.unreadMsg || 0;
  const avatarImage = isGroupChat
    ? chat?.avatar || ''
    : isOwnChat
      ? myData?.profile || ''
      : otherUserData?.profile || '';

  // Show "Response Overdue" in active tab only when the last message was sent by the OTHER USER (visitor),
  // meaning my (agent) reply is still pending — visitor is waiting for my response
  const lastMessageSenderId = chat?.lastMessage?.senderId;
  const showOverdueBadge =
    activeTab === 'active' && !!lastMessageSenderId && lastMessageSenderId !== user?.uuid;

  const getUserDisplayName = (chatUser: any) => {
    if (!chatUser) return '';
    if (chatUser?.name) return chatUser.name;
    return `${chatUser?.first_name || ''} ${chatUser?.last_name || ''}`.trim();
  };

  const nameToShow = isGroupChat
    ? chat?.name || 'Group'
    : isOwnChat
      ? `${user?.first_name || ''} ${user?.last_name || ''}`.trim()
      : getUserDisplayName(otherUserData) || 'Unknown';

  const typingUsers = Array.isArray(typingList?.[chat?.chatId]) ? typingList[chat.chatId] : [];
  const isTyping = typingUsers.length > 0;

  const typingText = useMemo(() => {
    if (!isTyping) return '';

    if (isGroupChat) {
      const names = (chat?.users || [])
        .filter((u: any) => typingUsers.includes(u?.uuid))
        .map((u: any) => getUserDisplayName(u))
        .filter(Boolean);
      return names.length ? `${names.join(', ')} typing...` : 'Typing...';
    }
    return 'Typing...';
  }, [isTyping, isGroupChat, chat?.users, typingUsers]);

  const lastMessageText = useMemo(() => {
    const rawMessage =
      chat?.lastMessage?.message || chat?.metaData?.lastMessage || chat?.lastMessage;
    const preview = getMessagePreviewText(rawMessage);
    if (preview && preview !== '') return preview;

    return Array.isArray(chat?.lastMessage?.attachments) && chat.lastMessage.attachments.length
      ? 'Attachment'
      : '';
  }, [
    chat?.metaData?.lastMessage,
    chat?.lastMessage?.message,
    chat?.lastMessage,
    chat?.lastMessage?.attachments,
  ]);

  function handleClickItem(selectedChat: any) {
    onChatSelect(selectedChat);
    // console.log(selectedChat?.lastMessage, 'selectedChatselectedChat', user.uuid);
  }

  return (
    <div key={chat?.chatId} className="px-3" onClick={() => handleClickItem(chat)}>
      <div
        className={`min-h-[68px] w-full cursor-pointer rounded-[12px] px-3 py-[10px] transition-colors duration-200 ${
          chatIdFromQuery === chat?.chatId || chatWindows?.includes(chat?.chatId)
            ? 'bg-ucass-active-bg'
            : 'bg-transparent hover:bg-muted'
        }`}
      >
        <div className="flex items-center gap-3">
          <SidebarAvatar name={nameToShow || ''} image={avatarImage} unreadCount={unreadMsgCount} />
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex items-center gap-1.5">
                <div className="truncate text-[15px] leading-[18px] font-bold text-foreground">
                  {nameToShow || ''}
                </div>
                {isConversationPinned ? (
                  <Pin className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                ) : null}
              </div>
              {(chat?.lastMessage?.createdAt || chat?.metaData?.lastMessageTimeStamp) && (
                <div
                  className={`shrink-0 text-[12px] font-medium leading-[18px] ${getSidebarRelativeTime(chat?.lastMessage?.createdAt || chat?.metaData?.lastMessageTimeStamp) === 'Just now' ? 'text-ucass-active' : 'text-muted-foreground'}`}
                >
                  {getSidebarRelativeTime(
                    chat?.lastMessage?.createdAt || chat?.metaData?.lastMessageTimeStamp,
                  )}
                </div>
              )}
            </div>
            {isOwnChat ? (
              <div className="mt-1 truncate text-[13px] leading-[18px] text-muted-foreground italic">
                (You)
              </div>
            ) : (
              <div
                className={`mt-1 truncate text-[13px] leading-[18px] ${isTyping ? 'text-ucass-active' : 'text-foreground'}`}
              >
                {isTyping ? typingText : lastMessageText || 'No message yet'}
              </div>
            )}
            {showOverdueBadge && (
              <div className="mt-1.5 inline-flex items-center gap-1 rounded-full border border-destructive/30 bg-destructive/10 px-2 py-[2px] text-[11px] leading-none font-semibold text-destructive">
                <CircleAlert className="h-3 w-3" />
                <span>Response Overdue</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

/**
 * A read-only sample conversation, shown when a demo row in the queue is
 * opened. Deliberately not the real `AgentChat`: there is no chat id behind a
 * sample, so the socket layer has nothing to load and the composer has nowhere
 * to send. It says so rather than offering a box that silently does nothing.
 */
const DemoConversation = ({
  chat,
  onBack,
  onOpenProfile,
  onResolve,
}: {
  chat: any;
  onBack: () => void;
  onOpenProfile?: () => void;
  onResolve?: () => void;
}) => {
  const visitor = chat?.users?.[0];
  const name = `${visitor?.first_name || ''} ${visitor?.last_name || ''}`.trim() || 'Visitor';
  const messages = demoAgentMessages(chat?.chatId || '');
  const [draft, setDraft] = useState('');
  const [emojiOpen, setEmojiOpen] = useState(false);
  const device = String(chat?.metaData?.device || '').trim();
  const domain = (() => {
    const page = String(chat?.metaData?.page || '').trim();
    if (!page) return '';
    try {
      return new URL(page).host.replace(/^www\./, '');
    } catch {
      return page.replace(/^https?:\/\//, '').split('/')[0];
    }
  })();

  return (
    <div className="flex h-full min-h-0 w-full flex-col bg-white">
      {/* Header: identity + device/domain subline on the left, actions on the
          right — mirroring the richer conversation layout. */}
      <div className="flex min-h-16 shrink-0 items-center gap-3 border-b border-gray-200 px-4 py-3">
        <button
          type="button"
          onClick={onBack}
          className="flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-full text-gray-500 hover:bg-gray-100 lg:hidden"
          aria-label="Back to queue"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <CustomAvatar name={name} size="38" />
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onOpenProfile}
              title="View visitor profile"
              className="truncate text-sm font-semibold text-gray-900 transition-colors hover:text-primary hover:underline"
            >
              {name}
            </button>
            <span className="shrink-0 rounded-md border border-gray-200 bg-gray-100 px-1.5 py-0.5 text-[9.5px] font-bold uppercase tracking-wide text-gray-500">
              Demo
            </span>
          </div>
          <div className="mt-0.5 flex items-center gap-1.5 truncate text-xs text-gray-500">
            {device ? <Monitor className="h-3.5 w-3.5 shrink-0" /> : null}
            <span className="truncate">
              {device}
              {device && domain ? '  |  ' : ''}
              {domain}
            </span>
          </div>
        </div>
        <div className="ml-auto flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={onResolve}
            title="Mark this conversation resolved"
            className="inline-flex items-center gap-1.5 rounded-full bg-primary px-3.5 py-1.5 text-[13px] font-semibold text-white transition-colors hover:brightness-110"
          >
            <CircleCheck className="h-4 w-4" />
            Resolve
          </button>
        </div>
      </div>

      {/* Messages: a flat log — sender + time above each bordered bubble. */}
      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto bg-white p-4">
        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex w-full flex-col ${message.fromVisitor ? 'items-start' : 'items-end'}`}
          >
            <div className="mb-1 flex items-baseline gap-2">
              <span className="text-[13px] font-semibold text-gray-900">
                {message.fromVisitor ? name : 'You'}
              </span>
              <span className="text-[11px] text-gray-400">{message.at}</span>
            </div>
            <div
              className={`max-w-[78%] rounded-xl px-3 py-2 text-[13px] leading-5 shadow-[0_1px_2px_rgba(17,17,17,0.04)] ${
                message.fromVisitor
                  ? 'border border-gray-200 bg-white text-gray-800'
                  : 'bg-primary text-white'
              }`}
            >
              {message.text}
            </div>
          </div>
        ))}
      </div>

      {/* Composer styled like the live one, but inert on a sample. */}
      <div className="shrink-0 border-t border-gray-200 p-3">
        <div className="flex items-center gap-2 rounded-2xl border border-gray-200 bg-white px-4 py-3 focus-within:border-primary">
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                setDraft('');
              }
            }}
            placeholder="Type a message…"
            className="min-w-0 flex-1 bg-transparent text-[13px] text-gray-900 outline-none placeholder:text-gray-400"
          />
          <div className="relative shrink-0">
            <button
              type="button"
              onClick={() => setEmojiOpen((v) => !v)}
              className={`flex h-7 w-7 items-center justify-center rounded-full hover:text-gray-600 ${
                emojiOpen ? 'text-primary' : 'text-gray-400'
              }`}
              aria-label="Emoji"
              aria-expanded={emojiOpen}
            >
              <Smile className="h-4.5 w-4.5" />
            </button>
            {emojiOpen ? (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setEmojiOpen(false)} aria-hidden />
                <div className="absolute bottom-10 right-0 z-50 overflow-hidden rounded-lg shadow-xl">
                  <EmojiPicker
                    lazyLoadEmojis
                    searchDisabled={false}
                    previewConfig={{ showPreview: false }}
                    height={300}
                    width={300}
                    onEmojiClick={(data: any) => setDraft((prev) => prev + (data?.emoji || ''))}
                  />
                </div>
              </>
            ) : null}
          </div>
          <button
            type="button"
            onClick={() => setDraft('')}
            disabled={!draft.trim()}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-white transition-opacity disabled:opacity-40"
            aria-label="Send"
          >
            <SendHorizontal className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
};

const SidebarContent = ({
  activeTab,
  setActiveTab,
  selectedPendingRequestId,
  setSelectedPendingRequestId,
  isCompactLayout,
  onDemoChatSelect,
  selectedDemoChatId,
  resolvedDemoIds = [],
}: {
  activeTab: AgentChatTab;
  setActiveTab: (tab: AgentChatTab) => void;
  selectedPendingRequestId: string;
  setSelectedPendingRequestId: (chatId: string) => void;
  isCompactLayout: boolean;
  /** Selecting a sample opens a sample conversation — there is no real chat
      behind it, so the page handles it rather than the socket layer. */
  onDemoChatSelect?: (chat: any) => void;
  selectedDemoChatId?: string;
  /** Demo chats the agent has "Resolved" — moved to the Resolved tab. */
  resolvedDemoIds?: string[];
}) => {
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [dateRange, setDateRange] = useState<AgentChatDateRange>('today');

  const {
    allAgentChats = [],
    chatWindows,
    setChatWindows,
    handleOpenChatInWindow,
    handleUnread,
    aiChatRequests = [],
    getAgentChats,
  } = useSocketEvents();

  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useUser();

  useEffect(() => {
    if (!user?.uuid) return;

    const { start_date, end_date } = getAgentChatDateRange(dateRange);
    getAgentChats({
      start_date,
      end_date,
    });
  }, [dateRange, getAgentChats, user?.uuid]);

  const visibleChats = useMemo(
    () =>
      (Array.isArray(allAgentChats) ? allAgentChats : []).filter((chat: any) => {
        const chatTimestamp =
          chat?.lastMessage?.createdAt || chat?.metaData?.lastMessageTimeStamp || chat?.createdAt;

        return (
          !chat?.isHidden?.includes(user?.uuid) &&
          !chat?.isDeleted &&
          chat?.groupType === 'AI' &&
          isTimestampWithinDateRange(chatTimestamp, dateRange)
        );
      }),
    [allAgentChats, user?.uuid, dateRange],
  );

  useEffect(() => {
    const channelIds = visibleChats.map((chat: any) => chat?.chatId);
    const newWindows = (Array.isArray(chatWindows) ? chatWindows : []).filter((item: string) =>
      channelIds.includes(item),
    );

    if (JSON.stringify(newWindows) !== JSON.stringify(chatWindows || [])) {
      setChatWindows(newWindows);
    }
  }, [visibleChats, chatWindows, setChatWindows]);

  const onChatSelect = (selectedChat: any) => {
    const selectedChatId = selectedChat?.chatId || '';
    if (!selectedChatId) return;
    setSelectedPendingRequestId('');

    const myData = selectedChat?.users?.find((u: any) => u?.uuid === user?.uuid);
    if (myData?.unreadMsg > 0) {
      handleUnread({ chatId: selectedChatId, type: 'read' }, true);
    }

    handleOpenChatInWindow(selectedChatId);
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set('chatId', selectedChatId);
      next.set('type', activeTab);
      return next;
    });
  };

  const onPendingRequestSelect = useCallback(
    (request: any) => {
      const chatId = request?.chatId || '';
      if (!chatId) return;
      setSelectedPendingRequestId(chatId);
      setChatWindows([]);
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        next.delete('chatId');
        next.set('type', activeTab);
        return next;
      });
    },
    [activeTab, setChatWindows, setSearchParams, setSelectedPendingRequestId],
  );

  const getChatDisplayName = (chat: any) => {
    if (chat?.isGroupChat) return chat?.name || '';
    if (chat?.chatId === user?.uuid) {
      const me = chat?.users?.find((u: any) => u?.uuid === user?.uuid);
      return me?.name || `${user?.first_name || ''} ${user?.last_name || ''}`.trim();
    }
    const otherUser = chat?.users?.find((u: any) => u?.uuid !== user?.uuid);
    return otherUser?.name || `${otherUser?.first_name || ''} ${otherUser?.last_name || ''}`.trim();
  };

  const filterByName = (arr: any[]) => {
    const normalizedQuery = searchQuery.trim().toLowerCase();
    if (!normalizedQuery) return arr || [];

    return (arr || []).filter((chat: any) => {
      return getChatDisplayName(chat).toLowerCase().includes(normalizedQuery);
    });
  };

  const groupList = useMemo(() => {
    const sortByPinnedAndTime = (arr: any[]) =>
      [...arr].sort((a: any, b: any) => {
        const aPinned = isConversationPinnedForUser(a, user?.uuid);
        const bPinned = isConversationPinnedForUser(b, user?.uuid);

        if (aPinned && bPinned) {
          const aPinnedAt = getPinnedAtTimestampForUser(a, user?.uuid);
          const bPinnedAt = getPinnedAtTimestampForUser(b, user?.uuid);
          if (aPinnedAt !== bPinnedAt) return bPinnedAt - aPinnedAt;
        } else if (aPinned !== bPinned) {
          return aPinned ? -1 : 1;
        }

        return getChatTimestamp(b) - getChatTimestamp(a);
      });

    let filtered = filterByName(visibleChats);

    if (activeTab === 'unassigned') {
      filtered = [];
    } else if (activeTab === 'active') {
      filtered = filtered.filter((chat) => !chat?.isEnded);
    } else if (activeTab === 'missed') {
      filtered = filtered.filter((chat) => chat?.metaData?.status === 'missed');
    } else if (activeTab === 'resolved') {
      filtered = filtered.filter((chat) => chat?.isEnded);
    }

    return [
      {
        id: 1,
        label: '',
        shouldVisible: true,
        data: sortByPinnedAndTime(filtered),
      },
    ];
  }, [activeTab, visibleChats, searchQuery, user?.uuid]);

  const tabCounts = useMemo(() => {
    const source = Array.isArray(visibleChats) ? visibleChats : [];
    const aiRequests = Array.isArray(aiChatRequests) ? aiChatRequests : [];
    const dateFilteredAiRequests = aiRequests.filter((request: any) =>
      isTimestampWithinDateRange(
        getPendingRequestVisitor(request, user?.uuid)?.requestedAt,
        dateRange,
      ),
    );
    // With no real chats or requests, the queue shows samples — so the KPI
    // tiles count the demo data (minus anything the agent has resolved).
    if (source.length === 0 && aiRequests.length === 0) {
      const resolvedSet = new Set(resolvedDemoIds);
      const open = (t: AgentChatTab) =>
        demoAgentChats(t).filter((c) => !resolvedSet.has(c.chatId)).length;
      return {
        unassigned: open('unassigned'),
        active: open('active'),
        missed: open('missed'),
        resolved: resolvedDemoIds.length,
      };
    }
    return {
      unassigned: aiRequests.filter((r: any) => r?.status === 'pending').length,
      active: source.filter((chat: any) => !chat?.isEnded).length,
      missed:
        source.filter((chat: any) => chat?.metaData?.status === 'missed').length +
        dateFilteredAiRequests.filter((r: any) => r?.status === 'abandoned').length,
      resolved: source.filter((chat: any) => chat?.isEnded).length,
    };
  }, [visibleChats, aiChatRequests, user?.uuid, dateRange, resolvedDemoIds]);

  const filteredPendingRequests = useMemo(() => {
    if (activeTab !== 'unassigned' && activeTab !== 'missed') return [];
    const source = Array.isArray(aiChatRequests) ? aiChatRequests : [];
    const statusFilter = activeTab === 'unassigned' ? 'pending' : 'abandoned';
    const byStatus = source.filter((r: any) => {
      const requestedAt = getPendingRequestVisitor(r, user?.uuid)?.requestedAt;
      return (
        r?.status === statusFilter &&
        (activeTab === 'unassigned' || isTimestampWithinDateRange(requestedAt, dateRange))
      );
    });

    const normalizedQuery = searchQuery.trim().toLowerCase();
    let result = byStatus;

    if (normalizedQuery) {
      result = byStatus.filter((request: any) => {
        const { displayName } = getPendingRequestVisitor(request, user?.uuid);
        const searchBlob = [
          displayName,
          request?.chatId || '',
          request?.domain || '',
          request?.users?.email || '',
        ]
          .join(' ')
          .toLowerCase();
        return searchBlob.includes(normalizedQuery);
      });
    }

    // Sort so the latest requests are on top
    return result.sort((a: any, b: any) => {
      const timeA = getPendingRequestVisitor(a, user?.uuid)?.requestedAt;
      const timeB = getPendingRequestVisitor(b, user?.uuid)?.requestedAt;
      const dateA = timeA ? new Date(timeA).getTime() : 0;
      const dateB = timeB ? new Date(timeB).getTime() : 0;
      return dateB - dateA;
    });
  }, [activeTab, aiChatRequests, searchQuery, user?.uuid, dateRange]);

  useEffect(() => {
    if (isCompactLayout) return;
    if (activeTab !== 'unassigned' && activeTab !== 'missed') return;
    if (!filteredPendingRequests.length) {
      if (selectedPendingRequestId) {
        setSelectedPendingRequestId('');
        setSearchParams((prev) => {
          const next = new URLSearchParams(prev);
          next.delete('chatId');
          return next;
        });
      }
      return;
    }

    const selectedExists = filteredPendingRequests.some(
      (request: any) => request?.chatId === selectedPendingRequestId,
    );
    if (!selectedExists) {
      onPendingRequestSelect(filteredPendingRequests[0]);
    }
  }, [
    activeTab,
    filteredPendingRequests,
    onPendingRequestSelect,
    selectedPendingRequestId,
    setSearchParams,
    setSelectedPendingRequestId,
    isCompactLayout,
  ]);

  const emptyMessenger = useMemo(
    () =>
      groupList.every((group) => group.data.length === 0) && filteredPendingRequests.length === 0,
    [groupList, filteredPendingRequests.length],
  );

  /* Samples for whichever tab is showing, only while it has nothing real.
     Resolved samples move out of their original tab into "Resolved". */
  const demoChats = useMemo(() => {
    if (!emptyMessenger) return [];
    const resolvedSet = new Set(resolvedDemoIds);
    if (activeTab === 'resolved') {
      return [
        ...demoAgentChats('unassigned'),
        ...demoAgentChats('active'),
        ...demoAgentChats('missed'),
      ].filter((c) => resolvedSet.has(c.chatId));
    }
    return demoAgentChats(activeTab).filter((c) => !resolvedSet.has(c.chatId));
  }, [emptyMessenger, activeTab, resolvedDemoIds]);

  const [isSearchOpen, setIsSearchOpen] = useState(false);

  const prevTabRef = useRef(activeTab);

  useEffect(() => {
    if (isCompactLayout) {
      prevTabRef.current = activeTab;
      return;
    }

    const chatIdFromQuery = searchParams.get('chatId');

    let timeoutId: any;

    if (!chatIdFromQuery && (!chatWindows || chatWindows.length === 0) && !emptyMessenger) {
      const firstAvailableGroup = groupList.find((g) => g.shouldVisible && g?.data?.length > 0);
      if (firstAvailableGroup?.data?.[0]) {
        timeoutId = setTimeout(() => {
          onChatSelect(firstAvailableGroup.data[0]);
        }, 100);
      }
    }

    prevTabRef.current = activeTab;

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [
    searchParams.get('chatId'),
    chatWindows?.length,
    emptyMessenger,
    groupList,
    activeTab,
    isCompactLayout,
  ]);

  return (
    <div className="w-full h-full bg-white">
      <div className="flex items-center justify-between gap-2 px-[14px] py-3">
        <div
          className="w-full min-w-0 truncate text-[27px] font-normal italic leading-[1.5] text-gray-900"
          style={{ fontFamily: "'Instrument Serif', Georgia, 'Times New Roman', serif" }}
        >
          Agent Chat
        </div>
        {/* Search collapses to an icon and expands in place, as on the phone
            console and the chat sidebar. */}
        <div className="flex shrink-0 items-center gap-2">
          {isSearchOpen ? (
            <input
              autoFocus
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onBlur={() => {
                if (!searchQuery.trim()) setIsSearchOpen(false);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Escape') {
                  setSearchQuery('');
                  setIsSearchOpen(false);
                }
              }}
              placeholder="Search chats, users…"
              aria-label="Search chats and users"
              className="h-[34px] w-[190px] max-w-[46vw] rounded-[9px] border border-red-200 bg-white px-3 text-[13px] text-gray-900 shadow-[0_1px_3px_rgba(17,17,17,0.06)] outline-none placeholder:text-gray-400"
            />
          ) : (
            <button
              type="button"
              onClick={() => setIsSearchOpen(true)}
              title="Search"
              aria-label="Search"
              className="flex h-[34px] w-[34px] items-center justify-center rounded-[9px] border border-gray-200 bg-white text-gray-500 shadow-[0_1px_3px_rgba(17,17,17,0.06)] transition-colors hover:border-primary hover:text-primary"
            >
              <SearchLine className="h-[15px] w-[15px]" />
            </button>
          )}
          {/* Available on every queue, not just the historical ones. */}
          <DateRangeMenu
            options={AGENT_CHAT_DATE_OPTIONS}
            value={dateRange}
            onChange={setDateRange}
          />
        </div>
      </div>

      {/* Queue counts, mirroring the phone console's KPI row. Every figure is
          read from tabCounts, so they always agree with the tabs below. */}
      <div className="grid grid-cols-4 gap-2 px-[14px] pb-3 pt-3">
        {(
          [
            { key: 'unassigned', label: 'Unassigned' },
            { key: 'active', label: 'Active' },
            { key: 'missed', label: 'Missed' },
            { key: 'resolved', label: 'Resolved' },
          ] as { key: AgentChatTab; label: string }[]
        ).map((tile) => (
          <div key={tile.key} className="min-w-0 rounded-xl bg-[#ebedf0] px-3 py-2.5">
            <div className="truncate text-[11px] font-medium text-gray-500">{tile.label}</div>
            <div className="mt-0.5 text-[22px] font-extrabold leading-tight tracking-tight tabular-nums text-gray-900">
              {tabCounts[tile.key] || 0}
            </div>
          </div>
        ))}
      </div>

      <div className="px-[14px] pb-3 border-b border-border bg-white">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            {tabOptions.map((tab) => {
              const isActive = activeTab === tab.value;

              return (
                <button
                  key={tab.value}
                  className={`shrink-0 cursor-pointer whitespace-nowrap rounded-full px-3.5 py-1.5 text-[12.5px] font-medium transition-colors ${
                    isActive
                      ? 'bg-[#0b1220] text-white'
                      : 'bg-[#f5f5f5] text-[#64748b] hover:bg-red-50 hover:text-primary'
                  }`}
                  onClick={() => {
                    if (tab.value === 'unassigned' || tab.value === 'missed') {
                      setChatWindows([]);
                    }
                    if (tab.value !== 'unassigned' && tab.value !== 'missed') {
                      setSelectedPendingRequestId('');
                    }
                    setActiveTab(tab.value);
                    setSearchParams((prev) => {
                      const next = new URLSearchParams(prev);
                      next.set('type', tab.value);
                      next.delete('chatId');
                      return next;
                    });
                  }}
                >
                  <span className="whitespace-nowrap">{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="w-full h-full overflow-auto max-h-[calc(100vh-220px)] pb-8 bg-white">
        {emptyMessenger && demoChats.length ? (
          /* Nothing in this queue: show sample conversations rather than an
             empty panel. They render through the real ListItem so the rows are
             the genuine article, but selecting one is a no-op — there is no
             conversation behind them. */
          <div className="flex flex-col gap-2 py-2.5 pb-[45px]">
            <div className="flex items-center gap-2 px-2 pb-1">
              <span className="inline-flex items-center gap-1 rounded-md border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-[9.5px] font-bold uppercase tracking-wide text-amber-700">
                Demo data
              </span>
              <span className="text-[11px] font-medium text-gray-400">
                queue is empty — showing samples
              </span>
            </div>
            {demoChats.map((demoChat) => (
              <div
                key={demoChat.chatId}
                className={
                  selectedDemoChatId === demoChat.chatId ? 'bg-gray-100' : ''
                }
              >
                <ListItem
                  chat={demoChat}
                  onChatSelect={() => onDemoChatSelect?.(demoChat)}
                  activeTab={activeTab}
                />
              </div>
            ))}
          </div>
        ) : emptyMessenger ? (
          <div className="w-full h-full flex justify-center items-center">
            <div className="flex items-center justify-center px-4">
              <div className="max-w-md w-full text-center px-4 pb-11">
                <div className="flex items-center justify-center w-20 h-20 mx-auto rounded-full bg-muted mb-6">
                  <div className="flex items-center justify-center w-9 h-9 rounded-full border-2 border-border">
                    <CircleCheck className="h-5 w-5 text-muted-foreground" />
                  </div>
                </div>

                <div className="text-sm font-semibold text-muted-foreground">All caught up!</div>
                <div className="text-muted-foreground mt-1 text-xs">
                  No conversations in this queue.
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-2 py-2.5 pb-[45px]">
            {(activeTab === 'unassigned' || activeTab === 'missed') &&
            filteredPendingRequests.length > 0 ? (
              <div className="w-full flex flex-col gap-2">
                {filteredPendingRequests?.map((request: any, index: number) => (
                  <PendingRequestItem
                    key={request?.chatId || request?.token || `pending-${index}`}
                    request={request}
                    currentUserId={user?.uuid}
                    isSelected={selectedPendingRequestId === request?.chatId}
                    onSelect={onPendingRequestSelect}
                    activeTab={activeTab}
                  />
                ))}
              </div>
            ) : null}

            {groupList?.map((group: any) => {
              if (!group?.data?.length) return null;
              return (
                <div key={group?.id} className="w-full flex flex-col gap-1.5">
                  {group?.label ? (
                    <div className="text-xs uppercase tracking-wider font-medium text-gray-500 flex gap-2 py-0 items-center bg-transparent min-h-9 justify-start max-h-9 px-2">
                      {group?.label}
                    </div>
                  ) : null}
                  {(group?.data || []).map((chat: any) => (
                    <ListItem
                      chat={chat}
                      key={chat?.chatId}
                      onChatSelect={onChatSelect}
                      activeTab={activeTab}
                    />
                  ))}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

const AgentChatMessenger = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const {
    chatWindows = [],
    setChatWindows,
    allAgentChats = [],
    aiChatRequests = [],
  } = useSocketEvents();
  const { user } = useUser();
  const typeFromQuery = searchParams.get('type');
  const [activeTab, setActiveTab] = useState<AgentChatTab>(() =>
    getAgentChatTabFromQuery(typeFromQuery),
  );
  const [selectedPendingRequestId, setSelectedPendingRequestId] = useState<string>('');
  const [isProfileDrawerOpen, setIsProfileDrawerOpen] = useState(false);
  // The right-hand profile panel is closed by default and opened on demand by
  // the conversation's Profile button — no separate drawer on wide screens.
  const [showProfile, setShowProfile] = useState(false);
  const [isCompactLayout, setIsCompactLayout] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth < 1280 : false,
  );

  const chatIdFromQuery = searchParams.get('chatId') || '';
  const selectedPendingRequest = useMemo(
    () =>
      (Array.isArray(aiChatRequests) ? aiChatRequests : []).find(
        (request: any) => request?.chatId === selectedPendingRequestId,
      ) || null,
    [aiChatRequests, selectedPendingRequestId],
  );
  const activeChatIdFromRoute = isCompactLayout
    ? chatIdFromQuery
    : chatIdFromQuery || (Array.isArray(chatWindows) ? chatWindows?.[0] : '') || '';
  const activeChatId =
    (activeTab === 'unassigned' || activeTab === 'missed') && selectedPendingRequest?.chatId
      ? selectedPendingRequest.chatId
      : activeChatIdFromRoute;

  useEffect(() => {
    const handleResize = () => {
      setIsCompactLayout(window.innerWidth < 1280);
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    const nextTab = getAgentChatTabFromQuery(typeFromQuery);
    setActiveTab((previous) => (previous === nextTab ? previous : nextTab));
  }, [typeFromQuery]);

  useEffect(() => {
    const handleRequestAccepted = (event: Event) => {
      const customEvent = event as CustomEvent<{ chatId?: string; type?: AgentChatTab }>;
      const acceptedChatId = `${customEvent?.detail?.chatId || ''}`.trim();
      if (!acceptedChatId) return;

      setSelectedPendingRequestId('');
      setChatWindows([acceptedChatId]);
      setActiveTab('active');
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        next.set('type', 'active');
        next.set('chatId', acceptedChatId);
        return next;
      });
    };

    window.addEventListener(AGENT_CHAT_REQUEST_ACCEPTED_EVENT, handleRequestAccepted);
    return () => {
      window.removeEventListener(AGENT_CHAT_REQUEST_ACCEPTED_EVENT, handleRequestAccepted);
    };
  }, [setChatWindows, setSearchParams]);

  useEffect(() => {
    if (!selectedPendingRequestId) return;
    if (!selectedPendingRequest) {
      setSelectedPendingRequestId('');
    }
  }, [selectedPendingRequestId, selectedPendingRequest]);

  useEffect(() => {
    if (!activeChatId) {
      setIsProfileDrawerOpen(false);
    }
  }, [activeChatId]);

  useEffect(() => {
    if (!isCompactLayout) {
      setIsProfileDrawerOpen(false);
    }
  }, [isCompactLayout]);

  /* The sample conversation currently open, if any. Cleared whenever a real
     chat is selected, so the two can never both be showing. */
  const [demoChat, setDemoChat] = useState<any>(null);
  // Demo chats the agent has resolved via the Resolve button — drives the
  // Resolved KPI tile and moves the sample into the Resolved tab.
  const [resolvedDemoIds, setResolvedDemoIds] = useState<string[]>([]);
  useEffect(() => {
    if (activeChatId) setDemoChat(null);
  }, [activeChatId]);

  const handleResolveDemo = useCallback(
    (chatId: string) => {
      if (!chatId) return;
      setResolvedDemoIds((ids) => (ids.includes(chatId) ? ids : [...ids, chatId]));
      setDemoChat(null);
      setActiveTab('resolved');
    },
    [setActiveTab],
  );

  const handleBackToChatList = useCallback(() => {
    setSelectedPendingRequestId('');
    setChatWindows([]);
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.delete('chatId');
      return next;
    });
  }, [setChatWindows, setSearchParams]);

  const selectedChat = useMemo(
    () =>
      (Array.isArray(allAgentChats) ? allAgentChats : []).find(
        (chat: any) => chat?.chatId === activeChatId,
      ) ||
      (activeTab === 'unassigned' || activeTab === 'missed' ? selectedPendingRequest : null) ||
      null,
    [allAgentChats, activeChatId, activeTab, selectedPendingRequest],
  );

  return (
    <div className="w-full h-full min-h-0 flex overflow-hidden bg-white">
      <section
        className={`${activeChatId ? 'hidden md:block' : 'w-full'} h-full min-h-0 border-r border-gray-200 bg-white lg:w-[var(--mcm-list-panel-w)] lg:min-w-[var(--mcm-list-panel-w)] lg:max-w-[var(--mcm-list-panel-w)]`}
      >
        <SidebarContent
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          selectedPendingRequestId={selectedPendingRequestId}
          setSelectedPendingRequestId={setSelectedPendingRequestId}
          isCompactLayout={isCompactLayout}
          onDemoChatSelect={setDemoChat}
          selectedDemoChatId={demoChat?.chatId}
          resolvedDemoIds={resolvedDemoIds}
        />
      </section>
      <section
        className={`${activeChatId || demoChat ? 'block' : 'hidden lg:block'} h-full min-h-0 w-full min-w-0 flex-1 bg-white`}
      >
        {demoChat ? (
          <DemoConversation
            chat={demoChat}
            onBack={() => setDemoChat(null)}
            onOpenProfile={() =>
              isCompactLayout ? setIsProfileDrawerOpen(true) : setShowProfile((v) => !v)
            }
            onResolve={() => handleResolveDemo(demoChat?.chatId)}
          />
        ) : (
        <AgentChat
          chatId={activeChatId}
          pendingRequest={
            activeTab === 'unassigned' || activeTab === 'missed' ? selectedPendingRequest : null
          }
          onBackToList={isCompactLayout ? handleBackToChatList : undefined}
          onOpenProfile={isCompactLayout ? () => setIsProfileDrawerOpen(true) : undefined}
          onPendingAccepted={(acceptedChatId: string) => {
            setSelectedPendingRequestId('');
            setChatWindows([acceptedChatId]);
            setActiveTab('active');
            setSearchParams((prev) => {
              const next = new URLSearchParams(prev);
              next.set('type', 'active');
              if (acceptedChatId) {
                next.set('chatId', acceptedChatId);
              }
              return next;
            });
          }}
        />
        )}
      </section>
      {showProfile ? (
        <VisitorProfile
          activeChatId={demoChat?.chatId || activeChatId}
          chat={demoChat || selectedChat}
          currentUserId={user?.uuid}
          onClose={() => setShowProfile(false)}
        />
      ) : null}
      {isCompactLayout ? (
        <Drawer direction="right" open={isProfileDrawerOpen} onOpenChange={setIsProfileDrawerOpen}>
          <DrawerContent className="w-full max-w-none p-0 sm:w-[22rem] sm:max-w-[22rem]">
            <DrawerHeader className="border-b border-border px-4 py-3">
              <div className="flex items-center justify-between">
                <DrawerTitle className="text-sm font-semibold text-foreground">
                  Visitor Profile
                </DrawerTitle>
                <DrawerClose asChild>
                  <button
                    type="button"
                    className="inline-flex h-8 cursor-pointer items-center gap-1 rounded-lg px-2 text-muted-foreground hover:bg-muted"
                    aria-label="Close profile drawer"
                  >
                    <ArrowLeft className="h-4 w-4" />
                    <span className="text-xs font-semibold">Back</span>
                  </button>
                </DrawerClose>
              </div>
            </DrawerHeader>
            <div className="h-[calc(100vh-56px)]">
              <VisitorProfile
                activeChatId={demoChat?.chatId || activeChatId}
                chat={demoChat || selectedChat}
                currentUserId={user?.uuid}
                asDrawerContent
              />
            </div>
          </DrawerContent>
        </Drawer>
      ) : null}
    </div>
  );
};

export default AgentChatMessenger;
