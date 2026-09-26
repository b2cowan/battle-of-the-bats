import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { whatTheyCanOpen } from '../../lib/member-access.ts';
import { auditChangeSentence, describeOverrideChange, MEMBER_AUDIT_ACTIONS } from '../../lib/member-audit.ts';
import {
  accessSummary, accessShort, overrideChips, consequence, roleGuideCell,
} from '../../components/admin/kit/club/member-summary.ts';
import { boardOrder, memberFirstName, type KitMember } from '../../components/admin/kit/club/members-types.ts';
import type { OrgRole } from '../../lib/types.ts';

/**
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * THE MEMBERS SCREEN'S WORDS (Club Tier Stage 1, specimen 5) and THE AUDIT LOG'S SENTENCES
 * (specimen 11) — every word about access comes from the one access computation, so the screen
 * cannot tell an owner something the gates do not do.
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 */

const club = { planId: 'club' as const, subscriptionStatus: 'active' as const, enabledAddons: [], freeFloor: undefined };
const tournamentPlan = { planId: 'tournament' as const, subscriptionStatus: 'active' as const, enabledAddons: [], freeFloor: undefined };
const access = (role: OrgRole, capabilities: Record<string, boolean> | null = null, org: Parameters<typeof whatTheyCanOpen>[1] = club) =>
  whatTheyCanOpen({ role, capabilities }, org);

describe('"What they can open" (J10-024) — read from the role, the plan and any changes', () => {
  it('the drawn rows (specimen 5)', () => {
    assert.equal(accessSummary('owner', access('owner')), 'Everything, including plan & billing');
    assert.equal(accessSummary('admin', access('admin')), 'Every program on the plan');
    assert.equal(accessSummary('treasurer', access('treasurer')), 'Accounting · the team names it allocates to');
    assert.equal(accessSummary('staff', access('staff')), 'Tournaments on game day');
  });

  it('a change from the role\'s default is a chip, never folded into the sentence', () => {
    const sam = access('admin', { module_families: true, module_accounting: false });
    assert.equal(accessSummary('admin', sam), 'Every program on the plan', 'the sentence is the ROLE; the chips are the changes');
    assert.deepEqual(overrideChips(sam).map(c => c.text), ['– Accounting', '+ Families']);
  });

  it('an override that restates the default is not a change', () => {
    assert.deepEqual(overrideChips(access('admin', { module_accounting: true })), []);
  });

  it('on a Tournament plan an admin still opens "every program on the plan"', () => {
    assert.equal(accessSummary('admin', access('admin', null, tournamentPlan)), 'Every program on the plan');
  });

  it('the phone line says the same thing in fewer words', () => {
    assert.equal(accessShort('owner', access('owner')), 'everything');
    assert.equal(accessShort('treasurer', access('treasurer')), 'Accounting');
    assert.equal(accessShort('staff', access('staff')), 'game day');
  });
});

describe('Manage — the consequence sentence (J10-023)', () => {
  it('says what closing a program takes away, in the drawn words', () => {
    assert.equal(
      consequence('module_accounting', true, false, 'Sam', 'club'),
      'Sam will no longer see the club’s ledgers, budget or allocations.',
    );
  });

  it('opening Families names the personal information it opens', () => {
    assert.match(consequence('module_families', false, true, 'Sam', 'club') ?? '', /contact details, consent and balances/);
  });

  it('a change that alters nothing they can open says nothing', () => {
    assert.equal(consequence('module_accounting', true, true, 'Sam', 'club'), null);
  });
});

describe('the Role Guide (J10-004 / A13) — from the role defaults', () => {
  it('matches the drawn matrix', () => {
    assert.equal(roleGuideCell('admin', 'rep-teams'), '✓');
    assert.equal(roleGuideCell('treasurer', 'rep-teams'), 'team names only', 'Ask 1: no Rep Teams door for a treasurer');
    assert.equal(roleGuideCell('treasurer', 'accounting'), '✓');
    assert.equal(roleGuideCell('staff', 'league-tournaments'), 'game day');
    assert.equal(roleGuideCell('official', 'league-tournaments'), 'scores & gate');
    assert.equal(roleGuideCell('admin', 'families'), 'if you turn it on');
    assert.equal(roleGuideCell('treasurer', 'members'), 'view');
    assert.equal(roleGuideCell('admin', 'members'), '✓');
    assert.equal(roleGuideCell('coach', 'rep-teams'), 'their team, in the portal');
  });

  it('plan & billing, settings and the audit log are the owner\'s, and only the owner\'s', () => {
    for (const role of ['admin', 'treasurer', 'staff', 'official', 'league_admin', 'league_registrar', 'coach'] as const) {
      assert.equal(roleGuideCell(role, 'owner-only'), '—', `${role} must not read as holding an owner-only power`);
    }
    assert.equal(roleGuideCell('owner', 'owner-only'), '✓');
  });

  it('never tells an owner Families is on by default for anyone (Families plan §5.3)', () => {
    for (const role of ['admin', 'treasurer', 'staff', 'official', 'league_admin', 'league_registrar', 'coach'] as const) {
      assert.notEqual(roleGuideCell(role, 'families'), '✓', `${role} would read as opening Families by default`);
    }
  });
});

describe('the board order — defined (the old list had none, ADC slice 0)', () => {
  const m = (id: string, role: OrgRole, status: KitMember['status'], displayName: string | null): KitMember => ({
    id, userId: id, email: `${id}@example.com`, displayName, title: null, role, status, capabilities: null,
    invitedAt: '2026-09-01T00:00:00Z', acceptedAt: null, lastSignIn: null, assignedTournamentIds: [], repGroupIds: [],
    section: 'board', access: [],
  });

  it('owner, then the roles that run the club, then helpers; an unanswered invitation last', () => {
    const rows = [
      m('j', 'admin', 'invited', 'Jordan Lee'),
      m('l', 'staff', 'active', 'Luis Ortega'),
      m('p', 'treasurer', 'active', 'Priya Nair'),
      m('d', 'owner', 'active', 'Dana Whitfield'),
      m('s', 'admin', 'active', 'Sam Okafor'),
    ];
    assert.deepEqual([...rows].sort(boardOrder).map(r => r.id), ['d', 's', 'p', 'l', 'j'], 'specimen 5\'s order');
    assert.deepEqual([...rows].reverse().sort(boardOrder).map(r => r.id), ['d', 's', 'p', 'l', 'j'], 'stable whatever the read order');
  });

  it('a sentence about someone uses their first name, or "They"', () => {
    assert.equal(memberFirstName({ displayName: 'Sam Okafor' }), 'Sam');
    assert.equal(memberFirstName({ displayName: null }), 'They');
  });
});

describe('the audit log reads as sentences (specimen 11)', () => {
  it('the drawn rows', () => {
    assert.equal(auditChangeSentence('member_invited', { role: 'admin' }), 'Invited as Admin');
    assert.equal(auditChangeSentence('role_changed', { before: 'staff', after: 'admin' }), 'Role changed: Staff → Admin');
    assert.equal(
      auditChangeSentence('capabilities_changed', { before: null, after: { module_families: true } }),
      'Access changed: Families turned on',
    );
    assert.equal(auditChangeSentence('member_suspended', {}), 'Suspended');
    assert.equal(auditChangeSentence('member_reinstated', {}), 'Reinstated');
    assert.equal(auditChangeSentence('member_removed', { email: 'r.gill@example.com', role: 'staff' }), 'Removed');
  });

  it('a removed override says it went back to the role\'s default; tournament verbs are one phrase', () => {
    assert.deepEqual(
      describeOverrideChange({ module_accounting: false, submit_scores: true }, { update_schedule: false }),
      ['Accounting back to the role’s default', 'tournament controls changed'],
    );
  });

  it('a change to managing members is named, never lumped in with tournament controls (/review 2026-09-26)', () => {
    assert.deepEqual(describeOverrideChange(null, { manage_members: true }), ['Managing members turned on']);
  });

  it('the board\'s log is member changes only — no billing events', () => {
    assert.ok(!MEMBER_AUDIT_ACTIONS.some(a => a.startsWith('plan_') || a.includes('cancel') || a.includes('billing')));
  });
});
