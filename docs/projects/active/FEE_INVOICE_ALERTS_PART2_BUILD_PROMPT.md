# Fee invoice alerts · Part 2: the rail pill and the phone More pill (build prompt)

> Written 2026-11-05. Plan of record: [FEE_INVOICE_ALERTS_PLAN.md](FEE_INVOICE_ALERTS_PLAN.md) (read its Progress block first; the
> 2026-11-05 review entry lists what is known and left). PM brief: [FEE_INVOICE_ALERTS_PM_BRIEF.md](FEE_INVOICE_ALERTS_PM_BRIEF.md).
> Drawings (owner rulings, asks 1–8 all A): https://claude.ai/artifact/4dmPojUsg4EspaphPVxSEc, source
> [FEE_INVOICE_ALERTS_DRAWINGS.html](FEE_INVOICE_ALERTS_DRAWINGS.html); design record `memory/design_decisions.md`
> 2026-11-05 "A FEE INVOICE THE CLUB OWES". Recommended model: Sonnet is enough (every decision is already ruled).
> Mark each fact you rely on [V] (verified by you this session, with file:line) or [H] (handed to you). Everything below is [H]
> unless marked **[V 2026-11-05]** (read in the code the day this was written; line numbers drift).

## Why this exists, in one paragraph

Part 1 (committed `912cfffdb`, review fixes after it) made the Stripe fees list read as invoices. Nothing outside Plan & billing
tells the owner they owe one. Part 2 is the **signal's data and the pill**: a count on the "Plan & billing" door in the club
admin rail, and the same on the phone's More tab and on the Plan & billing row inside the More sheet. Amber while an invoice is
open, **red** when one is overdue. Parts 3 (page line, failed-payment button) and 4 (the overdue banner) come after and read what
this part builds. **This part draws no banner and no page line.**

## Ruled (do not re-ask)

- Ask 3: the door wears the rail's own count pill, **amber while open, red when overdue**. Phone: the same on **More** and on the
  Plan & billing row in the sheet.
- Ask 6: **owner only** (`hasBillingAccess`). A treasurer or admin without billing access sees no pill and no figure.
- Ask 7: a failed plan payment (`past_due`) is an **amber** pill on the same door, with **no fetch** (`useOrg().subscriptionStatus`).
  The red line and its button are Part 3; the pill is Part 2.
- Ask 8: the red tone is the one design-system extension. Check first whether it needs a new token at all (see Facts).
- **Words are NOT yet accepted by the owner. Build the structure with the strings the owner accepts; the proposals are:**
  pill spoken label `{n} invoice to pay` / `{n} invoices to pay`, overdue `{n} invoice overdue` / `{n} invoices overdue`,
  failed plan payment `Plan payment didn't go through`. **Before putting any string in, ask the owner for the nod, then put them
  in `lib/plan-billing-words.ts` (+ its test).** Never a literal in a component (`plan-billing-source-guard`). Mind the one-spelling
  gate (`npm run check:spelling`).

## Facts handed to you (verify before building on any)

- **The data path.** `ClubBriefProvider` (`components/admin/kit/club/ClubBriefProvider.tsx`) fetches `/api/admin/club-brief` ONCE
  per org and serves the rail, the bar and the hub; `ClubBrief.counts` keys are present **only where the person can act**
  (`BriefKey` ~:23). **No new fetch.** Add an owner-only `feesOwed: { count, overdue }` to the route, from `platform_fee_invoices`
  where `status = 'open'`, the org's own `org_id`, the right `livemode` (`stripeKeyIsLive()`), `overdue` = open with `due_at` in the
  past. One cheap query, no Stripe call. Absent (not zero) for anyone without `hasBillingAccess`. Mind that the table's rows are
  org-scoped by `org_id`; filter on it explicitly.
- **The rail.** The foot row is `components/admin/kit/AdminKitRail.tsx` ~:322 (`billingLink &&` Link). It has **no count today**.
  The pill primitive is the local `WaitingCount({count,label,className})` ~:60 and the `.count` style in `AdminKitFrame.module.css`
  ~:128 (amber tint). The brief reaches the rail through `useClubBrief()`; `briefPageCount(brief, key)` ~:125 is how pages read it.
- **The phone.** `components/admin/kit/AdminKitBottomNav.tsx`: `moreBadge = moreChat + notifUnread` ~:166 (add the fee signal to it),
  the More tab's `aria-label` ~:236 says "unread" (**reword so a screen reader is not told invoices are unread**), the pill
  `tabCount` ~:241, the sheet row `{billingLink && <Link …>}` ~:341 and `dropCount` ~:182. Build the per-row `aria-label` for the
  billing row; do not reuse the "unread" wording.
- **`kitBillingLink` has no count.** `lib/admin-kit-nav.ts` ~:255. ⚠ **Do not change the call** `const billingLink = kitBillingLink({…})`
  in `components/admin/kit/useAdminKitNav.ts` ~:69: `nav-standard-guard` pins that exact text. Carry the count to the rail and
  the sheet separately (they already call `useClubBrief()`); `billingLink != null` is the client-side owner test.
- **Red may need no new token.** `app/globals.css` ~:102–110 already has `--danger` (tint/border/dot) and **`--danger-fill`**
  (a red FILL with light words, "a count badge (the bell's red number)", contrast asserted in `tests/unit/warm-palette-contrast.test.ts`).
  The amber pill is a tint (`rgba(var(--home-amber-rgb), .11)` + `--home-amber` text + a border). The red pill should be the same
  recipe with `--danger`/`--danger-rgb` (or the fill) — **run the warm-portal contrast test and `check:layout` on the rail before
  deciding**. If it needs a token that does not exist, that is a design-system extension: say so to the owner (Ask 8 already
  authorises exactly one).
- **The same count style exists in two files** (`.count` in `AdminKitFrame.module.css`; `.tabCount`/`.dropCount` in the bottom
  nav's stylesheet). Add the red variant in each, tokens only (`admin-kit-guard` fails on literals under `components/admin/kit`).
- **Guards that touch this:** `nav-standard-guard` (pins the rail foot block and the `kitBillingLink` call), `admin-kit-nav`,
  `admin-kit-guard`, `org-billing-access-guard` (this is a read of billing state: the route stays behind the owner gate).
- **Where a pill must NOT show:** a cancelled club's strip-only shell has no rail (Part 4's problem), the tournament and house-league
  chromes, a sandbox/demo (`isSandbox` — check how the existing counts behave there), and any non-owner.

## Parts (build in this order; each: UX summary → build → verify)

**Part 0 — verify.** Read the Facts above against the code and say what drifted. Confirm with a query on dev how many open fee
invoices exist (UAT Rep Club has one, APFJ8XMY-0001, open and not yet due). Get the owner's nod on the pill words.

**Part 1 — the route.** `feesOwed` on `/api/admin/club-brief` (owner only, absent otherwise), a type on `ClubBrief`, a tiny helper
the pill and (later) the banner both read. A unit test with the route's gate: owner gets it, a non-owner does not.

**Part 2 — the pill.** Rail foot row and the phone's More tab + sheet row; amber open, red overdue; `past_due` amber with no fetch;
spoken labels per row; More's own label no longer says "unread" for a fee signal. Phone first: the tab is 44 px minimum.

**Part 3 — verify and close.** `npm run verify:changed`; typecheck (shared modules touched); the guards above; `check:layout --changed`
on the rail/bottom nav at 361 and 1440 **on a warm dev server only** (not a sweep). Dev server restart needed (new route field,
shared module). Offer `/review`. Write the Progress entry and commit hash into the plan and the TODO line. **No help article yet**
(Part 5 does `/docs` for the whole feature), **no banner, no page line.**

## Owner's walk (draw it as a checkable Artifact after the build)

Signed in as the UAT Rep Club owner: the door shows an amber pill (open invoice); make the invoice overdue on dev (move its due
date back) and the pill is red; pay it and the pill goes. A non-owner of the same club sees nothing. On a phone width: More shows
the pill, the sheet's Plan & billing row shows it. Set the plan to failed-payment on dev: an amber pill, no figure.

## Not in this part

The page line, the failed-payment button, the banner, the cancelled-club shell, help articles, accounting wording check. Do not
touch `StripeFeesList`, the fees reader, or migration 444. No new table, no migration (read-only query on an existing table).
