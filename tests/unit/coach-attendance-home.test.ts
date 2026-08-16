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

describe('a finished season still reaches its attendance report', () => {
  /**
   * ⚠⚠ THIS BLOCK HAS NOW BEEN REWRITTEN TWICE BY ITS OWN EXPIRY CONDITIONS, WHICH IS THE POINT.
   *
   * Round 1 (until 2026-08-16) required Attendance to appear in the archive's menu, because the
   * archive pointed "Insights" at `/history/results` and that page carries no attendance door.
   * The test spelled out its own expiry: *"if the archive ever points Insights at the hub, revisit
   * whether Attendance still needs its own archive door."* It did, so the assertion was replaced
   * by the ACCESS it was really protecting rather than deleted.
   *
   * Round 2 (P2, the same day): the archive menu itself is deleted — there is one nav, and a team
   * whose working season has finished keeps it. So "does the archive have this section?" has no
   * meaning any more, and the property that survives both rewrites is the one that always
   * mattered: **the Insights hub is Attendance's only parent, and the hub carries a door to it.**
   * A page with no nav entry and no door on its parent is unreachable, and nothing else would say
   * so.
   */
  const HUB = readFileSync(
    join(process.cwd(), 'app', '[orgSlug]', 'coaches', 'teams', '[teamId]', 'history', 'page.tsx'),
    'utf8',
  );

  it('the Insights hub carries the door to the attendance report', () => {
    assert.match(
      HUB, /href=\{`\$\{base\}\/attendance`\}/,
      'the attendance report lost its only door. It is in NEITHER nav (it left the live navs on '
      + '2026-08-15 and the archive menu died with the archive on 2026-08-16), so this tile is the '
      + 'single inbound link in the product. Remove it and the page is unreachable.',
    );
  });

  it('the door rides the attendance grant, not record access', () => {
    assert.match(
      HUB, /const canAttendance = !!caps\?\.attendance;/,
      'the tile must be keyed on the grant the REPORT gates on. Keyed on record access it would '
      + 'be offered to coaches who 403 on arrival — a door drawn onto a refusal.',
    );
  });

  it('the door is offered in a finished season too', () => {
    const idx = HUB.indexOf('Who&apos;s showing up?');
    assert.ok(idx > 0, 'expected the attendance tile to exist at all');
    assert.equal(
      /!isRecord/.test(HUB.slice(Math.max(0, idx - 900), idx)), false,
      'the attendance tile must NOT be hidden on a finished season. Attendance is a RECORD of who '
      + 'turned up — unlike playing time and the scouting book beside it, which are live-only by '
      + 'ruling. Hiding it would take a past season\'s report away with nothing to replace it.',
    );
  });
});
