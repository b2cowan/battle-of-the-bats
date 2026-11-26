// Server code only (it holds the service-role client), but no `server-only` import: the senders and the event writer
// load it, and the unit suite loads them (the package resolves only inside Next).
import { supabaseAdmin } from './supabase-admin';

/**
 * lib/preview-org-server.ts — the preview marker by id (Track P, T1). The rule itself is `lib/preview-org.ts`.
 *
 * ── Fail CLOSED ──────────────────────────────────────────────────────────────────────────────────────────────────────
 * The dangerous answer is "no, not a preview" when it is one: that is what would send a prospect's club an email or count
 * it as a customer. So both readers THROW when the database cannot answer, and a send path treats the throw as "do not
 * send". Only a successful read is remembered.
 *
 * Unlike the demo list, previews are made and claimed while the server runs, so only a "no" is remembered, for
 * `CACHE_MS`: a "yes" is read again every time (a preview sends nothing, so those reads are rare), so a club the moment it
 * is claimed sends its welcome and invites (/review 2026-11-25: a remembered "yes" would have refused them for a
 * minute, and refused mail is dropped, not queued). A remembered "no" is safe because a club is a preview from the
 * moment it is made (P2 inserts it with the marker set, in one step: it is never a customer first), and the one way a
 * "no" can turn into a "yes" is a claim undone (T15, mig 540): the undo takes every member out first and refuses once a
 * Stripe customer exists, so the only exposure is the claimant's own address, for up to a minute on another server
 * instance (/billing 2026-11-25; the instance that served the undo forgets at once, `forgetPreviewOrgId`).
 */

const CACHE_MS = 60_000;
/** Clubs last read as NOT a preview, and when. */
const byId = new Map<string, { at: number }>();

/** Is this club a preview right now? Throws when it cannot tell (callers in a send path refuse on a throw). */
export async function isPreviewOrgId(orgId: string | null | undefined): Promise<boolean> {
  if (!orgId) return false;
  const hit = byId.get(orgId);
  if (hit && Date.now() - hit.at < CACHE_MS) return false;
  const { data, error } = await supabaseAdmin.from('organizations').select('is_preview').eq('id', orgId).maybeSingle();
  if (error) throw new Error(`[preview-org] could not read the preview marker: ${error.message}`);
  // A club that does not exist is not a preview (a deleted club's late mail is the caller's own question).
  const preview = (data as { is_preview?: boolean | null } | null)?.is_preview === true;
  if (preview) byId.delete(orgId);
  else byId.set(orgId, { at: Date.now() });
  return preview;
}

/**
 * Every open preview's id (at most five by T6), read fresh. For the count and list readers that scope another table by
 * `org_id` and so cannot filter on the column itself. Throws when it cannot read: a count that cannot leave the previews
 * out does not run (a snapshot written from it would keep the wrong number).
 */
export async function openPreviewOrgIds(): Promise<string[]> {
  const { data, error } = await supabaseAdmin.from('organizations').select('id').eq('is_preview', true);
  if (error) throw new Error(`[preview-org] could not list the previews: ${error.message}`);
  return ((data ?? []) as { id: string }[]).map(r => r.id);
}

/** Forget one club's remembered "not a preview" (a claim was just undone, so it is a preview again). */
export function forgetPreviewOrgId(orgId: string): void {
  byId.delete(orgId);
}

/** Test-only: forget every remembered answer. */
export function resetPreviewOrgCacheForTests(): void {
  byId.clear();
}
