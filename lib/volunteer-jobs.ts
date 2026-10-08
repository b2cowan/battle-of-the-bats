import { hasCapability, type Capability } from './roles';
import type { OrgRole } from './types';

/**
 * A VOLUNTEER'S JOBS — the one rule (Tournament admin redesign Stage 6, A26, ruled 2026-10-07).
 *
 * A volunteer (`official`) holds two jobs by default — submit scores, and check teams in at the gate
 * (`ROLE_DEFAULTS.official`). The invite's "Helping with" and Members' Manage narrow them through the
 * per-member override that already exists (`organization_members.capabilities`), SUBTRACTIVELY only:
 * a gate volunteer simply doesn't hold `submit_scores`. No new data, and never a key the role doesn't
 * carry — so a job choice can take a door away but can never open one.
 *
 * Everything that decides where a volunteer lands reads `volunteerHome` — a bare sign-in, the
 * Workspaces card, the installed app, accepting an invite, a guessed `/{org}/admin` — so the three
 * places that used to send every official to the scorekeeper cannot drift apart again (F62). The
 * shells' own walls ask the same two questions (`canScore`, `canGate`).
 *
 * Client-safe and pure — `tests/unit/volunteer-jobs.test.ts` holds it.
 */

export type VolunteerJob = 'scoring' | 'gate' | 'both';

/** The two keys a volunteer's job is made of — and the only two a non-owner may change (P1). */
const VOLUNTEER_JOB_KEYS = ['submit_scores', 'check_in_teams'] as const satisfies readonly Capability[];

/** "Helping with", in the ruled order (Scoring · The gate · Both). */
export const VOLUNTEER_JOBS: readonly VolunteerJob[] = ['scoring', 'gate', 'both'];

type Caps = Record<string, boolean> | null | undefined;

/** May they enter scores? The scorekeeper's wall and the score routes ask this, through here. */
export function canScore(role: OrgRole, capabilities: Caps): boolean {
  return hasCapability(role, capabilities ?? null, 'submit_scores');
}

/** May they work the gate? A gate volunteer, or an organizer who manages registrations — the gate's wall and
 *  the check-in route ask this, through here. */
export function canGate(role: OrgRole, capabilities: Caps): boolean {
  return hasCapability(role, capabilities ?? null, 'check_in_teams')
    || hasCapability(role, capabilities ?? null, 'manage_registrations');
}

/**
 * The job a volunteer holds now — read from the two JOB keys only; null when they hold neither (only a
 * hand-made override can). ⚠ Not `canGate`: an owner can grant a volunteer `manage_registrations`, which
 * opens the gate too, but it is not their job, and counting it made "Helping with" read "Both" for a
 * scoring volunteer (/review 2026-10-07). Where they can GO is `canGate`'s; what their JOB is, is here.
 */
export function volunteerJobOf(capabilities: Caps): VolunteerJob | null {
  const score = hasCapability('official', capabilities ?? null, 'submit_scores');
  const gate = hasCapability('official', capabilities ?? null, 'check_in_teams');
  if (score && gate) return 'both';
  if (score) return 'scoring';
  if (gate) return 'gate';
  return null;
}

/**
 * A job as the override it writes onto a volunteer's existing overrides. Both keys are set to the
 * job's answer by REMOVING the override where the role default already says yes, and writing `false`
 * where the job takes it away — so nothing beyond the role's defaults is ever written. Other keys an
 * owner set by hand are kept untouched. Returns null when nothing is left (the column's "no
 * overrides").
 */
export function withVolunteerJob(capabilities: Caps, job: VolunteerJob): Record<string, boolean> | null {
  const next: Record<string, boolean> = { ...(capabilities ?? {}) };
  delete next.submit_scores;
  delete next.check_in_teams;
  if (job === 'gate') next.submit_scores = false;
  if (job === 'scoring') next.check_in_teams = false;
  return Object.keys(next).length > 0 ? next : null;
}

/** What the invite writes for a new volunteer (no overrides before it). */
export function volunteerCapabilitiesFor(job: VolunteerJob): Record<string, boolean> | null {
  return withVolunteerJob(null, job);
}

/** The overrides with the two job keys taken out — a volunteer moving to another role leaves their job behind. */
export function withoutVolunteerJob(capabilities: Caps): Record<string, boolean> | null {
  return withVolunteerJob(capabilities, 'both');
}

/** Read the invite's "Helping with" off a request body; the old value `scorekeeping` still means scoring. */
export function parseVolunteerJob(value: unknown): VolunteerJob {
  if (value === 'gate') return 'gate';
  if (value === 'scoring' || value === 'scorekeeping') return 'scoring';
  return 'both';
}

/**
 * P1 (owner, 2026-10-07): whoever may invite may also switch a volunteer's two jobs, and nothing else.
 * True when `after` differs from `before` ONLY in the two job keys. (Any value of those two keys is
 * within the volunteer role's own defaults, which hold both — so nothing can be granted this way.)
 */
export function isVolunteerJobChangeOnly(before: Caps, after: Caps): boolean {
  const a = before ?? {};
  const b = after ?? {};
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const key of keys) {
    if ((VOLUNTEER_JOB_KEYS as readonly string[]).includes(key)) continue;
    if (a[key] !== b[key]) return false;
  }
  return true;
}

/**
 * Where a volunteer lands without a link: the gate when that is their only job, otherwise the
 * scorekeeper (and with neither job, the scorekeeper's wall says why).
 */
export function officialHome(orgSlug: string, capabilities: Caps): string {
  const gateOnly = canGate('official', capabilities) && !canScore('official', capabilities);
  return gateOnly ? `/${orgSlug}/check-in` : `/${orgSlug}/scorekeeper`;
}

/** The same, for any role: null for every role but a volunteer — theirs is the resolver's own (A25: staff's is unchanged). */
export function volunteerHome(orgSlug: string, role: OrgRole | string, capabilities: Caps): string | null {
  return role === 'official' ? officialHome(orgSlug, capabilities) : null;
}
