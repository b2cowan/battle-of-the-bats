/**
 * THE PUBLIC FACE, WARM — S4 PART A: THE MARKETING SET, WARM AND PLAIN (owner rulings 2026-10-23: Ask 1, the set moves as
 * one; Ask 5 B, always warm; Ask 3 A, the public type rules; Ask 8 A, titles and a share card; plan
 * docs/projects/active/PUBLIC_FACE_WARM_PLAN.md, build prompt PUBLIC_FACE_WARM_S4_BUILD_PROMPT.md).
 *
 * What this pins, and why a source scan is the right tool: the marketing pages used to be dark by their OWN tokens and
 * Tailwind utilities, not by a setting, so one `bg-pitch-black` left on a page is a dark island under a warm bar. The
 * scan names the file and line. The lettering half (no typewriter, no capitals, no heavy weights) is
 * `npm run check:public-type`'s; this file holds the colour, the titles, P6 (nothing waits for a scroll) and the
 * retirements.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { readCode, filesUnder } from './_source-code.ts';
import { marketingMetadata, SITE_DESCRIPTION, MARKETING_SHARE_CARD } from '../../lib/marketing-metadata.ts';

const REPO = path.join(import.meta.dirname, '..', '..');
const exists = (rel: string) => existsSync(path.join(REPO, rel));

/** Every marketing page and the pieces only they wear, read whole. */
const PAGE_DIRS = ['app/pricing', 'app/for-clubs', 'app/for-coaches', 'app/for-leagues', 'app/for-tournament-organizers',
  'app/changelog', 'app/demos', 'app/pitch', 'app/see-it-live/switch', 'app/see-it-live/coaches/switch'];
const MARKETING_FILES = [
  'app/page.tsx', 'app/page.module.css',
  ...PAGE_DIRS.flatMap((d) => [...filesUnder(d, '.tsx'), ...filesUnder(d, '.css')]),
  'components/Footer.tsx', 'components/Footer.module.css',
  ...filesUnder('components/marketing', '.css').filter((f) => !/SlideDrawings|SlideStage|tournament-growth/.test(f)),
  'components/marketing/WalkthroughPresent.tsx',
  'components/EarlyAccessForm.tsx', 'components/EarlyAccessForm.module.css',
  'components/EarlyAccessModalTrigger.tsx', 'components/EarlyAccessModalTrigger.module.css',
  'components/marketing/FoundingSeasonOfferBar.tsx', 'components/marketing/FoundingSeasonOfferBar.module.css',
  'components/marketing/FoundingSeasonPanel.tsx', 'components/marketing/FoundingSeasonPanel.module.css',
  'components/marketing/WalkthroughPage.tsx', 'components/marketing/WalkthroughPage.module.css',
  'components/marketing/ProspectDeckPage.tsx',
  'components/PricingSection.tsx', 'components/PricingSection.module.css',
].filter(exists);

/** The marketing bar shares Navbar with the org and tournament bars, so only its own branch and rules are read. */
function marketingBarCode(): string {
  const tsx = readCode('components/Navbar.tsx');
  const from = tsx.indexOf('if (isMarketingPath(pathname))');
  const to = tsx.indexOf('if (!urlTournamentSlug) return null;');
  assert.ok(from > 0 && to > from, 'the marketing branch of Navbar.tsx moved; teach this guard where it is');
  return tsx.slice(from, to);
}
function marketingBarCss(): string {
  // Every rule whose selector names a marketing-bar or bottom-nav class.
  const css = readCode('components/Navbar.module.css');
  const rules = [...css.matchAll(/([^{}]*\.(?:marketing\w*|bottomNav\w*|wm\w+)[^{}]*)\{([^{}]*)\}/g)].map((m) => `${m[1]}{${m[2]}}`);
  assert.ok(rules.length >= 10, 'the marketing bar\'s rules were renamed; teach this guard their names');
  return rules.join('\n');
}

/** The old dark look's vocabulary. Each is a role that does not exist on paper. */
const DARK_ONLY: [string, RegExp][] = [
  ['a dark Tailwind colour utility', /(?<![-\w])(?:bg|text|border|from|via|to|ring|fill|stroke|divide|placeholder)-(?:pitch-black|fl-text|data-gray|logic-lime|blueprint-blue|blueprint-light|hud-surface|structural-slate)(?![-\w])/],
  ['white or black text/ground from Tailwind (the dark set\'s inks)', /(?<![-\w])(?:bg|text|border)-(?:white|black)(?:\/\d+)?(?![-\w])/],
  ['a dark palette token read', /var\(\s*--(?:pitch-black|fl-text|data-gray|logic-lime|logic-lime-rgb|blueprint-[\w-]+|hud-surface|structural-slate|white(?:-\d+)?|primary(?:-[\w-]+)?|bg(?:-\d)?|surface(?:-\d)?|border)\s*[,)]/],
  ['a Dark-setting branch (the marketing set has no Dark version)', /data-(?:user-)?theme/],
];

describe('S4 — the marketing set is warm, with no dark island', () => {
  it('finds the files it is meant to scan', () => {
    for (const f of ['app/page.tsx', 'app/pricing/page.tsx', 'app/for-clubs/page.tsx', 'app/changelog/page.tsx',
      'app/demos/page.tsx', 'components/Footer.module.css']) {
      assert.ok(MARKETING_FILES.includes(f), `${f} is scanned`);
    }
  });

  it('names the file and line of anything left from the dark look', () => {
    const found: string[] = [];
    const scan = (label: string, code: string) => code.split('\n').forEach((line, i) => {
      for (const [what, re] of DARK_ONLY) if (re.test(line)) found.push(`${label}:${i + 1}  ${what}: ${line.trim().slice(0, 100)}`);
    });
    for (const f of MARKETING_FILES) scan(f, readCode(f));
    scan('components/Navbar.tsx (marketing branch)', marketingBarCode());
    scan('components/Navbar.module.css (marketing rules)', marketingBarCss());
    assert.deepEqual(found, [], 'the marketing set wears the --home-* tokens only (components/marketing/MarketingKit.module.css)');
  });

  it('every marketing page wears the kit, whose ground is the always-warm palette', () => {
    const kit = readCode('components/marketing/MarketingKit.module.css');
    assert.match(kit, /\.page\s*\{\s*composes:\s*warmVars warm from '\.\.\/consumer\/warmTheme\.module\.css'/,
      'the kit composes the first look\'s ALWAYS-warm class (never .warmTab, which follows the Dark setting)');
    const pages = ['app/page.tsx', ...PAGE_DIRS.flatMap((d) => filesUnder(d, '.tsx')).filter((f) => f.endsWith('/page.tsx'))];
    const viaComponent = ['app/for-coaches/walkthrough/page.tsx', 'app/for-tournament-organizers/walkthrough/page.tsx', 'app/pitch/[slug]/page.tsx'];
    for (const f of pages) {
      const code = readCode(f);
      const wears = /kit\.page|MarketingKit/.test(code) || viaComponent.includes(f);
      assert.ok(wears, `${f} does not wear the marketing kit`);
    }
    assert.match(readCode('components/marketing/WalkthroughPage.tsx'), /MarketingKit/);
    assert.match(readCode('components/marketing/ProspectDeckPage.tsx'), /MarketingKit/);
  });

  it('the bar and the strip are warm under every setting, and so are the phone bar and the page base', () => {
    const bar = marketingBarCode();
    assert.match(bar, /<CoachThemeColor fixed="warm" \/>/, 'the phone browser bar takes the paper on marketing pages');
    assert.match(bar, /data-warm-base="marketing"/, 'the marketing bar marks the page base');
    assert.match(readCode('components/Navbar.module.css'), /\.marketingNav\s*\{\s*composes:\s*warmVars from/);
    assert.match(readCode('components/Footer.module.css'), /\.footer\s*\{\s*composes:\s*warmVars from/);
    assert.match(readCode('components/marketing/FoundingSeasonOfferBar.module.css'), /\.bar\s*\{\s*composes:\s*warmVars from/);
    assert.match(readCode('app/globals.css'), /html:has\(\[data-warm-base="marketing"\]\) body,/);
  });

  it('one lime per view: the bar\'s door is the white secondary on every marketing page (Ask 14)', () => {
    assert.match(readCode('components/Navbar.module.css'), /\.marketingCta\s*\{\s*composes:\s*btn btnSecondary btnSmall from/);
  });
});

describe('S4 — every marketing page says what it is when shared (P7)', () => {
  const INDEXED = ['app/page.tsx', 'app/pricing/page.tsx', 'app/for-clubs/page.tsx', 'app/for-coaches/page.tsx',
    'app/for-leagues/page.tsx', 'app/for-tournament-organizers/page.tsx', 'app/for-coaches/walkthrough/page.tsx',
    'app/for-tournament-organizers/walkthrough/page.tsx', 'app/changelog/page.tsx', 'app/demos/page.tsx'];
  const NOT_INDEXED = ['app/pitch/[slug]/page.tsx', 'app/see-it-live/switch/page.tsx', 'app/see-it-live/coaches/switch/page.tsx'];

  it('every marketing page takes its metadata from the one helper', () => {
    for (const f of [...INDEXED, ...NOT_INDEXED]) {
      assert.match(readCode(f), /marketingMetadata\(/, `${f} builds its title and share card by hand`);
    }
    for (const f of NOT_INDEXED) assert.match(readCode(f), /noindex:\s*true/, `${f} must stay out of search results`);
  });

  it('no page title carries the brand or a dash tail (the layout adds " | FieldLogicHQ" once)', () => {
    const titles: string[] = [];
    for (const f of [...INDEXED, ...NOT_INDEXED]) {
      for (const m of readCode(f).matchAll(/marketingMetadata\(\{[\s\S]*?title:\s*(['"`])([^'"`]*)\1/g)) titles.push(`${f}: ${m[2]}`);
    }
    // The two walkthroughs take their title from the walkthrough's own data (one home for it).
    for (const m of readCode('lib/walkthrough-content.ts').matchAll(/seo:\s*\{\s*title:\s*(['"`])([^'"`]*)\1/g)) {
      titles.push(`lib/walkthrough-content.ts: ${m[2]}`);
    }
    assert.ok(titles.length >= INDEXED.length, `found ${titles.length} titles: ${titles.join(' / ')}`);
    const bad = titles.filter((t) => {
      const title = t.slice(t.indexOf(': ') + 2);
      return !t.startsWith('app/page.tsx') && (/FieldLogicHQ|—|\|/.test(title));
    });
    assert.deepEqual(bad, []);
    // Home is the one absolute title.
    assert.match(readCode('app/page.tsx'), /title:\s*'FieldLogicHQ: less admin, more sport',\s*absolute:\s*true/);
  });

  it('the helper gives every page a description, a canonical or a noindex, and the marketing card', () => {
    const m = marketingMetadata({ title: 'Pricing', path: '/pricing' });
    assert.equal(m.title, 'Pricing');
    assert.equal(m.description, SITE_DESCRIPTION);
    assert.deepEqual(m.alternates, { canonical: '/pricing' });
    assert.deepEqual((m.openGraph as { images: unknown[] }).images, [MARKETING_SHARE_CARD]);
    assert.equal((m.twitter as { card: string }).card, 'summary_large_image');
    const hidden = marketingMetadata({ title: 'Your walkthrough', path: '/pitch/x', noindex: true });
    assert.deepEqual(hidden.robots, { index: false, follow: false });
    assert.equal(hidden.alternates, undefined);
    const home = marketingMetadata({ title: 'FieldLogicHQ: less admin, more sport', path: '/', absolute: true });
    assert.deepEqual(home.title, { absolute: 'FieldLogicHQ: less admin, more sport' });
  });

  it('the site description is the words doc\'s, shared by the layout and the manifest, and is not a country claim', () => {
    assert.match(SITE_DESCRIPTION, /^Less admin\. More sport\./);
    assert.doesNotMatch(SITE_DESCRIPTION, /Canadian|all-in-one/);
    assert.match(readCode('app/layout.tsx'), /description:\s*SITE_DESCRIPTION/);
    assert.match(readCode('app/manifest.json/route.ts'), /description:\s*SITE_DESCRIPTION/);
  });

  it('the share card is the marketing set\'s alone, never a root opengraph-image that every top-level route inherits', () => {
    assert.ok(exists('app/share-card.png/route.tsx'), 'the marketing share card route');
    assert.ok(!exists('app/opengraph-image.tsx') && !exists('app/opengraph-image.png'), 'a root card reaches pages that are not marketing');
  });
});

describe('S4 — complete when it loads (P6)', () => {
  it('nothing on a public page waits for a scroll to appear', () => {
    assert.ok(!exists('components/AnimateIn.tsx'), 'the scroll-reveal wrapper is retired');
    assert.doesNotMatch(readCode('app/globals.css'), /\.animateIn\b/);
    const users = [...filesUnder('app', '.tsx'), ...filesUnder('components', '.tsx')]
      .filter((f) => /\bAnimateIn\b/.test(readCode(f)));
    assert.deepEqual(users, []);
    for (const f of MARKETING_FILES) {
      assert.doesNotMatch(readCode(f), /IntersectionObserver/, `${f} hides content until it is scrolled to`);
    }
  });
});

describe('S4 — retirements and the sitemap', () => {
  it('the four pre-rename /platform pages are gone and their addresses go home', () => {
    assert.ok(!exists('app/platform'), 'app/platform/* is retired (owner, 2026-10-23)');
    assert.match(readCode('next.config.ts'), /source: '\/platform\/:page\(accounting\|house-league\|rep-teams\|tournaments\)', destination: '\/', permanent: true/);
  });

  it('the demo chooser is in the sitemap', () => {
    assert.match(readCode('app/sitemap.ts'), /path: '\/demos'/);
  });
});
