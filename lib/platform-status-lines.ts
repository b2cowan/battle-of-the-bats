/**
 * Status's lines: the verdicts, their thresholds and their sentences (Support console Stage 5, drawing A and G; owner
 * G3 2026-10-26 accepted the thresholds below as proposed). PURE and client-safe: no database, no provider, no
 * clock of its own — `lib/platform-status.ts` takes the readings and passes the numbers in.
 *
 * ⚠ THE ANSWER IS VERDICT WORDS, NUMBERS AND TIMES (threat T2). Every sentence here is a fixed template with a number
 * or a time in it. A provider's error never reaches a sentence: it is mapped to a ProviderFailure first, and each
 * failure has one fixed sentence. tests/unit/support-console-stage5-status-guard.test.ts fails on a web address, a key
 * name, a log line, a commit message or a provider's words in the answer.
 *
 * ⚠ The thresholds live here and nowhere else (one home, cheap to tune after the walk).
 */

export type Verdict = 'fine' | 'look' | 'act' | 'unchecked' | 'reading';

export type LineId =
  | 'prod_build' | 'staging_build' | 'staging_site'
  | 'errors' | 'error_rate' | 'traffic' | 'counts'
  | 'db_answers' | 'connections' | 'jobs' | 'db_services' | 'gateway' | 'staging_db';

export type Band = 'sites' | 'app' | 'database';

export type StatusLine = {
  id: LineId;
  verdict: Verdict;
  /** One sentence of what it found. */
  says: string;
  /** One thing to do, or null when there is nothing (a Fine line's cell is blank). */
  todo: string | null;
  /** The verdict line's sentence when this line is the worst one ("Errors are higher than usual."). */
  headline: string | null;
  /** Where the line's door goes: the Errors list, or one issue (its group id). */
  door: { to: 'errors' } | { to: 'issue'; id: string } | null;
};

export const BAND_LABEL: Record<Band, string> = { sites: 'The sites', app: 'The app', database: 'The database' };

/** The lines in drawing order, with their band, name and where they are read from (plain words). */
export const LINE_META: Record<LineId, { band: Band; name: string; from: string; cheap: boolean }> = {
  prod_build:    { band: 'sites', name: 'Production build', from: 'Amplify', cheap: false },
  staging_build: { band: 'sites', name: 'Staging build', from: 'Amplify', cheap: false },
  staging_site:  { band: 'sites', name: 'Staging site', from: 'The staging site', cheap: false },
  errors:        { band: 'app', name: 'Errors', from: 'Our error records', cheap: true },
  error_rate:    { band: 'app', name: 'Error rate', from: 'Our call counts', cheap: true },
  traffic:       { band: 'app', name: 'Traffic', from: 'Our call counts', cheap: true },
  counts:        { band: 'app', name: 'Counts up to date', from: 'Our call counts', cheap: true },
  db_answers:    { band: 'database', name: 'Database answers', from: 'Our database', cheap: true },
  connections:   { band: 'database', name: 'Connections', from: 'Our database', cheap: true },
  jobs:          { band: 'database', name: 'Scheduled jobs', from: 'Our database', cheap: true },
  db_services:   { band: 'database', name: 'Database services', from: 'Supabase', cheap: false },
  gateway:       { band: 'database', name: 'Gateway errors', from: 'Supabase', cheap: false },
  staging_db:    { band: 'database', name: 'Staging database', from: 'Supabase', cheap: false },
};

export const LINE_ORDER = Object.keys(LINE_META) as LineId[];

export const VERDICT_WORD: Record<Verdict, string> = {
  fine: 'Fine', look: 'Look at it', act: 'Act now', unchecked: 'Not checked', reading: 'Reading…',
};

/** The thresholds (owner G3). */
export const THRESHOLDS = {
  errorsLook: { atLeast: 10, timesUsual: 3 },
  errorsAct: { atLeast: 50, timesUsual: 10 },
  errorRateLook: { atLeast: 0.01, timesUsual: 2 },
  errorRateAct: 0.05,
  trafficLookBelowShare: 0.25,
  trafficLookMinUsual: 40,
  countsLateMinutes: 15,
  dbSlowMs: 500,
  connectionsLookShare: 0.8,
  connectionsActShare: 0.95,
  stagingSiteSlowMs: 3000,
  gatewayLook: 10,
  gatewayAct: 100,
} as const;

/** The reading limit per provider and how often all staff together may read them. */
export const READ_LIMIT_MS = 5000;
export const SHARED_READ_SECONDS = 30;
/** The header turns amber after this long open. */
export const STALE_AFTER_MS = 10 * 60_000;
export const COUNTING_JOB_EVERY_MINUTES = 5;

// ── Helpers ─────────────────────────────────────────────────────────────────────────────────────────

const n = (v: number) => Math.round(v).toLocaleString('en-CA');
const plural = (count: number, one: string, many: string) => (count === 1 ? one : many);

/** The middle value of the seven days before (index 1-7); 0 with no history. */
export function usual(series: readonly number[]): number {
  const before = series.slice(1, 8).filter(v => Number.isFinite(v)).sort((a, b) => a - b);
  if (before.length === 0) return 0;
  const mid = Math.floor(before.length / 2);
  return before.length % 2 ? before[mid] : (before[mid - 1] + before[mid]) / 2;
}

function pct(rate: number): string {
  const p = rate * 100;
  return `${p < 10 ? p.toFixed(1) : Math.round(p)}%`;
}

const line = (id: LineId, verdict: Verdict, says: string, todo: string | null = null, headline: string | null = null,
  door: StatusLine['door'] = null): StatusLine => ({ id, verdict, says, todo, headline, door });

// ── Failures (a provider's own words never leave the server) ────────────────────────────────────────

export type ProviderFailure = 'no_key' | 'refused' | 'timeout' | 'no_answer';
export type Provider = 'Amplify' | 'Supabase';

export function failedLine(id: LineId, provider: Provider, failure: ProviderFailure): StatusLine {
  switch (failure) {
    case 'no_key':
      return line(id, 'unchecked', `This site has no key for ${provider}.`, 'An owner step; see the help.');
    case 'refused':
      return line(id, 'unchecked',
        provider === 'Supabase' ? 'Supabase refused our token. It may have expired or been removed.' : 'Amplify refused our key. It may have expired or been removed.',
        provider === 'Supabase' ? 'Tell the owner: the token needs replacing.' : 'Tell the owner: the key needs replacing.');
    case 'timeout':
      return line(id, 'unchecked', `${provider} did not answer within 5 seconds.`, 'Read again in a minute.');
    default:
      return line(id, 'unchecked', `${provider} did not answer.`, 'Read again in a minute.');
  }
}

export function readingLine(id: LineId): StatusLine {
  return line(id, 'reading', 'Reading…');
}

// ── The sites ───────────────────────────────────────────────────────────────────────────────────────

export type BuildFacts = {
  /** The newest finished build: passed or failed, when it finished, its number. */
  latest: { passed: boolean; at: string; build: string } | null;
  /** The newest build that passed (what the site still runs when the latest failed). */
  lastPassed: { at: string } | null;
  running: boolean;
};

/** `when` formats an instant as "Oct 26 at 8:14 a.m.", `clock` as "8:14 a.m." (the caller's console clock). */
export function buildLine(id: 'prod_build' | 'staging_build', f: BuildFacts, when: (iso: string) => string, clock: (iso: string) => string): StatusLine {
  const site = id === 'prod_build' ? 'The site' : 'Staging';
  if (!f.latest) return line(id, 'unchecked', 'Amplify lists no finished builds for this branch.', 'Read again in a minute.');
  const running = f.running ? ' A new build is running.' : '';
  if (f.latest.passed) return line(id, 'fine', `Passed ${when(f.latest.at)} · build ${f.latest.build}${running ? ' · a new build is running' : ''}`);
  const still = f.lastPassed ? ` ${site} still runs the ${clock(f.lastPassed.at)} build${id === 'prod_build' ? '; customers see no change' : ''}.` : '';
  if (id === 'prod_build') {
    return line(id, 'act', `The build at ${clock(f.latest.at)} failed.${still}${running}`,
      'Tell the developer. Nothing for customers yet.', 'The production build failed.');
  }
  return line(id, 'look', `The build at ${clock(f.latest.at)} failed.${still}${running}`, 'Tell the developer.', 'The staging build failed.');
}

export type SiteFacts = { ok: true; ms: number } | { ok: false; reason: 'error' | 'timeout' };

export function stagingSiteLine(f: SiteFacts): StatusLine {
  const id = 'staging_site';
  if (!f.ok) {
    return f.reason === 'timeout'
      ? line(id, 'look', 'The staging site did not answer within 5 seconds.', 'Read again in a minute; if it still does not answer, tell the developer.', 'The staging site did not answer.')
      : line(id, 'look', 'The staging site answered with an error.', 'Tell the developer.', 'The staging site answered with an error.');
  }
  const secs = (f.ms / 1000).toFixed(1);
  if (f.ms > THRESHOLDS.stagingSiteSlowMs) {
    return line(id, 'look', `Answered in ${secs} seconds; it usually takes under one.`, 'Read again in a minute; if it stays slow, tell the developer.', 'The staging site is slow.');
  }
  return line(id, 'fine', `Answered in ${secs} seconds`);
}

// ── The app (our own records) ──────────────────────────────────────────────────────────────────────

export type CountsFacts = {
  errorsByHour: number[];
  callsByHour: number[];
  callsByDay: number[];
  errorsByDay: number[];
  topGroup: { id: string; n: number } | null;
  /** Minutes since the counting job last ran; null when it never has. */
  countsAgeMinutes: number | null;
};

function staleNote(ageMinutes: number | null): string {
  return ageMinutes !== null && ageMinutes > THRESHOLDS.countsLateMinutes ? ` · counts ${n(ageMinutes)} minutes old` : '';
}

export function errorsLine(f: CountsFacts): StatusLine {
  const id = 'errors';
  const now = f.errorsByHour[0] ?? 0;
  const u = usual(f.errorsByHour);
  const base = `${n(now)} in the last hour; a usual hour has ${n(u)}`;
  const act = now >= THRESHOLDS.errorsAct.atLeast && now >= THRESHOLDS.errorsAct.timesUsual * u;
  const look = now >= THRESHOLDS.errorsLook.atLeast && now >= THRESHOLDS.errorsLook.timesUsual * u;
  if (act || look) {
    const top = f.topGroup && f.topGroup.n > 1 && f.topGroup.n >= now / 2 ? f.topGroup : null;
    const says = `${base}.${top ? ` ${n(top.n)} of them are one issue.` : ''}${staleNote(f.countsAgeMinutes)}`;
    const door: StatusLine['door'] = top ? { to: 'issue', id: top.id } : { to: 'errors' };
    return line(id, act ? 'act' : 'look', says, top ? 'Open the issue and see who it hit.' : 'Open Errors and see what is new.',
      act ? 'Errors are far higher than usual.' : 'Errors are higher than usual.', door);
  }
  return line(id, 'fine', `${base}${staleNote(f.countsAgeMinutes)}`);
}

export function errorRateLine(f: CountsFacts): StatusLine {
  const id = 'error_rate';
  const calls = f.callsByDay[0] ?? 0;
  if (calls === 0) return line(id, 'fine', `No API calls counted in 24 hours${staleNote(f.countsAgeMinutes)}`);
  const rate = (f.errorsByDay[0] ?? 0) / calls;
  const rates = f.callsByDay.map((c, i) => (c > 0 ? (f.errorsByDay[i] ?? 0) / c : NaN));
  const u = usual(rates);
  const says = `${pct(rate)} of ${n(calls)} API calls in 24 hours; a usual day is ${pct(u)}${staleNote(f.countsAgeMinutes)}`;
  if (rate >= THRESHOLDS.errorRateAct) return line(id, 'act', says, 'Open Errors and see which page is failing.', 'Many API calls are failing.', { to: 'errors' });
  if (rate >= THRESHOLDS.errorRateLook.atLeast && rate >= THRESHOLDS.errorRateLook.timesUsual * u) {
    return line(id, 'look', says, 'Open Errors and see which page is failing.', 'More API calls are failing than usual.', { to: 'errors' });
  }
  return line(id, 'fine', says);
}

export function trafficLine(f: CountsFacts): StatusLine {
  const id = 'traffic';
  const now = f.callsByHour[0] ?? 0;
  const u = usual(f.callsByHour);
  const says = `${n(now)} ${plural(now, 'call', 'calls')} in the last hour; a usual hour has ${n(u)}${staleNote(f.countsAgeMinutes)}`;
  if (u >= THRESHOLDS.trafficLookMinUsual && now < u * THRESHOLDS.trafficLookBelowShare) {
    return line(id, 'look', says, 'Check that the site opens; if it does, it is a quiet hour.', 'Traffic is far below usual.');
  }
  return line(id, 'fine', says);
}

export function countsLine(f: CountsFacts): StatusLine {
  const id = 'counts';
  const every = COUNTING_JOB_EVERY_MINUTES;
  if (f.countsAgeMinutes === null) {
    return line(id, 'look', 'The counting job has not run yet.', 'Tell the developer: the counting job is not running.', 'The counting job is not running.');
  }
  const age = Math.max(0, f.countsAgeMinutes);
  if (age > THRESHOLDS.countsLateMinutes) {
    return line(id, 'look', `Last brought up to date ${n(age)} minutes ago; it runs every ${every}. Errors, failing calls and traffic below may be out of date.`,
      'Tell the developer: the counting job is late.', 'The counting job is late.');
  }
  return line(id, 'fine', `Brought up to date ${age < 1 ? 'less than a minute' : `${n(age)} ${plural(age, 'minute', 'minutes')}`} ago; it runs every ${every}`);
}

// ── The database ───────────────────────────────────────────────────────────────────────────────────

export type HealthFacts = {
  ms: number;
  inUse: number;
  max: number;
  stuck: number;
  jobs: { name: string; failed24h: number }[] | null;
};

export function dbDownLines(): StatusLine[] {
  const todo = 'Read again in a minute.';
  return [
    line('db_answers', 'act', 'Our database did not answer.', 'Tell the developer now.', 'Our database did not answer.'),
    line('errors', 'unchecked', 'Our database did not answer, so the error records could not be read.', todo),
    line('error_rate', 'unchecked', 'Our database did not answer, so the call counts could not be read.', todo),
    line('traffic', 'unchecked', 'Our database did not answer, so the call counts could not be read.', todo),
    line('counts', 'unchecked', 'Our database did not answer.', todo),
    line('connections', 'unchecked', 'Our database did not answer.', todo),
    line('jobs', 'unchecked', 'Our database did not answer.', todo),
  ];
}

export function dbAnswersLine(f: HealthFacts): StatusLine {
  const ms = Math.round(f.ms);
  if (ms > THRESHOLDS.dbSlowMs) {
    return line('db_answers', 'look', `Answered in ${n(ms)} milliseconds; it usually takes under half a second.`,
      'Read again in a minute; if it stays slow, tell the developer.', 'Our database is slow to answer.');
  }
  return line('db_answers', 'fine', `Answered in ${n(ms)} ${plural(ms, 'millisecond', 'milliseconds')}`);
}

export function connectionsLine(f: HealthFacts): StatusLine {
  const share = f.max > 0 ? f.inUse / f.max : 0;
  const stuck = f.stuck > 0 ? `${n(f.stuck)} stuck for over 5 minutes` : 'nothing stuck';
  const says = `${n(f.inUse)} of ${n(f.max)} in use; ${stuck}`;
  if (share >= THRESHOLDS.connectionsActShare) return line('connections', 'act', says, 'Tell the developer now: the database is nearly out of connections.', 'The database is nearly out of connections.');
  if (share >= THRESHOLDS.connectionsLookShare) return line('connections', 'look', says, 'Tell the developer: connections are filling up.', 'Database connections are filling up.');
  if (f.stuck > 0) return line('connections', 'look', says, 'Tell the developer: a database session is stuck.', 'A database session is stuck.');
  return line('connections', 'fine', says);
}

export function jobsLine(f: HealthFacts): StatusLine {
  if (f.jobs === null) return line('jobs', 'unchecked', 'This database has no scheduled jobs to read.', null);
  const total = f.jobs.length;
  const failing = f.jobs.filter(j => j.failed24h > 0);
  if (failing.length > 0) {
    const names = failing.map(j => j.name).join(', ');
    return line('jobs', 'look', `${n(failing.length)} of ${n(total)} ${plural(total, 'job', 'jobs')} failed a run in the last 24 hours`,
      `Tell the developer which: ${names}.`, 'A scheduled job failed.');
  }
  return line('jobs', 'fine', `${n(total)} ${plural(total, 'job', 'jobs')}; every run in the last 24 hours finished`);
}

const SERVICE_WORDS: Record<string, string> = {
  db: 'the database', auth: 'sign-in', rest: 'data', storage: 'file storage', realtime: 'live updates',
};
export const SUPABASE_SERVICES = Object.keys(SERVICE_WORDS);

export function servicesLine(id: 'db_services' | 'staging_db', down: string[]): StatusLine {
  const known = down.filter(s => Object.hasOwn(SERVICE_WORDS, s)).map(s => SERVICE_WORDS[s]);
  if (down.length === 0) {
    return id === 'db_services'
      ? line(id, 'fine', 'The database, sign-in, data, file storage and live updates are all answering')
      : line(id, 'fine', 'All services answering');
  }
  const words = known.length > 0 ? joinWords(known) : 'a service';
  const says = `${capitalize(words)} ${known.length === 1 || known.length === 0 ? 'is' : 'are'} not answering.`;
  return id === 'db_services'
    ? line(id, 'act', says, "Tell the developer now; check Supabase's status page.", 'A database service is not answering.')
    : line(id, 'look', says, 'Tell the developer.', 'A staging database service is not answering.');
}

export function gatewayLine(count: number): StatusLine {
  const says = count === 0
    ? "No server errors at Supabase's gateway in the last hour"
    : `${n(count)} server ${plural(count, 'error', 'errors')} at Supabase's gateway in the last hour`;
  if (count >= THRESHOLDS.gatewayAct) return line('gateway', 'act', says, 'Tell the developer now.', "Supabase's gateway is failing many requests.", { to: 'errors' });
  if (count >= THRESHOLDS.gatewayLook) return line('gateway', 'look', says, 'Open Errors and compare; tell the developer if they match.', "Supabase's gateway is failing requests.", { to: 'errors' });
  return line('gateway', 'fine', says);
}

function joinWords(words: string[]): string {
  if (words.length <= 1) return words[0] ?? '';
  return `${words.slice(0, -1).join(', ')} and ${words[words.length - 1]}`;
}
const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

// ── The verdict line ───────────────────────────────────────────────────────────────────────────────

const RANK: Record<Verdict, number> = { act: 4, look: 3, unchecked: 2, reading: 1, fine: 0 };

export function worstLine(lines: readonly StatusLine[]): StatusLine | null {
  let worst: StatusLine | null = null;
  for (const l of lines) if (!worst || RANK[l.verdict] > RANK[worst.verdict]) worst = l;
  return worst;
}

export type Summary = { tone: 'fine' | 'look' | 'act'; lead: string; rest: string; headline: string };

/**
 * "1 to look at." + the worst line's sentence + "The other 12 checks are fine."; with several kinds,
 * "1 to act on now, 1 to look at, 3 not checked." + "8 checks are fine." (drawing A, G).
 */
export function summarize(lines: readonly StatusLine[]): Summary {
  const count = (v: Verdict) => lines.filter(l => l.verdict === v).length;
  const act = count('act'), look = count('look'), unchecked = count('unchecked'), fine = count('fine');
  const parts = [
    act ? `${act} to act on now` : '',
    look ? `${look} to look at` : '',
    unchecked ? `${unchecked} not checked` : '',
  ].filter(Boolean);
  if (parts.length === 0) {
    const reading = count('reading');
    return { tone: 'fine', lead: reading ? 'Reading…' : 'All fine.', rest: reading ? '' : `Every check of ${lines.length} is fine.`, headline: '' };
  }
  const worst = worstLine(lines);
  const headline = worst?.headline ?? (worst && worst.verdict === 'unchecked' ? 'Some checks could not be read.' : '');
  const single = parts.length === 1;
  const rest = single && act + look === 1
    ? `${headline} The other ${fine} ${plural(fine, 'check is', 'checks are')} fine.`
    : `${headline} ${fine} ${plural(fine, 'check is', 'checks are')} fine.`;
  // A reading that could not be taken is never shown as fine: Not checked alone still takes the amber rail.
  return { tone: act ? 'act' : 'look', lead: `${parts.join(', ')}.`, rest: rest.trim(), headline };
}
