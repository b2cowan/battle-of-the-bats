import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readCode } from './_source-code.ts';

/**
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * CLUB TIER STAGE 1 · SESSION 2 — THE CLUB SCREENS, BEHIND THE ADMIN DESIGN CONTINUITY SWITCH
 * (`docs/projects/active/CLUB_TIER_STAGE1_SCREENS_PROMPT.md`; ratified specimens 1–12, hub v8).
 *
 *   1. THE SWITCH. Every screen here was a kit version that rendered only with the switch on. The release
 *      (2026-09-28) made the kit unconditional; Admin Design Continuity Part B (area 2, 2026-09-29) deleted
 *      the old pages the switch kept, so each page now renders its kit screen alone.
 *   2. NO MONEY ON THE HUB (C04) — the morning brief is counts and ages, never an amount.
 *   3. A DOOR ONLY WHERE IT OPENS — a brief card links only when the person can open its page (the
 *      treasurer's two are plain counts until Stage 3a, owner 2026-09-26); owner-only areas are
 *      LOCKED rows, never links.
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 */

describe('the switch — the hub', () => {
  it('the hub is the club\'s kit hub; the old hub serves only a tournament-only workspace and the no-org moment', () => {
    // Admin Design Continuity Part B, area 2 (2026-09-29): the switch-off half of the condition is gone —
    // `AdminHubClient` still sends a tournament-only workspace to its tournaments.
    const hub = readCode('app/[orgSlug]/admin/AdminHub.tsx');
    assert.match(hub, /if \(!currentOrg \|\| isTournamentOnlyWorkspace\(currentOrg\)\) return <AdminHubClient \/>;/);
    assert.doesNotMatch(hub, /useAdminKit/, 'no switch is read here any more');
    assert.match(hub, /dynamic\(\(\) => import\('@\/components\/admin\/kit\/club\/ClubHubKit'\)\)/,
      'the kit hub stays its own chunk — a static import would move its sheets in the bundle');
    assert.match(readCode('app/[orgSlug]/admin/page.tsx'), /<AdminHub \/>/);
  });

  it('the morning brief provider wraps the whole frame (one read for the hub, the rail and the phone bar)', () => {
    // Admin Design Continuity Part B (2026-09-29): the frame's switch-off branch is gone, so the provider
    // is unconditional; it stays its own chunk.
    const chrome = readCode('app/[orgSlug]/admin/AdminChrome.tsx');
    assert.match(chrome, /<ClubBriefProvider>\{frame\}<\/ClubBriefProvider>/);
    assert.match(chrome, /const ClubBriefProvider = dynamic\(/);
  });
});

describe('the switch — Members, the audit log and Settings', () => {
  it('each page renders its kit screen alone, in its own chunk (the old pages went with Part B, area 2)', () => {
    for (const [file, kitName, legacy] of [
      ['app/[orgSlug]/admin/org/members/page.tsx', 'MembersKit', 'MembersPageLegacy'],
      ['app/[orgSlug]/admin/org/members/audit/page.tsx', 'AuditLogKit', 'AuditLogPageLegacy'],
      ['app/[orgSlug]/admin/org/settings/page.tsx', 'SettingsKit', 'OrgSettingsPageLegacy'],
    ] as const) {
      const src = readCode(file);
      assert.match(src, new RegExp(`return <${kitName} />;`), `${file}: the kit screen renders`);
      assert.match(src, new RegExp(`const ${kitName} = dynamic\\(\\(\\) => import\\('@/components/admin/kit/club/${kitName}'\\)\\);`),
        `${file}: the kit screen stays its own chunk — a static import would move its sheets in the bundle`);
      assert.doesNotMatch(src, new RegExp(`\\b${legacy}\\b|useAdminKit`), `${file}: the old page and the switch are gone`);
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
    // Club Tier Stage 3a (Ask 1): the two money counts follow the ONE money rule the acting routes now
    // ask — whoever holds the club's accounting — so the count is still present only where they can act.
    assert.match(route, /const movesMoney = canOpenRepMoney\(ctx, org\) && canMoveClubMoney\(ctx, org\);/);
    assert.match(route, /paymentRequests: movesMoney,/);
    assert.match(route, /installmentsDue: movesMoney,/);
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

  it('every brief card is a door only for someone who can open where it leads', () => {
    // Club Tier Stage 3a: the treasurer's two money cards became DOORS into Accounting (Stage 1 held
    // them as counts until the screens existed); assistant coaches and tryouts still lead to Rep Teams.
    assert.equal((hub.match(/can\.accounting \? `\$\{base\}\/accounting\//g) ?? []).length, 2, 'payment requests and installments due');
    assert.equal((hub.match(/can\.repTeams \? `\$\{base\}\/rep-teams/g) ?? []).length, 1, 'assistant coaches');
    assert.match(hub, /if \(!can\.repTeams\) return null;/, 'tryout applications');
    assert.match(hub, /return href\s*\? <CoachDoorCard[\s\S]*?: <CoachCard/, 'no href → a plain card, not a link');
  });

  it('owner-only areas show as locked rows for everyone else, never as links', () => {
    assert.match(hub, /\['Plan & billing', 'Settings'\]\.map\(label => \(\s*<div key=\{label\}/);
    assert.match(hub, /Owner only/);
  });

  it('the rail and the phone More sheet list doors only — the locked rows live on the hub alone (owner, 2026-10-01)', () => {
    // Both navs, together: the 2026-09-26 /review's point (the phone sheet must not tell a different
    // story from the rail) still holds — now neither carries a locked row.
    for (const file of ['components/admin/kit/AdminKitRail.tsx', 'components/admin/kit/AdminKitBottomNav.tsx']) {
      assert.doesNotMatch(readCode(file), /Owner only|LockedRow|lockedRow|orgLockedRows/, `${file} lists an owner's area as a locked row`);
    }
    assert.match(readCode('components/admin/kit/AdminKitBottomNav.tsx'), /group\('Organization', orgLinks\)/);
  });

  it('the capacity readout sits in the Organization line (v8), and only for a Club with a cap', () => {
    assert.match(hub, /const capacity = club && teams && currentOrg\.teamLimit < 9999/);
  });

  it('no Founding Season and no first-tournament banner on the hub (D6, G01)', () => {
    assert.doesNotMatch(hub, /Founding|First tournament setup|startup-tasks/);
  });
});

describe('a page title carries no club name above it', () => {
  it('no admin page header puts the organization name in its eyebrow (owner, 2026-10-01)', async () => {
    // The club's name is already in the bar above every admin page, so a page's eyebrow is its trail
    // ("Accounting · Allocations") or nothing — never the name again. Accounting, Rep Teams and House
    // league carried it until the owner, walking §255 S3W1: "we already have it in the nav above".
    const { readdirSync } = await import('node:fs');
    const files: string[] = [];
    const walk = (dir: string) => {
      for (const e of readdirSync(dir, { withFileTypes: true })) {
        const rel = `${dir}/${e.name}`;
        if (e.isDirectory()) walk(rel);
        else if (rel.endsWith('.tsx')) files.push(rel);
      }
    };
    walk('app/[orgSlug]/admin');
    walk('components/admin');
    assert.ok(files.length > 50, 'the walk found the admin screens');
    const offenders = files.filter(f => /eyebrow=\{\s*(currentOrg\??\.name|orgName)\s*\}/.test(readCode(f)));
    assert.deepEqual(offenders, [], 'the club name is already in the bar above');
  });

  it('the hub is titled "Overview", as its rail row and the coaches portal’s overview — never the club’s name', () => {
    const hub = readCode('components/admin/kit/club/ClubHubKit.tsx');
    assert.match(hub, /<AdminPageHeader title="Overview" \/>/);
    assert.doesNotMatch(hub, /title=\{currentOrg\.name\}/);
  });
});
