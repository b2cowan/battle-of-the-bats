import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { readCode, stripComments } from './_source-code.ts';
import { canAccessBookkeeping } from '../../lib/bookkeeping-access.ts';

/**
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * THE SUPPORT CONSOLE TAKES THE HOUSE LOOK (Support console Stage 1, owner rulings F1 + D1–D5, 2026-10-24;
 * plan `docs/projects/active/PLATFORM_ADMIN_SUPPORT_CONSOLE_PLAN.md`; drawings: artifact 7DWPUBp9cDp26a2P359zLW)
 *
 * What this pins, so the old dark console cannot come back one screen at a time:
 *   1. The console wears the admin kit and follows the account's Warm / Dark setting — no `fixed="dark"` anywhere under it.
 *   2. K-10 is retired — no console stylesheet sets the typewriter face on a table, a body or the whole shell. The data
 *      face is for codes, chips and eyebrows, each marked `type-ok: <role>` (the admin lettering ruling, 2026-10-19).
 *   3. The menu is the product's: Help, then Collapse sidebar at the foot; Sign out lives in the account menu only, and
 *      it lands on the console's own sign-in.
 *   4. WHO SEES WHAT DID NOT MOVE: every entry still follows `canViewPlatformArea`, Bookkeeping still follows
 *      `canAccessBookkeeping` (the owner's email allowlist), and the role filter is the one it was.
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 */

const ROOT = process.cwd();
const read = readCode;

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = path.join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out); else out.push(p);
  }
  return out;
}
const rel = (p: string) => path.relative(ROOT, p).split(path.sep).join('/');
const CONSOLE_DIRS = ['app/platform-admin', 'components/platform-admin'];
// Bookkeeping's screen belongs to its own plan's session and is held out of the lettering gate until that plan closes
// (`HELD_OUT` in scripts/check-admin-type.mjs); the same hold applies here.
const consoleFiles = CONSOLE_DIRS.flatMap(d => walk(path.join(ROOT, d)))
  .filter(f => !rel(f).startsWith('app/platform-admin/bookkeeping/'));

describe('the support console wears the house look (Stage 1)', () => {
  it('nothing under the console pins the dark theme, and every non-login page renders inside the one shell', () => {
    const offenders = consoleFiles
      .filter(f => /\.(tsx|ts)$/.test(f))
      .filter(f => /fixed=["']dark["']/.test(stripComments(readFileSync(f, 'utf8'))))
      .map(rel);
    assert.deepEqual(offenders, [], 'the console follows the Warm / Dark setting; the sign-in is fixed WARM, never dark');
    const layout = stripComments(read('app/platform-admin/layout.tsx'));
    assert.match(layout, /<PlatformShell\b/, 'the shell is mounted by the layout, once, for every page but the sign-in');
    assert.doesNotMatch(layout, /helpMain|pathname\.startsWith\(['"]\/platform-admin\/help/,
      'the help pages open in place, inside the same shell (owner 2026-10-24, Ask 2)');
  });

  it('K-10 is gone: no console stylesheet puts the typewriter face on a table, a cell or the shell', () => {
    const offenders: string[] = [];
    for (const file of consoleFiles.filter(f => f.endsWith('.css'))) {
      const css = readFileSync(file, 'utf8').replace(/\r\n/g, '\n');
      // Every rule: selector { body }. A comment on a line is kept so `type-ok: code` can excuse a CODE class.
      for (const m of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
        const selector = m[1].replace(/\/\*[\s\S]*?\*\//g, '').trim();
        const body = m[2];
        if (!/font(-family)?\s*:[^;]*(--font-data|--font-mono|monospace)/.test(body)) continue;
        // An element (table, cell, body) or a class NAMED for one (.scopeTable, .cell, .rowName, .shell, .pageBody) is the retired
        // rule; a class for a code, a chip or an eyebrow carries `type-ok: <role>` on its line, as the lettering gate asks.
        const onTableLike = /(^|[\s,>+~])(table|td|th|tr|tbody|thead|body)(?![\w-])|\.[\w-]*(table|cell|row|shell|body)[\w-]*/i.test(selector);
        if (onTableLike && !/type-ok/.test(body)) offenders.push(`${rel(file)}: ${selector.slice(0, 80)}`);
      }
    }
    assert.deepEqual(offenders, [], 'a table, a cell or the shell in the data face is the retired K-10 rule; a code takes a class of its own (`.code`)');
  });

  it('no console stylesheet carries a literal colour or a [data-admin-kit] selector', () => {
    for (const f of consoleFiles.filter(p => p.endsWith('.css')).map(rel)) {
      const css = readFileSync(path.join(ROOT, f), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
      assert.doesNotMatch(css, /\[data-admin-kit\]/, `${f}: plain rules only — the old-look gate refuses a [data-admin-kit] selector here`);
      assert.doesNotMatch(css, /#[0-9a-fA-F]{3,8}\b/, `${f}: tokens only, no literal colour`);
    }
  });

  it('the menu foot is Help then Collapse sidebar; Sign out lives only in the account menu and lands on the console sign-in', () => {
    const nav = stripComments(read('app/platform-admin/PlatformAdminNav.tsx'));
    assert.ok(nav.indexOf('<CollapseSidebarRow') > nav.indexOf('>Help<'), 'Help comes before Collapse sidebar, and Collapse is the last row');
    assert.doesNotMatch(nav, /signOut|Sign out|LogOut|ACTIVE SESSION|PLATFORM ADMIN/,
      'the menu carries no sign-out and no badge — the strip carries the person and the name');
    const shell = stripComments(read('app/platform-admin/PlatformShell.tsx'));
    assert.match(shell, /signOutTo="platform"/, 'the account menu signs out to the console\'s own sign-in');
    assert.match(shell, /showFeedback=\{false\}/, 'staff do not send feedback to our own inbox');
    assert.match(shell, /showAccount=\{false\}/, 'staff have no customer account rows');
    const menu = stripComments(read('components/shared/AccountMenu.tsx'));
    assert.match(menu, /signOutTo === 'platform' \? '\/platform-admin\/login'/, 'the platform destination is the console sign-in');
  });

  it('who sees what did not move: the role filter and Bookkeeping\'s email allowlist are the ones they were', () => {
    // Stage 2 moved the list into `console-menu.ts` (the menu by job, owner 2026-10-25) — the rules did not move.
    const menu = stripComments(read('app/platform-admin/console-menu.ts'));
    const nav = stripComments(read('app/platform-admin/PlatformAdminNav.tsx'));
    assert.match(menu, /group\.items\.filter\(item => canViewPlatformArea\(role, item\.area\)\)/, 'every entry follows canViewPlatformArea');
    assert.match(nav, /isPlatformAreaReadOnly\(role, area\)/, 'a read-only area keeps its eye marker');
    assert.match(menu, /canBookkeep \? \[\.\.\.groups, \{ label: 'Private finance'/, 'Bookkeeping appears only behind canBookkeep');
    assert.match(nav, /NEXT_PUBLIC_ENABLE_DEV_TOOLS === 'true'/, 'Dev tools stays behind its flag');
    const layout = stripComments(read('app/platform-admin/layout.tsx'));
    assert.match(layout, /canBookkeep=\{canAccessBookkeeping\(auth\)\}/, 'the layout still decides Bookkeeping by the allowlist, never by a role');
    assert.equal(typeof canAccessBookkeeping, 'function');
    // Stage 2's menu by job: the same 19 routes, regrouped (Help is at the foot, so it is not among them). Dev tools and
    // Bookkeeping are declared as constants beside the groups, so they are checked as a pair apart from the seventeen.
    const extras = ['/platform-admin/dev-tools', '/platform-admin/bookkeeping'];
    const all = [...menu.matchAll(/href: '(\/platform-admin[^']*)'/g)].map(m => m[1]);
    assert.deepEqual(all.filter(h => extras.includes(h)).sort(), [...extras].sort(), 'Dev tools and Bookkeeping are still the two flagged entries');
    const hrefs = all.filter(h => !extras.includes(h));
    assert.deepEqual(hrefs, [
      '/platform-admin', '/platform-admin/orgs', '/platform-admin/customer-users', '/platform-admin/free-time',
      // Stage 5 (owner Q1/Q3 2026-10-26) added Status and Sent emails to Health.
      '/platform-admin/retention', '/platform-admin/status', '/platform-admin/observability', '/platform-admin/feedback',
      '/platform-admin/sent-emails', '/platform-admin/early-access', '/platform-admin/email', '/platform-admin/pitch-deck-studio',
      // Stage 7 (owner S7-D6 2026-10-27) added Business numbers to Growth, for every role.
      '/platform-admin/business-numbers',
      '/platform-admin/plans-pricing', '/platform-admin/change-requests', '/platform-admin/bulk-operations',
      '/platform-admin/email-templates', '/platform-admin/exports', '/platform-admin/users', '/platform-admin/audit',
    ], 'the same pages, in the menu by job — no entry added or dropped');
  });

  it('the portal\'s name is one word, read from one place', () => {
    const labels = stripComments(read('lib/workspace-labels.ts'));
    assert.match(labels, /PLATFORM_PORTAL_LABEL = 'Support console'/);
    for (const f of ['app/platform-admin/layout.tsx', 'app/platform-admin/PlatformShell.tsx']) {
      assert.match(stripComments(read(f)), /PLATFORM_PORTAL_LABEL/, `${f} reads the portal's name from the one place`);
    }
  });
});
