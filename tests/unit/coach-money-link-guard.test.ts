import assert from 'node:assert/strict';
import { readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { describe, it } from 'node:test';
import { readCode } from './_source-code.ts';
import { moneySectionHref } from '../../lib/coach-money-links.ts';

/**
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * A LINK TO A COACH'S MONEY TAB GOES THROUGH `moneySectionHref` (found drawing Club Tier Stage 11d, 2026-10-12).
 *
 * The Money hub's standalone tab routes (`accounting/club`, `accounting/budget`, …) were deleted 2026-08-31; the hub
 * addresses a tab by `?section=`. Three club→team money bells kept the hand-built `…/accounting/club` address and
 * every one of them 404'd — the received / undone / approved / declined / reversed notices and the schedule's
 * "bill arrived" bell. A hand-built path under `…/accounting/` names a route that no longer exists, so none may be
 * written anywhere a link is built; the hub itself (`…/accounting`, no tail) is still a page.
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 */

const ROOT = path.join(import.meta.dirname, '..', '..');

function sourceFiles(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(path.join(ROOT, dir))) {
    if (name === 'node_modules' || name.startsWith('.')) continue;
    const rel = `${dir}/${name}`;
    if (statSync(path.join(ROOT, rel)).isDirectory()) sourceFiles(rel, out);
    else if (/\.(ts|tsx|mjs)$/.test(name) && !/\.test\.ts$/.test(name)) out.push(rel);
  }
  return out;
}

describe('a coach money tab is addressed one way', () => {
  it('no code hand-builds a path under a team\'s accounting/ (those routes were deleted)', () => {
    const offenders: string[] = [];
    for (const rel of ['lib', 'app', 'components'].flatMap(d => sourceFiles(d))) {
      if (/coaches\/teams\/\$\{[^}]+\}\/accounting\/[a-z]/.test(readCode(rel))) offenders.push(rel);
    }
    assert.deepEqual(offenders, [], `hand-built money tab paths (use moneySectionHref): ${offenders.join(', ')}`);
  });

  it('the club money bells link to the Club tab through moneySectionHref', () => {
    const notify = readCode('lib/club-money-notify.ts');
    assert.match(notify, /link: moneySectionHref\(`\/\$\{p\.org\.slug\}\/coaches\/teams\/\$\{p\.teamId\}`, 'club'\)/);
    const send = readCode('lib/club-schedule-send.ts');
    assert.equal((send.match(/moneySectionHref\(`\/\$\{org\.slug\}\/coaches\/teams\/\$\{t\.teamId\}`, 'club'\)/g) ?? []).length >= 2, true,
      'both of the schedule send\'s bill bells open the Club tab');
  });

  it('the address it builds is the hub with ?section=club', () => {
    assert.equal(moneySectionHref('/uat-rep-club/coaches/teams/t1', 'club'), '/uat-rep-club/coaches/teams/t1/accounting?section=club');
  });
});
