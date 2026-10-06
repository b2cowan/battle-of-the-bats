/**
 * WHETHER an automatic coach email goes, and TO WHOM — the rule the sending routes read, in a
 * module a client screen can import too (lib/email.ts carries every template and the provider,
 * and re-exports these so its callers are unchanged). A confirm that says "an email will go"
 * must read these same functions, never a copy of them (J1-075: Accept/Reject promised an email
 * the route then declined to send).
 */

// Per-tournament on/off switches for the transactional emails sent to a team's
// coach/contact. Stored as booleans under tournaments.settings (keys below).
// Absent key === enabled, so tournaments created before this feature keep the
// historical behavior (all automatic coach emails on).
//
// `coach_email_pause_all` (Phase 5n) is a master kill-switch: when true it suppresses
// EVERY coach-facing automatic email (the organizer is handling comms manually) — there is
// no transactional carve-out. It defaults OFF (absent/`false` = not paused) and has the
// OPPOSITE polarity from the per-type keys (here `true` DISABLES).

export type CoachEmailType =
  | 'confirmation'
  | 'acceptance'
  | 'rejection'
  | 'payment'
  | 'schedule'    // schedule-published email (gated in 5n)
  | 'game_day';   // game-day reminder, scheduled at publish time (5m; gated in 5n)

/**
 * Whether the organizer has paused ALL automatic coach-facing emails for a tournament
 * (the Phase 5n master switch). Use this for coach-facing sends that DON'T flow through
 * `coachEmailEnabled` — i.e. the post-event results email, which has its own per-event
 * "Post-Event Results" toggle and only needs the master override layered on top.
 */
export function coachEmailsPaused(settings: unknown): boolean {
  return (settings as Record<string, unknown> | null | undefined)?.coach_email_pause_all === true;
}

/**
 * Whether marking an event complete will email each team its results — every suppression the sender
 * (`sendCompletionResultsNotification`, set-status → completed) applies: the event's "notify teams on
 * complete" setting, the club's pause, never sent before, and a plan with Summary. The confirms read
 * this (the game-day board's, the event's record — Tournament admin redesign Stage 4), so "the teams
 * get an email" is said only when one will go.
 */
export function willEmailResultsOnComplete(e: {
  notifyTeamsOnComplete: boolean | null | undefined;
  settings: unknown;
  resultsNotifiedAt: string | null | undefined;
  planHasSummary: boolean;
}): boolean {
  return Boolean(e.notifyTeamsOnComplete) && !coachEmailsPaused(e.settings) && !e.resultsNotifiedAt && e.planHasSummary;
}

/**
 * Whether a given automatic coach email is enabled for a tournament.
 * Pass the tournament's `settings` JSONB. Defaults to true when the key is
 * missing or `settings` is null/undefined — only an explicit `false` disables.
 * Returns false unconditionally when the master `coach_email_pause_all` is on.
 */
export function coachEmailEnabled(settings: unknown, type: CoachEmailType): boolean {
  if (coachEmailsPaused(settings)) return false;
  const key = `coach_email_${type}`;
  const value = (settings as Record<string, unknown> | null | undefined)?.[key];
  return value !== false;
}

/**
 * Resolve the `to:` address for a coach-facing automatic email (free-tier Phase 5l).
 *
 * Prefers the head coach's per-tournament contact email (`teams.coach_email`, set in the Coaches
 * Portal) and falls back to `teams.email`. `teams.email` is NEVER overwritten — it stays the portal
 * access / claim key (claim-by-email), so a reassigned coach gets the mail while the registrant
 * keeps portal access. Returns `''` when neither is set (callers that pre-skip no-email teams
 * should guard on the result, not on `email` alone).
 *
 * This is the recipient ONLY — the email's claim-link footer (`coachPortalFooter`) still carries
 * `teams.email` (the claim key), so do not pass the resolved recipient into the footer.
 */
export function resolveCoachRecipient(team: { coach_email?: string | null; email?: string | null }): string {
  // Lowercased so the resolved address is canonical: it's both the `to:` recipient AND (for the 5m
  // game-day reminder) the `email_sends.recipient_email` stored at schedule time and the key the
  // per-recipient cancel matches on. The admin manual-add path stores teams.email un-lowercased, so
  // without this a mixed-case address would never match the lowercased cancel query → duplicate /
  // un-cancelled reminders. Email delivery is case-insensitive, so lowercasing the to-address is safe.
  const coach = team.coach_email?.trim().toLowerCase();
  if (coach) return coach;
  return team.email?.trim().toLowerCase() ?? '';
}

/** Why a coach email will NOT go to this team — the first reason in that order — or null when it will. */
export type CoachEmailBlock = 'paused' | 'off' | 'no_address';

export function coachEmailBlock(
  settings: unknown,
  type: CoachEmailType,
  team: { coach_email?: string | null; email?: string | null },
): CoachEmailBlock | null {
  if (coachEmailsPaused(settings)) return 'paused';
  if (!coachEmailEnabled(settings, type)) return 'off';
  if (!resolveCoachRecipient(team)) return 'no_address';
  return null;
}
