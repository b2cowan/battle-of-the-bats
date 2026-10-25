/**
 * The support console's words for raw values — plain functions with no stylesheet, so a server route can use them too
 * (`app/platform-admin/chips.ts` re-exports them beside the chip tones, which need the console's CSS).
 */

/** Sentence case for a raw status/severity word the console shows a person ("open" becomes "Open"). */
export function cap(s: string): string {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

/** A raw snake_case word as a person reads it: "past_due" becomes "Past due", "owner" becomes "Owner". */
export function humanize(s: string | null | undefined): string {
  return cap((s ?? '').replace(/_/g, ' '));
}

/** A subscription status word as the console prints it. */
export const SUBSCRIPTION_STATUS_LABELS: Record<string, string> = {
  active:   'Active',
  trialing: 'Trialing',
  past_due: 'Past due',
  canceled: 'Canceled',
};

/** A subscription status as the console prints it: the known four by name, anything else (incomplete, unpaid) humanized. */
export function subscriptionStatusLabel(status: string): string {
  return SUBSCRIPTION_STATUS_LABELS[status] ?? humanize(status);
}
