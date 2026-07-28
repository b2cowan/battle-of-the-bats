# Schema Parity — Stages 2–4 Build Prompt (dev↔prod, 48 divergences → 0)

> **How to use:** paste this whole prompt into a NEW chat. Read it fully, then read the
> companion docs it points at BEFORE touching anything. Continues work done 2026-07-26/27.

---

## Where this came from

The app began 2026-04-22 as a single-event tournament site. Its original nine tables
(`announcements`, `diamonds`, `divisions`, `games`, `resources`, `rule_items`, `rules`, `teams`,
`tournaments`) were created **by hand in the Supabase dashboard, separately per environment** —
migration 001 didn't arrive until 2026-05-02 and only ever ALTERed an existing schema. **Not one
of those nine tables is created by any of the 201 migrations.** That ten-day gap is the entire
source of the drift. Everything created by a migration since has stayed in step.

**Read first:** `docs/agents/db/DATA_DICTIONARY.md` (rule 4 + the `games` gotchas 6–7),
`docs/agents/db/schema-snapshots/DRIFT_dev_vs_prod.md`, and the memory entry
`reference_fk_action_drift.md`.

## Already shipped (do NOT redo)

- **`scripts/check-schema-parity.mjs`** — offline parity gate over the committed snapshots (no
  network, no creds). Reuses `buildDrift()` from `refresh-db-snapshots.mjs` so there is ONE
  definition of drift. Per-item ratchet on `scripts/.schema-parity-baseline.json`; a NEW
  divergence fails, and an ACCEPTED one whose signature CHANGES also fails. Wired into
  `verify:changed` + `amplify.yml`. `npm run check:parity` / `check:parity:list`.
- **Migration 200** (applied dev **and** prod 2026-07-27): `games.home_team_id/away_team_id` →
  `teams.id` converged on `ON DELETE SET NULL` in both envs; prod duplicates
  `fk_games_home_team`/`fk_games_away_team` dropped. Fixed a **live production data-loss path**:
  deleting a team CASCADE-deleted every game it played, scores included.
- **`DELETE /api/admin/teams`** now returns **409 `TEAM_HAS_GAMES`** (game + scored counts)
  unless `force: true`. Team ids are UUID-validated before reaching a PostgREST filter string.
- Snapshots now capture `delete_rule`/`update_rule`; parity compares FK **actions**, not just names.

## The three gates (they compose — know which answers what)

| Command | Answers |
|---|---|
| `check:snapshots` | does the committed snapshot reflect the migrations (watermark) |
| `check:migrations` | did a migration reach prod — **EXISTENCE ONLY** |
| `check:parity` | do the two schemas actually AGREE (defaults, nullability, constraints, FK actions, indexes, CHECKs) |

⚠ **`check:migrations` is NOT a parity gate.** It reported "prod is in sync with dev" throughout
the data-loss bug, and still does for migration 200, because no columns changed.

---

## The work — 48 divergences, in risk order

Get the live list any time: `npm run check:parity:list`.

### Stage 2 — safe / additive (~21 items, no data risk, no behaviour change)

1. **6 constraint renames on prod** (12 items: one `only-dev` + one `only-prod` each). Same
   relationship, different name. Rename prod's to dev's name:
   `fk_announcements_tournament`→`announcements_tournament_id_fkey`,
   `fk_diamonds_tournament`→`diamonds_tournament_id_fkey`,
   `fk_age_groups_tournament`→`age_groups_tournament_id_fkey`,
   `fk_games_tournament`→`games_tournament_id_fkey`,
   `fk_teams_tournament`→`teams_tournament_id_fkey`.
   ⚠ **Before each rename, confirm the delete/update rules already MATCH** — that is exactly how
   the prod data-loss bug hid. A rename that unifies the name while behaviour differs creates
   FALSE parity. (`fk_teams_age_group` is a prod duplicate of `teams_age_group_id_fkey`, both
   CASCADE — drop it rather than rename.)
2. **3 ID-generator defaults on prod** — `resources.id`, `rule_items.id`, `rules.id` use
   `uuid_generate_v4()`; dev uses `gen_random_uuid()`. Equivalent output, cosmetic.
3. **4 index items** — `league_practices`: rename prod's `*_season_id_idx`/`*_team_id_idx` to dev's
   `*_season_idx`/`*_team_idx`; align the recurrence index (dev's is PARTIAL,
   `WHERE recurrence_group_id IS NOT NULL`; prod's is plain); and **create the missing composite
   `league_practices_schedule_idx (season_id, scheduled_at)` on prod** — a real (performance-only) gap.
4. **3 columns only on prod** — `resources.created_at`, `rule_items.created_at`, `rules.created_at`.
   **Add to dev** (additive). Dropping from prod would destroy data.

### Stage 3 — behavioural, needs an OWNER DECISION each (4 items)

Bring each with a recommendation; do not choose unilaterally.

1. **`tournaments.status` default** — dev `'draft'`, prod **`'completed'`**. A tournament created
   without an explicit status is born FINISHED on prod.
2. **`tournaments.list_in_directory` default** — dev `true`, prod `false`. New tournaments are
   hidden from the public directory on prod. *(Dictionary says mig 197 flipped dev; prod pending.)*
3. **`tournaments_status_check`** — CHECK exists on prod only, so dev accepts status values prod
   rejects. A feature can pass dev and fail on release.
4. **Prod is STRICTER (NOT NULL) on 5 columns dev treats as optional** — `announcements.body`,
   `diamonds.address`, `games.location`, `teams.coach`, `tournaments.slug`. **Prod may be
   REJECTING WRITES dev accepts.** Recommended: loosen prod to match dev (non-destructive, removes
   a live failure mode) — but confirm the app's actual write behaviour first.

### Stage 4 — needs a READ-ONLY audit of live prod data first (~9 + 2)

1. **9 columns where prod is LOOSER (nullable) than dev**: `divisions.requires_pool_selection`,
   `games.is_playoff`, `resources.display_order`, `rule_items.display_order`, `rule_items.rule_id`,
   `rules.display_order`, `teams.payment_status`, `teams.registered_at`, `teams.status`.
   Tightening is the right end state — but **count existing NULLs first** and backfill. Note
   `rule_items.rule_id` nullable on prod means a rule item can exist with no parent rule.
2. **Missing FK on prod: `games.division_id` → `divisions.id`** (dev has
   `games_age_group_id_fkey`, CASCADE). Deleting a division on prod currently orphans its games.
   **Count orphans before adding**, then decide CASCADE vs SET NULL deliberately — do not blindly
   copy dev; the team FK taught us that lesson.
3. **Remaining default differences** (`announcements.published_at`, `divisions.display_order`,
   `divisions.playoff_config`, `divisions.pool_count`, `rules.icon`) — each changes new-row values,
   so each is a small decision, not a mechanical swap.

---

## Binding rules for this work

- **`/db` routes this work** (project rule: the DB tranche is `/db`-routed; every drop is an owner
  decision). Load it before schema changes.
- **Column existence comes from the snapshots / `information_schema` — NEVER from migration
  files.** They mislead in a drifted DB.
- **Same unit of work:** migration + `DATA_DICTIONARY.md` + `npm run refresh:snapshots` (dev AND
  prod) + lower the parity baseline (`check:parity --init`) + commit together. `check:dictionary`
  and `check:snapshots` enforce this and WILL fail otherwise.
- **Apply to DEV first, verify, then get explicit owner approval for PROD.** Credentials for both
  live in `.env.local`; `node scripts/apply-migration-api.mjs <file> [--prod]`,
  `node scripts/db-query.mjs --dev|--prod -q "…"` for read-only introspection.
- **Prove destructive changes empirically.** Pattern that worked: run the delete inside
  `BEGIN … ROLLBACK` on dev and assert row counts did not move.
- **Verify that a "safe cosmetic" change really is cosmetic.** The whole data-loss bug was found
  while checking whether a constraint RENAME was safe.
- **Test what a guardrail MISSES, not only what it catches.** The date guardrail matched only
  single-quoted `split('T')` until it was probed with the double-quoted form.
- **ONE shared `dev` branch, and a concurrent session is active in this checkout.** Re-check
  `git rev-parse --abbrev-ref HEAD`, stage **explicit pathspecs only** (never `git add -A`;
  bracket dirs need `:(literal)`), and `git show --stat HEAD` after every commit. Foreign files
  HAVE appeared in the index mid-session. Per-action owner OK before each commit.
- Next migration number is **201**. ⚠ Two existing migrations share the number **101** — ordering
  there is ambiguous; worth a cleanup decision.

## Verification bar

`npm run typecheck` · `npm test` (391 tests) · `npm run verify:changed` (all gates green) ·
parity baseline lowered to match reality · dictionary updated · clean dev-server restart before
handing back for browser testing.

---

## Other open threads (not this prompt's scope — do not lose them)

- **5 commits sit unpushed on local `dev`**, including the date-correctness fix (`a75ae993`) which
  repairs a bug that fires every evening, and the data-loss fix (`555f9cd5`). Prod is 5 behind.
- **Colour work is LIVE on prod but was never eyeballed in light mode / the warm coaches portal** —
  ~500 changes proven identical in dark mode ONLY. 11 screens changed shade (tryout flow,
  registration, sign-in, help centre, accounting). A contrast sweep was proposed to shrink that to
  a short list; not built.
- **Inline colour tiers 3 & 4** — 427 remaining, ratcheted. Tier 4 (~43: share images, app icons,
  picker defaults + email/PDF/theme defaults) is the valuable one: CSS variables **cannot** reach
  them, so "rebrand = one edit" is still not literally true. Proposed fix: derive a TS palette from
  `globals.css` with a drift check. The "rebrand checklist" a `globals.css` comment references
  **has never been written**.
- **`--shadow-md`** is referenced 5× in `components/chat/ChatPanel.module.css` and declared
  nowhere — those box-shadows render as nothing. ~10 minutes.
