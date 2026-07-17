# FieldLogicHQ — Data Dictionary

> **Owned by:** `/db` (field lookups, operational queries) + `/dba` (architecture, migrations, snapshots). **Never archived** — this is a living agent reference.
> **What this is:** the *semantic* layer — for each meaningful column, **what it means, what reads/writes it (file:line), how it relates to other fields, and its gotchas**. Structure (types/constraints) is owned by the JSON snapshots; this doc does **not** restate it.
> **Current as of:** code commit `cbcf7c7` (branch `feat/free-tier-coaches`) · schema snapshot **2026-06-10** (dev 113 / prod 113 tables). `file:line` refs are relative to that commit — re-verify if the tree has moved. _(Tournaments & Registration + Coaches domains were originally authored at `ad9dc66`; Org / Platform core and Rep teams / team workspaces — operations half — at `5479605`; **League / house-league** at `6deac4a`; **Accounting** + **Stripe / Billing** + **Platform admin** at `cbcf7c7` (Platform admin's `file:line` refs reflect the working tree — see that domain's stamp). The earlier League `lib/db.ts` +37 working-tree shift was resolved when the league `org_id` fix landed in `cbcf7c7` — the tree is now clean.)_
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
**Stripe / subscription block** (`stripe_customer_id`, `stripe_subscription_id`, `subscription_status`, `subscription_period`, `current_period_end`, `rep_team_subscription_item_id`) — Stripe linkage + subscription state. `subscription_status` (no DB CHECK; code domain `active|trialing|past_due|canceled`, [lib/types.ts:13](../../../lib/types.ts#L13)) defaults `'active'`; `subscriptionStatus==='canceled'` hard-disables module entitlements ([lib/module-entitlements.ts:15](../../../lib/module-entitlements.ts#L15)) and blocks public tournament context ([lib/public-tournament-data.ts:60](../../../lib/public-tournament-data.ts#L60)). **Main writer = the Stripe webhook** ([app/api/billing/webhook/route.ts](../../../app/api/billing/webhook/route.ts): `subscription.updated/created` ~:233, `payment_succeeded`→active ~:528, `payment_failed`→`past_due` ~:557, `subscription.deleted`→`canceled`+null ~:466); also `updateOrgSubscription` ([lib/db.ts:2457-2464](../../../lib/db.ts#L2457)). **`rep_team_subscription_item_id` is RETIRING (Club Repackaging 2026-06-22):** it tracked the now-retired per-team "$19/team beyond 3" rep-team Stripe add-on item; its writer (`syncRepTeamBilling`) was deleted. The column is now read-only/vestigial (0 rows carry a value) — no new writes; safe to drop post-cutover. *(Billing-flow narrative + the `stripe_prices` table → the Stripe/Billing phase; these columns are documented here.)*

<!-- dict:col:organizations.billing_suspended_at -->
<!-- dict:col:organizations.billing_suspension_reason -->
**`billing_suspended_at` / `billing_suspension_reason`** (timestamptz / text, nullable) — suspension audit stamp; set on subscription deletion, cancel-confirm, and platform-admin cancel; cleared on team-workspace reactivation. **Not on the `Organization` type** (subsystem-only).

<!-- dict:col:organizations.tournament_limit -->
**`tournament_limit`** (int, NOT NULL, default 1) — stored cap. The hydrated `Organization.tournamentLimit` is **never the raw column** — it's always clamped through `getEffectiveTournamentLimit(plan_id, tournament_limit)` in all three mappers ([lib/db.ts:2485](../../../lib/db.ts#L2485), [lib/plan-config.ts](../../../lib/plan-config.ts)). (Platform-admin bulk-ops reads the raw column directly.) _Writes:_ `createOrganization`, `updateOrgSubscription`, onboarding-plan.

<!-- dict:col:organizations.team_limit -->
**`team_limit`** (int, **nullable**; mig 145, Club Repackaging) — per-org rep-team capacity override, mirroring `tournament_limit`. **Semantics differ intentionally:** the hydrated `Organization.teamLimit = getEffectiveTeamLimit(plan_id, team_limit)` returns the **raw stored value when set** (it RAISES the band for "custom above 30" Club · Association deals), else the plan band default (`PLAN_CONFIG.teamLimit`: club=15, club_large=30, others=9999≈uncapped). NULL = plan default. Enforced at rep-team create ([app/api/admin/rep-teams/teams/route.ts](../../../app/api/admin/rep-teams/teams/route.ts)) against `getNonArchivedRepTeamCount` (all non-archived rep teams count equally). _Writes:_ platform-admin org plan PATCH ([app/api/platform-admin/orgs/[id]/plan/route.ts](../../../app/api/platform-admin/orgs/[id]/plan/route.ts)).

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

<!-- dict:col:organizations.coach_settings -->
**`coach_settings`** (jsonb, NOT NULL, default `'{}'`; mig 174) — org-level Coaches-Portal settings, mirrors `pdf_settings`. **Key catalog** (`OrgCoachSettings`, `lib/assistant-invites.ts`): `require_assistant_approval` (bool, default false/absent — when true a club admin must approve an assistant-coach invite before the email is sent). _Reads/writes:_ `app/api/admin/org/coach-settings/route.ts`. **Not on the `Organization` type** (read subsystem-directly).

<!-- dict:col:organizations.pdf_settings -->
**`pdf_settings`** (jsonb, nullable, default `'{}'`) — org-level PDF report template config. **Key catalog** (`OrgPdfSettings`, [lib/export/pdf.ts:19-46](../../../lib/export/pdf.ts#L19)): `headerLine1`/`headerLine2`, `footerText`, `showDateStamp`/`showPageNumbers`/`showBranding` (free plan forces branding on), `orientation`, `accentColor`, `logoDataUrl`, `reportDensity`, `includeGuardianContacts`/`includePlayerNotes`/`includeInternalNotes`. _Reads/writes:_ [app/api/admin/org/pdf-settings/route.ts](../../../app/api/admin/org/pdf-settings/route.ts). **Not on the `Organization` type.**

<!-- dict:col:organizations.account_kind -->
**`account_kind`** (text, NOT NULL, default `'organization'`; CHECK `organization|team_workspace`) — real org vs team-workspace shadow org (gotcha 4). _Writes:_ `createOrganization` ([lib/db.ts:2422](../../../lib/db.ts#L2422)).

<!-- dict:col:organizations.team_workspace_status -->
**`team_workspace_status`** (text, nullable; CHECK NULL or `active|linked|org_owned|archived`) — lifecycle of a shadow org; set only when `account_kind='team_workspace'`. _Writes:_ team-checkout (`active`), org-link (`linked`), ownership-transfer (`org_owned`).

<!-- dict:col:organizations.free_floor -->
**`free_floor`** (text, nullable; CHECK NULL or `league_starter`; mig 125, dev-only until deploy) — **free-floor entitlement profile**, layered **on top of** `plan_id` (it is NOT a plan key). `'league_starter'` = the capped free house-league floor (Free Tier Phase 6): the org keeps `plan_id='tournament'` and this column unions `module_house_league` into `hasModuleEntitlement` ([lib/module-entitlements.ts:18](../../../lib/module-entitlements.ts#L18) via [lib/free-floor.ts](../../../lib/free-floor.ts)) and imposes server-side house-league caps (1 season / 1 division / 8 teams). **Never grants `module_public_site`** (the full org site stays a paid-League differentiator). null = no floor (every existing org). Forward-compatible with a future `'tournament_free'`. _Writes:_ `createOrganization` (`freeFloor` option) / the League Starter create route. _Reads:_ all three org mappers map it to `Organization.freeFloor`.

<!-- dict:col:organizations.email_marketing_opt_out -->
<!-- dict:col:organizations.email_opt_out_at -->
**`email_marketing_opt_out` / `email_opt_out_at`** (bool default false, partial-indexed `idx_organizations_email_opt_out WHERE true` / timestamptz) — marketing-email suppression; `email-sender.ts` skips sends when true. _Writes:_ `/unsubscribe` route (set), `email/resubscribe` (clear). **Not on the `Organization` type** (email subsystem only).

<!-- dict:col:organizations.privacy_policy_url -->
**`privacy_policy_url`** (text, nullable; **mig 164**) — optional external privacy-policy URL. The forward-compatible **"pipe"** the tryout consent gate links to when set; NULL = no policy → consent renders without a link. Resolved via the single seam `getOrgPrivacyPolicyHref` ([lib/privacy-policy.ts](../../../lib/privacy-policy.ts)); the future in-platform org privacy page wires into the same helper. _Reads:_ `mapOrg` → `Organization.privacyPolicyUrl`. No admin-settings editor yet (lands with the League/Club public-site privacy page).

---

## `organization_members`
<!-- dict:table:organization_members -->

**Purpose:** the **org membership + RBAC row** — one per `(organization_id, user_id)`. Identity key is `user_id` (NOT email). Drives the entire admin authorization model: `role` → default capability set, `capabilities` jsonb → per-member overrides, narrowed by the two scope join tables.

**Gotchas (read first):**
1. **`role` has no DB CHECK — the enum is `OrgRole` in code** (8 values: `owner|admin|staff|official|league_admin|league_registrar|treasurer|coach`, [lib/types.ts:12](../../../lib/types.ts#L12)). DB default `'admin'` is effectively dead (every insert passes an explicit role). The **invitable** subset is narrower (`admin|staff|official|league_admin|league_registrar|treasurer`); `owner`/`coach` are set by other flows.
2. **`role='owner'` short-circuits authorization before capabilities are read** — `hasCapability` returns true unconditionally ([lib/roles.ts:82](../../../lib/roles.ts#L82)), and owners skip both scope tables (unrestricted).
3. **`capabilities` is additive *and subtractive*.** An explicit `capabilities[cap]` (true OR false) **wins** over the role default; absent → role default ([lib/roles.ts:83-85](../../../lib/roles.ts#L83)). Owner-only to edit.
4. **`mapMember` maps only 6 of 11 columns** ([lib/db.ts:2504](../../../lib/db.ts#L2504)) — it drops `capabilities`, `status`, `display_name`, `title`, `invited_email`; the `OrganizationMember` type lacks them too. The members admin API reads what it needs via its own select.
5. **Suspended = unauthenticated platform-wide.** `getAuthContext` filters `.neq('status','suspended')` ([lib/api-auth.ts:87](../../../lib/api-auth.ts#L87)) → a suspended member gets 401 (not 403) on every `/api/admin/*` route. **Last-owner protection** blocks deleting/demoting/suspending the final owner.
6. **One-org-per-user is enforced in app code, not schema** — invite rejects a user already in any other org. The DB UNIQUE is only `(organization_id, user_id)`. Pending invites can also be **reconciled by `invited_email`** (mig 128) when the invitee authenticates under a different identity than the one the invite minted.

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

<!-- dict:col:organization_members.invited_email -->
**`invited_email`** (text, nullable; indexed `lower(invited_email) WHERE status='invited'`, mig 128) — the email a pending invite was sent to, persisted so **invite reconciliation** ([lib/invite-reconciliation.ts](../../../lib/invite-reconciliation.ts)) can match a freshly-authenticated user by email and re-point the orphaned `status='invited'` row to their real `user_id` — the fix for invitees who self-register/log in instead of clicking the email link. NULL = legacy/pre-128 row or a direct existing-user add (`user_id` already correct, no reconciliation needed). Written lowercased by the invite route; matched case-insensitively via `lower()`. **Not an identity key** (`user_id` still is) — purely the reconciliation match key.

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

<!-- dict:col:tournaments.sport -->
**`sport`** (text, NOT NULL, default `'softball'`; mig 136) — the tournament's sport. Drives the per-sport **Sport Pack** ([lib/sports.ts](../../../lib/sports.ts)) that supplies score vocabulary (Runs/Goals/Points), default tie-breakers, points-per-win, diff-cap applicability, default surface, and the countdown verb. **Free-text** (mirrors `league_seasons.sport` / `rep_teams.sport`) — read via `getSportPack`/`normalizeSportId`, which fall back to `'softball'`; the value is normalized for display, never trusted as an enum. Carried on clone + populate-from ([lib/db.ts](../../../lib/db.ts)). **Phase 1 (mig 136) records it only — default `'softball'`, no UI and no behaviour change;** the creation picker, Event Settings field, and sport-aware labels/rules land in later phases. _Dev/prod:_ dev-applied; **prod-pending until release** (apply with the rest of the multi-sport phases).

<!-- dict:col:tournaments.start_date -->
<!-- dict:col:tournaments.end_date -->
**`start_date` / `end_date`** (date) — drive game-day/phase logic and public countdowns.

<!-- dict:col:tournaments.contact_email -->
**`contact_email`** — legacy/explicit organizer contact, still used as a **fallback** in the admin-notify chain (assigned member → default member → `contact_email` → footer → `ADMIN_EMAIL`) ([register/route.ts:485](../../../app/api/register/route.ts#L485)). Distinct from `org_public_site_content.contact_email`.

<!-- dict:col:tournaments.default_contact_member_id -->
**`default_contact_member_id`** (FK → `organization_members.id`) — default registration-notification recipient (contact refactor 088–090); resolved via `getMemberEmail` ([register/route.ts:310](../../../app/api/register/route.ts#L310)).

<!-- dict:col:tournaments.notify_mode -->
**`notify_mode`** (text, NOT NULL, default `'all'`; CHECK `all|assigned`) — routes admin reg-notify emails. `'all'` → always the tournament default contact; `'assigned'` → the division contact if set, else the default ([register/route.ts:482](../../../app/api/register/route.ts#L482)).

<!-- dict:col:tournaments.contact_show_to_coaches -->
**`contact_show_to_coaches`** (boolean, NOT NULL, default `true`; mig 120) — per-**audience** display toggle for the *registered-coach* audience: when `false`, the resolved contact email is omitted from (a) all coach-facing emails — registration/waitlist ([register/route.ts](../../../app/api/register/route.ts)) and acceptance/decline/payment ([registrations/[id]/route.ts](../../../app/api/registrations/[id]/route.ts)) — and (b) the in-app Coaches Portal status banner + fee line ([coaches/tournaments/[teamId]/page.tsx](../../../app/coaches/tournaments/[teamId]/page.tsx)). Display-only — does **not** affect admin reg-notify routing (that still uses the resolved chain). Enforced via `resolveTournamentContactEmail(..., 'coach')` ([lib/db.ts](../../../lib/db.ts)). Surfaced in Settings → Notifications & Contact as "Communication with coaches". (Earlier dev-only draft named this `contact_show_in_emails`; renamed pre-prod.)

<!-- dict:col:tournaments.contact_show_on_public -->
**`contact_show_on_public`** (boolean, NOT NULL, default `true`; mig 120) — per-**audience** display toggle for the *public/anonymous* audience: when `false`, no contact email is shown on public tournament pages. Enforced in `resolveTournamentContactEmail(..., 'public')` ([lib/db.ts](../../../lib/db.ts)), which returns `null` (suppressing even the `org` fallback) so the toggle can't be a no-op. When `true`, public pages resolve the **selected member's** email (then legacy `contact_email`, then org) — previously the public surface only read legacy `contact_email`.

<!-- dict:col:tournaments.coach_names_show_on_public -->
**`coach_names_show_on_public`** (boolean, NOT NULL, default `false`; mig 150) — public-site visibility toggle for team **coach names** (`teams.coach`). Default `false` = coach names are **private** on the public site (this changed existing tournaments: any event that previously showed coach names publicly hides them until an organizer opts back in). When `false`, the name is stripped to `''` at the J6-001 choke point `toPublicTeam(t, showCoachName)` ([lib/public-tournament-data.ts](../../../lib/public-tournament-data.ts)) so it never reaches any anonymous payload — Teams cards, team profile, schedule search/datalist, `/api/public/tournament-data`, `/api/public/team-profile` — not merely hidden in the UI. Governs the **public site only**: coach names stay visible in admin views and the Coaches Portal. Does **not** affect coach *emails* (already excluded from public payloads). Surfaced in Public Site → Public Pages as "Show coach names" (all plans, `manage_branding` capability); carried on clone/populate with the public-pages block. _Dev/prod:_ identical (both default `false`).

<!-- dict:col:tournaments.list_in_directory -->
**`list_in_directory`** (boolean, NOT NULL, default `false`; mig 158) — organizer **opt-in** for the public cross-platform discovery directory ([/discover](../../../app/discover/page.tsx)). Default `false` = every tournament starts **unlisted** (no backfill); only an explicit opt-in in Event Settings → Tournament Overview lists it. **ANDed with the public-status gate** at directory query time (`status IN ('active','completed')`), so a flagged-but-draft/archived tournament never surfaces — the directory introduces no second visibility model and only links to already-public pages (player PII stays behind the existing `toPublicTeam` choke point). Available on **all plans** (no tier gate). Set via the `update` action in [api/admin/tournaments/route.ts](../../../app/api/admin/tournaments/route.ts); mapped as `listInDirectory` in `mapTournament` ([lib/db.ts](../../../lib/db.ts)). Partial index `tournaments_list_in_directory_idx` (`WHERE list_in_directory = true`) supports the platform-wide directory query. _Dev/prod:_ ⚠ mig 158 **DEV-only / prod-pending**.

<!-- dict:col:tournaments.directory_province -->
**`directory_province`** (text, nullable; mig 158) — optional Canadian province/territory **code** (e.g. `'ON'`) captured when an organizer opts into the directory; powers the directory's location filter. NULL = unset. Allowed values are **app-enforced** via [lib/canadian-provinces.ts](../../../lib/canadian-provinces.ts) (`isProvinceCode`) — the `update` API whitelists to a recognized code, else writes NULL — **not** a DB CHECK constraint (matches the project's allowed-values convention). Mapped as `directoryProvince` in `mapTournament`. _Dev/prod:_ ⚠ mig 158 DEV-only / prod-pending.

<!-- dict:col:tournaments.playoffs_published_at -->
**`playoffs_published_at`** (timestamptz, nullable; mig 175) — the FIRST time a playoff bracket was materialized for this tournament. Sole purpose: the **one-time idempotency guard** for the "Playoffs are set" announcement (staff bell/push via `notify()` + anonymous fan push via `notifyFansForPlayoff`) — set by an atomic `NULL → now()` claim in the games route's `bulk-save`/`save-bracket` handlers ([api/admin/games/route.ts](../../../app/api/admin/games/route.ts)), so editing/regenerating a bracket never re-blasts. The public home **hero takeover** and the `/playoffs` **Playoff Picture** page derive purely from the presence of `is_playoff` games, **not** this column. Backfilled to `now()` for every tournament that already had playoff games (prevents a false announcement when an existing bracket is first edited post-deploy). Mapped as `playoffsPublishedAt` in `mapTournament` ([lib/db.ts](../../../lib/db.ts)). _Dev/prod:_ mig 175 **applied to DEV + PROD 2026-07-04** (schema-only, ahead of the feature-code release — prod code still doesn't read it until promote).

<!-- dict:col:tournaments.champions_crowned_at -->
**`champions_crowned_at`** (timestamptz, nullable; mig 176) — the FIRST time this tournament's playoffs became **complete** (every `is_playoff` game terminal — `completed`/`forfeit`/`cancelled` — with a decided championship final). Sole purpose: the **one-time idempotency guard** for the "Champions crowned" announcement (staff bell/push via `notify()` + anonymous fan push via `notifyFansForChampions`) — set by an atomic `NULL → now()` claim in `announceChampionsIfComplete` ([lib/champions-notify.ts](../../../lib/champions-notify.ts)), fired from the shared scoring chokepoint so a later re-score / revert-and-re-complete never re-blasts. The public home **Champions hero takeover** and the `/champions` **recap page** derive purely from live game state (`isTournamentPlayoffsComplete`), **not** this column. Backfilled to `now()` for every tournament whose playoffs were already complete at deploy (prevents a false announcement when a finished bracket is first touched post-deploy). Mapped as `championsCrownedAt` in `mapTournament` ([lib/db.ts](../../../lib/db.ts)). Mirrors `playoffs_published_at` (mig 175). _Dev/prod:_ mig 176 **applied to DEV 2026-07-05** (prod-pending).

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
**`settings`** (jsonb, NOT NULL, default `'{}'`) — schema-less per-tournament prefs; new keys need no migration (add to `TournamentSettings`, [lib/types.ts:28](../../../lib/types.ts#L28)). Merge-patched via `updateTournamentSettings` (read-merge-write). **Key catalog:** `format` (`round_robin_playoffs|playoff_only`), `rulesLayout` (`columns|single`), `resourcesLayout` (`list|grid`), `game_duration_minutes` (default 90, read in `resolveGameTiming`), `buffer_minutes` (default 15), `schedule_travel_venue_buffer_minutes`, `schedule_travel_facility_buffer_minutes`, `game_timing_scope`, `tie_breakers` (ordered breaker list; values `h2h|rd|rf|ra|coin` — **may be a subset** since organizers add/remove breakers; `coin` = Coin Toss, a **terminal** admin-resolved breaker; canonical vocab in [lib/tie-breakers.ts](../../../lib/tie-breakers.ts)), `tie_breaker_scope`, `max_run_diff_per_game` (int 1–99 or null/0/absent = no cap — caps each game's **Run Diff** contribution for standings; e.g. cap 7 → a 14-0 win counts as +7. Caps the RD column ONLY: RF/RA stay raw totals, so RF − RA may ≠ displayed RD. Divisions may override via `playoff_config.maxRunDiffPerGame`, governed by `tie_breaker_scope`), `fee_scope` (incl. `'free'`; shadows `fee_schedule_mode`), `show_fees_on_register`, `payment_instructions`, `payment_instructions_on_form`, `coach_email_confirmation`, `coach_email_acceptance`, `coach_email_rejection`, `coach_email_payment`, `coach_email_schedule`, `coach_email_game_day` (per-tournament on/off for the automatic transactional coach emails — absent/`true` = enabled; only explicit `false` disables; read via `coachEmailEnabled` [lib/email.ts], set in Event Settings → Notifications & Contact; `schedule` = the schedule-published email, `game_day` = the evening-before game-day reminder [Phase 5m/5n]), `coach_email_pause_all` (Phase 5n master kill-switch — `true` suppresses ALL automatic coach-facing emails incl. the post-event results email; default OFF/absent; **opposite polarity** to the per-type keys above [`true` DISABLES]; read via `coachEmailsPaused`/`coachEmailEnabled`), `roster_require`, `roster_require_dob`, `roster_require_jersey`, `roster_require_waiver` (bool), `roster_waiver_text` (text ≤2000; `''`/absent = the shared `DEFAULT_ROSTER_WAIVER_TEXT` in [lib/roster-requirements.ts](../../../lib/roster-requirements.ts) — the statement the coach ticks at submit), `roster_min_players`, `roster_max_players` (int 1–99 or null = no limit; **min>max IS storable** — the UI warns but auto-saves and the merge-patch API validates each key independently, so readers must treat min>max as no-minimum / max wins, never an unsatisfiable gate) — organizer roster requirements for the Coaches-Portal **event roster submission** (Phase 5f; authored in Event Settings → Roster Requirements). **Opposite polarity from `coach_email_*`:** absent/`false` = OFF — only an explicit `true`/number activates a requirement, so legacy tournaments require nothing; sub-keys apply only when `roster_require=true`. These gate the per-event `tournament_roster_players` snapshot fields ONLY — never the coach's master `basic_coach_team_players` roster (stays identity-only, DOB consent-gated). Waiver = checkbox acknowledgment at submit — the statement text lives in settings but no signed record/document is stored (V1). **Gotcha:** `playoff_game_duration_minutes` is **NOT** here anymore — removed by mig 112 in favor of per-game `games.duration_minutes`.

<!-- dict:col:tournaments.logo_url -->
<!-- dict:col:tournaments.hero_banner_url -->
<!-- dict:col:tournaments.theme_preset -->
<!-- dict:col:tournaments.theme_primary -->
<!-- dict:col:tournaments.theme_accent -->
<!-- dict:col:tournaments.theme_font -->
<!-- dict:col:tournaments.theme_card_style -->
<!-- dict:col:tournaments.color_mode -->
<!-- dict:col:tournaments.icon_bg_color -->
<!-- dict:col:tournaments.app_name -->
<!-- dict:col:tournaments.app_icon_scale -->
**Branding/theming block** (`logo_url`, `hero_banner_url`, `theme_preset`, `theme_primary`, `theme_accent`, `theme_font`, `theme_card_style`, `color_mode`, `icon_bg_color`, `app_name`) — public-page appearance overrides. `color_mode`: only `'light'` is honored; anything else → null (default dark) ([lib/db.ts:2503](../../../lib/db.ts#L2503)). **`icon_bg_color`** (text, nullable; mig 152) — organizer override for the installed home-screen (PWA) **app-icon tile background**. `'#rrggbb'` (HEX-validated app-side) forces the tile colour; **NULL = auto-detect** the colour from the logo's own edge pixels (the default). Read **only** by the apple-touch (`apple-icon.tsx`) + Android maskable (`icon-maskable`) icon routes via `resolveBrandedLogo` ([lib/pwa-icon.tsx](../../../lib/pwa-icon.tsx)) — override wins, else `detectBackgroundHex`, else `ICON_DARK`. Set in Public Site → Advanced Branding → **App Icon** (Plus-gated, `manage_branding`). A colour that contrasts with the logo reads as a deliberate border; matching = seamless. **`app_name`** (text, nullable; mig 153) — organizer's custom home-screen label for the installed PWA. Trimmed, ≤30 chars app-side; **blank/NULL = derive from the tournament name** (manifest `short_name` truncates to ~12 chars; iOS uses the name as-is) — the default. Used as the manifest `short_name` ([manifest.webmanifest/route.ts](../../../app/[orgSlug]/[tournamentSlug]/manifest.webmanifest/route.ts)) + the `apple-mobile-web-app-title` ([layout.tsx](../../../app/[orgSlug]/[tournamentSlug]/layout.tsx)); the manifest `name`, install-prompt title, and browser `<title>` still use the full tournament name. Set in Public Site → Advanced Branding → **App Icon** (Plus-gated, `manage_branding`). **`app_icon_scale`** (smallint, nullable; mig 154) — organizer's home-screen **app-icon logo SIZE (zoom)**: a relative size where **100 = the tuned default**; app-side range **70–125** (clamped at the API; the slider stores `100` as **NULL = default**). Read **only** by the apple-touch + Android maskable icon routes via `resolveBrandedLogo` ([lib/pwa-icon.tsx](../../../lib/pwa-icon.tsx)) — each applies it to its own base logo box and clamps to its own safe ceiling (iOS box `156→110–172`; Android `280→196–288`, the corner-safe maskable max, so a square logo is never clipped). Set in Public Site → Advanced Branding → **App Icon** (Plus-gated, `manage_branding`) via a Small↔Large slider with a live preview. _Dev/prod:_ all three nullable, no default.

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
5. **`schedule_visibility` is a 2-state enum, not a boolean** (`unpublished|published`) — was 3-state until mig 129 removed `published_generic` (placeholder publishing) and renamed `published_teams`→`published`.
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
**`playoff_config`** (jsonb) — `{type, crossover, hasThirdPlace, teamsQualifying?, format?, grandFinalReset?, splitConfigs?, tierConfigs?, tieBreakers?, maxRunDiffPerGame?, coinTossResults?}` for the bracket + per-division standings rules. **Two conflicting defaults:** prod column default omits `teamsQualifying`, but `saveDivision`'s write fallback adds `teamsQualifying:4` ([lib/db.ts:1185](../../../lib/db.ts#L1185)); dev has no column default. Consumers must not assume `teamsQualifying` exists. **Dev/prod drift:** Finding #25.
- **`crossover`** ∈ `standard | reseed | none | tiers`. `none` runs one bracket per **pool** (config in `splitConfigs`, keyed by pool id). **`tiers`** (added on `feat/free-tier-coaches`) splits one division's **overall** standings into N contiguous tiered brackets defined by **`tierConfigs`**: `{name, fromSeed, toSeed, format?, hasThirdPlace?, grandFinalReset?}[]` — each tier becomes an independent bracket (its own `games.bracket_id`) whose `Seed #N` placeholders are **global** (resolved from overall standings by `advancePlayoffs`). Ranges are contiguous from seed #1, names unique; the play-in (e.g. seeds 4 v 5 in a 5-seed tier) is the natural bracket bye structure, not a separate concept. Validated by `validateTierRanges` ([lib/playoff-bracket.ts](../../../lib/playoff-bracket.ts)). Value-shape change only — **no migration** (existing JSONB column).
- **`tieBreakers`** (per-division override of the tournament tie-breaker order; same `h2h|rd|rf|ra|coin` vocab + subset rules). **`maxRunDiffPerGame`** (per-division run-diff cap; `null`/absent = inherit `tournaments.settings.max_run_diff_per_game`). **`coinTossResults`** (`Record<sortedTiedTeamIdsJoinedBy'|' , orderedTeamIds[]>`) — admin-recorded coin-toss outcomes consumed when `coin` is the deciding breaker; **self-invalidating** (the key is the sorted tied set, so it stops matching if a score change alters who's tied). Written by the `record-coin-toss` action ([app/api/admin/divisions/route.ts](../../../app/api/admin/divisions/route.ts), read-merge-write). Ranking lives in pure `computeTournamentStandings` ([lib/tie-breakers.ts](../../../lib/tie-breakers.ts)). Value-shape change only — **no migration**.

<!-- dict:col:divisions.deposit_amount -->
<!-- dict:col:divisions.deposit_due_date -->
<!-- dict:col:divisions.total_fee_amount -->
<!-- dict:col:divisions.total_fee_due_date -->
**Division-level fee block** — same four fields as `tournaments`, applied **only** when the parent's `fee_schedule_mode='division'` (gotcha 6); copy ops gate them behind `includeFeeSchedule` ([lib/db.ts:346](../../../lib/db.ts#L346)). Read by `lib/registration-attention.ts:165`.

<!-- dict:col:divisions.schedule_visibility -->
**`schedule_visibility`** (text, NOT NULL, default `'unpublished'`) — 2-state (mig 129): `unpublished` (hidden / "schedule coming soon" publicly) / `published` (public schedule live with REAL team names; publishing also closes the division's registration). Coach + public visibility needs `published`. CHECK constraint name is the legacy `age_groups_schedule_visibility_check` (table renamed from `age_groups`). Before mig 129 this was 3-state (`published_teams` = renamed→`published`; `published_generic` = placeholder publishing, removed → reverted to `unpublished`). Gotcha 5.

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
**`email`** (text) — coach/contact email, **lowercased at insert** ([register/route.ts:202](../../../app/api/register/route.ts#L202)); the team-facing address for confirmation/acceptance/payment emails. **Not** the coach-identity key (gotcha 2). Stays the **portal access / claim key** (claim-by-email, mig 092) — never overwritten by coach reassignment.

<!-- dict:col:teams.coach_email -->
**`coach_email`** (text, nullable; **mig 124, dev-only**) — OPTIONAL head-coach contact email, set per-tournament from the Coaches Portal (Phase 5l, `PATCH /api/coaches/tournaments/[teamId]`). **Distinct from `email`**: coach-facing automatic emails (acceptance/rejection/payment/schedule-published/payment-reminder) resolve the recipient as **`coach_email ?? email`** (`resolveCoachRecipient`, [lib/email.ts](../../../lib/email.ts)); `email` stays the claim/access key. Null = no separate coach contact (route to `email`). Pairs with `coach` (the head-coach display **name**). _Dev-only until the Phase-5 prod deploy gate (`check:migrations`)._

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
**`status`** (text, NOT NULL, default `'scheduled'`) — `scheduled | submitted | completed | cancelled | forfeit` (`GameStatus`, [lib/types.ts](../../../lib/types.ts); app-level enum, no DB CHECK). Advancement runs on `completed` **or** `forfeit` (both terminal). A `forfeit` records a nominal win for the present team (higher score = winner, same as `completed`) but the tie-breaker engine excludes forfeits from RF/RA/RD so an invented margin can't poison playoff seeding (FP-5 / J1-091).

<!-- dict:col:games.is_playoff -->
**`is_playoff`** (bool, default false) — playoff vs round-robin; gates Winner/Loser routing. _Dev/prod drift:_ dev NOT NULL / prod nullable (gotcha 6).

<!-- dict:col:games.bracket_id -->
<!-- dict:col:games.bracket_code -->
**`bracket_id`** (uuid, **not a FK**) / **`bracket_code`** (text) — bracket-tree grouping key + round/slot code (gotchas 2–3).

<!-- dict:col:games.bracket_label -->
**`bracket_label`** (text, nullable) — display NAME of the bracket/tier this game belongs to (e.g. `'Gold'`, `'Tier 1'`). Null = an ungrouped single bracket. `bracket_id` stays the structural/advancement key (one id per tier, tiers reuse `bracket_code`s); `bracket_label` is purely the grouping/title name so a tier's name survives the `save-bracket` diff and the public + admin bracket diagrams can split + title tiers (`groupGamesByBracketId`). Set per-tier by the playoff generator and the manual editor's tier-split. Display-only; never affects advancement.

<!-- dict:col:games.round_label -->
**`round_label`** (text, nullable) — optional custom display name for the game's bracket COLUMN (e.g. `'Championship'`, `'Gold Final'`). Every game in a column carries the same label (written together by the `save-bracket` diff). Null = use the auto-derived round name (`computeBracketColumns`). Display-only; never affects advancement (gotcha 3) or grouping — only the column TITLE.

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
**Score-submission audit block** — who/when/how a score was entered, written only via the scoring service ([lib/tournament-scoring-service.ts](../../../lib/tournament-scoring-service.ts)) and cleared on revert. `score_submission_source` ∈ `scorekeeper | admin_results | system | forfeit` (`ScoreSubmissionSource`, [lib/types.ts](../../../lib/types.ts); app enum, no DB CHECK — the drifted 3-value CHECK from mig 068 was dropped in mig 133, so `forfeit` is accepted and the column is app-enum-validated only). The `forfeit` value marks a result entered as a forfeit and persists through BOTH lifecycle states — a PENDING forfeit is `status='submitted'` with `source='forfeit'`, and finalize promotes it to `status='forfeit'` (not `completed`) so it advances the bracket but stays excluded from RF/RA/RD in tie-breakers (FP-5 / J1-091). Not a generic row-mtime (gotcha 7).

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

## `tournament_roster_players`
<!-- dict:table:tournament_roster_players -->

**Purpose:** the per-tournament-event roster **snapshot** — one row per player per registered team for a specific tournament. Written by two paths (the coach event-roster submit and the admin day-of gate-roster); read by the coach submit page and the check-in board. The **master** identity roster is `basic_coach_team_players` (Coaches / basic-teams domain); this is the per-event **copy**, gated by the organizer's `tournaments.settings.roster_*` requirements. New with free-tier Phase 5f/5j — **0 rows in dev AND prod** (dev-only/undeployed).

**Gotchas (read first):**
1. **★ `source_player_id` is DEV-ONLY (mig 123) and the coach route reads + writes it UNCONDITIONALLY → it breaks on prod if the code ships ahead of mig 123.** The coach GET names it in the SELECT ([roster/route.ts:112](../../../app/api/coaches/tournaments/[teamId]/roster/route.ts#L112)) and the submit INSERT sets it ([:210](../../../app/api/coaches/tournaments/[teamId]/roster/route.ts#L210)). On prod (column absent) the **submit POST hard-500s** (`throw insError`); the GET names it too but never error-checks the query, so it only **degrades to an empty snapshot (200)** — either way the feature is broken on prod. **Procedurally fenced** by the migration deploy gate — mig 123's header requires migs 114–117 + 123 on prod before any Phase-5 prod deploy, and `npm run check:migrations` enforces it — so code + schema land together; but it's the highest-risk item here. The admin check-in path uses `select('*')` and omits the column on write, so it is prod-safe regardless.
2. **Three `source` values in the CHECK (`coach|gate|admin`) but only TWO are written** — `'admin'` is a **reserved/dead enum value** (no code path writes it anywhere). `coach` = the coach event-roster submit; `gate` = the admin day-of gate-roster.
3. **Resubmit = delete-then-reinsert, and the delete SCOPE differs by path** — the coach submit deletes only its OWN rows (`.eq('team_id').eq('source','coach')`, preserving any `gate` rows); the gate save deletes **ALL** of the team's rows (`.eq('team_id')`, replace-all) and **auto-confirms** (stamps `teams.roster_confirmed_at`). Neither is atomic. There is **no UPDATE path** — see `updated_at`.
4. **The snapshot is a one-directional COPY of the master** — `buildTournamentRosterSnapshot` ([lib/basic-coach-roster.ts:332](../../../lib/basic-coach-roster.ts#L332)) is **pure (zero DB access)**, reads `basic_coach_team_players` only as a fallback, stamps `source_player_id`, and **never writes back** to the master. `name` is always the master's (a coach can't rename in the snapshot); `position` is snapshot-only (no master column).
5. **Organizer roster requirements gate the SNAPSHOT only** — the `tournaments.settings.roster_*` keys (parsed by `parseRosterRequirements`, [lib/roster-requirements.ts:56](../../../lib/roster-requirements.ts#L56)) enforce dob/jersey/min/max/waiver against the assembled snapshot rows in the builder, never against the identity-only master. `min > max` is treated as no-minimum (never an unsatisfiable gate).
6. **RLS-enabled, zero policies, zero triggers (both envs); service-role only** — the [[reference_supabase_rls_grants]] class (prod grants `anon`+`authenticated` FULL DML; dev only `REFERENCES/TRIGGER/TRUNCATE`).
7. **Dev/prod:** `source_player_id` is the **only** column-level divergence (dev-only, mig 123); all other 13 columns, the `source` CHECK, and the three CASCADE FKs are identical.

**Fields** (boilerplate `id`, `created_at`, `updated_at` omitted — `created_at` is DB-default `now()`; **`updated_at` is DEAD**: no code ever UPDATEs a row [resubmit is delete + reinsert], so it always equals `created_at`):

<!-- dict:col:tournament_roster_players.org_id -->
**`org_id`** (uuid, NN; FK→`organizations(id)` ON DELETE CASCADE) — owning org; set from `tournament.org_id` (coach) / `ctx.org.id` (gate).

<!-- dict:col:tournament_roster_players.tournament_id -->
**`tournament_id`** (uuid, NN; FK→`tournaments(id)` ON DELETE CASCADE) — the event this snapshot belongs to.

<!-- dict:col:tournament_roster_players.team_id -->
**`team_id`** (uuid, NN; FK→`teams(id)` ON DELETE CASCADE) — the **registered team** (`teams.id`, the registration unit — note the coach route's `[teamId]` param IS this id, not a `basic_coach_team_id`); the scope key both GETs filter on and both writers delete by.

<!-- dict:col:tournament_roster_players.name -->
**`name`** (text, NN) — player display name; for coach rows **always copied from the master** (`master.name`, [basic-coach-roster.ts:392](../../../lib/basic-coach-roster.ts#L392)) — not renameable in the snapshot; gate rows set it directly.

<!-- dict:col:tournament_roster_players.jersey_number -->
**`jersey_number`** (text, nullable) — jersey #; **text** (leading zeros / non-numeric allowed); coach value = snapshot override or master fallback; orders the GET queries; gated by `roster_require_jersey`.

<!-- dict:col:tournament_roster_players.date_of_birth -->
**`date_of_birth`** (date, nullable) — minor PII; coach value = override or master fallback; gated by `roster_require_dob`. (Unlike the master, where DOB is consent-gated, the snapshot copy carries it when the organizer requires it.)

<!-- dict:col:tournament_roster_players.position -->
**`position`** (text, nullable) — playing position; **snapshot-only** (the master has no position column, so no fallback); set by the coach builder / gate insert; edited on the check-in board but not shown in its read-only list.

<!-- dict:col:tournament_roster_players.notes -->
**`notes`** (text, nullable) — free-text note; **coach-path only** — the gate save and (absent) admin path never write it, and the check-in board drops it.

<!-- dict:col:tournament_roster_players.source -->
**`source`** (text, NN, default `'coach'`; CHECK `coach|gate|admin`) — provenance of the row: `'coach'` (the coach submit) or `'gate'` (the admin gate-roster). **`'admin'` is allowed by the CHECK but never written** (dead enum value). Read by the coach UI to key prior rows + count org-added (`source !== 'coach'`) rows; mapped-but-ignored by the check-in board.

<!-- dict:col:tournament_roster_players.created_by_user_id -->
**`created_by_user_id`** (uuid, nullable, **no FK**) — who created the row (`guard.user.id` coach / `ctx.user.id` gate). **Write-only audit** — fetched by the gate's `select('*')` but consumed by no reader/UI; no FK, so it silently orphans if the user is deleted.

<!-- dict:col:tournament_roster_players.source_player_id -->
**`source_player_id`** (uuid, nullable; FK→`basic_coach_team_players(id)` ON DELETE SET NULL) — **DEV-ONLY (mig 123 — absent on prod).** The provenance back-link a coach submission stamps with the master player it copied; **null for gate rows** (no master origin) and for coach rows whose master player was later deleted (SET NULL). Read by the coach GET to pre-fill a re-submit. **The coach route reads + writes it unconditionally → prod-breaking if shipped ahead of mig 123 (gotcha 1).**

### Functions & mechanics (not tables — not coverage-checked, documented for completeness)

- **The coach submit** — `app/api/coaches/tournaments/[teamId]/roster/route.ts` (auth `requireCoachRegistrationAccess` → `guard.basicCoachTeamId`/`guard.user`): GET loads the parsed requirements + master + current snapshot; POST runs a lock ladder (rejects if the tournament is completed, the team isn't `accepted`, or `roster_confirmed_at` is set), builds rows via `buildTournamentRosterSnapshot`, **deletes its own `source='coach'` rows then reinserts**, and stamps `teams.roster_submitted_at`.
- **`buildTournamentRosterSnapshot`** ([lib/basic-coach-roster.ts:332](../../../lib/basic-coach-roster.ts#L332)) — the **pure** snapshot builder: maps selected master players → snapshot rows (name from master, jersey/notes/dob override-or-master, position snapshot-only, `source_player_id` = master id), applies the requirement gates (dob/jersey/min/max/waiver), and rejects foreign/duplicate player ids (IDOR). No DB access; never mutates the master.
- **The gate roster** — `app/api/admin/check-in/route.ts` action `save_gate_roster`: a **replace-all** for the team (deletes every source) → inserts `source='gate'` rows (no `notes`, no `source_player_id`) and stamps both `roster_submitted_at` **and** `roster_confirmed_at` (the gate auto-confirms). Read back by the check-in board (`select('*')` → `mapRoster`), which shows jersey/name/DOB only.

---

*End of Tournaments & Registration domain — **all 19 tables column-sealed** (`tournament_roster_players`, the per-event roster snapshot, sealed 2026-06-11 as the FINAL closing table of the dictionary). Its master `basic_coach_team_players` lives in the Coaches / basic-teams domain (free-tier Phase 3, mig 114); the `source_player_id` provenance back-link (free-tier Phase 5j, mig 123, **dev-only**) closes the cross-module roster seam. With this table the dictionary is **100% column-sealed across all 11 domains** — see [DATA_DICTIONARY_PLAN.md](../../projects/archive/DATA_DICTIONARY_PLAN.md) §5.*

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

<!-- dict:col:basic_coach_teams.activated_features -->
**`activated_features`** (jsonb, NOT NULL, default `'[]'`; mig 131) — coach-opt-in set of **Tier-2 team-ops capabilities** turned on for this team, driving Coaches Portal **progressive-disclosure** nav visibility. JSONB array of feature keys (`roster|schedule|fees|announcements` — app-defined, **not** DB-enforced). Empty `[]` (default) = a brand-new tournament-only coach → ops sections hidden, clean tournament-first nav. A key present → that section appears in the rail. Also backs the persisted-roster opt-in. See [COACH_NAV_REBUILD_PLAN.md](../../projects/active/COACH_NAV_REBUILD_PLAN.md).

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
5. **Snapshot source for the per-event copy.** Column shape (single `name`, `jersey_number` text, `date_of_birth` date) deliberately mirrors `tournament_roster_players` (mig 110) so the per-event submit/snapshot is a clean copy. The back-link lives on the snapshot side: `tournament_roster_players.source_player_id` (mig 123, free-tier Phase 5j) is stamped with **this** master row's id on submit. **Seam:** the copy is one-directional — a submission reads the master and writes the snapshot; it NEVER writes back here (organizer-required DOB/jersey + the snapshot-only `position` live on the event copy alone). Enforced structurally in `buildTournamentRosterSnapshot` ([lib/basic-coach-roster.ts](../../../lib/basic-coach-roster.ts)), which is pure and never calls `updateBasicCoachTeamPlayer`.
6. **Upgrade-ready.** When a Basic team upgrades, the master seeds the paid workspace roster via `basic_coach_teams.team_workspace_id` (a per-program-year shape-translation, wired in a later phase) — no rebuild required.

**Fields** (boilerplate `id`, `created_at`, `updated_at` omitted):

<!-- dict:col:basic_coach_team_players.basic_coach_team_id -->
**`basic_coach_team_id`** (FK → `basic_coach_teams.id` ON DELETE CASCADE, NOT NULL) — the team; the only structural anchor (no `org_id`).

<!-- dict:col:basic_coach_team_players.name -->
**`name`** (text, NOT NULL) — composed "First Last" **back-compat denormalization** (mig 155). The roster now collects first/last (see below); the app keeps `name` populated (composed) on every write so the `tournament_roster_players` snapshot + legacy read sites stay unchanged. Source of truth for entry + upgrade = `first_name`/`last_name`.

<!-- dict:col:basic_coach_team_players.first_name -->
<!-- dict:col:basic_coach_team_players.last_name -->
**`first_name` / `last_name`** (text, nullable; mig 155) — split player name (first required app-layer, **last optional** so mononyms work). Backfilled from the legacy single `name` (last token = surname). Maps **1:1** to `rep_roster_players.player_first_name`/`player_last_name` on upgrade — no guess, no "uncertain name" flag.

<!-- dict:col:basic_coach_team_players.guardian_first_name -->
<!-- dict:col:basic_coach_team_players.guardian_last_name -->
**`guardian_first_name` / `guardian_last_name`** (text, nullable; mig 155) — split guardian name (both optional); `guardian_name` kept composed for back-compat. Maps 1:1 to the Premium guardian first/last.

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
3. **Every fee is per-player now; `player_id` NULL = legacy/orphaned only.** A new fee is created either for "everyone" (fans out to one independent per-player row each, via the `/fees/bulk` route) or for one specific player — a single create REQUIRES a `player_id` (`lib/basic-coach-fees.ts`). The player-less "team-wide" charge was **removed**. The column stays nullable only because the FK is `ON DELETE SET NULL`: deleting a player keeps the fee as an orphaned historical charge. So NULL now means a LEGACY row (created before the removal) or an ORPHANED row (its player was deleted) — **not** a creatable team-wide fee. The UI surfaces these under "Other fees" (editable/removable, not reassignable).
4. **Same-team player validation is app-layer.** The DB FK proves `player_id` exists, but not that it belongs to the same `basic_coach_team_id`. `lib/basic-coach-fees.ts` validates the selected player against the team before create/update, and every mutation also scopes by `basic_coach_team_id`.
5. **Money convention follows the rest of the app.** Amount is `numeric(10,2)` dollars (not integer cents), matching tournament fee fields, league registration fees, accounting entries, and rep dues. Stripe cents exist only in Stripe-facing code, not manual ledgers.
6. **Ownership = `basic_coach_team_users` membership** (same as roster/schedule); no `org_id`. RLS-enabled, no policies = `supabaseAdmin` only; the API gates on `userOwnsBasicCoachTeam` via `requireBasicCoachTeamOwner`.

**Fields** (boilerplate `id`, `created_at`, `updated_at` omitted):

<!-- dict:col:basic_coach_team_fees.basic_coach_team_id -->
**`basic_coach_team_id`** (FK to `basic_coach_teams.id` ON DELETE CASCADE, NOT NULL) - the team; the only structural anchor (no `org_id`).

<!-- dict:col:basic_coach_team_fees.player_id -->
**`player_id`** (FK to `basic_coach_team_players.id` ON DELETE SET NULL, nullable) - the roster player who owes this fee; **REQUIRED on new fees** ("everyone" fans out to per-player rows; or one specific player). NULL only on legacy/orphaned rows (gotchas 3-4).

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

<!-- dict:col:team_workspaces.migration_summary -->
**`migration_summary`** (jsonb, nullable; mig 140) — the free→Premium upgrade data-migration result (Coach Premium Upgrade Phase 4): counts brought over + "check these" flags (players needing a guardian email, uncertain name splits, defaulted fee due dates, skipped $0/orphan fees, per-pass failures) + `ok`. Written once by `provisionStandaloneTeamWorkspace` (the provisioner that won the atomic `basic_coach_teams.team_workspace_id` claim) via `lib/coach-upgrade-migration.ts`. The Premium team overview reads it on first load to show a dismissible banner; dismissing stamps `acknowledgedAt` into the JSON. NULL = not an upgrade-with-migration.

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

*End of Coaches / basic-teams domain. `basic_coach_team_players` (free-tier Phase 3, mig 114) is documented above. The per-event snapshot back-link `tournament_roster_players.source_player_id` was ADDED in free-tier Phase 5j (mig 123, dev-only, FK ON DELETE SET NULL) — see the Tournaments & Registration domain note. The coach event-roster submit API is `app/api/coaches/tournaments/[teamId]/roster/route.ts` (the snapshot WRITE; the master/snapshot seam is `buildTournamentRosterSnapshot`).*

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
5. **No billing sync on create (Club Repackaging, 2026-06-22).** The per-team `$19/team beyond 3` Stripe meter and `syncRepTeamBilling` are **retired** — a Club / Club · Association subscription includes its whole coaching staff up to the plan's team cap. Create now enforces a **capacity cap** instead: it blocks the (cap+1)th non-archived team via `getNonArchivedRepTeamCount` vs the effective `teamLimit` ([app/api/admin/rep-teams/teams/route.ts](../../../app/api/admin/rep-teams/teams/route.ts)). The same cap is enforced on the ownership-transfer adoption path ([lib/team-ownership-transfer.ts](../../../lib/team-ownership-transfer.ts)).

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
5. **No billing sync on completing/archiving (Club Repackaging, 2026-06-22).** The former Club-only per-team Stripe sync is **retired** — program-year status changes no longer trigger any billing call. Club capacity is a flat per-plan team cap, not a per-team meter.

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

<!-- dict:col:rep_program_years.lineup_settings -->
**`lineup_settings`** (jsonb, nullable; mig 172) — Lineup Intelligence P3 **season-default innings caps** for the game-day auto-fill, set on the coach team Settings page. **App-enforced shape (`lib/lineup-caps.ts`, NO DB CHECK)**: `{ maxInningsPerPosition: int|null (rotation cap — max innings any one player at a single field position), pitcherMaxInningsDefault: int|null (team default arm-care ceiling), minInningsPerPlayer: int|null (min-play floor) }`. A null column or missing key = that rule is OFF. Effective cap at generation = per-game `rep_team_lineups.rules_override` ?? this default; the per-player `lineup_profile.pitcher.maxInnings` (mig 171) still applies on top (stricter wins). See docs/projects/active/COACHES_PORTAL_LINEUP_INTELLIGENCE_PLAN.md.

### `rep_roster_players`
<!-- dict:table:rep_roster_players -->

**Purpose:** the **rep-team season roster** — one row per player per program year. The rep equivalent of `basic_coach_team_players` (free Basic master roster) and a sibling of `tournament_roster_players`, but a richer shape: split first/last name, dedicated guardian fields, and positions.

**Gotchas (read first):**
1. **Never hard-deleted via the app.** `deleteRepRosterPlayer` ([lib/db.ts:4471](../../../lib/db.ts#L4471)) has **no caller**; removal is modeled as `status='inactive'`. Rows die only by FK CASCADE (program-year/team/org delete).
2. **No `source_player_id` snapshot link** — the only inbound provenance is `tryout_registration_id`. The cross-module Phase-5 back-link (re: `tournament_roster_players`/`basic_coach_team_players`) is genuinely **absent here** — don't invent it.
3. **`notes` vs `admin_notes` are BOTH coach-readable AND coach-writable.** `admin_notes` means "staff-side, not shown to families" (UI label "Admin Notes (private)") — a family-visibility *intent*, **not** a role boundary. (It's kept out of the intended roster-export column set, though the rep roster export itself is a not-yet-implemented catalog stub.)
4. **DOB is NOT consent-gated here** (contrast `basic_coach_team_players`, whose editor requires a guardian-consent checkbox) — the rep pages use a plain date input; DOB is flagged `sensitive` only to drive opt-in export redaction.
5. **Tryout→roster conversion carries identity + optional accept-time roster/dues.** `acceptTryoutAndAddToRoster` copies identity + DOB + guardian, sets `source='tryout'` + `tryout_registration_id`, and (Phase 2B.4) can also set `player_number`/`primary_position`/`jersey_size` supplied in the accept drawer. It still does **not** carry over the tryout's `player_notes` or admin notes. The write is now **atomic** via the `accept_tryout_and_create_dues` RPC (mig 169) — see the `rep_tryout_registrations` gotcha #4.

**Fields** (boilerplate `id`, `created_at`, `updated_at` omitted):

<!-- dict:col:rep_roster_players.program_year_id -->
**`program_year_id`** (FK → `rep_program_years.id`, NOT NULL) — season anchor + primary query key (indexed `year_idx`).

<!-- dict:col:rep_roster_players.team_id -->
<!-- dict:col:rep_roster_players.org_id -->
**`team_id`** (FK → `rep_teams.id`) / **`org_id`** (FK → `organizations.id`) — denormalized team + tenant scope.

<!-- dict:col:rep_roster_players.player_first_name -->
<!-- dict:col:rep_roster_players.player_last_name -->
**`player_first_name` (NOT NULL) / `player_last_name` (nullable as of mig 155)** — first required, **last optional** (matches the free side 1:1; mononyms carry over with a NULL last name). List ordered by `display_order` then last name (mig 142).

<!-- dict:col:rep_roster_players.player_date_of_birth -->
**`player_date_of_birth`** (date, nullable) — optional; **not** consent-gated (gotcha 4).

<!-- dict:col:rep_roster_players.player_number -->
**`player_number`** (text, nullable) — jersey #, free text.

<!-- dict:col:rep_roster_players.primary_position -->
<!-- dict:col:rep_roster_players.secondary_position -->
**`primary_position` / `secondary_position`** (text, nullable; mig 070) — **free text, no CHECK** (any string accepted). Not populated by tryout conversion. **Remain authoritative for the top-two "Best" positions** even after `lineup_profile` (mig 171) — the profile only carries ranks 3+, "Okay", "Never", pitcher & A-squad data. Readers reconstruct the full preferred list as `[primary_position, secondary_position, ...lineup_profile.morePreferred]`.

<!-- dict:col:rep_roster_players.lineup_profile -->
**`lineup_profile`** (jsonb, nullable; mig 171) — Lineup Intelligence player profile that enriches lineup auto-fill beyond primary/secondary. **Additive**; NULL on legacy rows and on rows created by non-picker paths (quick-add, tryout-accept, season rollover) — the generator/readers fall back to `primary_position`/`secondary_position` alone when it's NULL. Shape (**app-enforced in `lib/lineup-profile.ts`, NO DB CHECK** so the vocabulary can evolve): `{ morePreferred: string[] (Best ranks 3+), canPlay: string[] (Okay), never: string[] (hard exclusions the auto-fill never assigns), pitcher: { rank: number, maxInnings: number|null } | null (P2; null = not a pitcher), aSquad: boolean (P4; gold-medal starter) }`. Positions validated against the team's Sport Pack (`lib/sports.ts`) at write time. See docs/projects/active/COACHES_PORTAL_LINEUP_INTELLIGENCE_PLAN.md.

<!-- dict:col:rep_roster_players.guardian_first_name -->
<!-- dict:col:rep_roster_players.guardian_last_name -->
<!-- dict:col:rep_roster_players.guardian_email -->
<!-- dict:col:rep_roster_players.guardian_phone -->
**`guardian_first_name` / `guardian_last_name` / `guardian_email` / `guardian_phone`** — guardian contact; **all nullable as of mig 139** (Coach Premium Upgrade Phase 3c — so a free team's roster carries over on upgrade without fabricating guardian data). The manual roster-add route still requires first/last/email app-side, so in practice only **migrated rows** (or edits that clear the field) are null. `guardian_email` indexed (`email_idx`, non-unique). TS types are already `string | null` and every reader is null-safe (dues reminders skip null emails; displays/exports coalesce). `guardian_phone` nullable.

<!-- dict:col:rep_roster_players.status -->
**`status`** (text, NOT NULL, default `'active'`; CHECK `active|inactive`) — `inactive` is the de-facto delete (gotcha 1).

<!-- dict:col:rep_roster_players.source -->
**`source`** (text, NOT NULL, default `'admin_manual'`; CHECK `tryout|admin_manual`) — `'tryout'` set only by the conversion path.

<!-- dict:col:rep_roster_players.tryout_registration_id -->
**`tryout_registration_id`** (FK → `rep_tryout_registrations.id` ON DELETE SET NULL, nullable) — the only back-link to the originating tryout (set during conversion).

<!-- dict:col:rep_roster_players.notes -->
<!-- dict:col:rep_roster_players.admin_notes -->
**`notes`** (general/coach-visible) / **`admin_notes`** (staff-internal, intended family-hidden) — both coach-writable (gotcha 3).

<!-- dict:col:rep_roster_players.display_order -->
**`display_order`** (int, NOT NULL, default 0; mig 142) — manual roster order for drag-to-reorder (Coach Premium Phase 3d; parity with `basic_coach_team_players.display_order`). List sorts `display_order ASC, player_last_name ASC`; existing rows are all `0` (so they keep name-sorting) until a coach reorders, which writes an explicit `0..n` to every shown row (scoped per program year). `createRepRosterPlayer` appends new players at `max(display_order)+1`; the free→Premium upgrade migration and the season rollover create players in source order, which the append preserves.

<!-- dict:col:rep_roster_players.source_basic_player_id -->
**`source_basic_player_id`** (uuid, nullable; mig 143) — provenance tag: the `basic_coach_team_players.id` this row was copied from during a free→Premium upgrade (Phase 4). Written ONLY by the upgrade migration/retry path; coach-created rows leave it NULL. Backs **idempotent retry** of a partial upgrade — a partial-unique index `(program_year_id, source_basic_player_id) WHERE source_basic_player_id IS NOT NULL` guarantees a given Basic player can only be copied once (a re-run / concurrent retry skips it). Not a FK (loose tag; the Basic row may be edited/removed independently).

<!-- dict:col:rep_roster_players.medical_notes -->
**`medical_notes`** (text, nullable; mig 157) — Wave B safety field: allergies / medical conditions / medication, coach-staff-visible. Presence drives a "Medical info" flag on the player profile. Free text.

<!-- dict:col:rep_roster_players.emergency_contact_name -->
<!-- dict:col:rep_roster_players.emergency_contact_phone -->
**`emergency_contact_name`** / **`emergency_contact_phone`** (text, nullable; mig 157) — Wave B emergency contact for game-day. Free text; phone is tap-to-call in the UI. Distinct from the guardian contact.

<!-- dict:col:rep_roster_players.bats -->
<!-- dict:col:rep_roster_players.throws -->
**`bats`** / **`throws`** (text, nullable; mig 157) — handedness. App-enforced values (`lib/rep-roster-options.ts`): `bats` ∈ {L,R,S (switch)}, `throws` ∈ {L,R}. No DB CHECK (kept flexible); validated/normalized in the roster API.

<!-- dict:col:rep_roster_players.jersey_size -->
**`jersey_size`** (text, nullable; mig 157) — uniform size. App-enforced fixed list (`lib/rep-roster-options.ts`): YS, YM, YL, AS, AM, AL, AXL. No DB CHECK; validated/normalized in the roster API.

### `rep_team_coaches`
<!-- dict:table:rep_team_coaches -->

**Purpose:** the **coach-assignment join** — maps an `auth.users` account to a `(team, program_year)` with a role, per season. Membership here is the **single gate** into the coach-operator portal for a team.

**Gotchas (read first):**
1. **This is the coach-portal access gate.** `getCoachingAssignmentsForUser(orgId, userId)` ([lib/db.ts:4160](../../../lib/db.ts#L4160)) is the membership check inside `resolveCoachContext` for every coach route; no row → no access.
2. **Assignments are filtered to `draft`/`active` seasons** ([lib/db.ts:4175](../../../lib/db.ts#L4175)) — a coach assigned only to a `completed`/`archived` year is effectively locked out via this helper even though the row persists.
3. **Team-workspace plans add an entitlement filter.** For a `team_workspace`/`plan_id='team'` org, assignments are further intersected with `getActiveTeamEntitledRepTeamIds` ([lib/db.ts:4180](../../../lib/db.ts#L4180)) — an active billing entitlement is required on top of the assignment row.
4. **Insert/delete only for role — NO `updated_at`.** Changing a coach's role = delete + re-add (`addRepTeamCoach`/`removeRepTeamCoach` [lib/db.ts:4034](../../../lib/db.ts#L4034)). Team-workspace provisioning seeds the owner as `head_coach`. (Assistant Coaches Phase 2 adds a `capabilities` UPDATE path — the head coach edits an assistant's grants in place.)
5. **`coach_role` + `capabilities` are the ENFORCEMENT anchor (was "display-only" pre-mig-170).** A head coach gets full access; an `assistant_coach` is resolved to a least-privilege capability set (refined by `capabilities`) in `getCoachingAssignmentsForUser` and enforced app-layer in every coach route (money off/read/write, roster-PII lock, notes, documents view/manage, announcements send, tryouts head-only, roster-write head-only). The two pre-existing standalone-workspace head-coach gates (season-start, division-edit) are unchanged.
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
**`coach_role`** (text, NOT NULL, default `'head_coach'`; CHECK `head_coach|assistant_coach`) — the staff role and enforcement anchor (gotcha 5): head = full access; assistant = least-privilege capabilities refined by `capabilities`.

<!-- dict:col:rep_team_coaches.capabilities -->
**`capabilities`** (jsonb, nullable; mig 173) — per-assistant capability grants (`AssistantCapabilityGrants`, `lib/coach-capabilities.ts`). NULL = assistant least-privilege defaults; **ignored for head coaches**. App-shaped, no DB CHECK (loose-jsonb pattern). Set by the head coach via the coach-portal staff panel; read into the effective `CoachCapabilities` on every `CoachingAssignment`.

### `assistant_invite_tokens`
<!-- dict:table:assistant_invite_tokens -->

**Purpose:** the head-coach "invite an assistant" flow (Assistant Coaches Phase 2, mig 174). A team-scoped, single-use invite. The **raw token lives only in the emailed URL**; the row stores its **SHA-256** hash (same posture as `rep_tryout_registrations.offer_token_hash`). On accept, the invitee gets a minimal `coach`-role `organization_members` row + a `rep_team_coaches` `assistant_coach` row.

**Gotchas (read first):**
1. **Service-role only** — RLS enabled, **zero policies** (the [[reference_supabase_rls_grants]] class). All access via `supabaseAdmin` in `lib/assistant-invites.ts`.
2. **`status` lifecycle:** `pending_approval` (org requires admin approval before the email goes out) → `pending` (emailed, awaiting accept) → `accepted` (terminal); or `expired`/`revoked`. The accept path requires `status='pending'` + not past `expires_at` + single-use.
3. **Accept SKIPS the one-org guard** — an assistant is a guest; `userBelongsToOtherRealOrg` is deliberately NOT called, so cross-club assistants work.
4. **`token_hash` UNIQUE**; indexed also by `(team_id, status)` and `(lower(invited_email), status)`.
5. **`initial_capabilities`** (jsonb, nullable) — optional duty grants chosen at invite time; null = least-privilege defaults, seeded into `rep_team_coaches.capabilities` on accept.

**Fields:** `org_id`/`team_id`/`program_year_id` (FKs, CASCADE), `invited_by_user_id`, `invited_email`, `token_hash`, `status`, `initial_capabilities` (jsonb), `invited_by_name`/`team_name` (denormalized for the email/accept page), `expires_at` (default now()+7d), `accepted_at`, `created_at`.

### `rep_team_events`
<!-- dict:table:rep_team_events -->

**Purpose:** the unified per-team, per-season calendar — practices, games (`league_game`/`tournament_game`/`scrimmage`), multi-day `external_tournament`s, and generic `team_event`s.

**Gotchas (read first):**
1. **TWO self-FKs, opposite meaning AND cascade:** `parent_event_id` (ON DELETE **CASCADE**) links a `tournament_game` child to its `external_tournament` parent (deleting the parent cascade-deletes child game slots); `recurrence_parent_id` (ON DELETE **SET NULL**) links generated recurring-series instances (practice / league_game / team_event) to their series anchor. Easy to confuse.
2. **✓ FIXED 2026-06-29 — recurring series anchor is now correct.** The recurring POST gives the **first occurrence an explicit `id` = anchor**, inserts it FIRST, then inserts the later occurrences with `recurrence_parent_id = anchor` (anchor-before-children, so the self-FK is always satisfied — never relies on intra-statement FK timing). So an occurrence is now resolved as `{id = anchor} ∪ {recurrence_parent_id = anchor}`. **Edit-this/future/all** is wired via `updateRepTeamEventSeries` ([lib/db.ts](../../../lib/db.ts)) — non-temporal fields apply directly; a new start/end clock time is applied per occurrence preserving each date; the anchor is covered via the `id.eq` branch. **Delete-"this & future"** now also removes the clicked occurrence unconditionally, so deleting from the first occurrence removes it too. ⚠ Series created BEFORE this fix keep the old broken anchor (children → a non-row UUID, first occurrence `recurrence_parent_id` NULL) — series ops on those won't reach the first occurrence; only affects pre-2026-06-29 rows. (Recurrence was practice-only before this; league games & team events can now recur, scrimmages/tournament games stay one-off.)
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
**`location`** (text, nullable) — the place **NAME** (e.g. "Sherwood Park"); shown on the schedule + the coach's "recent locations" chips. One of two columns eligible for a "this & future" bulk edit (with `ends_at`). Free text, no venue FK (the org venue library is admin/league-club only and not exposed to the coaches portal). Split from `location_address` so the chips show a friendly name while the map link uses the real address.

<!-- dict:col:rep_team_events.location_address -->
**`location_address`** (text, nullable; mig 161) — optional **street address** for the location, used only to build the Google Maps link (the maps query prefers the address, falling back to the `location` name). Mirrors the tournament `diamonds.name`/`diamonds.address` split. The recent-location chips remember + refill it alongside the name. Folded into the ICS `LOCATION` so a synced calendar's map resolves.

<!-- dict:col:rep_team_events.arrival_time -->
**`arrival_time`** (text, nullable; mig 160) — game-day detail: a "be there by" clock time as `HH:mm` (24h), same day as `starts_at`. No CHECK; shape is UI-enforced. Shown on the event detail + folded into the ICS export description. Tier-2 game-day field.

<!-- dict:col:rep_team_events.field_number -->
**`field_number`** (text, nullable; mig 160) — game-day detail: the diamond/field label *within* the `location` (e.g. "Diamond 2"). Free text, no FK (mirrors `location`'s no-FK stance). Appended to the location label in the detail + the ICS `LOCATION`. Tier-2 game-day field.

<!-- dict:col:rep_team_events.uniform -->
**`uniform`** (text, nullable; mig 160) — game-day detail: uniform/jersey note (e.g. "Home whites"). **Game-types only** (UI-gated, cleared when the event type changes away from a game). Tier-2 game-day field.

<!-- dict:col:rep_team_events.resources -->
**`resources`** (jsonb, nullable; mig 162) — Phase 4 per-event resource links: an array of typed entries `{ type: 'link', label, url }`. V1 = labelled web links only (drill video / rules / field map / flyer); the `type` field reserves room for `'file'` later (V2, reusing Documents storage) with no schema change. **App-validated/capped, NOT by DB constraints** ([lib/rep-event-resources.ts](../../../lib/rep-event-resources.ts)): each entry needs a non-empty label + an http(s) URL; max 10 per event; empty/invalid rows dropped server-side (`sanitizeResources`). Stored NULL when empty. Coach/assistant-facing in V1 (no parent/player login yet). Read for free via the event row; threaded through create/single-update/series-update.

<!-- dict:col:rep_team_events.opponent -->
**`opponent`** (text, nullable) — **game-types only** (UI-gated).

<!-- dict:col:rep_team_events.home_away -->
**`home_away`** (text, nullable; CHECK `home|away|neutral`) — game context only.

<!-- dict:col:rep_team_events.team_score -->
<!-- dict:col:rep_team_events.opponent_score -->
<!-- dict:col:rep_team_events.home_score -->
<!-- dict:col:rep_team_events.away_score -->
**`team_score` / `opponent_score`** (int, nullable; mig 158 — RENAMED from `home_score`/`away_score`) — **team-relative**: the coach's team's score vs the opponent's, NOT literal home/away (a single-team product — "home_score = us" was the implicit assumption, now explicit). `result` derives from these (`team_score > opponent_score → win`); the independent `home_away` tag is what enables home/away record splits. Written via PATCH only. (Tournament `games` + `league_games` keep true `home_score`/`away_score` — multi-team contexts where home/away is real.) **⚠ mig 158 is DEV-ONLY / PROD-PENDING** — prod still carries the old `home_score`/`away_score` names (anchors kept above until prod is migrated at release; remove them then).

<!-- dict:col:rep_team_events.result -->
**`result`** (text, nullable; CHECK `win|loss|tie`) — derived from `team_score`/`opponent_score` on score save (manual override allowed); see gotcha 3.

<!-- dict:col:rep_team_events.parent_event_id -->
**`parent_event_id`** (FK → self, ON DELETE CASCADE, nullable) — `tournament_game` → its `external_tournament` parent (gotcha 1); indexed.

<!-- dict:col:rep_team_events.is_recurring -->
**`is_recurring`** (bool, NOT NULL, default false) — true on every row of a recurring series.

<!-- dict:col:rep_team_events.recurrence_rule -->
**`recurrence_rule`** (jsonb, nullable) — recurring practices only; stored as a record, not re-evaluated. **Key catalog** (untyped TS `Record<string,unknown>`, [lib/types.ts:922](../../../lib/types.ts#L922); shape from the builder [schedule/page.tsx:410](../../../app/%5BorgSlug%5D/coaches/teams/%5BteamId%5D/schedule/page.tsx#L410) + validation in [events/route.ts:116](../../../app/api/coaches/%5BorgSlug%5D/teams/%5BteamId%5D/events/route.ts#L116)): `dayOfWeek` (int 0–6, Sun..Sat) · `startDate` / `endDate` (`YYYY-MM-DD`) · `startTime` (`HH:MM`) · `endTime` (`HH:MM`|null). Required: `dayOfWeek`, `startDate`, `endDate`, `startTime` (else 400).

<!-- dict:col:rep_team_events.recurrence_parent_id -->
**`recurrence_parent_id`** (FK → self, ON DELETE SET NULL, nullable) — series-grouping pointer (gotchas 1–2).

<!-- dict:col:rep_team_events.status -->
**`status`** (text, NOT NULL, default `'scheduled'`; CHECK `scheduled|cancelled`) — event lifecycle state (mig 135). Mirrors the Basic cousin `basic_coach_team_events.status` so a cancelled free event carries over on upgrade and Premium is never less capable than Free. `'cancelled'` keeps the event on the schedule (dimmed + badged), not deleted; the coach can restore it. Written via the events PATCH.

<!-- dict:col:rep_team_events.source_basic_event_id -->
**`source_basic_event_id`** (uuid, nullable; mig 143) — provenance tag: the `basic_coach_team_events.id` this event was copied from during a free→Premium upgrade (Phase 4). Written ONLY by the upgrade migration/retry path; coach-created events leave it NULL. Backs **idempotent retry** of a partial upgrade — a partial-unique index `(program_year_id, source_basic_event_id) WHERE source_basic_event_id IS NOT NULL` guarantees a given Basic event is copied at most once. Not a FK (loose tag).

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

<!-- dict:col:rep_team_lineups.rules_override -->
**`rules_override`** (jsonb, nullable; mig 172) — Lineup Intelligence P3 **per-game override** of the season-default innings caps (`rep_program_years.lineup_settings`), for a game that plays by different rules (e.g. a tournament). Set in the Auto-fill popover's "Game rules" group and persisted so it sticks to that game. **App-enforced shape (`lib/lineup-caps.ts`, NO DB CHECK)**: `{ maxInningsPerPosition, pitcherMaxInnings, minInningsPerPlayer }` — any subset; a missing/null key falls back to the season default. Null column = use season defaults for everything.

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

### `rep_team_lineup_templates`
<!-- dict:table:rep_team_lineup_templates -->

**Purpose:** a coach's reusable, **named** "base start" lineup (e.g. "Gold medal game") that can be loaded onto any future game as an editable starting point. Distinct from `rep_team_lineups` (which is 1:1 per event, full-replace-on-save); a template is **not** event-bound. Added by migration 159 (Coach Lineup Builder Phase 4; `/dba` Finding #29 — new dedicated table, single-table `entries jsonb` option). **⚠ DEV-ONLY / PROD-PENDING at author time** (mig 159 not yet applied to prod).

**Gotchas (read first):**
1. **Convenience snapshot, NOT an analytics surface** — `entries` is a denormalized jsonb array (option 2 of Finding #29). Do not query across templates for stats; the live `rep_team_lineups`/`_entries` remain the relational source.
2. **Program-year-scoped (V1).** `entries` key on `player_id`; season rollover mints **new** player_ids, so a template does not transparently carry across seasons. The loader maps to the **current active roster** and **silently skips** players no longer rostered (reports how many were skipped).
3. **Loading fills the editable grid (unsaved)** — never a silent save; the coach still saves the event lineup explicitly. Saving an event lineup never writes here, and vice-versa.
4. **One name per team-season, case-insensitive** — an **expression-based** unique **index** `rep_team_lineup_templates_name_uniq (team_id, program_year_id, lower(btrim(name)))` (not a partial index); a duplicate name → 409 (app-friendly message). App also caps templates at **50 per team-season** (enforced in-process at the create route, not a DB constraint — a benign TOCTOU could allow 51).
5. **Coach-managed via service role** (`supabaseAdmin`) behind the coach-team auth guard; RLS write policies (mig 159, mirroring mig 071: coaches on assigned teams + org admins, `WITH CHECK`) are a defense-in-depth backstop.

**Fields** (boilerplate `id`, `created_at`, `updated_at` omitted):

<!-- dict:col:rep_team_lineup_templates.org_id -->
<!-- dict:col:rep_team_lineup_templates.team_id -->
<!-- dict:col:rep_team_lineup_templates.program_year_id -->
**`org_id` / `team_id` / `program_year_id`** (all FK, NOT NULL, CASCADE) — scope; sourced from the URL/context + active program year, **not** the request body. Indexed: `_team_idx (team_id, program_year_id)` for the list query, `_org_idx (org_id)` for RLS.

<!-- dict:col:rep_team_lineup_templates.name -->
**`name`** (text, NOT NULL; CHECK `1 ≤ char_length(btrim(name)) ≤ 80`) — the coach-chosen label; unique per team-season case-insensitively (gotcha 4).

<!-- dict:col:rep_team_lineup_templates.lineup_mode -->
**`lineup_mode`** (text, NOT NULL, default `'everyone_bats'`; CHECK `nine_player|everyone_bats`) — captured so a loaded template restores the mode.

<!-- dict:col:rep_team_lineup_templates.inning_count -->
**`inning_count`** (int, NOT NULL, default 7; CHECK `1 ≤ n ≤ 12`) — the grid width the template was built at; restored on load.

<!-- dict:col:rep_team_lineup_templates.entries -->
**`entries`** (jsonb, NOT NULL, default `'[]'`) — array of `{ playerId, battingOrder: int|null, starter: bool, inningPositions: Record<string,string> }`, mirroring an event lineup's per-player shape but keyed by `player_id` for roster remapping on load (gotcha 2). Position value domain matches `rep_team_lineup_entries.inning_positions`.

<!-- dict:col:rep_team_lineup_templates.created_by -->
**`created_by`** (FK → `auth.users.id` ON DELETE SET NULL, nullable) — the coach who saved the template.

### `rep_team_tags`
<!-- dict:table:rep_team_tags -->

**Purpose:** a coach's own per-team vocabulary stuck onto games (`kind='game'`) so Season Review/Insights can answer "how do we do against the top teams?" later — e.g. "Rivalry", "Top in the province" — and onto expenses (`kind='expense'`, Phase 3) for money-report slicing. Added by migration 181 (Phase 1 game tags); `kind='expense'` went live in migration 184 (Phase 3 money tags). **⚠ DEV-ONLY / PROD-PENDING at author time.**

**Gotchas (read first):**
1. **Per-team library, NOT per-season** — unlike `rep_team_lineup_templates`, there is no `program_year_id`; a tag persists across seasons so a coach's vocabulary doesn't reset at rollover. Reports aggregate by season through the tagged event's own `program_year_id`, not the tag row.
2. **`team_id` is NULLABLE — NULL = org-authored SHARED tag** (widened in mig 184 for the org shared library, Phase 3). A shared tag (team_id NULL, org_id set) surfaces in **every** team's picker in that org, alongside each team's own private tags; `getRepTeamTagLibrary(team, kind, org)` returns `team_id = team OR (team_id IS NULL AND org_id = org)`. Shared tags are authored/managed only from the admin Shared Library screen (owner/admin); a coach's team_id-scoped rename/delete is a no-op on them.
3. **Two uniqueness indexes, both case-insensitive** — `rep_team_tags_name_uniq (team_id, kind, lower(btrim(name)))` for team tags (NULLs are distinct, so it does NOT constrain shared rows) + partial `rep_team_tags_org_name_uniq (org_id, kind, lower(btrim(name))) WHERE team_id IS NULL` for shared tags. A duplicate → 409. App caps tags at **50 per team+kind** (team-only count) and **50 per org+kind** shared (in-process, benign TOCTOU).
4. **Merging is the only delete path history should take** — `merge_rep_team_tags(winner, loser)` (a `SECURITY DEFINER` function, mig 181; extended in mig 184 to re-point **both** `rep_team_event_tags` AND `rep_team_expense_tags`, and to treat two shared tags' NULL team_ids as same-scope via `IS DISTINCT FROM`) atomically re-points every link from the loser to the winner then deletes the loser. A plain `DELETE` does NOT re-point — the FK cascades just drop the links.
5. **Coach-managed (team tags) + admin-managed (shared tags), via service role** (`supabaseAdmin`). Game-tag routes gate on `capabilities.schedule`; money-tag routes gate on `capabilities.money` (view/write) — the one deliberate capability difference. Shared tags gate on owner/admin + `module_rep_teams`. RLS write policies (coaches on assigned teams + org admins, `WITH CHECK`) are a defense-in-depth backstop; the org-admin policies already cover the team_id-NULL rows.

**Fields** (boilerplate `id`, `created_at`, `updated_at` omitted):

<!-- dict:col:rep_team_tags.org_id -->
<!-- dict:col:rep_team_tags.team_id -->
**`org_id`** (FK, NOT NULL, CASCADE) / **`team_id`** (FK, **NULLABLE**, CASCADE — NULL = org-shared, gotcha 2) — scope; sourced from the URL/context, not the request body. Indexed: `_team_idx (team_id, kind)` for the list query, `_org_idx (org_id)` for RLS, `_org_shared_idx (org_id, kind) WHERE team_id IS NULL` for the shared-library list.

<!-- dict:col:rep_team_tags.kind -->
**`kind`** (text, NOT NULL; CHECK `game|expense`) — `'game'` tags apply to `rep_team_events` (schedule); `'expense'` tags apply to `rep_team_expenses` (money) via `rep_team_expense_tags` (both live as of mig 184).

<!-- dict:col:rep_team_tags.name -->
**`name`** (text, NOT NULL; CHECK `1 ≤ char_length(btrim(name)) ≤ 40`) — the coach-chosen label; unique per team+kind (and per org+kind for shared) case-insensitively (gotcha 3).

<!-- dict:col:rep_team_tags.created_by -->
**`created_by`** (FK → `auth.users.id` ON DELETE SET NULL, nullable) — the coach who created the tag.

### `rep_team_event_tags`
<!-- dict:table:rep_team_event_tags -->

**Purpose:** many-to-many join between `rep_team_tags` and `rep_team_events` — which tags are applied to a given game. Added by migration 181 alongside `rep_team_tags`. **⚠ DEV-ONLY / PROD-PENDING at author time.**

**Gotchas (read first):**
1. **No `id`, `org_id`, or `team_id` column** — the primary key is the pair `(event_id, tag_id)` itself, and RLS reaches tenancy through `tag_id` via an `EXISTS` subquery against `rep_team_tags` (mirrors migration 071's `rep_team_lineup_entries` pattern) rather than duplicating scope columns on the join row.
2. **Set/replace-on-save, not incremental add/remove** — the app layer writes an event's full tag set in one call (delete-then-insert), the same convenience convention as `rep_team_lineups`' entries.
3. **Both FKs CASCADE** — deleting the event or the tag silently drops the link row; deleting a *tag* this way (rather than merging it into another tag, gotcha 3 on `rep_team_tags`) loses that tag's game history with no re-pointing.

**Fields** (boilerplate `created_at` omitted; no `id`/`updated_at` — see gotcha 1):

<!-- dict:col:rep_team_event_tags.event_id -->
<!-- dict:col:rep_team_event_tags.tag_id -->
**`event_id` / `tag_id`** (FK, NOT NULL, CASCADE, composite PK) — the game and the tag applied to it. `tag_id` is indexed (`_tag_idx`) for the Season Review "vs tag" aggregation (all events for one tag); `event_id` is covered by the PK for the events-GET tag lookup (all tags for one event).

### `rep_team_expense_tags`
<!-- dict:table:rep_team_expense_tags -->

**Purpose:** many-to-many join between `rep_team_tags` (`kind='expense'`) and `rep_team_expenses` — which money tags are applied to a given expense/payable. Added by migration 184 (Coach Tags & Player Awards Phase 3). The event-tags join couldn't be reused because it FKs specifically to `rep_team_events`. **⚠ DEV-ONLY / PROD-PENDING at author time.**

**Gotchas (read first):**
1. **RLS reaches tenancy through the EXPENSE, not the tag** (deliberately different from `rep_team_event_tags`, which reaches through the tag). A money tag may be org-SHARED (`rep_team_tags.team_id` NULL), so scoping the link through the tag would drop it out of a coach's own reach — the expense's `team_id`/`org_id` are the true owners of the link. Policies `EXISTS` against `rep_team_expenses`.
2. **Set/replace-on-save** — the app writes an expense's full tag set in one call (delete-then-insert), same as `rep_team_event_tags`.
3. **Both FKs CASCADE**; the composite PK is `(expense_id, tag_id)`. Merging a tag re-points these links via `merge_rep_team_tags` (mig 184); a plain tag `DELETE` drops them.

**Fields** (boilerplate `created_at` omitted; no `id`/`updated_at` — like `rep_team_event_tags`):

<!-- dict:col:rep_team_expense_tags.expense_id -->
<!-- dict:col:rep_team_expense_tags.tag_id -->
**`expense_id` / `tag_id`** (FK, NOT NULL, CASCADE, composite PK) — the expense and the money tag applied to it. `tag_id` is indexed (`_tag_idx`) for the "spend by tag" aggregation (Budget vs. Actual filter); `expense_id` is covered by the PK for the expenses-GET tag lookup.

### `rep_team_award_types`
<!-- dict:table:rep_team_award_types -->

**Purpose:** a coach's own per-team award library (MVP, Best Hitter, Hustle Award to start — seeded on first read, fully editable) that `rep_player_awards` records point at. Added by migration 182 (Coach Tags & Player Awards Phase 2). **⚠ DEV-ONLY / PROD-PENDING at author time.**

**Gotchas (read first):**
1. **Never hard-deleted.** No DELETE route/policy exists — "retire" is a plain `is_active=false` UPDATE. Every past `rep_player_awards` row keeps resolving the type's current `name`/`emoji` at render time (same as a rename does), so retiring or renaming never rewrites history, it just drops the type from the picker for new awards. "Restore" is the inverse UPDATE.
2. **No merge tool, unlike `rep_team_tags`.** A coach picks from a short curated list rather than free-typing per game, so name drift isn't the same risk — rename + retire is the full curation surface (owner-confirmed, not re-litigated).
3. **One ACTIVE name per team, case-insensitive** — the unique index is partial (`WHERE is_active`), so a retired name can be reused by a new type later; a duplicate active name → 409. Shared types (team_id NULL) get their own partial unique `rep_team_award_types_org_name_uniq (org_id, lower(btrim(name))) WHERE is_active AND team_id IS NULL` (mig 184).
4. **`team_id` is NULLABLE — NULL = org-authored SHARED award type** (widened in mig 184, Phase 3). A shared type surfaces in every team's give-award picker alongside the team's own; `getRepTeamAwardTypeLibrary(team, org)` returns team types + org-shared active types. Shared types are managed only from the admin Shared Library screen; `rep_player_awards` from any team may reference one.
5. **Seeded on first touch, not migration-time.** `ensureRepTeamAwardTypesSeeded` ([lib/db.ts](../../../lib/db.ts)) inserts MVP 🏆 / Best Hitter 💪 / Hustle Award 🔥 the first time a **team's** award-types GET finds zero rows (team seeding only — shared types are authored by the admin, never seeded). A migration can't backfill future teams, so the GET route seeds lazily instead.
6. **Coach-managed (team types) + admin-managed (shared types), via service role** (`supabaseAdmin`). Coach gate: `canManageAwards` (`capabilities.schedule || capabilities.roster !== 'off'`); shared-type gate: owner/admin + `module_rep_teams`. RLS write policies (coaches on assigned teams + org admins, `WITH CHECK`) are a defense-in-depth backstop; the org-admin policies already cover the team_id-NULL rows.

**Fields** (boilerplate `id`, `created_at`, `updated_at` omitted):

<!-- dict:col:rep_team_award_types.org_id -->
<!-- dict:col:rep_team_award_types.team_id -->
**`org_id`** (FK, NOT NULL, CASCADE) / **`team_id`** (FK, **NULLABLE**, CASCADE — NULL = org-shared, gotcha 4) — scope; sourced from the URL/context, not the request body.

<!-- dict:col:rep_team_award_types.name -->
**`name`** (text, NOT NULL; CHECK `1 ≤ char_length(btrim(name)) ≤ 40`) — the coach-chosen label; unique per team while active (gotcha 3).

<!-- dict:col:rep_team_award_types.emoji -->
**`emoji`** (text, nullable; CHECK `char_length(emoji) ≤ 8`) — the icon shown wherever the award appears. App-side, a coach picks from a curated ~28-icon gallery or types a custom character; the column itself accepts any short string (no app-enforced vocabulary, unlike `bats`/`throws`).

<!-- dict:col:rep_team_award_types.sort_order -->
**`sort_order`** (int, NOT NULL, default 0) — display order in the picker; not yet reorderable app-side (all seeded/created types currently land in creation order).

<!-- dict:col:rep_team_award_types.is_active -->
**`is_active`** (bool, NOT NULL, default true) — retire/restore flag (gotcha 1).

<!-- dict:col:rep_team_award_types.created_by -->
**`created_by`** (FK → `auth.users.id` ON DELETE SET NULL, nullable) — the coach who created the type.

### `rep_player_awards`
<!-- dict:table:rep_player_awards -->

**Purpose:** the award record itself — one row per "MVP to Ethan Brar for the Jul 6 game." Added by migration 182 alongside `rep_team_award_types`. **⚠ DEV-ONLY / PROD-PENDING at author time.**

**Gotchas (read first):**
1. **`event_id` and `tournament_label` are mutually optional, not a pair.** A row can carry an `event_id` (tied to a specific played game), a `tournament_label` (free text — a tournament weekend or occasion not reducible to one game), or **neither** (a general/season recognition). The give-award API nulls `tournament_label` whenever `event_id` is set, so a row is never ambiguously "for" two things at once.
2. **`award_type_id` is `ON DELETE RESTRICT`, not `CASCADE`** — deliberately different from `rep_team_event_tags`' cascade-on-delete-the-parent-tag. This row IS the historical record (not a disposable link), and the app never hard-deletes a type (retire only, gotcha 1 on `rep_team_award_types`), so `RESTRICT` backstops that invariant at the DB level in case it ever tried to.
3. **A game must be scored before it can carry an award.** The give-award API rejects `event_id` for a game whose `teamScore`/`opponentScore` aren't both set yet (mirrors the schedule page's own gating — the "Give an award" button is hidden until a final score is entered). `awarded_at` is derived from the event's date when `event_id` is set, or an explicit/defaulted date otherwise.
4. **No `program_year_id` column, and none is needed.** `player_id` is inherently season-scoped already — season rollover mints a **new** `rep_roster_players` row per player (see that table's gotchas), so every award reachable from a given `player_id` already belongs to that one season. The player-profile summary (`getRepPlayerAwardsSummary`) relies on this instead of filtering by season.
5. **Hard-deletable, unlike an award TYPE.** The `/awards/[awardId]` DELETE route removes a single mis-given record outright (undo a mis-click) — this is a different concern from retiring a *type*, which never deletes.
6. **Direct `team_id`/`org_id` RLS (not a join-through-parent EXISTS).** Mirrors `rep_team_lineup_templates` (mig 159) rather than `rep_team_event_tags` (mig 181) — this row is a first-class record with its own denormalized scope columns, not a pure link table.

**Fields** (boilerplate `id`, `created_at`, `updated_at` omitted):

<!-- dict:col:rep_player_awards.org_id -->
<!-- dict:col:rep_player_awards.team_id -->
**`org_id` / `team_id`** (FK, NOT NULL, CASCADE) — scope; sourced from the URL/context, not the request body.

<!-- dict:col:rep_player_awards.player_id -->
**`player_id`** (FK → `rep_roster_players.id` CASCADE) — the recipient; must be an active roster player at award time (app-enforced, no DB CHECK).

<!-- dict:col:rep_player_awards.award_type_id -->
**`award_type_id`** (FK → `rep_team_award_types.id` RESTRICT) — which award (gotcha 2); must be an ACTIVE type at award time (a retired type can't be picked for a new award, though it keeps resolving for past ones).

<!-- dict:col:rep_player_awards.event_id -->
**`event_id`** (FK → `rep_team_events.id` ON DELETE SET NULL, nullable) — the specific game, when tied to one (gotcha 1, gotcha 3). `SET NULL` (not CASCADE) so deleting the game degrades the award to "general" rather than deleting the record.

<!-- dict:col:rep_player_awards.tournament_label -->
**`tournament_label`** (text, nullable; CHECK `≤ 80` chars) — free-text occasion when not tied to a single game (gotcha 1).

<!-- dict:col:rep_player_awards.awarded_at -->
**`awarded_at`** (date, NOT NULL) — derived from the event's date when `event_id` is set, else client-supplied or defaulted to `tournamentToday()` (gotcha 3).

<!-- dict:col:rep_player_awards.note -->
**`note`** (text, nullable; CHECK `≤ 200` chars) — the coach's one-line note ("Diving catch to end the game").

<!-- dict:col:rep_player_awards.created_by -->
**`created_by`** (FK → `auth.users.id` ON DELETE SET NULL, nullable) — the coach who gave the award.

### `rep_team_measurable_types`
<!-- dict:table:rep_team_measurable_types -->

**Purpose:** a coach's own per-team measurable-test library ("60-yd sprint (seconds)", "Overhand throw velo (mph)") that `rep_player_measurables` entries point at. Added by migration 189 (Player Development, slice 3A). Mirrors `rep_team_award_types` (mig 182) structurally. **⚠ DEV-ONLY / PROD-PENDING at author time.**

**Gotchas (read first):**
1. **Never hard-deleted.** No DELETE route/policy — "retire" is `is_active=false`; every logged entry keeps resolving the type's current name at render time. Retiring drops the type from the picker without fragmenting a player's history (the anti-"60yd / Sixty" drift design).
2. **One ACTIVE name per team, case-insensitive** — partial unique index (`WHERE is_active`); a retired name can be reused; duplicate active name → 409.
3. **`unit` lives on the type AND is snapshotted onto each entry** at log time (see `rep_player_measurables.unit`) so a later unit edit never silently rewrites history.
4. **NOT seeded** (unlike award types) — measurables are deliberately coach-defined per team, sport-neutral by construction (no SportPack catalog in V1; a sport-seeded starter set is a listed fast-follow).
5. **`team_id` NOT NULL** — no org-shared rows in V1 (org-shared libraries are a fast-follow; award types' mig-184 widening is the precedent when that happens).
6. **Writes are head-coach-only at BOTH layers** (Player Development D1). App routes gate on `canWriteDevelopment` (isHeadCoach) AND the RLS write policies require `rep_team_coaches.coach_role = 'head_coach'` — deliberately TIGHTER than the mig-182 awards posture, so a direct PostgREST call from an assistant's session can't bypass D1 (mig-141 chat-engine lesson; caught + fixed in the 3A adversarial review). No org-admin write policies exist (no admin write surface; future ones would use service-role routes). Applies to all three Player Development tables. Every policy is DROP-IF-EXISTS-guarded → the migration is safely re-runnable.

**Fields** (boilerplate `id`, `created_at`, `updated_at` omitted):

<!-- dict:col:rep_team_measurable_types.org_id -->
<!-- dict:col:rep_team_measurable_types.team_id -->
**`org_id` / `team_id`** (FK, NOT NULL, CASCADE) — scope; sourced from the URL/context, not the request body.

<!-- dict:col:rep_team_measurable_types.name -->
**`name`** (text, NOT NULL; CHECK `1 ≤ char_length(btrim(name)) ≤ 40`) — the test's label; unique per team while active (gotcha 2).

<!-- dict:col:rep_team_measurable_types.unit -->
**`unit`** (text, NOT NULL; CHECK `1 ≤ char_length(btrim(unit)) ≤ 20`) — free-text unit ("seconds", "mph"); snapshotted onto entries (gotcha 3).

<!-- dict:col:rep_team_measurable_types.sort_order -->
**`sort_order`** (int, NOT NULL, default 0) — picker display order.

<!-- dict:col:rep_team_measurable_types.is_active -->
**`is_active`** (bool, NOT NULL, default true) — retire/restore flag (gotcha 1).

<!-- dict:col:rep_team_measurable_types.created_by -->
**`created_by`** (FK → `auth.users.id` ON DELETE SET NULL, nullable) — the coach who created the type.

### `rep_player_measurables`
<!-- dict:table:rep_player_measurables -->

**Purpose:** one dated measurable reading — "Avery ran the 60-yd in 8.42s on Jul 17." Added by migration 189 (Player Development, slice 3A). **⚠ DEV-ONLY / PROD-PENDING at author time.**

**Gotchas (read first):**
1. **`measurable_type_id` is `ON DELETE RESTRICT`** — the entry IS the historical record (same reasoning as `rep_player_awards.award_type_id`); types are only ever retired, never deleted.
2. **`unit` is a SNAPSHOT** of the type's unit at log time — render the entry's own unit, never re-join to the type for it.
3. **`value` is bounded** (`numeric(8,3)`, CHECK `0 ≤ value ≤ 99999`) — the tryouts-review "unconstrained numeric" lesson applied at DB level.
4. **No `program_year_id` and none needed** — `player_id` is inherently season-scoped (season rollover mints a new `rep_roster_players` row; same as `rep_player_awards` gotcha 4). Cross-season history arrives via continuity links (slice 3C), not season columns here.
5. **Hard-deletable** (undo a mis-entry) — a different concern from retiring a *type*.
6. **UI honesty rules are app-side law:** a trend/sparkline renders only at ≥2 entries of the same type in-season; team-wide lists stay roster-ordered (never sort-by-result). No DB enforcement — flag any violation in review.
7. **`session_id` (mig 190) is a nullable evaluation-session back-reference** — entries logged from an Evaluation Session carry it; singles logged from the player-profile card leave it NULL. Both doors write the SAME rows (one dataset, two doors). **The FK is COMPOSITE `(session_id, team_id) → rep_team_evaluation_sessions(id, team_id)`** so a reading can never reference another team's session even via direct PostgREST (3B review fix; MATCH SIMPLE skips NULL session_id; the SET NULL action is column-scoped to session_id — PG15+). **Partial unique `(session_id, player_id, measurable_type_id) WHERE session_id IS NOT NULL`** = one reading per player per test per session (duplicate → 409 app-side); singles are unconstrained. Deleting a session degrades its entries to singles, never erases readings. The app additionally requires the session's `program_year_id` to match the player row's (a prior-season session id can't be attached to a current reading).

**Fields** (boilerplate `id`, `created_at`, `updated_at` omitted):

<!-- dict:col:rep_player_measurables.org_id -->
<!-- dict:col:rep_player_measurables.team_id -->
**`org_id` / `team_id`** (FK, NOT NULL, CASCADE) — scope; sourced from the URL/context, not the request body.

<!-- dict:col:rep_player_measurables.player_id -->
**`player_id`** (FK → `rep_roster_players.id` CASCADE) — the player measured.

<!-- dict:col:rep_player_measurables.measurable_type_id -->
**`measurable_type_id`** (FK → `rep_team_measurable_types.id` RESTRICT) — which test (gotcha 1); must be an ACTIVE type at log time (app-enforced).

<!-- dict:col:rep_player_measurables.value -->
**`value`** (numeric(8,3), NOT NULL; CHECK `0 ≤ value ≤ 99999`) — the reading (gotcha 3).

<!-- dict:col:rep_player_measurables.unit -->
**`unit`** (text, NOT NULL; CHECK `1–20` chars) — unit snapshot (gotcha 2).

<!-- dict:col:rep_player_measurables.recorded_on -->
**`recorded_on`** (date, NOT NULL) — when the test was run; client-supplied, defaults to today in the UI (tournament-timezone rules don't apply — it's a coach-chosen calendar date).

<!-- dict:col:rep_player_measurables.note -->
**`note`** (text, nullable; CHECK `≤ 200` chars) — optional context ("after warm-up, turf").

<!-- dict:col:rep_player_measurables.created_by -->
**`created_by`** (FK → `auth.users.id` ON DELETE SET NULL, nullable) — the coach who logged it.

<!-- dict:col:rep_player_measurables.session_id -->
**`session_id`** (FK → `rep_team_evaluation_sessions.id` ON DELETE SET NULL, nullable; mig 190) — the evaluation session this reading was collected in (gotcha 7); NULL = logged as a single from the player profile.

### `rep_team_evaluation_sessions`
<!-- dict:table:rep_team_evaluation_sessions -->

**Purpose:** the Evaluation Session artifact — "Jul 17 — 14 players, 3 tests." The coach's batch-collection unit for measurables (Player Development slice 3B, migration 190); the session grid writes ordinary `rep_player_measurables` rows tagged with `session_id`. **⚠ DEV-ONLY / PROD-PENDING at author time — promote with mig 189.**

**Gotchas (read first):**
1. **A session is a grouping artifact, not the record.** Readings are permanent; deleting a session `SET NULL`s its entries back to singles — never deletes them (column-scoped SET NULL via the composite FK from `rep_player_measurables`; see that table's gotcha 7). Session stats ("14 players · 3 tests") are DERIVED at read time from the entries, never stored. `UNIQUE (id, team_id)` exists solely as the composite-FK target.
2. **Head-coach-only writes at BOTH layers from birth** (D1): app routes gate on `canWriteDevelopment`, RLS write policies require `coach_role='head_coach'`, no org-admin write policies (same posture mig 189 was tightened to). All policies DROP-guarded → re-runnable.
3. **`program_year_id` IS stored here** (unlike the per-player Development tables, which season-scope via `player_id`) — a session belongs to a season directly, and the hub lists the active program year's sessions.
4. **UI honesty rules (app-side law):** the session grid renders the roster in ROSTER ORDER only (never sort-by-result); skipped/absent players simply have no entry (an honest dash, never a fabricated 0).

**Fields** (boilerplate `id`, `created_at`, `updated_at` omitted):

<!-- dict:col:rep_team_evaluation_sessions.org_id -->
<!-- dict:col:rep_team_evaluation_sessions.team_id -->
**`org_id` / `team_id`** (FK, NOT NULL, CASCADE) — scope; sourced from the URL/context, not the request body.

<!-- dict:col:rep_team_evaluation_sessions.program_year_id -->
**`program_year_id`** (FK → `rep_program_years.id`, NOT NULL, CASCADE) — the season the session belongs to (gotcha 3).

<!-- dict:col:rep_team_evaluation_sessions.session_date -->
**`session_date`** (date, NOT NULL) — when the tests were run; defaults to today in the UI, same 2000..next-year sanity bounds as `rep_player_measurables.recorded_on` (app-enforced).

<!-- dict:col:rep_team_evaluation_sessions.note -->
**`note`** (text, nullable; CHECK `≤ 200` chars) — optional session label ("post-break testing").

<!-- dict:col:rep_team_evaluation_sessions.created_by -->
**`created_by`** (FK → `auth.users.id` ON DELETE SET NULL, nullable) — the head coach who ran it.

### `rep_player_development_goals`
<!-- dict:table:rep_player_development_goals -->

**Purpose:** a coach's development focus areas (IDP) for one player — free text + status, deliberately no score/rank/percent. Added by migration 189 (Player Development, slice 3A). **⚠ DEV-ONLY / PROD-PENDING at author time.**

**Gotchas (read first):**
1. **Dedicated table, NOT jsonb on `rep_roster_players`** — slice 3D's cross-season carry-forward queries goals across the player-row chain (roster rows are minted fresh every season), which jsonb-on-a-replaced-row can't support.
2. **`status` is the whole lifecycle:** `working` | `achieved` | `parked` (CHECK). "Archive" is `parked`; hard DELETE exists only to undo a mis-entry.
3. **View gates on the `notes` capability; writes are head-coach-only** (Player Development D1) — goals are coach-judgment content about a minor, same sensitivity class as `admin_notes`. Content must stay skill/goal-oriented (PIPEDA posture: no behavioral-profiling fields).
4. **No `program_year_id`** — same season-scoping-via-player_id reasoning as measurables/awards.

**Fields** (boilerplate `id`, `created_at`, `updated_at` omitted):

<!-- dict:col:rep_player_development_goals.org_id -->
<!-- dict:col:rep_player_development_goals.team_id -->
**`org_id` / `team_id`** (FK, NOT NULL, CASCADE) — scope; sourced from the URL/context, not the request body.

<!-- dict:col:rep_player_development_goals.player_id -->
**`player_id`** (FK → `rep_roster_players.id` CASCADE) — whose focus area.

<!-- dict:col:rep_player_development_goals.focus_area -->
**`focus_area`** (text, NOT NULL; CHECK `1–80` chars) — the plain-language focus ("First-step quickness off the bag").

<!-- dict:col:rep_player_development_goals.note -->
**`note`** (text, nullable; CHECK `≤ 280` chars) — one short note; UI copy nudges "a note the player would be happy to read."

<!-- dict:col:rep_player_development_goals.status -->
**`status`** (text, NOT NULL, default `'working'`; CHECK `working|achieved|parked`) — the status pill (gotcha 2).

<!-- dict:col:rep_player_development_goals.created_by -->
**`created_by`** (FK → `auth.users.id` ON DELETE SET NULL, nullable) — the coach who set it.

### `rep_player_continuity_links`
<!-- dict:table:rep_player_continuity_links -->

**Purpose:** coach-confirmed identity links between a CURRENT entity (roster row OR tryout registration) and a PRIOR season's entity (roster row OR registration), same team — the "possible returning player — verify" record (Player Development 3C, migration 191; design = DBA Finding #31). Mig 192 (3D) adds the carry-forward decision audit. **⚠ DEV-ONLY / PROD-PENDING — promote with migs 189+190+191+192 (192 ALTERs the table 191 creates, so 191 must apply first).**

**Gotchas (read first):**
1. **One row per (current, prior) PAIR for its whole lifecycle** — `suggested → confirmed | rejected` are status transitions on that single row (pair-unique expression index on the coalesced side ids). A `rejected` row IS the never-re-suggest tombstone, by construction — do NOT delete it to "clean up". Transitions are guarded in the UPDATE itself (`decideContinuityLink`): confirm only from `suggested`, reject from `suggested|confirmed` — a tombstone can never resurrect, even from a stale-tab replay.
2. **Side-FKs are COMPOSITE `(side_id, team_id) → source(id, team_id)`, ON DELETE CASCADE** — a link's sides must belong to the LINK's OWN team, structurally (a single-column FK would let a direct PostgREST write reference any row platform-wide; mig-190 lesson). Mig 191 adds the backing `UNIQUE (id, team_id)` constraints on `rep_roster_players` + `rep_tryout_registrations`. Exactly one FK per side (CHECKs); uuids are globally unique so coalesce-pairing is collision-safe. CASCADE because a link missing either side is meaningless (SET NULL would violate the CHECKs).
3. **At most one CONFIRMED link per current entity** (partial unique) — one identity per player; multiple suggested/rejected rows per current stay legal. ⚠ The index can't see that a roster row and its originating registration are the SAME person — the decide API pre-checks across that alias (gotcha 4).
4. **Sides are IMMUTABLE — reads/writes resolve the accept-boundary ALIAS.** When a current registration is later accepted (roster row minted carrying `tryout_registration_id`), NOTHING rewrites the link. The scan API surfaces registration-keyed links under the roster id, blocks re-suggesting a pair that exists under either id, and the decide API enforces one-confirmed across both ids. No migration job, no drift.
5. **NEVER any guardian-PII column here** — FK-only + `confidence` + `status` + audit. Unlink = the confirmed→rejected TRANSITION (tombstone remains); nothing is deleted, source rows untouched.
6. **`decided_by`/`decided_at`** audit BOTH confirmation and rejection (a remembered rejection needs the same audit); NULL while `suggested`. `decided_at` is a **timestamptz instant** — display via `formatShortInstant`, never the DATE-string slicer.
7. **Head-coach-only writes at BOTH layers** (D1; RLS requires `coach_role='head_coach'`, no org-admin writes, DROP-guarded → re-runnable). Matching (guardian-email + name similarity + exact DOB) is app-side — this table stores only outcomes.
8. **Suggest writes are plain bulk INSERT + 23505 per-row fallback** (`suggestContinuityLinksBulk`) — PostgREST's `ignoreDuplicates` CANNOT arbitrate on the expression-based pair-unique index (on_conflict takes plain columns only; its default arbiter is the PK, which never collides on generated uuids). Existing pairs are excluded app-side before the insert; the fallback only covers a concurrent-scan race.
9. **Carry-forward is a ONE-TIME decision recorded on the LINK row (mig 192)** — `carry_status` NULL = the banner may still show; `'carried'` = the prior season's *working* goals were COPIED into new `rep_player_development_goals` rows on the current player (copies, not moves — the archive keeps the originals); `'fresh'` = declined, banner retired. App rules (not constraints): only ever written on a CONFIRMED link whose current side is a roster row; head-coach-only (covered by the existing UPDATE policy). Measurables are NEVER carried across seasons (fake trend data).
10. **Season-roll links are minted CONFIRMED at rollover** (`lib/rep-season-rollover.ts`, 3D) — the roll literally copies each roster row, so the pair is factual provenance, not a matcher guess: `confidence='high'`, `status='confirmed'`, `decided_by` = the coach who ran the roll. Best-effort per-row (a failed link mint warns in the roll summary, never fails the roll); the pair-unique index makes re-runs/races safe.

**Fields** (boilerplate `id`, `created_at`, `updated_at` omitted):

<!-- dict:col:rep_player_continuity_links.org_id -->
<!-- dict:col:rep_player_continuity_links.team_id -->
**`org_id` / `team_id`** (FK, NOT NULL, CASCADE) — scope; links are same-team by matcher scope.

<!-- dict:col:rep_player_continuity_links.current_roster_id -->
<!-- dict:col:rep_player_continuity_links.current_registration_id -->
**`current_roster_id` / `current_registration_id`** (nullable FKs, CASCADE; exactly one set) — the THIS-season side (gotcha 2).

<!-- dict:col:rep_player_continuity_links.prior_roster_id -->
<!-- dict:col:rep_player_continuity_links.prior_registration_id -->
**`prior_roster_id` / `prior_registration_id`** (nullable FKs, CASCADE; exactly one set) — the prior-season side.

<!-- dict:col:rep_player_continuity_links.status -->
**`status`** (text, NOT NULL, default `'suggested'`; CHECK `suggested|confirmed|rejected`) — the pair's lifecycle (gotcha 1).

<!-- dict:col:rep_player_continuity_links.confidence -->
**`confidence`** (text, NOT NULL; CHECK `high|possible`) — the matcher's tier at suggestion time (app-computed; display copy says "possible — verify", never a verdict).

<!-- dict:col:rep_player_continuity_links.decided_by -->
<!-- dict:col:rep_player_continuity_links.decided_at -->
**`decided_by`** (FK → `auth.users.id` SET NULL) / **`decided_at`** (timestamptz) — who confirmed OR rejected, and when (gotcha 6).

<!-- dict:col:rep_player_continuity_links.carry_status -->
<!-- dict:col:rep_player_continuity_links.carry_decided_by -->
<!-- dict:col:rep_player_continuity_links.carry_decided_at -->
**`carry_status`** (text, nullable; CHECK `carried|fresh`; **mig 192**) / **`carry_decided_by`** (FK → `auth.users.id` SET NULL) / **`carry_decided_at`** (timestamptz) — the one-time rollover carry-forward answer + its audit (gotcha 9). NULL until the coach answers.

### `rep_tryout_registrations`
<!-- dict:table:rep_tryout_registrations -->

**Purpose:** **public** tryout sign-ups (guardian-submitted) for a team's program year; they flow through an admin-reviewed status machine and, on acceptance, convert into a `rep_roster_players` row (`source='tryout'`). The public on-ramp from prospect to rostered player.

**Gotchas (read first):**
1. **Public, UNAUTHENTICATED insert via service role.** The public register route has no auth context; `createRepTryoutRegistration` uses `supabaseAdmin` ([lib/db.ts:4275](../../../lib/db.ts#L4275)) — RLS is dormant on this path.
2. **The `tryout_open` gate is on the PARENT** (`rep_program_years`), not this table — the public route 409s if `!programYear.tryoutOpen` ([register/route.ts:40](../../../app/api/rep-teams/%5BorgSlug%5D/%5BteamSlug%5D/tryouts/%5ByearId%5D/register/route.ts#L40)); `rep_program_years.tryout_description` is the public blurb.
3. **The status machine is enforced in CODE, not the DB** — `VALID_TRANSITIONS`: `pending_review→offered|declined|withdrawn`; `offered→accepted|declined|withdrawn`; `accepted→withdrawn`; `declined`/`withdrawn` terminal; illegal → 422. (You can decline straight from `pending_review` but cannot accept without offering first.)
4. **Roster conversion fires on `accepted` only and is now ATOMIC (Phase 2B.4)** — `acceptTryoutAndAddToRoster` delegates to the `accept_tryout_and_create_dues` plpgsql RPC (mig 169), which in one transaction re-reads the registration `FOR UPDATE`, asserts `status='offered'` (raises `tryout_accept_not_offered`→409 on a double-accept race), inserts the roster player, sets `status='accepted'`, and — optionally — creates the `rep_player_dues_schedules` header + `rep_player_dues_installments` (validated: total>0, each installment>0, sum≈total). All-or-nothing; the prior non-transactional orphan/dup risk is closed. Callable by the admin accept route, the coach `tryout-decisions/accept` route, and (later) 2B.5's token accept — auth is enforced by the caller, the RPC guards only the state machine.
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
**`status`** (text, NOT NULL, default `'pending_review'`; CHECK `pending_review|offered|waitlisted|accepted|declined|withdrawn`) — transitions in code (gotchas 3–5). `waitlisted` added **mig 168** (Phase 2B.3 decision board: Offer→offered, Waitlist→waitlisted, Not this season→declined); distinct from `pending_review` (undecided) so 2B.5 can auto-promote from the waitlist.

<!-- dict:col:rep_tryout_registrations.admin_notes -->
**`admin_notes`** (text, nullable) — internal reviewer notes (vs guardian `player_notes`).

<!-- dict:col:rep_tryout_registrations.consent_data_collection -->
<!-- dict:col:rep_tryout_registrations.consent_email_comms -->
<!-- dict:col:rep_tryout_registrations.consent_eligibility -->
**`consent_data_collection` / `consent_email_comms` / `consent_eligibility`** (boolean, nullable; **mig 164**) — guardian consent captured at public submit: PIPEDA data-collection, CASL email, and guardian+eligibility confirmation. **All three are REQUIRED by the app to submit** (server re-checks `=== true`), so a non-NULL `consent_at` implies all three were true. Nullable, **no backfill** → pre-gate rows stay NULL = "no consent on record" (gotcha 7).

<!-- dict:col:rep_tryout_registrations.consent_at -->
**`consent_at`** (timestamptz, nullable; **mig 164**) — server clock at the moment consent was given; the admin **Compliance** column + consent export key off this.

<!-- dict:col:rep_tryout_registrations.consent_ip -->
**`consent_ip`** (text, nullable; **mig 164**) — best-effort client IP at consent time, captured **server-side only** (`clientIpFrom`, never from the request body); audit use only, marked **sensitive** in exports.

<!-- dict:col:rep_tryout_registrations.bib_number -->
<!-- dict:col:rep_tryout_registrations.is_checked_in -->
<!-- dict:col:rep_tryout_registrations.checked_in_at -->
**`bib_number` / `is_checked_in` / `checked_in_at`** (text / boolean NOT NULL default false / timestamptz; **mig 165**) — tryout-day candidate fields. `bib_number` is text (allows alpha bibs; app sorts numerically); **one bib + check-in per candidate per tryout** for V1 (per-session check-in deferred). Set from the coaches-portal day-of check-in view. **mig 166** adds partial unique index `rep_tryout_registrations_bib_uq (program_year_id, bib_number) WHERE bib_number IS NOT NULL` — no duplicate bibs within a tryout (NULLs repeat freely for unbibbed candidates).

<!-- dict:col:rep_tryout_registrations.submitted_at -->
**`submitted_at`** (timestamptz, NOT NULL, default now()) — **the create stamp** (this table has no `created_at`); admin list orders `submitted_at DESC`.

<!-- dict:col:rep_tryout_registrations.offer_token_hash -->
<!-- dict:col:rep_tryout_registrations.offer_sent_at -->
<!-- dict:col:rep_tryout_registrations.offer_expires_at -->
<!-- dict:col:rep_tryout_registrations.offer_response -->
<!-- dict:col:rep_tryout_registrations.offer_responded_at -->
**`offer_token_hash` / `offer_sent_at` / `offer_expires_at` / `offer_response` / `offer_responded_at`** (text / timestamptz / timestamptz / text / timestamptz, all nullable; **mig 170**, Phase 2B.5) — the guardian OFFER-RESPONSE loop. When a coach/admin extends an offer, `offer_token_hash` stores the **SHA-256** of a no-login response token (raw token lives only in the email URL — same posture as `rep_tryout_evaluator_sessions.token_hash`; partial-unique index `rep_tryout_registrations_offer_token_uq WHERE offer_token_hash IS NOT NULL`), `offer_sent_at` stamps the send, and `offer_expires_at` is the **7-day (adjustable) deadline** — enforced **lazily on board view** (no scheduler), and a lapsed offer is surfaced as "expired" but **never auto-mutates `status`** (D2: flag the coach). `offer_response` is the family's self-serve answer via the token page — `'accepted'` / `'declined'` (CHECK), **distinct from `status`** because the coach still finalizes the roster add + fees (D1: accept = coach confirms); `offer_responded_at` stamps it and is the token's **single-use** guard. A non-offered transition clears all five so a re-offer mints a fresh link.

### `rep_tryouts`
<!-- dict:table:rep_tryouts -->

**Purpose:** the **tryout/evaluation workspace** — 1:1 with a program year (the tryout cycle). Owns blind-mode + (Phase 2B) score-lock config and is the FK anchor for `rep_tryout_sessions` and the future 2B tables (rubrics / evaluator-sessions / scores). Created lazily when a coach first sets up tryout day. NOT a game event (kept off `rep_team_events`). **mig 165.** Service-role only; **RLS ENABLED, no policies** (anon REST reads zero rows). See DB_ARCHITECTURE_REVIEW Finding #30.

<!-- dict:col:rep_tryouts.program_year_id -->
**`program_year_id`** (FK → `rep_program_years.id`, NOT NULL, **UNIQUE** → 1:1) — the tryout cycle's season spine; `tryout_open`/`tryout_description` stay on the program year (V1), this row holds evaluation config.

<!-- dict:col:rep_tryouts.team_id -->
<!-- dict:col:rep_tryouts.org_id -->
**`team_id` / `org_id`** (FK, NOT NULL, denormalized) — rep_* leaf scoping (one-hop `org_id`).

<!-- dict:col:rep_tryouts.is_anonymous -->
**`is_anonymous`** (boolean, NOT NULL, default **true**) — BLIND evaluation default-ON: day-of + scoring views show bib numbers and hide names until a deliberate reveal.

<!-- dict:col:rep_tryouts.scores_locked_at -->
<!-- dict:col:rep_tryouts.scores_locked_by -->
**`scores_locked_at` / `scores_locked_by`** (timestamptz / uuid, nullable) — reserved for the Phase 2B one-way score-lock + names-reveal (irreversible, audited). Dormant in 2A.

<!-- dict:col:rep_tryouts.created_at -->
<!-- dict:col:rep_tryouts.updated_at -->
**`created_at` / `updated_at`** (timestamptz, NOT NULL, default now()).

### `rep_tryout_sessions`
<!-- dict:table:rep_tryout_sessions -->

**Purpose:** the scheduled **date/time/location blocks** of a tryout (one row per block → multi-day support). The coach schedule view **projects these onto the calendar at read time** as a distinct, read-only "Tryout" item — **no `rep_team_events` row is created** (single source of truth; keeps tryouts out of game W-L / next-event aggregates by construction). **mig 165.** Service-role only; **RLS ENABLED, no policies.**

<!-- dict:col:rep_tryout_sessions.tryout_id -->
**`tryout_id`** (FK → `rep_tryouts.id`, NOT NULL, ON DELETE CASCADE) — parent tryout workspace.

<!-- dict:col:rep_tryout_sessions.program_year_id -->
<!-- dict:col:rep_tryout_sessions.team_id -->
<!-- dict:col:rep_tryout_sessions.org_id -->
**`program_year_id` / `team_id` / `org_id`** (FK, NOT NULL, denormalized) — rep_* leaf scoping (one-hop `org_id`, not via `rep_tryouts`).

<!-- dict:col:rep_tryout_sessions.starts_at -->
<!-- dict:col:rep_tryout_sessions.ends_at -->
**`starts_at`** (timestamptz, NOT NULL) / **`ends_at`** (nullable) — the block's time; `starts_at` is indexed for the schedule-union range read.

<!-- dict:col:rep_tryout_sessions.location -->
<!-- dict:col:rep_tryout_sessions.location_address -->
<!-- dict:col:rep_tryout_sessions.field_number -->
<!-- dict:col:rep_tryout_sessions.label -->
**`location` / `location_address` / `field_number` / `label`** (text, nullable) — where, plus an optional block label; mirrors the `rep_team_events` location fields.

<!-- dict:col:rep_tryout_sessions.status -->
**`status`** (text, NOT NULL, default `'scheduled'`; CHECK `scheduled|cancelled`) — a cancelled session is retained for history but drops off the calendar projection.

<!-- dict:col:rep_tryout_sessions.created_at -->
<!-- dict:col:rep_tryout_sessions.updated_at -->
**`created_at` / `updated_at`** (timestamptz, NOT NULL, default now()).

### `rep_tryout_rubrics`
<!-- dict:table:rep_tryout_rubrics -->

**Purpose:** the **evaluation scorecard** for a tryout — 1 per tryout (Phase 2B). The whole rubric lives in `categories` (JSONB) so its shape evolves without migrations; cloning a prior tryout's rubric is an app-level copy. **mig 166.** Service-role only; **RLS ENABLED, no policies.** Anchors on `rep_tryouts` (DBA Finding #30); future score rows reference the category `key`s.

<!-- dict:col:rep_tryout_rubrics.tryout_id -->
**`tryout_id`** (FK → `rep_tryouts.id`, NOT NULL, **UNIQUE** → one rubric per tryout).

<!-- dict:col:rep_tryout_rubrics.program_year_id -->
<!-- dict:col:rep_tryout_rubrics.team_id -->
<!-- dict:col:rep_tryout_rubrics.org_id -->
**`program_year_id` / `team_id` / `org_id`** (FK, NOT NULL, denormalized) — rep_* leaf scoping (one-hop `org_id`).

<!-- dict:col:rep_tryout_rubrics.name -->
**`name`** (text, nullable) — the scorecard's label (e.g. "U15 AAA tryout scorecard").

<!-- dict:col:rep_tryout_rubrics.scale_max -->
**`scale_max`** (smallint, NOT NULL, default 5; CHECK 5 or 10) — the rating scale (1–5 or 1–10).

<!-- dict:col:rep_tryout_rubrics.categories -->
**`categories`** (jsonb, NOT NULL, default `[]`) — the rubric: array of `{ key, label, weight, instructions? }`. `key` is the stable id a score row references; `weight` drives the composite ranking. App-shaped (no CHECK).

<!-- dict:col:rep_tryout_rubrics.created_at -->
<!-- dict:col:rep_tryout_rubrics.updated_at -->
**`created_at` / `updated_at`** (timestamptz, NOT NULL, default now()).

### `rep_tryout_evaluator_sessions`
<!-- dict:table:rep_tryout_evaluator_sessions -->

**Purpose:** a **no-account co-coach scoring link** (Phase 2B.2). The head coach generates one per evaluator; the raw token lives only in the URL — only its SHA-256 `token_hash` is stored. **mig 167.** Service-role only; **RLS ENABLED, no policies.**

<!-- dict:col:rep_tryout_evaluator_sessions.tryout_id -->
**`tryout_id`** (FK → `rep_tryouts.id`, NOT NULL).
<!-- dict:col:rep_tryout_evaluator_sessions.program_year_id -->
<!-- dict:col:rep_tryout_evaluator_sessions.team_id -->
<!-- dict:col:rep_tryout_evaluator_sessions.org_id -->
**`program_year_id` / `team_id` / `org_id`** (FK, NOT NULL, denormalized) — one-hop scoping.
<!-- dict:col:rep_tryout_evaluator_sessions.evaluator_name -->
**`evaluator_name`** (text, nullable) — who's scoring (attribution + bias view).
<!-- dict:col:rep_tryout_evaluator_sessions.token_hash -->
**`token_hash`** (text, NOT NULL, UNIQUE) — SHA-256 of the link token; the **raw token is never stored** (matches `team_workspace_claims`). Server hashes the incoming token to resolve the session.
<!-- dict:col:rep_tryout_evaluator_sessions.expires_at -->
**`expires_at`** (timestamptz, NOT NULL) — ≤48h from creation (app-enforced); checked on every score write.
<!-- dict:col:rep_tryout_evaluator_sessions.revoked_at -->
**`revoked_at`** (timestamptz, nullable) — head coach can revoke; a non-null value **blocks all writes** (checked server-side on every score).
<!-- dict:col:rep_tryout_evaluator_sessions.created_at -->
**`created_at`** (timestamptz, NOT NULL, default now()).

### `rep_tryout_scores`
<!-- dict:table:rep_tryout_scores -->

**Purpose:** one **evaluator score per candidate per rubric category** (Phase 2B.2). Upsert-only (unique key), so re-scoring overwrites. Aggregated at read time (weighted by `rep_tryout_rubrics.categories[].weight`) into the composite ranking; the head-coach dashboard **polls** (no Realtime — deliberate, keeps minors' scores off any client RLS-SELECT path). **mig 167.** Service-role only; **RLS ENABLED, no policies.**

<!-- dict:col:rep_tryout_scores.evaluator_session_id -->
**`evaluator_session_id`** (FK → `rep_tryout_evaluator_sessions.id`, NOT NULL) — who scored.
<!-- dict:col:rep_tryout_scores.registration_id -->
**`registration_id`** (FK → `rep_tryout_registrations.id`, NOT NULL) — the candidate.
<!-- dict:col:rep_tryout_scores.tryout_id -->
<!-- dict:col:rep_tryout_scores.program_year_id -->
<!-- dict:col:rep_tryout_scores.team_id -->
<!-- dict:col:rep_tryout_scores.org_id -->
**`tryout_id` / `program_year_id` / `team_id` / `org_id`** (FK, NOT NULL, denormalized) — one-hop scoping.
<!-- dict:col:rep_tryout_scores.category_key -->
**`category_key`** (text, NOT NULL) — matches a `rep_tryout_rubrics.categories[].key`.
<!-- dict:col:rep_tryout_scores.score -->
**`score`** (smallint, NOT NULL, **CHECK 1–10** via `rep_tryout_scores_score_check`) — the rating. DB caps it at 1–10; the POST additionally clamps to the rubric's `scale_max` (5 or 10).
<!-- dict:col:rep_tryout_scores.note -->
**`note`** (text, nullable) — optional evaluator note.
<!-- dict:col:rep_tryout_scores.created_at -->
<!-- dict:col:rep_tryout_scores.updated_at -->
**`created_at` / `updated_at`** (timestamptz, NOT NULL, default now()). **UNIQUE(evaluator_session_id, registration_id, category_key)** — upsert, no dup rows.

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

### `rep_team_announcements`
<!-- dict:table:rep_team_announcements -->

**Purpose:** Premium Coaches Portal one-way email announcements (mig 138) — the Premium-side mirror of the free `basic_coach_team_announcements` (Premium ≥ Free parity). A coach emails the active roster's guardian contacts; the row logs COUNTS only (no recipient addresses — PII minimization). Org-scoped + season-scoped.

**Gotchas (read first):**
1. **Dev-only until deploy** (mig 138, applied to dev). Expect it in `DRIFT_dev_vs_prod.md` until promoted to master.
2. **Service-role only.** RLS ENABLED with NO policies (like its Basic cousin); all access via `supabaseAdmin` behind the coaches API `resolveCoachContext` gate (org + coaching assignment + active program year). `lib/rep-team-announcements.ts` owns the logic.
3. **Counts, not recipients.** Recipient emails are recomputed from the active roster (`rep_roster_players.guardian_email`, `status='active'`) on each send and never stored.
4. **Abuse caps are app-enforced** (10 sends / 24h per team, 100 recipients per send) — no DB constraint, matching the Basic floor.

**Fields** (boilerplate `id`, `created_at`, `updated_at` omitted):

<!-- dict:col:rep_team_announcements.org_id -->
<!-- dict:col:rep_team_announcements.team_id -->
<!-- dict:col:rep_team_announcements.program_year_id -->
**`org_id`** (FK → `organizations.id` ON DELETE CASCADE, NOT NULL) / **`team_id`** (FK → `rep_teams.id` ON DELETE CASCADE, NOT NULL) / **`program_year_id`** (FK → `rep_program_years.id` ON DELETE CASCADE, NOT NULL) — tenant + team + season scope; the log + recipient lookup key on `program_year_id` (`rep_team_announcements_year_idx (program_year_id, sent_at desc)`).

<!-- dict:col:rep_team_announcements.subject -->
<!-- dict:col:rep_team_announcements.body -->
**`subject`** (text, NOT NULL, CHECK non-empty + `<= 160`) / **`body`** (text, NOT NULL, CHECK non-empty + `<= 4000`) — email subject + message; same caps as the client editor and the Basic table.

<!-- dict:col:rep_team_announcements.recipient_count -->
<!-- dict:col:rep_team_announcements.sent_count -->
<!-- dict:col:rep_team_announcements.failed_count -->
**`recipient_count` / `sent_count` / `failed_count`** (int, NOT NULL, default `0`, CHECK `>= 0`; plus CHECK `sent_count + failed_count <= recipient_count` named `rep_team_announcements_counts_check`) — deduped target count at send time + per-recipient send-outcome tallies.

<!-- dict:col:rep_team_announcements.status -->
**`status`** (text, NOT NULL, default `'sent'`; CHECK `sent|partial|failed`) — derived: all sent → `sent`; some sent → `partial`; none → `failed`.

<!-- dict:col:rep_team_announcements.sent_at -->
**`sent_at`** (timestamptz, NOT NULL, default `now()`) — send-log display timestamp + the 24h rolling rate-limit key.

<!-- dict:col:rep_team_announcements.created_by -->
**`created_by`** (uuid, nullable, **no FK** — mirrors the rep family audit columns) — the coach who sent it.

---

*End of Rep operations (Phase 4a — 12 tables; + `rep_team_announcements` mig 138). The 4 `team_workspace_*` tables that the coverage classifier files under this domain live in the Coaches / basic-teams domain.*

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
- **Three schema/code-drift bugs were verified at commit `5479605` (the exact class this dictionary exists to surface — confirmed against live dev+prod via `information_schema`, 2026-06-09). Status after the 2026-06-09 follow-up fix pass:**
  1. **✓ FIXED 2026-06-09 (migration 119, dev+prod):** **`rep_team_expenses` had no `notes` column**, yet `createRepTeamExpense`/`updateRepTeamExpense` and the coach expenses form's Notes textarea all used it → every save/edit errored `column "notes" does not exist`. Migration 119 added the nullable `notes text` to both envs.
  2. **✓ FIXED 2026-06-09:** **`org_id` is `NOT NULL` with no default and no trigger** on both `rep_allocation_installments` and `rep_player_dues_installments`. The insert helpers (`createRepCostAllocationWithSplits`, `replaceRepDuesInstallments` + its caller, and the `generate-installments` route) now populate `org_id` and the denormalized `team_id`.
  3. **✓ FIXED 2026-06-09:** **`getRepAllocationSplitsForTeam` queried the non-existent column `allocation_split_id`**; corrected to the real FK column `split_id`.
  (All three resolved 2026-06-09. Line refs in the per-table gotchas are as-of commit `5479605`; the follow-up fixes shift them slightly.)
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
4. **`org_id` is NOT NULL with no default and no trigger.** Historically both insert paths omitted it (`replaceRepDuesInstallments`; the generator route) → NN violation — **✓ FIXED 2026-06-09** (both now populate `org_id` + the denormalized `team_id`). `team_id` is still nullable by design (denormalized copy; `team_idx`).
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
1. **`getRepAllocationSplitsForTeam` queried the non-existent column `allocation_split_id`** (real FK = **`split_id`**) → the coach allocations GET errored. **✓ FIXED 2026-06-09** (corrected to `split_id`).
2. **`org_id` is NOT NULL with no default/trigger.** `createRepCostAllocationWithSplits` historically omitted it on insert → NN violation — **✓ FIXED 2026-06-09** (now sets `org_id` + the denormalized `team_id`). `team_id` remains nullable by design (denormalized copy of the split's team; `team_idx`).
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
1. **`notes` column — was missing, now ✓ FIXED (migration 119, dev+prod, 2026-06-09).** At commit `5479605` the row had only 23 columns with **no `notes`**, yet `createRepTeamExpense`/`updateRepTeamExpense` and the coach expenses form's Notes textarea all used `notes` → every save/edit errored `column "notes" does not exist` (the exact schema-drift class this dictionary exists to surface). Migration 119 added the nullable `notes text` to both envs; the feature now works as designed.
2. **Two-payment model is by `expense_type`, NOT by arithmetic.** `expense`: fully paid when `expense_paid_at` is set; the deposit/balance fields are ignored. `tournament_payable`: fully paid when BOTH `deposit_paid_at` AND `balance_paid_at` are set; paid amount = (deposit_paid_at ? deposit_amount : 0) + (balance_paid_at ? balance_amount : 0). **`deposit_amount + balance_amount == amount` is NOT enforced** (no CHECK, no app validation). Worse, mark-deposit/mark-balance fall back to the FULL `amount` when the leg amount is NULL, so a payable with null split amounts can post the full amount twice. There is no single "is paid" flag.
3. **`expense_type` CHECK `expense|tournament_payable`** — `tournament_payable` = money owed to a tournament/host (deposit+balance schedule). `upcoming-payables` surfaces rows by deposit/balance **due dates only**, regardless of `expense_type`, so lump `expense` rows (no due dates) never appear there.
4. **`accounting_entry_id` is never written** — on mark-paid the route creates a team-ledger entry but discards its id (the ledger entry is authoritative, no back-reference).
5. **`payee_id` (→ org `org_payees`) vs `payee_payer` (text) are mutually exclusive** — picking a structured org payee sets `payee_id` (clears `payee_payer`); a free-text name sets `payee_payer` (clears `payee_id`); both set at create only. **`category` is free text** and is the (name-based, case-insensitive) join key to `rep_budget_lines` categories in budget-vs-actual — a typo silently drops the expense into "unbudgeted".
6. **CHECK `amount > 0`** (only `amount`; the deposit/balance amounts have no CHECK and are nullable).

**Fields** (boilerplate `id`, `created_at`, `updated_at` omitted):

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

<!-- dict:col:rep_team_expenses.notes -->
**`notes`** (text, nullable) — free-text note on the expense; added in migration 119 (gotcha 1). Written by `createRepTeamExpense`/`updateRepTeamExpense`; read into `RepTeamExpense.notes` and shown on the coach expenses list.

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

*End of Rep finance (Phase 4b — 13 tables) and of the Rep teams / team workspaces domain (25 tables total: 12 operations + 13 finance). The 4 `team_workspace_*` tables the coverage classifier files under this domain live in the Coaches / basic-teams domain. The cross-module roster snapshot back-link `tournament_roster_players.source_player_id` now exists (free-tier Phase 5j, mig 123) on the **tournament/basic-coach** side only — `rep_roster_players` still has **no** such snapshot link (its only inbound provenance is `tryout_registration_id`; don't invent one).*

---

# Domain: League / house-league

The **intra-org recreational house-league** module (`league_*`) — sign-ups, divisions, teams, a round-robin schedule, standings, practices, and a bulk-email log for a club's own in-house season (e.g. "U11 Summer 2025 softball"). It is a **League/Club-plan module** (`module_house_league`) and is **distinct from two already-documented domains**: the competitive **Tournaments & Registration** domain (`tournaments`/`divisions`/`teams`/`games`/`pools`/`tournament_registration_*`) and the elite **Rep teams** domain (`rep_*`). `league_divisions`/`league_teams`/`league_games` are the **house-league equivalents** of the tournament tables — same words, different tables; cross-reference the boundary, never merge them. Routes live under `app/api/admin/house-league/*` (admin) and `app/api/league/[orgSlug]/[seasonSlug]/*` + `app/[orgSlug]/league/*` (public). `league_seasons` is the spine: every division/team/game/registration/practice/log row hangs off `season_id`.

> _Last verified: 2026-06-10 @ snapshot 2026-06-10, commit `6deac4a` (branch `feat/free-tier-coaches`). Code is branch-relative — re-verify file:line at author time. **`lib/db.ts` refs are pinned to the committed `6deac4a` tree; the dirty working tree shifts the entire league helper region (`lib/db.ts` ~2904–3670) by ~+37 lines** — use `git show 6deac4a:lib/db.ts` to reproduce. Route/page refs under `app/api/admin/house-league/*`, `app/api/league/*`, `app/[orgSlug]/league/*` are unmodified in the working tree, so their numbers match._

### Gotchas first (the cross-cutting traps)

- **`org_id` on `league_games` + `league_practices` was `NOT NULL` but unwritten by every insert path — ✓ FIXED 2026-06-10.** `org_id` (added by migs 075/078 for direct-lookup RLS) is `NOT NULL`, **no column default, and NO trigger** — verified live against `information_schema`/`pg_trigger` on **both** dev and prod (2026-06-10; zero triggers on any `league_*` table). At commit `6deac4a` all three game-insert paths (`createLeagueGame` [lib/db.ts:3465](../../../lib/db.ts#L3465), the `schedule/generate` save [generate/route.ts:105-117](../../../app/api/admin/house-league/seasons/[seasonId]/schedule/generate/route.ts#L105-L117), the dev seed) and the practice-insert path (`createPractices` [lib/db.ts:3412](../../../lib/db.ts#L3412)) **omitted `org_id`** → `null value in column "org_id" violates not-null constraint` on every game/practice create. This was the **exact schema/code-drift class this dictionary exists to surface** (sibling of the Phase-4b rep-installment `org_id` finding). **Fix (2026-06-10, code-only — the column already existed):** `orgId` added to `LeagueGameInput`/`LeaguePracticeInput` and written as `org_id` by `createLeagueGame`/`createPractices` plus the `schedule/generate` and dev-seed direct inserts, all sourced from `ctx.org.id`; tsc clean.
- **`league_seasons.division` (text) ≠ the `league_divisions` table.** The scalar `division` column is the **legacy `age_group` label renamed by migration 093** — a free-text season badge ("U11", "Adult"), still written by the admin form. Structured sub-divisions are the separate `league_divisions` **table**. Classic type-vs-table trap (the same mig 093 also renamed `age_groups`→`divisions` in the Tournaments module and `rep_teams.age_group`→`division`).
- **Registrations are ACCOUNT-LESS.** A `league_registrations` row is an anonymous family submission keyed by **`guardian_email` (plain text, indexed, NOT an `auth.users` FK)** — the public status page looks a family up by email with no login. Contrast tournament registration (team/contact-based) and basic-coach (membership-keyed). `guardian_email` is **non-unique** → the same family can register a player twice (no dedup).
- **Fees are INTERNAL double-entry accounting, never Stripe.** `league_seasons.registration_fee` is display-only; when `auto_generate_fees` is on, approving a reg active creates an `accounting_entries` income row (`source_module='league_registration'`) in a per-season ledger and stamps `league_registrations.fee_entry_id`. **`fee_entry_id` is a loose uuid with NO FK** (the durable link is `accounting_entries.source_module`+`source_entity_id`). No `stripe_*` column exists anywhere in the domain. (Billing-flow narrative + `stripe_prices` → the Stripe/Billing phase; columns documented here.)
- **`league_notification_log` is DEAD/legacy.** Created in mig 020 as the original broadcast log, it has **zero reads/writes** in current code and was **superseded by `league_email_log`**. Naming trap: the admin "Notifications" page (`notifications/page.tsx`) actually writes `league_email_log` via the `/email` route. Different schema (`audience_type`/`audience_label`/`recipient_count` vs `scope`/`audience`/`count_sent`+`count_skipped`).
- **RLS is ENABLED on all 8 tables and mig 020 defines real org-member + public-read policies — but every code path uses `supabaseAdmin` (service role, RLS-bypassing); enforcement is app-layer.** Admin routes gate on `hasCapability(role, caps, 'module_house_league')` **+** `hasModuleEntitlement(org, 'module_house_league')` (the League/Club plan gate) **+**, for writes, role `owner`/`league_admin` (registrar can manage regs but not place/reassign). The lone exception: the **practices** POST/PATCH routes gate on capability+role but **NOT** `hasModuleEntitlement` — a slightly weaker gate than the sibling routes.
- **UK spelling `'cancelled'`** is the CHECK value on both `league_games` and `league_practices` (and `'postponed'` on games is allowed-but-dead) — never US `'canceled'`, which would fail the CHECK. Cancels are **soft** (status flips, row persists); `deleteLeagueTeam` is a hard delete but its FKs SET-NULL registrations and CASCADE games.
- **The `league_practices` recurrence model is the symmetric-`recurrence_group_id` kind, NOT a parent-anchor — so it has NO orphan/anchor bug** (the `rep_team_events` parent-anchor defect this once contrasted was fixed 2026-06-29). All occurrences in a series share one `recurrence_group_id`; `cancelPractice('all')` keys off it alone (catches every member), `'remaining'` adds `scheduled_at >= clicked`. Verified by reading the helper; stated explicitly so a future reader doesn't assume the rep defect exists here.
- **Dev/prod:** all 8 tables are **column-, constraint-, and CHECK-identical** dev↔prod. The **only** divergence is **`league_practices` indexes** (the domain's headline drift): mig `077_league_practices_dev_sync.sql` is **dev-only**, so dev has hand-named indexes incl. a **PARTIAL** recurrence index (`WHERE recurrence_group_id IS NOT NULL`) and a dev-only `schedule_idx(season_id, scheduled_at)`, while prod has auto-named indexes, a **FULL** recurrence index, and **no schedule index**. The `DRIFT_dev_vs_prod.md` "Definition changed (0)" line **masks** this — it diffs by index *name*, so the partial-vs-full difference shows up only as separate add/drop entries. (mig 078's `org_id` + `org_idx` was applied to both.)

---

## `league_seasons`
<!-- dict:table:league_seasons -->

**Purpose:** one row per house-league **season** (e.g. "U11 Summer 2025") — the module's spine. Carries the public slug, registration window, fee + automation flags, waiver, a forward-only status lifecycle, and a transient player-draft working state. Mapped by `mapLeagueSeason` ([lib/db.ts:2904](../../../lib/db.ts#L2904)).

**Gotchas (read first):**
1. **`division` (text) is NOT `league_divisions`** — it's the legacy `age_group` label renamed by mig 093 (a free-text season badge), still written by the admin create form/PATCH ([seasons/route.ts:57](../../../app/api/admin/house-league/seasons/route.ts#L57)). Structured divisions are the separate table.
2. **`status` is a forward-only, single-hop lifecycle enforced in APP code, not by the CHECK.** The CHECK allows all 6 values in any order, but `ALLOWED_TRANSITIONS` ([seasons/[seasonId]/route.ts:21-28](../../../app/api/admin/house-league/seasons/[seasonId]/route.ts#L21-L28)) permits only `draft → registration_open → registration_closed → active → completed → archived`, one hop at a time; `archived` is terminal; `draft → registration_open` requires ≥1 division ([:127-135](../../../app/api/admin/house-league/seasons/[seasonId]/route.ts#L127-L135)). Raw SQL could set an illegal state.
3. **Naming collision:** season `status = 'draft'` (unpublished season) is unrelated to **`draft_state`** (the live player-draft snapshot, gotcha 5).
4. **`auto_generate_fees` posts INTERNAL accounting, not Stripe** (see `fee_entry_id` on `league_registrations`).
5. **`draft_state` (jsonb) is a transient draft-room snapshot** — null when no draft is running, cleared on finalize.
6. **`slug` is client-supplied** (UI auto-derives but allows override); the server only re-validates `[a-z0-9-]` and relies on `UNIQUE(org_id, slug)`, returning **409** on collision — no server-side auto-dedup.

**Fields** (boilerplate `id`, `created_at`, `updated_at` omitted):

<!-- dict:col:league_seasons.org_id -->
**`org_id`** (FK → `organizations.id` ON DELETE CASCADE, NOT NULL) — tenant scope; co-key of `UNIQUE(org_id, slug)`. Tenant isolation is app-layer (`.eq('org_id', ctx.org.id)`) since `supabaseAdmin` bypasses RLS.

<!-- dict:col:league_seasons.name -->
**`name`** (text, NOT NULL) — season display name; ≤120 chars (app-only cap). Feeds the UI's `slugify()` default.

<!-- dict:col:league_seasons.slug -->
**`slug`** (text, NOT NULL) — URL segment for `/{orgSlug}/league/{seasonSlug}`; `UNIQUE(org_id, slug)` [`league_seasons_org_id_slug_key`]. Client-supplied; 409 on collision (gotcha 6). Public lookup `getLeagueSeasonBySlug` ([lib/db.ts:3009](../../../lib/db.ts#L3009)).

<!-- dict:col:league_seasons.sport -->
**`sport`** (text, NOT NULL, default `'softball'`) — free-text sport label, no enum; effectively a single-sport assumption (no code branches on it).

<!-- dict:col:league_seasons.division -->
**`division`** (text, nullable) — **free-text age/division badge** for the whole season ("U11", "Adult"); the legacy `age_group` renamed by mig 093 ([093_divisions_rename.sql:45-48](../../../supabase/migrations/093_divisions_rename.sql#L45-L48)). **NOT** the `league_divisions` table (gotcha 1). Read as a display badge only.

<!-- dict:col:league_seasons.status -->
**`status`** (text, NOT NULL, default `'draft'`; CHECK `draft|registration_open|registration_closed|active|completed|archived`) — lifecycle; forward-only single-hop in app code (gotcha 2). RLS public-read policy keys off the open-or-later subset (`registration_open`/`registration_closed`/`active`/`completed` — excludes both `draft` and `archived`).

<!-- dict:col:league_seasons.description -->
**`description`** (text, nullable) — optional blurb.

<!-- dict:col:league_seasons.registration_fee -->
**`registration_fee`** (numeric, nullable) — **dollars** (not cents); display-only on the form. Drives the auto-generated internal accounting entry (only when `auto_generate_fees` + this is set). _Cross-ref:_ Accounting.

<!-- dict:col:league_seasons.auto_generate_fees -->
**`auto_generate_fees`** (bool, NOT NULL, default false) — when true, approving a reg active auto-creates a `pending` income `accounting_entries` row for `registration_fee` via `createLeagueRegistrationFeeEntry` ([lib/db.ts:3601](../../../lib/db.ts#L3601)). INTERNAL ledger, NOT Stripe; fire-and-forget on the manual-add path.

<!-- dict:col:league_seasons.auto_approve_under_capacity -->
**`auto_approve_under_capacity`** (bool, NOT NULL, default false) — when true, a public submit **under** the division capacity is set `active` immediately; otherwise `pending_review` (see `league_registrations.status`).

<!-- dict:col:league_seasons.auto_promote_waitlist -->
**`auto_promote_waitlist`** (bool, NOT NULL, default false) — when true, declining/withdrawing an active reg auto-promotes `waitlist[0]` → active ([[regId]/route.ts:301-369](../../../app/api/admin/house-league/seasons/[seasonId]/registrations/[regId]/route.ts#L301-L369)).

<!-- dict:col:league_seasons.registration_open_at -->
<!-- dict:col:league_seasons.registration_close_at -->
**`registration_open_at` / `registration_close_at`** (timestamptz, nullable) — informational registration window. **No timestamp-driven automation** opens/closes registration off these (status transitions are manual — verified).

<!-- dict:col:league_seasons.season_start_date -->
<!-- dict:col:league_seasons.season_end_date -->
**`season_start_date` / `season_end_date`** (date, nullable) — informational season dates.

<!-- dict:col:league_seasons.waiver_text -->
**`waiver_text`** (text, nullable) — free-text waiver shown on the public registration form.

<!-- dict:col:league_seasons.draft_state -->
**`draft_state`** (jsonb, nullable; added mig 079) — **transient live player-draft snapshot** (a **rotating** draft assigning registered players to teams — a plain repeating rotation `(pickNumber-1) % len`, **not** serpentine/snake); null = no active draft, cleared on finalize ([draft/route.ts:172](../../../app/api/admin/house-league/seasons/[seasonId]/draft/route.ts#L172)) or when placement runs ([placement/route.ts:114](../../../app/api/admin/house-league/seasons/[seasonId]/placement/route.ts#L114)). Typed `LeagueDraftState` ([lib/types.ts:708-716](../../../lib/types.ts#L708-L716)). Mig 079 self-labels "DEV ONLY / already in prod" but the column is **identical in both envs** — decide from the snapshot, not the migration.

**`draft_state` jsonb key catalog** (`LeagueDraftState`):

| key | meaning |
|---|---|
| `draftId` | session uuid (`crypto.randomUUID()`) |
| `divisionId` | the division being drafted |
| `round` | current round = `ceil(pickNumber / pickOrder.length)` |
| `pickNumber` | 1-based global pick counter |
| `currentTeamId` | team on the clock = `pickOrder[(pickNumber-1) % len]` |
| `pickOrder` | array of team ids (rotation order; the same order repeats every round — not snaked) |
| `picks[]` | committed picks `{round, pickNumber, teamId, registrationId}`; flushed to `league_registrations.team_id` via `bulkAssignTeams` on finalize |

---

## `league_divisions`
<!-- dict:table:league_divisions -->

**Purpose:** structured sub-groups **within** a season (e.g. "Division A") — each with its own capacity, draft, teams, schedule and standings. Distinct from the free-text `league_seasons.division` label and from the Tournaments-module `divisions` table.

**Gotchas (read first):**
1. **The structured table, not `league_seasons.division`** (the text badge) — and not the tournament `divisions` table (which mig 093 renamed from `age_groups`). Same word, three different things.
2. **`capacity` is the soft cap** powering auto-approve/waitlist; **NULL = unlimited**, enforced in app code against the COUNT of `status='active'` regs, not by a DB constraint. App coerces non-positive/non-number `capacity` to NULL, so **`capacity=0` is stored as unlimited**, not a hard zero.
3. **Delete is app-guarded, not DB-guarded** — the DELETE route 409s if **any** `league_registrations` (any status) point at the division ([[divisionId]/route.ts:82-96](../../../app/api/admin/house-league/seasons/[seasonId]/divisions/[divisionId]/route.ts#L82-L96)); the FK itself is `ON DELETE SET NULL` (raw delete would orphan regs to `division_id=NULL`). The lib comment says "active registrations" but the guard is status-agnostic.
4. **No secondary index** — PK `id` only; `season_id` is an unindexed FK (fine at house-league scale). `sort_order` is assigned append-to-end (`= existing count`), no reorder endpoint.

**Fields** (boilerplate `id`, `created_at` omitted):

<!-- dict:col:league_divisions.season_id -->
**`season_id`** (FK → `league_seasons.id` ON DELETE CASCADE, NOT NULL) — owning season; the only scope (divisions inherit org via the season). Unindexed (gotcha 4).

<!-- dict:col:league_divisions.name -->
**`name`** (text, NOT NULL) — division display name; ≤100 chars (app-only).

<!-- dict:col:league_divisions.capacity -->
**`capacity`** (integer, nullable) — soft cap = max **active** registrations; NULL/0 → unlimited (gotcha 2). Consumed by the public register capacity check ([register/route.ts:122-128](../../../app/api/league/[orgSlug]/[seasonSlug]/register/route.ts#L122-L128)).

<!-- dict:col:league_divisions.sort_order -->
**`sort_order`** (integer, NOT NULL, default 0) — display order, append-to-end on create; ties broken by `created_at` (gotcha 4).

---

## `league_teams`
<!-- dict:table:league_teams -->

**Purpose:** an admin-created **roster bucket** inside a division — name/color/coach label that registered players are *placed onto* (via `league_registrations.team_id`). The house-league analogue of tournament `teams` / rep `team_workspaces`, but **not** a registered or billed competitor. Created by `createLeagueTeam` ([lib/db.ts:3149](../../../lib/db.ts#L3149)).

**Gotchas (read first):**
1. **NO `org_id` and NO `updated_at`** — `league_teams` scopes via `season_id → league_seasons.org_id` (a 2-hop), unlike its sibling `league_games` which was denormalized with `org_id` (mig 075). PK `id` only; sorted in-app by `(sort_order, created_at)`.
2. **`coach_name` is FREE TEXT, not an account** — a label, not a FK to `organization_members`/`auth.users`. Distinguishes house-league coaches from the Coaches-Portal operator model.
3. **`deleteLeagueTeam` is a HARD delete** ([lib/db.ts:3180](../../../lib/db.ts#L3180)) — the lib helper has only a code-comment guard; the DELETE route adds a real guard but it **only counts `status='active'` registrations** ([teams/[teamId]/route.ts:75-86](../../../app/api/admin/house-league/seasons/[seasonId]/teams/[teamId]/route.ts#L75-L86)). So deleting a team with no *active* players still **cascade-deletes every game it appears in** (`league_games.home/away_team_id` `ON DELETE CASCADE`) and **SET-NULLs any non-active registrations** (`league_registrations.team_id` `ON DELETE SET NULL`) — silently.
4. **Bulk-create restarts `sort_order` at the array index** — a second bulk insert collides at 0 (no uniqueness).

**Fields** (boilerplate `id`, `created_at` omitted; **no `updated_at`**):

<!-- dict:col:league_teams.season_id -->
**`season_id`** (FK → `league_seasons.id` ON DELETE CASCADE, NOT NULL) — owning season; primary scope (carries org transitively).

<!-- dict:col:league_teams.division_id -->
**`division_id`** (FK → `league_divisions.id` ON DELETE CASCADE, NOT NULL) — the division the team plays in; schedule generation + standings are per-division.

<!-- dict:col:league_teams.name -->
**`name`** (text, NOT NULL) — team display name (trimmed on insert).

<!-- dict:col:league_teams.color -->
**`color`** (text, nullable) — display colour, intended hex (e.g. `#E03030`); no CHECK/validation.

<!-- dict:col:league_teams.coach_name -->
**`coach_name`** (text, nullable) — free-text coach label, display-only, deliberately unlinked (gotcha 2).

<!-- dict:col:league_teams.sort_order -->
**`sort_order`** (integer, NOT NULL, default 0) — manual order within a division (gotcha 4).

---

## `league_games`
<!-- dict:table:league_games -->

**Purpose:** a scheduled game between two `league_teams` in a division — who/when/where, the score, and lifecycle status. Round-robin-generated or added manually, scored by the admin, surfaced on the public schedule and the computed standings. House-league analogue of tournament `games`. Created by `createLeagueGame` ([lib/db.ts:3465](../../../lib/db.ts#L3465)).

**Gotchas (read first):**
1. **`org_id` write-blocking bug — ✓ FIXED 2026-06-10.** `org_id` is `NOT NULL`, no default, **no trigger** (live probe); at commit `6deac4a` `createLeagueGame` ([lib/db.ts:3465](../../../lib/db.ts#L3465)), the `schedule/generate` save ([generate/route.ts:105-117](../../../app/api/admin/house-league/seasons/[seasonId]/schedule/generate/route.ts#L105-L117)), and the dev seed all **omitted** it → NOT-NULL violation on every game create. **Fixed:** all three now write `org_id` from `ctx.org.id` (via `LeagueGameInput.orgId`). The column exists for the 1-hop org-member RLS policy (mig 075) and was backfilled once at migration time.
2. **Status enum is UK-spelled** `scheduled|completed|cancelled|postponed` (CHECK). Code matches exactly. **`'postponed'` is settable ONLY via the admin schedule edit form's status dropdown** ([schedule/page.tsx:233](../../../app/[orgSlug]/admin/house-league/seasons/[seasonId]/schedule/page.tsx#L233) → the PATCH route passes client `status` straight through, [[gameId]/route.ts:54](../../../app/api/admin/house-league/seasons/[seasonId]/schedule/[gameId]/route.ts#L54)) — **not** on create (`createLeagueGame` ignores `status`) and with no automated/lifecycle writer. US `'canceled'` would fail the CHECK.
3. **DELETE is a SOFT-cancel** (`status='cancelled'`), not a hard delete ([[gameId]/route.ts:71-91](../../../app/api/admin/house-league/seasons/[seasonId]/schedule/[gameId]/route.ts#L71-L91)). `getGamesForSeason` excludes cancelled (`.neq('status','cancelled')` at [lib/db.ts:3359](../../../lib/db.ts#L3359)) but `getGamesForDivision` does **not** — though `computeStandings` re-filters to `completed` anyway.
4. **Scoring auto-completes:** entering BOTH scores **with no explicit `status` in the PATCH body** (the `status===undefined` guard) sets `status='completed'` (the PATCH route, [[gameId]/route.ts:59-61](../../../app/api/admin/house-league/seasons/[seasonId]/schedule/[gameId]/route.ts#L59-L61)). The helper `enterGameResult` ([lib/db.ts:3496](../../../lib/db.ts#L3496)) does the same but appears **dead** (no route caller; PATCH scores inline).
5. **`scheduled_at` is built from `new Date(\`${date}T${time}\`)`** ([schedule/route.ts:96-97](../../../app/api/admin/house-league/seasons/[seasonId]/schedule/route.ts#L96-L97)) — uses the **server's** timezone, so the stored UTC instant depends on server TZ, not the org's (DST/offset trap; shared with practices).
6. **Boundary:** NOT tournament `games` — that `GameStatus` has `'submitted'` and no `'postponed'` ([types.ts:498](../../../lib/types.ts#L498) vs `LeagueGameStatus` [types.ts:698-699](../../../lib/types.ts#L698-L699)). Stale doc to ignore/clean: `AgentPlaybook.tsx:243` still claims games have "no direct org_id".

**Fields** (boilerplate `id`, `created_at`, `updated_at` omitted):

<!-- dict:col:league_games.season_id -->
**`season_id`** (FK → `league_seasons.id` ON DELETE CASCADE, NOT NULL) — parent season; indexed (`season_idx`, and `schedule_idx(season_id, scheduled_at)`).

<!-- dict:col:league_games.division_id -->
**`division_id`** (FK → `league_divisions.id` ON DELETE CASCADE, NOT NULL) — the division; generation + standings are per-division. Indexed (`division_idx`).

<!-- dict:col:league_games.home_team_id -->
<!-- dict:col:league_games.away_team_id -->
**`home_team_id` / `away_team_id`** (FK → `league_teams.id` ON DELETE CASCADE, NOT NULL) — the two teams; `ON DELETE CASCADE` means deleting a team deletes its games (gotcha, `league_teams` #3). The schedule POST rejects home==away.

<!-- dict:col:league_games.scheduled_at -->
**`scheduled_at`** (timestamptz, nullable) — game date/time; null games bucket under "Unscheduled" on the public schedule. Server-TZ construction trap (gotcha 5). Part of `schedule_idx`.

<!-- dict:col:league_games.location -->
**`location`** (text, nullable) — free-text venue; **not** an FK to the org's diamonds/venues tables.

<!-- dict:col:league_games.home_score -->
<!-- dict:col:league_games.away_score -->
**`home_score` / `away_score`** (integer, nullable) — runs/points; NULL until scored. Both present → `status='completed'`. `computeStandings` coalesces null→0 but counts only `completed` games.

<!-- dict:col:league_games.status -->
**`status`** (text, NOT NULL, default `'scheduled'`; CHECK `scheduled|completed|cancelled|postponed`) — lifecycle (gotchas 2-4). PATCH passes a client-supplied status straight through (`updateLeagueGame` [lib/db.ts:3482](../../../lib/db.ts#L3482)).

<!-- dict:col:league_games.notes -->
**`notes`** (text, nullable) — free-text game notes.

<!-- dict:col:league_games.org_id -->
**`org_id`** (FK → `organizations.id` ON DELETE CASCADE, NOT NULL; index `org_idx`) — denormalized org for the 1-hop RLS policy (mig 075). Now written by all insert paths from `ctx.org.id` (fixed 2026-06-10 — gotcha 1; was previously read-only by RLS → the write-blocking bug). Redundant with `season_id → league_seasons.org_id`.

---

## `league_registrations`
<!-- dict:table:league_registrations -->

**Purpose:** one **player/family registration** to a season — the central intake + lifecycle unit (player + guardian, an admin review/waitlist lifecycle, optional team placement, and a link to the internal fee ledger entry). Created by `createRegistration` ([lib/db.ts:3273](../../../lib/db.ts#L3273)); mapped by `mapLeagueRegistration` ([lib/db.ts:2953](../../../lib/db.ts#L2953)).

**Gotchas (read first):**
1. **Account-less, keyed by `guardian_email`** (text, NOT an `auth.users` FK; indexed `guardian_idx`). The public status page looks up by email with **no login** ([status/page.tsx:51-56](../../../app/[orgSlug]/league/[seasonSlug]/status/page.tsx#L51-L56)). `guardian_email` is **non-unique** → duplicate registrations are possible (no dedup found).
2. **NO `created_at` — `registered_at` is the create stamp** (NN, default `now()`). Never written explicitly; admin-manual rows get `now()`, not a back-dated date.
3. **Two auto-status engines, both can fire.** (a) At public submit: under-capacity + `auto_approve_under_capacity` → `active`; under-capacity without it → `pending_review`; over-capacity → `waitlisted` ([register/route.ts:112-135](../../../app/api/league/[orgSlug]/[seasonSlug]/register/route.ts#L112-L135)). (b) `auto_promote_waitlist` promotes `waitlist[0]` → active on decline/withdraw. **Capacity counts `status='active'` only**; `pending_review` doesn't consume it. **`admin_manual` create defaults `active` and SKIPS the capacity engine** — an admin can over-fill.
4. **`waitlist_position` is hand-maintained, race-prone, per-DIVISION.** No DB sequence; `compactWaitlist` decrements every position past a vacated slot via a fan-out of per-row UPDATEs ([[regId]/route.ts:70-89](../../../app/api/admin/house-league/seasons/[seasonId]/registrations/[regId]/route.ts#L70-L89)). `updateRegistrationStatus` auto-NULLs the position whenever status leaves `'waitlisted'` ([lib/db.ts:3298](../../../lib/db.ts#L3298)).
5. **`fee_entry_id` is a LOOSE uuid (no FK)** → `accounting_entries.id`; set when a fee entry is created — either auto on approve / manual-active-create (requires `auto_generate_fees` + `registration_fee`) **or** when an admin toggles `registration_fee_paid=true` with `registration_fee` set (**no `auto_generate_fees` needed**, [[regId]/route.ts:144](../../../app/api/admin/house-league/seasons/[seasonId]/registrations/[regId]/route.ts#L144)). Often NULL. Internal ledger, never Stripe (domain gotcha; cross-ref Accounting).
6. **`division_id` is nullable** but several flows require it (public submit forces a resolvable division; admin create requires `divisionId`; you can't waitlist a division-less reg). `ON DELETE SET NULL`.
7. **Role split:** `league_registrar` can change status/feePaid/adminNotes; only `owner`/`league_admin` can reassign division/team, create manual regs, or run placement/draft.

**Fields** (boilerplate `id`, `updated_at` omitted; **no `created_at` — see `registered_at`**):

<!-- dict:col:league_registrations.season_id -->
**`season_id`** (FK → `league_seasons.id` ON DELETE CASCADE, NOT NULL) — parent season; scopes all admin queries + the public status lookup. Indexed (`season_idx`, `status_idx(season_id, status)`).

<!-- dict:col:league_registrations.division_id -->
**`division_id`** (FK → `league_divisions.id` ON DELETE SET NULL, nullable) — division (reassignable; drives capacity/waitlist + draft pools). Indexed (`division_idx`). Gotcha 6.

<!-- dict:col:league_registrations.player_first_name -->
<!-- dict:col:league_registrations.player_last_name -->
**`player_first_name` / `player_last_name`** (text, NOT NULL) — the registered player; public form trims + caps at 80; admin search uses `ilike`.

<!-- dict:col:league_registrations.player_date_of_birth -->
**`player_date_of_birth`** (date, nullable) — DOB for age-group context; not server-validated.

<!-- dict:col:league_registrations.player_jersey_pref -->
**`player_jersey_pref`** (text, nullable) — jersey number/size preference; public form caps at 3 chars (implying a number) but it's plain text.

<!-- dict:col:league_registrations.player_position_pref -->
**`player_position_pref`** (text, nullable) — preferred position; capped 60 on the public form.

<!-- dict:col:league_registrations.player_notes -->
**`player_notes`** (text, nullable) — **guardian-supplied** free text (experience/medical), may be shown back to the family. **Distinct from `admin_notes`** (internal). Capped 500 on the public form.

<!-- dict:col:league_registrations.guardian_first_name -->
<!-- dict:col:league_registrations.guardian_last_name -->
**`guardian_first_name` / `guardian_last_name`** (text, NOT NULL) — the responsible adult; capped 80 on the public form.

<!-- dict:col:league_registrations.guardian_email -->
**`guardian_email`** (text, NOT NULL; indexed `guardian_idx`, **non-unique**) — **the de-facto family identity** for this account-less module (gotcha 1). All lifecycle emails go here; the public status page looks up by it (lowercased at lookup, stored as-submitted → mixed-case dups possible).

<!-- dict:col:league_registrations.guardian_phone -->
**`guardian_phone`** (text, nullable) — capped 30 on the public form; no format validation.

<!-- dict:col:league_registrations.status -->
**`status`** (text, NOT NULL, default `'pending_review'`; CHECK `pending_review|active|waitlisted|declined|withdrawn`) — lifecycle (gotcha 3). Spellings: `pending_review` (underscore), `waitlisted` (not "waitlist"), `withdrawn`. The public status page renders only active/pending_review/waitlisted and **hides declined/withdrawn** from the family.

<!-- dict:col:league_registrations.waitlist_position -->
**`waitlist_position`** (integer, nullable) — 1-based queue slot when `waitlisted`; NULL otherwise; per-division, app-maintained, race-prone (gotcha 4).

<!-- dict:col:league_registrations.team_id -->
**`team_id`** (FK → `league_teams.id` ON DELETE SET NULL, nullable) — the placed team (set by placement/draft, [placement/route.ts](../../../app/api/admin/house-league/seasons/[seasonId]/placement/route.ts) → `assignRegistrationToTeam` [lib/db.ts:3313](../../../lib/db.ts#L3313) / draft finalize → `bulkAssignTeams` [lib/db.ts:3320](../../../lib/db.ts#L3320)); NULL until placement. The **randomize/clear** flows only touch `active` regs, but the manual **assign/bulk_assign** actions place any reg by id with **no status guard** — a waitlisted/pending reg can be given a `team_id`.

<!-- dict:col:league_registrations.registration_fee_paid -->
**`registration_fee_paid`** (bool, NOT NULL, default false) — admin-toggled payment flag, kept in sync with the linked ledger entry's posted/pending status. Toggling true with no existing entry creates a `posted` `accounting_entries` row ([[regId]/route.ts:130-155](../../../app/api/admin/house-league/seasons/[seasonId]/registrations/[regId]/route.ts#L130-L155)). Manual flag, NOT a payment processor.

<!-- dict:col:league_registrations.fee_entry_id -->
**`fee_entry_id`** (uuid, nullable, **NO FK**) → `accounting_entries.id` for this reg's fee; back-filled by `createLeagueRegistrationFeeEntry` ([lib/db.ts:3601](../../../lib/db.ts#L3601)). Durable link is `accounting_entries.source_module='league_registration'`+`source_entity_id=regId`. Often NULL (gotcha 5). _Cross-ref:_ Accounting / Stripe phase.

<!-- dict:col:league_registrations.admin_notes -->
**`admin_notes`** (text, nullable) — internal admin-only notes, **never** shown publicly; distinct from guardian `player_notes`. `canManageRegs`-gated.

<!-- dict:col:league_registrations.source -->
**`source`** (text, NOT NULL, default `'public_form'`; CHECK `public_form|admin_manual`) — provenance; `admin_manual` rows skip the capacity/waitlist engine (gotcha 3).

<!-- dict:col:league_registrations.registered_at -->
**`registered_at`** (timestamptz, NOT NULL, default `now()`) — **the effective create stamp** (no `created_at` column exists); drives default list ordering (newest first). Never written by code; admin-manual rows are not back-dated (gotcha 2).

---

## `league_practices`
<!-- dict:table:league_practices -->

**Purpose:** a team's practice slot (time/place), optionally part of a recurring series. Insert-only + soft-cancel; helpers `createPractices` (batch) / `cancelPractice` ([lib/db.ts:3412](../../../lib/db.ts#L3412), [:3429](../../../lib/db.ts#L3429)).

**Gotchas (read first):**
1. **`org_id` write-blocking bug — ✓ FIXED 2026-06-10** — same class as `league_games`: `org_id` is `NOT NULL`, no default, no trigger (live probe); at commit `6deac4a` `createPractices` omitted it ([lib/db.ts:3412](../../../lib/db.ts#L3412)) → NOT-NULL violation on every practice create. **Fixed:** `createPractices` now writes `org_id` (via `LeaguePracticeInput.orgId`, from `ctx.org.id`). (Domain gotcha 1.)
2. **Insert-only + SOFT-cancel — no edit, no hard delete.** Only `get`/`create`/`cancel` helpers exist; `cancelPractice` flips `status='cancelled'` (the row persists). The `[practiceId]` route accepts only `action:'cancel'`.
3. **Recurrence is symmetric `recurrence_group_id`, NOT a parent-anchor — NO orphan bug** (the `rep_team_events` parent-anchor defect this once contrasted was fixed 2026-06-29). All occurrences share one `recurrence_group_id` (a plain uuid, not an FK/unique); `cancelPractice('all')` matches by it alone, `'remaining'` adds `.gte('scheduled_at', clicked)` (≥, so it includes the clicked one). Series are created by the route assigning one `randomUUID()` to a batch.
4. **`status` CHECK is only `scheduled|cancelled`** — narrower than games (no `completed`/`postponed`). UK `'cancelled'`.
5. **Weaker auth gate:** the practices POST/PATCH routes gate on capability + role but **not** `hasModuleEntitlement('module_house_league')` (the other league routes do).
6. **`scheduled_at` may be NULL** yet `cancelPractice`'s `'remaining'` path uses `p.scheduled_at!` (non-null assertion) — a null anchor would compare against null. Timestamps are built as naive local strings (server-TZ trap, shared with games).

**Fields** (boilerplate `id`, `created_at`, `updated_at` omitted):

<!-- dict:col:league_practices.season_id -->
**`season_id`** (FK → `league_seasons.id` ON DELETE CASCADE, NOT NULL) — parent season.

<!-- dict:col:league_practices.division_id -->
**`division_id`** (FK → `league_divisions.id` ON DELETE SET NULL, nullable) — informational division (the row is team-scoped); deleting a division nulls the link, keeps the practice.

<!-- dict:col:league_practices.team_id -->
**`team_id`** (FK → `league_teams.id` ON DELETE CASCADE, NOT NULL) — the practicing team (the row's primary subject).

<!-- dict:col:league_practices.scheduled_at -->
**`scheduled_at`** (timestamptz, nullable) — practice start; `'remaining'`-cancel anchor (gotcha 6).

<!-- dict:col:league_practices.ends_at -->
**`ends_at`** (timestamptz, nullable) — end time; required for recurring series, optional for a single practice.

<!-- dict:col:league_practices.location -->
**`location`** (text, nullable) — free-text venue (not an FK).

<!-- dict:col:league_practices.notes -->
**`notes`** (text, nullable) — free-text admin notes.

<!-- dict:col:league_practices.status -->
**`status`** (text, NOT NULL, default `'scheduled'`; CHECK `scheduled|cancelled`) — soft-cancel only (gotchas 2, 4).

<!-- dict:col:league_practices.recurrence_group_id -->
**`recurrence_group_id`** (uuid, nullable; **not an FK, not unique**) — groups a recurring series (one `randomUUID()` per series); NULL for a one-off. Bulk cancel keys off it (gotcha 3). **Index drift:** dev `recurrence_idx` is **PARTIAL** (`WHERE … IS NOT NULL`), prod `recurrence_group_id_idx` is **FULL** (see dev/prod note below).

<!-- dict:col:league_practices.org_id -->
**`org_id`** (FK → `organizations.id` ON DELETE CASCADE, NOT NULL; index `org_idx` in both envs, mig 078) — denormalized org; now written by `createPractices` from `ctx.org.id` (fixed 2026-06-10 — gotcha 1; was previously unwritten → the write-blocking bug).

**Dev/prod (headline drift):** columns identical; **indexes differ** — dev (mig 077, dev-only): `org_idx`, `recurrence_idx` (PARTIAL), `schedule_idx(season_id, scheduled_at)`, `season_idx`, `team_idx`. Prod: `org_idx`, `recurrence_group_id_idx` (FULL), `season_id_idx`, `team_id_idx` — **no `schedule_idx`**, recurrence index FULL not PARTIAL, three indexes name-shifted. `DRIFT_dev_vs_prod.md`'s "Definition changed (0)" masks the partial-vs-full difference (it diffs by name).

---

## `league_email_log`
<!-- dict:table:league_email_log -->

**Purpose:** the **live** audit log of house-league bulk-email broadcasts — one row per admin "send" (who, targeting scope/audience, sent vs skipped counts). Written by `insertLeagueEmailLog` ([lib/db.ts:3198](../../../lib/db.ts#L3198)), read by `getLeagueEmailLog` ([lib/db.ts:3221](../../../lib/db.ts#L3221)); sole caller is the broadcast route `email/route.ts`.

**Gotchas (read first):**
1. **This is the LIVE log — `league_notification_log` is its dead predecessor.** The admin "Notifications" page (`notifications/page.tsx`) writes **here** via the `/email` endpoint.
2. **`scope` vs `audience` are different.** `scope` = machine target (`all|division|team|status`); `audience` = a human label derived from scope+status. For **division/team** scope, `audience` falls through to the raw scope word — **the log does NOT capture WHICH division/team** was emailed ([email/route.ts:115-119](../../../app/api/admin/house-league/seasons/[seasonId]/email/route.ts#L115-L119)).
3. **`count_skipped` conflates two reasons** — "no guardian email" and "send threw" both increment it ([email/route.ts:97,108-110](../../../app/api/admin/house-league/seasons/[seasonId]/email/route.ts#L97)).
4. **Logging is best-effort, AFTER send** — wrapped in try/catch that only `console.error`s, so a successful broadcast whose log write fails is silently unrecorded.

**Fields** (boilerplate `id` omitted):

<!-- dict:col:league_email_log.org_id -->
**`org_id`** (FK → `organizations.id` ON DELETE CASCADE, NOT NULL) — owning org.

<!-- dict:col:league_email_log.season_id -->
**`season_id`** (FK → `league_seasons.id` ON DELETE CASCADE, NOT NULL) — the targeted season; the read filter (`getLeagueEmailLog`, newest-50).

<!-- dict:col:league_email_log.sent_by -->
**`sent_by`** (FK → `auth.users.id`, NOT NULL) — who triggered the broadcast. (Snapshot shows `foreign_table:null` — cross-schema introspection gap; the FK to `auth.users` is real, confirmed via `pg_get_constraintdef`.) **NOT NULL here vs nullable in `league_notification_log`.**

<!-- dict:col:league_email_log.sent_at -->
**`sent_at`** (timestamptz, NOT NULL, default `now()`) — dispatch time; DB-defaulted (never set in code); the history ordering key.

<!-- dict:col:league_email_log.subject -->
**`subject`** (text, NOT NULL) — the broadcast subject line.

<!-- dict:col:league_email_log.scope -->
**`scope`** (text, NOT NULL) — machine target `all|division|team|status` (validated in the route, **no DB CHECK**).

<!-- dict:col:league_email_log.audience -->
**`audience`** (text, NOT NULL) — human audience label derived from scope+status (gotcha 2).

<!-- dict:col:league_email_log.count_sent -->
**`count_sent`** (integer, NOT NULL, default 0) — recipients successfully emailed.

<!-- dict:col:league_email_log.count_skipped -->
**`count_skipped`** (integer, NOT NULL, default 0) — recipients skipped; conflates no-email + send-failure (gotcha 3).

---

## `league_notification_log`
<!-- dict:table:league_notification_log -->

**Purpose:** **LEGACY / DEAD table.** Created in mig 020 as the original house-league broadcast log ("records each bulk email dispatch"), **superseded by `league_email_log`**, with **zero reads/writes** in current code (verified repo-wide). Documented so a future implementer doesn't wire to the wrong table — or knows it's safe to drop.

**Gotchas (read first):**
1. **Dead** — no helper, route, or UI touches it; the only references are mig 020, the schema mirror/snapshots, and review docs. The live log is `league_email_log`.
2. **Schema diverges from the live log** — `audience_type`/`audience_label`/`recipient_count` (single count) here vs `scope`/`audience`/`count_sent`+`count_skipped` on `league_email_log`. It also **lacks `org_id`** (only `season_id`), relying on the 2-hop RLS chain mig 078 removed elsewhere; and `sent_by` is **nullable** here (vs NOT NULL on the live log). Ironically, `audience_label` was *meant* to capture the division/team name the live log drops.

**Fields** (boilerplate `id` omitted; all read/written by **NOTHING** in current code):

<!-- dict:col:league_notification_log.season_id -->
**`season_id`** (FK → `league_seasons.id` ON DELETE CASCADE, NOT NULL) — the only scope (no `org_id`).

<!-- dict:col:league_notification_log.sent_by -->
**`sent_by`** (FK → `auth.users.id`, nullable — cross-schema gap; asymmetry vs `league_email_log.sent_by` NOT NULL).

<!-- dict:col:league_notification_log.audience_type -->
**`audience_type`** (text, NOT NULL) — superseded analogue of `league_email_log.scope`.

<!-- dict:col:league_notification_log.audience_label -->
**`audience_label`** (text, nullable) — analogue of `league_email_log.audience` (intended to hold the division/team name).

<!-- dict:col:league_notification_log.subject -->
**`subject`** (text, NOT NULL) — the broadcast subject.

<!-- dict:col:league_notification_log.recipient_count -->
**`recipient_count`** (integer, NOT NULL) — single total count (vs the live log's sent/skipped split).

<!-- dict:col:league_notification_log.sent_at -->
**`sent_at`** (timestamptz, NOT NULL, default `now()`) — dispatch time.

---

*End of League / house-league (Phase 5 — 8 tables). Cross-refs: registration/season fees → Accounting (`accounting_entries`/`accounting_ledgers`, internal double-entry) and the Stripe/Billing phase (no `stripe_*` columns here); the two comms-log tables are league-only and independent of the platform `notifications`/`email_sends` tables (Notifications & Push phase). Boundary: `league_divisions`/`league_teams`/`league_games` are the house-league siblings of the Tournaments-domain `divisions`/`teams`/`games`, and are distinct from the Rep-teams (`rep_*`) module.*

---

# Domain: Accounting

The org's **internal double-entry bookkeeping** plus two satellites filed here by the coverage classifier. **Three sub-systems, distinct despite sharing a domain:** (1) the **ledger** — `accounting_ledgers` (one per org/tournament/team/league-season) holding `accounting_entries` (income/expense/transfer lines), paired transfers via the `create_accounting_transfer` RPC; (2) the **shared chart of accounts + org budget** — `budget_categories` → `budget_items` (a library co-owned with the Rep finance team budget) feeding `org_budget_lines` (annual, `season_year`-keyed) → `org_budget_periods`; (3) the **billing data-retention lifecycle** — `billing_retention_intents` + `billing_retained_records`, which soft-retain an org's data on downgrade/cancellation, then warn → pending-purge → restore. **All money is internal double-entry — NO `stripe_*` columns anywhere** (the Stripe billing *trigger* that fires retention/cancellation is the Stripe/Billing phase; the columns + mechanics are here). The Rep finance (`rep_*`) and League (`league_*`) domains are **consumers** of this ledger/chart — cross-referenced, not redocumented.

> _Last verified: 2026-06-10 @ snapshot 2026-06-10, commit `cbcf7c7` (branch `feat/free-tier-coaches`). Working tree clean — file:line refs match the committed tree. All 9 tables are column-, constraint-, CHECK-, and index-identical dev↔prod (zero drift). Live `information_schema`/`pg_trigger` probe (2026-06-10, dev+prod): **NO triggers on any accounting table** — `updated_at` is code-maintained, double-entry integrity is RPC+CHECK-enforced (not trigger)._

### Gotchas first (the cross-cutting traps)

- **Money is DOLLARS, never integer cents** — every amount is `numeric` dollars-and-cents; `mapEntry` does `Number(row.amount)` with **no `*100`/`/100`** anywhere ([lib/db.ts:2880](../../../lib/db.ts#L2880)). `accounting_entries.amount` is `numeric(12,2)`; budget amounts are `numeric(10,2)`. Consistent with the Rep-finance convention.
- **`accounting_entries.amount` is ALWAYS positive; direction is `entry_type`, not sign.** CHECK `amount > 0`. Inflow = `income`+`transfer_in`; outflow = `expense`+`transfer_out` ([getLedgerSummary lib/db.ts:2847](../../../lib/db.ts#L2847)). Never store a negative entry.
- **Transfers are paired legs created ONLY by the `create_accounting_transfer` RPC** — never by hand. The manual entry route restricts `entry_type` to `income|expense` ([ledgers/[ledgerId]/entries/route.ts:11](../../../app/api/admin/accounting/ledgers/[ledgerId]/entries/route.ts#L11)); the RPC inserts a `transfer_out`+`transfer_in` pair cross-linked via the `linked_entry_id` self-FK (see the Functions note). To change a transfer you **void and re-create** (the edit route refuses to touch a transfer leg).
- **`void` is a soft-delete** — DELETE sets `status='void'` and keeps the row for audit; `getLedgerSummary` excludes void. There is no hard delete of an entry.
- **The chart of accounts (`budget_categories`/`budget_items`) is SHARED and the `org_id IS NULL` rows are platform-seeded read-only defaults.** An org's effective list = defaults ∪ its own customs (`.or('org_id.is.null,org_id.eq.<orgId>')`). The **same** categories/items feed BOTH `org_budget_lines` (this domain) and `rep_budget_lines` (Rep finance) — cross-domain.
- **THE DUAL-BUDGET-LINE TRAP (org side).** `org_budget_lines` is the ORG annual budget keyed by **integer `season_year`** (e.g. 2026); `rep_budget_lines` (Rep finance, documented) is the per-team budget keyed by **uuid `program_year_id`**. Different tables sharing the chart. The FKs that point at THIS table: `rep_cost_allocations.source_budget_line_id` + `rep_team_payment_requests.budget_line_id` → `org_budget_lines`.
- **`accounting_entries.category` and `org_payees` exclusivity are convention, not constraints.** `category` is **free text** (not an FK to `budget_categories`); `payee_id` (→`org_payees`) vs `payee_payer` (free text) are **mutually exclusive only by UI convention — no DB CHECK**. And **budget-vs-actual does NOT match actuals per line/category** — it sums org-wide posted `expense` entries for the year and subtracts from the total budget ("not yet mapped per-line — Phase J").
- **The billing-retention lifecycle lives on `billing_retained_records.retained_state`, NOT on the intent.** `billing_retention_intents.status` is **frozen at `'applied'`** (4 of 5 enum values are dead). The **sweep is MANUAL** (`processBillingRetentionExpiry`, no pg_cron) and only advances `retained_inactive → pending_purge` + sends warnings; **`'purged'` is a SUPERSEDE marker, not data deletion** (actual deletion only via the super-admin delete-org path).
- **RLS is ENABLED with real org-member/owner-treasurer policies on every table — but every runtime path uses `supabaseAdmin` (service-role, RLS-bypassing).** Auth is **app-layer**: org accounting routes gate on `module_accounting` capability+entitlement + role `owner`/`treasurer` (items also allow `coach`); the retention routes are **platform-admin** (`manage_billing` / `super_admin`). The RLS policies are defense-in-depth.
- **Dev/prod:** all 9 tables zero-drift (columns, constraints, CHECKs, indexes, RLS identical).

---

## `accounting_ledgers`
<!-- dict:table:accounting_ledgers -->

**Purpose:** the **container** side of the org's double-entry books — one ledger per financial entity: the org's general ledger (`entity_type='org'`, `entity_id` NULL), or a per-tournament / per-rep-team / per-league-season ledger. Mapped by `mapLedger` ([lib/db.ts:2861](../../../lib/db.ts#L2861)).

**Gotchas (read first):**
1. **`UNIQUE(org_id, entity_type, entity_id)`** — one ledger per entity; the duplicate-insert path maps Postgres `23505` → **409** ([ledgers/route.ts:58](../../../app/api/admin/accounting/ledgers/route.ts#L58)). `getOrCreate*` helpers ([lib/db.ts](../../../lib/db.ts): org `:2682`, tournament `:2713`, rep-team `:2734`, league-season `:3635`) find-or-create idempotently. **Caveat (J4-020):** this base key treats NULLs as DISTINCT, so it does NOT block a second `(org,'org',NULL)` row — the **partial unique index `accounting_ledgers_one_org_general` (migration 127)** does, enforcing one NULL-entity org General per org. The base key + the 409 guard only ever fired for non-NULL entities.
2. **`entity_type='team'` means a REP team (not "rep_team").** CHECK `entity_type ∈ ('org','tournament','team','league_season')`. The **org General ledger** is the row with `entity_type='org'` AND `entity_id IS NULL` (found via `.is('entity_id', null)`, [lib/db.ts](../../../lib/db.ts)). **J4-020:** a user-created org *sub*-ledger (sponsorships, operating costs) is ALSO `entity_type='org'` but carries a **generated non-NULL `entity_id`** ([ledgers/route.ts](../../../app/api/admin/accounting/ledgers/route.ts) `randomUUID()`), so it's distinct from the singular General. Tell them apart by `entity_id` null-ness, not `entity_type` (the UI's "Org sub-ledger" badge keys on `entityType==='org'`, which covers both).
3. **The manual-create POST only allows `org`/`tournament`** — `team`/`league_season` ledgers come only from their module helpers ([ledgers/route.ts:47](../../../app/api/admin/accounting/ledgers/route.ts#L47)).
4. **`currency` is effectively CAD-only** and **`is_archived` is write-never** — both have no code that varies/sets them (archiving a ledger is unimplemented; `getOrgAllLedgers` filters `is_archived=false` but nothing sets it true).

**Fields** (boilerplate `id`, `created_at` omitted):

<!-- dict:col:accounting_ledgers.org_id -->
**`org_id`** (FK → `organizations.id` ON DELETE CASCADE, NOT NULL) — owning org; part of the UNIQUE key.

<!-- dict:col:accounting_ledgers.entity_type -->
**`entity_type`** (text, NOT NULL; CHECK `org|tournament|team|league_season`) — which kind of entity this ledger backs (`team`=rep team). Gotcha 2.

<!-- dict:col:accounting_ledgers.entity_id -->
**`entity_id`** (uuid, nullable) — the entity's id (tournament/rep-team/league-season); **NULL only for the singular org General ledger**. A user-created org *sub*-ledger gets a **generated non-NULL uuid** (J4-020) so it can't collide with the General. Logical ref (no DB FK; sub-ledger uuids are synthetic, not pointing at any row). Part of the UNIQUE key; the General's uniqueness is additionally enforced by the partial index `accounting_ledgers_one_org_general` (gotcha 1).

<!-- dict:col:accounting_ledgers.name -->
**`name`** (text, NOT NULL) — display label (org ledger = `${orgName} — General`).

<!-- dict:col:accounting_ledgers.currency -->
**`currency`** (char(3), NOT NULL, default `'CAD'`) — never written by app code; effectively CAD-only (gotcha 4).

<!-- dict:col:accounting_ledgers.is_archived -->
**`is_archived`** (bool, NOT NULL, default false) — soft-hide flag; **no code path sets it true** (archiving unimplemented). `getOrgAllLedgers` filters it.

---

## `accounting_entries`
<!-- dict:table:accounting_entries -->

**Purpose:** the **line-item** side of the ledger — every income/expense/transfer line. `amount` is always positive; direction is `entry_type`. Cross-module income (e.g. league reg fees) lands here via `source_module`/`source_entity_id`. Mapped by `mapEntry` ([lib/db.ts:2880](../../../lib/db.ts#L2880)).

**Gotchas (read first):**
1. **`amount > 0` always; direction via `entry_type`** (CHECK `income|expense|transfer_in|transfer_out`). Dollars (`numeric(12,2)`), not cents; route caps ≤ 999999.99.
2. **`transfer_in`/`transfer_out` only via the `create_accounting_transfer` RPC** (paired legs, `linked_entry_id` cross-linked). Manual POST = `income|expense` only; the edit PATCH refuses transfer legs → "void and re-create" ([ledgers/[ledgerId]/entries/[entryId]/route.ts:50-54](../../../app/api/admin/accounting/ledgers/[ledgerId]/entries/[entryId]/route.ts#L50-L54)).
3. **DELETE is a soft-`void`** — `voidEntry` sets `status='void'`, row preserved ([lib/db.ts:2823](../../../lib/db.ts#L2823)); `getLedgerSummary` excludes void ([:2839](../../../lib/db.ts#L2839)). Already-void can't be re-voided/edited.
4. **`category` is FREE TEXT (no FK)** — and budget-vs-actual does **not** join it to `budget_items` by name (it sums org-wide expenses). Don't treat `category` as a chart-of-accounts key.
5. **`payee_id` (→`org_payees`) vs `payee_payer` (text) are mutually exclusive by CONVENTION only — no DB CHECK.**
6. **`source_module`/`source_entity_id` = cross-module provenance, but only `'league_registration'` is actually written** at this commit ([lib/db.ts:3677](../../../lib/db.ts#L3677)); the migration's `module_house_league` example is aspirational/unimplemented.

**Fields** (boilerplate `id`, `created_at`, `updated_at` omitted):

<!-- dict:col:accounting_entries.ledger_id -->
**`ledger_id`** (FK → `accounting_ledgers.id`, NOT NULL) — owning ledger; indexed `(ledger_id, entry_date DESC)` + `(ledger_id)`.

<!-- dict:col:accounting_entries.entry_date -->
**`entry_date`** (date, NOT NULL) — business date (not timestamp); validated ≤ 1 year future. League fee defaults to today.

<!-- dict:col:accounting_entries.description -->
**`description`** (text, NOT NULL) — line description (≤500 chars app-side).

<!-- dict:col:accounting_entries.amount -->
**`amount`** (numeric(12,2), NOT NULL, CHECK `> 0`) — dollars, always positive (gotcha 1).

<!-- dict:col:accounting_entries.entry_type -->
**`entry_type`** (text, NOT NULL; CHECK `income|expense|transfer_in|transfer_out`) — direction/kind; `income`/`expense` single-sided, `transfer_*` are the paired RPC legs (gotcha 2).

<!-- dict:col:accounting_entries.status -->
**`status`** (text, NOT NULL, default `'posted'`; CHECK `pending|posted|void`) — `pending`=receivable/payable unsettled, `posted`=settled, `void`=soft-cancelled (row kept). Manual create/edit allow only `posted|pending`.

<!-- dict:col:accounting_entries.category -->
**`category`** (text, nullable) — free-text label, ≤100 chars; NOT an FK (gotcha 4). League fee writes `'registration_fee'`; rep transfers write `'team_payment_to_org'`/`'team_charge_to_org'`.

<!-- dict:col:accounting_entries.linked_entry_id -->
**`linked_entry_id`** (self-FK → `accounting_entries.id` ON DELETE SET NULL, nullable) — pairs the two transfer legs (each points at the other); populated only for `transfer_*` rows (set by the RPC).

<!-- dict:col:accounting_entries.source_module -->
<!-- dict:col:accounting_entries.source_entity_id -->
**`source_module` / `source_entity_id`** (text / uuid, nullable) — cross-module provenance; only `'league_registration'` + the `league_registrations.id` are written today (back-linked via `league_registrations.fee_entry_id`). Logical ref, no FK.

<!-- dict:col:accounting_entries.created_by -->
**`created_by`** (FK → `auth.users.id`, nullable; cross-schema gap, ON DELETE NO ACTION) — who created the entry (or `p_created_by` from the RPC).

<!-- dict:col:accounting_entries.payment_method -->
**`payment_method`** (text, nullable) — free-text method (cheque/e-transfer), ≤100 chars (added mig 033).

<!-- dict:col:accounting_entries.payee_id -->
<!-- dict:col:accounting_entries.payee_payer -->
**`payee_id`** (FK → `org_payees.id`, nullable) / **`payee_payer`** (text, nullable, ≤200) — structured-vs-freetext payee/payer, mutually exclusive **by convention** (gotcha 5; added mig 033).

<!-- dict:col:accounting_entries.notes -->
**`notes`** (text, nullable) — free-text internal notes, ≤2000 chars (added mig 033).

---

## `org_payees`
<!-- dict:table:org_payees -->

**Purpose:** a reusable directory of payees/payers (vendors, people) the org pays or is paid by — a typeahead FK target for `accounting_entries.payee_id` and `rep_team_expenses.payee_id`. Created by `createOrgPayee`, searched by `searchOrgPayees` ([lib/db.ts:5571](../../../lib/db.ts#L5571)).

**Gotchas (read first):**
1. **Two scopes in one table:** `team_id IS NULL` = org-wide payee (admin-created, visible org-wide); `team_id` set (FK → `rep_teams` ON DELETE CASCADE) = team-scoped (coach-created, that team's coaches only). Team payees arise **only inside team-workspace orgs** ([coaches/[orgSlug]/payees/route.ts:47](../../../app/api/coaches/[orgSlug]/payees/route.ts#L47)).
2. **Case-insensitive name uniqueness PER SCOPE** via two partial-unique indexes (`(org_id, lower(name)) WHERE team_id IS NULL` and `(org_id, team_id, lower(name)) WHERE team_id IS NOT NULL`); 23505 → 409.
3. **`is_active` is a soft-delete flag, but NO route flips it false** (no deactivation/hard-delete endpoint found) — `searchOrgPayees` returns only active. Deactivation is effectively unimplemented.

**Fields** (boilerplate `id`, `created_at` omitted):

<!-- dict:col:org_payees.org_id -->
**`org_id`** (FK → `organizations.id` ON DELETE CASCADE, NOT NULL) — owning org; indexed.

<!-- dict:col:org_payees.team_id -->
**`team_id`** (FK → `rep_teams.id` ON DELETE CASCADE, nullable) — scope discriminator (gotcha 1); indexed.

<!-- dict:col:org_payees.name -->
**`name`** (text, NOT NULL; CHECK 1–200 chars, trimmed) — payee name; case-insensitive uniqueness per scope (gotcha 2).

<!-- dict:col:org_payees.notes -->
**`notes`** (text, nullable) — free-text note.

<!-- dict:col:org_payees.is_active -->
**`is_active`** (bool, NOT NULL, default true) — soft-delete flag; only active appear in search; no writer flips it (gotcha 3).

<!-- dict:col:org_payees.created_by -->
**`created_by`** (FK → `auth.users.id`, nullable; cross-schema gap) — who created it.

---

## `budget_categories`
<!-- dict:table:budget_categories -->

**Purpose:** the top level of a **shared two-level chart of accounts** (categories → items) used by BOTH the org budget planner and the rep-team budget planner. `org_id IS NULL` rows are platform-seeded read-only defaults; `org_id`-set rows are org customs.

**Gotchas (read first):**
1. **Global defaults via NULLABLE `org_id`** — 9 default categories are seeded `org_id NULL` + `is_default=true` (migration 027). An org's effective list = defaults ∪ customs (`.or('org_id.is.null,org_id.eq.<orgId>')`, [budget-categories/route.ts:56](../../../app/api/admin/accounting/budget-categories/route.ts#L56)).
2. **`scope` (`org|team|both`, default `both`) gates which planner shows the category** — the `org`/`team` filters BOTH include `both`; `'both'` is universal.
3. **NO category PATCH/DELETE route exists** (only GET + POST) — so neither defaults nor customs can be edited/removed via API (incomplete CRUD, not a bug). Consumed by `org_budget_lines.category_id` + `rep_budget_lines.category_id`, both `ON DELETE SET NULL` (deleting a category — were it possible — silently uncategorizes lines).

**Fields** (boilerplate `id`, `created_at` omitted):

<!-- dict:col:budget_categories.org_id -->
**`org_id`** (FK → `organizations.id` ON DELETE CASCADE, **nullable**) — NULL = platform default; set = org custom. The defaults-vs-custom switch (gotcha 1).

<!-- dict:col:budget_categories.name -->
**`name`** (text, NOT NULL, ≤80 app-side) — category name. **No unique index** (only `(org_id)` + PK) — unlike `budget_items`/`org_payees`, duplicate category names are **silently allowed**; the POST route's `23505→409` branch is dead code for categories.

<!-- dict:col:budget_categories.scope -->
**`scope`** (text, NOT NULL, default `'both'`; CHECK `org|team|both`) — which planner(s) show it (gotcha 2).

<!-- dict:col:budget_categories.sort_order -->
**`sort_order`** (int, NOT NULL, default 0) — display order; defaults seeded 1..9, customs insert at 0 (so customs sort before defaults).

<!-- dict:col:budget_categories.is_default -->
**`is_default`** (bool, NOT NULL, default false) — true for the platform-seeded read-only set (gotcha 1, 3).

---

## `budget_items`
<!-- dict:table:budget_items -->

**Purpose:** the bottom level of the shared chart — named items inside a `budget_category`. `org_id IS NULL` = platform default; `org_id`-set = org custom. Optionally tagged by `org_budget_lines.item_id` / `rep_budget_lines.item_id`.

**Gotchas (read first):**
1. **`is_misc` = the per-category "Misc" catch-all** — each seeded category gets one (`is_misc=true`, `sort_order=99`, pinned LAST); Misc items **cannot be deleted** (they're platform defaults → the `org_id`-default 403 fires first; the explicit `is_misc` delete-guard is a belt-and-suspenders backstop). Custom items can **never** be `is_misc` (POST hardcodes false).
2. **Defaults (`org_id NULL`) are immutable** — PATCH/DELETE 403 when `org_id != caller org`. But **custom items can attach to a DEFAULT category** (a default category can host org-custom children).
3. **Case-insensitive item-name uniqueness within a category, per scope** (two partial-unique indexes) — so an org can add a custom item with the same name as a default in the same category without colliding.
4. **`suggested_amount` is a planner UI HINT, not a budgeted value** (`numeric(10,2)` dollars; stored only when > 0). Actuals live in budget lines / entries.
5. **`coach` may create items** (unlike categories, which are owner/treasurer-only) — POST allows owner/treasurer/coach; PATCH/DELETE owner/treasurer only.

**Fields** (boilerplate `id`, `created_at` omitted):

<!-- dict:col:budget_items.category_id -->
**`category_id`** (FK → `budget_categories.id` ON DELETE CASCADE, NOT NULL) — parent category; indexed. Deleting a category cascades its items.

<!-- dict:col:budget_items.org_id -->
**`org_id`** (FK → `organizations.id` ON DELETE CASCADE, **nullable**) — NULL = immutable default; set = org custom (immutability enforced via this, not `is_default`).

<!-- dict:col:budget_items.name -->
**`name`** (text, NOT NULL, ≤80 app-side) — item name; case-insensitive uniqueness per category per scope.

<!-- dict:col:budget_items.suggested_amount -->
**`suggested_amount`** (numeric(10,2), nullable) — planner pre-fill HINT in dollars; not a budgeted figure (gotcha 4).

<!-- dict:col:budget_items.sort_order -->
**`sort_order`** (int, NOT NULL, default 0) — order within the category; Misc forced last regardless.

<!-- dict:col:budget_items.is_default -->
**`is_default`** (bool, NOT NULL, default false) — platform-seeded item.

<!-- dict:col:budget_items.is_misc -->
**`is_misc`** (bool, NOT NULL, default false) — the per-category Misc catch-all; un-deletable (gotcha 1).

---

## `org_budget_lines`
<!-- dict:table:org_budget_lines -->

**Purpose:** one **estimated** cost line in the org's **annual** planning budget (keyed `org_id` + integer `season_year`). A planning layer only — actuals live in `accounting_entries`. A line can optionally be allocated to rep teams (spinning up real installment schedules).

**Gotchas (read first):**
1. **DUAL-BUDGET-LINE TRAP (org side):** keyed by **integer `season_year`** (e.g. 2026); the per-team `rep_budget_lines` is keyed by **uuid `program_year_id`**. Different tables sharing the chart. Incoming FKs that target THIS table: `rep_cost_allocations.source_budget_line_id` + `rep_team_payment_requests.budget_line_id`.
2. **A line is an ESTIMATE, not money** — `budget-vs-actual` does **not** map actuals per line/category; it sums org-wide `posted` `expense` entries for the year across `entity_type='org'` ledgers and subtracts from the total budget ("not yet mapped per-line — Phase J", [budget-vs-actual/route.ts:16-18](../../../app/api/admin/accounting/budget-vs-actual/route.ts#L16-L18)).
3. **One allocation per line; delete is app-blocked when an allocation exists** ([[lineId]/route.ts:100-112](../../../app/api/admin/accounting/budget-plan/lines/[lineId]/route.ts#L100-L112), 409) — **stricter than the DB FK** (which is `ON DELETE SET NULL`). Allocating uses the shared `createRepCostAllocationWithSplits`, then tags `rep_cost_allocations.source_budget_line_id`.
4. **"Current" `season_year` is the server clock** (`new Date().getFullYear()`) when no `?year=` is given; there is no per-org "active season". Validated 2020–2099 on insert; `season_year` is not PATCH-editable.

**Fields** (boilerplate `id`, `created_at`, `updated_at` omitted):

<!-- dict:col:org_budget_lines.org_id -->
**`org_id`** (FK → `organizations.id` ON DELETE CASCADE, NOT NULL) — owning org; every read/mutation filters `.eq('org_id', ctx.org.id)`. Indexed `(org_id, season_year)`.

<!-- dict:col:org_budget_lines.season_year -->
**`season_year`** (integer, NOT NULL) — the annual key (e.g. 2026); **not** a uuid program-year (the dual-budget-line trap, gotcha 1). Not editable via PATCH.

<!-- dict:col:org_budget_lines.category_id -->
<!-- dict:col:org_budget_lines.item_id -->
**`category_id` / `item_id`** (FK → `budget_categories.id` / `budget_items.id` ON DELETE SET NULL, nullable) — optional chart-of-accounts tags (shared with the rep budget); both null = uncategorized.

<!-- dict:col:org_budget_lines.description -->
**`description`** (text, NOT NULL, ≤200 app-side) — line label.

<!-- dict:col:org_budget_lines.total_amount -->
**`total_amount`** (numeric(10,2), NOT NULL, CHECK `> 0`) — estimated dollars; the allocation ceiling + the budget-vs-actual "estimated".

<!-- dict:col:org_budget_lines.notes -->
**`notes`** (text, nullable) — free-text note.

<!-- dict:col:org_budget_lines.sort_order -->
**`sort_order`** (int, NOT NULL, default 0) — manual display order.

---

## `org_budget_periods`
<!-- dict:table:org_budget_periods -->

**Purpose:** optional time-phasing of a single `org_budget_lines` row into labeled periods (months/quarters), each with a dollar amount + optional date. Zero periods = the line is a lump sum. A leaf child — no `org_id`/`updated_at` (scope via the parent line).

**Gotchas (read first):**
1. **Writing periods is a destructive FULL REPLACE** — POST deletes ALL periods for the line then inserts the new set; an empty array clears them (reverts to lump sum). No merge/upsert.
2. **Σ(period amounts) is NOT reconciled to `total_amount`** — the write validates only label + `amount > 0`, never that periods sum to the line total. Migration 031 *claims* the sum "is enforced in application logic" but **the code does not enforce it** — periods can legally over/under-sum. (Contrast `rep_budget_periods`, which DOES reconcile ±$0.02.)
3. **No `org_id`/`updated_at`** — scope is reached only through `budget_line_id → org_budget_lines`. `ON DELETE CASCADE` from the parent.
4. **`period_date` (nullable) seeds installment due-dates** when the line is allocated to teams — it **prefills** the allocation UI's installment dates (which the admin can edit); the installment `due_date` is written from the request body, not mechanically from `period_date`. `period_label` is the required identifier; reads order by `sort_order` then `period_date` NULLS LAST.

**Fields** (boilerplate `id`, `created_at` omitted; **no `org_id`, no `updated_at`**):

<!-- dict:col:org_budget_periods.budget_line_id -->
**`budget_line_id`** (FK → `org_budget_lines.id` ON DELETE CASCADE, NOT NULL) — the parent line; the ONLY scope link; indexed. Full-replace keys on it.

<!-- dict:col:org_budget_periods.period_label -->
**`period_label`** (text, NOT NULL) — required label ("January"/"Q1"/"Deposit").

<!-- dict:col:org_budget_periods.period_date -->
**`period_date`** (date, nullable) — optional date; seeds allocation installment dates (gotcha 4).

<!-- dict:col:org_budget_periods.amount -->
**`amount`** (numeric(10,2), NOT NULL, CHECK `> 0`) — the period's dollars; never reconciled to the parent total (gotcha 2).

<!-- dict:col:org_budget_periods.sort_order -->
**`sort_order`** (int, NOT NULL, default 0) — order within the line (array index on insert when omitted).

---

## `billing_retention_intents`
<!-- dict:table:billing_retention_intents -->

**Purpose:** the **header** of a data-retention hold — one row per downgrade/cancellation event recording the plan transition + what is kept vs retained. The actual lifecycle lives on the child `billing_retained_records`. Written by the owner confirm flows, platform-admin cancel, and the Stripe webhook.

**Gotchas (read first):**
1. **`status` is FROZEN at `'applied'`** — always inserted `'applied'`, never updated; `pending|canceled|restored|purged` are **dead enum values**. The webhook dedup guard depends on `status='applied'` ([webhook/route.ts:383](../../../app/api/billing/webhook/route.ts#L383)). Real progress is on `billing_retained_records.retained_state`.
2. **`keep_tournament_ids` (uuid[]) is the KEEP set, not the retained set** — on downgrade, the tournaments the org keeps active; retained = non-archived tournaments NOT in this array. Always `[]` for cancellations.
3. **NO `stripe_*` columns** — `from_plan`/`target_plan` are FieldLogicHQ plan keys validated against `PLAN_ORDER` ([lib/billing-retention.ts:92](../../../lib/billing-retention.ts#L92)); `'team'` is excluded as a downgrade target. The Stripe trigger that creates webhook-initiated intents is the Stripe/Billing phase.
4. **`effective_at` is vestigial** (never read/written by code, only the DB default); **`applied_at` is the real one** (always set; the webhook dedup orders by it). **`created_by_email`** survives `created_by` being nulled (sentinel `'stripe-webhook'`).

**Fields** (boilerplate `id`, `created_at`, `updated_at` omitted):

<!-- dict:col:billing_retention_intents.org_id -->
**`org_id`** (FK → `organizations.id` ON DELETE CASCADE, NOT NULL) — the org; delete-org hard-deletes the retention rows (records then intents) before the org delete — belt-and-suspenders over the `org_id` cascade.

<!-- dict:col:billing_retention_intents.intent_type -->
**`intent_type`** (text, NOT NULL; CHECK `downgrade|cancellation`) — `downgrade` keeps the org alive on a lower plan; `cancellation` = full account/Coaches-Portal teardown.

<!-- dict:col:billing_retention_intents.status -->
**`status`** (text, NOT NULL, default `'applied'`; CHECK `pending|applied|canceled|restored|purged`) — frozen at `'applied'` (gotcha 1; note US spelling `canceled`).

<!-- dict:col:billing_retention_intents.from_plan -->
<!-- dict:col:billing_retention_intents.target_plan -->
**`from_plan` / `target_plan`** (text, nullable) — plan keys; `target_plan` is set only on downgrade (always null for cancellations). No Stripe (gotcha 3).

<!-- dict:col:billing_retention_intents.keep_tournament_ids -->
**`keep_tournament_ids`** (uuid[], NOT NULL, default `'{}'`) — the KEEP set on downgrade (gotcha 2).

<!-- dict:col:billing_retention_intents.effective_at -->
**`effective_at`** (timestamptz, NOT NULL, default `now()`) — **vestigial** (DB-default only, never read/written by code).

<!-- dict:col:billing_retention_intents.retention_until -->
**`retention_until`** (timestamptz, NOT NULL) — purge-eligibility deadline = now + 90 days (`retentionDeadline()`); copied onto each child record (the **record's** copy is the one the sweep/extend mutate, not this).

<!-- dict:col:billing_retention_intents.reason -->
**`reason`** (text, nullable) — free text; required for platform-admin cancel (400 if blank); `'Stripe subscription deleted'` for webhook.

<!-- dict:col:billing_retention_intents.created_by -->
<!-- dict:col:billing_retention_intents.created_by_email -->
**`created_by`** (FK → `auth.users.id` ON DELETE SET NULL, nullable) / **`created_by_email`** (text, nullable) — actor; `created_by` null for platform-admin/webhook paths; use `created_by_email` (sentinel `'stripe-webhook'`) for attribution.

<!-- dict:col:billing_retention_intents.applied_at -->
**`applied_at`** (timestamptz, nullable) — set to now() at every insert; the webhook dedup orders by it (gotcha 4).

---

## `billing_retained_records`
<!-- dict:table:billing_retained_records -->

**Purpose:** the **line items** of a retention hold — one row per retained entity (a tournament, or the `account` itself) put into soft-inactive state by an intent. **This is where the lifecycle state machine lives** (the parent intent stays `'applied'`). Read surface: `app/platform-admin/retention/page.tsx`.

**Gotchas (read first):**
1. **The lifecycle is `retained_state`:** created `retained_inactive` → the sweep (14 days before `retention_until`) sends a warning + stamps `warning_sent_at` → after `retention_until` flips to `pending_purge` (`pending_purge_at`) → `restored` (on resubscribe) or `purged` (supersede). **`'pending_purge'` is the terminal AUTOMATED state — there is NO automated hard-purge**; actual data deletion is only the super-admin delete-org route. **`'purged'` here = "superseded", not "data deleted".**
2. **To know a retention's real state, read the RECORDS, not the intent** — nothing ever updates `billing_retention_intents.status` away from `'applied'`.
3. **The SWEEP is MANUAL, not pg_cron** — `processBillingRetentionExpiry` ([lib/billing-retention.ts:367](../../../lib/billing-retention.ts#L367)) runs only via `POST /api/platform-admin/retention/process` (`manage_billing`); it warns + advances to `pending_purge` and logs to `platform_audit_log`.
4. **Partial-UNIQUE = at most ONE ACTIVE retention per `(record_type, record_id)`** (`WHERE retained_state IN ('retained_inactive','pending_purge') AND record_id IS NOT NULL`). `record_type='account'` rows have `record_id` NULL → **exempt** (an org can have multiple account rows). The "supersede → purged" updates exist to avoid violating this on re-retention.
5. **RESTORE is record-type-aware** — only `tournament` records with `metadata.retentionReason='plan_downgrade'` are restored (capped by available slots); each restore un-archives the tournament (to `metadata.previousStatus`) THEN flips the record to `restored`, rolling the tournament back if the record update fails ([lib/billing-retention.ts:209](../../../lib/billing-retention.ts#L209)). Coaches-Portal restore mirrors this in `lib/team-checkout.ts`.
6. **`metadata.retentionReason` is LOAD-BEARING** (used in restore WHERE clauses, not just display): `plan_downgrade|account_cancellation|coaches_portal_cancellation|stripe_subscription_deleted`.
7. **`last_extended_by` is text (email/sentinel), NOT an FK** — platform-admin can extend `retention_until` by 1–365 days (default 30, reason required), incrementing `extension_count` ([retention/[recordId]/extend/route.ts](../../../app/api/platform-admin/retention/[recordId]/extend/route.ts)).

**Fields** (boilerplate `id` omitted; **no `created_at`/`updated_at` — see `retained_at`**):

<!-- dict:col:billing_retained_records.intent_id -->
**`intent_id`** (FK → `billing_retention_intents.id` ON DELETE CASCADE, NOT NULL) — the parent hold.

<!-- dict:col:billing_retained_records.org_id -->
**`org_id`** (FK → `organizations.id` ON DELETE CASCADE, NOT NULL) — the org; indexed `(org_id, retained_state, retention_until)`.

<!-- dict:col:billing_retained_records.record_type -->
**`record_type`** (text, NOT NULL; CHECK `tournament|account`) — `tournament` (a specific archived tournament, `record_id` set) vs `account` (whole-org shutdown, `record_id` NULL). Downgrades never produce `account` rows.

<!-- dict:col:billing_retained_records.record_id -->
**`record_id`** (uuid, nullable; **NOT a declared FK**) — `tournaments.id` for tournament rows, NULL for account rows. Restores join manually on `org_id`+`id`.

<!-- dict:col:billing_retained_records.display_name -->
**`display_name`** (text, NOT NULL) — snapshotted label (tournament/org name); survives later renames/deletion.

<!-- dict:col:billing_retained_records.retained_state -->
**`retained_state`** (text, NOT NULL, default `'retained_inactive'`; CHECK `retained_inactive|pending_purge|purged|restored`) — THE lifecycle column (gotchas 1–4).

<!-- dict:col:billing_retained_records.retained_at -->
**`retained_at`** (timestamptz, NOT NULL, default `now()`) — when the record was created (the effective create stamp); downgrade-restore orders newest-first by it.

<!-- dict:col:billing_retained_records.retention_until -->
**`retention_until`** (timestamptz, NOT NULL) — the **authoritative** per-record purge deadline (copied from the intent; the one the sweep + extend mutate). Lifecycle-indexed.

<!-- dict:col:billing_retained_records.extension_count -->
**`extension_count`** (int, NOT NULL, default 0) — number of platform-admin extensions.

<!-- dict:col:billing_retained_records.last_extended_at -->
<!-- dict:col:billing_retained_records.last_extended_by -->
<!-- dict:col:billing_retained_records.last_extension_reason -->
**`last_extended_at` / `last_extended_by` / `last_extension_reason`** (timestamptz / text / text, nullable) — most-recent extension audit; `last_extended_by` is an email/sentinel (`'platform-admin'`), **not an FK**; only the LAST reason is kept (full history in `platform_audit_log`).

<!-- dict:col:billing_retained_records.metadata -->
**`metadata`** (jsonb, NOT NULL, default `'{}'`) — snapshot + provenance; **load-bearing** (`retentionReason`, `previousStatus`, `teamWorkspaceId` drive logic). See catalog below.

<!-- dict:col:billing_retained_records.warning_sent_at -->
**`warning_sent_at`** (timestamptz, nullable; added mig 039) — set when the 14-day-before warning email is sent; the sweep selects `.is('warning_sent_at', null)` to avoid resending.

<!-- dict:col:billing_retained_records.pending_purge_at -->
**`pending_purge_at`** (timestamptz, nullable; added mig 039) — stamped when the record flips to `pending_purge`.

<!-- dict:col:billing_retained_records.purge_notice_sent_at -->
**`purge_notice_sent_at`** (timestamptz, nullable; added mig 039) — stamped when the "window expired" notice email was sent (NULL if it failed / no owner email).

**`metadata` jsonb key catalog:**

| key | meaning |
|---|---|
| `retentionReason` | **load-bearing** discriminator scoping restores — `plan_downgrade` \| `account_cancellation` \| `coaches_portal_cancellation` \| `stripe_subscription_deleted` |
| `previousStatus` | the tournament's pre-archive status, used to restore it (coerced to draft/active/completed) |
| `slug` / `year` / `startDate` / `endDate` | tournament identity snapshot (display/audit) |
| `fromPlan` / `targetPlan` | plan-transition snapshot (targetPlan only on downgrade rows) |
| `teamWorkspaceId` | on Coaches-Portal cancellation account rows, the `team_workspaces.id` (matched by the Coaches-Portal restore) |
| `moduleShutdown` / `premiumToolsInactive` | modules/tools that went dark (owner-facing explanation) |
| `basicTournamentRecordsRemainAvailable` | flag: free Basic tournament data is NOT purged when a Premium workspace cancels |
| `initiatedBy` / `adminEmail` | provenance for platform-admin-initiated cancellations |

---

### Functions (not tables — not coverage-checked, documented for completeness)

- **`create_accounting_transfer(p_from_ledger_id, p_to_ledger_id, p_amount numeric(12,2), p_entry_date, p_description, p_category, p_created_by) → void`** ([migration 016](../../../supabase/migrations/016_org_accounting.sql)) — the double-entry transfer primitive. In one transaction it inserts a **pair** of `accounting_entries`: a `transfer_out` leg in the source ledger + a `transfer_in` leg in the dest ledger, both `posted`, same amount/date/description/category, **cross-linked via `linked_entry_id`** (pre-generates both UUIDs to set the reciprocal links). The ONLY way `transfer_*` rows are created. Plain `LANGUAGE plpgsql` (no `SECURITY DEFINER`); all callers invoke it via `supabaseAdmin`. Callers: `accounting/transfers/route.ts` (admin manual transfer between any two of the org's ledgers — typically org↔tournament; not entity-type-restricted), `rep-teams/payment-requests/[id]/route.ts` (team↔org ledger), + rep/coaches allocation-installment routes.
- **`processBillingRetentionExpiry(actorEmail)`** ([lib/billing-retention.ts:367](../../../lib/billing-retention.ts#L367)) — the manual retention sweep (not pg_cron): sends 14-day warnings (`warning_sent_at`), advances expired `retained_inactive` → `pending_purge`, logs to `platform_audit_log`. Invoked by `POST /api/platform-admin/retention/process`.

---

*End of Accounting (Phase 6 — 9 tables: ledger [`accounting_ledgers`/`accounting_entries`/`org_payees`] + shared chart & org budget [`budget_categories`/`budget_items`/`org_budget_lines`/`org_budget_periods`] + billing retention [`billing_retention_intents`/`billing_retained_records`]). Consumers cross-referenced, not redocumented: Rep finance (`rep_*` write entries, share `org_payees` + the chart, target `org_budget_lines`) and League fees (`league_registrations.fee_entry_id` → entries via the per-season ledger). NO `stripe_*` columns anywhere — the Stripe billing trigger that fires retention/cancellation is the Stripe/Billing phase.*

---

# Domain: Stripe / Billing

The platform's **Stripe surface** — deliberately **column-light**: ONE dedicated table (**`stripe_prices`**, the platform price catalog) plus the **billing flow** that ties together columns documented in other domains. The flow's state lives on `organizations` (Phase 3 — `stripe_customer_id` / `stripe_subscription_id` / `subscription_status` / `subscription_period` / `current_period_end` / `plan_id` / `tournament_limit` / `rep_team_subscription_item_id` / `billing_suspended_at` / `billing_suspension_reason`), on `team_workspaces` + `team_entitlements` (Phase 2), and in the billing data-retention tables (Phase 6 Accounting — `billing_retention_intents` / `billing_retained_records`). Those columns are **cross-referenced here, not redocumented**. The spine: checkout resolves a price from `stripe_prices` → the Stripe webhook applies entitlement to `organizations` via the **reverse** price→plan lookup → downgrade/cancel run **DB-first** and hand off to the retention lifecycle.

> _Last verified: 2026-06-10 @ snapshot 2026-06-10, commit `cbcf7c7` (branch `feat/free-tier-coaches`). The working tree carries unrelated uncommitted edits (observability Phase 4 etc.), but every billing/Stripe file cited in this domain is UNMODIFIED vs `cbcf7c7` (checked via git status) — refs match the commit; the one cite into the modified `lib/types.ts` was verified identical at `cbcf7c7`. Live probes (2026-06-10, dev+prod `information_schema`/`pg_trigger`/`pg_class`/`pg_policy`): `stripe_prices` is column-, constraint-, CHECK-, and index-identical dev↔prod (zero structural drift); **NO triggers**; **RLS ENABLED with ZERO policies**; row content probed (see gotchas)._

### Gotchas first (the cross-cutting traps)

- **The webhook derives the plan from the PRICE, not from metadata — an unmapped `price_id` silently no-ops entitlement.** `customer.subscription.created/updated` reverse-looks-up `getPlanFromPriceId(priceId)` ([app/api/billing/webhook/route.ts:137](../../../app/api/billing/webhook/route.ts#L137)); no matching `stripe_prices` row → the whole handler body is skipped and the webhook still ACKs 200. The org's `plan_id`/`subscription_status` never update, and **nothing is logged** — the webhook route does not import `lib/observability/capture` (verified: zero matches). A paid subscription on an unmapped price is invisible.
- **Environment = `STRIPE_SECRET_KEY` prefix sniff; the CHECK value is `sandbox`, never `test`.** `'live'` iff the key starts with `sk_live_`, else `'sandbox'` ([lib/stripe-prices.ts:18-19](../../../lib/stripe-prices.ts#L18)) — `NODE_ENV` is irrelevant (a dev deployment holding a live key reads live rows). The same sniff is re-implemented in 4+ places (stripe-prices PATCH, change-request apply, dev readiness route, audit script) — drift risk if the convention changes.
- **Live content is mirror-imaged ON PURPOSE (content "drift" that isn't drift).** Both env DBs hold the same 24 seed slots (6 plan keys × 2 cycles × 2 environments), but the dev DB maps only its 12 `sandbox` rows (`price_id` set) and prod maps only its 12 `live` rows — each DB's other-environment rows are inert seed scaffolding (probed live 2026-06-10). Structure is zero-drift.
- **RLS-with-no-policies is the ONLY thing keeping this table off prod's public REST API.** Probed live: prod grants `anon`+`authenticated` SELECT on `public.stripe_prices` (`has_table_privilege` = true; dev does NOT — the [[reference_supabase_rls_grants]] class). With RLS enabled and zero policies, `anon` resolves to 0 rows via PostgREST while `supabaseAdmin` (service-role, BYPASSRLS) does all reads/writes. Don't "simplify" by disabling RLS.
- **`organizations.subscription_status` can hold RAW Stripe statuses outside the 4-value TS type.** The org webhook path writes `sub.status` **verbatim** ([webhook/route.ts:233](../../../app/api/billing/webhook/route.ts#L233)) — Stripe statuses like `incomplete`/`unpaid`/`paused` can land in a column typed `active|trialing|past_due|canceled` ([lib/types.ts:13](../../../lib/types.ts#L13)). Only the team-workspace paths normalize via `mapStripeStatusToOrgStatus` ([lib/team-checkout.ts:205-210](../../../lib/team-checkout.ts#L205)). Every entitlement gate checks only `=== 'canceled'`, so e.g. `unpaid` keeps full access.
- **`invoice.payment_failed` never suspends or retains — only `customer.subscription.deleted` does.** Failed payment → `subscription_status='past_due'` + a bell notification + a `subscription_past_due` platform event, nothing else ([webhook/route.ts:557](../../../app/api/billing/webhook/route.ts#L557)). The full cascade (retention intent, tournament archival, `is_public=false`, `billing_suspended_at`) runs only in the `deleted` handler — the grace window is governed entirely by Stripe dunning settings, not app code.
- **Downgrade/cancel are DB-FIRST; Stripe reconciliation failure leaves DB and Stripe out of sync by design.** Both confirm routes apply intent + archival + org update **before** touching Stripe; a Stripe failure writes an `org_audit_log` row `billing_stripe_reconciliation_failed` and returns a contact-support 500 — the org is already downgraded/canceled in-app while Stripe may keep billing ([downgrade/confirm/route.ts:201](../../../app/api/billing/downgrade/confirm/route.ts#L201)). No automatic retry.
- **Three Stripe-bypass paths legitimately write plan state with NO Stripe objects** (so "org has a plan" ⇏ a `stripe_prices` lookup ever happened): (1) mock billing — `isBillingMockEnabled()` is hard-FALSE in production ([lib/billing-mock.ts:27](../../../lib/billing-mock.ts#L27)); (2) the **no-key direct-apply**: any non-production env with `STRIPE_SECRET_KEY` unset applies plan changes straight to the DB (`shouldApplyDirectly`, [create-checkout/route.ts:134](../../../app/api/billing/create-checkout/route.ts#L134)) — independent of the mock flag; (3) the **founding-season comp** (tournament→tournament_plus): `subscription_status='active'`, `stripe_subscription_id=NULL`, `current_period_end=FOUNDING_SEASON_END` ([create-checkout/route.ts:216-221](../../../app/api/billing/create-checkout/route.ts#L216)) — a populated `current_period_end` is NOT proof of a Stripe subscription. Free-plan selection goes through `/api/admin/org/onboarding-plan`, not checkout. Note `mock-apply` only requires org membership (no `billing` capability) — dev/preview-only privilege escalation, unreachable in prod.
- **Recovery paths never clear `billing_suspended_at`/`billing_suspension_reason` for regular orgs.** Only the team-workspace reactivation writer nulls them ([lib/team-checkout.ts:411-412](../../../lib/team-checkout.ts#L411)); webhook plan-application and `invoice.payment_succeeded` restore plan/status but leave the suspension stamp — a resubscribed org carries a stale `billing_suspended_at` forever. Harmless today (no app reader gates on it) but a trap for future consumers.
- **Webhook idempotency is PARTIAL.** `platform_events` dedupe on `(source, source_event_id)` and the `deleted` handler is self-deduping via its retention-intent guard — but the `subscription.created/updated` org write is unconditioned last-write-wins keyed on `stripe_customer_id` (no event-timestamp guard, no processed-event ledger): a replayed/out-of-order older event could regress `plan_id`/`subscription_status` ([webhook/route.ts:228-238](../../../app/api/billing/webhook/route.ts#L228)).
- **Dev/prod:** `stripe_prices` structure identical (zero drift); content intentionally mirror-imaged (see above).

---

## `stripe_prices`
<!-- dict:table:stripe_prices -->

**Purpose:** the **platform-level Stripe price catalog** — one row per `(plan_id, billing_cycle, environment)` slot mapping a FieldLogicHQ plan key to a Stripe `price_…` id. DB-backed (not env vars) so platform admins can rotate price ids without a redeploy ([migration 048](../../../supabase/migrations/048_stripe_prices.sql) header). Canonical readers in [lib/stripe-prices.ts](../../../lib/stripe-prices.ts): `getStripePriceId(planId, billingCycle)` (forward, environment-filtered, [:22](../../../lib/stripe-prices.ts#L22)), `getPlanFromPriceId(priceId)` (reverse — the webhook's plan resolver, **no environment filter**, [:37](../../../lib/stripe-prices.ts#L37)), `getAllStripePrices()` (admin listing, [:49](../../../lib/stripe-prices.ts#L49)). All access via `supabaseAdmin` (RLS enabled, zero policies).

**Gotchas (read first):**
1. **NULL `price_id` is always a SOFT fail.** Checkout routes 400 "checkout is not configured" ([create-checkout/route.ts:304](../../../app/api/billing/create-checkout/route.ts#L304), [create-team-checkout/route.ts:163](../../../app/api/billing/create-team-checkout/route.ts#L163), [lib/team-org-billing.ts:800](../../../lib/team-org-billing.ts#L800)); `syncRepTeamBilling` logs and bails — **Club orgs ride free on extra rep teams until the `rep_team` price is mapped** ([lib/stripe-sync.ts:52-61](../../../lib/stripe-sync.ts#L52)); the webhook silently skips (domain gotcha 1); `billing-preview` 500s. Only downgrade/confirm raises an internal exception (caught → the reconciliation-failed 500); everything else fails soft.
2. **All three read helpers swallow DB errors** — they destructure only `{ data }`, never `error` ([lib/stripe-prices.ts:27](../../../lib/stripe-prices.ts#L27)). A transient DB failure (or a `maybeSingle()` multi-row error) is indistinguishable from "not configured".
3. **`getPlanFromPriceId` is environment-blind and `price_id` has NO unique constraint** (UNIQUE is on `(plan_id, billing_cycle, environment)` only). Safe today because Stripe price-id strings are mode-unique and each DB maps one side — but pasting the same id onto two rows would make `maybeSingle()` error → swallowed (gotcha 2) → the webhook silently ignores every subscription on that price. Operator-input footgun in the price editor.
4. **UPDATE-only; no code INSERT path.** Rows exist only from migration seeds (048: 16 rows; 065: +8). Both writers update `price_id` + the three audit columns only; `plan_id`/`billing_cycle`/`environment`/`product_name` are seed-fixed slots. A new billable plan key needs a migration to seed its 4 rows. **`updated_at` is CODE-maintained** (no trigger, probed live): both writers set it explicitly ([stripe-prices/route.ts:108-113](../../../app/api/platform-admin/stripe-prices/route.ts#L108)).
5. **Every `price_id` write requires an APPROVED catalog change request — no unilateral edit path.** Path A: `PATCH /api/platform-admin/stripe-prices` (`manage_billing` OR `manage_product`, [:40](../../../app/api/platform-admin/stripe-prices/route.ts#L40)) hard-fails without an approved `platform_catalog_change_requests` row ([:66](../../../app/api/platform-admin/stripe-prices/route.ts#L66)). Path B: approving a `stripe_price_update` proposal on the change-requests PATCH applies it inline with a 409 optimistic-concurrency guard, then auto-marks the request `implemented` ([change-requests/route.ts:685](../../../app/api/platform-admin/product-catalog/change-requests/route.ts#L685)). Both validate the `price_` prefix, double-log to `platform_audit_log` (`update_stripe_price_id`) + `platform_catalog_change_applications`. GET is any platform-admin role incl. `read_only` — not super_admin-only.
6. **Cross-environment edits are accepted UNVALIDATED.** Stripe-API active-price validation runs only when the row's `environment` matches the runtime key's environment ([stripe-prices/route.ts:86](../../../app/api/platform-admin/stripe-prices/route.ts#L86)) — editing a `live` row from a sandbox-keyed deployment (exactly how prod rows would be staged from dev) skips validation; a typo'd live id saves fine.
7. **`plan_id` is unconstrained text spanning TWO kinds of key.** Live domain = 6 keys: org plans (`tournament_plus`/`league`/`club` — OrgPlan keys) + Stripe-line-item keys (`team`, `org_team_addon`, `rep_team` — the latter two are **never** written to `organizations.plan_id`; they branch to add-on/quantity paths before the org write). `'tournament'` (free) is **absent by design** — free selection goes through `/api/admin/org/onboarding-plan`, and create-checkout fails closed if it ever reaches the Stripe branch. Migration 048's in-file `plan_id` comment lists only 4 keys (mig 065 already re-COMMENTed the live column to all 6) — cite the live probe, not migration files.
8. **downgrade/confirm guesses `'monthly'` when the CURRENT price is unmapped** (`currentMatch?.billingCycle ?? 'monthly'`, [downgrade/confirm/route.ts:183-186](../../../app/api/billing/downgrade/confirm/route.ts#L183)) — a paid-to-paid downgrade could swap an annual subscriber onto a monthly price. The subsequent target-price null-check at least fails loudly into the reconciliation-failed path.

**Fields** (boilerplate `id`, `created_at`, `updated_at` omitted — but see gotcha 4: `updated_at` is code-maintained, equal to `created_at` on never-edited rows):

<!-- dict:col:stripe_prices.plan_id -->
**`plan_id`** (text, NOT NULL; no CHECK, no FK) — the plan key half of the lookup. Per-key reader map: `tournament_plus`/`league`/`club` ← org checkout passthrough ([create-checkout/route.ts:303](../../../app/api/billing/create-checkout/route.ts#L303)) + downgrade targets; `team` ← [create-team-checkout/route.ts:162](../../../app/api/billing/create-team-checkout/route.ts#L162); `org_team_addon` ← [lib/team-org-billing.ts:799](../../../lib/team-org-billing.ts#L799); `rep_team` ← [lib/stripe-sync.ts:50](../../../lib/stripe-sync.ts#L50) + [rep-teams/billing-preview/route.ts:74](../../../app/api/admin/rep-teams/billing-preview/route.ts#L74). No seeded-but-unread keys. Seed-only (never written by code). Gotcha 7.

<!-- dict:col:stripe_prices.billing_cycle -->
**`billing_cycle`** (text, NOT NULL; CHECK `monthly|annual`) — the cycle half of the lookup; mirrors the `BillingCycle` TS type. Checkout callers pre-coerce via `normalizeBillingCycle` (anything ≠ `'annual'` → `'monthly'`, [lib/plan-config.ts:127](../../../lib/plan-config.ts#L127)); the `subscription_period`-sourced callers (stripe-sync, billing-preview, downgrade) use a `?? 'monthly'` null-fallback instead — outcome-safe because `subscription_period` only ever holds `billing_cycle` values or NULL. Forward reads can't miss on a bad cycle string. The reverse-lookup result feeds `organizations.subscription_period` ([webhook/route.ts:235](../../../app/api/billing/webhook/route.ts#L235)). Seed-only.

<!-- dict:col:stripe_prices.environment -->
**`environment`** (text, NOT NULL; CHECK `sandbox|live` — `sandbox` is the canonical spelling for Stripe test mode, never `'test'`) — lets one table hold both Stripe modes so dev and prod DBs share identical structure; each deployment reads only the side matching its key prefix (`getStripeEnvironment()`, [lib/stripe-prices.ts:18](../../../lib/stripe-prices.ts#L18)). Write-side it decides whether Stripe-API validation runs (gotcha 6). `getPlanFromPriceId` ignores it (gotcha 3). Seed-only.

<!-- dict:col:stripe_prices.price_id -->
**`price_id`** (text, nullable) — the payload: the actual Stripe `price_…` id; **NULL = slot not configured for that environment** (soft-fail everywhere, gotcha 1). Written ONLY by the two governed platform-admin paths (gotcha 5), both enforcing the `price_` prefix ([stripe-prices/route.ts:59](../../../app/api/platform-admin/stripe-prices/route.ts#L59)) and coercing empty → NULL (`price_id || null`). No unique constraint (gotcha 3).

<!-- dict:col:stripe_prices.product_name -->
**`product_name`** (text, nullable) — hand-seeded display label so the admin UI shows named slots before any price id is entered (set on all 48 live rows). **NO code writer** (seed-only; mig 065 renamed the `rep_team` label once). NOT synced from Stripe — the Stripe-side product id captured during validation goes into the audit payload, not this column. Read for display by [StripePricesClient.tsx:99](../../../app/platform-admin/stripe-prices/StripePricesClient.tsx#L99).

<!-- dict:col:stripe_prices.last_change_note -->
**`last_change_note`** (text, nullable; mig 051) — operator note for price edits, written by BOTH update paths via `sanitizePlatformChangeNote` (trim, 1000-char cap, null-for-empty, [lib/platform-change-note.ts:3](../../../lib/platform-change-note.ts#L3)). **Overwrite-with-NULL semantics:** an edit without a note CLEARS the previous note. NOT dead — but never exercised: NULL on all 48 rows in both envs (probed 2026-06-10), including the 12 mapped prod-live rows.

<!-- dict:col:stripe_prices.updated_by_email -->
**`updated_by_email`** (text, nullable; mig 051) — email of the platform admin who last edited the slot ([stripe-prices/route.ts:114](../../../app/api/platform-admin/stripe-prices/route.ts#L114)); complements `platform_audit_log`. **NULL ≠ never-edited** — edits made before mig 051 added the column left no attribution (live: set on all 12 prod-live mapped rows; mixed on dev-sandbox).

---

### The billing flow (not tables — not coverage-checked, documented for completeness)

The narrative spine tying together the already-documented columns. All paths use `supabaseAdmin`.

1. **Org checkout** (`POST /api/billing/create-checkout`, owner-only via `requireCapability('billing')` [:96](../../../app/api/billing/create-checkout/route.ts#L96)): validates `planKey` against `PLAN_CONFIG` (rejects `'team'` → Coaches Portal flow [:110](../../../app/api/billing/create-checkout/route.ts#L110); plan-gating 403s `early_access` plans [:121](../../../app/api/billing/create-checkout/route.ts#L121)), resolves `getStripePriceId(planKey, cycle)` (NULL → 400), lazily creates the Stripe customer and writes `organizations.stripe_customer_id` **before** redirect ([:323](../../../app/api/billing/create-checkout/route.ts#L323)), and stamps `{orgId, planKey, billingCycle}` metadata on session + subscription.
2. **Webhook** (`POST /api/billing/webhook`; signature via `STRIPE_WEBHOOK_SECRET` [:59](../../../app/api/billing/webhook/route.ts#L59); customer-less events ACKed-and-dropped [:72](../../../app/api/billing/webhook/route.ts#L72)) handles exactly **7 event types**. Org resolution is by `stripe_customer_id`, NOT `metadata.orgId`. `checkout.session.completed` only dispatches on `metadata.checkoutKind` (`org_team_addon` / `standalone_team`) and backfills the customer id — org plan application is deliberately deferred to `customer.subscription.created/updated`.
3. **Entitlement application** (`subscription.created/updated` — THE org writer): reverse-lookup `getPlanFromPriceId` → branch `org_team_addon`/`team`/org-plan → org write keyed by `stripe_customer_id`: `plan_id`, `tournament_limit` (from `PLAN_CONFIG`), `subscription_status` = **raw** `sub.status`, `stripe_subscription_id`, `subscription_period` (the matched row's `billing_cycle`), `current_period_end` (from the **SubscriptionItem** — moved off the subscription in Stripe API `2026-04-22.dahlia`, [:221-236](../../../app/api/billing/webhook/route.ts#L221)). Then `restoreRetainedDowngradeTournaments` (un-archives Phase-6-retained tournaments on upgrade), upsell-email cancellation, and `platform_events` (`plan_downgraded`/`subscription_past_due`/`subscription_recovered`, deduped by `source_event_id`).
4. **Team-workspace flows** (columns documented Phase 2 — writer code verified to match): **standalone Team** (`create-team-checkout`, key `team`, `checkoutKind='standalone_team'`; creates a NEW Stripe customer per attempt — abandoned checkouts orphan customers [:178](../../../app/api/billing/create-team-checkout/route.ts#L178)) → `provisionTeamWorkspaceFromCheckoutMetadata`, `billing_mode='team_direct'`. **Org add-on takeover** (`startOrgTeamAddonCheckout`, key `org_team_addon`) → `applyOrgTeamAddonBilling` puts the Stripe ids + RAW status on `team_workspaces` and **NULLs the workspace shadow-org's** `stripe_customer_id`/`stripe_subscription_id` ([lib/team-org-billing.ts:613-628](../../../lib/team-org-billing.ts#L613)) — confirming the Phase-2 invariant from the writer side — then the webhook cancels the coach's prior personal subscription (only ids starting `sub_`, so mocks are never sent to Stripe [:45](../../../app/api/billing/webhook/route.ts#L45)). Ongoing `syncTeamWorkspaceSubscription` keeps raw status on the workspace, **mapped** status on the shadow-org ([lib/team-checkout.ts:252-256](../../../lib/team-checkout.ts#L252)). `team_entitlements.status` keeps its dual spelling: `applyOrgTeamAddonBilling` supersedes with `'cancelled'`, the in-app cancel writes `'canceled'` — both are typed-in values; filter positively (`.in('status', ['active','trialing','past_due'])`).
5. **Club per-rep-team quantity billing** (`syncRepTeamBilling`, [lib/stripe-sync.ts:23](../../../lib/stripe-sync.ts#L23)): no-op unless `plan_id='club'` AND `stripe_subscription_id` is non-null (a `mock_sub_*` id passes the guard); quantity = `max(0, activeRepTeams − 3)`; creates/updates/deletes the `rep_team` subscription item and maintains `organizations.rep_team_subscription_item_id` (Phase 3 column). Fired fire-and-forget from rep-team create + program-year status changes. Unmapped `rep_team` price → log-and-bail (table gotcha 1).
6. **Payment lifecycle:** `invoice.payment_succeeded` → `subscription_status='active'` (+ `current_period_end` from `invoice.period_end`); `invoice.payment_failed` → `'past_due'` only + bell notification (NO suspension/retention — domain gotcha 6); `trial_will_end` → owner email, no DB write.
7. **Downgrade / cancel** (owner-only, preflight → confirm, both **DB-FIRST**): downgrade-confirm inserts the Phase-6 intent (`intent_type='downgrade'`, retained records `retentionReason='plan_downgrade'`), updates the org (`subscription_status='active'`), THEN reconciles Stripe — target free → `subscriptions.cancel`; paid target → price swap with prorations via reverse-then-forward `stripe_prices` lookups (table gotcha 8). Cancel-confirm inserts `intent_type='cancellation'` (`account_cancellation` / `coaches_portal_cancellation`), archives ALL tournaments, sets `subscription_status='canceled'` + `billing_suspended_at`/`_reason` (and `is_public=false` on the regular account branch only — the coaches-portal branch omits it) — but does NOT clear the 3 Stripe fields; the later `subscription.deleted` webhook finds the intent and clears them ([webhook/route.ts:492](../../../app/api/billing/webhook/route.ts#L492)).
8. **`subscription.deleted`** — the retention entry point, **three branches** keyed on the latest applied intent: no intent (Stripe-initiated: dunning exhaustion, portal cancel) → full cascade: intent `'cancellation'` by `'stripe-webhook'`, archive tournaments, `billing_retained_records` (`retentionReason='stripe_subscription_deleted'`, 90-day `retentionDeadline()`), org suspension (`'canceled'`, Stripe fields NULLed, `is_public=false`, `billing_suspended_at`) ([:389-486](../../../app/api/billing/webhook/route.ts#L389)); intent `'cancellation'` exists → clear Stripe fields only; intent `'downgrade'` → clear Stripe fields only, org stays active on free. Retention expiry is the Phase-6 **manual sweep** (`POST /api/platform-admin/retention/process`); restore on resubscribe = `restoreRetainedDowngradeTournaments` + `restoreCoachesPortalRetainedRecords`.
9. **Entitlement gating anchors** (columns documented Phase 3): `hasModuleEntitlement` — `'canceled'` kills ALL modules, else `PLAN_CONFIG[planId].moduleEntitlements ∪ enabledAddons` ([lib/module-entitlements.ts:15](../../../lib/module-entitlements.ts#L15)); `mapOrg` applies `getEffectiveTournamentLimit` ([lib/db.ts:2491](../../../lib/db.ts#L2491) — the stale-cap gotcha); public pages/registration/admin chrome branch on `subscriptionStatus === 'canceled'`. Cancellation **preserves `plan_id`** — access is killed by status, never infer entitlement from `plan_id` alone.
10. **Portal & mock:** `POST /api/billing/portal` (owner `billing` capability; needs `stripe_customer_id`, else 400; mock mode → in-app mock-portal page). Mock billing + the no-key direct-apply + founding-season comp are the three bypass paths (domain gotcha 8); `mock_sub_*` sentinel ids are load-bearing — onboarding free-plan reset allows only `mock_sub_*` ids, and the webhook's prior-sub cancel only touches `sub_*` ids.

---

*End of Stripe / Billing (Phase 7 — 1 table: `stripe_prices`, the governed platform price catalog. The billing-flow narrative above cross-references — not redocuments — the `organizations` billing columns (Org / Platform core, Phase 3), `team_workspaces`/`team_entitlements` (Coaches, Phase 2), and `billing_retention_intents`/`billing_retained_records` (Accounting, Phase 6).)*

---

# Domain: Platform admin

The **platform control plane** — the tables behind `/platform-admin/` that FieldLogicHQ staff (not org tenants) use to govern the whole fleet: who may operate the platform and what they did (`platform_users` / `platform_audit_log` / `platform_user_notes` / `platform_admin_visits`), a durable **business-event** telemetry log (`platform_events` — distinct from Observability's *error* log), the **plans & catalog control plane** with its human-in-the-loop change-approval gate (`plan_gating` / `plan_config_overrides` / `platform_plan_*` / `platform_addon_catalog` / `platform_catalog_change_requests` / `_change_applications` / `_campaigns`), and platform ops + the org-scoped data-import staging (`platform_bulk_operations` / `platform_metric_snapshots` / `import_batches` / `import_batch_rows`). 17 tables, three labeled sub-domains below.

> _Last verified: 2026-06-10 @ snapshot 2026-06-10, commit `cbcf7c7` (branch `feat/free-tier-coaches`). **`file:line` refs reflect the WORKING TREE at authoring**, which carries uncommitted edits in several cited files (`lib/platform-auth.ts` +20 at L123 = the new `requireSuperAdmin`, so the RBAC cites at L10–95 are above it and identical to `cbcf7c7`; `lib/import/types.ts` +2 at L61 = `emailsSent?`; plus `app/api/admin/tournaments/route.ts`, `app/api/admin/teams/route.ts`, `.../registrations/import/commit/route.ts`, `components/admin/import/TournamentTeamsImportDialog.tsx`) — line numbers in those files may differ by a few lines from `cbcf7c7`; the schema/RLS/grant/trigger facts are commit-independent. Live probes (2026-06-10, dev+prod `information_schema`/`pg_class`/`pg_policies`/`pg_trigger`/`role_table_grants`): all 17 tables are **column-, CHECK-, UNIQUE-, FK-identical dev↔prod (ZERO structural drift)**; **RLS ENABLED with ZERO policies and ZERO triggers** on every one of the 17 in both envs; **prod grants `anon`+`authenticated` full `SELECT/INSERT/UPDATE/DELETE` on 16 of the 17 (all but `plan_gating`, which is `service_role`-only) while dev grants only `REFERENCES/TRIGGER/TRUNCATE`** (the security headline below); content/row-counts probed (see per-table dead/unused notes)._

### Gotchas first (the cross-cutting traps)

- **SECURITY HEADLINE — RLS-with-zero-policies is the ONLY thing keeping this entire control plane off prod's public PostgREST API.** Probed live: **prod** grants `anon`+`authenticated` the full `SELECT/INSERT/UPDATE/DELETE` set on **16 of the 17** tables (the lone exception, `plan_gating`, grants only `service_role` — even tighter); **dev** grants only `REFERENCES/TRIGGER/TRUNCATE`. All 17 are RLS-**enabled** with **zero policies** (both envs), so `anon`/`authenticated` resolve to **0 rows** via PostgREST and `supabaseAdmin` (service-role, `BYPASSRLS`) does all I/O. This is the [[reference_supabase_rls_grants]] class: if any policy is ever *added* (or RLS disabled) on prod, the RBAC table, the mutation audit log, every org's plan-change history, and the PII-bearing import staging leak to the anonymous REST API. **Never "simplify" by disabling RLS or adding a permissive policy.**
- **Everything is service-role + app-layer auth — RLS is never the gate.** Every reader/writer goes through `supabaseAdmin`; authorization is `platform_users` role → `ROLE_PERMISSIONS` ([lib/platform-auth.ts:26](../../../lib/platform-auth.ts#L26)) plus the per-area view/write matrix in [lib/platform-areas.ts](../../../lib/platform-areas.ts). (The two `import_*` tables are the exception — they gate on **org** membership capabilities, not platform role; see that sub-domain.)
- **The RBAC bootstrap is an ENV allowlist, not the DB table — which is why prod has 0 `platform_users` rows.** `getPlatformAdminContext` checks `isBootstrapAdmin(email)` against the `PLATFORM_ADMIN_EMAILS` env list **first** and short-circuits to `role='super_admin'` with **no DB read** ([lib/platform-auth.ts:89-91](../../../lib/platform-auth.ts#L89), env parsed [:35-45](../../../lib/platform-auth.ts#L35)); the DB table is the *secondary, optional* staff-management layer ([:55-68](../../../lib/platform-auth.ts#L55)). Six roles live in the CHECK (`super_admin|support|billing|product|growth|read_only`); `normalizePlatformRole` maps legacy `'admin'`→`super_admin` and coerces any unknown value to `read_only` (fail-safe, never throws, [:47-53](../../../lib/platform-auth.ts#L47)).
- **Zero triggers anywhere ⇒ every `updated_at` is CODE-maintained, and several tables have none at all.** No table in this domain has a trigger (probed). `updated_at`/`completed_at`/`committed_at` are set explicitly by their writers (or, on `platform_plan_versions`/`platform_addon_catalog`, only ever by migrations → frozen at seed); `platform_audit_log`, `platform_admin_visits`, `platform_catalog_change_applications`, `platform_metric_snapshots`, `import_batch_rows` are append-only with no `updated_at` column.
- **"Looks authoritative but isn't" — the runtime-source split is the crux of the Plans & catalog sub-domain.** The static `PLAN_CONFIG` const ([lib/plan-config.ts:32](../../../lib/plan-config.ts#L32)) is the true entitlement/limit floor. Of the DB catalog tables: **`plan_gating` IS runtime-consumed** (checkout gating, DB overlaid on the static fallback, [lib/plan-gating-server.ts:38-50](../../../lib/plan-gating-server.ts#L38)); **`plan_config_overrides` is consumed at CHECKOUT only** (sets the limit written onto the new subscription, [lib/plan-config-db.ts:44-59](../../../lib/plan-config-db.ts#L44)); **`platform_plan_module_entitlements`, `platform_plan_versions`, `platform_addon_catalog`, and `platform_catalog_campaigns` are admin-display / planning catalogs NOT read by any runtime entitlement path** — editing the feature matrix changes the admin display, **not** what `hasModuleEntitlement` enforces (that reads static `PLAN_CONFIG`, [lib/module-entitlements.ts:13](../../../lib/module-entitlements.ts#L13)).
- **The catalog-governance gate authorizes by `proposal.kind`, not `request_type`, and has NO separation of duties.** Every governed write (`stripe_prices`, `plan_gating`, `plan_config_overrides`, the feature matrix) requires `manage_product` **and** an `approved` `platform_catalog_change_requests` row; the apply branches solely on `proposal.kind` ([change-requests/route.ts:682-687](../../../app/api/platform-admin/product-catalog/change-requests/route.ts#L682)), so `request_type` is descriptive metadata only. The **same** `manage_product` permission gates both submit and approve, with **no submitter-vs-reviewer check** — a `product`/`super_admin` user can approve and apply their own request. The `_change_applications` ledger is **best-effort** (`recordCatalogChangeApplication` swallows insert errors, [lib/platform-catalog-approval.ts:85-87](../../../lib/platform-catalog-approval.ts#L85)); **`platform_audit_log` is the durable trail.**
- **`actor_email` is the universal, FK-less actor identity** across `platform_audit_log` / `platform_admin_visits` / `platform_events` / `platform_catalog_change_applications` — captured at write time, often the literal fallback string `'platform-admin'` when the session email is null. Treat it as a denormalized label, never a reliable join key to a user.
- **Five tables are built-but-(barely-)used today.** `platform_user_notes` (0 rows both envs — full CRUD + UI exist, never exercised), `platform_bulk_operations` (0/0 — never run), `platform_metric_snapshots` (0/0 — never taken), `platform_catalog_campaigns` (0/0 — pure planning scaffolding, no checkout/Stripe consumer), `platform_plan_versions` (1 seed row, **no app writer**). Documented so a reader doesn't mistake schema presence for an active feature.
- **`import_batches`/`import_batch_rows` are ORG-scoped, not platform-admin.** The coverage classifier files them here (an ops/staging surface), but they are gated by **org** capabilities and `org_id` FK→`organizations` ON DELETE CASCADE — the tournament data-import staging an org admin uses, not a `/platform-admin` feature.
- **Dev/prod:** zero structural drift on all 17 (column/CHECK/UNIQUE/FK-identical). Divergence is **content + grants** only: prod `anon`/`authenticated` hold full DML on 16 of 17 (dev doesn't; `plan_gating` is `service_role`-only in both); and several tables differ in row counts (e.g. `plan_config_overrides` dev 4 / prod 0 ⇒ **prod runs on pure static `PLAN_CONFIG` defaults**; `platform_events` dev 210 / prod 0; `platform_catalog_change_requests` dev 6 / prod 14).

---

## Platform identity, RBAC & audit

> Who may operate the platform, and the three append-only logs of platform activity. `platform_users` (+ the `PLATFORM_ADMIN_EMAILS` env bootstrap) is the authz spine; **`platform_audit_log`** records privileged *mutations* (active), **`platform_admin_visits`** records *navigation* telemetry (passive), and **`platform_events`** is the *business-event* log (billing/plan transitions + acquisition/feature telemetry) — three distinct logs, easy to confuse. `platform_user_notes` is staff notes about *customer* users.

### `platform_users`
<!-- dict:table:platform_users -->

**Purpose:** the DB-managed allowlist of FieldLogicHQ internal staff who may access `/platform-admin`, each with an RBAC `role`. It is the **secondary** authz layer — the `PLATFORM_ADMIN_EMAILS` env allowlist is the primary/bootstrap path (and the reason prod works with **0 rows**: dev 1 / prod 0).

**Gotchas (read first):**
1. **Not the sole source of truth** — `getPlatformAdminContext` returns `role='super_admin'` + `isBootstrapAdmin:true` for any `PLATFORM_ADMIN_EMAILS` email **before** any DB read ([lib/platform-auth.ts:89-91](../../../lib/platform-auth.ts#L89)); the DB lookup is the fallback path ([:55-63](../../../lib/platform-auth.ts#L55), filtered `is_active=true`, email lowercased).
2. **Unknown roles fail safe to `read_only`** and legacy `'admin'`→`super_admin` via `normalizePlatformRole` ([:47-53](../../../lib/platform-auth.ts#L47)) — a future role value not added to that map silently degrades, never errors.
3. **Bootstrap (env) admins appear in the Company Users UI as synthetic rows** (`id="bootstrap:<email>"`, `invitedBy='env:PLATFORM_ADMIN_EMAILS'`, [users/page.tsx:12-23](../../../app/platform-admin/users/page.tsx#L12)) and are **blocked from deletion** ([company-users/[id]/route.ts:50-54](../../../app/api/platform-admin/company-users/[id]/route.ts#L50)).
4. **Removing a staffer is a two-system op** — DELETE refuses the last active user ([:56-58](../../../app/api/platform-admin/company-users/[id]/route.ts#L56)) **and** deletes the matching Supabase `auth.users` account by email ([:61-65](../../../app/api/platform-admin/company-users/[id]/route.ts#L61)). Invite (POST) creates the `auth.users` account (`email_confirm:true`) and returns a one-time `setupLink` the admin must hand-deliver — **no invite email is sent** ([company-users/route.ts:26-61](../../../app/api/platform-admin/company-users/route.ts#L26)).
5. **Writes need `manage_platform_users` (super_admin only)** and the whole area is super_admin-only for view+write ([lib/platform-areas.ts:62](../../../lib/platform-areas.ts#L62)) — other roles can't even see the staff list.

**Fields** (boilerplate `id`, `created_at`, `updated_at` omitted — `updated_at` is code-maintained, [lib/db.ts:6157](../../../lib/db.ts#L6157)):

<!-- dict:col:platform_users.email -->
**`email`** (text, NOT NULL; UNIQUE) — canonical staff identity; stored lowercased ([lib/db.ts:6141](../../../lib/db.ts#L6141)) and matched lowercased on read ([lib/platform-auth.ts:59](../../../lib/platform-auth.ts#L59)); the implicit link to the `auth.users` account and the value compared against `PLATFORM_ADMIN_EMAILS`.

<!-- dict:col:platform_users.display_name -->
**`display_name`** (text, nullable) — optional human label; set on invite/update, mapped to `displayName` ([lib/db.ts:6101](../../../lib/db.ts#L6101)).

<!-- dict:col:platform_users.role -->
**`role`** (text, NOT NULL, default `'support'`; CHECK `super_admin|support|billing|product|growth|read_only`) — the RBAC role driving `ROLE_PERMISSIONS` ([lib/platform-auth.ts:26-33](../../../lib/platform-auth.ts#L26)). Read via `getDbPlatformRole`→`normalizePlatformRole`; the 6 perms are `manage_platform_users` (super_admin only), `manage_billing`, `manage_growth`, `manage_product`, `manage_support`, `view_platform_admin`. `growth` is a live wired role (`manage_growth`+view), not dormant. API validates against the 6-value list before write ([company-users/route.ts:21](../../../app/api/platform-admin/company-users/route.ts#L21)).

<!-- dict:col:platform_users.is_active -->
**`is_active`** (bool, NOT NULL, default true) — soft-disable; the auth lookup filters `is_active=true` so `false` = no access without deleting the row ([lib/platform-auth.ts:60](../../../lib/platform-auth.ts#L60)).

<!-- dict:col:platform_users.invited_by -->
**`invited_by`** (text, nullable, no FK) — email of the staffer who created the row, from `auth.user.email` on invite ([lib/db.ts:6144](../../../lib/db.ts#L6144)); synthetic bootstrap rows show `'env:PLATFORM_ADMIN_EMAILS'`.

### `platform_audit_log`
<!-- dict:table:platform_audit_log -->

**Purpose:** the append-only **platform-admin mutation log** — one row per privileged staff action against an org or platform object. THE record-of-who-changed-what for the control plane (dev 117 / prod 53). Written by the shared `writePlatformAuditLog` helper ([lib/platform-audit.ts:4](../../../lib/platform-audit.ts#L4)) from ~30 routes; read by the global audit page, the per-org activity feed, and the CSV export.

**Gotchas (read first):**
1. **Append-only + best-effort** — `writePlatformAuditLog` INSERTs and on error only `console.error`s; it **never throws**, so a failed audit write does not block or roll back the action it was logging ([lib/platform-audit.ts:11-21](../../../lib/platform-audit.ts#L11)). Completeness is not guaranteed.
2. **`action` is free-text (no CHECK)** — dozens of verbs invented at call sites; the audit page builds its filter dropdown by SELECTing all `action` values and de-duping in JS ([audit/page.tsx:105-111](../../../app/platform-admin/audit/page.tsx#L105)), so retired call sites leave orphan verbs in the filter.
3. **`field`/`old_value`/`new_value` are an action-defined, untyped triple** — meaning differs per call site (a whole before/after object for `update_platform_user` vs a scalar for `create_user_note`); no schema contract.
4. **`org_id` FK is ON DELETE SET NULL** — deleting an org orphans its audit rows (org_id→null) rather than cascading, so history survives but loses org linkage.
5. **Viewable by ALL platform roles, no write role** ([lib/platform-areas.ts:44](../../../lib/platform-areas.ts#L44)) — rows are only ever side-effects of other gated actions; there is no "create audit row" endpoint.

**Fields** (boilerplate `id`, `created_at` omitted — `created_at` is the DESC sort + date-range filter key, [audit/page.tsx:71-75](../../../app/platform-admin/audit/page.tsx#L71)):

<!-- dict:col:platform_audit_log.actor_email -->
**`actor_email`** (text, NOT NULL, no FK) — who performed the action (1st arg to the writer); usually `auth.user.email`, falls back to the literal `'platform-admin'`. Filterable + searchable in the UI.

<!-- dict:col:platform_audit_log.org_id -->
**`org_id`** (uuid, nullable; FK→`organizations(id)` ON DELETE SET NULL) — the org the action targeted, or null for platform-scoped actions (e.g. `invite_platform_user`, `create_user_note`). Joined to `organizations(id,name)` for display on the global audit page ([audit/page.tsx:70](../../../app/platform-admin/audit/page.tsx#L70)); filtered by `org_id` (no join) for the per-org recent-activity feed ([orgs/[id]/page.tsx:142](../../../app/platform-admin/orgs/[id]/page.tsx#L142)).

<!-- dict:col:platform_audit_log.action -->
**`action`** (text, NOT NULL, no CHECK) — the verb (e.g. `update_plan`, `cancel_subscription`, `transfer_org_ownership`, `delete_organization`, `run_bulk_operation`, `update_stripe_price_id`, `update_plan_gating`, `publish_feature_matrix_entitlements`, `create/delete_user_note`, `invite/update/remove_platform_user`). Rendered via an `ACTION_LABELS` map with snake→space fallback.

<!-- dict:col:platform_audit_log.field -->
**`field`** (text, nullable) — optional sub-target label naming what changed (e.g. `'plan_and_limit'`, `'platform_users'`); 4th arg, purely descriptive, paired with old/new for the diff display.

<!-- dict:col:platform_audit_log.old_value -->
**`old_value`** (jsonb, nullable) — prior state (5th arg, null-coerced when undefined); action-specific shape (scalar, string, or whole before-object); truncated to 80 chars in the UI.

<!-- dict:col:platform_audit_log.new_value -->
**`new_value`** (jsonb, nullable) — resulting state (6th arg, null-coerced); same per-action polymorphic shape as `old_value`.

### `platform_user_notes`
<!-- dict:table:platform_user_notes -->

**Purpose:** free-text internal staff notes **about a CUSTOMER (org) user** — *not* about platform staff. Surfaced in the Customer Users admin drawer. Built and fully wired (GET/POST/DELETE) but holds **0 rows on both envs** — never used.

**Gotchas (read first):**
1. **Despite the name, these are notes about `auth.users` customers** — FK `user_id`→`auth.users(id)` ON DELETE CASCADE; the only caller passes a customer user id from the Customer Users table ([CustomerUsersClient.tsx:330](../../../app/platform-admin/customer-users/CustomerUsersClient.tsx#L330)). There is **no** notes table for platform staff. (Org-level notes are the separate `org_internal_notes` table — Org / Platform core.)
2. **CASCADE delete** ⇒ deleting the customer's `auth.users` account wipes their notes; not a durable trail (note create/delete also writes a `platform_audit_log` row — create [users/[id]/notes/route.ts:58](../../../app/api/platform-admin/users/[id]/notes/route.ts#L58), delete [users/[id]/notes/[noteId]/route.ts:26](../../../app/api/platform-admin/users/[id]/notes/[noteId]/route.ts#L26)).
3. **Asymmetric gating** — GET requires only `requirePlatformAdmin` (any role) but POST/DELETE require `manage_support` ([:36](../../../app/api/platform-admin/users/[id]/notes/route.ts#L36)) — product/growth/read_only can read but not write.
4. **Immutable** — GET/POST/DELETE only, no PATCH route; editing = delete + recreate. DELETE is scoped by both note id **and** user id.

**Fields** (boilerplate `id`, `created_at` omitted — no `updated_at`, notes are immutable):

<!-- dict:col:platform_user_notes.user_id -->
**`user_id`** (uuid, NOT NULL; FK→`auth.users(id)` ON DELETE CASCADE) — the **customer** the note is about; filter key for listing and set from the route param ([:49](../../../app/api/platform-admin/users/[id]/notes/route.ts#L49)). Indexed `(user_id, created_at DESC)`.

<!-- dict:col:platform_user_notes.body -->
**`body`** (text, NOT NULL; CHECK `char_length(body) <= 4000`) — the note text; the route also trims/slices to 4000 and rejects empty before insert ([:41-45](../../../app/api/platform-admin/users/[id]/notes/route.ts#L41)), so the CHECK is belt-and-suspenders.

<!-- dict:col:platform_user_notes.created_by_email -->
**`created_by_email`** (text, NOT NULL, no FK) — the authoring staffer's email, from `auth.user.email!` ([:49](../../../app/api/platform-admin/users/[id]/notes/route.ts#L49)).

### `platform_admin_visits`
<!-- dict:table:platform_admin_visits -->

**Purpose:** lightweight navigation telemetry — one row per platform-admin route view by a signed-in staffer (dev 262 / prod 32). Its **sole** functional use is the "Last visit" timestamp on the Overview, which drives "since last visit" deltas (e.g. newly past-due orgs).

**Gotchas (read first):**
1. **Written on EVERY client navigation** — `PlatformVisitRecorder` POSTs on each pathname change ([PlatformVisitRecorder.tsx:9-19](../../../app/platform-admin/PlatformVisitRecorder.tsx#L9)), mounted in both layout branches; rows accumulate fast and **there is no retention sweep** — the table grows monotonically forever.
2. **Only ONE thing reads it** — `getPreviousPlatformAdminVisit` returns the single most-recent row by `actor_email` ([lib/platform-admin-visits.ts:3-18](../../../lib/platform-admin-visits.ts#L3)), consumed only by the Overview ([page.tsx:104](../../../app/platform-admin/page.tsx#L104)). There is no "recent visits" list view; `actor_user_id` is never even selected, and `path` *is* selected by the reader ([lib/platform-admin-visits.ts:6](../../../lib/platform-admin-visits.ts#L6)) but never **consumed** (the Overview uses only `visited_at`) — effectively write-only telemetry.
3. **`path` is sanitized server-side** — anything not starting `/platform-admin` is forced to `/platform-admin` and capped at 300 chars ([lib/platform-admin-visits.ts:29](../../../lib/platform-admin-visits.ts#L29)); the login route is excluded from recording.

**Fields** (boilerplate `id` omitted; no `created_at`/`updated_at` — `visited_at` is the timestamp):

<!-- dict:col:platform_admin_visits.actor_user_id -->
**`actor_user_id`** (uuid, nullable, no FK [cross-schema to `auth.users`]) — the visiting staffer's id, always supplied (`auth.user.id`) so effectively never null; not used by the only reader.

<!-- dict:col:platform_admin_visits.actor_email -->
**`actor_email`** (text, NOT NULL, no FK) — visiting staffer's email, lowercased on write, fallback `'platform-admin'`; the lookup key for `getPreviousPlatformAdminVisit`. Indexed `(actor_email, visited_at DESC)`.

<!-- dict:col:platform_admin_visits.path -->
**`path`** (text, NOT NULL, default `'/platform-admin'`) — the route visited, sanitized as above; selected by the reader but **not actually consumed** by the Overview (only `visited_at` is).

<!-- dict:col:platform_admin_visits.visited_at -->
**`visited_at`** (timestamptz, NOT NULL, default now()) — visit time; the only column the Overview consumes (ordered DESC limit 1).

### `platform_events`
<!-- dict:table:platform_events -->

**Purpose:** the durable platform **business-event** log (mig 053) — plan/subscription lifecycle transitions, Tournament-Plus acquisition/feature telemetry, and team-org link/billing/ownership lifecycle events (dev 210 / prod 0). Written by ~27 files (~43 call sites) via `writePlatformEvent` ([lib/platform-events.ts:51](../../../lib/platform-events.ts#L51)); the **only reader** is `getCommandCenterStats`, which consumes just the 4 billing-lifecycle types for the Overview.

**Gotchas (read first):**
1. **THE LOG BOUNDARY** — this is the *business*-event log; Observability's `error_groups`/`error_events` (mig 118) are the *error* log. No FK, no shared writer; do not conflate. The `event_type` domain is exactly the `PlatformEventType` union ([lib/platform-events.ts:3-34](../../../lib/platform-events.ts#L3)) — a naive grep for `eventType:` collides with the unrelated in-app-bell `notify()` and calendar systems that reuse the field name.
2. **Dedup is app-side, best-effort, and has a TOCTOU race** — `writePlatformEvent` dedups **only when `source_event_id` is set**: SELECT by `(source, source_event_id)`, bail if found, else insert ([:52-65](../../../lib/platform-events.ts#L52)). No atomic upsert, **no live unique constraint in the snapshot** (only the PK + org_id FK), so two concurrent Stripe retries can both pass the check and double-insert. The vast majority of writes pass no `source_event_id` and skip dedup entirely.
3. **One Stripe event ⇒ up to three rows** — the webhook suffixes the id (`${event.id}:plan_downgraded` / `:subscription_past_due` / `:subscription_recovered`, [webhook/route.ts:257](../../../app/api/billing/webhook/route.ts#L257)), each individually idempotent.
4. **Write-mostly** — of the 31 `event_type` values, only **4** are ever read (`subscription_canceled`, `plan_downgraded`, `subscription_past_due`, `subscription_recovered`, [lib/platform-metrics.ts:158](../../../lib/platform-metrics.ts#L158)); all `tournament_plus_*` and `team_org_*` families are captured but consumed by no code path (dead capture — no funnel/team-org dashboard exists yet). The TS `source` values `'platform_admin'` (team-ownership transfer [lib/team-ownership-transfer.ts:610](../../../lib/team-ownership-transfer.ts#L610) + dev seed) and `'founding_season'` (the founding-season recovery-comp path [create-checkout/route.ts:268](../../../app/api/billing/create-checkout/route.ts#L268)) **are** written, just rarely.
5. **`occurred_at` ≠ `created_at`** — `occurred_at` is the business-event time (writer-supplied, default now()) and is what all metrics window/order on; `created_at` is the insert time. Append-only (no writer ever UPDATEs).

**Fields** (boilerplate `id`, `created_at` omitted):

<!-- dict:col:platform_events.event_type -->
**`event_type`** (text, NOT NULL, **no DB CHECK**) — the business-event discriminator; TS-typed (not DB-enforced) to the 31-value `PlatformEventType` union. Read-side only matches the 4 billing types.

<!-- dict:col:platform_events.source -->
**`source`** (text, NOT NULL, default `'app'`, no CHECK) — provenance; TS union `app|stripe|mock|platform_admin|migration_053|founding_season`. Live values: `app` (most), `stripe` (webhook), `mock`, `migration_053` (the one-time backfill), plus the rare `founding_season` (recovery-comp path) and `platform_admin` (team-ownership transfer / dev seed). First half of the dedup key.

<!-- dict:col:platform_events.source_event_id -->
**`source_event_id`** (text, nullable) — external idempotency key, second half of the dedup key; for Stripe `${event.id}:<transition>`. NULL for almost all `app`-source writes (which therefore skip dedup).

<!-- dict:col:platform_events.org_id -->
**`org_id`** (uuid, nullable; FK→`organizations(id)` ON DELETE SET NULL) — the tenant; nulled (not deleted) on org removal so lifecycle telemetry survives. May be NULL for some Stripe team-workspace writes.

<!-- dict:col:platform_events.actor_user_id -->
**`actor_user_id`** (uuid, nullable, **no FK** — bare uuid, soft pointer to `auth.users`) — user who triggered the event when known (from `ctx.user.id`); NULL for stripe/webhook/public writes.

<!-- dict:col:platform_events.actor_email -->
**`actor_email`** (text, nullable) — denormalized actor email captured at write time; NULL for system/stripe writes.

<!-- dict:col:platform_events.previous_plan_id -->
**`previous_plan_id`** (text, nullable, free-text plan key, no FK) — plan before a plan-change event; set on lifecycle transitions, NULL for feature/acquisition/team-org events.

<!-- dict:col:platform_events.plan_id -->
**`plan_id`** (text, nullable, free-text, no FK) — plan after the event / current plan key; also passed through on feature-usage events for segmentation.

<!-- dict:col:platform_events.previous_subscription_status -->
**`previous_subscription_status`** (text, nullable) — subscription status before the transition (raw Stripe-ish string); drives `isPastDueTransition`/`isRecoveryTransition` ([lib/platform-events.ts:89-96](../../../lib/platform-events.ts#L89)).

<!-- dict:col:platform_events.subscription_status -->
**`subscription_status`** (text, nullable) — subscription status after the transition (raw string); NULL for non-billing events.

<!-- dict:col:platform_events.metadata -->
**`metadata`** (jsonb, NOT NULL, default `{}`) — per-event-type payload bag. Key catalog by family: billing → `{stripeSubscriptionId, priceId, billingCycle}`; downgrade → `{retainedTournamentIds, keepTournamentIds, retentionUntil, reason}`; `tournament_plus_feature_used` → `{feature, action, tournamentId, status, notified, reason}`; acquisition CTA → `{acquisitionSource, surface, orgSlug, tournamentSlug, tournamentId, currentPath, ctaHref}`; team-org-link → `{teamWorkspaceId, linkedOrgId, repTeamId, …}`. **Not read by any consumer today** (the metrics reader selects only `event_type`+`occurred_at`).

<!-- dict:col:platform_events.occurred_at -->
**`occurred_at`** (timestamptz, NOT NULL, default now()) — the business-event time; all metrics windowing/ordering uses this, never `created_at` ([lib/platform-metrics.ts:159](../../../lib/platform-metrics.ts#L159)).

---

## Plans & catalog control plane

> The plan/pricing/feature catalog and its **human-in-the-loop change-approval gate**. The runtime entitlement floor is the static `PLAN_CONFIG` const — these DB tables either overlay it on specific hot paths (`plan_gating`, `plan_config_overrides`) or are **admin-display / planning catalogs** (`platform_plan_module_entitlements`, `platform_plan_versions`, `platform_addon_catalog`, `platform_catalog_campaigns`). Every governed write flows through `platform_catalog_change_requests` → `_change_applications` and is mirrored to `platform_audit_log`.

### `plan_gating`
<!-- dict:table:plan_gating -->

**Purpose:** the per-plan checkout gating switch managed by platform admins (6 rows after Club Repackaging, PK `plan_key`). `gating_status='early_access'` blocks self-serve Stripe Checkout for that plan and shows an early-access CTA; `'live'` opens it. **Runtime-consumed** — `getPlanGatingMap` overlays these rows on the static `PLAN_CONFIG.gatingStatus` fallback.

**Gotchas (read first):**
1. **This table IS consumed at runtime** — `getPlanGatingMap` selects `plan_key/gating_status` and overlays it on the code fallback ([lib/plan-gating-server.ts:38-50](../../../lib/plan-gating-server.ts#L38)); a DB edit here actually changes checkout behavior. It drives the 403 in `create-checkout` ([:120-126](../../../app/api/billing/create-checkout/route.ts#L120)) and is also read by the home + pricing pages, coaches start/claim, and `create-team-checkout`.
2. **Two env/cookie short-circuits force all plans live, bypassing the DB** — `NEXT_PUBLIC_DEV_PLAN_GATES_TOGGLE` + `dev_plan_gates` cookie, and `NEXT_PUBLIC_PLAN_GATES='live'` ([lib/plan-gating-server.ts:31-36](../../../lib/plan-gating-server.ts#L31)).
3. **Fails OPEN, not closed** — a DB read error or zero rows silently reverts to `PLAN_CONFIG.gatingStatus` defaults ([:42](../../../lib/plan-gating-server.ts#L42)).
4. **UPDATE-only write path** (`.update().eq('plan_key',…)`, [plan-gating/route.ts:67-75](../../../app/api/platform-admin/plan-gating/route.ts#L67)) — the 5 rows are migration-seeded; no insert path. Every edit needs `manage_product` **and** an approved change request (type `plan_version|pricing|campaign|trial`). A separate static `isEffectivelyGated` ([lib/plan-config.ts:108](../../../lib/plan-config.ts#L108)) reads only the code default — don't confuse it with the DB-merged `getPlanGatingMap`.

**Fields:**

<!-- dict:col:plan_gating.plan_key -->
**`plan_key`** (text, NOT NULL, PK; CHECK `tournament|team|tournament_plus|league|club|club_large`) — plan identity + PK; matched against `OrgPlan` keys when overlaying. (`club_large` added in mig 144, Club Repackaging — seeded `early_access`; the route does UPDATE-only so the seed row is required for the gating toggle to work.) ([lib/plan-gating-server.ts:46](../../../lib/plan-gating-server.ts#L46)). The `team` row only matters to the coach/team checkout + display reads (general `create-checkout` 400s `team`).

<!-- dict:col:plan_gating.gating_status -->
**`gating_status`** (text, NOT NULL, default `'early_access'`; CHECK `live|early_access`) — `early_access` ⇒ gated=true (checkout 403s); `live` ⇒ open.

<!-- dict:col:plan_gating.updated_by_email -->
**`updated_by_email`** (text, nullable) — last editor's email, from `auth.user.email` ([plan-gating/route.ts:72](../../../app/api/platform-admin/plan-gating/route.ts#L72)); display/audit only.

<!-- dict:col:plan_gating.last_change_note -->
**`last_change_note`** (text, nullable) — free-text rationale, sanitized via `sanitizePlatformChangeNote`; display/audit only. (`updated_at` is code-maintained, nullable; never-edited seed rows can be null.)

### `plan_config_overrides`
<!-- dict:table:plan_config_overrides -->

**Purpose:** per-plan numeric overrides (`tournament_limit`, `seat_limit`, `trial_days`) layered **over** the static `PLAN_CONFIG` defaults. Sparse — a row exists only if an admin overrode that plan; null fields mean "use the code default" (dev 4 / prod 0, so **prod runs on pure `PLAN_CONFIG`**).

**Gotchas (read first):**
1. **Merge precedence: DB non-null wins, else default** — `override?.tournament_limit ?? base.tournamentLimit` (and seat/trial) ([lib/plan-config-db.ts:53-55](../../../lib/plan-config-db.ts#L53)).
2. **Consumed at CHECKOUT only** — `create-checkout` resolves the merged config ([create-checkout/route.ts:118](../../../app/api/billing/create-checkout/route.ts#L118)) and writes the merged `tournamentLimit` onto `organizations.tournament_limit` ([:142](../../../app/api/billing/create-checkout/route.ts#L142) direct-apply / [:217](../../../app/api/billing/create-checkout/route.ts#L217) Stripe path; `trialDays` at [:334](../../../app/api/billing/create-checkout/route.ts#L334)); `create-team-checkout` calls `getPlanConfigOverride('team')` ([:171](../../../app/api/billing/create-team-checkout/route.ts#L171)). It sets the base default *written into the org row at checkout* — it is **not** the ongoing per-org cap (that's `organizations.tournament_limit` + `getEffectiveTournamentLimit`'s `Math.min` clamp, a different mechanism — see the stale-cap gotcha in Org / Platform core).
3. **`UNIQUE(plan_id)` backs an upsert** (`onConflict:'plan_id'`); clearing an override = writing null fields, **not** deleting the row ([lib/plan-config-db.ts:74-97](../../../lib/plan-config-db.ts#L74)). Two writers (direct plan-config PATCH + the inline catalog-request apply), both requiring `manage_product` + an approved request.

**Fields** (boilerplate `id`, `updated_at` omitted — `updated_at` code-maintained):

<!-- dict:col:plan_config_overrides.plan_id -->
**`plan_id`** (text, NOT NULL; UNIQUE — **no CHECK**, unlike `plan_gating.plan_key`) — which plan the override applies to. The app validates against the 5-plan list on write ([plan-config/route.ts:25](../../../app/api/platform-admin/plan-config/route.ts#L25)) but the DB does not, so a service-role write could insert an off-list `plan_id`.

<!-- dict:col:plan_config_overrides.tournament_limit -->
**`tournament_limit`** (integer, nullable) — override for max non-archived tournaments; null ⇒ `PLAN_CONFIG` default. The merged value is written to `organizations.tournament_limit` at checkout.

<!-- dict:col:plan_config_overrides.seat_limit -->
**`seat_limit`** (integer, nullable) — override for the staff seat cap; null ⇒ default. Flows through `getPlanConfigOverride`'s `MergedPlanLimits`; `create-checkout` itself persists only `tournament_limit` to the org.

<!-- dict:col:plan_config_overrides.trial_days -->
**`trial_days`** (integer, nullable) — override for the Stripe trial length; null ⇒ default; the merged value feeds the Checkout trial config.

<!-- dict:col:plan_config_overrides.updated_by_email -->
**`updated_by_email`** (text, nullable) — admin who last set the override; audit/display only.

<!-- dict:col:plan_config_overrides.last_change_note -->
**`last_change_note`** (text, nullable) — sanitized rationale for the override change; audit/display only.

### `platform_plan_versions`
<!-- dict:table:platform_plan_versions -->

**Purpose:** an append-only catalog of named plan-packaging versions (draft/scheduled/published/archived) for product-planning history (1 seed row, both envs). **Not consumed by any runtime billing/entitlement path** — read only as a history list on the plans-pricing admin page, and used as an FK target for change requests.

**Gotchas (read first):**
1. **ZERO app writers** — the single row was seeded by migration 058 (`'current-2026-05'`, `status='published'`, `created_by_email='migration_058'`); no insert/update/upsert exists in app code, so `updated_at`/`published_at` are frozen at seed. `draft`/`scheduled`/`archived` statuses are never produced.
2. **`snapshot` is write-once-never-read** — seeded by mig 058 but the page SELECT omits it ([plans-pricing/page.tsx:170](../../../app/platform-admin/plans-pricing/page.tsx#L170)) — its contents are dead.
3. **Its only structural role is as an FK target** — `platform_catalog_change_requests.target_version_id`→here ON DELETE SET NULL (but that FK column is itself never read/written — see change-requests).

**Fields** (boilerplate `id`, `created_at`, `updated_at` omitted):

<!-- dict:col:platform_plan_versions.version_key -->
**`version_key`** (text, NOT NULL, UNIQUE) — human key (seed `'current-2026-05'`); displayed as a fallback label.

<!-- dict:col:platform_plan_versions.title -->
**`title`** (text, NOT NULL) — display title (seed `'Current public catalog'`); display only.

<!-- dict:col:platform_plan_versions.description -->
**`description`** (text, nullable) — optional long description; shown in the version list.

<!-- dict:col:platform_plan_versions.status -->
**`status`** (text, NOT NULL, default `'draft'`; CHECK `draft|published|scheduled|archived`) — lifecycle state; only `'published'` exists in data, the rest are unused scaffolding (no code transitions it).

<!-- dict:col:platform_plan_versions.effective_at -->
**`effective_at`** (timestamptz, nullable) — when the version takes effect (seeded now()); display only.

<!-- dict:col:platform_plan_versions.published_at -->
**`published_at`** (timestamptz, nullable) — when published (seeded now()); display only.

<!-- dict:col:platform_plan_versions.created_by_email -->
**`created_by_email`** (text, nullable) — author; the seed reads the literal `'migration_058'`.

<!-- dict:col:platform_plan_versions.snapshot -->
**`snapshot`** (jsonb, NOT NULL, default `{}`) — **dead column**: seeded with `{plans, source:'PLAN_CONFIG', purpose}` by mig 058 but never SELECTed by any code.

<!-- dict:col:platform_plan_versions.notes -->
**`notes`** (text, nullable) — free-text notes; selected by the page for display ([plans-pricing/page.tsx:170](../../../app/platform-admin/plans-pricing/page.tsx#L170)) — only `snapshot` is omitted from that SELECT.

### `platform_plan_module_entitlements`
<!-- dict:table:platform_plan_module_entitlements -->

**Purpose:** an admin-editable mirror of which modules each plan includes — the `(plan_id × module_key)` grid behind the platform-admin **Feature Matrix** (35 rows = 5 plans × 7 modules). **IMPORTANT: it is NOT the runtime entitlement source.**

**Gotchas (read first):**
1. **CRUX — not the runtime entitlement source** — the actual route-handler check `hasModuleEntitlement` reads the **static** `PLAN_CONFIG[org.planId].moduleEntitlements` + `org.enabledAddons`, never this table ([lib/module-entitlements.ts:13-20](../../../lib/module-entitlements.ts#L13)). Editing/publishing this table changes the admin Feature-Matrix **display only** — it does not change what any API route enforces, so it can silently drift from real entitlement.
2. **Only reader is the Feature Matrix** — `getEffectivePlanModuleEntitlements` ([lib/plan-module-entitlements.ts:78-105](../../../lib/plan-module-entitlements.ts#L78)) overlays this table on the `PLAN_CONFIG` default (row present ⇒ use `included`; absent ⇒ default; DB error ⇒ default), consumed only by `getFeatureMatrixRows` + the publish route's diff.
3. **Writes upsert the FULL 35-row grid every time** (`onConflict 'plan_id,module_key'`, [:126-138](../../../lib/plan-module-entitlements.ts#L126)) — hence the exact 35-row count; never partial. Gated by `manage_product` + an approved `feature_matrix` change request; refuses a no-op proposal.

**Fields** (boilerplate `updated_at` omitted — code-maintained):

<!-- dict:col:platform_plan_module_entitlements.plan_id -->
**`plan_id`** (text, NOT NULL; part of composite PK `(plan_id, module_key)`; CHECK `tournament|team|tournament_plus|league|club|club_large`) — plan side of the grid; iterated via `PLAN_ORDER`. (`club_large` added in mig 144, Club Repackaging — seeds 7 module rows mirroring `club`.)

<!-- dict:col:platform_plan_module_entitlements.module_key -->
**`module_key`** (text, NOT NULL; part of composite PK; CHECK `module_tournaments|module_communications|module_members|module_public_site|module_house_league|module_accounting|module_rep_teams`) — module side of the grid (= the 7-entry `MODULE_CATALOG`).

<!-- dict:col:platform_plan_module_entitlements.included -->
**`included`** (bool, NOT NULL, default false) — whether the plan includes the module in the **published Feature Matrix**; display/publish only — **not enforced** at runtime.

<!-- dict:col:platform_plan_module_entitlements.updated_by_email -->
**`updated_by_email`** (text, nullable) — admin who last published the matrix; audit/display.

### `platform_addon_catalog`
<!-- dict:table:platform_addon_catalog -->

**Purpose:** a product-planning catalog of add-ons / module packaging (key, label, pricing model, default-included plans, status, optional reference price) — 7 rows. **Not consumed by any runtime entitlement or billing path** (real per-org grants live on `organizations.enabled_addons`; real prices in `stripe_prices`).

**Gotchas (read first):**
1. **NOT live-consumed** — the only reader is the plans-pricing admin page ([plans-pricing/page.tsx:173-176](../../../app/platform-admin/plans-pricing/page.tsx#L173)); no checkout/entitlement code reads it. **ZERO app writers** — all 7 rows are migration-seeded (6 by mig 058, `org_team_addon` by mig 065; mig 065 also UPDATEs `extra_rep_team` → `live`, $19/$190); `updated_at` only moves via migrations.
2. **`status` is a LABEL, not a switch** — 6 of 7 rows are `'live'`, 1 `'planned'` (`support_package`); "live" here is a catalog label with no runtime effect.
3. **`default_included_plans` and the prices are descriptive and can drift** — runtime inclusion is decided by static `PLAN_CONFIG.moduleEntitlements`; the billed amounts come from `stripe_prices`. `addon_key` UNIQUE; `pricing_model`/`status` CHECK-constrained (DB-enforced enums even though nothing reads them at runtime).

**Fields** (boilerplate `id`, `created_at`, `updated_at` omitted):

<!-- dict:col:platform_addon_catalog.addon_key -->
**`addon_key`** (text, NOT NULL, UNIQUE) — stable add-on id (`public_site`, `house_league`, `accounting`, `rep_teams`, `extra_rep_team`, `support_package`, `org_team_addon`); the upsert conflict target in seeding migrations.

<!-- dict:col:platform_addon_catalog.label -->
**`label`** (text, NOT NULL) — display name; read into the admin page's addon catalog.

<!-- dict:col:platform_addon_catalog.description -->
**`description`** (text, nullable) — long description for the planning UI; display only.

<!-- dict:col:platform_addon_catalog.module_key -->
**`module_key`** (text, nullable, **no CHECK**) — which module the add-on maps to (e.g. `module_rep_teams`); null for non-module add-ons like `support_package`; display only.

<!-- dict:col:platform_addon_catalog.status -->
**`status`** (text, NOT NULL, default `'planned'`; CHECK `planned|draft|live|retired`) — catalog lifecycle **label** (6 `live`, 1 `planned`); does not gate anything at runtime.

<!-- dict:col:platform_addon_catalog.default_included_plans -->
**`default_included_plans`** (text[], NOT NULL, default `{}`) — descriptive list of plans that bundle the add-on (e.g. `['league','club']`); purely documentary — can disagree with the real `PLAN_CONFIG` entitlement.

<!-- dict:col:platform_addon_catalog.pricing_model -->
**`pricing_model`** (text, NOT NULL, default `'custom'`; CHECK `included|flat|per_team|per_seat|custom`) — how the add-on would be priced; display/planning only.

<!-- dict:col:platform_addon_catalog.monthly_price -->
**`monthly_price`** (numeric, nullable) — reference monthly price (e.g. `org_team_addon`=29, `extra_rep_team`=19); **not** the billed amount (that's `stripe_prices`); display only.

<!-- dict:col:platform_addon_catalog.annual_price -->
**`annual_price`** (numeric, nullable) — reference annual price; display only.

<!-- dict:col:platform_addon_catalog.effective_at -->
**`effective_at`** (timestamptz, nullable) — optional planning effective date; not set by seeds; display only.

<!-- dict:col:platform_addon_catalog.notes -->
**`notes`** (text, nullable) — planning notes (e.g. `extra_rep_team`'s note points to `stripe_prices` for ids); display only.

### `platform_catalog_change_requests`
<!-- dict:table:platform_catalog_change_requests -->

**Purpose:** the proposal/approval workflow record for any governed catalog change (plan availability, plan limits, Stripe price ids, feature matrix, add-ons, grandfathering, campaigns). A row moves `draft → needs_review → approved → implemented` (or `rejected`/`canceled`); when it reaches `approved` carrying a recognized `proposal.kind`, the PATCH applies the change inline and auto-flips to `implemented`. This is the **human-in-the-loop gate** that authorizes writes to `stripe_prices` / `plan_gating` / `plan_config_overrides` / the feature matrix (dev 6 / prod 14).

**Gotchas (read first):**
1. **Apply branches on `proposal.kind`, NOT `request_type`** (`stripe_price_update` | `plan_gating_update` | `plan_config_update`, [change-requests/route.ts:682-687](../../../app/api/platform-admin/product-catalog/change-requests/route.ts#L682)); `request_type` is descriptive metadata. The kinds `addon`/`grandfathering`/bare `plan_version`/`campaign` have **no auto-apply branch** — they can only be flipped through statuses manually.
2. **Approving auto-advances to `implemented`** (not left at `approved`) when a recognized proposal applies ([:714](../../../app/api/platform-admin/product-catalog/change-requests/route.ts#L714)); the `current.status !== 'implemented'` guard ([:685](../../../app/api/platform-admin/product-catalog/change-requests/route.ts#L685)) makes the **apply** a no-op (no duplicate catalog write) — but the status UPDATE still runs, so re-PATCHing an already-implemented request to `approved` can regress its status.
3. **Optimistic-concurrency on the live target** — if the target already equals the proposed value it records `already_current` and still implements; if the target no longer matches the request's expected `current*` snapshot it **409s** "changed after this request was created" ([:222-255](../../../app/api/platform-admin/product-catalog/change-requests/route.ts#L222)).
4. **No separation of duties** — the same `manage_product` gates POST (submit) and PATCH (approve), with no submitter-vs-reviewer check, so a user can approve their own request ([:593](../../../app/api/platform-admin/product-catalog/change-requests/route.ts#L593) / [:654](../../../app/api/platform-admin/product-catalog/change-requests/route.ts#L654)).

**Fields** (boilerplate `id`, `created_at`, `updated_at` omitted — `updated_at` code-maintained on PATCH):

<!-- dict:col:platform_catalog_change_requests.request_type -->
**`request_type`** (text, NOT NULL; CHECK `plan_version|feature_matrix|addon|pricing|grandfathering|campaign|trial`) — descriptive category, validated on insert; **not** used to choose the apply path (that's `proposal.kind`); display/grouping only.

<!-- dict:col:platform_catalog_change_requests.title -->
**`title`** (text, NOT NULL) — human label, required + trimmed to 160 chars on insert.

<!-- dict:col:platform_catalog_change_requests.description -->
**`description`** (text, nullable) — free-text detail, cleaned to 2000 chars; display.

<!-- dict:col:platform_catalog_change_requests.status -->
**`status`** (text, NOT NULL, default `'draft'`; CHECK `draft|needs_review|approved|rejected|implemented|canceled`) — workflow state; the gate `requireApprovedCatalogChangeRequest` requires `status='approved'` ([lib/platform-catalog-approval.ts:50](../../../lib/platform-catalog-approval.ts#L50)); PATCH may override to `implemented` on auto-apply.

<!-- dict:col:platform_catalog_change_requests.priority -->
**`priority`** (text, NOT NULL, default `'medium'`; CHECK `low|medium|high|launch_blocker`) — triage priority; display/sort only.

<!-- dict:col:platform_catalog_change_requests.target_plan_id -->
**`target_plan_id`** (text, nullable, no CHECK) — which plan the request concerns; cleaned to 80 chars; display/filter only.

<!-- dict:col:platform_catalog_change_requests.target_addon_key -->
**`target_addon_key`** (text, nullable) — which add-on the request concerns; display/filter only; no apply branch consumes it.

<!-- dict:col:platform_catalog_change_requests.target_version_id -->
**`target_version_id`** (uuid, nullable; FK→`platform_plan_versions(id)` ON DELETE SET NULL) — **dead column**: never written by the insert and never SELECTed by any reader; only the FK constraint exists.

<!-- dict:col:platform_catalog_change_requests.effective_at -->
**`effective_at`** (timestamptz, nullable) — intended go-live timestamp; display only (apply paths use `new Date()` at apply-time, not this field).

<!-- dict:col:platform_catalog_change_requests.impact_summary -->
**`impact_summary`** (text, nullable) — plain-language blast-radius note, cleaned to 1200 chars; rendered for reviewers.

<!-- dict:col:platform_catalog_change_requests.proposal -->
**`proposal`** (jsonb, NOT NULL, default `{}`) — **the load-bearing column**: the proposed change payload, stored verbatim. Recognized shapes by `kind`: `{kind:'stripe_price_update', stripePriceId, planId, billingCycle, environment, currentPriceId, proposedPriceId, changeNote}`; `{kind:'plan_gating_update', planId, currentStatus, proposedStatus, changeNote}`; `{kind:'plan_config_update', planId, current:{tournamentLimit,seatLimit,trialDays}, proposed:{…}, changeNote}`; `{kind:'feature_matrix', moduleEntitlements}`. An unrecognized/missing `kind` = informational request that never auto-applies.

<!-- dict:col:platform_catalog_change_requests.submitted_by_email -->
**`submitted_by_email`** (text, nullable) — captured when the request first enters `needs_review` (or is auto-submitted by an apply).

<!-- dict:col:platform_catalog_change_requests.submitted_at -->
**`submitted_at`** (timestamptz, nullable) — first needs_review/apply submission time.

<!-- dict:col:platform_catalog_change_requests.reviewed_by_email -->
**`reviewed_by_email`** (text, nullable) — approver/rejecter email, set only when status becomes `approved`/`rejected`; **no check that it differs from `submitted_by_email`**.

<!-- dict:col:platform_catalog_change_requests.reviewed_at -->
**`reviewed_at`** (timestamptz, nullable) — approval/rejection time.

<!-- dict:col:platform_catalog_change_requests.implementation_notes -->
**`implementation_notes`** (text, nullable) — notes recorded at apply/implement time, sanitized via `sanitizePlatformChangeNote` (or auto-generated "Marked implemented because…").

<!-- dict:col:platform_catalog_change_requests.created_by_email -->
**`created_by_email`** (text, NOT NULL) — request author, always set to `auth.user.email` on insert.

<!-- dict:col:platform_catalog_change_requests.updated_by_email -->
**`updated_by_email`** (text, nullable) — last mutator; set on insert and every PATCH.

### `platform_catalog_change_applications`
<!-- dict:table:platform_catalog_change_applications -->

**Purpose:** an append-only ledger of catalog changes that were **actually applied** under an approved change request. Each row links to its authorizing request, names the affected `surface` + `target_key`, and snapshots the `applied_payload` (dev 8 / prod 14). Complements the request workflow + the `platform_audit_log` entry.

**Gotchas (read first):**
1. **Best-effort writer** — `recordCatalogChangeApplication` swallows insert errors (`console.error` only, no throw, [lib/platform-catalog-approval.ts:75-87](../../../lib/platform-catalog-approval.ts#L75)) — the catalog write can succeed while its ledger row is silently dropped; `platform_audit_log` is the durable trail.
2. **FK ON DELETE RESTRICT** — `change_request_id`→`platform_catalog_change_requests(id)` RESTRICT, so once a request has any application row it **cannot be deleted** — the ledger pins its authorizing request permanently.
3. **Immutable-by-convention** — has an `id` PK but no `created_at`/`updated_at` (`applied_at` is the only timestamp); no UPDATE/DELETE code path. **Ten** write call sites cover the four surfaces — the change-requests PATCH (stripe / plan_gating / plan_config, each inline + already-current = 6), the feature-matrix publish route, and the three direct PATCH routes (stripe-prices, plan-gating, plan-config).

**Fields** (boilerplate `id` omitted):

<!-- dict:col:platform_catalog_change_applications.change_request_id -->
**`change_request_id`** (uuid, NOT NULL; FK→`platform_catalog_change_requests(id)` ON DELETE RESTRICT) — the authorizing request (gotcha 2).

<!-- dict:col:platform_catalog_change_applications.surface -->
**`surface`** (text, NOT NULL; CHECK `plan_gating|plan_config|stripe_price|feature_matrix`) — which catalog surface was written; mirrors the `ApprovalSurface` TS union ([lib/platform-catalog-approval.ts:3](../../../lib/platform-catalog-approval.ts#L3)).

<!-- dict:col:platform_catalog_change_applications.target_key -->
**`target_key`** (text, NOT NULL) — the specific written target within the surface: `stripe_prices.id` (stripe_price), `plan_key` (plan_gating), `plan_id` (plan_config), the literal `'module_entitlements'` (feature_matrix).

<!-- dict:col:platform_catalog_change_applications.actor_email -->
**`actor_email`** (text, NOT NULL) — the platform admin who applied the change (`auth.user.email`).

<!-- dict:col:platform_catalog_change_applications.applied_payload -->
**`applied_payload`** (jsonb, NOT NULL, default `{}`) — snapshot of the applied result + provenance flags. Key catalog by surface: stripe_price → `{id, plan_id, billing_cycle, environment, price_id, change_note, stripe_validation:{checked,active?,product?}, approval_mode, already_current?, expected_previous_price_id?}`; plan_gating → `{planKey, gatingStatus, changeNote, approval_mode, already_current?, expected_previous_status?}`; plan_config → `{plan_id, tournament_limit, seat_limit, trial_days, change_note, approval_mode, already_current?, expected_previous_config?}`; feature_matrix → `{change_note, changes[], previous_module_entitlements, module_entitlements}`.

<!-- dict:col:platform_catalog_change_applications.applied_at -->
**`applied_at`** (timestamptz, NOT NULL, default now()) — when the application was recorded (relies on the default; no caller sets it); the ordering key for the change-requests page.

### `platform_catalog_campaigns`
<!-- dict:table:platform_catalog_campaigns -->

**Purpose:** admin scaffolding to **track** planned coupon/promo/trial/launch/retention campaigns for product planning (mig 059). A CRUD-only planning register — **0 rows both envs**, and **not wired into checkout, Stripe, trials, or any entitlement path**.

**Gotchas (read first):**
1. **Built-but-unused at runtime** — no checkout/billing/Stripe code consumes campaigns; `coupon_code` is stored but never passed to Stripe; `trial_days`/`target_plan_ids`/`starts_at`/`ends_at` are write-then-display only. No expiry sweep or auto-status flip.
2. **No FK to the change-requests table** — the `request_type='campaign'` enum value is a category label only; there is no DB linkage between the two tables.
3. **Only `status` is mutable after creation** — the PATCH updates `status`/`updated_at`/`updated_by_email` and nothing else ([campaigns/route.ts:139-148](../../../app/api/platform-admin/product-catalog/campaigns/route.ts#L139)); everything else is write-once at POST. `campaign_key` is auto-generated server-side (slug + base36 timestamp), never client-supplied.

**Fields** (boilerplate `id`, `created_at`, `updated_at` omitted):

<!-- dict:col:platform_catalog_campaigns.campaign_key -->
**`campaign_key`** (text, NOT NULL, UNIQUE) — stable slug, auto-generated as `${slug(title)}-${Date.now().toString(36)}` ([campaigns/route.ts:23-29](../../../app/api/platform-admin/product-catalog/campaigns/route.ts#L23)); never read by any consumer.

<!-- dict:col:platform_catalog_campaigns.title -->
**`title`** (text, NOT NULL) — campaign name, required + trimmed to 160 chars; also the seed for `campaign_key`.

<!-- dict:col:platform_catalog_campaigns.campaign_type -->
**`campaign_type`** (text, NOT NULL; CHECK `coupon|promo|trial|launch|retention`) — category; display/planning only.

<!-- dict:col:platform_catalog_campaigns.status -->
**`status`** (text, NOT NULL, default `'draft'`; CHECK `draft|scheduled|active|paused|ended`) — lifecycle; the only PATCH-mutable field; no code reads it to gate anything (a campaign is never "activated" into a discount).

<!-- dict:col:platform_catalog_campaigns.target_plan_ids -->
**`target_plan_ids`** (text[], NOT NULL, default `{}`) — plans the campaign targets, cleaned to the valid plan set + de-duped; stored only, never consumed.

<!-- dict:col:platform_catalog_campaigns.starts_at -->
**`starts_at`** (timestamptz, nullable) — planned start; indexed but no code queries by it; display only.

<!-- dict:col:platform_catalog_campaigns.ends_at -->
**`ends_at`** (timestamptz, nullable) — planned end; no expiry sweep / auto-status flip exists.

<!-- dict:col:platform_catalog_campaigns.coupon_code -->
**`coupon_code`** (text, nullable) — intended coupon code, cleaned to 80 chars; **never passed to Stripe** — purely informational.

<!-- dict:col:platform_catalog_campaigns.discount_summary -->
**`discount_summary`** (text, nullable) — plain-language discount description, cleaned to 500 chars; display only.

<!-- dict:col:platform_catalog_campaigns.trial_days -->
**`trial_days`** (integer, nullable; CHECK `trial_days IS NULL OR trial_days >= 0`) — intended trial length; never applied to any actual trial (no consumer).

<!-- dict:col:platform_catalog_campaigns.notes -->
**`notes`** (text, nullable) — internal planning notes, cleaned to 1200 chars.

<!-- dict:col:platform_catalog_campaigns.created_by_email -->
**`created_by_email`** (text, NOT NULL) — author, set to `auth.user.email` on POST.

<!-- dict:col:platform_catalog_campaigns.updated_by_email -->
**`updated_by_email`** (text, nullable) — last mutator; set on POST and every status PATCH.

---

## Platform ops & data import

> Two platform-control-plane ops tables (`platform_bulk_operations`, `platform_metric_snapshots` — both 0 rows, never exercised) plus the **org-scoped** tournament data-import staging (`import_batches`/`import_batch_rows` — gated by *org* capabilities, not platform role; the classifier files them here as an ops/staging surface).

### `platform_bulk_operations`
<!-- dict:table:platform_bulk_operations -->

**Purpose:** a post-hoc audit ledger of platform-admin bulk org actions (subscription-status override, comp-period grant, plan change, module add-on enable/disable across up to 100 orgs at once) — one row per run, inserted up-front then updated with the per-org outcome. **0 rows both envs — no bulk op has ever run.**

**Gotchas (read first):**
1. **`status` default is dead** — the row is INSERTed with `status='failed'` / success=0 / failure=all, then UPDATEd to the real status after the loop ([bulk-operations/route.ts:153-156](../../../app/api/platform-admin/bulk-operations/route.ts#L153) / [:326-331](../../../app/api/platform-admin/bulk-operations/route.ts#L326)); the DB default `'completed'` is never observed. `operationStatus()`: `completed`=all ok, `partial_failed`=mixed, `failed`=none ok.
2. **Not a job queue — a redundant ledger** — orgs are mutated synchronously in the same request loop (`org_overrides`/`organizations` writes) and **each mutation also writes `platform_audit_log`**, so this table duplicates audit info that lives there.
3. **Permission split beyond the CHECK** — `module_addon_enablement` requires `manage_product`; the other three require `manage_billing` ([:97-103](../../../app/api/platform-admin/bulk-operations/route.ts#L97)) — a `manage_billing`-only role 403s on module changes even though the CHECK allows the value. `result_summary` is write-only (the history reader omits it).

**Fields** (boilerplate `id`, `created_at` omitted):

<!-- dict:col:platform_bulk_operations.action_type -->
**`action_type`** (text, NOT NULL; CHECK `subscription_status_override|comp_period|plan_change|module_addon_enablement`) — which bulk action ran; validated against `VALID_ACTIONS`; read into the history list.

<!-- dict:col:platform_bulk_operations.status -->
**`status`** (text, NOT NULL, default `'completed'`; CHECK `completed|partial_failed|failed`) — run outcome; default dead (code inserts `'failed'` then UPDATEs).

<!-- dict:col:platform_bulk_operations.target_count -->
**`target_count`** (integer, NOT NULL, default 0) — orgs targeted (`orgs.length`); set on insert, never updated.

<!-- dict:col:platform_bulk_operations.success_count -->
**`success_count`** (integer, NOT NULL, default 0) — orgs where the action succeeded; updated post-loop to `results.filter(ok).length`.

<!-- dict:col:platform_bulk_operations.failure_count -->
**`failure_count`** (integer, NOT NULL, default 0) — orgs where the action threw; updated post-loop.

<!-- dict:col:platform_bulk_operations.reason -->
**`reason`** (text, NOT NULL, app-required non-empty) — operator justification, max 1200 chars; also copied into each per-org `platform_audit_log` entry.

<!-- dict:col:platform_bulk_operations.parameters -->
**`parameters`** (jsonb, NOT NULL, default `{}`) — action inputs; key catalog `{target_status, target_plan, target_module, module_operation, expires_at}` (each non-null only for the matching `action_type`); read into the history list.

<!-- dict:col:platform_bulk_operations.result_summary -->
**`result_summary`** (jsonb, NOT NULL, default `{}`) — per-org outcomes `{results:[{orgId,name,slug,ok,message}]}`, written on the post-loop UPDATE (which `.select('*')`s the row back into the POST response) but **never read back from the DB** — the history reader omits it and the POST client uses the in-memory `results` array.

<!-- dict:col:platform_bulk_operations.created_by_email -->
**`created_by_email`** (text, NOT NULL) — platform-admin email that ran the op; read into the history list.

<!-- dict:col:platform_bulk_operations.completed_at -->
**`completed_at`** (timestamptz, nullable) — when the loop finished, set explicitly on the post-loop UPDATE; NULL only if that UPDATE itself errors.

### `platform_metric_snapshots`
<!-- dict:table:platform_metric_snapshots -->

**Purpose:** a daily point-in-time archive of the platform command-center stats (MRR/ARR, plan & subscription mix, growth, usage, lifecycle, alerts) — one row per calendar day (`UNIQUE snapshot_date`), upserted on demand by the manual "Take snapshot" button. **0 rows both envs — never taken.**

**Gotchas (read first):**
1. **`metrics` jsonb is write-only** — the only reader `getLatestPlatformMetricSnapshot` selects just `snapshot_date/created_at/created_by_email/source` ([lib/platform-metrics.ts:341](../../../lib/platform-metrics.ts#L341)); the Overview uses it purely as a "last snapshot" label while showing LIVE stats from `getCommandCenterStats`.
2. **`UNIQUE(snapshot_date)` upsert overwrites** (`onConflict:'snapshot_date'`) — re-snapshotting the same day replaces rather than appends, and `created_at` is set explicitly so it bumps to the latest run (not a stable creation marker).
3. **`source` is only ever `'manual'`** — the writer defaults it to `'manual'` and the only caller passes `'manual'`; any pg_cron/scheduled source is unbuilt. Gated only by `requirePlatformAdmin` (any platform role).

**Fields** (boilerplate `id` omitted):

<!-- dict:col:platform_metric_snapshots.snapshot_date -->
**`snapshot_date`** (date, NOT NULL; UNIQUE) — calendar day of the snapshot (today sliced to `YYYY-MM-DD`); the upsert conflict target (one row/day).

<!-- dict:col:platform_metric_snapshots.metrics -->
**`metrics`** (jsonb, NOT NULL, default `{}`) — the full `getCommandCenterStats` blob. Key catalog: `generatedAt`; `totals{organizations,users,tournaments,teams,estimatedMrr,estimatedArr}`; `subscription{byPlan,byStatus,statusByPlan,trialEndingSoon}`; `growth{newOrgs7/30/90,newOrgsByPlan,earlyAccessTotal,newLeads7,convertedLeads,conversionRate,…}`; `usage{tournaments*,teamsTotal,leagueSeasons*,repTeams*,accountingEntriesTotal,moduleCounts}`; `lifecycle{cancellations,downgrades,recoveries,recoveryRate30}`; `alerts{pastDue,trialEndingSoon,retentionAlertCount,overridesExpiringSoon,orgsWithoutOwner,…}`. **Never read back.**

<!-- dict:col:platform_metric_snapshots.source -->
**`source`** (text, NOT NULL, default `'manual'`, no CHECK) — how the snapshot was created; only ever `'manual'` (the writer defaults it; the only caller passes `'manual'`).

<!-- dict:col:platform_metric_snapshots.created_by_email -->
**`created_by_email`** (text, nullable) — platform-admin who took the snapshot (`auth.user.email ?? 'platform-admin'`).

<!-- dict:col:platform_metric_snapshots.created_at -->
**`created_at`** (timestamptz, NOT NULL, default now()) — **not boilerplate here**: the writer sets it explicitly in the upsert, so a same-day re-snapshot overwrites it; read by `getLatestPlatformMetricSnapshot`.

### `import_batches`
<!-- dict:table:import_batches -->

**Purpose:** the **org-scoped** staging header for the two-phase tournament data importer (CSV/XLSX) — one row per uploaded preview, holding scope, source filename, rollup summary, lifecycle status, and a 24h preview TTL (dev 6 / prod 0). **NOT a platform-admin table** despite living in this Phase-8 group: it is gated by **org** membership capabilities and `org_id` FK→`organizations` ON DELETE CASCADE.

**Gotchas (read first):**
1. **`'expired'` is set LAZILY, never by a sweep** — there is no cron/trigger (mig 106 is table-only). A preview past `expires_at` stays `status='previewed'` in the DB; it is flipped to `'expired'` only if someone tries to commit it ([commit/route.ts:369-371](../../../app/api/admin/tournaments/[tournamentId]/registrations/import/commit/route.ts#L369)) and shown as expired purely via read-time `effectiveStatus()`. Stale `previewed` rows accumulate (dev has 6).
2. **`expires_at` is never set by code** — both preview writers omit it and rely on the DB default `now()+24h`; the TTL exists only because of that default.
3. **Commit is single-actor-locked + type-checked** — only the `actor_user_id` who previewed may apply the batch, and the batch `import_type` must match the importer or 409 ([commit/route.ts:360-365](../../../app/api/admin/tournaments/[tournamentId]/registrations/import/commit/route.ts#L360)). `import_type` values are `'tournament_teams'` and `'tournament_schedule'` — **not** `'registrations'` (that's only the URL path; the teams importer powers the registrations route).

**Fields** (boilerplate `created_at` omitted; `id` is documented — it's app-generated and reused):

<!-- dict:col:import_batches.id -->
**`id`** (uuid, NOT NULL, PK, default gen_random_uuid()) — **not blind-boilerplate**: generated app-side via `crypto.randomUUID()` *before* insert so it can be reused as `batchId` on the child rows ([preview/route.ts:54](../../../app/api/admin/tournaments/[tournamentId]/registrations/import/preview/route.ts#L54)); also the commit-time lookup key.

<!-- dict:col:import_batches.org_id -->
**`org_id`** (uuid, NOT NULL; FK→`organizations(id)` ON DELETE CASCADE) — owning org, from `ctx.org.id` at preview; re-enforced at commit (cross-org → reject) and the history filter.

<!-- dict:col:import_batches.actor_user_id -->
**`actor_user_id`** (uuid, nullable, cross-schema ref to `auth.users`, not FK-constrained in snapshot) — admin who previewed; locks commit to the same user (NULL ⇒ any in-org user can commit).

<!-- dict:col:import_batches.actor_email -->
**`actor_email`** (text, nullable) — previewing admin's email; surfaced in the history list; denormalized, not authoritative.

<!-- dict:col:import_batches.import_type -->
**`import_type`** (text, NOT NULL, no CHECK) — importer discriminator `'tournament_teams'` | `'tournament_schedule'`; validated at commit against the route's importer; filters/labels the history list.

<!-- dict:col:import_batches.scope_json -->
**`scope_json`** (jsonb, NOT NULL, default `{}`) — import scope, always `{tournamentId}`; re-read at commit to re-verify the tournament and used as the history filter (`.contains`).

<!-- dict:col:import_batches.source_filename -->
**`source_filename`** (text, nullable) — uploaded file name; display-only in history.

<!-- dict:col:import_batches.status -->
**`status`** (text, NOT NULL, default `'previewed'`; CHECK `previewed|committed|failed|expired`) — lifecycle: inserted `previewed` → `committed` on success / `failed` on commit error / `expired` lazily on commit-after-TTL; read-time `effectiveStatus` may *render* expired without persisting it.

<!-- dict:col:import_batches.summary_json -->
**`summary_json`** (jsonb, NOT NULL, default `{}`) — preview + commit rollup; key catalog `{totalRows,creates,updates,unchanged,warnings,blocked,notices[]}` at preview, merged with `{commit:{created,updated,unchanged,skipped}}` at commit; read for history display.

<!-- dict:col:import_batches.committed_at -->
**`committed_at`** (timestamptz, nullable) — set explicitly only on a successful commit; NULL for previewed/failed/expired; display-only.

<!-- dict:col:import_batches.expires_at -->
**`expires_at`** (timestamptz, NOT NULL, default `now() + 24h`) — preview TTL; **never set by code** (relies on the default); read to compute expiry at commit + read-time; no sweep updates it.

### `import_batch_rows`
<!-- dict:table:import_batch_rows -->

**Purpose:** per-row staging detail for an `import_batches` preview — raw cell values, server-normalized values, before/after snapshots, warnings, errors, the proposed DB operation, and per-row commit status. The commit handler **re-reads `normalized_json` from here (not the file)** and re-validates against current DB state — the import is safe-by-replay (dev 9 / prod 0).

**Gotchas (read first):**
1. **`status='failed'` is a DEAD enum value** — rows go `previewed → committed` (create/update) or `→ skipped` (unchanged); on an unexpected (500) error the **parent batch** goes `'failed'` (a 409 blocked/stale `CommitError` leaves the batch `'previewed'`), and the child rows are left at `'previewed'` either way — no code path writes row `status='failed'`.
2. **`operation='blocked'` rows can never be committed** — written at preview for rows with errors, but `prepareTournamentTeamCommitRows` 409s the whole batch if any row is blocked ([tournament-teams-commit.ts:172](../../../lib/import/tournament-teams-commit.ts#L172)) — a blocked row stays `blocked`/`previewed` permanently (preview-only diagnostic).
3. **Safe-by-replay** — commit re-reads `normalized_json`/`before_json`/`errors_json` and re-validates against current DB state ([commit/route.ts:374-381](../../../app/api/admin/tournaments/[tournamentId]/registrations/import/commit/route.ts#L374)); `raw_json`/`after_json`/`warnings_json` are **not** re-read (write-once preview archives). `target_id` is back-filled to the new record id at commit for `create` rows.

**Fields** (boilerplate `created_at` omitted; `id` is documented — it's the commit update key):

<!-- dict:col:import_batch_rows.id -->
**`id`** (uuid, NOT NULL, PK, default gen_random_uuid()) — **not blind-boilerplate**: the commit-time update key used to flip per-row status ([commit/route.ts:263](../../../app/api/admin/tournaments/[tournamentId]/registrations/import/commit/route.ts#L263)).

<!-- dict:col:import_batch_rows.batch_id -->
**`batch_id`** (uuid, NOT NULL; FK→`import_batches(id)` ON DELETE CASCADE) — parent batch; set to the app-generated `batchId` at preview; every commit update is scoped `.eq('batch_id',…)` for safety.

<!-- dict:col:import_batch_rows.row_number -->
**`row_number`** (integer, NOT NULL) — 1-based source spreadsheet row index; orders the commit read and is echoed in validation errors.

<!-- dict:col:import_batch_rows.operation -->
**`operation`** (text, NOT NULL; CHECK `create|update|unchanged|blocked`) — proposed DB action, derived at preview (errors→`blocked`, existing+changes→`update`, existing+no-change→`unchanged`, new→`create`); `blocked` rows can never be committed (gotcha 2).

<!-- dict:col:import_batch_rows.target_id -->
**`target_id`** (uuid, nullable, no FK) — existing/created record id; NULL at preview for creates, set for updates, **back-filled** to the new id at commit for creates; points at `teams` or `games` depending on `import_type`.

<!-- dict:col:import_batch_rows.raw_json -->
**`raw_json`** (jsonb, NOT NULL, default `{}`) — untouched cell values keyed by header, from the parsed file; **write-once preview archive** (commit does not re-read it).

<!-- dict:col:import_batch_rows.normalized_json -->
**`normalized_json`** (jsonb, NOT NULL, default `{}`) — server-normalized typed values; **the source of truth replayed at commit** (`parseTournamentTeamNormalizedRow` builds the insert/update).

<!-- dict:col:import_batch_rows.before_json -->
**`before_json`** (jsonb, nullable) — pre-change snapshot of the matched record; NULL for create rows, set for update/unchanged; re-read at commit for stale-detection.

<!-- dict:col:import_batch_rows.after_json -->
**`after_json`** (jsonb, nullable) — proposed post-change record, always populated at preview; **write-once** (not re-read at commit).

<!-- dict:col:import_batch_rows.warnings_json -->
**`warnings_json`** (jsonb, NOT NULL, default `[]`) — array of non-blocking warning strings for the preview UI; write-once.

<!-- dict:col:import_batch_rows.errors_json -->
**`errors_json`** (jsonb, NOT NULL, default `[]`) — array of blocking error strings; re-read at commit, and any non-empty value (like `operation='blocked'`) aborts the whole batch with 409.

<!-- dict:col:import_batch_rows.status -->
**`status`** (text, NOT NULL, default `'previewed'`; CHECK `previewed|committed|failed|skipped`) — per-row lifecycle: `previewed` → `committed` (create/update) / `skipped` (unchanged); **`failed` is in the CHECK but never written by any code path** (dead value).

### Functions & mechanics (not tables — not coverage-checked, documented for completeness)

- **RBAC resolution** — `getPlatformAdminContext` ([lib/platform-auth.ts:74](../../../lib/platform-auth.ts#L74)) is the spine: env bootstrap (`PLATFORM_ADMIN_EMAILS` → super_admin, no DB) first, else the `platform_users` row (`is_active`, lowercased email) via `normalizePlatformRole`. `ROLE_PERMISSIONS` ([:26](../../../lib/platform-auth.ts#L26)) maps the 6 roles to 6 permissions; `requirePlatformPermission`/`requireAnyPlatformPermission`/`requireSuperAdmin` (the last working-tree-new) are the API gates; `lib/platform-areas.ts` (`canViewPlatformArea`) is the per-area view/write matrix for server components.
- **The catalog-approval gate** — `requireApprovedCatalogChangeRequest(id, surface)` ([lib/platform-catalog-approval.ts:19](../../../lib/platform-catalog-approval.ts#L19)) enforces `status='approved'` + a `SURFACE_REQUEST_TYPES` match ([:12-17](../../../lib/platform-catalog-approval.ts#L12)); `recordCatalogChangeApplication` ([:68](../../../lib/platform-catalog-approval.ts#L68)) writes the (best-effort) `platform_catalog_change_applications` row. The `proposal.kind` parsers + apply functions live in `app/api/platform-admin/product-catalog/change-requests/route.ts`.
- **Business-event writer** — `writePlatformEvent` ([lib/platform-events.ts:51](../../../lib/platform-events.ts#L51)) + the transition helpers `isPastDueTransition` / `isRecoveryTransition` ([:89-96](../../../lib/platform-events.ts#L89)). The reader is `getCommandCenterStats` ([lib/platform-metrics.ts:84](../../../lib/platform-metrics.ts#L84)), which also produces the `platform_metric_snapshots.metrics` blob.

---

*End of Platform admin (Phase 8 — 17 tables across 3 sub-domains: identity/RBAC/audit + business events, the plans & catalog control plane, platform ops + the org-scoped data-import staging. RLS-enabled-zero-policies + the prod anon-grant drift is the headline; runtime entitlement is the static `PLAN_CONFIG`, with `plan_gating`/`plan_config_overrides` the only DB tables on a hot path; `stripe_prices` writes are gated by this domain's `platform_catalog_change_requests`. Cross-references — not redocuments — `organizations`/`stripe_prices`/`org_internal_notes`/`auth.users`, and the Observability *error* log it is distinct from.)*

---

# Domain: CRM

The growth/CRM pipeline — exactly **one table, `early_access_leads`** (the smallest domain). Public marketing **lead capture** (the Early Access form on the homepage / pricing / `/start/league` / `/start/club`, plus the free-tier coach "express interest" capture) writes leads; the platform-admin **Early Access triage** page + the command-center **growth metrics** read them. Built but unexercised — **0 rows in dev AND prod.**

> _Last verified: 2026-06-10 @ snapshot 2026-06-10, commit `9faea936` (branch `feat/free-tier-coaches`). Authored against a clean tree; a concurrent workstream (feedback center / observability) has since touched unrelated files, but **every file this domain cites is UNMODIFIED vs `9faea936`** (checked via `git status`) — refs match the commit. Live probes (2026-06-10, dev+prod `pg_class`/`pg_policies`/`pg_trigger`/`role_table_grants`): `early_access_leads` is column-, constraint-, and FK-identical dev↔prod (**zero structural drift**); **RLS ENABLED with ZERO policies and ZERO triggers** in both envs; **prod grants `anon`+`authenticated` FULL `SELECT/INSERT/UPDATE/DELETE` while dev grants only `REFERENCES/TRIGGER/TRUNCATE`** (the [[reference_supabase_rls_grants]] gate); **0 rows** in both envs. No DB CHECK constraints — every "enum" is a TS union/string convention._

### Gotchas first (the cross-cutting traps)

- **Every writer and reader is service-role — the RLS posture is never exercised by app code.** The public POST ([app/api/early-access/route.ts:2](../../../app/api/early-access/route.ts#L2)), the free-tier capture ([lib/basic-coach-interest.ts:2](../../../lib/basic-coach-interest.ts#L2)), the admin list/PATCH/export, and the metrics ([lib/platform-metrics.ts:1](../../../lib/platform-metrics.ts#L1)) all go through `supabaseAdmin`. RLS-enabled-zero-policies is purely the [[reference_supabase_rls_grants]] backstop: **prod** grants `anon`+`authenticated` full DML, so RLS is the only thing keeping lead PII (name/email/UA) off the public PostgREST API; **dev** grants `anon` only `REFERENCES/TRIGGER/TRUNCATE`. The **public POST does NOT run as the visitor** — it is a server-side service-role insert (which is why it works despite dev anon having no INSERT grant).
- **DUAL-STATUS TRAP — `internal_status` is the live triage field; `status` is legacy/dead.** Both default `'new'`; the insert stamps `status='new'` once and never touches it again, while every triage write, list filter, and metric reads **`internal_status`** (8-value TS union). `status` is selected into the row + typed on the `Lead` type but **no code ever reads it**.
- **`metadata` jsonb is 100% dead** — never written by either insert helper, never selected (absent from `EARLY_ACCESS_SELECT`); no key catalog exists. Three more columns are **write-only** (written, never read): `last_submitted_at`, `user_agent`, `last_contacted_by`, plus `updated_at` (code-maintained, never read).
- **`converted_org_id` is set ONLY by the manual admin PATCH** — no signup/billing automation ever links a lead to an org. The command-center conversion metrics key off the **FK** (`converted_org_id` non-null), not `internal_status='converted'` (the PATCH enforces that the two agree by rejecting a `'converted'` status with no org).
- **The public "upsert" is a manual select-then-insert/update keyed on `email_normalized` (UNIQUE), not an atomic Postgres upsert** — two concurrent first-submits of the same email can collide on the unique constraint and 500. A public resubmit bumps `submission_count`/`last_submitted_at` and overwrites capture fields but does **not** reset `internal_status`/`converted_org_id` — a converted lead that resubmits stays converted.
- **No DB triggers or CHECKs** — `updated_at` is code-maintained (set inconsistently across the three writers); the 8-value `internal_status` domain, the `plan_interest`/`features_interested` array allowlists, and the lead's identity guards live entirely in `lib/early-access-admin.ts` + the route allowlists.
- **Dev/prod:** zero structural drift; 0 rows both; the only divergence is the grant drift above (prod anon full DML).

---

## `early_access_leads`
<!-- dict:table:early_access_leads -->

**Purpose:** the single CRM/growth-pipeline table. Captured by two public writers — the Early Access form POST ([app/api/early-access/route.ts](../../../app/api/early-access/route.ts), homepage/pricing/`start-*`) and the free-tier coach scope-interest capture ([lib/basic-coach-interest.ts](../../../lib/basic-coach-interest.ts)) — and triaged by the platform-admin Early Access page ([EarlyAccessClient.tsx](../../../app/platform-admin/early-access/EarlyAccessClient.tsx)) via the PATCH at [app/api/platform-admin/early-access/[leadId]/route.ts](../../../app/api/platform-admin/early-access/[leadId]/route.ts). Read columns flow through the central `EARLY_ACCESS_SELECT` list ([lib/early-access-admin.ts:46](../../../lib/early-access-admin.ts#L46)).

**Gotchas (read first):**
1. **`internal_status` is the real state machine; `status` is a dead duplicate.** Both insert paths stamp `status='new'` ([route.ts:106](../../../app/api/early-access/route.ts#L106) + [basic-coach-interest.ts:150](../../../lib/basic-coach-interest.ts#L150)) once; the PATCH only ever writes `internal_status` ([[leadId]/route.ts:61](../../../app/api/platform-admin/early-access/[leadId]/route.ts#L61)); the list filter maps the `status` query param onto `internal_status` ([route.ts:38](../../../app/api/platform-admin/early-access/route.ts#L38)); `earlyAccessByStatus` groups by `internal_status` ([lib/platform-metrics.ts:238](../../../lib/platform-metrics.ts#L238)). A fresh lead's `internal_status='new'` comes from the **column default**, not the insert.
2. **`converted_org_id` is the conversion source of truth.** `convertedLeads`/`conversionRate` count `converted_org_id` non-null ([lib/platform-metrics.ts:243](../../../lib/platform-metrics.ts#L243)); setting `internal_status='converted'` is **rejected** without a valid org ([[leadId]/route.ts:92](../../../app/api/platform-admin/early-access/[leadId]/route.ts#L92)). The org is validated against `organizations` before write ([:77](../../../app/api/platform-admin/early-access/[leadId]/route.ts#L77)); FK is `ON DELETE SET NULL`.
3. **Every triage PATCH writes a `platform_audit_log` row** (`action='update_early_access_lead'`, before/after snapshot, [[leadId]/route.ts:115](../../../app/api/platform-admin/early-access/[leadId]/route.ts#L115)) — the lead's mutation history lives in the audit log, not on the row. PATCH needs `manage_growth` **or** `manage_product` ([:32](../../../app/api/platform-admin/early-access/[leadId]/route.ts#L32)); list/export need only any platform-admin role.
4. **The public form's `'coaches_portal'` plan-interest is silently dropped.** [app/pricing/page.tsx:63](../../../app/pricing/page.tsx#L63) passes it, but the POST allowlist is `PLAN_OPTIONS = {league, club}` ([route.ts:5](../../../app/api/early-access/route.ts#L5)) and `cleanList` filters it out — `'coaches_portal'` never persists.

**Fields** (boilerplate `id`, `created_at`, `updated_at` omitted — `created_at` drives `newLeads7` + date-range filters + the default sort and is exported as the `submitted_at` header; `updated_at` is code-maintained, set on all three write paths, and selected but **never consumed**):

<!-- dict:col:early_access_leads.last_submitted_at -->
**`last_submitted_at`** (tstz, NN, default now()) — "most recent public submission"; set to now on every insert and resubmit ([route.ts:77](../../../app/api/early-access/route.ts#L77)). **Selected but never consumed** — present in `EARLY_ACCESS_SELECT` + the client type, but never rendered or used in any logic (effectively write-only).

<!-- dict:col:early_access_leads.submission_count -->
**`submission_count`** (int4, NN, default 1) — how many times this email submitted; the manual upsert reads `existing.submission_count` and increments ([route.ts:97](../../../app/api/early-access/route.ts#L97)). Sole reader is the "N submissions" badge ([EarlyAccessClient.tsx:476](../../../app/platform-admin/early-access/EarlyAccessClient.tsx#L476), shown only when >1).

<!-- dict:col:early_access_leads.status -->
**`status`** (text, NN, default `'new'`) — **LEGACY/DEAD.** Stamped `'new'` at insert by both writers and never updated; selected ([lib/early-access-admin.ts:52](../../../lib/early-access-admin.ts#L52)) and typed but **never read** by any triage/filter/metric path — all of those use `internal_status`. No governing TS union (only value ever written is `'new'`).

<!-- dict:col:early_access_leads.name -->
**`name`** (text, NN, no default) — contact name; public path guards it required and `cleanText`-caps at 120 ([route.ts:35](../../../app/api/early-access/route.ts#L35)); the free-tier writer always supplies a fallback (`primary_coach_name || email`, [basic-coach-interest.ts:122](../../../lib/basic-coach-interest.ts#L122)) so the NN-no-default column never violates. Feeds the `{{name}}` outreach-template token.

<!-- dict:col:early_access_leads.email -->
**`email`** (text, NN) — raw contact email, lowercased + `EMAIL_RE`-validated ([route.ts:36](../../../app/api/early-access/route.ts#L36),[:50](../../../app/api/early-access/route.ts#L50)); searchable via `ilike` in the admin list ([route.ts:28](../../../app/api/platform-admin/early-access/route.ts#L28)); feeds the "copy consented emails" outreach list.

<!-- dict:col:early_access_leads.email_normalized -->
**`email_normalized`** (text, NN; **UNIQUE**) — the dedup key (== lowercased email). The manual upsert looks a lead up by this column then INSERTs or UPDATEs ([route.ts:68](../../../app/api/early-access/route.ts#L68)). **Gotcha:** not an atomic upsert — concurrent first-submits can race onto the unique constraint and 500. Excluded from `EARLY_ACCESS_SELECT`.

<!-- dict:col:early_access_leads.organization_name -->
**`organization_name`** (text, nullable) — org/club/team name; public-form-required but column-nullable; free-tier writer uses `team.name || 'Basic coach team'` ([basic-coach-interest.ts:125](../../../lib/basic-coach-interest.ts#L125)). Feeds the `{{organization}}` token.

<!-- dict:col:early_access_leads.role -->
**`role`** (text, nullable) — contact role (President/registrar/…); free-tier writer hardcodes `'Coach'` ([basic-coach-interest.ts:127](../../../lib/basic-coach-interest.ts#L127)).

<!-- dict:col:early_access_leads.sports -->
**`sports`** (text, nullable) — free-text sport/program (e.g. "Softball, hockey"); exported as `sport_or_program`.

<!-- dict:col:early_access_leads.plan_interest -->
**`plan_interest`** (text[], NN, default `{}`) — plan tiers the lead wants. **Live value domain = `{team, league, club}`** (TS-only, no DB CHECK): the public allowlist is `PLAN_OPTIONS = {league, club}` (capped at 2, [route.ts:5](../../../app/api/early-access/route.ts#L5)), the free-tier writer adds `'team'` ([basic-coach-interest.ts:128](../../../lib/basic-coach-interest.ts#L128)); the admin label map is `EARLY_ACCESS_PLAN_LABELS` ([lib/early-access-admin.ts:25](../../../lib/early-access-admin.ts#L25)). Filtered with `.contains` ([route.ts:36](../../../app/api/platform-admin/early-access/route.ts#L36)); feeds the conversion-by-plan breakdown. (`'coaches_portal'` from the pricing page is filtered out — see gotcha 4.)

<!-- dict:col:early_access_leads.features_interested -->
**`features_interested`** (text[], NN, default `{}`) — module/feature interests. Public allowlist `FEATURE_OPTIONS = house_league|registration|public_site|accounting|rep_teams|coach_portal|communications` ([route.ts:6](../../../app/api/early-access/route.ts#L6)); free-tier writer adds `coach_portal` + `team_lineups|team_attendance|team_documents|team_budget|team_dues_automation` ([basic-coach-interest.ts:47](../../../lib/basic-coach-interest.ts#L47)); 12-value label map `EARLY_ACCESS_FEATURE_LABELS` ([lib/early-access-admin.ts:31](../../../lib/early-access-admin.ts#L31)).

<!-- dict:col:early_access_leads.notes -->
**`notes`** (text, nullable, max 1200) — public "what would make this useful" free-text. **Gotcha:** the free-tier path **appends** an interest summary (keeping the last 1200 chars, [basic-coach-interest.ts:68](../../../lib/basic-coach-interest.ts#L68)) whereas the public path overwrites. Distinct from the private `internal_notes`.

<!-- dict:col:early_access_leads.source_path -->
**`source_path`** (text, nullable) — the page/path that produced the lead; powers the top-5 source attribution ([lib/platform-metrics.ts:245](../../../lib/platform-metrics.ts#L245)). Public form sends `window.location.pathname+hash`; the free-tier writer hardcodes `/coaches/team/{id}` ([basic-coach-interest.ts:131](../../../lib/basic-coach-interest.ts#L131)). Not in the CSV export. Because `/start/league`, `/start/club`, the homepage and pricing all submit via the same modal, `source_path` is whatever pathname the modal was opened on.

<!-- dict:col:early_access_leads.user_agent -->
**`user_agent`** (text, nullable, max 500) — submitter UA (anti-bot/diagnostic), sliced to 500 ([route.ts:63](../../../app/api/early-access/route.ts#L63)). **Write-only** — not in `EARLY_ACCESS_SELECT`, never displayed/exported.

<!-- dict:col:early_access_leads.release_notifications_consent -->
**`release_notifications_consent`** (bool, NN, default true) — opt-in for release/feature emails; gates the "copy consented emails" outreach list ([EarlyAccessClient.tsx:231](../../../app/platform-admin/early-access/EarlyAccessClient.tsx#L231)). **Gotcha:** the public form defaults this **true**, but the free-tier coach capture defaults it **false** ([basic-coach-interest.ts:133](../../../lib/basic-coach-interest.ts#L133)) — a coach expressing tool-interest is not auto-subscribed. No automated email is ever sent from these routes; outreach is manual copy/paste.

<!-- dict:col:early_access_leads.metadata -->
**`metadata`** (jsonb, NN, default `{}`) — **FULLY DEAD.** No writer sets it (absent from both insert helpers), no reader selects it (absent from `EARLY_ACCESS_SELECT`); relies on the DB default forever. No key catalog exists in code.

<!-- dict:col:early_access_leads.internal_status -->
**`internal_status`** (text, NN, default `'new'`) — **the live triage state machine.** 8-value TS union `EARLY_ACCESS_STATUSES` ([lib/early-access-admin.ts:1](../../../lib/early-access-admin.ts#L1)): `new | qualified | contacted | pilot_candidate | waiting_for_launch | converted | not_a_fit | do_not_contact`, validated by `isEarlyAccessStatus` at the PATCH (no DB CHECK). Written by the PATCH ([[leadId]/route.ts:61](../../../app/api/platform-admin/early-access/[leadId]/route.ts#L61); forced `'contacted'` on `markContacted`, `'converted'` requires an org); grouped by the growth metrics; rendered/filtered in the triage UI.

<!-- dict:col:early_access_leads.internal_notes -->
**`internal_notes`** (text, nullable, max 4000) — private triage notes (separate from the public `notes`); edited in the triage drawer, exported as `internal_notes`.

<!-- dict:col:early_access_leads.last_contacted_at -->
**`last_contacted_at`** (tstz, nullable) — set when the admin uses `markContacted` ([[leadId]/route.ts:67](../../../app/api/platform-admin/early-access/[leadId]/route.ts#L67)); rendered as "Last contacted" + exported.

<!-- dict:col:early_access_leads.last_contacted_by -->
**`last_contacted_by`** (text, nullable, no FK) — email of the platform admin who marked contacted ([[leadId]/route.ts:68](../../../app/api/platform-admin/early-access/[leadId]/route.ts#L68)). **Selected but never surfaced** — present in `EARLY_ACCESS_SELECT`, but never rendered or exported (effectively write-only).

<!-- dict:col:early_access_leads.converted_org_id -->
**`converted_org_id`** (uuid, nullable; FK→`organizations(id)` ON DELETE SET NULL) — the org this lead became, **set only by the manual admin PATCH** ([[leadId]/route.ts:65](../../../app/api/platform-admin/early-access/[leadId]/route.ts#L65)) after org validation; the conversion-metric key. Never written by any signup/billing automation; org deletion nulls it but leaves `converted_at`. Links to `/platform-admin/orgs/{id}` in the UI.

<!-- dict:col:early_access_leads.converted_at -->
**`converted_at`** (tstz, nullable) — when the lead was marked converted; **idempotent** (`current.converted_at ?? now`, so re-saving keeps the original, [[leadId]/route.ts:98](../../../app/api/platform-admin/early-access/[leadId]/route.ts#L98)); nulled when the org link is explicitly cleared.

<!-- dict:col:early_access_leads.follow_up_due_at -->
**`follow_up_due_at`** (**date**, nullable) — next follow-up date (YYYY-MM-DD, not a timestamp); the client compares the string `<= today` to highlight overdue follow-ups ([EarlyAccessClient.tsx:466](../../../app/platform-admin/early-access/EarlyAccessClient.tsx#L466)), which works only because both are `YYYY-MM-DD`.

<!-- dict:col:early_access_leads.next_action -->
**`next_action`** (text, nullable, max 500) — free-text next-step note; edited in the triage drawer, exported.

### Functions & mechanics (not tables — not coverage-checked, documented for completeness)

- **The manual upsert** ([app/api/early-access/route.ts:65](../../../app/api/early-access/route.ts#L65); [lib/basic-coach-interest.ts:111](../../../lib/basic-coach-interest.ts#L111)) — both writers `select('id, submission_count').eq('email_normalized', …).maybeSingle()` then UPDATE (bump count) or INSERT (`submission_count:1`, `status:'new'`). Not atomic; the `UNIQUE(email_normalized)` constraint is the only backstop against a concurrent-first-submit race.
- **`EARLY_ACCESS_SELECT`** ([lib/early-access-admin.ts:46](../../../lib/early-access-admin.ts#L46)) — the 24-column source of truth for the admin list/PATCH/export; **excludes** only `metadata`, `user_agent`, `email_normalized` (the three columns never read back). Adding a readable column means editing this constant.
- **Growth metrics** — `getCommandCenterStats` ([lib/platform-metrics.ts:136](../../../lib/platform-metrics.ts#L136),[:237](../../../lib/platform-metrics.ts#L237)) fetches up to 5000 leads (`internal_status`/`created_at`/`converted_org_id`/`source_path`) and derives `earlyAccessTotal`, `newLeads7`, `convertedLeads`, `conversionRate`, `earlyAccessByStatus`, and the top-5 `sourcePathRows`; surfaced on the platform-admin overview. `EarlyAccessClient` additionally computes its **own** page-local summary (from ≤100 loaded rows) independent of these server metrics.
- **Free-tier "express interest" bridge** — `lib/basic-coach-interest.ts` writes leads with `plan_interest=['team']` + `source_path=/coaches/team/{id}` from the free Basic-coach portal (forward-link to [[project_free_tier_strategy]]); `/start/league` + `/start/club` feed the same public POST. These do **not** redocument the free-tier feature — they only close the writer link.

---

*End of CRM (Phase 9 — 1 table, the smallest domain. Service-role-only, RLS-enabled-zero-policies; `internal_status` (not `status`) is the live triage field and `converted_org_id` (not the status string) is the conversion source of truth; `metadata` + 4 write-only columns are dead. Cross-references — not redocuments — `organizations` (the `converted_org_id` FK), `platform_audit_log` (the durable mutation trail), and the free-tier `basic-coach-interest` writer.)*

---

# Domain: Notifications & Push

FieldLogicHQ's three notification **delivery channels** and the preference/opt-out layers that gate them: the **in-app bell** (`notifications` + the two preference tables), **web push** (two subscription tables — authenticated member vs anonymous fan), and **email** (the Resend send log + the platform-admin template registry). The hub is **`notify()`** ([lib/notify.ts](../../../lib/notify.ts)): one call fans a single event out to the bell, web push, and email per the recipient's preferences. 8 tables across **3 labeled sub-systems** below.

> _Last verified: 2026-06-10 @ snapshot 2026-06-10, commit `9faea936` (branch `feat/free-tier-coaches`). Authored against a clean tree; a concurrent workstream has since edited unrelated files. **All heavily-cited files are UNMODIFIED vs `9faea936`** (`lib/notify.ts`, `lib/web-push.ts`, `lib/fan-notify.ts`, `lib/email-sender.ts`, and every cited route — checked via `git status`); the lone exception is `lib/email.ts`, which is cited only line-free (its concurrent change merely adds `export` to `escapeHtml`/`wrap` — the "templates are hardcoded, `resolveEmailTemplate` was never built" claim re-verified by grep). Live probes (2026-06-10, dev+prod `pg_class`/`pg_policies`/`pg_trigger`/`role_table_grants`): all 8 tables are column-, constraint-, and FK-identical dev↔prod (**zero structural drift**) with **ZERO triggers** and **ZERO CHECK constraints**; **RLS ENABLED on all 8**, with **policies ONLY on `notifications`** (2, identical dev↔prod — see below) and **zero policies on the other 7**; **prod grants `anon`+`authenticated` FULL DML on all 8 while dev grants only `REFERENCES/TRIGGER/TRUNCATE`** (the [[reference_supabase_rls_grants]] gate). Row counts (dev/prod): `notifications` 57/1 · `notification_preferences` 5/0 · `tournament_notification_preferences` 11/0 · `push_subscriptions` 0/0 · `fan_push_subscriptions` 0/0 · `platform_email_templates` 24/24 · `email_batches` 0/1 · `email_sends` 0/3._

### Gotchas first (the cross-cutting traps)

- **`notify()` is the hub, and it is fire-and-forget.** A single `notify()` call ([lib/notify.ts:87](../../../lib/notify.ts#L87)) resolves recipients, then writes a bell row, optionally fans a Web Push, optionally sends an email — each per-channel-gated. The whole body is wrapped in a try/catch that only `console.error`s ([:273](../../../lib/notify.ts#L273)); a failed notification **never surfaces to or blocks the caller**. Call sites fire it without awaiting — predominantly `notify(...).catch(console.error)` (e.g. [admin/teams/route.ts:352](../../../app/api/admin/teams/route.ts#L352), [billing/webhook/route.ts:581](../../../app/api/billing/webhook/route.ts#L581)), occasionally `void notify(...)` (the check-in route).
- **TWO suppression layers, in this order:** **Layer 2** = per-tournament opt-out (`tournament_notification_preferences.opted_out`, checked **only when the caller passes `tournamentId`**, [:166](../../../lib/notify.ts#L166)) runs **before** **Layer 1** = global per-channel prefs (`notification_preferences`, [:178](../../../lib/notify.ts#L178)). Missing rows ⇒ **deliver** (the bell channel is default-ON).
- **Only `notifications` has RLS policies, and they are VESTIGIAL for every shipped data path.** The two policies — `own notifications select` and `own notifications update`, both `qual = auth.uid() = user_id`, roles `public`, **identical dev↔prod** — are never evaluated by the bell list, unread count, or mark-read, which all run through `supabaseAdmin` (service-role, BYPASSRLS) with ownership enforced **in code** (`.eq('user_id', …)`). The only user-scoped client that could exercise the SELECT policy is the `NotificationBell` Realtime subscription ([NotificationBell.tsx:49](../../../components/notifications/NotificationBell.tsx#L49)); the UPDATE policy is fully vestigial. The other 7 tables are **RLS-enabled-ZERO-policies** (service-role-only) — the [[reference_supabase_rls_grants]] backstop against prod's anon full-DML grant.
- **`notifications.event_type` name-collides with `platform_events.event_type` but is a DISJOINT union.** `NotificationEventType` ([lib/types.ts](../../../lib/types.ts), 14 values incl. `chat_message` + `chat_mention`, both emitters, both default push-ON) shares zero values with `PlatformEventType` ([lib/platform-events.ts:3](../../../lib/platform-events.ts#L3)) — e.g. `payment_failed` exists only in the notification union. Never conflate the two. **5 values still have NO emitter** (dead enum values — see the table). `chat_mention` is intentionally NOT in the settings-UI sections (`NOTIFICATION_SECTIONS`), so it has no user toggle and always delivers — that's how an @mention reaches a coach who muted general `chat_message`.
- **No DB triggers or CHECKs anywhere in this domain** — every `updated_at` is code-maintained, and every "enum" (`event_type`, `email_batches.status`, `email_sends.status`/`suppression_reason`, the template `category`) is a TS union/string convention.
- **Two push tables, by design — different identity models.** `push_subscriptions` = authenticated member (`user_id`, **globally-unique endpoint** → one row per browser, follows the logged-in member across orgs); `fan_push_subscriptions` = anonymous public fan (**no `user_id`**, scoped to `(tournament_id, team_id)`, **`UNIQUE(endpoint, tournament_id)`** → the same browser can follow many tournaments, one row each). Both are **EMPTY in dev AND prod** (built, zero live subscriptions). `sendWebPush` is shared and **no-ops when VAPID keys are unset**.
- **The DB email-template registry IS the source of sends now (mig 179 + Batch D wiring).** `platform_email_templates` `marketing` rows drive the real send + preview via the resolver in `lib/platform-email-templates.ts` (`renderResolvedEmail`/`renderTemplateEmail` — the loader the migration-083 comment referenced, now built). ALL ~24 transactional/system rows are now applied at send time too: every send site calls `sendTransactionalEmail()`, which uses the operator's saved override when `is_customised`, else sends the hardcoded `lib/email.ts` builder output BYTE-FOR-BYTE (safety property). Editing any template now affects real sends, not just preview/test-send.
- **Dev/prod:** all 8 column/constraint-identical (zero structural drift). Divergence is **content** (row counts above) + **grants** (prod anon full DML; dev `REFERENCES/TRIGGER/TRUNCATE`) only; the 2 `notifications` policies are identical across envs.

---

## In-app bell & preferences

> The in-app notification bell and the two preference layers that gate it. `notifications` is the per-user bell store; `notification_preferences` is the **global** per-(user, org, event) channel matrix; `tournament_notification_preferences` is a **per-tournament opt-out** overlay. All three are touched exclusively by `supabaseAdmin` on every shipped path — the only user-scoped client in the sub-system is the bell's Realtime subscription.

### `notifications`
<!-- dict:table:notifications -->

**Purpose:** the in-app notification bell store — one row per (recipient, event) when the bell channel is enabled. Written **exclusively** by `notify()` ([lib/notify.ts:197](../../../lib/notify.ts#L197), service-role INSERT); read/mapped by [app/api/notifications/route.ts](../../../app/api/notifications/route.ts) (GET list + unread count) into `AppNotification` ([lib/types.ts:1391](../../../lib/types.ts#L1391)); rendered by [NotificationPanel.tsx](../../../components/notifications/NotificationPanel.tsx) + the badge in [NotificationBell.tsx](../../../components/notifications/NotificationBell.tsx).

**Gotchas (read first):**
1. **The SELECT policy is load-bearing for the live badge (mig 184); UPDATE policy is vestigial.** GET (count + list) and POST (mark-read / mark-all-read) go through `supabaseAdmin` ([route.ts:41](../../../app/api/notifications/route.ts#L41)), so `own notifications update` is never evaluated (ownership enforced in code by `.eq('user_id', user.id)`). But **`notifications` is in the `supabase_realtime` publication as of mig 187** — the `NotificationBell` INSERT subscription (filtered `user_id=eq.<self>`, [NotificationBell.tsx:59](../../../components/notifications/NotificationBell.tsx#L59)) authorizes against `own notifications select` (auth.uid() = user_id), so each browser receives ONLY its own inserts and the unread badge bumps live. **Before mig 187 the table was never published**, so the subscription silently received nothing and the badge only updated on page load — the platform's second RLS-enabled realtime table (after `chat_messages`). Default replica identity is sufficient: the bell listens to INSERT only, whose payload always carries the full new row (no REPLICA IDENTITY FULL, unlike the games/chat UPDATE cases).
2. **Mark-read is a POST with an `action` body — there is NO PATCH verb** ([route.ts:76](../../../app/api/notifications/route.ts#L76); actions `mark-read` / `mark-all-read`). `read_at` is set to the request-time ISO string ([:93](../../../app/api/notifications/route.ts#L93)); unread = `read_at IS NULL`.
3. **The unread badge is a separate `head:true` count query** ([route.ts:41](../../../app/api/notifications/route.ts#L41)), independent of the list — the badge stays accurate even when the bell fetches only 1 row.
4. **`event_type` is a name-collision + has 5 dead values** (see the column). **`metadata` is no longer dead** — the `coach_insights_digest` weekly digest writes `{ teamId }` and the sweep queries it (jsonb `.contains`) for its no-migration 6-day dedupe ([lib/insights-digest.ts](../../../lib/insights-digest.ts)); still unread by any UI.
5. **`link` navigation is a hard reload** — `NotificationPanel` assigns `window.location.href = notification.link` ([:82](../../../components/notifications/NotificationPanel.tsx#L82)), not the Next router; links are relative app paths.

**Fields** (boilerplate `id` + `created_at` omitted — `created_at` is DB-default `now()`, the newest-first sort + relative-time label; no `updated_at` column):

<!-- dict:col:notifications.org_id -->
**`org_id`** (uuid, NN; FK→`organizations(id)` ON DELETE CASCADE) — the org the notification belongs to; scopes the per-org bell. Supplied by the caller (`opts.orgId`, [lib/notify.ts:200](../../../lib/notify.ts#L200)); recipient resolution derives members **from** that org, so consistency is code-enforced. Filter key for the list + mark-all-read ([route.ts:45](../../../app/api/notifications/route.ts#L45)).

<!-- dict:col:notifications.user_id -->
**`user_id`** (uuid, NN; FK→`auth.users(id)` ON DELETE CASCADE) — the recipient; set from resolved `recipient.userId` ([lib/notify.ts:201](../../../lib/notify.ts#L201)). Drives the (vestigial) RLS `qual auth.uid()=user_id` **and** the code-level ownership filter on every read/write ([route.ts:44](../../../app/api/notifications/route.ts#L44)).

<!-- dict:col:notifications.event_type -->
**`event_type`** (text, NN, **no CHECK**) — which event produced the row; selects the panel icon and the per-event preference key. 12-value TS union `NotificationEventType` ([lib/types.ts:1377](../../../lib/types.ts#L1377)). **Emitted (have `notify()` callers):** `registration_new`, `registration_status_changed`, `payment_received`, `payment_failed`, `score_submitted`, `team_no_show`, `house_league_registration_new`. **DEAD ENUM VALUES (no emitter anywhere — verified by grep: no `notify()` call passes these 5):** `roster_change_requested`, `coach_access_requested`, `score_disputed`, `waitlist_opened`, `registration_deadline_approaching` (they appear only in the UI label/icon/section maps in `lib/notification-labels.ts`). **Name-collision:** disjoint from `platform_events`' `PlatformEventType` — do not conflate.

<!-- dict:col:notifications.title -->
**`title`** (text, NN) — bold panel headline; **also reused as the push/email subject** when those channels fire ([lib/notify.ts:233](../../../lib/notify.ts#L233),[:265](../../../lib/notify.ts#L265)).

<!-- dict:col:notifications.body -->
**`body`** (text, nullable) — optional secondary panel line (`opts.body ?? null`).

<!-- dict:col:notifications.link -->
**`link`** (text, nullable) — relative deep-link path; clicking it does a **hard `window.location.href` reload** ([NotificationPanel.tsx:82](../../../components/notifications/NotificationPanel.tsx#L82)), not a router push.

<!-- dict:col:notifications.read_at -->
**`read_at`** (tstz, nullable) — NULL = unread; ISO timestamp = read. Set by the mark-read / mark-all-read POST ([route.ts:93](../../../app/api/notifications/route.ts#L93)) (no trigger); the insert never sets it, so new rows default unread. Unread-filter key for the list + badge count.

<!-- dict:col:notifications.metadata -->
**`metadata`** (jsonb, NN, default `{}`) — intended structured payload; surfaced onto `AppNotification.metadata`. **Effectively dead / write-only** — `notify()` writes `opts.metadata ?? {}` ([lib/notify.ts:206](../../../lib/notify.ts#L206)) but no call site passes a `metadata` option, and no UI reads it. (The `metadata:` blocks in `admin/teams/route.ts` / `register/route.ts` belong to `writePlatformEvent`, not `notify()`.)

### `notification_preferences`
<!-- dict:table:notification_preferences -->

**Purpose:** the **global** per-(user, org, event_type) channel matrix — the Layer-1 gate. PK `(user_id, org_id, event_type)`. Written by the org notification-settings page via [app/api/admin/org/notification-preferences/route.ts](../../../app/api/admin/org/notification-preferences/route.ts) (POST upsert); read **only** by `notify()` ([lib/notify.ts:179](../../../lib/notify.ts#L179)) to gate each of the 3 channels.

**Gotchas (read first):**
1. **Absence of a row is NOT all-off — it falls through to `systemDefaults()` which is bell-ON.** `notify()` uses the row if present, else `systemDefaults()` ([lib/notify.ts:187](../../../lib/notify.ts#L187)), which returns `{bell:true, push:PUSH_DEFAULT_ON_EVENTS.has(event), email:(payment_failed && owner|admin)}` ([:58](../../../lib/notify.ts#L58)). Push defaults **on** for the ~13 action-worthy events (registrations, payments, scores, no-show, coach/roster/tryout, chat — see `PUSH_DEFAULT_ON_EVENTS` in `lib/notification-labels.ts`) and off for the informational ones. A user who never touched preferences still gets every bell event — and push for those default-on events **if they have a `push_subscriptions` row**.
2. **`channel_email` default-true is special-cased to `payment_failed` for owners/admins only** — the single channel-by-role default in the system ([:63](../../../lib/notify.ts#L63)); all other events default email-off.
3. **The role for that email default is forced to `'member'` when an explicit `userIds` recipient list is supplied** ([:113](../../../lib/notify.ts#L113)), so explicit-recipient `payment_failed` emails are never auto-on.

**Fields** (boilerplate `updated_at` omitted — code-maintained, NN default now(), and **never read**; no `id`/`created_at` columns):

<!-- dict:col:notification_preferences.user_id -->
**`user_id`** (uuid, NN; PK part; FK→`auth.users(id)` ON DELETE CASCADE) — the preference owner; set from `ctx.user.id`, filter key for `notify()`'s lookup.

<!-- dict:col:notification_preferences.org_id -->
**`org_id`** (uuid, NN; PK part; FK→`organizations(id)` ON DELETE CASCADE) — the org scope; set from `ctx.org.id`.

<!-- dict:col:notification_preferences.event_type -->
**`event_type`** (text, NN; PK part, **no CHECK**) — the event the toggle applies to; same `NotificationEventType` domain as `notifications.event_type`. The settings UI groups these via `NOTIFICATION_SECTIONS` ([lib/notification-labels.ts:49](../../../lib/notification-labels.ts#L49)), module-gated (Coaches Portal needs `module_rep_teams`, House League needs `module_house_league`).

<!-- dict:col:notification_preferences.channel_bell -->
**`channel_bell`** (bool, NN, default true) — whether this event writes a bell row for the user; consumed at [lib/notify.ts:196](../../../lib/notify.ts#L196) (`if (prefs.bell)`).

<!-- dict:col:notification_preferences.channel_push -->
**`channel_push`** (bool, NN, default false) — whether this event fans a Web Push to the user's `push_subscriptions`; consumed at [lib/notify.ts:215](../../../lib/notify.ts#L215). The **column** default is false, but the absent-row fallback `systemDefaults()` defaults push **on** for the action-worthy events (`PUSH_DEFAULT_ON_EVENTS`), so "no saved row" ≠ "no push". Delivery still requires a `push_subscriptions` row.

<!-- dict:col:notification_preferences.channel_email -->
**`channel_email`** (bool, NN, default false) — whether this event sends a transactional email via `sendEmail`; consumed at [lib/notify.ts:262](../../../lib/notify.ts#L262). (See the `payment_failed`/owner-admin system default above.)

### `tournament_notification_preferences`
<!-- dict:table:tournament_notification_preferences -->

**Purpose:** the **per-tournament opt-out overlay** (Layer 2) — suppresses `notify()` for one tournament even when the global channel is on. PK `(user_id, tournament_id, event_type)`. Written by [app/api/admin/tournaments/[tournamentId]/notification-preferences/route.ts](../../../app/api/admin/tournaments/[tournamentId]/notification-preferences/route.ts) (POST upsert); consumed **only** by `notify()` ([lib/notify.ts:166](../../../lib/notify.ts#L166)).

**Gotchas (read first):**
1. **This is a per-USER opt-out keyed on `auth.users.user_id` with a boolean `opted_out` — NOT the contact-member `notify_mode` mechanism.** The writer sets `user_id: ctx.user.id` (the authenticated org user), and `notify()` filters `.eq('user_id', recipient.userId)`; there is no `notify_mode` anywhere in this table's paths. (Contrast the `staff`-role recipient scoping in `org_member_tournament_assignments`, sealed in **Org / Platform core** — a different mechanism; not redocumented here.)
2. **`opted_out` is consumed in exactly one place — `notify()`'s Layer-2 gate — and only when the caller passes a `tournamentId`** ([lib/notify.ts:166](../../../lib/notify.ts#L166)). Many tournament-relevant events (registration/payment notifications in `admin/teams/route.ts` / `register/route.ts`) do **not** pass `tournamentId`, so a per-tournament opt-out cannot suppress them.
3. **Missing row = NOT opted out** — the strict `opted_out === true` check ([:175](../../../lib/notify.ts#L175)) means an absent pref (maybeSingle → null) delivers.

**Fields** (boilerplate `updated_at` omitted — code-maintained, never read; no `id`/`created_at` columns):

<!-- dict:col:tournament_notification_preferences.user_id -->
**`user_id`** (uuid, NN; PK part; FK→`auth.users(id)` ON DELETE CASCADE) — the authenticated org user opting out; set from `ctx.user.id`. Keyed on `auth.users`, **not** a contact/org-member — the distinguishing fact from the `notify_mode` model.

<!-- dict:col:tournament_notification_preferences.tournament_id -->
**`tournament_id`** (uuid, NN; PK part; FK→`tournaments(id)` ON DELETE CASCADE) — the tournament the opt-out applies to.

<!-- dict:col:tournament_notification_preferences.event_type -->
**`event_type`** (text, NN; PK part, **no CHECK**) — the event being opted out of; same `NotificationEventType` domain.

<!-- dict:col:tournament_notification_preferences.opted_out -->
**`opted_out`** (bool, NN, default false) — `true` suppresses delivery (Layer 2). The only consumer is [lib/notify.ts:175](../../../lib/notify.ts#L175); the route doc-comment states the client treats missing rows as `optedOut=false`.

## Web push

> The two Web Push subscription stores, kept separate because they have **different identity models**. `push_subscriptions` = authenticated member/admin PWA (user-keyed, globally-unique endpoint). `fan_push_subscriptions` = anonymous public fan PWA (no account, tournament/team-scoped). Both are sent via the shared `sendWebPush` ([lib/web-push.ts](../../../lib/web-push.ts)) and are **EMPTY in dev AND prod**.

### `push_subscriptions`
<!-- dict:table:push_subscriptions -->

**Purpose:** one row per browser push endpoint for an **authenticated** member/admin. Hydrated by `POST /api/notifications/push/subscribe` ([route.ts:51](../../../app/api/notifications/push/subscribe/route.ts#L51)) on a successful `pushManager.subscribe()`; consumed by the member push channel in `notify()` ([lib/notify.ts:216](../../../lib/notify.ts#L216)) to fan a bell notification to all of a user's devices. **EMPTY in dev AND prod.**

**Gotchas (read first):**
1. **`endpoint` is globally UNIQUE and is the upsert conflict key** (`onConflict:'endpoint'`, [route.ts:63](../../../app/api/notifications/push/subscribe/route.ts#L63)) — re-registering the same browser updates the existing row **including `user_id`**, so the same endpoint re-subscribed by a different account **reassigns ownership**. Identity is still app-checked: subscribe sets `user_id` from the session, unsubscribe filters `.eq('user_id', user.id)`.
2. **A subscription row alone doesn't deliver — the event's push channel must also be on.** The `channel_push` **column** default is false, but the absent-row fallback `systemDefaults()` now defaults push **on** for the action-worthy events (`PUSH_DEFAULT_ON_EVENTS`); so delivery needs both a subscription row **and** a default-on (or explicitly opted-in) event ([lib/notify.ts:215](../../../lib/notify.ts#L215)).
3. **410-Gone cleanup deletes the row by `id`, and the member path treats ONLY 410 as dead** (not 404, [lib/notify.ts:244](../../../lib/notify.ts#L244)) — unlike the fan path (410 OR 404).
4. **`sendWebPush` silently no-ops when VAPID keys are unset** ([lib/web-push.ts:62](../../../lib/web-push.ts#L62)) — the send loop still runs and still refreshes `last_used_at`, but nothing is delivered.
5. **`device_label` and `last_used_at` are write-only** — captured/refreshed but never selected; the "stale subscription" comment on `last_used_at` is aspirational (no sweep reads it).

**Fields** (boilerplate `id` + `created_at` omitted — `created_at` is DB-default-only, never read by app code):

<!-- dict:col:push_subscriptions.user_id -->
**`user_id`** (uuid, NN; FK→`auth.users(id)` ON DELETE CASCADE) — the owning authenticated user, from the session ([route.ts:55](../../../app/api/notifications/push/subscribe/route.ts#L55)); the fan-out filter key. **Reassigned** if the same endpoint is re-subscribed by another account (endpoint-only conflict key).

<!-- dict:col:push_subscriptions.endpoint -->
**`endpoint`** (text, NN; **UNIQUE**) — the browser `PushSubscription.endpoint`; the upsert conflict target; passed to `sendWebPush`. One row per browser globally.

<!-- dict:col:push_subscriptions.keys_p256dh -->
**`keys_p256dh`** (text, NN) — base64url P-256 public key from the browser subscription; consumed by `webPush.sendNotification` ([lib/web-push.ts:71](../../../lib/web-push.ts#L71)).

<!-- dict:col:push_subscriptions.keys_auth -->
**`keys_auth`** (text, NN) — base64url auth secret from the browser subscription; consumed by `webPush.sendNotification` ([lib/web-push.ts:72](../../../lib/web-push.ts#L72)).

<!-- dict:col:push_subscriptions.device_label -->
**`device_label`** (text, nullable) — client-derived UA label (e.g. "Chrome on iPhone"), from `getDeviceLabel()`. **Write-only** — intended for a "manage devices" list that does not exist.

<!-- dict:col:push_subscriptions.last_used_at -->
**`last_used_at`** (tstz, nullable) — stamped on subscribe and refreshed after each successful send ([lib/notify.ts:241](../../../lib/notify.ts#L241)); code-maintained (no trigger). **Write-only** — no reader; no staleness sweep exists.

### `fan_push_subscriptions`
<!-- dict:table:fan_push_subscriptions -->

**Purpose:** one row per browser endpoint **per tournament** for an **anonymous** public fan (no account) following a team's score alerts — a Tournament Plus `fan_score_alerts` feature ([[project_public_tournament_wow]], forward-link only). Hydrated by `POST /api/public/fan-push/subscribe` ([route.ts:71](../../../app/api/public/fan-push/subscribe/route.ts#L71)); consumed by `notifyFansForGame` ([lib/fan-notify.ts:55](../../../lib/fan-notify.ts#L55)) to push final/score-update alerts to everyone following either team in a game. **EMPTY in dev AND prod.**

**Gotchas (read first):**
1. **Two tables by design — this one has NO `user_id`** and is scoped to `(tournament_id, team_id)` with **`UNIQUE(endpoint, tournament_id)`**, so the same browser endpoint can have **many** rows (one per tournament). Contrast `push_subscriptions` (`user_id` + globally-unique `endpoint` = one row per browser). The migration-107 header states the rationale ("fans have no `auth.users` account").
2. **The routes are fully anonymous (no session)** and use `supabaseAdmin`. Subscribe validates the team belongs to the tournament **and** gates on `fan_score_alerts` (Tournament Plus) before writing ([route.ts:43](../../../app/api/public/fan-push/subscribe/route.ts#L43),[:62](../../../app/api/public/fan-push/subscribe/route.ts#L62)); the sender re-checks the plan (defense-in-depth, [lib/fan-notify.ts:49](../../../lib/fan-notify.ts#L49)).
3. **Re-following a different team in the SAME tournament overwrites `team_id`** — the conflict key is `(endpoint, tournament_id)`, not team, so a device follows at most ONE team per tournament.
4. **410-cleanup deletes by `endpoint` and treats 410 OR 404 as dead** ([lib/fan-notify.ts:93](../../../lib/fan-notify.ts#L93)) — so one dead endpoint nukes that browser's subscriptions across **all** tournaments (contrast the member path's delete-by-id, 410-only).
5. **Fan-out only fires on score-posting transitions** — `notifyFansForGame` early-returns unless `status` is `submitted`/`completed` ([lib/fan-notify.ts:21](../../../lib/fan-notify.ts#L21)); the sole production caller is the scoring-service `onScored` hook ([lib/tournament-scoring-service.ts:167](../../../lib/tournament-scoring-service.ts#L167)), covering scorekeeper/official/admin.

**Fields** (boilerplate `id` + `created_at` omitted — `created_at` DB-default-only, never read):

<!-- dict:col:fan_push_subscriptions.endpoint -->
**`endpoint`** (text, NN; part of `UNIQUE(endpoint, tournament_id)`) — the browser `PushSubscription.endpoint`; **not** globally unique here (one row per tournament). Deduped per-endpoint in the send loop; the 410/404 delete key.

<!-- dict:col:fan_push_subscriptions.keys_p256dh -->
**`keys_p256dh`** (text, NN) — base64url P-256 public key; consumed by `sendWebPush`.

<!-- dict:col:fan_push_subscriptions.keys_auth -->
**`keys_auth`** (text, NN) — base64url auth secret; consumed by `sendWebPush`.

<!-- dict:col:fan_push_subscriptions.tournament_id -->
**`tournament_id`** (uuid, NN; FK→`tournaments(id)` ON DELETE CASCADE) — the tournament being followed; half of the unique key and the fan-out query filter ([lib/fan-notify.ts:58](../../../lib/fan-notify.ts#L58)). Validated against `team_id` at subscribe.

<!-- dict:col:fan_push_subscriptions.team_id -->
**`team_id`** (uuid, **nullable** as of mig 177; FK→`teams(id)` ON DELETE CASCADE) — the single team this device follows in this tournament; drives the "who follows either team in this game" score fan-out (`.in('team_id', [home, away])`). **Overwritten** on re-follow (conflict key excludes it). **NULL = a tournament-wide, messages-only subscription** (the notification bell's no-team opt-in) — such rows are invisible to the score fan-out (NULL is excluded by `.in(team_id, …)`) but still receive `notify_messages` announcements.

<!-- dict:col:fan_push_subscriptions.notify_messages -->
**`notify_messages`** (boolean, NN, DEFAULT true; mig 177) — category flag: this device wants tournament-wide **organizer announcements / day-of messages** (rain delays). Filters `notifyFansForAnnouncement` ([lib/fan-notify.ts](../../../lib/fan-notify.ts)). Set by the public notification bell + implicitly true for the team `FollowAlertsToggle`. Independent of `team_id` (a NULL-team row can have this true).

<!-- dict:col:fan_push_subscriptions.notify_scores -->
**`notify_scores`** (boolean, NN, DEFAULT true; mig 177) — category flag: this device wants **game score alerts** (+ the playoff-set / champions moments) for its followed `team_id`. Filters `notifyFansForGame`/`notifyFansForPlayoff`/`notifyFansForChampions`. A NULL-team (messages-only) row leaves this effectively inert (no team to score for).

<!-- dict:col:fan_push_subscriptions.device_label -->
**`device_label`** (text, nullable) — client-derived UA label (from [FollowAlertsToggle.tsx:89](../../../components/public/FollowAlertsToggle.tsx#L89)). **Write-only.**

<!-- dict:col:fan_push_subscriptions.last_used_at -->
**`last_used_at`** (tstz, nullable) — stamped on subscribe + refreshed after each successful fan send ([lib/fan-notify.ts:89](../../../lib/fan-notify.ts#L89)); code-maintained. **Write-only** — no reader, no sweep.

### `fan_follows`
<!-- dict:table:fan_follows -->

**Purpose:** the signed-in **account** follow list (unified-app Phase 2, mig 186) — one row per (user, entity) a fan follows, so a follow travels across every device. **A row IS the authorization** for "is this user following X" (presence = the gate; mirrors `basic_coach_team_users`). Written/read via `supabaseAdmin` in [lib/fan-follows.ts](../../../lib/fan-follows.ts); synced from the follow button ([POST /api/consumer/follows](../../../app/api/consumer/follows/route.ts)) and claimed from device localStorage ([POST /api/consumer/follows/claim](../../../app/api/consumer/follows/claim/route.ts)). Surfaced on the Follows feed (`/following`) and as a `fan` access context ([lib/user-contexts.ts](../../../lib/user-contexts.ts)). **EMPTY in dev AND prod** (new). Distinct from `fan_push_subscriptions` (anonymous, endpoint-keyed, no `user_id`) and `lib/follow.ts` (device localStorage) — all three coexist deliberately.

**Gotchas (read first):**
1. **Service-role only** — RLS enabled with ZERO policies; `supabaseAdmin` bypasses, anon/authenticated resolve to 0 rows. Never expose to the anon client (a follow list is per-user PII). Verify RLS live, not from the migration comment.
2. **Polymorphic `(entity_type, entity_id)` — no FK.** Postgres can't express a polymorphic FK, so integrity is enforced app-side (`teamBelongsToTournament` validates before insert). Slice 1 only writes `entity_type='team'`.
3. **NOT an org membership** — follows cross organizations freely (no single-org constraint, no `organization_members` involvement). Do not reuse org-membership status semantics here.
4. **Idempotent** — `UNIQUE(user_id, entity_type, entity_id)`; follows upsert (ignore-duplicates), so a re-follow is a no-op.
5. **`device_reconcile` rows come only from an EXPLICIT claim** (the "add your device follows?" offer), never silently on login — the shared-device safeguard.

**Fields** (boilerplate `id` + `created_at` omitted — DB-default-only):

<!-- dict:col:fan_follows.user_id -->
**`user_id`** (uuid, NN; FK→`auth.users(id)` ON DELETE CASCADE) — the account that holds the follow; every read filters on it.

<!-- dict:col:fan_follows.entity_type -->
**`entity_type`** (text, NN; CHECK in `tournament|team|org`) — what is followed. Slice 1 writes only `team`.

<!-- dict:col:fan_follows.entity_id -->
**`entity_id`** (uuid, NN) — the followed row id (`teams.id` when `entity_type='team'`). No FK (polymorphic); validated in `lib/fan-follows.ts`.

<!-- dict:col:fan_follows.source -->
**`source`** (text, NN, DEFAULT 'manual'; CHECK in `manual|directory|qr|device_reconcile|registration`) — how the follow was created. `manual` = a signed-in follow tap; `device_reconcile` = claimed from device localStorage.

<!-- dict:col:fan_follows.updated_at -->
**`updated_at`** (tstz, NN, DEFAULT now()) — bumped on upsert; code-maintained.

### `fan_alert_prefs`
<!-- dict:table:fan_alert_prefs -->

**Purpose:** account-level fan alert preferences (unified-app Phase 2 Slice 3, mig 188; Business Decisions Log 2026-07-14 "alerts require a signed-in account") — exactly **two global switches per user** covering ALL followed teams: `game_alerts` and `event_news`. **Absent row = both TRUE** (defaults); a row is written only when the user changes something. Read/written via `supabaseAdmin` in [lib/fan-alert-prefs.ts](../../../lib/fan-alert-prefs.ts); surfaced as the "Followed teams" card on `/account/notifications`; consulted at dispatch time by [lib/fan-notify.ts](../../../lib/fan-notify.ts) (account path: `fan_follows` → this table → `push_subscriptions` endpoints). **EMPTY in dev AND prod** (new).

**Gotchas (read first):**
1. **Service-role only** — RLS enabled with ZERO policies (same posture as `fan_follows`); verified live on dev 2026-07-14 (anon = permission denied). Verify RLS live, not from the migration comment.
2. **Absent row means BOTH TRUE** — dispatch must treat a missing row as opted-in, not opted-out; only an explicit `false` suppresses a category.
3. **Global, not per-team/per-event** — per-team overrides were explicitly deferred (Slice 3 rev 3); do not add scoping columns without a logged decision.
4. **NOT the anonymous path** — `fan_push_subscriptions` (endpoint-keyed, no `user_id`) is the legacy anonymous channel, closed to new opt-ins at Slice 3 but still dispatched for existing rows.

**Fields** (boilerplate `created_at` omitted — DB-default-only):

<!-- dict:col:fan_alert_prefs.user_id -->
**`user_id`** (uuid, PK; FK→`auth.users(id)` ON DELETE CASCADE) — the account holding the preference; one row per user.

<!-- dict:col:fan_alert_prefs.game_alerts -->
**`game_alerts`** (bool, NN, DEFAULT true) — push when a followed team's game goes live / finishes, plus the playoffs-set / champions moments (parity with the anonymous path's `notify_scores` semantics).

<!-- dict:col:fan_alert_prefs.event_news -->
**`event_news`** (bool, NN, DEFAULT true) — push for announcements from events the user's followed teams are in (parity with the anonymous path's `notify_messages`).

<!-- dict:col:fan_alert_prefs.updated_at -->
**`updated_at`** (tstz, NN, DEFAULT now()) — bumped on upsert; code-maintained.

## Email (Resend)

> The email layer: a per-recipient **send log** (`email_sends`) under campaign **batch headers** (`email_batches`), both written by [lib/email-sender.ts](../../../lib/email-sender.ts) around the Resend API; plus a platform-admin **template registry** (`platform_email_templates`) that is an editing **mirror only**, not a send-time source. Forward-links — not redocuments — [[project_email_stack]] (Resend via `fieldlogichq.ca`, the two send patterns, the CloudWatch `[email]` log path), [[project_founding_season_email]], and [[project_signup_flow_fixes]].

### `platform_email_templates`
<!-- dict:table:platform_email_templates -->

**Purpose:** a platform-admin **edit + preview + test-send** registry (categories marketing/auth/billing/tournament/rep_teams/house_league/system) at `/platform-admin/email-templates`. **Partly runtime-consumed as of the Editable Email Campaigns work (mig 179):** the 10 **`marketing`** campaigns are rendered FROM this table for both the real send AND the preview (via the new resolver in [lib/platform-email-templates.ts](../../../lib/platform-email-templates.ts) + markup renderer [lib/email-markup.ts](../../../lib/email-markup.ts)). The transactional/system rows are **not yet** consumed at send time (that wiring is the remaining phase of the same effort); until wired they still send the hardcoded `lib/email.ts` builders.

**Gotchas (read first):**
1. **Two consumption modes — check the category.** `marketing` rows are the **single source** for send + preview (the hand-built `founding*Html`/`spotlight*Html` builders in `lib/email.ts` were DELETED). Non-marketing rows are still hardcoded-default at send time; an operator customisation only affects them once each send site is wired through `renderResolvedEmail()`. The planned `resolveEmailTemplate()` DB loader now **exists** as `renderResolvedEmail()` / `renderTemplateEmail()` in `lib/platform-email-templates.ts`.
2. **`is_customised` is FUNCTIONAL for marketing** (both default seed and customisation render through the resolver, so send == preview == default). For transactional it is still effectively decorative **until** that key's send site is wired — then `true` ⇒ apply the stored override, `false` ⇒ hardcoded default.
3. **`marketing` bodies are block-MARKUP, not plain text/HTML** — paragraphs, `**bold**`, `- bullets`, `::callout … ::end`, `::button/::link Label | {{url}}`, `::if token … ::else … ::end`. Rendered by `lib/email-markup.ts` (unit-tested). CTAs live inline in the body (cta_label/cta_url_pattern NULL); per-org values (orgName, counts, phrases) arrive as `{{tokens}}` filled by the send route.
4. **The template `key` namespace overlaps `email_sends`/`email_batches.email_key` for marketing keys** (`founding_*` / `spotlight_*` now match a template row) but remains DISJOINT for the transactional keys (`signup_verification`, `tournament_registration_*`, …), which have no send-log rows.
5. **Count is live truth, not the migration** — **34 rows live** after mig 179 (24 transactional/system + 10 marketing; seed-only, a new key needs a migration). `updated_at`/`updated_by` are code-maintained (no trigger).

**Fields** (boilerplate `updated_at` omitted — code-maintained; no `id` [`key` is PK] / no `created_at`):

<!-- dict:col:platform_email_templates.key -->
**`key`** (text, **PK**) — stable template id mirroring a `lib/email.ts` template; the lookup key for GET/PUT/test-send. Value domain = the seeded keys (decide the live set from the snapshot, not migration 083).

<!-- dict:col:platform_email_templates.label -->
**`label`** (text, NN) — human display name in the admin template list.

<!-- dict:col:platform_email_templates.description -->
**`description`** (text, NN) — admin-facing one-liner describing when the email fires.

<!-- dict:col:platform_email_templates.subject -->
**`subject`** (text, NN) — editable subject for **preview/test-send only**; the real send subject comes from code.

<!-- dict:col:platform_email_templates.heading -->
**`heading`** (text, NN) — editable email H2 heading (preview/test only).

<!-- dict:col:platform_email_templates.body -->
**`body`** (text, NN) — editable body with `**bold**` + `{{var}}` tokens (preview/test only).

<!-- dict:col:platform_email_templates.cta_label -->
**`cta_label`** (text, nullable) — optional CTA button label (`''` coerced to null on PUT). When set, the resolver appends it to the body as a `::button` at render time (`bodyWithCta`). NULL for `marketing` rows (their CTAs are inline `::button`/`::link` in the body).

<!-- dict:col:platform_email_templates.cta_url_pattern -->
**`cta_url_pattern`** (text, nullable) — seeded `{{var}}` URL pattern for the CTA (e.g. `{{scheduleUrl}}`). Consumed by the resolver's `bodyWithCta` (paired with `cta_label`); still not editable via the PUT path. NULL for `marketing` rows.

<!-- dict:col:platform_email_templates.variables -->
**`variables`** (jsonb, NN, default `[]`) — JSON array of `{{}}` token **names**; drives the editor's var chips + the test-send placeholder fill. For `marketing` rows these tokens are also filled at **send** time with real per-org values (the send route's `buildVars`).

<!-- dict:col:platform_email_templates.category -->
**`category`** (text, NN, default `'system'`, **no CHECK**) — admin grouping bucket; observed domain `marketing | auth | billing | tournament | rep_teams | house_league | system`; `marketing` selects the markup-native send/preview path; unknown values fall through to raw display.

<!-- dict:col:platform_email_templates.is_customised -->
**`is_customised`** (bool, NN, default false) — `true` if an admin saved an override; PUT→true, DELETE→false. **Functional everywhere now.** For `marketing` the send + preview always render from the row (so this just toggles the badge/reset). For transactional/system rows it gates the override at the send site via `sendTransactionalEmail()`/`renderResolvedEmail()`: `true` ⇒ apply the stored copy, `false` ⇒ the hardcoded `lib/email.ts` builder output byte-for-byte.

<!-- dict:col:platform_email_templates.planned_send_date -->
**`planned_send_date`** (date, nullable — **mig 180**, P2 of Editable Email Campaigns) — the operator-editable **planned send date** for a `marketing` campaign. A **planning reminder only** — it drives the Email Dashboard's "upcoming" / "past due" lists; **nothing auto-sends on it** (sends are still manual). NULL for the two event-triggered campaigns (`founding_welcome` = at signup, `founding_checkin` = ~day 60), whose timing is system-defined; also NULL for all non-marketing rows. Edited via `POST /api/admin/email/schedule` (which rejects the trigger keys). Seeded with the founding-season dates.

<!-- dict:col:platform_email_templates.updated_by -->
**`updated_by`** (text, nullable, no FK) — who last edited (`user.email ?? user.id`); free-text, not a FK. Also stamped by a planned-date edit.

### `email_batches`
<!-- dict:table:email_batches -->

**Purpose:** the campaign **header** for a bulk founding-season/marketing send — one row per "Send now" in the platform-admin email dashboard. Created by `createEmailBatch`, tallied by `incrementBatchCounter`, closed by `finalizeBatch` (all [lib/email-sender.ts](../../../lib/email-sender.ts)); read by the dashboard ([app/platform-admin/email/page.tsx](../../../app/platform-admin/email/page.tsx)).

**Gotchas (read first):**
1. **The counters use a NON-ATOMIC read-then-write increment** ([lib/email-sender.ts:255](../../../lib/email-sender.ts#L255)) — `SELECT {counter}_count` then `UPDATE current+1`. The code comment accepts this for the 30–50-org founding cohort and flags revisiting with a Postgres function at higher volume.
2. **DB default `status='pending'` is never written by the app** — `createEmailBatch` always inserts `'running'` and `finalizeBatch` writes `'complete'`/`'failed'`. The dashboard badge map additionally synthesizes `scheduled`/`sent` from batch existence (not from `status`).
3. **`started_at` is set at row CREATION** (inside `createEmailBatch`, [:300](../../../lib/email-sender.ts#L300)) — it equals creation time, not a true "first email dispatched" marker.

**Fields** (boilerplate `id` + `created_at` omitted — `id` is referenced by `email_sends.batch_id` + the `?batchId=` drill-in; `created_at` is the dashboard sort key, DB-default now()):

<!-- dict:col:email_batches.email_key -->
**`email_key`** (text, NN, **no CHECK**) — which campaign this batch is for. Code-convention domain = the `TEMPLATE_REGISTRY` keys ([app/api/admin/email/send/route.ts:37](../../../app/api/admin/email/send/route.ts#L37)): `founding_welcome`, `founding_checkin`, `founding_renewal`, `founding_final`, `spotlight_club`, `spotlight_league`, `spotlight_coaches_org`, `spotlight_coaches_coach`, `spotlight_club_last`, `spotlight_full_picture`.

<!-- dict:col:email_batches.subject -->
**`subject`** (text, NN) — the batch subject (from the code `TEMPLATE_REGISTRY.subject`).

<!-- dict:col:email_batches.triggered_by -->
**`triggered_by`** (text, NN) — audit string for who/what launched the batch; JSDoc documents `'signup' | 'platform_admin:<email>'`, but the only live caller produces `platform_admin:<email>`.

<!-- dict:col:email_batches.recipient_count -->
**`recipient_count`** (int4, NN, default 0) — planned audience size at creation (`recipients.length`).

<!-- dict:col:email_batches.suppressed_count -->
**`suppressed_count`** (int4, NN, default 0) — running tally of opt-out-suppressed sends ([lib/email-sender.ts:127](../../../lib/email-sender.ts#L127)).

<!-- dict:col:email_batches.sent_count -->
**`sent_count`** (int4, NN, default 0) — running tally of successful sends.

<!-- dict:col:email_batches.failed_count -->
**`failed_count`** (int4, NN, default 0) — running tally of failed sends.

<!-- dict:col:email_batches.status -->
**`status`** (text, NN, default `'pending'`, **no CHECK**) — batch lifecycle. **Code domain = `running` → `complete` | `failed`** (the DB default `'pending'` is never written by the app); the dashboard also styles `scheduled`/`sent` synthetically.

<!-- dict:col:email_batches.started_at -->
**`started_at`** (tstz, nullable) — set at row creation (= `created_at`), not a true dispatch marker.

<!-- dict:col:email_batches.completed_at -->
**`completed_at`** (tstz, nullable) — when `finalizeBatch` ran.

### `email_sends`
<!-- dict:table:email_sends -->

**Purpose:** the per-recipient send **log** — one row per individual email attempt, written before+after the Resend call (`logSend` INSERT → `updateSend`, [lib/email-sender.ts:203](../../../lib/email-sender.ts#L203)). `batch_id` is NULL for standalone scheduled emails and set for dashboard bulk sends. Read by the per-send drill-in ([app/api/admin/email/sends/route.ts](../../../app/api/admin/email/sends/route.ts)).

**Gotchas (read first):**
1. **The migration comment claims "no RLS" but live `relrowsecurity=true`** (RLS enabled, zero policies) — the textbook [[reference_supabase_rls_grants]] instance. On prod (anon+authenticated full DML grant) the zero-policy RLS is the only thing blocking direct REST DML; read the posture from live `pg_class`, not the comment.
2. **There is NO `scheduled_at` DB column** — scheduling is entirely Resend's native `scheduled_at` **request param**, computed app-side and spread into the Resend POST ([lib/email-sender.ts:164](../../../lib/email-sender.ts#L164)); delays are `+1d` (welcome, [create-checkout/route.ts:245](../../../app/api/billing/create-checkout/route.ts#L245)) / `+7d` (upsell, [onboarding-plan/route.ts:104](../../../app/api/admin/org/onboarding-plan/route.ts#L104)). The DB stores only `created_at` and (post-send) `sent_at`.
3. **`cancelScheduledEmail` is the cancel-on-upgrade path** ([lib/email-sender.ts:342](../../../lib/email-sender.ts#L342)) — it targets `status='sent'` AND non-null `resend_message_id` rows for `(org, email_key)`, POSTs Resend `/{id}/cancel`, then marks them `suppressed` / `suppression_reason='cancelled_on_upgrade'`. Wired from the billing webhook + create-checkout for `tournament_plus_upsell`.
4. **`suppression_reason` is also written on FAILURE** (`no_api_key`/`send_error`) with `status='failed'` (not `'suppressed'`); a successful `'sent'` update resets it (and `sent_at`) to null.

**Fields** (boilerplate `id` + `created_at` omitted — `id` is returned by `logSend` so `updateSend` can patch the same row; `created_at` is the per-batch sends sort key, DB-default now()):

<!-- dict:col:email_sends.email_key -->
**`email_key`** (text, NN, **no CHECK**) — which email type this send is. Domain = the batch keys (`founding_*`/`spotlight_*`) **plus** the standalone scheduled keys `tournament_plus_upsell` + `tournament_plus_welcome`. The `cancelScheduledEmail` filter key.

<!-- dict:col:email_sends.subject -->
**`subject`** (text, NN) — the subject as sent (denormalized). **Write-mostly** — the per-send drill-in API does not select it.

<!-- dict:col:email_sends.recipient_org_id -->
**`recipient_org_id`** (uuid, nullable; FK→`organizations(id)` ON DELETE SET NULL) — the org used for opt-out/unsubscribe attribution; the log row survives org deletion with a null org. **Gotcha:** for coach-audience sends this is the **founding org's** id, not the coach's own org (V1 simplification). Nullable in schema but always populated by code.

<!-- dict:col:email_sends.recipient_email -->
**`recipient_email`** (text, NN) — destination email address.

<!-- dict:col:email_sends.recipient_name -->
**`recipient_name`** (text, nullable) — optional display name.

<!-- dict:col:email_sends.status -->
**`status`** (text, NN, default `'queued'`, **no CHECK**) — per-send lifecycle; TS-typed `'queued' | 'sent' | 'failed' | 'suppressed'` ([lib/email-sender.ts:199](../../../lib/email-sender.ts#L199)). Initial `queued` (or `suppressed` on opt-out at insert) → `sent` | `failed` via `updateSend`, or `suppressed` via `cancelScheduledEmail`.

<!-- dict:col:email_sends.suppression_reason -->
**`suppression_reason`** (text, nullable, **no CHECK**) — why a non-sent row was suppressed/failed. Domain = `opt_out` | `no_api_key` | `send_error` | `cancelled_on_upgrade`. Written on failure too (with `status='failed'`); reset to null on `'sent'`.

<!-- dict:col:email_sends.resend_message_id -->
**`resend_message_id`** (text, nullable) — the Resend API message id from the send response; the handle `cancelScheduledEmail` uses to cancel a still-scheduled send (POST `/{id}/cancel`).

<!-- dict:col:email_sends.batch_id -->
**`batch_id`** (uuid, nullable; FK→`email_batches(id)` ON DELETE SET NULL) — the parent batch, or **NULL for standalone scheduled emails** (`tournament_plus_upsell`/`_welcome`) — those call `sendMarketingEmail` with no `batchId`, so `incrementBatchCounter` no-ops and the rows never appear in the batch drill-in.

<!-- dict:col:email_sends.sent_at -->
**`sent_at`** (tstz, nullable) — when the row reached `'sent'`; code-maintained (no trigger); reset to null if the row is updated to `'failed'`. The `cancelScheduledEmail` order key.

### `user_marketing_opt_outs`
<!-- dict:table:user_marketing_opt_outs -->

**Added by migration 185 (2026-07-13 — applied to DEV; ⚠ PROD-PENDING).** Per-person marketing-email opt-out (CASL fix, Notification Settings Phase 2). Fixes the wrong-party unsubscribe: the `spotlight_coaches_coach` campaign emails an INDIVIDUAL coach, but the unsubscribe footer was org-scoped, so a coach's "Unsubscribe" flipped `organizations.email_marketing_opt_out` (cross-identity) instead of their own. **Presence of a row = this user opted out of individual marketing email.** Written by the user-scoped `/unsubscribe?user=…` path ([app/unsubscribe/route.ts](../../../app/unsubscribe/route.ts)); read by `sendMarketingEmail` for `recipientUserId` (coach-audience) sends ([lib/email-sender.ts](../../../lib/email-sender.ts)). **RLS ENABLED, ZERO policies** — service-role only (prod `anon` carries a default SELECT grant, so RLS is what walls it off; see [[reference_supabase_rls_grants]]). Distinct from `organizations.email_marketing_opt_out` (org-level); NOT the parked general per-recipient/guardian suppression system.

<!-- dict:col:user_marketing_opt_outs.user_id -->
**`user_id`** (uuid, PK; FK→`auth.users(id)` ON DELETE CASCADE) — the person who opted out. The row's presence IS the opt-out fact; a resubscribe deletes the row (no UI exposes that in V1).

<!-- dict:col:user_marketing_opt_outs.opted_out_at -->
**`opted_out_at`** (tstz, NN, default `now()`) — when they opted out (audit).

### Functions & mechanics (not tables — not coverage-checked, documented for completeness)

- **`notify()`** ([lib/notify.ts:87](../../../lib/notify.ts#L87)) — the fan-out hub: resolve recipients (all org members, or an explicit `userIds` list forced to `role='member'`) → **Layer 2** tournament opt-out (only if `tournamentId` passed) → **Layer 1** global channel prefs (falling back to `systemDefaults`) → write bell row (`channel_bell`) → fan Web Push (`channel_push` → `push_subscriptions` → `sendWebPush`, 410-delete) → send email (`channel_email` → `notificationEmailHtml` → `sendEmail`). Fire-and-forget; the whole body never throws to the caller.
- **`sendWebPush`** ([lib/web-push.ts:58](../../../lib/web-push.ts#L58)) — the shared single-subscription sender for **both** push tables; VAPID configured once at module load; 24h TTL; **no-ops when VAPID env is unset**; throws `WebPushError` statusCode 410 on expired endpoints (the cleanup signal).
- **`notifyFansForGame(gameId, status)`** ([lib/fan-notify.ts:20](../../../lib/fan-notify.ts#L20)) — the sole reader/writer of `fan_push_subscriptions` for sending: early-returns unless `submitted`/`completed`, re-checks the `fan_score_alerts` plan gate, selects by `(tournament_id, team_id ∈ [home, away])`, dedupes by endpoint, refreshes `last_used_at`, deletes by endpoint on 410/404. Sole production caller = the scoring-service `onScored` hook ([lib/tournament-scoring-service.ts:167](../../../lib/tournament-scoring-service.ts#L167)).
- **Email send pipeline** ([lib/email-sender.ts](../../../lib/email-sender.ts)) — `createEmailBatch` (header, status `'running'`, `started_at=now`) → per recipient `logSend` (INSERT, returns id) → Resend POST (with optional native `scheduled_at`) → `updateSend` (`sent`/`failed` + `resend_message_id`/`sent_at`) → `incrementBatchCounter` (non-atomic) → `finalizeBatch` (`complete`/`failed` + `completed_at`). `cancelScheduledEmail` cancels still-scheduled Resend messages on upgrade. The actual HTML/subjects come from the hardcoded `lib/email.ts` builders + the route `TEMPLATE_REGISTRY` — **not** from `platform_email_templates`.
- **`renderResolvedEmail()` / `renderTemplateEmail()` / `sendTransactionalEmail()`** ([lib/platform-email-templates.ts](../../../lib/platform-email-templates.ts)) — the DB-template loader the migration-083 comment referenced, now built. Reads `platform_email_templates` and renders via the `lib/email-markup.ts` block-markup renderer. `sendTransactionalEmail()` is the drop-in `sendEmail` wrapper used at every transactional send site (auth, billing incl. the Stripe webhook, tournament/tryout/league registration flows). Consumed at send time by BOTH the `marketing` campaigns and all transactional/system templates.

---

*End of Notifications & Push (Phase 10 — 9 tables across 3 sub-systems (incl. `user_marketing_opt_outs`, mig 185): in-app bell + the global/per-tournament preference layers, the member-vs-fan web-push split, and the Resend send-log + mirror template registry. `notify()` is the fan-out hub; only `notifications` carries RLS policies (vestigial for data paths); the two push tables and the DB template registry are built-but-unexercised. Cross-references — not redocuments — `auth.users`, `organizations`, `tournaments`, `teams`, `org_member_tournament_assignments` (Org core), `platform_events.PlatformEventType` (the name-collision), and [[project_email_stack]] / [[project_public_tournament_wow]].)*

---

# Domain: Observability & Feedback

> **Added by migration 118 (2026-06-09) — applied to dev AND prod.** **Migration 122 (Phase 4, 2026-06-10 — applied to dev AND prod, owner-approved)** adds pg_cron + the fold/retention job functions + alert flags on `record_error_event`; it adds **no tables/columns**, so `npm run check:migrations` was BLIND to it (it was applied to prod as a deliberate manual step, verified live). These 6 tables are now **column-sealed** — every live column is documented (anchored) or waived, so a future migration that adds a column here fails the coverage ratchet until triaged. See [docs/projects/active/OBSERVABILITY_ERROR_TRACKING_PLAN.md](../../projects/active/OBSERVABILITY_ERROR_TRACKING_PLAN.md).

> _Last verified: 2026-06-10 @ snapshot 2026-06-10, atop commit `412e4036` (branch `feat/free-tier-coaches`). **The Phase-3 feedback center + the `request_id` "Mechanism A" thread are UNCOMMITTED in the working tree** — `feedback_submissions`' writer/readers (`app/api/feedback/route.ts`, `app/platform-admin/feedback/*`, `app/api/platform-admin/feedback/*`, `lib/feedback-shared.ts`) are UNTRACKED new files, and `lib/observability/capture.ts`/`with-observability.ts`/`instrumentation.ts`/`proxy.ts` are MODIFIED; those `file:line` refs are working-tree-relative. The committed readers (`lib/observability/dashboard.ts`/`metrics.ts`/`alerts.ts`, the triage `status` routes) and the DB-function bodies (`supabase/migrations/118_observability.sql`, `122_observability_phase4.sql`) match `412e4036`. Live probes (2026-06-10, dev+prod `pg_class`/`pg_policies`/`pg_trigger`/`role_table_grants`): all 6 tables column/constraint/CHECK-identical dev↔prod (**zero structural drift**); **RLS ENABLED, ZERO policies, ZERO triggers**; **prod grants `anon`+`authenticated` FULL DML while dev grants only `REFERENCES/TRIGGER/TRUNCATE`** ([[reference_supabase_rls_grants]]). Row counts dev/prod: error_groups 4/0 · error_events 5/0 · request_metrics_rollup 4/0 · request_metrics_raw 2/0 · feedback_submissions 0/0 · observability_cron_heartbeat 2/1._

The platform-admin **error-tracking + in-app feedback** store (the "notification center"). Errors captured server-side (`lib/observability/capture.ts` + `instrumentation.ts onRequestError`) and client-side (`/api/client/error-capture`) are fingerprinted and collapsed into one **`error_groups`** row (the triage unit) with raw occurrences in **`error_events`**; coarse traffic is counted into **`request_metrics_raw`** → folded to **`request_metrics_rollup`** (the calls-vs-errors chart source). **`feedback_submissions`** holds in-app bug/feature reports. **`observability_cron_heartbeat`** proves the Phase-4 rollup/retention jobs ran.

### Gotchas first (the cross-cutting traps)

- **All 6 tables are platform-admin-only; RLS is ENABLED with NO policies** — `supabaseAdmin` (service_role) has `BYPASSRLS` so capture/reads work, while `anon`/`authenticated` resolve to **zero rows** via PostgREST. This is the real protection: prod grants `anon` the default `SELECT` on public tables (verified `has_table_privilege('anon','public.email_sends','SELECT')=true`), so RLS-disabled would have leaked `error_events` (emails/IPs/stacks) through the public REST API. Verified on prod: a sentinel row is visible to service_role but returns 0 rows to `anon`/`authenticated`. (Matches the LIVE posture of `email_sends`/`platform_events`, whose migration *comments* claim "no RLS" but which actually have `relrowsecurity=true` — decide from live schema, not migrations.)
- **Status/severity live on `error_groups`, NOT `error_events`.** Raw events are purged after 30 days (Phase 4); a "resolved"/"ignored" triage decision must survive that purge, so it lives on the group.
- **Grouping happens at write time in Postgres.** `record_error_event(...)` does an `INSERT … ON CONFLICT (fingerprint) DO UPDATE` — a flood of identical errors becomes one `occurrence_count` bump, not N rows. `error_events` is additionally **sampled** (every occurrence up to 50, then every 10th) so one hot fingerprint can't flood the table.
- **`error_events.org_slug` is a denormalized point-in-time snapshot** (join-free org filtering + survives org deletion); `org_id` is the FK (`ON DELETE SET NULL`) that resolves the *current* org. Both nullable — client/anonymous errors carry `org_id = NULL` ("Platform / anonymous").
- **`request_metrics_*` are NOT one row per request.** Each worker buffers per-route tallies in memory (`lib/observability/metrics.ts`) and flushes aggregates into `request_metrics_raw`; the pg_cron fold (`obs_fold_metrics`, every 5 min since mig 122) drains it into `request_metrics_rollup`. **The drain is `DELETE … RETURNING` inside one atomic statement — NEVER "optimize" it to SELECT-then-TRUNCATE** (TRUNCATE is not MVCC-safe and would destroy raw rows committed after the read) **and never change the metrics flush to UPDATE-in-place on `request_metrics_raw`** (a concurrent fold-DELETE would silently swallow the increment).
- **Retention is LIVE (mig 122, `obs_retention_sweep`, nightly 08:15 UTC):** `error_events` > 30 d purged · `error_groups` resolved > 90 d after `resolved_at` deleted (events cascade) · `request_metrics_rollup` > 1 y trimmed · expired snoozes re-opened (`status='snoozed' AND snooze_until < now()` → `open`) · `cron.job_run_details` > 7 d pruned (pg_cron never cleans its own history). **`ignored` groups are kept indefinitely** (deliberate triage decisions). **`distinct_org_count` consequently means "distinct orgs among RETAINED events"** — the sweep recomputes it for every group it purged events from, so it can legitimately shrink over time.
- **`observability_cron_heartbeat.last_run_at` is bumped ONLY on success** — a failing job updates only `status='error'` + `error_detail`, so persistent failure surfaces as dashboard-chip staleness instead of a false-fresh chip. Job rows: `metrics_fold`, `retention_sweep`.
- **`env` ('production' | 'dev')** is set from `OBSERVABILITY_ENV` (fallback `NODE_ENV`) and is belt-and-suspenders on top of the physical dev/prod Supabase-project split. The dashboard defaults to `production`. (Phase 4 also plumbed `OBSERVABILITY_ENV` through `amplify.yml` — before that, BOTH Amplify branches fell back to `NODE_ENV` and tagged `production`.)
- **`request_id` is the bug→error deep-link (Mechanism A).** `proxy.ts` mints an `x-request-id` per `/api/*` request → `with-observability.ts` adopts it (seeds AsyncLocalStorage + re-stamps the response) → `onRequestError` threads it to capture → `error_events.request_id`. The feedback widget stashes the last response id it saw into `feedback_submissions.context.requestId`; the triage page joins `feedback.context.requestId → error_events.request_id → group_id` to render "View related issue". (All of this is **uncommitted** working-tree code.)
- **`request_metrics_*` instrument only 2 routes today** (`org-context`, `notifications` — the only `withObservability`-wrapped routes), so the calls-vs-errors chart is a **narrow slice**, not total platform traffic; the rollup `route`/`org_id` dimensions are written-but-unread or hardcoded-NULL (future-proofing for a broader rollout). The dashboard shows the metric error count (instrumented) **and** the exact `error_events` count side-by-side because they legitimately disagree (e.g. a 4xx bumps `error_events` but not the metric `error_count`).
- **Many columns here are capture-but-never-read or read-but-unrendered, by design** — forensic-only and truly unread (`error_events.ip_address`/`user_agent`, both `created_at` twins), selected-but-not-surfaced (`error_groups.sample_stack`/`sample_context` — pulled by the detail `select('*')` but never displayed), future-proofing (the rollup `route`/`org_id`), or admin-trail (`feedback_submissions.triaged_by`/`triaged_at`/`updated_at`, the heartbeat `rows_*`/`error_detail`). Each is flagged per-column below so a reader doesn't assume a UI surfaces it.
- **Dev/prod:** migration 118 applied to **both dev and prod** (2026-06-09); **migration 122 applied to BOTH dev and prod 2026-06-10** (functions/jobs only — invisible to the column-level drift gate; prod verified live: pg_cron installed, 2 jobs as postgres, anon execute denied).

---

## `error_groups`
<!-- dict:table:error_groups -->

**Purpose:** one row per distinct issue (**fingerprint** = `sha256(route + errorName + topNormalizedStackFrames)`, 16-hex). The list / triage / drilldown unit. **Status + severity persist here** across the raw-event purge. Upserted by the `record_error_event` RPC on every capture (`ON CONFLICT (fingerprint)`); triaged by the platform-admin status route.

**Gotchas (read first):**
1. **Sample identity is frozen at first capture** — `title`/`error_name`/`route`/`http_method`/`env`/`first_seen_at` are set on insert and **not** touched by the conflict update; only `last_seen_at`, `occurrence_count`, `severity` (escalate-only), `distinct_org_count`, and the sample blobs update on recurrence.
2. **No `org_id` column** — org filtering on the issue list is a 2-hop resolve through `error_events.org_slug` ([dashboard.ts:313](../../../lib/observability/dashboard.ts#L313)).
3. **The dashboard treats an expired snooze as `open` at read time, but the row's `status` stays `'snoozed'`** until the nightly `obs_retention_sweep` flips it — so an expired-snooze group is *counted* open while its stored status is still snoozed.
4. **Lifecycle columns are derived by app code, not a trigger** (there are none): the status route sets `resolved_at`/`resolved_by`/`snooze_until` purely from the target status ([status/route.ts:50](../../../app/api/platform-admin/observability/[groupId]/status/route.ts#L50)).

**Fields** (boilerplate `id` + `created_at` omitted — `created_at` is **write-only** [DB-default, never read; redundant with `first_seen_at`]; no `updated_at`):

<!-- dict:col:error_groups.fingerprint -->
**`fingerprint`** (text, NN, **UNIQUE**) — the grouping key: `sha256(route + errorName + topNormalizedStackFrames)` sliced to 16 hex ([lib/observability/fingerprint.ts:49](../../../lib/observability/fingerprint.ts#L49)); the `ON CONFLICT (fingerprint)` target that collapses identical errors at write time. The normalization regex ([fingerprint.ts:14](../../../lib/observability/fingerprint.ts#L14)) is the merge/split tuning knob, pinned by `tests/unit/observability.test.ts`.

<!-- dict:col:error_groups.title -->
**`title`** (text, nullable) — human label (`name @ route` unless explicit); **frozen at first capture**; searchable.

<!-- dict:col:error_groups.error_name -->
**`error_name`** (text, nullable) — `Error.name` (or `ClientError`); part of the fingerprint basis; frozen on conflict; searchable.

<!-- dict:col:error_groups.route -->
**`route`** (text, nullable) — request route; fingerprint basis; frozen on conflict; filterable + searchable.

<!-- dict:col:error_groups.http_method -->
**`http_method`** (text, nullable) — HTTP verb of the originating request; frozen on conflict.

<!-- dict:col:error_groups.severity -->
**`severity`** (text, NN, default `'error'`; CHECK `critical|error|warning|info`) — **escalate-only**: the RPC raises it only when `obs_severity_rank(new) > rank(existing)` ([122:275](../../../supabase/migrations/122_observability_phase4.sql#L275)), so a group that ever hit `critical` stays critical. Per-occurrence value from `classifySeverity` (critical when the route matches the payments/auth/register/org-create patterns; the client endpoint forces `warning`).

<!-- dict:col:error_groups.status -->
**`status`** (text, NN, default `'open'`; CHECK `open|resolved|ignored|snoozed`) — triage lifecycle; **persists across the event purge**. The RPC only ever does the **>7-day auto-reopen** (`resolved`→`open`, anti-flap — a recurrence within 7 days deliberately stays resolved); `resolved`/`ignored`/`snoozed` are set solely by the triage route.

<!-- dict:col:error_groups.env -->
**`env`** (text, NN, default `'production'`; CHECK `production|dev`) — dev/prod discriminator the dashboard defaults+filters on; frozen on conflict. **Asymmetry:** the CHECK exists here but **not** on `error_events.env`. Value = `observabilityEnv()` (`OBSERVABILITY_ENV` override else `NODE_ENV`).

<!-- dict:col:error_groups.first_seen_at -->
**`first_seen_at`** (tstz, NN, default now()) — first capture of this fingerprint; the MTTR denominator + `newIssues` window key; frozen on conflict.

<!-- dict:col:error_groups.last_seen_at -->
**`last_seen_at`** (tstz, NN, default now()) — most recent occurrence; bumped every conflict; the issue-list sort key.

<!-- dict:col:error_groups.occurrence_count -->
**`occurrence_count`** (int8, NN, default 0) — **total** occurrences, inserted as 1 and `+1` per conflict **even when the raw event is sampled out** — so it routinely exceeds the stored `error_events` row count. `==1` is the `is_new` alert flag.

<!-- dict:col:error_groups.distinct_org_count -->
**`distinct_org_count`** (int4, NN, default 0) — "affected orgs" = `count(distinct org_id)` among **currently-retained** `error_events`. Recomputed by the RPC (gated on a sampled insert + non-null org) and by the retention sweep — so it can legitimately **shrink** after the 30-day purge removes an org's last event.

<!-- dict:col:error_groups.resolved_at -->
**`resolved_at`** (tstz, nullable) — set by the triage route on resolve; drives the >7-day auto-reopen, the >90-day group purge, and MTTR.

<!-- dict:col:error_groups.resolved_by -->
**`resolved_by`** (text, nullable, no FK) — email of the resolving platform admin (`auth.user.email ?? 'platform-admin'`). Selected by the detail `select('*')` but **not** in the paginated list select.

<!-- dict:col:error_groups.snooze_until -->
**`snooze_until`** (tstz, nullable) — snooze expiry (clamped 1h–720h by the route, no DB CHECK). The dashboard derives "expired = open" at read time; the nightly sweep does the real `→open` + null-out.

<!-- dict:col:error_groups.sample_stack -->
**`sample_stack`** (text, nullable) — most-recent redacted stack (overwritten each occurrence). **Selected but not rendered** — the detail page shows the per-`error_events` stack instead.

<!-- dict:col:error_groups.sample_context -->
**`sample_context`** (jsonb, NN, default `{}`) — most-recent redacted `request_context` (overwritten each occurrence). Same as `sample_stack` — selected into the detail type but not rendered.

## `error_events`
<!-- dict:table:error_events -->

**Purpose:** high-volume append-only log, one row per **occurrence** — written **only by the `record_error_event` RPC**, whose INSERT is **sampled inside the function** (every occurrence up to 50, then every 10th). Rich point-in-time attribution; raw rows auto-purged after 30 days — `error_groups` is the durable record. (RLS-enabled-zero-policies despite the migration comment's "no RLS" — read posture from live `pg_class`.)

**Gotchas (read first):**
1. **`env` has NO CHECK** (unlike `error_groups.env`) — intentional asymmetry; both written from the same `coalesce(p_env,'production')`.
2. **Attribution comes from AsyncLocalStorage, which is EMPTY on the global `onRequestError` path** (the throw unwound it) — so uncaught/RSC errors carry `route`/`http_method`/`request_id`/`status_code=500` but typically **no org/user**. The only ALS enricher is `app/api/org-context/route.ts`.
3. **`user_email` is stored VERBATIM by design** (the dedicated attribution column — the one intentionally-retained email), while `error_message`/`stack_trace`/`request_context` are email-**scrubbed**. `request_id` is duplicated into `request_context` too.
4. **Deleted only by the retention sweep + `ON DELETE CASCADE` from the group** — never by app code.

**Fields** (boilerplate `id` + `created_at` omitted — `created_at` is **write-only** [redundant with `occurred_at`]):

<!-- dict:col:error_events.group_id -->
**`group_id`** (uuid, NN; FK→`error_groups(id)` ON DELETE CASCADE) — ties the occurrence to its issue; the drilldown + org→group resolve key; the retention sweep collects affected `group_id`s to recompute `distinct_org_count`.

<!-- dict:col:error_events.occurred_at -->
**`occurred_at`** (tstz, NN, default now()) — occurrence time; the breakdown/sparkline axis and the 30-day purge cutoff.

<!-- dict:col:error_events.env -->
**`env`** (text, NN, default `'production'`, **no CHECK**) — dev/prod tag; the dashboard's primary event filter (see gotcha 1).

<!-- dict:col:error_events.source -->
**`source`** (text, NN, default `'server'`; CHECK `server|client`) — server capture vs the public `/api/client/error-capture` endpoint. **`alerts.ts` hard-gates `source==='server'`**, so a client-reported error can never trigger a critical email (anti-spoof).

<!-- dict:col:error_events.route -->
**`route`** (text, nullable) — per-occurrence route (may differ from the group's frozen route); the `byRoute` breakdown source.

<!-- dict:col:error_events.http_method -->
**`http_method`** (text, nullable) — per-occurrence HTTP verb.

<!-- dict:col:error_events.status_code -->
**`status_code`** (int4, nullable) — HTTP status of the failing response; NULL unless a caller passes it; `onRequestError` always sets **500**.

<!-- dict:col:error_events.error_name -->
**`error_name`** (text, nullable) — `Error.name` for this occurrence. **Write-only on events** — no event reader selects it (the detail UI shows the group's `error_name`).

<!-- dict:col:error_events.error_message -->
**`error_message`** (text, nullable) — email-scrubbed, 1000-char-capped message (`scrubEmails` → embedded PII emails become `[redacted-email]`).

<!-- dict:col:error_events.stack_trace -->
**`stack_trace`** (text, nullable) — email-scrubbed, 8000-char-capped stack.

<!-- dict:col:error_events.org_id -->
**`org_id`** (uuid, nullable; FK→`organizations(id)` ON DELETE SET NULL) — attributed org; drives `distinct_org_count`. Goes **NULL on org deletion** (silently lowering the count on the next recompute); `org_slug` preserves the historical slug.

<!-- dict:col:error_events.org_slug -->
**`org_slug`** (text, nullable, no FK) — denormalized **point-in-time** org slug; the **join-free org filter key** (the issue-list org filter is a 2-hop `org_slug ILIKE → group_ids`, since `error_groups` has no `org_id`). Survives org deletion.

<!-- dict:col:error_events.user_id -->
**`user_id`** (uuid, nullable, no FK [cross-schema to `auth.users`]) — acting user id. **Write-only** — no reader selects it.

<!-- dict:col:error_events.user_email -->
**`user_email`** (text, nullable) — acting user's email, stored **verbatim** (deliberately not scrubbed — see gotcha 3); surfaced in the event drilldown.

<!-- dict:col:error_events.user_role -->
**`user_role`** (text, nullable) — acting user's role (owner/admin/coach/…) for triage context.

<!-- dict:col:error_events.request_id -->
**`request_id`** (text, nullable) — the `x-request-id` threaded from the request (Mechanism A); **the deep-link key joining a `feedback_submissions` bug report to its server error** (`feedback.context.requestId → error_events.request_id → group_id`). NULL for captures with no upstream id (client-source events typically have it null). Also copied into `request_context`.

<!-- dict:col:error_events.ip_address -->
**`ip_address`** (text, nullable) — best-effort client IP; **written ONLY by the public client-error endpoint, read by NOBODY** (write-only — and the only IP the system retains).

<!-- dict:col:error_events.user_agent -->
**`user_agent`** (text, nullable) — client UA; same as `ip_address` — written only by the client endpoint, **read by nobody**.

<!-- dict:col:error_events.request_context -->
**`request_context`** (jsonb, NN, default `{}`) — redacted free-form context (componentStack, RSC `routeType`/`renderSource`, + a copy of `requestId`); the whole blob runs through `redactContext` ([lib/observability/redact.ts:44](../../../lib/observability/redact.ts#L44)) — sensitive keys → `[redacted]`, email values → `[redacted-email]`, depth/length capped.

## `request_metrics_rollup`
<!-- dict:table:request_metrics_rollup -->

**Purpose:** coarse calls-vs-errors counters — **the dashboard chart source**. NOT one row per request. 5-minute buckets; `route = NULL` = all-routes aggregate, `org_id = NULL` = platform-wide. Folded from `request_metrics_raw` by pg_cron (Phase 4). O(buckets) to chart.

**Gotchas (read first):**
1. **Uniqueness is a UNIQUE EXPRESSION INDEX, not a table constraint** — `(bucket_start, env, coalesce(route,''), coalesce(org_id, zero-uuid))` ([118:105](../../../supabase/migrations/118_observability.sql#L105)); it won't appear in `pg_constraint`, and the fold's `ON CONFLICT` target must restate the same `coalesce` expression.
2. **Counts ACCUMULATE via the fold upsert** (`+= excluded`), not overwrite; re-running the fold is idempotent only because raw was DELETE-drained first.
3. **NO CHECK on `env`** (unlike `error_groups.env`) — discipline is app-side `observabilityEnv()` only.
4. **`route` + `org_id` are written by the fold but NOT read by the dashboard** (it selects only `bucket_start`/`call_count`/`error_count`); the per-route breakdown comes from `error_events`, and `org_id` is hardcoded NULL upstream — both dimensions are future-proofing.

**Fields** (boilerplate `id` + `created_at` omitted — `id` is a pure surrogate [never read or explicitly written]; `created_at` is write-only [windowing uses `bucket_start`]):

<!-- dict:col:request_metrics_rollup.bucket_start -->
**`bucket_start`** (tstz, NN) — start of the 5-minute bucket, computed by the **fold** as `to_timestamp(floor(epoch(flushed_at)/300)*300)` (the flooring happens in the DB function, not at write time); the chart window key; rollup rows >1y trimmed by the sweep.

<!-- dict:col:request_metrics_rollup.env -->
**`env`** (text, NN, default `'production'`, **no CHECK**) — env discriminator carried verbatim through the fold; the chart's `.eq('env')` filter.

<!-- dict:col:request_metrics_rollup.route -->
**`route`** (text, nullable) — route the counts belong to (`NULL` = all-routes); part of the unique index. **Written by the fold but never selected by the dashboard** — the per-route breakdown is computed from `error_events` instead.

<!-- dict:col:request_metrics_rollup.org_id -->
**`org_id`** (uuid, nullable, no enforced FK) — org the counts belong to (`NULL` = platform-wide); part of the unique index. **Always NULL today** (the writer hardcodes it) and never selected — pure future-proofing.

<!-- dict:col:request_metrics_rollup.call_count -->
**`call_count`** (int8, NN, default 0) — calls in the bucket; summed into `totalCalls`, the **error-rate denominator** (read via `Number(...)` to coerce the bigint string).

<!-- dict:col:request_metrics_rollup.error_count -->
**`error_count`** (int8, NN, default 0) — 5xx/error calls in the bucket; the chart error line + error-rate **numerator**. The metric (instrumented-routes) error count — **distinct from** the exact `error_events` count the dashboard also shows side-by-side.

## `request_metrics_raw`
<!-- dict:table:request_metrics_raw -->

**Purpose:** thin staging for the in-process tally flushes (so we never insert a row per HTTP call). The pg_cron fold (`obs_fold_metrics`, every 5 min) **drains it via atomic `DELETE … RETURNING`** into `request_metrics_rollup` (rows committed after the fold's snapshot simply survive to the next run).

**Gotchas (read first):**
1. **Insert-only aggregate flush** — `lib/observability/metrics.ts` buffers per-route tallies in memory and inserts one row **per buffered route** on flush (not per request). The only drain trigger is the lazy `maybeFlush` on a later request (60s age OR 200 calls); `flushRequestMetrics` is exported but **unused** (no shutdown/SIGTERM hook → a frozen/killed serverless worker loses its unflushed buffer — accepted, "metrics must never break the request path").
2. **Drained by `DELETE … RETURNING`, NOT TRUNCATE** — load-bearing for MVCC: rows committed after the fold's snapshot survive to the next run. The migration comments' "truncates the staging table" is misleading shorthand. Raw is purely insert-then-delete — **no UPDATE-in-place**, so no fold-vs-flush increment race.
3. **NO CHECK on `env`**; `flushed_at` is the time axis — raw has **no `created_at`** (the inverse of `rollup`, which has `created_at` and no `flushed_at`; easy to confuse).

**Fields** (boilerplate `id` omitted — pure surrogate, never read or explicitly written; **no `created_at`** column):

<!-- dict:col:request_metrics_raw.flushed_at -->
**`flushed_at`** (tstz, NN, default now()) — wall-clock of the worker flush; raw's time axis (the value the fold floors into `bucket_start`); the chart's raw-window filter.

<!-- dict:col:request_metrics_raw.env -->
**`env`** (text, NN, default `'production'`, **no CHECK**) — env from `observabilityEnv()`; folded verbatim into `rollup.env`.

<!-- dict:col:request_metrics_raw.route -->
**`route`** (text, nullable) — the in-memory buffer key (the `withObservability` route). **Only `org-context` / `notifications` appear today** (the only wrapped routes); folds into the (unread) `rollup.route`.

<!-- dict:col:request_metrics_raw.org_id -->
**`org_id`** (uuid, nullable, no enforced FK) — **hardcoded NULL** by the writer ([metrics.ts:71](../../../lib/observability/metrics.ts#L71)); the per-org dimension is never exercised.

<!-- dict:col:request_metrics_raw.call_count -->
**`call_count`** (int8, NN, default 0) — calls accumulated for the route since the last flush (incremented on **every** `recordRequest`); summed into the chart's `totalCalls` (raw + rollup, no double-count because DELETE drains raw before it becomes a rollup row).

<!-- dict:col:request_metrics_raw.error_count -->
**`error_count`** (int8, NN, default 0) — error calls since the last flush — incremented **only when `isError`** (HTTP ≥500 or a thrown error), so it can disagree with `error_events` (a 4xx capture bumps `error_events` but not this).

## `feedback_submissions`
<!-- dict:table:feedback_submissions -->

**Purpose:** in-app **bug / feature / feedback** submissions from all personas (org admin, coach, scorekeeper, anonymous public) — the Phase-3 feedback center (writer + readers are **UNCOMMITTED** working-tree files; **0 rows in both envs**, brand new). `org_id` nullable. The `context` jsonb deep-links a bug report to its `error_group` via `context.requestId`.

**Gotchas (read first):**
1. **`org_id` NULL collapses TWO cases** under the triage label "Platform / anonymous": (a) truly anonymous (no session), and (b) an **org-less signed-in Basic coach** (`user_id`/`user_email` are set, but `auth.org` is null — the `getAuthenticatedUser` fallback).
2. **`context.requestId` is the bug→error deep-link** (camelCase on both write + read): the triage page resolves it via `error_events.request_id → group_id` and renders "View related issue →". **Only `context.requestId` is read back** — the other context keys are write-only.
3. **`severity` is admin-set-only AND currently unreachable through the UI** — the submission writer never sets it; only the status PATCH can, but the triage UI exposes **no severity control at all** (`StatusControls` sends only `{status}`), so it's settable solely by a hand-crafted API call and stays NULL in practice (latent UI gap).
4. **`type`/`status`/`severity` are DB-CHECK enums; `category` is TS-only** (no DB CHECK — invalid coerced to `'Other'`, the 6-value list duplicated across 2+ TS files). The validator requires `type` + `body`, so the `type` DB default `'feedback'` is unreachable via the route.
5. **`updated_at` is code-maintained (no trigger)** — set explicitly on every status PATCH; the insert relies on the DB default. `body`/`title` are email-scrubbed (`scrubEmails`) while the `context` blob is key-redacted by a *different* function (`redactContext`); the CSV/XLSX export formula-neutralizes the attacker-controlled `body`.

**Fields** (boilerplate `id`, `created_at`, `updated_at` omitted — `created_at` is the newest-first sort key for the list + export; `updated_at` is code-maintained on the status PATCH and **never read back**):

<!-- dict:col:feedback_submissions.org_id -->
**`org_id`** (uuid, nullable; FK→`organizations(id)` ON DELETE SET NULL) — owning org, or NULL (anonymous / org-less Basic coach — gotcha 1). Deleting an org orphans feedback to NULL (retained); triage joins `organizations(id,name)` for display.

<!-- dict:col:feedback_submissions.user_id -->
**`user_id`** (uuid, nullable, no FK to `auth.users`) — submitting user from the session (never the body; set for org-less coaches too). **Write-only** — no reader selects it.

<!-- dict:col:feedback_submissions.user_email -->
**`user_email`** (text, nullable) — submitter email from the session only (can't be spoofed; null for anonymous); the confirmation-email recipient + triage "From" column.

<!-- dict:col:feedback_submissions.submitter_name -->
**`submitter_name`** (text, nullable) — display name from `user_metadata.full_name || name`; the confirmation-email greeting + triage "From" fallback; null for anonymous.

<!-- dict:col:feedback_submissions.type -->
**`type`** (text, NN, default `'feedback'`; CHECK `bug|feature|feedback`) — submission kind; **required by the validator** so the DB default is unreachable via the route. Drives the type badge + email subject.

<!-- dict:col:feedback_submissions.category -->
**`category`** (text, nullable, **no CHECK**) — user-facing area bucket; **TS-only enum** `Tournaments|Coaches|Registrations|Accounting|Billing|Other` (`lib/feedback-shared.ts`), default picked from the route, invalid → `'Other'` (so effectively never null from the route).

<!-- dict:col:feedback_submissions.title -->
**`title`** (text, nullable) — optional summary; email-scrubbed, capped 150.

<!-- dict:col:feedback_submissions.body -->
**`body`** (text, NN) — required free-text; email-scrubbed, capped 4000; **attacker-controlled** (anonymous) → the CSV/XLSX export neutralizes a leading `=`/`+`/`-`/`@` to defuse formula injection. The only required field besides `type`.

<!-- dict:col:feedback_submissions.status -->
**`status`** (text, NN, default `'new'`; CHECK `new|triaged|acknowledged|resolved`) — triage state; the **submission writer never sets it** (always `'new'` via default); mutated only by the status PATCH (optimistic UI; view-only roles get a badge + a 403).

<!-- dict:col:feedback_submissions.severity -->
**`severity`** (text, nullable; CHECK `critical|error|warning|info`) — operator-assigned (same enum as `error_groups.severity`); **admin-set-only and unreachable through the shipped UI** (gotcha 3): the triage UI has no severity control and `StatusControls` sends only `{status}`, so it stays DB-default NULL in practice — the CSV/XLSX export is the only surface that reads it.

<!-- dict:col:feedback_submissions.context -->
**`context`** (jsonb, NN, default `{}`) — structured metadata; **always populated by the route** (never the bare default). Key catalog: the client supplies `route`/`help_section`/`app_version`/`requestId`; the server adds `ip`/`user_agent`/`role`/`org_slug`; then the whole blob is `redactContext`-scrubbed. **Only `context.requestId` is ever read back** (the error deep-link) — the rest are write-only. Not in the export.

<!-- dict:col:feedback_submissions.triaged_by -->
**`triaged_by`** (text, nullable, no FK) — operator email who first moved the item off `'new'` (also written to `platform_audit_log`); set conditionally. **Write-only** — no reader selects it.

<!-- dict:col:feedback_submissions.triaged_at -->
**`triaged_at`** (tstz, nullable) — timestamp of the first move off `'new'` (set with `triaged_by`); distinct from `updated_at` (which bumps on every change). **Write-only** — no reader selects it.

<!-- dict:col:feedback_submissions.escalated_at -->
**`escalated_at`** (tstz, nullable) — flag-for-product timestamp (F3 Phase 4, mig 126). NULL = not escalated; set to `now()` when a write-capable operator escalates, **nulled** when the escalation is cleared (no history — the `platform_audit_log` `escalate_feedback`/`clear_feedback_escalation` entries are the durable trail). **Its presence IS the escalated state** — read back by the triage list for the "Escalated" badge, by the synthetic `status=escalated` filter on both the list **and the CSV/XLSX export** (`.not('escalated_at','is',null)`, orthogonal to the `status` column: an escalated item keeps its own new/triaged/… status), and emitted as the export's `escalated_at` column. Mutated only by `feedback/[id]/escalate/route.ts`, gated on the `feedback` area write check.

<!-- dict:col:feedback_submissions.escalated_by -->
**`escalated_by`** (text, nullable, no FK) — platform-operator email who escalated the item (mirrors `triaged_by`); set with `escalated_at`, nulled when the escalation is cleared. Re-escalating an already-escalated item is a no-op (the original who/when is **not** restamped). **Write-only** — no reader selects it (the list reads only `escalated_at`).

## `observability_cron_heartbeat`
<!-- dict:table:observability_cron_heartbeat -->

**Purpose:** one row per pg_cron job (live since mig 122: `metrics_fold`, `retention_sweep`); updated on each *successful* run so a stalled or failing job is visible on the dashboard. The freshness chip turns amber on three signals: a **ran-and-failed** job (`status='error'`), a stale **fold** (most-recent run >15 min vs its 5-min cadence), or a stale **sweep** (>26h). Two residual blind spots (by design, low-risk): a job that has **never** run leaves no row → the chip shows the neutral gray "Rollup has not run yet" (also the deployed-but-pre-122 window); and a `statement_timeout`-cancelled fold writes no `status='error'` row (`WHEN OTHERS` doesn't trap SQLSTATE 57014) but rolls back cleanly and is still caught by fold-staleness.

**Gotchas (read first):**
1. **`last_run_at` is bumped ONLY on the success path** — the exception path upserts `status='error'` + `error_detail` **without** touching `last_run_at`, so a persistently-failing job shows as freshness staleness (amber), never a false-fresh green chip.
2. **`rows_folded`/`rows_purged` are partitioned by job** — `metrics_fold` writes `rows_folded` (leaves `rows_purged` null), `retention_sweep` writes `rows_purged` (leaves `rows_folded` null); each job's on-conflict update touches only its own counter.
3. **The reader ignores `rows_folded`/`rows_purged`/`error_detail`** (`getCronFreshness` selects only `job_name`/`last_run_at`/`status`) — all three are write-only; `error_detail` appears only as static dashboard copy ("see `observability_cron_heartbeat.error_detail`"), so an operator must query the table directly to read it.
4. **Only `retention_sweep` is matched by name** in the reader; `metrics_fold`'s freshness is captured positionally as the freshest job (`mostRecent`), which in practice is the 5-min fold.

**Fields** (no boilerplate `id`/`created_at`/`updated_at` — `job_name` is the PK; the rest are job-state columns):

<!-- dict:col:observability_cron_heartbeat.job_name -->
**`job_name`** (text, **PK**, no CHECK) — the pg_cron job id; one of `'metrics_fold'` / `'retention_sweep'` (set literally in the function bodies); the upsert conflict target.

<!-- dict:col:observability_cron_heartbeat.last_run_at -->
**`last_run_at`** (tstz, nullable) — last **successful** run (success-only — gotcha 1); drives the "last rollup N min ago" chip. NULL until first success → the gray "not run yet" state.

<!-- dict:col:observability_cron_heartbeat.rows_folded -->
**`rows_folded`** (int8, nullable) — rows folded by the last `metrics_fold` success. **Write-only** (the reader doesn't select it); `retention_sweep` leaves it null.

<!-- dict:col:observability_cron_heartbeat.rows_purged -->
**`rows_purged`** (int8, nullable) — rows deleted by the last `retention_sweep` success (events + groups + rollup-trim + cron-history). **Write-only**; `metrics_fold` leaves it null.

<!-- dict:col:observability_cron_heartbeat.status -->
**`status`** (text, nullable; CHECK `ok|error`) — last-run outcome; `'error'` (set without bumping `last_run_at`) drives the `anyJobError` amber signal.

<!-- dict:col:observability_cron_heartbeat.error_detail -->
**`error_detail`** (text, nullable) — truncated `left(SQLERRM, 2000)` from the last failure, reset to null on success (holds only the most recent failure). **Write-only** — referenced only in static UI copy, never fetched.

### Functions & cron jobs (not tables — not coverage-checked, documented for completeness)

- **`record_error_event(...) → jsonb`** (mig 122 changed the return from `uuid` — a return type can't be altered in place, so 122 DROPs + recreates it) — atomic group-upsert + sampled `error_events` insert + `distinct_org_count` maintenance, in one round trip; called fire-and-forget by `lib/observability/capture.ts`. Returns `{group_id, is_new, became_critical, regressed, reopened, severity, status}` — the Phase-4 **alert transition flags** (live-verified on dev: `is_new` ⟺ brand-new fingerprint; `regressed` fires exactly once per resolve cycle on the first recurrence — covering the ≤7-day window where the group deliberately stays `resolved`; `reopened` = the >7-day auto-reopen). OLD values come from a pre-SELECT, NEW values from the upsert's RETURNING (a pre-SELECT alone can never see post-transition values).
- **`obs_fold_metrics() → jsonb`** — the 5-min fold (see `request_metrics_raw`). Bucket keys are pre-normalized with the same `coalesce` as the rollup's unique index then mapped back to NULL via `nullif` — without this, a NULL-vs-`''` route pair in one bucket raises SQLSTATE 21000 and wedges the fold permanently.
- **`obs_retention_sweep() → jsonb`** — the nightly retention pass (see gotchas). Purge → recompute `distinct_org_count` runs as **two separate statements** deliberately: a CTE recount would share the DELETE's snapshot and still count the deleted rows.
- Both job functions: **SECURITY DEFINER** (owner `postgres`; needed so the service-role manual sweep can prune `cron.job_run_details`), `search_path = ''`, **EXECUTE revoked from PUBLIC/anon/authenticated** (verified live: anon → `42501`), granted to `service_role` (the `/api/platform-admin/observability/sweep` fallback, super_admin-gated). Neither ever raises — failures land in the heartbeat + the returned jsonb.
- **`obs_severity_rank(text) → int`** — immutable `critical=4 … info=1` ranking used by the severity-escalation `CASE` in `record_error_event`.
- **Cron jobs (`cron.job`, scheduled as `postgres`, GMT):** `observability-metrics-fold` `*/5 * * * *` · `observability-retention-sweep` `15 8 * * *` (≈3–4 am Eastern). `cron.schedule(name, …)` is a named upsert → re-applying 122 is idempotent (but it does NOT re-activate a job deactivated via `cron.alter_job(active:=false)`). pg_cron never runs the same job concurrently with itself.
- **`app_cron_http_tick(p_job_name text, p_path text) → void`** (mig 183) — the scheduled-HTTP bridge: reads `app_cron_base_url` + `app_cron_secret` from **Supabase Vault** (`vault.decrypted_secrets`), `pg_net` `net.http_post`s `{base}{path}` with an `x-cron-secret` header (matching the app's `CRON_SECRET`), and heartbeats into `observability_cron_heartbeat` (same `last_run_at`-only-on-success discipline as the obs jobs). **`status='ok'` means "HTTP dispatched", NOT "sweep succeeded"** — pg_net is fire-and-forget; the app-side truth is the platform audit log (`insights_digest_sweep` / `dues_reminders_sweep` rows). If either Vault secret is unset the tick no-ops with a visible `status='error'` heartbeat. SECURITY DEFINER, `search_path=''`, EXECUTE revoked from PUBLIC/anon/authenticated, granted `postgres`+`service_role`. Uses `pg_net` (installed by mig 183; `pg_cron` came from mig 122).
- **Cron jobs added by mig 183 (`cron.job`, `postgres`, GMT):** `insights-digest-weekly` `0 23 * * 0` (Sun 23:00 UTC ≈ 6–7pm Toronto) + `insights-digest-catchup` `0 13 * * 1` (Mon 13:00 UTC — a lost-Sunday retry; the digest's 6-day dedupe means only missed teams get served, never a duplicate) · `dues-reminders-daily` `30 13 * * *` (13:30 UTC ≈ 8:30–9:30am Toronto). All three call `app_cron_http_tick(...)`. Idempotent named upserts. ⚠️ Table-free DDL — the `check:migrations` column-diff gate is BLIND to prod missing mig 183 (same caveat as 122); track PROD-PENDING in the plan doc and apply deliberately.
- **Request-metrics buffer/flush** — `lib/observability/metrics.ts`: an in-process per-route `Map` tally (`recordRequest` increments `call`, and `error` when `isError` = HTTP ≥500 or a throw), flushed by the lazy `maybeFlush` (60 s / 200 calls) as one `request_metrics_raw` row per route via `supabaseAdmin`. Fed by `withObservability` (the route wrapper, working-tree). Only `org-context` + `notifications` are wrapped today, so the metrics see a narrow slice of traffic.
- **Mechanism A — the `request_id` thread (working-tree, uncommitted)** — `proxy.ts` mints `crypto.randomUUID()` and stamps `x-request-id` on the forwarded request + response → `with-observability.ts` adopts a valid incoming id (else mints), seeds AsyncLocalStorage, re-stamps the response → `onRequestError` reads it off the request headers (no ALS on that path) and passes `opts.requestId` → `capture.ts` writes it to `error_events.request_id` (and copies it into `request_context`). The browser (`lib/observability/client-request-id.ts`) stashes the response id; the feedback widget submits it as `context.requestId`; the triage page joins it back to the error group.
- **Feedback ingest + redaction (working-tree, uncommitted)** — `app/api/feedback/route.ts` (all-personas POST, `runtime='nodejs'` so it can use the service-role key): validates via `lib/feedback-shared.ts`, scrubs `title`/`body` with `scrubEmails`, `redactContext`s the `context` blob, best-effort per-Lambda-instance throttles (returns a 202 soft-success, not 429), then `supabaseAdmin`-inserts and fires an awaited admin-notify + a fire-and-forget submitter-confirmation email (`lib/feedback-email.ts`, reusing `lib/email.ts`'s `wrap`/`escapeHtml`). Triage = `app/platform-admin/feedback/*` + the formula-neutralized CSV/XLSX export, both gated by the **observability platform-area view** (`super_admin`/`product`/`support`); the `[id]/status` PATCH additionally requires `manage_product`.

---

*End of Observability & Feedback (migrations 118 + 122 [Phase-4 functions/jobs] applied dev+prod; 6 tables, now **column-sealed**). RLS-enabled-zero-policies-zero-triggers throughout; the error-tracking core (RPC-upserted groups + sampled events), the in-process metrics fold, the Phase-3 feedback center [uncommitted working-tree], and the cron heartbeat. Many forensic / future-proof columns are capture-but-never-read by design (flagged per-column). Cross-references — not redocuments — `organizations`, `auth.users`, `platform_events` [the distinct business-event log], and [[project_email_stack]] [the feedback emails].*

---

# Domain: Chat

> **Added by migrations 141 + 146 + 147 + 148 + 149 — applied to DEV only (⚠ PROD-PENDING).** The shared chat engine — Project 1 (Tournament Chat) of the Coach Chat program. Built + validated as the **proving slice**: live delivery + tenant-privacy (RLS) confirmed on the live dev DB via `scripts/validate-chat-slice.mjs` BEFORE any UI. Mig 141 = the 3-table engine (6/6). Mig 146 = pinned messages (`chat_messages.pinned_*`, rides the existing publication). Mig 147 = emoji reactions (`chat_message_reactions`, the 2nd realtime-published table; caught + fixed an RLS-on-hard-DELETE leak by soft-deleting). Mig 148 = poll votes (`chat_poll_votes`, the 3rd realtime-published table; same soft-delete pattern; poll definition rides `chat_messages.metadata`). Mig 149 = dedupe duplicate rooms from a creation race + partial unique indexes on `chat_rooms (surface, ref_id[, ref_sub_id])` so one conversation = one room. Slice grown to **34/34**. NOT column-sealed yet (revisit at the surface build). See [COACH_CHAT_PLATFORM_PLAN.md](../../projects/active/COACH_CHAT_PLATFORM_PLAN.md) §2 + [TOURNAMENT_CHAT_PLAN.md](../../projects/active/TOURNAMENT_CHAT_PLAN.md).

One generic engine, three tables: **chat_rooms** (a conversation, typed by `surface`), **chat_room_members** (who's in it + each person's read watermark), **chat_messages** (append-only, soft-delete). Access is **membership-based**, org-agnostic — a person reads a room's messages only if they hold an `active` membership row. Realtime delivery is via the `supabase_realtime` publication on `chat_messages` (REPLICA IDENTITY FULL).

### Gotchas first (the cross-cutting traps)

- **Membership is the ONLY access key — RLS, not `org_id`.** `chat_messages`/`chat_rooms` SELECT policies subquery `chat_room_members` for an `active` row for `auth.uid()`. Deliberately org-agnostic so a future cross-org room (Project 3) works unchanged.
- **`chat_room_members` SELECT policy is OWN-ROWS-ONLY (`user_id = auth.uid()`) to avoid RLS recursion.** A policy on `chat_room_members` that subqueries `chat_room_members` triggers Postgres "infinite recursion detected in policy". The full member roster is therefore read **server-side via the service role**, never by a member's own client.
- **Realtime SUBSCRIBED ≠ streaming.** The channel reports SUBSCRIBED a beat before `postgres_changes` actually streams; a message sent into that gap is silently missed. The UI MUST load history via a fetch and treat realtime as post-connection updates (proven 2026-06-19).
- **REPLICA IDENTITY FULL set BEFORE the publication add** (single migration, correct statement order) — the games realtime lesson (migs 130/132). `chat_messages` is the platform's **first RLS-enabled realtime table** (`games` runs RLS-off).
- **Grants are COLUMN-scoped least-privilege — RLS is deliberately NOT the only write guard.** An RLS `WITH CHECK` sees only the NEW row, so a row-level "update your own membership" policy can't stop a member from ALSO flipping `status`/`member_role`; column grants reject that at the privilege layer first. `authenticated` gets: SELECT on `chat_rooms`; SELECT + **UPDATE(`last_read_at`)** on `chat_room_members` (NOT status/member_role → no self-promote-to-moderator, no ban/mute evasion); SELECT + **INSERT(`room_id`,`sender_user_id`,`body`,`metadata`)** + **UPDATE(`deleted_at`,`deleted_by_user_id`)** on `chat_messages` (NOT body/sender/room_id → no rewriting/reattributing history; NOT sent_at → no backdating). Rooms + membership rows are created/mutated by the service role. **No grants to `anon`.** (Hardened after the /review found the blanket-UPDATE escalation hole; re-validated 12/12.)
- **Dev/prod:** migration 141 is **DEV-ONLY** as of 2026-06-19 — apply to prod + `npm run refresh:snapshots` at release, before promoting any reading code (`check:migrations` shows dev-ahead drift until then).

---

## `chat_rooms`
<!-- dict:table:chat_rooms -->

**Purpose:** one row per conversation. `surface` types it; `ref_id`/`ref_sub_id` point at what it belongs to (a tournament + optional division, etc.). Created/managed by the service role.

**Fields** (boilerplate `id`, `created_at` omitted):

<!-- dict:col:chat_rooms.org_id -->
**`org_id`** (FK → organizations.id, NN, CASCADE) — owning org. NOT the access key (membership is); used for scoping/listing. Project 3 (cross-org) will relax this.

<!-- dict:col:chat_rooms.surface -->
**`surface`** (text, NN; CHECK `tournament|coach_peer|coach_parent`) — which product surface owns the room; selects the participant-resolver. (`direct_message` for cross-org is a future Project-3 value.)

<!-- dict:col:chat_rooms.ref_id -->
**`ref_id`** (uuid, NN) — the subject the room is about (tournamentId for `tournament`, orgId for `coach_peer`, …). App-layer reference, no DB FK (varies by surface). **UNIQUE per conversation identity (mig 149):** partial unique indexes enforce ONE room per `(surface, ref_id)` when `ref_sub_id IS NULL` and per `(surface, ref_id, ref_sub_id)` otherwise — added after a creation race produced duplicate rooms (a coach saw the same tournament chat twice); `ensureTournamentChatRoom` catches the unique-violation and re-fetches the winner.

<!-- dict:col:chat_rooms.ref_sub_id -->
**`ref_sub_id`** (uuid, nullable) — sub-room identity. For `tournament`: **NULL = the default "All coaches" room** (one per tournament, zero-config, undeletable); a **fresh opaque uuid = an organizer-created division room** whose covered divisions ride `settings.divisionIds`. The mig-149 partial-unique guard keys on `(surface, ref_id, ref_sub_id)`, and each division room gets a fresh uuid, so no two rooms collide (even with identical division sets/names).

<!-- dict:col:chat_rooms.name -->
**`name`** (text, NN) — display name.

<!-- dict:col:chat_rooms.created_by_user_id -->
**`created_by_user_id`** (FK → auth.users.id, nullable, SET NULL) — room creator.

<!-- dict:col:chat_rooms.is_archived -->
**`is_archived`** (bool, NN, default false) — archived rooms are read-only (the INSERT policy requires `is_archived = false`). A tournament room **stays readable** after archive (owner decision 2026-06-19).

<!-- dict:col:chat_rooms.settings -->
**`settings`** (jsonb, NN, default `{}`) — per-room config. For a tournament **division room** it holds **`divisionIds: string[]`** — the divisions the room covers; membership AUTO-MAINTAINS as `resolveTournamentChatParticipants(tournamentId, divisionIds)` re-derives the coaches in those divisions (`roomDivisionIds()` in `lib/chat-service.ts` is the single source of truth; the All-coaches room leaves this empty). Other flags (`coach_post_enabled`, `is_read_only`, `max_retention_days`) remain reserved for later surfaces.

## `chat_room_members`
<!-- dict:table:chat_room_members -->

**Purpose:** who is in a room, their role, and **each person's read watermark** (`last_read_at`). The membership row IS the access key for the whole engine.

**Gotchas (read first):**
1. **SELECT policy = own-rows-only** (`user_id = auth.uid()`) to avoid RLS recursion; the roster is read server-side via the service role.
2. **`last_read_at` is the seen-receipt** — "last seen" per person, not a per-message read tick.

**Fields** (boilerplate `id` omitted):

<!-- dict:col:chat_room_members.room_id -->
**`room_id`** (FK → chat_rooms.id, NN, CASCADE) — the room. UNIQUE with `user_id` (one membership per person per room).

<!-- dict:col:chat_room_members.user_id -->
**`user_id`** (FK → auth.users.id, NN, CASCADE) — the member.

<!-- dict:col:chat_room_members.member_role -->
**`member_role`** (text, NN, default `member`; CHECK `member|moderator`) — moderators may soft-delete messages.

<!-- dict:col:chat_room_members.status -->
**`status`** (text, NN, default `active`; CHECK `active|pending|muted|removed`) — only `active` grants access. `pending` = a coach who hasn't finished signup ("not yet joined"), auto-activated later.

<!-- dict:col:chat_room_members.muted_until -->
**`muted_until`** (timestamptz, nullable) — admin mute expiry (≤72h at the surface).

<!-- dict:col:chat_room_members.joined_at -->
**`joined_at`** (timestamptz, NN, default now()) — when added.

<!-- dict:col:chat_room_members.last_read_at -->
**`last_read_at`** (timestamptz, nullable) — the read watermark; unread count = messages with `sent_at > last_read_at`. Updated by the member's **own** client (the only authenticated UPDATE they may do).

## `chat_messages`
<!-- dict:table:chat_messages -->

**Purpose:** append-only message log (soft-delete). The realtime-published table — active members receive INSERTs live.

**Gotchas (read first):**
1. **In the `supabase_realtime` publication with REPLICA IDENTITY FULL** — the platform's first RLS-enabled realtime table.
2. **INSERT policy pins `sender_user_id = auth.uid()`** and requires an active membership in a non-archived room — you can only post as yourself, into a room you're in.

**Fields** (boilerplate `id` omitted):

<!-- dict:col:chat_messages.room_id -->
**`room_id`** (FK → chat_rooms.id, NN, CASCADE) — the room; the realtime filter key.

<!-- dict:col:chat_messages.sender_user_id -->
**`sender_user_id`** (FK → auth.users.id, nullable, SET NULL) — author; the INSERT policy forces it to `auth.uid()`.

<!-- dict:col:chat_messages.body -->
**`body`** (text, NN) — message text.

<!-- dict:col:chat_messages.deleted_at -->
**`deleted_at`** (timestamptz, nullable) — soft-delete marker; set by a moderator UPDATE.

<!-- dict:col:chat_messages.deleted_by_user_id -->
**`deleted_by_user_id`** (FK → auth.users.id, nullable, SET NULL) — the moderator who removed it.

<!-- dict:col:chat_messages.metadata -->
**`metadata`** (jsonb, NN, default `{}`) — surface-phase payload (Phase 3B): `replyTo` (a server-rebuilt quote `{id,name,snippet}`) and `mentions` (`[{userId,name}]`). The browser INSERT grant covers it, but reply/mention payloads are written server-side from real rows (anti-spoof).

<!-- dict:col:chat_messages.sent_at -->
**`sent_at`** (timestamptz, NN, default now()) — order key; index `(room_id, sent_at DESC)` for pagination.

<!-- dict:col:chat_messages.pinned_at -->
**`pinned_at`** (timestamptz, nullable; mig 146) — set when a moderator pins the message (NULL = not pinned); partial index `(room_id, pinned_at DESC) WHERE pinned_at IS NOT NULL` backs the pinned-banner query. Written service-role only (NOT in the `authenticated` column grant); a pin/unpin is a `chat_messages` UPDATE so it propagates live on the realtime publication.

<!-- dict:col:chat_messages.pinned_by_user_id -->
**`pinned_by_user_id`** (FK → auth.users.id, nullable, SET NULL; mig 146) — the moderator who pinned it; cleared on unpin.

## `chat_message_reactions`
<!-- dict:table:chat_message_reactions -->

**Purpose** (mig 147, Phase 3C): emoji reactions on a message — one row per `(message, user, emoji)` from a FIXED seven-emoji set (👍 👎 ❤️ ✅ 😂 🎉 🙏). The chat program's **second** realtime-published table.

**Gotchas (read first):**
1. **Realtime-published (REPLICA IDENTITY FULL) — the SECOND such table.** Re-proven on dev by `scripts/validate-chat-slice.mjs` (now 23 checks): live add to active members, silence + zero rows to non-members/removed, write-lock, live un-react.
2. **SOFT-DELETE, never hard DELETE.** Un-react sets `removed_at`; the row is never deleted. **Why:** Supabase `postgres_changes` does NOT enforce RLS on hard-DELETE events (PK-only old row → membership subquery can't evaluate → delivery fails OPEN → a non-member who knows the room id receives the DELETE). Keeping every reaction event an INSERT/UPDATE (full new row) makes the room_id filter + RLS evaluate correctly. This is the same reason the engine soft-deletes `chat_messages`. **Active reaction = `removed_at IS NULL`.**
3. **Write-locked to `authenticated` — SELECT only (no INSERT/UPDATE/DELETE grant).** Every add/un-react/revive is the **service role** via the server route (membership + mute + rate-limit). Tighter than `chat_messages` (which grants a column-scoped INSERT): reactions have no direct-client write path, so there is no spoof/escalate surface to column-scope.
4. **`room_id` is DENORMALIZED** onto each reaction (copied from the message) so the RLS SELECT policy / realtime authorization gates on membership directly — no join back through `chat_messages`, exactly like `chat_messages` itself.
5. **Re-react REVIVES the row** (UPDATE `removed_at = NULL`) rather than inserting a duplicate, so `UNIQUE(message_id, user_id, emoji)` holds across toggles.

**Fields** (boilerplate `id`, `created_at` omitted):

<!-- dict:col:chat_message_reactions.room_id -->
**`room_id`** (FK → chat_rooms.id, NN, CASCADE) — the room; denormalized from the message so RLS + realtime gate on membership directly. The realtime filter key.

<!-- dict:col:chat_message_reactions.message_id -->
**`message_id`** (FK → chat_messages.id, NN, CASCADE) — the reacted-to message. Indexed for the per-message reaction-summary query.

<!-- dict:col:chat_message_reactions.user_id -->
**`user_id`** (FK → auth.users.id, NN, CASCADE) — the reactor. Set server-side to the caller (no client write path → cannot be spoofed).

<!-- dict:col:chat_message_reactions.emoji -->
**`emoji`** (text, NN; CHECK `👍|👎|❤️|✅|😂|🎉|🙏`) — the reaction glyph; the CHECK is the DB backstop to the fixed set (canonical list in `lib/chat-reactions.ts`).

<!-- dict:col:chat_message_reactions.removed_at -->
**`removed_at`** (timestamptz, nullable; mig 147) — soft-delete marker. NULL = active reaction; set on un-react (an UPDATE, never a hard DELETE — see gotcha 2). UNIQUE on `(message_id, user_id, emoji)` means re-reacting revives this row (sets it back to NULL).

## `chat_poll_votes`
<!-- dict:table:chat_poll_votes -->

**Purpose** (mig 148, Phase 3C): votes on an in-chat poll — one row per `(poll-message, option, voter)`. The chat program's **third** realtime-published table. **A poll is a chat MESSAGE** whose `metadata` carries the question's options + settings (multiple-choice / anonymous / closed_at); creating + closing a poll ride the existing `chat_messages` realtime, so the **only** new live store is the votes here (the live tally).

**Gotchas (read first):**
1. **Realtime-published (REPLICA IDENTITY FULL).** Re-proven on dev by `scripts/validate-chat-slice.mjs`: live vote to active members, silence + zero rows to non-members/removed, write-lock, live revote.
2. **SOFT-DELETE, never hard DELETE** (the same reason as `chat_message_reactions` — Supabase does not RLS-gate hard-DELETE realtime events). Revote / un-vote sets `removed_at`; re-casting revives the row. **Active vote = `removed_at IS NULL`.**
3. **Write-locked to `authenticated` — SELECT only.** Every cast/change/retract is the **service role** via the server route (membership + mute + poll-open + single-vs-multi enforced in code).
4. **`room_id` is DENORMALIZED** (from the poll message) so RLS / realtime gate on membership directly.
5. **No FK from `option_id` to an options table** — options live in the poll message's `metadata`; the server validates `option_id` against them at vote time. **Single-choice is server-enforced** (retract the voter's other option-votes); multiple-choice allows several. `UNIQUE(message_id, option_id, user_id)` prevents duplicate votes and supports both models.

**Fields** (boilerplate `id`, `created_at` omitted):

<!-- dict:col:chat_poll_votes.room_id -->
**`room_id`** (FK → chat_rooms.id, NN, CASCADE) — the room; denormalized from the poll message so RLS + realtime gate on membership directly. The realtime filter key.

<!-- dict:col:chat_poll_votes.message_id -->
**`message_id`** (FK → chat_messages.id, NN, CASCADE) — the **poll** message (a poll IS a message; its `metadata.poll` holds the options). Indexed for the per-poll tally query.

<!-- dict:col:chat_poll_votes.option_id -->
**`option_id`** (uuid, NN) — the chosen option; references an option id in the poll message's `metadata` (server-validated, no FK).

<!-- dict:col:chat_poll_votes.user_id -->
**`user_id`** (FK → auth.users.id, NN, CASCADE) — the voter. Set server-side to the caller (no client write path → cannot be spoofed). Enforces one-vote-per-user, allows vote-changing, and backs the visible "who voted" view (owner decision 2026-06-23: voters are visible, not anonymous).

<!-- dict:col:chat_poll_votes.removed_at -->
**`removed_at`** (timestamptz, nullable; mig 148) — soft-delete marker. NULL = active vote; set on revote/retract (an UPDATE, never a hard DELETE). UNIQUE on `(message_id, option_id, user_id)` means re-casting revives this row.

---

*End of Chat (migrations 141 + 146 + 147 + 148, DEV-only / ⚠ prod-pending; 5 tables). Membership-based RLS (org-agnostic by design for future cross-org), own-rows-only member visibility to dodge RLS recursion, `chat_messages` + `chat_message_reactions` + `chat_poll_votes` realtime-published (REPLICA IDENTITY FULL) — soft-delete + pin/unpin + reactions + poll votes ride it; **hard DELETE is avoided platform-wide on these tables because Supabase `postgres_changes` does not RLS-gate DELETE events**. Proving slice validated via `scripts/validate-chat-slice.mjs` (34 checks). Cross-references — not redocuments — `organizations`, `auth.users`, and the Notifications & Push domain (the bell/push path).*
