import { NextResponse } from 'next/server';
import { getLatestClosedRepProgramYear } from '@/lib/db';
import { resolveCoachSeasonReadContext, seasonParam } from '@/lib/coach-season-read';
import { canLogGameMoment, hasRecordAccess } from '@/lib/coach-capabilities';
import { assembleSeasonWrapped } from '@/lib/rep-season-wrapped';
import { countRecapViewers } from '@/lib/family-engagement';
import { withObservability } from '@/lib/observability';

/**
 * Season Wrapped (Coach Portal Batch 3, wow #7). GET-only, and only for CLOSED seasons —
 * a live season's story isn't finished, and the Overview/Insights already narrate it.
 * Uses the season-READ resolver (accepts closed assignments) so the coach whose season was
 * just completed — the exact person the old access model locked out — can load it. No
 * money data in the payload: the card is built to be shared beyond the team.
 */
export const GET = withObservability(async (req: Request,
  { params }: { params: Promise<{ orgSlug: string; teamId: string }> },) => {
  const { orgSlug, teamId } = await params;
  // Chunk F: the year goes THROUGH the rail, not around it. Resolving it separately (as this
  // route used to) meant the access check ran against the team rather than the requested season —
  // a coach who joined in 2026 could open 2023's Wrapped. The rail 403s unless they were on that
  // season's staff, and hands back the season it actually admitted.
  const resolved = await resolveCoachSeasonReadContext(orgSlug, teamId, {
    yearId: seasonParam(req) ?? (await getLatestClosedRepProgramYear(teamId))?.id ?? null,
  });
  if ('error' in resolved) return resolved.error;
  const { team, programYear } = resolved;

  if (programYear.status !== 'completed' && programYear.status !== 'archived') {
    return NextResponse.json({ error: 'Season Wrapped is only available once a season is closed.' }, { status: 409 });
  }

  /**
   * ⚠ **A SEASON REVIEW IS A COACH'S, NOT A HELPER'S** (owner ruling 2026-08-03).
   *
   * This route gated on nothing but "did you hold an assignment on this season" — so every one of
   * the six paths that reach Season's End (the portal-root sign-in redirect, the archive sidebar,
   * both team switchers, the `?year=` season rail, a typed URL) served the whole season's story to
   * a parent volunteer who ran one station on one Tuesday. It is the LAST line, and it said yes.
   *
   * The reasoning is ALTITUDE, not names: after A1 there is nothing on this card a helper is
   * forbidden to *see* — its only person-level line is `First name #number`, which is baseline now.
   * What they have no claim to is the season — the record, the streak, the closest game, attendance
   * across every game day, the award winner. None of it was theirs. And the card carries a share
   * button that puts a child's first name on an image that leaves the app.
   *
   * ⚠ Keyed on `hasRecordAccess`, deliberately, NOT on a names gate — re-adding one would resurrect
   * the switch A1 just retired, and it is the same predicate the nav and the page use so the three
   * cannot drift.
   *
   * ⚠ **AND THAT PREDICATE IS WIDER THAN THIS DOOR STRICTLY NEEDS — an accepted trade, not an
   * oversight.** `hasRecordAccess` is a union of seven duties, so someone granted ONLY `money` or
   * ONLY `documents` — duties that touch no game and no player — also passes here and receives the
   * season highlight card and its share button. That follows directly from the owner's Option A
   * ruling (sections follow the duties held, no new grant), and giving this one door a narrower
   * private predicate would re-introduce exactly the bespoke per-surface gating A1 deleted. If that
   * width is ever judged too generous, it is an owner decision — not a quiet tightening here.
   */
  if (!hasRecordAccess(resolved.capabilities)) {
    return NextResponse.json({ error: 'This season has finished.' }, { status: 403 });
  }

  const wrapped = await assembleSeasonWrapped(team, programYear, {
    fallbackColor: resolved.ctx.org.themePrimary ?? null,
    /**
     * Game-Day P2 — the bench moment rides a NARROWER door than the rest of this card.
     *
     * ⚠ The gate above (`hasRecordAccess`) is a union of seven duties, deliberately wide (see
     * its note). That width is fine for a season's story; it is not fine for a coach's private
     * line about a child, which every other surface gates on "can you run the bench". Without
     * this, a money-only or documents-only assistant would read through Wrapped something they
     * cannot see on the console or the player's page — a new sensitive field inheriting an old
     * door instead of being asked its own question.
     */
    includeMoments: canLogGameMoment(resolved.capabilities),
  });

  /**
   * Chunk D 3.5 — "did the families read it?", attached HERE rather than on a new route.
   *
   * Season's End is where a coach looks back at a finished season, and this route is already
   * approved to serve one. A recap count is only ever a CLOSED season's fact (families cannot
   * open a recap before the season closes), so the live-season family panel — which is where
   * this instinctively belongs — could only ever have shown a zero.
   *
   * ⚠ COUNTS, NEVER NAMES. `countRecapViewers` returns two integers and nothing else exists to
   * return (see lib/family-engagement.ts). Gated on `rosterPii`: a coach who is not trusted
   * with family contact details is not told how many of those families read a child's record.
   */
  const recapEngagement = resolved.capabilities.rosterPii
    ? await countRecapViewers({ repTeamId: teamId, programYearId: programYear.id })
    : null;

  return NextResponse.json({ wrapped, recapEngagement });
}, { route: '/api/coaches/[orgSlug]/teams/[teamId]/wrapped' });
