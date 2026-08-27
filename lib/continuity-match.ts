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

/** The coalesced current-side id of a link (roster id when set, else registration id). */
export function linkCurrentId(link: { currentRosterId: string | null; currentRegistrationId: string | null }): string {
  return link.currentRosterId ?? link.currentRegistrationId ?? '';
}

/** The coalesced prior-side id of a link (roster id when set, else registration id). */
export function linkPriorId(link: { priorRosterId: string | null; priorRegistrationId: string | null }): string {
  return link.priorRosterId ?? link.priorRegistrationId ?? '';
}

/**
 * The single CONFIRMED link for a current entity, resolving the accept-boundary ALIAS in an
 * EXPLICIT priority: a link keyed by the entity's own id wins over one keyed by its
 * originating tryout registration (`currentIds` in priority order, most-specific first). One
 * definition so the profile card, the board, and the carry offer can never pick different
 * links for the same human (a current entity can hold a board-era registration-keyed link AND
 * a rollover-minted roster-keyed link). Pass falsy ids freely — they're skipped.
 */
export function findConfirmedLink<T extends {
  status: 'suggested' | 'confirmed' | 'rejected';
  currentRosterId: string | null; currentRegistrationId: string | null;
}>(links: T[], currentIds: (string | null | undefined)[]): T | null {
  const confirmedById = new Map<string, T>();
  for (const l of links) {
    if (l.status === 'confirmed') confirmedById.set(linkCurrentId(l), l);
  }
  for (const id of currentIds) {
    if (id && confirmedById.has(id)) return confirmedById.get(id)!;
  }
  return null;
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
export function strongNameMatch(a: ContinuityIdentity, b: ContinuityIdentity): boolean {
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

/**
 * Of everything the matcher found, the ONE prior season that may PRE-FILL "last season's team" on
 * the coach's Add player form — or null, meaning the coach types it themselves.
 *
 * The field is stored as the FAMILY'S CLAIM about their own history and the form captions a filled
 * value "Filled from last season", so the bar is not "we probably know this person" — it is "we can
 * STATE this". Two conditions, and each blocks a different way of writing a sentence nothing
 * supports:
 *
 *  · **`roster`, not `registration`.** A prior REGISTRATION means they tried out and did not make
 *    it. Pre-filling the team's name for them would tell the coach that a child they CUT played for
 *    the team — and would file that as something the family said.
 *
 *  · **A STRONG NAME MATCH — first AND last, both present, both equal.** ⚠ This is deliberately
 *    NOT `confidence === 'high'`, and the difference is the whole point. `high` is reached by
 *    `exact DOB + (email OR strong name)`, so a SIBLING WHO SHARES A BIRTHDAY AND THE FAMILY EMAIL
 *    ADDRESS — twins — reaches `high` with a completely different first name. Filtering on the tier
 *    reads like the careful choice and lets exactly the wrong case through. The name is what tells
 *    two children of one family apart, so the name is what this asks about.
 *
 *  Nothing further is needed: every match in the list already carries an exact birth-date match or
 *  a guardian-email match (they are the only two ways into the tiers at all), so "same full name
 *  AND one hard identifier" is the complete condition.
 *
 * ⚠ **THE MOST RECENT QUALIFYING SEASON WINS, and that needs `seasons` to be reliable.** A player
 * who was on the roster for three years in a row produces three equally-good matches, and the
 * caller captions the answer *"Filled from 2023 Season"*. Picking the first match in list order
 * would make that caption depend on the order Postgres happened to return rows in — the prior-pool
 * query carries no `ORDER BY` — so a coach could be told a returning player last played in a season
 * two years before the one they actually did. The value itself is the same either way (it is this
 * team's own name), but the sentence beside it is a claim, and this field's whole discipline is
 * that its claims are true. Pass the team's program years to rank by; omit them and it falls back
 * to list order, which is only safe when a caller knows there can be one match.
 *
 * Lives here rather than in the route so the rule is testable on its own and has one home.
 */
export function priorRosterSeasonForFill(
  current: ContinuityIdentity,
  matches: ContinuityMatch[],
  seasons?: { id: string; year: number }[],
): ContinuityMatch | null {
  const eligible = matches.filter(m => m.prior.kind === 'roster' && strongNameMatch(current, m.prior));
  if (eligible.length <= 1 || !seasons) return eligible[0] ?? null;
  const yearOf = new Map(seasons.map(s => [s.id, s.year]));
  return eligible.reduce((best, m) =>
    (yearOf.get(m.prior.programYearId) ?? -Infinity) > (yearOf.get(best.prior.programYearId) ?? -Infinity) ? m : best);
}
