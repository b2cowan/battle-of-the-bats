import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';

/**
 * A DATABASE WRITE THAT IS NEVER SENT (found 2026-10-08).
 *
 * A Supabase query builder sends its request only when something calls `.then()` — which is what
 * `await` does. `void supabaseAdmin.from('org_audit_log').insert(…)` builds the request and drops it:
 * eight member-change audit writes were written that way, and no organization's Members › Audit log
 * ever received an invite, removal, role change or access change. Nothing errors and nothing logs;
 * the row simply never exists.
 *
 * So the shape is refused outright: `void <client>.from(` / `.rpc(` / `.schema(` / `.storage`. Await
 * the write (in a try/catch when it must not fail the request), or use `writeOrgAudit` (lib/org-audit.ts)
 * for the audit log. A truly detached write would also be dropped when the server freezes the worker
 * after the response, so there is no "fire-and-forget" form to allow here.
 */

const ROOTS = ['app', 'lib', 'components'];
const UNSENT = /\bvoid\s+[\w.]+\s*\.\s*(from|rpc|schema|storage)\b\s*[(.]/g;

function sourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name.startsWith('.')) continue;
    const path = join(dir, name);
    if (statSync(path).isDirectory()) out.push(...sourceFiles(path));
    else if (/\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name)) out.push(path);
  }
  return out;
}

/**
 * The source with comments blanked, so a comment that DESCRIBES the trap is not mistaken for it. A line
 * comment counts only after the line's start or whitespace — a URL in a string ('https://…') must not
 * blank the rest of its line and hide a write after it.
 */
function withoutComments(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, m => m.replace(/[^\n]/g, ' '))
    .replace(/(^|\s)\/\/[^\n]*/gm, '$1');
}

describe('no database write is built and thrown away', () => {
  it('nothing writes `void <client>.from(…)` — the request would never be sent', () => {
    const offenders: string[] = [];
    for (const root of ROOTS) {
      for (const file of sourceFiles(root)) {
        const src = withoutComments(readFileSync(file, 'utf8'));
        for (const m of src.matchAll(UNSENT)) {
          const line = src.slice(0, m.index).split('\n').length;
          offenders.push(`${file}:${line}  ${m[0]}`);
        }
      }
    }
    assert.deepEqual(offenders, [], `await these writes (or use writeOrgAudit):\n${offenders.join('\n')}`);
  });

  it('the guard still recognises the shape it was written for', () => {
    const sample = "  void supabaseAdmin.from('org_audit_log').insert({ action: 'x' });\n  void db\n    .rpc('fold');";
    assert.equal([...sample.matchAll(UNSENT)].length, 2);
    assert.equal([...withoutComments('// void supabaseAdmin.from(x)').matchAll(UNSENT)].length, 0);
    // A URL earlier on the line is not a comment: the write after it is still caught.
    assert.equal([...withoutComments("const u = 'https://x'; void db.from('t').insert({});").matchAll(UNSENT)].length, 1);
  });
});
