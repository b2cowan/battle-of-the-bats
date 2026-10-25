import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { readCode } from './_source-code.ts';

/**
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * EVERY DATE AND TIME IS PICKED IN THE SHARED FIELDS (owner ruling 2026-10-25, all four asks — drawing
 * https://claude.ai/artifact/Rvo2a36tonsHRyEeeWf4Cp, plan docs/projects/active/THEMED_DATE_PICKER_PLAN.md).
 *
 * On a desk the browser's own calendar and clock spoke the operating system's language (its font, its blue links, a
 * Sunday-first week, "yyyy-mm-dd", a second spelling of the clock). `DateInput`, `TimeInput` and `DateTimeInput` are
 * the only places a native `type="date"`, `type="time"` or `type="datetime-local"` may be written — they render it
 * themselves on touch. Anywhere else fails here: use the shared field (its value contract is the native one, so a
 * caller's save path does not change).
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 */

const ROOT = process.cwd();
const rel = (p: string) => path.relative(ROOT, p).split(path.sep).join('/');

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = path.join(dir, name);
    if (name === 'node_modules' || name === '.next') continue;
    if (statSync(p).isDirectory()) walk(p, out);
    else if (name.endsWith('.tsx')) out.push(rel(p));
  }
  return out;
}

const SHARED_FIELDS = new Set([
  'components/shared/DateInput.tsx',
  'components/shared/TimeInput.tsx',
  'components/shared/DateTimeInput.tsx',
]);

/** A literal native type, or a type expression that can evaluate to one (`type={kind === 'date' ? 'date' : 'text'}`). */
const NATIVE = /\btype\s*=\s*(?:["'](date|time|datetime-local)["']|\{[^}]*["'](date|time|datetime-local)["'][^}]*\})/g;

describe('native date/time controls', () => {
  it('appear only inside the shared date and time fields', () => {
    const offenders: string[] = [];
    for (const file of [...walk(path.join(ROOT, 'app')), ...walk(path.join(ROOT, 'components'))]) {
      if (SHARED_FIELDS.has(file)) continue;
      const code = readCode(file);
      for (const m of code.matchAll(NATIVE)) {
        const line = code.slice(0, m.index).split('\n').length;
        offenders.push(`${file}:${line} — type="${m[1] ?? m[2]}"`);
      }
    }
    assert.deepEqual(offenders, [], `Use DateInput / TimeInput / DateTimeInput from components/shared instead:\n${offenders.join('\n')}`);
  });

  it('the shared fields still hand touch the native control', () => {
    for (const [file, type] of [
      ['components/shared/DateInput.tsx', 'date'],
      ['components/shared/TimeInput.tsx', 'time'],
      ['components/shared/DateTimeInput.tsx', 'datetime-local'],
    ] as const) {
      assert.ok(readCode(file).includes(`type="${type}"`), `${file} lost its native ${type} control for touch`);
    }
  });
});
