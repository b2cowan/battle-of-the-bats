import { NextResponse } from 'next/server';
import { getLeagueSeasonBySlug } from '@/lib/db';
import { resolvePublicLeagueContext } from '@/lib/public-league';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { withObservability } from '@/lib/observability';
import { throttlePublicForm } from '@/lib/public-form-throttle';
import { registrationReference } from '@/lib/utils';
import { openSignupLink } from '@/lib/league-signup-link';
import { FRIEND_WORDS as FW, friendMaxFor, readFriends } from '@/lib/league-friends';
import { readFriendsAsked, saveFriendRequests } from '@/lib/league-friends-server';
import { previewWriteRefusal } from '@/lib/preview-write-refusal';

export const dynamic = 'force-dynamic';

/**
 * POST /api/league/[orgSlug]/[seasonSlug]/friends — a family adds or changes a child's friend requests from "Your
 * sign-up" (Board Ready Stage 1 Part 1; drawing tab 2, ruling A5). The possession proof is the family's link alone, read
 * through the one door (`openSignupLink`), as "Ask to withdraw" is; the child is named by its own registration code
 * among that sign-up's children. Open until the child's division has its teams made; refused on a finished season, an
 * ended sign-up, or a club that doesn't ask. Throttled like every public family form.
 *
 * The answer is only what the family asked (the "Plays with" lines): never whether a name or code matched anyone.
 */
export const POST = withObservability(async (req: Request,
  { params }: { params: Promise<{ orgSlug: string; seasonSlug: string }> },) => {
  const { orgSlug, seasonSlug } = await params;

  const throttled = throttlePublicForm(req);
  if (throttled) return throttled;

  const org = await resolvePublicLeagueContext(orgSlug);
  if (!org) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const previewClosed = previewWriteRefusal(org); if (previewClosed) return previewClosed;
  const season = await getLeagueSeasonBySlug(org.id, seasonSlug);
  if (!season) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  let body: { child?: unknown; token?: unknown; friends?: unknown };
  try { body = await req.json(); } catch { return NextResponse.json({ error: FW.errGeneric }, { status: 400 }); }
  const child = typeof body.child === 'string' ? body.child.trim().toUpperCase().replace(/[^0-9A-F]/g, '').slice(0, 8) : '';
  const token = typeof body.token === 'string' ? body.token.trim() : '';
  if (child.length !== 8 || !token) return NextResponse.json({ error: FW.errGeneric }, { status: 400 });

  const max = friendMaxFor(org.planId, season.friendRequestsMax);
  if (max === 0) return NextResponse.json({ error: FW.errGeneric, code: 'off' }, { status: 409 });
  if (season.status === 'completed' || season.status === 'archived') {
    return NextResponse.json({ error: FW.errClosed, code: 'closed' }, { status: 409 });
  }

  type Row = { id: string; status: string; division_id: string | null; player_first_name: string; friend_code: string | null };
  const link = await openSignupLink(token, { at: { orgId: org.id, seasonId: season.id } });
  let reg: Row | undefined;
  if (link.ok) {
    const { data, error } = await supabaseAdmin.from('league_registrations')
      .select('id, status, division_id, player_first_name, friend_code').in('id', link.rows.map(r => r.id));
    if (error) throw error;
    reg = ((data ?? []) as Row[]).find(r => registrationReference(String(r.id)) === child);
  }
  if (!reg) return NextResponse.json({ error: FW.errGeneric }, { status: 404 });
  if (reg.status === 'declined' || reg.status === 'withdrawn') return NextResponse.json({ error: FW.errGeneric, code: 'ended' }, { status: 409 });

  // Open until the child's division has its teams made (A5).
  if (reg.division_id) {
    const { data: div, error } = await supabaseAdmin.from('league_divisions').select('teams_published_at').eq('id', reg.division_id).maybeSingle();
    if (error) throw error;
    if (div?.teams_published_at) return NextResponse.json({ error: FW.errClosed, code: 'closed' }, { status: 409 });
  }

  // The child's own code is refused in words, keyed to the block it was typed in.
  const read = readFriends(body.friends, max, { code: reg.friend_code, child: reg.player_first_name });
  if (Object.keys(read.errors).length > 0) return NextResponse.json({ errors: read.errors }, { status: 400 });

  // One database step (the whole set lands or none of it). A failure logs only the database's code: never the row,
  // which holds a typed child's name (/legal, /review 2026-11-11).
  try {
    await saveFriendRequests({ orgId: org.id, seasonId: season.id, registrationId: reg.id, friends: read.friends });
    const asked = (await readFriendsAsked([reg.id])).get(reg.id) ?? [];
    return NextResponse.json({ ok: true, asked });
  } catch (e) {
    console.error('[league-friends] save failed:', (e as { code?: string })?.code ?? String((e as Error)?.message ?? '').slice(0, 80));
    return NextResponse.json({ error: FW.errGeneric }, { status: 500 });
  }
}, { route: '/api/league/[orgSlug]/[seasonSlug]/friends' });
