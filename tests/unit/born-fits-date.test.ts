import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { bornFitsDate, JAN_1 } from '../../lib/born-years.ts';

/** Club Tier 9b-1: a child's date of birth picks the division, read with the club's cut-off (lib/born-years.ts). */
describe('bornFitsDate', () => {
  it('January 1: "2017–2018" is Jan 1, 2017 through Dec 31, 2018', () => {
    const y = { from: 2017, to: 2018 };
    assert.equal(bornFitsDate(y, JAN_1, '2017-01-01'), true);
    assert.equal(bornFitsDate(y, JAN_1, '2018-12-31'), true);
    assert.equal(bornFitsDate(y, JAN_1, '2016-12-31'), false);
    assert.equal(bornFitsDate(y, JAN_1, '2019-01-01'), false);
  });
  it('September 1: "2017–2018" is Sep 1, 2017 through Aug 31, 2018', () => {
    const sep = { m: 9, d: 1 }, y = { from: 2017, to: 2018 };
    assert.equal(bornFitsDate(y, sep, '2017-09-01'), true);
    assert.equal(bornFitsDate(y, sep, '2018-08-31'), true);
    assert.equal(bornFitsDate(y, sep, '2017-08-31'), false);
    assert.equal(bornFitsDate(y, sep, '2018-09-01'), false);
  });
  it('an open side is no limit, and no years fits everyone', () => {
    assert.equal(bornFitsDate({ from: null, to: 2010 }, JAN_1, '1990-05-05'), true);
    assert.equal(bornFitsDate({ from: 2015, to: null }, JAN_1, '2024-05-05'), true);
    assert.equal(bornFitsDate({ from: null, to: null }, JAN_1, '2001-01-01'), true);
  });
});
