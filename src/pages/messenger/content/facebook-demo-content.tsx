import { useEffect, useRef, useState } from 'react';
import EmojiPicker from 'emoji-picker-react';
import {
  Clock,
  MoreVertical,
  Paperclip,
  Smile,
  BookOpen,
  Send,
  Mail,
  Phone,
  MapPin,
  Package,
} from 'lucide-react';

const SAVED_REPLIES = [
  'Thanks for reaching out! Let me check that for you.',
  'Sorry for the wait — here’s an update on your request.',
  'Is there anything else I can help you with?',
];

/**
 * The Facebook channel's own conversation view — a Messenger-styled thread
 * in the middle plus a customer info panel on the right,
 * matching Messenger's own inbox UI (blue accent, read ticks, contact
 * card). Demo data only, keyed by the selected row's name, until Facebook
 * conversations are wired to a real feed.
 */

type Msg = { from: 'them' | 'me'; text: string; time: string; read?: boolean };

type ContactInfo = {
  email: string;
  phone: string;
  location: string;
  localTime: string;
  previousConversations: { label: string; date: string }[];
  orders: { id: string; date: string; status: string }[];
  thread: Msg[];
};

const CONTACT_INFO: Record<string, ContactInfo> = {
  'Rahul Verma': {
    email: 'rahul.verma@example.com',
    phone: '+91 98765 43210',
    location: 'Delhi, India',
    localTime: '06:26 PM',
    previousConversations: [
      { label: 'Order related query', date: 'Aug 28' },
      { label: 'Product information', date: 'Aug 12' },
      { label: 'Shipping details', date: 'Jul 30' },
    ],
    orders: [
      { id: '#48213-A', date: 'Aug 20, 2025', status: 'Delivered' },
      { id: '#47950-B', date: 'Jul 28, 2025', status: 'Delivered' },
      { id: '#46812-A', date: 'Jun 14, 2025', status: 'Cancelled' },
    ],
    thread: [
      { from: 'them', text: 'Hey, do you ship internationally?', time: '18:20' },
      {
        from: 'me',
        text: 'Yes, we ship to most countries worldwide! 🌍 You can check the available countries at checkout.',
        time: '18:22',
        read: true,
      },
      { from: 'them', text: 'Great! How long does delivery usually take?', time: '18:24' },
      {
        from: 'me',
        text: 'Delivery time depends on your location, but it usually takes 5–10 business days. You’ll receive tracking details once your order is shipped.',
        time: '18:25',
        read: true,
      },
      { from: 'them', text: 'Perfect, thank you! 🙏', time: '18:26' },
    ],
  },
  'Priya Sharma': {
    email: 'priya.sharma@example.com',
    phone: '+91 91234 56780',
    location: 'Mumbai, India',
    localTime: '06:26 PM',
    previousConversations: [
      { label: 'Page comment follow-up', date: 'Aug 22' },
      { label: 'Discount code request', date: 'Aug 5' },
    ],
    orders: [{ id: '#47601-C', date: 'Aug 3, 2025', status: 'Shipped' }],
    thread: [
      { from: 'them', text: 'Thanks for the quick reply on the page!', time: '18:03' },
      {
        from: 'me',
        text: 'Happy to help! Let me know if you have any other questions.',
        time: '18:05',
        read: true,
      },
    ],
  },
  'Amit Kumar': {
    email: 'amit.kumar@example.com',
    phone: '+91 99887 76655',
    location: 'Bengaluru, India',
    localTime: '06:26 PM',
    previousConversations: [{ label: 'Offer validity check', date: 'Jul 14' }],
    orders: [
      { id: '#45230-D', date: 'May 2, 2025', status: 'Delivered' },
      { id: '#44890-A', date: 'Mar 18, 2025', status: 'Delivered' },
    ],
    thread: [
      { from: 'them', text: 'Is the offer from your last post still valid?', time: '17:36' },
      {
        from: 'me',
        text: 'Yes! The offer runs until the end of this week.',
        time: '17:40',
        read: true,
      },
    ],
  },
};

const FALLBACK_INFO: ContactInfo = {
  email: 'customer@example.com',
  phone: '+1 (415) 555-0132',
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

const MessengerBadge = ({ size = 16 }: { size?: number }) => (
  <span
    className="inline-flex shrink-0 items-center justify-center rounded-full bg-[#0084ff]"
    style={{ width: size, height: size }}
  >
    <svg viewBox="0 0 24 24" className="h-[60%] w-[60%] fill-white">
      <path d="M12 2C6.5 2 2 6.1 2 11.3c0 2.9 1.4 5.5 3.6 7.2V22l3.3-1.8c.9.2 1.8.4 2.8.4 5.5 0 10-4.1 10-9.3S17.5 2 12 2Zm.9 12.5-2.6-2.7-5 2.7 5.5-5.8 2.6 2.7 5-2.7-5.5 5.8Z" />
    </svg>
  </span>
);

const FacebookDemoContent = ({
  selectedChat,
  onBackToList,
}: {
  selectedChat: any;
  onBackToList?: () => void;
}) => {
  const name = selectedChat?.name || 'Facebook visitor';
  const info = CONTACT_INFO[name] || FALLBACK_INFO;
  // Clicking the contact's name in the header toggles the customer panel on
  // the right, open by default.
  const [showPanel, setShowPanel] = useState(true);
  const [draft, setDraft] = useState('');
  // The thread starts from the contact's demo history but lives in real
  // state from here, so Send/attach actually add bubbles to it.
  const [messages, setMessages] = useState<Msg[]>(info.thread);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [repliesOpen, setRepliesOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  // Switching contacts (Rahul → Priya → Amit) should reload that contact's
  // own thread rather than keep whatever was typed into the previous one.
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
    setMessages((prev) => [
      ...prev,
      { from: 'me', text: `📎 ${file.name}`, time: nowLabel(), read: false },
    ]);
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
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gray-200 text-[13px] font-semibold text-gray-600">
              {initialsOf(name)}
            </div>
            <button
              type="button"
              className="min-w-0 text-left"
              onClick={() => setShowPanel((v) => !v)}
              title={showPanel ? 'Hide customer panel' : 'Show customer panel'}
            >
              <div className="flex items-center gap-1.5">
                <span className="truncate text-[14px] font-bold text-gray-900">
                  {name}
                </span>
                <MessengerBadge />
              </div>
              <div className="flex items-center gap-1.5 text-[12px] text-gray-500">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                Online
              </div>
            </button>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <button type="button" className="rounded-lg p-2 text-gray-400 hover:bg-gray-50 hover:text-gray-600">
              <MoreVertical className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div ref={scrollRef} className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto bg-[#f7f8fa] p-5">
          <div className="mx-auto text-[11.5px] text-gray-400">
            Today, {new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
          </div>
          {messages.map((m, i) => (
            <div
              key={i}
              className={`flex items-end gap-2 ${m.from === 'me' ? 'flex-row-reverse' : ''}`}
            >
              {m.from === 'them' ? (
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gray-200 text-[10.5px] font-semibold text-gray-600">
                  {initialsOf(name)}
                </div>
              ) : (
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-[10.5px] font-semibold text-emerald-700">
                  UA
                </div>
              )}
              <div className={`flex max-w-[70%] flex-col ${m.from === 'me' ? 'items-end' : 'items-start'}`}>
                <div
                  className={`rounded-2xl px-3.5 py-2 text-[13.5px] leading-relaxed ${
                    m.from === 'me'
                      ? 'rounded-br-sm bg-[#e7f0ff] text-gray-900'
                      : 'rounded-bl-sm bg-white text-gray-800 shadow-sm'
                  }`}
                >
                  {m.text}
                </div>
                <div className="mt-1 flex items-center gap-1 px-1 text-[10.5px] text-gray-400">
                  {m.time}
                  {m.from === 'me' && m.read ? (
                    <svg viewBox="0 0 16 11" className="h-2.5 w-3 fill-none stroke-[#0084ff] stroke-[1.4]">
                      <path d="M1 5.5 4 8.5 9.5 1.5" />
                      <path d="M6 5.5 9 8.5 14.5 1.5" />
                    </svg>
                  ) : null}
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="relative flex items-center gap-2 border-t border-gray-100 px-4 py-3">
          <input
            ref={fileInputRef}
            type="file"
            hidden
            onChange={(e) => handleAttach(e.target.files)}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            title="Attach a file"
            className="shrink-0 text-gray-400 hover:text-gray-600"
          >
            <Paperclip className="h-[18px] w-[18px]" />
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
            placeholder="Type a reply…"
            className="h-10 flex-1 rounded-full border border-gray-200 bg-white px-4 text-[13px] text-gray-900 outline-none placeholder:text-gray-400"
          />

          <div className="relative shrink-0">
            <button
              type="button"
              onClick={() => {
                setEmojiOpen((v) => !v);
                setRepliesOpen(false);
              }}
              title="Emoji"
              className={emojiOpen ? 'text-primary' : 'text-gray-400 hover:text-gray-600'}
            >
              <Smile className="h-[18px] w-[18px]" />
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

          <div className="relative shrink-0">
            <button
              type="button"
              onClick={() => {
                setRepliesOpen((v) => !v);
                setEmojiOpen(false);
              }}
              title="Saved replies"
              className={repliesOpen ? 'text-primary' : 'text-gray-400 hover:text-gray-600'}
            >
              <BookOpen className="h-[18px] w-[18px]" />
            </button>
            {repliesOpen ? (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setRepliesOpen(false)} aria-hidden />
                <div className="absolute bottom-9 right-0 z-50 w-64 rounded-xl border border-gray-100 bg-white p-1.5 shadow-xl">
                  {SAVED_REPLIES.map((reply) => (
                    <button
                      key={reply}
                      type="button"
                      onClick={() => {
                        setDraft(reply);
                        setRepliesOpen(false);
                      }}
                      className="w-full rounded-lg px-2.5 py-2 text-left text-[12.5px] text-gray-700 hover:bg-gray-50"
                    >
                      {reply}
                    </button>
                  ))}
                </div>
              </>
            ) : null}
          </div>

          <button
            type="button"
            onClick={() => sendMessage(draft)}
            disabled={!draft.trim()}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary text-white transition-opacity hover:opacity-90 disabled:opacity-40"
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* ---- right: customer / conversation info ---- */}
      {showPanel ? (
      <div className="hidden h-full min-h-0 w-[300px] shrink-0 flex-col overflow-y-auto border-b border-gray-100 xl:flex">

        <div className="flex flex-col gap-6 p-4">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gray-200 text-[13px] font-semibold text-gray-600">
              {initialsOf(name)}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <span className="truncate text-[13.5px] font-bold text-gray-900">{name}</span>
                <MessengerBadge size={14} />
              </div>
              <div className="text-[12px] text-gray-500">Facebook</div>
              <div className="mt-1 truncate text-[12px] text-gray-400">
                {info.thread[0]?.text}
              </div>
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
                <Phone className="h-4 w-4 shrink-0 text-gray-400" />
                <span>{info.phone}</span>
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
                      <span className="h-1 w-1 shrink-0 rounded-full bg-primary" />
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
                      <div className="truncate text-[12.5px] font-semibold text-gray-900">
                        {order.id}
                      </div>
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
              <button type="button" className="mt-3 text-[12.5px] font-semibold text-primary hover:underline">
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

export default FacebookDemoContent;
