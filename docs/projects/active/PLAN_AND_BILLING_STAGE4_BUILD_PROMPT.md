# Plan & billing, Stage 4: the rest of the family (build prompt)

> **Written 2026-10-28; revised 2026-10-30.** Paste into a new Codex chat on `dev`. **First read `PLAN_AND_BILLING_CODEX_RULES.md`**
> (its lines 63-67 still carry the old "delegate billing" wording: **billing is the owner's alone, ruling 2026-10-29, and wins**),
> then the plan (`PLAN_AND_BILLING_ONE_EXPERIENCE_PLAN.md`: the Stage A rulings near line 303, the Stage 3 doors rulings near
> line 321, the 2026-10-29 owner-alone note near line 34), then the drawing `PLAN_AND_BILLING_STAGE_A_DRAWINGS.html` (tab 8 is the
> "Covered by" card and the free-team footer's before/after). Leads name **files, not lines**; re-verify each.
>
> **Gate.** Stages 1 and 2 are committed and walked. Stage 3 was committed on 2026-10-30 with its `/review` (redirects and sign-in),
> `/docs` and your owner walk still open (`PLAN_AND_BILLING_STAGE3_OWNER_WALK.md`); the owner asked for this prompt to be handed
> to Codex on 2026-10-30. **"Covered by {Club}" is ruled; the free-team footer is drawn but NOT ruled**, so Part 2 is propose-only.
> Check `git log` for the Stage 3 commit before you start; if it is missing, stop and say so.
>
> **Other sessions share this working copy.** `components/coaches/ScopeShelf.tsx` carries an uncommitted edit from the Support
> console (a `note` prop, passed from `app/coaches/team/[basicTeamId]/page.tsx`). Keep it. Stage explicit paths only; ask before
> committing; never push.

## What Stage 4 makes true

- A coach on a **club-paid team** can tell **who pays**: a read-only "Covered by {Club}" **card** in **Team settings, first card**
  (ruling 1). **No** billing controls, no price, no link to billing. Billing belongs to the club's owner alone, so no coach,
  assistant or club admin can ever hold it; the card offers no door to it.
- A **free Basic team's** upsell footer and Explore page use the **same plan words** as the billing page: one source, so
  changing a price or a name changes it everywhere. **The owner has not ruled which price form** (see Part 2).
- The Money tab's words are **checked** for a collision with the new card, and reported. Change nothing there without a ruling.

## Part 1 · "Covered by {Club}" (ruled)

- **Where:** Team settings (`app/[orgSlug]/coaches/teams/[teamId]/settings/page.tsx`, a client component), **first card**.
- **What it shows (drawing, tab 8, option A):** a building icon, a "Plan" eyebrow, the bold **Covered by {Club}**, and the
  sub-line **"Your club pays for this team's Coaches Portal. There is nothing to manage here."** A card, not a bare line.
- **Who sees it:** only people who can open Team settings, on a team whose coaching is paid by the club. An assistant without
  Team settings access does not see it. It never appears for a standalone workspace, a free Basic team, or while the club is
  suspended or cancelled (the wall owns that).
- **What "club-paid" means is the one thing to verify, not assume.** There is no ready helper. The simple rule is "the team's
  org is not a team workspace" (`isTeamWorkspaceOrg`, home `lib/team-workspace-kind.ts`, re-exported from
  `lib/team-workspace-entitlements.ts`; club-owned teams skip the entitlement check there). **But** a team workspace whose
  billing mode is club-paid (`CLUB_BILLED_MODES`, `lib/portal-free-time-tab.ts`; `lib/team-org-billing.ts`) may also be "covered".
  Read both, state which rule you used and why, and list the cases you were unsure of. **Do not guess silently.**
- **A club owner or admin who also coaches** is the payer, not "covered". The drawing does not say what they see.
  **Propose, do not pick:** hide the card for them, or show it with wording that fits.
- **Words:** club name through the words module and `possessive()` where needed; sentence from the words module, not typed in
  the page. Phone at 390px. No new tap target (it is read-only).
- **Collision check:** the dues screens already say "Covered by credits" and "Covered by fundraising"
  (`accounting/dues/CollectionSchedule.tsx`, `accounting/dues/panel.tsx`). Report whether the new phrase can be mistaken for
  those. Do not rename either without a ruling.

## Part 2 · Free-team footer and Explore on the registry (PROPOSE, do not pick)

The files, accurately:

- `components/coaches/ScopeShelf.tsx`: typed "$29/month per team" and the eyebrow "Premium Coaches Portal". Already imports the
  founding-season helpers from `lib/plan-config.ts`. Keep the uncommitted `note` prop.
- `components/coaches/CoachExploreCatalog.tsx`: typed eyebrow, `aria-label`, `$29` and "per team". It also has its **own**
  seven-line `PREMIUM_FEATURES` list, a fourth "what's included" list the Stage 1 fold did not cover. **Propose** whether it
  folds into the registry or stays; do not pick.
- `components/coaches/ScopeCeilingInterest.tsx`: typed eyebrow, "$29/month per team" twice.
- `components/coaches/CoachStartInterest.tsx`: **no price**, only the plan name (heading and thank-you text).

Plan words come from `lib/plan-config.ts` (`PLAN_CONFIG.team.label`, `formatPlanPeriodPrice` giving "$29/month") and
`lib/plan-billing-words.ts` (`plan.price` giving "$29 CAD / month"; the founding line "Free through {date}", "Normally $X a
year"). **There is no "per team" string in either source today; it needs one new entry in the billing words module.**

**Two owner calls are open. Write your proposal for each, with a small before/after, and stop for his ruling before wiring:**

1. **Price form** on each upsell surface: "$29/month" (pricing page) or "$29 CAD / month" (billing page). The drawing shows the CAD
   form for the footer; that is a drawing, not a ruling.
2. **Footer link target:** straight to checkout / the gated explainer (today), or to the plan-details view the drawing proposes
   ("See what Premium includes →"). The drawing itself calls this "a proposal: it adds a step".

Gated plans keep "See everything it includes". The founding variant ("free through {date}, normally $29/month") reads from the
same source. **Do not build the Premium → Club upgrade path** (owner said yes on 2026-10-30, drawings and price unruled; it is
sequenced after Stage 4). Just make sure the footer and Explore copy do not pre-empt it.

## Part 3 · Clean-up (smaller than the first draft said)

- **Not a clean-up item:** `getBillingHref` is now the live shell-aware resolver (`lib/billing-urls.ts`, about 40 callers).
  Do not remove or rename it.
- `BillingPagePlans`, `PLAN_FEATURES`, `CLUB_INCLUDES` and the old billing CSS were removed in Stage 1. A repo-wide grep should
  find them only in three guard tests (`plan-billing-admin-host`, `plan-billing-profile`, `stripe-fees-owner-rulings`) and in
  docs. **Keep those guards.**
- **Stale baselines, generated by the scripts, never hand-edited:** `scripts/.css-selector-baseline.json` still holds keys for
  the deleted `app/[orgSlug]/admin/org/billing/billing.module.css`; `scripts/.admin-type-baseline.json` points at
  `components/admin/kit/club/Billing.module.css`, which does not exist (the live file is `components/billing/Billing.module.css`).
  Regenerate with `npm run check:css-selectors:init` and the admin-type script. Layout baselines refresh on staging, not here.
- **`scripts/check-public-tokens.mjs`: leave it alone** (owner, plan lines near 355 and 362-364: harmless stale entry, "do not
  ask again"). The first draft of this prompt told you to edit it; that is withdrawn.

## Done when

- The card renders in the states the drawing shows, and is absent in every state listed above.
- **Extend the Stage 1 guard `tests/unit/plan-billing-source-guard.test.ts`** to cover the four coach upsell files. Note that
  "Premium Coaches Portal" is a plan label, so every literal of it in those files (eyebrows, `aria-label`, the
  `CoachStartInterest` heading) must come from the config. The exemption is a same-line `// billing-copy-ok: <reason>`.
- Focused checks pass (`npm run lint:focused -- <files>`, the unit tests you touched, `npm run typecheck`). Note:
  `verify:changed` currently stops at a known ESLint plugin-config error that is not yours; say so rather than fixing it.
- Part 2 stops at your proposals unless the owner has ruled by the time you finish.

**Owed after:** `/review`, `/docs` (coach help: "Who pays for my team"; Stage 5 expects it), the owner walk, a dev-server
restart (new files and shared modules).
