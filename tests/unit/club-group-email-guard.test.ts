/**
 * CLUB COMMUNICATIONS STAGE 1 — THE BUILD GUARD for the club's email to its coaches and its board, and the engine's rules.
 *
 * The legal spec is docs/agents/legal/CLUB_COMMUNICATIONS_STAGE1.md: "Build-prompt checklist 2026-11-16" §2e (tests T1–T26)
 * and "Addendum 2026-11-17" (both reply modes; T27, T28). Session 1 owns T1–T8, T10, T13–T21, T24–T26 (+ T27/T28's engine
 * half); T9, T11, T12, T22, T23 land with the screens and gates of Sessions 2 and 3.
 *
 * ⚠ A failure here is a legal regression, not a flaky test: the pinned lines (From, sender, reply, reason, removal, foot) are
 * what make this colleague mail rather than a commercial message, and the read rules are what keep board mail and names
 * where the owner ruled they go. Change a pinned line only through /legal.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { readCode } from './_source-code.ts';
import {
  BOARD_SEATS, INBOX_COPY, MAIL, NAMELESS, SAY, WINDOW, reasonLine, renderColleagueEmail, renderInboxCopy,
  type ColleagueBasis, type ReplyMode,
} from '../../lib/club-group-email-words.ts';
import {
  canFinish, canReadSend, chooseBoard, chooseCoaches, cleanName, coachBasis, displayName, groupKey, namesColleagueAudience,
  namesPending, parseColleagueGroup, recount, replyTarget, seatOf, seatSeesEveryMissed, shapeRecipients, unionCoaches,
  type BoardMember, type LeagueRow, type RepRow, type Seat, type SeatFacts, type StoredRecipient,
} from '../../lib/club-group-email-rules.ts';
import { familySenderName } from '../../lib/email-club-identity.ts';
import { PLAN_CONFIG } from '../../lib/plan-config.ts';

const REPO = join(import.meta.dirname, '..', '..');
const read = (rel: string) => readFileSync(join(REPO, rel), 'utf8');

const CLUB = 'Harbourtown Minor Ball';
const SENDER = { name: 'Morgan Ellis', role: 'owner' as const };
const BODY = 'The coaches meeting is Thursday at 7:30 p.m. in the clubhouse.';
const unesc = (s: string) => s.replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');

/** Every colleague kind the guard samples (legal §2a.7): rep staff, house league, picked, and the board × each seat. */
const KINDS: { label: string; basis: ColleagueBasis; boardRole: string | null }[] = [
  { label: 'rep staff', basis: 'rep_staff', boardRole: null },
  { label: 'house league', basis: 'house_league', boardRole: null },
  { label: 'picked', basis: 'picked', boardRole: null },
  ...BOARD_SEATS.map(r => ({ label: `board as ${r}`, basis: 'board' as const, boardRole: r })),
];
const MODES: ReplyMode[] = ['club', 'sender'];

const LINK = /<a[\s>]|href=|https?:|www\.|mailto:/i;
const COMMERCIAL = [/\bpricing\b/i, /\bprice\b/i, /per month/i, /free trial/i, /\btrial\b/i, /sign[ -]up/i, /\bsubscribe\b/i,
  /\bupgrade\b/i, /\bdiscount\b/i, /\boffer\b/i, /\bbuy\b/i, /try FieldLogicHQ/i, /your own club/i, /learn more/i, /get started/i, /\$/];
const PLAN_NAMES = Object.values(PLAN_CONFIG).map(p => p.label);
const FAMILY_ENVELOPE = [/Stop these emails/i, /unsubscribe/i, /opted out of club email/i];

/** What the PRODUCT adds: the rendered email minus the sender's own body and the club's own name (neither is scanned). */
const productWords = (html: string) => unesc(html).split(BODY).join('').split(CLUB).join('{ORG}');

describe('T1 · every colleague kind, both reply modes: no link, nothing commercial, the pinned lines', () => {
  for (const k of KINDS) for (const mode of MODES) {
    it(`${k.label} · replies to ${mode}`, () => {
      const m = renderColleagueEmail({ club: CLUB, mode, sender: SENDER, subject: 'Coaches meeting', body: BODY,
        recipient: { firstName: 'Pat', basis: k.basis, boardRole: k.boardRole } });
      const words = productWords(m.html);
      assert.doesNotMatch(m.html, LINK, 'no link of ours');
      for (const w of COMMERCIAL) assert.doesNotMatch(words, w, `no commercial word ${w}`);
      for (const p of PLAN_NAMES) assert.ok(!new RegExp(`\\b${p}\\b`).test(words), `no plan name "${p}"`);
      for (const f of FAMILY_ENVELOPE) assert.doesNotMatch(unesc(m.html), f, 'never the family envelope');
      assert.equal(m.fromName, familySenderName(CLUB));
      assert.equal(m.fromName, `${CLUB} via FieldLogicHQ`);
      const text = unesc(m.html);
      assert.ok(text.includes(`Sent through FieldLogicHQ, the software ${CLUB} uses.`), 'the exact foot');
      if (mode === 'club') {
        assert.ok(text.includes(`${CLUB} sent this.`), 'the club sender line');
        assert.ok(text.includes(`Reply to this email to reach ${CLUB}.`));
        assert.ok(text.includes(`Not right for you? Reply and tell ${CLUB}.`), 'the removal line');
        assert.ok(!text.includes('Morgan'), 'T28: club mode names nobody');
      } else {
        assert.ok(text.includes(`Morgan Ellis (Owner, ${CLUB}) sent this.`), 'the sender line (C5)');
        assert.ok(text.includes('Reply to this email to reach Morgan Ellis.'));
        assert.ok(text.includes('Not right for you? Reply and tell Morgan Ellis.'), 'the removal line');
      }
      assert.ok(text.includes(BODY), 'the message is carried, unscanned');
    });
  }
  it('every word the product adds is escaped: a club name with markup cannot open a tag', () => {
    const m = renderColleagueEmail({ club: 'A <b>Club</b>', mode: 'club', sender: SENDER, subject: 's', body: '<a href="x">hi</a>',
      recipient: { firstName: null, basis: 'board', boardRole: 'admin' } });
    assert.doesNotMatch(m.html, /<a\s|<b>/);
  });
});

describe('T2 · the words file carries nothing commercial and no plan name', () => {
  const src = readCode('lib/club-group-email-words.ts');
  const strings = [...src.matchAll(/(['"`])((?:\\.|(?!\1).)*)\1/g)].map(m => m[2]).join('\n');
  for (const w of COMMERCIAL.filter(w => String(w) !== String(/\$/))) {
    it(`no ${w}`, () => assert.doesNotMatch(strings, w));
  }
  it('no plan name', () => { for (const p of PLAN_NAMES) assert.ok(!new RegExp(`\\b${p}\\b`).test(strings.replace(/\$\{[^}]*\}/g, '')), p); });
  it('never "notice", "formal notice" or "directors" for the board', () => {
    assert.doesNotMatch(strings, /\bnotice\b|\bdirectors?\b/i);
  });
});

describe('T3 · each reason line follows the recipient\'s own basis (C8)', () => {
  const rep: RepRow = { userId: 'u1', teamId: 't1', teamName: '15U AAA', word: 'Head coach', head: true, name: 'Jordan Reyes', email: 'j@x.test' };
  const lg: LeagueRow = { leagueCoachId: 'c1', userId: null, seasonId: 's1', seasonName: 'Fall', divisionId: 'd1', divisionName: 'U9', teamName: 'Reds', name: 'Pat Doucet', email: 'p@x.test' };
  it('rep staff, house league, both (staff wins), a pick', () => {
    const [both] = unionCoaches([rep], [{ ...lg, email: 'J@X.test ' }]);
    assert.equal(coachBasis(both, 'coaches_all'), 'rep_staff');
    const [only] = unionCoaches([], [lg]);
    assert.equal(coachBasis(only, 'league_season'), 'house_league');
    assert.equal(coachBasis(only, 'coaches_picked'), 'picked');
  });
  it('the board line names the recipient\'s own seat, and a role outside the board throws', () => {
    assert.equal(MAIL.reason.board(CLUB, 'treasurer'), `You get it because you're on ${CLUB}’s board in FieldLogicHQ, as a treasurer.`);
    assert.equal(MAIL.reason.board(CLUB, 'admin'), `You get it because you're on ${CLUB}’s board in FieldLogicHQ, as an admin.`);
    assert.throws(() => MAIL.reason.board(CLUB, 'coach'));
    assert.throws(() => reasonLine({ club: CLUB, mode: 'club', sender: SENDER, recipient: { firstName: null, basis: 'board', boardRole: 'staff' } }));
  });
  it('the pick names the club in club mode, the sender otherwise (legal addendum 4)', () => {
    assert.equal(MAIL.reason.picked('club', CLUB, 'Morgan Ellis'), `You get it because ${CLUB} picked you for this email.`);
    assert.equal(MAIL.reason.picked('sender', CLUB, 'Morgan Ellis'), 'You get it because Morgan Ellis picked you.');
  });
  it('the staff and house-league lines, exactly', () => {
    assert.equal(MAIL.reason.rep_staff(CLUB), `You get it because you're on ${CLUB}’s coaching staff.`);
    assert.equal(MAIL.reason.house_league(CLUB), `You get it because you coach in ${CLUB}’s house league.`);
  });
});

/** Import specifiers of a source file. */
const importsOf = (rel: string) => [...read(rel).matchAll(/^import\s+(?:type\s+)?(?:\{([^}]*)\}|[\w*\s,]+)?\s*(?:from\s+)?['"]([^'"]+)['"]/gm)].map(m => ({ names: (m[1] ?? '').split(',').map(s => s.trim().replace(/^type\s+/, '').split(/\s+as\s+/)[0]).filter(Boolean), from: m[2] }));

describe('T4 · the colleague sender never imports the family envelope', () => {
  const FILES = ['lib/club-group-email.ts', 'lib/club-group-email-words.ts', 'lib/club-group-email-rules.ts', 'lib/club-group-email-read.ts', 'lib/club-group-email-people.ts', 'lib/club-group-email-board.ts'];
  for (const f of FILES) {
    it(f, () => {
      for (const i of importsOf(f)) {
        assert.doesNotMatch(i.from, /families-email|families-words|family-email|unsubscribe|email-envelope-family/, `${f} imports ${i.from}`);
        if (i.from === './email-club-identity') {
          for (const n of i.names) assert.ok(['familySenderName', 'platformLineWords', 'usableContactEmail'].includes(n), `${f} takes ${n} from email-club-identity`);
        }
      }
      const code = readCode(f);
      assert.doesNotMatch(code, /\bclubBand\b|\bFamilyMailFace\b|\bfamilyReplyPlan\b|family_club_email|\bsendFamilyEmail/, `${f} touches the family envelope`);
    });
  }
  it('the sender sends only through the transport, with a colleague kind', () => {
    const code = readCode('lib/club-group-email.ts');
    const kinds = [...code.matchAll(/'(club_[a-z_]+_email|club_inbox_copy)'/g)].map(m => m[1]);
    assert.ok(kinds.length > 0);
    for (const k of kinds) assert.match(k, /^club_(coach_email|board_email|inbox_copy)$/);
  });
});

describe('T5 · the board builder reads organization_members only, and no families module', () => {
  it('imports', () => {
    for (const i of importsOf('lib/club-group-email-board.ts')) assert.doesNotMatch(i.from, /families-|family-|guardian|league-|player/);
  });
  it('tables', () => {
    const tables = [...readCode('lib/club-group-email-board.ts').matchAll(/\.from\('([a-z_]+)'\)/g)].map(m => m[1]);
    assert.deepEqual([...new Set(tables)], ['organization_members']);
  });
  it('active and invited only (suspended never read), the board seats only, not the two-step list', () => {
    const code = readCode('lib/club-group-email-board.ts');
    assert.match(code, /\.in\('status', \['active', 'invited'\]\)/);
    assert.match(code, /\.in\('role', \[\.\.\.BOARD_SEATS\]\)/);
    assert.doesNotMatch(code, /boardRecipients/);
  });
});

describe('T6 · the family manifest guard stays unedited and the new senders are not family mail', () => {
  it('no new file names a family recipient field', () => {
    for (const f of ['lib/club-group-email.ts', 'lib/club-group-email-read.ts', 'lib/club-group-email-board.ts']) {
      assert.doesNotMatch(read(f), /guardianEmail|guardian_email|recipientEmails|invited_email|guardianFirst/, f);
    }
  });
  it('families-email.ts still sends families only through the choke point', () => {
    assert.doesNotMatch(readCode('lib/families-email.ts'), /\bsendEmail(?:Batch)?\s*\(/);
  });
});

describe('T7 · never both paths', () => {
  it('the colleague route refuses a family audience', () => {
    for (const body of [{ kind: 'every' }, { kind: 'coaches', group: 'coaches_all', teamIds: [] }, { kind: 'board', group: 'board_all', list: 'owes' }, { kind: 'season_teams' }]) {
      const r = parseColleagueGroup(body);
      assert.equal(r.ok, false); if (!r.ok) assert.equal(r.code, 'both_paths');
    }
  });
  it('the family routes refuse a coach or board audience before anything is read', () => {
    for (const body of [{ kind: 'coaches' }, { kind: 'every', group: 'coaches_all' }, { kind: 'season', keys: [] }, { kind: 'board' }]) assert.ok(namesColleagueAudience(body));
    assert.ok(!namesColleagueAudience({ kind: 'every', subject: 's', body: 'b' }));
    for (const f of ['lib/families-email.ts', 'lib/house-league-email.ts']) {
      assert.match(readCode(f), /if \(namesColleagueAudience\(body\)\) return (?:refuse|no)\(400/, f);
    }
  });
});

describe('T8 · envelope shape: one To, no Cc or Bcc, Reply-To the chosen target', () => {
  it('the transport has no Cc or Bcc to set', () => {
    const opts = read('lib/email.ts').match(/type SendEmailOptions = \{[\s\S]*?\n\};/)?.[0] ?? '';
    assert.ok(opts.length > 0);
    assert.doesNotMatch(opts, /\b[bB]?cc\??:/);
  });
  it('every colleague message goes to one address with the reply target', () => {
    const code = readCode('lib/club-group-email.ts');
    assert.match(code, /sendEmail\(to, mail\.subject, mail\.html, \{ kind, orgId, replyTo, fromName: mail\.fromName \}\)/);
    assert.doesNotMatch(code, /\bbcc\b|\bcc:/i);
  });
});

// ── The seeded club (coach drawing tab 8): the counts are the fixture's expected values ───────────────────────────────────

const rep = (userId: string, team: string, name: string, head = true): RepRow =>
  ({ userId, teamId: `t-${team}`, teamName: team, word: head ? 'Head coach' : 'Assistant', head, name, email: `${userId}@x.test` });
const ID = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const REP: RepRow[] = [
  rep(ID(1), '11U AA', 'Marcus Bell'), rep(ID(2), '13U AAA', 'Priya Nair'), rep(ID(3), '14U AA', 'Taylor Brooks'),
  rep(ID(4), '15U AA', 'Sam Whitford'), rep(ID(5), '15U AAA', 'Jordan Reyes'), rep(ID(6), '15U AAA', 'Riley Assistant', false),
  rep(ID(7), '16U AA', 'Casey Morgan'),
];
const SEASON = ID(100), U9 = ID(101), U11 = ID(102), U7 = ID(103);
const LEAGUE: LeagueRow[] = [
  { leagueCoachId: ID(201), userId: ID(8), seasonId: SEASON, seasonName: '2026 Fall House League', divisionId: U9, divisionName: 'U9 Rookie', teamName: 'Reds', name: 'Pat Doucet', email: 'pat@x.test' },
  { leagueCoachId: ID(202), userId: null, seasonId: SEASON, seasonName: '2026 Fall House League', divisionId: U11, divisionName: 'U11 Pinto', teamName: 'Hawks', name: 'Robin Hale', email: 'robin@x.test' },
];
const LIVE = [{ id: SEASON, divisionIds: [U7, U9, U11] }];
const PEOPLE = unionCoaches(REP, LEAGUE);
const OWNER_ID = ID(900);
const facts = (role: SeatFacts['role'], over: Partial<SeatFacts> = {}): SeatFacts =>
  ({ role, switchOn: true, teamLimited: false, tournamentOnly: false, planRep: true, planLeague: true, leagueModule: true, ...over });
const OWNER = seatOf(facts('owner'));
const ADMIN = seatOf(facts('admin'));
const REGISTRAR = seatOf(facts('league_registrar'));
const LEAGUE_ADMIN = seatOf(facts('league_admin'));
const TREASURER = seatOf(facts('treasurer'));
const owner = { userId: OWNER_ID, email: 'morgan@x.test' };
const count = (g: Parameters<typeof chooseCoaches>[1], seat: Seat = OWNER) => { const r = chooseCoaches(PEOPLE, g, seat, owner, LIVE); assert.ok(r.ok); return r.people.length; };

describe('the seeded counts (coach drawing tab 8)', () => {
  it('All coaches 9 · Rep coaches 7 · head coaches only 6 · House-league coaches 2 · a division 1 · an empty division 0', () => {
    assert.equal(count({ kind: 'coaches', group: 'coaches_all' }), 9);
    assert.equal(count({ kind: 'coaches', group: 'rep_staff' }), 7);
    assert.equal(count({ kind: 'coaches', group: 'rep_head' }), 6);
    assert.equal(count({ kind: 'coaches', group: 'league_season', seasonId: SEASON }), 2);
    assert.equal(count({ kind: 'coaches', group: 'league_division', seasonId: SEASON, divisionId: U9 }), 1);
    assert.equal(count({ kind: 'coaches', group: 'league_division', seasonId: SEASON, divisionId: U7 }), 0);
  });
  it('one address is one person, however many teams they coach; the sender is never counted', () => {
    const twice = unionCoaches([...REP, { ...rep(ID(1), '16U AA', 'Marcus Bell', false) }], LEAGUE);
    assert.equal(twice.length, 9);
    const r = chooseCoaches(PEOPLE, { kind: 'coaches', group: 'rep_staff' }, OWNER, { userId: ID(5), email: null }, LIVE);
    assert.ok(r.ok); assert.equal(r.people.length, 6);
  });
  it('a house-league coach with no account is a person by their coach row; a coach with no address is left out, counted', () => {
    const robin = PEOPLE.find(p => p.name === 'Robin Hale')!;
    assert.equal(robin.key, `c:${ID(202)}`);
    const r = chooseCoaches(unionCoaches(REP, [...LEAGUE, { ...LEAGUE[1], leagueCoachId: ID(203), email: null, name: 'No Address' }]),
      { kind: 'coaches', group: 'league_season', seasonId: SEASON }, OWNER, owner, LIVE);
    assert.ok(r.ok); assert.equal(r.people.length, 2); assert.equal(r.noAddress.length, 1);
  });
});

describe('T10 · a group the seat was not offered is refused, also when posted by hand', () => {
  for (const seat of [REGISTRAR, LEAGUE_ADMIN]) {
    it(`${seat.role}: house-league coaches only`, () => {
      for (const g of [{ kind: 'coaches', group: 'coaches_all' }, { kind: 'coaches', group: 'rep_staff' }, { kind: 'coaches', group: 'rep_head' }] as const) {
        const r = chooseCoaches(PEOPLE, g, seat, owner, LIVE); assert.equal(r.ok, false);
      }
      const repKey = PEOPLE.find(p => p.name === 'Jordan Reyes')!.key;
      const pick = chooseCoaches(PEOPLE, { kind: 'coaches', group: 'coaches_picked', keys: [repKey] }, seat, owner, LIVE);
      assert.equal(pick.ok, false, 'a rep coach in a pick');
      const hl = chooseCoaches(PEOPLE, { kind: 'coaches', group: 'coaches_picked', keys: [PEOPLE.find(p => p.name === 'Pat Doucet')!.key] }, seat, owner, LIVE);
      assert.equal(hl.ok, true);
      assert.equal(count({ kind: 'coaches', group: 'league_season', seasonId: SEASON }, seat), 2);
    });
  }
  it('a season that is not live, or a division outside it, is refused', () => {
    assert.equal(chooseCoaches(PEOPLE, { kind: 'coaches', group: 'league_season', seasonId: ID(999) }, OWNER, owner, LIVE).ok, false);
    assert.equal(chooseCoaches(PEOPLE, { kind: 'coaches', group: 'league_division', seasonId: SEASON, divisionId: ID(999) }, OWNER, owner, LIVE).ok, false);
  });
  it('the seat table: who is offered what (coach ask 1, board ask 16)', () => {
    assert.deepEqual(OWNER.coaches, { rep: true, league: true }); assert.ok(OWNER.board);
    assert.deepEqual(ADMIN.coaches, { rep: true, league: true }); assert.ok(ADMIN.board);
    assert.deepEqual(REGISTRAR.coaches, { rep: false, league: true }); assert.ok(REGISTRAR.board);
    assert.equal(TREASURER.coaches, null); assert.ok(TREASURER.board);
    for (const role of ['staff', 'official', 'coach'] as const) assert.equal(seatOf(facts(role)).any, false, role);
    assert.equal(seatOf(facts('admin', { switchOn: false })).any, false, 'switch off: no group email, no place');
    assert.equal(seatOf(facts('league_admin', { teamLimited: true })).any, false, 'a member limited to some team groups');
    assert.equal(seatOf(facts('owner', { tournamentOnly: true })).any, false, 'a tournament-only plan');
    assert.equal(seatOf(facts('league_registrar', { leagueModule: false })).coaches, null, 'a registrar who does not run the house league');
    assert.deepEqual(seatOf(facts('owner', { planRep: false })).coaches, { rep: false, league: true }, 'a plan without rep teams');
    assert.equal(chooseCoaches(PEOPLE, { kind: 'coaches', group: 'coaches_all' }, seatOf(facts('owner', { planRep: false })), owner, LIVE).ok, false, 'All coaches needs both groups');
  });
  it('a treasurer is refused every coach group', () => {
    assert.equal(chooseCoaches(PEOPLE, { kind: 'coaches', group: 'league_season', seasonId: SEASON }, TREASURER, owner, LIVE).ok, false);
  });
});

const rcpt = (name: string | null, houseLeague: boolean, status: StoredRecipient['status'] = 'sent', rep = !houseLeague): StoredRecipient =>
  ({ name, line: rep ? '15U AAA · Head coach' : 'House league · Reds, U9 Rookie', basis: rep ? 'rep_staff' : 'house_league', boardRole: null, houseLeague, rep, status });

describe('/review 2026-11-17 · the fixes', () => {
  it('a coach who is ALSO rep staff is named to a league seat without their rep-team line', () => {
    const s = shapeRecipients(REGISTRAR, 'coaches', [rcpt('Dual Coach', true, 'sent', true), rcpt('Pat Doucet', true)]);
    assert.deepEqual(s.people.map(p => [p.name, p.line]), [['Dual Coach', null], ['Pat Doucet', 'House league · Reds, U9 Rookie']]);
    assert.ok(!JSON.stringify(s).includes('15U AAA'));
  });
  it('one account is one person even when its house-league row carries another typed address', () => {
    const people = unionCoaches([rep(ID(1), '11U AA', 'Marcus Bell')], [{ ...LEAGUE[1], userId: ID(1), email: 'marcus.home@x.test', name: 'Marcus Bell' }]);
    assert.equal(people.length, 1);
    assert.equal(people[0].key, `u:${ID(1)}`);
    assert.ok(people[0].aliases.includes(`c:${ID(202)}`));
  });
  it('a coach who signed in between the count and Send is the same person, not "taken off and added"', () => {
    const before = unionCoaches([], [LEAGUE[1]]);
    const after = unionCoaches([], [{ ...LEAGUE[1], userId: ID(77) }]);
    assert.notEqual(before[0].key, after[0].key);
    assert.deepEqual(recount(before.map(p => ({ key: p.key, name: p.name })), after.map(p => ({ key: p.key, name: p.name, aliases: p.aliases })), 'coaches'), { same: true });
  });
  it('a picked coach who is no longer a coach is not chosen (the recount names them); a rep coach in a league pick is still refused', () => {
    const pat = PEOPLE.find(p => p.name === 'Pat Doucet')!.key;
    const r = chooseCoaches(PEOPLE, { kind: 'coaches', group: 'coaches_picked', keys: [pat, `u:${ID(999)}`] }, OWNER, owner, LIVE);
    assert.ok(r.ok); if (r.ok) assert.deepEqual(r.people.map(p => p.name), ['Pat Doucet']);
    const rc = recount([{ key: pat, name: 'Pat Doucet' }, { key: `u:${ID(999)}`, name: 'Gone Coach' }], [{ key: pat, name: 'Pat Doucet' }], 'coaches');
    if (rc.same) assert.fail('held'); else assert.match(rc.error, /Gone Coach was taken off/);
  });
  it('a season no longer under way says so, rather than "you can no longer send this"', () => {
    const r = chooseCoaches(PEOPLE, { kind: 'coaches', group: 'league_season', seasonId: ID(999) }, OWNER, owner, LIVE);
    assert.equal(r.ok, false); if (!r.ok) assert.equal(r.code, 'not_live');
  });
  it('the people are written with the send, in one transaction', () => {
    assert.match(MIG, /INSERT INTO club_group_email_recipients \(id, send_id, org_id, user_id, league_coach_id, name, line, basis, board_role, rep, house_league\)\s*SELECT/);
    assert.match(MIG, /DROP FUNCTION IF EXISTS public\.club_group_email_claim\(uuid, uuid, text, text, text, text, jsonb, boolean, boolean, text, text, text, boolean, text, text, integer, integer\)/);
    assert.doesNotMatch(readCode('lib/club-group-email.ts'), /from\('club_group_email_recipients'\)\.insert\(/);
  });
  it('a name or a team line holding an @ is made safe before it is stored, never refusing the send', () => {
    const code = readCode('lib/club-group-email.ts');
    assert.match(code, /const storedLine = \(l: string \| null\) => \(l \? l\.replace\(\/@\/g, ' at '\)\.slice\(0, 300\)/);
  });
  it('the list never carries the sender\'s account id', () => {
    assert.match(readCode('lib/club-group-email-read.ts'), /const \{ sentBy, params: _params, \.\.\.rest \} = x;/);
  });
});

describe('T13 · a wider coach row names only a league seat\'s own coaches', () => {
  const rows = [rcpt('Pat Doucet', true), rcpt('Robin Hale', true), ...REP.map(r => rcpt(r.name, false))];
  it('the registrar sees 2 named and "7 rep coaches", and the JSON holds no rep name', () => {
    const s = shapeRecipients(REGISTRAR, 'coaches', rows);
    assert.deepEqual(s.people.map(p => p.name), ['Pat Doucet', 'Robin Hale']);
    assert.equal(s.others?.label, '7 rep coaches'); assert.equal(s.others?.sent, 7);
    const json = JSON.stringify(s);
    for (const r of REP) assert.ok(!json.includes(r.name!), r.name!);
  });
  it('an owner or admin sees every name', () => {
    assert.equal(shapeRecipients(ADMIN, 'coaches', rows).people.length, 9);
    assert.equal(shapeRecipients(ADMIN, 'coaches', rows).others, null);
  });
  it('which coach rows a league seat lists', () => {
    const row = (groupKind: string, reachesRep: boolean) => ({ kind: 'coaches' as const, groupKind, reachesRep, sentBy: OWNER_ID });
    assert.ok(canReadSend(REGISTRAR, ID(50), row('coaches_all', true), false), 'All coaches');
    assert.ok(canReadSend(REGISTRAR, ID(50), row('league_season', false), false));
    assert.ok(canReadSend(REGISTRAR, ID(50), row('coaches_picked', false), false), 'a pick only from house league');
    assert.ok(!canReadSend(REGISTRAR, ID(50), row('coaches_picked', true), false), 'a pick with a rep coach');
    assert.ok(!canReadSend(REGISTRAR, ID(50), row('rep_head', true), false), 'rep coaches');
    assert.ok(!canReadSend(TREASURER, ID(50), row('coaches_all', true), false), 'a treasurer reads no coach row');
    assert.ok(canReadSend(OWNER, ID(50), row('rep_head', true), false));
  });
});

describe('T14 · the board read rule is its own branch (C2)', () => {
  const board = { kind: 'board' as const, groupKind: 'board_picked', reachesRep: false, sentBy: OWNER_ID };
  it('a non-recipient registrar, league admin or treasurer reads nothing; the sender, a recipient, owner and admin do', () => {
    for (const s of [REGISTRAR, LEAGUE_ADMIN, TREASURER]) assert.ok(!canReadSend(s, ID(60), board, false), s.role);
    assert.ok(canReadSend(TREASURER, ID(60), board, true), 'a recipient');
    assert.ok(canReadSend(REGISTRAR, OWNER_ID, board, false), 'the sender');
    assert.ok(canReadSend(OWNER, ID(61), board, false)); assert.ok(canReadSend(ADMIN, ID(61), board, false), 'an admin added later');
  });
  it('a recipient whose switch is now off (or who is suspended: no seat at all) reads nothing', () => {
    assert.ok(!canReadSend(seatOf(facts('treasurer', { switchOn: false })), ID(60), board, true));
  });
  it('a board email is finished only by its sender, the owner or an admin', () => {
    assert.ok(canFinish(REGISTRAR, OWNER_ID, board)); assert.ok(canFinish(ADMIN, ID(1), board));
    assert.ok(!canFinish(TREASURER, ID(60), board), 'a recipient may not');
  });
  it('a stopped coach email: anyone who may send to that group now (ask 14)', () => {
    const all = { kind: 'coaches' as const, groupKind: 'coaches_all', reachesRep: true, sentBy: OWNER_ID };
    assert.ok(canFinish(ADMIN, ID(1), all)); assert.ok(!canFinish(REGISTRAR, ID(1), all));
    assert.ok(canFinish(REGISTRAR, ID(1), { ...all, groupKind: 'league_season', reachesRep: false }));
    assert.equal(SAY.finishWho('coaches', 'Morgan Ellis'), 'Morgan Ellis or an admin can send it to the ones it missed.');
  });
});

const member = (n: number, role: BoardMember['role'], name: string | null, status: BoardMember['status'] = 'active'): BoardMember =>
  ({ userId: ID(n), role, name, email: `m${n}@x.test`, status });
const BOARD: BoardMember[] = [member(900, 'owner', 'Morgan Ellis'), member(901, 'admin', 'Dana Kowalski'), member(902, 'league_admin', 'Jules Moreau'),
  member(903, 'league_registrar', 'Riley Okonkwo'), member(904, 'treasurer', null), member(905, 'admin', 'Pending Person', 'invited')];

describe('T15 · the board audience', () => {
  it('the owner writes to four: invited left out, the sender not counted, a nameless seat counted', () => {
    const r = chooseBoard(BOARD, { kind: 'board', group: 'board_all' }, OWNER, owner);
    assert.ok(r.ok); assert.equal(r.people.length, 4);
    assert.ok(!r.people.some(m => m.status === 'invited' || m.userId === OWNER_ID));
    assert.ok(r.people.some(m => m.name === null));
  });
  it('a pick reaches only active board seats: an invited member or a coach posted by hand is not chosen', () => {
    const chosen = (keys: string[]) => { const r = chooseBoard(BOARD, { kind: 'board', group: 'board_picked', keys }, OWNER, owner); assert.ok(r.ok); return r.ok ? r.people.map(m => m.userId) : []; };
    assert.deepEqual(chosen([`u:${ID(905)}`]), [], 'invited');
    assert.deepEqual(chosen([`u:${ID(1)}`]), [], 'a coach');
    assert.deepEqual(chosen([`u:${ID(901)}`, `u:${ID(904)}`]), [ID(901), ID(904)]);
  });
  it('a board of only the sender: nobody to send to', () => {
    const r = chooseBoard([BOARD[0]], { kind: 'board', group: 'board_all' }, OWNER, owner);
    assert.ok(r.ok); assert.equal(r.people.length, 0);
  });
  it('a staff seat may not email the board', () => {
    assert.equal(chooseBoard(BOARD, { kind: 'board', group: 'board_all' }, seatOf(facts('staff')), owner).ok, false);
  });
});

describe('T16 · pending is named to an owner or admin sender only', () => {
  it('', () => {
    assert.ok(namesPending(OWNER)); assert.ok(namesPending(ADMIN));
    for (const s of [REGISTRAR, LEAGUE_ADMIN, TREASURER]) assert.ok(!namesPending(s));
    assert.equal(WINDOW.invitedMembers(1), "1 invited member hasn't accepted yet and won't.");
    assert.equal(WINDOW.boardFoot(4), "4 board members get it. You aren't counted.");
  });
});

describe('T17 · no address anywhere a reader sees', () => {
  it('a name that is an address names nobody; nameless people read as their kind', () => {
    assert.equal(cleanName('pat@x.test'), null);
    const [p] = unionCoaches([], [{ ...LEAGUE[1], name: 'robin@x.test' }]);
    assert.equal(p.name, null);
    assert.equal(displayName({ name: null, boardRole: null }, 'coaches'), 'A coach');
    assert.equal(displayName({ name: null, boardRole: 'treasurer' }, 'board'), 'A board member (treasurer)');
    assert.equal(NAMELESS.boardMember('league_registrar'), 'A board member (league registrar)');
  });
  it('a record of nameless people serialises with no @', () => {
    const json = JSON.stringify(shapeRecipients(ADMIN, 'board', [{ name: null, line: 'Treasurer', basis: 'board', boardRole: 'treasurer', houseLeague: false, rep: false, status: 'sent' }]));
    assert.ok(!json.includes('@'));
  });
  it('every person a colleague response shows is built without the address', () => {
    const code = readCode('lib/club-group-email.ts');
    assert.match(code, /const shownCoach = \(p: CoachPerson\) => \(\{ key: p\.key, name: p\.name \?\? 'A coach', line: coachLine\(p\) \}\)/);
    assert.match(code, /const shownMember = \(m: BoardMember\) => \(\{ key: `u:\$\{m\.userId\}`, name: displayName/);
    const reader = readCode('lib/club-group-email-read.ts');
    for (const cols of [...reader.matchAll(/\.select\('([^']*)'/g)].map(m => m[1]).concat(reader.match(/const SEND_COLS = ([\s\S]*?);/)?.[1] ?? '')) {
      assert.doesNotMatch(cols, /\bemail\b|address/, `the reader never selects an address: ${cols}`);
    }
  });
});

const MIG = read('supabase/migrations/492_the_club_emails_its_coaches_and_board.sql');
const tableSql = (name: string) => MIG.match(new RegExp(`CREATE TABLE IF NOT EXISTS public\\.${name} \\(([\\s\\S]*?)\\n\\);`))?.[1] ?? '';

describe('T18 · no address is stored', () => {
  it('no table of the log has an address column; a name or line holding an @ is rejected', () => {
    for (const t of ['club_group_email_sends', 'club_group_email_bodies', 'club_group_email_recipients']) {
      const cols = tableSql(t);
      assert.ok(cols.length > 0, t);
      assert.doesNotMatch(cols.split('\n').map(l => l.trim().split(/\s+/)[0]).join(' '), /email|address/i, t);
    }
    assert.match(tableSql('club_group_email_recipients'), /name\s+text CHECK \(name IS NULL OR \(char_length\(name\) BETWEEN 1 AND 200 AND position\('@' in name\) = 0\)\)/);
    assert.match(tableSql('club_group_email_sends'), /position\('@' in sender_name\) = 0/);
  });
  it('the people handed to the claim carry no address field, and the claim reads none', () => {
    const handed = readCode('lib/club-group-email.ts').match(/p_recipients: people\.map\(\(p, i\) => \(\{([\s\S]*?)\}\)\),/)?.[1] ?? '';
    assert.ok(handed.length > 0);
    assert.doesNotMatch(handed, /email/);
    assert.doesNotMatch(MIG.match(/AS r\(([^)]*)\)/)?.[1] ?? 'email', /email|address/);
  });
});

describe('T19 · the body is stored apart; Send again copies the subject only', () => {
  it('the words have their own table, and the claim writes both', () => {
    assert.match(tableSql('club_group_email_bodies'), /send_id\s+uuid PRIMARY KEY REFERENCES public\.club_group_email_sends\(id\) ON DELETE CASCADE/);
    assert.doesNotMatch(tableSql('club_group_email_sends'), /\bsubject\b|\bbody\b/);
    assert.match(MIG, /INSERT INTO club_group_email_bodies \(send_id, org_id, subject, body\)/);
  });
  it('Send again returns the pick and the subject, never the message, and sends nothing', () => {
    const fn = readCode('lib/club-group-email.ts').match(/export async function againColleagueEmail[\s\S]*?\n\}/)?.[0] ?? '';
    assert.ok(fn.length > 0);
    assert.match(fn, /subject: send\.subject/);
    assert.doesNotMatch(fn, /\bbody\b|sendEmail|deliverOne/);
  });
});

describe('T20 · the recount compares the people', () => {
  const was = [{ key: 'u:a', name: 'Robin Hale' }, { key: 'u:b', name: 'Pat Doucet' }];
  it('the same people: sent', () => assert.deepEqual(recount(was, was, 'coaches'), { same: true }));
  it('a swap at the same total is held and names both', () => {
    const r = recount(was, [{ key: 'u:b', name: 'Pat Doucet' }, { key: 'u:c', name: 'Alex Tran' }], 'coaches');
    assert.equal(r.same, false);
    if (!r.same) {
      assert.match(r.error, /It still goes to 2 coaches, but Robin Hale was taken off and Alex Tran was added\. Nothing was sent\./);
      assert.equal(r.count, 2);
    }
  });
  it('someone added: the new count, by name', () => {
    const r = recount(was, [...was, { key: 'u:d', name: null }], 'coaches');
    if (r.same) assert.fail('held'); else assert.match(r.error, /It now goes to 3 coaches: A coach was added\./);
  });
  it('more than three changed: the count and See who gets it', () => {
    const r = recount([], [1, 2, 3, 4].map(i => ({ key: `u:${i}`, name: `P${i}` })), 'board');
    if (r.same) assert.fail('held'); else assert.match(r.error, /It now goes to 4 board members\. See who gets it\./);
  });
  it('the send recounts before it claims, and never sends to the new count by itself', () => {
    const code = readCode('lib/club-group-email.ts');
    const send = code.match(/export async function sendColleagueEmail[\s\S]*?\n\}/)?.[0] ?? '';
    assert.ok(send.indexOf('recount(expected') > 0 && send.indexOf('recount(expected') < send.indexOf("rpc('club_group_email_claim'"));
  });
  it('reaches_rep is "went to at least one rep staff member", so a coach who is rep AND house league still shuts a league seat out', () => {
    const code = readCode('lib/club-group-email.ts');
    assert.match(code, /p_reaches_rep: kind === 'coaches' && people\.some\(p => p\.rep\),/);
    assert.doesNotMatch(code, /p_reaches_rep:[^\n]*houseLeague/);
  });
});

describe('T21 · no usable reply target, no send', () => {
  it('', () => {
    assert.equal(replyTarget('sender', null, 'club@x.test').ok, false);
    assert.equal(replyTarget('sender', 'not an address', null).ok, false);
    assert.equal(replyTarget('club', 'me@x.test', null).ok, false, 'club mode without a contact is refused, not switched');
    assert.deepEqual(replyTarget('club', null, 'club@x.test'), { ok: true, replyTo: 'club@x.test' });
    assert.deepEqual(replyTarget('sender', 'me@x.test', null), { ok: true, replyTo: 'me@x.test' });
  });
  it('R1: a sender with no name is refused before anything is claimed', () => {
    const send = readCode('lib/club-group-email.ts').match(/export async function sendColleagueEmail[\s\S]*?\n\}/)?.[0] ?? '';
    assert.ok(send.indexOf("'need_name'") > 0 && send.indexOf("'need_name'") < send.indexOf("rpc('club_group_email_claim'"));
  });
});

describe('T24 · the clock (owner 2026-11-17: words 12 months, names 24 months, nightly)', () => {
  const sweep = MIG.match(/FUNCTION public\.club_email_retention_sweep\(\)[\s\S]*?\$\$;/)?.[0] ?? '';
  it('deletes the words at 12 months and who it went to at 24, for families, coaches and the board, and keeps the counts', () => {
    assert.match(sweep, /interval '12 months'/); assert.match(sweep, /interval '24 months'/);
    assert.match(sweep, /DELETE FROM club_group_email_bodies/); assert.match(sweep, /DELETE FROM club_group_email_recipients/);
    assert.match(sweep, /UPDATE family_email_sends SET subject = NULL, body = NULL, words_cleared_at = now\(\)/);
    assert.match(sweep, /DELETE FROM family_email_recipients/);
    assert.doesNotMatch(sweep, /DELETE FROM (club_group_email_sends|family_email_sends)\b/, 'the sends (date, sender, group, counts) are kept');
    assert.doesNotMatch(sweep, /_count\s*=/, 'counts are never touched');
  });
  it('touches only rows older than the clock, each once', () => {
    assert.match(sweep, /sent_at < v_words_cut AND words_cleared_at IS NULL/);
    assert.match(sweep, /sent_at < v_names_cut AND names_cleared_at IS NULL/);
  });
  it('runs nightly from its own migration', () => {
    const cron = read('supabase/migrations/493_club_emails_are_cleared_nightly.sql');
    assert.match(cron, /cron\.schedule\(\s*'club-email-retention-sweep',\s*'45 8 \* \* \*',[\s\S]*select public\.club_email_retention_sweep\(\)/);
  });
});

describe('T25 · a stopped email whose words have expired cannot be finished', () => {
  it('colleague and family resends refuse in plain words', () => {
    assert.match(readCode('lib/club-group-email.ts'), /if \(send\.wordsClearedAt\) return refuse\(409, 'words_gone', SAY\.wordsGone\)/);
    const finish = readCode('lib/club-group-email.ts').match(/export async function finishColleagueEmail[\s\S]*?\n\}/)?.[0] ?? '';
    assert.match(finish, /\.is\('words_cleared_at', null\)/, 'the take only matches a send that still has its words');
    // The words are read BEFORE the take (a failed read or gone words must never leave the email held 15 minutes).
    assert.ok(finish.indexOf("from('club_group_email_bodies')") > 0 && finish.indexOf("from('club_group_email_bodies')") < finish.indexOf('retried_at: new Date()'),
      'the words are read before the row is taken');
    assert.ok(finish.indexOf("if (!words) return refuse(409, 'words_gone', SAY.wordsGone)") > 0
      && finish.indexOf("if (!words) return refuse(409, 'words_gone', SAY.wordsGone)") < finish.indexOf('retried_at: new Date()'),
      'gone words are refused before the take');
    assert.match(readCode('lib/families-email.ts'), /return refuse\(409, CW\.wordsGone, 'words_gone'\)/);
    assert.equal(SAY.wordsGone, "Its words were deleted 12 months after it was sent, so it can't be sent again.");
  });
});

describe('Finishing a stopped email · the three finish rules (owner 2026-11-24, hardened by /review the same day)', () => {
  const finish = readCode('lib/club-group-email.ts').match(/export async function finishColleagueEmail[\s\S]*?\n\}/)?.[0] ?? '';
  const takeAt = finish.indexOf('retried_at: new Date()');

  it('rule 1 · a seat that cannot see everyone the pick missed is refused, never closing the email over them', () => {
    const repOnly: Seat = { ...ADMIN, coaches: { rep: true, league: false } };
    const leagueOnly: Seat = { ...ADMIN, coaches: { rep: false, league: true } };
    const both = { rep: true, houseLeague: true };
    assert.ok(seatSeesEveryMissed(ADMIN, 'coaches_picked', [{ rep: true, houseLeague: false }, { rep: false, houseLeague: true }]), 'a seat with both sees both');
    assert.ok(!seatSeesEveryMissed(repOnly, 'coaches_picked', [{ rep: true, houseLeague: false }, { rep: false, houseLeague: true }]), 'a rep seat cannot see a house-league-only coach');
    assert.ok(!seatSeesEveryMissed(leagueOnly, 'coaches_picked', [{ rep: true, houseLeague: false }]), 'a league seat cannot see a rep-only coach');
    assert.ok(seatSeesEveryMissed(leagueOnly, 'coaches_picked', [both, { rep: false, houseLeague: true }]), 'a dual-role coach is visible to either seat');
    assert.ok(seatSeesEveryMissed(repOnly, 'coaches_picked', []), 'nobody missed: nothing hidden');
    assert.ok(seatSeesEveryMissed(repOnly, 'rep_staff', [{ rep: false, houseLeague: true }]), 'only a pick can mix; a named group is whole for the seat canFinish admits');
    assert.match(finish, /seatSeesEveryMissed\(seat, send\.groupKind/);
    assert.match(finish, /select\('id, user_id, league_coach_id, name, basis, board_role, rep, house_league'\)/);
    const at = finish.indexOf('seatSeesEveryMissed(seat');
    assert.ok(at > 0 && at < takeAt, 'refused before the row is taken: nothing is held, nothing is written off');
    assert.match(finish.slice(at, at + 260), /refuse\(403, 'not_yours', SAY\.finishHidden\(send\.kind, send\.senderName\)\)/, 'the refusal says the real reason, not only "ask the sender"');
    assert.equal(SAY.finishHidden('coaches', 'Morgan Ellis'),
      "It missed people outside the groups you send to, so you can't finish it. Morgan Ellis or an admin can send it to the ones it missed.");
    assert.match(SAY.finishHidden('board', null), /The sender, the owner or an admin can send it to the ones it missed\.$/);
  });

  it('rule 1 and 3 · the record never offers a finish the server is certain to refuse', () => {
    const read = readCode('lib/club-group-email-read.ts');
    const facts = read.match(/async function finishFacts[\s\S]*?\n\}/)?.[0] ?? '';
    assert.ok(facts.length > 0, 'one function decides what the record offers');
    assert.match(facts, /canFinish\(seat, ctx\.user\.id, send\)/);
    assert.match(facts, /seatSeesEveryMissed\(seat, send\.groupKind, missed\)/);
    assert.match(facts, /SAY\.finishHidden\(/);
    assert.match(facts, /missed\.length > 0 && send\.replyTo === 'sender'/, 'a departed sender only matters when someone was missed');
    assert.match(facts, /SAY\.senderGone\(send\.senderName\)/);
    assert.match(read, /send\.state === 'stopped' \? await finishFacts\(/);
  });

  it('rule 2 · the inbox copy the sender asked for is claimed, sent once, recorded, and only then is the email closed', () => {
    assert.match(finish, /const copyOwed = send\.kind === 'coaches' && send\.clubCopy === 'asked'/);
    assert.match(finish, /send\.replyTo === 'club' \|\| copyOwed \? clubPublicContact/, 'the club contact is read even when replies go to the sender');
    assert.match(finish, /'club_inbox_copy'/, 'sent through the colleague copy kind');
    const claim = finish.indexOf("update({ club_copy: 'failed' })");
    assert.ok(claim > takeAt, 'claimed after the take, which admits one finisher');
    assert.match(finish.slice(claim, claim + 260), /\.eq\('org_id', ctx\.org\.id\)\.eq\('club_copy', 'asked'\)\.select\('id'\)/, 'one atomic asked → failed update: a second finisher or a retry finds nothing to claim');
    assert.ok(finish.indexOf("deliverOne(ctx.org.id, sendId, clubContact as string") > claim, 'the copy is sent only after it was claimed');
    assert.match(finish, /if \(claimed\) \{/, 'only the one who claimed it sends it');
    assert.match(finish, /!contact \|\| reached === 0 \|\| !target \? 'failed'/, 'no contact, nobody reached, or no reply address: nothing goes, and the sender is told');
    assert.match(finish, /if \(claimErr\) throw claimErr;/, 'a failed claim leaves the send stopped, never closed at "asked"');
    assert.match(finish, /r\.status === 'sent' && !!a && a\.trim\(\)\.toLowerCase\(\) === contact/, 'already listed = this email reached the contact');
    assert.ok(!/addressOf\.values\(\)/.test(finish), 'never judged against everyone in the group now');
    assert.ok(!/club_copy: 'asked'/.test(finish), 'a finish never re-asks');
    const recorded = finish.indexOf('.update({ club_copy: copy })');
    const closed = finish.indexOf("status: 'done'");
    assert.ok(recorded > claim && closed > recorded, 'claimed, sent and recorded BEFORE the send is marked done: a closed send is never left at "asked"');
    assert.match(finish.slice(closed, closed + 400), /\.eq\('org_id', ctx\.org\.id\)/, 'the closing update is org-scoped too');
  });

  it('rule 3 · "Replies come to me" refuses once the sender is no longer an active member, but only when something is to be sent', () => {
    assert.match(finish, /from\('organization_members'\)\.select\('status'\)/);
    assert.match(finish, /send\.replyTo === 'sender' && senderStatus !== 'active'\) return refuse\(409, 'sender_gone', SAY\.senderGone\(send\.senderName\)\)/);
    const at = finish.indexOf("'sender_gone'");
    assert.ok(at > 0 && at < takeAt, 'refused before the row is taken');
    assert.ok(at < finish.lastIndexOf('replyTargetOf('),
      'a sender whose account is gone has no address either: the member check speaks first, never "Your account has no email address"');
    const gate = finish.indexOf('if (closesOnly) {');
    assert.ok(gate > 0 && gate < at && finish.lastIndexOf('replyTargetOf(') > at,
      'the sender and the reply address are only asked when something is sent: an email nobody was missed on can always be closed');
    assert.match(finish, /const closesOnly = missedRead\.status === 'fulfilled' && !missedRead\.value\.error && \(missedRead\.value\.data \?\? \[\]\)\.length === 0/);
    assert.match(finish, /'ok' in groupNow && !closesOnly\) return groupNow/, 'an ended season does not keep an email nobody was missed on open either');
    assert.match(finish, /copyOwed && \(send\.replyTo !== 'sender' \|\| senderStatus === 'active'\)/, 'a copy still owed to a closing email is sent only with a usable reply address');
    assert.equal(SAY.senderGone('Morgan Ellis'),
      "Morgan Ellis isn't an active member of the club any more, and this email says replies reach them, so it can't be sent to the ones it missed. Send it again to the same people yourself, and untick anyone who already has it.");
    assert.match(SAY.senderGone(null), /^The sender isn't an active member of the club any more/);
  });

  it('the finish screen says so when the copy the sender asked for did not go', () => {
    const screen = readCode('components/admin/kit/club/communications/ColleagueRecord.tsx');
    assert.match(screen, /res\.data\.copy === 'failed' \? `\$\{said\} \$\{RECORD\.copyFailed\}` : said/);
  });
});

describe('T27 · the club-inbox copy', () => {
  it('is colleague-built: no link, no unsubscribe, no family envelope', () => {
    const m = renderInboxCopy({ club: CLUB, mode: 'club', senderName: 'Morgan Ellis', groupLabel: 'All coaches', reached: 9, subject: 'Meeting', body: BODY });
    assert.doesNotMatch(m.html, LINK);
    for (const f of FAMILY_ENVELOPE) assert.doesNotMatch(unesc(m.html), f);
    assert.ok(unesc(m.html).includes(INBOX_COPY.coachLead(CLUB, 9, 'All coaches')));
    assert.ok(!unesc(m.html).includes('Morgan'), 'club mode names nobody');
  });
  it('is never offered on board email, and is recorded without the address', () => {
    const code = readCode('lib/club-group-email.ts');
    assert.match(code, /if \(wantCopy && \(kind === 'board' \|\| !clubContact\)\) return refuse/);
    assert.match(code, /pendingNamed: namesPending\(seat\) \? pending\.map\(shownMember\) : null,\s*copy: false,/, 'the board window offers no copy');
    assert.match(MIG, /club_copy\s+text CHECK \(club_copy IN \('asked', 'sent', 'failed', 'already_listed'\)\)/);
    assert.match(readCode('lib/families-email.ts'), /\.update\(\{ club_copy: outcome \}\)/);
  });
});

describe('T28 · one reply mode for every message of a send', () => {
  it('the family send hands the same reply target to the families, the head-coach copies and the inbox copy', () => {
    const src = readCode('lib/families-email.ts');
    const fn = src.slice(src.indexOf('export async function deliverFamilyEmail'), src.indexOf('export async function resendMissedFamilies'));
    assert.ok(fn.length > 100);
    assert.match(fn, /const replyTo = d\.reply\.mode === 'club' \? d\.reply\.contact : senderEmail;/);
    assert.match(fn, /replyTo,\n/);
    assert.match(fn, /\}\), replyTo\);/, 'the head-coach copies');
    assert.match(fn, /d\.reply\.mode === 'club' \? ctx\.org\.name : senderName\(ctx\)/, 'the copies name the club in club mode');
  });
  it('a resend keeps the stored mode', () => {
    assert.match(readCode('lib/families-email.ts'), /const mode: FamilyReply\['mode'\] = before\?\.reply_to === 'club' \? 'club' : 'sender';/);
    assert.match(readCode('lib/club-group-email.ts'), /mode: send\.replyTo/);
  });
  it('the shipped family window is unchanged until it asks: the default is the sender, no copy', () => {
    assert.match(readCode('lib/families-email.ts'), /const mode = body\.replyTo === 'club' \? 'club' : 'sender';/);
  });
});

describe('the just-sent key: the same group with the same parameters', () => {
  it('', () => {
    assert.equal(groupKey({ kind: 'coaches', group: 'league_division', seasonId: SEASON, divisionId: U9 }), `league_division:${SEASON}:${U9}`);
    assert.equal(groupKey({ kind: 'coaches', group: 'coaches_picked', keys: ['u:a', 'u:b'] }), groupKey({ kind: 'coaches', group: 'coaches_picked', keys: ['u:b', 'u:a'] }));
    assert.notEqual(groupKey({ kind: 'coaches', group: 'coaches_picked', keys: ['u:a'] }), groupKey({ kind: 'coaches', group: 'coaches_picked', keys: ['u:b'] }));
    assert.doesNotMatch(MIG, /interval '24 hours'/, 'no daily allowance on colleague mail (coach ask 12)');
    assert.match(MIG, /interval '60 seconds'/);
  });
});
