import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { between, filesUnder, readCode, readSource } from './_source-code.ts';
import { BANK_REFUSAL } from '../../lib/bank-check-words.ts';
import { STATUS_OF } from '../../lib/bank-club-rules.ts';

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
 *   5. a tick and a kept-out line are locked steps (mig 440, R2b-2): nothing in lib/ or app/ writes those rows directly;
 *      the account, then the check, `FOR UPDATE`, and `not_open` once the statement is checked.
 *   6. a book move waits for the accounts (mig 442, R2b-3): one lock order (club row → accounts in id order → statement
 *      → book), one home for "which account holds this book", and a tick or keep-out of a line that left with its book
 *      is `changed`; a put-back that removes nothing is `changed`.
 *   §0 holds EVERY bank migration to the server-only floor (grants, search_path, every code with words and a status).
 *   §4 and §5 read each function's LIVE definition (the latest migration that makes it), so a re-made step keeps its rules.
 * The pure decisions have their own tests (bank-club-routes); the functions are proved on dev by
 * `.probe/bank-r2b-functions.sql`, `.probe/bank-r2b2-steps.sql` and `.probe/bank-r2b3-steps.sql` (rolled back), all run
 * with the route proofs by `.probe/bank-r2b3-all.mjs`.
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 */

const ROUTES = filesUnder('app/api/admin/accounting/bank', 'route.ts');
const BANK_LIBS = ['lib/bank-club-steps.ts', 'lib/bank-club-rules.ts', 'lib/bank-check-fee.ts', 'lib/bank-check-words.ts',
  'lib/bank-club-read.ts', 'lib/bank-club-map.ts'];
const sqlCode = (path: string) => readCode(path).split('\n').map(l => l.replace(/--.*$/, '')).join('\n');
const MIG_439_PATH = 'supabase/migrations/439_a_bank_check_moves_in_one_step.sql';
const MIG = sqlCode(MIG_439_PATH);
const MIG_440_PATH = 'supabase/migrations/440_a_tick_waits_for_mark_checked.sql';
const MIG_440 = sqlCode(MIG_440_PATH);
/** Mig 440's club steps (the routes call these) and their owner-agnostic halves (a coach step, R4+, wraps the same). */
const CLUB_STEPS_440 = ['bank_check_tick', 'bank_check_keep_out'];
const SHARED_440 = ['bank_tick_rows', 'bank_keep_out_rows'];
/** Mig 439's nine functions. */
const FNS = ['bank_first_club_account', 'bank_book_move', 'bank_account_add', 'bank_account_set_up', 'bank_check_start',
  'bank_check_refigure', 'bank_check_mark', 'bank_check_undo', 'bank_check_add_line'];
const MIG_442_PATH = 'supabase/migrations/442_a_book_move_waits_for_the_accounts.sql';
const MIG_442 = sqlCode(MIG_442_PATH);
/** Mig 442 (R2b-3): the one home of "which account holds this book", and the steps it re-made around it. */
const HELPERS_442 = ['bank_club_account_of_book', 'bank_club_line_left'];
const REMADE_442 = ['bank_book_move', 'bank_account_add', 'bank_account_set_up', 'bank_check_add_line', 'bank_check_tick',
  'bank_check_keep_out', 'bank_keep_out_rows'];
/**
 * Every bank migration that makes functions, in number order: the server-only floor (§0) holds each one, and `live()`
 * reads the latest. §0 fails when a migration makes a bank function this list doesn't name (a new one must be added).
 */
const BANK_FN_MIGS = [
  { label: 'mig 439', path: MIG_439_PATH, sql: MIG, fns: FNS },
  { label: 'mig 440', path: MIG_440_PATH, sql: MIG_440, fns: [...CLUB_STEPS_440, ...SHARED_440] },
  { label: 'mig 442', path: MIG_442_PATH, sql: MIG_442, fns: [...HELPERS_442, ...REMADE_442] },
];
/** A function's CREATE head, however it is spelled (case, OR REPLACE, the schema), so a migration can't slip past. */
const fnHead = (name: string) => new RegExp(String.raw`CREATE\s+(?:OR\s+REPLACE\s+)?FUNCTION\s+(?:public\.)?${name}\s*\(`, 'i');
/** The bank functions a migration makes, trigger functions aside (mig 436's guard is no step and has no grant). */
const bankFnsMade = (sql: string) =>
  [...sql.matchAll(/CREATE\s+(?:OR\s+REPLACE\s+)?FUNCTION\s+(?:public\.)?(bank_\w+)\s*\(/gi)]
    .filter(m => !/RETURNS\s+trigger\b/i.test(sql.slice(m.index!, sql.indexOf('$$', m.index!)))).map(m => m[1]);
/** One function's whole definition (plpgsql or sql), from its CREATE to the `$$;` closing its body. */
const sqlDef = (sql: string, name: string) => {
  const a = sql.search(fnHead(name));
  if (a < 0) throw new Error(`${name}: not made here`);
  const body = sql.indexOf('AS $$', a);
  return sql.slice(a, sql.indexOf('$$;', body + 5) + 3);
};
/** A function's LIVE definition: the one the latest bank migration that makes it wrote (`CREATE OR REPLACE` wins). */
const live = (name: string) => {
  const m = [...BANK_FN_MIGS].reverse().find(x => fnHead(name).test(x.sql));
  if (!m) throw new Error(`${name}: no bank migration makes it`);
  return sqlDef(m.sql, name);
};
/** Every bank function's name, once. */
const ALL_BANK_FNS = [...new Set(BANK_FN_MIGS.flatMap(m => m.fns))];
/** Every refusal code a migration answers or raises. */
const codesOf = (sql: string) =>
  new Set([...sql.matchAll(/'code', '(\w+)'/g), ...sql.matchAll(/bank_step_refused:(\w+)/g)].map(m => m[1]).filter(c => c !== '%'));
const STEPS_CODE = readCode('lib/bank-club-steps.ts');
/** One exported bank step's body (throws when it is gone). */
const stepBody = (name: string) => between(STEPS_CODE, `export async function ${name}(`, '\nexport ', name);

describe('0. every bank migration\'s functions are the server\'s only, and every code they answer has words and a status', () => {
  it('the list of bank migrations is every migration that makes a bank function, each with what it makes', () => {
    const found = filesUnder('supabase/migrations', '.sql').sort()
      .map(path => ({ path, fns: bankFnsMade(sqlCode(path)) })).filter(m => m.fns.length > 0);
    assert.deepEqual(found.map(m => m.path), BANK_FN_MIGS.map(m => m.path), 'a new bank migration must join BANK_FN_MIGS');
    for (const m of BANK_FN_MIGS) assert.deepEqual(bankFnsMade(m.sql).sort(), [...m.fns].sort(), m.label);
  });
  for (const m of BANK_FN_MIGS) {
    it(m.label, () => {
      for (const f of m.fns) {
        assert.match(m.sql, new RegExp(`REVOKE ALL ON FUNCTION public\\.${f}\\([^)]*\\) FROM PUBLIC, anon, authenticated;`), f);
        assert.match(m.sql, new RegExp(`GRANT EXECUTE ON FUNCTION public\\.${f}\\([^)]*\\) TO service_role;`), f);
        assert.match(m.sql, new RegExp(`FUNCTION public\\.${f}\\([^)]*\\)[^$]*SET search_path = public AS \\$\\$`), `${f}: search_path`);
      }
      assert.doesNotMatch(m.sql, /SECURITY DEFINER/);
      assert.doesNotMatch(m.sql, /TO (anon|authenticated)\b/);
      for (const c of codesOf(m.sql)) {
        assert.ok(c in BANK_REFUSAL, `${c} has no words`);
        assert.ok(Number.isInteger(STATUS_OF[c as keyof typeof STATUS_OF]), `${c} has no status`);
      }
    });
  }
});

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
      const body = stepBody(fn);
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
  it('the nine functions; no table change (their grants are §0)', () => {
    const made = [...MIG.matchAll(/CREATE OR REPLACE FUNCTION public\.(\w+)\(/g)].map(m => m[1]);
    assert.deepEqual(made.sort(), [...FNS].sort());
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
  it('the steps the routes call are the ones mig 439 and mig 440 make', () => {
    const called = [...readCode('lib/bank-club-steps.ts').matchAll(/step\('(\w+)'/g), ...readCode('lib/bank-check-fee.ts').matchAll(/rpc\('(\w+)'/g)]
      .map(m => m[1]);
    for (const c of called) assert.ok(FNS.includes(c) || CLUB_STEPS_440.includes(c), c);
    for (const f of [...FNS.filter(f => f !== 'bank_first_club_account'), ...CLUB_STEPS_440]) assert.ok(called.includes(f), `${f} is never called`);
  });
  it('mig 439\'s steps, as LIVE now, answer the refusals the rules rely on (their words and statuses are §0)', () => {
    // The live definitions (mig 442 re-made the move, the add, the set-up and the add-line), not 439's own text.
    const codes = codesOf(FNS.map(live).join('\n'));
    for (const c of ['team_book', 'name_taken', 'not_set_up', 'one_is_open', 'ends_too_early', 'statements_exist',
      'checked_figures_fixed', 'later_checked', 'not_latest', 'changed', 'earlier_open', 'book_not_in_account']) {
      assert.ok(codes.has(c), `mig 439 answers ${c}`);
    }
  });
  /** The live definition: a later migration (442) re-made the move, the add and the add-line; their rules still hold. */
  const fn = live;
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

describe('5. a tick and a kept-out line wait for Mark checked (mig 440, R2b-2)', () => {
  /** The live definition (mig 442 re-made the club steps and the keep-out half; mig 440's rules still hold in them). */
  const fn440 = live;
  it('nothing in lib/ or app/ writes a tick or a kept-out row directly: only through a step (the coach side too, R4+)', () => {
    const everywhere = [...filesUnder('lib', '.ts'), ...filesUnder('app', '.ts'), ...filesUnder('app', '.tsx')];
    assert.ok(everywhere.includes('lib/bank-club-steps.ts'), 'the walk reaches the bank steps');
    for (const file of everywhere) {
      assert.doesNotMatch(readCode(file), /\.from\(['"](bank_check_marks|bank_line_exclusions)['"]\)\s*\.(insert|update|upsert|delete)\(/, file);
    }
  });
  it('the owner-agnostic halves are called only by a migration\'s own wrapper, never from lib/ or app/ (they skip the org check)', () => {
    for (const file of [...filesUnder('lib', '.ts'), ...filesUnder('app', '.ts'), ...filesUnder('app', '.tsx')]) {
      assert.doesNotMatch(readCode(file), /['"](bank_tick_rows|bank_keep_out_rows)['"]/, file);
    }
  });
  it('a tick and a keep-out refuse each other: a plain line kept out since the read is not ticked (review 2026-11-04)', () => {
    const body = fn440('bank_tick_rows');
    const excluded = body.search(/JOIN bank_line_exclusions x ON x\.bank_account_id = p_account AND x\.line_key = e->>'key'\s+WHERE nullif\(e->>'payoutKey', ''\) IS NULL\) THEN\s+RETURN jsonb_build_object\('ok', false, 'code', 'changed'\)/);
    const write = body.search(/DELETE FROM bank_check_marks|INSERT INTO bank_check_marks/);
    assert.ok(excluded > 0 && excluded < write, 'refused before anything is written');
    assert.match(fn440('bank_keep_out_rows'), /FROM bank_check_marks WHERE bank_account_id = p_account AND line_key = p_key\) THEN\s+RETURN jsonb_build_object\('ok', false, 'code', 'changed'\)/);
  });
  it('tickRow and keepOut call their steps through the bank step wrapper', () => {
    assert.match(stepBody('tickRow'), /await step\('bank_check_tick', \{[\s\S]*p_remove: plan\.remove, p_insert: plan\.insert,/);
    assert.match(stepBody('keepOut'), /await step\('bank_check_keep_out', \{[\s\S]*p_key: key, p_kept_out: keptOut,/);
  });
  it('the four functions, plpgsql; no table change (their grants are §0)', () => {
    const made = [...MIG_440.matchAll(/CREATE OR REPLACE FUNCTION public\.(\w+)\(/g)].map(m => m[1]);
    assert.deepEqual(made.sort(), [...CLUB_STEPS_440, ...SHARED_440].sort());
    for (const f of made) assert.match(fn440(f), /LANGUAGE plpgsql SET search_path = public AS \$\$/, f);
    assert.doesNotMatch(MIG_440, /CREATE TABLE|ALTER TABLE|DROP /, 'functions only');
  });
  it('the shared halves lock the account, then the check, FOR UPDATE, and refuse unless the statement is open', () => {
    for (const f of SHARED_440) {
      const body = fn440(f);
      const acct = body.search(/FROM bank_accounts WHERE id = p_account[^;]*FOR UPDATE;/);
      const chk = body.search(/FROM bank_checks WHERE id = p_check AND bank_account_id = p_account FOR UPDATE;/);
      const open = body.indexOf(`IF v_check.status <> 'open' THEN RETURN jsonb_build_object('ok', false, 'code', 'not_open');`);
      const write = body.search(/(INSERT INTO|DELETE FROM) bank_(check_marks|line_exclusions)/);
      assert.ok(acct > 0 && acct < chk && chk < open && open < write, `${f}: account lock → check lock → open → write`);
    }
  });
  it('the club steps lock the org\'s own live CLUB account first, then hand to the shared half', () => {
    for (const [club, shared] of [['bank_check_tick', 'bank_tick_rows'], ['bank_check_keep_out', 'bank_keep_out_rows']]) {
      const body = fn440(club);
      const lock = body.search(/WHERE id = p_account AND org_id = p_org AND owner_kind = 'club' AND archived_at IS NULL FOR UPDATE;/);
      assert.ok(lock > 0 && lock < body.indexOf(`RETURN ${shared}(`), club);
    }
  });
  it('a tick\'s unique clash is decided in the step: elsewhere is `changed`, a twin is a success', () => {
    const body = fn440('bank_tick_rows');
    const elsewhere = body.search(/line_key = ANY \(v_keys\) AND check_id <> p_check\) THEN\s+RETURN jsonb_build_object\('ok', false, 'code', 'changed'\)/);
    const write = body.search(/DELETE FROM bank_check_marks|INSERT INTO bank_check_marks/);
    assert.ok(elsewhere > 0 && elsewhere < write, 'a row ticked elsewhere is refused before anything is written');
    assert.match(body, /ON CONFLICT \(bank_account_id, line_key\) DO NOTHING;/);
  });
  it('mig 440 answers the refusals the routes rely on (their words and statuses are §0)', () => {
    const codes = codesOf(MIG_440);
    for (const c of ['not_open', 'changed', 'account_not_found', 'check_not_found', 'not_a_line']) assert.ok(codes.has(c), `mig 440 answers ${c}`);
  });
});

describe('6. a book move waits for the accounts (mig 442, R2b-3)', () => {
  const changed = String.raw`RETURN jsonb_build_object\('ok', false, 'code', 'changed'\)`;
  it('the nine functions; no table change (their grants are §0)', () => {
    assert.deepEqual(bankFnsMade(MIG_442).sort(), [...HELPERS_442, ...REMADE_442].sort());
    assert.doesNotMatch(MIG_442, /CREATE TABLE|ALTER TABLE|DROP /, 'functions only');
    // The helpers only read (STABLE sql); the steps are plpgsql. (search_path and grants: §0.)
    for (const f of HELPERS_442) assert.match(live(f), /LANGUAGE sql STABLE /, f);
    for (const f of REMADE_442) assert.match(live(f), /LANGUAGE plpgsql /, f);
  });
  it('the move reads where the book sits, locks BOTH accounts in id order, re-checks the target, THEN the book, then reads again', () => {
    const f = live('bank_book_move');
    const firstRead = f.indexOf('v_from := bank_club_account_of_book(p_org, p_ledger);');
    const accts = f.indexOf('FROM bank_accounts WHERE id IN (v_from, p_to) ORDER BY id FOR UPDATE;');
    const target = f.search(/FROM bank_accounts WHERE id = p_to AND org_id = p_org AND owner_kind = 'club' AND archived_at IS NULL;\s+IF NOT FOUND THEN RETURN jsonb_build_object\('ok', false, 'code', 'account_not_found'\)/);
    const book = f.indexOf('FROM accounting_ledgers WHERE id = p_ledger FOR UPDATE;');
    const again = f.search(new RegExp(String.raw`IF bank_club_account_of_book\(p_org, p_ledger\) IS DISTINCT FROM v_from THEN\s+${changed}`));
    const write = f.search(/INSERT INTO bank_account_books|UPDATE bank_(saved_lines|line_exclusions)|DELETE FROM bank_/);
    assert.ok(firstRead > 0 && firstRead < accts && accts < target && target < book && book < again && again < write,
      'read → both accounts (id order) → the target still a live club account → book lock → read again → write');
    // ⚠ the deadlock the prompt names: no lock (on anything) before the account locks.
    assert.equal(f.slice(0, accts).match(/FOR UPDATE/g), null, 'nothing is locked before the accounts');
  });
  it('an account is added under its own lock, NEVER the club row; the accounts are locked before the insert and the moves', () => {
    const f = live('bank_account_add');
    const own = f.indexOf(`pg_advisory_xact_lock(hashtextextended('bank_accounts_add:' || p_org::text, 0))`);
    const all = f.search(/FROM bank_accounts WHERE org_id = p_org AND owner_kind = 'club' AND archived_at IS NULL ORDER BY id FOR UPDATE;/);
    const insert = f.indexOf('INSERT INTO bank_accounts');
    const loop = f.indexOf('FOREACH v_l IN ARRAY');
    assert.ok(own > 0 && own < all && all < insert && insert < loop && f.indexOf('bank_book_move(') > loop,
      'own lock → every account (id order) → insert → moves');
    // ⚠ review 2026-11-05: the club row held while waiting for an account closed a cycle with the fiscal first-month
    // change (books lock → club row) and the fee step (account → books lock).
    assert.doesNotMatch(f, /FROM organizations[^;]*FOR (UPDATE|NO KEY UPDATE|SHARE|KEY SHARE)/, 'the club row is never locked here');
    // "The first account" is the one ADDED first: stamped at the write, not at its transaction's start.
    assert.match(f, /INSERT INTO bank_accounts \(org_id, owner_kind, name, created_by, created_at\)\s+VALUES \(p_org, 'club', v_name, p_actor, clock_timestamp\(\)\)/);
  });
  it('the club tick, keep-out and set-up ask "has this line left the account?" under the account lock, before any write', () => {
    for (const [club, ask, firstWrite] of [
      ['bank_check_tick', String.raw`WHERE bank_club_line_left\(p_org, p_account, i->>'key'\)\s*\) THEN\s+${changed}`, 'RETURN bank_tick_rows('],
      ['bank_check_keep_out', String.raw`IF bank_club_line_left\(p_org, p_account, p_key\) THEN\s+${changed}`, 'RETURN bank_keep_out_rows('],
      ['bank_account_set_up', String.raw`WHERE bank_club_line_left\(p_org, p_account, i->>'key'\)\s*\) THEN\s+${changed}`, 'UPDATE bank_accounts SET opening_date'],
    ] as const) {
      const f = live(club);
      const lock = f.search(/WHERE id = p_account AND org_id = p_org AND owner_kind = 'club' AND archived_at IS NULL FOR UPDATE;/);
      const asked = f.search(new RegExp(ask));
      const written = f.indexOf(firstWrite);
      assert.ok(lock > 0 && lock < asked && asked < written, `${club}: lock → ask → the first write`);
    }
    // The owner-agnostic halves do NOT carry the club's rule (a coach account's keys are register rows; R4 wraps its own).
    for (const f of SHARED_440) assert.doesNotMatch(live(f), /bank_club_(account_of_book|line_left)/, f);
  });
  it('"left" means the line EXISTS in a book that isn\'t this account\'s: a saved copy of a deleted line stays tickable', () => {
    const f = live('bank_club_line_left');
    assert.match(f, /SELECT EXISTS \(\s+SELECT 1 FROM accounting_entries e/);
    assert.match(f, /AND bank_club_account_of_book\(p_org, e\.ledger_id\) IS DISTINCT FROM p_account\)/);
    // The key's shape is checked before its cast (a stray key is "not left", never a 22P02).
    assert.match(f, /CASE WHEN p_key ~\* '\^entry:\[0-9a-f\]\{8\}-[^']*\$'\s+THEN substr\(p_key, 7\)::uuid END/);
  });
  it('the fee step asks the one home; no second copy of the "which account holds this book" predicate is live anywhere', () => {
    assert.match(live('bank_check_add_line'),
      /IF bank_club_account_of_book\(p_org, p_ledger\) IS DISTINCT FROM p_account THEN\s+RETURN jsonb_build_object\('ok', false, 'code', 'book_not_in_account'\)/);
    for (const f of ALL_BANK_FNS) {
      if (f === 'bank_club_account_of_book') continue;
      const body = live(f);
      // Any alias, any join shape: the mapping table is read only by the one home (the move only WRITES it).
      assert.doesNotMatch(body, /FROM\s+bank_account_books\b/i, `${f} keeps its own copy`);
      if (f !== 'bank_first_club_account' && f !== 'bank_account_add') {
        assert.doesNotMatch(body, /bank_first_club_account\(/, `${f} decides "the first account holds it" itself`);
      }
    }
    const home = live('bank_club_account_of_book');
    assert.match(home, /FROM bank_account_books b\s+JOIN bank_accounts a ON a\.id = b\.bank_account_id AND a\.owner_kind = 'club' AND a\.archived_at IS NULL/);
    assert.match(home, /bank_first_club_account\(p_org\)/);
    assert.match(home, /l\.org_id = p_org AND l\.entity_type IS DISTINCT FROM 'team'/);
  });
  it('a put-back that removes nothing is `changed`, not ok (owner-neutral, in the shared half)', () => {
    assert.match(live('bank_keep_out_rows'),
      new RegExp(String.raw`DELETE FROM bank_line_exclusions WHERE bank_account_id = p_account AND line_key = p_key;\s+GET DIAGNOSTICS v_n = ROW_COUNT;\s+IF v_n = 0 THEN ${changed}`));
  });
  it('every writer of the three decision tables holds the account lock: only mig 439, 440 and 442 steps write them', () => {
    const writes = /(INSERT INTO|UPDATE|DELETE FROM) (public\.)?bank_(saved_lines|line_exclusions|check_marks)\b/;
    for (const file of filesUnder('supabase/migrations', '.sql')) {
      if (!writes.test(sqlCode(file))) continue;
      assert.ok([MIG_439_PATH, MIG_440_PATH, MIG_442_PATH].includes(file),
        `${file} writes a bank decision row outside the locked steps`);
    }
  });
});

describe('the raw migration text is the one applied', () => {
  it('names itself and its prod order', () => {
    const raw = readSource(MIG_439_PATH);
    assert.match(raw, /Migration 439/);
    assert.match(raw, /Needs 436/);
    const raw440 = readSource(MIG_440_PATH);
    assert.match(raw440, /Migration 440/);
    assert.match(raw440, /Needs 436 \(the tables\) and 439/);
    const raw442 = readSource(MIG_442_PATH);
    assert.match(raw442, /Migration 442/);
    assert.match(raw442, /Needs 436, 439 and 440/);
  });
});

describe('a statement and a starting point are never in the future', () => {
  const body = stepBody;
  it('start and correct a statement: refused after the club\'s today', () => {
    for (const f of ['startCheck', 'refigureCheck']) assert.match(body(f), /if \(end > clubToday\(\)\) return bankRefusedAs\('ends_in_future'\)/, f);
  });
  it('set up: refused after the club\'s today', () => {
    assert.match(body('setUpAccount'), /if \(openingDate > clubToday\(\)\) return bankRefusedAs\('starts_in_future'\)/);
  });
});
