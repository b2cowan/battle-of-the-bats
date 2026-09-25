/**
 * migration-refresh-gate.mjs — decides whether a finished tool call applied a migration, so the
 * PostToolUse hook (scripts/after-migration-refresh-hook.mjs) refreshes the schema snapshots only then.
 *
 * Why this exists: the hook used to trust Claude Code's `"if": "Bash(*apply-migration-api*)"`, and
 * that gate FAILS OPEN — any command containing a shell loop fired it, as did any command that merely
 * mentioned the script's name. It ran up to ~580 full dev+prod refreshes a day and pinned both
 * databases' CPU (docs/projects/active/DB_SNAPSHOT_REFRESH_LOAD_PLAN.md). `if` is kept in settings as a
 * cheap pre-filter only; this function is the gate.
 *
 * Both must hold:
 *   1. the command runs apply-migration-api.mjs through node (inside a loop is fine). A bare mention
 *      such as `git log -S apply-migration-api` does not match; a grep whose pattern quotes a whole
 *      `node scripts/apply-migration-api.mjs` line does, and that is what check 2 is for; and
 *   2. the call's output carries the script's RENDERED success line. The source says
 *      `to ${target}.`, so reading the script's own text can never satisfy it.
 */

const INVOKES_APPLY = /\bnode(?:\.exe)?["']?\s+(?:--?[\w-]+(?:=\S+)?\s+)*["']?(?:[^\s"';&|<>]*[\\/])?scripts[\\/]apply-migration-api\.mjs\b/;
const APPLIED_OK = /✅ Migration applied successfully to (?:dev|prod)\./;

function outputText(toolResponse) {
  if (toolResponse == null) return '';
  if (typeof toolResponse === 'string') return toolResponse;
  if (typeof toolResponse.stdout === 'string') return toolResponse.stdout;
  // An unfamiliar result shape (a different tool or a future version): search the whole thing
  // rather than silently never firing.
  return JSON.stringify(toolResponse);
}

/** @param {{ tool_name?: string, tool_input?: { command?: string }, tool_response?: unknown }} payload */
export function shouldRefreshSnapshots(payload) {
  const command = payload?.tool_input?.command;
  if (typeof command !== 'string' || !INVOKES_APPLY.test(command)) return false;
  return APPLIED_OK.test(outputText(payload.tool_response));
}
