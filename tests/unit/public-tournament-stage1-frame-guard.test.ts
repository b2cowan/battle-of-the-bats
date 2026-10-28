import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readCode } from './_source-code.ts';
import {
  PUBLIC_FRAME_ATTR,
  publicFrameAttr,
  publicFrameFromCookie,
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
    for (const bad of ['//evil.example', '/\\evil.example', 'https://evil.example/x', 'evil', '', null, undefined]) {
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
    assert.match(layout, /\{frameRoles && \(\s*<TournamentBand/);
    assert.match(layout, /const frameRoles = frameOn \? publicFrameRoles\(org, tournament\) : null;/);
    assert.match(layout, /\{!frameOn && <ScoreTicker \/>\}/, 'today\'s fixed ticker, unchanged, when off');
    assert.match(layout, /\{frameOn && <ScoreTicker inFlow \/>\}/);
    assert.match(layout, /\{frameRoles && \(\s*<style dangerouslySetInnerHTML=\{\{ __html: `html:has\(\[data-public-frame="light"\]\)/);
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

  it('the ticker\'s in-flow placement is the prop\'s alone', () => {
    const ticker = readCode('components/public/ScoreTicker.tsx');
    assert.match(ticker, /\$\{inFlow \? ` \$\{styles\.inFlow\}` : ''\}/);
    assert.match(ticker, /\{ inFlow = false \}/);
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
    const layout = readCode(LAYOUT);
    assert.match(layout, /tournamentHomeStatus\(tournament, todayISO, registration\?\.state === 'open'\)/);
    assert.match(layout, /word: TOURNAMENT_STATUS_WORD\[frameStatus\]/);
    for (const old of ['Game day', 'In progress', 'Tournament Day', 'Upcoming']) {
      assert.doesNotMatch(band, new RegExp(old), `"${old}" is not a state word behind the switch`);
    }
  });

  it('the Overview\'s game-day panel says "Live now" behind the switch (its layout is Stage 2\'s)', () => {
    const home = readCode('components/public/TournamentHomeContent.tsx');
    assert.match(home, /const frameOn = !isPreview && await isPublicFrameOn\(\);/);
    assert.match(home, /\{frameOn \? TOURNAMENT_STATUS_WORD\.live : 'Tournament Day'\}/);
  });

  it('a plan without tournament branding gets no logo and no initials', () => {
    const layout = readCode(LAYOUT);
    assert.match(layout, /logoUrl=\{frameRoles\.neutral \? null :/);
    assert.match(layout, /initials=\{frameRoles\.neutral \? null :/);
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
