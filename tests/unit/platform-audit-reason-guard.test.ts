/**
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * THE AUDIT LOG'S REASON COLUMN (Support console Stage 3, owner Q6 2026-10-26; migration 380).
 *
 * R4: every change records who and why, with the reason in its own column. Q6 ruled the reason REQUIRED on every staff
 * change to a customer's club, person, plan, money or retention (and on refunds); the product's own jobs pass none, and
 * so do the console's own work tools (notes, pitch decks, campaigns, triage status, lead edits, staff roles until
 * Stage 8) — the owner's call at the Stage 3 gate, 2026-10-26.
 *
 *   1. Every `writePlatformAuditLog` / `writePlatformAuditLogStrict` call passes its reason as the options argument
 *      (`{ reason }`), unless its file — or, in a mixed file, its action — is on NO_REASON below, with why.
 *      A NEW writer that is not on the list and passes no reason fails here: classify it.
 *   2. No call carries the reason inside the value any more (the column is the one home).
 *   3. The readers read the column (and fall back to the value only for a row written between the migration and the
 *      code reaching production).
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readCode, filesUnder } from './_source-code.ts';
import { reasonOfRow, whyFields } from '../../lib/platform-story-view.ts';

/** Files whose every audit write is a product job or a console work tool: no reason is asked for. */
const NO_REASON_FILES: Record<string, string> = {
  'app/api/platform-admin/feedback/[id]/reply/route.ts': 'console work tool: a reply to feedback asks no reason (owner Q5, Stage 5); the reply row keeps its words and who sent it',
  'app/api/platform-admin/club-domains-tick/route.ts': 'product job (scheduler tick)',
  'app/api/platform-admin/coach-sandbox-tick/route.ts': 'product job (scheduler tick)',
  'app/api/platform-admin/demo-sandbox-tick/route.ts': 'product job (scheduler tick)',
  'app/api/platform-admin/dues-reminders/route.ts': 'product job (scheduler sweep)',
  'app/api/platform-admin/insights-digest/route.ts': 'product job (scheduler sweep)',
  'app/api/platform-admin/schedule-change-notices/route.ts': 'product job (scheduler sweep)',
  'app/api/platform-admin/orgs/[id]/money/stripe-fees/[feeId]/retry/route.ts': 'work tool: re-runs the product’s own billing of a Stripe fee that failed (12d-1 Part 4); the amount and the decision are the product’s, and the fee’s stored error is the reason',
  'app/api/platform-admin/metrics/snapshot/route.ts': 'product job (a person presses run)',
  'app/api/platform-admin/observability/sweep/route.ts': 'product job (a person presses run)',
  'lib/team-workspace-provisioning.ts': 'product job (checkout / webhook; the actor is the customer)',
  'app/api/platform-admin/company-users/route.ts': 'staff roles: a reason arrives when Stage 8 draws Staff',
  'app/api/platform-admin/company-users/[id]/route.ts': 'staff roles: a reason arrives when Stage 8 draws Staff',
  'app/api/platform-admin/early-access/[leadId]/route.ts': 'work tool: a lead edit is the record itself',
  'app/api/platform-admin/feedback/[id]/escalate/route.ts': 'work tool: triage status',
  'app/api/platform-admin/feedback/[id]/status/route.ts': 'work tool: triage status',
  'app/api/platform-admin/observability/[groupId]/status/route.ts': 'work tool: triage status',
  'app/api/platform-admin/orgs/[id]/notes/route.ts': 'work tool: a note is its own reason',
  'app/api/platform-admin/orgs/[id]/notes/[noteId]/route.ts': 'work tool: a note is its own reason',
  'app/api/platform-admin/users/[id]/notes/route.ts': 'work tool: a note is its own reason',
  'app/api/platform-admin/users/[id]/notes/[noteId]/route.ts': 'work tool: a note is its own reason',
  'app/api/platform-admin/pitch-deck-studio/deck/route.ts': 'work tool: a pitch deck',
  'app/api/platform-admin/pitch-deck-studio/pull/route.ts': 'work tool: a pitch deck',
  'app/api/platform-admin/product-catalog/campaigns/route.ts': 'work tool: a campaign',
};
/** Single actions in a file that otherwise passes a reason. */
const NO_REASON_ACTIONS: Record<string, string> = {
  create_catalog_change_request: 'work tool: the request IS the proposal (its approval carries the change note)',
  update_catalog_change_request_status: 'work tool: triage status of a request',
};

/** Every writer call: the file, its text from the opening paren to the matching close. */
function writerCalls(): Array<{ file: string; call: string }> {
  const out: Array<{ file: string; call: string }> = [];
  for (const file of [...filesUnder('app', '.ts'), ...filesUnder('lib', '.ts')]) {
    if (file === 'lib/platform-audit.ts') continue;
    const code = readCode(file);
    for (const m of code.matchAll(/writePlatformAuditLog(?:Strict)?\(/g)) {
      let depth = 0;
      let i = m.index! + m[0].length - 1;
      for (; i < code.length; i++) {
        if (code[i] === '(') depth++;
        else if (code[i] === ')' && --depth === 0) break;
      }
      out.push({ file, call: code.slice(m.index!, i + 1) });
    }
  }
  return out;
}

const PASSES_REASON = /\{\s*reason\s*(?:[:},])/;

describe('1 · every staff audit write passes its reason in the column', () => {
  const calls = writerCalls();

  it('finds the writers (the scan works)', () => {
    assert.ok(calls.length >= 60, `expected 60+ writer calls, found ${calls.length}`);
  });

  for (const { file, call } of calls) {
    const action = /^[^,]+,[^,]+,\s*'([a-z_]+)'/.exec(call.slice(call.indexOf('(') + 1))?.[1] ?? null;
    if (NO_REASON_FILES[file] || (action && NO_REASON_ACTIONS[action])) continue;
    it(`${file} · ${action ?? 'computed action'}`, () => {
      assert.match(call, PASSES_REASON,
        `${file}: an audit write without { reason } — a staff change to a customer's club, person, plan, money or retention `
        + 'needs one (owner Q6). If it is a product job or a console work tool, add it to NO_REASON_FILES/NO_REASON_ACTIONS with why.');
    });
  }

  it('the lists name only files that still write the log', () => {
    const files = new Set(calls.map(c => c.file));
    for (const f of Object.keys(NO_REASON_FILES)) assert.ok(files.has(f), `${f} no longer writes the audit log: drop it from the list`);
  });
});

describe('2 · the reason lives only in the column', () => {
  it('no writer puts a `reason` key inside the value', () => {
    for (const { file, call } of writerCalls()) {
      // The options argument is the call's last `{ reason … }`; any other `reason` key or shorthand is inside a value.
      const withoutOptions = call.replace(/,\s*\{\s*reason\s*(?::[^}]*)?\}\s*,?\s*\)$/, ')');
      assert.doesNotMatch(withoutOptions, /[{,]\s*reason\s*[:,}]/, `${file}: the reason is inside the value again`);
    }
  });
});

describe('3 · the readers read the column', () => {
  it('a row with the column reads it; an older row reads its copy in the value; neither reads "Not recorded" for staff', () => {
    assert.equal(reasonOfRow({ reason: 'Moved early', new_value: { reason: 'old' } }), 'Moved early');
    assert.equal(reasonOfRow({ reason: null, new_value: { reason: 'Written before the code shipped' } }), 'Written before the code shipped');
    assert.deepEqual(whyFields({ reason: null, new_value: null }, true), { why: null, whyNotRecorded: true });
    assert.deepEqual(whyFields({ reason: '  ', new_value: null }, false), { why: null });
  });

  it('the Stories and the audit screen select the column', () => {
    for (const f of ['lib/platform-story.ts', 'app/platform-admin/audit/page.tsx', 'app/api/platform-admin/audit/export/route.ts']) {
      const code = readCode(f);
      const selects = [...code.matchAll(/from\('platform_audit_log'\)\s*\.select\(\s*['`]([^'`]*)['`]/g)].map(m => m[1]);
      assert.ok(selects.some(s => s.includes('new_value')), `${f}: the scan found no audit read (has the query moved?)`);
      for (const s of selects) {
        if (s.includes('new_value')) assert.ok(/\breason\b/.test(s), `${f}: selects the audit row without its reason column`);
      }
    }
  });
});
