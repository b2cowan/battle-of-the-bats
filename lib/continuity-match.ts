/**
 * Player Development 3C — the PURE returning-player matcher. No I/O, no framework: the
 * caller assembles identities from prior program years (rosters + tryout registrations)
 * and this module says which priors plausibly match a current player.
 *
 * Matching rules (plan-locked, supportive-not-verdict framing):
 *   HIGH     = exact DOB match  AND  (guardian-email match OR strong name match)
 *   POSSIBLE = guardian-email match AND strong name match, when DOB is missing on either
 *              side;  OR  exact DOB match with only a weak name match
 *   NEVER on guardian email alone — a shared family email across siblings must not
 *   suggest the wrong kid (name + DOB always participate).
 *
 * Display copy renders confidence as "possible returning player — verify", never a
 * verdict; the coach always decides.
 */

export type ContinuityKind = 'roster' | 'registration';

export interface ContinuityIdentity {
  kind: ContinuityKind;
  id: string;
  programYearId: string;
  firstName: string;
  lastName: string | null;
  dateOfBirth: string | null;
  guardianEmail: string | null;
}

export interface ContinuityMatch {
  prior: ContinuityIdentity;
  confidence: 'high' | 'possible';
}

/** The scan API's per-link response row — ONE definition shared by the server route and
 *  both verify doors (profile card + Decision Board), so a wire-shape change can't drift. */
export interface ContinuityRow {
  linkId: string;
  status: 'suggested' | 'confirmed';
  confidence: 'high' | 'possible';
  decidedAt: string | null;
  prior: {
    seasonLabel: string;
    firstName: string;
    lastName: string | null;
    dateOfBirth: string | null;
    guardianFirstName: string | null;
    guardianLastName: string | null;
    guardianEmail: string | null;
  };
}

function normEmail(e: string | null): string {
  return (e ?? '').trim().toLowerCase();
}

function normName(n: string | null): string {
  return (n ?? '').trim().toLowerCase().replace(/\s+/g, ' ');
}

/** Both first+last present and equal after normalization. */
function strongNameMatch(a: ContinuityIdentity, b: ContinuityIdentity): boolean {
  const af = normName(a.firstName), bf = normName(b.firstName);
  const al = normName(a.lastName), bl = normName(b.lastName);
  return af !== '' && al !== '' && af === bf && al === bl;
}

/** Same last name + same first initial ("Alex" vs "Alexandra" after a nickname change). */
function weakNameMatch(a: ContinuityIdentity, b: ContinuityIdentity): boolean {
  const af = normName(a.firstName), bf = normName(b.firstName);
  const al = normName(a.lastName), bl = normName(b.lastName);
  return al !== '' && al === bl && af !== '' && bf !== '' && af[0] === bf[0];
}

function dob(x: ContinuityIdentity): string {
  return (x.dateOfBirth ?? '').slice(0, 10);
}

function dobExactMatch(a: ContinuityIdentity, b: ContinuityIdentity): boolean {
  return dob(a) !== '' && dob(b) !== '' && dob(a) === dob(b);
}

/** "Missing" defined once — either side has no usable birth date. */
function dobMissing(a: ContinuityIdentity, b: ContinuityIdentity): boolean {
  return dob(a) === '' || dob(b) === '';
}

function emailMatch(a: ContinuityIdentity, b: ContinuityIdentity): boolean {
  const ae = normEmail(a.guardianEmail), be = normEmail(b.guardianEmail);
  return ae !== '' && ae === be;
}

/**
 * Matches for ONE current identity against a pool of prior identities. The caller is
 * responsible for excluding priors already paired with this current (any status — a
 * rejected pair is a remembered tombstone) and for restricting the pool to PRIOR program
 * years of the same team.
 */
export function matchPriorIdentities(
  current: ContinuityIdentity,
  priors: ContinuityIdentity[],
): ContinuityMatch[] {
  const matches: ContinuityMatch[] = [];
  for (const prior of priors) {
    if (prior.kind === current.kind && prior.id === current.id) continue;
    const dob = dobExactMatch(current, prior);
    const email = emailMatch(current, prior);
    const strong = strongNameMatch(current, prior);
    const weak = weakNameMatch(current, prior);

    if (dob && (email || strong)) {
      matches.push({ prior, confidence: 'high' });
    } else if (email && strong && dobMissing(current, prior)) {
      matches.push({ prior, confidence: 'possible' });
    } else if (dob && weak && !strong && email) {
      // Weak-name + DOB requires the EMAIL too: twins share DOB + last name by definition,
      // and a first-initial coincidence ("Ava"/"Alex") must not suggest the wrong sibling.
      // The intended case (nickname change within the same family) still matches via email.
      matches.push({ prior, confidence: 'possible' });
    }
  }
  // high first, then possible — stable within tiers (caller's pool order = season order).
  return matches.sort((a, b) => (a.confidence === b.confidence ? 0 : a.confidence === 'high' ? -1 : 1));
}
