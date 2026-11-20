/**
 * THE TOURNAMENTS LIST HAS ONE ADDRESS — `/{org}/admin/tournaments/manage` (Retire the old tournament-only menu, step 1,
 * 2026-11-20; plan `docs/projects/active/RETIRE_OLD_TOURNAMENT_ONLY_NAV_PLAN.md`).
 *
 * The page used to live under Organization (`admin/org/tournaments`) with a one-line re-export at `manage`, so it answered
 * at two addresses and behaved three ways: a club drew it in the Organization frame, a Tournament plan's org layout sent it
 * to `/admin/tournaments` and dropped `?create=1`, and a one-team workspace drew it under the old Account menu. The page now
 * lives at `manage`, and `proxy.ts` forwards the old address there with its search.
 *
 * This guard fails when any source file other than the proxy's forward (and this test) names the old address again — a
 * link, a push, a sweep screen, a baseline key or a test reading the old file. Point it at `/admin/tournaments/manage`.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const REPO_ROOT = join(import.meta.dirname, '..', '..');
const SCAN_ROOTS = ['app', 'components', 'lib', 'scripts', 'tests', 'supabase'];
const SCAN_FILES = ['proxy.ts', 'next.config.ts', 'package.json'];
const EXTENSIONS = ['.ts', '.tsx', '.mjs', '.cjs', '.js', '.json', '.sql'];
const SKIP_DIRS = new Set(['node_modules', '.next']);
const SELF = 'tests/unit/tournaments-list-one-address-guard.test.ts';
// The path, or any built form of it (`${base}/org/tournaments`, `'org/tournaments'`) — not a slug that ends in "-org".
const OLD = /(?<![\w-])org\/tournaments\b/;

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (SKIP_DIRS.has(entry)) continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (EXTENSIONS.some(ext => entry.endsWith(ext))) out.push(full);
  }
  return out;
}

const rel = (abs: string) => abs.slice(REPO_ROOT.length + 1).split('\\').join('/');
const read = (path: string) => readFileSync(join(REPO_ROOT, path), 'utf8');

describe('the Tournaments list has one address', () => {
  it('no source file names the old Organization address (only the proxy forward does)', () => {
    const files = [
      ...SCAN_ROOTS.flatMap(root => walk(join(REPO_ROOT, root)).map(rel)),
      ...SCAN_FILES.filter(f => { try { statSync(join(REPO_ROOT, f)); return true; } catch { return false; } }),
    ];
    const offenders = files.filter(f => f !== SELF && f !== 'proxy.ts' && OLD.test(read(f)));
    assert.deepEqual(offenders, [], 'Use /admin/tournaments/manage — the old address only exists as the proxy\'s forward');
  });

  it('the page lives at manage, and nothing is left under Organization', () => {
    assert.doesNotMatch(read('app/[orgSlug]/admin/tournaments/manage/page.tsx'), /export \{ default \} from/);
    assert.throws(() => statSync(join(REPO_ROOT, 'app/[orgSlug]/admin/org/tournaments')), 'the old folder must stay deleted');
  });

  it('the proxy forwards the old address to manage, search kept, before auth', () => {
    const proxy = read('proxy.ts');
    const at = proxy.indexOf("segments[2] === 'org' && segments[3] === 'tournaments'");
    assert.ok(at > 0, 'the forward is gone');
    const block = proxy.slice(at, proxy.indexOf('NextResponse.redirect(', at) + 60);
    assert.match(block, /request\.nextUrl\.clone\(\)/, 'clone the URL so ?create=1 survives');
    assert.match(block, /\/admin\/tournaments\/manage`/);
    assert.match(block, /status: 307/);
    assert.ok(proxy.indexOf("segments[3] === 'tournaments'") < proxy.indexOf('createServerClient('), 'the forward runs before the session check');
  });
});
