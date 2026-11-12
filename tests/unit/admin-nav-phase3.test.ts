/**
 * Navigation Phase 3 — the tournament phone (owner rulings E5 + R1–R4, 2026-11-11; plan
 * `docs/projects/active/ADMIN_NAV_EVALUATION_PLAN.md` §5 Phase 3; drawings tab 6 and tab 16 "Phase 3 gate").
 *
 *   1. ONE rule names the page at both widths: the strip (a computer), the phone bar and every page header read `useDeskTitle`,
 *      and the paper title's hide carries no breakpoint.
 *   2. The bar's small line is the event DOOR (R1: name · chip · chevron, no dates; R4: one 44px target over the name and the
 *      line, so the bar keeps its height), on the event's own pages only (R3: the organization's screens have no event line).
 *   3. The event list is ONE list at both widths (`eventSwitchRows` → `EventSwitchItems`), the logo tile leading every row
 *      (R2 widened by the owner to the computer's list too), in the portal's sheet frame on a phone.
 *   4. The More sheet has no tournament picker.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { eventSwitchRows } from '../../lib/admin-event-cell.ts';
import { readCode, readSource } from './_source-code.ts';

const bar = readCode('components/admin/AdminEventHeader.tsx');
const barCss = readCode('components/admin/kit/AdminKitEventHeader.module.css');
const sheet = readCode('components/admin/kit/AdminEventSwitchSheet.tsx');
const menu = readCode('components/admin/kit/EventSwitchMenu.tsx');
const more = readCode('components/admin/kit/AdminKitBottomNav.tsx');

describe('Phase 3 · one rule names the page at both widths (E5)', () => {
  it('the strip, the phone bar and every page header read the one answer', () => {
    for (const f of ['components/admin/AdminTopStrip.tsx', 'components/admin/AdminEventHeader.tsx', 'components/admin/AdminPageHeader.tsx']) {
      assert.match(readCode(f), /useDeskTitle\(\)/, `${f} reads the one answer`);
    }
    assert.match(bar, /const deskTitle = useDeskTitle\(\);/);
    assert.doesNotMatch(bar, /deskTitleAt\(/, 'the bar never derives it a second time');
  });
  it('the paper title steps aside with no breakpoint, last in its sheet', () => {
    const css = readCode('components/admin/AdminPageHeader.module.css');
    const at = css.indexOf(".header[data-desk-named] .left { display: none; }");
    assert.ok(at > 0);
    assert.ok(at > css.lastIndexOf('@media'), 'after every media block, so it outranks the phone rules at equal weight');
  });
  it('the bar never reads a width (no first-paint swap); the sheet, a client mount, closes itself past 900px', () => {
    assert.doesNotMatch(bar, /matchMedia|innerWidth|useMediaQuery/);
    assert.match(sheet, /const phone = useIsPhoneNav\(\);\s*useEffect\(\(\) => \{ if \(!phone\) onClose\(\); \}, \[phone, onClose\]\);/);
    assert.match(sheet, /focusCurrentItem\(panelRef\.current\)/, 'opens on the event you are in, as the computer’s list does');
  });
});

describe('Phase 3 · the small line is the event door (R1, R3, R4, T6)', () => {
  const door = bar.slice(bar.indexOf('const eventDoor = onEvent && ('), bar.indexOf('const deskClass'));
  it('only on the event’s own pages, always a door while there is an event (T6)', () => {
    assert.ok(door.length > 0);
    assert.match(door, /aria-haspopup="menu"/);
    assert.match(door, /aria-expanded=\{sheetOpen\}/);
    assert.match(door, /aria-controls=\{sheetOpen \? ADMIN_EVENT_SHEET_ID : undefined\}/);
    assert.doesNotMatch(door, /tournaments\.length/, 'never hidden for a single event');
  });
  it('the event’s name rides the line only when the line above names the page', () => {
    assert.match(door, /\{deskTitle && <span className=\{styles\.doorName\}>\{title\}<\/span>\}/);
  });
  it('R4: one 44px target over the name and the line — the button’s own box reaches up over the name', () => {
    const door = barCss.slice(barCss.indexOf('.eventDoor {'), barCss.indexOf('}', barCss.indexOf('.eventDoor {')));
    assert.match(door, /position: relative;/, 'over the <h1> for a tap');
    assert.match(door, /margin: calc\(0\.12rem - 1\.65rem\) 0 -4px;/);
    assert.match(door, /padding: 1\.65rem 0 4px;/, 'the padding and the margin cancel: the bar keeps its height');
    assert.doesNotMatch(barCss, /\.eventDoor::before/);
    // Translucent: the pressed box lies OVER the page's name.
    assert.match(barCss, /\.eventDoor:active \{ background: color-mix\(in srgb, var\(--home-olive\) 10%, transparent\); \}/);
  });
  it('the chevron is always at the bar’s right end beside the globe, still inside the one door button (owner 2026-11-11)', () => {
    const chev = barCss.slice(barCss.indexOf('.doorChevron {'), barCss.indexOf('}', barCss.indexOf('.doorChevron {')));
    assert.match(chev, /position: absolute;/);
    assert.match(chev, /right: 0;/);
    assert.match(chev, /bottom: 4px;/, 'on the small line’s own row (bottom right), not floating between the two lines');
    assert.doesNotMatch(chev, /top:/);
    assert.match(barCss, /\.identity:has\(> \.eventDoor\) \{ padding-right: 1\.25rem; \}/, 'a gutter, so no name runs under the glyph');
    assert.match(barCss, /\.identity:has\(> \.eventDoor\) > \.eventDoor \{ width: calc\(100% \+ 1\.25rem\); padding-right: 1\.25rem; \}/, 'a tap on the glyph is a tap on the door, and the words and chip stop short of it');
    assert.match(door, /<ChevronDown size=\{14\} aria-hidden className=\{styles\.doorChevron\} \/>/);
  });
  it('R3: the organization’s screens draw no small line (no event is theirs)', () => {
    // The line is the door (event pages) or a place's facts; the dates and the chip are no longer place facts.
    assert.match(bar, /const hasMeta = Boolean\(facts\.length \|\| place\?\.detail \|\| place\?\.chip\);/);
  });
  it('the sheet is the bar’s sibling, opened only from a tap, shut on a new page', () => {
    assert.match(bar, /const sheetOpen = onEvent && sheetAt === pathname;/);
    assert.ok(bar.indexOf('</header>') < bar.indexOf('<AdminEventSwitchSheet'), 'outside the sticky header');
  });
});

describe('Phase 3 · one event list at both widths (R2, widened)', () => {
  const ORG = { logoUrl: 'https://x/org.png', logoAspect: 1 };
  const today = '2026-11-02';
  const events = [
    { id: 'a', name: 'Spring', status: 'completed', startDate: '2026-05-01', endDate: '2026-05-03', logoUrl: 'https://x/a.png', logoAspect: 1 },
    { id: 'b', name: 'Fall Classic', status: 'active', startDate: '2026-11-01', endDate: '2026-11-03', firstGameStarted: true },
    { id: 'c', name: 'Winter', status: 'draft', startDate: '2026-12-12', endDate: '2026-12-14', logoUrl: 'https://x/c.png', logoAspect: 5 },
  ];
  it('finished last, the dates · phase line, the current one marked, the cell’s tile rule on every row', () => {
    const rows = eventSwitchRows(events, 'b', ORG, today);
    assert.deepEqual(rows.map(r => r.id), ['b', 'c', 'a'], 'finished events sink to the foot');
    assert.deepEqual(rows.map(r => r.current), [true, false, false]);
    assert.match(rows[0].line, / · Game day$/);
    assert.deepEqual([rows[0].source, rows[0].aspect], ['https://x/org.png', 1], 'no logo of its own → the organization’s');
    assert.deepEqual([rows[1].source, rows[1].aspect], ['https://x/c.png', 5], 'a badly shaped logo stays its own (the tile shows its initials)');
    assert.deepEqual([rows[2].source, rows[2].aspect], ['https://x/a.png', 1]);
  });
  it('the sidebar’s menu and the phone’s sheet build their rows once and draw them with one component', () => {
    assert.match(readCode('components/admin/kit/AdminKitRail.tsx'), /eventSwitchRows\(tournaments, currentTournament\.id, currentOrg\)/);
    assert.match(sheet, /eventSwitchRows\(tournaments, currentTournament\?\.id, currentOrg\)/);
    assert.match(menu, /<EventSwitchItems rows=\{rows\} allHref=\{allHref\} onPick=\{onPick\} roving \/>/);
    assert.match(sheet, /<EventSwitchItems\b/);
    assert.match(menu, /<SidebarLogoTile source=\{row\.source\} aspect=\{row\.aspect\} name=\{row\.name\} size=\{24\} \/>/);
    assert.doesNotMatch(sheet, /eventSwitchLine|eventSwitchOrder|convWhatOpt/, 'no second copy of the rows');
  });
  it('the phone’s list wears the portal’s sheet frame in its menu layer, with no dismiss hook of its own', () => {
    assert.match(sheet, /<SheetFrame ref=\{panelRef\} label="Tournaments" onClose=\{onClose\} opener=\{opener\} role="menu"/);
    assert.doesNotMatch(sheet, /\bform\b=|useDismissable|useBackStep|useDialogFloor/);
    assert.match(sheet, /allHref=\{`\$\{base\}\/tournaments\/manage`\}/, '"All tournaments" opens the Tournaments list');
    assert.match(sheet, /if \(t\) setCurrentTournament\(t\);/, 'picking an event keeps you on the page');
    // The admin shell defines the bottom bar's clearance the frame stops at.
    assert.match(readCode('app/[orgSlug]/admin/admin.module.css'), /--coach-foot-clear:/);
  });
});

describe('Phase 3 · the More sheet has no tournament picker (N7 item 1)', () => {
  it('no <select>, no "Current tournament", no " - Live", no single-event span', () => {
    assert.doesNotMatch(more, /<select\b|admin-mob-tournament-select|Current tournament| - Live|switcherName|setCurrentTournament/);
  });
  it('the styles only the picker wore are gone', () => {
    assert.doesNotMatch(readCode('components/admin/kit/AdminKitFrame.module.css'), /\.switcher\b|\.switcherSelect\b|\.switcherName\b/);
  });
  it('the navigation standard says so', () => {
    const std = readSource('docs/agents/design/NAV_STANDARD.md');
    assert.doesNotMatch(std, /tournament picker \(until navigation Phase 3\)/);
    assert.match(std, /carries \*\*no event picker\*\* \(navigation Phase 3/);
  });
});
