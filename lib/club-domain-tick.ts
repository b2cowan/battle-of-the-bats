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
 *   not working      the host and record 2 every wake, so a fix clears itself within a quarter of an hour.
 *   not connected    nothing: it waits for the owner's Try again.
 * ⚖ A MISS on record 2 is never acted on at once: it is written down and looked at again on the NEXT wake, and only a second
 *   miss in a row makes the address "not working" and emails the owner, so one failed lookup cannot send a false "your site is
 *   down". Worst case from loss to email: about an hour and a quarter.
 * ⚖ A lookup that could not be MADE is not a miss and not an answer: it is left unobserved. In particular a failed read of the
 *   host never ends the looking, and never calls the host gone.
 * ⚖ No email repeats within a stretch: each has a stamp on the row, set when it goes and cleared when the stretch ends. An email
 *   that did not go is unstamped, and is OWED from the row's state alone (connected without its live email, and so on), so the
 *   next wake sends it even though the transition that first called for it is behind us (review 2026-10-24).
 * ⚖ Reads only. This never writes to the host or to anyone's DNS.
 */
import type { ClubDomainStatus, RecordSighting } from './club-domain';
import { acceptedSiteValues, judgePadlockRecord, judgeSiteRecord } from './club-domain';
import { WAITING_GIVE_UP_MS, type DomainRow, type LastCheck } from './club-domain-service';
import type { HostRecords } from './amplify-domains';

export const RECORD2_EVERY_MS = 60 * 60 * 1000;
export const DAILY_MS = 24 * 60 * 60 * 1000;
/** The second email about a missing padlock record goes this long before the padlock date. */
export const PADLOCK_REMINDER_BEFORE_MS = 14 * 24 * 60 * 60 * 1000;
/** A wake stops starting new clubs after this long and leaves the rest for the next wake (the route's limit is 300 s). */
export const TICK_BUDGET_MS = 240 * 1000;

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
      // Every wake, and only these two: the host (a fix on our side must clear it, and a host that is still gone must not look
      // recovered because DNS is fine) and record 2. The daily look resumes the wake after it recovers.
      return { host: true, record1: false, record2: true, extras: false };
    default: {
      const daily = older(last?.daily_at, DAILY_MS);
      const record2Due = older(last?.record2_checked_at, RECORD2_EVERY_MS) || !!last?.record2_first_miss_at;
      return { host: daily, record1: daily, record2: record2Due, extras: daily };
    }
  }
}

/** What the looking found. A field is `undefined` when this wake did not look at it (or could not). */
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
/** The stamp on the row that says each owner email has gone for this stretch. */
const STAMP_OF: Record<OwnerEmail, keyof DomainRow> = {
  live: 'live_email_sent_at', padlock_missing: 'padlock_email_sent_at', padlock_reminder: 'padlock_reminder_sent_at',
  gave_up: 'gave_up_email_sent_at', not_working: 'not_working_email_sent_at',
};
/** The host_status values that mean the host no longer serves the name (we store `MISSING` when it has no association). */
const HOST_GONE_STATUSES = new Set(['MISSING', 'FAILED']);
export const hostStatusMeansGone = (s: string | null | undefined) => HOST_GONE_STATUSES.has(String(s ?? '').toUpperCase());

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
  const stamp = (key: keyof DomainRow) => (key in patch ? patch[key] : row[key]);

  if (obs.record1) last.record1 = obs.record1;
  if (obs.record2) last.record2 = obs.record2;
  if (obs.bareForwards !== undefined) last.bare_forwards = obs.bareForwards;
  if (obs.padlockExpiresAt !== undefined && obs.padlockExpiresAt !== row.padlock_expires_at) patch.padlock_expires_at = obs.padlockExpiresAt;
  if (obs.host) patch.host_status = obs.host.state === 'missing' ? 'MISSING' : obs.host.hostStatus;
  // The daily clock moves only when the daily look was actually made (a record 1 answer or a host answer).
  if (obs.record1 !== undefined || (obs.host !== undefined && row.status !== 'not_working')) last.daily_at = iso(now);

  const hostGone = !!obs.host && (obs.host.state === 'failed' || obs.host.state === 'missing');

  // ── Waiting: the host decides when it is live; two days of a host that says "not live" ends the looking ──
  if (row.status === 'waiting') {
    last.record2_checked_at = iso(now);
    const record2Reaches = last.record2.state === 'found';
    if (obs.host?.state === 'live' && record2Reaches) {
      // Live means the host says so AND the club's address reaches the site (our own lookup agrees): a leftover certificate
      // record alone must not put an address in service.
      status = 'connected';
      patch.connected_at = iso(now);
      patch.padlock_expires_at = obs.padlockExpiresAt ?? row.padlock_expires_at;
    } else if (obs.host && obs.host.state !== 'live' && t - new Date(row.waiting_since).getTime() >= WAITING_GIVE_UP_MS) {
      // A give-up needs a SUCCESSFUL read that said "not live": a failed read (a wrong key, a host outage) is not an answer.
      status = 'not_connected';
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
    // While the host is not read this wake, what the last read said stands: a host that was gone does not look fixed because
    // DNS answers.
    const hostBad = obs.host ? hostGone : hostStatusMeansGone(row.host_status);
    if (hostBad) site2Down = true;

    if (site2Down) {
      if (row.status !== 'not_working') {
        status = 'not_working';
        patch.not_working_since = iso(now);
      }
    } else if (row.status === 'not_working') {
      // Back: to needs attention if the padlock record was already gone before (needs_attention_since survives the stretch), else
      // connected. Everything about the not-working stretch is cleared.
      status = row.needs_attention_since ? 'needs_attention' : 'connected';
      patch.not_working_since = null;
      patch.not_working_email_sent_at = null;
    }

    // ── Live: record 1, the padlock check (daily) ───────────────────────────────────────────────────
    if (obs.record1 && status !== 'not_working') {
      if (obs.record1.state === 'found') {
        if (status === 'needs_attention') status = 'connected';
        if (row.needs_attention_since) patch.needs_attention_since = null;
        if (row.padlock_email_sent_at) patch.padlock_email_sent_at = null;
        if (row.padlock_reminder_sent_at) patch.padlock_reminder_sent_at = null;
      } else {
        if (status === 'connected') {
          status = 'needs_attention';
          patch.needs_attention_since = iso(now);
        }
        const expires = (patch.padlock_expires_at ?? row.padlock_expires_at) as string | null | undefined;
        if (expires && !row.padlock_reminder_sent_at && t >= new Date(expires).getTime() - PADLOCK_REMINDER_BEFORE_MS) {
          // Said once the padlock email has also gone (below owes it first).
          emails.push('padlock_reminder');
          patch.padlock_reminder_sent_at = iso(now);
        }
      }
    }
  }

  if (status !== row.status) patch.status = status;

  // ── The emails each state OWES, from the state alone ─────────────────────────────────────────────
  // Not "on the wake it changed": an email that failed to go is unstamped, and the state it called for is already saved, so the
  // only way the next wake can send it is to read what is owed. Each is owed once per stretch (the stamp).
  const owe = (which: OwnerEmail) => {
    const key = STAMP_OF[which];
    if (!stamp(key) && !emails.includes(which)) { emails.unshift(which); (patch as Record<string, unknown>)[key] = iso(now); }
  };
  if (status === 'connected') owe('live');
  if (status === 'not_connected') owe('gave_up');
  if (status === 'not_working') owe('not_working');
  if (status === 'needs_attention') owe('padlock_missing');

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
  /** The live certificate's end date; throws when it could not be read (never a null that would wipe a good date). */
  certificateExpiry(host: string): Promise<string | null>;
  /** True / false when answered; throws when no answer could be had (an unanswered question is not "no"). */
  bareForwards(bare: string, fullName: string): Promise<boolean>;
  /** Tell the owner. Returns true only when it went; false asks for a retry on the next wake. */
  email(row: DomainRow, which: OwnerEmail, patch: Partial<DomainRow>): Promise<boolean>;
  now(): Date;
}

export interface TickSummary { looked: number; changed: number; emailed: Record<string, number>; failed: number; deferred: number }

/** An email this row's state owes and has not sent (a failed send, retried): the same four state-to-stamp pairs `decideTick` owes. */
function owesEmail(row: DomainRow): boolean {
  return (row.status === 'connected' && !row.live_email_sent_at)
    || (row.status === 'not_connected' && !row.gave_up_email_sent_at)
    || (row.status === 'not_working' && !row.not_working_email_sent_at)
    || (row.status === 'needs_attention' && !row.padlock_email_sent_at);
}

/** Look at what is due for every connection, write what changed, send what is owed. One row's failure never stops the others. */
export async function runClubDomainTick(deps: TickDeps, opts: { budgetMs?: number } = {}): Promise<TickSummary> {
  const now = deps.now();
  const started = now.getTime();
  const budget = opts.budgetMs ?? TICK_BUDGET_MS;
  const summary: TickSummary = { looked: 0, changed: 0, emailed: {}, failed: 0, deferred: 0 };
  const rows = await deps.listAll();
  for (const row of rows) {
    const plan = planTick(row, now);
    if (!plan.host && !plan.record1 && !plan.record2 && !plan.extras && !owesEmail(row)) continue;
    // A long wake stops starting new clubs and leaves the rest (each keeps its own clocks) for the next wake.
    if (deps.now().getTime() - started > budget) { summary.deferred++; continue; }
    summary.looked++;
    try {
      const obs: TickObservation = {};
      const accepted = acceptedSiteValues(row);
      // The three looks do not depend on each other; a look that could not be made is `undefined` (unobserved), never a verdict.
      const [h, seen1, seen2] = await Promise.all([
        plan.host ? deps.hostRead(row.domain, row.prefix).catch(() => undefined) : undefined,
        plan.record1 ? deps.cnames(`${row.record1_name}.${row.domain}`).catch(() => undefined) : undefined,
        plan.record2 ? deps.cnames(row.full_name).catch(() => undefined) : undefined,
      ]);
      // A failed host read tells us nothing: leave it unobserved rather than call the host gone.
      if (plan.host && h !== undefined) obs.host = h ? { state: h.state, hostStatus: h.hostStatus } : { state: 'missing', hostStatus: null };
      if (seen1 !== undefined) obs.record1 = judgePadlockRecord(seen1, row.record1_value);
      if (seen2 !== undefined) obs.record2 = judgeSiteRecord(seen2, accepted);
      // The certificate and the bare name: on the daily look, and once on the wake a waiting address goes live (so the live
      // email can say whether the bare name forwards). The certificate is the club's own only when our lookup says the address
      // reaches us: otherwise the handshake would read the old website's certificate.
      const goingLive = row.status === 'waiting' && obs.host?.state === 'live';
      if (plan.extras || goingLive) {
        const reaches = (obs.record2 ?? row.last_check?.record2)?.state === 'found';
        const [cert, forwards] = await Promise.all([
          reaches ? deps.certificateExpiry(row.full_name).catch(() => undefined) : undefined,
          row.prefix === 'www' ? deps.bareForwards(row.domain, row.full_name).catch(() => undefined) : undefined,
        ]);
        if (cert !== undefined) obs.padlockExpiresAt = cert;
        if (forwards !== undefined) obs.bareForwards = forwards;
      }
      const { patch, emails } = decideTick(row, obs, now);
      // An email that could not be sent is unstamped, so the next wake owes it again (decideTick reads it from the state).
      for (const which of emails) {
        const ok = await deps.email(row, which, patch).catch(() => false);
        if (ok) summary.emailed[which] = (summary.emailed[which] ?? 0) + 1;
        else (patch as Record<string, unknown>)[STAMP_OF[which]] = (row as unknown as Record<string, unknown>)[STAMP_OF[which]] ?? null;
      }
      await deps.update(row.org_id, patch);
      if (patch.status && patch.status !== row.status) summary.changed++;
    } catch {
      summary.failed++;
    }
  }
  return summary;
}
