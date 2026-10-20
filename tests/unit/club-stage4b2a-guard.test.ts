import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readCode } from './_source-code.ts';

/**
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * THE YEAR-ROUND CLUB — THE WIRING (Club Tier Stage 4b-2a; drawings ruled 2026-10-19). Source scans: the rules live in
 * lib/club-site-home.ts and lib/club-team-page.ts (pinned by club-stage4b2a.test.ts); these hold that the pages ASK
 * them, and that what the drawings removed stays removed.
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 */

const ORG = 'app/[orgSlug]';
const HOME = 'components/public/ClubSiteHome.tsx';
const TEAM = `${ORG}/teams/[teamSlug]/page.tsx`;
const SCHEDULE = 'components/public/RepTeamPublicSchedule.tsx';

describe('1 · the home (End state 1, Ask 3A)', () => {
  it('the public-site branch renders the club home, and the home decides its sections through the one rule', () => {
    assert.match(readCode(`${ORG}/page.tsx`), /<ClubSiteHome\b/);
    assert.match(readCode(HOME), /clubHomeSections\(/);
  });
  it('no "check back soon", no "Live" on every card, no "Upcoming events" (S4-03)', () => {
    const code = readCode(HOME);
    assert.doesNotMatch(code, /check back soon/i);
    assert.doesNotMatch(code, /Upcoming events/);
    assert.match(code, /TOURNAMENT_STATUS_WORD\[/, 'the one set of status words');
    assert.match(readCode(`${ORG}/page.tsx`), /tournamentHomeStatus\(t, today, registrationOpen\)/, 'true to its dates');
  });
  it('the description lives in About the club, and the hero\'s repeated contact is gone (the footer carries it)', () => {
    const code = readCode(HOME);
    assert.match(code, /About the club/);
    assert.doesNotMatch(code, /mailto:/);
    assert.doesNotMatch(code, /Contact us/);
  });
  it('Follow sits in the About card (owner 2026-10-20), behind the same gate a follow write checks', () => {
    const code = readCode(HOME);
    assert.match(code, /<FollowOrgButton\b/);
    assert.match(readCode(`${ORG}/page.tsx`), /isFollowableOrg\(org\)/);
  });
  it('the banner is a desk-only strip, never a hero behind the name (Ask 7A)', () => {
    assert.match(readCode(HOME), /bannerStrip/);
    assert.doesNotMatch(readCode('components/public/ClubSiteHome.module.css'), /color-mix\(in srgb, var\(--club-ground\) 90%/);
  });
  it('the home grid opens each team page, with no "All teams" link (DC-01)', () => {
    const code = readCode(HOME);
    assert.match(code, /teamGridOneColumn\(/);
    assert.doesNotMatch(code, /All teams/);
  });
});

describe('2 · the Teams page and tab (End state 2, Asks 4A + 9A)', () => {
  it('the tab row knows Teams, and asks whether the club lists one', () => {
    assert.match(readCode('lib/org-public-sections.ts'), /\{ key: 'teams',\s+label: 'Teams' \}/);
    const availability = readCode('lib/org-section-availability.ts');
    assert.match(availability, /clubTeamsAddress\(org\) === 'teams-page'/, 'the tab asks the same question as the page');
    assert.match(availability, /\.eq\('is_archived', false\)/);
  });
  it('the page lists through the club\'s groups and names itself', () => {
    const code = readCode(`${ORG}/teams/page.tsx`);
    assert.match(code, /readClubTeams\(org\.id\)/, 'the one read the home grid makes too');
    assert.match(readCode('lib/club-public-teams.ts'), /clubTeamBands\(/);
    assert.match(readCode(`${ORG}/page.tsx`), /readClubTeams\(org\.id\)/);
    assert.match(code, /clubPageMetadata\(/);
    assert.doesNotMatch(code, /player|coach/i, 'not on a row: players, coaches (End state 2)');
  });
});

describe('3 · the team page (End state 3)', () => {
  it('decides its parts through the one recipe', () => {
    assert.match(readCode(TEAM), /teamPageParts\(/);
  });
  it('one level up to Teams; no "← club" link home (design log 2026-10-20)', () => {
    const code = readCode(TEAM);
    assert.match(code, /href=\{`\/\$\{orgSlug\}\/teams`\}/);
    assert.doesNotMatch(code, /href=\{`\/\$\{orgSlug\}`\}/);
  });
  it('no Past seasons list (DC-07), no colour strip under the tabs, the colour is a dot', () => {
    const code = readCode(TEAM);
    assert.doesNotMatch(code, /Past seasons/);
    assert.doesNotMatch(code, /height: '4px'/);
    assert.match(code, /teamDot/);
  });
  it('the tryout door\'s button says what it opens', () => {
    const code = readCode(TEAM);
    assert.match(code, /Tryout details and sign-up/);
    assert.doesNotMatch(code, /Register now/);
  });
  it('the quiet tryout sentence reads the public-site contact, never the org row (F09)', () => {
    const code = readCode(TEAM);
    assert.match(code, /isn’t taking tryout sign-ups right now/);
    assert.match(code, /getClubSiteContent\(/);
  });
  it('no Coaches section (moved to 4c with the coach\'s own switch)', () => {
    assert.doesNotMatch(readCode(TEAM), />Coaches</);
  });
});

describe('4 · the schedule (C3, C5, C7–C9)', () => {
  it('earlier this season folds above Up next, and the rest of the season is on demand', () => {
    const code = readCode(SCHEDULE);
    assert.match(code, /splitPublicSchedule\(/);
    assert.match(code, /Earlier this season/);
    assert.match(code, /Show the rest of the season/);
  });
  it('Directions is its own button, without an arrow; a cancelled event keeps a Cancelled chip', () => {
    const code = readCode(SCHEDULE);
    assert.doesNotMatch(code, /Directions →/);
    assert.match(code, />Cancelled</);
  });
});

describe('5 · the club\'s "not found" offers the Teams page', () => {
  it('See all teams, only on an unknown team\'s address of a club that has the page', () => {
    const code = readCode('components/public/ClubNotFound.tsx');
    assert.match(code, /See all teams/);
    assert.match(code, /club\.teamsPage/);
    assert.match(readCode(`${ORG}/layout.tsx`), /teamsPage:/);
  });
});
