import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readCode } from './_source-code.ts';
import { SIDEBAR_STRIP_ATTR, SIDEBAR_STRIP_KEY, SIDEBAR_STRIP_VALUE } from '../../lib/sidebar-strip.ts';
import { NO_FLASH_SCRIPT } from '../../lib/no-flash-script.ts';

/**
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * THE SIDEBAR STRIP (Sidebar Strip & Grid Width, Stage 2 — ratified hub 5s1QP7HHsctVso78u5tUjC).
 * Every portal's sidebar folds to a 64 strip of icons, by choice, per device. What this pins:
 *
 *   1. ONE SETTING, EVERY PORTAL. The club/tournament, Premium coach and free coach sidebars all end
 *      in the shared "Collapse sidebar" row, which reads and writes `lib/sidebar-strip.ts` — and the
 *      no-flash script reads the SAME key into the SAME attribute before the first paint.
 *   2. NO SIDEBAR WIDTH IS HARD-CODED outside its variable, so everything pinned to a sidebar's edge
 *      (the coach Save bar, the free header band and content) follows it into the strip.
 *   3. EVERY ROW KEEPS AN ACCESSIBLE NAME in the strip: its label is hidden by the clip recipe, never
 *      `display: none`, and every row the rails draw carries it.
 *   4. NO COUNT, DOT OR DOOR IS LOST: every badge and dot the full rail renders sits on its icon's
 *      corner in the strip, and a group folded shut keeps its rows in the page for the strip to show.
 *   5. PHONES ARE UNCHANGED: every strip rule lives above 900px.
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 */

const SETTING = 'lib/sidebar-strip.ts';
const SHARED = 'components/shared/SidebarStrip.tsx';
const SHARED_CSS = 'components/shared/SidebarStrip.module.css';
const ADMIN_RAIL = 'components/admin/kit/AdminKitRail.tsx';
const ADMIN_CSS = 'components/admin/kit/AdminKitFrame.module.css';
const ADMIN_SHELL_CSS = 'app/[orgSlug]/admin/admin.module.css';
const COACH_RAIL = 'components/coaches/CoachesSidebar.tsx';
const COACH_CSS = 'app/[orgSlug]/coaches/coaches.module.css';
const FREE_SHELL = 'components/coaches/CoachPortalShell.tsx';
const FREE_CSS = 'components/coaches/CoachPortalShell.module.css';
const RAILS = [ADMIN_RAIL, COACH_RAIL, FREE_SHELL];
const STRIP_CSS = [SHARED_CSS, ADMIN_CSS, ADMIN_SHELL_CSS, COACH_CSS, FREE_CSS];

/** The bodies of every `@media (min-width: 901px) { … }` block in a stylesheet, by brace matching. */
function desktopBlocks(css: string): string[] {
  const out: string[] = [];
  const re = /@media \(min-width: 901px\) \{/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(css))) {
    let depth = 1;
    let i = m.index + m[0].length;
    for (; i < css.length && depth > 0; i++) {
      if (css[i] === '{') depth++;
      else if (css[i] === '}') depth--;
    }
    out.push(css.slice(m.index, i));
  }
  return out;
}

/** One rule's declarations (`selector { … }`), first match. */
function rule(css: string, selector: RegExp): string {
  const m = css.match(new RegExp(`${selector.source}\\s*\\{([^}]*)\\}`, selector.flags));
  return m?.[1] ?? '';
}

/** A rail's own markup: the free shell also draws the phone header, which is no part of the sidebar. */
function railCode(f: string): string {
  const code = readCode(f);
  if (f !== FREE_SHELL) return code;
  const start = code.indexOf('<aside className={styles.rail}');
  return code.slice(start, code.indexOf('</aside>', start));
}

describe('1. one setting, every portal', () => {
  it('every sidebar ends in the shared Collapse sidebar row', () => {
    for (const f of RAILS) {
      const code = readCode(f);
      assert.match(code, /from '@\/components\/shared\/SidebarStrip'/, f);
      assert.match(code, /<CollapseSidebarRow\b/, f);
    }
  });

  it('the row reads and writes the one setting module, and nothing else writes the key', () => {
    assert.match(readCode(SHARED), /setSidebarStrip\(!isSidebarStrip\(\)\)/);
    assert.match(readCode(SHARED), /from '@\/lib\/sidebar-strip'/);
    for (const f of [...RAILS, SHARED]) assert.doesNotMatch(readCode(f), /flhq-sidebar|localStorage\.setItem\(SIDEBAR/, f);
  });

  it('the no-flash script reads the same key into the same attribute', () => {
    assert.equal(SIDEBAR_STRIP_KEY, 'flhq-sidebar');
    assert.ok(NO_FLASH_SCRIPT.includes(`'${SIDEBAR_STRIP_KEY}'`), 'the script reads SIDEBAR_STRIP_KEY');
    assert.ok(NO_FLASH_SCRIPT.includes(`'${SIDEBAR_STRIP_ATTR}', '${SIDEBAR_STRIP_VALUE}'`), 'the script sets SIDEBAR_STRIP_ATTR');
  });

  it('every stylesheet keys the strip to that attribute, never to a class React adds after hydration', () => {
    for (const f of STRIP_CSS) {
      const css = readCode(f);
      assert.ok(css.includes(`html[${SIDEBAR_STRIP_ATTR}='${SIDEBAR_STRIP_VALUE}']`), f);
    }
  });

  it('the setting renders the full sidebar on the server and during hydration', () => {
    assert.match(readCode(SETTING), /useSyncExternalStore\(subscribe, isSidebarStrip, serverSnapshot\)/);
    assert.match(readCode(SETTING), /const serverSnapshot = \(\) => false;/);
  });
});

describe('2. no sidebar width is hard-coded outside its variable', () => {
  it('club and tournament: the rail reads --admin-rail-w, declared once (240, the strip 64)', () => {
    assert.match(rule(readCode(ADMIN_CSS), /^\.rail/m), /width: var\(--admin-rail-w\);/);
    const shell = readCode(ADMIN_SHELL_CSS);
    assert.equal(shell.match(/--admin-rail-w: 240px;/g)?.length, 1);
    assert.equal(shell.match(/--admin-rail-w: 64px;/g)?.length, 1);
    assert.doesNotMatch(readCode(ADMIN_CSS), /\b240px\b/);
  });

  it('Premium coach: the sidebar and the Save bar read --coach-sidebar-w with no second copy', () => {
    const css = readCode(COACH_CSS);
    assert.equal(css.match(/--coach-sidebar-w: 220px;/g)?.length, 1);
    assert.equal(css.match(/--coach-sidebar-w: 64px;/g)?.length, 1);
    assert.match(rule(css, /^\.sidebar/m), /width: var\(--coach-sidebar-w\);/);
    assert.match(rule(css, /^\.saveBar/m), /left: var\(--coach-sidebar-w\);/);
    assert.doesNotMatch(css, /var\(--coach-sidebar-w, /, 'no fallback width beside the variable');
  });

  it('free coach: the rail, the header band and the content read --coach-rail-w, declared once', () => {
    const css = readCode(FREE_CSS);
    assert.equal(css.match(/--coach-rail-w: 248px;/g)?.length, 1);
    assert.equal(css.match(/--coach-rail-w: 64px;/g)?.length, 1);
    assert.equal(css.match(/var\(--coach-rail-w\)/g)?.length, 3, 'rail width, header margin, content padding');
    assert.doesNotMatch(css.replace('--coach-rail-w: 248px;', ''), /\b248px\b/);
  });
});

describe('3. every row keeps an accessible name in the strip', () => {
  it('the label is hidden by the clip recipe, never display: none', () => {
    const css = readCode(SHARED_CSS);
    const label = rule(css, /:global\(html\[data-sidebar='strip'\]\) \.rowLabel/);
    assert.match(label, /clip-path: inset\(50%\);/);
    assert.doesNotMatch(label, /display: none/);
    for (const f of STRIP_CSS) assert.doesNotMatch(readCode(f), /\.rowLabel\s*\{[^}]*display: none/, f);
  });

  it('every row the rails draw carries its label in the recipe and its name in the bubble', () => {
    for (const f of RAILS) {
      const code = railCode(f);
      assert.ok(code.length > 0, `${f}: the rail's markup was found`);
      // A bare <span> holding a row's words would vanish from sight with no bubble and no recipe.
      assert.doesNotMatch(code, /aria-hidden \/>\s*<span>[^<{]*<\/span>|aria-hidden \/><span>\{?[^<]*<\/span>/, f);
      assert.match(code, /className=\{strip\.rowLabel\}/, f);
    }
    // The bubble reads the row's own name — its aria-label, else that label — so a row needs nothing more.
    assert.match(readCode(SHARED), /row\.getAttribute\('aria-label'\) \?\? row\.querySelector\(`\.\$\{styles\.rowLabel\}`\)/);
    // The feedback row's name comes from its own aria-label; the strip gets its bubble, not a second tooltip.
    assert.match(readCode(ADMIN_RAIL), /<FeedbackLauncher[^>]*stripLabelClassName=\{strip\.rowLabel\} titled=\{!stripNow\}/);
    assert.match(readCode('components/feedback/FeedbackLauncher.tsx'), /title=\{titled \? label : undefined\}/);
  });

  it('what only the full sidebar shows stays hidden in the strip, whatever a host rail sets on the same element', () => {
    // A single class ties a host module's own strip rule (another module: bundle order decides) — the
    // Premium rail's team picker showed an empty box under its tile until this was doubled.
    assert.match(desktopBlocks(readCode(SHARED_CSS)).join('\n'), /\.fullOnly\.fullOnly \{ display: none; \}/);
  });

  it('the collapse row names itself in both states, from the first paint', () => {
    const code = readCode(SHARED);
    assert.match(code, /<span className=\{styles\.whenFull\}>Collapse sidebar<\/span>/);
    assert.match(code, /<span className=\{`\$\{styles\.whenStrip\} \$\{styles\.rowLabel\}`\}>Expand sidebar<\/span>/);
  });
});

describe('4. no count, dot or door is lost in the strip', () => {
  it('every chat badge and release dot a rail renders sits on its icon’s corner', () => {
    for (const f of RAILS) {
      const code = railCode(f);
      for (const badge of code.match(/<ChatUnreadBadge[^>]*\/>/g) ?? []) {
        // The coach group heading's rolled-up badge is full-sidebar furniture: the strip hides the heading and
        // shows the Chat row itself, which carries the count.
        if (badge.includes('sidebarGroupBadge')) continue;
        assert.match(badge, /className=\{strip\.cornerCount\}/, `${f}: ${badge}`);
      }
      for (const dot of code.match(/<ReleaseDot[^>]*\/>/g) ?? []) assert.match(dot, /className=\{strip\.cornerDot\}/, `${f}: ${dot}`);
    }
    assert.match(readCode(ADMIN_RAIL), /<WaitingCount[^>]*className=\{strip\.cornerCount\}/);
  });

  it('an open program keeps its count on the icon in the strip (its pages are in the menu)', () => {
    assert.match(readCode(ADMIN_RAIL), /open && hasPages \? ` \$\{styles\.countWhenOpen\}`/);
    const desk = desktopBlocks(readCode(ADMIN_CSS)).join('\n');
    assert.match(desk, /\.countWhenOpen \{ display: inline-flex; \}/);
    // …and the hidden count never pulls the FULL sidebar's chevron off the row's right edge (/review): a
    // display:none sibling still matches `+`.
    const adminCss = readCode(ADMIN_CSS);
    assert.match(adminCss, /\.count:not\(\.countWhenOpen\) \+ \.chevron \{ margin-left: 0\.25rem; \}/);
    assert.doesNotMatch(adminCss, /(^|\n)\.count \+ \.chevron/);
  });

  it('no stylesheet hides a count or a corner mark in the strip', () => {
    for (const f of STRIP_CSS) {
      for (const block of desktopBlocks(readCode(f))) {
        assert.doesNotMatch(block, /\.(count|cornerCount|cornerDot|badge)\b[^{]*\{[^}]*display: none/, f);
      }
    }
  });

  it('a group folded shut keeps its rows in the page for the strip to show', () => {
    for (const f of [ADMIN_RAIL, COACH_RAIL]) {
      const code = readCode(f);
      assert.doesNotMatch(code, /open && (g\.)?items\.map/, f);
      assert.match(code, /<div className=\{strip\.foldedGroup\}>/, f);
    }
    assert.match(rule(readCode(SHARED_CSS), /^\.foldedGroup/m), /display: none;/);
    assert.match(desktopBlocks(readCode(SHARED_CSS)).join('\n'), /\.foldedGroup \{ display: contents; \}/);
  });

  it('the strip menu keeps the house menu keys — one shared copy with the toolbar menu', () => {
    assert.match(readCode(SHARED), /rovingMenuKey\(e, /);
    assert.match(readCode('components/coaches/CoachToolbarMenu.tsx'), /rovingMenuKey\(event, items\(\)\)/);
  });

  it('the club and Premium sidebars raise their own layer in the strip (the free rail is already over its page)', () => {
    assert.match(readCode(ADMIN_RAIL), /<aside className=\{`\$\{styles\.rail\} \$\{strip\.stripLayer\}`\}/);
    assert.match(readCode(COACH_RAIL), /<nav className=\{`\$\{styles\.sidebar\} \$\{strip\.stripLayer\}`\}/);
  });

  it('a program with 2+ pages, or the team or season you are inside, opens a menu; Organization leads with its own page', () => {
    const admin = readCode(ADMIN_RAIL);
    assert.match(admin, /p\.pages\.length > 1 \|\| \(p\.key === 'rep-teams' && !!repTeamId\) \|\| \(p\.key === 'house-league' && !!seasonId\)/);
    assert.match(admin, /<StripMenuLink href=\{`\$\{base\}\/org`\} active=\{pathname === `\$\{base\}\/org`\}>Organization<\/StripMenuLink>/);
  });

  it('the pickers become tiles that open their lists — the coach list keeps "No live season"', () => {
    for (const f of RAILS) assert.match(readCode(f), /<SidebarStripTile\b/, f);
    assert.match(readCode(COACH_RAIL), /<StripMenuGroup label="No live season">/);
    assert.match(readCode(ADMIN_RAIL), /New tournament/);
  });

  it('the free portal shows its team header band in the strip on every page whose address names a team', () => {
    assert.match(readCode(FREE_SHELL), /pathNamesFreeTeam\(pathname\)[^}]*styles\.mheadTeamPage/);
    assert.match(desktopBlocks(readCode(FREE_CSS)).join('\n'), /\.mheadTeamOnly\.mheadTeamPage:not\(\[hidden\]\) \{ display: block; \}/);
  });
});

describe('5. phones are unchanged', () => {
  it('every strip rule lives above 900px', () => {
    for (const f of STRIP_CSS) {
      const css = readCode(f);
      const inside = desktopBlocks(css).join('\n');
      const total = css.match(/data-sidebar='strip'/g)?.length ?? 0;
      const desk = inside.match(/data-sidebar='strip'/g)?.length ?? 0;
      assert.ok(total > 0, `${f} has strip rules`);
      assert.equal(desk, total, `${f}: a strip rule outside @media (min-width: 901px)`);
    }
  });
});
