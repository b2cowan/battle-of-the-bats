import { NextResponse } from 'next/server';
import {
  getRepTryout,
  getRepTryoutSessions,
  getRepTryoutRegistrations,
  getRepTryoutScores,
  getRepProgramYears,
} from '@/lib/db';
import { withObservability } from '@/lib/observability';
import { denyUnless } from '@/lib/coach-capabilities';
import { resolveCoachSeasonRead } from '@/lib/coach-season-read';

/**
 * Tryout HISTORY — the record of a tryout, not the machinery for running one (Chunk F, D-F1).
 *
 * Deliberately a SEPARATE read route rather than a `?year=` on the six live tryout endpoints.
 * Those endpoints are instruments: check-in, evaluator links, decisions, offer emails. Teaching
 * them to address a past season would put a year parameter one typo away from a write path, for
 * no gain — an archive wants one assembled payload, not six live hubs pointed backwards.
 *
 * Answers two owner-stated needs: is turnout growing year over year, and what did we say about
 * this candidate last time. Gated on the `tryouts` capability recorded against THAT season's
 * assignment row — a coach who wasn't cleared for tryouts then can't read them now.
 */
export const GET = withObservability(async (req: Request,
  { params }: { params: Promise<{ orgSlug: string; teamId: string }> },) => {
  const { orgSlug, teamId } = await params;
  const resolved = await resolveCoachSeasonRead(orgSlug, teamId, req);
  if ('error' in resolved) return resolved.error;
  const { programYear, capabilities, isReadOnly } = resolved;

  const denied = denyUnless(capabilities.tryouts, 'You do not have access to tryouts for this season.');
  if (denied) return denied;

  const tryout = await getRepTryout(programYear.id);
  if (!tryout) {
    return NextResponse.json({
      programYear, isReadOnly, tryout: null,
      sessions: [], candidates: [], turnout: 0, priorTurnout: null,
    });
  }

  // The prior season is knowable from `teamId` alone, so it resolves BEFORE the main batch and
  // its turnout query joins that batch — otherwise "how does this compare to last year" costs a
  // second sequential round trip on exactly the request Chunk F exists to serve.
  const allYears = await getRepProgramYears(teamId);
  const ordered = [...allYears].sort((a, b) => a.year - b.year);
  const idx = ordered.findIndex(y => y.id === programYear.id);
  const prior = idx > 0 ? ordered[idx - 1] : null;

  const [sessions, registrations, scores, priorRegistrations] = await Promise.all([
    getRepTryoutSessions(tryout.id),
    getRepTryoutRegistrations(programYear.id),
    getRepTryoutScores(tryout.id),
    prior ? getRepTryoutRegistrations(prior.id) : Promise.resolve(null),
  ]);

  // Average score per candidate across every category any evaluator scored — the same number the
  // scoreboard shows, recomputed here rather than imported so the archive never depends on a live
  // scoring surface staying mounted.
  const scoreTotals = new Map<string, { sum: number; n: number; notes: string[] }>();
  for (const s of scores) {
    const agg = scoreTotals.get(s.registrationId) ?? { sum: 0, n: 0, notes: [] };
    agg.sum += s.score;
    agg.n += 1;
    if (s.note?.trim()) agg.notes.push(s.note.trim());
    scoreTotals.set(s.registrationId, agg);
  }

  const candidates = registrations.map(r => {
    const agg = scoreTotals.get(r.id);
    return {
      id: r.id,
      playerFirstName: r.playerFirstName,
      playerLastName: r.playerLastName,
      status: r.status,
      offerResponse: r.offerResponse ?? null,
      averageScore: agg && agg.n ? Math.round((agg.sum / agg.n) * 10) / 10 : null,
      scoredCategories: agg?.n ?? 0,
      notes: agg?.notes ?? [],
    };
  });

  // Turnout against the season immediately before this one — "is the program growing" is a
  // comparison, and a bare count doesn't answer it. Null when this is the team's first season.
  const priorTurnout = priorRegistrations ? priorRegistrations.length : null;

  return NextResponse.json({
    programYear,
    isReadOnly,
    tryout: { id: tryout.id, isAnonymous: tryout.isAnonymous },
    sessions,
    candidates,
    turnout: registrations.length,
    priorTurnout,
    priorSeasonName: prior?.name ?? null,
  });
}, { route: '/api/coaches/[orgSlug]/teams/[teamId]/tryout-history' });
