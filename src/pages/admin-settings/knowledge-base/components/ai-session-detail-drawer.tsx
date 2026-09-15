import { getSessionChat } from '@/services/api';
import { SentimentAnalysisCard } from '@/components/custom/hover-portal-card';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowUpRight,
  Check,
  Copy,
  Download,
  Loader2,
  MessageSquare,
  Phone,
  Sparkles,
  X,
} from 'lucide-react';

type SessionIntent = { label: string; summary: string };
type SentimentKey = 'positive' | 'neutral' | 'negative';

const sentimentScoreRows: Array<{
  key: SentimentKey;
  label: string;
  colorClass: string;
}> = [
  { key: 'positive', label: 'Positive', colorClass: 'bg-green-500' },
  { key: 'negative', label: 'Negative', colorClass: 'bg-red-600' },
  { key: 'neutral', label: 'Neutral', colorClass: 'bg-neutral-400' },
];

const safeNumber = (value: any) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
};

const toDate = (value: any) => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const formatDuration = (durationMs: any) => {
  const totalSeconds = Math.max(0, Math.floor(safeNumber(durationMs) / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  if (minutes >= 60) {
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    return `${hours}:${String(remainingMinutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }

  return `${minutes}:${String(seconds).padStart(2, '0')}`;
};

const formatCost = (value: any) => `$${safeNumber(value).toFixed(2)}`;

const hasSessionCost = (session: any) =>
  session?.totalCostUSD !== null && session?.totalCostUSD !== undefined;

const getCostBasis = (session: any) =>
  String(session?.costBasis || session?.cost?.basis || '').trim();

const getCostDeductionLabel = (session: any) =>
  String(
    session?.costDeductionLabel ||
      session?.costBilling?.deductionLabel ||
      session?.cost?.billing?.deductionLabel ||
      '',
  ).trim();

const formatTime = (value: any) => {
  const date = toDate(value);
  if (!date) return '-';
  return date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  });
};

const formatStarted = (value: any) => {
  const date = toDate(value);
  if (!date) return '-';

  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);

  const sameDate = (left: Date, right: Date) =>
    left.getFullYear() === right.getFullYear() &&
    left.getMonth() === right.getMonth() &&
    left.getDate() === right.getDate();

  if (sameDate(date, today)) return `Today · ${formatTime(date)}`;
  if (sameDate(date, yesterday)) return `Yesterday · ${formatTime(date)}`;

  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
};

const formatOffset = (startedAt: any, messageAt: any) => {
  const start = toDate(startedAt);
  const messageDate = toDate(messageAt);
  if (!start || !messageDate) return '';
  return formatDuration(Math.max(0, messageDate.getTime() - start.getTime()));
};

const formatResponseTime = (value: any) => {
  const milliseconds = safeNumber(value);
  if (!milliseconds) return '';
  if (milliseconds < 1000) return `${Math.round(milliseconds)}ms`;
  return `${(milliseconds / 1000).toFixed(1)}s`;
};

const getInitials = (value: any) => {
  const words = String(value || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (!words.length) return 'AI';
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return `${words[0][0]}${words[1][0]}`.toUpperCase();
};

const getSessionIntents = (data: any): SessionIntent[] => {
  const seen = new Set<string>();
  return (Array.isArray(data?.intents) ? data.intents : [])
    .map((item: any) => ({
      label: String(item?.intent_label || '').trim(),
      summary: String(item?.intent_summary || '').trim(),
    }))
    .filter((item: any) => {
      const normalized = item.label.toLowerCase();
      if (!item.label || normalized === 'other' || seen.has(normalized)) return false;
      seen.add(normalized);
      return true;
    });
};

const getSentimentLabel = (session: any) => {
  const label = String(session?.sentiment || '')
    .trim()
    .toLowerCase();
  if (!label) return 'Not analyzed';
  return label;
};

const getSentimentScore = (session: any) => {
  const scores = session?.sentiment_scores || {};
  const sentiment = getSentimentLabel(session);
  const score = safeNumber(scores?.[sentiment]);
  return score > 0 ? Math.round(score) : 0;
};

const getSentimentScores = (session: any) => {
  const scores = session?.sentiment_scores || {};
  return sentimentScoreRows.map((row) => ({
    ...row,
    score: Math.max(0, Math.min(100, Math.round(safeNumber(scores?.[row.key])))),
  }));
};

const HandoffIcon = (props: { className?: string }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.8}
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    {...props}
  >
    <path d="M4.2 8.2A8.6 8.6 0 0 1 19.2 6.8" />
    <path d="M20 16.4A8.6 8.6 0 0 1 5 17.8" />
    <path d="M2.4 5.2v3.2h3.2" />
    <path d="M21.8 19.4v-3.2h-3.2" />
    <circle cx="12" cy="9.4" r="2.3" />
    <path d="M8.5 15.3a3.6 3.6 0 0 1 7 0" />
  </svg>
);

const getOutcomeIcon = (outcome: string) => {
  if (outcome === 'Resolved') return Check;
  if (outcome === 'Handoff') return HandoffIcon;
  if (outcome === 'Callback') return ArrowUpRight;
  return X;
};

const getOutcomeTextClass = (outcome: string) => {
  if (outcome === 'Resolved') return 'text-emerald-600';
  if (outcome === 'Handoff') return 'text-blue-600';
  if (outcome === 'Callback') return 'text-amber-600';
  return 'text-red-600';
};

const getOutcomeRingClass = (outcome: string) => {
  if (outcome === 'Resolved') return 'border-emerald-500';
  if (outcome === 'Handoff') return 'border-blue-500';
  if (outcome === 'Callback') return 'border-amber-500';
  return 'border-red-500';
};

const getOutcome = (session: any) => {
  if (session?.status === 'active') return 'Active';
  if (session?.handoff) return 'Handoff';
  if (session?.scheduledCallback) return 'Callback';
  return 'Resolved';
};

const getContactTitle = (session: any) => {
  const collectedData = session?.collectedData || {};
  const name = String(
    collectedData?.name?.value ||
      collectedData?.first_name?.value ||
      collectedData?.full_name?.value ||
      '',
  ).trim();

  if (name) return name;
  return session?.channel === 'call' ? 'Inbound caller' : 'visitor · web widget';
};

const getContactSubText = (session: any) => {
  const collectedData = session?.collectedData || {};
  const callerId = String(session?.callerId || session?.caller_id || '').trim();
  const phone = String(
    collectedData?.phone?.value || collectedData?.phone_number?.value || '',
  ).trim();
  const email = String(collectedData?.email?.value || '').trim();

  if (session?.channel === 'call' && callerId) return callerId;
  if (phone && email) return `${phone} · ${email}`;
  if (phone) return phone;
  if (email) return email;
  return session?.sessionId ? `sess_${String(session.sessionId).slice(0, 6)}` : '-';
};

const getAgentName = (session: any, agentById?: Map<string, any>) => {
  const agentId = String(session?.agentId || '').trim();
  const agent = agentById?.get(agentId);
  return String(
    agent?.agentName || agent?.name || session?.agentName || session?.agent_name || 'Unnamed agent',
  );
};

const makeSessionText = (messages: any[] = []) =>
  messages
    .map((item) => `${item?.displayName || item?.role || 'Message'}: ${item?.data || ''}`)
    .join('\n\n');

const downloadTextFile = (fileName: string, text: string) => {
  const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
};

const copyText = async (text: string) => {
  if (!text) return;
  await navigator.clipboard.writeText(text);
};

const DetailItem = ({
  label,
  value,
  className = '',
  wrapperClassName = '',
}: {
  label: string;
  value: any;
  className?: string;
  wrapperClassName?: string;
}) => (
  <div className={wrapperClassName}>
    <div className="text-[11px] font-medium text-slate-500">{label}</div>
    <div
      className={`mt-0.5 flex items-center gap-1.5 text-[13px] font-bold text-slate-950 ${className}`}
    >
      {value}
    </div>
  </div>
);

type AiSessionDetailDrawerProps = {
  session: any;
  agentById?: Map<string, any>;
  isLoading?: boolean;
  emptyMessage?: string;
  onClose: () => void;
};

const AiSessionDetailDrawer = ({
  session,
  agentById,
  isLoading = false,
  emptyMessage = 'No AI session found for this call.',
  onClose,
}: AiSessionDetailDrawerProps) => {
  const sessionId = session?.sessionId;
  const { data: selectedMessages = [], isLoading: isLoadingMessages } = useQuery({
    queryKey: ['getSessionChat', session?.agentId, sessionId],
    queryFn: () =>
      getSessionChat({
        agentId: session?.agentId,
        sessionId,
      }),
    select: (data) => data?.data?.messages || [],
    enabled: Boolean(session?.agentId) && Boolean(sessionId),
  });

  const selectedIntents = getSessionIntents(session);
  const transcriptText = makeSessionText(selectedMessages);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-neutral-950/45 px-4"
      onClick={onClose}
    >
      <div
        className="flex max-h-[88vh] w-[600px] max-w-full flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center gap-3 border-b border-neutral-200 bg-white px-5 py-4">
          <div className="flex min-w-0 items-center gap-2">
            {session ? (
              session.channel === 'call' ? (
                <Phone className="h-4 w-4 shrink-0 text-red-600" strokeWidth={2.5} />
              ) : (
                <MessageSquare className="h-4 w-4 shrink-0 text-neutral-600" strokeWidth={2.5} />
              )
            ) : null}
            <h2 className="truncate text-base font-bold text-neutral-900">
              {session ? getContactTitle(session) : 'AI session'}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="ml-auto grid h-8 w-8 shrink-0 place-items-center rounded-full text-neutral-400 transition-colors hover:bg-red-50 hover:text-red-600"
            aria-label="Close session"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {isLoading ? (
          <div className="flex flex-1 items-center justify-center text-neutral-500">
            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            Loading session...
          </div>
        ) : !session ? (
          <div className="flex flex-1 items-center justify-center px-5 text-center text-sm font-semibold text-slate-500">
            {emptyMessage}
          </div>
        ) : (
          <>
            <div className="flex-1 overflow-y-auto bg-white pl-8 pr-5 py-[18px]">
              <div className="pb-4">
                <div className="mb-2.5 border-b border-red-100 pb-2">
                  <span className="text-[14px] font-bold uppercase tracking-[0.04em] text-neutral-900">
                    Session details
                  </span>
                </div>
                <div className="grid grid-cols-1 gap-x-4 gap-y-2.5 sm:grid-cols-2">
                  <DetailItem
                    label="Channel"
                    value={
                      session?.channel === 'call' ? (
                        <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full bg-indigo-50 px-2 py-0.5 text-[10.5px] font-semibold text-indigo-700">
                          <span className="h-1.5 w-1.5 rounded-full bg-indigo-500" />
                          Voice
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full bg-teal-50 px-2 py-0.5 text-[10.5px] font-semibold text-teal-700">
                          <span className="h-1.5 w-1.5 rounded-full bg-teal-500" />
                          Chat
                        </span>
                      )
                    }
                  />
                  <DetailItem label="Agent" value={getAgentName(session, agentById)} />
                  <DetailItem
                    label="Started"
                    value={formatStarted(session?.startedAt || session?.createdAt)}
                  />
                  <DetailItem label="Duration" value={formatDuration(session?.durationMs)} />
                  <DetailItem
                    label="Contact"
                    className="items-start"
                    value={
                      <div className="flex flex-col gap-0.5">
                        <span>{getContactTitle(session)}</span>
                        <span className="text-[11px] font-medium text-neutral-500">
                          {getContactSubText(session)}
                        </span>
                      </div>
                    }
                  />
                  <DetailItem
                    label="Cost"
                    className="items-start"
                    value={
                      <div className="flex flex-col gap-0.5">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="text-green-700">
                            {hasSessionCost(session) ? formatCost(session?.totalCostUSD) : '-'}
                          </span>
                          {getCostBasis(session) ? (
                            <span className="text-[11px] font-medium text-neutral-500">
                              · {getCostBasis(session)}
                            </span>
                          ) : null}
                        </div>
                        {getCostDeductionLabel(session) ? (
                          <span className="text-[11px] font-semibold text-neutral-500">
                            {getCostDeductionLabel(session)}
                          </span>
                        ) : null}
                      </div>
                    }
                  />
                  <DetailItem label="Intent" value={selectedIntents[0]?.label || 'Not analyzed'} />
                  <DetailItem
                    label="Outcome"
                    value={(() => {
                      const outcome = getOutcome(session);
                      const OutcomeIcon = getOutcomeIcon(outcome);
                      // The handoff mark draws its own ring, so it skips the
                      // bordered circle the other outcomes sit in.
                      const isHandoff = outcome === 'Handoff';
                      return (
                        <span className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-neutral-900">
                          {isHandoff ? (
                            <OutcomeIcon
                              className={`h-4 w-4 shrink-0 ${getOutcomeTextClass(outcome)}`}
                            />
                          ) : (
                            <span
                              className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-[1.5px] ${getOutcomeRingClass(
                                outcome,
                              )} ${getOutcomeTextClass(outcome)}`}
                            >
                              {outcome === 'Active' ? (
                                <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-current" />
                              ) : (
                                <OutcomeIcon className="h-2.5 w-2.5 shrink-0" strokeWidth={2.75} />
                              )}
                            </span>
                          )}
                          {outcome}
                        </span>
                      );
                    })()}
                  />
                  <DetailItem
                    label="CSAT"
                    wrapperClassName="sm:col-span-2"
                    value={
                      safeNumber(session?.csat?.score) ? (
                        <span className="text-amber-500">
                          {'★'.repeat(Math.round(session.csat.score))}
                          {'☆'.repeat(Math.max(0, 5 - Math.round(session.csat.score)))} ·{' '}
                          {session.csat.score}/5
                        </span>
                      ) : (
                        'Not analyzed'
                      )
                    }
                  />
                </div>
              </div>

              <div className="border-t border-neutral-100 py-4">
                <div className="mb-2.5 border-b border-red-100 pb-2">
                  <span className="text-[14px] font-bold uppercase tracking-[0.04em] text-neutral-900">
                    Sentiment analysis
                  </span>
                </div>
                {getSentimentScore(session) ? (
                  <SentimentAnalysisCard scores={getSentimentScores(session)} bare />
                ) : (
                  <div className="text-[13px] text-neutral-500">Not analyzed</div>
                )}
              </div>

              <div className="border-t border-neutral-100 py-4">
                <div className="mb-2.5 flex items-center gap-1.5 border-b border-red-100 pb-2">
                  <Sparkles className="h-3.5 w-3.5 shrink-0 text-red-600" strokeWidth={2.5} />
                  <span className="text-[14px] font-bold uppercase tracking-[0.04em] text-neutral-900">
                    AI summary
                  </span>
                </div>
                <p className="mt-2.5 text-[13px] leading-relaxed text-neutral-700">
                  {String(session?.summary || '').trim() ||
                    'No summary available for this session.'}
                </p>
                {selectedIntents.length ? (
                  <div className="mt-2.5 flex flex-wrap gap-1.5">
                    {selectedIntents.map((intent) => (
                      <span
                        key={intent.label}
                        className="rounded-full bg-red-50 px-2.5 py-1 text-[11px] font-semibold text-red-600"
                      >
                        {intent.label}
                      </span>
                    ))}
                  </div>
                ) : null}
              </div>

              <div className="border-t border-neutral-100 pt-4">
                <div className="mb-2.5 border-b border-red-100 pb-2">
                  <span className="text-[14px] font-bold uppercase tracking-[0.04em] text-neutral-900">
                    Transcript
                  </span>
                </div>
                {isLoadingMessages ? (
                  <div className="flex min-h-[180px] items-center justify-center text-neutral-500">
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    Loading transcript...
                  </div>
                ) : selectedMessages.length ? (
                  <div>
                    {selectedMessages.map((message: any, index: number) => {
                      const isUser = message?.role === 'user';
                      const displayName = String(
                        message?.displayName || (isUser ? 'Visitor' : 'Agent'),
                      ).trim();
                      const offset = formatOffset(
                        session?.startedAt || session?.createdAt,
                        message?.at,
                      );

                      return (
                        <div
                          key={`${message?.at || index}-${message?.role}`}
                          className="border-b border-neutral-100 py-2.5 first:pt-0 last:border-b-0 last:pb-0"
                        >
                          <div className="flex gap-2.5">
                            <div
                              className={`flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-white ${
                                isUser ? 'bg-neutral-400' : 'bg-neutral-900'
                              }`}
                            >
                              {getInitials(displayName)}
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="text-[11px] font-bold text-neutral-500">
                                  {displayName}
                                </span>
                                {offset ? (
                                  <span className="text-[11px] font-medium text-neutral-400">
                                    {offset}
                                  </span>
                                ) : null}
                                {!isUser &&
                                message?.responseTimeMs !== null &&
                                message?.responseTimeMs !== undefined ? (
                                  <span className="text-[11px] font-medium text-neutral-400">
                                    Response {formatResponseTime(message.responseTimeMs)}
                                  </span>
                                ) : null}
                              </div>
                              <p className="mt-1 whitespace-pre-wrap text-[13px] leading-relaxed text-neutral-800">
                                {message?.data}
                              </p>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="py-12 text-center text-neutral-500">No transcript available.</div>
                )}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 border-t border-neutral-200 bg-white px-5 py-3">
              <button
                type="button"
                onClick={() => copyText(transcriptText)}
                className="inline-flex h-10 items-center gap-1.5 rounded-full border border-neutral-200 bg-white px-5 text-sm font-semibold text-neutral-700 transition-colors hover:border-red-200 hover:bg-red-50 hover:text-red-600"
              >
                <Copy className="h-3.5 w-3.5" />
                Copy
              </button>
              <button
                type="button"
                onClick={() =>
                  downloadTextFile(
                    `${session?.sessionId || 'session'}-transcript.txt`,
                    transcriptText,
                  )
                }
                className="ml-auto inline-flex h-10 items-center gap-1.5 rounded-full bg-neutral-900! px-5 text-sm font-semibold text-white! transition-colors hover:bg-neutral-800!"
              >
                <Download className="h-3.5 w-3.5" />
                Download
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default AiSessionDetailDrawer;
