import { NextResponse } from 'next/server';
import { getAuthContextWithRole } from '@/lib/api-auth';
import { houseLeagueRefusal } from '@/lib/house-league-gate';
import { getLeagueSeasonById } from '@/lib/db';
import { divisionInSeason } from '@/lib/league-season-scope';
import { readTeamChanges, tellTeamChanges } from '@/lib/house-league-team-changes-server';
import { TC_WINDOW } from '@/lib/house-league-team-changes-words';
import { withObservability } from '@/lib/observability';

/**
 * The families not yet told about team changes after a division is published (TC·1 to TC·8).
 *   · GET  — the Review window's read: each family and what changed for each child, with the fingerprint of the list.
 *   · POST — `{ divisionId, fingerprint, send: [email], skip: [email] }`: Send the families in `send`, record the families
 *     in `skip` as not emailed. Together they must be exactly the families untold now, or the answer is 409 `changed`.
 *     `{ divisionId, skipAll: true, count }` is the banner's Don't email: every family untold now, refused as `changed` if the
 *     count the convenor saw is not the count now.
 * Both need the right to run the division (owner, admin, league admin); the registrar neither sees nor does this.
 */
const NOT_PUBLISHED = 'This division is not published yet.';

export const GET = withObservability(async (req: Request,
  { params }: { params: Promise<{ seasonId: string }> },) => {
  const ctx = await getAuthContextWithRole({ orgSlug: new URL(req.url).searchParams.get('orgSlug') ?? undefined, requireOrgSlug: true });
  const err = houseLeagueRefusal(ctx, 'run');
  if (err) return err;

  const { seasonId } = await params;
  const season = await getLeagueSeasonById(seasonId, ctx!.org.id);
  if (!season) return NextResponse.json({ error: 'Season not found' }, { status: 404 });
  const refused = houseLeagueRefusal(ctx, 'run', season);
  if (refused) return refused;

  const divisionId = new URL(req.url).searchParams.get('divisionId');
  if (!(await divisionInSeason(seasonId, divisionId))) {
    return NextResponse.json({ error: 'Division not found' }, { status: 404 });
  }
  const read = await readTeamChanges(seasonId, divisionId!);
  if (!read) return NextResponse.json({ error: NOT_PUBLISHED, code: 'not_published' }, { status: 409 });
  return NextResponse.json(read);
}, { route: '/api/admin/house-league/seasons/[seasonId]/team-changes' });

export const POST = withObservability(async (req: Request,
  { params }: { params: Promise<{ seasonId: string }> },) => {
  const ctx = await getAuthContextWithRole({ orgSlug: new URL(req.url).searchParams.get('orgSlug') ?? undefined, requireOrgSlug: true });
  const err = houseLeagueRefusal(ctx, 'run');
  if (err) return err;

  const { seasonId } = await params;
  const season = await getLeagueSeasonById(seasonId, ctx!.org.id);
  if (!season) return NextResponse.json({ error: 'Season not found' }, { status: 404 });
  const refused = houseLeagueRefusal(ctx, 'run', season);
  if (refused) return refused;

  const body = (await req.json().catch(() => null)) ?? {};
  const { divisionId } = body;
  if (!(await divisionInSeason(seasonId, divisionId))) {
    return NextResponse.json({ error: 'Division not found' }, { status: 404 });
  }
  const strings = (v: unknown): string[] | null =>
    Array.isArray(v) && v.every(x => typeof x === 'string') ? (v as string[]) : null;

  let fingerprint: string;
  let send: string[];
  let skip: string[];
  if (body.skipAll === true) {
    const read = await readTeamChanges(seasonId, divisionId);
    if (!read) return NextResponse.json({ error: NOT_PUBLISHED, code: 'not_published' }, { status: 409 });
    if (typeof body.count !== 'number') return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
    if (body.count !== read.families.length) {
      return NextResponse.json({ error: TC_WINDOW.changed, code: 'changed' }, { status: 409 });
    }
    fingerprint = read.fingerprint; send = []; skip = read.families.map(f => f.email);
  } else {
    const s = strings(body.send);
    const k = strings(body.skip);
    if (typeof body.fingerprint !== 'string' || !s || !k) return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
    fingerprint = body.fingerprint; send = s; skip = k;
  }

  const result = await tellTeamChanges({
    org: ctx!.org, season, divisionId, actor: ctx!.user.id, fingerprint, send, skip,
  });
  if (result.refusal === 'finished') {
    return NextResponse.json({ error: 'This season is finished. Reopen it to change it.', finished: true }, { status: 423 });
  }
  if (result.refusal) {
    return NextResponse.json({ error: result.refusal === 'changed' ? TC_WINDOW.changed : NOT_PUBLISHED, code: result.refusal }, { status: 409 });
  }
  return NextResponse.json({
    ok: true, sentFamilies: result.sentFamilies, skippedFamilies: result.skippedFamilies,
    noEmailChildren: result.noEmailChildren, outcome: result.outcome, at: new Date().toISOString(),
  });
}, { route: '/api/admin/house-league/seasons/[seasonId]/team-changes' });
