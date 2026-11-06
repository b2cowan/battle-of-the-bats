# Fee invoice alerts · Part 3: the page line and the failed-payment button (build prompt)

> Written 2026-11-05. Plan of record: [FEE_INVOICE_ALERTS_PLAN.md](FEE_INVOICE_ALERTS_PLAN.md) (read its Progress block first, then the
> Part 3 paragraph under "Build, in order"). PM brief: [FEE_INVOICE_ALERTS_PM_BRIEF.md](FEE_INVOICE_ALERTS_PM_BRIEF.md). Drawings (owner
> rulings, asks 1–8 all A): https://claude.ai/artifact/4dmPojUsg4EspaphPVxSEc, source
> [FEE_INVOICE_ALERTS_DRAWINGS.html](FEE_INVOICE_ALERTS_DRAWINGS.html); design record `memory/design_decisions.md` 2026-11-05
> "A FEE INVOICE THE CLUB OWES". Part 2 shipped and walked: commits `34227e6e4` + `e1ba62c90`, walk §465 PASSED 22/22.
> Recommended model: Sonnet is enough for the build; the words step (below) goes to `/marketing`.
> Mark each fact you rely on [V] (verified by you this session, with file:line) or [H] (handed to you). Everything below is [H]
> unless marked **[V 2026-11-05]** (read in the code the day this was written; line numbers drift).

## Why this exists, in one paragraph

Part 2 put a count on the "Plan & billing" door. When the owner clicks it, the page itself says nothing about the invoice except
the fees list further down. Part 3 adds the **page line** (one callout at the top of Plan & billing: you have an invoice to pay) and
gives the existing **failed plan payment** line a **button**. **This part draws no banner on other pages** (Part 4) and no help
article (Part 5).

## Ruled (do not re-ask)

- Ask 4: open, not yet due = the pill (done) **plus one white callout line, amber edge, at the top of Plan & billing. Nothing on
  other pages.**
- Ask 5 (the part that touches Part 3): overdue is a red-edged banner on every club admin page (Part 4); **on Plan & billing the
  banner replaces the separate line.**
- Ask 6: owner only. A treasurer or admin without billing access never sees the line (they cannot open Plan & billing anyway).
- Ask 7: a failed plan payment keeps today's sentence (`W.plan.pastDue`) as the red line **and gains a button**: the shipped
  "Payment method & invoices" door. No banner elsewhere; the amber pill already exists.
- Fee invoices never suspend an account (plan §7 ruling 3). The words must not threaten a shut-off.
- Part 2 ruling (c): while a fee signal exists, More's pill shows only the invoice count. Not touched here.

## Facts handed to you (verify before building on any)

- **The callout recipe.** `.waitCallout` in `components/billing/Billing.module.css` ~:322 (white card, amber left edge, with the
  comment that `PageNotice` has no amber tone and none is added); `.calloutDanger` ~:335 turns the edge red. Used all over
  `BillingBody.tsx` (~:349 `waitNotice`, ~:448, ~:870). Reuse it; do not invent a new callout.
- **The failed-payment line today** is `{org.subscriptionStatus === 'past_due' && <PageNotice notice={{ tone: 'bad', text: W.plan.pastDue }} />}`
  in `BillingBodyView` ~:351; the sentence is `W.plan.pastDue` in `lib/plan-billing-words.ts` ~:95 and already tells the owner to
  "update your card in Payment method & invoices". The button is that same door: the `portal` action (`actions.portal`, type at
  ~:60) that the lime "Payment method & invoices" button on the plan card already calls (~:204–:222). **Reuse that action;
  add no second door.** Decide where the button sits (inside the red callout, at its right on a desk, full width on a phone, 44 px
  tap floor) by looking at the drawings, not by guessing.
- **Where the line gets its figures.** The brief's `feesOwed` is only `{ count, overdue }` (`lib/fee-invoice-alert.ts`,
  `ClubBriefProvider.tsx` ~:43). A line that says "due Dec 1" needs the invoice's due day, which the **fees list already reads**
  (`StripeFeesList.tsx`: `invoices[]` with `state`, due day, total, `payUrl`). Decide, and say which in the UX summary:
  (a) the line reads the same `invoices[]` the list reads (one fetch, lift it up or share it), or (b) the line is generic ("You
  have an invoice to pay below") and needs no date. Do **not** add a second fetch of the same data, and do **not** compute a
  total in the browser (the figure comes from the invoice).
- **Shared with the coaches portal.** `BillingBody` renders in both the club admin and the coaches portal; the portal has no
  `ClubBriefProvider` (`useClubBrief()` returns a no-op fallback) and no fee invoices. The line must be **absent, not broken**,
  there. Check how the fees section already handles it (`fees` prop ~:810).
- **Staleness, known from Part 2's review (b).** After the owner pays (the Pay button opens Stripe in a new tab), the pill clears
  only on a reload or the next hub visit. This page is where the owner is when they pay: **call the brief's `reload()`**
  (`ClubBriefProvider.tsx` ~:73, ~:105) when the owner comes back to the tab / the list re-reads, so the pill and the line agree
  with the list. A tournament-only owner never lands on the hub, so for them this is the only refresh. Prove it on dev
  (the walk's put-back commands change an invoice's status by hand).
- **Words are NOT in yet.** The page line, the failed-payment button and plural forms were only proposals (pending the owner's
  nod; plan Progress, "Wording"). **Run `/marketing` for the strings first**, put the owner's accepted wording in
  `lib/plan-billing-words.ts` (+ its test), amounts through `money()` (the source guard forbids literals with `$ <digit>`),
  never a literal in a component. Mind `npm run check:spelling`. Two open invoices can exist, so the line needs a plural form.
- **Guards that touch this:** `plan-billing-body` (section order; fees render `''` until read), `plan-billing-source-guard`,
  `org-billing-access-guard` (the page stays behind the owner gate), the warm-portal contrast test if you tint anything.

## Open question to raise with the owner BEFORE building (disagree out loud)

**Overdue on Plan & billing before Part 4 exists.** Ask 5 says the banner stands in for the separate line on this page, and the
banner is Part 4. If Part 3 draws only the amber (open, not due) line, then between Part 3 and Part 4 an **overdue** invoice shows
only the red pill and the red chip in the list, no line. Two ways: (A, recommended) Part 3 builds the line with both tones, amber
and red (`.calloutDanger`), and Part 4 later makes the banner stand in for it on this page; (B) amber only, and the gap stays
until Part 4. Nothing ships to customers in between (the product is not on sale), so B costs nothing but a slightly empty overdue
state on dev. Put the recommendation to the owner in one line and take the answer.

## Parts (build in this order; each: UX summary → build → verify)

**Part 0 — verify and ask.** Read the Facts against the code and say what drifted. Confirm on dev: the fixture invoice
`APFJ8XMY-0001` for `uat-rep-club` must be `open` for the walk, and **read back as `paid` on 2026-11-05 after walk §465**
(something paid it again; the re-open command is step C5 of that walk, `update platform_fee_invoices set status = 'open', paid_at = null
where invoice_number = 'APFJ8XMY-0001'`). Ask the owner before re-opening it. Run `/marketing` for the words and get the nod. Put
the overdue question above to the owner.

**Part 1 — the words.** Strings in `lib/plan-billing-words.ts` + test, singular and plural, open and overdue, the failed-payment
button.

**Part 2 — the line.** Callout at the top of Plan & billing, owner only, from the open invoices; amber edge open (and red per the
owner's answer on overdue). It does not duplicate the fees list's Pay button unless the drawing says so; read the drawing.
Phone first, 44 px tap floors.

**Part 3 — the failed-payment button.** On the red `past_due` line, the shipped Payment method & invoices door; busy and disabled
states copied from the plan card's own button.

**Part 4 — refresh.** `reload()` of the brief when a payment may have happened (see Facts), so the pill, the line and the list
agree without a manual reload.

**Part 5 — verify and close.** `npm run verify:changed`; typecheck (shared module `BillingBody`, the coaches portal renders it);
the guards above; `check:layout --changed` on `admin-org-billing` at 361 and 1440 **on a warm dev server only** (not a sweep), and
on the coaches portal's Plan & billing to confirm nothing appears there. Dev server restart needed if you add files. Offer
`/review` (a billing screen: high-risk tier). Write the Progress entry and commit hash into the plan and the TODO line. **No help
article yet** (Part 5 of the plan does `/docs` for the whole feature), **no banner.**

## Owner's walk (draw it as a checkable Artifact after the build)

Signed in as the UAT Rep Club owner: with an open invoice, Plan & billing opens with one amber-edged line at the top and the
pill is still on the door; the line and the list agree on the number of invoices. Move the due date back (the line goes red, per the
owner's ruling above). Pay it by hand on dev: the line, the pill and the list clear together after coming back to the tab. Set the
plan to failed-payment on dev: the red line shows today's sentence with a button that opens the card window. A treasurer of the same
club cannot open Plan & billing and sees nothing. The same page in the coaches portal shows no line. Every put-back command in the
walk, and a read-back at the end that the invoice is open, due 2026-12-01 and the plan active.

## Not in this part

The banner on every page (Part 4), the cancelled-club shell, help articles (Part 5), the accounting wording check, the fees list's
layout, the fees reader, any migration. No new table, no new token. No change to when invoices are issued or the reminder email.
