# Schema Parity — dev↔prod convergence (48 → 0)

**Status: ✅ COMPLETE 2026-07-27 — 51 → 0 divergences.** Stage 1 (parity gate + migration 200) plus
Stages 2–4 (migrations 201/202/203) are applied to **dev AND prod**. `check:parity` now runs against
an **empty baseline**, so any future dev↔prod divergence fails `verify:changed` and the deploy build
on first appearance. Verified live post-apply: both environments report 143 tables / 1657 columns /
590 constraint-rows / 464 indexes / 314 rls-check rows, and 0 drift on every dimension.
**Routed by:** `/db`. **Companion:** [SCHEMA_PARITY_PM_BRIEF.md](SCHEMA_PARITY_PM_BRIEF.md).
**Source prompt:** [SCHEMA_PARITY_BUILD_PROMPT.md](SCHEMA_PARITY_BUILD_PROMPT.md).

## Why there is drift at all

The app's original nine tables (`announcements`, `diamonds`, `divisions`, `games`, `resources`,
`rule_items`, `rules`, `teams`, `tournaments`) were hand-created in the Supabase dashboard
**separately per environment** between 2026-04-22 and 2026-05-02. Migration 001 only ever ALTERed
an existing schema. **Not one of those nine tables is created by any of the 201 migrations.** Every
divergence below traces to that ten-day gap; everything created by a migration since is in step.
`league_practices` is the sole exception — created by migration, but with indexes named differently
per env.

---

## Audit findings (read-only, live prod, 2026-07-27)

Prod at time of audit: 1 org, 9 auth users, 2 tournaments, 2 divisions, 21 teams, 53 games,
2 announcements, 2 diamonds, 0 rules / rule_items.

### The audit came back clean — Stage 4 needs NO backfill

| Column (prod nullable, dev NOT NULL) | NULLs on prod | Rows |
|---|---|---|
| `divisions.requires_pool_selection` | **0** | 2 |
| `games.is_playoff` | **0** | 53 |
| `resources.display_order` | **0** | 2 |
| `rule_items.display_order` / `rule_items.rule_id` | **0** | 0 |
| `rules.display_order` | **0** | 0 |
| `teams.payment_status` / `teams.registered_at` / `teams.status` | **0** | 21 |

`games.division_id` → orphans: **0**, NULLs: **0** (of 53). The missing FK can be added without
repair.

### NEW — three live prod failure paths (prod is stricter than the code assumes)

Prod enforces NOT NULL on five columns dev treats as optional. Three have **write paths that
send NULL today**, so those requests throw on prod and succeed on dev:

1. **Deleting a venue fails on prod.** `clearVenueFromGames` writes `location: null`
   ([app/api/admin/venues/route.ts:105](../../../app/api/admin/venues/route.ts#L105)), as does
   `clearFacilityFromGames` ([:131](../../../app/api/admin/venues/route.ts#L131)).
   Dev holds **60 of 378** games with `location IS NULL` — rows prod could not have accepted.
2. **Creating a venue with no address fails on prod.**
   ([app/api/admin/venues/route.ts:449](../../../app/api/admin/venues/route.ts#L449) writes
   `address ?? null`.) Dev holds 2 such rows.
3. **Bulk registration import with a blank coach column fails on prod.**
   ([registrations/import/shared.ts:116](../../../app/api/admin/tournaments/[tournamentId]/registrations/import/shared.ts#L116),
   typed `coach: string | null`.) Dev holds **49 of 229** teams with `coach IS NULL`.
   The interactive admin path dodges it by coercing to `''`
   ([teams/route.ts:321](../../../app/api/admin/teams/route.ts#L321)) — which is why **17 of 21
   prod teams carry an empty-string coach**. Same field, two different "no value" encodings per env.

The other two — `announcements.body`, `tournaments.slug` — have **no** null-writing path
(body is 400-rejected when blank, [communications/route.ts:155](../../../app/api/admin/communications/route.ts#L155);
slug is always written explicitly). Prod is *correct* on those two; dev is the loose one.

### NEW — division delete is unguarded (the migration-200 lesson, unlearned)

`POST /api/admin/divisions {action:'delete'}`
([divisions/route.ts:423-439](../../../app/api/admin/divisions/route.ts#L423)) checks scope, org
and tournament-lock — then deletes. There is **no games/teams guard**.

- On **dev** (`games_age_group_id_fkey` CASCADE) this already destroys every game in the division,
  scores included.
- On **prod** there is no FK at all, so games survive as orphans while teams CASCADE away.
- **Adding the FK to prod as CASCADE without a guard imports a live data-loss path into
  production** — precisely the migration-200 failure, in reverse.

**Why CASCADE is still right here (and SET NULL was right for mig 200):** a game references *two*
teams, so cascading from one team destroys the *opponent's* record too — hence SET NULL. A division
*owns* its games and teams outright (and `teams.division_id` already CASCADEs in both envs), so
SET NULL would leave division-less, team-less orphan games. The fix is the **guard**, not the action.

---

## Stage 2 — safe / additive · 25 of 48 items · migration 201

Every item verified before inclusion; no data risk, no behaviour change.

1. **5 FK renames on prod** (10 items). `fk_announcements_tournament`, `fk_diamonds_tournament`,
   `fk_age_groups_tournament`, `fk_games_tournament`, `fk_teams_tournament` → the dev `*_fkey`
   names. **All five confirmed `ON DELETE CASCADE` on BOTH sides** via `pg_get_constraintdef`
   before renaming — a rename that unifies the name while behaviour differs manufactures *false*
   parity, which is exactly how the migration-200 bug hid.
2. **2 exact-duplicate FKs dropped on prod** (2 items). `fk_teams_age_group` and **`fk_games_diamond`**
   are byte-identical to `teams_age_group_id_fkey` / `games_diamond_id_fkey`, which stay.
   ⚠ *The build prompt named only `fk_teams_age_group` and counted 6 renames; there are **5**
   renames and **2** duplicates.*
3. **3 ID-generator defaults on prod** (3 items) — `resources.id`, `rule_items.id`, `rules.id`
   `uuid_generate_v4()` → `gen_random_uuid()`. Equivalent output; drops a dependency on the
   `uuid-ossp` extension.
4. **4 index changes on prod** (7 items) — rename `*_season_id_idx`/`*_team_id_idx` to
   `*_season_idx`/`*_team_idx`; rebuild the recurrence index as **PARTIAL**
   (`WHERE recurrence_group_id IS NOT NULL`) to match dev; **create the missing composite
   `league_practices_schedule_idx (season_id, scheduled_at)`** — a real, performance-only gap.
5. **3 columns added to dev** (3 items) — `resources.created_at`, `rule_items.created_at`,
   `rules.created_at`, matching prod exactly (`timestamptz NULL DEFAULT now()`). Additive; dropping
   them from prod would destroy data.

## Stage 3 — behavioural · 8 items · owner decision required

| # | Item | dev | prod | Recommendation |
|---|---|---|---|---|
| 1 | `tournaments.status` default | `'draft'` | `'completed'` | **→ `'draft'`.** A tournament created without an explicit status is born FINISHED on prod. Latent (code always writes it) but indefensible. |
| 2 | `tournaments.list_in_directory` default | `true` | `false` | **→ `true`.** Not a new decision — forward-ports migration 197 (owner decision 2026-07-22) which never reached prod. |
| 3 | `tournaments_status_check` | absent | present | **→ add to dev.** Prod is right. Dev's live values (`active`,`archived`,`completed`) all pass, so it applies clean, and it stops a bad status passing dev then failing release. |
| 4 | 5 NOT NULL columns | loose | strict | **Split, not blanket** — see below. |

**Item 4, split by intent** (the build prompt proposed loosening all five; the audit says otherwise):

- **Loosen prod** → `diamonds.address`, `games.location`, `teams.coach`. NULL is genuinely
  meaningful (no address, TBD location, no coach yet) and each has a live failure path.
  Non-destructive; removes three live production failure modes.
- **Tighten dev** → `announcements.body`, `tournaments.slug`. Prod is right; the app already
  requires both; dev has zero NULLs, so it applies clean.

## Stage 4 — audited · 15 items

1. **9 tightenings, prod → dev** (NOT NULL + defaults). Zero NULLs on prod ⇒ **no backfill**.
   `rule_items.rule_id` NOT NULL matters most: prod currently allows a rule item with no parent rule.
2. **Add `games.division_id → divisions.id` to prod, `ON DELETE CASCADE`** (matching dev) —
   **paired in the same unit of work with a `DIVISION_HAS_GAMES` 409 guard** on division delete,
   mirroring the `TEAM_HAS_GAMES` guard shipped with migration 200 (`force: true` to override).
   The guard also closes the pre-existing dev data-loss path.
3. **5 remaining defaults.** `announcements.published_at` (→ `now()` on prod) and
   `divisions.display_order` (→ `0` on prod) are *bug fixes* — both columns are NOT NULL with no
   default on prod, so any insert omitting them **fails**. The other three are cosmetic:
   `divisions.pool_count` (prod `1`) and `rules.icon` (prod `'Shield'`) — recommend **adopting
   prod's defaults on dev**, since the code already assumes them (`|| 1`); `divisions.playoff_config`
   — recommend **dropping prod's default** so an unconfigured division stays visibly unconfigured.

## Binding constraints on this work

- Migration + `DATA_DICTIONARY.md` + `npm run refresh:snapshots` (dev AND prod) + lowered parity
  baseline, **all in the same commit**. `check:dictionary` and `check:snapshots` enforce it.
- Apply to **dev first, verify, then explicit owner approval for prod**.
- Migrations are written **idempotent and env-agnostic** (catalog-guarded renames, `IF EXISTS` /
  `IF NOT EXISTS`) so the same file applies to both environments and the ledger stays identical —
  the migration-200 pattern.
- Next migration number is **201**. ⚠ Two existing migrations share number **101** — ordering there
  is ambiguous; worth a separate cleanup decision.

## Verification bar

`npm run typecheck` · `npm test` (391) · `npm run verify:changed` (all gates green) · parity
baseline lowered to match reality · dictionary updated · clean dev-server restart before handoff.
