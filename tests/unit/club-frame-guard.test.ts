import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { existsSync } from 'node:fs';
import { readCode, readSource, filesUnder } from './_source-code.ts';

/**
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * THE CLUB'S FRAME (Club Tier Stage 4b-1; Asks 1, 7, 8, 13 of the Stage 4 drawings, ruled 2026-10-19; the staff
 * door, Ask S1, ruled 2026-10-20). Every page a club owns is one site: its own bar, its own footer, a light ground in
 * its colours, its own type — and nothing of FieldLogicHQ's but the quiet credit. Source scans, because the rules are
 * about what a club page is ALLOWED to carry, and a future page must not be able to bring the old chrome back:
 *   1. The club's bar replaces the platform's: no Discover, no Pricing, no crumb, at any width; Sign in in the bar; the
 *      staff door only for this club's staff, outermost (never the everywhere-chooser).
 *   2. The platform's phone bar leaves every club page; tournament pages keep it (the carve-out, Ask 8).
 *   3. No typewriter face on a club page (DC-03), and none of the "digital ledger" voice.
 *   4. Every club page names itself in the browser tab ("page · club"); the description is the club's own words.
 *   5. One name per thing: House league, Past tournaments.
 *   6. The colours come from the one derivation, written by the org layout.
 * The colour rule itself is pinned by club-colour-roles.test.ts.
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 */

const ORG = 'app/[orgSlug]';
const NOT_CLUB = [`${ORG}/[tournamentSlug]/`, `${ORG}/admin/`, `${ORG}/coaches/`, `${ORG}/check-in/`, `${ORG}/official/`,
  `${ORG}/scorekeeper/`];
const CLUB_PAGES = filesUnder(ORG, '.tsx')
  .filter(f => f.endsWith('/page.tsx'))
  .filter(f => !NOT_CLUB.some(prefix => f.startsWith(prefix)));
/** The six shortcut addresses forward or show "not found" — they render no page of their own to title. (`/teams` is
 *  the club's Teams page since 4b-2a, so it names itself like any other.) */
const SHORTCUTS = new Set(['news', 'rules', 'schedule', 'standings', 'register', 'results']
  .map(d => `${ORG}/${d}/page.tsx`));

const BAR = 'components/public/ClubBar.tsx';
const FOOTER = 'components/public/ClubFooter.tsx';
const FRAME = 'components/public/ClubFrame.tsx';
const FRAME_CSS = 'components/public/ClubFrame.module.css';

/** Everything a club page renders that is the club's OWN (the frame, the pages, the views and forms they draw).
 *  Shared parts are deliberately absent — `${ORG}/Home.module.css` also draws the tournament home, and the calendar
 *  subscribe button sits in the coaches portal too; on a club page the frame's scope (ClubFrame.module.css `.site`)
 *  redefines their faces and colours, so they carry no mono THERE without changing the surfaces they share. */
const CLUB_SURFACES = [
  ...CLUB_PAGES,
  `${ORG}/league/[seasonSlug]/status/StatusLookupForm.tsx`,
  'components/public/RepTeamPublicSchedule.tsx',
  'components/public/RepTeamPublicSchedule.module.css',
  // Stage 4b-2a: the club's home, its Teams page and the team page's own styles.
  'components/public/ClubSiteHome.tsx',
  'components/public/ClubSiteHome.module.css',
  'components/public/FollowOrgButton.tsx',
  'components/public/FollowOrgButton.module.css',
  `${ORG}/teams/ClubTeams.module.css`,
  `${ORG}/teams/[teamSlug]/TeamPage.module.css`,
  'components/rep-teams/TryoutLandingView.tsx',
  'components/rep-teams/TryoutRegisterView.tsx',
  'components/rep-teams/TryoutRegisterForm.tsx',
  'components/rep-teams/register.module.css',
  'components/league/RegisterForm.tsx',
  'components/league/register.module.css',
  'components/public/ClubNotFound.tsx',
  'components/public/ClubNotFound.module.css',
  'components/public/OrgSectionTabs.tsx',
  'components/public/OrgSectionTabs.module.css',
  BAR, FOOTER, FRAME, FRAME_CSS,
  // The one club-page kit and the one form kit every club page and sign-up form draws from (/simplify, 4b-1).
  'components/public/ClubKit.module.css',
  'components/public/ClubForm.module.css',
];

describe('1 · the club\'s bar replaces the platform\'s (Ask 7)', () => {
  it('the frame exists and the org layout mounts it around every page', () => {
    for (const f of [BAR, FOOTER, FRAME, FRAME_CSS]) assert.ok(existsSync(f), f);
    assert.match(readCode(`${ORG}/layout.tsx`), /<ClubFrame\b/);
  });
  it('the bar advertises nothing: no Discover, no Pricing, no crumb', () => {
    const bar = readCode(BAR);
    assert.doesNotMatch(bar, /['"`]\/discover['"`]|['"`]\/pricing['"`]|org_discover|orgSectionCrumb|›/);
    assert.match(bar, />Sign in</);
    assert.doesNotMatch(bar, /Sign In/);
  });
  it('the platform\'s top bar has no club branch left: it steps aside on a club page', () => {
    const nav = readCode('components/Navbar.tsx');
    assert.doesNotMatch(nav, /org_discover|orgSectionCrumb|data-club-chrome/);
    // Every club section is a static folder Next.js matches before [tournamentSlug], so "no tournament param" IS "a
    // club page or an operator shell (which SiteChrome already drops)".
    assert.match(nav, /if \(!urlTournamentSlug\) return null;/);
  });
  it('the staff door is this club\'s only, outermost — never the everywhere-chooser (Ask S1)', () => {
    const bar = readCode(BAR);
    assert.match(bar, /resolveOrgReturnFlip\(/);
    assert.doesNotMatch(bar, /resolveOperatorDoor|WorkspacesPill/);
    // Account inside, the door outermost (the Stage G door order).
    assert.ok(bar.indexOf('<AccountMenu') < bar.indexOf('<FlipPill'), 'Account renders before (inside of) the door');
  });
  it('the bar and the tab row keep the marker the 4a refusal steps them aside by', () => {
    assert.match(readCode(BAR), /data-club-chrome=""/);
    assert.match(readCode('components/public/OrgSectionTabs.tsx'), /aria-label="Sections" data-club-chrome=""/);
  });
  it('the footer: the club\'s contact, copyable; social links named; the quiet credit', () => {
    const footer = readCode(FOOTER);
    assert.match(footer, /Questions\? Email the club/);
    assert.match(footer, /useCopyToClipboard\(/); // the shared copy behaviour, not a third hand-rolled one
    assert.match(footer, /BuiltOnCredit/);
    assert.doesNotMatch(footer, /Contacts and documents/); // 4c
  });
});

describe('2 · the platform\'s phone bar leaves club pages; tournament pages keep it (Ask 8)', () => {
  const consumer = readCode('components/consumer/ConsumerNav.tsx');
  it('a club page renders no bottom bar: the tournament variant renders on a tournament route only', () => {
    assert.match(consumer, /if \(variant === 'tournament' && !onTournamentRoute\) return null;/);
    assert.doesNotMatch(consumer, /showsOrgPublicChrome/, 'no club-page branch left in the platform\'s bar');
  });
  it('the carve-out: a tournament page still gets the Primary bar', () => {
    assert.match(consumer, /bottomNavTournament[^\n]*aria-label="Primary"|aria-label="Primary"[^\n]*bottomNavTournament/);
    assert.match(readCode('components/Navbar.tsx'), /TournamentTopTabs/);
  });
  it('the 4a refusal no longer needs the phone bar\'s label to hide it', () => {
    assert.doesNotMatch(readSource('components/public/ClubNotFound.module.css'), /aria-label='Primary'/);
  });
});

describe('3 · no typewriter face, none of the old voice (DC-03, /marketing 2026-10-20)', () => {
  for (const f of CLUB_SURFACES) {
    it(f, () => {
      const code = readCode(f);
      // USING the data face (`var(--font-data…)`), not redefining it: the frame's scope redefines it as the text face.
      assert.doesNotMatch(code, /var\(--font-data|var\(--font-mono|IBM Plex Mono|monospace|hud-label|hudLabel/, 'mono on a club page');
      assert.doesNotMatch(code, /Digital Ledger|SEALED|Sealed Record|READ-ONLY|SHA-256/,'the old ledger voice');
      assert.doesNotMatch(code, /['">]Sign In['"<]/, '"Sign in" is sentence case');
    });
  }
});

describe('4 · every club page names itself: "page · club" (End state 8)', () => {
  it('the layout describes the club in its own words (S4-02: never the platform\'s sales line)', () => {
    assert.match(readCode(`${ORG}/layout.tsx`), /description: clubDescription\(/);
  });
  it('the pattern has one home', () => {
    assert.match(readCode('lib/club-site.ts'), /`\$\{named\} · \$\{clubName\}`/);
  });
  for (const f of CLUB_PAGES.filter(p => !SHORTCUTS.has(p) && p !== `${ORG}/page.tsx`)) {
    it(`${f} names itself through the one helper`, () => {
      const code = readCode(f);
      assert.match(code, /export async function generateMetadata/);
      assert.match(code, /clubPageMetadata\(/);
    });
  }
});

describe('5 · one name per thing (design log "Names")', () => {
  it('the tabs say House league and Past tournaments', () => {
    const sections = readCode('lib/org-public-sections.ts');
    assert.match(sections, /label: 'House league'/);
    assert.match(sections, /label: 'Past tournaments'/);
    assert.doesNotMatch(sections, /label: 'Archives'|label: 'League'/);
  });
});

describe('6 · the colours come from the one derivation (End state 9)', () => {
  it('the org layout writes the club\'s colour roles', () => {
    assert.match(readCode(`${ORG}/layout.tsx`), /clubColourRoles\(/);
  });
  it('the ground the ink is measured against IS the ground the page paints (one value, two homes, held equal)', () => {
    const css = readSource(FRAME_CSS);
    const roles = readSource('lib/club-colour-roles.ts');
    const ground = roles.match(/CLUB_GROUND = '(#[0-9A-F]{6})'/)?.[1];
    const card = roles.match(/CLUB_CARD = '(#[0-9A-F]{6})'/)?.[1];
    assert.ok(ground && card);
    assert.match(css, new RegExp(`--club-ground:\\s+${ground};`));
    assert.match(css, new RegExp(`--club-card:\\s+${card};`));
    assert.match(css, new RegExp(`:global\\(body\\):has\\(\\.site\\) \\{\\s+background: ${ground};`));
  });
  it('the frame reads the roles, never the dark-ground tint', () => {
    const css = readCode(FRAME_CSS);
    assert.match(css, /var\(--club-fill\)/);
    assert.match(css, /var\(--club-ink\)/);
  });
});
