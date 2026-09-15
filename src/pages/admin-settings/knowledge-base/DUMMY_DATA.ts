/* ==========================================================================
   DUMMY DATA — FOR UI PREVIEW ONLY. DELETE THIS FILE TO REMOVE IT.
   --------------------------------------------------------------------------
   Nothing here talks to the API. Each list screen appends these rows to
   whatever the API returned, guarded by SHOW_DUMMY_DATA below.

   TO REMOVE EVERYTHING:
     1. Set SHOW_DUMMY_DATA to false (instant), or
     2. Delete this file and the four `DUMMY DATA` marked blocks that import
        from it:
          - ai-receptionist/new-ai-receptionist.tsx   (tableSelect)
          - ai-agent/ai-chatbot-agents.tsx            (selectTableAgents)
          - ai-bot-session/index.tsx                  (agentRows, sessions)
   ========================================================================== */

export const SHOW_DUMMY_DATA = true;

/** Marks every generated record, so dummy rows are easy to spot and filter. */
export const DUMMY_FLAG = '__dummy__';

const COMPANIES = [
  'Northwind Dental',
  'BrightPath Logistics',
  'Crestline Legal',
  'Vantage Auto',
  'Solstice Home Services',
  'Marigold Health',
  'Clearwater Financial',
  'Cobalt Retail',
  'Ironclad Security',
  'Lumen Studios',
  'Harborview Realty',
  'Pinecrest Clinic',
];

const RECEPTIONIST_NAMES = [
  'Front Desk Assistant',
  'After-Hours Concierge',
  'Appointment Booker',
  'Billing Line',
  'Overflow Support Line',
  'New Patient Intake',
  'Service Dispatch',
  'Sales Qualifier',
  'Renewals Desk',
  'Emergency Triage',
  'Order Status Line',
  'Reception Backup',
];

const CHAT_AGENT_NAMES = [
  'Website Support Bot',
  'Pricing Assistant',
  'Onboarding Concierge',
  'Returns & Refunds Bot',
  'Docs Helper',
  'Lead Qualifier',
  'Booking Assistant',
  'Troubleshooting Bot',
  'Account Help Bot',
  'Upgrade Advisor',
  'Shipping Tracker',
  'FAQ Assistant',
];

const SENTIMENTS = ['positive', 'neutral', 'negative'] as const;
const STATUSES = ['active', 'inactive', 'paused'] as const;

/** Deterministic pseudo-random, so the rows never reshuffle between renders. */
const pick = <T,>(list: readonly T[], seed: number) => list[seed % list.length];

const daysAgo = (days: number) => {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString();
};

/* ---------- AI Receptionists ------------------------------------------- */

export const DUMMY_RECEPTIONISTS = Array.from({ length: 22 }, (_, index) => {
  const seed = index + 1;
  const sentiment = pick(SENTIMENTS, seed);
  return {
    [DUMMY_FLAG]: true,
    agent_uuid: `dummy-receptionist-${seed}`,
    agentId: `dummy-receptionist-${seed}`,
    id: `dummy-receptionist-${seed}`,
    agentName: `${pick(RECEPTIONIST_NAMES, seed)} ${seed}`,
    name: `${pick(RECEPTIONIST_NAMES, seed)} ${seed}`,
    company_name: pick(COMPANIES, seed),
    domain: pick(COMPANIES, seed),
    status: pick(STATUSES, seed),
    agentStatus: pick(STATUSES, seed),
    did_uuid: [{ did_number: `+1555010${String(2000 + seed).padStart(4, '0')}` }],
    createdAt: daysAgo(seed * 2),
    updatedAt: daysAgo(seed),
    // Metric field names the list screen reads directly.
    calls_handled: 40 + seed * 7,
    calls_handled_7d: 12 + seed * 3,
    resolution_rate: 55 + ((seed * 3) % 40),
    average_call_duration: 90 + seed * 5,
    handoffs: seed % 4,
    confidence_count: 20 + seed,
    avg_confidence: 62 + ((seed * 4) % 30),
    sentiment,
    sentiment_label: sentiment,
    sentiment_calls: 18 + seed * 2,
    avg_sentiment:
      sentiment === 'positive' ? 78 + (seed % 12) : sentiment === 'neutral' ? 55 + (seed % 10) : 32 + (seed % 10),
    sentiment_counts: {
      positive: sentiment === 'positive' ? 14 + (seed % 6) : 4,
      neutral: sentiment === 'neutral' ? 11 + (seed % 5) : 3,
      negative: sentiment === 'negative' ? 9 + (seed % 4) : 2,
    },
    sentiment_scores: { [sentiment]: 60 + ((seed * 5) % 35) },
  };
});

/* ---------- Chat Agents -------------------------------------------------- */

export const DUMMY_CHAT_AGENTS = Array.from({ length: 22 }, (_, index) => {
  const seed = index + 1;
  const sentiment = pick(SENTIMENTS, seed + 1);
  return {
    [DUMMY_FLAG]: true,
    agent_uuid: `dummy-chat-agent-${seed}`,
    agentId: `dummy-chat-agent-${seed}`,
    id: `dummy-chat-agent-${seed}`,
    agentName: `${pick(CHAT_AGENT_NAMES, seed)} ${seed}`,
    name: `${pick(CHAT_AGENT_NAMES, seed)} ${seed}`,
    company_name: pick(COMPANIES, seed + 2),
    domain: pick(COMPANIES, seed + 2),
    status: pick(STATUSES, seed + 1),
    agentStatus: pick(STATUSES, seed + 1),
    createdAt: daysAgo(seed * 3),
    updatedAt: daysAgo(seed),
    // Metric field names the list screen reads directly.
    conversations: 25 + seed * 11,
    conversations_7d: 8 + seed * 4,
    resolution_rate: 50 + ((seed * 4) % 45),
    avg_confidence: 60 + ((seed * 3) % 35),
    confidence_count: 15 + seed,
    handoffs: seed % 3,
    sentiment,
    sentiment_label: sentiment,
    sentiment_calls: 16 + seed * 2,
    avg_sentiment:
      sentiment === 'positive' ? 80 + (seed % 10) : sentiment === 'neutral' ? 57 + (seed % 8) : 30 + (seed % 9),
    sentiment_counts: {
      positive: sentiment === 'positive' ? 13 + (seed % 5) : 3,
      neutral: sentiment === 'neutral' ? 10 + (seed % 4) : 3,
      negative: sentiment === 'negative' ? 8 + (seed % 4) : 2,
    },
    sentiment_scores: { [sentiment]: 55 + ((seed * 7) % 40) },
  };
});

/* ---------- Sessions ------------------------------------------------------ */

const INTENTS = [
  'Book appointment',
  'Billing question',
  'Order status',
  'Reschedule visit',
  'Pricing details',
  'Technical issue',
  'Refund request',
  'Opening hours',
];

const CONTACT_NAMES = [
  'Morgan Chase',
  'Priya Nair',
  'Diego Ramirez',
  'Hannah Cole',
  'Ken Watanabe',
  'Sofia Rossi',
  'Liam O’Connor',
  'Amara Okafor',
  'Noah Bennett',
  'Ines Duarte',
  'Tomas Novak',
  'Zara Haddad',
];

export const DUMMY_SESSIONS = Array.from({ length: 24 }, (_, index) => {
  const seed = index + 1;
  const isChat = seed % 2 === 0;
  const sentiment = pick(SENTIMENTS, seed);
  const outcomeSeed = seed % 4;

  return {
    [DUMMY_FLAG]: true,
    sessionId: `dummy-session-${seed}`,
    room: `dummy-room-${seed}`,
    channel: isChat ? 'chat' : 'call',
    sessionChannel: isChat ? 'chat' : 'call',
    agentId: isChat ? `dummy-chat-agent-${seed}` : `dummy-receptionist-${seed}`,
    agentName: isChat
      ? `${pick(CHAT_AGENT_NAMES, seed)} ${seed}`
      : `${pick(RECEPTIONIST_NAMES, seed)} ${seed}`,
    status: outcomeSeed === 0 ? 'active' : 'completed',
    handoff: outcomeSeed === 1,
    scheduledCallback: outcomeSeed === 2,
    startedAt: daysAgo(seed % 7),
    createdAt: daysAgo(seed % 7),
    duration: 45 + seed * 13,
    durationMs: (45 + seed * 13) * 1000,
    cost: Number((0.01 * seed).toFixed(2)),
    totalCostUSD: Number((0.01 * seed).toFixed(2)),
    summary: `${pick(INTENTS, seed)} handled end to end by the assistant.`,
    callerId: `+1555010${String(3000 + seed).padStart(4, '0')}`,
    collectedData: {
      name: { value: pick(CONTACT_NAMES, seed) },
      phone: { value: `+1555010${String(3000 + seed).padStart(4, '0')}` },
      email: { value: `${pick(CONTACT_NAMES, seed).split(' ')[0].toLowerCase()}@example.com` },
    },
    intents: [
      { intent_label: pick(INTENTS, seed), intent_summary: 'Captured from the conversation.' },
      { intent_label: pick(INTENTS, seed + 3), intent_summary: 'Secondary topic raised.' },
    ],
    sentiment,
    sentiment_scores: {
      positive: sentiment === 'positive' ? 78 : 30,
      neutral: sentiment === 'neutral' ? 64 : 25,
      negative: sentiment === 'negative' ? 58 : 12,
    },
  };
});
