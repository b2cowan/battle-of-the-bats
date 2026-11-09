/**
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * THE INVITATION RULES, PURE (Signed-in family accounts Stage 4a, Part 3; plan SIGNED_IN_FAMILY_ACCOUNTS_PLAN.md Stage 4, RULED
 * 2026-11-08, all 15 asks A + O1/O2). No database here: lib/family-invitation.ts reads the facts and calls these, so every rule is
 * unit-tested (tests/unit/family-invitation-rules.test.ts).
 *
 *   Who is invited at placement   placementDecision / emailDecision
 *   What an acceptance connects   connectables (ruling 3: every child of the org whose PLACED sign-up carries the address, plus the
 *                                 rep player for a rep invitation)
 *   The age band                  guardianAgeBand (ruling 12: from the date of birth the club holds and the club's province; never
 *                                 asked, never shown, never stored as a band; 18+ = no invitation)
 *   An invitation's state         invitationState (drawing tab 2, states D/E/F: a stranger is never told WHY it stopped working)
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 */

import { normalizeGuardianEmail } from './guardian-email';

// ── The age band ──────────────────────────────────────────────────────────────────────────────

/** `adult` (18 or older: no invitation, a parent cannot attest for an adult — /legal condition 1), `under_14` (Quebec's rule, or
 *  the province is unknown: the most protective reading), `minor`, or `unknown` (no date of birth: treated as a minor — the parent
 *  is invited and consents for the child, the protective path for a child). Only `adult` changes what happens. */
export type GuardianAgeBand = 'adult' | 'under_14' | 'minor' | 'unknown';

/** Whole years between a YYYY-MM-DD birth date and a YYYY-MM-DD day, without a Date (no time zone can move a birthday). */
export function ageOn(dateOfBirth: string, today: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(dateOfBirth);
  const t = /^(\d{4})-(\d{2})-(\d{2})/.exec(today);
  if (!m || !t) return null;
  const [by, bm, bd] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const [ty, tm, td] = [Number(t[1]), Number(t[2]), Number(t[3])];
  return ty - by - (tm < bm || (tm === bm && td < bd) ? 1 : 0);
}

export function guardianAgeBand(params: {
  dateOfBirth: string | null | undefined;
  /** Two-letter province or territory (billing_locations.region_code), or null when the club has none on file. */
  province: string | null | undefined;
  today: string;
}): { band: GuardianAgeBand; provinceKnown: boolean } {
  const provinceKnown = !!params.province;
  const age = params.dateOfBirth ? ageOn(params.dateOfBirth, params.today) : null;
  if (age === null) return { band: 'unknown', provinceKnown };
  if (age >= 18) return { band: 'adult', provinceKnown };
  const quebecRule = !provinceKnown || params.province!.toUpperCase() === 'QC';
  return { band: quebecRule && age < 14 ? 'under_14' : 'minor', provinceKnown };
}

/** What the consent record stores for the club's province (/legal condition 4 stores the club and child, never the band). */
export const consentJurisdiction = (province: string | null | undefined) => (province ? province.toUpperCase() : 'unknown');

// ── Who is invited at placement ───────────────────────────────────────────────────────────────

/** The facts about ONE child and ONE address on its placed sign-up. */
export interface ChildAddressFacts {
  tierOn: boolean;
  band: GuardianAgeBand;
  /** This address already holds a VERIFIED link to this child. */
  connected: boolean;
  /** This address has an ended link to this child that was not a merge (left, removed by the club or coach, stopped). */
  endedBefore: boolean;
  /** Live guardians this child holds through OTHER addresses (the cap is two per child, mig 453). */
  otherLiveGuardians: number;
}

export type PlacementDecision = 'invite' | 'already_connected' | 'none';

/** Invite, already connected, or nothing at all (today's email). Order matters: the tier, then the age, then the facts. */
export function placementDecision(f: ChildAddressFacts): PlacementDecision {
  if (!f.tierOn) return 'none';
  if (f.band === 'adult') return 'none';
  if (f.connected) return 'already_connected';
  // A parent who left, or whom the club removed, is never invited again automatically; only the club's Send again brings them back.
  if (f.endedBefore) return 'none';
  if (f.otherLiveGuardians >= 2) return 'none';
  return 'invite';
}

/** One email covers every child of one address in a division: it carries the panel when any child invites, the "already in the
 *  app" line when none invites but one is connected, and nothing otherwise. */
export function emailDecision(decisions: readonly PlacementDecision[]): PlacementDecision {
  if (decisions.includes('invite')) return 'invite';
  if (decisions.includes('already_connected')) return 'already_connected';
  return 'none';
}

// ── What an acceptance connects ───────────────────────────────────────────────────────────────

export type InvitedAs = 'first_parent' | 'second_parent' | 'rep_coach';

/** One placed sign-up of the org (team set, accepted, division published, season live). */
export interface PlacedSignup {
  registrationId: string;
  childId: string;
  childFirstName: string;
  dateOfBirth: string | null;
  firstEmail: string | null;
  secondEmail: string | null;
}

/** What is already true of this address and each child. */
export interface AddressChildState {
  childId: string;
  /** 'verified' | 'invited' | 'requested' | … for a LIVE link of this address, or null. */
  liveStatus: string | null;
  endedBefore: boolean;
  otherLiveGuardians: number;
}

export interface Connectable {
  childId: string;
  firstName: string;
  invitedAs: InvitedAs;
  /** The rep roster entry, for the rep player of a rep invitation. */
  repEntryId: string | null;
  /** An unverified live link of this address to the child exists (an old invite/request): it is upgraded, not duplicated. */
  upgrade: boolean;
}

export type NotConnectedReason = 'already_connected' | 'adult' | 'ended' | 'cap';

/**
 * Every child an acceptance connects (ruling 3), and why any other child of the address is not connected. Pure: the caller
 * passes every placed sign-up of the org (the function picks the address's), the address's state per child, and the bands.
 *   · first_parent where the address is the first parent on ANY placed sign-up of the child, else second_parent;
 *   · the rep child of a rep invitation is connected too (invitedAs rep_coach unless the address is its parent on a sign-up);
 *   · `reconnects` (the club's Send again) lets an address back onto a child it left or was removed from — nothing else does.
 */
export function connectables(params: {
  email: string;
  placed: readonly PlacedSignup[];
  rep: { childId: string; firstName: string; entryId: string; dateOfBirth: string | null } | null;
  state: ReadonlyMap<string, AddressChildState>;
  bandOf: (dateOfBirth: string | null) => GuardianAgeBand;
  reconnects: boolean;
}): { connect: Connectable[]; skipped: { childId: string; firstName: string; reason: NotConnectedReason }[] } {
  const email = normalizeGuardianEmail(params.email);
  const byChild = new Map<string, { firstName: string; dob: string | null; first: boolean; second: boolean; repEntryId: string | null }>();
  for (const s of params.placed) {
    const isFirst = !!email && normalizeGuardianEmail(s.firstEmail) === email;
    const isSecond = !!email && normalizeGuardianEmail(s.secondEmail) === email;
    if (!isFirst && !isSecond) continue;
    const prior = byChild.get(s.childId);
    byChild.set(s.childId, {
      firstName: prior?.firstName ?? s.childFirstName,
      dob: prior?.dob ?? s.dateOfBirth,
      first: (prior?.first ?? false) || isFirst,
      second: (prior?.second ?? false) || isSecond,
      repEntryId: null,
    });
  }
  if (params.rep) {
    const prior = byChild.get(params.rep.childId);
    byChild.set(params.rep.childId, {
      firstName: prior?.firstName ?? params.rep.firstName,
      dob: prior?.dob ?? params.rep.dateOfBirth,
      first: prior?.first ?? false,
      second: prior?.second ?? false,
      repEntryId: params.rep.entryId,
    });
  }

  const connect: Connectable[] = [];
  const skipped: { childId: string; firstName: string; reason: NotConnectedReason }[] = [];
  for (const [childId, c] of byChild) {
    const st = params.state.get(childId);
    const skip = (reason: NotConnectedReason) => skipped.push({ childId, firstName: c.firstName, reason });
    if (params.bandOf(c.dob) === 'adult') { skip('adult'); continue; }
    if (st?.liveStatus === 'verified') { skip('already_connected'); continue; }
    if (st?.endedBefore && !params.reconnects && !st.liveStatus) { skip('ended'); continue; }
    if (!st?.liveStatus && (st?.otherLiveGuardians ?? 0) >= 2) { skip('cap'); continue; }
    connect.push({
      childId,
      firstName: c.firstName,
      invitedAs: c.first ? 'first_parent' : c.second ? 'second_parent' : 'rep_coach',
      repEntryId: c.repEntryId,
      upgrade: !!st?.liveStatus,
    });
  }
  return { connect, skipped };
}

// ── An invitation's state ─────────────────────────────────────────────────────────────────────

export interface InvitationRow {
  email: string;
  expiresAt: string;
  usedAt: string | null;
  usedByUserId: string | null;
  cancelledAt: string | null;
  replacedBy: string | null;
}

/**
 *   open                 — the accept page asks for the email (drawing tab 2, the main frame / A / B / C)
 *   expired_or_replaced  — D: "Email me a new invitation" (one answer for both, deliberately)
 *   joined               — E: this account already used it ("Open the team")
 *   no_longer_works      — F: unknown, cancelled, or used by someone else. Names the club's contact; no sign-in button.
 */
export type InvitationState = 'open' | 'expired_or_replaced' | 'joined' | 'no_longer_works';

export function invitationState(inv: InvitationRow | null, nowIso: string, userId: string | null): InvitationState {
  if (!inv) return 'no_longer_works';
  if (inv.cancelledAt) return 'no_longer_works';
  if (inv.usedAt) return userId && inv.usedByUserId === userId ? 'joined' : 'no_longer_works';
  if (inv.replacedBy || inv.expiresAt <= nowIso) return 'expired_or_replaced';
  return 'open';
}

/** The typed (or signed-in) address against the invited one, both normalized. The page never receives the invited address. */
export function emailMatches(invited: string, typed: string | null | undefined): boolean {
  const a = normalizeGuardianEmail(invited);
  const b = normalizeGuardianEmail(typed);
  return !!a && a === b;
}

/** "p••••••@example.com" — the first character of the name, then dots (3 to 6), then the domain. */
export function maskEmail(email: string): string {
  const e = normalizeGuardianEmail(email) ?? '';
  const at = e.indexOf('@');
  if (at < 1) return '•••';
  const local = e.slice(0, at);
  return `${local[0]}${'•'.repeat(Math.min(6, Math.max(3, local.length - 1)))}${e.slice(at)}`;
}
