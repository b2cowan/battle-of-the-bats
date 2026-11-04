import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import path from 'node:path';
import { between, filesUnder, readCode, readSource, sourceExists } from './_source-code.ts';
import {
  PUBLIC_FRAME_ATTR,
  publicFrameAttr,
  publicFrameBand,
  publicFrameHost,
  publicFrameRoles,
} from '../../lib/public-frame.ts';
import * as publicFrame from '../../lib/public-frame.ts';
import type { LookOrg } from '../../lib/tournament-look.ts';
import { CLUB_GROUND, CLUB_NEAR_BLACK } from '../../lib/club-colour-roles.ts';
import { contrastRatio } from '../../lib/color-contrast.ts';

/** Every app/components/lib file that imports `target` (resolved, so `ClubHome.module.css` is not `Home.module.css`;
 *  a stylesheet's `composes … from` counts as an import). Stage 8 Part 4a: a frame rule is dead when nothing that
 *  renders inside the frame imports its sheet. */
function importersOf(target: string): string[] {
  const noExt = target.replace(/\.tsx?$/, '');
  const files = [...filesUnder('app', '.tsx'), ...filesUnder('app', '.ts'), ...filesUnder('app', '.css'),
    ...filesUnder('components', '.tsx'), ...filesUnder('components', '.ts'), ...filesUnder('components', '.css'),
    ...filesUnder('lib', '.ts'), ...filesUnder('lib', '.tsx')];
  return files.filter(f => {
    const src = f.endsWith('.css') ? readSource(f).replace(/\/\*[\s\S]*?\*\//g, '') : readCode(f);
    // `… from '…'`, a bare `import '…'`, `import('…')` (next/dynamic too) and a sheet's `@import '…'`.
    return [...src.matchAll(/(?:from\s+|import\s*\(\s*|import\s+|@import\s+(?:url\(\s*)?)['"]([^'"]+)['"]/g)].some(([, spec]) => {
      const rel = spec.startsWith('@/') ? spec.slice(2)
        : spec.startsWith('.') ? path.posix.normalize(path.posix.join(path.posix.dirname(f), spec)) : null;
      return rel === target || rel === noExt;
    });
  }).sort();
}

/**
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * PUBLIC TOURNAMENT PAGES — STAGE 1, PART 1: THE SWITCH AND THE FRAME ON A PHONE (2026-10-27).
 * Plan: docs/projects/active/PUBLIC_TOURNAMENT_SITE_REVIEW_PLAN.md §4, §9, §10a; build prompt
 * PUBLIC_TOURNAMENT_STAGE1_BUILD_PROMPT.md. Rulings: Asks 1, 2, 8, 16; the app-bar direction.
 *
 *   · the new frame was behind ONE server-decided switch (deleted with Stage 8 Part 4b — see "the switch is gone");
 *   · the band's colour goes through the club's roles, and a plan without tournament branding gets the neutral band;
 *   · the band says one of the four state words, never "Game day" / "In progress" / "Tournament Day";
 *   · the visitor's door and the app bar follow where the page is opened, decided by CSS at first paint.
 *
 * PART 2 (2026-10-28): the desk, the footer, the admin preview.
 *   · at a desk the band runs the full width, "Hosted by {club} ›" on its right, over the white full-height rail;
 *   · every page ends in the organizer-colour footer; the paid credit moves into it, a free event keeps its badge;
 *   · in a browser there is no app bar at any width — the platform's desk strip too; inside the installed app it stays;
 *   · the organizer's admin preview wears the same frame, its links kept inside the preview.
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 */

const LAYOUT = 'app/[orgSlug]/[tournamentSlug]/layout.tsx';
const BAND = 'components/public/TournamentBand.tsx';
const FRAME_CSS = 'components/public/TournamentFrame.module.css';
// A frame rule that reaches outside the frame's markup hangs on `.frame`, the class on the one element that carries the
// marker. That also keeps it a pure CSS Module rule (a bare attribute selector fails the production build).
const SCOPED = /:has\(\.frame\)/;

/**
 * STAGE 8 PART 4b (2026-11-04): the preview switch is gone. Stage 1 built the frame behind a cookie (a preview link set it,
 * on in development); Parts 3a–4a removed every page's switch-off half and 4b the two admin readers. What is left is the
 * frame's own helpers — the marker, the band, the roles — which every public tournament page uses.
 */
describe('the preview switch is gone (Stage 8 Part 4b)', () => {
  it('no cookie name, no reader, no redirect helper — only the frame\'s live helpers stay', () => {
    for (const gone of ['PUBLIC_FRAME_COOKIE', 'publicFrameFromCookie', 'safePublicFrameReturn']) {
      assert.equal(gone in publicFrame, false, `lib/public-frame.ts no longer exports ${gone}`);
    }
    assert.doesNotMatch(readCode('lib/public-frame-server.ts'), /isPublicFrameOn|cookies\(|next\/headers/);
    for (const kept of ['PUBLIC_FRAME_ATTR', 'publicFrameAttr', 'publicFrameBand', 'publicFrameHost', 'publicFrameRoles', 'publicFrameRoleCss']) {
      assert.equal(kept in publicFrame, true, `${kept} is the frame's, and stays`);
    }
  });

  it('no setter route, and nothing hands out the preview link', () => {
    assert.equal(sourceExists('app/api/public-frame/route.ts'), false);
    assert.doesNotMatch(readSource('scripts/seed-public-frame-fixtures.mjs'), /api\/public-frame|frame=(on|off)/);
    assert.doesNotMatch(readCode('proxy.ts'), /public-frame|publicFrame/i);
    assert.doesNotMatch(readSource('public/sw.js'), /flhq_public_frame|public-frame/);
  });
});

describe('every public tournament page wears the frame (Stage 8 Part 3d deleted the switch-off chrome)', () => {
  const layout = readCode(LAYOUT);
  it('the marker, the band, the results line and the role colours render unconditionally', () => {
    assert.equal(PUBLIC_FRAME_ATTR, 'data-public-frame');
    assert.deepEqual(publicFrameAttr, { 'data-public-frame': 'light' });
    assert.match(layout, /<div className=\{`\$\{clubFrameStyles\.tokens\} \$\{frameStyles\.frame\}`\} data-club-face=\{frameBand\.face\} \{\.\.\.publicFrameAttr\}>/);
    assert.equal((layout.match(/publicFrameAttr/g) ?? []).length, 2, 'imported once, spread once — on the frame\'s element only');
    assert.match(layout, /const frameBand = publicFrameBand\(org, tournament, todayISO, registration\?\.state === 'open'\);/);
    assert.equal((layout.match(/<TournamentBand\b/g) ?? []).length, 1);
    assert.match(layout, /<div className=\{frameStyles\.main\}>\s*<TodaysResultsLine \/>\s*\{children\}\s*<\/div>/);
    assert.match(layout, /<style dangerouslySetInnerHTML=\{\{ __html: publicFrameRoleCss\(frameBand\.roles\) \}\} \/>/);
  });

  it('the ground is light and there is no card style, whatever the organizer saved (Asks 1 and 11)', () => {
    assert.match(layout, /data-card-style="default"\s+data-color-mode="light"/);
    assert.doesNotMatch(layout, /colorMode|themeCardStyle|canUseAdvancedTournamentBranding/);
  });

  it(':root gets no light-mode block: the frame\'s light set is on its own element', () => {
    assert.doesNotMatch(layout, /buildPublicLightModeCssVars|lightModeVars/);
  });

  it('every rule of the frame\'s own stylesheet is scoped to the frame', () => {
    const css = readCode(FRAME_CSS);
    // A global rule must name the marker; a local class is only ever applied by the frame's own markup.
    for (const sel of css.match(/^[^{}@\n][^{}]*\{/gm) ?? []) {
      if (sel.trim().startsWith(':global(')) assert.match(sel, SCOPED, `a global rule outside the frame: ${sel.trim()}`);
    }
    const shell = readCode('components/consumer/ConsumerShell.module.css');
    const frameRules = shell.split('\n').filter(l => /data-public-frame/.test(l));
    assert.ok(frameRules.length >= 3, 'the app bar\'s light skin is keyed to the marker');
    for (const l of frameRules) assert.match(l, /^:global\(html\):has\(\[data-public-frame='light'\]\) \.bottomNavTournament/);
  });

  it('the platform\'s old tournament bar is gone, with the context fields only it read', () => {
    assert.doesNotMatch(readCode('components/Navbar.tsx'), /data-tournament-nav|tournamentPublicFrame|TournamentNavStatus|eventHead/);
    assert.doesNotMatch(readCode(FRAME_CSS), /data-tournament-nav/, 'the frame no longer hides a bar that never renders');
    assert.ok(!sourceExists('components/public/TournamentNavStatus.tsx') && !sourceExists('lib/tournament-phase-display.ts'));
    const ctx = readCode('components/OrgNavContext.tsx');
    assert.doesNotMatch(ctx, /publicFrame|tournamentColorMode|tournamentHiddenPages|tournamentHasBracket|tournamentRegisterCta|tournamentFinished|fanAlertsEnabled/);
    // Stage 8 Part 4a: the old rail's identity block was the last reader of the org's name, logo and home link and the
    // tournament's name; they left the context, and the sync that only wrote them went too.
    assert.doesNotMatch(ctx, /logoUrl|orgName|orgHomeHref|tournamentName|setOrgNav|\bname: string/);
    assert.ok(!sourceExists('components/OrgNavSync.tsx'));
    for (const f of ['app/[orgSlug]/layout.tsx', LAYOUT, 'app/[orgSlug]/admin/public-site/LookPanel.tsx']) {
      assert.doesNotMatch(readCode(f), /OrgNavSync|setOrgNav/, f);
    }
  });

  it('the old ticker is gone: the frame\'s line is today\'s one games surface, on the scrubbed feed', () => {
    assert.ok(!sourceExists('components/public/ScoreTicker.tsx') && !sourceExists('components/public/ScoreTicker.module.css'));
    assert.equal((layout.match(/<TodaysResultsLine \/>/g) ?? []).length, 1, 'mounted once');
    const hook = readCode('lib/hooks/useTodaysTournamentGames.ts');
    assert.match(hook, /export function useTodaysTournamentGames\(\) \{/);
    assert.match(hook, /fetchPublicTournamentData\(orgSlug, tournamentSlug, 'schedule-preview'\)/);
    assert.match(hook, /section: 'schedule-preview',/);
    assert.doesNotMatch(hook, /publicFrame|'schedule'/);
  });
});

describe('the new frame\'s ticker, as ruled 2026-10-28 (F\'s behaviour in D\'s look)', () => {
  const line = readCode('components/public/TodaysResultsLine.tsx');
  const css = readCode('components/public/TodaysResultsLine.module.css');
  it('one game at a time: a 5 s hold and a 0.8 s fade, one pass, then rest on the newest', () => {
    assert.match(line, /const HOLD_MS = 5000;/);
    assert.match(line, /const FADE_MS = 800;/);
    assert.match(css, /transition: opacity 0\.8s ease;/);
    assert.match(line, /else \{ setMode\('rest'\); if \(list\[0\]\) goTo\(list\[0\]\.id\); \}/);
  });
  it('three state words only: Live, Final, or the start time', () => {
    assert.match(line, /g\.kind === 'live' \? 'Live' : g\.kind === 'final' \? 'Final' : formatTime\(g\.time \?\? ''\)/);
    assert.doesNotMatch(line, /Unofficial|View scores|All results/);
  });
  it('an × is the only control: no pause button, and it hides the line for that day', () => {
    assert.equal((line.match(/<button/g) ?? []).length, 1);
    assert.match(line, /onClick=\{hide\} aria-label="Hide today's games"/);
    assert.doesNotMatch(line, /[Pp]ause|[Pp]lay today/);
    assert.match(line, /localStorage\.setItem\(hideKey, today\)/);
  });
  it('reduced motion: no reel, no fade', () => {
    assert.match(line, /setMode\(!prefersReducedMotion\(\) && reel\.length > 1 \? 'cycle' : 'rest'\)/);
    assert.match(css, /@media \(prefers-reduced-motion: reduce\) \{\s*\.game \{ transition: none; \}/);
  });
  it('calm: no pulse, no glow, no shadow', () => {
    assert.doesNotMatch(css, /animation|text-shadow|box-shadow/);
  });
});

describe('the band\'s colour, for four kinds of organizer (hub "Four organizers, one frame")', () => {
  // A club org (Stage 1a: only an org with the site module lends its look to its tournaments — lib/tournament-look.ts).
  const plus = { planId: 'club', subscriptionStatus: 'active', enabledAddons: [], freeFloor: null, themePreset: 'platform', themePrimary: undefined, themeAccent: undefined } as unknown as LookOrg;
  const none = { themePreset: undefined, themePrimary: undefined, themeAccent: undefined } as const;

  it('a free event: a neutral near-black band with white text and no mark', () => {
    const r = publicFrameRoles({ ...plus, planId: 'tournament' }, { ...none, themePrimary: '#E0457B' });
    assert.equal(r.neutral, true);
    assert.equal(r.fill, CLUB_NEAR_BLACK);
    assert.equal(r.onFill, '#FFFFFF');
  });

  it('a club-run event with no theme of its own wears the organizer\'s (Riverdale, the platform blue)', () => {
    const r = publicFrameRoles(plus, none);
    assert.equal(r.neutral, false);
    assert.equal(r.fill, '#1E3A8A');
    assert.equal(r.onFill, '#FFFFFF');
  });

  it('a tournament\'s own colour wins over the organizer\'s', () => {
    const r = publicFrameRoles({ ...plus, themePrimary: '#1E3A8A' }, { ...none, themePrimary: '#E0457B' });
    assert.notEqual(r.fill, '#1E3A8A');
    assert.ok(r.fill.startsWith('#'));
  });

  it('a pale colour keeps its fill; its text and ink darken until they read', () => {
    const r = publicFrameRoles({ ...plus, themePrimary: '#F2C94C' }, none);
    assert.equal(r.fill, '#F2C94C');
    assert.equal(r.onFill, CLUB_NEAR_BLACK);
    assert.ok(contrastRatio(r.onFill, r.fill) >= 4.5);
    assert.ok(contrastRatio(r.ink, CLUB_GROUND) >= 4.5, 'links and the selected tab read on the ground');
  });

  it('every organizer in the drawing clears the contrast floor', () => {
    for (const c of ['#1E3A8A', '#F2C94C', '#E0457B', '#2C6A2A']) {
      const r = publicFrameRoles({ ...plus, themePrimary: c }, none);
      assert.ok(contrastRatio(r.onFill, r.fill) >= 4.5, `${c}: text on the band`);
      assert.ok(contrastRatio(r.ink, CLUB_GROUND) >= 4.5, `${c}: ink on the ground`);
      assert.ok(contrastRatio(r.edge, CLUB_GROUND) >= 3, `${c}: edge on the ground`);
    }
  });
});

describe('the band (Asks 2, 8, 16 and the app-bar direction)', () => {
  const band = readCode(BAND);
  it('says one of the four state words, from the club\'s own rule', () => {
    const frame = readCode('lib/public-frame.ts');
    assert.match(frame, /const state = tournamentHomeStatus\(tournament, todayISO, registrationOpen\);/);
    assert.match(frame, /word: TOURNAMENT_STATUS_WORD\[state\]/);
    const t = { name: 'Riverdale Summer Classic', status: 'active', startDate: '2026-10-25', endDate: '2026-10-27' };
    const org = { planId: 'tournament_plus', enabledAddons: [], themePreset: 'platform' };
    assert.deepEqual(publicFrameBand(org as never, t as never, '2026-10-26', false).status, { word: 'Live now', live: true });
    // A crowned champion is Finished the moment it is crowned, with no live dot (owner, Stage 2, 2026-10-28).
    const crowned = { ...t, championsCrownedAt: '2026-10-26T21:00:00.000Z' };
    assert.deepEqual(publicFrameBand(org as never, crowned as never, '2026-10-26', false).status, { word: 'Finished', live: false });
    for (const old of ['Game day', 'In progress', 'Tournament Day', 'Upcoming']) {
      assert.doesNotMatch(band, new RegExp(old), `"${old}" is not a state word behind the switch`);
    }
  });

  it('the Overview reads no switch and says no old state word (Stage 8 Part 3d deleted its "Tournament Day" half)', () => {
    const home = readCode('components/public/TournamentHomeContent.tsx');
    assert.doesNotMatch(home, /isPublicFrameOn|frameOn|Tournament Day/);
    assert.doesNotMatch(readCode('components/public/TournamentOverview.tsx'), /Tournament Day|Game day/);
  });

  it('a plan without tournament branding gets no logo and no initials', () => {
    const t = { name: 'Northfield Fall Classic', logoUrl: 'https://x/logo.png', status: 'active', startDate: '2026-10-25', endDate: '2026-10-27' };
    const free = publicFrameBand({ planId: 'tournament', logoUrl: 'https://x/org.png' } as never, t as never, '2026-10-26', false);
    assert.equal(free.logoUrl, null);
    assert.equal(free.initials, null);
    const paid = publicFrameBand({ planId: 'tournament_plus', enabledAddons: [] } as never, { ...t, logoUrl: undefined } as never, '2026-10-26', false);
    assert.equal(paid.initials, 'NF', 'initials when the plan allows a mark and there is no logo');
  });

  it('is built from the club bar\'s parts, and the tab row pins by the club bar\'s own rule', () => {
    assert.match(band, /<header className=\{clubStyles\.bar\} data-public-frame-band="">/);
    assert.match(band, /<TournamentTopTabs\b/);
    assert.doesNotMatch(band, /skin=/, 'the row has one look (Stage 8 Part 4a): no skin to pass');
    // The one hop that keeps the admin preview's tab links inside the preview: the band hands the row its base.
    assert.match(between(band, '<TournamentTopTabs', '/>'), /basePath=\{basePath\}/);
    assert.match(band, /className=\{`\$\{clubStyles\.tabsSlot\} \$\{styles\.tabs\}`\}/);
  });

  it('the visitor\'s door is in the band in a browser, in the app\'s bar inside the installed app — by CSS, at first paint', () => {
    assert.match(band, /<span className=\{styles\.browserOnly\}>/);
    const css = readCode(FRAME_CSS);
    assert.match(css, /@media \(display-mode: standalone\) \{\s*\.browserOnly \{ display: none; \}/);
    assert.match(css, /@media not all and \(display-mode: standalone\) \{[\s\S]*?:global\(\[data-app-bar\]\) \{\s*display: none;/);
    assert.match(readCode('components/consumer/ConsumerNav.tsx'), /aria-label="Primary" data-app-bar="">/);
    assert.doesNotMatch(band, /isStandalonePWA|matchMedia/, 'no script decides it after the first paint');
  });

  it('the operator door sits in the band on the club bar\'s neutral look', () => {
    assert.match(band, /<TournamentFlipPill look="band" \/>/);
  });
});

describe('Part 2: the desk, the footer and the admin preview', () => {
  const layout = readCode(LAYOUT);
  const css = readCode(FRAME_CSS);
  const band = readCode(BAND);

  it('one host rule for the desk band and the footer: a door when the organizer\'s home is real, else plain words', () => {
    assert.deepEqual(publicFrameHost('Riverdale Minor Ball Association', 'Summer Classic', '/riverdale-minor-ball'),
      { kind: 'hosted', name: 'Riverdale Minor Ball Association', href: '/riverdale-minor-ball' });
    assert.deepEqual(publicFrameHost('Metro Sports Events', 'Metro Cup', null), { kind: 'run', name: 'Metro Sports Events' });
    assert.equal(publicFrameHost('Metro Cup', 'Metro Cup', null), null, 'no "Run by X" under X');
    assert.match(layout, /const frameHost = publicFrameHost\(org\.name, tournament\.name, orgHomeHref\);/,
      'the layout\'s own host answer, never a second host test');
    assert.match(band, /\{host\?\.kind === 'hosted' && \(/, 'the band shows the host only as a door');
  });

  it('the footer, the rail\'s place in the desk grid and the credit in the footer, on every page', () => {
    assert.equal((layout.match(/<TournamentFooter\b/g) ?? []).length, 1);
    assert.doesNotMatch(layout, /<BuiltOnCredit|import BuiltOnCredit/, 'the paid credit lives in the footer only (Stage 8 Part 3d removed the old in-flow one)');
    assert.match(layout, /const showBuiltOnCredit = !isFreeTournamentPlan && !isDemoOrgSlug\(orgSlug\);/, 'the credit rules do not change');
    // Stage 7: the rail goes through the focused-page gate (public-focused-page.test.ts); one mount, frame facts passed.
    assert.match(layout, /\{unlessFocused\(<TournamentSideRail hiddenPages=\{navHiddenPages\} hasBracket=\{hasPublicBracket\}\s+frameContent=\{frameContent\} \/>\)\}/);
    // The rail's old `.shell` (it padded the page past a fixed dark rail) went with it in Stage 8 Part 4a: the grid places it.
    assert.match(layout, /className=\{frameStyles\.deskShell\}/);
    assert.doesNotMatch(layout, /railStyles/);
    assert.match(layout, /const frameContactPromise = publicTournamentContactEmail\(tournament\.id, org\.contactEmail \?\? null\)\.catch\(\(\) => null\);/,
      'the footer\'s address is the one Rules and News show');
  });

  it('a free event keeps its badge and its footer carries no second credit', () => {
    const footer = readCode('components/public/TournamentFooter.tsx');
    assert.match(footer, /\{showCredit && <BuiltOnCredit className=\{clubStyles\.credit\} \/>\}/);
    assert.doesNotMatch(footer, /PoweredByBadge|Powered by/);
    assert.match(layout, /showCredit=\{showBuiltOnCredit\}/);
  });

  it('the rail\'s frame look is keyed to the marker, and the old dark rail is gone (Stage 8 Part 4a)', () => {
    const rail = readCode('components/public/TournamentSideRail.module.css');
    for (const l of rail.split('\n').filter(x => x.includes(':global('))) {
      assert.match(l, /:global\(\[data-public-frame='light'\]\) \./, `a rail rule outside the frame: ${l.trim()}`);
    }
    // Only the frame's rules and the bare hooks they need: no fixed box, page padding, identity header, icons or footer.
    assert.doesNotMatch(rail, /\.shell\b|\.railHeader|\.railIdentity|\.railCrumb|\.railLogo|\.railName|\.railFooter|\bsvg\b|::before|position: fixed/);
    const comp = readCode('components/public/TournamentSideRail.tsx');
    assert.doesNotMatch(comp, /useOrgNav|\blogoUrl\b|\bheading\b|\bcolorMode\b|data-color-mode|<Icon\b|Live on FieldLogicHQ/);
    // The club home's sheet never sits inside the frame (its only importer is the club's own home page), so it carries no
    // frame or live-chrome rule: those served the old Overview, which shared it until Stage 8 Part 3d.
    assert.deepEqual(importersOf('app/[orgSlug]/Home.module.css'), ['app/[orgSlug]/page.tsx']);
    const home = readCode('app/[orgSlug]/Home.module.css');
    assert.doesNotMatch(home, /data-public-frame|data-live-chrome/);
    // The old Overview's Explore row went with it (Stage 8 Part 3d): the tab row and the footer's page list are those doors.
    assert.doesNotMatch(readCode('components/public/TournamentHomeContent.tsx'), /exploreRow|btn-ghost/);
    assert.doesNotMatch(home, /\.exploreRow\b/);
  });

  it('in a browser no app bar at any width — the desk strip too; inside the installed app it stays', () => {
    assert.match(readCode('components/consumer/ConsumerNav.tsx'), /<header className=\{`\$\{styles\.topbar\} \$\{styles\.topbarStrip\}`\} data-app-bar="">/);
    assert.match(css, /@media not all and \(display-mode: standalone\) \{\s*:global\(html\):has\(\.frame\) \{[^}]*--desktop-strip-h: 0px;/);
    assert.match(css, /@media \(display-mode: standalone\) and \(min-width: 901px\) \{\s*\.bandDoor \{ display: none; \}/,
      'inside the app on a desk the strip carries the operator door, so the band\'s steps aside');
  });

  it('the admin preview always wears the frame, with its links kept inside the preview (Stage 8 Part 4a)', () => {
    const preview = readCode('app/[orgSlug]/admin/tournaments/preview/[tournamentSlug]/layout.tsx');
    // No switch and no old half: the dark top bar, the fixed tab row, the light-mode :root block and card style all went.
    assert.doesNotMatch(preview, /isPublicFrameOn|TournamentPreviewNav|TournamentTopTabs|getPreviewColorMode|getPreviewCardStyle|lightModeVars|cardStyle|railStyles/);
    for (const gone of ['components/public/TournamentPreviewNav.tsx', 'components/public/TournamentPreviewNav.module.css',
      'components/public/TournamentTopTabs.module.css']) assert.ok(!sourceExists(gone), `${gone} left with the preview's old half`);
    assert.doesNotMatch(readCode('lib/tournament-preview.ts'), /getPreviewColorMode|getPreviewCardStyle|buildPublicLightModeCssVars/);
    assert.doesNotMatch(readCode('lib/public-tournament-theme.ts'), /buildPublicLightModeCssVars/);
    assert.equal((preview.match(/<TournamentBand\b/g) ?? []).length, 1);
    assert.equal((preview.match(/<TournamentSideRail\b/g) ?? []).length, 1);
    assert.match(preview, /const band = publicFrameBand\(org, tournament, tournamentToday\(\), registrationOpen\);/,
      'the live band\'s one helper');
    assert.match(preview, /basePath=\{previewBase\}\s*\/>\s*<TournamentSideRail basePath=\{previewBase\}/);
    assert.match(band, /\{!preview && <SharePageButton/);
    // The visitor's doors share one read of the viewer's hats (BandDoors); the sandbox shows no account menu but keeps its door.
    assert.match(band, /\{!inSandbox && !preview \? \(\s*<BandDoors/);
    assert.match(band, /\) : !preview && \(\s*<span className=\{styles\.bandDoor\}>/);
  });
});

/**
 * PART 3 (2026-10-28): the readable baseline, A — the Overview, Schedule, a game's page, the My Team surfaces, Register
 * and the pay page keep today's layout and read on the light ground. Every look is keyed to the marker, so with the
 * switch off each page is today's.
 */
describe('Part 3: the readable baseline, A', () => {
  const css = readCode(FRAME_CSS);
  const KEYED = /^(:global\(\[data-public-frame='light'\]\)|\[data-public-frame='light'\]) \./;
  // The old Schedule's sheet left with the old Playoffs (Stage 8 Part 3c; its deletion is pinned by the Stage 3 guard).
  // The old Overview's follow strip and team picker sheets left with it (Stage 8 Part 3d; pinned below).
  // Three sheets left this list in Stage 8 Part 4a, their frame rule deleted because nothing they style ever renders
  // inside the frame (pinned below): the club home's (its only importer is the club's own home page), the preview's exit
  // pill (mounted beside the frame, not in it) and the rep-team page's subscribe panel (outside the tournament layout).
  const PART3_SHEETS = [
    'app/[orgSlug]/register/register.module.css',
    'components/public/PublicTournamentState.module.css',
    'components/public/FollowAlertsToggle.module.css',
    'components/public/MyTeamDock.module.css',
    'components/public/DesktopMyTeamRailCard.module.css',
    'components/public/ShareScoreButton.module.css',
    'components/public/AlertsNudge.module.css',
    'components/public/FollowDeepLinkPrompt.module.css',
    'components/shared/FlipPill.module.css',
  ];

  it('today\'s Light mode cannot hand the organizer\'s raw colour back to text inside the frame', () => {
    // globals.css re-declares these on the shell, which sits INSIDE the frame; the frame re-points them one step more
    // specific. The live shell and the admin preview's both carry `deskShell` (the preview has no other branch since Part 4a).
    assert.match(readCode('app/globals.css'), /\[data-card-style\]\[data-color-mode="light"\] \{\s*--primary-light: var\(--primary\);/);
    assert.match(css, /\.frame \.deskShell\[data-color-mode\] \{[^}]*--primary-light: +var\(--club-ink\);[^}]*--success-strong: +var\(--club-ok\);/);
    assert.match(readCode(LAYOUT), /className=\{frameStyles\.deskShell\}/);
    assert.match(css, /\.frame \.deskShell\[data-color-mode\] :global\(\.btn-outline\) \{[^}]*color: var\(--club-ink\);/);
  });

  it('the type: sentence case, even-width figures and the title face\'s own weight, under the frame only', () => {
    assert.match(css, /\.frame \.main \{\s*font-variant-numeric: tabular-nums;/);
    assert.match(css, /\.frame \.main \* \{\s*text-transform: none;/);
    assert.match(css, /\.frame \.main :is\(h1, h2, h3, h4\) \{\s*font-weight: var\(--club-title-weight\);/);
  });

  it('every readable-baseline rule in the pages\' and components\' own stylesheets is keyed to the marker', () => {
    for (const file of PART3_SHEETS) {
      const lines = readCode(file).split('\n').filter(l => /data-public-frame/.test(l));
      assert.ok(lines.length > 0, `${file} carries its frame look`);
      for (const l of lines) assert.match(l.trim(), KEYED, `${file}: a frame rule not keyed to the marker: ${l.trim()}`);
    }
    for (const gone of ['components/public/FollowTournamentStrip.module.css', 'components/public/FollowTeamPicker.module.css']) {
      assert.ok(!sourceExists(gone), `${gone} left with the old Overview`);
    }
  });

  it('a sheet whose classes never render inside the frame carries no frame rule (Stage 8 Part 4a)', () => {
    for (const file of ['app/[orgSlug]/Home.module.css', 'components/public/PreviewExitPill.module.css',
      'components/public/TeamSubscribeButton.module.css']) {
      assert.doesNotMatch(readCode(file), /data-public-frame/, file);
    }
    const preview = readCode('app/[orgSlug]/admin/tournaments/preview/[tournamentSlug]/layout.tsx');
    assert.ok(preview.indexOf('<PreviewExitPill') > preview.lastIndexOf('</div>'), 'the exit pill sits after the frame, not in it');
    assert.deepEqual(importersOf('components/public/TeamSubscribeButton.tsx'), ['components/public/RepTeamPublicSchedule.tsx']);
    assert.doesNotMatch(readCode('app/[orgSlug]/news/news.module.css'), /data-public-frame='light'\]\) \.featuredBadge/);
  });

  // Stage 8 Part 3b deleted the old Schedule (whose playoffs' format badge and final standings this part had moved out
  // of inline styles) and MyTeamCard with it; the same rule now holds for the Schedule's only body.
  it('the Schedule\'s final standings carry no inline wash of the organizer\'s colour; the frame reaches them by class', () => {
    const schedule = readCode('components/public/PublicSchedule.tsx');
    assert.doesNotMatch(schedule, /rgba\(var\(--primary-rgb\)/, 'no inline wash of the organizer\'s colour');
    assert.match(schedule, /<ol className=\{styles\.placements\}>/);
    assert.match(readCode('components/public/PublicSchedule.module.css'), /^\.placements li \{[^}]*border-bottom: 1px solid var\(--club-line\);/m,
      'the frame\'s own line token, not the organizer\'s colour');
  });
});

describe('Part 4: the readable baseline, B', () => {
  const KEYED = /^(:global\(\[data-public-frame='light'\]\)|\[data-public-frame='light'\]) \./;
  // Stage 8 Part 3a deleted the old Standings, Teams, team-page and Rules sheets with their pages, and Part 3c the old
  // bracket's, the old Playoffs' and the old Champions' (each pinned by its group's guard: Stage 4, 5, 6-rules, 6-champions).
  const PART4_SHEETS = [
    'app/[orgSlug]/news/news.module.css',
  ];

  it('every readable-baseline rule in the pages\' own stylesheets is keyed to the marker', () => {
    for (const file of PART4_SHEETS) {
      const lines = readCode(file).split('\n').filter(l => /data-public-frame/.test(l));
      assert.ok(lines.length > 0, `${file} carries its frame look`);
      for (const l of lines) assert.match(l.trim(), KEYED, `${file}: a frame rule not keyed to the marker: ${l.trim()}`);
    }
  });

  // The old SVG bracket (whose card and banner this part had moved out of inline styles) left in Stage 8 Part 3c; the
  // same rule now holds for the only bracket the public pages draw.
  it('the public bracket carries no inline wash of the organizer\'s colour; its own sheet paints it with the frame\'s tokens', () => {
    const bracket = readCode('components/bracket/PublicBracket.tsx');
    assert.doesNotMatch(bracket, /primary-rgb|drop-shadow|fill=|stroke=/, 'no inline organizer colour or SVG paint');
    assert.match(readCode('components/bracket/PublicBracket.module.css'), /^\.bracket \{[^}]*border: 1px solid var\(--club-line-2\);[^}]*background: var\(--club-card\);/m);
  });

  it('the Teams monogram and its readable ink left with the old Teams pages (Stage 8 Part 3a)', () => {
    // The sheets' deletion is pinned by each page group's own guard (Stage 4, 5 and 6-rules). The new list and page draw no
    // monogram, so nothing needs the ink; the helper went with its last caller.
    for (const body of ['PublicTeams', 'PublicTeamPage']) assert.doesNotMatch(readCode(`components/public/${body}.tsx`), /teamColor|teamInk|--team-ink/);
    assert.doesNotMatch(readCode('lib/team-color.ts'), /export function teamInk/);
  });
});

/**
 * STAGE 8 PART 4a (2026-11-04) left the switch read by two admin routes, the setter and its definition; PART 4b deleted
 * them all. The census stays, EMPTY: a new reader — by name, a `frameOn` prop or flag, the cookie spelled out by hand, or
 * a link to the old setter — fails here.
 */
describe('Stage 8 Part 4b: nothing reads the switch', () => {
  it('the census is empty across app, components, lib, scripts, proxy and the service worker', () => {
    // Every script-like file in the four trees (the .js/.mjs/.cjs ones too), read RAW as well as comment-stripped: the
    // stripper's block pass is not string-aware, so a `/*` inside a string could hide a reader from `readCode` alone.
    const files = ['app', 'components', 'lib', 'scripts'].flatMap(dir => ['.ts', '.tsx', '.js', '.mjs', '.cjs'].flatMap(ext => filesUnder(dir, ext)));
    const READER = /\bisPublicFrameOn\b|\bpublicFrameFromCookie\b|\bPUBLIC_FRAME_COOKIE\b|\bsafePublicFrameReturn\b|flhq_public_frame|\bframeOn\b|\/api\/public-frame(?![\w-])/;
    const readers = [...files, 'proxy.ts']
      .filter(f => READER.test(readCode(f)) || /\bisPublicFrameOn\b|\bpublicFrameFromCookie\b|flhq_public_frame|\/api\/public-frame(?![\w-])/.test(readSource(f).replace(/^\s*(\/\/|\*).*$/gm, '')))
      .sort();
    assert.deepEqual(readers, []);
    assert.doesNotMatch(readSource('public/sw.js'), /flhq_public_frame/);
  });
});
