/**
 * The two pure resolvers behind "which season am I looking at, and is it a record".
 *
 * Worth testing in isolation because every page's write flags reduce to them, and because the bug
 * they exist to prevent is the one the plan of record got wrong: deciding "read-only" from the
 * TEAM's state rather than the SEASON's, which leaves a rolled-forward team's finished season
 * quietly writable.
 *
 * ⚠ REWRITTEN 2026-08-16 (P2, Design A). The `?year=` half of these resolvers is deleted with the
 * season dial — there is no option list, no `hasChoice`, no `query`, and no per-season capability
 * archaeology. What remains is the question that never depended on the dial: **what is the team's
 * WORKING season, and has it finished?** The tests that asserted switching behaviour died with the
 * feature; the ones below are their surviving half.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { resolveWorkingSeason, resolveCoachSeasonPage } from '../../lib/coach-season-view.ts';
import { resolveCoachCapabilities } from '../../lib/coach-capabilities.ts';

const HEAD = resolveCoachCapabilities('head_coach', null);
const ASSISTANT_WITH_MONEY = resolveCoachCapabilities('assistant_coach', { money: 'read' });

const TEAM = 'team-1';

/** A live (draft/active) assignment row, as the shell's `assignments` array carries it. */
const live = (id: string, year: number, capabilities = HEAD) => ({
  teamId: TEAM, teamName: 'Riverdale Rays 12U', teamColor: null, teamSport: 'softball',
  programYearId: id, programYearName: String(year), programYearYear: year,
  coachRole: 'head_coach' as const, capabilities,
} as never);

/** A finished season, as `closedAssignments` carries it — deduped to one per team, newest first. */
const closed = (id: string, year: number, capabilities = HEAD) => ({
  ...(live(id, year, capabilities) as object),
  programYearStatus: 'completed',
} as never);

describe('resolveWorkingSeason', () => {
  it('is the live season when the team has one', () => {
    const s = resolveWorkingSeason([live('y2026', 2026)], [closed('y2025', 2025)], TEAM);
    assert.equal(s?.programYearId, 'y2026');
    assert.equal(s?.isReadOnly, false);
  });

  /**
   * ⚠ THE CASE THE WHOLE MODEL RESTS ON. A team between seasons is not a lock-out and not an
   * archive — it is a team whose working season has finished. Every record surface renders it,
   * read-only, and the nav's first slot becomes Season's End.
   */
  it('is the newest finished season when the team has no live one', () => {
    const s = resolveWorkingSeason([], [closed('y2025', 2025)], TEAM);
    assert.equal(s?.programYearId, 'y2025');
    assert.equal(s?.isReadOnly, true);
  });

  /**
   * ⚠ A ROLLED-FORWARD TEAM IS NEVER ITSELF "CLOSED". Its finished seasons still exist as records,
   * but the season on screen is the live one — this is exactly the inversion the plan of record
   * got backwards, and keying off the team's state would make last year writable.
   */
  it('a rolled-forward team is live, even though it has finished seasons behind it', () => {
    const s = resolveWorkingSeason([live('y2026', 2026)], [closed('y2025', 2025)], TEAM);
    assert.equal(s?.isReadOnly, false, 'read-only must come from the SEASON, never from the team');
  });

  /**
   * Mid-rollover a team legitimately holds a draft AND an active year. The server resolves the most
   * recent; if the client picked the other one, the masthead would name a season the data did not
   * come from. The rows are supplied oldest-first deliberately — the lookup has no ORDER BY, so
   * arrival order is arbitrary and must not decide this.
   */
  it('picks the NEWEST live season when a team holds a draft and an active year at once', () => {
    const s = resolveWorkingSeason([live('y2026', 2026), live('y2027', 2027)], [], TEAM);
    assert.equal(s?.programYearId, 'y2027');
    assert.equal(s?.isReadOnly, false);
  });

  it('ignores other teams’ rows', () => {
    const other = { ...(live('other-y', 2026) as object), teamId: 'team-2' } as never;
    assert.equal(resolveWorkingSeason([other], [], TEAM), null);
  });

  it('has no season at all for a team the coach holds nothing on', () => {
    assert.equal(resolveWorkingSeason([live('y2026', 2026)], [], 'team-nope'), null);
  });
});

describe('resolveCoachSeasonPage', () => {
  const rolledForward = { assignments: [live('y2026', 2026, ASSISTANT_WITH_MONEY)], closedAssignments: [closed('y2025', 2025)] };
  const betweenSeasons = { assignments: [], closedAssignments: [closed('y2025', 2025, ASSISTANT_WITH_MONEY)] };

  /**
   * ⚠ CAPABILITIES ARE THE MEMBER'S CURRENT ONES, IN EVERY SEASON (owner ruling 2026-08-16, M1).
   * Chunk F's governing rule 1 — "resolve the grants from the viewed season's own assignment row"
   * — is retired: it existed because ACCESS itself was historical, and once only current staff hold
   * access at all, their current grant is the honest one. There is exactly one capability set
   * anywhere, so this now holds by construction rather than by care.
   */
  it('hands the page the member’s current grants', () => {
    const page = resolveCoachSeasonPage(rolledForward as never, 'org', TEAM);
    assert.equal(page.capabilities?.money, 'read');
    assert.equal(page.programYearName, '2026');
  });

  it('canWrite() refuses everything once the season has finished, whatever the grant says', () => {
    const finished = resolveCoachSeasonPage(betweenSeasons as never, 'org', TEAM);
    assert.equal(finished.isReadOnly, true);
    assert.equal(finished.canWrite(true), false, 'nothing is writable in a finished season');

    const liveSeason = resolveCoachSeasonPage(rolledForward as never, 'org', TEAM);
    assert.equal(liveSeason.canWrite(true), true);
    assert.equal(liveSeason.canWrite(false), false, 'read-only never GRANTS a capability');
  });

  it('a coach between seasons still has access, and reads that season', () => {
    const page = resolveCoachSeasonPage(betweenSeasons as never, 'org', TEAM);
    assert.equal(page.hasAccess, true,
      'between seasons is an ordinary state, not a lock-out — the whole reason the working season '
      + 'falls back to the newest finished one');
    assert.equal(page.programYearName, '2025');
  });

  it('reports no access for a team the coach is not on', () => {
    const page = resolveCoachSeasonPage(rolledForward as never, 'org', 'team-nope');
    assert.equal(page.hasAccess, false);
    assert.equal(page.season, null);
  });
});
