import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { clubColourRoles, CLUB_GROUND, CLUB_CARD, CLUB_NEAR_BLACK } from '../../lib/club-colour-roles.ts';
import { contrastRatio } from '../../lib/color-contrast.ts';
import { PRESETS } from '../../lib/themes.ts';

/**
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * A CLUB'S COLOUR, MADE SAFE ON A LIGHT GROUND (Club Tier Stage 4b-1; End state 9 of the Stage 4 drawings,
 * https://claude.ai/artifact/QhdgL1QnfRndu4ZAoTB67k, ruled 2026-10-19).
 *
 * From the club's main colour: the FILL (bar, footer, buttons), the TEXT ON THE FILL (white or near-black, whichever
 * is clearer), the INK (darkened until it reaches 4.5 : 1 on the page ground — the darkest ground it sits on — for
 * links, the selected tab, Up next) and the EDGE (3 : 1 on the ground, so a light button and the Open now callout stay
 * visible). The ACCENT is decoration only. A colour that fails 4.5 : 1 with both texts has its fill darkened until
 * white clears it.
 *
 * The worked values are the drawing's. Navy, yellow and the pink FILL reproduce exactly. ⚠ The drawing's sky ink
 * (#487487, 4.67 : 1) and pink ink (#B03862, 5.37 : 1) are a little DARKER than the ruled rule produces ("darkened
 * until it reaches 4.5 : 1" → #497689 and #C43C6B); the rule is what was ruled, so those two are held to the rule's
 * floor and to being a darkening of the same colour, not to the drawing's hex.
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 */

describe('the worked values (End state 9)', () => {
  it('Lynx navy: the fill is already safe everywhere, so ink and edge are the fill', () => {
    const r = clubColourRoles(null, '#1F3A5F', '#E8B33A');
    assert.equal(r.fill, '#1F3A5F');
    assert.equal(r.onFill, '#FFFFFF');
    assert.equal(r.ink, '#1F3A5F');
    assert.equal(r.edge, '#1F3A5F');
    assert.equal(r.accent, '#E8B33A');
    assert.equal(r.mark, '#E8B33A'); // gold shows on navy, so the selected tab is underlined in it
    assert.equal(r.darkened, false);
  });

  it('Harbourview yellow: near-black text on the fill, a darkened ink and edge (#886D1B, 4.53 : 1)', () => {
    const r = clubColourRoles(null, '#F2C230', '#1E2A38');
    assert.equal(r.fill, '#F2C230');
    assert.equal(r.onFill, CLUB_NEAR_BLACK);
    assert.equal(r.ink, '#886D1B');
    assert.equal(r.edge, '#886D1B');
    assert.equal(r.accent, '#1E2A38');
    assert.equal(r.darkened, false);
  });

  it('sky: near-black on the fill; the ink and edge clear the floor as a darkening of the sky', () => {
    const r = clubColourRoles(null, '#7CC8E8', null);
    assert.equal(r.fill, '#7CC8E8');
    assert.equal(r.onFill, CLUB_NEAR_BLACK);
    assert.ok(contrastRatio(r.ink, CLUB_GROUND) >= 4.5);
    assert.equal(r.ink, '#497689'); // the drawing's #487487 is one step darker than the rule needs
    assert.equal(r.edge, r.ink);
    // No accent chosen: the decoration takes the edge (the drawing's sky rule is the darkened sky).
    assert.equal(r.accent, r.edge);
  });

  it('pink: fails 4.5 with both texts, so the FILL is darkened 7 % to #D04072 and white text sits on it', () => {
    const r = clubColourRoles(null, '#E0457B', null);
    assert.equal(r.fill, '#D04072');
    assert.equal(r.darkened, true);
    assert.equal(r.onFill, '#FFFFFF');
    assert.ok(contrastRatio(r.onFill, r.fill) >= 4.5);
    assert.ok(contrastRatio(r.ink, CLUB_GROUND) >= 4.5);
    assert.equal(r.ink, '#C43C6B');
    // The darkened pink already clears 3 : 1 on the ground, so the edge is the fill itself.
    assert.equal(r.edge, '#D04072');
    assert.equal(r.accent, '#D04072');
    // The accent IS the fill here, so an accent underline would vanish: the selected tab takes the text on the fill.
    assert.equal(r.mark, '#FFFFFF');
  });
});

describe('the floors hold for every colour a club can have', () => {
  const check = (label: string, r: ReturnType<typeof clubColourRoles>) => {
    assert.ok(contrastRatio(r.onFill, r.fill) >= 4.5, `${label}: text on fill ${contrastRatio(r.onFill, r.fill).toFixed(2)}`);
    assert.ok(contrastRatio(r.ink, CLUB_GROUND) >= 4.5, `${label}: ink on ground ${contrastRatio(r.ink, CLUB_GROUND).toFixed(2)}`);
    assert.ok(contrastRatio(r.ink, CLUB_CARD) >= 4.5, `${label}: ink on a card`);
    assert.ok(contrastRatio(r.edge, CLUB_GROUND) >= 3, `${label}: edge on ground ${contrastRatio(r.edge, CLUB_GROUND).toFixed(2)}`);
    assert.ok(contrastRatio(r.tileInk, r.tile) >= 3, `${label}: initials on the logo tile`);
    assert.ok(contrastRatio(r.mark, r.fill) >= 3, `${label}: the selected tab's mark on the fill`);
    for (const v of [r.fill, r.onFill, r.ink, r.edge, r.accent, r.mark, r.tile, r.tileInk]) assert.match(v, /^#[0-9A-F]{6}$/);
  };

  it('every preset, as chosen', () => {
    for (const key of Object.keys(PRESETS)) check(key, clubColourRoles(key, null, null));
  });

  it('a spread of custom colours, light and dark, saturated and grey', () => {
    for (let r = 0; r <= 255; r += 51) for (let g = 0; g <= 255; g += 51) for (let b = 0; b <= 255; b += 51) {
      const hex = `#${[r, g, b].map(c => c.toString(16).padStart(2, '0')).join('')}`.toUpperCase();
      check(hex, clubColourRoles(null, hex, null));
      check(`${hex} + gold accent`, clubColourRoles(null, hex, '#E8B33A'));
    }
  });

  it('white and near-white still give a visible bar, edge and ink', () => {
    for (const hex of ['#FFFFFF', '#F6F5F2', '#FAFAFA']) check(hex, clubColourRoles(null, hex, null));
  });
});

describe('what the club already saved is what it gets', () => {
  it('no colour at all is the platform preset, never undefined, and never FieldLogicHQ\'s lime as decoration', () => {
    for (const r of [clubColourRoles(null, null, null), clubColourRoles('platform', null, null)]) {
      assert.equal(r.fill, PRESETS.platform.primary);
      assert.notEqual(r.accent, PRESETS.platform.accent.toUpperCase());
      assert.equal(r.accent, r.edge);
    }
  });

  it('a named preset keeps its own accent as decoration', () => {
    assert.equal(clubColourRoles('ocean', null, null).accent, PRESETS.ocean.accent.toUpperCase());
  });

  it('a malformed saved colour falls back like the rest of the theme does', () => {
    const r = clubColourRoles('ocean', 'not-a-colour', 'nope');
    assert.equal(r.fill, PRESETS.ocean.primary);
  });

  it('the derivation is pure: the same colours give the same roles', () => {
    assert.deepEqual(clubColourRoles(null, '#7CC8E8', null), clubColourRoles(null, '#7CC8E8', null));
  });
});
