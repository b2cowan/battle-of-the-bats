import kit from './console.module.css';

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

/** The kit chip tone for a subscription status. */
export function subscriptionStatusChip(status: string): string {
  if (status === 'active')   return kit.chipOk;
  if (status === 'trialing') return kit.chipInfo;
  if (status === 'past_due') return kit.chipWarn;
  return kit.chipQuiet;
}

/** The kit chip tone for an issue's severity. */
export function severityChip(severity: string): string {
  if (severity === 'critical' || severity === 'error') return kit.chipBad;
  if (severity === 'warning') return kit.chipWarn;
  if (severity === 'info') return kit.chipInfo;
  return kit.chipQuiet;
}

/** The kit chip tone for an issue's triage status. */
export function issueStatusChip(status: string): string {
  if (status === 'open') return kit.chipWarn;
  if (status === 'resolved') return kit.chipOk;
  if (status === 'snoozed') return kit.chipInfo;
  return kit.chipQuiet;
}

/** The kit chip tone for a feedback item's type (shown beside an issue it relates to). */
export function feedbackTypeChip(type: string): string {
  if (type === 'bug') return kit.chipBad;
  if (type === 'feature') return kit.chipInfo;
  return kit.chipQuiet;
}

/** The kit chip tone for a feedback item's status. */
export function feedbackStatusChip(status: string): string {
  if (status === 'new') return kit.chipWarn;
  if (status === 'resolved') return kit.chipOk;
  if (status === 'triaged' || status === 'acknowledged') return kit.chipInfo;
  return kit.chipQuiet;
}
