# DB snapshot refresh — stop our tooling from pinning the database CPU

**Status (2026-09-25):** Step 1 DONE on dev (the hook is removed from `.claude/settings.json`; the
change is not yet committed). Steps 2 and 3 are PLANNED, waiting on the owner's go and on ruling D1 below.
PM brief: [DB_SNAPSHOT_REFRESH_LOAD_PM_BRIEF.md](DB_SNAPSHOT_REFRESH_LOAD_PM_BRIEF.md).

## 1. What happened (evidence, 2026-09-25 investigation)

Dev's Supabase compute chart (Micro: 2 shared cores, 1 GB) peaked at 97–100% CPU on Sep 21–22.
The cause was not the product:

- The project `PostToolUse` hook ran `node scripts/refresh-db-snapshots.mjs` behind
  `"if": "Bash(*apply-migration-api*)"`. **The `if` gate fails open:** any successful Bash call that
  contains a `for`/`while` loop fires it, and so does any command that merely *mentions* the string.
  Proven in-session: `for i in 1; do echo x; done` fired a full refresh and `echo x` did not
  (extension 2.1.280). After the hook was removed, the same loop no longer fired, so open sessions
  reload project settings live.
- Each refresh runs `SQL.constraints`, an `information_schema` join through
  `constraint_column_usage`. It takes **12–20 s** (worst logged 31 s) and occupies one full core on
  **dev and prod both**. On dev, `refresh-db-schema.mjs` adds a second one of 10–13 s. Refreshes from
  concurrent sessions overlap.
- Transcript count of hook firings across all sessions: Sep 19 6 · Sep 20 96 · Sep 18 263 ·
  Sep 24 287 · **Sep 21 582 · Sep 22 457** · Sep 25 419 by 17:30 UTC. That tracks the CPU peaks
  day by day. Dev's postgres log (auto_explain above 10 s) shows 589 of these statements on Sep 21,
  totalling 18,625 s.
- **Prod carried the same load:** 589 slow statements on Sep 21 (10,444 s) and 460 on Sep 22. Since
  April, the snapshot query family is **about 90% of all prod `pg_stat_statements` execution time**
  (the constraints query alone is 88%: 10,221 calls at a 14.9 s mean).
- App traffic also rose (dev REST about 20k/day → 343k–362k/day, nearly all from the local dev server
  and sweeps), but each request costs about 40 ms. It adds load; it did not cause the pinning. See §6.

How to re-measure: daily request counts from `v1/projects/{ref}/analytics/endpoints/usage.api-counts`;
logs from `v1/projects/{ref}/analytics/endpoints/logs` (ClickHouse SQL, one `logs` table, the
`source` column, fields in `log_attributes['…']`); slow statements are the `postgres_logs` rows
whose message starts `duration:`.

## 2. Step 1 — remove the hook (DONE 2026-09-25)

The `hooks` block is deleted from `.claude/settings.json`. Nothing relied on it being automatic:
`apply-migration-api.mjs` already prints "Next: node scripts/refresh-db-snapshots.mjs", and
`check-snapshot-freshness.mjs` (in `verify:changed`) fails when a migration lands without a refresh.
Morning-after check: dev's `pg_stat_statements` `calls` for the `rc.delete_rule` query stopped rising
(baseline 71 at 17:48 UTC). The next day's `duration:` count in `postgres_logs` should be close to 0
on both projects.

## 3. Step 2 — a hook that cannot misfire

**Goal:** keep the convenience (the snapshots refresh by themselves after a migration) without
trusting `if`.

- **New `scripts/hooks/after-migration-refresh.mjs`**, registered as a `PostToolUse` / `Bash` hook.
  Keep `if` as a cheap pre-filter, but the script does the real gating. It reads the hook payload from
  stdin and exports a pure `shouldRefresh(payload)` that requires BOTH:
  1. `tool_input.command` **invokes** the script: a `node … scripts/apply-migration-api.mjs`
     call anywhere in the command, including inside a loop. A mention in a `grep` or `git log -S` does
     not count.
  2. The tool's stdout contains the rendered success line
     `✅ Migration applied successfully to (dev|prod).` The source line holds `${target}`, so a
     grep of the source cannot satisfy this.
  **Build-first sub-step:** capture one real `PostToolUse` Bash payload to confirm where stdout lives
  (`tool_response.stdout` is expected). Do not assume the shape.
- **Single flight, one pending:** a lock file in the OS temp dir, keyed by the repo path. If a refresh
  is running, set a "pending" flag and exit. The running refresh re-runs once at the end if the flag
  is set. It never skips outright, because a refresh that started before a migration landed does not
  capture it. The lock is stale after 5 minutes (the hook timeout is 180 s).
- **Never blocks the agent:** the script always exits 0 and prints a one-line result, e.g.
  "snapshots refreshed" / "already running — queued one more" / "refresh failed: … run it by hand".
  The freshness gate is the safety net.
- **Unit test** (`tests/unit/after-migration-refresh-gate.test.ts`) with payload fixtures:
  a loop that only echoes → no; a grep that mentions the script → no; `git log -S` → no; a real apply
  (dev) → yes; a real apply (prod) → yes; a failed apply ("❌ Migration failed") → no; a loop applying
  two migrations → yes.
- **Live proof:** apply a no-op migration to dev (or re-run the latest idempotent one) and see exactly
  one refresh. Then run a loop and a grep and see none.

## 4. Step 3 — make the schema queries cheap

**Goal:** a refresh costs well under a second of database time per project instead of 12–20 s, so
even a runaway trigger is harmless.

- Replace `SQL.constraints` in `refresh-db-snapshots.mjs` with a `pg_catalog` query: `pg_constraint`
  (`contype` p/u/f in the `public` namespace) × `unnest(conkey) WITH ORDINALITY` → `pg_attribute`; for
  FKs, `confrelid`/`confkey` → the referenced table/column; `confdeltype`/`confupdtype` mapped to
  `NO ACTION`/`RESTRICT`/`CASCADE`/`SET NULL`/`SET DEFAULT`. **Export it**, and have
  `refresh-db-schema.mjs` import it instead of running its own `information_schema` FK query. The
  import is safe thanks to the `isEntrypoint` guard. One definition, one cost.
- **Reproduce deliberately** (it is in the file header as by-design): an FK whose target is outside
  `public` (the 92 FKs to `auth.users`, on both envs) keeps `foreign_table: null, foreign_column: null`.
- **Ruling needed: D1 — the 16 composite FKs.** They are the team-scoped `(player_id, team_id)`
  families on `rep_player_*`, `rep_evaluation_not_assessed` and `rep_development_goal_reviews`.
  The `information_schema` join matches them on name only, so each emits **N×N rows** and half the
  pairings are false. Today's snapshot records `rep_player_notes.player_id → rep_roster_players.team_id`.
  - **(a) Recommended: correct it once.** Pair by ordinal (N rows, each true), in one deliberate
    snapshot diff. The diff is identical on both envs, so drift and parity are unaffected: they key on
    `table.constraint_name` only. The two guard tests that read the snapshot (budget-item references,
    roster status CHECK) do not touch these FKs. `reference_db_schema.md` also becomes deterministic;
    today it keeps whichever crossed pairing arrives last.
  - (b) Reproduce the cross-product byte-for-byte. This means emulating an undefined tie order, and it
    keeps a false statement in the record every agent reads.
- **Ordering:** `table_name, constraint_name, ordinal_position`, plus the referenced ordinal as a tie
  break, so the output is deterministic. The `rls`/CHECK query (~30 ms) and the `columns` query
  (~130 ms) are not the problem and stay as they are.
- **Verification (the unit of work is not done without it):**
  1. Run the old and new queries against dev AND prod and diff the shaped JSON. Expected diff: exactly
     the off-diagonal rows of the 16 composite FKs (under D1a), and nothing else. Any other difference
     stops the change.
  2. Time both: the target is under 1 s per project.
  3. Full `npm run refresh:snapshots`; the `git diff` of the snapshot files matches (1).
  4. `check:parity`, `check:dictionary`, `check:indexes`, `check:snapshots` and `npm test` are green.

## 5. Considered and not doing

- **Upgrading dev compute.** Small adds memory, not cores (still 2 shared); it would not have
  prevented this.
- **A tighter `if` pattern.** The failure is in how `if` treats commands it cannot parse, not in the
  pattern.
- **A time-based debounce only.** It would skip a refresh that is genuinely needed after a second
  migration.

## 6. Follow-ups (separate, lower priority)

- Dev request volume from local runs: roughly 530 requests an hour overnight (03:00–06:00 UTC) points
  at an open tab polling unread chat and notification counts; unread-chat `HEAD` counts were 24.5k/day
  on Sep 22.
- The Realtime error `invalid column for filter user_id` (3,864/day on dev, 09-22) is unexplained. The
  only `user_id` filter in the code (the notification badge) is valid: `notifications.user_id` is
  published. Find the subscription that raises it.
- The dev database restarted at 17:00:44 UTC on 2026-09-25; the cause is unknown.

## 7. Success criteria

- `duration:` statements in `postgres_logs` fall from about 500/day to about 0 on both projects,
  outside deliberate refreshes.
- A full refresh finishes in under 10 s end to end (it takes about 45 s today).
- The hook fires only on a successful migration apply: unit fixtures plus one live proof.
- On the next heavy multi-agent day, dev CPU is no longer pinned by our tooling (compare with the
  Sep 21–22 chart).
