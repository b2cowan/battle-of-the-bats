/**
 * ═════════════════════════════════════════════════════════════════════════════════════════════
 * THE RECORDS-OPENED CENSUS (Board Ready D1, owner ruling 2026-11-22; mig 521).
 *
 * The privacy policy, the Data Terms and the Security page say our staff's opening of a club, person, email, feedback or
 * early-access-lead record is recorded. That sentence is only true while every one of those five record pages writes its
 * row, and nothing else is promised. This guard pins the promise to the code:
 *
 *   1. EXACTLY FIVE doors call `recordOpened` — the club page, the person page, the sent-email window's route, the feedback
 *      record and the lead record — each with its own kind. A sixth caller, or a missing one, is a decision (and the words
 *      in the policy move with it), so it fails here.
 *   2. EACH WRITES AFTER IT KNOWS THE RECORD EXISTS: an address with no record writes no row.
 *   3. THE DATABASE AGREES: the table's allowed kinds are the type's kinds, in migration order.
 *   4. THE AUDIT SCREEN NAMES ALL FIVE.
 * ═════════════════════════════════════════════════════════════════════════════════════════════
 */
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { describe, it } from 'node:test';
import { readCode } from './_source-code.ts';

const REPO = path.join(import.meta.dirname, '..', '..');

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.(ts|tsx)$/.test(name)) out.push(path.relative(REPO, full).replace(/\\/g, '/'));
  }
  return out;
}

// Each door: its file, the kind it writes, and the statement that proves the record exists (the call must come after it).
const DOORS: Array<{ file: string; kind: string; exists: string }> = [
  { file: 'app/platform-admin/orgs/[id]/page.tsx', kind: 'club', exists: 'if (!org) notFound()' },
  { file: 'app/platform-admin/customer-users/[id]/page.tsx', kind: 'person', exists: 'if (!person) notFound()' },
  { file: 'app/api/platform-admin/sent-emails/[id]/route.ts', kind: 'email', exists: 'getSentEmail(' },
  { file: 'app/platform-admin/feedback/[id]/page.tsx', kind: 'feedback', exists: 'if (!fb) notFound()' },
  { file: 'app/platform-admin/early-access/[leadId]/page.tsx', kind: 'lead', exists: 'if (!data) notFound()' },
];

describe('the records-opened census', () => {
  it('exactly the five record doors call recordOpened, in app/ (lib holds only the writer)', () => {
    const callers = walk(path.join(REPO, 'app')).filter(f => readCode(f).includes('recordOpened(')).sort();
    assert.deepEqual(callers, DOORS.map(d => d.file).sort());
  });

  for (const d of DOORS) {
    it(`${d.kind}: one call, its own kind, written after the record is known to exist`, () => {
      const code = readCode(d.file);
      assert.equal(code.split('recordOpened(').length - 1, 1, d.file);
      assert.match(code, new RegExp(`recordOpened\\(\\{[^}]*kind: '${d.kind}'`), d.file);
      assert.ok(code.indexOf(d.exists) !== -1, `${d.file} lost its existence check (${d.exists})`);
      assert.ok(code.indexOf(d.exists) < code.indexOf('recordOpened('), `${d.file}: an address with no record must write no row`);
    });
  }

  it('the type, the table and the Audit log all name the same five kinds', () => {
    const kinds = ['club', 'person', 'email', 'feedback', 'lead'];
    assert.deepEqual(DOORS.map(d => d.kind), kinds);
    const type = readCode('lib/platform-record-opens.ts').match(/export type RecordKind = ([^;]+);/)?.[1] ?? '';
    assert.deepEqual([...type.matchAll(/'(\w+)'/g)].map(m => m[1]), kinds);
    const mig = readFileSync(path.join(REPO, 'supabase/migrations/521_the_records_opened_trail_learns_feedback_and_leads.sql'), 'utf8');
    const check = mig.match(/CHECK \(record_kind IN \(([^)]+)\)\)/)?.[1] ?? '';
    assert.deepEqual([...check.matchAll(/'(\w+)'/g)].map(m => m[1]), kinds);
    const audit = readCode('app/platform-admin/audit/RecordsOpened.tsx');
    for (const k of kinds) {
      if (k === 'person') continue; // the default arm of each chain
      assert.match(audit, new RegExp(`r\\.kind === '${k}'`), `the Audit log names a ${k} row`);
    }
  });
});
