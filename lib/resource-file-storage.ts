/**
 * THE RULES SCREEN'S FILE STORE — what a stored file is called, and which of them a club may touch
 * (Board Ready W2 fix B, the third access sweep's finding 2, 2026-11-11).
 *
 * The `resources` bucket is public to READ and, since the browser stopped writing to it, closed to every signed-in
 * account for writing: uploads and deletes go through `/api/admin/resources/file`, which checks the club and the
 * `post_rules` capability and then uses the service role. This file holds the pure rules that route and its guard share.
 *
 *   · New files are filed `{orgId}/{tournamentId}/{uuid}-{cleanName}`.
 *   · Files uploaded before this change keep their flat keys (`1699999999999-name.pdf`) and addresses; nothing was moved.
 *   · A row's address names the file it owns only when it is this project's own public address in this bucket. A club's
 *     delete may remove a key under ITS OWN folder, or a flat key (and for a flat key the route also requires that no
 *     other row anywhere still names it, because a typed link can imitate any flat key's address).
 */

export const RESOURCE_BUCKET = 'resources';

/**
 * The bucket's own types (mig 087). The SIZE is lower than the bucket's 50 MB on purpose: the request passes through the proxy, which
 * buffers a body only up to 10 MB (Next's `proxyClientMaxBodySize` default) and cuts the rest, so a bigger upload would arrive
 * as a broken form. 9 MB leaves room for the form's own bytes. The other document routes cap at 10 MB for the same reason.
 */
export const RESOURCE_MAX_BYTES = 9 * 1024 * 1024;
export const RESOURCE_ALLOWED_MIME: readonly string[] = [
  'application/pdf',
  'image/png', 'image/jpeg', 'image/gif', 'image/webp',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
];

/** The file's name as stored: word characters, dots and dashes only, spaces to underscores, never empty, never long. */
export function cleanResourceFileName(name: string): string {
  const cleaned = name.replace(/[^\w\s.-]/gi, '').replace(/\s+/g, '_').replace(/^\.+/, '');
  const short = cleaned.length > 100 ? cleaned.slice(-100) : cleaned;
  return short || 'file';
}

/** `{orgId}/{tournamentId}/{uuid}-{cleanName}` — the only shape a new upload takes. */
export function resourceObjectPath(orgId: string, tournamentId: string, uuid: string, fileName: string): string {
  return `${orgId}/${tournamentId}/${uuid}-${cleanResourceFileName(fileName)}`;
}

const PUBLIC_PREFIX = `/storage/v1/object/public/${RESOURCE_BUCKET}/`;

/**
 * The stored key a row's address names, or null when the address is not a file in this project's bucket (a typed link,
 * another project's storage, a crafted path). `supabaseUrl` is the project's own URL (NEXT_PUBLIC_SUPABASE_URL).
 */
export function resourceKeyFromUrl(address: string, supabaseUrl: string): string | null {
  let url: URL;
  let own: URL;
  try {
    url = new URL(address);
    own = new URL(supabaseUrl);
  } catch {
    return null;
  }
  if (url.host !== own.host) return null;
  if (!url.pathname.startsWith(PUBLIC_PREFIX)) return null;
  let key: string;
  try {
    key = decodeURIComponent(url.pathname.slice(PUBLIC_PREFIX.length));
  } catch {
    return null;
  }
  if (!key || key.includes('\\') || key.includes('\0')) return null;
  if (key.split('/').some(part => part === '' || part === '.' || part === '..')) return null;
  return key;
}

/** Under this club's own folder. */
export function isClubKey(key: string, orgId: string): boolean {
  return key.startsWith(`${orgId}/`);
}

/** An address from before the folders: one flat segment. */
export function isLegacyFlatKey(key: string): boolean {
  return !key.includes('/');
}

/**
 * Rows made on or after this day cannot honestly own a flat key: new uploads are filed under a club folder, so a newer row
 * naming a flat key is a copy of an older one or a forgery (a typed link imitating someone's old file). Old files are only
 * ever removed by an OLD row; a copy is the last to go and simply leaves the file in place.
 */
export const LEGACY_FLAT_KEY_CUTOFF = Date.parse('2026-11-11T00:00:00Z');

/**
 * Whether a club's delete may remove this key at all, given when the row naming it was created. Its own folder: yes. A flat
 * key: only for a row from before the folders (and the route still requires that no other row names it). When unsure, no.
 */
export function mayRemoveKey(key: string, orgId: string, rowCreatedAt?: string | null): boolean {
  if (isClubKey(key, orgId)) return true;
  if (!isLegacyFlatKey(key) || !rowCreatedAt) return false;
  const made = Date.parse(rowCreatedAt);
  return Number.isFinite(made) && made < LEGACY_FLAT_KEY_CUTOFF;
}

/** The two spellings a stored address can carry for one key: as typed, and percent-encoded by the storage client. */
export function keySpellings(key: string): string[] {
  return [...new Set([key, key.split('/').map(encodeURIComponent).join('/')])];
}
