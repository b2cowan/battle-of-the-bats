/**
 * PUBLIC TOURNAMENT PAGES — STAGE 7 STEP 0: THE INSTALLED APP KEEPS NO COPY OF A PAY PAGE
 * (build prompt docs/projects/active/PUBLIC_TOURNAMENT_STAGE7_BUILD_PROMPT.md, Part 1 step 0).
 *
 * The service worker keeps a last-good copy of every public tournament page for offline "last scores". A team's
 * pay page (/{org}/{tournament}/pay/{token}) is reached by a link that never expires: a stored copy is a key left on
 * a shared phone, replayed offline to the next person. This runs the real public/sw.js in a sandbox and asks its
 * own classifier, so a rewrite of the rule cannot pass by keeping a comment.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const SW = readFileSync(path.join(import.meta.dirname, '..', '..', 'public', 'sw.js'), 'utf8');

type Classifiers = { isNeverCache: (p: string) => boolean; isPublicTournamentPage: (p: string) => boolean };
function loadWorker(): Classifiers {
  const sandbox: Record<string, unknown> = { self: { addEventListener() {}, location: { origin: 'https://x.test' } } };
  vm.createContext(sandbox);
  vm.runInContext(SW, sandbox);
  return sandbox as unknown as Classifiers;
}

describe('Stage 7 step 0 — a pay page never enters the shared page cache', () => {
  const sw = loadWorker();

  it('every pay page, including Stripe\'s returns, is never cached', () => {
    // The fetch handler classifies by pathname; ?paid= and ?left=1 share the path, so they are covered by it.
    // The last two are a club's own web address, where the browser's path carries no org segment (/review 2026-11-01).
    for (const p of ['/riverdale/spring-classic/pay/abc.def', '/riverdale/spring-classic/pay/abc.def/', '/o/t/pay',
      '/spring-classic/pay/abc.def', '/spring-classic/pay/abc.def/']) {
      assert.equal(sw.isNeverCache(p), true, `${p} must be never-cache`);
      assert.equal(sw.isPublicTournamentPage(p), false, `${p} must not be kept for offline`);
    }
  });

  it('the rest of the event is still kept for offline last scores', () => {
    for (const p of ['/riverdale/spring-classic', '/riverdale/spring-classic/schedule', '/riverdale/spring-classic/teams/9']) {
      assert.equal(sw.isNeverCache(p), false, p);
      assert.equal(sw.isPublicTournamentPage(p), true, p);
    }
    // A tournament or team that happens to be named "pay" is not a pay page.
    assert.equal(sw.isPublicTournamentPage('/riverdale/pay'), true);
    assert.equal(sw.isPublicTournamentPage('/riverdale/spring-classic/teams/pay'), true);
  });

  it('the cache version moved past v12, so copies stored before the rule are dropped', () => {
    const v = Number(/CACHE_VERSION = 'v(\d+)'/.exec(SW)?.[1]);
    assert.ok(v >= 13, 'bump CACHE_VERSION when a page leaves the cache');
  });
});
