import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { billingTestLoader } from './_billing-test-loader.ts';
import { readCode } from './_source-code.ts';
import {
  BANK_CHECK_DRAFT_DAYS, BANK_CHECK_DRAFT_MAX_MARKS, daysLeft, inLastWeek, isWorkWorthKeeping, readWorkBody, type CheckWork,
} from '../../lib/bank-check-work.ts';

/**
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * A BANK CHECK IN PROGRESS, KEPT FOR ITS PERSON (S7 Part 1; plan BANK_CHECK_NOVICE_UX_PLAN.md §0 A18, rulings 1–9,
 * 2026-11-22; table bank_check_drafts, mig 522; /dba Finding #54).
 *   1. a keep's body is read strictly (keys, never figures; 32-character text; 3–200-character keys; 500 marks);
 *   2. the server half on an in-memory table: mine only, the colleague's three facts and nothing else, the 30 days,
 *      expired = none, one device at a time (compare-and-swap), a colleague who lost write access is deleted not shown;
 *   3. where the work goes: Save this check (both portals, after the save), loss of write access (club members, coach
 *      staff), a coach season's roll or close.
 * The gates themselves are bank-r2-server-guard (club) and bank-coach-routes-guard (coach); the real routes are proved on
 * dev by .probe/bank-ux-s7/work-routes.mjs (a view-only coach and a non-member refused, the save discards).
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 */

const WORK: CheckWork = { date: '2026-10-31', balance: '5402.10', marked: ['entry:aaaa-1', 'entry:bbbb-2'], started: null };

describe('1. a keep\'s body', () => {
  it('reads a whole work, with its revision', () => {
    const r = readWorkBody({ work: { ...WORK, started: { date: '2026-10-31', balance: '5402.10', differenceCents: -7500 } }, revision: 3 });
    assert.deepEqual(r, { work: { ...WORK, started: { date: '2026-10-31', balance: '5402.10', differenceCents: -7500 } }, revision: 3 });
  });
  it('a first keep has no revision; an empty cash is no cash', () => {
    assert.deepEqual(readWorkBody({ work: { ...WORK, cash: '  ' } }), { work: WORK, revision: null });
    assert.deepEqual(readWorkBody({ work: { ...WORK, cash: '40' }, revision: null })?.work.cash, '40');
  });
  it('refuses what a card never sends', () => {
    const bad: Record<string, unknown>[] = [
      {},
      { work: null },
      { work: [] },
      { work: { ...WORK, date: '2026-02-30' } },
      { work: { ...WORK, date: '31/10/2026' } },
      { work: { ...WORK, balance: 5402.1 } },
      { work: { ...WORK, balance: '1'.repeat(33) } },
      { work: { ...WORK, cash: '9'.repeat(33) } },
      { work: { ...WORK, marked: 'entry:a' } },
      { work: { ...WORK, marked: ['ab'] } },
      { work: { ...WORK, marked: ['x'.repeat(201)] } },
      { work: { ...WORK, marked: ['entry:a', 'entry:a'] } },
      { work: { ...WORK, marked: Array.from({ length: BANK_CHECK_DRAFT_MAX_MARKS + 1 }, (_, i) => `entry:${i}00`) } },
      { work: { ...WORK, started: { date: '2026-10-31', balance: '1', differenceCents: 1.5 } } },
      { work: { ...WORK, started: { date: 'soon', balance: '1', differenceCents: 1 } } },
      { work: WORK, revision: 0 },
      { work: WORK, revision: '2' },
    ];
    for (const b of bad) assert.equal(readWorkBody(b), null, JSON.stringify(b).slice(0, 80));
  });
  it('never carries a line\'s figures: only the keys come through', () => {
    const r = readWorkBody({ work: { ...WORK, lines: [{ key: 'entry:a', amountCents: 500, label: 'Gym' }] } });
    assert.deepEqual(Object.keys(r!.work).sort(), ['balance', 'date', 'marked', 'started']);
  });
  it('worth keeping: a balance, a cash or a mark', () => {
    assert.equal(isWorkWorthKeeping({ balance: '', marked: [] }), false);
    assert.equal(isWorkWorthKeeping({ balance: ' ', cash: '', marked: [] }), false);
    assert.equal(isWorkWorthKeeping({ balance: '1', marked: [] }), true);
    assert.equal(isWorkWorthKeeping({ balance: '', cash: '5', marked: [] }), true);
    assert.equal(isWorkWorthKeeping({ balance: '', marked: ['entry:a'] }), true);
  });
  it('the last 7 days (ruling 2): the last day reads 1; the eighth day before is not yet', () => {
    assert.equal(daysLeft('2026-12-22', '2026-12-22'), 1);
    assert.equal(daysLeft('2026-12-22', '2026-12-16'), 7);
    assert.equal(inLastWeek('2026-12-22', '2026-12-16'), true);
    assert.equal(inLastWeek('2026-12-22', '2026-12-15'), false);
    assert.equal(inLastWeek('2026-12-22', '2026-12-23'), false);
    assert.equal(BANK_CHECK_DRAFT_DAYS, 30);
  });
});

// ── an in-memory bank_check_drafts, enough of the query builder for the server half ──
type Row = Record<string, unknown>;
function fakeDb(seed: Row[] = []) {
  const rows: Row[] = seed.map(r => ({ ...r }));
  const calls: { table: string; op: string; select?: string }[] = [];
  const rpcs: { fn: string; args: Record<string, unknown> }[] = [];
  function q(table: string) {
    let op: 'select' | 'insert' | 'update' | 'delete' = 'select';
    let cols: string | undefined;
    let patch: Row = {};
    let insert: Row | null = null;
    const filters: ((r: Row) => boolean)[] = [];
    const run = () => {
      calls.push({ table, op, select: cols });
      if (table !== 'bank_check_drafts') return { data: table === 'organization_members' ? [] : [], error: null };
      if (op === 'insert') {
        if (rows.some(r => r.bank_account_id === insert!.bank_account_id && r.user_id === insert!.user_id)) {
          return { data: null, error: { code: '23505', message: 'duplicate key bank_check_drafts_one_per_person' } };
        }
        const row = { created_at: insert!.updated_at, ...insert! };
        rows.push(row);
        return { data: [pick(row)], error: null };
      }
      const hit = rows.filter(r => filters.every(f => f(r)));
      if (op === 'delete') { for (const r of hit) rows.splice(rows.indexOf(r), 1); return { data: null, error: null }; }
      if (op === 'update') { for (const r of hit) Object.assign(r, patch); return { data: hit.map(pick), error: null }; }
      return { data: hit.map(pick), error: null };
    };
    const pick = (r: Row) => cols ? Object.fromEntries(cols.split(',').map(c => c.trim()).map(c => [c, r[c]])) : r;
    const b: Record<string, unknown> = {
      select: (c: string) => { cols = c; return b; },
      insert: (r: Row) => { op = 'insert'; insert = r; return b; },
      update: (p: Row) => { op = 'update'; patch = p; return b; },
      delete: () => { op = 'delete'; return b; },
      eq: (k: string, v: unknown) => { filters.push(r => r[k] === v); return b; },
      neq: (k: string, v: unknown) => { filters.push(r => r[k] !== v); return b; },
      lt: (k: string, v: string) => { filters.push(r => String(r[k]) < v); return b; },
      gt: (k: string, v: string) => { filters.push(r => String(r[k]) > v); return b; },
      in: (k: string, vs: unknown[]) => { filters.push(r => vs.includes(r[k])); return b; },
      is: () => b,
      order: () => b,
      maybeSingle: async () => { const r = run(); return { data: (r.data as Row[] | null)?.[0] ?? null, error: r.error }; },
      single: async () => { const r = run(); return { data: (r.data as Row[] | null)?.[0] ?? null, error: r.error }; },
      then: (res: (v: unknown) => unknown, rej: (e: unknown) => unknown) => Promise.resolve(run()).then(res, rej),
    };
    return b;
  }
  const supabaseAdmin = {
    from: (t: string) => q(t),
    rpc: async (fn: string, args: Record<string, unknown>) => { rpcs.push({ fn, args }); return { data: 0, error: null }; },
  };
  return { rows, calls, rpcs, supabaseAdmin };
}

const day = (offsetDays: number) => new Date(Date.now() + offsetDays * 86_400_000).toISOString();
const row = (o: Partial<Row>): Row => ({
  bank_account_id: 'acct-1', user_id: 'me', statement_end_date: '2026-10-31', balance_text: '5402.10', cash_text: null,
  marked_keys: ['entry:aaaa-1'], started_date: null, started_balance_text: null, started_difference_cents: null,
  revision: 1, updated_at: day(-1), expires_at: day(29), ...o,
});

function server(db: ReturnType<typeof fakeDb>) {
  const load = billingTestLoader({
    './supabase-admin': { supabaseAdmin: db.supabaseAdmin },
    './db': { resolvePersonNamer: async () => (id: string) => (id === 'sam' ? 'Sam Lee' : id === 'ana' ? 'Ana Ruiz' : null) },
  });
  return load('lib/bank-check-work-server.ts') as typeof import('../../lib/bank-check-work-server.ts');
}
const everyone = async (ids: readonly string[]) => new Set(ids);

describe('2. the server half', () => {
  it('reads my own work whole, and a colleague\'s as three facts: who, the date, when it changed — never a figure', async () => {
    const db = fakeDb([row({}), row({ user_id: 'sam', statement_end_date: '2026-09-30', balance_text: '999.99', marked_keys: ['entry:secret'] })]);
    const r = await server(db).readWork({ accountId: 'acct-1', me: 'me', orgId: 'org', canSave: everyone });
    assert.equal(r.mine?.balance, '5402.10');
    assert.deepEqual(r.mine?.marked, ['entry:aaaa-1']);
    assert.equal(r.mine?.revision, 1);
    assert.equal(r.colleagues.length, 1);
    assert.deepEqual(Object.keys(r.colleagues[0]).sort(), ['changedOn', 'date', 'name']);
    assert.equal(r.colleagues[0].name, 'Sam Lee');
    assert.equal(r.colleagues[0].date, '2026-09-30');
    assert.doesNotMatch(JSON.stringify(r.colleagues), /999|secret/);
  });
  it('the colleagues\' read selects exactly three columns (and the module says so in one place)', async () => {
    const mod = server(fakeDb());
    assert.equal(mod.COLLEAGUE_COLS, 'user_id, statement_end_date, updated_at');
    const db = fakeDb([row({ user_id: 'sam' })]);
    await server(db).readWork({ accountId: 'acct-1', me: 'me', orgId: 'org', canSave: everyone });
    const colleagueRead = db.calls.find(c => c.op === 'select' && c.select === mod.COLLEAGUE_COLS);
    assert.ok(colleagueRead, 'the colleague read uses COLLEAGUE_COLS');
    assert.equal(readCode('lib/bank-check-work-server.ts').match(/select\(COLLEAGUE_COLS\)/g)?.length, 1);
  });
  it('an expired row is none: gone on sight, mine and a colleague\'s', async () => {
    const db = fakeDb([row({ expires_at: day(-1) }), row({ user_id: 'sam', expires_at: day(-2) })]);
    const r = await server(db).readWork({ accountId: 'acct-1', me: 'me', orgId: 'org', canSave: everyone });
    assert.equal(r.mine, null);
    assert.deepEqual(r.colleagues, []);
    assert.equal(db.rows.length, 0);
  });
  it('a colleague who can no longer save a check here is deleted, not shown (ruling 2)', async () => {
    const db = fakeDb([row({ user_id: 'sam' }), row({ user_id: 'ana' })]);
    const r = await server(db).readWork({ accountId: 'acct-1', me: 'me', orgId: 'org', canSave: async () => new Set(['ana']) });
    assert.deepEqual(r.colleagues.map(c => c.name), ['Ana Ruiz']);
    assert.deepEqual(db.rows.map(x => x.user_id), ['ana']);
  });
  it('another account\'s rows are never read', async () => {
    const db = fakeDb([row({ bank_account_id: 'acct-2' }), row({ bank_account_id: 'acct-2', user_id: 'sam' })]);
    const r = await server(db).readWork({ accountId: 'acct-1', me: 'me', orgId: 'org', canSave: everyone });
    assert.equal(r.mine, null);
    assert.deepEqual(r.colleagues, []);
  });
  it('no account yet (a team before its first keep): nothing, and nothing asked', async () => {
    const db = fakeDb();
    assert.deepEqual(await server(db).readWork({ accountId: null, me: 'me', orgId: 'org', canSave: everyone }), { mine: null, colleagues: [] });
    assert.equal(db.calls.length, 0);
  });
  it('a first keep makes the row, stamped for 30 days from now; the next keep names its revision and restarts them', async () => {
    const db = fakeDb();
    const s = server(db);
    const first = await s.keepWork({ accountId: 'acct-1', me: 'me', work: WORK, revision: null });
    assert.ok(first.ok && first.saved);
    assert.equal(first.saved.revision, 1);
    const ms = Date.parse(String(db.rows[0].expires_at)) - Date.parse(String(db.rows[0].updated_at));
    assert.equal(ms, BANK_CHECK_DRAFT_DAYS * 86_400_000);
    db.rows[0].expires_at = day(2); // near its end…
    const next = await s.keepWork({ accountId: 'acct-1', me: 'me', work: { ...WORK, marked: [] , balance: '5400' }, revision: 1 });
    assert.ok(next.ok && next.saved);
    assert.equal(next.saved.revision, 2);
    assert.ok(Date.parse(String(db.rows[0].expires_at)) > Date.now() + 29 * 86_400_000, '…and a keep restarts the 30 days');
    assert.equal(db.rows[0].balance_text, '5400');
  });
  it('one device at a time: a keep another device has overtaken is refused, never written', async () => {
    const db = fakeDb([row({ revision: 4 })]);
    const r = await server(db).keepWork({ accountId: 'acct-1', me: 'me', work: { ...WORK, balance: '1' }, revision: 3 });
    assert.deepEqual(r, { ok: false, code: 'work_changed' });
    assert.equal(db.rows[0].balance_text, '5402.10');
  });
  it('a Start on a second device while work exists is refused (it holds newer work than the card knows)', async () => {
    const db = fakeDb([row({})]);
    assert.deepEqual(await server(db).keepWork({ accountId: 'acct-1', me: 'me', work: WORK, revision: null }), { ok: false, code: 'work_changed' });
  });
  it('a Start where only an expired row remains starts fresh', async () => {
    const db = fakeDb([row({ expires_at: day(-1), balance_text: 'old' })]);
    const r = await server(db).keepWork({ accountId: 'acct-1', me: 'me', work: WORK, revision: null });
    assert.ok(r.ok && r.saved);
    assert.equal(db.rows.length, 1);
    assert.equal(db.rows[0].balance_text, '5402.10');
  });
  it('a keep of an expired row is refused (the card reads again)', async () => {
    const db = fakeDb([row({ expires_at: day(-1) })]);
    assert.deepEqual(await server(db).keepWork({ accountId: 'acct-1', me: 'me', work: WORK, revision: 1 }), { ok: false, code: 'work_changed' });
  });
  it('work no longer worth keeping is discarded', async () => {
    const db = fakeDb([row({})]);
    assert.deepEqual(await server(db).keepWork({ accountId: 'acct-1', me: 'me', work: { ...WORK, balance: '', marked: [] }, revision: 1 }), { ok: true, saved: null });
    assert.equal(db.rows.length, 0);
  });
  it('a club account\'s work never stores a cash; a coach\'s keeps it as typed', async () => {
    const db = fakeDb();
    await server(db).keepWork({ accountId: 'acct-1', me: 'me', work: { ...WORK, cash: '40.00' }, revision: null });
    assert.equal(db.rows[0].cash_text, '40.00');
  });
  it('discard takes only mine on this account', async () => {
    const db = fakeDb([row({}), row({ user_id: 'sam' }), row({ bank_account_id: 'acct-2' })]);
    await server(db).discardWork('acct-1', 'me');
    assert.deepEqual(db.rows.map(r => `${r.bank_account_id}/${r.user_id}`).sort(), ['acct-1/sam', 'acct-2/me']);
  });
  it('a team\'s work goes inside the database (D1: the club side never reads a team\'s account)', async () => {
    const db = fakeDb();
    const s = server(db);
    await s.discardTeamWork('team-1');
    await s.discardTeamWorkOf('team-1', 'sam');
    assert.deepEqual(db.rpcs, [
      { fn: 'bank_check_drafts_discard_team', args: { p_team: 'team-1', p_user: null } },
      { fn: 'bank_check_drafts_discard_team', args: { p_team: 'team-1', p_user: 'sam' } },
    ]);
    assert.equal(db.calls.filter(c => c.table === 'bank_accounts').length, 0);
  });
});

describe('3. where the work goes', () => {
  const between = (code: string, from: string, to: string) => {
    const a = code.indexOf(from);
    assert.ok(a >= 0, `${from}: gone`);
    const b = code.indexOf(to, a + from.length);
    return code.slice(a, b < 0 ? undefined : b);
  };
  it('Save this check discards the saver\'s work in the same request, only after the save step succeeds (both portals)', () => {
    const club = between(readCode('lib/bank-club-steps.ts'), 'export async function saveCheck(', '\nexport ');
    assert.match(club, /if \(!r\.ok\) return r;\s+(?:\/\/[^\n]*\n\s+)?if \(asked === 'check'\) await discardWorkAfterSave\(accountId, ctx\.user\.id\);/);
    const team = between(readCode('lib/bank-coach-steps.ts'), 'export async function saveTeamCheck(', '\nexport ');
    assert.match(team, /if \(!r\.ok\) return r;\s+(?:\/\/[^\n]*\n\s+)?await discardWorkAfterSave\(account\.id, c\.actorId\);/);
  });
  it('a failed discard after a save never fails the save', async () => {
    const db = fakeDb();
    db.supabaseAdmin.from = () => { throw new Error('down'); };
    const err = console.error;
    console.error = () => {};
    try { await server(db).discardWorkAfterSave('acct-1', 'me'); } finally { console.error = err; }
  });
  it('the club: removing a member, or changing their access, takes their work unless they can still save a check', () => {
    const code = readCode('app/api/admin/members/[memberId]/route.ts');
    assert.equal(code.match(/await discardClubWorkUnlessAllowed\(org, target\.user_id\)/g)?.length, 2);
    assert.match(code, /if \(roleChanging \|\| hasCapabilitiesUpdate \|\| hasStatusUpdate\) await discardClubWorkUnlessAllowed\(org, target\.user_id\);/);
  });
  it('the coach: leaving the team (every door, through removeStaffMember) and losing money write take their work', () => {
    const removal = between(readCode('lib/coach-membership.ts'), 'export async function removeStaffMember(', '\nexport ');
    assert.match(removal, /if \(data\) await discardTeamWorkOf\(teamId, userId\);/);
    const staff = readCode('app/api/coaches/[orgSlug]/teams/[teamId]/staff/[coachId]/route.ts');
    assert.equal(staff.match(/if \(!canWriteMoney\(resolveCoachCapabilities\([^)]*\)\)\) \{\s+await discardTeamWorkOf\(teamId, resolved\.target\.userId\);/g)?.length, 2,
      'the grants change and the role change');
  });
  it('a coach season\'s roll and close take every person\'s work on the team\'s account (both portals\' season doors)', () => {
    const roll = readCode('lib/rep-season-rollover.ts');
    assert.match(between(roll, 'export async function startNextRepSeason(', '\nexport '), /await discardTeamWork\(teamId\);/);
    assert.match(between(roll, 'export async function closeOpenSeason(', '\nexport '), /if \(data\) \{\s+await discardTeamWork\(teamId\)\.catch\(/);
  });
});
