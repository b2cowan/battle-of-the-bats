/**
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * **A NEW TABLE GRANTS THE SERVER ITS OWN ACCESS** (Supabase platform change, effective 2026-10-30;
 * notice received 2026-09-24).
 *
 * From 2026-10-30 Supabase stops auto-granting Data API access to NEW tables in `public`, on every
 * existing project. It runs, once, on both of ours:
 *
 *   alter default privileges for role postgres in schema public
 *     revoke select, insert, update, delete on tables from anon, authenticated, service_role;
 *
 * Tables that exist on that date keep their grants. A table created after it has none, and the Data
 * API answers `permission denied` however correct its RLS is — grants and RLS are separate layers.
 * Every client this app has (`supabaseAdmin`, the server session client, the browser client) goes
 * through the Data API, and every migration runs as `postgres` (Management API), so every new table
 * is in scope.
 *
 * ⚠ MIGRATION 025 DOES NOT COVER US. It re-grants service_role through the very default-privileges
 * entry the revoke above names, so the revoke cancels it. Read live on dev 2026-09-24: anon and
 * authenticated ALREADY lack the default there (mig 309's table has no SELECT for either);
 * service_role still holds it only because of 025.
 *
 * ⚠⚠ THE FAILURE THIS PREVENTS IS PROD-ONLY. A migration reaches dev days or weeks before prod. A
 * table applied to dev before the date and to prod after it works in every test, then fails for the
 * server's own admin client on prod. The drift gate compares tables and columns, not grants, so it
 * stays green. The migration is the only place it can be stopped.
 *
 * THE RULE, for every migration numbered above WATERMARK: each table it creates in `public` is
 * granted select, insert, update and delete (or `all`) to service_role in the same file.
 *
 * anon / authenticated are deliberately NOT required: grant them only when the browser genuinely
 * reads the table, which is the posture dev has held all along. Auto-granting them is exactly what
 * Supabase is removing, and on prod it has twice nearly exposed data the app layer meant to gate.
 *
 * Exception — a table the server genuinely never touches through the Data API (written only by a
 * SECURITY DEFINER trigger, say): put `no-service-role-grant: <table> — <reason>` in a comment in
 * the same migration.
 *
 * Migrations 001–309 are applied history and are never edited; the watermark is why they are not
 * checked.
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const REPO = join(import.meta.dirname, '..', '..');
const MIGRATIONS = join(REPO, 'supabase', 'migrations');
const readMigration = (file: string) => readFileSync(join(MIGRATIONS, file), 'utf8');

/** The last migration written before this rule existed. Every migration above it is checked. */
const WATERMARK = 309;

const SERVER_PRIVILEGES = ['select', 'insert', 'update', 'delete'];

/**
 * Live tables that no migration in the folder creates, so the matcher cannot be expected to find
 * them: the original tournament tables (they predate `supabase/migrations/` and live in the old
 * combined baseline) and `league_email_log`, which was created by hand. Do NOT add to this list
 * to quiet the blindness test below — a table created outside a migration also skips the grant
 * rule, which is the thing this file exists to stop.
 */
const CREATED_OUTSIDE_MIGRATIONS = new Set([
  'announcements', 'diamonds', 'divisions', 'games', 'pools', 'resources', 'rule_items', 'rules',
  'teams', 'tournaments', 'league_email_log',
]);

/**
 * The SQL with comments removed and string literals emptied, so a table named in a comment or in a
 * COMMENT ON string is not a table, and a grant that has been commented out is not a grant.
 * Dollar-quote delimiters are dropped but their bodies KEPT: a table created inside a DO block is
 * still a table.
 */
function codeOnly(sql: string): string {
  let out = '';
  let i = 0;
  while (i < sql.length) {
    const two = sql.slice(i, i + 2);
    if (two === '--') {
      const nl = sql.indexOf('\n', i);
      i = nl === -1 ? sql.length : nl;
      continue;
    }
    if (two === '/*') {
      const end = sql.indexOf('*/', i + 2);
      i = end === -1 ? sql.length : end + 2;
      out += ' ';
      continue;
    }
    if (sql[i] === "'") {
      i++;
      while (i < sql.length) {
        if (sql[i] === "'" && sql[i + 1] === "'") { i += 2; continue; }
        if (sql[i] === "'") { i++; break; }
        i++;
      }
      out += "''";
      continue;
    }
    const dollar = /^\$[a-z_]*\$/i.exec(sql.slice(i, i + 64));
    if (dollar) {
      i += dollar[0].length;
      out += ' ';
      continue;
    }
    out += sql[i];
    i++;
  }
  return out;
}

const IDENT = String.raw`(?:"[^"]+"|[a-z_][a-z0-9_$]*)`;
const QUALIFIED = String.raw`${IDENT}(?:\s*\.\s*${IDENT})?`;

/** `[schema, table]`, lower-cased; an unqualified name resolves to `public`. */
function splitName(name: string): [string, string] {
  const parts = name.split('.').map(p => p.trim().replace(/^"|"$/g, '').toLowerCase());
  return parts.length === 2 ? [parts[0], parts[1]] : ['public', parts[0]];
}

/** Tables the migration creates in `public`. A TEMP table dies with its session and is skipped. */
function createdTables(code: string): string[] {
  const re = new RegExp(
    String.raw`\bcreate\s+((?:global\s+|local\s+)?(?:temp|temporary)\s+|unlogged\s+)?table\s+(?:if\s+not\s+exists\s+)?(${QUALIFIED})`,
    'gi',
  );
  const out: string[] = [];
  for (const m of code.matchAll(re)) {
    if (m[1] && /temp/i.test(m[1])) continue;
    const [schema, table] = splitName(m[2]);
    if (schema === 'public') out.push(table);
  }
  return out;
}

/** Table privileges named in a GRANT; a column-level grant (`update (col)`) is not a table grant. */
function tablePrivileges(list: string): string[] {
  const out: string[] = [];
  const re = /\b(all(?:\s+privileges)?|select|insert|update|delete|truncate|references|trigger|maintain)\b\s*(\([^)]*\))?/gi;
  for (const m of list.matchAll(re)) {
    if (m[2]) continue;
    const p = m[1].toLowerCase();
    if (p.startsWith('all')) out.push(...SERVER_PRIVILEGES);
    else out.push(p);
  }
  return out;
}

/** Privileges service_role receives from this migration, per table, plus any schema-wide grant. */
function serviceRoleGrants(code: string): { perTable: Map<string, Set<string>>; schemaWide: Set<string> } {
  const perTable = new Map<string, Set<string>>();
  const schemaWide = new Set<string>();
  for (const m of code.matchAll(/\bgrant\s+([^;]+?)\s+on\s+([^;]+?)\s+to\s+([^;]+?)\s*;/gi)) {
    const grantees = m[3]
      .split(/\s+with\s+grant\s+option|\s+granted\s+by\s/i)[0]
      .split(',')
      .map(g => g.trim().replace(/^"|"$/g, '').toLowerCase());
    if (!grantees.includes('service_role')) continue;

    const privileges = tablePrivileges(m[1]);
    const target = m[2].trim().replace(/^table\s+/i, '');
    const allTables = /^all\s+tables\s+in\s+schema\s+(.+)$/i.exec(target);
    if (allTables) {
      if (allTables[1].split(',').some(s => splitName(s)[1] === 'public')) privileges.forEach(p => schemaWide.add(p));
      continue;
    }
    if (/^(?:all\s+\w+\s+in\s+schema|function|functions|procedure|routine|sequence|sequences|schema|database|domain|type|language|foreign|large\s+object|tablespace|parameter)\b/i.test(target)) continue;

    for (const name of target.split(',')) {
      const [schema, table] = splitName(name);
      if (schema !== 'public') continue;
      const held = perTable.get(table) ?? new Set<string>();
      privileges.forEach(p => held.add(p));
      perTable.set(table, held);
    }
  }
  return { perTable, schemaWide };
}

/**
 * Tables exempted by a `no-service-role-grant: <table> — <reason>` comment. A bare marker exempts
 * nothing, and the reason must sit on the marker's own line — `\s` would reach the next line's
 * `--` and read it as the dash.
 */
function exemptions(sql: string): Set<string> {
  const out = new Set<string>();
  for (const m of sql.matchAll(/no-service-role-grant:[ \t]*(?:public\.)?([a-z_][a-z0-9_$]*)[ \t]*[—–:-]+[ \t]*\S/gi)) {
    out.add(m[1].toLowerCase());
  }
  return out;
}

/** Every public table the migration creates without giving service_role all four privileges. */
function ungrantedTables(sql: string): string[] {
  const code = codeOnly(sql);
  const { perTable, schemaWide } = serviceRoleGrants(code);
  const exempt = exemptions(sql);
  return [...new Set(createdTables(code))].filter(table => {
    if (exempt.has(table)) return false;
    const held = perTable.get(table) ?? new Set<string>();
    return !SERVER_PRIVILEGES.every(p => held.has(p) || schemaWide.has(p));
  });
}

const migrationNumber = (file: string) => Number(/^(\d+)_/.exec(file)?.[1] ?? NaN);
const migrationFiles = () => readdirSync(MIGRATIONS).filter(f => f.endsWith('.sql')).sort();

describe('a new table grants the server its own access (Supabase stops auto-granting 2026-10-30)', () => {
  it('every migration above the watermark grants service_role on each public table it creates', () => {
    const failures = migrationFiles()
      .filter(f => migrationNumber(f) > WATERMARK)
      .flatMap(f => ungrantedTables(readMigration(f)).map(t => `${f}: public.${t}`));
    assert.deepEqual(
      failures,
      [],
      'These tables would be unreachable by the server after 2026-10-30. Add to the same migration:\n' +
        '  grant select, insert, update, delete on public.<table> to service_role;\n' +
        'Grant anon/authenticated only if the browser genuinely reads the table. See this file\'s header.',
    );
  });

  it('the watermark names a real migration, and history has a table the rule would have caught', () => {
    const at = migrationFiles().filter(f => migrationNumber(f) === WATERMARK);
    assert.equal(at.length, 1, `expected exactly one migration numbered ${WATERMARK}`);
    assert.deepEqual(ungrantedTables(readMigration(at[0])), ['rep_team_call_up_appearances']);
  });

  it('the matcher is not blind: it finds every live table a migration created', () => {
    const seen = new Set(migrationFiles().flatMap(f => createdTables(codeOnly(readMigration(f)))));
    const snapshot = JSON.parse(
      readFileSync(join(REPO, 'docs', 'agents', 'db', 'schema-snapshots', 'schema-dump-columns-dev.json'), 'utf8'),
    );
    const rows: { table_name: string }[] = Array.isArray(snapshot) ? snapshot : Object.values(snapshot);
    const live = new Set(rows.map(r => r.table_name));
    assert.ok(live.size > 100, 'the dev snapshot looks empty — the check below would pass vacuously');
    const missed = [...live].filter(t => !seen.has(t) && !CREATED_OUTSIDE_MIGRATIONS.has(t)).sort();
    assert.deepEqual(missed, [], 'live tables the matcher cannot find in any migration');
  });
});

describe('the grants matcher', () => {
  const FOUR = 'grant select, insert, update, delete on public.x to service_role;';

  it('flags a table created with no grant', () => {
    assert.deepEqual(ungrantedTables('create table if not exists public.x (id uuid primary key);'), ['x']);
  });

  it('accepts the four privileges, `all`, `all privileges on table`, and a schema-wide grant', () => {
    for (const grant of [
      FOUR,
      'GRANT ALL ON public.x TO authenticated, service_role;',
      'grant all privileges on table public.x to service_role with grant option;',
      'grant all privileges on all tables in schema public to service_role;',
    ]) {
      assert.deepEqual(ungrantedTables(`create table public.x (id uuid);\n${grant}`), [], grant);
    }
  });

  it('flags a partial grant, a grant to another role, and a column-level grant', () => {
    for (const grant of [
      'grant select on public.x to service_role;',
      'grant select, insert, update, delete on public.x to authenticated;',
      'grant select, insert, update (name), delete on public.x to service_role;',
      'grant execute on function public.x() to service_role;',
    ]) {
      assert.deepEqual(ungrantedTables(`create table public.x (id uuid);\n${grant}`), ['x'], grant);
    }
  });

  it('a commented-out grant is not a grant', () => {
    assert.deepEqual(ungrantedTables(`create table public.x (id uuid);\n-- ${FOUR}`), ['x']);
    assert.deepEqual(ungrantedTables(`create table public.x (id uuid);\n/* ${FOUR} */`), ['x']);
  });

  it('ignores TEMP tables, other schemas, and a table named in a comment or a string', () => {
    const sql = [
      'create temp table scratch (id int);',
      'create table cron.job_log (id int);',
      '-- create table public.ghost would be wrong here',
      "comment on table public.y is 'we did not create table public.z';",
    ].join('\n');
    assert.deepEqual(ungrantedTables(sql), []);
  });

  it('sees an unqualified name as public, and a table created inside a DO block', () => {
    assert.deepEqual(ungrantedTables('create table x (id uuid);'), ['x']);
    assert.deepEqual(
      ungrantedTables('do $$ begin if true then create table public.x (id uuid); end if; end $$;'),
      ['x'],
    );
  });

  it('one grant can cover several tables', () => {
    const sql = 'create table public.a (id uuid);\ncreate table public.b (id uuid);\n' +
      'grant all on public.a, public.b to service_role;';
    assert.deepEqual(ungrantedTables(sql), []);
  });

  it('the exemption needs a reason', () => {
    const sql = 'create table public.x (id uuid);';
    assert.deepEqual(ungrantedTables(`-- no-service-role-grant: x — written only by a definer trigger\n${sql}`), []);
    assert.deepEqual(ungrantedTables(`-- no-service-role-grant: x\n${sql}`), ['x']);
    assert.deepEqual(ungrantedTables(`-- no-service-role-grant: x\n-- a later comment\n${sql}`), ['x']);
  });

  it('reads a real granted migration as granted (186, fan_follows)', () => {
    const file = migrationFiles().find(f => migrationNumber(f) === 186);
    assert.ok(file);
    assert.deepEqual(ungrantedTables(readMigration(file)), []);
  });
});
