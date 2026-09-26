import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readCode } from './_source-code.ts';

/**
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * CLUB TIER STAGE 1 · SESSION 2 — THE CLUB SCREENS, BEHIND THE ADMIN DESIGN CONTINUITY SWITCH
 * (`docs/projects/active/CLUB_TIER_STAGE1_SCREENS_PROMPT.md`; ratified specimens 1–12, hub v8).
 *
 *   1. THE SWITCH. Every screen here is a kit version that renders only with the switch on; with it
 *      off today's screen renders untouched. The release slice deletes the legacy branch.
 *   2. NO MONEY ON THE HUB (C04) — the morning brief is counts and ages, never an amount.
 *   3. A DOOR ONLY WHERE IT OPENS — a brief card links only when the person can open its page (the
 *      treasurer's two are plain counts until Stage 3a, owner 2026-09-26); owner-only areas are
 *      LOCKED rows, never links.
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 */

describe('the switch — the hub', () => {
  it('the hub renders today\'s component with the switch off, and for a tournament-only workspace', () => {
    const hub = readCode('app/[orgSlug]/admin/AdminHub.tsx');
    assert.match(hub, /if \(!kit \|\| !currentOrg \|\| isTournamentOnlyWorkspace\(currentOrg\)\) return <AdminHubClient \/>;/);
    assert.match(hub, /dynamic\(\(\) => import\('@\/components\/admin\/kit\/club\/ClubHubKit'\)\)/,
      'the kit hub is its own chunk — it rides no switch-off page');
    assert.match(readCode('app/[orgSlug]/admin/page.tsx'), /<AdminHub \/>/);
  });

  it('the morning brief provider mounts only under the switch', () => {
    const chrome = readCode('app/[orgSlug]/admin/AdminChrome.tsx');
    assert.match(chrome, /\{kit \? <ClubBriefProvider>\{frame\}<\/ClubBriefProvider> : frame\}/);
  });
});

describe('the switch — Members and the audit log', () => {
  it('each page renders today\'s version with the switch off, unchanged below its wrapper', () => {
    for (const [file, kitName, legacy] of [
      ['app/[orgSlug]/admin/org/members/page.tsx', 'MembersKit', 'MembersPageLegacy'],
      ['app/[orgSlug]/admin/org/members/audit/page.tsx', 'AuditLogKit', 'AuditLogPageLegacy'],
    ] as const) {
      const src = readCode(file);
      assert.match(src, new RegExp(`return useAdminKit\\(\\) \\? <${kitName} /> : <${legacy} />;`), `${file}: the switch picks the version`);
      assert.match(src, new RegExp(`function ${legacy}\\(\\)`), `${file}: today's page is still here, whole`);
    }
  });
});

describe('Members — J10-012, J10-021, J10-018, J10-022', () => {
  const page = readCode('components/admin/kit/club/MembersKit.tsx');
  const manage = readCode('components/admin/kit/club/ManageMemberDialog.tsx');

  it('Invite and Manage render only for someone who can manage members (J10-012)', () => {
    assert.match(page, /const canManage = !!userRole && hasCapability\(userRole, userCapabilities, 'manage_members'\);/);
    assert.match(page, /\{canManage && \(\s*<button[\s\S]*?id="members-invite-btn"/);
    assert.match(page, /return canManage && !isSelf;/, 'Manage on a board row needs manage_members');
    assert.match(page, /if \(m\.section === 'coaching_staff'\) return false;/, 'S1-03: coaching staff are never managed here');
  });

  it('ONE Save — one PATCH for role, title, name and access (J10-021)', () => {
    const patches = manage.match(/method: 'PATCH'/g) ?? [];
    assert.equal(patches.length, 2, 'one for Save, one for suspend/reinstate — no mid-dialog "Save Overrides"');
    assert.doesNotMatch(manage, /Save Overrides/);
  });

  it('Suspend asks first, in a question over the form (J10-018)', () => {
    assert.match(manage, /onClick=\{\(\) => setAsk\('suspend'\)\}/);
    assert.match(manage, /ask === 'suspend' && \(\s*<KitDialog\s+kind="question"/);
  });

  it('access overrides and suspension are the owner\'s, as the member route rules (never a control it refuses)', () => {
    assert.match(manage, /const canChangeAccess = viewerIsOwner && !targetIsOwner;/);
    assert.match(manage, /if \(capsChanged\) body\.capabilities/);
    assert.match(manage, /viewerIsOwner && !targetIsOwner && member\.status === 'active'/, 'Suspend… is the owner\'s');
  });

  it('owner-only powers are never offered (J10-022)', () => {
    assert.doesNotMatch(manage, /'billing'|'org_settings'/, 'Plan & billing and settings must not appear as a grant');
  });
});

describe('the morning brief (J4-041) — counts, never money (C04)', () => {
  const route = readCode('app/api/admin/club-brief/route.ts');

  it('reads no amount column anywhere', () => {
    assert.doesNotMatch(route, /amount|_cents|balance|total/i, 'a money column crept into the brief');
  });

  it('a count is present only where the person can act — the acting routes\' roles, never widened', () => {
    assert.match(route, /tryoutApplications: repTeams && actsAs\('tryoutApplications'\)/);
    assert.match(route, /paymentRequests: repMoney && actsAs\('paymentRequests'\)/);
    assert.match(route, /installmentsDue: repMoney && actsAs\('installmentsDue'\)/);
    assert.match(route, /assistantCoaches: repTeams && actsAs\('assistantCoaches'\)/);
  });

  it('the team counts are for someone who can open Rep Teams; the shape is about the org', () => {
    assert.match(route, /\.\.\.\(repTeams && planCarriesModule\(org, 'module_rep_teams'\)\s*\?\s*\{ teams:/);
    assert.match(route, /orgRunsHouseLeague\(\{ \.\.\.org, id: org\.id \}\)/,
      'the hub and the role dropdown answer "does this club run a house league" with ONE function (Ask 2)');
  });

  it('a failed read is an error, never a calm zero', () => {
    assert.match(route, /if \(fail\.error\) return captureAndJson/);
  });
});

describe('the hub — a door only where it opens', () => {
  const hub = readCode('components/admin/kit/club/ClubHubKit.tsx');

  it('every brief card that leads to Rep Teams is a door only for someone who can open Rep Teams', () => {
    // Four specs, four hrefs, each gated on canOpenRepTeams (the treasurer's cards are counts only).
    const gated = hub.match(/canOpenRepTeams \? `\$\{base\}\/rep-teams/g) ?? [];
    assert.equal(gated.length, 3, 'payment requests, installments and assistant coaches');
    assert.match(hub, /if \(!canOpenRepTeams\) return null;/, 'tryout applications');
    assert.match(hub, /return href\s*\? <CoachDoorCard[\s\S]*?: <CoachCard/, 'no href → a plain card, not a link');
  });

  it('owner-only areas show as locked rows for everyone else, never as links', () => {
    assert.match(hub, /\['Plan & billing', 'Settings'\]\.map\(label => \(\s*<div key=\{label\}/);
    assert.match(hub, /Owner only/);
  });

  it('the phone More sheet shows the same locked rows as the rail — not silently absent (/review 2026-09-26)', () => {
    const bar = readCode('components/admin/kit/AdminKitBottomNav.tsx');
    assert.match(bar, /group\('Organization', orgLinks, undefined, orgLockedRows\)/);
    assert.match(bar, /const lockedRow = \(r: KitLockedRow\) => \{[\s\S]*?<div key=\{r\.key\}[^>]*aria-disabled="true"/,
      'a locked row is a div that opens nothing, never a Link');
    assert.match(readCode('components/admin/kit/AdminKitRail.tsx'), /orgLockedRows\.map\(r => <LockedRow/);
  });

  it('the capacity readout sits in the Organization line (v8), and only for a Club with a cap', () => {
    assert.match(hub, /const capacity = club && teams && currentOrg\.teamLimit < 9999/);
  });

  it('no Founding Season and no first-tournament banner on the hub (D6, G01)', () => {
    assert.doesNotMatch(hub, /Founding|First tournament setup|startup-tasks/);
  });
});
