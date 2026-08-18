/**
 * The pure resolvers behind "which season am I looking at".
 *
 * ⚠⚠ REWRITTEN 2026-08-18 (COACH_SEASON_CLOSE_AND_ARCHIVE_PLAN). The question these answered used
 * to be "what is the team's WORKING season, and has it finished?" — because a team between seasons
 * rendered its whole portal read-only, and `isReadOnly` was what seventeen screens branched on.
 * That model is deleted. A season is fully LIVE until it is closed, and a closed season is ONE
 * PAGE, so the two questions are now separate and neither has a "read-only" answer:
 *
 *   · `resolveLiveSeason` — the team's live season, or null.
 *   · `resolveClosedSeason` — the team's newest closed season, but ONLY when it has no live one.
 *
 * The tests that asserted read-only rendering died with the feature. ⚠ The one property they were
 * really protecting survives below and still matters: **a rolled-forward team is never itself
 * "closed"** — the plan of record had that backwards once, and keying off the team's state instead
 * of the season's would send a mid-season coach to a closed-season page.
 *
 * ⚠ The `?year=` half went earlier (P2, 2026-08-16, Design A): no option list, no `hasChoice`, no
 * `query`, no per-season capability archaeology.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { resolveLiveSeason, resolveClosedSeason, resolveCoachSeasonPage } from '../../lib/coach-season-view.ts';
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

describe('resolveLiveSeason', () => {
  it('is the live season when the team has one', () => {
    const s = resolveLiveSeason([live('y2026', 2026)], TEAM);
    assert.equal(s?.programYearId, 'y2026');
  });

  it('is null when the team has none — an ordinary state, not a lock-out', () => {
    assert.equal(resolveLiveSeason([], TEAM), null);
  });

  /**
   * Mid-rollover a team legitimately holds a draft AND an active year. The server resolves the most
   * recent; if the client picked the other one, the masthead would name a season the data did not
   * come from. The rows are supplied oldest-first deliberately — the lookup has no ORDER BY, so
   * arrival order is arbitrary and must not decide this.
   */
  it('picks the NEWEST live season when a team holds a draft and an active year at once', () => {
    const s = resolveLiveSeason([live('y2026', 2026), live('y2027', 2027)], TEAM);
    assert.equal(s?.programYearId, 'y2027');
  });

  it('ignores other teams’ rows', () => {
    const other = { ...(live('other-y', 2026) as object), teamId: 'team-2' } as never;
    assert.equal(resolveLiveSeason([other], TEAM), null);
  });
});

describe('resolveClosedSeason', () => {
  it('is the newest finished season when the team has no live one', () => {
    const s = resolveClosedSeason([], [closed('y2025', 2025)], TEAM);
    assert.equal(s?.programYearId, 'y2025');
  });

  /**
   * ⚠⚠ THE PROPERTY THE WHOLE MODEL RESTS ON. A rolled-forward team's finished seasons still exist
   * as records, reachable BY NAME from the compare list — but the team is not "between seasons",
   * and this resolver must not offer one. It is what `CoachTeamSeasonGate` reads to decide whether
   * to send a coach to the closed-season page, so a wrong answer here would bounce a mid-season
   * coach out of every live tool they own.
   */
  it('is null for a rolled-forward team, even though it has finished seasons behind it', () => {
    assert.equal(
      resolveClosedSeason([live('y2026', 2026)], [closed('y2025', 2025)], TEAM), null,
      'a team with a live season is never "between seasons" — the closed years are reached by name',
    );
  });

  it('is null for a team the coach holds nothing on', () => {
    assert.equal(resolveClosedSeason([], [closed('y2025', 2025)], 'team-nope'), null);
  });
});

describe('resolveCoachSeasonPage', () => {
  const rolledForward = { assignments: [live('y2026', 2026, ASSISTANT_WITH_MONEY)], closedAssignments: [closed('y2025', 2025)] };
  const betweenSeasons = { assignments: [], closedAssignments: [closed('y2025', 2025, ASSISTANT_WITH_MONEY)] };

  /**
   * ⚠ CAPABILITIES ARE THE MEMBER'S CURRENT ONES, IN EVERY SEASON (owner ruling 2026-08-16, M1).
   * Chunk F's governing rule 1 — "resolve the grants from the viewed season's own assignment row"
   * — is retired: it existed because ACCESS itself was historical, and once only current staff hold
   * access at all, their current grant is the honest one.
   */
  it('hands the page the member’s current grants', () => {
    const page = resolveCoachSeasonPage(rolledForward as never, 'org', TEAM);
    assert.equal(page.capabilities?.money, 'read');
    assert.equal(page.programYearName, '2026');
  });

  /**
   * ⚠⚠ `hasAccess` MEANS "THIS COACH HAS A LIVE SEASON HERE", not "is on this team's staff" — the
   * meaning changed on 2026-08-18 and the difference is the whole deletion. A live page uses it to
   * decide whether to render its instrument at all; `closedSeason` is what tells a coach between
   * seasons apart from a genuine stranger, so neither state is described by a read-only copy of a
   * live screen any more.
   */
  it('a coach between seasons has no live season, and their closed one instead', () => {
    const page = resolveCoachSeasonPage(betweenSeasons as never, 'org', TEAM);
    assert.equal(page.season, null);
    assert.equal(page.hasAccess, false, 'no LIVE season — the live tools do not render');
    assert.equal(page.closedSeason?.programYearName, '2025',
      'but they are still staff, and this is what says so — the page they land on is that season');
    assert.equal(page.programYearName, '2025');
  });

  it('a rolled-forward team is live, and offers no closed season to land on', () => {
    const page = resolveCoachSeasonPage(rolledForward as never, 'org', TEAM);
    assert.equal(page.hasAccess, true);
    assert.equal(page.closedSeason, null);
  });

  it('reports nothing at all for a team the coach is not on', () => {
    const page = resolveCoachSeasonPage(rolledForward as never, 'org', 'team-nope');
    assert.equal(page.hasAccess, false);
    assert.equal(page.season, null);
    assert.equal(page.closedSeason, null);
  });
});
