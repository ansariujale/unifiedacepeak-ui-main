/* "How calls reach you" — the panel the Profile page's own subtitle promised.
 *
 * Extension, direct number and location used to be repeated here as summary
 * cards, but the form below this panel already shows all three (Workplace and
 * Contact sections), so this panel now only answers the question those fields
 * cannot: what actually happens when a call comes in and nobody picks up.
 *
 * A note on levels, because getting this wrong is silent. `getUserDetails`
 * returns `{ user_info, call_forwarding, settings, greetings, ... }`. Only the
 * name, extension, phone and location live under `user_info`; the call rules
 * and greetings are its siblings at the root. Reading `user_info.call_forwarding`
 * yields `undefined`, which does not throw — it just makes every judgement
 * below come out as "nothing is set".
 */

import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, Info, Voicemail } from 'lucide-react';
import { evaluateUser } from '@/lib/call-standard';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

interface HowCallsReachYouProps {
  /** `call_forwarding` from the response root — a sibling of `user_info`, not a field on it. */
  callForwarding?: unknown;
  /** `greetings` from the response root. Arrives as an object or as a JSON string. */
  greetings?: unknown;
}

const asObject = (value: unknown): any => {
  if (!value) return {};
  if (typeof value === 'object') return value;
  try {
    return JSON.parse(String(value) || '{}');
  } catch {
    return {};
  }
};

const HowCallsReachYou = ({ callForwarding, greetings }: HowCallsReachYouProps) => {
  const coverage = useMemo(
    () => evaluateUser({ call_forwarding: callForwarding }),
    [callForwarding],
  );

  const greetingsData = asObject(greetings);

  const voicemail = greetingsData?.voicemail;
  const greetingSet = Boolean(voicemail?.value) && voicemail?.enabled !== false;
  const voicemailGreeting = greetingSet ? String(voicemail?.label || '').trim() : '';

  const covered = coverage.state === 'covered';

  /* Briefly self-reveals on load, the same as the page header's tooltip, so
     the icon reads as interactive before anyone has hovered it. */
  const [showHint, setShowHint] = useState(true);
  useEffect(() => {
    const timer = setTimeout(() => setShowHint(false), 700);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="acepeak-panel-soft rounded-xl border border-gray-200 p-3">
      <div className="flex items-center gap-1.5">
        <p className="acepeak-heading text-sm font-semibold text-gray-900">How calls reach you</p>
        <Tooltip open={showHint || undefined}>
          <TooltipTrigger asChild>
            <button
              type="button"
              className="acepeak-info-trigger inline-flex h-4 w-4 items-center justify-center rounded-full text-gray-400"
              aria-label="What this panel shows"
            >
              <Info className="h-3.5 w-3.5" />
            </button>
          </TooltipTrigger>
          <TooltipContent className="acepeak-tooltip-content" side="right" align="center" textWrap="pretty">
            Where a call comes in, and what happens if you do not pick it up.
          </TooltipContent>
        </Tooltip>
      </div>

      {/* The consequence of missing a call is the part people are actually
          unsure about. The heading covers every answer this can give,
          including the one where forwarding means the phone never rings at all. */}
      <div
        className={`mt-2.5 flex items-start gap-2 rounded-lg border p-3 ${
          covered ? 'border-green-200 bg-green-50' : 'border-amber-200 bg-amber-50'
        }`}
      >
        {covered ? (
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-green-600" />
        ) : (
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
        )}
        <div className="min-w-0">
          {/* <p className="text-xs font-semibold text-gray-900">When someone calls you</p> */}
          <p className="text-xs text-gray-700">{coverage.detail}</p>
          {covered && voicemailGreeting && (
            <p className="mt-1 inline-flex items-center gap-1 text-xs text-gray-600">
              <Voicemail className="h-3.5 w-3.5" />
              Callers hear: {voicemailGreeting}
            </p>
          )}
          <p className="mt-1 text-xs text-gray-500">
            Change this under <span className="font-medium">My Account → My Phone</span>.
          </p>
        </div>
      </div>
    </div>
  );
};

export default HowCallsReachYou;