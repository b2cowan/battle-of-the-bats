import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readCode } from './_source-code.ts';
import {
  PUBLIC_FRAME_ATTR,
  publicFrameAttr,
  publicFrameBand,
  publicFrameFromCookie,
  publicFrameHost,
  publicFrameRoles,
  safePublicFrameReturn,
} from '../../lib/public-frame.ts';
import { CLUB_GROUND, CLUB_NEAR_BLACK } from '../../lib/club-colour-roles.ts';
import { contrastRatio } from '../../lib/color-contrast.ts';

/**
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * PUBLIC TOURNAMENT PAGES — STAGE 1, PART 1: THE SWITCH AND THE FRAME ON A PHONE (2026-10-27).
 * Plan: docs/projects/active/PUBLIC_TOURNAMENT_SITE_REVIEW_PLAN.md §4, §9, §10a; build prompt
 * PUBLIC_TOURNAMENT_STAGE1_BUILD_PROMPT.md. Rulings: Asks 1, 2, 8, 16; the app-bar direction.
 *
 *   · the new frame is behind ONE server-decided switch, and with it off nothing a customer sees changes;
 *   · the band's colour goes through the club's roles, and a plan without tournament branding gets the neutral band;
 *   · the band says one of the four state words, never "Game day" / "In progress" / "Tournament Day";
 *   · the visitor's door and the app bar follow where the page is opened, decided by CSS at first paint.
 *
 * PART 2 (2026-10-28): the desk, the footer, the admin preview.
 *   · at a desk the band runs the full width, "Hosted by {club} ›" on its right, over the white full-height rail;
 *   · every page ends in the organizer-colour footer; the paid credit moves into it, a free event keeps its badge;
 *   · in a browser there is no app bar at any width — the platform's desk strip too; inside the installed app it stays;
 *   · the organizer's admin preview follows the same switch, its links kept inside the preview.
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 */

const LAYOUT = 'app/[orgSlug]/[tournamentSlug]/layout.tsx';
const BAND = 'components/public/TournamentBand.tsx';
const FRAME_CSS = 'components/public/TournamentFrame.module.css';
// A frame rule that reaches outside the frame's markup hangs on `.frame`, the class on the one element that carries the
// marker. That also keeps it a pure CSS Module rule (a bare attribute selector fails the production build).
const SCOPED = /:has\(\.frame\)/;

describe('the preview switch', () => {
  it('the browser\'s cookie decides; with none, on in development only', () => {
    assert.equal(publicFrameFromCookie('on', false), true, 'the preview link turns it on anywhere');
    assert.equal(publicFrameFromCookie('off', true), false, 'its twin turns it off, even on dev');
    assert.equal(publicFrameFromCookie(undefined, true), true, 'on in development with no step');
    assert.equal(publicFrameFromCookie(undefined, false), false, 'off for every customer and the public demo');
    assert.equal(publicFrameFromCookie('yes', false), false, 'an unknown value is no answer');
  });

  it('the link only ever returns to a path on this site', () => {
    assert.equal(safePublicFrameReturn('/riverdale-minor-ball/summer-classic'), '/riverdale-minor-ball/summer-classic');
    for (const bad of ['//evil.example', '/\\evil.example', '/\t//evil.example', '/\n/evil.example', '/.//evil.example', '/a/..//evil.example', '/%2e//evil.example', 'https://evil.example/x', 'evil', '', null, undefined]) {
      assert.equal(safePublicFrameReturn(bad), '/', `refuses ${String(bad)}`);
    }
  });

  it('is decided on the server by the one helper, never in proxy.ts', () => {
    const layout = readCode(LAYOUT);
    assert.match(layout, /const frameOn = await isPublicFrameOn\(\);/);
    assert.doesNotMatch(readCode('proxy.ts'), /public-frame|publicFrame/i);
    const route = readCode('app/api/public-frame/route.ts');
    assert.match(route, /safePublicFrameReturn\(/, 'the redirect target is checked');
    assert.match(route, /resolveSameHostOrigin\(/, 'the redirect stays on a host we trust');
  });
});

describe('with the switch off, nothing a customer sees changes', () => {
  const layout = readCode(LAYOUT);
  it('the marker, the band and the in-flow ticker render only when the switch is on', () => {
    assert.equal(PUBLIC_FRAME_ATTR, 'data-public-frame');
    assert.deepEqual(publicFrameAttr, { 'data-public-frame': 'light' });
    assert.match(layout, /return frameOn\s*\?\s*<>\{growthChrome\}<div className=\{`\$\{clubFrameStyles\.tokens\} \$\{frameStyles\.frame\}`\} \{\.\.\.publicFrameAttr\}>\{page\}<\/div><\/>\s*:\s*page;/);
    assert.match(layout, /\{!frameOn && growthChrome\}/, 'the free badge and banner where they always were, when off');
    assert.equal((layout.match(/publicFrameAttr/g) ?? []).length, 2, 'imported once, spread once — on the frame\'s element only');
    assert.match(layout, /\{frameBand && \(\s*<TournamentBand/);
    assert.match(layout, /const frameBand = frameOn \? publicFrameBand\(org, tournament, todayISO, registration\?\.state === 'open'\) : null;/);
    assert.match(layout, /\{!frameOn && <ScoreTicker \/>\}/, 'today\'s fixed ticker, unchanged, when off');
    assert.match(layout, /\{frameOn \? \(\s*<div className=\{frameStyles\.main\}>\s*<TodaysResultsLine \/>\s*\{children\}\s*<\/div>\s*\) : children\}/);
    assert.match(layout, /\{frameBand && \(\s*<style dangerouslySetInnerHTML=\{\{ __html: publicFrameRoleCss\(frameBand\.roles\) \}\}/);
  });

  it('the organizer\'s saved Dark/Light is today\'s behaviour when off', () => {
    assert.match(layout, /const effectiveColorMode = frameOn \? 'light' : canUseAdvancedBranding \? tournament\.colorMode \?\? 'dark' : 'dark';/);
  });

  it('under the frame :root stays as today, so what is drawn outside it for a dark page (the demo dock, the free badge) is untouched', () => {
    assert.match(layout, /const lightModeVars = !frameOn && effectiveColorMode === 'light' \? buildPublicLightModeCssVars\(\) : null;/);
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

  it('the old header steps aside only under the frame', () => {
    const nav = readCode('components/Navbar.tsx');
    assert.match(nav, /if \(tournamentPublicFrame\) return null;/);
    assert.match(nav, /data-tournament-nav=""/);
    assert.match(readCode(FRAME_CSS), /:global\(html\):has\(\.frame\) :global\(\[data-tournament-nav\]\) \{\s*display: none;/);
  });

  it('today\'s ticker is untouched by the frame: the new line is a separate component the frame alone mounts', () => {
    assert.doesNotMatch(readCode('components/public/ScoreTicker.tsx'), /inFlow/);
    assert.equal((layout.match(/<TodaysResultsLine \/>/g) ?? []).length, 1, 'mounted once, inside the frame\'s branch');
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
  const plus = { planId: 'tournament_plus', themePreset: 'platform', themePrimary: undefined, themeAccent: undefined } as const;
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
    const org = { planId: 'tournament_plus', themePreset: 'platform' };
    assert.deepEqual(publicFrameBand(org as never, t as never, '2026-10-26', false).status, { word: 'Live now', live: true });
    // A crowned champion is Finished the moment it is crowned, with no live dot (owner, Stage 2, 2026-10-28).
    const crowned = { ...t, championsCrownedAt: '2026-10-26T21:00:00.000Z' };
    assert.deepEqual(publicFrameBand(org as never, crowned as never, '2026-10-26', false).status, { word: 'Finished', live: false });
    for (const old of ['Game day', 'In progress', 'Tournament Day', 'Upcoming']) {
      assert.doesNotMatch(band, new RegExp(old), `"${old}" is not a state word behind the switch`);
    }
  });

  it('the Overview\'s game-day panel says "Live now" behind the switch (its layout is Stage 2\'s)', () => {
    const home = readCode('components/public/TournamentHomeContent.tsx');
    assert.match(home, /const frameOn = await isPublicFrameOn\(\);/, 'the admin preview follows the same switch (Part 2)');
    assert.match(home, /\{frameOn \? TOURNAMENT_STATUS_WORD\.live : 'Tournament Day'\}/);
  });

  it('a plan without tournament branding gets no logo and no initials', () => {
    const t = { name: 'Northfield Fall Classic', logoUrl: 'https://x/logo.png', status: 'active', startDate: '2026-10-25', endDate: '2026-10-27' };
    const free = publicFrameBand({ planId: 'tournament', logoUrl: 'https://x/org.png' } as never, t as never, '2026-10-26', false);
    assert.equal(free.logoUrl, null);
    assert.equal(free.initials, null);
    const paid = publicFrameBand({ planId: 'tournament_plus' } as never, { ...t, logoUrl: undefined } as never, '2026-10-26', false);
    assert.equal(paid.initials, 'NF', 'initials when the plan allows a mark and there is no logo');
  });

  it('is built from the club bar\'s parts, and the tab row pins by the club bar\'s own rule', () => {
    assert.match(band, /<header className=\{clubStyles\.bar\} data-public-frame-band="">/);
    assert.match(band, /skin="frame"/);
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
    assert.match(layout, /const frameHost = frameOn \? publicFrameHost\(org\.name, tournament\.name, orgHomeHref\) : null;/,
      'the layout\'s own host answer, never a second host test');
    assert.match(band, /\{host\?\.kind === 'hosted' && \(/, 'the band shows the host only as a door');
  });

  it('the footer, the rail\'s new place and the desk grid render only under the switch; off is today\'s page', () => {
    assert.match(layout, /\{frameOn && \(\s*<TournamentFooter/);
    assert.match(layout, /\{!frameOn && showBuiltOnCredit && <BuiltOnCredit \/>\}/, 'the paid credit where it always was, when off');
    assert.match(layout, /const showBuiltOnCredit = !isFreeTournamentPlan && !isDemoOrgSlug\(orgSlug\);/, 'the credit rules do not change');
    assert.match(layout, /\{!frameOn && <TournamentSideRail \/>\}/);
    assert.match(layout, /\{frameOn && <TournamentSideRail \/>\}/);
    assert.match(layout, /className=\{frameOn \? `\$\{railStyles\.shell\} \$\{frameStyles\.deskShell\}` : railStyles\.shell\}/);
    assert.match(layout, /const frameContactPromise = frameOn\s*\? publicTournamentContactEmail\(tournament\.id, org\.contactEmail \?\? null\)/,
      'the footer\'s address is the one Rules and News show, and is never looked up when off');
  });

  it('a free event keeps its badge and its footer carries no second credit', () => {
    const footer = readCode('components/public/TournamentFooter.tsx');
    assert.match(footer, /\{showCredit && <BuiltOnCredit className=\{clubStyles\.credit\} \/>\}/);
    assert.doesNotMatch(footer, /PoweredByBadge|Powered by/);
    assert.match(layout, /showCredit=\{showBuiltOnCredit\}/);
  });

  it('the rail\'s and the Overview\'s frame looks are keyed to the marker', () => {
    const rail = readCode('components/public/TournamentSideRail.module.css');
    for (const l of rail.split('\n').filter(x => x.includes(':global('))) {
      assert.match(l, /:global\(\[data-public-frame='light'\]\) \./, `a rail rule outside the frame: ${l.trim()}`);
    }
    assert.match(rail, /^\.stick \{ display: contents; \}/m, 'the wrapper is nothing when the frame is off');
    const home = readCode('app/[orgSlug]/Home.module.css');
    assert.match(home, /^\[data-public-frame='light'\] \.hero \{ display: none; \}/m);
    assert.match(readCode('components/public/TournamentHomeContent.tsx'), /\{!frameOn && \(showSchedulePage \|\| /,
      'the Explore row steps aside only under the frame');
  });

  it('in a browser no app bar at any width — the desk strip too; inside the installed app it stays', () => {
    assert.match(readCode('components/consumer/ConsumerNav.tsx'), /<header className=\{`\$\{styles\.topbar\} \$\{styles\.topbarStrip\}`\} data-app-bar="">/);
    assert.match(css, /@media not all and \(display-mode: standalone\) \{\s*:global\(html\):has\(\.frame\) \{[^}]*--desktop-strip-h: 0px;/);
    assert.match(css, /@media \(display-mode: standalone\) and \(min-width: 901px\) \{\s*\.bandDoor \{ display: none; \}/,
      'inside the app on a desk the strip carries the operator door, so the band\'s steps aside');
  });

  it('the admin preview follows the same switch, with its links kept inside the preview', () => {
    const preview = readCode('app/[orgSlug]/admin/tournaments/preview/[tournamentSlug]/layout.tsx');
    assert.match(preview, /if \(await isPublicFrameOn\(\)\) \{/);
    assert.match(preview, /const band = publicFrameBand\(org, tournament, tournamentToday\(\), registration\?\.state === 'open'\);/,
      'the live band\'s one helper');
    assert.match(preview, /basePath=\{previewBase\}\s*\/>\s*<TournamentSideRail basePath=\{previewBase\}/);
    assert.match(preview, /<TournamentPreviewNav/, 'today\'s preview, when off');
    assert.match(band, /\{!preview && <SharePageButton/);
    assert.match(band, /\{!inSandbox && !preview && \(/);
    assert.match(band, /\{!preview && \(\s*<span className=\{styles\.bandDoor\}>/);
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
  const PART3_SHEETS = [
    'app/[orgSlug]/Home.module.css',
    'app/[orgSlug]/schedule/schedule.module.css',
    'app/[orgSlug]/register/register.module.css',
    'components/public/PublicTournamentState.module.css',
    'components/public/FollowTournamentStrip.module.css',
    'components/public/FollowAlertsToggle.module.css',
    'components/public/MyTeamCard.module.css',
    'components/public/MyTeamDock.module.css',
    'components/public/DesktopMyTeamRailCard.module.css',
    'components/public/ShareScoreButton.module.css',
    'components/public/AlertsNudge.module.css',
    'components/public/FollowDeepLinkPrompt.module.css',
    'components/public/FollowTeamPicker.module.css',
    'components/public/PreviewExitPill.module.css',
    'components/public/TeamSubscribeButton.module.css',
    'components/shared/FlipPill.module.css',
  ];

  it('today\'s Light mode cannot hand the organizer\'s raw colour back to text inside the frame', () => {
    // globals.css re-declares these on the shell, which sits INSIDE the frame; the frame re-points them one step more
    // specific. The shell carries `deskShell` only in the frame's branch of both layouts.
    assert.match(readCode('app/globals.css'), /\[data-card-style\]\[data-color-mode="light"\] \{\s*--primary-light: var\(--primary\);/);
    assert.match(css, /\.frame \.deskShell\[data-color-mode\] \{[^}]*--primary-light: +var\(--club-ink\);[^}]*--success-strong: +var\(--club-ok\);/);
    assert.match(readCode(LAYOUT), /className=\{frameOn \? `\$\{railStyles\.shell\} \$\{frameStyles\.deskShell\}` : railStyles\.shell\}/);
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
  });

  it('the playoffs\' format badge and final standings moved out of inline styles unchanged, so the frame can reach them', () => {
    const content = readCode('components/public/ScheduleContent.tsx');
    assert.doesNotMatch(content, /rgba\(var\(--primary-rgb\)/, 'no inline wash of the organizer\'s colour is left');
    assert.match(content, /className=\{styles\.placementStandings\}/);
    const schedule = readCode('app/[orgSlug]/schedule/schedule.module.css');
    assert.match(schedule, /^\.placementStandings \{[^}]*border: 1px solid rgba\(var\(--primary-rgb\), 0\.25\);/m);
    assert.match(schedule, /^\.placementStandingsRow \+ \.placementStandingsRow \{\s*border-top: 1px solid var\(--white-10\);/m);
  });
});

describe('Part 4: the readable baseline, B', () => {
  const KEYED = /^(:global\(\[data-public-frame='light'\]\)|\[data-public-frame='light'\]) \./;
  const PART4_SHEETS = [
    'app/[orgSlug]/standings/standings.module.css',
    'components/bracket/LogicSyncBracket.module.css',
    'components/public/PlayoffPicture.module.css',
    'app/[orgSlug]/teams/teams.module.css',
    'app/[orgSlug]/[tournamentSlug]/teams/[id]/team-profile.module.css',
    'app/[orgSlug]/news/news.module.css',
    'app/[orgSlug]/rules/rules.module.css',
    'components/public/ChampionsRecap.module.css',
  ];

  it('every readable-baseline rule in the pages\' own stylesheets is keyed to the marker', () => {
    for (const file of PART4_SHEETS) {
      const lines = readCode(file).split('\n').filter(l => /data-public-frame/.test(l));
      assert.ok(lines.length > 0, `${file} carries its frame look`);
      for (const l of lines) assert.match(l.trim(), KEYED, `${file}: a frame rule not keyed to the marker: ${l.trim()}`);
    }
  });

  it('the bracket card and the champion banner moved out of inline styles unchanged, so the frame can reach them', () => {
    const bracket = readCode('components/bracket/LogicSyncBracket.tsx');
    assert.doesNotMatch(bracket, /rgba\(var\(--primary-rgb\), 0\.(85|08)\)/, 'no inline wash or edge of the organizer\'s colour is left');
    assert.doesNotMatch(bracket, /drop-shadow/);
    const css = readCode('components/bracket/LogicSyncBracket.module.css');
    assert.match(css, /^\.nodeCard \{\s*fill: var\(--bracket-card, var\(--surface\)\);\s*stroke: rgba\(var\(--primary-rgb\), 0\.85\);\s*stroke-width: 1\.25;/m);
    // The halo is an SVG attribute (a stylesheet's url(#…) is not resolved alike everywhere); the frame's CSS outranks it.
    assert.match(bracket, /filter=\{node\.isLive \|\| showHighlightRing \? 'url\(#glow-primary\)' : undefined\}/);
    assert.doesNotMatch(css, /url\(#/, 'no fragment reference from the stylesheet');
    assert.match(css, /:global\(\[data-public-frame='light'\]\) \.nodeCardHalo,/);
    assert.match(css, /^\.nodeMeta \{ fill: rgba\(var\(--primary-rgb\), 0\.08\); \}/m);
  });

  it('the Teams monogram\'s readable ink is read only under the frame', () => {
    assert.match(readCode('components/public/TeamsContent.tsx'), /'--team-ink': teamInk\(name\)/);
    const teams = readCode('app/[orgSlug]/teams/teams.module.css');
    assert.match(teams, /^\.teamAvatar \{[^}]*color: var\(--on-team-color\);/m, 'today\'s monogram ink, unchanged');
    assert.match(teams, /:global\(\[data-public-frame='light'\]\) \.teamAvatar \{ color: var\(--team-ink, var\(--on-team-color\)\); \}/);
  });
});
