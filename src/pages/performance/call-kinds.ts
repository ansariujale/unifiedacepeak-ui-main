import { isMissedCall } from '@/hooks/use-call-stats';

export type CallKind = 'answered' | 'outgoing' | 'missed' | 'voicemail' | 'other';

/**
 * One kind per call, so a split of calls genuinely adds up to its whole. The
 * rules are the call log's own: voicemail first, then direction, and an
 * inbound call nobody spoke on counts as missed. The server's own per-category
 * totals can't be stacked like this — its inbound count takes in missed calls.
 */
export const kindOf = (row: any): CallKind => {
  if (String(row?.forward_type || '').toUpperCase() === 'VOICEMAIL' || row?.is_voicemail) {
    return 'voicemail';
  }
  const direction = String(row?.direction || '').toLowerCase();
  if (direction === 'outbound') return 'outgoing';
  if (direction === 'inbound') return isMissedCall(row) ? 'missed' : 'answered';
  return 'other';
};

/* The console's own red and ink rather than a hue per kind: the brand colour
   carries the calls that were answered, a tint of it the ones placed, and
   charcoal the ones nobody picked up, so the eye still finds them first. */
export const CALL_KINDS: { key: CallKind; label: string; color: string }[] = [
  { key: 'answered', label: 'Answered', color: 'var(--accent)' },
  { key: 'outgoing', label: 'Outgoing', color: 'color-mix(in oklab, var(--accent) 38%, var(--surface))' },
  { key: 'missed', label: 'Missed', color: 'var(--ink-2)' },
  { key: 'voicemail', label: 'Voicemail', color: 'color-mix(in oklab, var(--ink) 28%, var(--surface))' },
  { key: 'other', label: 'Other', color: 'color-mix(in oklab, var(--ink) 12%, var(--surface))' },
];

export const countKinds = (rows: any[]): Record<CallKind, number> => {
  const counts: Record<CallKind, number> = {
    answered: 0,
    outgoing: 0,
    missed: 0,
    voicemail: 0,
    other: 0,
  };
  rows.forEach((row) => {
    counts[kindOf(row)] += 1;
  });
  return counts;
};
