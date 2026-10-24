/**
 * A CLUB'S OWN WEB ADDRESS: the pure rules (Club Tier Stage 4e, Part 2).
 *
 * Typing it (the cleaner and the refusals), the two records the club copies, and how a lookup of those
 * records is read. No database, no network, no `server-only`: the routes, the status check and the screen's
 * live checks all import this, and a plain Node test pins it. The words a refusal shows are
 * `CLUB_TIER_STAGE4E_COPY.md` §4b; this file returns a REASON and the screen/route looks the sentence up.
 */
import { isOwnHost } from './own-hosts';

/** What a connection can be at any moment. The chip, the links we hand out and the forward all read this. */
export type ClubDomainStatus =
  | 'waiting' // records handed out, not both seen live yet
  | 'connected' // live; links use the club's address
  | 'needs_attention' // record 1 (the padlock check) is gone; the site still works
  | 'not_connected' // checking gave up after two days
  | 'not_working'; // record 2 is gone; the club's address is broken

/** Statuses in which the product hands out the club's own address (the drawings' rules table). */
export const STATUSES_USING_OWN_ADDRESS: readonly ClubDomainStatus[] = ['connected', 'needs_attention'];

export function usesOwnAddress(status: ClubDomainStatus | null | undefined): boolean {
  return !!status && STATUSES_USING_OWN_ADDRESS.includes(status);
}

// ── Typing ────────────────────────────────────────────────────────────────────────────────────────

/**
 * Clean what a person typed or pasted, without a word to them: `https://WWW.LakeshoreLynx.ca/home` becomes
 * `lakeshorelynx.ca`. The `www.` is fixed on screen in the default mode, so a leading one is always dropped
 * there (it would read `www.www.`); in the other-name mode it is kept as the club typed it.
 */
export function cleanAddressInput(raw: string, mode: 'www' | 'other' = 'www', opts: { whileTyping?: boolean } = {}): string {
  // Capped FIRST: nothing below is allowed to work on an unbounded string (a 200,000-dot body once cost a server 23 s in the
  // trailing-dot trim). 400 is far past any real address (253 at most).
  let s = String(raw ?? '').slice(0, 400).trim().toLowerCase();
  s = s.replace(/^[a-z][a-z0-9+.-]*:\/\//, ''); // https://
  s = s.replace(/^[^@/]*@/, ''); // user:pass@
  s = s.split(/[/?#]/, 1)[0]; // a trailing path, query or fragment
  s = s.replace(/:\d+$/, ''); // a port
  // A trailing dot is dropped when the address is read, never while it is being typed: `lakeshorelynx.` is on its way to `.ca`.
  if (!opts.whileTyping) {
    let end = s.length;
    while (end > 0 && s[end - 1] === '.') end--;
    s = s.slice(0, end);
  }
  if (mode === 'www') s = s.replace(/^(www\.)+/, '');
  return s;
}

/** The field's own clean-up as the club types or pastes: everything above except the trailing dot. */
export const cleanAddressWhileTyping = (raw: string, mode: 'www' | 'other' = 'www') =>
  cleanAddressInput(raw, mode, { whileTyping: true });

/** Why an address is refused. The sentences are the copy doc's §4b. */
export type AddressRefusal =
  | 'not_a_domain' // not a web address (spaces, no dot, bad characters)
  | 'ours' // one of FieldLogicHQ's own addresses
  | 'needs_a_name'; // the other-name mode, and only a bare name was typed

export interface ParsedAddress {
  /** The whole name the club connects: `www.lakeshorelynx.ca`. */
  fullName: string;
  /** The name the club owns: `lakeshorelynx.ca`. */
  domain: string;
  /** The part in front: `www`, `teams`. */
  prefix: string;
}

const LABEL = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;

function validLabels(host: string): string[] | null {
  if (!host || host.length > 253) return null;
  const labels = host.split('.');
  if (labels.length < 2 || !labels.every((l) => LABEL.test(l))) return null;
  // The last label (the ending, like "ca") is letters, at least two: never an IP address or a bare number.
  if (!/^[a-z]{2,63}$/.test(labels[labels.length - 1])) return null;
  // Endings that are never a club's own web address (local and test names), and names that are a host's or a cloud's own.
  if (NOT_A_CLUB_ENDING.has(labels[labels.length - 1])) return null;
  if (isPublicSuffixOnly(labels) || isCloudName(labels)) return null;
  return labels;
}

const NOT_A_CLUB_ENDING = new Set(['local', 'localhost', 'internal', 'invalid', 'test', 'example', 'lan', 'home', 'corp', 'intranet', 'arpa']);
/** The second-level labels a country's registry sells names under: `co.uk`, `on.ca` are endings, not something a club owns. */
const SECOND_LEVELS = new Set(['co', 'com', 'org', 'net', 'gov', 'edu', 'ac', 'ab', 'bc', 'mb', 'nb', 'nl', 'ns', 'nt', 'nu', 'on', 'pe', 'qc', 'sk', 'yk']);
/** A name that is only a public suffix (`co.uk`, `on.ca`, `com.au`): two labels, the first a registry's second level, the last a country. */
function isPublicSuffixOnly(labels: string[]): boolean {
  return labels.length === 2 && SECOND_LEVELS.has(labels[0]) && labels[1].length === 2;
}
const CLOUD_ROOTS = ['cloudfront.net', 'amazonaws.com', 'herokuapp.com', 'vercel.app', 'netlify.app', 'github.io', 'pages.dev', 'workers.dev', 'azurewebsites.net', 'web.app', 'firebaseapp.com'];
/** A cloud provider's own address (or one under it): never something a club owns, and ours to refuse before it reaches the host. */
function isCloudName(labels: string[]): boolean {
  const name = labels.join('.');
  return CLOUD_ROOTS.some(r => name === r || name.endsWith(`.${r}`));
}

/**
 * Turn the field's value into the connection to create. `mode` is the screen's: `www` fixes the front part,
 * `other` ("Use a name other than www") makes the whole name typeable and needs a name in front.
 */
export function parseAddress(raw: string, mode: 'www' | 'other' = 'www'):
  | { ok: true; address: ParsedAddress }
  | { ok: false; reason: AddressRefusal } {
  const cleaned = cleanAddressInput(raw, mode);

  if (mode === 'www') {
    const labels = validLabels(cleaned);
    if (!labels) return { ok: false, reason: 'not_a_domain' };
    const fullName = `www.${cleaned}`;
    if (isOwnHost(fullName)) return { ok: false, reason: 'ours' };
    return { ok: true, address: { fullName, domain: cleaned, prefix: 'www' } };
  }

  const labels = validLabels(cleaned);
  if (!labels) return { ok: false, reason: 'not_a_domain' };
  if (isOwnHost(cleaned)) return { ok: false, reason: 'ours' };
  // A name in front of a name the club owns: at least three labels (teams.lakeshorelynx.ca). A two-label
  // name is the bare name, which can only forward, never be connected.
  if (labels.length < 3) return { ok: false, reason: 'needs_a_name' };
  const [prefix, ...rest] = labels;
  return { ok: true, address: { fullName: cleaned, domain: rest.join('.'), prefix } };
}

// ── Reading the two records ──────────────────────────────────────────────────────────────────────

/** What our own lookup sees for one record. Never "live": the host decides that. */
export type RecordSighting =
  | { state: 'not_seen' }
  | { state: 'found' }
  | { state: 'points_elsewhere'; sees: string };

/** A name as DNS returns it, compared the way DNS compares: case-blind, no trailing dot. */
export function normalizeDnsName(name: string): string {
  return String(name ?? '').trim().toLowerCase().replace(/\.+$/, '');
}

/**
 * Record 1, the padlock check: a CNAME at a name of the host's choosing, whose value must be exactly the host's.
 * `observed` is every value the lookup returned (empty or null when there is none).
 */
export function judgePadlockRecord(observed: readonly string[] | null | undefined, expectedValue: string): RecordSighting {
  const seen = (observed ?? []).map(normalizeDnsName).filter(Boolean);
  if (seen.length === 0) return { state: 'not_seen' };
  const want = normalizeDnsName(expectedValue);
  if (seen.includes(want)) return { state: 'found' };
  return { state: 'points_elsewhere', sees: seen[0] };
}

/**
 * Record 2, the site: a CNAME at the club's front name. It is right when it names the value we handed out OR the
 * host's own target (a club that typed the host's target works just as well), and "Points elsewhere" when it names
 * anything else, which is the single most common mistake: the old website's address still sitting there.
 */
/** Every value record 2 may hold: the name we hand out, and the host's own target (a club that typed that works just as well). */
export function acceptedSiteValues(row: { record2_value: string; record2_host_target: string | null }): string[] {
  return [row.record2_value, ...(row.record2_host_target ? [row.record2_host_target] : [])];
}

export function judgeSiteRecord(
  observed: readonly string[] | null | undefined,
  acceptedValues: readonly string[],
): RecordSighting {
  const seen = (observed ?? []).map(normalizeDnsName).filter(Boolean);
  if (seen.length === 0) return { state: 'not_seen' };
  const ok = new Set(acceptedValues.map(normalizeDnsName));
  if (seen.some((v) => ok.has(v))) return { state: 'found' };
  return { state: 'points_elsewhere', sees: seen[0] };
}
