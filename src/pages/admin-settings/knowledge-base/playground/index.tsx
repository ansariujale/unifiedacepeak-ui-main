import { useQuery } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { handleAlert } from '@/lib/utils';
import { getChatAgentList, getAIReceptionistList } from '@/services/api';
import {
  MessageSquare,
  Phone,
  Search,
  Plus,
  RotateCw,
  MoreVertical,
  Mic,
  Send,
  Settings2,
  Info,
} from 'lucide-react';
import Loader from '@/components/custom/loader';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import VoiceTestCard from './voice-test-card';
import { getAi360WidgetKey, getChatWidgetScriptSrc } from '../ai-agent/chat-agent-configure-modal';

const EMBED_SCRIPT_ID = 'ai-agent-test-embed-script';
const CHAT_WIDGET_MAX_WIDTH = 360;
const CHAT_WIDGET_MAX_HEIGHT = 440;
const CALL_WIDGET_MAX_WIDTH = 360;
const CALL_WIDGET_MAX_HEIGHT = 440;
const CHAT_WIDGET_VIEWPORT_GAP = 8;

/* Console design tokens — white + red + black */
const RED = '#E50914';
/* Single hover / pressed red used everywhere on this page */
const RED_HOVER = '#B91C1C';
const RED_SOFT = '#FFF1F2';
const BORDER = '#E5E7EB';
const INK = '#111111';
const MUTED = '#6B7280';
const SURFACE = '#FAFAFA';
/* Agent bubbles reuse the selected-row gray */
const BUBBLE = '#E5E7EB';
const GREEN = '#22C55E';

/* Compact preview card — the live widget is docked into exactly this box */
const PREVIEW_CARD_WIDTH = 360;
const PREVIEW_CARD_HEIGHT = 440;

const DEFAULT_SUGGESTIONS = [
  'How do payouts work?',
  'Why did my payment fail?',
  'Explore Stripe Billing',
];

const sanitizeWidgetKey = (value: string) => value.replace(/[^a-zA-Z0-9_-]/g, '');

const getAgentName = (agent: any) =>
  String(agent?.agentName || agent?.name || agent?.agent_name || '').trim();

const getAgentBrain = (agent: any) => agent?.forward_call_actions?.chatbot_builder?.brain;

const getAgentWelcome = (agent: any) =>
  String(getAgentBrain(agent)?.welcomeMessage || '').trim() || 'Hi! What can I help you with?';

const getAgentSuggestions = (agent: any): string[] => {
  const brain = getAgentBrain(agent);
  const raw = brain?.suggestedQuestions || brain?.customGreetings;
  const list = Array.isArray(raw)
    ? raw.map((item: any) => String(item?.question ?? item?.label ?? item ?? '').trim())
    : [];
  const cleaned = list.filter(Boolean);
  return cleaned.length ? cleaned.slice(0, 4) : DEFAULT_SUGGESTIONS;
};

type PreviewMessage = { id: number; role: 'agent' | 'user'; text: string };

/**
 * Sandbox replies. The real conversation runs inside the embedded widget; when
 * no widget is available this keeps the preview interactive with sample answers.
 */
const buildSandboxReply = (question: string, agentName: string) => {
  const q = question.toLowerCase();

  if (/^(hi|hey|hello|yo)\b/.test(q) || q.includes('how are you')) {
    return `Hi there! I'm ${agentName}. Ask me anything about your account, billing, or payments and I'll do my best to help.`;
  }
  if (q.includes('payout')) {
    return 'Payouts settle to your connected bank account on a rolling 2-day schedule. You can change the cadence to weekly or monthly under Settings → Payouts.';
  }
  if (q.includes('payment') && (q.includes('fail') || q.includes('decline'))) {
    return 'Payments usually fail for three reasons: insufficient funds, an expired card, or a bank-side block. Retrying with an updated card resolves most cases.';
  }
  if (q.includes('billing') || q.includes('stripe') || q.includes('invoice')) {
    return 'Billing covers subscriptions, invoices, and metered usage. I can walk you through plans, proration, or how to pull an invoice PDF.';
  }
  if (q.includes('refund')) {
    return 'Refunds can be issued in full or partially within 90 days of the original charge, and typically reach the customer in 5–10 business days.';
  }
  if (q.includes('price') || q.includes('cost') || q.includes('plan')) {
    return 'Plans scale with usage. Tell me roughly how many conversations you expect each month and I can point you at the right tier.';
  }
  if (q.endsWith('?')) {
    return `Good question. In this sandbox I answer from sample data, so here's the short version: ${agentName} would look this up in its knowledge base and reply with the matching article.`;
  }
  return `Got it — "${question}". This is a sandbox session, so I'm replying with sample content. Connect this agent's widget to test its real answers.`;
};

const unloadEmbedScript = () => {
  document
    .querySelectorAll(`script#${EMBED_SCRIPT_ID}, script[data-playground-widget-script="true"]`)
    .forEach((script) => script.remove());

  ['agent-chat-widget', 'agent-talk-widget'].forEach((id) => {
    const iframe = document.getElementById(id);
    if (iframe) iframe.remove();
  });

  const widgetRoot = document.getElementById('ai-chat-widget-root');
  if (widgetRoot) widgetRoot.innerHTML = '';
  document
    .querySelectorAll(
      '[data-ai-widget], [id^="ai-widget"], [id^="mcm-widget"], [id^="ai360-widget-"]',
    )
    .forEach((el) => el.remove());
};


/* Non-red monogram palette — picked deterministically from the agent name. */
const AVATAR_COLORS = [
  { bg: '#EEF2FF', fg: '#4338CA' },
  { bg: '#ECFDF5', fg: '#047857' },
  { bg: '#FFF7ED', fg: '#C2410C' },
  { bg: '#EFF6FF', fg: '#1D4ED8' },
  { bg: '#F5F3FF', fg: '#6D28D9' },
  { bg: '#ECFEFF', fg: '#0E7490' },
  { bg: '#FEFCE8', fg: '#A16207' },
  { bg: '#FDF2F8', fg: '#9D174D' },
];

/** Same name always gets the same swatch, so rows stay stable across renders. */
const getAvatarColors = (name: string) => {
  let hash = 0;
  for (let i = 0; i < name.length; i += 1) {
    hash = (hash * 31 + name.charCodeAt(i)) % 100000;
  }
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
};

/** Monogram avatar with an online dot — the initial comes from the agent name. */
function AgentAvatar({
  name,
  size = 36,
  online = true,
  onDark = false,
}: {
  name?: string;
  size?: number;
  online?: boolean;
  onDark?: boolean;
}) {
  const trimmed = String(name || '').trim();
  const initial = trimmed.charAt(0).toUpperCase() || '?';
  const swatch = getAvatarColors(trimmed || '?');
  return (
    <span className="relative inline-flex shrink-0" style={{ width: size, height: size }}>
      <span
        className="flex items-center justify-center rounded-full font-semibold"
        style={{
          width: size,
          height: size,
          fontSize: Math.max(11, Math.round(size * 0.42)),
          background: onDark ? 'rgba(255,255,255,0.16)' : swatch.bg,
          color: onDark ? '#FFFFFF' : swatch.fg,
        }}
      >
        {initial}
      </span>
      {online && (
        <span
          className="absolute bottom-0 right-0 rounded-full"
          style={{
            width: Math.max(8, Math.round(size * 0.26)),
            height: Math.max(8, Math.round(size * 0.26)),
            background: '#16A34A',
            border: `2px solid ${onDark ? RED : '#FFFFFF'}`,
          }}
        />
      )}
    </span>
  );
}

/** Three-dot menu used by both the mock card header and the live-widget overlay. */
function PreviewMenu({
  onRestart,
  onSettings,
  className,
}: {
  onRestart: () => void;
  onSettings: () => void;
  className?: string;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button type="button" title="More options" className={className}>
          <MoreVertical className="h-4 w-4" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48 border-0">
        <DropdownMenuItem
          onClick={onRestart}
          className="focus:bg-[#FFF1F2] focus:text-[#E50914] [&:focus_svg]:text-[#E50914]"
        >
          <RotateCw className="h-4 w-4" />
          Reset conversation
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={onSettings}
          className="focus:bg-[#FFF1F2] focus:text-[#E50914] [&:focus_svg]:text-[#E50914]"
        >
          <Settings2 className="h-4 w-4" />
          Agent settings
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function StatBlock({ label, value, accent }: { label: string; value: string | number; accent?: boolean }) {
  return (
    <div className="text-center sm:text-left">
      <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: MUTED }}>
        {label}
      </p>
      <p className="text-lg font-bold leading-6" style={{ color: accent ? RED : INK }}>
        {value}
      </p>
    </div>
  );
}

function Playground() {
  const location = useLocation();
  const navigate = useNavigate();
  const initialState = location.state as any;
  const [activeTab, setActiveTab] = useState<'chat' | 'voice'>(
    initialState?.activeTab === 'chat' ? 'chat' : 'voice',
  );
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedAgent, setSelectedAgent] = useState<any>(initialState?.selectedAgent || null);
  const [activeEmbedId, setActiveEmbedId] = useState<string | null>(null);
  const [draftMessage, setDraftMessage] = useState('');
  /** Sandbox conversation shown after the welcome bubble. */
  const [messages, setMessages] = useState<PreviewMessage[]>([]);
  const [isAgentTyping, setIsAgentTyping] = useState(false);
  const replyTimerRef = useRef<number | null>(null);
  const messageIdRef = useRef(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  /** Which segmented-control button is currently held down (red only while pressed). */
  const [pressedTab, setPressedTab] = useState<'chat' | 'voice' | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const [coords, setCoords] = useState({ top: 0, left: 0, width: 0, height: 0 });

  const embedLoadingRef = useRef(false);
  const embedRequestIdRef = useRef(0);
  const widgetOpenTimerRef = useRef<number | null>(null);
  const activeWidgetIdRef = useRef('');

  const invalidateEmbedRequest = useCallback(() => {
    embedRequestIdRef.current += 1;
    embedLoadingRef.current = false;
    if (widgetOpenTimerRef.current !== null) {
      window.clearTimeout(widgetOpenTimerRef.current);
      widgetOpenTimerRef.current = null;
    }
    unloadEmbedScript();
    setActiveEmbedId(null);
  }, []);

  const widgetFrame = useMemo(() => {
    const viewportWidth =
      typeof window === 'undefined' ? coords.left + coords.width : window.innerWidth;
    const viewportHeight =
      typeof window === 'undefined' ? coords.top + coords.height : window.innerHeight;
    // The widget fills the compact card slot exactly, clamped to the viewport.
    const maxWidgetWidth = activeTab === 'voice' ? CALL_WIDGET_MAX_WIDTH : CHAT_WIDGET_MAX_WIDTH;
    const maxWidgetHeight = activeTab === 'voice' ? CALL_WIDGET_MAX_HEIGHT : CHAT_WIDGET_MAX_HEIGHT;
    const viewportWidthLimit = Math.max(0, viewportWidth - CHAT_WIDGET_VIEWPORT_GAP * 2);
    const width = Math.min(maxWidgetWidth, Math.max(0, coords.width), viewportWidthLimit);
    const viewportHeightLimit = Math.max(0, viewportHeight - coords.top - CHAT_WIDGET_VIEWPORT_GAP);
    const height = Math.min(maxWidgetHeight, Math.max(0, coords.height), viewportHeightLimit);
    const centeredLeft = coords.left + (coords.width - width) / 2;
    const maxLeft = viewportWidth - width - CHAT_WIDGET_VIEWPORT_GAP;
    const left = Math.max(CHAT_WIDGET_VIEWPORT_GAP, Math.min(centeredLeft, maxLeft));
    const centeredTop = coords.top + Math.max(0, (coords.height - height) / 2);
    const maxTop = viewportHeight - height - CHAT_WIDGET_VIEWPORT_GAP;
    const top = Math.max(CHAT_WIDGET_VIEWPORT_GAP, Math.min(centeredTop, maxTop));

    return { top, left, width, height };
  }, [activeTab, coords]);

  // Query chatbot agents
  const { data: chatAgents = [], isLoading: isChatLoading } = useQuery({
    queryKey: ['getChatAgentList', 'playground-list'],
    queryFn: () => getChatAgentList({ page: 1, limit: 1000, filters: [], search: '' }),
    select: (data: any) => data?.data?.data?.result?.rows || [],
  });

  // Query receptionist agents
  const { data: receptionistAgents = [], isLoading: isReceptionistLoading } = useQuery({
    queryKey: ['getAIReceptionistList', 'playground-list'],
    queryFn: () => getAIReceptionistList({ page: 1, limit: 1000, filters: [], search: '' }),
    select: (data: any) => data?.data?.data?.result?.rows || [],
  });

  // Monitor bounding rect of preview container for absolute/fixed iframe positioning
  useEffect(() => {
    if (!selectedAgent || !containerRef.current) return;

    const updateCoords = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        setCoords({
          top: rect.top,
          left: rect.left,
          width: rect.width,
          height: rect.height,
        });
      }
    };

    updateCoords();

    const resizeObserver = new ResizeObserver(() => {
      updateCoords();
    });
    resizeObserver.observe(containerRef.current);

    window.addEventListener('resize', updateCoords);
    window.addEventListener('scroll', updateCoords);
    return () => {
      resizeObserver.disconnect();
      window.removeEventListener('resize', updateCoords);
      window.removeEventListener('scroll', updateCoords);
    };
  }, [selectedAgent, activeTab]);

  // Cleanup embed script on unmount
  useEffect(() => {
    return () => {
      embedRequestIdRef.current += 1;
      if (widgetOpenTimerRef.current !== null) {
        window.clearTimeout(widgetOpenTimerRef.current);
      }
      unloadEmbedScript();
    };
  }, []);

  // Sync selected agent when tab changes
  useEffect(() => {
    setSelectedAgent(null);
    setDraftMessage('');
    invalidateEmbedRequest();
  }, [activeTab, invalidateEmbedRequest]);

  useEffect(() => {
    if (!initialState?.selectedAgent) return;
    setSelectedAgent(initialState.selectedAgent);
    setActiveTab(initialState.activeTab === 'chat' ? 'chat' : 'voice');
  }, [initialState?.activeTab, initialState?.selectedAgent]);

  const handleLoadAgentWidget = useCallback(
    (rowData: any) => {
      const rowId = rowData?.agent_uuid || rowData?.id;
      const mode = activeTab === 'voice' ? 'call' : 'chat';
      const widgetKey = getAi360WidgetKey(rowData);
      const widgetScriptSrc = getChatWidgetScriptSrc();

      invalidateEmbedRequest();
      const requestId = embedRequestIdRef.current;

      if (!widgetKey) {
        handleAlert({ text: 'Widget key is missing for this agent.', type: 'error' });
        return;
      }

      if (!widgetScriptSrc) {
        handleAlert({ text: 'AI widget URL is missing.', type: 'error' });
        return;
      }

      embedLoadingRef.current = true;

      try {
        const script = document.createElement('script');
        script.id = EMBED_SCRIPT_ID;
        script.src = widgetScriptSrc;
        script.setAttribute('data-playground-widget-script', 'true');
        script.setAttribute('data-widget-mode', mode);
        script.setAttribute('data-widget-key', widgetKey);
        script.setAttribute('data-position', 'bottom-right');
        script.setAttribute('data-label', 'Need Help?');
        script.async = true;
        script.type = 'text/javascript';
        script.onload = () => {
          script.remove();
          if (requestId !== embedRequestIdRef.current) return;

          widgetOpenTimerRef.current = window.setTimeout(() => {
            widgetOpenTimerRef.current = null;
            if (requestId !== embedRequestIdRef.current) return;

            const widgetId = `ai360-widget-${mode}-${sanitizeWidgetKey(widgetKey)}`;
            document.getElementById(widgetId)?.querySelector('button')?.click();
            embedLoadingRef.current = false;
            setActiveEmbedId(rowId);
          }, 0);
        };
        script.onerror = () => {
          script.remove();
          if (requestId !== embedRequestIdRef.current) return;

          embedLoadingRef.current = false;
          unloadEmbedScript();
          setActiveEmbedId(null);
          handleAlert({
            text: `Failed to load ${mode === 'call' ? 'call' : 'chat'} widget. Please try again.`,
            type: 'error',
          });
        };

        document.body.appendChild(script);
      } catch (err) {
        if (requestId !== embedRequestIdRef.current) return;

        embedLoadingRef.current = false;
        console.error('Failed to load embed script:', err);
        handleAlert({
          text: `Failed to load ${mode === 'call' ? 'call' : 'chat'} widget. Please try again.`,
          type: 'error',
        });
        unloadEmbedScript();
      }
    },
    [activeTab, invalidateEmbedRequest],
  );

  const handleSelectAgent = (agent: any) => {
    invalidateEmbedRequest();
    setSelectedAgent(agent);
  };

  /** Tear the widget down; the effect below re-mounts it for the selected agent. */
  const handleRestartSession = useCallback(() => {
    setDraftMessage('');
    setMessages([]);
    setIsAgentTyping(false);
    if (replyTimerRef.current !== null) {
      window.clearTimeout(replyTimerRef.current);
      replyTimerRef.current = null;
    }
    if (!selectedAgent) return;
    invalidateEmbedRequest();
  }, [invalidateEmbedRequest, selectedAgent]);

  const handleOpenAgentSettings = useCallback(() => {
    navigate(
      activeTab === 'chat'
        ? '/admin-settings/knowledge/ai-agent'
        : '/admin-settings/knowledge/ai-receptionist',
    );
  }, [activeTab, navigate]);

  /** Append a message to the sandbox conversation and answer it. */
  const sendSandboxMessage = useCallback(
    (text: string, agentName: string) => {
      const message = text.trim();
      if (!message) return;

      messageIdRef.current += 1;
      setMessages((prev) => [
        ...prev,
        { id: messageIdRef.current, role: 'user', text: message },
      ]);
      setDraftMessage('');
      setIsAgentTyping(true);

      if (replyTimerRef.current !== null) window.clearTimeout(replyTimerRef.current);
      replyTimerRef.current = window.setTimeout(() => {
        replyTimerRef.current = null;
        messageIdRef.current += 1;
        setMessages((prev) => [
          ...prev,
          {
            id: messageIdRef.current,
            role: 'agent',
            text: buildSandboxReply(message, agentName),
          },
        ]);
        setIsAgentTyping(false);
      }, 700);
    },
    [],
  );

  const handleVoiceInput = useCallback(() => {
    handleAlert({
      text: 'Voice input is available inside the live session once an agent is selected.',
      type: 'info',
    });
  }, []);

  // Clear the conversation when the agent or mode changes.
  useEffect(() => {
    setMessages([]);
    setIsAgentTyping(false);
    if (replyTimerRef.current !== null) {
      window.clearTimeout(replyTimerRef.current);
      replyTimerRef.current = null;
    }
  }, [selectedAgent, activeTab]);

  useEffect(
    () => () => {
      if (replyTimerRef.current !== null) window.clearTimeout(replyTimerRef.current);
    },
    [],
  );

  // Keep the newest message in view.
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ block: 'end', behavior: 'smooth' });
  }, [messages, isAgentTyping]);

  const handleAddNewAgent = useCallback(() => {
    navigate(
      activeTab === 'chat'
        ? '/admin-settings/knowledge/ai-agent'
        : '/admin-settings/knowledge/ai-receptionist',
    );
  }, [activeTab, navigate]);

  useEffect(() => {
    if (!selectedAgent) return;
    const rowId = selectedAgent?.agent_uuid || selectedAgent?.id;
    if (activeEmbedId === rowId || embedLoadingRef.current) return;
    const timer = window.setTimeout(() => {
      handleLoadAgentWidget(selectedAgent);
    }, 50);
    return () => window.clearTimeout(timer);
  }, [activeEmbedId, handleLoadAgentWidget, selectedAgent]);

  const currentAgentsList = useMemo(() => {
    return activeTab === 'chat' ? chatAgents : receptionistAgents;
  }, [activeTab, chatAgents, receptionistAgents]);

  const filteredAgents = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return currentAgentsList;
    // Match the agent name plus the type label shown on the row.
    const typeText = activeTab === 'chat' ? 'chat agent' : 'voice agent';
    return currentAgentsList.filter((agent: any) => {
      const name = getAgentName(agent).toLowerCase();
      return name.includes(query) || typeText.includes(query);
    });
  }, [activeTab, currentAgentsList, searchQuery]);

  const totalAgentsCount = chatAgents.length + receptionistAgents.length;
  const isPageLoading = isChatLoading || isReceptionistLoading;

  const isWidgetActive = useMemo(() => {
    if (!selectedAgent) return false;
    const rowId = selectedAgent?.agent_uuid || selectedAgent?.id;
    return activeEmbedId === rowId;
  }, [selectedAgent, activeEmbedId]);

  const activeWidgetMode = activeTab === 'voice' ? 'call' : 'chat';
  const activeWidgetKey = selectedAgent ? getAi360WidgetKey(selectedAgent) : '';
  const activeWidgetId = activeWidgetKey
    ? `ai360-widget-${activeWidgetMode}-${sanitizeWidgetKey(activeWidgetKey)}`
    : '';
  activeWidgetIdRef.current = activeWidgetId;

  useEffect(() => {
    const removeInactiveWidgetRoots = () => {
      document
        .querySelectorAll<HTMLElement>(
          'body > [data-ai-widget], body > [id^="ai-widget"], body > [id^="mcm-widget"], body > [id^="ai360-widget-"]',
        )
        .forEach((element) => {
          if (!activeWidgetIdRef.current || element.id !== activeWidgetIdRef.current) {
            element.remove();
          }
        });
    };

    removeInactiveWidgetRoots();
    const observer = new MutationObserver(removeInactiveWidgetRoots);
    observer.observe(document.body, { childList: true, subtree: true });

    return () => observer.disconnect();
  }, []);

  const typeLabel = activeTab === 'chat' ? 'Chat Agent' : 'Voice Agent';
  const previewAgent = selectedAgent || filteredAgents?.[0] || null;
  const previewName = getAgentName(previewAgent) || 'Your agent';
  const previewSuggestions = getAgentSuggestions(previewAgent);

  return (
    <section
      className="playground-scroll flex h-full min-h-0 w-full flex-col overflow-hidden bg-[#efefef]"
      style={{ color: INK }}
    >
      {/* Scrollbars stay functional but are visually hidden inside the playground */}
      <style>{`
        .playground-scroll,
        .playground-scroll * {
          scrollbar-width: none;
          -ms-overflow-style: none;
        }
        .playground-scroll::-webkit-scrollbar,
        .playground-scroll *::-webkit-scrollbar {
          width: 0;
          height: 0;
          display: none;
        }
        /* Every button on this page turns its text/icon red on hover, except the
           segmented AI Receptionist / AI Chatbot tabs, which stay black/gray. */
        .playground-scroll button:not(.playground-tab):not(.playground-add-agent):not(.playground-voice-cta):hover:not(:disabled),
        .playground-scroll button:not(.playground-tab):not(.playground-add-agent):not(.playground-voice-cta):hover:not(:disabled) svg,
        .playground-scroll button:not(.playground-tab):not(.playground-add-agent):not(.playground-voice-cta):hover:not(:disabled) p,
        .playground-scroll a:hover,
        .playground-hover-red:hover:not(:disabled),
        .playground-hover-red:hover:not(:disabled) svg {
          color: ${RED_HOVER} !important;
        }
        /* Agent list uses a lighter red on hover than the rest of the page */
        .playground-scroll button.playground-agent-row:hover:not(:disabled),
        .playground-scroll button.playground-agent-row:hover:not(:disabled) p {
          color: #ef4444 !important;
        }
        /* On an agent row only the name reddens — the type label stays black */
        .playground-scroll button:hover:not(:disabled) p.playground-agent-type {
          color: ${INK} !important;
        }
        /* Keep solid-red buttons (send) legible — their icon stays white */
        .playground-scroll button.playground-solid-red:hover:not(:disabled),
        .playground-scroll button.playground-solid-red:hover:not(:disabled) svg {
          color: #ffffff !important;
        }
      `}</style>

      {/* Dynamic style override to dock the AI360 widget inside the preview frame */}
      {selectedAgent && activeWidgetId && (
        <style>{`
          body > [data-ai-widget],
          body > [id^="ai-widget"],
          body > [id^="mcm-widget"],
          body > [id^="ai360-widget-"] {
            display: none !important;
          }
          #${activeWidgetId} {
            display: block !important;
            position: fixed !important;
            top: ${widgetFrame.top}px !important;
            left: ${widgetFrame.left}px !important;
            right: auto !important;
            bottom: auto !important;
            width: ${widgetFrame.width}px !important;
            min-width: 0 !important;
            max-width: calc(100vw - ${CHAT_WIDGET_VIEWPORT_GAP * 2}px) !important;
            height: ${widgetFrame.height}px !important;
            max-height: calc(100vh - ${CHAT_WIDGET_VIEWPORT_GAP * 2}px) !important;
            box-sizing: border-box !important;
            z-index: 40 !important;
            margin: 0 !important;
            transform: none !important;
          }
          #${activeWidgetId} iframe {
            width: 100% !important;
            min-width: 0 !important;
            max-width: 100% !important;
            height: 100% !important;
            max-height: 100% !important;
            box-sizing: border-box !important;
            border: 1px solid ${BORDER} !important;
            border-radius: 16px !important;
            box-shadow: 0 4px 16px rgba(17,17,17,0.06) !important;
          }
        `}</style>
      )}

      {/* Breadcrumb */}
      <div
        className="flex min-h-[56px] shrink-0 items-center justify-between border-b bg-white px-5"
        style={{ borderColor: BORDER }}
      >
        <div className="flex items-center gap-2 text-sm font-semibold">
          <button
            type="button"
            onClick={() => navigate('/admin-settings/knowledge/ai-agent')}
            className="cursor-pointer bg-transparent transition-colors"
            style={{ color: MUTED }}
            onMouseEnter={(e) => (e.currentTarget.style.color = RED_HOVER)}
            onMouseLeave={(e) => (e.currentTarget.style.color = MUTED)}
          >
            AI Agents
          </button>
          <span style={{ color: '#D1D5DB' }}>/</span>
          <span
            className="transition-colors"
            style={{ color: INK }}
            onMouseEnter={(e) => (e.currentTarget.style.color = RED_HOVER)}
            onMouseLeave={(e) => (e.currentTarget.style.color = INK)}
          >
            Playground
          </span>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto px-3 pb-4 pt-1 sm:overflow-hidden sm:px-5 sm:pb-5">
        {/* Summary banner */}
        <div
          className="flex shrink-0 flex-col items-start justify-between gap-3 px-4 py-1 sm:flex-row sm:items-center"
        >
          <div className="flex min-w-0 items-center gap-3">
            <div className="min-w-0">
              <h1
                className="flex items-center gap-2 text-lg font-medium leading-6 tracking-tight"
                style={{ color: INK }}
              >
                <span
                  style={{
                    color: INK,
                    fontFamily: "'Instrument Serif', Georgia, 'Times New Roman', serif",
                    fontStyle: 'italic',
                    fontWeight: 400,
                    fontSize: 27,
                    lineHeight: 1.1,
                  }}
                >
                  Agent Playground
                </span>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      aria-label="About the Agent Playground"
                      className="playground-hover-red flex cursor-pointer items-center justify-center rounded-full border-0 bg-transparent font-small p-0 transition-colors"
                      style={{ color: MUTED }}
                    >
                      <Info className="h-5 w-5" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent
                    side="right"
                    className="w-max max-w-[340px] text-black [&_svg]:fill-[#fdf7f5]"
                    style={{
                      background: '#fdf7f5',
                      border: 'none',
                      color: '#000',
                      boxShadow: '0 6px 20px rgba(17,17,17,0.18)',
                    }}
                  >
                    Test any AI Receptionist (voice) or Chat Agent in a safe sandbox. Sessions don't
                    count toward analytics.
                  </TooltipContent>
                </Tooltip>
              </h1>
            </div>
          </div>

          <div className="flex shrink-0 flex-wrap items-center gap-x-4 gap-y-2 sm:gap-6">
            <StatBlock
              label="Total Agents"
              value={isPageLoading ? '—' : totalAgentsCount}
              accent
            />
            <div className="h-7 w-px" style={{ background: BORDER }} />
            <StatBlock
              label="Receptionists"
              value={isPageLoading ? '—' : receptionistAgents?.length || 0}
            />
            <div className="h-7 w-px" style={{ background: BORDER }} />
            <StatBlock
              label="AI Chatbots"
              value={isPageLoading ? '—' : chatAgents?.length || 0}
            />
          </div>
        </div>

        {/* Workspace */}
        <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto sm:flex-row sm:gap-4 sm:overflow-hidden">
          {/* LEFT — agent selector */}
          <div
            className="flex max-h-[320px] w-full shrink-0 flex-col overflow-hidden rounded-2xl border bg-white shadow-sm sm:max-h-none sm:w-[320px] md:w-[380px]"
            style={{ borderColor: BORDER }}
          >
            <div className="space-y-3 border-b p-3" style={{ borderColor: BORDER }}>
              {/* Segmented control */}
              <div
                className="relative flex gap-1 rounded-xl border p-1"
                style={{ background: '#ECEEF1', borderColor: '#DDE0E5' }}
              >
                {/* Sliding thumb — marks the active side and animates between them */}
                <span
                  aria-hidden
                  className="absolute rounded-lg transition-all duration-200 ease-out"
                  style={{
                    top: 4,
                    bottom: 4,
                    left: activeTab === 'voice' ? 4 : 'calc(50% + 2px)',
                    width: 'calc(50% - 6px)',
                    background: '#FFFFFF',
                    border: '1px solid #C9CDD4',
                    boxShadow: '0 1px 4px rgba(17,17,17,0.18)',
                  }}
                />
                {(
                  [
                    { key: 'voice', label: 'AI Receptionist', Icon: Phone },
                    { key: 'chat', label: 'AI Chatbot', Icon: MessageSquare },
                  ] as const
                ).map(({ key, label, Icon }) => {
                  const active = activeTab === key;
                  // Red shows only while the button is held down; otherwise black.
                  const pressed = pressedTab === key;
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setActiveTab(key)}
                      onPointerDown={() => setPressedTab(key)}
                      onPointerUp={() => setPressedTab(null)}
                      onPointerLeave={() => setPressedTab(null)}
                      onPointerCancel={() => setPressedTab(null)}
                      onBlur={() => setPressedTab(null)}
                      className="playground-tab relative z-10 flex flex-1 cursor-pointer items-center justify-center gap-2 whitespace-nowrap rounded-lg border-0 bg-transparent px-2 py-2 text-sm font-bold transition-colors"
                      style={{
                        background: pressed ? RED_SOFT : 'transparent',
                        color: pressed ? RED_HOVER : active ? INK : '#5B6270',
                      }}
                      onMouseEnter={(e) => {
                        // Hover turns the label (and its icon, via currentColor) red.
                        e.currentTarget.style.color = RED_HOVER;
                      }}
                      onMouseLeave={(e) => {
                        // Back to black for the active tab, gray for the others.
                        e.currentTarget.style.color = active ? INK : '#5B6270';
                      }}
                    >
                      <Icon className="h-4 w-4" />
                      {label}
                    </button>
                  );
                })}
              </div>

              {/* Search */}
              <div className="relative">
                <Search
                  className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2"
                  style={{ color: '#9CA3AF' }}
                />
                <input
                  type="text"
                  placeholder="Search agents..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full rounded-xl border bg-white py-2 pl-9 pr-3 text-sm outline-none transition-all placeholder:text-gray-400 focus:outline-none focus-visible:outline-none"
                  style={{ borderColor: BORDER, color: INK, outline: 'none', boxShadow: 'none' }}
                  onFocus={(e) => {
                    e.currentTarget.style.borderColor = RED;
                    e.currentTarget.style.boxShadow = 'none';
                  }}
                  onBlur={(e) => (e.currentTarget.style.borderColor = BORDER)}
                />
              </div>
            </div>

            {/* Agent list */}
            <div className="flex-1 space-y-1 overflow-y-auto p-2">
              {isPageLoading ? (
                <div className="flex flex-col items-center justify-center gap-2 py-10">
                  <Loader variant="custom" />
                  <p className="text-xs" style={{ color: MUTED }}>
                    Loading agents...
                  </p>
                </div>
              ) : filteredAgents.length === 0 ? (
                <div className="px-4 py-10 text-center">
                  <div
                    className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full"
                    style={{ background: SURFACE }}
                  >
                    <Search className="h-4 w-4" style={{ color: '#9CA3AF' }} />
                  </div>
                  <p className="text-sm font-semibold" style={{ color: INK }}>
                    No agents found
                  </p>
                  <p className="mt-1 text-xs leading-relaxed" style={{ color: MUTED }}>
                    {searchQuery.trim()
                      ? 'Try a different search term.'
                      : `Create your first ${typeLabel.toLowerCase()} to start testing.`}
                  </p>
                </div>
              ) : (
                filteredAgents.map((agent: any) => {
                  const agentId = agent?.agent_uuid || agent?.id;
                  const isSelected =
                    selectedAgent &&
                    (selectedAgent?.agent_uuid === agentId || selectedAgent?.id === agentId);

                  return (
                    <button
                      key={agentId}
                      type="button"
                      onClick={() => handleSelectAgent(agent)}
                      className="playground-agent-row relative flex w-full cursor-pointer items-center gap-3 overflow-hidden rounded-xl border p-2.5 text-left transition-all"
                      style={{
                        background: isSelected ? '#E5E7EB' : '#FFFFFF',
                        borderColor: 'transparent',
                        boxShadow: 'none',
                      }}
                      onMouseEnter={(e) => {
                        if (!isSelected) e.currentTarget.style.background = RED_SOFT;
                      }}
                      onMouseLeave={(e) => {
                        if (!isSelected) e.currentTarget.style.background = '#FFFFFF';
                      }}
                    >
                      <AgentAvatar name={getAgentName(agent)} size={36} />
                      <div className="min-w-0">
                        <p
                          className="truncate text-sm font-semibold leading-5"
                          style={{ color: INK }}
                        >
                          {getAgentName(agent) || 'Untitled agent'}
                        </p>
                        <p
                          className="playground-agent-type truncate text-xs leading-4"
                          style={{ color: INK }}
                        >
                          {typeLabel}
                        </p>
                      </div>
                    </button>
                  );
                })
              )}
            </div>

            {/* Add new agent */}
            <div className="border-t p-3" style={{ borderColor: BORDER }}>
              <button
                type="button"
                onClick={handleAddNewAgent}
                className="playground-add-agent flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl border-2 py-2.5 text-sm font-extrabold shadow-sm transition-colors duration-200 ease-out focus:outline-none focus-visible:outline-none"
                style={{ borderColor: '#D1D5DB', color: INK, background: '#F9FAFB' }}
                onMouseEnter={(e) => {
                  // Hover: border + text + icon go red; subtle red-tinted fill.
                  e.currentTarget.style.borderColor = RED;
                  e.currentTarget.style.color = RED;
                  e.currentTarget.style.background = RED_SOFT;
                }}
                onMouseLeave={(e) => {
                  // Back to a neutral outlined button.
                  e.currentTarget.style.borderColor = '#D1D5DB';
                  e.currentTarget.style.color = INK;
                  e.currentTarget.style.background = '#F9FAFB';
                }}
                onFocus={(e) => {
                  // Keyboard focus mirrors the hover state (no blue browser ring).
                  e.currentTarget.style.borderColor = RED;
                  e.currentTarget.style.color = RED;
                  e.currentTarget.style.background = RED_SOFT;
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = '#D1D5DB';
                  e.currentTarget.style.color = INK;
                  e.currentTarget.style.background = '#F9FAFB';
                }}
              >
                <Plus className="h-4 w-4" />
                Add New Agent
              </button>
            </div>
          </div>

          {/* RIGHT — dotted workspace canvas holding one compact chatbot card */}
          <div
            className="relative flex min-h-[420px] flex-1 items-center justify-center overflow-hidden rounded-2xl border p-3 sm:min-h-0 sm:p-4"
            style={{
              borderColor: BORDER,
              background: '#FFFFFF',
            }}
          >
            {/* Card slot — the live widget is docked exactly over this box */}
            <div
              className="relative shrink"
              style={{
                width: `min(${PREVIEW_CARD_WIDTH}px, 100%)`,
                height: `min(${PREVIEW_CARD_HEIGHT}px, 100%)`,
                minHeight: 0,
              }}
            >
              <div ref={containerRef} className="absolute inset-0">
                <div id="ai-chat-widget-root" className="h-full w-full" />
              </div>

              {/* Floating controls stay reachable while the live widget occupies the slot */}
              {isWidgetActive && (
                <div className="absolute right-3 top-3 z-50 flex items-center gap-1">
                  <PreviewMenu
                    onRestart={handleRestartSession}
                    onSettings={handleOpenAgentSettings}
                    className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg border-0 bg-black/20 text-white backdrop-blur-sm transition-colors hover:bg-black/35"
                  />
                </div>
              )}

              {/* Mock/preview card — shown whenever the live widget is not occupying the slot */}
              {/* AI Receptionist -> voice testing panel (chatbot tab is untouched) */}
              {!isWidgetActive && activeTab === 'voice' && (
                <VoiceTestCard
                  agentName={previewName}
                  phoneNumber={
                    previewAgent?.did ||
                    previewAgent?.phone_number ||
                    previewAgent?.phoneNumber ||
                    previewAgent?.number ||
                    undefined
                  }
                  location={previewAgent?.location || previewAgent?.language || undefined}
                  onError={(text) => handleAlert({ text, type: 'error' })}
                />
              )}
              
              {!isWidgetActive && activeTab !== 'voice' && (
                <div
                  className="absolute inset-0 z-10 flex flex-col overflow-hidden rounded-2xl border bg-white"
                  style={{ borderColor: BORDER, boxShadow: '0 4px 16px rgba(17,17,17,0.06)' }}
                >
                  {/* Card header */}
                  <div
                    className="flex h-[55px] shrink-0 items-center justify-between gap-2 border-b px-4"
                    style={{ background: '#FFFFFF', borderColor: BORDER }}
                  >
                    <div className="flex min-w-0 items-center gap-2.5">
                      <AgentAvatar name={previewName} size={30} online={false} />
                      <div className="min-w-0">
                        <p
                          className="truncate text-sm font-semibold leading-4"
                          style={{ color: INK }}
                        >
                          {previewName}
                        </p>
                        <p
                          className="mt-0.5 flex items-center gap-1.5 text-[11px] leading-3"
                          style={{ color: MUTED }}
                        >
                          <span
                            className="inline-block h-1.5 w-1.5 rounded-full"
                            style={{ background: GREEN }}
                          />
                          {typeLabel}
                        </p>
                      </div>
                    </div>

                    <div className="flex shrink-0 items-center gap-0.5">
                      <PreviewMenu
                        onRestart={handleRestartSession}
                        onSettings={handleOpenAgentSettings}
                        className="playground-hover-red flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg border-0 bg-transparent text-[#111111] transition-colors"
                      />
                    </div>
                  </div>

                  {/* Card body */}
                  <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-4">
                    {selectedAgent && activeWidgetKey ? (
                      <div className="flex flex-1 flex-col items-center justify-center gap-2 text-center">
                        <Loader variant="custom" />
                        <p className="text-xs" style={{ color: MUTED }}>
                          Starting {activeWidgetMode === 'call' ? 'voice' : 'chat'} session with{' '}
                          {previewName}...
                        </p>
                      </div>
                    ) : (
                      <>
                        <div className="flex items-start gap-2.5">
                          <AgentAvatar name={previewName} size={28} online={false} />
                          <div
                            className="max-w-[75%] rounded-2xl rounded-tl-md px-3.5 py-2.5 text-sm leading-snug"
                            style={{ background: BUBBLE, color: INK }}
                          >
                            {getAgentWelcome(previewAgent)}
                          </div>
                        </div>

                        {messages.length === 0 && (
                          <div className="flex flex-col items-end gap-2">
                            {previewSuggestions.map((question) => (
                              <button
                                key={question}
                                type="button"
                                onClick={() => sendSandboxMessage(question, previewName)}
                                className="cursor-pointer rounded-full border bg-white px-3.5 py-2 text-xs font-medium transition-colors"
                                style={{ borderColor: RED, color: RED }}
                                onMouseEnter={(e) => (e.currentTarget.style.background = RED_SOFT)}
                                onMouseLeave={(e) => (e.currentTarget.style.background = '#FFFFFF')}
                              >
                                {question}
                              </button>
                            ))}
                          </div>
                        )}

                        {messages.map((message) =>
                          message.role === 'user' ? (
                            <div key={message.id} className="flex justify-end">
                              <div
                                className="max-w-[80%] rounded-2xl rounded-br-md px-3.5 py-2.5 text-sm leading-snug text-white"
                                style={{ background: RED }}
                              >
                                {message.text}
                              </div>
                            </div>
                          ) : (
                            <div key={message.id} className="flex items-start gap-2.5">
                              <AgentAvatar name={previewName} size={28} online={false} />
                              <div
                                className="max-w-[75%] rounded-2xl rounded-tl-md px-3.5 py-2.5 text-sm leading-snug"
                                style={{ background: BUBBLE, color: INK }}
                              >
                                {message.text}
                              </div>
                            </div>
                          ),
                        )}

                        {isAgentTyping && (
                          <div className="flex items-start gap-2.5">
                            <AgentAvatar name={previewName} size={28} online={false} />
                            <div
                              className="flex items-center gap-1 rounded-2xl rounded-tl-md px-3.5 py-3"
                              style={{ background: BUBBLE }}
                            >
                              {[0, 1, 2].map((dot) => (
                                <span
                                  key={dot}
                                  className="inline-block h-1.5 w-1.5 animate-pulse rounded-full"
                                  style={{
                                    background: MUTED,
                                    animationDelay: `${dot * 150}ms`,
                                  }}
                                />
                              ))}
                            </div>
                          </div>
                        )}

                        <div ref={messagesEndRef} />
                      </>
                    )}
                  </div>

                  {/* Card input */}
                  <div className="shrink-0 border-t px-3 pb-3 pt-2.5" style={{ borderColor: BORDER }}>
                    <form
                      onSubmit={(event) => {
                        event.preventDefault();
                        sendSandboxMessage(draftMessage, previewName);
                      }}
                      className="flex items-center gap-1.5 rounded-full border bg-white py-1 pl-4 pr-1 transition-colors"
                      style={{ borderColor: BORDER }}
                    >
                      <input
                        type="text"
                        value={draftMessage}
                        onChange={(e) => setDraftMessage(e.target.value)}
                        placeholder="Type your message..."
                        className="min-w-0 flex-1 border-0 bg-transparent py-1.5 text-sm outline-none placeholder:text-gray-400 focus:outline-none focus-visible:outline-none"
                        style={{ color: INK, outline: 'none', boxShadow: 'none' }}
                        onFocus={(e) => {
                          const form = e.currentTarget.closest('form');
                          if (form) form.style.borderColor = RED;
                        }}
                        onBlur={(e) => {
                          const form = e.currentTarget.closest('form');
                          if (form) form.style.borderColor = BORDER;
                        }}
                      />
                      <button
                        type="button"
                        title="Voice input"
                        onClick={handleVoiceInput}
                        className="flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-full border-0 bg-transparent transition-colors hover:bg-gray-100"
                      >
                        <Mic className="h-4 w-4" style={{ color: MUTED }} />
                      </button>
                      <button
                        type="submit"
                        title="Send"
                        disabled={!draftMessage.trim()}
                        className="playground-solid-red flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-full border-0 transition-opacity disabled:cursor-not-allowed disabled:opacity-40"
                        style={{ background: RED }}
                      >
                        <Send className="h-3.5 w-3.5 text-white" />
                      </button>
                    </form>

                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export default Playground;
