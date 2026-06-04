# Platform Admin — Employee UX Evaluation

**Status:** Evaluation complete (2026-06-04). Findings + prioritised list below; no code changes made. This is a review/triage document — the user decides what to action. See the companion [PM brief](PLATFORM_ADMIN_UX_EVAL_PM_BRIEF.md).

## Context

The platform admin at [app/platform-admin/](../../../app/platform-admin/) is the internal tool FieldLogicHQ employees use to support and manage customer accounts (four roles: super admin, billing, support, product). It has grown quickly — recent commits added bulk operations, a retention queue, cancel-subscription, org delete, ownership transfer, change requests, and plans & pricing. This evaluation looks at the tool **from an employee perspective** and catalogues every place that is confusing, inconsistently labelled, hard to discover, or undocumented, so a new employee can work without consulting docs.

**Scope reviewed (read in full or in depth):** nav [PlatformAdminNav.tsx](../../../app/platform-admin/PlatformAdminNav.tsx); dashboard [page.tsx](../../../app/platform-admin/page.tsx); org list [orgs/page.tsx](../../../app/platform-admin/orgs/page.tsx) + [OrgsClient.tsx](../../../app/platform-admin/orgs/OrgsClient.tsx); org detail [orgs/[id]/page.tsx](../../../app/platform-admin/orgs/[id]/page.tsx) + [OrgDetailClient.tsx](../../../app/platform-admin/orgs/[id]/OrgDetailClient.tsx); [customer-users/CustomerUsersClient.tsx](../../../app/platform-admin/customer-users/CustomerUsersClient.tsx); bulk-operations, retention, audit, plans-pricing clients; the SOP guide [lib/help-content/platform-admin.tsx](../../../lib/help-content/platform-admin.tsx); and all routes under [app/api/platform-admin/](../../../app/api/platform-admin/).

---

## 1. Executive summary

The platform admin is **functionally complete and unusually well-guarded** — every consequential action requires a reason, most have confirm modals, and the SOP guide is genuinely detailed. The core information architecture (Customer Users for people, Organizations for accounts, a 5-tab org workflow) is sound. The problems are not missing capability; they are **discoverability, naming drift, and silent role-gating**.

The three biggest UX gaps: (1) the **"owner left the company" → transfer ownership** flow is buried as a "Make Owner" button in the *People & Tournaments* tab, has **no SOP**, and the existing delete-user SOP actively gives *outdated* guidance that ignores it; (2) **role-gated controls disappear silently** — a support-only or billing-only employee sees no message explaining why a section is absent, so "I'm not allowed" is indistinguishable from "this feature doesn't exist" or "this is a bug"; (3) **one concept, several names** — "module access" is called Entitlements / Module Overrides / Module Add-On / Add-ons across four surfaces, and "ownership transfer" means two unrelated things in two different tabs.

A distinct, **larger product gap** surfaced during the code trace: the comp/override system **records intent but does not enforce expiry or auto-revert.** "Comp this account free until a date" and "let a Tournament Plus customer try League for a period, then auto-revert to Tournament Plus" are **not actually supported today** — see the deep dive in §7. This is feature work, not a copy fix, and is the highest-value structural item alongside role-aware nav.

Highest-priority, lowest-cost wins are copy/label fixes: document the five undocumented Customer-Users actions, fix the stale delete-user ownership guidance, rename "Team Ownership Transfers," and unify the module/account vocabulary. The higher-value structural work is a **role-aware nav with consistent permission messaging** and a couple of cross-links (org → Customer Users; dashboard dead-number alerts → filtered lists).

---

## 2. Per-scenario findings

Step counts are clicks from the nav. Ratings: **Easy** / **Needs improvement** / **Broken-or-missing**.

| # | Scenario | Path (steps) | Rating | Key friction |
|---|----------|-------------|--------|--------------|
| 1 | Owner can't log in → **password reset** | Customer Users → search → **Actions** ▾ → Reset Password → link appears in cell → Copy (~5) | **Easy** | "Reset Password" is hidden inside a generic **Actions** dropdown next to destructive Ban/Delete; no inline affordance. Help says "click **Reset**" — actual label is "Reset Password." |
| 2 | Customer calls to **cancel subscription** | Organizations → search → View → (opens on **Support** tab) → switch to **Billing & Access** → scroll past Plan + Overrides → **Cancel Subscription** (bottom) → modal → reason → confirm (~7) | **Needs improvement** | Buried as the 3rd/bottom section of the tab; default tab is Support not Billing; section is **silently hidden** unless a Stripe sub ID is on file and status≠canceled. A naive employee may check Customer Users (person) first. (Help FAQ does cover the hidden case.) |
| 3 | Account past_due → **temporary billing override** | Organizations → View → Billing & Access → Active Overrides → **+ Add Override** → Subscription Status / value / expiry / reason → Apply (~6) | **Easy** | Clear once on the tab. Dashboard "Past due orgs" alert drills straight to the filtered org list (good). |
| 4 | GDPR → **delete user + delete org + Stripe customer** | Cancel sub (Billing & Access) → **Delete Organization** (Support tab, super-admin, load preflight, type slug, reason, ✓ delete Stripe customer) → **Delete User** (Customer Users, type email) | **Needs improvement** | Correct, well-guarded flow but **spread across 3 locations in a required order**. Delete Org lives in *Support* (conceptually a lifecycle action). Preflight correctly blocks until the sub is canceled. Stripe-customer erasure is a checkbox in the delete-org flow (good). If not super-admin the section is silently absent (help says escalate). |
| 5 | Founding comp → **Tournament Plus free (comp period)** | Organizations → View → Billing & Access → Add Override → **Comp Period** → expiry → reason → Apply (~6) | **Broken-or-missing** | The comp-period override has **only expiry + reason — no plan/value field**, and is **not read by the entitlement layer** (only founding-season logic consumes `org_overrides`). It never auto-reverts. To actually grant a tier free an employee must use **Plan change**, with the comp override as a manual reminder only — see §7. |
| 6 | Why did an account change status → **audit investigation** | Org detail → **Activity** tab (last 8) OR **Audit Log** link (pre-filtered by org) → expand old/new JSON (~3) | **Easy** | Good org→audit cross-links. But the **Activity tab shows raw action codes** (`update_org_plan_and_limit`) while the global Audit Log shows friendly labels ("Update Plan And Limit"). Org filter uses the org **name** (`q=`) not orgId — fragile on rename/collision. |
| 7 | Sales-approved **free House League trial** → module override | Organizations → View → **Entitlements** tab → Module Overrides → toggle House League → **Save Overrides** → note (~5) | **Needs improvement** | The tab is named **"Entitlements"** (jargon); an employee thinking "give them House League" must know that = Entitlements. Module add-ons carry **no expiry** and **never auto-revert**, so the follow-up note is the only control — a time-boxed "try it for 30 days then revert to the paid base" trial is **not supported** (see §7). |
| 8 | Owner left the company → **transfer org ownership** | Organizations → View → **People & Tournaments** tab → Members table → find row → **Make Owner** (only if role≠owner & active) → modal → reason → Confirm Transfer (~6) | **Broken-or-missing (discoverability)** | The action is named "Make Owner," lives in *People & Tournaments*, and has **no SOP**. Worse, the **delete-user SOP is stale**: it tells employees to "transfer ownership by inviting another member as owner in the org admin, or update the org manually" — never mentioning this platform action. Also collides in name with the unrelated "Team Ownership Transfers" in the Support tab. |
| 9 | Accounts near **retention deadlines** → retention queue | Nav **Retention** → queue (records due ≤30d) → **+30 days** / **Process expiry** (~2) | **Easy** | Dedicated surface, dashboard "Retention records" alert drills in, manage_billing gated. Clear. |
| 10 | Add internal context about a difficult account → **internal notes** | Organizations → View → (opens on **Support** tab) → Internal Notes → textarea → **Add Note** (~4) | **Easy** | Notes are the default tab's first section — good. Note there are **two** note systems: org-level (Support tab) and user-level ("Support Notes" via Customer Users → Actions → Notes). For an account, org notes are correct. |

---

## 3. Navigation & information-architecture findings

**Top-level nav** ([PlatformAdminNav.tsx](../../../app/platform-admin/PlatformAdminNav.tsx)) — 5 groups, 14 items: Command Center (Overview) · Customers (Organizations, Customer Users, Retention) · Growth (Early Access, Email) · Billing & Product (Change Requests, Plans & Pricing, Bulk Operations) · System (Platform Users, Audit Log, Email Templates, Help). Grouping is logical and the order is reasonable.

- **The nav is NOT role-gated** — all 14 items render for every role; pages enforce permission server-side. A support-only employee sees Plans & Pricing, Bulk Operations, Change Requests, Platform Users, clicks in, and hits server-enforced gating with **no nav-level signal**. Recommend a role-aware nav (hide, or show visibly-disabled with a tooltip "Requires product access").
- **"Customer Users" uses a magnifying-glass (Search) icon** — implies "search," not "people." A Users/person icon would read better.
- **"Help" is last in System and opens in a new window** — there is no contextual help entry point from within a workflow (see §5).

**Org-detail 5 tabs** ([OrgDetailClient.tsx](../../../app/platform-admin/orgs/[id]/OrgDetailClient.tsx)): Support / Billing & Access / Entitlements / People & Tournaments / Activity.

- **Default tab = Support** (good for notes/identity, the most common touch) — but every billing/cancel/plan call requires a tab switch.
- **"Delete Organization" sits in Support** but is an account-lifecycle action. It belongs next to **Cancel Subscription** in Billing & Access (the cancel → delete sequence is one lifecycle), or in a dedicated "Danger Zone." Co-locating would also match the help, which walks cancel→delete as one flow.
- **"Make Owner" (org ownership transfer) is buried in People & Tournaments** with no signposting — see scenario 8. Surface it where an employee handling an account-lifecycle call would look (Support or a header action), and align the naming.
- **"Entitlements"** → consider "Modules" / "Module Access" (plainer; matches how employees talk).
- The header **"Primary Actions"** strip (Email owner / Open Stripe / Audit Log) is good orientation and should be the model for other surfaces.

---

## 4. Labelling inconsistencies

- **Account vs Organization vs Org.** Nav says "Organizations"; the list page says "Total Accounts," "Find Accounts," "Account Directory"; the detail header says "Organization Account." Pick one customer-facing noun and use it everywhere.
- **The "module access" concept has four names:** "Entitlements" (tab) / "Module Overrides" (section) / "Module Add-On Enablement" (Bulk Operations) / "Add-ons" (API + audit label "Update Add-ons"). Unify.
- **"Ownership transfer" collision.** "Make Owner" + "Transfer Ownership" modal = org-owner change (People & Tournaments). "Team Ownership Transfers" section (Support) = Coaches Portal Premium hand-off. Two unrelated operations, similar names. Compounding it: the **UI section is titled "Team Ownership Transfers" but the help SOP calls it "Coaches Portal Ownership Transfers."**
- **Activity tab vs Audit Log.** Org Activity renders raw action codes; the global Audit Log maps them through friendly `ACTION_LABELS`. Same data, two vocabularies.
- **"Platform Users"** (nav/help) is backed by `company-users` API routes + `CompanyUsersClient` — internal naming diverges from the UI label.
- **Help vs UI label drift.** Help says "click **Reset**" (UI: "Reset Password"); help says "**Expand their row** and review the Organization Memberships section" (memberships are an always-visible **column**, nothing to expand).
- **Date formats vary:** relative ("3d ago") in user notes, absolute short ("Jun 4, 2026") in org detail, long ("Mon, Jan 01, 2025 12:34:56") in the audit log.
- Minor: plan-change CTA is **"Review Change"** (opens a confirm modal) while every other mutation says "Save"/"Apply."

---

## 5. Missing cross-links & shortcuts

- **Org Members → Customer Users record.** From the People & Tournaments members table you cannot jump to a member's Customer Users record. So when you're on an org helping with an "owner can't log in" call, you **cannot reset their password from there** — you must go back to the nav, open Customer Users, and search. Add a per-member link (deep-link by user/email). *(Saves 2–3 clicks on the single most common support call.)*
- **Dashboard "dead-number" alerts.** "Past due orgs," "New leads," "Retention records," "Price approvals" link to filtered destinations; but **"Trials ending soon," "Expired overrides," "Missing owners," "Owner inactive" are unclickable numbers**. An employee sees "3 expired overrides" with no way to see which orgs. Add filtered org-list links.
- **Org Activity rows aren't expandable.** The global Audit Log offers expandable old/new JSON; the org Activity tab only shows a truncated new-value and a single "Audit Log" link. Let rows expand, or link each row to its audit entry.
- **No contextual help.** The Billing & Access tab already uses `HelpTooltip` on its sections (good). Extend that pattern: deep-link each org-detail tab / workflow to its matching SOP section so employees don't have to leave for the new-window Help Center.

(Confirmed already-good cross-links: Customer Users → org detail; org → Stripe; org → Audit Log; delete-user modal → each owned org.)

---

## 6. Help content gaps

**Operations in the UI with NO SOP:**
- Customer Users: **Ban / Unban, Revoke Sessions, Confirm Email, Edit Info (change email/display name), user-level Support Notes** — none are documented. Only password reset and delete-user are covered.
- Org detail: **Transfer Ownership / "Make Owner"** (org-owner change) — no SOP at all (scenario 8).
- **Change Requests** approval workflow — nav item + dashboard "Price approvals" alert point at it, but no SOP.
- Growth surfaces (Early Access, Email) — not covered (may be intentionally out of scope).

**Stale / inaccurate SOP content:**
- The **delete-user SOP** ([lib/help-content/platform-admin.tsx](../../../lib/help-content/platform-admin.tsx), `delete-user` section) tells employees to resolve sole-owner orgs by "inviting another member as owner in the org admin, or update the org manually" — this predates the platform **Make Owner** action and should point to it.
- **"Where to work first"** orientation omits Retention, Change Requests, Early Access, Email, Email Templates, and Platform Users.
- Naming drift: help "Coaches Portal Ownership Transfers" vs UI "Team Ownership Transfers"; help "click Reset" vs UI "Reset Password"; help "expand their row" vs an inline column.

---

## 7. Deep dive: time-boxed comping & trials (the "comp X for a period" need)

Two real workflows the platform must support:
- **A. Extended free trial / comp** — give an owner free access (e.g., an extended trial) until a set date, then resume normal billing.
- **B. Add-on / tier trial on top of a paid base** — a Tournament Plus customer wants to try League. During the trial they **keep paying for Tournament Plus**; at expiry, if they haven't started paying for League, access **auto-reverts to Tournament Plus only**.

**Current enforcement reality (traced in code):**
- The request-time entitlement/auth loaders read the org row **directly**: `subscriptionStatus` from `organizations.subscription_status` ([lib/api-auth.ts:103](../../../lib/api-auth.ts), [lib/server-organizations.ts:41](../../../lib/server-organizations.ts), [lib/user-contexts.ts:171](../../../lib/user-contexts.ts), [lib/db.ts:2413](../../../lib/db.ts)); module access from `organizations.enabled_addons` via [hasModuleEntitlement()](../../../lib/module-entitlements.ts) (plan caps **or** enabled add-ons; `canceled` = no access).
- **`org_overrides` is not consulted by that entitlement layer.** Its only active consumers are **founding-season** logic ([signup](../../../app/api/auth/signup/route.ts), [create-checkout `ensureFoundingSeasonCompPeriod`](../../../app/api/billing/create-checkout/route.ts), [founding-season-status banner](../../../app/api/admin/org/founding-season-status/route.ts)), dashboard metrics, and the override CRUD/bulk UIs. So a hand-created **"Subscription Status" override is effectively a record, not an enforced grant** — to actually change access an employee must use the **Plan change** flow, which writes the org row.
- **`comp_period` overrides carry expiry + reason but no plan/tier/amount** ([migration 019](../../../supabase/migrations/019_org_overrides.sql)) — nothing generic interprets "comp Tournament Plus until March" or "comp League for 30 days."
- **Module add-ons have no expiry column and no auto-revert** — `enabled_addons` grants access until manually removed (help confirms: *"Module overrides do not currently carry their own expiry"*).
- **Nothing auto-reverts at expiry.** Expiry is surfaced only as a manual **"Expired overrides — revoke or extend"** dashboard alert + org-detail attention item ([orgs/[id]/page.tsx:329](../../../app/platform-admin/orgs/[id]/page.tsx)). No scheduled job flips access back.

**Consequence for the two scenarios:**
- **A (extended trial)** can only be *approximated* — set status/plan active + a comp_period as a reminder — but it will **not auto-revert**; an employee must manually flip it back, prompted only by the dashboard alert. Outside founding season the comp_period drives no billing behaviour.
- **B (add-on trial with auto-revert)** is **structurally unsupported.** There is no concept of "grant module/tier X *on top of* the paid base for N days, then auto-revert to base." Add-ons never expire; nothing downgrades automatically.

**Shape of the fix (feature work — see H8):**
1. A **timed entitlement grant** model: give grants (add-on / tier / status / comp) an `expires_at` and make the entitlement layer **honour it** — an expired grant simply stops applying, so revert is automatic, not manual.
2. Make `comp_period` express **what** it comps (target plan/tier or module + whether billing is suppressed) and have the billing + entitlement layers actually read it — generalising the founding-season special case into a real comp engine.
3. Distinguish **"trial on top of a paid base"** (keep billing the base subscription, layer a time-boxed grant, auto-revert only the grant) from a full plan change.
4. A **reconciliation step** (scheduled or evaluated at request time) that downgrades expired grants to the paid base and writes an audit entry — replacing the manual "revoke or extend" alert.
5. Platform-admin UI to create such a grant (target, duration, billing treatment, auto-revert target) and show it **counting down** on the org's Billing & Access tab.

---

## 8. Prioritised improvement list

Tags: **[copy]** trivial copy/label · **[reorg]** UI reorganisation · **[feature]** new API/feature work.

### High impact
| # | Fix | Tag |
|---|-----|-----|
| H1 | Add an SOP for org **Transfer Ownership / Make Owner** and **fix the stale delete-user ownership guidance** to point at it. Covers the undocumented "owner left the company" scenario. | [copy] |
| H2 | Make org ownership transfer **discoverable** — surface "Make Owner" beyond the People table (header action or a Support "Account lifecycle" entry) and align the naming. | [reorg] |
| H3 | Add SOPs for the **undocumented Customer-Users actions** (ban/unban, revoke sessions, confirm email, edit info, user notes). | [copy] |
| H4 | **Role-aware nav + consistent "you don't have permission" messaging** wherever a control is hidden today (Identity, Delete Org, Notes textarea, Add Override, Cancel Subscription). Removes the "missing feature vs not allowed vs bug" ambiguity. | [reorg] |
| H5 | **Cross-link org Members → Customer Users** so password reset / user management is reachable from the org you're already on. | [reorg] |
| H6 | Rename **"Team Ownership Transfers" → "Coaches Portal Ownership Transfers"** (match help; disambiguate from org-owner transfer). | [copy] |
| H7 | Make the **dead dashboard alerts** (Trials ending soon, Expired overrides, Missing owners, Owner inactive) drill through to filtered org lists. | [reorg] |
| H8 | **Time-boxed, auto-reverting comps & trials** (see §7). The comp/override system records intent but does not enforce expiry or auto-revert; add-ons have no expiry at all. Build a timed-entitlement grant model so "free until a date" and "try League on top of Tournament Plus, then auto-revert" actually work. Stated requirement. | [feature] |

### Medium impact
| # | Fix | Tag |
|---|-----|-----|
| M1 | Move **Delete Organization** out of Support → co-locate with Cancel Subscription in Billing & Access (or a "Danger Zone"); update help references. | [reorg] |
| M2 | Org **Activity tab: render friendly `ACTION_LABELS`** (extract the map shared with the Audit Log page) instead of raw action codes. | [reorg] |
| M3 | When **Cancel Subscription** is hidden (no Stripe sub / already canceled), show a disabled stub explaining why, instead of nothing. | [reorg] |
| M4 | **Unify the module vocabulary** to one term across the Entitlements tab, Module Overrides section, Bulk Operations, and audit labels. | [copy] |
| M5 | **Standardise the customer noun** (Organization vs Account) across nav, list, and detail. | [copy] |
| M6 | **Contextual help**: deep-link each org-detail tab/workflow to its SOP section (extend the existing `HelpTooltip` pattern). | [reorg] |
| M7 | *(Superseded by **H8** — see §7.)* Generalise comp/trial handling beyond the founding-season special case into a real timed-entitlement engine. | [feature] |
| M8 | **First-run orientation**: a lightweight "Start here / shift checklist" entry on the Overview dashboard linking to the SOPs and common tasks. | [reorg] |

### Low impact
| # | Fix | Tag |
|---|-----|-----|
| L1 | "Reset Password" — add an inline affordance, or at minimum align the help label. | [copy] |
| L2 | Filter org→audit links by **orgId** (not org name `q=`) to survive renames/collisions. | [reorg] |
| L3 | **Date-format consistency** (relative vs absolute) across surfaces. | [copy] |
| L4 | Swap the **"Customer Users" nav icon** (Search) for a person/users icon. | [copy] |
| L5 | Make org **Activity rows expandable** with old/new JSON like the global audit log. | [reorg] |
| L6 | Add an SOP for the **Change Requests** approval workflow. | [copy] |
| L7 | Refresh **"Where to work first"** to list every nav surface. | [copy] |
