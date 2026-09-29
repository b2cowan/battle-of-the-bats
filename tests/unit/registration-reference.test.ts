import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { matchesRegistrationReference, registrationReference } from '../../lib/utils.ts';

/**
 * A registration's reference — the number a family gets on the confirmation screen and in the
 * receipt email — has ONE shape and one home. The family's copy and the copy they quote it to must
 * agree character for character: until 2026-09-29 no club or coach screen showed a tryout's
 * reference, so a family quoting it could not be matched (owner, §249 walk). Now the applicant's
 * window shows it and check-in's search finds it, and every surface builds it through the helper.
 */
const ID = '01496e50-3c2a-4b7e-9f10-aa12bb34cc56';

describe('registrationReference', () => {
  it('is the first eight characters of the id, upper case', () => {
    assert.equal(registrationReference(ID), '01496E50');
  });
});

describe('matchesRegistrationReference', () => {
  it('finds a quoted reference, in any case, with or without a leading #', () => {
    assert.ok(matchesRegistrationReference(ID, '01496E50'));
    assert.ok(matchesRegistrationReference(ID, '01496e50'));
    assert.ok(matchesRegistrationReference(ID, ' #01496e50 '));
    assert.ok(matchesRegistrationReference(ID, '01496e'), 'six characters are enough');
  });

  it('never lands on a short name or bib search', () => {
    assert.ok(!matchesRegistrationReference(ID, '0149'), 'a bib-length search is not a reference');
    assert.ok(!matchesRegistrationReference(ID, ''));
    assert.ok(!matchesRegistrationReference(ID, '11111111'));
  });
});

describe('one home for the shape', () => {
  // A reference built by hand beside the helper is how the family's copy and the club's drift apart.
  const HAND_BUILT = /\.slice\(0,\s*8\)\.toUpperCase\(\)/;
  const walk = (dir: string): string[] => readdirSync(dir).flatMap(name => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return name === 'node_modules' ? [] : walk(path);
    return /\.(ts|tsx)$/.test(name) ? [path] : [];
  });

  it('no source file builds a reference by hand', () => {
    const offenders = ['app', 'components', 'lib']
      .flatMap(walk)
      .filter(path => !path.endsWith(join('lib', 'utils.ts')))
      .filter(path => HAND_BUILT.test(readFileSync(path, 'utf8')));
    assert.deepEqual(offenders, [], 'build the reference with registrationReference() from lib/utils');
  });
});
