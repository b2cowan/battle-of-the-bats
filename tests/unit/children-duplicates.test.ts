import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  childPairReason, childProposalHolding, defaultChildKeeper, proposeChildDuplicates, sharedTeamSeason,
  type ChildRecordIn,
} from '../../lib/children-duplicates.ts';
import { reachedEntry, reachesLive, type ChildTeamEntry } from '../../lib/family-link-reach.ts';
import { CHILD_JOIN_WORDS as W, CHILD_SPLIT_WORDS as SW } from '../../lib/child-join-words.ts';
import { between, readCode, readSource } from './_source-code.ts';

/**
 * CLUB TIER STAGE 14 S6 — joining records, splitting them, and the parent link on the child (Ask 11 + Ask 13; owner "go with
 * your recommendations" 2026-11-05). The database half (the join, the split, the link's index and cap) is proved by
 * tests/sql/child-join-split-fixture.sql on dev; this file pins the rule that PROPOSES a join, what a link reaches, and the
 * app's side of both.
 */
const kid = (o: Partial<ChildRecordIn> & { id: string }): ChildRecordIn => ({
  firstName: 'Maya', lastName: 'Chen', birthDate: '2015-03-08', parentEmails: ['grace@example.com'], parentLine: 'Grace Chen · grace@example.com',
  seasons: ['Lynx 11U AAA, 2026 Season'], detailLine: null, teamSeasons: [], seasonCount: 1, ...o,
});

describe('which children are proposed as one', () => {
  it('the same first and last name and birth date, with the same parent, is the surest question', () => {
    const out = proposeChildDuplicates({ children: [kid({ id: 'a' }), kid({ id: 'b', seasons: ['House league, Summer 2025'] })], rejected: new Set() });
    assert.equal(out.length, 1);
    assert.equal(out[0].reason, 'same_parent');
    assert.equal(W.reason(out[0].reason), 'Same name, same birth date and the same parent');
  });

  it('the same name and birth date with a different parent email is still asked (a parent changed address)', () => {
    const out = proposeChildDuplicates({ children: [kid({ id: 'a' }), kid({ id: 'b', parentEmails: ['nina@example.com'] })], rejected: new Set() });
    assert.equal(out[0].reason, 'different_parent');
    assert.equal(W.reason('different_parent'), 'Same name and birth date, different parent email');
  });

  it('a birth date missing on exactly one side needs the same parent email; missing on both never matches', () => {
    assert.equal(childPairReason(kid({ id: 'a' }), kid({ id: 'b', birthDate: null })), 'missing_birth_date');
    assert.equal(childPairReason(kid({ id: 'a' }), kid({ id: 'b', birthDate: null, parentEmails: ['other@example.com'] })), null);
    assert.equal(childPairReason(kid({ id: 'a', birthDate: null }), kid({ id: 'b', birthDate: null })), null);
  });

  it('never a different birth date, and never a different first name (twins)', () => {
    assert.equal(childPairReason(kid({ id: 'a' }), kid({ id: 'b', birthDate: '2014-03-08' })), null);
    assert.equal(childPairReason(kid({ id: 'a' }), kid({ id: 'b', firstName: 'Mila' })), null);
    assert.equal(childPairReason(kid({ id: 'a' }), kid({ id: 'b', firstName: 'M.' })), null, 'an initial is not a first name here');
  });

  it('a record with no last name is never proposed; case and spacing do not matter', () => {
    assert.equal(childPairReason(kid({ id: 'a', lastName: null }), kid({ id: 'b', lastName: null })), null);
    assert.equal(childPairReason(kid({ id: 'a' }), kid({ id: 'b', firstName: ' maya ', lastName: 'CHEN' })), 'same_parent');
  });

  it('a pair someone said "no" to is never proposed again', () => {
    const out = proposeChildDuplicates({ children: [kid({ id: 'a' }), kid({ id: 'b' })], rejected: new Set(['a|b']) });
    assert.deepEqual(out, []);
  });

  it('three that match are ONE card; a group holding a "no" is shown as its matching pairs', () => {
    const three = [kid({ id: 'a' }), kid({ id: 'b' }), kid({ id: 'c' })];
    const one = proposeChildDuplicates({ children: three, rejected: new Set() });
    assert.equal(one.length, 1);
    assert.equal(one[0].sides.length, 3);
    const split = proposeChildDuplicates({ children: three, rejected: new Set(['a|c']) });
    assert.equal(split.every(p => p.sides.length === 2), true);
    assert.equal(split.some(p => p.sides.map(s => s.childId).sort().join() === 'a,c'), false, 'the rejected pair is not asked');
  });

  it('the default keeper is the record with the most seasons, then one with a birth date, then the id', () => {
    assert.equal(defaultChildKeeper([kid({ id: 'a', seasonCount: 1 }), kid({ id: 'b', seasonCount: 3 })]), 'b');
    assert.equal(defaultChildKeeper([kid({ id: 'a', birthDate: null }), kid({ id: 'b' })]), 'b');
    assert.equal(defaultChildKeeper([kid({ id: 'b' }), kid({ id: 'a' })]), 'a');
    const p = proposeChildDuplicates({ children: [kid({ id: 'a' }), kid({ id: 'b', seasonCount: 3 })], rejected: new Set() })[0];
    assert.equal(p.keep, 'b');
    assert.equal(p.sides[0].childId, 'b', 'the keeper reads first');
    assert.equal(p.seasonCount, 4);
  });
});

describe('two records on one team in one season', () => {
  const lynx = { key: 't1|y2027', label: 'Lynx 12U AAA 2027 Season' };
  it('are still proposed, but the card says the join waits, in the drawn words', () => {
    const out = proposeChildDuplicates({ children: [kid({ id: 'a', teamSeasons: [lynx] }), kid({ id: 'b', teamSeasons: [lynx] })], rejected: new Set() });
    assert.equal(out[0].blockedBy, 'Lynx 12U AAA 2027 Season');
    assert.equal(W.blocked(out[0].blockedBy!), 'Both are on the Lynx 12U AAA 2027 Season roster. Remove the extra entry first, then join them.');
  });
  it('records on different seasons or teams are not blocked', () => {
    assert.equal(sharedTeamSeason(kid({ id: 'a', teamSeasons: [lynx] }), kid({ id: 'b', teamSeasons: [{ key: 't2|y2027', label: 'x' }] })), null);
  });
});

describe('a record with no birth date cannot bridge two children whose dates disagree (review 2026-11-05)', () => {
  const a = kid({ id: 'a', birthDate: '2015-03-08' });
  const b = kid({ id: 'b', birthDate: null });
  const c = kid({ id: 'c', birthDate: '2016-05-09' });
  it('A~B and B~C are two questions, never one card that would join the 2015 and 2016 children', () => {
    const out = proposeChildDuplicates({ children: [a, b, c], rejected: new Set() });
    assert.equal(out.length, 2);
    assert.ok(out.every(p => p.sides.length === 2 && p.sides.some(s => s.childId === 'b')));
    assert.equal(childProposalHolding(out, ['a', 'b', 'c']), null);
  });
  it('two dated records that agree still make one card of three', () => {
    const out = proposeChildDuplicates({ children: [a, b, kid({ id: 'd', birthDate: '2015-03-08' })], rejected: new Set() });
    assert.equal(out.length, 1);
    assert.equal(out[0].sides.length, 3);
  });
});

describe('a finished season is not "Not connected" (review 2026-11-05)', () => {
  it('the family team page keeps a parent whose child season closed, and serves the schedule on the live link only', () => {
    const page = readCode('app/(consumer)/family/teams/[teamId]/page.tsx');
    assert.match(page, /getVerifiedLinkForUserTeam\(user\.id, teamId, 'recap'\)/);
    assert.match(page, /const link = liveLink \?\? recapLink/);
    assert.match(page, /enabled && liveLink \? await getFamilyTeamView/);
  });
  it('a closed season\'s calendar token is an empty feed, not a refusal that counts against the shared abuse ceiling', () => {
    assert.match(readCode('lib/family-access.ts'), /reaches: !!reached/);
    assert.match(readCode('app/api/family/calendar/[token]/route.ts'), /org && link\.reaches \? await getFamilyTeamView/);
  });
});

describe('a standing proposal is the whole card, never a subset', () => {
  const ps = proposeChildDuplicates({ children: [kid({ id: 'a' }), kid({ id: 'b' }), kid({ id: 'c' })], rejected: new Set() });
  it('all three together hold; two of them do not; a repeated id does not', () => {
    assert.ok(childProposalHolding(ps, ['a', 'b', 'c']));
    assert.equal(childProposalHolding(ps, ['a', 'b']), null);
    assert.equal(childProposalHolding(ps, ['a', 'a', 'b']), null);
    assert.equal(childProposalHolding(ps, ['a']), null);
  });
});

describe('what a parent link reaches follows the child\'s live seasons', () => {
  const e = (id: string, status: string, year: number, created = `${year}-01-01`): ChildTeamEntry => ({ id, seasonStatus: status, seasonYear: year, seasonCreatedAt: created });
  it('a link survives a roll: the live entry is the new season\'s, the old one is closed', () => {
    const entries = [e('e26', 'completed', 2026), e('e27', 'active', 2027)];
    assert.equal(reachedEntry(entries, 'live')?.id, 'e27');
    assert.equal(reachesLive(entries), true);
  });
  it('and stops reaching a team whose seasons are all closed', () => {
    assert.equal(reachedEntry([e('e26', 'completed', 2026)], 'live'), null);
    assert.equal(reachedEntry([e('e26', 'archived', 2026)], 'live'), null);
    assert.equal(reachesLive([e('e26', 'completed', 2026)]), false);
  });
  it('a child with no entry on the team reaches nothing', () => {
    assert.equal(reachedEntry([], 'live'), null);
    assert.equal(reachedEntry([], 'recap'), null);
  });
  it('the recap follows the newest CLOSED season, and says "not yet" while only a live one exists', () => {
    const rolled = [e('e25', 'completed', 2025), e('e26', 'completed', 2026), e('e27', 'active', 2027)];
    assert.equal(reachedEntry(rolled, 'recap')?.id, 'e26');
    assert.equal(reachedEntry([e('e27', 'active', 2027)], 'recap')?.id, 'e27');
    assert.equal(reachedEntry([e('e26', 'completed', 2026)], 'recap')?.id, 'e26', 'the recap is the one door that outlives the season');
  });
  it('a draft season is live, like everywhere else', () => {
    assert.equal(reachedEntry([e('d', 'draft', 2028)], 'live')?.id, 'd');
  });
});

describe('the migration', () => {
  const sql = readSource('supabase/migrations/445_a_parent_is_connected_to_the_child.sql');
  it('puts the link on the child, keeps the entry it was made on, and fills the child for a writer that sends only the entry', () => {
    assert.match(sql, /add column if not exists child_id uuid/);
    assert.match(sql, /alter column child_id set not null/);
    assert.match(sql, /deferrable initially deferred/);
    assert.match(sql, /create trigger family_links_a_child_fills/);
    assert.doesNotMatch(sql, /drop column\s+player_id/i, 'player_id stays: the entry the link was made on');
  });
  it('the child fill fires before the guardian cap (trigger names fire in order)', () => {
    assert.ok('family_links_a_child_fills' < 'family_links_guardian_cap');
  });
  it('the live-unique rule is per child, team and address, so a sibling or a roll is not refused', () => {
    assert.match(sql, /drop index if exists public\.family_links_live_uniq/);
    assert.match(sql, /family_links_live_child_uniq\s+on public\.family_links \(child_id, rep_team_id, invited_email, role\)/);
  });
  it('the join keeps its 2-argument callers working through a default, and moves the links before it deletes the child', () => {
    assert.match(sql, /p_keep_identity boolean default false/);
    const join = between(sql, 'create or replace function public.org_children_join', 'revoke all on function public.org_children_join');
    assert.ok(join.indexOf('update public.family_links set child_id = p_keep') < join.indexOf('delete from public.org_children where id = p_absorb'));
    assert.match(join, /if not p_keep_identity then/);
  });
  it('the split deletes nothing', () => {
    const split = between(sql, 'create or replace function public.org_children_split', 'revoke all on function public.org_children_split');
    assert.doesNotMatch(split, /\bdelete\s+from\b/i);
    assert.match(split, /'split'/);
  });
});

describe('the routes and screens', () => {
  const route = readCode('app/api/admin/families/duplicates/children/route.ts');
  it('the join runs only what the rule proposes NOW, behind the Families gate, and audits', () => {
    assert.match(route, /requireFamiliesAccess/);
    assert.match(route, /childProposalHolding\(await buildChildProposals\(ctx\.org\.id, \{ detail: false \}\), asked\)/);
    assert.match(route, /code: 'not_proposed' \}, \{ status: 409/);
    assert.ok(route.indexOf('childProposalHolding') < route.indexOf('joinChildren('), 'the proposal is checked before anything joins');
    assert.match(route, /'families_children_joined'/);
    assert.match(route, /'families_children_not_same'/);
  });
  it('a join keeps the reviewer\'s record\'s identity and is refused on one team and season before the database is asked', () => {
    const read = readCode('lib/children-duplicates-read.ts');
    assert.match(read, /p_keep_identity: true/);
    assert.match(read, /if \(blockedBy\) return \{ ok: false, status: 409/);
    assert.match(read, /rep_roster_players_one_child_per_season/);
  });
  it('split sits behind the Families gate, takes the page\'s own season keys, and audits ids only', () => {
    const split = readCode('app/api/admin/families/children/[childId]/split/route.ts');
    assert.match(split, /requireFamiliesAccess/);
    assert.match(split, /seasonKeys/);
    assert.match(split, /'families_child_split'/);
    assert.doesNotMatch(split, /firstName|dateOfBirth|name:/);
  });
  it('the tab wears the sum of both queues, and the Children half is a switch on the same tab', () => {
    // One definition of the sum (the provider's), worn by both the rail row and this tab.
    assert.match(readCode('components/admin/kit/club/ClubBriefProvider.tsx'), /familyDuplicates \?\? 0\) \+ \(brief\?\.counts\.familyChildDuplicates \?\? 0/);
    assert.match(readCode('components/admin/kit/club/ClubBriefProvider.tsx'), /programKey === 'families'\) return familyDuplicatesTotal\(brief\)/);
    assert.match(readCode('components/admin/kit/club/families/FamiliesFrame.tsx'), /familyDuplicatesTotal\(brief\)/);
    assert.match(readCode('components/admin/kit/club/families/DuplicatesHub.tsx'), /ViewSwitch/);
    assert.match(readCode('app/api/admin/club-brief/route.ts'), /counts\.familyChildDuplicates = \(await buildChildProposals/);
  });
  it('the words are the drawn ones', () => {
    assert.equal(W.confirmTitle('Maya Chen'), 'Join Maya Chen’s records?');
    assert.equal(W.confirmBody('Maya', 3), 'Maya becomes one child with 3 seasons. Nothing in any season changes. You can split them again from Maya’s page.');
    assert.equal(W.join, 'Join as one child');
    assert.equal(W.notSame, 'Not the same child');
    assert.match(W.consequence('Maya Chen', '2015-03-08', 3, true), /^Joining keeps Maya Chen, born Mar 8, 2015, as one child with all 3 seasons\./);
    assert.match(W.consequence('Owen Patel', '2014-06-19', 2, false), /Both parents stay on the one child/);
    assert.equal(SW.open, 'Split records');
  });
  it('a parent link is read through the child everywhere it used to be read through the entry', () => {
    assert.match(readCode('lib/family-notify.ts'), /reachingLinks\(/);
    assert.match(readCode('lib/family-engagement.ts'), /\.in\('child_id', childIds\)/);
    assert.doesNotMatch(readCode('lib/families-read.ts'), /linksByPlayer/);
    assert.match(readCode('lib/child-page.ts'), /\.eq\('child_id', childId\)/);
    assert.match(readCode('app/(consumer)/family/teams/[teamId]/recap/page.tsx'), /getVerifiedLinkForUserTeam\(user\.id, teamId, 'recap'\)/);
  });
});
