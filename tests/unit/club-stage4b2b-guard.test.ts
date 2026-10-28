import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { existsSync } from 'node:fs';
import { readCode } from './_source-code.ts';

/**
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * TRYOUT SEASON — THE WIRING (Club Tier Stage 4b-2b; drawings ruled 2026-10-19, the asks page ruled 2026-10-20). Source
 * scans, because the rules are about WHERE a decision is made:
 *   1. One rule decides a team's tryout state, and every surface reads it — none decides on its own.
 *   2. Tryout days reach the public only through one read, which selects what a family may see and nothing else.
 *   3. A shared link's card asks the one question first, and no card can reach a player.
 *   4. The org layout names no preview image of its own (it would silently replace the club's generated card).
 *   5. The sitemap lists the club's teams and tryouts; the team page describes itself as a sports team of the club.
 *   6. Birth years (Stage 4c-2) reach every surface through ONE rule (lib/born-years.ts); none formats a born line by hand,
 *      and the Born in picker is the house pick-one pill.
 * The rule itself is pinned by club-stage4b2b.test.ts.
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 */

const ORG = 'app/[orgSlug]';
const TRYOUTS_PAGE = `${ORG}/tryouts/page.tsx`;
const TRYOUT_PAGE = `${ORG}/teams/[teamSlug]/tryouts/page.tsx`;
const TEAM_PAGE = `${ORG}/teams/[teamSlug]/page.tsx`;
const HOME = `${ORG}/page.tsx`;
const VIEW = 'components/rep-teams/TryoutLandingView.tsx';
const READS = 'lib/club-tryouts.ts';
const CARDS = [`${ORG}/opengraph-image.tsx`, `${ORG}/teams/[teamSlug]/opengraph-image.tsx`, `${ORG}/teams/[teamSlug]/tryouts/opengraph-image.tsx`];

describe('1 · one rule decides a team’s tryout state; every surface reads it', () => {
  it('the rule lives in lib/tryout-season.ts and the reads build it there', () => {
    assert.match(readCode(READS), /tryoutStandingOf\(/);
  });
  it('the tryout page, the Tryouts page, the home and the team page read the state through the reads', () => {
    assert.match(readCode(TRYOUT_PAGE), /readTeamTryout\(/);
    assert.match(readCode(TRYOUTS_PAGE), /readClubTryouts\(/);
    assert.match(readCode(TRYOUTS_PAGE), /isListedTryout\(/);
    // The home's one loader, shared with the editor's preview since the Public site builder (2026-10-21).
    // Its Open now list moved, unchanged, into the one shaper the tournament host card shares (Public tournament Stage 2).
    assert.match(readCode('lib/club-open-now.ts'), /openNowTryouts\(/);
    assert.match(readCode('lib/club-home-data.ts'), /clubOpenNowRows\(publicLeagueSeasons, clubTryouts, today, href\)/);
    assert.match(readCode(TEAM_PAGE), /readTeamTryout\(/);
    // The Teams page's and the home grid's "Tryouts open" chip read the same rule (not the old reader).
    assert.match(readCode('lib/club-public-teams.ts'), /readClubTryouts\(/);
    assert.doesNotMatch(readCode('lib/club-public-teams.ts'), /getOpenTryoutsByOrg/);
  });
  it('the view decides nothing: it is handed the state and draws it', () => {
    const view = readCode(VIEW);
    assert.match(view, /state: TryoutState/);
    assert.doesNotMatch(view, /tryoutOpen|tryoutStandingOf|liveSeasonOf/);
  });
  it('the tab asks the same window as the page (four weeks)', () => {
    const avail = readCode('lib/org-section-availability.ts');
    assert.match(avail, /anyListedTryout\(org\.id, tournamentToday\(\)\)/);
    assert.match(readCode(READS), /addCalendarDays\(today, -TRYOUT_LISTED_DAYS\)/);
    assert.match(readCode('lib/org-public-sections.ts'), /\{ key: 'teams',\s+label: 'Teams' \},\s*\{ key: 'tryouts',\s+label: 'Tryouts' \},/);
  });
  it('the Tryouts address is a club section (a static folder, matched before a tournament slug — none uses "tryouts")', () => {
    // (Stage 4f's 'tournaments' sits between them, alphabetically.)
    assert.match(readCode('lib/consumer-routes.ts'), /'teams', 'tournaments',\s+'tryouts',/);
    assert.ok(existsSync(TRYOUTS_PAGE));
  });
});

describe('2 · tryout days reach the public through one read, and only what a family may see', () => {
  it('the read selects when, where and whether it was cancelled — never a staff label, evaluator or score', () => {
    const reads = readCode(READS);
    const cols = /const DAY_COLUMNS = '([^']+)'/.exec(reads)?.[1] ?? '';
    assert.equal(cols, 'program_year_id, starts_at, ends_at, status, location, location_address, field_number');
    assert.doesNotMatch(reads, /from\('rep_tryout_sessions'\)\s*\.select\('\*'\)/);
  });
  it('no public page reads the sessions table itself', () => {
    for (const f of [TRYOUTS_PAGE, TRYOUT_PAGE, TEAM_PAGE, HOME, VIEW, ...CARDS]) {
      assert.doesNotMatch(readCode(f), /rep_tryout_sessions|getRepTryoutSessions/, f);
    }
  });
  it('Directions is a symbol on a phone, named with its place', () => {
    const css = readCode('components/public/DirectionsLink.module.css');
    const phone = css.split('@media (max-width: 640px)')[1] ?? '';
    assert.match(phone, /width: 44px/);
    assert.match(phone, /border-color: transparent/);
    assert.match(phone, /background: none/);
    assert.match(phone, /\.directionsLabel \{ display: none; \}/);
    assert.match(readCode('components/public/DirectionsLink.tsx'), /aria-label=\{name\}/);
  });
});

describe('3 · a shared link’s card: the one question first, and never a player', () => {
  for (const f of CARDS) {
    it(f, () => {
      const code = readCode(f);
      assert.match(code, /\b(resolvePublicClub|resolvePublicTryout)\(/, 'asks the one question');
      assert.match(code, /return neutralShareCard\(\)/, 'a refused club draws the neutral card');
      assert.doesNotMatch(code, /roster|registration|player|athlete|getRepTryoutRegistrations|getPlayers/i, 'no player can reach a card');
    });
  }
  it('the card draws only the words it is handed', () => {
    const image = readCode('lib/club-share-card-image.tsx');
    assert.match(image, /text: ShareCardText/);
    assert.doesNotMatch(image, /from '\.\/db'|supabase/);
  });
  it('the tryout page names its card with its state in the address, so a changed state is a fresh card', () => {
    assert.match(readCode('lib/club-share.ts'), /tryouts\/opengraph-image\?s=\$\{state\}/);
    assert.match(readCode(`${ORG}/teams/[teamSlug]/tryouts/tryout-metadata.ts`), /shareCardPath\.tryout\(orgSlug, team\.slug, standing\.state, \[season\?\.year/);
  });
  it('a card is kept minutes, never the year Next would give it; the neutral card is never kept', () => {
    const image = readCode('lib/club-share-card-image.tsx');
    assert.match(image, /s-maxage=600/);
    assert.match(image, /'Cache-Control': 'no-store'/);
    assert.match(image, /headers: CARD_CACHE/);
    assert.match(image, /headers: NEUTRAL_CACHE/);
    for (const f of CARDS) assert.match(readCode(f), /export const dynamic = 'force-dynamic'/, f);
  });
  it('the logo is read through the exports’ guarded read (this project’s storage only, decoded under a pixel ceiling)', () => {
    assert.match(readCode('lib/club-share-card-image.tsx'), /deriveLogoDataUrl\(/);
  });
});

describe('4 · the org layout names no preview image (it would replace the club’s card)', () => {
  it('no openGraph images in the layout', () => {
    assert.doesNotMatch(readCode(`${ORG}/layout.tsx`), /openGraph/);
  });
});

describe('5 · search engines: the club’s teams and tryouts, a team as a team of the club', () => {
  it('the sitemap lists the club pages', () => {
    assert.match(readCode('app/sitemap.ts'), /getClubPageSitemapEntries\(\)/);
    assert.match(readCode('lib/directory.ts'), /clubSitemapPaths\(/);
  });
  it('the team page describes itself with the one builder, escaped', () => {
    const team = readCode(TEAM_PAGE);
    assert.match(team, /sportsTeamJsonLd\(/);
    assert.match(team, /type="application\/ld\+json"/);
    assert.ok(team.includes(".replace(/</g, '\\\\u003c')"), 'the structured data escapes "<"');
  });
});

describe('6 · birth years: one rule, pinned on every surface they show (Stage 4c-2)', () => {
  const BORN_SURFACES = [
    'lib/club-public-teams.ts',
    'lib/club-born-public.ts',
    'lib/club-home-data.ts',
    'components/public/ClubSiteHome.tsx',
    `${ORG}/teams/page.tsx`,
    TRYOUTS_PAGE,
    TRYOUT_PAGE,
    VIEW,
    'lib/tryout-season.ts',
    `${ORG}/league/[seasonSlug]/page.tsx`,
    'components/public/BornInPill.tsx',
  ];
  it('the born lines come from the one rule: bornLine / bornMeta, through bornFactsOf', () => {
    assert.match(readCode('lib/club-born-public.ts'), /bornLine\(years, cutoff\)[\s\S]*bornMeta\(years, cutoff\)/);
    // The Teams page reads each team's years in the one read; the Tryouts page reads them off each team.
    assert.match(readCode('lib/club-public-teams.ts'), /bornFactsOf\(/);
    assert.match(readCode(TRYOUTS_PAGE), /bornFactsOf\(t\.bornYears, org\.birthdayCutoffs, t\.sport\)/);
    // The tryout page's meta ("For the 2027 season · born 2012–2013") and its finished form are the one function's.
    assert.match(readCode(TRYOUT_PAGE), /bornFactsOf\(\{ from: season\.bornFromYear, to: season\.bornToYear \}, org\.birthdayCutoffs, team\.sport\)\.meta/);
    assert.match(readCode(VIEW), /tryoutSeasonMeta\(season, born\)/);
    assert.match(readCode('lib/tryout-season.ts'), /born \? `\$\{base\} · \$\{born\}` : base/);
    // The Tryouts row leads with the line; the house-league division card reads it under the season's sport.
    assert.match(readCode(TRYOUTS_PAGE), /tryoutsRowSub\(t\.standing, t\.season, today, t\.born\.line\)/);
    assert.match(readCode(`${ORG}/league/[seasonSlug]/page.tsx`), /bornFactsOf\(\{ from: d\.bornFromYear, to: d\.bornToYear \}, org\.birthdayCutoffs, season\.sport\)/);
    // The home's team grid carries NO birth years (owner 2026-10-22: a tile is a name and the Tryouts open chip; the years live on
    // the Teams page, the Tryouts pages and the team's own pages).
    assert.doesNotMatch(readCode('components/public/ClubSiteHome.tsx'), /\.born\b/);
  });
  it('no surface builds a born line by hand', () => {
    for (const f of BORN_SURFACES) {
      assert.doesNotMatch(readCode(f), /`[Bb]orn \$\{|['"][Bb]orn \d|\+ ?['"][Bb]orn |['"][Bb]orn ['"] ?\+/, `${f} formats a born line itself`);
    }
  });
  it('the Born in picker is the house pick-one pill, one pill on the Teams and Tryouts pages, never ViewPills', () => {
    const pill = readCode('components/public/BornInPill.tsx');
    assert.match(pill, /import SingleSelectDropdown from '@\/components\/coaches\/SingleSelectDropdown';/);
    assert.match(pill, /label="Born in"/);
    assert.doesNotMatch(pill, /ViewPills/);
    for (const f of [`${ORG}/teams/page.tsx`, TRYOUTS_PAGE]) {
      const code = readCode(f);
      assert.match(code, /<BornInPill\b/, `${f} renders the pill`);
      assert.match(code, /bornPickOf\(/, `${f} reads the pick from the address`);
      assert.doesNotMatch(code, /ViewPills/, `${f}: a pick-one pill, not a view pill`);
    }
  });
  it('the pill face reads "Born in: any year" / "Born in: 2015" (D15/D16) through the shared pill’s opt-in labelSuffix / faceLabel, and no other pill changed', () => {
    const pill = readCode('components/public/BornInPill.tsx');
    assert.ok(pill.includes('labelSuffix=":"'));
    assert.ok(pill.includes("{ id: ANY, label: 'Any year', faceLabel: 'any year' }"), 'the menu row still reads "Any year", the face "any year"');
    const dd = readCode('components/coaches/SingleSelectDropdown.tsx');
    assert.ok(dd.includes('labelSuffix?: string;'));
    assert.ok(dd.includes('faceLabel?: string;'));
    assert.ok(dd.includes("atRest ? label : `${label}${labelSuffix ?? ''}`"), 'a quiet face at rest never shows a dangling suffix');
    assert.ok(dd.includes('{chosenLabel}{chosen?.mark}{chosen?.pillMark}'));
    // opt-in: no other caller passes it
    for (const f of ['components/admin/kit/club/money/YearPill.tsx', 'components/admin/kit/club/families/FamiliesBook.tsx']) {
      assert.ok(!/labelSuffix=|faceLabel:/.test(readCode(f)), `${f} is unchanged`);
    }
  });
  it('the blurb reads while sign-ups are open and while they are not open yet, never finished or closed (D24)', () => {
    assert.match(readCode(VIEW), /state === 'open' \|\| state === 'notOpenYet' \? season\?\.tryoutDescription/);
  });
});
