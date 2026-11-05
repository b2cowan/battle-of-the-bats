import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { filesUnder, readCode, readSource } from './_source-code.ts';
import { BANK_REFUSAL } from '../../lib/bank-check-words.ts';

/**
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * BANK RECONCILIATION R2b — THE CLUB'S BANK ROUTES, HELD (build prompt BANK_RECONCILIATION_R2_BUILD_PROMPT.md chunk R2b;
 * written from the Club Tier 3b/3c server-guard templates).
 *
 *   1. every route under app/api/admin/accounting/bank/** passes `resolveClubMoney(req, { scope: 'books', write })` with
 *      the right `write` (B7: read = whoever opens Accounting, write = `canMoveClubMoney`), inside `withObservability`;
 *   2. no route reads a year or a season (B3, B10) — and no bank route or bank library imports a coach reader;
 *   3. the client sends intent: a tick, a kept-out line and a mark are decided by the server's read (rule 6);
 *   4. the multi-row steps are ONE database step each (mig 439), service role only, and every refusal they can answer is
 *      a code with words; rule 2 (figures fixed once statements exist / once checked) and rule 5 (a typed key is its own
 *      id) live in those functions, because the database tables do not enforce them.
 * The pure decisions have their own tests (bank-club-routes); the functions are proved on dev by
 * `.probe/bank-r2b-functions.sql` (rolled back).
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 */

const ROUTES = filesUnder('app/api/admin/accounting/bank', 'route.ts');
const BANK_LIBS = ['lib/bank-club-steps.ts', 'lib/bank-club-rules.ts', 'lib/bank-check-fee.ts', 'lib/bank-check-words.ts',
  'lib/bank-club-read.ts', 'lib/bank-club-map.ts'];
const MIG = readCode('supabase/migrations/439_a_bank_check_moves_in_one_step.sql').split('\n').map(l => l.replace(/--.*$/, '')).join('\n');

/** Each route file's handlers, and whether each writes. */
const EXPECTED: Record<string, Record<string, boolean>> = {
  'app/api/admin/accounting/bank/route.ts': { GET: false, POST: true },
  'app/api/admin/accounting/bank/lines-before/route.ts': { GET: true },
  'app/api/admin/accounting/bank/accounts/[accountId]/route.ts': { GET: false, PATCH: true },
  'app/api/admin/accounting/bank/accounts/[accountId]/setup/route.ts': { PUT: true },
  'app/api/admin/accounting/bank/accounts/[accountId]/books/route.ts': { POST: true },
  'app/api/admin/accounting/bank/accounts/[accountId]/checks/route.ts': { POST: true },
  'app/api/admin/accounting/bank/accounts/[accountId]/checks/[checkId]/route.ts': { PATCH: true },
  'app/api/admin/accounting/bank/accounts/[accountId]/checks/[checkId]/ticks/route.ts': { POST: true },
  'app/api/admin/accounting/bank/accounts/[accountId]/checks/[checkId]/kept-out/route.ts': { POST: true },
  'app/api/admin/accounting/bank/accounts/[accountId]/checks/[checkId]/mark/route.ts': { POST: true },
  'app/api/admin/accounting/bank/accounts/[accountId]/checks/[checkId]/undo/route.ts': { POST: true },
  'app/api/admin/accounting/bank/accounts/[accountId]/checks/[checkId]/lines/route.ts': { POST: true },
};

describe('1. every bank route is gated by the club money gate, with the right write', () => {
  it('the list of route files is the list this guard knows (a new one must be added here)', () => {
    assert.deepEqual([...ROUTES].sort(), Object.keys(EXPECTED).sort());
  });
  for (const [file, handlers] of Object.entries(EXPECTED)) {
    it(file, () => {
      const code = readCode(file);
      const exported = [...code.matchAll(/export const (GET|POST|PUT|PATCH|DELETE) = withObservability\(/g)].map(m => m[1]);
      assert.deepEqual(exported.sort(), Object.keys(handlers).sort(), `${file}: handlers`);
      for (const [method, write] of Object.entries(handlers)) {
        const start = code.indexOf(`export const ${method} = `);
        const next = code.indexOf('export const ', start + 10);
        const body = code.slice(start, next < 0 ? undefined : next);
        assert.match(body, new RegExp(`resolveClubMoney\\(req, \\{ scope: 'books', write: ${write} \\}\\)`), `${file} ${method}`);
        // The gate comes first: nothing is read from the request before it.
        assert.ok(body.indexOf('resolveClubMoney(') < body.indexOf('await params') || !body.includes('await params'), `${file} ${method}: gate first`);
      }
      assert.doesNotMatch(code, /getAuthContextWithRole|hasCapability\(/, `${file}: no hand-rolled gate`);
    });
  }
});

describe('2. no year, no season, no coach reader', () => {
  for (const file of [...ROUTES, ...BANK_LIBS]) {
    it(file, () => {
      const code = readCode(file);
      assert.doesNotMatch(code, /searchParams\.get\(['"](year|season|fiscalYear|fy|programYear|seasonId|yearId)['"]\)/, `${file} reads a year`);
      assert.doesNotMatch(code, /\b(resolveFiscalYear|fiscalYearForRequest|fiscalYearOf)\(/, `${file} addresses a fiscal year`);
      const imports = [...code.matchAll(/from ['"]([^'"]+)['"]/g)].map(m => m[1]);
      // `coach-register` is imported for `toCents` only (one cents rule, the codebase's); nothing else coach-side.
      for (const spec of imports) {
        if (/(^|\/)coach-/.test(spec)) assert.match(spec, /(^|\/)coach-register$/, `${file} imports ${spec}`);
      }
    });
  }
  it('a route imports only the gate, the bank steps and its words', () => {
    for (const file of ROUTES) {
      for (const spec of [...readCode(file).matchAll(/from ['"]([^'"]+)['"]/g)].map(m => m[1])) {
        assert.ok(['next/server', '@/lib/observability', '@/lib/club-money-route', '@/lib/bank-club-steps', '@/lib/bank-check-fee',
          '@/lib/bank-check-words'].includes(spec), `${file} imports ${spec}`);
      }
    }
  });
});

describe('3. the client sends intent; the server decides', () => {
  const steps = readCode('lib/bank-club-steps.ts');
  it('a tick, a kept-out line, a mark and an undo each read the account first and ask the pure rules', () => {
    for (const [fn, plan] of [['tickRow', 'tickPlan'], ['keepOut', 'keptOutPlan'], ['markCheck', 'markPlan'], ['undoCheck', 'undoPlan']]) {
      const a = steps.indexOf(`export async function ${fn}(`);
      assert.ok(a >= 0, fn);
      const body = steps.slice(a, steps.indexOf('\nexport ', a + 10));
      assert.match(body, /await readFor\(ctx, accountId\)/, fn);
      assert.match(body, new RegExp(`${plan}\\(got\\.read\\.state`), fn);
    }
  });
  it('the request never supplies a line\'s figures, a payout, or a Difference', () => {
    for (const file of ['lib/bank-club-steps.ts', 'lib/bank-check-fee.ts']) {
      assert.doesNotMatch(readCode(file), /body\.(differenceCents|tickedBalanceCents|lines|payouts|marks|snapshot)\b/, file);
    }
  });
  it('a picked opening item\'s figures are read from the book (openingPlan gets the rows, not the request\'s figures)', () => {
    assert.match(steps, /openingPlan\(\{ openingDate, pickedKeys: body\.picked, typed: body\.typed, rows,/);
  });
  it('the payment-processing amount is the server\'s, from the engine\'s own payout row', () => {
    const fee = readCode('lib/bank-check-fee.ts');
    assert.match(fee, /amountCents = view\.processingCents;/);
    // The line rides the payout it closes: the payout is written on its tick (mig 439), and a second one is refused there.
    assert.match(fee, /forPayout = payoutKey;/);
    assert.match(fee, /p_payout_key: forPayout,/);
    assert.match(fee, /payoutGapViews\(evaluateCheck\(read\.state, checkId\), read\.payoutGaps, read\.payoutMembers\)/);
  });
  it('a bank line is dated by bankFeeDate, then the fiscal-year lock in words, then the database floor', () => {
    const fee = readCode('lib/bank-check-fee.ts');
    assert.match(fee, /bankFeeDate\(\{/);
    assert.match(fee, /closedThrough\(await loadFiscalSetting\(ctx\.org\.id\)\)/);
    assert.match(fee, /await refuseIfClosedFor\(ctx\.org\.id, \[day\], 'date'\)/);
    assert.match(fee, /isClosedYearError\(error\)\) return closedYearFromError\(/);
  });
  it('every write is awaited', () => {
    for (const file of ['lib/bank-club-steps.ts', 'lib/bank-check-fee.ts']) {
      for (const line of readCode(file).split('\n')) {
        if (/supabaseAdmin\.(from\([^)]*\)\.(insert|update|delete|upsert)|rpc)\(/.test(line)) assert.match(line, /await /, `${file}: ${line.trim()}`);
      }
    }
  });
});

describe('4. the multi-row steps are one database step each (mig 439)', () => {
  const FNS = ['bank_first_club_account', 'bank_book_move', 'bank_account_add', 'bank_account_set_up', 'bank_check_start',
    'bank_check_refigure', 'bank_check_mark', 'bank_check_undo', 'bank_check_add_line'];
  it('the nine functions, each revoked from everyone and granted to the server only', () => {
    const made = [...MIG.matchAll(/CREATE OR REPLACE FUNCTION public\.(\w+)\(/g)].map(m => m[1]);
    assert.deepEqual(made.sort(), [...FNS].sort());
    for (const f of FNS) {
      assert.match(MIG, new RegExp(`REVOKE ALL ON FUNCTION public\\.${f}\\([^)]*\\) FROM PUBLIC, anon, authenticated;`), f);
      assert.match(MIG, new RegExp(`GRANT EXECUTE ON FUNCTION public\\.${f}\\([^)]*\\) TO service_role;`), f);
    }
    assert.doesNotMatch(MIG, /TO (anon|authenticated)\b/);
    assert.doesNotMatch(MIG, /CREATE TABLE|ALTER TABLE|DROP (TABLE|COLUMN|INDEX|TRIGGER|CONSTRAINT|POLICY)/, 'no table change: functions only');
    // The one DROP is the first version's 12-argument add-line (replaced by the 13-argument one), so no stale overload stays callable.
    assert.deepEqual(MIG.match(/DROP [A-Z]+ IF EXISTS [^;]*;/g), [
      'DROP FUNCTION IF EXISTS public.bank_check_add_line(uuid, uuid, uuid, uuid, text, text, date, text, bigint, uuid, uuid, uuid);',
    ]);
  });
  it('a payment-processing line rides the payout it closes, once (mig 439 add-line, review fix)', () => {
    const add = fn('bank_check_add_line');
    assert.match(add, /p_payout_key text DEFAULT NULL/);
    assert.match(add, /m\.payout_key = p_payout_key\s*\)\s*THEN\s+RETURN jsonb_build_object\('ok', false, 'code', 'no_processing_gap'\)/);
    assert.match(add, /INSERT INTO bank_check_marks \([^)]*payout_key[^)]*\)\s+VALUES \([^;]*p_payout_key/);
  });
  it('the steps the routes call are the ones mig 439 makes', () => {
    const called = [...readCode('lib/bank-club-steps.ts').matchAll(/step\('(\w+)'/g), ...readCode('lib/bank-check-fee.ts').matchAll(/rpc\('(\w+)'/g)]
      .map(m => m[1]);
    for (const c of called) assert.ok(FNS.includes(c), c);
    for (const f of FNS.filter(f => f !== 'bank_first_club_account')) assert.ok(called.includes(f), `${f} is never called`);
  });
  it('every code a function answers or raises is a refusal with words', () => {
    const codes = new Set([...MIG.matchAll(/'code', '(\w+)'/g), ...MIG.matchAll(/bank_step_refused:(\w+)/g)].map(m => m[1]));
    codes.delete('%');
    for (const c of codes) assert.ok(c in BANK_REFUSAL, `${c} has no words`);
    for (const c of ['team_book', 'name_taken', 'not_set_up', 'one_is_open', 'ends_too_early', 'statements_exist',
      'checked_figures_fixed', 'later_checked', 'not_latest', 'changed', 'earlier_open', 'book_not_in_account']) {
      assert.ok(codes.has(c), `mig 439 answers ${c}`);
    }
  });
  const fn = (name: string) => { const a = MIG.indexOf(`FUNCTION public.${name}(`); return MIG.slice(a, MIG.indexOf('END $$;', a)); };
  it('rule 2: the starting point is fixed once a statement exists; a checked statement\'s figures never change', () => {
    assert.match(fn('bank_account_set_up'), /IF EXISTS \(SELECT 1 FROM bank_checks WHERE bank_account_id = p_account\) THEN\s+RETURN jsonb_build_object\('ok', false, 'code', 'statements_exist'\)/);
    assert.match(fn('bank_check_refigure'), /IF v_check\.status <> 'open' THEN RETURN jsonb_build_object\('ok', false, 'code', 'checked_figures_fixed'\)/);
    assert.match(fn('bank_check_refigure'), /status = 'checked'\) THEN\s+RETURN jsonb_build_object\('ok', false, 'code', 'later_checked'\)/);
  });
  it('a statement starts in order, under the account\'s lock (canStartCheck)', () => {
    const f = fn('bank_check_start');
    assert.match(f, /FOR UPDATE/);
    assert.match(f, /'one_is_open'/);
    assert.match(f, /IF p_end IS NULL OR p_end <= v_floor THEN RETURN jsonb_build_object\('ok', false, 'code', 'ends_too_early'\)/);
  });
  it('rule 4: Mark checked replaces the ticks, refuses if they moved, and clears the amber', () => {
    const f = fn('bank_check_mark');
    assert.match(f, /IS DISTINCT FROM[\s\S]*RETURN jsonb_build_object\('ok', false, 'code', 'changed'\)/);
    assert.match(f, /DELETE FROM bank_check_marks WHERE check_id = p_check AND NOT \(line_key = ANY \(v_keys\)\)/);
    assert.match(f, /WHERE bank_check_marks\.check_id = EXCLUDED\.check_id/);
    assert.match(f, /UPDATE bank_check_changes SET cleared_by = p_actor, cleared_at = now\(\) WHERE check_id = p_check AND cleared_at IS NULL/);
    assert.match(f, /INSERT INTO bank_check_events \(check_id, kind, by_user\)/);
  });
  it('Undo: the latest checked only, with a reason', () => {
    const f = fn('bank_check_undo');
    assert.match(f, /'reason_required'/);
    assert.match(f, /status = 'checked'\s+AND statement_end_date > v_check\.statement_end_date\) THEN\s+RETURN jsonb_build_object\('ok', false, 'code', 'not_latest'\)/);
    assert.match(f, /INSERT INTO bank_check_events \(check_id, kind, reason, by_user\) VALUES \(p_check, 'undone', v_reason, p_actor\)/);
  });
  it('rule 5: a typed line\'s key is minted from its own id, first', () => {
    const f = fn('bank_account_set_up');
    assert.match(f, /v_id := gen_random_uuid\(\);\s+INSERT INTO bank_saved_lines \(id, [^)]*\)\s+VALUES \(v_id, p_account, 'opening_typed', 'typed:' \|\| v_id::text/);
    assert.match(f, /NOT LIKE 'entry:%' THEN RAISE EXCEPTION 'bank_step_refused:bad_item'/);
  });
  it('a bank line, its added-line row and its tick land together, in one of the account\'s own books, never a team\'s', () => {
    const f = fn('bank_check_add_line');
    assert.match(f, /'team_book'/);
    assert.match(f, /'book_not_in_account'/);
    const entry = f.indexOf('INSERT INTO accounting_entries');
    const added = f.indexOf('INSERT INTO bank_check_added_lines');
    const tick = f.indexOf('INSERT INTO bank_check_marks');
    assert.ok(entry > 0 && entry < added && added < tick);
  });
  it('a moved book takes its unticked lines\' decisions; ticked ones stay', () => {
    const f = fn('bank_book_move');
    assert.match(f, /UPDATE bank_saved_lines s SET bank_account_id = p_to/);
    assert.match(f, /UPDATE bank_line_exclusions x SET bank_account_id = p_to/);
    assert.equal((f.match(/NOT EXISTS \(SELECT 1 FROM bank_check_marks m WHERE m\.bank_account_id = v_from/g) ?? []).length, 4);
  });
  it('a club\'s first account is its oldest live CLUB account (rule 1)', () => {
    assert.match(fn('bank_first_club_account'), /owner_kind = 'club' AND archived_at IS NULL\s+ORDER BY created_at, id LIMIT 1/);
  });
});

describe('the raw migration text is the one applied', () => {
  it('names itself and its prod order', () => {
    const raw = readSource('supabase/migrations/439_a_bank_check_moves_in_one_step.sql');
    assert.match(raw, /Migration 439/);
    assert.match(raw, /Needs 436/);
  });
});

describe('a statement and a starting point are never in the future', () => {
  const steps = readCode('lib/bank-club-steps.ts');
  const body = (name: string) => { const a = steps.indexOf(`export async function ${name}(`); return steps.slice(a, steps.indexOf('\nexport ', a + 10)); };
  it('start and correct a statement: refused after the club\'s today', () => {
    for (const f of ['startCheck', 'refigureCheck']) assert.match(body(f), /if \(end > clubToday\(\)\) return bankRefusedAs\('ends_in_future'\)/, f);
  });
  it('set up: refused after the club\'s today', () => {
    assert.match(body('setUpAccount'), /if \(openingDate > clubToday\(\)\) return bankRefusedAs\('starts_in_future'\)/);
  });
});
