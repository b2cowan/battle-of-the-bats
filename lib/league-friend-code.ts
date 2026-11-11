/**
 * THE FRIEND CODE (Board Ready Stage 1, drawing tab 2; owner ruling A10, 2026-11-10). One code per child sign-up:
 * six characters shown 3 + 3 ("K7M 4QP"), with no 0, O, 1 or I so it reads aloud and copies by hand without doubt.
 * The sixth character is a CHECK LETTER worked out from the first five, so the sign-up form catches a typo with no
 * lookup at all — the form never asks the server whether a code exists, because that answer would tell an anonymous
 * visitor a child is registered with the club.
 *
 * The check: the five data characters take their place in a 32-symbol alphabet, a weighted sum (weights 1..5) is
 * taken mod 23, and the result picks one of 23 letters. 23 is prime and larger than every weight, so any single
 * changed character, and any swap of two neighbours, is caught unless the two symbols sit exactly 23 apart in the
 * alphabet (roughly one typo in fifty). A mistyped check letter itself is always caught when it becomes a digit or
 * the one letter the check never uses (Z).
 *
 * Pure: no database, no randomness source of its own (the caller passes one), so it runs the same on the form and
 * on the server.
 */

/** 32 symbols: 2–9 and A–Z without I and O. */
export const FRIEND_CODE_ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
/** 23 check letters: A–Z without I, O and Z. */
const CHECK_LETTERS = 'ABCDEFGHJKLMNPQRSTUVWXY';

function checkLetter(data: string): string {
  let sum = 0;
  for (let i = 0; i < 5; i++) sum += (i + 1) * FRIEND_CODE_ALPHABET.indexOf(data[i]);
  return CHECK_LETTERS[sum % 23];
}

/** A new code from a random source returning [0, 1) (Math.random on the server is fine: a code is not a secret). */
export function makeFriendCode(random: () => number = Math.random): string {
  let data = '';
  for (let i = 0; i < 5; i++) data += FRIEND_CODE_ALPHABET[Math.floor(random() * FRIEND_CODE_ALPHABET.length)];
  return data + checkLetter(data);
}

/** What a family typed, upper-cased with spaces and hyphens taken out ("k7m-4qp" → "K7M4QP"). */
export function cleanFriendCode(typed: string): string {
  return typed.toUpperCase().replace(/[\s-]/g, '');
}

/** Is it a well-formed code with a matching check letter? */
export function isFriendCode(typed: string): boolean {
  const c = cleanFriendCode(typed);
  if (c.length !== 6) return false;
  for (let i = 0; i < 5; i++) if (!FRIEND_CODE_ALPHABET.includes(c[i])) return false;
  return c[5] === checkLetter(c);
}

/** "K7M4QP" → "K7M 4QP" (how a code is always shown). */
export function showFriendCode(code: string): string {
  const c = cleanFriendCode(code);
  return c.length === 6 ? `${c.slice(0, 3)} ${c.slice(3)}` : c;
}
