import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { adminTabTitle } from '../../lib/admin-tab-title.ts';
import { tournamentSettingsTabs } from '../../lib/admin-kit-nav.ts';
import { TOUR_GROUPS } from '../../components/admin/admin-nav-config.ts';
import { YOUR_NOTIFICATIONS_ITEM } from '../../components/admin/kit/kit-tournament-groups.ts';

/** The browser tab (Stage 13 fix-now 5, F-R2-2 / F-A2-9 / F-O5-8): a tournament's name only on a tournament's pages. */
describe('the admin tab title', () => {
  const chosen = { orgName: 'Harbourtown Minor Ball', tournamentName: 'Harbourtown Invitational 2026', membersLabel: 'Members' };
  it('house league with a tournament chosen: no tournament name', () => {
    assert.equal(adminTabTitle({ ...chosen, pathname: '/harbourtown/admin/house-league/seasons/s1' }), 'House league - Harbourtown Minor Ball - FieldLogicHQ');
  });
  it('the Organization pages with a tournament chosen: no tournament name', () => {
    assert.equal(adminTabTitle({ ...chosen, pathname: '/harbourtown/admin/org' }), 'Organization - Harbourtown Minor Ball - FieldLogicHQ');
    assert.equal(adminTabTitle({ ...chosen, pathname: '/harbourtown/admin/org/members' }), 'Members - Harbourtown Minor Ball - FieldLogicHQ');
    assert.equal(adminTabTitle({ ...chosen, pathname: '/harbourtown/admin/org/tournaments' }), 'Tournaments - Harbourtown Minor Ball - FieldLogicHQ',
      'the organization\'s tournament list is not one tournament\'s page');
  });
  it('rep teams, accounting and the Overview: no tournament name', () => {
    for (const [path, label] of [['rep-teams/teams/t1', 'Rep teams'], ['accounting/budget', 'Accounting'], ['', 'Admin']]) {
      assert.equal(adminTabTitle({ ...chosen, pathname: `/harbourtown/admin${path ? `/${path}` : ''}` }), `${label} - Harbourtown Minor Ball - FieldLogicHQ`);
    }
  });
  it('a tournament\'s pages: the tournament\'s name', () => {
    assert.equal(adminTabTitle({ ...chosen, pathname: '/harbourtown/admin/tournaments/schedule' }), 'Schedule - Harbourtown Invitational 2026 - Harbourtown Minor Ball - FieldLogicHQ');
    assert.equal(adminTabTitle({ ...chosen, pathname: '/harbourtown/admin/tournaments' }), 'Tournaments - Harbourtown Invitational 2026 - Harbourtown Minor Ball - FieldLogicHQ');
    assert.equal(adminTabTitle({ ...chosen, pathname: '/harbourtown/admin/tournaments/preview/abc' }), 'Preview Site - Harbourtown Invitational 2026 - Harbourtown Minor Ball - FieldLogicHQ');
  });
  it('⚖ navigation Phase 2 Part B: the sidebar\'s words; the organization\'s tournament screens carry no tournament name', () => {
    const t = (p: string) => adminTabTitle({ ...chosen, pathname: `/harbourtown/admin/tournaments/${p}` });
    assert.equal(t('registrations'), 'Teams - Harbourtown Invitational 2026 - Harbourtown Minor Ball - FieldLogicHQ');
    assert.equal(t('branding'), 'Public site - Harbourtown Invitational 2026 - Harbourtown Minor Ball - FieldLogicHQ');
    assert.equal(t('settings/notifications'), 'Your notifications - Harbourtown Invitational 2026 - Harbourtown Minor Ball - FieldLogicHQ');
    assert.equal(t('check-in'), 'Check-in - Harbourtown Invitational 2026 - Harbourtown Minor Ball - FieldLogicHQ');
    assert.equal(t('manage'), 'Tournaments - Harbourtown Minor Ball - FieldLogicHQ');
    assert.equal(t('settings/web-address'), 'Web address - Harbourtown Minor Ball - FieldLogicHQ');
    assert.equal(t('settings/subscription'), 'Plan & billing - Harbourtown Minor Ball - FieldLogicHQ');
    assert.equal(t('settings/members/audit'), 'Audit log - Harbourtown Minor Ball - FieldLogicHQ');
  });
  it('the tab says the sidebar\'s word for every event row and every Settings & access tab — the two lists cannot drift', () => {
    const rows = [...TOUR_GROUPS.flatMap(g => g.items), YOUR_NOTIFICATIONS_ITEM].filter(i => !['settings', 'manage'].includes(i.key));
    for (const row of rows) {
      assert.equal(adminTabTitle({ pathname: `/h/admin/tournaments/${row.key}`, orgName: 'O', tournamentName: 'E', membersLabel: 'Members' }), `${row.label} - E - O - FieldLogicHQ`, row.key);
    }
    for (const tab of tournamentSettingsTabs('/h/admin', { members: true, payouts: true, pdf: true })) {
      assert.equal(adminTabTitle({ pathname: tab.href, orgName: 'O', tournamentName: 'E', membersLabel: 'Members' }), `${tab.label} - O - FieldLogicHQ`, tab.id);
    }
  });
  it('no tournament chosen, and a one-team workspace\'s people page', () => {
    assert.equal(adminTabTitle({ pathname: '/x/admin/tournaments/results', orgName: 'Falcons', tournamentName: null, membersLabel: 'Members' }), 'Results - Falcons - FieldLogicHQ');
    assert.equal(adminTabTitle({ pathname: '/x/admin/org/members', orgName: 'Falcons', membersLabel: 'Staff & access' }), 'Staff & access - Falcons - FieldLogicHQ');
  });
});
