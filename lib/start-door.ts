/**
 * THE START DOOR — an account remembers which "start something" sign-up made it (Account-First Sign-up, owner
 * rulings A3 + A4 2026-10-18; hub docs/projects/active/ACCOUNT_FIRST_SIGNUP_HUB.html).
 *
 * Every start sign-up asks for the account alone; the team, league or organization is named after the email link.
 * The door is written onto the auth user at sign-up (`user_metadata.start`), so the link, every resend and Home all
 * land the person on that door's create step, wherever the link is opened. It is cleared when the creation completes.
 *
 * ⚠ `user_metadata` is editable by the signed-in user (`supabase.auth.updateUser({ data })`). This record steers
 * SCREENS only — which create step, whether Home shows the finish card. It must never decide an entitlement, a price
 * or Founding Season eligibility; those read server-side facts (`auth.users.created_at`, the plan rules, checkout).
 *
 * Framework-free: the sign-up forms, the routes and Home all read it.
 */
import { COACHES_START_PATH } from './coaches-portal-routes';

const DOORS = ['team', 'league', 'organization', 'premium'] as const;
export type StartDoor = (typeof DOORS)[number];

export interface StartDoorRecord {
  door: StartDoor;
  /** Home's "Not now" taps: one hides the card until the next sign-in, two hide it for good (A4). */
  notNow?: number;
  /** When the last "Not now" was tapped (ISO), compared with the account's last sign-in. */
  notNowAt?: string;
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

/** Read the remembered door off an auth user's metadata; anything malformed reads as none. */
export function readStartDoor(userMetadata: unknown): StartDoorRecord | null {
  const raw = (userMetadata as { start?: unknown } | null | undefined)?.start;
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as { door?: unknown; notNow?: unknown; notNowAt?: unknown };
  const door = parseStartDoor(r.door, DOORS);
  if (!door) return null;
  const record: StartDoorRecord = { door };
  if (typeof r.notNow === 'number' && Number.isFinite(r.notNow) && r.notNow > 0) record.notNow = Math.floor(r.notNow);
  if (typeof r.notNowAt === 'string' && !Number.isNaN(Date.parse(r.notNowAt))) record.notNowAt = r.notNowAt;
  return record;
}

/** Where the verification link (and every resend of it) returns: the door's create step, marked as just confirmed. */
export function startDoorLinkPath(door: StartDoor): string {
  return `${START_DOOR_PATH[door]}?confirmed=1`;
}

/**
 * When this session signed in (ISO), from the access token's authentication entries (`amr`). Those survive a token
 * refresh; the account's `last_sign_in_at` does not — the auth service re-stamps it on every refresh, so "until the
 * next sign-in" measured by it would mean "for about an hour".
 */
export function sessionSignedInAt(amr: unknown): string | null {
  if (!Array.isArray(amr)) return null;
  const times = amr
    .map(e => (e && typeof e === 'object' ? (e as { timestamp?: unknown }).timestamp : undefined))
    .filter((t): t is number => typeof t === 'number' && Number.isFinite(t));
  return times.length ? new Date(Math.min(...times) * 1000).toISOString() : null;
}

/**
 * Does Home show the finish card (A4)? Never to an account that already has a workspace — it has somewhere to go,
 * even one made another way. Not after a second "Not now"; after the first, only in a session signed in since.
 */
export function startCardVisible(start: StartDoorRecord, account: { signedInAt: string | null | undefined; hasWorkspace: boolean }): boolean {
  if (account.hasWorkspace) return false;
  const notNow = start.notNow ?? 0;
  if (notNow >= 2) return false;
  if (notNow === 0) return true;
  const signedIn = account.signedInAt ? Date.parse(account.signedInAt) : NaN;
  const dismissed = start.notNowAt ? Date.parse(start.notNowAt) : NaN;
  return Number.isFinite(signedIn) && Number.isFinite(dismissed) && signedIn > dismissed;
}

/** The record after one more "Not now". */
export function withNotNow(start: StartDoorRecord, now: Date): StartDoorRecord {
  return { ...start, notNow: (start.notNow ?? 0) + 1, notNowAt: now.toISOString() };
}

/** Home's finish card, by door (drawings D8; Coach Premium has its own words because its step 2 asks for more). */
export const START_CARD_COPY: Record<StartDoor, { title: string; next: string; action: string }> = {
  team: { title: 'Finish creating your team', next: 'One more step opens your Coaches Portal.', action: 'Name your team' },
  league: { title: 'Finish creating your league', next: 'One more step opens your league setup.', action: 'Name your league' },
  organization: { title: 'Finish creating your organization', next: 'One more step opens your organization.', action: 'Name your organization' },
  premium: { title: 'Finish setting up your Coaches Portal', next: 'Your team, sport and plan are next.', action: 'Continue setup' },
};
