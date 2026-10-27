import { NextResponse } from 'next/server';
import { withObservability } from '@/lib/observability';
import { loadSchedule, repTeamsRefusal, resolveScheduler, schedulerRefusal } from '@/lib/club-schedule-server';
import { previewSend, sendSchedule, type SendKind } from '@/lib/club-schedule-send';
import { SCHEDULE_REFUSALS as R } from '@/lib/club-schedule-words';

// ---------------------------------------------------------------------------
// SEND A SCHEDULE (Club Tier Stage 11a, part A — Asks 7, 9, 14, 23, 24; the reminders' pattern; hub specimens 9, 10, 14).
//
// GET  ?orgSlug=&kind=review|final|changes[&replyBy=]  — the preview: what sending does in one statement; who is told, per
//      team (its head coaches and staff with schedule access, its slots as a pattern, its bill — or, for changes, what
//      changes and the money it settles); the teams nobody can be told about, with the reason; anything that blocks the
//      send, in words; "Last sent … by …". The club's coaches only, never the venue (owner 2026-10-12, walk §300 W7).
// POST ?orgSlug=  { kind, version, teamIds, replyBy?, billCorrections?, leagueTeamIds?, leagueSeen? } — send to the teams
//      the preview named; on Send the changes, `leagueSeen` is the house-league plan the window showed (Stage 11b Part 5).
//      The server recomputes everything; a send the sender didn't preview (a newer version) is refused; a double press
//      inside a minute is refused (the claim). 409 `changed` · `just_sent` · a blocker's own code; the database step's
//      refusals in words (`season_closed`, `year_closed`, `over_line`).
//
// ⚠ Emails leave only from this POST (the proxy refuses a demo club's POST; `sendEmail` has no demo check of its own).
// ---------------------------------------------------------------------------

type Params = { params: Promise<{ scheduleId: string }> };
const KINDS: SendKind[] = ['review', 'final', 'changes'];

export const GET = withObservability(async (req: Request, { params }: Params) => {
  const r = await resolveScheduler(req, { write: true });
  if ('error' in r) return r.error;
  const { scheduleId } = await params;
  const url = new URL(req.url);
  const kind = url.searchParams.get('kind') as SendKind;
  if (!KINDS.includes(kind)) return schedulerRefusal(400, 'bad_kind', 'Send for review, final, or the changes.');
  const loaded = await loadSchedule(r.ctx.org.id, scheduleId);
  if (!loaded) return schedulerRefusal(404, 'not_found', R.notFound);
  const closed = repTeamsRefusal(r, loaded);
  if (closed) return closed;
  const p = await previewSend(r, loaded, kind, { replyBy: url.searchParams.get('replyBy') });
  // The step's own rows and the money's working stay on the server; the screen gets what it says. A bill's figures read
  // only to a money reader (as the schedule's page strips them): for anyone else a team's bill, its correction and an
  // email that carries money are left out (/review 2026-10-11).
  const money = r.canMoney;
  const teams = money ? p.teams : p.teams.map(t => {
    const carriesMoney = !!t.bill || t.billedCents != null || t.lost != null;
    return { ...t, bill: null, billedCents: null, lost: null, sample: carriesMoney ? null : t.sample };
  });
  // A lost Sunday's request filing stays on the server (Stage 11d): the window reads the money and its moves.
  const shownTeams = teams.map(t => ({ ...t, lost: t.lost ? { cents: t.lost.cents, creditCents: t.lost.creditCents, payCents: t.lost.payCents, moves: t.lost.moves } : null }));
  return NextResponse.json({
    kind: p.kind, scheduleId: p.scheduleId, version: p.version, statement: p.statement, teams: shownTeams, unreachable: p.unreachable,
    blockers: p.blockers, correctionBlocked: p.correctionBlocked, replyBy: p.replyBy, lastSent: p.lastSent,
    handedBack: p.handedBack, recipientCount: p.recipientCount,
    // Stage 11b Part 5 (h4): the house-league teams' rows, coaches and family counts, their emails, and the plan's
    // fingerprint the POST returns (no money in any of it).
    league: p.league,
    // Stage 11d, Ask 8: a loss is settled at the send (credited, or owed back) — never "owed back: its coach asks".
    correction: money && p.correction ? { billed: Object.fromEntries(p.correction.gains), lost: Object.fromEntries(p.correction.losses) } : null,
  });
}, { route: '/api/admin/schedules/[scheduleId]/send' });

export const POST = withObservability(async (req: Request, { params }: Params) => {
  const r = await resolveScheduler(req, { write: true });
  if ('error' in r) return r.error;
  const { scheduleId } = await params;
  const body = await req.json().catch(() => ({})) as Record<string, unknown>;
  const kind = body.kind as SendKind;
  if (!KINDS.includes(kind)) return schedulerRefusal(400, 'bad_kind', 'Send for review, final, or the changes.');
  const loaded = await loadSchedule(r.ctx.org.id, scheduleId);
  if (!loaded) return schedulerRefusal(404, 'not_found', R.notFound);
  const closed = repTeamsRefusal(r, loaded);
  if (closed) return closed;
  const out = await sendSchedule(r, loaded, kind, body);
  if (!out.ok) return out.response;
  return NextResponse.json(out);
}, { route: '/api/admin/schedules/[scheduleId]/send' });
