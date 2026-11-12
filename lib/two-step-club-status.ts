import { supabaseAdmin } from './supabase-admin';
import {
  TWO_STEP_BOARD_ROLES, TWO_STEP_COACH_ROLES, TWO_STEP_GRACE_DAYS, seatTwoStepRequirement, type OrgTwoStepFacts, type SeatRequirement,
} from './two-step-rule';

/**
 * WHAT THE CLUB SEES ABOUT ITS PEOPLE'S TWO-STEP (Board Ready · two-step sign-in, Part 4; drawings tabs 6 and 8; owner
 * rulings 2026-11-10 ask 6 and 2026-11-12).
 *
 *   - Members' Two-step column, its phone line, the coaching-staff words and the export: owners and admins only, never on
 *     The board tab (a list of whose password is worth stealing).
 *   - Overview's "N people still need to set up" reminder (ask F), and the hourly "3 days left" email.
 *
 * The club sees on / off and how long a required seat has left. Never codes, apps or devices (/legal §5).
 *
 * The facts come from ONE read of just these people (`people_sign_in_facts`, mig 475), never the platform-wide account
 * list (owner ruling 2026-11-12: that read stopped at 1,000 accounts and would have said "Off" past them).
 */

const DAY_MS = 86_400_000;

export type PersonSignInFacts = {
  email: string | null;
  lastSignInAt: string | null;
  twoStepOn: boolean;
  twoStepSince: string | null;
};

/** Email, last sign-in and two-step state for these accounts, keyed by account id. Throws when the read fails. */
export async function peopleSignInFacts(userIds: readonly (string | null | undefined)[]): Promise<Map<string, PersonSignInFacts>> {
  const ids = [...new Set(userIds.filter((id): id is string => typeof id === 'string' && id.length > 0))];
  const out = new Map<string, PersonSignInFacts>();
  if (ids.length === 0) return out;
  const { data, error } = await supabaseAdmin.rpc('people_sign_in_facts', { p_user_ids: ids });
  if (error) throw error;
  for (const r of (data ?? []) as { user_id: string; email: string | null; last_sign_in_at: string | null; two_step_on: boolean | null; two_step_since: string | null }[]) {
    out.set(r.user_id, {
      email: r.email ?? null,
      lastSignInAt: r.last_sign_in_at ?? null,
      twoStepOn: r.two_step_on === true,
      twoStepSince: r.two_step_since ?? null,
    });
  }
  return out;
}

/** One person's Two-step state as the club reads it. */
export type MemberTwoStep =
  | { state: 'on' }
  | { state: 'off' }
  /** A seat the club requires, still inside its 14 days: "Not set up · N days". */
  | { state: 'not_set_up'; deadline: string; daysLeft: number }
  /** A seat the club requires, past its deadline: "Not set up" (amber, no count — ask E). */
  | { state: 'overdue'; deadline: string };

/** Whole days left until `untilMs`, never fewer than 1 while time remains (the sign-in reminder counts the same way). */
export function daysLeftUntil(untilMs: number, now: number = Date.now()): number {
  return Math.max(1, Math.ceil((untilMs - now) / DAY_MS));
}

function deadlineOf(req: Exclude<SeatRequirement, { kind: 'none' }>): number {
  return req.kind === 'grace' ? req.until.getTime() : req.since.getTime() + TWO_STEP_GRACE_DAYS * DAY_MS;
}

/**
 * The state of one ACCEPTED seat (an invitation has none: the column shows "—"). Pure. `graceStart` is the person's own
 * start in this club (two_step_grace.starts_at), or null.
 */
export function memberTwoStep(
  org: OrgTwoStepFacts,
  role: string,
  graceStart: string | null,
  twoStepOn: boolean,
  now: number = Date.now(),
): MemberTwoStep {
  if (twoStepOn) return { state: 'on' };
  const req = seatTwoStepRequirement(org, role, graceStart, now);
  if (req.kind === 'none') return { state: 'off' };
  if (req.kind === 'grace') {
    return { state: 'not_set_up', deadline: req.until.toISOString(), daysLeft: daysLeftUntil(req.until.getTime(), now) };
  }
  return { state: 'overdue', deadline: new Date(deadlineOf(req)).toISOString() };
}

export type OrgTwoStepRow = OrgTwoStepFacts & { id: string; name: string; two_step_prompt_closed_at: string | null };

/** The club's switches and what the rule needs (the session's Organization object does not carry them). */
export async function orgTwoStepFacts(orgId: string): Promise<OrgTwoStepRow | null> {
  const { data, error } = await supabaseAdmin
    .from('organizations')
    .select('id, name, two_step_board_required_since, two_step_coaches_required_since, two_step_prompt_closed_at, is_test_organization, account_kind, plan_id')
    .eq('id', orgId)
    .maybeSingle<OrgTwoStepRow>();
  if (error) throw error;
  return data ?? null;
}

/** Each person's own start in this club, keyed by account id. */
export async function graceStartsFor(orgId: string): Promise<Map<string, string>> {
  const { data, error } = await supabaseAdmin
    .from('two_step_grace')
    .select('user_id, starts_at')
    .eq('organization_id', orgId);
  if (error) throw error;
  return new Map((data ?? []).map(r => [r.user_id as string, r.starts_at as string]));
}

/** The roles a club's switches cover right now (the board's, the coaches', both, or none). */
export function coveredRoles(org: OrgTwoStepFacts): string[] {
  const roles: string[] = [];
  if (org.two_step_board_required_since) roles.push(...TWO_STEP_BOARD_ROLES);
  if (org.two_step_coaches_required_since) roles.push(...TWO_STEP_COACH_ROLES);
  return roles;
}

export type WaitingPerson = {
  userId: string;
  name: string;
  email: string | null;
  role: string;
  deadline: string;
  overdue: boolean;
};

/**
 * Everyone whose seat in this club requires two-step and who has not set it up (in their 14 days or past them), soonest
 * deadline first. Empty when no switch is on, or for a test organization or a coach's own team workspace (the rule says
 * none). Throws when a read fails.
 */
export async function clubTwoStepWaiting(org: OrgTwoStepFacts & { id: string }, now: number = Date.now()): Promise<WaitingPerson[]> {
  const roles = coveredRoles(org);
  if (roles.length === 0) return [];
  const { data: members, error } = await supabaseAdmin
    .from('organization_members')
    .select('user_id, role, display_name')
    .eq('organization_id', org.id)
    .eq('status', 'active')
    .in('role', roles)
    .not('user_id', 'is', null);
  if (error) throw error;
  const rows = (members ?? []) as { user_id: string; role: string; display_name: string | null }[];
  if (rows.length === 0) return [];
  const [facts, graces] = await Promise.all([peopleSignInFacts(rows.map(r => r.user_id)), graceStartsFor(org.id)]);

  const out: WaitingPerson[] = [];
  for (const r of rows) {
    const f = facts.get(r.user_id);
    // An account the read did not return is not counted as waiting (it cannot sign in either).
    if (!f) continue;
    const s = memberTwoStep(org, r.role, graces.get(r.user_id) ?? null, f.twoStepOn, now);
    if (s.state !== 'not_set_up' && s.state !== 'overdue') continue;
    out.push({
      userId: r.user_id,
      name: r.display_name?.trim() || f.email || 'Someone',
      email: f.email,
      role: r.role,
      deadline: s.deadline,
      overdue: s.state === 'overdue',
    });
  }
  return out.sort((a, b) => a.deadline.localeCompare(b.deadline) || a.name.localeCompare(b.name));
}
