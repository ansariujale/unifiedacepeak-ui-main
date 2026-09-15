import { Button } from '@/components/ui/button';
// DUMMY DATA - remove this import together with DUMMY_DATA.ts
import { DUMMY_FLAG, DUMMY_RECEPTIONISTS, SHOW_DUMMY_DATA } from '../DUMMY_DATA';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import CustomAvatar from '@/components/custom/custom-avatar';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import BussinessHoursModal from '@/components/custom/bussiness-hours-dialog';
import CustomTooltip from '@/components/custom/custom-tooltip';
import CustomSelect from '@/components/custom/custom-select';
import NumberWithFlag from '@/components/custom/number-with-flag';
import TableManager from '@/components/custom/table-manager';
import { HoverPortalCard, SentimentAnalysisCard } from '@/components/custom/hover-portal-card';
import { OPERATIONAL_HOURS } from '@/components/common-settings/constants';
import { getWeeklyScheduleName } from '@/components/common-settings';
import ForwardActionAllAi from './forward-action-all-ai';
import PromptModal from './update-prompt';
import AssignReceptionistCallerIdModal from './assign-receptionist-caller-id-modal';
import ReceptionistAnalytics from './receptionist-analytics';
import {
  callList,
  cleanupKnowledgeBaseReviewJobs,
  createAiReceptionist,
  CRMIsConnected,
  deleteAIReceptionist,
  downloadPdf,
  finalizeAgentSession,
  AIUserKnowledgeBase,
  getAIAgentType,
  getAIAgentToken,
  getChatAgentList,
  getKnowledgeBaseReviewJob,
  getAIReceptionistList,
  getAIReceptionistMetrics,
  getSessionList,
  getAIVoiceList,
  getAIVoicePreview,
  siteCrawl,
  siteList,
  startKnowledgeBaseReviewJob,
  updateAiReceptionist,
  updateAgentStatus,
  userAddContent,
  userIngestURL,
  uploadIngestPdf,
  uploadSummaryPdfFiles,
  type GenerateKnowledgeBaseFaqPayload,
  type SummarizeKnowledgeBasePayload,
} from '@/services/api';
import { createAiWidgetKey, formatFileSize, handleAlert } from '@/lib/utils';
import {
  sanitizeAiAgentUpdateRecord,
  sanitizeAiPlainText,
  sanitizeAiPromptText,
  sanitizeAiSearchText,
} from '@/lib/ai-input-security';
import { normalizeRegionalSettings } from '@/lib/regional-settings';
import {
  useGetDepartment,
  useGetExtensions,
  useGetGreetings,
  useGetIVR,
  useGetQueueList,
} from '@/hooks/common';
import { useUser } from '@/hooks/use-user';
import useDebounce from '@/hooks/use-debounce';
import { usePaginatedUsers } from '@/hooks/use-paginated-users';
import { getAi360WidgetKey } from '../ai-agent/chat-agent-configure-modal';
import {
  hindiVoiceOptions,
  languageOptions,
  spanishVoiceOptions,
  voiceOptions,
} from '../constants';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FormProvider, useForm, type SetValueConfig } from 'react-hook-form';
import { Room } from 'livekit-client';
import moment from 'moment';
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  Check,
  Copy,
  Edit3,
  ExternalLink,
  FileText,
  Folder,
  Globe2,
  Headphones,
  Loader2,
  Lock,
  MessageSquare,
  PenLine,
  Phone,
  Play,
  Plus,
  Search,
  Settings2,
  Target,
  Sparkles,
  TrendingUp,
  Trash2,
  UploadCloud,
  User,
  UserRound,
  X,
  ChevronDown,
  Info,
  Clock3,
  Bot,
  Gauge,
  Smile,
  RefreshCcw,
  PhoneCall,
  MoreVertical,
} from 'lucide-react';
import { Grid } from '@/assets/icons';
import {
  Fragment,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { useBlocker, useNavigate } from 'react-router-dom';
import WebsiteScanProgressModal, {
  type WebsiteScanProgressStatus,
} from '../components/website-scan-progress-modal';
import WizardLeaveConfirmModal from '../components/wizard-leave-confirm-modal';
import { getConnectedCrmOptions, normalizeCrmValue } from '../crm-options';
import AgentSiteSelection, {
  getAgentSiteId,
  getAgentSiteRegionalSettings,
  getAgentSiteTimezone,
  getPreferredAgentSiteId,
} from '../components/agent-site-selection';

type DetailField = 'name' | 'dob' | 'phone' | 'email' | 'address';
type UseCaseTemplateOption = {
  id: string;
  name: string;
  welcomeGreeting: string;
  systemPrompt: string;
};
type SourceStage = 1 | 2 | 3;
type ReceptionistStep = 1 | 2 | 3 | 4 | 5 | 6;
type ReceptionistEditTab =
  'overview' | 'basics' | 'voice' | 'greeting-hours' | 'knowledge' | 'summary' | 'advanced';
type WizardReceptionistTab = Exclude<ReceptionistEditTab, 'overview'>;
type BuilderMode = 'create' | 'edit' | 'view';
type ForwardCallState = {
  enabled?: boolean;
  type?: { label?: string; value?: string };
  value?: { label?: string; value?: string };
  personal?: boolean;
};
type SourceRecord = {
  id: string;
  title: string;
  source: string;
  type: string;
  detail: string;
};
type KnowledgeDocument = {
  id: string;
  title: string;
  copy: string;
  source: string;
  status: string;
  type?: string;
};
type KnowledgeFaq = {
  id: string;
  question: string;
  answer: string;
  source: string;
};
type ReviewKnowledgeItemType = 'document' | 'faq';
type ReviewKnowledgeEditModalState = {
  type: ReviewKnowledgeItemType;
  id: string;
  title: string;
  body: string;
};
type ReviewKnowledgeAddModalState = {
  type: ReviewKnowledgeItemType;
  mode: 'text' | 'upload';
  title: string;
  body: string;
  file: globalThis.File | null;
};
type ReviewKnowledgeSourceModalState = {
  type: ReviewKnowledgeItemType;
  title: string;
  body: string;
  source: string;
  status: string;
};
type PendingTextKnowledge = {
  id: string;
  title: string;
  text: string;
};
type PendingFileKnowledge = {
  id: string;
  file: globalThis.File;
};
type KnowledgeBaseSourceType = 'text' | 'url' | 'pdf';
type PickPageCategory = {
  id: string;
  title: string;
  subtitle: string;
  links: string[];
  stripLeadingSegments: number;
};
type PickPageKeywordCategory = {
  id: string;
  title: string;
  keywords: string[];
};
type ReusableKnowledgeAgent = {
  id: string;
  channel: 'chat' | 'voice';
  name: string;
  meta: string;
  documents: KnowledgeDocument[];
  faqs: KnowledgeFaq[];
  textIds: string[];
  urlIds: string[];
  pdfIds: string[];
};
type CreatedKnowledgeIds = {
  text: string[];
  url: string[];
  pdf: string[];
  generatedTextId?: string;
};

const MAX_RECEPTIONIST_NAME_LENGTH = 70;
const RECEPTIONIST_NAME_ALLOWED_PATTERN = /^[A-Za-z0-9 ]+$/;
const RECEPTIONIST_NAME_INVALID_CHARS_PATTERN = /[^A-Za-z0-9 ]/g;

const sanitizeReceptionistName = (value: string) =>
  sanitizeAiPlainText(value)
    .replace(RECEPTIONIST_NAME_INVALID_CHARS_PATTERN, '')
    .slice(0, MAX_RECEPTIONIST_NAME_LENGTH);

const getReceptionistNameValidationError = (value: string) => {
  const trimmedValue = value.trim();
  if (!trimmedValue) return 'Receptionist name is required.';
  if (value.length > MAX_RECEPTIONIST_NAME_LENGTH) {
    return `Receptionist name must be ${MAX_RECEPTIONIST_NAME_LENGTH} characters or fewer.`;
  }
  if (!RECEPTIONIST_NAME_ALLOWED_PATTERN.test(trimmedValue)) {
    return 'Receptionist name can only include letters, numbers, and spaces.';
  }
  return '';
};

const getScrollParent = (element: HTMLElement): HTMLElement | null => {
  let parent = element.parentElement;

  while (parent) {
    const style = window.getComputedStyle(parent);
    const canScrollY = /(auto|scroll|overlay)/.test(style.overflowY);
    if (canScrollY && parent.scrollHeight > parent.clientHeight) {
      return parent;
    }
    parent = parent.parentElement;
  }

  return null;
};

const scrollToFirstValidationError = (errors: Record<string, string | undefined>) => {
  const firstKey = Object.keys(errors).find((key) => Boolean(errors[key]));
  if (!firstKey || typeof window === 'undefined') return;

  window.requestAnimationFrame(() => {
    const element = document.querySelector(
      `[data-validation-key="${firstKey}"]`,
    ) as HTMLElement | null;
    if (!element) return;

    const scrollParent = getScrollParent(element);
    const rect = element.getBoundingClientRect();
    const visibleArea = scrollParent?.getBoundingClientRect() ?? {
      top: 0,
      bottom: window.innerHeight,
    };
    const isVisible = rect.top >= visibleArea.top && rect.bottom <= visibleArea.bottom;

    if (!isVisible) {
      if (scrollParent) {
        const parentRect = scrollParent.getBoundingClientRect();
        const nextTop =
          scrollParent.scrollTop +
          rect.top -
          parentRect.top -
          scrollParent.clientHeight / 2 +
          rect.height / 2;
        scrollParent.scrollTo({ top: Math.max(0, nextTop), behavior: 'smooth' });
      } else {
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }

    const focusable = element.querySelector(
      'input, textarea, select, button',
    ) as HTMLElement | null;
    focusable?.focus({ preventScroll: true });
  });
};

const cx = (...classes: Array<string | false | null | undefined>) =>
  classes.filter(Boolean).join(' ');

const getAgentTypeTemplateOptions = (agentTypeData: any): UseCaseTemplateOption[] => {
  const rawApiData =
    agentTypeData?.data?.data?.result?.rows ||
    agentTypeData?.data?.result?.rows ||
    agentTypeData?.data?.result ||
    agentTypeData?.data ||
    agentTypeData ||
    [];
  if (!Array.isArray(rawApiData)) return [];

  return rawApiData
    .map((item: any) => {
      const name = sanitizeAiPlainText(
        item?.label || item?.name || item?.title || item?.value || '',
      ).trim();
      const id = String(item?.value || item?.id || item?.uuid || name).trim();
      const welcomeGreeting = sanitizeAiPlainText(item?.welcome_greeting || '').trim();
      const systemPrompt = sanitizeAiPromptText(item?.systemPrompt || '').trim();
      return name ? { id: id || name, name, welcomeGreeting, systemPrompt } : null;
    })
    .filter(Boolean) as UseCaseTemplateOption[];
};

const wizardSteps = [
  'Basics',
  'Voice & Persona',
  'Greeting & Hours',
  'Knowledge Base',
  'Review',
  'Advanced Settings',
];
console.log(wizardSteps);

const stepToTab: Record<ReceptionistStep, WizardReceptionistTab> = {
  1: 'basics',
  2: 'voice',
  3: 'greeting-hours',
  4: 'knowledge',
  5: 'summary',
  6: 'advanced',
};
const tabToStep: Record<WizardReceptionistTab, ReceptionistStep> = {
  basics: 1,
  voice: 2,
  'greeting-hours': 3,
  knowledge: 4,
  summary: 5,
  advanced: 6,
};
const isWizardReceptionistTab = (
  value: ReceptionistEditTab | undefined,
): value is WizardReceptionistTab => Boolean(value && value !== 'overview');

const getGreetingText = (type: string, brandName: string, receptionist: string) => {
  const brand = brandName || 'Example Business';
  const name = receptionist || 'Maya';
  switch (type) {
    case 'friendly':
      return `Hi, thanks for calling ${brand}. This is ${name}. How can I help you today?`;
    case 'professional':
      return `Thank you for calling ${brand}. My name is ${name}, and I am your virtual receptionist. How can I assist you today?`;
    case 'triage':
      return `Hello, thanks for calling ${brand}. Please tell me the purpose of your call so I can assist you quickly.`;
    case 'holiday':
      return `Thank you for calling ${brand}. Our offices are currently closed, but I can help answer questions or take a message for our team. How can I assist you?`;
    default:
      return `Hi, thanks for calling ${brand}. This is ${name}. How can I help you today?`;
  }
};

const DEFAULT_GREETING =
  'Hi, thanks for calling Example Business. This is Maya. How can I help you today?';
const DEFAULT_SYSTEM_PROMPT =
  'You are the AI receptionist for the company. Greet every caller warmly and ask one short question to understand the reason for the call. Be friendly, concise, and helpful. Never invent features, transfer to a human for refunds, complex billing issues, or anything outside your knowledge base.';
const DEFAULT_DETAILS_TO_COLLECT: DetailField[] = ['name', 'phone'];
const ALWAYS_ASKED_DETAIL_FIELDS = new Set<DetailField>(['name', 'phone']);
const DISABLED_DATA_COLLECTION_DETAIL_FIELDS: DetailField[] = ['phone'];
const MAX_DURATION_SECONDS = 30 * 60;
const MAX_IDLE_REMINDER_RETRIES = 30;

const REALTIME_PREVIEW_VOICES = [
  'alloy',
  'ash',
  'ballad',
  'coral',
  'echo',
  'sage',
  'shimmer',
  'verse',
] as const;
const LEGACY_PERSONA_TO_REALTIME_VOICE: Record<string, (typeof REALTIME_PREVIEW_VOICES)[number]> = {
  'en-us-avamultilingualneural': 'alloy',
  'en-us-andrewmultilingualneural': 'ash',
  'en-us-amandamultilingualneural': 'ballad',
  'en-us-adammultilingualneural': 'coral',
  'en-us-christophermultilingualneural': 'echo',
  'en-us-derekmultilingualneural': 'sage',
  'en-us-steffanmultilingualneural': 'shimmer',
  'en-us-nancymultilingualneural': 'verse',
};

const ensureAlwaysAskedDetails = (details: DetailField[] = []) => {
  const set = new Set<DetailField>([...ALWAYS_ASKED_DETAIL_FIELDS, ...details]);
  return (['name', 'dob', 'phone', 'email', 'address'] as DetailField[]).filter((field) =>
    set.has(field),
  );
};

const getManagerExtensionRole = (extension: any) =>
  String(
    extension?.custom_role_data?.name ||
      extension?.customRoleData?.name ||
      extension?.role_data?.name ||
      extension?.roleData?.name ||
      extension?.role?.name ||
      extension?.role_name ||
      (typeof extension?.role === 'string' ? extension.role : ''),
  )
    .trim()
    .toUpperCase()
    .replace(/[\s_]+/g, '-');

const getManagerExtensionId = (extension: any) =>
  String(
    extension?.uuid || extension?.id || extension?.user_uuid || extension?.userId || '',
  ).trim();

const normalizeUrl = (url: string) => {
  const trimmed = url.trim();
  if (!trimmed) return '';
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
};

const isLikelyUrl = (value: string) => {
  if (!value.trim()) return true;
  try {
    const url = new URL(value.startsWith('http') ? value : `https://${value}`);
    return Boolean(url.hostname.includes('.'));
  } catch {
    return false;
  }
};

const getNestedValue = (source: any, path: string) =>
  path.split('.').reduce((current, key) => current?.[key], source);

const pickNumber = (source: any, paths: string[], fallback = 0) => {
  for (const path of paths) {
    const value = getNestedValue(source, path);
    const numberValue = Number(value);
    if (Number.isFinite(numberValue)) return numberValue;
  }
  return fallback;
};

const formatPercent = (value: number) => `${Math.round(value)}%`;
const formatDuration = (seconds: number) => {
  if (!Number.isFinite(seconds) || seconds <= 0) return '0:00';
  const minutes = Math.floor(seconds / 60);
  const remaining = Math.floor(seconds % 60);
  return `${minutes}:${String(remaining).padStart(2, '0')}`;
};
const formatShortRelativeTime = (date: any) => {
  if (!date || !moment(date).isValid()) return null;
  const target = moment.utc(date).local();
  const diffMinutes = moment().diff(target, 'minutes');
  const isFuture = diffMinutes < 0;
  const abs = Math.abs(diffMinutes);

  let value: string;
  if (abs < 1) return 'Just now';
  else if (abs < 60) value = `${abs}m`;
  else if (abs < 60 * 24) value = `${Math.floor(abs / 60)}h`;
  else if (abs < 60 * 24 * 30) value = `${Math.floor(abs / (60 * 24))}d`;
  else if (abs < 60 * 24 * 365) value = `${Math.floor(abs / (60 * 24 * 30))}mo`;
  else value = `${Math.floor(abs / (60 * 24 * 365))}y`;

  return isFuture ? `in ${value}` : `${value} ago`;
};
const normalizeSentiment = (value: any) => {
  const sentiment = String(value || '')
    .trim()
    .toLowerCase();
  return ['positive', 'neutral', 'negative'].includes(sentiment) ? sentiment : '';
};
const sentimentScoreRows = [
  { key: 'positive', label: 'Positive', colorClass: 'bg-green-500' },
  { key: 'negative', label: 'Negative', colorClass: 'bg-red-600' },
  { key: 'neutral', label: 'Neutral', colorClass: 'bg-neutral-400' },
] as const;
const sentimentScoreValue = (scores: any, key: (typeof sentimentScoreRows)[number]['key']) => {
  const score = Number(scores?.[key] || 0);
  if (!Number.isFinite(score)) return 0;
  return Math.max(0, Math.min(100, score));
};
const sentimentFromScores = (scores: any) => {
  const positive = Number(scores?.positive || 0);
  const neutral = Number(scores?.neutral || 0);
  const negative = Number(scores?.negative || 0);
  if (!positive && !neutral && !negative) return '';
  if (positive >= neutral && positive >= negative) return 'positive';
  if (negative >= positive && negative >= neutral) return 'negative';
  return 'neutral';
};
const getCallSentiment = (call: any) =>
  normalizeSentiment(call?.sentiment) || sentimentFromScores(call?.sentiment_scores);
const sentimentBadgeClass = (sentiment: string) => {
  if (sentiment === 'positive') return 'bg-emerald-100 text-emerald-700';
  if (sentiment === 'negative') return 'bg-red-100 text-red-700';
  if (sentiment === 'neutral') return 'bg-slate-100 text-slate-700';
  return 'bg-gray-100 text-gray-500';
};
const sentimentScoreText = (scores: any) => {
  const positive = Math.round(Number(scores?.positive || 0));
  const neutral = Math.round(Number(scores?.neutral || 0));
  const negative = Math.round(Number(scores?.negative || 0));
  if (!positive && !neutral && !negative) return '';
  return `P ${positive}% / N ${neutral}% / Neg ${negative}%`;
};
const sentimentCountsText = (counts: any) => {
  const positive = Number(counts?.positive || 0);
  const neutral = Number(counts?.neutral || 0);
  const negative = Number(counts?.negative || 0);
  if (!positive && !neutral && !negative) return '';
  return `Positive ${positive} / Neutral ${neutral} / Negative ${negative}`;
};
const sentimentLabelFromScore = (score: number) => {
  if (!score) return '';
  if (score >= 75) return 'positive';
  if (score >= 50) return 'neutral';
  return 'negative';
};
const getForwardDestinationValue = (forwardCall?: ForwardCallState | any) =>
  String((forwardCall as any)?.value?.value ?? (forwardCall as any)?.value ?? '').trim();
type ForwardCallValidationError = {
  field: 'type' | 'value';
  message: string;
};
const getForwardCallValidationError = (
  forwardCall?: ForwardCallState | any,
): ForwardCallValidationError | null => {
  const forwardType = String(
    (forwardCall as any)?.type?.value ?? (forwardCall as any)?.type ?? '',
  ).trim();
  const forwardDestinationValue = getForwardDestinationValue(forwardCall);
  const isPersonalVoicemail = forwardType === 'VOICEMAIL' && Boolean(forwardCall?.personal);

  if (!forwardType) {
    return { field: 'type', message: 'Please select a forwarding type.' };
  }

  if (forwardType === 'HANGUP' || isPersonalVoicemail) {
    return null;
  }

  if (!forwardDestinationValue) {
    return {
      field: 'value',
      message:
        forwardType === 'VOICEMAIL'
          ? 'Please select a voicemail destination.'
          : 'Please select a forwarding destination.',
    };
  }

  if (forwardType === 'PHONE' && forwardDestinationValue.replace(/\D/g, '').length < 8) {
    return { field: 'value', message: 'Phone number must be at least 8 digits.' };
  }

  return null;
};
const getForwardTypeLabel = (type?: string) => {
  const labels: Record<string, string> = {
    VOICEMAIL: 'Send to Voicemail',
    GREETING: 'Play an Announcement',
    EXTENSION: 'Forward to Extension',
    PHONE: 'Forward to External Number',
    IVR: 'Forward to IVR',
    QUEUE: 'Forward to Call Queue',
    DEPARTMENT: 'Forward to Group',
    HANGUP: 'Hangup',
  };
  return labels[type || ''] || type || 'Hangup';
};
const getForwardValueFieldLabel = (type?: string) => {
  switch (type) {
    case 'GREETING':
      return 'Announcement';
    case 'EXTENSION':
      return 'Extension';
    case 'VOICEMAIL':
      return 'Voicemail';
    case 'DEPARTMENT':
      return 'Group';
    case 'IVR':
      return 'IVR';
    case 'QUEUE':
      return 'Queue';
    case 'PHONE':
      return 'Phone Number';
    default:
      return 'Destination';
  }
};
const getLoggedInUserExtension = (user: any) =>
  String(user?.user_info?.extension || user?.extension || '').trim();
const getLoggedInUserExtensionLabel = (user: any) => {
  const extension = getLoggedInUserExtension(user);
  const name = `${user?.user_info?.first_name || user?.first_name || ''} ${
    user?.user_info?.last_name || user?.last_name || ''
  }`.trim();

  return name || extension || 'Logged in user';
};
const hasSavedBusinessHoursForwardCall = (businessHours?: ForwardCallState | any) =>
  Boolean(businessHours?.type || getForwardDestinationValue(businessHours));
const getDefaultBusinessHoursForwardCall = (user: any, enabled: boolean): ForwardCallState => ({
  enabled,
  type: { label: getForwardTypeLabel('EXTENSION'), value: 'EXTENSION' },
  value: {
    label: getLoggedInUserExtensionLabel(user),
    value: getLoggedInUserExtension(user),
  },
  personal: false,
});
const getInitialBusinessHoursForwardCall = (
  businessHours: any,
  user: any,
  enabled: boolean,
): ForwardCallState => {
  if (!hasSavedBusinessHoursForwardCall(businessHours)) {
    return getDefaultBusinessHoursForwardCall(user, enabled);
  }

  return {
    enabled,
    type: {
      label: getForwardTypeLabel(businessHours?.type),
      value: businessHours?.type || 'HANGUP',
    },
    value: {
      label: businessHours?.label || '',
      value: businessHours?.value || '',
    },
    personal: !businessHours?.value,
  };
};
const VOICE_METADATA: Record<
  string,
  { accent: string; tags: string[]; description: string; color: string }
> = {
  alloy: {
    accent: 'American English',
    tags: ['Warm', 'Versatile', 'Natural'],
    description: 'A balanced, neutral voice — the most universally trusted across caller types.',
    color: '#6366f1', // Indigo
  },
  ash: {
    accent: 'American English',
    tags: ['Clear', 'Articulate', 'Confident'],
    description: 'Crisp and professional — ideal for support flows where clarity matters most.',
    color: '#06b6d4', // Cyan
  },
  ballad: {
    accent: 'British English',
    tags: ['Emotional', 'Rich', 'Expressive'],
    description:
      'A warm, expressive voice with a refined British cadence — great for premium brands.',
    color: '#10b981', // Emerald
  },
  coral: {
    accent: 'American English',
    tags: ['Vibrant', 'Warm', 'Welcoming'],
    description: 'Friendly and cheerful — perfect for hospitality, sales, and greeting callers.',
    color: '#f97316', // Orange
  },
  echo: {
    accent: 'American English',
    tags: ['Deep', 'Steady', 'Neutral'],
    description:
      'A calm, authoritative voice with a smooth delivery — excellent for finance or legal.',
    color: 'var(--primary)',
  },
  sage: {
    accent: 'American English',
    tags: ['Professional', 'Polite', 'Clear'],
    description: 'Elegant and business-oriented — great for corporate receptionists and portals.',
    color: '#14b8a6', // Teal
  },
  shimmer: {
    accent: 'American English',
    tags: ['Dynamic', 'Bright', 'Engaging'],
    description:
      'Energetic and modern — highly recommended for creative startups and tech products.',
    color: '#ec4899', // Pink
  },
  verse: {
    accent: 'American English',
    tags: ['Smooth', 'Narrative', 'Warm'],
    description: 'Relaxed and melodic tone — ideal for storytelling, guidance, and counseling.',
    color: '#8b5cf6', // Violet
  },
};

const LOCALE_ACCENT_MAP: Record<string, string> = {
  'en-US': 'American English',
  'en-GB': 'British English',
  'en-AU': 'Australian English',
  'en-IN': 'Indian English',
  'en-CA': 'Canadian English',
  'es-ES': 'Spanish (Spain)',
  'es-MX': 'Spanish (Mexico)',
  'fr-FR': 'French',
  'de-DE': 'German',
  'it-IT': 'Italian',
  'pt-BR': 'Portuguese (Brazil)',
  'hi-IN': 'Hindi',
  'ar-SA': 'Arabic',
  'zh-CN': 'Chinese (Mandarin)',
  'ja-JP': 'Japanese',
  'ko-KR': 'Korean',
};

const VOICE_COLOR_PALETTE = [
  '#6366f1',
  '#06b6d4',
  '#10b981',
  '#f97316',
  'var(--primary)',
  '#14b8a6',
  '#ec4899',
  '#8b5cf6',
  '#f59e0b',
  '#ef4444',
  '#84cc16',
  'var(--primary)',
];

const getVoiceColor = (seed: string): string => {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) & 0xffffffff;
  }
  return VOICE_COLOR_PALETTE[Math.abs(hash) % VOICE_COLOR_PALETTE.length];
};

const getVoiceMeta = (value: string, label?: string) => {
  // Try direct key match (static voices like alloy, ash, etc.)
  const normalized = String(value || '').toLowerCase();
  if (VOICE_METADATA[normalized]) return VOICE_METADATA[normalized];
  // Try matching by first word of the display label (e.g. "Adam Multilingual" → "adam")
  if (label) {
    const firstWord = label.split(/\s+/)[0].toLowerCase();
    if (VOICE_METADATA[firstWord]) return VOICE_METADATA[firstWord];
  }
  // Generic fallback with deterministic color
  return {
    accent: 'Multilingual',
    tags: ['Neural', 'Clear', 'Natural'],
    description: 'A high-quality neural voice optimized for natural, multilingual conversations.',
    color: getVoiceColor(value || label || 'default'),
  };
};
const getVoiceSelectionValue = (voice: any) => {
  if (!voice || typeof voice !== 'object') return String(voice || '').trim();

  return String(
    voice.value ||
      voice.uuid ||
      voice.id ||
      voice.voice_id ||
      voice.voiceId ||
      voice.short_name ||
      voice.shortName ||
      voice.name ||
      voice.label ||
      '',
  ).trim();
};
const getVoiceComparisonValues = (voice: any) => [
  getVoiceSelectionValue(voice),
  String(voice?.uuid || '').trim(),
  String(voice?.id || '').trim(),
  String(voice?.voice_id || '').trim(),
  String(voice?.voiceId || '').trim(),
  String(voice?.short_name || '').trim(),
  String(voice?.shortName || '').trim(),
  String(voice?.name || '').trim(),
  String(voice?.label || '').trim(),
];
const isVoiceValueMatch = (selectedValue: unknown, voice: any) => {
  const normalizedSelectedValue = getVoiceSelectionValue(selectedValue).toLowerCase();
  if (!normalizedSelectedValue) return false;

  return getVoiceComparisonValues(voice).some(
    (value) => value.toLowerCase() === normalizedSelectedValue,
  );
};
type VoiceGenderFilter = 'all' | 'female' | 'male';
type VoiceLocaleFilter = 'all' | 'en-US' | 'hi-IN' | 'es-ES';
type VoiceLanguageMode = 'fixed' | 'multilingual';

const MULTILINGUAL_ALLOWED_LANGUAGES: VoiceLocaleFilter[] = ['en-US', 'hi-IN', 'es-ES'];
const DEFAULT_MULTILINGUAL_LANGUAGE: VoiceLocaleFilter = 'en-US';
const GENDER_FILTER_OPTIONS: { key: VoiceGenderFilter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'female', label: 'Female' },
  { key: 'male', label: 'Male' },
];
const LOCALE_FILTER_OPTIONS: { key: VoiceLocaleFilter; label: string }[] = [
  { key: 'all', label: 'Multilingual' },
  { key: 'en-US', label: 'English (US)' },
  { key: 'hi-IN', label: 'Hindi (IN)' },
  { key: 'es-ES', label: 'Spanish (ES)' },
];
const getVoiceLanguageMode = (localeFilter: VoiceLocaleFilter): VoiceLanguageMode =>
  localeFilter === 'all' ? 'multilingual' : 'fixed';
const getVoiceRuntimeLanguage = (localeFilter: VoiceLocaleFilter): VoiceLocaleFilter =>
  localeFilter === 'all' ? DEFAULT_MULTILINGUAL_LANGUAGE : localeFilter;
const getVoiceAllowedLanguages = (localeFilter: VoiceLocaleFilter): VoiceLocaleFilter[] =>
  localeFilter === 'all' ? MULTILINGUAL_ALLOWED_LANGUAGES : [localeFilter];
const normalizeVoiceLocaleFilterValue = (value: unknown): VoiceLocaleFilter => {
  const normalized = String(value || '')
    .trim()
    .toLowerCase();
  if (normalized === 'all' || normalized === 'multilingual') return 'all';
  if (normalized === 'hindi' || normalized.startsWith('hi')) return 'hi-IN';
  if (normalized === 'spanish' || normalized.startsWith('es')) return 'es-ES';
  if (normalized === 'english' || normalized.startsWith('en')) return 'en-US';
  return 'all';
};
const getInitialVoiceLocaleFilter = (
  initialData: any,
  builderState: any,
  initialForwardActions: any,
): VoiceLocaleFilter => {
  const savedMode =
    initialData?.languageMode ||
    initialForwardActions?.languageMode ||
    builderState?.voice?.languageMode ||
    '';
  if (String(savedMode).trim().toLowerCase() === 'multilingual') return 'all';

  return normalizeVoiceLocaleFilterValue(
    builderState?.voice?.localeFilter ||
      initialData?.language ||
      initialForwardActions?.language ||
      builderState?.voice?.language,
  );
};

const isMultilingualVoice = (voice: any) => {
  if (typeof voice?.multilingual === 'boolean') return voice.multilingual;
  if (voice?.multilingual !== undefined && voice?.multilingual !== null) {
    return String(voice.multilingual).toLowerCase() === 'true';
  }

  const searchableVoiceFields = [
    voice?.voice_type,
    voice?.label,
    voice?.display_name,
    voice?.local_name,
    voice?.value,
    voice?.short_name,
    voice?.name,
  ];

  return searchableVoiceFields
    .map((field) => String(field || '').toLowerCase())
    .some((field) => field.includes('multilingual'));
};
const getVoiceGenderFilter = (voice: any): VoiceGenderFilter => {
  const gender = String(voice?.gender || '').toLowerCase();
  return gender === 'female' || gender === 'male' ? gender : 'all';
};
const getVoiceLocaleFilter = (voice: any): VoiceLocaleFilter => {
  if (isMultilingualVoice(voice)) return 'all';

  const locale = String(voice?.locale || '').toLowerCase();
  if (locale.startsWith('hi')) return 'hi-IN';
  if (locale.startsWith('es')) return 'es-ES';
  if (locale.startsWith('en')) return 'en-US';
  return 'all';
};
const voiceMatchesLocaleFilter = (voice: any, localeFilter: VoiceLocaleFilter) =>
  localeFilter === 'all' || getVoiceLocaleFilter(voice) === localeFilter;
const voiceMatchesRuntimeLanguage = (voice: any, localeFilter: VoiceLocaleFilter) =>
  localeFilter === 'all'
    ? isMultilingualVoice(voice)
    : !isMultilingualVoice(voice) && voiceMatchesLocaleFilter(voice, localeFilter);
const getAvailableReceptionistVoices = (apiVoices: any[], language: string) =>
  apiVoices.length > 0
    ? apiVoices
    : language === 'spanish'
      ? spanishVoiceOptions
      : language === 'hindi'
        ? hindiVoiceOptions
        : voiceOptions;
const getVoicePayloadValue = (voice: any, fallback = '') =>
  String(
    voice?.short_name ||
      voice?.shortName ||
      voice?.value ||
      voice?.voice_id ||
      voice?.voiceId ||
      voice?.uuid ||
      voice?.id ||
      voice?.name ||
      voice?.label ||
      fallback ||
      '',
  ).trim();

const getPageTitle = (url: string) => {
  try {
    const parsed = new URL(normalizeUrl(url));
    const pathName = parsed.pathname.replace(/^\/|\/$/g, '').replace(/[-_]/g, ' ');
    return pathName || parsed.hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
};
const createLocalId = (prefix: string) =>
  `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const uniqueStrings = (values: string[]) =>
  Array.from(new Set(values.map((value) => String(value || '').trim()).filter(Boolean)));
const getSelectedLinksAfterScan = (links: string[], currentSelectedLinks: string[]) => {
  const selectedLinkSet = new Set(
    currentSelectedLinks.map((url) => normalizeUrl(url)).filter(Boolean),
  );
  const matchedLinks = links.filter((link) => selectedLinkSet.has(normalizeUrl(link)));

  return matchedLinks.length ? matchedLinks : links.slice(0, 5);
};
const getKnowledgeReviewSourceKey = (type: 'url' | 'text' | 'pdf', value: string) => {
  const trimmed = String(value || '').trim();
  if (!trimmed) return '';
  if (type === 'url' || isLikelyUrl(trimmed)) return `url:${normalizeUrl(trimmed)}`;
  return `${type}:${trimmed}`;
};
const getKnowledgeReviewItemSourceKey = (item: { source?: string }) => {
  const source = String(item?.source || '').trim();
  if (!source) return '';
  return getKnowledgeReviewSourceKey(isLikelyUrl(source) ? 'url' : 'text', source);
};
const getKnowledgeReviewPayloadEntries = (payload: SummarizeKnowledgeBasePayload) => [
  ...(payload.crawl_url ?? []).map((value) => ({ type: 'url' as const, value })),
  ...(payload.url ?? []).map((value) => ({ type: 'url' as const, value })),
  ...(payload.text ?? []).map((value) => ({ type: 'text' as const, value })),
  ...(payload.pdf ?? []).map((value) => ({ type: 'pdf' as const, value })),
];
const buildKnowledgeReviewPayload = (
  entries: Array<{ type: 'url' | 'text' | 'pdf'; value: string }>,
): SummarizeKnowledgeBasePayload => ({
  crawl_url: uniqueStrings(
    entries.filter((entry) => entry.type === 'url').map((entry) => entry.value),
  ),
  url: [],
  text: uniqueStrings(entries.filter((entry) => entry.type === 'text').map((entry) => entry.value)),
  pdf: uniqueStrings(entries.filter((entry) => entry.type === 'pdf').map((entry) => entry.value)),
});
const hasKnowledgeReviewPayloadInput = (payload: SummarizeKnowledgeBasePayload) =>
  Boolean(
    payload.crawl_url?.length || payload.url?.length || payload.text?.length || payload.pdf?.length,
  );
const getUrlPathSegments = (url: string) => {
  try {
    return new URL(normalizeUrl(url)).pathname.split('/').filter(Boolean);
  } catch {
    return [];
  }
};
const decodeUrlSegment = (segment: string) => {
  try {
    return decodeURIComponent(segment);
  } catch {
    return segment;
  }
};
const formatPickPageCategoryTitle = (segment: string) => {
  const title = decodeUrlSegment(segment)
    .replace(/\.[a-z0-9]+$/i, '')
    .replace(/[-_]+/g, ' ')
    .trim();

  if (!title) return 'Main Pages';

  return title.replace(/\b\w/g, (char) => char.toUpperCase());
};
const pickPageKeywordCategories: PickPageKeywordCategory[] = [
  {
    id: 'pricing-plans',
    title: 'Pricing & Plans',
    keywords: [
      'pricing',
      'price',
      'prices',
      'plans',
      'plan',
      'packages',
      'package',
      'billing',
      'rates',
      'cost',
      'subscription',
      'subscriptions',
      'quote',
      'quotes',
    ],
  },
  {
    id: 'features-services',
    title: 'Features & Services',
    keywords: [
      'features',
      'feature',
      'services',
      'service',
      'products',
      'product',
      'solutions',
      'solution',
      'platform',
      'tools',
      'numbers',
      'virtual-numbers',
      'phone-system',
      'voip',
      'pbx',
      'contact-center',
      'call-center',
      'sms',
      'voice',
      'chat',
      'automation',
      'ai',
    ],
  },
  {
    id: 'help-contact',
    title: 'Help & Contact',
    keywords: [
      'help',
      'support',
      'contact',
      'contacts',
      'faq',
      'faqs',
      'knowledge-base',
      'kb',
      'docs',
      'documentation',
      'guide',
      'guides',
      'tutorial',
      'tutorials',
      'resource-center',
    ],
  },
  {
    id: 'company-info',
    title: 'Company Info',
    keywords: [
      'about',
      'about-us',
      'company',
      'team',
      'leadership',
      'careers',
      'career',
      'jobs',
      'partners',
      'partner',
      'customers',
      'customer',
      'case-studies',
      'case-study',
      'testimonials',
      'press',
      'news',
    ],
  },
  {
    id: 'blog',
    title: 'Blog',
    keywords: ['blog', 'blogs', 'article', 'articles', 'post', 'posts'],
  },
  {
    id: 'legal-trust',
    title: 'Legal & Trust',
    keywords: [
      'privacy',
      'terms',
      'terms-of-service',
      'security',
      'compliance',
      'gdpr',
      'hipaa',
      'cookies',
      'cookie-policy',
      'policy',
      'policies',
      'sla',
      'status',
    ],
  },
  {
    id: 'developers-integrations',
    title: 'Developers & Integrations',
    keywords: [
      'api',
      'apis',
      'developer',
      'developers',
      'integrations',
      'integration',
      'webhooks',
      'webhook',
      'sdk',
      'sdks',
      'apps',
      'marketplace',
      'crm',
    ],
  },
  {
    id: 'industries-use-cases',
    title: 'Industries & Use Cases',
    keywords: [
      'industries',
      'industry',
      'use-cases',
      'use-case',
      'customers',
      'real-estate',
      'healthcare',
      'finance',
      'education',
      'retail',
      'travel',
      'agency',
      'enterprise',
    ],
  },
];
const normalizePickPageKeyword = (value: string) =>
  decodeUrlSegment(value)
    .toLowerCase()
    .replace(/\.[a-z0-9]+$/i, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
const doesPickPageKeywordMatch = (segment: string, keyword: string) =>
  segment === keyword ||
  segment.startsWith(`${keyword}-`) ||
  segment.endsWith(`-${keyword}`) ||
  segment.includes(`-${keyword}-`);
const getPickPageKeywordCategory = (segment: string) => {
  const normalizedSegment = normalizePickPageKeyword(segment);
  if (!normalizedSegment) return null;

  return (
    pickPageKeywordCategories.find((category) =>
      category.keywords.some((keyword) => doesPickPageKeywordMatch(normalizedSegment, keyword)),
    ) || null
  );
};
const formatPickPageCategorySubtitle = (linkCount: number, segment: string) => {
  const pageText = `${linkCount.toLocaleString()} ${linkCount === 1 ? 'page' : 'pages'}`;
  return segment ? `${pageText} under /${decodeUrlSegment(segment)}` : `${pageText} from top level`;
};
const getPickPageRowLabel = (url: string, stripLeadingSegments: number) => {
  const segments = getUrlPathSegments(url);
  const visibleSegments =
    stripLeadingSegments > 0 ? segments.slice(stripLeadingSegments) : segments;
  const labelSegment =
    visibleSegments[visibleSegments.length - 1] || segments[segments.length - 1] || '';

  if (labelSegment) return formatPickPageCategoryTitle(labelSegment);

  try {
    return new URL(normalizeUrl(url)).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
};
const getPickPageRowPath = (url: string) => {
  try {
    const parsed = new URL(normalizeUrl(url));
    const path = `${parsed.pathname}${parsed.search}`.replace(/\/$/, '') || '/';
    const host = parsed.hostname.replace(/^www\./, '');
    return path === '/' ? host : `${host}${path}`;
  } catch {
    return url;
  }
};
const buildPickPageCategories = (links: string[]): PickPageCategory[] => {
  const categoryMap = new Map<string, PickPageCategory>();
  const folderCategorySegments = new Set(
    uniqueStrings(links)
      .map((link) => getUrlPathSegments(link))
      .filter((segments) => segments.length > 1 && segments[0])
      .map((segments) => String(segments[0]).toLowerCase()),
  );

  uniqueStrings(links).forEach((link) => {
    const segments = getUrlPathSegments(link);
    const firstSegment = segments[0] || '';
    const hasFolderCategory = Boolean(
      firstSegment && folderCategorySegments.has(firstSegment.toLowerCase()),
    );
    const categorySegment = segments.length > 1 || hasFolderCategory ? firstSegment : '';
    const keywordCategory = categorySegment ? null : getPickPageKeywordCategory(firstSegment);
    const key =
      keywordCategory?.id || (categorySegment ? categorySegment.toLowerCase() : '__main__');
    const existing = categoryMap.get(key);

    if (existing) {
      existing.links.push(link);
      existing.subtitle = formatPickPageCategorySubtitle(existing.links.length, categorySegment);
      return;
    }

    const title =
      keywordCategory?.title ||
      (categorySegment ? formatPickPageCategoryTitle(categorySegment) : 'Main Pages');
    categoryMap.set(key, {
      id: key,
      title,
      subtitle: formatPickPageCategorySubtitle(1, categorySegment),
      links: [link],
      stripLeadingSegments: categorySegment ? 1 : 0,
    });
  });

  return Array.from(categoryMap.values()).sort((a, b) => {
    if (a.id === '__main__') return -1;
    if (b.id === '__main__') return 1;
    return a.title.localeCompare(b.title, undefined, { numeric: true, sensitivity: 'base' });
  });
};
const getPickPageCategoryIconClassName = (index: number) => {
  const colorClasses = [
    'bg-red-50 text-red-600',
    'bg-neutral-100 text-neutral-700',
    'bg-red-100 text-red-700',
    'bg-neutral-200 text-neutral-800',
    'bg-neutral-100 text-neutral-600',
  ];
  return colorClasses[index % colorClasses.length];
};
/* One icon per known category so a list of several groups never repeats the
   same glyph; arbitrary folder-name categories fall back to a rotating pool
   that shares no icon with the keyword map, so the two sources can't collide. */
const PICK_PAGE_CATEGORY_ICON_MAP: Record<string, typeof Globe2> = {
  __main__: Globe2,
  'pricing-plans': TrendingUp,
  'features-services': Sparkles,
  'help-contact': Headphones,
  'company-info': UserRound,
  blog: MessageSquare,
  'legal-trust': FileText,
  'developers-integrations': Settings2,
  'industries-use-cases': Building2,
};
const PICK_PAGE_FALLBACK_ICONS = [Folder, Bot, PhoneCall, Gauge, RefreshCcw];
const getPickPageCategoryIcon = (categoryId: string, fallbackIndex: number) =>
  PICK_PAGE_CATEGORY_ICON_MAP[categoryId] ||
  PICK_PAGE_FALLBACK_ICONS[fallbackIndex % PICK_PAGE_FALLBACK_ICONS.length];
/* The dialog's built-in close button is styled per-dialog rather than globally:
   a grey tint circle on hover, and no focus ring, since the ring read as a
   stray grey border the moment the button was clicked. */
const MANAGER_SELECT_STYLE = `
/* index.css declares these in @layer base with !important, and a layered
   !important outranks an unlayered one no matter how specific - so these
   overrides have to join the same layer to land. */
@layer base {
    .ai-manager-select.custom-react-select__control,
    .ai-manager-select.custom-react-select__control:hover,
    .ai-manager-select.custom-react-select__control--is-focused,
    .ai-manager-select.custom-react-select__control--menu-is-open {
      border-color: var(--color-neutral-300) !important;
      box-shadow: none !important;
    }
    .ai-manager-select.custom-react-select__control:hover,
    .ai-manager-select.custom-react-select__control--is-focused,
    .ai-manager-select.custom-react-select__control--menu-is-open {
      border-color: var(--color-neutral-400) !important;
    }
    .ai-manager-select.custom-react-select__menu {
      border-color: var(--color-neutral-200) !important;
      border-radius: 0.75rem !important;
      padding: 0.375rem !important;
    }
    .ai-manager-select.custom-react-select__option {
      border-radius: 0.5rem !important;
      font-weight: 500 !important;
    }
    .ai-manager-select.custom-react-select__option:hover,
    .ai-manager-select.custom-react-select__option--is-focused {
      background-color: #f3f4f6 !important;
      color: var(--color-neutral-900) !important;
    }
    .ai-manager-select.custom-react-select__option--is-selected {
      background-color: var(--color-red-50) !important;
      color: var(--color-neutral-900) !important;
      font-weight: 600 !important;
    }
}
`;

const DIALOG_CLOSE_BUTTON_CLASS =
  '[&_[data-slot=dialog-close]]:flex [&_[data-slot=dialog-close]]:h-8 [&_[data-slot=dialog-close]]:w-8 [&_[data-slot=dialog-close]]:items-center [&_[data-slot=dialog-close]]:justify-center [&_[data-slot=dialog-close]]:rounded-full [&_[data-slot=dialog-close]]:outline-none! [&_[data-slot=dialog-close]]:ring-0! [&_[data-slot=dialog-close]]:ring-offset-0! [&_[data-slot=dialog-close]]:transition-colors [&_[data-slot=dialog-close]]:hover:bg-neutral-200/70';

const CALL_EMBED_SCRIPT_ID = 'ai-receptionist-call-widget-script';
const unloadAi360CallWidget = () => {
  const existing = document.getElementById(CALL_EMBED_SCRIPT_ID);
  if (existing) existing.remove();

  document.querySelectorAll('[id^="ai360-widget-call-"]').forEach((el) => el.remove());
};
const isHttpUrl = (value: string) => /^https?:\/\//i.test(String(value || '').trim());
const getKnowledgeBaseId = (item: any) => {
  if (item && typeof item === 'object') {
    return String(
      item.ingestionId || item.ingestion_id || item.uuid || item._id || item.id || item.value || '',
    ).trim();
  }
  return String(item || '').trim();
};
const normalizeKnowledgeBaseSelection = (value: unknown): string[] => {
  if (Array.isArray(value)) return uniqueStrings(value.map(getKnowledgeBaseId));
  if (typeof value === 'string') return uniqueStrings(value.split(','));
  if (value && typeof value === 'object') return uniqueStrings([getKnowledgeBaseId(value)]);
  return [];
};
const getKnowledgeBaseSelectionObjects = (value: unknown): any[] => {
  if (Array.isArray(value)) return value.filter((item) => item && typeof item === 'object');
  if (value && typeof value === 'object') return [value];
  return [];
};
const getKnowledgeBaseFallbackLookup = (...values: unknown[]) => {
  const lookup = new Map<string, any>();
  values.flatMap(getKnowledgeBaseSelectionObjects).forEach((item) => {
    const id = getKnowledgeBaseId(item);
    if (id && !lookup.has(id)) lookup.set(id, item);
  });
  return lookup;
};
const getKnowledgeBaseTitle = (item: any, fallbackId: string) =>
  String(
    item?.name || item?.title || item?.label || fallbackId || 'Untitled knowledge base',
  ).trim();
const getKnowledgeBaseDataValues = (item: any): string[] => {
  const values: string[] = [];
  const addValue = (value: unknown, depth = 0) => {
    if (typeof value === 'string') {
      values.push(value);
      return;
    }
    if (Array.isArray(value)) {
      value.forEach((nestedValue) => addValue(nestedValue, depth + 1));
      return;
    }
    if (value && typeof value === 'object') {
      const record = value as Record<string, unknown>;
      [
        'url',
        'urls',
        'link',
        'links',
        'href',
        'source_url',
        'sourceUrl',
        'file',
        'files',
        'file_url',
        'fileUrl',
        'public_url',
        'publicUrl',
        'pdf',
        'pdfs',
        'document',
        'documents',
        'text',
        'plain_text',
        'plainText',
        'content',
        'body',
        'summary',
        'description',
        'copy',
        'source',
        'value',
      ].forEach((key) => addValue(record[key], depth + 1));

      if (depth < 2) {
        ['data', 'payload', 'metadata', 'meta', 'details', 'resource'].forEach((key) =>
          addValue(record[key], depth + 1),
        );
      }
    }
  };

  ['urls', 'url', 'links', 'files', 'file', 'pdf', 'pdfs', 'documents', 'data'].forEach((key) => {
    const rawValue = item?.[key];
    addValue(rawValue);
  });
  [
    'text',
    'plain_text',
    'plainText',
    'url',
    'source_url',
    'sourceUrl',
    'file',
    'file_url',
    'fileUrl',
    'public_url',
    'publicUrl',
    'content',
    'body',
    'summary',
    'description',
    'copy',
    'source',
  ].forEach((key) => {
    if (typeof item?.[key] === 'string') values.push(item[key]);
  });

  return uniqueStrings(values);
};
const isPdfFileReference = (value: string) =>
  !isHttpUrl(value) && /\.pdf(?:[?#].*)?$/i.test(String(value || '').trim());
const getKnowledgeBasePdfFileReferences = (item: any): string[] => {
  const values: string[] = [];
  const addValue = (value: unknown) => {
    if (typeof value === 'string') {
      values.push(value);
      return;
    }
    if (Array.isArray(value)) {
      value.forEach(addValue);
    }
  };

  ['files', 'file', 'pdf', 'pdfs', 'documents'].forEach((key) => addValue(item?.[key]));
  return uniqueStrings(values).filter(isPdfFileReference);
};
const getKnowledgeBaseRows = (response: any): any[] => {
  const result =
    response?.data?.data?.result ||
    response?.data?.result ||
    response?.result ||
    response?.data?.data;

  if (Array.isArray(result)) return result;
  if (Array.isArray(result?.rows)) return result.rows;
  if (Array.isArray(response?.data?.data?.rows)) return response.data.data.rows;
  return [];
};
const getAgentListRows = (response: any): any[] => {
  const result =
    response?.data?.data?.result ||
    response?.data?.result ||
    response?.result ||
    response?.data?.data;

  if (Array.isArray(result)) return result;
  if (Array.isArray(result?.rows)) return result.rows;
  return [];
};
const getTokenIdFromResponse = (response: any) =>
  String(
    response?.data?.data?.result?.tokenId ||
      response?.data?.result?.tokenId ||
      response?.data?.tokenId ||
      '',
  ).trim();
const getDownloadPdfUrlFromResponse = (response: any) =>
  String(
    response?.data?.url ||
      response?.data?.data?.url ||
      response?.data?.data?.result?.url ||
      response?.url ||
      '',
  ).trim();
const resolveKnowledgeBasePdfUrls = async (fileReferences: string[]) => {
  const uniqueFileReferences = uniqueStrings(fileReferences).filter(isPdfFileReference);
  if (!uniqueFileReferences.length) return [];

  const tokenId = getTokenIdFromResponse(await getAIAgentToken());
  if (!tokenId) return [];

  const results = await Promise.allSettled(
    uniqueFileReferences.map(async (file) => {
      const response = await downloadPdf({ file, token: tokenId });
      return getDownloadPdfUrlFromResponse(response);
    }),
  );

  return uniqueStrings(
    results
      .filter((result): result is PromiseFulfilledResult<string> => result.status === 'fulfilled')
      .map((result) => result.value)
      .filter(isHttpUrl),
  );
};
const getKnowledgeBaseSourceLabel = (item: any, type: string) => {
  const firstValue = getKnowledgeBaseDataValues(item)[0];
  if (firstValue) return firstValue;
  if (type === 'text') return 'Saved text knowledge base';
  if (type === 'url') return 'Saved URL knowledge base';
  if (type === 'pdf') return 'Saved PDF knowledge base';
  return 'Saved knowledge base';
};
const getKnowledgeBaseSourceType = (item: any): KnowledgeBaseSourceType => {
  const type = String(item?.type || item?.source_type || item?.sourceType || '').toLowerCase();
  if (type.includes('url') || type.includes('web')) return 'url';
  if (type.includes('pdf') || type.includes('file') || type.includes('document')) return 'pdf';
  if (type.includes('text') || type.includes('content')) return 'text';

  const values = getKnowledgeBaseDataValues(item);
  if (values.some((value) => isPdfFileReference(value) || /\.pdf(?:[?#].*)?$/i.test(value))) {
    return 'pdf';
  }
  if (values.some(isLikelyUrl)) return 'url';
  return 'text';
};
const getKnowledgeBaseTypeLabel = (type: string) => {
  if (type === 'text') return 'Existing text';
  if (type === 'url') return 'Existing URL';
  if (type === 'pdf') return 'Existing document';
  return 'Existing knowledge';
};
const getMatchedKnowledgeBaseItems = (
  ids: string[],
  type: 'text' | 'url' | 'pdf',
  kbData: any[],
  fallbackLookup?: Map<string, any>,
) =>
  ids.map((id) => {
    const item =
      kbData.find((kbItem: any) => getKnowledgeBaseId(kbItem) === id) || fallbackLookup?.get(id);
    return { id, type, item };
  });
const normalizeKnowledgeFaqs = (value: any): KnowledgeFaq[] => {
  if (!Array.isArray(value)) return [];

  const seen = new Set<string>();
  return value
    .map((item: any) => ({
      id: String(item?.id || createLocalId('faq')),
      question: String(item?.question || '').trim(),
      answer: String(item?.answer || '').trim(),
      source: String(item?.source || 'Generated').trim(),
    }))
    .filter((item) => {
      if (!item.question && !item.answer) return false;
      const key = [item.question, item.answer, item.source].join('|').toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
};
const normalizeStoredKnowledgeDocuments = (value: any): KnowledgeDocument[] => {
  if (!Array.isArray(value)) return [];

  const seen = new Set<string>();
  return value
    .map((item: any, index: number) => ({
      id: String(item?.id || item?.uuid || item?.url || item?.source || `document-${index}`),
      title: String(
        item?.title || item?.name || item?.url || item?.source || `Document ${index + 1}`,
      ).trim(),
      copy: String(item?.copy || item?.summary || item?.description || item?.content || '').trim(),
      source: String(item?.source || item?.url || item?.fileName || item?.file_name || '').trim(),
      status: String(item?.status || 'Just generated').trim(),
      type: String(item?.type || '').trim(),
    }))
    .filter((item) => {
      if (!item.title && !item.copy && !item.source) return false;
      const key = [item.title, item.source, item.copy].join('|').toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
};
const getStoredKnowledgeBaseDocuments = (item: any): KnowledgeDocument[] => {
  const documents =
    item?.documents || item?.knowledgeDocuments || item?.knowledge_documents || item?.summaries;
  const normalizedDocuments = normalizeStoredKnowledgeDocuments(documents);
  if (normalizedDocuments.length) return normalizedDocuments;

  const summary = String(item?.summary || item?.summaryText || item?.summary_text || '').trim();
  if (!summary) return [];

  return normalizeStoredKnowledgeDocuments([
    {
      id: getKnowledgeBaseId(item) || 'saved-summary',
      title: getKnowledgeBaseTitle(item, 'Saved knowledge base'),
      copy: summary,
      source: getKnowledgeBaseSourceLabel(item, getKnowledgeBaseSourceType(item)),
      status: 'Attached',
      type: getKnowledgeBaseSourceType(item),
    },
  ]);
};
const getStoredKnowledgeBaseFaqs = (item: any): KnowledgeFaq[] => {
  const faqs = item?.faqs || item?.faq || item?.knowledgeFaqs || item?.knowledge_faqs;
  return normalizeKnowledgeFaqs(Array.isArray(faqs) ? faqs : faqs ? [faqs] : []);
};
const getCreatedAgentId = (agent: any) =>
  String(
    agent?.agent_uuid || agent?.agentId || agent?.id || agent?.uuid || agent?._id || '',
  ).trim();
const getCreatedAgentName = (agent: any) =>
  String(agent?.agentName || agent?.name || 'Untitled agent').trim();
const getRelativeUpdatedLabel = (value: unknown) => {
  const time = new Date(String(value || '')).getTime();
  if (!Number.isFinite(time)) return 'updated recently';

  const diffMs = Date.now() - time;
  const minuteMs = 60 * 1000;
  const hourMs = 60 * minuteMs;
  const dayMs = 24 * hourMs;

  if (diffMs < hourMs) return 'updated within the hour';
  if (diffMs < dayMs) return `updated ${Math.max(1, Math.round(diffMs / hourMs))}h ago`;
  return `updated ${Math.max(1, Math.round(diffMs / dayMs))}d ago`;
};
const buildReusableKnowledgeAgent = (
  agent: any,
  channel: 'chat' | 'voice',
): ReusableKnowledgeAgent | null => {
  const id = getCreatedAgentId(agent);
  if (!id) return null;

  const forwardActions = agent?.forward_call_actions || agent?.forwardCallActions || {};
  const builder =
    channel === 'chat' ? forwardActions?.chatbot_builder : forwardActions?.receptionist_builder;
  const knowledgeState = channel === 'chat' ? builder : builder?.knowledge;
  const generated = channel === 'chat' ? builder?.generated : builder?.knowledge?.generated;
  const generatedTextId = String(
    channel === 'chat'
      ? generated?.faqKnowledgeBaseId || ''
      : generated?.generatedKnowledgeBaseId || '',
  ).trim();
  const selectedKnowledgeBase =
    knowledgeState?.sources?.selectedKnowledgeBase || knowledgeState?.selectedKnowledgeBase || {};
  const documents = normalizeStoredKnowledgeDocuments(generated?.documents);
  const summaryText = String(generated?.summaryText || generated?.summary || '').trim();
  const finalDocuments = documents.length
    ? documents
    : normalizeStoredKnowledgeDocuments(
        summaryText
          ? [
              {
                id: `${id}-summary`,
                title: 'Knowledge base summary',
                copy: summaryText,
                source: getCreatedAgentName(agent),
                status: 'Attached',
                type: 'text',
              },
            ]
          : [],
      );
  const faqs = normalizeKnowledgeFaqs(generated?.faqs);
  const textIds = uniqueStrings([
    generatedTextId,
    ...normalizeKnowledgeBaseSelection(selectedKnowledgeBase?.text),
  ]);
  const urlIds = normalizeKnowledgeBaseSelection(selectedKnowledgeBase?.url);
  const pdfIds = normalizeKnowledgeBaseSelection(selectedKnowledgeBase?.pdf);
  const companyName = String(
    agent?.companyName || agent?.company_name || agent?.company || '',
  ).trim();
  const meta = [
    companyName,
    `${finalDocuments.length} docs`,
    `${faqs.length} FAQs`,
    getRelativeUpdatedLabel(
      agent?.updatedAt || agent?.updated_at || agent?.createdAt || agent?.created_at,
    ),
  ]
    .filter(Boolean)
    .join(' · ');

  return {
    id: `${channel}-${id}`,
    channel,
    name: getCreatedAgentName(agent),
    meta,
    documents: finalDocuments,
    faqs,
    textIds,
    urlIds,
    pdfIds,
  };
};
const getKnowledgeBaseSummaryResponseItems = (response: any): KnowledgeDocument[] => {
  const result = response?.data?.data || response?.data || response || {};
  const documents = Array.isArray(result?.documents) ? result.documents : [];

  if (documents.length) {
    return normalizeStoredKnowledgeDocuments(documents);
  }

  const summaries = result?.summaries || {};
  const rows: any[] = [];
  const crawlSummary = String(summaries?.crawl_url?.summary || '').trim();
  const crawlUrls = Array.isArray(summaries?.crawl_url?.urls) ? summaries.crawl_url.urls : [];

  if (crawlSummary) {
    rows.push({
      id: 'crawl-summary',
      title: 'Website crawl summary',
      copy: crawlSummary,
      source: crawlUrls.join(', '),
      status: 'Just generated',
      type: 'url',
    });
  }

  if (Array.isArray(summaries?.url)) {
    summaries.url.forEach((item: any, index: number) => {
      rows.push({
        id: `url-summary-${index}`,
        title: item?.title || getPageTitle(String(item?.url || item?.source || '')),
        copy: item?.summary,
        source: item?.url || item?.source,
        status: 'Just generated',
        type: 'url',
      });
    });
  }

  if (Array.isArray(summaries?.text)) {
    summaries.text.forEach((item: any, index: number) => {
      rows.push({
        id: `text-summary-${index}`,
        title: item?.title || item?.source || `Custom content ${index + 1}`,
        copy: item?.summary,
        source: item?.source || 'Pasted text',
        status: 'Just generated',
        type: 'text',
      });
    });
  }

  if (Array.isArray(summaries?.pdf)) {
    summaries.pdf.forEach((item: any, index: number) => {
      rows.push({
        id: `pdf-summary-${index}`,
        title: item?.title || item?.source || `PDF ${index + 1}`,
        copy: item?.summary,
        source: item?.source || 'PDF upload',
        status: 'Just generated',
        type: 'pdf',
      });
    });
  }

  return normalizeStoredKnowledgeDocuments(rows);
};
const getKnowledgeReviewJobId = (response: any) =>
  String(response?.data?.data?.jobId || response?.data?.jobId || response?.jobId || '').trim();
const getKnowledgeReviewJobStatus = (response: any) =>
  String(response?.data?.data?.status || response?.data?.status || response?.status || '').trim();
const createEmptyKnowledgeFaq = (): KnowledgeFaq => ({
  id: createLocalId('faq'),
  question: '',
  answer: '',
  source: 'Manual',
});
const getKnowledgeFaqResponseItems = (response: any) => {
  const faqs =
    response?.data?.data?.faqs ||
    response?.data?.faqs ||
    response?.data?.data?.result?.faqs ||
    response?.data?.result?.faqs ||
    [];

  return normalizeKnowledgeFaqs(faqs);
};
const getValidKnowledgeFaqs = (items: KnowledgeFaq[]) =>
  items.filter((item) => item.question.trim() && item.answer.trim());
const formatKnowledgeFaqText = (items: KnowledgeFaq[]) =>
  getValidKnowledgeFaqs(items)
    .map((item) =>
      [
        'FAQ priority knowledge. Use this first when the user question directly matches this FAQ.',
        `Q: ${item.question.trim()}`,
        `A: ${item.answer.trim()}`,
        item.source.trim() ? `Source: ${item.source.trim()}` : '',
      ]
        .filter(Boolean)
        .join('\n'),
    )
    .join('\n\n');
const formatKnowledgeSummaryText = (items: KnowledgeDocument[]) =>
  items
    .map((item) =>
      [
        'Summary fallback knowledge. Use this when no FAQ answer directly matches.',
        item.title.trim() ? `Title: ${item.title.trim()}` : '',
        item.copy.trim() ? `Summary: ${item.copy.trim()}` : '',
        item.source.trim() ? `Source: ${item.source.trim()}` : '',
      ]
        .filter(Boolean)
        .join('\n'),
    )
    .filter(Boolean)
    .join('\n\n');
const formatGeneratedKnowledgeText = (faqs: KnowledgeFaq[], documents: KnowledgeDocument[]) => {
  const faqText = formatKnowledgeFaqText(faqs);
  const summaryText = formatKnowledgeSummaryText(documents);

  return [
    faqText ? `[FAQ Knowledge]\n${faqText}` : '',
    summaryText ? `[Summary Knowledge]\n${summaryText}` : '',
  ]
    .filter(Boolean)
    .join('\n\n')
    .trim();
};
const isSameGeneratedKnowledgeText = (left: string, right: string) =>
  left.replace(/\s+/g, ' ').trim() === right.replace(/\s+/g, ' ').trim();
const getIngestionIdFromResponse = (response: any) =>
  String(response?.data?.ingestionId || response?.data?.data?.ingestionId || '').trim();

const cloneForwardCallState = (value?: ForwardCallState | null): ForwardCallState =>
  value ? (JSON.parse(JSON.stringify(value)) as ForwardCallState) : {};
const isRealtimePreviewVoice = (
  voiceValue: string,
): voiceValue is (typeof REALTIME_PREVIEW_VOICES)[number] =>
  (REALTIME_PREVIEW_VOICES as readonly string[]).includes(voiceValue);
const normalizeStoredVoiceValue = (voiceValue: unknown) => {
  const rawValue =
    typeof voiceValue === 'object' && voiceValue
      ? (voiceValue as any)?.value || (voiceValue as any)?.label || (voiceValue as any)?.name
      : voiceValue;
  const normalized = String(rawValue || '')
    .trim()
    .toLowerCase();
  if (!normalized) return '';
  if (isRealtimePreviewVoice(normalized)) return normalized;
  const matchedVoice = [...voiceOptions, ...spanishVoiceOptions, ...hindiVoiceOptions].find(
    (voice) => voice.value.toLowerCase() === normalized || voice.label.toLowerCase() === normalized,
  );
  if (matchedVoice) return matchedVoice.value;
  return LEGACY_PERSONA_TO_REALTIME_VOICE[normalized] || '';
};
const getStoredReceptionistVoice = (initialData: any, builderState: any) =>
  initialData?.agentVoice ??
  initialData?.agent_voice ??
  initialData?.voice ??
  initialData?.voiceName ??
  initialData?.voice_name ??
  initialData?.selectedVoice ??
  initialData?.selected_voice ??
  builderState?.voice?.persona ??
  builderState?.voice?.selectedPersona ??
  builderState?.voice?.agentVoice;

const normalizeBoundedInteger = (
  value: unknown,
  fallback: number,
  max: number,
  min = 1,
): number => {
  const numberValue = Number(value);
  if (!Number.isFinite(numberValue)) return fallback;
  return Math.min(max, Math.max(min, Math.trunc(numberValue)));
};

type BoundedIntegerInputValue = number | '';

const normalizeBoundedIntegerInput = (
  value: string,
  max: number,
  min = 1,
): BoundedIntegerInputValue => {
  if (value === '') return '';
  return normalizeBoundedInteger(value, min, max, min);
};

const isUuidLike = (value: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
const normalizeSourceStage = (value: unknown, fallback: SourceStage): SourceStage => {
  const numericValue = Number(value);
  return numericValue === 1 || numericValue === 2 || numericValue === 3 ? numericValue : fallback;
};
const getReceptionistAvatarImage = (agent: any) =>
  String(agent?.avatar || agent?.profile || agent?.image || agent?.agentAvatar || '').trim();
const getReceptionistId = (agent: any) =>
  String(agent?.agent_uuid || agent?.agentId || agent?.id || agent?.uuid || agent?._id || '');
const getReceptionistMetricsById = (rows: any[] = []) => {
  const metricsByAgentId = new Map<string, any>();
  rows.forEach((row) => {
    const agentId = getReceptionistId(row);
    if (agentId) metricsByAgentId.set(agentId, row);
  });
  return metricsByAgentId;
};
const mergeReceptionistMetrics = (agent: any, metricsByAgentId: Map<string, any>) => {
  const row = { ...agent };
  delete row.analytics;
  delete row.metrics;
  delete row.calls_handled;
  delete row.calls_handled_7d;
  delete row.calls_7d;
  delete row.call_count;
  delete row.callCount;
  delete row.resolution_rate;
  delete row.resolutionRate;
  delete row.average_call_duration;
  delete row.handoffs;
  delete row.sentiment_calls;
  delete row.avg_sentiment;
  delete row.sentiment_counts;
  delete row.sentiment_label;
  delete row.confidence_count;
  delete row.avg_confidence;
  return {
    ...row,
    ...(metricsByAgentId.get(getReceptionistId(agent)) || {}),
  };
};

function ForwardTypeCell({ data, onUpdate, optionsData, userExtension }: any) {
  const originalBusinessHours = data?.forward_call_actions?.call_handling?.business_hours || {};
  const originalType = originalBusinessHours.type || 'HANGUP';
  const originalTypeLabel = getForwardTypeLabel(originalType);
  const extensionList = optionsData?.extensionList || [];
  const greetingList = optionsData?.greetingList || [];
  const departmentList = optionsData?.departmentList || [];
  const IVRList = optionsData?.IVRList || [];
  const queueList = optionsData?.queueList || [];

  const showForwardToForType = (type?: string) => type !== 'HANGUP';
  const getResolvedForwardValueLabel = useCallback(
    (type: string, value: any, isPersonal?: boolean) => {
      const rawValue = String(value || '').trim();
      if (!rawValue) return '';

      if (type === 'VOICEMAIL' && isPersonal) return 'My Voicemail';

      if (type === 'EXTENSION' || type === 'VOICEMAIL') {
        const matched = Array.isArray(extensionList)
          ? extensionList.find((extension: any) => {
              const extensionNumber = String(extension?.extension || '').trim();
              const extensionUuid = String(extension?.uuid || '').trim();
              const extensionUserUuid = String(
                extension?.user_uuid || extension?.userId || '',
              ).trim();
              return (
                rawValue === extensionNumber ||
                rawValue === extensionUuid ||
                rawValue === extensionUserUuid
              );
            })
          : null;
        if (matched) {
          return `${matched?.first_name || ''}${matched?.last_name ? ` ${matched.last_name}` : ''}`.trim();
        }
        if (!isUuidLike(rawValue)) return rawValue;
      }

      if (type === 'GREETING') {
        const matched = Array.isArray(greetingList)
          ? greetingList.find((greeting: any) => String(greeting?.filename || '') === rawValue)
          : null;
        return matched?.name || '';
      }

      if (type === 'DEPARTMENT') {
        const matched = Array.isArray(departmentList)
          ? departmentList.find((department: any) => String(department?.uuid || '') === rawValue)
          : null;
        return matched?.name || '';
      }

      if (type === 'IVR') {
        const matched = Array.isArray(IVRList)
          ? IVRList.find((ivr: any) => String(ivr?.uuid || '') === rawValue)
          : null;
        return matched?.name || '';
      }

      if (type === 'QUEUE') {
        const matched = Array.isArray(queueList)
          ? queueList.find((queue: any) =>
              [queue?.uuid, queue?._id, queue?.id].map((id) => String(id || '')).includes(rawValue),
            )
          : null;
        return matched?.name || '';
      }

      if (type === 'PHONE') return rawValue;

      return '';
    },
    [extensionList, greetingList, departmentList, IVRList, queueList],
  );

  const resolvedOriginalValueLabel = useMemo(
    () =>
      getResolvedForwardValueLabel(
        originalType,
        originalBusinessHours.value,
        originalBusinessHours.personal,
      ),
    [
      getResolvedForwardValueLabel,
      originalType,
      originalBusinessHours.value,
      originalBusinessHours.personal,
    ],
  );
  const isGenericOriginalLabel =
    !originalBusinessHours.label ||
    originalBusinessHours.label === 'Select' ||
    originalBusinessHours.label === originalTypeLabel;
  const initialForwardValueLabel = originalBusinessHours.personal
    ? 'My Voicemail'
    : isGenericOriginalLabel
      ? resolvedOriginalValueLabel
      : originalBusinessHours.label;
  const originalValueLabel = showForwardToForType(originalType)
    ? originalBusinessHours.personal
      ? 'My Voicemail'
      : isGenericOriginalLabel
        ? resolvedOriginalValueLabel || '-'
        : originalBusinessHours.label
    : '-';

  const [isUpdating, setIsUpdating] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const {
    watch,
    setValue,
    reset,
    getValues,
    formState: { errors },
  } = useForm({
    defaultValues: {
      forwardState: {
        type: {
          label: originalTypeLabel,
          value: originalType,
        },
        value: {
          label: initialForwardValueLabel || 'Select',
          value: originalBusinessHours.value || '',
        },
        personal: originalBusinessHours.personal ?? false,
      },
    },
  });

  const originalBusinessHoursKey = useMemo(
    () => JSON.stringify(originalBusinessHours),
    [originalBusinessHours],
  );

  useEffect(() => {
    if (isUpdating) return;

    reset({
      forwardState: {
        type: {
          label: originalTypeLabel,
          value: originalType,
        },
        value: {
          label: initialForwardValueLabel || 'Select',
          value: originalBusinessHours.value || '',
        },
        personal: originalBusinessHours.personal ?? false,
      },
    });
  }, [
    initialForwardValueLabel,
    isUpdating,
    originalBusinessHours.value,
    originalBusinessHours.personal,
    originalBusinessHoursKey,
    originalType,
    originalTypeLabel,
    reset,
  ]);

  const currentValues = watch('forwardState') || {};
  const hasChanged =
    currentValues.type?.value !== originalType ||
    currentValues.value?.value !== (originalBusinessHours.value || '') ||
    currentValues.personal !== (originalBusinessHours.personal ?? false);
  const selectedTypeLabel =
    currentValues.type?.label || getForwardTypeLabel(currentValues.type?.value || originalType);
  const shouldShowForwardTo = showForwardToForType(currentValues.type?.value || originalType);
  const summaryShouldShowForwardTo = showForwardToForType(originalType);
  const forwardValueFieldLabel = getForwardValueFieldLabel(originalType);
  const resolvedCurrentValueLabel = getResolvedForwardValueLabel(
    currentValues.type?.value || originalType,
    currentValues.value?.value,
    currentValues.personal,
  );
  const currentLabel = currentValues.value?.label;
  const isGenericCurrentLabel =
    !currentLabel || currentLabel === 'Select' || currentLabel === selectedTypeLabel;
  const selectedValueLabel = shouldShowForwardTo
    ? currentValues.type?.value === 'VOICEMAIL' && currentValues.personal
      ? 'My Voicemail'
      : !isGenericCurrentLabel
        ? currentLabel
        : resolvedCurrentValueLabel || originalValueLabel
    : '-';

  const handleUpdateClick = () => {
    const formValues = getValues('forwardState');
    const selectedType = formValues.type.value;
    const shouldShowForwardToValue = showForwardToForType(selectedType);
    const businessHours = {
      type: selectedType,
      value: shouldShowForwardToValue ? formValues.value.value : '',
      label: shouldShowForwardToValue
        ? formValues.value.label || formValues.type.label
        : formValues.type.label,
      personal: formValues.personal,
    };
    setIsUpdating(true);
    onUpdate(data, businessHours, (success: boolean) => {
      setIsUpdating(false);
      if (success) {
        setIsEditModalOpen(false);
      } else {
        reset();
      }
    });
  };

  return (
    <div className="flex min-w-[270px] flex-col gap-2">
      <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
        <div className="flex items-start justify-between gap-3">
          <div className={cx('min-w-0', summaryShouldShowForwardTo ? '' : 'flex-1')}>
            <p className="text-xs text-gray-500">Forward Type</p>
            <p className="truncate text-sm font-semibold text-gray-900">{originalTypeLabel}</p>
          </div>
          {summaryShouldShowForwardTo ? (
            <div className="min-w-0">
              <p className="text-xs text-gray-500">{forwardValueFieldLabel}</p>
              <p className="truncate text-sm font-semibold text-gray-900">{originalValueLabel}</p>
            </div>
          ) : null}
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-8 shrink-0"
            onClick={() => setIsEditModalOpen(true)}
          >
            <Edit3 className="h-3.5 w-3.5" />
            Edit
          </Button>
        </div>
      </div>

      <Dialog
        open={isEditModalOpen}
        onOpenChange={(open) => {
          if (!open && isUpdating) return;
          setIsEditModalOpen(open);
          if (!open) reset();
        }}
      >
        <DialogContent className={cx('max-w-[520px] bg-white!', DIALOG_CLOSE_BUTTON_CLASS)}>
          <DialogHeader>
            <DialogTitle>Edit Forwarding Destination</DialogTitle>
          </DialogHeader>
          <div className="pt-1">
            <ForwardActionAllAi
              watch={watch}
              setValue={setValue}
              forwardType="forwardState.type"
              forwardValue="forwardState.value"
              enableVoicemailChoice={true}
              voicemailPersonalField="forwardState.personal"
              optionsData={optionsData}
              userExtension={userExtension}
              forwardTypeError={(errors as any)?.forwardState?.type?.message || ''}
              forwardValueError={(errors as any)?.forwardState?.value?.message || ''}
              forwardTypeClass="w-full"
              forwardValueClass="w-full"
              selectCustomClassSecond="w-full"
            />
            <div className="mt-4 rounded-lg border border-gray-100 bg-gray-50 p-3">
              <p className="text-xs text-gray-500">Selected</p>
              <p className="text-sm font-medium text-gray-900">
                {shouldShowForwardTo
                  ? `${selectedTypeLabel} - ${selectedValueLabel}`
                  : selectedTypeLabel}
              </p>
            </div>
          </div>
          <DialogFooter className="sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                reset();
                setIsEditModalOpen(false);
              }}
              disabled={isUpdating}
            >
              Cancel
            </Button>
            <Button type="button" onClick={handleUpdateClick} disabled={isUpdating || !hasChanged}>
              {isUpdating ? (
                <span className="inline-flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Saving...
                </span>
              ) : (
                'Save'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
console.log(ForwardTypeCell);

function NewAiReceptionistPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useUser();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'live'>('all');
  const [isTableRefreshing, setIsTableRefreshing] = useState(false);
  const receptionistTableRef = useRef<any>(null);
  const [view, setView] = useState<'list' | 'form' | 'analytics'>('list');
  const [editData, setEditData] = useState<any>(null);
  const [builderMode, setBuilderMode] = useState<BuilderMode>('create');
  const [initialEditTab, setInitialEditTab] = useState<ReceptionistEditTab | undefined>();
  const [deleteAgent, setDeleteAgent] = useState<any>(null);
  const [promptAgent, setPromptAgent] = useState<any>(null);
  const [assignCallerAgent, setAssignCallerAgent] = useState<any>(null);
  const [isUpdatingPrompt, setIsUpdatingPrompt] = useState(false);
  const receptionistMetricDateFilters = useMemo(
    () => ({
      from: moment().subtract(7, 'days').startOf('day').format('YYYY-MM-DD'),
      to: moment().format('YYYY-MM-DD'),
    }),
    [],
  );

  const invalidateReceptionistQueries = useCallback(() => {
    queryClient.invalidateQueries({
      predicate: (query) => String(query.queryKey?.[0] || '').includes('getAIReceptionist'),
    });
  }, [queryClient]);

  const { data: receptionistData, isFetching: isReceptionistStatsFetching } = useQuery({
    queryKey: ['getAIReceptionistList', 'new-page'],
    queryFn: () => getAIReceptionistList({ page: 1, limit: 1000, filters: [], search: '' }),
    select: (data: any) => data?.data?.data?.result || {},
  });
  console.log(receptionistData, 'receptionistData');

  // DUMMY DATA - local status flips for the preview rows.
  const [dummyStatusOverrides, setDummyStatusOverrides] = useState<Record<string, string>>(
    {},
  );
  const dummyReceptionists = useMemo(
    () =>
      DUMMY_RECEPTIONISTS.map((agent) => {
        const override = dummyStatusOverrides[agent.agentId];
        return override ? { ...agent, status: override, agentStatus: override } : agent;
      }),
    [dummyStatusOverrides],
  );

  const receptionistRows = useMemo(
    () => (Array.isArray(receptionistData?.rows) ? receptionistData.rows : []),
    [receptionistData?.rows],
  );
  const receptionistMetricAgentIds = useMemo(
    () => receptionistRows.map(getReceptionistId).filter(Boolean),
    [receptionistRows],
  );
  const { data: receptionistMetricsData, isFetching: isReceptionistMetricsFetching } = useQuery({
    queryKey: [
      'getAIReceptionistMetrics',
      'new-page',
      receptionistMetricDateFilters,
      receptionistMetricAgentIds,
    ],
    queryFn: () =>
      getAIReceptionistMetrics({
        agentIds: receptionistMetricAgentIds,
        date_filters: receptionistMetricDateFilters,
      }),
    enabled: receptionistMetricAgentIds.length > 0,
    refetchOnWindowFocus: false,
    retry: false,
    select: (data: any) => data?.data?.data?.result || {},
  });
  const receptionistMetricsById = useMemo(
    () => getReceptionistMetricsById(receptionistMetricsData?.rows || []),
    [receptionistMetricsData?.rows],
  );
  const receptionistsWithMetrics = useMemo(() => {
    const merged = receptionistRows.map((agent: any) =>
      mergeReceptionistMetrics(agent, receptionistMetricsById),
    );
    // DUMMY DATA - so the overview KPIs count the preview rows too.
    return SHOW_DUMMY_DATA ? [...merged, ...dummyReceptionists] : merged;
  }, [receptionistRows, receptionistMetricsById, dummyReceptionists]);
  // DUMMY DATA - the KPI strip and the All/Live counts come from server
  // aggregates, so the preview rows are folded in here as well.
  const dummyReceptionistStats = useMemo(() => {
    const rows = SHOW_DUMMY_DATA ? dummyReceptionists : [];
    const weight = (row: any) => Number(row?.calls_handled || 0);
    return {
      count: rows.length,
      live: rows.filter((row: any) =>
        ['active', 'live'].includes(String(row?.status || '').toLowerCase()),
      ).length,
      calls7d: rows.reduce((sum, row: any) => sum + Number(row?.calls_handled_7d || 0), 0),
      calls: rows.reduce((sum, row: any) => sum + weight(row), 0),
      durationTotal: rows.reduce(
        (sum, row: any) => sum + Number(row?.average_call_duration || 0) * weight(row),
        0,
      ),
      resolutionTotal: rows.reduce(
        (sum, row: any) => sum + Number(row?.resolution_rate || 0) * weight(row),
        0,
      ),
      sentimentCalls: rows.reduce((sum, row: any) => sum + Number(row?.sentiment_calls || 0), 0),
      sentimentTotal: rows.reduce(
        (sum, row: any) => sum + Number(row?.avg_sentiment || 0) * Number(row?.sentiment_calls || 0),
        0,
      ),
    };
  }, [dummyReceptionists]);

  const serverCallsHandled = pickNumber(
    receptionistMetricsData,
    ['calls_handled', 'calls_handled_7d'],
    0,
  );
  const serverAverageCallDuration = pickNumber(
    receptionistMetricsData,
    ['average_call_duration'],
    0,
  );
  const callsHandled = serverCallsHandled + dummyReceptionistStats.calls7d;
  const averageCallDuration =
    dummyReceptionistStats.calls > 0
      ? Math.round(
          (serverAverageCallDuration * serverCallsHandled + dummyReceptionistStats.durationTotal) /
            (serverCallsHandled + dummyReceptionistStats.calls),
        )
      : serverAverageCallDuration;
  const { data: extensionList = [] } = useGetExtensions({
    page: 1,
    limit: 1000,
    filters: [],
    search: '',
  });
  const { greetingList = [] } = useGetGreetings({ displayType: 'dropdown' });
  const { data: departmentList = [] } = useGetDepartment({ displayType: 'dropdown' });
  const { data: IVRList = [] } = useGetIVR({ displayType: 'dropdown' });
  const { data: queueList = [] } = useGetQueueList({ displayType: 'dropdown' });
  const forwardingOptionsData = useMemo(
    () => ({
      extensionList,
      greetingList,
      departmentList,
      IVRList,
      queueList,
    }),
    [extensionList, greetingList, departmentList, IVRList, queueList],
  );

  const { mutateAsync: fetchToken, isPending: isPendingToken } = useMutation({
    mutationFn: getAIAgentToken,
    mutationKey: ['getAIAgentToken'],
  });
  const { mutate: deleteReceptionist, isPending: isDeleting } = useMutation({
    mutationFn: deleteAIReceptionist,
    onSuccess: () => {
      handleAlert({ text: 'AI Receptionist deleted successfully!', type: 'success' });
      setDeleteAgent(null);
      invalidateReceptionistQueries();
    },
    onError: () => handleAlert({ text: 'Failed to delete AI Receptionist.', type: 'error' }),
  });
  const { mutate: updateReceptionist } = useMutation({
    mutationFn: updateAiReceptionist,
    onSuccess: () => {
      invalidateReceptionistQueries();
      handleAlert({ text: 'Updated successfully!', type: 'success' });
    },
    onError: (error: any) => {
      console.error('Failed to update:', error);
      handleAlert({ text: 'Failed to update.', type: 'error' });
    },
  });
  const { mutate: updateStatusMutation } = useMutation({
    mutationFn: updateAgentStatus,
    onSuccess: () => {
      invalidateReceptionistQueries();
      handleAlert({ text: 'Status updated successfully!', type: 'success' });
    },
    onError: (error: any) => {
      console.error('Failed to update status:', error);
      handleAlert({ text: 'Failed to update status.', type: 'error' });
    },
  });

  const tableSelect = useMemo(
    () => (data: any) => {
      const rows = data?.data?.data?.result?.rows || [];
      const mergedRows = rows.map((agent: any) =>
        mergeReceptionistMetrics(agent, receptionistMetricsById),
      );
      // DUMMY DATA - appended after the metric merge so their own figures survive.
      const rowsWithMetrics = SHOW_DUMMY_DATA
        ? [...mergedRows, ...dummyReceptionists]
        : mergedRows;
      if (statusFilter === 'all') return rowsWithMetrics;
      return rowsWithMetrics.filter((row: any) => {
        if (row?.deletedAt || row?.deleted_at) return false;
        const status = String(row?.status || row?.agentStatus || 'inactive').toLowerCase();
        return status === 'active' || status === 'live';
      });
    },
    [receptionistMetricsById, statusFilter, dummyReceptionists],
  );
  const liveReceptionists = useMemo(
    () =>
      receptionistsWithMetrics.filter((row: any) => {
        if (row?.deletedAt || row?.deleted_at) return false;
        const status = String(row?.status || row?.agentStatus || 'inactive').toLowerCase();
        return status === 'active' || status === 'live';
      }),
    [receptionistsWithMetrics],
  );
  const totalReceptionistsCount = useMemo(
    () =>
      pickNumber(
        receptionistData,
        ['counts.all', 'totalItems', 'total', 'totalRecords', 'count'],
        receptionistRows.length,
      ) + dummyReceptionistStats.count,
    [receptionistData, receptionistRows.length, dummyReceptionistStats.count],
  );
  const liveReceptionistsCount = useMemo(
    () =>
      pickNumber(
        receptionistData,
        ['counts.active', 'active', 'activeCount'],
        liveReceptionists.length,
      ) + dummyReceptionistStats.live,
    [receptionistData, liveReceptionists.length, dummyReceptionistStats.live],
  );
  const tableFilters = useMemo(
    () => (statusFilter === 'live' ? [{ key: 'status', value: 'active' }] : []),
    [statusFilter],
  );

  const listStats = useMemo(() => {
    const totalCalls = callsHandled;
    const serverResolution = pickNumber(receptionistMetricsData, ['resolution_rate'], 0);
    const resolutionRate =
      dummyReceptionistStats.calls > 0
        ? Math.round(
            (serverResolution * serverCallsHandled + dummyReceptionistStats.resolutionTotal) /
              (serverCallsHandled + dummyReceptionistStats.calls),
          )
        : serverResolution;
    const avgDuration = averageCallDuration;
    const sentimentRows = receptionistsWithMetrics
      .map((row: any) => ({
        calls: Number(row?.sentiment_calls || 0),
        score: Number(row?.avg_sentiment || 0),
      }))
      .filter((row: any) => row.calls > 0 && Number.isFinite(row.score));
    const resultSentimentCalls = pickNumber(receptionistMetricsData, ['sentiment_calls'], 0);
    const serverSentimentCalls =
      resultSentimentCalls ||
      sentimentRows
        .filter((row: any) => !dummyReceptionistStats.count || row.calls > 0)
        .reduce((sum: number, row: any) => sum + row.calls, 0) -
        dummyReceptionistStats.sentimentCalls;
    const baseSentimentCalls = Math.max(0, serverSentimentCalls);
    const serverAvgSentiment = baseSentimentCalls
      ? pickNumber(receptionistMetricsData, ['avg_sentiment'], 0) ||
        sentimentRows.reduce((sum: number, row: any) => sum + row.score * row.calls, 0) /
          Math.max(1, sentimentRows.reduce((sum: number, row: any) => sum + row.calls, 0))
      : 0;
    const sentimentCalls = baseSentimentCalls + dummyReceptionistStats.sentimentCalls;
    const avgSentiment = sentimentCalls
      ? (serverAvgSentiment * baseSentimentCalls + dummyReceptionistStats.sentimentTotal) /
        sentimentCalls
      : 0;
    // Below-target metrics borrow the same red the rest of the screen reserves for
    // things that need attention — matching the Performance/Queues KPI strip, where
    // only Service level and Abandon rate get colored while healthy numbers stay ink.
    const resolutionValueTone: 'default' | 'warn' | 'critical' =
      sentimentCalls === 0 && totalCalls === 0
        ? 'default'
        : resolutionRate < 50
          ? 'critical'
          : resolutionRate < 80
            ? 'warn'
            : 'default';
    const sentimentValueTone: 'default' | 'warn' | 'critical' = !sentimentCalls
      ? 'default'
      : avgSentiment < 50
        ? 'critical'
        : avgSentiment < 75
          ? 'warn'
          : 'default';

    return [
      {
        label: 'Total receptionists',
        value: String(totalReceptionistsCount),
        helper:
          totalReceptionistsCount > 0 && liveReceptionistsCount === totalReceptionistsCount
            ? 'All live'
            : `${liveReceptionistsCount} live`,
        description: 'Voice agents on this account',
        icon: <Bot />,
        tone: 'violet' as const,
        valueTone: 'default' as const,
      },
      {
        label: 'Calls handled (7d)',
        value: String(totalCalls),
        description: 'Inbound calls, last 7 days',
        icon: <PhoneCall />,
        tone: 'blue' as const,
        valueTone: 'default' as const,
      },
      {
        label: 'Resolution rate',
        value: formatPercent(resolutionRate),
        description: 'Resolved without a transfer',
        icon: <Gauge />,
        tone: 'emerald' as const,
        valueTone: resolutionValueTone,
      },
      {
        label: 'Avg call duration',
        value: formatDuration(avgDuration),
        description: 'Per handled call',
        icon: <Clock3 />,
        tone: 'amber' as const,
        valueTone: 'default' as const,
      },
      {
        label: 'Overall sentiment',
        value: sentimentCalls ? `${Math.round(avgSentiment)}` : 'Not analyzed',
        description: sentimentCalls
          ? `${sentimentCalls} call${sentimentCalls === 1 ? '' : 's'} analyzed`
          : 'No calls analyzed yet',
        icon: <Smile />,
        tone: 'rose' as const,
        valueTone: sentimentValueTone,
      },
    ];
  }, [
    receptionistMetricsData,
    receptionistsWithMetrics,
    callsHandled,
    averageCallDuration,
    totalReceptionistsCount,
    liveReceptionistsCount,
  ]);

  const handleDelete = async () => {
    const tokenResponse = await fetchToken();
    const tokenId = tokenResponse?.data?.data?.result?.tokenId;
    deleteReceptionist({ agentId: deleteAgent?.agent_uuid || deleteAgent?.id, token: tokenId });
  };

  const handleUpdatePrompt = async (rowOriginal: any, newPrompt: string, onDone: () => void) => {
    setIsUpdatingPrompt(true);
    let token = '';
    try {
      const tokenRes = await fetchToken();
      token = tokenRes?.data?.data?.result?.tokenId || '';
    } catch (error) {
      console.error('Failed to fetch token:', error);
    }

    const safeRowOriginal = sanitizeAiAgentUpdateRecord(rowOriginal);
    const payload = {
      ...safeRowOriginal,
      agentId: rowOriginal.agent_uuid || rowOriginal.id,
      token,
      systemPrompt: newPrompt,
    };
    const {
      agent_uuid,
      uuid,
      did_uuid,
      company_uuid,
      created_at,
      useMessageExactly,
      ...updatedData
    } = payload;
    console.info(agent_uuid, uuid, did_uuid, company_uuid, created_at, useMessageExactly);

    updateReceptionist(updatedData, {
      onSuccess: () => {
        onDone();
        setIsUpdatingPrompt(false);
      },
      onError: () => {
        onDone();
        setIsUpdatingPrompt(false);
      },
    });
  };

  const handleInlineUpdate = useCallback(
    async (rowOriginal: any, businessHours: any, onStatus?: (success: boolean) => void) => {
      let token = '';
      try {
        const tokenRes = await fetchToken();
        token = tokenRes?.data?.data?.result?.tokenId || '';
      } catch (error) {
        console.error('Failed to fetch token:', error);
      }

      const payload = {
        ...rowOriginal,
        agentId: rowOriginal.agent_uuid || rowOriginal.id,
        token,
        forward_call_actions: {
          ...(rowOriginal.forward_call_actions || {}),
          call_handling: {
            ...(rowOriginal.forward_call_actions?.call_handling || {}),
            business_hours: {
              ...businessHours,
            },
          },
        },
      };
      const {
        agent_uuid,
        uuid,
        did_uuid,
        company_uuid,
        created_at,
        updated_at,
        useMessageExactly,
        ...updatedData
      } = payload;
      void agent_uuid;
      void uuid;
      void did_uuid;
      void company_uuid;
      void created_at;
      void updated_at;
      void useMessageExactly;

      updateReceptionist(updatedData, {
        onSuccess: () => onStatus?.(true),
        onError: () => onStatus?.(false),
      });
    },
    [fetchToken, updateReceptionist],
  );

  const handleStatusUpdate = useCallback(
    async (rowOriginal: any, newStatus: string) => {
      updateStatusMutation({
        agentType: 'voice',
        agentId: rowOriginal.agent_uuid || rowOriginal.id,
        status: newStatus === 'live' ? 'active' : 'inactive',
      });
    },
    [updateStatusMutation],
  );

  const openReceptionistForm = useCallback(
    (data: any, mode: BuilderMode, initialTab?: ReceptionistEditTab) => {
      setEditData(data);
      setBuilderMode(mode);
      setInitialEditTab(initialTab);
      setView('form');
    },
    [],
  );

  useEffect(() => {
    return () => {
      unloadAi360CallWidget();
    };
  }, []);

  const handleTestTalkClick = useCallback(
    (agent: any) => {
      unloadAi360CallWidget();
      navigate('/admin-settings/knowledge/playground', {
        state: {
          activeTab: 'voice',
          selectedAgent: agent,
          openAgentId: getReceptionistId(agent),
        },
      });
    },
    [navigate],
  );

  const columns = useMemo(
    () => [
      {
        header: 'AI Receptionist Name',
        accessorKey: 'agentName',
        cell: ({ row }: any) => {
          const data = row.original || {};
          const name = data?.agentName || 'Untitled';
          const companyName =
            data?.companyName ||
            data?.company_name ||
            data?.company ||
            data?.businessName ||
            data?.business_name ||
            'No brand set';
          const rawStatus = String(data.status || data.agentStatus || 'inactive').toLowerCase();
          const isLive = rawStatus === 'active' || rawStatus === 'live';
          return (
            <button
              type="button"
              title={name}
              onClick={(event) => {
                event.stopPropagation();
                openReceptionistForm(data, 'view', 'overview');
              }}
              className="group flex w-full min-w-0 max-w-full items-center gap-2.5 rounded-lg border border-transparent px-2 py-0 text-left transition-colors hover:border-slate-300 hover:bg-slate-50"
            >
              <div className="relative shrink-0">
                <div className="rounded-full ring-2 ring-white ring-offset-1 ring-offset-transparent group-hover:ring-slate-100">
                  <CustomAvatar
                    name={name}
                    image={getReceptionistAvatarImage(data)}
                    size="28"
                    showPresence={false}
                    isActivityInfo={false}
                    textClass="text-[10px]"
                  />
                </div>
                <span
                  className={cx(
                    'absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-white',
                    isLive ? 'bg-green-500' : 'bg-slate-400',
                  )}
                />
              </div>
              <div className="min-w-0">
                <span className="block max-w-[190px] truncate text-[13px] font-normal text-slate-950 transition-colors group-hover:text-slate-950">
                  {name}
                </span>
                <div className="mt-0.5 min-w-0 text-[11px] leading-4 text-slate-500">
                  <span className="truncate">{companyName}</span>
                </div>
              </div>
            </button>
          );
        },
        meta: { textAlign: 'left' },
      },
      {
        header: 'Status',
        accessorKey: 'status',
        cell: ({ row }: any) => {
          const data = row.original || {};
          const rawStatus = String(data.status || data.agentStatus || 'inactive').toLowerCase();
          const isLive = rawStatus === 'active' || rawStatus === 'live';

          const handleStatusChange = (newStatus: string) => {
            const currentStatus = isLive ? 'live' : 'inactive';
            if (newStatus === currentStatus) return;
            // DUMMY DATA - preview rows have no server record, so flip them locally.
            if (data?.[DUMMY_FLAG]) {
              setDummyStatusOverrides((prev) => ({
                ...prev,
                [String(data.agentId || data.agent_uuid)]:
                  newStatus === 'live' ? 'active' : 'inactive',
              }));
              return;
            }
            handleStatusUpdate(data, newStatus);
          };

          return (
            <div className="flex justify-start">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className={cx(
                    'inline-flex h-6 min-w-[76px] shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-full border! px-2.5 text-[11px] font-extrabold cursor-pointer outline-none transition-colors duration-200',
                    isLive
                      ? 'border-green-200! bg-green-100! text-green-800! hover:bg-green-100/80!'
                      : 'border-slate-200! bg-slate-100! text-slate-600! hover:bg-slate-100/80!',
                  )}
                >
                  <span
                    className={cx(
                      'h-2 w-2 shrink-0 rounded-full',
                      isLive ? 'bg-green-500' : 'bg-slate-400',
                    )}
                  />
                  <span className="leading-none">{isLive ? 'Live' : 'Paused'}</span>
                  <ChevronDown className="h-3 w-3 shrink-0 opacity-60" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="start"
                className="[&_[data-slot=dropdown-menu-item]]:focus:text-neutral-900! w-[140px] bg-white border border-slate-200 shadow-lg rounded-xl p-1 z-50 animate-none"
              >
                <DropdownMenuItem
                  onClick={() => handleStatusChange('live')}
                  className="flex items-center gap-2 px-2 py-1.5 text-xs font-medium cursor-pointer rounded-lg hover:bg-slate-50 text-slate-900"
                >
                  <span className="h-2 w-2 rounded-full bg-green-500" />
                  <span>Live</span>
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => handleStatusChange('inactive')}
                  className="flex items-center gap-2 px-2 py-1.5 text-xs font-medium cursor-pointer rounded-lg hover:bg-slate-50 text-slate-900"
                >
                  <span className="h-2 w-2 rounded-full bg-slate-400" />
                  <span>Paused</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            </div>
          );
        },
        meta: { textAlign: 'left' },
      },
      {
        header: 'Caller Id',
        accessorKey: 'caller_id',
        cell: ({ row }: any) => {
          const data = row?.original || {};
          const assignedDID = data?.did_uuid?.[0]?.did_number || '';
          return assignedDID ? (
            <button type="button" onClick={() => setAssignCallerAgent(data)}>
              <NumberWithFlag number={assignedDID} />
            </button>
          ) : (
            <button
              type="button"
              className="text-[13px] font-semibold text-blue-600! hover:text-blue-700!"
              onClick={() => setAssignCallerAgent(data)}
            >
              + Assign Caller Id
            </button>
          );
        },
        meta: { textAlign: 'center' },
      },
      {
        header: 'Sentiment',
        accessorKey: 'sentiment',
        cell: ({ row }: any) => {
          const data = row.original || {};
          const calls = Number(data.sentiment_calls || 0);
          const score = Number(data.avg_sentiment || 0);
          const label =
            normalizeSentiment(data.sentiment_label) || sentimentLabelFromScore(score) || 'neutral';
          if (!calls) {
            return (
              <span className="inline-flex w-fit items-center justify-center rounded-full bg-gray-100! px-2.5 py-1 text-[12px] font-semibold text-gray-500!">
                Not analyzed
              </span>
            );
          }
          const pillClass =
            label === 'positive'
              ? 'bg-green-50! text-green-700!'
              : label === 'negative'
                ? 'bg-red-50! text-red-600!'
                : 'bg-amber-50! text-amber-700!';
          const sentimentScores = sentimentScoreRows.map((item) => ({
            ...item,
            score: Math.round(sentimentScoreValue(data.sentiment_scores, item.key)),
          }));
          const hasScores = sentimentScores.some((item) => item.score > 0);
          const pill = (
            <span
              className={`inline-flex w-fit items-center justify-center gap-1 rounded-full px-2.5 py-1 text-[12px] font-semibold capitalize ${pillClass}`}
              title={!hasScores ? sentimentCountsText(data.sentiment_counts) : undefined}
            >
              {label} · {Math.round(score)}
            </span>
          );

          if (!hasScores) {
            return <div className="flex justify-center">{pill}</div>;
          }

          return (
            <div className="flex justify-center">
              <HoverPortalCard trigger={pill}>
                <SentimentAnalysisCard scores={sentimentScores} />
              </HoverPortalCard>
            </div>
          );
        },
        meta: { textAlign: 'center' },
      },
      // {
      //   header: 'Forward After AI',
      //   accessorKey: 'forwardType',
      //   cell: ({ row }: any) => (
      //     <ForwardTypeCell
      //       data={row.original}
      //       onUpdate={handleInlineUpdate}
      //       optionsData={forwardingOptionsData}
      //       userExtension={user?.user_info?.extension || ''}
      //     />
      //   ),
      // },
      {
        header: 'Last Updated',
        accessorKey: 'updatedAt',
        cell: ({ row }: any) => {
          const date = row?.original?.updatedAt || row?.original?.updated_at;
          const shortLabel = formatShortRelativeTime(date);
          return shortLabel ? (
            <span
              className="text-[12.5px] text-slate-700"
              title={moment.utc(date).local().format('MMM D, YYYY h:mm A')}
            >
              {shortLabel}
            </span>
          ) : (
            <span className="text-[12.5px] text-slate-400">—</span>
          );
        },
        meta: { textAlign: 'center' },
      },
      {
        header: 'Actions',
        accessorKey: 'action',
        cell: ({ row }: any) => {
          const data = row?.original;
          const isDeleted = data?.deletedAt || data?.deleted_at;
          if (isDeleted) {
            return (
              <span className="inline-flex select-none items-center rounded-full px-2 py-1 text-[12px] font-normal text-red-500">
                Marked Deleted
              </span>
            );
          }

          const menuActions = [
            {
              key: 'edit-prompt',
              label: 'Edit Prompt',
              onClick: () => setPromptAgent(data),
              icon: <MessageSquare className="h-3.5 w-3.5" />,
              className: 'text-slate-700!',
            },
            {
              key: 'edit',
              label: 'Edit',
              onClick: () => openReceptionistForm(data, 'edit'),
              icon: <PenLine className="h-3.5 w-3.5" />,
              className: 'text-slate-700!',
            },
            {
              key: 'delete',
              label: 'Delete',
              onClick: () => setDeleteAgent(data),
              icon: <Trash2 className="h-3.5 w-3.5" />,
              className: 'text-red-600!',
            },
          ];

          return (
            <div className="flex w-full items-center justify-center gap-2">
              <CustomTooltip text="Test call" side="top">
                <button
                  type="button"
                  onClick={() => handleTestTalkClick(data)}
                  className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full bg-blue-50! text-blue-600! transition-colors hover:bg-blue-600! hover:text-white!"
                >
                  <Play className="h-3.5 w-3.5" />
                </button>
              </CustomTooltip>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    aria-label="More actions"
                    className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full bg-neutral-100! text-neutral-500! transition-colors hover:bg-neutral-200! hover:text-neutral-900!"
                  >
                    <MoreVertical className="h-3.5 w-3.5" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="end"
                  className="[&_[data-slot=dropdown-menu-item]]:focus:text-neutral-900! flex w-[190px] flex-col gap-1 rounded-2xl! border! border-neutral-200! bg-white p-1.5 shadow-lg z-50 animate-none"
                >
                  {menuActions.map((action) => (
                    <DropdownMenuItem
                      key={action.key}
                      onClick={action.onClick}
                      className={cx(
                        'flex cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] font-medium hover:bg-[#f3f4f6]! focus:bg-[#f3f4f6]!',
                        action.className,
                      )}
                    >
                      {action.icon}
                      <span>{action.label}</span>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          );
        },
        meta: {
          textAlign: 'center',
        },
      },
    ],
    [
      forwardingOptionsData,
      handleInlineUpdate,
      handleStatusUpdate,
      handleTestTalkClick,
      openReceptionistForm,
      user?.user_info?.extension,
    ],
  );

  if (view === 'analytics') {
    return (
      <ReceptionistAnalytics
        onClose={() => setView('list')}
        receptionists={receptionistsWithMetrics}
      />
    );
  }

  if (view === 'form') {
    return (
      <NewAiReceptionistBuilder
        initialData={editData}
        mode={builderMode}
        initialEditTab={initialEditTab}
        onCancel={() => {
          setEditData(null);
          setBuilderMode('create');
          setInitialEditTab(undefined);
          setView('list');
        }}
        onDone={() => {
          setEditData(null);
          setBuilderMode('create');
          setInitialEditTab(undefined);
          setView('list');
          invalidateReceptionistQueries();
        }}
      />
    );
  }

  return (
    <section className="flex h-full min-h-0 w-full flex-col overflow-hidden bg-[#efefef] text-neutral-900">
      <div className="flex min-h-[74px] items-center justify-between border-b border-neutral-200 bg-white px-7 py-2">
        <div className="flex items-center gap-3">
          <div>
            <button
              type="button"
              onClick={() => navigate('/admin-settings/knowledge/ai-agent')}
              className="block transition-colors hover:text-neutral-700"
              style={{
                fontFamily: '"IBM Plex Mono", ui-monospace, "SF Mono", Menlo, monospace',
                fontStyle: 'normal',
                fontWeight: 800,
                fontSize: '12px',
                lineHeight: '18px',
                letterSpacing: '0.04em',
                color: 'rgb(220, 38, 38)',
                textTransform: 'uppercase',
              }}
            >
              AI Tools
            </button>
            <div
              style={{
                fontFamily: '"Instrument Serif", Georgia, serif',
                fontStyle: 'italic',
                fontWeight: 400,
                fontSize: '27px',
                lineHeight: '34px',
                color: 'rgb(23, 23, 23)',
              }}
            >
              AI Receptionists
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setView('analytics');
            }}
            className="inline-flex h-10 items-center gap-1.5 rounded-full border! border-neutral-200! bg-white! px-5 text-sm font-semibold text-neutral-700! shadow-[0_1px_2px_rgba(0,0,0,.03)] transition-colors hover:border-red-200! hover:bg-red-50! hover:text-red-600!"
          >
            <TrendingUp className="h-4 w-4 shrink-0" />
            <span>Analytics</span>
          </button>
          <button
            type="button"
            onClick={() => {
              openReceptionistForm(null, 'create');
            }}
            className="inline-flex h-10 items-center gap-1.5 rounded-full bg-neutral-900! px-5 text-sm font-semibold text-white! shadow-none transition-colors hover:bg-neutral-800!"
          >
            <Plus className="h-4 w-4 shrink-0" />
            <span>Create New Receptionist</span>
          </button>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-auto bg-[#efefef] px-7 pt-4 pb-6">
        <div>
          <div className="mb-3 flex items-center gap-2.5">
            <h2 className="text-[12.5px] font-semibold uppercase tracking-[0.05em] text-red-600">
              Overview
            </h2>
            <span className="h-px flex-1 bg-neutral-200" />
          </div>
          <div className="relative grid grid-cols-1 rounded-[14px] border border-slate-200 bg-white shadow-[0_1px_2px_rgba(0,0,0,.04)] sm:grid-cols-2 lg:grid-cols-5">
            {(isReceptionistStatsFetching || isReceptionistMetricsFetching) && (
              <div className="absolute inset-0 z-10 flex items-center justify-center rounded-[inherit] bg-white/70 backdrop-blur-[1px]">
                <Loader2 className="h-5 w-5 animate-spin text-neutral-600" />
              </div>
            )}
            {listStats.map((stat, index) => (
              <div
                key={stat.label}
                className={cx(
                  'flex flex-col gap-1.5 p-4',
                  index !== listStats.length - 1 && 'border-b border-slate-100 sm:border-b-0 sm:border-r',
                )}
              >
                <span className="text-[11.5px] font-bold uppercase tracking-[0.06em] whitespace-nowrap text-neutral-700">
                  {stat.label}
                </span>
                <span className="flex items-baseline gap-1.5">
                  <span
                    className={cx(
                      'text-[26px] font-bold leading-tight tracking-tight whitespace-nowrap',
                      stat.valueTone === 'critical'
                        ? 'text-red-600'
                        : stat.valueTone === 'warn'
                          ? 'text-amber-600'
                          : 'text-neutral-900',
                    )}
                  >
                    {stat.value}
                  </span>
                  {stat.helper && (
                    <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-full bg-green-50 px-2 py-0.5 text-[10.5px] font-semibold text-green-700">
                      <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
                      {stat.helper}
                    </span>
                  )}
                </span>
                <span className="text-xs text-neutral-400 whitespace-nowrap">{stat.description}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-3 pb-4">
          <div className="flex items-center gap-2.5">
            <h2 className="text-[12.5px] font-semibold uppercase tracking-[0.05em] text-red-600">
              Receptionists
            </h2>
            <span className="h-px flex-1 bg-neutral-200" />
          </div>

          <div id="ai-receptionist-table" className="overflow-hidden rounded-[14px] border border-neutral-200 bg-white shadow-[0_1px_2px_rgba(0,0,0,.04)]">
            <TableManager
              fetcherKey={['getAIReceptionistList', 'new-ai-receptionist-table', statusFilter]}
              fetcherFn={getAIReceptionistList}
              columns={columns}
              search={search}
              extraParams={{ filters: tableFilters }}
              clientSideSearch={false}
              select={tableSelect}
              isHeightSet={false}
              tableRef={receptionistTableRef}
              hideFooterRefresh
              recordsPosition="right"
              centerPager
              pagerAccentClassName="border-red-600! text-white! bg-red-600!"
              customHeader={
                <div className="flex flex-col gap-3 py-1 sm:flex-row sm:items-center">
                  <div className="flex h-10 min-w-0 flex-1 items-center gap-2 rounded-full border! border-neutral-200! bg-white! pl-2 pr-3 shadow-[0_1px_2px_rgba(0,0,0,.03)] transition-all focus-within:border-neutral-400! sm:max-w-[320px]">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-red-600">
                      <Search className="h-[18px] w-[18px]" strokeWidth={2.25} />
                    </span>
                    <input
                      value={search}
                      onChange={(event) => setSearch(sanitizeAiSearchText(event.target.value, 50))}
                      placeholder="Search receptionists by name..."
                      maxLength={50}
                      className="min-w-0 flex-1 border-none bg-transparent text-sm text-neutral-900 outline-none! placeholder:text-neutral-400"
                    />
                  </div>
                  <button
                    type="button"
                    title="Refresh"
                    onClick={async () => {
                      setIsTableRefreshing(true);
                      try {
                        await receptionistTableRef.current?.refetchTable();
                      } finally {
                        setIsTableRefreshing(false);
                      }
                    }}
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-none! bg-transparent! text-neutral-500! shadow-none! transition-colors hover:text-neutral-900!"
                  >
                    <RefreshCcw className={`h-4 w-4 ${isTableRefreshing ? 'animate-spin' : ''}`} />
                  </button>
                  <div className="relative flex shrink-0 items-center gap-0.5 rounded-full border! border-neutral-200! bg-neutral-100! p-1 sm:ml-auto">
                    <span
                      aria-hidden="true"
                      className="absolute top-1 bottom-1 rounded-full bg-white! shadow-[0_1px_4px_rgba(17,17,17,.18)] border! border-neutral-200! transition-all duration-200 ease-out"
                      style={{
                        left: statusFilter === 'all' ? '4px' : '86px',
                        width: statusFilter === 'all' ? '80px' : '96px',
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => setStatusFilter('all')}
                      className={`relative z-10 flex h-8 w-[80px] shrink-0 items-center justify-center gap-1.5 rounded-full px-5 text-xs font-semibold transition-colors ${
                        statusFilter === 'all'
                          ? 'text-neutral-950!'
                          : 'text-neutral-500! hover:text-red-600!'
                      }`}
                    >
                      All
                      <span
                        className={statusFilter === 'all' ? 'text-neutral-500!' : 'text-neutral-400!'}
                      >
                        {totalReceptionistsCount}
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setStatusFilter('live')}
                      className={`relative z-10 flex h-8 w-[96px] shrink-0 items-center justify-center gap-1.5 rounded-full px-5 text-xs font-semibold transition-colors ${
                        statusFilter === 'live'
                          ? 'text-neutral-950!'
                          : 'text-neutral-500! hover:text-red-600!'
                      }`}
                    >
                      <span className="relative flex h-1.5 w-1.5 shrink-0">
                        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-neutral-900 opacity-75" />
                        <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-neutral-900" />
                      </span>
                      Live
                      <span
                        className={statusFilter === 'live' ? 'text-neutral-500!' : 'text-neutral-400!'}
                      >
                        {liveReceptionistsCount}
                      </span>
                    </button>
                  </div>
                </div>
              }
              customClass="!rounded-none !border-0 !shadow-none [&_table]:table-fixed [&_table]:border-separate [&_table]:border-spacing-0 [&_thead]:bg-neutral-50! [&_th]:bg-transparent! [&_th]:px-[18px]! [&_th]:py-[13px]! [&_th]:text-[12px]! [&_th]:font-bold! [&_th]:uppercase! [&_th]:tracking-[0.04em]! [&_th]:text-neutral-500! [&_td]:bg-transparent! [&_td]:h-auto! [&_td]:min-h-0! [&_td]:px-[18px]! [&_td]:py-2! [&_td]:align-middle [&_th:first-child]:w-[260px] [&_td:first-child]:w-[260px] [&_th:nth-child(2)]:w-[160px] [&_td:nth-child(2)]:w-[160px] [&_th:nth-child(2)]:text-left! [&_td:nth-child(2)]:text-left! [&_th:nth-child(3)]:w-[160px] [&_td:nth-child(3)]:w-[160px] [&_th:nth-child(3)]:text-center! [&_td:nth-child(3)]:text-center! [&_th:nth-child(4)]:w-[160px] [&_td:nth-child(4)]:w-[160px] [&_th:nth-child(4)]:text-center! [&_td:nth-child(4)]:text-center! [&_th:nth-child(5)]:w-[160px] [&_td:nth-child(5)]:w-[160px] [&_th:nth-child(5)]:text-center! [&_td:nth-child(5)]:text-center! [&_th:last-child]:w-[160px] [&_td:last-child]:w-[160px] [&_th:last-child]:text-center!"
              loaderTableClass="min-h-[320px]"
              getRowClassName={() => 'bg-white! transition-colors hover:bg-neutral-50!'}
              emptyTablePlaceholder="No receptionists found"
              descriptionEmptyTable={
                search.trim()
                  ? `No receptionists match "${search.trim()}". Try a different name.`
                  : 'Create your first AI receptionist to get started.'
              }
              emptyIcon={<Search className="h-6 w-6" />}
            />
          </div>
        </div>
      </div>

      <Dialog open={Boolean(deleteAgent)} onOpenChange={(open) => !open && setDeleteAgent(null)}>
        <DialogContent showCloseButton={false} className="w-[340px] max-w-[92vw] rounded-2xl p-6">
          <DialogTitle className="sr-only">Delete AI Receptionist</DialogTitle>
          <div className="flex flex-col items-center text-center">
            <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-red-50 text-red-600">
              <Trash2 className="h-6 w-6" strokeWidth={2.25} />
            </span>
            <h3 className="mt-4 text-lg font-bold text-slate-900">Delete AI Receptionist?</h3>
            <p className="mt-2 whitespace-nowrap text-sm leading-6 text-slate-500">
              This action cannot be undone.
            </p>
          </div>
          <div className="mt-6 flex items-center justify-center gap-4">
            <button
              type="button"
              onClick={() => setDeleteAgent(null)}
              className="h-10 rounded-full border! border-neutral-300! bg-white px-5 text-sm font-semibold text-neutral-700 outline-none! transition-colors hover:border-red-300!"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={isDeleting || isPendingToken}
              onClick={handleDelete}
              className="h-10 rounded-full bg-red-600! px-5 text-sm font-semibold text-white! shadow-[0_2px_10px_rgba(220,38,38,.3)] transition-colors hover:bg-red-700! disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isDeleting || isPendingToken ? 'Deleting...' : 'Delete'}
            </button>
          </div>
        </DialogContent>
      </Dialog>

      <PromptModal
        open={Boolean(promptAgent)}
        setOpen={(open: boolean) => {
          if (!open) setPromptAgent(null);
        }}
        data={promptAgent}
        onUpdate={handleUpdatePrompt}
        isUpdating={isUpdatingPrompt || isPendingToken}
      />
      <AssignReceptionistCallerIdModal
        open={Boolean(assignCallerAgent)}
        receptionistData={assignCallerAgent}
        onClose={() => setAssignCallerAgent(null)}
      />
    </section>
  );
}

function NewAiReceptionistBuilder({
  initialData,
  mode = 'create',
  initialEditTab,
  onCancel,
  onDone,
}: {
  initialData?: any;
  mode?: BuilderMode;
  initialEditTab?: ReceptionistEditTab;
  onCancel: () => void;
  onDone: () => void;
}) {
  const receptionistRecordId =
    initialData?.agent_uuid || initialData?.id || initialData?.uuid || initialData?._id || '';
  const isEdit = Boolean(receptionistRecordId);
  const isReadOnly = mode === 'view';
  const useWizardEdit = mode === 'edit';
  const widgetKeyRef = useRef(
    getAi360WidgetKey(initialData) || (!isEdit ? createAiWidgetKey() : ''),
  );
  const allowWizardExitRef = useRef(false);
  const { user } = useUser();
  const queryClient = useQueryClient();
  const initialForwardActions =
    initialData?.forward_call_actions || initialData?.forwardCallActions || {};
  const builderState = initialForwardActions?.receptionist_builder || {};
  const draftInitialEditTab: ReceptionistEditTab = 'overview';
  const resolvedInitialEditTab = initialEditTab ?? draftInitialEditTab;
  const storedKnowledgeFaqs = useMemo(
    () => normalizeKnowledgeFaqs(builderState?.knowledge?.generated?.faqs),
    [builderState?.knowledge?.generated?.faqs],
  );
  const storedGeneratedSummaryText = String(
    builderState?.knowledge?.generated?.summaryText || '',
  ).trim();
  const storedKnowledgeDocuments = useMemo(() => {
    const documents = normalizeStoredKnowledgeDocuments(
      builderState?.knowledge?.generated?.documents,
    );
    if (documents.length) return documents;

    return normalizeStoredKnowledgeDocuments(
      storedGeneratedSummaryText
        ? [
            {
              id: 'generated-summary',
              title: 'Knowledge base summary',
              copy: storedGeneratedSummaryText,
              source: 'Generated knowledge',
              status: 'Just generated',
              type: 'text',
            },
          ]
        : [],
    );
  }, [builderState?.knowledge?.generated?.documents, storedGeneratedSummaryText]);
  const storedGeneratedKnowledgeBaseId = String(
    builderState?.knowledge?.generated?.generatedKnowledgeBaseId || '',
  ).trim();
  const storedGeneratedSummarySourceKey = String(
    builderState?.knowledge?.generated?.summarySourceKey || '',
  ).trim();
  const storedGeneratedFaqSourceKey = String(
    builderState?.knowledge?.generated?.faqSourceKey || '',
  ).trim();
  const storedGeneratedKnowledgeText = useMemo(
    () =>
      String(
        builderState?.knowledge?.generated?.generatedKnowledgeText ||
          formatGeneratedKnowledgeText(storedKnowledgeFaqs, storedKnowledgeDocuments),
      ).trim(),
    [
      builderState?.knowledge?.generated?.generatedKnowledgeText,
      storedKnowledgeDocuments,
      storedKnowledgeFaqs,
    ],
  );
  const [activeStep, setActiveStep] = useState<ReceptionistStep>(
    isWizardReceptionistTab(resolvedInitialEditTab) ? tabToStep[resolvedInitialEditTab] : 1,
  );
  const [editTab, setEditTab] = useState<ReceptionistEditTab>(resolvedInitialEditTab);
  const [editHeaderCallerAgent, setEditHeaderCallerAgent] = useState<any>(null);
  const [sourceStage, setSourceStage] = useState<SourceStage>(
    resolvedInitialEditTab === 'knowledge'
      ? 1
      : normalizeSourceStage(builderState?.knowledge?.sourceStage, 1),
  );
  const [knowledgeWebsiteMode, setKnowledgeWebsiteMode] = useState<'picker' | 'scan'>(() => {
    const savedWebsiteUrl =
      builderState?.knowledge?.websiteUrl ||
      initialData?.websiteUrl ||
      initialData?.website_url ||
      '';
    const hasSavedPages =
      (Array.isArray(builderState?.knowledge?.selectedPages) &&
        builderState.knowledge.selectedPages.length > 0) ||
      (Array.isArray(initialData?.selectedLinks) && initialData.selectedLinks.length > 0);
    return savedWebsiteUrl || hasSavedPages ? 'scan' : 'picker';
  });
  const [receptionistName, setReceptionistName] = useState(
    sanitizeReceptionistName(
      String(
        initialData?.agentName || initialData?.name || builderState?.basics?.receptionistName || '',
      ),
    ),
  );
  const [companyBrand, setCompanyBrand] = useState(
    sanitizeAiPlainText(
      initialData?.company ||
        initialData?.companyBrand ||
        initialData?.company_name ||
        builderState?.basics?.companyBrand ||
        '',
    ),
  );
  const [roleUseCase, setRoleUseCase] = useState(
    sanitizeAiPlainText(
      initialData?.role ||
        initialData?.roleUseCase ||
        builderState?.basics?.roleUseCase ||
        initialData?.initialTemplateName ||
        '',
    ),
  );
  const [shortDescription, setShortDescription] = useState(
    sanitizeAiPlainText(
      initialData?.description ||
        initialData?.shortDescription ||
        initialData?.short_description ||
        builderState?.basics?.shortDescription ||
        '',
    ),
  );
  const [systemPrompt, setSystemPrompt] = useState(
    sanitizeAiPromptText(
      initialData?.systemPrompt ||
        initialData?.system_prompt ||
        builderState?.basics?.systemPrompt ||
        DEFAULT_SYSTEM_PROMPT,
    ),
  );
  const [greetingText, setGreetingText] = useState(
    sanitizeAiPlainText(
      initialData?.firstMessage ||
        initialData?.first_message ||
        builderState?.greeting?.greetingText ||
        DEFAULT_GREETING,
    ),
  );
  const [selectedGreetingType, setSelectedGreetingType] = useState(() => {
    const val = sanitizeAiPlainText(
      initialData?.firstMessage ||
        initialData?.first_message ||
        builderState?.greeting?.greetingText ||
        DEFAULT_GREETING,
    );
    const brand = companyBrand || 'Example Business';
    const name = receptionistName || 'Maya';
    if (val === getGreetingText('friendly', brand, name)) return 'friendly';
    if (val === getGreetingText('professional', brand, name)) return 'professional';
    if (val === getGreetingText('triage', brand, name)) return 'triage';
    if (val === getGreetingText('holiday', brand, name)) return 'holiday';
    return 'custom';
  });
  const initialVoicePersona = normalizeStoredVoiceValue(
    getStoredReceptionistVoice(initialData, builderState),
  );
  const [selectedLanguage] = useState(
    initialData?.language || builderState?.voice?.language || languageOptions[0].value,
  );
  const [selectedPersona, setSelectedPersona] = useState(initialVoicePersona);
  const [selectedPersonaObj, setSelectedPersonaObj] = useState<any>({});
  console.log(selectedPersona, 'selectedPersona');

  const initialTextKnowledgeValue =
    builderState?.knowledge?.selectedKnowledgeBase?.text || initialData?.text_uuid;
  const initialUrlKnowledgeValue =
    builderState?.knowledge?.selectedKnowledgeBase?.url || initialData?.url_uuid;
  const initialPdfKnowledgeValue =
    builderState?.knowledge?.selectedKnowledgeBase?.pdf || initialData?.pdf_uuid;
  const initialTextKnowledgeIds = normalizeKnowledgeBaseSelection(initialTextKnowledgeValue).filter(
    (id) => id !== storedGeneratedKnowledgeBaseId,
  );
  const initialUrlKnowledgeIds = normalizeKnowledgeBaseSelection(initialUrlKnowledgeValue);
  const initialPdfKnowledgeIds = normalizeKnowledgeBaseSelection(initialPdfKnowledgeValue);
  const existingKnowledgeBaseFallbackItems = useMemo(
    () =>
      getKnowledgeBaseFallbackLookup(
        initialTextKnowledgeValue,
        initialUrlKnowledgeValue,
        initialPdfKnowledgeValue,
      ),
    [initialPdfKnowledgeValue, initialTextKnowledgeValue, initialUrlKnowledgeValue],
  );
  const savedSelectedPages = [
    ...(Array.isArray(builderState?.knowledge?.selectedPages)
      ? builderState.knowledge.selectedPages.map((item: any) => item?.url || item?.path)
      : []),
    ...(Array.isArray(initialData?.selectedLinks) ? initialData.selectedLinks : []),
  ].filter(Boolean);
  const initialEditableSelectedPages = initialUrlKnowledgeIds.length ? [] : savedSelectedPages;
  const [websiteUrl, setWebsiteUrl] = useState(
    builderState?.knowledge?.websiteUrl ||
      initialData?.websiteUrl ||
      initialData?.website_url ||
      '',
  );
  const [extraUrl, setExtraUrl] = useState(builderState?.knowledge?.extraUrl || '');
  const [discoveredLinks, setDiscoveredLinks] = useState<string[]>(initialEditableSelectedPages);
  const [selectedLinks, setSelectedLinks] = useState<string[]>(initialEditableSelectedPages);
  const [expandedPickPageCategoryId, setExpandedPickPageCategoryId] = useState<string | null>(null);
  const [pendingUrls, setPendingUrls] = useState<string[]>(() =>
    initialUrlKnowledgeIds.length
      ? []
      : uniqueStrings(
          (Array.isArray(builderState?.knowledge?.pendingUrls)
            ? builderState.knowledge.pendingUrls
            : []
          ).map((url: unknown) => normalizeUrl(String(url))),
        ),
  );
  const [pendingTextItems, setPendingTextItems] = useState<PendingTextKnowledge[]>([]);
  const [pendingFiles, setPendingFiles] = useState<PendingFileKnowledge[]>([]);
  const [selectedTextKnowledgeIds, setSelectedTextKnowledgeIds] =
    useState<string[]>(initialTextKnowledgeIds);
  const [selectedUrlKnowledgeIds, setSelectedUrlKnowledgeIds] =
    useState<string[]>(initialUrlKnowledgeIds);
  const [selectedPdfKnowledgeIds, setSelectedPdfKnowledgeIds] =
    useState<string[]>(initialPdfKnowledgeIds);
  const [selectedReusableAgentId, setSelectedReusableAgentId] = useState('');
  const [knowledgeBaseSearch, setKnowledgeBaseSearch] = useState('');
  const [websiteScanProgressStatus, setWebsiteScanProgressStatus] =
    useState<WebsiteScanProgressStatus>('idle');
  const websiteScanProgressCloseTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const knowledgeSummaryRequestKeyRef = useRef('');
  const knowledgeReviewJobIdRef = useRef('');
  const knowledgeReviewSessionIdRef = useRef(createLocalId('knowledge-review'));
  const knowledgeReviewJobIdsRef = useRef<Set<string>>(new Set());
  const knowledgeReviewPollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [isAddKnowledgeOpen, setIsAddKnowledgeOpen] = useState(false);
  const [customContentTitle, setCustomContentTitle] = useState('Custom Content');
  const [customContent, setCustomContent] = useState(
    initialData?.customContent || builderState?.knowledge?.customContent || '',
  );
  const customContentWordCount = customContent.trim()
    ? customContent.trim().split(/\s+/).length
    : 0;
  const pendingFileInputRef = useRef<HTMLInputElement | null>(null);
  const reviewKnowledgeFileInputRef = useRef<HTMLInputElement | null>(null);
  const [isCreatingKnowledgeSources, setIsCreatingKnowledgeSources] = useState(false);
  const [isSummarizingKnowledgeBase, setIsSummarizingKnowledgeBase] = useState(false);
  const [isGeneratingKnowledgeFaqs, setIsGeneratingKnowledgeFaqs] = useState(false);
  const [knowledgeDocumentSummaries, setKnowledgeDocumentSummaries] =
    useState<KnowledgeDocument[]>(storedKnowledgeDocuments);
  const [knowledgeBaseSummaryError, setKnowledgeBaseSummaryError] = useState('');
  const [knowledgeFaqs, setKnowledgeFaqs] = useState<KnowledgeFaq[]>(storedKnowledgeFaqs);
  const [knowledgeFaqError, setKnowledgeFaqError] = useState('');
  const [reviewKnowledgeTab, setReviewKnowledgeTab] = useState<'documents' | 'faqs'>('documents');
  const [reviewKnowledgeSearch, setReviewKnowledgeSearch] = useState('');
  const [openReviewKnowledgeMenu, setOpenReviewKnowledgeMenu] = useState('');
  const [reviewKnowledgeEditModal, setReviewKnowledgeEditModal] =
    useState<ReviewKnowledgeEditModalState | null>(null);
  const [reviewKnowledgeAddModal, setReviewKnowledgeAddModal] =
    useState<ReviewKnowledgeAddModalState | null>(null);
  const [reviewKnowledgeSourceModal, setReviewKnowledgeSourceModal] =
    useState<ReviewKnowledgeSourceModalState | null>(null);
  const [showLeaveWizardModal, setShowLeaveWizardModal] = useState(false);
  const shouldConfirmWizardLeave = !isEdit && !isReadOnly;
  const wizardLeaveBlocker = useBlocker(({ currentLocation, nextLocation }) => {
    if (!shouldConfirmWizardLeave || allowWizardExitRef.current) return false;
    return nextLocation.pathname !== currentLocation.pathname;
  });

  useEffect(() => {
    if (wizardLeaveBlocker.state === 'blocked') {
      setShowLeaveWizardModal(true);
    }
  }, [wizardLeaveBlocker.state]);

  const requestWizardLeave = () => {
    if (!shouldConfirmWizardLeave) {
      onCancel();
      return;
    }
    setShowLeaveWizardModal(true);
  };

  const cancelWizardLeave = () => {
    setShowLeaveWizardModal(false);
    if (wizardLeaveBlocker.state === 'blocked') {
      wizardLeaveBlocker.reset();
    }
  };

  const cleanupKnowledgeReviewWorkspace = async () => {
    const jobIds = Array.from(knowledgeReviewJobIdsRef.current);
    if (!jobIds.length) return;

    knowledgeReviewJobIdsRef.current.clear();
    try {
      await cleanupKnowledgeBaseReviewJobs(jobIds);
    } catch (error) {
      console.error('Cannot cleanup knowledge review jobs:', error);
    }
  };

  const confirmWizardLeave = async () => {
    await cleanupKnowledgeReviewWorkspace();
    allowWizardExitRef.current = true;
    setShowLeaveWizardModal(false);

    if (wizardLeaveBlocker.state === 'blocked') {
      wizardLeaveBlocker.proceed();
      return;
    }

    onCancel();
  };
  const isKnowledgeSummaryNavigationLocked =
    isSummarizingKnowledgeBase || isGeneratingKnowledgeFaqs;
  const [selectedLocationId, setSelectedLocationId] = useState(initialData?.site_uuid || '');
  const [modalState, setModalState] = useState({
    bussinessHoursModal: false,
  });
  const [bussinessHourError, setBussinessHourError] = useState<string | null>('');
  const enableTranscripts = true;
  const enableCallMonitoring = true;
  const [isDataCollectionEnabled, setIsDataCollectionEnabled] = useState(() => {
    const savedEnabled = initialForwardActions?.data_agent?.data_collection;
    if (typeof savedEnabled === 'boolean') return savedEnabled;

    const details = initialForwardActions?.data_agent?.details_to_collect;
    if (details && typeof details === 'object' && !Array.isArray(details)) {
      return Object.keys(details).length > 0;
    }
    return Array.isArray(details) ? details.length > 0 : true;
  });
  const [showDataCollectionHelp, setShowDataCollectionHelp] = useState(false);
  const [detailsToCollect, setDetailsToCollect] = useState<DetailField[]>(() => {
    const details = initialForwardActions?.data_agent?.details_to_collect;
    if (details && typeof details === 'object' && !Array.isArray(details)) {
      return ensureAlwaysAskedDetails(Object.keys(details) as DetailField[]);
    }
    return ensureAlwaysAskedDetails(Array.isArray(details) ? details : DEFAULT_DETAILS_TO_COLLECT);
  });
  const [detailsMandatory, setDetailsMandatory] = useState<
    Record<DetailField, 'mandatory' | 'optional'>
  >(() => {
    const details = initialForwardActions?.data_agent?.details_to_collect;
    const saved: Record<string, string> =
      initialForwardActions?.data_agent?.details_mandatory || {};
    if (details && typeof details === 'object' && !Array.isArray(details)) {
      return {
        name: 'mandatory',
        phone: 'mandatory',
        email: (details.email as 'mandatory' | 'optional') || 'optional',
        dob: (details.dob as 'mandatory' | 'optional') || 'optional',
        address: (details.address as 'mandatory' | 'optional') || 'optional',
      };
    }
    return {
      name: 'mandatory',
      phone: 'mandatory',
      email: (saved.email as 'mandatory' | 'optional') || 'optional',
      dob: (saved.dob as 'mandatory' | 'optional') || 'optional',
      address: (saved.address as 'mandatory' | 'optional') || 'optional',
    };
  });
  const [enableHumanHandoff, setEnableHumanHandoff] = useState(
    initialForwardActions?.enableHumanHandoff ??
      initialForwardActions?.enable_human_handoff ??
      true,
  );
  console.log(setEnableHumanHandoff);
  const savedBusinessHoursForwardCall = initialForwardActions?.call_handling?.business_hours || {};
  const hasSavedBusinessHoursRouting = hasSavedBusinessHoursForwardCall(
    savedBusinessHoursForwardCall,
  );
  const initialBusinessHoursForwardCall = getInitialBusinessHoursForwardCall(
    savedBusinessHoursForwardCall,
    user,
    enableHumanHandoff,
  );

  const [enableCallbackScheduling, setEnableCallbackScheduling] = useState(
    initialForwardActions?.enableCallbackScheduling ??
      initialForwardActions?.enable_callback_scheduling ??
      true,
  );
  const [selectedManagerId, setSelectedManagerId] = useState<string>(
    typeof initialForwardActions?.manager === 'object'
      ? initialForwardActions?.manager?.id ||
          initialForwardActions?.manager?.manager_id ||
          initialForwardActions?.manager?.uuid ||
          ''
      : String(initialForwardActions?.manager || ''),
  );
  const [managerSearch, setManagerSearch] = useState('');
  const [maxSessionDuration, setMaxSessionDuration] = useState<BoundedIntegerInputValue>(
    normalizeBoundedInteger(
      initialForwardActions?.maxSessionDuration ?? initialForwardActions?.max_session_duration,
      300,
      MAX_DURATION_SECONDS,
    ),
  );
  const [idleReminder, setIdleReminder] = useState<BoundedIntegerInputValue>(
    normalizeBoundedInteger(
      initialForwardActions?.idleReminder ?? initialForwardActions?.idle_reminder,
      60,
      MAX_DURATION_SECONDS,
    ),
  );
  const [idleReminderRetry, setIdleReminderRetry] = useState<BoundedIntegerInputValue>(
    normalizeBoundedInteger(
      initialForwardActions?.idleReminderRetry ?? initialForwardActions?.idle_reminder_retry,
      3,
      MAX_IDLE_REMINDER_RETRIES,
    ),
  );
  const [enableCrmPush, setEnableCrmPush] = useState(() => {
    const savedValue =
      initialForwardActions?.data_agent?.crm_sync ??
      initialForwardActions?.data_agent?.crm_push_enabled ??
      false;
    return isDataCollectionEnabled ? Boolean(savedValue) : false;
  });
  const [selectedCrmPipeline, setSelectedCrmPipeline] = useState<string>(() =>
    normalizeCrmValue(
      initialForwardActions?.data_agent?.crm ||
        initialForwardActions?.data_agent?.crm_pipeline ||
        initialForwardActions?.receptionist_builder?.advanced?.selectedCrmPipeline ||
        '',
    ),
  );
  const [stepErrors, setStepErrors] = useState<Record<string, string>>({});

  const { data: connectedCrmOptions = [], isFetching: isFetchingConnectedCrms } = useQuery({
    queryKey: ['CRMIsConnected', 'ai-receptionist-builder'],
    queryFn: () => CRMIsConnected(),
    enabled: isDataCollectionEnabled && enableCrmPush,
    select: getConnectedCrmOptions,
    refetchOnWindowFocus: false,
    retry: false,
  });

  useEffect(() => {
    if (!isDataCollectionEnabled && enableCrmPush) {
      setEnableCrmPush(false);
    }
  }, [enableCrmPush, isDataCollectionEnabled]);

  useEffect(() => {
    if (!isDataCollectionEnabled || !enableCrmPush || isFetchingConnectedCrms) return;
    if (!selectedCrmPipeline && connectedCrmOptions.length > 0) {
      setSelectedCrmPipeline(connectedCrmOptions[0].value);
      return;
    }
    if (
      selectedCrmPipeline &&
      !connectedCrmOptions.some((option) => option.value === selectedCrmPipeline)
    ) {
      setSelectedCrmPipeline('');
    }
  }, [
    connectedCrmOptions,
    enableCrmPush,
    isDataCollectionEnabled,
    isFetchingConnectedCrms,
    selectedCrmPipeline,
  ]);
  const [isForwardDestinationModalOpen, setIsForwardDestinationModalOpen] = useState(false);
  const [forwardDestinationSnapshot, setForwardDestinationSnapshot] =
    useState<ForwardCallState | null>(null);
  const isForwardModalSavingRef = useRef(false);
  const previewRoomRef = useRef<Room | null>(null);
  const previewAudioElementsRef = useRef<HTMLAudioElement[]>([]);
  const previewAutoStopRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const previewSessionIdRef = useRef<string>('');
  const previewSimpleAudioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentAudio, setCurrentAudio] = useState<string | null>(null);
  const [genderFilter, setGenderFilter] = useState<VoiceGenderFilter>('all');
  const [localeFilter, setLocaleFilter] = useState<VoiceLocaleFilter>(() =>
    getInitialVoiceLocaleFilter(initialData, builderState, initialForwardActions),
  );
  const [voiceSearchQuery, setVoiceSearchQuery] = useState('');
  const storedVoiceHydrationKeyRef = useRef('');
  const hasUserSelectedVoiceRef = useRef(false);
  const formattedOperationalHours = useMemo(() => {
    const rawHours = initialForwardActions?.condition?.operational_hours;
    const operationalHours = rawHours
      ? {
          ...rawHours,
          closed_hour_action: {
            enabled: rawHours.closed_hour_action?.enabled ?? false,
            personal: rawHours.closed_hour_action?.personal ?? true,
            type:
              typeof rawHours.closed_hour_action?.type === 'object'
                ? rawHours.closed_hour_action.type
                : {
                    value: rawHours.closed_hour_action?.type || '',
                    label:
                      rawHours.closed_hour_action?.type_label ||
                      rawHours.closed_hour_action?.type ||
                      '',
                  },
            value:
              typeof rawHours.closed_hour_action?.value === 'object'
                ? rawHours.closed_hour_action.value
                : {
                    value: rawHours.closed_hour_action?.value || '',
                    label:
                      rawHours.closed_hour_action?.value_label ||
                      rawHours.closed_hour_action?.value ||
                      '',
                  },
          },
        }
      : OPERATIONAL_HOURS;

    return {
      ...operationalHours,
      regional: normalizeRegionalSettings(operationalHours?.regional),
    };
  }, [initialForwardActions]);

  const formInstance = useForm({
    defaultValues: {
      settings: {
        operational_hours: formattedOperationalHours,
      },
      callRules: {
        forwardCall: initialBusinessHoursForwardCall,
      },
    },
    mode: 'onChange',
  });
  const {
    watch,
    setValue,
    formState: { errors },
  } = formInstance;
  const operationalHours = watch('settings.operational_hours');
  const forwardCallState = watch('callRules.forwardCall') as ForwardCallState;
  const [committedForwardState, setCommittedForwardState] = useState<ForwardCallState>(() =>
    cloneForwardCallState(formInstance.getValues('callRules.forwardCall') as ForwardCallState),
  );
  const defaultForwardCallAppliedRef = useRef(false);

  useEffect(() => {
    if (hasSavedBusinessHoursRouting || defaultForwardCallAppliedRef.current) return;

    const defaultForwardCall = getDefaultBusinessHoursForwardCall(user, enableHumanHandoff);
    if (!getForwardDestinationValue(defaultForwardCall)) return;

    const currentForwardCall = formInstance.getValues('callRules.forwardCall') as ForwardCallState;
    const currentType = currentForwardCall?.type?.value;
    const currentValue = getForwardDestinationValue(currentForwardCall);
    const typeDirty = formInstance.getFieldState('callRules.forwardCall.type').isDirty;
    const valueDirty = formInstance.getFieldState('callRules.forwardCall.value').isDirty;

    if ((typeDirty || valueDirty) && currentType !== 'EXTENSION') return;
    if (
      (currentType === 'HANGUP' || currentType === 'EXTENSION' || !currentType) &&
      !currentValue
    ) {
      setValue('callRules.forwardCall', defaultForwardCall as any, {
        shouldDirty: false,
        shouldValidate: false,
      });
      setCommittedForwardState(cloneForwardCallState(defaultForwardCall));
      defaultForwardCallAppliedRef.current = true;
    }
  }, [enableHumanHandoff, formInstance, hasSavedBusinessHoursRouting, setValue, user]);

  const { data: sites = [], isLoading: isLoadingSites } = useQuery({
    queryKey: ['siteList', 'ai-receptionist-v2'],
    queryFn: () => siteList({ page: 1, limit: 1000 }),
    select: (data: any) => data?.data?.data?.result?.rows || [],
  });
  const selectedLocation = useMemo(
    () => sites.find((site: any) => getAgentSiteId(site) === selectedLocationId),
    [selectedLocationId, sites],
  );
  const { data: apiVoices = [], isLoading: isLoadingVoices } = useQuery({
    queryKey: ['aiVoiceList'],
    queryFn: () => getAIVoiceList({}),
    select: (data: any) => {
      const rows: any[] = data?.data?.data?.result?.rows || data?.data?.data?.result || [];
      if (!rows.length) return [];
      return rows.map((v: any) => {
        const label = v.display_name || v.local_name || v.name || v.short_name || '';
        return {
          label,
          value: getVoiceSelectionValue({ ...v, label }),
          uuid: v.uuid || '',
          id: v.id || '',
          voice_id: v.voice_id || '',
          gender: (v.gender || '').toLowerCase(),
          locale: v.locale || '',
          short_name: v.short_name || '',
          voice_type: v.voice_type || '',
          multilingual:
            v.multilingual === true || String(v.multilingual || '').toLowerCase() === 'true',
          audioURL: null,
        };
      });
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
  useEffect(() => {
    if (isLoadingVoices) return;
    if (hasUserSelectedVoiceRef.current) return;

    const storedVoiceValue = getStoredReceptionistVoice(initialData, builderState);
    const hydrationKey = [
      receptionistRecordId || 'new',
      storedVoiceValue || '',
      apiVoices.length,
    ].join(':');

    if (storedVoiceHydrationKeyRef.current === hydrationKey) return;
    storedVoiceHydrationKeyRef.current = hydrationKey;

    const voiceCandidates = getAvailableReceptionistVoices(apiVoices, selectedLanguage);
    const normalizedStoredVoiceValue = normalizeStoredVoiceValue(storedVoiceValue);
    const savedLocaleFilter = getInitialVoiceLocaleFilter(
      initialData,
      builderState,
      initialForwardActions,
    );
    const defaultVoice =
      voiceCandidates.find((voice: any) => voiceMatchesRuntimeLanguage(voice, savedLocaleFilter)) ||
      voiceCandidates[0];
    const matchedVoice = voiceCandidates.find(
      (v: any) =>
        isVoiceValueMatch(storedVoiceValue, v) || isVoiceValueMatch(normalizedStoredVoiceValue, v),
    );
    const voiceToSelect = matchedVoice || defaultVoice;
    if (voiceToSelect) {
      const selectedVoiceValue = getVoiceSelectionValue(voiceToSelect);
      setSelectedPersona(selectedVoiceValue);
      setSelectedPersonaObj({ ...voiceToSelect, value: selectedVoiceValue });
      if (isEdit) {
        setGenderFilter(getVoiceGenderFilter(voiceToSelect));
        setLocaleFilter(savedLocaleFilter === 'all' ? 'all' : getVoiceLocaleFilter(voiceToSelect));
        setVoiceSearchQuery('');
      }
      setStepErrors((prev) => ({ ...prev, selectedPersona: '' }));
      return;
    }

    setSelectedPersona('');
    setSelectedPersonaObj({});
    if (isEdit) {
      setGenderFilter('all');
      setLocaleFilter(savedLocaleFilter);
    }
  }, [
    apiVoices,
    builderState,
    initialForwardActions,
    initialData,
    isEdit,
    isLoadingVoices,
    receptionistRecordId,
    selectedLanguage,
  ]);
  const { data: extensionList = [] } = useGetExtensions({
    page: 1,
    limit: 9999,
    filters: [],
    search: '',
  });
  const debouncedManagerSearch = useDebounce(managerSearch, 300);
  const {
    users: managerUserList,
    fetchNextPage: fetchNextManagerPage,
    hasNextPage: hasNextManagerPage = false,
    isFetchingNextPage: isFetchingNextManagerPage,
    isLoading: isLoadingManagerUsers,
  } = usePaginatedUsers({
    search: debouncedManagerSearch,
    queryKey: ['aiReceptionistManagerUsers'],
    params: { role: ['MANAGER', 'SUB-ADMIN', 'ADMIN'] },
  });
  const { greetingList = [] } = useGetGreetings({ displayType: 'dropdown' });
  const { data: departmentList = [] } = useGetDepartment({ displayType: 'dropdown' });
  const { data: IVRList = [] } = useGetIVR({ displayType: 'dropdown' });
  const { data: queueList = [] } = useGetQueueList({ displayType: 'dropdown' });
  const forwardingOptionsData = useMemo(
    () => ({ extensionList, greetingList, departmentList, IVRList, queueList }),
    [extensionList, greetingList, departmentList, IVRList, queueList],
  );
  const managerExtensions = useMemo(() => {
    const managers = managerUserList.filter((ext: any) =>
      ['MANAGER', 'SUB-ADMIN', 'ADMIN'].includes(getManagerExtensionRole(ext)),
    );
    const selectedManager = extensionList.find(
      (ext: any) => getManagerExtensionId(ext) === String(selectedManagerId),
    );
    if (
      selectedManager &&
      !managers.some(
        (ext: any) => getManagerExtensionId(ext) === getManagerExtensionId(selectedManager),
      )
    ) {
      managers.unshift(selectedManager);
    }
    return managers;
  }, [extensionList, managerUserList, selectedManagerId]);

  const managerOptions = useMemo(() => {
    return managerExtensions.map((ext: any) => ({
      label: `${ext.first_name || ''} ${ext.last_name || ''}`.trim(),
      value: getManagerExtensionId(ext),
      extension: ext.extension || '',
    }));
  }, [managerExtensions]);

  const selectedManagerOption = useMemo(() => {
    return (
      managerOptions.find((opt: any) => String(opt.value) === String(selectedManagerId)) || null
    );
  }, [managerOptions, selectedManagerId]);

  useEffect(() => {
    if (!sites.length) return;
    const hasSelectedSite = sites.some((site: any) => getAgentSiteId(site) === selectedLocationId);
    if (hasSelectedSite) return;
    setSelectedLocationId(getPreferredAgentSiteId(sites));
  }, [selectedLocationId, sites]);

  useEffect(() => {
    if (!selectedLocation) return;
    const regionalFieldName = 'settings.operational_hours.regional' as const;
    const regionalSettings = getAgentSiteRegionalSettings(
      selectedLocation,
      formInstance.getValues(regionalFieldName),
    );
    setValue(regionalFieldName, regionalSettings, {
      shouldDirty: false,
      shouldValidate: true,
    });
    setStepErrors((prev) => ({ ...prev, siteLocation: '' }));
  }, [formInstance, selectedLocation, setValue]);

  const knowledgeBaseSummaryResolverPayload = useMemo(() => ({ page: 1, limit: 1000 }), []);

  const { data: kbData = [] } = useQuery({
    queryKey: ['AIUserKnowledgeBase', 'summary-resolver', knowledgeBaseSummaryResolverPayload],
    queryFn: () => AIUserKnowledgeBase(knowledgeBaseSummaryResolverPayload),
    select: getKnowledgeBaseRows,
  });

  const { data: reusableChatAgentRows = [], isFetching: isFetchingReusableChatAgents } = useQuery({
    queryKey: ['getChatAgentList', 'receptionist-knowledge-reuse-picker'],
    queryFn: () => getChatAgentList({ page: 1, limit: 1000, filters: [], search: '' }),
    select: getAgentListRows,
  });

  const { data: reusableReceptionistRows = [], isFetching: isFetchingReusableReceptionists } =
    useQuery({
      queryKey: ['getAIReceptionistList', 'receptionist-knowledge-reuse-picker'],
      queryFn: () => getAIReceptionistList({ page: 1, limit: 1000, filters: [], search: '' }),
      select: getAgentListRows,
    });

  const reusableKnowledgeAgents = useMemo(
    () =>
      [
        ...reusableChatAgentRows.map((agent: any) => buildReusableKnowledgeAgent(agent, 'chat')),
        ...reusableReceptionistRows.map((agent: any) =>
          buildReusableKnowledgeAgent(agent, 'voice'),
        ),
      ].filter((agent): agent is ReusableKnowledgeAgent => Boolean(agent)),
    [reusableChatAgentRows, reusableReceptionistRows],
  );

  const filteredKnowledgeBaseRows = useMemo(() => {
    const search = knowledgeBaseSearch.trim().toLowerCase();
    if (!search) return reusableKnowledgeAgents;

    return reusableKnowledgeAgents.filter((agent) =>
      [agent.name, agent.meta, agent.channel].join(' ').toLowerCase().includes(search),
    );
  }, [reusableKnowledgeAgents, knowledgeBaseSearch]);

  const isFetchingReusableKnowledgeAgents =
    isFetchingReusableChatAgents || isFetchingReusableReceptionists;

  const selectedReusableAgent = useMemo(
    () => reusableKnowledgeAgents.find((agent) => agent.id === selectedReusableAgentId) || null,
    [reusableKnowledgeAgents, selectedReusableAgentId],
  );

  const selectedKnowledgeBaseItems = useMemo(
    () => [
      ...getMatchedKnowledgeBaseItems(
        selectedTextKnowledgeIds,
        'text',
        kbData,
        existingKnowledgeBaseFallbackItems,
      ),
      ...getMatchedKnowledgeBaseItems(
        selectedUrlKnowledgeIds,
        'url',
        kbData,
        existingKnowledgeBaseFallbackItems,
      ),
      ...getMatchedKnowledgeBaseItems(
        selectedPdfKnowledgeIds,
        'pdf',
        kbData,
        existingKnowledgeBaseFallbackItems,
      ),
    ],
    [
      existingKnowledgeBaseFallbackItems,
      kbData,
      selectedPdfKnowledgeIds,
      selectedTextKnowledgeIds,
      selectedUrlKnowledgeIds,
    ],
  );

  const selectedKnowledgeBaseSummaryInput = useMemo(() => {
    const text = selectedKnowledgeBaseItems
      .filter((entry) => entry.type === 'text')
      .flatMap((entry) => getKnowledgeBaseDataValues(entry.item));
    const url = selectedKnowledgeBaseItems
      .filter((entry) => entry.type === 'url')
      .flatMap((entry) =>
        getKnowledgeBaseDataValues(entry.item).filter(isLikelyUrl).map(normalizeUrl),
      );
    const pdf = selectedKnowledgeBaseItems
      .filter((entry) => entry.type === 'pdf')
      .flatMap((entry) => getKnowledgeBaseDataValues(entry.item).filter(isHttpUrl));
    const pdfFiles = selectedKnowledgeBaseItems
      .filter((entry) => entry.type === 'pdf')
      .flatMap((entry) => getKnowledgeBasePdfFileReferences(entry.item));

    return {
      text: uniqueStrings(text),
      url: uniqueStrings(url),
      pdf: uniqueStrings(pdf),
      pdfFiles: uniqueStrings(pdfFiles),
    };
  }, [selectedKnowledgeBaseItems]);

  const sourceRecords = useMemo<SourceRecord[]>(() => {
    const existingKnowledgeSources = selectedKnowledgeBaseItems.map(({ id, type, item }) => ({
      id: `knowledge-${type}-${id}`,
      title: getKnowledgeBaseTitle(item, id),
      source: getKnowledgeBaseSourceLabel(item, type),
      type: getKnowledgeBaseTypeLabel(type),
      detail: getKnowledgeBaseSourceLabel(item, type),
    }));
    const selectedLinkSet = new Set(selectedLinks);
    const crawledPages = selectedLinks.map((link) => ({
      id: link,
      title: getPageTitle(link),
      source: link,
      type: 'Crawled page',
      detail: websiteUrl ? `Scanned from ${websiteUrl}` : 'Scanned website page',
    }));
    const manualUrls = pendingUrls
      .filter((url) => !selectedLinkSet.has(url))
      .map((url) => ({
        id: `pending-url-${url}`,
        title: getPageTitle(url),
        source: url,
        type: 'Website link',
        detail: 'Will be created when the receptionist is saved.',
      }));
    const textSources = pendingTextItems.map((item) => ({
      id: item.id,
      title: item.title,
      source: 'Pasted text',
      type: 'Company details',
      detail: item.text,
    }));
    const fileSources = pendingFiles.map(({ id, file }) => ({
      id,
      title: file.name,
      source: formatFileSize(file.size),
      type: 'Document',
      detail: 'Will be uploaded when the receptionist is saved.',
    }));
    return [
      ...existingKnowledgeSources,
      ...crawledPages,
      ...manualUrls,
      ...textSources,
      ...fileSources,
    ];
  }, [
    pendingFiles,
    pendingTextItems,
    pendingUrls,
    selectedKnowledgeBaseItems,
    selectedLinks,
    websiteUrl,
  ]);
  const knowledgeDocuments = useMemo<KnowledgeDocument[]>(
    () => [
      ...selectedKnowledgeBaseItems.map(({ id, type, item }) => ({
        id: `knowledge-${type}-${id}`,
        title: getKnowledgeBaseTitle(item, id),
        copy: getKnowledgeBaseSourceLabel(item, type),
        source: 'Saved knowledge base',
        status: item ? 'Attached' : 'Missing',
        type,
      })),
      ...selectedLinks.map((link) => ({
        id: link,
        title: getPageTitle(link),
        copy: link,
        source: websiteUrl || link,
        status: 'Crawled',
        type: 'url',
      })),
      ...pendingUrls
        .filter((url) => !selectedLinks.includes(url))
        .map((url) => ({
          id: `pending-url-${url}`,
          title: getPageTitle(url),
          copy: url,
          source: url,
          status: 'Pending',
          type: 'url',
        })),
      ...pendingTextItems.map((item) => ({
        id: item.id,
        title: item.title,
        copy: item.text,
        source: 'Pasted text',
        status: 'Pending',
        type: 'text',
      })),
      ...pendingFiles.map(({ id, file }) => ({
        id,
        title: file.name,
        copy: formatFileSize(file.size),
        source: 'PDF upload',
        status: 'Pending',
        type: 'pdf',
      })),
    ],
    [
      pendingFiles,
      pendingTextItems,
      pendingUrls,
      selectedKnowledgeBaseItems,
      selectedLinks,
      websiteUrl,
    ],
  );
  const hasOnlyExistingKnowledgeBaseSelection = Boolean(
    (selectedReusableAgentId || selectedKnowledgeBaseItems.length > 0) &&
    !selectedLinks.length &&
    !pendingUrls.length &&
    !pendingTextItems.length &&
    !pendingFiles.length &&
    !customContent.trim(),
  );
  const selectedExistingKnowledgeBaseDocuments = useMemo(() => {
    if (selectedReusableAgent) return selectedReusableAgent.documents;
    if (isEdit && storedKnowledgeDocuments.length) return storedKnowledgeDocuments;

    const storedDocuments = selectedKnowledgeBaseItems.flatMap(({ id, type, item }) =>
      getStoredKnowledgeBaseDocuments(item).map((document) => ({
        ...document,
        id: `knowledge-${type}-${id}-${document.id}`,
      })),
    );
    if (storedDocuments.length) return storedDocuments;

    return knowledgeDocuments.filter((document) => document.id.startsWith('knowledge-'));
  }, [
    isEdit,
    knowledgeDocuments,
    selectedKnowledgeBaseItems,
    selectedReusableAgent,
    storedKnowledgeDocuments,
  ]);
  const selectedExistingKnowledgeBaseFaqs = useMemo(() => {
    if (selectedReusableAgent) return selectedReusableAgent.faqs;
    if (isEdit && storedKnowledgeFaqs.length) return storedKnowledgeFaqs;

    return selectedKnowledgeBaseItems.flatMap(({ id, type, item }) =>
      getStoredKnowledgeBaseFaqs(item).map((faq) => ({
        ...faq,
        id: `knowledge-${type}-${id}-${faq.id}`,
      })),
    );
  }, [isEdit, selectedKnowledgeBaseItems, selectedReusableAgent, storedKnowledgeFaqs]);
  const knowledgeSummaryPayload = useMemo<SummarizeKnowledgeBasePayload>(
    () => ({
      crawl_url: uniqueStrings(selectedLinks.map((url) => normalizeUrl(url))),
      url: uniqueStrings([
        ...selectedKnowledgeBaseSummaryInput.url,
        ...pendingUrls.map((url) => normalizeUrl(url)),
      ]),
      text: uniqueStrings([
        ...selectedKnowledgeBaseSummaryInput.text,
        ...pendingTextItems.map((item) => item.text.trim()),
        customContent.trim(),
      ]),
      pdf: selectedKnowledgeBaseSummaryInput.pdf,
    }),
    [
      customContent,
      pendingTextItems,
      pendingUrls,
      selectedKnowledgeBaseSummaryInput,
      selectedLinks,
    ],
  );
  const knowledgeFaqPayload = useMemo<GenerateKnowledgeBaseFaqPayload>(
    () => ({
      crawl_url: knowledgeSummaryPayload.crawl_url ?? [],
      url: knowledgeSummaryPayload.url ?? [],
      text: knowledgeSummaryPayload.text ?? [],
    }),
    [knowledgeSummaryPayload],
  );
  const knowledgeFaqRequestKey = useMemo(
    () =>
      JSON.stringify({
        crawl_url: knowledgeFaqPayload.crawl_url ?? [],
        url: knowledgeFaqPayload.url ?? [],
        text: knowledgeFaqPayload.text ?? [],
      }),
    [knowledgeFaqPayload],
  );
  const hasKnowledgeSummaryInput = Boolean(
    knowledgeSummaryPayload.crawl_url?.length ||
    knowledgeSummaryPayload.url?.length ||
    knowledgeSummaryPayload.text?.length ||
    knowledgeSummaryPayload.pdf?.length ||
    selectedKnowledgeBaseSummaryInput.pdfFiles.length ||
    pendingFiles.length,
  );
  const knowledgeSummaryRequestKey = useMemo(
    () =>
      JSON.stringify({
        crawl_url: knowledgeSummaryPayload.crawl_url ?? [],
        url: knowledgeSummaryPayload.url ?? [],
        text: knowledgeSummaryPayload.text ?? [],
        pdf_files: selectedKnowledgeBaseSummaryInput.pdfFiles,
        pdf: [
          ...(knowledgeSummaryPayload.pdf ?? []),
          ...pendingFiles.map(({ file }) => ({
            name: file.name,
            size: file.size,
            type: file.type,
            lastModified: file.lastModified,
          })),
        ],
      }),
    [knowledgeSummaryPayload, pendingFiles, selectedKnowledgeBaseSummaryInput.pdfFiles],
  );
  const existingKnowledgeReviewSourceKey = useMemo(
    () =>
      JSON.stringify({
        reusableAgentId: selectedReusableAgentId,
        selectedKnowledgeBase: {
          text: selectedTextKnowledgeIds,
          url: selectedUrlKnowledgeIds,
          pdf: selectedPdfKnowledgeIds,
        },
        documents: selectedExistingKnowledgeBaseDocuments,
        faqs: selectedExistingKnowledgeBaseFaqs,
      }),
    [
      selectedExistingKnowledgeBaseDocuments,
      selectedExistingKnowledgeBaseFaqs,
      selectedPdfKnowledgeIds,
      selectedReusableAgentId,
      selectedTextKnowledgeIds,
      selectedUrlKnowledgeIds,
    ],
  );
  const knowledgeReviewStateKey = hasOnlyExistingKnowledgeBaseSelection
    ? `existing:${existingKnowledgeReviewSourceKey}`
    : `generated:${knowledgeSummaryRequestKey}`;

  const clearWebsiteScanProgressCloseTimeout = () => {
    if (!websiteScanProgressCloseTimeoutRef.current) return;
    clearTimeout(websiteScanProgressCloseTimeoutRef.current);
    websiteScanProgressCloseTimeoutRef.current = null;
  };
  const clearKnowledgeReviewPollTimeout = () => {
    if (!knowledgeReviewPollTimeoutRef.current) return;
    clearTimeout(knowledgeReviewPollTimeoutRef.current);
    knowledgeReviewPollTimeoutRef.current = null;
  };

  const finishWebsiteScanProgress = (
    status: Exclude<WebsiteScanProgressStatus, 'idle' | 'loading'>,
  ) => {
    clearWebsiteScanProgressCloseTimeout();
    setWebsiteScanProgressStatus(status);
    websiteScanProgressCloseTimeoutRef.current = setTimeout(
      () => {
        setWebsiteScanProgressStatus('idle');
        websiteScanProgressCloseTimeoutRef.current = null;
      },
      status === 'success' ? 750 : 550,
    );
  };

  useEffect(() => {
    if (activeStep === 4 && sourceStage === 2) {
      setExpandedPickPageCategoryId(null);
    }
  }, [activeStep, sourceStage]);

  useEffect(() => {
    return () => {
      if (websiteScanProgressCloseTimeoutRef.current) {
        clearTimeout(websiteScanProgressCloseTimeoutRef.current);
      }
      clearKnowledgeReviewPollTimeout();
    };
  }, []);

  useEffect(() => {
    if (activeStep !== 5) {
      clearKnowledgeReviewPollTimeout();
      knowledgeReviewJobIdRef.current = '';
      setIsSummarizingKnowledgeBase(false);
      setIsGeneratingKnowledgeFaqs(false);
      return;
    }
    if (knowledgeSummaryRequestKeyRef.current === knowledgeReviewStateKey) return;

    if (hasOnlyExistingKnowledgeBaseSelection) {
      clearKnowledgeReviewPollTimeout();
      knowledgeSummaryRequestKeyRef.current = knowledgeReviewStateKey;
      knowledgeReviewJobIdRef.current = '';
      setKnowledgeDocumentSummaries(selectedExistingKnowledgeBaseDocuments);
      setKnowledgeFaqs(selectedExistingKnowledgeBaseFaqs);
      setKnowledgeBaseSummaryError('');
      setKnowledgeFaqError('');
      setIsSummarizingKnowledgeBase(false);
      setIsGeneratingKnowledgeFaqs(false);
      return;
    }

    if (
      isEdit &&
      !hasKnowledgeSummaryInput &&
      (storedKnowledgeDocuments.length || storedKnowledgeFaqs.length)
    ) {
      clearKnowledgeReviewPollTimeout();
      knowledgeSummaryRequestKeyRef.current = knowledgeReviewStateKey;
      knowledgeReviewJobIdRef.current = '';
      setKnowledgeDocumentSummaries(storedKnowledgeDocuments);
      setKnowledgeFaqs(storedKnowledgeFaqs);
      setKnowledgeBaseSummaryError('');
      setKnowledgeFaqError('');
      setIsSummarizingKnowledgeBase(false);
      setIsGeneratingKnowledgeFaqs(false);
      return;
    }

    if (!hasKnowledgeSummaryInput) {
      clearKnowledgeReviewPollTimeout();
      knowledgeSummaryRequestKeyRef.current = knowledgeReviewStateKey;
      knowledgeReviewJobIdRef.current = '';
      setKnowledgeDocumentSummaries([]);
      setKnowledgeFaqs([]);
      setKnowledgeBaseSummaryError('');
      setKnowledgeFaqError('');
      setIsSummarizingKnowledgeBase(false);
      setIsGeneratingKnowledgeFaqs(false);
      return;
    }

    if (
      isEdit &&
      storedKnowledgeDocuments.length &&
      storedKnowledgeFaqs.length &&
      storedGeneratedSummarySourceKey === knowledgeSummaryRequestKey &&
      storedGeneratedFaqSourceKey === knowledgeFaqRequestKey
    ) {
      clearKnowledgeReviewPollTimeout();
      knowledgeSummaryRequestKeyRef.current = knowledgeReviewStateKey;
      knowledgeReviewJobIdRef.current = '';
      setKnowledgeDocumentSummaries(storedKnowledgeDocuments);
      setKnowledgeFaqs(storedKnowledgeFaqs);
      setKnowledgeBaseSummaryError('');
      setKnowledgeFaqError('');
      setIsSummarizingKnowledgeBase(false);
      setIsGeneratingKnowledgeFaqs(false);
      return;
    }
    const currentSourceEntries = getKnowledgeReviewPayloadEntries(knowledgeSummaryPayload);
    const activeSourceKeys = new Set(
      currentSourceEntries
        .map((entry) => getKnowledgeReviewSourceKey(entry.type, entry.value))
        .filter(Boolean),
    );
    const baseKnowledgeDocuments = isEdit
      ? storedKnowledgeDocuments.filter((document) =>
          activeSourceKeys.has(getKnowledgeReviewItemSourceKey(document)),
        )
      : [];
    const baseKnowledgeFaqs = isEdit
      ? storedKnowledgeFaqs.filter((faq) =>
          activeSourceKeys.has(getKnowledgeReviewItemSourceKey(faq)),
        )
      : [];
    const coveredSourceKeys = new Set(
      [...baseKnowledgeDocuments, ...baseKnowledgeFaqs]
        .map((item) => getKnowledgeReviewItemSourceKey(item))
        .filter(Boolean),
    );
    const pendingReviewPayload = isEdit
      ? buildKnowledgeReviewPayload(
          currentSourceEntries.filter(
            (entry) => !coveredSourceKeys.has(getKnowledgeReviewSourceKey(entry.type, entry.value)),
          ),
        )
      : knowledgeSummaryPayload;

    if (
      isEdit &&
      !pendingFiles.length &&
      !selectedKnowledgeBaseSummaryInput.pdfFiles.length &&
      !hasKnowledgeReviewPayloadInput(pendingReviewPayload)
    ) {
      clearKnowledgeReviewPollTimeout();
      knowledgeSummaryRequestKeyRef.current = knowledgeReviewStateKey;
      knowledgeReviewJobIdRef.current = '';
      setKnowledgeDocumentSummaries(baseKnowledgeDocuments);
      setKnowledgeFaqs(baseKnowledgeFaqs);
      setKnowledgeBaseSummaryError('');
      setKnowledgeFaqError('');
      setIsSummarizingKnowledgeBase(false);
      setIsGeneratingKnowledgeFaqs(false);
      return;
    }

    let isActive = true;
    knowledgeSummaryRequestKeyRef.current = knowledgeReviewStateKey;
    knowledgeReviewJobIdRef.current = '';
    setKnowledgeDocumentSummaries(baseKnowledgeDocuments);
    setKnowledgeFaqs(baseKnowledgeFaqs);
    setKnowledgeBaseSummaryError('');
    setKnowledgeFaqError('');
    setIsSummarizingKnowledgeBase(true);
    setIsGeneratingKnowledgeFaqs(true);

    const applyKnowledgeReviewJobResponse = (response: any) => {
      const documents = getKnowledgeBaseSummaryResponseItems(response);
      const faqs = getKnowledgeFaqResponseItems(response);
      const status = getKnowledgeReviewJobStatus(response);
      const mergedDocuments = [...baseKnowledgeDocuments, ...documents];
      const mergedFaqs = [...baseKnowledgeFaqs, ...faqs];

      setKnowledgeDocumentSummaries(mergedDocuments);
      setKnowledgeFaqs(
        mergedFaqs.length ? mergedFaqs : status === 'failed' ? [createEmptyKnowledgeFaq()] : [],
      );

      if (status === 'completed' || status === 'failed') {
        setKnowledgeBaseSummaryError(mergedDocuments.length ? '' : 'Cannot generate summary');
        setKnowledgeFaqError(mergedFaqs.length ? '' : 'Cannot generate FAQs');
        setIsSummarizingKnowledgeBase(false);
        setIsGeneratingKnowledgeFaqs(false);
        return true;
      }

      return false;
    };

    const pollKnowledgeReviewJob = async (jobId: string) => {
      try {
        const response = await getKnowledgeBaseReviewJob(jobId);
        if (!isActive) return;
        const isComplete = applyKnowledgeReviewJobResponse(response);
        if (!isComplete) {
          knowledgeReviewPollTimeoutRef.current = setTimeout(
            () => void pollKnowledgeReviewJob(jobId),
            2000,
          );
        }
      } catch (error) {
        if (!isActive) return;
        console.error('Cannot load knowledge base review job:', error);
        setKnowledgeDocumentSummaries([]);
        setKnowledgeFaqs([createEmptyKnowledgeFaq()]);
        setKnowledgeBaseSummaryError('Cannot generate summary');
        setKnowledgeFaqError('Cannot generate FAQs');
        setIsSummarizingKnowledgeBase(false);
        setIsGeneratingKnowledgeFaqs(false);
      }
    };

    const startKnowledgeReviewJob = async () => {
      try {
        const existingPdfUrls = (pendingReviewPayload.pdf ?? []).filter(isHttpUrl);
        const pdfUrls = pendingFiles.length
          ? await uploadSummaryPdfFiles(pendingFiles.map(({ file }) => file))
          : [];
        const downloadedPdfUrls = selectedKnowledgeBaseSummaryInput.pdfFiles.length
          ? await resolveKnowledgeBasePdfUrls(selectedKnowledgeBaseSummaryInput.pdfFiles)
          : [];
        if (!isActive) return;

        const reviewPayload = {
          ...pendingReviewPayload,
          pdf: uniqueStrings([...existingPdfUrls, ...downloadedPdfUrls, ...pdfUrls]),
          reviewSessionId: knowledgeReviewSessionIdRef.current,
        };
        const response = await startKnowledgeBaseReviewJob(reviewPayload);
        if (!isActive) return;
        const jobId = getKnowledgeReviewJobId(response);
        knowledgeReviewJobIdRef.current = jobId;
        if (jobId) knowledgeReviewJobIdsRef.current.add(jobId);
        const isComplete = applyKnowledgeReviewJobResponse(response);

        if (!isComplete && jobId) {
          knowledgeReviewPollTimeoutRef.current = setTimeout(
            () => void pollKnowledgeReviewJob(jobId),
            2000,
          );
        } else if (!isComplete) {
          setKnowledgeBaseSummaryError('Cannot generate summary');
          setKnowledgeFaqError('Cannot generate FAQs');
          setIsSummarizingKnowledgeBase(false);
          setIsGeneratingKnowledgeFaqs(false);
        }
      } catch (error) {
        if (!isActive) return;
        console.error('Cannot start knowledge base review job:', error);
        setKnowledgeDocumentSummaries([]);
        setKnowledgeFaqs([createEmptyKnowledgeFaq()]);
        setKnowledgeBaseSummaryError('Cannot generate summary');
        setKnowledgeFaqError('Cannot generate FAQs');
        setIsSummarizingKnowledgeBase(false);
        setIsGeneratingKnowledgeFaqs(false);
      }
    };

    void startKnowledgeReviewJob();

    return () => {
      isActive = false;
      clearKnowledgeReviewPollTimeout();
    };
  }, [
    activeStep,
    hasKnowledgeSummaryInput,
    hasOnlyExistingKnowledgeBaseSelection,
    isEdit,
    knowledgeFaqRequestKey,
    knowledgeReviewStateKey,
    knowledgeSummaryPayload,
    knowledgeSummaryRequestKey,
    pendingFiles,
    selectedExistingKnowledgeBaseDocuments,
    selectedExistingKnowledgeBaseFaqs,
    selectedKnowledgeBaseSummaryInput.pdfFiles,
    storedGeneratedFaqSourceKey,
    storedGeneratedSummarySourceKey,
    storedKnowledgeDocuments,
    storedKnowledgeFaqs,
  ]);

  const { data: useCaseTemplateData, isLoading: isLoadingUseCaseTemplates } = useQuery({
    queryKey: ['getAIAgentType', 'voice'],
    queryFn: () => getAIAgentType({ type: 'voice' }),
  });

  const useCaseTemplateOptions = useMemo(() => {
    const options = getAgentTypeTemplateOptions(useCaseTemplateData);
    const uniqueOptions = Array.from(
      new Map(options.map((option) => [option.name.toLowerCase(), option])).values(),
    );
    const currentUseCase = roleUseCase.trim();

    if (
      currentUseCase &&
      !uniqueOptions.some((option) => option.name.toLowerCase() === currentUseCase.toLowerCase())
    ) {
      return [
        {
          id: `current-${currentUseCase}`,
          name: currentUseCase,
          welcomeGreeting: '',
          systemPrompt: '',
        },
        ...uniqueOptions,
      ];
    }

    return uniqueOptions;
  }, [roleUseCase, useCaseTemplateData]);

  const { mutateAsync: fetchToken, isPending: isPendingToken } = useMutation({
    mutationFn: getAIAgentToken,
    mutationKey: ['getAIAgentToken'],
  });
  const { mutateAsync: submitReceptionist, isPending: isSubmitting } = useMutation({
    mutationFn: isEdit ? updateAiReceptionist : createAiReceptionist,
    onSuccess: () => {
      handleAlert({
        text: `AI Receptionist ${isEdit ? 'updated' : 'created'} successfully!`,
        type: 'success',
      });
      queryClient.invalidateQueries({
        predicate: (query) => String(query.queryKey?.[0] || '').includes('getAIReceptionist'),
      });
      void cleanupKnowledgeReviewWorkspace();
      allowWizardExitRef.current = true;
      onDone();
    },
    onError: (error: any) => {
      console.error(`Failed to ${isEdit ? 'update' : 'create'} AI Receptionist:`, error);
      handleAlert({
        text: `Failed to ${isEdit ? 'update' : 'create'} AI Receptionist.`,
        type: 'error',
      });
    },
  });
  const { mutate: crawlSite, isPending: isCrawlingSite } = useMutation({
    mutationFn: siteCrawl,
    onSuccess: (response: any) => {
      const links = Array.isArray(response?.data) ? response.data : [];
      setDiscoveredLinks(links);
      setSelectedLinks(getSelectedLinksAfterScan(links, selectedLinks));
      setSourceStage(2);
      setStepErrors((prev) => ({ ...prev, websiteUrl: '', knowledgeBase: '' }));
      finishWebsiteScanProgress('success');
      if (!links.length) {
        handleAlert({ text: 'No pages were found for this website.', type: 'warning' });
      }
    },
    onError: (error: any) => {
      finishWebsiteScanProgress('error');
      handleAlert({
        text: error?.response?.data?.error || 'Failed to scan website. Please try again.',
        type: 'error',
      });
    },
  });
  const stopAudio = async () => {
    if (previewAutoStopRef.current) {
      clearTimeout(previewAutoStopRef.current);
      previewAutoStopRef.current = null;
    }
    previewAudioElementsRef.current.forEach((audioEl) => {
      try {
        audioEl.pause();
        audioEl.srcObject = null;
        audioEl.remove();
      } catch {
        // ignore
      }
    });
    previewAudioElementsRef.current = [];
    const sessionIdToFinalize = String(previewSessionIdRef.current || '').trim();
    previewSessionIdRef.current = '';
    if (previewRoomRef.current) {
      try {
        previewRoomRef.current.disconnect();
      } catch {
        // ignore
      }
      previewRoomRef.current = null;
    }
    if (sessionIdToFinalize) {
      try {
        const tokenResponse = await fetchToken();
        const tokenId = tokenResponse?.data?.data?.result?.tokenId;
        if (tokenId) {
          await finalizeAgentSession(
            {
              token: tokenId,
              agentId: '',
              sessionId: sessionIdToFinalize,
              source: 'voice_preview_stop',
              endReason: 'manual_end',
            },
            { hideToastOnError: true },
          );
        }
      } catch {
        // ignore preview finalization failures
      }
    }
    setIsPlaying(false);
    setCurrentAudio(null);
  };

  const stopSimpleAudio = () => {
    if (previewSimpleAudioRef.current) {
      previewSimpleAudioRef.current.pause();
      previewSimpleAudioRef.current.src = '';
      previewSimpleAudioRef.current = null;
    }
    if (previewAutoStopRef.current) {
      clearTimeout(previewAutoStopRef.current);
      previewAutoStopRef.current = null;
    }
    setIsPlaying(false);
    setCurrentAudio(null);
  };

  const handleSelectVoice = (voice: any) => {
    if (isReadOnly) return;

    const voiceValue = getVoiceSelectionValue(voice);
    if (!voiceValue) return;

    stopSimpleAudio();
    hasUserSelectedVoiceRef.current = true;
    setSelectedPersona(voiceValue);
    setSelectedPersonaObj({ ...voice, value: voiceValue });
    setStepErrors((prev) => ({ ...prev, selectedPersona: '' }));
  };

  const handlePlayPause = async (voice: any) => {
    const voiceId = getVoiceSelectionValue(voice);
    const shortName = String(voice?.short_name || '').trim();
    if (!voiceId) return;

    // Toggle off if clicking the currently playing voice
    if (isPlaying && currentAudio === voiceId) {
      stopSimpleAudio();
      return;
    }

    // Stop any previous audio
    stopSimpleAudio();
    setCurrentAudio(voiceId);
    setIsPlaying(true);

    try {
      // Call new preview API with short_name
      const response = await getAIVoicePreview({ short_name: shortName });

      // Response shape: { success, data: { message, result: "<base64_mp3>" } }
      const rawBase64: string = response?.data?.data?.result || '';

      if (!rawBase64) throw new Error('No audio data received from preview API');

      // Build a data URI — the result is raw base64 (no "data:" prefix), MP3 format
      const src = rawBase64.startsWith('data:') ? rawBase64 : `data:audio/mpeg;base64,${rawBase64}`;

      const audio = new Audio(src);
      previewSimpleAudioRef.current = audio;
      audio.onended = () => stopSimpleAudio();
      // audio.onerror = () => {
      //   stopSimpleAudio();
      //   handleAlert({ text: 'Failed to play voice preview', type: 'error' });
      // };
      await audio.play();

      // Auto-stop safety after 30 seconds
      previewAutoStopRef.current = setTimeout(() => {
        stopSimpleAudio();
      }, 30000);
    } catch (error: any) {
      stopSimpleAudio();
      handleAlert({
        text: String(
          error?.response?.data?.error || error?.message || 'Failed to start voice preview',
        ),
        type: 'error',
      });
    }
  };

  useEffect(() => {
    return () => {
      stopSimpleAudio();
      void stopAudio();
    };
  }, []);

  const handleDeleteKbItem = (id: string, type?: string) => {
    void type;
    if (selectedLinks.includes(id)) {
      setSelectedLinks((prev) => prev.filter((item) => item !== id));
    }
  };
  console.log(handleDeleteKbItem);

  const validateStep = (step: ReceptionistStep) => {
    const errorsMap: Record<string, string> = {};
    if (step === 1) {
      const nameError = getReceptionistNameValidationError(receptionistName);
      if (nameError) errorsMap.receptionistName = nameError;
      if (!companyBrand.trim()) errorsMap.companyBrand = 'Company / Brand is required.';
      if (!systemPrompt.trim()) errorsMap.systemPrompt = 'System prompt is required.';
      if (!selectedLocationId || !selectedLocation) {
        errorsMap.siteLocation = 'Please select a site.';
      } else if (!getAgentSiteTimezone(selectedLocation)) {
        errorsMap.siteLocation =
          'The selected location does not have a timezone. Update it under Company & Locations.';
      }
    }
    if (step === 2) {
      if (!selectedLanguage) errorsMap.selectedLanguage = 'Please select a language.';
      const selectableVoices = getAvailableReceptionistVoices(apiVoices, selectedLanguage);
      const hasValidSelectedVoice = selectableVoices.some(
        (voice: any) =>
          isVoiceValueMatch(selectedPersona, voice) &&
          voiceMatchesRuntimeLanguage(voice, localeFilter),
      );
      if (isLoadingVoices) {
        errorsMap.selectedPersona = 'Please wait for voice personas to load.';
      } else if (!selectedPersona || !hasValidSelectedVoice) {
        errorsMap.selectedPersona = 'Please select a voice persona.';
      }
    }
    if (step === 3) {
      if (!greetingText.trim()) errorsMap.greetingText = 'Opening line is required.';
      if (enableHumanHandoff) {
        const forwardCall = formInstance.getValues('callRules.forwardCall') as ForwardCallState;
        const forwardCallError = getForwardCallValidationError(forwardCall);
        if (forwardCallError) errorsMap.forwardCall = forwardCallError.message;
      }
      // Manager is configured on step 3 — validate it here
      if (enableCallbackScheduling && !selectedManagerId) {
        errorsMap.manager = 'Please select a manager for callback scheduling.';
      }
    }
    if (step === 4) {
      const hasKnowledgeFaqText = Boolean(formatKnowledgeFaqText(knowledgeFaqs));
      const hasKnowledgeSummaryText = Boolean(
        formatKnowledgeSummaryText(knowledgeDocumentSummaries),
      );
      const hasSelectedKb =
        Boolean(selectedReusableAgentId) ||
        selectedTextKnowledgeIds.length > 0 ||
        selectedUrlKnowledgeIds.length > 0 ||
        selectedPdfKnowledgeIds.length > 0 ||
        selectedLinks.length > 0 ||
        pendingUrls.length > 0 ||
        pendingTextItems.length > 0 ||
        pendingFiles.length > 0 ||
        hasKnowledgeSummaryText ||
        hasKnowledgeFaqText;

      if (!hasSelectedKb) {
        errorsMap.knowledgeBase = 'Add a scanned page, URL, text, PDF, or custom FAQ.';
        if (websiteUrl.trim() && !isLikelyUrl(websiteUrl)) {
          errorsMap.websiteUrl = 'Enter a valid website URL.';
        }
      } else {
        if (websiteUrl.trim() && !isLikelyUrl(websiteUrl)) {
          errorsMap.websiteUrl = 'Enter a valid website URL.';
        }
      }

      if (extraUrl.trim() && !isLikelyUrl(extraUrl)) {
        errorsMap.extraUrl = 'Enter a valid page URL.';
      }
    }
    // step 6 (Advanced Settings) has no required fields that need blocking validation
    // — forwardCall and manager are validated on step 3 (Greeting & Hours)
    return errorsMap;
  };

  const getReceptionistKnowledgeName = (suffix?: string) => {
    const baseName =
      sanitizeReceptionistName(receptionistName).trim() || 'Receptionist Knowledge Base';
    return suffix ? `${baseName} - ${suffix}` : baseName;
  };

  const createPendingKnowledgeSources = async (): Promise<CreatedKnowledgeIds> => {
    const createdIds: CreatedKnowledgeIds = { text: [], url: [], pdf: [] };
    if (hasOnlyExistingKnowledgeBaseSelection && !selectedReusableAgentId) return createdIds;

    const summaryText = formatKnowledgeSummaryText(knowledgeDocumentSummaries);
    const generatedKnowledgeText = formatGeneratedKnowledgeText(
      knowledgeFaqs,
      knowledgeDocumentSummaries,
    );

    if (generatedKnowledgeText) {
      if (
        isEdit &&
        storedGeneratedKnowledgeBaseId &&
        isSameGeneratedKnowledgeText(generatedKnowledgeText, storedGeneratedKnowledgeText)
      ) {
        createdIds.text.push(storedGeneratedKnowledgeBaseId);
        createdIds.generatedTextId = storedGeneratedKnowledgeBaseId;
        return createdIds;
      }

      const generatedPayload: any = {
        name: getReceptionistKnowledgeName('Generated Knowledge'),
        text: generatedKnowledgeText,
        scope: 'global',
        metadata: {
          source: 'generated_knowledge',
          summarySourceKey: knowledgeSummaryRequestKey,
          faqSourceKey: knowledgeFaqRequestKey,
          summaryText,
          documents: knowledgeDocumentSummaries,
          faqs: getValidKnowledgeFaqs(knowledgeFaqs),
        },
      };
      if (isEdit && storedGeneratedKnowledgeBaseId) {
        generatedPayload.ingestionId = storedGeneratedKnowledgeBaseId;
      }

      const generatedResponse = await userAddContent(generatedPayload);
      const generatedIngestionId = getIngestionIdFromResponse(generatedResponse);
      if (!generatedIngestionId) {
        throw new Error('Generated knowledge base was created without an ingestion ID.');
      }
      createdIds.text.push(generatedIngestionId);
      createdIds.generatedTextId = generatedIngestionId;

      if (pendingFiles.length) {
        const formData = new FormData();
        formData.append('name', getReceptionistKnowledgeName('Files'));
        pendingFiles.forEach(({ file }) => formData.append('files', file, file.name));

        const pdfResponse = await uploadIngestPdf(formData);
        const pdfIngestionId = getIngestionIdFromResponse(pdfResponse);
        if (!pdfIngestionId)
          throw new Error('PDF knowledge base was created without an ingestion ID.');
        createdIds.pdf.push(pdfIngestionId);
      }

      return createdIds;
    }

    const urlsToCreate = uniqueStrings([...selectedLinks, ...pendingUrls].map(normalizeUrl));

    if (urlsToCreate.length) {
      const urlResponse = await userIngestURL({
        name: getReceptionistKnowledgeName('URLs'),
        urls: urlsToCreate,
        scope: 'global',
      });
      const urlIngestionId = getIngestionIdFromResponse(urlResponse);
      if (!urlIngestionId)
        throw new Error('URL knowledge base was created without an ingestion ID.');
      createdIds.url.push(urlIngestionId);
    }

    for (const item of pendingTextItems) {
      const textResponse = await userAddContent({
        name: getReceptionistKnowledgeName(item.title),
        text: item.text,
        scope: 'global',
      });
      const textIngestionId = getIngestionIdFromResponse(textResponse);
      if (!textIngestionId)
        throw new Error('Text knowledge base was created without an ingestion ID.');
      createdIds.text.push(textIngestionId);
    }

    if (pendingFiles.length) {
      const formData = new FormData();
      formData.append('name', getReceptionistKnowledgeName('Files'));
      pendingFiles.forEach(({ file }) => formData.append('files', file, file.name));

      const pdfResponse = await uploadIngestPdf(formData);
      const pdfIngestionId = getIngestionIdFromResponse(pdfResponse);
      if (!pdfIngestionId)
        throw new Error('PDF knowledge base was created without an ingestion ID.');
      createdIds.pdf.push(pdfIngestionId);
    }

    return createdIds;
  };

  const goToStep = async (step: ReceptionistStep) => {
    if (isKnowledgeSummaryNavigationLocked) return;

    if (isReadOnly) {
      setStepErrors({});
      setActiveStep(step);
      return;
    }

    if (step <= activeStep) {
      setStepErrors({});
      setActiveStep(step);
      return;
    }
    const mergedErrors: Record<string, string> = {};
    for (let index = 1; index < step; index += 1) {
      Object.assign(mergedErrors, validateStep(index as ReceptionistStep));
    }
    if (Object.keys(mergedErrors).length) {
      setStepErrors(mergedErrors);
      scrollToFirstValidationError(mergedErrors);
      return;
    }
    await stopAudio();
    setStepErrors({});
    setActiveStep(step);
  };
  console.log(goToStep);

  const getReceptionistWizardStepId = (
    step: ReceptionistStep,
    stage: SourceStage = sourceStage,
  ) => {
    if (step === 1) return 1;
    if (step === 2) return 2;
    if (step === 3) return 3;
    if (step === 4) return stage === 2 ? 5 : 4;
    if (step === 5) return 6;
    return 7;
  };

  const handleStepperChange = async (
    targetActiveStep: ReceptionistStep,
    targetSourceStage: SourceStage = 1,
  ) => {
    if (isKnowledgeSummaryNavigationLocked) return;

    const currentStepId = getReceptionistWizardStepId(activeStep);
    const targetStepId = getReceptionistWizardStepId(targetActiveStep, targetSourceStage);

    if (isReadOnly) {
      setStepErrors({});
      setActiveStep(targetActiveStep);
      if (targetActiveStep === 4) setSourceStage(targetSourceStage);
      if (targetActiveStep === 5) setSourceStage(3);
      return;
    }

    if (targetStepId <= currentStepId) {
      setStepErrors({});
      setActiveStep(targetActiveStep);
      if (targetActiveStep === 4) setSourceStage(targetSourceStage);
      if (targetActiveStep === 5) setSourceStage(3);
      return;
    }

    const mergedErrors: Record<string, string> = {};
    if (targetStepId > 1) Object.assign(mergedErrors, validateStep(1));
    if (targetStepId > 2) Object.assign(mergedErrors, validateStep(2));
    if (targetStepId > 3) Object.assign(mergedErrors, validateStep(3));
    if (targetStepId > 5) Object.assign(mergedErrors, validateStep(4));
    if (Object.keys(mergedErrors).length) {
      setStepErrors(mergedErrors);
      scrollToFirstValidationError(mergedErrors);
      return;
    }

    await stopAudio();
    setStepErrors({});
    setActiveStep(targetActiveStep);
    if (targetActiveStep === 4) setSourceStage(targetSourceStage);
    if (targetActiveStep === 5) setSourceStage(3);
  };

  const handleSelectGreetingType = (type: string) => {
    const brand = companyBrand || 'Example Business';
    const name = receptionistName || 'Maya';
    const text = getGreetingText(type, brand, name);
    setGreetingText(sanitizeAiPlainText(text));
    setSelectedGreetingType(type);
    setStepErrors((prev) => ({ ...prev, greetingText: '' }));
  };

  const handleContinue = async () => {
    if (isReadOnly || isKnowledgeSummaryNavigationLocked) return;

    const errorsMap = validateStep(activeStep);
    if (Object.keys(errorsMap).length) {
      setStepErrors(errorsMap);
      scrollToFirstValidationError(errorsMap);
      return;
    }
    if (activeStep === 4) {
      await stopAudio();
      setStepErrors({});
      setSourceStage(3);
      setActiveStep(5);
      return;
    }
    if (activeStep === 5) {
      await stopAudio();
      setStepErrors({});
      setActiveStep(6);
      return;
    }
    if (activeStep === 6) {
      await handleFinish();
      return;
    }
    await stopAudio();
    setStepErrors({});
    if (activeStep === 3) setSourceStage(1);
    setActiveStep((prev) => Math.min(prev + 1, 6) as ReceptionistStep);
  };
  const handleBack = async () => {
    if (isReadOnly || isKnowledgeSummaryNavigationLocked) return;

    await stopAudio();
    setStepErrors({});
    if (activeStep === 5) {
      setActiveStep(4);
      setSourceStage(2);
      return;
    }
    if (activeStep === 4 && sourceStage === 2) {
      setSourceStage(1);
      return;
    }
    setActiveStep((prev) => Math.max(prev - 1, 1) as ReceptionistStep);
  };
  const handleHeaderUpdateAgent = async () => {
    if (isReadOnly || isKnowledgeSummaryNavigationLocked) return;

    const validationSteps = [1, 2, 3, 4, 5, 6] as ReceptionistStep[];
    const validations = validationSteps.map((step) => ({
      step,
      errors: validateStep(step),
    }));
    const mergedErrors = validations.reduce(
      (acc, item) => ({
        ...acc,
        ...item.errors,
      }),
      {} as Record<string, string>,
    );
    const firstInvalidStep = validations.find((item) => Object.keys(item.errors).length > 0)?.step;

    if (firstInvalidStep) {
      setStepErrors(mergedErrors);
      setActiveStep(firstInvalidStep);
      setEditTab(stepToTab[firstInvalidStep]);
      scrollToFirstValidationError(mergedErrors);
      return;
    }

    await stopAudio();
    setStepErrors({});
    await handleFinish();
  };

  const handleEditTabChange = (tab: ReceptionistEditTab) => {
    if (isKnowledgeSummaryNavigationLocked) return;

    setEditTab(tab);
    if (tab !== 'overview') {
      setActiveStep(tabToStep[tab]);
      if (tab === 'knowledge') setSourceStage(1);
      if (tab === 'summary') setSourceStage(3);
    }
  };
  useEffect(() => {
    if (!isEdit || editTab === 'overview') return;
    const nextTab = stepToTab[activeStep];
    if (nextTab && nextTab !== editTab) setEditTab(nextTab);
  }, [activeStep, editTab, isEdit]);

  const handleScanWebsite = (urlOverride?: string) => {
    if (isReadOnly) return;

    const normalizedUrl = normalizeUrl(urlOverride || websiteUrl);
    if (!normalizedUrl) {
      setStepErrors((prev) => ({ ...prev, websiteUrl: 'Website URL is required.' }));
      return;
    }
    if (!isLikelyUrl(normalizedUrl)) {
      setStepErrors((prev) => ({ ...prev, websiteUrl: 'Enter a valid website URL.' }));
      return;
    }
    setWebsiteUrl(normalizedUrl);
    clearWebsiteScanProgressCloseTimeout();
    setWebsiteScanProgressStatus('loading');
    crawlSite({ site_url: normalizedUrl });
  };
  const handleAddExtraUrl = () => {
    if (isReadOnly) return;

    const normalizedUrl = normalizeUrl(extraUrl);
    if (!normalizedUrl || !isLikelyUrl(normalizedUrl)) {
      setStepErrors((prev) => ({ ...prev, extraUrl: 'Enter a valid page URL.' }));
      return;
    }
    setPendingUrls((prev) => uniqueStrings([...prev, normalizedUrl]));
    setExtraUrl('');
    setStepErrors((prev) => ({ ...prev, extraUrl: '', knowledgeBase: '' }));
  };
  const handleRemovePendingUrl = (url: string) => {
    setPendingUrls((prev) => prev.filter((item) => item !== url));
  };
  const handleAddCustomContent = () => {
    if (isReadOnly) return;

    const content = customContent.trim();
    if (!content) {
      handleAlert({ text: 'Please add content before creating a knowledge base.', type: 'error' });
      return;
    }
    setPendingTextItems((prev) => [
      ...prev,
      {
        id: createLocalId('pending-text'),
        title: customContentTitle.trim() || `Text ${prev.length + 1}`,
        text: content,
      },
    ]);
    setCustomContent('');
    setCustomContentTitle('Custom Content');
    setIsAddKnowledgeOpen(false);
    setSourceStage(2);
    setStepErrors((prev) => ({ ...prev, customContent: '', knowledgeBase: '' }));
  };
  const handleRemovePendingText = (id: string) => {
    setPendingTextItems((prev) => prev.filter((item) => item.id !== id));
  };
  const handlePendingFilesSelected = (files: FileList | null) => {
    if (isReadOnly || !files?.length) return;

    const maxFileSize = 25 * 1024 * 1024;
    const selectedFiles = Array.from(files);
    const pdfFiles = selectedFiles.filter(
      (file) => file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf'),
    );
    const validSizedFiles = pdfFiles.filter((file) => file.size <= maxFileSize);

    if (pdfFiles.length !== selectedFiles.length) {
      handleAlert({ text: 'Only PDF files can be added.', type: 'warning' });
    }
    if (validSizedFiles.length !== pdfFiles.length) {
      handleAlert({ text: 'PDF files must be 25 MB or smaller.', type: 'warning' });
    }

    setPendingFiles((prev) => {
      const existingKeys = new Set(
        prev.map(({ file }) => `${file.name}-${file.size}-${file.lastModified}`),
      );
      const nextFiles = validSizedFiles
        .filter((file) => !existingKeys.has(`${file.name}-${file.size}-${file.lastModified}`))
        .map((file) => ({ id: createLocalId('pending-file'), file }));
      const merged = [...prev, ...nextFiles].slice(0, 5);

      if (prev.length + nextFiles.length > 5) {
        handleAlert({ text: 'You can add up to 5 PDF files only.', type: 'warning' });
      }

      return merged;
    });
    setStepErrors((prev) => ({ ...prev, knowledgeBase: '' }));
  };
  const handleRemovePendingFile = (id: string) => {
    if (isReadOnly) return;
    setPendingFiles((prev) => prev.filter((item) => item.id !== id));
  };

  const handleSelectReusableKnowledgeAgent = async (agent: ReusableKnowledgeAgent) => {
    if (isReadOnly) return;

    await cleanupKnowledgeReviewWorkspace();
    setSelectedReusableAgentId(agent.id);
    setSelectedTextKnowledgeIds([]);
    setSelectedUrlKnowledgeIds([]);
    setSelectedPdfKnowledgeIds([]);
    setSelectedLinks([]);
    setPendingUrls([]);
    setPendingTextItems([]);
    setPendingFiles([]);
    setExtraUrl('');
    setCustomContent('');
    setKnowledgeDocumentSummaries(agent.documents);
    setKnowledgeFaqs(agent.faqs);
    setKnowledgeBaseSummaryError('');
    setKnowledgeFaqError('');
    setStepErrors((prev) => ({ ...prev, knowledgeBase: '' }));
    setSourceStage(3);
    setActiveStep(5);
    if (isEdit) setEditTab('summary');
  };

  const handleContinueFromWebsite = () => {
    if (isReadOnly) return;

    const normalizedUrl = normalizeUrl(websiteUrl);
    if (!normalizedUrl) {
      setStepErrors((prev) => ({ ...prev, websiteUrl: 'Website URL is required.' }));
      return;
    }

    if (!isLikelyUrl(normalizedUrl)) {
      setStepErrors((prev) => ({ ...prev, websiteUrl: 'Enter a valid website URL.' }));
      return;
    }

    setStepErrors((prev) => ({ ...prev, websiteUrl: '' }));
    setWebsiteUrl(normalizedUrl);
    handleScanWebsite(normalizedUrl);
  };

  const handleUseManualKnowledgeMode = async () => {
    if (isReadOnly) return;

    await cleanupKnowledgeReviewWorkspace();
    clearKnowledgeReviewPollTimeout();
    knowledgeSummaryRequestKeyRef.current = '';
    knowledgeReviewJobIdRef.current = '';
    knowledgeReviewSessionIdRef.current = createLocalId('knowledge-review');
    setSelectedReusableAgentId('');
    setSelectedTextKnowledgeIds([]);
    setSelectedUrlKnowledgeIds([]);
    setSelectedPdfKnowledgeIds([]);
    setDiscoveredLinks([]);
    setSelectedLinks([]);
    setPendingUrls([]);
    setExtraUrl('');
    setKnowledgeDocumentSummaries([]);
    setKnowledgeFaqs([]);
    setKnowledgeBaseSummaryError('');
    setKnowledgeFaqError('');
    setStepErrors((prev) => ({ ...prev, extraUrl: '', knowledgeBase: '' }));
    setSourceStage(2);
  };

  const handleContinueFromKnowledgeBase = async () => {
    if (isReadOnly || isKnowledgeSummaryNavigationLocked) return;

    const errors = validateStep(4);
    if (Object.keys(errors).length) {
      setStepErrors(errors);
      scrollToFirstValidationError(errors);
      return;
    }

    await stopAudio();
    setStepErrors({});
    setSourceStage(3);
    setActiveStep(5);
    if (isEdit) setEditTab('summary');
  };

  const handleOpenReviewKnowledgeAdd = (type: ReviewKnowledgeItemType) => {
    if (isReadOnly) return;
    setOpenReviewKnowledgeMenu('');
    setReviewKnowledgeAddModal({
      type,
      mode: 'text',
      title: '',
      body: '',
      file: null,
    });
  };

  const handleConfirmReviewKnowledgeAdd = () => {
    if (isReadOnly || !reviewKnowledgeAddModal) return;

    const title = reviewKnowledgeAddModal.title.trim();
    const body = reviewKnowledgeAddModal.body.trim();
    const isUpload = reviewKnowledgeAddModal.mode === 'upload';
    const file = reviewKnowledgeAddModal.file;

    if (isUpload && !file) {
      handleAlert({ text: 'Choose a file or switch to Paste text.', type: 'warning' });
      return;
    }

    if (!isUpload && !title) {
      handleAlert({
        text:
          reviewKnowledgeAddModal.type === 'faq' ? 'Question is required.' : 'Title is required.',
        type: 'warning',
      });
      return;
    }

    if (reviewKnowledgeAddModal.type === 'document') {
      const documentTitle = isUpload && file ? file.name.replace(/\.[^.]+$/, '') : title;
      const documentBody =
        isUpload && file
          ? `Imported from ${file.name}. The receptionist will use this document content as review knowledge.`
          : body;

      setKnowledgeDocumentSummaries((prev) => [
        {
          id: createLocalId('document'),
          title: documentTitle,
          copy: documentBody,
          source: isUpload && file ? file.name : 'Manual',
          status: 'Just now',
          type: isUpload ? 'pdf' : 'text',
        },
        ...prev,
      ]);
    } else {
      setKnowledgeFaqs((prev) => [
        {
          id: createLocalId('faq'),
          question: isUpload && file ? file.name.replace(/\.[^.]+$/, '') : title,
          answer:
            isUpload && file
              ? `Imported from ${file.name}. The receptionist will use this file as FAQ knowledge.`
              : body,
          source: isUpload && file ? file.name : 'Manual',
        },
        ...prev,
      ]);
    }

    setReviewKnowledgeAddModal(null);
    setStepErrors((prev) => ({ ...prev, knowledgeBase: '' }));
    handleAlert({ text: 'Added to knowledge base.', type: 'success' });
  };

  const handleReviewKnowledgeAddFilePicked = (file: globalThis.File | null) => {
    if (!file || !reviewKnowledgeAddModal) return;
    setReviewKnowledgeAddModal((prev) => (prev ? { ...prev, file } : prev));
  };

  const handleOpenReviewKnowledgeEdit = (
    type: ReviewKnowledgeItemType,
    item: KnowledgeDocument | KnowledgeFaq,
  ) => {
    if (isReadOnly) return;
    setOpenReviewKnowledgeMenu('');
    setReviewKnowledgeEditModal(
      type === 'document'
        ? {
            type,
            id: item.id,
            title: (item as KnowledgeDocument).title,
            body: (item as KnowledgeDocument).copy,
          }
        : {
            type,
            id: item.id,
            title: (item as KnowledgeFaq).question,
            body: (item as KnowledgeFaq).answer,
          },
    );
  };

  const handleConfirmReviewKnowledgeEdit = () => {
    if (isReadOnly || !reviewKnowledgeEditModal) return;

    const title = reviewKnowledgeEditModal.title.trim();
    const body = reviewKnowledgeEditModal.body.trim();

    if (!title) {
      handleAlert({
        text:
          reviewKnowledgeEditModal.type === 'faq' ? 'Question is required.' : 'Title is required.',
        type: 'warning',
      });
      return;
    }

    if (reviewKnowledgeEditModal.type === 'document') {
      setKnowledgeDocumentSummaries((prev) =>
        prev.map((item) =>
          item.id === reviewKnowledgeEditModal.id ? { ...item, title, copy: body } : item,
        ),
      );
    } else {
      setKnowledgeFaqs((prev) =>
        prev.map((item) =>
          item.id === reviewKnowledgeEditModal.id
            ? { ...item, question: title, answer: body }
            : item,
        ),
      );
    }

    setReviewKnowledgeEditModal(null);
    setStepErrors((prev) => ({ ...prev, knowledgeBase: '' }));
    handleAlert({ text: 'Saved.', type: 'success' });
  };

  const handleDuplicateReviewKnowledgeItem = (
    type: ReviewKnowledgeItemType,
    item: KnowledgeDocument | KnowledgeFaq,
  ) => {
    if (isReadOnly) return;
    setOpenReviewKnowledgeMenu('');

    if (type === 'document') {
      const document = item as KnowledgeDocument;
      setKnowledgeDocumentSummaries((prev) => {
        const index = prev.findIndex((current) => current.id === document.id);
        const next = [...prev];
        next.splice(Math.max(index + 1, 0), 0, {
          ...document,
          id: createLocalId('document'),
          title: `${document.title} (copy)`,
          status: 'Just now',
        });
        return next;
      });
    } else {
      const faq = item as KnowledgeFaq;
      setKnowledgeFaqs((prev) => {
        const index = prev.findIndex((current) => current.id === faq.id);
        const next = [...prev];
        next.splice(Math.max(index + 1, 0), 0, {
          ...faq,
          id: createLocalId('faq'),
          question: `${faq.question} (copy)`,
        });
        return next;
      });
    }

    handleAlert({ text: 'Duplicated.', type: 'success' });
  };

  const handleDeleteReviewKnowledgeItem = (
    type: ReviewKnowledgeItemType,
    item: KnowledgeDocument | KnowledgeFaq,
  ) => {
    if (isReadOnly) return;
    setOpenReviewKnowledgeMenu('');

    const label = type === 'faq' ? 'FAQ' : 'document';
    if (!window.confirm(`Delete this ${label}?`)) return;

    if (type === 'document') {
      setKnowledgeDocumentSummaries((prev) => prev.filter((current) => current.id !== item.id));
    } else {
      setKnowledgeFaqs((prev) => prev.filter((current) => current.id !== item.id));
    }
    handleAlert({ text: 'Deleted.', type: 'success' });
  };

  const handleOpenReviewKnowledgeSource = (
    type: ReviewKnowledgeItemType,
    item: KnowledgeDocument | KnowledgeFaq,
  ) => {
    setOpenReviewKnowledgeMenu('');
    setReviewKnowledgeSourceModal(
      type === 'document'
        ? {
            type,
            title: (item as KnowledgeDocument).title,
            body: (item as KnowledgeDocument).copy,
            source: (item as KnowledgeDocument).source,
            status: (item as KnowledgeDocument).status,
          }
        : {
            type,
            title: (item as KnowledgeFaq).question,
            body: (item as KnowledgeFaq).answer,
            source: (item as KnowledgeFaq).source,
            status: 'Just generated',
          },
    );
  };

  const openModal = (key: keyof typeof modalState) => {
    if (isReadOnly) return;

    setModalState((prev) => ({ ...prev, [key]: true }));
  };
  const closeModal = (key: keyof typeof modalState) => {
    setModalState((prev) => ({ ...prev, [key]: false }));
  };
  const handleOpenForwardDestinationModal = () => {
    if (isReadOnly) return;

    const currentForwardState = cloneForwardCallState(forwardCallState);
    const forwardCallError = getForwardCallValidationError(currentForwardState);
    if (forwardCallError) {
      formInstance.setError(`callRules.forwardCall.${forwardCallError.field}` as any, {
        type: 'manual',
        message: forwardCallError.message,
      });
    } else {
      formInstance.clearErrors([
        'callRules.forwardCall.type',
        'callRules.forwardCall.value',
      ] as any);
    }
    setForwardDestinationSnapshot(currentForwardState);
    setIsForwardDestinationModalOpen(true);
  };
  const handleCancelForwardDestinationEdit = () => {
    if (forwardDestinationSnapshot) {
      setValue('callRules.forwardCall', forwardDestinationSnapshot as any);
      const restoredForwardCallError = getForwardCallValidationError(forwardDestinationSnapshot);
      if (restoredForwardCallError) {
        setStepErrors((prev) => ({ ...prev, forwardCall: restoredForwardCallError.message }));
      } else {
        setStepErrors((prev) => {
          const next = { ...prev };
          delete next.forwardCall;
          return next;
        });
      }
    }
    formInstance.clearErrors(['callRules.forwardCall.type', 'callRules.forwardCall.value'] as any);
    isForwardModalSavingRef.current = false;
    setIsForwardDestinationModalOpen(false);
  };
  const handleForwardDestinationValueChange = (
    name: string,
    value: any,
    options?: SetValueConfig,
  ) => {
    setValue(name as any, value, options);
    if (!name.startsWith('callRules.forwardCall')) return;

    formInstance.clearErrors(['callRules.forwardCall.type', 'callRules.forwardCall.value'] as any);
    setStepErrors((prev) => {
      const next = { ...prev };
      delete next.forwardCall;
      return next;
    });
  };
  const handleSaveForwardDestinationEdit = () => {
    if (isReadOnly) return;

    const latestForwardState = formInstance.getValues('callRules.forwardCall') as ForwardCallState;
    const forwardCallError = getForwardCallValidationError(latestForwardState);
    if (forwardCallError) {
      formInstance.setError(`callRules.forwardCall.${forwardCallError.field}` as any, {
        type: 'manual',
        message: forwardCallError.message,
      });
      setStepErrors((prev) => ({ ...prev, forwardCall: forwardCallError.message }));
      return;
    }

    formInstance.clearErrors(['callRules.forwardCall.type', 'callRules.forwardCall.value'] as any);
    setCommittedForwardState(cloneForwardCallState(latestForwardState));
    setStepErrors((prev) => {
      const next = { ...prev };
      delete next.forwardCall;
      return next;
    });
    isForwardModalSavingRef.current = true;
    setIsForwardDestinationModalOpen(false);
  };
  const toggleSingleDetail = (field: DetailField, checked: boolean) => {
    if (isReadOnly) return;

    if (ALWAYS_ASKED_DETAIL_FIELDS.has(field)) {
      setDetailsToCollect((prev) => ensureAlwaysAskedDetails(prev));
      return;
    }
    setDetailsToCollect((prev) => {
      const next = checked ? [...prev, field] : prev.filter((item) => item !== field);
      return ensureAlwaysAskedDetails(next);
    });
  };

  const buildPayload = (
    knowledgeOverrides?: Partial<{
      textIds: string[];
      urlIds: string[];
      pdfIds: string[];
      generatedTextId: string;
    }>,
    token = '',
  ) => {
    const operational_hours = formInstance.getValues('settings.operational_hours');
    const forwardCall = formInstance.getValues('callRules.forwardCall') as ForwardCallState;
    const forwardDestinationValue = getForwardDestinationValue(forwardCall);
    const selectedManager = [...managerUserList, ...extensionList].find(
      (ext: any) => getManagerExtensionId(ext) === String(selectedManagerId),
    );
    const selectedVoiceForPayload = (() => {
      const voiceCandidates = [
        selectedPersonaObj,
        ...apiVoices,
        ...voiceOptions,
        ...spanishVoiceOptions,
        ...hindiVoiceOptions,
      ].filter(Boolean);
      const matchedVoice = voiceCandidates.find((voice: any) =>
        isVoiceValueMatch(selectedPersona, voice),
      );

      return getVoicePayloadValue(
        matchedVoice,
        selectedPersona || getStoredReceptionistVoice(initialData, builderState) || '',
      );
    })();
    const selectedVoiceGenderForPayload = String(selectedPersonaObj?.gender || '')
      .trim()
      .toLowerCase();
    const runtimeLanguageMode = getVoiceLanguageMode(localeFilter);
    const runtimeLanguage = getVoiceRuntimeLanguage(localeFilter);
    const runtimeAllowedLanguages = getVoiceAllowedLanguages(localeFilter);
    const safeReceptionistName = sanitizeReceptionistName(receptionistName).trim();
    const safeCompanyBrand = sanitizeAiPlainText(companyBrand).trim();
    const safeRoleUseCase = sanitizeAiPlainText(roleUseCase).trim();
    const safeShortDescription = sanitizeAiPlainText(shortDescription).trim();
    const safeSystemPrompt = sanitizeAiPromptText(systemPrompt).trim();
    const safeGreetingText = sanitizeAiPlainText(greetingText).trim();
    const safeMaxSessionDuration = normalizeBoundedInteger(
      maxSessionDuration,
      1,
      MAX_DURATION_SECONDS,
    );
    const safeIdleReminder = normalizeBoundedInteger(idleReminder, 1, MAX_DURATION_SECONDS);
    const safeIdleReminderRetry = normalizeBoundedInteger(
      idleReminderRetry,
      1,
      MAX_IDLE_REMINDER_RETRIES,
    );
    const selectedUseCaseTemplate = useCaseTemplateOptions.find(
      (option) => option.name.toLowerCase() === safeRoleUseCase.toLowerCase(),
    );
    const safeAgentType =
      selectedUseCaseTemplate && !selectedUseCaseTemplate.id.startsWith('current-')
        ? selectedUseCaseTemplate.id
        : initialData?.agentType || 'voice';
    const canPushToCrm = isDataCollectionEnabled && enableCrmPush && Boolean(selectedCrmPipeline);
    const closedHourAction = operational_hours?.closed_hour_action || {};
    const textKnowledgeIds = uniqueStrings([
      ...selectedTextKnowledgeIds,
      ...(knowledgeOverrides?.textIds ?? []),
    ]);
    const urlKnowledgeIds = uniqueStrings([
      ...selectedUrlKnowledgeIds,
      ...(knowledgeOverrides?.urlIds ?? []),
    ]);
    const pdfKnowledgeIds = uniqueStrings([
      ...selectedPdfKnowledgeIds,
      ...(knowledgeOverrides?.pdfIds ?? []),
    ]);
    const summaryText = formatKnowledgeSummaryText(knowledgeDocumentSummaries);
    const generatedKnowledgeText = formatGeneratedKnowledgeText(
      knowledgeFaqs,
      knowledgeDocumentSummaries,
    );
    const generatedKnowledgeBaseId = generatedKnowledgeText
      ? knowledgeOverrides?.generatedTextId || storedGeneratedKnowledgeBaseId
      : '';
    const detailsToCollectPayload = (() => {
      const obj: Record<string, string> = {};
      const fields = isDataCollectionEnabled
        ? ensureAlwaysAskedDetails(detailsToCollect)
        : DISABLED_DATA_COLLECTION_DETAIL_FIELDS;
      fields.forEach((field) => {
        obj[field] = ALWAYS_ASKED_DETAIL_FIELDS.has(field)
          ? 'mandatory'
          : detailsMandatory[field] || 'optional';
      });
      return obj;
    })();

    return {
      widgetKey: widgetKeyRef.current,
      agentName: safeReceptionistName,
      agentType: safeAgentType,
      company: safeCompanyBrand,
      role: safeRoleUseCase,
      description: safeShortDescription,
      systemPrompt: safeSystemPrompt,
      firstMessage: safeGreetingText,
      language: runtimeLanguage,
      languageMode: runtimeLanguageMode,
      allowedLanguages: runtimeAllowedLanguages,
      agentVoice: selectedVoiceForPayload,
      agentVoiceGender: selectedVoiceGenderForPayload,
      text_uuid: textKnowledgeIds,
      url_uuid: urlKnowledgeIds,
      pdf_uuid: pdfKnowledgeIds,
      site_uuid: selectedLocationId !== 'none' ? selectedLocationId : '',
      token,
      forward_call_actions: {
        languageMode: runtimeLanguageMode,
        allowedLanguages: runtimeAllowedLanguages,
        media: {
          hold: { value: '', enabled: false },
          welcome: { value: '', enabled: false },
          voicemail: { value: '', enabled: false },
        },
        manager: selectedManagerId
          ? {
              id: selectedManager?.uuid || selectedManager?.id || selectedManagerId,
              name: `${selectedManager?.first_name || ''} ${selectedManager?.last_name || ''}`.trim(),
              role: getManagerExtensionRole(selectedManager) || 'MANAGER',
              extension: selectedManager?.extension || '',
            }
          : null,
        condition: {
          caller_id: [],
          recording: {
            automatic: {
              label: 'All',
              value: 'all',
              enabled: true,
              recording_on: 'ad98d65d-fcf8-4d4d-bc77-ee1426c34333.mp3',
            },
            on_demand: {
              enabled: true,
              recording_on: 'ad98d65d-fcf8-4d4d-bc77-ee1426c34331.mp3',
              recording_off: 'ad98d65d-fcf8-4d4d-bc77-ee1426c34332.mp3',
            },
          },
          display_number: {
            masking: { type: 'N', label: 'None', value: '' },
            incoming: { label: 'Yes', value: true },
            show_number_if_blocked: 'NO',
          },
          operational_hours: {
            type: operational_hours?.type ?? '24_hours',
            value: operational_hours?.value ?? {},
            holidays: operational_hours?.holidays ?? [],
            regional: operational_hours?.regional ?? {},
            closed_hour_action: {
              type: closedHourAction?.type?.value ?? '',
              value: closedHourAction?.value?.value ?? '',
              enabled: closedHourAction?.enabled ?? false,
              personal: closedHourAction?.personal ?? true,
              type_label: closedHourAction?.type?.label ?? '',
              value_label: closedHourAction?.value?.label ?? '',
            },
          },
        },
        data_agent: {
          data_collection: isDataCollectionEnabled,
          details_to_collect: detailsToCollectPayload,
          crm_sync: canPushToCrm,
          crm: canPushToCrm ? selectedCrmPipeline : '',
        },
        temperature: 'medium',
        idleReminder: safeIdleReminder,
        call_handling: {
          business_hours: {
            type: forwardCall?.type?.value ?? '',
            label: forwardCall?.value?.label ?? '',
            value: forwardDestinationValue,
          },
        },
        transcription: enableTranscripts,
        idleReminderRetry: safeIdleReminderRetry,
        ai_call_monitoring: enableCallMonitoring,
        enableHumanHandoff,
        maxSessionDuration: safeMaxSessionDuration,
        enableCallbackScheduling,
        receptionist_builder: {
          ...builderState,
          draft: false,
          activeStep,
          basics: {
            receptionistName: safeReceptionistName,
            companyBrand: safeCompanyBrand,
            roleUseCase: safeRoleUseCase,
            shortDescription: safeShortDescription,
            systemPrompt: safeSystemPrompt,
          },
          greeting: {
            greetingText: safeGreetingText,
            selectedGreetingType,
          },
          voice: {
            language: runtimeLanguage,
            languageMode: runtimeLanguageMode,
            allowedLanguages: runtimeAllowedLanguages,
            localeFilter,
            persona: selectedPersona,
          },
          knowledge: {
            ...(builderState?.knowledge || {}),
            sourceStage,
            websiteUrl: websiteUrl.trim(),
            extraUrl: extraUrl.trim(),
            customContent,
            selectedPages: selectedLinks.map((url) => ({ url })),
            pendingUrls,
            pendingTextItems: pendingTextItems.map((item) => ({
              id: item.id,
              title: item.title,
              text: item.text,
            })),
            pendingFiles: pendingFiles.map(({ id, file }) => ({
              id,
              name: file.name,
              size: file.size,
            })),
            selectedKnowledgeBase: {
              text: selectedTextKnowledgeIds,
              url: selectedUrlKnowledgeIds,
              pdf: selectedPdfKnowledgeIds,
            },
            generated: {
              summaryText,
              documents: knowledgeDocumentSummaries,
              faqs: knowledgeFaqs,
              generatedKnowledgeText,
              generatedKnowledgeBaseId,
              summarySourceKey: knowledgeSummaryRequestKey,
              faqSourceKey: knowledgeFaqRequestKey,
            },
          },
          advanced: {
            selectedCrmPipeline,
            enableCrmPush,
          },
        },
      },
    };
  };
  const handleFinish = async () => {
    if (isReadOnly || isKnowledgeSummaryNavigationLocked) return;

    const validations = ([1, 2, 3, 4, 5, 6] as ReceptionistStep[]).map((step) => ({
      step,
      errors: validateStep(step),
    }));
    const mergedErrors = validations.reduce(
      (allErrors, validation) => ({ ...allErrors, ...validation.errors }),
      {} as Record<string, string>,
    );
    const firstInvalidStep = validations.find(
      (validation) => Object.keys(validation.errors).length > 0,
    )?.step;

    if (firstInvalidStep) {
      setStepErrors(mergedErrors);
      setActiveStep(firstInvalidStep);
      if (isEdit) setEditTab(stepToTab[firstInvalidStep]);
      scrollToFirstValidationError(mergedErrors);
      return;
    }
    setIsCreatingKnowledgeSources(true);
    try {
      const createdKnowledgeIds = await createPendingKnowledgeSources();
      const payload = buildPayload(
        {
          textIds: createdKnowledgeIds.text,
          urlIds: createdKnowledgeIds.url,
          pdfIds: createdKnowledgeIds.pdf,
          generatedTextId: createdKnowledgeIds.generatedTextId,
        },
        '',
      );
      const receptionistPayload = isEdit ? { ...payload, agentId: receptionistRecordId } : payload;
      if (!isEdit) {
        (receptionistPayload as any).status = 'active';
      }

      await submitReceptionist(receptionistPayload);
    } catch (error: any) {
      console.error('Failed to create receptionist knowledge sources:', error);
      handleAlert({
        text:
          error?.response?.data?.error ||
          error?.message ||
          'Failed to prepare knowledge base sources.',
        type: 'error',
      });
    } finally {
      setIsCreatingKnowledgeSources(false);
    }
  };

  // Use API voices if available, fall back to the language-specific static options.
  const availableVoices = getAvailableReceptionistVoices(apiVoices, selectedLanguage);
  const filteredVoices = useMemo(() => {
    let list = availableVoices;
    if (localeFilter === 'all') {
      list = list.filter((voice: any) => isMultilingualVoice(voice));
    } else {
      list = list.filter((voice: any) => !isMultilingualVoice(voice));
    }
    if (genderFilter !== 'all') {
      list = list.filter((voice: any) => getVoiceGenderFilter(voice) === genderFilter);
    }
    if (localeFilter !== 'all') {
      list = list.filter((v: any) => voiceMatchesLocaleFilter(v, localeFilter));
    }
    if (voiceSearchQuery.trim()) {
      const q = voiceSearchQuery.trim().toLowerCase();
      list = list.filter((v: any) => {
        const name = (v.label || '').toLowerCase();
        const locale = (v.locale || '').toLowerCase();
        const localeAccent = (LOCALE_ACCENT_MAP[v.locale] || '').toLowerCase();
        const shortName = (v.short_name || v.shortName || '').toLowerCase();
        const voiceType = (v.voice_type || '').toLowerCase();
        const value = getVoiceSelectionValue(v).toLowerCase();
        const meta = getVoiceMeta(v.value, v.label);
        const accent = (meta.accent || '').toLowerCase();
        const desc = (meta.description || '').toLowerCase();
        const tags = (meta.tags || []).map((t: string) => t.toLowerCase());
        return (
          name.includes(q) ||
          locale.includes(q) ||
          localeAccent.includes(q) ||
          shortName.includes(q) ||
          voiceType.includes(q) ||
          value.includes(q) ||
          accent.includes(q) ||
          desc.includes(q) ||
          tags.some((t: string) => t.includes(q))
        );
      });
    }
    return list;
  }, [availableVoices, genderFilter, localeFilter, voiceSearchQuery]);
  const selectedVoiceOption = useMemo(
    () => availableVoices.find((voice: any) => isVoiceValueMatch(selectedPersona, voice)) || null,
    [availableVoices, selectedPersona],
  );
  const selectedForwardType = committedForwardState?.type?.value || 'HANGUP';
  const committedShouldShowForwardTo = selectedForwardType !== 'HANGUP';
  const committedForwardTypeLabel = getForwardTypeLabel(selectedForwardType);
  const committedForwardValueLabel =
    selectedForwardType === 'VOICEMAIL' && committedForwardState?.personal
      ? 'My Voicemail'
      : committedForwardState?.value?.label ||
        getForwardDestinationValue(committedForwardState) ||
        '-';

  console.log(committedForwardValueLabel, 'committedForwardValueLabel', committedForwardState);

  const forwardValueFieldLabel = getForwardValueFieldLabel(forwardCallState?.type?.value);
  const editHeaderAgentData = {
    ...initialData,
    agentName: receptionistName || initialData?.agentName,
  };

  const renderFooter = () => {
    if (isReadOnly) return null;

    // The same two buttons the knowledge steps render, so padding and width
    // stay identical wherever the wizard puts a footer.
    return (
      <div className="mt-5 flex items-center justify-between">
        <SecondaryButton
          tone="dark"
          disabled={isKnowledgeSummaryNavigationLocked}
          onClick={activeStep === 1 ? requestWizardLeave : handleBack}
        >
          <ArrowLeft className="h-4 w-4" />
          {activeStep === 1 ? 'Cancel' : 'Back'}
        </SecondaryButton>
        <PrimaryButton
          tone="dark"
          disabled={
            isSubmitting ||
            isPendingToken ||
            isCreatingKnowledgeSources ||
            (activeStep === 2 && isLoadingVoices) ||
            isKnowledgeSummaryNavigationLocked
          }
          onClick={handleContinue}
        >
          {activeStep === 6
            ? isCreatingKnowledgeSources
              ? 'Preparing knowledge...'
              : isSubmitting || isPendingToken
                ? 'Saving...'
                : isEdit
                  ? 'Update Receptionist'
                  : 'Create Receptionist'
            : 'Continue'}
          <ArrowRight className="h-4 w-4" />
        </PrimaryButton>
      </div>
    );
  };

  const renderBasicsStep = () => (
    <div className="mx-auto flex w-full max-w-[1140px] flex-col gap-3">
      <div>
        <h2 className="text-lg font-bold tracking-normal text-neutral-950">
          What kind of receptionist do you need?
        </h2>
        <p className="mt-0.5 text-sm leading-5 text-neutral-500">
          Configure the receptionist for your business. You can change everything later.
        </p>
      </div>
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2 lg:items-stretch">
      <div className="flex flex-col gap-3">
      <div className="rounded-2xl border-[1.5px] border-neutral-200 bg-white p-4 shadow-[0_1px_2px_rgba(0,0,0,.03)]">
        <h3 className="flex items-center gap-2 text-[17px] font-bold text-neutral-950">
          <User className="h-4 w-4 shrink-0 text-red-600" strokeWidth={2.25} />
          Identity
        </h3>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <Field
            label="Receptionist name *"
            error={stepErrors.receptionistName}
            fieldKey="receptionistName"
          >
            <input
              value={receptionistName}
              onChange={(event) => {
                setReceptionistName(sanitizeReceptionistName(event.target.value));
                setStepErrors((prev) => ({ ...prev, receptionistName: '' }));
              }}
              maxLength={MAX_RECEPTIONIST_NAME_LENGTH}
              placeholder="Reception Desk Assistant"
              className="h-10 w-full rounded-xl border border-neutral-300 px-3 text-sm outline-none! transition-colors focus:border-neutral-400 focus:ring-4 focus:ring-neutral-100"
            />
            <div className="mt-1 flex min-h-4 items-center justify-between gap-2 text-[11px]">
              <span
                className={
                  receptionistName.length === MAX_RECEPTIONIST_NAME_LENGTH
                    ? 'text-amber-600'
                    : 'text-neutral-400'
                }
              >
                {receptionistName.length === MAX_RECEPTIONIST_NAME_LENGTH
                  ? 'Maximum name length reached.'
                  : 'Letters, numbers, and spaces only.'}
              </span>
              <span
                className={
                  receptionistName.length === MAX_RECEPTIONIST_NAME_LENGTH
                    ? 'font-semibold text-amber-600'
                    : 'text-neutral-400'
                }
              >
                {receptionistName.length}/{MAX_RECEPTIONIST_NAME_LENGTH}
              </span>
            </div>
          </Field>
          <Field label="Company / Brand *" error={stepErrors.companyBrand} fieldKey="companyBrand">
            <input
              value={companyBrand}
              onChange={(event) => {
                setCompanyBrand(sanitizeAiPlainText(event.target.value));
                setStepErrors((prev) => ({ ...prev, companyBrand: '' }));
              }}
              placeholder="e.g. Example Business"
              className={cx(
                'h-10 w-full rounded-xl border px-3 text-sm outline-none! transition-colors focus:border-neutral-400 focus:ring-4 focus:ring-neutral-100',
                stepErrors.companyBrand ? 'border-red-400' : 'border-neutral-300',
              )}
            />
          </Field>
        </div>
        <Field label="Use case" className="mt-4">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                disabled={isReadOnly || isLoadingUseCaseTemplates}
                className="flex h-10 w-full items-center justify-between rounded-xl border! border-neutral-300! bg-white! px-3 text-sm outline-none! transition-colors disabled:cursor-not-allowed disabled:bg-neutral-50 disabled:text-neutral-600"
              >
                <span className={roleUseCase ? 'text-neutral-900!' : 'text-neutral-400!'}>
                  {roleUseCase ||
                    (isLoadingUseCaseTemplates ? 'Loading templates...' : 'Select a template')}
                </span>
                <ChevronDown className="h-3.5 w-3.5 shrink-0 opacity-60" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="start"
              className="[&_[data-slot=dropdown-menu-item]]:focus:text-neutral-900! flex w-[var(--radix-dropdown-menu-trigger-width)] max-h-[320px] flex-col gap-1 overflow-y-auto rounded-xl! border! border-neutral-200! bg-white p-1.5 shadow-lg z-50 animate-none"
            >
              {useCaseTemplateOptions.map((option) => {
                const isSelected = option.name === roleUseCase;
                return (
                  <DropdownMenuItem
                    key={option.id}
                    onClick={() => {
                      setRoleUseCase(option.name);
                      if (option.welcomeGreeting) {
                        setGreetingText(sanitizeAiPlainText(option.welcomeGreeting));
                        setSelectedGreetingType('custom');
                        setStepErrors((prev) => ({ ...prev, greetingText: '' }));
                      }
                      setSystemPrompt(
                        option.systemPrompt ? sanitizeAiPromptText(option.systemPrompt) : '',
                      );
                      setStepErrors((prev) => ({ ...prev, systemPrompt: '' }));
                    }}
                    className={cx(
                      'flex cursor-pointer items-center justify-between gap-2 rounded-lg px-3 py-2.5 text-sm font-medium',
                      isSelected
                        ? 'bg-red-50! text-neutral-900! font-semibold'
                        : 'text-neutral-900 hover:bg-[#f3f4f6]! focus:bg-[#f3f4f6]!',
                    )}
                  >
                    <span className="truncate">{option.name}</span>
                    {isSelected && <Check className="h-3.5 w-3.5 shrink-0 text-red-600!" />}
                  </DropdownMenuItem>
                );
              })}
            </DropdownMenuContent>
          </DropdownMenu>
        </Field>
        <Field label="Short description (internal only)" className="mt-3">
          <input
            value={shortDescription}
            onChange={(event) => setShortDescription(sanitizeAiPlainText(event.target.value))}
            placeholder="What does this receptionist do?"
            className="h-10 w-full rounded-xl border border-neutral-300 px-3 text-sm outline-none! transition-colors focus:border-neutral-400 focus:ring-4 focus:ring-neutral-100"
          />
        </Field>
      </div>
      <AgentSiteSelection
        sites={sites}
        selectedSiteId={selectedLocationId}
        onChange={(siteId) => {
          setSelectedLocationId(siteId);
          setStepErrors((prev) => ({ ...prev, siteLocation: '' }));
        }}
        error={stepErrors.siteLocation}
        disabled={isReadOnly}
        isLoading={isLoadingSites}
      />
      </div>
      <div className="flex h-full flex-col rounded-2xl border-[1.5px] border-neutral-200 bg-white p-4 shadow-[0_1px_2px_rgba(0,0,0,.03)]">
        <h3 className="flex items-center gap-2 text-[17px] font-bold text-neutral-950">
          <Bot className="h-4 w-4 shrink-0 text-red-600" strokeWidth={2.25} />
          System prompt
        </h3>
        <p className="mt-0.5 truncate text-xs text-neutral-500">
          Master instructions the AI follows. Auto-filled by your template.
        </p>
        <Field
          error={stepErrors.systemPrompt}
          fieldKey="systemPrompt"
          className="mt-3 flex! flex-1! flex-col!"
        >
          <textarea
            value={systemPrompt}
            onChange={(event) => {
              setSystemPrompt(sanitizeAiPromptText(event.target.value));
              setStepErrors((prev) => ({ ...prev, systemPrompt: '' }));
            }}
            className="w-full flex-1 min-h-[104px] resize-y rounded-xl border border-neutral-300 p-3 text-sm outline-none! transition-colors focus:border-neutral-400 focus:ring-4 focus:ring-neutral-100"
          />
        </Field>
        <div className="mt-2 flex items-start gap-1.5 rounded-lg border border-red-100 bg-red-50 px-2.5 py-1.5">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-red-600" />
          <p className="text-xs text-neutral-800">
            Tip: short prompts work better — tell the AI WHO it is, WHAT it does, and 1–2 hard rules.
          </p>
        </div>
      </div>
      </div>
      {renderFooter()}
    </div>
  );

  const renderVoiceStep = () => (
    <div
      className="mx-auto flex w-full max-w-[1140px] flex-col gap-6 scroll-mt-24"
      data-validation-key="selectedPersona"
    >
      <div className="flex items-center justify-between gap-6">
        <div>
          <h2 className="flex items-center gap-1.5 text-lg font-bold tracking-normal text-neutral-950">
            Voice &amp; persona
            <CustomTooltip
              side="top"
              text="Pick the voice and personality that answers every call. Every voice auto-detects the caller's language, so there's nothing extra to configure."
              className="w-max max-w-[340px] border-none! bg-[#fdf7f5]! text-black! shadow-[0_6px_20px_rgba(17,17,17,0.18)]! [&_svg]:fill-[#fdf7f5]"
            >
              <Info className="h-4 w-4 cursor-help text-neutral-400" />
            </CustomTooltip>
          </h2>
          <p className="mt-0.5 text-sm leading-5 text-neutral-500 whitespace-nowrap">
            Pick the persona that matches your brand — tap ► to hear a live preview.
          </p>
        </div>
        <div className="flex shrink-0 items-start gap-8">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500">
              AI Voices
            </div>
            <div className="text-xl font-extrabold text-red-600">
              {availableVoices?.length || 0}
            </div>
          </div>
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500">
              Languages
            </div>
            <div className="text-xl font-extrabold text-neutral-950">50+</div>
          </div>
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500">
              Detected
            </div>
            <div className="text-xl font-extrabold text-neutral-950">Auto</div>
          </div>
        </div>
      </div>

      {/* Voice persona card */}
      <div className="rounded-2xl border-[1.5px] border-neutral-200 bg-white p-5 shadow-[0_1px_2px_rgba(0,0,0,.03)]">
        {/* Search and Filters Header */}
        <div className="flex flex-col gap-3">
          {/* Search + Filters row */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-2">
            {/* Search Input */}
            <div className="flex h-10 min-w-0 flex-1 items-center gap-2 rounded-full border! border-neutral-200! bg-white! pl-2 pr-3 shadow-[0_1px_2px_rgba(0,0,0,.03)] transition-all focus-within:border-neutral-400!">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-red-600">
                <Search className="h-[18px] w-[18px]" strokeWidth={2.25} />
              </span>
              <input
                type="text"
                value={voiceSearchQuery}
                onChange={(e) => setVoiceSearchQuery(sanitizeAiSearchText(e.target.value))}
                placeholder="Search by name, accent, or style..."
                className="min-w-0 flex-1 border-none bg-transparent text-sm text-neutral-900 outline-none! placeholder:text-neutral-400"
              />
            </div>

            {/* Gender Filter Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-full border! border-neutral-200! bg-white! px-5 text-sm font-semibold text-neutral-700! shadow-[0_1px_2px_rgba(0,0,0,.03)] transition-colors hover:border-red-300!"
                >
                  Gender: {GENDER_FILTER_OPTIONS.find((opt) => opt.key === genderFilter)?.label}
                  <ChevronDown className="h-3.5 w-3.5 opacity-60" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="start"
                className="[&_[data-slot=dropdown-menu-item]]:focus:text-neutral-900! flex w-[200px] max-h-[280px] flex-col gap-1 overflow-y-auto bg-white border! border-neutral-200! shadow-lg rounded-xl! p-1.5 z-50 animate-none"
              >
                {GENDER_FILTER_OPTIONS.map((opt) => {
                  const isSelected = opt.key === genderFilter;
                  return (
                    <DropdownMenuItem
                      key={opt.key}
                      onClick={() => setGenderFilter(opt.key)}
                      className={cx(
                        'flex cursor-pointer items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-xs font-medium',
                        isSelected
                        ? 'bg-red-50! text-neutral-900! font-semibold'
                        : 'text-neutral-900 hover:bg-[#f3f4f6]! focus:bg-[#f3f4f6]!',
                      )}
                    >
                      <span className="truncate">{opt.label}</span>
                      {isSelected && <Check className="h-3.5 w-3.5 shrink-0 text-red-600!" />}
                    </DropdownMenuItem>
                  );
                })}
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Locale Filter Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-full border! border-neutral-200! bg-white! px-5 text-sm font-semibold text-neutral-700! shadow-[0_1px_2px_rgba(0,0,0,.03)] transition-colors hover:border-red-300!"
                >
                  {LOCALE_FILTER_OPTIONS.find((opt) => opt.key === localeFilter)?.label}
                  <ChevronDown className="h-3.5 w-3.5 opacity-60" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="start"
                className="[&_[data-slot=dropdown-menu-item]]:focus:text-neutral-900! flex w-[200px] max-h-[280px] flex-col gap-1 overflow-y-auto bg-white border! border-neutral-200! shadow-lg rounded-xl! p-1.5 z-50 animate-none"
              >
                {LOCALE_FILTER_OPTIONS.map((opt) => {
                  const isSelected = opt.key === localeFilter;
                  return (
                    <DropdownMenuItem
                      key={opt.key}
                      onClick={() => setLocaleFilter(opt.key)}
                      className={cx(
                        'flex cursor-pointer items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-xs font-medium',
                        isSelected
                        ? 'bg-red-50! text-neutral-900! font-semibold'
                        : 'text-neutral-900 hover:bg-[#f3f4f6]! focus:bg-[#f3f4f6]!',
                      )}
                    >
                      <span className="truncate">{opt.label}</span>
                      {isSelected && <Check className="h-3.5 w-3.5 shrink-0 text-red-600!" />}
                    </DropdownMenuItem>
                  );
                })}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Selected voice pill */}
          {selectedVoiceOption && (
            <div>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-red-100 bg-white px-3 py-1.5 text-xs font-semibold text-neutral-700 shadow-[0_1px_2px_rgba(0,0,0,.03)]">
                Selected voice ·{' '}
                <span className="font-bold text-red-600">{selectedVoiceOption.label}</span>
              </span>
            </div>
          )}
        </div>

        {stepErrors.selectedPersona && (
          <p className="mt-3 text-sm font-medium text-red-500">{stepErrors.selectedPersona}</p>
        )}

        {/* Grid of Voice Cards */}
        <div className="mt-4 min-h-[400px] max-h-[520px] overflow-y-auto pr-1">
          {isLoadingVoices ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="rounded-2xl border border-neutral-100 bg-white p-5 shadow-sm animate-pulse min-h-[190px] flex flex-col gap-3"
              >
                <div className="flex items-center justify-between">
                  <div className="h-4 w-20 bg-neutral-200 rounded" />
                  <div className="h-4 w-12 bg-neutral-100 rounded" />
                </div>
                <div className="h-3 w-28 bg-neutral-100 rounded" />
                <div className="flex gap-1.5">
                  <div className="h-4 w-12 bg-neutral-100 rounded" />
                  <div className="h-4 w-14 bg-neutral-100 rounded" />
                  <div className="h-4 w-10 bg-neutral-100 rounded" />
                </div>
                <div className="h-8 w-full bg-neutral-100 rounded" />
                <div className="mt-auto h-9 w-9 bg-neutral-200 rounded-full" />
              </div>
            ))}
          </div>
        ) : filteredVoices.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-12 bg-white rounded-2xl border border-neutral-100 text-center">
            <div className="bg-neutral-50 p-3 rounded-full text-neutral-400 mb-3">
              <Search className="h-6 w-6" />
            </div>
            <h4 className="text-sm font-bold text-neutral-900">No voices found</h4>
            <p className="text-xs text-neutral-500 mt-1 max-w-[280px]">
              We couldn't find any voices matching your filters or search. Try adjusting them!
            </p>
          </div>
        ) : (
          <div className="max-h-[455px] overflow-y-auto pr-1">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {filteredVoices.map((voice: any, voiceIndex: number) => {
              const voiceValue = getVoiceSelectionValue(voice);
              const selected = isVoiceValueMatch(selectedPersona, voice);
              const playing = isPlaying && currentAudio === voiceValue;
              const meta = getVoiceMeta(voiceValue, voice.label);
              const accentDisplay =
                (voice.locale && LOCALE_ACCENT_MAP[voice.locale]) || meta.accent;

              return (
                <div
                  key={voiceValue || `${voice.label}-${voiceIndex}`}
                  role={isReadOnly ? undefined : 'button'}
                  tabIndex={isReadOnly ? undefined : 0}
                  aria-pressed={selected}
                  onClick={() => handleSelectVoice(voice)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      handleSelectVoice(voice);
                    }
                  }}
                  className={cx(
                    'relative rounded-2xl border bg-white p-5 text-left transition-all duration-200 cursor-pointer shadow-sm flex flex-col justify-between min-h-[190px]',
                    selected
                      ? 'border-neutral-400'
                      : 'border-neutral-200 hover:border-neutral-300 hover:shadow-md',
                  )}
                >
                  <div>
                    {/* Header Row: Title & Gender Tag */}
                    <div className="flex items-center justify-between">
                      <span className="text-base font-bold text-neutral-900 capitalize">
                        {voice.label}
                      </span>
                      <div className="flex items-center gap-1.5">
                        <span
                          className={cx(
                            'px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider',
                            voice.gender === 'female'
                              ? 'bg-rose-50 text-rose-600 border border-rose-100'
                              : 'bg-neutral-100 text-neutral-600 border border-neutral-200',
                          )}
                        >
                          {voice.gender}
                        </span>
                      </div>
                    </div>

                    {/* Accent Line */}
                    <p className="text-xs text-neutral-500 mt-1">
                      {accentDisplay}
                      {voice.locale && voice.locale !== 'en-US' ? ` · ${voice.locale}` : ''}
                    </p>

                    {/* Tags Row */}
                    <div className="flex flex-wrap gap-1.5 mt-2.5">
                      {meta.tags.map((tag: string) => (
                        <span
                          key={tag}
                          className="bg-neutral-50 text-neutral-600 text-[10px] font-semibold px-2 py-0.5 rounded border border-neutral-100"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>

                    {/* Description Paragraph */}
                    <p className="text-xs text-neutral-600 mt-3 leading-relaxed">{meta.description}</p>
                  </div>

                  {/* Bottom Left Play Button */}
                  <div className="mt-4 flex justify-between items-center">
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        void handlePlayPause(voice);
                      }}
                      className={cx(
                        'w-9 h-9 rounded-full flex items-center justify-center text-white transition-transform hover:scale-105 active:scale-95 shadow-sm',
                        playing ? 'bg-neutral-700!' : 'bg-neutral-900!',
                      )}
                    >
                      {playing ? (
                        <span className="flex h-3.5 items-end gap-[2px]">
                          <span className="w-[2.5px] rounded-full bg-white animate-bounce [animation-duration:0.7s] [animation-delay:0ms] h-[35%]" />
                          <span className="w-[2.5px] rounded-full bg-white animate-bounce [animation-duration:0.7s] [animation-delay:120ms] h-full" />
                          <span className="w-[2.5px] rounded-full bg-white animate-bounce [animation-duration:0.7s] [animation-delay:240ms] h-[60%]" />
                          <span className="w-[2.5px] rounded-full bg-white animate-bounce [animation-duration:0.7s] [animation-delay:80ms] h-[80%]" />
                        </span>
                      ) : (
                        <Play className="h-3.5 w-3.5 fill-white text-white stroke-none" />
                      )}
                    </button>
                    <button
                      type="button"
                      disabled={isReadOnly}
                      onClick={(event) => {
                        event.stopPropagation();
                        handleSelectVoice(voice);
                      }}
                      className={cx(
                        'flex items-center justify-center outline-none! transition-all duration-300 ease-out',
                        selected
                          ? 'h-8 w-8 rounded-full border! border-red-600! bg-red-50! text-red-600! scale-100'
                          : 'h-8 gap-1.5 rounded-full border! border-neutral-300! bg-white! px-3 text-xs font-semibold text-neutral-700! hover:border-black! hover:scale-105 active:scale-95',
                      )}
                    >
                      {selected ? (
                        <Check
                          key="selected-check"
                          className="h-4 w-4 animate-in zoom-in-50 spin-in-45 duration-300 ease-out"
                          strokeWidth={2.5}
                        />
                      ) : (
                        'Select'
                      )}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
          </div>
        )}
        </div>
      </div>

      {renderFooter()}
    </div>
  );

  const renderGreetingHoursStep = () => {
    const timezone = (operationalHours?.regional?.timezone as any)?.value || '';
    const displayHours =
      operationalHours?.type === '24_hours'
        ? `24 Hours${timezone ? ` (${timezone})` : ''}`
        : getWeeklyScheduleName(operationalHours?.value) || 'Not configured';
    const customDays = ((operationalHours?.holidays || []) as any[]).filter(
      (holiday) => holiday?.title || holiday?.from,
    );
    const formatCustomDayRange = (from?: string, to?: string) => {
      if (!from) return '';
      const start = moment(from);
      if (!start.isValid()) return '';
      const end = to ? moment(to) : start;
      if (!end.isValid() || start.isSame(end, 'day')) return start.format('MMM D');
      return `${start.format('MMM D')} – ${end.format('MMM D')}`;
    };

    const openingLineCard = (
      <div className="rounded-2xl border-[1.5px] border-neutral-200 bg-white p-4 shadow-[0_1px_2px_rgba(0,0,0,.03)]">
        <h3 className="flex items-center gap-2 text-[17px] font-bold text-neutral-950">
          <MessageSquare className="h-4 w-4 shrink-0 text-red-600" strokeWidth={2.25} />
          Opening line
        </h3>
        <Field
          error={stepErrors.greetingText}
          fieldKey="greetingText"
          className="mt-4"
        >
          <textarea
            value={greetingText}
            onChange={(event) => {
              setGreetingText(sanitizeAiPlainText(event.target.value));
              setStepErrors((prev) => ({ ...prev, greetingText: '' }));
              setSelectedGreetingType('custom');
            }}
            className="min-h-[84px] w-full resize-y rounded-xl border border-neutral-300 p-3 text-sm outline-none! transition-colors focus:border-neutral-400 focus:ring-4 focus:ring-neutral-100"
          />
          <div className="mt-2.5 flex flex-nowrap items-center gap-1.5 overflow-x-auto text-xs">
            <span className="shrink-0 text-neutral-600 font-semibold mr-0.5">Try:</span>
            <button
              type="button"
              onClick={() => handleSelectGreetingType('friendly')}
              className={cx(
                'h-7 shrink-0 whitespace-nowrap rounded-full border px-2.5 text-[11px] font-semibold cursor-pointer transition-colors',
                selectedGreetingType === 'friendly'
                  ? 'border-red-600 bg-red-50 text-red-600'
                  : 'border-neutral-200 bg-white text-neutral-600 hover:border-red-300',
              )}
            >
              Friendly greeting
            </button>
            <button
              type="button"
              onClick={() => handleSelectGreetingType('professional')}
              className={cx(
                'h-7 shrink-0 whitespace-nowrap rounded-full border px-2.5 text-[11px] font-semibold cursor-pointer transition-colors',
                selectedGreetingType === 'professional'
                  ? 'border-red-600 bg-red-50 text-red-600'
                  : 'border-neutral-200 bg-white text-neutral-600 hover:border-red-300',
              )}
            >
              Professional intro
            </button>
            <button
              type="button"
              onClick={() => handleSelectGreetingType('triage')}
              className={cx(
                'h-7 shrink-0 whitespace-nowrap rounded-full border px-2.5 text-[11px] font-semibold cursor-pointer transition-colors',
                selectedGreetingType === 'triage'
                  ? 'border-red-600 bg-red-50 text-red-600'
                  : 'border-neutral-200 bg-white text-neutral-600 hover:border-red-300',
              )}
            >
              Quick triage
            </button>
            <button
              type="button"
              onClick={() => handleSelectGreetingType('holiday')}
              className={cx(
                'h-7 shrink-0 whitespace-nowrap rounded-full border px-2.5 text-[11px] font-semibold cursor-pointer transition-colors',
                selectedGreetingType === 'holiday'
                  ? 'border-red-600 bg-red-50 text-red-600'
                  : 'border-neutral-200 bg-white text-neutral-600 hover:border-red-300',
              )}
            >
              Holiday message
            </button>
          </div>
        </Field>
      </div>
    );

    const businessHoursCard = (
      <div className="rounded-2xl border-[1.5px] border-neutral-200 bg-white p-4 shadow-[0_1px_2px_rgba(0,0,0,.03)]">
        <div className="flex items-baseline gap-1.5">
          <h3 className="flex items-center gap-2 text-[17px] font-bold text-neutral-950">
            <Clock3 className="h-4 w-4 shrink-0 text-red-600" strokeWidth={2.25} />
            Business hours
          </h3>
          <span className="text-xs text-neutral-400 font-normal">(optional)</span>
          <CustomTooltip
            side="top"
            text="After hours are handled automatically. Outside the hours you set, your receptionist tells callers you're closed and offers to schedule a callback with the assigned manager."
            className="w-max max-w-[340px] border-none! bg-[#fdf7f5]! text-black! shadow-[0_6px_20px_rgba(17,17,17,0.18)]! [&_svg]:fill-[#fdf7f5]"
          >
            <Info className="h-4 w-4 cursor-help text-neutral-400" />
          </CustomTooltip>
        </div>
        <p className="mt-1 text-xs text-neutral-500">
          Set when your{' '}
          <span className="font-semibold text-neutral-700">human agents are online</span> to
          take calls. During these hours the AI can transfer callers to a live agent.
        </p>

        <div
          className={cx(
            'mt-3 flex items-center justify-between gap-4 rounded-lg border p-3',
            bussinessHourError
              ? 'border-red-200 bg-red-50/60'
              : 'border-neutral-200 bg-neutral-50/60',
          )}
        >
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-wider text-neutral-400">
              {bussinessHourError ? 'Needs attention' : 'Current schedule'}
            </p>
            <p
              className={cx(
                'truncate text-sm font-bold',
                bussinessHourError ? 'text-red-600' : 'text-neutral-900',
              )}
            >
              {bussinessHourError || displayHours}
            </p>
            {!bussinessHourError && customDays.length > 0 && (
              <p className="truncate text-sm text-neutral-500">
                {customDays.slice(0, 2).map((holiday: any, index: number) => (
                  <span key={index}>
                    {index > 0 && ', '}
                    {holiday?.title || 'Custom day'}
                      {holiday?.from && ` (${formatCustomDayRange(holiday.from, holiday.to)})`}
                    </span>
                  ))}
                {customDays.length > 2 && ` +${customDays.length - 2} more`}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={() => openModal('bussinessHoursModal')}
            className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full border! border-neutral-300! bg-white! px-3.5 text-xs font-semibold text-neutral-700 outline-none! transition-all duration-150 hover:-translate-y-0.5 hover:border-red-300! hover:text-neutral-900"
          >
            <Edit3 className="h-3.5 w-3.5" />
            {operationalHours?.type ? 'Edit' : 'Set business hours'}
          </button>
        </div>
      </div>
    );

    const businessHoursBehaviorCard = (
      <div className="rounded-2xl border-[1.5px] border-neutral-200 bg-white p-4 shadow-[0_1px_2px_rgba(0,0,0,.03)]">
        <h3 className="flex items-center gap-2 text-[17px] font-bold text-neutral-950">
          <PhoneCall className="h-4 w-4 shrink-0 text-red-600" strokeWidth={2.25} />
          Business hours behavior
        </h3>
        <p className="mt-1 text-xs text-neutral-500">
          Choose what happens when callers reach you during business hours.
        </p>

        <div className="mt-3 flex items-start justify-between gap-4 rounded-lg border border-neutral-200 bg-neutral-50 p-3">
          <div className="flex-1 text-left">
            <p className="text-sm font-semibold text-neutral-900">Enable human handoff</p>
            <p className="mt-1 text-xs text-neutral-500 leading-normal">
              When ON, the AI can forward business-hours calls to the selected destination.
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={enableHumanHandoff}
            disabled={isReadOnly}
            onClick={() => {
              const enabled = !enableHumanHandoff;
              setEnableHumanHandoff(enabled);
              if (!enabled) {
                setStepErrors((prev) => ({ ...prev, forwardCall: '' }));
              }
            }}
            className={cx(
              'relative mt-1 inline-flex h-6 w-11 shrink-0 items-center rounded-full outline-none! transition-colors disabled:cursor-not-allowed disabled:opacity-50',
              enableHumanHandoff ? 'bg-red-600!' : 'bg-neutral-200!',
            )}
          >
            <span
              className={cx(
                'inline-block h-5 w-5 rounded-full bg-white shadow-sm transition-transform',
                enableHumanHandoff ? 'translate-x-[22px]' : 'translate-x-0.5',
              )}
            />
          </button>
        </div>

        {enableHumanHandoff && (
          <div
            className="mt-3 rounded-lg border border-neutral-200 bg-neutral-50/50 p-3"
            data-validation-key="forwardCall"
          >
            <div className="flex items-center justify-between gap-4">
              <div className="grid grid-cols-2 gap-8 flex-1">
                <div>
                  <p className="text-[10px] uppercase font-bold tracking-wider text-neutral-400">
                    Forward Type
                  </p>
                  <p className="mt-1 text-sm font-bold text-neutral-900">
                    {committedForwardTypeLabel}
                  </p>
                </div>
                {committedShouldShowForwardTo && (
                  <div>
                    <p className="text-[10px] uppercase font-bold tracking-wider text-neutral-400">
                      {getForwardValueFieldLabel(selectedForwardType)}
                    </p>
                    <p className="mt-1 flex items-center gap-1 text-sm font-bold text-neutral-900">
                      {committedForwardValueLabel}
                      {
                        selectedForwardType === 'EXTENSION' &&
                        committedForwardState?.value?.value ? (
                          <span className="inline-flex items-center gap-1 font-normal text-neutral-500 ml-2">
                            <Grid className="h-3.5 w-3.5 text-neutral-400" />
                            {committedForwardState.value.value}
                          </span>
                        ) : (
                          ''
                        )
                      }
                    </p>
                  </div>
                )}
              </div>
              <button
                type="button"
                onClick={handleOpenForwardDestinationModal}
                className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border! border-neutral-300! bg-white! px-3.5 text-xs font-semibold text-neutral-700 outline-none! transition-all duration-150 hover:-translate-y-0.5 hover:border-red-300! hover:text-neutral-900"
              >
                <Edit3 className="h-3.5 w-3.5" />
                Edit
              </button>
            </div>
          </div>
        )}
        {enableHumanHandoff && stepErrors.forwardCall && (
          <p className="mt-3 text-sm text-red-500">{stepErrors.forwardCall}</p>
        )}
      </div>
    );

    const managerConfigCard = (
      <div className="rounded-2xl border-[1.5px] border-neutral-200 bg-white p-4 shadow-[0_1px_2px_rgba(0,0,0,.03)]">
        <h3 className="flex items-center gap-2 text-[17px] font-bold text-neutral-950">
          <UserRound className="h-4 w-4 shrink-0 text-red-600" strokeWidth={2.25} />
          Manager configuration
        </h3>
        <p className="mt-1 text-xs text-neutral-500">
          Choose who receives caller details for every scheduled callback.
        </p>

        <div className="mt-3 flex items-start justify-between gap-4 rounded-lg border border-neutral-200 bg-neutral-50 p-3">
          <div className="flex-1 text-left">
            <p className="text-sm font-semibold text-neutral-900">Enable callback scheduling</p>
            <p className="mt-1 text-xs text-neutral-500 leading-normal">
              When ON, the AI can offer to schedule a callback during a call and pass the
              request to a manager. When OFF, the manager picker below is locked — the AI will
              only take voicemails for follow-up.
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={enableCallbackScheduling}
            disabled={isReadOnly}
            onClick={() => {
              const enabled = !enableCallbackScheduling;
              setEnableCallbackScheduling(enabled);
              if (!enabled) {
                setStepErrors((prev) => ({ ...prev, manager: '' }));
              }
            }}
            className={cx(
              'relative mt-1 inline-flex h-6 w-11 shrink-0 items-center rounded-full outline-none! transition-colors disabled:cursor-not-allowed disabled:opacity-50',
              enableCallbackScheduling ? 'bg-red-600!' : 'bg-neutral-200!',
            )}
          >
            <span
              className={cx(
                'inline-block h-5 w-5 rounded-full bg-white shadow-sm transition-transform',
                enableCallbackScheduling ? 'translate-x-[22px]' : 'translate-x-0.5',
              )}
            />
          </button>
        </div>

        <div className="mt-3 scroll-mt-24" data-validation-key="manager">
          <span className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-neutral-500">
            <UserRound className="h-3.5 w-3.5" />
            Manager who owns callbacks & escalations
          </span>
          {/* react-select portals its menu to <body>, so a wrapper class never
              reaches the menu or its options - the theme's primary colour shows
              through as a coloured border. inputClass stamps this class onto
              every sub-component, portal included, so the rules below can land. */}
          <style>{MANAGER_SELECT_STYLE}</style>
          <CustomSelect
            className="neutral-focus-select"
            inputClass="ai-manager-select"
            isDisabled={!enableCallbackScheduling || isReadOnly}
            value={selectedManagerOption}
            handleChange={(option: any) => {
              setSelectedManagerId(option?.value || '');
              setStepErrors((prev) => ({ ...prev, manager: '' }));
            }}
            options={managerOptions}
            placeholder="Select a manager"
            error={stepErrors.manager}
            isLoading={isLoadingManagerUsers || isFetchingNextManagerPage}
            onInputChange={setManagerSearch}
            onMenuScrollToBottom={() => {
              if (hasNextManagerPage && !isFetchingNextManagerPage) {
                void fetchNextManagerPage();
              }
            }}
            FormatOptionLabel={({ option }: any) => (
              <div className="flex w-full items-center justify-between">
                <div>{option?.label}</div>
                {option?.extension && (
                  <div className="flex items-center gap-1">
                    <Grid className="w-4 h-4" />
                    {option?.extension || ''}
                  </div>
                )}
              </div>
            )}
          />
          {stepErrors.manager && (
            <p className="mt-1.5 text-xs font-medium text-red-500" role="alert">
              {stepErrors.manager}
            </p>
          )}
        </div>
      </div>
    );

    return (
      <div className="mx-auto flex w-full max-w-[1140px] flex-col gap-3">
        <div>
          <h2 className="text-lg font-bold tracking-normal text-neutral-950">
            Opening line & business hours
          </h2>
          <p className="mt-0.5 text-sm leading-5 text-neutral-500">
            Tell the receptionist what to say first, and when it should answer.
          </p>
        </div>
        <div
          className={
            selectedLocationId !== 'none' ? 'grid grid-cols-1 gap-3 lg:grid-cols-2 lg:items-stretch' : ''
          }
        >
          {openingLineCard}
          {selectedLocationId !== 'none' && (
            <>
              {businessHoursCard}
              {businessHoursBehaviorCard}
              {managerConfigCard}
            </>
          )}
        </div>
        {renderFooter()}
      </div>
    );
  };

  const renderKnowledgeStep = () => {
    if (sourceStage === 1) {
      if (knowledgeWebsiteMode === 'picker') {
        return (
          <div className="mx-auto flex w-full max-w-[880px] flex-col gap-4">
            <div>
              <h2 className="text-lg font-bold tracking-normal text-neutral-950">
                Knowledge — your website
              </h2>
              <p className="mt-0.5 max-w-[760px] text-sm leading-5 text-neutral-500">
                Pick an existing knowledge base, or create a new one by scanning your website. AI
                turns pages and documents into Documents &amp; FAQs.
              </p>
            </div>

            <div className="flex items-center justify-between gap-4 rounded-2xl border-2 border-slate-300 bg-white px-6 py-5 text-neutral-950">
              <div className="flex min-w-0 items-center gap-4">
                <div className="grid h-[52px] w-[52px] shrink-0 place-items-center rounded-xl bg-red-50 text-red-600">
                  <FileText className="h-7 w-7" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-[17px] font-bold text-neutral-950">Create new knowledge base</h3>
                  <p className="mt-1 text-sm leading-5 text-neutral-500">
                    Scan a website, pick pages, upload docs — AI does the rest.
                  </p>
                </div>
              </div>
              {!isReadOnly && (
                <button
                  type="button"
                  onClick={async () => {
                    await cleanupKnowledgeReviewWorkspace();
                    clearKnowledgeReviewPollTimeout();
                    knowledgeSummaryRequestKeyRef.current = '';
                    knowledgeReviewJobIdRef.current = '';
                    knowledgeReviewSessionIdRef.current = createLocalId('knowledge-review');
                    setSelectedReusableAgentId('');
                    setSelectedTextKnowledgeIds([]);
                    setSelectedUrlKnowledgeIds([]);
                    setSelectedPdfKnowledgeIds([]);
                    setKnowledgeDocumentSummaries([]);
                    setKnowledgeFaqs([]);
                    setKnowledgeBaseSummaryError('');
                    setKnowledgeFaqError('');
                    setStepErrors((prev) => ({ ...prev, knowledgeBase: '' }));
                    setKnowledgeWebsiteMode('scan');
                  }}
                  className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-full bg-neutral-900! px-5 text-sm font-bold text-white! transition hover:bg-neutral-800!"
                >
                  Start
                  <ArrowRight className="h-4 w-4" />
                </button>
              )}
            </div>

            <div className="flex items-center gap-4 text-xs font-bold uppercase tracking-[0.16em] text-neutral-400">
              <span className="h-px flex-1 bg-neutral-200" />
              <span>Or pick an existing one</span>
              <span className="h-px flex-1 bg-neutral-200" />
            </div>

            <div className="overflow-hidden rounded-2xl border-[1.5px] border-neutral-200 bg-white shadow-[0_1px_2px_rgba(0,0,0,.03)]">
              <div className="px-5 py-4">
                <h3 className="flex items-center gap-2 text-[17px] font-bold text-neutral-950">
                  <Folder className="h-4 w-4 shrink-0 text-red-600" strokeWidth={2.25} />
                  Pick a knowledge base
                </h3>
                <p className="mt-1 text-sm text-neutral-500">
                  Search your existing knowledge bases or create a new one from a website.
                </p>
                <div className="mt-4 flex h-10 min-w-0 items-center gap-2 rounded-full border! border-neutral-200! bg-white! pl-2 pr-3 shadow-[0_1px_2px_rgba(0,0,0,.03)] transition-all focus-within:border-neutral-400!">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-red-600">
                    <Search className="h-[18px] w-[18px]" strokeWidth={2.25} />
                  </span>
                  <input
                    type="text"
                    value={knowledgeBaseSearch}
                    onChange={(event) =>
                      setKnowledgeBaseSearch(sanitizeAiSearchText(event.target.value))
                    }
                    disabled={isReadOnly}
                    placeholder="Search knowledge bases..."
                    className="min-w-0 flex-1 border-none bg-transparent text-sm text-neutral-900 outline-none! placeholder:text-neutral-400 disabled:cursor-not-allowed"
                  />
                </div>
              </div>
              <div className="divide-y divide-neutral-100 border-t border-neutral-100">
                {isFetchingReusableKnowledgeAgents ? (
                  <div className="flex items-center gap-2 px-5 py-5 text-sm font-medium text-neutral-500">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Loading agents...
                  </div>
                ) : filteredKnowledgeBaseRows.length ? (
                  filteredKnowledgeBaseRows.map((agent) => {
                    const checked = selectedReusableAgentId === agent.id;
                    return (
                      <button
                        key={agent.id}
                        type="button"
                        disabled={isReadOnly}
                        onClick={() => handleSelectReusableKnowledgeAgent(agent)}
                        className={cx(
                          'flex w-full items-center gap-4 px-5 py-4 text-left transition-colors',
                          checked ? 'bg-red-600/[0.04]' : 'bg-white',
                          isReadOnly ? 'cursor-default' : 'hover:bg-neutral-50',
                        )}
                      >
                        <span
                          className={cx(
                            'grid h-5 w-5 shrink-0 place-items-center rounded-full border',
                            checked ? 'border-red-600' : 'border-neutral-300',
                          )}
                        >
                          {checked && <span className="h-2.5 w-2.5 rounded-full bg-red-600" />}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-bold text-neutral-950">
                            {agent.name}
                          </span>
                          <span className="mt-1 block truncate text-sm text-neutral-500">
                            {agent.meta}
                          </span>
                        </span>
                        <span
                          className={cx(
                            'inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold',
                            agent.channel === 'chat'
                              ? 'bg-emerald-50 text-emerald-700'
                              : 'bg-violet-50 text-violet-700',
                          )}
                        >
                          <span
                            className={cx(
                              'h-1.5 w-1.5 shrink-0 rounded-full',
                              agent.channel === 'chat' ? 'bg-emerald-500' : 'bg-violet-500',
                            )}
                          />
                          {agent.channel === 'chat' ? 'Chat' : 'Voice'}
                        </span>
                      </button>
                    );
                  })
                ) : (
                  <div className="px-5 py-5 text-sm text-neutral-500">No created agents found.</div>
                )}
              </div>
            </div>

            {stepErrors.knowledgeBase && (
              <p className="text-sm font-medium text-red-500">{stepErrors.knowledgeBase}</p>
            )}

            {!isReadOnly && (
              <div className="mt-1 flex items-center justify-between">
                <SecondaryButton tone="dark" onClick={() => void handleStepperChange(3)}>
                  <ArrowLeft className="h-4 w-4" />
                  Back
                </SecondaryButton>
              </div>
            )}
          </div>
        );
      }

      return (
        <div className="mx-auto flex w-full max-w-[880px] flex-col gap-4">
          <div className="mx-auto mt-2 w-full max-w-[540px] rounded-2xl border-[1.5px] border-neutral-200 bg-white px-7 py-9 text-center shadow-[0_1px_2px_rgba(0,0,0,.03)]">
            <div className="mx-auto mb-3 grid h-[52px] w-[52px] place-items-center rounded-xl bg-red-600/10 text-red-600">
              <Globe2 className="h-[26px] w-[26px]" />
            </div>
            <h3 className="text-[17px] font-bold text-neutral-950">What's your website?</h3>
            <p className="mx-auto mt-1 max-w-[420px] text-[13px] leading-5 text-neutral-500">
              We'll scan it and group your Product, Service, and Contact pages — you pick what to
              use.
            </p>

            <div className="mx-auto mt-4 w-full max-w-[420px]">
              <input
                value={websiteUrl}
                onChange={(event) => {
                  setWebsiteUrl(event.target.value);
                  setStepErrors((prev) => ({ ...prev, websiteUrl: '' }));
                }}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault();
                    handleContinueFromWebsite();
                  }
                }}
                readOnly={isReadOnly}
                disabled={isReadOnly}
                placeholder="https://yourcompany.com"
                className={cx(
                  'w-full rounded-xl border px-3.5 py-[11px] text-[13px] outline-none! transition-colors focus:border-neutral-400 focus:ring-4 focus:ring-neutral-100 disabled:cursor-not-allowed disabled:bg-neutral-50',
                  stepErrors.websiteUrl ? 'border-red-400' : 'border-neutral-300',
                )}
              />
            </div>
            {stepErrors.websiteUrl && (
              <p className="mt-2 text-xs font-medium text-red-500">{stepErrors.websiteUrl}</p>
            )}
            {discoveredLinks.length > 0 && (
              <p className="mt-3 text-xs font-semibold text-emerald-600">
                {discoveredLinks.length.toLocaleString()} pages found. Continue to pick the pages to
                use.
              </p>
            )}
            {!isReadOnly && (
              <button
                type="button"
                onClick={handleUseManualKnowledgeMode}
                className="mt-3 text-xs font-semibold text-neutral-500 underline underline-offset-2 hover:text-red-600"
              >
                I'll add pages manually
              </button>
            )}
          </div>

          {!isReadOnly && (
            <div className="mt-1 flex items-center justify-between">
              <SecondaryButton tone="dark" onClick={() => setKnowledgeWebsiteMode('picker')}>
                <ArrowLeft className="h-4 w-4" />
                Back
              </SecondaryButton>
              <PrimaryButton tone="dark" onClick={handleContinueFromWebsite} disabled={isCrawlingSite}>
                {isCrawlingSite ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Scanning
                  </>
                ) : (
                  <>
                    Continue
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </PrimaryButton>
            </div>
          )}
        </div>
      );
    }

    const togglePickPageLink = (link: string, checked: boolean) => {
      if (isReadOnly) return;

      setSelectedLinks((prev) => {
        if (checked) return uniqueStrings([...prev, link]);
        return prev.filter((item) => item !== link);
      });
      setStepErrors((prev) => ({ ...prev, knowledgeBase: '' }));
    };
    const scannedDomain = (() => {
      try {
        return new URL(normalizeUrl(websiteUrl)).hostname.replace(/^www\./, '');
      } catch {
        return 'your site';
      }
    })();
    const pickPageCategories = buildPickPageCategories(discoveredLinks);
    const activeExpandedCategoryId =
      expandedPickPageCategoryId &&
      pickPageCategories.some((category) => category.id === expandedPickPageCategoryId)
        ? expandedPickPageCategoryId
        : pickPageCategories[0]?.id;

    return (
      <div className="mx-auto flex w-full max-w-[880px] flex-col gap-4">
        <div>
          <h2 className="text-lg font-bold tracking-normal text-neutral-950">Pick pages</h2>
          <p className="mt-0.5 text-sm leading-5 text-neutral-500">
            Choose which pages the AI should learn from, or add content and documents manually.
          </p>
        </div>

        <div className="flex items-center gap-2 rounded-lg border border-red-600/20 bg-red-600/5 px-3 py-2 text-xs font-semibold text-neutral-950">
          {discoveredLinks.length > 0 ? (
            <>
              <Check className="h-3.5 w-3.5 shrink-0 stroke-[3] text-red-600" />
              <span>
                Found {discoveredLinks.length.toLocaleString()} pages on {scannedDomain}. Picked the
                most useful ones below.
              </span>
            </>
          ) : (
            <>
              <Info className="h-3.5 w-3.5 shrink-0 text-red-600" />
              <span>
                Manual mode — add content and documents below. The receptionist will use these as
                its only knowledge base.
              </span>
            </>
          )}
        </div>

        {discoveredLinks.length > 0 ? (
          <div className="flex flex-col gap-2.5">
            {(() => {
              let fallbackIconCounter = 0;
              return pickPageCategories.map((category, index) => {
                const isExpanded = category.id === activeExpandedCategoryId;
                const contentId = `pick-page-category-${index}`;
                const isFallbackIcon = !PICK_PAGE_CATEGORY_ICON_MAP[category.id];
                const CategoryIcon = getPickPageCategoryIcon(category.id, fallbackIconCounter);
                if (isFallbackIcon) fallbackIconCounter += 1;

                return (
                  <div
                    key={category.id}
                    className="overflow-hidden rounded-xl border border-neutral-200 bg-white"
                  >
                    <button
                      type="button"
                      aria-expanded={isExpanded}
                      aria-controls={contentId}
                      onClick={() => setExpandedPickPageCategoryId(category.id)}
                      className={cx(
                        'flex w-full items-center gap-2.5 bg-neutral-50 px-3.5 py-3 text-left',
                        isExpanded && 'border-b border-neutral-200',
                      )}
                    >
                      <div
                        className={cx(
                          'grid h-[30px] w-[30px] shrink-0 place-items-center rounded-[7px]',
                          getPickPageCategoryIconClassName(index),
                        )}
                      >
                        <CategoryIcon className="h-4 w-4" />
                      </div>
                    <div className="min-w-0 flex-1">
                      <h4 className="text-sm font-bold text-neutral-950">{category.title}</h4>
                      <p className="mt-0.5 text-xs text-neutral-500">{category.subtitle}</p>
                    </div>
                    <ChevronDown
                      className={cx(
                        'h-4 w-4 shrink-0 text-neutral-500 transition-transform',
                        isExpanded && 'rotate-180',
                      )}
                    />
                  </button>
                  {isExpanded && (
                    <div id={contentId} className="max-h-[320px] overflow-y-auto bg-white">
                      {category.links.map((link) => {
                        const selected = selectedLinks.includes(link);
                        return (
                          <label
                            key={link}
                            className={cx(
                              'flex min-h-[34px] items-center gap-2.5 border-b border-neutral-100 px-3.5 py-2 transition-colors last:border-b-0',
                              selected ? 'bg-red-600/[0.04]' : 'bg-white',
                              isReadOnly ? 'cursor-default' : 'cursor-pointer hover:bg-neutral-50',
                            )}
                          >
                            <input
                              type="checkbox"
                              checked={selected}
                              disabled={isReadOnly}
                              onChange={(event) => togglePickPageLink(link, event.target.checked)}
                              className="h-[15px] w-[15px] rounded border-neutral-300 text-red-600 focus:ring-red-600 disabled:cursor-not-allowed"
                            />
                            <span className="min-w-0 flex-1 truncate text-[13px] font-semibold text-neutral-900">
                              {getPickPageRowLabel(link, category.stripLeadingSegments)}
                            </span>
                            <span
                              title={normalizeUrl(link)}
                              className="max-w-[420px] shrink truncate text-[11px] text-neutral-500"
                            >
                              {getPickPageRowPath(link)}
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
              });
            })()}
          </div>
        ) : null}

        <div className="flex flex-col gap-4">
          {discoveredLinks.length > 0 && (
            <div className="rounded-xl border border-neutral-200 bg-white p-3.5 shadow-[0_1px_2px_rgba(0,0,0,.03)]">
              <p className="text-sm font-bold text-neutral-950">Add another URL</p>
              <p className="mt-1 text-xs text-neutral-500">Paste any page not auto-detected.</p>
              <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                <input
                  value={extraUrl}
                  onChange={(event) => {
                    setExtraUrl(event.target.value);
                    setStepErrors((prev) => ({ ...prev, extraUrl: '' }));
                  }}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.preventDefault();
                      handleAddExtraUrl();
                    }
                  }}
                  readOnly={isReadOnly}
                  disabled={isReadOnly}
                  placeholder="https://yourcompany.com/page"
                  className={cx(
                    'h-10 min-w-0 flex-1 rounded-xl border px-3 text-sm outline-none! transition-colors focus:border-neutral-400 focus:ring-4 focus:ring-neutral-100 disabled:cursor-not-allowed disabled:bg-neutral-50',
                    stepErrors.extraUrl ? 'border-red-400' : 'border-neutral-300',
                  )}
                />
                {!isReadOnly && (
                  <button
                    type="button"
                    onClick={handleAddExtraUrl}
                    className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-full border! border-red-200! bg-red-50! px-5 text-sm font-semibold text-red-600! transition-colors hover:bg-red-100!"
                  >
                    <Plus className="h-4 w-4" />
                    Add
                  </button>
                )}
              </div>
              {stepErrors.extraUrl && (
                <p className="mt-2 text-sm text-red-500">{stepErrors.extraUrl}</p>
              )}
              {pendingUrls.length > 0 && (
                <div className="mt-3 flex flex-col gap-2">
                  {pendingUrls.map((url) => (
                    <div
                      key={url}
                      className="flex items-center justify-between gap-2 rounded-md bg-neutral-50 px-3 py-2 text-xs"
                    >
                      <span className="min-w-0 truncate text-neutral-600">{url}</span>
                      {!isReadOnly && (
                        <button
                          type="button"
                          onClick={() => handleRemovePendingUrl(url)}
                          className="shrink-0 text-neutral-400 hover:text-red-500"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="rounded-2xl border-[1.5px] border-neutral-200 bg-white p-4 shadow-[0_1px_2px_rgba(0,0,0,.03)]">
            <div className="mb-3.5">
              <h3 className="flex items-center gap-1.5 text-[17px] font-bold text-neutral-950">
                <PenLine className="h-4 w-4 shrink-0 text-red-600" strokeWidth={2.25} />
                Add content
                <CustomTooltip
                  side="top"
                  text="Write it in plain language — the AI turns it into searchable knowledge. Leave a blank line between topics to keep things organized, with one topic per paragraph. Include exact numbers, dates, and policies so the receptionist answers precisely instead of guessing."
                  className="w-max max-w-[340px] border-none! bg-[#fdf7f5]! text-black! shadow-[0_6px_20px_rgba(17,17,17,0.18)]! [&_svg]:fill-[#fdf7f5]"
                >
                  <Info className="h-4 w-4 cursor-help text-neutral-400" />
                </CustomTooltip>
              </h3>
              <p className="mt-0.5 text-xs leading-5 text-neutral-500">
                Type or paste the facts, policies, and answers your receptionist should know —
                pricing, hours, addresses, refund rules, FAQs, anything.
              </p>
            </div>
            <textarea
              value={customContent}
              onChange={(event) => setCustomContent(event.target.value)}
              readOnly={isReadOnly}
              disabled={isReadOnly}
              placeholder={`Type or paste anything your receptionist should know — write naturally, the AI organizes it into searchable answers.\n\nEXAMPLE\nBusiness hours: Monday-Friday, 9:00 AM to 6:00 PM EST. Closed weekends and US public holidays.\nPricing: Growth plan starts at $12 per user / month. Pro is $24 per user / month. Enterprise is custom-quoted - offer to connect the caller with sales.\nOffice address: 123 Market Street, Suite 400, San Francisco, CA 94105.\nRefund policy: Full refund within 30 days of purchase. No refunds after 30 days.\nSupport contact: support@example.com or +1 (800) 555-0199.`}
              className="min-h-[220px] w-full resize-y rounded-xl border border-neutral-300 p-3 text-sm leading-6 text-neutral-800 outline-none! transition-colors focus:border-neutral-400 focus:ring-4 focus:ring-neutral-100 disabled:cursor-not-allowed disabled:bg-neutral-50"
            />
            <p className="mt-1 text-right text-[11px] font-medium text-neutral-500">
              {customContentWordCount} {customContentWordCount === 1 ? 'word' : 'words'}
            </p>
            <div className="mt-2 flex justify-end">
              {!isReadOnly && (
                <PrimaryButton
                  tone="ghost"
                  onClick={handleAddCustomContent}
                  disabled={!customContent.trim()}
                >
                  <Plus className="h-4 w-4" />
                  Add this content
                </PrimaryButton>
              )}
            </div>
            {pendingTextItems.length > 0 && (
              <div className="mt-3 flex flex-col gap-2">
                {pendingTextItems.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-start justify-between gap-2 rounded-md border border-neutral-100 bg-neutral-50 px-3 py-2 text-xs"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-neutral-900">{item.title}</p>
                      <p className="mt-0.5 line-clamp-2 text-neutral-500">{item.text}</p>
                    </div>
                    {!isReadOnly && (
                      <button
                        type="button"
                        onClick={() => handleRemovePendingText(item.id)}
                        className="shrink-0 text-neutral-400 hover:text-red-500"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div>
            <input
              ref={pendingFileInputRef}
              type="file"
              accept=".pdf,application/pdf"
              multiple
              className="hidden"
              onChange={(event) => {
                handlePendingFilesSelected(event.currentTarget.files);
                event.currentTarget.value = '';
              }}
            />
            {pendingFiles.length > 0 && (
              <div className="mt-2 flex flex-col gap-1.5">
                {pendingFiles.map(({ id, file }) => (
                  <div
                    key={id}
                    className="flex items-center gap-2 rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm"
                  >
                    <div className="grid h-7 w-7 shrink-0 place-items-center rounded bg-red-50 text-[10px] font-bold text-red-700">
                      PDF
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold text-neutral-950">{file.name}</p>
                      <p className="text-xs text-neutral-500">{formatFileSize(file.size)}</p>
                    </div>
                    {!isReadOnly && (
                      <button
                        type="button"
                        onClick={() => handleRemovePendingFile(id)}
                        className="shrink-0 p-1 text-neutral-400 hover:text-red-500"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {stepErrors.knowledgeBase && (
          <p className="text-sm font-medium text-red-500">{stepErrors.knowledgeBase}</p>
        )}

        {!isReadOnly && (
          <div className="mt-2 flex items-center justify-between">
            <SecondaryButton
              tone="dark"
              onClick={() => {
                setStepErrors({});
                setSourceStage(1);
              }}
            >
              <ArrowLeft className="h-4 w-4" />
              Back
            </SecondaryButton>
            <PrimaryButton tone="dark" onClick={() => void handleContinueFromKnowledgeBase()}>
              Continue
              <ArrowRight className="h-4 w-4" />
            </PrimaryButton>
          </div>
        )}
      </div>
    );
  };
  const renderReviewKnowledgeMenu = (
    type: ReviewKnowledgeItemType,
    item: KnowledgeDocument | KnowledgeFaq,
  ) => {
    if (isReadOnly) return null;

    const menuKey = `${type}-${item.id}`;
    const isOpen = openReviewKnowledgeMenu === menuKey;

    return (
      <div className="relative shrink-0">
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            setOpenReviewKnowledgeMenu(isOpen ? '' : menuKey);
          }}
          className={cx(
            'inline-flex h-7 w-7 items-center justify-center rounded-full text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-neutral-950',
            isOpen && 'bg-neutral-100 text-neutral-950',
          )}
          aria-label="Knowledge card actions"
        >
          <MoreVertical className="h-4 w-4" />
        </button>
        {isOpen && (
          <div className="absolute right-0 top-8 z-30 min-w-[180px] rounded-xl border border-neutral-200 bg-white p-1.5 shadow-[0_12px_28px_rgba(0,0,0,0.12)]">
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                handleOpenReviewKnowledgeSource(type, item);
              }}
              className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[13px] font-medium text-neutral-700 transition-colors hover:bg-neutral-50 hover:text-neutral-950"
            >
              <FileText className="h-3.5 w-3.5 shrink-0" />
              View Source Document
            </button>
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                handleOpenReviewKnowledgeEdit(type, item);
              }}
              className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[13px] font-medium text-neutral-700 transition-colors hover:bg-neutral-50 hover:text-neutral-950"
            >
              <Edit3 className="h-3.5 w-3.5 shrink-0" />
              Edit
            </button>
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                handleDuplicateReviewKnowledgeItem(type, item);
              }}
              className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[13px] font-medium text-neutral-700 transition-colors hover:bg-neutral-50 hover:text-neutral-950"
            >
              <Copy className="h-3.5 w-3.5 shrink-0" />
              Duplicate
            </button>
            <div className="my-1 border-t border-neutral-100" />
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                handleDeleteReviewKnowledgeItem(type, item);
              }}
              className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[13px] font-medium text-red-600 transition-colors hover:bg-red-50"
            >
              <Trash2 className="h-3.5 w-3.5 shrink-0" />
              Delete
            </button>
          </div>
        )}
      </div>
    );
  };

  const renderReviewKnowledgeModals = () => {
    const sourcePath = reviewKnowledgeSourceModal?.source.trim() || 'Manual';
    const sourceHref =
      sourcePath && /^https?:\/\//i.test(sourcePath)
        ? sourcePath
        : sourcePath.includes('.') && !sourcePath.includes(' ')
          ? `https://${sourcePath.replace(/^\//, '')}`
          : '';

    return (
      <>
        {reviewKnowledgeSourceModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-neutral-950/55 px-3 py-6">
            <div className="max-h-[calc(100vh-48px)] w-full max-w-[620px] overflow-y-auto rounded-2xl border border-neutral-200 bg-white shadow-[0_20px_60px_rgba(0,0,0,0.22)]">
              <div className="flex items-center justify-between border-b border-neutral-100 px-5 py-4">
                <h3 className="flex items-center gap-2.5 text-base font-bold text-neutral-950">
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-neutral-100 text-neutral-600">
                    {reviewKnowledgeSourceModal.type === 'faq' ? (
                      <MessageSquare className="h-4 w-4" />
                    ) : (
                      <FileText className="h-4 w-4" />
                    )}
                  </span>
                  {reviewKnowledgeSourceModal.type === 'faq'
                    ? 'Source for this FAQ'
                    : 'Source Document'}
                </h3>
                <button
                  type="button"
                  onClick={() => setReviewKnowledgeSourceModal(null)}
                  className="rounded-full p-1.5 text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-900"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="p-5">
                <div className="mb-3 grid gap-1.5 rounded-lg bg-neutral-50 px-3.5 py-3 text-xs">
                  <div className="flex gap-3">
                    <span className="min-w-[120px] font-semibold text-neutral-600">Title</span>
                    <span className="font-semibold text-neutral-950">
                      {reviewKnowledgeSourceModal.title}
                    </span>
                  </div>
                  <div className="flex gap-3">
                    <span className="min-w-[120px] font-semibold text-neutral-600">Source</span>
                    <span className="min-w-0 break-all text-neutral-950">{sourcePath}</span>
                  </div>
                  <div className="flex gap-3">
                    <span className="min-w-[120px] font-semibold text-neutral-600">Imported</span>
                    <span className="text-neutral-950">
                      {reviewKnowledgeSourceModal.status || 'Just now'}
                    </span>
                  </div>
                </div>
                <div className="max-h-[320px] overflow-y-auto rounded-lg border border-neutral-200 bg-white px-4 py-3 text-[13px] leading-[1.65] text-neutral-700">
                  {reviewKnowledgeSourceModal.body ? (
                    <p className="whitespace-pre-line">{reviewKnowledgeSourceModal.body}</p>
                  ) : (
                    <p className="text-neutral-500">No content preview available.</p>
                  )}
                  <div className="mt-3 rounded-md border-l-[3px] border-neutral-200 bg-neutral-50 px-3 py-2 text-xs leading-5 text-neutral-700">
                    <b className="text-neutral-950">Full summarized content shown above.</b> This is
                    the content the receptionist uses to answer related questions. To revise
                    wording, use Edit on the card.
                  </div>
                  {sourceHref && (
                    <div className="mt-2 text-right text-[13px] font-semibold">
                      <a
                        href={sourceHref}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-red-600 hover:underline"
                      >
                        <ExternalLink className="h-3 w-3 shrink-0" />
                        Read more from the original source
                      </a>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {reviewKnowledgeEditModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-neutral-950/55 px-3 py-6">
            <div className="w-full max-w-[540px] rounded-2xl border border-neutral-200 bg-white shadow-[0_20px_60px_rgba(0,0,0,0.22)]">
              <div className="flex items-center justify-between border-b border-neutral-100 px-5 py-4">
                <h3 className="flex items-center gap-2.5 text-base font-bold text-neutral-950">
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-neutral-100 text-neutral-600">
                    <Edit3 className="h-4 w-4" />
                  </span>
                  {reviewKnowledgeEditModal.type === 'faq' ? 'Edit FAQ' : 'Edit document'}
                </h3>
                <button
                  type="button"
                  onClick={() => setReviewKnowledgeEditModal(null)}
                  className="rounded-full p-1.5 text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-900"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="p-5">
                <label className="mb-1.5 block text-xs font-semibold text-neutral-700">
                  {reviewKnowledgeEditModal.type === 'faq' ? 'Question' : 'Document title'}
                </label>
                <input
                  value={reviewKnowledgeEditModal.title}
                  onChange={(event) =>
                    setReviewKnowledgeEditModal((prev) =>
                      prev ? { ...prev, title: event.target.value } : prev,
                    )
                  }
                  className="h-10 w-full rounded-xl border border-neutral-300 px-3 text-sm outline-none! transition-colors focus:border-neutral-400 focus:ring-4 focus:ring-neutral-100"
                />
                <label className="mb-1.5 mt-3 block text-xs font-semibold text-neutral-700">
                  {reviewKnowledgeEditModal.type === 'faq' ? 'Answer' : 'Document content'}
                </label>
                <textarea
                  value={reviewKnowledgeEditModal.body}
                  onChange={(event) =>
                    setReviewKnowledgeEditModal((prev) =>
                      prev ? { ...prev, body: event.target.value } : prev,
                    )
                  }
                  className="min-h-[150px] w-full resize-y rounded-xl border border-neutral-300 px-3 py-2 text-sm leading-6 outline-none! transition-colors focus:border-neutral-400 focus:ring-4 focus:ring-neutral-100"
                />
              </div>
              <div className="flex justify-end gap-2 border-t border-neutral-100 px-5 py-4">
                <SecondaryButton onClick={() => setReviewKnowledgeEditModal(null)}>
                  Cancel
                </SecondaryButton>
                <PrimaryButton onClick={handleConfirmReviewKnowledgeEdit}>
                  Save changes
                </PrimaryButton>
              </div>
            </div>
          </div>
        )}

        {reviewKnowledgeAddModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-neutral-950/55 px-3 py-6">
            <div className="w-full max-w-[540px] rounded-2xl border border-neutral-200 bg-white shadow-[0_20px_60px_rgba(0,0,0,0.22)]">
              <div className="flex items-center justify-between border-b border-neutral-100 px-5 py-4">
                <h3 className="flex items-center gap-2.5 text-base font-bold text-neutral-950">
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-neutral-100 text-neutral-600">
                    <Plus className="h-4 w-4" />
                  </span>
                  {reviewKnowledgeAddModal.type === 'faq' ? 'Add FAQ' : 'Add document'}
                </h3>
                <button
                  type="button"
                  onClick={() => setReviewKnowledgeAddModal(null)}
                  className="rounded-full p-1.5 text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-900"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="p-5">
                <div className="mb-3.5 inline-flex w-fit gap-[3px] rounded-full bg-neutral-100 p-1">
                  {[
                    { value: 'text' as const, label: 'Paste text' },
                    // { value: 'upload' as const, label: 'Upload file' },
                  ].map((mode) => (
                    <button
                      key={mode.value}
                      type="button"
                      onClick={() =>
                        setReviewKnowledgeAddModal((prev) =>
                          prev ? { ...prev, mode: mode.value } : prev,
                        )
                      }
                      className={cx(
                        'rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors',
                        reviewKnowledgeAddModal.mode === mode.value
                          ? 'bg-white text-neutral-950 shadow-sm'
                          : 'bg-transparent text-neutral-600 hover:bg-white hover:text-neutral-950',
                      )}
                    >
                      {mode.label}
                    </button>
                  ))}
                </div>

                {reviewKnowledgeAddModal.mode === 'text' ? (
                  <>
                    <label className="mb-1.5 block text-xs font-semibold text-neutral-700">
                      {reviewKnowledgeAddModal.type === 'faq' ? 'Question' : 'Document title'}
                    </label>
                    <input
                      value={reviewKnowledgeAddModal.title}
                      onChange={(event) =>
                        setReviewKnowledgeAddModal((prev) =>
                          prev ? { ...prev, title: event.target.value } : prev,
                        )
                      }
                      placeholder={
                        reviewKnowledgeAddModal.type === 'faq'
                          ? 'e.g. How much does it cost?'
                          : 'e.g. Refund policy'
                      }
                      className="h-10 w-full rounded-xl border border-neutral-300 px-3 text-sm outline-none! transition-colors focus:border-neutral-400 focus:ring-4 focus:ring-neutral-100"
                    />
                    <label className="mb-1.5 mt-3 block text-xs font-semibold text-neutral-700">
                      {reviewKnowledgeAddModal.type === 'faq' ? 'Answer' : 'Document content'}
                    </label>
                    <textarea
                      value={reviewKnowledgeAddModal.body}
                      onChange={(event) =>
                        setReviewKnowledgeAddModal((prev) =>
                          prev ? { ...prev, body: event.target.value } : prev,
                        )
                      }
                      placeholder={
                        reviewKnowledgeAddModal.type === 'faq'
                          ? 'Type the answer the receptionist should give. Short, conversational answers work best.'
                          : 'Type or paste the content the receptionist should learn from. Short, factual paragraphs work best.'
                      }
                      className="min-h-[150px] w-full resize-y rounded-xl border border-neutral-300 px-3 py-2 text-sm leading-6 outline-none! transition-colors focus:border-neutral-400 focus:ring-4 focus:ring-neutral-100"
                    />
                  </>
                ) : (
                  <>
                    <input
                      ref={reviewKnowledgeFileInputRef}
                      type="file"
                      className="hidden"
                      onChange={(event) => {
                        handleReviewKnowledgeAddFilePicked(event.currentTarget.files?.[0] || null);
                        event.currentTarget.value = '';
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => reviewKnowledgeFileInputRef.current?.click()}
                      className="w-full rounded-xl border-2 border-dashed border-neutral-300 px-7 py-7 text-center text-sm text-neutral-600 transition-colors hover:border-neutral-400 hover:bg-neutral-50"
                    >
                      <span className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-xl bg-neutral-100 text-neutral-600">
                        <UploadCloud className="h-5 w-5" />
                      </span>
                      <b className="text-neutral-950">Choose a file</b>
                      <span className="mt-1 block text-xs text-neutral-500">
                        Upload a document to add it to this knowledge base.
                      </span>
                    </button>
                    {reviewKnowledgeAddModal.file && (
                      <div className="mt-3 flex items-center gap-2.5 rounded-lg bg-neutral-50 px-3 py-2">
                        <div className="rounded bg-red-600 px-2 py-1 text-[11px] font-bold text-white">
                          DOC
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[13px] font-semibold text-neutral-950">
                            {reviewKnowledgeAddModal.file.name}
                          </p>
                          <p className="text-[11px] text-neutral-500">
                            {formatFileSize(reviewKnowledgeAddModal.file.size)}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() =>
                            setReviewKnowledgeAddModal((prev) =>
                              prev ? { ...prev, file: null } : prev,
                            )
                          }
                          className="text-neutral-500 hover:text-red-600"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    )}
                  </>
                )}
              </div>
              <div className="flex justify-end gap-2 border-t border-neutral-100 px-5 py-4">
                <SecondaryButton onClick={() => setReviewKnowledgeAddModal(null)}>
                  Cancel
                </SecondaryButton>
                <PrimaryButton onClick={handleConfirmReviewKnowledgeAdd}>
                  Add to knowledge base
                </PrimaryButton>
              </div>
            </div>
          </div>
        )}
      </>
    );
  };

  const renderReviewStep = () => {
    const validFaqCount = getValidKnowledgeFaqs(knowledgeFaqs).length;
    const normalizedSearch = reviewKnowledgeSearch.trim().toLowerCase();
    const filteredDocuments = normalizedSearch
      ? knowledgeDocumentSummaries.filter((document) =>
          [document.title, document.copy, document.source, document.status]
            .join(' ')
            .toLowerCase()
            .includes(normalizedSearch),
        )
      : knowledgeDocumentSummaries;
    const filteredFaqs = normalizedSearch
      ? knowledgeFaqs.filter((faq) =>
          [faq.question, faq.answer, faq.source].join(' ').toLowerCase().includes(normalizedSearch),
        )
      : knowledgeFaqs;
    const isDocumentsTab = reviewKnowledgeTab === 'documents';
    const searchPlaceholder = isDocumentsTab ? 'Search documents…' : 'Search FAQs…';
    const reviewSourceCount = uniqueStrings([
      ...(knowledgeSummaryPayload.crawl_url ?? []),
      ...(knowledgeSummaryPayload.url ?? []),
      ...(knowledgeSummaryPayload.text ?? []),
      ...(knowledgeSummaryPayload.pdf ?? []),
    ]).length;

    const hasExtractedKnowledge = knowledgeDocumentSummaries.length > 0 || validFaqCount > 0;

    const renderKnowledgeEmptyState = (type: 'document' | 'faq') => (
      <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-neutral-200 bg-neutral-50/60 px-6 py-10 text-center">
        <span className="grid h-12 w-12 place-items-center rounded-full bg-neutral-100 text-neutral-600">
          {type === 'document' ? (
            <FileText className="h-6 w-6" />
          ) : (
            <MessageSquare className="h-6 w-6" />
          )}
        </span>
        <div>
          <p className="text-sm font-bold text-neutral-950">
            {type === 'document' ? 'No documents added yet' : 'No FAQs added yet'}
          </p>
          <p className="mx-auto mt-1 max-w-[360px] text-xs leading-5 text-neutral-500">
            {type === 'document'
              ? 'Upload documents or paste text so your AI receptionist has context to answer customer questions.'
              : 'Add frequently asked questions so your AI receptionist can answer them instantly.'}
          </p>
        </div>
        {!isReadOnly && (
          <button
            type="button"
            onClick={() => handleOpenReviewKnowledgeAdd(type)}
            disabled={isKnowledgeSummaryNavigationLocked}
            className="mt-1 inline-flex h-9 items-center gap-1.5 rounded-full border! border-red-200! bg-red-50! px-4 text-xs font-bold text-red-600! transition-colors hover:bg-red-100! disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Plus className="h-3.5 w-3.5" />
            {type === 'document' ? 'Add document' : 'Add FAQ'}
          </button>
        )}
      </div>
    );

    return (
      <div className="mx-auto flex w-full max-w-[880px] flex-col gap-3.5 text-left">
        <div>
          <h2 className="text-lg font-bold tracking-normal text-neutral-950">Review knowledge</h2>
          <p className="mt-0.5 text-sm leading-5 text-neutral-500">
            Make sure everything below is accurate before you continue.
          </p>
        </div>

        <div className="rounded-2xl border-[1.5px] border-neutral-200 bg-white p-4 shadow-[0_1px_2px_rgba(0,0,0,.03)]">
          <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
            <div className="flex min-w-0 flex-1 items-center gap-3">
              <span
                className={cx(
                  'grid h-11 w-11 shrink-0 place-items-center rounded-xl',
                  hasExtractedKnowledge ? 'bg-emerald-50 text-emerald-600' : 'bg-neutral-100 text-neutral-400',
                )}
              >
                {hasExtractedKnowledge ? (
                  <Check
                    key="knowledge-extracted-check"
                    className="h-5 w-5 animate-in zoom-in-50 spin-in-45 duration-300 ease-out"
                    strokeWidth={2.5}
                  />
                ) : (
                  <FileText className="h-5 w-5" />
                )}
              </span>
              <div className="min-w-0">
                <p className="text-sm font-bold text-neutral-950">
                  {hasExtractedKnowledge
                    ? "Here's what your receptionist will know"
                    : 'Nothing extracted yet'}
                </p>
                <p className="mt-0.5 text-xs leading-5 text-neutral-500">
                  {hasExtractedKnowledge
                    ? 'Add more from the tabs below if anything is missing.'
                    : 'Add a document or FAQ below to get started.'}
                </p>
              </div>
            </div>

            {[
              { label: 'Sources', value: reviewSourceCount },
              { label: 'Documents', value: knowledgeDocumentSummaries.length },
              { label: 'FAQs', value: validFaqCount },
              { label: 'Training', value: '~3 min', valueClassName: 'text-sm' },
            ].map((item, index) => (
              <div
                key={item.label}
                className={cx('shrink-0 pl-5', index > 0 && 'border-l border-neutral-200')}
              >
                <p className="text-[11px] font-medium uppercase tracking-wide leading-4 text-neutral-500">
                  {item.label}
                </p>
                <p
                  className={cx(
                    'mt-0.5 text-xl font-bold leading-6 text-neutral-950',
                    item.valueClassName,
                  )}
                >
                  {item.value}
                </p>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-1">
          <h2 className="text-[18px] font-bold leading-6 text-neutral-950">Knowledge Base Summary</h2>
        </div>

        <div className="mb-0.5 flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative grid w-fit shrink-0 grid-cols-2 rounded-full bg-neutral-200 p-1">
            {/* One pill that slides between the two tabs, rather than two that
                pop on and off - the movement shows which way the selection went. */}
            <span
              aria-hidden="true"
              className="absolute top-1 bottom-1 left-1 w-[calc(50%-4px)] rounded-full bg-white shadow-sm transition-transform duration-200 ease-out"
              style={{
                transform:
                  reviewKnowledgeTab === 'faqs' ? 'translateX(100%)' : 'translateX(0)',
              }}
            />
            {[
              {
                key: 'documents' as const,
                label: 'Documents',
                count: knowledgeDocumentSummaries.length,
                icon: <FileText className="h-3.5 w-3.5" />,
              },
              {
                key: 'faqs' as const,
                label: 'FAQs',
                count: validFaqCount,
                icon: <MessageSquare className="h-3.5 w-3.5" />,
              },
            ].map((tab) => {
              const isSelected = reviewKnowledgeTab === tab.key;
              return (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => {
                    setReviewKnowledgeTab(tab.key);
                    setReviewKnowledgeSearch('');
                  }}
                  className={cx(
                    'relative z-10 flex cursor-pointer items-center justify-center gap-1.5 rounded-full border-0 bg-transparent px-3.5 py-1.5 text-xs font-semibold transition-colors',
                    isSelected
                      ? 'text-neutral-950'
                      : 'text-neutral-500 hover:text-neutral-800',
                  )}
                >
                  {tab.icon}
                  {tab.label}
                  <span
                    className={cx(
                      'ml-0.5 rounded-full px-1.5 py-0.5 text-[11px] font-semibold leading-none',
                      isSelected ? 'bg-neutral-100 text-neutral-950' : 'bg-neutral-300/70 text-neutral-600',
                    )}
                  >
                    {tab.count}
                  </span>
                </button>
              );
            })}
          </div>
          <div className="relative min-w-0 flex-1">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-red-600"
              strokeWidth={2.25}
            />
            <input
              value={reviewKnowledgeSearch}
              onChange={(event) =>
                setReviewKnowledgeSearch(sanitizeAiSearchText(event.target.value))
              }
              placeholder={searchPlaceholder}
              className="h-9 w-full rounded-full border border-neutral-300 bg-white pl-9 pr-3 text-sm shadow-sm outline-none! transition-colors focus:border-neutral-400 focus:ring-4 focus:ring-neutral-100"
            />
          </div>
          {!isReadOnly && (
            <button
              type="button"
              onClick={() => handleOpenReviewKnowledgeAdd(isDocumentsTab ? 'document' : 'faq')}
              disabled={isKnowledgeSummaryNavigationLocked}
              className="inline-flex h-[34px] shrink-0 items-center justify-center gap-1.5 rounded-full border! border-red-200! bg-red-50! px-3.5 text-xs font-bold text-red-600! transition-colors hover:bg-red-100! disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Plus className="h-3.5 w-3.5" />
              Add
            </button>
          )}
        </div>

        {isDocumentsTab ? (
          <div className="flex flex-col gap-2.5">
            {isSummarizingKnowledgeBase ? (
              <div className="flex items-center justify-center gap-2 rounded-xl border border-neutral-200 bg-white px-4 py-8 text-sm font-semibold text-red-600">
                <Loader2 className="h-4 w-4 animate-spin" />
                Generating summary...
              </div>
            ) : (
              <>
                {knowledgeBaseSummaryError && (
                  <div className="rounded-lg border border-red-100 bg-red-50 px-4 py-3 text-sm font-semibold text-red-600">
                    {knowledgeBaseSummaryError}
                  </div>
                )}
                {filteredDocuments.length ? (
                  filteredDocuments.map((document) => {
                    const copy = document.copy.trim();
                    const isMenuOpen = openReviewKnowledgeMenu === `document-${document.id}`;
                    return (
                      <div
                        key={document.id}
                        className={cx(
                          'relative rounded-xl border border-neutral-200 bg-white px-[22px] py-[18px] shadow-sm transition-all duration-150 hover:-translate-y-0.5 hover:border-neutral-300 hover:shadow-[0_8px_20px_rgba(220,38,38,.1)]',
                          isMenuOpen && 'z-20',
                        )}
                      >
                        <div className="flex items-start justify-between gap-2.5">
                          <h3 className="min-w-0 flex-1 break-words text-[15px] font-bold leading-5 text-neutral-950">
                            {document.title}
                          </h3>
                          {renderReviewKnowledgeMenu('document', document)}
                        </div>
                        {copy && (
                          <p className="mt-3 whitespace-pre-line break-words text-[13px] leading-[1.6] text-neutral-700">
                            {copy}
                          </p>
                        )}
                        <div className="mt-3 flex flex-col gap-2 border-t border-neutral-100 pt-3 text-xs text-neutral-500 sm:flex-row sm:items-center sm:justify-between">
                          <span className="min-w-0 truncate">
                            From {document.source || 'selected source'}
                          </span>
                          <span>{document.status || 'Ready'}</span>
                        </div>
                      </div>
                    );
                  })
                ) : knowledgeDocumentSummaries.length ? (
                  <div className="rounded-xl border border-dashed border-neutral-200 bg-white px-4 py-8 text-center text-sm text-neutral-500">
                    No documents match your search.
                  </div>
                ) : (
                  renderKnowledgeEmptyState('document')
                )}
              </>
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-2.5">
            {isGeneratingKnowledgeFaqs ? (
              <div className="flex items-center justify-center gap-2 rounded-xl border border-neutral-200 bg-white px-4 py-8 text-sm font-semibold text-red-600">
                <Loader2 className="h-4 w-4 animate-spin" />
                Generating FAQs...
              </div>
            ) : (
              <>
                {knowledgeFaqError && (
                  <div className="rounded-lg border border-red-100 bg-red-50 px-4 py-3 text-sm font-semibold text-red-600">
                    {knowledgeFaqError}
                  </div>
                )}
                {filteredFaqs.length ? (
                  filteredFaqs.map((faq) => (
                    <div
                      key={faq.id}
                      className={cx(
                        'relative rounded-xl border border-neutral-200 bg-white px-[22px] py-[18px] shadow-sm transition-all duration-150 hover:-translate-y-0.5 hover:border-neutral-300 hover:shadow-[0_8px_20px_rgba(220,38,38,.1)]',
                        openReviewKnowledgeMenu === `faq-${faq.id}` && 'z-20',
                      )}
                    >
                      <div className="mb-3 flex items-start justify-between gap-3">
                        <h3 className="min-w-0 flex-1 break-words text-[15px] font-bold leading-5 text-neutral-950">
                          {faq.question || 'Untitled FAQ'}
                        </h3>
                        {renderReviewKnowledgeMenu('faq', faq)}
                      </div>
                      <p className="whitespace-pre-line break-words text-[13px] leading-[1.6] text-neutral-700">
                        {faq.answer || 'No answer added yet.'}
                      </p>
                      <div className="mt-3 flex flex-col gap-2 border-t border-neutral-100 pt-3 text-xs text-neutral-500 sm:flex-row sm:items-center sm:justify-between">
                        <span className="min-w-0 truncate">
                          {faq.source ? `From ${faq.source}` : 'Manual'}
                        </span>
                        <span>Just generated</span>
                      </div>
                    </div>
                  ))
                ) : getValidKnowledgeFaqs(knowledgeFaqs).length ? (
                  <div className="rounded-xl border border-dashed border-neutral-200 bg-white px-4 py-8 text-center text-sm text-neutral-500">
                    No FAQs match your search.
                  </div>
                ) : (
                  renderKnowledgeEmptyState('faq')
                )}
              </>
            )}
            {stepErrors.knowledgeBase && (
              <p className="mt-3 text-sm font-medium text-red-500">{stepErrors.knowledgeBase}</p>
            )}
          </div>
        )}

        {isDocumentsTab && stepErrors.knowledgeBase && (
          <p className="text-sm font-medium text-red-500">{stepErrors.knowledgeBase}</p>
        )}

        {!isReadOnly && (
          <div className="mt-2 flex items-center justify-between">
            <SecondaryButton
              tone="dark"
              onClick={() => void handleStepperChange(4, 2)}
              disabled={isKnowledgeSummaryNavigationLocked}
            >
              <ArrowLeft className="h-4 w-4" />
              Back
            </SecondaryButton>
            <PrimaryButton
              tone="dark"
              onClick={() => void handleStepperChange(6, 1)}
              disabled={isKnowledgeSummaryNavigationLocked}
            >
              Continue
              <ArrowRight className="h-4 w-4" />
            </PrimaryButton>
          </div>
        )}
      </div>
    );
  };

  const renderAdvancedStep = () => {
    const numberFieldClass =
      'h-10 w-full rounded-lg border border-neutral-300 bg-white px-3 text-center text-sm font-semibold outline-none! transition-colors focus:border-neutral-400 focus:ring-4 focus:ring-neutral-100';

    return (
    <div className="mx-auto flex w-full max-w-[1040px] flex-col gap-4">
      <SectionHeading
        title="Advanced settings"
        subtitle="Configure data collection, routing, language preferences, and behavioral parameters."
      />
      {isCreatingKnowledgeSources && (
        <div className="flex items-center gap-3 rounded-lg border border-red-600/20 bg-red-600/5 p-4 text-sm font-semibold text-red-600">
          <Loader2 className="h-4 w-4 animate-spin" />
          Creating selected URL, text, and file knowledge bases before saving the receptionist...
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:items-stretch">
        {/* ── Preferences ──────────────────────────────── */}
        <div className="flex h-full flex-col overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-sm">
          <div className="border-b border-neutral-100 px-5 py-4">
            <h3 className="flex items-center gap-2 text-sm font-bold text-neutral-950">
              <Settings2 className="h-4 w-4 shrink-0 text-red-600" strokeWidth={2.25} />
              Preferences
            </h3>
            <p className="mt-0.5 text-xs text-neutral-500">
              Always-on call quality features and CRM handoff.
            </p>
          </div>
          <div className="flex flex-1 flex-col divide-y divide-neutral-100">
            <div className="flex items-start justify-between gap-4 px-5 py-4">
              <div>
                <p className="text-sm font-semibold text-neutral-950">Enable Call Monitoring</p>
                <p className="mt-1 text-xs leading-5 text-neutral-500">
                  Every call is automatically transcribed for compliance, quality assurance, and
                  analytics.
                </p>
              </div>
              <ToggleSwitch checked={enableCallMonitoring} disabled className="mt-0.5" />
            </div>
            <div className="flex items-start justify-between gap-4 px-5 py-4">
              <div>
                <p className="text-sm font-semibold text-neutral-950">Enable Transcripts</p>
                <p className="mt-1 text-xs leading-5 text-neutral-500">
                  Generate and save text transcripts for each receptionist call.
                </p>
              </div>
              <ToggleSwitch checked={enableTranscripts} disabled className="mt-0.5" />
            </div>
            <div className="flex-1 px-5 py-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-2.5">
                  <Target className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                  <div>
                    <p className="text-sm font-semibold text-neutral-950">
                      Push captured data to CRM
                    </p>
                    <p className="mt-1 text-xs leading-5 text-neutral-500">
                      Auto-creates a CRM contact from the fields collected below, with the full
                      call transcript attached.
                    </p>
                  </div>
                </div>
                <ToggleSwitch
                  checked={enableCrmPush}
                  onCheckedChange={(checked) =>
                    setEnableCrmPush(isDataCollectionEnabled && checked)
                  }
                  disabled={isReadOnly || !isDataCollectionEnabled}
                  className="mt-0.5"
                />
              </div>
              {!isDataCollectionEnabled && (
                <p className="mt-2 text-xs font-medium text-amber-700">
                  Requires Data Collection enabled below.
                </p>
              )}
              {isDataCollectionEnabled && enableCrmPush && (
                <select
                  value={selectedCrmPipeline}
                  onChange={(event) => setSelectedCrmPipeline(event.target.value)}
                  disabled={
                    isReadOnly || isFetchingConnectedCrms || connectedCrmOptions.length === 0
                  }
                  className="mt-3 h-10 w-full rounded-lg border border-neutral-300 bg-white px-3 text-sm font-medium text-neutral-800 outline-none! transition-colors focus:border-neutral-400 focus:ring-4 focus:ring-neutral-100 disabled:cursor-not-allowed disabled:bg-neutral-50"
                >
                  <option value="" disabled>
                    {isFetchingConnectedCrms
                      ? 'Checking connected CRMs...'
                      : connectedCrmOptions.length > 0
                        ? 'Select CRM...'
                        : 'No connected CRM available'}
                  </option>
                  {connectedCrmOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                  <optgroup hidden label="Legacy CRM options">
                    <option value="hubspot-sales">HubSpot — Sales pipeline</option>
                    <option value="hubspot-marketing">HubSpot — Marketing pipeline</option>
                    <option value="salesforce">Salesforce — Leads</option>
                    <option value="zoho">Zoho CRM — Contacts</option>
                  </optgroup>
                </select>
              )}
            </div>
          </div>
        </div>

        {/* ── Conversation Timeouts ──────────────────────────────── */}
        <div className="flex h-full flex-col overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-sm">
          <div className="border-b border-neutral-100 px-5 py-4">
            <h3 className="flex items-center gap-2 text-sm font-bold text-neutral-950">
              <Clock3 className="h-4 w-4 shrink-0 text-red-600" strokeWidth={2.25} />
              Conversation Timeouts
            </h3>
            <p className="mt-0.5 text-xs text-neutral-500">
              Control how long the AI waits before acting.
            </p>
          </div>
          <div className="flex flex-1 flex-col justify-center divide-y divide-neutral-100">
            <div className="flex items-center justify-between gap-4 px-5 py-4">
              <label className="text-sm font-semibold text-neutral-950">Max session</label>
              <div className="relative w-28 shrink-0">
                <input
                  type="number"
                  value={maxSessionDuration}
                  min={1}
                  max={MAX_DURATION_SECONDS}
                  step={1}
                  aria-label="Maximum session duration in seconds"
                  onChange={(event) =>
                    setMaxSessionDuration(
                      normalizeBoundedIntegerInput(event.target.value, MAX_DURATION_SECONDS),
                    )
                  }
                  onBlur={() => setMaxSessionDuration((value) => (value === '' ? 1 : value))}
                  className={cx(numberFieldClass, 'pr-9')}
                />
                <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] font-bold uppercase text-neutral-400">
                  sec
                </span>
              </div>
            </div>
            <div className="flex items-center justify-between gap-4 px-5 py-4">
              <label className="text-sm font-semibold text-neutral-950">Idle reminder</label>
              <div className="relative w-28 shrink-0">
                <input
                  type="number"
                  value={idleReminder}
                  min={1}
                  max={MAX_DURATION_SECONDS}
                  step={1}
                  aria-label="Idle reminder delay in seconds"
                  onChange={(event) =>
                    setIdleReminder(
                      normalizeBoundedIntegerInput(event.target.value, MAX_DURATION_SECONDS),
                    )
                  }
                  onBlur={() => setIdleReminder((value) => (value === '' ? 1 : value))}
                  className={cx(numberFieldClass, 'pr-9')}
                />
                <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] font-bold uppercase text-neutral-400">
                  sec
                </span>
              </div>
            </div>
            <div className="flex items-center justify-between gap-4 px-5 py-4">
              <label className="text-sm font-semibold text-neutral-950">Reminder retries</label>
              <div className="relative w-28 shrink-0">
                <input
                  type="number"
                  value={idleReminderRetry}
                  min={1}
                  max={MAX_IDLE_REMINDER_RETRIES}
                  step={1}
                  aria-label="Idle reminder retry count"
                  onChange={(event) =>
                    setIdleReminderRetry(
                      normalizeBoundedIntegerInput(event.target.value, MAX_IDLE_REMINDER_RETRIES),
                    )
                  }
                  onBlur={() => setIdleReminderRetry((value) => (value === '' ? 1 : value))}
                  className={cx(numberFieldClass, 'pr-14')}
                />
                <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] font-bold uppercase text-neutral-400">
                  tries
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Data Collection ──────────────────────────────── */}
      <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-sm">
        <div className="flex items-start justify-between gap-4 px-5 pt-5 pb-4">
          <div>
            <div className="flex items-center gap-1.5">
              <h3 className="flex items-center gap-2 text-sm font-bold text-neutral-950">
                <FileText className="h-4 w-4 shrink-0 text-red-600" strokeWidth={2.25} />
                Data Collection
              </h3>
              <button
                type="button"
                onClick={() => setShowDataCollectionHelp((prev) => !prev)}
                aria-expanded={showDataCollectionHelp}
                className="inline-flex h-4 w-4 items-center justify-center rounded-full text-neutral-400 transition-colors hover:text-neutral-900"
                aria-label='When should I mark a field "Mandatory" vs "Optional"?'
              >
                <Info className="h-3.5 w-3.5" />
              </button>
            </div>
            <p className="mt-1 text-xs leading-5 text-neutral-500">
              When enabled, the AI politely asks callers for the details below and stores them on
              the call record.
            </p>
          </div>
          <ToggleSwitch
            checked={isDataCollectionEnabled}
            onCheckedChange={(checked) => setIsDataCollectionEnabled(checked)}
            disabled={isReadOnly}
            className="mt-0.5"
          />
        </div>

        {isDataCollectionEnabled && showDataCollectionHelp && (
          <div className="mx-5 mb-4 rounded-lg border border-neutral-200/60 bg-neutral-100 p-4">
            <p className="flex items-center gap-2 text-xs font-bold text-neutral-700">
              <Info className="h-3.5 w-3.5 shrink-0 text-neutral-600" />
              When should I mark a field "Mandatory" vs "Optional"?
            </p>
            <p className="mt-2 text-xs leading-5 text-neutral-600">
              <strong className="text-neutral-950">Mandatory</strong> — the AI keeps politely
              re-asking until the caller answers. Use for fields you really need (e.g.{' '}
              <span className="font-semibold text-neutral-600">Email</span> for follow-ups).
            </p>
            <p className="mt-2 text-xs leading-5 text-neutral-600">
              <strong className="text-neutral-950">Optional</strong> — the AI asks once and moves
              on if declined. Use for nice-to-have data (e.g.{' '}
              <span className="font-semibold text-neutral-600">Date of birth</span>).
            </p>
            <p className="mt-2 text-xs leading-5 text-neutral-600">
              <strong className="text-neutral-950">Disabled</strong> — the AI never asks for this
              field at all.
            </p>
          </div>
        )}

        {/* Fields grid */}
        <div className="border-t border-neutral-100">
          {[
            { key: 'name' as DetailField, label: 'Name', alwaysAsked: true },
            { key: 'phone' as DetailField, label: 'Phone', alwaysAsked: true },
            { key: 'email' as DetailField, label: 'Email', alwaysAsked: false },
            { key: 'dob' as DetailField, label: 'Date of Birth', alwaysAsked: false },
            { key: 'address' as DetailField, label: 'Address', alwaysAsked: false },
          ]
            .filter(
              ({ key }) =>
                isDataCollectionEnabled || DISABLED_DATA_COLLECTION_DETAIL_FIELDS.includes(key),
            )
            .map(({ key, label, alwaysAsked }) => {
              const isAlwaysAsked = alwaysAsked || ALWAYS_ASKED_DETAIL_FIELDS.has(key);
              const isChecked = isAlwaysAsked || detailsToCollect.includes(key);
              const mandatory = isAlwaysAsked ? 'mandatory' : detailsMandatory[key];
              const fieldState: 'disabled' | 'optional' | 'mandatory' = !isChecked
                ? 'disabled'
                : mandatory === 'mandatory'
                  ? 'mandatory'
                  : 'optional';

              return (
                <div
                  key={key}
                  className="flex flex-wrap items-center justify-between gap-3 border-b border-neutral-100 px-5 py-3 last:border-b-0"
                >
                  <span
                    className={cx(
                      'text-sm font-semibold',
                      isChecked ? 'text-neutral-900' : 'text-neutral-400',
                    )}
                  >
                    {label}
                  </span>

                  {isAlwaysAsked ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-neutral-100 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-neutral-500">
                      <Lock className="h-2.5 w-2.5" />
                      Always Collected
                    </span>
                  ) : (
                    <div className="relative grid w-[288px] shrink-0 grid-cols-3 rounded-full bg-neutral-100 p-0.5">
                      {/* One pill that slides between the three options, rather than
                          three that pop on and off — the movement shows which way the
                          setting travelled. */}
                      <span
                        aria-hidden="true"
                        className="absolute top-0.5 bottom-0.5 w-[calc((100%-4px)/3)] rounded-full bg-white shadow-[0_1px_3px_rgba(0,0,0,.08)] transition-all duration-200 ease-out"
                        style={{
                          left: `calc(2px + ${['disabled', 'optional', 'mandatory'].indexOf(
                            fieldState,
                          )} * ((100% - 4px) / 3))`,
                        }}
                      />
                      {(['disabled', 'optional', 'mandatory'] as const).map((state) => (
                        <button
                          key={state}
                          type="button"
                          disabled={isReadOnly}
                          onClick={() => {
                            if (state === 'disabled') {
                              toggleSingleDetail(key, false);
                              return;
                            }
                            if (!isChecked) toggleSingleDetail(key, true);
                            setDetailsMandatory((prev) => ({ ...prev, [key]: state }));
                          }}
                          className={cx(
                            'relative z-10 rounded-full px-2.5 py-1 text-[11px] font-bold capitalize transition-colors',
                            fieldState === state
                              ? state === 'mandatory'
                                ? 'text-red-600!'
                                : 'text-neutral-900!'
                              : 'text-neutral-400 hover:text-neutral-700',
                          )}
                        >
                          {state}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
        </div>
      </div>

      {renderFooter()}
    </div>
    );
  };

  const renderOverview = () => (
    <ReceptionistOverview
      data={initialData}
      documents={knowledgeDocuments}
      faqs={knowledgeFaqs}
      sourceCount={sourceRecords.length}
      callerId={initialData?.did_uuid?.[0]?.did_number || 'Unassigned'}
      voice={selectedVoiceOption?.label || selectedPersona}
      language={selectedLanguage}
      hours={
        operationalHours?.type === '24_hours'
          ? '24 Hours'
          : getWeeklyScheduleName(operationalHours?.value) || 'Not configured'
      }
      forwardType={committedForwardTypeLabel}
      manager={
        managerExtensions.find((ext: any) => (ext.uuid || ext.id) === selectedManagerId)
          ? `${managerExtensions.find((ext: any) => (ext.uuid || ext.id) === selectedManagerId)?.first_name || ''} ${
              managerExtensions.find((ext: any) => (ext.uuid || ext.id) === selectedManagerId)
                ?.last_name || ''
            }`.trim()
          : '-'
      }
      maxSession={`${normalizeBoundedInteger(maxSessionDuration, 1, MAX_DURATION_SECONDS)} sec`}
      onEditRouting={isReadOnly ? undefined : () => handleEditTabChange('advanced')}
    />
  );

  const renderStep = () => {
    if (activeStep === 1) return renderBasicsStep();
    if (activeStep === 2) return renderVoiceStep();
    if (activeStep === 3) return renderGreetingHoursStep();
    if (activeStep === 4) return renderKnowledgeStep();
    if (activeStep === 5) return renderReviewStep();
    return renderAdvancedStep();
  };

  const useEditWorkspace = isEdit && !useWizardEdit;
  const content = useEditWorkspace && editTab === 'overview' ? renderOverview() : renderStep();

  return (
    <FormProvider {...formInstance}>
      <section className="flex h-full min-h-0 w-full flex-col overflow-hidden bg-[#efefef] text-neutral-900">
        {!useEditWorkspace && (
          <div className="border-b border-neutral-200 bg-white">
            {useWizardEdit ? (
              <div className="flex min-h-[72px] items-center justify-end px-3 py-3 sm:px-6">
                <Button type="button" variant="outline" onClick={onCancel}>
                  Cancel
                </Button>
              </div>
            ) : (
              <div className="px-6 pt-4 pb-1">
                <div
                  style={{
                    fontFamily: '"Instrument Serif", Georgia, serif',
                    fontStyle: 'italic',
                    fontWeight: 400,
                    fontSize: '27px',
                    lineHeight: '41px',
                    color: 'rgb(23, 23, 23)',
                  }}
                >
                  {isEdit ? receptionistName || 'Edit Receptionist' : 'New Receptionist'}
                </div>
              </div>
            )}
            <ReceptionistStepper
              activeStep={activeStep}
              sourceStage={sourceStage}
              onChange={(step, stage) => void handleStepperChange(step, stage)}
              disabled={isKnowledgeSummaryNavigationLocked}
            />
          </div>
        )}
        {useEditWorkspace && (
          <>
            <ReceptionistEditHeader
              data={editHeaderAgentData}
              companyBrand={companyBrand}
              callerId={initialData?.did_uuid?.[0]?.did_number || ''}
              onAssignCallerId={() => setEditHeaderCallerAgent(editHeaderAgentData)}
              onUpdateAgent={() => void handleHeaderUpdateAgent()}
              isUpdating={isSubmitting || isPendingToken || isCreatingKnowledgeSources}
              updateDisabled={isKnowledgeSummaryNavigationLocked}
              readOnly={isReadOnly}
            />
            <ReceptionistEditTabs
              activeTab={editTab}
              onTabChange={handleEditTabChange}
              disabled={isKnowledgeSummaryNavigationLocked}
            />
          </>
        )}
        {isReadOnly ? (
          <fieldset
            disabled
            className="min-h-0 flex-1 overflow-y-auto border-0 px-3 py-4 sm:px-4 sm:py-5"
          >
            {content}
          </fieldset>
        ) : (
          <div className="min-h-0 flex-1 overflow-y-auto px-3 py-4 sm:px-4 sm:py-5">{content}</div>
        )}
      </section>

      {!isReadOnly && (
        <>
          <AddKnowledgeBaseDialog
            open={isAddKnowledgeOpen}
            onOpenChange={setIsAddKnowledgeOpen}
            onScanWebsite={() => {
              setIsAddKnowledgeOpen(false);
              setKnowledgeWebsiteMode('scan');
              setSourceStage(1);
              if (isEdit) handleEditTabChange('knowledge');
            }}
            onUploadPdf={() => {
              setIsAddKnowledgeOpen(false);
              pendingFileInputRef.current?.click();
            }}
            onUseExisting={() => {
              setIsAddKnowledgeOpen(false);
              setKnowledgeWebsiteMode('picker');
              setSourceStage(1);
              if (isEdit) handleEditTabChange('knowledge');
            }}
            customContentTitle={customContentTitle}
            setCustomContentTitle={setCustomContentTitle}
            customContent={customContent}
            setCustomContent={setCustomContent}
            onAddCustomContent={handleAddCustomContent}
            isAddingCustomContent={false}
          />
          <AssignReceptionistCallerIdModal
            open={Boolean(editHeaderCallerAgent)}
            receptionistData={editHeaderCallerAgent}
            onClose={() => setEditHeaderCallerAgent(null)}
          />
          {modalState.bussinessHoursModal && (
            <BussinessHoursModal
              modalState={modalState.bussinessHoursModal}
              setModalState={() => closeModal('bussinessHoursModal')}
              setError={(value) => setBussinessHourError(value)}
              data={{ settings: { operational_hours: operationalHours } }}
              aiMode={true}
            />
          )}
          <Dialog
            open={isForwardDestinationModalOpen}
            onOpenChange={(open) => {
              if (open) {
                setIsForwardDestinationModalOpen(true);
                return;
              }
              if (isForwardModalSavingRef.current) {
                isForwardModalSavingRef.current = false;
                setIsForwardDestinationModalOpen(false);
                return;
              }
              handleCancelForwardDestinationEdit();
            }}
          >
            <DialogContent className={cx('max-w-[620px] bg-white!', DIALOG_CLOSE_BUTTON_CLASS)}>
              <DialogHeader>
                <DialogTitle>Edit Forwarding Destination</DialogTitle>
              </DialogHeader>
              <ForwardActionAllAi
                setValue={handleForwardDestinationValueChange}
                watch={watch}
                forwardType="callRules.forwardCall.type"
                forwardValue="callRules.forwardCall.value"
                enableVoicemailChoice={true}
                voicemailPersonalField="callRules.forwardCall.personal"
                optionsData={forwardingOptionsData}
                userExtension={user?.user_info?.extension || ''}
                forwardTypeLabel="Forward Type"
                forwardValueLabel={forwardValueFieldLabel}
                forwardTypeError={(errors as any)?.callRules?.forwardCall?.type?.message || ''}
                forwardValueError={(errors as any)?.callRules?.forwardCall?.value?.message || ''}
                forwardTypeClass="w-full mb-3"
                forwardValueClass="w-full"
                selectCustomClassSecond="w-full"
              />
              <DialogFooter className="flex-row! items-center justify-end!">
                <Button
                  variant="outline"
                  className="rounded-full! border-neutral-200! bg-white! text-neutral-700! shadow-none! hover:border-neutral-300! hover:bg-neutral-50!"
                  onClick={handleCancelForwardDestinationEdit}
                >
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  className="rounded-full! border-red-600! bg-red-600! text-white! shadow-[0_2px_10px_rgba(220,38,38,.25)]! hover:bg-red-700!"
                  onClick={handleSaveForwardDestinationEdit}
                >
                  Save
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          {renderReviewKnowledgeModals()}
        </>
      )}
      <WebsiteScanProgressModal
        open={websiteScanProgressStatus !== 'idle'}
        status={websiteScanProgressStatus}
      />
      <WizardLeaveConfirmModal
        open={showLeaveWizardModal}
        onStay={cancelWizardLeave}
        onDiscard={confirmWizardLeave}
      />
    </FormProvider>
  );
}

function ReceptionistEditHeader({
  data,
  companyBrand,
  callerId,
  onAssignCallerId,
  onUpdateAgent,
  isUpdating,
  updateDisabled = false,
  readOnly,
}: {
  data: any;
  companyBrand: string;
  callerId: string;
  onAssignCallerId: () => void;
  onUpdateAgent: () => void;
  isUpdating: boolean;
  updateDisabled?: boolean;
  readOnly: boolean;
}) {
  const name = data?.agentName || 'AI Receptionist';
  const isDeleted = Boolean(data?.deletedAt || data?.deleted_at);
  const brand =
    companyBrand ||
    data?.companyName ||
    data?.company_name ||
    data?.businessName ||
    data?.business_name ||
    data?.agentType ||
    'AI Receptionist';
  const callsThisWeek = pickNumber(
    data,
    ['calls_handled', 'analytics.calls_7d', 'calls_7d', 'call_count', 'callCount'],
    0,
  );
  const rawResolution = pickNumber(
    data,
    ['analytics.resolution_rate', 'resolution_rate', 'resolutionRate'],
    0,
  );
  const resolution = rawResolution > 0 && rawResolution <= 1 ? rawResolution * 100 : rawResolution;
  const sentimentCalls = Number(data?.sentiment_calls || 0);
  const sentimentScore = Number(data?.avg_sentiment || 0);
  const sentimentLabel =
    normalizeSentiment(data?.sentiment_label) || sentimentLabelFromScore(sentimentScore);

  return (
    <div className=" bg-white px-4 pt-4 pb-2 ">
      <div className="flex flex-wrap items-center gap-4">
        <CustomAvatar
          name={name}
          image={getReceptionistAvatarImage(data)}
          size="56"
          showPresence={false}
          isActivityInfo={false}
          textClass="text-base"
        />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="truncate text-lg font-bold text-neutral-950">{name}</h2>
            <span
              className={cx(
                'inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold',
                isDeleted ? 'bg-red-50 text-red-600' : 'bg-emerald-50 text-emerald-600',
              )}
            >
              <span className="h-1.5 w-1.5 rounded-full bg-current" />
              {isDeleted ? 'Deleted' : 'Live'}
            </span>
            {!readOnly && (
              <Button
                type="button"
                size="sm"
                className="h-8 bg-red-600 text-white hover:bg-red-600/90 hover:text-white"
                disabled={isUpdating || updateDisabled}
                onClick={onUpdateAgent}
              >
                {isUpdating ? (
                  <span className="inline-flex items-center gap-2">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Updating...
                  </span>
                ) : (
                  'Update Agent'
                )}
              </Button>
            )}
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-2 text-xs text-neutral-600">
            <span className="inline-flex items-center gap-1.5">
              <FileText className="h-4 w-4 text-red-600" />
              {brand}
            </span>
            <span className="inline-flex items-center gap-1.5 text-left font-medium text-neutral-600">
              <Phone className="h-3.5 w-3.5 text-pink-500" />
              {readOnly ? (
                callerId ? (
                  <NumberWithFlag number={callerId} />
                ) : (
                  'Caller Id unassigned'
                )
              ) : (
                <button type="button" onClick={onAssignCallerId} className="hover:text-red-600">
                  {callerId ? <NumberWithFlag number={callerId} /> : '+ Assign Caller Id'}
                </button>
              )}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <MessageSquare className="h-4 w-4 text-violet-400" />
              {callsThisWeek.toLocaleString()} calls this week
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Sparkles className="h-4 w-4 text-orange-500" />
              {formatPercent(resolution)} resolution
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span
                className={cx(
                  'h-2 w-2 rounded-full',
                  sentimentLabel === 'positive' && 'bg-emerald-500',
                  sentimentLabel === 'negative' && 'bg-red-500',
                  sentimentLabel === 'neutral' && 'bg-neutral-400',
                  !sentimentLabel && 'bg-neutral-300',
                )}
              />
              Sentiment:{' '}
              {sentimentCalls
                ? `${sentimentLabel || 'neutral'} · ${sentimentScore.toFixed(1)}`
                : 'Not analyzed'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

function ReceptionistStepper({
  activeStep,
  sourceStage = 1,
  onChange,
  disabled = false,
}: {
  activeStep: ReceptionistStep;
  sourceStage?: SourceStage;
  onChange: (step: ReceptionistStep, stage: SourceStage) => void;
  disabled?: boolean;
}) {
  const steps = [
    { id: 1, label: 'Basics', stepVal: 1, stageVal: 1 },
    { id: 2, label: 'Voice & Persona', stepVal: 2, stageVal: 1 },
    { id: 3, label: 'Greeting & Hours', stepVal: 3, stageVal: 1 },
    { id: 4, label: 'Website', stepVal: 4, stageVal: 1 },
    { id: 5, label: 'Pick pages', stepVal: 4, stageVal: 2 },
    { id: 6, label: 'Review', stepVal: 5, stageVal: 3 },
    { id: 7, label: 'Advanced Settings', stepVal: 6, stageVal: 1 },
  ];

  let currentStepId = 1;
  if (activeStep === 1) currentStepId = 1;
  else if (activeStep === 2) currentStepId = 2;
  else if (activeStep === 3) currentStepId = 3;
  else if (activeStep === 4) currentStepId = sourceStage === 2 ? 5 : 4;
  else if (activeStep === 5) currentStepId = 6;
  else if (activeStep === 6) currentStepId = 7;

  return (
    <div className="px-6 pt-1 pb-3.5">
      <div className="mx-auto flex max-w-[1200px] flex-wrap items-center justify-center gap-x-4 gap-y-1">
        {steps.map((step, index) => {
          const isActive = step.id === currentStepId;
          // Steps already walked through stay black so the trail behind you is
          // readable; the ones still ahead sit back in grey.
          const isVisited = step.id < currentStepId;

          return (
            <Fragment key={step.id}>
              {index > 0 && (
                <span aria-hidden="true" className="shrink-0 select-none text-sm! font-medium! text-neutral-400!">
                  &gt;
                </span>
              )}
              <button
                type="button"
                onClick={() =>
                  onChange(step.stepVal as ReceptionistStep, step.stageVal as SourceStage)
                }
                disabled={disabled}
                className={cx(
                  // The bang suffixes are load-bearing: a global button rule
                  // outranks these utilities otherwise, and the greys silently
                  // render as near-black.
                  'shrink-0 text-sm! transition-colors focus:outline-none',
                  disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer',
                  isActive
                    ? 'font-semibold! text-red-600!'
                    : isVisited
                      ? 'font-medium! text-neutral-900!'
                      : 'font-medium! text-neutral-400!',
                )}
              >
                {step.label}
              </button>
            </Fragment>
          );
        })}
      </div>
    </div>
  );
}

function ReceptionistEditTabs({
  activeTab,
  onTabChange,
  disabled = false,
}: {
  activeTab: ReceptionistEditTab;
  onTabChange: (tab: ReceptionistEditTab) => void;
  disabled?: boolean;
}) {
  const overviewTab = {
    key: 'overview' as const,
    label: 'Overview',
    icon: <Settings2 className="h-4 w-4" />,
  };
  const stepTabs: Array<{ key: WizardReceptionistTab; label: string; icon: ReactNode }> = [
    { key: 'basics', label: 'Basics', icon: <UserRound className="h-4 w-4" /> },
    { key: 'voice', label: 'Voice & Persona', icon: <Headphones className="h-4 w-4" /> },
    { key: 'greeting-hours', label: 'Greeting & Hours', icon: <Phone className="h-4 w-4" /> },
    { key: 'knowledge', label: 'Knowledge Base', icon: <FileText className="h-4 w-4" /> },
    { key: 'summary', label: 'Review', icon: <Check className="h-4 w-4" /> },
    { key: 'advanced', label: 'Advanced Settings', icon: <ArrowRight className="h-4 w-4" /> },
  ];
  return (
    <div className="border-b border-neutral-200 bg-white px-4">
      <div className="flex gap-1 overflow-x-auto">
        <button
          type="button"
          onClick={() => onTabChange(overviewTab.key)}
          disabled={disabled}
          className={cx(
            'flex h-12 shrink-0 items-center gap-2 border-b-2 px-4 text-sm font-semibold transition-colors',
            activeTab === overviewTab.key
              ? 'border-red-600! text-red-600!'
              : 'border-transparent text-neutral-500 hover:text-red-600!',
            disabled && 'cursor-not-allowed opacity-60 hover:text-neutral-500!',
          )}
        >
          <span
            className={cx(
              'flex h-6 w-6 shrink-0 items-center justify-center rounded-md [&_svg]:h-3.5 [&_svg]:w-3.5',
              activeTab === overviewTab.key
                ? 'bg-red-600/5 text-red-600'
                : 'bg-neutral-100 text-neutral-600',
            )}
          >
            {overviewTab.icon}
          </span>
          {overviewTab.label}
        </button>
        {/* <span className="my-3 h-6 w-px shrink-0 bg-neutral-200" /> */}
        {stepTabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => onTabChange(tab.key)}
            disabled={disabled}
            className={cx(
              'flex h-12 shrink-0 items-center gap-2 border-b-2 px-4 text-sm font-semibold transition-colors',
              activeTab === tab.key
                ? 'border-red-600! text-red-600!'
                : 'border-transparent text-neutral-500 hover:text-red-600!',
              disabled && 'cursor-not-allowed opacity-60 hover:text-neutral-500!',
            )}
          >
            <span
              className={cx(
                'flex h-6 w-6 shrink-0 items-center justify-center rounded-md [&_svg]:h-3.5 [&_svg]:w-3.5',
                activeTab === tab.key
                  ? 'bg-red-600/5 text-red-600'
                  : 'bg-neutral-100 text-neutral-600',
              )}
            >
              {tab.icon}
            </span>
            {tab.label}
          </button>
        ))}
      </div>
    </div>
  );
}

const getCallSourceLabel = (call: any) => {
  const room = String(call?.room || call?.sessionId || call?.session_id || '').toLowerCase();
  const source = String(call?.source || call?.source_type || call?.origin || '').toLowerCase();

  if (room.startsWith('embed-agent-') || source.includes('playground')) {
    return 'Playground';
  }

  return 'SIP call';
};

function ReceptionistOverview({
  data,
  documents,
  faqs,
  sourceCount,
  callerId,
  voice,
  language,
  hours,
  forwardType,
  manager,
  maxSession,
  onEditRouting,
}: {
  data: any;
  documents: KnowledgeDocument[];
  faqs: KnowledgeFaq[];
  sourceCount: number;
  callerId: string;
  voice: string;
  language: string;
  hours: string;
  forwardType: string;
  manager: string;
  maxSession: string;
  onEditRouting?: () => void;
}) {
  const agentUuid = data?.agent_uuid || data?.uuid || '';

  const { data: recentCallsData, isLoading: isLoadingRecentCalls } = useQuery({
    queryKey: ['receptionistRecentCalls', agentUuid],
    queryFn: () =>
      callList({
        page: 1,
        limit: 5,
        filter: [
          {
            key: 'forward_type',
            value: 'AI',
          },
          {
            key: 'forward_value',
            value: agentUuid,
          },
        ],
        filter_date: {},
      }),
    enabled: !!agentUuid,
    select: (res: any) => res?.data?.data?.result?.rows || [],
  });
  const { data: recentSessionData, isLoading: isLoadingRecentSessions } = useQuery({
    queryKey: ['receptionistRecentCallSessions', agentUuid],
    queryFn: () => getSessionList({ agentId: agentUuid, limit: 5 }),
    enabled: !!agentUuid,
    select: (res: any) => res?.data?.data?.sessions || [],
  });

  const recentCalls = useMemo(() => {
    if (Array.isArray(recentSessionData) && recentSessionData.length) {
      return recentSessionData.map((call: any) => ({
        ...call,
        phone: getCallSourceLabel(call),
        via_did: '-',
        durationSeconds: Math.round(Number(call.durationMs || 0) / 1000),
        startedAt: call.createdAt,
        status:
          String(call.status || '').toLowerCase() === 'ended'
            ? 'Ended'
            : String(call.status || 'Active'),
      }));
    }
    if (!recentCallsData) return [];
    return recentCallsData.map((call: any) => ({
      ...call,
      phone: getCallSourceLabel(call),
      durationSeconds: Number(call.duration || 0),
      startedAt: call.start_stamp,
      status:
        call.status === 'SUCCESS'
          ? 'Answered'
          : call.status?.toLowerCase()?.replaceAll('_', ' ') || 'Recorded',
    }));
  }, [recentCallsData, recentSessionData]);

  const stats = [
    {
      label: 'Calls (7d)',
      value: String(
        pickNumber(data, ['calls_handled', 'analytics.calls_7d', 'calls_7d', 'call_count'], 0),
      ),
    },
    {
      label: 'Resolution rate',
      value: formatPercent(pickNumber(data, ['analytics.resolution_rate', 'resolution_rate'], 0)),
    },
    { label: 'Handoffs', value: String(pickNumber(data, ['analytics.handoffs', 'handoffs'], 0)) },
    {
      label: 'Avg duration',
      value: formatDuration(
        pickNumber(
          data,
          ['average_call_duration', 'analytics.avg_call_duration', 'avg_call_duration'],
          0,
        ),
      ),
    },
  ];

  const unanswered = Array.isArray(data?.unanswered_questions) ? data.unanswered_questions : [];

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-3 sm:grid-cols-4 xl:grid-cols-4">
        {stats.map((stat) => (
          <StatCard key={stat.label} label={stat.label} value={stat.value} />
        ))}
      </div>
      <div className="grid gap-4 xl:grid-cols-[1fr_420px]">
        <div className="flex flex-col gap-4">
          <OverviewPanel title="Recent calls">
            {isLoadingRecentCalls || isLoadingRecentSessions ? (
              <div className="flex justify-center py-6">
                <Loader2 className="h-5 w-5 animate-spin text-red-600" />
              </div>
            ) : recentCalls.length ? (
              <div className="flex flex-col divide-y divide-neutral-100">
                <div className="grid grid-cols-[1.4fr_1fr_0.8fr_1fr_0.8fr] pb-2 text-xs font-bold uppercase tracking-wider text-neutral-500 px-1">
                  <span>Call</span>
                  <span>DID</span>
                  <span>Duration</span>
                  <span>Sentiment</span>
                  <span className="text-right">Status</span>
                </div>
                {recentCalls.slice(0, 5).map((call: any, index: number) => (
                  <div
                    key={call.id || index}
                    className="grid grid-cols-[1.4fr_1fr_0.8fr_1fr_0.8fr] items-center py-3 text-sm px-1"
                  >
                    <div className="flex flex-col gap-0.5">
                      <span className="font-semibold text-neutral-900">{call.phone}</span>
                      {call.startedAt && (
                        <span className="text-xs text-neutral-400">
                          {moment(call.startedAt).format('MMM DD, hh:mm A')}
                        </span>
                      )}
                    </div>
                    <span className="text-neutral-600 truncate pr-2">{call.via_did || '-'}</span>
                    <span className="text-neutral-600">{formatDuration(call.durationSeconds)}</span>
                    <div>
                      {(() => {
                        const sentiment = getCallSentiment(call);
                        const scores = sentimentScoreText(call.sentiment_scores);
                        return (
                          <span
                            title={scores}
                            className={`inline-flex rounded-full px-2 py-1 text-xs font-bold capitalize ${sentimentBadgeClass(sentiment)}`}
                          >
                            {sentiment || 'Not analyzed'}
                          </span>
                        );
                      })()}
                    </div>
                    <div className="flex justify-end">
                      <span className="rounded-full bg-emerald-100 px-2 py-1 text-xs font-bold text-emerald-700 capitalize">
                        {call.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <NoDataAvailable />
            )}
          </OverviewPanel>
          <OverviewPanel title="Unanswered questions">
            {unanswered.length ? (
              <div className="flex flex-col divide-y divide-neutral-100">
                {unanswered.slice(0, 5).map((question: any, index: number) => (
                  <div
                    key={question.id || index}
                    className="flex items-center justify-between py-3 text-sm"
                  >
                    <span>{question.question || question.title || question}</span>
                    <span className="rounded-full bg-red-100 px-2 py-1 text-xs font-bold text-red-700">
                      {question.count ? `${question.count}x` : 'Open'}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <NoDataAvailable />
            )}
          </OverviewPanel>
        </div>
        <div className="flex flex-col gap-4">
          <OverviewPanel title="Quick stats">
            <KeyValue label="Caller ID" value={callerId} />
            <KeyValue label="Voice" value={voice} />
            <KeyValue label="Language" value={language} />
            <KeyValue label="Hours" value={hours} />
            <KeyValue label="Knowledge sources" value={String(sourceCount)} />
          </OverviewPanel>
          <OverviewPanel title="Configuration">
            <KeyValue label="Forward Type" value={forwardType} />
            <KeyValue label="Manager" value={manager} />
            <KeyValue label="Documents" value={String(documents.length)} />
            <KeyValue label="FAQs" value={String(faqs.length)} />
            <KeyValue label="Max session" value={maxSession} />
            {onEditRouting && (
              <button
                type="button"
                onClick={onEditRouting}
                className="mt-3 h-9 w-full rounded-md border border-neutral-300 text-sm font-bold text-neutral-700 transition-colors hover:border-red-600 hover:text-red-600"
              >
                Edit routing
              </button>
            )}
          </OverviewPanel>
        </div>
      </div>
    </div>
  );
}

function AddKnowledgeBaseDialog({
  open,
  onOpenChange,
  onScanWebsite,
  onUploadPdf,
  onUseExisting,
  customContentTitle,
  setCustomContentTitle,
  customContent,
  setCustomContent,
  onAddCustomContent,
  isAddingCustomContent,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onScanWebsite: () => void;
  onUploadPdf: () => void;
  onUseExisting: () => void;
  customContentTitle: string;
  setCustomContentTitle: (value: string) => void;
  customContent: string;
  setCustomContent: (value: string) => void;
  onAddCustomContent: () => void;
  isAddingCustomContent: boolean;
}) {
  const [mode, setMode] = useState<'menu' | 'custom'>('menu');
  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) setMode('menu');
        onOpenChange(nextOpen);
      }}
    >
      <DialogContent className="max-w-[720px] p-0" showCloseButton={false}>
        <DialogHeader className="border-b border-neutral-200 px-5 py-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <DialogTitle className="text-base font-bold text-neutral-950">
                Create new knowledge base
              </DialogTitle>
              <p className="mt-1 text-sm text-neutral-500">
                Add website pages, upload documents, or paste custom content.
              </p>
            </div>
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="rounded-md p-1 text-neutral-400 hover:bg-neutral-100"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </DialogHeader>
        {mode === 'menu' ? (
          <div className="grid gap-3 p-5 sm:grid-cols-2">
            <KnowledgeActionCard
              icon={<Globe2 className="h-5 w-5" />}
              title="Scan website"
              copy="Discover public pages and choose which ones to train on."
              onClick={onScanWebsite}
            />
            <KnowledgeActionCard
              icon={<UploadCloud className="h-5 w-5" />}
              title="Upload PDF"
              copy="Create a document knowledge base from uploaded files."
              onClick={onUploadPdf}
            />
            <KnowledgeActionCard
              icon={<FileText className="h-5 w-5" />}
              title="Paste content"
              copy="Create a text knowledge base from custom content."
              onClick={() => setMode('custom')}
            />
            <KnowledgeActionCard
              icon={<Search className="h-5 w-5" />}
              title="Use existing"
              copy="Select from knowledge base records already in your account."
              onClick={onUseExisting}
            />
          </div>
        ) : (
          <div className="flex flex-col gap-4 p-5">
            <Field label="Name">
              <input
                value={customContentTitle}
                onChange={(event) => setCustomContentTitle(event.target.value)}
                className="h-10 w-full rounded-xl border border-neutral-300 px-3 text-sm outline-none! focus:border-red-400 focus:ring-4 focus:ring-red-100"
              />
            </Field>
            <Field label="Content">
              <textarea
                value={customContent}
                onChange={(event) => setCustomContent(event.target.value)}
                placeholder="Paste FAQs, policies, company details, or support instructions..."
                className="min-h-[190px] w-full resize-y rounded-xl border border-neutral-300 p-3 text-sm outline-none! focus:border-red-400 focus:ring-4 focus:ring-red-100"
              />
            </Field>
            <div className="flex items-center justify-between">
              <Button variant="outline" onClick={() => setMode('menu')}>
                <ArrowLeft className="h-4 w-4" />
                Back
              </Button>
              <Button
                disabled={!customContent.trim() || isAddingCustomContent}
                onClick={onAddCustomContent}
              >
                {isAddingCustomContent ? 'Adding...' : 'Add content'}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function KnowledgeActionCard({
  icon,
  title,
  copy,
  onClick,
}: {
  icon: ReactNode;
  title: string;
  copy: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-lg border border-neutral-200 bg-white p-4 text-left transition-colors hover:border-red-600"
    >
      <span className="flex h-9 w-9 items-center justify-center rounded-md bg-red-600/5 text-red-600">
        {icon}
      </span>
      <span className="mt-3 block text-sm font-bold text-neutral-950">{title}</span>
      <span className="mt-1 block text-sm leading-5 text-neutral-500">{copy}</span>
    </button>
  );
}

function SourceAnalysisList({ records }: { records: SourceRecord[] }) {
  if (!records.length) return <NoRecordFound />;
  return (
    <div className="overflow-hidden rounded-lg border border-neutral-200 bg-white">
      <div className="border-b border-neutral-100 px-4 py-3">
        <p className="text-sm font-bold text-neutral-950">Sources</p>
      </div>
      {records.map((record) => (
        <div
          key={record.id}
          className="flex items-center gap-3 border-b border-neutral-100 px-4 py-3 text-sm last:border-b-0"
        >
          <Check className="h-4 w-4 shrink-0 text-emerald-500" />
          <span className="min-w-0 flex-1 truncate font-semibold text-neutral-950">
            {record.title}
          </span>
          <span className="text-xs text-neutral-500">{record.type}</span>
          <span className="max-w-[260px] truncate text-xs text-neutral-500">{record.source}</span>
        </div>
      ))}
    </div>
  );
}
console.log(SourceAnalysisList);

function SectionHeading({
  title,
  subtitle,
  icon,
}: {
  title: string;
  subtitle: string;
  icon?: ReactNode;
}) {
  return (
    <div>
      <h2 className="flex items-center gap-2 text-lg font-bold tracking-normal text-neutral-950">
        {icon && <span className="shrink-0 text-red-600 [&_svg]:h-[18px] [&_svg]:w-[18px]">{icon}</span>}
        {title}
      </h2>
      <p className="mt-1 text-sm leading-5 text-neutral-500">{subtitle}</p>
    </div>
  );
}

function Field({
  label,
  helper,
  error,
  className,
  fieldKey,
  children,
}: {
  label?: string;
  helper?: string;
  error?: string;
  className?: string;
  fieldKey?: string;
  children: ReactNode;
}) {
  return (
    <label className={cx('block scroll-mt-24', className)} data-validation-key={fieldKey}>
      {label && <span className="mb-1.5 block text-sm font-medium text-neutral-950">{label}</span>}
      {helper && <span className="mb-2 block text-xs text-neutral-500">{helper}</span>}
      {children}
      {error && <span className="mt-1 block text-xs text-red-500">{error}</span>}
    </label>
  );
}

function ToggleSwitch({
  checked,
  onCheckedChange,
  disabled = false,
  className,
}: {
  checked: boolean;
  onCheckedChange?: (checked: boolean) => void;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onCheckedChange?.(!checked)}
      className={cx(
        'relative inline-flex h-6 w-11 shrink-0 items-center rounded-full outline-none! transition-colors disabled:cursor-not-allowed disabled:opacity-50',
        checked ? 'bg-red-600!' : 'bg-neutral-200!',
        className,
      )}
    >
      <span
        className={cx(
          'inline-block h-5 w-5 rounded-full bg-white shadow-sm transition-transform',
          checked ? 'translate-x-[22px]' : 'translate-x-0.5',
        )}
      />
    </button>
  );
}

function ActionCard({
  icon,
  title,
  copy,
  action,
  onClick,
}: {
  icon: ReactNode;
  title: string;
  copy: string;
  action: string;
  onClick: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-neutral-200 p-4">
      <div className="flex min-w-0 items-start gap-3">
        <span className="mt-0.5 text-red-600">{icon}</span>
        <div className="min-w-0">
          <p className="text-sm font-bold text-neutral-950">{title}</p>
          <p className="mt-1 truncate text-xs text-neutral-500">{copy}</p>
        </div>
      </div>
      <Button variant="outline" size="sm" onClick={onClick}>
        {action}
      </Button>
    </div>
  );
}
console.log(ActionCard);

function OverviewPanel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-[0_1px_2px_rgba(0,0,0,.03)]">
      <h3 className="text-base font-bold text-neutral-950">{title}</h3>
      <div className="mt-4">{children}</div>
    </div>
  );
}

function KeyValue({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-neutral-100 py-2 text-sm last:border-b-0">
      <span className="text-neutral-600">{label}</span>
      <strong className="text-right text-neutral-950">{value || '-'}</strong>
    </div>
  );
}

const STAT_TONES = {
  red: { icon: 'bg-red-50 text-red-600', helper: 'bg-red-50 text-red-700' },
  violet: { icon: 'bg-violet-50 text-violet-600', helper: 'bg-violet-50 text-violet-700' },
  blue: { icon: 'bg-blue-50 text-blue-600', helper: 'bg-blue-50 text-blue-700' },
  emerald: { icon: 'bg-green-50 text-green-600', helper: 'bg-green-50 text-green-700' },
  amber: { icon: 'bg-amber-50 text-amber-600', helper: 'bg-amber-50 text-amber-700' },
  rose: { icon: 'bg-rose-50 text-rose-600', helper: 'bg-rose-50 text-rose-700' },
} as const;

function StatCard({
  label,
  value,
  description,
  helper,
  loading = false,
  icon,
  tone = 'red',
}: {
  label: string;
  value: string;
  /** Short, static caption explaining what this metric means. */
  description?: ReactNode;
  /** Short, dynamic callout (e.g. "1 live"). */
  helper?: string;
  loading?: boolean;
  icon?: ReactNode;
  /** Color accent for the icon badge. Each metric gets its own hue so the row reads at a glance. */
  tone?: keyof typeof STAT_TONES;
}) {
  const theme = STAT_TONES[tone] ?? STAT_TONES.red;

  return (
    <div className="relative flex h-full flex-col gap-1.5 rounded-[14px] border border-neutral-200 bg-white p-4 shadow-[0_1px_2px_rgba(0,0,0,.04)] transition-shadow hover:shadow-[0_4px_16px_rgba(0,0,0,.06)]">
      {loading && (
        <div className="absolute inset-0 z-10 flex items-center justify-center rounded-[inherit] bg-white/70 backdrop-blur-[1px]">
          <Loader2 className="h-5 w-5 animate-spin text-neutral-600" />
        </div>
      )}
      <div className="flex items-start justify-between gap-2">
        <p className="text-[12px] font-medium leading-4 text-neutral-500">{label}</p>
        {icon && (
          <span
            className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg [&_svg]:h-4 [&_svg]:w-4 ${theme.icon}`}
          >
            {icon}
          </span>
        )}
      </div>
      <p className="text-[26px] font-bold leading-tight tracking-tight whitespace-nowrap text-neutral-900">
        {value}
      </p>
      {(helper || description) && (
        <div className="mt-auto flex flex-wrap items-center gap-x-1.5 gap-y-1 pt-0.5">
          {helper && (
            <span
              className={`inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[10.5px] font-semibold ${theme.helper}`}
            >
              {helper}
            </span>
          )}
          {description && (
            <span className="text-[11px] font-normal leading-snug text-neutral-400">
              {description}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

function PrimaryButton({
  children,
  onClick,
  disabled = false,
  tone = 'red',
}: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  tone?: 'red' | 'dark' | 'ghost';
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cx(
        'inline-flex h-10 items-center justify-center whitespace-nowrap gap-1.5 rounded-full px-5 text-sm font-semibold transition-colors',
        disabled
          ? 'cursor-not-allowed bg-neutral-100! text-neutral-400! shadow-none!'
          : tone === 'ghost'
            ? 'border! border-neutral-200! bg-neutral-100! text-neutral-700! shadow-none! hover:border-red-200! hover:bg-red-50! hover:text-red-600!'
            : cx(
                'text-white!',
                tone === 'dark'
                  ? 'bg-neutral-900! shadow-[0_2px_10px_rgba(0,0,0,.2)]! hover:bg-neutral-800!'
                  : 'bg-red-600! shadow-[0_2px_10px_rgba(220,38,38,.25)] hover:bg-red-700!',
              ),
      )}
    >
      {children}
    </button>
  );
}

function SecondaryButton({
  children,
  onClick,
  disabled = false,
  tone = 'red',
}: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  tone?: 'red' | 'dark';
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cx(
        'inline-flex h-10 items-center justify-center gap-1.5 rounded-full bg-white! px-5 text-sm font-semibold transition-colors',
        tone === 'dark'
          ? 'border-2! border-neutral-200! text-neutral-950! hover:border-neutral-300! hover:bg-neutral-50!'
          : 'border border-neutral-200! text-neutral-700! hover:border-red-300! hover:bg-neutral-50!',
        disabled && 'cursor-not-allowed opacity-60 hover:border-neutral-200!',
      )}
    >
      {children}
    </button>
  );
}

function NoRecordFound() {
  return (
    <div className="rounded-lg border border-dashed border-neutral-300 bg-white px-5 py-10 text-center text-sm font-medium text-neutral-500">
      No record found.
    </div>
  );
}

function NoDataAvailable() {
  return (
    <div className="rounded-lg border border-dashed border-gray-300 bg-white px-5 py-10 text-center text-sm font-medium text-slate-500">
      No data available
    </div>
  );
}

export default NewAiReceptionistPage;
