import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  practicePlansHref, planTemplateHref, circuitHref, parsePracticePlansSection, PRACTICE_PLANS_SECTIONS,
} from '../../lib/practice-plans-address.ts';

/**
 * One room, four tabs (practices re-evaluation stage 0 · Arrive, D5; stage 4, L9): the Practice
 * plans hub's addresses. The bare address IS the Practices landing; the three libraries are
 * `?section=`; the template and circuit editors are drill-ins of their own. Never a year.
 */
const base = '/uat-test-org/coaches/teams/3127a094';

describe('practicePlansHref', () => {
  it('the landing is the bare address — never ?section=practices', () => {
    assert.equal(practicePlansHref(base), `${base}/practice`);
    assert.equal(practicePlansHref(base, 'practices'), `${base}/practice`);
  });
  it('the three libraries are tabs on ?section=', () => {
    assert.equal(practicePlansHref(base, 'templates'), `${base}/practice?section=templates`);
    assert.equal(practicePlansHref(base, 'circuits'), `${base}/practice?section=circuits`);
    assert.equal(practicePlansHref(base, 'drills'), `${base}/practice?section=drills`);
  });
  it('the tab order is the size ladder — a practice, a block, a station', () => {
    assert.deepEqual([...PRACTICE_PLANS_SECTIONS], ['practices', 'templates', 'circuits', 'drills']);
  });
  it('the template and circuit editors are pages under the room', () => {
    assert.equal(planTemplateHref(base, 'abc-123'), `${base}/practice/templates/abc-123`);
    assert.equal(circuitHref(base, 'abc-123'), `${base}/practice/circuits/abc-123`);
  });
  it('no address carries a year', () => {
    for (const s of PRACTICE_PLANS_SECTIONS) assert.doesNotMatch(practicePlansHref(base, s), /year=/);
  });
});

describe('parsePracticePlansSection', () => {
  it('reads the three tabs and lands everything else on Practices', () => {
    assert.equal(parsePracticePlansSection('templates'), 'templates');
    assert.equal(parsePracticePlansSection('circuits'), 'circuits');
    assert.equal(parsePracticePlansSection('drills'), 'drills');
    assert.equal(parsePracticePlansSection('practices'), 'practices');
    assert.equal(parsePracticePlansSection(null), 'practices');
    assert.equal(parsePracticePlansSection(undefined), 'practices');
    assert.equal(parsePracticePlansSection('overview'), 'practices', 'no overview tab (D8)');
    assert.equal(parsePracticePlansSection('Templates'), 'practices', 'case-sensitive, like every other hub');
    for (const s of PRACTICE_PLANS_SECTIONS) assert.equal(parsePracticePlansSection(s), s, 'the parser reads its own list');
  });
});
