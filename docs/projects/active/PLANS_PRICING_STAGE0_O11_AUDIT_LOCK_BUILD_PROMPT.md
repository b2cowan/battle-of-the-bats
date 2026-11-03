# Plans & pricing · Stage 0 · O11: the change log cannot be edited or deleted (build prompt)

**Written 2026-11-03.** One short build session, one migration. The owner ruled O11 **yes** on 2026-11-02, agreeing with the
recommendation (build prompt `PLANS_PRICING_STAGE0_BUILD_PROMPT.md`, Owner checklist O11; Part 9's note explains why the
full lock was not built). **When it ships is not ruled**: build it, then commit when the owner says.

## ▶ Progress (fill in as it lands)

- **Built 2026-11-03.** Migration **429** (`429_the_change_log_cannot_be_edited.sql`) applied to DEV 2026-11-03. Proof
  `scripts/platform-audit-log-lock-check.sql` passed (PLATFORM_AUDIT_LOG_LOCK_PASSED; T1–T8 as below, plus T2f a no-change
  update is refused, T6b a club-less line cannot be given a club, T9 the documented lift works and the lock comes back).
  Real use (dev, service-role Data API, `.probe/o11-lock-real-use.mjs`): an update and a delete are refused with the lock's
  message; deleting a throwaway club keeps its line with `org_id` NULL and every other column unchanged.
  `seed-plan-ending-walk.mjs --reset` was deliberately NOT run: it deletes the four clubs of the owed walk §444 and stops their
  Stripe subscriptions.
- Guard `tests/unit/platform-audit-log-lock.test.ts` (10 tests) passes; it also fails the build on a later migration that
  edits lines without disabling and re-enabling the trigger (an addition, cheap).
- `/review` 2026-11-03 (high-risk tier, 3 lenses: correctness, regression, data/contract): no Critical/High/Medium defect in
  the migration or the proof; every club-delete path stays inside the exception. Applied from it: the guard now also scans
  components/, refuses the table name held in a constant (so the scan always sees the call), and strips block comments from
  later migrations. Accepted limit: a query builder kept in a variable and written to later is not seen by the text scan;
  the trigger refuses it at run time on dev too. Prod not read by the review (classifier refused a prod read).
- `MANUAL_PROD_STEPS.json` entry added (`pending`). `DATA_DICTIONARY.md`: ⚠ the prompt was wrong that the table had no
  section (it had one, line ~8990); gotcha 6 (the lock) and `id` / `created_at` anchors were added to it, and the baseline's
  acknowledged columns for the table removed (the baseline is not a watched path). `check:dictionary` and
  `check:manual-migrations` pass. `verify:changed` stops at 9 failing tests, all in other sessions' uncommitted work.
- ⚖ TRUNCATE is refused too (read as inside "refuse deletes"); drop `platform_audit_log_no_truncate` if the owner disagrees.
- Committed `aef88a5e4` 2026-11-03 (owner: "review then commit").

## The ruling, exactly

> Refuse every edit except the blanking (a deleted club's lines lose the club), and refuse deletes. A future privacy
> erasure would then need the lock lifted on purpose.

Nothing else. No new screen, no change to who can read the log, no change to what is written.

## What the owner sees after this build (present as the PM summary BEFORE any code; AGENCY_RULES, blocking)

Nothing on any screen. What changes is a promise: **a line in the platform audit log, once written, stays exactly as it was
written.** Nobody (no staff member, no bug in our code, no one holding the service key) can rewrite a reason, change who
made a change, or remove a line. The one thing that still happens by itself: when a club is deleted, its old lines stay
but no longer point at the club (as today). If the owner ever needs to erase personal details from old lines (as the
October lead-privacy fix did), that is a deliberate step: a migration that lifts the lock, makes the change, and puts the
lock back, which is itself recorded in the repository.

Why it matters: Stage 0 made the log the record for every money action (Part 9: written first, or the change is not
made). A record that can be quietly edited is worth less than one that cannot, and later stages (refunds, invoices,
price moves) lean on it.

## What the code does today (verified 2026-11-03; re-check each line before building)

- **Table `public.platform_audit_log`** (mig 018; `reason` added by mig 380). Columns: `id`, `actor_email` (text, no
  link to a user), `org_id` (nullable), `action`, `field`, `old_value`, `new_value`, `created_at`, `reason`.
- **One foreign key:** `platform_audit_log_org_id_fkey`, `org_id → organizations(id) ON DELETE SET NULL` (dev live
  `pg_constraint`: `confdeltype = 'n'`). No other table references this one. No actor foreign key, so deleting a staff
  or sign-in user never touches the log.
- **Who writes it:** insert only (`lib/platform-audit.ts`, `lib/billing-retention.ts`, `scripts/lib/demo-world-fingerprint.mjs`,
  `scripts/set-team-plan-gating.mjs`). Every other use is a read. **No code path updates or deletes a line** (grep of
  app/, lib/, scripts/, tests/ for `.update(` / `.delete(` / `.upsert(` on the table: none).
- **The one automatic update:** deleting an organization (`app/api/platform-admin/orgs/[id]/delete/route.ts`, hard
  delete; also the create-flow rollbacks in `app/api/org/create/route.ts` and `app/api/league/create/route.ts`, and many
  dev/UAT seed scripts and smoke specs) sets `org_id` to NULL on that club's lines. That is the exception the ruling keeps.
- **Past rewrites, both already applied, both one-off migrations:** mig 380 (backfilled `reason` from `new_value`) and
  mig 405 (removed personal details from old lead lines; rewrote `old_value` / `new_value`). These are the kind of change
  the lock will refuse from now on unless it is lifted on purpose.
- **Today's protection:** RLS on with no policies (so only the service role reads or writes); no triggers. Grants on dev:
  `service_role` and `postgres` hold everything incl. UPDATE, DELETE, TRUNCATE; `anon` and `authenticated` hold
  REFERENCES, TRIGGER and **TRUNCATE** (Supabase defaults; not reachable through the API, but a gap a lock should close).
- **Next free migration number: 429** on 2026-11-03 (428 is the newest file; 427 and 428 are another session's,
  uncommitted). Re-check `ls supabase/migrations` at the moment you create the file; another session may take 429.

## Build

### 1. The migration: `supabase/migrations/4NN_the_change_log_cannot_be_edited.sql`

Filename in the house style (plain words, customer voice). Contents:

- A trigger function `platform_audit_log_refuse_change()`, `LANGUAGE plpgsql`, `SET search_path = public`:
  - **UPDATE:** allow only when `NEW.org_id IS NULL AND OLD.org_id IS NOT NULL` and every other column is unchanged,
    tested as `(to_jsonb(NEW) - 'org_id') = (to_jsonb(OLD) - 'org_id')`. Anything else raises
    `'The platform audit log cannot be edited. A line, once written, stays as written.'` with a distinct `ERRCODE`
    (pick one, e.g. `'P0001'` with a `HINT` naming this migration, so the proof script can tell the refusal apart from
    any other error).
  - **DELETE:** always raise (`'… cannot be deleted …'`).
  - A `BEFORE UPDATE OR DELETE … FOR EACH ROW` trigger, `platform_audit_log_append_only`.
- **TRUNCATE:** a `BEFORE TRUNCATE … FOR EACH STATEMENT` trigger on the same function (row triggers do not fire on
  TRUNCATE), and `REVOKE TRUNCATE ON public.platform_audit_log FROM anon, authenticated;`. ⚖ **Report this as an
  addition:** the ruling says "refuse deletes"; TRUNCATE is a delete of every line, so it is read as inside the ruling,
  not beyond it. If the owner disagrees, drop the statement trigger; the REVOKE is harmless either way.
- `REVOKE ALL ON FUNCTION platform_audit_log_refuse_change() FROM PUBLIC, anon, authenticated;` (the trigger needs no
  caller grant).
- **Do not** revoke UPDATE/DELETE from `service_role`. The refusal lives in ONE place, the trigger, so a future erasure
  lifts one thing and nothing else changes.
- A header comment, in the house style, saying: what it refuses and the one exception; that the trigger is **invisible
  to the drift check** (like mig 417's), so its `MANUAL_PROD_STEPS.json` entry is the only promote gate; and **how to lift
  it on purpose**: a later migration runs `ALTER TABLE public.platform_audit_log DISABLE TRIGGER platform_audit_log_append_only;`,
  makes its change, then `ENABLE TRIGGER …` in the same transaction. ⚠ Triggers fire for the table owner and the
  `postgres` role too (only `session_replication_role = replica` skips them), so a migration that forgets this fails
  loudly. That is the point.
- Prior art to copy the shape from: mig 417 (`417_a_replaced_price_stays_recognised.sql`: its header, its trigger function's
  `SET search_path = public`, its function revokes; this lock needs no `SECURITY DEFINER`, since it only refuses) and mig 354's refusing trigger (`proprietor_expense_immutable()`, since
  dropped by mig 356: pattern only).

### 2. The proof: `scripts/platform-audit-log-lock-check.sql`

Same pattern as `scripts/stripe-price-retired-check.sql`: a DEV-only `DO $pal$ … $pal$` block that ends with
`RAISE EXCEPTION 'PLATFORM_AUDIT_LOG_LOCK_PASSED';` so everything rolls back, and `FAIL Tn:` on any broken assertion.
Run: `node scripts/db-query.mjs --dev -f scripts/platform-audit-log-lock-check.sql`; it passes only when the marker comes
back. Assertions:
- T1 an INSERT still works.
- T2 an UPDATE of `reason` (or `new_value`, `actor_email`, `action`, `created_at`) on that line is refused with the lock's error.
- T3 a DELETE of that line is refused.
- T4 **the exception:** insert a throwaway organization, a line pointing at it, delete the organization: the line
  survives with `org_id` NULL and every other column unchanged.
- T5 an UPDATE that sets `org_id` to NULL **and** changes another column is refused.
- T6 an UPDATE that changes `org_id` to a different club (not NULL) is refused.
- T7 TRUNCATE is refused (if the statement trigger is kept).
- T8 `has_table_privilege('anon', 'public.platform_audit_log', 'TRUNCATE')` and the same for `authenticated` are false.
⚠ T4 must create its own throwaway organization with only the columns `organizations` requires (read the NOT NULL list
from `docs/agents/db/schema-snapshots/schema-dump-columns-dev.json`); never point the proof at a real club.

### 3. A guard test: `tests/unit/platform-audit-log-lock.test.ts`

Small, text-level, like the other migration guards:
- The migration file exists and creates the row trigger and the function named above, with the exception written as
  "only `org_id`, only to NULL".
- **No code writes an UPDATE or DELETE of the table** (scan app/, lib/, scripts/ for `.from('platform_audit_log')`
  followed by `.update(` / `.delete(` / `.upsert(`), so a future writer fails the build instead of failing in production.

### 4. Unit of work (AGENCY_RULES: schema = dictionary, same unit of work)

- Apply to **DEV only** with `node scripts/apply-migration-api.mjs supabase/migrations/4NN_….sql`; run the proof; run
  the org-delete paths' tests and one dev seed script that deletes an organization (e.g. `scripts/seed-plan-ending-walk.mjs
  --reset` if it has one; read its usage first) to show the exception holds in real use.
- `MANUAL_PROD_STEPS.json`: a new entry, `"prod": "pending"`, note = what it does, that it is invisible to the drift
  check, that it can go to production before or after the promote (no code depends on it), and the verify query
  `SELECT count(*) FROM pg_trigger WHERE tgname = 'platform_audit_log_append_only'` → 1. Copy the shape of 417's entry.
- `docs/agents/db/DATA_DICTIONARY.md`: the table has **no section** today (grandfathered in
  `scripts/.dictionary-coverage-baseline.json`, which lists `id` and `created_at` as missing). Add a short section for
  `platform_audit_log` (what it is, each column, the append-only rule and its one exception, how to lift it) and remove
  its baseline entries. ⚠ `scripts/.dictionary-coverage-baseline.json` is read by a database check: confirm with
  `npm run check:automation` that it is not a watched path before editing it; if it is, add the section and leave the
  baseline for the owner's go.
- `npm run refresh:snapshots` (a trigger is invisible to it, but keep the snapshots fresh), `npm run check:dictionary`,
  `npm run check:manual-migrations`, `npm run verify:changed`.
- Watched paths: the migration, the proof SQL and the MANUAL_PROD_STEPS entry are **not** in `WATCHED_PATHS`
  (`scripts/check-agent-automation.mjs`); the owner's O11 yes covers the lock. Do not edit any `scripts/check-*.mjs`.

### 5. Hand-off

- Tick O11 in `PLANS_PRICING_STAGE0_BUILD_PROMPT.md` with the anchor (migration number, dev-applied date, commit once
  committed), update this file's Progress, the TODO line, and the plan's Stage 0 line. Positive facts with anchors only.
- Offer `/review` (a migration on a shared table). No `/simplify` (no new abstraction), no `/docs` (no customer- or
  staff-visible change), no walk (nothing to see; the proof script is the evidence).
- Release note, one line: "Mig 4NN (the change log cannot be edited) can go to production any time; verify with the
  trigger query."

## Not in this build (stay out)

- Any change to what is written to the log, who can read it, or the audit screen.
- A full lock with no exception (would break every club delete).
- Locking `platform_events`, `stripe_billing_events` or any other log (their own question, not ruled).
- Retention or a purge of old lines (none exists; not ruled).

## Shared-file traps

- `MANUAL_PROD_STEPS.json`, `TODO.md`, `OWNER_QA_LEDGER.md` and `DATA_DICTIONARY.md` carry other sessions' uncommitted
  edits: stage only your own hunks (the memory note "Partial commit out of shared files": temp index, exact edits).
- Explicit pathspecs only, on `dev`; `git show --stat HEAD` after the commit.
- The dev server needs a restart after a migration only if code changed; this build changes no code.
