import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowDownLeft,
  ArrowUpRight,
  Bot,
  Ear,
  Headset,
  Hourglass,
  Mic,
  Phone,
  PhoneForwarded,
  PhoneOff,
  Route,
  Search,
  Users,
  X,
  type LucideIcon,
} from 'lucide-react';
import { useUsersDirectory } from '@/hooks/use-users-directory';
import { getUserNameByExtension } from '@/lib/extension-utility';
import { MONITOR_ACTION_LABELS } from '@/lib/monitoring-actions';
import { getInitials } from '@/lib/utils';
import { CallPathDialog, getContextPathValues } from '@/pages/monitoring/call-path-cell';
import {
  getMonitoringCallTimestamp,
  isMonitoringCallForForwardValue,
} from '@/pages/monitoring/live-call-helpers';
import useMonitorActions, { type MonitorBlock } from '@/pages/monitoring/use-monitor-actions';
import {
  AGENT_GROUP_OF_STATE,
  countAgentGroups,
  getAgentLiveState,
  type AgentGroupKey,
} from './agent-rows';
import type { QueueMembership } from './agents-tab';
import { formatSecsToClock } from './format';
import { formatElapsed, useNow } from './use-now';
import './perf-surface.css';
import './live-floor.css';

/* ---------------------------------------------------------------------------
   Performance ▸ Live — every call in progress, as it happens.

   Nothing here is sampled or date-ranged: the calls, who is on them and who is
   signed in all come from the live socket feed, so a quiet moment reads as
   quiet. The one ranged figure, average handle time, only ever comes from
   real calls and is labelled with its range.
   --------------------------------------------------------------------------- */

type LiveState = 'connected' | 'hold' | 'ringing' | 'waiting';
type Direction = 'inbound' | 'outbound' | 'other';
type PartyKind = 'contact' | 'agent' | 'ai' | 'waiting' | 'conference' | 'route';
type Party = { kind: PartyKind; name: string; detail?: string; mark?: string };

type LiveCall = {
  key: string;
  call: any;
  state: LiveState;
  direction: Direction;
  since: number | null;
  from: Party;
  to: Party;
  /** Route and line, shown on the connector between the two parties. */
  hop: string[];
  queueUuid: string | null;
  queueName: string | null;
  agentName: string | null;
  contactName: string;
  /** A team member's extension is on the call — the only calls monitoring can join. */
  hasAgentLeg: boolean;
  isAi: boolean;
  haystack: string;
  hasPath: boolean;
};

type RosterRow = {
  key: string;
  name: string;
  extension?: string;
  status: string;
  group: AgentGroupKey;
  callKey: string | null;
  since: number | null;
  matchKeys: string[];
};

const STATE_OF_STATUS: Record<string, LiveState> = {
  answered: 'connected',
  bridged: 'connected',
  on_hold: 'hold',
  hold: 'hold',
  ringing: 'ringing',
  early: 'ringing',
  connecting: 'ringing',
  trying: 'ringing',
  started: 'ringing',
  waiting: 'waiting',
};

const LIVE_STATES: { key: LiveState; label: string; phrase: string }[] = [
  { key: 'connected', label: 'Connected', phrase: 'connected' },
  { key: 'hold', label: 'On hold', phrase: 'on hold' },
  { key: 'ringing', label: 'Ringing', phrase: 'ringing' },
  { key: 'waiting', label: 'Waiting', phrase: 'waiting for an agent' },
];
const STATE_LABEL = Object.fromEntries(LIVE_STATES.map((state) => [state.key, state.label])) as Record<
  LiveState,
  string
>;

/** Calls nobody has picked up yet come first. */
const STATE_ORDER: Record<LiveState, number> = { waiting: 0, ringing: 1, hold: 2, connected: 3 };

/* The arrows carry the direction, so the buttons say just "In" and "Out" and
   the filters and search keep to one row; the full word is the tooltip. */
const DIRECTIONS: { key: Direction | 'all'; label: string; short?: string; icon?: LucideIcon }[] = [
  { key: 'all', label: 'Both ways' },
  { key: 'inbound', label: 'Inbound', short: 'In', icon: ArrowDownLeft },
  { key: 'outbound', label: 'Outbound', short: 'Out', icon: ArrowUpRight },
];

const TEAM_GROUPS: { key: AgentGroupKey; label: string }[] = [
  { key: 'live', label: 'On a call' },
  { key: 'available', label: 'Available' },
  { key: 'away', label: 'Away' },
  { key: 'offline', label: 'Offline' },
];
const GROUP_ORDER: Record<AgentGroupKey, number> = { live: 0, available: 1, away: 2, offline: 3 };

const STATUS_WORD: Record<string, string> = {
  'On Call': 'On a call',
  Ringing: 'Ringing',
  'On Hold': 'On hold',
  Available: 'Available',
  Busy: 'Busy',
  'Do Not Disturb': 'Do not disturb',
  Offline: 'Offline',
};

const MONITOR_BUTTONS: {
  code: string;
  access: 'listen' | 'whisper' | 'barge' | 'intercept';
  icon: LucideIcon;
  tip: string;
}[] = [
  { code: '*87', access: 'listen', icon: Ear, tip: 'Listen without being heard' },
  { code: '*86', access: 'whisper', icon: Mic, tip: 'Whisper to the agent only' },
  { code: '*88', access: 'barge', icon: Users, tip: 'Barge into the conversation' },
  { code: '*89', access: 'intercept', icon: PhoneForwarded, tip: 'Intercept and take the call' },
];

const PARTY_ICON: Record<PartyKind, LucideIcon> = {
  contact: Phone,
  agent: Headset,
  ai: Bot,
  waiting: Hourglass,
  conference: Users,
  route: Route,
};

/** The same breach line the KPI band grades the longest wait on. */
const WAIT_LIMIT_SECS = 120;
const ROSTER_ROWS = 8;
const QUEUE_ROWS = 6;
const LATEST = Number.MAX_SAFE_INTEGER;

const stateOf = (call: any): LiveState =>
  STATE_OF_STATUS[String(call?.status || '').toLowerCase()] ||
  (call?.call_type === 'conference' ? 'connected' : 'ringing');

const callKeyOf = (call: any) =>
  String(
    call?.call_uuid ||
      call?.b_leg_uuid ||
      call?.uuid ||
      [call?.caller_number, call?.called_number, call?.start_time].filter(Boolean).join('|'),
  );

/** Four digits or fewer is an extension, anything longer a phone number — the test monitoring uses. */
const isExtension = (value: string) => /^\d{1,4}$/.test(value);

const markOf = (name: string) => {
  const letters = name.replace(/[^\p{L}\s]/gu, ' ').trim();
  return letters ? getInitials(letters) : undefined;
};

const capitalise = (value: string) => (value ? value[0].toUpperCase() + value.slice(1) : value);

const earliest = <T extends { since: number | null }>(items: T[]) =>
  items.reduce<T | null>(
    (first, item) =>
      item.since !== null && (!first || item.since < (first.since ?? LATEST)) ? item : first,
    null,
  );

const summaryOf = (counts: Record<LiveState, number>) => {
  const parts = LIVE_STATES.filter((state) => counts[state.key]).map(
    (state) => `${counts[state.key]} ${state.phrase}`,
  );
  if (!parts.length) return 'Nothing is ringing, connected or waiting right now.';
  if (parts.length === 1) return `${parts[0]}.`;
  return `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}.`;
};

const blockNote = (
  block: Exclude<MonitorBlock, null>,
  state: LiveState,
  pendingCode: string | null,
  hasExtension: boolean,
) => {
  switch (block) {
    case 'not-connected':
      return state === 'hold' ? 'Monitoring resumes off hold' : 'Monitoring opens once answered';
    case 'external':
      return 'Both ends are outside numbers';
    case 'own':
      return hasExtension ? 'You’re on this call' : 'Not available for this call';
    case 'pending':
      return pendingCode
        ? `Starting ${(MONITOR_ACTION_LABELS[pendingCode] || 'monitoring').toLowerCase()}…`
        : 'You’re monitoring this call';
    case 'busy':
      return 'Finish your call to monitor';
    default:
      return '';
  }
};

/* ---- live readouts: each reads the page's one shared clock ---- */

const Elapsed = ({ since, overAfter }: { since: number | null; overAfter?: number }) => {
  const now = useNow();
  if (since === null) return <>—</>;
  const seconds = Math.max(0, (now - since) / 1000);
  const isOver = overAfter !== undefined && seconds >= overAfter;
  return <span className={isOver ? 'lv-over' : undefined}>{formatElapsed(seconds)}</span>;
};

/**
 * How far along a call is against the account's own average handle time — the
 * mark is the average, the bar ends at twice it. A waiting call is measured
 * against the two-minute wait line instead.
 */
const Pace = ({
  since,
  state,
  avgHandleSec,
  rangePhrase,
}: {
  since: number | null;
  state: LiveState;
  avgHandleSec: number | null;
  rangePhrase: string;
}) => {
  const now = useNow();
  if (since === null) return null;
  const seconds = Math.max(0, (now - since) / 1000);

  if (state === 'waiting') {
    const isOver = seconds >= WAIT_LIMIT_SECS;
    return (
      <div
        className={`lv-pace${isOver ? ' is-over' : ''}`}
        title="Waits are flagged after two minutes, the line the service figures are graded on."
      >
        <span className="lv-pace-track">
          <i style={{ width: `${Math.min(1, seconds / WAIT_LIMIT_SECS) * 100}%` }} />
        </span>
        <em>{isOver ? 'Over 2 min' : 'Wait · 2 min'}</em>
      </div>
    );
  }

  if ((state === 'connected' || state === 'hold') && avgHandleSec && avgHandleSec > 0) {
    const isOver = seconds > avgHandleSec;
    const average = formatSecsToClock(avgHandleSec);
    return (
      <div
        className={`lv-pace has-mark${isOver ? ' is-over' : ''}`}
        title={`Average handle time ${rangePhrase}: ${average}. The mark is the average; the bar ends at twice it.`}
      >
        <span className="lv-pace-track">
          <i style={{ width: `${Math.min(1, seconds / (avgHandleSec * 2)) * 100}%` }} />
          <b aria-hidden="true" />
        </span>
        <em>{isOver ? 'Past average' : `Avg ${average}`}</em>
      </div>
    );
  }

  return null;
};

const PartyRow = ({ party }: { party: Party }) => {
  const Icon = PARTY_ICON[party.kind];
  return (
    <li className="lv-party">
      <span className={`lv-node is-${party.kind}`} aria-hidden="true">
        {party.mark || <Icon />}
      </span>
      <div>
        <b title={party.name}>{party.name}</b>
        {party.detail && <small>{party.detail}</small>}
      </div>
    </li>
  );
};

type Monitor = ReturnType<typeof useMonitorActions>;

const CallTile = ({
  item,
  monitor,
  avgHandleSec,
  rangePhrase,
  isFocused,
  onPath,
  tileRef,
}: {
  item: LiveCall;
  monitor: Monitor;
  avgHandleSec: number | null;
  rangePhrase: string;
  isFocused: boolean;
  onPath: (call: any) => void;
  tileRef: (node: HTMLElement | null) => void;
}) => {
  // Hanging up ends a customer's call, so it takes a second, deliberate click.
  const [isConfirming, setIsConfirming] = useState(false);
  useEffect(() => {
    if (!isConfirming) return undefined;
    const timeout = setTimeout(() => setIsConfirming(false), 4000);
    return () => clearTimeout(timeout);
  }, [isConfirming]);

  const { call, state } = item;
  const allowed = MONITOR_BUTTONS.filter((button) => monitor.access?.[button.access]);
  const canHangUp = Boolean(monitor.access?.hangup);
  const hasActions = allowed.length > 0 || canHangUp;
  // Monitoring joins an agent's leg, so a call with no one from the team on it
  // (still in the IVR, or with the AI assistant) has nothing to join.
  const baseBlock = hasActions ? monitor.blockOf(call) : null;
  const block =
    !hasActions || item.hasAgentLeg || baseBlock === 'not-connected' ? baseBlock : 'no-agent';
  const note =
    block === 'no-agent'
      ? item.isAi
        ? 'With the AI assistant'
        : 'No agent on this call yet'
      : block
        ? blockNote(block, state, monitor.pendingCodeOf(call), Boolean(monitor.myExtension))
        : null;
  const DirectionIcon = item.direction === 'inbound' ? ArrowDownLeft : ArrowUpRight;

  return (
    <article ref={tileRef} className={`lv-call${isFocused ? ' is-focus' : ''}`} data-state={state}>
      <header className="lv-call-top">
        <span className="lv-state">
          <i aria-hidden="true" />
          {STATE_LABEL[state]}
        </span>
        {item.direction !== 'other' && (
          <span className="lv-dir">
            <DirectionIcon aria-hidden="true" />
            {item.direction === 'inbound' ? 'Inbound' : 'Outbound'}
          </span>
        )}
        <span className="lv-clock">
          <Elapsed since={item.since} />
        </span>
      </header>

      <ol className="lv-route">
        <PartyRow party={item.from} />
        <li className="lv-hop">{item.hop.join(' · ')}</li>
        <PartyRow party={item.to} />
      </ol>

      <Pace since={item.since} state={state} avgHandleSec={avgHandleSec} rangePhrase={rangePhrase} />

      {(hasActions || item.hasPath) && (
        <footer className="lv-call-foot">
          {!block && allowed.length > 0 && (
            <div className="lv-acts" role="group" aria-label="Monitor this call">
              {allowed.map(({ code, icon: Icon, tip }) => (
                <button
                  key={code}
                  type="button"
                  className="lv-act"
                  data-tip={tip}
                  aria-label={MONITOR_ACTION_LABELS[code]}
                  onClick={() => monitor.monitorCall(code, call)}
                >
                  <Icon aria-hidden="true" />
                </button>
              ))}
            </div>
          )}
          {note && <p className="lv-blocked">{note}</p>}
          <div className="lv-foot-end">
            {item.hasPath && (
              <button type="button" className="lv-path" onClick={() => onPath(call)}>
                <Route aria-hidden="true" />
                Path
              </button>
            )}
            {canHangUp && !block && (
              <button
                type="button"
                className={`lv-hang${isConfirming ? ' is-confirm' : ''}`}
                data-tip={isConfirming ? 'Click again to end the call' : 'Hang up'}
                aria-label={isConfirming ? 'Confirm: end this call' : 'Hang up'}
                onClick={() => {
                  if (!isConfirming) {
                    setIsConfirming(true);
                    return;
                  }
                  setIsConfirming(false);
                  monitor.hangup(call);
                }}
              >
                <PhoneOff aria-hidden="true" />
                {isConfirming && <span>End call</span>}
              </button>
            )}
          </div>
        </footer>
      )}
    </article>
  );
};

type LiveInteractionsTabProps = {
  /** Calls in progress, already narrowed to active ones by the live hook. */
  calls: any[];
  queues: QueueMembership[];
  usersOnlineStatus: any[];
  /** The account roster. Only who is who is read from it — never its ranged stats. */
  agentRows: any[];
  isAgentsLoading?: boolean;
  /** Average handle time for the selected range from real calls, or null when there are none. */
  avgHandleSec: number | null;
  rangePhrase: string;
};

const LiveInteractionsTab = ({
  calls,
  queues,
  usersOnlineStatus,
  agentRows,
  isAgentsLoading = false,
  avgHandleSec,
  rangePhrase,
}: LiveInteractionsTabProps) => {
  const { users: directoryUsers = [] } = useUsersDirectory();
  const monitor = useMonitorActions();

  const [stateFilter, setStateFilter] = useState<LiveState | 'all'>('all');
  const [directionFilter, setDirectionFilter] = useState<Direction | 'all'>('all');
  const [queueFilter, setQueueFilter] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [pathCall, setPathCall] = useState<any>(null);
  const [focus, setFocus] = useState<{ key: string; at: number } | null>(null);
  const [showAllTeam, setShowAllTeam] = useState(false);
  const [showAllQueues, setShowAllQueues] = useState(false);
  const tileNodes = useRef(new Map<string, HTMLElement>());

  const roster = useMemo<RosterRow[]>(
    () =>
      agentRows.map((agent: any, index: number) => {
        const extension = agent?.extension ? String(agent.extension) : undefined;
        const { status, call } = getAgentLiveState(extension, usersOnlineStatus, calls);
        const name =
          `${agent?.first_name || ''} ${agent?.last_name || ''}`.trim() ||
          (extension ? `Ext ${extension}` : 'Unnamed user');
        return {
          key: String(agent?.uuid || extension || `agent-${index}`),
          name,
          extension,
          status,
          group: AGENT_GROUP_OF_STATE[status] || 'offline',
          callKey: call ? callKeyOf(call) : null,
          since: call ? getMonitoringCallTimestamp(call) : null,
          matchKeys: [agent?.uuid, agent?.user_uuid, extension].filter(Boolean).map(String),
        };
      }),
    [agentRows, usersOnlineStatus, calls],
  );

  const liveCalls = useMemo<LiveCall[]>(() => {
    const agentByCall = new Map<string, RosterRow>();
    roster.forEach((row) => {
      if (row.callKey && !agentByCall.has(row.callKey)) agentByCall.set(row.callKey, row);
    });
    const partyOfNumber = (value: unknown, fallback: string): Party => {
      const number = String(value ?? '').trim();
      if (!number) return { kind: 'contact', name: fallback };
      if (!isExtension(number)) return { kind: 'contact', name: number };
      const name = getUserNameByExtension(directoryUsers, number, '');
      return name
        ? { kind: 'agent', name, detail: `Ext ${number}`, mark: markOf(name) }
        : { kind: 'agent', name: `Ext ${number}` };
    };
    const seen = new Set<string>();

    return calls
      .map((call: any, index: number): LiveCall => {
        const baseKey = callKeyOf(call) || `live-${index}`;
        const key = seen.has(baseKey) ? `${baseKey}#${index}` : baseKey;
        seen.add(key);

        const state = stateOf(call);
        const rawDirection = String(call?.direction || '').toLowerCase();
        const direction: Direction =
          rawDirection === 'inbound' || rawDirection === 'outbound' ? rawDirection : 'other';

        const number = String(
          (direction === 'outbound' ? call?.called_number : call?.caller_number) ?? '',
        ).trim();
        const contactName = String(call?.contact_name ?? '').trim();
        const contact: Party =
          contactName && contactName !== number
            ? { kind: 'contact', name: contactName, detail: number || undefined, mark: markOf(contactName) }
            : {
                kind: 'contact',
                name: number || (direction === 'outbound' ? 'Unknown number' : 'Unknown caller'),
              };

        const rosterAgent = agentByCall.get(baseKey);
        const agentExtension = String(call?.agent_extension ?? '').trim();
        const agent: Party | null = rosterAgent
          ? {
              kind: 'agent',
              name: rosterAgent.name,
              detail: rosterAgent.extension ? `Ext ${rosterAgent.extension}` : undefined,
              mark: markOf(rosterAgent.name),
            }
          : isExtension(agentExtension)
            ? partyOfNumber(agentExtension, '')
            : null;

        const queue = queues.find(
          (item) => item.uuid && isMonitoringCallForForwardValue(call, item.uuid),
        );
        const queueName = queue?.name || null;
        const isAi = String(call?.forward_type || '').toUpperCase() === 'AI';
        const route =
          queueName ||
          String(call?.campaign_name || '').trim() ||
          capitalise(String(call?.current_context || '').trim()) ||
          null;
        const calledNumber = String(call?.called_number ?? '').trim();
        const callerNumber = String(call?.caller_number ?? '').trim();

        let from: Party;
        let to: Party;
        if (call?.call_type === 'conference') {
          const members = call?.conference_members || call?.conferenceData?.conference_members;
          const count = Array.isArray(members) ? members.length : 0;
          from = {
            kind: 'conference',
            name: 'Conference',
            detail: count ? `${count} on the line` : undefined,
          };
          to = agent || contact;
        } else if (state === 'waiting') {
          from = contact;
          to = {
            kind: 'waiting',
            name: 'Waiting for an agent',
            detail: queueName ? `In ${queueName}` : undefined,
          };
        } else if (direction === 'outbound') {
          from =
            agent ||
            (isExtension(callerNumber)
              ? partyOfNumber(callerNumber, '')
              : { kind: 'agent', name: 'Unknown agent' });
          to = contact;
        } else if (direction === 'inbound') {
          from = contact;
          to =
            agent ||
            (isAi
              ? { kind: 'ai', name: 'AI assistant' }
              : isExtension(calledNumber)
                ? partyOfNumber(calledNumber, '')
                : { kind: 'route', name: route || 'In the call flow' });
        } else {
          from = partyOfNumber(callerNumber, 'Unknown');
          to = partyOfNumber(calledNumber, 'Unknown');
        }

        const line = String(call?.did_number ?? '').trim();
        const routeShownOnParty = to.kind === 'route' || (to.kind === 'waiting' && queueName);
        const hop = [
          route && !routeShownOnParty ? `via ${route}` : null,
          line ? `Line ${line}` : null,
        ].filter(Boolean) as string[];

        return {
          key,
          call,
          state,
          direction,
          since: getMonitoringCallTimestamp(call),
          from,
          to,
          hop,
          queueUuid: queue?.uuid ? String(queue.uuid) : null,
          queueName,
          agentName: agent?.name || null,
          contactName: contact.name,
          hasAgentLeg:
            Boolean(rosterAgent) || [agentExtension, calledNumber, callerNumber].some(isExtension),
          isAi,
          haystack: [from.name, from.detail, to.name, to.detail, route, line, agentExtension]
            .filter(Boolean)
            .join(' ')
            .toLowerCase(),
          hasPath: Boolean(
            String(call?.current_context || '').trim() ||
              getContextPathValues(call?.context_path).length,
          ),
        };
      })
      .sort(
        (a, b) =>
          STATE_ORDER[a.state] - STATE_ORDER[b.state] || (a.since ?? LATEST) - (b.since ?? LATEST),
      );
  }, [calls, roster, directoryUsers, queues]);

  const counts = useMemo(() => {
    const result: Record<LiveState, number> = { connected: 0, hold: 0, ringing: 0, waiting: 0 };
    liveCalls.forEach((item) => {
      result[item.state] += 1;
    });
    return result;
  }, [liveCalls]);
  const total = liveCalls.length;
  const inbound = liveCalls.filter((item) => item.direction === 'inbound').length;
  const outbound = liveCalls.filter((item) => item.direction === 'outbound').length;
  const longestCall = earliest(
    liveCalls.filter((item) => item.state === 'connected' || item.state === 'hold'),
  );
  const longestWait = earliest(liveCalls.filter((item) => item.state === 'waiting'));
  const liveCallKeys = useMemo(() => new Set(liveCalls.map((item) => item.key)), [liveCalls]);

  const team = useMemo(() => countAgentGroups(roster), [roster]);
  const signedIn = roster.length - team.offline;
  const isTeamPending = isAgentsLoading && !roster.length;
  const sortedRoster = useMemo(
    () =>
      [...roster].sort(
        (a, b) =>
          GROUP_ORDER[a.group] - GROUP_ORDER[b.group] ||
          (a.group === 'live' ? (a.since ?? LATEST) - (b.since ?? LATEST) : 0) ||
          a.name.localeCompare(b.name),
      ),
    [roster],
  );
  const shownRoster = showAllTeam
    ? sortedRoster
    : sortedRoster.filter((row) => row.group !== 'offline').slice(0, ROSTER_ROWS);

  const queueRows = useMemo(
    () =>
      queues
        .map((queue, index) => {
          const uuid = queue.uuid ? String(queue.uuid) : null;
          const queueCalls = uuid ? liveCalls.filter((item) => item.queueUuid === uuid) : [];
          const waiting = queueCalls.filter((item) => item.state === 'waiting');
          const members = roster.filter((row) =>
            row.matchKeys.some((matchKey) => queue.memberKeys.includes(matchKey)),
          );
          return {
            key: uuid || `queue-${index}`,
            uuid,
            name: queue.name || 'Untitled queue',
            waiting: waiting.length,
            talking: queueCalls.length - waiting.length,
            longestWait: earliest(waiting),
            members: members.length,
            free: members.filter((row) => row.group === 'available').length,
          };
        })
        .sort(
          (a, b) => b.waiting - a.waiting || b.talking - a.talking || a.name.localeCompare(b.name),
        ),
    [queues, liveCalls, roster],
  );
  const busyQueues = queueRows.filter((row) => row.waiting + row.talking > 0).length;
  const shownQueues = showAllQueues ? queueRows : queueRows.slice(0, QUEUE_ROWS);
  const queueFilterName = queueRows.find((row) => row.uuid === queueFilter)?.name;

  const needle = query.trim().toLowerCase();
  const visibleCalls = liveCalls.filter(
    (item) =>
      (stateFilter === 'all' || item.state === stateFilter) &&
      (directionFilter === 'all' || item.direction === directionFilter) &&
      (!queueFilter || item.queueUuid === queueFilter) &&
      (!needle || item.haystack.includes(needle)),
  );
  const isFiltered =
    stateFilter !== 'all' || directionFilter !== 'all' || Boolean(queueFilter) || Boolean(needle);

  const clearFilters = () => {
    setStateFilter('all');
    setDirectionFilter('all');
    setQueueFilter(null);
    setQuery('');
  };

  // Picking someone on the team brings their call into view, clearing any
  // filter that would have hidden it.
  const focusCall = (key: string) => {
    clearFilters();
    setFocus({ key, at: Date.now() });
  };
  useEffect(() => {
    if (!focus) return undefined;
    tileNodes.current.get(focus.key)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    const timeout = setTimeout(() => setFocus(null), 1800);
    return () => clearTimeout(timeout);
  }, [focus]);

  return (
    <div className="pf-wrap lv-wrap">
      {/* ---- the pulse: the floor in one reading ---- */}
      <section className={`lv-pulse${total ? '' : ' is-quiet'}`} aria-label="The floor right now">
        <div className="lv-pulse-lead">
          <p className="lv-live">
            <span className="lv-beacon" aria-hidden="true" />
            Right now
            <em>{total ? 'Updates as calls change' : 'Listening for calls'}</em>
          </p>
          <div className="lv-total">
            <b>{total}</b>
            <div>
              <strong>{total === 1 ? 'call in progress' : 'calls in progress'}</strong>
              <span>{summaryOf(counts)}</span>
            </div>
          </div>
        </div>

        <div className="lv-pulse-mix">
          <div
            className="lv-ribbon"
            role="img"
            aria-label={
              total
                ? LIVE_STATES.map((state) => `${counts[state.key]} ${state.label.toLowerCase()}`).join(', ')
                : 'No calls in progress'
            }
          >
            {LIVE_STATES.filter((state) => counts[state.key]).map((state) => (
              <i key={state.key} data-state={state.key} style={{ flex: `${counts[state.key]} 1 0` }} />
            ))}
          </div>
          <ul className="lv-mix-keys">
            {LIVE_STATES.map((state) => (
              <li key={state.key} data-state={state.key}>
                <span>
                  <i aria-hidden="true" />
                  {state.label}
                </span>
                <b>{counts[state.key]}</b>
                <em>{total ? `${Math.round((counts[state.key] / total) * 100)}%` : ''}</em>
              </li>
            ))}
          </ul>
        </div>

        <dl className="lv-readouts">
          <div>
            <dt>Direction</dt>
            <dd className="lv-dirs">
              <ArrowDownLeft aria-hidden="true" />
              {inbound}
              <ArrowUpRight aria-hidden="true" />
              {outbound}
            </dd>
            <small>{total ? `${inbound} inbound, ${outbound} outbound` : 'No calls either way'}</small>
          </div>
          <div>
            <dt>Longest call</dt>
            <dd>{longestCall ? <Elapsed since={longestCall.since} /> : '—'}</dd>
            <small>
              {longestCall
                ? [longestCall.agentName, longestCall.contactName].filter(Boolean).join(' with ')
                : 'Nobody is on a call'}
            </small>
          </div>
          <div>
            <dt>Longest wait</dt>
            <dd>
              {longestWait ? <Elapsed since={longestWait.since} overAfter={WAIT_LIMIT_SECS} /> : '—'}
            </dd>
            <small>
              {longestWait
                ? longestWait.queueName
                  ? `${longestWait.contactName} in ${longestWait.queueName}`
                  : longestWait.contactName
                : 'Nobody is waiting'}
            </small>
          </div>
          <div>
            <dt>Team on calls</dt>
            <dd>
              {isTeamPending ? '—' : team.live}
              {!isTeamPending && <em>{team.live === 1 ? 'agent' : 'agents'}</em>}
            </dd>
            <small>
              {isTeamPending
                ? 'Loading the team'
                : `${signedIn} signed in · ${team.available} available`}
            </small>
          </div>
        </dl>
      </section>

      {/* ---- one row of filters and search, over the calls and the rail ---- */}
      <header className="lv-toolbar">
        <div className="lv-toolbar-title">
          <h3>In progress</h3>
          <span>{isFiltered ? `${visibleCalls.length} of ${total}` : total}</span>
        </div>
        {total > 0 && (
          <>
            <div className="lv-seg" role="group" aria-label="Filter by state">
              <button
                type="button"
                className={`lv-seg-btn${stateFilter === 'all' ? ' is-on' : ''}`}
                aria-pressed={stateFilter === 'all'}
                onClick={() => setStateFilter('all')}
              >
                All <b>{total}</b>
              </button>
              {LIVE_STATES.map((state) => (
                <button
                  key={state.key}
                  type="button"
                  data-state={state.key}
                  className={`lv-seg-btn${stateFilter === state.key ? ' is-on' : ''}`}
                  aria-pressed={stateFilter === state.key}
                  onClick={() => setStateFilter(state.key)}
                >
                  <i aria-hidden="true" />
                  {state.label} <b>{counts[state.key]}</b>
                </button>
              ))}
            </div>
            <div className="lv-seg" role="group" aria-label="Filter by direction">
              {DIRECTIONS.map(({ key, label, short, icon: Icon }) => (
                <button
                  key={key}
                  type="button"
                  className={`lv-seg-btn${directionFilter === key ? ' is-on' : ''}`}
                  aria-pressed={directionFilter === key}
                  aria-label={label}
                  title={short ? label : undefined}
                  onClick={() => setDirectionFilter(key)}
                >
                  {Icon && <Icon aria-hidden="true" />}
                  {short || label}
                </button>
              ))}
            </div>
            {queueFilter && (
              <button
                type="button"
                className="lv-token"
                onClick={() => setQueueFilter(null)}
                aria-label={`Stop filtering by ${queueFilterName || 'queue'}`}
              >
                {queueFilterName || 'Queue'}
                <X aria-hidden="true" />
              </button>
            )}
            <label className="pf-search lv-search">
              <Search aria-hidden="true" />
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search caller, agent or line"
                aria-label="Search calls in progress"
              />
            </label>
          </>
        )}
      </header>

      <div className="lv-main">
        {/* ---- the calls ---- */}
        <section className="lv-calls" aria-label="Calls in progress">
          {!total ? (
            <div className="lv-empty">
              <span className="lv-radar" aria-hidden="true">
                <i />
                <i />
                <i />
                <b />
              </span>
              <h4>The floor is quiet</h4>
              <p>
                No calls are in progress. Each one appears here the moment it starts ringing, with
                listen, whisper and barge ready once it connects.
              </p>
            </div>
          ) : !visibleCalls.length ? (
            <div className="lv-empty">
              <h4>No calls match</h4>
              <p>
                {total} {total === 1 ? 'call is' : 'calls are'} in progress, but none fit these
                filters.
              </p>
              <button type="button" className="lv-clear" onClick={clearFilters}>
                Show all calls
              </button>
            </div>
          ) : (
            <div className="lv-grid">
              {visibleCalls.map((item) => (
                <CallTile
                  key={item.key}
                  item={item}
                  monitor={monitor}
                  avgHandleSec={avgHandleSec}
                  rangePhrase={rangePhrase}
                  isFocused={focus?.key === item.key}
                  onPath={setPathCall}
                  tileRef={(node) => {
                    if (node) tileNodes.current.set(item.key, node);
                    else tileNodes.current.delete(item.key);
                  }}
                />
              ))}
            </div>
          )}
        </section>

        {/* ---- the rail: who is here, and where calls are queueing ---- */}
        <aside className="lv-rail">
          <section className="lv-card" aria-label="Team">
            <header className="lv-card-head">
              <h3>Team</h3>
              <span>{isTeamPending ? 'Loading…' : `${signedIn} of ${roster.length} signed in`}</span>
            </header>
            <div
              className="lv-team-bar"
              role="img"
              aria-label={TEAM_GROUPS.map((group) => `${team[group.key]} ${group.label.toLowerCase()}`).join(', ')}
            >
              {!isTeamPending &&
                TEAM_GROUPS.filter((group) => team[group.key]).map((group) => (
                  <i key={group.key} data-group={group.key} style={{ flex: `${team[group.key]} 1 0` }} />
                ))}
            </div>
            <ul className="lv-team-keys">
              {TEAM_GROUPS.map((group) => (
                <li key={group.key} data-group={group.key}>
                  <i aria-hidden="true" />
                  {group.label}
                  <b>{isTeamPending ? '—' : team[group.key]}</b>
                </li>
              ))}
            </ul>
            {shownRoster.length ? (
              <ul className="lv-roster">
                {shownRoster.map((row) => {
                  const body = (
                    <>
                      <span className="lv-avatar" aria-hidden="true">
                        {markOf(row.name) || '#'}
                        <i />
                      </span>
                      <span className="lv-agent-text">
                        <b>{row.name}</b>
                        <small>
                          {[row.extension ? `Ext ${row.extension}` : null, STATUS_WORD[row.status] || row.status]
                            .filter(Boolean)
                            .join(' · ')}
                        </small>
                      </span>
                      {row.since !== null && (
                        <span className="lv-agent-clock">
                          <Elapsed since={row.since} />
                        </span>
                      )}
                    </>
                  );
                  return (
                    <li key={row.key}>
                      {row.callKey && liveCallKeys.has(row.callKey) ? (
                        <button
                          type="button"
                          className="lv-agent"
                          data-group={row.group}
                          onClick={() => focusCall(row.callKey as string)}
                          aria-label={`${row.name}, ${STATUS_WORD[row.status] || row.status}. Show the call`}
                        >
                          {body}
                        </button>
                      ) : (
                        <div className="lv-agent" data-group={row.group}>
                          {body}
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="lv-card-empty">
                {isTeamPending
                  ? 'Loading the team…'
                  : roster.length
                    ? 'Nobody is signed in right now.'
                    : 'No users on this account yet.'}
              </p>
            )}
            {(showAllTeam || shownRoster.length < sortedRoster.length) && (
              <button type="button" className="lv-more" onClick={() => setShowAllTeam((value) => !value)}>
                {showAllTeam ? 'Show fewer' : `Show all ${sortedRoster.length}`}
              </button>
            )}
          </section>

          <section className="lv-card" aria-label="Queues">
            <header className="lv-card-head">
              <h3>Queues</h3>
              <span>{queueRows.length ? `${busyQueues} with calls` : ''}</span>
            </header>
            {queueRows.length ? (
              <ul className="lv-qlist">
                {shownQueues.map((row) => {
                  const hasCalls = row.waiting + row.talking > 0;
                  const body = (
                    <>
                      <span className="lv-queue-name">{row.name}</span>
                      <span className={`lv-queue-wait${row.waiting ? ' has-wait' : ''}`}>
                        {row.waiting ? `${row.waiting} waiting` : 'No wait'}
                      </span>
                      <small>
                        {row.talking} on {row.talking === 1 ? 'a call' : 'calls'}
                        {' · '}
                        {row.members ? `${row.free} of ${row.members} free` : 'No members'}
                        {row.longestWait && (
                          <>
                            {' · longest '}
                            <Elapsed since={row.longestWait.since} overAfter={WAIT_LIMIT_SECS} />
                          </>
                        )}
                      </small>
                    </>
                  );
                  return (
                    <li key={row.key}>
                      {hasCalls && row.uuid ? (
                        <button
                          type="button"
                          className={`lv-queue${queueFilter === row.uuid ? ' is-on' : ''}`}
                          aria-pressed={queueFilter === row.uuid}
                          onClick={() =>
                            setQueueFilter((current) => (current === row.uuid ? null : row.uuid))
                          }
                        >
                          {body}
                        </button>
                      ) : (
                        <div className="lv-queue">{body}</div>
                      )}
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="lv-card-empty">No queues on this account yet.</p>
            )}
            {queueRows.length > QUEUE_ROWS && (
              <button type="button" className="lv-more" onClick={() => setShowAllQueues((value) => !value)}>
                {showAllQueues ? 'Show fewer' : `Show all ${queueRows.length}`}
              </button>
            )}
          </section>
        </aside>
      </div>

      <CallPathDialog call={pathCall} onClose={() => setPathCall(null)} />
    </div>
  );
};

export default LiveInteractionsTab;
