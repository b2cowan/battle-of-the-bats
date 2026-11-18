// Board Ready trust close-out 3 (owner 2026-11-18): "Confirm — same player" is shown only to a coach who can see roster
// details, and the decision route refuses it from anyone else. "Not the same player" stays with the Development grant.
// (No returning-player pair sits on a dev tryout board, so the card's half is held here rather than by a walk step.)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('the card hides Confirm when the details are hidden; the other two buttons stay', () => {
  const card = readFileSync('components/coaches/ContinuityCompareCard.tsx', 'utf8');
  assert.match(card, /\{!row\.prior\.contactHidden && \(\s*<button[^>]*onClick=\{onConfirm\}>\s*Confirm — same player/);
  assert.match(card, /onClick=\{onReject\}>\s*Not the same player/);
  assert.match(card, /onClick=\{onDismiss\}>\s*Not sure yet/);
});

test('the route refuses a confirm without roster privacy, before any link is read; a reject is not asked', () => {
  const route = readFileSync('app/api/coaches/[orgSlug]/teams/[teamId]/development/continuity/[linkId]/route.ts', 'utf8');
  const gate = route.indexOf("if (action === 'confirmed') {\n    const noPii = denyUnless(Boolean(assignment.capabilities.rosterPii)");
  assert.ok(gate > 0, 'the confirm gate');
  assert.ok(gate < route.indexOf('getRepTeamContinuityLinks(teamId)'), 'refused before the links are read');
  // The scan sets contactHidden exactly when the coach has no roster privacy — the card's signal.
  const scan = readFileSync('app/api/coaches/[orgSlug]/teams/[teamId]/development/continuity/route.ts', 'utf8');
  assert.match(scan, /const seesContacts = Boolean\(assignment\.capabilities\.rosterPii\);/);
  assert.match(scan, /\.\.\.\(seesContacts \? \{\} : \{ contactHidden: true \}\)/);
});
