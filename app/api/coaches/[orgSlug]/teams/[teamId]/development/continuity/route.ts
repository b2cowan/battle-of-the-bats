import { NextResponse } from 'next/server';
import { getAuthContext, unauthorized, forbidden } from '@/lib/api-auth';
import {
  getCoachingAssignmentsForUser,
  getActiveRepProgramYear,
  getRepProgramYears,
  getRepRosterPlayers,
  getRepTeamContinuityLinks,
  getRepTryout,
  suggestContinuityLinksBulk,
  getPriorContinuityIdentities,
  getCurrentCycleContinuityIdentities,
} from '@/lib/db';
import { withObservability } from '@/lib/observability';
import { denyUnless, canWriteDevelopment } from '@/lib/coach-capabilities';
import { matchPriorIdentities, type ContinuityIdentity, type ContinuityRow } from '@/lib/continuity-match';

/**
 * The returning-player SCAN (Player Development 3C). HEAD-COACH ONLY — the compare payload
 * carries guardian identity from prior seasons, the same sensitivity class as the tryout
 * Decide surfaces. Never called from (or rendered on) blind evaluator screens.
 *
 * ?target=registrations           → current tryout cycle's candidates (Decision Board chips)
 * ?target=roster                  → current active roster rows (the manual-add door, D5)
 * ?target=roster&playerId=<id>    → ONE player's slice (the profile card — no whole-roster
 *                                   match work per profile visit)
 *
 * Scanning bulk-INSERTS new `suggested` pairs — existing rows of ANY status are excluded
 * up front (a rejected row is the never-re-suggest tombstone), and a concurrent-scan race
 * falls back to per-row inserts in lib/db. Response returns suggested + confirmed links per
 * current entity with the prior side's compare data.
 *
 * While a tryout is BLIND (is_anonymous), target=registrations answers { blind: true } with
 * no links and does NO matching: pairing a prior season's named record with a bib is a
 * server-side de-anonymization, and client render gates don't survive the network tab.
 */
export const GET = withObservability(async (req: Request,
  { params }: { params: Promise<{ orgSlug: string; teamId: string }> },) => {
  const { orgSlug, teamId } = await params;

  const ctx = await getAuthContext({ orgSlug, requireOrgSlug: true });
  if (!ctx) return unauthorized();
  if (ctx.org.slug !== orgSlug) return forbidden();

  const assignments = await getCoachingAssignmentsForUser(ctx.org.id, ctx.user.id);
  const assignment = assignments.find(a => a.teamId === teamId);
  if (!assignment) return forbidden();
  const denied = denyUnless(canWriteDevelopment(assignment.capabilities), 'Only the head coach can review returning players.');
  if (denied) return denied;

  const url = new URL(req.url);
  const target = url.searchParams.get('target') === 'roster' ? 'roster' : 'registrations';
  const onlyPlayerId = url.searchParams.get('playerId');

  const programYear = await getActiveRepProgramYear(teamId);
  if (!programYear) {
    return NextResponse.json({ error: 'No active program year for this team' }, { status: 404 });
  }

  // Blind gate (fail closed — no tryout row reads as blind, matching the board API).
  if (target === 'registrations') {
    const tryout = await getRepTryout(programYear.id);
    if (!tryout || tryout.isAnonymous) {
      return NextResponse.json({ target, blind: true, byCurrent: {} });
    }
  }

  const [{ identities: priors }, years, links] = await Promise.all([
    getPriorContinuityIdentities(teamId, programYear.id),
    getRepProgramYears(teamId),
    getRepTeamContinuityLinks(teamId),
  ]);
  const seasonLabelByYearId = new Map(years.map(y => [y.id, y.name]));
  const priorById = new Map(priors.map(p => [p.id, p]));

  // Current side. `aliasId` = the OTHER id denoting the same person (an accepted player's
  // originating tryout registration): links decided on the Decision Board are keyed by the
  // registration id, and they must follow the player across acceptance — surface under the
  // roster id AND block re-suggesting the same pair (the review's accept-boundary alias).
  let currents: { kind: 'roster' | 'registration'; id: string; aliasId: string | null; identity: ContinuityIdentity }[];
  if (target === 'roster') {
    const players = (await getRepRosterPlayers(programYear.id)).filter(p => p.status === 'active');
    currents = players.map(p => ({
      kind: 'roster' as const,
      id: p.id,
      aliasId: p.tryoutRegistrationId ?? null,
      identity: {
        kind: 'roster' as const, id: p.id, programYearId: programYear.id,
        firstName: p.playerFirstName ?? '', lastName: p.playerLastName ?? null,
        dateOfBirth: p.playerDateOfBirth ?? null, guardianEmail: p.guardianEmail ?? null,
      },
    }));
  } else {
    const regs = await getCurrentCycleContinuityIdentities(programYear.id);
    currents = regs.map(r => ({
      kind: 'registration' as const,
      id: r.id,
      aliasId: null,
      identity: {
        kind: 'registration' as const, id: r.id, programYearId: r.programYearId,
        firstName: r.firstName, lastName: r.lastName,
        dateOfBirth: r.dateOfBirth, guardianEmail: r.guardianEmail,
      },
    }));
  }
  if (onlyPlayerId) currents = currents.filter(c => c.id === onlyPlayerId);

  // Pairs that already have a lifecycle row (any status) never re-suggest — checked under
  // BOTH the current entity's own id and its alias (a pair rejected on the board must not
  // resurrect on the roster profile under the new roster id).
  const pairKey = (currentId: string, priorId: string) => `${currentId}:${priorId}`;
  const existingPairs = new Set(links.map(l =>
    pairKey(l.currentRosterId ?? l.currentRegistrationId ?? '', l.priorRosterId ?? l.priorRegistrationId ?? '')));

  const pending: Parameters<typeof suggestContinuityLinksBulk>[0] = [];
  for (const current of currents) {
    for (const m of matchPriorIdentities(current.identity, priors)) {
      if (existingPairs.has(pairKey(current.id, m.prior.id))) continue;
      if (current.aliasId && existingPairs.has(pairKey(current.aliasId, m.prior.id))) continue;
      existingPairs.add(pairKey(current.id, m.prior.id));
      pending.push({
        orgId: ctx.org.id,
        teamId,
        currentRosterId: current.kind === 'roster' ? current.id : null,
        currentRegistrationId: current.kind === 'registration' ? current.id : null,
        priorRosterId: m.prior.kind === 'roster' ? m.prior.id : null,
        priorRegistrationId: m.prior.kind === 'registration' ? m.prior.id : null,
        confidence: m.confidence,
      });
    }
  }
  const inserted = await suggestContinuityLinksBulk(pending);
  const freshLinks = [...links, ...inserted];

  // Response: suggested + confirmed links per current entity, with compare data. Links
  // keyed by an alias id (board-era decisions) surface under the canonical requested id.
  const canonicalById = new Map<string, string>();
  for (const c of currents) {
    canonicalById.set(c.id, c.id);
    if (c.aliasId) canonicalById.set(c.aliasId, c.id);
  }
  const byCurrent: Record<string, ContinuityRow[]> = {};
  for (const l of freshLinks) {
    if (l.status === 'rejected') continue;
    const currentId = canonicalById.get(l.currentRosterId ?? l.currentRegistrationId ?? '');
    if (!currentId) continue; // outside the requested slice
    const priorId = l.priorRosterId ?? l.priorRegistrationId ?? '';
    const prior = priorById.get(priorId);
    if (!prior) continue; // prior outside this team's pool (shouldn't happen; skip honestly)
    (byCurrent[currentId] ?? (byCurrent[currentId] = [])).push({
      linkId: l.id,
      status: l.status,
      confidence: l.confidence,
      decidedAt: l.decidedAt,
      prior: {
        seasonLabel: seasonLabelByYearId.get(prior.programYearId) ?? 'a previous season',
        firstName: prior.firstName,
        lastName: prior.lastName,
        dateOfBirth: prior.dateOfBirth,
        guardianFirstName: prior.guardianFirstName,
        guardianLastName: prior.guardianLastName,
        guardianEmail: prior.guardianEmail,
      },
    });
  }

  return NextResponse.json({ target, byCurrent });
}, { route: '/api/coaches/[orgSlug]/teams/[teamId]/development/continuity' });
