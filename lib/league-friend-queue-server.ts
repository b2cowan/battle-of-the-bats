import 'server-only';
import { supabaseAdmin } from './supabase-admin';
import { memberDisplayName } from './member-names';
import { mapLeagueRegistration } from './db';
import { buildQueue, type CantHonourReason, type DraftOutcome, type FriendPlacement, type FriendRequest, type FriendState } from './league-friend-queue';
import { divisionLinks, type DivisionFriends } from './league-friend-draft';
export type { DivisionFriends } from './league-friend-draft';

/**
 * FRIEND REQUESTS ON THE SERVER, THE REGISTRAR'S SIDE (Board Ready Stage 1 Part 2; drawing tab 4). The family's side
 * (save, codes, "Plays with") is lib/league-friends-server.ts and never reads a match or a decision; this file is the
 * queue's read and the registrar's decisions, service role only.
 */

// ── The registrar's side (Board Ready Stage 1 Part 2) ─────────────────────────────────────────────────────────────
// ⚠ A11: these rows carry children's names a family typed. Only the friends route reads them, behind the SAME house-league
// action as the registrations list (tests/unit/house-league-friends-guard.test.ts). Never logged, never exported with
// contact details, never fed into a family, people or prospect list (/legal build rules).

const REQUEST_COLUMNS = 'id, registration_id, slot, typed_first, typed_last, typed_parent, code_entered, state, mark, matched_registration_id, reason, note, decided_by, decided_at, created_at, kept_apart_by, kept_apart_at, draft_outcome';

/** Every friend request of one season, for the registrar's queue, with the decider's name (best effort). */
export async function readSeasonFriendRequests(orgId: string, seasonId: string): Promise<FriendRequest[]> {
  const { data, error } = await supabaseAdmin.from('league_friend_requests').select(REQUEST_COLUMNS)
    .eq('org_id', orgId).eq('season_id', seasonId).order('created_at');
  if (error) throw new Error(`reading friend requests failed (${error.code ?? 'no code'})`);
  const rows = data ?? [];
  const deciders = [...new Set(rows.flatMap(r => [r.decided_by, r.kept_apart_by] as (string | null)[]).filter((v): v is string => !!v))];
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
    keptApartBy: r.kept_apart_by ? names.get(r.kept_apart_by as string) ?? null : null,
    keptApartAt: (r.kept_apart_at as string | null) ?? null,
    draftOutcome: (r.draft_outcome as DraftOutcome | null) ?? null,
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
        decided_by: userId, decided_at: now, updated_at: now, draft_outcome: null,
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
        state: 'to_confirm', reason: null, note: null, decided_by: null, decided_at: null, updated_at: now, draft_outcome: null,
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
      ...patch, decided_by: userId, decided_at: now, updated_at: now, draft_outcome: null,
      ...(decision.act === 'notSignedUp' && !r.code_entered ? { matched_registration_id: null } : {}),
    }).eq('id', id).eq('season_id', seasonId);
    fail(e);
  }
  return { changed: ids.length };
}

// ── The draft's side (Board Ready Stage 1 Part 3; drawings tabs 5, 5b, 6) ─────────────────────────────────────────
// ⚠ A11 holds here too. The DRAFT route reads the links to keep groups together and returns none of them (anyone who
// runs the draft gets groups kept, without names); the BOARD route returns them only behind the registrations read
// (tests/unit/house-league-friends-guard.test.ts). Ids only, never a typed name: the board names a child from its own row.

/** Where the draft dealt each child of the season and whether they are locked (the after-draft reasons read it). */
export async function readFriendPlacement(orgId: string, seasonId: string): Promise<FriendPlacement> {
  const { data, error } = await supabaseAdmin.from('league_registrations').select('id, draft_team_id, team_locked_at')
    .eq('org_id', orgId).eq('season_id', seasonId).or('draft_team_id.not.is.null,team_locked_at.not.is.null');
  if (error) throw new Error(`reading placements failed (${error.code ?? 'no code'})`);
  return Object.fromEntries((data ?? []).map(r => [String(r.id), { dealt: (r.draft_team_id as string | null) ?? null, locked: !!r.team_locked_at }]));
}

/** One division's friends, as the draft and the board read them: the queue's own answer, for that division. */
export async function readDivisionFriendLinks(orgId: string, seasonId: string, divisionId: string): Promise<DivisionFriends> {
  const [requests, { data, error }] = await Promise.all([
    readSeasonFriendRequests(orgId, seasonId),
    supabaseAdmin.from('league_registrations').select('*').eq('org_id', orgId).eq('season_id', seasonId),
  ]);
  if (error) throw new Error(`reading registrations failed (${error.code ?? 'no code'})`);
  if (requests.length === 0) return { links: [], waiting: 0, asked: [] };
  const rows = buildQueue(requests, (data ?? []).map(mapLeagueRegistration));
  const here = rows.filter(r => r.asker.divisionId === divisionId);
  const asked = new Set<string>();
  for (const r of here) { asked.add(r.asker.id); if (r.partner) asked.add(r.partner.id); }
  return { links: divisionLinks(rows, divisionId), waiting: here.filter(r => r.band === 'toConfirm').length, asked: [...asked] };
}

/**
 * "Keep apart from a friend…" / "Keep together with {friend} again" (tab 5): every request between the two children
 * (both directions, a covered one too) is marked or cleared. The draft and Draft again then read the link as split.
 */
export async function keepFriendsApart(input: {
  orgId: string; seasonId: string; divisionId: string; a: string; b: string; apart: boolean; userId: string;
}): Promise<{ changed: number } | { refusal: 'not_found' }> {
  const { orgId, seasonId, divisionId, a, b, apart, userId } = input;
  const { links } = await readDivisionFriendLinks(orgId, seasonId, divisionId);
  const link = links.find(l => (l.a === a && l.b === b) || (l.a === b && l.b === a));
  if (!link) return { refusal: 'not_found' };
  const now = new Date().toISOString();
  const { error } = await supabaseAdmin.from('league_friend_requests')
    .update(apart ? { kept_apart_by: userId, kept_apart_at: now, updated_at: now } : { kept_apart_by: null, kept_apart_at: null, updated_at: now })
    .eq('org_id', orgId).eq('season_id', seasonId).in('id', link.requestIds);
  if (error) throw new Error(`saving a split failed (${error.code ?? 'no code'})`);
  return { changed: link.requestIds.length };
}
