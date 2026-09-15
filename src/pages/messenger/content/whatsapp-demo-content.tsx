import { useEffect, useRef, useState } from 'react';
import EmojiPicker from 'emoji-picker-react';
import { Video, Phone, Search, Paperclip, Smile, Send, Mail, MapPin, Clock, Package } from 'lucide-react';

/**
 * The WhatsApp channel's own conversation view — WhatsApp's own bubble
 * colours (white for the customer, green for you) with read-receipt double
 * checks, its header controls (video, call, search), plus the same customer
 * info panel used on Facebook/Instagram, toggled by clicking the contact's
 * name. Demo data only, keyed by the selected row's name, until WhatsApp is
 * wired to a real feed.
 */

type Msg = { from: 'them' | 'me'; text: string; time: string; read?: boolean };

type ContactInfo = {
  phone: string;
  email: string;
  location: string;
  localTime: string;
  previousConversations: { label: string; date: string }[];
  orders: { id: string; date: string; status: string }[];
  thread: Msg[];
};

const CONTACT_INFO: Record<string, ContactInfo> = {
  'Neha Sharma': {
    phone: '+91 98765 43210',
    email: 'neha.sharma@example.com',
    location: 'Pune, India',
    localTime: '10:36 AM',
    previousConversations: [
      { label: 'Appointment booking', date: 'Aug 25' },
      { label: 'Service enquiry', date: 'Aug 10' },
    ],
    orders: [{ id: '#41022-A', date: 'Aug 12, 2025', status: 'Delivered' }],
    thread: [
      { from: 'them', text: 'Hi, I’d like to reschedule my appointment.', time: '10:30 AM' },
      {
        from: 'me',
        text: 'Hi Neha! Of course, I can help. What new date and time were you thinking?',
        time: '10:31 AM',
        read: true,
      },
      { from: 'them', text: 'Would next Tuesday at 3 PM work?', time: '10:33 AM' },
      {
        from: 'me',
        text: 'Checking availability… yes, that time is free. Would you like to confirm the rescheduling?',
        time: '10:35 AM',
        read: true,
      },
      { from: 'them', text: 'Yes, please. Thanks!', time: '10:36 AM' },
    ],
  },
  'Raj Kumar': {
    phone: '+91 91234 56789',
    email: 'raj.kumar@example.com',
    location: 'Jaipur, India',
    localTime: '09:58 AM',
    previousConversations: [{ label: 'Payment confirmation', date: 'Jul 20' }],
    orders: [
      { id: '#40510-B', date: 'Sep 5, 2025', status: 'Shipped' },
      { id: '#39877-A', date: 'Jul 20, 2025', status: 'Delivered' },
    ],
    thread: [
      { from: 'them', text: 'Payment done, please confirm.', time: '09:54 AM' },
      {
        from: 'me',
        text: 'Thanks Raj — payment received! Your order is confirmed and will ship shortly.',
        time: '09:58 AM',
        read: true,
      },
    ],
  },
};

const FALLBACK_INFO: ContactInfo = {
  phone: '+1 (415) 555-0132',
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

const WhatsappBadge = ({ size = 16 }: { size?: number }) => (
  <span
    className="inline-flex shrink-0 items-center justify-center rounded-full bg-[#25d366]"
    style={{ width: size, height: size }}
  >
    <svg viewBox="0 0 24 24" className="h-[60%] w-[60%] fill-white">
      <path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l4.9-1.3A10 10 0 1 0 12 2Zm5.5 14.1c-.2.6-1.3 1.2-1.8 1.3-.5.1-1 .1-3.2-.7-2.7-1-4.4-3.7-4.6-3.9-.1-.2-1.1-1.5-1.1-2.8s.7-2 .9-2.3c.2-.2.5-.3.7-.3h.5c.2 0 .4 0 .6.5.2.5.7 1.8.8 1.9.1.1.1.3 0 .5-.1.2-.2.3-.3.5-.2.2-.3.3-.1.6.2.3.9 1.5 2 2.4 1.3 1.2 2.4 1.5 2.7 1.7.3.2.5.1.6-.1.2-.2.7-.8.9-1.1.2-.3.4-.2.6-.1.2.1 1.5.7 1.8.8.3.1.5.2.5.3.1.2.1.6-.1 1.2Z" />
    </svg>
  </span>
);

const WhatsappDemoContent = ({
  selectedChat,
  onBackToList,
}: {
  selectedChat: any;
  onBackToList?: () => void;
}) => {
  const name = selectedChat?.name || 'WhatsApp contact';
  const info = CONTACT_INFO[name] || FALLBACK_INFO;
  const [messages, setMessages] = useState<Msg[]>(info.thread);
  const [draft, setDraft] = useState('');
  const [emojiOpen, setEmojiOpen] = useState(false);
  // Clicking the contact's name in the header toggles the customer panel on
  // the right, open by default — same behaviour as Facebook/Instagram.
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
    new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

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
                <WhatsappBadge />
              </div>
              <div className="flex items-center gap-1.5 text-[12px] text-gray-500">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                Online
              </div>
            </button>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <button type="button" className="rounded-lg p-2 text-gray-400 hover:bg-gray-50 hover:text-gray-600">
              <Video className="h-4 w-4" />
            </button>
            <button type="button" className="rounded-lg p-2 text-gray-400 hover:bg-gray-50 hover:text-gray-600">
              <Phone className="h-4 w-4" />
            </button>
            <button type="button" className="rounded-lg p-2 text-gray-400 hover:bg-gray-50 hover:text-gray-600">
              <Search className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div
          ref={scrollRef}
          className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto p-5"
          style={{ background: '#e9ecef' }}
        >
          {messages.map((m, i) => {
            const isMe = m.from === 'me';
            return (
              <div key={i} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[70%] rounded-lg px-3 py-2 text-[13.5px] leading-relaxed shadow-sm ${
                    isMe ? 'rounded-tr-none bg-[#d9fdd3] text-gray-900' : 'rounded-tl-none bg-white text-gray-800'
                  }`}
                >
                  {m.text}
                  <div
                    className={`mt-1 flex items-center justify-end gap-1 text-[10.5px] ${
                      isMe ? 'text-gray-500' : 'text-gray-400'
                    }`}
                  >
                    {m.time}
                    {isMe && m.read ? (
                      <svg viewBox="0 0 16 11" className="h-2.5 w-3 fill-none stroke-[#53bdeb] stroke-[1.4]">
                        <path d="M1 5.5 4 8.5 9.5 1.5" />
                        <path d="M6 5.5 9 8.5 14.5 1.5" />
                      </svg>
                    ) : null}
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
              className={emojiOpen ? 'text-[#25d366]' : 'text-gray-400 hover:text-gray-600'}
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
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#25d366] text-white transition-opacity hover:opacity-90 disabled:opacity-40"
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
                  <WhatsappBadge size={14} />
                </div>
                <div className="text-[12px] text-gray-500">WhatsApp</div>
                <div className="mt-1 truncate text-[12px] text-gray-400">{info.thread[0]?.text}</div>
              </div>
            </div>

            <div>
              <div className="mb-2.5 text-[13px] font-bold text-gray-900">Contact Information</div>
              <div className="flex flex-col gap-2.5 text-[12.5px] text-gray-600">
                <div className="flex items-center gap-2.5">
                  <WhatsappBadge size={14} />
                  <span>{info.phone}</span>
                </div>
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
                        <span className="h-1 w-1 shrink-0 rounded-full bg-[#25d366]" />
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
                <button
                  type="button"
                  className="mt-3 text-[12.5px] font-semibold text-[#25d366] hover:underline"
                >
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

export default WhatsappDemoContent;
