import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useCompanyFeatures } from '@/hooks/rbac';
import { useDialpad } from '@/hooks/use-dialpad';
import { useSocketEvents } from '@/hooks/use-socket-events';
import { useUser } from '@/hooks/use-user';
import { handleAlert } from '@/lib/utils';
import {
  MONITOR_ACTION_LABELS,
  getMonitorTargetCallId,
  isDialpadMonitoringSessionActiveForCall,
  normalizeMonitorDialValue,
} from '@/lib/monitoring-actions';

/** How long a started monitor action holds its lock if no session appears. */
const PENDING_LOCK_MS = 10000;

/**
 * Why a supervisor can't act on a call right now, or null when they can.
 *
 * - `not-connected` — ringing, waiting or on hold; only a connected call can be joined.
 * - `external` — both ends are outside numbers, so there is no agent leg to join.
 * - `own` — the supervisor is one of the parties.
 * - `pending` — an action on this call has started and its session hasn't settled.
 * - `busy` — the supervisor is already on another call.
 */
export type MonitorBlock = 'not-connected' | 'external' | 'own' | 'pending' | 'busy' | null;

/**
 * Listen, whisper, barge, intercept and hang up on a live call, for
 * Performance ▸ Live. It applies the same plan permissions, eligibility rules
 * and one-action-per-call lock as Monitoring ▸ All Extensions, and adds the
 * reason a call is blocked so the view can say it instead of hiding the actions.
 */
export const useMonitorActions = () => {
  const { user } = useUser();
  const { features } = useCompanyFeatures();
  const { makeCall, sessions } = useDialpad();
  const { socketEventsManager } = useSocketEvents();
  const access = features?.plan_features?.monitoring_features?.action;
  const myExtension = user?.user_info?.extension;

  const lockTimeoutsRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const [pendingActions, setPendingActions] = useState<Record<string, string>>({});

  const clearPendingLock = useCallback((callId: string) => {
    const normalizedCallId = normalizeMonitorDialValue(callId);
    if (!normalizedCallId) return;

    const existingTimeout = lockTimeoutsRef.current[normalizedCallId];
    if (existingTimeout) {
      clearTimeout(existingTimeout);
      delete lockTimeoutsRef.current[normalizedCallId];
    }

    setPendingActions((prev) => {
      if (!prev[normalizedCallId]) return prev;
      const next = { ...prev };
      delete next[normalizedCallId];
      return next;
    });
  }, []);

  const setPendingLock = useCallback(
    (callId: string, code: string) => {
      const normalizedCallId = normalizeMonitorDialValue(callId);
      if (!normalizedCallId) return;

      clearPendingLock(normalizedCallId);
      setPendingActions((prev) => ({ ...prev, [normalizedCallId]: code }));
      lockTimeoutsRef.current[normalizedCallId] = setTimeout(() => {
        clearPendingLock(normalizedCallId);
      }, PENDING_LOCK_MS);
    },
    [clearPendingLock],
  );

  const hasActiveSessionForCall = useCallback(
    (callId: string) => isDialpadMonitoringSessionActiveForCall(sessions, callId),
    [sessions],
  );

  const hasAnyActiveCallSession = useMemo(
    () =>
      Object.values(sessions || {}).some(
        (session: any) => !['ended', 'failed'].includes(String(session?.status || '').toLowerCase()),
      ),
    [sessions],
  );

  // A lock is released as soon as the dialpad reports the session it was holding for.
  useEffect(() => {
    Object.keys(pendingActions).forEach((callId) => {
      if (hasActiveSessionForCall(callId)) clearPendingLock(callId);
    });
  }, [pendingActions, hasActiveSessionForCall, clearPendingLock]);

  useEffect(() => {
    const timeouts = lockTimeoutsRef.current;
    return () => {
      Object.values(timeouts).forEach((timeout) => clearTimeout(timeout));
    };
  }, []);

  const blockOf = useCallback(
    (call: any): MonitorBlock => {
      if (!call || !['bridged', 'answered'].includes(call?.status)) return 'not-connected';
      if (call?.called_number?.length > 4 && call?.agent_extension?.length > 4) return 'external';
      if ([call?.agent_extension, call?.called_number].includes(myExtension)) return 'own';
      const callId = normalizeMonitorDialValue(getMonitorTargetCallId(call));
      if (pendingActions[callId] || hasActiveSessionForCall(callId)) return 'pending';
      if (hasAnyActiveCallSession) return 'busy';
      return null;
    },
    [myExtension, pendingActions, hasActiveSessionForCall, hasAnyActiveCallSession],
  );

  /** The action code that is starting on this call, if one is. */
  const pendingCodeOf = useCallback(
    (call: any) => pendingActions[normalizeMonitorDialValue(getMonitorTargetCallId(call))] || null,
    [pendingActions],
  );

  const monitorCall = useCallback(
    (code: string, call: any) => {
      const normalizedCallId = normalizeMonitorDialValue(getMonitorTargetCallId(call));
      if (!normalizedCallId) return;

      if (pendingActions[normalizedCallId] || hasActiveSessionForCall(normalizedCallId)) {
        const activeActionCode = pendingActions[normalizedCallId] || code;
        handleAlert({
          text: `${MONITOR_ACTION_LABELS[activeActionCode] || 'Monitoring'} is already active for this call. Please finish it before starting another action.`,
          type: 'warning',
        });
        return;
      }

      setPendingLock(normalizedCallId, code);
      makeCall(`${code}${normalizedCallId}`);
    },
    [pendingActions, hasActiveSessionForCall, setPendingLock, makeCall],
  );

  const hangup = useCallback(
    (call: any) => {
      const callId = call?.direction === 'outbound' ? call?.call_uuid : call?.b_leg_uuid;
      socketEventsManager?.emit('call-hangup', { data: { call_uuid: callId } });
    },
    [socketEventsManager],
  );

  return { access, myExtension, blockOf, pendingCodeOf, monitorCall, hangup };
};

export default useMonitorActions;
