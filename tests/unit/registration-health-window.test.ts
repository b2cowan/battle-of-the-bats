import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { buildRegistrationCapacity, buildRegistrationHealth, countRegistrationHealthTeams, registrationDaysUntilStart } from '../../lib/registration-health.ts';

/**
 * Registration health is a header button and a window, and ONE number (owner 2026-10-21) — the Schedule health shape.
 * The Teams page's "At a glance" card is gone: health became the button, "Registration open" a chip beside the division
 * picker, Payments one slim line. The dashboard's Registration card opens the SAME window from its first row, and the
 * route that feeds it scores with the Teams page's own calls, so the two screens cannot disagree.
 */

const read = (path: string) => readFileSync(path, 'utf8');
const TEAMS = read('app/[orgSlug]/admin/tournaments/registrations/page.tsx');
const ROUTE = read('app/api/admin/tournament-dashboard/route.ts');
const DASH = read('app/[orgSlug]/admin/tournaments/dashboard/page.tsx');
const WEEKS = read('app/[orgSlug]/admin/tournaments/dashboard/WeeksBeforeBoard.tsx');
const WINDOW = read('components/admin/tournament/RegistrationHealthWindow.tsx');
const CHIP = read('app/[orgSlug]/admin/tournaments/registrations/components/RegistrationChip.tsx');
const LINE = read('app/[orgSlug]/admin/tournaments/registrations/components/PaymentsLine.tsx');

describe('registration health is one number on Teams and the dashboard', () => {
  test('both call the one set of functions, and neither scores or counts its own way', () => {
    for (const [name, src] of [['Teams', TEAMS], ['the dashboard route', ROUTE]] as const) {
      assert.match(src, /buildRegistrationHealth\(/, `${name} scores through the one call`);
      assert.match(src, /buildRegistrationCapacity\(/, `${name} finds the capacity gaps through the one call`);
      assert.match(src, /countRegistrationHealthTeams\(/, `${name} counts the teams through the one call`);
    }
  });

  test('days until start are read in the organization\'s own zone, so a viewer\'s clock never moves the score', () => {
    // 03:00 UTC on Oct 21 is 11 p.m. on Oct 20 in Toronto: today is the 20th, whatever zone the browser or server is in.
    const now = new Date('2026-10-21T03:00:00Z');
    assert.equal(registrationDaysUntilStart('2026-10-25', now), 5);
    assert.equal(registrationDaysUntilStart('2026-10-25T00:00:00Z', now), 5, 'a timestamp reads as its date');
    assert.equal(registrationDaysUntilStart(null, now), null);
    for (const [name, src] of [['Teams', TEAMS], ['the dashboard route', ROUTE]] as const) {
      assert.match(src, /registrationDaysUntilStart\(/, `${name} reads the start through the one function`);
      assert.doesNotMatch(src, /calendarDaysBetween\(/, `${name} does not parse the date in its own runtime's zone`);
    }
  });

  test('a rejected registration is not a team, and only accepted ones fill a division', () => {
    const counts = countRegistrationHealthTeams([
      { status: 'accepted', divisionId: 'u13' }, { status: 'accepted', divisionId: 'u13' },
      { status: 'pending', divisionId: 'u13' }, { status: 'waitlist', divisionId: 'u15' },
      { status: 'rejected', divisionId: 'u15' }, { status: null, divisionId: 'u15' },
    ]);
    assert.equal(counts.teamsTotal, 4);
    assert.equal(counts.accepted, 2);
    assert.equal(counts.acceptedByDivision.get('u13'), 2);
    assert.equal(counts.acceptedByDivision.has('u15'), false);
  });

  test('a division that never filled is a gap when closed, or when the event starts within three days', () => {
    const accepted = new Map([['u13', 4], ['u15', 8]]);
    const divisions = [
      { id: 'u13', name: '13U', capacity: 8, isClosed: false },
      { id: 'u15', name: '15U', capacity: 8, isClosed: false },
      { id: 'u17', name: '17U', capacity: null, isClosed: true },
    ];
    const far = buildRegistrationCapacity({ divisions, acceptedByDivision: accepted, daysUntilStart: 20 });
    assert.deepEqual(far.gaps, [], 'open and far off is not a gap');
    assert.equal(far.capacityTotal, 16, 'a division with no capacity is not counted');
    assert.equal(far.capacityAccepted, 12);
    const soon = buildRegistrationCapacity({ divisions, acceptedByDivision: accepted, daysUntilStart: 2 });
    assert.deepEqual(soon.gaps.map(g => [g.divisionId, g.reason]), [['u13', 'soon_under']]);
    const closed = buildRegistrationCapacity({ divisions: [{ ...divisions[0], isClosed: true }], acceptedByDivision: accepted, daysUntilStart: 20 });
    assert.deepEqual(closed.gaps.map(g => g.reason), ['closed_under']);
  });

  test('the score still takes 100 minus the weighted problems, so the button and the dashboard read the same figure', () => {
    const health = buildRegistrationHealth({
      attention: { total: 0, buckets: [{ key: 'missing_email', label: 'Missing email', count: 4, description: '' }] } as never,
      teamsTotal: 4, accepted: 4, paymentsTracked: true, eventTracksPayments: true, capacityGaps: [],
    });
    assert.equal(health.score, 75, 'four of four teams missing an email costs the full 25');
    assert.equal(health.tone, 'warning');
    assert.equal(health.issues.length, 1);
  });
});

describe('the Teams page wears health as a header button and a window — never the At a glance card', () => {
  test('the button is the header\'s first action and carries the tour anchor literally', () => {
    assert.match(TEAMS, /<HealthButton\s+data-sandbox-tour="registration-health"/);
    assert.ok(TEAMS.indexOf('<HealthButton') < TEAMS.indexOf('<ExportMenu'), 'health comes before Export, as on the Schedule');
    assert.doesNotMatch(TEAMS, /TeamsGlance|RegistrationHealthPanel/, 'the card and its row are gone');
    assert.equal(existsSync('app/[orgSlug]/admin/tournaments/registrations/components/TeamsGlance.tsx'), false);
    assert.equal(existsSync('app/[orgSlug]/admin/tournaments/registrations/components/RegistrationHealthPanel.tsx'), false);
  });

  test('the window never arrives open, the demo included, and is the one form window', () => {
    assert.match(TEAMS, /const \[healthOpen, setHealthOpen\] = useState\(false\);/);
    assert.match(WINDOW, /<KitDialog kind="form" size="wide"/);
    assert.doesNotMatch(WINDOW, /dirty=|footer=/, 'nothing to save, so no foot and nothing to ask on close');
  });

  test('the window stays shut when its button goes away, and the button is absent while selecting or swapping', () => {
    assert.match(TEAMS, /if \(healthOpen && !showRegistrationHealth\) setHealthOpen\(false\);/);
    assert.match(TEAMS, /\{showRegistrationHealth && listMode === 'normal' && \(\s*<HealthButton/);
    assert.match(DASH, /if \(regHealthWindowOpen && !visibleStats\.registrationHealth\) setRegHealthWindowOpen\(false\);/);
  });

  test('a figure or a door closes the window before it jumps', () => {
    assert.match(TEAMS, /onJumpToBucket=\{key => \{ setHealthOpen\(false\); focusAttentionBucket\(key\); \}\}/);
    assert.match(TEAMS, /onJumpToCapacity=\{divisionId => \{ setHealthOpen\(false\); jumpToDivision\(divisionId\); \}\}/);
  });

  test('the chip sits beside the picker inside the one optional group the toolbar guard allows', () => {
    assert.match(TEAMS, /<DivisionPicker [^>]*\/>\s*\{registrationChip\}\s*<span className=\{tb\.toolbarSpacer\} aria-hidden \/>/);
    assert.match(TEAMS, /const registrationChip = currentTournament && !cleanInvite && selectedGroup && !isLocked/);
  });

  test('the chip is the Tools menu\'s own component, says its state in words, and holds the one switch', () => {
    assert.match(CHIP, /CoachToolbarMenu/);
    assert.match(CHIP, /TEAMS_WORDS\.registrationClosed : TEAMS_WORDS\.registrationOpen/);
    assert.match(CHIP, /TEAMS_WORDS\.closeSentence/);
    assert.match(CHIP, /PlanLockedTool/, 'a plan-ended event keeps the plan\'s lock in the switch\'s place');
  });

  test('Payments is one slim line that opens closed, only where the payment tools and a division\'s teams exist', () => {
    assert.match(LINE, /const \[open, setOpen\] = useState\(false\);/);
    assert.match(TEAMS, /paymentToolsAvailable && selectedGroup && !isLocked && paymentSummary\.scheduled > 0 && \(\s*<PaymentsLine/);
  });
});

describe('the dashboard opens the SAME window from the Registration card\'s first row', () => {
  test('the route scores with the shared calls and hands the result to the board', () => {
    assert.match(ROUTE, /registrationHealth,\s*\}\);/);
    assert.match(DASH, /<RegistrationHealthWindow\b/);
    assert.match(DASH, /registrationHealth: data\?\.registrationHealth \?\? null/);
  });

  test('the row is a button that opens the window, inside the card — not a sixth card', () => {
    assert.match(WEEKS, /as="button"\s+onClick=\{onOpenRegHealth\}/);
    assert.doesNotMatch(WEEKS, /PanelId = [^;]*'registrationHealth'/);
  });
});
