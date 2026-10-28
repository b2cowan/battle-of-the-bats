/**
 * PUBLIC SITE (Tournament admin redesign Stage 5, Part 7 — E7, A53; F29, F90's page half, J1-064). What the build must
 * keep true:
 *   - a door card to the site at the top, at every width: "Preview" while a draft, "Online" after (never "Live");
 *   - Pages first, as 52px switch rows, on every plan; the six branding parts as closed cards that say what each holds;
 *   - every change saves itself (no bottom Save, no "Unsaved changes", no success pop-ups); nothing is lost by leaving;
 *   - the theme's drawn mock is gone; a colour can be typed as a hex code;
 *   - the free plan's locked view stays as today (the free tier review decides it);
 *   - the shared settings sheet's old look is folded (all three screens that used it rebuilt).
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { PUBLIC_SITE_WORDS as W, appIconSummary, parseHex, themeSummary } from '../../lib/tournament-settings-words.ts';

const read = (p: string) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');
const code = (p: string) => read(p).replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
const PAGE = 'app/[orgSlug]/admin/tournaments/branding/page.tsx';

describe('the words (E7)', () => {
  it('the door says Preview or Online, never Live', () => {
    assert.equal(W.door, 'See your public site');
    assert.equal(W.previewEyebrow, 'Preview');
    assert.equal(W.onlineEyebrow, 'Online');
    assert.doesNotMatch(JSON.stringify(W), /\bLive\b/);
  });
  it('the cards say what they hold', () => {
    assert.equal(themeSummary('Forest Green', 'light'), 'Forest Green · light');
    assert.equal(themeSummary(null, 'dark'), 'Custom colours · dark');
    assert.equal(appIconSummary(true, 'white'), 'The logo on white');
    assert.equal(appIconSummary(false, 'auto'), 'No logo yet');
  });
  it('a hex code is read with or without its #, in either case', () => {
    assert.equal(parseHex('1E3A8A'), '#1e3a8a');
    assert.equal(parseHex('#D9F99D'), '#d9f99d');
    assert.equal(parseHex('#12345'), null);
    assert.equal(parseHex('blue'), null);
  });
});

describe('the screen (E7)', () => {
  const page = code(PAGE);
  it('the door card comes first: the preview while a draft (or archived, its site offline), the public page after', () => {
    assert.match(page, /status === 'draft' \|\| status === 'archived' \?[\s\S]*W\.previewEyebrow : W\.offlineEyebrow[\s\S]*eyebrow=\{W\.onlineEyebrow\}/);
    assert.ok(page.indexOf('{door}') < page.indexOf('<ClubSection id="pages"'));
  });
  it('a save goes to the tournament its draft was read from, never another (a switch mid-edit)', () => {
    assert.match(page, /type Held = \{ url: string; advanced: boolean; draft: Draft; themeChanged: boolean \}/);
    assert.match(page, /latest\.current && latest\.current\.url === held\.url \? latest\.current : held/);
    assert.match(page, /if \(edits\.current !== editsAtStart && latest\.current\?\.url === brandingUrl\) return;/);
  });
  it('Pages are switch rows on every plan; the six parts are closed cards with their summaries', () => {
    assert.match(page, /<SwitchRows label=\{W\.pages\} columns=\{2\}>/);
    for (const t of ['W.logo', 'W.appIcon', 'W.theme', 'W.heroBanner', 'W.font', 'W.cardStyle']) {
      assert.match(page, new RegExp(`<CollapsibleCard title=\\{${t.replace('.', '\\.')}\\}[^>]*defaultOpen=\\{false\\} meta=`));
    }
  });
  it('every change saves itself, and anything waiting is sent on leaving', () => {
    assert.doesNotMatch(page, /Save Changes|Unsaved changes|FeedbackModal|successOpen/);
    assert.match(page, /<SavePill/);
    assert.match(page, /void send\(latest\.current, true\)/);
    assert.match(page, /keepalive,\n\}\);/);
    assert.match(page, /addEventListener\('pagehide', flushWaiting\)/);
    assert.match(page, /return \(\) => \{ flushWaiting\(\); latest\.current = null; \};/);
  });
  it('the drawn mock is gone; a colour takes a hex code', () => {
    assert.doesNotMatch(page, /themePreview|modePreview|previewHeroText/);
    assert.match(page, /<HexField id="t-primary-hex"/);
    assert.match(page, /<HexField id="icon-bg-hex"/);
  });
  // "As today" was Stage 5's (the free tier review owned it). The free tournament tier (screen 6, 2026-10-16): ONE lock
  // line replaces the Unlock box and six Locked cards, and an invite-only event has no Registration switch.
  it('the free plan meets one branding lock line, no Unlock box or Locked cards (screen 6)', () => {
    assert.doesNotMatch(page, /Unlock Advanced Branding|lockedBadge|CompactUpsell/);
    assert.match(page, /\{LOCK_WORDS\.branding\}<\/PlanLockLine>/);
    assert.match(page, /PUBLIC_PAGE_OPTIONS\.filter\(p => p\.key !== 'register'\)/);
  });
  it('the settings sheet carries no old-look layer', () => {
    assert.doesNotMatch(read('app/[orgSlug]/admin/tournaments/branding/branding.module.css'), /\[data-admin-kit\]\)/);
  });
});
