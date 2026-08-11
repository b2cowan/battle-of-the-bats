/**
 * Chunk F — the two pure resolvers behind "which season am I looking at, and is it a record".
 *
 * These are worth testing in isolation because the whole chunk's correctness reduces to them:
 * every page's write flags, every nav door set, and every fetch's `?year=` come from here. The
 * bug they exist to prevent is the one the plan of record got wrong — deciding "read-only" from
 * the TEAM's state rather than the SEASON's, which leaves a rolled-forward team's archive
 * quietly writable.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { resolveSeasonView, resolveCoachSeasonPage } from '../../lib/coach-season-view.ts';
import { resolveCoachCapabilities } from '../../lib/coach-capabilities.ts';

const HEAD = resolveCoachCapabilities('head_coach', null);
const ASSISTANT_NO_MONEY = resolveCoachCapabilities('assistant_coach', null);
const ASSISTANT_WITH_MONEY = resolveCoachCapabilities('assistant_coach', { money: 'read' });

const TEAM = 'team-1';
const season = (id: string, name: string, status: 'live' | 'complete', capabilities = HEAD) => ({
  teamId: TEAM, programYearId: id, programYearName: name,
  programYearYear: Number(name), status, capabilities,
  coachRole: 'head_coach' as const,
});

/** A rolled-forward team: 2026 live, 2025 + 2024 complete. The case the ledger never named. */
const ROLLED_FORWARD = [
  season('y2026', '2026', 'live'),
  season('y2025', '2025', 'complete'),
  season('y2024', '2024', 'complete'),
];

describe('resolveSeasonView', () => {
  it('defaults to the live season when no year is asked for', () => {
    const v = resolveSeasonView(ROLLED_FORWARD, TEAM, null);
    assert.equal(v.current?.programYearId, 'y2026');
    assert.equal(v.isReadOnly, false);
    assert.equal(v.query, '', 'a live season adds nothing to links or fetches');
  });

  it('a rolled-forward team viewing a past year IS read-only', () => {
    const v = resolveSeasonView(ROLLED_FORWARD, TEAM, 'y2025');
    assert.equal(v.current?.programYearId, 'y2025');
    assert.equal(v.isReadOnly, true,
      'the team has a LIVE season — read-only must come from the season, not the team');
    assert.equal(v.query, '?year=y2025');
  });

  it('a team with no live season resolves to its newest closed one', () => {
    const closedOnly = ROLLED_FORWARD.filter(s => s.status === 'complete');
    const v = resolveSeasonView(closedOnly, TEAM, null);
    assert.equal(v.current?.programYearId, 'y2025');
    assert.equal(v.isReadOnly, true);
  });

  it('an unknown or foreign year falls back to live rather than an empty archive', () => {
    const v = resolveSeasonView(ROLLED_FORWARD, TEAM, 'y1999-from-another-team');
    assert.equal(v.current?.programYearId, 'y2026');
    assert.equal(v.isReadOnly, false);
  });

  it('only offers seasons of the team on screen', () => {
    const other = { ...season('other-y', '2025', 'complete'), teamId: 'team-2' };
    const v = resolveSeasonView([...ROLLED_FORWARD, other], TEAM, null);
    assert.deepEqual(v.options.map(o => o.programYearId), ['y2026', 'y2025', 'y2024']);
  });

  it('hides the switcher when there is only one season', () => {
    assert.equal(resolveSeasonView([season('y1', '2026', 'live')], TEAM, null).hasChoice, false);
    assert.equal(resolveSeasonView(ROLLED_FORWARD, TEAM, null).hasChoice, true);
  });

  it('picks the NEWEST live season when a team holds a draft and an active year at once', () => {
    // Mid-rollover a team legitimately has both. The server resolves the most recent; if the
    // client picked the other one, the page header would name a season the data didn't come from.
    const draftNext = season('y2027', '2027', 'live');
    const activeNow = season('y2026', '2026', 'live');
    // Deliberately supplied oldest-first — the lookup has no ORDER BY, so arrival order is
    // arbitrary and must not decide this.
    const v = resolveSeasonView([activeNow, draftNext, season('y2025', '2025', 'complete')], TEAM, null);
    assert.equal(v.current?.programYearId, 'y2027');
    assert.equal(v.isReadOnly, false);
  });

  it('has no season at all for a team the coach holds nothing on', () => {
    const v = resolveSeasonView(ROLLED_FORWARD, 'team-nope', null);
    assert.equal(v.current, null);
    assert.equal(v.isReadOnly, false);
  });
});

describe('resolveCoachSeasonPage — governing rule 1', () => {
  const liveAssignment = {
    teamId: TEAM, teamName: 'Riverdale Rays 12U', teamSport: 'softball',
    programYearName: '2026', capabilities: ASSISTANT_WITH_MONEY,
  } as never;

  const ctx = {
    assignments: [liveAssignment],
    closedAssignments: [],
    // The 2025 row records what this assistant could see THEN: no money.
    seasons: [
      season('y2026', '2026', 'live', ASSISTANT_WITH_MONEY),
      season('y2025', '2025', 'complete', ASSISTANT_NO_MONEY),
    ],
  };

  it('an assistant promoted this year does NOT gain last year’s money', () => {
    const page = resolveCoachSeasonPage(ctx as never, 'org', TEAM, 'y2025');
    assert.equal(page.capabilities?.money, 'off',
      'capabilities must come from the 2025 assignment row, not the coach’s current grants');
  });

  it('…and still sees money in the live season', () => {
    const page = resolveCoachSeasonPage(ctx as never, 'org', TEAM, null);
    assert.equal(page.capabilities?.money, 'read');
  });

  it('canWrite() refuses everything in an archive, whatever the grant says', () => {
    const archive = resolveCoachSeasonPage(ctx as never, 'org', TEAM, 'y2025');
    assert.equal(archive.canWrite(true), false, 'nothing is writable in a finished season');
    assert.equal(archive.isReadOnly, true);

    const liveSeason = resolveCoachSeasonPage(ctx as never, 'org', TEAM, null);
    assert.equal(liveSeason.canWrite(true), true);
    assert.equal(liveSeason.canWrite(false), false, 'read-only never GRANTS a capability');
  });

  it('carries the year on links and fetches only when archived', () => {
    assert.equal(resolveCoachSeasonPage(ctx as never, 'org', TEAM, 'y2025').query, '?year=y2025');
    assert.equal(resolveCoachSeasonPage(ctx as never, 'org', TEAM, null).query, '');
  });

  it('reports no access for a team the coach was never on', () => {
    const page = resolveCoachSeasonPage(ctx as never, 'org', 'team-nope', null);
    assert.equal(page.hasAccess, false);
  });
});
