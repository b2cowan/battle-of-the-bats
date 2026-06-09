# FieldLogicHQ — Data Dictionary

> **Owned by:** `/db` (field lookups, operational queries) + `/dba` (architecture, migrations, snapshots). **Never archived** — this is a living agent reference.
> **What this is:** the *semantic* layer — for each meaningful column, **what it means, what reads/writes it (file:line), how it relates to other fields, and its gotchas**. Structure (types/constraints) is owned by the JSON snapshots; this doc does **not** restate it.
> **Current as of:** code commit `ad9dc66` (branch `feat/free-tier-coaches`) · schema snapshot **2026-06-08** (103 tables, dev+prod). `file:line` refs are relative to that commit — re-verify if the tree has moved (see the branch-drift note below).
> **Companions:** [schema-snapshots/](schema-snapshots/) (structure — the authoritative source) · [DB_ARCHITECTURE_REVIEW.md](DB_ARCHITECTURE_REVIEW.md) (design-level findings) · [DRIFT_dev_vs_prod.md](schema-snapshots/DRIFT_dev_vs_prod.md) (dev≠prod catalogue).

---

## Maintenance rules (binding)

1. **Authoritative source for "does column X exist":** the dev/prod snapshots in `docs/agents/db/schema-snapshots/` or a live `information_schema` query — **never** the migration folder. Migrations describe intent over time and mislead in a drifted DB. *(A snapshot is only authoritative if fresh — see rule 3.)*
2. **Schema change ⇒ dictionary change in the same unit of work.** Adding/renaming/dropping a column, or changing a field's *meaning*, requires updating this file alongside the code/migration.
3. **Snapshots refreshed after every migration — dev AND prod** via `node scripts/refresh-db-snapshots.mjs`.
4. **Drift watch.** The refresh command emits `DRIFT_dev_vs_prod.md`; this doc notes any field where dev ≠ prod.
5. **Ownership:** `/db` + `/dba` keep it current; `DB_ARCHITECTURE_REVIEW.md` cross-references it.
6. **Code is branch-relative; schema is not.** A column exists in the *database*; the code that reads it can differ by branch. `file:line` refs name a commit. When behavior is branch-dependent, say so.

> **Branch-drift, observed live (2026-06-08):** while this domain was being written, an `origin/dev` merge (`1f61801`) replaced the tournament-level playoff-duration timing model with the **per-game-length** model (migration 112). Mid-project, `resolveGameTiming`'s signature and `playoff_game_duration_minutes`'s existence both flipped. This is *exactly* why rule 6 exists — and why rule 1 points at the live schema, not migrations. The entries below reflect the post-merge (`ad9dc66`) tree.

### Coverage ratchet (`npm run check:dictionary`)

This doc is kept non-stale by `scripts/check-dictionary-coverage.mjs` (wired into `verify:changed`). It parses two anchor forms and fails CI if a live table — or a column in a *sealed* table — is neither documented here nor waived in `scripts/.dictionary-coverage-baseline.json`:

```
<!-- dict:table:<table> -->          marks a table documented
<!-- dict:col:<table>.<column> -->   marks a column documented
```

(Anchors inside code fences like this one are ignored — only real anchors on their own line count.) A table is **sealed** once every one of its live columns is documented or waived; after that, a future migration adding a column to it fails the check until triaged.

---

# Domain: Tournaments & Registration

The core event domain: a **tournament** (under an org) contains **divisions**; a **team** registers into a division; **games** schedule those teams across **pools/pool_slots** and **venues**; **rules/resources/announcements** are its public content; **custom registration fields** capture extra answers. Registration runs through `POST /api/register` ([app/api/register/route.ts](../../../app/api/register/route.ts)).

### Gotchas first (the cross-cutting traps)

- **`public_hidden_pages` is dual-purpose.** The same JSONB array hides public-nav pages **and** hard-gates the registration endpoint (403 when it contains `'register'`). Hiding the "Register" nav item silently disables registration.
- **The contact model moved (migrations 088–090).** `divisions.contact_id` was **dropped** → use `divisions.contact_member_id` (FK `organization_members`). `organizations` has **no** `contact_email` — the org public contact lives on `org_public_site_content.contact_email`. `tournaments.contact_email` still exists (legacy fallback).
- **Tournament public pages ignore `organizations.is_public`.** That flag gates org-home/league pages (League/Club only), not tournament pages — a `is_public=false` Tournament/Plus org still serves public tournament pages ([lib/public-tournament-data.ts:57](../../../lib/public-tournament-data.ts#L57)).
- **`divisions` is the renamed `age_groups`.** FK constraint names and code variables (`g`, `ag`) still say `age_group`; there's a dropped-column hole at ordinal 7.
- **`teams` is the *registration* unit**, not a persistent rep/house-league team. `teams.players` (jsonb) was **dropped** (mig 111) — roster lives in `tournament_roster_players`.
- **Game length is per-game now** (mig 112): `games.duration_minutes` + `resolveGameTiming(division, tournament, gameDurationOverride?)`. The old tournament-level `settings.playoff_game_duration_minutes` is **gone**.
- **Real dev/prod drift exists** on legacy tournament tables (nullability/defaults, `id` default function, three `created_at` columns missing from dev) — see [DRIFT_dev_vs_prod.md](schema-snapshots/DRIFT_dev_vs_prod.md) and the per-field `Dev/prod` notes below. Never `SELECT *` and rely on column order — several columns differ only in ordinal position between envs.

---

## `tournaments`
<!-- dict:table:tournaments -->

**Purpose:** the registration root + per-event config — one row per tournament under an org (`org_id`), holding identity (year/name/slug/status), public-page visibility, fee schedule, contact routing, theming, and a `settings` JSONB catalog. Every public/admin tournament page and the register endpoint hang off it.

**Gotchas (read first):**
1. **`public_hidden_pages` gates registration, not just nav.** When the array includes `'register'`, `POST /api/register` returns **403** ([app/api/register/route.ts:75](../../../app/api/register/route.ts#L75), [:260](../../../app/api/register/route.ts#L260)), in addition to hiding the nav page via `isPublicPageEnabled` ([lib/public-pages.ts:23](../../../lib/public-pages.ts#L23)).
2. **`status` drifts dev↔prod (Finding #25).** Dev default `'draft'`, **no** CHECK; prod default `'completed'` **with** `tournaments_status_check` (`draft|active|completed|archived`). An INSERT omitting `status` becomes `'draft'` on dev but `'completed'` on prod, and dev silently accepts unknown values prod rejects. Value domain is **4** values (`TournamentStatus`, [lib/types.ts:14](../../../lib/types.ts#L14)).
3. **`slug` nullability drifts** — nullable on dev, NOT NULL on prod (DRIFT line 53). A clone/insert leaving `slug` null works on dev, throws on prod. `mapTournament` masks reads (`null → ''`) but not writes.
4. **`org_id` is the rename of `organization_id`**, but `mapTournament` reads `r.organization_id` ([lib/db.ts:2482](../../../lib/db.ts#L2482)) — a raw `select('*')` feeding it without aliasing `org_id AS organization_id` yields `organizationId: undefined`. Latent footgun.
5. **`fee_schedule_mode` is shadowed by `settings.fee_scope`.** The column (`tournament|division`; legacy `age_group`→`division` in mig 093) is what `resolveFeeSchedule` reads, but admin UI edits `settings.fee_scope` and syncs back via `feeScopeToScheduleMode` on save ([settings/event/page.tsx:329](../../../app/[orgSlug]/admin/tournaments/settings/event/page.tsx#L329)). Change one without the other and they desync.

**Fields** (boilerplate `id`, `created_at` omitted — see snapshot):

<!-- dict:col:tournaments.org_id -->
**`org_id`** (FK → `organizations.id`, NOT NULL) — owning org. Renamed from `organization_id`; see gotcha 4. `organizations` has **no** `contact_email` (it's on `org_public_site_content`). _Reads/writes:_ [lib/db.ts:46](../../../lib/db.ts#L46), [:237](../../../lib/db.ts#L237), [:2482](../../../lib/db.ts#L2482), [register/route.ts:238](../../../app/api/register/route.ts#L238). _Dev/prod:_ identical.

<!-- dict:col:tournaments.year -->
**`year`** (int, NOT NULL) — season/edition year; sorts tournaments newest-first on public pages ([lib/public-tournament-data.ts:64](../../../lib/public-tournament-data.ts#L64)).

<!-- dict:col:tournaments.name -->
**`name`** (text, NOT NULL) — display name.

<!-- dict:col:tournaments.slug -->
**`slug`** — URL slug, matched against `tournamentSlug` in `getPublicContext` ([lib/public-tournament-data.ts:66](../../../lib/public-tournament-data.ts#L66)). **Dev/prod drift:** nullable (dev) vs NOT NULL (prod) — gotcha 3.

<!-- dict:col:tournaments.status -->
**`status`** (text, NOT NULL) — lifecycle `draft|active|completed|archived`. Only `active`+`completed` are public (`PUBLIC_STATUSES`, [lib/public-tournament-data.ts:38](../../../lib/public-tournament-data.ts#L38)). New rows insert `'draft'` ([lib/db.ts:241](../../../lib/db.ts#L241)). **Dev/prod drift:** default + CHECK differ — gotcha 2.

<!-- dict:col:tournaments.is_active -->
**`is_active`** (bool) — **legacy/redundant**; always written as `status==='active'`. `mapTournament` uses it only as a fallback when `status` is null ([lib/db.ts:2479](../../../lib/db.ts#L2479)). Treat `status` as authoritative.

<!-- dict:col:tournaments.start_date -->
<!-- dict:col:tournaments.end_date -->
**`start_date` / `end_date`** (date) — drive game-day/phase logic and public countdowns.

<!-- dict:col:tournaments.contact_email -->
**`contact_email`** — legacy/explicit organizer contact, still used as a **fallback** in the admin-notify chain (assigned member → default member → `contact_email` → footer → `ADMIN_EMAIL`) ([register/route.ts:485](../../../app/api/register/route.ts#L485)). Distinct from `org_public_site_content.contact_email`.

<!-- dict:col:tournaments.default_contact_member_id -->
**`default_contact_member_id`** (FK → `organization_members.id`) — default registration-notification recipient (contact refactor 088–090); resolved via `getMemberEmail` ([register/route.ts:310](../../../app/api/register/route.ts#L310)).

<!-- dict:col:tournaments.notify_mode -->
**`notify_mode`** (text, NOT NULL, default `'all'`; CHECK `all|assigned`) — routes admin reg-notify emails. `'all'` → always the tournament default contact; `'assigned'` → the division contact if set, else the default ([register/route.ts:482](../../../app/api/register/route.ts#L482)).

<!-- dict:col:tournaments.fee_schedule_mode -->
**`fee_schedule_mode`** (text, NOT NULL, default `'tournament'`; `tournament|division`) — selects tournament-level vs per-division fee fields in `resolveFeeSchedule` ([register/page.tsx:65](../../../app/[orgSlug]/[tournamentSlug]/register/page.tsx#L65)). Shadowed by `settings.fee_scope` — gotcha 5. `mapTournament` normalizes non-`'division'` → `'tournament'`.

<!-- dict:col:tournaments.deposit_amount -->
<!-- dict:col:tournaments.deposit_due_date -->
<!-- dict:col:tournaments.total_fee_amount -->
<!-- dict:col:tournaments.total_fee_due_date -->
**Tournament-level fee block** (`deposit_amount`, `deposit_due_date`, `total_fee_amount`, `total_fee_due_date`) — used when `fee_schedule_mode='tournament'` (or division has no fee). `resolveFeeSchedule` returns *no* fee panel when `total_fee_amount` is null ([register/page.tsx:75](../../../app/[orgSlug]/[tournamentSlug]/register/page.tsx#L75)). Mirrored by the same-named fields on `divisions`.

<!-- dict:col:tournaments.public_hidden_pages -->
**`public_hidden_pages`** (jsonb, NOT NULL, default `'[]'`) — array of **hidden** `PublicPageKey` (`news|schedule|standings|teams|rules|register`, [lib/public-pages.ts:4](../../../lib/public-pages.ts#L4)). **Dual purpose** — nav visibility (`isPublicPageEnabled`) **and** registration gate (gotcha 1). `normalizeHiddenPublicPages` filters to known keys. _Dev/prod:_ identical (both default `'[]'`).

<!-- dict:col:tournaments.settings -->
**`settings`** (jsonb, NOT NULL, default `'{}'`) — schema-less per-tournament prefs; new keys need no migration (add to `TournamentSettings`, [lib/types.ts:28](../../../lib/types.ts#L28)). Merge-patched via `updateTournamentSettings` (read-merge-write). **Key catalog:** `format` (`round_robin_playoffs|playoff_only`), `rulesLayout` (`columns|single`), `resourcesLayout` (`list|grid`), `game_duration_minutes` (default 90, read in `resolveGameTiming`), `buffer_minutes` (default 15), `schedule_travel_venue_buffer_minutes`, `schedule_travel_facility_buffer_minutes`, `game_timing_scope`, `tie_breakers`, `tie_breaker_scope`, `fee_scope` (incl. `'free'`; shadows `fee_schedule_mode`), `show_fees_on_register`, `payment_instructions`, `payment_instructions_on_form`. **Gotcha:** `playoff_game_duration_minutes` is **NOT** here anymore — removed by mig 112 in favor of per-game `games.duration_minutes`.

<!-- dict:col:tournaments.logo_url -->
<!-- dict:col:tournaments.hero_banner_url -->
<!-- dict:col:tournaments.theme_preset -->
<!-- dict:col:tournaments.theme_primary -->
<!-- dict:col:tournaments.theme_accent -->
<!-- dict:col:tournaments.theme_font -->
<!-- dict:col:tournaments.theme_card_style -->
<!-- dict:col:tournaments.color_mode -->
**Branding/theming block** (`logo_url`, `hero_banner_url`, `theme_preset`, `theme_primary`, `theme_accent`, `theme_font`, `theme_card_style`, `color_mode`) — public-page appearance overrides. `color_mode`: only `'light'` is honored; anything else → null (default dark) ([lib/db.ts:2503](../../../lib/db.ts#L2503)).

<!-- dict:col:tournaments.require_score_finalization -->
**`require_score_finalization`** (bool, nullable) — per-tournament override of the org score-finalization policy; cascades `tournament ?? org.require_score_finalization ?? false` ([lib/tournament-score-policy.ts:19](../../../lib/tournament-score-policy.ts#L19)).

<!-- dict:col:tournaments.notify_teams_on_complete -->
<!-- dict:col:tournaments.results_notified_at -->
<!-- dict:col:tournaments.results_notification_sent_count -->
**Results-notification block** — `notify_teams_on_complete` (bool) guards the completion email; `results_notified_at` (timestamptz) is the idempotency guard (checked before re-send); `results_notification_sent_count` (int) tallies recipients ([app/api/admin/tournaments/route.ts:87](../../../app/api/admin/tournaments/route.ts#L87), [:142](../../../app/api/admin/tournaments/route.ts#L142)).

---

## `divisions`
<!-- dict:table:divisions -->

**Purpose:** the renamed `age_groups` table — the **registration target**. A team registers *into* a division (`teams.division_id`). Divisions belong to a tournament and carry capacity, pools, a fee schedule, playoff config, schedule-publish state, and a JSONB `settings` override of tournament game timing.

**Gotchas (read first):**
1. **Renamed from `age_groups`, incompletely.** FK constraint is `age_groups_tournament_id_fkey` (dev) / `fk_age_groups_tournament` (prod); code vars are `g`/`ag`. Don't assume a clean rename across envs.
2. **`contact_id` was DROPPED → use `contact_member_id`** (FK `organization_members`). `contact_id` is absent from both snapshots; there's a dropped-column hole where it sat (ordinal **7 in dev, 6 in prod**).
3. **Four real dev/prod drift columns** — `display_order` (dev default 0 / prod no default, both NOT NULL → a raw insert omitting it **fails on prod**), `playoff_config` (prod has a default JSON, dev none — Finding #25), `pool_count` (prod default 1, dev none; code papers over with `|| 1`), `requires_pool_selection` (dev NOT NULL / prod nullable). Plus many columns differ only in **ordinal position** — never `SELECT *` on column order.
4. **`pool_names` is a comma-string, not JSON** — despite the plural; parsed `.split(',')`. The `pools` table is the real per-pool store.
5. **`schedule_visibility` is a 3-state enum, not a boolean** (`unpublished|published_teams|published_generic`).
6. **Division-level fees apply only when the parent's `fee_schedule_mode='division'`.**

**Fields** (boilerplate `id` omitted; this table has no `created_at`/`updated_at`):

<!-- dict:col:divisions.tournament_id -->
**`tournament_id`** (FK → `tournaments.id`, nullable in schema but always set) — register route rejects a division whose `tournament_id` ≠ requested tournament ([register/route.ts:254](../../../app/api/register/route.ts#L254)). _Dev/prod:_ FK name + ordinal differ (gotcha 1).

<!-- dict:col:divisions.name -->
**`name`** (text, NOT NULL) — e.g. "U12 AA".

<!-- dict:col:divisions.min_age -->
<!-- dict:col:divisions.max_age -->
**`min_age` / `max_age`** (int) — informational eligibility bounds.

<!-- dict:col:divisions.display_order -->
**`display_order`** (int, NOT NULL) — sort order in admin/public lists. **Dev/prod drift:** dev default 0, prod no default — gotcha 3.

<!-- dict:col:divisions.is_closed -->
**`is_closed`** (bool, NOT NULL, default false) — when true, registration for this division returns **403** ([register/route.ts:257](../../../app/api/register/route.ts#L257)).

<!-- dict:col:divisions.capacity -->
**`capacity`** (int, nullable; null/0 = uncapped) — when set and slots aren't pre-configured, register flips new teams to `'waitlist'` once accepted count ≥ capacity ([register/route.ts:339](../../../app/api/register/route.ts#L339)); also drives `syncSlots` (slots/pool = floor(capacity/pools)).

<!-- dict:col:divisions.pool_count -->
**`pool_count`** (int) — pools per division for round-robin. **Dev/prod drift:** prod default 1, dev none; code uses `poolCount || 1` ([lib/db.ts:1183](../../../lib/db.ts#L1183)).

<!-- dict:col:divisions.pool_names -->
**`pool_names`** (text) — **comma-separated** pool-name list (e.g. `"A,B,C"`), *not* JSON; blank → A,B,C… by char code (gotcha 4). The `pools` table is the source of truth.

<!-- dict:col:divisions.requires_pool_selection -->
**`requires_pool_selection`** (bool, default false) — registrant must pick a pool vs auto-assign. **Dev/prod drift:** dev NOT NULL / prod nullable (treat NULL as falsy).

<!-- dict:col:divisions.playoff_config -->
**`playoff_config`** (jsonb) — `{type, crossover, hasThirdPlace, teamsQualifying?}` for the bracket. **Two conflicting defaults:** prod column default omits `teamsQualifying`, but `saveDivision`'s write fallback adds `teamsQualifying:4` ([lib/db.ts:1185](../../../lib/db.ts#L1185)); dev has no column default. Consumers must not assume `teamsQualifying` exists. **Dev/prod drift:** Finding #25.

<!-- dict:col:divisions.deposit_amount -->
<!-- dict:col:divisions.deposit_due_date -->
<!-- dict:col:divisions.total_fee_amount -->
<!-- dict:col:divisions.total_fee_due_date -->
**Division-level fee block** — same four fields as `tournaments`, applied **only** when the parent's `fee_schedule_mode='division'` (gotcha 6); copy ops gate them behind `includeFeeSchedule` ([lib/db.ts:346](../../../lib/db.ts#L346)). Read by `lib/registration-attention.ts:165`.

<!-- dict:col:divisions.schedule_visibility -->
**`schedule_visibility`** (text, NOT NULL, default `'unpublished'`) — 3-state: `unpublished` (hidden) / `published_teams` (full) / `published_generic` (anonymized). Coach + public visibility needs `published_teams` OR `published_generic` ([coaches/tournaments/[teamId]/page.tsx:140](../../../app/coaches/tournaments/[teamId]/page.tsx#L140)). Gotcha 5.

<!-- dict:col:divisions.contact_member_id -->
**`contact_member_id`** (FK → `organization_members.id`) — per-division reg contact; **successor to the dropped `contact_id`** (gotcha 2). Resolved to an email only when the tournament's `notify_mode='assigned'` ([register/route.ts:311](../../../app/api/register/route.ts#L311)).

<!-- dict:col:divisions.settings -->
**`settings`** (jsonb, NOT NULL, default `'{}'`) — per-division **timing override** only: `{game_duration_minutes?, buffer_minutes?}` (`DivisionSettings`, [lib/types.ts:110](../../../lib/types.ts#L110)). Consumed by `resolveGameTiming` (division → tournament → default cascade, [lib/schedule-conflict.ts:55](../../../lib/schedule-conflict.ts#L55)). Not a general-purpose bag.

---

## `teams`
<!-- dict:table:teams -->

**Purpose:** **THE tournament registration unit** — one row per team registered into a division of a tournament (*not* a persistent rep/house-league team — those live elsewhere). Created by the public register flow, approved/managed by org admins, and used as the bracket/scheduling/check-in entity. `teams.id` is referred to throughout the app as the **"registration id."**

**Gotchas (read first):**
1. **`teams.players` (jsonb) was DROPPED (mig 111).** Confirmed absent from both snapshots; roster now lives in `tournament_roster_players` (FK `team_id`). **Two stale dead reads remain** via `select('*')` — [registrations/[id]/route.ts:125](../../../app/api/registrations/[id]/route.ts#L125) and [lib/db.ts:1262](../../../lib/db.ts#L1262) (`t.players || []`) — both now always resolve to `[]`. Do **not** reintroduce or trust this field.
2. **Coach-identity is NOT `teams.email ILIKE auth email`** — that wording (memory/older plans) is **stale** (superseded Tournament Coach Portal model). There is no `ILIKE` on `teams.email` anywhere. Register matches the signed-in coach by **exact lowercased equality** (`signedInCoach.email === email`, [register/route.ts:223](../../../app/api/register/route.ts#L223)); coach↔team linkage is a **row** in `basic_coach_team_registrations` (`tournament_team_id = teams.id`, [lib/basic-coach-teams.ts:376](../../../lib/basic-coach-teams.ts#L376)) — keyed on `teams.id`, not email.
3. **DB defaults ≠ what registration writes.** Column defaults are `status='accepted'`, `payment_status='paid'`, but the register route inserts `status='pending'`/`'waitlist'` and `payment_status='pending'` ([register/route.ts:352](../../../app/api/register/route.ts#L352)). A team is accepted only when an admin PATCHes it. The defaults are effectively vestigial for the registration path.
4. **Conflicting app-layer `payment_status` fallbacks** — `lib/db.ts:1264` coerces missing→`'paid'`, but [admin/teams/route.ts:67](../../../app/api/admin/teams/route.ts#L67) and the check-in route coerce missing→`'pending'`. Since prod allows NULL `payment_status`, the divergence is observable.
5. **Finding #25 drift on 4 columns** — `coach` (dev nullable / **prod NOT NULL** — a no-coach-name registration passes on dev, **fails on prod**), and `status`/`payment_status`/`registered_at` (dev NOT NULL / prod nullable). Defaults identical.
6. **`coach` stores a NAME, `email` stores the email.** Naming smell — `coach` is the display name (from form `coachName`), not a FK/email.
7. **`slot_id` and `waitlist_position` are mutually exclusive** states managed by the `claim_next_slot` RPC; rejecting a team releases the slot on **both** sides (`pool_slots.team_id` AND `teams.slot_id`).

**Fields** (boilerplate `id` = the "registration id"; omitted):

<!-- dict:col:teams.tournament_id -->
<!-- dict:col:teams.division_id -->
**`tournament_id`** (FK → `tournaments.id`) / **`division_id`** (FK → `divisions.id`) — both nullable in schema but always set; all capacity/waitlist/slot logic keys off `division_id`. _Dev/prod:_ FK **constraint names** differ (dev `teams_tournament_id_fkey` vs prod `fk_teams_tournament`; prod also carries `fk_teams_age_group` on `division_id`) — relationship identical (gotcha in code that hard-codes the dev alias).

<!-- dict:col:teams.name -->
**`name`** (text, NOT NULL) — team name; only NOT NULL business column. Drives duplicate detection per `(tournament_id, division_id)`.

<!-- dict:col:teams.coach -->
**`coach`** (text) — coach **display name** (gotcha 6). _Dev/prod drift:_ dev nullable / **prod NOT NULL** (gotcha 5).

<!-- dict:col:teams.email -->
**`email`** (text) — coach/contact email, **lowercased at insert** ([register/route.ts:202](../../../app/api/register/route.ts#L202)); the team-facing address for confirmation/acceptance/payment emails. **Not** the coach-identity key (gotcha 2).

<!-- dict:col:teams.status -->
**`status`** (text) — registration lifecycle: `pending | waitlist | accepted | rejected`. Drives capacity counting (`.neq('status','rejected')`), check-in eligibility (`.eq('status','accepted')`), slot release on reject. _Dev/prod drift:_ dev NOT NULL / prod nullable.

<!-- dict:col:teams.payment_status -->
**`payment_status`** (text) — `pending | paid`. Check-in `mark_paid` sets `'paid'` + stamps `payment_collected_at` and triggers a payment-confirmation email. See gotchas 3–5.

<!-- dict:col:teams.registered_at -->
**`registered_at`** (timestamptz, default now()) — set explicitly at insert. _Dev/prod drift:_ dev NOT NULL / prod nullable.

<!-- dict:col:teams.admin_notes -->
**`admin_notes`** (text) — internal organizer notes (registration-time; distinct from `check_in_notes`).

<!-- dict:col:teams.pool_id -->
**`pool_id`** (FK → `pools.id`, nullable) — assigned pool within the division (only when the division uses pools).

<!-- dict:col:teams.deposit_paid -->
<!-- dict:col:teams.total_paid -->
**`deposit_paid` / `total_paid`** (numeric, NOT NULL, default 0) — **manual** organizer accounting of money received (not Stripe-driven).

<!-- dict:col:teams.waitlist_position -->
**`waitlist_position`** (int, nullable; NULL = not waitlisted) — 1-based ordinal, computed `max(existing)+1` at register time; set alongside `status='waitlist'` (gotcha 7).

<!-- dict:col:teams.slot_id -->
**`slot_id`** (FK → `pool_slots.id`, nullable; NULL = unassigned/waitlisted) — slot the team occupies (slot-first scheduling). Claimed atomically via `claim_next_slot` RPC; mirrored by `pool_slots.team_id`; cleared on reject (gotcha 7).

<!-- dict:col:teams.check_in_status -->
**`check_in_status`** (text, NOT NULL, default `'not_arrived'`) — gate check-in (mig 110): `not_arrived | checked_in | no_show`. Set with the `checked_in_*` fields by the check-in route (`check_in`/`no_show`/`undo`).

<!-- dict:col:teams.checked_in_at -->
<!-- dict:col:teams.checked_in_by_user_id -->
<!-- dict:col:teams.checked_in_by_name -->
**Check-in actor block** (mig 110) — `checked_in_at` (timestamptz), `checked_in_by_user_id` (uuid, **no DB FK** — bare uuid of the acting user), `checked_in_by_name` (denormalized display name `full_name || email || 'Staff'`, shown without a join). Set/cleared together with `check_in_status` ([check-in/route.ts:154](../../../app/api/admin/check-in/route.ts#L154)).

<!-- dict:col:teams.roster_submitted_at -->
<!-- dict:col:teams.roster_confirmed_at -->
**`roster_submitted_at` / `roster_confirmed_at`** (timestamptz, mig 110) — gate-roster timestamps. The roster **rows** live in `tournament_roster_players`, not here ([check-in/route.ts:213](../../../app/api/admin/check-in/route.ts#L213)).

<!-- dict:col:teams.payment_collected_at -->
**`payment_collected_at`** (timestamptz, mig 110) — stamped when the `mark_paid` check-in action flips `payment_status='paid'`.

<!-- dict:col:teams.check_in_notes -->
**`check_in_notes`** (text, mig 110) — gate notes; distinct from `admin_notes`.

<!-- dict:col:teams.seed -->
**`seed`** (int, nullable, mig 113) — manual seed (1 = top), validated 1..999. Drives the Playoff Builder "By Seed #" ordering ([PlayoffWizard.tsx:162](../../../app/[orgSlug]/admin/tournaments/schedule/PlayoffWizard.tsx#L162)); the button only appears when some team has a numeric seed.

---

## `games`
<!-- dict:table:games -->

**Purpose:** one row per scheduled game (round-robin or playoff) — matchup, schedule slot (date/time/venue), live score/status, playoff bracket routing, and a score-submission audit trail. **No `created_at`/`updated_at`** on this table.

**Gotchas (read first):**
1. **Game length is per-game (mig 112).** `duration_minutes` is the override consumed by `resolveGameTiming(division, tournament, gameDurationOverride?)` ([lib/schedule-conflict.ts:43](../../../lib/schedule-conflict.ts#L43)) — override → `division.settings` → `tournament.settings` → 90. *(This branch (`ad9dc66`) wires the override in; the old tournament-level `playoff_game_duration_minutes` is gone — see the branch-drift note at the top.)*
2. **`bracket_id` vs `bracket_code` are different and easily conflated.** `bracket_id` (uuid) is a **grouping key**, **not a FK** (there is no `brackets` table) — it scopes advancement to one bracket tree (PlayoffWizard assigns each pool its own in no-crossover mode). `bracket_code` (text) is the **round/slot code** within it (`FIN`, `GF`, `GF2`, semifinal codes).
3. **Playoff advancement is literal string-matching.** `advancePlayoffs` fills a downstream slot whose `home_placeholder`/`away_placeholder` equals `'Winner '+bracket_code` or `'Loser '+bracket_code` ([lib/db.ts:1909](../../../lib/db.ts#L1909)). Placeholder text must match the convention exactly. `GF`/`GF2` are special-cased for the double-elim "if necessary" reset ([lib/db.ts:1924](../../../lib/db.ts#L1924)). Separately, a completed `FIN` game seals the tournament — that logic lives in [seal-tournament/route.ts:167](../../../app/api/admin/seal-tournament/route.ts#L167), **not** in `advancePlayoffs`.
4. **`diamond_id` ↔ `Game.venueId` naming mismatch** — the column is `diamond_id` (legacy softball term) but the app field is `venueId`. Easy to mis-map. Conflict detection prefers `venue_facility_id` (specific surface), then falls back to `diamond_id`.
5. **The slot system auto-fills teams.** `home_slot_id`/`away_slot_id` (FK `pool_slots`) → when a pool slot is (un)assigned, the API bulk-updates `home_team_id`/`away_team_id` for matching games. A game can hold a slot ref + a placeholder while team ids stay NULL until the pool is fully assigned.
6. **Dev/prod drift:** `location` (dev nullable / **prod NOT NULL**) and `is_playoff` (dev NOT NULL / prod nullable). FK constraint **names** differ (cosmetic). `game_time` text-vs-time drift is **resolved** (both `time without time zone` now).
7. **`score_submitted_at` is a domain audit timestamp, not a row-mtime** — it only moves when a score is written. The `score_submitted_*` fields are written *only* via `updateGame`/the scoring service, never in the insert.

**Fields** (boilerplate `id` omitted):

<!-- dict:col:games.tournament_id -->
<!-- dict:col:games.division_id -->
**`tournament_id`** (FK → `tournaments.id`) / **`division_id`** (FK → `divisions.id`) — scope + standings grouping + timing inheritance. _Dev/prod:_ FK constraint names differ; dev has a legacy `games_age_group_id_fkey`.

<!-- dict:col:games.home_team_id -->
<!-- dict:col:games.away_team_id -->
**`home_team_id` / `away_team_id`** (FK → `teams.id`, nullable) — may be null until a slot/placeholder resolves (pool seeding or `advancePlayoffs` fills them). Populated by pool-slot promotion ([pool-slots/route.ts:248](../../../app/api/admin/pool-slots/route.ts#L248)).

<!-- dict:col:games.game_date -->
<!-- dict:col:games.game_time -->
**`game_date`** (date) / **`game_time`** (time) — schedule slot. `game_time` mapped to a `'HH:MM'` string; primary sort is `game_date, game_time`. _Dev/prod:_ aligned (the historical `game_time` text drift is resolved).

<!-- dict:col:games.duration_minutes -->
**`duration_minutes`** (int, nullable, mig 112) — per-game length override; null/0 → cascade. Write paths clamp 1..600 ([games/route.ts:429](../../../app/api/admin/games/route.ts#L429)). The override consumed by `resolveGameTiming` (gotcha 1).

<!-- dict:col:games.location -->
**`location`** (text) — free-text venue display fallback when no structured venue is set (then conflict detection skips — nothing to clash on). _Dev/prod drift:_ dev nullable / **prod NOT NULL** (gotcha 6).

<!-- dict:col:games.diamond_id -->
<!-- dict:col:games.venue_facility_id -->
<!-- dict:col:games.schedule_facility_lane_id -->
**Venue block** — `diamond_id` (FK → `diamonds.id`) = the managed Venue (mapped to `Game.venueId`, gotcha 4); `venue_facility_id` (FK → `venue_facilities.id`) = the specific surface, **preferred** for conflict matching; `schedule_facility_lane_id` (FK → `schedule_facility_lanes.id`) = a **temporary** generation lane while the real venue is TBD, cleared on finalize.

<!-- dict:col:games.home_score -->
<!-- dict:col:games.away_score -->
**`home_score` / `away_score`** (int, nullable until submitted) — setting both + `status='completed'` triggers `advancePlayoffs`.

<!-- dict:col:games.status -->
**`status`** (text, NOT NULL, default `'scheduled'`) — `scheduled | submitted | completed | cancelled` (`GameStatus`, [lib/types.ts:451](../../../lib/types.ts#L451); app-level enum, no DB CHECK). Advancement runs only when `completed`.

<!-- dict:col:games.is_playoff -->
**`is_playoff`** (bool, default false) — playoff vs round-robin; gates Winner/Loser routing. _Dev/prod drift:_ dev NOT NULL / prod nullable (gotcha 6).

<!-- dict:col:games.bracket_id -->
<!-- dict:col:games.bracket_code -->
**`bracket_id`** (uuid, **not a FK**) / **`bracket_code`** (text) — bracket-tree grouping key + round/slot code (gotchas 2–3).

<!-- dict:col:games.home_placeholder -->
<!-- dict:col:games.away_placeholder -->
**`home_placeholder` / `away_placeholder`** (text) — human seed/source labels for unresolved bracket slots (`'Winner FIN'`, `'Pool A #1'`); string-matched by `advancePlayoffs` to fill team ids (gotcha 3).

<!-- dict:col:games.home_slot_id -->
<!-- dict:col:games.away_slot_id -->
**`home_slot_id` / `away_slot_id`** (FK → `pool_slots.id`) — slot-based auto-fill (gotcha 5).

<!-- dict:col:games.notes -->
**`notes`** (text) — free-text admin note; no logic depends on it.

<!-- dict:col:games.generator_locked -->
**`generator_locked`** (bool, NOT NULL, default false) — locks a game against the auto-schedule generator (manual edits preserved on regenerate).

<!-- dict:col:games.score_submitted_by_user_id -->
<!-- dict:col:games.score_submitted_by_email -->
<!-- dict:col:games.score_submitted_at -->
<!-- dict:col:games.score_submission_source -->
**Score-submission audit block** — who/when/how a score was entered, written only via the scoring service ([lib/tournament-scoring-service.ts:121](../../../lib/tournament-scoring-service.ts#L121)) and cleared on revert. `score_submission_source` ∈ `scorekeeper | admin_results | system` (`ScoreSubmissionSource`, [lib/types.ts:452](../../../lib/types.ts#L452); app enum, no DB CHECK). Not a generic row-mtime (gotcha 7).

---

## `pools`
<!-- dict:table:pools -->

**Purpose:** a pool (group) within a division for pool/group play; teams are split across pools and the schedule is built per-pool. Parent of `pool_slots`.

**Gotchas (read first):**
1. **The prompt's old `pools` drift is resolved** — `display_order` and `created_at` are now **identical** dev↔prod (migration 081 reconciled both; no `pools` entries in the drift report). Don't present them as live drift.
2. **`pools.settings` (jsonb) is a dead column** — declared (`Pool.settings`, [lib/types.ts:347](../../../lib/types.ts#L347)) and present in schema, but **no code reads/writes it**. The `settings` writes in `divisions/route.ts` belong to the *division*, not a pool.
3. **`division_id` is the only parent** — a pool's tournament is reached transitively via the division. A single-pool division may have **no** `pools` row (creation gated on `poolCount >= 2`).

**Fields** (boilerplate `id`, `created_at` omitted):

<!-- dict:col:pools.division_id -->
**`division_id`** (FK → `divisions.id`, NOT NULL) — the owning division (gotcha 3).

<!-- dict:col:pools.name -->
**`name`** (text, NOT NULL) — pool label (`'A'`, `'B'`, …); default-generated `A,B,C…` by char code; feeds `pool_slots.display_name` as a prefix.

<!-- dict:col:pools.display_order -->
**`display_order`** (int, NOT NULL, default 0) — sort order within the division (written as the loop index). _Dev/prod:_ identical (gotcha 1).

<!-- dict:col:pools.settings -->
**`settings`** (jsonb, NOT NULL, default `'{}'`) — **dead/reserved** (gotcha 2).

---

## `pool_slots`
<!-- dict:table:pool_slots -->

**Purpose:** named team placeholders within a pool ("Pool A Team 1"). The **slot system** lets the schedule reference a position before real teams are known: `games.home_slot_id`/`away_slot_id` and `teams.slot_id` all point at `pool_slots.id`, and a slot's `team_id` resolves to a real team after registration.

**Gotchas (read first):**
1. **`pool_slots.id` is the load-bearing key of slot-first scheduling.** When assigning a team fills the **last empty slot in a pool**, the API bulk-updates every game in that pool (`home_team_id := slot.team_id WHERE home_slot_id = slot.id`, and away). Unassign/swap clears all of that pool's game team ids, reverting the public view to placeholder names ([pool-slots/route.ts:241](../../../app/api/admin/pool-slots/route.ts#L241)).
2. **`tournament_id` + `division_id` are DENORMALIZED** (both NOT NULL) — derivable via `pool_id → pools.division_id → divisions.tournament_id` but stored directly for scope-guards and the `?divisionId` filter. All three insert paths set them; inconsistency makes scope guards lie.
3. **The team↔slot link is bidirectional — write BOTH sides.** Assigning sets `pool_slots.team_id` AND `teams.slot_id`; clearing clears both. The teams API maintains both ([admin/teams/route.ts:164](../../../app/api/admin/teams/route.ts#L164)); the pool-slots API touches only `pool_slots.team_id` — watch for drift if you call only one.
4. **Capacity sync never deletes a *filled* slot** — only empty slots above the new count are pruned; filled over-capacity slots are kept with a warning.
5. **mig 041's column name `age_group_id` is stale** — the live column is `division_id` (renamed by mig 093). Trust the snapshot.

**Fields** (boilerplate `id`, `created_at` omitted):

<!-- dict:col:pool_slots.pool_id -->
**`pool_id`** (FK → `pools.id` ON DELETE CASCADE, NOT NULL) — owning pool; all slot bookkeeping is scoped by it. `UNIQUE(pool_id, slot_number)`.

<!-- dict:col:pool_slots.tournament_id -->
<!-- dict:col:pool_slots.division_id -->
**`tournament_id` / `division_id`** (FK, NOT NULL) — denormalized scope keys (gotcha 2).

<!-- dict:col:pool_slots.slot_number -->
**`slot_number`** (int, NOT NULL) — 1-based ordinal within the pool; drives `display_name`, capacity sync, ordering. `UNIQUE(pool_id, slot_number)`.

<!-- dict:col:pool_slots.display_name -->
**`display_name`** (text, NOT NULL) — placeholder text shown before a real team is assigned (`'A Team 1'`); on rename, cascades to `games.home_placeholder`/`away_placeholder` for games pointing at this slot.

<!-- dict:col:pool_slots.team_id -->
**`team_id`** (FK → `teams.id` ON DELETE SET NULL, nullable; NULL = placeholder) — the resolution link; mirrored by `teams.slot_id` (gotcha 3). A pool with zero NULL `team_id` slots triggers the games cascade.

---

## `rules` + `rule_items`
<!-- dict:table:rules -->
<!-- dict:table:rule_items -->

**Purpose:** the public rules-page content. `rules` = one card per section (icon + title); `rule_items` = the bullet lines under each card (parent `rule_id`). Loaded via the nested select `rules.select('*, rule_items(*)')`.

**Gotchas (read first):**
1. **`created_at` is MISSING from dev on BOTH tables** (present in prod — Finding #25). Any query that explicitly selects/orders by it works on prod and **errors on dev**. The app never touches it (`select('*')` + order by `display_order`), so it's gone unnoticed — but don't rely on it against dev.
2. **Layout is NOT a column here** — it lives in `tournaments.settings.rulesLayout` (`columns|single`) and `resourcesLayout`, read on the public page ([rules/page.tsx:86](../../../app/[orgSlug]/[tournamentSlug]/rules/page.tsx#L86)).
3. **`rules.icon` stores a Lucide key string, not a path**; null/empty/unknown all degrade to `'Shield'` ([rules/page.tsx:129](../../../app/[orgSlug]/[tournamentSlug]/rules/page.tsx#L129)). _Dev/prod:_ prod column defaults to `'Shield'`, dev has no default — UI identical, raw values differ.
4. **More Finding-#25 drift:** `id` default fn (`gen_random_uuid()` dev / `uuid_generate_v4()` prod) on both tables; `display_order` NOT NULL (dev) / nullable (prod); `rule_items.rule_id` NOT NULL (dev) / nullable (prod) — an orphan item is possible on prod, so defend against null `rule_id` and null `display_order` (the JS `a.order - b.order` re-sort yields NaN on null).

**`rules` fields** (boilerplate `id` omitted):

<!-- dict:col:rules.tournament_id -->
**`tournament_id`** (FK → `tournaments.id`) — scope. _Dev/prod:_ FK name differs (cosmetic).

<!-- dict:col:rules.title -->
**`title`** (text, NOT NULL) — section heading (card `<h2>`).

<!-- dict:col:rules.icon -->
**`icon`** (text) — Lucide key (gotcha 3).

<!-- dict:col:rules.display_order -->
**`display_order`** (int, default 0) — card sort order. _Dev/prod drift:_ NOT NULL (dev) / nullable (prod).

<!-- dict:col:rules.division_ids -->
**`division_ids`** (`uuid[]`, nullable) — optional division-targeting; when set, the section shows only to viewers whose preferred division matches (untagged always shows). Written null when empty. (Tournament Plus targeting feature.)

<!-- dict:col:rules.created_at -->
**`created_at`** (timestamptz, **prod only**) — see gotcha 1; no code reads/writes it.

**`rule_items` fields** (boilerplate `id` omitted):

<!-- dict:col:rule_items.rule_id -->
**`rule_id`** (→ parent `rules.id`) — bulk ops use `.in('rule_id', …)`. **No `tournament_id`** — scope only via the parent. _Dev/prod drift:_ NOT NULL (dev) / nullable (prod) — orphans possible on prod (gotcha 4).

<!-- dict:col:rule_items.content -->
**`content`** (text, NOT NULL) — the bullet text (`<li>`).

<!-- dict:col:rule_items.display_order -->
**`display_order`** (int, default 0) — order within the section; also re-sorted client-side. _Dev/prod drift:_ NOT NULL (dev) / nullable (prod).

<!-- dict:col:rule_items.created_at -->
**`created_at`** (timestamptz, **prod only**) — gotcha 1.

---

## `resources`
<!-- dict:table:resources -->

**Purpose:** the Downloads & Resources links (label + URL) on a tournament's public rules page. Files may be uploaded to the Supabase **`resources` storage bucket** and the public URL stored here.

**Gotchas (read first):**
1. **`created_at` is MISSING from dev** (prod only — same dev-behind-prod gap as `rules`).
2. **`url` is dual-purpose via a magic substring.** No boolean distinguishes an uploaded file from an external link — the code sniffs the literal `'supabase.co'` in `url`: matches → downloadable (appends `?download=`) and **deleting the row also deletes the storage object**; otherwise → external link (new tab). A self-hosted Supabase domain would break both ([lib/db.ts:2154](../../../lib/db.ts#L2154)).
3. **Name overload:** there's both a `resources` *table* and a `resources` *storage bucket*, coupled only by `url` string-matching (no FK).
4. **Layout** is in `tournaments.settings.resourcesLayout` (`list|grid`), not a column. Plus `id` default-fn and `display_order` nullability drift (Finding #25).

**Fields** (boilerplate `id` omitted):

<!-- dict:col:resources.tournament_id -->
**`tournament_id`** (FK → `tournaments.id`) — scope.

<!-- dict:col:resources.label -->
**`label`** (text, NOT NULL) — link display text (also the download filename for hosted files).

<!-- dict:col:resources.url -->
**`url`** (text, NOT NULL) — link target with magic-substring routing + storage side-effect (gotcha 2).

<!-- dict:col:resources.display_order -->
**`display_order`** (int, default 0) — list order. _Dev/prod drift:_ NOT NULL (dev) / nullable (prod).

<!-- dict:col:resources.created_at -->
**`created_at`** (timestamptz, **prod only**) — gotcha 1.

---

## `announcements`
<!-- dict:table:announcements -->

**Purpose:** **one table, two products** — public News posts **and** outbound email communications, distinguished by `channel_site`/`channel_email`. Soft-deletable.

**Gotchas (read first):**
1. **Public reads MUST filter `channel_site = true` AND `deleted_at IS NULL`.** Email-only rows (`channel_site=false`) are admin-internal — forgetting either filter leaks internal comms ([lib/db.ts:1732](../../../lib/db.ts#L1732)).
2. **Three different timestamps** — `published_at` (post date, drives ordering, surfaced as the app's `createdAt`), `email_sent_at` (when the blast actually went out, only on emailed rows), and `created_at`. Don't conflate.
3. **`email_*` counters are written in a SECOND update**, after the insert + send. If the process dies mid-send, the row exists with **null** counters — a null counter ≠ zero recipients.
4. **`email_targeting` JSONB has dead keys** — `includeContacts`/`contactRoles` are no-ops (the `contacts` table was removed); only teams are resolved. Advanced targeting is a Tournament Plus gate.
5. **Dev/prod drift:** `published_at` (dev default `now()` / **prod no default**, both NOT NULL) and `body` (dev nullable / **prod NOT NULL**) — a DB-direct insert omitting either passes on dev, fails on prod. `lib/db.ts saveAnnouncement` doesn't validate `body` (the comms API does). `id` default does **not** drift here (both `gen_random_uuid()`).
6. **Two delete semantics** — the comms API soft-deletes (sets `deleted_at`, unpins); `lib/db.ts deleteAnnouncement` **hard**-deletes.

**Fields** (boilerplate `id` omitted):

<!-- dict:col:announcements.tournament_id -->
**`tournament_id`** (FK → `tournaments.id`) — scope. _Dev/prod:_ FK name differs (cosmetic).

<!-- dict:col:announcements.title -->
**`title`** (text, NOT NULL) — post title / email subject. **`'Welcome!'` is a magic value** — the auto-seeded welcome post cloned with a tournament.

<!-- dict:col:announcements.body -->
**`body`** (text) — post/email content. _Dev/prod drift:_ dev nullable / prod NOT NULL (gotcha 5).

<!-- dict:col:announcements.published_at -->
**`published_at`** (timestamptz, NOT NULL) — post date; primary sort (after `pinned`). _Dev/prod drift:_ default differs (gotcha 5).

<!-- dict:col:announcements.pinned -->
**`pinned`** (bool, NOT NULL, default false) — pins to top of public News; soft-delete force-sets false.

<!-- dict:col:announcements.division_ids -->
**`division_ids`** (`uuid[]`, nullable) — optional division-targeting (Tournament Plus `targeted_tournament_announcements`); null when empty.

<!-- dict:col:announcements.channel_site -->
<!-- dict:col:announcements.channel_email -->
**`channel_site`** (bool, NOT NULL, default true) / **`channel_email`** (bool, NOT NULL, default false) — the two channels; at least one must be true (API-enforced). `channel_email=true` triggers the email send + counters (gotcha 1).

<!-- dict:col:announcements.email_targeting -->
**`email_targeting`** (jsonb, nullable) — `RecipientTargeting`: `{includeTeams, includeContacts, teamStatuses[], paymentStatuses[], divisionIds[], teamIds[], contactRoles[]}`; resolved against `teams`. Dead keys per gotcha 4. Set only when `channel_email`.

<!-- dict:col:announcements.email_recipient_count -->
<!-- dict:col:announcements.email_success_count -->
<!-- dict:col:announcements.email_failed_count -->
<!-- dict:col:announcements.email_failed_addresses -->
<!-- dict:col:announcements.email_sent_at -->
**Email-send result block** — `email_recipient_count` / `email_success_count` / `email_failed_count` (int, nullable), `email_failed_addresses` (`text[]`), `email_sent_at` (timestamptz) — written in the post-send update (gotcha 3). `recipient = success + failed`.

<!-- dict:col:announcements.sent_by_email -->
**`sent_by_email`** (text) — email of the admin who sent it (audit; not a FK).

<!-- dict:col:announcements.deleted_at -->
**`deleted_at`** (timestamptz, nullable; mig 098) — soft-delete marker; public reads filter `IS NULL`. `delete` sets it (+ unpins); `restore` clears it (gotcha 6).

---

## `tournament_registration_fields`
<!-- dict:table:tournament_registration_fields -->

**Purpose:** organizer-defined **custom registration questions** (Tournament Plus) — one row per question, typed, ordered, optionally required.

**Gotchas (read first):**
1. **`field_type` is a CHECK-enum text column (5 values), mirrored in code, not a Postgres enum** — `short_text | long_text | dropdown | checkbox | file` (mig 056). The TS union + `FIELD_TYPES` Set must stay in lockstep with the DB CHECK ([lib/types.ts:419](../../../lib/types.ts#L419)).
2. **`options` is `[]` for everything except `dropdown`** — only dropdown carries choices; always run through `normalizeRegistrationFieldOptions`.
3. **`is_archived` is a soft delete** — fields are archived (not deleted) so historical answers stay valid; default reads hide archived.
4. **`updated_at` is app-maintained, not trigger-maintained** — every update/archive/reorder explicitly sets it; a raw SQL UPDATE that forgets it leaves it stale.
5. **Plan-gated read** — the public form only loads fields when `hasPlanFeature(org.planId, 'custom_registration_fields')`; an empty array can mean "no questions" *or* "plan lacks the feature" ([lib/public-tournament-data.ts:159](../../../lib/public-tournament-data.ts#L159)).
6. _Dev/prod:_ byte-identical (no drift). RLS enabled but all app access is service-role.

**Fields** (boilerplate `id`, `created_at`, `updated_at` omitted — note `updated_at` is app-maintained, gotcha 4):

<!-- dict:col:tournament_registration_fields.tournament_id -->
<!-- dict:col:tournament_registration_fields.org_id -->
**`tournament_id`** (FK → `tournaments.id` ON DELETE CASCADE, NOT NULL) / **`org_id`** (FK → `organizations.id`, NOT NULL) — scope; `org_id` is denormalized and drives the RLS read policy. Composite index `(tournament_id, is_archived, sort_order)`.

<!-- dict:col:tournament_registration_fields.label -->
**`label`** (text, NOT NULL) — the question text (trimmed).

<!-- dict:col:tournament_registration_fields.field_type -->
**`field_type`** (text, NOT NULL, CHECK 5 values) — input type; controls render, validation, and which answer slot is used (gotcha 1).

<!-- dict:col:tournament_registration_fields.options -->
**`options`** (jsonb, NOT NULL, default `'[]'`) — dropdown choices only (gotcha 2); validated against the submitted value.

<!-- dict:col:tournament_registration_fields.required -->
**`required`** (bool, NOT NULL, default false) — enforced server-side in `validateCustomAnswers` + HTML `required`.

<!-- dict:col:tournament_registration_fields.sort_order -->
**`sort_order`** (int, NOT NULL, default 0) — display order (then `created_at`).

<!-- dict:col:tournament_registration_fields.is_archived -->
**`is_archived`** (bool, NOT NULL, default false) — soft delete (gotcha 3).

---

## `tournament_registration_field_answers`
<!-- dict:table:tournament_registration_field_answers -->

**Purpose:** one row per (registration × custom field) answer, stored in one of three typed slots.

**Gotchas (read first):**
1. **`registration_id` is a `teams.id`** — "registration" = a row in `teams` (there is **no** `registrations` table). FK → `teams.id` ON DELETE CASCADE; part of `UNIQUE(registration_id, field_id)`.
2. **Three mutually-exclusive value slots keyed by `field_type`** — text types → `value_text`; checkbox → `value_json` `{checked:bool}`; file → `file_url`. Admin display coalesces `file_url ?? value_text ?? (value_json.checked ? 'Yes':'No')`.
3. **`file_url` holds a STORAGE PATH, not a URL** — a private `tournament-registration-files` bucket object path; must be signed before viewing. Don't render directly as `href`.
4. **Answers are UPSERTed on `(registration_id, field_id)`** — re-submitting overwrites; no `updated_at`.
5. **Empty/blank answers are never written** — absence of a row means "left blank"; don't assume every field has a row per registration.

**Fields** (boilerplate `id`, `created_at` omitted):

<!-- dict:col:tournament_registration_field_answers.registration_id -->
**`registration_id`** (FK → `teams.id`, NOT NULL) — the team (gotcha 1).

<!-- dict:col:tournament_registration_field_answers.field_id -->
**`field_id`** (FK → `tournament_registration_fields.id` ON DELETE CASCADE, NOT NULL) — the question; joined back for label/type. Answers whose field is missing are skipped.

<!-- dict:col:tournament_registration_field_answers.value_text -->
<!-- dict:col:tournament_registration_field_answers.value_json -->
<!-- dict:col:tournament_registration_field_answers.file_url -->
**Value slots** — `value_text` (short/long/dropdown), `value_json` (`{checked}` for checkbox), `file_url` (storage path for file). Mutually exclusive (gotchas 2–3).

---

## Venues & scheduling

> A candidate to split into its own domain later. The **venue table is named `diamonds`** (softball legacy) — there is **no `venues` table**. `games` reference `diamond_id` (venue) / `venue_facility_id` (surface) / `schedule_facility_lane_id` (temporary lane). The org-level **library** (`org_venues` + `org_venue_facilities`, League/Club only) is a **one-time copy source** for per-tournament `diamonds`/`venue_facilities` — edits don't propagate either way.

### `diamonds`
<!-- dict:table:diamonds -->

**Purpose:** the (legacy-named) tournament-scoped **VENUE** record — a ballpark/site that games physically reference. Each row maps to a "venue" object throughout the code.

**Gotchas:** (1) **`diamonds` IS the venue table** — don't look for a `venues` table; `venue_facilities.venue_id` and `games.diamond_id` both point here. (2) **`address` drift** — dev nullable / **prod NOT NULL**; a no-address venue saves on dev, fails on prod. (3) Deleting a `diamonds` row **cascade-deletes** its `venue_facilities`. (4) `source_org_venue_id` is a one-time provenance stamp, **not** a live link.

**Fields** (boilerplate `id` omitted):

<!-- dict:col:diamonds.tournament_id -->
**`tournament_id`** (FK → `tournaments.id`, nullable in schema but always set) — owner. _Dev/prod:_ FK name differs.

<!-- dict:col:diamonds.name -->
**`name`** (text, NOT NULL) — venue display name; composed into `games.location` as `${venue.name} - ${facility.name}`.

<!-- dict:col:diamonds.address -->
**`address`** (text) — street address. _Dev/prod drift:_ dev nullable / **prod NOT NULL** (gotcha 2).

<!-- dict:col:diamonds.notes -->
**`notes`** (text) — admin notes.

<!-- dict:col:diamonds.source_org_venue_id -->
**`source_org_venue_id`** (FK → `org_venues.id`, nullable) — provenance stamp from import-from-org; not copied by clone/import-from-past (gotcha 4).

### `venue_facilities`
<!-- dict:table:venue_facilities -->

**Purpose:** tournament-attached **surfaces** within a venue (Diamond 1, Court A) — what schedule lanes resolve to and what `games.venue_facility_id` pins.

**Gotchas:** (1) **`venue_id` → `diamonds.id`** (ON DELETE CASCADE), not a `venues` table. (2) **`settings` jsonb is a DEAD column** — declared as per-facility timing overrides but **nothing reads/writes it**; the mappers strip it. Game timing comes from `resolveGameTiming` (per-game → division → tournament), never facility settings. (3) `tournament_id` is denormalized (must agree with the parent venue). (4) The legacy `save` action auto-creates one default facility; the newer `save-venue` does not.

**Fields** (boilerplate `id`, `created_at` omitted):

<!-- dict:col:venue_facilities.venue_id -->
**`venue_id`** (FK → `diamonds.id` ON DELETE CASCADE, NOT NULL) — parent venue (gotcha 1).

<!-- dict:col:venue_facilities.tournament_id -->
**`tournament_id`** (FK → `tournaments.id`, NOT NULL) — denormalized scope (gotcha 3).

<!-- dict:col:venue_facilities.name -->
**`name`** (text, NOT NULL) — facility label (e.g. "Diamond 1").

<!-- dict:col:venue_facilities.facility_type -->
**`facility_type`** (text, NOT NULL, default `'other'`) — `diamond|field|court|rink|gym|other` (`FacilityType`, [lib/types.ts:200](../../../lib/types.ts#L200)); enforced by a DB CHECK constraint (mig 095, `venue_facilities_facility_type_check` — and the matching one on `org_venue_facilities`, mig 094).

<!-- dict:col:venue_facilities.display_order -->
**`display_order`** (int, NOT NULL, default 0) — sort within the venue.

<!-- dict:col:venue_facilities.notes -->
**`notes`** (text) — facility notes.

<!-- dict:col:venue_facilities.source_org_facility_id -->
**`source_org_facility_id`** (FK → `org_venue_facilities.id`, nullable) — import-from-org provenance stamp.

<!-- dict:col:venue_facilities.settings -->
**`settings`** (jsonb, NOT NULL, default `'{}'`) — **DEAD/unwired** (gotcha 2).

### `org_venues` + `org_venue_facilities`
<!-- dict:table:org_venues -->
<!-- dict:table:org_venue_facilities -->

**Purpose:** the **org-level venue library** (reusable masters), **League/Club plan only**. Copied into per-tournament `diamonds`/`venue_facilities` via import-from-org (one-time stamp).

**Gotchas:** (1) **One-time copy source, not a live link** — editing the library doesn't update tournament copies. (2) **League/Club gate** — both GET/POST reject `tournament`/`tournament_plus` orgs. (3) `org_venues.is_active` is written true but the **live GET route doesn't filter on it** (only a dead `getOrgVenues` helper does); delete is **hard** (the "mark inactive" is only a comment). (4) `updated_at` on `org_venues` is **not** maintained (stays = `created_at`). (5) **Asymmetry:** `org_venue_facilities` has **no `settings` column** (8 cols) vs `venue_facilities` (10 cols) — don't assume library/tournament symmetry.

**`org_venues` fields** (boilerplate `id`, `created_at`, `updated_at` omitted):

<!-- dict:col:org_venues.org_id -->
**`org_id`** (FK → `organizations.id`, NOT NULL) — tenant scope; drives ownership guards.

<!-- dict:col:org_venues.name -->
<!-- dict:col:org_venues.address -->
<!-- dict:col:org_venues.notes -->
**`name`** (NOT NULL) / **`address`** / **`notes`** — copied to `diamonds.*` on import.

<!-- dict:col:org_venues.is_active -->
**`is_active`** (bool, NOT NULL, default true) — written but unused as a filter (gotcha 3).

**`org_venue_facilities` fields** (boilerplate `id`, `created_at` omitted):

<!-- dict:col:org_venue_facilities.org_venue_id -->
**`org_venue_id`** (FK → `org_venues.id` ON DELETE CASCADE, NOT NULL) — parent library venue.

<!-- dict:col:org_venue_facilities.org_id -->
**`org_id`** (FK → `organizations.id`, NOT NULL) — doubly-denormalized tenant scope.

<!-- dict:col:org_venue_facilities.name -->
<!-- dict:col:org_venue_facilities.facility_type -->
<!-- dict:col:org_venue_facilities.display_order -->
<!-- dict:col:org_venue_facilities.notes -->
**`name`** (NOT NULL) / **`facility_type`** (default `'other'`) / **`display_order`** / **`notes`** — copied to `venue_facilities.*` on import.

### `schedule_facility_lanes`
<!-- dict:table:schedule_facility_lanes -->

**Purpose:** **temporary** scheduling lanes ("Field 1/2" per division) that the auto-scheduler generates games against **before** real venues exist, then **resolves** to a concrete venue + facility — back-filling `games.diamond_id`/`venue_facility_id`/`location`.

**Gotchas:** (1) **Staging layer** — the `resolve` action maps each lane to a `diamonds` venue (+ optional facility) and bulk-updates every game on the lane (`location = ${venue.name} - ${facility.name}`, falling back to the lane `label`). (2) `UNIQUE(tournament_id, division_id, label)` — `ensure` is idempotent (swallows 23505). (3) **Table-missing is handled gracefully** (error 42P01 → `[]`/clear message) — some envs may lack it. (4) `resolve` rejects (403) a facility/venue from a different tournament. (5) `updated_at` **is** code-maintained here (set on resolve).

**Fields** (boilerplate `id`, `created_at` omitted):

<!-- dict:col:schedule_facility_lanes.tournament_id -->
<!-- dict:col:schedule_facility_lanes.division_id -->
**`tournament_id`** (FK, NOT NULL) / **`division_id`** (FK, NOT NULL) — lanes are per-division. Part of the UNIQUE.

<!-- dict:col:schedule_facility_lanes.label -->
**`label`** (text, NOT NULL) — lane name ("Field 1"); also the `games.location` fallback while unresolved.

<!-- dict:col:schedule_facility_lanes.sort_order -->
**`sort_order`** (int, NOT NULL, default 0) — display order.

<!-- dict:col:schedule_facility_lanes.resolved_venue_id -->
<!-- dict:col:schedule_facility_lanes.resolved_venue_facility_id -->
**`resolved_venue_id`** (FK → `diamonds.id`) / **`resolved_venue_facility_id`** (FK → `venue_facilities.id`) — the concrete mapping (null while abstract); propagated to the matching games (gotcha 1).

<!-- dict:col:schedule_facility_lanes.updated_at -->
**`updated_at`** (timestamptz, NOT NULL) — set to now() on resolve (gotcha 5).

---

## `tournament_archives`
<!-- dict:table:tournament_archives -->

**Purpose:** an **immutable, sealed end-of-tournament snapshot** — a self-contained JSONB capture (tournament + divisions/pools + accepted teams + games) at seal time, plus denormalized champion/runner-up/totals and a sha256 integrity hash. Tournament-Plus `sealed_archives`. Written only by the seal route; **clone does NOT use it**.

**Gotchas (read first):**
1. **`tournament_id` is nullable + PARTIAL UNIQUE** (`WHERE tournament_id IS NOT NULL`) — at most one archive per live tournament, but `tournament_id` can null out when the source tournament is deleted (the archive is the durable record; `org_id`, `tournament_name`, `season`, etc. are denormalized for exactly this).
2. **`cloneTournament` does NOT read this table** — clone reads the *live* tables. `tournament_archives` is written only by `seal-tournament` and read only by the archives list/detail.
3. **Snapshot is point-in-time + filtered** — `final_snapshot` includes only **accepted** teams; `total_games` counts only completed/submitted; champion/runner-up derive solely from the completed FINAL game (`is_playoff && bracket_code='FIN'`) — null if none, even if standings imply a leader.
4. **Asymmetry:** there's a `winner_team_id` (FK) **and** name, but only a `runner_up_name` (no `runner_up_team_id`).
5. **Seal gate:** capability `seal_tournaments` + plan feature `sealed_archives` + status `completed|archived`.

**Fields** (boilerplate `id` omitted):

<!-- dict:col:tournament_archives.tournament_id -->
**`tournament_id`** (FK → `tournaments.id`, nullable) — source (gotcha 1).

<!-- dict:col:tournament_archives.org_id -->
**`org_id`** (FK → `organizations.id`, NOT NULL) — durable tenant scope (survives tournament deletion).

<!-- dict:col:tournament_archives.tournament_name -->
<!-- dict:col:tournament_archives.season -->
<!-- dict:col:tournament_archives.division -->
**`tournament_name`** (NOT NULL) / **`season`** (NOT NULL, `String(year)`) / **`division`** (comma-joined division names, nullable) — denormalized snapshots for readability after deletion.

<!-- dict:col:tournament_archives.final_snapshot -->
**`final_snapshot`** (jsonb, NOT NULL) — the archive payload `{tournament, divisions[], teams[], games[]}`; hashed into `integrity_hash` (gotcha 3).

<!-- dict:col:tournament_archives.winner_team_id -->
<!-- dict:col:tournament_archives.winner_team_name -->
<!-- dict:col:tournament_archives.runner_up_name -->
**`winner_team_id`** (FK → `teams.id`, nullable) / **`winner_team_name`** / **`runner_up_name`** — derived from the FINAL game (gotcha 4).

<!-- dict:col:tournament_archives.total_teams -->
<!-- dict:col:tournament_archives.total_games -->
**`total_teams`** / **`total_games`** (int, nullable) — accepted-team count / completed-or-submitted game count (gotcha 3).

<!-- dict:col:tournament_archives.integrity_hash -->
**`integrity_hash`** (text, NOT NULL) — sha256 of `final_snapshot` (tamper-evidence).

<!-- dict:col:tournament_archives.sealed_at -->
<!-- dict:col:tournament_archives.sealed_by -->
**`sealed_at`** (timestamptz, NOT NULL) — seal moment + primary DESC sort; **`sealed_by`** (FK → auth users, nullable) — who sealed it.

---

*End of Tournaments & Registration domain. Deferred (active free-tier work): `tournament_roster_players` + the not-yet-built `basic_coach_team_players` (the master-roster ↔ per-event-snapshot pair lands with free-tier Phase 3). Remaining domains (Org/Platform core, Rep teams, League, Accounting, Stripe/Billing, Platform admin, CRM, Notifications & Push) are enumerated in [DATA_DICTIONARY_PLAN.md](../../projects/active/DATA_DICTIONARY_PLAN.md) §5.*

---

# Domain: Coaches / basic-teams

Two halves bridged by an upgrade: the **free Basic Coaches Portal** (`basic_coach_*` — org-less, email-*stamped*, membership-gated) and the **standalone "Team" (Premium) workspace plumbing** (`team_workspaces` + its children — a per-team provisioned org with its own billing). A free Basic team upgrades into a paid workspace via a bidirectional bridge. The workspace tables forward-link into the **rep_\*** franchise module (Rep domain, a later phase — not documented here).

### Gotchas first (the cross-cutting traps)

- **Identity is membership, not email.** Basic-team access resolves through `basic_coach_team_users` on `user_id` + `status='active'` ([lib/basic-coach-teams.ts:147-180](../../../lib/basic-coach-teams.ts#L147-L180)). `primary_coach_email` is a *stamped contact value*, **not** the live access key.
- **One surviving exact-email path** — `getPendingTournamentRegistrationForUser` matches `teams.email` by **exact normalized equality** (`normalizeEmail(...) === email`, [lib/basic-coach-teams.ts:220](../../../lib/basic-coach-teams.ts#L220)), **not `ILIKE`**. This is the "claim my tournament registration" flow; it then creates an explicit link row.
- **Coach↔tournament linkage is a ROW**, keyed on `teams.id` — `basic_coach_team_registrations` (`tournament_team_id` UNIQUE). Never an email match. (Migration 092 removed the old `'email_fallback'` access path entirely.)
- **The 4 workspace tables (`team_workspaces`, `team_org_links`, `team_workspace_claims`, `team_entitlements`) are RLS-enabled but have NO client policies** — service-role (`supabaseAdmin`) only. `workspace_org_id` is the **required RLS tenancy anchor** for all four ([DB_ARCHITECTURE_REVIEW.md:316](DB_ARCHITECTURE_REVIEW.md)).
- **Dev/prod: zero drift** across all 7 tables (snapshot 2026-06-08).

---

## `basic_coach_teams`
<!-- dict:table:basic_coach_teams -->

**Purpose:** the **free Basic Coaches Portal** team — the **org-less** free floor. One row per team a coach manages without paying. Created from a tournament-registration link *or* the standalone `/start` on-ramp, and optionally bridged up to a paid `team_workspaces` row.

**Gotchas (read first):**
1. **NO `org_id` — deliberate.** This free floor exists *outside* any org/tenant; the only org-ish link is the nullable `team_workspace_id` (appears only after upgrade). Code expecting an `org_id` here is wrong by design.
2. **Identity ≠ `primary_coach_email`.** Ownership is resolved via `basic_coach_team_users` membership (`user_id`); `primary_coach_email` is a stamped contact (set to the signed-in coach's normalized email at create), not the access key.
3. **`team_workspace_id` = the Basic→Premium bridge, bidirectional.** NULL for a pure free team; set when the coach upgrades. Written together with `team_workspaces.basic_coach_team_id` (forward write at [lib/team-workspace-provisioning.ts:287](../../../lib/team-workspace-provisioning.ts#L287), reverse at [:301-304](../../../lib/team-workspace-provisioning.ts#L301-L304)). Treat it as the "has this free team been monetized?" flag.
4. **Tournament linkage is not on this table** — it's a row in `basic_coach_team_registrations`; history is resolved by joining `basic_coach_team_registrations → teams → tournaments`.

**Fields** (boilerplate `id`, `created_at`, `updated_at` omitted):

<!-- dict:col:basic_coach_teams.name -->
**`name`** (text, NOT NULL) — display name; the registration name when auto-created from a tournament.

<!-- dict:col:basic_coach_teams.normalized_name -->
**`normalized_name`** (text, NOT NULL) — `name.trim().toLowerCase()` ([lib/basic-coach-teams.ts:105](../../../lib/basic-coach-teams.ts#L105)); a dedup helper, currently **write-only** (no read-side query found).

<!-- dict:col:basic_coach_teams.primary_coach_name -->
**`primary_coach_name`** (text, nullable) — contact display name; the registration's `coach` on the register path, else the signed-in coach's account name.

<!-- dict:col:basic_coach_teams.primary_coach_email -->
**`primary_coach_email`** (text, NOT NULL) — normalized contact email stamped at create. **Soft contact key only** — not the runtime access key (gotcha 2).

<!-- dict:col:basic_coach_teams.sport -->
<!-- dict:col:basic_coach_teams.age_group -->
**`sport` / `age_group`** (text, nullable) — meta chips; captured **only** on the standalone `/start` on-ramp (null when auto-created from a registration). Free text, no enum.

<!-- dict:col:basic_coach_teams.source -->
**`source`** (text, NOT NULL, default `'tournament_registration'`; CHECK `tournament_registration|coach_created|premium_upgrade|backfill`) — provenance. Runtime writes only `'tournament_registration'` (register→link) or `'coach_created'` (on-ramp); the other two are allowed but used only by migration backfill. Write-only metadata (no reader yet).

<!-- dict:col:basic_coach_teams.team_workspace_id -->
**`team_workspace_id`** (FK → `team_workspaces.id`, nullable) — the Basic→Premium bridge (gotcha 3).

---

## `basic_coach_team_users`
<!-- dict:table:basic_coach_team_users -->

**Purpose:** the **user↔team membership/access join** for the free portal. A row grants an auth user access to one `basic_coach_teams` profile. **This table IS the authorization** — there's no `org_id`/`org_members` involvement; membership with `status='active'` is the gate.

**Gotchas (read first):**
1. **Membership = authorization.** `userOwnsBasicCoachTeam` / `getBasicCoachTeamsForUser` gate on `user_id` + `status='active'` ([lib/basic-coach-teams.ts:169](../../../lib/basic-coach-teams.ts#L169)).
2. **`role` values are `owner | coach`, NOT `assistant`** (CHECK, mig 091). The kickoff/memory said "assistant" — that's wrong. Multi-coach delegation is designed-for but **deferred**: code only ever inserts `'owner'`; nothing writes `'coach'` or reads `role` yet.
3. **`user_id` → `auth.users`** (not a public profiles/org_members table). `UNIQUE(basic_coach_team_id, user_id)` prevents dup membership.

**Fields** (boilerplate `id`, `created_at`, `updated_at` omitted):

<!-- dict:col:basic_coach_team_users.basic_coach_team_id -->
**`basic_coach_team_id`** (FK → `basic_coach_teams.id` ON DELETE CASCADE, NOT NULL) — the team. The only structural anchor (no `org_id`).

<!-- dict:col:basic_coach_team_users.user_id -->
**`user_id`** (FK → `auth.users.id` ON DELETE CASCADE, NOT NULL) — the member; the authenticated identity (gotcha 3).

<!-- dict:col:basic_coach_team_users.role -->
**`role`** (text, NOT NULL, default `'owner'`; CHECK `owner|coach`) — delegation role (gotcha 2).

<!-- dict:col:basic_coach_team_users.status -->
**`status`** (text, NOT NULL, default `'active'`; CHECK `active|removed`) — every membership read filters `'active'`; `'removed'` is the (not-yet-wired) soft-revoke lever.

---

## `basic_coach_team_registrations`
<!-- dict:table:basic_coach_team_registrations -->

**Purpose:** the **coach↔tournament identity bridge** — links a Basic coach team to a tournament registration (`tournament_team_id` → `teams.id`). A row's existence is what proves a coach owns a registration; access is *this row* (+ team membership), **not** an email match.

**Gotchas (read first):**
1. **This row replaced email matching.** `canUserAccessTournamentRegistration` returns `'explicit'|null` solely by finding a row here + confirming team ownership ([lib/basic-coach-teams.ts:543-551](../../../lib/basic-coach-teams.ts#L543-L551)). The old `teams.email ILIKE` model is gone (mig 092 dropped the `'email_fallback'` source).
2. **`tournament_team_id` UNIQUE** — a registration links to **at most one** basic team. Built by `linkTournamentRegistrationToBasicCoachTeam` ([lib/basic-coach-teams.ts:338](../../../lib/basic-coach-teams.ts#L338)), called from the register POST ([register/route.ts:368](../../../app/api/register/route.ts#L368)) and the portal claim ([coaches/basic-teams/route.ts:85](../../../app/api/coaches/basic-teams/route.ts#L85)).
3. **Naming smell:** `tournament_team_id` FKs to the table literally named `teams` (tournament registrations).
4. **No `updated_at`** — links are immutable (created once).

**Fields** (boilerplate `id`, `created_at` omitted):

<!-- dict:col:basic_coach_team_registrations.basic_coach_team_id -->
**`basic_coach_team_id`** (FK → `basic_coach_teams.id` ON DELETE CASCADE, NOT NULL) — the coach side.

<!-- dict:col:basic_coach_team_registrations.tournament_team_id -->
**`tournament_team_id`** (FK → `teams.id` ON DELETE CASCADE, NOT NULL, UNIQUE) — the registration; the identity bridge (gotchas 1–3).

<!-- dict:col:basic_coach_team_registrations.linked_by_user_id -->
**`linked_by_user_id`** (FK → `auth.users.id` ON DELETE SET NULL, nullable) — audit of who linked it (write-only; `SET NULL` keeps the link if the user is deleted).

<!-- dict:col:basic_coach_team_registrations.link_source -->
**`link_source`** (text, NOT NULL, CHECK `explicit|registration_flow|backfill`) — provenance. **Default-vs-code mismatch:** column default is `'explicit'`, but every call site passes `'registration_flow'` (the default is effectively dead). `'email_fallback'` was removed in mig 092.

---

## Standalone team workspaces (Premium plumbing)

> The paid "Team" plan: a per-team provisioned org with its own billing. All four tables (mig 065) are **RLS-enabled with NO client policies** — `supabaseAdmin` only; `workspace_org_id` is the tenancy anchor. They forward-link into the **rep_\*** module (`rep_team_id`, `active_program_year_id` → Rep domain, later phase). No `lib/team-workspaces.ts` exists — the surface is split across `lib/team-workspace-provisioning.ts` (INSERT), `lib/team-workspace-entitlements.ts` (SELECT/mapper), `lib/team-org-billing.ts` + `lib/team-checkout.ts` (billing), and the Stripe webhook.

### `team_workspaces`
<!-- dict:table:team_workspaces -->

**Purpose:** root of a standalone "Team" (Premium) workspace — one per rep team with its own subscription. Anchored to a tenant org (`workspace_org_id`), wraps one `rep_teams` row, carries its own Stripe state, and is the bridge target for a `basic_coach_teams` upgrade.

**Gotchas (read first):**
1. **DUAL org FK** — `workspace_org_id` (NOT NULL, the **tenant** org + **RLS anchor** for this table *and* its children) vs `billing_owner_org_id` (nullable, **who pays**, may differ). The "FK is named `org_id`" convention is intentionally broken (a table can't have two `org_id` columns) — the descriptive naming is the approved exception ([DB_ARCHITECTURE_REVIEW.md:316](DB_ARCHITECTURE_REVIEW.md)). Scope everything via `workspace_org_id`.
2. **`org_team_addon` moves Stripe state to the workspace and NULLs the workspace's ORG row — not the workspace** (an easy thing to get backwards). When an org takes over billing, the `team_workspaces` row **keeps/gets** its `stripe_customer_id`/`stripe_subscription_id` ([lib/team-org-billing.ts:613-614](../../../lib/team-org-billing.ts#L613-L614)) and the workspace's **`organizations` row** is the one NULLed ([:626-627](../../../lib/team-org-billing.ts#L626-L627); the direct-checkout sync does the same at [lib/team-checkout.ts:252-253](../../../lib/team-checkout.ts#L252-L253)). The workspace's `stripe_subscription_id` stays populated (it's the webhook's lookup key) — so don't read a null on the *org* row as "the team has no sub."
3. **`source` is an overloaded word** — `team_workspaces.source` (`direct_signup|tournament_claim|org_invite|platform_admin`, mig 065) is a different value set from `billing_mode` (`org_team_addon|…`), from `team_entitlements.source` (`team_plan|…`), and from the billing/event `source` params (`app|stripe|mock`) in adjacent code. Same word, four meanings.

**Fields** (boilerplate `id`, `created_at`, `updated_at` omitted):

<!-- dict:col:team_workspaces.workspace_org_id -->
**`workspace_org_id`** (FK → `organizations.id`, NOT NULL) — **tenant org + RLS tenancy anchor** (gotcha 1).

<!-- dict:col:team_workspaces.rep_team_id -->
<!-- dict:col:team_workspaces.active_program_year_id -->
**`rep_team_id`** (FK → `rep_teams.id`, NOT NULL) / **`active_program_year_id`** (FK → `rep_program_years.id`, nullable) — the wrapped rep team + its current season. **Forward-links to the Rep domain** (documented later).

<!-- dict:col:team_workspaces.primary_owner_user_id -->
**`primary_owner_user_id`** (FK → `auth.users`, nullable) — the owning coach (distinct from `billing_owner_user_id`).

<!-- dict:col:team_workspaces.source -->
<!-- dict:col:team_workspaces.source_tournament_id -->
<!-- dict:col:team_workspaces.source_tournament_team_id -->
**Provenance block** — `source` (NOT NULL, default `'direct_signup'`; CHECK `direct_signup|tournament_claim|org_invite|platform_admin`; gotcha 3); `source_tournament_id` (FK → `tournaments.id`) / `source_tournament_team_id` (FK → `teams.id`) set only for tournament-sourced workspaces (used to resolve the `basic_coach_team` bridge at provisioning).

<!-- dict:col:team_workspaces.workspace_state -->
**`workspace_state`** (text, NOT NULL, default `'independent'`) — `independent|linked|archived|org_owned`; `archived`/`org_owned` block billing-mode transfer.

<!-- dict:col:team_workspaces.billing_mode -->
**`billing_mode`** (text, NOT NULL, default `'team_direct'`) — `team_direct` (team pays its own sub) vs `org_team_addon` (org pays; workspace Stripe fields NULLed — gotcha 2).

<!-- dict:col:team_workspaces.billing_owner_org_id -->
<!-- dict:col:team_workspaces.billing_owner_user_id -->
**`billing_owner_org_id`** (FK → `organizations.id`, nullable) / **`billing_owner_user_id`** (FK → `auth.users`, nullable) — who pays (gotcha 1); set/NULLed on org takeover.

<!-- dict:col:team_workspaces.stripe_customer_id -->
<!-- dict:col:team_workspaces.stripe_subscription_id -->
<!-- dict:col:team_workspaces.subscription_status -->
<!-- dict:col:team_workspaces.current_period_end -->
**Stripe block** — `stripe_customer_id`, `stripe_subscription_id` (the webhook's primary lookup key — populated for active subs), `subscription_status` (NOT NULL, default `'active'`; mirrors Stripe), `current_period_end`. Distinct from the same-named columns on `organizations` (gotcha 2 covers which row carries billing under each mode).

<!-- dict:col:team_workspaces.basic_coach_team_id -->
**`basic_coach_team_id`** (FK → `basic_coach_teams.id`, nullable) — the **reverse free→paid bridge** (kept in sync with `basic_coach_teams.team_workspace_id`).

### `team_org_links`
<!-- dict:table:team_org_links -->

**Purpose:** auditable relationship between a Team workspace and a **parent org** — a rep org "adopting" a team (visibility-sharing → billing-takeover → full ownership-transfer states), with two-sided approval.

**Gotchas:** (1) **No direct `org_id` on the team side** — reached 2-hop via `team_workspace_id → team_workspaces.workspace_org_id` (Finding #16, **accepted risk** because the parent-org side has a direct indexed `linked_org_id`). (2) **Two-sided approval** — `approved_by_team_user_id` + `approved_by_org_user_id` (the org one is NULL until the parent org accepts). (3) Closed value domains via CHECK on `status`/`link_type`/`sharing_level`/`billing_mode_after_approval`. Partial unique on `(team_workspace_id, linked_org_id)` blocks dup active links.

**Fields** (boilerplate `id`, `created_at`, `updated_at` omitted):

<!-- dict:col:team_org_links.team_workspace_id -->
**`team_workspace_id`** (FK → `team_workspaces.id` ON DELETE CASCADE, NOT NULL) — team side; 2-hop tenancy (gotcha 1).

<!-- dict:col:team_org_links.linked_org_id -->
**`linked_org_id`** (FK → `organizations.id` ON DELETE CASCADE, NOT NULL) — the adopting parent org; direct indexed FK (the reason Finding #16 is accepted risk).

<!-- dict:col:team_org_links.rep_team_id -->
**`rep_team_id`** (FK → `rep_teams.id`, NOT NULL) — denormalized for org-side billing reconciliation; forward-links to Rep.

<!-- dict:col:team_org_links.status -->
**`status`** (text, NOT NULL, default `'requested'`; CHECK `requested|invited|linked|ownership_pending|org_owned|declined|revoked`) — the adoption/transfer state machine.

<!-- dict:col:team_org_links.link_type -->
<!-- dict:col:team_org_links.sharing_level -->
**`link_type`** (CHECK `visibility|billing|ownership`, default `'visibility'`) / **`sharing_level`** (CHECK `basic|roster_summary|financial_summary|full_org_owned`, default `'basic'`) — what the link grants + how much data the org sees (escalate together).

<!-- dict:col:team_org_links.requested_by_user_id -->
<!-- dict:col:team_org_links.approved_by_team_user_id -->
<!-- dict:col:team_org_links.approved_by_org_user_id -->
**Approval actors** (all FK → `auth.users` ON DELETE SET NULL, nullable) — requester + the two-sided approvers (gotcha 2).

<!-- dict:col:team_org_links.billing_mode_after_approval -->
**`billing_mode_after_approval`** (text, nullable; CHECK `team_direct|org_team_addon|club_included|club_extra_team|platform_override`) — billing arrangement post-approval (null = no billing change). Value domain parallels `team_entitlements.source`.

### `team_workspace_claims`
<!-- dict:table:team_workspace_claims -->

**Purpose:** **single-use claim records** that let a tournament team's contact activate (claim) a standalone Team workspace — the tournament-team → paid-workspace funnel. Low-traffic, one-time setup.

**Gotchas:** (1) **The token is never stored** — only `claim_token_hash`; lookups hash the incoming token (`hashClaimToken`). (2) **`tournament_team_id` is a plain `uuid` with NO FK constraint** (type-vs-constraint smell) even though code treats it as a `teams.id`. (3) `contact_email` is an **identity gate** — the claimer's email must equal it (lowercased). (4) Workspace/org tenancy is 2-hop via `team_workspace_id`. (5) **No `updated_at`** — `status` + `claimed_at` carry mutation history.

**Fields** (boilerplate `id`, `created_at` omitted):

<!-- dict:col:team_workspace_claims.tournament_id -->
**`tournament_id`** (FK → `tournaments.id` ON DELETE CASCADE, NOT NULL) — the offering tournament; the only direct tenancy FK.

<!-- dict:col:team_workspace_claims.tournament_team_id -->
**`tournament_team_id`** (uuid, nullable, **no FK**) — logical → `teams.id` (gotcha 2).

<!-- dict:col:team_workspace_claims.contact_email -->
**`contact_email`** (text, NOT NULL) — identity gate (gotcha 3); indexed on `lower(contact_email)+status`.

<!-- dict:col:team_workspace_claims.claim_token_hash -->
**`claim_token_hash`** (text, NOT NULL, UNIQUE) — hashed single-use token (gotcha 1).

<!-- dict:col:team_workspace_claims.status -->
**`status`** (text, NOT NULL, default `'available'`; CHECK `available|claimed|expired|revoked`) — claim lifecycle.

<!-- dict:col:team_workspace_claims.team_workspace_id -->
<!-- dict:col:team_workspace_claims.claimed_by_user_id -->
**`team_workspace_id`** (FK → `team_workspaces.id` ON DELETE SET NULL, nullable) / **`claimed_by_user_id`** (FK → `auth.users` ON DELETE SET NULL, nullable) — set at fulfillment; `SET NULL` keeps the audit record.

<!-- dict:col:team_workspace_claims.expires_at -->
<!-- dict:col:team_workspace_claims.claimed_at -->
**`expires_at`** (timestamptz, nullable) — auto-expires `available` claims on read; **`claimed_at`** (timestamptz, nullable) — fulfillment time.

### `team_entitlements`
<!-- dict:table:team_entitlements -->

**Purpose:** team-scoped access/billing **entitlement grants** — one row grants an `(org_id, rep_team_id)` pair a Team-tier entitlement from a `source`. This is the **team-scoped gating source** for rep-team access (not the org-wide `module_rep_teams`).

**Gotchas:** (1) **Both `org_id` AND `rep_team_id` are NOT NULL** — Finding #15's "dual nullable owner FKs" was **closed as incorrect** (mig 065); a no-owner row is structurally impossible. Only `team_workspace_id` is nullable. (2) **`status` CHECK accepts BOTH `'cancelled'` and `'canceled'`** (UK + US spelling — a tolerance smell; handle both when filtering). (3) Active-grant uniqueness: partial unique on `(org_id, rep_team_id, source)` WHERE `status IN ('active','trialing','past_due')`.

**Fields** (boilerplate `id`, `created_at`, `updated_at` omitted):

<!-- dict:col:team_entitlements.org_id -->
<!-- dict:col:team_entitlements.rep_team_id -->
**`org_id`** (FK → `organizations.id` ON DELETE CASCADE, NOT NULL) / **`rep_team_id`** (FK → `rep_teams.id` ON DELETE CASCADE, NOT NULL) — the entitlement key (gotcha 1); `rep_team_id` forward-links to Rep.

<!-- dict:col:team_entitlements.team_workspace_id -->
**`team_workspace_id`** (FK → `team_workspaces.id` ON DELETE CASCADE, nullable) — optional materialization; the grant can exist before a workspace.

<!-- dict:col:team_entitlements.source -->
**`source`** (text, NOT NULL; CHECK `team_plan|org_team_addon|club_included|club_extra_team|platform_override`) — what grants it; part of the active-source unique index.

<!-- dict:col:team_entitlements.status -->
**`status`** (text, NOT NULL, default `'active'`; CHECK `active|trialing|past_due|cancelled|canceled|expired`) — billing health, mapped from Stripe (gotcha 2).

<!-- dict:col:team_entitlements.starts_at -->
<!-- dict:col:team_entitlements.ends_at -->
**`starts_at`** (timestamptz, NOT NULL, default now()) / **`ends_at`** (timestamptz, nullable; null = open-ended) — the entitlement window; active queries filter `ends_at IS NULL OR ends_at > now()`.

<!-- dict:col:team_entitlements.stripe_subscription_item_id -->
**`stripe_subscription_item_id`** (text, nullable) — links the grant to its Stripe subscription item (null for non-billed grants like `platform_override`).

---

*End of Coaches / basic-teams domain. Deferred: `basic_coach_team_players` (free-tier Phase 3, not yet built).*
