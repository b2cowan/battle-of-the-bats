# Project Kickoff Prompt — FieldLogicHQ Data Dictionary (semantic schema + maintenance rules)

> This file is a **handoff prompt** for a fresh conversation. Paste its contents (or point the new
> conversation at this path). It is self-contained — assume the new conversation has **no memory of
> the session that created it**.

---

## Paste this into the new conversation

You are taking on a new project: **build and maintain a semantic Data Dictionary for the FieldLogicHQ
database** — a living document that captures, for every meaningful column, **what it means, what
reads/writes it, how it relates to other fields, and its gotchas** — plus the **rules for keeping it
accurate going forward**. Use the `/db` and `/dba` agents; this is squarely their domain.

### Why this project exists (the motivating incident, 2026-06-08)

A public tournament registration `POST /api/register` was returning a 500 ("Unable to confirm
tournament availability"). The root cause was **dev/prod database schema drift**: the deployed code
selected three columns that didn't exist in the live databases —
`tournaments.public_hidden_pages` (a real column, missing from **both** dev and prod — migration 040
had never been applied to either), plus two stale selects (`divisions.contact_id`, dropped in
migration 090, and `organizations.contact_email`, which never existed on `organizations` — that field
lives on `org_public_site_content`).

Two lessons drove this project:

1. **Migrations are an *intent* log, not current truth.** The original diagnosis reasoned from
   migration files ("040 adds X, 090 drops Y, grep for the rest"). That is unreliable: you must mentally
   replay the full ordered history, a later migration can re-add/rename a column, a `grep` can miss it,
   and **in a drifted DB the migrations actively mislead**. The authoritative source for "does column X
   exist in dev/prod?" is the **live schema** (or the captured snapshots of it), not the migration
   folder. This dictionary project must bake that rule in.
2. **Structure is captured; *meaning* is not.** The column types/constraints are snapshotted (see
   below), but nothing explains that `public_hidden_pages` *also gates the registration endpoint*, that
   `contact_id` is dead, that `organizations` has no `contact_email`, or what keys live inside the
   `settings` JSONB. That semantic layer is what this project produces.

### What already exists — do NOT reinvent these (map them, link them, fill the gap)

- **`docs/agents/db/schema-snapshots/`** — the **authoritative live-structure source**. Separate
  **dev and prod** dumps: `schema-dump-columns-{dev,prod}.json`, `schema-dump-constraints-{dev,prod}.json`,
  `schema-dump-indexes-{dev,prod}.json`, `fk_constraints_prod.json`, `schema_dumps.json`. **This is what
  you grep to answer "does column X exist in dev vs prod" — not migrations.** (Caveat: confirm their
  freshness; as of this writing they were ~1 day stale and did not yet reflect migration 040.)
- **`scripts/refresh-db-schema.mjs`** — regenerates `memory/reference_db_schema.md` (a flat table+column
  listing) from the **live dev** project via the Supabase Management API. NOTE: it only refreshes the
  **dev memory doc**, NOT the `docs/agents/db/schema-snapshots/*.json` (which include prod). Establishing
  a clean, repeatable **dev + prod snapshot regeneration** path is part of this project's tooling work.
- **`docs/agents/db/DB_ARCHITECTURE_REVIEW.md`** — the `/dba` agent's architecture-findings log
  (severity-tracked findings, schema source pointers, module map). The dictionary complements it: the
  review reasons about *design*; the dictionary documents *field-level meaning*.
- **`docs/agents/db/validate_db_state.sql`** — DB validation queries.
- **Memory:** `memory/reference_db_schema.md` (auto-gen dev schema), `memory/reference_prod_supabase.md`
  (prod access: project `qcttcboqysynwcdyghil`, `.env.production.local`, run via
  `node --env-file=.env.production.local …`), `memory/project_supabase_dev.md` (dev access).
- **Live access:** dev project `npgnrxaitgbtbtvvykto`; prod project `qcttcboqysynwcdyghil`; the
  Management API query endpoint (`/v1/projects/{ref}/database/query`) with `SUPABASE_ACCESS_TOKEN` from
  `.env.local` works against **both** (use `information_schema.columns` to read structure with **no
  business-data rows**). `supabase-js` + service-role keys also work for read checks.

### Deliverable — `docs/agents/db/DATA_DICTIONARY.md`

A curated **semantic** document, owned by `/db` + `/dba`, never archived (it's a living agent reference
per the `docs/agents/` convention). Principles:

- **Semantics, not a type re-dump.** Do NOT restate column types — the JSON snapshots own structure.
  Cross-link to them. For each non-obvious field capture: **purpose**, the **code that reads/writes it**
  (file:line), **relationships** to other fields/tables, and **gotchas** (legacy-vs-current,
  dual-purpose, JSONB key catalogs, dev/prod drift, identity keys).
- **Organized by domain**, not alphabetically. Suggested domains: Org/Platform core · Tournaments &
  Registration · Coaches / basic-teams · Rep teams / team workspaces · League / house-league ·
  Accounting · Stripe/Billing · Platform admin · CRM.
- **Gotchas-first.** Lead each domain with the traps an implementer would otherwise learn the hard way.
- **Every claim verified against the live schema + code** — practice what we preach. Do NOT trust the
  seed list below (or any migration) without confirming against the snapshots / `information_schema` and
  the code that uses the field.

### Maintenance rules (write these into the doc's header, make them binding)

1. **Authoritative source for "does column X exist":** the dev/prod snapshots or live `information_schema`
   — **never** the migration folder. Migrations describe intent over time and mislead in a drifted DB.
2. **Schema change ⇒ dictionary change in the same unit of work.** Adding/renaming/dropping a column, or
   changing a field's *meaning*, requires updating `DATA_DICTIONARY.md` alongside the code/migration.
3. **Snapshots refreshed after every migration — dev AND prod.** Repair/establish a single command that
   regenerates the `docs/agents/db/schema-snapshots/*.json` for both environments (today only the dev
   memory doc is scripted). Run it after applying any migration to either environment.
4. **Drift watch.** Dev and prod can and do diverge (this incident: both were missing migration 040; the
   register code still shipped selecting the column). Add a routine **dev-vs-prod snapshot diff** and
   surface divergences; the dictionary should note any field where dev ≠ prod.
5. **Ownership:** `/db` (operational queries, field lookups) and `/dba` (architecture, migrations,
   snapshots) keep it current; the `DB_ARCHITECTURE_REVIEW.md` cross-references it.

### First-pass scope — start with **Tournaments & Registration**

That's the domain with the most context and the freshest known gotchas. Seed it with the items below,
**verifying each against the live schema + code before recording** (file:line for the reader). Then
expand domain-by-domain.

**Seed gotchas to bank (verify, then document):**

- **`tournaments.public_hidden_pages`** (`jsonb`, default `[]`): array of `PublicPageKey`
  (`news|schedule|standings|teams|rules|register`, see `lib/public-pages.ts`). **Dual purpose** — it
  drives public-nav visibility (`isPublicPageEnabled`) **and gates the registration endpoint**
  (`isRegisterPageHidden` in `app/api/register/route.ts` → 403 when `register` is hidden). Added by
  migration 040; **was missing from dev+prod until 2026-06-08** (applied that day). Naming smell: it
  reads as cosmetic nav config but is also the registration on/off switch.
- **Contact model** (post-2026-05-25 refactor): `divisions.contact_id` was **dropped** (migration 090;
  `divisions` is the renamed `age_groups`) → use **`contact_member_id`** (FK → `organization_members`).
  **`organizations` has no `contact_email`** — the public org contact email lives on
  `org_public_site_content.contact_email`. `tournaments.contact_email` still exists.
  `tournaments.notify_mode` (`all|assigned`) routes admin registration notifications;
  `tournaments.default_contact_member_id` is the fallback contact.
- **`tournaments.settings` JSONB catalog** (no migration per key): `format`, `rulesLayout`,
  `resourcesLayout`, `game_duration_minutes`, `buffer_minutes`, `playoff_game_duration_minutes`,
  `playoff_buffer_minutes`, `schedule_travel_venue_buffer_minutes`,
  `schedule_travel_facility_buffer_minutes`, `game_timing_scope`, `tie_breakers`, `tie_breaker_scope`,
  `fee_scope`, `show_fees_on_register`, `payment_instructions`, `payment_instructions_on_form` (see
  `TournamentSettings` in `lib/types.ts`). `divisions.settings`: `game_duration_minutes`, `buffer_minutes`.
- **Fee model:** `tournaments.fee_schedule_mode` (`tournament|division`) selects whether tournament-level
  or division-level fee fields apply (`resolveFeeSchedule`); `deposit_amount` / `deposit_due_date` /
  `total_fee_amount` / `total_fee_due_date` exist on **both** `tournaments` and `divisions`.
- **`teams` = the registration unit:** `name, coach, email, division_id, tournament_id, status`
  (`pending|accepted|waitlist|rejected`), `payment_status`, `slot_id`, `waitlist_position`,
  `registered_at`, `seed` (mig 113), `roster_submitted_at` / `roster_confirmed_at` + check-in columns
  (mig 110). **Coach identity key = `teams.email ILIKE auth user email`.** `teams.players` jsonb was
  **dropped** (mig 111) → roster lives in `tournament_roster_players` (mig 110).
- **Coaches / basic-teams:** `basic_coach_teams` (email-keyed, **no org**, the free Basic portal),
  `basic_coach_team_registrations` (links a coach team ↔ a tournament `teams` row),
  `basic_coach_team_users` (user↔team join with `role`), `team_workspace_id` bridges to the paid
  workspace org.
- **`games.duration_minutes`** (mig 112) — per-game length; `resolveGameTiming(div, tour, override?)`.

### Process requirements (AGENCY_RULES — non-negotiable)

- Create a **`docs/projects/archive/DATA_DICTIONARY_PLAN.md`** + **`DATA_DICTIONARY_PM_BRIEF.md`** pair
  before substantive work; add a one-line entry to `TODO.md` linking the plan.
- Present a **plain-language PM UX summary** before building (per AGENCY_RULES; even though this is
  internal docs, state who benefits and how it changes the agent workflow).
- All commits to `dev` (or the current working branch) — never `master` without explicit instruction.
- Update project memory (`memory/MEMORY.md` index + a per-topic memory file pointing at the dictionary).

### Definition of done (phase 1)

`docs/agents/db/DATA_DICTIONARY.md` exists with the **Tournaments & Registration** domain fully
documented (every claim verified against live schema + code, with file:line refs), the **maintenance
rules** in its header, a **repeatable dev+prod snapshot-refresh command** established (or a precise
ticket for it if it's larger), and a **dev-vs-prod drift note** for any field that differs. Remaining
domains are enumerated as follow-up phases in the plan.
```

---

## Notes for whoever runs this

- The kickoff above is intentionally exhaustive so the new conversation starts grounded. It does **not**
  pre-build the dictionary (that's the project's job) — it sets scope, resources, and the maintenance
  rules you asked for.
- Companion finding to fold in: the **`public_hidden_pages` prod fix is half-done** — migration 040 was
  applied to dev+prod on 2026-06-08, but the deployed register route still selects the dead
  `contact_id` / `contact_email` columns; the code fix that drops them is uncommitted on
  `feat/free-tier-coaches` and must reach `master` for prod registration to work. (Tracked separately.)
