import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, it } from 'node:test';

/**
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * THE TEAM MOVE LEAVES NOTHING BEHIND — THE BUILD GATE (Club Tier Stage 2, B04 / Ask 2; owner
 * ruling 2026-09-28: "the move carries every table the team owns … a build gate keeps that list
 * complete").
 *
 * Migration 067's move was written for ~17 tables and never revised. By 2026-09 it left ~48 team
 * tables and the staff memberships behind, and nobody noticed for a year because nothing compared
 * the list to the schema. THIS does: every table in the schema snapshot that carries `org_id` must
 * be
 *   - MOVED        — listed in the move function's `c_moves` (every row the coach's org holds moves);
 *   - PARTLY MOVED — listed in `c_moves_some` (only the team's part; each has its own statement);
 *   - or STAYS     — listed below, WITH A REASON a reviewer can argue with.
 * A table in none of them fails the build, by name. That is the decision point: a new table that
 * carries `org_id` is either the team's (add it to the move — a new migration re-creating the
 * function) or it isn't (add it to STAYS and say why).
 *
 * ⚠ Why EVERY org_id table and not only `rep_*`: the team's data also lives in tables without the
 * prefix — the staff chat room, the family portal links, the families' consents and email opt-outs,
 * budget categories, payees, pending staff invites. A `rep_*`-only gate would have missed exactly
 * the rows whose loss hurts most (an opt-out left behind lets the club email a family who asked
 * not to be contacted).
 *
 * Reads: the committed snapshots (the live schema — AGENCY_RULES: decide from the snapshots, never
 * from migration files) and the NEWEST migration that defines `move_team_into_club`.
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 */

const REPO = path.join(import.meta.dirname, '..', '..');
const SNAPSHOTS = [
  'docs/agents/db/schema-snapshots/schema-dump-columns-dev.json',
  'docs/agents/db/schema-snapshots/schema-dump-columns-prod.json',
];
const MIGRATIONS = 'supabase/migrations';
const FUNCTION_NAME = 'move_team_into_club';

/**
 * The tables that carry `org_id` and stay with the coach's own org, each with its reason.
 * Grouped so a reviewer reads the argument once per group.
 */
const STAYS: Record<string, string> = {
  // ── The coach's org as an ACCOUNT — its record, its billing, its settings ──────────────────────
  org_audit_log: 'each org keeps its own audit history; the move writes a row into both',
  org_internal_notes: 'FieldLogicHQ operator notes about the account',
  org_overrides: 'the account’s billing/comp overrides (a Founding Season comp, a waiver)',
  organization_billing_facts: 'the account’s billing record',
  billing_retained_records: 'the account’s data-retention lifecycle',
  billing_retention_intents: 'the account’s data-retention lifecycle',
  team_entitlements: 'the old portal’s own plan — the move cancels it, and it stays as that portal’s record',
  org_public_site_content: 'the coach org’s own public-site page, not the team',
  notifications: 'bell messages already delivered, addressed to the old portal’s pages',
  notification_preferences: 'a person’s settings for the old portal; the club’s defaults apply in the club',
  rep_allocation_reminder_waves: 'a CLUB’s record of its allocation reminders (mig 315); a coach’s own org never bills a team, so it has none to move',
  feedback_submissions: 'telemetry',
  platform_events: 'telemetry',
  platform_audit_log: 'telemetry',
  error_events: 'telemetry',
  request_metrics_raw: 'telemetry',
  request_metrics_rollup: 'telemetry',
  // ── Person records: re-derived IN THE CLUB by families_attach_people (mig 252), not moved ─────
  org_people: 'a person is org-scoped by design (mig 251); the moved rows are re-attached to the club’s people',
  org_person_emails: 'the org’s address book for its people — re-derived in the club',
  org_person_match_rejections: 'the org’s duplicate-review decisions about its own people',
  org_person_merges: 'the org’s merge history about its own people',
  // ── The coach's OWN tournament (a Premium portal includes one) — the org's, not the team's ────
  tournaments: 'the coach org’s hosted tournament does not move (an open one refuses the move)',
  tournament_archives: 'belongs to the coach org’s tournament',
  tournament_registration_fields: 'belongs to the coach org’s tournament',
  tournament_roster_players: 'a tournament’s roster, in the tournament’s org',
  game_change_notices: 'a tournament game’s notices, in the tournament’s org',
  import_batches: 'the tournament admin’s registration imports',
  rep_team_tournament_registrations: 'links a registration in the coach org’s OWN tournament to the team; both must share an org, and the tournament stays',
  // ── House league — a Coaches Portal runs none ───────────────────────────────────────────────
  league_seasons: 'house league (a Coaches Portal runs none)',
  league_games: 'house league',
  league_practices: 'house league',
  league_registrations: 'house league',
  league_email_log: 'house league',
  // ── Org-level setup a Coaches Portal does not use ────────────────────────────────────────────
  org_budget_lines: 'the club-side org budget (a Coaches Portal has none); moved rows that pointed at one are cleared',
  org_venues: 'the org venue library; a Coaches Portal keeps its places in rep_team_places, which moves',
  org_venue_facilities: 'the org venue library',
  rep_team_groups: 'the org’s own groups; the club files the team under its groups (the team’s group is cleared)',
};

function snapshotOrgTables(): Set<string> {
  const out = new Set<string>();
  for (const rel of SNAPSHOTS) {
    const rows = JSON.parse(readFileSync(path.join(REPO, rel), 'utf8')) as Array<{ table_name: string; column_name: string }>;
    for (const r of rows) if (r.column_name === 'org_id') out.add(r.table_name);
  }
  return out;
}

function snapshotColumns(): Map<string, Set<string>> {
  const out = new Map<string, Set<string>>();
  const rows = JSON.parse(readFileSync(path.join(REPO, SNAPSHOTS[0]), 'utf8')) as Array<{ table_name: string; column_name: string }>;
  for (const r of rows) {
    if (!out.has(r.table_name)) out.set(r.table_name, new Set());
    out.get(r.table_name)!.add(r.column_name);
  }
  return out;
}

/** The newest migration that (re)defines the move — the one the database runs. */
function latestMoveMigration(): { file: string; sql: string } {
  const files = readdirSync(path.join(REPO, MIGRATIONS)).filter(f => f.endsWith('.sql')).sort();
  let found: { file: string; sql: string } | null = null;
  for (const file of files) {
    const raw = readFileSync(path.join(REPO, MIGRATIONS, file), 'utf8').replace(/\r\n/g, '\n');
    if (new RegExp(`create\\s+or\\s+replace\\s+function\\s+public\\.${FUNCTION_NAME}\\s*\\(`, 'i').test(raw)) {
      found = { file, sql: raw };
    }
  }
  if (!found) throw new Error(`No migration defines public.${FUNCTION_NAME} — the move is gone, so the gate cannot read it.`);
  return found;
}

/** SQL with `--` comments removed, so a table named only in a comment never counts as moved. */
function stripSqlComments(sql: string): string {
  return sql.split('\n').map(line => line.replace(/--.*$/, '')).join('\n');
}

function arrayConstant(code: string, name: string): string[] {
  const m = code.match(new RegExp(`${name}\\s+constant\\s+text\\[\\]\\s*:=\\s*array\\[([\\s\\S]*?)\\];`, 'i'));
  if (!m) throw new Error(`The move function lost its ${name} array — the gate reads it.`);
  return [...m[1].matchAll(/'([a-z0-9_]+)'/g)].map(x => x[1]);
}

const migration = latestMoveMigration();
const code = stripSqlComments(migration.sql);
const MOVES = arrayConstant(code, 'c_moves');
const MOVES_SOME = arrayConstant(code, 'c_moves_some');
const LIBRARY = arrayConstant(code, 'c_team_library');

describe(`the team move carries every table that carries org_id (${migration.file})`, () => {
  it('every org_id table in the schema snapshot is moved, partly moved, or stays for a written reason', () => {
    const classified = new Set([...MOVES, ...MOVES_SOME, ...Object.keys(STAYS)]);
    const missing = [...snapshotOrgTables()].filter(t => !classified.has(t)).sort();
    assert.deepEqual(
      missing,
      [],
      `These tables carry org_id and the team move does not say what happens to them: ${missing.join(', ')}.\n` +
      'Decide for each: is it the TEAM\'s data (add it to c_moves or c_moves_some in a new migration that ' +
      're-creates move_team_into_club) or the coach org\'s own (add it to STAYS in this file, with the reason)?',
    );
  });

  it('no table is in two lists', () => {
    const seen = new Map<string, string>();
    const clash: string[] = [];
    for (const [list, tables] of [['c_moves', MOVES], ['c_moves_some', MOVES_SOME], ['STAYS', Object.keys(STAYS)]] as const) {
      for (const t of tables) {
        if (seen.has(t)) clash.push(`${t} (${seen.get(t)} and ${list})`);
        else seen.set(t, list);
      }
    }
    assert.deepEqual(clash, [], `Each table has one answer: ${clash.join('; ')}`);
  });

  it('every listed table still exists and still carries org_id (no typo, no dropped table)', () => {
    const orgTables = snapshotOrgTables();
    const stale = [...MOVES, ...MOVES_SOME, ...Object.keys(STAYS)].filter(t => !orgTables.has(t)).sort();
    assert.deepEqual(stale, [], `Listed, but not an org_id table in the snapshot: ${stale.join(', ')}`);
  });

  it('every STAYS entry carries a reason', () => {
    const bare = Object.entries(STAYS).filter(([, why]) => why.trim().length < 8).map(([t]) => t);
    assert.deepEqual(bare, [], `A stay needs its reason: ${bare.join(', ')}`);
  });

  it('the staff memberships — the access truth since mig 245 — move (067 left them behind)', () => {
    assert.ok(MOVES.includes('rep_team_staff_memberships'));
    assert.ok(MOVES.includes('rep_teams'));
  });

  it('each partly-moved table has its own statement in the function', () => {
    for (const t of MOVES_SOME) {
      assert.match(code, new RegExp(`update\\s+public\\.${t}\\b`, 'i'), `${t} is in c_moves_some but nothing moves it`);
    }
  });

  it('library rows the coach org held as "the org’s own" become the team’s, and every one of those tables moves', () => {
    const cols = snapshotColumns();
    for (const t of LIBRARY) {
      assert.ok(MOVES.includes(t), `${t} is re-owned to the team but never moved`);
      assert.ok(cols.get(t)?.has('team_id'), `${t} has no team_id to re-own`);
    }
    assert.match(code, /foreach v_table in array c_team_library loop\s*begin\s*execute format\('update public\.%I set team_id = \$1 where org_id = \$2 and team_id is null'/i);
    // A name clash refuses in words, naming the table — never a raw unique violation (/review 2026-09-29).
    assert.match(code, /exception when unique_violation then\s*raise exception 'team_move_library_name_clash: %', v_table;/i);
  });

  it('every row of the moved tables is moved by the org, in one loop', () => {
    assert.match(code, /foreach v_table in array c_moves loop\s*execute format\('update public\.%I set org_id = \$1 where org_id = \$2'/i);
  });
});

describe('the move keeps the safety the operator step gave, in the database', () => {
  it('"every row the coach org holds is the team’s" is guarded: a coach org with another team refuses', () => {
    assert.match(code, /select count\(\*\) from public\.rep_teams where org_id = v_ws\.id\) <> 1 then\s*raise exception 'team_move_workspace_holds_other_teams'/i);
  });

  it('an open tournament of the coach’s own refuses the move', () => {
    assert.match(code, /from public\.tournaments where org_id = v_ws\.id and status in \('draft', 'active'\)\) then\s*raise exception 'team_move_open_tournament'/i);
  });

  it('the team place is counted under the club’s row lock', () => {
    const lockAt = code.search(/select \* into v_club from public\.organizations where id = v_link\.linked_org_id for update/i);
    const countAt = code.search(/raise exception 'team_move_team_limit'/i);
    assert.ok(lockAt > 0 && countAt > lockAt, 'the cap check must come after the club is locked');
  });

  it('idempotent: a link already moved answers alreadyMoved, never a second move', () => {
    assert.match(code, /if v_link\.status = 'org_owned' then\s*return jsonb_build_object\(\s*'ok', true, 'alreadyMoved', true/i);
  });

  it('this side’s yes is recorded inside the move, and only when the OTHER side already said yes', () => {
    assert.match(code, /p_approving_side = 'club'\s*and \(v_link\.approved_by_team_user_id is null or v_link\.approved_by_org_user_id is not null\)/i);
    assert.match(code, /p_approving_side = 'coach'\s*and \(v_link\.approved_by_org_user_id is null or v_link\.approved_by_team_user_id is not null\)/i);
    assert.match(code, /update public\.team_org_links set approved_by_org_user_id = p_actor_user_id/i);
  });

  it('an existing real role in the club is never reinstated (067 set every conflicting row to active)', () => {
    assert.match(code, /when public\.organization_members\.role = 'coach' and public\.organization_members\.status <> 'suspended'\s*then 'active'\s*else public\.organization_members\.status/i);
  });

  it('the Stripe ids are cleared in the move, before the app cancels (so the webhook sends no "cancelled" email)', () => {
    assert.match(code, /stripe_customer_id = null, stripe_subscription_id = null,\s*subscription_status = 'active'/i);
  });

  it('guardians re-attach to the club’s people; nothing keeps pointing into the coach’s org', () => {
    for (const t of ['rep_roster_players', 'rep_tryout_registrations', 'family_links']) {
      assert.match(code, new RegExp(`update public\\.${t} set person_id = null where org_id = v_ws\\.id`, 'i'), t);
    }
    assert.match(code, /perform public\.families_attach_people\(v_club\.id\)/i);
  });

  it('one open request per team, held by the database (two clubs asking at once cannot both open one)', () => {
    assert.match(code, /create unique index if not exists team_org_links_one_open_request\s+on public\.team_org_links \(team_workspace_id\)\s+where status = 'ownership_pending'/i);
  });

  it('the coach’s subscription id is written durably in the move (the app cancels only after commit)', () => {
    assert.match(code, /'previousStripeSubscriptionId', coalesce\(v_workspace\.stripe_subscription_id, v_ws\.stripe_subscription_id\)\s*\)\);/i);
  });

  it('067’s partial move is dropped, and the new one is the service role’s alone', () => {
    assert.match(code, /drop function if exists public\.complete_team_workspace_ownership_transfer\(uuid, uuid, text, text\)/i);
    assert.match(code, /revoke all on function public\.move_team_into_club\(uuid, text, uuid, text, integer\) from public, anon, authenticated/i);
    assert.match(code, /grant execute on function public\.move_team_into_club\(uuid, text, uuid, text, integer\) to service_role/i);
  });
});
