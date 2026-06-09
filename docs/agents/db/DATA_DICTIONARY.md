# FieldLogicHQ — Data Dictionary

> **Owned by:** `/db` (field lookups, operational queries) + `/dba` (architecture, migrations, snapshots). **Never archived** — this is a living agent reference.
> **What this is:** the *semantic* layer — for each meaningful column, **what it means, what reads/writes it (file:line), how it relates to other fields, and its gotchas**. Structure (types/constraints) is owned by the JSON snapshots; this doc does **not** restate it.
> **Current as of:** code commit `5479605` (branch `feat/free-tier-coaches`) · schema snapshot **2026-06-09** (dev 104 / prod 103 tables). `file:line` refs are relative to that commit — re-verify if the tree has moved (see the branch-drift note below). _(Tournaments & Registration + Coaches domains were originally authored at `ad9dc66`; the Org / Platform core and Rep teams / team workspaces — operations half — domains were verified at `5479605`.)_
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

# Domain: Org / Platform core

The **tenant backbone**: an **organization** is the root every other domain FKs into. **organization_members** is the RBAC layer (role + per-member capability overrides), narrowed by two scope join tables (**org_member_tournament_assignments**, **org_member_rep_group_scopes**). **org_overrides** holds timed entitlement grants (comps/trials/addons). **org_audit_log** records org-member changes; **org_internal_notes** and **org_public_site_content** carry platform-admin CRM notes and the public-facing org-home content. The recurring trap: the org's **public contact email is NOT on `organizations`** — it lives on `org_public_site_content`.

### Gotchas first (the cross-cutting traps)

- **`organizations` has NO `contact_email` — and the code reads it anyway.** All three org mappers read `r.contact_email` off a `select('*')` of a column that doesn't exist (`mapOrg` [lib/db.ts:2497](../../../lib/db.ts#L2497), plus `lib/server-organizations.ts` / `lib/api-auth.ts`), so `Organization.contactEmail` is **always `null`** on the normal org paths. The real public contact email is `org_public_site_content.contact_email`, injected onto the org row only on the `team-org-links` path.
- **Two "internal notes" stores.** The scalar `organizations.internal_notes` (text) is **legacy + a UAT sentinel** (`[UAT_PROTECTED]`); the real platform-admin notes feature is the separate `org_internal_notes` **table** (soft-deletable, audited).
- **`account_kind='team_workspace'` (or `plan_id='team'`) = a shadow org** backing a standalone Team workspace — filtered out of normal org listings, link discovery, and pickers. See the Coaches domain (`team_workspaces.workspace_org_id → organizations.id`).
- **RBAC role enum lives in code, not the DB.** `organization_members.role` has **no CHECK**; the 8-value domain is the `OrgRole` TS union ([lib/types.ts:12](../../../lib/types.ts#L12)). `role='owner'` is a hard super-user bypass; `capabilities` (jsonb) is an additive **and subtractive** per-member override layer.
- **Member "scoping" is absence-means-unrestricted.** Both scope tables (tournament assignments, rep-group scopes) *narrow* a member; a member with **zero** scope rows is unrestricted, and owners/admins skip scoping entirely.
- **`org_member_tournament_assignments` is NOT wired to `tournaments.notify_mode`.** It scopes **`staff`-role** notification recipients ([lib/notify.ts:124-141](../../../lib/notify.ts#L124)) and `/api/admin/*` tournament access — a different mechanism from the Phase-1 `notify_mode='assigned'` contact-member routing.
- **`org_overrides` (timed grants) is INERT by default.** Enforcement (`applyEntitlementGrants`) is a no-op unless `ENTITLEMENT_GRANTS_ENABLED==='true'` (default off). When on, only `module_addon` + `subscription_status` take effect (start/expiry/revoke **are** enforced — superseding DBA Findings #22–24's pre-mig-109 state); `comp_period`/`plan_tier` carry no access effect, and `suppress_billing` has **zero readers**.
- **Two audit logs, two scopes.** `org_audit_log` (this domain) records org-member changes, owner-readable. Platform-admin mutations (overrides, internal notes, …) log to `platform_audit_log` (a later phase) — *not* here.
- **Dev/prod:** all 8 Org/Platform-core tables are **zero-drift** (snapshot 2026-06-09) — column-, constraint-, and RLS-identical across dev+prod.

---

## `organizations`
<!-- dict:table:organizations -->

**Purpose:** the **tenant root** — one row per workspace at `/{slug}/`, and the FK target the entire schema hangs off. Carries identity, the plan/billing/Stripe state, module entitlements, branding defaults, visibility flags, and the org-vs-team-workspace discriminator. Hydrated to the `Organization` type by `mapOrg` ([lib/db.ts:2472](../../../lib/db.ts#L2472)) and two near-duplicate mappers (`lib/server-organizations.ts`, `lib/api-auth.ts`).

**Gotchas (read first):**
1. **No `contact_email` column** — `mapOrg` reads `r.contact_email` ([lib/db.ts:2497](../../../lib/db.ts#L2497)) off a column that doesn't exist, so `Organization.contactEmail` is always `null`. Real value lives on `org_public_site_content.contact_email`.
2. **`plan_id` default `'starter'` is LEGACY** — not a valid `OrgPlan` (`tournament|team|tournament_plus|league|club`, [lib/types.ts:1](../../../lib/types.ts#L1)). `createOrganization` always writes a real key (default `'tournament'`, [lib/db.ts:2407](../../../lib/db.ts#L2407)); a row left at `'starter'` misses `PLAN_CONFIG` and falls back to a tournament limit of 1. Treat `'starter'` as a dead default.
3. **`internal_notes` (scalar) ≠ `org_internal_notes` (table).** The scalar is legacy + the `[UAT_PROTECTED]` seed-protection sentinel; no live UI writes it.
4. **`account_kind='team_workspace'` = a shadow org.** The predicate `account_kind==='team_workspace' || plan_id==='team'` is `isTeamWorkspaceOrgRow` ([lib/team-org-links.ts:345](../../../lib/team-org-links.ts#L345)); its negation `isNormalLinkableOrg` ([:341](../../../lib/team-org-links.ts#L341), which *also* requires `is_discoverable !== false`) is the actual org-link **discovery** gate. The same shadow-org test also gates coaching-assignment, ownership-transfer targets, and dev pickers. `team_workspace_status` is set only for these rows.
5. **Six columns are NOT on the `Organization` type** (subsystem-only — read/written directly, never via `mapOrg`): `billing_suspended_at`, `billing_suspension_reason`, `internal_notes`, `pdf_settings`, `email_marketing_opt_out`, `email_opt_out_at`.

**Fields** (boilerplate `id`, `created_at` omitted):

<!-- dict:col:organizations.name -->
**`name`** (text, NOT NULL) — display name. _Writes:_ `createOrganization` ([lib/db.ts:2418](../../../lib/db.ts#L2418)), org-settings PATCH.

<!-- dict:col:organizations.slug -->
**`slug`** (text, NOT NULL, UNIQUE) — the `/{slug}/` URL segment + primary org lookup key (`getOrganizationBySlug`, [lib/db.ts:2288](../../../lib/db.ts#L2288)). Generated collision-safe by `generateUniqueOrgSlug`; rename is uniqueness-guarded on save.

<!-- dict:col:organizations.logo_url -->
**`logo_url`** (text, nullable) — org logo; per-event `tournaments.logo_url` overrides it. _Writes:_ [app/api/admin/org-logo/route.ts](../../../app/api/admin/org-logo/route.ts).

<!-- dict:col:organizations.plan_id -->
**`plan_id`** (text, NOT NULL, default `'starter'`) — billing tier (`OrgPlan`). Feeds `getEffectiveTournamentLimit` + `hasModuleEntitlement`. Default `'starter'` is legacy (gotcha 2); `'team'` is the standalone Coaches/Team tier. _Writes:_ `updateOrgSubscription` ([lib/db.ts:2457-2464](../../../lib/db.ts#L2457)), onboarding-plan route.

<!-- dict:col:organizations.stripe_customer_id -->
<!-- dict:col:organizations.stripe_subscription_id -->
<!-- dict:col:organizations.subscription_status -->
<!-- dict:col:organizations.subscription_period -->
<!-- dict:col:organizations.current_period_end -->
<!-- dict:col:organizations.rep_team_subscription_item_id -->
**Stripe / subscription block** (`stripe_customer_id`, `stripe_subscription_id`, `subscription_status`, `subscription_period`, `current_period_end`, `rep_team_subscription_item_id`) — Stripe linkage + subscription state. `subscription_status` (no DB CHECK; code domain `active|trialing|past_due|canceled`, [lib/types.ts:13](../../../lib/types.ts#L13)) defaults `'active'`; `subscriptionStatus==='canceled'` hard-disables module entitlements ([lib/module-entitlements.ts:15](../../../lib/module-entitlements.ts#L15)) and blocks public tournament context ([lib/public-tournament-data.ts:60](../../../lib/public-tournament-data.ts#L60)). **Main writer = the Stripe webhook** ([app/api/billing/webhook/route.ts](../../../app/api/billing/webhook/route.ts): `subscription.updated/created` ~:233, `payment_succeeded`→active ~:528, `payment_failed`→`past_due` ~:557, `subscription.deleted`→`canceled`+null ~:466); also `updateOrgSubscription` ([lib/db.ts:2457-2464](../../../lib/db.ts#L2457)). *(Billing-flow narrative + the `stripe_prices` table → the Stripe/Billing phase; these columns are documented here.)*

<!-- dict:col:organizations.billing_suspended_at -->
<!-- dict:col:organizations.billing_suspension_reason -->
**`billing_suspended_at` / `billing_suspension_reason`** (timestamptz / text, nullable) — suspension audit stamp; set on subscription deletion, cancel-confirm, and platform-admin cancel; cleared on team-workspace reactivation. **Not on the `Organization` type** (subsystem-only).

<!-- dict:col:organizations.tournament_limit -->
**`tournament_limit`** (int, NOT NULL, default 1) — stored cap. The hydrated `Organization.tournamentLimit` is **never the raw column** — it's always clamped through `getEffectiveTournamentLimit(plan_id, tournament_limit)` in all three mappers ([lib/db.ts:2485](../../../lib/db.ts#L2485), [lib/plan-config.ts](../../../lib/plan-config.ts)). (Platform-admin bulk-ops reads the raw column directly.) _Writes:_ `createOrganization`, `updateOrgSubscription`, onboarding-plan.

<!-- dict:col:organizations.is_public -->
**`is_public`** (bool, NOT NULL, default true) — gates the **org-home/league** landing pages ([app/[orgSlug]/page.tsx:17](../../../app/[orgSlug]/page.tsx#L17)) and the public tournaments feed; **does NOT gate tournament pages or registration** ([lib/public-tournament-data.ts:57](../../../lib/public-tournament-data.ts#L57)). Force-cleared to `false` on cancel/suspend. _Writes:_ org-settings PATCH.

<!-- dict:col:organizations.is_discoverable -->
**`is_discoverable`** (bool, NOT NULL, default true; partial index `WHERE email_marketing_opt_out=true` is a *different* column — this one is unindexed) — gates whether the org appears in the **team→org link directory/search** ([lib/team-org-links.ts:341](../../../lib/team-org-links.ts#L341)); shadow orgs are provisioned `false`. **Not** editable via org-settings (distinct from `is_public`).

<!-- dict:col:organizations.require_score_finalization -->
**`require_score_finalization`** (bool, NOT NULL, default false) — org default for the score-lock workflow; `tournaments.require_score_finalization` overrides per-event ([lib/public-tournament-data.ts:51](../../../lib/public-tournament-data.ts#L51)). _Writes:_ org-settings PATCH.

<!-- dict:col:organizations.onboarding_completed_at -->
**`onboarding_completed_at`** (timestamptz, nullable) — first-run onboarding gate; set once (idempotent on null) by `complete-onboarding`.

<!-- dict:col:organizations.theme_preset -->
<!-- dict:col:organizations.theme_primary -->
<!-- dict:col:organizations.theme_accent -->
<!-- dict:col:organizations.theme_font -->
<!-- dict:col:organizations.theme_card_style -->
<!-- dict:col:organizations.hero_banner_url -->
**Branding block** (`theme_preset` default `'platform'`, `theme_primary`, `theme_accent`, `theme_font` default `'system'`, `theme_card_style` default `'default'`, `hero_banner_url`) — org-level branding **defaults that each `tournament` overrides per-event** (the same-named Phase-1 block). Custom hex + non-system font require a **paid plan** (org-settings PATCH gates on plan ≠ `tournament`). _Writes:_ [app/api/admin/org-settings/route.ts](../../../app/api/admin/org-settings/route.ts), `org-hero-banner`.

<!-- dict:col:organizations.enabled_addons -->
**`enabled_addons`** (jsonb, NOT NULL, default `'[]'`) — granted **module capabilities**, OR'd with the plan tier: `hasModuleEntitlement` is true if the cap is in `PLAN_CONFIG[plan].moduleEntitlements` **or** `enabledAddons.includes(cap)` ([lib/module-entitlements.ts:14-20](../../../lib/module-entitlements.ts#L14)). **Key catalog** = `Capability` module keys ([lib/roles.ts:21-28](../../../lib/roles.ts#L21)): `module_tournaments`, `module_communications`, `module_members` (core/default-on), `module_public_site`, `module_accounting`, `module_house_league`, `module_rep_teams` (premium/default-off). _Writes:_ platform-admin addons PATCH + bulk-ops. (No separate `AddonId` type — addon keys *are* the module capability strings.)

<!-- dict:col:organizations.internal_notes -->
**`internal_notes`** (text, nullable) — **legacy** scalar note + the `[UAT_PROTECTED]` seed-protection sentinel (`app/api/dev/seed/*`). Superseded by the `org_internal_notes` table (gotcha 3); no live UI writer found. **Not on the `Organization` type.**

<!-- dict:col:organizations.pdf_settings -->
**`pdf_settings`** (jsonb, nullable, default `'{}'`) — org-level PDF report template config. **Key catalog** (`OrgPdfSettings`, [lib/export/pdf.ts:19-46](../../../lib/export/pdf.ts#L19)): `headerLine1`/`headerLine2`, `footerText`, `showDateStamp`/`showPageNumbers`/`showBranding` (free plan forces branding on), `orientation`, `accentColor`, `logoDataUrl`, `reportDensity`, `includeGuardianContacts`/`includePlayerNotes`/`includeInternalNotes`. _Reads/writes:_ [app/api/admin/org/pdf-settings/route.ts](../../../app/api/admin/org/pdf-settings/route.ts). **Not on the `Organization` type.**

<!-- dict:col:organizations.account_kind -->
**`account_kind`** (text, NOT NULL, default `'organization'`; CHECK `organization|team_workspace`) — real org vs team-workspace shadow org (gotcha 4). _Writes:_ `createOrganization` ([lib/db.ts:2422](../../../lib/db.ts#L2422)).

<!-- dict:col:organizations.team_workspace_status -->
**`team_workspace_status`** (text, nullable; CHECK NULL or `active|linked|org_owned|archived`) — lifecycle of a shadow org; set only when `account_kind='team_workspace'`. _Writes:_ team-checkout (`active`), org-link (`linked`), ownership-transfer (`org_owned`).

<!-- dict:col:organizations.email_marketing_opt_out -->
<!-- dict:col:organizations.email_opt_out_at -->
**`email_marketing_opt_out` / `email_opt_out_at`** (bool default false, partial-indexed `idx_organizations_email_opt_out WHERE true` / timestamptz) — marketing-email suppression; `email-sender.ts` skips sends when true. _Writes:_ `/unsubscribe` route (set), `email/resubscribe` (clear). **Not on the `Organization` type** (email subsystem only).

---

## `organization_members`
<!-- dict:table:organization_members -->

**Purpose:** the **org membership + RBAC row** — one per `(organization_id, user_id)`. Identity key is `user_id` (NOT email). Drives the entire admin authorization model: `role` → default capability set, `capabilities` jsonb → per-member overrides, narrowed by the two scope join tables.

**Gotchas (read first):**
1. **`role` has no DB CHECK — the enum is `OrgRole` in code** (8 values: `owner|admin|staff|official|league_admin|league_registrar|treasurer|coach`, [lib/types.ts:12](../../../lib/types.ts#L12)). DB default `'admin'` is effectively dead (every insert passes an explicit role). The **invitable** subset is narrower (`admin|staff|official|league_admin|league_registrar|treasurer`); `owner`/`coach` are set by other flows.
2. **`role='owner'` short-circuits authorization before capabilities are read** — `hasCapability` returns true unconditionally ([lib/roles.ts:82](../../../lib/roles.ts#L82)), and owners skip both scope tables (unrestricted).
3. **`capabilities` is additive *and subtractive*.** An explicit `capabilities[cap]` (true OR false) **wins** over the role default; absent → role default ([lib/roles.ts:83-85](../../../lib/roles.ts#L83)). Owner-only to edit.
4. **`mapMember` maps only 6 of 10 columns** ([lib/db.ts:2504](../../../lib/db.ts#L2504)) — it drops `capabilities`, `status`, `display_name`, `title`; the `OrganizationMember` type lacks them too. The members admin API reads them via its own select.
5. **Suspended = unauthenticated platform-wide.** `getAuthContext` filters `.neq('status','suspended')` ([lib/api-auth.ts:87](../../../lib/api-auth.ts#L87)) → a suspended member gets 401 (not 403) on every `/api/admin/*` route. **Last-owner protection** blocks deleting/demoting/suspending the final owner.
6. **One-org-per-user is enforced in app code, not schema** — invite rejects a user already in any other org. The DB UNIQUE is only `(organization_id, user_id)`.

**Fields** (boilerplate `id` omitted):

<!-- dict:col:organization_members.organization_id -->
**`organization_id`** (FK → organizations.id, NOT NULL) — owning org; every membership query scopes on it.

<!-- dict:col:organization_members.user_id -->
**`user_id`** (FK → auth.users, NOT NULL, ON DELETE CASCADE) — the identity key (NOT email); email resolved via `auth.admin.getUserById` (auth.users isn't PostgREST-joinable). Deleting the auth user cascades the member row + its scope rows.

<!-- dict:col:organization_members.role -->
**`role`** (text, NOT NULL, default `'admin'`, **no CHECK**) — `OrgRole` (gotcha 1). Capability defaults per role in `ROLE_DEFAULTS` ([lib/roles.ts:30-66](../../../lib/roles.ts#L30)). `coach` routes the user to the premium Coaches Portal; PATCH role-change is limited to `admin|staff|official` and can never promote to owner.

<!-- dict:col:organization_members.capabilities -->
**`capabilities`** (jsonb, nullable) — per-member capability overrides (gotcha 3); `Record<Capability, boolean> | null`, sanitized to `ALL_CAPABILITY_KEYS`, empty→null. **Key catalog** = the `Capability` union ([lib/roles.ts:3-28](../../../lib/roles.ts#L3)): action caps (`create_tournaments`, `manage_registrations`, `manage_schedule_structure`, `update_schedule`, `submit_scores`, `check_in_teams`, `manage_contacts`, `post_announcements`, `post_rules`, `send_communications`, `seal_tournaments`, `manage_members`, `org_settings`, `billing`) + module gates (`module_tournaments`/`_communications`/`_members` default-on; `module_public_site`/`_accounting`/`_house_league`/`_rep_teams` default-off). Owner-only PATCH; **not written at invite time** (new members run on role defaults).

<!-- dict:col:organization_members.status -->
**`status`** (text, NOT NULL, default `'active'`; CHECK `invited|active|suspended`) — lifecycle: `invited` (pending-invite insert) → `active` (accept, or direct-add of an existing auth user) → `suspended`/`active` (owner-only toggle). Auth filters non-suspended; notification recipients filter `'active'` ([lib/notify.ts:122](../../../lib/notify.ts#L122)); owners can't be suspended.

<!-- dict:col:organization_members.invited_at -->
<!-- dict:col:organization_members.accepted_at -->
**`invited_at`** (timestamptz, NOT NULL, default now()) / **`accepted_at`** (timestamptz, nullable) — invite-sent (refreshed on re-invite) / invite-accepted (NULL = pending; set on accept or immediate direct-add).

<!-- dict:col:organization_members.display_name -->
<!-- dict:col:organization_members.title -->
**`display_name`** (text, nullable, CHECK len≤60) / **`title`** (text, nullable, CHECK len≤80) — member-facing name + role/title labels (UI only — members table). **Not used for registration contact routing** (that resolves the member's *auth* email via `getMemberEmail`).

---

## `org_member_rep_group_scopes`
<!-- dict:table:org_member_rep_group_scopes -->

**Purpose:** a **many-to-many join** restricting a non-privileged member to specific **rep-team groups**. Composite PK `(member_id, group_id)` — no surrogate id. **Absence of any row = unrestricted.**

**Gotchas (read first):**
1. **Scoping applies only to non-owner/admin/treasurer** — `getAuthContextWithRole` returns `repGroupIds:null` (unrestricted) for those roles and skips the query; for everyone else, rows → `repGroupIds` array, **zero rows → null (still unrestricted)** ([lib/api-auth.ts:145-154](../../../lib/api-auth.ts#L145)).
2. **A scope grants both visibility AND edit** to those groups' rep teams: `repGroupScopeGuard` 403s on out-of-scope teams (and blocks scoped members from **ungrouped** teams), and list routes filter `.in('group_id', repGroupIds)`.
3. **Edits are owner+admin only** — replace-all (delete+insert), validated against the caller's org's groups, audited as `rep_group_scope_changed` in `org_audit_log`.

**Fields:**

<!-- dict:col:org_member_rep_group_scopes.member_id -->
**`member_id`** (FK → organization_members.id, PK part, indexed) — the scoped member.

<!-- dict:col:org_member_rep_group_scopes.group_id -->
**`group_id`** (FK → rep_team_groups.id, PK part) — the granted rep-team group (**forward-link to the Rep domain**, documented later).

---

## `org_member_tournament_assignments`
<!-- dict:table:org_member_tournament_assignments -->

**Purpose:** scopes a non-owner member to specific **tournaments** — UNIQUE `(org_member_id, tournament_id)`. Same **absence-means-unrestricted** semantics as rep-group scopes.

**Gotchas (read first):**
1. **NOT the `notify_mode='assigned'` mechanism.** Phase-1 `notify_mode` resolves the division-vs-tournament *contact-member* email and never touches this table. This table's notify consumer is `lib/notify.ts`, which scopes **`staff`-role** recipients to their assigned tournaments ([lib/notify.ts:124-141](../../../lib/notify.ts#L124)) — owners/admins unrestricted, zero rows → unrestricted.
2. **Also gates `/api/admin/*` tournament access** — `getAuthContextWithScope` returns `assignedTournamentIds` (null for owner / for zero rows), and `scopeGuard` 403s when the list is non-null and excludes the tournament ([lib/api-auth.ts:192-250](../../../lib/api-auth.ts#L192)).
3. **Owners can't be assigned**; write requires `manage_members`, replace-all semantics, IDs validated to the caller's org. CASCADE-cleaned when the member's auth user is deleted.

**Fields** (boilerplate `id`, `created_at` omitted):

<!-- dict:col:org_member_tournament_assignments.org_member_id -->
**`org_member_id`** (FK → organization_members.id, NOT NULL, indexed) — the scoped member.

<!-- dict:col:org_member_tournament_assignments.tournament_id -->
**`tournament_id`** (FK → tournaments.id, NOT NULL, indexed) — the assigned tournament.

---

## `org_overrides`
<!-- dict:table:org_overrides -->

**Purpose:** **timed entitlement grants** — a platform admin grants an org a time-boxed access change (comp / trial / addon / status). Extended for timed grants in migration 109 (added `target`, `starts_at`, `suppress_billing`; CHECK widened to add `module_addon` + `plan_tier`).

**Gotchas (read first):**
1. **Enforcement is INERT by default.** `applyEntitlementGrants` is a no-op unless `ENTITLEMENT_GRANTS_ENABLED==='true'` ([lib/entitlement-grants.ts:23](../../../lib/entitlement-grants.ts#L23), [:95](../../../lib/entitlement-grants.ts#L95)). Wired into the org-build paths (`api-auth`, `db.ts`, `server-organizations`) but with the flag off (default) **no override has any access effect**.
2. **Start/expiry/revoke ARE enforced when on** — `isOverrideActive` requires `revoked_at IS NULL && starts_at<=now && expires_at>now` ([lib/entitlement-grants.ts:41-49](../../../lib/entitlement-grants.ts#L41)); revert is implicit (fall back to base plan, no cron). This **supersedes DBA Findings #22–24** (which described the pre-mig-109 state).
3. **Only 2 of 4 types have access effect.** `computeEffectiveEntitlements` handles `module_addon` (union `target.addons` into `enabledAddons`, [:71](../../../lib/entitlement-grants.ts#L71)) and `subscription_status` (force status, [:78](../../../lib/entitlement-grants.ts#L78)); `comp_period` is billing/founding-season-only, `plan_tier` is deferred (the write route even **rejects** creating a `plan_tier` override).
4. **`target.status`/`target.plan` are never written** — only `target.addons`. So the `subscription_status` reader always falls back to the legacy **`value`** column ([:80](../../../lib/entitlement-grants.ts#L80)).
5. **`suppress_billing` has NO reader** — written + echoed to the audit payload, never consumed. Inert.
6. **Mutations log to `platform_audit_log`, not `org_audit_log`** (POST `create_override`, DELETE `revoke_override`). `created_by`/`revoked_by` are free-text identity strings — a platform-admin email, or the literal `'system'` for the founding-season auto-grant ([app/api/auth/signup/route.ts:166](../../../app/api/auth/signup/route.ts#L166), [app/api/org/create/route.ts:92](../../../app/api/org/create/route.ts#L92)) — not FKs. (Those `'system'` grants are `comp_period`, so they're inert for access per gotcha 3 — founding-season free access isn't delivered through this enforcement path.)

**Fields** (boilerplate `id`, `created_at` omitted):

<!-- dict:col:org_overrides.org_id -->
**`org_id`** (FK → organizations.id ON DELETE CASCADE, NOT NULL) — the granted org; every query filters on it (partial index `idx_org_overrides_org_active` covers `WHERE revoked_at IS NULL`).

<!-- dict:col:org_overrides.type -->
**`type`** (text, NOT NULL; CHECK `subscription_status|comp_period|module_addon|plan_tier`) — grant discriminant (gotcha 3).

<!-- dict:col:org_overrides.value -->
**`value`** (text, nullable) — scalar grant value: the status string for `subscription_status` (the live reader path, gotcha 4); `null`/`'granted'` for `comp_period`; `null` for `module_addon` (data is in `target`).

<!-- dict:col:org_overrides.target -->
**`target`** (jsonb, nullable) — structured params. **Only key ever written: `addons: string[]`** (validated against `module_public_site|module_house_league|module_accounting|module_rep_teams`). `{status}`/`{plan}` exist in the `OverrideTarget` TS type but are never persisted.

<!-- dict:col:org_overrides.reason -->
**`reason`** (text, NOT NULL) — required human justification (blank rejected); shown in the admin UI.

<!-- dict:col:org_overrides.created_by -->
<!-- dict:col:org_overrides.revoked_by -->
**`created_by`** (text, NOT NULL) / **`revoked_by`** (text, nullable) — free-text actor strings (admin email, or `'system'` for founding-season auto-grants), not FKs (gotcha 6).

<!-- dict:col:org_overrides.starts_at -->
<!-- dict:col:org_overrides.expires_at -->
<!-- dict:col:org_overrides.revoked_at -->
**`starts_at`** (timestamptz, NOT NULL, default now()) / **`expires_at`** (timestamptz, nullable) / **`revoked_at`** (timestamptz, nullable) — the active window (gotcha 2). `starts_at` is never set explicitly (always now() — no future-dating); `revoked_at` is set on manual early termination (active-grant queries filter `.is('revoked_at', null)`). Founding-season grants use a fixed `expires_at` of `2027-01-01`.

<!-- dict:col:org_overrides.suppress_billing -->
**`suppress_billing`** (bool, NOT NULL, default false) — intended to suppress Stripe billing during a comp; **currently has no reader** (gotcha 5).

---

## `org_audit_log`
<!-- dict:table:org_audit_log -->

**Purpose:** the **org-scoped audit trail** of organization-member changes (role/capability/status/scope/membership). Distinct from `platform_audit_log` (platform-admin-wide, later phase). Owner-readable via `/api/admin/members/audit`.

**Gotchas (read first):**
1. **Written from exactly 3 org-member routes** (`invite`, member `[memberId]` PATCH/DELETE), all as fire-and-forget un-awaited inserts (failures silently ignored). No central audit helper — each call site inlines the insert.
2. **`actor_id`/`target_id` are uuids → `auth.users` but UNCONSTRAINED (no FK)** — resolved to emails at read time (`'Deleted user'` for purged accounts; null actor → `'System'`). `member_removed` is logged *after* the auth user is hard-deleted, so the email is captured into `payload.email` first.
3. **Append-only** — no revoke/soft-delete; rows vanish only via org-delete cascade.

**Action catalog (verified write sites, `app/api/admin/members/{invite,[memberId]}/route.ts`):** `member_invited` `{email,role}` · `member_removed` `{email,role}` · `role_changed` `{before,after}` · `capabilities_changed` `{before,after}` · `member_suspended`/`member_reinstated` `{}` · `rep_group_scope_changed` `{groupIds}`.

**Fields** (boilerplate `id`, `created_at` omitted):

<!-- dict:col:org_audit_log.org_id -->
**`org_id`** (FK → organizations.id, NOT NULL, indexed `(org_id, created_at DESC)`) — owning org; reads filter on it.

<!-- dict:col:org_audit_log.actor_id -->
<!-- dict:col:org_audit_log.target_id -->
**`actor_id`** (uuid, nullable, no FK) / **`target_id`** (uuid, nullable, no FK) — the acting user / the affected member's `user_id` (gotcha 2).

<!-- dict:col:org_audit_log.action -->
**`action`** (text, NOT NULL) — the event type (see catalog).

<!-- dict:col:org_audit_log.payload -->
**`payload`** (jsonb, nullable) — per-action detail (shapes in the catalog); read raw + summarized in the audit UI.

---

## `org_internal_notes`
<!-- dict:table:org_internal_notes -->

**Purpose:** **platform-admin CRM notes about an org** — structured, timestamped, soft-deletable support notes. The real notes feature (vs. the legacy scalar `organizations.internal_notes`); backfilled from that scalar in migration 054.

**Gotchas (read first):**
1. **Distinct from `organizations.internal_notes`** (the scalar is legacy + UAT sentinel). The org list page counts table rows and only falls back to the scalar when there are zero.
2. **Created/updated/deleted-by are EMAIL strings, not FKs** (admin email, fallback `'platform-admin'`; `'migration_054'` on backfilled rows).
3. **Soft-delete** — DELETE is an UPDATE setting `deleted_at` + `deleted_by_email`; all reads filter `.is('deleted_at', null)` (two partial indexes split live vs. deleted rows).
4. **Mutations log to `platform_audit_log`.** Read = any platform admin; write = `manage_support` permission. Body ≤ 4000 chars.

**Fields** (boilerplate `id`, `created_at`, `updated_at` omitted):

<!-- dict:col:org_internal_notes.org_id -->
**`org_id`** (FK → organizations.id ON DELETE CASCADE, NOT NULL) — owning org; the partial indexes lead on it.

<!-- dict:col:org_internal_notes.body -->
**`body`** (text, NOT NULL) — the note text (≤4000, trimmed, non-empty).

<!-- dict:col:org_internal_notes.created_by_email -->
<!-- dict:col:org_internal_notes.updated_by_email -->
<!-- dict:col:org_internal_notes.deleted_at -->
<!-- dict:col:org_internal_notes.deleted_by_email -->
**`created_by_email`** (NOT NULL) / **`updated_by_email`** (nullable) / **`deleted_at`** (timestamptz, nullable — soft-delete tombstone) / **`deleted_by_email`** (nullable) — authorship + soft-delete audit, all email strings (gotcha 2).

---

## `org_public_site_content`
<!-- dict:table:org_public_site_content -->

**Purpose:** the editable copy + display toggles for an org's **public home page** (the Public Site module) — one row per org (UNIQUE `org_id`, strict 1:1). **Holds the org's public `contact_email`** that `organizations` lacks. Mapped by `getOrgPublicSiteContent` / `upsertOrgPublicSiteContent` ([lib/db.ts:2046-2092](../../../lib/db.ts#L2046)).

**Gotchas (read first):**
1. **This is where the org public contact email lives** — `organizations` has no `contact_email` (domain gotcha). Surfaced as the public "Contact Us" `mailto:`. The general `Organization.contactEmail` is *not* hydrated from here (it's a dead read on the org row, always null); only the `team-org-links` path injects this value onto an org row.
2. **The `contact_email` ILIKE is a reverse lookup** — `findLinkableOrg` does `.ilike('contact_email', value)` against this table to find the owning org by a coach/team's contact email ([lib/team-org-links.ts:311-318](../../../lib/team-org-links.ts#L311)). Orgs with no row / null email are unreachable; duplicates resolve arbitrarily (`.limit(1)`).
3. **Missing row = soft defaults, never an error** — `getOrgPublicSiteContent` returns null, and consumers treat null as "sections on" (`!== false`). An org with no row still renders a public home.
4. **Upsert wipes unsupplied fields to null** — it's a full-row upsert (`onConflict: 'org_id'`), not a partial patch; the PATCH route always sends the complete form.
5. **League/Club only** — both GET and PATCH gate on `module_public_site` (capability + entitlement), granted only to League and Club plans. Tournament/Tournament-Plus get the generic FieldLogicHQ-branded fallback home; the editor is invisible.

**Fields** (boilerplate `id`, `created_at`, `updated_at` omitted):

<!-- dict:col:org_public_site_content.org_id -->
**`org_id`** (FK → organizations.id ON DELETE CASCADE, NOT NULL, UNIQUE) — owning org; the real access/lookup key (1:1).

<!-- dict:col:org_public_site_content.tagline -->
**`tagline`** (text, nullable) — short hero headline below the org name (≤100 chars, server-clamped).

<!-- dict:col:org_public_site_content.description -->
**`description`** (text, nullable) — the longer "About" hero paragraph (≤1000 chars).

<!-- dict:col:org_public_site_content.contact_email -->
**`contact_email`** (text, nullable) — the org's **public** contact email (gotchas 1–2); ≤254 chars, no server-side format validation (HTML `type=email` only).

<!-- dict:col:org_public_site_content.social_instagram -->
<!-- dict:col:org_public_site_content.social_facebook -->
<!-- dict:col:org_public_site_content.social_x -->
<!-- dict:col:org_public_site_content.social_website -->
**Social block** (`social_instagram`, `social_facebook`, `social_x` [Twitter/X], `social_website`) — outbound links rendered in the public hero; **https-only**, sanitized server-side (`/^https:\/\/.+/`, ≤500 chars, else stored null).

<!-- dict:col:org_public_site_content.show_upcoming_tournaments -->
<!-- dict:col:org_public_site_content.show_archives_link -->
**`show_upcoming_tournaments`** / **`show_archives_link`** (bool, NOT NULL, default true) — public-home section toggles (gated `!== false`, so null = shown); the archives link additionally requires archives to exist.

---

*End of Org / Platform core domain. `organizations` carries the Stripe/billing **columns** documented here; the Stripe/Billing phase adds the `stripe_prices` table + the billing-flow narrative. `platform_audit_log` (where override + internal-note mutations are logged) and the `platform_*`/`plan_*` control plane are the Platform-admin phase. `rep_team_groups` (FK target of `org_member_rep_group_scopes.group_id`) is the Rep domain.*

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
**`settings`** (jsonb, NOT NULL, default `'{}'`) — schema-less per-tournament prefs; new keys need no migration (add to `TournamentSettings`, [lib/types.ts:28](../../../lib/types.ts#L28)). Merge-patched via `updateTournamentSettings` (read-merge-write). **Key catalog:** `format` (`round_robin_playoffs|playoff_only`), `rulesLayout` (`columns|single`), `resourcesLayout` (`list|grid`), `game_duration_minutes` (default 90, read in `resolveGameTiming`), `buffer_minutes` (default 15), `schedule_travel_venue_buffer_minutes`, `schedule_travel_facility_buffer_minutes`, `game_timing_scope`, `tie_breakers`, `tie_breaker_scope`, `fee_scope` (incl. `'free'`; shadows `fee_schedule_mode`), `show_fees_on_register`, `payment_instructions`, `payment_instructions_on_form`, `coach_email_confirmation`, `coach_email_acceptance`, `coach_email_rejection`, `coach_email_payment` (per-tournament on/off for the automatic transactional coach emails — absent/`true` = enabled; only explicit `false` disables; read via `coachEmailEnabled` [lib/email.ts], set in Event Settings → Notifications & Contact). **Gotcha:** `playoff_game_duration_minutes` is **NOT** here anymore — removed by mig 112 in favor of per-game `games.duration_minutes`.

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

*End of Tournaments & Registration domain. Deferred (active free-tier work): `tournament_roster_players` (the per-event snapshot — documented when the Phase 5 submit/snapshot lands); its persistent master `basic_coach_team_players` is now built + documented in the Coaches / basic-teams domain (free-tier Phase 3, mig 114). Remaining domains (Org/Platform core, Rep teams, League, Accounting, Stripe/Billing, Platform admin, CRM, Notifications & Push) are enumerated in [DATA_DICTIONARY_PLAN.md](../../projects/active/DATA_DICTIONARY_PLAN.md) §5.*

---

# Domain: Coaches / basic-teams

Two halves bridged by an upgrade: the **free Basic Coaches Portal** (`basic_coach_*` — org-less, email-*stamped*, membership-gated) and the **standalone "Team" (Premium) workspace plumbing** (`team_workspaces` + its children — a per-team provisioned org with its own billing). A free Basic team upgrades into a paid workspace via a bidirectional bridge. The workspace tables forward-link into the **rep_\*** franchise module (Rep domain, a later phase — not documented here).

### Gotchas first (the cross-cutting traps)

- **Identity is membership, not email.** Basic-team access resolves through `basic_coach_team_users` on `user_id` + `status='active'` ([lib/basic-coach-teams.ts:147-180](../../../lib/basic-coach-teams.ts#L147-L180)). `primary_coach_email` is a *stamped contact value*, **not** the live access key.
- **One surviving exact-email path** — `getPendingTournamentRegistrationForUser` matches `teams.email` by **exact normalized equality** (`normalizeEmail(...) === email`, [lib/basic-coach-teams.ts:220](../../../lib/basic-coach-teams.ts#L220)), **not `ILIKE`**. This is the "claim my tournament registration" flow; it then creates an explicit link row.
- **Coach↔tournament linkage is a ROW**, keyed on `teams.id` — `basic_coach_team_registrations` (`tournament_team_id` UNIQUE). Never an email match. (Migration 092 removed the old `'email_fallback'` access path entirely.)
- **The 4 workspace tables (`team_workspaces`, `team_org_links`, `team_workspace_claims`, `team_entitlements`) are RLS-enabled but have NO client policies** — service-role (`supabaseAdmin`) only. `workspace_org_id` is the **required RLS tenancy anchor** for all four ([DB_ARCHITECTURE_REVIEW.md:316](DB_ARCHITECTURE_REVIEW.md)).
- **Dev/prod drift:** the original 3 `basic_coach_*` + 4 workspace tables are zero-drift (snapshot 2026-06-08). The free-tier branch's new Basic-floor tables are **dev-only until the branch deploys** — `basic_coach_team_players` (mig 114), `basic_coach_team_events` (115), `basic_coach_team_fees` (116), and `basic_coach_team_announcements` (117). This is intentional, not a bug.

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

## `basic_coach_team_players`
<!-- dict:table:basic_coach_team_players -->

**Purpose:** the **persistent master roster** for a free Basic team (free-tier Phase 3, mig 114). The coach enters players **once** on the org-less team home (`/coaches/team/[basicTeamId]`) and reuses them across events. **Identity only** — name / jersey # / optional guardian contact / optional DOB / note + a display order. The free coach floor's substance.

**Gotchas (read first):**
1. **Dev-only until deploy.** Mig 114 is applied to **dev**; prod does not have this table yet (it lands when `feat/free-tier-coaches` merges to master). Expect it in `DRIFT_dev_vs_prod.md` as a dev-only table — that drift is **intentional**, not a bug.
2. **Identity-only, by policy.** NO attendance, lineups, positions, dues, or documents columns — those are **Premium** and must never be added here (FT strategy §10; "roster fields scoped to Basic", §12). `display_order` is list ordering, **not** a lineup/batting order.
3. **`date_of_birth` is privacy-gated minor PII.** Optional + purpose-driven (division eligibility). The editor never shows it by default — it's behind an explicit opt-in with a guardian-consent acknowledgment (FT §5/§14). A *persisted* consent audit trail is deferred to Phase 8; today the gate is UI-enforced only.
4. **Ownership = `basic_coach_team_users` membership**, same as the rest of the family — there is no `org_id` and no per-row owner column beyond the team FK. RLS-enabled with **no policies** = `supabaseAdmin` only; the API gates on `userOwnsBasicCoachTeam` ([lib/basic-coach-roster.ts](../../../lib/basic-coach-roster.ts)).
5. **Snapshot source for Phase 5.** Column shape (single `name`, `jersey_number` text, `date_of_birth` date) deliberately mirrors `tournament_roster_players` (mig 110) so the per-event submit/snapshot is a clean copy; the back-link (`source_player_id` on the snapshot table) lands in Phase 5, not here.
6. **Upgrade-ready.** When a Basic team upgrades, the master seeds the paid workspace roster via `basic_coach_teams.team_workspace_id` (a per-program-year shape-translation, wired in a later phase) — no rebuild required.

**Fields** (boilerplate `id`, `created_at`, `updated_at` omitted):

<!-- dict:col:basic_coach_team_players.basic_coach_team_id -->
**`basic_coach_team_id`** (FK → `basic_coach_teams.id` ON DELETE CASCADE, NOT NULL) — the team; the only structural anchor (no `org_id`).

<!-- dict:col:basic_coach_team_players.name -->
**`name`** (text, NOT NULL) — player display name, single field (NOT split first/last — matches the `tournament_roster_players` snapshot target).

<!-- dict:col:basic_coach_team_players.jersey_number -->
**`jersey_number`** (text, nullable) — jersey #; **text** so leading zeros / non-numeric are allowed (mirrors `tournament_roster_players`).

<!-- dict:col:basic_coach_team_players.date_of_birth -->
**`date_of_birth`** (date, nullable) — **privacy-gated minor PII** (gotcha 3). Optional, purpose-driven; never a default editor field.

<!-- dict:col:basic_coach_team_players.guardian_name -->
<!-- dict:col:basic_coach_team_players.contact_email -->
<!-- dict:col:basic_coach_team_players.contact_phone -->
**`guardian_name` / `contact_email` / `contact_phone`** (text, nullable) — optional guardian/parent contact. Powers Phase 4 basic team comms (announce to parents; parents are contacts, not accounts). All optional.

<!-- dict:col:basic_coach_team_players.notes -->
**`notes`** (text, nullable) — coach free-text note (e.g. "left-handed", allergy reminder — coach-discretion, not a structured medical field).

<!-- dict:col:basic_coach_team_players.display_order -->
**`display_order`** (int, NOT NULL, default `0`) — coach-controlled list order (gotcha 2); lower sorts first. Written by the reorder endpoint.

<!-- dict:col:basic_coach_team_players.created_by_user_id -->
**`created_by_user_id`** (uuid, nullable, **no FK** — mirrors `tournament_roster_players`) — audit of who added the player.

---

## `basic_coach_team_events`
<!-- dict:table:basic_coach_team_events -->

**Purpose:** the **lightweight schedule** for a free Basic team (free-tier Phase 4, mig 115). A coach adds practices/games on the org-less team home; parents (roster contacts) are reached via comms (Phase 4c), not by logging in. The flattened, org-less cousin of the Premium `rep_team_events` power-calendar.

**Gotchas (read first):**
1. **Dev-only until deploy** (mig 115, applied to dev). Expect it in `DRIFT_dev_vs_prod.md` until `feat/free-tier-coaches` merges to master.
2. **Basic-grade by policy.** NO scores, attendance, lineups, recurrence engine, or tournament-game nesting — all Premium (`rep_team_events` carries `recurrence_rule` jsonb, `home_score`/`away_score`/`result`, a `rep_team_event_attendance` child, and org/program-year scoping; **none** of that here).
3. **`opponent` is free text, no FK.** A basic team only knows itself — unlike `league_games` (home/away team FKs). Structured matchups are Premium.
4. **No recurrence.** Each session is its own row. If "weekly practice" is wanted cheaply later, add a no-FK `recurrence_group_id uuid` like `league_practices` — not rep's jsonb engine.
5. **Ownership = `basic_coach_team_users` membership** (same as the rest of the family); no `org_id`. RLS-enabled, no policies = `supabaseAdmin` only; the API gates on `userOwnsBasicCoachTeam` ([lib/basic-coach-schedule.ts](../../../lib/basic-coach-schedule.ts)).

**Fields** (boilerplate `id`, `created_at`, `updated_at` omitted):

<!-- dict:col:basic_coach_team_events.basic_coach_team_id -->
**`basic_coach_team_id`** (FK → `basic_coach_teams.id` ON DELETE CASCADE, NOT NULL) — the team; the only structural anchor (no `org_id`).

<!-- dict:col:basic_coach_team_events.event_type -->
**`event_type`** (text, NOT NULL, default `'practice'`; CHECK `practice|game|event`) — collapses rep's 6 event types to 3. `game` surfaces the `opponent` field in the editor.

<!-- dict:col:basic_coach_team_events.title -->
**`title`** (text, NOT NULL) — event label (e.g. "Practice", "vs Rivals").

<!-- dict:col:basic_coach_team_events.opponent -->
**`opponent`** (text, nullable) — free-text opponent for game-type events (gotcha 3).

<!-- dict:col:basic_coach_team_events.location -->
**`location`** (text, nullable) — free-text venue/address.

<!-- dict:col:basic_coach_team_events.starts_at -->
**`starts_at`** (timestamptz, NOT NULL) — event start; the primary list/sort key (`ORDER BY starts_at`). No recurrence (gotcha 4).

<!-- dict:col:basic_coach_team_events.ends_at -->
**`ends_at`** (timestamptz, nullable) — optional end time. CHECK `basic_coach_team_events_time_check` enforces `ends_at is null or ends_at >= starts_at` (an event can't end before it starts).

<!-- dict:col:basic_coach_team_events.notes -->
**`notes`** (text, nullable) — coach free-text note (bring water, arrive early, etc.).

<!-- dict:col:basic_coach_team_events.status -->
**`status`** (text, NOT NULL, default `'scheduled'`; CHECK `scheduled|cancelled`) — Phase 4a removes events via DELETE; `cancelled` is reserved for a future "tell parents it's off" flow.

<!-- dict:col:basic_coach_team_events.created_by_user_id -->
**`created_by_user_id`** (uuid, nullable, **no FK** — mirrors the rest of the family) — who added the event.

---

## `basic_coach_team_fees`
<!-- dict:table:basic_coach_team_fees -->

**Purpose:** the **manual fee ledger** for a free Basic team (free-tier Phase 4b, mig 116). A coach records what a roster player, or the team as a whole, owes and manually marks each entry paid/unpaid. **Tracking only** - no Stripe, no online collection, no partial payments, no installments, no dues automation, no accounting integration.

**Gotchas (read first):**
1. **Dev-only until deploy** (mig 116, applied to dev). Expect it in `DRIFT_dev_vs_prod.md` until `feat/free-tier-coaches` merges to master.
2. **Manual ledger by policy.** `status` is binary (`unpaid|paid`) and `marked_paid_at` is just the coach's manual stamp. Do not add processor ids, payment links, installment state, reminder state, or "partial" here - those belong to Premium/future payment-processing work.
3. **`player_id` is optional and lossy by design.** NULL means team-wide/unassigned. The FK is `ON DELETE SET NULL`, so deleting a player keeps the ledger row as an unassigned historical/team charge instead of deleting money history.
4. **Same-team player validation is app-layer.** The DB FK proves `player_id` exists, but not that it belongs to the same `basic_coach_team_id`. `lib/basic-coach-fees.ts` validates the selected player against the team before create/update, and every mutation also scopes by `basic_coach_team_id`.
5. **Money convention follows the rest of the app.** Amount is `numeric(10,2)` dollars (not integer cents), matching tournament fee fields, league registration fees, accounting entries, and rep dues. Stripe cents exist only in Stripe-facing code, not manual ledgers.
6. **Ownership = `basic_coach_team_users` membership** (same as roster/schedule); no `org_id`. RLS-enabled, no policies = `supabaseAdmin` only; the API gates on `userOwnsBasicCoachTeam` via `requireBasicCoachTeamOwner`.

**Fields** (boilerplate `id`, `created_at`, `updated_at` omitted):

<!-- dict:col:basic_coach_team_fees.basic_coach_team_id -->
**`basic_coach_team_id`** (FK to `basic_coach_teams.id` ON DELETE CASCADE, NOT NULL) - the team; the only structural anchor (no `org_id`).

<!-- dict:col:basic_coach_team_fees.player_id -->
**`player_id`** (FK to `basic_coach_team_players.id` ON DELETE SET NULL, nullable) - optional roster-player link; NULL means team-wide/unassigned (gotchas 3-4).

<!-- dict:col:basic_coach_team_fees.label -->
**`label`** (text, NOT NULL) - coach-entered fee label (e.g. tournament fee, jersey deposit, pizza night).

<!-- dict:col:basic_coach_team_fees.amount -->
**`amount`** (numeric(10,2), NOT NULL, default `0`, CHECK `>= 0`) - manual dollar amount (gotcha 5). Server accepts only up to two decimals and stores a normalized decimal string.

<!-- dict:col:basic_coach_team_fees.status -->
**`status`** (text, NOT NULL, default `'unpaid'`; CHECK `unpaid|paid`) - binary V1 state only (gotcha 2).

<!-- dict:col:basic_coach_team_fees.marked_paid_at -->
**`marked_paid_at`** (timestamptz, nullable) - manual paid timestamp. CHECK `basic_coach_team_fees_paid_at_check` keeps paid rows stamped and unpaid rows null; toggled in app code.

<!-- dict:col:basic_coach_team_fees.notes -->
**`notes`** (text, nullable) - coach free-text note.

<!-- dict:col:basic_coach_team_fees.display_order -->
**`display_order`** (int, NOT NULL, default `0`) - coach ledger ordering within the team; lower sorts first. Create appends to the current max; no reorder UI yet.

<!-- dict:col:basic_coach_team_fees.created_by_user_id -->
**`created_by_user_id`** (uuid, nullable, **no FK** - mirrors the rest of the family) - who added the fee.

---

## `basic_coach_team_announcements`
<!-- dict:table:basic_coach_team_announcements -->

**Purpose:** the **one-way team-announcement email log** for a free Basic team (free-tier Phase 4c, mig 117). A coach writes a subject/body and the app sends it to the team's deduped roster `contact_email` values, then records counts and status. **Roster-contact email only** - no parent accounts, arbitrary recipients, chat, replies inbox, SMS/push, payment reminders, dues automation, or Premium pitch surface.

**Gotchas (read first):**
1. **Dev-only until deploy** (mig 117, applied to dev). Expect it in `DRIFT_dev_vs_prod.md` until `feat/free-tier-coaches` merges to master.
2. **Recipient emails are intentionally not stored.** The log stores `recipient_count`, `sent_count`, and `failed_count`, not the actual email addresses. Runtime recomputes/dedupes valid emails from `basic_coach_team_players.contact_email` at send time.
3. **Not a messaging system.** There are no threads, replies, read receipts, parent accounts, SMS/push, or reminder jobs. If code needs any of that, it belongs in a future comms design, not this Basic log.
4. **Free-floor abuse caps live in app code.** 4c caps a send at 100 deduped contacts and 10 announcement logs per team per rolling 24h. This table stores the logs used by the throttle; there is no DB constraint for those policy numbers.
5. **Email result semantics follow provider acceptance.** `sent_count` increments only when `sendEmail` reports a real provider send; missing API key / provider rejection / thrown errors increment `failed_count`.
6. **Ownership = `basic_coach_team_users` membership** (same as roster/schedule/fees); no `org_id`. RLS-enabled, no policies = `supabaseAdmin` only; the API gates on `userOwnsBasicCoachTeam` via `requireBasicCoachTeamOwner`.

**Fields** (boilerplate `id`, `created_at`, `updated_at` omitted):

<!-- dict:col:basic_coach_team_announcements.basic_coach_team_id -->
**`basic_coach_team_id`** (FK to `basic_coach_teams.id` ON DELETE CASCADE, NOT NULL) - the team; the only structural anchor (no `org_id`).

<!-- dict:col:basic_coach_team_announcements.subject -->
**`subject`** (text, NOT NULL, CHECK non-empty and `<= 160`) - coach-entered email subject, trimmed in app code.

<!-- dict:col:basic_coach_team_announcements.body -->
**`body`** (text, NOT NULL, CHECK non-empty and `<= 4000`) - coach-entered plain-text message. The app HTML-escapes it before email send.

<!-- dict:col:basic_coach_team_announcements.recipient_count -->
**`recipient_count`** (int, NOT NULL, default `0`, CHECK `>= 0`) - deduped valid roster-contact email count targeted at send time (gotcha 2).

<!-- dict:col:basic_coach_team_announcements.sent_count -->
**`sent_count`** (int, NOT NULL, default `0`, CHECK `>= 0`) - number of provider-accepted email sends (gotcha 5).

<!-- dict:col:basic_coach_team_announcements.failed_count -->
**`failed_count`** (int, NOT NULL, default `0`, CHECK `>= 0`) - number of skipped/rejected/thrown send attempts. CHECK `basic_coach_team_announcements_counts_check` keeps `sent_count + failed_count <= recipient_count`.

<!-- dict:col:basic_coach_team_announcements.status -->
**`status`** (text, NOT NULL, default `'sent'`; CHECK `sent|partial|failed`) - derived from `sent_count`/`failed_count` after the send loop.

<!-- dict:col:basic_coach_team_announcements.sent_at -->
**`sent_at`** (timestamptz, NOT NULL, default `now()`) - send-log display/sort timestamp. App sets it when the send loop completes.

<!-- dict:col:basic_coach_team_announcements.created_by_user_id -->
**`created_by_user_id`** (uuid, nullable, **no FK** - mirrors the rest of the family) - who initiated the announcement send.

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

*End of Coaches / basic-teams domain. `basic_coach_team_players` (free-tier Phase 3, mig 114) is documented above. Deferred: the per-event snapshot back-link `tournament_roster_players.source_player_id` (free-tier Phase 5).*

---

# Domain: Rep teams / team workspaces

The **franchise / rep-team module**: a club's competitive ("rep"/travel) teams, each run by its own coaches season-by-season. `rep_teams` is the hub; everything operational hangs off a **program year** (`rep_program_years` — one row per team per year, the season-scoping spine). This domain splits into two halves under one heading: **Rep operations** (teams, seasons, roster, coaches, events, attendance, lineups, tryouts, documents — first subsection) and **Rep finance** (budgets, player dues, fundraisers, cost allocations, expenses, payment requests, season surplus — `## Rep finance` subsection below). The **4 `team_workspace_*` tables that the coverage classifier also files under this domain are documented in the Coaches / basic-teams domain** (Standalone team workspaces) — their forward-links (`team_workspaces.rep_team_id`, `.active_program_year_id`, `team_entitlements.rep_team_id`, `team_org_links.rep_team_id`) land here.

### Gotchas first (the cross-cutting traps)

- **`program_year_id` is the season spine — and "the active program year" is `draft` OR `active`, newest-wins.** Almost every rep-ops table denormalizes `(program_year_id, team_id, org_id)`. The coach-side resolver `getActiveRepProgramYear` returns the newest row with status **`draft` or `active`** ([lib/db.ts:4205](../../../lib/db.ts#L4205)) — **not** just `active`. So a brand-new `draft` season is already "active" for coach operations *and* already billable (`getActiveRepTeamCount` counts `draft`+`active`, [lib/db.ts:3858](../../../lib/db.ts#L3858)). Public tryouts are the exception — they require `status='active' AND tryout_open=true` ([lib/db.ts:3762](../../../lib/db.ts#L3762)).
- **RLS is enabled on all 25 tables (12 operations + 13 finance) but is NOT the enforcement layer.** Every reader/writer goes through `supabaseAdmin` (service-role, bypasses RLS); the only RLS policies are `SELECT`-only defense-in-depth. Authorization is entirely app-layer.
- **Rep finance is the team's books; the org's books are the separate Accounting domain.** The 13 `## Rep finance` tables are TEAM-scoped. They meet the ORG-scoped **Accounting** domain (`accounting_entries`, `accounting_ledgers`, `org_budget_lines`/`_periods`, `budget_categories`, `budget_items`, `org_payees` — a later phase) only at a few catalogued FK edges, and there is **no Stripe surface here** (settlement is internal double-entry; see the `## Rep finance` gotchas). **Watch the dual-budget-line trap:** a `budget_line_id`/`source_budget_line_id` FK points at the team `rep_budget_lines` on the dues/period side but at the org `org_budget_lines` on the allocation/payment-request side.
- **Two access surfaces, two gates (the franchise model).** Org-admin side (`app/api/admin/rep-teams/*`): `getAuthContextWithRole` + `module_rep_teams` capability + `hasModuleEntitlement` + `repGroupScopeGuard`; **mutations additionally require `role` ∈ `owner|admin`**. Coach-operator side (`app/api/coaches/[orgSlug]/teams/[teamId]/*`): `resolveCoachContext` — **a membership row in `rep_team_coaches` IS the gate** (no capability/entitlement check on most coach routes). Coaches own the operational writes; admins set up + read.
- **`rep_team_groups` is the staff-scoping anchor.** `org_member_rep_group_scopes.group_id → rep_team_groups.id` (Org / Platform core domain). A scoped member only sees teams whose `group_id` is in their list — **and an ungrouped team (`group_id IS NULL`) is invisible to every scoped member** ([lib/api-auth.ts:164](../../../lib/api-auth.ts#L164)). (Owners/admins/treasurers are unrestricted.)
- **`auth.users` FK introspection gap.** Several columns (`rep_team_coaches.user_id`, `*.updated_by`, `*.published_by`, `*.uploaded_by`) FK to `auth.users(id)`, but the snapshot's constraints dump shows `foreign_table: null` for them — it only introspects the `public` schema. They are **constrained**, not loose.
- **Denormalization is pervasive and intentional** — `team_id`/`org_id` are copied onto child rows reachable via parent FKs (index/query convenience); one `SECURITY DEFINER` trigger keeps `rep_team_event_attendance`'s scope columns synced to its event.
- **Dev/prod:** all 25 Rep tables (12 operations + 13 finance) are **zero-drift** (snapshot 2026-06-09) — column-, constraint-, and CHECK-identical across dev+prod.

---

## Rep operations

> The franchise module's **operational** tables. `rep_teams` (hub) → `rep_program_years` (season spine) → roster / coaches / events / attendance / lineups / tryouts / documents. The **13 `rep_*` finance tables** (`rep_team_expenses`, `rep_player_dues_*`, `rep_budget_*`, `rep_fundraisers`/`_entries`, `rep_cost_allocations`, `rep_allocation_*`, `rep_dues_credits`, `rep_season_surplus`, `rep_team_payment_requests`) are **Phase 4b** — appended under this same heading later.

### `rep_teams`
<!-- dict:table:rep_teams -->

**Purpose:** the **hub** of the module — one canonical rep/franchise team per org (e.g. "U13 Tier 1 Wildcats"). Identity + presentation only; all season-scoped data hangs off `rep_program_years`, never here. Hydrated to `RepTeam` ([lib/db.ts:3643](../../../lib/db.ts#L3643)).

**Gotchas (read first):**
1. **No season or billing state on this table.** Whether a team is "billable/active" is computed from its program-year statuses — `getActiveRepTeamCount` counts distinct `team_id`s in `rep_program_years` with status `draft`|`active` ([lib/db.ts:3858](../../../lib/db.ts#L3858)). A team whose only years are `completed`/`archived` is not billable even with `is_archived=false`.
2. **`is_archived` is a soft-hide for the admin list only** — independent of billing and of program-year status. Archiving does **not** complete/archive program years and does **not** trigger a Stripe sync.
3. **No hard-delete from the UI.** `deleteRepTeam` ([lib/db.ts:3848](../../../lib/db.ts#L3848)) does a hard `DELETE` but is wired to **no HTTP route**; the only user-facing removal is `is_archived=true` via PATCH. Rows otherwise die only by FK CASCADE.
4. **`slug` is the PUBLIC URL key, addressed internally by UUID `teamId`.** Public team + tryout pages resolve `getRepTeamBySlug` ([lib/db.ts:3785](../../../lib/db.ts#L3785)); the coach portal never uses it. Create slugifies the name with **no min length**, but `bulkRenameTeamSlugs` enforces 3–80 chars, lowercase alphanumeric with internal hyphens (no leading/trailing hyphen) — so existing slugs can violate the bulk-rename rule.
5. **Create triggers `syncRepTeamBilling` ONLY when `org.planId==='club'`** (fire-and-forget). Non-Club orgs never sync on team create.

**Fields** (boilerplate `id`, `created_at`, `updated_at` omitted):

<!-- dict:col:rep_teams.org_id -->
**`org_id`** (FK → `organizations.id`, NOT NULL) — tenant scope; part of `UNIQUE(org_id, slug)`. Routes re-check `team.orgId !== ctx.org.id` → 404.

<!-- dict:col:rep_teams.name -->
**`name`** (text, NOT NULL) — display name; max 100 chars on create.

<!-- dict:col:rep_teams.slug -->
**`slug`** (text, NOT NULL, `UNIQUE(org_id, slug)`) — the public URL segment (gotcha 4). **Not editable via the team PATCH** (`updateRepTeam` has no slug field) — only via `bulkRenameTeamSlugs`; 23505 → 409.

<!-- dict:col:rep_teams.sport -->
**`sport`** (text, NOT NULL, default `'softball'`) — free text, no enum.

<!-- dict:col:rep_teams.division -->
**`division`** (text, nullable) — display label (e.g. "U13 Tier 1"); **not** a FK to any divisions table.

<!-- dict:col:rep_teams.description -->
**`description`** (text, nullable) — free text.

<!-- dict:col:rep_teams.color -->
**`color`** (text, nullable) — team accent (hex); stored verbatim, no validation; drives team theming.

<!-- dict:col:rep_teams.group_id -->
**`group_id`** (FK → `rep_team_groups.id`, nullable) — the grouping/folder link **and the member-scoping key** (see domain gotchas + `rep_team_groups`). Set on create or via `setRepTeamGroup` ([lib/db.ts:3742](../../../lib/db.ts#L3742)); **not** in `updateRepTeam`. Read denormalizes the group name via join → `RepTeam.groupName`.

<!-- dict:col:rep_teams.is_archived -->
**`is_archived`** (bool, NOT NULL, default false) — soft-hide for the admin team list (gotchas 2–3); the only PATCH-able boolean.

### `rep_team_groups`
<!-- dict:table:rep_team_groups -->

**Purpose:** named folders within an org used both to organize rep teams in the admin UI **and** to scope which teams a restricted staff member may see.

**Gotchas (read first):**
1. **This table is the access-control anchor for restricted org members.** `org_member_rep_group_scopes.group_id → rep_team_groups.id`. `getAuthContextWithRole` reads those scope rows ([lib/api-auth.ts:149](../../../lib/api-auth.ts#L149)): owners/admins/treasurers → `repGroupIds=null` (unrestricted); any other role with scope rows → the restricted id list. `repGroupScopeGuard` then 403s if a team's `groupId` isn't in the list — **and 403s on ungrouped teams** ([lib/api-auth.ts:164](../../../lib/api-auth.ts#L164)). (The Org / Platform core domain's note that staff-notify scoping is a *separate* mechanism still holds — that's `org_member_tournament_assignments` via `lib/notify.ts`, not this table.)
2. **Delete is guarded in app code, not by FK** — `deleteRepTeamGroup` counts teams with that `group_id`; >0 → `GROUP_HAS_TEAMS` 409 ([lib/db.ts:3729](../../../lib/db.ts#L3729)). Reassign teams first.
3. **Uniqueness is case-insensitive** via `UNIQUE INDEX (org_id, lower(name))`; the app trims but does **not** lowercase before insert, so display casing is preserved while collisions are case-insensitive (23505 → 409).
4. **No `updated_at`** (only `created_at`).

**Fields** (boilerplate `id`, `created_at` omitted):

<!-- dict:col:rep_team_groups.org_id -->
**`org_id`** (FK → `organizations.id`, NOT NULL) — tenant scope.

<!-- dict:col:rep_team_groups.name -->
**`name`** (text, NOT NULL; CHECK `1 ≤ char_length(trim(name)) ≤ 50`; `UNIQUE(org_id, lower(name))`) — folder name; denormalized onto `RepTeam.groupName` via join.

<!-- dict:col:rep_team_groups.display_order -->
**`display_order`** (int, NOT NULL, default 0) — sort key (list orders by `display_order` then `name`); no uniqueness.

### `rep_program_years`
<!-- dict:table:rep_program_years -->

**Purpose:** the **per-season scoping spine** — one row per team per calendar year (`UNIQUE(team_id, year)`); the season container nearly every other rep-ops table denormalizes a `program_year_id` onto. `team_workspaces.active_program_year_id → rep_program_years.id` (set at provisioning [lib/team-workspace-provisioning.ts:282](../../../lib/team-workspace-provisioning.ts#L282), read in `lib/team-workspace-entitlements.ts`).

**Gotchas (read first):**
1. **"Active program year" = newest `draft` OR `active`** ([lib/db.ts:4205](../../../lib/db.ts#L4205)) — a `draft` year is already live for coach ops and already billable (domain gotcha 1).
2. **The "one active program year per team" rule is APP-enforced, not a DB constraint** — the DB only has `UNIQUE(team_id, year)`; the activate transition (and the create route) guard against a second `active` year.
3. **Status transitions are forward-only — `draft→active→completed→archived`, enforced ONLY on the admin route** (`VALID_TRANSITIONS`; invalid → 422). **Provisioning bypasses it** — a self-serve team-workspace inserts `status:'active'` directly ([lib/team-workspace-provisioning.ts:184](../../../lib/team-workspace-provisioning.ts#L184)), skipping the guard.
4. **`budget_amount` + `auto_reminders_enabled` are COACH-side fields** — the org-admin program-year PATCH deliberately omits `budgetAmount` even though `updateRepProgramYear` supports it ([lib/db.ts:3987](../../../lib/db.ts#L3987)). An org admin editing a program year cannot touch the budget or the reminder toggle.
5. **Completing/archiving triggers a Club-only billing sync** (fire-and-forget).

**Fields** (boilerplate `id`, `created_at`, `updated_at` omitted):

<!-- dict:col:rep_program_years.team_id -->
**`team_id`** (FK → `rep_teams.id`, NOT NULL; part of `UNIQUE(team_id, year)`) — the team.

<!-- dict:col:rep_program_years.org_id -->
**`org_id`** (FK → `organizations.id`, NOT NULL) — **denormalized** (derivable via team); used directly for org-wide queries (`getOpenTryoutsByOrg` [lib/db.ts:3762](../../../lib/db.ts#L3762), `getActiveRepTeamCount`) to skip the team join.

<!-- dict:col:rep_program_years.name -->
**`name`** (text, NOT NULL) — season label (e.g. "2025 Season").

<!-- dict:col:rep_program_years.year -->
**`year`** (int, NOT NULL; part of `UNIQUE(team_id, year)`) — route validates `2000 ≤ year ≤ 2100`; 23505 → 409.

<!-- dict:col:rep_program_years.status -->
**`status`** (text, NOT NULL, default `'draft'`; CHECK `draft|active|completed|archived`) — drives active-year resolution, open-tryout listing, the billable-team count, and the forward-only transition machine (gotchas 1, 3).

<!-- dict:col:rep_program_years.tryout_open -->
**`tryout_open`** (bool, NOT NULL, default false) — gates the public tryout-registration page (`status='active' AND tryout_open=true`).

<!-- dict:col:rep_program_years.tryout_description -->
**`tryout_description`** (text, nullable) — the public-facing blurb on the tryout landing page.

<!-- dict:col:rep_program_years.budget_amount -->
**`budget_amount`** (numeric, nullable) — **coach-only** ([app/api/coaches/.../budget/route.ts:80](../../../app/api/coaches/%5BorgSlug%5D/teams/%5BteamId%5D/budget/route.ts#L80)); the coach accounting summary computes `net = budget + duesCollected − totalExpenses`. No org-admin reader/writer (gotcha 4).

<!-- dict:col:rep_program_years.auto_reminders_enabled -->
**`auto_reminders_enabled`** (bool, NOT NULL, default true) — coach-toggled (accounting settings); the dues-reminder cron **skips teams whose active year has it false**.

### `rep_roster_players`
<!-- dict:table:rep_roster_players -->

**Purpose:** the **rep-team season roster** — one row per player per program year. The rep equivalent of `basic_coach_team_players` (free Basic master roster) and a sibling of `tournament_roster_players`, but a richer shape: split first/last name, dedicated guardian fields, and positions.

**Gotchas (read first):**
1. **Never hard-deleted via the app.** `deleteRepRosterPlayer` ([lib/db.ts:4471](../../../lib/db.ts#L4471)) has **no caller**; removal is modeled as `status='inactive'`. Rows die only by FK CASCADE (program-year/team/org delete).
2. **No `source_player_id` snapshot link** — the only inbound provenance is `tryout_registration_id`. The cross-module Phase-5 back-link (re: `tournament_roster_players`/`basic_coach_team_players`) is genuinely **absent here** — don't invent it.
3. **`notes` vs `admin_notes` are BOTH coach-readable AND coach-writable.** `admin_notes` means "staff-side, not shown to families" (UI label "Admin Notes (private)") — a family-visibility *intent*, **not** a role boundary. (It's kept out of the intended roster-export column set, though the rep roster export itself is a not-yet-implemented catalog stub.)
4. **DOB is NOT consent-gated here** (contrast `basic_coach_team_players`, whose editor requires a guardian-consent checkbox) — the rep pages use a plain date input; DOB is flagged `sensitive` only to drive opt-in export redaction.
5. **Tryout→roster conversion drops most fields.** `acceptTryoutAndAddToRoster` ([lib/db.ts:4313](../../../lib/db.ts#L4313)) copies only identity + DOB + guardian and sets `source='tryout'` + `tryout_registration_id`; it does **not** carry over the tryout's `player_notes`, positions, number, or admin notes.

**Fields** (boilerplate `id`, `created_at`, `updated_at` omitted):

<!-- dict:col:rep_roster_players.program_year_id -->
**`program_year_id`** (FK → `rep_program_years.id`, NOT NULL) — season anchor + primary query key (indexed `year_idx`).

<!-- dict:col:rep_roster_players.team_id -->
<!-- dict:col:rep_roster_players.org_id -->
**`team_id`** (FK → `rep_teams.id`) / **`org_id`** (FK → `organizations.id`) — denormalized team + tenant scope.

<!-- dict:col:rep_roster_players.player_first_name -->
<!-- dict:col:rep_roster_players.player_last_name -->
**`player_first_name` / `player_last_name`** (text, NOT NULL) — required on every write; list ordered by last name. (Split, unlike `basic_coach_team_players.name`.)

<!-- dict:col:rep_roster_players.player_date_of_birth -->
**`player_date_of_birth`** (date, nullable) — optional; **not** consent-gated (gotcha 4).

<!-- dict:col:rep_roster_players.player_number -->
**`player_number`** (text, nullable) — jersey #, free text.

<!-- dict:col:rep_roster_players.primary_position -->
<!-- dict:col:rep_roster_players.secondary_position -->
**`primary_position` / `secondary_position`** (text, nullable; mig 070) — **free text, no CHECK** (any string accepted). Not populated by tryout conversion.

<!-- dict:col:rep_roster_players.guardian_first_name -->
<!-- dict:col:rep_roster_players.guardian_last_name -->
<!-- dict:col:rep_roster_players.guardian_email -->
<!-- dict:col:rep_roster_players.guardian_phone -->
**`guardian_first_name` / `guardian_last_name` / `guardian_email` / `guardian_phone`** — guardian contact; first/last/email are **NOT NULL** in the DB (the route guarantees non-null even though `createRepRosterPlayer`'s TS types them optional); `guardian_email` indexed (`email_idx`). `guardian_phone` nullable.

<!-- dict:col:rep_roster_players.status -->
**`status`** (text, NOT NULL, default `'active'`; CHECK `active|inactive`) — `inactive` is the de-facto delete (gotcha 1).

<!-- dict:col:rep_roster_players.source -->
**`source`** (text, NOT NULL, default `'admin_manual'`; CHECK `tryout|admin_manual`) — `'tryout'` set only by the conversion path.

<!-- dict:col:rep_roster_players.tryout_registration_id -->
**`tryout_registration_id`** (FK → `rep_tryout_registrations.id` ON DELETE SET NULL, nullable) — the only back-link to the originating tryout (set during conversion).

<!-- dict:col:rep_roster_players.notes -->
<!-- dict:col:rep_roster_players.admin_notes -->
**`notes`** (general/coach-visible) / **`admin_notes`** (staff-internal, intended family-hidden) — both coach-writable (gotcha 3).

### `rep_team_coaches`
<!-- dict:table:rep_team_coaches -->

**Purpose:** the **coach-assignment join** — maps an `auth.users` account to a `(team, program_year)` with a role, per season. Membership here is the **single gate** into the coach-operator portal for a team.

**Gotchas (read first):**
1. **This is the coach-portal access gate.** `getCoachingAssignmentsForUser(orgId, userId)` ([lib/db.ts:4160](../../../lib/db.ts#L4160)) is the membership check inside `resolveCoachContext` for every coach route; no row → no access.
2. **Assignments are filtered to `draft`/`active` seasons** ([lib/db.ts:4175](../../../lib/db.ts#L4175)) — a coach assigned only to a `completed`/`archived` year is effectively locked out via this helper even though the row persists.
3. **Team-workspace plans add an entitlement filter.** For a `team_workspace`/`plan_id='team'` org, assignments are further intersected with `getActiveTeamEntitledRepTeamIds` ([lib/db.ts:4180](../../../lib/db.ts#L4180)) — an active billing entitlement is required on top of the assignment row.
4. **Insert/delete only — NO `updated_at`, no update path.** Changing a coach's role = delete + re-add (`addRepTeamCoach`/`removeRepTeamCoach` [lib/db.ts:4034](../../../lib/db.ts#L4034)). Team-workspace provisioning seeds the owner as `head_coach`.
5. **`coach_role` is display-only** — no capability differs head vs assistant; all coach write routes authorize on *presence* of any assignment.
6. **Adding a coach requires an existing active `organization_members` row** ([app/api/admin/rep-teams/.../coaches/route.ts:96](../../../app/api/admin/rep-teams/teams/%5BteamId%5D/program-years/%5ByearId%5D/coaches/route.ts#L96)) → 422 otherwise. This table references, never creates, the membership.
7. **`UNIQUE(program_year_id, user_id)`** — dup → 23505 → 409.

**Fields** (boilerplate `id`, `created_at` omitted; no `updated_at`):

<!-- dict:col:rep_team_coaches.program_year_id -->
**`program_year_id`** (FK → `rep_program_years.id`, NOT NULL; part of `UNIQUE(program_year_id, user_id)`) — season scope.

<!-- dict:col:rep_team_coaches.team_id -->
<!-- dict:col:rep_team_coaches.org_id -->
**`team_id`** (FK → `rep_teams.id`) / **`org_id`** (FK → `organizations.id`) — the team being coached (matched in `resolveCoachContext`) + tenant scope (indexed `(org_id, user_id)`).

<!-- dict:col:rep_team_coaches.user_id -->
**`user_id`** (FK → `auth.users.id` ON DELETE CASCADE, NOT NULL) — the coach account (snapshot shows `foreign_table: null` — auth-schema introspection gap). A *narrowing* of org membership: being an org member doesn't grant team access; this row does.

<!-- dict:col:rep_team_coaches.coach_role -->
**`coach_role`** (text, NOT NULL, default `'head_coach'`; CHECK `head_coach|assistant_coach`) — display-only label (gotcha 5).

### `rep_team_events`
<!-- dict:table:rep_team_events -->

**Purpose:** the unified per-team, per-season calendar — practices, games (`league_game`/`tournament_game`/`scrimmage`), multi-day `external_tournament`s, and generic `team_event`s.

**Gotchas (read first):**
1. **TWO self-FKs, opposite meaning AND cascade:** `parent_event_id` (ON DELETE **CASCADE**) links a `tournament_game` child to its `external_tournament` parent (deleting the parent cascade-deletes child game slots); `recurrence_parent_id` (ON DELETE **SET NULL**) links generated recurring-practice instances to a series anchor. Easy to confuse.
2. **⚠️ The recurring-practice series anchor is broken.** `createRepTeamEvents` mints `parentId = randomUUID()` and stamps every child's `recurrence_parent_id` with it (the first occurrence stays NULL); the promised "back-fill the anchor to point to itself" never executes ([events/route.ts:132,145,149](../../../app/api/coaches/%5BorgSlug%5D/teams/%5BteamId%5D/events/route.ts#L132)). So children point at a UUID that is **no row's `id`**, and the anchor's own `recurrence_parent_id` is NULL. The **delete-"this & future"** path (`anchorId = recurrenceParentId ?? eventId`, [events/[eventId]/route.ts:94](../../../app/api/coaches/%5BorgSlug%5D/teams/%5BteamId%5D/events/%5BeventId%5D/route.ts#L94)) deletes the *other* children but **never the anchor occurrence** — and the matching *edit*-future helper (`updateRepTeamEventsByRecurrenceParent`, [lib/db.ts:4635](../../../lib/db.ts#L4635)) is **dead code with no caller**, so no edit-this-&-future path is actually wired.
3. **`result` is never auto-derived server-side** — stored exactly as sent; the only auto-fill (`hs>as?'win':…`) is **client-side** ([schedule/page.tsx:471](../../../app/%5BorgSlug%5D/coaches/teams/%5BteamId%5D/schedule/page.tsx#L471)). API callers that set scores without `result` leave it NULL.
4. **Recurrence is practice-only and timezone-naive** — `isRecurring` on any non-`practice` type is silently ignored; occurrence dates are built from local-time strings with no offset (can shift across a UTC boundary).
5. **A `SECURITY DEFINER` trigger** rewrites `rep_team_event_attendance`'s scope columns when this event's `org_id`/`team_id`/`program_year_id` change (mig 069) — dormant in practice (app never updates those).

**Fields** (boilerplate `id`, `created_at`, `updated_at` omitted):

<!-- dict:col:rep_team_events.program_year_id -->
**`program_year_id`** (FK → `rep_program_years.id`, NOT NULL) — season spine; every list filters it (`year_idx (program_year_id, starts_at)`).

<!-- dict:col:rep_team_events.team_id -->
<!-- dict:col:rep_team_events.org_id -->
**`team_id`** (FK → `rep_teams.id`) / **`org_id`** (FK → `organizations.id`) — owning team + tenant scope.

<!-- dict:col:rep_team_events.event_type -->
**`event_type`** (text, NOT NULL; CHECK `external_tournament|tournament_game|scrimmage|league_game|practice|team_event`) — validated app-side against the same list.

<!-- dict:col:rep_team_events.name -->
<!-- dict:col:rep_team_events.description -->
**`name`** (NOT NULL, trimmed) / **`description`** (nullable).

<!-- dict:col:rep_team_events.starts_at -->
<!-- dict:col:rep_team_events.ends_at -->
**`starts_at`** (timestamptz, NOT NULL) — sort + range-filter key; generated per occurrence for recurring practices. **`ends_at`** (nullable).

<!-- dict:col:rep_team_events.location -->
**`location`** (text, nullable) — one of two columns eligible for a "this & future" bulk edit (with `ends_at`).

<!-- dict:col:rep_team_events.opponent -->
**`opponent`** (text, nullable) — **game-types only** (UI-gated).

<!-- dict:col:rep_team_events.home_away -->
**`home_away`** (text, nullable; CHECK `home|away|neutral`) — game context only.

<!-- dict:col:rep_team_events.home_score -->
<!-- dict:col:rep_team_events.away_score -->
**`home_score` / `away_score`** (int, nullable) — game scores; written via PATCH only. (The coach UI labels them "Home"/"Away"; no code binds `home_score` to the rep team specifically.)

<!-- dict:col:rep_team_events.result -->
**`result`** (text, nullable; CHECK `win|loss|tie`) — manual (gotcha 3).

<!-- dict:col:rep_team_events.parent_event_id -->
**`parent_event_id`** (FK → self, ON DELETE CASCADE, nullable) — `tournament_game` → its `external_tournament` parent (gotcha 1); indexed.

<!-- dict:col:rep_team_events.is_recurring -->
**`is_recurring`** (bool, NOT NULL, default false) — true on every row of a recurring series.

<!-- dict:col:rep_team_events.recurrence_rule -->
**`recurrence_rule`** (jsonb, nullable) — recurring practices only; stored as a record, not re-evaluated. **Key catalog** (untyped TS `Record<string,unknown>`, [lib/types.ts:922](../../../lib/types.ts#L922); shape from the builder [schedule/page.tsx:410](../../../app/%5BorgSlug%5D/coaches/teams/%5BteamId%5D/schedule/page.tsx#L410) + validation in [events/route.ts:116](../../../app/api/coaches/%5BorgSlug%5D/teams/%5BteamId%5D/events/route.ts#L116)): `dayOfWeek` (int 0–6, Sun..Sat) · `startDate` / `endDate` (`YYYY-MM-DD`) · `startTime` (`HH:MM`) · `endTime` (`HH:MM`|null). Required: `dayOfWeek`, `startDate`, `endDate`, `startTime` (else 400).

<!-- dict:col:rep_team_events.recurrence_parent_id -->
**`recurrence_parent_id`** (FK → self, ON DELETE SET NULL, nullable) — series-grouping pointer (gotchas 1–2).

### `rep_team_event_attendance`
<!-- dict:table:rep_team_event_attendance -->

**Purpose:** one attendance/availability row per **active** roster player per event (`UNIQUE(event_id, player_id)`), set by coaches.

**Gotchas (read first):**
1. **Coach-set only — there is NO player/guardian self-RSVP.** The only writer is the coach attendance PATCH; `updated_by` is always the acting coach.
2. **Writes are an upsert on `(event_id, player_id)`** (`onConflict: 'event_id,player_id'`, [lib/db.ts:4708](../../../lib/db.ts#L4708)); a batch re-save overwrites in place.
3. **Restricted to ACTIVE roster players, per-row** — the route rejects the **entire batch** (400) if any `playerId` isn't `status='active'`. Attendance for a since-deactivated player can persist but can't be re-saved.
4. **Three denormalized scope columns** (`program_year_id`, `team_id`, `org_id`) duplicate values reachable via `event_id` — for the `team_idx (team_id, program_year_id)` rollup; a `SECURITY DEFINER` trigger keeps them synced to the event (mig 069).
5. **`note` is capped at 500 chars in the API only** (no DB CHECK).

**Fields** (boilerplate `id`, `created_at`, `updated_at` omitted):

<!-- dict:col:rep_team_event_attendance.event_id -->
<!-- dict:col:rep_team_event_attendance.player_id -->
**`event_id`** (FK → `rep_team_events.id` CASCADE) / **`player_id`** (FK → `rep_roster_players.id` CASCADE) — the unique pair; `player_id` must be active to write.

<!-- dict:col:rep_team_event_attendance.program_year_id -->
<!-- dict:col:rep_team_event_attendance.team_id -->
<!-- dict:col:rep_team_event_attendance.org_id -->
**`program_year_id` / `team_id` / `org_id`** — denormalized scope (gotcha 4).

<!-- dict:col:rep_team_event_attendance.status -->
**`status`** (text, NOT NULL, default `'unknown'`; CHECK `unknown|attending|absent|late`).

<!-- dict:col:rep_team_event_attendance.note -->
**`note`** (text, nullable; ≤500 chars app-enforced).

<!-- dict:col:rep_team_event_attendance.updated_by -->
**`updated_by`** (FK → `auth.users.id` ON DELETE SET NULL, nullable) — always the acting coach (auth-schema introspection gap).

### `rep_team_lineups`
<!-- dict:table:rep_team_lineups -->

**Purpose:** the per-event lineup **header** (format/mode, inning count, notes) for a rep-team game — exactly one row per event; per-player detail lives in `rep_team_lineup_entries`.

**Gotchas (read first):**
1. **One lineup per event (`UNIQUE(event_id)`) + upsert** (`onConflict: 'event_id'`, [lib/db.ts:4793](../../../lib/db.ts#L4793)) — a second save replaces the header in place.
2. **Coach-only single endpoint** (`events/[eventId]/lineup`); lineups are allowed only for game event types (`league_game|tournament_game|scrimmage`).
3. **`updated_by` = last writer, not creator** (overwritten every save; there is no `created_by`).

**Fields** (boilerplate `id`, `created_at`, `updated_at` omitted):

<!-- dict:col:rep_team_lineups.event_id -->
**`event_id`** (FK → `rep_team_events.id` CASCADE; **`UNIQUE(event_id)`**) — the upsert conflict key.

<!-- dict:col:rep_team_lineups.program_year_id -->
<!-- dict:col:rep_team_lineups.team_id -->
<!-- dict:col:rep_team_lineups.org_id -->
**`program_year_id` / `team_id` / `org_id`** — scope; sourced from the active program year + URL/context, **not** the request body (can't be spoofed).

<!-- dict:col:rep_team_lineups.lineup_mode -->
**`lineup_mode`** (text, NOT NULL, default `'everyone_bats'`; CHECK `nine_player|everyone_bats`) — drives the batting-order/starter logic (see `rep_team_lineup_entries` gotcha 4).

<!-- dict:col:rep_team_lineups.inning_count -->
**`inning_count`** (int, NOT NULL, default 7; CHECK `1 ≤ n ≤ 12`) — the column count of the fielding-position grid; positions for innings beyond it are **dropped on save**.

<!-- dict:col:rep_team_lineups.notes -->
**`notes`** (text, nullable; ≤1000 chars app-enforced).

<!-- dict:col:rep_team_lineups.updated_by -->
**`updated_by`** (FK → `auth.users.id` ON DELETE SET NULL, nullable) — last writer (gotcha 3; auth-schema introspection gap).

### `rep_team_lineup_entries`
<!-- dict:table:rep_team_lineup_entries -->

**Purpose:** one row per player in a lineup — batting slot, starter/bench flag, and per-inning fielding-position assignments.

**Gotchas (read first):**
1. **Full replace-on-save** — `replaceRepTeamLineupEntries` deletes ALL rows for the lineup then bulk-inserts ([lib/db.ts:4822](../../../lib/db.ts#L4822)); entry `id`/`created_at` are **not stable** across saves.
2. **`UNIQUE(lineup_id, player_id)`** + **partial-unique `(lineup_id, batting_order) WHERE batting_order IS NOT NULL`** — a player appears once per lineup, and no two players share a non-null batting slot (NULL slots exempt).
3. **Only active roster players accepted** (400 otherwise).
4. **Mode interaction:** `everyone_bats` forces `starter=true` for every entry and **requires a non-null `batting_order` each**; `nine_player` caps starters at 9 (starter slots must be 1–9) — non-starters are bench (the UI builder leaves their `batting_order` null; the save path validates but does not itself force it).
5. **`batting_order` NULL = not in the batting order (bench).** Read ordered by `batting_order ASC`, NULLs last.

**Fields** (boilerplate `id`, `created_at`, `updated_at` omitted):

<!-- dict:col:rep_team_lineup_entries.lineup_id -->
**`lineup_id`** (FK → `rep_team_lineups.id` CASCADE; part of both uniques).

<!-- dict:col:rep_team_lineup_entries.player_id -->
**`player_id`** (FK → `rep_roster_players.id` CASCADE; `UNIQUE(lineup_id, player_id)`) — must be an active roster player.

<!-- dict:col:rep_team_lineup_entries.batting_order -->
**`batting_order`** (int, nullable; CHECK `NULL OR > 0`; partial-unique slot) — route allows NULL or 1–99 (stricter than the DB CHECK); NULL = bench (gotcha 5).

<!-- dict:col:rep_team_lineup_entries.starter -->
**`starter`** (bool, NOT NULL, default true) — only meaningful in `nine_player` (forced true in `everyone_bats`; 9-starter cap).

<!-- dict:col:rep_team_lineup_entries.inning_positions -->
**`inning_positions`** (jsonb, NOT NULL, default `'{}'`) — **key catalog:** `Record<string,string>` ([lib/types.ts:962](../../../lib/types.ts#L962)) mapping **inning number (as string, `"1"`..`"<inning_count>"`) → position code**. Innings beyond `inning_count` are dropped on save; unassigned innings are absent (no empty keys). **Value domain** (`VALID_POSITIONS`): `P, C, 1B, 2B, 3B, SS, LF, CF, RF, OF, DH, EH, Bench` (UI adds `''` = unassigned, not persisted). Invalid value → 400. Example: `{"1":"P","2":"SS","3":"Bench"}`.

<!-- dict:col:rep_team_lineup_entries.notes -->
**`notes`** (text, nullable; ≤500 chars app-enforced).

### `rep_tryout_registrations`
<!-- dict:table:rep_tryout_registrations -->

**Purpose:** **public** tryout sign-ups (guardian-submitted) for a team's program year; they flow through an admin-reviewed status machine and, on acceptance, convert into a `rep_roster_players` row (`source='tryout'`). The public on-ramp from prospect to rostered player.

**Gotchas (read first):**
1. **Public, UNAUTHENTICATED insert via service role.** The public register route has no auth context; `createRepTryoutRegistration` uses `supabaseAdmin` ([lib/db.ts:4275](../../../lib/db.ts#L4275)) — RLS is dormant on this path.
2. **The `tryout_open` gate is on the PARENT** (`rep_program_years`), not this table — the public route 409s if `!programYear.tryoutOpen` ([register/route.ts:40](../../../app/api/rep-teams/%5BorgSlug%5D/%5BteamSlug%5D/tryouts/%5ByearId%5D/register/route.ts#L40)); `rep_program_years.tryout_description` is the public blurb.
3. **The status machine is enforced in CODE, not the DB** — `VALID_TRANSITIONS`: `pending_review→offered|declined|withdrawn`; `offered→accepted|declined|withdrawn`; `accepted→withdrawn`; `declined`/`withdrawn` terminal; illegal → 422. (You can decline straight from `pending_review` but cannot accept without offering first.)
4. **⚠️ Roster conversion fires on `accepted` only and is NOT transactional** — `acceptTryoutAndAddToRoster` ([lib/db.ts:4313](../../../lib/db.ts#L4313)) inserts the roster player **then** sets status in two separate awaits; if the second fails you get a roster player with the tryout still `offered` (orphan/dup risk).
5. **⚠️ `attention-summary` counts the wrong value** — it queries `status='pending'` but the real value is `'pending_review'` ([app/api/admin/attention-summary/route.ts:90](../../../app/api/admin/attention-summary/route.ts#L90)), so the "tryouts needing review" badge is **always 0**.
6. **No dedup** — nothing prevents duplicate submissions; the `guardian_email` index is lookup-only.
7. **DOB is nullable in the DB but REQUIRED on the public form** ([register/route.ts:67](../../../app/api/rep-teams/%5BorgSlug%5D/%5BteamSlug%5D/tryouts/%5ByearId%5D/register/route.ts#L67)) — minor PII collected via an unauthenticated endpoint with RLS dormant.
8. **`guardian_email` is lowercased on the admin-create path but NOT the public path** — casing is inconsistent across sources.

**Fields** (boilerplate `id` omitted; **no `created_at` — `submitted_at` is the create stamp**):

<!-- dict:col:rep_tryout_registrations.program_year_id -->
**`program_year_id`** (FK → `rep_program_years.id`, NOT NULL) — season spine; holds the `tryout_open`/`tryout_description` gate; `status_idx (program_year_id, status)`.

<!-- dict:col:rep_tryout_registrations.team_id -->
<!-- dict:col:rep_tryout_registrations.org_id -->
**`team_id`** (FK → `rep_teams.id`) / **`org_id`** (FK → `organizations.id`) — carried into the roster on conversion; public path takes `org_id` from the resolved slug.

<!-- dict:col:rep_tryout_registrations.player_first_name -->
<!-- dict:col:rep_tryout_registrations.player_last_name -->
**`player_first_name` / `player_last_name`** (text, NOT NULL) — capped 80 publicly; copied to the roster on accept.

<!-- dict:col:rep_tryout_registrations.player_date_of_birth -->
**`player_date_of_birth`** (date, nullable in DB; required on the public form — gotcha 7).

<!-- dict:col:rep_tryout_registrations.player_notes -->
**`player_notes`** (text, nullable) — **guardian-submitted** free text (≤500); **not** carried to the roster (distinct from `admin_notes`).

<!-- dict:col:rep_tryout_registrations.guardian_first_name -->
<!-- dict:col:rep_tryout_registrations.guardian_last_name -->
<!-- dict:col:rep_tryout_registrations.guardian_email -->
<!-- dict:col:rep_tryout_registrations.guardian_phone -->
**`guardian_first_name` / `guardian_last_name` / `guardian_email` / `guardian_phone`** — first/last/email NOT NULL; `guardian_email` targets all transactional emails + is indexed (gotcha 8); all copied to the roster on accept.

<!-- dict:col:rep_tryout_registrations.status -->
**`status`** (text, NOT NULL, default `'pending_review'`; CHECK `pending_review|offered|accepted|declined|withdrawn`) — transitions in code (gotchas 3–5).

<!-- dict:col:rep_tryout_registrations.admin_notes -->
**`admin_notes`** (text, nullable) — internal reviewer notes (vs guardian `player_notes`).

<!-- dict:col:rep_tryout_registrations.submitted_at -->
**`submitted_at`** (timestamptz, NOT NULL, default now()) — **the create stamp** (this table has no `created_at`); admin list orders `submitted_at DESC`.

### `rep_document_templates`
<!-- dict:table:rep_document_templates -->

**Purpose:** blank, downloadable document forms (waivers, medical-consent, etc.) an org admin or team coach publishes for download.

**Gotchas (read first):**
1. **Single private Supabase Storage bucket `rep-team-documents`** (`public:false`, 10 MB, MIME allow-list; created in the dashboard, not a migration) — the bucket name is a **literal hard-coded across ~6 routes** (no shared constant). All DB access is `supabaseAdmin`; **RLS = defense-in-depth only** (the policies are dead in the request path). Downloads are short-lived **signed URLs** (`createSignedUrl`, 3600 s). `storage_path` is **never returned to clients** (stripped).
2. **`team_id` NULL = org-wide template; set = team-specific.** `getRepDocumentTemplates` returns org-wide **plus** team-specific via `.or('team_id.is.null,team_id.eq.<id>')` ([lib/db.ts:4885](../../../lib/db.ts#L4885)).
3. **`is_active` is the unpublish/soft-delete flag but is filtered ONLY on the coaches list** — the admin list returns inactive templates too. A separate hard `DELETE` removes the row + storage object.
4. **No `program_year_id`** — templates are org/team-scoped, persisting across seasons.
5. **`ON DELETE CASCADE` on `org_id`/`team_id` drops the row but NOT the storage object** — cascade orphans the file in the bucket (only the explicit DELETE route cleans storage).

**Fields** (boilerplate `id`, `created_at` omitted; no `updated_at`):

<!-- dict:col:rep_document_templates.org_id -->
**`org_id`** (FK → `organizations.id` ON DELETE CASCADE, NOT NULL) — `org_idx (org_id, team_id)`.

<!-- dict:col:rep_document_templates.team_id -->
**`team_id`** (FK → `rep_teams.id` ON DELETE CASCADE, nullable) — NULL = org-wide (gotcha 2).

<!-- dict:col:rep_document_templates.name -->
**`name`** (text, NOT NULL) — form label.

<!-- dict:col:rep_document_templates.document_type -->
**`document_type`** (text, NOT NULL; CHECK `waiver|medical_consent|code_of_conduct|other`).

<!-- dict:col:rep_document_templates.storage_path -->
**`storage_path`** (text, NOT NULL) — bucket object key, layout `${orgId}/templates/(teams/${teamId}|org-wide)/${uuid}-${fileName}`; **never exposed to clients**.

<!-- dict:col:rep_document_templates.file_name -->
<!-- dict:col:rep_document_templates.file_size -->
**`file_name`** (text, NOT NULL) / **`file_size`** (bigint, NOT NULL; ≤10 MB enforced pre-insert).

<!-- dict:col:rep_document_templates.is_active -->
**`is_active`** (bool, NOT NULL, default true) — soft unpublish (gotcha 3).

<!-- dict:col:rep_document_templates.published_by -->
**`published_by`** (FK → `auth.users.id`, nullable) — uploader (auth-schema introspection gap).

### `rep_player_documents`
<!-- dict:table:rep_player_documents -->

**Purpose:** completed/returned documents uploaded against a specific roster player (e.g. a signed waiver), optionally linked to the template they fulfill.

**Gotchas (read first):**
1. **Same bucket / signed-URL / `supabaseAdmin` pattern** as `rep_document_templates`; `storage_path` never exposed; **no guardian self-serve path exists** — uploaders are coaches/admins (`uploaded_by` is always the acting staff user).
2. **`template_id` links a completed upload to the blank template it fulfills** (ON DELETE SET NULL; NULL = ad-hoc) — but it is **unvalidated** (accepts any form-supplied string).
3. **No `program_year_id`** — docs are player/team-scoped. Because `rep_roster_players` rows ARE per-program-year and `player_id` is `ON DELETE CASCADE`, a player's docs **follow `player_id` and cascade away on roster teardown** — they do not survive being re-rostered under a new `player_id`.
4. **`org_id`/`team_id` are denormalized from the player row** (`createRepPlayerDocument` reads `player.teamId/orgId`), not the request; no trigger re-syncs them if a player is moved.
5. **No soft-delete — hard `DELETE` only**; cascade orphans the storage object (only the DELETE route cleans storage).

**Fields** (boilerplate `id`, `created_at` omitted; no `updated_at`):

<!-- dict:col:rep_player_documents.player_id -->
**`player_id`** (FK → `rep_roster_players.id` ON DELETE CASCADE, NOT NULL) — the sole list filter (`player_idx`); tenant safety via the route resolving the player within the org/team first.

<!-- dict:col:rep_player_documents.team_id -->
<!-- dict:col:rep_player_documents.org_id -->
**`team_id`** (FK → `rep_teams.id` CASCADE) / **`org_id`** (FK → `organizations.id` CASCADE) — denormalized from the player (gotcha 4); `team_idx (team_id, org_id)`.

<!-- dict:col:rep_player_documents.document_type -->
**`document_type`** (text, NOT NULL; CHECK `waiver|medical_consent|code_of_conduct|other`).

<!-- dict:col:rep_player_documents.storage_path -->
**`storage_path`** (text, NOT NULL) — bucket key, layout `${orgId}/teams/${teamId}/players/${playerId}/${uuid}-${fileName}`; never exposed.

<!-- dict:col:rep_player_documents.file_name -->
<!-- dict:col:rep_player_documents.file_size -->
**`file_name`** (text, NOT NULL) / **`file_size`** (bigint, NOT NULL; ≤10 MB).

<!-- dict:col:rep_player_documents.template_id -->
**`template_id`** (FK → `rep_document_templates.id` ON DELETE SET NULL, nullable) — the fulfilled template (gotcha 2).

<!-- dict:col:rep_player_documents.uploaded_by -->
**`uploaded_by`** (FK → `auth.users.id`, nullable) — the acting staff user (auth-schema introspection gap).

---

*End of Rep operations (Phase 4a — 12 tables). The 4 `team_workspace_*` tables that the coverage classifier files under this domain live in the Coaches / basic-teams domain.*

---

## Rep finance

> The franchise module's **money** tables — the team coach's books. Five sub-systems: **budgeting** (`rep_budget_lines` → `rep_budget_periods`; `rep_season_surplus`), **player dues** (`rep_player_dues_schedules` → `rep_player_dues_installments`; `rep_dues_credits`), **fundraisers** (`rep_fundraisers` → `rep_fundraiser_entries`), **cost allocations** (`rep_cost_allocations` → `rep_allocation_splits` → `rep_allocation_installments`), and **expenses / payment requests** (`rep_team_expenses`; `rep_team_payment_requests`). All TEAM-scoped; the org's ledger is the separate Accounting domain.
>
> _Last verified: 2026-06-09 @ snapshot 2026-06-09, commit `5479605` (branch `feat/free-tier-coaches`). Code is branch-relative — re-verify file:line at author time._

### Gotchas first (the money traps)

- **Money is dollars (decimal `numeric`), never integer cents.** Every amount/total column stores dollars-and-cents; readers do `Number(x)`, aggregation rounds with `Math.round(x*100)/100`, and reconciliation uses ±$0.01–$0.02 float tolerances — there is **no `*100`/`/100` cents conversion** anywhere in the domain (the lone `/100` in `allocations/new/page.tsx` is a *percentage* divisor). Positivity is DB-enforced per table — mostly `amount > 0`; **two are `>= 0`** (`rep_fundraiser_entries.amount_raised`, `rep_season_surplus.total_surplus`).
- **No Stripe / payment-processor columns in the entire domain.** None of the 13 tables carry `stripe_*`, `payment_intent_id`, or subscription columns (verified against the live snapshot, dev+prod). Settlement is **internal double-entry**: a row's `accounting_entry_id` (when populated) links to the org `accounting_entries` ledger, and `rep_team_payment_requests` approval posts via the `create_accounting_transfer` RPC between the team and org ledgers. The Stripe billing surface (`stripe_prices` + org/workspace billing columns) is the **Stripe / Billing phase** — cross-referenced, documented there, not here.
- **THE DUAL BUDGET-LINE TRAP — check the FK target before every join.** Two unrelated "budget line" tables coexist: `rep_budget_lines` (TEAM, this domain, keyed by UUID `program_year_id`) and `org_budget_lines` (ORG Accounting, keyed by integer `season_year`). The `budget_line_id`-shaped FKs point at **different** ones — `rep_budget_periods.budget_line_id` and `rep_player_dues_schedules.budget_line_id` → **`rep_budget_lines`** (team), but `rep_cost_allocations.source_budget_line_id` and `rep_team_payment_requests.budget_line_id` → **`org_budget_lines`** (org). Joining the wrong one returns nothing.
- **Status/method enums are CHECK-enforced — copy the values verbatim.** `rep_allocation_splits.split_method` `percentage|sessions|fixed`; `.payment_schedule` `standard|custom`; `rep_player_dues_installments.source` `manual|budget_generated`; `rep_dues_credits.credit_type` `contribution|fundraiser|overpayment|other`; `rep_team_expenses.expense_type` `expense|tournament_payable`; `rep_team_payment_requests.request_type` `payment_to_org|charge_to_org`; `rep_team_payment_requests.status` `pending|approved|denied`. **Unlike `team_entitlements.status`, none of these carry a US/UK spelling variant** — there is no `cancelled`/`canceled` doublet to guard; match the single spelling exactly.
- **Reconciliation is mostly APP-enforced, not DB-enforced.** The only DB guarantees are the per-row positivity CHECKs and the UNIQUE keys. Sum relationships are enforced only in route code, and only on some paths: allocation splits must sum **≤** `allocation.total_amount` (under-allocation allowed, +$0.001 tol); a split's installments must sum **=** `split.amount` (±$0.01); budget periods must sum **=** `line.total_amount` (±$0.02); a dues schedule's `total_amount` is checked against its installments **only on the manual POST path**. Editing children later can silently desync the parent total.
- **`accounting_entry_id` ≠ "paid", and is unpopulated on several tables.** It is a back-link to the org ledger, written **only** by the dues-installment and fundraiser-entry pay paths. On `rep_allocation_installments`, `rep_team_expenses`, and `rep_team_payment_requests` it exists but **no code writes it** — the org-ledger entry is authoritative with no back-reference. Use `paid_at` / `*_paid_at` / `status` for payment state, never the presence of `accounting_entry_id`.
- **Three verified schema/code-drift bugs live in this domain (the exact class this dictionary exists to surface — all confirmed against live dev+prod via `information_schema`, 2026-06-09):**
  1. **`rep_team_expenses` has no `notes` column**, yet `createRepTeamExpense`/`updateRepTeamExpense` write `notes` ([lib/db.ts:5457](../../../lib/db.ts#L5457), [:5480](../../../lib/db.ts#L5480)) → any insert/update through these helpers errors `column "notes" does not exist`.
  2. **`org_id` is `NOT NULL` with no default and no trigger** on both `rep_allocation_installments` and `rep_player_dues_installments`, yet the only insert helpers omit it (`createRepCostAllocationWithSplits` [lib/db.ts:5172](../../../lib/db.ts#L5172), `replaceRepDuesInstallments` [lib/db.ts:5574](../../../lib/db.ts#L5574)) → new-installment inserts via these paths violate the NN constraint.
  3. **`getRepAllocationSplitsForTeam` queries the non-existent column `allocation_split_id`** ([lib/db.ts:5663](../../../lib/db.ts#L5663)); the real FK column is `split_id` → the coach allocations GET errors.
  These are code-vs-live-schema mismatches, not documentation gaps — carry them to `/dba`.
- **`auth.users` FKs show `foreign_table: null`** in the snapshot for `created_by`/`paid_by`/`reviewed_by` (cross-schema introspection gap, same as Rep operations) — they are constrained, not loose.
- **Dev/prod:** all 13 finance tables are **zero-drift** (none appear in `DRIFT_dev_vs_prod.md`).

### `rep_budget_lines`
<!-- dict:table:rep_budget_lines -->

**Purpose:** a TEAM's season budget plan — one row per planned line item (e.g. "Tournament fees", $4,000) for a `(team_id, program_year_id)`. The estimated side of budget-vs-actual; read/written only by the coach budget-plan routes.

**Gotchas (read first):**
1. **The team one, not `org_budget_lines`** (dual-budget-line trap). Keyed by UUID `program_year_id`; `org_budget_lines` is the org-scoped Accounting table keyed by integer `season_year`. Independent rows, not views of each other.
2. **`budget-vs-actual` matches actual expenses to a line by category NAME (case-insensitive string), NOT by `category_id`** — it joins `budget_categories(name)`, lowercases, and string-matches `rep_team_expenses.category` text. A line with `category_id IS NULL` ("Uncategorized") never matches any actual, and renaming a category silently breaks matching.
3. **Drives per-player dues generation** — `generate-installments` divides Σ`total_amount` across the roster (see `rep_player_dues_installments`). The line-delete route 409s when `source='budget_generated'` dues installments exist — though note that guard's schedule lookup is undermined by the dead `rep_player_dues_schedules.budget_line_id` (see that table).
4. **CHECK `total_amount > 0`** (`rep_budget_lines_total_amount_check`).
5. **`sort_order` is never set on insert** — both create paths rely on the DB default `0` and there is no reorder route, so every line shares `sort_order = 0` (display order is effectively `created_at`).

**Fields** (boilerplate `id`, `created_at`, `updated_at` omitted):

<!-- dict:col:rep_budget_lines.org_id -->
<!-- dict:col:rep_budget_lines.team_id -->
<!-- dict:col:rep_budget_lines.program_year_id -->
**`org_id`** (FK → `organizations.id`, NOT NULL) / **`team_id`** (FK → `rep_teams.id`, NOT NULL) / **`program_year_id`** (FK → `rep_program_years.id`, NOT NULL) — the scope key; `program_year_id` is the primary read filter, index `(team_id, program_year_id)`.

<!-- dict:col:rep_budget_lines.category_id -->
<!-- dict:col:rep_budget_lines.item_id -->
**`category_id`** (FK → `budget_categories.id`, nullable) / **`item_id`** (FK → `budget_items.id`, nullable) — categorize the line against the **org Accounting chart of accounts** (cross-domain; shared with `org_budget_lines`). Both null = uncategorized. `category_id` feeds the display name and the (name-based) actual-matching; `item_id` is display-only.

<!-- dict:col:rep_budget_lines.description -->
**`description`** (text, NOT NULL) — line label (1–200 chars).

<!-- dict:col:rep_budget_lines.total_amount -->
**`total_amount`** (numeric, NOT NULL, CHECK `> 0`) — estimated dollars; if periods exist they must sum to it (±$0.02, see `rep_budget_periods`).

<!-- dict:col:rep_budget_lines.notes -->
**`notes`** (text, nullable) — free text.

<!-- dict:col:rep_budget_lines.sort_order -->
**`sort_order`** (int, NOT NULL, default 0) — display order; effectively always 0 (gotcha 5).

### `rep_budget_periods`
<!-- dict:table:rep_budget_periods -->

**Purpose:** an optional time-phasing of a single budget line's total into dated chunks (e.g. split "$4,000 tournament fees" across Sept/Oct/Nov). Pure breakdown of one `rep_budget_lines` row.

**Gotchas (read first):**
1. **Hangs purely off `budget_line_id`** — it has **no `org_id`, `team_id`, `program_year_id`, or `updated_at`** (7 columns). Scope/ownership is inherited through the parent line; the route verifies the line belongs to the coach's program year before touching periods.
2. **Full-replace write** — POST deletes ALL periods for the line, then re-inserts the supplied array (`sort_order` = array index). No single-period PATCH/DELETE; an empty array clears periods (reverts the line to lump-sum).
3. **Periods must reconcile to the parent** — the route enforces Σ`amount` == `line.total_amount` within **±$0.02**; periods are not independent.
4. **`period_label` is free text** (no CHECK; client-supplied, e.g. "Sept"/"Q1"); **`period_date`** (nullable date) buckets actuals in budget-vs-actual (null dates fall to the last bucket).
5. **CHECK `amount > 0`** (`rep_budget_periods_amount_check`). No `created_by`.

**Fields** (boilerplate `id`, `created_at` omitted; no `updated_at`):

<!-- dict:col:rep_budget_periods.budget_line_id -->
**`budget_line_id`** (FK → `rep_budget_lines.id`, NOT NULL) — the sole scope/parent link; index `rep_budget_periods_line_idx`.

<!-- dict:col:rep_budget_periods.period_label -->
**`period_label`** (text, NOT NULL) — free-form period name (gotcha 4).

<!-- dict:col:rep_budget_periods.period_date -->
**`period_date`** (date, nullable) — drives time-bucketing of actuals (gotcha 4).

<!-- dict:col:rep_budget_periods.amount -->
**`amount`** (numeric, NOT NULL, CHECK `> 0`) — the period's dollar portion; sums to parent ±$0.02.

<!-- dict:col:rep_budget_periods.sort_order -->
**`sort_order`** (int, NOT NULL, default 0) — set to array index on the full-replace insert.

### `rep_season_surplus`
<!-- dict:table:rep_season_surplus -->

**Purpose:** the end-of-season surplus figure for a program year — the input to a refund/distribution breakdown. One row per season.

**Gotchas (read first):**
1. **`total_surplus` is a coach-ENTERED number, not a computed rollup** — written verbatim (rounded to 2dp) from the request; no code derives it from budget-vs-actual or expenses. (The downstream refund **breakdown** is recomputed live from this number + roster/credits/dues, but the surplus itself is manual input.)
2. **CHECK `total_surplus >= 0`** (`rep_season_surplus_total_surplus_check`) — **a deficit cannot be stored** (a team that ran a loss stores 0). Note this is `>= 0`, not `> 0`.
3. **UNIQUE on `program_year_id`** (`rep_season_surplus_program_year_id_key`) — one row per season; writes `upsert(onConflict: 'program_year_id')`, so PUT is idempotent.
4. **No `team_id`/`org_id`** — scoped only via `program_year_id` → `rep_program_years` (which carries the team); the route gates by resolving the team's active program year first.
5. **`created_at` AND `updated_at` are NULLABLE** here (unusual vs the rest of the domain; both default `now()`). `created_by` is set on every upsert, so it reflects the **last editor**, not strictly the creator.

**Fields** (boilerplate `id` omitted; `created_at`/`updated_at` nullable — gotcha 5):

<!-- dict:col:rep_season_surplus.program_year_id -->
**`program_year_id`** (FK → `rep_program_years.id`, NOT NULL, UNIQUE) — the season key; the only scope column.

<!-- dict:col:rep_season_surplus.total_surplus -->
**`total_surplus`** (numeric, NOT NULL, default 0, CHECK `>= 0`) — coach-entered season surplus in dollars (gotchas 1–2).

<!-- dict:col:rep_season_surplus.notes -->
**`notes`** (text, nullable) — free text.

<!-- dict:col:rep_season_surplus.created_by -->
**`created_by`** (FK → `auth.users.id`, nullable; snapshot shows `foreign_table: null` — cross-schema gap) — last editor (gotcha 5).

### `rep_player_dues_schedules`
<!-- dict:table:rep_player_dues_schedules -->

**Purpose:** one dues plan per roster player per season — the headline amount a player owes (`total_amount`), broken into dated `rep_player_dues_installments`.

**Gotchas (read first):**
1. **UNIQUE `(program_year_id, player_id)`** (`..._program_year_id_player_id_key`) — exactly one schedule per player per season; both writers rely on it (`upsert(onConflict: 'program_year_id,player_id')` for the budget-generated path, read-then-update/insert for the manual path).
2. **`budget_line_id` → `rep_budget_lines` (the TEAM one — OPPOSITE side of the dual-budget-line trap) — but it is NEVER WRITTEN.** No insert path sets it and no mapper reads it; it is **always NULL** (verified: nullable, no default, live dev+prod). ⚠️ Consequence: the budget-line DELETE guard that selects schedules `WHERE budget_line_id = lineId` always finds zero, so the intended "block delete of a line with generated dues" trace is broken.
3. **`total_amount` is reconciled to the installments ONLY on the manual dues POST path** (±$0.01); the budget generator sets it = Σ(player installments) by construction. Nothing keeps them in sync afterward — editing installments can desync the total (no DB CHECK beyond `> 0`).
4. **CHECK `total_amount > 0`**.

**Fields** (boilerplate `id`, `created_at`, `updated_at` omitted):

<!-- dict:col:rep_player_dues_schedules.program_year_id -->
<!-- dict:col:rep_player_dues_schedules.player_id -->
<!-- dict:col:rep_player_dues_schedules.team_id -->
<!-- dict:col:rep_player_dues_schedules.org_id -->
**`program_year_id`** (FK → `rep_program_years.id`, NOT NULL) / **`player_id`** (FK → `rep_roster_players.id`, NOT NULL) / **`team_id`** (FK → `rep_teams.id`, NOT NULL) / **`org_id`** (FK → `organizations.id`, NOT NULL) — scope + the player who owes; `(program_year_id, player_id)` UNIQUE.

<!-- dict:col:rep_player_dues_schedules.total_amount -->
**`total_amount`** (numeric, NOT NULL, CHECK `> 0`) — total dues owed for the season (gotcha 3).

<!-- dict:col:rep_player_dues_schedules.notes -->
**`notes`** (text, nullable) — free text; the generator hardcodes "Generated from budget plan".

<!-- dict:col:rep_player_dues_schedules.budget_line_id -->
**`budget_line_id`** (FK → `rep_budget_lines.id` ON DELETE SET NULL, nullable) — intended trace to the originating team budget line; **dead — never written** (gotcha 2).

### `rep_player_dues_installments`
<!-- dict:table:rep_player_dues_installments -->

**Purpose:** the dated payment chunks of a dues schedule — what a player pays and when. The index `(due_date) WHERE paid_at IS NULL` powers the "upcoming/overdue unpaid" scans.

**Gotchas (read first):**
1. **`paid_at` is the source of truth for "paid", not `accounting_entry_id`.** Mark-paid sets `paid_at` (and links `accounting_entry_id` to the team-ledger income entry created at the same time); all balance/unpaid logic keys on `paid_at`.
2. **THREE reminder columns — all live, different cadences:** `reminder_sent_at` = original/ad-hoc "send reminders now" (no window); `reminder_30_sent_at` = the 30-day wave; `reminder_7_sent_at` = the 7-day wave. The candidate query checks the window-specific column (falls back to `reminder_sent_at`) and treats a reminder as "already sent" only within the last 7 days. (Contrast: `rep_allocation_installments` has only ONE `reminder_sent_at`.)
3. **`source` CHECK `manual|budget_generated`** (default `manual`). Regeneration is **all-or-nothing per season**: the generator 409s if ANY `budget_generated` installment already exists for the year (the coach must delete them first) — no selective preserve-manual/replace-generated merge, so the two sources don't coexist on the happy path.
4. **⚠️ `org_id` is NOT NULL with no default and no trigger (verified live), yet both insert paths omit it** (`replaceRepDuesInstallments` [lib/db.ts:5574](../../../lib/db.ts#L5574); the generator route) → inserts via these paths violate the NN constraint. `team_id` is nullable and also unset (the `team_idx` index exists but the column is effectively always NULL). Flag for /dba.
5. **CHECK `amount > 0`**; UNIQUE `(schedule_id, installment_number)`.

**Fields** (boilerplate `id`, `created_at` omitted; no `updated_at`):

<!-- dict:col:rep_player_dues_installments.schedule_id -->
<!-- dict:col:rep_player_dues_installments.player_id -->
**`schedule_id`** (FK → `rep_player_dues_schedules.id`, NOT NULL) / **`player_id`** (FK → `rep_roster_players.id`, NOT NULL) — parent schedule + denormalized player; `(schedule_id, installment_number)` UNIQUE.

<!-- dict:col:rep_player_dues_installments.installment_number -->
**`installment_number`** (int, NOT NULL) — 1-based sequence within the schedule.

<!-- dict:col:rep_player_dues_installments.amount -->
**`amount`** (numeric, NOT NULL, CHECK `> 0`) — the chunk's dollars; the schedule's installments are app-reconciled to `total_amount` (manual path).

<!-- dict:col:rep_player_dues_installments.due_date -->
**`due_date`** (date, NOT NULL) — drives overdue/upcoming; compared as `YYYY-MM-DD` strings.

<!-- dict:col:rep_player_dues_installments.paid_at -->
**`paid_at`** (timestamptz, nullable) — the authoritative paid flag (gotcha 1).

<!-- dict:col:rep_player_dues_installments.accounting_entry_id -->
**`accounting_entry_id`** (FK → `accounting_entries.id`, nullable; **org Accounting domain**) — back-link to the team-ledger income entry created on mark-paid; not the paid flag.

<!-- dict:col:rep_player_dues_installments.source -->
**`source`** (text, NOT NULL, default `manual`; CHECK `manual|budget_generated`) — origin (gotcha 3).

<!-- dict:col:rep_player_dues_installments.reminder_sent_at -->
<!-- dict:col:rep_player_dues_installments.reminder_30_sent_at -->
<!-- dict:col:rep_player_dues_installments.reminder_7_sent_at -->
**`reminder_sent_at`** / **`reminder_30_sent_at`** / **`reminder_7_sent_at`** (timestamptz, nullable) — ad-hoc / 30-day / 7-day reminder stamps (gotcha 2).

<!-- dict:col:rep_player_dues_installments.org_id -->
<!-- dict:col:rep_player_dues_installments.team_id -->
**`org_id`** (FK → `organizations.id`, **NOT NULL — but unwritten**, gotcha 4; index `org_idx`) / **`team_id`** (FK → `rep_teams.id`, nullable, also unset; index `team_idx`) — denormalized scope.

### `rep_dues_credits`
<!-- dict:table:rep_dues_credits -->

**Purpose:** non-payment reductions to a player's dues owing — contributions, fundraiser rebates, overpayments, misc. Standalone positive amounts subtracted from the balance (no `paid_at`).

**Gotchas (read first):**
1. **CIRCULAR FK with `rep_fundraiser_entries`; the authoritative direction is `fundraiser_entry_id → rep_fundraiser_entries.id`.** Both FKs exist (`rep_dues_credits.fundraiser_entry_id` and `rep_fundraiser_entries.credit_id`). On a fundraiser entry the credit is inserted **with `fundraiser_entry_id` set first**, then the entry's `credit_id` is back-filled — so `fundraiser_entry_id` is the durable link, `credit_id` the convenience reverse pointer. Only `credit_type='fundraiser'` credits have it set; manual credits leave it NULL.
2. **`credit_type` CHECK `contribution|fundraiser|overpayment|other`** (default `contribution`). Only `fundraiser` is system-generated (by the fundraiser flow); the other three come from the manual dues-credits POST.
3. **Balance formula & a clamping inconsistency:** a player's balance = `schedule.total_amount − Σ(paid installments) − Σ(credits)`. Whether negatives (overpaid/over-credited) surface depends on the reader — the dues GET and season-surplus do **not** clamp (can go negative); the fundraiser-entries GET clamps at 0. ⚠️ Worth normalizing.
4. **`created_at` is NULLABLE** (default `now()`) — asymmetric vs the schedule/installment `created_at` (NN). No `org_id`/`team_id`/`schedule_id` — scoped by `program_year_id` + `player_id` only.
5. **CHECK `amount > 0`**; `credit_date` defaults `CURRENT_DATE`.

**Fields** (boilerplate `id` omitted; `created_at` nullable — gotcha 4):

<!-- dict:col:rep_dues_credits.program_year_id -->
<!-- dict:col:rep_dues_credits.player_id -->
**`program_year_id`** (FK → `rep_program_years.id`, NOT NULL) / **`player_id`** (FK → `rep_roster_players.id`, NOT NULL) — scope + whose owing is reduced.

<!-- dict:col:rep_dues_credits.amount -->
**`amount`** (numeric, NOT NULL, CHECK `> 0`) — credit dollars (2dp).

<!-- dict:col:rep_dues_credits.description -->
**`description`** (text, NOT NULL) — required on manual POST; fundraiser path auto-fills "Fundraiser rebate — {name}".

<!-- dict:col:rep_dues_credits.credit_date -->
**`credit_date`** (date, NOT NULL, default `CURRENT_DATE`).

<!-- dict:col:rep_dues_credits.credit_type -->
**`credit_type`** (text, NOT NULL, default `contribution`; CHECK 4-value — gotcha 2).

<!-- dict:col:rep_dues_credits.notes -->
**`notes`** (text, nullable) — free text.

<!-- dict:col:rep_dues_credits.created_by -->
**`created_by`** (FK → `auth.users.id`, nullable; snapshot `foreign_table: null` — cross-schema gap).

<!-- dict:col:rep_dues_credits.fundraiser_entry_id -->
**`fundraiser_entry_id`** (FK → `rep_fundraiser_entries.id`, nullable) — the authoritative half of the circular FK (gotcha 1); set only for `fundraiser`-type credits.

### `rep_fundraisers`
<!-- dict:table:rep_fundraisers -->

**Purpose:** a team-and-season fundraising campaign header (e.g. "Chocolate Bar Drive"). Holds the campaign's default player-rebate rate; the per-player money lives in `rep_fundraiser_entries`.

**Gotchas (read first):**
1. **No DELETE route** — fundraisers are retired with `is_active=false` (PATCH), never removed; rows accumulate.
2. **`player_rebate_percent` is a template, not retroactive** — it is copied onto each entry's `rebate_percent` at entry-creation; editing it later does **not** re-rate existing entries (only new ones).
3. **CHECK `player_rebate_percent BETWEEN 0 AND 100`** (`rep_fundraisers_player_rebate_percent_check`; default 0).
4. **`is_active` is the only enforced gate** — it blocks **new** entry creation (400 "Fundraiser is closed"); it does not block editing existing entries. **`start_date`/`end_date` are informational only — never enforced** on write.
5. Scoped by `program_year_id`, so past-season fundraisers are invisible in the coach UI (filtered to the active program year).

**Fields** (boilerplate `id`, `created_at`, `updated_at` omitted):

<!-- dict:col:rep_fundraisers.org_id -->
<!-- dict:col:rep_fundraisers.team_id -->
<!-- dict:col:rep_fundraisers.program_year_id -->
**`org_id`** (FK → `organizations.id`, NOT NULL) / **`team_id`** (FK → `rep_teams.id`, NOT NULL) / **`program_year_id`** (FK → `rep_program_years.id`, NOT NULL) — scope; index `(team_id, program_year_id)`.

<!-- dict:col:rep_fundraisers.name -->
**`name`** (text, NOT NULL) — campaign name.

<!-- dict:col:rep_fundraisers.description -->
**`description`** (text, nullable).

<!-- dict:col:rep_fundraisers.player_rebate_percent -->
**`player_rebate_percent`** (numeric, NOT NULL, default 0, CHECK 0–100) — default rebate rate copied to entries (gotcha 2).

<!-- dict:col:rep_fundraisers.start_date -->
<!-- dict:col:rep_fundraisers.end_date -->
**`start_date`** / **`end_date`** (date, nullable) — informational window, not enforced (gotcha 4).

<!-- dict:col:rep_fundraisers.is_active -->
**`is_active`** (bool, NOT NULL, default true) — soft open/closed; gates new entries (gotcha 4).

### `rep_fundraiser_entries`
<!-- dict:table:rep_fundraiser_entries -->

**Purpose:** one row per player per fundraiser — how much that player raised and the resulting dues rebate. The hub of a cross-domain triple-write.

**Gotchas (read first):**
1. **Recording an entry triple-writes across two domains, non-transactionally.** POST creates (1) an `accounting_entries` income row in the **org** ledger (category `fundraising`, status `posted`), (2) this entry row, and (3) — only if `rebate_amount > 0` — a `rep_dues_credits` row, then a 4th write back-linking `credit_id`. There is **no rollback**: if the credit insert fails, the entry + accounting row persist with `credit_id=NULL`.
2. **UNIQUE `(fundraiser_id, player_id)`** — one entry per player per fundraiser (POST 409s if it exists → "use PATCH").
3. **No DELETE route** — an entry can't be removed, only PATCHed. Setting amount to 0 zeroes the rebate and **deletes the linked credit**, but the entry row and its (now-$0) accounting income row remain.
4. **`rebate_percent` is a SNAPSHOT** copied from the fundraiser at POST and **never recomputed** from the live fundraiser; PATCH uses the stored snapshot. **`rebate_amount = round(amount_raised × rebate_percent / 100, 2)`**, computed and stored (not DB-generated); recomputed on PATCH.
5. **CHECK `amount_raised >= 0`** (`rep_fundraiser_entries_amount_raised_check`) — note `>= 0`, not `> 0`: a player can be recorded with $0 raised.
6. **`accounting_entry_id` (→ org `accounting_entries`) is ALWAYS set on POST here** (unlike the expense/payment-request/allocation tables where it's unused); on a PATCH amount change the linked accounting row's amount is updated in lockstep. **`credit_id`** is the circular-FK reverse pointer (see `rep_dues_credits`).

**Fields** (boilerplate `id`, `created_at`, `updated_at` omitted):

<!-- dict:col:rep_fundraiser_entries.fundraiser_id -->
<!-- dict:col:rep_fundraiser_entries.org_id -->
<!-- dict:col:rep_fundraiser_entries.team_id -->
<!-- dict:col:rep_fundraiser_entries.player_id -->
**`fundraiser_id`** (FK → `rep_fundraisers.id`, NOT NULL) / **`org_id`** (FK → `organizations.id`, NOT NULL) / **`team_id`** (FK → `rep_teams.id`, NOT NULL) / **`player_id`** (FK → `rep_roster_players.id`, NOT NULL) — parent campaign + scope + the player; UNIQUE `(fundraiser_id, player_id)`; indexes `fundraiser_idx`, `player_idx`.

<!-- dict:col:rep_fundraiser_entries.amount_raised -->
**`amount_raised`** (numeric, NOT NULL, CHECK `>= 0`) — dollars raised by this player (gotcha 5).

<!-- dict:col:rep_fundraiser_entries.rebate_percent -->
<!-- dict:col:rep_fundraiser_entries.rebate_amount -->
**`rebate_percent`** (numeric, NOT NULL, default 0) — snapshot of the fundraiser rate (gotcha 4) / **`rebate_amount`** (numeric, NOT NULL, default 0) — computed dollars rebated to the player's dues.

<!-- dict:col:rep_fundraiser_entries.accounting_entry_id -->
**`accounting_entry_id`** (FK → `accounting_entries.id`, nullable; **org Accounting**) — the posted org-ledger income row; always set in practice (gotcha 6).

<!-- dict:col:rep_fundraiser_entries.credit_id -->
**`credit_id`** (FK → `rep_dues_credits.id`, nullable) — reverse half of the circular FK; null when `rebate_amount = 0`.

<!-- dict:col:rep_fundraiser_entries.notes -->
**`notes`** (text, nullable) — free text.

### `rep_cost_allocations`
<!-- dict:table:rep_cost_allocations -->

**Purpose:** a shared cost the ORG splits across multiple rep teams (e.g. a facility bill divided among teams). The envelope; the per-team shares are `rep_allocation_splits`, the dated payments `rep_allocation_installments`. Created org-side (admin), paid coach-side.

**Gotchas (read first):**
1. **`source_budget_line_id` → `org_budget_lines` (ORG Accounting), NOT `rep_budget_lines`** (dual-budget-line trap). Set only by the org→team bridge route (`allocate-to-teams` — an org budget line allocated across teams); the manual-allocation POST leaves it NULL. `source_entry_id` → `accounting_entries` (ORG) — for an allocation originating from a posted org ledger entry; in current callers it is effectively always NULL.
2. **Top-level reconciliation allows under-allocation** — Σ`splits.amount` is enforced **≤** `total_amount` (+$0.001 tol), not `=` (an allocation can be partially distributed).
3. **`mapRepCostAllocation` does not surface `source_budget_line_id`** — only the bridge route echoes it; most code is blind to the budget-line link after creation.
4. **CHECK `total_amount > 0`**. Created/written only by `createRepCostAllocationWithSplits` ([lib/db.ts:5135](../../../lib/db.ts#L5135)).

**Fields** (boilerplate `id`, `created_at` omitted; no `updated_at`):

<!-- dict:col:rep_cost_allocations.org_id -->
**`org_id`** (FK → `organizations.id`, NOT NULL) — owning org; every read scoped by it.

<!-- dict:col:rep_cost_allocations.source_entry_id -->
**`source_entry_id`** (FK → `accounting_entries.id`, nullable; **org Accounting**) — origin org ledger entry (gotcha 1); effectively always NULL in current callers.

<!-- dict:col:rep_cost_allocations.source_budget_line_id -->
**`source_budget_line_id`** (FK → `org_budget_lines.id`, nullable; **org Accounting**) — origin org budget line; set only by the bridge route; partial index WHERE not null (gotcha 1).

<!-- dict:col:rep_cost_allocations.description -->
**`description`** (text, NOT NULL) — editable via `updateRepCostAllocationDescription`.

<!-- dict:col:rep_cost_allocations.total_amount -->
**`total_amount`** (numeric, NOT NULL, CHECK `> 0`) — the allocation envelope; in the bridge path copied from the org budget line's total.

<!-- dict:col:rep_cost_allocations.created_by -->
**`created_by`** (FK → `auth.users.id`, nullable; snapshot `foreign_table: null` — cross-schema gap).

### `rep_allocation_splits`
<!-- dict:table:rep_allocation_splits -->

**Purpose:** one rep team's share of a cost allocation. UNIQUE `(allocation_id, team_id)` — a team can't be double-allocated within one allocation.

**Gotchas (read first):**
1. **`split_method` (CHECK `percentage|sessions|fixed`) interprets `split_value`; `amount` is always the resolved dollars.** `fixed` → `split_value` IS the dollars; `percentage` → `split_value` is a percent and `amount = round(total × split_value)/100`; `sessions` → `split_value` is a per-session rate and `amount` is **entered manually** (NOT auto-derived). The server trusts the client's `amount` (does not recompute from `split_value`). `split_value` is plain `numeric` (the snapshot doesn't record scale) holding the fractional rate / percent / per-session value behind the resolved `amount`.
2. **`payment_schedule` (CHECK `standard|custom`, default `standard`):** `standard` = ONE installment for the full split amount on a single due date; `custom` = multiple coach-defined installments. No auto-even-split generator.
3. **Mid-level reconciliation is strict** — Σ`installments.amount` per split must **=** `split.amount` (±$0.01), tighter than the allocation-level ≤ rule.
4. **`team_id` is NOT NULL here** (contrast: `rep_allocation_installments.team_id` is nullable). **CHECK `amount > 0`.**

**Fields** (boilerplate `id`, `created_at` omitted; no `updated_at`):

<!-- dict:col:rep_allocation_splits.allocation_id -->
<!-- dict:col:rep_allocation_splits.team_id -->
<!-- dict:col:rep_allocation_splits.program_year_id -->
<!-- dict:col:rep_allocation_splits.org_id -->
**`allocation_id`** (FK → `rep_cost_allocations.id`, NOT NULL) / **`team_id`** (FK → `rep_teams.id`, NOT NULL) / **`program_year_id`** (FK → `rep_program_years.id`, NOT NULL) / **`org_id`** (FK → `organizations.id`, NOT NULL) — parent + the owing team + season + denormalized org; UNIQUE `(allocation_id, team_id)`; index `(team_id, program_year_id)`.

<!-- dict:col:rep_allocation_splits.amount -->
**`amount`** (numeric, NOT NULL, CHECK `> 0`) — the team's resolved share in dollars (gotcha 1).

<!-- dict:col:rep_allocation_splits.split_method -->
<!-- dict:col:rep_allocation_splits.split_value -->
**`split_method`** (text, NOT NULL; CHECK `percentage|sessions|fixed`) / **`split_value`** (numeric, NOT NULL) — how the share was derived (gotcha 1).

<!-- dict:col:rep_allocation_splits.payment_schedule -->
**`payment_schedule`** (text, NOT NULL, default `standard`; CHECK `standard|custom`) — installment shape (gotcha 2).

<!-- dict:col:rep_allocation_splits.notes -->
**`notes`** (text, nullable) — free text.

### `rep_allocation_installments`
<!-- dict:table:rep_allocation_installments -->

**Purpose:** the dated payments of an allocation split — what a team pays the org and when.

**Gotchas (read first):**
1. **⚠️ `getRepAllocationSplitsForTeam` queries the non-existent column `allocation_split_id`** ([lib/db.ts:5663](../../../lib/db.ts#L5663)); the real FK is **`split_id`** → the coach allocations GET errors. Other paths correctly use `split_id`. Flag for /dba.
2. **⚠️ `org_id` is NOT NULL with no default/trigger (verified live), yet `createRepCostAllocationWithSplits` omits it on insert** ([lib/db.ts:5172](../../../lib/db.ts#L5172)) → inserts via this path violate the NN constraint. `team_id` is nullable and also unset (denormalized copy of the split's team; the `team_idx` exists but the column is effectively NULL).
3. **Paid = `paid_at` (+ `paid_by`), NOT `accounting_entry_id`.** Mark-paid (`markRepAllocationInstallmentPaid` [lib/db.ts:5206](../../../lib/db.ts#L5206)) sets `paid_at`/`paid_by`; its only caller (the coach installment PATCH route) passes `accounting_entry_id = null`, so the payment posts via `create_accounting_transfer` (team→org) and the installment is never linked. Pay is one-way (409 if already paid; no unpay).
4. **ONE reminder column** (`reminder_sent_at`, 7-day re-send debounce) — contrast the dues installments' three.
5. **CHECK `amount > 0`**; UNIQUE `(split_id, installment_number)`.

**Fields** (boilerplate `id`, `created_at` omitted; no `updated_at`):

<!-- dict:col:rep_allocation_installments.split_id -->
**`split_id`** (FK → `rep_allocation_splits.id`, NOT NULL) — parent split (gotcha 1 — beware the `allocation_split_id` typo); UNIQUE `(split_id, installment_number)`.

<!-- dict:col:rep_allocation_installments.installment_number -->
**`installment_number`** (int, NOT NULL) — 1-based within the split.

<!-- dict:col:rep_allocation_installments.amount -->
**`amount`** (numeric, NOT NULL, CHECK `> 0`) — chunk dollars; installments sum = `split.amount` (±$0.01).

<!-- dict:col:rep_allocation_installments.due_date -->
**`due_date`** (date, NOT NULL).

<!-- dict:col:rep_allocation_installments.paid_at -->
<!-- dict:col:rep_allocation_installments.paid_by -->
**`paid_at`** (timestamptz, nullable) — the paid flag / **`paid_by`** (FK → `auth.users.id`, nullable; cross-schema gap) — who marked it (gotcha 3).

<!-- dict:col:rep_allocation_installments.accounting_entry_id -->
**`accounting_entry_id`** (FK → `accounting_entries.id`, nullable; **org Accounting**) — designed back-link; **never written** (gotcha 3).

<!-- dict:col:rep_allocation_installments.reminder_sent_at -->
**`reminder_sent_at`** (timestamptz, nullable) — single org→coach reminder stamp (gotcha 4).

<!-- dict:col:rep_allocation_installments.org_id -->
<!-- dict:col:rep_allocation_installments.team_id -->
**`org_id`** (FK → `organizations.id`, **NOT NULL — but unwritten**, gotcha 2; index `org_idx`) / **`team_id`** (FK → `rep_teams.id`, nullable, also unset; index `team_idx`) — denormalized scope.

### `rep_team_expenses`
<!-- dict:table:rep_team_expenses -->

**Purpose:** a coach-authored ledger of money the team spends or owes. Two shapes share the row via `expense_type`: a one-shot **expense** (single `amount`/`expense_paid_at`) vs a **tournament_payable** that splits into a deposit leg + a balance leg.

**Gotchas (read first):**
1. **⚠️ SCHEMA/CODE MISMATCH — there is NO `notes` column** (verified live dev+prod 2026-06-09; the row has exactly 23 columns), yet `createRepTeamExpense` ([lib/db.ts:5457](../../../lib/db.ts#L5457)) and `updateRepTeamExpense` ([lib/db.ts:5480](../../../lib/db.ts#L5480)) write `notes` → any insert/update through these helpers errors `column "notes" does not exist`. The exact schema-drift class this dictionary exists to surface. Flag for /dba.
2. **Two-payment model is by `expense_type`, NOT by arithmetic.** `expense`: fully paid when `expense_paid_at` is set; the deposit/balance fields are ignored. `tournament_payable`: fully paid when BOTH `deposit_paid_at` AND `balance_paid_at` are set; paid amount = (deposit_paid_at ? deposit_amount : 0) + (balance_paid_at ? balance_amount : 0). **`deposit_amount + balance_amount == amount` is NOT enforced** (no CHECK, no app validation). Worse, mark-deposit/mark-balance fall back to the FULL `amount` when the leg amount is NULL, so a payable with null split amounts can post the full amount twice. There is no single "is paid" flag.
3. **`expense_type` CHECK `expense|tournament_payable`** — `tournament_payable` = money owed to a tournament/host (deposit+balance schedule). `upcoming-payables` surfaces rows by deposit/balance **due dates only**, regardless of `expense_type`, so lump `expense` rows (no due dates) never appear there.
4. **`accounting_entry_id` is never written** — on mark-paid the route creates a team-ledger entry but discards its id (the ledger entry is authoritative, no back-reference).
5. **`payee_id` (→ org `org_payees`) vs `payee_payer` (text) are mutually exclusive** — picking a structured org payee sets `payee_id` (clears `payee_payer`); a free-text name sets `payee_payer` (clears `payee_id`); both set at create only. **`category` is free text** and is the (name-based, case-insensitive) join key to `rep_budget_lines` categories in budget-vs-actual — a typo silently drops the expense into "unbudgeted".
6. **CHECK `amount > 0`** (only `amount`; the deposit/balance amounts have no CHECK and are nullable).

**Fields** (boilerplate `id`, `created_at`, `updated_at` omitted; **note: no `notes` column exists** — see gotcha 1):

<!-- dict:col:rep_team_expenses.program_year_id -->
<!-- dict:col:rep_team_expenses.team_id -->
<!-- dict:col:rep_team_expenses.org_id -->
**`program_year_id`** (FK → `rep_program_years.id`, NOT NULL) / **`team_id`** (FK → `rep_teams.id`, NOT NULL) / **`org_id`** (FK → `organizations.id`, NOT NULL) — scope; primary list filter `program_year_id` (index `year_idx`).

<!-- dict:col:rep_team_expenses.expense_type -->
**`expense_type`** (text, NOT NULL; CHECK `expense|tournament_payable`) — shape selector (gotchas 2–3).

<!-- dict:col:rep_team_expenses.description -->
**`description`** (text, NOT NULL) — reused as the ledger entry description on pay.

<!-- dict:col:rep_team_expenses.category -->
**`category`** (text, nullable) — free-text budget-match key (gotcha 5).

<!-- dict:col:rep_team_expenses.amount -->
**`amount`** (numeric, NOT NULL, CHECK `> 0`) — full cost; for `tournament_payable` NOT validated against deposit+balance (gotcha 2).

<!-- dict:col:rep_team_expenses.expense_paid_at -->
**`expense_paid_at`** (timestamptz, nullable) — marks a lump `expense` paid (not used for payables).

<!-- dict:col:rep_team_expenses.deposit_amount -->
<!-- dict:col:rep_team_expenses.deposit_due_date -->
<!-- dict:col:rep_team_expenses.deposit_paid_at -->
**`deposit_amount`** (numeric, nullable) / **`deposit_due_date`** (date, nullable) / **`deposit_paid_at`** (timestamptz, nullable) — the deposit leg of a `tournament_payable` (gotcha 2).

<!-- dict:col:rep_team_expenses.balance_amount -->
<!-- dict:col:rep_team_expenses.balance_due_date -->
<!-- dict:col:rep_team_expenses.balance_paid_at -->
**`balance_amount`** (numeric, nullable) / **`balance_due_date`** (date, nullable) / **`balance_paid_at`** (timestamptz, nullable) — the balance leg (gotcha 2).

<!-- dict:col:rep_team_expenses.event_id -->
**`event_id`** (FK → `rep_team_events.id`, nullable; **Rep operations**) — optional link to a team event.

<!-- dict:col:rep_team_expenses.accounting_entry_id -->
**`accounting_entry_id`** (FK → `accounting_entries.id`, nullable; **org Accounting**) — never written (gotcha 4).

<!-- dict:col:rep_team_expenses.payment_method -->
**`payment_method`** (text, nullable) — free-text label.

<!-- dict:col:rep_team_expenses.payee_id -->
<!-- dict:col:rep_team_expenses.payee_payer -->
**`payee_id`** (FK → `org_payees.id`, nullable; **org Accounting**) / **`payee_payer`** (text, nullable) — structured-vs-freetext payee, mutually exclusive (gotcha 5).

<!-- dict:col:rep_team_expenses.created_by -->
**`created_by`** (FK → `auth.users.id`, nullable; cross-schema gap).

### `rep_team_payment_requests`
<!-- dict:table:rep_team_payment_requests -->

**Purpose:** the coach → admin approval workflow for moving money between a team's ledger and the org's ledger. A coach files a request (`pending`); an org admin/treasurer/owner approves (posts an accounting transfer) or denies (with a reason). No expense row is created by this flow.

**Gotchas (read first):**
1. **`request_type` DIRECTION (CHECK `payment_to_org|charge_to_org`):** `payment_to_org` = team pays the org (transfer team→org ledger, category `team_payment_to_org`); `charge_to_org` = org pays/charges to the team (transfer org→team ledger, category `team_charge_to_org`).
2. **On approve, `accounting_entry_id` is NOT set** — approval calls the `create_accounting_transfer` RPC then updates status, but ignores the RPC's entry id; the column has an FK but is never populated. The ledger transfer is authoritative.
3. **Approve posts a ledger transfer but creates NO `rep_team_expense`** — the two finance tables are decoupled.
4. **`budget_line_id` → `org_budget_lines` (ORG Accounting), NOT `rep_budget_lines`** (dual-budget-line trap). Accepted from the coach and surfaced on read, but **not used in the approval/transfer logic** — a categorization hint only, often NULL.
5. **`status` (CHECK `pending|approved|denied`, default `pending`) is a one-way machine** — both approve and deny 409 if `status != pending`; no reopening. `denial_reason` is required (app-layer) on deny. `reviewed_by`/`reviewed_at` stamped on the decision. Coaches may DELETE (cancel) only their own **pending** requests.
6. **`created_by` is NOT NULL** (the requesting coach); `reviewed_by` nullable until decided. **NO Stripe columns** — settlement is internal double-entry only (`payment_method` is a free-text label, not a Stripe ref). **CHECK `amount > 0`**; indexes `(org_id, status)`, `(team_id, status)`.

**Fields** (boilerplate `id`, `created_at`, `updated_at` omitted):

<!-- dict:col:rep_team_payment_requests.org_id -->
<!-- dict:col:rep_team_payment_requests.team_id -->
**`org_id`** (FK → `organizations.id`, NOT NULL) / **`team_id`** (FK → `rep_teams.id`, NOT NULL) — scope; status-indexed both ways.

<!-- dict:col:rep_team_payment_requests.request_type -->
**`request_type`** (text, NOT NULL; CHECK `payment_to_org|charge_to_org`) — transfer direction (gotcha 1).

<!-- dict:col:rep_team_payment_requests.amount -->
**`amount`** (numeric, NOT NULL, CHECK `> 0`) — transfer dollars (app ceiling ≤ 999999.99).

<!-- dict:col:rep_team_payment_requests.description -->
**`description`** (text, NOT NULL) — reused as the transfer description.

<!-- dict:col:rep_team_payment_requests.payment_method -->
**`payment_method`** (text, nullable) — free-text label (not Stripe).

<!-- dict:col:rep_team_payment_requests.notes -->
**`notes`** (text, nullable) — coach free text. *(This column DOES exist here — contrast `rep_team_expenses`, which has no `notes` column.)*

<!-- dict:col:rep_team_payment_requests.status -->
**`status`** (text, NOT NULL, default `pending`; CHECK `pending|approved|denied`) — one-way machine (gotcha 5).

<!-- dict:col:rep_team_payment_requests.denial_reason -->
**`denial_reason`** (text, nullable) — required on deny (gotcha 5).

<!-- dict:col:rep_team_payment_requests.budget_line_id -->
**`budget_line_id`** (FK → `org_budget_lines.id`, nullable; **org Accounting**) — categorization hint; not used in transfer logic (gotcha 4).

<!-- dict:col:rep_team_payment_requests.accounting_entry_id -->
**`accounting_entry_id`** (FK → `accounting_entries.id`, nullable; **org Accounting**) — never written (gotcha 2).

<!-- dict:col:rep_team_payment_requests.created_by -->
<!-- dict:col:rep_team_payment_requests.reviewed_by -->
<!-- dict:col:rep_team_payment_requests.reviewed_at -->
**`created_by`** (FK → `auth.users.id`, NOT NULL; cross-schema gap) — the requesting coach / **`reviewed_by`** (FK → `auth.users.id`, nullable; cross-schema gap) + **`reviewed_at`** (timestamptz, nullable) — stamped on decision.

---

*End of Rep finance (Phase 4b — 13 tables) and of the Rep teams / team workspaces domain (25 tables total: 12 operations + 13 finance). The 4 `team_workspace_*` tables the coverage classifier files under this domain live in the Coaches / basic-teams domain. Deferred: any cross-module roster snapshot back-link (`tournament_roster_players.source_player_id` etc., free-tier Phase 5) — absent from `rep_roster_players` today.*
