import { NextResponse } from 'next/server';
import { getAuthContextWithRole } from '@/lib/api-auth';
import { houseLeagueRefusal } from '@/lib/house-league-gate';
import { getLeagueSeasonById } from '@/lib/db';
import { divisionInSeason, registrationsInSeason, teamsInSeason } from '@/lib/league-season-scope';
import { isSeasonDoorScope, parseScope, type FamilyAudienceScope } from '@/lib/families-audience';
import { resendSeasonEmail, seasonEmailPreview, sendSeasonEmail } from '@/lib/house-league-email';
import { writeOrgAudit } from '@/lib/org-audit';
import { withObservability } from '@/lib/observability';

export const dynamic = 'force-dynamic';
// A season's families go inside the request, a hundred to a provider request (the club's rule, Put to the owner 3).
export const maxDuration = 120;

/**
 * A HOUSE-LEAGUE SEASON EMAILS ITS FAMILIES (Club Tier Stage 9d-1, owner 9d1·1–12) — the season's door onto the club's
 * one engine (lib/house-league-email.ts → lib/families-email.ts). Gated by the SEASON's email right (the runners and the
 * registrar, every status, a finished season included — §0c), never the Families grant (9d1·2).
 *
 *   GET  ?orgSlug&kind=season|season_divisions|season_teams|season_statuses|season_families&divisionIds|teamIds|statuses|
 *        registrationIds — the window's read: the Who list, the allowance, Last sent, and this choice's reach.
 *   POST { action: 'send', kind, …ids, subject, body, expected, copyCoaches } — the press (one household goes through the
 *        household door and never counts); { action: 'resend', sendId } — "Send to the N it missed" on a stopped email.
 */

/** Who, from a query or a body, always inside the URL's season. */
function seasonScope(input: Record<string, unknown>, seasonId: string): FamilyAudienceScope | null {
  const scope = parseScope({ ...input, seasonId });
  return scope && (scope.kind === 'season' || isSeasonDoorScope(scope)) ? scope : null;
}

/** Every id a scope names is this season's (a foreign id is a 404, never a quietly smaller audience). */
async function scopeInSeason(scope: FamilyAudienceScope, seasonId: string): Promise<boolean> {
  if (scope.kind === 'season_divisions') {
    for (const divisionId of scope.divisionIds) if (!(await divisionInSeason(seasonId, divisionId))) return false;
  }
  if (scope.kind === 'season_teams') return teamsInSeason(seasonId, scope.teamIds);
  if (scope.kind === 'season_families') return registrationsInSeason(seasonId, scope.registrationIds);
  return true;
}

export const GET = withObservability(async (req: Request,
  { params }: { params: Promise<{ seasonId: string }> },) => {
  const url = new URL(req.url);
  const ctx = await getAuthContextWithRole({ orgSlug: url.searchParams.get('orgSlug') ?? undefined, requireOrgSlug: true });
  const err = houseLeagueRefusal(ctx, 'email');
  if (err) return err;

  const { seasonId } = await params;
  const season = await getLeagueSeasonById(seasonId, ctx!.org.id);
  if (!season) return NextResponse.json({ error: 'Season not found' }, { status: 404 });

  const q = Object.fromEntries(url.searchParams);
  const scope = q.kind ? seasonScope(q, seasonId) : null;
  if (q.kind && !scope) return NextResponse.json({ error: 'Unknown audience', code: 'kind' }, { status: 400 });
  if (scope && !(await scopeInSeason(scope, seasonId))) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(await seasonEmailPreview(ctx!, season, scope));
}, { route: '/api/admin/house-league/seasons/[seasonId]/emails' });

export const POST = withObservability(async (req: Request,
  { params }: { params: Promise<{ seasonId: string }> },) => {
  const ctx = await getAuthContextWithRole({ orgSlug: new URL(req.url).searchParams.get('orgSlug') ?? undefined, requireOrgSlug: true });
  const err = houseLeagueRefusal(ctx, 'email');
  if (err) return err;

  const { seasonId } = await params;
  const season = await getLeagueSeasonById(seasonId, ctx!.org.id);
  if (!season) return NextResponse.json({ error: 'Season not found' }, { status: 404 });
  // Email stays open on a finished season (§0c: a note to families is not a change to the season's record).
  const refused = houseLeagueRefusal(ctx, 'email', season);
  if (refused) return refused;

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }
  const action = body.action;

  if (action === 'resend') {
    if (typeof body.sendId !== 'string') return NextResponse.json({ error: 'Not found' }, { status: 404 });
    const r = await resendSeasonEmail(ctx!, season, body.sendId);
    if (!r.ok) return NextResponse.json(r.body, { status: r.status });
    await writeOrgAudit(ctx!.org.id, ctx!.user.id, null, 'families_emailed', { seasonId, resend: true, reached: r.reached, families: r.families });
    return NextResponse.json(r);
  }

  if (action === 'send') {
    const scope = seasonScope(body, seasonId);
    if (!scope) return NextResponse.json({ error: 'Unknown audience', code: 'kind' }, { status: 400 });
    if (!(await scopeInSeason(scope, seasonId))) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    const r = await sendSeasonEmail(ctx!, season, scope, body);
    if (!r.ok) return NextResponse.json(r.body, { status: r.status });
    if (!('one' in r)) {
      await writeOrgAudit(ctx!.org.id, ctx!.user.id, null, 'families_emailed', { seasonId, kind: scope.kind, families: r.families, reached: r.reached });
    }
    return NextResponse.json(r);
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
}, { route: '/api/admin/house-league/seasons/[seasonId]/emails' });
