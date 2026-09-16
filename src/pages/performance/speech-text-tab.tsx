import { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useQueries } from '@tanstack/react-query';
import moment, { type Moment } from 'moment';
import { FileText, MessageSquare, Mic, RefreshCw, Search, Sparkles } from 'lucide-react';
import SideDrawer from '@/components/custom/side-drawer';
import { SocketEvents } from '@/context/socket-events-context';
import { useCallStats } from '@/hooks/use-call-stats';
import { useCompanyFeatures } from '@/hooks/rbac';
import { useRecordingAccess } from '@/hooks/use-recording-access';
import { useUser } from '@/hooks/use-user';
import { fetchAuthenticatedMedia } from '@/hooks/use-authenticated-media';
import { formatPhoneNumber, getInitials, MEDIA_URL } from '@/lib/utils';
import TranscriptInfo from '@/pages/phone/transcript-info';
import { formatSecsToClock, timeStringToSeconds } from './format';
import { PerfNotice } from './perf-surface';
import { DUMMY_AI_AGENTS, DUMMY_AI_RESULT } from './dummy-tab-data';
import './speech.css';

/* ---------------------------------------------------------------------------
   Performance ▸ Speech & Text — what customers talk about, how they sound,
   and what was said.

   Two sources, kept apart and labelled for what they cover. The AI figures
   are today's, pushed over the socket by the same feed as the AI Wallboard.
   The transcribed calls follow the range picked at the top, and each card
   reads that call's own transcript. The sentiment service's score scale isn't
   published, so mood is read from its positive / neutral / negative split
   rather than from what a score of, say, 24 is supposed to mean.
   --------------------------------------------------------------------------- */

type Mood = 'positive' | 'neutral' | 'negative' | 'unknown';
type MoodFilter = 'all' | 'positive' | 'neutral' | 'negative';

type MoodBucket = {
  key: string;
  label: string;
  tone: string;
  polarity: -1 | 0 | 1;
  order: number;
  count: number;
  percent: number;
};

type TranscriptInsight = { summary: string; keywords: string[]; mood: Mood };

type TranscribedCall = {
  key: string;
  raw: any;
  started: Moment | null;
  seconds: number;
  from: string;
  to: string;
  direction: string;
  transcriptUrl: string;
  recordingUrl: string;
};

/** Where each label the sentiment service uses sits on the scale, unhappiest first. */
const BUCKET_SCALE: Record<string, { tone: string; polarity: -1 | 0 | 1; order: number }> = {
  critical: { tone: 'critical', polarity: -1, order: 0 },
  negative: { tone: 'negative', polarity: -1, order: 1 },
  poor: { tone: 'poor', polarity: -1, order: 1 },
  bad: { tone: 'poor', polarity: -1, order: 1 },
  neutral: { tone: 'neutral', polarity: 0, order: 2 },
  good: { tone: 'good', polarity: 1, order: 3 },
  positive: { tone: 'positive', polarity: 1, order: 4 },
  excellent: { tone: 'excellent', polarity: 1, order: 4 },
};

const MOOD_LABEL: Record<Mood, string> = {
  positive: 'Positive',
  neutral: 'Neutral',
  negative: 'Negative',
  unknown: 'No mood',
};

const MOOD_FILTERS: MoodFilter[] = ['all', 'positive', 'neutral', 'negative'];

/** The figures stay provisional this long before an empty feed counts as empty. */
const AI_GRACE_MS = 3000;
const TOPIC_ROWS = 6;
const TRANSCRIPT_BATCH = 6;
const THEME_LIMIT = 10;
/** A net balance inside ±15 reads as even rather than leaning either way. */
const LEAN_THRESHOLD = 15;

/* ---- helpers ---- */

const numberOr = <T extends number | null>(value: unknown, fallback: T): number | T => {
  if (value === null || value === undefined || value === '') return fallback;
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const fmt = (value: number) => Math.round(value).toLocaleString('en-US');

const pct = (part: number, whole: number) => (whole > 0 ? Math.round((part / whole) * 100) : 0);

const signed = (value: number) => `${value > 0 ? '+' : ''}${Number.isInteger(value) ? value : value.toFixed(1)}`;

const capitalise = (value: string) => (value ? value[0].toUpperCase() + value.slice(1) : value);

/** A number as the rest of the app prints it, or as given when it won't parse. */
const prettyNumber = (value: string) => {
  if (!value) return '';
  try {
    return formatPhoneNumber(value) || value;
  } catch {
    return value;
  }
};

const dayLabel = (date: Moment) => {
  const offset = date.clone().startOf('day').diff(moment().startOf('day'), 'days');
  if (offset === 0) return 'Today';
  if (offset === -1) return 'Yesterday';
  return date.format(date.isSame(moment(), 'year') ? 'ddd D MMM' : 'D MMM YYYY');
};

const toBuckets = (raw: unknown): MoodBucket[] => {
  if (!Array.isArray(raw)) return [];
  const rows = raw.map((bucket: any, index: number) => {
    const name = String(bucket?.label || '').trim() || `Group ${index + 1}`;
    const scale = BUCKET_SCALE[name.toLowerCase()] || { tone: 'unknown', polarity: 0 as const, order: 2 };
    return {
      key: `${name}-${index}`,
      label: capitalise(name.toLowerCase()),
      tone: scale.tone,
      polarity: scale.polarity,
      order: scale.order,
      count: numberOr(bucket?.count, 0),
      percent: numberOr(bucket?.percent, null),
    };
  });
  const totalCount = rows.reduce((sum, row) => sum + row.count, 0);
  return rows
    .map((row) => ({ ...row, percent: row.percent ?? (totalCount ? (row.count / totalCount) * 100 : 0) }))
    .sort((a, b) => a.order - b.order);
};

const moodOf = (label: unknown, scores?: any): Mood => {
  const text = String(label || '').toLowerCase();
  if (text.includes('pos')) return 'positive';
  if (text.includes('neg')) return 'negative';
  if (text.includes('neu')) return 'neutral';
  const ranked = (
    [
      ['positive', numberOr(scores?.positive, 0)],
      ['neutral', numberOr(scores?.neutral, 0)],
      ['negative', numberOr(scores?.negative, 0)],
    ] as [Mood, number][]
  ).sort((a, b) => b[1] - a[1]);
  return ranked[0][1] > 0 ? ranked[0][0] : 'unknown';
};

/** Keywords arrive as a list, a delimited string, or both. */
const splitKeywords = (raw: unknown): string[] => {
  const seen = new Map<string, string>();
  (Array.isArray(raw) ? raw : [raw]).forEach((value) => {
    if (typeof value !== 'string') return;
    value.split(/[,;|]/).forEach((part) => {
      const keyword = part.trim();
      if (keyword && !seen.has(keyword.toLowerCase())) seen.set(keyword.toLowerCase(), keyword);
    });
  });
  return Array.from(seen.values());
};

const fetchInsight = async (url: string): Promise<TranscriptInsight> => {
  const response = await fetchAuthenticatedMedia(url);
  if (!response.ok) throw new Error(`Transcript request failed with ${response.status}`);
  const data = await response.json();
  const summary = typeof data?.summary === 'string' ? data.summary.trim() : '';
  return {
    summary: summary.toLowerCase() === 'no summary available' ? '' : summary,
    keywords: splitKeywords(data?.keywords),
    mood: moodOf(data?.sentiment, data?.sentiment_scores),
  };
};

const toTranscribedCall = (row: any, index: number, companyUuid: string): TranscribedCall => {
  const direction = String(row?.direction || '');
  const isOutbound = direction.toLowerCase() === 'outbound';
  const callerNumber = String(row?.caller_id_number || '').trim();
  const callerName = String(row?.from_display_name || '').trim();
  const destination = String(row?.destination_number || '').trim();
  // Five digits or fewer is an extension, the test the call logs use.
  const from = isOutbound
    ? callerName || (row?.extension ? `Ext ${row.extension}` : prettyNumber(callerNumber))
    : callerNumber.length > 5
      ? prettyNumber(callerNumber)
      : callerName || callerNumber;
  const to = isOutbound
    ? prettyNumber(destination)
    : String(row?.to_display_name || row?.forward_name || '').trim() || destination;

  return {
    key: `${row?.uuid || row?.sipcall_id || row?.transcript_file}-${index}`,
    raw: row,
    started: row?.start_stamp ? moment.utc(row.start_stamp).local() : null,
    seconds: numberOr(row?.billsectotal, null) ?? timeStringToSeconds(row?.billsec) ?? 0,
    from: from || 'Unknown caller',
    to: to || 'Unknown',
    direction: capitalise(direction.toLowerCase()),
    transcriptUrl: companyUuid ? `${MEDIA_URL}/${companyUuid}/recording/${row.transcript_file}` : '',
    recordingUrl:
      companyUuid && row?.recording_file ? `${MEDIA_URL}/${companyUuid}/recording/${row.recording_file}` : '',
  };
};

const toAgentRow = (agent: any, index: number) => {
  const counts = agent?.sentiment_counts || {};
  const name = String(agent?.agent_name || agent?.forward_name || '').trim() || 'Unnamed AI agent';
  const mix = {
    positive: numberOr(counts?.positive_percent, null),
    neutral: numberOr(counts?.neutral_percent, null),
    negative: numberOr(counts?.negative_percent, null),
  };
  const label = String(agent?.sentiment_label || agent?.sentiment || '').trim();
  const hasMix = mix.positive !== null || mix.neutral !== null || mix.negative !== null;
  const mood = label
    ? moodOf(label)
    : hasMix
      ? moodOf('', { positive: mix.positive, neutral: mix.neutral, negative: mix.negative })
      : 'unknown';
  return {
    key: String(agent?.uuid || agent?.agent_uuid || agent?.agent_extension || `${name}-${index}`),
    name,
    extension: String(agent?.agent_extension || '').trim(),
    status: capitalise(String(agent?.agent_status || agent?.ai_agent_status || '').toLowerCase()),
    conversations: numberOr(agent?.today_sentiment_calls ?? agent?.today_calls, 0),
    mix: { positive: mix.positive ?? 0, neutral: mix.neutral ?? 0, negative: mix.negative ?? 0 },
    hasMix,
    mood,
    moodLabel: label ? capitalise(label.toLowerCase()) : MOOD_LABEL[mood],
    score: numberOr(agent?.avg_sentiment, null),
  };
};

type SpeechTextTabProps = {
  selectedRange: { from: string; to: string };
  /** "today", "yesterday" or "in this range" — how the transcript figures describe their range. */
  rangePhrase: string;
};

const SpeechTextTab = ({ selectedRange, rangePhrase }: SpeechTextTabProps) => {
  const {
    aiLiveWallboardData,
    setAiLiveWallboardData,
    campaignAiLiveCallData,
    getAiLiveWallboardData,
    isSocketConnected,
  } = useContext(SocketEvents);
  const { user } = useUser();
  const { features } = useCompanyFeatures();
  const { canPlayRecording } = useRecordingAccess();
  const callStats = useCallStats(selectedRange);
  const companyUuid = String(user?.company_info?.uuid || '');
  const canTranscribe = Boolean(features?.plan_features?.advance_call_management?.access?.TRANSCRIPTION);
  const canListen = Boolean(features?.plan_features?.reports?.action?.call_recording_listen);

  /* ---- today's AI figures: asked for on arrival, pushed over the socket after ---- */

  const [isGraceOver, setIsGraceOver] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const hasAgentDataRef = useRef(false);
  const domain = user?.sip_credentials?.domain;
  const userUuid = user?.user_info?.uuid;
  const canRequestAi = Boolean(domain && companyUuid && userUuid && isSocketConnected);

  const requestAi = useCallback(() => {
    if (!canRequestAi) return false;
    getAiLiveWallboardData({ domain, company_uuid: companyUuid, user_uuid: userUuid }, (res: any) => {
      if (res) setAiLiveWallboardData(res);
      setIsRefreshing(false);
    });
    return true;
  }, [canRequestAi, domain, companyUuid, userUuid, getAiLiveWallboardData, setAiLiveWallboardData]);

  useEffect(() => {
    requestAi();
    // A hard reload can land the first request before the socket has finished starting up.
    const retry = window.setTimeout(() => {
      if (!hasAgentDataRef.current) requestAi();
    }, 1500);
    return () => window.clearTimeout(retry);
  }, [requestAi]);

  useEffect(() => {
    const timer = window.setTimeout(() => setIsGraceOver(true), AI_GRACE_MS);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    hasAgentDataRef.current = Boolean(aiLiveWallboardData);
  }, [aiLiveWallboardData]);

  useEffect(() => {
    if (!isRefreshing) return undefined;
    const timer = window.setTimeout(() => setIsRefreshing(false), 10000);
    return () => window.clearTimeout(timer);
  }, [isRefreshing]);

  const liveResult = campaignAiLiveCallData?.data?.result;
  const hasLiveAi = Boolean(liveResult && typeof liveResult === 'object');
  /* An account the AI has never reported on gets samples, said so and never
     mixed with real figures; a feed that is merely slow to arrive doesn't. */
  const isAiSample = !hasLiveAi && isGraceOver;
  const isAiPending = !hasLiveAi && !isGraceOver;
  const ai: any = hasLiveAi ? liveResult : isAiSample ? DUMMY_AI_RESULT : null;

  const aiCalls = numberOr(ai?.total_ai_calls, 0);
  const aiChats = numberOr(ai?.total_ai_chats, 0);
  const aiTotal = aiCalls + aiChats;
  const containment = numberOr(ai?.ai_containment_percent, null);
  const transferred = numberOr(ai?.transferred_calls, 0);
  const receptionist = ai?.ai_receptionist_performance || {};
  const resolvedByAi = numberOr(receptionist?.handled_ai_only ?? ai?.handled_ai_only, 0);
  const avgAiSeconds = numberOr(receptionist?.avg_duration_sec, null);
  const leadsCaptured = numberOr(receptionist?.lead_captured_counts, 0);
  const transferPercent = numberOr(receptionist?.transfer_to_agent_percent, null);
  const avgScore = numberOr(ai?.avg_sentiment, null);
  const channels = ai?.voice_vs_text_interactions || {};
  const voicePercent = numberOr(channels?.voice_percent, null);
  const textPercent = numberOr(channels?.text_percent, null);

  const buckets = useMemo(() => toBuckets(ai?.sentiment_buckets), [ai]);
  const moodTotal = buckets.reduce((sum, bucket) => sum + bucket.count, 0);
  const hasMood = buckets.some((bucket) => bucket.percent > 0);
  const net = Math.round(buckets.reduce((sum, bucket) => sum + bucket.polarity * bucket.percent, 0));
  const balance =
    net >= LEAN_THRESHOLD ? 'Leaning positive' : net <= -LEAN_THRESHOLD ? 'Leaning negative' : 'Evenly balanced';

  const topics = useMemo(
    () =>
      Object.entries(ai?.intent_count || {})
        .map(([label, count]) => ({
          label: capitalise(label.replace(/[_-]+/g, ' ')),
          count: numberOr(count, 0),
        }))
        .filter((topic) => topic.count > 0)
        .sort((a, b) => b.count - a.count),
    [ai],
  );
  const topicsTotal = topics.reduce((sum, topic) => sum + topic.count, 0);
  const [showAllTopics, setShowAllTopics] = useState(false);

  const lengths = useMemo(
    () =>
      (Array.isArray(ai?.aht_buckets) ? ai.aht_buckets : []).map((bucket: any, index: number) => ({
        key: `${bucket?.label || index}`,
        label: String(bucket?.label || '—'),
        count: numberOr(bucket?.count, 0),
      })),
    [ai],
  );
  const lengthPeak = Math.max(0, ...lengths.map((bucket: { count: number }) => bucket.count));
  const lengthTotal = lengths.reduce((sum: number, bucket: { count: number }) => sum + bucket.count, 0);

  const agentRows = useMemo(() => {
    const source = isAiSample
      ? (DUMMY_AI_AGENTS as unknown as any[])
      : Array.isArray(aiLiveWallboardData?.data?.result?.agents)
        ? aiLiveWallboardData.data.result.agents
        : [];
    return source.map(toAgentRow).sort((a: any, b: any) => b.conversations - a.conversations);
  }, [isAiSample, aiLiveWallboardData]);
  const isAgentsPending = !isAiSample && !aiLiveWallboardData && !isGraceOver;
  const agentSummary = isAiSample ? null : aiLiveWallboardData?.data?.result?.summary;
  const scoredAgents = agentRows.filter((row: any) => row.score !== null);
  const happiest =
    agentSummary?.agent_sentiment_top?.agent_name ||
    (scoredAgents.length > 1 ? [...scoredAgents].sort((a: any, b: any) => b.score - a.score)[0]?.name : '');
  const unhappiest =
    agentSummary?.agent_sentiment_bottom?.agent_name ||
    (scoredAgents.length > 1 ? [...scoredAgents].sort((a: any, b: any) => a.score - b.score)[0]?.name : '');

  const headline = !ai
    ? ''
    : !aiTotal
      ? 'No AI calls or chats yet today.'
      : `${fmt(aiCalls)} ${aiCalls === 1 ? 'call' : 'calls'} and ${fmt(aiChats)} ${aiChats === 1 ? 'chat' : 'chats'}.${
          containment !== null && aiCalls ? ` ${Math.round(containment)}% of calls were resolved without a person.` : ''
        }`;

  /* ---- what was said: the range's transcribed calls, read a few at a time ---- */

  const transcribed = useMemo(
    () =>
      (callStats.rows || [])
        .filter((row: any) => row?.transcript_file)
        .map((row: any, index: number) => toTranscribedCall(row, index, companyUuid))
        .sort((a: TranscribedCall, b: TranscribedCall) => (b.started?.valueOf() ?? 0) - (a.started?.valueOf() ?? 0)),
    [callStats.rows, companyUuid],
  );
  const [shown, setShown] = useState(TRANSCRIPT_BATCH);
  const [moodFilter, setMoodFilter] = useState<MoodFilter>('all');
  const [query, setQuery] = useState('');
  const [openCall, setOpenCall] = useState<TranscribedCall | null>(null);
  // The transcript viewer clears its caller's state as it closes; here there is none to clear.
  const keepTranscriptState = useCallback(() => undefined, []);

  useEffect(() => {
    setShown(TRANSCRIPT_BATCH);
  }, [selectedRange?.from, selectedRange?.to]);

  const shownCalls = transcribed.slice(0, shown);
  const insightQueries = useQueries({
    queries: shownCalls.map((item: TranscribedCall) => ({
      queryKey: ['callTranscriptInsight', item.transcriptUrl],
      queryFn: () => fetchInsight(item.transcriptUrl),
      enabled: canTranscribe && Boolean(item.transcriptUrl),
      // A transcript doesn't change once written.
      staleTime: Infinity,
      retry: false,
    })),
  });
  const cards = shownCalls.map((item: TranscribedCall, index: number) => ({
    ...item,
    insight: insightQueries[index]?.data as TranscriptInsight | undefined,
    isLoading: Boolean(insightQueries[index]?.isLoading),
    isError: Boolean(insightQueries[index]?.isError),
  }));

  const moodCounts: Record<MoodFilter, number> = { all: cards.length, positive: 0, neutral: 0, negative: 0 };
  const themeCounts = new Map<string, { label: string; count: number }>();
  cards.forEach((card) => {
    const mood = card.insight?.mood;
    if (mood === 'positive' || mood === 'neutral' || mood === 'negative') moodCounts[mood] += 1;
    card.insight?.keywords.forEach((keyword) => {
      const key = keyword.toLowerCase();
      const entry = themeCounts.get(key);
      themeCounts.set(key, { label: entry?.label || keyword, count: (entry?.count || 0) + 1 });
    });
  });
  const themes = Array.from(themeCounts.entries())
    .map(([key, value]) => ({ key, ...value }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))
    .slice(0, THEME_LIMIT);

  const needle = query.trim().toLowerCase();
  const visibleCards = cards.filter((card) => {
    if (moodFilter !== 'all' && card.insight?.mood !== moodFilter) return false;
    if (!needle) return true;
    return [card.from, card.to, card.insight?.summary, ...(card.insight?.keywords || [])]
      .join(' ')
      .toLowerCase()
      .includes(needle);
  });
  const clearSaidFilters = () => {
    setMoodFilter('all');
    setQuery('');
  };

  const transcribedTotal = transcribed.length;
  const callsInRange = callStats.totalCount || callStats.rows?.length || 0;

  return (
    <div className="pf-wrap st-wrap">
      {/* ---- overview ---- */}
      <section className="pf-overview st-overview" aria-label="Conversations at a glance">
        <div className={`pf-overview-lead${aiTotal ? '' : ' is-calm'}`}>
          <div className="st-eyebrow-row">
            <p className="pf-eyebrow">
              <i className={hasLiveAi && aiTotal ? 'is-live' : undefined} aria-hidden="true" />
              AI conversations today
              {isAiSample && <span className="pf-sample-chip">Sample</span>}
            </p>
            <button
              type="button"
              className={`st-refresh${isRefreshing ? ' is-spinning' : ''}`}
              aria-label="Refresh the AI figures"
              title={canRequestAi ? 'Refresh the AI figures' : 'Waiting for the live connection'}
              aria-disabled={!canRequestAi || isRefreshing}
              onClick={() => {
                if (!canRequestAi || isRefreshing) return;
                setIsRefreshing(requestAi());
              }}
            >
              <RefreshCw aria-hidden="true" />
            </button>
          </div>
          <div className="pf-total">
            <b>{ai ? fmt(aiTotal) : '—'}</b>
            <div>
              <strong>{aiTotal === 1 ? 'conversation with AI' : 'conversations with AI'}</strong>
              <span>{isAiPending ? 'Listening for today’s AI figures…' : headline}</span>
            </div>
          </div>
        </div>

        <div className="st-mood">
          <p className="st-mood-head">
            <span>
              How customers sound{moodTotal > 0 && ` · ${fmt(moodTotal)} scored`}
            </span>
            <b>
              {hasMood ? balance : '—'}
              {hasMood && <em>{signed(net)} net</em>}
            </b>
          </p>
          {hasMood ? (
            <>
              <div
                className="st-meter"
                role="img"
                aria-label={`${balance}: ${buckets.map((bucket) => `${Math.round(bucket.percent)}% ${bucket.label.toLowerCase()}`).join(', ')}`}
              >
                <span
                  className="st-meter-needle"
                  style={{ left: `${(Math.max(-100, Math.min(100, net)) + 100) / 2}%` }}
                  aria-hidden="true"
                />
                <div className="st-meter-bar">
                  {buckets
                    .filter((bucket) => bucket.percent > 0)
                    .map((bucket) => (
                      <i key={bucket.key} data-mood={bucket.tone} style={{ flex: `${bucket.percent} 1 0` }} />
                    ))}
                </div>
                <div className="st-meter-scale" aria-hidden="true">
                  <span>Unhappy</span>
                  <span>Neutral</span>
                  <span>Happy</span>
                </div>
              </div>
              <ul className={`st-mood-keys${buckets.length > 3 ? ' is-wide' : ''}`}>
                {buckets.map((bucket) => (
                  <li key={bucket.key} data-mood={bucket.tone}>
                    <span>
                      <i aria-hidden="true" />
                      {bucket.label}
                    </span>
                    <b>{fmt(bucket.count)}</b>
                    <em>{Math.round(bucket.percent)}%</em>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <p className="st-mood-empty">
              {isAiPending ? 'Waiting for today’s sentiment…' : 'No conversation has been scored yet today.'}
            </p>
          )}
        </div>

        <dl className="pf-readouts">
          <div>
            <dt>Resolved by AI</dt>
            <dd>{containment === null ? '—' : `${Math.round(containment)}%`}</dd>
            <small>{ai ? `${fmt(resolvedByAi)} of ${fmt(aiCalls)} AI calls` : 'Waiting for AI figures'}</small>
          </div>
          <div>
            <dt>Handed to agents</dt>
            <dd>
              {ai ? fmt(transferred) : '—'}
              {ai && aiCalls > 0 && <em>{Math.round(transferPercent ?? pct(transferred, aiCalls))}% of calls</em>}
            </dd>
            <small>AI calls passed to a person</small>
          </div>
          <div>
            <dt>Avg AI call</dt>
            <dd>{avgAiSeconds === null ? '—' : formatSecsToClock(avgAiSeconds)}</dd>
            <small>{avgScore === null ? 'No sentiment score yet' : `Average sentiment score ${signed(avgScore)}`}</small>
          </div>
          <div>
            <dt>Transcribed {rangePhrase}</dt>
            <dd>
              {!canTranscribe || callStats.isPending ? '—' : fmt(transcribedTotal)}
              {canTranscribe && !callStats.isPending && callsInRange > 0 && <em>of {fmt(callsInRange)} calls</em>}
            </dd>
            <small>
              {!canTranscribe
                ? 'Transcription isn’t on this plan'
                : callStats.isPending
                  ? 'Loading calls'
                  : transcribedTotal
                    ? 'Summarised below'
                    : `No transcripts ${rangePhrase}`}
            </small>
          </div>
        </dl>
      </section>

      {isAiSample && (
        <PerfNotice>
          The AI hasn’t reported any conversations for this account yet, so today’s AI figures
          below are samples. Transcribed calls are always this account’s own.
        </PerfNotice>
      )}

      {/* ---- what they ask about, and where it goes ---- */}
      <div className="st-insights">
        <article className="st-card" aria-label="Topics">
          <header className="st-card-head">
            <div>
              <h3>What customers ask about</h3>
              <p>Topics the AI picked out of today’s conversations</p>
            </div>
            {topics.length > 0 && (
              <span className="st-card-meta">
                {topics.length} {topics.length === 1 ? 'topic' : 'topics'} · {fmt(topicsTotal)}
              </span>
            )}
          </header>
          {topics.length ? (
            <>
              <ol className="st-topics">
                {(showAllTopics ? topics : topics.slice(0, TOPIC_ROWS)).map((topic, index) => (
                  <li key={topic.label} className="st-topic">
                    <span className="st-topic-rank">{index + 1}</span>
                    <span className="st-topic-name" title={topic.label}>
                      {topic.label}
                    </span>
                    <span className="st-topic-bar" aria-hidden="true">
                      <i style={{ width: `${(topic.count / topics[0].count) * 100}%` }} />
                    </span>
                    <span className="st-topic-count">{fmt(topic.count)}</span>
                    <span className="st-topic-share">{pct(topic.count, topicsTotal)}%</span>
                  </li>
                ))}
              </ol>
              {topics.length > TOPIC_ROWS && (
                <button type="button" className="st-card-more" onClick={() => setShowAllTopics((value) => !value)}>
                  {showAllTopics ? 'Show fewer' : `Show all ${topics.length} topics`}
                </button>
              )}
            </>
          ) : (
            <p className="st-card-empty">
              {isAiPending ? 'Waiting for today’s topics…' : 'No topics have been picked out yet today.'}
            </p>
          )}
        </article>

        <article className="st-card" aria-label="How conversations flow">
          <header className="st-card-head">
            <div>
              <h3>How conversations flow</h3>
              <p>Where today’s AI calls ended up, and how people got in touch</p>
            </div>
          </header>
          {ai ? (
            <>
              <div className="st-fork">
                <div className="st-fork-total">
                  <b>{fmt(aiCalls)}</b>
                  <span>AI calls</span>
                </div>
                <div className="st-fork-branches">
                  <div className="st-branch">
                    <span>Resolved by AI</span>
                    <b>
                      {fmt(resolvedByAi)}
                      <em>{pct(resolvedByAi, aiCalls)}%</em>
                    </b>
                    <i aria-hidden="true">
                      <u style={{ width: `${Math.min(100, pct(resolvedByAi, aiCalls))}%` }} />
                    </i>
                  </div>
                  <div className="st-branch is-handed">
                    <span>Handed to a person</span>
                    <b>
                      {fmt(transferred)}
                      <em>{pct(transferred, aiCalls)}%</em>
                    </b>
                    <i aria-hidden="true">
                      <u style={{ width: `${Math.min(100, pct(transferred, aiCalls))}%` }} />
                    </i>
                  </div>
                </div>
              </div>
              {leadsCaptured > 0 && (
                <span className="st-lead-chip">
                  <Sparkles aria-hidden="true" />
                  {fmt(leadsCaptured)} {leadsCaptured === 1 ? 'lead' : 'leads'} captured by the AI receptionist
                </span>
              )}

              {(voicePercent !== null || textPercent !== null) && (
                <div className="st-subsection">
                  <p className="st-subhead">
                    Channel
                    <em>{fmt(aiTotal)} conversations</em>
                  </p>
                  <div
                    className="st-channel"
                    role="img"
                    aria-label={`${Math.round(voicePercent ?? 0)}% voice, ${Math.round(textPercent ?? 0)}% text`}
                  >
                    {(voicePercent ?? 0) > 0 && <i className="is-voice" style={{ flex: `${voicePercent} 1 0` }} />}
                    {(textPercent ?? 0) > 0 && <i className="is-text" style={{ flex: `${textPercent} 1 0` }} />}
                  </div>
                  <div className="st-channel-keys">
                    <span>
                      <Mic aria-hidden="true" />
                      Voice <b>{Math.round(voicePercent ?? 0)}%</b>
                    </span>
                    <span>
                      <MessageSquare aria-hidden="true" />
                      Text <b>{Math.round(textPercent ?? 0)}%</b>
                    </span>
                  </div>
                </div>
              )}

              {lengthTotal > 0 && (
                <div className="st-subsection">
                  <p className="st-subhead">
                    Length of AI calls
                    <em>{fmt(lengthTotal)} calls</em>
                  </p>
                  <ol className="st-lengths">
                    {lengths.map((bucket: { key: string; label: string; count: number }) => (
                      <li
                        key={bucket.key}
                        className={`st-length${bucket.count && bucket.count === lengthPeak ? ' is-peak' : ''}`}
                        title={`${fmt(bucket.count)} ${bucket.count === 1 ? 'call' : 'calls'} lasting ${bucket.label}`}
                      >
                        <b>{fmt(bucket.count)}</b>
                        <i style={{ height: `${lengthPeak ? Math.max(3, (bucket.count / lengthPeak) * 52) : 3}px` }} />
                        <span>{bucket.label}</span>
                      </li>
                    ))}
                  </ol>
                </div>
              )}
            </>
          ) : (
            <p className="st-card-empty">Waiting for today’s AI figures…</p>
          )}
        </article>
      </div>

      {/* ---- the AI agents ---- */}
      <section className="pf-list" aria-label="AI agents">
        <header className="st-list-head">
          <h3>AI agents</h3>
          <p>
            {happiest && unhappiest && happiest !== unhappiest ? (
              <>
                Happiest customers with <b>{happiest}</b> · least happy with <b>{unhappiest}</b>
              </>
            ) : (
              'How customers sounded with each AI receptionist and chatbot today'
            )}
          </p>
        </header>
        <div className="pf-list-cols st-agent-cols" aria-hidden="true">
          <span>Agent</span>
          <span>Today</span>
          <span>How customers sounded</span>
          <span>Mood</span>
          <span className="st-col-score">Score</span>
        </div>
        {isAgentsPending ? (
          <ul className="pf-rows" aria-label="Loading">
            {[0, 1].map((row) => (
              <li key={row} className="pf-list-row st-agent-row pf-skel" aria-hidden="true">
                <i />
                <i />
                <i />
                <i />
                <i />
              </li>
            ))}
          </ul>
        ) : agentRows.length ? (
          <ul className="pf-rows">
            {agentRows.map((row: ReturnType<typeof toAgentRow>) => (
              <li key={row.key} className="pf-list-row st-agent-row">
                <div className="st-agent">
                  <span className="st-avatar" aria-hidden="true">
                    {getInitials(row.name)}
                  </span>
                  <div className="st-agent-text">
                    <b title={row.name}>{row.name}</b>
                    <small>{[row.extension ? `Ext ${row.extension}` : '', row.status].filter(Boolean).join(' · ') || 'AI agent'}</small>
                  </div>
                </div>
                <div className="st-cell st-today">
                  <b>{fmt(row.conversations)}</b>
                  <small>{row.conversations === 1 ? 'conversation' : 'conversations'}</small>
                </div>
                <div className="st-mix">
                  {row.hasMix ? (
                    <>
                      <span
                        className="st-mix-bar"
                        role="img"
                        aria-label={`${Math.round(row.mix.positive)}% positive, ${Math.round(row.mix.neutral)}% neutral, ${Math.round(row.mix.negative)}% negative`}
                      >
                        {(['negative', 'neutral', 'positive'] as const)
                          .filter((key) => row.mix[key] > 0)
                          .map((key) => (
                            <i key={key} data-mood={key} style={{ flex: `${row.mix[key]} 1 0` }} />
                          ))}
                      </span>
                      <small>
                        <b>{Math.round(row.mix.positive)}%</b> positive · <b>{Math.round(row.mix.negative)}%</b> negative
                      </small>
                    </>
                  ) : (
                    <small>No conversation scored yet</small>
                  )}
                </div>
                <div className="st-mood-cell">
                  <span className="st-mood-chip" data-mood={row.mood}>
                    <i aria-hidden="true" />
                    {row.moodLabel}
                  </span>
                </div>
                <div className="st-score-cell">
                  <span className={`st-score${row.score !== null && row.score < 0 ? ' is-negative' : ''}`}>
                    {row.score === null ? '—' : signed(row.score)}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <div className="pf-list-empty">
            <h4>No AI agents yet</h4>
            <p>AI receptionists and chatbots show up here once they’ve taken a conversation today.</p>
          </div>
        )}
      </section>

      {/* ---- what was said ---- */}
      <section className="st-said" aria-label="What was said">
        <div className="pf-toolbar">
          <div className="st-said-title">
            <h3>What was said</h3>
            <p>
              {canTranscribe && transcribedTotal
                ? `The latest ${Math.min(shown, transcribedTotal)} of ${fmt(transcribedTotal)} transcribed ${transcribedTotal === 1 ? 'call' : 'calls'} ${rangePhrase}`
                : `Summaries of transcribed calls ${rangePhrase}`}
            </p>
          </div>
          {canTranscribe && transcribedTotal > 0 && (
            <>
              <div className="mcm-segmented" role="group" aria-label="Filter calls by mood">
                {MOOD_FILTERS.map((key) => (
                  <button
                    key={key}
                    type="button"
                    aria-pressed={moodFilter === key}
                    className={moodFilter === key ? 'is-active' : ''}
                    onClick={() => setMoodFilter(key)}
                  >
                    {key === 'all' ? 'All' : MOOD_LABEL[key]}
                    <em>{moodCounts[key]}</em>
                  </button>
                ))}
              </div>
              <label className="pf-search pf-toolbar-search">
                <Search aria-hidden="true" />
                <input
                  type="search"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search summaries or keywords"
                  aria-label="Search transcribed calls"
                />
              </label>
            </>
          )}
        </div>

        {canTranscribe && themes.length > 0 && (
          <div className="st-themes" role="group" aria-label="Common themes">
            <span className="st-themes-label">Common themes</span>
            {themes.map((theme) => (
              <button
                key={theme.key}
                type="button"
                className={`st-theme${needle === theme.key ? ' is-on' : ''}`}
                aria-pressed={needle === theme.key}
                onClick={() => setQuery(needle === theme.key ? '' : theme.label)}
              >
                {theme.label}
                <b>{theme.count}</b>
              </button>
            ))}
          </div>
        )}

        {!canTranscribe ? (
          <div className="pf-list-empty st-said-empty">
            <h4>Transcription isn’t on this plan</h4>
            <p>With call transcription on, each call’s summary, mood and keywords show up here after it ends.</p>
          </div>
        ) : callStats.isPending ? (
          <div className="st-cards" aria-label="Loading">
            {[0, 1, 2].map((card) => (
              <article key={card} className="st-quote is-loading" aria-hidden="true">
                <span className="st-quote-line" />
                <span className="st-quote-line" />
                <span className="st-quote-line" />
              </article>
            ))}
          </div>
        ) : !transcribedTotal ? (
          <div className="pf-list-empty st-said-empty">
            <h4>No transcribed calls {rangePhrase}</h4>
            <p>Calls are summarised here once they’re transcribed. Pick a longer range at the top to look further back.</p>
          </div>
        ) : visibleCards.length ? (
          <div className="st-cards">
            {visibleCards.map((card) => {
              const mood: Mood = card.insight?.mood || 'unknown';
              return (
                <article key={card.key} className={`st-quote${card.isLoading ? ' is-loading' : ''}`}>
                  <div className="st-quote-top">
                    <span className="st-mood-chip" data-mood={mood}>
                      <i aria-hidden="true" />
                      {card.isLoading ? 'Reading…' : card.isError ? 'Unreadable' : MOOD_LABEL[mood]}
                    </span>
                    <span>
                      {card.started ? `${dayLabel(card.started)}, ${card.started.format('h:mm A')}` : '—'}
                      {card.seconds > 0 ? ` · ${formatSecsToClock(card.seconds)}` : ''}
                    </span>
                  </div>
                  <div className="st-quote-who">
                    <b title={`${card.from} → ${card.to}`}>
                      {card.from} → {card.to}
                    </b>
                  </div>
                  {card.isLoading ? (
                    <>
                      <span className="st-quote-line" aria-hidden="true" />
                      <span className="st-quote-line" aria-hidden="true" />
                    </>
                  ) : (
                    <p className={`st-quote-text${card.insight?.summary ? '' : ' is-muted'}`}>
                      {card.insight?.summary ||
                        (card.isError ? 'This transcript couldn’t be read.' : 'No summary was written for this call.')}
                    </p>
                  )}
                  {card.insight && card.insight.keywords.length > 0 && (
                    <div className="st-quote-keys">
                      {card.insight.keywords.slice(0, 4).map((keyword) => (
                        <span key={keyword}>{keyword}</span>
                      ))}
                    </div>
                  )}
                  <footer className="st-quote-foot">
                    <span>{card.direction ? `${card.direction} call` : 'Call'}</span>
                    <button type="button" className="st-read" onClick={() => setOpenCall(card)}>
                      <FileText aria-hidden="true" />
                      Read transcript
                    </button>
                  </footer>
                </article>
              );
            })}
          </div>
        ) : (
          <div className="pf-list-empty st-said-empty">
            <h4>No calls match</h4>
            <p>None of the transcripts read so far match this mood or search.</p>
            <button type="button" className="pf-list-empty-btn" onClick={clearSaidFilters}>
              Show every call
            </button>
          </div>
        )}

        {canTranscribe && transcribedTotal > shown && (
          <button type="button" className="st-more" onClick={() => setShown((value) => value + TRANSCRIPT_BATCH)}>
            Read {Math.min(TRANSCRIPT_BATCH, transcribedTotal - shown)} more of {fmt(transcribedTotal)}
          </button>
        )}
      </section>

      {openCall && (
        <SideDrawer
          isHeader
          isOpen
          title="Call Intelligence"
          backgroundStyle="bg-transparent"
          handleClose={() => setOpenCall(null)}
          content={
            <TranscriptInfo
              initialData={canListen && canPlayRecording(openCall.raw).allowed ? openCall.recordingUrl : ''}
              transcriptSrcURL={openCall.transcriptUrl}
              setTranscriptionState={keepTranscriptState}
            />
          }
        />
      )}
    </div>
  );
};

export default SpeechTextTab;
