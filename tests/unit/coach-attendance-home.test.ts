import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  resolveCoachCapabilities,
  type CoachCapabilities,
  type AssistantCapabilityGrants,
} from '../../lib/coach-capabilities.ts';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { isCoachNavItemVisible } from '../../lib/coach-nav-visibility.ts';

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

describe('the attendance report is reachable at all', () => {
  /**
   * ⚠⚠ THIS BLOCK HAS NOW BEEN REWRITTEN THREE TIMES BY ITS OWN EXPIRY CONDITIONS, WHICH IS THE
   * POINT — each time because the thing it guards MOVED, never because the property stopped
   * mattering.
   *
   * Round 1 (until 2026-08-16) required Attendance to appear in the archive's menu, because the
   * archive pointed "Insights" at `/history/results` and that page carries no attendance door.
   * Round 2 (P2, the same day): the archive menu itself was deleted, so "does the archive have this
   * section?" stopped having meaning; the surviving property was **the Insights hub is Attendance's
   * only parent, and the hub carries a door to it.**
   * Round 3 (reports portal P1, 2026-08-18): **the door IS the tab.** Attendance is no longer a
   * separate page reached by a tile — it is a panel of the Insights portal, so what has to be true
   * is that the hub RENDERS the tab and MOUNTS the panel. A tab missing from the row is the same
   * unreachable page the missing tile would have been.
   *
   * ⚠ The old top-level `/attendance` route still exists as a permanent redirect, and that is a
   * second thing worth pinning: three surfaces link to it by its old address (the Schedule's
   * "Season attendance" button, the Overview coaching-pair tile, and every bookmark a coach has
   * made in a year of using it). Deleting the redirect breaks all three silently.
   */
  const HUB = readFileSync(
    join(process.cwd(), 'app', '[orgSlug]', 'coaches', 'teams', '[teamId]', 'history', 'page.tsx'),
    'utf8',
  );
  const LEGACY = readFileSync(
    join(process.cwd(), 'app', '[orgSlug]', 'coaches', 'teams', '[teamId]', 'attendance', 'page.tsx'),
    'utf8',
  );

  it('the Insights portal renders the Attendance tab and mounts its panel', () => {
    assert.match(
      HUB, /\{ id: 'attendance', label: 'Attendance', gate: /,
      'the attendance report lost its tab. It is in NEITHER nav (it left the live navs on '
      + '2026-08-15 and the archive menu died with the archive on 2026-08-16), so this tab is its '
      + 'only entry point in the product. Remove it and the report is unreachable.',
    );
    assert.match(
      HUB, /\{ id: 'attendance', Component: AttendancePanel \}/,
      'a tab with no panel in PANELS renders an empty pane — the tab row would still look right.',
    );
  });

  it('the tab rides the attendance grant, not record access', () => {
    /**
     * ⚠ Read off the TAB TABLE's own gate rather than a `canAttendance` const. The hub's per-tab
     * config (`TABS`) now carries each tab's grant beside its label, so the gate and the label
     * cannot be edited apart — which is the property this test was really protecting.
     */
    assert.match(
      HUB, /\{ id: 'attendance', label: 'Attendance', gate: c => c\.attendance,/,
      'the tab must be keyed on the grant the REPORT gates on. Keyed on record access it would be '
      + 'offered to coaches who 403 on arrival — a door drawn onto a refusal.',
    );
  });

  it('the old /attendance address still lands on the tab', () => {
    assert.match(
      LEGACY, /insightsLegacyRedirectPage\('attendance'\)/,
      'the top-level /attendance route must keep redirecting into the portal. The Schedule\'s '
      + '"Season attendance" button, the Overview coaching-pair tile and every coach bookmark used '
      + 'this address for a year; deleting the redirect 404s all of them at once.',
    );
  });
});
