import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  parseDevelopmentAddress, safeReturnPath, playerDevelopmentHref, returnLabel,
  skillsAndGoalsHref, insightsDevelopmentHref, insightsTagFromAddress, parseSkillsAndGoalsSection,
  parseInsightsDevelopmentAddress, developmentHandoutHref,
} from '../../lib/development-address.ts';
import { UNTAGGED_FILTER } from '../../lib/rep-drills.ts';

/**
 * Exact addresses (development lifecycle Phase 1, F09): the profile answers `?section=development`
 * and now also carries the VIEW (goals | results — the other two are Phase 2), the metric or the
 * goal, and a safe INTERNAL way back to the report that sent the coach. Insights keeps `?section=`
 * and gains its filter state on the same convention. Never a new mechanism; never a year.
 */

const base = '/uat-test-org/coaches/teams/T1';
const params = (q: string) => new URLSearchParams(q);

describe('the profile address', () => {
  it('reads view · metric · goal · return, and ignores what it does not know', () => {
    const a = parseDevelopmentAddress(params('section=development&view=results&metric=M1&return=%2Fuat-test-org%2Fcoaches%2Fteams%2FT1%2Fdevelopment%3Fsection%3Dplayers%26metric%3DM1'), base);
    assert.deepEqual(a, { view: 'results', metricId: 'M1', goalId: null, returnTo: `${base}/development?section=players&metric=M1` });
    const g = parseDevelopmentAddress(params('section=development&view=goals&goal=G9'), base);
    assert.deepEqual(g, { view: 'goals', metricId: null, goalId: 'G9', returnTo: null });
    assert.deepEqual(parseDevelopmentAddress(params('view=observations'), base).view, 'observations', 'Phase 2: the four views');
    assert.deepEqual(parseDevelopmentAddress(params('view=archive'), base).view, 'archive');
    assert.deepEqual(parseDevelopmentAddress(params('view=history'), base).view, null, 'an unknown view is not a view');
    assert.deepEqual(parseDevelopmentAddress(params(''), base), { view: null, metricId: null, goalId: null, returnTo: null });
  });

  it('only returns INSIDE this team’s portal — anything else is dropped, never followed', () => {
    assert.equal(safeReturnPath(`${base}/history?section=development`, base), `${base}/history?section=development`);
    assert.equal(safeReturnPath('https://evil.example/x', base), null);
    assert.equal(safeReturnPath('//evil.example/x', base), null);
    assert.equal(safeReturnPath('/other-org/coaches/teams/T1/development', base), null);
    assert.equal(safeReturnPath(`${base}/../admin`, base), null);
    assert.equal(safeReturnPath(`${base}\\development`, base), null);
    assert.equal(safeReturnPath('', base), null);
    assert.equal(safeReturnPath(null, base), null);
  });

  it('builds the link the Players tab and Insights use, and the label the way back wears', () => {
    const from = `${base}/development?section=players&metric=M1`;
    assert.equal(
      playerDevelopmentHref(base, 'P1', { view: 'results', metricId: 'M1', returnTo: from }),
      `${base}/roster/P1?section=development&view=results&metric=M1&return=${encodeURIComponent(from)}`,
    );
    assert.equal(playerDevelopmentHref(base, 'P1', { view: 'goals' }), `${base}/roster/P1?section=development&view=goals`);
    assert.equal(playerDevelopmentHref(base, 'P1', {}), `${base}/roster/P1?section=development`);
    assert.equal(returnLabel(from, base), 'Skills & Goals');
    assert.equal(returnLabel(`${base}/history?section=development`, base), 'Insights');
    assert.equal(returnLabel(`${base}/roster`, base), null);
    assert.equal(returnLabel(`${base}/developmentx`, base), null, 'a prefix is not a route');
    assert.equal(returnLabel(`${base}/development`, base), 'Skills & Goals');
  });

  it('never carries a year — the look-back layer is the closed-season page, not a parameter', () => {
    const href = playerDevelopmentHref(base, 'P1', { view: 'results', metricId: 'M1', returnTo: `${base}/development?year=2025` });
    assert.doesNotMatch(decodeURIComponent(href), /year=/);
  });
});

describe('the workspace and Insights addresses', () => {
  it('Skills & Goals is three sections on ?section=, with the chosen metric on Players', () => {
    assert.equal(skillsAndGoalsHref(base, 'sessions'), `${base}/development?section=sessions`);
    assert.equal(skillsAndGoalsHref(base, 'players', { metric: 'M1' }), `${base}/development?section=players&metric=M1`);
    assert.equal(skillsAndGoalsHref(base, 'metrics'), `${base}/development?section=metrics`);
    assert.equal(parseSkillsAndGoalsSection('players'), 'players');
    assert.equal(parseSkillsAndGoalsSection('board'), 'sessions', 'an unknown section lands on the everyday one');
    assert.equal(parseSkillsAndGoalsSection(null), 'sessions');
  });
  it('Insights keeps ?section=development and carries the practice-review tag filter — the untagged sentinel spelled "none" on the wire, once', () => {
    assert.equal(insightsDevelopmentHref(base), `${base}/history?section=development`);
    assert.equal(insightsDevelopmentHref(base, { tag: 'TAG1' }), `${base}/history?section=development&tag=TAG1`);
    assert.equal(insightsDevelopmentHref(base, { tag: UNTAGGED_FILTER }), `${base}/history?section=development&tag=none`);
    assert.equal(insightsTagFromAddress('none'), UNTAGGED_FILTER);
    assert.equal(insightsTagFromAddress('TAG1'), 'TAG1');
    assert.equal(insightsTagFromAddress(null), null);
    assert.equal(insightsTagFromAddress('not a tag id!'), null);
  });
  it('the Report selector rides the same address — Coverage by saying nothing; the progress selectors only when set (Phase 3)', () => {
    assert.equal(insightsDevelopmentHref(base, { report: 'coverage' }), `${base}/history?section=development`);
    assert.equal(insightsDevelopmentHref(base, { report: 'practices', tag: 'TAG1' }), `${base}/history?section=development&report=practices&tag=TAG1`);
    assert.equal(
      insightsDevelopmentHref(base, { report: 'progress', playerId: 'P1', metricId: 'M1', show: 'average', compare: 'last-two' }),
      `${base}/history?section=development&report=progress&player=P1&metric=M1&show=average&compare=last-two`,
    );
    const a = parseInsightsDevelopmentAddress(new URLSearchParams('report=progress&player=P1&metric=M1&show=average&compare=last-two&tag=none'));
    assert.deepEqual(a, { tag: UNTAGGED_FILTER, report: 'progress', playerId: 'P1', metricId: 'M1', show: 'average', compare: 'last-two' });
    const b = parseInsightsDevelopmentAddress(new URLSearchParams('report=leaderboard&player=../x&show=best&compare=year'));
    assert.deepEqual(b, { tag: null, report: 'coverage', playerId: null, metricId: null, show: null, compare: null }, 'unknown values are dropped, never passed through');
    assert.equal(parseInsightsDevelopmentAddress(new URLSearchParams('')).report, 'coverage');
  });
  it('the handout preview is a page of its own under the record, carrying a SAFE way back only', () => {
    assert.equal(developmentHandoutHref(base, 'P1'), `${base}/roster/P1/development/handout`);
    assert.equal(
      developmentHandoutHref(base, 'P1', { returnTo: `${base}/roster/P1?section=development&view=results` }),
      `${base}/roster/P1/development/handout?return=${encodeURIComponent(`${base}/roster/P1?section=development&view=results`)}`,
    );
    assert.equal(developmentHandoutHref(base, 'P1', { returnTo: 'https://evil.example/x' }), `${base}/roster/P1/development/handout`);
    assert.equal(developmentHandoutHref(base, 'P1', { returnTo: `${base}/history?section=development&year=2025` }), `${base}/roster/P1/development/handout`, 'never a year');
  });
});
