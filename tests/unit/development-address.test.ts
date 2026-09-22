import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  parseDevelopmentAddress, safeReturnPath, playerDevelopmentHref, returnLabel,
  skillsAndGoalsHref, insightsDevelopmentHref, insightsTagFromAddress, parseSkillsAndGoalsSection, parseMetricEdit,
  parseInsightsDevelopmentAddress, developmentHandoutHref, developmentAddressTab, COVERAGE_FOCUS,
} from '../../lib/development-address.ts';
import { UNTAGGED_FILTER } from '../../lib/rep-drills.ts';

/**
 * Exact addresses (development lifecycle Phase 1, F09): the profile answers `?section=development`
 * and now also carries the VIEW (goals | results — Phase 2's other two are RETIRED, re-evaluation
 * stage 3 E1, and their addresses land on the home), the metric, the goal or the observation, the
 * archive fold, and a safe INTERNAL way back to the report that sent the coach. Insights keeps
 * `?section=` and gains its filter state on the same convention. Never a new mechanism; never a year.
 */

const base = '/uat-test-org/coaches/teams/T1';
const params = (q: string) => new URLSearchParams(q);

describe('the profile address', () => {
  it('reads view · metric · goal · return, and ignores what it does not know', () => {
    const a = parseDevelopmentAddress(params('section=development&view=results&metric=M1&return=%2Fuat-test-org%2Fcoaches%2Fteams%2FT1%2Fdevelopment%3Fsection%3Dplayers%26metric%3DM1'), base);
    assert.deepEqual(a, { view: 'results', metricId: 'M1', goalId: null, observationId: null, archive: false, returnTo: `${base}/development?section=players&metric=M1` });
    const g = parseDevelopmentAddress(params('section=development&view=goals&goal=G9'), base);
    assert.deepEqual(g, { view: 'goals', metricId: null, goalId: 'G9', observationId: null, archive: false, returnTo: null });
    assert.deepEqual(parseDevelopmentAddress(params('view=history'), base).view, null, 'an unknown view is not a view');
    assert.deepEqual(parseDevelopmentAddress(params(''), base), { view: null, metricId: null, goalId: null, observationId: null, archive: false, returnTo: null });
  });

  // Re-evaluation stage 3 (E1/E2, 2026-09-15): the Observations and Previous-seasons VIEWS are gone;
  // every old link still lands — on the goal, on the Notes tab, or on the fold.
  it('a retired view lands on the home: the goal when one is named, the Notes tab otherwise, the fold for the archive', () => {
    const onGoal = parseDevelopmentAddress(params('section=development&view=observations&goal=G9'), base);
    assert.deepEqual([onGoal.view, onGoal.goalId], ['goals', 'G9'], 'an observation link that named its goal opens the goal (its history is the door)');
    assert.equal(developmentAddressTab(params('section=development&view=observations&goal=G9')), null, 'and stays on Skills & Goals');
    const bare = parseDevelopmentAddress(params('section=development&view=observations&metric=S1'), base);
    assert.equal(bare.view, null);
    assert.equal(developmentAddressTab(params('section=development&view=observations&metric=S1')), 'notes', 'a bare observations link is the Notes tab — the observation’s home');
    assert.equal(developmentAddressTab(params('section=development&view=results')), null);
    assert.equal(developmentAddressTab(params('view=observations')), null, 'only a development address');
    const arch = parseDevelopmentAddress(params('section=development&view=archive'), base);
    assert.deepEqual([arch.view, arch.archive], [null, true], 'the old archive view opens the fold at the tab’s foot');
    const obs = parseDevelopmentAddress(params('section=development&view=goals&goal=G9&observation=O1'), base);
    assert.deepEqual([obs.goalId, obs.observationId], ['G9', 'O1'], 'Player progress’s Open → names the observation whose sheet opens on arrival');
    assert.equal(playerDevelopmentHref(base, 'P1', { view: 'goals', goalId: 'G9', observationId: 'O1' }), `${base}/roster/P1?section=development&view=goals&goal=G9&observation=O1`);
  });

  it('only returns INSIDE this team’s portal — anything else is dropped, never followed', () => {
    assert.equal(safeReturnPath(`${base}/history?section=development`, base), `${base}/history?section=development`);
    // The team root itself — the Overview — is a way back (the lineup builder's card door, stage 3 · D3).
    assert.equal(safeReturnPath(base, base), base);
    assert.equal(safeReturnPath(`${base}x`, base), null, 'a prefix of the root is not the root');
    assert.equal(safeReturnPath('https://evil.example/x', base), null);
    assert.equal(safeReturnPath('//evil.example/x', base), null);
    assert.equal(safeReturnPath('/other-org/coaches/teams/T1/development', base), null);
    assert.equal(safeReturnPath(`${base}/../admin`, base), null);
    assert.equal(safeReturnPath(`${base}\\development`, base), null);
    assert.equal(safeReturnPath('', base), null);
    assert.equal(safeReturnPath(null, base), null);
  });

  it('builds the link the reports use, and the label the way back wears', () => {
    // An old Players-tab address is still a safe internal path — it lands on the hub's Overview (stage 4, G1).
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
  it('names the lineup builder\'s three doors by where they go (stage 3 · D3)', () => {
    assert.equal(returnLabel(`${base}/schedule?event=ev1&tab=lineup`, base), 'The game');
    assert.equal(returnLabel(`${base}/schedule`, base), null, 'the Schedule without a game is not "the game"');
    assert.equal(returnLabel(`${base}/game/ev1`, base), 'Game day');
    assert.equal(returnLabel(base, base), 'Overview');
    assert.equal(returnLabel(`${base}/gamex`, base), null, 'a prefix is not a route');
  });

  it('never carries a year — the look-back layer is the closed-season page, not a parameter', () => {
    const href = playerDevelopmentHref(base, 'P1', { view: 'results', metricId: 'M1', returnTo: `${base}/development?year=2025` });
    assert.doesNotMatch(decodeURIComponent(href), /year=/);
  });
});

describe('the workspace and Insights addresses', () => {
  it('Skills & Goals is three sections on ?section= — the overview is the bare address; the Players tab is gone (stage 4, G1)', () => {
    assert.equal(skillsAndGoalsHref(base, 'sessions'), `${base}/development?section=sessions`);
    assert.equal(skillsAndGoalsHref(base, 'metrics'), `${base}/development?section=metrics`);
    // The roster table has ONE home — Insights → Coverage — and its first Show choice rides `metric=focus`, one spelling.
    assert.equal(COVERAGE_FOCUS, 'focus');
    assert.equal(insightsDevelopmentHref(base, { metricId: COVERAGE_FOCUS }), `${base}/history?section=development&metric=focus`);
    assert.equal(parseInsightsDevelopmentAddress(new URLSearchParams('metric=focus')).metricId, COVERAGE_FOCUS);
    // A metric's definition is a sheet over whichever section is on screen (stage 1): `edit=new` defines, an id edits.
    assert.equal(skillsAndGoalsHref(base, 'metrics', { edit: 'new' }), `${base}/development?section=metrics&edit=new`);
    assert.equal(skillsAndGoalsHref(base, 'overview', { edit: 'M1' }), `${base}/development?edit=M1`);
    assert.equal(parseMetricEdit('new'), 'new');
    assert.equal(parseMetricEdit('M1'), 'M1');
    assert.equal(parseMetricEdit('../x'), null);
    assert.equal(parseMetricEdit(null), null);
    // Stage 0 (2026-09-14): the overview is the landing and the bare address — never `?section=overview`.
    assert.equal(skillsAndGoalsHref(base, 'overview'), `${base}/development`);
    assert.equal(parseSkillsAndGoalsSection('players'), 'overview', 'the retired Players address lands on the Overview');
    assert.equal(parseSkillsAndGoalsSection('sessions'), 'sessions');
    assert.equal(parseSkillsAndGoalsSection('overview'), 'overview');
    assert.equal(parseSkillsAndGoalsSection('board'), 'overview', 'an unknown section lands on the overview');
    assert.equal(parseSkillsAndGoalsSection(null), 'overview');
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
    // Team progress (T1/T2, 2026-09-16): the fourth report rides the same address and carries nothing else.
    assert.equal(insightsDevelopmentHref(base, { report: 'team' }), `${base}/history?section=development&report=team`);
    assert.equal(parseInsightsDevelopmentAddress(new URLSearchParams('report=team')).report, 'team');
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
