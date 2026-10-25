import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { existsSync } from 'node:fs';
import { readCode, readSource, filesUnder } from './_source-code.ts';

/**
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * ONE RULE, ONE REFUSAL — THE WIRING (Club Tier Stage 4a; Ask 5 + Ask 9 ruled 2026-10-19). Source scans, because the
 * rules are about WHERE a decision is made, and a future page must not be able to skip it:
 *   1. Every public club page and route asks the one question (`lib/public-club-access.ts`) before it renders —
 *      including the sign-up submit and the team calendar feed (F06) and both archives pages (F07).
 *   2. Tournament pages never ask it: the site switch does not gate them (BUSINESS_DECISIONS 2026-07-22).
 *   3. A refused or missing club page renders the club's own "not found" (the refusal, or not found inside a live
 *      club), never the platform's diagnostic screen (S4-01).
 *   4. The shortcut addresses forward to a running tournament, otherwise "not found" — never silently home (S4-07).
 *   5. The closed tryout's Contact us reads the public-site contact address, not a column that does not exist (F09).
 *   6. The coach is told in Sharing when the club's site is off (S4-08); the owner's switch says what it now does.
 * The rule itself is pinned by club-stage4a-access.test.ts.
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 */

const ORG = 'app/[orgSlug]';
/** Not club pages: the tournament subtree (a dynamic segment), and the signed-in tools. */
const NOT_CLUB = [`${ORG}/[tournamentSlug]/`, `${ORG}/admin/`, `${ORG}/coaches/`, `${ORG}/check-in/`, `${ORG}/official/`,
  `${ORG}/scorekeeper/`];

const CLUB_ROUTES = [...filesUnder(ORG, '.tsx'), ...filesUnder(ORG, '.ts')]
  .filter(f => /\/(page\.tsx|route\.ts)$/.test(f))
  .filter(f => !NOT_CLUB.some(prefix => f.startsWith(prefix)));

/** The public club API routes that act for a page (the sign-up submits). */
const CLUB_APIS = [
  'app/api/rep-teams/[orgSlug]/[teamSlug]/tryouts/[yearId]/register/route.ts',
  'app/api/league/[orgSlug]/[seasonSlug]/register/route.ts',
  'app/api/league/[orgSlug]/[seasonSlug]/status-lookup/route.ts',
];

/** The one question, and the resolvers built on it. (The shortcut helper does NOT ask it — by design, it forwards to a
 *  tournament — so it can't stand in for it: only the seven shortcut pages, by name, may use it instead.) */
const ASKS = /\b(requirePublicClubPage|resolvePublicClub|publicClubRefusal|resolvePublicTryout|resolvePublicLeagueContext)\(/;

/** Six since Stage 4b-2a: `/teams` became the club's Teams page (Ask 9A) — pinned in §4 below. */
const SHORTCUTS = ['news', 'rules', 'schedule', 'standings', 'register', 'results'];
const SHORTCUT_PAGES = new Set(SHORTCUTS.map(d => `${ORG}/${d}/page.tsx`));
/** A forward to another club page, which asks the question itself: the old Past tournaments address (Stage 4f, Ask 6). */
const FORWARD_PAGES = new Set([`${ORG}/archives/page.tsx`]);

describe('1 · every public club page and route asks the one question', () => {
  it('the census is not empty (the scan found the club pages)', () => {
    assert.ok(CLUB_ROUTES.length >= 20, `found ${CLUB_ROUTES.length}`);
    assert.ok(CLUB_ROUTES.includes(`${ORG}/teams/[teamSlug]/page.tsx`));
    assert.ok(CLUB_ROUTES.includes(`${ORG}/teams/[teamSlug]/calendar/route.ts`));
  });
  for (const f of [...CLUB_ROUTES, ...CLUB_APIS].filter(f => !SHORTCUT_PAGES.has(f) && !FORWARD_PAGES.has(f))) {
    it(f, () => assert.match(readCode(f), ASKS, `${f} renders without asking the one question`));
  }
  it('the resolvers are built on the one question', () => {
    assert.match(readCode('lib/public-tryout.ts'), /resolvePublicClub\(orgSlug, 'teams'\)/);
    assert.match(readCode('lib/public-league.ts'), /resolvePublicClub\(orgSlug, 'league'\)/);
  });
  it('the team page and its tryouts ask for the rep-teams page; tournaments and archives for theirs', () => {
    assert.match(readCode(`${ORG}/teams/[teamSlug]/page.tsx`), /requirePublicClubPage\(orgSlug, 'teams'\)/);
    // The old Past tournaments page forwards to the Tournaments page (Stage 4f), which asks the rule.
    assert.match(readCode(`${ORG}/tournaments/page.tsx`), /requirePublicClubPage\(orgSlug, 'tournaments'\)/);
    assert.match(readCode(`${ORG}/archives/[archiveId]/page.tsx`), /requirePublicClubPage\(orgSlug, 'archives'\)/);
    assert.match(readCode(`${ORG}/page.tsx`), /requirePublicClubPage\(orgSlug, 'home'\)/);
  });
  it('the sign-up submit refuses before it reads the form (never after it is filled in)', () => {
    const code = readCode(CLUB_APIS[0]);
    const ask = code.search(/resolvePublicClub\(orgSlug, 'teams'\)/);
    assert.ok(ask > 0, 'asks the one question');
    assert.ok(ask < code.search(/req\.json\(\)/), 'before the body is read');
    assert.doesNotMatch(code, /Organization not found/, 'the neutral words, not a system phrase');
  });
  it('the team feed answers a refused club with an empty calendar (its families\' entries leave, F10)', () => {
    assert.match(readCode(`${ORG}/teams/[teamSlug]/calendar/route.ts`), /publicClubRefusal\(org, 'teams'\)/);
  });
  it('an old tournament-team link forwards BEFORE the club rule (tournaments stay up when the site is off)', () => {
    const code = readCode(`${ORG}/teams/[teamSlug]/page.tsx`);
    const forward = code.indexOf('forwardToRunningTournament(orgSlug, `teams/${teamSlug}`)');
    assert.ok(forward > 0 && forward < code.indexOf("requirePublicClubPage(orgSlug, 'teams')"));
  });
  it('an unknown team no longer goes silently to the club home', () => {
    const code = readCode(`${ORG}/teams/[teamSlug]/page.tsx`);
    assert.doesNotMatch(code, /redirect\(`\/\$\{orgSlug\}`\)/);
  });
  it('a club with no published house-league season is "not found", never "check back soon" (F09)', () => {
    assert.doesNotMatch(readCode(`${ORG}/league/page.tsx`), /Check back soon/);
  });
});

describe('2 · tournament pages never ask it (the switch does not gate them, 2026-07-22)', () => {
  it('nothing under the tournament subtree asks the club question', () => {
    const tournament = [...filesUnder(`${ORG}/[tournamentSlug]`, '.tsx'), ...filesUnder(`${ORG}/[tournamentSlug]`, '.ts')];
    assert.ok(tournament.length > 5);
    for (const f of tournament) {
      assert.doesNotMatch(readCode(f), /public-club-access|public-club-page|requirePublicClubPage|resolvePublicClub/, f);
    }
  });
  it('the org layout (which wraps the tournament pages) refuses only a club that does not exist', () => {
    const code = readCode(`${ORG}/layout.tsx`);
    assert.doesNotMatch(code, /requirePublicClubPage|resolvePublicClub\(|publicClubRefusal\(/);
    assert.equal((code.match(/notFound\(\)/g) ?? []).length, 1);
    assert.match(code, /if \(!org\) notFound\(\)/);
  });
});

describe('3 · one refusal, never the diagnostic screen (S4-01)', () => {
  const NF = `${ORG}/not-found.tsx`;
  const FACE = 'components/public/ClubNotFound.tsx';
  it('the club section has its own not-found boundary', () => assert.ok(existsSync(NF), NF));
  it('the club face says the approved words and none of the diagnostic', () => {
    const src = readSource(FACE);
    assert.doesNotMatch(src, /DIAGNOSTIC|ROUTE_NOT_FOUND|Root Node/);
    for (const words of [
      "This club’s site isn’t available",
      'has turned off its public site here, or no longer uses it.',
      'If a coach or the club sent you this link, ask them for an up-to-date one.',
      'Find a club or event',
      'We couldn’t find that page',
      'The link may be old, or the team may have a new name.',
      'The link may be old, or the page may have moved.',
      'run a house league on this site.',
    ]) assert.ok(src.includes(words), words);
    assert.match(readCode(FACE), /clubNotFoundFace\(/);
  });
  it('the refusal is neutral: the club\'s bars step aside while it shows (owner 2026-10-20)', () => {
    const css = readSource('components/public/ClubNotFound.module.css');
    assert.match(css, /:global\(body\):has\(\.refusal\) :global\(\[data-club-chrome\]\)/);
    // the bars the rule reaches: the club's own bar (4b-1) and its section tabs. (The platform's phone bar no longer
    // renders on a club page at all — Ask 8, 4b-1 — so the refusal no longer has to hide it; club-frame-guard pins that.)
    assert.match(readCode('components/public/ClubBar.tsx'), /data-club-chrome=""/);
    assert.match(readCode('components/public/OrgSectionTabs.tsx'), /aria-label="Sections" data-club-chrome=""/);
  });
  it('each face is a <div> — the root layout owns the page\'s <main>', () => {
    assert.doesNotMatch(readCode(FACE), /<main/);
  });
  it('the layout hands the boundary the club (a not-found file receives no params)', () => {
    assert.match(readCode(`${ORG}/layout.tsx`), /<PublicClubProvider/);
    assert.match(readCode(`${ORG}/layout.tsx`), /isPublicClubSiteOpen\(org\)/);
  });
});

describe('4 · the shortcut addresses (Ask 9)', () => {
  for (const dir of SHORTCUTS) {
    it(`/${dir} forwards through the one helper`, () => {
      assert.match(readCode(`${ORG}/${dir}/page.tsx`), new RegExp(`export default clubShortcutPage\\('${dir}'\\);`));
    });
  }
  it('/teams is the club\'s Teams page for a club whose plan carries rep teams; any other org keeps the forward (4b-2a)', () => {
    const code = readCode(`${ORG}/teams/page.tsx`);
    const decide = code.indexOf('clubTeamsAddress(');
    assert.ok(decide > 0, 'decides through the one rule (lib/public-club-access.ts)');
    assert.match(code, /forwardClubShortcut\(orgSlug, 'teams'\)/, 'an org without rep teams still forwards (printed QR codes)');
    assert.match(code, /requirePublicClubPage\(orgSlug, 'teams'\)/, 'the Teams page asks the one question');
    assert.ok(decide < code.indexOf("requirePublicClubPage(orgSlug, 'teams')"));
  });
  it('the helper forwards to a running tournament, otherwise not found — never home', () => {
    const code = readCode('lib/club-shortcut.ts');
    assert.match(code, /notFound\(\)/);
    assert.doesNotMatch(code, /redirect\(`\/\$\{orgSlug\}`\)/);
  });
  it('/results goes straight to the tournament\'s Results & Standings (its own /results only forwards there)', () => {
    assert.match(readCode(`${ORG}/[tournamentSlug]/results/page.tsx`), /\/standings`\)/);
    assert.match(readCode('lib/club-shortcut.ts'), /shortcut === 'results' \? 'standings' : shortcut/);
  });
});

describe('5 · the closed tryout\'s Contact us reads the real address (F09)', () => {
  it('the tryout resolver reads the public-site contact', () => {
    // Through the request-cached read since 4b-1 (lib/club-page-meta.ts getClubSiteContent wraps getOrgPublicSiteContent).
    assert.match(readCode('lib/public-tryout.ts'), /getClubSiteContent\(/);
    assert.match(readCode('lib/club-page-meta.ts'), /getOrgPublicSiteContent\(orgId\)/);
  });
  it('no club page or tryout view reads the org\'s contactEmail (a column that does not exist)', () => {
    for (const f of [...CLUB_ROUTES, 'components/rep-teams/TryoutLandingView.tsx', 'components/rep-teams/TryoutRegisterView.tsx']) {
      assert.doesNotMatch(readCode(f), /org\??\.contactEmail/, f);
    }
  });
});

describe('6 · the coach is told; the owner\'s switch says what it does', () => {
  it('the team settings API serves the club site state, read on the server', () => {
    assert.match(readCode('app/api/coaches/[orgSlug]/teams/[teamId]/route.ts'), /clubSiteOff:\s*!isPublicClubSiteOpen\(ctx\.org\)/);
  });
  it('Sharing shows the notice when the site is off', () => {
    const src = readSource('components/coaches/ClubSiteOffNotice.tsx');
    assert.ok(src.includes('Your club’s public site is turned off, so your team’s public page doesn’t open for anyone right now. The club’s owner turns it back on.'));
    // Club Tier 4c-2 Part B moved it INTO "Your team's public page" (F5); it stays as its own row only where no door exists.
    assert.match(readCode('components/coaches/CoachPublicPageDoor.tsx'), /\{siteOff && <ClubSiteOffNotice \/>\}/);
    assert.match(readCode('app/[orgSlug]/coaches/teams/[teamId]/settings/page.tsx'), /siteOff=\{data\.clubSiteOff\}/);
  });
  it('the switch and its dialog say every club page goes offline, never the tournaments', () => {
    // Moved with the switch from Settings into the Public site editor's Visibility row (Public site builder, 2026-10-21).
    const src = readSource('lib/public-site-words.ts');
    assert.doesNotMatch(src, /takes the home page and league pages offline/);
    assert.doesNotMatch(src, /home page or league pages will see/);
    assert.ok(src.includes('Turning it off takes all of the club’s pages offline: home, teams, tryouts and their sign-up, league, archives and team calendars. Tournament pages stay up.'));
    assert.ok(src.includes('Tryout sign-ups stop, and team calendars go empty. Tournament pages stay up.'));
  });
});
