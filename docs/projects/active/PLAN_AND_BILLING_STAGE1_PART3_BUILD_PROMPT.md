# Plan & billing — Stage 1, Part 3: the admin host for every plan, the rail row, the old screen retired

**Prepared 2026-10-28.** Paste into a Codex chat on `dev`. Do not commit or push. This is **Part 3 of Stage 1 only**. It
is not Stage 2 (the Coaches Portal host), not Stage 3 (retiring the coach's admin view), and not Stage 5 (the help
rewrite).

## What Part 3 makes true

Open **Plan & billing** as a Tournament owner, a Tournament Plus owner, a League Plus owner, a standalone coach (in the
admin look, until Stage 2) and a Club owner: **every plan shows the same body** — the one Part 2 built — inside the admin
page. The old non-Club billing screen is gone. **Plan & billing** is a row in the admin's side rail **foot, beside Help**,
on every plan (owner only); on a phone it is in the More sheet's **You** group (owner only). Paying, then returning from
Stripe, lands the customer back on a working billing page on every plan. No price, plan or entitlement changes.

## 1. Entry gates — stop and report if any is unmet

1. **Part 2 and its fix pass are committed or the owner has confirmed them reviewed.** Read the Part 2 hand-off and the
   fix pass (`PLAN_AND_BILLING_STAGE1_PART2_FIXES_PROMPT.md`) in the plan §9 and its recorded results. Do not start on
   a body that still has the open gaps that prompt lists (failed-read handling, the dropped "Keep" sentences, the
   money-request test). If they are unmet, report which, and stop.
2. **Two decisions the owner owes before this part is called done** — check the plan §9 and the hand-off; if unanswered,
   **ask in your first message and build the rest**, do not guess: (a) *the usage route's suspended-owner access* —
   `app/api/billing/usage/route.ts` has `allowSuspendedOrg: true` and a guard exemption nothing on screen needs;
   (b) *owner-only versus delegable billing* — the new read routes gate on `role === 'owner'`; the money routes honour
   the `billing` capability. Do not change either on your own.
3. `npm run verify:changed` currently stops at lint errors in another session's untracked `app/dev/crash-test/page.tsx`
   and fails a few checks on other sessions' files; the admin-lettering baseline needs the owner's `--init`. Report the
   **current exact** state at the start and the end; never repair unrelated work or shared automation to turn it green.

## 2. Read first

`AGENTS.md`, `AGENCY_RULES.md`, `CLAUDE.md`, `PLAN_AND_BILLING_CODEX_RULES.md`, the plan (§9 rulings and every hand-off),
the PM brief, `PLAN_AND_BILLING_COPY.md`, `PLAN_AND_BILLING_STAGE1_IMPACT_INVENTORY.md` (the list of old-screen readers
you must repoint), `PLAN_AND_BILLING_STAGE1_BUILD_PROMPT.md` (its Part 3 section is the original outline), and the
owner's `PLAN_AND_BILLING_STAGE_A_DRAWINGS.html` (tab 6 is the rail; never edit the file). Read the nav standard and
the table/list standard from the memory/design references the shared rules name. Before any Next route/layout code,
read the relevant guide in `node_modules/next/dist/docs/`; request interception is `proxy.ts`, never a root
`middleware.ts`. All paths below are leads — re-verify each against the current tree.

Present the task list and the plain-language UX summary before significant edits (the repo requires it).

## 3. Build

**3a. One admin page for every plan.** `app/[orgSlug]/admin/org/billing/page.tsx` picks `BillingKit` (Club) or the old
`BillingPagePlans` (everything else, ~1,350 lines). Make the page render the shared body for **every** plan through the
thin host `BillingKit` already is, and delete the `isClubPlan ? … : …` switch. `…/admin/tournaments/settings/subscription`
keeps working as the same page. The host supplies the header, the billing base and the Rep-teams destination. Header
for all plans: the **eyebrow is removed on plans with no organization** (Tournament, Tournament Plus, the standalone
coach workspace); the title is the one words-file title. The page still redirects/guards exactly as today (owner locked
card for a non-owner, suspended-owner comeback access, the existing `?plan=` deep link).

**3b. The rail row.** *Plan & billing* — owner only — sits in the **rail foot, beside Help**, on Tournament, Tournament
Plus, League Plus and Club. On Club and League it **moves out of the Organization group** into the foot; on the
Tournament tiers it is a new foot row. Phone: the More sheet's **You** group, owner only (ruled P-c). The existing
"Settings & access" hub card on the tournament tiers **stays** (ruling 2). Leads: `components/admin/admin-nav-config.ts`,
`lib/admin-kit-nav.ts` (`kitOrgLinks`, already owner-only for Club), and the phone-bar groups file; update
`tests/unit/admin-kit-nav.test.ts` and `nav-standard-guard`. The standalone coach's admin view is retired in Stage 3,
not here: do not add a coach-portal nav row or a portal page.

**3c. The Stripe return fix.** `app/api/billing/portal/route.ts` returns to `/{slug}/admin/org/billing`, which bounces
tournament tiers to `/admin/tournaments`. Return to the plan-correct billing URL through the existing resolver
(`getBillingHref(slug, planId)` in `lib/billing-urls.ts`) for this stage; check the mock portal
(`app/[orgSlug]/admin/org/billing/mock-portal`) and the card-save and next-season returns the same way. Stage 2
replaces the resolver; do not retarget anything to a Coaches Portal URL. Test it.

**3d. Gaps the Part 2 review left for this part** (decide each from the drawings and the old screens, build, and list
what you chose):
- **Monthly / yearly for an upgrade.** The Change plan table prints both prices but the "Upgrade to …" button always
  buys the org's current cycle (monthly for a free org). The old non-Club screen had a cycle toggle. Add the
  smallest honest control using a shipped component (the cancelled screen's cycle select is the nearest) — or, if the
  Stage A drawing is silent and you cannot tell where it goes, say so and ask rather than invent a placement.
- **Free time and the buyable doors.** The old screen kept the upgrade card during free time when the *own* plan was
  free; the body hides every buyable control while `staffFree`. Decide from the ruling "staff free time removes
  payment / move / cancel" whether a free *own* plan should still offer its upgrade, report it, and do not widen past
  the ruling without the owner.
- **Founding "Change plan or card"** and the bfcache `justChose` reset, if the fix pass did not already close them.
- A `Tournaments you run` / `Tournament helpers` link and the plan-details link are undrawn (ruling P-a) and belong to
  Stage 3. Do not invent them.

**3e. Delete the old screen.** Delete `BillingPagePlans` and `billing.module.css` once nothing renders them. The
stale entries in `scripts/check-public-tokens.mjs` for deleted CSS are harmless (it skips missing files with
`existsSync`); **do not edit that script**. Generated baselines (css-selector, admin-type, admin-old-look) are
regenerated by their own `--init` flags only when the owner says so — report which ones changed.

**3f. Repoint everything that read the old file** (impact inventory lists them): `support-console-stage4b-coach-guard`,
`stripe-fees-owner-rulings`, `team-move-words`, `tournament-one-at-a-time`, `gated-plan-availability-copy`,
`admin-kit-nav`, `billing-urls`, `plan-panel-host`, the notification tests, `plan-billing-source-guard` (the frozen
legacy-literal hash and its stale-exception check disappear *with* the file — never edit a hash to grandfather new copy),
the UAT `plan-gating.spec` (its non-owner case expects a disabled button the Club page never rendered — change it to
the locked card) and `marketing-seam.spec`. The `export *` shims in `components/admin/kit/club/` and
`components/admin/FreeTimeBand.tsx` have named-import callers: move the legacy page's imports first, then decide whether
each shim still earns its place. **Never use `export *` in a `'use client'` file that a server component imports** (it
breaks the build; this already happened once) — named exports only.

**3g. Help text.** Update **only** the help strings this change makes untrue (`lib/help-content/org.tsx`:
club-plan-and-billing, subscription-ends, Stripe fees, cancel) and the search text beside them. The full rewrite is
Stage 5. Keep the one-spelling rule (`npm run check:spelling`).

## 4. Not in this part

The Coaches Portal host and its nav row, the link resolver, email / bell / Stripe return retargeting, the wall doors
(Stage 2); retiring the coach's admin view and the hosted-tournament links (Stage 3); the "Covered by {Club}" line
(Stage 4); help rewrite (Stage 5); merging the two plan-change server mechanisms; any price, plan, entitlement or
migration; an in-app invoice list; the public Club trial sentence (a separate `/marketing` step).
**Do not touch** `.claude/settings*.json`, hooks, check scripts, watched automation or production tooling.

## 5. Verify and hand off

Done when: every plan's admin page renders the same body; a Tournament, Tournament Plus, League Plus, standalone-coach
and Club owner can each reach it from the rail (and phone More) and return to it after Stripe; a non-owner gets the
locked card on every plan; the old screen and its CSS are gone; the repointed tests pass; `npm run typecheck` is green;
`npm run verify:changed` is green **or fails only on the named unrelated shared-tree items**, listed exactly. A unit
test proves a new plan needs only a registry entry (the fake-plan test already exists — keep it passing).

Run expensive checks serially (focused lint while working; `npm run typecheck`; the focused and then full unit suite;
`npm run verify:changed`). This part touches a coach-portal screen and shared nav chrome: if a dev server is already up,
run `npm run check:layout -- --changed` and report it; if not, say "check:layout skipped, no dev server" — never let a
skip read as a pass. The browser walk is the owner's. After new files, deleted files and shared-module changes, restart
the dev server near hand-off with `npm run dev` and escalated network access, confirm
`/platform-admin/login?next=%2Fplatform-admin` returns 200 with no Supabase `EACCES`, and stop before deleting `.next`.

End with: customer outcome by plan and role; files grouped (added / changed / deleted); the exact check results and
failures; the state and flow checklist walked versus not walked (all six plans × owner / non-owner, the rail row on
desktop and the phone sheet, free time, Founding, cancelled, past due, the portal / card / next-season / checkout /
plan-move returns); the decisions you made in 3d with your reasons; and the owed steps (`/simplify`, `/review`, `/docs`,
the owner walk, written by a Claude session). Update the plan §9 hand-off, the PM brief and the one TODO line. Do not
claim Stage 1 complete before the owner has walked it. Do not commit or push.
