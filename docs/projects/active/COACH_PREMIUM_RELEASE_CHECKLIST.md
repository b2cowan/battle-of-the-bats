# Coach Premium Upgrade — Production Release Checklist

**Scope:** ship the free-tournament-coach → **Coaches Portal Premium** upgrade flow (Phases 1, 1.5, 2, 3a–3d, 4, 5) to production and open self-serve checkout.

**State at time of writing (2026-06-20):** fully built + `/review`'d on `dev`; **all commits local, nothing pushed**; the Premium `team` plan is **gated** in prod (`/coaches/start` shows express-interest, not checkout). Plan: [COACH_PREMIUM_UPGRADE_FLOW_PLAN.md](COACH_PREMIUM_UPGRADE_FLOW_PLAN.md) · [PM brief](COACH_PREMIUM_UPGRADE_FLOW_PM_BRIEF.md).

> Deploy mechanics: pushing/merging to **`master`** triggers the Amplify CI/CD build+deploy. Migrations are **never** auto-applied — apply them manually to prod **before** the code that reads them is promoted (the migration-040 incident: code live, schema missing → prod 500s). `master` is production; do not push it without explicit owner go-ahead.

---

## ⚠️ Gate 0 — This is a SHARED-BRANCH release (read first)

`dev` is the single shared branch for **all** agents. A `dev → master` promotion deploys **everything** currently on `dev`, not just Coach Premium. As of now `dev` also carries in-flight work from other initiatives, at least:

- **Team Chat "proving slice"** — migration **141** (`chat_rooms` / `chat_room_members` / `chat_messages`) + a **"Chat" nav item → `/chat`** in the coaches sidebar. The chat *surface* is not complete. Promoting `dev` would ship the Chat nav link (and require mig 141 in prod, or the code 500s).
- **Help Phase 5a/5b (Discovery & Orientation)** — owner-sign-off-gated per `TODO.md`.
- Possibly other prod-pending migrations from concurrent work.

**Decision required before any release:** either
- **(A) Whole-branch promote** — only if *every* concurrent change on `dev` is release-safe (complete + verified, or safely flag-gated off). This means resolving the Chat nav/`/chat` route + applying mig 141 to prod too. Coordinate with those initiatives' owners. **OR**
- **(B) Surgical release** — cut a release branch off `master` and cherry-pick only the Coach Premium commits (e0c304b, e5445ea, 300781b, ea5a495, e68ba0c, c64f786) + the schema-artifact reconciliation. This deviates from the "promote `dev` wholesale" convention but isolates the release. Use if `dev` isn't fully release-ready.

Everything below assumes the chosen scope is agreed. **The Coach Premium code itself is ready; the blocker is branch readiness, which is a coordination call, not a code gap.**

---

## Step 1 — Reconcile the shared schema artifacts (commit)

The Data Dictionary + schema snapshots are **updated in the working tree but uncommitted**, entangled with the concurrent chat migration (141). Before release they must be committed so the repo's recorded schema matches prod-to-be.

1. Ensure every prod-bound migration's **SQL file** is committed: `138`, `139`, `140`, `142` (Coach Premium) — and `141` if scope (A).
2. Ensure each migration's **Data Dictionary** prose is committed (Coach Premium entries + the chat entries belong to their respective owners — coordinate so one combined commit lands them).
3. `node scripts/refresh-db-snapshots.mjs` → commit the regenerated `docs/agents/db/schema-snapshots/*` + `memory/reference_db_schema.md`.
4. Verify green: `npm run check:dictionary` and `npm run check:snapshots`.

---

## Step 2 — Final dev verification

- **Owner browser walkthrough on dev** (the real acceptance gate): upgrade a free tournament-coach team that has a roster/schedule/fees → confirm two pre-filled screens → reach a **populated** Premium portal → sane "check these" summary. Then spot-check the new **Settings** (start next season, edit division) and **roster drag-to-reorder**.
- `npm run typecheck` and `npm run verify:changed` green on the branch.
- Restart the dev server first if testing locally (new files + shared-module changes this cycle).

---

## Step 3 — Apply pending migrations to PRODUCTION (in order, BEFORE promoting code)

Already on prod: **135 / 136 / 137** (applied during the Multi-Sport promotion). Apply the rest **in numeric order** (this naturally satisfies the one hard ordering rule — **139 must precede 140**):

| # | File | Phase | Why / note |
|---|------|-------|------------|
| 138 | `138_rep_team_announcements.sql` | 3b | Premium team announcements table |
| 139 | `139_rep_roster_players_guardian_nullable.sql` | 3c | **Must precede 140.** Drops NOT NULL on guardian fields so the Phase-4 migration can carry rosters with missing guardian info without a constraint violation |
| 140 | `140_team_workspaces_migration_summary.sql` | 4 | Stores the post-upgrade "check these" summary the portal surfaces |
| 142 | `142_rep_roster_players_display_order.sql` | 3d | Roster manual-order column |
| 143 | `143_coach_upgrade_migration_provenance.sql` | retry | Provenance tags + partial-unique indexes that make the partial-migration auto-retry safe |
| *(141)* | `141_chat_foundation.sql` | *(chat)* | **Only under scope (A)** — not a Coach Premium migration |

Per file:
```
node scripts/apply-migration-api.mjs supabase/migrations/<file>.sql --prod
```
(Requires `SUPABASE_ACCESS_TOKEN` in `.env.local`; prod project ref `qcttcboqysynwcdyghil`.)

Then:
```
node scripts/refresh-db-snapshots.mjs
node scripts/check-prod-migration-drift.mjs   # must show prod NOT behind dev for the released scope
```

> **Drift-check blind spot:** `check:migrations` detects missing **tables/columns**, so it will **not** flag mig **139** (a NOT-NULL *relaxation*, no new column). Don't skip 139 just because drift looks clean — apply it explicitly, before 140.

---

## Step 4 — Promote code to `master` (triggers Amplify deploy)

- Confirm the agreed scope's commits are all on `dev` (and the schema-artifact commit from Step 1 landed).
- Promote `dev → master` (scope A) or push the release branch (scope B). **Explicit owner action — this deploys.**
- ⚠️ Amplify builds with **pnpm@9** — never commit `pnpm-workspace.yaml` (pnpm 9 aborts the build; broke dev+prod once).
- Watch the Amplify build to green.

---

## Step 5 — Open the Premium gate on production

Today `getPlanGatingMap().team` is **truthy** in prod → `/coaches/start` renders the express-interest capture. To open self-serve checkout:

- **Un-gate the `team` plan** in the prod plan-gating config (the platform-admin plan-gating / plan-config setting that feeds `getPlanGatingMap`). When `gatingMap.team` is falsy, `/coaches/start` renders the real two-screen checkout (`TeamSignupClient`) and the `?basicTeamId=…` pre-fill + data migration path goes live.
- This is the **go-live switch** — do it **after** Step 4's deploy is verified, so the moment checkout opens, the schema + code are already in place.
- Confirm Stripe is configured for the `team` plan price in prod (it powers the checkout).

---

## Step 6 — Post-deploy smoke (production)

- `https://<prod>/platform-admin/login?next=%2Fplatform-admin` returns **200**, no Supabase `EACCES` in logs.
- `node scripts/check-prod-migration-drift.mjs` → green.
- Walk the real upgrade on prod (a disposable free team): two screens → pay → populated portal → summary. Confirm Settings (start-next-season, division) and roster drag work.
- Confirm a brand-new (no-free-team) coach still gets the create-a-team signup (not broken by the pre-fill path).

---

## Rollback / safety

- **Migrations are additive / relaxing → reversible and safe to leave in place.** A `display_order` column, an announcements table, a nullable relaxation, and a summary column don't harm older code.
- **Code rollback:** revert `master` to the prior commit; Amplify redeploys. Migrations can stay.
- **Fast off-switch:** re-gate the `team` plan (Step 5 in reverse) to stop new upgrades instantly **without a redeploy** — the safest first response if the upgrade flow misbehaves in prod.

---

## Known follow-ups (documented, NOT release blockers)

- ~~**No auto-retry for a partial data migration**~~ — ✅ **BUILT** (mig 143, dev): a partial carry now self-heals (bounded auto-retry + manual "Try again"), made safe by row-level provenance. See [COACH_PREMIUM_MIGRATION_RETRY_PLAN.md](COACH_PREMIUM_MIGRATION_RETRY_PLAN.md). Adds mig 143 to the prod-pending set (Step 3).
- **Pre-existing duplicate-workspace race** — two Stripe events both passing the subscription-id dedup could create two workspaces; unaffected by this work, tracked as separate provisioning hardening.
- **Phase 5 edge cases** — lapsed-subscription coach can still roll a season (no per-action billing gate, consistent with the rest of the portal); true all-or-nothing season rollover would need a DB transaction/RPC; both documented in the Phase 5 plan.
