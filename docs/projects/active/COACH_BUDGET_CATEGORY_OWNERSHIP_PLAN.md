# Budget Category Ownership — Shared vs. Local, and Who Can Rename Which

**Status: BUILT ON DEV 2026-09-04, uncommitted at time of writing — owner ruled Q1–Q5 all as
recommended, on the mockup, and the build followed them.** Migration 277 applied to dev 2026-09-04;
owner QA walk owed (no ledger § assigned yet).

**As built:** `budget_categories.team_id` (mig 277, no backfill per Q2) with the three tiers read
through **aliases of the item predicates** (`budgetCategoryTier` / `categoryVisibleToTeam` /
`categoryOfferedToClub` — assignment, not re-implementation, guarded by an identity assertion in
`tests/unit/budget-category-ownership-guard.test.ts`). Coach create writes the owning team and
checks money-write **on that team**; its uniqueness check moved to visible-only (the refusal trap
mig 277 creates by existing). Six read/write surfaces gained the filter — coach picker, budget
import, coach item-create gate, club item-create gate, and **both club budget-line write paths**,
which were storing a bare `categoryId` unvalidated (the same hole `/review` found for items on
2026-08-17, one level up: harmless while every category was org-wide, a real leak the moment one is
private). Two rename doors, no delete on either. Club panel on the Org Budget page reads every tier
(`usage=1`, opt-in, mirroring the coach route's own); its picker reads `?forPlanning=1`. Coach modal
gained a Categories section and the door became **Manage our words** (Q5), synced across three
panels and the help article + its search keywords.

**⚠ ONE DISCLOSED MOCKUP DEVIATION, and it is a ruling collision:** the mockup's category rows carry
a **"42 lines"** count. The 2026-09-04 §133 ruling removed the `N lines` caption from every surface
in the product, so building it as drawn would have re-introduced the exact caption the owner had
deleted hours earlier. The row instead carries the sentence **"Used by 6 teams and your club's own
budget"** — which passes that ruling's own test (a club cannot get this by opening anything; these
rows do not open) and sizes the one action on the row, the same ground the two counts that survived
§133 stand on.

**Verified:** migration applied to dev · typecheck clean · 2,950/2,951 unit tests (the one failure
is another session's `coach-budget-periods-view` fixture, confirmed unrelated) · spelling, CSS
purity and dead-selector gates clean · schema parity re-baselined (6 accepted, 3 of them this
migration's, prod-owed) · dictionary coverage OK · `check:demos` both worlds presentable · UAT
fixture now holds **both** failing states (this team's own heading AND another team's, so the filter
can actually fail) · all six visibility behaviours executed against the live dev schema, not read
off the code. Grew out of
§133's one open item (Q6, category rename) in `COACH_BUDGET_TAB_REVAMP_PLAN.md` §6.2. That plan is
already BUILT and PASSED (ledger §133, 2026-09-04) — this is a separate, follow-on piece of work,
not a re-opening of it.

**Mockup gate (owner-approved, whole-screen before/after on both surfaces, true size):**
https://claude.ai/code/artifact/ab93e2ad-2237-434f-bdb4-51e5cea74064
The build must match it; deviations go back to the owner first.

## 0. Owner rulings (2026-09-04, binding for this build)

| Q | Ruling |
|---|--------|
| Q1 | **Approved** — a team's own category renders as its OWN heading on club reports, exactly as a team's own item already does. No "team-specific" umbrella grouping. |
| Q2 | **Approved** — every category that exists today stays SHARED (`team_id` NULL) on migration. No retroactive attribution; nothing a team already plans against changes underneath them. |
| Q3 | **Approved** — a team's own category is renamable by the same people who can already rename that team's own items (team money-write), not head-coach-only. No new permission tier. |
| Q4 | **Approved** — the club's rename control is a new **Categories** panel on the Org Budget page, beside the teams'-items list already there. |
| Q5 | **Approved** — the coach's door widens from *Manage our items* to **"Manage our words"**, since it now opens on two lists. |

**Owner framing (2026-09-04, verbatim intent):** *"teams should not be able to create shared
categories, there are 2 types of categories: shared (created by the org to be used by org and
team) and local (ones coaches create that only they use but the org can read on their statements
and such). we don't need to have a complex mechanism where a coach can create and share amongst
other teams or the org. keep it simple."*

---

## 1. Why this exists (verified against code, 2026-09-04)

`budget_categories` today has **no team ownership column at all** — every category is a flat,
org-wide row (`org_id`, `name`, `scope`, `is_default`; no `team_id`). When a coach creates a new
category from the team budget screen, the route inserts it exactly like an org-admin-created one
(`org_id: ctx.org.id, scope: 'team', is_default: false` —
`app/api/coaches/[orgSlug]/budget-items/route.ts:178-182`), and its own comment states the
deliberate design intent at the time: *"CATEGORIES ARE STILL ORG-WIDE. A category is a heading,
not a name… clubs want them shared, and the report's top level would fragment if each team
invented its own"* (same file, lines 149-150). The practical effect: a category one coach typos
or wants renamed is visible to and used by every other team in the org, with no record of who
made it — which is exactly why Q6's rename couldn't be scoped safely (§6.2 of the revamp plan).

**This has an almost exact precedent already shipped for `budget_items`** (migration 240, owner
ruling 2026-08-15: *"we shouldn't populate 1 team's list with another team"*). Items already carry
a `team_id` column and a three-tier model —
platform (`org_id` null) / club (`org_id` set, `team_id` null) / team (`both` set) — read through
one shared predicate module, `lib/coach-budget-item-tiers.ts` (`budgetItemTier`,
`itemVisibleToTeam`, `itemOfferedToClub`). A club admin can **publish** a team's item org-wide
(one-directional; there is deliberately no unpublish). This plan proposes the **same shape** for
categories, not a new mechanism.

## 2. What "keep it simple" rules out

- No coach-to-coach sharing (a team's local category is never visible to another team).
- No coach-initiated "share this with the club" action — only an org admin can create/rename a
  **shared** category, mirroring today's `budget_categories` POST (`app/api/admin/accounting/
  budget-categories/route.ts`, already owner/treasurer-gated).
- No unpublish / no unshare — same one-directional rule items already use, for the same reason
  (a team already planning against a shared word cannot have it silently taken back private).
- No new "manage categories" workflow beyond a rename — delete stays absent for categories, exactly
  as ruled in the original revamp plan §6.2 ("Delete stays absent. Rename only").

## 3. Proposed model

| Tier | `org_id` | `team_id` | Who sees it | Who can rename it |
|---|---|---|---|---|
| Platform | NULL | NULL | Everyone | Nobody (immutable, matches items) |
| Shared (club) | set | NULL | Every team in the org + the org's own budget | Org admin only — **Owner or Treasurer**, matching the existing gate on `budget_categories`/`budget_items` writes today (owner ruled 2026-09-04: NOT the generic "Admin" role — no broadening of who writes here) |
| Local (team) | set | set | That team only, for planning/selection. **The org can still see it** on cross-team reports/statements (read, never edit) | That team's own coach (head or assistant with money-write) — safe because there is no cross-team blast radius, the same reasoning that already lets a coach rename their own team-owned budget **item** today |

- **Migration:** add `budget_categories.team_id uuid NULL REFERENCES rep_teams(id)`, mirroring
  `budget_items.team_id` (mig 240) exactly, including its CASCADE-not-SET-NULL choice — a deleted
  team's private category should not silently become the club's. Needs its own confirmation at
  build time against the live schema (dictionary + `information_schema`, never the migration file).
  Next free migration number at planning time: **277**.
- **New shared predicates**, mirrored from `lib/coach-budget-item-tiers.ts` into a category
  equivalent (or extended in place if the module can serve both types without duplicating logic —
  decide at build time; do not hand-roll a second copy of the same three rules):
  `categoryTier`, `categoryVisibleToTeam`, `categoryOfferedToClub`.
- **Coach POST** (`app/api/coaches/[orgSlug]/budget-items/route.ts` `newCategoryName` branch) starts
  writing `team_id: teamId` instead of leaving it org-wide. The route's own "CATEGORIES ARE STILL
  ORG-WIDE" comment (lines 149-150) is now wrong and must be corrected in the same change — the
  exact kind of stale, dated comment this repo's culture calls out as a defect if left behind.
- **Admin POST/PATCH** (`app/api/admin/accounting/budget-categories/route.ts`) is unchanged in
  spirit — an owner/treasurer-created category has `team_id` NULL, i.e. shared, by construction.
- **New route:** `PATCH /api/admin/accounting/budget-categories/[catId]/route.ts` (does not exist
  today — only the category's own GET/POST and the nested per-item PATCH do). Model its auth and
  error shape on the existing item PATCH (`budget-categories/[catId]/items/[itemId]/route.ts`):
  refuse platform defaults (`org_id` null) with a sentence, validate name 1–80 chars, `23505` →
  409 in a sentence. Gate: `ctx.role !== 'owner' && ctx.role !== 'treasurer'` → forbidden — the
  same check already used for every other write on this route family, not a new rule.
- **Coach-side rename:** a coach can PATCH a category **only when `team_id === their team`** —
  likely the existing `app/api/coaches/[orgSlug]/budget-items/route.ts` gains a category-rename
  branch (or a sibling route), gated the same way item rename already is
  (`denyUnlessTeamMoneyWrite`), refusing shared/platform categories with a sentence pointing the
  coach at who *can* rename it, the same courtesy the item-delete 409 already extends.
- **Every GET that lists categories** needs the visibility filter applied, exactly where item GETs
  already apply `itemVisibleToTeam`/`itemOfferedToClub` today: the coach budget-items GET (already
  filters items this way, but categories themselves currently pass through unfiltered — a coach
  today can see EVERY org category, including, after this change, other teams' local ones, unless
  this filter is added), and the admin `budget-categories` GET (needs to keep seeing everything,
  by design — "the org can read on their statements and such" — so `categoryOfferedToClub`'s org
  side reads shared + platform only for the org's own **budget-writing** picker, while a **read/
  reporting** surface reads everything, same split items already have between `itemOfferedToClub`
  and the admin's unrestricted view of all teams' items).

## 4. What does NOT change

- Existing categories already in the database keep `team_id` NULL (shared) on migration — there is
  no reliable way to attribute a category already created under today's flat model to one team,
  and defaulting existing ones to shared is the non-destructive choice (nothing that already works
  stops working; a team can create a new local one going forward if a specific existing category
  turns out to be theirs alone in practice).
- BvA's legacy free-text category-name matching risk on rename (`rep_team_expenses.category`
  string-matched, case-insensitive, against `budget_categories.name` —
  `docs/agents/db/DATA_DICTIONARY.md` line 3451) is **unchanged by this plan** and was already
  investigated and accepted as a narrow, FK-linked-rows-are-safe risk in the original revamp plan
  §6.2. Renaming a **local** category carries the identical narrow risk a **shared** rename always
  did — this plan does not make it better or worse.
- No change to `scope` (`org`/`team`/`both`) — that axis still controls *where a category is
  offered* (the org's own budget planner vs. a team's) and composes independently of the new
  ownership axis, the same way `direction` and `team_id` already compose independently on items.
- No delete. Rename only, on both tiers.

## 5. Open questions for owner sign-off before build

1. **Reporting rollup.** When the org's cross-team statements/reports show a local category, does
   it render as its own top-level line (accepting that two teams' local categories can share or
   differ in name, same as items already allow), or does it need some visual "Team-specific"
   grouping so the org's report doesn't read as fragmented — the exact concern the original
   "categories are org-wide" comment was written to avoid? **Recommendation: render local
   categories as their own line, exactly like a team's local items already do today** — no new
   grouping mechanism, consistent with "keep it simple."
2. **Existing "team-scope" categories.** Every category created by a coach up to this point is,
   under today's model, indistinguishable from an org-admin-created one — the migration leaves
   them all `team_id` NULL (shared) per §4. Confirm this is acceptable, i.e. no retroactive
   "un-sharing" of categories that were, in practice, only ever used by one team.
3. **Who else can rename a local category** — just the team's own head coach, or any coach with
   team money-write (matching how item rename is already gated)? Recommendation: match item rename
   exactly, no new permission tier.
4. **UI location for the shared-category rename control** (Owner/Treasurer). The two existing admin
   screens don't cleanly show it today — the Org Budget page's category headers only show
   categories with a dollar line THIS YEAR at the org level, and the full always-current category
   list is currently fetched only as background data for pickers, never rendered as its own list.
   Recommendation: a small "Manage Categories" section on the existing Org Budget settings page
   (`app/[orgSlug]/admin/accounting/budget/page.tsx`), listing every shared + platform category
   (platform marked fixed) with inline rename — same interaction pattern the page already uses for
   renaming a budget line's description.
5. **UI location for the local-category rename control** (coach). Recommendation: wherever a coach
   already renames their own team's budget **items** today (the item-manager modal's pencil/inline
   edit) — add categories to that same list rather than a new screen.

## 6. Out of scope (do not solve in passing)

- Q7 (platform item-library placement review) — stays its own session, unrelated axis.
- Any coach-initiated publish/share flow for categories — explicitly ruled out in §2.
- Category delete, for either tier.
