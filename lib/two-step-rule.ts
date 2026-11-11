import type { OrgRole } from './types';
import { isTeamWorkspaceOrg } from './team-workspace-kind';

/**
 * WHO MUST USE TWO-STEP SIGN-IN — the one rule (Board Ready · two-step sign-in; owner rulings 2026-11-10, ask 1 as amended).
 *
 *   - Two-step is OFFERED to every account and off unless the person turns it on.
 *   - FieldLogicHQ platform staff MUST always use it, with no grace period.
 *   - A club (any organization kind, every plan) may require it with two owner-only switches, both off by default:
 *     "Require it for the board" (owner, admins, treasurer, league admins, registrars) and "Also require it for coaches".
 *     Each person it covers gets 14 days from the day the switch was turned on, or from the day they accepted the seat in
 *     a club that already required it (Part 3 writes that start).
 *   - A test organization (the demos, the Milton demo, UAT and fixture clubs) never requires it.
 *   - A Coaches Portal coach's own team workspace is offered, with a nudge, never required: the coach is the only person
 *     who could reset it, so every lost phone would become a support email (tab 1).
 *   - One person in a seat that is required must use it; once it is on, every sign-in asks, everywhere (no half-on account).
 *   - Required seats are asked for the code again after 30 days.
 *
 * Pure (no database, no request): the server check (lib/api-auth.ts, lib/platform-auth.ts) and Part 2's account page
 * (lib/two-step-requirements.ts) both read it. Part 3 adds the switches' screen; the rule reads the switches from day one.
 */

export const TWO_STEP_GRACE_DAYS = 14;
/** Required seats are asked for the code again after this many days (ask 4). */
export const TWO_STEP_REASK_DAYS = 30;
/** "Typed a code in the last 15 minutes": the five actions that ask for a code (ask 4, Part 2 wires them). */
export const TWO_STEP_FRESH_MINUTES = 15;

/** The board seats: what "Require it for the board" covers. */
export const TWO_STEP_BOARD_ROLES: readonly OrgRole[] = ['owner', 'admin', 'treasurer', 'league_admin', 'league_registrar'];
/** What "Also require it for coaches" covers. */
export const TWO_STEP_COACH_ROLES: readonly OrgRole[] = ['coach'];

const DAY_MS = 86_400_000;

/** The organization facts the rule reads (the row is read with `*`, so these are present once mig 463 is applied). */
export type OrgTwoStepFacts = {
  two_step_board_required_since?: string | null;
  two_step_coaches_required_since?: string | null;
  is_test_organization?: boolean | null;
  account_kind?: string | null;
  plan_id?: string | null;
};

export type SeatRequirement =
  | { kind: 'none' }
  /** Required, and still inside the 14 days: the person may pass the reminder. */
  | { kind: 'grace'; since: Date; until: Date; switch: 'board' | 'coaches' }
  | { kind: 'required'; since: Date; switch: 'board' | 'coaches' };

/**
 * Does this seat in this organization require two-step, and is its grace still running? `personGraceStart` is the
 * person's own start in this club (a seat accepted after the switch); the later of it and the switch's time counts.
 */
export function seatTwoStepRequirement(
  org: OrgTwoStepFacts,
  role: OrgRole | string | null | undefined,
  personGraceStart: string | null | undefined,
  now: number = Date.now(),
): SeatRequirement {
  if (org.is_test_organization === true) return { kind: 'none' };
  if (isTeamWorkspaceOrg({ accountKind: org.account_kind ?? null, planId: org.plan_id ?? null })) return { kind: 'none' };
  if (!role) return { kind: 'none' };

  const which: 'board' | 'coaches' | null =
    TWO_STEP_BOARD_ROLES.includes(role as OrgRole) ? 'board'
      : TWO_STEP_COACH_ROLES.includes(role as OrgRole) ? 'coaches'
        : null;
  if (!which) return { kind: 'none' };

  const sinceRaw = which === 'board' ? org.two_step_board_required_since : org.two_step_coaches_required_since;
  const switchAt = sinceRaw ? Date.parse(sinceRaw) : NaN;
  if (!Number.isFinite(switchAt)) return { kind: 'none' };

  const personAt = personGraceStart ? Date.parse(personGraceStart) : NaN;
  const startAt = Number.isFinite(personAt) ? Math.max(switchAt, personAt) : switchAt;
  const until = startAt + TWO_STEP_GRACE_DAYS * DAY_MS;
  if (now < until) return { kind: 'grace', since: new Date(startAt), until: new Date(until), switch: which };
  return { kind: 'required', since: new Date(startAt), switch: which };
}

/** A seat the switch covers at all (in its grace or past it). */
export function seatIsCovered(req: SeatRequirement): boolean {
  return req.kind !== 'none';
}

/** What the session must do before a required seat opens: nothing, type the code, or set two-step up. */
export type TwoStepNeed = null | 'code' | 'set_up';

/**
 * For a session in a seat that is REQUIRED (past any grace): set it up when it is off, type the code again when the last
 * one is more than 30 days old. A session that has not typed the code at all never reaches here — it is not signed in
 * (lib/two-step-session.ts).
 */
export function requiredSeatNeed(
  session: { hasFactor: boolean; provedAt: number | null },
  now: number = Date.now(),
): TwoStepNeed {
  if (!session.hasFactor) return 'set_up';
  if (session.provedAt === null || now - session.provedAt > TWO_STEP_REASK_DAYS * DAY_MS) return 'code';
  return null;
}

/**
 * Platform staff always need it. On DEV only, `TWO_STEP_STAFF_REQUIRED=off` turns the requirement off so seeds and probes
 * can sign staff in with a password (owner ruling 2026-11-11: dev requires it by default, like production). The switch is
 * refused against the production project, whatever the environment says.
 */
const PROD_SUPABASE_REF = 'qcttcboqysynwcdyghil';
export function platformStaffTwoStepRequired(env: NodeJS.ProcessEnv = process.env): boolean {
  if ((env.TWO_STEP_STAFF_REQUIRED ?? '').trim().toLowerCase() !== 'off') return true;
  // A production build never honours it, whatever its address (/review 2026-11-11: a custom auth domain would hide the ref).
  if (env.NODE_ENV === 'production') return true;
  const url = env.NEXT_PUBLIC_SUPABASE_URL ?? '';
  if (!url || url.includes(PROD_SUPABASE_REF)) return true;
  return false;
}
