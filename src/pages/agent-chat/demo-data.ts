/* ============================================================================
 * DEMO DATA — sample agent-chat conversations, for design review only.
 *
 * Same three rules the phone console's demo module follows, so nothing here
 * can be mistaken for a real visitor:
 *   1. Obviously synthetic — fixed names, ids prefixed `demo-`.
 *   2. Every list that renders it also renders a "Demo data" chip.
 *   3. Real data always wins. These only appear when the queue is empty, and
 *      are never mixed in alongside real conversations.
 *
 * TO TURN IT OFF: set DEMO_ENABLED to false. The queue then shows its honest
 * "All caught up!" state again and nothing else needs to change.
 * ==========================================================================*/

export const DEMO_ENABLED = true;

const minutesAgo = (minutes: number) => new Date(Date.now() - minutes * 60_000).toISOString();

type DemoAgentChat = {
  chatId: string;
  isGroupChat: boolean;
  users: { uuid: string; first_name: string; last_name: string; profile: string }[];
  lastMessage: { message: string; senderId: string; createdAt: string };
  metaData: Record<string, any>;
};

/* Session and contact details the visitor profile panel reads, so a sample
   chat fills that panel instead of showing "Not provided" against every row. */
const PROFILES: Record<string, { email: string; city: string; country: string; device: string; ip: string; page: string }> = {
  u1: { email: 'priya.nair@example.com', city: 'Mumbai', country: 'IN', device: 'Windows 11 - Chrome 128', ip: '49.36.180.22', page: 'https://ajoxi.com/pricing' },
  u2: { email: 'tom.whitfield@example.com', city: 'Leeds', country: 'UK', device: 'macOS - Safari 17', ip: '81.132.44.9', page: 'https://ajoxi.com/checkout' },
  a1: { email: 'rahul.verma@example.com', city: 'Pune', country: 'IN', device: 'Android 14 - Chrome 128', ip: '103.21.58.140', page: 'https://ajoxi.com/orders' },
  a2: { email: 'emily.clark@example.com', city: 'Austin', country: 'US', device: 'macOS - Chrome 128', ip: '73.162.10.44', page: 'https://ajoxi.com/support' },
  a3: { email: 'marco.bianchi@example.com', city: 'Milan', country: 'IT', device: 'iOS 18 - Safari', ip: '93.44.201.7', page: 'https://ajoxi.com/billing' },
  m1: { email: 'daniel.osei@example.com', city: 'Accra', country: 'GH', device: 'Windows 10 - Edge 128', ip: '154.160.7.61', page: 'https://ajoxi.com/contact' },
  m2: { email: 'aiko.tanaka@example.com', city: 'Osaka', country: 'JP', device: 'macOS - Chrome 127', ip: '126.208.33.19', page: 'https://ajoxi.com/help' },
};

const chat = (
  id: string,
  firstName: string,
  lastName: string,
  message: string,
  minutes: number,
): DemoAgentChat => {
  const visitorId = `demo-visitor-${id}`;
  const profile = PROFILES[id] || PROFILES.a1;
  return {
    chatId: `demo-agent-chat-${id}`,
    isGroupChat: false,
    users: [{ uuid: visitorId, first_name: firstName, last_name: lastName, profile: '' }],
    lastMessage: { message, senderId: visitorId, createdAt: minutesAgo(minutes) },
    metaData: {
      lastMessage: message,
      lastMessageTimeStamp: minutesAgo(minutes),
      email: profile.email,
      location: { city: profile.city, country: profile.country },
      device: profile.device,
      ipAddress: profile.ip,
      page: profile.page,
      visitorType: 'Website Visitor',
      pastTickets: PAST_TICKETS[id] || DEFAULT_PAST_TICKETS,
    },
  };
};

/* Sample support history shown in the visitor profile's Past Tickets section. */
const DEFAULT_PAST_TICKETS = [
  { id: '#1198', status: 'Resolved', date: 'Jul 22' },
  { id: '#1043', status: 'Resolved', date: 'Jun 09' },
];

const PAST_TICKETS: Record<string, { id: string; status: string; date: string }[]> = {
  u1: [
    { id: '#2451', status: 'Resolved', date: 'Aug 14' },
    { id: '#2210', status: 'Resolved', date: 'Jul 30' },
    { id: '#1987', status: 'Closed', date: 'Jun 18' },
  ],
  u2: [
    { id: '#2388', status: 'Resolved', date: 'Aug 02' },
    { id: '#2115', status: 'Closed', date: 'Jul 11' },
  ],
  a1: [
    { id: '#2502', status: 'Resolved', date: 'Aug 20' },
    { id: '#2299', status: 'Resolved', date: 'Jul 27' },
    { id: '#2044', status: 'Closed', date: 'Jun 30' },
  ],
  a2: [
    { id: '#2470', status: 'Resolved', date: 'Aug 16' },
    { id: '#2180', status: 'Resolved', date: 'Jul 19' },
  ],
  a3: [
    { id: '#2411', status: 'Resolved', date: 'Aug 08' },
    { id: '#2233', status: 'Closed', date: 'Jul 21' },
    { id: '#1995', status: 'Resolved', date: 'Jun 25' },
  ],
  m1: [{ id: '#2360', status: 'Resolved', date: 'Aug 01' }],
  m2: [
    { id: '#2477', status: 'Resolved', date: 'Aug 17' },
    { id: '#2201', status: 'Closed', date: 'Jul 15' },
  ],
};

/**
 * Sample conversations for a tab, shaped exactly as `ListItem` expects so the
 * rows render through the real component rather than a lookalike.
 *
 * The split is deliberate: an unassigned queue holds openers nobody has picked
 * up, an active one holds conversations mid-flow, and missed holds the ones
 * that timed out — so each tab reads like the thing it is.
 */
export const demoAgentChats = (tab: string): DemoAgentChat[] => {
  if (!DEMO_ENABLED) return [];

  if (tab === 'unassigned') {
    return [
      chat('u1', 'Priya', 'Nair', 'Hi — is the annual plan still discounted?', 2),
      chat('u2', 'Tom', 'Whitfield', 'My card was declined but the order went through?', 9),
    ];
  }

  if (tab === 'missed') {
    return [
      chat('m1', 'Daniel', 'Osei', 'Anyone there? I’ll try again later.', 64),
      chat('m2', 'Aiko', 'Tanaka', 'Never mind — found it in the help centre.', 132),
    ];
  }

  return [
    chat('a1', 'Rahul', 'Verma', 'Still waiting on the refund for order 48213-A.', 4),
    chat('a2', 'Emily', 'Clark', 'That worked, thank you! One more question…', 17),
    chat('a3', 'Marco', 'Bianchi', 'Can you send the invoice to a different address?', 41),
  ];
};

export default demoAgentChats;

/* ---------------------------------------------------------- conversation --
 * A short thread for a sample chat, so selecting one in the queue opens
 * something rather than an empty pane. Keyed off the chat id so each sample
 * reads as its own conversation, continuing the opener shown in the list.
 */
export type DemoAgentMessage = { id: string; fromVisitor: boolean; text: string; at: string };

const THREADS: Record<string, [boolean, string, number][]> = {
  'demo-agent-chat-u1': [
    [true, 'Hi — is the annual plan still discounted?', 12],
    [false, 'Hello! Yes, 20% off the annual plan runs until the end of the month.', 11],
    [true, 'Great. Does that apply if I upgrade from monthly?', 10],
    [false, 'It does — the discount is applied to the annual price at checkout.', 9],
    [true, 'And do I lose the days I’ve already paid for this month?', 7],
    [false, 'No, we credit the unused portion of your current month against the annual plan.', 6],
    [true, 'Perfect. Where do I switch it over?', 4],
    [false, 'Go to Billing → Plan → Switch to annual, and the discount shows before you confirm.', 3],
    [true, 'Found it, thank you so much!', 1],
    [false, 'Anytime! Shout if the discount doesn’t appear and I’ll sort it out.', 1],
  ],
  'demo-agent-chat-u2': [
    [true, 'My card was declined but the order went through?', 9],
    [false, 'Let me check that for you — could you confirm the last four digits?', 8],
    [true, 'Sure, it’s 4421.', 7],
    [false, 'Thanks. I can see one declined attempt and no successful charge on our side.', 6],
    [true, 'But my bank app shows a pending amount…', 5],
    [false, 'That’s a temporary authorisation hold — it’s released automatically in 3–5 days.', 4],
    [true, 'Ah okay. So the order didn’t actually place?', 3],
    [false, 'Correct, nothing was charged and no order was created. Want me to retry it for you?', 2],
    [true, 'Yes please, try the same card again.', 1],
    [false, 'Done — it went through this time. You’ll get a confirmation email shortly.', 1],
  ],
  'demo-agent-chat-a1': [
    [true, 'Still waiting on the refund for order 48213-A.', 12],
    [false, 'Sorry about the delay. I can see it was approved on the 3rd.', 11],
    [true, 'How long does it usually take to land?', 9],
    [false, 'Three to five working days from approval, so it should be with you today.', 8],
    [true, 'It’s not showing yet in my account.', 6],
    [false, 'It can appear as a separate line rather than reversing the original charge.', 5],
    [true, 'Let me look again… yes, I see it now. Thanks!', 3],
    [false, 'Great — glad it landed. Anything else I can help with?', 2],
    [true, 'No, that’s everything. Appreciate the help.', 1],
    [false, 'You’re welcome. Have a good one!', 1],
  ],
  'demo-agent-chat-a2': [
    [true, 'That worked, thank you! One more question…', 17],
    [false, 'Of course — go ahead.', 16],
    [true, 'Can I add a second agent seat to my plan?', 14],
    [false, 'Yes, seats are $12/month each and can be added anytime from Team settings.', 13],
    [true, 'Is it prorated for the rest of the cycle?', 11],
    [false, 'It is — you’ll only pay for the days remaining this month.', 10],
    [true, 'Nice. I’ll add one now.', 8],
    [false, 'The new seat is live — invite them from Team → Add member.', 6],
  ],
  'demo-agent-chat-a3': [
    [true, 'Can you send the invoice to a different address?', 41],
    [false, 'Certainly. What address should I use?', 39],
    [true, 'accounts@brightlabs.io please.', 37],
    [false, 'Updated. Should I also set that as the default for future invoices?', 35],
    [true, 'Yes, make it the default.', 33],
    [false, 'Done. I’ve re-sent this month’s invoice to that address too.', 31],
    [true, 'Brilliant, thanks for the quick help.', 29],
    [false, 'My pleasure — have a great day!', 28],
  ],
  'demo-agent-chat-m1': [
    [true, 'Hi, is anyone available to help?', 70],
    [true, 'I’m having trouble logging in.', 68],
    [true, 'Anyone there? I’ll try again later.', 64],
  ],
  'demo-agent-chat-m2': [
    [true, 'Where can I download my past invoices?', 140],
    [true, 'Never mind — found it in the help centre.', 132],
  ],
};

export const demoAgentMessages = (chatId: string): DemoAgentMessage[] => {
  if (!DEMO_ENABLED) return [];
  const thread = THREADS[chatId] || THREADS['demo-agent-chat-a1'];
  return thread.map(([fromVisitor, text, minutes], i) => ({
    id: `${chatId}-msg-${i}`,
    fromVisitor,
    text,
    at: new Date(Date.now() - minutes * 60_000).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    }),
  }));
};
