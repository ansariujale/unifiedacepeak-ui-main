import { useCallback, useEffect, useRef, useState } from 'react';
import { Info, Mic, PhoneOff, Volume2 } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

/* Console tokens — kept local so this card stays self-contained. */
/* Two shades lighter than Console red, used across this voice card */
const RED = '#EA4A52';
const RED_SOFT = '#FFF1F2';
const BORDER = '#E5E7EB';
const INK = '#111111';
const MUTED = '#6B7280';
const GREEN = '#22C55E';

type VoiceTestState = 'idle' | 'connecting' | 'active';

export type VoiceTestCardProps = {
  agentName: string;
  phoneNumber?: string;
  location?: string;
  /** Raised when the browser denies (or cannot provide) microphone access. */
  onError?: (message: string) => void;
  /** Called once the microphone is live, so the host can start a real session. */
  onTestStart?: () => void;
  onTestStop?: () => void;
};

const STATUS_LABEL: Record<VoiceTestState, string> = {
  idle: 'Ready',
  connecting: 'Connecting',
  active: 'Live',
};

/**
 * Voice-agent testing panel shown for the AI Receptionist tab.
 * The AI Chatbot tab keeps its own chat preview and never renders this.
 */
export default function VoiceTestCard({
  agentName,
  phoneNumber,
  location,
  onError,
  onTestStart,
  onTestStop,
}: VoiceTestCardProps) {
  const [state, setState] = useState<VoiceTestState>('idle');
  const streamRef = useRef<MediaStream | null>(null);

  const initial = String(agentName || 'A').trim().charAt(0).toUpperCase() || 'A';
  const subtitle = [phoneNumber, location].filter(Boolean).join(' · ');
  const isRunning = state === 'active';

  const stopStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }, []);

  // Release the microphone if the agent changes or the card unmounts.
  useEffect(() => {
    setState('idle');
    stopStream();
  }, [agentName, stopStream]);

  useEffect(() => () => stopStream(), [stopStream]);

  const handleStart = useCallback(async () => {
    if (isRunning) {
      stopStream();
      setState('idle');
      onTestStop?.();
      return;
    }

    setState('connecting');
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error('unsupported');
      }
      streamRef.current = await navigator.mediaDevices.getUserMedia({ audio: true });
      setState('active');
      onTestStart?.();
    } catch (error: any) {
      setState('idle');
      stopStream();
      const denied = error?.name === 'NotAllowedError' || error?.name === 'SecurityError';
      onError?.(
        denied
          ? 'Microphone access was blocked. Allow it in your browser to run a voice test.'
          : 'No microphone is available for this voice test.',
      );
    }
  }, [isRunning, onError, onTestStart, onTestStop, stopStream]);

  return (
    <div
      className="absolute inset-0 z-10 flex flex-col overflow-hidden rounded-2xl border bg-white"
      style={{ borderColor: BORDER, boxShadow: '0 4px 16px rgba(17,17,17,0.06)' }}
    >
      <style>{`
        @keyframes playgroundVoiceRipple {
          0%   { transform: scale(1);    opacity: 0.55; }
          70%  { transform: scale(1.85); opacity: 0; }
          100% { transform: scale(1.85); opacity: 0; }
        }
        .playground-voice-ring {
          animation: playgroundVoiceRipple 2.4s cubic-bezier(0.22, 0.61, 0.36, 1) infinite;
        }
        /* Black/white button: keep the label and icon white on hover (the
           page-wide red hover, and black text, would both be wrong here). */
        .playground-scroll button.playground-voice-cta:hover:not(:disabled),
        .playground-scroll button.playground-voice-cta:hover:not(:disabled) svg,
        button.playground-voice-cta:hover:not(:disabled),
        button.playground-voice-cta:hover:not(:disabled) svg {
          color: #ffffff !important;
        }
        .playground-voice-ring--active {
          animation-duration: 1.4s;
        }
      `}</style>

      {/* Header — agent identity plus live status */}
      <div
        className="flex h-[55px] shrink-0 items-center justify-between gap-2 border-b px-4"
        style={{ borderColor: BORDER }}
      >
        <div className="flex min-w-0 items-center gap-2.5">
          <span
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold text-white"
            style={{ background: RED }}
          >
            {initial}
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold leading-4" style={{ color: INK }}>
              {agentName}
            </p>
            {subtitle && (
              <p className="mt-0.5 truncate text-[11px] leading-3" style={{ color: MUTED }}>
                {subtitle}
              </p>
            )}
          </div>
        </div>

        <span
          className="flex shrink-0 items-center gap-1.5 text-xs font-medium"
          style={{ color: INK }}
        >
          <span
            className="inline-block h-2 w-2 rounded-full"
            style={{ background: isRunning ? RED : GREEN }}
          />
          {STATUS_LABEL[state]}
        </span>
      </div>

      {/* Body — centred voice test */}
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3 overflow-y-auto px-6 py-5 text-center">
        <p
          className="text-[10px] font-semibold uppercase tracking-[0.14em]"
          style={{ color: MUTED }}
        >
          {state === 'active'
            ? 'Listening'
            : state === 'connecting'
              ? 'Connecting'
              : 'Ready to connect'}
        </p>

        {/* Avatar with ripple glow */}
        <div className="relative flex h-24 w-24 shrink-0 items-center justify-center">
          {[0, 1].map((ring) => (
            <span
              key={ring}
              className={`playground-voice-ring absolute inset-0 rounded-full${
                isRunning ? ' playground-voice-ring--active' : ''
              }`}
              style={{ background: RED_SOFT, animationDelay: `${ring * 0.8}s` }}
            />
          ))}
          <span
            className="absolute rounded-full"
            style={{ inset: '18%', background: RED_SOFT, opacity: 0.9 }}
          />
          <span
            className="relative flex h-14 w-14 items-center justify-center rounded-full text-xl font-semibold text-white"
            style={{ background: RED, boxShadow: '0 6px 18px rgba(234,74,82,0.28)' }}
          >
            {initial}
          </span>
        </div>

        <div>
          <h3 className="text-base font-semibold" style={{ color: INK }}>
            {isRunning ? 'Voice test in progress' : 'Ready to test your agent'}
          </h3>
          <p className="mx-auto mt-1 max-w-xs text-xs leading-relaxed" style={{ color: MUTED }}>
            {isRunning
              ? 'Speak naturally — the agent is listening. End the test when you are done.'
              : 'Start a browser-based voice conversation and evaluate how your agent listens, responds, and handles interruptions.'}
          </p>
        </div>

        <button
          type="button"
          onClick={handleStart}
          disabled={state === 'connecting'}
          className="playground-voice-cta mt-1 flex cursor-pointer items-center gap-2 rounded-full border-0 px-6 py-2.5 text-sm font-semibold text-white transition-colors disabled:cursor-wait disabled:opacity-70"
          style={{ background: '#111111', color: '#FFFFFF' }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = '#333333';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = '#111111';
          }}
        >
          {isRunning ? <PhoneOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
          {isRunning ? 'End test' : state === 'connecting' ? 'Connecting...' : 'Start test'}
        </button>

      </div>

      {/* Footer — requirements condensed onto a single line, details in an infotip */}
      <div
        className="flex shrink-0 items-center justify-center border-t px-4 py-2.5 text-[11px]"
        style={{ borderColor: BORDER, color: MUTED }}
      >
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              aria-label="Test requirements"
              className="playground-hover-red flex cursor-pointer items-center gap-1 whitespace-nowrap rounded-full border-0 bg-transparent p-0 transition-colors"
              style={{ color: MUTED }}
            >
              <Info className="h-3.5 w-3.5 shrink-0" />
              Requirements
            </button>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="max-w-xs bg-gray-200 text-black [&>svg]:fill-gray-200">
            <span className="flex items-center gap-1 whitespace-nowrap">
              <Mic className="h-3 w-3 shrink-0" />
              Microphone required
            </span>
            <span className="mt-1 flex items-center gap-1 whitespace-nowrap">
              <Volume2 className="h-3 w-3 shrink-0" />
              Audio plays through your browser
            </span>
          </TooltipContent>
        </Tooltip>
      </div>
    </div>
  );
}
