import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  hasOwnTournamentColours,
  parseTournamentLookPolicy,
  resolveTournamentLook,
  sanitizeTournamentLookPolicy,
  tournamentsWithOwnColours,
  type LookOrg,
  type LookTournament,
} from '../../lib/tournament-look.ts';
import { tournamentLookChoices, tournamentLookWords } from '../../lib/tournament-look-words.ts';
import { publicFrameBand } from '../../lib/public-frame.ts';
import { CLUB_LOOK_FIELDS } from '../../lib/public-site-builder.ts';
import { readCode } from './_source-code.ts';

/**
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * PUBLIC TOURNAMENT PAGES — STAGE 1a, PART 1: WHO OWNS THE LOOK (2026-11-02).
 * Plan: docs/projects/active/PUBLIC_TOURNAMENT_SITE_REVIEW_PLAN.md §4a; build prompt
 * PUBLIC_TOURNAMENT_STAGE1A_BUILD_PROMPT.md. Rulings: Asks 9–11, the owner's 2026-11-02 rulings.
 *
 * The resolver's case table, row by row, plus the edges the build prompt names: a club whose site is switched off, an
 * explicit FieldLogicHQ pick, a stale `barlow` font and a stale organization look on a Tournament Plus org.
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 */

const club: LookOrg = {
  planId: 'club', subscriptionStatus: 'active', enabledAddons: [], freeFloor: null,
  themePreset: 'forest', themePrimary: undefined, themeAccent: undefined, themeFont: 'dm-serif',
  logoUrl: 'https://x/club.png', tournamentLookPolicy: 'club_default',
} as LookOrg;
const plus: LookOrg = { ...club, planId: 'tournament_plus' };
const free: LookOrg = { ...club, planId: 'tournament' };

const bare: LookTournament = { themePreset: null, themePrimary: null, themeAccent: null, themeFont: null, logoUrl: null };
const pink: LookTournament = { ...bare, themePrimary: '#E0457B', themeAccent: '#FFD1E0' };

describe('the resolver, row by row', () => {
  it('no tournament branding (free): neutral, Classic, no mark — whatever is saved', () => {
    const l = resolveTournamentLook(free, { ...pink, themeFont: 'inter', logoUrl: 'https://x/t.png' });
    assert.equal(l.source, 'neutral');
    assert.equal(l.face, 'warm');
    assert.equal(l.logoUrl, null);
    assert.equal(l.policy, null);
  });

  it('club, default, own colours: own colours, own type else the club\'s, own logo else the club\'s', () => {
    const l = resolveTournamentLook(club, pink);
    assert.equal(l.source, 'own');
    assert.equal(l.primary, '#E0457B');
    assert.equal(l.accent, '#FFD1E0');
    assert.equal(l.face, 'dm-serif', 'no type of its own → the club\'s');
    assert.equal(l.logoUrl, 'https://x/club.png');
    assert.equal(resolveTournamentLook(club, { ...pink, themeFont: 'inter' }).face, 'inter');
    assert.equal(resolveTournamentLook(club, { ...pink, logoUrl: 'https://x/t.png' }).logoUrl, 'https://x/t.png');
  });

  it('club, default, nothing saved: the club\'s colours and type', () => {
    const l = resolveTournamentLook(club, bare);
    assert.equal(l.source, 'club');
    assert.equal(l.preset, 'forest');
    assert.equal(l.face, 'dm-serif');
    assert.equal(l.policy, 'club_default');
  });

  it('club, always: the club\'s colours and type over the tournament\'s own; the event logo stays the tournament\'s (Ask 10)', () => {
    const always = { ...club, tournamentLookPolicy: 'always_club' } as LookOrg;
    const l = resolveTournamentLook(always, { ...pink, themeFont: 'inter', logoUrl: 'https://x/t.png' });
    assert.equal(l.source, 'club');
    assert.equal(l.preset, 'forest');
    assert.equal(l.primary, null);
    assert.equal(l.face, 'dm-serif');
    assert.equal(l.logoUrl, 'https://x/t.png');
    assert.equal(l.policy, 'always_club');
    assert.equal(resolveTournamentLook(always, bare).logoUrl, 'https://x/club.png', 'no logo of its own → the club\'s');
  });

  it('Tournament Plus, own colours: own colours, own type else Classic, own logo only', () => {
    const l = resolveTournamentLook(plus, pink);
    assert.equal(l.source, 'own');
    assert.equal(l.primary, '#E0457B');
    assert.equal(l.face, 'warm', 'never the org\'s leftover type');
    assert.equal(l.logoUrl, null, 'never the org\'s leftover logo');
    assert.equal(l.policy, null);
    assert.equal(resolveTournamentLook(plus, { ...pink, themeFont: 'dm-serif' }).face, 'dm-serif');
  });

  it('Tournament Plus, nothing saved: the plain FieldLogicHQ look, never a leftover organization look', () => {
    const stale = { ...plus, themePreset: 'custom', themePrimary: '#F2C94C', themeFont: 'inter', tournamentLookPolicy: 'always_club' } as LookOrg;
    const l = resolveTournamentLook(stale, bare);
    assert.equal(l.source, 'plain');
    assert.equal(l.preset, 'platform');
    assert.equal(l.primary, null);
    assert.equal(l.face, 'warm');
    assert.equal(l.logoUrl, null);
    assert.equal(l.policy, null, 'no club layer: the rule is not read');
  });
});

describe('the edges', () => {
  it('a club with its site switched off still has a look (the module, not the switch)', () => {
    const off = { ...club, isPublic: false } as LookOrg;
    assert.equal(resolveTournamentLook(off, bare).source, 'club');
  });

  it('League Plus and Club · Association carry the site module', () => {
    assert.equal(resolveTournamentLook({ ...club, planId: 'league' }, bare).source, 'club');
    assert.equal(resolveTournamentLook({ ...club, planId: 'club_large' }, bare).source, 'club');
  });

  it('an explicit FieldLogicHQ pick counts as own colours', () => {
    const fl = { ...bare, themePreset: 'platform' };
    assert.equal(hasOwnTournamentColours(fl), true);
    assert.equal(resolveTournamentLook(club, fl).source, 'own');
    assert.equal(resolveTournamentLook(club, fl).preset, 'platform');
  });

  it('a stale `barlow` font reads as Classic', () => {
    assert.equal(resolveTournamentLook(club, { ...pink, themeFont: 'barlow' }).face, 'warm');
    assert.equal(resolveTournamentLook(plus, { ...pink, themeFont: 'barlow' }).face, 'warm');
  });

  it('a missing or unknown stored rule reads as the default', () => {
    assert.equal(resolveTournamentLook({ ...club, tournamentLookPolicy: undefined }, pink).source, 'own');
    assert.equal(resolveTournamentLook({ ...club, tournamentLookPolicy: 'nonsense' as never }, pink).source, 'own');
  });
});

describe('the sanitiser and the words', () => {
  it('sanitises a stored value and parses a body strictly', () => {
    assert.equal(sanitizeTournamentLookPolicy('always_club'), 'always_club');
    assert.equal(sanitizeTournamentLookPolicy('ALWAYS'), 'club_default');
    assert.equal(sanitizeTournamentLookPolicy(null), 'club_default');
    assert.equal(parseTournamentLookPolicy('club_default'), 'club_default');
    assert.equal(parseTournamentLookPolicy(1), null);
    assert.equal(parseTournamentLookPolicy(''), null);
  });

  it('says the club\'s words, and the league\'s on League Plus', () => {
    assert.equal(tournamentLookChoices('club')[0].name, "The club's look, unless a tournament chooses its own");
    assert.equal(tournamentLookChoices('league')[1].name, "Always the league's look");
    assert.equal(tournamentLookWords('club').summary.always_club, 'every tournament');
  });
});

describe('the question before Always: who it names', () => {
  const row = (id: string, o: Record<string, unknown>) =>
    ({ id, name: id, status: 'active', startDate: null, endDate: null, championsCrownedAt: null, themePreset: null, themePrimary: '#E0457B', ...o }) as never;
  const today = '2026-11-02';

  it('the one on now first, then by start date; one without own colours is never named', () => {
    const { current, finished } = tournamentsWithOwnColours([
      row('Spring', { startDate: '2027-04-10', endDate: '2027-04-12' }),
      row('Fall', { startDate: '2026-12-05', endDate: '2026-12-06' }),
      row('Now', { startDate: '2026-11-01', endDate: '2026-11-03' }),
      row('Plain', { startDate: '2026-11-20', themePrimary: null }),
      row('Undated', {}),
    ], today);
    assert.deepEqual(current.map(t => t.name), ['Now', 'Fall', 'Spring', 'Undated']);
    assert.deepEqual(current.map(t => t.live), [true, false, false, false]);
    assert.equal(finished, 0);
  });

  it('finished ones are counted, not named: completed, archived, crowned or past', () => {
    const { current, finished } = tournamentsWithOwnColours([
      row('Done', { status: 'completed' }),
      row('Archived', { status: 'archived' }),
      row('Crowned', { startDate: '2026-11-01', endDate: '2026-11-03', championsCrownedAt: '2026-11-02T20:00:00Z' }),
      row('Past', { startDate: '2026-06-01', endDate: '2026-06-02' }),
      row('Past plain', { startDate: '2026-06-01', themePrimary: null }),
      row('Next', { startDate: '2026-12-01', themePreset: 'platform', themePrimary: null }),
    ], today);
    assert.deepEqual(current.map(t => t.name), ['Next'], 'an explicit FieldLogicHQ pick is its own colours');
    assert.equal(finished, 4);
  });
});

describe('the gate, the band and the doors (source guards)', () => {
  it('the rule is a club look field an admin may send (Ask 13 — not owner-only)', () => {
    assert.ok(CLUB_LOOK_FIELDS.includes('tournamentLookPolicy'));
  });

  it('org-settings refuses the rule without the site module, for the owner too, and parses it strictly', () => {
    const route = readCode('app/api/admin/org-settings/route.ts');
    assert.match(route, /if \(body\.tournamentLookPolicy !== undefined\) \{\s*if \(!hasModuleEntitlement\(org, 'module_public_site'\)\)/);
    assert.match(route, /const policy = parseTournamentLookPolicy\(body\.tournamentLookPolicy\);\s*if \(!policy\)/);
  });

  it('the question\'s list sits behind the editor\'s gate (the site module, for everyone)', () => {
    const route = readCode('app/api/admin/org/tournament-look/route.ts');
    assert.match(route, /await publicSiteEditor\(req, \{ write: false \}\)/);
    assert.match(route, /tournamentsWithOwnColours\(tournaments, tournamentToday\(\)\)/);
  });

  it('the band carries the type look and the one rule\'s logo', () => {
    const t = { name: 'Fall Classic', status: 'active', startDate: '2026-12-05', endDate: '2026-12-06', ...pink, logoUrl: null };
    const b = publicFrameBand(club as never, t as never, '2026-11-02', false);
    assert.equal(b.face, 'dm-serif');
    assert.equal(b.logoUrl, 'https://x/club.png');
    assert.equal(publicFrameBand(plus as never, t as never, '2026-11-02', false).logoUrl, null, 'Tournament Plus never borrows an org logo');
  });

  it('the frame wears the face and no card style, on the live page and the admin preview', () => {
    const live = readCode('app/[orgSlug]/[tournamentSlug]/layout.tsx');
    assert.match(live, /data-club-face=\{frameBand\?\.face\}/);
    assert.match(live, /data-card-style=\{frameOn \? 'default' : cardStyle\}/);
    assert.match(live, /logoUrl=\{frameBand \? frameBand\.logoUrl :/);
    const preview = readCode('app/[orgSlug]/admin/tournaments/preview/[tournamentSlug]/layout.tsx');
    assert.match(preview, /data-club-face=\{band\.face\}/);
    assert.match(preview, /deskShell\}`\} data-card-style="default" data-color-mode="light"/);
    // The org layout's wrapper still carries the org's style: every card variant excludes a frame card.
    const css = readCode('app/globals.css');
    for (const v of ['glass', 'outlined', 'flat']) {
      assert.match(css, new RegExp(`\\[data-card-style="${v}"\\] \\.card:where\\([^{]*\\):where\\(:not\\(\\[data-public-frame\\] \\.card\\)\\)`), v);
    }
  });

  it('the three share images take their colour from the one rule', () => {
    for (const f of [
      'app/[orgSlug]/[tournamentSlug]/opengraph-image.tsx',
      'app/[orgSlug]/[tournamentSlug]/teams/[id]/opengraph-image.tsx',
      'app/[orgSlug]/[tournamentSlug]/schedule/[gameId]/opengraph-image.tsx',
    ]) {
      const src = readCode(f);
      assert.match(src, /const theme = await shareImageTheme\(orgSlug, /, f);
      assert.doesNotMatch(src, /resolveTheme\(/, `${f}: no second copy of the rule`);
    }
    assert.match(readCode('lib/tournament-share-look.ts'), /resolveTournamentLook\(org, tournament\)/);
  });

  it('the Settings door and the editor ask the plan, not only the capability (no dead door on Tournament Plus)', () => {
    const settings = readCode('components/admin/kit/club/SettingsKit.tsx');
    assert.match(settings, /\{hasModuleEntitlement\(currentOrg, 'module_public_site'\) && \(\s*<section[^>]*aria-labelledby="settings-public-site"/);
    const editor = readCode('app/[orgSlug]/admin/public-site/page.tsx');
    assert.match(editor, /const noSite = !!currentOrg && !hasModuleEntitlement\(currentOrg, 'module_public_site'\);/);
  });
});
