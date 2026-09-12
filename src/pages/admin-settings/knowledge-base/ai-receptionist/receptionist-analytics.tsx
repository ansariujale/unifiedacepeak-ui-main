import { useState, useMemo, useRef, useId, useEffect, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getReceptionistAnalytics } from '@/services/api';
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
  Info,
  Loader2,
  Minus,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import CustomAvatar from '@/components/custom/custom-avatar';
import CustomTooltip from '@/components/custom/custom-tooltip';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import {
  ResponsiveContainer,
  ComposedChart,
  Bar,
  LineChart,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
} from 'recharts';
import { downloadAnalyticsSectionAsPdf } from '@/lib/analytics-export';
import { handleAlert } from '@/lib/utils';
// DUMMY DATA - remove this import together with DUMMY_DATA.ts
import { buildDummyAnalytics, SHOW_DUMMY_DATA } from '../DUMMY_DATA';

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

/* The same pill dropdown the sessions screen uses, so the filters across AI
   Tools look and behave alike. */
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

interface ReceptionistAnalyticsProps {
  onClose: () => void;
  receptionists: any[];
}

const ANALYTICS_COMING_SOON = false;
const THEME_PRIMARY = '#dc2626';

// Local helper to validate hex colors
// const isValidHex = (color: string) => {
//   return /^#[0-9A-Fa-f]{6}$/.test(color);
// };

/* The sentiment card plots the mix, not one averaged score: a rising negative
   share is exactly what an average hides. One line per share, and the legend
   beside the chart carries the range's own figure for each. */
const SENTIMENT_SERIES = [
  { key: 'positive' as const, label: 'Positive', color: '#10b981' },
  { key: 'neutral' as const, label: 'Neutral', color: '#94a3b8' },
  { key: 'negative' as const, label: 'Negative', color: THEME_PRIMARY },
];

/* "24 calls" over the date, the way the reference labels a point. */
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

/* The same sentiment pill the AI Receptionists table shows, so a score reads
   identically wherever it appears: "positive · 82" on a green wash, amber for
   neutral, red for negative, grey when nothing has been analysed yet. */
const SentimentPill = ({ score }: { score: number | null }) => {
  if (score === null || !Number.isFinite(Number(score))) {
    return (
      <span className="inline-flex w-fit items-center justify-center rounded-full bg-gray-100! px-2.5 py-1 text-[12px] font-semibold text-gray-500!">
        Not analyzed
      </span>
    );
  }
  const value = Number(score);
  const label = value >= 75 ? 'positive' : value >= 50 ? 'neutral' : 'negative';
  const pillClass =
    label === 'positive'
      ? 'bg-green-50! text-green-700!'
      : label === 'negative'
        ? 'bg-red-50! text-red-600!'
        : 'bg-amber-50! text-amber-700!';
  return (
    <span
      className={`inline-flex w-fit items-center justify-center gap-1 rounded-full px-2.5 py-1 text-[12px] font-semibold capitalize ${pillClass}`}
    >
      {label} · {Math.round(value)}
    </span>
  );
};

/* The same marks the sessions table uses for an outcome, so "Live transfer"
   here is the handoff glyph a reader has already met there - and the donut
   takes the same hues, so a slice maps to its row without a swatch. */
const OUTCOME_META = {
  resolved: { ink: 'text-emerald-600', border: 'border-emerald-500', color: '#10b981' },
  transfer: { ink: 'text-blue-600', border: 'border-blue-500', color: '#2563eb' },
  callback: { ink: 'text-amber-600', border: 'border-amber-500', color: '#f59e0b' },
} as const;

/* The three ways a conversation ends, on one red ramp: darkest for the
   outcome you want, lighter as it needs a person. One hue, so the legend
   names the segments and the ramp only says "more to less resolved". */
const OUTCOME_SERIES = [
  { key: 'resolved', label: 'Resolved', color: '#dc2626' },
  { key: 'handoffs', label: 'Live transfer', color: '#f29797' },
  { key: 'scheduled_callbacks', label: 'Callback', color: '#fbd5d5' },
] as const;

/* The three states the Trend column can be in. Colour carries the direction,
   so a row reads improved / flat / declined without comparing its endpoints —
   and the legend under the table names each one, so it is never colour alone. */
const TREND_STATE: Record<'up' | 'flat' | 'down', { color: string; label: string }> = {
  up: { color: '#059669', label: 'Improved' },
  flat: { color: '#d97706', label: 'Flat' },
  down: { color: THEME_PRIMARY, label: 'Declined' },
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

  // Catmull-Rom converted to cubic beziers, so the line curves the way the
  // reference does instead of showing every joint.
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


const CardLoader = ({ dark = false }: { dark?: boolean }) => (
  <div
    className={`absolute inset-0 z-10 flex items-center justify-center backdrop-blur-[1px] rounded-[inherit] ${dark ? 'bg-black/40' : 'bg-white/60'}`}
  >
    <div
      className={`h-5 w-5 animate-spin rounded-full border-2 border-t-transparent ${dark ? 'border-white' : 'border-red-600'}`}
    />
  </div>
);

const toNumber = (value: any) => {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(
    typeof value === 'string' ? value.replace('%', '').replace(/,/g, '').trim() : value,
  );
  return Number.isFinite(parsed) ? parsed : null;
};

const getPathValue = (source: any, path: string) =>
  path.split('.').reduce((value, key) => value?.[key], source);

const pickNumber = (source: any, paths: string[], defaultValue: number | null = 0) => {
  for (const path of paths) {
    const parsed = toNumber(getPathValue(source, path));
    if (parsed !== null) return parsed;
  }
  return defaultValue;
};

const pickArray = (source: any, paths: string[]) => {
  for (const path of paths) {
    const value = getPathValue(source, path);
    if (Array.isArray(value)) return value;
  }
  return [];
};

const normalizeAnalyticsPayload = (payload: any) => {
  const data =
    payload?.data && typeof payload.data === 'object' && !Array.isArray(payload.data)
      ? payload.data
      : payload || {};
  const result =
    data?.result && typeof data.result === 'object' && !Array.isArray(data.result)
      ? data.result
      : {};
  const analytics = { ...result, ...data };
  const agentBreakdown = pickArray(analytics, ['agent_breakdown']);
  const receptionistBreakdown = pickArray(analytics, ['per_receptionist_breakdown']);
  const dailyBreakdown = pickArray(analytics, [
    'daily_breakdown',
    'daily_inbound_call_distribution',
  ]);
  const hourlyBreakdown = pickArray(analytics, [
    'hour_of_day_breakdown',
    'hour_of_day_distribution',
  ]);

  return {
    ...analytics,
    agent_breakdown: agentBreakdown.length ? agentBreakdown : receptionistBreakdown,
    daily_breakdown: dailyBreakdown,
    hour_of_day_breakdown: hourlyBreakdown,
  };
};

const formatPercentage = (value: number | null) =>
  value === null ? 'Not analyzed' : `${Math.round(value)}%`;

const formatCsat = (value: number | null) => {
  if (value === null) return 'Not analyzed';
  return value > 5 ? `${Math.round(value)}%` : `${value.toFixed(1)}/5`;
};

/* The same tip the receptionist wizard uses on "Voice & persona", so every
   info tip across AI Tools reads identically. */
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

/* The red eyebrow that opens each section of the page, as the Overview strip
   has it, so the report reads in named parts rather than as one long column. */
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
  dark = false,
  action,
}: {
  title: string;
  subtitle?: string;
  tip?: string;
  children: ReactNode;
  className?: string;
  isLoading?: boolean;
  dark?: boolean;
  /** Optional control shown at the right of the card's own header. */
  action?: ReactNode;
}) {
  return (
    <div
      className={`relative rounded-2xl border-[1.5px] border-neutral-200 bg-white p-4 shadow-[0_1px_2px_rgba(0,0,0,.03)] ${className}`}
    >
      {isLoading && <CardLoader dark={dark} />}
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-1.5">
            <h3 className={`text-[14px] font-bold ${dark ? 'text-white' : 'text-neutral-950'}`}>
              {title}
            </h3>
            {tip ? <InfoTip text={tip} /> : null}
          </div>
          {subtitle ? (
            <p className={`mt-1 text-xs ${dark ? 'text-white/60' : 'text-neutral-500'}`}>
              {subtitle}
            </p>
          ) : null}
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
      {children}
    </div>
  );
}

/* A ranked list: the rank says the order, the bar says the gap. Each fill sits
   on one red ramp against the busiest topic, so the drop-off from the top
   reads at a glance without comparing numbers. */
/* A circular progress per topic, as the reference draws it: the share sits in
   the ring, the name and a one-line gloss sit beside it. The arc sweeps to its
   value after mount so the card arrives rather than appears. */
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

function TopicTile({ name, value, description }: { name: string; value: number; description?: string }) {
  return (
    <div className="flex items-center gap-3.5 rounded-xl px-1.5 py-2 transition-colors hover:bg-neutral-50">
      <TopicRing value={value} />
      <div className="min-w-0">
        <div className="text-[13px] font-bold leading-4 text-neutral-900">{name}</div>
        {description ? (
          <div className="mt-0.5 text-[11.5px] leading-4 text-neutral-500">{description}</div>
        ) : null}
      </div>
    </div>
  );
}

export default function ReceptionistAnalytics({
  onClose,
  receptionists,
}: ReceptionistAnalyticsProps) {
  const navigate = useNavigate();
  const analyticsContentRef = useRef<HTMLDivElement | null>(null);
  const [dateRange, setDateRange] = useState<'today' | 'yesterday' | '7d' | '30d' | '90d'>('7d');
  const [breakdownSort, setBreakdownSort] = useState<'calls' | 'csat-desc' | 'csat-asc'>(
    'calls',
  );
  const [breakdownPage, setBreakdownPage] = useState(0);
  // which outcome slice is under the pointer, so its legend row lights up too
  const [selectedRepId, setSelectedRepId] = useState<string>('all');
  const [isExportingPdf, setIsExportingPdf] = useState(false);

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

  const agentId = selectedRepId === 'all' ? '' : selectedRepId;
  const viewerTimeZone = useMemo(() => Intl.DateTimeFormat().resolvedOptions().timeZone, []);
  //
  const {
    data: analyticsData,
    error,
    isLoading,
  } = useQuery({
    queryKey: ['receptionistAnalytics', startDate, endDate, agentId, viewerTimeZone],
    queryFn: async () => {
      const response = await getReceptionistAnalytics({
        startDate,
        endDate,
        agentId,
        timezone: viewerTimeZone,
      });
      return response.data;
    },
    enabled: !ANALYTICS_COMING_SOON,
  });

  if (error) {
    console.error('Receptionist Analytics API Error:', error);
  }
  const analytics = useMemo(() => {
    const normalized = normalizeAnalyticsPayload(analyticsData);
    if (!SHOW_DUMMY_DATA) return normalized;

    // DUMMY DATA - filled per section rather than all-or-nothing: the API
    // often returns the totals but no series, which left every chart flat.
    // Anything the API did send wins. Remove with DUMMY_DATA.ts.
    const dummy = buildDummyAnalytics();
    const filled: any = { ...normalized };

    const emptyList = (value: any) => !Array.isArray(value) || value.length === 0;
    (
      [
        'daily_breakdown',
        'sentiment_trend',
        'hour_of_day_breakdown',
        'conversation_topics',
        'agent_breakdown',
      ] as const
    ).forEach((key) => {
      if (emptyList(filled[key])) filled[key] = (dummy as any)[key];
    });

    const blankNumber = (value: any) => value === undefined || value === null || Number(value) === 0;
    (
      [
        'calls_handled',
        'total_calls',
        'resolution_rate',
        'average_call_duration',
        'handoffs',
        'live_transfers',
        'scheduled_callbacks',
        'csat',
        'avg_csat',
        'avg_sentiment',
      ] as const
    ).forEach((key) => {
      if (blankNumber(filled[key])) filled[key] = (dummy as any)[key];
    });

    if (!filled.outcome_breakdown || typeof filled.outcome_breakdown !== 'object') {
      filled.outcome_breakdown = dummy.outcome_breakdown;
    }

    return filled;
  }, [analyticsData]);

  // Format duration from seconds to M:SS
  const formatDuration = (seconds: number) => {
    if (!seconds) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  // Merge parent page's actual receptionists if available
  const activeReceptionists = useMemo(() => {
    const apiRows = Array.isArray(analytics?.agent_breakdown) ? analytics.agent_breakdown : [];
    const apiMap = new Map<string, any>();
    apiRows.forEach((item: any) => {
      const id = String(item.agent_uuid || item.id || '').trim();
      if (id) apiMap.set(id, item);
    });

    const parentRows = Array.isArray(receptionists) ? receptionists : [];
    const combinedRows = [...parentRows];
    const parentIds = new Set(
      parentRows.map((rep: any) => String(rep.agent_uuid || rep.id || '').trim()).filter(Boolean),
    );
    apiRows.forEach((item: any) => {
      const id = String(item.agent_uuid || item.id || '').trim();
      if (id && !parentIds.has(id)) combinedRows.push(item);
    });

    return combinedRows.map((rep, idx) => {
      const repId = rep.agent_uuid || rep.id || String(idx);
      const apiItem = apiMap.get(String(repId)) || rep;
      const callsVal =
        pickNumber(apiItem, ['total_calls', 'calls_handled', 'session_calls', 'calls'], 0) || 0;
      const handoffs = pickNumber(apiItem, ['handoffs', 'live_transfers', 'transfers'], 0) || 0;
      const resolution =
        pickNumber(
          apiItem,
          ['resolution_rate', 'resolution'],
          callsVal ? ((callsVal - handoffs) / callsVal) * 100 : 0,
        ) || 0;
      const confidence = pickNumber(apiItem, ['avg_confidence', 'confidence'], null);
      const csat = pickNumber(
        apiItem,
        ['csat', 'avg_csat', 'customer_satisfaction', 'post_call_csat'],
        null,
      );
      const sentiment = pickNumber(apiItem, ['avg_sentiment', 'sentiment_score'], null);
      const scheduledCallbacks =
        pickNumber(apiItem, ['scheduled_callbacks', 'scheduledCallbacks'], 0) || 0;
      const resolved =
        pickNumber(apiItem, ['resolved', 'resolved_calls'], Math.max(0, callsVal - handoffs)) || 0;

      return {
        id: repId,
        name: rep.agentName || rep.agent_name || apiItem.agent_name || 'Unnamed Receptionist',
        subtitle: rep.forward_call_actions?.roleUseCase || 'Inbound virtual agent',
        calls: callsVal,
        resolution: Math.round(resolution),
        csat,
        csatLabel: formatCsat(csat),
        confidence,
        confidenceLabel: formatPercentage(confidence),
        sentiment,
        talkTime: pickNumber(apiItem, ['ai_talk_percentage', 'talk_time_percentage'], 0) || 0,
        // The trend column was hard-coded to zeros, so every row drew a flat
        // line. It now reads whichever per-agent series the payload carries.
        sparklineData: (() => {
          const series = pickArray(apiItem, ['daily_calls', 'trend', 'sparkline', 'volume']);
          const points = series
            .map((point: any) =>
              typeof point === 'number'
                ? point
                : pickNumber(point, ['calls_handled', 'calls', 'value', 'total_calls'], 0) || 0,
            )
            .filter((value: number) => Number.isFinite(value));
          return points.length ? points : [0, 0, 0, 0, 0, 0, 0, 0];
        })(),
        // The Trend column plots resolution over the range, so it reads its
        // own series when the payload carries one and falls back to volume.
        resolutionTrend: (() => {
          const series = pickArray(apiItem, [
            'daily_resolution',
            'resolution_trend',
            'resolution_series',
          ]);
          return series
            .map((point: any) =>
              typeof point === 'number'
                ? point
                : pickNumber(point, ['resolution_rate', 'resolution', 'value'], 0) || 0,
            )
            .filter((value: number) => Number.isFinite(value));
        })(),
        csatPrevious: pickNumber(
          apiItem,
          ['previous_csat', 'csat_previous', 'prev_csat', 'csat_last_period'],
          null,
        ),
        unansweredQuestions:
          pickNumber(apiItem, ['unanswered_questions_count', 'unanswered_questions'], 0) || 0,
        outcomes: { resolved, transfer: handoffs, scheduledCallbacks },
        volume: [],
        sentimentTrend: [],
        topics: [],
      };
    });
  }, [receptionists, analytics]);

  // Find currently selected receptionist details
  const selectedRep = useMemo(() => {
    return activeReceptionists.find((r) => r.id === selectedRepId);
  }, [selectedRepId, activeReceptionists]);

  // Aggregate metrics based on selected filters
  const metrics = useMemo(() => {
    if (selectedRep) {
      const calls = selectedRep.calls;
      const res = selectedRep.resolution;
      const duration = formatDuration(analytics?.average_call_duration ?? 0);
      const liveTransfers = selectedRep.outcomes.transfer;
      const scheduledCallbacks = selectedRep.outcomes.scheduledCallbacks;

      return {
        totalCalls: calls,
        resolution: `${res}%`,
        avgDuration: duration,
        transfers: liveTransfers,
        scheduledCallbacks,
        csat: selectedRep.csatLabel,
      };
    }

    // "All" selected -> sum metrics
    const totalCalls =
      pickNumber(
        analytics,
        ['calls_handled', 'total_calls', 'livekit_calls'],
        activeReceptionists.reduce((acc, r) => acc + r.calls, 0),
      ) || 0;
    const avgRes =
      pickNumber(
        analytics,
        ['resolution_rate'],
        activeReceptionists.length > 0
          ? Math.round(
              activeReceptionists.reduce((acc, r) => acc + r.resolution, 0) /
                activeReceptionists.length,
            )
          : 0,
      ) || 0;
    const totalTransfers =
      pickNumber(
        analytics,
        ['handoffs', 'live_transfers', 'transfers', 'outcome_breakdown.live_transfer'],
        activeReceptionists.reduce((acc, r) => acc + r.outcomes.transfer, 0),
      ) || 0;
    const totalScheduledCallbacks =
      pickNumber(
        analytics,
        [
          'scheduled_callbacks',
          'scheduledCallbacks',
          'outcome_breakdown.scheduled_callback',
          'outcome_breakdown.scheduled_callbacks',
        ],
        activeReceptionists.reduce((acc, r) => acc + r.outcomes.scheduledCallbacks, 0),
      ) || 0;
    const avgCsat = pickNumber(
      analytics,
      ['csat', 'avg_csat', 'customer_satisfaction', 'post_call_csat'],
      null,
    );

    return {
      totalCalls,
      resolution: `${avgRes}%`,
      avgDuration: formatDuration(analytics?.average_call_duration ?? 0),
      transfers: totalTransfers,
      scheduledCallbacks: totalScheduledCallbacks,
      csat: formatCsat(avgCsat),
    };
  }, [selectedRep, activeReceptionists, analyticsData, analytics]);

  // Donut ratios (Talk-to-listen) — show 0 until API provides data
  const talkListenRatio = useMemo(() => {
    // With "All receptionists" picked there is no single rep to read, so the
    // donut averages the talk time across the ones that reported it.
    const reported = activeReceptionists.filter((rep: any) => Number(rep.talkTime) > 0);
    const averageTalk = reported.length
      ? Math.round(
          reported.reduce((sum: number, rep: any) => sum + Number(rep.talkTime), 0) /
            reported.length,
        )
      : 0;
    const aiPercent = selectedRep ? selectedRep.talkTime : averageTalk;
    const callerPercent = 100 - aiPercent;
    return [
      { name: 'AI talking', value: aiPercent, color: THEME_PRIMARY },
      { name: 'Caller talking / silence', value: callerPercent, color: '#e2e8f0' },
    ];
  }, [selectedRep, activeReceptionists]);

  // Pie outcomes
  const pieData = useMemo(() => {
    const outcomes = selectedRep
      ? selectedRep.outcomes
      : {
          resolved:
            pickNumber(
              analytics,
              ['outcome_breakdown.resolved', 'resolved', 'resolved_calls'],
              activeReceptionists.reduce((acc, r) => acc + r.outcomes.resolved, 0),
            ) || 0,
          transfer:
            pickNumber(
              analytics,
              ['outcome_breakdown.live_transfer', 'handoffs', 'live_transfers', 'transfers'],
              activeReceptionists.reduce((acc, r) => acc + r.outcomes.transfer, 0),
            ) || 0,
          scheduledCallbacks:
            pickNumber(
              analytics,
              [
                'scheduled_callbacks',
                'scheduledCallbacks',
                'outcome_breakdown.scheduled_callback',
                'outcome_breakdown.scheduled_callbacks',
              ],
              activeReceptionists.reduce((acc, r) => acc + r.outcomes.scheduledCallbacks, 0),
            ) || 0,
        };

    const total = outcomes.resolved + outcomes.transfer + outcomes.scheduledCallbacks || 1;
    return [
      {
        key: 'resolved' as const,
        name: 'Resolved on call',
        value: outcomes.resolved,
        color: OUTCOME_META.resolved.color,
        pct: Math.round((outcomes.resolved / total) * 100),
      },
      {
        key: 'transfer' as const,
        name: 'Live transfer',
        value: outcomes.transfer,
        color: OUTCOME_META.transfer.color,
        pct: Math.round((outcomes.transfer / total) * 100),
      },
      {
        key: 'callback' as const,
        name: 'Scheduled callback',
        value: outcomes.scheduledCallbacks,
        color: OUTCOME_META.callback.color,
        pct: Math.round((outcomes.scheduledCallbacks / total) * 100),
      },
    ];
  }, [selectedRep, activeReceptionists, analytics]);

  // Volume by day
  const barData = useMemo(() => {
    const dailyBreakdown = pickArray(analytics, [
      'daily_breakdown',
      'daily_inbound_call_distribution',
    ]);
    if (dailyBreakdown.length) {
      const dayMap = new Map<string, number>();
      dailyBreakdown.forEach((item: any) => {
        if (item.date) {
          const formatted = moment(item.date).format('YYYY-MM-DD');
          dayMap.set(
            formatted,
            pickNumber(item, ['calls_handled', 'session_calls', 'total_calls', 'calls'], 0) || 0,
          );
        }
      });

      const list = [];
      const curr = moment(startDate);
      const end = moment(endDate);
      let limit = 0;
      while (curr.isSameOrBefore(end, 'day') && limit < 100) {
        const dateStr = curr.format('YYYY-MM-DD');
        list.push({
          name: curr.format('MMM D'),
          calls: dayMap.get(dateStr) ?? 0,
          dateStr,
        });
        curr.add(1, 'day');
        limit++;
      }
      return list;
    }

    // No data yet — return empty placeholder range
    const list = [];
    const curr = moment(startDate);
    const end = moment(endDate);
    let limit = 0;
    while (curr.isSameOrBefore(end, 'day') && limit < 100) {
      list.push({ name: curr.format('MMM D'), calls: 0, dateStr: curr.format('YYYY-MM-DD') });
      curr.add(1, 'day');
      limit++;
    }
    return list;
  }, [analytics, startDate, endDate]);

  // Each day's calls split by how they ended. Days the payload breaks down
  // itself are used as-is; otherwise the day's total is split by the range's
  // own outcome mix, so the columns always add up to the volume shown.
  const outcomeRows = useMemo(() => {
    const dailyBreakdown = pickArray(analytics, [
      'daily_breakdown',
      'daily_inbound_call_distribution',
    ]);
    const dayMap = new Map<string, any>();
    dailyBreakdown.forEach((item: any) => {
      if (item.date) dayMap.set(moment(item.date).format('YYYY-MM-DD'), item);
    });
    const mixTotal = pieData.reduce((sum, item) => sum + Number(item.value || 0), 0) || 1;
    const share = (key: string) =>
      Number(pieData.find((item) => item.key === key)?.value || 0) / mixTotal;
    return barData.map((day) => {
      const item = dayMap.get(day.dateStr);
      const total = Number(day.calls || 0);
      let resolved = pickNumber(item, ['resolved', 'resolved_calls'], null);
      let handoffs = pickNumber(item, ['live_transfer', 'live_transfers', 'transfers', 'handoffs'], null);
      let callbacks = pickNumber(item, ['scheduled_callback', 'scheduled_callbacks'], null);
      if (resolved === null || handoffs === null || callbacks === null) {
        handoffs = Math.round(total * share('transfer'));
        callbacks = Math.round(total * share('callback'));
        resolved = Math.max(0, total - handoffs - callbacks);
      }
      return {
        name: day.name,
        total,
        resolved,
        handoffs,
        scheduled_callbacks: callbacks,
        rateLabel: total ? `${Math.round((resolved / total) * 100)}%` : '',
      };
    });
  }, [analytics, barData, pieData]);
  const outcomeTotals = useMemo(
    () => ({
      total: outcomeRows.reduce((sum, day) => sum + day.total, 0),
      resolved: outcomeRows.reduce((sum, day) => sum + day.resolved, 0),
      handoffs: outcomeRows.reduce((sum, day) => sum + day.handoffs, 0),
      scheduled_callbacks: outcomeRows.reduce((sum, day) => sum + day.scheduled_callbacks, 0),
    }),
    [outcomeRows],
  );

  const sentimentChartData = useMemo(() => {
    const trendMap = new Map<string, any>();
    const sentimentTrend = pickArray(analytics, ['sentiment_trend']);
    if (sentimentTrend.length) {
      sentimentTrend.forEach((item: any) => {
        if (item.date) trendMap.set(moment(item.date).format('YYYY-MM-DD'), item);
      });
    }

    const list = [];
    const curr = moment(startDate);
    const end = moment(endDate);
    let limit = 0;
    while (curr.isSameOrBefore(end, 'day') && limit < 100) {
      const dateStr = curr.format('YYYY-MM-DD');
      const item = trendMap.get(dateStr);
      // The payload names the daily figure differently depending on the
      // endpoint; reading only `score` left every day at zero and the chart
      // flat whatever the API returned.
      list.push({
        name: curr.format('MMM D'),
        score: pickNumber(item, ['score', 'avg_sentiment', 'sentiment_score', 'sentiment'], 0) || 0,
        count: pickNumber(item, ['count', 'calls_handled', 'calls'], 0) || 0,
        positive: pickNumber(item, ['positive', 'positive_pct', 'positive_percentage'], 0) || 0,
        neutral: pickNumber(item, ['neutral', 'neutral_pct', 'neutral_percentage'], 0) || 0,
        negative: pickNumber(item, ['negative', 'negative_pct', 'negative_percentage'], 0) || 0,
      });
      curr.add(1, 'day');
      limit++;
    }
    return list;
  }, [analytics, startDate, endDate]);

  // The mix shown beside the chart, and the move against the previous range
  // shown under it.
  const sentimentSummary = useMemo(() => {
    const days = sentimentChartData.filter(
      (day) => day.positive || day.neutral || day.negative,
    );
    const share = (key: 'positive' | 'neutral' | 'negative') =>
      days.length
        ? Math.round(days.reduce((sum, day) => sum + Number(day[key] || 0), 0) / days.length)
        : 0;
    const scored = sentimentChartData.filter((day) => day.score > 0);
    const currentScore = scored.length
      ? Math.round(scored.reduce((sum, day) => sum + day.score, 0) / scored.length)
      : 0;
    const previousScore = pickNumber(
      analytics,
      ['previous_sentiment_score', 'previous_avg_sentiment', 'prior_sentiment_score'],
      null,
    );
    return {
      hasData: days.length > 0,
      positive: share('positive'),
      neutral: share('neutral'),
      negative: share('negative'),
      currentScore,
      move:
        previousScore === null || !currentScore
          ? null
          : Math.round(currentScore - Number(previousScore)),
    };
  }, [sentimentChartData, analytics]);

  const conversationTopics = useMemo(() => {
    return pickArray(analytics, ['conversation_topics', 'top_user_intents', 'top_topics', 'topics'])
      .map((topic: any) => ({
        name: topic.name || topic.intent || topic.topic || topic.label || 'Unknown',
        percentage: pickNumber(topic, ['percentage', 'percent', 'pct'], 0) || 0,
        // the one-line gloss under the name, when the payload carries one
        description: String(topic.description || topic.summary || topic.examples || '').trim(),
      }))
      .filter((topic: any) => topic.name);
  }, [analytics]);

  // Format hour values to AM/PM labels
  const formatHourLabel = (hour: number) => {
    if (hour === 0) return '12 AM';
    if (hour === 12) return '12 PM';
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour > 12 ? hour - 12 : hour;
    return `${displayHour} ${ampm}`;
  };

  // Peak call hours by hour of day — reads from daily_breakdown hourly_breakdown
  const peakCallHours = useMemo(() => {
    const dailyBreakdown = pickArray(analytics, [
      'daily_breakdown',
      'daily_inbound_call_distribution',
    ]);
    const hourlyBreakdown = pickArray(analytics, [
      'hour_of_day_breakdown',
      'hour_of_day_distribution',
    ]);
    // Aggregate hourly data from daily_breakdown if available
    if (dailyBreakdown.length || hourlyBreakdown.length) {
      const hourMap = new Map<number, number>();
      dailyBreakdown.forEach((day: any) => {
        if (Array.isArray(day.hourly_breakdown)) {
          day.hourly_breakdown.forEach((h: any) => {
            const current = hourMap.get(h.hour) ?? 0;
            hourMap.set(h.hour, current + (pickNumber(h, ['calls_handled', 'calls'], 0) || 0));
          });
        }
      });

      // Also support top-level hour_of_day_breakdown
      if (hourlyBreakdown.length) {
        hourlyBreakdown.forEach((h: any) => {
          const current = hourMap.get(h.hour) ?? 0;
          hourMap.set(h.hour, current + (pickNumber(h, ['calls_handled', 'calls'], 0) || 0));
        });
      }

      const hoursData = [];
      for (let h = 0; h < 24; h++) {
        hoursData.push({
          name: formatHourLabel(h),
          calls: hourMap.get(h) ?? 0,
          hour: h,
        });
      }
      return hoursData.filter((h) => h.calls > 0 || (h.hour >= 8 && h.hour <= 20));
    }

    // No data yet — return 0 for standard business hours
    const emptyHours = [];
    for (let h = 8; h <= 20; h++) {
      emptyHours.push({ name: formatHourLabel(h), calls: 0, hour: h });
    }
    return emptyHours;
  }, [analytics]);

  const maxCalls = useMemo(() => {
    if (!peakCallHours || peakCallHours.length === 0) return 1;
    return Math.max(...peakCallHours.map((h) => h.calls));
  }, [peakCallHours]);

  // The heat strip needs every hour, including the quiet ones the chart data
  // drops, so the day reads as one continuous 24-cell row.
  const hourStrip = useMemo(() => {
    const byHour = new Map(peakCallHours.map((h) => [h.hour, Number(h.calls) || 0]));
    return Array.from({ length: 24 }, (_, hour) => ({
      hour,
      name: formatHourLabel(hour),
      calls: byHour.get(hour) ?? 0,
    }));
  }, [peakCallHours]);
  const peakHour = hourStrip.reduce((top, slot) => (slot.calls > top.calls ? slot : top), hourStrip[0]);
  const totalStripCalls = hourStrip.reduce((sum, slot) => sum + slot.calls, 0);

  const trendIsResolution = activeReceptionists.some((rep) => rep.resolutionTrend.length > 0);
  const periodLabel = `${moment(startDate).format('MMM D')} - ${moment(endDate).format('MMM D, YYYY')}`;
  const rangeDays = Math.max(1, moment(endDate).diff(moment(startDate), 'days') + 1);
  const periodCompare =
    dateRange === 'today'
      ? 'compared to yesterday'
      : dateRange === 'yesterday'
        ? 'compared to previous day'
        : `compared to previous ${rangeDays} days`;
  // The figure beside each value is the one comparison that makes it readable
  // at a glance: the daily average, the target, the denominator. The
  // resolution figure itself takes the colour of how it sits against target.
  const transferShare = Number(metrics.totalCalls)
    ? Math.round((Number(metrics.transfers) / Number(metrics.totalCalls)) * 100)
    : 0;
  const dailyCallSeries = barData.map((day: any) => Number(day.calls) || 0);
  const avgCallsPerDay = dailyCallSeries.length
    ? Math.round(dailyCallSeries.reduce((sum, n) => sum + n, 0) / dailyCallSeries.length)
    : 0;
  const resolutionPct = toNumber(metrics.resolution) ?? 0;
  const resolutionValueClass =
    resolutionPct >= 70
      ? 'text-emerald-700'
      : resolutionPct >= 50
        ? 'text-amber-600'
        : 'text-red-600';

  const kpiCards = [
    {
      label: 'Total calls',
      value: metrics.totalCalls,
      description: 'Inbound calls, this range',
      helper: (
        <>
          <span className="text-[12px] font-bold tabular-nums text-neutral-900">
            {avgCallsPerDay}
          </span>
          <span className="text-[10px] text-red-600">per day</span>
        </>
      ),
    },
    {
      label: 'Resolution rate',
      value: metrics.resolution,
      valueClass: resolutionValueClass,
      description: 'Resolved without a transfer',
      helper: <span className="text-[11px] text-red-600">target 70%+</span>,
    },
    {
      label: 'Avg call duration',
      value: metrics.avgDuration,
      description: 'Per handled call',
    },
    {
      label: 'Live transfers',
      value: metrics.transfers,
      valueClass: 'text-[#20201f]',
      pulse: true,
      description: 'Handed off to a human',
      // The tint only comes on when the share actually handed off is off
      // target.
      alert: transferShare > 15,
      helper: (
        <span className="text-[11px] whitespace-nowrap text-red-600">
          of {metrics.totalCalls} calls
        </span>
      ),
    },
    {
      label: 'CSAT (post-call)',
      description: 'Caller satisfaction',
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
  const talkPercent = Number(talkListenRatio[0]?.value || 0);
  const talkItems = [
    { name: 'AI talking', value: talkPercent, color: THEME_PRIMARY, pct: talkPercent },
    {
      name: 'Caller talking / silence',
      value: Math.max(0, 100 - talkPercent),
      color: '#cbd5e1',
      pct: Math.max(0, 100 - talkPercent),
    },
  ];
  const exportAnalyticsCsv = () => {
    const rowsToExport = selectedRep ? [selectedRep] : activeReceptionists;
    const rows: Array<Array<string | number>> = [
      ['Metric', 'Value'],
      ['Date range', `${startDate} to ${endDate}`],
      ['Total calls', metrics.totalCalls],
      ['Resolution rate', metrics.resolution],
      ['Average call duration', metrics.avgDuration],
      ['Live transfers', metrics.transfers],
      ['Scheduled callbacks', metrics.scheduledCallbacks],
      ['CSAT', metrics.csat],
      [],
      [
        'Receptionist',
        'Calls',
        'Resolution',
        'Confidence',
        'CSAT',
        'Live transfers',
        'Scheduled callbacks',
      ],
      ...rowsToExport.map((receptionist) => [
        receptionist.name,
        receptionist.calls,
        `${receptionist.resolution}%`,
        receptionist.confidenceLabel,
        receptionist.csatLabel,
        receptionist.outcomes.transfer,
        receptionist.outcomes.scheduledCallbacks,
      ]),
    ];
    const csv = rows
      .map((row) => row.map((cell) => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `receptionist-analytics-${startDate}-to-${endDate}.csv`;
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
        `receptionist-analytics-${startDate}-to-${endDate}.pdf`,
      );
    } catch (error) {
      console.error('Failed to export receptionist analytics PDF:', error);
      handleAlert({ text: 'Unable to generate the PDF report. Please try again.', type: 'error' });
    } finally {
      setIsExportingPdf(false);
    }
  };

  if (ANALYTICS_COMING_SOON) {
    // Existing analytics implementation is preserved below; temporarily show a simple placeholder.
    return (
      <div className="relative flex h-full min-h-0 w-full flex-col overflow-hidden bg-[#efefef] text-neutral-900">
        <div className="flex min-h-[64px] shrink-0 items-center justify-between border-b border-neutral-200 bg-white px-4 py-3 sm:px-6">
          <div className="flex items-center gap-2 text-sm font-medium text-neutral-500">
            <button
              type="button"
              onClick={() => navigate('/admin-settings/knowledge/ai-agent')}
              className="transition-colors hover:text-red-600"
            >
              AI Agents
            </button>
            <span>/</span>
            <button
              type="button"
              onClick={onClose}
              className="transition-colors hover:text-red-600"
            >
              AI Receptionists
            </button>
            <span>/</span>
            <span className="font-semibold text-neutral-950">Analytics</span>
          </div>
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={onClose}
            className="-ml-1.5"
            aria-label="Back"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex flex-1 items-center justify-center p-6">
          <p className="text-base font-semibold text-neutral-600">Coming soon</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex h-full min-h-0 w-full flex-col overflow-hidden bg-[#efefef] text-neutral-900">
      {/* The same header the other AI Tools screens use: eyebrow, serif title,
          and pill actions on the right. */}
      <div className="flex min-h-[74px] shrink-0 flex-col gap-3 border-b border-neutral-200 bg-white pl-3 pr-7 py-2 lg:flex-row lg:items-center lg:justify-between">
        {/* Back sits ahead of the title, so leaving the screen reads as a step
            out of it rather than another action in the toolbar. */}
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
              AI Receptionists
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
                ? 'All receptionists'
                : activeReceptionists.find((r) => r.id === selectedRepId)?.name || 'Receptionist'
            }
            options={[
              { label: 'All receptionists', value: 'all' },
              ...activeReceptionists.map((r) => ({ label: r.name, value: r.id })),
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
        className="w-full flex-1 space-y-4 overflow-y-auto px-7 pt-4 pb-6"
      >
        <div className="flex items-center gap-2 rounded-lg border border-red-600/20 bg-red-600/5 px-3 py-1.5 text-xs font-medium text-neutral-600">
          <Info className="h-4 w-4 shrink-0" />
          <span>
            <strong>{periodLabel}</strong> · {periodCompare}. Voice-specific KPIs below — sentiment,
            talk-to-listen ratio, call outcomes, peak hours.
          </span>
        </div>

        <div>
          <SectionEyebrow label="Overview" />
          <div className="relative grid grid-cols-1 rounded-[14px] border border-neutral-200 bg-white shadow-[0_1px_2px_rgba(0,0,0,.04)] sm:grid-cols-2 lg:grid-cols-5">
            {isLoading && (
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
                    'border-b border-neutral-100 sm:border-b-0 sm:border-r',
                )}
                style={
                  card.alert
                    ? {
                        background: 'color-mix(in oklab, #dc2626 5%, #ffffff)',
                        boxShadow: 'inset 0 0 0 1px color-mix(in oklab, #dc2626 32%, transparent)',
                        borderRadius: '10px',
                      }
                    : undefined
                }
              >
                <span className="flex items-center justify-between gap-2">
                  <span className="text-[11.5px] font-bold uppercase tracking-[0.06em] whitespace-nowrap text-neutral-700">
                    {card.label}
                  </span>
                  {card.pulse && (
                    // a live marker - transfers are the one figure that is a
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

        {(() => {
          const sortedReceptionists = [...activeReceptionists].sort((a, b) => {
            if (breakdownSort === 'csat-desc') return (Number(b.csat) || 0) - (Number(a.csat) || 0);
            if (breakdownSort === 'csat-asc') return (Number(a.csat) || 0) - (Number(b.csat) || 0);
            return Number(b.calls || 0) - Number(a.calls || 0);
          });
          const BREAKDOWN_PAGE_SIZE = 5;
          const breakdownPageCount = Math.max(
            1,
            Math.ceil(sortedReceptionists.length / BREAKDOWN_PAGE_SIZE),
          );
          const currentBreakdownPage = Math.min(breakdownPage, breakdownPageCount - 1);
          const pagedReceptionists = sortedReceptionists.slice(
            currentBreakdownPage * BREAKDOWN_PAGE_SIZE,
            currentBreakdownPage * BREAKDOWN_PAGE_SIZE + BREAKDOWN_PAGE_SIZE,
          );
          return selectedRepId === 'all' ? (
          <div>
            <SectionEyebrow label="Receptionists" />
            <AnalyticsPanel
              title="Per-receptionist breakdown"
              subtitle="Every receptionist side by side for this range — pick one to drill in."
              isLoading={isLoading}
            >
              {/* A ranked table rather than a list of cards: the labels move to one
                  header row, and resolution gets a bar so the ranking is readable
                  without comparing numbers one by one. */}
              <div className="mt-4 hidden grid-cols-[minmax(0,1fr)_120px_120px_120px_120px_120px_20px] items-center gap-4 rounded-t-md border-b border-neutral-200 bg-[#fafafa] px-2 py-2 text-[10px] font-bold uppercase tracking-[0.06em] text-neutral-400 md:grid">
                <span>Receptionist</span>
                <span>Calls</span>
                <span>Resolution</span>
                {/* CSAT is the column people rank on, so it carries the sort
                    control rather than a bare label. */}
                <button
                  type="button"
                  onClick={() =>
                    setBreakdownSort((current) =>
                      current === 'csat-desc'
                        ? 'csat-asc'
                        : current === 'csat-asc'
                          ? 'calls'
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
                <span>Trend {trendIsResolution ? '(resolution)' : '(volume)'}</span>
                <span />
              </div>
              <div className="divide-y divide-neutral-100">
                {pagedReceptionists.map((rep) => {
                    const maxCallsInList = Math.max(
                      1,
                      ...activeReceptionists.map((item: any) => Number(item.calls || 0)),
                    );
                    const resolutionTone =
                      rep.resolution >= 80
                        ? 'text-emerald-600'
                        : rep.resolution >= 50
                          ? 'text-amber-600'
                          : 'text-red-600';
                    const trendSeries = rep.resolutionTrend.length
                      ? rep.resolutionTrend
                      : rep.sparklineData;
                    const trendMove =
                      trendSeries.length > 1 ? trendSeries[trendSeries.length - 1] - trendSeries[0] : 0;
                    // A point either way is noise at this resolution, so the
                    // middle band reads as "flat" rather than a direction.
                    const trendState = trendMove > 1 ? 'up' : trendMove < -1 ? 'down' : 'flat';
                    const csatMove =
                      rep.csat === null || rep.csatPrevious === null
                        ? null
                        : Number((Number(rep.csat) - Number(rep.csatPrevious)).toFixed(1));

                    return (
                      <div
                        key={rep.id}
                        onClick={() => setSelectedRepId(rep.id)}
                        className="grid cursor-pointer grid-cols-[minmax(0,1fr)_20px] items-center gap-4 rounded-lg px-2 py-2 transition-colors hover:bg-neutral-50 md:grid-cols-[minmax(0,1fr)_120px_120px_120px_120px_120px_20px]"
                      >
                        <div className="flex min-w-0 items-center gap-3">
                          <div className="shrink-0">
                            <CustomAvatar
                              name={rep.name}
                              size="36"
                              showPresence={false}
                              isActivityInfo={false}
                              textClass="text-xs"
                            />
                          </div>
                          <div className="min-w-0">
                            <h4 className="truncate text-[13px] font-normal text-neutral-950">{rep.name}</h4>
                            <p className="truncate text-xs text-neutral-500">{rep.subtitle}</p>
                          </div>
                        </div>

                        <div className="hidden text-sm font-bold tabular-nums text-neutral-800 md:block">
                          {rep.calls}
                        </div>

                        <div className="hidden md:block">
                          <span className={`text-sm font-bold tabular-nums ${resolutionTone}`}>
                            {rep.resolution}%
                          </span>
                          <div className="mt-1 text-[10px] text-neutral-400">
                            {Math.round((Number(rep.calls || 0) / maxCallsInList) * 100)}% of busiest
                          </div>
                        </div>

                        <div className="hidden md:block">
                          <div
                            className={cx(
                              'text-sm tabular-nums',
                              // a placeholder should not carry the weight of a score
                              rep.csat === null
                                ? 'font-normal text-neutral-400'
                                : 'font-bold text-neutral-900',
                            )}
                          >
                            {rep.csatLabel}
                          </div>
                          {csatMove === null ? null : (
                            <>
                              <div
                                className={cx(
                                  'mt-0.5 flex items-center gap-1 text-xs font-bold tabular-nums',
                                  csatMove >= 0 ? 'text-emerald-600' : 'text-red-600',
                                )}
                              >
                                {csatMove >= 0 ? (
                                  <ArrowUp className="h-3 w-3 shrink-0" />
                                ) : (
                                  <ArrowDown className="h-3 w-3 shrink-0" />
                                )}
                                {Math.abs(csatMove).toFixed(1)}
                              </div>
                              <div className="text-[10px] text-neutral-400">vs previous</div>
                            </>
                          )}
                        </div>

                        <div className="hidden md:block">
                          <SentimentPill score={rep.sentiment} />
                        </div>

                        <div className="hidden w-full md:block">
                          {trendSeries.some((value: number) => value > 0) ? (
                            <TrendArea data={trendSeries} color={TREND_STATE[trendState].color} />
                          ) : (
                            <span className="text-[11px] text-neutral-400">No trend data</span>
                          )}
                        </div>

                        <ChevronRight className="h-4 w-4 shrink-0 text-neutral-400" />
                      </div>
                    );
                  })}
              </div>

              {/* Direction is carried by colour, so the key names each state —
                  identity is never colour alone. */}
              <div className="mt-3 grid grid-cols-3 items-center gap-3 border-t border-neutral-100 pt-3">
                <span className="text-[11px] font-medium text-neutral-500">
                  {`${currentBreakdownPage * BREAKDOWN_PAGE_SIZE + 1}-${Math.min((currentBreakdownPage + 1) * BREAKDOWN_PAGE_SIZE, sortedReceptionists.length)} of ${sortedReceptionists.length}`}
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
          ) : null;
        })()}

        <div>
          <SectionEyebrow label="Call activity" />
          <div className="grid grid-cols-1 gap-3.5">
            <AnalyticsPanel
              title="Daily outcomes"
              subtitle={`How each day's calls ended · ${periodLabel}`}
              tip="Each column is one day's calls: resolved on the call, transferred to a person, or booked as a callback. The number on top is that day's resolution rate."
              isLoading={isLoading}
              className="flex flex-col"
              action={
                <div className="text-right">
                  <div className={cx('text-[26px] font-bold leading-7', resolutionValueClass)}>
                    {metrics.resolution}
                  </div>
                  <div className="text-[10px] font-semibold text-neutral-400">resolved this range</div>
                </div>
              }
            >
              {/* Every column is one day: its height is the volume, its red
                  share is what the receptionist closed itself, and the number on top
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
          </div>
        </div>

        <div>
          <SectionEyebrow label="Sentiment" />
          <div className="grid grid-cols-1 gap-3.5 lg:grid-cols-2">
            <AnalyticsPanel
              title="Sentiment trend"
              subtitle="Caller sentiment score (0-100) at end of call."
              tip="Caller sentiment score calculated from call transcript analysis. 70+ is healthy."
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
                        contentStyle={{
                          borderRadius: 10,
                          border: '1px solid #e5e5e5',
                          fontSize: 12,
                          boxShadow: '0 4px 14px rgba(17,17,17,.08)',
                        }}
                        formatter={(value: any, name: any) => [`${value}%`, name]}
                      />
                      {SENTIMENT_SERIES.map((series) => (
                        <Line
                          key={series.key}
                          type="monotone"
                          dataKey={series.key}
                          name={series.label}
                          stroke={series.color}
                          strokeWidth={2}
                          dot={{ r: 3.5, fill: series.color, strokeWidth: 0 }}
                          activeDot={{ r: 5, strokeWidth: 2, stroke: '#ffffff' }}
                        />
                      ))}
                    </LineChart>
                  </ResponsiveContainer>
                </div>

                <div className="flex shrink-0 flex-row gap-4 lg:w-[142px] lg:flex-col lg:gap-3">
                  {SENTIMENT_SERIES.map((series) => (
                    <div key={series.key} className="flex min-w-0 flex-1 items-center gap-2">
                      <span
                        className="h-2.5 w-2.5 shrink-0 rounded-full"
                        style={{ background: series.color }}
                      />
                      <span className="min-w-0 flex-1 truncate text-xs font-medium text-neutral-600">
                        {series.label}
                      </span>
                      <span className="text-xs font-bold tabular-nums text-neutral-900">
                        {sentimentSummary[series.key]}%
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {sentimentSummary.move === null ? (
                <div className="mt-4 flex items-center gap-2 rounded-lg bg-neutral-50 px-3 py-2.5 text-[12.5px] font-medium text-neutral-500">
                  <Info className="h-4 w-4 shrink-0" />
                  No previous period to compare this range against yet.
                </div>
              ) : (
                <div
                  className={cx(
                    'mt-4 flex items-center gap-2 rounded-lg px-3 py-2.5 text-[12.5px] font-medium',
                    sentimentSummary.move > 0
                      ? 'bg-emerald-50 text-emerald-700'
                      : sentimentSummary.move < 0
                        ? 'bg-red-50 text-red-700'
                        : 'bg-neutral-50 text-neutral-600',
                  )}
                >
                  {sentimentSummary.move > 0 ? (
                    <ArrowUp className="h-4 w-4 shrink-0" />
                  ) : sentimentSummary.move < 0 ? (
                    <ArrowDown className="h-4 w-4 shrink-0" />
                  ) : (
                    <Minus className="h-4 w-4 shrink-0" />
                  )}
                  {sentimentSummary.move === 0
                    ? `Sentiment held steady compared to the previous ${rangeDays} days.`
                    : `Sentiment ${
                        sentimentSummary.move > 0 ? 'improved' : 'declined'
                      } by ${Math.abs(sentimentSummary.move)}% compared to previous ${rangeDays} days.`}
                </div>
              )}
            </AnalyticsPanel>

            <AnalyticsPanel
              title="Talk-to-listen ratio"
              subtitle="Voice-AI best practice: 35-55% AI talk time. Higher = caller cannot get a word in."
              tip="Fraction of the call where the AI is speaking vs the caller speaking or silent."
              isLoading={isLoading}
            >
              {/* A share measured against a recommended band reads better as a
                  gauge than a donut: the band is the point, not the two halves. */}
              <div className="mt-5">
                <div className="flex items-baseline gap-2">
                  <span className="text-[30px] font-black leading-8 text-neutral-950">
                    {talkPercent}%
                  </span>
                  <span className="text-[11px] font-bold uppercase tracking-[0.04em] text-neutral-400">
                    AI talk time
                  </span>
                </div>

                <div className="relative mt-4 h-3 w-full rounded-full bg-neutral-100">
                  <span
                    aria-hidden="true"
                    className="absolute inset-y-0 rounded-full bg-neutral-200"
                    style={{ left: '35%', width: '20%' }}
                  />
                  <span
                    aria-hidden="true"
                    className="absolute inset-y-0 left-0 rounded-full bg-red-600 transition-all duration-300"
                    style={{ width: `${Math.min(100, Math.max(0, talkPercent))}%` }}
                  />
                  {talkPercent > 0 && (
                    <span
                      aria-hidden="true"
                      className="absolute -top-1 h-5 w-[3px] -translate-x-1/2 rounded-full bg-neutral-900"
                      style={{ left: `${Math.min(100, Math.max(0, talkPercent))}%` }}
                    />
                  )}
                </div>

                <div className="relative mt-1.5 h-4 text-[10px] font-semibold text-neutral-400">
                  <span className="absolute left-0">0%</span>
                  <span className="absolute -translate-x-1/2" style={{ left: '35%' }}>
                    35
                  </span>
                  <span className="absolute -translate-x-1/2" style={{ left: '55%' }}>
                    55
                  </span>
                  <span className="absolute right-0">100%</span>
                </div>

                <p className="mt-3 text-[11px] leading-5 text-neutral-500">
                  <span className="font-semibold text-neutral-700">Target band 35-55%.</span>{' '}
                  {!talkPercent
                    ? 'No voice talk-time data captured yet.'
                    : talkPercent < 35
                      ? 'Below the band - the AI is barely speaking, callers may be carrying the call.'
                      : talkPercent > 55
                        ? 'Above the band - the AI is talking over callers.'
                        : 'Inside the band - callers are getting room to speak.'}
                </p>

                <div className="mt-4 space-y-2 border-t border-neutral-100 pt-3">
                  {talkItems.map((item) => (
                    <div key={item.name} className="flex items-center gap-2 text-xs">
                      <span className="h-2.5 w-2.5 rounded-sm" style={{ background: item.color }} />
                      <span className="min-w-0 flex-1 truncate font-medium text-neutral-600">
                        {item.name}
                      </span>
                      <span className="font-bold text-neutral-800">{item.pct}%</span>
                    </div>
                  ))}
                </div>
              </div>
            </AnalyticsPanel>
          </div>
        </div>

        <div className="space-y-4">
          <SectionEyebrow label="Topics & timing" />
          <div className="grid grid-cols-1 gap-3.5 lg:grid-cols-2">
            <AnalyticsPanel
              title="Top conversation topics"
              subtitle="What callers ask about most"
              tip="Most frequent topics callers raise, derived from intent classification."
              isLoading={isLoading}
              className="flex flex-col"
            >
              <div className="mt-4 grid flex-1 grid-cols-1 content-evenly gap-x-4 gap-y-2 sm:grid-cols-2">
                {conversationTopics.length ? (
                  conversationTopics.map((topic, idx) => (
                    <TopicTile
                      key={`${topic.name}-${idx}`}
                      name={topic.name}
                      value={topic.percentage}
                      description={topic.description}
                    />
                  ))
                ) : (
                  <div className="col-span-full rounded-lg border border-dashed border-neutral-200 bg-neutral-50 px-4 py-7 text-center text-xs font-semibold text-neutral-500">
                    No topic data yet
                  </div>
                )}
              </div>
            </AnalyticsPanel>

            <AnalyticsPanel
              title="Peak call hours - last 7 days"
              subtitle="Calls by hour of day. Darker cells = busier hours."
              tip="Hour-of-day distribution. Use to schedule live agents for overflow during peak hours."
              isLoading={isLoading}
            >
              {/* One cell per hour on a single red ramp - light for the quiet
                  hours, solid for the peak - so the whole day reads as one row
                  and the busiest stretch shows as a block rather than a spike. */}
              <div className="mt-5">
                <div className="flex items-end gap-1">
                  {hourStrip.map((slot) => {
                    const share = maxCalls > 0 ? slot.calls / maxCalls : 0;
                    const isPeak = slot.calls > 0 && slot.hour === peakHour.hour;
                    return (
                      <CustomTooltip
                        key={slot.hour}
                        side="top"
                        text={`${slot.name} · ${slot.calls} ${slot.calls === 1 ? 'call' : 'calls'}`}
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
                              slot.hour % 3 === 0 ? 'text-neutral-400' : 'text-transparent',
                            )}
                          >
                            {slot.hour % 3 === 0 ? slot.name : '·'}
                          </span>
                        </div>
                      </CustomTooltip>
                    );
                  })}
                </div>

                <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-neutral-100 pt-3">
                  <p className="text-xs text-neutral-500">
                    {peakHour.calls > 0 ? (
                      <>
                        Busiest at{' '}
                        <span className="font-bold text-neutral-900">{peakHour.name}</span> with{' '}
                        <span className="font-bold text-neutral-900">{peakHour.calls} calls</span>
                        {totalStripCalls > 0
                          ? ` - ${Math.round((peakHour.calls / totalStripCalls) * 100)}% of the day's volume.`
                          : '.'}
                      </>
                    ) : (
                      'No calls recorded in this range yet.'
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
          <SectionEyebrow label="Follow-up" />
          <div className="grid grid-cols-1 gap-3.5">
            <AnalyticsPanel
              title="Unanswered caller questions"
              subtitle="Pick a receptionist to see their unanswered questions, then answer each one."
              tip="Questions callers asked but the receptionist could not answer with confidence."
              isLoading={isLoading}
            >
              <div className="mt-4 space-y-2.5">
                {activeReceptionists.slice(0, 4).map((rep) => (
                  <div
                    key={rep.id}
                    className="flex cursor-pointer items-center justify-between gap-3 rounded-lg border border-neutral-100 p-3 transition-colors hover:bg-neutral-50"
                  >
                    <div className="flex items-center gap-3">
                      <div className="shrink-0">
                        <CustomAvatar
                          name={rep.name}
                          size="32"
                          showPresence={false}
                          isActivityInfo={false}
                          textClass="text-[11px]"
                        />
                      </div>
                      <div>
                        <h4 className="text-[13px] font-normal text-neutral-900">{rep.name}</h4>
                        <p className="text-[10px] text-neutral-500">{rep.subtitle}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {rep.unansweredQuestions > 0 ? (
                        <span className="inline-flex items-center rounded-full bg-red-50 border border-red-200 px-2.5 py-0.5 text-[10px] font-bold text-red-600">
                          {rep.unansweredQuestions} questions
                        </span>
                      ) : (
                        <span className="inline-flex items-center rounded-full bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 text-[10px] font-bold text-emerald-600">
                          All clear ✓
                        </span>
                      )}
                      <ChevronRight className="h-4 w-4 text-neutral-400" />
                    </div>
                  </div>
                ))}
              </div>
            </AnalyticsPanel>
          </div>
        </div>
      </div>
    </div>
  );
}
