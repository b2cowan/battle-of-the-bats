/**
 * CLUB TIER STAGE 13 · FIX NOW 2 — item 4 (F-XR-4): one line for a person who coaches in both programs.
 *
 * A house league coach gets the season's team page (9c·1); a rep coach gets the Coaches Portal; nothing said why. The team
 * page is signed in, so it knows who is reading it. Held here:
 *
 *   1. the line is on the team page, ONLY when `getRepPortalDoorForReader` says the portal would admit this reader — by the
 *      portal layout's own tests (club member, billing not suspended, plan carries the portal, a live rep team) — so the door
 *      never opens a wall;
 *   2. it is one quiet line, never a new nav entry;
 *   3. both help articles say the same, with search words.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readCode, readSource } from './_source-code.ts';
import { REP_PORTAL_DOOR } from '../../lib/house-league-teams-words.ts';

const PAGE = 'app/[orgSlug]/league/[seasonSlug]/team/[teamId]/page.tsx';

describe('1. the line is shown only where the portal would admit the reader', () => {
  it('the team page asks the one helper and renders the line from its answer', () => {
    const code = readCode(PAGE);
    assert.match(code, /getRepPortalDoorForReader\(orgSlug\)/);
    assert.match(code, /\{repDoor && \(/);
    assert.match(code, /REP_PORTAL_DOOR\.line/);
    assert.match(code, /href=\{repDoor\}/);
  });
  it('the line sits below the “gone” and “ended” returns, so only a live or just-finished page carries it', () => {
    const code = readCode(PAGE);
    // The read starts early (beside the team read) but is only RENDERED below both returns.
    assert.ok(code.indexOf("view === 'ended'") < code.indexOf('{repDoor && ('));
    assert.ok(code.indexOf("view === 'gone'") < code.indexOf('{repDoor && ('));
  });
  it('the helper applies the portal layout’s own tests, and a failed read is “no door”', () => {
    const code = readCode('lib/coach-portal-request.ts');
    const body = code.slice(code.indexOf('export async function getRepPortalDoorForReader'));
    assert.match(body, /getCoachPortalAuth\(orgSlug\)/);
    assert.match(body, /isOrgBillingSuspended\(auth\.org\)/);
    assert.match(body, /orgPlanCarriesCoachesPortal\(auth\.org\)/);
    assert.match(body, /getCoachPortalAssignments\(auth\.org\.id, auth\.user\.id, isTeamWorkspaceOrg\(auth\.org\)\)/);
    assert.match(body, /assignments\.length > 0/);
    assert.match(body, /catch \{\s*return null;/);
    // The portal layout asks the same three things.
    const layout = readCode('app/[orgSlug]/coaches/layout.tsx');
    assert.match(layout, /getCoachPortalAuth\(orgSlug\)/);
    assert.match(layout, /isOrgBillingSuspended\(authCtx\.org\)/);
    assert.match(layout, /orgPlanCarriesCoachesPortal\(authCtx\.org\)/);
    assert.match(layout, /getCoachPortalAssignments\(authCtx\.org\.id, authCtx\.user\.id, isTeamWorkspace\)/);
  });
});

describe('2. one quiet line, never a nav entry', () => {
  it('the words are the ruled line', () => {
    assert.equal(REP_PORTAL_DOOR.line, 'Your rep team is in the Coaches Portal.');
  });
  it('neither coaches nav nor the club admin rail learns it', () => {
    for (const file of ['components/coaches/CoachesSidebar.tsx', 'components/coaches/CoachesBottomNav.tsx']) {
      assert.doesNotMatch(readCode(file), /REP_PORTAL_DOOR|getRepPortalDoorForReader/);
    }
  });
});

describe('3. both help articles say it, with search words', () => {
  it('the house league coach article', () => {
    const src = readSource('lib/help-content/house-league.tsx');
    assert.match(src, /Your rep team is in the Coaches Portal<\/em>, with a link to it/);
    assert.match(src, /'coach in both programs'/);
    assert.match(src, /coach a house league team and a rep team your rep team is in the coaches portal/);
  });
  it('the Coaches Portal’s start article', () => {
    const src = readSource('lib/help-content/coaches.tsx');
    assert.match(src, /Your rep team is in the Coaches Portal<\/em>, that brings you back to this portal/);
    assert.match(src, /coach in both programs house league team page is separate your rep team is in the coaches portal/);
  });
});
