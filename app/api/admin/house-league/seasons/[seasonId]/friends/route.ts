import { NextResponse } from 'next/server';
import { getAuthContextWithRole } from '@/lib/api-auth';
import { houseLeagueRefusal } from '@/lib/house-league-gate';
import { getLeagueSeasonById } from '@/lib/db';
import { friendRequestsOn } from '@/lib/league-friends';
import { decideFriendRequests, readSeasonFriendRequests, type FriendDecision } from '@/lib/league-friend-queue-server';
import { withObservability } from '@/lib/observability';

/**
 * THE REGISTRAR'S FRIEND REQUESTS (Board Ready Stage 1 Part 2; drawing tab 4).
 *
 *   GET  — the season's requests, read behind the SAME action as the registrations list (A11: the seats that can open
 *          Registrations; tests/unit/house-league-friends-guard.test.ts). `on: false` and no rows when the plan has no
 *          friend requests or the season asks for none (the view is absent, not empty).
 *   POST — one decision: confirm · notSignedUp · cantHonour · reopen · delete. The registrations desk's right
 *          (`register`: off on a finished season, whose requests are already deleted).
 *
 * ⚠ The rows hold children's names a family typed: nothing here logs a row or a name (/legal build rules).
 */

const NOTE_MAX = 280;
/** A uuid, exactly: anything else is refused here, never sent to the database (/review 2026-11-11). */
const ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** One decision's most requests: a page of the queue (50 rows, a pair is two) with room to spare. */
const MOST = 200;
const isId = (v: unknown): v is string => typeof v === 'string' && ID.test(v);

export const GET = withObservability(async (req: Request,
  { params }: { params: Promise<{ seasonId: string }> }) => {
  const orgSlug = new URL(req.url).searchParams.get('orgSlug') ?? undefined;
  const ctx = await getAuthContextWithRole({ orgSlug, requireOrgSlug: true });
  const err = houseLeagueRefusal(ctx, 'read');
  if (err) return err;

  const { seasonId } = await params;
  const season = await getLeagueSeasonById(seasonId, ctx!.org.id);
  if (!season) return NextResponse.json({ error: 'Season not found' }, { status: 404 });
  if (!friendRequestsOn(ctx!.org.planId, season.friendRequestsMax)) return NextResponse.json({ on: false, requests: [] });
  const requests = await readSeasonFriendRequests(ctx!.org.id, seasonId);
  return NextResponse.json({ on: true, requests });
}, { route: '/api/admin/house-league/seasons/[seasonId]/friends' });

/** The body read into one decision, or null when it is not one. */
function readDecision(body: unknown): FriendDecision | null {
  if (!body || typeof body !== 'object') return null;
  const b = body as Record<string, unknown>;
  // Every id must be one, and each once: a list with a bad id is refused whole, never acted on in part.
  const raw = Array.isArray(b.ids) ? b.ids : [];
  if (raw.length > MOST || !raw.every(isId)) return null;
  const ids = [...new Set(raw as string[])];
  switch (b.act) {
    case 'confirm': {
      if (!Array.isArray(b.items) || b.items.length === 0 || b.items.length > MOST) return null;
      const items = b.items.flatMap(i => {
        const o = i as Record<string, unknown> | null;
        return o && isId(o.id) && isId(o.matchId) ? [{ id: o.id, matchId: o.matchId }] : [];
      });
      // Each request once.
      if (items.length !== b.items.length || new Set(items.map(i => i.id)).size !== items.length) return null;
      return { act: 'confirm', items };
    }
    case 'notSignedUp': case 'reopen': case 'delete':
      return ids.length ? { act: b.act, ids } : null;
    case 'cantHonour': {
      const reason = b.reason === 'different_division' || b.reason === 'other' ? b.reason : null;
      // Cut by characters, never inside one (an emoji is two UTF-16 units).
      const note = typeof b.note === 'string' ? Array.from(b.note.replace(/\s+/g, ' ').trim()).slice(0, NOTE_MAX).join('') || null : null;
      if (!ids.length || !reason || (reason === 'other' && !note)) return null;
      return { act: 'cantHonour', ids, reason, note };
    }
    default: return null;
  }
}

export const POST = withObservability(async (req: Request,
  { params }: { params: Promise<{ seasonId: string }> }) => {
  const orgSlug = new URL(req.url).searchParams.get('orgSlug') ?? undefined;
  const ctx = await getAuthContextWithRole({ orgSlug, requireOrgSlug: true });
  const err = houseLeagueRefusal(ctx, 'register');
  if (err) return err;

  const { seasonId } = await params;
  const season = await getLeagueSeasonById(seasonId, ctx!.org.id);
  if (!season) return NextResponse.json({ error: 'Season not found' }, { status: 404 });
  const refused = houseLeagueRefusal(ctx, 'register', season);
  if (refused) return refused;
  if (!friendRequestsOn(ctx!.org.planId, season.friendRequestsMax)) {
    return NextResponse.json({ error: 'This season doesn’t take friend requests.' }, { status: 403 });
  }

  const decision = readDecision(await req.json().catch(() => null));
  if (!decision) return NextResponse.json({ error: 'That didn’t go through. Please try again.' }, { status: 400 });

  const out = await decideFriendRequests({ orgId: ctx!.org.id, seasonId, userId: ctx!.user.id, decision });
  if ('refusal' in out) {
    return out.refusal === 'not_found'
      ? NextResponse.json({ error: 'That friend request has changed. The list has been read again.', code: 'not_found' }, { status: 409 })
      : NextResponse.json({ error: 'Pick a child signed up in the same division.', code: 'bad_match' }, { status: 400 });
  }
  return NextResponse.json({ changed: out.changed });
}, { route: '/api/admin/house-league/seasons/[seasonId]/friends' });
