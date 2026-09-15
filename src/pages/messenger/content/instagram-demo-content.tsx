import { useEffect, useRef, useState } from 'react';
import EmojiPicker from 'emoji-picker-react';
import { Phone, Video, Info, Paperclip, Smile, Send, Mail, MapPin, Clock, Package } from 'lucide-react';

/**
 * The Instagram channel's own conversation view — a DM-styled thread with
 * the signature gradient story-ring avatar, a product-card message bubble,
 * and Instagram's own header controls (call, video, info). Demo data only,
 * keyed by the selected row's name, until Instagram DMs are wired to a real
 * feed.
 */

type Msg =
  | { from: 'them' | 'me'; kind: 'text'; text: string; time: string }
  | {
      from: 'me';
      kind: 'product';
      caption: string;
      time: string;
      product: { image: string; name: string; price: string };
    };

type ContactInfo = {
  handle: string;
  email: string;
  location: string;
  localTime: string;
  previousConversations: { label: string; date: string }[];
  orders: { id: string; date: string; status: string }[];
  thread: Msg[];
};

const INSTAGRAM_GRADIENT = 'linear-gradient(45deg, #feda75, #fa7e1e, #d62976, #962fbf, #4f5bd5)';

const CONTACT_INFO: Record<string, ContactInfo> = {
  'Emily Clark': {
    handle: '@emily.clark',
    email: 'emily.clark@example.com',
    location: 'Austin, US',
    localTime: '08:56 AM',
    previousConversations: [
      { label: 'Reel comment reply', date: 'Aug 30' },
      { label: 'Product availability', date: 'Aug 19' },
    ],
    orders: [
      { id: '#39215-A', date: 'Aug 22, 2025', status: 'Delivered' },
      { id: '#38804-B', date: 'Jul 30, 2025', status: 'Delivered' },
      { id: '#37650-C', date: 'Jun 11, 2025', status: 'Cancelled' },
    ],
    thread: [
      { from: 'them', kind: 'text', text: 'Loved your latest reel! Where can I buy this?', time: '10:23' },
      {
        from: 'me',
        kind: 'text',
        text: 'Thanks for reaching out! I can definitely help with that. You can find the product details on our website, or I can provide a link here.',
        time: '10:24',
      },
      { from: 'them', kind: 'text', text: 'Oh great, thank you so much! Yes, a link would be perfect.', time: '10:26' },
      {
        from: 'me',
        kind: 'product',
        caption: 'Sure! Here is the direct product link:',
        time: '10:27',
        product: {
          image:
            'data:image/svg+xml;utf8,' +
            encodeURIComponent(
              '<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64"><rect width="64" height="64" fill="%23e9dfce"/><path d="M14 42 L28 24 L38 34 L46 22 L52 42 Z" fill="%23b08d57"/></svg>',
            ),
          name: 'Product Name Bark Product',
          price: '$37.00',
        },
      },
    ],
  },
  'Marco Bianchi': {
    handle: '@marco.bianchi',
    email: 'marco.bianchi@example.com',
    location: 'Milan, IT',
    localTime: '02:56 PM',
    previousConversations: [{ label: 'Collab enquiry', date: 'Jul 25' }],
    orders: [{ id: '#35120-A', date: 'Jun 18, 2025', status: 'Delivered' }],
    thread: [
      { from: 'them', kind: 'text', text: 'DMing about the collab you posted.', time: '10:02' },
      {
        from: 'me',
        kind: 'text',
        text: 'Hey Marco! Thanks for reaching out — send over your portfolio and we’ll take a look.',
        time: '10:06',
      },
    ],
  },
  'John Smith': {
    handle: '@john.smith',
    email: 'john.smith@example.com',
    location: 'Leeds, UK',
    localTime: '01:56 PM',
    previousConversations: [
      { label: 'Order status check', date: 'Aug 15' },
      { label: 'Return request', date: 'Jul 2' },
    ],
    orders: [
      { id: '#38470-C', date: 'Sep 9, 2025', status: 'Shipped' },
      { id: '#36991-A', date: 'Jul 2, 2025', status: 'Delivered' },
      { id: '#35404-B', date: 'May 20, 2025', status: 'Cancelled' },
    ],
    thread: [
      { from: 'them', kind: 'text', text: 'Can you confirm my order ships tomorrow?', time: '09:25' },
      {
        from: 'me',
        kind: 'text',
        text: 'Yes! It’s scheduled to ship tomorrow morning — you’ll get a tracking link by email.',
        time: '09:31',
      },
    ],
  },
};

const FALLBACK_INFO: ContactInfo = {
  handle: '@visitor',
  email: 'visitor@example.com',
  location: 'Unknown',
  localTime: '—',
  previousConversations: [],
  orders: [],
  thread: [{ from: 'them', kind: 'text', text: 'Hi there!', time: '—' }],
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

const CameraBadge = () => (
  <span
    className="absolute -bottom-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full ring-2 ring-white"
    style={{ background: INSTAGRAM_GRADIENT }}
  >
    <svg viewBox="0 0 24 24" className="h-2.5 w-2.5 fill-white">
      <path d="M12 7.2a4.8 4.8 0 1 0 0 9.6 4.8 4.8 0 0 0 0-9.6Zm0 7.9a3.1 3.1 0 1 1 0-6.2 3.1 3.1 0 0 1 0 6.2ZM17.5 6a1.1 1.1 0 1 1-2.2 0 1.1 1.1 0 0 1 2.2 0Z" />
      <path d="M17 2H7a5 5 0 0 0-5 5v10a5 5 0 0 0 5 5h10a5 5 0 0 0 5-5V7a5 5 0 0 0-5-5Zm3 15a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3V7a3 3 0 0 1 3-3h10a3 3 0 0 1 3 3v10Z" />
    </svg>
  </span>
);

const GradientAvatar = ({ name, size = 36 }: { name: string; size?: number }) => (
  <div className="relative shrink-0">
    <div
      className="flex items-center justify-center rounded-full p-[2px]"
      style={{ background: INSTAGRAM_GRADIENT, width: size, height: size }}
    >
      <div
        className="flex h-full w-full items-center justify-center overflow-hidden rounded-full border-2 border-white text-[12px] font-semibold text-white"
        style={{ background: colorForName(name) }}
      >
        {initialsOf(name)}
      </div>
    </div>
    <CameraBadge />
  </div>
);

const InstagramDemoContent = ({
  selectedChat,
  onBackToList,
}: {
  selectedChat: any;
  onBackToList?: () => void;
}) => {
  const name = selectedChat?.name || 'Instagram visitor';
  const info = CONTACT_INFO[name] || FALLBACK_INFO;
  const [messages, setMessages] = useState<Msg[]>(info.thread);
  const [draft, setDraft] = useState('');
  const [emojiOpen, setEmojiOpen] = useState(false);
  // Clicking the contact's name in the header toggles the customer panel on
  // the right, open by default — same behaviour as the Facebook view.
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
    setMessages((prev) => [...prev, { from: 'me', kind: 'text', text: text.trim(), time: nowLabel() }]);
    setDraft('');
  };

  const handleAttach = (files: FileList | null) => {
    const file = files?.[0];
    if (!file) return;
    setMessages((prev) => [
      ...prev,
      { from: 'me', kind: 'text', text: `📎 ${file.name}`, time: nowLabel() },
    ]);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="flex h-full min-h-0 w-full bg-white">
    <div className="flex h-full min-h-0 flex-1 flex-col border-r border-gray-100">
      {/* header */}
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
          <GradientAvatar name={name} size={38} />
          <button
            type="button"
            className="min-w-0 text-left"
            onClick={() => setShowPanel((v) => !v)}
            title={showPanel ? 'Hide customer panel' : 'Show customer panel'}
          >
            <div className="truncate text-[14px] font-bold text-gray-900">{name}</div>
            <div className="truncate text-[12px] text-gray-500">{info.handle}</div>
          </button>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-[11.5px] font-semibold text-emerald-600">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            Online
          </span>
          <button type="button" className="rounded-lg p-2 text-gray-400 hover:bg-gray-50 hover:text-gray-600">
            <Phone className="h-4 w-4" />
          </button>
          <button type="button" className="rounded-lg p-2 text-gray-400 hover:bg-gray-50 hover:text-gray-600">
            <Video className="h-4 w-4" />
          </button>
          <button type="button" className="rounded-lg p-2 text-gray-400 hover:bg-gray-50 hover:text-gray-600">
            <Info className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* thread */}
      <div ref={scrollRef} className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto bg-white p-5">
        {messages.map((m, i) => {
          const isMe = m.from === 'me';
          return (
            <div key={i} className={`flex items-end gap-2 ${isMe ? 'flex-row-reverse' : ''}`}>
              {!isMe ? <GradientAvatar name={name} size={28} /> : null}
              <div className={`flex max-w-[72%] flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                {m.kind === 'product' ? (
                  <div className="w-64 overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
                    <div className="border-b border-gray-100 px-3 py-2 text-[12.5px] text-gray-700">
                      {m.caption}
                    </div>
                    <div className="flex items-center gap-3 p-3">
                      <img
                        src={m.product.image}
                        alt={m.product.name}
                        className="h-14 w-14 shrink-0 rounded-lg object-cover"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-[12.5px] font-semibold text-gray-900">
                          {m.product.name}
                        </div>
                        <div className="text-[12.5px] font-bold text-gray-900">{m.product.price}</div>
                      </div>
                    </div>
                    <button
                      type="button"
                      className="w-full border-t border-gray-100 py-2 text-[12.5px] font-semibold text-gray-800 hover:bg-gray-50"
                    >
                      View Product
                    </button>
                  </div>
                ) : (
                  <div
                    className={`rounded-2xl px-3.5 py-2 text-[13.5px] leading-relaxed ${
                      isMe
                        ? 'rounded-br-sm bg-gray-100 text-gray-800'
                        : 'rounded-bl-sm bg-[#3897f0] text-white'
                    }`}
                  >
                    {m.text}
                  </div>
                )}
                <div className="mt-1 px-1 text-[10.5px] text-gray-400">{m.time}</div>
              </div>
            </div>
          );
        })}
      </div>

      {/* composer */}
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
          placeholder="Type a message…"
          className="h-10 flex-1 rounded-full border border-gray-200 bg-white px-4 text-[13px] text-gray-900 outline-none placeholder:text-gray-400"
        />
        <div className="relative shrink-0">
          <button
            type="button"
            onClick={() => setEmojiOpen((v) => !v)}
            title="Emoji"
            className={emojiOpen ? 'text-[#d62976]' : 'text-gray-400 hover:text-gray-600'}
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
          style={{ background: INSTAGRAM_GRADIENT }}
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
            <GradientAvatar name={name} size={40} />
            <div className="min-w-0 flex-1">
              <div className="truncate text-[13.5px] font-bold text-gray-900">{name}</div>
              <div className="text-[12px] text-gray-500">{info.handle}</div>
              <div className="mt-1 truncate text-[12px] text-gray-400">
                {info.thread[0]?.kind === 'text' ? info.thread[0].text : ''}
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
                      <span
                        className="h-1 w-1 shrink-0 rounded-full"
                        style={{ background: '#d62976' }}
                      />
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
              <button type="button" className="mt-3 text-[12.5px] font-semibold hover:underline" style={{ color: '#d62976' }}>
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

export default InstagramDemoContent;
