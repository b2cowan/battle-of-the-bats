import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  resolveCoachCapabilities,
  type CoachCapabilities,
  type AssistantCapabilityGrants,
} from '../../lib/coach-capabilities.ts';
import { isCoachNavItemVisible, CLOSED_TEAM_NAV_ITEMS, archiveHasSection } from '../../lib/coach-nav-visibility.ts';

/**
 * ══════════════════════════════════════════════════════════════════════════════════════════
 * ATTENDANCE'S HOME — the invariants Phase 3 rests on
 * (COACH_NAV_AND_PRACTICE_PLANS_PLAN.md, owner-approved 2026-08-15)
 *
 * Attendance left both LIVE navs. It is a report — nothing is ever recorded on that page, the
 * marking happens in the Schedule's event panel — so its one parent is now the Insights hub.
 *
 * That move is only safe because of a fact that is easy to break by accident and impossible to
 * see when you do. The PLAN ITSELF recorded the opposite as a blocking owner decision:
 *
 *   > "An assistant whose only duty is attendance would keep the ability to mark players present
 *   >  on the Schedule but lose the season report."
 *
 * ⚠ That was already FALSE when it was written, because A1 (2026-08-03) folded the attendance
 * duty into `hasRecordAccess`, which is what the Insights nav item gates on. Nobody loses
 * anything. But the claim was plausible enough to be written down twice and nearly cost an owner
 * decision, so the invariant is pinned here rather than left to be re-reasoned: **the set of
 * coaches who can open the attendance report is a SUBSET of those who can open Insights.**
 *
 * If a future change narrows `hasRecordAccess` — dropping `attendance` from its union, or giving
 * Insights its own tighter gate — this test fails, and it fails BEFORE a coach discovers that the
 * only door to their season attendance stopped existing.
 * ══════════════════════════════════════════════════════════════════════════════════════════
 */

const assistant = (grants?: AssistantCapabilityGrants): CoachCapabilities =>
  resolveCoachCapabilities('assistant_coach', grants);

/** Every grant off — the HELPER floor the portal treats as least privilege. */
const NOTHING: AssistantCapabilityGrants = {
  schedule: false, scheduleManage: false, attendance: false, lineups: false, notes: false,
  money: 'off', documents: 'off', tryouts: false, rosterPii: false, announcementsSend: false,
  staffChat: false,
};

describe('the attendance report can never be reachable without Insights also being reachable', () => {
  it('holds for the exact persona the plan feared would be stranded — attendance and nothing else', () => {
    const caps = assistant({ ...NOTHING, attendance: true });
    // The duty is genuinely alone: this coach cannot see the schedule, lineups or notes...
    assert.equal(caps.attendance, true);
    assert.equal(caps.lineups, false);
    assert.equal(caps.notes, false);
    // ...and they still reach BOTH the report and the hub that is now its only live door.
    assert.equal(isCoachNavItemVisible(caps, 'Attendance'), true);
    assert.equal(isCoachNavItemVisible(caps, 'Insights'), true,
      'attendance-only assistant lost the Insights hub — the report now has NO live door for them');
  });

  it('holds for every single-duty assistant, so no grant combination strands the report', () => {
    const singleDuties: AssistantCapabilityGrants[] = [
      { ...NOTHING, attendance: true },
      { ...NOTHING, lineups: true },
      { ...NOTHING, notes: true },
      { ...NOTHING, tryouts: true },
      { ...NOTHING, money: 'read' },
      { ...NOTHING, documents: 'view' },
      { ...NOTHING, schedule: true },
      { ...NOTHING, attendance: true, schedule: true },
    ];
    for (const grants of singleDuties) {
      const caps = assistant(grants);
      if (!isCoachNavItemVisible(caps, 'Attendance')) continue;
      assert.equal(isCoachNavItemVisible(caps, 'Insights'), true,
        `grants ${JSON.stringify(grants)} open the attendance report but NOT Insights — the report is orphaned`);
    }
  });

  it('still closes the report to a helper, who holds no duty at all', () => {
    const caps = assistant(NOTHING);
    assert.equal(isCoachNavItemVisible(caps, 'Attendance'), false);
    assert.equal(isCoachNavItemVisible(caps, 'Insights'), false);
  });

  it('leaves a head coach with both', () => {
    const caps = resolveCoachCapabilities('head_coach');
    assert.equal(isCoachNavItemVisible(caps, 'Attendance'), true);
    assert.equal(isCoachNavItemVisible(caps, 'Insights'), true);
  });
});

describe('a finished season still reaches its attendance report', () => {
  /**
   * ⚠⚠ THIS BLOCK USED TO ASSERT THE OPPOSITE, AND ITS OWN COMMENT IS WHAT RETIRED IT.
   *
   * Until 2026-08-16 it required Attendance to appear in `CLOSED_TEAM_NAV_ITEMS`, because the
   * archive pointed "Insights" at `/history/results` (the hub being live-season-only) and the
   * results page carries no attendance door — so that menu line genuinely was the only route to a
   * past season's report. The second test spelled out the expiry condition in as many words: *"if
   * the archive ever points Insights at the hub, revisit whether Attendance still needs its own
   * archive door."* Archive rail Phase 2 did exactly that, and the sentence is what made the
   * revisit happen instead of the build going red for a reason nobody could reconstruct.
   *
   * ⚠ The rewrite is deliberately NOT weaker. The menu line was never the point — the ACCESS was.
   * So this now pins the access directly, which also stops the two failure modes the old pair could
   * not see: a section that loses its menu line AND its reachability, and a menu-driven season
   * switcher that strands a coach reading a section the menu no longer names.
   */
  it('does not carry an Attendance line in the archive menu any more', () => {
    assert.equal(
      CLOSED_TEAM_NAV_ITEMS.some(i => i.label === 'Attendance'), false,
      'Attendance is reached through the Insights hub in BOTH seasons since archive rail Phase 2. '
      + 'A menu line here would be a second door to one report, in one season only — the asymmetry '
      + 'that phase existed to remove.',
    );
  });

  it('still HAS the section, which is the property that ever mattered', () => {
    assert.ok(
      archiveHasSection('/attendance'),
      'a past season lost its attendance report. It is an approved archive door (D-F1) whose route '
      + 'and page are both season-aware — losing the menu line must never lose the section, or the '
      + 'season switcher dumps a coach reading it onto Season`s End.',
    );
  });

  it('points the archive`s Insights door at the hub, which is what carries the report', () => {
    const insights = CLOSED_TEAM_NAV_ITEMS.find(i => i.label === 'Insights');
    assert.equal(
      insights?.href, '/history',
      'the archive`s Insights door must be the hub. It pointed at /history/results only while the '
      + 'hub was live-season-only, and that workaround is the entire reason Attendance needed an '
      + 'archive-only menu line. If this ever reverts, Attendance needs its own door back FIRST — '
      + 'in that order, or a past season`s report becomes unreachable in between.',
    );
  });
});
