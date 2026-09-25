/**
 * migration-refresh-gate.mjs — decides whether a finished tool call applied a migration, so the
 * PostToolUse hook (scripts/after-migration-refresh-hook.mjs) refreshes the schema snapshots only then.
 *
 * Why this exists: the hook used to trust Claude Code's `"if": "Bash(*apply-migration-api*)"`, and
 * that gate FAILS OPEN — any command containing a shell loop fired it, as did any command that merely
 * mentioned the script's name. It ran up to ~580 full dev+prod refreshes a day and pinned both
 * databases' CPU (docs/projects/active/DB_SNAPSHOT_REFRESH_LOAD_PLAN.md). `if` is kept in settings as a
 * cheap pre-filter only; this function is the gate. Because `if` fails open, it runs after EVERY loop
 * command in every session, so it must stay fast on any input.
 *
 * Both must hold:
 *   1. the command runs apply-migration-api.mjs through node, in the same shell segment (inside a
 *      loop is fine; spaces and any capitalisation in the path are fine — a second machine keeps the
 *      repo under `C:\Users\Robert Cowan\…`). A bare mention such as `git log -S apply-migration-api`
 *      does not match; a grep whose pattern quotes a whole `node …apply-migration-api.mjs` does, and
 *      that is what check 2 is for; and
 *   2. the migration really succeeded: either the call's output carries the script's RENDERED success
 *      line (the source says `to ${target}.`, so reading the script's own text cannot satisfy it), or
 *      the success STAMP exists. apply-migration-api.mjs writes that stamp on every success and the
 *      refresh consumes it. It covers output an agent trimmed (`| tail -3`) or redirected (`> log`),
 *      which hides the line. A migration run in the BACKGROUND still escapes: the hook fires when the
 *      command is launched, before the stamp exists. The stamp is picked up by the next apply's
 *      refresh; until then, refresh by hand.
 */

import os from 'os';
import path from 'path';
import crypto from 'crypto';

// Split into shell segments, then two plain searches per segment: linear on any command. The first
// single-regex form, `(?:--?[\w-]+(?:=\S+)?\s+)*`, could split `--flag` two ways per token and
// backtracked exponentially: 22 flags took 640 ms, and about 30 would stall an agent's tool call for
// the hook's full timeout. A lazy `node[^;&|]*?apply…` is only quadratic, but a command full of
// `node` words still makes it measurable, so neither is used.
const SEGMENT_BREAK = /[;&|\n]/;
const NODE = /\bnode(?:\.exe)?\b/i;
const APPLY_SCRIPT = /apply-migration-api\.mjs/i;
const APPLIED_OK = /✅ Migration applied successfully to (?:dev|prod)\./;

function invokesApply(command) {
  return command.split(SEGMENT_BREAK).some((segment) => {
    const at = segment.search(NODE);
    return at >= 0 && APPLY_SCRIPT.test(segment.slice(at));
  });
}

/** Per-checkout key shared by the hook's lock and the apply script's success stamp. */
export function checkoutKey(root) {
  return crypto.createHash('sha1').update(path.resolve(root).toLowerCase()).digest('hex').slice(0, 12);
}

/** Written by apply-migration-api.mjs on success, consumed by the snapshot refresh. */
export function appliedStampPath(root) {
  return path.join(os.tmpdir(), `fieldlogichq-migration-applied-${checkoutKey(root)}`);
}

function outputText(toolResponse) {
  if (toolResponse == null) return '';
  if (typeof toolResponse === 'string') return toolResponse;
  if (typeof toolResponse.stdout === 'string') return toolResponse.stdout;
  // An unfamiliar result shape (a different tool or a future version): search the whole thing
  // rather than silently never firing.
  return JSON.stringify(toolResponse);
}

/**
 * @param {{ tool_name?: string, tool_input?: { command?: string }, tool_response?: unknown }} payload
 * @param {{ appliedStamp?: boolean }} [state] whether the success stamp exists right now
 */
export function shouldRefreshSnapshots(payload, { appliedStamp = false } = {}) {
  const command = payload?.tool_input?.command;
  if (typeof command !== 'string' || !invokesApply(command)) return false;
  return appliedStamp || APPLIED_OK.test(outputText(payload.tool_response));
}
