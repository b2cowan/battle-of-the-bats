import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { between, filesUnder, readCode, readSource } from './_source-code.ts';
import { BANK_REFUSAL } from '../../lib/bank-check-words.ts';
import { STATUS_OF } from '../../lib/bank-club-rules.ts';

/**
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * THE CLUB'S BANK SERVER, HELD (Bank balance check BC1; build prompt BANK_BALANCE_CHECK_BC1_BUILD_PROMPT.md step 9;
 * plan BANK_RECONCILIATION_PLAN.md §4, §7, §9 BC1). Rewritten from the R2b guard when mig 447 took the tick-off apart.
 *
 *   0. every bank migration's functions are the server's only; the LIVE set after mig 447 is exactly the balance check's,
 *      every function an earlier bank migration made is either re-made by 447 or dropped by it, and every code a live
 *      step answers has words and a status;
 *   1. every route under app/api/admin/accounting/bank/** passes `resolveClubMoney(req, { scope: 'books', write })` with
 *      the right `write`, inside `withObservability`; the route list is this guard's;
 *   2. no route reads a year or a season — and no bank route or bank library imports a coach reader;
 *   3. the client sends intent: Your books, on its way and every waiting item's figures are the server's (rule 6);
 *   4. the steps (mig 447): one live check per date, soft delete, no $0.00 gate (ruling 3), the start owns its date;
 *   5. ⚖ ASK 1 — NO BANK CODE WRITES MONEY: no bank library, route or screen, and no live bank function, writes any
 *      table but a bank table (never `accounting_entries`, never a rep money table);
 *   6. R2b-3's lock order, carried by mig 447: the add's own lock → accounts in id order → book; never book before account;
 *      one home for "which account holds this book".
 * The pure decisions have their own tests (bank-check, bank-club-routes, bank-club-read); the functions are proved on dev
 * by `.probe/bank-bc1/functions.sql` (rolled back).
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 */

const ROUTES = filesUnder('app/api/admin/accounting/bank', 'route.ts');
const SCREENS = filesUnder('components/admin/kit/club/money/bank', '.tsx').concat(filesUnder('components/admin/kit/club/money/bank', '.ts'));
const BANK_LIBS = ['lib/bank-check.ts', 'lib/bank-club-steps.ts', 'lib/bank-club-rules.ts', 'lib/bank-check-words.ts',
  'lib/bank-club-read.ts', 'lib/bank-club-map.ts', 'lib/bank-tab-words.ts'];
const sqlCode = (path: string) => readCode(path).split('\n').map(l => l.replace(/--.*$/, '')).join('\n');
const MIG_447_PATH = 'supabase/migrations/447_the_bank_check_is_a_balance.sql';
const MIG_447 = sqlCode(MIG_447_PATH);

/** The bank functions after mig 447: the balance check's whole database half (a trigger function aside). */
const LIVE_FNS = ['bank_first_club_account', 'bank_club_account_of_book', 'bank_book_move', 'bank_account_add',
  'bank_books_through', 'bank_check_save', 'bank_check_delete'];

/** A function's CREATE head, however it is spelled (case, OR REPLACE, the schema), so a migration can't slip past. */
const fnHead = (name: string) => new RegExp(String.raw`CREATE\s+(?:OR\s+REPLACE\s+)?FUNCTION\s+(?:public\.)?${name}\s*\(`, 'i');
/** The bank functions a migration makes, trigger functions aside (mig 436's guard is no step and has no grant). */
const bankFnsMade = (sql: string) =>
  [...sql.matchAll(/CREATE\s+(?:OR\s+REPLACE\s+)?FUNCTION\s+(?:public\.)?(bank_\w+)\s*\(/gi)]
    .filter(m => !/RETURNS\s+trigger\b/i.test(sql.slice(m.index!, sql.indexOf('$$', m.index!)))).map(m => m[1]);
/** Every migration that makes a bank function, in number order (436's trigger aside, so 439 is first). */
const BANK_FN_MIGS = filesUnder('supabase/migrations', '.sql').sort()
  .map(path => ({ path, sql: sqlCode(path) })).map(m => ({ ...m, fns: bankFnsMade(m.sql) })).filter(m => m.fns.length > 0);
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
/** Every refusal code a function body answers or raises. */
const codesOf = (sql: string) =>
  new Set([...sql.matchAll(/'code', '(\w+)'/g), ...sql.matchAll(/bank_step_refused:(\w+)/g)].map(m => m[1]).filter(c => c !== '%'));
const STEPS_CODE = readCode('lib/bank-club-steps.ts');
/** One exported bank step's body (throws when it is gone). */
const stepBody = (name: string) => between(STEPS_CODE, `export async function ${name}(`, '\nexport ', name);

describe('0. the bank functions: the server\'s only, the live set is the balance check\'s, every code has words', () => {
  it('mig 447 is the last bank migration that makes a function, and it makes exactly the live set', () => {
    assert.equal(BANK_FN_MIGS.at(-1)?.path, MIG_447_PATH, 'a later bank migration must be added to this guard');
    assert.deepEqual([...BANK_FN_MIGS.at(-1)!.fns].sort(), [...LIVE_FNS].sort());
  });
  it('every function an earlier bank migration made is re-made by 447 or DROPPED by it (by signature, IF EXISTS)', () => {
    const earlier = new Set(BANK_FN_MIGS.slice(0, -1).flatMap(m => m.fns));
    for (const f of earlier) {
      if (LIVE_FNS.includes(f)) continue;
      assert.match(MIG_447, new RegExp(String.raw`DROP FUNCTION IF EXISTS public\.${f}\(`), `${f} is neither live nor dropped`);
    }
  });
  for (const m of BANK_FN_MIGS) {
    it(`${m.path}: service role only, its search_path set`, () => {
      for (const f of m.fns) {
        assert.match(m.sql, new RegExp(`REVOKE ALL ON FUNCTION public\\.${f}\\([^)]*\\) FROM PUBLIC, anon, authenticated;`), f);
        assert.match(m.sql, new RegExp(`GRANT EXECUTE ON FUNCTION public\\.${f}\\([^)]*\\) TO service_role;`), f);
        assert.match(m.sql, new RegExp(`FUNCTION public\\.${f}\\([^)]*\\)[^$]*SET search_path = public AS \\$\\$`), `${f}: search_path`);
      }
      assert.doesNotMatch(m.sql, /SECURITY DEFINER/);
      assert.doesNotMatch(m.sql, /TO (anon|authenticated)\b/);
    });
  }
  it('every code a LIVE step answers or raises has words and a status', () => {
    for (const c of codesOf(LIVE_FNS.map(live).join('\n'))) {
      assert.ok(c in BANK_REFUSAL, `${c} has no words`);
      assert.ok(Number.isInteger(STATUS_OF[c as keyof typeof STATUS_OF]), `${c} has no status`);
    }
  });
  it('the new table is service role only, RLS on, no policy (dictionary rule 7)', () => {
    assert.match(MIG_447, /ALTER TABLE public\.bank_check_waiting ENABLE ROW LEVEL SECURITY;/);
    assert.match(MIG_447, /REVOKE ALL ON public\.bank_check_waiting FROM anon, authenticated;/);
    assert.match(MIG_447, /GRANT SELECT, INSERT, UPDATE, DELETE ON public\.bank_check_waiting TO service_role;/);
    assert.doesNotMatch(MIG_447, /CREATE POLICY/);
  });
});

/** Each route file's handlers, and whether each writes. */
const EXPECTED: Record<string, Record<string, boolean>> = {
  'app/api/admin/accounting/bank/route.ts': { GET: false, POST: true },
  'app/api/admin/accounting/bank/accounts/[accountId]/route.ts': { GET: false, PATCH: true },
  'app/api/admin/accounting/bank/accounts/[accountId]/setup/route.ts': { PUT: true },
  'app/api/admin/accounting/bank/accounts/[accountId]/books/route.ts': { POST: true },
  'app/api/admin/accounting/bank/accounts/[accountId]/checks/route.ts': { POST: true },
  'app/api/admin/accounting/bank/accounts/[accountId]/checks/[checkId]/route.ts': { DELETE: true },
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
      // `coach-register` is imported for `toCents` and Cash on hand's one arithmetic only; nothing else coach-side.
      for (const spec of imports) {
        if (/(^|\/)coach-/.test(spec)) assert.match(spec, /(^|\/)coach-register$/, `${file} imports ${spec}`);
      }
    });
  }
  it('a route imports only the gate, the bank steps, the request readers and the words', () => {
    for (const file of ROUTES) {
      for (const spec of [...readCode(file).matchAll(/from ['"]([^'"]+)['"]/g)].map(m => m[1])) {
        assert.ok(['next/server', '@/lib/observability', '@/lib/club-money-route', '@/lib/bank-club-steps', '@/lib/bank-club-rules',
          '@/lib/bank-check-words'].includes(spec), `${file} imports ${spec}`);
      }
    }
  });
});

describe('3. the client sends intent; the server decides (rule 6)', () => {
  const rules = readCode('lib/bank-club-rules.ts');
  it('a save reads the account and figures the day on the server, then asks the pure rules', () => {
    const body = stepBody('saveCheck');
    assert.match(body, /const refusal = saveRefusal\(\{ asked, date, today, checks \}\);\s+if \(refusal\) return bankRefusedAs\(refusal\);/);
    assert.match(body, /const figure = await figureForDate\(ctx\.org\.id, account, checks, date, today, \{ kind: asked, suspects: false \}\);/);
    assert.match(body, /entriesById\(waitingIdsOf\(body\.waiting\)\)/, 'a waiting line\'s figures are read from the books by id');
    assert.match(body, /const plan = savePlan\(\{/);
    assert.match(body, /booksCents: figure\.booksCents, onItsWay: figure\.onItsWay, bookIds: bookIdsOf\(account\.books\)/);
  });
  it('the request never supplies the books, on its way, a difference or a waiting line\'s figures', () => {
    for (const file of ['lib/bank-club-steps.ts', 'lib/bank-club-rules.ts']) {
      assert.doesNotMatch(readCode(file), /body\.(booksCents|onItsWayCents|differenceCents|shouldBeCents|bookIds|kind|amountCents|direction|label)\b/, file);
    }
    // Only the bank balance and the cash are typed figures.
    assert.match(rules, /readCents\(body\.bankCents, \{ positive: false \}\)/);
    assert.match(rules, /cashCents = readCents\(body\.cashCents, \{ positive: true \}\)/);
  });
  it('a waiting line must be a posted line of the account\'s books dated on or before the statement, never one on its way', () => {
    assert.match(rules, /if \(!r \|\| r\.status !== 'posted' \|\| !books\.has\(r\.ledger_id\) \|\| r\.entry_date > date \|\| onItsWay\.has\(k as string\)\) return no\('bad_item'\);/);
  });
  it('every write is awaited', () => {
    for (const line of STEPS_CODE.split('\n')) {
      if (/supabaseAdmin\.(from\([^)]*\)\.(insert|update|delete|upsert)|rpc)\(/.test(line)) assert.match(line, /await /, line.trim());
    }
  });
  it('the steps the routes call are mig 447\'s, and bank_books_through is the read\'s', () => {
    const called = [...STEPS_CODE.matchAll(/step\('(\w+)'/g)].map(m => m[1]).sort();
    assert.deepEqual(called, ['bank_account_add', 'bank_book_move', 'bank_check_delete', 'bank_check_save']);
    assert.match(readCode('lib/bank-club-read.ts'), /supabaseAdmin\.rpc\('bank_books_through', \{ p_ledgers: \[\.\.\.bookIds\], p_dates: asked \}\)/);
  });
});

describe('4. the steps (mig 447)', () => {
  it('save: the account locked FIRST, then the date rules, no $0.00 gate, replace-then-insert', () => {
    const f = live('bank_check_save');
    const lock = f.search(/FROM bank_accounts WHERE id = p_account AND org_id = p_org AND archived_at IS NULL FOR UPDATE;/);
    assert.ok(lock > 0 && f.slice(0, lock).match(/FOR UPDATE/g) === null, 'nothing is locked before the account');
    assert.match(f, /IF p_date > v_today THEN RETURN jsonb_build_object\('ok', false, 'code', 'ends_in_future'\)/);
    assert.match(f, /IF p_date <= v_start\.statement_end_date THEN RETURN jsonb_build_object\('ok', false, 'code', 'before_start'\)/);
    assert.match(f, /IS DISTINCT FROM v_books THEN\s+RETURN jsonb_build_object\('ok', false, 'code', 'changed'\)/);
    // Ruling 3: a check saves whether it matches or not. Nothing in the step compares the figures with each other.
    assert.doesNotMatch(f, /not_zero|difference/i);
    const replace = f.indexOf('UPDATE bank_checks SET deleted_at = now(), deleted_by = p_actor');
    const insert = f.indexOf('INSERT INTO bank_checks');
    assert.ok(replace > lock && replace < insert, 'the live check of the date goes (soft), then the new one');
    assert.match(f, /at_start\)\s+VALUES \([^;]*p_kind = 'start'\);/, 'at_start comes from the kind, never the request');
  });
  it('delete is SOFT, and the start can\'t go while a later check stands', () => {
    const f = live('bank_check_delete');
    assert.match(f, /'start_has_checks'/);
    assert.match(f, /UPDATE bank_checks SET deleted_at = now\(\), deleted_by = p_actor WHERE id = p_check;/);
    assert.doesNotMatch(f, /DELETE FROM/);
  });
  it('no live step DELETEs a check row (asks 5 and 6: who and when are kept)', () => {
    for (const f of LIVE_FNS) assert.doesNotMatch(live(f), /DELETE FROM (public\.)?bank_checks\b/, f);
  });
  it('the books through a date: posted lines only, club_book_totals\' rule, one pass (MATERIALIZED, dba 2026-11-05)', () => {
    const f = live('bank_books_through');
    assert.match(f, /LANGUAGE sql STABLE/);
    assert.match(f, /e\.status = 'posted'/);
    assert.match(f, /CASE WHEN e\.entry_type IN \('income', 'transfer_in'\) THEN e\.amount ELSE -e\.amount END/);
    assert.equal((f.match(/AS MATERIALIZED/g) ?? []).length, 2);
  });
  it('one live check per date and one live start per account; a waiting key is once per check', () => {
    assert.match(MIG_447, /CREATE UNIQUE INDEX IF NOT EXISTS bank_checks_one_live_per_date ON public\.bank_checks \(bank_account_id, statement_end_date\)\s+WHERE deleted_at IS NULL;/);
    assert.match(MIG_447, /CREATE UNIQUE INDEX IF NOT EXISTS bank_checks_one_live_start ON public\.bank_checks \(bank_account_id\)\s+WHERE kind = 'start' AND deleted_at IS NULL;/);
    assert.match(MIG_447, /CONSTRAINT bank_check_waiting_once UNIQUE \(check_id, line_key\)/);
  });
  it('the route holds the same date rules in ONE place, which the screen\'s figure and the save both ask', () => {
    const rules = readCode('lib/bank-club-rules.ts');
    assert.match(rules, /if \(i\.date > i\.today\) return 'ends_in_future';/);
    assert.match(rules, /if \(i\.date <= start\.date\) return 'before_start';/);
    assert.match(readCode('lib/bank-club-read.ts'), /const refused = saveRefusal\(\{ asked: kind, date, today, checks \}\);/);
  });
  it('the club-book kinds the save step compares are the code\'s own (CLUB_OWNED_BOOK_KINDS): one list, or every save reads `changed`', () => {
    const kinds = /CLUB_OWNED_BOOK_KINDS: readonly ClubBookKind\[\] = \[([^\]]+)\]/.exec(readCode('lib/club-money-figures.ts'))![1];
    const sql = /l\.entity_type IN \(([^)]+)\)\s+AND bank_club_account_of_book\(p_org, l\.id\) = p_account/.exec(live('bank_check_save'))![1];
    assert.equal(sql.replace(/\s/g, ''), kinds.replace(/\s/g, ''));
  });
});

describe('5. ⚖ ask 1 — no bank code writes money', () => {
  const BANK_CODE = [...BANK_LIBS, ...ROUTES, ...SCREENS];
  it('the walk reaches every bank file', () => {
    assert.ok(SCREENS.some(f => f.endsWith('BankTab.tsx')) && ROUTES.length === Object.keys(EXPECTED).length);
  });
  for (const file of BANK_CODE) {
    it(file, () => {
      const code = readCode(file);
      // Every table a bank file writes is a bank table: never accounting_entries, never a rep money table, never any other.
      for (const m of code.matchAll(/\.from\(['"](\w+)['"]\)\s*\.(insert|update|upsert|delete)\(/g)) {
        assert.match(m[1], /^bank_/, `${file} writes ${m[1]}`);
      }
      // Every database function a bank file calls is a bank function.
      for (const m of code.matchAll(/\.rpc\(['"](\w+)['"]/g)) assert.match(m[1], /^bank_/, `${file} calls ${m[1]}`);
      // No bank file reaches a money writer by import.
      for (const spec of [...code.matchAll(/from ['"]([^'"]+)['"]/g)].map(m => m[1])) {
        assert.doesNotMatch(spec, /(accounting-entry|ledger-write|record-money|money-write|bank-check-fee)/, `${file} imports ${spec}`);
      }
    });
  }
  // (An upsert's `ON CONFLICT … DO UPDATE SET` writes the INSERT's own table, already read.)
  it('no live bank function writes any table but a bank table', () => {
    for (const f of LIVE_FNS) {
      for (const m of live(f).matchAll(/\b(?:INSERT INTO|(?<!DO\s)UPDATE|DELETE FROM)\s+(?:public\.)?(\w+)/gi)) {
        assert.match(m[1], /^bank_/, `${f} writes ${m[1]}`);
      }
    }
  });
});

describe('6. R2b-3\'s lock order, carried by mig 447', () => {
  const changed = String.raw`RETURN jsonb_build_object\('ok', false, 'code', 'changed'\)`;
  it('the move reads where the book sits, locks BOTH accounts in id order, re-checks the target, THEN the book, then reads again', () => {
    const f = live('bank_book_move');
    const firstRead = f.indexOf('v_from := bank_club_account_of_book(p_org, p_ledger);');
    const accts = f.indexOf('FROM bank_accounts WHERE id IN (v_from, p_to) ORDER BY id FOR UPDATE;');
    const target = f.search(/FROM bank_accounts WHERE id = p_to AND org_id = p_org AND owner_kind = 'club' AND archived_at IS NULL;\s+IF NOT FOUND THEN RETURN jsonb_build_object\('ok', false, 'code', 'account_not_found'\)/);
    const book = f.indexOf('FROM accounting_ledgers WHERE id = p_ledger FOR UPDATE;');
    const again = f.search(new RegExp(String.raw`IF bank_club_account_of_book\(p_org, p_ledger\) IS DISTINCT FROM v_from THEN\s+${changed}`));
    const write = f.search(/INSERT INTO bank_account_books/);
    assert.ok(firstRead > 0 && firstRead < accts && accts < target && target < book && book < again && again < write,
      'read → both accounts (id order) → the target still a live club account → book lock → read again → write');
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
    assert.doesNotMatch(f, /FROM organizations[^;]*FOR (UPDATE|NO KEY UPDATE|SHARE|KEY SHARE)/, 'the club row is never locked here');
    assert.match(f, /INSERT INTO bank_accounts \(org_id, owner_kind, name, created_by, created_at\)\s+VALUES \(p_org, 'club', v_name, p_actor, clock_timestamp\(\)\)/);
  });
  it('save and delete lock the account and never a book or the club row', () => {
    for (const f of ['bank_check_save', 'bank_check_delete']) {
      const body = live(f);
      assert.match(body, /FROM bank_accounts WHERE id = p_account AND org_id = p_org AND archived_at IS NULL FOR UPDATE;/, f);
      assert.doesNotMatch(body, /FROM (accounting_ledgers|organizations)[^;]*FOR (UPDATE|NO KEY UPDATE|SHARE|KEY SHARE)/, f);
    }
  });
  it('"which account holds this book" has ONE home; no live function keeps a second copy', () => {
    for (const f of LIVE_FNS) {
      if (f === 'bank_club_account_of_book') continue;
      assert.doesNotMatch(live(f), /FROM\s+bank_account_books\b/i, `${f} keeps its own copy`);
      if (f !== 'bank_first_club_account' && f !== 'bank_account_add') {
        assert.doesNotMatch(live(f), /bank_first_club_account\(/, `${f} decides "the first account holds it" itself`);
      }
    }
    const home = live('bank_club_account_of_book');
    assert.match(home, /FROM bank_account_books b\s+JOIN bank_accounts a ON a\.id = b\.bank_account_id AND a\.owner_kind = 'club' AND a\.archived_at IS NULL/);
    assert.match(home, /l\.org_id = p_org AND l\.entity_type IS DISTINCT FROM 'team'/);
    assert.match(home, /bank_first_club_account\(p_org\)/);
  });
  it('a club\'s first account is its oldest live CLUB account (rule 1)', () => {
    assert.match(live('bank_first_club_account'), /owner_kind = 'club' AND archived_at IS NULL\s+ORDER BY created_at, id LIMIT 1/);
  });
});

describe('the raw migration text is the one applied', () => {
  it('names itself and the one end shape on dev and prod', () => {
    const raw = readSource(MIG_447_PATH);
    assert.match(raw, /Migration 447/);
    assert.match(raw, /ONE END SHAPE, whatever ran before: dev has 436, 437, 439, 440 and 442; prod has 436, 437 and 439 only/);
  });
});
