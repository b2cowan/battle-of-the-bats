/**
 * A CLUB'S OWN WEB ADDRESS: what the four routes do (Club Tier Stage 4e, Part 2).
 *
 * Connect, check now, try again, stop. Everything they need from the outside world comes in as `ServiceDeps` (the
 * stored row, the host, a DNS lookup, "is this the demo club"), so the rules run under a plain Node test with fakes and
 * the routes stay thin. No `server-only` for the same reason: nothing here touches a secret itself.
 *
 * ⚖ Check now reads our own lookup of the two records and writes what it saw. It NEVER moves a connection to
 * `connected`: only the host knows the site is live, and the status job (Part 6) is the one that asks it.
 * ⚖ A connection that cannot be fully set up (the host gave no records, the row could not be saved) leaves nothing
 * behind at the host: an orphaned association would hold the club's name against its own next attempt.
 */
import {
  type AddressRefusal,
  type ClubDomainStatus,
  type RecordSighting,
  judgePadlockRecord,
  judgeSiteRecord,
  parseAddress,
} from './club-domain';
import type { DomainHost } from './amplify-domains';
import { classifyHostError } from './amplify-domain-map';

/** Two days: how long a connection waits for its records before checking gives up (copy doc §5, frame g1). */
export const WAITING_GIVE_UP_MS = 2 * 24 * 60 * 60 * 1000;

export interface DomainRow {
  id: string;
  org_id: string;
  full_name: string;
  domain: string;
  prefix: string;
  status: ClubDomainStatus;
  host_status: string | null;
  host_branch: string | null;
  record1_name: string;
  record1_value: string;
  record2_name: string;
  record2_value: string;
  record2_host_target: string | null;
  last_checked_at: string | null;
  last_check: LastCheck | null;
  waiting_since: string;
  connected_at: string | null;
  needs_attention_since: string | null;
  not_working_since: string | null;
  padlock_expires_at: string | null;
  // Which of the owner emails have gone for this stretch (cleared when the stretch ends), so none repeats.
  live_email_sent_at: string | null;
  padlock_email_sent_at: string | null;
  padlock_reminder_sent_at: string | null;
  gave_up_email_sent_at: string | null;
  not_working_email_sent_at: string | null;
  created_by_user_id: string | null;
  created_at: string;
}

/** What our own lookups last saw. `bare_forwards` is filled by the status job (Part 6); null until it has looked. */
export interface LastCheck {
  record1: RecordSighting;
  record2: RecordSighting;
  bare_forwards: boolean | null;
  // The status job's own clocks (Part 6): when record 2 was last looked at, the first of two misses in a row, and the daily look.
  record2_checked_at?: string | null;
  record2_first_miss_at?: string | null;
  daily_at?: string | null;
}

export type NewDomainRow = Pick<
  DomainRow,
  'org_id' | 'full_name' | 'domain' | 'prefix' | 'host_status' | 'host_branch' | 'record1_name' | 'record1_value' |
  'record2_name' | 'record2_value' | 'record2_host_target' | 'created_by_user_id'
>;

export interface DomainStore {
  getByOrg(orgId: string): Promise<DomainRow | null>;
  getByFullName(fullName: string): Promise<DomainRow | null>;
  getByDomain(domain: string): Promise<DomainRow | null>;
  /** Every connection (the status job walks them; the table is a few hundred rows at the very most). */
  listAll(): Promise<DomainRow[]>;
  /** Throws `{ code: '23505' }` when the name or the club already has a row (a race past our own check). */
  insert(row: NewDomainRow): Promise<DomainRow>;
  update(orgId: string, patch: Partial<DomainRow>): Promise<DomainRow>;
  remove(orgId: string): Promise<void>;
}

export interface DnsLookup {
  /** Every CNAME value at `name`; an empty list when there is none. Throws only when the lookup itself failed. */
  cnames(name: string): Promise<string[]>;
}

export interface ServiceDeps {
  store: DomainStore;
  host: DomainHost;
  dns: DnsLookup;
  /** The name record 2 points at ("sites.fieldlogichq.ca"); null hands out the host's own target instead. */
  siteTarget: string | null;
  /** The Amplify branch a club's address serves; stored for diagnosis. */
  branch: string;
  /** Fail-closed: throws when the demo list cannot load. */
  isDemoOrg(orgId: string): Promise<boolean>;
  now(): Date;
}

// ── Connect ───────────────────────────────────────────────────────────────────────────────────────

export type ConnectRefusal =
  | AddressRefusal
  | 'demo' // the demo club
  | 'taken' // another club holds the name
  | 'already_connected' // this club already has an address
  | 'held_elsewhere' // another website service still has it (frame g2)
  | 'limit' // our own ceiling on addresses
  | 'failed'; // anything on our side

export type ConnectResult = { ok: true; row: DomainRow } | { ok: false; reason: ConnectRefusal };

export async function connectClubDomain(
  deps: ServiceDeps,
  input: { orgId: string; userId: string | null; raw: string; mode: 'www' | 'other' },
): Promise<ConnectResult> {
  const parsed = parseAddress(input.raw, input.mode);
  if (!parsed.ok) return { ok: false, reason: parsed.reason };
  const { fullName, domain, prefix } = parsed.address;

  try {
    if (await deps.isDemoOrg(input.orgId)) return { ok: false, reason: 'demo' };

    if (await deps.store.getByOrg(input.orgId)) return { ok: false, reason: 'already_connected' };
    if ((await deps.store.getByFullName(fullName)) || (await deps.store.getByDomain(domain))) {
      return { ok: false, reason: 'taken' };
    }

    let records;
    try {
      records = await deps.host.create({ domain, prefix });
    } catch (e) {
      return { ok: false, reason: classifyHostError(e) };
    }

    if (!records.record1 || records.state === 'failed') {
      await deps.host.remove(domain).catch(() => {});
      return { ok: false, reason: 'failed' };
    }

    const hostTarget = records.record2HostTarget;
    const record2Value = deps.siteTarget ?? hostTarget;
    if (!record2Value) {
      await deps.host.remove(domain).catch(() => {});
      return { ok: false, reason: 'failed' };
    }

    try {
      const row = await deps.store.insert({
        org_id: input.orgId,
        full_name: fullName,
        domain,
        prefix,
        host_status: records.hostStatus,
        host_branch: deps.branch,
        record1_name: records.record1.name,
        record1_value: records.record1.value,
        record2_name: prefix,
        record2_value: record2Value,
        record2_host_target: hostTarget,
        created_by_user_id: input.userId,
      });
      return { ok: true, row };
    } catch (e) {
      await deps.host.remove(domain).catch(() => {});
      return { ok: false, reason: (e as { code?: string } | null)?.code === '23505' ? 'taken' : 'failed' };
    }
  } catch {
    return { ok: false, reason: 'failed' };
  }
}

// ── Check now ─────────────────────────────────────────────────────────────────────────────────────

export type CheckResult =
  | { ok: true; row: DomainRow; record1: RecordSighting; record2: RecordSighting }
  | { ok: false; reason: 'none' | 'lookup_failed' };

export async function checkClubDomainNow(deps: ServiceDeps, orgId: string): Promise<CheckResult> {
  const row = await deps.store.getByOrg(orgId);
  if (!row) return { ok: false, reason: 'none' };

  let seen1: string[];
  let seen2: string[];
  try {
    [seen1, seen2] = await Promise.all([
      deps.dns.cnames(`${row.record1_name}.${row.domain}`),
      deps.dns.cnames(row.full_name),
    ]);
  } catch {
    return { ok: false, reason: 'lookup_failed' };
  }

  const record1 = judgePadlockRecord(seen1, row.record1_value);
  const accepted = [row.record2_value, ...(row.record2_host_target ? [row.record2_host_target] : [])];
  const record2 = judgeSiteRecord(seen2, accepted);

  const updated = await deps.store.update(orgId, {
    last_checked_at: deps.now().toISOString(),
    last_check: { record1, record2, bare_forwards: row.last_check?.bare_forwards ?? null },
  });
  return { ok: true, row: updated, record1, record2 };
}

// ── Try again ─────────────────────────────────────────────────────────────────────────────────────

export type RetryResult = { ok: true; row: DomainRow } | { ok: false; reason: 'none' | 'not_retryable' | 'failed' };

/**
 * Frame g1's Try again: checking gave up after two days, so start the same connection over with the SAME records (the
 * host's certificate check reuses its record per domain). If the host has lost the association, it is made again.
 */
export async function retryClubDomain(deps: ServiceDeps, orgId: string): Promise<RetryResult> {
  const row = await deps.store.getByOrg(orgId);
  if (!row) return { ok: false, reason: 'none' };
  if (row.status !== 'not_connected') return { ok: false, reason: 'not_retryable' };

  try {
    const present = await deps.host.read(row.domain, row.prefix);
    if (!present) await deps.host.create({ domain: row.domain, prefix: row.prefix });
    const updated = await deps.store.update(orgId, {
      status: 'waiting',
      waiting_since: deps.now().toISOString(),
      last_checked_at: null,
      last_check: null,
      gave_up_email_sent_at: null, // a new stretch: if checking gives up again, the owner is told again
    });
    return { ok: true, row: updated };
  } catch {
    return { ok: false, reason: 'failed' };
  }
}

// ── Stop (and Cancel and start over) ──────────────────────────────────────────────────────────────

export type StopResult = { ok: true } | { ok: false; reason: 'none' | 'failed' };

/**
 * Take the address away: the host first, then the row. If the host cannot be told, the row stays, so the owner can try
 * again rather than be left with an invisible association holding their name. Everything handed out reverts at once
 * because the row is what the rest of the product reads.
 */
export async function stopClubDomain(deps: ServiceDeps, orgId: string): Promise<StopResult> {
  const row = await deps.store.getByOrg(orgId);
  if (!row) return { ok: false, reason: 'none' };
  try {
    await deps.host.remove(row.domain);
    await deps.store.remove(orgId);
    return { ok: true };
  } catch {
    return { ok: false, reason: 'failed' };
  }
}

// ── What the screen is told ───────────────────────────────────────────────────────────────────────

export interface DomainView {
  fullName: string;
  domain: string;
  prefix: string;
  status: ClubDomainStatus;
  records: {
    padlock: { type: 'CNAME'; name: string; value: string };
    site: { type: 'CNAME'; name: string; value: string };
  };
  lastCheckedAt: string | null;
  lastCheck: LastCheck | null;
  waitingSince: string;
  /** When checking gives up if the records are still not in. */
  giveUpAt: string;
  connectedAt: string | null;
  /** When we noticed record 1 gone / record 2 gone (the dates the warnings name). */
  needsAttentionSince: string | null;
  notWorkingSince: string | null;
  padlockExpiresAt: string | null;
}

/** The row without its internals (no ids, no email bookkeeping, no host target). Admins and the owner both receive this. */
export function toDomainView(row: DomainRow): DomainView {
  return {
    fullName: row.full_name,
    domain: row.domain,
    prefix: row.prefix,
    status: row.status,
    records: {
      padlock: { type: 'CNAME', name: row.record1_name, value: row.record1_value },
      site: { type: 'CNAME', name: row.record2_name, value: row.record2_value },
    },
    lastCheckedAt: row.last_checked_at,
    lastCheck: row.last_check,
    waitingSince: row.waiting_since,
    giveUpAt: new Date(new Date(row.waiting_since).getTime() + WAITING_GIVE_UP_MS).toISOString(),
    connectedAt: row.connected_at,
    needsAttentionSince: row.needs_attention_since,
    notWorkingSince: row.not_working_since,
    padlockExpiresAt: row.padlock_expires_at,
  };
}
