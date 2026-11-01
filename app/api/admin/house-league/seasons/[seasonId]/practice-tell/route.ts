import { NextResponse, type NextRequest } from 'next/server';
import { getAuthContextWithRole } from '@/lib/api-auth';
import { houseLeagueRefusal } from '@/lib/house-league-gate';
import { getLeagueSeasonById, getDivisionsForSeason } from '@/lib/db';
import { withObservability } from '@/lib/observability';
import { writeOrgAudit } from '@/lib/org-audit';
import { isUuid } from '@/lib/utils';
import { readTell, readTellReminders, resendPracticeNotice, tellFamilies, type TellSaw } from '@/lib/league-practice-tell-server';
import { PRACTICE_TELL_WORDS } from '@/lib/league-practice-tell';
import { divisionInSeason } from '@/lib/league-season-scope';

export const dynamic = 'force-dynamic';
// A division's families go inside the request, a hundred to a provider request (the schedule notice's rule).
export const maxDuration = 120;

/**
 * TELL THE FAMILIES THEIR PRACTICE TIMES (House League Stage 9d-3 Parts 2–3, frames c1–c3; lib/league-practice-tell-server.ts
 * holds the rules). ⚖ WHO: the league's runners — owner, admin, league admin (`houseLeagueRefusal 'run'`). A registrar or a
 * treasurer sees none of it: the step names families and their addresses, and it emails them.
 * GET `?divisionId=`: the Tell step's read. GET `?reminders=1`: each division's count of teams whose families haven't
 * been told (frame c3, the schedule's amber count).
 * POST `{ action: 'send', divisionId, saw, families }`: the press; `{ action: 'resend', noticeId }`: "Send again".
 * A finished season refuses a send (423).
 */

const R = PRACTICE_TELL_WORDS.refusals;

/** The division's name, once the handler has tied its id to the season (divisionInSeason). */
async function divisionOf(seasonId: string, divisionId: string) {
  const divisions = await getDivisionsForSeason(seasonId);
  const d = divisions.find(x => x.id === divisionId);
  return d ? { id: d.id, name: d.name } : null;
}

export const GET = withObservability(async (req: NextRequest, { params }: { params: Promise<{ seasonId: string }> }) => {
  const { seasonId } = await params;
  const url = new URL(req.url);
  const ctx = await getAuthContextWithRole({ orgSlug: url.searchParams.get('orgSlug') ?? undefined, requireOrgSlug: true });
  const err = houseLeagueRefusal(ctx, 'run');
  if (err || !ctx) return err!;
  const season = await getLeagueSeasonById(seasonId, ctx.org.id);
  if (!season) return NextResponse.json({ error: R.notFound, code: 'not_found' }, { status: 404 });
  if (url.searchParams.get('reminders')) {
    const finished = season.status === 'completed' || season.status === 'archived';
    return NextResponse.json({ divisions: finished ? {} : await readTellReminders(ctx.org.id, season.id) });
  }
  const divisionId = (url.searchParams.get('divisionId') ?? '').toLowerCase();
  const division = isUuid(divisionId) && (await divisionInSeason(season.id, divisionId)) ? await divisionOf(season.id, divisionId) : null;
  if (!division) return NextResponse.json({ error: R.badRequest, code: 'bad_request' }, { status: 400 });
  return NextResponse.json(await readTell(ctx.org, season, division));
}, { route: '/api/admin/house-league/seasons/[seasonId]/practice-tell' });

function readSaw(v: unknown): TellSaw[] | null {
  if (!Array.isArray(v) || v.length > 500) return null;
  const out: TellSaw[] = [];
  for (const x of v) {
    if (!x || typeof x !== 'object') return null;
    const { teamId, saw, kind } = x as Record<string, unknown>;
    if (typeof teamId !== 'string' || !isUuid(teamId) || (saw !== null && typeof saw !== 'string') || (kind !== 'first' && kind !== 'change')) return null;
    out.push({ teamId: teamId.toLowerCase(), saw: saw as string | null, kind });
  }
  return out;
}

export const POST = withObservability(async (req: NextRequest, { params }: { params: Promise<{ seasonId: string }> }) => {
  const { seasonId } = await params;
  const ctx = await getAuthContextWithRole({ orgSlug: new URL(req.url).searchParams.get('orgSlug') ?? undefined, requireOrgSlug: true });
  const err = houseLeagueRefusal(ctx, 'run');
  if (err || !ctx) return err!;
  const season = await getLeagueSeasonById(seasonId, ctx.org.id);
  if (!season) return NextResponse.json({ error: R.notFound, code: 'not_found' }, { status: 404 });
  const refused = houseLeagueRefusal(ctx, 'run', season);
  if (refused) return refused;
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ error: R.badRequest, code: 'bad_request' }, { status: 400 });

  if (body.action === 'resend') {
    if (typeof body.noticeId !== 'string' || !isUuid(body.noticeId)) return NextResponse.json({ error: R.notFound, code: 'not_found' }, { status: 404 });
    const r = await resendPracticeNotice({ org: ctx.org, season, noticeId: body.noticeId.toLowerCase() });
    if ('refusal' in r) {
      return r.refusal === 'finished'
        ? NextResponse.json({ error: R.finished, code: 'finished' }, { status: 423 })
        : NextResponse.json({ error: R.notFound, code: 'not_found' }, { status: 404 });
    }
    await writeOrgAudit(ctx.org.id, ctx.user.id, null, 'families_emailed', { seasonId, resend: true, notice: body.noticeId, practices: true, reached: r.reached, families: r.families });
    return NextResponse.json({ ok: true, ...r });
  }

  if (body.action === 'send') {
    const divisionId = typeof body.divisionId === 'string' ? body.divisionId.toLowerCase() : '';
    const division = isUuid(divisionId) && (await divisionInSeason(season.id, divisionId)) ? await divisionOf(season.id, divisionId) : null;
    const saw = readSaw(body.saw);
    if (!division || !saw || typeof body.families !== 'number') return NextResponse.json({ error: R.badRequest, code: 'bad_request' }, { status: 400 });
    const r = await tellFamilies({ org: ctx.org, season, division, actorId: ctx.user.id, saw, families: body.families });
    if (r.refusal === 'finished') return NextResponse.json({ error: R.finished, code: 'finished' }, { status: 423 });
    if (r.refusal === 'changed') return NextResponse.json({ error: PRACTICE_TELL_WORDS.changed, code: 'changed' }, { status: 409 });
    if (r.refusal === 'sending') return NextResponse.json({ error: R.sending, code: 'sending' }, { status: 409 });
    if (r.refusal === 'already') return NextResponse.json({ error: PRACTICE_TELL_WORDS.everyoneTitle, code: 'already' }, { status: 409 });
    if (r.refusal) return NextResponse.json({ error: R.nothing, code: r.refusal }, { status: 409 });
    await writeOrgAudit(ctx.org.id, ctx.user.id, null, 'families_emailed', { seasonId, notice: r.noticeId, practices: true, reached: r.reached, families: r.families });
    return NextResponse.json({ ok: true, ...r });
  }
  return NextResponse.json({ error: R.badRequest, code: 'bad_request' }, { status: 400 });
}, { route: '/api/admin/house-league/seasons/[seasonId]/practice-tell' });
