import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { FRIEND_CODE_ALPHABET, cleanFriendCode, isFriendCode, makeFriendCode, showFriendCode } from '../../lib/league-friend-code.ts';

/**
 * BOARD READY STAGE 1 · THE FRIEND CODE (drawing tab 2; rulings A10). Six characters, 3 + 3, no 0/O/1/I, the sixth a
 * check letter so the form catches a typo with no lookup. The SQL generator in mig 461 must make the same codes.
 */

const seq = (vals: number[]) => { let i = 0; return () => vals[i++ % vals.length]; };

describe('friend code', () => {
  it('uses 32 symbols and never 0, O, 1 or I', () => {
    assert.equal(FRIEND_CODE_ALPHABET.length, 32);
    for (const bad of ['0', 'O', '1', 'I']) assert.ok(!FRIEND_CODE_ALPHABET.includes(bad), bad);
    for (let n = 0; n < 500; n++) assert.match(makeFriendCode(), /^[2-9A-HJ-NP-Z]{5}[A-HJ-NP-Y]$/);
  });

  it('every code it makes passes its own check', () => {
    for (let n = 0; n < 2000; n++) assert.ok(isFriendCode(makeFriendCode()));
  });

  it('pins the check letter (the SQL twin computes the same)', () => {
    // data "22222" → indices all 0 → sum 0 → "A"
    assert.equal(makeFriendCode(seq([0])), '22222A');
    // data "33333" → indices 1 → sum 1+2+3+4+5 = 15 → CHECK_LETTERS[15] = "R"
    assert.equal(makeFriendCode(seq([1 / 32])), '33333R');
  });

  it('catches every single changed character in a sample, bar the 23-apart pairs', () => {
    let missed = 0, total = 0;
    for (let n = 0; n < 300; n++) {
      const code = makeFriendCode();
      for (let p = 0; p < 6; p++) for (const ch of FRIEND_CODE_ALPHABET) {
        if (ch === code[p]) continue;
        total++;
        if (isFriendCode(code.slice(0, p) + ch + code.slice(p + 1))) missed++;
      }
    }
    assert.ok(missed / total < 0.03, `missed ${missed} of ${total}`);
  });

  it('reads what a family types: spaces, hyphens, lower case', () => {
    const code = makeFriendCode();
    assert.equal(cleanFriendCode(` ${code.slice(0, 3).toLowerCase()}-${code.slice(3)} `), code);
    assert.ok(isFriendCode(showFriendCode(code)));
    assert.equal(showFriendCode(code), `${code.slice(0, 3)} ${code.slice(3)}`);
    assert.ok(!isFriendCode('K7M4Q'));
    assert.ok(!isFriendCode('K7M4QPP'));
    assert.ok(!isFriendCode('O7M4QP'));
  });

  it('the migration generator uses the same alphabet, check letters, weights and modulus', () => {
    const sql = readFileSync('supabase/migrations/461_a_child_can_name_a_friend.sql', 'utf8');
    assert.match(sql, /v_alpha\s+constant text := '23456789ABCDEFGHJKLMNPQRSTUVWXYZ'/);
    assert.match(sql, /v_checks constant text := 'ABCDEFGHJKLMNPQRSTUVWXY'/);
    assert.match(sql, /v_sum := v_sum \+ i \* v_idx;/);
    assert.match(sql, /substr\(v_checks, \(v_sum % 23\) \+ 1, 1\)/);
  });
});
