/**
 * Fabricated data for the Performance tabs that fetch their own, independent
 * data (each has its own `useQuery`/API call rather than sharing the CDR
 * dataset in `dummy-call-data.ts`). Used only as a fallback when the real
 * result is empty — see each tab file for exactly where it's applied.
 */

const hoursFromNow = (hours: number) => new Date(Date.now() + hours * 3600_000).toISOString();
const daysFromNowAt = (days: number, hour: number) => {
  const date = new Date();
  date.setDate(date.getDate() + days);
  date.setHours(hour, 0, 0, 0);
  return date.toISOString();
};

/** Shaped like a `campaignList` row (see `campaign-activity-tab.tsx` /
 *  `reports/builders.ts`'s `campaignPerformance`). */
export const DUMMY_CAMPAIGNS = [
  {
    _id: 'sample-campaign-1',
    name: 'Spring Renewal Outreach',
    dialMethod: 'PREDICTIVE',
    campaignStatus: 'ACTIVE',
    createdAt: daysFromNowAt(-12, 9),
    startDate: daysFromNowAt(-10, 9),
    endDate: daysFromNowAt(12, 18),
    members: JSON.stringify([
      { user_uuid: 'dummy-agent-1', label: 'Priya Shah' },
      { user_uuid: 'dummy-agent-2', label: 'Marcus Reed' },
    ]),
    campaignAnalytics: {
      assignedLeads: 420,
      answeredLeads: 168,
      totalCallNotAnswered: 210,
      totalDnc: 12,
    },
  },
  {
    _id: 'sample-campaign-2',
    name: 'Winback — Lapsed Accounts',
    dialMethod: 'PROGRESSIVE',
    campaignStatus: 'ACTIVE',
    createdAt: daysFromNowAt(-5, 11),
    startDate: daysFromNowAt(-3, 9),
    endDate: daysFromNowAt(2, 18),
    members: JSON.stringify([{ user_uuid: 'dummy-agent-2', label: 'Marcus Reed' }]),
    campaignAnalytics: {
      assignedLeads: 260,
      answeredLeads: 94,
      totalCallNotAnswered: 151,
      totalDnc: 5,
    },
  },
  {
    _id: 'sample-campaign-3',
    name: 'Q3 Product Survey',
    dialMethod: 'PREVIEW',
    campaignStatus: 'PAUSED',
    createdAt: daysFromNowAt(-25, 10),
    startDate: daysFromNowAt(-20, 9),
    endDate: daysFromNowAt(20, 18),
    members: JSON.stringify([{ user_uuid: 'dummy-agent-3', label: 'Elena Novak' }]),
    campaignAnalytics: {
      assignedLeads: 150,
      answeredLeads: 61,
      totalCallNotAnswered: 84,
      totalDnc: 3,
    },
  },
] as const;

/** Shaped like a `calendarMeetingList` TASK row — a callback scheduled from the
 *  dialpad's wrap-up, or a follow-up from the calendar (see `callbacks-tab.tsx`). */
export const DUMMY_TASKS = [
  {
    _id: 'sample-callback-1',
    name: 'Call Back Schedule',
    category: 'TASK',
    status: 'PENDING',
    source: 'QUEUE',
    createdAt: hoursFromNow(-5),
    startTime: hoursFromNow(-1.3),
    details: { contactName: 'Maria Gonzalez', contactPhone: '+14155550142' },
    members: [{ name: 'Priya Shah', type: 'ADMIN' }],
  },
  {
    _id: 'sample-callback-2',
    name: 'Call Back Schedule',
    category: 'TASK',
    status: 'PENDING',
    source: 'LEAD',
    createdAt: hoursFromNow(-2),
    startTime: hoursFromNow(0.7),
    details: { contactName: 'Dev Patel', contactPhone: '+13105550123' },
    members: [{ name: 'Marcus Reed', type: 'USER' }],
  },
  {
    _id: 'sample-callback-3',
    name: 'Call Back Schedule',
    description: 'Wants a quote for the annual plan',
    category: 'TASK',
    status: 'PENDING',
    source: 'CONTACT',
    createdAt: hoursFromNow(-3),
    startTime: hoursFromNow(4),
    details: { contactName: 'Northwind Traders', contactPhone: '+14085550155' },
    members: [{ name: 'Priya Shah', type: 'ADMIN' }],
  },
  {
    _id: 'sample-callback-4',
    name: 'Call Back Schedule',
    category: 'TASK',
    status: 'PENDING',
    source: 'QUEUE',
    createdAt: hoursFromNow(-1),
    startTime: daysFromNowAt(1, 10),
    details: { contactName: 'Aisha Khan', contactPhone: '+19175550188' },
    members: [{ name: 'Elena Novak', type: 'USER' }],
  },
  {
    _id: 'sample-callback-5',
    name: 'Send the renewal paperwork',
    description: 'Email it after the onboarding call',
    category: 'TASK',
    status: 'PENDING',
    source: 'CALENDAR',
    createdAt: hoursFromNow(-20),
    startTime: daysFromNowAt(3, 15),
    members: [{ name: 'Marcus Reed', type: 'USER' }],
  },
  {
    _id: 'sample-callback-6',
    name: 'Call Back Schedule',
    category: 'TASK',
    status: 'COMPLETED',
    source: 'QUEUE',
    createdAt: hoursFromNow(-9),
    startTime: hoursFromNow(-3),
    details: { contactName: 'Tom Becker', contactPhone: '+16465550111' },
    members: [{ name: 'Elena Novak', type: 'USER' }],
  },
];

/** Shaped like the socket "AI live wallboard" result read by
 *  `dashboards-tab.tsx`, `speech-text-tab.tsx` and `reports-tab.tsx`
 *  (sentiment/topics report). */
export const DUMMY_AI_RESULT = {
  avg_sentiment: 24,
  total_ai_calls: 37,
  ai_containment_percent: 62,
  total_ai_chats: 54,
  transferred_calls: 14,
  ai_receptionist_performance: {
    handled_ai_only: 23,
    transfer_to_agent_percent: 38,
    avg_duration_sec: 96,
    lead_captured_counts: 11,
  },
  aht_buckets: [
    { label: '0-2m', count: 17, percent: 46 },
    { label: '2-5m', count: 12, percent: 32 },
    { label: '5-10m', count: 6, percent: 16 },
    { label: '10-15m', count: 2, percent: 6 },
    { label: '>15m', count: 0, percent: 0 },
  ],
  voice_vs_text_interactions: { voice_count: 53, text_count: 38, voice_percent: 58, text_percent: 42 },
  sentiment_buckets: [
    { label: 'Positive', count: 21, percent: 57 },
    { label: 'Neutral', count: 10, percent: 27 },
    { label: 'Negative', count: 6, percent: 16 },
  ],
  intent_count: {
    billing: 14,
    support: 11,
    sales: 8,
    scheduling: 4,
  },
} as const;

/** Shaped like the socket AI wallboard's `agents` list read by
 *  `speech-text-tab.tsx`. */
export const DUMMY_AI_AGENTS = [
  {
    agent_name: 'Alex Turner',
    agent_extension: '2001',
    agent_status: 'AVAILABLE',
    sentiment_label: 'positive',
    today_sentiment_calls: 14,
    avg_sentiment: 31,
    sentiment_counts: { positive_percent: 64, neutral_percent: 27, negative_percent: 9 },
  },
  {
    agent_name: 'Priya Nair',
    agent_extension: '2002',
    agent_status: 'AVAILABLE',
    sentiment_label: 'positive',
    today_sentiment_calls: 11,
    avg_sentiment: 18,
    sentiment_counts: { positive_percent: 55, neutral_percent: 31, negative_percent: 14 },
  },
  {
    agent_name: 'Sam Rivera',
    agent_extension: '2003',
    agent_status: 'BUSY',
    sentiment_label: 'neutral',
    today_sentiment_calls: 12,
    avg_sentiment: 12,
    sentiment_counts: { positive_percent: 42, neutral_percent: 36, negative_percent: 22 },
  },
] as const;
