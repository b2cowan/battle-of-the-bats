import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, it } from 'node:test';
import {
  sameNameCandidates, bornWarning, pickerFootLine, pickerHint, pickerRowLine, duesChip, seasonClosedRefusal,
  alreadyOnRoster, acceptRefusalBody, acceptRefusalOpen, pasteNeedsAnswer, sameChildHead, sameChildDetail, sameChildYes,
  sameChildFoot, backFromCaption, joinSameSeasonRefusal, type PastPlayer,
} from '../../lib/past-player-words';
import {
  partitionEntries, toPastPlayers, carriedEntryFields, decideAddDoor, decideAcceptWith, acceptLookupIds,
  parseSameChildAnswer, parseAcceptAnswer, isChildAlreadyOnSeason,
} from '../../lib/past-player-rules';
import { PAST_PLAYER_PICKER_BUILT } from '../../lib/season-roll-path';
import type { RepProgramYear, RepRosterPlayer } from '../../lib/types';

/**
 * CLUB TIER STAGE 14 S3 — "Bring back a past player" and "Same child?" (owner rulings 2026-11-04, Asks 4, 5, 9, 12;
 * the drawing's tabs 3, 4 and 8). The rules that must hold however the screens change:
 *   · a match is the SAME first and last name against THIS team's earlier seasons — twins are never asked about, a
 *     missing last name never asks, a stored or given "no" is never asked again;
 *   · without the roster-details grant the picker shows names and seasons only;
 *   · every add door re-checks the window's answer on the server before it writes (the accept's three branches);
 *   · a returning child's entry is copied like the roll's, and is the SAME child.
 */

const REPO = path.join(import.meta.dirname, '..', '..');
const read = (p: string) => readFileSync(path.join(REPO, p), 'utf8');

const season = (id: string, year: number, extra: Partial<RepProgramYear> = {}): RepProgramYear => ({
  id, teamId: 't', orgId: 'o', name: `${year} Season`, year, status: 'completed', tryoutOpen: false,
  tryoutDescription: null, bornFromYear: null, bornToYear: null, bornYearsCarried: false, budgetAmount: null,
  autoRemindersEnabled: false, creditApplication: 'next_first', defaultPlayerCreditPercent: 0,
  ...extra,
} as unknown as RepProgramYear);

let seq = 0;
const entry = (over: Partial<RepRosterPlayer>): RepRosterPlayer => ({
  id: `e${++seq}`, programYearId: 'y2025', teamId: 't', orgId: 'o', childId: `c${seq}`, tryoutRegistrationId: null,
  playerFirstName: 'Jonah', playerLastName: 'Ruiz', playerDateOfBirth: '2015-01-14', playerNumber: '9',
  primaryPosition: null, secondaryPosition: null, status: 'active', source: 'admin_manual',
  guardianFirstName: 'Marisol', guardianLastName: 'Ruiz', guardianEmail: 'm@example.com', guardianPhone: null,
  notes: null, adminNotes: 'staff only', medicalNotes: 'asthma', emergencyContactName: null, emergencyContactPhone: null,
  bats: null, throws: null, jerseySize: null, lineupProfile: null, createdAt: '2025-01-01', updatedAt: '2025-01-01',
  ...over,
} as RepRosterPlayer);

const past = (over: Partial<PastPlayer>): PastPlayer => ({
  childId: 'k1', entryId: 'e', firstName: 'Jonah', lastName: 'Ruiz', number: '9', status: 'active',
  season: { id: 'y2026', name: '2026 Season', year: 2026 }, callUpGames: null, dateOfBirth: '2015-01-14',
  family: 'Marisol Ruiz', dues: null, bornWarning: null, ...over,
});

const JAN1 = { m: 1, d: 1 };

describe('the match rule — same first and last name, this team only, never twins', () => {
  const list = [
    past({ childId: 'old', season: { id: 'a', name: '2024 Season', year: 2024 } }),
    past({ childId: 'new', season: { id: 'b', name: '2026 Season', year: 2026 } }),
    past({ childId: 'ava', firstName: 'Ava', lastName: 'Rao' }),
  ];
  it('matches after the matcher’s normalising, newest season first', () => {
    assert.deepEqual(sameNameCandidates('  jonah ', 'RUIZ', list).map(p => p.childId), ['new', 'old']);
  });
  it('twins — another first name — are never asked about', () => {
    assert.deepEqual(sameNameCandidates('Alex', 'Rao', list), []);
  });
  it('a missing last name never asks', () => {
    assert.deepEqual(sameNameCandidates('Jonah', '', list), []);
    assert.deepEqual(sameNameCandidates('Jonah', null, list), []);
  });
  it('a child already answered "no" is left out', () => {
    assert.deepEqual(sameNameCandidates('Jonah', 'Ruiz', list, new Set(['new'])).map(p => p.childId), ['old']);
  });
});

describe('the birth-year warning (Ask 12) — warn, never block', () => {
  const years = { from: 2015, to: 2016 };
  it('names the child’s year and the team’s', () => {
    assert.equal(bornWarning('2014-10-30', years, JAN1), 'Born 2014. The team is 2015–2016.');
  });
  it('is quiet when the child fits, when there is no date, or when the team has no birth years', () => {
    assert.equal(bornWarning('2015-08-02', years, JAN1), null);
    assert.equal(bornWarning(null, years, JAN1), null);
    assert.equal(bornWarning('2014-10-30', { from: null, to: null }, JAN1), null);
  });
});

describe('who is a past player', () => {
  const seasons = [season('y2024', 2024), season('y2025', 2025), season('y2026', 2026), season('y2027', 2027, { status: 'active' }), season('y2028', 2028)];
  const working = { id: 'y2027', year: 2027 };
  it('the latest earlier entry per child; nobody already on the working season; never a later season', () => {
    const a24 = entry({ programYearId: 'y2024', childId: 'A' });
    const a25 = entry({ programYearId: 'y2025', childId: 'A' });
    const b26 = entry({ programYearId: 'y2026', childId: 'B' });
    const b27 = entry({ programYearId: 'y2027', childId: 'B' });
    const c28 = entry({ programYearId: 'y2028', childId: 'C' });
    const { latest, onWorking } = partitionEntries([a24, a25, b26, b27, c28], seasons, working);
    assert.deepEqual([...latest.keys()], ['A']);
    assert.equal(latest.get('A')!.id, a25.id);
    assert.equal(onWorking.get('B')!.id, b27.id);
  });
});

describe('the picker’s rows — names and seasons only without the roster-details grant', () => {
  const seasons = new Map([['y2025', season('y2025', 2025)]]);
  const e = entry({ programYearId: 'y2025', childId: 'P', playerFirstName: 'Priya', playerLastName: 'Nair', playerDateOfBirth: '2014-10-30' });
  const base = {
    latest: new Map([['P', e]]), seasonById: seasons, callUpGames: new Map<string, number>(),
    figures: new Map([[e.id, { balance: 120, ladder: { dues: 500 } as never }]]),
    born: { from: 2015, to: 2016 }, cutoff: JAN1,
  };
  it('with the grant: birth date, family, that season’s dues and the warning', () => {
    const [row] = toPastPlayers({ ...base, access: { rosterPii: true, money: true } });
    assert.equal(row.dateOfBirth, '2014-10-30');
    assert.equal(row.family, 'Marisol Ruiz');
    assert.deepEqual(row.dues, { kind: 'owing', amount: 120 });
    assert.equal(row.bornWarning, 'Born 2014. The team is 2015–2016.');
    assert.equal(duesChip(row)!.text, '$120.00 owing from 2025');
  });
  it('without it: none of them (and no birth year leaks through the warning)', () => {
    const [row] = toPastPlayers({ ...base, access: { rosterPii: false, money: true } });
    assert.equal(row.dateOfBirth, null);
    assert.equal(row.family, null);
    assert.equal(row.dues, null);
    assert.equal(row.bornWarning, null);
    assert.equal(pickerRowLine(row), 'Last played the 2025 Season · #9');
  });
  it('money access is needed for the dues too', () => {
    const [row] = toPastPlayers({ ...base, access: { rosterPii: true, money: false } });
    assert.equal(row.dues, null);
  });
  it('settled reads the season’s own book, and a call-up names its games', () => {
    const [row] = toPastPlayers({ ...base, figures: new Map([[e.id, { balance: 0, ladder: { dues: 500 } as never }]]), access: { rosterPii: true, money: true } });
    assert.equal(duesChip(row)!.text, '2025 dues settled');
    assert.equal(pickerRowLine(past({ status: 'callup', callUpGames: 3, family: null })),
      'Called up for 3 games in the 2026 Season · no family on file');
    assert.equal(pickerRowLine(past({ status: 'callup', callUpGames: 3 }), true), '3 games in the 2026 Season');
  });
});

describe('a returning child is copied like the roll copies, and is the same child', () => {
  it('carries the child and the player-intrinsic fields, never the staff note or the tryout link', () => {
    const f = carriedEntryFields(entry({ childId: 'K', tryoutRegistrationId: 'reg' }));
    assert.equal(f.childId, 'K');
    assert.equal(f.medicalNotes, 'asthma');
    assert.ok(!('adminNotes' in f));
    assert.ok(!('tryoutRegistrationId' in f));
  });
  it('the roll and the picker share the one copy list', () => {
    assert.match(read('lib/rep-season-rollover.ts'), /\.\.\.carriedEntryFields\(p\),/);
    assert.match(read('lib/past-players.ts'), /const copy = carriedEntryFields\(p\.prior\);/);
  });
});

describe('the add doors re-check the window’s answer', () => {
  const prior = entry({ childId: 'K', programYearId: 'y2026' });
  const here = entry({ childId: 'H', programYearId: 'y2027', playerFirstName: 'Ella', playerLastName: 'Brooks' });
  const r = { past: [past({ childId: 'K' })], latest: new Map([['K', prior]]), onWorking: new Map([['H', here]]) };
  const none = parseSameChildAnswer({});
  it('an unanswered match asks — nothing is written', () => {
    const d = decideAddDoor(r, 'Jonah', 'Ruiz', none);
    assert.equal(d.kind, 'ask');
  });
  it('"No" adds a new child and stores the no; "Yes" brings that child back', () => {
    assert.deepEqual(decideAddDoor(r, 'Jonah', 'Ruiz', parseSameChildAnswer({ notSameChildIds: ['K', 'stray'] })), { kind: 'new', notSameChildIds: ['K'] });
    const yes = decideAddDoor(r, 'Jonah', 'Ruiz', parseSameChildAnswer({ sameChildId: 'K' }));
    assert.equal(yes.kind, 'same');
  });
  it('a "yes" for a child already on the roster is refused; an unknown child is refused', () => {
    assert.equal(decideAddDoor(r, 'Ella', 'Brooks', parseSameChildAnswer({ sameChildId: 'H' })).kind, 'already_here');
    assert.equal(decideAddDoor(r, 'X', 'Y', parseSameChildAnswer({ sameChildId: 'nobody' })).kind, 'unknown');
  });
  it('no match, no question', () => {
    assert.deepEqual(decideAddDoor(r, 'Theo', 'Marchetti', none), { kind: 'new', notSameChildIds: [] });
  });
  it('a past child already answered "no" for a same-name player on this season is not asked again (Ask 4: never, anywhere)', () => {
    const answered = { ...r, answeredNo: new Set(['K']) };
    assert.deepEqual(decideAddDoor(answered, 'Jonah', 'Ruiz', none), { kind: 'new', notSameChildIds: [] });
    // …but a typed name that matches a different past child still asks.
    const two = { ...answered, past: [...r.past, past({ childId: 'K2', firstName: 'Jonah', lastName: 'Ruiz' })] };
    const d = decideAddDoor(two, 'Jonah', 'Ruiz', none);
    assert.equal(d.kind === 'ask' && d.candidate.childId, 'K2');
  });
  it('the stored answers are read once per request and sent with the list, and both screens use them', () => {
    assert.match(read('lib/past-players.ts'), /answeredNoForSeason\(onWorking, latest\)/);
    assert.match(read('app/api/coaches/[orgSlug]/teams/[teamId]/roster/past-players/route.ts'), /answeredNo: \[\.\.\.\(read\.answeredNo \?\? \[\]\)\]/);
    assert.match(read('app/[orgSlug]/coaches/teams/[teamId]/roster/page.tsx'), /pastPlayers\.data\?\.answeredNo/);
    assert.match(read('components/coaches/RosterBulkAddSheet.tsx'), /past\.data\?\.answeredNo/);
  });
  it('a "no" about a name the coach has since edited is dropped, not stored (review 2026-11-04)', () => {
    // "No" was given for Jonah Ruiz; the box now says Jonas Ruiz — nobody asked whether Jonas is Jonah.
    assert.deepEqual(decideAddDoor(r, 'Jonas', 'Ruiz', parseSameChildAnswer({ notSameChildIds: ['K'] })), { kind: 'new', notSameChildIds: [] });
  });
  it('the routes ask the rule before they write', () => {
    const roster = read('app/api/coaches/[orgSlug]/teams/[teamId]/roster/route.ts');
    assert.ok(roster.indexOf('decideAddDoor(') > 0 && roster.indexOf('decideAddDoor(') < roster.indexOf('createRepRosterPlayer({'));
    const bulk = read('app/api/coaches/[orgSlug]/teams/[teamId]/roster/bulk/route.ts');
    assert.ok(bulk.indexOf("code: 'needs_answer'") > 0 && bulk.indexOf("code: 'needs_answer'") < bulk.indexOf('createRepRosterPlayer({'));
  });
});

describe('the tryout accept — attach, ask, or refuse', () => {
  const prior = entry({ childId: 'K', programYearId: 'y2026' });
  const ella = entry({ childId: 'E', programYearId: 'y2027', playerFirstName: 'Ella', playerLastName: 'Brooks' });
  const r = { past: [past({ childId: 'K' })], latest: new Map([['K', prior]]), onWorking: new Map([['E', ella]]) };
  const reg = (over: Partial<{ childId: string; playerFirstName: string; playerLastName: string }> = {}) =>
    ({ childId: 'R', playerFirstName: 'Jonah', playerLastName: 'Ruiz', ...over });
  const none = parseAcceptAnswer({});
  it('a confirmed returning sign-up already IS the past child — it attaches with no question', () => {
    // S2: the board's confirm joined the sign-up's child into K's, so the sign-up's child is K.
    const d = decideAcceptWith(r, reg({ childId: 'K' }), none, new Set());
    assert.deepEqual(d, { kind: 'go', confirmPrior: null, notSameChildIds: [] });
  });
  it('an unconfirmed same-name past player asks first; "yes" confirms that child, "no" is stored', () => {
    assert.equal(decideAcceptWith(r, reg(), none, new Set()).kind, 'ask');
    const yes = decideAcceptWith(r, reg(), parseAcceptAnswer({ sameChildId: 'K' }), new Set());
    assert.equal(yes.kind, 'go');
    assert.equal(yes.kind === 'go' && yes.confirmPrior?.id, prior.id);
    assert.deepEqual(decideAcceptWith(r, reg(), parseAcceptAnswer({ notSameChildIds: ['K'] }), new Set()),
      { kind: 'go', confirmPrior: null, notSameChildIds: ['K'] });
  });
  it('a stored "no" is never asked again', () => {
    assert.equal(decideAcceptWith(r, reg(), none, new Set(['K'])).kind, 'go');
  });
  it('the sign-up’s own child already on the roster is refused, with no way through', () => {
    assert.equal(decideAcceptWith(r, reg({ childId: 'E', playerFirstName: 'Ella', playerLastName: 'Brooks' }), none, new Set()).kind, 'refuse_same');
  });
  it('a same NAME on the roster, another record, is refused — and "A different child — add anyway" goes through', () => {
    const asEllaToo = reg({ playerFirstName: 'Ella', playerLastName: 'Brooks' });
    assert.equal(decideAcceptWith(r, asEllaToo, none, new Set()).kind, 'refuse_name');
    const anyway = decideAcceptWith(r, asEllaToo, parseAcceptAnswer({ differentFromChildId: 'E' }), new Set());
    assert.deepEqual(anyway, { kind: 'go', confirmPrior: null, notSameChildIds: ['E'] });
    assert.equal(decideAcceptWith(r, asEllaToo, none, new Set(['E'])).kind, 'go', 'a stored no lets it through too');
  });
  it('"add anyway" is remembered across the next question, so the refusal does not come back (review 2026-11-04)', () => {
    // A same-name entry (E) is on the roster AND a same-name past player (K) exists. The window sends "add anyway" for E,
    // is asked about K, and answers — now carrying E only as a "no", never as differentFromChildId again.
    const both = {
      past: [past({ childId: 'K' })], latest: new Map([['K', prior]]),
      onWorking: new Map([['E', entry({ childId: 'E', programYearId: 'y2027', playerFirstName: 'Jonah', playerLastName: 'Ruiz' })]]),
    };
    assert.equal(decideAcceptWith(both, reg(), none, new Set()).kind, 'refuse_name');
    assert.equal(decideAcceptWith(both, reg(), parseAcceptAnswer({ differentFromChildId: 'E' }), new Set()).kind, 'ask');
    assert.deepEqual(decideAcceptWith(both, reg(), parseAcceptAnswer({ notSameChildIds: ['E', 'K'] }), new Set()),
      { kind: 'go', confirmPrior: null, notSameChildIds: ['E', 'K'] });
    const yes = decideAcceptWith(both, reg(), parseAcceptAnswer({ sameChildId: 'K', notSameChildIds: ['E'] }), new Set());
    assert.deepEqual(yes.kind === 'go' && yes.notSameChildIds, ['E']);
  });
  it('a "no" is stored only against this sign-up’s own namesakes — never the child said yes to, never a made-up id', () => {
    const yes = decideAcceptWith(r, reg(), parseAcceptAnswer({ sameChildId: 'K', notSameChildIds: ['K', 'E', 'someone-elses-child'] }), new Set());
    assert.equal(yes.kind, 'go');
    // K is the child just said yes to, E (Ella Brooks) is no namesake of Jonah Ruiz and the third id is invented: none survive.
    assert.deepEqual(yes.kind === 'go' && yes.notSameChildIds, []);
    const no = decideAcceptWith(r, reg(), parseAcceptAnswer({ notSameChildIds: ['K', 'someone-elses-child'] }), new Set());
    assert.deepEqual(no, { kind: 'go', confirmPrior: null, notSameChildIds: ['K'] });
  });
  it('twins are never asked about at accept', () => {
    assert.equal(decideAcceptWith(r, reg({ playerFirstName: 'Jonas' }), none, new Set()).kind, 'go');
  });
  it('the stored-no lookup covers both kinds of match', () => {
    assert.deepEqual(acceptLookupIds(r, reg({ playerFirstName: 'Ella', playerLastName: 'Brooks' })), ['E']);
    assert.deepEqual(acceptLookupIds(r, reg()), ['K']);
  });
  it('the route decides before it accepts', () => {
    const src = read('app/api/coaches/[orgSlug]/teams/[teamId]/tryout-decisions/accept/route.ts');
    assert.ok(src.indexOf('decideAccept(') > 0 && src.indexOf('decideAccept(') < src.indexOf('acceptTryoutAndAddToRoster(reg.id)'));
  });
  it('the confirm’s two database refusals are a 409, and the "no"s go to the child that survived the join (review)', () => {
    const src = read('app/api/coaches/[orgSlug]/teams/[teamId]/tryout-decisions/accept/route.ts');
    assert.match(src, /confirmReturningAtAccept\([\s\S]*?catch \(e\)[\s\S]*?isChildAlreadyOnSeason\(e\)[\s\S]*?code === '23505'/);
    assert.match(src, /childId: decision\.confirmPrior\?\.childId \?\? reg\.childId/);
  });
});

describe('one child, once a season (owner ruling 2026-11-04, mig 438)', () => {
  it('the index exists and every writer maps its refusal', () => {
    const mig = read('supabase/migrations/438_a_no_is_remembered_and_a_child_plays_once_a_season.sql');
    assert.match(mig, /create unique index if not exists rep_roster_players_one_child_per_season\s+on public\.rep_roster_players \(child_id, program_year_id\)/);
    assert.match(read('lib/db.ts'), /rep_roster_players_one_child_per_season/);
    assert.match(read('app/api/coaches/[orgSlug]/teams/[teamId]/development/continuity/[linkId]/route.ts'), /isChildAlreadyOnSeason\(error\)/);
  });
  it('recognises the refusal by the index name only', () => {
    assert.equal(isChildAlreadyOnSeason({ code: '23505', message: 'duplicate key value violates unique constraint "rep_roster_players_one_child_per_season"' }), true);
    assert.equal(isChildAlreadyOnSeason({ code: '23505', message: 'rep_player_continuity_links_pair_uniq' }), false);
  });
  it('the join keeps the stored "no"s', () => {
    assert.match(read('supabase/migrations/438_a_no_is_remembered_and_a_child_plays_once_a_season.sql'),
      /insert into public\.child_match_rejections[\s\S]*on conflict \(child_a_id, child_b_id\) do nothing;\s+delete from public\.org_children where id = p_absorb;/);
  });
});

describe('the picker route', () => {
  const src = read('app/api/coaches/[orgSlug]/teams/[teamId]/roster/past-players/route.ts');
  it('is the head coach’s (the grant that adds a player) and refuses a closed season in the drawn words', () => {
    assert.match(src, /denyUnless\(assignment\.capabilities\.rosterWrite/);
    assert.match(src, /code: 'season_closed'/);
    assert.equal(seasonClosedRefusal({ name: '2027 Season' }), 'The 2027 Season is closed, so no one can be added. Reopen it from Settings first.');
  });
  it('redacts by the member’s grant and reads dues only with money access', () => {
    assert.match(src, /access: \{ rosterPii: r\.capabilities\.rosterPii, money: canViewMoney\(r\.capabilities\) \}/);
  });
  it('the S1 window now points at it', () => {
    assert.equal(PAST_PLAYER_PICKER_BUILT, true);
  });
});

describe('the drawn words', () => {
  const season27 = { id: 'y', name: '2027 Season', year: 2027 };
  const jonah = past({});
  it('the picker', () => {
    assert.equal(pickerHint('Hawks', season27),
      'Players from Hawks’ earlier seasons who aren’t on the 2027 Season roster. They come back with their history. Their contact details come from their last season with the team.');
    assert.equal(pickerFootLine(season27), 'They join the 2027 Season as active players.');
    assert.equal(pickerRowLine(jonah), 'Last played the 2026 Season · #9 · born Jan 14, 2015 · Marisol Ruiz');
    assert.equal(alreadyOnRoster('Jonah Ruiz', season27), 'Jonah Ruiz is already on the 2027 roster.');
  });
  it('"Same child?"', () => {
    assert.equal(sameChildHead(jonah, 'the Hawks'), 'Jonah Ruiz played for the Hawks in the 2026 Season.');
    assert.equal(sameChildDetail(jonah), '#9 · born Jan 14, 2015 · Marisol Ruiz. Is this the same child?');
    assert.equal(sameChildDetail(jonah, true), '#9 · born Jan 14, 2015. Same child?');
    assert.equal(sameChildYes(jonah), 'Yes, it’s Jonah');
    assert.equal(sameChildFoot(jonah), 'Is this Jonah Ruiz from the 2026 Season? Answer above.');
    assert.equal(pasteNeedsAnswer(1), '1 player needs an answer: same child or new?');
    assert.equal(pasteNeedsAnswer(3), '3 players need an answer: same child or new?');
  });
  it('the refusal, the caption and the join refusal', () => {
    assert.equal(acceptRefusalBody('Ella'), 'Accepting would add Ella twice. Open Ella’s roster entry instead.');
    assert.equal(acceptRefusalOpen('Chris'), 'Open Chris’ entry');
    assert.equal(backFromCaption('2025 Season'), 'Back from the 2025 Season');
    assert.equal(joinSameSeasonRefusal('Hawks', '2027 Season'), 'Both are on the Hawks 2027 Season roster. Remove the extra entry first, then join them.');
  });
});
