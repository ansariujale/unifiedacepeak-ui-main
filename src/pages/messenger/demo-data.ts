/* ============================================================================
 * DEMO DATA — sample Website and All Channels conversations, shown only when
 * the real list is empty, following the same rules as the phone console and
 * agent-chat demo modules:
 *   1. Obviously synthetic — fixed names, ids prefixed `demo-`.
 *   2. The list that renders it also renders a "Demo data" chip.
 *   3. Real data always wins — these never mix in alongside real rows.
 * ==========================================================================*/

const minutesAgo = (minutes: number) => new Date(Date.now() - minutes * 60_000).toISOString();

export type DemoWebsiteRow = {
  id: string;
  visitor_name: string;
  visitor_email: string;
  page_url: string;
  owner: 'ai' | 'human';
  assistant_name: string;
  last_message: string;
  last_message_at: string;
};

export const demoWebsiteChats: DemoWebsiteRow[] = [
  {
    id: 'demo-web-1',
    visitor_name: 'Priya Nair',
    visitor_email: 'priya.nair@example.com',
    page_url: 'https://ajoxi.com/pricing',
    owner: 'ai',
    assistant_name: 'Sales Assistant',
    last_message: 'Hi — is the annual plan still discounted?',
    last_message_at: minutesAgo(6),
  },
  {
    id: 'demo-web-2',
    visitor_name: 'Tom Whitfield',
    visitor_email: 'tom.whitfield@example.com',
    page_url: 'https://ajoxi.com/checkout',
    owner: 'human',
    assistant_name: 'Support Assistant',
    last_message: 'My card was declined but the order went through?',
    last_message_at: minutesAgo(19),
  },
  {
    id: 'demo-web-3',
    visitor_name: 'Marco Bianchi',
    visitor_email: 'marco.bianchi@example.com',
    page_url: 'https://ajoxi.com/billing',
    owner: 'ai',
    assistant_name: 'Billing Assistant',
    last_message: 'Can you send the invoice to a different address?',
    last_message_at: minutesAgo(48),
  },
];

export type DemoAllChannelsRow = {
  id: string;
  kind: 'internal' | 'captain';
  name: string;
  preview: string;
  timestamp: string;
};

export const demoAllChannelsChats: DemoAllChannelsRow[] = [
  {
    id: 'demo-ac-1',
    kind: 'internal',
    name: 'Sophia Turner',
    preview: 'Sounds good, see you at 3!',
    timestamp: minutesAgo(4),
  },
  {
    id: 'demo-ac-2',
    kind: 'captain',
    name: 'Daniel Osei',
    preview: 'Anyone there? I’ll try again later.',
    timestamp: minutesAgo(21),
  },
  {
    id: 'demo-ac-3',
    kind: 'internal',
    name: 'Rahul Verma',
    preview: 'Still waiting on the refund for order 48213-A.',
    timestamp: minutesAgo(37),
  },
  {
    id: 'demo-ac-4',
    kind: 'captain',
    name: 'Aiko Tanaka',
    preview: 'Never mind — found it in the help centre.',
    timestamp: minutesAgo(95),
  },
];
