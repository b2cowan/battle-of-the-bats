/**
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * **EVERY GAMES WRITER ASKS THE GUARD FIRST** (Public tournament Stage 9, A11, owner 2026-11-18).
 *
 * The game-order rule (`lib/game-order.ts`) and the overlap rule live in ONE server check,
 * `tournamentOverlapRefusal` (`lib/tournament-overlap-guard.ts`). Nothing at the database refuses
 * an out-of-order game — the owner accepted that scripts, the dev seed and the demo's own refresh
 * are not held (A11) — so what makes the rule "one place" in practice is this test: it lists every
 * `.from('games')` insert / update / upsert and every call of the three game RPCs under `app/` and
 * `lib/`, and fails unless each one
 *   1. sits in a handler (an `action === '…'` branch, or an exported route verb) that calls the
 *      guard BEFORE it, or
 *   2. is on `NOT_HELD` below, with its reason.
 * A new screen or route that writes games without the guard fails here. If it truly needs no
 * guard, add it to `NOT_HELD` with the reason, in the same commit — that line is the decision.
 *
 * ⚠ SCOPE: a source scan. A writer that reaches `games` through a variable table name, or a new
 * RPC that writes games, is invisible here; add its name to `GAME_RPCS` when one is written.
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

const ROOTS = ['app', 'lib'];
const GAME_RPCS = ['replace_division_playoff_games', 'replace_division_round_robin_games', 'bulk_reschedule_games'];
const GUARD_CALL = /\b(?:overlapRefused|tournamentOverlapRefusal|tournamentLengthOrderRefusal)\(/g;
/** Where a handler starts: an action branch of a multi-action route, an exported verb, or a top-level function. */
const HANDLER_START = /action === ['"][\w-]+['"]|^export (?:const|async function) (?:GET|POST|PATCH|PUT|DELETE)\b|^(?:export )?(?:async )?function \w+/gm;

/**
 * Writes that are not held, each with its reason. `file` is repo-relative with forward slashes; `match` is text inside
 * the write's statement (the 300 characters from `.from('games')`, or the RPC call).
 */
const NOT_HELD: { file: string; match: string; reason: string }[] = [
  { file: 'app/api/admin/games/route.ts', match: "insert(dropped.map", reason: 'A replace keeps a played game it drops as a CANCELLED copy: a cancelled game waits for nothing and holds nothing.' },
  { file: 'app/api/admin/games/route.ts', match: "update({ status: 'cancelled' })", reason: 'Cancel only takes a game out of the order; it can never put one out of order.' },
  { file: 'app/api/admin/tournaments/[tournamentId]/schedule/import/commit/route.ts', match: 'insert(createRecords)', reason: '`applyRows` is called only by POST, after the guard (asserted below).' },
  { file: 'app/api/admin/tournaments/[tournamentId]/schedule/import/commit/route.ts', match: 'buildTournamentScheduleGameUpdate', reason: 'As above: `applyRows`, after the guard in POST.' },
  { file: 'app/api/admin/venues/route.ts', match: '', reason: 'A venue renamed or removed rewrites the games\' venue words and ids only: no time, length or source.' },
  { file: 'app/api/admin/setup-tournament/route.ts', match: 'insert', reason: 'The new-event wizard\'s seeded schedule: a dev-tools flag only, never a customer door (Findings §2).' },
  { file: 'app/api/dev/seed/tournament/route.ts', match: '', reason: 'The dev seed is not held (A11).' },
  { file: 'lib/db.ts', match: 'insert(row)', reason: '`saveGame`: no callers (Findings §2).' },
  { file: 'lib/db.ts', match: 'update(updates)', reason: '`updateGame`: scores, submission and team fields; it can map a time but no caller passes one (Findings §2).' },
];

type Site = { file: string; line: number; at: number; text: string };

function filesUnder(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) { if (name !== 'node_modules') out.push(...filesUnder(p)); continue; }
    if (/\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name)) out.push(p);
  }
  return out;
}

const rel = (p: string) => relative(process.cwd(), p).split(sep).join('/');

function writeSites(src: string, file: string): Site[] {
  const sites: Site[] = [];
  const lineOf = (at: number) => src.slice(0, at).split('\n').length;
  for (const m of src.matchAll(/\.from\(\s*['"]games['"]\s*\)/g)) {
    const at = m.index!;
    // The statement: up to the next `.from(` or the end of the chain.
    let text = src.slice(at, at + 300);
    const next = text.indexOf('.from(', 6);
    if (next > 0) text = text.slice(0, next);
    const semi = text.indexOf(';');
    if (semi > 0) text = text.slice(0, semi);
    if (/\.(insert|update|upsert)\(/.test(text)) sites.push({ file, line: lineOf(at), at, text });
  }
  for (const m of src.matchAll(new RegExp(`\\.rpc\\(\\s*['"](${GAME_RPCS.join('|')})['"]`, 'g'))) {
    sites.push({ file, line: lineOf(m.index!), at: m.index!, text: src.slice(m.index!, m.index! + 120) });
  }
  return sites;
}

/** Whether the guard is called after the handler's start and before the write. */
function guardedBefore(src: string, at: number): boolean {
  let start = 0;
  for (const m of src.matchAll(HANDLER_START)) { if (m.index! < at) start = m.index!; else break; }
  for (const m of src.matchAll(GUARD_CALL)) if (m.index! > start && m.index! < at) return true;
  return false;
}

const all = ROOTS.flatMap(r => filesUnder(join(process.cwd(), r))).flatMap(p => {
  const src = readFileSync(p, 'utf8');
  return writeSites(src, rel(p)).map(s => ({ ...s, src }));
});

describe('every games writer asks the guard first (Stage 9, A11)', () => {
  it('finds the writers (the scan has not gone blind)', () => {
    const files = new Set(all.map(s => s.file));
    for (const f of ['app/api/admin/games/route.ts', 'app/api/admin/tournaments/[tournamentId]/schedule/import/commit/route.ts', 'lib/db.ts']) {
      assert.ok(files.has(f), `no games write found in ${f}: the scan has gone blind`);
    }
    assert.ok(all.some(s => s.text.includes('replace_division_playoff_games')), 'the playoff RPC call was not found');
  });

  it('each write is guarded before it, or not held with a reason', () => {
    const unguarded = all.filter(s => !guardedBefore(s.src, s.at) && !NOT_HELD.some(n => n.file === s.file && s.text.includes(n.match)));
    assert.deepEqual(unguarded.map(s => `${s.file}:${s.line}  ${s.text.replace(/\s+/g, ' ').slice(0, 90)}`), [],
      'A games write skips the guard. Call overlapRefused / tournamentOverlapRefusal before it, or add it to NOT_HELD with the reason.');
  });

  it('every NOT_HELD entry still names a write (no stale reasons)', () => {
    const stale = NOT_HELD.filter(n => !all.some(s => s.file === n.file && s.text.includes(n.match)));
    assert.deepEqual(stale.map(n => `${n.file} · ${n.match}`), []);
  });

  it('the import commit asks the guard before it applies its rows', () => {
    const src = readFileSync(join(process.cwd(), 'app/api/admin/tournaments/[tournamentId]/schedule/import/commit/route.ts'), 'utf8');
    const post = src.indexOf('export const POST');
    const guard = src.indexOf('tournamentOverlapRefusal(', post);
    const apply = src.indexOf('applyRows(', post);
    assert.ok(post > 0 && guard > post && apply > guard, 'POST must call tournamentOverlapRefusal before applyRows');
  });

  it('a default game length is judged before it is written (A8)', () => {
    for (const f of ['app/api/admin/divisions/route.ts', 'app/api/admin/tournaments/route.ts']) {
      assert.match(readFileSync(join(process.cwd(), f), 'utf8'), /tournamentLengthOrderRefusal\(/, f);
    }
  });
});
