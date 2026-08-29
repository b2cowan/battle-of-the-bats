/**
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * THE INSIGHTS REPORTS PORTAL — the invariants P1 rests on
 * (COACH_INSIGHTS_REPORTS_PORTAL_PLAN.md, owner-approved mockups 2026-08-18)
 *
 * Insights became one page with a row of report tabs. Three of the things that change with it are
 * invisible when they break, which is what this file is for:
 *
 *   1. **The gate moved**, and it moved for exactly one persona. A money-only treasurer loses the
 *      door; nobody else does. A gate change that quietly takes a door from a real assistant is the
 *      single most repeated defect class in this repo's nav work.
 *   2. **A tab is a page's only entry point now.** Six reports stopped being routes; if the hub
 *      fails to render a tab or fails to mount its panel, the report is unreachable and every
 *      screen still renders perfectly.
 *   3. **Money is out**, and the way it is kept out is structural (the hub never asks for dues) —
 *      not a render branch someone can helpfully "restore".
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  resolveCoachCapabilities,
  hasRecordAccess,
  hasNonMoneyRecordAccess,
  type CoachCapabilities,
  type AssistantCapabilityGrants,
} from '../../lib/coach-capabilities.ts';
import { isCoachNavItemVisible } from '../../lib/coach-nav-visibility.ts';
import {
  insightsSectionHref,
  insightsDashboardHref,
  legacyInsightsSection,
  type CoachInsightsSection,
} from '../../lib/coach-insights-links.ts';

const COACH_PAGES = join(process.cwd(), 'app', '[orgSlug]', 'coaches', 'teams', '[teamId]');
const HUB = readFileSync(join(COACH_PAGES, 'history', 'page.tsx'), 'utf8');

const assistant = (grants?: AssistantCapabilityGrants): CoachCapabilities =>
  resolveCoachCapabilities('assistant_coach', grants);

/** Every grant off — the HELPER floor the portal treats as least privilege. */
const NOTHING: AssistantCapabilityGrants = {
  schedule: false, scheduleManage: false, attendance: false, lineups: false, notes: false,
  money: 'off', documents: 'off', tryouts: false, rosterPii: false, announcementsSend: false,
  staffChat: false,
};

// ── 1 · The gate ────────────────────────────────────────────────────────────
describe('the Insights door moves for the treasurer and for nobody else', () => {
  it('a money-only assistant loses Insights, and keeps the Money hub', () => {
    const treasurer = assistant({ ...NOTHING, money: 'write' });
    // They genuinely hold a record duty — this is not a helper.
    assert.equal(hasRecordAccess(treasurer), true);
    assert.equal(
      isCoachNavItemVisible(treasurer, 'Insights'), false,
      'a coach whose only duty is money still has the Insights door. Money left Insights entirely '
      + '(owner ruling 3), so that door now opens onto a portal of player and team statistics with '
      + 'nothing of theirs on it.',
    );
    assert.equal(
      isCoachNavItemVisible(treasurer, 'Money'), true,
      'and the Money hub — where every figure they lost already lived — must still be open, or '
      + 'this change has taken something away instead of moving it.',
    );
  });

  it('every real assistant keeps Insights', () => {
    // The shipped defaults: attendance, lineups, documents. Nobody already invited moves.
    assert.equal(isCoachNavItemVisible(assistant(), 'Insights'), true);
    assert.equal(isCoachNavItemVisible(resolveCoachCapabilities('head_coach'), 'Insights'), true);
    for (const grants of [
      { ...NOTHING, attendance: true },
      { ...NOTHING, lineups: true },
      { ...NOTHING, notes: true },
      { ...NOTHING, tryouts: true },
      { ...NOTHING, documents: 'view' as const },
      // The mixed case the naive "record access minus money" phrasing gets wrong: this coach
      // holds money AND a real duty, and must keep the door.
      { ...NOTHING, money: 'write' as const, attendance: true },
    ]) {
      assert.equal(
        isCoachNavItemVisible(assistant(grants), 'Insights'), true,
        `grants ${JSON.stringify(grants)} lost the Insights door — only the money-ONLY treasurer may.`,
      );
    }
  });

  it('a helper still sees nothing here', () => {
    const helper = assistant(NOTHING);
    assert.equal(hasNonMoneyRecordAccess(helper), false);
    assert.equal(isCoachNavItemVisible(helper, 'Insights'), false);
  });

  /**
   * ⚠ The whole point of a SEPARATE predicate rather than editing `hasRecordAccess`: every other
   * record surface keeps the treasurer. Narrowing the shared predicate would have taken the roster
   * page and Season's End away from them as a side effect nobody asked for.
   */
  it('no other record surface narrows with it', () => {
    const treasurer = assistant({ ...NOTHING, money: 'write' });
    for (const door of ['Roster', "Season's End", 'Skills & Goals']) {
      assert.equal(
        isCoachNavItemVisible(treasurer, door), true,
        `${door} closed for the treasurer. Only the Insights door was meant to move.`,
      );
    }
  });
});

// ── 2 · The rename ──────────────────────────────────────────────────────────
describe('the workbench renamed, and the old label still gates', () => {
  it('"Skills & Goals" is gated exactly as "Development" was', () => {
    const helper = assistant(NOTHING);
    assert.equal(isCoachNavItemVisible(helper, 'Skills & Goals'), false);
    assert.equal(isCoachNavItemVisible(assistant(), 'Skills & Goals'), true);
  });

  /**
   * ⚠⚠ THE FALLTHROUGH IS THE LOAD-BEARING HALF. `isCoachNavItemVisible` switches on the DISPLAY
   * LABEL over `default: return true`, so any surface still asking by the old name would fall
   * through and hand an ungranted assistant the door. The Email families / Announcements precedent.
   */
  it('the retired label keeps gating rather than falling through to `true`', () => {
    assert.equal(
      isCoachNavItemVisible(assistant(NOTHING), 'Development'), false,
      'the old label lost its case and now falls through to `default: return true` — a helper '
      + 'asking for "Development" by its retired name would be handed the workbench.',
    );
  });
});

// ── 3 · The address layer ───────────────────────────────────────────────────
describe('one way to address a tab', () => {
  const base = '/riverdale/coaches/teams/team-1';

  it('every tab has an href, and the Dashboard is the absence of one', () => {
    const sections: CoachInsightsSection[] = [
      'results', 'attendance', 'playing-time', 'development', 'awards', 'scouting',
    ];
    for (const s of sections) {
      assert.equal(insightsSectionHref(base, s), `${base}/history?section=${s}`);
    }
    assert.equal(insightsDashboardHref(base), `${base}/history`);
  });

  /**
   * ⚠ The folder is `opponents` and the tab is `scouting`, by owner decision — the report is named
   * for what it is, and its drill-in book kept its route. One mapping, one home: a second copy is
   * how a bookmark to the scouting list starts landing on the Dashboard.
   */
  it('a retired report address maps to its tab, including the one that renamed', () => {
    assert.equal(legacyInsightsSection('opponents'), 'scouting');
    for (const seg of ['results', 'attendance', 'playing-time', 'development', 'awards']) {
      assert.equal(legacyInsightsSection(seg), seg);
    }
    assert.equal(legacyInsightsSection('nonsense'), null);
    assert.equal(legacyInsightsSection(null), null);
  });

  /**
   * ⚠⚠ **EVERY REDIRECT STUB PASSES ITS OWN FOLDER NAME, so the mapping above is LOAD-BEARING.**
   *
   * The first build had each stub hard-code its section id, which left `legacyInsightsSection` with
   * no caller at all — dead code that this file's own test above declared to be "the one home" for
   * the rule. Five of the six names are identical either way, so nothing would ever have shown the
   * gap; `opponents` → `scouting` is the one that differs, and renaming the tab in the "authoritative"
   * place would have left a years-old bookmark landing silently on the Dashboard with this suite
   * still green. A comment claiming a single source of truth is not one.
   */
  it('each retired route hands the factory its FOLDER name, not a tab id', () => {
    const stubs: [string[], CoachInsightsSection][] = [
      [['history', 'results'], 'results'],
      [['history', 'playing-time'], 'playing-time'],
      [['history', 'development'], 'development'],
      [['history', 'awards'], 'awards'],
      [['history', 'opponents'], 'scouting'],
      [['attendance'], 'attendance'],
    ];
    for (const [seg, expected] of stubs) {
      const src = readFileSync(join(COACH_PAGES, ...seg, 'page.tsx'), 'utf8');
      const arg = src.match(/insightsLegacyRedirectPage\('([^']+)'\)/)?.[1];
      assert.ok(arg, `${seg.join('/')}/page.tsx must export the shared redirect factory`);
      assert.equal(
        arg, seg[seg.length - 1],
        `${seg.join('/')} passes '${arg}' — it must pass its own folder segment, so the folder→tab `
        + 'mapping stays in one place instead of being hand-copied into six stubs.',
      );
      assert.equal(
        legacyInsightsSection(arg!), expected,
        `the mapping must still resolve '${arg}' to the '${expected}' tab.`,
      );
    }
  });

  /**
   * ⚠ NO SEASON PARAMETER, EVER. The portal is live-season-only by construction — a team with no
   * live season is redirected to its closed-season page before any of this mounts — so an href
   * builder that could carry a year would be the first step back to the archive-as-a-place the
   * owner deleted. (The Money equivalent takes a `carryQuery` for a reason that does not apply here.)
   */
  it('no href builder can carry a year', () => {
    const src = readFileSync(join(process.cwd(), 'lib', 'coach-insights-links.ts'), 'utf8');
    assert.equal(
      /year/i.test(src.replace(/\/\*[\s\S]*?\*\//g, '')), false,
      'the Insights address layer learned about a year. That is a decision, not a refactor — see '
      + 'tests/unit/coach-history-endpoint-guard.test.ts.',
    );
  });
});

// ── 4 · The portal's shape ──────────────────────────────────────────────────
describe('a tab is a report’s only entry point, so the hub must render all of them', () => {
  const TABS: [CoachInsightsSection, string][] = [
    ['results', 'Results'],
    ['attendance', 'Attendance'],
    ['playing-time', 'Playing Time'],
    ['development', 'Development'],
    ['awards', 'Awards'],
    ['scouting', 'Scouting Book'],
  ];

  it('every report has a tab AND a mounted panel', () => {
    for (const [id, label] of TABS) {
      assert.ok(
        HUB.includes(`label: '${label}'`),
        `the ${label} tab is missing from the tab row — its report has no other entry point.`,
      );
      assert.match(
        HUB, new RegExp(`\\{ id: '${id}', Component: \\w+Panel \\}`),
        `${id} has no entry in PANELS: its tab would render an empty pane, and the row would still `
        + 'look correct.',
      );
    }
  });

  /**
   * ⚠ Panels STAY MOUNTED once visited (`display:none` while inactive) — that is what makes
   * switching tabs free rather than a refetch, and what keeps a filter chip a coach set on Results
   * still set when they come back. Unmounting inactive panels looks like a tidy-up and silently
   * costs every tab switch a network round trip.
   */
  it('visited panels stay mounted rather than unmounting on a tab switch', () => {
    assert.match(
      HUB, /display: effectiveSection === id \? 'block' : 'none'/,
      'panels must be hidden, not unmounted, once visited.',
    );
    assert.match(
      HUB, /new Set\(\['dashboard', effectiveSection\]\)/,
      'the visited set must be SEEDED with the section a coach LANDS on. Seeding only the first tab '
      + 'leaves a direct link to any other tab rendering a blank pane, because the change-detection '
      + 'guard fires on a change after mount and never on mount itself.',
    );
  });

  /**
   * ⚠ A tab a coach's grants don't open must not strand them. They can arrive from an old bookmark
   * or a link sent by a coach with more access; a tab row with no active tab and nothing under it
   * reads as a broken page.
   */
  it('an ungranted section falls back to the Dashboard instead of dead-ending', () => {
    assert.match(
      HUB, /visibleIds\.has\(activeSection\) \? activeSection : 'dashboard'/,
      'the hub must fall back to the Dashboard for a section this coach has no tab for.',
    );
  });

  /**
   * ⚠⚠ **A PANEL THAT STAYS MOUNTED MUST GUARD ITS WRITES AGAINST A SUPERSEDED RUN.**
   *
   * A coach switches teams without this hub unmounting, and panels are hidden with `display:none`
   * rather than unmounted — so a slow response for the previous team can land while a different
   * team is on screen. The failure is not a wrong number; it is that a stale run stamps its own
   * "loaded for" key, the render guard then reads a mismatch, and the panel falls back to its
   * loading state FOREVER because nothing in its effect deps has changed.
   *
   * ⚠ Playing Time shipped without this and the gap only became reachable in ordinary use when it
   * stopped being a page: leaving a page unmounted it and reset the state, and a panel has no such
   * escape. Every panel that keys a render on a team is checked here rather than one.
   */
  it('every panel that guards its paint on a team also guards its writes', () => {
    for (const seg of [
      ['history', 'results', 'panel.tsx'],
      ['history', 'playing-time', 'panel.tsx'],
      ['history', 'awards', 'panel.tsx'],
    ]) {
      const src = readFileSync(join(COACH_PAGES, ...seg), 'utf8');
      if (!/loadedFor/.test(src)) continue;
      assert.match(
        src, /isStale\(\)|runRef\.current !== myRun|cancelled/,
        `${seg.join('/')} keys its render on a team ("loadedFor") but writes that key with no `
        + 'staleness check. A superseded run stamps the wrong team and strands the panel on its '
        + 'loading state permanently — panels stay mounted, so there is no unmount to recover it.',
      );
    }
  });
});

// ── 5 · No money, structurally ──────────────────────────────────────────────
describe('no money anywhere in Insights', () => {
  /**
   * ⚠⚠ THE FETCH IS THE GATE, NOT THE RENDER. A tile hidden over a request still made is how a
   * money figure leaks into a finding: `computeInsightFindings` fires its money rules only when a
   * `dues` summary is passed, so NOT ASKING is what makes this structural. The engine keeps those
   * rules as registry entries, but since 2026-08-28 they have NO supplier: the Sunday "week in
   * review" push — formerly the second consumer (owner 2026-08-19) — dropped money by owner
   * reversal 2026-08-28, the same way this page did.
   */
  it('the hub never asks for dues, and never passes them to the findings engine', () => {
    const hubCode = HUB.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
    assert.equal(
      /['"`]\/dues['"`]|summarizeDuesForFindings/.test(hubCode), false,
      'the Insights hub reads dues again. Money left this portal by owner ruling; its homes are the '
      + 'team Overview and the Money hub.',
    );
    assert.equal(
      /\bdues:/.test(hubCode), false,
      'the hub passes a `dues` input to computeInsightFindings — which is the one thing that would '
      + 'let a money finding render here.',
    );
  });

  it('the Sunday digest job never asks for dues either (owner 2026-08-28)', () => {
    const digestSrc = readFileSync(join(process.cwd(), 'lib', 'insights-digest.ts'), 'utf8');
    const digestCode = digestSrc.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
    assert.equal(
      /summarizeDuesForFindings|getRepPlayerDuesSchedules|getRepDues\w+ByProgramYear|getRepDuesInstallmentsBySchedules/.test(digestCode), false,
      'the weekly digest fetches or shapes dues again. Money left this push by owner decision '
      + '2026-08-28 (reversing 2026-08-19); the fetch is the gate here exactly as on the hub.',
    );
    assert.equal(
      /\bdues:/.test(digestCode), false,
      'the digest passes a `dues` input to computeInsightFindings — the one thing that would let '
      + 'a money sentence reach a push notification.',
    );
  });

  it('nothing under the Insights tree renders a money figure', () => {
    const surfaces = [
      ['history', 'page.tsx'],
      ['history', 'results', 'panel.tsx'],
      ['history', 'attendance', 'panel.tsx'],
      ['history', 'playing-time', 'panel.tsx'],
      ['history', 'development', 'panel.tsx'],
      ['history', 'awards', 'panel.tsx'],
      ['history', 'opponents', 'panel.tsx'],
    ];
    for (const seg of surfaces) {
      const src = readFileSync(join(COACH_PAGES, ...seg), 'utf8')
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/^\s*\/\/.*$/gm, '');
      assert.equal(
        /duesCollected|duesOutstanding|totalExpenses|fmtMoney|duesPct/.test(src), false,
        `${seg.join('/')} renders a money figure. Insights is player and team statistics for `
        + 'coaches; every money surface lives on the team Overview or in the Money hub.',
      );
    }
  });

  /**
   * ⚠ A findings link may still name `money` — the engine's type keeps that member for the digest —
   * but it must point OUT of the portal. A `?section=money` would be a tab that does not exist.
   */
  it('a money finding, if one ever arrived, leaves the portal rather than naming a tab', () => {
    assert.match(
      HUB, /money:\s*\{ label: 'Money',\s*href: `\$\{base\}\/accounting` \}/,
      'the findings link map must send a money finding to the Money hub.',
    );
  });
});
