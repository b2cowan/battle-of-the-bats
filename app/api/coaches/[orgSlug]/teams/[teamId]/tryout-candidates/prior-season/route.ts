import { NextResponse } from 'next/server';
import { resolveLiveCoachTeamContext } from '@/lib/coach-route-context';
import { getRepProgramYears, getPriorContinuityIdentities } from '@/lib/db';
import { matchPriorIdentities, priorRosterSeasonForFill } from '@/lib/continuity-match';
import { denyUnless } from '@/lib/coach-capabilities';
import { withObservability } from '@/lib/observability';

/**
 * "Have we seen this child before, and if so, did they PLAY for us?" — the one question behind the
 * Add player form's `Last season's team` pre-fill (COACH_ADD_PLAYER_FORM_BUILD_PROMPT.md §2,
 * owner-approved 2026-08-26).
 *
 * ⚠⚠ **ONLY A PRIOR ROSTER ROW WITH A FULL NAME MATCH FILLS THE BOX** — the exact rule, with its
 * reasoning, is on `priorRosterSeasonForFill` in `lib/continuity-match.ts`, under a test that
 * proves each half refuses on its own. In short: a prior TRYOUT REGISTRATION means the child was
 * CUT and never played here, and a match on birth date plus a shared family email is what TWINS
 * look like — so neither may write "Filled from last season" over a coach's form.
 *
 * Everything else returns nothing at all, and the coach types whatever is true.
 *
 * ⚠ **POST, not GET, and not because anything is written.** The request body carries a child's
 * name, birth date and a guardian's email address — typed, not yet saved anywhere. On a GET those
 * would ride in the query string, which is the part of a request that ends up in access logs,
 * proxy logs and browser history. Nothing here mutates; the verb is chosen for where the PII goes.
 *
 * ⚠⚠ **HEAD COACH ONLY, AND `tryouts` ALONE IS NOT ENOUGH.** This asks a question the caller
 * CHOOSES — "was a child with this name, this birth date and this guardian email on your roster in
 * a past season?" — and answers yes or no. That is a confirmation oracle over prior-season family
 * PII, and prior-season identity is a stricter class than the current tryout cycle: the sibling
 * route that serves the same pool (`development/continuity`) has always been `isHeadCoach` only,
 * saying "Only the head coach can review returning players."
 *
 * `tryouts` is **delegable** — a head coach can grant it to an assistant helping run tryout day
 * while deliberately leaving `rosterPii` ("Contacts & birthdates") switched off. Gating on
 * `tryouts` alone therefore hands that assistant a way to brute-force the birth date, or confirm a
 * guessed guardian email, of a child who played LAST season and is not a candidate this year —
 * somebody they have no legitimate view of at all. Player names are baseline-visible to every
 * coach, so the attacker already holds the other half of the pair.
 *
 * ⚠ This route's first version said, in as many words, that `tryouts` "is the head coach". It is
 * not, and the whole gap followed from believing it. Do not narrow this gate back.
 *
 * An assistant simply gets no pre-fill: the client treats a non-ok answer as "no suggestion", the
 * box stays empty, and they type it themselves. Nothing on the form stops working.
 *
 * ⚠ **No blind gate, deliberately.** The mockup this was built from argued the pre-fill must wait
 * for names, because filling in a prior season's team while blind evaluation is on would leak a
 * returning player's identity onto a blind screen. That reasoning expired: as of the 2026-08-26
 * ruling the head coach is never blind on any tryout screen (blind is a HELPER-side rule now), the
 * check-in list shows every name unconditionally, and the decision board asks for its candidates
 * un-blinded. With the gate above, the only caller here is the head coach — a blind condition
 * would be dead code wearing the costume of a safeguard.
 *
 * ⚠ **Not a look-back endpoint, and reads no year.** It resolves the team's LIVE season like every
 * other coach route and derives the prior seasons server-side — the caller cannot name one. See
 * `tests/unit/coach-history-endpoint-guard.test.ts`; this route must never appear in
 * `HISTORY_ENDPOINTS`.
 */
export const POST = withObservability(async (req: Request,
  { params }: { params: Promise<{ orgSlug: string; teamId: string }> },) => {
  const { orgSlug, teamId } = await params;
  const resolved = await resolveLiveCoachTeamContext(orgSlug, teamId);
  if ('error' in resolved) return resolved.error;
  // Both halves, and the second is the one that matters — see the note above. `tryouts` is
  // delegable to an assistant; prior-season family PII is not theirs to confirm.
  const caps = resolved.assignment.capabilities;
  const denied = denyUnless(caps.tryouts && caps.isHeadCoach,
    'Only the head coach can look up a returning player.');
  if (denied) return denied;

  const body = await req.json().catch(() => ({}));
  const str = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
  const firstName = str(body.playerFirstName, 80);
  const lastName = str(body.playerLastName, 80);
  const dateOfBirth = str(body.playerDateOfBirth, 10);
  const guardianEmail = str(body.guardianEmail, 200);

  // The matcher never fires on a first name alone (a shared family email must not suggest a
  // sibling, so name and birth date always participate). Answering "no" here saves the whole
  // prior-season fetch on every keystroke of a name the coach has only started typing.
  if (!firstName || (!lastName && !dateOfBirth && !guardianEmail)) {
    return NextResponse.json({ lastSeasonTeam: null, seasonLabel: null });
  }

  const years = await getRepProgramYears(teamId);
  const { identities } = await getPriorContinuityIdentities(teamId, resolved.programYear.id, years);
  if (identities.length === 0) {
    return NextResponse.json({ lastSeasonTeam: null, seasonLabel: null });
  }

  // The two-condition rule lives in ONE place, next to the matcher it filters.
  const current = {
    kind: 'registration' as const, id: '', programYearId: resolved.programYear.id,
    firstName, lastName, dateOfBirth, guardianEmail,
  };
  const match = priorRosterSeasonForFill(current, matchPriorIdentities(current, identities), years);
  if (!match) return NextResponse.json({ lastSeasonTeam: null, seasonLabel: null });

  return NextResponse.json({
    // The team is the same entity across seasons, so the team's own name IS where they played —
    // this is a coach recognising one of their own returning players, not tracing a transfer.
    lastSeasonTeam: resolved.team.name,
    // Names the season the claim came from, so the note under the box can be specific about
    // WHICH last season it means on a team that has run for years.
    seasonLabel: years.find(y => y.id === match.prior.programYearId)?.name ?? null,
  });
}, { route: '/api/coaches/[orgSlug]/teams/[teamId]/tryout-candidates/prior-season' });
