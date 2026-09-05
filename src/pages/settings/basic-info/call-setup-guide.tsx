import { Link } from 'react-router-dom';
import { useGetAssignedDIDNumbers } from '@/hooks/common';
import { Ic, McmIconSprite } from '@/components/mcm/icons';

/**
 * "How your calls reach you" — the setup this profile is actually for.
 *
 * On its own this screen is a name, a photo and an extension, with nothing
 * saying what any of it does. The questions people arrive with are which number
 * rings them, what happens when they miss a call, and what a caller hears — and
 * every one of those is answered somewhere else in Admin.
 *
 * So rather than explaining the settings in the abstract, this reads the
 * person's own configuration and tells them where they stand, with a link to
 * the screen that changes each one. A checklist that reports real state is
 * worth more than help text, because it can say "this one is not set up" — and
 * that is the failure people cannot otherwise see. A number that drops calls
 * looks identical to one that works until somebody rings it.
 */

type Step = {
  title: string;
  /** What is true right now, in the person's own configuration. */
  status: string;
  ok: boolean;
  /** Why this step exists at all, for someone meeting it the first time. */
  explain: string;
  action?: { label: string; to: string };
};

const asObject = (value: unknown): any => {
  if (!value) return {};
  if (typeof value === 'object') return value;
  try {
    return JSON.parse(String(value) || '{}');
  } catch {
    return {};
  }
};

const CallSetupGuide = ({ userInfo }: { userInfo: any }) => {
  const info = userInfo?.user_info || {};
  const extension = String(info?.extension || '').trim();

  const { data: assignedNumbers = [] } = useGetAssignedDIDNumbers(info?.uuid || userInfo?.uuid);

  const rules = asObject(userInfo?.call_forwarding);
  const greetings = asObject(userInfo?.greetings);

  const failureAction = rules?.incoming_calls?.failure_action;
  const fallbackSet = Boolean(failureAction?.type) && failureAction?.enabled !== false;
  const fallbackIsVoicemail = String(failureAction?.type || '') === 'VOICEMAIL';

  const voicemailGreeting = greetings?.voicemail;
  const greetingSet = Boolean(voicemailGreeting?.value) && voicemailGreeting?.enabled !== false;

  const numbers = (assignedNumbers as any[]) || [];

  const steps: Step[] = [
    {
      title: 'Your extension',
      status: extension ? `Colleagues reach you on ${extension}` : 'No extension assigned yet',
      ok: Boolean(extension),
      explain: 'Your internal number.',
      action: extension ? undefined : { label: 'Ask an admin', to: '/admin-settings/people' },
    },
    {
      title: 'Numbers that ring you',
      status: numbers.length
        ? numbers
            .slice(0, 3)
            .map((row: any) => row?.did_number)
            .filter(Boolean)
            .join(', ') + (numbers.length > 3 ? ` and ${numbers.length - 3} more` : '')
        : 'No outside number points here yet',
      ok: numbers.length > 0,
      explain: 'Add a number for outside callers.',
      action: { label: 'Numbers', to: '/admin-settings/numbers/in-use' },
    },
    {
      title: 'When you do not answer',
      status: fallbackSet
        ? fallbackIsVoicemail
          ? 'Callers are sent to your voicemail'
          : `Callers fall back to ${String(failureAction?.type || '').toLowerCase()}`
        : 'Nothing is set, so callers are hung up on',
      ok: fallbackSet,
      explain: 'Choose what happens to missed calls.',
      action: { label: 'Set it on My Phone', to: '/admin-settings/account/phone' },
    },
    {
      title: 'What callers hear',
      status: greetingSet
        ? `Your greeting: ${voicemailGreeting?.label || 'set'}`
        : 'No greeting, so callers get a bare tone',
      ok: greetingSet,
      explain: 'Add a greeting for callers.',
      action: { label: 'Greetings', to: '/admin-settings/account/greetings' },
    },
  ];

  const outstanding = steps.filter((step) => !step.ok).length;

  return (
    <section className="mcm-setupguide">
      <McmIconSprite />
      <header>
        <div>
          <h2 className="acepeak-heading">How your calls reach you</h2>
          <p>{outstanding ? 'Finish these so no call gets missed.' : "You're all set."}</p>
        </div>
        <span className={`mcm-setupguide-pill${outstanding ? ' warn' : ''}`}>
          {outstanding ? `${outstanding} to finish` : 'All set'}
        </span>
      </header>

      <ol>
        {steps.map((step) => (
          <li key={step.title} className={step.ok ? 'ok' : 'todo'}>
            <span className="mcm-setupguide-mark" aria-hidden>
              <Ic n={step.ok ? 'check' : 'alert'} size={13} />
            </span>
            <div className="mcm-setupguide-body">
              <div className="acepeak-setupguide-titlerow">
                <h3>{step.title}</h3>
                {step.action && (
                  <Link className="mcm-setupguide-action" to={step.action.to}>
                    {step.action.label}
                  </Link>
                )}
              </div>
              <p className="mcm-setupguide-status">{step.status}</p>
              <p className="mcm-setupguide-explain">{step.explain}</p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
};

export default CallSetupGuide;
