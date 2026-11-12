import 'server-only';
import { supabaseAdmin } from './supabase-admin';
import { memberDisplayName } from './member-names';
import type { CantHonourReason, FriendRequest, FriendState } from './league-friend-queue';

/**
 * FRIEND REQUESTS ON THE SERVER, THE REGISTRAR'S SIDE (Board Ready Stage 1 Part 2; drawing tab 4). The family's side
 * (save, codes, "Plays with") is lib/league-friends-server.ts and never reads a match or a decision; this file is the
 * queue's read and the registrar's decisions, service role only.
 */

// ── The registrar's side (Board Ready Stage 1 Part 2) ─────────────────────────────────────────────────────────────
// ⚠ A11: these rows carry children's names a family typed. Only the friends route reads them, behind the SAME house-league
// action as the registrations list (tests/unit/house-league-friends-guard.test.ts). Never logged, never exported with
// contact details, never fed into a family, people or prospect list (/legal build rules).

const REQUEST_COLUMNS = 'id, registration_id, slot, typed_first, typed_last, typed_parent, code_entered, state, mark, matched_registration_id, reason, note, decided_by, decided_at, created_at';

/** Every friend request of one season, for the registrar's queue, with the decider's name (best effort). */
export async function readSeasonFriendRequests(orgId: string, seasonId: string): Promise<FriendRequest[]> {
  const { data, error } = await supabaseAdmin.from('league_friend_requests').select(REQUEST_COLUMNS)
    .eq('org_id', orgId).eq('season_id', seasonId).order('created_at');
  if (error) throw new Error(`reading friend requests failed (${error.code ?? 'no code'})`);
  const rows = data ?? [];
  const deciders = [...new Set(rows.map(r => r.decided_by as string | null).filter((v): v is string => !!v))];
  const names = new Map(await Promise.all(deciders.map(async id => [id, await memberDisplayName(orgId, id)] as const)));
  return rows.map(r => ({
    id: String(r.id),
    registrationId: String(r.registration_id),
    slot: Number(r.slot),
    typedFirst: (r.typed_first as string | null) ?? null,
    typedLast: (r.typed_last as string | null) ?? null,
    typedParent: (r.typed_parent as string | null) ?? null,
    code: (r.code_entered as string | null) ?? null,
    state: r.state as FriendState,
    mark: (r.mark as 'different_division' | null) ?? null,
    matchedRegistrationId: (r.matched_registration_id as string | null) ?? null,
    reason: (r.reason as CantHonourReason | null) ?? null,
    note: (r.note as string | null) ?? null,
    decidedBy: r.decided_by ? names.get(r.decided_by as string) ?? null : null,
    decidedAt: (r.decided_at as string | null) ?? null,
    createdAt: String(r.created_at),
  }));
}

/** The registrar's decisions. Each one names the requests it changes; a request of another season is never touched. */
export type FriendDecision =
  | { act: 'confirm'; items: { id: string; matchId: string }[] }
  | { act: 'notSignedUp'; ids: string[] }
  | { act: 'cantHonour'; ids: string[]; reason: CantHonourReason; note: string | null }
  | { act: 'reopen'; ids: string[] }
  | { act: 'delete'; ids: string[] };

export type FriendDecisionRefusal = 'not_found' | 'bad_match';

/**
 * Apply one decision. A confirm's match must be a LIVE sign-up of this season in the asking child's own division, and
 * never the child itself (a different division is Can't honour, A2). Returns how many requests changed, or a refusal.
 */
export async function decideFriendRequests(input: {
  orgId: string; seasonId: string; userId: string; decision: FriendDecision;
}): Promise<{ changed: number } | { refusal: FriendDecisionRefusal }> {
  const { orgId, seasonId, userId, decision } = input;
  const ids = decision.act === 'confirm' ? decision.items.map(i => i.id) : decision.ids;
  if (ids.length === 0) return { changed: 0 };
  const { data: found, error } = await supabaseAdmin.from('league_friend_requests')
    .select('id, registration_id, code_entered, matched_registration_id')
    .eq('org_id', orgId).eq('season_id', seasonId).in('id', ids);
  if (error) throw new Error(`reading friend requests failed (${error.code ?? 'no code'})`);
  const rows = new Map((found ?? []).map(r => [String(r.id), r]));
  if (rows.size !== new Set(ids).size) return { refusal: 'not_found' };

  const now = new Date().toISOString();
  const fail = (e: { code?: string } | null) => { if (e) throw new Error(`saving a friend decision failed (${e.code ?? 'no code'})`); };

  if (decision.act === 'delete') {
    const { error: e } = await supabaseAdmin.from('league_friend_requests').delete().eq('season_id', seasonId).in('id', ids);
    fail(e);
    return { changed: ids.length };
  }

  if (decision.act === 'confirm') {
    const regIds = [...new Set(decision.items.flatMap(i => [i.matchId, String(rows.get(i.id)!.registration_id)]))];
    const { data: regs, error: e1 } = await supabaseAdmin.from('league_registrations')
      .select('id, division_id, status').eq('org_id', orgId).eq('season_id', seasonId).in('id', regIds);
    fail(e1);
    const reg = new Map((regs ?? []).map(r => [String(r.id), r]));
    for (const i of decision.items) {
      const asker = reg.get(String(rows.get(i.id)!.registration_id));
      const friend = reg.get(i.matchId);
      const ended = (r: { status: unknown }) => ['declined', 'withdrawn'].includes(String(r.status));
      if (!asker || !friend || friend.id === asker.id || ended(friend) || ended(asker)
        || !asker.division_id || friend.division_id !== asker.division_id) return { refusal: 'bad_match' };
    }
    for (const i of decision.items) {
      const { error: e2 } = await supabaseAdmin.from('league_friend_requests').update({
        state: 'confirmed', matched_registration_id: i.matchId, mark: null, reason: null, note: null,
        decided_by: userId, decided_at: now, updated_at: now,
      }).eq('id', i.id).eq('season_id', seasonId);
      fail(e2);
    }
    return { changed: decision.items.length };
  }

  if (decision.act === 'reopen') {
    // A typed request goes back to its suggestions; a code keeps the sign-up its code found.
    for (const id of ids) {
      const r = rows.get(id)!;
      const { error: e } = await supabaseAdmin.from('league_friend_requests').update({
        state: 'to_confirm', reason: null, note: null, decided_by: null, decided_at: null, updated_at: now,
        ...(r.code_entered ? {} : { matched_registration_id: null }),
      }).eq('id', id).eq('season_id', seasonId);
      fail(e);
    }
    return { changed: ids.length };
  }

  const patch = decision.act === 'notSignedUp'
    ? { state: 'not_signed_up', reason: null, note: null }
    : { state: 'cant_honour', reason: decision.reason, note: decision.reason === 'other' ? decision.note : null };
  // A typed name marked Not signed up holds no match; a code keeps what it found (the record of what was entered).
  for (const id of ids) {
    const r = rows.get(id)!;
    const { error: e } = await supabaseAdmin.from('league_friend_requests').update({
      ...patch, decided_by: userId, decided_at: now, updated_at: now,
      ...(decision.act === 'notSignedUp' && !r.code_entered ? { matched_registration_id: null } : {}),
    }).eq('id', id).eq('season_id', seasonId);
    fail(e);
  }
  return { changed: ids.length };
}
