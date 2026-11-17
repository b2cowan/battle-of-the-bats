import 'server-only';
/**
 * CLUB COMMUNICATIONS — THE BOARD, read live (board ask 15; legal §2a.5, T5).
 *
 * Everyone on Organization › The board: the five board seats, from `organization_members` ONLY (plus the account's own name
 * and address). Active members are the group; invited ones are returned so an owner or admin sender can see them named in
 * "See who gets it" (C1) — never sent to, never counted in N. Suspended members are not read at all.
 *
 * ⚠ It is NOT `boardRecipients` (lib/two-step-emails.ts: owner, admin, treasurer — a narrower list for another purpose), and it
 * imports no families module and reads no table that holds a family, guardian, person or player (T5 pins this file's imports).
 * Unlike `boardNames`, a seat with no name is KEPT (named by its role on screen), so N matches who is emailed.
 */
import { supabaseAdmin } from './supabase-admin';
import { getUserPersonName } from './user-display';
import { cleanName, type BoardMember } from './club-group-email-rules';
import { BOARD_SEATS, type BoardSeat } from './club-group-email-words';

export async function loadBoardMembers(orgId: string): Promise<BoardMember[]> {
  const { data, error } = await supabaseAdmin.from('organization_members')
    .select('user_id, role, status, display_name, invited_at')
    .eq('organization_id', orgId).in('role', [...BOARD_SEATS]).in('status', ['active', 'invited'])
    .order('invited_at', { ascending: true });
  if (error) throw error;
  const rows = (data ?? []).filter(r => !!r.user_id);
  return Promise.all(rows.map(async r => {
    let email: string | null = null;
    let accountName: string | null = null;
    try {
      const { data: u } = await supabaseAdmin.auth.admin.getUserById(r.user_id as string);
      email = u.user?.email ?? null;
      accountName = u.user ? getUserPersonName(u.user) : null;
    } catch { /* an account that can't be read is nameless and unreachable: counted as left out, never guessed */ }
    return {
      userId: r.user_id as string, role: r.role as BoardSeat, status: r.status as 'active' | 'invited',
      name: cleanName(r.display_name as string | null) ?? cleanName(accountName), email,
    };
  }));
}
