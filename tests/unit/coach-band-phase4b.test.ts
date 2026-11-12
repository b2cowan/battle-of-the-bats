import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readCode } from './_source-code.ts';
import { coachBandAt } from '../../lib/coach-team-nav.ts';

/**
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * NAVIGATION PHASE 4b — THE COACHES PORTAL'S TABS PINNED UNDER THE STRIP (owner rulings R1, R2, R4, R5, R6, 2026-11-11).
 * What this pins:
 *   1. the band is reserved by the ADDRESS, for exactly the five rooms that have tab bars (never a drill-in, never the player page);
 *   2. the band's height has ONE declaration and is read by everything that docks under the strip;
 *   3. every coach tab bar named in R5 sets `band`, the player page sets `sticky`, and no coach page uses the club's `inBar`;
 *   4. the phone keeps its tab row in the page (the band is display:none and its height 0 at 900 and below).
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 */
const BASE = '/falcons/coaches/teams/t1';
const T = 'app/[orgSlug]/coaches/teams/[teamId]/';

describe('the band is reserved by the address (R1, R5)', () => {
  it('the five tabbed rooms have a band; nothing else does', () => {
    for (const room of ['accounting', 'history', 'development', 'lineups', 'practice']) {
      assert.equal(coachBandAt(`${BASE}/${room}`, BASE), true, room);
      assert.equal(coachBandAt(`${BASE}/${room}/`, BASE), true, `${room}/`);
    }
    // One level down is a record, not a room: no tabs, no band (the strip carries the way back).
    for (const p of ['practice/ev1', 'practice/templates/t9', 'lineups/ev1', 'lineups/templates/t9', 'history/opponents/x', 'development/sessions/s1',
      'roster', 'roster/p1', 'schedule', 'tryouts', 'documents', 'settings', 'season-end', '']) {
      assert.equal(coachBandAt(`${BASE}/${p}`, BASE), false, p);
    }
    assert.equal(coachBandAt('/falcons/coaches/billing', BASE), false);
    assert.equal(coachBandAt('/other/coaches/teams/t2/accounting', BASE), false, 'only the team in the address');
  });
});

describe('one height, read everywhere it must be (R4)', () => {
  const css = readCode('app/[orgSlug]/coaches/coaches.module.css');
  // ⚖ AT EVERY WIDTH since navigation Phase 5 (F4, owner 2026-11-12 — R6's "the phone follows with the same rule"): a phone's
  // tab row pins under the bar, and what docks under it adds the same one height. The SLOT stays a computer's only.
  it('the band height is declared once, at 45px, at every width: 0 on a page without tabs; the slot is a computer’s only', () => {
    assert.equal((css.match(/--coach-band-h:\s*45px/g) ?? []).length, 1);
    assert.match(css, /--coach-band-h: 0px;\s*display: flex;/, 'zero by default on the shell');
    const at = css.indexOf('.coachesShell[data-coach-band] { --coach-band-h: 45px; }');
    assert.ok(at > 0);
    assert.match(css.slice(at), /^\.coachesShell\[data-coach-band\] \{ --coach-band-h: 45px; \}\n\n@media \(min-width: 901px\) \{/, 'outside any width block, directly before the computer’s slot');
    assert.match(css.slice(at), /\.bandSlot \{\s*position: sticky;\s*top: var\(--coach-topstrip-top, 0px\);[\s\S]*?height: var\(--coach-band-h\);/);
    assert.doesNotMatch(css, /\.coachesShell\[data-coach-band\] \{ --coach-band-h: 0px; \}/, 'nothing resets it per width');
  });
  it('the register and the section deep-link margin dock under the band; --coach-header-h is not redefined', () => {
    const panel = readCode(`${T}accounting/expenses/panel.tsx`);
    assert.match(panel, /const registerStickyBase = 'calc\(var\(--coach-topstrip-top, 0px\) \+ var\(--coach-header-h, 0px\) \+ var\(--coach-band-h, 0px\)\)';/);
    assert.match(css, /scroll-margin-top: calc\(var\(--coach-topstrip-top, 0px\) \+ var\(--coach-header-h, 0px\) \+ var\(--coach-band-h, 0px\) \+ 0\.5rem\);/);
    assert.doesNotMatch(css, /--coach-header-h:\s*[^;]*coach-band-h/, 'the team bar’s own height is never folded into');
  });
  it('the shell holds the band by address and keeps focus out from under it', () => {
    const chrome = readCode('components/coaches/CoachesChrome.tsx');
    assert.match(chrome, /coachBandAt\(pathname, `\/\$\{orgSlug\}\/coaches\/teams\/\$\{teamId\}`\)/);
    assert.match(chrome, /data-coach-band=\{bandOn \? '' : undefined\}/);
    assert.match(chrome, /<div ref=\{setBandEl\} className=\{styles\.bandSlot\} \/>/);
    assert.match(chrome, /scrollPaddingTop/, 'keyboard focus never lands under the stack');
  });
});

describe('which tab bars wear the band (R5)', () => {
  const bar = readCode('components/shared/HubTabBar.tsx');
  it('the band is a new opt-in prop, not the club’s inBar, and renders once (portal or in place)', () => {
    assert.match(bar, /band\?: boolean;/);
    assert.match(bar, /const dock = band && desktop \? bandSlot\?\.el : null;/);
    assert.match(bar, /return dock \? createPortal\(bar, dock\) : bar;/);
    // Docking REBUILDS the <nav> (inline row -> portal), so the measuring effect and the active-tab scroll must key on where it docks.
    assert.match(bar, /\}, \[tabsKey, remeasureKey, dock\]\);/);
    assert.match(bar, /useActiveTabInView\(barRef, 48, \[activeId, tabsKey, remeasureKey, dock\]\);/);
    assert.ok(bar.indexOf('const dock = band && desktop') < bar.indexOf('const tabsKey'), 'the dock is known before the effects that key on it');
    assert.match(bar, /useBandEmptyReport\(bandSlot, !!band, tabs\.length < 2\);/, 'a bar of one tab gives the band back');
  });
  it('Money, Insights, Skills & goals, Lineups and Practice plans set band; the player page docks with sticky', () => {
    assert.match(readCode(`${T}accounting/page.tsx`), /ariaLabel="Money"[\s\S]{0,900}?\n\s+band\n/);
    assert.match(readCode(`${T}history/page.tsx`), /ariaLabel="Reports"\n\s+band\n/);
    assert.match(readCode(`${T}development/page.tsx`), /ariaLabel="Skills and Goals views" band \/>/);
    assert.match(readCode(`${T}lineups/_LineupsTabs.tsx`), /ariaLabel="Lineups views" band \/>/);
    assert.match(readCode(`${T}practice/_PracticePlansTabs.tsx`), /ariaLabel="Practice plans views" band \/>/);
    assert.match(readCode(`${T}roster/[playerId]/page.tsx`), /ariaLabel="Player record"[\s\S]{0,260}?\n\s+sticky\n/);
    assert.doesNotMatch(readCode(`${T}roster/[playerId]/page.tsx`), /<HubTabBar[^>]*\bband\b/);
  });
  it('no coach page uses the club’s in-bar row, and the club’s bar is not handed a coach band', () => {
    for (const f of ['accounting/page.tsx', 'history/page.tsx', 'development/page.tsx', 'lineups/_LineupsTabs.tsx', 'practice/_PracticePlansTabs.tsx', 'roster/[playerId]/page.tsx']) {
      assert.doesNotMatch(readCode(`${T}${f}`), /<HubTabBar[^>]*\binBar\b/, f);
    }
    assert.doesNotMatch(readCode('components/admin/AdminEventHeader.tsx'), /\bband\b[^=]*HubTabBar|<HubTabBar[^>]*\bband\b/);
  });
  it('the docked band is above 900; below it the in-page row pins under the bar (Phase 5, F4) — only where a shell marked a band', () => {
    const css = readCode('components/shared/HubTabBar.module.css');
    const block = css.slice(css.lastIndexOf('@media (min-width: 901px)'));
    assert.match(block, /@media \(min-width: 901px\) \{\s*\.bandDocked \{/);
    assert.match(block, /:global\(\[data-coach-band\]\) \.bandPending \{ display: none; \}/);
    const phone = css.slice(css.lastIndexOf('@media (max-width: 900px)'));
    assert.match(phone, /@media \(max-width: 900px\) \{\s*:global\(\[data-coach-band\]\) \.bandPending \{\s*position: sticky;\s*top: calc\(var\(--coach-topstrip-top, 0px\) \+ var\(--coach-header-h, 0px\)\);/,
      'the phone’s row pins directly under the bar, by the bar’s own published height');
    assert.match(phone, /height: var\(--coach-band-h, 45px\);/, 'the one height everything docking under it adds');
    assert.doesNotMatch(css, /NEVER STICKY|never sticky \(reversed/i, 'the 2026-08-19 note is superseded and gone');
  });
});

/**
 * THE PAGE'S "?" LIVES IN THE STRIP, BESIDE THE BELL (owner 2026-11-12; reverses the 2026-07-31 "not CoachTopStrip" boundary on purpose).
 * One publisher (the page header), two ends: the phone's team bar (where it STAYS — navigation Phase 5, F3 A, owner 2026-11-12,
 * replacing the 4b record's "moves to the More sheet" on purpose) and the strip above 900. A page outside the team layout still
 * draws its own.
 */
describe('the "?" in the strip (owner 2026-11-12)', () => {
  const slot = readCode('components/coaches/CoachPageHelpSlot.tsx');
  const header = readCode('components/coaches/CoachPageHeader.tsx');
  const strip = readCode('components/coaches/CoachTopStrip.tsx');
  const css = readCode('app/[orgSlug]/coaches/coaches.module.css');

  it('ONE entry, held by the shell’s provider; the team layout’s provider only marks a page hosted; the default stays unhosted', () => {
    assert.match(slot, /export function CoachStripHelpProvider\(/);
    assert.match(slot, /const publish = useContext\(StripHelpPublishContext\);/);
    assert.match(slot, /hosted: !!publish/, 'no shell above it means unhosted: every header keeps its own "?"');
    assert.equal((slot.match(/useState<Entry>/g) ?? []).length, 1, 'one state machine, not two');
    assert.match(slot, /prev\?\.id === id \? null : prev/, 'clearing only while the entry is still the publisher’s');
    assert.ok(slot.includes('hosted: false'), 'the fallback is the default context value');
    assert.match(slot, /export function CoachPageHelpSlot\(\{ reserve = false \}: \{ reserve\?: boolean \} = \{\}\) \{\s*const entry = useContext\(StripHelpEntryContext\);/, 'the phone’s bar reads the same entry');
    assert.match(readCode('components/coaches/CoachesChrome.tsx'), /<CoachStripHelpProvider>[\s\S]*<\/CoachStripHelpProvider>/);
  });

  it('the strip draws it between the bell and the account menu, never on a wall or the free portal', () => {
    assert.match(strip, /\{!wall && !free && <CoachStripHelp reserve=\{split\} \/>\}/, 'a team page holds the door’s width so the bell does not slide');
    const at = strip.indexOf('<CoachStripHelp ');
    assert.ok(at > strip.indexOf('<NotificationBell') && at < strip.indexOf('<AccountMenu'), 'after the bell, before the account menu');
    assert.equal((strip.match(/<CoachStripHelp /g) ?? []).length, 1);
  });

  it('a hosted "?" is never the row’s at any width; an unhosted page keeps drawing its own', () => {
    assert.match(header, /const helpOnRow = showHelp && !helpHosted;/);
    assert.match(header, /\{helpOnRow && \(\s*<span className=\{styles\.pageHeaderHelp\}>/, 'the own-"?" fallback survives: drawn only when unhosted, never rendered-and-hidden');
    assert.doesNotMatch(css, /pageHeaderHelpDesk/, 'the hide-it class is gone');
    // The phone’s own end: the team bar draws the published "?" (F3 A), holding its width until it arrives.
    assert.ok(readCode('components/coaches/CoachTeamHeader.tsx').includes('<CoachPageHelpSlot reserve />'));
  });
});

describe('a header whose actions are a phone’s only draws no row above 900 (Schedule)', () => {
  it('the prop exists, feeds the computer’s row only, and Schedule sets it', () => {
    const header = readCode('components/coaches/CoachPageHeader.tsx');
    assert.match(header, /actionsPhoneOnly\?: boolean;/);
    assert.match(header, /const deskRowHas = \(!!actions && !actionsPhoneOnly\) \|\| helpOnRow;/);
    assert.match(header, /deskRowHas \? 'actions' : 'empty'/);
    assert.match(readCode('app/[orgSlug]/coaches/teams/[teamId]/schedule/page.tsx'), /actionsPhoneInTitleRow\s*\n\s*actionsPhoneOnly\n/);
  });
});
