/**
 * THE START DOOR — an account remembers which "start something" sign-up made it (Account-First Sign-up, owner
 * rulings A3 + A4 2026-10-18; hub docs/projects/archive/ACCOUNT_FIRST_SIGNUP_HUB.html).
 *
 * Every start sign-up asks for the account alone; the team, league or organization is named after the email link.
 * The door is written onto the auth user at sign-up (`user_metadata.start`), so the link, every resend and Home all
 * land the person on that door's create step, wherever the link is opened. It is cleared when the creation completes.
 *
 * ⚠ `user_metadata` is editable by the signed-in user (`supabase.auth.updateUser({ data })`). This record steers
 * SCREENS only — which create step, whether Home shows a waiting workspace. It must never decide an entitlement, a price
 * or Founding Season eligibility; those read server-side facts (`auth.users.created_at`, the plan rules, checkout).
 *
 * Framework-free: the sign-up forms, the routes and Home all read it.
 */
import { COACHES_START_PATH } from './coaches-portal-routes';

const DOORS = ['team', 'league', 'organization', 'premium'] as const;
export type StartDoor = (typeof DOORS)[number];

/**
 * The plan and billing picked on the pricing page (owner A6, 2026-10-18): the paid plans its cards send to the sign-up.
 * They ride on the account so the plan step opens with that plan chosen — a preselection the person can change, never
 * a price (the checkout decides that).
 */
const START_PLANS = ['tournament_plus', 'league', 'club', 'club_large'] as const;
export type StartPlan = (typeof START_PLANS)[number];
export type StartBilling = 'monthly' | 'annual';
export interface StartPricing {
  plan: StartPlan;
  billing: StartBilling;
}

export interface StartDoorRecord {
  door: StartDoor;
  /** Only on the organization door, and only when the person came from a plan on the pricing page. */
  pricing?: StartPricing;
  /** Only on Coach Premium's door: the billing chosen before the account was made (Part 3), so step 2 opens on it. */
  billing?: StartBilling;
}

/** A billing choice from an untrusted value, or none. */
export function parseStartBilling(billing: unknown): StartBilling | null {
  return billing === 'annual' || billing === 'monthly' ? billing : null;
}

/** The pricing page's plan and billing from untrusted values; no plan is none, and billing defaults to monthly. */
export function parseStartPricing(plan: unknown, billing: unknown): StartPricing | null {
  if (typeof plan !== 'string' || !(START_PLANS as readonly string[]).includes(plan)) return null;
  return { plan: plan as StartPlan, billing: parseStartBilling(billing) ?? 'monthly' };
}

/** The plan step, with the pricing page's choice when there was one (`/{org}/admin/onboarding`). */
export function planStepPath(orgSlug: string, pricing: StartPricing | null | undefined): string {
  const params = new URLSearchParams({ choosePlan: '1' });
  if (pricing) {
    params.set('plan', pricing.plan);
    params.set('billing', pricing.billing);
  }
  return `/${orgSlug}/admin/onboarding?${params.toString()}`;
}

/** Who is looking at a door's create step: signed in, and whether this is their first day (no workspace yet). */
export interface StartStepViewer {
  email: string;
  firstRun: boolean;
}

/** The door's create step — step 2, where the link lands and Home's card leads. */
export const START_DOOR_PATH: Record<StartDoor, string> = {
  team: '/start/team',
  league: '/start/league',
  organization: '/start/tournament',
  premium: COACHES_START_PATH,
};

/** A door from an untrusted value, limited to the doors the caller serves; anything else is none. */
export function parseStartDoor<D extends StartDoor>(value: unknown, allowed: readonly D[]): D | null {
  return typeof value === 'string' && (allowed as readonly string[]).includes(value) ? value as D : null;
}

/**
 * Read the remembered door off an auth user's metadata; anything malformed reads as none. Any other key on the record
 * is ignored — the `notNow` count Home's finish card kept before A4 was revised (2026-10-19) no longer means anything.
 */
export function readStartDoor(userMetadata: unknown): StartDoorRecord | null {
  const raw = (userMetadata as { start?: unknown } | null | undefined)?.start;
  if (!raw || typeof raw !== 'object') return null;
  const { door: rawDoor, plan, billing } = raw as { door?: unknown; plan?: unknown; billing?: unknown };
  const door = parseStartDoor(rawDoor, DOORS);
  if (!door) return null;
  if (door === 'organization') {
    const pricing = parseStartPricing(plan, billing);
    return pricing ? { door, pricing } : { door };
  }
  const premiumBilling = door === 'premium' ? parseStartBilling(billing) : null;
  return premiumBilling ? { door, billing: premiumBilling } : { door };
}

/** Where the verification link (and every resend of it) returns: the door's create step, marked as just confirmed. */
export function startDoorLinkPath(door: StartDoor): string {
  return `${START_DOOR_PATH[door]}?confirmed=1`;
}

/**
 * Home's waiting workspace, by door (A4 revised 2026-10-19, hub v7): the card the door's team, league or organization
 * will become, waiting for its name under Workspaces until it is made. It shows beside every other workspace (owner:
 * "otherwise they lose that team") and has no Not now. `kind` is the workspace family it joins, so it wears that
 * card's label, icon and accent and fills in where it sits. Coach Premium has its own words because its step 2 asks
 * for the team, sport and plan before checkout. Words ruled by the owner 2026-10-19.
 */
export const WAITING_WORKSPACE: Record<StartDoor, { kind: 'coaches_basic' | 'coaches_premium' | 'organization'; badge: string; title: string; action: string }> = {
  team: { kind: 'coaches_basic', badge: 'Not named yet', title: 'Your team', action: 'Name your team' },
  league: { kind: 'organization', badge: 'Not named yet', title: 'Your league', action: 'Name your league' },
  organization: { kind: 'organization', badge: 'Not named yet', title: 'Your organization', action: 'Name your organization' },
  premium: { kind: 'coaches_premium', badge: 'Setup not finished', title: 'Your team', action: 'Continue setup' },
};
