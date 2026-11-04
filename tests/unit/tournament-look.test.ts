import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  hasOwnTournamentColours,
  parseTournamentLookPolicy,
  resolveTournamentLook,
  sanitizeTournamentLookPolicy,
  tournamentsWithOwnColours,
  TOURNAMENT_TYPE_LOOKS,
  type LookOrg,
  type LookTournament,
} from '../../lib/tournament-look.ts';
import {
  PLAIN_LOOK_LINE, tournamentLookCardWords, tournamentLookChoices, tournamentLookQuestion, tournamentLookWords,
} from '../../lib/tournament-look-words.ts';
import { frameBodyOf, lookOfDraft } from '../../app/[orgSlug]/admin/tournaments/branding/look-draft.ts';
import { publicFrameBand } from '../../lib/public-frame.ts';
import { CLUB_LOOK_FIELDS, CLUB_LOOKS } from '../../lib/public-site-builder.ts';
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

  it('a draft whose dates have started is named but never "on now" (the review\'s finding 2)', () => {
    const { current } = tournamentsWithOwnColours([
      row('Draft', { status: 'draft', startDate: '2026-11-01', endDate: '2026-11-03' }),
      row('Now', { startDate: '2026-11-01', endDate: '2026-11-03' }),
    ], today);
    assert.deepEqual(current.map(t => [t.name, t.live]), [['Now', true], ['Draft', false]]);
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
    // Stage 8 Part 3d: the live layout has no switch-off branch left, so these are unconditional.
    assert.match(live, /data-club-face=\{frameBand\.face\}/);
    assert.match(live, /data-card-style="default"/);
    assert.doesNotMatch(live, /cardStyle|themeCardStyle/);
    assert.match(live, /logoUrl=\{frameBand\.logoUrl\}\s+orgName=\{org\.name\}/, 'the nav context gets the one rule\'s mark');
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

/**
 * PART 2 — THE CLUB SIDE (2026-11-03): the Look row's Tournaments part, the question before *Always*, the shared colour and
 * type controls. Behind the preview switch: off, the editor is today's.
 */
describe('Part 2: the question\'s one sentence (the drawing\'s tab 2)', () => {
  const said = (q: ReturnType<typeof tournamentLookQuestion>) =>
    q?.sentence.map(p => (typeof p === 'string' ? p : `<${p.name}>`)).join('');
  const t = (name: string, live = false) => ({ name, live });

  it('three or fewer named, the one on now marked, finished ones counted', () => {
    const q = tournamentLookQuestion('club', { current: [t('Riverdale Fall Classic', true), t('Winter Indoor Showdown'), t('Spring Opener')], finished: 3 });
    assert.equal(q?.title, 'Always use the club\'s look?');
    assert.equal(said(q), '<Riverdale Fall Classic> (on now), <Winter Indoor Showdown> and <Spring Opener> will change to the club\'s colours and type, along with 3 finished tournaments.');
    assert.equal(q?.kept, 'Their own looks are kept.');
    assert.equal(q?.notNow, 'Not now');
    assert.equal(q?.confirm, 'Use the club\'s look');
  });

  it('more than three: three named, the rest counted; no finished clause when none finished', () => {
    const q = tournamentLookQuestion('club', { current: ['A', 'B', 'C', 'D', 'E', 'F', 'G'].map(n => t(n)), finished: 0 });
    assert.equal(said(q), '<A>, <B>, <C> and 4 more will change to the club\'s colours and type.');
  });

  it('one or two named; one finished is singular', () => {
    assert.equal(said(tournamentLookQuestion('club', { current: [t('Solo')], finished: 1 })),
      '<Solo> will change to the club\'s colours and type, along with 1 finished tournament.');
    assert.equal(said(tournamentLookQuestion('club', { current: [t('A'), t('B', true)], finished: 0 })),
      '<A> and <B> (on now) will change to the club\'s colours and type.');
  });

  it('only finished ones: counted as the subject', () => {
    assert.equal(said(tournamentLookQuestion('club', { current: [], finished: 2 })),
      '2 finished tournaments will change to the club\'s colours and type.');
  });

  it('nothing with its own colours: no question (it saves at once)', () => {
    assert.equal(tournamentLookQuestion('club', { current: [], finished: 0 }), null);
  });

  it('League Plus asks in the league\'s words', () => {
    const q = tournamentLookQuestion('league', { current: [t('Cup')], finished: 0 });
    assert.equal(q?.title, 'Always use the league\'s look?');
    assert.equal(q?.confirm, 'Use the league\'s look');
    assert.match(said(q) ?? '', /the league's colours and type/);
  });
});

describe('Part 2: the club editor (source guards)', () => {
  const editor = readCode('app/[orgSlug]/admin/public-site/page.tsx');
  const part = readCode('app/[orgSlug]/admin/public-site/TournamentLookPart.tsx');
  const look = readCode('app/[orgSlug]/admin/public-site/LookPanel.tsx');

  it('the editor learns the switch from its own read; off, no part, no hex fields', () => {
    assert.match(readCode('app/api/admin/public-site/route.ts'), /isPublicFrameOn\(\),[\s\S]*?NextResponse\.json\(\{[^}]*frameOn \}\)/);
    assert.match(editor, /setFrameOn\(data\.frameOn === true\)/);
    assert.match(editor, /const tournamentRule = frameOn && carries\.tournaments;/);
    assert.match(editor, /\{tournamentRule && \(\s*<TournamentLookPart/);
    assert.match(editor, /<LookPanel [^>]*hex=\{frameOn\}>/);
    assert.match(editor, /\.\.\.\(tournamentRule \? \[tournamentLookWords\(lookNoun\)\.summary\[tournamentLook\]\] : \[\]\)/);
  });

  it('the part saves through the Look row\'s queue and the org-settings field, for anyone who may write the Look (Ask 13)', () => {
    assert.match(editor, /onSave=\{next => lookQ\.run\(\(\) => orgPatch\(\{ tournamentLookPolicy: next \}\), W\.lookFailed\)\}/);
    assert.match(editor, /readOnly=\{!canWrite\}\s*onSave=/);
    assert.doesNotMatch(part, /isOwner/);
  });

  it('only Always asks, from the question list; Not now holds the focus and the radio waits for the lime answer', () => {
    assert.match(part, /if \(next !== 'always_club'\) return void save\(next\);/);
    assert.match(part, /\/api\/admin\/org\/tournament-look\?orgSlug=/);
    assert.match(part, /kind="question"/);
    assert.match(part, /onClose=\{\(\) => setAsking\(null\)\}/);
    assert.match(part, /data-autofocus="">\{asking\.notNow\}/);
    assert.match(part, /className="btn btn-lime" onClick=\{\(\) => void save\('always_club'\)\}/);
    assert.match(part, /footerStart=\{<span className=\{repKit\.footNote\}>\{asking\.kept\}<\/span>\}/);
  });

  it('one colour control and one type control: the club\'s Look and the Branding page share them', () => {
    assert.match(look, /<LookSwatches [^]*?hex=\{hex\}/);
    assert.match(look, /<LookTypeTiles /);
    assert.doesNotMatch(look, /Object\.entries\(PRESETS\)/);
    const branding = readCode('app/[orgSlug]/admin/tournaments/branding/page.tsx');
    // sameHex left with the App icon card (Stage 8 Part 1); the hex field is still the shared one.
    assert.match(branding, /import \{ HexField \} from '@\/components\/admin\/kit\/club\/LookControls';/);
    assert.doesNotMatch(branding, /function (HexField|sameHex)\(/);
  });
});

/**
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * PART 3 (2026-11-03): THE TOURNAMENT SIDE — the Branding page's Look card, behind the switch (the drawing's tabs 3–4).
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 */
describe('Part 3: the Look card\'s draft reads through the one rule', () => {
  const draft = { own: false, presetKey: 'platform', customPrimary: '#1E3A8A', customAccent: '#D9F99D', typeKey: null as string | null, publicHiddenPages: [] };

  it('A · a club\'s tournament with nothing saved follows the club — the FieldLogicHQ swatch is not a pick', () => {
    const l = resolveTournamentLook(club, lookOfDraft(draft, null));
    assert.equal(l.source, 'club');
    assert.equal(l.preset, 'forest');
    assert.equal(l.face, 'dm-serif');
    assert.equal(l.logoUrl, 'https://x/club.png', 'no event logo: the club\'s');
  });

  it('B · a swatch gives it its own look, the type starting on the club\'s; a tile is its own type', () => {
    const own = lookOfDraft({ ...draft, own: true, presetKey: 'crimson' }, 'https://x/t.png');
    assert.deepEqual([own.themePreset, own.themePrimary, own.themeFont], ['crimson', null, null]);
    const l = resolveTournamentLook(club, own);
    assert.equal(l.source, 'own');
    assert.equal(l.face, 'dm-serif');
    assert.equal(l.logoUrl, 'https://x/t.png');
    assert.equal(resolveTournamentLook(club, lookOfDraft({ ...draft, own: true, presetKey: 'crimson', typeKey: 'system' }, null)).face, 'warm',
      'Classic picked under a Serif club stays Classic');
    const custom = lookOfDraft({ ...draft, own: true, presetKey: 'custom', customPrimary: '#D04072' }, null);
    assert.deepEqual([custom.themePreset, custom.themePrimary], ['platform', '#D04072']);
  });

  it('C · Always: the club\'s colours and type over a saved look, which the draft keeps', () => {
    const always = { ...club, tournamentLookPolicy: 'always_club' } as LookOrg;
    const l = resolveTournamentLook(always, lookOfDraft({ ...draft, own: true, presetKey: 'crimson', typeKey: 'inter' }, 'https://x/t.png'));
    assert.equal(l.source, 'club');
    assert.equal(l.face, 'dm-serif');
    assert.equal(l.logoUrl, 'https://x/t.png', 'each keeps its own logo (Ask 10)');
  });

  it('D · Tournament Plus with nothing saved is the plain look, Classic — no leftover org look', () => {
    const l = resolveTournamentLook(plus, lookOfDraft(draft, null));
    assert.equal(l.source, 'plain');
    assert.equal(l.face, 'warm');
    assert.equal(l.logoUrl, null);
  });

  it('the type looks the card writes are the club\'s three, Classic stored as itself', () => {
    assert.deepEqual([...TOURNAMENT_TYPE_LOOKS], CLUB_LOOKS.map(l => l.font));
  });
});

describe('Part 3: the save under the frame (D7\'s rule, widened to the type)', () => {
  const d = {
    own: false, presetKey: 'platform', customPrimary: '#1E3A8A', customAccent: '#D9F99D', typeKey: null as string | null,
    publicHiddenPages: [], coachNamesShowOnPublic: false,
  };

  it('a save that touched neither carries no theme and no type — nor anything the page no longer shows', () => {
    const body = frameBodyOf(d, true, false, false) as Record<string, unknown>;
    // The App icon's three settings went with Stage 8 Part 1 (the home-screen icon is always FieldLogicHQ's).
    for (const k of ['themePreset', 'themePrimary', 'themeAccent', 'typeLook', 'themeFont', 'themeCardStyle', 'colorMode',
      'appName', 'iconBgColor', 'iconScale']) {
      assert.equal(k in body, false, k);
    }
    assert.equal('publicHiddenPages' in body, true);
  });

  it('"The club\'s look" writes the theme and the type null', () => {
    assert.deepEqual(frameBodyOf(d, true, true, true), {
      themePreset: null, themePrimary: null, themeAccent: null, typeLook: null,
      publicHiddenPages: [], coachNamesShowOnPublic: false,
    });
  });

  it('a swatch, Custom, and a type tile', () => {
    const swatch = frameBodyOf({ ...d, own: true, presetKey: 'crimson' }, true, true, false) as Record<string, unknown>;
    assert.deepEqual([swatch.themePreset, swatch.themePrimary, 'typeLook' in swatch], ['crimson', null, false]);
    const custom = frameBodyOf({ ...d, own: true, presetKey: 'custom', customPrimary: '#D04072' }, true, true, false) as Record<string, unknown>;
    assert.deepEqual([custom.themePreset, custom.themePrimary], ['platform', '#D04072']);
    const type = frameBodyOf({ ...d, typeKey: 'system' }, true, false, true) as Record<string, unknown>;
    assert.equal(type.typeLook, 'system');
    assert.equal('themePreset' in type, false);
  });

  it('a plan without branding sends the pages only', () => {
    assert.deepEqual(Object.keys(frameBodyOf({ ...d, own: true }, false, true, true)).sort(), ['coachNamesShowOnPublic', 'publicHiddenPages']);
  });
});

describe('Part 3: the Look card\'s words', () => {
  it('the club\'s words, and the league\'s on League Plus', () => {
    const c = tournamentLookCardWords('club');
    assert.equal(c.pill, "The club's look");
    assert.equal(`${c.typeLine.lead}Serif${c.typeLine.tail}`, "Type: Serif, the club's");
    assert.equal(`${c.follow.lead}${c.follow.door}${c.follow.tail}`,
      "Follows the club's look and changes when the club's does. The club sets it on its Public site.");
    assert.equal(c.lock, 'The club uses its look on every tournament: colours and type.');
    assert.equal(c.change, "Change the club's look");
    const l = tournamentLookCardWords('league');
    assert.equal(l.pill, "The league's look");
    assert.equal(l.lock, 'The league uses its look on every tournament: colours and type.');
    assert.equal(PLAIN_LOOK_LINE, 'FieldLogicHQ, the plain look. Pick a colour to make it yours.');
  });
});

describe('Part 3: the Branding page and its route (source guards)', () => {
  const page = readCode('app/[orgSlug]/admin/tournaments/branding/page.tsx');
  const card = readCode('app/[orgSlug]/admin/tournaments/branding/LookCard.tsx');
  const route = readCode('app/api/admin/tournament-branding/route.ts');
  const win = readCode('components/admin/kit/club/PhoneWindow.tsx');

  it('the read says whether the switch is on, with the band\'s facts only under it', () => {
    assert.match(route, /const frameOn = await isPublicFrameOn\(\);/);
    assert.match(route, /const band = frameOn && advanced\s*\? await publicFrameBandFacts\(/);
    assert.match(route, /frameOn,\s*band,\s*\}\);/);
    assert.match(page, /setFrameOn\(data\.frameOn === true\);/);
  });

  it('switch off is today\'s page: its body, its eight cards, its lock words', () => {
    assert.match(page, /held\.frameOn\s*\? frameBodyOf\([^)]*\)\s*: bodyOf\(held\.draft, held\.advanced, held\.themeChanged\)/);
    assert.match(page, /\{!frameOn && \(<>[\s\S]{0,120}?<CollapsibleCard title=\{W\.theme\}/);
    assert.match(page, /\{frameOn \? LOCK_WORDS\.brandingLook : LOCK_WORDS\.branding\}/);
    assert.match(page, /const logoHint = !frameOn \? W\.logoHint/);
  });

  it('under the frame the Look card comes first after Pages, before the Logo', () => {
    const at = (s: string) => page.indexOf(s);
    assert.ok(at('id="pages"') < at('<LookCard ') && at('<LookCard ') < at('title={W.logo}'));
  });

  it('the type is stored as picked, Classic included, and nothing outside the three', () => {
    assert.match(route, /'colorMode',\s*'typeLook',\s*\] as const;/);
    assert.match(route, /if \(!\(TOURNAMENT_TYPE_LOOKS as readonly string\[\]\)\.includes\(look\)\)/);
    assert.match(route, /updates\.theme_font = look;/);
    assert.match(route, /updates\.theme_font = font === 'system' \? null : font;/, 'the switch-off body keeps today\'s rule');
  });

  it('the App icon\'s settings are neither read nor written: a stale tab\'s save cannot set them (Stage 8 Part 1)', () => {
    // The columns stay (Stage 8 ask C); the route is what keeps them dormant.
    assert.doesNotMatch(route, /icon_bg_color|app_name|app_icon_scale|iconBgColor|iconScale|appName|iconBgSuggested/);
  });

  it('"Change the club\'s look" only for who may edit it; the Public site link only for who may open the editor', () => {
    assert.match(page, /mayChangeClubLook=\{mayOpenEditor && mayWriteSite\(userRole \?\? ''\)\}/);
    assert.match(page, /const editorHref = mayOpenEditor \?/);
    assert.match(card, /\{mayChangeClubLook && editorHref && <Link href=\{editorHref\}/);
    assert.match(card, /\{editorHref \? <Link href=\{editorHref\}[^>]*>\{words\.follow\.door\}<\/Link> : words\.follow\.door\}/);
  });

  it('the preview is the shipped band in a phone window, from the draft — never a drawing of it (ask 3)', () => {
    assert.match(card, /import TournamentBand from '@\/components\/public\/TournamentBand';/);
    assert.match(card, /const band = publicFrameBand\(org, \{ \.\.\.tournament, \.\.\.asSaved \}/);
    assert.match(card, /<PhoneWindow [^>]*>[\s\S]*<TournamentBand[\s\S]*<\/PhoneWindow>/);
    assert.match(win, /aria-hidden inert/);
    assert.match(win, /createPortal\(children, root\)/);
  });

  it('the window\'s band prefetches nothing: its links point at Branding sub-pages that do not exist (Stage 8 call 4)', () => {
    const band = readCode('components/public/TournamentBand.tsx');
    const tabs = readCode('components/public/TournamentTopTabs.tsx');
    // The card asks for it (it renders one band)…
    assert.match(card, /prefetch=\{false\}/);
    // …the band carries it to the name and to the tab row (the visitor's doors never render in the preview)…
    assert.equal(band.match(/prefetch=\{prefetch\}/g)?.length, 2);
    assert.match(band, /<Link href=\{homeHref\} prefetch=\{prefetch\}/);
    // …and the row puts it on every tab it draws.
    const linkCount = tabs.match(/<Link\b/g)?.length ?? 0;
    assert.ok(linkCount > 0, 'the tab row draws its tabs as Links');
    assert.equal(tabs.match(/prefetch=\{prefetch\}/g)?.length ?? 0, linkCount);
  });
});
