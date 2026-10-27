/**
 * Support console Stage 7 — the build prompt's guards 2 and 6–12 (guard 1: `support-console-stage7-audit-guard`;
 * guards 3–4: `support-console-stage7-numbers`). Source guards where the rule is a call's place, behaviour where the
 * rule is pure.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readCode, filesUnder } from './_source-code.ts';
import { formulaSafe, formulaSafeRow } from '../../lib/export/formula-safe.ts';
import { leadAuditValues, LOST_REASON_LABELS, LEAD_SOURCE_LABELS, EARLY_ACCESS_STATUS_LABELS } from '../../lib/early-access-admin.ts';
import { hiddenEntryLine, isLeadEntry, LEAD_ACTIONS, LEAD_ENTRY_HIDDEN } from '../../lib/platform-audit-reason.ts';

const LEAD_ROUTES = [
  'app/api/platform-admin/early-access/[leadId]/route.ts',
  'app/api/platform-admin/early-access/[leadId]/link/route.ts',
  'app/api/platform-admin/early-access/[leadId]/dismiss/route.ts',
  'app/api/platform-admin/early-access/[leadId]/notes/route.ts',
  'app/api/platform-admin/early-access/[leadId]/notes/[noteId]/route.ts',
  'app/api/platform-admin/early-access/clubs/route.ts',
  'app/api/platform-admin/early-access/copy-emails/route.ts',
  'app/api/platform-admin/early-access/export/route.ts',
  'app/api/platform-admin/early-access/numbers-export/route.ts',
];

describe('Stage 7 guard 2 · server rules', () => {
  it('every lead route asks the growth power before it reads anything', () => {
    for (const f of LEAD_ROUTES) {
      const code = readCode(f);
      for (const handler of code.split(/export const (?:GET|POST|PATCH|DELETE) = /).slice(1)) {
        const power = handler.indexOf("requirePlatformPower('growth')");
        assert.ok(power >= 0, `${f}: a handler without the growth power`);
        for (const read of ['supabaseAdmin', 'readLeadBook', 'readList', 'findClubs', 'linkLead', 'addNote', 'removeNote', 'dismissOffer', 'copyEmails']) {
          const at = handler.indexOf(read);
          assert.ok(at < 0 || at > power, `${f}: ${read} before the growth power`);
        }
      }
    }
  });

  it('the two pages ask the growth power before a lead is read', () => {
    for (const f of ['app/platform-admin/early-access/page.tsx', 'app/platform-admin/early-access/[leadId]/page.tsx']) {
      const code = readCode(f);
      const gate = code.indexOf("if (!hasPlatformPower(auth.role, 'growth')) redirect('/platform-admin')");
      assert.ok(gate > 0, f);
      for (const read of ['readLeadBook(', "from('early_access_leads')"]) {
        const at = code.indexOf(read);
        assert.ok(at < 0 || at > gate, `${f}: ${read} before the gate`);
      }
    }
  });

  it('a malformed lead id or body is refused', () => {
    for (const f of LEAD_ROUTES.filter(r => r.includes('[leadId]'))) assert.match(readCode(f), /isUuid\(leadId\)/, f);
    const patch = readCode('app/api/platform-admin/early-access/[leadId]/route.ts');
    assert.match(patch, /if \(!body \|\| typeof body !== 'object' \|\| Array\.isArray\(body\)\)/);
    assert.match(patch, /PICKABLE_STATUSES as readonly unknown\[\]\)\.includes\(body\.step\)/);
    assert.match(patch, /!isLostReason\(body\.lostReason\)/);
    assert.match(patch, /!isLeadSource\(body\.source\)/);
  });

  it('Lost needs a reason, refused by the server; Signed up is never picked, only linked', () => {
    const patch = readCode('app/api/platform-admin/early-access/[leadId]/route.ts');
    assert.match(patch, /if \(nextStep === 'lost'\) \{[\s\S]*?if \(!isLostReason\(reason\)\)/);
    assert.match(readCode('lib/early-access-admin.ts'), /PICKABLE_STATUSES = EARLY_ACCESS_STATUSES\.filter\(s => s !== 'converted'\)/, 'Signed up is not pickable');
    assert.match(patch, /if \(current\.linked_at\) \{\s*return NextResponse\.json\(\{ error: 'This lead has a club linked/);
  });

  it('removing a note is the Super admin’s alone', () => {
    assert.match(readCode('app/api/platform-admin/early-access/[leadId]/notes/[noteId]/route.ts'), /if \(!hasPlatformPower\(auth\.role, 'delete_records'\)\) return NextResponse\.json/);
  });
});

describe('Stage 7 guard 6 · a stranger’s words render as text', () => {
  it('no lead screen renders markup or builds a link from a lead’s words', () => {
    for (const f of filesUnder('app/platform-admin/early-access', '.tsx')) {
      const code = readCode(f);
      assert.doesNotMatch(code, /dangerouslySetInnerHTML/, f);
      assert.doesNotMatch(code, /href=\{[^}]*(email|notes|words|organization|name)[^}]*\}/i, `${f}: a link built from a lead's words`);
      assert.doesNotMatch(code, /mailto:/, f);
    }
  });

  it('a lead edit’s audit entry never carries a script typed into a field', () => {
    const before = { internal_status: 'new', name: '<script>alert(1)</script>', notes: '<img onerror=x>', source: null };
    const after = { ...before, internal_status: 'contacted', source: 'search', next_action: '<script>' };
    const text = JSON.stringify(leadAuditValues(before, after));
    assert.doesNotMatch(text, /<script>|onerror/);
    assert.match(text, /"source":"search"/, 'fixed-list codes are kept');
  });
});

describe('Stage 7 guard 7 · the export and Copy emails', () => {
  it('makes a formula cell safe in every column, an address starting with = included', () => {
    for (const bad of ['=HYPERLINK("x")', '+1', '-2', '@SUM(A1)', '\tx', '\rx']) assert.equal(formulaSafe(bad), `'${bad}`);
    assert.equal(formulaSafe('=evil@example.com'), "'=evil@example.com");
    assert.equal(formulaSafe('morgan@example.com'), 'morgan@example.com');
    assert.equal(formulaSafe(12), 12);
    assert.deepEqual(formulaSafeRow(['a', '=b', null]), ['a', "'=b", null]);
  });

  it('the lead export writes its audit entry before the file, and sends nothing when it cannot', () => {
    const code = readCode('app/api/platform-admin/early-access/export/route.ts');
    const record = code.indexOf('recordExport(');
    assert.ok(record > 0 && record < code.indexOf('formulaSafeRow('), 'the audit entry comes first');
    assert.match(code, /if \(!\(await recordExport\([^)]*\)\)\) \{\s*return NextResponse\.json\(\{ error: 'The export could not be recorded/);
    assert.match(code, /askedNotToBeContacted\(l\) \? '' : l\.email/, 'Do not contact: an empty email cell');
    assert.doesNotMatch(code, /\.limit\(1000\)/, 'no 1,000-row cap');
    assert.match(readCode('lib/lead-writes.ts'), /writePlatformAuditLogStrict\(actor, null, 'export_early_access_leads'/);
  });

  it('every export a stranger’s words reach is formula-safe, the Audit log’s included', () => {
    for (const f of ['app/api/platform-admin/early-access/export/route.ts', 'app/api/platform-admin/early-access/numbers-export/route.ts', 'app/api/platform-admin/audit/export/route.ts']) {
      assert.match(readCode(f), /formulaSafeRow\(/, f);
    }
  });

  it('Copy emails: said yes, never asked not to be contacted, and an audit entry with no addresses', () => {
    const code = readCode('lib/lead-writes.ts');
    assert.match(code, /list\.value\.filter\(x => x\.consent && !askedNotToBeContacted\(x\)\)/);
    assert.match(code, /'copy_early_access_emails', 'list', null, \{ count: emails\.length, list: listWords\(l\) \}/);
  });
});

describe('Stage 7 guard 8 · notes', () => {
  it('a note is never edited; a removal keeps who and when and drops the text', () => {
    const mig = readCode('supabase/migrations/398_support_console_leads_pipeline.sql');
    assert.match(mig, /CREATE TRIGGER early_access_lead_notes_never_edited\s+BEFORE UPDATE/);
    assert.match(mig, /OR NEW\.body IS NOT NULL THEN\s+RAISE EXCEPTION 'a lead note is never edited/);
    assert.match(mig, /\(removed_at IS NOT NULL AND removed_by IS NOT NULL AND body IS NULL\)/);
    assert.match(readCode('lib/lead-writes.ts'), /\.update\(\{ body: null, removed_by: normalAddress\(actor\), removed_at:/);
    assert.match(readCode('lib/lead-timeline.ts'), /title: 'A note was removed'/);
  });
});

describe('Stage 7 guard 9 · the Story', () => {
  it('a club’s lead entries are filtered in the database read for roles without the growth power', () => {
    const story = readCode('lib/platform-story.ts');
    assert.match(story, /opts\.leads \? auditQuery : auditQuery\.not\('action', 'in', `\(\$\{\[\.\.\.LEAD_ACTIONS\]\.join\(','\)\}\)`\)/);
    for (const f of ['app/platform-admin/orgs/[id]/page.tsx', 'app/api/platform-admin/orgs/[id]/story/route.ts']) {
      assert.match(readCode(f), /leads: hasPlatformPower\(auth\.role, 'growth'\)/, f);
    }
  });

  it('every lead action is a lead entry in the Audit log, hidden from roles that do not work leads', () => {
    for (const a of LEAD_ACTIONS) {
      assert.ok(isLeadEntry(a), a);
      assert.equal(hiddenEntryLine(a, { money: true, leads: false }), LEAD_ENTRY_HIDDEN, a);
    }
  });

  it('any audit write that names an early-access action is on the lead list — a new one cannot slip past the filter', () => {
    const written = new Set<string>();
    for (const dir of ['lib', 'app']) {
      for (const ext of ['.ts', '.tsx']) {
        for (const f of filesUnder(dir, ext)) {
          const code = readCode(f);
          if (!/writePlatformAuditLog(?:Strict)?\(/.test(code)) continue;
          // An action is a verb_phrase (`link_early_access_lead`); a table, a column or an area key is not.
          for (const m of code.matchAll(/['"`]((?:update|link|unlink|dismiss|add|remove|copy|export|create|delete|confirm|set|clear|send|save|merge)_[a-z_]*early_access[a-z_]*)['"`]/g)) written.add(m[1]);
        }
      }
    }
    assert.ok(written.size > 0, 'the scan found no early-access action at all — the scan is broken');
    for (const action of written) {
      assert.ok(LEAD_ACTIONS.has(action), `${action} is written to the audit log but is not in LEAD_ACTIONS, so every staff role would read its details`);
    }
  });
});

describe('Stage 7 guard 10 · Today', () => {
  it('a retired campaign is never counted (headline 1)', () => {
    assert.match(readCode('lib/platform-waiting.ts'), /\(tmplRes\.data \?\? \[\]\)\.filter\(r => live\.has\(r\.key as string\)\)/);
  });
  it('the three lead rows follow the rulebook (the Leads entry) and the menu pill counts Needs you', () => {
    const code = readCode('lib/platform-waiting.ts');
    for (const key of ['new_leads', 'follow_ups_due', 'signup_to_confirm']) assert.match(code, new RegExp(`key: '${key}', group: 'growth'[^\\n]*entry: 'early_access'`), key);
    assert.match(code, /if \(q\.count > 0 && entryCounts\[q\.entry\] === undefined\)/, 'a named entry count replaces the sum');
    assert.match(code, /entryCounts: wantsLeads && leads \? \{ early_access: leads\.needYou \} : \{\}/);
    assert.match(readCode('app/api/platform-admin/waiting/route.ts'), /countsByEntry\(queues, entryCounts\)/);
    assert.match(code, /notRead: true/, 'a failed lead read is "Not read" on Today, never 0');
  });
});

describe('Stage 7 guard 11 · words and the clock', () => {
  it('the new labels are the ruled words', () => {
    assert.equal(EARLY_ACCESS_STATUS_LABELS.converted, 'Signed up');
    assert.equal(EARLY_ACCESS_STATUS_LABELS.pilot_candidate, 'Pilot');
    assert.equal(LOST_REASON_LABELS.asked_not_to_contact, 'Asked not to be contacted');
    assert.equal(LEAD_SOURCE_LABELS.tournament, 'A tournament on FieldLogicHQ');
  });
  it('the timeline and the lead screens print times through the console clock, never by hand', () => {
    for (const f of ['lib/lead-timeline.ts', 'lib/lead-views.ts', 'app/platform-admin/early-access/[leadId]/page.tsx']) {
      assert.doesNotMatch(readCode(f), /toLocaleTimeString|toLocaleDateString|hour: '2-digit'/, f);
    }
  });
  it('Promotions changes labels only: the route, the table and the stored value keep their names', () => {
    const client = readCode('app/platform-admin/plans-pricing/PlansPricingClient.tsx');
    assert.match(client, /'\/api\/platform-admin\/product-catalog\/campaigns'/);
    assert.match(readCode('app/platform-admin/change-requests/ChangeRequestsClient.tsx'), /\{ value: 'campaign', label: 'Promotion' \}/);
    assert.doesNotMatch(client, />Campaign tracking</);
  });
});

/** Guard 12: each of the drawings' 16 threats has its guard here, or a named reason it cannot. */
const THREATS: Record<number, string> = {
  1: 'guard 2 (server rules) + support-console-stage7-audit-guard',
  2: 'guard 7 (the export)',
  3: 'guard 7 (Copy emails)',
  4: 'OWED: Part 8 (the public form’s overwrite fix) is not built yet',
  5: 'support-console-stage7-numbers (the match)',
  6: 'support-console-stage7-numbers ("the public form computes no match")',
  7: 'guard 9 (the Story)',
  8: 'support-console-stage7-numbers (demo never, deleted still counted)',
  9: 'guard 6 (rendering)',
  10: 'OWED: Part 8 (the throttle, owner build-gate answer §6-4); the captcha is a later pass',
  11: 'guard 8 (notes) + guard 1; erasing a lead is Stage 8',
  12: 'lib/lead-timeline.ts builds fixed sentences only; guard 2 (growth power)',
  13: 'guard 2 (malformed ids and bodies)',
  14: 'support-console-stage7-numbers ("Not read", never 0)',
  15: 'NOT BUILT: deck opens are not counted (owner Q8)',
  16: 'OWED: Part 8 (the link tag list)',
};

describe('Stage 7 guard 12 · the threat list', () => {
  it('names a guard, or why there is none, for all 16 threats', () => {
    assert.deepEqual(Object.keys(THREATS).map(Number), Array.from({ length: 16 }, (_, i) => i + 1));
    for (const [n, why] of Object.entries(THREATS)) assert.ok(why.length > 10, `threat ${n}`);
  });
});

describe('Stage 7 finish pass · what /review found and fixed', () => {
  it('a CSV cell with a bare carriage return is quoted, so a stranger’s text cannot start a new record', async () => {
    const { generateCSV } = await import('../../lib/export/csv.ts');
    assert.equal(generateCSV(['a'], [['x\r=1+1']]), 'a\n"x\r=1+1"');
  });

  it('a made-up step in the address never widens a file or a copy past the screen', () => {
    const code = readCode('lib/lead-writes.ts');
    // The scope test reads the VALIDATED step (an unknown one is empty), as the Leads screen does.
    assert.match(code, /const step = \(EARLY_ACCESS_STATUSES as readonly string\[\]\)\.includes\(asked\) \? asked : ''/);
    assert.match(code, /scope: sp\.get\('scope'\) === 'all' \|\| step \? 'all' : 'needs'/);
  });

  it('Copy emails writes its audit entry before the addresses leave, and refuses without it', () => {
    const code = readCode('lib/lead-writes.ts');
    assert.match(code, /await writePlatformAuditLogStrict\(actor, null, 'copy_early_access_emails'/);
    assert.doesNotMatch(code, /writePlatformAuditLog\(actor, null, 'copy_early_access_emails'/);
  });

  it('a link can never lift "asked not to be contacted", and a second press changes nothing', () => {
    const code = readCode('lib/lead-writes.ts');
    assert.match(code, /if \(askedNotToBeContacted\(\{ step: lead\.internal_status as EarlyAccessStatus, lostReason: lead\.lost_reason \}\)\)/);
    assert.match(code, /\.is\('linked_at', null\)\.eq\('internal_status', lead\.internal_status\)\.select\('id'\)/);
    assert.match(code, /if \(!changed \|\| changed\.length === 0\) return fail\(409/);
  });

  it('there is no second way to read every lead: the old unaudited list route is gone', () => {
    assert.throws(() => readCode('app/api/platform-admin/early-access/route.ts'), /ENOENT/);
  });

  it('the New deck window forgets what was typed when it is discarded', () => {
    const code = readCode('app/platform-admin/pitch-deck-studio/DeckComposer.tsx');
    assert.match(code, /onClose=\{closeNew\}/);
    assert.match(code, /<DialogCancel \/>/);
  });
});
