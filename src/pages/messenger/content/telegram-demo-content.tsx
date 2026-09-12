import { useEffect, useRef, useState } from 'react';
import EmojiPicker from 'emoji-picker-react';
import { Phone, Video, MoreVertical, Paperclip, Smile, Send, Mail, MapPin, Clock, Package } from 'lucide-react';

/**
 * The Telegram channel's own conversation view — Telegram's own bubble
 * colours (gray for the customer, blue for you) with read-receipt double
 * checks, its header controls (call, video, more), plus the same customer
 * info panel used on Facebook/Instagram/WhatsApp, toggled by clicking the
 * contact's name. Demo data only, keyed by the selected row's name, until
 * Telegram is wired to a real feed.
 */

type Msg = { from: 'them' | 'me'; text: string; time: string; read?: boolean };

type ContactInfo = {
  handle: string;
  lastSeen: string;
  email: string;
  location: string;
  localTime: string;
  previousConversations: { label: string; date: string }[];
  orders: { id: string; date: string; status: string }[];
  thread: Msg[];
};

const TELEGRAM_BLUE = '#229ed9';

const CONTACT_INFO: Record<string, ContactInfo> = {
  'David Wilson': {
    handle: '@davidw_t',
    lastSeen: 'Last seen 2 min ago',
    email: 'david.wilson@example.com',
    location: 'Toronto, Canada',
    localTime: '10:22 AM',
    previousConversations: [
      { label: 'Request 451 follow-up', date: 'Sep 8' },
      { label: 'Account verification', date: 'Aug 20' },
    ],
    orders: [{ id: '#42210-A', date: 'Aug 18, 2025', status: 'Delivered' }],
    thread: [
      { from: 'them', text: 'Good morning. Re: request 451. Still pending.', time: '09:15' },
      { from: 'me', text: 'Good morning David. Checking now.', time: '09:16', read: true },
      {
        from: 'me',
        text: 'The bot is waiting for a human review. Priority elevated.',
        time: '09:25',
        read: true,
      },
      { from: 'them', text: 'Bot says my request is pending — any update?', time: '10:20' },
      {
        from: 'me',
        text: 'Hi David, I’ve just manually assigned it to the correct team. Expect an update within the hour.',
        time: '10:22',
        read: true,
      },
      { from: 'them', text: 'Great, thanks!', time: '10:25' },
    ],
  },
  'Sarah Miller': {
    handle: '@sarah.miller',
    lastSeen: 'Last seen 15 min ago',
    email: 'sarah.miller@example.com',
    location: 'Manchester, UK',
    localTime: '03:22 PM',
    previousConversations: [{ label: 'Billing question', date: 'Aug 30' }],
    orders: [
      { id: '#41988-B', date: 'Sep 1, 2025', status: 'Shipped' },
      { id: '#40712-A', date: 'Jul 14, 2025', status: 'Delivered' },
    ],
    thread: [
      { from: 'them', text: 'Can I get a copy of my last invoice?', time: '13:07' },
      {
        from: 'me',
        text: 'Of course! Sending it over to your registered email now.',
        time: '13:10',
        read: true,
      },
    ],
  },
};

const FALLBACK_INFO: ContactInfo = {
  handle: '@visitor',
  lastSeen: 'Last seen recently',
  email: 'customer@example.com',
  location: 'Unknown',
  localTime: '—',
  previousConversations: [],
  orders: [],
  thread: [{ from: 'them', text: 'Hi there!', time: '—' }],
};

const initialsOf = (name: string) =>
  name
    .trim()
    .split(/\s+/)
    .map((p) => p.charAt(0))
    .join('')
    .slice(0, 2)
    .toUpperCase();

const AVATAR_COLORS = ['#7c6ee0', '#e0507a', '#3aa1e0', '#2fa96b', '#e0a13a', '#c25fdb'];
const colorForName = (name: string) => {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
};

const TelegramBadge = ({ size = 16 }: { size?: number }) => (
  <span
    className="inline-flex shrink-0 items-center justify-center rounded-full"
    style={{ width: size, height: size, background: TELEGRAM_BLUE }}
  >
    <svg viewBox="0 0 24 24" className="h-[60%] w-[60%] fill-white">
      <path d="M21.9 4.3 2.7 11.8c-1.3.5-1.3 1.2-.2 1.6l4.9 1.5 1.9 5.8c.2.6.4.9.9.9.4 0 .6-.2.9-.5l2.2-2.1 4.6 3.4c.8.5 1.4.2 1.6-.8l3-14c.3-1.3-.5-1.8-1.6-1.3ZM7.9 14.6 17.7 8.4c.5-.3.9-.1.6.3l-8.1 7.4-.3 3.3-1.2-3.8Z" />
    </svg>
  </span>
);

const TelegramDemoContent = ({
  selectedChat,
  onBackToList,
}: {
  selectedChat: any;
  onBackToList?: () => void;
}) => {
  const name = selectedChat?.name || 'Telegram contact';
  const info = CONTACT_INFO[name] || FALLBACK_INFO;
  const [messages, setMessages] = useState<Msg[]>(info.thread);
  const [draft, setDraft] = useState('');
  const [emojiOpen, setEmojiOpen] = useState(false);
  // Clicking the contact's name in the header toggles the customer panel on
  // the right, open by default — same behaviour as Facebook/Instagram/WhatsApp.
  const [showPanel, setShowPanel] = useState(true);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setMessages(info.thread);
    setDraft('');
  }, [name]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages]);

  const nowLabel = () =>
    new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });

  const sendMessage = (text: string) => {
    if (!text.trim()) return;
    setMessages((prev) => [...prev, { from: 'me', text: text.trim(), time: nowLabel(), read: false }]);
    setDraft('');
  };

  const handleAttach = (files: FileList | null) => {
    const file = files?.[0];
    if (!file) return;
    setMessages((prev) => [...prev, { from: 'me', text: `📎 ${file.name}`, time: nowLabel(), read: false }]);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Group consecutive "them" messages so a repeated name label only shows
  // once at the top of each run — matches the reference screenshot, where
  // David Wilson's name reappears only when he speaks again after you.
  let lastFrom: 'them' | 'me' | null = null;

  return (
    <div className="flex h-full min-h-0 w-full bg-white">
      {/* ---- middle: conversation thread ---- */}
      <div className="flex h-full min-h-0 flex-1 flex-col border-r border-gray-100">
        <div className="flex items-center justify-between gap-3 border-b border-gray-100 px-4 py-3">
          <div className="flex min-w-0 items-center gap-3">
            {onBackToList ? (
              <button
                type="button"
                onClick={onBackToList}
                className="shrink-0 text-gray-500 lg:hidden"
                aria-label="Back"
              >
                ←
              </button>
            ) : null}
            <div
              className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full text-[13px] font-semibold text-white"
              style={{ background: colorForName(name) }}
            >
              {initialsOf(name)}
            </div>
            <button
              type="button"
              className="min-w-0 text-left"
              onClick={() => setShowPanel((v) => !v)}
              title={showPanel ? 'Hide customer panel' : 'Show customer panel'}
            >
              <div className="flex items-center gap-1.5">
                <span className="truncate text-[14px] font-bold text-gray-900">{name}</span>
                <TelegramBadge />
              </div>
              <div className="truncate text-[12px] text-gray-500">{info.handle}</div>
              <div className="truncate text-[11.5px] text-gray-400">{info.lastSeen}</div>
            </button>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <button type="button" className="rounded-lg p-2 text-gray-400 hover:bg-gray-50 hover:text-gray-600">
              <Phone className="h-4 w-4" />
            </button>
            <button type="button" className="rounded-lg p-2 text-gray-400 hover:bg-gray-50 hover:text-gray-600">
              <Video className="h-4 w-4" />
            </button>
            <button type="button" className="rounded-lg p-2 text-gray-400 hover:bg-gray-50 hover:text-gray-600">
              <MoreVertical className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div ref={scrollRef} className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto bg-white p-5">
          {messages.map((m, i) => {
            const isMe = m.from === 'me';
            const showAvatar = !isMe && lastFrom !== 'them';
            const showName = !isMe && lastFrom !== 'them';
            lastFrom = m.from;
            return (
              <div key={i} className={`flex items-start gap-2 ${isMe ? 'justify-end' : 'justify-start'}`}>
                {!isMe ? (
                  <div
                    className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-full text-[10.5px] font-semibold text-white"
                    style={{
                      background: colorForName(name),
                      visibility: showAvatar ? 'visible' : 'hidden',
                    }}
                  >
                    {initialsOf(name)}
                  </div>
                ) : null}
                <div className={`flex max-w-[68%] flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                  {showName ? (
                    <div className="mb-0.5 px-1 text-[12px] font-bold text-gray-900">{name}</div>
                  ) : null}
                  <div
                    className={`rounded-xl px-3.5 py-2 text-[13.5px] leading-relaxed ${
                      isMe ? 'rounded-tr-sm bg-[#e7f0ff] text-gray-900' : 'rounded-tl-sm bg-gray-100 text-gray-800'
                    }`}
                  >
                    {m.text}
                    <span className="ml-2 inline-flex items-center gap-1 align-bottom text-[10.5px] text-gray-400">
                      {m.time}
                      {isMe && m.read ? (
                        <svg viewBox="0 0 16 11" className="h-2.5 w-3 fill-none" style={{ stroke: TELEGRAM_BLUE, strokeWidth: 1.4 }}>
                          <path d="M1 5.5 4 8.5 9.5 1.5" />
                          <path d="M6 5.5 9 8.5 14.5 1.5" />
                        </svg>
                      ) : null}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="flex items-center gap-2 border-t border-gray-100 px-4 py-3">
          <input ref={fileInputRef} type="file" hidden onChange={(e) => handleAttach(e.target.files)} />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            title="Attach a file"
            className="shrink-0 text-gray-400 hover:text-gray-600"
          >
            <Paperclip className="h-4.5 w-4.5" />
          </button>
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessage(draft);
              }
            }}
            placeholder={`Type a message to ${name}…`}
            className="h-10 flex-1 rounded-full border border-gray-200 bg-white px-4 text-[13px] text-gray-900 outline-none placeholder:text-gray-400"
          />
          <div className="relative shrink-0">
            <button
              type="button"
              onClick={() => setEmojiOpen((v) => !v)}
              title="Emoji"
              className={emojiOpen ? '' : 'text-gray-400 hover:text-gray-600'}
              style={emojiOpen ? { color: TELEGRAM_BLUE } : undefined}
            >
              <Smile className="h-4.5 w-4.5" />
            </button>
            {emojiOpen ? (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setEmojiOpen(false)} aria-hidden />
                <div className="absolute bottom-9 right-0 z-50 overflow-hidden rounded-lg shadow-xl">
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
            onClick={() => sendMessage(draft)}
            disabled={!draft.trim()}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-white transition-opacity hover:opacity-90 disabled:opacity-40"
            style={{ background: TELEGRAM_BLUE }}
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* ---- right: customer info panel ---- */}
      {showPanel ? (
        <div className="hidden h-full min-h-0 w-[300px] shrink-0 flex-col overflow-y-auto xl:flex">
          <div className="flex flex-col gap-6 p-4">
            <div className="flex items-start gap-3">
              <div
                className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full text-[13px] font-semibold text-white"
                style={{ background: colorForName(name) }}
              >
                {initialsOf(name)}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="truncate text-[13.5px] font-bold text-gray-900">{name}</span>
                  <TelegramBadge size={14} />
                </div>
                <div className="text-[12px] text-gray-500">Telegram · {info.handle}</div>
                <div className="mt-1 truncate text-[12px] text-gray-400">{info.thread[0]?.text}</div>
              </div>
            </div>

            <div>
              <div className="mb-2.5 text-[13px] font-bold text-gray-900">Contact Information</div>
              <div className="flex flex-col gap-2.5 text-[12.5px] text-gray-600">
                <div className="flex items-center gap-2.5">
                  <Mail className="h-4 w-4 shrink-0 text-gray-400" />
                  <span className="truncate">{info.email}</span>
                </div>
                <div className="flex items-center gap-2.5">
                  <MapPin className="h-4 w-4 shrink-0 text-gray-400" />
                  <span>{info.location}</span>
                </div>
                <div className="flex items-center gap-2.5">
                  <Clock className="h-4 w-4 shrink-0 text-gray-400" />
                  <span>Local Time: {info.localTime}</span>
                </div>
              </div>
            </div>

            <div>
              <div className="mb-2.5 flex items-center gap-2 text-[13px] font-bold text-gray-900">
                Previous Conversations
                <span className="rounded-full bg-gray-100 px-1.5 py-0.5 text-[10.5px] font-semibold text-gray-500">
                  {info.previousConversations.length}
                </span>
              </div>
              {info.previousConversations.length ? (
                <div className="flex flex-col gap-2">
                  {info.previousConversations.map((c) => (
                    <div key={c.label} className="flex items-center justify-between gap-2 text-[12.5px]">
                      <span className="flex min-w-0 items-center gap-1.5 truncate text-gray-600">
                        <span className="h-1 w-1 shrink-0 rounded-full" style={{ background: TELEGRAM_BLUE }} />
                        <span className="truncate">{c.label}</span>
                      </span>
                      <span className="shrink-0 text-gray-400">{c.date}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-[12.5px] text-gray-400">No previous conversations</div>
              )}
            </div>

            {info.orders.length ? (
              <div>
                <div className="mb-2.5 flex items-center gap-2 text-[13px] font-bold text-gray-900">
                  Recent Orders
                  <span className="rounded-full bg-gray-100 px-1.5 py-0.5 text-[10.5px] font-semibold text-gray-500">
                    {info.orders.length}
                  </span>
                </div>
                <div className="flex flex-col gap-2">
                  {info.orders.map((order) => (
                    <div
                      key={order.id}
                      className="flex items-center gap-3 rounded-xl border border-gray-100 p-2.5"
                    >
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-orange-50 text-orange-500">
                        <Package className="h-4 w-4" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-[12.5px] font-semibold text-gray-900">{order.id}</div>
                        <div className="text-[11.5px] text-gray-400">{order.date}</div>
                      </div>
                      <span
                        className={`shrink-0 rounded-full px-2 py-0.5 text-[10.5px] font-semibold ${
                          order.status === 'Cancelled'
                            ? 'bg-red-50 text-primary'
                            : order.status === 'Shipped'
                              ? 'bg-blue-50 text-blue-600'
                              : 'bg-emerald-50 text-emerald-600'
                        }`}
                      >
                        {order.status}
                      </span>
                    </div>
                  ))}
                </div>
                <button type="button" className="mt-3 text-[12.5px] font-semibold hover:underline" style={{ color: TELEGRAM_BLUE }}>
                  View all orders →
                </button>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default TelegramDemoContent;
