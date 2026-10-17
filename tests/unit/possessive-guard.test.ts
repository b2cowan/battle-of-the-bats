/**
 * ⚖ ONE POSSESSIVE (owner ruling 2026-10-16): a name ending in "s" takes the apostrophe alone — "UAT Between
 * Seasons’", "Chris’" — and every other name takes "’s". Team, club and player names are typed by people, so the
 * ~200 hand-built `${name}’s` across the product printed "Seasons’s" wherever a name ended in "s". They were swept
 * onto `possessive()` in `lib/utils.ts`, the one place the product builds a possessive from a name.
 *
 * This file holds the rule and the sweep: the helper's output, one definition, and no hand-built possessive on a
 * substituted value anywhere in app/, components/ or lib/ (comments excepted).
 */
import assert from 'node:assert/strict';
import { readdirSync } from 'node:fs';
import path from 'node:path';
import { describe, it } from 'node:test';
import { readCode, readSource } from './_source-code.ts';
import { possessive } from '../../lib/utils.ts';

const REPO = path.join(import.meta.dirname, '..', '..');

function sourceFiles(): string[] {
  const out: string[] = [];
  const walk = (dir: string) => {
    for (const e of readdirSync(path.join(REPO, dir), { withFileTypes: true })) {
      const rel = `${dir}/${e.name}`;
      if (e.isDirectory()) { if (e.name !== 'node_modules') walk(rel); }
      else if (/\.(ts|tsx)$/.test(e.name) && !/\.test\.ts$/.test(e.name)) out.push(rel);
    }
  };
  ['app', 'components', 'lib'].forEach(walk);
  return out;
}

describe('the one possessive', () => {
  it('a name ending in "s" takes the apostrophe alone; every other name takes ’s', () => {
    assert.equal(possessive('UAT Between Seasons'), 'UAT Between Seasons’');
    assert.equal(possessive('Chris'), 'Chris’');
    assert.equal(possessive('U11 GIRLS'), 'U11 GIRLS’');
    assert.equal(possessive('13U AAA'), '13U AAA’s');
    assert.equal(possessive('Riverside U13'), 'Riverside U13’s');
    assert.equal(possessive('  Riverside Reds '), 'Riverside Reds’', 'a stray space never sits before the apostrophe');
    assert.doesNotThrow(() => possessive(undefined as unknown as string), 'a name that arrives missing never throws');
  });

  it('is defined once, in lib/utils.ts', () => {
    const copies = sourceFiles().filter(f => f !== 'lib/utils.ts'
      && /(function\s+possessive\s*\(|const\s+possessive\s*=)/.test(readCode(f)));
    assert.deepEqual(copies, [], 'a second possessive is a second spelling waiting to happen');
  });

  it('no screen, email or notice hand-builds a possessive on a name', () => {
    // A substituted value, then ’s — directly, or after the tag it sits in (`<strong>{name}</strong>’s`, `</Link>’s`).
    const handBuilt = /\{[^{}]{1,80}\}(?:<\/[A-Za-z][\w.]*>)?(?:’|'|&apos;|&rsquo;|&#39;)s\b/;
    const offenders: string[] = [];
    for (const f of sourceFiles()) {
      if (f === 'lib/utils.ts') continue;
      const raw = readSource(f).split('\n');
      for (const line of readCode(f).split('\n')) {
        if (!handBuilt.test(line)) continue;
        // The file's own line number where the stripped line can be found in it; otherwise the file alone.
        const at = raw.findIndex(l => l.includes(line.trim())) + 1;
        offenders.push(`${f}${at > 0 ? `:${at}` : ''}  ${line.trim().slice(0, 120)}`);
      }
    }
    assert.deepEqual(offenders, [], 'call possessive() from lib/utils.ts instead of writing ’s after a name');
  });
});
