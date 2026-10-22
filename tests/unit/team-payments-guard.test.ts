/**
 * A TEAM'S PAID MONEY HAS ONE WRITER — THE DATABASE'S PAYMENT FUNCTIONS (mig 345; TEAM_PAYMENTS_LIST_PLAN.md, 2026-10-21).
 *
 * `teams.total_paid` / `deposit_paid` are a cache the payment functions keep as the sum of the team's payments, in the same
 * transaction that writes the payment row and the ledger line. Any app code that writes them directly would let the cache
 * drift from the payments and the book — the very thing this change removed (a typed `109` made three ledger lines, every one
 * dated "today"). The old triggers that diffed the figures are gone, so a direct write would also post NOTHING.
 *
 * Pinned here: no app, lib or component code writes either column (a key in an object literal, an assignment, or a
 * `.update/.insert/.upsert` argument naming one); the routes that move paid money go through `lib/team-payments-server.ts`; and
 * a payment's two ends — the Record and the Remove — ask before they act.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { readCode } from './_source-code.ts';

const REPO = path.join(import.meta.dirname, '..', '..');

/** Every non-test .ts/.tsx under a repo folder, repo-relative. */
function sources(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(path.join(REPO, dir))) {
    if (name === 'node_modules' || name === '.next' || name.startsWith('.')) continue;
    const rel = `${dir}/${name}`;
    const full = path.join(REPO, rel);
    if (statSync(full).isDirectory()) out.push(...sources(rel));
    else if (/\.(ts|tsx)$/.test(name) && !/\.test\.(ts|tsx)$/.test(name)) out.push(rel);
  }
  return out;
}

/** The text inside each `.update(` / `.insert(` / `.upsert(` call of `code` (parentheses balanced). */
function writeArguments(code: string): string[] {
  const out: string[] = [];
  const re = /\.(?:update|insert|upsert)\(/g;
  for (let m = re.exec(code); m; m = re.exec(code)) {
    let depth = 1;
    let i = m.index + m[0].length;
    const from = i;
    for (; i < code.length && depth > 0; i++) {
      if (code[i] === '(') depth++;
      else if (code[i] === ')') depth--;
    }
    out.push(code.slice(from, i - 1));
  }
  return out;
}

const PAID = /\b(?:deposit_paid|total_paid)\b/;
/** A key being SET in an object literal (not a type annotation: `deposit_paid: number | null`). */
const PAID_KEY = /\b(?:deposit_paid|total_paid)\s*:[ \t]*(?![ \t])(?!(?:number|string|null|unknown|boolean)\b)/;
const PAID_ASSIGN = /\.(?:deposit_paid|total_paid)\s*=(?!=)/;

describe('no app code writes a team’s paid figures', () => {
  const files = [...sources('app'), ...sources('lib'), ...sources('components')];

  it('read the source tree', () => {
    assert.ok(files.length > 500, `found the source files (${files.length})`);
  });

  it('no object literal sets deposit_paid or total_paid, and none is assigned', () => {
    const offenders: string[] = [];
    for (const rel of files) {
      const code = readCode(rel);
      if (PAID_KEY.test(code) || PAID_ASSIGN.test(code)) offenders.push(rel);
    }
    assert.deepEqual(offenders, [], 'a paid figure is the database’s sum of the team’s payments — record a payment instead (lib/team-payments-server.ts)');
  });

  it('no .update / .insert / .upsert argument names either column', () => {
    const offenders: string[] = [];
    for (const rel of files) {
      if (writeArguments(readCode(rel)).some(arg => PAID.test(arg))) offenders.push(rel);
    }
    assert.deepEqual(offenders, [], 'writes to teams never carry a paid figure');
  });
});

describe('the doors that move paid money all go through the one server module', () => {
  const door = (rel: string, needle: RegExp) => assert.match(readCode(rel), needle, `${rel} records through lib/team-payments-server.ts`);

  it('the Teams update (Mark paid), the bulk actions, check-in and the payments route', () => {
    door('app/api/admin/teams/route.ts', /payTeamDue\(/);
    door('app/api/admin/tournaments/[tournamentId]/registrations/bulk/route.ts', /payTeamDue\(/);
    door('app/api/admin/check-in/route.ts', /payTeamDue\(/);
    door('app/api/admin/check-in/route.ts', /removeTeamPayment\(/);
    const payments = readCode('app/api/admin/tournaments/[tournamentId]/registrations/payments/route.ts');
    for (const fn of ['recordTeamPayment(', 'changeTeamPayment(', 'removeTeamPayment(']) assert.ok(payments.includes(fn), fn);
  });

  it('the server module calls the database functions, and nothing in it writes a table', () => {
    const server = readCode('lib/team-payments-server.ts');
    for (const rpc of ['tournament_team_payment_record', 'tournament_team_payment_pay_due', 'tournament_team_payment_change', 'tournament_team_payment_remove']) {
      assert.ok(server.includes(`'${rpc}'`), rpc);
    }
    assert.equal(writeArguments(server).length, 0, 'it only reads tables; every write is a database function');
  });

  it('the payments route is the Teams screen’s gate: capability, scope, organization, plan, and a locked event', () => {
    const route = readCode('app/api/admin/tournaments/[tournamentId]/registrations/payments/route.ts');
    for (const gate of ["hasCapability(ctx.role, ctx.capabilities, 'create_tournaments')", 'scopeGuard(ctx, tournamentId)', 'requireTournamentInOrg(ctx, tournamentId)', 'teamUpdateAllowed(', "'completed'"]) {
      assert.ok(route.includes(gate), gate);
    }
  });

  it('a check-in undo removes only a payment the same person recorded on this team', () => {
    const checkIn = readCode('app/api/admin/check-in/route.ts');
    assert.match(checkIn, /\.eq\('team_id', teamId\)\.eq\('tournament_id', tournamentId\)\.eq\('status', 'posted'\)\.eq\('created_by', ctx\.user\.id\)/);
  });
});

describe('a payment asks before it is made or lost', () => {
  const list = readCode('app/[orgSlug]/admin/tournaments/registrations/components/TeamPayments.tsx');

  it('nothing is sent until Record or Save change is pressed — no autosave in the list', () => {
    assert.doesNotMatch(list, /useRecordAutosave|setTimeout|debounce/, 'a payment is recorded, never autosaved');
    assert.ok(list.includes('submitRecord') && list.includes('submitEdit'));
  });

  it('Remove asks first, in place, and says what happens to the ledger line', () => {
    assert.match(list, /setAsking\(true\)/);
    assert.match(list, /removeBodyBook/);
  });

  it('the record window no longer types a paid figure', () => {
    const record = readCode('app/[orgSlug]/admin/tournaments/registrations/components/TeamRecord.tsx');
    assert.doesNotMatch(record, /form\.(?:depositPaid|totalPaid)|Deposit paid|Total paid/, 'no Deposit paid / Total paid boxes');
  });
});
