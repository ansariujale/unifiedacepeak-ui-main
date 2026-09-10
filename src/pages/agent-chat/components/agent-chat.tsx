import { useSocketEvents } from '@/hooks/use-socket-events';
import { useUser } from '@/hooks/use-user';
import {
  CircleAlert,
  CircleCheck,
  Clock,
  Lightbulb,
  ShieldCheck,
  Users,
  BookOpen,
  Heart,
  BarChart3,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { toast } from 'react-toastify';
import AgentChatFooter from './chat/agent-chat-footer';
import AgentChatHeader from './chat/agent-chat-header';
import AgentChatMessages from './chat/agent-chat-messages';

/* A friendly, self-contained support-bot scene for the welcome screen —
   inline SVG so it needs no image asset and follows the app's red theme. */
const SupportHero = () => (
  <svg viewBox="0 0 420 320" className="h-auto w-full" role="img" aria-label="Support assistant">
    {/* ground shadow */}
    <ellipse cx="215" cy="292" rx="150" ry="16" fill="#000" opacity="0.05" />

    {/* speech bubble: How can I help today? */}
    <g>
      <rect x="250" y="18" width="158" height="64" rx="16" fill="#ffe1dc" />
      <path d="M270 82 l-10 20 l26 -14 Z" fill="#ffe1dc" />
      <text x="329" y="44" textAnchor="middle" fontSize="14" fontWeight="600" fill="#7f1d1d">
        How can I help
      </text>
      <text x="329" y="64" textAnchor="middle" fontSize="14" fontWeight="600" fill="#7f1d1d">
        today?
      </text>
    </g>

    {/* small chat-dots bubble */}
    <g>
      <rect x="118" y="70" width="58" height="34" rx="12" fill="#e6ebff" />
      <circle cx="134" cy="87" r="4" fill="#93a4d4" />
      <circle cx="147" cy="87" r="4" fill="#93a4d4" />
      <circle cx="160" cy="87" r="4" fill="#93a4d4" />
    </g>

    {/* small chart bubble */}
    <g>
      <rect x="330" y="120" width="52" height="42" rx="12" fill="#ffe1dc" />
      <rect x="342" y="140" width="6" height="12" rx="2" fill="#ef4444" />
      <rect x="353" y="133" width="6" height="19" rx="2" fill="#ef4444" />
      <rect x="364" y="127" width="6" height="25" rx="2" fill="#ef4444" />
    </g>

    {/* sparkle */}
    <path
      d="M150 150 q4 -12 8 0 q12 4 0 8 q-4 12 -8 0 q-12 -4 0 -8 Z"
      fill="#ffb4a8"
    />

    {/* plant */}
    <g>
      <path d="M120 250 q-14 -34 6 -52 q10 22 -6 52 Z" fill="#34d399" />
      <path d="M132 250 q2 -40 22 -46 q-4 30 -22 46 Z" fill="#10b981" />
      <path d="M110 274 h44 l-6 -26 h-32 Z" fill="#f4a26b" />
    </g>

    {/* robot */}
    <g>
      {/* torso */}
      <rect x="163" y="214" width="104" height="66" rx="28" fill="#28324d" />
      <rect x="163" y="214" width="104" height="30" rx="15" fill="#313d5e" />
      {/* chest status panel */}
      <rect x="192" y="222" width="46" height="20" rx="7" fill="#1b2338" />
      <circle cx="203" cy="232" r="3" fill="#93c5fd" />
      <circle cx="215" cy="232" r="3" fill="#ef4444" />
      <circle cx="227" cy="232" r="3" fill="#34d399" />
      {/* neck */}
      <rect x="203" y="196" width="24" height="24" rx="7" fill="#1b2338" />
      {/* headphone band */}
      <path
        d="M167 168 a48 48 0 0 1 96 0"
        fill="none"
        stroke="#ef4444"
        strokeWidth="10"
        strokeLinecap="round"
      />
      {/* antenna */}
      <line x1="215" y1="112" x2="215" y2="130" stroke="#28324d" strokeWidth="5" strokeLinecap="round" />
      <circle cx="215" cy="107" r="7" fill="#ef4444" />
      {/* head */}
      <rect x="171" y="128" width="88" height="82" rx="28" fill="#28324d" />
      {/* ear cups */}
      <rect x="158" y="156" width="20" height="36" rx="9" fill="#ef4444" />
      <rect x="252" y="156" width="20" height="36" rx="9" fill="#ef4444" />
      {/* face plate */}
      <rect x="183" y="146" width="64" height="50" rx="20" fill="#f8fafc" />
      {/* eyes with glints */}
      <circle cx="203" cy="168" r="6.5" fill="#28324d" />
      <circle cx="227" cy="168" r="6.5" fill="#28324d" />
      <circle cx="205" cy="165.5" r="2" fill="#ffffff" />
      <circle cx="229" cy="165.5" r="2" fill="#ffffff" />
      {/* blush cheeks */}
      <circle cx="194" cy="181" r="4.5" fill="#fca5a5" opacity="0.85" />
      <circle cx="236" cy="181" r="4.5" fill="#fca5a5" opacity="0.85" />
      {/* smile */}
      <path
        d="M205 182 q10 9 20 0"
        fill="none"
        stroke="#28324d"
        strokeWidth="4"
        strokeLinecap="round"
      />
    </g>

    {/* arms reaching toward the laptop (upper arms hidden behind the screen) */}
    <g>
      <path
        d="M175 232 q-18 28 8 50"
        fill="none"
        stroke="#28324d"
        strokeWidth="15"
        strokeLinecap="round"
      />
      <path
        d="M255 232 q18 28 -8 50"
        fill="none"
        stroke="#28324d"
        strokeWidth="15"
        strokeLinecap="round"
      />
    </g>

    {/* laptop (larger, in front of the torso) */}
    <g>
      <rect x="150" y="228" width="130" height="60" rx="8" fill="#c7ccd6" />
      <rect x="160" y="236" width="110" height="44" rx="4" fill="#eef1f6" />
      <circle cx="215" cy="258" r="8" fill="#dbe0e8" />
      <path d="M138 288 h154 l12 16 h-178 Z" fill="#aab3c0" />
      <rect x="150" y="291" width="130" height="6" rx="3" fill="#c7ccd6" />
    </g>

    {/* hands resting on the keyboard */}
    <g>
      <circle cx="182" cy="288" r="11" fill="#28324d" />
      <circle cx="248" cy="288" r="11" fill="#28324d" />
    </g>

    {/* mug — "Great Support Happens Here 👋" */}
    <g>
      {/* handle */}
      <path
        d="M356 236 a17 17 0 0 1 0 34"
        fill="none"
        stroke="#e2e6ec"
        strokeWidth="7"
        strokeLinecap="round"
      />
      {/* body */}
      <rect x="304" y="226" width="56" height="66" rx="10" fill="#ffffff" stroke="#e5e7eb" strokeWidth="2" />
      <ellipse cx="332" cy="292" rx="28" ry="4" fill="#000" opacity="0.04" />
      {/* text */}
      <text x="332" y="245" textAnchor="middle" fontSize="9" fontWeight="800" fill="#28324d">
        Great
      </text>
      <text x="332" y="257" textAnchor="middle" fontSize="9" fontWeight="800" fill="#28324d">
        Support
      </text>
      <text x="332" y="269" textAnchor="middle" fontSize="9" fontWeight="800" fill="#28324d">
        Happens
      </text>
      <text x="332" y="281" textAnchor="middle" fontSize="9" fontWeight="800" fill="#28324d">
        Here 👋
      </text>
    </g>
  </svg>
);

export type AgentChatProps = {
  chatId?: string;
  fromMeetChat?: boolean;
  onBackToList?: () => void;
  onOpenProfile?: () => void;
  pendingRequest?: any;
  onPendingAccepted?: (chatId: string) => void;
};

const AgentChat = ({
  chatId = '',
  onBackToList,
  onOpenProfile,
  pendingRequest = null,
  onPendingAccepted,
}: AgentChatProps) => {
  const { user } = useUser();
  const [isAcceptingRequest, setIsAcceptingRequest] = useState(false);
  const {
    allAgentChats = [],
    typingList = {},
    handleAiChatAccept,
    setAiChatRequests,
  } = useSocketEvents();

  const pendingChat = useMemo(() => {
    if (!pendingRequest?.chatId) return null;

    const rawUsers = pendingRequest?.users;
    const userList = Array.isArray(rawUsers) ? rawUsers : rawUsers ? [rawUsers] : [];
    const pendingVisitor =
      userList.find((chatUser: any) => chatUser?.uuid && chatUser?.uuid !== user?.uuid) ||
      userList.find((chatUser: any) => chatUser?.name || chatUser?.email) ||
      {};

    const visitorName =
      pendingVisitor?.name ||
      `${pendingVisitor?.first_name || ''} ${pendingVisitor?.last_name || ''}`.trim() ||
      pendingVisitor?.email ||
      'Unknown Visitor';

    return {
      chatId: pendingRequest.chatId,
      createdAt:
        pendingRequest?.createdAt || pendingRequest?.requestedAt || new Date().toISOString(),
      users: [
        {
          ...pendingVisitor,
          uuid: pendingVisitor?.uuid || 'pending-visitor',
          name: visitorName,
        },
        {
          uuid: 'AI-Bot',
          name: 'AI Assistant',
        },
      ],
      isPendingRequest: true,
      metaData: {
        ...(pendingRequest?.metaData || {}),
      },
    };
  }, [pendingRequest, user?.uuid]);

  const currentChat = useMemo(() => {
    const existingChat = (Array.isArray(allAgentChats) ? allAgentChats : []).find(
      (chat: any) => chat?.chatId === chatId,
    );
    if (pendingRequest?.chatId && pendingRequest.chatId === chatId) {
      const base = existingChat || pendingChat;
      if (!base) return null;
      return {
        ...base,
        users:
          Array.isArray(base?.users) && base.users.length
            ? base.users
            : Array.isArray(pendingChat?.users)
              ? pendingChat.users
              : [],
        createdAt: base?.createdAt || pendingChat?.createdAt,
        metaData: {
          ...(pendingChat?.metaData || {}),
          ...(base?.metaData || {}),
        },
        isPendingRequest: true,
      };
    }
    if (existingChat) return existingChat;
    if (pendingChat?.chatId === chatId) return pendingChat;
    return null;
  }, [allAgentChats, chatId, pendingChat, pendingRequest?.chatId]);

  const isPendingRequestChat =
    Boolean(pendingRequest?.chatId && pendingRequest?.chatId === chatId) &&
    pendingRequest?.status === 'pending';
  const isAbandonedRequestChat =
    Boolean(pendingRequest?.chatId && pendingRequest?.chatId === chatId) &&
    pendingRequest?.status === 'abandoned';

  const pendingTopic = useMemo(() => {
    const candidate =
      pendingRequest?.topic ||
      pendingRequest?.queue ||
      pendingRequest?.intent ||
      pendingRequest?.metaData?.topic ||
      pendingRequest?.metaData?.intent ||
      '';
    if (!candidate) return '';
    return `${candidate}`.trim();
  }, [pendingRequest]);

  const typingText = useMemo(() => {
    if (isPendingRequestChat) return '';
    if (!currentChat?.chatId) return '';
    const typingUsers = Array.isArray(typingList?.[currentChat.chatId])
      ? typingList[currentChat.chatId]
      : [];
    if (!typingUsers.length) return '';

    const names = (Array.isArray(currentChat?.users) ? currentChat.users : [])
      .filter(
        (chatUser: any) => typingUsers.includes(chatUser?.uuid) && chatUser?.uuid !== user?.uuid,
      )
      .map(
        (chatUser: any) =>
          chatUser?.name || `${chatUser?.first_name || ''} ${chatUser?.last_name || ''}`.trim(),
      )
      .filter(Boolean);

    return names.length ? `${names.join(', ')} typing...` : 'Typing...';
  }, [typingList, currentChat, user?.uuid, isPendingRequestChat]);

  const acceptPendingRequest = () => {
    const pendingChatId = pendingRequest?.chatId;
    if (!pendingChatId || !user?.uuid || isAcceptingRequest) return;

    setIsAcceptingRequest(true);
    const payload = {
      chatId: pendingChatId,
      company_uuid: user?.company_info?.uuid,
      domain: user?.sip_credentials?.domain || '',
      token: pendingRequest?.token,
      users: [
        {
          uuid: user?.uuid,
          name: `${user?.first_name || user?.user_info?.first_name || ''} ${user?.last_name || user?.user_info?.last_name || ''}`.trim(),
          email: user?.email || user?.user_info?.email,
          extension: user?.extension || user?.user_info?.extension,
        },
        pendingRequest?.users,
      ],
    };

    handleAiChatAccept(payload, (response: any) => {
      setIsAcceptingRequest(false);
      if (response?.status === 200 || response?.success) {
        toast.success('Chat request accepted!');
        setAiChatRequests((prev: any[]) =>
          (Array.isArray(prev) ? prev : []).filter(
            (request: any) => request?.chatId !== pendingChatId,
          ),
        );

        onPendingAccepted?.(pendingChatId);
      } else {
        toast.error(response?.message || 'Failed to accept chat request');
      }
    });
  };

  if (!currentChat?.chatId) {
    const firstName =
      (user?.first_name || '').trim() ||
      String(user?.name || '')
        .trim()
        .split(/\s+/)[0] ||
      'there';

    const tips = [
      {
        icon: ShieldCheck,
        color: 'text-emerald-600',
        bg: 'bg-emerald-50',
        title: 'Keep customer data secure',
        body: 'Follow privacy and compliance guidelines.',
      },
      {
        icon: Users,
        color: 'text-blue-600',
        bg: 'bg-blue-50',
        title: 'Be helpful and empathetic',
        body: 'Every conversation matters.',
      },
      {
        icon: Clock,
        color: 'text-orange-600',
        bg: 'bg-orange-50',
        title: 'Respond promptly',
        body: 'Timely replies create happier customers.',
      },
      {
        icon: BookOpen,
        color: 'text-violet-600',
        bg: 'bg-violet-50',
        title: 'Use AI tools smartly',
        body: 'Get suggestions and resolve issues faster.',
      },
      {
        icon: Heart,
        color: 'text-pink-600',
        bg: 'bg-pink-50',
        title: 'Maintain a positive tone',
        body: 'Be respectful, clear, and solution-focused.',
      },
      {
        icon: BarChart3,
        color: 'text-sky-600',
        bg: 'bg-sky-50',
        title: 'Learn from insights',
        body: 'Use conversation trends to improve over time.',
      },
    ];

    return (
      <div className="h-full w-full overflow-y-auto bg-ucass-gray">
        <div className="mx-auto flex min-h-full w-full max-w-6xl flex-col items-center gap-8 px-6 py-10 lg:flex-row lg:items-center lg:gap-10">
          {/* Left: welcome hero */}
          <div className="w-full lg:flex-1">
            <span className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-4 py-1.5 text-sm font-semibold text-primary">
              <span className="mcm-wave-hand -my-3 -ml-1 text-[40px] leading-none" aria-hidden>
                👋
              </span>
              Welcome back, {firstName}!
            </span>
            <h1 className="mt-6 text-4xl font-extrabold leading-[1.1] tracking-tight text-gray-900 sm:text-5xl">
              Your <span className="text-primary">Support</span>
              <br />
              Workspace
            </h1>
            <p className="mt-4 max-w-md text-[15px] leading-relaxed text-gray-500">
              Handle conversations, get AI assistance, and deliver exceptional customer support —
              all in one place.
            </p>
            <div className="mt-8 w-full max-w-105">
              <SupportHero />
            </div>
          </div>

          {/* Right: things to remember */}
          <div className="w-full rounded-3xl border border-blue-100 bg-blue-50/50 p-6 lg:w-[400px] lg:shrink-0">
            <div className="mb-5 flex items-start gap-3">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white shadow-sm">
                <Lightbulb className="h-6 w-6 text-amber-400" />
              </span>
              <div>
                <div className="text-lg font-bold text-gray-900">Things to remember</div>
                <div className="text-sm text-gray-500">A few quick tips for a better experience</div>
              </div>
            </div>
            <div className="space-y-3">
              {tips.map((tip) => (
                <div key={tip.title} className="flex items-start gap-3">
                  <span
                    className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${tip.bg}`}
                  >
                    <tip.icon className={`h-5 w-5 ${tip.color}`} />
                  </span>
                  <div className="min-w-0">
                    <div className="text-[15px] font-bold text-gray-900">{tip.title}</div>
                    <div className="text-sm leading-snug text-gray-500">{tip.body}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-full flex flex-col bg-white">
      <AgentChatHeader
        currentChat={currentChat}
        onBackToList={onBackToList}
        onOpenProfile={onOpenProfile}
        isPendingRequest={isPendingRequestChat || isAbandonedRequestChat}
        pendingTopic={pendingTopic}
      />
      <div className="flex-1 min-h-0 flex flex-col bg-white">
        <AgentChatMessages currentChat={currentChat} />
        {isPendingRequestChat ? (
          <div className="w-full shrink-0 border-t-[3px] border-t-ucass-orange bg-ucass-orange/10 px-4 py-6">
            <div className="flex flex-col items-center text-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full border border-ucass-orange bg-white">
                <CircleAlert className="h-5 w-5 text-ucass-orange" />
              </div>
              <div className="text-[17px] font-bold leading-snug text-ucass-active">
                Incoming Chat Request
              </div>
              <div className="text-[13px] leading-5 text-muted-foreground">
                <p>This user was handed off by the AI bot and is waiting for assistance.</p>
                <p>Accept to start chatting.</p>
              </div>
              <button
                type="button"
                onClick={acceptPendingRequest}
                disabled={isAcceptingRequest}
                className="mt-1 inline-flex h-10 min-w-[180px] cursor-pointer items-center justify-center rounded-[10px] bg-ucass-active px-6 text-[13px] font-semibold leading-none text-white shadow-sm transition-opacity disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isAcceptingRequest ? 'Accepting...' : 'Accept Request'}
              </button>
            </div>
          </div>
        ) : isAbandonedRequestChat ? (
          <div className="w-full shrink-0 border-t border-destructive/20 bg-destructive/5 px-4 py-5">
            <div className="flex flex-col items-center text-center gap-2">
              <div className="flex h-10 w-10 items-center justify-center rounded-full border border-destructive/30 bg-destructive/10">
                <Clock className="h-5 w-5 text-destructive" />
              </div>
              <div className="text-[15px] font-bold leading-snug text-destructive">
                {currentChat?.endedBy ? 'Chat Closed By User' : 'Chat Auto-Closed (Timeout)'}
              </div>
              {!currentChat?.endedBy && (
                <p className="text-[13px] leading-5 text-destructive">
                  No agent accepted this chat within the 10-minute SLA. The user was emailed the
                  fallback contact details.
                </p>
              )}
            </div>
          </div>
        ) : currentChat?.isEnded ? (
          <div className="w-full shrink-0 border-t border-border bg-ucass-gray px-4 py-4">
            <div className="flex flex-col items-center justify-center gap-1.5">
              <CircleCheck className="h-6 w-6 text-green-500" strokeWidth={1.8} />
              <span className="text-[13px] leading-6 font-medium text-muted-foreground">
                This conversation has been resolved.
              </span>
            </div>
          </div>
        ) : (
          <AgentChatFooter currentChat={currentChat} typingText={typingText} />
        )}
      </div>
    </div>
  );
};

export default AgentChat;
