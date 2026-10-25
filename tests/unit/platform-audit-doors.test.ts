import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { auditDoors, isScheduledEntry } from '../../lib/platform-audit-doors.ts';

const all = () => true;
const base = { orgId: 'org-1', orgName: 'UAT Lakeshore Lynx', orgEntriesHref: '/platform-admin/audit?orgId=org-1' };

describe('audit entry doors', () => {
  it('an org entry opens the org and its entries', () => {
    const doors = auditDoors({ ...base, action: 'update_org_plan_and_limit', canView: all });
    assert.deepEqual(doors.map(d => d.label), ['Open org', "Show this org's entries"]);
    assert.equal(doors[0].href, '/platform-admin/orgs/org-1');
    assert.equal(doors[1].href, base.orgEntriesHref);
  });

  it('a feedback entry opens Feedback, then the org when it has one', () => {
    assert.deepEqual(auditDoors({ ...base, action: 'update_feedback_status', canView: all }).map(d => d.label), ['Open Feedback', 'Open org']);
    assert.deepEqual(auditDoors({ ...base, orgId: null, orgName: null, action: 'update_feedback_status', canView: all }).map(d => d.label), ['Open Feedback']);
  });

  it('a door is named for the console menu, not the old page name', () => {
    const labels = ['update_early_access_lead', 'invite_platform_user', 'run_bulk_operation', 'update_plan_gating']
      .map(a => auditDoors({ action: a, orgId: null, orgName: null, orgEntriesHref: '', canView: all })[0].label);
    assert.deepEqual(labels, ['Open Leads', 'Open Staff', 'Open Bulk changes', 'Open Plans & pricing']);
  });

  it("the scheduler's own entry has nothing to open, even if it ever carried an org", () => {
    for (const a of ['club_domains_tick', 'club_hand_back_sweep', 'coach_sandbox_tick']) {
      assert.equal(isScheduledEntry(a, 'cron-scheduler'), true, a);
      assert.deepEqual(auditDoors({ action: a, orgId: null, orgName: null, orgEntriesHref: '', canView: all, scheduled: true }), []);
    }
    assert.deepEqual(auditDoors({ ...base, action: 'club_domains_tick', canView: all, scheduled: true }), []);
    assert.equal(isScheduledEntry('update_plan', 'cron-scheduler'), false);
  });

  it("the same job run by hand is the person's entry, not the scheduler's", () => {
    assert.equal(isScheduledEntry('observability_sweep', 'owner@example.com'), false);
    assert.equal(isScheduledEntry('club_domains_tick', 'owner@example.com'), false);
  });

  it('a reset link opens People and a campaign opens Campaigns', () => {
    const one = (a: string) => auditDoors({ action: a, orgId: null, orgName: null, orgEntriesHref: '', canView: all })[0].label;
    assert.equal(one('generate_reset_link'), 'Open People');
    assert.equal(one('create_catalog_campaign'), 'Open Campaigns');
  });

  it('an org that no longer exists gets no org door, so nothing can lead to a missing page', () => {
    assert.deepEqual(auditDoors({ ...base, orgName: null, action: 'delete_organization', canView: all }), []);
  });

  it('a screen the role cannot open is dropped, never left to dead-end', () => {
    const noStaff = (area: string) => area !== 'platform_users';
    assert.deepEqual(auditDoors({ action: 'invite_platform_user', orgId: null, orgName: null, orgEntriesHref: '', canView: noStaff }), []);
    const noClubs = (area: string) => area !== 'organizations';
    assert.deepEqual(auditDoors({ ...base, action: 'update_plan', canView: noClubs }), []);
  });

  it('never offers more than two doors', () => {
    for (const a of ['update_plan', 'update_feedback_status', 'run_bulk_operation', 'ban_user']) {
      assert.ok(auditDoors({ ...base, action: a, canView: all }).length <= 2, a);
    }
  });
});
