/**
 * THE RULES SCREEN'S FILE STORE — the reads that need the database (the pure rules are in `resource-file-storage.ts`).
 * Shared by the rules file route (`/api/admin/resources/file`) and the club delete (`/api/platform-admin/orgs/[id]/delete`).
 */
import { supabaseAdmin } from './supabase-admin';
import { RESOURCE_BUCKET, isClubKey, isLegacyFlatKey, keySpellings, mayRemoveKey, resourceKeyFromUrl } from './resource-file-storage';

/** LIKE-escape so a file name's `_` and `%` match themselves (an over-match would only KEEP a file, never remove one). */
const likeEscape = (s: string) => s.replace(/[\\%_]/g, c => `\\${c}`);

/**
 * Does any OTHER row still name this stored file? A copied event reuses its source's address, so the file stays while one
 * does. For a key in this club's folder only this club's events count (a stranger's row that merely repeats a public address
 * cannot keep a club's file alive); a flat key belongs to nobody, so any row anywhere counts (a typed link can imitate one).
 * Both spellings of the address are tried, and a lookup that fails answers "yes": an orphan is harmless, a dead link is not.
 */
export async function keyStillNamed(key: string, orgId: string): Promise<boolean> {
  return (await keyNamedState(key, orgId)) !== 'free';
}

/** The same lookup, telling a failed read apart from "named" (the club delete reports the first as a failure to retry). */
async function keyNamedState(key: string, orgId: string): Promise<'named' | 'free' | 'unread'> {
  let tournamentIds: string[] | null = null;
  if (isClubKey(key, orgId)) {
    const { data, error } = await supabaseAdmin.from('tournaments').select('id').eq('org_id', orgId);
    if (error) return 'unread';
    tournamentIds = (data ?? []).map(t => t.id as string);
  }
  for (const spelling of keySpellings(key)) {
    let query = supabaseAdmin
      .from('resources')
      .select('id', { count: 'exact', head: true })
      .like('url', `%/${RESOURCE_BUCKET}/${likeEscape(spelling)}%`);
    if (tournamentIds) query = query.in('tournament_id', tournamentIds);
    const { count, error } = await query;
    if (error) return 'unread';
    if (count) return 'named';
  }
  return 'free';
}

const ROWS_PAGE = 1000;

/**
 * The legacy flat keys this club's rules rows own (Board Ready Stage 0a): flat keys carry no club id, so only the rows find
 * them, and the rows go with the club's cascade. Read BEFORE the delete. A row owns a flat key only when it is from before the
 * folders (`mayRemoveKey`), as on the rules screen's own delete. Null when the rows could not be read.
 */
export async function readOrgLegacyResourceKeys(orgId: string): Promise<string[] | null> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
  const { data: events, error: eventsError } = await supabaseAdmin.from('tournaments').select('id').eq('org_id', orgId);
  if (eventsError) return null;
  const ids = (events ?? []).map(t => t.id as string);
  if (!ids.length) return [];
  const keys = new Set<string>();
  // 50 event ids a read keeps the request line well under the 8 KB limits a proxy may enforce (a uuid is 36 characters).
  for (let i = 0; i < ids.length; i += 50) {
    const chunk = ids.slice(i, i + 50);
    for (let from = 0; ; from += ROWS_PAGE) {
      const { data, error } = await supabaseAdmin.from('resources').select('url, created_at')
        .in('tournament_id', chunk).like('url', `%/${RESOURCE_BUCKET}/%`).order('id').range(from, from + ROWS_PAGE - 1);
      if (error) return null;
      for (const row of data ?? []) {
        const key = resourceKeyFromUrl(String(row.url ?? ''), supabaseUrl);
        if (key && isLegacyFlatKey(key) && mayRemoveKey(key, orgId, row.created_at as string | null)) keys.add(key);
      }
      if ((data ?? []).length < ROWS_PAGE) break;
    }
  }
  return [...keys];
}

/**
 * Of the club's legacy flat keys, the ones no row anywhere still names, read AFTER the club's rows are gone: another club's
 * row (a copy, or a typed link) keeps the file, as on the rules screen's delete. A key whose lookup failed is `unread`: it is
 * kept (never removed on a guess) and the caller reports it, so it is not left behind silently.
 */
export async function legacyKeysNoRowNames(keys: readonly string[], orgId: string):
  Promise<{ free: string[]; kept: string[]; unread: string[] }> {
  const free: string[] = [];
  const kept: string[] = [];
  const unread: string[] = [];
  for (let i = 0; i < keys.length; i += 10) {
    const chunk = keys.slice(i, i + 10);
    const states = await Promise.all(chunk.map(k => keyNamedState(k, orgId)));
    chunk.forEach((k, j) => (states[j] === 'free' ? free : states[j] === 'named' ? kept : unread).push(k));
  }
  return { free, kept, unread };
}
