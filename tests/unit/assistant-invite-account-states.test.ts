/**
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * **THE ASSISTANT-COACH INVITE PAGE HAS FOUR STATES, NOT TWO** — and the two it was missing are
 * the two a real invitee is most likely to land in.
 *
 * WHAT WENT WRONG, PRECISELY (owner-reported 2026-09-10). The accept screen asked exactly one
 * question — *are you signed in right now?* — and branched on it. So a returning assistant who was
 * merely signed OUT was handed a full "Set up your account" form (first name, last name, password)
 * for an email that already had an account, with "Sign in instead" as a footnote under the fold.
 * The form could not succeed: submitting it 409s on the signup call and bounces to /auth/login. The
 * flow was therefore *correct and unusable* — no duplicate account was ever created, the coach just
 * had to fill in the whole form to be told so.
 *
 * ⚠ **THE SECOND MISS WAS WORSE, AND IT WAS ALREADY IN THE PAYLOAD.** The preview endpoint returned
 * `signedInEmail` and the page ignored it. An invite is addressed to ONE email and the server
 * enforces that on accept (a forwarded link must never let a different signed-in user join a team
 * as staff) — so a coach signed in as somebody else was shown a confident green "Accept & join
 * team" that could only 403. A wrong-account dead end wearing a success button.
 *
 * WHY A GUARD RATHER THAN A COMMENT. Both missing states are *invisible in the happy path*: a
 * developer testing this page is signed in as the invited coach, sees the one-tap accept, and finds
 * nothing wrong. The states that were broken are exactly the ones nobody exercises by accident, so
 * a regression here would ship silently — as the original did.
 *
 * ⚠ IT SCANS CODE, NOT PROSE. The page and the route both explain themselves at length above, and
 * those explanations contain the very identifiers this guard looks for — a guard reading raw text
 * would pass on a file where the code had been deleted and the paragraph left behind.
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const PAGE = 'app/(consumer)/auth/accept-assistant-invite/page.tsx';
const ROUTE = 'app/api/auth/accept-assistant-invite/route.ts';
const LOOKUP = 'lib/auth-account-lookup.ts';

/** Comments stripped — this guard is about code. Line comments only when the line is nothing but
 *  a comment, so a `//` inside a string literal is never mistaken for one. */
function codeOnly(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .filter(l => !/^\s*\/\//.test(l))
    .join('\n');
}

const read = (p: string) => codeOnly(readFileSync(join(ROOT, p), 'utf8'));
const page = read(PAGE);
const route = read(ROUTE);
const lookup = read(LOOKUP);

test('the invite preview answers whether the INVITED email already has an account', () => {
  assert.match(route, /accountExists/, 'the preview must return accountExists — without it the page cannot offer sign-in up front');
  assert.match(
    route,
    /authAccountExistsForEmail\(invite\.invitedEmail\)/,
    'the existence check must read the email off the INVITE ROW, never from the query string — that is what keeps this from being an email-enumeration oracle',
  );
  assert.doesNotMatch(
    route,
    /authAccountExistsForEmail\(\s*(?:email|searchParams|url)/,
    'never check an email supplied by the caller here — a caller-supplied address turns this public endpoint into an enumeration oracle',
  );
});

test('the preview fails OPEN — a lookup failure degrades to the create-account form, it does not 500 an accept', () => {
  const guarded = /try\s*\{[\s\S]{0,200}?authAccountExistsForEmail[\s\S]{0,200}?\}\s*catch/;
  assert.match(route, guarded, 'the account lookup must be wrapped in try/catch so an auth-service blip cannot break invite acceptance');
});

test('the page renders a returning-coach state instead of an unusable create-account form', () => {
  assert.match(page, /accountExists/, 'the page must branch on accountExists');
  assert.match(
    page,
    /if\s*\(accountExists\)/,
    'there must be a dedicated signed-out-with-an-account branch that returns before the create-account form',
  );
  // The branch has to come BEFORE the create form, or it is unreachable.
  assert.ok(
    page.indexOf('if (accountExists)') < page.indexOf('createAccountAndAccept} className'),
    'the returning-coach branch must return before the create-account form renders',
  );
});

test('the page detects a signed-in coach whose email is not the invited one', () => {
  assert.match(page, /signedInEmail/, 'the page must read signedInEmail — the route has always sent it');
  assert.match(page, /signedInMismatch/, 'there must be an explicit wrong-account state');
  assert.ok(
    page.indexOf('if (signedInMismatch)') < page.indexOf('if (signedIn)'),
    'the mismatch branch must be tested BEFORE the plain signed-in branch, or the wrong account still gets the doomed accept button',
  );
  assert.match(
    page,
    /signedInEmail!\.trim\(\)\.toLowerCase\(\)\s*!==\s*invite\.invitedEmail\.trim\(\)\.toLowerCase\(\)/,
    'compare both addresses case-insensitively — invited_email is stored lowercased and a session email need not be',
  );
});

test('the returning-coach state offers no door it cannot open', () => {
  // The create-account form is hard-locked to the invited email, so "create a new account instead"
  // could only ever 409 — a dead end wearing a politer face. Password recovery is the real escape.
  assert.doesNotMatch(page, /Create a new account instead/, 'that escape can only 409 — the form is locked to the invited email');
  assert.match(page, /auth\/forgot-password/, 'a coach who cannot remember their password needs a way out of this screen');
});

test('there is ONE account-exists implementation, and it paginates', () => {
  assert.match(lookup, /for\s*\(let page = 1/, 'a single 1000-row page reports false for any account past row 1000 — it must paginate');
  assert.match(lookup, /if \(error\) throw error/, 'it must fail CLOSED: a swallowed error is indistinguishable from "no such account"');

  // No local re-implementations. The two former copies now import this one.
  const callers = [
    'lib/basic-coach-teams.ts',
    'app/api/auth/signup/route.ts',
    'app/api/auth/accept-assistant-invite/route.ts',
  ];
  for (const rel of callers) {
    const src = read(rel);
    assert.match(src, /from '(@\/lib|\.)\/auth-account-lookup'/, `${rel} must import the shared lookup`);
    assert.doesNotMatch(
      src,
      /async function auth\w*ExistsForEmail/,
      `${rel} must not carry its own copy — the weak single-page form is how this drifted in the first place`,
    );
  }
});
