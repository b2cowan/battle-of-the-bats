import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { eventSwitchLine, eventTileSource } from '../../lib/admin-event-cell.ts';
import { readCode, readSource } from './_source-code.ts';

/**
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * THE EVENT HEADS ITS SIDEBAR (navigation Phase 2 Part A; owner rulings E1, E10, E12 (2), E14, T3–T6, 2026-11-09/10)
 *
 *   1. The tile's picture: the event's logo, else the organization's, else initials — a badly shaped EVENT logo
 *      falls to the event's initials, never the organization's logo (T5).
 *   2. One set of state words: the list's second line reads the phase words, never "Active" (E12 (2)).
 *   3. The shape is stored with the event's logo (mig 460) and travels to the first paint.
 *   4. The sidebar: the native <select> and the strip tile are gone; the whole cell opens the list; nothing folds.
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 */
const ORG = { logoUrl: 'https://x/org.png', logoAspect: 1 };

describe('eventTileSource — E10 + T5', () => {
  it('the event’s own logo and its own shape first', () => {
    assert.deepEqual(eventTileSource({ logoUrl: 'https://x/ev.png', logoAspect: 1.2 }, ORG), { source: 'https://x/ev.png', aspect: 1.2 });
  });
  it('a too-wide or unmeasured event logo stays the source — the tile then shows the EVENT’s initials, never the org’s logo (T5)', () => {
    assert.deepEqual(eventTileSource({ logoUrl: 'https://x/ev.png', logoAspect: 4 }, ORG), { source: 'https://x/ev.png', aspect: 4 });
    assert.deepEqual(eventTileSource({ logoUrl: 'https://x/ev.png', logoAspect: null }, ORG), { source: 'https://x/ev.png', aspect: null });
  });
  it('no event logo → the organization’s logo with ITS shape', () => {
    assert.deepEqual(eventTileSource({ logoUrl: null, logoAspect: null }, ORG), { source: 'https://x/org.png', aspect: 1 });
  });
  it('no logo anywhere → nothing (the initials)', () => {
    assert.deepEqual(eventTileSource({}, { logoUrl: undefined }), { source: null, aspect: null });
    assert.deepEqual(eventTileSource({}, null), { source: null, aspect: null });
  });
});

describe('eventSwitchLine — the dates and the phase word (T3, E12 (2))', () => {
  const today = '2026-11-02';
  it('an active event on its dates is on game day', () => {
    assert.equal(eventSwitchLine({ status: 'active', startDate: '2026-11-01', endDate: '2026-11-03' }, today), 'Nov 1–3, 2026 · Game day');
  });
  it('an active event before its dates is Open — never "Active"', () => {
    const line = eventSwitchLine({ status: 'active', startDate: '2026-12-12', endDate: '2026-12-14' }, today);
    assert.equal(line, 'Dec 12–14, 2026 · Open');
    assert.doesNotMatch(line, /Active/);
  });
  it('draft and completed read their phase words', () => {
    assert.match(eventSwitchLine({ status: 'draft', startDate: '2027-05-14', endDate: '2027-05-16' }, today), / · Draft$/);
    assert.match(eventSwitchLine({ status: 'completed', startDate: '2026-05-22', endDate: '2026-05-24' }, today), / · Completed$/);
  });
  it('an event with no dates says its phase alone', () => {
    assert.equal(eventSwitchLine({ status: 'draft' }, today), 'Draft');
  });
});

describe('the event logo’s shape is stored with the logo (mig 460)', () => {
  it('the upload measures it and the removal clears it', () => {
    const route = readSource('app/api/admin/tournament-logo/route.ts');
    assert.match(route, /const \[\{ error: uploadError \}, logoAspect\] = await Promise\.all\(\[[\s\S]*?measureLogoAspect\(bytes\),\s*\]\);/);
    assert.match(route, /\.update\(\{ logo_url: logoUrl, logo_aspect: logoAspect \}\)/);
    assert.match(route, /\.update\(\{ logo_url: null, logo_aspect: null \}\)/);
  });
  it('the clone and "reuse a setup" copy it only with the logo', () => {
    const db = readSource('lib/db.ts');
    assert.match(db, /tournamentInsert\.logo_aspect = source\.logo_aspect \?\? null;/);
    assert.match(db, /if \('logo_url' in patch\) patch\.logo_aspect = source\.logo_aspect \?\? null;/);
  });
  it('the provider maps it, so the server-seeded event carries it on the first paint', () => {
    const ctx = readSource('lib/tournament-context.tsx');
    assert.match(ctx, /logoAspect: {5}r\.logo_aspect \?\? null,/);
    assert.match(ctx, /logoUrl: {8}r\.logo_url \?\? null,/);
  });
});

describe('the event’s sidebar (E1, E14, T3, T6)', () => {
  const rail = readCode('components/admin/kit/AdminKitRail.tsx');
  it('no native <select> and no strip tile on the desktop sidebar', () => {
    assert.doesNotMatch(rail, /<select\b|admin-tournament-select|SidebarStripTile|StripMenuButton/);
  });
  it('the whole cell is ONE button that opens the list; the chevron is inside it', () => {
    const cell = rail.slice(rail.indexOf('function EventCell('), rail.indexOf('export default function AdminKitRail('));
    assert.match(cell, /<button[\s\S]*aria-haspopup="menu"[\s\S]*<ChevronDown size=\{16\}[\s\S]*<\/button>/);
    assert.match(cell, /eventTileSource\(currentTournament, currentOrg\)/);
    assert.match(cell, /line: eventSwitchLine\(t\)/);
  });
  it('nothing folds: the tournament headings are labels, and the stored fold choice is gone', () => {
    const tour = rail.slice(rail.indexOf('function TournamentRail('));
    assert.doesNotMatch(tour, /groupHeader|aria-expanded|toggleGroup|fl_nav_groups|foldedGroup/);
    assert.match(tour, /<div className=\{styles\.label\}>\{g\.label\}<\/div>/);
  });
  it('the list is the standard two-line dropdown row, 320 wide, with "All tournaments" at its foot', () => {
    const menu = readCode('components/admin/kit/EventSwitchMenu.tsx');
    assert.match(menu, /const WIDTH = 320;/);
    assert.match(menu, /coachKit\.convWhatList/);
    assert.match(menu, /coachKit\.convWhatOpt/);
    assert.match(menu, /coachKit\.convWhatOptSub/);
    assert.match(menu, /All tournaments/);
    assert.match(menu, /rovingMenuKey\(e, /);
    assert.doesNotMatch(menu, /STATUS_WORD/);
  });
});
