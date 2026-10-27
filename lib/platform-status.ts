/**
 * Status's readings (Support console Stage 5, owner Q1/Q2/G3 2026-10-26; drawing A, G). Server only.
 *
 * Two kinds of line:
 *   • CHEAP — our own records and our own database (errors, the error rate, traffic, the counting job, the database
 *     answering, connections, scheduled jobs). Two database calls, read every time; Today reads them too
 *     (`readCheapLines`) and never calls a provider.
 *   • PROVIDER — Amplify's builds, the staging site, Supabase's service health and gateway errors. Read at most once
 *     every 30 seconds for all staff together (threat T6): one server claims the reading in the database
 *     (platform_status_claim), the others serve the stored one. Each provider read has 5 seconds; a slow one becomes
 *     Not checked, never a wait.
 *
 * ⚠ What leaves this module is StatusLine[]: verdict words and fixed sentences with numbers and times (T2). A
 * provider's response is reduced to numbers here and its error to a ProviderFailure; neither its words, a commit
 * message, a web address nor a key name ever reaches a line. The AWS key may only LIST builds (T3); the Supabase token
 * reads project health and logs and never runs a query (T4); the log question is fixed here and asks only for a count
 * (T5). No key is read anywhere but this file (T1).
 */
import { AmplifyClient, ListJobsCommand } from '@aws-sdk/client-amplify';
import { supabaseAdmin } from './supabase-admin';
import { observabilityEnv } from './observability/env';
import { consoleClock, consoleDay } from './console-dates';
import { logDatabaseRef } from './email-log';
import {
  LINE_META, LINE_ORDER, READ_LIMIT_MS, SHARED_READ_SECONDS, SUPABASE_SERVICES, VERDICT_WORD,
  buildLine, connectionsLine, countsLine, dbAnswersLine, dbDownLines, errorRateLine, errorsLine, failedLine,
  gatewayLine, jobsLine, readingLine, servicesLine, stagingSiteLine, trafficLine,
  type BuildFacts, type CountsFacts, type LineId, type ProviderFailure, type StatusLine, type Verdict,
} from './platform-status-lines';

/** The two Supabase projects (production and staging's database) and the staging site. Never sent to the browser. */
const SUPABASE_PROJECTS = { production: 'qcttcboqysynwcdyghil', staging: 'npgnrxaitgbtbtvvykto' } as const;
const STAGING_SITE = 'https://dev.fieldlogichq.ca/';
const AMPLIFY_APP_FALLBACK = 'd3ld0l2bgmmlga';
const AMPLIFY_BRANCHES = { prod_build: 'master', staging_build: 'dev' } as const;
const CLAIM_SECONDS = 15;

/** The fixed gateway question: a count of server errors, nothing from any request in it (T5). */
const GATEWAY_SQL =
  'select count(*) as n from edge_logs cross join unnest(metadata) as m cross join unnest(m.response) as r where r.status_code >= 500';

export type StatusAnswer = {
  lines: StatusLine[];
  /** When the oldest part of this answer was read ("Read at 9:42 a.m."). */
  readAt: string;
  /** True when the provider lines are still to be read (the page then asks the route). */
  pending: boolean;
};

/** Which site this console is: production's database, or staging's (the chip beside Status's title). */
export const consoleSiteName = (): 'Production' | 'Staging' =>
  logDatabaseRef() === SUPABASE_PROJECTS.production ? 'Production' : 'Staging';

const when = (iso: string) => `${consoleDay(iso)} at ${consoleClock(iso)}`;
const nowIso = () => new Date().toISOString(); // utc-intentional: an instant

// ── Cheap lines ─────────────────────────────────────────────────────────────────────────────────────

type HealthRow = { in_use: number; max: number; stuck: number; jobs: { name: string; failed_24h: number }[] | null };
type CountsRow = {
  errors_by_hour: number[]; calls_by_hour: number[]; calls_by_day: number[]; errors_by_day: number[];
  top_group: { id: string; n: number } | null; counted_at: string | null;
};

export async function readCheapLines(): Promise<StatusLine[]> {
  const started = performance.now();
  const healthCall = Promise.resolve(supabaseAdmin.rpc('platform_health_counts'))
    .then(r => ({ ...r, ms: performance.now() - started }))
    .catch(() => ({ data: null, error: true, ms: 0 }));
  const countsCall = Promise.resolve(supabaseAdmin.rpc('platform_status_counts', { p_env: observabilityEnv() }))
    .catch(() => ({ data: null, error: true }));
  const [health, counts] = await Promise.all([healthCall, countsCall]);

  if (health.error || !health.data) return dbDownLines();

  const h = health.data as HealthRow;
  const facts = {
    ms: health.ms, inUse: Number(h.in_use) || 0, max: Number(h.max) || 0, stuck: Number(h.stuck) || 0,
    jobs: Array.isArray(h.jobs) ? h.jobs.map(j => ({ name: String(j.name), failed24h: Number(j.failed_24h) || 0 })) : null,
  };
  const lines: StatusLine[] = [dbAnswersLine(facts), connectionsLine(facts), jobsLine(facts)];

  if (counts.error || !counts.data) {
    const todo = 'Read again in a minute.';
    for (const id of ['errors', 'error_rate', 'traffic', 'counts'] as const) {
      lines.push({ id, verdict: 'unchecked', says: 'Our counts could not be read.', todo, headline: null, door: null });
    }
    return lines;
  }
  const c = counts.data as CountsRow;
  const nums = (a: unknown) => (Array.isArray(a) ? a.map(v => Number(v) || 0) : []);
  const countedAt = c.counted_at ? Date.parse(c.counted_at) : NaN;
  const cf: CountsFacts = {
    errorsByHour: nums(c.errors_by_hour), callsByHour: nums(c.calls_by_hour),
    callsByDay: nums(c.calls_by_day), errorsByDay: nums(c.errors_by_day),
    topGroup: c.top_group && typeof c.top_group.id === 'string' ? { id: c.top_group.id, n: Number(c.top_group.n) || 0 } : null,
    countsAgeMinutes: Number.isFinite(countedAt) ? Math.floor((Date.now() - countedAt) / 60_000) : null,
  };
  lines.push(errorsLine(cf), errorRateLine(cf), trafficLine(cf), countsLine(cf));
  return lines;
}

// ── Provider lines ──────────────────────────────────────────────────────────────────────────────────

const PROVIDER_IDS = LINE_ORDER.filter(id => !LINE_META[id].cheap);
const VERDICTS = Object.keys(VERDICT_WORD) as Verdict[];

const isTimeout = (err: unknown) => {
  const name = (err as { name?: unknown })?.name;
  return name === 'TimeoutError' || name === 'AbortError';
};

function awsFailure(err: unknown): ProviderFailure {
  if (isTimeout(err)) return 'timeout';
  const name = (err as { name?: unknown })?.name;
  if (typeof name === 'string' && /AccessDenied|Unrecognized|InvalidSignature|ExpiredToken|Unauthorized|InvalidClientTokenId/i.test(name)) return 'refused';
  return 'no_answer';
}

async function readBuilds(): Promise<StatusLine[]> {
  const accessKeyId = process.env.STATUS_AMPLIFY_ACCESS_KEY_ID?.trim();
  const secretAccessKey = process.env.STATUS_AMPLIFY_SECRET_ACCESS_KEY?.trim();
  const ids = ['prod_build', 'staging_build'] as const;
  if (!accessKeyId || !secretAccessKey) return ids.map(id => failedLine(id, 'Amplify', 'no_key'));
  const client = new AmplifyClient({
    region: process.env.CLUB_DOMAINS_AWS_REGION || 'us-east-2',
    credentials: { accessKeyId, secretAccessKey },
    maxAttempts: 1,
  });
  const appId = process.env.CLUB_DOMAINS_AMPLIFY_APP_ID?.trim() || AMPLIFY_APP_FALLBACK;
  return Promise.all(ids.map(async id => {
    try {
      const out = await client.send(
        new ListJobsCommand({ appId, branchName: AMPLIFY_BRANCHES[id], maxResults: 10 }),
        { abortSignal: AbortSignal.timeout(READ_LIMIT_MS) },
      );
      // Only status, times and the build number are read; commit messages and source addresses are left where they are.
      const jobs = (out.jobSummaries ?? [])
        .map(j => ({ status: j.status ?? '', start: j.startTime?.getTime() ?? 0, end: j.endTime?.toISOString() ?? null, build: String(j.jobId ?? '') }))
        .sort((a, b) => b.start - a.start);
      const finished = jobs.find(j => j.status === 'SUCCEED' || j.status === 'FAILED');
      const passed = jobs.find(j => j.status === 'SUCCEED');
      const facts: BuildFacts = {
        latest: finished && finished.end ? { passed: finished.status === 'SUCCEED', at: finished.end, build: /^\d{1,9}$/.test(finished.build) ? Number(finished.build).toLocaleString('en-CA') : '' } : null,
        lastPassed: passed && passed.end ? { at: passed.end } : null,
        running: jobs.some(j => ['CREATED', 'PENDING', 'PROVISIONING', 'RUNNING'].includes(j.status)),
      };
      return buildLine(id, facts, when, consoleClock);
    } catch (err) {
      return failedLine(id, 'Amplify', awsFailure(err));
    }
  }));
}

async function readStagingSite(): Promise<StatusLine> {
  const started = performance.now();
  try {
    const res = await fetch(STAGING_SITE, { method: 'GET', redirect: 'manual', cache: 'no-store', signal: AbortSignal.timeout(READ_LIMIT_MS) });
    void res.body?.cancel().catch(() => undefined);
    if (res.status >= 400) return stagingSiteLine({ ok: false, reason: 'error' });
    return stagingSiteLine({ ok: true, ms: performance.now() - started });
  } catch (err) {
    return stagingSiteLine({ ok: false, reason: isTimeout(err) ? 'timeout' : 'error' });
  }
}

type SupabaseResult<T> = { ok: true; value: T } | { ok: false; failure: ProviderFailure };

async function supabaseGet<T>(path: string, token: string): Promise<SupabaseResult<T>> {
  try {
    const res = await fetch(`https://api.supabase.com${path}`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
      signal: AbortSignal.timeout(READ_LIMIT_MS),
    });
    if (res.status === 401 || res.status === 403) return { ok: false, failure: 'refused' };
    if (!res.ok) return { ok: false, failure: 'no_answer' };
    return { ok: true, value: (await res.json()) as T };
  } catch (err) {
    return { ok: false, failure: isTimeout(err) ? 'timeout' : 'no_answer' };
  }
}

async function readSupabase(): Promise<StatusLine[]> {
  const token = process.env.STATUS_SUPABASE_TOKEN?.trim();
  if (!token) return (['db_services', 'gateway', 'staging_db'] as const).map(id => failedLine(id, 'Supabase', 'no_key'));

  const services = SUPABASE_SERVICES.map(s => `services=${s}`).join('&');
  type Health = { name?: unknown; healthy?: unknown }[];
  const down = (h: Health) => (Array.isArray(h) ? h.filter(s => s && s.healthy === false).map(s => String(s.name)) : []);

  const end = new Date();
  const start = new Date(end.getTime() - 3_600_000);
  const logsQuery = new URLSearchParams({ sql: GATEWAY_SQL, iso_timestamp_start: start.toISOString(), iso_timestamp_end: end.toISOString() });

  const [prodHealth, stagingHealth, gateway] = await Promise.all([
    supabaseGet<Health>(`/v1/projects/${SUPABASE_PROJECTS.production}/health?${services}`, token),
    supabaseGet<Health>(`/v1/projects/${SUPABASE_PROJECTS.staging}/health?${services}`, token),
    supabaseGet<{ result?: { n?: unknown }[] }>(`/v1/projects/${SUPABASE_PROJECTS.production}/analytics/endpoints/logs.all?${logsQuery}`, token),
  ]);

  const gatewayCount = gateway.ok ? Number(gateway.value?.result?.[0]?.n) : NaN;
  return [
    prodHealth.ok ? servicesLine('db_services', down(prodHealth.value)) : failedLine('db_services', 'Supabase', prodHealth.failure),
    gateway.ok && Number.isFinite(gatewayCount) ? gatewayLine(gatewayCount) : failedLine('gateway', 'Supabase', gateway.ok ? 'no_answer' : gateway.failure),
    stagingHealth.ok ? servicesLine('staging_db', down(stagingHealth.value)) : failedLine('staging_db', 'Supabase', stagingHealth.failure),
  ];
}

async function readProviders(): Promise<StatusLine[]> {
  const [builds, site, supabase] = await Promise.all([readBuilds(), readStagingSite(), readSupabase()]);
  return [...builds, site, ...supabase];
}

/** A stored reading, re-checked line by line: only known lines, verdicts and string fields come back out. */
function storedLines(reading: unknown): StatusLine[] | null {
  const raw = (reading as { lines?: unknown })?.lines;
  if (!Array.isArray(raw)) return null;
  const out: StatusLine[] = [];
  for (const l of raw as Partial<StatusLine>[]) {
    if (!l || !PROVIDER_IDS.includes(l.id as LineId) || !VERDICTS.includes(l.verdict as Verdict) || typeof l.says !== 'string') continue;
    out.push({
      id: l.id as LineId, verdict: l.verdict as Verdict, says: l.says,
      todo: typeof l.todo === 'string' ? l.todo : null,
      headline: typeof l.headline === 'string' ? l.headline : null,
      door: l.door && (l.door as { to?: unknown }).to === 'errors' ? { to: 'errors' } : null,
    });
  }
  return out.length === PROVIDER_IDS.length ? out : null;
}

type Shared = { lines: StatusLine[]; readAt: string } | null;

async function storedReading(): Promise<{ shared: Shared; fresh: boolean; dbOk: boolean }> {
  try {
    const { data, error } = await supabaseAdmin.from('platform_status_reading').select('reading, read_at').eq('id', 1).maybeSingle();
    if (error) return { shared: null, fresh: false, dbOk: false };
    const lines = storedLines(data?.reading);
    const readAt = typeof data?.read_at === 'string' ? data.read_at : null;
    if (!lines || !readAt) return { shared: null, fresh: false, dbOk: true };
    const fresh = Date.now() - Date.parse(readAt) < SHARED_READ_SECONDS * 1000;
    return { shared: { lines, readAt }, fresh, dbOk: true };
  } catch {
    return { shared: null, fresh: false, dbOk: false };
  }
}

/** The provider lines: the shared reading when fresh, else one server reads and stores it for everyone. */
async function providerReading(): Promise<Shared> {
  const stored = await storedReading();
  if (stored.fresh) return stored.shared;
  // Our database is down: read the providers directly (Status does not need the database to say it is down).
  if (!stored.dbOk) return { lines: await readProviders(), readAt: nowIso() };

  const { data: claimed } = await supabaseAdmin.rpc('platform_status_claim', {
    p_min_age_seconds: SHARED_READ_SECONDS, p_claim_seconds: CLAIM_SECONDS,
  });
  if (claimed !== true) return stored.shared;

  const lines = await readProviders();
  const readAt = nowIso();
  await supabaseAdmin.from('platform_status_reading').update({ reading: { lines }, read_at: readAt, claimed_at: null }).eq('id', 1);
  return { lines, readAt };
}

function inOrder(lines: StatusLine[]): StatusLine[] {
  const byId = new Map(lines.map(l => [l.id, l]));
  return LINE_ORDER.map(id => byId.get(id) ?? readingLine(id));
}

function answerOf(cheap: StatusLine[], shared: Shared): StatusAnswer {
  const now = nowIso();
  return {
    lines: inOrder([...cheap, ...(shared?.lines ?? [])]),
    readAt: shared && shared.readAt < now ? shared.readAt : now,
    pending: !shared,
  };
}

/** The whole answer, providers read if the shared reading is older than 30 seconds (the route; Read again). */
export async function readStatus(): Promise<StatusAnswer> {
  const [cheap, shared] = await Promise.all([readCheapLines(), providerReading()]);
  return answerOf(cheap, shared);
}

/** What the page draws at once: the cheap lines, and the provider lines only if a fresh shared reading exists. */
export async function peekStatus(): Promise<StatusAnswer> {
  const [cheap, stored] = await Promise.all([readCheapLines(), storedReading()]);
  return answerOf(cheap, stored.fresh ? stored.shared : null);
}
