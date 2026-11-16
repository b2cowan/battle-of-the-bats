import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';

/**
 * A BILL KEEPS EACH PERMIT'S RATE (a schedule on several permits, Session C; mig 489; /dba Findings #50 and #51). The bill's
 * three steps run through their `_priced` wrappers, which make the bill and keep the rate each permit is billed at in ONE
 * transaction. A call to an inner step would bill the teams and keep no rate — the next Send the changes would then price a
 * permit behind the bill as "never billed". Guard 3 of the build prompt (a bill made is never recalculated) rests on it.
 */

const ROOTS = ['lib', 'app', 'components'];
const files = (dir: string): string[] => readdirSync(dir).flatMap(n => {
  const p = join(dir, n);
  return statSync(p).isDirectory() ? files(p) : /\.(ts|tsx)$/.test(n) ? [p.replace(/\\/g, '/')] : [];
});
const CODE = ROOTS.flatMap(files);
const read = (f: string) => readFileSync(f, 'utf8');
const MIG = read('supabase/migrations/489_a_bill_keeps_each_permits_rate.sql');

describe('the bill keeps each permit’s rate in the step that makes it', () => {
  it('no code calls an inner bill step: only the _priced wrappers', () => {
    const inner = /rpc\(['"](club_schedule_finalize|club_schedule_bill_late|club_schedule_apply_changes)['"]/;
    assert.deepEqual(CODE.filter(f => inner.test(read(f))), []);
    const send = read('lib/club-schedule-send.ts');
    for (const step of ['club_schedule_finalize_priced', 'club_schedule_bill_late_priced', 'club_schedule_apply_changes_priced']) {
      const at = send.indexOf(`rpc('${step}'`);
      assert.ok(at > 0, step);
      assert.match(send.slice(at, at + 900), /p_rates:/, `${step} carries the rates`);
    }
  });
  it('each wrapper calls its inner step and keeps the rates only when it returned ok', () => {
    for (const [wrapper, inner] of [['club_schedule_finalize_priced', 'club_schedule_finalize'], ['club_schedule_bill_late_priced', 'club_schedule_bill_late'], ['club_schedule_apply_changes_priced', 'club_schedule_apply_changes']]) {
      const body = new RegExp(`create or replace function public\\.${wrapper}\\([\\s\\S]*?\\$\\$;`).exec(MIG)?.[0] ?? '';
      assert.ok(body, wrapper);
      assert.match(body, new RegExp(`v_res := ${inner}\\(`), `${wrapper} runs ${inner}`);
      assert.match(body, /if coalesce\(\(v_res->>'ok'\)::boolean, false\)[\s\S]*perform club_schedule_bill_rates_put\(/, `${wrapper} keeps rates only on ok`);
    }
  });
  it('the one writer is no role’s to call, and a kept rate never changes', () => {
    assert.match(MIG, /revoke all on function public\.club_schedule_bill_rates_put\(uuid, uuid, jsonb, uuid\) from public, anon, authenticated, service_role;/);
    assert.match(MIG, /on conflict \(schedule_id, permit_id\) do nothing;/);
    assert.doesNotMatch(read('lib/club-schedule-send.ts'), /from\('club_schedule_bill_rates'\)\.(insert|update|upsert|delete)/);
  });
  it('N5: Send the changes measures a team’s VALUE and adds new payments — it never edits a payment already made', () => {
    // P9 B item 3 (the owner: "the previous payments stay the same and just the new amounts are added"): a gain is a NEW
    // allocation with its own payments (club_allocation_create inside the step); a loss is a credit. Nothing in TS rewrites
    // an installment, a split or an allocation.
    const send = read('lib/club-schedule-send.ts');
    assert.doesNotMatch(send, /from\('rep_allocation_installments'\)\.(update|upsert|delete)/);
    assert.doesNotMatch(send, /from\('rep_allocation_splits'\)\.(update|upsert|delete)/);
    assert.doesNotMatch(send, /from\('rep_cost_allocations'\)\.(update|upsert|delete)/);
  });
  it('the pricing mode is a bill term: frozen once the bill is made', () => {
    assert.match(MIG, /if old\.allocation_id is not null and new\.bill_price_mode is distinct from old\.bill_price_mode then/);
  });
  it('the corrections read the kept rates, and a bill with none prices every slot at its one rate', () => {
    const send = read('lib/club-schedule-send.ts');
    assert.match(send, /const kept = row\.allocation_id \? await readBillTerms\(c\.orgId, row\) : null;/);
    assert.match(send, /keptRateOf\(kept, c\.prices\.hourOf\)/);
    assert.match(read('lib/club-schedule-bill.ts'), /if \(!kept\.byPermit\.size \|\| !s\.permitId \|\| !teamsOnly\(s\.teamIds\)\.length\) return kept\.scale;/);
  });
});
