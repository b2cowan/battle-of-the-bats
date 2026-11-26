import { NextResponse } from 'next/server';
import { requirePlatformOwnerApi } from '@/lib/platform-owner';
import { withObservability } from '@/lib/observability';
import { zonedWallClockToUtc } from '@/lib/timezone';
import { meetingInWindow } from '@/lib/prospect-clubs';
import { ROOM_WORDS } from '@/lib/preview-claim';
import {
  letRoomTryAgain, moveRoomMeeting, newRoomCode, readRoom, saveRoomScore, undoRoomClaim,
  type RoomWriteResult,
} from '@/lib/preview-claim-server';
import { sendPreviewLink, type PreviewLinkSend } from '@/lib/preview-link-email-server';

/**
 * /api/platform-admin/prospect-clubs/{orgId} — the room window (Club Website Track P, Session P3; drawing tab 4). The owner
 * only, by the one owner allowlist (T2), never a platform role.
 *
 *   GET   the window's facts for an OPEN preview (404 when claimed, removed or gone)
 *   POST  { action }:
 *     score     { home, away }  the live game's score; the game stays on (T5: staff write this one thing in a preview)
 *     final     { home, away }  Mark final
 *     meeting   { meeting }     `YYYY-MM-DDTHH:MM` Eastern; the live game and the removal date move together
 *     new_code                  the old code stops working
 *     let_try                   lifts the hour's rest after five wrong codes
 *     undo                      undo a claim while the club holds nothing but the claim (T15)
 *     email     { to, role, ticked }  the one email with the link (Session P4, T13): refused, keeping nothing, while our
 *                               mailing address is blank; otherwise the consent record, then the email
 *
 * Remove now is platform admin's own Delete (`/api/platform-admin/orgs/{id}/delete`), as the drawing asks.
 */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Ctx = { params: Promise<{ orgId: string }> };

export const GET = withObservability(async (_req: Request, ctx: Ctx) => {
  const gate = await requirePlatformOwnerApi();
  if (gate.response) return gate.response;
  const { orgId } = await ctx.params;
  if (!UUID.test(orgId)) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const room = await readRoom(orgId);
  if (!room) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json({ room });
}, { route: '/api/platform-admin/prospect-clubs/[orgId]' });

function score(v: unknown): number | null {
  const n = typeof v === 'number' ? v : typeof v === 'string' && v.trim() !== '' ? Number(v) : NaN;
  return Number.isInteger(n) && n >= 0 && n <= 999 ? n : null;
}

const ERROR_WORDS: Record<string, string> = {
  not_started: ROOM_WORDS.notStartedErr,
  final: ROOM_WORDS.finalErr,
  no_game: ROOM_WORDS.noGame,
  meeting: 'Pick a meeting in the next 60 days.',
};

function answer(result: RoomWriteResult): Response {
  if (result.ok) return NextResponse.json({ ok: true });
  const status = result.kind === 'failed' ? 500 : result.kind === 'not_open' || result.kind === 'not_claimed' ? 404 : 409;
  return NextResponse.json({ error: ERROR_WORDS[result.kind] ?? ROOM_WORDS.failed, kind: result.kind }, { status });
}

/** The one email's answer (Session P4): every refusal says why, and none keeps anything. */
function emailAnswer(r: PreviewLinkSend): Response {
  if (r.ok) return NextResponse.json({ ok: true, message: ROOM_WORDS.sendDone(r.to) });
  const words: Record<Exclude<PreviewLinkSend, { ok: true }>['why'], string> = {
    no_mailing_address: ROOM_WORDS.sendRefused,
    bad_address: ROOM_WORDS.sendBadAddress,
    bad_role: ROOM_WORDS.rolePick,
    no_tick: ROOM_WORDS.emailTick,
    not_open: ROOM_WORDS.failed,
    before_meeting: ROOM_WORDS.sendBeforeMeeting,
    stopped: ROOM_WORDS.sendStopped,
    already_sent: r.why === 'already_sent' && r.sent ? ROOM_WORDS.sentAlready(r.sent.to, r.sent.on) : ROOM_WORDS.sentAlreadyBare,
    no_unsubscribe: ROOM_WORDS.sendFailed,
    failed: ROOM_WORDS.sendFailed,
  };
  const status = r.why === 'failed' || r.why === 'no_unsubscribe' ? 502 : r.why === 'not_open' ? 404 : 409;
  return NextResponse.json({ error: words[r.why], kind: r.why }, { status });
}

export const POST = withObservability(async (req: Request, ctx: Ctx) => {
  const gate = await requirePlatformOwnerApi();
  if (gate.response) return gate.response;
  const actor = { id: gate.auth.user.id, email: gate.auth.user.email ?? '' };
  const { orgId } = await ctx.params;
  if (!UUID.test(orgId)) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: ROOM_WORDS.failed }, { status: 400 });
  }

  switch (body.action) {
    case 'score':
    case 'final': {
      const home = score(body.home), away = score(body.away);
      if (home === null || away === null) return NextResponse.json({ error: 'Type both scores as whole numbers.' }, { status: 400 });
      return answer(await saveRoomScore(orgId, home, away, body.action === 'final', actor));
    }
    case 'meeting': {
      const meeting = typeof body.meeting === 'string' ? body.meeting.slice(0, 16) : '';
      const [date, time] = meeting.split('T');
      const at = zonedWallClockToUtc(date, time);
      if (!at || !meetingInWindow(at)) return NextResponse.json({ error: ERROR_WORDS.meeting, kind: 'meeting' }, { status: 400 });
      return answer(await moveRoomMeeting(orgId, at, actor));
    }
    case 'new_code':
      return answer(await newRoomCode(orgId, actor));
    case 'let_try':
      return answer(await letRoomTryAgain(orgId, actor));
    case 'undo':
      return answer(await undoRoomClaim(orgId, actor));
    case 'email':
      return emailAnswer(await sendPreviewLink({
        orgId, to: typeof body.to === 'string' ? body.to : '', role: body.role, ticked: body.ticked === true, staffEmail: actor.email,
      }));
    default:
      return NextResponse.json({ error: ROOM_WORDS.failed }, { status: 400 });
  }
}, { route: '/api/platform-admin/prospect-clubs/[orgId]' });
