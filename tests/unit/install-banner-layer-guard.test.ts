/**
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * THE INSTALL BANNER SITS UNDER EVERY SHEET (2026-10-06 — found by Notifications Open in Place step 3).
 *
 * "Install FieldLogicHQ" is a nudge, and a nudge never covers a surface someone opened. It sat at
 * `z-index: 400`: over every phone sheet in both portals (the menu layer 259/260, the bar's More at 300,
 * the form layer 390) and level with the windows (400), so until it was dismissed it hid the foot of every
 * sheet — on the coach's Notifications page, the reader's "Open the request". It is now one step under the
 * sheet dims, and still over the autosave pill and the docked bars it already covered.
 *
 * The layers are READ from the stylesheets that own them, never restated, so a sheet that moves down — or
 * a banner that creeps back up — fails here instead of on a phone.
 *
 * ⚠ What this does NOT cover (recorded with the fix): surfaces OUTSIDE the portals' sheet convention that
 * sit below 255 — the scorekeeper's and the gate's bottom sheets, chat's confirm windows, the tryout day
 * scrims, a coach window on a tablet (200 above 640px), the lineup builder's popovers on a tablet (60 above
 * 900px — on a phone they are drawers over the 259 dim, checked below), the public schedule's day jump. Raising each to the
 * sheet layer, or hiding the banner while a window is open, is its own decision.
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readSource, cssRule, stripComments } from './_source-code.ts';

/** Every `z-index` the rules named exactly `selector` declare, wherever they sit (a base rule and its
 *  phone override are often two rules), comments stripped so a number in a comment is never read. */
function layers(file: string, selector: string): number[] {
  const css = stripComments(readSource(file));
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const found: number[] = [];
  for (const m of css.matchAll(new RegExp(`(^|\\n)[ \\t]*${escaped}\\s*\\{`, 'g'))) {
    const z = cssRule(css.slice(m.index), selector).match(/z-index:\s*(\d+)\s*;/);
    if (z) found.push(Number(z[1]));
  }
  assert.ok(found.length > 0, `${file} ${selector} declares no z-index — the guard reads it`);
  return found;
}
/** Conservative reads: a surface that must cover the banner is judged by its LOWEST layer, one the
 *  banner must cover by its HIGHEST. */
const lowest = (file: string, sel: string) => Math.min(...layers(file, sel));
const highest = (file: string, sel: string) => Math.max(...layers(file, sel));

const BANNER = highest('components/InstallAppPrompt.module.css', '.banner');

describe('the install banner sits under every sheet and over the page chrome it nudges from', () => {
  it('under every surface someone opens in the portals, on a phone', () => {
    const opened: [string, string, string][] = [
      ['the portal sheet frame (menu layer)', 'components/coaches/SheetFrame.module.css', '.sheet'],
      ['the portal sheet frame (form layer)', 'components/coaches/SheetFrame.module.css', '.sheet.form'],
      // Sheet Frame step 4 (2026-10-06): the bar-anchored record sheets (the position picker, the notification
      // reader, the Award sheet — edited, the form layer above) stand on the frame, and RSVP over its window.
      ['the portal sheet frame (over a window — RSVP, the depth chart’s row menu)', 'components/coaches/SheetFrame.module.css', '.sheet.overWindow'],
      // The portal's only sheet dim since Sheet Frame step 5 (2026-10-06): the lineup builder's own
      // (`.lineupSheetScrim`) retired when its five drawers moved onto the frame.
      ['the portal sheet frame’s dim', 'components/coaches/SheetFrame.module.css', '.dim'],
      ['the bottom bar and its More sheet', 'components/coaches/CoachesBottomNav.module.css', '.bottomNav'],
      ['the RSVP dialog on a computer', 'components/coaches/CoachRsvpSheet.module.css', '.floor.floor'],
      ['the admin kit\'s windows', 'components/admin/kit/club/KitDialog.module.css', '.overlayQuestion'],
    ];
    const over = opened
      .map(([what, file, sel]) => ({ what, z: lowest(file, sel) }))
      .filter(({ z }) => z <= BANNER);
    assert.deepEqual(over, [], `the banner (${BANNER}) would cover: ${over.map(o => `${o.what} (${o.z})`).join(', ')}`);
  });

  it('a coach window on a phone covers it (the phone rule, not the 200 desktop base)', () => {
    const css = readSource('app/[orgSlug]/coaches/coaches.module.css');
    // The phone override `.modalOverlay { z-index: 400; }` inside the ≤640 block.
    assert.match(stripComments(css), /\.modalOverlay\s*\{\s*z-index:\s*400;\s*\}/);
    assert.ok(BANNER < 400);
  });

  it('over the autosave pill and the docked bars it already sat over (it is still a banner)', () => {
    const under: [string, string, string][] = [
      ['the coach autosave pill', 'app/[orgSlug]/coaches/coaches.module.css', '.savePill'],
      ['the tournament Teams bulk dock', 'app/[orgSlug]/admin/tournaments/registrations/teams-admin.module.css', '.bulkDock'],
    ];
    for (const [what, file, sel] of under) {
      const z = highest(file, sel);
      assert.ok(BANNER > z, `${what} (${z}) would now cover the banner (${BANNER})`);
    }
  });
});
