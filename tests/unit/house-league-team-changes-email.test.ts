import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import { TC_MAIL, TC_HISTORY, TC_BANNER, TC_PILL, TC_WINDOW } from '../../lib/house-league-team-changes-words.ts';

/**
 * HOUSE LEAGUE TEAM-CHANGE EMAILS (TC·1 to TC·8; drawing tab 5). The email itself is built in lib/email.ts, which is read as
 * source here (the module needs the app's import alias); its words are TC_MAIL, tested as data.
 */
const read = (p: string) => readFileSync(join(process.cwd(), p), 'utf8');
const EMAIL = read('lib/email.ts');
const builder = EMAIL.slice(EMAIL.indexOf('export function leagueTeamChangesHtml'), EMAIL.indexOf('export function leagueTeamsPlacedHtml'));

describe('the team-change email (shape)', () => {
  it('is one block per changed child, with the closing line, and the sign-up button only while owing', () => {
    assert.ok(builder.includes('TC_MAIL.childTitle(l.child, l.team)'));
    assert.ok(builder.includes('TC_MAIL.newTeam') && builder.includes('TC_MAIL.movedFrom(l.movedFrom)'));
    assert.ok(builder.includes('TC_MAIL.coach(l.coaches)'));
    assert.ok(builder.includes('TC_MAIL.close'));
    assert.equal(builder.split('signupButton(').length - 1, 1, 'one button, drawn only while money is owed');
    assert.ok(builder.includes('const p = escapeEmailFields(input);'));
  });

  it('is a service notice: sent through the placement sender with the placement kind, counted toward no cap', () => {
    const send = read('lib/house-league-placement-mail.ts');
    assert.ok(send.includes("row.kind === 'changes'"));
    assert.ok(send.includes("kind: 'house_league_placement'"));
    assert.ok(!read('lib/email-kinds.ts').includes('team_changes'), 'no new email kind (TC design)');
  });

  it('a silent move writes no email row and a send writes the changes row itself', () => {
    const sql = read('supabase/migrations/459_team_changes_are_told_in_one_email.sql');
    const place = sql.slice(sql.indexOf('FUNCTION public.league_team_place('), sql.indexOf('FUNCTION public.league_division_publish('));
    assert.ok(!place.includes('INSERT INTO league_placement_emails'), 'the move function stores no email row');
    assert.ok(sql.includes("'changes'") && sql.includes('league_division_tell_changes'));
  });
});

describe('the team-change words', () => {
  it('subject names the children and the season', () => {
    assert.equal(TC_MAIL.subject(['Lucia', 'Mateo'], 'Spring 2027'), 'Team changes for Lucia and Mateo · Spring 2027');
  });
  it('the email block lines', () => {
    assert.equal(TC_MAIL.childTitle('Lucia Reyes', 'Jays'), 'Lucia Reyes: Jays');
    assert.equal(TC_MAIL.movedFrom('Hawks'), 'Moved from Hawks');
    assert.equal(TC_MAIL.coach([]), 'Coach to be announced');
    assert.equal(TC_MAIL.coach(['Dana Whitfield']), 'Coach Dana Whitfield');
  });
  it('the banner says one family or many', () => {
    assert.equal(TC_BANNER.title(1), '1 family hasn’t been told about team changes.');
    assert.equal(TC_BANNER.title(3), '3 families haven’t been told about team changes.');
  });
  it('the history says what was emailed and what was not', () => {
    assert.equal(TC_HISTORY.summary(3, 0), '3 families emailed');
    assert.equal(TC_HISTORY.summary(0, 2), 'Not emailed (2 families)');
    assert.equal(TC_HISTORY.summary(2, 1), '2 emailed, 1 not emailed');
  });
  it('the pill keeps one period after the clock', () => {
    assert.equal(TC_PILL.emailed(3, '10:42 a.m.'), 'Emailed 3 families at 10:42 a.m.');
  });
  it('the window names the quiet family and the foot counts emails', () => {
    assert.equal(
      TC_WINDOW.quiet('Patel', ['Priya'], 'Hawks'),
      'Nothing to send to the Patel family: Priya moved and came back to Hawks, the team they were last told.',
    );
    assert.equal(TC_WINDOW.footStart(3), 'One email per family · 3 emails');
    assert.equal(TC_WINDOW.footStart(1), 'One email per family · 1 email');
  });
});
