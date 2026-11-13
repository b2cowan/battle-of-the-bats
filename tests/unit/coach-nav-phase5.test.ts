import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readCode, stripComments } from './_source-code.ts';
import { coachDeskTitleAt, coachDrillBack, coachNavGroupsFor } from '../../lib/coach-team-nav.ts';
import { resolveCoachCapabilities } from '../../lib/coach-capabilities.ts';

/**
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * NAVIGATION PHASE 5 — THE COACHES PORTAL ON A PHONE (owner rulings E8 and the gate's F1–F8, all A, 2026-11-12; drawings
 * https://claude.ai/artifact/Xej4haYGxUs7RtWWMTFbq2). What this pins:
 *   1. ONE rule names the page at both widths — the phone's bar reads the strip's own answer (`useCoachDeskTitle` →
 *      `coachDeskTitleAt`), never a copy; one level down it names the way back (F1); the game page is one level down (F7);
 *   2. one <h1> per width — the strip's above 900, the bar's at 900 and below (a named page), the paper title hidden at both;
 *   3. the team's small line speaks the strip's facts rule (F2), and with 2+ teams it is the door to Your teams;
 *   4. the "?" has ONE door per width: the bar's at 900 and below (F3 A), the strip's above; More → Help is the full guide;
 *   5. the band rooms' tab row docks in the phone's band under the bar, pinned by the one band height (F4; flush, 2026-11-12).
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 */

const BASE = '/falcons/coaches/teams/t1';
const none = new URLSearchParams();
const liveRows = coachNavGroupsFor(resolveCoachCapabilities('head_coach'), false).flatMap(g => g.items);
const bar = stripComments(readCode('components/coaches/CoachTeamHeader.tsx'));
const css = readCode('app/[orgSlug]/coaches/coaches.module.css');

describe('1. one rule names the page at both widths', () => {
  it('the phone’s bar reads the strip’s own answer — never a fourth copy of the rule', () => {
    assert.match(bar, /const \{ title: desk \} = useCoachDeskTitle\(\);/);
    assert.ok(!/coachDeskTitleAt|coachDrillBack|isCoachNavItemLit/.test(bar), 'the bar decides nothing about the name itself');
    assert.match(readCode('components/coaches/CoachTopStrip.tsx'), /useCoachDeskTitle\(\)/, 'the strip reads the same provider');
  });

  it('F1 (amended 2026-11-12): one level down the arrow is the ONLY back, and the bar names the RECORD — the page’s title moves into it', () => {
    assert.match(bar, /const back = desk\?\.kind === 'back' \? desk : null;/);
    assert.match(bar, /<Link href=\{back\.href\} className=\{styles\.teamBarBack\} aria-label=\{`Back to \$\{back\.label\}`\}>/);
    const header = readCode('components/coaches/CoachPageHeader.tsx');
    assert.ok(header.includes('<h1 className={styles.pageTitle}>{title}</h1>'), 'the page’s own title is still drawn until the bar’s slot exists');
    assert.match(css, /\n\.pageHeaderStd\[data-desk-drill\] \.pageHeaderBack,\n\.pageHeaderStd\[data-desk-drill\] \.pageHeaderBackRule \{ display: none; \}\n@media \(max-width: 900px\) \{\n  \.pageHeaderStd\[data-phone-row='empty'\] \{ display: none; \}/,
      'the header’s own arrow goes at every width (the chrome has it)');
    // The title is drawn in the bar, once, as a portal of the page’s own element — and NOT also in the page.
    assert.match(header, /const barNames = deskDrill && !!barSlot;/);
    assert.match(header, /\{barNames && <CoachBarName title=\{title\} chips=\{titleChips\} \/>\}/);
    // ⚖ Nor in the strip (navigation Phase 5b): one home per width, and a record still loading draws no title of its own.
    assert.match(header, /const titleAway = deskRecord \|\| barNames \|\| untitled;/);
    assert.match(header, /\{!titleAway && \(\s*<div className=\{styles\.pageTitleWrap\}>/, 'nothing is named twice');
    assert.match(header, /data-phone-record=\{barNames \|\| untitled \|\| undefined\}/);
    assert.match(css, /\.pageHeaderStd\[data-phone-record\] \.pageHeaderLeft \{ display: none; \}/);
    const name = readCode('components/coaches/CoachBarName.tsx');
    assert.match(name, /return phone && desk\?\.kind === 'back' \? barSlot : null;/, 'a phone, one level down, once the bar has mounted its slot');
    assert.match(name, /createPortal\(\s*<>\s*<h1 className=\{styles\.teamBarName\}>\{title\}<\/h1>\s*\{chips\}\s*<\/>,\s*slot,/);
  });

  it('the bar’s slot, its stand-in kind-of-place word, no arrow-destination text, and no team door over a record', () => {
    assert.match(bar, /<div ref=\{barSlotRef\} className=\{styles\.teamBarSlot\} \/>/);
    assert.match(bar, /<span className=\{`\$\{styles\.teamBarName\} \$\{styles\.teamBarHere\}`\}>\{back\.here\}<\/span>/, 'until a page names the record: the KIND of place, never the list left behind');
    assert.ok(!/\{back\.label\}/.test(bar.replace(/aria-label=\{`Back to \$\{back\.label\}`\}/, '')), 'the destination is the arrow’s spoken name only');
    assert.match(bar, /const canSwitch = isPhoneNav && desk\?\.kind !== 'back' && /, 'a team door laid over a player’s name button would cover it');
    assert.match(css, /\.teamBarSlot:not\(:empty\) \+ \.teamBarHere \{ display: none; \}/);
    assert.match(readCode('app/[orgSlug]/coaches/teams/[teamId]/game/[eventId]/page.tsx'), /<CoachBarName title=\{matchupTitle\} \/>/, 'the game console has no standard header: it fills the slot itself');
  });

  it('F7: the game page is one level down from the Schedule — back to this game on it — and carries no arrow of its own', () => {
    assert.deepEqual(coachDrillBack(`${BASE}/game/e1`, none, BASE), { href: `${BASE}/schedule?event=e1`, label: 'Schedule', here: 'Game' });
    assert.deepEqual(coachDeskTitleAt(`${BASE}/game/e1`, none, BASE, liveRows, null), { kind: 'back', href: `${BASE}/schedule?event=e1`, label: 'Schedule', here: 'Game' });
    const game = stripComments(readCode('app/[orgSlug]/coaches/teams/[teamId]/game/[eventId]/page.tsx'));
    assert.ok(!/gdBackBtn|styles\.gdBack\b|ArrowLeft/.test(game), 'one way back per screen: the console’s own arrow is gone');
    assert.ok(!/\.gdBack(Btn|Word)? \{/.test(css), 'and its styles with it');
  });
});

describe('2. one <h1> per width', () => {
  it('the bar’s name is the <h1> on a named page only, and the bar draws nothing above 900; the strip nothing at 900 and below', () => {
    assert.equal((bar.match(/<h1\b/g) ?? []).length, 1, 'one heading in the bar');
    assert.match(bar, /const name = named !== null\s*\? <h1 className=\{styles\.teamBarName\}>\{named\}<\/h1>\s*: back\s*\? \(/,
      'one level down (and on an address no row lights) the bar’s line is not a heading in this file: the record’s title, portaled into the slot, is');
    assert.match(css, /@media \(min-width: 901px\) \{\s*\.teamHeader \{ display: none; \}\s*\}/);
    assert.match(readCode('components/coaches/CoachTopStrip.module.css'), /@media \(max-width: 900px\) \{\s*\.strip \{\s*display: none;/);
  });

  it('the paper title hides at EVERY width on a named page, and a header with nothing to show on a phone draws nothing', () => {
    assert.match(css, /\n\.pageHeaderStd\[data-desk-named\] \.pageHeaderLeft \{ display: none; \}\n/);
    const header = readCode('components/coaches/CoachPageHeader.tsx');
    // Each width's own buttons: a tablet keeps the ones a phone drops (`actionsPhoneHidden` is a ≤640 rule) — /review 2026-11-12.
    assert.match(header, /const tabletRowHas = !!actions \|\| helpOnRow;\s*const phoneRowHas = \(!!actions && !actionsPhoneHidden\) \|\| helpOnRow;/);
    assert.match(header, /data-phone-row=\{deskNamed \|\| barNames \|\| untitled \? \(!tabletRowHas \? 'empty' : !phoneRowHas \? 'tablet' : undefined\) : undefined\}/);
    const tabletRule = css.indexOf(".pageHeaderStd[data-phone-row='tablet'] { display: none; }");
    assert.ok(tabletRule > 0);
    assert.match(css.slice(css.lastIndexOf('@media', tabletRule), tabletRule), /^@media \(max-width: 640px\) \{/,
      'a phone (≤640) drops the row its buttons left; a tablet keeps it');
    assert.match(css, /\.pageHeaderStd\[data-desk-named\] \.pageHeaderActions,\s*\.pageHeaderStd\[data-phone-record\] \.pageHeaderActions \{ grid-row: 1; \}/, 'no empty first grid row above the buttons — a named page’s, and a record whose title the bar holds');
  });
});

describe('3. the small line', () => {
  it('speaks the strip’s facts rule — one answer about the season at both widths', () => {
    assert.match(bar, /const facts = coachStripFacts\(\{/);
    assert.match(bar, /stripRecord\(records\[season\.programYearId\]\)/, 'the record in the strip’s words (none for 0-0)');
    assert.ok(!/mastheadSeasonLabel|formatRecord/.test(bar), 'no second spelling of a season or a record');
  });

  it('Draft at both widths; Game day and Complete as a phone’s chip (the tablet’s status says them); the dot never strands', () => {
    assert.match(bar, /\{facts\.state && <span className=\{chip\(styles\.seasonChip\)\}>\{facts\.state\}<\/span>\}/);
    assert.match(bar, /\{gameDay && <span className=\{chip\(styles\.teamHeaderToday\)\} data-phone-only>Game day<\/span>\}/);
    assert.match(bar, /\{seasonFinished && <span className=\{chip\(styles\.seasonChip\)\} data-phone-only>Complete<\/span>\}/);
    assert.ok(!/nextLabel|gameDayWho|mastheadWhen|eventWord/.test(bar), 'the tablet’s status is the facts rule’s words too, never rebuilt');
    assert.match(css, /\.teamBarWord\[data-lead-phone\]::before \{ content: none; margin: 0; \}/);
    assert.match(css, /\.teamBarWord:first-child::before \{ content: none; margin: 0; \}/);
  });

  it('with 2+ teams the line is the door: one 44px target over both lines, opening Your teams', () => {
    assert.match(bar, /className=\{`\$\{styles\.teamBarLine\} \$\{styles\.teamHeaderSwitch\}`\}/);
    const door = bar.slice(bar.indexOf('ref={switchButtonRef}'), bar.indexOf('</button>', bar.indexOf('ref={switchButtonRef}')));
    assert.ok(!/aria-label=/.test(door), 'named by its visible words (WCAG 2.5.3) — never an aria-label that drops the season’s facts');
    assert.ok(door.includes('<span className="sr-only">, switch team</span>'), 'then what it does');
    assert.match(css, /\.teamHeaderSwitch \{\s*position: relative;\s*appearance: none;\s*width: 100%;\s*margin: calc\(0\.12rem - 1\.65rem\) 0 -4px;\s*padding: 1\.65rem 0 4px;/,
      'the tournament phone’s R4 target, measure for measure');
  });

  it('the first paint knows the bar’s height, so a row pinned under it never starts under it', () => {
    assert.match(css, /\.coachesMain \{ --coach-bar-h: 53px; \}\n  \.teamHeader \{ min-height: var\(--coach-bar-h\); \}\n  \.coachesMain:has\(> \.teamHeader\) \{ --coach-header-h: var\(--coach-bar-h\); \}/,
      'one declared height: the bar’s floor and the first paint’s stand-in');
    assert.match(css, /\.coachesMain:has\(> \.teamHeaderPhoneChat\) \{ --coach-header-h: 0px; \}/);
  });
});

describe('4. the "?" has one door per width', () => {
  it('the bar keeps it at its right end (F3 A); the strip has it above 900; a hosted header never draws one', () => {
    assert.ok(bar.includes('<CoachPageHelpSlot reserve />'));
    assert.equal((bar.match(/<CoachPageHelpSlot\b/g) ?? []).length, 1);
    assert.match(readCode('components/coaches/CoachPageHeader.tsx'), /const helpOnRow = showHelp && !helpHosted;/);
  });

  it('More → Help stays the full guide in a new tab — a different door, not a second copy of the page’s', () => {
    const foot = readCode('components/coaches/MoreSheetFoot.tsx');
    assert.match(foot, /<Link className=\{styles\.dropItem\} href=\{helpHref\} role="menuitem" id=\{`\$\{idPrefix\}-help`\} target="_blank"/);
    assert.ok(!/openHelp|useHelpDrawer/.test(foot), 'the foot never opens the page’s panel');
  });
});

describe('5. the tab row docks flush under the bar on a phone and pins there (F4)', () => {
  it('one band height at every width, and the phone’s band is sticky by the bar’s own height', () => {
    assert.match(css, /\n\.coachesShell\[data-coach-band\] \{ --coach-band-h: 45px; \}\n/);
    const tabs = readCode('components/shared/HubTabBar.module.css');
    assert.match(css, /\.coachesShell\[data-coach-band\] \.bandSlotPhone \{\s*display: block;\s*position: sticky;/);
    assert.match(tabs, /\n\.bandDocked \{ margin: 0;/);
    assert.match(readCode('app/[orgSlug]/coaches/teams/[teamId]/accounting/expenses/panel.tsx'),
      /const registerStickyBase = 'calc\(var\(--coach-topstrip-top, 0px\) \+ var\(--coach-header-h, 0px\) \+ var\(--coach-band-h, 0px\)\)';/,
      'the register’s toolbar docks under the tabs');
  });
});
