// Board Ready trust close-out 11 (owner 2026-11-18): a parent whose email isn't confirmed, refused a family claim, is told to
// confirm it first — not "That didn't go through". The server already answers `email_unconfirmed` (lib/family-invitation.ts);
// this keeps the page saying it.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { FAMILY_INVITATION_WORDS } from '../../lib/family-invitation-words.ts';

test('the claim page names an unconfirmed email', () => {
  const words = FAMILY_INVITATION_WORDS.accept as unknown as Record<string, unknown>;
  assert.match(String(words.emailUnconfirmed), /^Confirm your email first\./);
  const page = readFileSync('app/(consumer)/family/claim/[token]/ClaimClient.tsx', 'utf8');
  assert.match(page, /if \(data\.error === 'email_unconfirmed'\) return setError\(W\.emailUnconfirmed\);/);
  const route = readFileSync('app/api/family/claim/[token]/route.ts', 'utf8');
  assert.match(route, /error: 'email_unconfirmed'/, 'the code the page keys on');
});
