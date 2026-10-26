#!/usr/bin/env node
/**
 * check-todo-size.mjs — TODO.md stays an index, not a diary.
 *
 * ⚠ WHY. By 2026-10-26 TODO.md had grown to 1.2 MB (~300,000 tokens, 959 edits in git). Status
 * paragraphs of up to 25,000 characters sat on single lines, repeating what the plan files and the
 * Owner QA Ledger already held. Every agent that ticked an item had to grep and slice a file too big
 * to Read, and each slice stayed in the conversation to be re-read on every later turn. It was cut
 * to a one-line-per-item index with the full text moved to docs/projects/archive/ (see TODO.md).
 *
 * ── Two thresholds ────────────────────────────────────────────────────────────
 * WARN (70 KB): prints a notice and exits 0 — time to move finished items to
 *   docs/projects/archive/TODO_COMPLETED_ARCHIVE.md and shorten any item that has grown a paragraph.
 * FAIL (250 KB): exits 1 — it has drifted back toward the problem this check exists for.
 * The warning is the working signal; the failure is only the backstop, set far enough out that it
 * cannot block ordinary work.
 */
import { statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const WARN_BYTES = 70 * 1024;
const FAIL_BYTES = 250 * 1024;

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const bytes = statSync(path.join(root, 'TODO.md')).size;
const kb = (n) => `${Math.round(n / 1024)} KB`;

if (bytes >= FAIL_BYTES) {
  console.error(`✗ TODO.md is ${kb(bytes)} (limit ${kb(FAIL_BYTES)}). Move finished items to docs/projects/archive/TODO_COMPLETED_ARCHIVE.md and cut long items to one line + a plan link.`);
  process.exit(1);
}
if (bytes >= WARN_BYTES) {
  console.warn(`⚠ TODO.md is ${kb(bytes)} (warns at ${kb(WARN_BYTES)}, fails at ${kb(FAIL_BYTES)}). Archive finished items and shorten long ones.`);
  process.exit(0);
}
console.log(`✓ TODO.md is ${kb(bytes)} — within budget.`);
