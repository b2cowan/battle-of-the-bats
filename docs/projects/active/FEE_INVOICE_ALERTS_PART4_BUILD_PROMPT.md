# Fee invoice alerts · Part 4: the overdue banner (build prompt)

> Written 2026-11-05. Plan of record: [FEE_INVOICE_ALERTS_PLAN.md](FEE_INVOICE_ALERTS_PLAN.md) (read its Progress block first, then the
> Part 4 paragraph under "Build, in order", then "Open questions", where Q1 and Q2 are ruled). PM brief:
> [FEE_INVOICE_ALERTS_PM_BRIEF.md](FEE_INVOICE_ALERTS_PM_BRIEF.md). Drawings (owner rulings, asks 1–8 all A):
> https://claude.ai/artifact/4dmPojUsg4EspaphPVxSEc, source [FEE_INVOICE_ALERTS_DRAWINGS.html](FEE_INVOICE_ALERTS_DRAWINGS.html); design
> record `memory/design_decisions.md` 2026-11-05 "A FEE INVOICE THE CLUB OWES". Part 3 shipped and walked: commit `ea94c4de3`, walk §466
> PASSED 22/22. Part 2: `34227e6e4` + `e1ba62c90`, walk §465 PASSED 22/22.
> Recommended model: Sonnet is enough for the build once the two open questions below are answered; the words step goes to `/marketing`.
> Mark each fact you rely on [V] (verified by you this session, with file:line) or [H] (handed to you). Everything below is [H]
> unless marked **[V 2026-11-05]** (read the day this was written; line numbers drift).

## Why this exists, in one paragraph

Parts 2 and 3 tell the owner they owe: a count on the Plan & billing door, and one line at the top of that page. An owner who never
opens Plan & billing still never sees an **overdue** invoice. Part 4 draws the **banner**: once any fee invoice is overdue, every club
admin page opens with one red-edged line, the words and a Pay button, no dismiss, and it ends when the invoice is paid. **This part
draws no help article (Part 5) and changes nothing about when invoices are issued, the reminder email, or the "nothing switches off"
rule.**

## Ruled (do not re-ask)

- Ask 5: overdue = a banner on every club admin page, one line, red-edged, words + Pay button, **no dismiss**, scrolls with the page,
  ends when paid. **On Plan & billing the banner replaces the separate line** (Part 3's `FeeInvoiceLine`, which today shows both tones).
- Ask 6: owner only (`hasBillingAccess`). A treasurer or admin without it never sees it.
- Q1: the simpler build: the banner at the top of the content column, **beside the rail** (not full-bleed above it).
- Q2: a **cancelled club sees the banner too** (owner only), drawn in the strip-only shell. Needs a short drawing check first.
- Fee invoices never suspend an account (plan §7 ruling 3). The words must not threaten a shut-off.
- Part 2 ruling (c): while a fee signal exists, More's pill shows only the invoice count. Not touched here.

## Facts handed to you (verify before building on any)

- **Where it goes.** `app/[orgSlug]/admin/AdminChrome.tsx` ~:119–:142: inside `<main>`, above `<AdminEventHeader>` per Q1 / the plan
  (read the drawing: Q1 says "top of the content column"). The `mainPad` div holds `EnablePushBanner` and the program row; decide the
  banner's exact slot against the drawing, not by guessing. Phone: one row, 44 px button.
- **The brief carries only counts.** `feesOwed` is `{ count, overdue }` (`lib/fee-invoice-alert.ts`; route
  `app/api/admin/club-brief/route.ts` ~:223; type in `ClubBriefProvider.tsx` ~:43). **A Pay button needs somewhere to go, and the
  brief has no invoice number, no total and no Stripe link.** This is the real design decision of the part; raise it before building:
  (A) the banner's button goes to Plan & billing (always correct, no new data, one extra click for a payer), or (B) the brief also
  carries the one overdue invoice's number, total, due day and https `payUrl` when exactly one is overdue (a bigger route change, same
  owner-only gate, still no Stripe call). **The plan's Progress entry (Q6) recommends (B)**, because the drawn banner has an invoice
  number, an amount, a day and a pay link that `{count, overdue}` cannot fill; the plan's "reads `feesOwed.overdue`" decides whether to
  draw, not what to say. Read the drawing, then put (A) or (B) to the owner as ruling Q6.
- **A cancelled club gets no brief today.** `AdminChrome.tsx` ~:61 `isCanceled`; the `ClubBriefProvider` skips a cancelled org and the
  route refuses one (Part 2 `/review`, known (a)). The cancelled shell (`suspended`, ~:80) draws no rail and no program row. To honour Q2
  the figure must reach it some other way: either the brief route learns a suspended-org opt-out (a decision point in
  `org-billing-access-guard`; read that guard first), or the banner in that shell reads an already-exempt billing route (the fees read,
  `/api/billing/stripe-fees`, already allows suspended orgs and is behind `billing`). Choose, and say which in the UX summary.
  **The plan's Progress entry (Q4) found more:** a cancelled club can reach ONLY Plan & billing, so the ruled "banner in the strip-only
  shell" would sit above the page that already lists the invoice. It recommends drawing the same line on the cancelled layout from the
  page's own read instead, with the shell banner as the alternative; Q2 ruled the shell, so this is an owner ruling to take, not a
  quiet change.
- **Part 3's line and the banner must not both show.** `FeeInvoiceLine` (`components/billing/FeeInvoiceLine.tsx`) draws both tones on
  Plan & billing today (ruled for the gap). When the banner exists, the line must draw **amber only** and the banner stands in for red.
  Read `feeLineFor` (`lib/fee-invoice-line.ts`) before choosing where that split lives. The failed-plan-payment callout
  (`role="alert"`, `BillingBody.tsx` ~:357) is a different thing and stays; check that a red banner, the red past-due callout and the
  amber line never stack into three on one page.
- **The banner and the line read two different counts.** The banner would read the brief (`feesOwed.overdue`, a count over every open
  invoice); the line reads the fees list, which is capped at the newest 50 fees and only describes invoices that still have a fee in that
  window (`lib/platform-stripe-fees.ts` ~:836–:843, ~:894–:896). A high-volume club with an old overdue invoice can have a red banner and
  no matching line. Known and left in Part 3's `/review`; **decide here** whether the banner links to Plan & billing (then the list
  must show it) or whether the reader changes (an owner call, and it touches the fees reader). **The plan's Progress entry (Q5)
  recommends the reader always includes every open invoice**; put it to the owner as ruling Q5.
- **Staleness.** After paying in Stripe's tab, the brief refreshes through `useStripeFeesRead` only while Plan & billing is open. On
  another page the banner stays until a reload or the next brief fetch. Decide whether that is acceptable (the owner pays from the
  button, comes back to a page showing a red banner) or whether the banner re-reads on tab return; do not invent a second poller.
- **Words are NOT in yet.** The banner's sentence and button are proposals only. **Run `/marketing`** for the strings first, put the
  accepted wording in `lib/online-payment-words.ts` (`STRIPE_FEE_WORDS`, next to the `alert*` strings) or `lib/plan-billing-words.ts`
  as the Part 3 words were, amounts through `money()`, never a literal in a component. Mind `npm run check:spelling`.
- **Guards that touch this:** `org-billing-access-guard` (a banner route or opt-out), `nav-standard-guard`, `admin-kit-guard` (tokens
  only), `plan-billing-source-guard` (no typed words), `fee-invoice-line.test.ts`, the warm-portal contrast test if you tint anything.
  The red edge reuses `.waitCallout` + `.calloutDanger` (`components/billing/Billing.module.css`), which is a billing-module class: a
  banner in `AdminChrome` needs its own module rule or a shared one, not an import of billing's CSS module.

## Carried in from Part 3's `/review` (2026-11-05; none Critical or High; decide, do not silently inherit)

1. **The line is missing in three alternate layouts** of Plan & billing: the failed free-time read (`BillingBody.tsx` ~:262), the ended
   coaches-portal state (~:283) and the cancelled-club card (~:297). The cancelled card is this part's (Q2); the free-time-error one is a
   one-line omission worth fixing here; the ended-portal one cannot owe fee invoices. Confirm before touching.
2. **A failed first read of the fees never retries** on tab return (`useStripeFeesRead.ts`: `sig` stays null), so the line and list
   stay absent until a reload. Low; fold in only if you touch the hook.
3. **A payment whose webhook lands after the owner returns** leaves the line and pill up until the next focus event (known, left).
4. **`role="status"` on a line that mounts after a fetch** is announced less than the `role="alert"` past-due callout beside it; the
   banner should pick its role deliberately (an alert for a red, persistent line is defensible; say which).
5. The same `/review` could not run `check:layout` (memory floor). **Run it on this part**: `admin-org-billing` and a handful of other
   admin pages at 361 and 1440, on a warm dev server only.

## Parts (build in this order; each: UX summary → build → verify)

**Part 0 — verify and ask.** Read the Facts against the code and say what drifted. Put to the owner, one line each with a
recommendation: **Q4** (the cancelled club's banner: shell or the cancelled layout's own line), **Q5** (the fees reader always includes
every open invoice), **Q6** (the brief carries the one overdue invoice, or the Pay button goes to Plan & billing), and the slot in the
column. Check the
cancelled-shell drawing (Q2 says a short drawing check is owed): if the existing drawings do not show the strip-only banner, draw it
through `/design` and take the owner's nod before building. Run `/marketing` for the words.

**Part 1 — the words.** Strings + their test, singular and plural overdue.

**Part 2 — the banner.** Owner-only, overdue-only, on every club admin page including the cancelled shell; replaces the red line on
Plan & billing. No dismiss. Phone first, 44 px tap floor, tokens only.

**Part 3 — verify and close.** `npm run verify:changed` (it also runs other sessions' areas; list which failures are not yours);
typecheck (`AdminChrome` and `lib/` are shared); the guards above; `check:layout` on the admin pages the banner sits on at 361 and 1440
(warm server only, not a sweep). Dev server restart if you add files. Offer `/simplify`, then `/review` (billing: high-risk tier).
Write the Progress entry and commit hash into the plan and the TODO line. **No help article yet** (Part 5 does `/docs` for the whole
feature).

## Owner's walk (draw it as a checkable Artifact after the build)

Signed in as the UAT Rep Club owner with the invoice made overdue by hand: every admin page opens with one red banner; Plan & billing
shows the banner and not a second red line; Pay (or the button's destination) works on a desk and a phone. Open (not overdue) shows no
banner. Paid by hand: the banner is gone on the next load. The club's admin and treasurer see no banner. A cancelled club's owner sees
the banner in the strip-only shell. Every put-back command in the walk, and a read-back at the end that `APFJ8XMY-0001` is open, due
2026-12-01 11:15:11+00, `paid_at` null, and the plan active.

## Not in this part

Help articles (Part 5), the accounting wording check, the fees list's layout, any migration, any change to when invoices are issued or
the reminder email. No dismiss, no snooze. No new table, no new token (the red already exists).
