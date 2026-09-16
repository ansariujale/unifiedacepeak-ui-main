import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import './index.css';
import { apiClient } from '@/services/api/axios';
import { UserContext } from '@/context/user-context';
import { DialpadContext } from '@/context/dialpad-context';
import { SocketEvents } from '@/context/socket-events-context';
import { UsersDirectoryContext } from '@/context/users-directory-context';
import Performance from '@/pages/performance';

const params = new URLSearchParams(window.location.search);
const mode = params.get('mode') || 'real'; // real | sample | notranscripts
const utcAgo = (minutes: number) => new Date(Date.now() - minutes * 60000).toISOString();

const transcripts: Record<string, any> = {
  't-1.json': { summary: 'Customer was charged twice for the March invoice. Agent confirmed the duplicate and raised a refund that should land in 3–5 days.', keywords: ['billing, refund', 'invoice'], sentiment: 'Negative', sentiment_scores: { positive: 0.1, neutral: 0.2, negative: 0.7 } },
  't-2.json': { summary: 'Caller asked how to add two more seats to their plan. Agent walked them through the admin page and they upgraded on the call.', keywords: 'seats; upgrade; billing', sentiment: 'Positive', sentiment_scores: { positive: 0.8, neutral: 0.15, negative: 0.05 } },
  't-3.json': { summary: 'Delivery was late; customer wanted a new date. Agent rebooked for Friday morning.', keywords: ['delivery', 'reschedule'], sentiment: 'neutral' },
  't-4.json': { summary: 'No summary available', keywords: [], sentiment_scores: { positive: 0.2, neutral: 0.6, negative: 0.2 } },
  't-5.json': { summary: 'Customer wanted to cancel after a price rise. Agent offered a loyalty discount, which they accepted.', keywords: ['cancellation', 'billing', 'discount'], sentiment: 'positive' },
  't-6.json': { summary: 'Router keeps dropping connection. Agent ran diagnostics and booked an engineer visit.', keywords: ['support', 'outage'], sentiment: 'negative' },
  't-7.json': { summary: 'Follow-up on engineer visit; issue fixed.', keywords: ['support'], sentiment: 'positive' },
};

const realFetch = window.fetch.bind(window);
window.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = String(typeof input === 'string' ? input : (input as any).url || input);
  const match = url.match(/recording\/(t-\d+\.json)$/);
  if (match) {
    if (match[1] === 't-7.json') return new Response('nope', { status: 404 });
    return new Response(JSON.stringify(transcripts[match[1]] || {}), { status: 200, headers: { 'Content-Type': 'application/json' } });
  }
  return realFetch(input as any, init);
}) as typeof window.fetch;

const withTranscripts = mode !== 'notranscripts';
const cdrRows = [
  { uuid: 'r1', direction: 'Inbound', start_stamp: utcAgo(14), caller_id_number: '+14155550142', to_display_name: 'Priya Shah', destination_number: '1001', billsectotal: 312, transcript_file: withTranscripts ? 't-1.json' : null, recording_file: 'r1.wav', status: 'SUCCESS' },
  { uuid: 'r2', direction: 'Inbound', start_stamp: utcAgo(46), caller_id_number: '+13105550123', forward_name: 'Sales', destination_number: '1002', billsectotal: 188, transcript_file: withTranscripts ? 't-2.json' : null, status: 'SUCCESS' },
  { uuid: 'r3', direction: 'Outbound', start_stamp: utcAgo(95), caller_id_number: '1003', from_display_name: 'Elena Novak', destination_number: '+12125550199', billsectotal: 97, transcript_file: withTranscripts ? 't-3.json' : null, status: 'SUCCESS' },
  { uuid: 'r4', direction: 'Inbound', start_stamp: utcAgo(130), caller_id_number: '+16465550111', to_display_name: 'Marcus Reed', billsec: '00:02:05', transcript_file: withTranscripts ? 't-4.json' : null, status: 'SUCCESS' },
  { uuid: 'r5', direction: 'Inbound', start_stamp: utcAgo(170), caller_id_number: '+19175550188', to_display_name: 'Priya Shah', billsectotal: 420, transcript_file: withTranscripts ? 't-5.json' : null, status: 'SUCCESS' },
  { uuid: 'r6', direction: 'Inbound', start_stamp: utcAgo(210), caller_id_number: '+14085550155', to_display_name: 'Grace Lin', billsectotal: 505, transcript_file: withTranscripts ? 't-6.json' : null, status: 'SUCCESS' },
  { uuid: 'r7', direction: 'Inbound', start_stamp: utcAgo(260), caller_id_number: '+14085550155', to_display_name: 'Grace Lin', billsectotal: 60, transcript_file: withTranscripts ? 't-7.json' : null, status: 'SUCCESS' },
  { uuid: 'r8', direction: 'Inbound', start_stamp: utcAgo(300), caller_id_number: '+15035550166', to_display_name: 'Priya Shah', billsectotal: 45, transcript_file: null, status: 'SUCCESS' },
];

apiClient.defaults.adapter = async (config: any) => {
  const url = String(config.url || '');
  const body = typeof config.data === 'string' ? JSON.parse(config.data || '{}') : config.data || {};
  let rows: any[] = [];
  if (url.includes('/api/tenant/report/call-list') && body?.type !== 'voicemail') rows = cdrRows;
  return { data: { data: { result: { rows, totalItems: rows.length, call_stats: { inbound_calls: 7, outbound_calls: 1 } } } }, status: 200, statusText: 'OK', headers: {}, config, request: {} } as any;
};

const liveAi = {
  data: {
    result: {
      total_ai_calls: 128,
      total_ai_chats: 64,
      ai_containment_percent: 71.4,
      transferred_calls: 37,
      avg_sentiment: -3.2,
      ai_receptionist_performance: { handled_ai_only: 91, transfer_to_agent_percent: 28.9, avg_duration_sec: 142, lead_captured_counts: 19 },
      voice_vs_text_interactions: { voice_count: 128, text_count: 64, voice_percent: 66.7, text_percent: 33.3 },
      sentiment_buckets: [
        { label: 'Excellent', count: 22, percent: 14 },
        { label: 'Good', count: 31, percent: 20 },
        { label: 'Neutral', count: 38, percent: 24 },
        { label: 'Poor', count: 36, percent: 23 },
        { label: 'Critical', count: 30, percent: 19 },
      ],
      aht_buckets: [
        { label: '0-2m', count: 51 },
        { label: '2-5m', count: 44 },
        { label: '5-10m', count: 22 },
        { label: '10-15m', count: 8 },
        { label: '>15m', count: 3 },
      ],
      intent_count: { billing: 48, technical_support: 36, cancellation: 19, delivery: 14, sales: 12, account_access: 9, feedback: 4, other: 2 },
    },
  },
};
const liveAgents = {
  data: {
    result: {
      agents: [
        { uuid: 'a1', agent_name: 'Aria (Front desk)', agent_extension: '3001', agent_status: 'AVAILABLE', sentiment_label: 'Negative', today_sentiment_calls: 74, avg_sentiment: -12.5, sentiment_counts: { positive_percent: 21, neutral_percent: 28, negative_percent: 51 } },
        { uuid: 'a2', agent_name: 'Nova (Billing bot)', agent_extension: '3002', ai_agent_status: 'ACTIVE', sentiment_label: 'Positive', today_sentiment_calls: 58, avg_sentiment: 18, sentiment_counts: { positive_percent: 62, neutral_percent: 25, negative_percent: 13 } },
        { uuid: 'a3', agent_name: 'Echo (After hours)', agent_extension: '3003', agent_status: 'OFFLINE', today_sentiment_calls: 0 },
      ],
      summary: { agent_sentiment_top: { agent_name: 'Nova (Billing bot)' }, agent_sentiment_bottom: { agent_name: 'Aria (Front desk)' } },
    },
  },
};

const user = {
  uuid: 'me',
  sip_credentials: { domain: 'example.acepeak' },
  user_info: { uuid: 'u-me', role: 'ADMIN', extension: '1099', first_name: 'Sam', last_name: 'Carter' },
  company_info: {
    uuid: 'company-1',
    plan_features: {
      advance_call_management: { access: { TRANSCRIPTION: mode !== 'notranscription' } },
      reports: { action: { call: true, sms: true, call_recording_listen: true } },
    },
  },
};

const requests: string[] = [];
(window as any).__requests = requests;
const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

createRoot(document.getElementById('root')!).render(
  <MemoryRouter initialEntries={['/performance?view=speech-text']}>
    <QueryClientProvider client={queryClient}>
      <UserContext.Provider value={{ user } as any}>
        <DialpadContext.Provider value={{ makeCall: () => true, sessions: {} } as any}>
          <SocketEvents.Provider
            value={{
              liveCalls: [],
              eventLiveCallsData: [],
              usersOnlineStatus: [],
              liveQueueCalls: [],
              campaignLiveCallsData: null,
              isSocketConnected: true,
              campaignAiLiveCallData: mode === 'sample' ? null : liveAi,
              aiLiveWallboardData: mode === 'sample' ? null : liveAgents,
              setAiLiveWallboardData: () => {},
              getAiLiveWallboardData: (payload: any, callback: any) => {
                requests.push(JSON.stringify(payload));
                if (callback) window.setTimeout(() => callback(mode === 'sample' ? null : liveAgents), 50);
              },
              socketEventsManager: { emit: () => {} },
            } as any}
          >
            <UsersDirectoryContext.Provider
              value={{ users: [], isLoading: false, isFetching: false, refetchUsers: () => {}, ensureUsersDirectory: () => {}, getUserProfileByUuid: () => '' }}
            >
              <div style={{ display: 'flex', height: '100vh' }}>
                <div style={{ width: 80, flex: 'none', background: '#fff', borderRight: '1px solid #e5e5e5' }} />
                <div style={{ flex: 1, minWidth: 0, height: '100%' }}>
                  <Performance />
                </div>
              </div>
            </UsersDirectoryContext.Provider>
          </SocketEvents.Provider>
        </DialpadContext.Provider>
      </UserContext.Provider>
    </QueryClientProvider>
  </MemoryRouter>,
);
