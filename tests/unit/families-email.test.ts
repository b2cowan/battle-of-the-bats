/**
 * EMAIL FAMILIES (Club Tier Stage 7c — Asks 6 and 7; owner answers 2026-10-22 to the build prompt's Put to the owner 1–6).
 *
 * The audience is pure (lib/families-audience.ts) so its rules are proved here: each family once, a household counts
 * once, opted-out families counted and never sent to, never a tryout-only applicant, the sender never a recipient, and
 * ONE function for the preview and the send. The rest is held by shape: the claim before the first email, the club cap
 * stated once on screen and once in the claim, a send that reached nobody gives its claim back, the head coach copy is
 * colleague mail outside the family sender, email only (no notice, push or chat), and never the word "Messages".
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import {
  audienceChoices, familyAudience, parseScope, familyCounts, isCurrentLeagueSeason, isCurrentRepYear, isLiveRegStatus,
  type AudiencePerson,
} from '../../lib/families-audience';
import { CLUB_EMAIL_CAP, FAMILY_EMAIL_WORDS, FAMILY_EMAILS_TAB_WORDS } from '../../lib/families-words';

const REPO = join(import.meta.dirname, '..', '..');
const read = (rel: string) => readFileSync(join(REPO, rel), 'utf8');
const code = (rel: string) => read(rel).replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

const rep = (teamId: string, current = true) => ({ teamId, teamName: teamId.toUpperCase(), current });
const hl = (seasonId: string, current = true) => ({ seasonId, seasonName: `Season ${seasonId}`, current });
const person = (id: string, o: Partial<AudiencePerson> = {}): AudiencePerson =>
  ({ personId: id, email: `${id}@x.test`, lists: [], roster: [], league: [], coGuardians: [], ...o });

const NONE = new Set<string>();

describe('Email families — who it reaches (the one audience)', () => {
  it('a guardian with two children on two teams is ONE family, one address', () => {
    const a = familyAudience([person('p', { roster: [rep('t1'), rep('t2')] })], { kind: 'every' }, NONE, null);
    assert.equal(a.families.length, 1);
    assert.deepEqual(a.families[0].addresses, ['p@x.test']);
    assert.deepEqual(a.families[0].teamIds, ['t1', 't2']);
  });

  it('a household with a verified co-guardian is one family, both addresses; two guardians named on rows join too', () => {
    const people = [
      person('mom', { roster: [rep('t1')], coGuardians: ['dad'] }),
      person('dad', { league: [hl('s1')] }),
    ];
    const a = familyAudience(people, { kind: 'every' }, NONE, null);
    assert.equal(a.families.length, 1, 'one household, counted once');
    assert.deepEqual(a.families[0].addresses, ['dad@x.test', 'mom@x.test']);
  });

  it('a co-guardian with no row of their own still gets the household’s copy', () => {
    const a = familyAudience([person('mom', { roster: [rep('t1')], coGuardians: ['gran'] }), person('gran')], { kind: 'every' }, NONE, null);
    assert.equal(a.families.length, 1);
    assert.deepEqual(a.families[0].addresses, ['gran@x.test', 'mom@x.test']);
  });

  it('never a tryout-only applicant, never last season only', () => {
    const people = [person('tryout'), person('old', { roster: [rep('t1', false)], league: [hl('s0', false)] }), person('now', { roster: [rep('t1')] })];
    const a = familyAudience(people, { kind: 'every' }, NONE, null);
    assert.deepEqual(a.families.map(f => f.addresses[0]), ['now@x.test']);
  });

  it('an opted-out family is counted and never sent to; one guardian opted out, the other reached', () => {
    const people = [
      person('out', { roster: [rep('t1')] }),
      person('half', { roster: [rep('t1')], coGuardians: ['half2'] }), person('half2'),
    ];
    const a = familyAudience(people, { kind: 'every' }, new Set(['out@x.test', 'half@x.test']), null);
    assert.equal(a.optedOut, 1);
    assert.equal(a.families.length, 1);
    assert.deepEqual(a.families[0].addresses, ['half2@x.test'], 'the opted-out address is never in the send');
  });

  it('the sender is never a recipient; a family that was only the sender leaves the count', () => {
    const people = [
      person('me', { roster: [rep('t1')] }),
      person('co', { roster: [rep('t1')], coGuardians: ['me2'] }), person('me2', { email: 'Sender@X.test' }),
    ];
    const a = familyAudience(people, { kind: 'every' }, NONE, 'me@x.test');
    assert.equal(a.senderSkipped, true);
    assert.deepEqual(a.families.map(f => f.addresses), [['co@x.test', 'sender@x.test']]);
    const b = familyAudience(people, { kind: 'every' }, NONE, 'sender@x.test');
    assert.deepEqual(b.families.map(f => f.addresses).sort(), [['co@x.test'], ['me@x.test']]);
  });

  it('some rep teams: only their families; the head coach copy names only the picked teams', () => {
    const people = [person('a', { roster: [rep('t1'), rep('t9')] }), person('b', { roster: [rep('t2')] }), person('c', { league: [hl('s1')] })];
    const a = familyAudience(people, { kind: 'teams', teamIds: ['t1'] }, NONE, null);
    assert.deepEqual(a.families.map(f => f.addresses[0]), ['a@x.test']);
    assert.deepEqual(a.coachTeamIds, ['t1']);
    const every = familyAudience(people, { kind: 'every' }, NONE, null);
    assert.deepEqual(every.coachTeamIds, ['t1', 't2', 't9']);
  });

  it('a house-league season: only its families, and no head coach copy', () => {
    const people = [person('a', { league: [hl('s1')] }), person('b', { league: [hl('s2')] }), person('c', { roster: [rep('t1')] })];
    const a = familyAudience(people, { kind: 'season', seasonId: 's1' }, NONE, null);
    assert.deepEqual(a.families.map(f => f.addresses[0]), ['a@x.test']);
    assert.deepEqual(a.coachTeamIds, []);
  });

  it('the preview and the send cannot disagree: the same input gives the same families, in the same order', () => {
    const people = Array.from({ length: 40 }, (_, i) => person(`p${(i * 7) % 40}`, { roster: [rep(`t${i % 3}`)], coGuardians: i % 5 === 0 ? [`p${(i + 1) % 40}`] : [] }));
    const sup = new Set(['p3@x.test', 'p11@x.test']);
    const first = familyAudience(people, { kind: 'every' }, sup, 'p8@x.test');
    const second = familyAudience([...people].reverse(), { kind: 'every' }, sup, 'p8@x.test');
    assert.deepEqual(second, first);
  });

  it('the choices count families in each (those who get it AND those opted out), and offer only what the club runs', () => {
    const people = [person('a', { roster: [rep('t1')] }), person('b', { roster: [rep('t1')] }), person('c', { roster: [rep('t2', false)] })];
    const c = audienceChoices(people, new Set(['b@x.test']), null);
    assert.equal(c.every, 2);
    assert.deepEqual(c.teams, [{ teamId: 't1', teamName: 'T1', families: 2 }]);
    assert.deepEqual(c.seasons, [], 'no house league season running: no season choice');
  });

  it('"Reached" counts FAMILIES (any address accepted), "failed" a family none of whose addresses went', () => {
    const a = familyAudience([person('h', { roster: [rep('t1')], coGuardians: ['h2'] }), person('h2'), person('z', { roster: [rep('t1')] })],
      { kind: 'every' }, NONE, null);
    const results = new Map([['h@x.test', { status: 'provider_error' }], ['h2@x.test', { status: 'sent' }], ['z@x.test', { status: 'provider_error' }]]);
    assert.deepEqual(familyCounts(a, results), { reached: 1, failed: 1 });
    assert.deepEqual(familyCounts(a, new Map([['z@x.test', { status: 'sent' }]])), { reached: 1, failed: 0 }, 'an undecided family is neither');
  });

  it('the row predicates are Families’ own (live, this season)', () => {
    assert.equal(isLiveRegStatus('declined'), false);
    assert.equal(isLiveRegStatus('withdrawn'), false);
    assert.equal(isLiveRegStatus('active'), true);
    assert.equal(isCurrentRepYear({ rep_program_years: { status: 'active' } }), true);
    assert.equal(isCurrentLeagueSeason({ league_seasons: { status: 'registration_open' } }), true);
    assert.equal(isCurrentLeagueSeason({ league_seasons: { status: 'completed' } }), false);
    assert.ok(!/const isLiveRegStatus|const isCurrentRepYear|const isCurrentLeagueSeason/.test(read('lib/families-read.ts')),
      'families-read.ts has a second copy of a row predicate — import them from families-audience');
  });
});

describe('Email families — the press, the claim and the cap', () => {
  const send = code('lib/families-email.ts');

  it('the cap is one number: on screen and in the LATEST family_email_claim (mig 347, by bucket since 385)', () => {
    // The newest migration that defines the claim is the one the database runs, so a later file that changes the
    // number cannot pass behind an older one.
    const dir = join(REPO, 'supabase', 'migrations');
    const latest = readdirSync(dir).filter(f => f.endsWith('.sql')).sort()
      .filter(f => /CREATE OR REPLACE FUNCTION public\.family_email_claim\(/.test(readFileSync(join(dir, f), 'utf8'))).at(-1);
    assert.ok(latest, 'no migration defines family_email_claim');
    const m = read(`supabase/migrations/${latest}`).match(/v_cap\s+constant integer := (\d+);/);
    assert.ok(m, `${latest} lost its v_cap`);
    assert.equal(Number(m![1]), CLUB_EMAIL_CAP);
    assert.equal(CLUB_EMAIL_CAP, 3, 'Ask 7 A, 9d1·12: three emails in any 24 hours, for the club and for each season');
  });

  it('it re-counts from the one audience, refuses a changed count, then claims BEFORE the first email', () => {
    const audience = send.indexOf('familyAudience(world.people, scope');
    const changed = send.indexOf("'changed'");
    const claim = send.indexOf("rpc('family_email_claim'");
    const first = send.indexOf('sendFamilyEmailBatch(');
    assert.ok(audience > 0 && changed > audience && claim > changed && first > claim,
      'the order must be: re-count → refuse a changed count → claim → send');
    assert.match(send, /loadFamilyAudience\(ctx\.org\.id, ctx\.org\.slug, \{ attach: true[,} ]/, 'the press attaches first');
  });

  it('replies go to the sender; a send that reached nobody gives its claim back', () => {
    assert.match(send, /replyTo: senderEmail/);
    assert.match(send, /if \(reached === 0\)[\s\S]{0,200}\.delete\(\)\.eq\('id', sendId\)/);
  });

  it('the head coach copy is colleague mail outside the family sender, and never in family mail', () => {
    assert.ok(!/\bsendEmail\s*\(/.test(read('lib/families-email.ts')), 'the family sender calls the raw transport');
    const coaches = read('lib/families-email-coaches.ts');
    assert.ok(!/sendFamilyEmail/.test(coaches), 'the coach copy goes through the family door (it would wear the family footer)');
    assert.match(code('lib/families-email-coaches.ts'), /p\.userId === senderId \|\| familyAddresses\.has\(email\) \|\| byEmail\.has\(email\)/,
      'a coach copy skips the sender, a parent the send reaches, and a coach already copied');
  });

  it('email only: no notice, no push, no chat from Email families', () => {
    for (const f of ['lib/families-email.ts', 'lib/families-email-coaches.ts', 'app/api/admin/families/email/route.ts']) {
      const s = code(f);
      assert.ok(!/\bnotify\s*\(|push|chat_/i.test(s), `${f} sends something other than email`);
    }
  });

  it('the audit keeps counts — never the words, never an address', () => {
    const route = code('app/api/admin/families/email/route.ts');
    const audit = route.slice(route.indexOf('writeOrgAudit('));
    const call = audit.slice(0, audit.indexOf(');'));
    assert.ok(!/subject|body\.body|message|address|\bto\b/.test(call), call);
  });
});

describe('Email families — the words', () => {
  const words = [...Object.values(FAMILY_EMAIL_WORDS), ...Object.values(FAMILY_EMAILS_TAB_WORDS)]
    .map(v => {
      if (typeof v !== 'function') return String(v);
      const say = v as (...a: unknown[]) => unknown;
      try { return String(say(1, 1, 'x', 1)); } catch { return String(say(['15U AAA', '14U AA'])); }
    });

  it('never the word "Messages" (the chat pause\'s E2 owns it)', () => {
    for (const w of words) assert.ok(!/\bMessages\b/.test(w), w);
    const walk = (dir: string): string[] => readdirSync(join(REPO, dir)).flatMap(n => {
      const rel = `${dir}/${n}`;
      return statSync(join(REPO, rel)).isDirectory() ? walk(rel) : [rel];
    });
    for (const f of ['components/admin/kit/club/families/EmailFamiliesWindow.tsx', 'components/admin/kit/club/families/EmailsTab.tsx',
      ...walk('app/[orgSlug]/admin/families/emails')]) {
      assert.ok(!/\bMessages\b/.test(code(f)), `${f} says "Messages"`);
    }
  });

  it('the unit is one word: families', () => {
    assert.equal(FAMILY_EMAIL_WORDS.reach(88, 7), '88 families get it. 7 opted out and won’t.');
    assert.equal(FAMILY_EMAIL_WORDS.reach(1, 0), '1 family gets it.');
    assert.equal(FAMILY_EMAIL_WORDS.send(88), 'Send to 88');
    assert.equal(FAMILY_EMAIL_WORDS.sent(86, 88), 'Sent. Reached 86 of 88 families.');
    assert.ok(!/household|guardians? get/i.test(words.join(' ')), 'a second unit crept in');
  });
});

describe('Email families — to one of the Families lists (owner 2026-10-22)', () => {
  const owes = (id: string, o: Partial<AudiencePerson> = {}) => person(id, { lists: ['owes'], roster: [rep('t1')], ...o });

  it('reaches only the people on that list, each household once, with the co-guardian joined', () => {
    const people = [owes('mom', { coGuardians: ['dad'] }), person('dad', { roster: [rep('t1')] }), person('other', { roster: [rep('t1')] })];
    const a = familyAudience(people, { kind: 'list', list: 'owes' }, NONE, null);
    assert.equal(a.families.length, 1, 'the household of the one family that owes, once');
    assert.deepEqual(a.families[0].addresses, ['dad@x.test', 'mom@x.test']);
  });

  it('a family not back this season is on its list although "every family" leaves it out', () => {
    const people = [person('gone', { lists: ['notback'], roster: [rep('t1', false)] })];
    assert.equal(familyAudience(people, { kind: 'every' }, NONE, null).families.length, 0);
    assert.equal(familyAudience(people, { kind: 'list', list: 'notback' }, NONE, null).families.length, 1);
  });

  it('opted-out families are counted and never sent to; the sender is never a recipient', () => {
    const people = [owes('a'), owes('b'), owes('me')];
    const a = familyAudience(people, { kind: 'list', list: 'owes' }, new Set(['b@x.test']), 'me@x.test');
    assert.deepEqual(a.families.map(f => f.addresses[0]), ['a@x.test']);
    assert.equal(a.optedOut, 1);
    assert.equal(a.senderSkipped, true);
  });

  it('a list copies no head coach', () => {
    assert.deepEqual(familyAudience([owes('a')], { kind: 'list', list: 'owes' }, NONE, null).coachTeamIds, []);
  });

  it('the window offers only the lists with a family on them, each with its count', () => {
    const people = [owes('a'), person('b', { lists: ['forms'], roster: [rep('t1')] })];
    const c = audienceChoices(people, NONE, null);
    assert.deepEqual(c.lists, [{ list: 'owes', families: 1 }, { list: 'forms', families: 1 }]);
    assert.deepEqual(audienceChoices([person('x', { roster: [rep('t1')] })], NONE, null).lists, []);
  });

  it('the server takes a list only from the Families lists, never a guess', () => {
    assert.deepEqual(parseScope({ kind: 'list', list: 'owes' }), { kind: 'list', list: 'owes' });
    assert.equal(parseScope({ kind: 'list', list: 'nofamily' }), null);
    assert.equal(parseScope({ kind: 'list' }), null);
    assert.equal(parseScope(null), null, 'a JSON null body is no scope, not a thrown read');
  });

  it('the Families tab and the send read ONE predicate per list', () => {
    const book = code('components/admin/kit/club/families/FamiliesBook.tsx');
    assert.match(book, /FAMILY_LIST_PREDICATES/, 'the Families tab no longer reads the shared list predicates');
    assert.ok(!/missingFormsCount\s*>\s*0/.test(book), 'the Families tab defines a list predicate of its own again');
    assert.match(code('lib/families-read.ts'), /listsByPerson\(/, 'the audience no longer reads the shared list predicates');
  });
});
