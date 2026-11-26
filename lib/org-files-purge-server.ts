import 'server-only';
import { supabaseAdmin } from './supabase-admin';
import { removeOrgFiles, type OrgFilesResult } from './org-storage-purge';
import { legacyKeysNoRowNames } from './resource-file-server';

/**
 * A removed club's file half, run after its rows are gone: platform admin's Delete and the preview removal
 * (lib/preview-removal-server.ts) share it. Never throws: a lookup or a purge that breaks comes back as a failure naming
 * the club's folder, which is enough to retry from (the folder is the id).
 */
export async function purgeOrgFiles(orgId: string, legacyResourceKeys: string[]): Promise<OrgFilesResult & { legacyKept: number }> {
  try {
    const { free, kept, unread } = await legacyKeysNoRowNames(legacyResourceKeys, orgId);
    const result = await removeOrgFiles({ storage: supabaseAdmin.storage, orgId, legacyResourceKeys: free });
    // A legacy key whose "still named?" lookup failed is kept, and reported (Delete wrote its name on the
    // `delete_organization` row).
    if (unread.length) {
      result.failed.push({ bucket: 'resources', keyOrPrefix: `${unread.length} legacy rules file${unread.length === 1 ? '' : 's'}`,
        message: `${unread.length} not checked against other clubs’ rows (the lookup failed), so kept` });
    }
    return { ...result, legacyKept: kept.length };
  } catch (e) {
    return {
      removed: 0, byBucket: {}, legacyKept: 0,
      failed: [{ bucket: '*', keyOrPrefix: `${orgId}/`, message: e instanceof Error ? e.message : String(e) }],
    };
  }
}
