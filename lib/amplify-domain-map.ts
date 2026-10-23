/**
 * What the host (AWS Amplify) says about a domain, read into OUR words (Club Tier Stage 4e, Part 2).
 *
 * Pure and SDK-free so a plain Node test pins it; `lib/amplify-domains.ts` is the thin server-only client that calls the
 * SDK and hands its answers through here. The host's status names and error classes are the host's, so the mapping is
 * the one place that has to change if they ever do.
 */

export interface ParsedDnsRecord {
  name: string;
  type: string;
  value: string;
}

/**
 * The host returns a record as one string: `"_c3e2d2.lakeshorelynx.ca. CNAME _6f1b9a.xlfgrmvvlj.acm-validations.aws."` or
 * `"www CNAME d20q9j9hp0ol2g.cloudfront.net"`. Names and values lose a trailing dot; the type is upper-cased.
 */
export function parseDnsRecord(raw: string | null | undefined): ParsedDnsRecord | null {
  const parts = String(raw ?? '').trim().split(/\s+/);
  if (parts.length < 3) return null;
  const [name, type, ...rest] = parts;
  const value = rest.join(' ');
  return { name: name.replace(/\.+$/, ''), type: type.toUpperCase(), value: value.replace(/\.+$/, '') };
}

/**
 * A record name the way a club types it at the place it bought the address: relative to the domain. The padlock record
 * arrives as a full name (`_c3e2d2.lakeshorelynx.ca`); the card shows `_c3e2d2` (the page's hint covers registrars that
 * want the whole name). A name that is not under the domain is returned as it came.
 */
export function relativeRecordName(name: string, domain: string): string {
  const n = name.replace(/\.+$/, '').toLowerCase();
  const d = domain.replace(/\.+$/, '').toLowerCase();
  return n.endsWith(`.${d}`) ? n.slice(0, -(d.length + 1)) : n;
}

/** The host's status for a domain, in three words: live, still working on it, or failed. */
export type HostState = 'live' | 'pending' | 'failed';

export function mapHostStatus(hostStatus: string | null | undefined): HostState {
  switch (String(hostStatus ?? '').toUpperCase()) {
    case 'AVAILABLE':
      return 'live';
    case 'FAILED':
      return 'failed';
    default:
      // CREATING, REQUESTING_CERTIFICATE, PENDING_VERIFICATION, IN_PROGRESS, PENDING_DEPLOYMENT, AWAITING_APP_CNAME,
      // IMPORTING_CUSTOM_CERTIFICATE, UPDATING: all "not yet".
      return 'pending';
  }
}

/** Why the host refused to start a connection. `held_elsewhere` is frame g2; `limit` is our own ceiling. */
export type HostRefusal = 'limit' | 'held_elsewhere' | 'failed';

export function classifyHostError(e: unknown): HostRefusal {
  const err = e as { name?: string; message?: string } | null | undefined;
  const name = String(err?.name ?? '');
  const message = String(err?.message ?? '');
  if (name === 'LimitExceededException') return 'limit';
  if (name === 'CNAMEAlreadyExistsException' || /CNAMEAlreadyExists|already associated|already in use/i.test(message)) {
    return 'held_elsewhere';
  }
  return 'failed';
}

/** Is this a "no such association" answer (a Get after a Delete, or on a name we never created)? */
export function isHostNotFound(e: unknown): boolean {
  const name = String((e as { name?: string } | null | undefined)?.name ?? '');
  return name === 'NotFoundException' || name === 'ResourceNotFoundException';
}
