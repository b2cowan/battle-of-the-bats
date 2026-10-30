import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { SCHEDULE_WORDS as W, SCHEDULE_SCREEN_WORDS as S } from '../../lib/club-schedule-words.ts';
import { CHANGES_TO_SEND_WORDS } from '../../lib/league-schedule-words.ts';

describe('the change statement audiences (settled 2026-10-29)', () => {
  const cases: [string, number, number, number, string][] = [
    ['rep teams only', 2, 0, 0, 'The changes reach 2 teams’ schedules. Only those teams’ coaches are told. Nothing else on the schedule moves.'],
    ['rep teams and one division’s games', 2, 0, 1, 'The changes reach 2 teams’ schedules and 1 house-league division’s games. Those teams’ coaches are told, and so are the division’s league admins. Nothing else on the schedule moves.'],
    ['rep teams and several divisions’ games', 2, 0, 2, 'The changes reach 2 teams’ schedules and 2 house-league divisions’ games. Those teams’ coaches are told, and so are the divisions’ league admins. Nothing else on the schedule moves.'],
    ['games only', 0, 0, 1, 'The changes reach 1 house-league division’s games. Their league admins are told, and families hear from them. Nothing else on the schedule moves.'],
    ['one house-league team, no games', 0, 1, 0, 'The changes reach 1 house-league team’s practices. Their coaches are told, and so are the house-league team’s families. Nothing else on the schedule moves.'],
    ['rep and house-league teams, no games', 2, 2, 0, 'The changes reach 2 teams’ schedules and 2 house-league teams’ practices. Their coaches are told, and so are the house-league teams’ families. Nothing else on the schedule moves.'],
    ['house-league teams and one division’s games', 0, 1, 1, 'The changes reach 1 house-league team’s practices and 1 house-league division’s games. Their coaches are told, and so are the house-league team’s families and the division’s league admins. Nothing else on the schedule moves.'],
    ['all audiences, several divisions', 2, 2, 2, 'The changes reach 2 teams’ schedules, 2 house-league teams’ practices and 2 house-league divisions’ games. Their coaches are told, and so are the house-league teams’ families and the divisions’ league admins. Nothing else on the schedule moves.'],
  ];
  for (const [name, rep, teams, divisions, expected] of cases) {
    it(name, () => assert.equal(W.changesStatement(rep, [], teams, divisions), expected));
  }
  it('keeps the hand-back clause', () => {
    assert.equal(W.changesStatement(1, ['Reds'], 0, 1), 'The changes reach 1 team’s schedules and 1 house-league division’s games. Those teams’ coaches are told, and so are the division’s league admins; Reds handed its slot back itself. Nothing else on the schedule moves.');
  });
});

describe('the settled send and undo words', () => {
  it('names the games-only audience on all three surfaces', () => {
    assert.deepEqual([S.whoChangesGamesOnly, S.sendToLeagueAdmins, S.sentNoticeGamesOnly],
      ['Who is told · league admins', 'Send to league admins', 'Sent. The league admins are told.']);
  });
  it('shares the families hint and retains failed-email wording for other sends', () => {
    assert.equal(S.changesHintLeagueGames, 'Families hear about game changes when a league admin sends them.');
    assert.equal(S.changesHintLeague, `A house-league team’s families get one email too. ${S.changesHintLeagueGames}`);
    assert.equal(S.sentNotice(0, 1, 2), 'Sent to 0 people on 1 team. 2 couldn’t be delivered.');
  });
  it('names Undo and the club’s change', () => {
    assert.equal(CHANGES_TO_SEND_WORDS.undoClub, 'The club changed this game’s time, so Undo can’t put it back. Give it a new date instead.');
  });
});

it('the bell’s sender separates the division from the game line with a middle dot', () => {
  const source = readFileSync(new URL('../../lib/club-schedule-send.ts', import.meta.url), 'utf8');
  assert.ok(source.includes('gameLines: myGames.map(g => `${g.divisionName} · ${g.line}`)'));
});
