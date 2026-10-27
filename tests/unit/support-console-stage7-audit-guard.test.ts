/**
 * Support console Stage 7 Part 0 (owner Q10 2026-10-27): the Audit log stops showing strangers' details to every staff
 * role. A lead edit's entry keeps which fields changed and the step, never a value; an entry written before that (the
 * whole lead, before and after) reaches only the growth power (Super admin, Product, Growth) — in the page, its table,
 * the entry window and Same moment (all fed from the page's rows) and the export. Guard 1 of the build prompt.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readCode } from './_source-code.ts';
import { leadAuditValues } from '../../lib/early-access-admin.ts';
import { hiddenEntryLine, LEAD_ENTRY_HIDDEN, MONEY_ENTRY_HIDDEN } from '../../lib/platform-audit-reason.ts';
import { hasPlatformPower } from '../../lib/platform-areas.ts';
import type { PlatformRole } from '../../lib/platform-auth.ts';

const LEAD_BEFORE = {
  id: 'lead-1', updated_at: '2026-10-01T00:00:00Z', internal_status: 'contacted', name: 'Morgan Ellis',
  email: 'morgan@cedarhollow.example', organization_name: 'Cedar Hollow Youth Sports', notes: 'We run 14 teams',
  internal_notes: 'Called twice', next_action: 'Send the deck', last_contacted_by: 'riley@fieldlogichq.ca',
};
const LEAD_AFTER = { ...LEAD_BEFORE, updated_at: '2026-10-27T00:00:00Z', internal_status: 'qualified', next_action: 'Book a call' };
const WORDS = ['Morgan', 'morgan@', 'Cedar Hollow', '14 teams', 'Called twice', 'Send the deck', 'Book a call', 'riley@'];

// An entry as the Audit log stored it before Part 0: the whole lead on both sides.
const OLD_ENTRY = { action: 'update_early_access_lead', reason: null, oldValue: LEAD_BEFORE, newValue: LEAD_AFTER };

/** What the page and the export do to a row, with the role's powers (the same two lines in both readers). */
function asRead(role: PlatformRole, row: typeof OLD_ENTRY) {
  const hidden = hiddenEntryLine(row.action, { money: hasPlatformPower(role, 'find_stripe'), leads: hasPlatformPower(role, 'growth') });
  return hidden ? { ...row, reason: hidden, oldValue: null, newValue: null } : row;
}

describe('Stage 7 Part 0 · lead entries in the Audit log', () => {
  it('a lead edit is written as field names and the step, never a value', () => {
    const { oldValue, newValue } = leadAuditValues(LEAD_BEFORE, LEAD_AFTER);
    assert.deepEqual(oldValue, { internal_status: 'contacted' });
    assert.deepEqual(newValue, { changed: ['internal_status', 'next_action'], internal_status: 'qualified' });
    const text = JSON.stringify({ oldValue, newValue });
    for (const w of WORDS) assert.ok(!text.includes(w), `the entry carries no "${w}"`);
  });

  it('the lead route writes leadAuditValues, not the rows', () => {
    const code = readCode('app/api/platform-admin/early-access/[leadId]/route.ts');
    assert.match(code, /const audit = leadAuditValues\(current as unknown as Record<string, unknown>, data as unknown as Record<string, unknown>\)/);
    assert.match(code, /'update_early_access_lead',\s*leadId,\s*audit\.oldValue,\s*audit\.newValue,/);
    assert.doesNotMatch(code, /'update_early_access_lead',\s*leadId,\s*current,/);
  });

  for (const role of ['support', 'billing', 'read_only'] as PlatformRole[]) {
    it(`an old full-row entry read by ${role} carries no name, email, organization, words or notes`, () => {
      const seen = asRead(role, OLD_ENTRY);
      assert.equal(seen.reason, LEAD_ENTRY_HIDDEN);
      const text = JSON.stringify(seen);
      for (const w of WORDS) assert.ok(!text.includes(w), `${role} never reads "${w}"`);
    });
  }

  for (const role of ['super_admin', 'product', 'growth'] as PlatformRole[]) {
    it(`an old full-row entry read by ${role} carries its details`, () => {
      const seen = asRead(role, OLD_ENTRY);
      assert.deepEqual(seen, OLD_ENTRY);
    });
  }

  it('the refund rule is unchanged by the fold', () => {
    assert.equal(hiddenEntryLine('refund_charge', { money: false, leads: true }), MONEY_ENTRY_HIDDEN);
    assert.equal(hiddenEntryLine('refund_charge', { money: true, leads: false }), null);
    assert.equal(hiddenEntryLine('update_plan', { money: false, leads: false }), null);
  });

  it('the page and the export both filter on the server with the growth power, before anything is sent', () => {
    for (const f of ['app/platform-admin/audit/page.tsx', 'app/api/platform-admin/audit/export/route.ts']) {
      const code = readCode(f);
      assert.match(code, /const readsLeads = hasPlatformPower\(auth\.role, 'growth'\)/, f);
      assert.match(code, /hiddenEntryLine\(\w+\.action, \{ money: readsMoney, leads: readsLeads \}\)/, f);
    }
    // The table, its entry window, Copy and Same moment render only the rows the page hands them.
    const table = readCode('app/platform-admin/audit/AuditTable.tsx');
    assert.doesNotMatch(table, /platform_audit_log|fetch\(/, 'the table never reads entries itself');
  });

  it('no other audit reader can return a lead entry', () => {
    // The Story builders read one club's entries, or a person's listed actions; neither can reach a lead (org_id null).
    const story = readCode('lib/platform-story.ts');
    assert.doesNotMatch(story, /update_early_access_lead/);
  });
});
