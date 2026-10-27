/**
 * Support console Stage 7 loose ends (owner 2026-10-27): "asked not to be contacted" is a lasting mark (mig 404), the old
 * lead entries in the Audit log keep no words (mig 405), a refused hand link is said inside the picker, a club older
 * than its lead is not counted as 0 days, and Month by month carries a "started a subscription" figure.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { readCode } from './_source-code.ts';
import { LEAD_ACTIONS } from '../../lib/platform-audit-reason.ts';

const MIGRATIONS = path.join(import.meta.dirname, '..', '..', 'supabase', 'migrations');
const sql = (name: string) => readFileSync(path.join(MIGRATIONS, name), 'utf8');

describe('Stage 7 loose ends · the lasting do-not-contact mark', () => {
  it('the test reads the mark as well as the step and reason, and the callers still pass the whole lead', () => {
    const code = readCode('lib/lead-writes.ts');
    assert.match(code, /return !!l\.doNotContactAt \|\| \(l\.step === 'lost' && l\.lostReason === 'asked_not_to_contact'\)/);
    assert.match(code, /list\.value\.filter\(x => x\.consent && !askedNotToBeContacted\(x\)\)/, 'Copy emails');
    assert.match(readCode('app/api/platform-admin/early-access/export/route.ts'), /askedNotToBeContacted\(l\) \? '' : l\.email/, 'the export');
    assert.match(readCode('lib/lead-book.ts'), /doNotContactAt: r\.do_not_contact_at/, 'the book carries the mark');
  });

  it('the save sets the mark once; a step move never clears it; only Allow contact again does, and never while Lost for that reason', () => {
    const patch = readCode('app/api/platform-admin/early-access/[leadId]/route.ts');
    assert.match(patch, /if \(reason === 'asked_not_to_contact' && !current\.do_not_contact_at\) update\.do_not_contact_at = now;/);
    assert.doesNotMatch(patch, /do_not_contact_at = null/, 'the PATCH never lifts it');
    const link = readCode('lib/lead-writes.ts');
    const linkBody = link.slice(link.indexOf('export async function linkLead'), link.indexOf('export async function unlinkLead'));
    assert.doesNotMatch(linkBody, /do_not_contact_at/, 'a link neither sets nor lifts it');
    const allow = link.slice(link.indexOf('export async function allowContactAgain'));
    assert.match(allow, /if \(lead\.lost_reason === 'asked_not_to_contact'\)/, 'refused while still Lost for it');
    assert.match(allow, /\.not\('do_not_contact_at', 'is', null\)\.or\('lost_reason\.is\.null,lost_reason\.neq\.asked_not_to_contact'\)/, 'conditioned, null-safe');
    assert.match(allow, /writePlatformAuditLog\(actor, null, 'allow_early_access_contact'/);
    assert.match(readCode('app/api/platform-admin/early-access/[leadId]/allow-contact/route.ts'), /requirePlatformPower\('growth'\)/);
  });

  it('the new action is a lead entry (growth-only details) in every registry', () => {
    assert.ok(LEAD_ACTIONS.has('allow_early_access_contact'));
    assert.match(readCode('lib/platform-audit-doors.ts'), /allow_early_access_contact: LEADS/);
    assert.match(readCode('lib/lead-timeline.ts'), /a\.action === 'allow_early_access_contact'/);
    assert.match(readCode('app/platform-admin/audit/page.tsx'), /allow_early_access_contact: /);
  });

  it('the migration back-fills and pins the one-way rule', () => {
    const m = sql('404_a_lead_who_asked_not_to_be_contacted_stays_so.sql');
    assert.match(m, /ADD COLUMN IF NOT EXISTS do_not_contact_at timestamptz/);
    assert.match(m, /WHERE lost_reason = 'asked_not_to_contact' AND do_not_contact_at IS NULL/);
    assert.match(m, /CHECK \(lost_reason IS DISTINCT FROM 'asked_not_to_contact' OR do_not_contact_at IS NOT NULL\)/);
  });
});

describe('Stage 7 loose ends · the old Audit log entries', () => {
  it('migration 405 rewrites only lead edits that still hold a whole lead, keeping the step and the field names', () => {
    const m = sql('405_old_lead_log_entries_keep_no_words.sql');
    assert.match(m, /WHERE a\.action = 'update_early_access_lead'/);
    for (const key of ['name', 'email', 'organization_name', 'internal_notes', 'notes']) assert.ok(m.includes(`'${key}'`), key);
    assert.match(m, /'internal_status', a\.new_value -> 'internal_status'/);
    assert.match(m, /old_value = jsonb_build_object\('internal_status', a\.old_value -> 'internal_status'\)/);
    assert.doesNotMatch(m, /DELETE|TRUNCATE|DROP/i, 'it rewrites rows; it removes none');
  });
});

describe('Stage 7 loose ends · a refused hand link is said inside the window', () => {
  it('the picker takes the refusal back and shows it; the page-level error is not where it lands', () => {
    const code = readCode('app/platform-admin/early-access/[leadId]/LeadRecord.tsx');
    assert.match(code, /onPick: \(c: Club\) => Promise<string \| null>/);
    assert.match(code, /onPick\(c\)\.then\(refusal => \{ if \(refusal\) setError\(refusal\); \}\)/);
    const picker = code.slice(code.indexOf("{win === 'picker' && ("), code.indexOf('<UnsavedChangesGuard'));
    assert.match(picker, /if \(!ok\) return errorOf\(data,/);
    assert.doesNotMatch(picker, /act\(/, 'the link no longer goes through the page-level act()');
  });
});
