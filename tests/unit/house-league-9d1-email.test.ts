/**
 * A HOUSE-LEAGUE SEASON EMAILS ITS FAMILIES (Club Tier Stage 9d-1 — owner 9d1·1–12 and the build session's ruling,
 * 2026-10-26; build prompt docs/projects/active/HOUSE_LEAGUE_STAGE9D1_BUILD_PROMPT.md, Part 2).
 *
 * The season's audiences are pure (lib/families-audience.ts), so their rules are proved here: siblings once, a
 * two-guardian household once, an ended child never in a team's audience, a finished season reachable, "everyone" =
 * an ACTIVE child from either door. The rest is held by shape: the season's door is the season's email right and never
 * the Families grant, every picked id is tied to the season, a team of an unpublished division is refused before any
 * claim, a season's email counts toward the season's own three, one household goes through the household door (never
 * counted), and the words never say "today" or "sends".
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readCode, functionBody } from './_source-code.ts';
import {
  audienceChildren, familyAudience, isSeasonDoorScope, parseScope, scopeSeasonId, seasonChoices,
  type AudiencePerson, type SeasonRow,
} from '../../lib/families-audience.ts';
import { houseLeagueAccess } from '../../lib/house-league-access.ts';
import type { EntitlementOrg } from '../../lib/module-entitlements.ts';
import { ALLOWANCE_WORDS, SEASON_EMAIL_WORDS as SW, familiesNamed, seasonEmailReason } from '../../lib/families-words.ts';

const S = 's1';
let n = 0;
const row = (o: Partial<SeasonRow> = {}): SeasonRow => ({
  regId: `r${++n}`, seasonId: S, seasonName: 'Dev House League 2026', seasonStatus: 'active', status: 'active',
  divisionId: 'dA', teamId: 'tCardinals', childFirst: 'Kid', childLast: 'Kim', guardianLast: 'Kim', ...o,
});
const person = (id: string, o: Partial<AudiencePerson> = {}): AudiencePerson =>
  ({ personId: id, email: `${id}@x.test`, lists: [], roster: [], league: [], coGuardians: [], seasonRows: [], ...o });
const NONE = new Set<string>();
const audience = (people: AudiencePerson[], scope: Parameters<typeof familyAudience>[1], suppressed = NONE, sender: string | null = null) =>
  familyAudience(people, scope, suppressed, sender);

describe('9d-1 · a season’s audiences (pure)', () => {
  it('siblings are one family: one email, two children', () => {
    const kim = person('kim', { seasonRows: [row({ childFirst: 'Ava' }), row({ childFirst: 'Henry' })] });
    const a = audience([kim, person('chen', { seasonRows: [row({ guardianLast: 'Chen', childLast: 'Chen' })] })], { kind: 'season', seasonId: S });
    assert.equal(a.families.length, 2);
    assert.equal(audienceChildren(a), 3);
    const kims = a.families.find(f => f.familyName === 'Kim')!;
    assert.deepEqual(kims.children.map(c => c.first), ['Ava', 'Henry']);
    assert.deepEqual(kims.addresses, ['kim@x.test']);
  });

  it('a two-guardian household is one family, emailed at both addresses', () => {
    const a = audience([
      person('mom', { seasonRows: [row()], coGuardians: ['dad'] }),
      person('dad'),
    ], { kind: 'season', seasonId: S });
    assert.equal(a.families.length, 1);
    assert.deepEqual(a.families[0].addresses, ['dad@x.test', 'mom@x.test']);
    assert.deepEqual(a.families[0].personIds, ['dad', 'mom']);
  });

  it('a team reaches only ACTIVE children on it: an ended or waitlisted child of that team is not in it', () => {
    const people = [
      person('a', { seasonRows: [row({ teamId: 'tJays' })] }),
      person('b', { seasonRows: [row({ teamId: 'tJays', status: 'declined' })] }),
      person('c', { seasonRows: [row({ teamId: 'tJays', status: 'withdrawn' })] }),
      person('d', { seasonRows: [row({ teamId: 'tCardinals' })] }),
    ];
    const a = audience(people, { kind: 'season_teams', seasonId: S, teamIds: ['tJays'] });
    assert.deepEqual(a.families.map(f => f.addresses[0]), ['a@x.test']);
  });

  it('a division reaches its active children; statuses reach their tabs (Ended = declined + withdrawn)', () => {
    const people = [
      person('a', { seasonRows: [row({ divisionId: 'dA' })] }),
      person('b', { seasonRows: [row({ divisionId: 'dB' })] }),
      person('c', { seasonRows: [row({ status: 'declined' })] }),
      person('d', { seasonRows: [row({ status: 'withdrawn' })] }),
      person('e', { seasonRows: [row({ status: 'pending_review' })] }),
      person('f', { seasonRows: [row({ status: 'waitlisted' })] }),
    ];
    assert.deepEqual(audience(people, { kind: 'season_divisions', seasonId: S, divisionIds: ['dA'] }).families.map(f => f.addresses[0]), ['a@x.test']);
    assert.deepEqual(audience(people, { kind: 'season_statuses', seasonId: S, statuses: ['ended'] }).families.map(f => f.addresses[0]), ['c@x.test', 'd@x.test']);
    assert.deepEqual(audience(people, { kind: 'season_statuses', seasonId: S, statuses: ['review', 'waitlist'] }).families.map(f => f.addresses[0]), ['e@x.test', 'f@x.test']);
  });

  it('ticked registrations reach their families in any status; two ticked children of one family are ONE family', () => {
    const ava = row({ childFirst: 'Ava' }), henry = row({ childFirst: 'Henry' }), ended = row({ status: 'withdrawn', guardianLast: 'Rossi' });
    const people = [person('kim', { seasonRows: [ava, henry] }), person('rossi', { seasonRows: [ended] })];
    assert.equal(audience(people, { kind: 'season_families', seasonId: S, registrationIds: [ava.regId, henry.regId] }).families.length, 1);
    assert.equal(audience(people, { kind: 'season_families', seasonId: S, registrationIds: [ended.regId] }).families.length, 1);
  });

  it('a finished season is reachable: everyone = the children active when it finished', () => {
    const a = audience([person('a', { seasonRows: [row({ seasonStatus: 'completed' })] })], { kind: 'season', seasonId: S });
    assert.equal(a.families.length, 1);
  });

  it('another season’s families are never in it, and the sender never is', () => {
    const people = [person('a', { seasonRows: [row()] }), person('b', { seasonRows: [row({ seasonId: 's2' })] }), person('me', { seasonRows: [row()] })];
    const a = audience(people, { kind: 'season', seasonId: S }, NONE, 'me@x.test');
    assert.deepEqual(a.families.map(f => f.addresses[0]), ['a@x.test']);
    assert.equal(a.senderSkipped, true);
  });

  it('an opted-out family is counted, never sent to, and can be named', () => {
    const a = audience([person('a', { seasonRows: [row({ guardianLast: 'Dubois' })] }), person('b', { seasonRows: [row()] })],
      { kind: 'season', seasonId: S }, new Set(['a@x.test']));
    assert.equal(a.families.length, 1);
    assert.equal(a.optedOut, 1);
    assert.equal(familiesNamed(a.optedOutFamilies.map(f => f.familyName)), 'the Dubois family');
    assert.equal(familiesNamed(['Rossi', 'Nguyen']), 'the Rossi and Nguyen families');
    assert.equal(familiesNamed(['A', 'B', 'C', 'D']), null, 'four or more are counted, never named');
  });

  it('the Who list leaves out a choice with no family, and offers only the teams it is given (the published ones)', () => {
    const people = [person('a', { seasonRows: [row({ teamId: 'tJays', divisionId: 'dA' })] }), person('b', { seasonRows: [row({ status: 'waitlisted', teamId: null })] })];
    const c = seasonChoices(people, NONE, null, S,
      [{ id: 'dA', name: 'Division A' }, { id: 'dB', name: 'Division B' }],
      [{ id: 'tJays', name: 'Jays', divisionId: 'dA' }, { id: 'tEmpty', name: 'Empty', divisionId: 'dA' }]);
    assert.deepEqual(c.everyone, { families: 1, children: 1 });
    assert.deepEqual(c.divisions.map(d => d.name), ['Division A']);
    assert.deepEqual(c.teams.map(t => t.name), ['Jays']);
    assert.deepEqual(c.statuses.map(s => s.key), ['active', 'waitlist']);
  });

  it('a scope reads only known statuses, names its season (the allowance’s bucket), and the season-only kinds are marked', () => {
    assert.equal(parseScope({ kind: 'season_statuses', seasonId: S, statuses: 'active,bogus' }), null);
    const s = parseScope({ kind: 'season_teams', seasonId: S, teamIds: 'not-a-uuid' })!;
    assert.deepEqual(s, { kind: 'season_teams', seasonId: S, teamIds: [] });
    assert.equal(scopeSeasonId({ kind: 'season', seasonId: S }), S);
    assert.equal(scopeSeasonId({ kind: 'every' }), null);
    assert.equal(isSeasonDoorScope({ kind: 'season', seasonId: S }), false, 'Families may pick a whole season');
    assert.equal(isSeasonDoorScope(s), true);
  });
});

describe('9d-1 · who may email a season (9d1·2)', () => {
  const CLUB: EntitlementOrg = { planId: 'club', subscriptionStatus: 'active', enabledAddons: [], freeFloor: null };
  it('the registrar emails a season without the Families grant, on every status', () => {
    for (const status of ['draft', 'registration_open', 'active', 'completed', 'archived']) {
      assert.equal(houseLeagueAccess({ role: 'league_registrar', capabilities: { module_families: false } }, CLUB, { status }).email, true, status);
    }
  });
  it('the treasurer and a coach never do', () => {
    assert.equal(houseLeagueAccess({ role: 'treasurer', capabilities: null }, CLUB, { status: 'active' }).email, false);
    assert.equal(houseLeagueAccess({ role: 'coach', capabilities: null }, CLUB, { status: 'active' }).email, false);
  });
});

describe('9d-1 · the season’s door (shape)', () => {
  const route = readCode('app/api/admin/house-league/seasons/[seasonId]/emails/route.ts');
  const lib = readCode('lib/house-league-email.ts');
  const engine = readCode('lib/families-email.ts');

  it('is gated by the season’s email right, never the Families grant', () => {
    assert.match(route, /houseLeagueRefusal\(ctx, 'email'\)/);
    assert.match(route, /houseLeagueRefusal\(ctx, 'email', season\)/);
    for (const src of [route, lib]) assert.doesNotMatch(src, /requireFamiliesAccess|module_families/);
  });

  it('ties every picked id to the season', () => {
    const tie = functionBody(route, 'scopeInSeason');
    assert.match(tie, /divisionInSeason\(seasonId, divisionId\)/);
    assert.match(tie, /teamsInSeason\(seasonId, scope\.teamIds\)/);
    assert.match(tie, /registrationsInSeason\(seasonId, scope\.registrationIds\)/);
  });

  it('refuses a team of an unpublished division before anything is claimed', () => {
    const send = functionBody(lib, 'sendSeasonEmail');
    const unpublished = send.indexOf("'unpublished'");
    assert.ok(unpublished > 0 && unpublished < send.indexOf('deliverFamilyEmail('), 'the published check runs before the send');
  });

  it('sends only through the club’s one engine: one household through the household door, never counted', () => {
    assert.doesNotMatch(lib, /\bsendFamilyEmail(?:Batch)?\s*\(|\bsendEmail\s*\(|family_email_claim|league_email_log/);
    const send = functionBody(lib, 'sendSeasonEmail');
    assert.ok(send.indexOf('messageOneFamily(') > 0 && send.indexOf('messageOneFamily(') < send.indexOf('deliverFamilyEmail('));
    assert.doesNotMatch(functionBody(engine, 'messageOneFamily'), /family_email_claim/, 'a one-family message never takes a season’s slot');
  });

  it('a season’s email counts toward the season’s own three, and its footer names the season (9d1·6, 9d1·11)', () => {
    const deliver = functionBody(engine, 'deliverFamilyEmail');
    assert.match(deliver, /p_season_id: scopeSeasonId\(scope\)/);
    assert.match(deliver, /reason: reasonFor\(d\.seasonName\)/);
    assert.equal(seasonEmailReason('Dev House League 2026'), 'your family is registered in Dev House League 2026');
  });

  it('records each family before the first batch, and resends only a stopped email’s missed families', () => {
    const deliver = functionBody(engine, 'deliverFamilyEmail');
    assert.ok(deliver.indexOf("from('family_email_recipients').insert") < deliver.indexOf('sendFamilyEmailBatch('));
    const resend = functionBody(engine, 'resendMissedFamilies');
    assert.match(resend, /\.eq\('status', 'sending'\)\.lt\('sent_at', cutoff\)/);
    assert.match(resend, /\.in\('status', \['pending', 'failed'\]\)/);
    assert.doesNotMatch(resend, /family_email_claim/, 'a resend is never a new claim');
  });

  it('the Families door never takes a season’s divisions, teams or statuses (9d1·6)', () => {
    assert.match(readCode('app/api/admin/families/email/route.ts'), /isSeasonDoorScope\(scope\)/);
    assert.match(functionBody(engine, 'sendFamilyEmailToClub'), /isSeasonDoorScope\(scope\)/);
  });
});

describe('9d-1 · the words (9d1·12: any 24 hours; "emails", never "sends")', () => {
  const said = [
    ALLOWANCE_WORDS.foot({ kind: 'season', name: 'Draft Test 2027', here: false }, 0),
    ALLOWANCE_WORDS.foot({ kind: 'season', name: 'x', here: true }, 2),
    ALLOWANCE_WORDS.foot({ kind: 'club' }, 1),
    ALLOWANCE_WORDS.subtitle(0, null), ALLOWANCE_WORDS.subtitle(1, null), ALLOWANCE_WORDS.subtitle(3, null),
    SW.capReason('Dev House League 2026', null), SW.capReasonPhone(null), SW.sentNoneDelivered, SW.resendNote('season'),
    SW.stoppedNote(1), SW.oneTo('a@x.test'), SW.oneCap('Kim', null),
  ];
  it('never "today" for the allowance', () => {
    for (const s of said) assert.doesNotMatch(s, /\btoday\b/i, s);
  });
  it('never "sends" as a noun', () => {
    // "send" the verb is fine ("can send 3 emails"); the noun is not ("3 sends", "this send", "the send").
    for (const s of [...said, SW.everyoneSub, SW.statusSub, SW.copyCoachesSub, SW.openEmail]) {
      assert.doesNotMatch(s, /\b\d+ sends\b|\b(this|the|a) send\b|\bsends a day\b/i, s);
    }
  });
  it('the allowance counts what was sent', () => {
    assert.equal(ALLOWANCE_WORDS.foot({ kind: 'season', name: 'x', here: true }, 1), 'This season has sent 1 of its 3 emails in the last 24 hours.');
    assert.equal(ALLOWANCE_WORDS.foot({ kind: 'club' }, 0), 'The club can send 3 emails in any 24 hours.');
  });
});
