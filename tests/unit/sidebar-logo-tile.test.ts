import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { logoFitsTile } from '../../lib/logo-aspect.ts';
import { readSource } from './_source-code.ts';

/**
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * THE ONE LOGO TILE (navigation Phase 1 Part B, owner 2026-11-09, E10 + B1–B6)
 *
 *   1. The rule: a logo only within 1 : 2 … 2 : 1 of STORED shape; unknown shape = initials.
 *   2. The decision is made from stored facts, so the server's first paint is the last: the shape travels
 *      column → mapper → org seed → tile, and the club's shape is read by the layout and handed to the provider.
 *   3. Written with the logo: an upload measures it, a stock pick is square, a removal clears it.
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 */
describe('logoFitsTile — when a logo is a logo and when the initials stand in', () => {
  it('shows a logo from 1 : 2 to 2 : 1, both ends included', () => {
    for (const a of [0.5, 0.75, 1, 1.5, 2]) assert.equal(logoFitsTile(a), true, String(a));
  });
  it('shows initials for a wordmark wider than 2 : 1 and a banner taller than 1 : 2', () => {
    for (const a of [2.01, 3, 6.4, 0.49, 0.2]) assert.equal(logoFitsTile(a), false, String(a));
  });
  it('shows initials when the shape is unknown or nonsense — never a guess', () => {
    for (const a of [null, undefined, 0, -1, Number.NaN, Number.POSITIVE_INFINITY]) assert.equal(logoFitsTile(a), false, String(a));
  });
});

describe('the logo tile is decided on the server and built once', () => {
  it('the three organization mappers carry the stored shape to the seed the tile reads', () => {
    for (const f of ['lib/api-auth.ts', 'lib/server-organizations.ts', 'lib/db.ts']) {
      assert.match(readSource(f), /logoAspect:\s*(orgRow|row|r)\.logo_aspect \?\? undefined/, f);
    }
  });

  it('writes the shape with the logo: upload measures, stock is square, removal clears', () => {
    const upload = readSource('app/api/admin/org-logo/route.ts');
    assert.match(upload, /measureLogoAspect\(bytes\)/);
    assert.match(upload, /update\(\{ logo_url: logoUrl, logo_aspect: logoAspect \}\)/);
    assert.match(upload, /update\(\{ logo_url: null, logo_aspect: null \}\)/);
    assert.match(readSource('lib/stock-logo-render.ts'), /update\(\{ logo_url: logoUrl, logo_aspect: 1 \}\)/);
  });

  it('the club cell wears the shared tile, not a tile of its own', () => {
    const rail = readSource('components/admin/kit/AdminKitRail.tsx');
    assert.match(rail, /<SidebarLogoTile source=\{logoUrl\} aspect=\{logoAspect\} name=\{name\} \/>/);
    assert.doesNotMatch(readSource('components/admin/kit/AdminKitFrame.module.css'), /\.clubTile/);
  });

  it('the tile takes its source and fallback as props — it reads no organization', () => {
    const tile = readSource('components/shared/SidebarLogoTile.tsx');
    assert.doesNotMatch(tile, /useOrg|currentOrg|organizations/);
    assert.match(tile, /logoFitsTile\(aspect\)/);
    assert.match(tile, /onError=\{\(\) => setFailed\(source\)\}/);
  });

  it('the layout reads the club\'s shape on the server and hands it to the provider (no late reshuffle)', () => {
    assert.match(readSource('app/[orgSlug]/admin/layout.tsx'), /readClubShape\(authCtx\.org\)/);
    assert.match(readSource('app/[orgSlug]/admin/layout.tsx'), /<AdminChrome clubShape=\{clubShape\}>/);
    assert.match(readSource('app/[orgSlug]/admin/AdminChrome.tsx'), /<ClubBriefProvider seedShape=\{clubShape\}>/);
    assert.match(readSource('components/admin/kit/club/ClubBriefProvider.tsx'), /seedShape \?\?/);
    // The brief's route reads the same shape, so the two can never disagree.
    assert.match(readSource('app/api/admin/club-brief/route.ts'), /readClubShape\(/);
  });

  it('the back link has ONE look: no bar hover on --white-8, no stretched --home-line rule', () => {
    for (const f of ['components/admin/AdminTopStrip.module.css', 'components/admin/kit/AdminKitEventHeader.module.css', 'components/admin/AdminPageHeader.module.css']) {
      const css = readSource(f);
      assert.doesNotMatch(css, /\.back:hover \{[^}]*--white-8/, f);
      assert.match(css, /\.backRule \{[^}]*height: 22px;[^}]*--home-line-strong/, f);
      assert.match(css, /@media \(hover: hover\) \{\s*(\.header )?\.back:hover/, f);
    }
  });
});
