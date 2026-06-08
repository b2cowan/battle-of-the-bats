# Data Dictionary — Implementation Plan

> **Status:** Planning (awaiting owner sign-off — no dictionary content or tooling built yet)
> **Owners:** `/db` (operational queries, field lookups) + `/dba` (architecture, migrations, snapshots)
> **Deliverable:** `docs/agents/db/DATA_DICTIONARY.md` — a living, never-archived agent reference
> **Kickoff:** [DATA_DICTIONARY_KICKOFF.md](DATA_DICTIONARY_KICKOFF.md)
> **PM brief:** [DATA_DICTIONARY_PM_BRIEF.md](DATA_DICTIONARY_PM_BRIEF.md)
> **Created:** 2026-06-08 on branch `feat/free-tier-coaches`

---

## 1. Mission

Build a **semantic** layer on top of the existing structural schema snapshots: for every meaningful
column, capture **what it means, what reads/writes it (file:line), how it relates to other fields, and
its gotchas** — and bake in **binding maintenance rules** so it stays accurate. Organized **by domain**,
**gotchas-first**, never a re-dump of column types (the JSON snapshots own structure; we cross-link).

**Motivating incident (2026-06-08):** `POST /api/register` returned a 500 because deployed code selected
columns that didn't exist in the live DBs (dev/prod schema drift). The original diagnosis reasoned from
migration files — which mislead in a drifted DB. The dictionary exists to (a) record field *meaning* and
(b) codify the rule **"decide column existence from the live snapshots, never from migrations."**

This plan is itself grounded by a verification pass (a 3-agent grounding workflow + direct code reads on
2026-06-08). That pass turned up **real errors in the kickoff's own seed list** — see §7 — which is the
strongest possible proof the project is needed.

---

## 2. The headline finding that reshapes the plan: **tooling-first**

The kickoff implies content-first (start documenting Tournaments & Registration). The grounding pass shows
that is **not safe yet**, because the "authoritative" snapshots are far staler than the kickoff believed:

| Source | Tables | Freshness | Notes |
|---|---|---|---|
| `docs/agents/db/schema-snapshots/schema-dump-columns-{dev,prod}.json` (the 6 split files) | **82 dev / 83 prod** | **oldest** | predate the `age_groups→divisions` rename (divisions absent), the `org_id` rename (tournaments still has `organization_id`), `tournaments.settings`, the contact refactor (088–090), per-game length (112), `teams.seed` (113), the `teams.players` drop (still present here), the roster split (`tournament_roster_players` absent), and all `basic_coach_*` tables |
| `docs/agents/db/schema-snapshots/schema_dumps.json` (combined) | **85 dev** | newer, richer | adds an `rls` block (RLS enabled-state + CHECK clauses); uses key `pos` not `ordinal_position`; still behind live |
| `memory/reference_db_schema.md` | **103** | **freshest (2026-06-08)** | dev-only, markdown-only, no constraint/RLS detail |

**Verified concretely:** `tournaments.public_hidden_pages` is present in the 2026-06-08 memory doc but in
**none** of the JSON snapshots — they predate migration 040. The kickoff's "snapshots only lag migration
040" disclaimer is itself wrong: they lag *dozens* of changes.

**Consequence:** if we documented Tournaments & Registration today, "verify against the snapshot" would
yield *stale-snapshot* for nearly every modern field, and we'd burn ~10 min/field on dead lookups. So:

> **Phase 0 (regenerate the snapshots + build the refresh tooling) is a hard prerequisite for Phase 1.**

The tooling is also a named kickoff deliverable ("a repeatable dev+prod snapshot-refresh command"), so this
is not scope creep — it's reordering it to the front where it unblocks everything else.

---

## 3. The two source-of-truth realities we must honor (maintenance rules)

These go **verbatim into the `DATA_DICTIONARY.md` header** and are binding:

1. **Authoritative source for "does column X exist":** the dev/prod snapshots in
   `docs/agents/db/schema-snapshots/` or a live `information_schema` query — **never** the migration
   folder. Migrations describe intent over time and actively mislead in a drifted DB. *(Corollary: a
   snapshot is only authoritative if it's fresh — see rule 3. When in doubt, hit live `information_schema`.)*
2. **Schema change ⇒ dictionary change in the same unit of work.** Adding/renaming/dropping a column, or
   changing a field's *meaning*, requires updating `DATA_DICTIONARY.md` alongside the code/migration.
3. **Snapshots refreshed after every migration — dev AND prod** — via the single command established in
   Phase 0. Run it after applying any migration to either environment.
4. **Drift watch.** Dev and prod can and do diverge. The Phase-0 command emits a dev-vs-prod structural
   diff; the dictionary notes any field where dev ≠ prod.
5. **Ownership:** `/db` (field lookups) + `/dba` (architecture, migrations, snapshots) keep it current;
   `DB_ARCHITECTURE_REVIEW.md` cross-references it (design-level findings ↔ field-level meaning).
6. **Code is branch-relative; schema is not.** A column exists in the *database*; the code that reads it
   can differ by branch. When documenting `file:line` read/write paths, name the branch if the behavior is
   branch-dependent (see the `resolveGameTiming` finding in §7). Prefer documenting against the code that
   is/will-be on the deploy branch (`master`/`dev`), and flag divergences.

---

## 4. Deliverable shape

`docs/agents/db/DATA_DICTIONARY.md`, structured as:

1. **Header** — the 6 maintenance rules above + a pointer to the snapshots (structure) and to
   `DB_ARCHITECTURE_REVIEW.md` (design) so readers know what this doc does and does *not* own.
2. **One section per domain** (see §6), each opening with a **Gotchas-first** block (the traps an
   implementer would otherwise learn the hard way), then per-field entries.
3. **Per-field entry template** (semantics only — no type re-dump):

   ```
   ### <table>.<column>
   - **Purpose:** what it means / what it's for
   - **Reads/writes:** file:line (the code that actually consumes/sets it)
   - **Relationships:** FKs, sibling fields, JSONB-key catalogs, identity keys
   - **Gotchas:** legacy-vs-current, dual-purpose, naming smells, dev/prod drift, type-vs-table mismatches
   - **Dev/prod:** identical | drift: <how they differ>
   (type/constraints: → link to schema-snapshots, never restated here)
   ```

   JSONB columns get a **key catalog** sub-table (key → meaning → code ref), since the snapshots can't see
   inside the blob.

---

## 5. Phasing

### Phase 0 — Snapshot refresh tooling + regenerate (PREREQUISITE) ✅ unblocks everything

Build `scripts/refresh-db-snapshots.mjs` (design fully scoped by the grounding pass; ~250–350 lines,
~2–4 h, ~70% reuses `scripts/refresh-db-schema.mjs`):

- **One token covers both projects.** `SUPABASE_ACCESS_TOKEN` (in `.env.local`) is an account-scoped
  Management API PAT; dev (`npgnrxaitgbtbtvvykto`) and prod (`qcttcboqysynwcdyghil`) are selected purely by
  the `{ref}` in `/v1/projects/{ref}/database/query`. `.env.production.local` does **not** contain a PAT
  (only Stripe + service-role key); no extra creds are needed. *(Verify this still holds at build time.)*
- Run 5 read-only `information_schema`/`pg_catalog` queries × 2 envs (columns, FKs, all-constraints
  PK+UNIQUE+FK, indexes, RLS+CHECK) — **zero business-data rows**.
- Re-emit all existing artifacts in their **current shapes** (the 6 split files + `schema_dumps.json`) and
  refresh `memory/reference_db_schema.md` (+ the Claude-memory copy). Keep byte-shape stable to avoid
  diff noise.
- Emit a new `docs/agents/db/schema-snapshots/DRIFT_dev_vs_prod.md` structural diff (tables / columns /
  indexes / constraints / RLS), with a non-zero exit under `--fail-on-drift` for a post-migration gate.
- **Run it once** to regenerate dev+prod to live state; confirm `public_hidden_pages` (and the other 23
  missing tables/columns) now appear; commit the refreshed snapshots.
- **Run `/dba` to review** the new script before it merges (per the trigger checklist).

**Open decision (needs sign-off):** the two representations disagree (split files = 82 tables /
`ordinal_position`; `schema_dumps.json` = 85 tables / `pos` / +`rls`). Recommend: make **`schema_dumps.json`
canonical** (richest), regenerate the 6 split files from the same result set for backward-compat. Alternative:
deprecate the split files. (`fk_constraints_prod.json` is an ad-hoc legacy-FK artifact — exclude from the
routine command.)

**DoD:** one command refreshes dev+prod JSON + memory markdown + drift report; snapshots reflect ~103
tables; `/dba`-reviewed; drift report generated and any dev≠prod noted.

### Phase 1 — Tournaments & Registration domain (first content domain)

Document every non-obvious field, **verified against the freshly-regenerated snapshots + code (file:line)**.
Lead with the Gotchas block. Seed items (each already partly verified in §7) include: `public_hidden_pages`
(dual-purpose: public nav **and** registration gate), the contact model, the `tournaments.settings` JSONB
key catalog, the fee model, `teams` as the registration unit, `games.duration_minutes` + the
`resolveGameTiming` branch caveat, and the `basic_coach_*` link tables (cross-referenced from the Coaches
domain). Tables in scope: `tournaments`, `divisions`, `teams`, `games`, `pools`, `pool_slots`, `diamonds`,
`announcements`, `rules`, `rule_items`, `resources`, `tournament_archives`,
`tournament_registration_fields`, `tournament_registration_field_answers`, `tournament_roster_players`
(+ venue/scheduling tables if not split out — see §6).

**DoD (= kickoff Phase-1 definition of done):** domain fully documented, every claim carrying a file:line
ref and snapshot verification, maintenance rules in the header, the Phase-0 command established, and a
dev-vs-prod drift note for any field that differs.

### Phases 2+ — remaining domains (each its own follow-up phase)

Recommended order (value/risk + freshness of context):

| Phase | Domain | ~Tables | Why this order |
|---|---|---|---|
| 2 | **Coaches / basic-teams** | ~5 | active feature area (free-tier coaches), small, fresh context, ties into Phase 1's registration link tables |
| 3 | **Org / Platform core** | ~10 | foundational; every other domain FKs into `organizations`/`organization_members`; documents the `organizations`-has-no-`contact_email` trap |
| 4 | **Rep teams / team workspaces** | ~29 | largest domain (~33%); candidate to split into "Rep operations" vs "Team-workspace plumbing" |
| 5 | **League / house-league** | ~8 | `league_*` module; note historical dev/prod drift (Findings #10, #19) |
| 6 | **Accounting** | ~9 | financial tables; well-normalized per the review |
| 7 | **Stripe / Billing** | ~1 table + many columns | most billing state lives as *columns* on `organizations`/`team_workspaces`, not dedicated tables — the dictionary must document those columns here |
| 8 | **Platform admin** | ~16 | `platform_*`/`plan_*` control plane; possible "Plans & Catalog" sub-domain |
| 9 | **CRM** | ~1–3 | `early_access_leads` (+ `email_*` if not split into Notifications) |
| 10 | **Notifications & Push** *(proposed 10th domain)* | ~8 | `notifications`, `notification_preferences`, `tournament_notification_preferences`, `push_subscriptions`, `fan_push_subscriptions`, `platform_email_templates`, `email_batches`, `email_sends` — currently scattered across Platform admin/CRM |

Phasing is re-confirmed against the **refreshed** snapshot at the start of each phase (table counts above are
indicative; the stale snapshot under-counts).

---

## 6. Domain inventory (from the grounding pass)

The 9 kickoff domains map cleanly — **zero unmapped tables** in the (stale) snapshot. Two structural notes:

- **Add a 10th domain — Notifications & Push** (8 tables today live across Platform admin/CRM). Recommended.
- **Optional split — Venues & Scheduling** (`org_venues`, `org_venue_facilities`, `venue_facilities`,
  `diamonds`, `schedule_facility_lanes`) could be carved out of Tournaments & Registration for finer
  phasing. Decision deferred to Phase 1.
- **Data Import** (`import_batches`, `import_batch_rows`) → fold into Platform admin unless it grows.

Per-domain table lists are captured in the grounding output and will be re-derived from the refreshed
snapshot at Phase 0 close (don't trust the stale counts for final phasing).

---

## 7. Verified seed-list corrections (the grounding pass caught these)

These were checked against the live-fresh memory doc + code (file:line), and the three most surprising were
re-read directly. **They are documentation traps to fix, and they validate the whole project.** Each becomes
an early, prominent dictionary entry:

1. **`resolveGameTiming` signature — seed & memory are WRONG for this branch.** Actual:
   `resolveGameTiming(division, tournament, isPlayoff = false)` at
   [lib/schedule-conflict.ts:41](../../../lib/schedule-conflict.ts#L41-L46). The 3rd arg is a **boolean
   `isPlayoff`**, not a per-game duration override, and the function does **not** read
   `games.duration_minutes`. The kickoff's `resolveGameTiming(div, tour, override?)` and the
   `project_per_game_length` memory ("takes a per-game duration, not `isPlayoff`") do not match
   `feat/free-tier-coaches`. The `games.duration_minutes` **column** does exist live (mig 112), but the
   per-game-length code wiring is not on this branch → a textbook "column exists but the branch doesn't use
   it" gotcha. **Action:** document the column + the branch-dependent function contract; reconcile
   `memory/project_per_game_length.md`.
2. **`tournaments.settings.playoff_game_duration_minutes` is NOT removed.** Still defined at
   [lib/types.ts:55](../../../lib/types.ts#L55) and actively read by `lib/schedule-conflict.ts:53`,
   `lib/schedule-metrics.ts:561`, `app/api/admin/tournaments/route.ts:518-560`. Memory's "REMOVED — don't
   reintroduce" is refuted on this branch. All 17 documented `TournamentSettings` keys are present.
3. **`teams.email ILIKE auth user email` identity key appears stale.** No such `ILIKE` query was found;
   the register route matches `signedInCoach.email === email` (exact, lowercased) and coach↔team linkage
   now flows through `basic_coach_teams` (email-keyed). The only relevant `ILIKE` is on
   `org_public_site_content.contact_email` ([lib/team-org-links.ts:313](../../../lib/team-org-links.ts#L313)).
   The "teams.email ILIKE" key reflects the superseded Tournament Coach Portal model. **Action:** verify
   exhaustively in Phase 1/2 before documenting the coach identity key.
4. **`organizations` has no `contact_email` column, but `lib/types.ts:156` still declares
   `Organization.contactEmail?`** — hydrated from `org_public_site_content.contact_email`. A **type-vs-table
   mismatch** to document so no one records it as a real column.
5. **Register-route SELECTs are already on the cleaned-up contact model in the working tree** —
   [app/api/register/route.ts:233-238](../../../app/api/register/route.ts#L233-L238) selects
   `contact_member_id` (not `contact_id`), `public_hidden_pages`, `notify_mode`; line 279 omits
   `organizations.contact_email`. *(The commit/deploy-to-`master` state of that fix is tracked under the
   "Registration Form QA" TODO item, not this project — the dictionary only owns the schema semantics.)*

`public_hidden_pages` default (`[]`) is **code-inferred only** — no snapshot confirms the default literal
until Phase 0 regenerates them; document defaults as "verify against refreshed snapshot."

---

## 8. Methodology & effort

Per-field verification = snapshot lookup (dev+prod) → live/memory cross-check → 1–3 code greps for the
exact read/write `file:line` and value domains/defaults → reconcile any code-vs-memory drift. **Realistic
cost ≈ 10–30 min/field** (JSONB-blob keys and type-vs-table mismatches sit at the top end). The grounding
pass confirmed this is workable **once snapshots are fresh** — today the staleness adds ~10 min/field of
dead lookup, which Phase 0 eliminates. We document only **non-obvious** fields (skip `id`/`created_at`
boilerplate) to keep the cost bounded.

---

## 9. Open decisions for sign-off

1. **Tooling-first (Phase 0 before Phase 1)?** Recommended — snapshots are too stale to verify against.
2. **Canonical snapshot representation** — recommend `schema_dumps.json`, regenerate split files from it.
3. **Add the 10th "Notifications & Push" domain?** Recommended.
4. **Split "Venues & Scheduling" out of Tournaments & Registration?** Deferred to Phase 1 (lean: keep
   together for now).
5. **Domain order after Phase 1** — as in §5 (Coaches next). Adjustable.

---

## 10. Process & follow-ups

- Per AGENCY_RULES: this PLAN + the PM brief exist; the TODO entry links here; a PM UX summary is presented
  before building; commits go to the working branch (`feat/free-tier-coaches`) / `dev`, never `master`
  without explicit instruction.
- **Memory:** on Phase-0/1 completion, add a `memory/` file pointing at `DATA_DICTIONARY.md` and **reconcile
  the two stale memory claims** surfaced in §7 (`project_per_game_length` re: `resolveGameTiming` /
  `playoff_game_duration_minutes`; the coach-identity note).
- **Cross-link** `DB_ARCHITECTURE_REVIEW.md` ↔ `DATA_DICTIONARY.md` (design ↔ meaning).
- Dev-server restart is **not** required by this project (docs + a standalone script only; running the
  script needs network access for the Management API, like `refresh-db-schema.mjs`).

---

## Definition of done (Phase 1)

`docs/agents/db/DATA_DICTIONARY.md` exists with the **Tournaments & Registration** domain fully documented
(every claim verified against the **refreshed** live snapshots + code, with file:line refs), the
**maintenance rules** in its header, the **repeatable dev+prod snapshot-refresh command** established and
run, and a **dev-vs-prod drift note** for any field that differs. Remaining domains are enumerated as
follow-up phases (§5).
