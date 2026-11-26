import 'server-only';
import { supabaseAdmin } from './supabase-admin';
import { captureError } from './observability';
import { writePlatformAuditLog } from './platform-audit';
import { purgeOrgFiles } from './org-files-purge-server';
import { readOrgLegacyResourceKeys } from './resource-file-server';
import { stopClubDomain } from './club-domain-service';
import { clubDomainDeps } from './club-domain-deps';
import { forgetPreviewOrgId } from './preview-org-server';
import { isDueForRemoval, removalQueueCounts, type OpenPreview } from './preview-removal';

/**
 * THE REMOVAL ON DAY 30 (Club Website Track P, Session P4; owner ruling T11, 2026-11-25; the nightly job ruled 2026-11-26).
 *
 * For every preview whose removal day has come and that is still unclaimed, in this order — platform admin's Delete's
 * order (app/api/platform-admin/orgs/[id]/delete/route.ts), with what a preview cannot have (Stripe, money, people, an
 * owner to email) left out:
 *   1. read the club's legacy rules-file names (none for a preview; read anyway so a removal can never orphan one);
 *   2. release the club's own web address, best effort (a preview has none; Delete's step, kept);
 *   3. `remove_due_preview` — ONE database step under the claim's locks that re-checks "a preview, unclaimed, not removed,
 *      past its day" and deletes the club, the cascade taking the sample. Its stamp writes the removal record. A refusal
 *      (claimed a moment ago, not due) changes nothing and is not a failure;
 *   4. the club's stored files (Delete's own file step, `purgeOrgFiles`), after the rows, so a failed row delete never
 *      leaves a club with its files gone.
 * Then, self-healing: the files of every preview removed in the last 7 days are cleared again (a run that died between
 * 3 and 4 leaves its files for the next night, never forever). Then the three-year consent clean-up.
 *
 * Nothing emails the club (T11). A failure reports through captureError (the owner's alert email) and the run's audit row.
 */
export type PreviewRemovalReport = {
  due: number;
  removed: string[];
  /** Refused by the database's re-check (claimed or no longer due a moment ago): nothing changed. */
  refused: { slug: string; why: string }[];
  failed: { slug: string; error: string }[];
  /** Stored-file removals that failed (the club row is gone; retried next night). */
  filesFailed: number;
  /** Files of recently removed previews cleared again (normally 0). */
  filesRetried: number;
  consentsPurged: number;
};

const REFUSALS: Record<string, string> = {
  PV030: 'not a preview',
  PV031: 'claimed',
  PV032: 'already removed',
  PV033: 'not due yet',
};

const RETRY_FILES_DAYS = 7;

type DueRow = { org_id: string; org_slug: string; meeting_at: string; claimed_at: string | null; removed_at: string | null };

/** Every open preview (unclaimed, not removed). At most five exist (T6). Throws when it cannot read. */
async function readOpenPreviews(): Promise<DueRow[]> {
  const { data, error } = await supabaseAdmin
    .from('organization_previews')
    .select('org_id, org_slug, meeting_at, claimed_at, removed_at')
    .is('claimed_at', null)
    .is('removed_at', null);
  if (error) throw new Error(`[preview-removal] the open previews could not be read: ${error.message}`);
  return (data ?? []) as DueRow[];
}

export async function removeDuePreviews(actor: string, now: Date = new Date()): Promise<PreviewRemovalReport> {
  const report: PreviewRemovalReport = { due: 0, removed: [], refused: [], failed: [], filesFailed: 0, filesRetried: 0, consentsPurged: 0 };
  const due = (await readOpenPreviews()).filter(p => isDueForRemoval(p.meeting_at, now));
  report.due = due.length;

  for (const p of due) {
    try {
      const legacy = await readOrgLegacyResourceKeys(p.org_id).catch(() => null);
      if (!legacy) throw new Error('its rules files could not be read, so nothing was removed');
      try {
        const stopped = await stopClubDomain(clubDomainDeps(), p.org_id);
        if (!stopped.ok && stopped.reason === 'failed') {
          await captureError(new Error(`preview removal: the host did not release the club's own address for org ${p.org_id}`));
        }
      } catch (e) {
        await captureError(e);
      }

      const { error } = await supabaseAdmin.rpc('remove_due_preview', { p_org_id: p.org_id, p_actor: actor });
      if (error) {
        const why = REFUSALS[error.code ?? ''];
        if (why) {
          report.refused.push({ slug: p.org_slug, why });
          // A claim landing a moment before is the expected refusal. Any other, for a preview the run read as due, means the
          // two day rules or the marker disagree, and it would recur nightly in silence: say so (/review 2026-11-26).
          if (error.code !== 'PV031') await captureError(new Error(`preview removal: ${p.org_slug} was refused (${why}) though it read as due`));
          continue;
        }
        throw new Error(`the removal step failed: ${error.message}`);
      }
      forgetPreviewOrgId(p.org_id);
      report.removed.push(p.org_slug);

      const files = await purgeOrgFiles(p.org_id, legacy);
      await writePlatformAuditLog(actor, null, files.failed.length ? 'delete_organization_files_failed' : 'delete_organization_files', 'org_id', p.org_id,
        { orgId: p.org_id, orgSlug: p.org_slug, removed: files.removed, byBucket: files.byBucket, legacyKept: files.legacyKept,
          ...(files.failed.length ? { failed: files.failed.slice(0, 50), failedCount: files.failed.length } : {}) },
        { reason: 'Removed 30 days after the meeting' });
      if (files.failed.length) {
        report.filesFailed += files.failed.length;
        await captureError(new Error(`preview removal: ${files.failed.length} stored-file removal(s) failed for org ${p.org_id}; retried next night`));
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      report.failed.push({ slug: p.org_slug, error: message });
      await captureError(new Error(`preview removal: ${p.org_slug} was not removed: ${message}`));
    }
  }

  report.filesRetried = await retryRecentFiles(now);
  const { data: purged, error: purgeError } = await supabaseAdmin.rpc('purge_preview_email_consents');
  if (purgeError) {
    report.failed.push({ slug: '(consent records)', error: purgeError.message });
    await captureError(new Error(`preview removal: the three-year consent clean-up failed: ${purgeError.message}`));
  } else {
    report.consentsPurged = typeof purged === 'number' ? purged : 0;
  }
  return report;
}

/**
 * The files of every preview removed in the last 7 days, cleared again (by hand or by night): normally nothing is there.
 * Only a club whose row is truly gone is touched — the folders are named by its id, and no live club may lose a file.
 */
async function retryRecentFiles(now: Date): Promise<number> {
  const since = new Date(now.getTime() - RETRY_FILES_DAYS * 86_400_000).toISOString(); // utc-intentional: an instant window
  const { data, error } = await supabaseAdmin
    .from('organization_previews')
    .select('org_id')
    .is('claimed_at', null)
    .gte('removed_at', since);
  if (error || !data?.length) return 0;
  const ids = (data as { org_id: string }[]).map(r => r.org_id);
  const { data: live, error: liveError } = await supabaseAdmin.from('organizations').select('id').in('id', ids);
  if (liveError || !live) return 0; // could not read: touch nothing
  const stillThere = new Set((live as { id: string }[]).map(o => o.id));
  let cleared = 0;
  for (const id of ids) {
    if (stillThere.has(id)) continue;
    const files = await purgeOrgFiles(id, []);
    cleared += files.removed;
    if (files.failed.length) await captureError(new Error(`preview removal: ${files.failed.length} stored-file removal(s) still failing for removed org ${id}`));
  }
  return cleared;
}

/** Today's two owner-only counts. null = the previews could not be read (Today says "Not read", never 0). */
export async function readRemovalQueueCounts(now: Date = new Date()): Promise<{ tomorrow: number; overdue: number } | null> {
  try {
    const rows = await readOpenPreviews();
    const open: OpenPreview[] = rows.map(r => ({ meetingAt: r.meeting_at, claimedAt: r.claimed_at, removedAt: r.removed_at }));
    return removalQueueCounts(open, now);
  } catch {
    return null;
  }
}
