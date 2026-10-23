/**
 * THE PUBLIC FACE, WARM — S4 PART B: THE IDENTITY, EVERYWHERE AT ONCE (owner ruling W, 2026-10-23: the refined Joined FL,
 * olive leading, lime kept for actions; spec docs/agents/brand/VISUAL_IDENTITY.md §4; build prompt
 * docs/projects/active/PUBLIC_FACE_WARM_S4_BUILD_PROMPT.md, Part B).
 *
 * What must stay true, and why each is a source check:
 *   1. The mark is COPIED from the refinement page, never redrawn: lib/brand-mark.ts holds the page's paths exactly.
 *   2. ONE component owns the name. There were ~10 hand-drawn copies of FIELD·LOGIC·HQ; a new one is the bug this
 *      prevents, and the places that cannot import the component (the offline page, the email) hold copies drawn
 *      from the same source that must not drift.
 *   3. No icon, manifest or launch colour is the old near-black, and every icon file a page, the manifest or the
 *      service worker names exists on disk (renamed files are how a stale icon or a 404 creeps back).
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { readCode, readSource, filesUnder } from './_source-code.ts';
import {
  MARK_PATH_MAIN, MARK_PATH_SMALL, BRAND_OLIVE, BRAND_PAPER, BRAND_INK, BRAND_NAME, BRAND_NAME_HQ,
  lockupStaticHtml, emailNameLineHtml,
} from '../../lib/brand-mark.ts';
import { warmEmailDocument, WARM_EMAIL } from '../../lib/email-envelope-warm.ts';
import { THEME_COLORS, DEFAULT_THEME_COLOR } from '../../lib/user-theme.ts';

const REPO = path.join(import.meta.dirname, '..', '..');
const onDisk = (publicPath: string) => existsSync(path.join(REPO, 'public', publicPath.replace(/^\//, '')));

describe('S4 Part B — the mark is the ruled one, copied', () => {
  it('holds the refinement page\'s main and 16 px cuts exactly', () => {
    const page = readSource('docs/projects/active/PUBLIC_FACE_WARM_W_REFINEMENT.html');
    const rf = /\brf:'([^']+)'/.exec(page)?.[1];
    const rf16 = /\brf16:'([^']+)'/.exec(page)?.[1];
    assert.ok(rf && rf16, 'the refinement page no longer carries P.rf / P.rf16');
    assert.equal(MARK_PATH_MAIN, rf, 'the main cut was redrawn — copy it from the refinement page');
    assert.equal(MARK_PATH_SMALL, rf16, 'the 16 px cut was redrawn — copy it from the refinement page');
  });

  it('its colours are the warm palette\'s own, and lime is not one of them', () => {
    const css = readSource('components/consumer/warmTheme.module.css');
    const token = (name: string) => new RegExp(`--home-${name}:\\s*(#[0-9a-f]{6})`, 'i').exec(css)?.[1]?.toLowerCase();
    assert.equal(BRAND_OLIVE.toLowerCase(), token('olive'));
    assert.equal(BRAND_PAPER.toLowerCase(), token('paper'));
    assert.equal(BRAND_INK.toLowerCase(), token('ink'));
    assert.doesNotMatch(readCode('lib/brand-mark.ts'), /d9f99d/i, 'lime is the action colour, never the mark');
  });
});

describe('S4 Part B — one component owns the name', () => {
  // Every app, component and lib source, read as code. The name's own home and its three drawn copies are allowed.
  const OWNERS = new Set(['components/shared/BrandLockup.tsx', 'lib/brand-mark.ts', 'app/share-card.png/route.tsx']);
  const sources = ['app', 'components', 'lib'].flatMap((d) => [...filesUnder(d, '.tsx'), ...filesUnder(d, '.ts')])
    .filter((f) => !/\.test\.tsx?$/.test(f) && !OWNERS.has(f));

  it('finds the surfaces it is meant to scan', () => {
    for (const f of ['components/Navbar.tsx', 'components/Footer.tsx', 'components/consumer/ConsumerNav.tsx',
      'app/[orgSlug]/check-in/layout.tsx', 'app/platform-admin/login/page.tsx', 'lib/email-envelope-warm.ts']) {
      assert.ok(sources.includes(f), `${f} is scanned`);
    }
  });

  it('no screen hand-draws FIELD · LOGIC · HQ or the lockup', () => {
    const OLD = /(?:>|['"`])\s*(?:FIELD|LOGIC|FIELDLOGIC(?:HQ)?)\s*(?:<|['"`])/; // a span or string holding a piece of the old mark
    const NEW = /FieldLogic\s*<span/;                                           // the new lockup drawn by hand
    const found: string[] = [];
    for (const f of sources) {
      readCode(f).split('\n').forEach((line, i) => {
        if (OLD.test(line) || NEW.test(line)) found.push(`${f}:${i + 1}  ${line.trim().slice(0, 90)}`);
      });
    }
    assert.deepEqual(found, [], 'draw the name with components/shared/BrandLockup.tsx');
  });

  it('every place that showed the name now mounts the one component', () => {
    for (const f of ['components/Navbar.tsx', 'components/Footer.tsx', 'components/consumer/ConsumerNav.tsx',
      'components/admin/AdminTopStrip.tsx', 'components/coaches/CoachTopStrip.tsx', 'app/[orgSlug]/check-in/layout.tsx',
      'app/[orgSlug]/scorekeeper/layout.tsx', 'app/platform-admin/login/page.tsx', 'app/unsubscribe/confirmed/page.tsx']) {
      assert.match(readCode(f), /<BrandLockup\b/, `${f} draws the name without the one component`);
    }
  });

  it('the offline page holds the lockup exactly as lib/brand-mark.ts draws it', () => {
    assert.ok(readSource('public/offline.html').includes(lockupStaticHtml()), 'public/offline.html drifted from lockupStaticHtml()');
  });

  it('the email name line is Arial text drawn from the same source: no image, no mark, no Courier', () => {
    const doc = warmEmailDocument('<p>x</p>');
    assert.ok(doc.includes(emailNameLineHtml({ ink: WARM_EMAIL.ink, olive: WARM_EMAIL.olive, font: WARM_EMAIL.font })));
    assert.match(emailNameLineHtml({ ink: 'I', olive: 'O', font: 'F' }), new RegExp(`>${BRAND_NAME}<span[^>]*>${BRAND_NAME_HQ}<`));
    assert.doesNotMatch(doc, /Courier|<img|<svg/);
  });
});

describe('S4 Part B — icons, manifest and launch colours', () => {
  it('nothing still carries the old near-black #0a0a0f', () => {
    const files = [
      'app/layout.tsx', 'app/manifest.json/route.ts', 'public/sw.js', 'public/offline.html', 'lib/user-theme.ts',
      'components/coaches/CoachThemeColor.tsx', 'components/consumer/ConsumerThemeManager.tsx',
      'scripts/generate-brand-icons.mjs',
      ...readdirSync(path.join(REPO, 'public/brand')).map((f) => `public/brand/${f}`),
    ];
    const hits = files.filter((f) => /#0a0a0f/i.test(readSource(f)));
    assert.deepEqual(hits, []);
    assert.equal(DEFAULT_THEME_COLOR, THEME_COLORS.warm, 'a page with no theme manager gets the paper bar');
  });

  it('the manifest launches on the paper with the new icons, "any" and maskable as separate files', () => {
    const m = readCode('app/manifest.json/route.ts');
    assert.match(m, /background_color: THEME_COLORS\.warm/);
    const icons = [...m.matchAll(/src: '([^']+)'[^}]*purpose: '(any|maskable)'/g)].map((x) => [x[1], x[2]]);
    assert.ok(icons.some(([, p]) => p === 'any') && icons.some(([, p]) => p === 'maskable'));
    assert.equal(new Set(icons.map(([s]) => s)).size, icons.length, 'any and maskable are separate files');
  });

  it('every icon a page, the manifest, the service worker or an export names exists on disk', () => {
    const named = new Set<string>();
    const scan = (rel: string) => { for (const m of readSource(rel).matchAll(/\/icons\/[\w.-]+\.png|\/favicon\.ico/g)) named.add(m[0]); };
    for (const f of ['app/layout.tsx', 'app/manifest.json/route.ts', 'public/sw.js', 'components/InstallAppPrompt.tsx',
      'lib/export/brand-mark.ts', 'app/[orgSlug]/[tournamentSlug]/apple-icon.tsx', 'app/[orgSlug]/[tournamentSlug]/icon-maskable/route.tsx']) scan(f);
    assert.ok(named.size >= 6, `found ${[...named].join(', ')}`);
    const missing = [...named].filter((p) => (p === '/favicon.ico' ? !existsSync(path.join(REPO, 'app/favicon.ico')) : !onDisk(p)));
    assert.deepEqual(missing, []);
    for (const p of named) assert.doesNotMatch(p, /pwa-|badge-72/, `${p} is an old icon name (caches would keep the old mark)`);
  });

  it('the service worker dropped the old caches and the tab has no SVG icon drawn from the main cut at 16', () => {
    const sw = readCode('public/sw.js');
    const v = Number(/CACHE_VERSION = 'v(\d+)'/.exec(sw)?.[1]);
    assert.ok(v >= 11, 'bump CACHE_VERSION when the icon names change');
    assert.doesNotMatch(readCode('app/layout.tsx'), /favicon\.svg/);
    assert.ok(!existsSync(path.join(REPO, 'public/favicon.svg')));
  });

  it('the 16 px tab icon is a real 16 × 16 PNG (the separate small cut)', () => {
    const png = readFileSync(path.join(REPO, 'public/icons/fl-tab-16.png'));
    assert.equal(png.readUInt32BE(16), 16);
    assert.equal(png.readUInt32BE(20), 16);
  });
});
