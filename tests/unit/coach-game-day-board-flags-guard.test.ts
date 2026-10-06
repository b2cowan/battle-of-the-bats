/**
 * The game-day board's flags, and the call-up mark on every row that lists one (owner, 2026-10-06 —
 * mockup `docs/projects/active/COACH_GAME_DAY_BOARD_FLAGS_MOCKUP.html`).
 *
 * Two rulings, both pinned here:
 *  1. ON A PHONE A BOARD ROW'S FLAGS SIT ON THEIR OWN LINE UNDER THE NAME. Beside the name, a
 *     22-character flag left a 360px row about 50px of name: "Devon Test" broke mid-word over three
 *     lines, and the bench's sitting streak broke a name over nine.
 *  2. A CALL-UP IS MARKED BY THE INK OF THEIR NAME, NOT THE WORD — on the board, the batting order
 *     and the phone's inning list alike ("the coach knows who is their own player vs a call up they
 *     don't need these words on each one"). The word stays in each row's accessible name.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { cssRule, readCode, readSource, splitPhoneCss, stripComments } from './_source-code.ts';

const CONSOLE = 'app/[orgSlug]/coaches/teams/[teamId]/game/[eventId]/page.tsx';
const EDITOR = 'app/[orgSlug]/coaches/teams/[teamId]/lineups/_LineupEditor.tsx';
const INNING_LIST = 'components/coaches/LineupInningList.tsx';
const CSS = 'app/[orgSlug]/coaches/coaches.module.css';

describe('the board: a row\'s flags sit under the name on a phone', () => {
  it('both halves of the board draw the name and its flags through the one helper', () => {
    const code = readCode(CONSOLE);
    assert.equal(
      code.split('{whoFor(r.playerId, [').length - 1, 2,
      'The field rows and the bench rows must both draw name + flags through whoFor. A half that '
      + 'renders its own chips beside the name brings back the squeeze on a phone.',
    );
    assert.doesNotMatch(
      code, /<span className=\{styles\.gdName\}>\{nameOf\(r\.playerId\)\}<\/span>/,
      'A board row draws its name directly again, outside whoFor — its flags will sit beside it.',
    );
  });

  it('the stack happens at the phone width, and only there', () => {
    const { phone, rest } = splitPhoneCss(stripComments(readSource(CSS)));
    assert.match(cssRule(phone, '.gdWho'), /flex-direction:\s*column/, 'On a phone the name and its flags no longer stack.');
    assert.match(cssRule(phone, '.gdWho .gdName'), /line-height:\s*1\.3/, 'The stacked name lost its tighter leading — a flagged row will outgrow the 56px floor.');
    assert.match(cssRule(phone, '.gdFlags .gdWarn'), /padding-block:\s*0\.2em/, 'The stacked chip lost its trimmed padding — a flagged row will outgrow the 56px floor.');
    assert.doesNotMatch(cssRule(rest, '.gdWho'), /flex-direction:\s*column/, 'Above phone width there is room for the name and its flags side by side; the stack belongs to the 640 block.');
  });
});

describe('a call-up is the ink of the name, not a word', () => {
  it('is ONE rule, in the call-up colour', () => {
    const css = stripComments(readSource(CSS));
    assert.match(cssRule(css, '.callUpName'), /color:\s*var\(--warning\)/, 'The call-up name lost its amber ink.');
    assert.equal((css.match(/\.callUpName\b/g) ?? []).length, 1, 'A second selector names .callUpName — three rows, one mark.');
    assert.doesNotMatch(css, /\.lineupCallUpMark\b/, 'The retired "Call-up" chip rule is back.');
  });

  for (const [what, rel, nameClass] of [
    ['the game-day board', CONSOLE, 'styles.callUpName'],
    ['the desktop batting order', EDITOR, 'styles.callUpName'],
    ['the phone\'s inning list', INNING_LIST, 'coach.callUpName'],
  ] as const) {
    it(`${what} inks the name and keeps the word for a screen reader only`, () => {
      const code = readCode(rel);
      assert.ok(code.includes(nameClass), `${what} no longer inks a call-up's name — a borrowed player reads as one of your own.`);
      assert.match(
        code, /className=\{(styles|coach)\.srOnly\}>, \{CALL_UP_LABEL\}<\/span>/,
        `${what} dropped the word from the accessible name. A sighted coach sees the amber; a screen-reader user has only the word.`,
      );
      assert.doesNotMatch(
        code, /className=\{(styles\.(gdWarn|lineupCallUpMark)|coach\.lineupCallUpMark)\}>\{CALL_UP_LABEL\}/,
        `${what} prints the word "Call-up" on the row again (owner, 2026-10-06: the coach knows).`,
      );
    });
  }
});
