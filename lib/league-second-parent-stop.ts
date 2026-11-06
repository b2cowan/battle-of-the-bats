import { supabaseAdmin } from './supabase-admin';
import { normalizeGuardianEmail } from './guardian-email';
import { SECOND_PARENT_WORDS } from './league-second-parent';

/**
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * A SECOND PARENT'S STOP (Signed-in family accounts Stage 3b; plan SIGNED_IN_FAMILY_STAGE3B_SECOND_PARENT_STOP_PLAN.md, owner
 * calls O1–O5 ruled 2026-11-06; table second_parent_stops, mig 448). SERVER-ONLY: the words live in league-second-parent.ts,
 * which the sign-up form also imports, so nothing here may move there.
 *
 *   The stop IS the removal: second_parent_stop() clears league_registrations.guardian_email_2 for the org, so the senders
 *   (which read that column) find it empty. ⚠ NO SEND PATH READS THIS TABLE, and none may: this file's only readers are the
 *   three places an address can ENTER (the public register route and the two staff writes) and the record window.
 *   ⚠ Never a household key and never read for marketing or consent.
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 */

/**
 * The words that refuse an address this club has been asked to stop (owner call O4: refused in words, never accepted
 * silently), or null. Call it AFTER `readSecondParentEmail` (which stays pure) with the address it accepted.
 *
 * ⚠ Fails CLOSED: a lookup that errors throws rather than letting a stopped address back onto a sign-up (the same posture as the
 * family suppression read: here the failure mode is mailing a person who said stop, not a missed alert).
 */
export async function stoppedSecondParentRefusal(orgId: string, email: string | null | undefined): Promise<string | null> {
  const normalized = normalizeGuardianEmail(email);
  if (!normalized) return null;
  const { data, error } = await supabaseAdmin
    .from('second_parent_stops').select('id').eq('org_id', orgId).eq('email', normalized).maybeSingle();
  if (error) throw error;
  return data ? SECOND_PARENT_WORDS.stoppedAddress : null;
}

/**
 * Attach `secondParentStoppedAt` to the sign-ups the record window draws: the date the address owner stopped, for a sign-up
 * whose second address a stop CLEARED (`registration_ids`). It is only ever set for a row with NO second address now: when the
 * registrar has since added a different one, the window shows that address and the line is gone (it "replaces the line").
 * One read for the whole page, and none at all when every row has an address.
 */
export async function withSecondParentStops<T extends { id: string; guardianEmail2: string | null }>(
  orgId: string,
  regs: readonly T[],
): Promise<(T & { secondParentStoppedAt: string | null })[]> {
  const bare = regs.filter(r => !r.guardianEmail2).map(r => r.id);
  const when = new Map<string, string>();
  if (bare.length > 0) {
    const { data, error } = await supabaseAdmin
      .from('second_parent_stops').select('stopped_at, registration_ids').eq('org_id', orgId).overlaps('registration_ids', bare);
    if (error) throw error;
    for (const stop of data ?? []) {
      for (const id of (stop.registration_ids as string[] | null) ?? []) if (!when.has(id)) when.set(id, stop.stopped_at as string);
    }
  }
  return regs.map(r => ({ ...r, secondParentStoppedAt: r.guardianEmail2 ? null : (when.get(r.id) ?? null) }));
}
