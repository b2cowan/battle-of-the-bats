/**
 * The trail of records opened (Support console Stage 2, owner ruling A3 2026-10-25; migration 365 `platform_record_opens`).
 *
 * One quiet row each time a staff member opens a club or person record: who, when, which, and whether Find opened it.
 * ⚠ NEVER the words typed — they are usually the same email or name again, and keeping them for 90 days would make the
 * trail a second store of personal data (threat T14). Never shown on a customer's Story. Super admin reads it in the
 * Audit log under "Records opened".
 *
 * Kept 90 days by PRUNING ON WRITE (no scheduled job). A record re-rendered after an edit is not a second opening: a
 * repeat by the same person within ten minutes writes nothing. Best effort and silent — a trail that fails to write never
 * stops a record from opening.
 */
import { supabaseAdmin } from './supabase-admin';

export const RECORD_OPENS_KEEP_DAYS = 90;
const REPEAT_WINDOW_MS = 10 * 60_000;

export type RecordKind = 'club' | 'person';

export async function recordOpened(opts: {
  actorUserId: string;
  actorEmail: string | null | undefined;
  kind: RecordKind;
  recordId: string;
  viaFind: boolean;
}): Promise<void> {
  try {
    const actorEmail = (opts.actorEmail ?? 'platform-admin').toLowerCase();
    const since = new Date(Date.now() - REPEAT_WINDOW_MS).toISOString(); // utc-intentional: an instant comparison
    const { data: recent } = await supabaseAdmin
      .from('platform_record_opens')
      .select('id')
      .eq('actor_user_id', opts.actorUserId)
      .eq('record_kind', opts.kind)
      .eq('record_id', opts.recordId)
      .gte('opened_at', since)
      .limit(1);
    if (recent && recent.length > 0) return;

    await supabaseAdmin.from('platform_record_opens').insert({
      actor_user_id: opts.actorUserId,
      actor_email: actorEmail,
      record_kind: opts.kind,
      record_id: opts.recordId,
      via_find: opts.viaFind,
    });

    const cutoff = new Date(Date.now() - RECORD_OPENS_KEEP_DAYS * 86_400_000).toISOString(); // utc-intentional: retention instant
    await supabaseAdmin.from('platform_record_opens').delete().lt('opened_at', cutoff);
  } catch {
    // The trail is a record of reading, never a gate on it.
  }
}

export type RecordOpenRow = {
  id: number;
  actorEmail: string;
  kind: RecordKind;
  recordId: string;
  viaFind: boolean;
  openedAt: string;
};

/** Newest first, for the Audit log's "Records opened" (Super admin only — the caller checks). */
export async function listRecordsOpened(opts: { offset: number; limit: number }): Promise<{ rows: RecordOpenRow[]; total: number }> {
  const { data, error, count } = await supabaseAdmin
    .from('platform_record_opens')
    .select('id, actor_email, record_kind, record_id, via_find, opened_at', { count: 'exact' })
    .order('opened_at', { ascending: false })
    .range(opts.offset, opts.offset + opts.limit - 1);
  if (error) return { rows: [], total: 0 };
  return {
    total: count ?? 0,
    rows: (data ?? []).map(r => ({
      id: r.id as number,
      actorEmail: r.actor_email as string,
      kind: r.record_kind as RecordKind,
      recordId: r.record_id as string,
      viaFind: r.via_find as boolean,
      openedAt: r.opened_at as string,
    })),
  };
}
