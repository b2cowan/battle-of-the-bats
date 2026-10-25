import kit from './console.module.css';

// The words live in a plain module a server route can import (no stylesheet); re-exported so screens keep one import.
export { cap, humanize, SUBSCRIPTION_STATUS_LABELS, subscriptionStatusLabel } from '@/lib/platform-labels';

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
