import 'server-only';
import { supabaseAdmin } from './supabase-admin';
import { showFriendCode } from './league-friend-code';
import type { FriendAsked, FriendIn } from './league-friends';

/**
 * FRIEND REQUESTS ON THE SERVER, THE FAMILY'S SIDE (Board Ready Stage 1 Part 1; mig 461). The rows hang on the asking
 * child's season registration (never on the cross-season child: /legal build rule), service role only.
 *
 *   · A CODE resolves on save: same season, by code. A match in the same division arrives confirmed (nobody decided it,
 *     so decided_by stays empty); a match in another division waits in To confirm marked Different division, for the
 *     registrar's Can't honour (A2). A code that matches nobody waits with no match. The family is told none of this.
 *   · A typed NAME is stored only. Matching runs on read, in the registrar's queue (Part 2).
 *   · A change on "Your sign-up" keeps a friend still asked for (so the registrar's decision on it stands) and replaces
 *     the rest, in one transaction (/review 2026-11-11).
 */

/** The friend code of each registration (null where none was given, e.g. a finished season's). */
export async function readFriendCodes(registrationIds: readonly string[]): Promise<Map<string, string | null>> {
  const out = new Map<string, string | null>();
  if (registrationIds.length === 0) return out;
  const { data, error } = await supabaseAdmin.from('league_registrations').select('id, friend_code').in('id', [...registrationIds]);
  if (error) throw error;
  for (const r of data ?? []) out.set(String(r.id), (r.friend_code as string | null) ?? null);
  return out;
}

/** What each registration's family asked, slot by slot: the name typed or the code typed (tab 2's "Plays with"). */
export async function readFriendsAsked(registrationIds: readonly string[]): Promise<Map<string, FriendAsked[]>> {
  const out = new Map<string, FriendAsked[]>();
  if (registrationIds.length === 0) return out;
  const { data, error } = await supabaseAdmin.from('league_friend_requests')
    .select('registration_id, slot, typed_first, typed_last, typed_parent, code_entered')
    .in('registration_id', [...registrationIds]).order('slot');
  if (error) throw error;
  for (const r of data ?? []) {
    const id = String(r.registration_id);
    const asked: FriendAsked = r.code_entered
      ? { code: showFriendCode(r.code_entered as string) }
      : {
        name: [r.typed_first, r.typed_last].filter(Boolean).join(' '),
        first: (r.typed_first as string | null) ?? null, last: (r.typed_last as string | null) ?? null, parent: (r.typed_parent as string | null) ?? null,
      };
    out.set(id, [...(out.get(id) ?? []), asked]);
  }
  return out;
}

/**
 * The friends of one child, as the form or "Your sign-up" sent them (already checked by `readFriends`), saved in ONE
 * database step (mig 461 `league_friend_requests_save`): kept rows keep the registrar's decision, codes resolve there.
 * A failure throws a plain Error carrying only the database's code: never the row, which holds a typed child's name.
 */
export async function saveFriendRequests(input: {
  orgId: string; seasonId: string; registrationId: string; friends: readonly FriendIn[];
}): Promise<void> {
  const { orgId, seasonId, registrationId, friends } = input;
  const { error } = await supabaseAdmin.rpc('league_friend_requests_save', {
    p_org: orgId, p_season: seasonId, p_registration: registrationId, p_friends: friends,
  });
  if (error) throw new Error(`saving friend requests failed (${error.code ?? 'no code'})`);
}
