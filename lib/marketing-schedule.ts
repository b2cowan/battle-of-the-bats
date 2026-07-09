/**
 * lib/marketing-schedule.ts
 *
 * Shared classification for a marketing campaign's send timing, used by BOTH the Email
 * Dashboard (client) and the platform-admin Overview (server) so the two never drift on
 * what counts as "past due" vs "upcoming". Pure + dependency-free (unit-tested).
 *
 * These planned dates are PLANNING reminders only — nothing here triggers an automatic
 * send. The dashboard/overview surface them; an operator still sends manually.
 */

export const UPCOMING_WINDOW_DAYS = 30;

export type CampaignSendStatus = 'sent' | 'past_due' | 'due_soon' | 'planned' | 'auto';

/** Whole days from `todayISO` to `dateISO` (both 'YYYY-MM-DD'); negative = in the past.
 *  Parsed component-wise so there is no UTC-vs-local off-by-one. */
export function daysUntil(dateISO: string, todayISO: string): number {
  const [py, pm, pd] = dateISO.split('-').map(Number);
  const [ty, tm, td] = todayISO.split('-').map(Number);
  return Math.round((Date.UTC(py, pm - 1, pd) - Date.UTC(ty, tm - 1, td)) / 86_400_000);
}

/**
 * Classify a campaign: already sent, event-triggered (auto — no editable date), overdue
 * (past_due), due within the window (due_soon), or planned further out. A campaign with no
 * planned date is treated as `auto` (its timing is system-defined).
 */
export function classifyCampaignSend(p: {
  plannedDate: string | null;
  sent: boolean;
  isTrigger?: boolean;
  todayISO: string;
}): CampaignSendStatus {
  if (p.sent) return 'sent';
  if (p.isTrigger || !p.plannedDate) return 'auto';
  const d = daysUntil(p.plannedDate, p.todayISO);
  if (d <= 0) return 'past_due';
  if (d <= UPCOMING_WINDOW_DAYS) return 'due_soon';
  return 'planned';
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** Format a 'YYYY-MM-DD' date as e.g. "Nov 1, 2026" (component-wise — no TZ shift). */
export function formatPlannedDate(dateISO: string): string {
  const [y, m, d] = dateISO.split('-').map(Number);
  return `${MONTHS[m - 1]} ${d}, ${y}`;
}
