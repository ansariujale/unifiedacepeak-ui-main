import { useState, useMemo, useRef, useId, useEffect, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getChatAgentAnalytics } from '@/services/api';
import moment from 'moment';
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  ArrowUpDown,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Download,
  FileText,
  Globe,
  Info,
  Instagram,
  Loader2,
  Mail,
  Minus,
  MoreHorizontal,
  Smartphone,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import CustomAvatar from '@/components/custom/custom-avatar';
import CustomTooltip from '@/components/custom/custom-tooltip';
import {
  ResponsiveContainer,
  ComposedChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  LineChart,
  Line,
  CartesianGrid,
} from 'recharts';
import { downloadAnalyticsSectionAsPdf } from '@/lib/analytics-export';
import { handleAlert } from '@/lib/utils';
// DUMMY DATA - remove this import together with DUMMY_DATA.ts
import { buildDummyChatAnalytics, SHOW_DUMMY_DATA } from '../DUMMY_DATA';

interface AgentAnalyticsProps {
  onClose: () => void;
  agents?: any[];
}

const ANALYTICS_COMING_SOON = false;
const THEME_PRIMARY = '#dc2626';
const THEME_PRIMARY_MUTED = 'color-mix(in oklab, #dc2626 45%, white)';
const FLAG_PREFIX_PATTERN = /^([\u{1F1E6}-\u{1F1FF}]{2}|🌐)\s*/u;
const COUNTRY_CODE_PATTERN = /^[A-Z]{2}$/;

const LANGUAGE_FLAG_BY_KEY: Record<string, string> = {
  en: '🇺🇸',
  english: '🇺🇸',
  hi: '🇮🇳',
  hindi: '🇮🇳',
  es: '🇪🇸',
  spanish: '🇪🇸',
  fr: '🇫🇷',
  french: '🇫🇷',
  de: '🇩🇪',
  german: '🇩🇪',
  pt: '🇧🇷',
  portuguese: '🇧🇷',
  ar: '🇸🇦',
  arabic: '🇸🇦',
  zh: '🇨🇳',
  chinese: '🇨🇳',
  mandarin: '🇨🇳',
  ja: '🇯🇵',
  japanese: '🇯🇵',
  ko: '🇰🇷',
  korean: '🇰🇷',
  it: '🇮🇹',
  italian: '🇮🇹',
  nl: '🇳🇱',
  dutch: '🇳🇱',
  ru: '🇷🇺',
  russian: '🇷🇺',
  bn: '🇧🇩',
  bengali: '🇧🇩',
  pa: '🇮🇳',
  punjabi: '🇮🇳',
  ur: '🇵🇰',
  urdu: '🇵🇰',
  ta: '🇮🇳',
  tamil: '🇮🇳',
  te: '🇮🇳',
  telugu: '🇮🇳',
  mr: '🇮🇳',
  marathi: '🇮🇳',
  gu: '🇮🇳',
  gujarati: '🇮🇳',
};

const getCountryFlag = (countryCode: string) => {
  const normalizedCode = String(countryCode || '')
    .trim()
    .toUpperCase();
  if (normalizedCode === 'UK') return '🇬🇧';
  if (!COUNTRY_CODE_PATTERN.test(normalizedCode)) return '🌐';

  return normalizedCode
    .split('')
    .map((char) => String.fromCodePoint(127397 + char.charCodeAt(0)))
    .join('');
};

const cleanLanguageName = (language: string) =>
  String(language || 'Other')
    .replace(FLAG_PREFIX_PATTERN, '')
    .trim() || 'Other';

const getLanguageFlag = (language: string) => {
  if (FLAG_PREFIX_PATTERN.test(String(language || ''))) {
    return String(language).match(FLAG_PREFIX_PATTERN)?.[1] || '🌐';
  }

  const normalizedLanguage = cleanLanguageName(language).toLowerCase().replace(/\(.*/, '').trim();
  const baseKey = normalizedLanguage.split(/[\s_-]+/)[0];

  return LANGUAGE_FLAG_BY_KEY[normalizedLanguage] || LANGUAGE_FLAG_BY_KEY[baseKey] || '🌐';
};

const cx = (...classes: Array<string | false | null | undefined>) =>
  classes.filter(Boolean).join(' ');

type AnalyticsOption = { label: string; value: string };

const dateRangeOptions: AnalyticsOption[] = [
  { label: 'Today', value: 'today' },
  { label: 'Yesterday', value: 'yesterday' },
  { label: 'Last 7 days', value: '7d' },
  { label: 'Last 30 days', value: '30d' },
  { label: 'Last 90 days', value: '90d' },
];

/* The same pill dropdown the receptionist analytics and sessions screens use,
   so the filters across AI Tools look and behave alike. */
const AnalyticsPill = ({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: AnalyticsOption[];
  value: string;
  onChange: (value: string) => void;
}) => (
  <DropdownMenu>
    <DropdownMenuTrigger asChild>
      <button
        type="button"
        className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border! border-neutral-200! bg-white! px-5 text-[13px] font-semibold text-neutral-700! shadow-[0_1px_2px_rgba(0,0,0,.03)] transition-colors hover:border-red-300!"
      >
        <span className="max-w-[170px] truncate">{label}</span>
        <ChevronDown className="h-3.5 w-3.5 opacity-60" />
      </button>
    </DropdownMenuTrigger>
    <DropdownMenuContent
      align="end"
      className="[&_[data-slot=dropdown-menu-item]]:focus:text-neutral-900! flex w-[220px] max-h-[320px] flex-col gap-1 overflow-y-auto rounded-xl! border! border-neutral-200! bg-white p-1.5 shadow-lg z-50 animate-none"
    >
      {options.map((option) => {
        const isSelected = option.value === value;
        return (
          <DropdownMenuItem
            key={option.value}
            onClick={() => onChange(option.value)}
            className={cx(
              'flex cursor-pointer items-center justify-between gap-2 rounded-lg px-3 py-2.5 text-sm font-medium',
              isSelected
                ? 'bg-red-50! text-neutral-900! font-semibold'
                : 'text-neutral-900 hover:bg-[#f3f4f6]! focus:bg-[#f3f4f6]!',
            )}
          >
            <span className="truncate">{option.label}</span>
            {isSelected && <Check className="h-3.5 w-3.5 shrink-0 text-red-600!" />}
          </DropdownMenuItem>
        );
      })}
    </DropdownMenuContent>
  </DropdownMenu>
);

/* Same tip as the receptionist wizard and analytics, so every info tip across
   AI Tools reads identically. */
function InfoTip({ text }: { text: string }) {
  return (
    <CustomTooltip
      side="top"
      text={text}
      className="w-max max-w-[340px] border-none! bg-[#fdf7f5]! text-black! shadow-[0_6px_20px_rgba(17,17,17,0.18)]! [&_svg]:fill-[#fdf7f5]"
    >
      <Info className="h-4 w-4 cursor-help text-neutral-400" />
    </CustomTooltip>
  );
}

/* The red eyebrow that opens each section of the page, as the receptionist
   report has it, so the page reads in named parts rather than one long column. */
function SectionEyebrow({ label }: { label: string }) {
  return (
    <div className="mb-3 flex items-center gap-2.5">
      <h2 className="text-[12.5px] font-semibold uppercase tracking-[0.05em] text-red-600">
        {label}
      </h2>
      <span className="h-px flex-1 bg-neutral-200" />
    </div>
  );
}

function AnalyticsPanel({
  title,
  subtitle,
  tip,
  children,
  className = '',
  isLoading = false,
  action,
}: {
  title: string;
  subtitle?: string;
  tip?: string;
  children: ReactNode;
  className?: string;
  isLoading?: boolean;
  /** Optional control shown at the right of the card's own header. */
  action?: ReactNode;
}) {
  return (
    <div
      className={`relative rounded-2xl border-[1.5px] border-neutral-200 bg-white p-4 shadow-[0_1px_2px_rgba(0,0,0,.03)] ${className}`}
    >
      {isLoading && <CardLoader />}
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-1.5">
            <h3 className="text-[14px] font-bold text-neutral-950">{title}</h3>
            {tip ? <InfoTip text={tip} /> : null}
          </div>
          {subtitle ? <p className="mt-1 text-xs text-neutral-500">{subtitle}</p> : null}
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
      {children}
    </div>
  );
}

/* White tooltip card shared by the charts, in place of Recharts' default box. */
const ChartTip = ({ active, payload, label, unit = '' }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-neutral-200 bg-white px-3 py-2 shadow-[0_4px_14px_rgba(17,17,17,.08)]">
      <div className="text-[10px] font-bold uppercase tracking-[0.04em] text-neutral-400">
        {label}
      </div>
      {payload[0]?.payload?.rateLabel ? (
        <div className="mt-0.5 text-xs font-bold text-neutral-900">
          Resolution rate · {payload[0].payload.rateLabel}
        </div>
      ) : null}
      {payload.map((item: any) => (
        <div key={item.name} className="mt-0.5 flex items-center gap-2 text-xs">
          <span className="h-2 w-2 rounded-full" style={{ background: item.color || item.stroke }} />
          <span className="font-medium text-neutral-600">{item.name}</span>
          <span className="ml-auto font-bold tabular-nums text-neutral-900">
            {item.value}
            {unit}
          </span>
        </div>
      ))}
    </div>
  );
};

/* The sentiment card plots the mix, not one averaged score: a rising negative
   share is exactly what an average hides. One line per share, and the legend
   beside the chart carries the range's own figure for each. */
const SENTIMENT_SERIES = [
  { key: 'positive' as const, label: 'Positive', color: '#10b981' },
  { key: 'neutral' as const, label: 'Neutral', color: '#94a3b8' },
  { key: 'negative' as const, label: 'Negative', color: THEME_PRIMARY },
];

/* Sentiment as the list screen shows it: a label with the score, toned by
   where the score sits. */
const SentimentCell = ({ score, calls, label }: { score: number | null; calls: number; label?: string }) => {
  if (score === null || !calls) {
    return <span className="text-sm font-normal text-neutral-400">Not analyzed</span>;
  }
  const tone = score >= 75 ? 'text-emerald-600' : score >= 50 ? 'text-amber-600' : 'text-red-600';
  const name =
    label && label.trim()
      ? label.trim().charAt(0).toUpperCase() + label.trim().slice(1)
      : score >= 75
        ? 'Positive'
        : score >= 50
          ? 'Neutral'
          : 'Negative';
  return (
    <span className={cx('text-sm font-bold tabular-nums', tone)}>
      {name} · {Math.round(score)}
    </span>
  );
};

/* The three ways a conversation ends, on one red ramp: darkest for the
   outcome you want, lighter as it needs a person. One hue, so the legend
   names the segments and the ramp only says "more to less resolved". */
const OUTCOME_SERIES = [
  { key: 'resolved', label: 'Resolved', color: '#dc2626' },
  { key: 'handoffs', label: 'Handed off', color: '#f29797' },
  { key: 'scheduled_callbacks', label: 'Callback', color: '#fbd5d5' },
] as const;

/* One glyph per channel, tinted to that channel's own colour so the
   legend badge reads as identity rather than a plain dot. */
/* A fixed ramp for the languages bar - one hue, darkest to lightest, so a
   longer tail of languages still reads as one ordered set rather than a
   repeating cycle. */
const LANGUAGE_RAMP = ['#dc2626', '#f87171', '#fca5a5', '#fecaca', '#fed7d7', '#94a3b8'];

const WhatsAppIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347M12.05 21.785h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884M20.52 3.449C18.24 1.245 15.24 0 12.045 0 5.463 0 .104 5.36.101 11.943c0 2.105.549 4.16 1.595 5.967L0 24l6.235-1.635a11.88 11.88 0 0 0 5.71 1.454h.005c6.585 0 11.943-5.36 11.946-11.943a11.88 11.88 0 0 0-3.376-8.427" />
  </svg>
);

const MessengerIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
    <path d="M12.001 0C5.373 0 0 5.093 0 11.377c0 3.584 1.744 6.782 4.469 8.864V24l4.088-2.242c1.092.301 2.246.464 3.444.464 6.628 0 12.001-5.093 12.001-11.377S18.629 0 12.001 0zm1.193 15.325l-3.06-3.267-5.976 3.267 6.572-6.981 3.137 3.267 5.907-3.267-6.58 6.981z" />
  </svg>
);

const CHANNEL_ICONS: Record<string, any> = {
  'Web widget': Globe,
  WhatsApp: WhatsAppIcon,
  Messenger: MessengerIcon,
  Instagram,
  Email: Mail,
  SMS: Smartphone,
  Other: MoreHorizontal,
};
/* The three states the Trend column can be in. Colour carries the direction,
   so a row reads improved / flat / declined without comparing its endpoints -
   and the legend under the table names each one, so it is never colour alone. */
const TREND_STATE: Record<'up' | 'flat' | 'down', { color: string; label: string }> = {
  up: { color: '#059669', label: 'Improved' },
  flat: { color: '#d97706', label: 'Flat' },
  down: { color: THEME_PRIMARY, label: 'Declined' },
};

const trendStateOf = (series: number[]) => {
  const move = series.length > 1 ? series[series.length - 1] - series[0] : 0;
  return move > 1 ? 'up' : move < -1 ? 'down' : 'flat';
};

/* A smooth area curve rather than a bare polyline: at this size the fill is
   what gives the shape weight, and the end dot says which end is "now". */
const TrendArea = ({ data, color }: { data: number[]; color: string }) => {
  const gradientId = useId();
  if (!data || data.length === 0) return null;

  const series = data.length > 1 ? data : [...data, ...data];
  const width = 120;
  const height = 34;
  const padX = 3;
  const padY = 5;
  const max = Math.max(...series);
  const min = Math.min(...series);
  const range = max - min || 1;
  const points = series.map((value, index) => ({
    x: padX + (index / (series.length - 1)) * (width - padX * 2 - 4),
    y: height - padY - ((value - min) / range) * (height - padY * 2),
  }));

  let line = `M ${points[0].x.toFixed(2)} ${points[0].y.toFixed(2)}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i - 1] || points[i];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2] || p2;
    const c1x = p1.x + (p2.x - p0.x) / 6;
    const c1y = p1.y + (p2.y - p0.y) / 6;
    const c2x = p2.x - (p3.x - p1.x) / 6;
    const c2y = p2.y - (p3.y - p1.y) / 6;
    line += ` C ${c1x.toFixed(2)} ${c1y.toFixed(2)}, ${c2x.toFixed(2)} ${c2y.toFixed(2)}, ${p2.x.toFixed(2)} ${p2.y.toFixed(2)}`;
  }
  const last = points[points.length - 1];
  const area = `${line} L ${last.x.toFixed(2)} ${height} L ${points[0].x.toFixed(2)} ${height} Z`;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="h-[34px] w-[120px] overflow-visible">
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.22" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${gradientId})`} stroke="none" />
      <path
        d={line}
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx={last.x} cy={last.y} r={3.2} fill={color} />
    </svg>
  );
};

/* A circular progress per intent, as the receptionist topics card draws it:
   the share sits in the ring, the name beside it. */
function TopicRing({ value }: { value: number }) {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const frame = requestAnimationFrame(() => setReady(true));
    return () => cancelAnimationFrame(frame);
  }, []);
  const r = 27;
  const circumference = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(100, value));
  return (
    <span className="relative flex h-16 w-16 shrink-0 items-center justify-center">
      <svg viewBox="0 0 64 64" className="absolute inset-0 h-16 w-16 -rotate-90" aria-hidden="true">
        <circle cx="32" cy="32" r={r} fill="none" stroke="#e5e7eb" strokeWidth="4.5" />
        <circle
          cx="32"
          cy="32"
          r={r}
          fill="none"
          stroke={THEME_PRIMARY}
          strokeWidth="4.5"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={ready ? circumference * (1 - pct / 100) : circumference}
          style={{ transition: 'stroke-dashoffset 800ms ease-out' }}
        />
      </svg>
      <span className="relative text-[13px] font-bold leading-none tabular-nums text-neutral-900">
        {value}%
      </span>
    </span>
  );
}

const CardLoader = ({ dark = false }: { dark?: boolean }) => (
  <div
    className={`absolute inset-0 z-10 flex items-center justify-center backdrop-blur-[1px] rounded-[inherit] ${dark ? 'bg-black/40' : 'bg-white/60'}`}
  >
    <div
      className={`h-5 w-5 animate-spin rounded-full border-2 border-t-transparent ${dark ? 'border-white' : 'border-primary'}`}
    />
  </div>
);

const getResolutionRate = (item: any) => {
  const percentageRate =
    item?.percentage != null ? Number.parseFloat(String(item.percentage).replace('%', '')) : NaN;

  if (Number.isFinite(percentageRate)) {
    return percentageRate;
  }

  const conversations = Number(item?.conversations ?? 0);
  const resolved = Number(item?.resolved ?? 0);
  return conversations > 0 ? Math.round((resolved / conversations) * 100) : 0;
};

const getNumericValue = (value: unknown) => {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : null;
};

const formatDateRange = (startDate: string, endDate: string) => {
  const start = moment(startDate);
  const end = moment(endDate);

  if (start.isSame(end, 'day')) {
    return end.format('MMM DD, YYYY');
  }

  return start.isSame(end, 'year')
    ? `${start.format('MMM DD')} – ${end.format('MMM DD, YYYY')}`
    : `${start.format('MMM DD, YYYY')} – ${end.format('MMM DD, YYYY')}`;
};

/* The API answers `{ data: { result: {...} } }` on some routes and the flat
   object on others; read whichever level carries the figures, as the
   receptionist report does. */
const unwrapAnalyticsPayload = (payload: any) => {
  const data =
    payload?.data && typeof payload.data === 'object' && !Array.isArray(payload.data)
      ? payload.data
      : payload || {};
  const result =
    data?.result && typeof data.result === 'object' && !Array.isArray(data.result)
      ? data.result
      : {};
  return { ...result, ...data };
};

const getChatAnalyticsSummary = (data: any) => {
  const totalConvos = Number(data?.conversations_handled ?? 0);
  const daily = data?.daily_breakdown ?? [];
  const totalVolume = daily.reduce((acc: number, d: any) => acc + (d.volume ?? 0), 0);
  const totalResolved = daily.reduce((acc: number, d: any) => acc + (d.resolved ?? 0), 0);
  const totalHandoffs = Number(
    data?.handoffs ?? daily.reduce((acc: number, d: any) => acc + (d.handoffs ?? 0), 0),
  );
  const handoffRate = totalConvos > 0 ? (totalHandoffs / totalConvos) * 100 : null;
  const resolutionBreakdown = data?.resolution_breakdown ?? [];
  const latestResolution = resolutionBreakdown[resolutionBreakdown.length - 1];
  const apiResolutionRate = getNumericValue(data?.resolution_rate);
  const resolutionRate =
    apiResolutionRate != null
      ? apiResolutionRate
      : latestResolution
        ? getResolutionRate(latestResolution)
        : totalConvos > 0
          ? Math.round(((totalConvos - totalHandoffs) / totalConvos) * 100)
          : totalVolume > 0
            ? Math.round((totalResolved / totalVolume) * 100)
            : 0;
  const avgConfidence = getNumericValue(data?.avg_confidence);
  const csat = getNumericValue(
    data?.csat ?? data?.avg_csat ?? data?.customer_satisfaction ?? data?.post_chat_csat,
  );

  return {
    totalConvos,
    totalHandoffs,
    handoffRate,
    totalResolved,
    resolutionRate,
    avgConfidence,
    avgResponseTime: getNumericValue(data?.average_response_time),
    csat,
  };
};

const getPercentChange = (current: number | null, previous: number | null) => {
  if (current == null || previous == null || previous === 0) {
    return null;
  }
  return ((current - previous) / previous) * 100;
};

const getValueChange = (current: number | null, previous: number | null) => {
  if (current == null || previous == null) {
    return null;
  }
  return current - previous;
};

const formatPercentChange = (value: number | null) =>
  value == null ? '-' : `${value >= 0 ? '↑' : '↓'} ${Math.abs(value).toFixed(1)}%`;

const formatMillisecondChange = (value: number | null) =>
  value == null ? '-' : `${value <= 0 ? '↓' : '↑'} ${Math.abs(Math.round(value))}ms`;

const formatScoreChange = (value: number | null) =>
  value == null ? '-' : `${value >= 0 ? '↑' : '↓'} ${Math.abs(value).toFixed(1)}`;

const getChangeClass = (value: number | null, lowerIsBetter = false) => {
  if (value == null || value === 0) {
    return 'text-slate-400';
  }

  const isGood = lowerIsBetter ? value < 0 : value > 0;
  return isGood ? 'text-emerald-500' : 'text-red-500';
};

export default function AgentAnalytics({ onClose, agents = [] }: AgentAnalyticsProps) {
  const analyticsContentRef = useRef<HTMLDivElement | null>(null);
  const [dateRange, setDateRange] = useState<'today' | 'yesterday' | '7d' | '30d' | '90d'>('7d');
  const [selectedRepId, setSelectedRepId] = useState<string>('all');
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [breakdownSort, setBreakdownSort] = useState<'convos' | 'csat-desc' | 'csat-asc'>(
    'convos',
  );
  const [breakdownPage, setBreakdownPage] = useState(0);
  // which slice is under the pointer, so its legend row lights up too
  const [activeLanguage, setActiveLanguage] = useState<number | null>(null);

  const { startDate, endDate } = useMemo(() => {
    const end = moment().format('YYYY-MM-DD');
    let start = moment().subtract(7, 'days').format('YYYY-MM-DD');
    let finalEnd = end;

    if (dateRange === 'today') {
      start = moment().format('YYYY-MM-DD');
      finalEnd = moment().format('YYYY-MM-DD');
    } else if (dateRange === 'yesterday') {
      start = moment().subtract(1, 'days').format('YYYY-MM-DD');
      finalEnd = moment().subtract(1, 'days').format('YYYY-MM-DD');
    } else if (dateRange === '7d') {
      start = moment().subtract(7, 'days').format('YYYY-MM-DD');
      finalEnd = end;
    } else if (dateRange === '30d') {
      start = moment().subtract(30, 'days').format('YYYY-MM-DD');
      finalEnd = end;
    } else if (dateRange === '90d') {
      start = moment().subtract(90, 'days').format('YYYY-MM-DD');
      finalEnd = end;
    }
    return { startDate: start, endDate: finalEnd };
  }, [dateRange]);

  const previousRange = useMemo(() => {
    const currentStart = moment(startDate);
    const periodDays = Math.max(1, moment(endDate).diff(currentStart, 'days'));
    const previousEnd = currentStart.clone().subtract(1, 'day');
    const previousStart = previousEnd.clone().subtract(periodDays - 1, 'days');

    return {
      startDate: previousStart.format('YYYY-MM-DD'),
      endDate: previousEnd.format('YYYY-MM-DD'),
      days: periodDays,
    };
  }, [startDate, endDate]);

  const agentId = selectedRepId === 'all' ? '' : selectedRepId;
  const viewerTimeZone = useMemo(() => Intl.DateTimeFormat().resolvedOptions().timeZone, []);

  const {
    data: rawAnalyticsData,
    error,
    isLoading,
  } = useQuery({
    queryKey: ['chatAgentAnalytics', startDate, endDate, agentId, viewerTimeZone],
    queryFn: async () => {
      const response = await getChatAgentAnalytics({
        startDate,
        endDate,
        agentId,
        timezone: viewerTimeZone,
      });
      return unwrapAnalyticsPayload(response.data);
    },
    enabled: !ANALYTICS_COMING_SOON,
  });

  const { data: rawPreviousAnalyticsData, isLoading: isPreviousLoading } = useQuery({
    queryKey: [
      'chatAgentAnalyticsPrevious',
      previousRange.startDate,
      previousRange.endDate,
      agentId,
      viewerTimeZone,
    ],
    queryFn: async () => {
      const response = await getChatAgentAnalytics({
        startDate: previousRange.startDate,
        endDate: previousRange.endDate,
        agentId,
        timezone: viewerTimeZone,
      });
      return unwrapAnalyticsPayload(response.data);
    },
    enabled: !ANALYTICS_COMING_SOON,
  });

  if (error) {
    console.error('Chat Agent Analytics API Error:', error);
  }

  // DUMMY DATA - filled per section, so anything the API did send wins and
  // only the empty parts of the screen get demo figures. Remove with
  // DUMMY_DATA.ts (or set SHOW_DUMMY_DATA to false).
  const fillWithDummy = (source: any, scale: number) => {
    if (!SHOW_DUMMY_DATA) return source;
    const rangeDays = Math.max(1, moment(endDate).diff(moment(startDate), 'days') + 1);
    const dummy: any = buildDummyChatAnalytics(rangeDays, scale);
    const filled: any = { ...(source || {}) };
    const emptyList = (value: any) => !Array.isArray(value) || value.length === 0;
    [
      'daily_breakdown',
      'agent_breakdown',
      'channel_breakdown',
      'hour_of_day_breakdown',
      'resolution_breakdown',
      'top_user_intents',
      'sentiment_breakdown',
      'country_breakdown',
      'language_breakdown',
      'handoff_funnel',
      'top_faqs',
    ].forEach((key) => {
      if (emptyList(filled[key])) filled[key] = dummy[key];
    });
    const perf = filled.agent_performance_breakdown;
    if (!perf || (emptyList(perf.last_7_days) && emptyList(perf.last_30_days))) {
      filled.agent_performance_breakdown = dummy.agent_performance_breakdown;
    }
    if (!filled.cost_usage_breakdown || filled.cost_usage_breakdown.total_reply == null) {
      filled.cost_usage_breakdown = dummy.cost_usage_breakdown;
    }
    if (!filled.sentiment_counts) filled.sentiment_counts = dummy.sentiment_counts;
    [
      'conversations_handled',
      'total_calls',
      'resolution_rate',
      'avg_confidence',
      'average_response_time',
      'handoffs',
      'scheduled_callbacks',
      'csat',
      'sentiment_calls',
      'avg_sentiment',
      'sentiment_label',
    ].forEach((key) => {
      if (filled[key] == null || filled[key] === 0 || filled[key] === '') filled[key] = dummy[key];
    });
    return filled;
  };
  const analyticsData = useMemo(
    () => fillWithDummy(rawAnalyticsData, 1),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [rawAnalyticsData, startDate, endDate],
  );
  const previousAnalyticsData = useMemo(
    () => fillWithDummy(rawPreviousAnalyticsData, 0.88),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [rawPreviousAnalyticsData, startDate, endDate],
  );

  const agentNameMap = useMemo(
    () =>
      new Map(
        agents.map((agent: any) => [
          agent.agent_uuid || agent.id,
          agent.agentName || agent.name || '',
        ]),
      ),
    [agents],
  );

  const activeAgentIdSet = useMemo(
    () => new Set(agents.map((agent: any) => agent.agent_uuid || agent.id).filter(Boolean)),
    [agents],
  );

  const activeAgents = useMemo(() => {
    const colorOptions = ['#8b5cf6', '#10b981', '#ec4899', THEME_PRIMARY, '#f59e0b', '#14b8a6'];
    const sparklineColors = ['#10b981', THEME_PRIMARY, '#ec4899', '#f59e0b', '#14b8a6', '#8b5cf6'];

    const agentMap = new Map<string, any>();
    if (analyticsData?.agent_breakdown) {
      analyticsData.agent_breakdown.forEach((item: any) => {
        const id = item.agent_uuid || item.id;
        if (id) {
          agentMap.set(id, item);
        }
      });
    }

    const totalConvos = analyticsData?.conversations_handled ?? 1;

    const currentAgentRows = agents.map((agent: any, idx: number) => {
      const colorIndex = idx % colorOptions.length;
      const agentIdVal = agent.agent_uuid || agent.id;
      const apiItem = agentMap.get(agentIdVal);
      const agentName = agent.agentName || agent.name || agentIdVal;

      const convos = apiItem ? (apiItem.conversations ?? apiItem.total_calls ?? 0) : 0;

      // Unique seed from agent ID for deterministic variation
      let hash = 0;
      const idStr = String(agentIdVal || idx);
      for (let i = 0; i < idStr.length; i++) {
        hash = idStr.charCodeAt(i) + ((hash << 5) - hash);
      }

      const sparklineData = analyticsData?.daily_breakdown?.map((d: any, dayIdx: number) => {
        const baseVal = d.volume ?? 0;
        const share = convos / (totalConvos || 1);
        const seed = Math.abs(Math.sin(hash + dayIdx));
        const noise = 0.7 + seed * 0.6; // varies between 0.7 and 1.3
        return Math.round(baseVal * share * noise);
      }) || [0, 0, 0, 0, 0, 0, 0, 0];

      return {
        id: agentIdVal || String(idx),
        name: agentName,
        subtitle: agent.description || 'Customer Support',
        initials: (agentName || 'A').charAt(0).toUpperCase(),
        avatarBg: colorOptions[colorIndex],
        sparklineColor: sparklineColors[colorIndex],
        convos,
        convosTrend: '',
        resolution: apiItem ? Math.round(Number(apiItem.resolution_rate || 0)) : null,
        avgResponse: apiItem ? getNumericValue(apiItem.average_response_time) : null,
        handoffs: apiItem ? Number(apiItem.handoffs || 0) : null,
        csat: apiItem ? getNumericValue(apiItem.csat) : null,
        sentiment: apiItem ? Number(apiItem.avg_sentiment || 0) : null,
        sentimentCalls: apiItem ? Number(apiItem.sentiment_calls || 0) : 0,
        sentimentLabel: apiItem?.sentiment_label || '',
        sparklineData: sparklineData.slice(-10),
        status: (agent.status || 'active') as 'active' | 'paused' | 'draft',
        deleted: false,
      };
    });

    const deletedAgentRows = Array.from(agentMap.values())
      .filter((item: any) => {
        const id = item.agent_uuid || item.id;
        return id && !activeAgentIdSet.has(id);
      })
      .map((item: any, idx: number) => {
        const colorIndex = (agents.length + idx) % colorOptions.length;
        const agentIdVal = item.agent_uuid || item.id;
        const agentName = item.agent_name || agentNameMap.get(agentIdVal) || agentIdVal;
        const convos = item.conversations ?? item.total_calls ?? 0;

        const sparklineData = analyticsData?.daily_breakdown?.map((d: any) => {
          const baseVal = d.volume ?? 0;
          const share = convos / (totalConvos || 1);
          return Math.round(baseVal * share);
        }) || [0, 0, 0, 0, 0, 0, 0, 0];

        return {
          id: agentIdVal,
          name: agentName,
          subtitle: 'Deleted agent',
          initials: (agentName || 'A').charAt(0).toUpperCase(),
          avatarBg: colorOptions[colorIndex],
          sparklineColor: sparklineColors[colorIndex],
          convos,
          convosTrend: '',
          resolution: Math.round(Number(item.resolution_rate || 0)),
          avgResponse: getNumericValue(item.average_response_time),
          handoffs: Number(item.handoffs || 0),
          csat: getNumericValue(item.csat),
          sentiment: Number(item.avg_sentiment || 0),
          sentimentCalls: Number(item.sentiment_calls || 0),
          sentimentLabel: item.sentiment_label || '',
          sparklineData: sparklineData.slice(-10),
          status: 'deleted' as const,
          deleted: true,
        };
      });

    return [...currentAgentRows, ...deletedAgentRows];
  }, [activeAgentIdSet, agentNameMap, agents, analyticsData]);

  const selectedAgent = useMemo(
    () => activeAgents.find((agent: any) => agent.id === selectedRepId),
    [activeAgents, selectedRepId],
  );

  const totalReplies =
    selectedRepId === 'all'
      ? analyticsData?.cost_usage_breakdown?.total_reply
      : analyticsData?.cost_usage_breakdown?.agent_breakdown?.find(
          (agent: any) => agent.agent_uuid === selectedRepId,
        )?.total_reply;

  // A strictly filtered list of agents containing only the ones present in the API's agent_breakdown object
  // Performance table rows from agent_performance_breakdown
  const metrics = useMemo(() => {
    const current = getChatAnalyticsSummary(analyticsData);
    const previous = getChatAnalyticsSummary(previousAnalyticsData);
    const conversationDelta = getPercentChange(current.totalConvos, previous.totalConvos);
    const resolutionDelta = getPercentChange(current.resolutionRate, previous.resolutionRate);
    const confidenceDelta = getValueChange(current.avgConfidence, previous.avgConfidence);
    const responseTimeDelta = getValueChange(current.avgResponseTime, previous.avgResponseTime);
    const handoffDelta =
      previous.totalHandoffs === 0
        ? current.totalHandoffs > 0
          ? 100
          : 0
        : getPercentChange(current.totalHandoffs, previous.totalHandoffs);
    const csatDelta = getValueChange(current.csat, previous.csat);

    const sentimentCalls = Number(analyticsData?.sentiment_calls || 0);
    const avgSentiment = Number(analyticsData?.avg_sentiment || 0);
    const sentimentLabel = analyticsData?.sentiment_label || '';

    return {
      conversationsHandled: current.totalConvos.toLocaleString('en-US'),
      avgResponseTime:
        current.avgResponseTime != null ? `${Math.round(current.avgResponseTime)}ms` : '—',
      resolutionRate: `${Math.round(current.resolutionRate)}%`,
      resolutionRateDelta:
        previous.totalConvos > 0
          ? Math.round(current.resolutionRate - previous.resolutionRate)
          : null,
      avgConfidence:
        current.avgConfidence != null ? `${Math.round(current.avgConfidence)}%` : 'Not analyzed',
      handoffs: current.totalHandoffs.toLocaleString('en-US'),
      csat: current.csat != null ? `${current.csat.toFixed(1)}/5` : '—/5',
      conversationDelta: formatPercentChange(conversationDelta),
      conversationDeltaClass: getChangeClass(conversationDelta),
      resolutionDelta: formatPercentChange(resolutionDelta),
      resolutionDeltaClass: getChangeClass(resolutionDelta),
      confidenceDelta: formatPercentChange(confidenceDelta),
      confidenceDeltaClass: getChangeClass(confidenceDelta),
      responseTimeDelta: formatMillisecondChange(responseTimeDelta),
      responseTimeDeltaClass: getChangeClass(responseTimeDelta, true),
      handoffDelta: formatPercentChange(handoffDelta),
      handoffDeltaClass: getChangeClass(handoffDelta, true),
      csatDelta: formatScoreChange(csatDelta),
      csatDeltaClass: getChangeClass(csatDelta),
      overallSentiment: sentimentCalls
        ? `${sentimentLabel || 'neutral'} · ${avgSentiment.toFixed(1)}`
        : 'Not analyzed',
      sentimentStatus: sentimentCalls ? `${sentimentCalls} chats` : 'Not analyzed',
    };
  }, [analyticsData, previousAnalyticsData]);

  const volumeData = useMemo(() => {
    if (analyticsData?.daily_breakdown) {
      const list = [];
      const curr = moment(startDate);
      const end = moment(endDate);
      let limit = 0;
      const dayMap = new Map<string, any>();
      analyticsData.daily_breakdown.forEach((item: any) => {
        if (item.date) {
          dayMap.set(moment(item.date).format('YYYY-MM-DD'), item);
        }
      });

      while (curr.isSameOrBefore(end, 'day') && limit < 100) {
        const dateStr = curr.format('YYYY-MM-DD');
        const apiDay = dayMap.get(dateStr);
        list.push({
          name: curr.format('MMM DD'),
          volume: getNumericValue(apiDay?.volume) ?? 0,
          resolved: getNumericValue(apiDay?.resolved) ?? 0,
          handoffs: getNumericValue(apiDay?.handoffs) ?? 0,
          scheduled_callbacks: getNumericValue(apiDay?.scheduled_callbacks) ?? 0,
          previous: 0,
        });
        curr.add(1, 'day');
        limit++;
      }
      return list;
    }

    const list = [];
    const curr = moment(startDate);
    const end = moment(endDate);
    let limit = 0;
    while (curr.isSameOrBefore(end, 'day') && limit < 100) {
      list.push({
        name: curr.format('MMM DD'),
        volume: 0,
        resolved: 0,
        handoffs: 0,
        scheduled_callbacks: 0,
        previous: 0,
      });
      curr.add(1, 'day');
      limit++;
    }
    return list;
  }, [startDate, endDate, analyticsData]);

  const hourlyData = useMemo(() => {
    const list = Array.from({ length: 24 }, (_, hour) => {
      const displayHour =
        hour === 0 ? '12a' : hour === 12 ? '12p' : hour > 12 ? `${hour - 12}p` : `${hour}a`;
      return { hour: displayHour, calls: 0, hourNum: hour };
    });

    if (analyticsData?.hour_of_day_breakdown) {
      analyticsData.hour_of_day_breakdown.forEach((item: any) => {
        const h = Number(item.hour);
        const idx = list.findIndex((l) => l.hourNum === h);
        if (idx !== -1) {
          list[idx].calls = item.conversations ?? 0;
        }
      });
    }

    return list;
  }, [analyticsData]);

  const channelData = useMemo(() => {
    const colors: Record<string, string> = {
      'Web widget': THEME_PRIMARY,
      WhatsApp: '#22c55e',
      Messenger: THEME_PRIMARY_MUTED,
      Instagram: '#ef4444',
      Email: '#f87171',
      Other: '#94a3b8',
    };
    if (analyticsData?.channel_breakdown && analyticsData.channel_breakdown.length > 0) {
      return analyticsData.channel_breakdown.map((item: any) => {
        const name = item.channel || 'Other';
        const value = item.conversations ?? 0;
        const pct = item.percentage ?? '0%';
        const color = colors[name] || '#94a3b8';
        return { name, value, color, pct };
      });
    }
    return [
      { name: 'Web widget', value: 0, color: THEME_PRIMARY, pct: '0%' },
      { name: 'WhatsApp', value: 0, color: '#22c55e', pct: '0%' },
      { name: 'Messenger', value: 0, color: THEME_PRIMARY_MUTED, pct: '0%' },
      { name: 'Instagram', value: 0, color: '#ef4444', pct: '0%' },
      { name: 'Email', value: 0, color: '#f87171', pct: '0%' },
      { name: 'Other', value: 0, color: '#94a3b8', pct: '0%' },
    ];
  }, [analyticsData]);



  const intents = useMemo<Array<{ name: string; value: number; pct: number }>>(() => {
    const rows = Array.isArray(analyticsData?.top_user_intents)
      ? analyticsData.top_user_intents
      : [];

    return rows.map((item: any) => ({
      name: item.intent || item.name || 'Other',
      value: Number(item.count || item.value || 0),
      pct: Number.parseFloat(String(item.percentage || item.pct || '0').replace('%', '')),
    }));
  }, [analyticsData]);

  const sentimentData = useMemo(() => {
    const counts = analyticsData?.sentiment_counts || {};
    const breakdown = analyticsData?.sentiment_breakdown || [];
    const total = Number(analyticsData?.sentiment_calls || 0);
    const rows = [
      { key: 'positive', name: 'Positive', color: '#10b981' },
      { key: 'neutral', name: 'Neutral', color: '#94a3b8' },
      { key: 'negative', name: 'Negative', color: '#ef4444' },
    ];

    return rows.map((row) => {
      const apiRow = breakdown.find((item: any) => item.sentiment === row.key);
      const value = Number(apiRow?.count ?? counts[row.key] ?? 0);
      const pct = total ? `${Math.round((value / total) * 100)}%` : '0%';
      return {
        name: row.name,
        value,
        color: row.color,
        pct,
      };
    });
  }, [analyticsData]);

  // One point per day of the range for the sentiment lines; days the payload
  // does not cover stay at zero rather than being invented.
  const sentimentChartData = useMemo(() => {
    const trendMap = new Map<string, any>();
    const trend = Array.isArray(analyticsData?.sentiment_trend)
      ? analyticsData.sentiment_trend
      : Array.isArray(analyticsData?.daily_sentiment)
        ? analyticsData.daily_sentiment
        : [];
    trend.forEach((item: any) => {
      if (item?.date) trendMap.set(moment(item.date).format('YYYY-MM-DD'), item);
    });
    const list = [];
    const curr = moment(startDate);
    const end = moment(endDate);
    let limit = 0;
    while (curr.isSameOrBefore(end, 'day') && limit < 100) {
      const item = trendMap.get(curr.format('YYYY-MM-DD'));
      list.push({
        name: curr.format('MMM D'),
        positive: getNumericValue(item?.positive ?? item?.positive_pct) ?? 0,
        neutral: getNumericValue(item?.neutral ?? item?.neutral_pct) ?? 0,
        negative: getNumericValue(item?.negative ?? item?.negative_pct) ?? 0,
      });
      curr.add(1, 'day');
      limit++;
    }
    return list;
  }, [analyticsData, startDate, endDate]);

  // The move against the previous range, from the two queries already made.
  const sentimentMove = useMemo(() => {
    const current = Number(analyticsData?.avg_sentiment || 0);
    const previous = Number(previousAnalyticsData?.avg_sentiment || 0);
    const previousCalls = Number(previousAnalyticsData?.sentiment_calls || 0);
    if (!current || !previousCalls || !previous) return null;
    return Math.round(current - previous);
  }, [analyticsData, previousAnalyticsData]);

  const countries = useMemo(() => {
    if (analyticsData?.country_breakdown && analyticsData.country_breakdown.length > 0) {
      const maxVal =
        Math.max(...analyticsData.country_breakdown.map((c: any) => c.conversations ?? 0)) || 1;
      return analyticsData.country_breakdown.map((item: any) => {
        const code = String(item.country || '')
          .trim()
          .toUpperCase();
        const name = item.countryName || item.country || 'Other';
        const value = item.conversations ?? 0;
        return {
          code,
          flag: getCountryFlag(code),
          name,
          value,
          barPct: maxVal ? Math.max(4, Math.round((value / maxVal) * 100)) : 0,
        };
      });
    }
    return [{ code: '', flag: '🌐', name: 'Other', value: 0, barPct: 0 }];
  }, [analyticsData]);

  const languages = useMemo(() => {
    if (analyticsData?.language_breakdown && analyticsData.language_breakdown.length > 0) {
      const rows = analyticsData.language_breakdown.map((item: any) => {
        const langStr = item.language || item.languageName || 'Other';
        const rawPct = item.percentage ?? 0;
        const pct = typeof rawPct === 'string' ? parseFloat(rawPct) : rawPct;
        return {
          name: cleanLanguageName(langStr),
          flag: getLanguageFlag(langStr),
          pct: Number.isNaN(pct) ? 0 : pct,
        };
      });
      const maxPct = Math.max(...rows.map((row: any) => row.pct), 1);
      return rows.map((row: any) => ({
        ...row,
        barPct: row.pct ? Math.max(4, Math.round((row.pct / maxPct) * 100)) : 0,
      }));
    }
    return [{ name: 'Other', flag: '🌐', pct: 0, barPct: 0 }];
  }, [analyticsData]);


  const faqs = useMemo(() => {
    if (Array.isArray(analyticsData?.top_faqs) && analyticsData.top_faqs.length) {
      return analyticsData.top_faqs.map((item: any) => {
        const rawPct = item.percentage ?? 0;
        const pct = typeof rawPct === 'string' ? parseFloat(rawPct) : Number(rawPct || 0);
        return {
          q: String(item.question || item.faq || '').trim(),
          count: Number(item.count || 0),
          pct: Number.isFinite(pct) ? pct : 0,
        };
      });
    }

    return [{ q: 'No FAQ usage recorded yet', count: 0, pct: 0 }];
  }, [analyticsData]);
  const isMetricsLoading = isLoading || isPreviousLoading;
  const exportAnalyticsCsv = () => {
    const rows: Array<Array<string | number>> = [
      ['Metric', 'Value'],
      ['Date range', formatDateRange(startDate, endDate)],
      ['Total conversations', metrics.conversationsHandled],
      ['Resolution rate', metrics.resolutionRate],
      ['Avg confidence', metrics.avgConfidence],
      ['Avg response time', metrics.avgResponseTime],
      ['Handoffs to human', metrics.handoffs],
      ['CSAT score', metrics.csat],
      [],
      ['Agent', 'Conversations', 'Resolution', 'Avg response', 'Handoffs', 'CSAT', 'Sentiment'],
      ...activeAgents.map((agent: any) => [
        agent.name,
        agent.convos,
        agent.resolution != null ? `${agent.resolution}%` : '—',
        agent.avgResponse != null ? `${Math.round(agent.avgResponse)}ms` : '—',
        agent.handoffs ?? '—',
        agent.csat != null ? `${Number(agent.csat).toFixed(1)}/5` : '—',
        agent.sentiment != null && agent.sentimentCalls ? Math.round(agent.sentiment) : '—',
      ]),
    ];

    const csv = rows
      .map((row) => row.map((cell) => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `chat-agent-analytics-${startDate}-to-${endDate}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };
  const exportAnalyticsPdf = async () => {
    if (!analyticsContentRef.current || isExportingPdf) return;

    setIsExportingPdf(true);
    try {
      await downloadAnalyticsSectionAsPdf(
        analyticsContentRef.current,
        `chat-agent-analytics-${startDate}-to-${endDate}.pdf`,
      );
    } catch (error) {
      console.error('Failed to export chat agent analytics PDF:', error);
      handleAlert({ text: 'Unable to generate the PDF report. Please try again.', type: 'error' });
    } finally {
      setIsExportingPdf(false);
    }
  };

  const periodLabel = formatDateRange(startDate, endDate);
  const periodCompare =
    dateRange === 'today'
      ? 'compared to yesterday'
      : dateRange === 'yesterday'
        ? 'compared to previous day'
        : `compared to previous ${previousRange.days} days`;

  // The figure beside each value is the move against the previous range, in
  // the tone that move deserves. The resolution figure itself takes the
  // colour of how it sits against target.
  const resolutionPct = getNumericValue(String(metrics.resolutionRate).replace('%', '')) ?? 0;
  const resolutionValueClass =
    resolutionPct >= 70
      ? 'text-emerald-700'
      : resolutionPct >= 50
        ? 'text-amber-600'
        : 'text-red-600';
  const deltaClass = (tone: string) =>
    tone.includes('emerald')
      ? 'text-emerald-600'
      : tone.includes('red')
        ? 'text-red-600'
        : 'text-neutral-400';
  const kpiCards = [
    {
      label: 'Total conversations',
      value: metrics.conversationsHandled,
      description: 'Chats handled, this range',
      helper: (
        <span className={cx('text-[11px]', deltaClass(metrics.conversationDeltaClass))}>
          {metrics.conversationDelta}
        </span>
      ),
    },
    {
      label: 'Resolution rate',
      value: metrics.resolutionRate,
      valueClass: resolutionValueClass,
      description: 'Resolved without a handoff',
      helper: <span className="text-[11px] text-red-600">target 70%+</span>,
    },
    {
      label: 'Avg confidence',
      value: metrics.avgConfidence,
      description: 'Answer confidence',
      helper: (
        <span className={cx('text-[11px]', deltaClass(metrics.confidenceDeltaClass))}>
          {metrics.confidenceDelta}
        </span>
      ),
    },
    {
      label: 'Avg response time',
      value: metrics.avgResponseTime,
      description: 'Per reply',
      helper: (
        <span className={cx('text-[11px]', deltaClass(metrics.responseTimeDeltaClass))}>
          {metrics.responseTimeDelta}
        </span>
      ),
    },
    {
      label: 'Handoffs to human',
      value: metrics.handoffs,
      valueClass: 'text-[#20201f]',
      pulse: true,
      description: 'Passed to a person',
      helper: (
        <span className="text-[11px] whitespace-nowrap text-red-600">
          of {metrics.conversationsHandled} chats
        </span>
      ),
    },
    {
      label: 'CSAT score',
      description: 'Visitor satisfaction',
      helper: (
        <span className={cx('text-[11px]', deltaClass(metrics.csatDeltaClass))}>
          {metrics.csatDelta}
        </span>
      ),
      value:
        typeof metrics.csat === 'string' && metrics.csat.endsWith('/5') ? (
          <>
            {metrics.csat.replace('/5', '')}
            <span className="text-sm text-red-600">/5</span>
          </>
        ) : (
          metrics.csat
        ),
    },
  ];

  const maxConvosInList = Math.max(1, ...activeAgents.map((item: any) => Number(item.convos || 0)));
  const sortedAgents = [...activeAgents].sort((a: any, b: any) => {
    if (breakdownSort === 'csat-desc') return (Number(b.csat) || 0) - (Number(a.csat) || 0);
    if (breakdownSort === 'csat-asc') return (Number(a.csat) || 0) - (Number(b.csat) || 0);
    return Number(b.convos || 0) - Number(a.convos || 0);
  });
  const BREAKDOWN_PAGE_SIZE = 5;
  const breakdownPageCount = Math.max(1, Math.ceil(sortedAgents.length / BREAKDOWN_PAGE_SIZE));
  const currentBreakdownPage = Math.min(breakdownPage, breakdownPageCount - 1);
  const pagedAgents = sortedAgents.slice(
    currentBreakdownPage * BREAKDOWN_PAGE_SIZE,
    currentBreakdownPage * BREAKDOWN_PAGE_SIZE + BREAKDOWN_PAGE_SIZE,
  );

  const maxHourly = Math.max(0, ...hourlyData.map((slot) => slot.calls));
  const totalHourly = hourlyData.reduce((sum, slot) => sum + slot.calls, 0);
  const peakSlot = hourlyData.reduce(
    (top, slot) => (slot.calls > top.calls ? slot : top),
    hourlyData[0] ?? { hour: '', calls: 0, hourNum: 0 },
  );
  const sentimentTotal = sentimentData.reduce((sum, item) => sum + Number(item.value || 0), 0);
  const intentTotal = intents.reduce((sum, item) => sum + item.value, 0);
  const totalSpend = analyticsData?.cost_usage_breakdown?.total_spend;
  const spendRows: any[] = analyticsData?.cost_usage_breakdown?.agent_breakdown ?? [];
  const maxSpend = Math.max(0, ...spendRows.map((row) => Number(row.total_spend || 0)));

  // The daily columns and their legend totals, from the same per-day rows the
  // KPI strip and funnel used to read separately.
  const outcomeRows = volumeData.map((day) => {
    const total =
      Number(day.volume || 0) ||
      Number(day.resolved || 0) + Number(day.handoffs || 0) + Number(day.scheduled_callbacks || 0);
    return {
      ...day,
      total,
      rateLabel: total ? `${Math.round((Number(day.resolved || 0) / total) * 100)}%` : '',
    };
  });
  const outcomeTotals = {
    total: outcomeRows.reduce((sum, day) => sum + day.total, 0),
    resolved: outcomeRows.reduce((sum, day) => sum + Number(day.resolved || 0), 0),
    handoffs: outcomeRows.reduce((sum, day) => sum + Number(day.handoffs || 0), 0),
    scheduled_callbacks: outcomeRows.reduce(
      (sum, day) => sum + Number(day.scheduled_callbacks || 0),
      0,
    ),
  };

  if (ANALYTICS_COMING_SOON) {
    return (
      <div className="flex h-full min-h-0 w-full flex-col overflow-hidden bg-[#efefef] text-neutral-900">
        <div className="flex min-h-[74px] shrink-0 items-center gap-3 border-b border-neutral-200 bg-white pl-3 pr-7 py-2">
          <button
            type="button"
            onClick={onClose}
            className="-ml-1.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-neutral-600! transition-colors hover:bg-neutral-100! hover:text-neutral-900!"
            aria-label="Back"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
        </div>
        <div className="flex flex-1 items-center justify-center p-6">
          <p className="text-base font-semibold text-neutral-600">Coming soon</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex h-full min-h-0 w-full flex-col overflow-hidden bg-[#efefef] text-neutral-900">
      {/* The same header the receptionist report uses: Back ahead of the
          title, eyebrow + serif title, pill actions on the right. */}
      <div className="flex min-h-[74px] shrink-0 flex-col gap-3 border-b border-neutral-200 bg-white pl-3 pr-7 py-2 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onClose}
            className="-ml-1.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-neutral-600! transition-colors hover:bg-neutral-100! hover:text-neutral-900!"
            aria-label="Back"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <span className="h-9 w-px shrink-0 bg-neutral-200" />
          <div>
            <span
              className="block"
              style={{
                fontFamily: '"IBM Plex Mono", ui-monospace, "SF Mono", Menlo, monospace',
                fontWeight: 800,
                fontSize: '12px',
                lineHeight: '18px',
                letterSpacing: '0.04em',
                color: 'rgb(220, 38, 38)',
                textTransform: 'uppercase',
              }}
            >
              Chat Agents
            </span>
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
              Analytics &amp; Reports
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 lg:justify-end">
          <AnalyticsPill
            label={dateRangeOptions.find((option) => option.value === dateRange)?.label || 'Range'}
            options={dateRangeOptions}
            value={dateRange}
            onChange={(value) => setDateRange(value as any)}
          />

          <AnalyticsPill
            label={
              selectedRepId === 'all'
                ? 'All agents'
                : activeAgents.find((agent: any) => agent.id === selectedRepId)?.name || 'Agent'
            }
            options={[
              { label: 'All agents', value: 'all' },
              ...activeAgents.map((agent: any) => ({ label: agent.name, value: agent.id })),
            ]}
            value={selectedRepId}
            onChange={setSelectedRepId}
          />

          <button
            type="button"
            onClick={() => void exportAnalyticsPdf()}
            disabled={isExportingPdf}
            className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border! border-neutral-200! bg-white! px-5 text-[13px] font-semibold text-neutral-950! shadow-[0_2px_6px_rgba(17,17,17,.10)]! transition-colors hover:border-red-300! disabled:cursor-not-allowed disabled:opacity-60"
          >
            <FileText className="h-3.5 w-3.5" />
            {isExportingPdf ? 'Generating PDF...' : 'PDF Report'}
          </button>

          {/* Export sits last and reads as the primary action, matching Sessions. */}
          <button
            type="button"
            onClick={exportAnalyticsCsv}
            className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full bg-neutral-900! px-5 text-[13px] font-semibold text-white! shadow-none transition-colors hover:bg-neutral-800!"
          >
            <Download className="h-3.5 w-3.5 shrink-0" />
            Export CSV
          </button>
        </div>
      </div>

      <div
        ref={analyticsContentRef}
        id="analytics-scrollable"
        className="w-full flex-1 space-y-4 overflow-y-auto px-7 pt-4 pb-6"
      >
        <div className="flex items-center gap-2 rounded-lg border border-red-600/20 bg-red-600/5 px-3 py-1.5 text-xs font-medium text-neutral-600">
          <Info className="h-4 w-4 shrink-0" />
          <span>
            <strong>{periodLabel}</strong> · {periodCompare} (
            {formatDateRange(previousRange.startDate, previousRange.endDate)}). Chat-specific KPIs
            below — channels, intents, sentiment, handoff funnel.
          </span>
        </div>

        {selectedRepId !== 'all' && selectedAgent ? (
          <div className="flex items-center gap-3 rounded-2xl border-[1.5px] border-neutral-200 bg-white px-4 py-3 shadow-[0_1px_2px_rgba(0,0,0,.03)]">
            <div className="shrink-0">
              <CustomAvatar
                name={selectedAgent.name}
                size="32"
                showPresence={false}
                isActivityInfo={false}
                textClass="text-[11px]"
              />
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-[13px] font-semibold text-neutral-900">
                Viewing report for {selectedAgent.name}
              </div>
              <div className="mt-0.5 text-xs text-neutral-500">
                KPIs, charts and unanswered questions below reflect this agent only.
              </div>
            </div>
            <button
              type="button"
              onClick={() => setSelectedRepId('all')}
              className="inline-flex h-8 shrink-0 items-center rounded-full border! border-neutral-200! bg-white! px-4 text-xs font-semibold text-neutral-700! transition-colors hover:border-red-300!"
            >
              Clear filter · view all agents
            </button>
          </div>
        ) : null}

        <div>
          <SectionEyebrow label="Overview" />
          <div className="relative grid grid-cols-1 rounded-[14px] border border-neutral-200 bg-white shadow-[0_1px_2px_rgba(0,0,0,.04)] sm:grid-cols-2 lg:grid-cols-6">
            {isMetricsLoading && (
              <div className="absolute inset-0 z-10 flex items-center justify-center rounded-[inherit] bg-white/70 backdrop-blur-[1px]">
                <Loader2 className="h-5 w-5 animate-spin text-neutral-600" />
              </div>
            )}
            {kpiCards.map((card, index) => (
              <div
                key={card.label}
                className={cx(
                  'relative flex flex-col gap-1.5 p-4',
                  index !== kpiCards.length - 1 &&
                    'border-b border-neutral-200 lg:border-b-0 lg:border-r',
                )}
              >
                <span className="flex items-center justify-between gap-2">
                  <span className="text-[11.5px] font-bold uppercase tracking-[0.06em] whitespace-nowrap text-neutral-700">
                    {card.label}
                  </span>
                  {card.pulse && (
                    // a live marker - handoffs are the one figure that is a
                    // person picking up right now
                    <span aria-hidden="true" className="relative flex h-2 w-2 shrink-0">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-500 opacity-75" />
                      <span className="relative inline-flex h-2 w-2 rounded-full bg-red-600" />
                    </span>
                  )}
                </span>
                <span className="flex min-w-0 items-baseline gap-1.5">
                  <span
                    className={cx(
                      'text-[26px] font-bold leading-tight tracking-tight whitespace-nowrap',
                      card.valueClass ?? 'text-neutral-900',
                    )}
                  >
                    {card.value}
                  </span>
                  {card.helper}
                </span>
                <span className="text-xs text-neutral-400 whitespace-nowrap">
                  {card.description}
                </span>
              </div>
            ))}
          </div>
        </div>

        {selectedRepId === 'all' ? (
          <div>
            <SectionEyebrow label="Agents" />
            <AnalyticsPanel
              title="Per-agent breakdown"
              subtitle="Every agent side by side for this range — pick one to drill in."
              isLoading={isLoading}
            >
              <div className="mt-4 hidden grid-cols-[minmax(0,1fr)_112px_104px_104px_92px_96px_120px_120px_20px] items-center gap-4 rounded-t-md border-b border-neutral-200 bg-[#fafafa] px-2 py-2 text-[10px] font-bold uppercase tracking-[0.06em] text-neutral-400 md:grid">
                <span>Agent</span>
                <span>Conversations</span>
                <span>Resolution</span>
                <span>Avg response</span>
                <span>Handoffs</span>
                <button
                  type="button"
                  onClick={() =>
                    setBreakdownSort((current) =>
                      current === 'csat-desc'
                        ? 'csat-asc'
                        : current === 'csat-asc'
                          ? 'convos'
                          : 'csat-desc',
                    )
                  }
                  className="flex cursor-pointer items-center gap-1 text-[10px]! font-bold! uppercase tracking-[0.06em] text-neutral-400! transition-colors hover:text-neutral-700!"
                >
                  CSAT
                  {breakdownSort === 'csat-desc' ? (
                    <ArrowDown className="h-3 w-3" />
                  ) : breakdownSort === 'csat-asc' ? (
                    <ArrowUp className="h-3 w-3" />
                  ) : (
                    <ArrowUpDown className="h-3 w-3" />
                  )}
                </button>
                <span>Sentiment</span>
                <span>Trend (volume)</span>
                <span />
              </div>
              <div className="divide-y divide-neutral-100">
                {pagedAgents.map((agent: any) => {
                  const isDraft = agent.status === 'draft';
                  const isPaused = agent.status === 'paused';
                  const isDeleted = Boolean(agent.deleted);
                  const hasScore = !isDraft && !isPaused && agent.resolution !== null;
                  const resolutionTone =
                    agent.resolution >= 80
                      ? 'text-emerald-600'
                      : agent.resolution >= 50
                        ? 'text-amber-600'
                        : 'text-red-600';
                  const series: number[] = agent.sparklineData || [];
                  const hasTrend = series.some((value) => value > 0);
                  const trendState = trendStateOf(series);
                  return (
                    <div
                      key={agent.id}
                      onClick={() => {
                        if (isDraft) return;
                        setSelectedRepId(agent.id);
                        analyticsContentRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
                      }}
                      className={cx(
                        'grid grid-cols-[minmax(0,1fr)_20px] items-center gap-4 rounded-lg px-2 py-2 transition-colors md:grid-cols-[minmax(0,1fr)_112px_104px_104px_92px_96px_120px_120px_20px]',
                        isDraft ? 'cursor-not-allowed opacity-70' : 'cursor-pointer hover:bg-neutral-50',
                      )}
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <div className="shrink-0">
                          <CustomAvatar
                            name={agent.name}
                            size="36"
                            showPresence={false}
                            isActivityInfo={false}
                            textClass="text-xs"
                          />
                        </div>
                        <div className="min-w-0">
                          <div className="flex min-w-0 items-center gap-2">
                            <h4 className="truncate text-[13px] font-normal text-neutral-950">
                              {agent.name}
                            </h4>
                            {isDeleted && (
                              <span className="shrink-0 rounded-full border border-red-200 bg-red-50 px-2 py-0.5 text-[10px] font-bold text-red-600">
                                Deleted
                              </span>
                            )}
                            {isPaused && (
                              <span className="shrink-0 rounded-full border border-neutral-200 bg-neutral-50 px-2 py-0.5 text-[10px] font-bold text-neutral-500">
                                Paused
                              </span>
                            )}
                            {isDraft && (
                              <span className="shrink-0 rounded-full border border-neutral-200 bg-neutral-50 px-2 py-0.5 text-[10px] font-bold text-neutral-500">
                                Not live
                              </span>
                            )}
                          </div>
                          <p className="truncate text-xs text-neutral-500">{agent.subtitle}</p>
                        </div>
                      </div>

                      <div className="hidden text-sm font-bold tabular-nums text-neutral-800 md:block">
                        {isDraft ? '—' : agent.convos}
                      </div>

                      <div className="hidden md:block">
                        <span
                          className={cx(
                            'text-sm font-bold tabular-nums',
                            hasScore ? resolutionTone : 'font-normal text-neutral-400',
                          )}
                        >
                          {hasScore ? `${agent.resolution}%` : '—'}
                        </span>
                        <div className="mt-1 text-[10px] text-neutral-400">
                          {Math.round((Number(agent.convos || 0) / maxConvosInList) * 100)}% of busiest
                        </div>
                      </div>

                      <div className="hidden text-sm tabular-nums text-neutral-700 md:block">
                        {agent.avgResponse != null ? `${Math.round(agent.avgResponse)}ms` : '—'}
                      </div>

                      <div className="hidden text-sm font-bold tabular-nums text-neutral-800 md:block">
                        {isDraft || agent.handoffs == null ? '—' : agent.handoffs}
                      </div>

                      <div className="hidden md:block">
                        <div
                          className={cx(
                            'text-sm tabular-nums',
                            agent.csat == null
                              ? 'font-normal text-neutral-400'
                              : 'font-bold text-neutral-900',
                          )}
                        >
                          {agent.csat != null ? `${Number(agent.csat).toFixed(1)}/5` : 'Not analyzed'}
                        </div>
                      </div>

                      <div className="hidden md:block">
                        <SentimentCell
                          score={agent.sentiment}
                          calls={agent.sentimentCalls}
                          label={agent.sentimentLabel}
                        />
                      </div>

                      <div className="hidden w-full md:block">
                        {hasTrend ? (
                          <TrendArea data={series} color={TREND_STATE[trendState].color} />
                        ) : (
                          <span className="text-[11px] text-neutral-400">No trend data</span>
                        )}
                      </div>

                      <ChevronRight className="h-4 w-4 shrink-0 text-neutral-400" />
                    </div>
                  );
                })}
              </div>

              <div className="mt-3 grid grid-cols-3 items-center gap-3 border-t border-neutral-100 pt-3">
                <span className="text-[11px] font-medium text-neutral-500">
                  {`${currentBreakdownPage * BREAKDOWN_PAGE_SIZE + 1}-${Math.min((currentBreakdownPage + 1) * BREAKDOWN_PAGE_SIZE, sortedAgents.length)} of ${sortedAgents.length}`}
                </span>
                <div className="hidden items-center justify-center gap-5 md:flex">
                  {(['up', 'flat', 'down'] as const).map((state) => (
                    <span
                      key={state}
                      className="flex items-center gap-1.5 text-[11px] font-medium text-neutral-500"
                    >
                      <span
                        className="h-2 w-2 rounded-full"
                        style={{ background: TREND_STATE[state].color }}
                      />
                      {TREND_STATE[state].label}
                    </span>
                  ))}
                </div>
                <div className="flex items-center justify-end gap-1">
                  <button
                    type="button"
                    onClick={() => setBreakdownPage((page) => Math.max(0, page - 1))}
                    disabled={currentBreakdownPage === 0}
                    className="inline-flex h-7 w-7 items-center justify-center rounded-full text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-neutral-900 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <span className="px-1 text-[11px] font-semibold tabular-nums text-neutral-600">
                    {currentBreakdownPage + 1}/{breakdownPageCount}
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      setBreakdownPage((page) => Math.min(breakdownPageCount - 1, page + 1))
                    }
                    disabled={currentBreakdownPage >= breakdownPageCount - 1}
                    className="inline-flex h-7 w-7 items-center justify-center rounded-full text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-neutral-900 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </AnalyticsPanel>
          </div>
        ) : null}

        <div>
          <SectionEyebrow label="Conversation activity" />
          <div className="grid grid-cols-1 gap-3.5 lg:grid-cols-[2fr_1fr]">
            <AnalyticsPanel
              title="Daily outcomes"
              subtitle={`How each day's chats ended · ${periodLabel}`}
              tip="Each column is one day's chats: resolved by the agent, handed off to a person, or booked as a callback. The number on top is that day's resolution rate."
              isLoading={isLoading}
              className="flex flex-col"
              action={
                <div className="text-right">
                  <div className={cx('text-[26px] font-bold leading-7', resolutionValueClass)}>
                    {metrics.resolutionRate}
                  </div>
                  <div className="text-[10px] font-semibold text-neutral-400">
                    {metrics.resolutionRateDelta != null
                      ? `resolved · ${metrics.resolutionRateDelta > 0 ? '+' : ''}${metrics.resolutionRateDelta} pts vs previous`
                      : 'resolved this range'}
                  </div>
                </div>
              }
            >
              {/* Every column is one day: its height is the volume, its red
                  share is what the agent closed itself, and the number on top
                  is that day's resolution rate. */}
              <div className="mt-4 flex flex-wrap gap-2">
                {OUTCOME_SERIES.map((series) => (
                  <span
                    key={series.key}
                    className="inline-flex items-center gap-1.5 rounded-full border border-neutral-200 px-2.5 py-1 text-[11px] font-medium text-neutral-600"
                  >
                    <span
                      className="h-2 w-2 shrink-0 rounded-full"
                      style={{ background: series.color, boxShadow: 'inset 0 0 0 1px rgba(17,17,17,.12)' }}
                    />
                    {series.label}
                    <span className="font-bold tabular-nums text-neutral-900">
                      {outcomeTotals[series.key]} ·{' '}
                      {outcomeTotals.total
                        ? Math.round((outcomeTotals[series.key] / outcomeTotals.total) * 100)
                        : 0}
                      %
                    </span>
                  </span>
                ))}
              </div>
              <div className="mt-4 min-h-[130px] w-full flex-1">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart
                    data={outcomeRows}
                    margin={{ top: 12, right: 12, bottom: 0, left: -20 }}
                    barCategoryGap="30%"
                  >
                    <CartesianGrid stroke="#d1d5db" strokeDasharray="1 5" strokeLinecap="round" />
                    <XAxis
                      dataKey="name"
                      stroke="#94a3b8"
                      fontSize={10}
                      tickLine={false}
                      axisLine={false}
                      tickMargin={8}
                    />
                    <YAxis
                      stroke="#94a3b8"
                      fontSize={10}
                      tickLine={false}
                      axisLine={false}
                      width={46}
                      allowDecimals={false}
                    />
                    <Tooltip cursor={{ fill: 'rgba(15, 23, 42, 0.04)' }} content={<ChartTip />} />
                    {/* three shades of one red, darkest for resolved: the ramp
                        says "more to less resolved", the legend says which is which */}
                    <Bar
                      dataKey="resolved"
                      name="Resolved"
                      stackId="day"
                      fill={THEME_PRIMARY}
                      stroke="#ffffff"
                      strokeWidth={2}
                      maxBarSize={46}
                      isAnimationActive
                      animationDuration={700}
                    />
                    <Bar
                      dataKey="handoffs"
                      name={OUTCOME_SERIES[1].label}
                      stackId="day"
                      fill={OUTCOME_SERIES[1].color}
                      stroke="#ffffff"
                      strokeWidth={2}
                      maxBarSize={46}
                      isAnimationActive
                      animationDuration={700}
                    />
                    <Bar
                      dataKey="scheduled_callbacks"
                      name="Callback"
                      stackId="day"
                      fill={OUTCOME_SERIES[2].color}
                      stroke="#ffffff"
                      strokeWidth={2}
                      radius={[6, 6, 0, 0]}
                      maxBarSize={46}
                      isAnimationActive
                      animationDuration={700}
                    />
                    {/* the line joins the resolved tops, so the week's shape is
                        one stroke; hollow dots mark each day */}
                    <Line
                      dataKey="resolved"
                      name="Resolved"
                      type="linear"
                      stroke="#7f1d1d"
                      strokeWidth={1.5}
                      dot={{ r: 3.5, fill: '#ffffff', stroke: '#7f1d1d', strokeWidth: 1.5 }}
                      activeDot={{ r: 5, fill: '#ffffff', stroke: '#7f1d1d', strokeWidth: 2 }}
                      legendType="none"
                      tooltipType="none"
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </AnalyticsPanel>

            <AnalyticsPanel
              title="Channels"
              subtitle="Where conversations came from"
              tip="Share of conversations by the channel the visitor used to reach the agent."
              isLoading={isLoading}
            >
              {/* One tinted card per channel: icon on top, the share as the
                  headline figure, name and raw count underneath. */}
              <div className="mt-4 grid grid-cols-2 gap-3">
                {channelData.map((item: any) => {
                  const ChannelIcon = CHANNEL_ICONS[item.name] ?? Globe;
                  return (
                    <div
                      key={item.name}
                      className="flex items-center gap-3 rounded-2xl px-3 py-3"
                      style={{ background: `color-mix(in oklab, ${item.color} 14%, white)` }}
                    >
                      <span
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white shadow-[0_3px_8px_rgba(17,17,17,0.16)]"
                      >
                        <ChannelIcon className="h-4 w-4 text-red-600" strokeWidth={2.25} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="text-lg font-black leading-none text-neutral-900">{item.pct}</div>
                        {/* the full name, never clipped - it wraps instead of truncating */}
                        <div className="mt-1 break-words text-[12px] font-semibold leading-tight text-neutral-800">
                          {item.name}
                        </div>
                        <div className="mt-0.5 text-[10.5px] font-medium text-neutral-500">
                          {item.value} chats
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </AnalyticsPanel>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-3.5">
            <AnalyticsPanel
              title="Conversations by hour"
              subtitle="Chats by hour of day (local time). Darker cells = busier hours."
              tip="Hour-of-day distribution. Use it to schedule live agents for handoffs during peak hours."
              isLoading={isLoading}
            >
              {/* One cell per hour on a single red ramp - light for the quiet
                  hours, solid for the peak - so the busiest stretch shows as a
                  block rather than a spike. */}
              <div className="mt-5">
                <div className="flex items-end gap-1">
                  {hourlyData.map((slot) => {
                    const share = maxHourly > 0 ? slot.calls / maxHourly : 0;
                    const isPeak = slot.calls > 0 && slot.hourNum === peakSlot.hourNum;
                    return (
                      <CustomTooltip
                        key={slot.hourNum}
                        side="top"
                        text={`${slot.hour} · ${slot.calls} ${slot.calls === 1 ? 'chat' : 'chats'}`}
                        className="rounded-lg border-neutral-200! bg-white! text-xs font-semibold text-neutral-900! shadow-[0_4px_14px_rgba(17,17,17,.08)]! [&_svg]:fill-white"
                      >
                        <div className="flex min-w-0 flex-1 cursor-default flex-col items-center gap-1.5">
                          <span
                            className={cx(
                              'h-4 text-[10px] font-bold tabular-nums leading-4',
                              isPeak ? 'text-red-600' : 'text-transparent',
                            )}
                          >
                            {slot.calls}
                          </span>
                          <span
                            className={cx(
                              'block h-10 w-full rounded-md transition-[transform,box-shadow] duration-150 hover:-translate-y-0.5',
                              isPeak && 'ring-2 ring-red-600 ring-offset-1',
                            )}
                            style={{
                              background:
                                share === 0
                                  ? '#f5f5f5'
                                  : `color-mix(in oklab, ${THEME_PRIMARY} ${Math.round(12 + share * 88)}%, white)`,
                            }}
                          />
                          <span
                            className={cx(
                              'h-3 whitespace-nowrap text-[9.5px] leading-3',
                              slot.hourNum % 3 === 0 ? 'text-neutral-400' : 'text-transparent',
                            )}
                          >
                            {slot.hourNum % 3 === 0 ? slot.hour : '·'}
                          </span>
                        </div>
                      </CustomTooltip>
                    );
                  })}
                </div>
                <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-neutral-100 pt-3">
                  <p className="text-xs text-neutral-500">
                    {peakSlot.calls > 0 ? (
                      <>
                        Busiest at{' '}
                        <span className="font-bold text-neutral-900">{peakSlot.hour}</span> with{' '}
                        <span className="font-bold text-neutral-900">{peakSlot.calls} chats</span>
                        {totalHourly > 0
                          ? ` - ${Math.round((peakSlot.calls / totalHourly) * 100)}% of the day's volume.`
                          : '.'}
                      </>
                    ) : (
                      'No chats recorded in this range yet.'
                    )}
                  </p>
                  <span className="flex items-center gap-2 text-[10px] font-medium text-neutral-400">
                    Fewer
                    <span
                      aria-hidden="true"
                      className="h-2 w-20 rounded-full"
                      style={{
                        background: `linear-gradient(90deg, color-mix(in oklab, ${THEME_PRIMARY} 12%, white), ${THEME_PRIMARY})`,
                      }}
                    />
                    More
                  </span>
                </div>
              </div>
            </AnalyticsPanel>

          </div>
        </div>

        <div>
          <SectionEyebrow label="Intents & sentiment" />
          <div className="grid grid-cols-1 gap-3.5 lg:grid-cols-2">
            <AnalyticsPanel
              title="Top user intents"
              subtitle="What visitors actually asked about"
              tip="Most frequent intents, derived from intent classification of visitor messages."
              isLoading={isLoading}
              className="flex flex-col"
            >
              <div className="mt-4 grid flex-1 grid-cols-1 content-evenly gap-x-4 gap-y-2 sm:grid-cols-2">
                {intents.length ? (
                  intents.slice(0, 6).map((item, index) => (
                    <div
                      key={`${item.name}-${index}`}
                      className="flex items-center gap-3.5 rounded-xl px-1.5 py-2 transition-colors hover:bg-neutral-50"
                    >
                      <TopicRing value={Math.round(item.pct)} />
                      <div className="min-w-0">
                        <div className="text-[13px] font-bold leading-4 text-neutral-900">
                          {item.name}
                        </div>
                        <div className="mt-0.5 text-[11.5px] leading-4 text-neutral-500">
                          {item.value} of {intentTotal} chats
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="rounded-lg border border-dashed border-neutral-200 bg-neutral-50 px-4 py-7 text-center text-xs font-semibold text-neutral-500">
                    No analyzed intents yet
                  </div>
                )}
              </div>
            </AnalyticsPanel>

            <AnalyticsPanel
              title="Conversation sentiment"
              subtitle="Visitor sentiment mix (0-100) at the end of each chat."
              tip="Share of chats classified positive, neutral or negative each day, from the transcript. Watch the negative line more than the average."
              isLoading={isLoading}
            >
              {/* Three shares over time, one line each. An averaged score would
                  hide a rising negative share, which is the thing worth seeing. */}
              <div className="mt-4 flex flex-col gap-4 lg:flex-row lg:items-center">
                <div className="h-[168px] min-w-0 flex-1">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart
                      data={sentimentChartData}
                      margin={{ top: 6, right: 8, bottom: 0, left: -20 }}
                    >
                      <CartesianGrid stroke="#f1f5f9" />
                      <XAxis
                        dataKey="name"
                        stroke="#94a3b8"
                        fontSize={10}
                        tickLine={false}
                        axisLine={false}
                        tickMargin={8}
                      />
                      <YAxis
                        domain={[0, 100]}
                        ticks={[0, 25, 50, 75, 100]}
                        stroke="#94a3b8"
                        fontSize={10}
                        tickLine={false}
                        axisLine={false}
                        width={46}
                      />
                      <Tooltip
                        cursor={{ stroke: '#cbd5e1', strokeWidth: 1 }}
                        content={<ChartTip unit="%" />}
                      />
                      {SENTIMENT_SERIES.map((series) => (
                        <Line
                          key={series.key}
                          type="linear"
                          dataKey={series.key}
                          name={series.label}
                          stroke={series.color}
                          strokeWidth={1.5}
                          dot={{ r: 3.5, fill: '#ffffff', stroke: series.color, strokeWidth: 1.5 }}
                          activeDot={{ r: 5, fill: '#ffffff', stroke: series.color, strokeWidth: 2 }}
                        />
                      ))}
                    </LineChart>
                  </ResponsiveContainer>
                </div>

                <div className="flex shrink-0 flex-row gap-4 lg:w-[142px] lg:flex-col lg:gap-3">
                  {SENTIMENT_SERIES.map((series, index) => (
                    <div key={series.key} className="flex min-w-0 flex-1 items-center gap-2">
                      <span
                        className="h-2.5 w-2.5 shrink-0 rounded-full"
                        style={{ background: series.color }}
                      />
                      <span className="min-w-0 flex-1 truncate text-xs font-medium text-neutral-600">
                        {series.label}
                      </span>
                      <span className="text-xs font-bold tabular-nums text-neutral-900">
                        {sentimentTotal ? sentimentData[index]?.pct : '0%'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {sentimentMove === null ? (
                <div className="mt-4 flex items-center gap-2 rounded-lg bg-neutral-50 px-3 py-2.5 text-[12.5px] font-medium text-neutral-500">
                  <Info className="h-4 w-4 shrink-0" />
                  No previous period to compare this range against yet.
                </div>
              ) : (
                <div
                  className={cx(
                    'mt-4 flex items-center gap-2 rounded-lg px-3 py-2.5 text-[12.5px] font-medium',
                    sentimentMove > 0
                      ? 'bg-emerald-50 text-emerald-700'
                      : sentimentMove < 0
                        ? 'bg-red-50 text-red-700'
                        : 'bg-neutral-50 text-neutral-600',
                  )}
                >
                  {sentimentMove > 0 ? (
                    <ArrowUp className="h-4 w-4 shrink-0" />
                  ) : sentimentMove < 0 ? (
                    <ArrowDown className="h-4 w-4 shrink-0" />
                  ) : (
                    <Minus className="h-4 w-4 shrink-0" />
                  )}
                  {sentimentMove === 0
                    ? `Sentiment held steady compared to the previous ${previousRange.days} days.`
                    : `Sentiment ${sentimentMove > 0 ? 'improved' : 'declined'} by ${Math.abs(
                        sentimentMove,
                      )}% compared to previous ${previousRange.days} days.`}
                </div>
              )}
            </AnalyticsPanel>

          </div>
          <div className="mt-4 grid grid-cols-1 gap-3.5">
            <AnalyticsPanel
              title="Unanswered questions"
              subtitle="Pick an agent to see their questions, then answer each one."
              tip="Questions visitors asked that the agent could not answer with confidence."
              isLoading={isLoading}
            >
              <div className="mt-4 space-y-2.5">
                {activeAgents.slice(0, 5).map((agent: any) => (
                  <div
                    key={agent.id}
                    onClick={() => {
                      if (agent.status === 'draft') return;
                      setSelectedRepId(agent.id);
                      analyticsContentRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
                    }}
                    className="flex cursor-pointer items-center justify-between gap-3 rounded-lg border border-neutral-100 p-3 transition-colors hover:bg-neutral-50"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="shrink-0">
                        <CustomAvatar
                          name={agent.name}
                          size="32"
                          showPresence={false}
                          isActivityInfo={false}
                          textClass="text-[11px]"
                        />
                      </div>
                      <div className="min-w-0">
                        <h4 className="truncate text-[13px] font-normal text-neutral-900">
                          {agent.name}
                        </h4>
                        <p className="truncate text-[10px] text-neutral-500">{agent.subtitle}</p>
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <span className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-[10px] font-bold text-emerald-600">
                        All clear ✓
                      </span>
                      <ChevronRight className="h-4 w-4 text-neutral-400" />
                    </div>
                  </div>
                ))}
              </div>
            </AnalyticsPanel>
          </div>
        </div>

        <div>
          <SectionEyebrow label="Audience" />
          <div className="grid grid-cols-1 gap-3.5 lg:grid-cols-2">
            <AnalyticsPanel
              title="Top countries"
              subtitle="Where your visitors are chatting from"
              tip="Visitor location from the session, by conversation count."
              isLoading={isLoading}
            >
              {/* One row per country: the bar is the comparison, the count and
                  the share are the two ways people quote it. */}
              <div className="mt-4 divide-y divide-neutral-100">
                {countries.map((item: any, index: number) => {
                  const total = countries.reduce(
                    (sum: number, row: any) => sum + Number(row.value || 0),
                    0,
                  );
                  const share = total ? Math.round((Number(item.value || 0) / total) * 100) : 0;
                  return (
                    <div key={`${item.code}-${index}`} className="flex items-center gap-3 py-2.5">
                      <span className="w-6 shrink-0 text-center text-lg leading-none">{item.flag}</span>
                      <span className="w-[140px] shrink-0 truncate text-xs font-semibold text-neutral-800">
                        {item.name}
                      </span>
                      <span className="h-2 min-w-0 flex-1 overflow-hidden rounded-full bg-neutral-100">
                        <span
                          className="block h-full rounded-full transition-[width] duration-500 ease-out"
                          style={{
                            width: `${item.barPct}%`,
                            background: `color-mix(in oklab, ${THEME_PRIMARY} ${Math.round(35 + (item.barPct / 100) * 65)}%, white)`,
                          }}
                        />
                      </span>
                      <span className="w-10 shrink-0 text-right text-xs font-bold tabular-nums text-neutral-900">
                        {item.value}
                      </span>
                      <span aria-hidden="true" className="h-3 w-px shrink-0 bg-neutral-200" />
                      <span className="w-10 shrink-0 text-right text-xs font-bold tabular-nums text-neutral-900">
                        {share}%
                      </span>
                    </div>
                  );
                })}
              </div>
            </AnalyticsPanel>

            <AnalyticsPanel
              title="Languages detected"
              subtitle="From visitor messages"
              tip="Language detected on the visitor's side of the chat; every agent replies in the visitor's language."
              isLoading={isLoading}
            >
              {/* One bar, top to bottom: each language is a segment sized to
                  its share, the number sits under its own segment, and the
                  legend below spells out which colour is which language. */}
              <div className="mt-6">
                <div className="flex h-9 w-full overflow-hidden rounded-full">
                  {languages.map((item: any, index: number) => (
                    <div
                      key={`${item.name}-seg-${index}`}
                      onMouseEnter={() => setActiveLanguage(index)}
                      onMouseLeave={() => setActiveLanguage(null)}
                      className="h-full transition-opacity duration-150"
                      style={{
                        width: `${Math.max(item.pct, languages.length ? 2 : 0)}%`,
                        background: LANGUAGE_RAMP[index % LANGUAGE_RAMP.length],
                        opacity: activeLanguage === null || activeLanguage === index ? 1 : 0.35,
                        marginLeft: index === 0 ? 0 : 2,
                      }}
                    />
                  ))}
                </div>
                <div className="mt-2 flex w-full">
                  {languages.map((item: any, index: number) => (
                    <div
                      key={`${item.name}-pct-${index}`}
                      className="text-center text-sm font-bold tabular-nums text-neutral-900"
                      style={{ width: `${Math.max(item.pct, languages.length ? 2 : 0)}%` }}
                    >
                      {item.pct}%
                    </div>
                  ))}
                </div>
                <div className="mt-5 flex flex-wrap gap-x-4 gap-y-2">
                  {languages.map((item: any, index: number) => (
                    <div
                      key={`${item.name}-legend-${index}`}
                      onMouseEnter={() => setActiveLanguage(index)}
                      onMouseLeave={() => setActiveLanguage(null)}
                      className={cx(
                        'flex items-center gap-1.5 rounded-full px-2 py-1 text-xs font-semibold text-neutral-700 transition-colors',
                        activeLanguage === index && 'bg-neutral-50',
                      )}
                    >
                      <span
                        aria-hidden="true"
                        className="h-2.5 w-2.5 shrink-0 rounded-full"
                        style={{ background: LANGUAGE_RAMP[index % LANGUAGE_RAMP.length] }}
                      />
                      <span className="text-sm leading-none">{item.flag}</span>
                      {item.name}
                    </div>
                  ))}
                </div>
              </div>
            </AnalyticsPanel>
          </div>
        </div>

        <div>
          <SectionEyebrow label="Follow-up & cost" />
          <div className="grid grid-cols-1 gap-3.5 lg:grid-cols-2">
            <AnalyticsPanel
              title="Top FAQs by usage"
              subtitle="Most-triggered answers this range"
              tip="Knowledge-base answers the agent served most often."
              isLoading={isLoading}
            >
              <div className="mt-4 divide-y divide-neutral-100">
                {faqs.map((item: any, index: number) => (
                  <div key={`${item.q}-${index}`} className="flex items-center gap-3 py-2.5">
                    <span className="w-5 shrink-0 text-[10px] font-bold tabular-nums text-neutral-400">
                      {String(index + 1).padStart(2, '0')}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-xs font-semibold text-neutral-800">
                      {item.q}
                    </span>
                    <span className="shrink-0 rounded-full border border-neutral-200 bg-neutral-50 px-2.5 py-0.5 text-[10px] font-bold tabular-nums text-neutral-700">
                      {item.count}× · {item.pct}%
                    </span>
                  </div>
                ))}
              </div>
            </AnalyticsPanel>

            <AnalyticsPanel
              title="Cost & usage"
              subtitle="AI inference spend this period"
              tip="What the agents' replies cost to generate over the range, split by agent."
              isLoading={isLoading}
            >
              <div className="mt-4 grid grid-cols-2 gap-3">
                <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-3">
                  <div className="text-[10px] font-bold uppercase tracking-[0.06em] text-neutral-500">
                    Total spend
                  </div>
                  <div className="mt-1 text-xl font-bold tabular-nums text-neutral-900">
                    {totalSpend != null ? `$${Number(totalSpend).toFixed(4)}` : '--'}
                  </div>
                  <div className="mt-0.5 text-[10px] text-neutral-400">This period</div>
                </div>
                <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-3">
                  <div className="text-[10px] font-bold uppercase tracking-[0.06em] text-neutral-500">
                    Total replies
                  </div>
                  <div className="mt-1 text-xl font-bold tabular-nums text-neutral-900">
                    {totalReplies != null ? Number(totalReplies).toLocaleString('en-US') : '--'}
                  </div>
                  <div className="mt-0.5 text-[10px] text-neutral-400">Generated by agents</div>
                </div>
              </div>

              <div className="mt-4">
                <div className="mb-1 text-[10px] font-bold uppercase tracking-[0.06em] text-neutral-400">
                  Spend by agent
                </div>
                <div className="max-h-[150px] divide-y divide-neutral-100 overflow-y-auto pr-1">
                  {spendRows.map((row: any) => {
                    const isDeleted = Boolean(row.agent_uuid && !activeAgentIdSet.has(row.agent_uuid));
                    const spend = Number(row.total_spend || 0);
                    return (
                      <div key={row.agent_uuid} className="flex items-center gap-3 py-2 text-xs">
                        <span className="flex min-w-0 flex-1 items-center gap-1.5">
                          <span className="truncate text-[13px] font-normal text-neutral-900">
                            {row.agent_name || agentNameMap.get(row.agent_uuid) || row.agent_uuid}
                          </span>
                          {isDeleted && (
                            <span className="shrink-0 rounded-full border border-red-200 bg-red-50 px-1.5 py-0.5 text-[9px] font-bold text-red-600">
                              Deleted
                            </span>
                          )}
                        </span>
                        <span className="h-1.5 w-16 shrink-0 overflow-hidden rounded-full bg-neutral-100">
                          <span
                            className="block h-full rounded-full bg-red-600"
                            style={{ width: `${maxSpend ? Math.round((spend / maxSpend) * 100) : 0}%` }}
                          />
                        </span>
                        <span className="w-16 shrink-0 text-right font-bold tabular-nums text-neutral-900">
                          {row.total_spend != null ? `$${spend.toFixed(4)}` : '--'}
                        </span>
                      </div>
                    );
                  })}
                  {spendRows.length === 0 && (
                    <p className="py-2 text-xs text-neutral-400">No spend data available.</p>
                  )}
                </div>
              </div>
            </AnalyticsPanel>
          </div>
        </div>
      </div>
    </div>
  );
}
