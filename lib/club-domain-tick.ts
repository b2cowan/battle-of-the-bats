/**
 * THE STATUS CHECK FOR A CLUB'S OWN WEB ADDRESS (Club Tier Stage 4e, Part 6): what to look at, what the looking means, and which
 * of the owner's four emails go. Pure decisions with the world injected (`TickDeps`), so the whole state machine runs under a
 * plain Node test; the route that a scheduled job calls (app/api/platform-admin/club-domains-tick) wires the real world in.
 *
 * ⚖ THE CLOCKS (owner ruling 2026-10-23): the job wakes every 15 minutes.
 *   waiting          every wake: ask the host whether it is live, look at both records; past two days -> not connected.
 *   connected, needs attention
 *                    record 2 (the club's site) EVERY HOUR; the rest (record 1, the host's status, the padlock date, whether the
 *                    bare name forwards) once a DAY.
 *   not working      record 2 every wake, so a fix clears itself within a quarter of an hour.
 *   not connected    nothing: it waits for the owner's Try again.
 * ⚖ A MISS on record 2 is never acted on at once: it is written down and looked at again on the NEXT wake, and only a second
 *   miss in a row makes the address "not working" and emails the owner, so one failed lookup cannot send a false "your site is
 *   down". Worst case from loss to email: about an hour and a quarter.
 * ⚖ No email repeats within a stretch: each has a stamp on the row, set when it goes and cleared when the stretch ends.
 * ⚖ Reads only. This never writes to the host or to anyone's DNS.
 */
import type { ClubDomainStatus, RecordSighting } from './club-domain';
import { judgePadlockRecord, judgeSiteRecord } from './club-domain';
import { WAITING_GIVE_UP_MS, type DomainRow, type LastCheck } from './club-domain-service';
import type { HostRecords } from './amplify-domains';

export const RECORD2_EVERY_MS = 60 * 60 * 1000;
export const DAILY_MS = 24 * 60 * 60 * 1000;
/** The second email about a missing padlock record goes this long before the padlock date. */
export const PADLOCK_REMINDER_BEFORE_MS = 14 * 24 * 60 * 60 * 1000;

export type OwnerEmail = 'live' | 'padlock_missing' | 'padlock_reminder' | 'gave_up' | 'not_working';

/** What to look at this wake, decided from the row and the clock alone. */
export interface TickPlan {
  host: boolean;
  record1: boolean;
  record2: boolean;
  /** The daily extras: the live certificate's date and whether the bare name forwards. */
  extras: boolean;
}

export function planTick(row: DomainRow, now: Date): TickPlan {
  const t = now.getTime();
  const last = row.last_check;
  const older = (iso: string | null | undefined, ms: number) => !iso || t - new Date(iso).getTime() >= ms;
  switch (row.status) {
    case 'waiting':
      return { host: true, record1: true, record2: true, extras: false };
    case 'not_connected':
      return { host: false, record1: false, record2: false, extras: false };
    case 'not_working':
      // Every wake: a fixed record 2 is noticed within a quarter of an hour. The daily look still happens on its day.
      return { host: older(last?.daily_at, DAILY_MS), record1: older(last?.daily_at, DAILY_MS), record2: true, extras: older(last?.daily_at, DAILY_MS) };
    default: {
      const daily = older(last?.daily_at, DAILY_MS);
      const record2Due = older(last?.record2_checked_at, RECORD2_EVERY_MS) || !!last?.record2_first_miss_at;
      return { host: daily, record1: daily, record2: record2Due, extras: daily };
    }
  }
}

/** What the looking found. A field is `undefined` when this wake did not look at it. */
export interface TickObservation {
  /** The host's own word, `missing` when it has no such association any more. */
  host?: { state: HostRecords['state'] | 'missing'; hostStatus: string | null };
  record1?: RecordSighting;
  record2?: RecordSighting;
  padlockExpiresAt?: string | null;
  bareForwards?: boolean | null;
}

export interface TickDecision {
  /** Columns to write on the row; empty when nothing changed (the job then writes nothing). */
  patch: Partial<DomainRow>;
  emails: OwnerEmail[];
}

const iso = (d: Date) => d.toISOString();

export function decideTick(row: DomainRow, obs: TickObservation, now: Date): TickDecision {
  const t = now.getTime();
  const patch: Partial<DomainRow> = {};
  const emails: OwnerEmail[] = [];
  const last: LastCheck = {
    record1: row.last_check?.record1 ?? { state: 'not_seen' },
    record2: row.last_check?.record2 ?? { state: 'not_seen' },
    bare_forwards: row.last_check?.bare_forwards ?? null,
    record2_checked_at: row.last_check?.record2_checked_at ?? null,
    record2_first_miss_at: row.last_check?.record2_first_miss_at ?? null,
    daily_at: row.last_check?.daily_at ?? null,
  };
  let status: ClubDomainStatus = row.status;

  if (obs.record1) last.record1 = obs.record1;
  if (obs.record2) last.record2 = obs.record2;
  if (obs.bareForwards !== undefined) last.bare_forwards = obs.bareForwards;
  if (obs.padlockExpiresAt !== undefined && obs.padlockExpiresAt !== row.padlock_expires_at) patch.padlock_expires_at = obs.padlockExpiresAt;
  if (obs.host) patch.host_status = obs.host.hostStatus;
  const dailyDone = obs.record1 !== undefined || obs.host !== undefined;
  if (dailyDone) last.daily_at = iso(now);

  const hostGone = obs.host && (obs.host.state === 'failed' || obs.host.state === 'missing');

  // ── Waiting: the host decides when it is live; two days with no records ends the looking ──────────
  if (row.status === 'waiting') {
    last.record2_checked_at = iso(now);
    if (obs.host?.state === 'live') {
      status = 'connected';
      patch.connected_at = iso(now);
      patch.padlock_expires_at = obs.padlockExpiresAt ?? row.padlock_expires_at;
      if (!row.live_email_sent_at) { emails.push('live'); patch.live_email_sent_at = iso(now); }
    } else if (t - new Date(row.waiting_since).getTime() >= WAITING_GIVE_UP_MS) {
      status = 'not_connected';
      if (!row.gave_up_email_sent_at) { emails.push('gave_up'); patch.gave_up_email_sent_at = iso(now); }
    }
  } else if (row.status !== 'not_connected') {
    // ── Live: record 2 (hourly; a second miss in a row is the verdict) ──────────────────────────────
    let site2Down = row.status === 'not_working';
    if (obs.record2) {
      last.record2_checked_at = iso(now);
      if (obs.record2.state === 'found') {
        last.record2_first_miss_at = null;
        site2Down = false;
      } else if (!last.record2_first_miss_at && row.status !== 'not_working') {
        last.record2_first_miss_at = iso(now); // the first miss: written down, looked at again next wake, no verdict yet
      } else {
        site2Down = true;
      }
    }
    // The host itself no longer serving the name is the same trouble from the club's side: the address does not reach the site.
    if (hostGone) site2Down = true;

    if (site2Down) {
      if (row.status !== 'not_working') {
        status = 'not_working';
        patch.not_working_since = iso(now);
        if (!row.not_working_email_sent_at) { emails.push('not_working'); patch.not_working_email_sent_at = iso(now); }
      }
    } else if (row.status === 'not_working') {
      // Back: to needs attention if the padlock record was already gone before (needs_attention_since survives the stretch), else
      // connected. Everything about the not-working stretch is cleared. A record 1 looked at this very wake is judged below.
      status = row.needs_attention_since ? 'needs_attention' : 'connected';
      patch.not_working_since = null;
      patch.not_working_email_sent_at = null;
    }

    // ── Live: record 1, the padlock check (daily) ───────────────────────────────────────────────────
    if (obs.record1 && status !== 'not_working') {
      if (obs.record1.state === 'found') {
        if (status === 'needs_attention' || row.status === 'needs_attention') status = 'connected';
        if (row.needs_attention_since) patch.needs_attention_since = null;
        if (row.padlock_email_sent_at) patch.padlock_email_sent_at = null;
        if (row.padlock_reminder_sent_at) patch.padlock_reminder_sent_at = null;
      } else {
        if (status === 'connected') {
          status = 'needs_attention';
          patch.needs_attention_since = iso(now);
        }
        if (!row.padlock_email_sent_at) { emails.push('padlock_missing'); patch.padlock_email_sent_at = iso(now); }
        const expires = (patch.padlock_expires_at ?? row.padlock_expires_at) as string | null | undefined;
        if (expires && !row.padlock_reminder_sent_at && t >= new Date(expires).getTime() - PADLOCK_REMINDER_BEFORE_MS) {
          emails.push('padlock_reminder');
          patch.padlock_reminder_sent_at = iso(now);
        }
      }
    }
  }

  if (status !== row.status) patch.status = status;
  patch.last_checked_at = iso(now);
  patch.last_check = last;
  return { patch, emails };
}

// ── The runner ─────────────────────────────────────────────────────────────────────────────────

export interface TickDeps {
  listAll(): Promise<DomainRow[]>;
  update(orgId: string, patch: Partial<DomainRow>): Promise<unknown>;
  hostRead(domain: string, prefix: string): Promise<HostRecords | null>;
  /** Every CNAME value at a name; empty when none; throws when the lookup could not be made. */
  cnames(name: string): Promise<string[]>;
  certificateExpiry(host: string): Promise<string | null>;
  bareForwards(bare: string, fullName: string): Promise<boolean | null>;
  /** Tell the owner. Returns true when it went (or was deliberately skipped); false asks for a retry on the next wake. */
  email(row: DomainRow, which: OwnerEmail, patch: Partial<DomainRow>): Promise<boolean>;
  now(): Date;
}

export interface TickSummary { looked: number; changed: number; emailed: Record<string, number>; failed: number }

/** Look at what is due for every connection, write what changed, send what is owed. One row's failure never stops the others. */
export async function runClubDomainTick(deps: TickDeps): Promise<TickSummary> {
  const now = deps.now();
  const summary: TickSummary = { looked: 0, changed: 0, emailed: {}, failed: 0 };
  const rows = await deps.listAll();
  for (const row of rows) {
    const plan = planTick(row, now);
    if (!plan.host && !plan.record1 && !plan.record2 && !plan.extras) continue;
    summary.looked++;
    try {
      const obs: TickObservation = {};
      const accepted = [row.record2_value, ...(row.record2_host_target ? [row.record2_host_target] : [])];
      if (plan.host) {
        const h = await deps.hostRead(row.domain, row.prefix).catch(() => undefined);
        // A failed read tells us nothing: leave it unobserved rather than call the host gone.
        if (h !== undefined) obs.host = h ? { state: h.state, hostStatus: h.hostStatus } : { state: 'missing', hostStatus: null };
      }
      if (plan.record1) {
        const seen = await deps.cnames(`${row.record1_name}.${row.domain}`).catch(() => undefined);
        if (seen !== undefined) obs.record1 = judgePadlockRecord(seen, row.record1_value);
      }
      if (plan.record2) {
        const seen = await deps.cnames(row.full_name).catch(() => undefined);
        if (seen !== undefined) obs.record2 = judgeSiteRecord(seen, accepted);
      }
      if (plan.extras && row.status !== 'waiting') {
        obs.padlockExpiresAt = await deps.certificateExpiry(row.full_name).catch(() => undefined);
        if (row.prefix === 'www') obs.bareForwards = await deps.bareForwards(row.domain, row.full_name).catch(() => undefined);
      }
      const { patch, emails } = decideTick(row, obs, now);
      // An email that could not be sent is not stamped, so the next wake tries again.
      for (const which of emails) {
        const ok = await deps.email(row, which, patch).catch(() => false);
        summary.emailed[which] = (summary.emailed[which] ?? 0) + (ok ? 1 : 0);
        if (!ok) {
          const stamp: Record<OwnerEmail, keyof DomainRow> = {
            live: 'live_email_sent_at', padlock_missing: 'padlock_email_sent_at', padlock_reminder: 'padlock_reminder_sent_at',
            gave_up: 'gave_up_email_sent_at', not_working: 'not_working_email_sent_at',
          };
          (patch as Record<string, unknown>)[stamp[which]] = (row as unknown as Record<string, unknown>)[stamp[which]] ?? null;
        }
      }
      await deps.update(row.org_id, patch);
      if (patch.status && patch.status !== row.status) summary.changed++;
    } catch {
      summary.failed++;
    }
  }
  return summary;
}
