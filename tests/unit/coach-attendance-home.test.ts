import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  resolveCoachCapabilities,
  type CoachCapabilities,
  type AssistantCapabilityGrants,
} from '../../lib/coach-capabilities.ts';
import { isCoachNavItemVisible, CLOSED_TEAM_NAV_ITEMS } from '../../lib/coach-nav-visibility.ts';

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

describe('a finished season keeps its own attendance door', () => {
  /**
   * ⚠ THE TIDY-UP THAT WOULD HAVE BROKEN THE ARCHIVE. Removing Attendance from the live navs
   * makes removing it from `CLOSED_TEAM_NAV_ITEMS` look like the obvious matching change. It is
   * not: the archive points "Insights" at `/history/results`, NOT at the Insights hub — the hub
   * is live-season-only, and the results archive carries no attendance door. So the archive nav
   * entry is the ONLY route to a past season's attendance report, and deleting it would silently
   * remove an archive door ruled in under D-F1.
   */
  it('lists Attendance in the CLOSED-season nav, where it is the only door to the report', () => {
    const labels = CLOSED_TEAM_NAV_ITEMS.map(i => i.label);
    assert.ok(labels.includes('Attendance'),
      'the archive lost its attendance door — a past season\'s report is now unreachable');
    const door = CLOSED_TEAM_NAV_ITEMS.find(i => i.label === 'Attendance');
    assert.equal(door?.href, '/attendance');
  });

  it('points the archive at the results page, which is why the door above cannot go', () => {
    const insights = CLOSED_TEAM_NAV_ITEMS.find(i => i.label === 'Insights');
    assert.equal(insights?.href, '/history/results',
      'if the archive ever points Insights at the hub, revisit whether Attendance still needs its own archive door');
  });
});
