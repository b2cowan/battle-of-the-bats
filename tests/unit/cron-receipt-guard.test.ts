/**
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * A SCHEDULED CALL CARRIES A RECEIPT (Board Ready trust call 21; owner chose option B, 2026-11-18).
 *
 * A database restored to a new project keeps the pg_cron jobs and the Vault key and calls the live site at once. Since
 * mig 502 the tick writes a one-use receipt into its own database and sends it; a machine call runs only after the app
 * consumes a receipt its OWN database holds (lib/cron-auth.ts scheduledCall). The live half (one receipt runs once, two
 * calls with one receipt run once, a foreign / old / wrong-job / missing receipt runs nothing, the person path is
 * unchanged) is `.probe/cron-receipt-prove.mjs`, run on dev.
 *
 *   1. Every job route asks scheduledCall first, inside the withObservability wrapper that names its OWN path (the
 *      receipt's path is read from there); the key alone is a private check nobody else can ask.
 *   2. Every scheduled HTTP tick in the migrations names a path whose route passes that same literal, so a receipt
 *      written for one job is never refused by its own route (a mismatch would silently stop that job).
 *   3. The latest definition of the tick sends the receipt, under the header the app reads.
 *   4. The receipt is consumed in ONE conditional update (unused, this path, inside the window), and a refusal runs nothing.
 *   5. A script that fires a job with the key writes its own receipt first.
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readCode, readSource, filesUnder, functionBody } from './_source-code.ts';

const MIGRATIONS = filesUnder('supabase/migrations', '.sql').filter(f => /\/\d+_[^/]*\.sql$/.test(f)).sort().map(f => ({ name: f, sql: readSource(f) }));

describe('a scheduled call carries a receipt', () => {
  const jobRoutes = new Map(filesUnder('app/api/platform-admin', '.ts')
    .filter(f => f.endsWith('route.ts'))
    .map(f => [f, readCode(f)] as const)
    .filter(([, src]) => /scheduledCall/.test(src)));

  it('1 · every job route asks scheduledCall first, inside a wrapper that names its own path', () => {
    assert.ok(jobRoutes.size >= 10, `found ${jobRoutes.size} job routes`);
    for (const [f, src] of jobRoutes) {
      const own = f.replace(/^app/, '').replace(/\/route\.ts$/, '');
      assert.match(src, /await scheduledCall\(req\);\s*if \(refused\) return refused;/, `${f}: scheduledCall, then return the refusal`);
      // The receipt's path is the wrapper's `route` (scheduledCall reads it from the request context).
      assert.match(src, new RegExp(`\\{ route: '${own.replace(/[/-]/g, '\\$&')}' \\}\\);\\s*$`), `${f}: withObservability names its own path`);
    }
  });

  it('2 · every scheduled tick path is one of those routes, so its receipt is never refused by its own job', () => {
    const paths = new Set(MIGRATIONS.flatMap(m => [...m.sql.matchAll(/app_cron_http_tick\('[^']+',\s*'([^']+)'\)/g)].map(h => h[1])));
    assert.ok(paths.size >= 10, `found ${paths.size} scheduled paths`);
    for (const p of paths) assert.ok(jobRoutes.has(`app${p}/route.ts`), `${p}: a job route that takes its receipt`);
    // No job reaches the app any other way: the only HTTP post in the migrations is inside the tick itself.
    for (const m of MIGRATIONS) if (/net\.http_post\(/.test(m.sql)) assert.match(m.sql, /create or replace function public\.app_cron_http_tick/i, `${m.name}: posts outside the tick, so it carries no receipt`);
  });

  it('3 · the latest tick definition sends the receipt under the header the app reads', () => {
    const auth = readCode('lib/cron-auth.ts');
    assert.match(auth, /const CRON_SECRET_HEADER = 'x-cron-secret';/);
    assert.match(auth, /const CRON_RECEIPT_HEADER = 'x-cron-receipt';/);
    assert.doesNotMatch(auth, /export function isCronRequest/, 'the key alone is never asked by a route');
    const defs = MIGRATIONS.filter(m => /create or replace function public\.app_cron_http_tick/i.test(m.sql));
    const latest = defs[defs.length - 1];
    assert.ok(Number(latest.name.match(/\/(\d+)_/)![1]) >= 502, 'the tick was redefined by 502 or later');
    assert.match(latest.sql, /insert into public\.cron_call_receipts \(job_name, path\) values \(p_job_name, p_path\) returning id into v_receipt/);
    assert.match(latest.sql, /'x-cron-receipt', v_receipt::text/);
    assert.match(latest.sql, /revoke all on public\.cron_call_receipts from public, anon, authenticated/);
  });

  it('4 · one conditional update consumes it, and a refusal runs nothing', () => {
    const body = functionBody(readCode('lib/cron-auth.ts'), 'scheduledCall');
    assert.match(body, /if \(!isCronRequest\(req\)\) return \{ machine: false, refused: null \}/, 'no key = the person path, untouched');
    assert.match(body, /const path = getRequestContext\(\)\?\.route;/);
    assert.match(body, /\.from\('cron_call_receipts'\)\s*\.update\(\{ used_at: [^}]+\}\)\s*\.eq\('id', receipt\)\s*\.eq\('path', path\)\s*\.is\('used_at', null\)\s*\.gt\('issued_at', /);
    assert.match(body, /data\.length === 1\) return \{ machine: true, refused: null \}/);
    assert.match(body, /severity: 'error'/, 'a refusal is an error-log issue that emails, never a silent warning');
    assert.match(body, /return \{ machine: false, refused: NextResponse\.json\(\{ ok: true, ran: false \}, \{ status: 200 \}\) \}/);
  });

  it('5 · a script that fires a job with the key writes its own receipt first', () => {
    for (const f of ['.mjs', '.js', '.cjs', '.ts', '.sh', '.ps1'].flatMap(ext => filesUnder('scripts', ext))) {
      const src = readSource(f);
      if (!/x-cron-secret/i.test(src)) continue;
      assert.match(src, /x-cron-receipt/i, `${f}: sends the key without a receipt (refused since mig 502)`);
      assert.match(src, /from\('cron_call_receipts'\)\.insert\(/, `${f}: writes the receipt it sends`);
    }
  });
});
