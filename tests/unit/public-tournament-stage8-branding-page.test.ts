import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { between, readCode, readSource, sourceExists } from './_source-code.ts';
import { frameBodyOf, type FrameBodyDraft } from '../../app/[orgSlug]/admin/tournaments/branding/look-draft.ts';
import { resolveTournamentLook, type LookOrg, type LookTournament } from '../../lib/tournament-look.ts';
import { publicFrameBand } from '../../lib/public-frame.ts';
import { isPublicPageEnabled } from '../../lib/public-pages.ts';
import { LOCK_WORDS } from '../../lib/invite-only-words.ts';
import { PUBLIC_SITE_WORDS } from '../../lib/tournament-settings-words.ts';

/**
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * PUBLIC TOURNAMENT PAGES — STAGE 8 PART 4b (2026-11-04): THE BRANDING PAGE OFFERS ONLY CONTROLS THAT DO SOMETHING.
 * Plan: docs/projects/active/PUBLIC_TOURNAMENT_STAGE8_PLAN.md §4 (Part 4), §6 asks A–C, §18.
 *
 *   · the page's controls are Pages, Show coaches' names, the Look card and the Logo — and each one's value is read by
 *     a public surface, NAMED below (the brief: "a setting that does nothing is a lie");
 *   · the old Theme (Dark/Light), Hero banner, Font and Card style cards, their words, their styles and the API's legacy
 *     fields are gone; a stale tab still sending those keys is ignored, never written;
 *   · only the Branding page pays for the Look card's band facts — event settings and the setup wizard share the route;
 *   · the hero-banner upload is gone; "branding done" counts the logo, own colours or a chosen type look (owner
 *     2026-11-04), never the banner; an event's copy carries only what the public pages read.
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 */

const PAGE = 'app/[orgSlug]/admin/tournaments/branding/page.tsx';
const ROUTE = 'app/api/admin/tournament-branding/route.ts';
const page = readCode(PAGE);
const route = readCode(ROUTE);

const club = {
  planId: 'club', subscriptionStatus: 'active', enabledAddons: [], freeFloor: null,
  themePreset: 'forest', themePrimary: undefined, themeAccent: undefined, themeFont: 'dm-serif',
  logoUrl: 'https://x/club.png', tournamentLookPolicy: 'club_default',
} as unknown as LookOrg;
const bare: LookTournament = { themePreset: null, themePrimary: null, themeAccent: null, themeFont: null, logoUrl: null };

describe('Stage 8 Part 4b: every control on the Branding page is read by a public page', () => {
  it('the page draws exactly four controls: the two switch rows (Pages, coach names), the Look card and the Logo', () => {
    // Pages: one SwitchRow per page option; coach names: the second SwitchRow. Nothing else draws a SwitchRow.
    assert.equal((page.match(/<SwitchRow\b/g) ?? []).length, 2);
    assert.equal((page.match(/<LookCard\b/g) ?? []).length, 1);
    assert.equal((page.match(/type="file"/g) ?? []).length, 1, 'one upload: the logo');
    assert.equal((page.match(/<CollapsibleCard\b/g) ?? []).length, 1, 'one closed card: Logo');
    assert.match(page, /<CollapsibleCard title=\{W\.logo\}/);
    // Every raw form control on the page, by kind: the logo's hidden file input and its two buttons (choose, remove) —
    // nothing else. A new select, text field, checkbox or button fails here until it names its public reader above.
    assert.equal((page.match(/<(select|textarea)\b/g) ?? []).length, 0);
    assert.deepEqual([...page.matchAll(/<input\b[^>]*>/g)].map(m => /type="(\w+)"/.exec(m[0])?.[1] ?? '?'), ['file']);
    assert.equal((page.match(/<button\b/g) ?? []).length, 2);
    assert.deepEqual([...page.matchAll(/<button\b[^]*?onClick=\{\(\) => ([^}]+)\}/g)].map(m => m[1].trim()),
      ['fileInputRef.current?.click()', 'void removeLogo()']);
  });

  it('the save carries exactly the keys a public page reads, and nothing the old cards wrote', () => {
    const d: FrameBodyDraft = {
      own: true, presetKey: 'custom', customPrimary: '#112233', customAccent: '#445566', typeKey: 'inter',
      publicHiddenPages: ['news'], coachNamesShowOnPublic: true,
    };
    assert.deepEqual(Object.keys(frameBodyOf(d, true, true, true)).sort(),
      ['coachNamesShowOnPublic', 'publicHiddenPages', 'themeAccent', 'themePreset', 'themePrimary', 'typeLook']);
    // And the page sends only that body: no second body, no old keys.
    assert.match(page, /body: JSON\.stringify\(frameBodyOf\(held\.draft, held\.advanced, held\.themeChanged, held\.typeChanged\)\)/);
    assert.doesNotMatch(page, /\bbodyOf\b|themeCardStyle|colorMode|fontKey|cardStyle/);
  });

  it('Pages → the public layout\'s hidden-pages list (layout.tsx, isPublicPageEnabled)', () => {
    assert.equal(isPublicPageEnabled({ publicHiddenPages: ['news'], settings: {} } as never, 'news'), false);
    assert.equal(isPublicPageEnabled({ publicHiddenPages: [], settings: {} } as never, 'news'), true);
    assert.match(readCode('app/[orgSlug]/[tournamentSlug]/layout.tsx'), /tournament\.publicHiddenPages \?\? \[\]/);
    assert.match(route, /updates\.public_hidden_pages\s*=\s*normalizeHiddenPublicPages\(body\.publicHiddenPages\)/);
  });

  it('Show coaches\' names → toPublicTeam (lib/public-tournament-data.ts), which strips the name when off', () => {
    const data = readCode('lib/public-tournament-data.ts');
    assert.match(data, /coach: showCoachName \? t\.coach : ''/);
    assert.match(data, /toPublicTeam\(t, tournament\.coachNamesShowOnPublic === true\)/);
    assert.match(route, /updates\.coach_names_show_on_public = Boolean\(body\.coachNamesShowOnPublic\)/);
  });

  it('the Look card\'s colours and type → resolveTournamentLook (lib/tournament-look.ts)', () => {
    const plus = { ...club, planId: 'tournament_plus' } as LookOrg;
    const own = resolveTournamentLook(plus, { ...bare, themePreset: 'platform', themePrimary: '#112233', themeAccent: '#445566', themeFont: 'inter' });
    assert.equal(own.source, 'own');
    assert.equal(own.primary, '#112233');
    assert.equal(own.accent, '#445566');
    assert.notEqual(own.face, resolveTournamentLook(plus, bare).face, 'the type look changes the face');
    // The route writes the type look into theme_font (mig 426), as picked — Classic included.
    assert.match(route, /updates\.theme_font = look;/);
  });

  it('the Logo → publicFrameBand (lib/public-frame.ts), through the resolver\'s logo', () => {
    const plus = { ...club, planId: 'tournament_plus' } as LookOrg;
    const t = { name: 'Cup', status: 'active', startDate: '2026-06-01', endDate: '2026-06-02' };
    const withLogo = publicFrameBand(plus, { ...t, ...bare, logoUrl: 'https://x/t.png' } as never, '2026-05-01', false);
    const without = publicFrameBand(plus, { ...t, ...bare } as never, '2026-05-01', false);
    assert.equal(withLogo.logoUrl, 'https://x/t.png');
    assert.equal(without.logoUrl, null);
  });
});

describe('Stage 8 Part 4b: the old cards are gone, with their words and styles', () => {
  it('no Theme / Hero banner / Font / Card style card, no banner state, no theme helpers', () => {
    assert.doesNotMatch(page, /W\.(theme|heroBanner|font|cardStyle|primary|accent|background|dark|light|lowContrast|themeLine|inheritTheme|inheritFont|inheritCard|uploadBanner|replaceBanner|bannerHint|bannerLine|logoHint)\b/);
    assert.doesNotMatch(page, /banner|Banner|PRESETS|FONT_OPTIONS|CARD_STYLE_OPTIONS|resolveTheme|HexField|themeSummary|frameOn/);
    assert.doesNotMatch(page, /LOCK_WORDS\.branding\b/);
    assert.match(page, /\{LOCK_WORDS\.brandingLook\}/);
    assert.equal('branding' in LOCK_WORDS, false, 'the old lock line went with its one user');
  });

  it('the words list keeps only what the page and the Look card say', () => {
    for (const gone of ['theme', 'heroBanner', 'font', 'cardStyle', 'uploadBanner', 'replaceBanner', 'logoHint', 'bannerHint',
      'bannerLine', 'primary', 'accent', 'background', 'dark', 'light', 'lowContrast', 'themeLine', 'inheritTheme',
      'inheritFont', 'inheritCard']) {
      assert.equal(gone in PUBLIC_SITE_WORDS, false, `${gone} went with its card`);
    }
    for (const kept of ['custom', 'uploading', 'remove', 'uploadFailed', 'removeFailed', 'logoHintOwn', 'logoHintFallback']) {
      assert.equal(kept in PUBLIC_SITE_WORDS, true, `${kept} is still said`);
    }
    assert.doesNotMatch(readCode('lib/tournament-settings-words.ts'), /themeSummary/);
  });

  it('branding.module.css holds only the Logo card\'s classes; site.module.css has no hex row', () => {
    const css = readSource('app/[orgSlug]/admin/tournaments/branding/branding.module.css').replace(/\/\*[\s\S]*?\*\//g, '');
    // A class selector starts a selector (line start, or after a comma / brace / space) — never a `.png` in a url().
    const classes = [...new Set([...css.matchAll(/(?:^|[\s,{}>+~])\.([a-zA-Z_][\w-]*)(?=[\s,{:.[>+~)])/gm)].map(m => m[1]))].sort();
    assert.deepEqual(classes, ['logoActions', 'logoHint', 'logoImg', 'logoPlaceholder', 'logoPreview', 'logoRow']);
    assert.doesNotMatch(readSource('app/[orgSlug]/admin/tournaments/branding/site.module.css'), /\.hexRow\b/);
  });
});

describe('Stage 8 Part 4b: the Branding API', () => {
  it('GET reads and returns no dead column and no switch', () => {
    assert.doesNotMatch(route, /hero_banner_url|theme_card_style|color_mode|heroBannerUrl|themeCardStyle|colorMode|frameOn/);
    assert.match(route, /themeFont:\s+data\.theme_font,/, 'the type look still seeds the Look card');
  });

  it('only the Branding page asks for the band facts (with=look); event settings and the setup wizard never do', () => {
    assert.match(route, /const band = advanced && url\.searchParams\.get\('with'\) === 'look'\s*\? await publicFrameBandFacts\(/);
    assert.match(page, /fetch\(`\$\{brandingUrl\}&with=look`/);
    // The PATCH address stays the plain one (the flag is a read's question, not part of the draft's identity).
    assert.match(page, /const brandingUrl = tournamentId \? `\/api\/admin\/tournament-branding\?tournamentId=\$\{encodeURIComponent\(tournamentId\)\}\$\{orgParam\}` : '';/);
    for (const other of ['app/[orgSlug]/admin/tournaments/settings/event/page.tsx', 'components/admin/TournamentSetupWizard.tsx']) {
      const code = readCode(other);
      assert.match(code, /\/api\/admin\/tournament-branding\?/, `${other} still shares the route`);
      assert.doesNotMatch(code, /with=look/, `${other} does not pay for the band facts`);
    }
  });

  it('PATCH validates no retired field; a stale tab\'s font, card style or Dark/Light is ignored, never written', () => {
    assert.match(route, /const PLUS_VISUAL_FIELDS = \[\s*'themePreset',\s*'themePrimary',\s*'themeAccent',\s*'typeLook',\s*\] as const;/);
    assert.doesNotMatch(route, /VALID_FONTS|VALID_CARD_STYLES|FONT_OPTIONS|CARD_STYLE_OPTIONS/);
    assert.doesNotMatch(route, /'themeFont' in body|'themeCardStyle' in body|'colorMode' in body/);
    assert.doesNotMatch(route, /theme_card_style|color_mode/);
    // theme_font is written only from the type look (the old rule mapped 'system' to null and took 'barlow').
    const writes = [...route.matchAll(/updates\.theme_font = ([^;]+);/g)].map(m => m[1]).sort();
    assert.deepEqual(writes, ['look', 'null']);
  });
});

describe('Stage 8 Part 4b: the hero banner (ask A), the dashboard and the copy lists', () => {
  it('the tournament hero-banner upload route is gone; the club\'s banner route stays', () => {
    assert.equal(sourceExists('app/api/admin/tournament-hero-banner/route.ts'), false);
    assert.equal(sourceExists('app/api/admin/org-hero-banner/route.ts'), true);
  });

  it('"branding done" = a logo, colours of its own, or a chosen type look — never the banner (owner 2026-11-04)', () => {
    const dash = readCode('app/api/admin/tournament-dashboard/route.ts');
    assert.match(dash, /const hasBranding = Boolean\(t\.logo_url \|\| t\.theme_preset \|\| t\.theme_primary \|\| t\.theme_font\);/);
    assert.doesNotMatch(dash, /hero_banner_url/);
  });

  it('an event\'s copy carries the logo, the colours and the type look — no dead column, no retired Rules key', () => {
    const db = readCode('lib/db.ts');
    const clone = between(db, 'export async function cloneTournament(', '\nexport ');
    const populate = between(db, 'export async function populateTournamentFrom(', '\nexport ');
    for (const [name, body] of [['cloneTournament', clone], ['populateTournamentFrom', populate]] as const) {
      assert.doesNotMatch(body, /hero_banner_url|theme_card_style|color_mode|icon_bg_color|app_name|app_icon_scale/, name);
      assert.match(body, /theme_font/, `${name} still copies the type look`);
    }
    // cloneTournament drops the retired keys whatever the rules flag says; populate never lets one through.
    assert.match(clone, /\n\s*delete clonedSettings\.rulesLayout;\n\s*delete clonedSettings\.resourcesLayout;/);
    assert.doesNotMatch(clone, /if \(!options\.includeRulesResources\) \{\s*delete clonedSettings\.rulesLayout/);
    assert.match(populate, /const allowed = RETIRED_KEYS\.includes\(key\) \? false :/);
  });
});

describe('Stage 8 Part 4b: the club editor has no switch half', () => {
  it('the Tournaments part shows on a plan that carries tournaments, and colours always take a typed hex code', () => {
    const editor = readCode('app/[orgSlug]/admin/public-site/page.tsx');
    assert.match(editor, /const tournamentRule = carries\.tournaments;/);
    assert.doesNotMatch(editor, /frameOn|hex=/);
    assert.doesNotMatch(readCode('app/[orgSlug]/admin/public-site/LookPanel.tsx'), /\bhex\b/);
    const controls = readCode('components/admin/kit/club/LookControls.tsx');
    assert.doesNotMatch(between(controls, 'export function LookSwatches(', '\nexport '), /hex\?: boolean|hex = false|if \(!hex\)/);
    assert.match(controls, /<HexField id=\{`\$\{idPrefix\}-\$\{field\}-hex`\}/);
    assert.doesNotMatch(readCode('app/api/admin/public-site/route.ts'), /frameOn|isPublicFrameOn/);
  });
});

/**
 * Stage 8 Part 5c (2026-11-04): the in-app help describes the page as it is. The help is the single source customers
 * read, so a guide that still offers a retired control is the same lie as the control itself (PLAN §4 Part 5).
 */
describe('Stage 8 Part 5c: the help says what the Public site page does, and nothing it no longer does', () => {
  const help = readSource('lib/help-content/tournaments.tsx');
  const org = readSource('lib/help-content/org.tsx');

  it('no guide offers a retired control: the six cards, the App icon, the hero banner, fonts, card style, Layout menus', () => {
    for (const old of [
      /six closed cards/, /<strong>App icon<\/strong>/i, /<strong>Hero banner<\/strong>/, /<strong>Font<\/strong>/,
      /<strong>Card style<\/strong>, and/, /Branding → App Icon/, /hero banner, fonts/, /icon background colour and a short app name/,
      /Each card&apos;s <strong>Layout<\/strong>/, /Logo size<\/strong> slider/,
    ]) assert.doesNotMatch(help, old, `the tournament help still offers ${old}`);
    assert.doesNotMatch(org, /each tournament picks its own on its <strong>Branding<\/strong> page/);
  });

  it('the page guide names the two cards after Pages, the band preview, and the lock line in the page’s own words', () => {
    const cards = between(help, "id: 'public-site-cards'", "id: 'public-site-standings'");
    assert.match(cards, /two cards follow\. <strong>Look<\/strong>/);
    assert.match(cards, /<strong>Classic<\/strong>, <strong>Serif<\/strong> or <strong>Clean<\/strong>/);
    assert.match(cards, /<strong>On a phone<\/strong>/);
    assert.match(cards, /<strong>Logo<\/strong> holds/);
    assert.ok(cards.includes(`<strong>${LOCK_WORDS.brandingLook}</strong>`), 'the lock line is quoted exactly as the page says it');
  });

  it('the app-icon answer is "No": the home-screen icon is always FieldLogicHQ’s, and the anchor survives for old links', () => {
    const faq = between(help, "id: 'faq-app-icon'", "id: 'faq-post-event-results-email'");
    assert.match(faq, /answerText: 'No\. /);
    assert.match(faq, /always FieldLogicHQ/);
    assert.doesNotMatch(faq, /answerText: 'Yes/);
    // Search still lands a "logo size" or "app name" question on the answer that says there is no such setting.
    for (const k of ['app icon', 'app name', 'logo size', 'icon background']) assert.ok(faq.includes(`'${k}'`), k);
  });
});
