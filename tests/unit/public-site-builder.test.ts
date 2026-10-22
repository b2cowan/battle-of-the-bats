import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { pickLogoColours } from '../../lib/logo-colours.ts';
import { isStockLogoUrl } from '../../lib/stock-logos.ts';
import { clubLookOf, CLUB_LOOKS, builderReadiness, CLUB_LOOK_FIELDS, CLUB_LOOK_ROLES } from '../../lib/public-site-builder.ts';
import { isSiteEditRow, SITE_EDIT_ROW_KEYS } from '../../lib/site-edit-marks.ts';
import { SITE_EDIT_ROWS } from '../../lib/public-site-builder.ts';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const read = (rel: string) => readFileSync(join(process.cwd(), rel), 'utf8');

/**
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * THE PUBLIC SITE BUILDER (ruled 2026-10-21, A1–A9; docs/projects/active/PUBLIC_SITE_BUILDER_PLAN.md).
 *   A3 — "From your logo": the two strong colours of an uploaded logo, never its white ground, its
 *        transparent edge or a grey; a grey logo offers nothing; the darker is the fill.
 *   A4 — three looks (Classic · Serif · Clean); a club that picked System or Barlow reads as Classic.
 *   A8 — the rows' marks: what makes each of the four parts ready.
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 */

/** RGBA pixels: `n` copies of each [r, g, b, a]. */
function px(...runs: [number, [number, number, number, number]][]): Uint8ClampedArray {
  const out: number[] = [];
  for (const [n, c] of runs) for (let i = 0; i < n; i++) out.push(...c);
  return new Uint8ClampedArray(out);
}
const NAVY: [number, number, number, number] = [0x1f, 0x3a, 0x5f, 255];
const GOLD: [number, number, number, number] = [0xd9, 0xa9, 0x3a, 255];
const WHITE: [number, number, number, number] = [255, 255, 255, 255];
const CLEAR: [number, number, number, number] = [0, 0, 0, 0];

const hue = (hex: string) => {
  const r = parseInt(hex.slice(1, 3), 16), g = parseInt(hex.slice(3, 5), 16), b = parseInt(hex.slice(5, 7), 16);
  return { r, g, b };
};

describe('A3 · colours from the logo', () => {
  it('a navy-and-gold crest on white gives navy as the fill and gold as the accent', () => {
    const c = pickLogoColours(px([500, WHITE], [300, NAVY], [120, GOLD], [400, CLEAR]));
    assert.ok(c);
    const p = hue(c.primary), a = hue(c.accent);
    assert.ok(p.b > p.r && p.r < 0x40, `fill ${c.primary} should be navy`);
    assert.ok(a.r > 0xc0 && a.b < 0x60, `accent ${c.accent} should be gold`);
  });

  it('the darker colour is the fill even when the light one covers more of the logo', () => {
    const c = pickLogoColours(px([600, GOLD], [200, NAVY]));
    assert.ok(c);
    assert.ok(hue(c.primary).b > hue(c.primary).r, `fill ${c.primary} should be the navy`);
  });

  it('a shade or an edge of the same colour is not a second colour; a real two-tone logo is', () => {
    const LIGHT_NAVY: [number, number, number, number] = [0x3d, 0x62, 0x96, 255];
    const SKY: [number, number, number, number] = [0x8f, 0xc8, 0xee, 255];
    const sliver = pickLogoColours(px([300, NAVY], [30, LIGHT_NAVY]));
    assert.ok(sliver);
    assert.equal(sliver.primary, sliver.accent, 'a 10% shade of the navy is no accent');
    const twoTone = pickLogoColours(px([300, NAVY], [150, SKY]));
    assert.ok(twoTone);
    assert.notEqual(twoTone.primary, twoTone.accent, 'navy and sky, in real shares, are two colours');
  });

  it('white, transparency and greys are never offered', () => {
    assert.equal(pickLogoColours(px([500, WHITE], [500, CLEAR], [200, [128, 128, 128, 255]], [100, [20, 20, 20, 255]])), null);
  });

  it('a one-colour logo uses that colour for both', () => {
    const c = pickLogoColours(px([400, NAVY], [400, WHITE]));
    assert.ok(c);
    assert.equal(c.primary, c.accent);
  });

  it('answers in #RRGGBB, the form the colour fields store', () => {
    const c = pickLogoColours(px([300, NAVY], [100, GOLD]));
    assert.ok(c);
    assert.match(c.primary, /^#[0-9A-F]{6}$/);
    assert.match(c.accent, /^#[0-9A-F]{6}$/);
  });

  it('a stock logo is made in the club colour, so it is never read for colours', () => {
    const base = 'https://x.supabase.co/storage/v1/object/public/org-logos/abc';
    assert.equal(isStockLogoUrl(`${base}/stock-crown-1f3a5f-1729500000000.png?v=1`), true);
    assert.equal(isStockLogoUrl(`${base}/logo.png?v=1729500000000`), false);
    assert.equal(isStockLogoUrl(null), false);
  });
});

describe('A4 · three looks', () => {
  it('System and Barlow both read as Classic; DM Serif is Serif; Inter is Clean', () => {
    assert.equal(clubLookOf('system'), 'classic');
    assert.equal(clubLookOf('barlow'), 'classic');
    assert.equal(clubLookOf(null), 'classic');
    assert.equal(clubLookOf('dm-serif'), 'serif');
    assert.equal(clubLookOf('inter'), 'clean');
  });
  it('each look stores a font the server accepts, and Classic stores the default', () => {
    assert.deepEqual(CLUB_LOOKS.map(l => l.key), ['classic', 'serif', 'clean']);
    assert.deepEqual(CLUB_LOOKS.map(l => l.font), ['system', 'dm-serif', 'inter']);
  });
});

describe('Option A · the look is the owner\'s or an admin\'s; the switch, the listing, the name and the address stay the owner\'s', () => {
  it('an admin may send the colours and the type, and nothing else', () => {
    assert.deepEqual([...CLUB_LOOK_ROLES], ['owner', 'admin']);
    for (const field of ['isPublic', 'isDiscoverable', 'name', 'slug', 'themeCardStyle']) {
      assert.ok(!CLUB_LOOK_FIELDS.includes(field), `${field} must stay the owner's`);
    }
  });
  it('the org-settings route refuses an admin anything outside the look, whole', () => {
    const route = read('app/api/admin/org-settings/route.ts');
    assert.match(route, /clubLookEditor\(req\)/);
    assert.match(route, /role !== 'owner' && Object\.keys\(body\)\.some\(k => !CLUB_LOOK_FIELDS\.includes\(k\)\)/);
    assert.doesNotMatch(route, /membership\?\.role !== 'owner'/, 'one rule, not a second hand-written one');
  });
  it('the logo, stock-logo and banner routes ask the same rule (an accepted owner or admin)', () => {
    for (const rel of ['app/api/admin/org-logo/route.ts', 'app/api/admin/org-logo-stock/route.ts', 'app/api/admin/org-hero-banner/route.ts']) {
      const src = read(rel);
      assert.match(src, /clubLookEditor\(req\)/, rel);
      assert.doesNotMatch(src, /organization_members/, `${rel}: never a raw membership read (J10-006 — an invite is not a role)`);
    }
  });
  it('the preview is the owner\'s and admins\' only, asked on the server, at an admin address the service worker never stores', () => {
    const page = read('app/[orgSlug]/admin/public-site/preview/page.tsx');
    assert.match(page, /mayWriteSite\(ctx\.role\) \|\| !mayOpenSiteEditor\(ctx\)/);
    assert.match(read('app/[orgSlug]/admin/AdminChrome.tsx'), /isClubSitePreview/);
  });
  it('an admin changes the look only with the editor: the public-site capability on a plan that carries the module', () => {
    const access = read('lib/public-site-access.ts');
    assert.match(access, /if \(ctx\.role === 'owner'\) return \{ ctx \};\r?\n  if \(ctx\.role !== 'admin' \|\| !mayOpenSiteEditor\(ctx\)\) return \{ error: forbidden\(\) \};/);
    assert.match(access, /write && !mayWriteSite\(ctx\.role\)/, 'the words and lists use the same owner-or-admin rule');
  });
  it('the upload routes and the editor read one set of image limits', () => {
    for (const rel of ['app/api/admin/org-logo/route.ts', 'app/api/admin/org-hero-banner/route.ts', 'app/[orgSlug]/admin/public-site/LookPanel.tsx']) {
      assert.match(read(rel), /@\/lib\/org-image-limits/, rel);
    }
  });
});

describe('A9 · the edit marks: the public parts and the editor name the same rows', () => {
  it('every row the preview can name has its title, and nothing else is a row', () => {
    assert.deepEqual(Object.keys(SITE_EDIT_ROWS).sort(), [...SITE_EDIT_ROW_KEYS].sort());
    assert.equal(isSiteEditRow('look'), true);
    assert.equal(isSiteEditRow('constructor'), false);
    assert.equal(isSiteEditRow(undefined), false);
  });
  it('the public components mark parts only through siteEdit(row), never a hand-typed attribute', () => {
    const files = readdirSync(join(process.cwd(), 'components/public')).filter(f => f.endsWith('.tsx'));
    const used = new Set<string>();
    for (const f of files) {
      const src = read(`components/public/${f}`);
      assert.doesNotMatch(src, /data-site-edit=/, `${f}: use siteEdit('row') from lib/site-edit-marks`);
      for (const m of src.matchAll(/siteEdit\('([a-z]+)'\)/g)) used.add(m[1]);
    }
    for (const row of used) assert.ok((SITE_EDIT_ROW_KEYS as readonly string[]).includes(row), `unknown row ${row}`);
    for (const row of SITE_EDIT_ROW_KEYS) assert.ok(used.has(row), `${row} is marked somewhere`);
  });
});

describe('A8 · what makes each part ready', () => {
  const empty = { logoUrl: null, themePrimary: null, themePreset: 'platform', tagline: '', contactEmail: '', contacts: 0, documents: 0, questions: 0 };
  it('a new club: the home page is ready, nothing else', () => {
    assert.deepEqual(builderReadiness(empty), { look: false, home: true, about: false, lists: false, ready: 1, of: 4 });
  });
  it('a logo or a chosen colour makes the look ready', () => {
    assert.equal(builderReadiness({ ...empty, logoUrl: 'x' }).look, true);
    assert.equal(builderReadiness({ ...empty, themePreset: 'ocean' }).look, true);
    assert.equal(builderReadiness({ ...empty, themePrimary: '#1F3A5F' }).look, true);
  });
  it('About needs the tagline and the questions address; the lists need any one entry', () => {
    assert.equal(builderReadiness({ ...empty, tagline: 'Rep baseball' }).about, false);
    assert.equal(builderReadiness({ ...empty, tagline: 'Rep baseball', contactEmail: 'info@club.ca' }).about, true);
    assert.equal(builderReadiness({ ...empty, questions: 1 }).lists, true);
  });
  it('counts the four', () => {
    const r = builderReadiness({ ...empty, logoUrl: 'x', tagline: 't', contactEmail: 'e@x.ca', contacts: 2 });
    assert.equal(r.ready, 4);
  });
});

/**
 * The editor reads the club's SAVED look from the sign-in org (and again after every pick). When that org was built
 * without the colour, font and banner, the editor saw "nothing chosen": the selected swatch and type always snapped
 * back to the default and the Look summary read "Navy · the default font" whatever had been saved (walk §357).
 */
describe('the sign-in org carries the saved look', () => {
  const src = read('lib/api-auth.ts');
  const PAIRS: [string, string][] = [
    ['themePreset', 'theme_preset'], ['themePrimary', 'theme_primary'], ['themeAccent', 'theme_accent'],
    ['themeFont', 'theme_font'], ['themeCardStyle', 'theme_card_style'], ['heroBannerUrl', 'hero_banner_url'],
  ];
  for (const [field, column] of PAIRS) {
    it(`${field} is read from ${column}`, () => {
      assert.ok(src.includes(`${field}: orgRow.${column} ?? undefined`), `${field} must be read from the ${column} column`);
    });
  }
});
