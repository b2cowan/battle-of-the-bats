/**
 * THE RULES SECTIONS TAKE NO BROWSER WRITES (Board Ready W2 fix B, the third part of the third access sweep's finding 2,
 * 2026-11-11). The sections (`rules`) and their points (`rule_items`) were written from the browser under policies that ask
 * only "member of the event's club": an assistant coach with no `post_rules` could rewrite or delete the public Rules page.
 * Pins: no browser client writes either table (the sibling guard `resources-bucket-server-only-guard` covers `resources` and
 * now these two names as well); the route asks the club and `post_rules` on all four verbs and the event of every row it
 * touches; its input rules are the screen's own; migration 466 stays.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync } from 'node:fs';
import path from 'node:path';
import { filesUnder, readCode, readSource } from './_source-code.ts';
import {
  RULE_POINT_MAX, RULE_TITLE_MAX, readNewPoints, readSavedPoints, readSectionFields,
} from '../../lib/rule-section-input.ts';

const REPO = path.join(import.meta.dirname, '..', '..');
const ROUTE = 'app/api/admin/rules/route.ts';

/** A browser-side client (anything but the service-role one) writing either table. */
const BROWSER_WRITE = /(?:authClient\(\)|\bclient|\bsupabase|\bsb)\s*\.from\(\s*['"`](?:rules|rule_items)['"`]\s*\)\s*\.(?:insert|update|upsert|delete)\b/;
export function filesWriting(files: Record<string, string>): string[] {
  return Object.entries(files).filter(([, code]) => BROWSER_WRITE.test(code)).map(([f]) => f);
}

/** A verb's text, from its export to the next one. */
export function verbText(code: string, verb: string): string {
  const starts = [...code.matchAll(/export const (POST|PUT|PATCH|DELETE)\b/g)].map(m => ({ verb: m[1], at: m.index as number }));
  const i = starts.findIndex(s => s.verb === verb);
  if (i < 0) throw new Error(`the route lost its ${verb}`);
  return code.slice(starts[i].at, i + 1 < starts.length ? starts[i + 1].at : code.length);
}

describe('no client writes the Rules sections', () => {
  const files: Record<string, string> = {};
  for (const dir of ['app', 'components', 'lib']) {
    for (const ext of ['.ts', '.tsx']) for (const f of filesUnder(dir, ext)) files[f] = readCode(f);
  }
  it('finds no browser-side insert, update or delete of rules or rule_items', () => {
    assert.deepEqual(filesWriting(files), []);
  });
  it('kill test: a browser write is caught, the service-role client and a read are not', () => {
    assert.deepEqual(filesWriting({ a: "await client.from('rule_items').insert(rows)" }), ['a']);
    assert.deepEqual(filesWriting({ a: "await authClient().from('rules').delete().eq('id', id)" }), ['a']);
    assert.deepEqual(filesWriting({ a: "await supabaseAdmin.from('rules').insert(row)" }), []);
    assert.deepEqual(filesWriting({ a: "await supabase.from('rules').select('*, rule_items(*)')" }), []);
  });
  it('the db helpers call the route', () => {
    assert.match(readCode('lib/db.ts'), /\/api\/admin\/rules\?orgSlug=/);
  });
  it('the screens pass the club on', () => {
    const rec = readCode('app/[orgSlug]/admin/tournaments/rules/RuleSectionRecord.tsx');
    assert.match(rec, /saveRuleSectionWhole\([\s\S]{0,400}orgSlug,\s*signal/);
    assert.match(rec, /deleteRuleSection\(section\.id,\s*orgSlug\)/);
    assert.match(rec, /\},\s*orgSlug\);/);
    const admin = readCode('app/[orgSlug]/admin/tournaments/rules/RulesAdmin.tsx');
    assert.match(admin, /saveRuleOrder\(next\.map\([^)]*\),\s*orgSlug\)/);
    assert.match(admin, /createRuleSection\([\s\S]{0,200}orgSlug\)/);
  });
});

describe('the sections route checks the club and the capability on every verb', () => {
  const code = readCode(ROUTE);
  it('admits only a club member with post_rules (one gate, used by all four verbs)', () => {
    assert.match(code, /getAuthContextWithScope\(\{[^}]*requireOrgSlug:\s*true/);
    assert.match(code, /hasCapability\([^)]*'post_rules'\)/);
    for (const v of ['POST', 'PUT', 'PATCH', 'DELETE']) assert.match(verbText(code, v), /await admit\(req\)/, `${v} calls the gate`);
  });
  it('every verb checks the event of every row it touches', () => {
    for (const v of ['POST', 'PUT', 'PATCH', 'DELETE']) assert.match(verbText(code, v), /eventAllowed\(/, `${v} checks the event`);
    assert.match(code, /scopeGuard\(ctx, tournamentId\) \?\? \(await requireTournamentInOrg\(ctx, tournamentId\)\)/);
  });
  it('a section’s divisions must be the same event’s', () => {
    assert.match(code, /from\('divisions'\)\.select\('id'\)\.eq\('tournament_id', tournamentId\)\.in\('id', divisionIds\)/);
    assert.match(verbText(code, 'POST'), /divisionsOfEvent\(/);
    // A saved section may name a division deleted since: dropped, not refused (else it can never be saved again).
    assert.match(verbText(code, 'PUT'), /keepEventDivisions\(/);
    assert.doesNotMatch(verbText(code, 'PUT'), /divisionsOfEvent\(/);
    assert.match(code, /kept\.length \? \{ ids: kept \} : bad\('Bad divisions'\)/);
  });
  it('a retry cannot race a save the client abandoned', () => {
    assert.match(verbText(code, 'PUT'), /req\.signal\.aborted/);
  });
  it('a saved section’s points are only ever touched inside that section', () => {
    const put = verbText(code, 'PUT');
    assert.match(put, /delete\(\)\.eq\('rule_id', id\)/);
    assert.match(put, /update\(\{ content: item\.content, display_order: order \}\)\.eq\('rule_id', id\)/);
  });
  it('kill test: a verb without the gate is caught', () => {
    assert.doesNotMatch(verbText(code, 'DELETE').replace('await admit(req)', ''), /await admit\(req\)/);
  });
});

describe('what a section may say', () => {
  it('a title, an icon the screen offers, and divisions', () => {
    assert.equal(readSectionFields({ title: ' Rules ', icon: 'Shield', divisionIds: null }).ok, true);
    assert.equal(readSectionFields({ title: 'x', icon: 'Shield', divisionIds: [] }).ok && (readSectionFields({ title: 'x', icon: 'Shield', divisionIds: [] }) as { value: { divisionIds: unknown } }).value.divisionIds, null);
    for (const bad of [
      { title: '', icon: 'Shield' }, { title: '  ', icon: 'Shield' }, { title: 'x'.repeat(RULE_TITLE_MAX + 1), icon: 'Shield' },
      { title: 'x', icon: 'NotAnIcon' }, { title: 'x', icon: 5 }, { title: 5, icon: 'Shield' },
      { title: 'x', icon: 'Shield', divisionIds: 'a' }, { title: 'x', icon: 'Shield', divisionIds: [1] }, { title: 'x', icon: 'Shield', divisionIds: ['a', 'a'] },
    ]) assert.equal(readSectionFields(bad).ok, false, JSON.stringify(bad));
  });
  it('an old section keeps the icon it already has', () => {
    assert.equal(readSectionFields({ title: 'x', icon: 'OldIcon' }).ok, false);
    assert.equal(readSectionFields({ title: 'x', icon: 'OldIcon' }, 'OldIcon').ok, true);
  });
  it('new points: words, in order, empties dropped', () => {
    assert.deepEqual(readNewPoints([' a ', '', 'b']), { ok: true, value: ['a', 'b'] });
    assert.deepEqual(readNewPoints(undefined), { ok: true, value: [] });
    assert.equal(readNewPoints(['x'.repeat(RULE_POINT_MAX + 1)]).ok, false);
    assert.equal(readNewPoints([1]).ok, false);
    assert.equal(readNewPoints('a').ok, false);
  });
  it('saved points: each with words and a key, keys unique', () => {
    assert.equal(readSavedPoints([{ id: null, key: 'k1', content: 'a' }, { id: 'abc', key: 'k2', content: 'b' }]).ok, true);
    assert.equal(readSavedPoints([]).ok, true);
    for (const bad of [
      [{ id: 'same', key: 'k1', content: 'a' }, { id: 'same', key: 'k2', content: 'b' }],
      [{ id: null, key: 'k', content: '' }], [{ id: null, key: '', content: 'a' }], [{ id: 5, key: 'k', content: 'a' }],
      [{ id: null, key: 'k', content: 'a' }, { id: null, key: 'k', content: 'b' }], 'nope', [null],
    ]) assert.equal(readSavedPoints(bad).ok, false, JSON.stringify(bad));
  });
});

describe('migration 466', () => {
  it('takes the write grants on both tables from signed-in accounts and leaves SELECT alone', () => {
    const f = readdirSync(path.join(REPO, 'supabase/migrations')).find(n => n.startsWith('466_'));
    assert.ok(f, 'migration 466 exists');
    const sql = readSource(`supabase/migrations/${f}`).replace(/--.*$/gm, '');
    assert.match(sql, /revoke insert, update, delete on public\.rules, public\.rule_items from authenticated/i);
    assert.doesNotMatch(sql, /revoke[^;]*\bselect\b/i);
  });
});
