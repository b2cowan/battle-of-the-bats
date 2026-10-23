import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import {
  canEditEventHeadCoach,
  headCoachEmailSave,
  headCoachNameSave,
  HEAD_COACH_NAME_REQUIRED,
  HEAD_COACH_EMAIL_INVALID,
  EVENT_HEAD_COACH_REFUSED,
} from '../../lib/coach-event-head-coach.ts';
import { resolveCoachCapabilities, applyOrgGrantPolicy, STAFF_PRESETS } from '../../lib/coach-capabilities.ts';

/**
 * Club Tier Stage 7d, Ask 10 — WHO MAY CHANGE AN EVENT'S HEAD COACH (owner ruling 2026-10-22, Put to the
 * owner 1 option (a)): the head coach, and anyone holding Register for tournaments; in a club nobody
 * holds that grant, so the head coach alone; a free team's one member is its head coach. The page draws
 * the form or the line from the SAME rule the PATCH route refuses with — the second half of this file
 * fails if the two readers stop sharing it.
 */

const STANDALONE = { isTeamWorkspace: true };
const CLUB = { isTeamWorkspace: false };
const assistantIn = (org: { isTeamWorkspace: boolean }, grants: Parameters<typeof applyOrgGrantPolicy>[0]) =>
  ({ via: 'assignment' as const, capabilities: resolveCoachCapabilities('assistant_coach', applyOrgGrantPolicy(grants, org)) });

describe('the edit rule, role by role', () => {
  const cases: Array<[string, Parameters<typeof canEditEventHeadCoach>[0], boolean]> = [
    ['a head coach (standalone)', { via: 'assignment', capabilities: resolveCoachCapabilities('head_coach') }, true],
    ['a team manager (standalone, the preset)', assistantIn(STANDALONE, { ...STAFF_PRESETS.manager }), true],
    ['an assistant with schedule editing only', assistantIn(STANDALONE, { ...STAFF_PRESETS.assistant, scheduleManage: true, registerTournaments: false }), false],
    ['a helper', assistantIn(STANDALONE, { ...STAFF_PRESETS.helper }), false],
    ["a club's head coach", { via: 'assignment', capabilities: resolveCoachCapabilities('head_coach') }, true],
    ["a club's team manager (the grant is written off in a club)", assistantIn(CLUB, { ...STAFF_PRESETS.manager }), false],
    ["a free team's member", { via: 'membership' }, true],
    ['a stranger', null, false],
  ];
  for (const [who, access, expected] of cases) {
    it(`${who} → ${expected ? 'the form' : 'a line'}`, () => {
      assert.equal(canEditEventHeadCoach(access), expected);
    });
  }
});

describe('the page and the route read ONE rule', () => {
  const route = readFileSync('app/api/coaches/tournaments/[teamId]/route.ts', 'utf8');
  const record = readFileSync('components/coaches/CoachTournamentRecord.tsx', 'utf8');
  const rule = readFileSync('lib/coach-event-head-coach.ts', 'utf8');

  it('the PATCH route refuses through canEditEventHeadCoach over resolveEventHeadCoachAccess', () => {
    assert.match(route, /canEditEventHeadCoach\(await resolveEventHeadCoachAccess\(guard\.user\.id, teamId\)\)/);
    assert.match(route, /EVENT_HEAD_COACH_REFUSED\s*\}, 403\)/);
    // The refusal comes BEFORE any write.
    assert.ok(route.indexOf('EVENT_HEAD_COACH_REFUSED }, 403') < route.indexOf(".from('teams')"));
  });

  it('the record draws the form only under the same rule, a line otherwise', () => {
    assert.match(record, /resolveEventHeadCoachAccess\(userId, registrationId\)/);
    assert.match(record, /const canEditHeadCoach = canEditEventHeadCoach\(headCoachAccess\)/);
    assert.match(record, /\{canEditHeadCoach \? \(\s*<HeadCoachEditor/);
    assert.match(record, /Head coach for this event: <strong>/);
  });

  it('the staff LABEL is never an input', () => {
    for (const src of [rule, route, readFileSync('lib/coach-registration-access.ts', 'utf8')]) {
      // Code, not comments: no call and no import of the label.
      assert.doesNotMatch(src, /staffKindLabel\(|import[^;]*\bstaffKindLabel\b/);
    }
  });

  it('the refusal is a plain sentence', () => {
    assert.match(EVENT_HEAD_COACH_REFUSED, /^[A-Z][^{}]+\.$/);
  });
});

describe('the autosave sends only what the route would accept (Put to the owner 4)', () => {
  it('a blank name is never sent — it says so in place', () => {
    assert.deepEqual(headCoachNameSave('   ', 'Jordan Lee'), { kind: 'invalid', message: HEAD_COACH_NAME_REQUIRED });
  });
  it('an unchanged name is not sent', () => {
    assert.deepEqual(headCoachNameSave(' Jordan Lee ', 'Jordan Lee'), { kind: 'skip' });
  });
  it('a changed name is sent trimmed, alone', () => {
    assert.deepEqual(headCoachNameSave(' Sam Ito ', 'Jordan Lee'), { kind: 'send', body: { coach: 'Sam Ito' } });
  });
  it('a malformed email is never sent', () => {
    assert.deepEqual(headCoachEmailSave('jo@ex', ''), { kind: 'invalid', message: HEAD_COACH_EMAIL_INVALID });
  });
  it('a cleared email IS a save (mail reverts to the registration email)', () => {
    assert.deepEqual(headCoachEmailSave('  ', 'coach@example.com'), { kind: 'send', body: { coachEmail: null } });
  });
  it('an email is sent lower-cased, and the same address in other case is no change', () => {
    assert.deepEqual(headCoachEmailSave('Coach@Example.com', ''), { kind: 'send', body: { coachEmail: 'coach@example.com' } });
    assert.deepEqual(headCoachEmailSave('COACH@example.com', 'coach@example.com'), { kind: 'skip' });
  });
  it('the editor saves the email on leaving the field, never on a typing pause', () => {
    const editor = readFileSync('components/coaches/HeadCoachEditor.tsx', 'utf8');
    const emailInput = editor.slice(editor.indexOf('Email the organizer uses'));
    assert.match(emailInput, /onBlur=\{\(\) => \{ void commit\('email'\); \}\}/);
    assert.doesNotMatch(emailInput.slice(0, emailInput.indexOf('</label>')), /setTimeout/);
  });
});
