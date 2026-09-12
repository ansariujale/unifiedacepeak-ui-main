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
          - ai-receptionist/receptionist-analytics.tsx (analytics fill)
          - ai-agent/agent-analytics.tsx               (analytics fill)
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

/* ---------- Receptionist analytics ---------------------------------------- */

const ANALYTICS_TOPICS = [
  { name: 'Appointment booking', percentage: 28, description: 'Schedule, reschedule or cancel' },
  { name: 'Billing question', percentage: 21, description: 'Charges and payment queries' },
  { name: 'Order status', percentage: 17, description: 'Track or check order status' },
  { name: 'Opening hours', percentage: 13, description: 'Store or service timings' },
  { name: 'Technical issue', percentage: 12, description: 'Setup, login or product related' },
  { name: 'Refund request', percentage: 9, description: 'Return, refund or cancellation' },
];

/** A whole analytics payload, shaped the way the screen reads it. */
export const buildDummyAnalytics = (days = 8) => {
  const daily = Array.from({ length: days }, (_, index) => {
    const seed = index + 1;
    const date = new Date();
    date.setDate(date.getDate() - (days - 1 - index));
    return {
      date: date.toISOString().slice(0, 10),
      calls_handled: 48 + ((seed * 17) % 46),
      avg_sentiment: 58 + ((seed * 11) % 32),
    };
  });

  const totalCalls = daily.reduce((sum, day) => sum + day.calls_handled, 0);
  // how each day's calls ended; the range totals are the sums, so the KPI
  // strip and the daily outcomes chart always agree
  const dayOutcome = (day: { calls_handled: number }, index: number) => ({
    transfer: Math.max(1, Math.round(day.calls_handled * (0.08 + ((index * 3) % 5) * 0.012))),
    callback: Math.max(1, Math.round(day.calls_handled * (0.05 + ((index * 2) % 4) * 0.01))),
  });
  const transfers = daily.reduce((sum, day, index) => sum + dayOutcome(day, index).transfer, 0);
  const callbacks = daily.reduce((sum, day, index) => sum + dayOutcome(day, index).callback, 0);
  const resolved = totalCalls - transfers - callbacks;

  return {
    calls_handled: totalCalls,
    total_calls: totalCalls,
    resolution_rate: Math.round((resolved / totalCalls) * 100),
    average_call_duration: 168,
    handoffs: transfers,
    live_transfers: transfers,
    scheduled_callbacks: callbacks,
    csat: 4.3,
    avg_csat: 4.3,
    avg_sentiment: 72,
    outcome_breakdown: {
      resolved,
      live_transfer: transfers,
      scheduled_callback: callbacks,
    },
    // each day carries how its calls ended, so the daily outcomes columns
    // vary by day instead of repeating one ratio
    daily_breakdown: daily.map((day, index) => {
      const { transfer, callback } = dayOutcome(day, index);
      return {
        date: day.date,
        calls_handled: day.calls_handled,
        resolved: day.calls_handled - transfer - callback,
        live_transfer: transfer,
        scheduled_callback: callback,
      };
    }),
    // The sentiment card plots the positive / neutral / negative mix, so each
    // day carries the three shares as well as the averaged score.
    sentiment_trend: daily.map((day: any, index: number) => {
      const positive = Math.max(
        30,
        Math.min(82, Math.round(day.avg_sentiment * 0.82 + 12 + Math.sin(index / 1.9) * 4)),
      );
      const negative = Math.max(
        5,
        Math.min(32, Math.round(19 - index * 0.8 + Math.cos(index / 2.3) * 2.5)),
      );
      return {
        date: day.date,
        avg_sentiment: day.avg_sentiment,
        score: day.avg_sentiment,
        count: day.calls_handled,
        positive,
        negative,
        neutral: Math.max(0, 100 - positive - negative),
      };
    }),
    // what the same range scored last period, for the "compared to previous"
    // line under the chart
    previous_sentiment_score: Math.round(
      daily.reduce((sum: number, day: any) => sum + day.avg_sentiment, 0) / daily.length - 6,
    ),
    hour_of_day_breakdown: Array.from({ length: 24 }, (_, hour) => ({
      hour,
      // a working-hours curve rather than a flat line
      calls_handled:
        hour < 7 || hour > 20 ? 1 + (hour % 3) : Math.round(6 + 14 * Math.sin(((hour - 6) / 15) * Math.PI)),
    })),
    conversation_topics: ANALYTICS_TOPICS,
    agent_breakdown: DUMMY_RECEPTIONISTS.slice(0, 6).map((agent: any, index) => {
      const calls = 40 + index * 23;
      const handoffs = Math.round(calls * 0.1);
      return {
        agent_uuid: agent.agentId,
        id: agent.agentId,
        agent_name: agent.agentName,
        name: agent.agentName,
        total_calls: calls,
        calls_handled: calls,
        handoffs,
        resolved: calls - handoffs,
        scheduled_callbacks: Math.round(calls * 0.06),
        resolution_rate: 68 + ((index * 7) % 28),
        avg_confidence: 72 + ((index * 5) % 20),
        csat: Number((3.9 + (index % 6) * 0.18).toFixed(1)),
        // The CSAT column shows the move against the previous range, so it
        // needs the prior figure as well as the current one.
        previous_csat: Number(
          (3.9 + (index % 6) * 0.18 - [0.3, 0.2, -0.1, 0.1, -0.2][index % 5]).toFixed(1),
        ),
        avg_sentiment: 62 + ((index * 9) % 30),
        ai_talk_percentage: 38 + ((index * 6) % 16),
        // per-agent series behind the Trend sparkline
        daily_calls: Array.from({ length: 8 }, (_, day) =>
          Math.max(1, Math.round(calls / 8 + Math.sin((day + index) / 1.6) * (calls / 14))),
        ),
        // the Trend column plots resolution over the range and colours itself
        // by the direction this series takes
        daily_resolution: Array.from({ length: 8 }, (_, day) =>
          Math.max(
            35,
            Math.min(
              99,
              Math.round(
                68 +
                  ((index * 7) % 28) +
                  (day - 3.5) * [1.4, 0.9, -1.2, -0.6, 0][index % 5] +
                  Math.sin((day + index) / 2.1) * 2.2,
              ),
            ),
          ),
        ),
      };
    }),
  };
};

/* ---- Chat agent analytics (ai-agent/agent-analytics.tsx) ----
   Fills every section that screen reads. `scale` shrinks the whole set, so the
   previous-period query gets a slightly smaller copy and the deltas read
   naturally. Remove with this file. */
export const buildDummyChatAnalytics = (days = 8, scale = 1) => {
  const n = (value: number) => Math.round(value * scale);
  const agents = DUMMY_CHAT_AGENTS.slice(0, 6);

  const daily = Array.from({ length: days }, (_, index) => {
    const seed = index + 1;
    const date = new Date();
    date.setDate(date.getDate() - (days - 1 - index));
    const volume = n(64 + ((seed * 23) % 58));
    const handoffs = Math.round(volume * 0.09);
    const scheduled = Math.round(volume * 0.05);
    // the day's volume spread over its hours on a working-hours curve, so
    // the day-by-hour heatmap has something to draw
    const weights = Array.from({ length: 24 }, (_, hour) =>
      hour < 7 || hour > 21 ? 0.35 : 1.4 + 3.2 * Math.sin(((hour - 6) / 16) * Math.PI),
    );
    const weightSum = weights.reduce((sum, weight) => sum + weight, 0);
    return {
      date: date.toISOString().slice(0, 10),
      volume,
      resolved: volume - handoffs - scheduled,
      handoffs,
      scheduled_callbacks: scheduled,
      hourly_breakdown: weights.map((weight, hour) => ({
        hour,
        conversations: Math.max(
          0,
          Math.round((volume * weight) / weightSum + Math.sin(hour + index) * 0.8),
        ),
      })),
    };
  });
  const total = daily.reduce((sum, day) => sum + day.volume, 0);
  const handoffs = daily.reduce((sum, day) => sum + day.handoffs, 0);
  const scheduled = daily.reduce((sum, day) => sum + day.scheduled_callbacks, 0);
  const resolved = total - handoffs - scheduled;
  const positive = Math.round(total * 0.64);
  const negative = Math.round(total * 0.11);
  const neutral = total - positive - negative;
  const ofTotal = (value: number) => Math.round((value / (total || 1)) * 100);

  const share = (index: number) => [0.27, 0.21, 0.18, 0.14, 0.11, 0.09][index] ?? 0.05;
  const agentRows = agents.map((agent: any, index: number) => {
    const conversations = Math.round(total * share(index));
    return {
      agent_uuid: agent.agent_uuid,
      agent_name: agent.agentName,
      conversations,
      total_calls: conversations,
      resolution_rate: 72 + ((index * 7) % 24),
      handoffs: Math.round(conversations * (0.06 + (index % 3) * 0.03)),
      csat: Number((3.9 + (index % 5) * 0.2).toFixed(1)),
      avg_confidence: 74 + ((index * 5) % 20),
      average_response_time: 640 + ((index * 137) % 520),
      avg_sentiment: 62 + ((index * 9) % 30),
      sentiment_calls: Math.round(conversations * 0.8),
      // the label follows the score, as the real classifier's would
      sentiment_label: 62 + ((index * 9) % 30) >= 75 ? 'positive' : 'neutral',
    };
  });
  const performance = (factor: number) =>
    agentRows.map((row) => ({
      agent_uuid: row.agent_uuid,
      agent_name: row.agent_name,
      conversation: Math.round(row.conversations * factor),
      average_response_time: row.average_response_time,
      handoffs: Math.round(row.handoffs * factor),
      resolution_rate: row.resolution_rate,
      csat: row.csat,
    }));

  const channels: Array<[string, number]> = [
    ['Web widget', 0.46],
    ['WhatsApp', 0.24],
    ['Messenger', 0.12],
    ['Instagram', 0.09],
    ['Email', 0.06],
    ['Other', 0.03],
  ];
  const intents: Array<[string, number]> = [
    ['Pricing & plans', 0.24],
    ['Order status', 0.19],
    ['Account access', 0.16],
    ['Refund request', 0.13],
    ['Technical issue', 0.11],
    ['Opening hours', 0.09],
    ['Other', 0.08],
  ];
  const countries: Array<[string, string, number]> = [
    ['US', 'United States', 0.41],
    ['GB', 'United Kingdom', 0.17],
    ['IN', 'India', 0.14],
    ['CA', 'Canada', 0.09],
    ['AU', 'Australia', 0.07],
    ['DE', 'Germany', 0.05],
  ];
  const languages: Array<[string, number]> = [
    ['English', 68],
    ['Spanish', 12],
    ['Hindi', 8],
    ['French', 5],
    ['German', 4],
    ['Other', 3],
  ];
  const faqs: Array<[string, number]> = [
    ['How do I reset my password?', 0.18],
    ['Where is my order?', 0.15],
    ['Can I change my plan mid-month?', 0.12],
    ['Do you offer refunds?', 0.1],
    ['What are your support hours?', 0.08],
  ];

  return {
    conversations_handled: total,
    total_calls: total,
    resolution_rate: ofTotal(resolved),
    avg_confidence: 81,
    average_response_time: 742,
    handoffs,
    scheduled_callbacks: scheduled,
    csat: 4.3,
    avg_csat: 4.3,
    sentiment_calls: total,
    // the previous range scores a little lower, so the comparison line under
    // the sentiment chart has a move to report
    avg_sentiment: scale < 1 ? 65 : 71,
    sentiment_label: 'positive',
    sentiment_counts: { positive, neutral, negative },
    sentiment_breakdown: [
      { sentiment: 'positive', count: positive },
      { sentiment: 'neutral', count: neutral },
      { sentiment: 'negative', count: negative },
    ],
    daily_breakdown: daily,
    // the per-day mix behind the sentiment lines
    sentiment_trend: daily.map((day, index) => {
      const pos = Math.max(40, Math.min(85, Math.round(64 + Math.sin(index / 1.7) * 9 + index * 0.6)));
      const neg = Math.max(4, Math.min(28, Math.round(13 - index * 0.5 + Math.cos(index / 2.1) * 3)));
      return { date: day.date, positive: pos, negative: neg, neutral: Math.max(0, 100 - pos - neg) };
    }),
    agent_breakdown: agentRows,
    agent_performance_breakdown: {
      last_7_days: performance(1),
      last_30_days: performance(3.6),
    },
    channel_breakdown: channels.map(([channel, part]) => ({
      channel,
      conversations: Math.round(total * part),
      percentage: `${Math.round(part * 100)}%`,
    })),
    hour_of_day_breakdown: Array.from({ length: 24 }, (_, hour) => ({
      hour,
      conversations:
        hour < 7 || hour > 21
          ? n(2 + (hour % 4))
          : n(Math.round(9 + 22 * Math.sin(((hour - 6) / 16) * Math.PI))),
    })),
    resolution_breakdown: Array.from({ length: 8 }, (_, index) => ({
      week: `W${index + 1}`,
      percentage: `${70 + ((index * 5) % 18)}%`,
    })),
    top_user_intents: intents.map(([intent, part]) => ({
      intent,
      count: Math.round(total * part),
      percentage: `${Math.round(part * 100)}%`,
    })),
    country_breakdown: countries.map(([country, countryName, part]) => ({
      country,
      countryName,
      conversations: Math.round(total * part),
    })),
    language_breakdown: languages.map(([language, percentage]) => ({ language, percentage })),
    handoff_funnel: [
      { label: '1. Started by visitor', count: total, percentage: 100 },
      { label: '2. Got a confident answer', count: Math.round(total * 0.91), percentage: 91 },
      { label: '3. Resolved without handoff', count: resolved, percentage: ofTotal(resolved) },
      { label: '4. Asked for human', count: handoffs, percentage: ofTotal(handoffs) },
      { label: '5. Scheduled callback', count: scheduled, percentage: ofTotal(scheduled) },
    ],
    top_faqs: faqs.map(([question, part]) => ({
      question,
      count: Math.round(total * part),
      percentage: `${Math.round(part * 100)}%`,
    })),
    cost_usage_breakdown: {
      total_reply: Math.round(total * 3.4),
      total_spend: Number((total * 0.0042).toFixed(4)),
      agent_breakdown: agentRows.map((row) => ({
        agent_uuid: row.agent_uuid,
        agent_name: row.agent_name,
        total_reply: Math.round(row.conversations * 3.4),
        total_spend: Number((row.conversations * 0.0042).toFixed(4)),
      })),
    },
  };
};
