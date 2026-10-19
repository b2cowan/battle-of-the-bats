/**
 * THE START DOOR — an account remembers which "start something" sign-up made it (Account-First Sign-up, owner
 * rulings A3 + A4 2026-10-18; hub docs/projects/active/ACCOUNT_FIRST_SIGNUP_HUB.html).
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

export interface StartDoorRecord {
  door: StartDoor;
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
  const door = parseStartDoor((raw as { door?: unknown }).door, DOORS);
  return door ? { door } : null;
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
