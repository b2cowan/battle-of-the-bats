import 'server-only';
import { supabaseAdmin } from './supabase-admin';
import { normalizeGuardianEmailRequired } from './guardian-email';
import type { LeagueRegistrationStatus } from './types';

/**
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * A HOUSE-LEAGUE SPOT IS TAKEN ONCE — THE ONLY WAY A CHILD IS PLACED (Club Tier Stage 9b-1, Part 3; mig 362).
 *
 * Every house-league route that puts a child in a division, accepts one, waitlists one or promotes one comes through
 * here, and each call is ONE database function holding the season's lock: count the spots, decide, write. Two families
 * pressing Sign up for the last spot cannot both get it; two waitlisted children cannot share a place; the same child
 * (name + date of birth, a declined or withdrawn sign-up aside) cannot be signed up twice in a season.
 *
 *   A spot is HELD by an accepted or a received child (owner 2026-10-25: a received child holds its spot).
 *   Staff accepting into, or adding by hand into, a full division are refused ("Add to the waitlist instead").
 *   Nobody jumps the line: while a division has a waitlist, a public sign-up joins it even when a spot is free.
 *   The waitlist moves up only when a child who HELD a spot leaves, and only into a free one — inside the same locked
 *   step that freed it.
 *   The same child once per season: same name (case and spacing ignored) and date of birth; with no date of birth, the
 *   same name under the same guardian email.
 *
 * `tests/unit/house-league-place-guard.test.ts` fails the build if a house-league route inserts a registration, changes
 * its status, or moves the waitlist any other way. `scripts/house-league-signup-race.mjs` races real requests on dev.
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 */

export type PlaceRefusal = 'duplicate' | 'full' | 'division' | 'no_division';

export interface PlaceChild {
  firstName: string;
  lastName: string;
  dateOfBirth: string | null;
  jerseyPref?: string | null;
  positionPref?: string | null;
  notes?: string | null;
  guardianFirstName: string;
  guardianLastName: string;
  guardianEmail: string;
  guardianPhone?: string | null;
  source: 'public_form' | 'admin_manual';
  /** When the guardian accepted the waiver on the public form; null for a child staff added. */
  waiverAcceptedAt?: string | null;
}

export interface PlaceInput {
  orgId: string;
  seasonId: string;
  divisionId: string;
  child: PlaceChild;
  /** 'auto' = the public form (the season's rule decides); otherwise the status staff chose. */
  want: 'auto' | LeagueRegistrationStatus;
  /** The price recorded on the registration (lib/league-price.ts, on the club's day of sign-up). */
  feeAmount: number | null;
  signupRef?: string | null;
  signupPosition?: number | null;
  /** The season's waiver text at acceptance: with `waiverAcceptedAt`, the consent-ledger row is filed here. */
  waiverText?: string | null;
}

export type Placed = { id: string; status: LeagueRegistrationStatus; waitlistPosition: number | null };

export async function placeLeagueRegistration(input: PlaceInput): Promise<{ placed: Placed } | { refusal: PlaceRefusal }> {
  const email = normalizeGuardianEmailRequired(input.child.guardianEmail);
  const c = input.child;
  const { data, error } = await supabaseAdmin.rpc('league_registration_place', {
    p_org: input.orgId,
    p_season: input.seasonId,
    p_division: input.divisionId,
    p_child: {
      first: c.firstName, last: c.lastName, dob: c.dateOfBirth ?? '',
      jersey: c.jerseyPref ?? '', position: c.positionPref ?? '', notes: c.notes ?? '',
      guardianFirst: c.guardianFirstName, guardianLast: c.guardianLastName, guardianEmail: email,
      guardianPhone: c.guardianPhone ?? '', source: c.source, waiverAt: c.waiverAcceptedAt ?? '',
    },
    p_want: input.want,
    p_signup_ref: input.signupRef ?? null,
    p_signup_position: input.signupPosition ?? null,
    p_fee: input.feeAmount,
  });
  if (error) throw error;
  const row = (Array.isArray(data) ? data[0] : data) as { id: string | null; status: string | null; waitlist_position: number | null; refusal: string | null };
  if (row.refusal) return { refusal: row.refusal as PlaceRefusal };
  const placed: Placed = { id: row.id!, status: row.status as LeagueRegistrationStatus, waitlistPosition: row.waitlist_position };

  // A witnessed waiver acceptance files its consent-ledger row in the same seam as the placement, AWAITED: it is
  // compliance evidence, and a fire-and-forget can be torn down once the response is sent. The helper never throws.
  if (c.waiverAcceptedAt && input.waiverText) {
    const { recordLeagueWaiverConsent } = await import('./org-people');
    await recordLeagueWaiverConsent({
      orgId: input.orgId, guardianEmailNormalized: email, registrationId: placed.id,
      waiverText: input.waiverText, acceptedAt: c.waiverAcceptedAt,
    });
  }
  return { placed };
}

/** Staff move a child between Received, Accepted and Waitlist; `changed` is decided under the lock (one email per real
 *  change). With `promote`, a child who held a spot going to the waitlist frees it for the first child waiting. Declining
 *  and withdrawing end a registration through `voidLeagueRegistrationFee` (lib/league-fee-paid.ts), the same lock. */
export async function moveLeagueRegistration(
  orgId: string, seasonId: string, regId: string,
  to: 'active' | 'pending_review' | 'waitlisted', notes: string | null, promote: boolean,
): Promise<{ moved: { status: LeagueRegistrationStatus; waitlistPosition: number | null; changed: boolean; promotedId: string | null } } | { refusal: PlaceRefusal }> {
  const { data, error } = await supabaseAdmin.rpc('league_registration_move', {
    p_org: orgId, p_season: seasonId, p_registration: regId, p_to: to, p_notes: notes, p_promote: promote,
  });
  if (error) throw error;
  const row = (Array.isArray(data) ? data[0] : data) as {
    status: string; waitlist_position: number | null; refusal: string | null; changed: boolean; promoted: string | null;
  };
  if (row.refusal) return { refusal: row.refusal as PlaceRefusal };
  return { moved: {
    status: row.status as LeagueRegistrationStatus, waitlistPosition: row.waitlist_position,
    changed: row.changed, promotedId: row.promoted,
  } };
}

/** Staff move a child to another division of the season (or clear it): a child holding a spot needs one there, a
 *  waitlisted child joins the end of the new line, and (with `promote`) a spot freed in the old division goes to its
 *  first waiting child. The recorded price does not move (re-pricing is 9b-2's). */
export async function changeLeagueDivision(
  orgId: string, seasonId: string, regId: string, divisionId: string | null, promote: boolean,
): Promise<{ promotedId: string | null } | { refusal: PlaceRefusal }> {
  const { data, error } = await supabaseAdmin.rpc('league_registration_change_division', {
    p_org: orgId, p_season: seasonId, p_registration: regId, p_division: divisionId, p_promote: promote,
  });
  if (error) throw error;
  const row = (Array.isArray(data) ? data[0] : data) as { refusal: string | null; promoted: string | null };
  if (row.refusal) return { refusal: row.refusal as PlaceRefusal };
  return { promotedId: row.promoted };
}

/** The first waitlisted child into a FREE spot, or null. Ending, moving and re-dividing a child promote inside their own
 *  locked step; this is the door for anything else that frees a spot. */
export async function promoteLeagueWaitlist(orgId: string, seasonId: string, divisionId: string): Promise<string | null> {
  const { data, error } = await supabaseAdmin.rpc('league_waitlist_promote', {
    p_org: orgId, p_season: seasonId, p_division: divisionId,
  });
  if (error) throw error;
  return (data as string | null) ?? null;
}

