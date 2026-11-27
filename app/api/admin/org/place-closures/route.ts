import { NextResponse } from 'next/server';
import { forbidden } from '@/lib/api-auth';
import { withObservability } from '@/lib/observability';
import { hasModuleEntitlement } from '@/lib/module-entitlements';
import { isCalendarDate, daysBetweenDateStrings } from '@/lib/timezone';
import { isUuid } from '@/lib/utils';
import { rainLine } from '@/lib/league-rainout';
import { CLOSURE_MAX_EXTRA_DAYS } from '@/lib/place-closures';
import { pressPlaceClosure } from '@/lib/place-closures-server';
import { CLOSE_LINE_MAX, CLOSE_MAX_ENTRIES, CLOSE_WORDS as W, closureRows, seesEveryProgram } from '@/lib/place-closure-window';
import { closureActor, placeClosureGate } from '@/lib/place-closure-route';
import {
  closeFrame, closeSource, mayCloseEveryPlaceHere, seasonNextDay, seasonPlacesOn, sendAfterPress, showingClosureFacts,
} from '@/lib/place-closure-window-server';

// The press sends inside the request: one send per division of every season, then the rep coaches.
export const maxDuration = 120;

/** At most, as the press's own limits (mig 549): 10 entries (a park or a diamond), 500 house league games, 200 rep games,
 *  500 links. */
const MAX = { places: CLOSE_MAX_ENTRIES, league: 500, rep: 200, links: 500 };

/**
 * CLOSE A PLACE (Club Website Stage 2, Session 2B; rulings K1–K17; mig 539).
 *   GET  — the window's frame (the club's places, its day, what this person may do), the closures showing now (the
 *          Overview's line, the window's preview) and the Venue library's rows (S4, a game counted once per row). With `first` and `places` (`all`, or `venueId[:facilityId]` comma
 *          separated) and optionally `last`: the window's read of those places on those days. With `seasonId` and `day`:
 *          that season's places that day (the house league schedule's button, K15).
 *   POST { pressKey, places, firstDay, lastDay, verb, line, league, rep, links } — the press (one database step, all or
 *          nothing), then the sends: the families per division (the Rainout's own send) and the rep coaches (K5, K10).
 * ⚖ K1: owner, admin, house league admin (`canClosePlace`). Every place at once only for an owner or an admin — and (T1,
 *   owner 2026-11-26) a house league admin from a season's schedule (`from` on the read, `seasonId` on the press) in a
 *   club with no places.
 * ⚖ K14: the places gate (League Plus, Club, Club · Association), on the server. Where it fails these answer 404, never an
 *   upgrade sentence: the doors are absent there. The rep steps are refused where the club runs no rep teams.
 */
const gate = placeClosureGate;

const bad = () => NextResponse.json({ error: W.errInvalid }, { status: 400 });

/** `all` → every place; `venueId` or `venueId:facilityId`, comma separated. Null when malformed. */
function parsePlaces(raw: string | null): { venueId: string | null; facilityId: string | null }[] | null {
  if (!raw) return null;
  if (raw === 'all') return [{ venueId: null, facilityId: null }];
  const parts = raw.split(',').map(p => p.split(':'));
  if (!parts.length || parts.length > MAX.places) return null;
  const out = parts.map(([v, f]) => ({ venueId: v ?? null, facilityId: f ?? null }));
  return out.every(p => isUuid(p.venueId) && (p.facilityId === null || isUuid(p.facilityId))) ? out : null;
}

const daysOk = (first: unknown, last: unknown) =>
  isCalendarDate(first as string) && isCalendarDate(last as string) && (last as string) >= (first as string)
  && daysBetweenDateStrings(first as string, last as string) <= CLOSURE_MAX_EXTRA_DAYS;

export const GET = withObservability(async (req: Request) => {
  const g = await gate(req);
  if (g.refused) return g.refused;
  const { ctx } = g;
  const q = new URL(req.url).searchParams;
  // The window's own reads (a season's places, a day's games) never use the closures, and run on every tick: only the
  // pages' bare read pays for them.
  const windowRead = q.has('seasonId') || q.has('day') || q.has('first');
  const [read, facts] = await Promise.all([closeFrame(ctx.org, ctx.role), windowRead ? [] : showingClosureFacts(ctx.org.id)]);
  // S4: the Venue library's rows, each counting a game once; the game ids stay here. K1: no team's name is in either.
  const closures = facts.map(x => x.closure);
  const rows = closureRows(facts, new Set(read.venues.filter(v => v.allDiamonds).map(v => v.id)));
  // K1 + T1: whether "All our fields" is offered is the server's one rule — an owner or an admin; a house league admin from
  // a season (`from`) in a club with no places. The window offers what this says and nothing more.
  const canAll = await mayCloseEveryPlaceHere(ctx.org, ctx.role, read.venues.length, q.get('from'));
  const frame = { ...read, canAll };

  // K15: a season's places on the window's days, in the club's name order (the press's order), at most the press's 10.
  // With `next=1` (the window opening) and nothing that day, the next day the season has games (the Rainout's rule).
  let seasonPlaces: string[] | null = null;
  let seasonDay: string | null = null;
  const seasonId = q.get('seasonId'); const day = q.get('day');
  if (seasonId || day) {
    const dayLast = q.get('dayLast') ?? day;
    if (!isUuid(seasonId) || !daysOk(day, dayLast)) return bad();
    const inOrder = async (d: string, l: string) => {
      const used = new Set(await seasonPlacesOn(ctx.org.id, seasonId, d, l));
      return frame.venues.filter(v => used.has(v.id)).map(v => v.id).slice(0, MAX.places);
    };
    seasonDay = day!;
    seasonPlaces = await inOrder(day!, dayLast!);
    if (!seasonPlaces.length && q.get('next') === '1') {
      const next = await seasonNextDay(ctx.org.id, seasonId, day!);
      if (next && next !== day) { seasonDay = next; seasonPlaces = await inOrder(next, next); }
    }
  }

  let source = null;
  const first = q.get('first');
  if (first) {
    const last = q.get('last') ?? first;
    const places = parsePlaces(q.get('places'));
    if (!places || !daysOk(first, last)) return bad();
    // K1 + T1: every place at once only where the frame offers it.
    if (places[0].venueId === null && !canAll) return forbidden();
    source = await closeSource(ctx.org, ctx.role, { places, firstDay: first, lastDay: last });
    if (!source) return NextResponse.json({ error: W.errNotFound }, { status: 404 });
  }
  return NextResponse.json({ frame, closures, rows, seasonPlaces, seasonDay, source });
}, { route: '/api/admin/org/place-closures' });

type Posted = { id?: unknown; seen?: unknown };
const seenOk = (x: Posted) => !!x && isUuid(x.id) && typeof x.seen === 'string' && !Number.isNaN(Date.parse(x.seen));

export const POST = withObservability(async (req: Request) => {
  const g = await gate(req);
  if (g.refused) return g.refused;
  const { ctx } = g;
  const body = await req.json().catch(() => null) as Record<string, unknown> | null;
  if (!body) return bad();
  const verb = body.verb;
  const line = rainLine(body.line);
  const places = Array.isArray(body.places) ? (body.places as { venueId?: unknown; facilityId?: unknown }[]) : null;
  const league = Array.isArray(body.league) ? (body.league as Posted[]) : null;
  const rep = Array.isArray(body.rep) ? (body.rep as Posted[]) : null;
  const links = Array.isArray(body.links) ? (body.links as { kind?: unknown; id?: unknown; venueId?: unknown }[]) : null;
  if (!isUuid(body.pressKey) || (verb !== 'postponed' && verb !== 'cancelled') || !daysOk(body.firstDay, body.lastDay)
      || (line && line.length > CLOSE_LINE_MAX) || !places || !league || !rep || !links
      || !places.length || places.length > MAX.places || league.length > MAX.league || rep.length > MAX.rep || links.length > MAX.links
      || !places.every(p => p && (p.venueId == null ? p.facilityId == null : isUuid(p.venueId) && (p.facilityId == null || isUuid(p.facilityId))))
      || !league.every(seenOk) || !rep.every(seenOk)
      || !links.every(l => l && (l.kind === 'league' || l.kind === 'rep') && isUuid(l.id) && isUuid(l.venueId))) {
    return bad();
  }
  const everyProgram = seesEveryProgram(ctx.role);
  // Every place at once is an owner's or an admin's (K1, K15), and a house league admin's only from a season in a club with
  // no places (T1); the rep steps only where the club runs rep teams (K14); a house league admin marks rep games on the
  // place but never links one (the typed rep games aren't theirs to see, K1).
  if (places.some(p => p.venueId == null) && !everyProgram) {
    const venues = (await closeFrame(ctx.org, ctx.role)).venues.length;
    if (!(await mayCloseEveryPlaceHere(ctx.org, ctx.role, venues, body.seasonId))) return forbidden();
  }
  if ((rep.length || links.some(l => l.kind === 'rep')) && !hasModuleEntitlement(ctx.org, 'module_rep_teams')) return bad();
  if (links.some(l => l.kind === 'rep') && !everyProgram) return forbidden();
  if ((league.length || links.some(l => l.kind === 'league')) && !hasModuleEntitlement(ctx.org, 'module_house_league')) return bad();
  // "The Day is today or later" is the press's own refusal, decided AFTER its replay check: a retried press after the club's
  // midnight still answers with what it wrote (and its sends still run), never "past".

  if (!everyProgram && rep.length) {
    const src = await closeSource(ctx.org, ctx.role, {
      places: places.map(p => ({ venueId: (p.venueId as string | null) ?? null, facilityId: (p.facilityId as string | null) ?? null })),
      firstDay: body.firstDay as string, lastDay: body.lastDay as string,
    });
    const offered = new Set((src?.rep ?? []).map(g => g.id));
    if (rep.some(x => !offered.has(x.id as string))) return forbidden();
  }

  const r = await pressPlaceClosure({
    orgId: ctx.org.id, actorId: ctx.user.id, pressKey: body.pressKey as string,
    places: places.map(p => ({ venueId: (p.venueId as string | null) ?? null, facilityId: (p.facilityId as string | null) ?? null })),
    firstDay: body.firstDay as string, lastDay: body.lastDay as string, verb, line,
    league: league.map(x => ({ id: x.id as string, seen: x.seen as string })),
    rep: rep.map(x => ({ id: x.id as string, seen: x.seen as string })),
    links: links.map(l => ({ kind: l.kind as 'league' | 'rep', id: l.id as string, venueId: l.venueId as string })),
  });
  switch (r.refusal) {
    case null: break;
    case 'changed': return NextResponse.json({ error: W.errChanged, code: 'changed', changed: r.changed }, { status: 409 });
    case 'past': return NextResponse.json({ error: W.errPast, code: 'past' }, { status: 409 });
    case 'draft': return NextResponse.json({ error: W.errDraft, code: 'draft' }, { status: 409 });
    case 'finished': return NextResponse.json({ error: W.errFinished, code: 'finished' }, { status: 409 });
    case 'not_found': return NextResponse.json({ error: W.errNotFound, code: 'not_found' }, { status: 404 });
    default: return bad();
  }

  const sent = await sendAfterPress({ org: ctx.org, actor: await closureActor(ctx), closureIds: r.closureIds, rainoutIds: r.rainoutIds });
  // K1: a house league admin reads the rep result as counts — no team's name leaves the server for them.
  const repOut = everyProgram ? sent.rep : { ...sent.rep, teams: sent.rep.teams.map((t, i) => ({ ...t, teamId: String(i), name: '' })) };
  return NextResponse.json({ closureIds: r.closureIds, replay: r.replay, league: sent.league, rep: repOut });
}, { route: '/api/admin/org/place-closures' });
