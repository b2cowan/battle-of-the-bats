# Plan & billing, Stage 1: one body, one registry, one words file (build prompt)

> **Written 2026-10-28.** Paste into a new Codex chat on `dev`. **First read `PLAN_AND_BILLING_CODEX_RULES.md`**, then
> `PLAN_AND_BILLING_ONE_EXPERIENCE_PLAN.md`. Leads below name **files, not lines**; re-verify every one.
> **Gate (do not start without all three):** (1) the **Stage A drawings are ruled** — their link is in the plan's §9;
> (2) the owner has said "build Stage 1"; (3) the words file in Part 0 has the owner's yes before any string is typed.

## What Stage 1 makes true

Open **Plan & billing** as a standalone coach, a Tournament owner, a Tournament Plus owner, a League Plus owner and a
Club owner **in the admin look**: it is **the Club page's layout and order for all of them** — Your plan, What's in use,
(free-time / founding band), Stripe fees, **Change plan, then What's included** (owner ruling 6, 2026-10-28: the Club page's order), Reduce or cancel — with **one set of words**, one
cancel window, one cancelled view, one non-owner locked card. Only "What's in use" and "What's included" differ, because
they describe a different plan. Tournament owners get a **Plan & billing row in their side rail and phone sheet** (today it
is buried behind a Settings & access card). No new routes. No change to what any plan costs or includes. The Coaches
Portal version is Stage 2; this stage builds the body so Stage 2 can host it without a rewrite.

## Rulings (do not reopen)

See the plan §2. In short: Club redesign extended to every plan (reverses the 2026-09-27 "restyle it here" scope on
purpose); plan-driven so a new plan is a data edit; **Founding Season (ruling D6) stays off Club** — keep that as a
per-plan flag in the registry, not a branch in the screen; free-time removes (not disables) payment method / move / cancel.

## Part 0 · Inventory and words (no code)

1. **Read both components end to end.** Today `app/[orgSlug]/admin/org/billing/page.tsx` picks `BillingKit`
   (`components/admin/kit/club/BillingKit.tsx`, Club plans) or `BillingPagePlans` (everything else, ~1,350 lines, in the same
   page file). `app/[orgSlug]/admin/tournaments/settings/subscription/page.tsx` re-exports it. `PlanMoveDialog.tsx`,
   `StripeFeesList.tsx`, `FreeTimeBand.tsx`, `PlanArticlePanel` are shared.
2. **Write `PLAN_AND_BILLING_COPY.md`** next to this file: a table of **every sentence either component speaks**, grouped by
   concept (page title, status chips, price line, renews/trial, free time running/ending/ended, founding comp, past due,
   cancel section + dialog + confirm buttons, cancelled view, reactivate, not-on-sale, non-owner lock, success/notice, usage
   meter captions, change-plan table headings, what-goes-offline). For each concept show today's Club wording, today's other
   wording, and **one proposed wording** in the house voice. Known divergences to settle: "Your last payment failed…" vs
   "…didn't go through…"; "Reduce or cancel plan" vs "Reduce or cancel"; "Cancel and suspend account" / "Cancel Premium" vs
   "Cancel and suspend {org}…"; "Reactivate your account" vs "{org} is cancelled"; "billed annually" vs "billed yearly";
   "Coaches Portal billing" vs "Plan & billing"; FeedbackModal ("Subscription activated!") vs PageNotice. **Stop here for the
   owner's yes** (or take his edits). Words win over the drawings where they differ.
3. **Count what breaks:** list every test, guard, baseline and help article that reads the old files (leads: unit tests
   `support-console-stage4b-coach-guard`, `stripe-fees-owner-rulings`, `team-move-words`, `tournament-one-at-a-time`,
   `gated-plan-availability-copy`, `admin-kit-nav`, `billing-urls`, `plan-panel-host`, notification tests, UAT
   `plan-gating.spec` — note its non-owner case already expects a disabled button the Club page no longer renders — and
   `marketing-seam.spec`; check scripts `check-public-tokens`, `check-admin-type`, the css-selector and admin-type baselines).

## Part 1 · The plan profile registry and the words module (no screen changes yet)

- **One registry, one entry per plan** (name the module for what it is, e.g. `lib/plan-billing-profile.ts`): name and
  price **read from `lib/plan-config.ts`** (never retyped); which usage meters it shows (Club: teams of its cap; Tournament /
  Plus / League / coach workspace: tournament slots, staff seats — the page's current meters); the **"what's included" list**;
  the plans this owner can change to; what goes offline on cancel; whether Founding Season applies; the retention fallback.
- **Fold the three "included" lists into one source.** Today: `PLAN_FEATURES` in the old page, `CLUB_INCLUDES` in the kit,
  and `lib/plan-article-content.ts` (feeds the plan drawer, marketing pages and pricing; **it has no entry for `tournament`
  or `club_large`** — decide with the owner whether the registry reads from it or it reads from the registry; the drawer and
  marketing copy must not change wording as a side effect).
- **Cancel's "what goes offline" already has one server source** (`buildCancellationPreflight` / `PREMIUM_MODULE_SHUTDOWN_COPY`
  in `lib/billing-retention.ts`). Use it for every plan; delete the page's hand-typed sentences.
- **Words module** in the pattern of `lib/online-payment-words.ts`: every billing sentence, keyed by concept, parameterised
  (plan label, date, org name through `possessive()`), from the approved `PLAN_AND_BILLING_COPY.md`. Free-time copy stays in
  `lib/free-time-copy.ts` (already shared) — reference it, do not fork it.
- **A build guard** (a unit test in the style of the repo's other word guards): a billing screen file may not contain a
  hand-typed plan name, price or included-item; it must come from the registry / words module. Allow-list with a written
  reason, as `spelling-ok` does.
- Unit-test the registry: every plan in `OrgPlan` has an entry; every entry's price equals `plan-config`.

## Part 2 · The shell-agnostic body

Extract **one body component** (e.g. under `components/billing/`) from `BillingKit`, generalised to take the registry
entry. **Hard constraints, because Stage 2 will host it in a different shell:**

- It must **not** use `AdminPageHeader`, admin-kit CSS (`ClubKit.module.css`, `ck.*`), `KitDialog`/`PageNotice` from the
  admin club kit, `useTournament()`, or `useClubBrief()`. The page title/header is **supplied by the host**.
- Usage counts come from **read-only, org-scoped API routes**, not admin-only context. Leads: `/api/admin/members/count`
  exists (staff seats); teams (`useClubBrief().brief.teams.active`) and tournament slots (`useTournament()` +
  `holdsSlot` + `currentOrg.tournamentLimit`) come from admin providers today — **if no route serves them, add the smallest
  one** (owner capability, `orgSlug`, no PII) and tell the owner. The coaches layout has `OrgProvider` only.
- Dialogs and notices: use a **shared window** that both shells can mount (`FeedbackModal` is generic; the cancel dialog
  and `PlanMoveDialog` need a shell-neutral home). Success/notice wording from the words module.
- **Closing a success window must not push to an admin route** from inside the body — the host passes `onDone`/`returnHref`.
- Return URLs the body builds (`returnTo`, checkout, card-save, next-season, plan move) come from **one host-supplied
  base**, not a hard-coded `/admin/org/billing`. (The server routes' own return URLs are Stage 2.)
- Sections and order exactly per the ruled drawings. The change-plan section is **presentation only**: one table of
  the moves that exist today (`lib/plan-move.ts` MOVES; Plus → free via the downgrade preflight; `lib/plan-upgrade.ts`),
  each action calling the **same API it calls today**. Do not add a move that has no server support; do not list
  Premium Coaches Portal → Club (a pricing call, open question B in the plan).
- Preserve every behaviour today's two pages have: Founding Season chooser / card-on-file (not on Club); the
  not-on-sale → "Contact us" doors from the live gating switch; the portal free-time path and "Keep Premium" /
  "Join a club" for the coach workspace; the scheduled-downgrade line and "Keep {plan}"; the Stripe fees list (owner only)
  and its placement on the cancelled view; the `?plan=` deep link that opens the plan drawer; `?success`, `?card_saved`,
  `?next_season` return handling (then stripped); element ids the UAT specs use (`#billing-manage-btn`,
  `#billing-reactivate-btn`).
- **Non-owner who types the URL** gets one locked card for every plan ("Plan & billing is the owner's…" — words file).

## Part 3 · The admin host and the plan switch retired

- The admin billing page renders **the body for every plan**; the `isClubPlan ? BillingKit : BillingPagePlans` switch goes.
  The tournament-tier URL (`…/tournaments/settings/subscription`) keeps working as the same page.
- Admin header for all plans: **eyebrow removed on plans with no organization** (Tournament, Tournament Plus, coach
  workspace); title is the one words-file title.
- **Rail row on every admin plan (owner ruling 2026-10-28):** **Plan & billing** (owner only) sits in the **rail foot, beside
  Help**, on Tournament, Tournament Plus, League Plus and Club (tab 6 of the Stage A drawings). On Club and League it **moves
  out of the Organization group** into the foot; on the Tournament tiers it is a new foot row. On a phone it is in the More
  sheet's **You** group (to confirm, plan §9). Today the Tournament tiers have only a Settings & access hub card
  (`app/[orgSlug]/admin/tournaments/settings/page.tsx`); **the card stays** (ruling 2). Also ruled: success and errors after
  paying use the Club page's **fading line everywhere** (no `FeedbackModal`, ruling 11); the cancel button for a Premium
  coach reads "Cancel Premium…" (ruling 10); days kept and what goes offline come only from the plan entry, 365 for Premium
  and 90 for organizations (ruling 9); the Plus rows for Club read "Contact us to move" until Club is on sale (ruling 7).
  The rulings are listed in the plan's §9. Leads:
  `components/admin/admin-nav-config.ts`, `lib/admin-kit-nav.ts` (`kitOrgLinks` — already owner-only for club),
  the tournament groups file used by the phone bar. Update `admin-kit-nav.test.ts` and `nav-standard-guard`.
- **Fix the payment-portal return URL:** `app/api/billing/portal/route.ts` returns to `/{slug}/admin/org/billing`, which
  bounces tournament tiers to `/admin/tournaments`. Return to `getBillingHref(slug, planId)` for this stage (Stage 2
  replaces the resolver). Check the mock portal (`billing/mock-portal`) the same way.
- **Delete `BillingPagePlans` and its CSS** (`billing.module.css`) once nothing renders them; clean the baselines and
  `scripts/check-public-tokens.mjs` lists that name them (generate, do not hand-edit, where a script writes them).
- **Repoint the tests/guards from Part 0 §3** in this same change. The stale UAT non-owner case is fixed to the new locked card.
- Update **only** the help-article strings this change makes untrue (`lib/help-content/org.tsx` club-plan-and-billing,
  subscription-ends, Stripe fees, cancel). The full help rewrite is Stage 5.

## Not Stage 1

The Coaches Portal host, its nav row, the link resolver, email/bell/Stripe return retargeting, wall doors (Stage 2);
retiring the coach's admin view (Stage 3); the "Covered by {Club}" line (Stage 4); merging the plan-change server mechanisms;
pricing; an in-app invoice list.

## Done when

Every plan's admin page renders the same body; the five old tests pass against the new files; `npm run verify:changed` and
`npm run typecheck` are green; a unit test proves a new plan needs only a registry entry (add a fake plan in the test);
the hand-off lists every state walked. **Owed after:** `/simplify` (new shared abstraction), `/review`, `/docs`, the owner
walk (written by a Claude session), dev-server restart (new files, shared modules).
