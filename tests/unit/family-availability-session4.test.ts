import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import fs from 'node:fs';
import { between, readCode, readSource } from './_source-code.ts';
import { familyAnswerState, familyEventOpen, lineupFamilyOuts, lineupTagWord } from '../../lib/family-availability-rules.ts';
import {
  GUARDIAN_CONSENT_VERSION, GUARDIAN_CONSENT_VERSION_REP, beforeYouJoinWords, guardianConsentText,
} from '../../lib/family-guardian-consent.ts';

/**
 * Signed-in family accounts Stage 4b, Session 4 (Part 9; build prompt docs/projects/active/SIGNED_IN_FAMILY_STAGE4B_BUILD_PROMPT.md,
 * the "Owner calls RULED at the start" block). The owner's Session 4 rulings that changed code. The merge's database half is
 * tests/sql/one-attendance-record-fixture.sql section 13 (One attendance record); the bell and Remind words are pinned in
 * family-availability-session3.test.ts.
 */

/** The migration that last re-created `org_children_join` (the highest-numbered file that defines it). */
function latestJoinMigration(): string {
  const dir = 'supabase/migrations';
  const files = fs.readdirSync(dir).filter(f => /^\d+_.*\.sql$/.test(f)).sort((a, b) => parseInt(a, 10) - parseInt(b, 10));
  const defining = files.filter(f => fs.readFileSync(`${dir}/${f}`, 'utf8').includes('create or replace function public.org_children_join'));
  assert.ok(defining.length > 0, 'some migration defines org_children_join');
  return `${dir}/${defining[defining.length - 1]}`;
}

/** SQL without its `--` comments: a table named only in prose must not satisfy a guard. */
const sqlCode = (sql: string) => sql.replace(/--[^\n]*/g, '');

describe('a child join keeps every record that names the child (owner, Session 4: the merge lost family answers)', () => {
  const join = sqlCode(between(readSource(latestJoinMigration()),
    'create or replace function public.org_children_join', 'revoke all on function public.org_children_join'));

  it('ONE RECORD (mig 485): the answers ride the roster entry, which the join re-points before the absorbed child is deleted', () => {
    // The attendance record is keyed by the roster entry (player_id), never the child; mig 476's child-keyed table is retired.
    const moves = join.indexOf('update public.rep_roster_players       set child_id = p_keep where child_id = p_absorb');
    assert.ok(moves > 0, 'the roster entries are re-pointed');
    assert.ok(moves < join.indexOf('delete from public.org_children where id = p_absorb'), 'before the delete');
    assert.doesNotMatch(join, /event_availability_answers/, 'the retired table is never named');
  });

  it('EVERY table with a foreign key to org_children is moved by the join (a new one must be carried, not cascaded away)', () => {
    const constraints = JSON.parse(fs.readFileSync('docs/agents/db/schema-snapshots/schema-dump-constraints-dev.json', 'utf8')) as
      { table_name: string; foreign_table?: string }[];
    const tables = new Set(constraints.filter(c => c.foreign_table === 'org_children').map(c => c.table_name));
    assert.ok(tables.has('rep_roster_players'), 'the snapshot holds the roster’s child FK');
    // A table made by a migration whose snapshot is not refreshed yet: read the migrations too, IN ORDER, so a table a later
    // migration drops (mig 485 retired event_availability_answers) is not demanded of the join.
    const ordered = fs.readdirSync('supabase/migrations').filter(n => /^\d+_.*\.sql$/.test(n)).sort((a, b) => parseInt(a, 10) - parseInt(b, 10));
    for (const f of ordered) {
      const sql = sqlCode(fs.readFileSync(`supabase/migrations/${f}`, 'utf8'));
      for (const m of sql.matchAll(/create table(?: if not exists)?\s+public\.(\w+)\s*\(([\s\S]*?)\n\);/gi)) {
        if (/references public\.org_children\s*\(/i.test(m[2])) tables.add(m[1]);
      }
      for (const m of sql.matchAll(/drop table(?: if exists)?\s+public\.(\w+)/gi)) tables.delete(m[1]);
    }
    for (const t of tables) {
      assert.match(join, new RegExp(`\\b(update|delete from|insert into)\\s+public\\.${t}\\b`), `${t} names a child but the join never moves it`);
    }
  });
});

describe('a started game stops flagging a family Out (owner, Session 4: match the schedule triangle)', () => {
  const START = '2027-04-24T14:00:00.000Z';
  const before = Date.parse(START) - 60_000;
  const after = Date.parse(START) + 60_000;
  const maya = [{ playerId: 'maya', status: 'absent' as const, family: { status: 'absent' as const, answeredAt: '2027-04-23T00:00:00.000Z' } }];
  const inLineup = new Set(['maya']);

  it('one "open" test: not cancelled, not started (the server state and the clients’ clock agree)', () => {
    assert.equal(familyEventOpen({ status: 'scheduled', startsAt: START }, before), true);
    assert.equal(familyEventOpen({ status: 'scheduled', startsAt: START }, after), false);
    assert.equal(familyEventOpen({ status: 'cancelled', startsAt: START }, before), false);
    assert.equal(familyEventOpen({ status: 'scheduled', startsAt: null }, before), false);
    for (const now of [before, after]) {
      assert.equal(familyAnswerState('games', { eventType: 'league_game', status: 'scheduled', startsAt: START }, new Date(now)) === 'open',
        familyEventOpen({ status: 'scheduled', startsAt: START }, now));
    }
  });

  it('the warning goes at the start; the pool word stays', () => {
    assert.equal(lineupFamilyOuts(maya, inLineup, null, familyEventOpen({ status: 'scheduled', startsAt: START }, before)).length, 1);
    assert.deepEqual(lineupFamilyOuts(maya, inLineup, null, familyEventOpen({ status: 'scheduled', startsAt: START }, after)), []);
    assert.equal(lineupTagWord('absent'), 'out');
  });

  it('every surface passes the rule (the builder, the event window), not a guard of its own', () => {
    assert.match(readCode('app/[orgSlug]/coaches/teams/[teamId]/lineups/[eventId]/page.tsx'),
      /lineupFamilyOuts\([^)]*familyEventOpen\(event, nowMs\)\)/);
    assert.match(readCode('components/coaches/ScheduleEventSheet.tsx'), /lineupFamilyOuts\([\s\S]{0,600}?familyEventOpen\(ev, nowMs\)\)/);
  });

  it('the window words an Out as the family’s only while the Out on screen is the family’s own (review of S2)', () => {
    assert.match(readCode('components/coaches/ScheduleEventSheet.tsx'),
      /family: r\.setByKind === 'family' && r\.status === r\.savedStatus && !r\.confirmed \? said\.get\(r\.player\.id\) \?\? null : null,/);
  });

  it('a Maybe the player already holds is not refused after the start (it would reject the whole batch) (review of S2)', () => {
    const route = readCode('app/api/coaches/[orgSlug]/teams/[teamId]/events/[eventId]/attendance/route.ts');
    assert.match(route, /standingMaybe \?\?= new Set\(\(await getRepTeamEventAttendance\(eventId\)\)\.filter\(a => a\.status === 'maybe'\)/);
    assert.match(route, /if \(!standingMaybe\.has\(playerId\)\) \{\s*\n\s*return NextResponse\.json\(\{ error: 'Maybe is only for events families can still answer' \}/);
  });

  it('parent first names are remembered a few minutes, so an autosave does not make one auth call per answered player (review of S2)', () => {
    const mod = readCode('lib/family-availability.ts');
    assert.match(mod, /const FIRST_NAME_TTL_MS = 10 \* 60 \* 1000;/);
    assert.match(mod, /if \(found\) \{[^]*?firstNameCache\.set\(id, \{ name, at: now \}\);/);
  });
});

describe('consent 0.3 for rep-team invitations (owner 2026-11-14, walk §529 call 3; /legal draft "(a) 0.3")', () => {
  it('a rep invitation shows and STORES the 0.3 lines under v0.3; a house-league one stays exactly 0.1', () => {
    const rep = beforeYouJoinWords('Riverdale', ['Leo'], true);
    assert.equal(rep.version, GUARDIAN_CONSENT_VERSION_REP);
    assert.match(rep.version, /v0\.3$/, 'the version moved with the words');
    assert.match(rep.who.you, /If Leo’s coach turns it on, you can also say here whether Leo is coming to a game or practice\. Your answer is also Leo’s attendance for it, and stays in the team’s record\. Nothing about other children\./);
    assert.match(rep.who.staff, /Coaches also see your answers, any note you add, your first name and when you answered, and can change an answer\. You’ll see when they do\./);
    const many = beforeYouJoinWords('Riverdale', ['Leo', 'Ava'], true);
    assert.match(many.who.you, /Your answers are also each child’s attendance for it, and stay in the team’s record\./);
    assert.match(rep.who.others, /Leo’s other parent, if they’ve joined, sees your first name and your answer, but not your note\./);
    const text = guardianConsentText(rep);
    assert.ok(text.startsWith(GUARDIAN_CONSENT_VERSION_REP), 'the record leads with the version it shows');
    assert.match(text, /Coaches also see your answers/);
    const hl = beforeYouJoinWords('Riverdale', ['Leo']);
    assert.equal(hl.version, GUARDIAN_CONSENT_VERSION);
    assert.ok(guardianConsentText(hl).startsWith(GUARDIAN_CONSENT_VERSION));
    assert.doesNotMatch(guardianConsentText(hl), /answer|note/i, 'a house-league parent is promised no In / Out / Maybe');
  });
  it('the page and the record decide "rep" from the same children', () => {
    const code = readCode('lib/family-invitation.ts');
    assert.match(code, /rep: !!c\.repEntryId/);
    assert.match(code, /beforeYouJoinWords\(await clubNameOf\(inv\.org_id\), connect\.map\(c => c\.firstName\), connect\.some\(c => !!c\.repEntryId\)\)/);
    assert.match(readCode('app/(consumer)/family/claim/[token]/ClaimClient.tsx'), /beforeYouJoinWords\(club\.name, names, kids\.some\(c => c\.rep\)\)/);
    assert.doesNotMatch(code, /GUARDIAN_CONSENT_VERSION\}\\nConnected when/, 'a sibling record never stamps a version over another acceptance');
  });
});

describe('Remind counts parents reached (owner, Session 4: name players, count parents)', () => {
  it('the report counts what reached them: every parent minus those an email went to', () => {
    const remind = readCode('lib/family-availability-remind.ts');
    assert.match(remind, /if \(result\.status === 'sent' \|\| result\.status === 'no_answer'\) emailed\.add\(r\.userId\)/);
    assert.match(remind, /appOnly: g\.recipients\.length - emailed\.size/);
  });
  it('the daily cap: a parent emailed by this team today gets the app note only; the bell line records the email', () => {
    const remind = readCode('lib/family-availability-remind.ts');
    assert.match(remind, /if \(r\.appOnly \|\| r\.capped \|\| !r\.email\) return;/);
    assert.match(remind, /metadata: \{ teamId: params\.teamId, eventId: g\.event\.id, emailed: emailed\.has\(r\.userId\) \}/);
    const cap = remind.slice(remind.indexOf('async function remindEmailedToday'));
    assert.match(cap, /\.eq\('metadata->>teamId', teamId\)\.eq\('metadata->>emailed', 'true'\)/);
    assert.match(cap, /\.gte\('created_at', dayStart\)/);
  });
});
