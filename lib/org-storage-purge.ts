/**
 * A DELETED CLUB'S FILES GO WITH IT (Board Ready Stage 0a / GST-HST Stage 6 step 6.5, P7; 2026-11-15).
 *
 * The privacy policy says "when an organization is deleted, its information and the files it uploaded are deleted with it".
 * The database half was always true (the cascade); this is the file half. Every file a club uploads is filed under its id
 * (`{orgId}/…`, the uuid, never the slug) in one of the buckets below, so a walk of that folder finds it from the id alone,
 * even after the club's row is gone. The one exception is the rules screen's files from before the folders: flat keys with
 * no club in them, which only the club's own `resources` rows name. The delete route reads those BEFORE the cascade takes
 * the rows, and hands them in.
 *
 * Pure of the database and of the service role: the caller passes the storage client (the real one, or a fake in the test).
 * It never throws past the caller: what could not be listed or removed comes back in `failed`, named well enough to retry.
 */

/**
 * EVERY BUCKET A CLUB'S FILES LIVE IN — the single home for the list. `tests/unit/org-storage-purge.test.ts` fails the build
 * when the app writes to a bucket that is neither here nor in `PLATFORM_BUCKETS_NOT_A_CLUBS`.
 */
export const ORG_FILE_BUCKETS = [
  'org-logos',//                     public: logo, stock logos, sponsors, each event's logo
  'org-assets', //                    public: the public site's hero banner
  'resources', //                     public: the rules screen's files (and the legacy flat keys)
  'org-permit-documents', //          private: permit documents
  'rep-team-documents', //            private: players' signed medical and waiver files, document templates (made by hand, not in a migration)
  'tournament-registration-files', // private: files families attach to a registration
  'club-form-files', //               private: a club form's PDF documents and the files families attach (mig 513)
] as const;

/**
 * Buckets that hold no club's files, so deleting a club does not touch them. Each one says why.
 */
export const PLATFORM_BUCKETS_NOT_A_CLUBS: Readonly<Record<string, string>> = {
  // FieldLogicHQ's own bookkeeping receipts (mig 354; the owner chose AWS storage instead, and the dev bucket was deleted).
  // Our own tax records, which the privacy policy keeps; never a club's.
  'proprietor-receipts': 'platform bookkeeping, not a club’s',
};

/** The rules bucket, where the legacy flat keys live. */
const LEGACY_BUCKET = 'resources';

/** One page of a folder. Supabase's `.list()` is not recursive and pages at 100 by default. */
const PAGE = 100;
/** One remove call. */
const BATCH = 100;
/** A walk that finds more than this many files stops and reports itself, rather than running unbounded. */
const MAX_FILES_PER_BUCKET = 50_000;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type StorageEntry = { name: string; id: string | null };
type StorageErrorLike = { message: string; statusCode?: string | number; status?: number } | null;

/** The slice of the Supabase storage client this needs (`supabaseAdmin.storage` fits it). */
export type StorageLike = {
  from(bucket: string): {
    list(path: string, options: { limit: number; offset: number; sortBy: { column: string; order: string } }):
      Promise<{ data: StorageEntry[] | null; error: StorageErrorLike }>;
    remove(paths: string[]): Promise<{ data: unknown; error: StorageErrorLike }>;
  };
};

export type PurgeFailure = { bucket: string; keyOrPrefix: string; message: string };

export type OrgFilesResult = {
  /** Files removed (or, for a count, found) across every bucket. */
  removed: number;
  byBucket: Record<string, number>;
  failed: PurgeFailure[];
};

/** "Bucket not found" is nothing to delete: `rep-team-documents` is made by hand, so a fresh database may not have it. */
export function isMissingBucket(error: StorageErrorLike): boolean {
  if (!error) return false;
  return /bucket not found/i.test(error.message) || (String(error.statusCode ?? '') === '404' && /bucket/i.test(error.message));
}

const messageOf = (e: unknown): string => (e instanceof Error ? e.message : typeof e === 'string' ? e : String((e as { message?: unknown })?.message ?? e));

/**
 * Every file under `prefix` in one bucket: walks into subfolders (a folder is an entry without an id) and pages each one.
 * A list that fails stops the walk for this bucket and is reported; the files found up to then are still returned.
 */
async function walk(storage: StorageLike, bucket: string, prefix: string):
  Promise<{ keys: string[]; missingBucket: boolean; failure: PurgeFailure | null }> {
  const keys: string[] = [];
  const folders = [prefix];
  const api = storage.from(bucket);
  while (folders.length) {
    const folder = folders.pop()!;
    for (let offset = 0; ; offset += PAGE) {
      let page: Awaited<ReturnType<typeof api.list>>;
      try {
        page = await api.list(folder, { limit: PAGE, offset, sortBy: { column: 'name', order: 'asc' } });
      } catch (e) {
        return { keys, missingBucket: false, failure: { bucket, keyOrPrefix: `${prefix}/`, message: `could not list ${folder}/: ${messageOf(e)}` } };
      }
      if (page.error) {
        if (isMissingBucket(page.error)) return { keys: [], missingBucket: true, failure: null };
        return { keys, missingBucket: false, failure: { bucket, keyOrPrefix: `${prefix}/`, message: `could not list ${folder}/: ${page.error.message}` } };
      }
      const entries = page.data ?? [];
      for (const entry of entries) {
        if (!entry?.name) continue;
        const path = `${folder}/${entry.name}`;
        if (entry.id == null) folders.push(path);
        else keys.push(path);
      }
      // Bounded, but never stuck: the first batch is still handled and the rest named, so each run makes progress.
      if (keys.length > MAX_FILES_PER_BUCKET) {
        return { keys: keys.slice(0, MAX_FILES_PER_BUCKET), missingBucket: false, failure: { bucket, keyOrPrefix: `${prefix}/`, message: `more than ${MAX_FILES_PER_BUCKET} files in one run; the rest remain for another` } };
      }
      if (entries.length < PAGE) break;
    }
  }
  return { keys, missingBucket: false, failure: null };
}

/**
 * Removes keys in batches. Failed batches are reported as ONE failure for the call (how many were not removed, and the last
 * reason), never thrown: an outage on a big club is one line, not fifty that crowd out the other buckets.
 */
async function removeKeys(storage: StorageLike, bucket: string, keys: string[], keyOrPrefix: string):
  Promise<{ removed: number; failures: PurgeFailure[] }> {
  let removed = 0;
  let notRemoved = 0;
  let reason = '';
  const api = storage.from(bucket);
  for (let i = 0; i < keys.length; i += BATCH) {
    const batch = keys.slice(i, i + BATCH);
    try {
      const { data, error } = await api.remove(batch);
      if (error) { notRemoved += batch.length; reason = error.message; continue; }
      removed += Array.isArray(data) ? data.length : batch.length;
    } catch (e) {
      notRemoved += batch.length;
      reason = messageOf(e);
    }
  }
  const failures = notRemoved
    ? [{ bucket, keyOrPrefix, message: `${notRemoved} file${notRemoved === 1 ? '' : 's'} not removed: ${reason}` }]
    : [];
  return { removed, failures };
}

/** A malformed id must never become a prefix: an empty one would list the bucket's root, every club's files. */
function badOrgId(orgId: unknown): PurgeFailure | null {
  if (typeof orgId === 'string' && UUID.test(orgId)) return null;
  return { bucket: '*', keyOrPrefix: String(orgId ?? ''), message: 'refused: the organization id is not a uuid' };
}

/** Only flat keys (no folder): a key under a club's folder is the walk's, and any other foldered key is not ours to remove. */
const flatOnly = (keys: readonly string[] | undefined) =>
  [...new Set((keys ?? []).filter(k => typeof k === 'string' && k.length > 0 && !k.includes('/') && k !== '.' && k !== '..'))];

/**
 * Removes every file the club uploaded: each bucket's `{orgId}/` folder, walked whole, and the legacy flat rules keys the
 * caller read from the club's rows before they were deleted (and found no other row still naming).
 */
export async function removeOrgFiles(args: { storage: StorageLike; orgId: string; legacyResourceKeys?: readonly string[];
  buckets?: readonly string[] }): Promise<OrgFilesResult> {
  const { storage, orgId } = args;
  const buckets = args.buckets ?? ORG_FILE_BUCKETS;
  const refused = badOrgId(orgId);
  if (refused) return { removed: 0, byBucket: {}, failed: [refused] };

  const byBucket: Record<string, number> = {};
  const failed: PurgeFailure[] = [];
  const own = `${orgId}/`;
  // The buckets are independent, so they run at once (the delete's request time is the bound that matters).
  await Promise.all(buckets.map(async bucket => {
    try {
      const found = await walk(storage, bucket, orgId);
      if (found.failure) failed.push(found.failure);
      let removed = 0;
      // Every walked key starts under the club's folder by construction; checked here too, so the isolation holds locally.
      const keys = found.keys.filter(k => k.startsWith(own));
      if (!found.missingBucket && keys.length) {
        const r = await removeKeys(storage, bucket, keys, own);
        removed += r.removed;
        failed.push(...r.failures);
      }
      if (bucket === LEGACY_BUCKET && !found.missingBucket) {
        const legacy = flatOnly(args.legacyResourceKeys);
        if (legacy.length) {
          const r = await removeKeys(storage, bucket, legacy, `${legacy.length} legacy rules file${legacy.length === 1 ? '' : 's'}`);
          removed += r.removed;
          failed.push(...r.failures);
        }
      }
      byBucket[bucket] = removed;
    } catch (e) {
      failed.push({ bucket, keyOrPrefix: own, message: messageOf(e) });
    }
  }));
  return { removed: Object.values(byBucket).reduce((a, b) => a + b, 0), byBucket, failed };
}

/**
 * Counts what `removeOrgFiles` would remove, for the delete window ("and its N stored files"). Removes nothing.
 * `legacyResourceKeys` are counted as given (the caller has already narrowed them to the ones the delete would remove).
 */
export async function countOrgFiles(args: { storage: StorageLike; orgId: string; legacyResourceKeys?: readonly string[];
  buckets?: readonly string[] }): Promise<OrgFilesResult> {
  const { storage, orgId } = args;
  const buckets = args.buckets ?? ORG_FILE_BUCKETS;
  const refused = badOrgId(orgId);
  if (refused) return { removed: 0, byBucket: {}, failed: [refused] };

  const byBucket: Record<string, number> = {};
  const failed: PurgeFailure[] = [];
  await Promise.all(buckets.map(async bucket => {
    try {
      const found = await walk(storage, bucket, orgId);
      if (found.failure) failed.push(found.failure);
      byBucket[bucket] = found.keys.length + (bucket === LEGACY_BUCKET && !found.missingBucket ? flatOnly(args.legacyResourceKeys).length : 0);
    } catch (e) {
      failed.push({ bucket, keyOrPrefix: `${orgId}/`, message: messageOf(e) });
    }
  }));
  return { removed: Object.values(byBucket).reduce((a, b) => a + b, 0), byBucket, failed };
}
