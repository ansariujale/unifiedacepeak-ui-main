import { AlertTriangle } from 'lucide-react';

function WizardLeaveConfirmModal({
  open,
  onStay,
  onDiscard,
}: {
  open: boolean;
  onStay: () => void;
  onDiscard: () => void;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[200] grid place-items-center bg-slate-950/55 px-4">
      <div className="w-[420px] max-w-[92vw] overflow-hidden rounded-2xl border-[1.5px] border-neutral-200 bg-white p-7 text-center shadow-[0_20px_60px_rgba(0,0,0,0.22)]">
        <span className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-red-50 p-2">
          <span className="flex h-full w-full items-center justify-center rounded-xl border-2 border-red-200 bg-white text-red-600">
            <AlertTriangle className="h-6 w-6" strokeWidth={2.25} />
          </span>
        </span>
        <h3 className="text-[19px] font-bold text-neutral-950">Leave the wizard?</h3>
        <p className="mx-auto mt-2 max-w-[320px] text-[14px] leading-[1.55] text-neutral-500">
          You're in the middle of creating an agent. Leaving will discard your unsaved changes.
        </p>
        <div className="mt-6 flex items-center justify-center gap-4">
          <button
            type="button"
            onClick={onStay}
            className="rounded-full border! border-neutral-300! bg-white px-6 py-2.5 text-sm font-semibold text-neutral-700 outline-none! transition-colors hover:border-red-300!"
          >
            Stay
          </button>
          <button
            type="button"
            onClick={onDiscard}
            className="rounded-full bg-red-600! px-6 py-2.5 text-sm font-bold text-white! outline-none! shadow-[0_2px_6px_rgba(220,38,38,.25)] transition-all hover:bg-red-700!"
          >
            Discard & leave
          </button>
        </div>
      </div>
    </div>
  );
}

export default WizardLeaveConfirmModal;
