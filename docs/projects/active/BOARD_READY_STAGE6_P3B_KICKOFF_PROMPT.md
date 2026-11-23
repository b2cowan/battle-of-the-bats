# Board Ready Stage 6 · Part 3b — kickoff

Paste into a fresh session: **"Read and follow docs/projects/active/BOARD_READY_STAGE6_P3B_KICKOFF_PROMPT.md"**

Written 2026-11-23 by the Part 3a close-out session, for the session that builds Part 3b (the card payment and its refunds).

## ⛔ Start conditions
1. **Part 3a is committed `0f2b83490`** (find it in `BOARD_READY_PLAN.md` §5 Stage 6). If it is not there, stop and tell the owner.
2. **The deal page's Part 3a screens are NOT in that commit.** Another session was mid-edit on the same screens (the
   deal "record page" work), so the owner ruled: commit everything else, hold back `components/admin/kit/club/sponsorships/DealScreen.tsx`,
   `DealPaymentWindows.tsx` (new, untracked) and `Sponsorships.module.css` until that session lands. Those three carry the Record a payment
   button, the Payments card with Void, the PDF link on the invoice number, the revised-invoice notice and the money band's
   real figures. **Before building anything on the deal page, check whether they are committed** (`git log --oneline -3 -- components/admin/kit/club/sponsorships/DealScreen.tsx`).
   If not, ask the owner whether to finish landing them first (they hold Part 3a's working UI, tested by the probe and the walk).
   The committed words keep `errInvoicedChange` and an optional `emailed` argument on `callout.invoiced` only so the older deal page still
   compiles; once the held-back files land, both can be retired.
3. Owed on Part 3a's side, not yours: the owner's walk **§562** (46 steps, the eight owner calls on the page), and Part 2's walk **§561**.

## The task
Read and follow `BOARD_READY_STAGE6_SPONSORSHIPS_BUILD_PROMPT.md` — Part 3's card flow — and the plan's **"Part 3's four owner calls"** (2026-11-23):
- **Card stays on an invoiced deal's link, at the invoice total, and the club pays the fee on that payment** (a Payment
  processing cost, whichever way the Payouts row is set), so both drawn sentences hold: "Their link still lets them pay by
  card" and "An invoice already issued never gains a fee line afterwards". Nothing in 3a builds card.
- **Card refunds are drawn before they are built** — a small drawing first (the shipped refund window, whole or part, never
  the fee; the deal after a full and after a part refund). Use `/design`; the drawing is the owner's to rule before code.
- The card flow runs on the existing online-payments rail. **Said out loud from the code:** six guarded payment functions send any flow
  that isn't a house-league sign-up down the tournament-team path, so a new flow changes each; and **card can't serve
  production until Club Tier Stage 12** (production's online payments). Give it its own `/review` and its own walk.
- A card payment **lands as a payment** on the deal: use the same `club_sponsor_deal_payments` table and the same two ledger lines
  (Club sponsorship, GST/HST collected), with the method `card`. Mig 528's `club_sponsor_deal_pay` is the model; check how it
  takes a method, a reference and the actor, and whether the card landing needs its own function (a service-role landing with no
  signed-in actor). The money guard trigger already allows only these functions to move a deal's money.
- "Send the invoice" (the club's own button) and the refund-policy link beside the card button (owed from `/legal`) belong here.
- After a card payment completes: Paid, the logo goes up, and **the receipt email goes** — `emailDealInvoice(orgId, slug, dealId, 'paid')`
  re-sends if called twice, so call it once, from the landing path, as the manual route does, and never let it fail the money step.

## What 3a left that 3b should know
- **Open owner calls (on the §562 walk page):** who may Record/Void (Sponsorships alone, or also Accounting); the Months row carrying GST/HST collected (one row or two);
  a withdrawn deal's PDF; a link-only deal that promises an email the club can't send; "GST/HST invoiced, not yet paid"; keeping the original figures of a revised invoice;
  a logo after paying; a "GST/HST remitted" word. `/accounting` also flagged: an old taxed invoice reprints without the club's GST/HST number if the club un-registers.
  Several are dev-only migration 528 amendments (still possible: 528 is applied only to dev).
- **Migrations 526, 527 and 528 are dev-only** and go on production before the promote that carries Part 2/3.
- The legal notes: the invoice, revised invoice and receipt emails are most likely not CEMs (no unsubscribe) **only while no promotion is added** — never add
  "sponsor again next year" to them. The Payments Terms owe a sponsorship-card section with 3b.
- Probes: `.probe/stage6-p3a-money-probe.mjs` (ALL PASSED at close-out) is the pattern for a card probe; the UAT Rep Club fixtures for the walk are set (see §562).

## Steps, in the 3a order
Drawing (refunds) → owner UX summary and open calls → build → `/simplify` → `/review` → `/marketing` → `/ux` at 390 → `/docs` → `/legal` (card sponsorship, the
refund-policy link, Payments Terms) → `/accounting` (the processing fee's tax, the club paying it) → probe → the QA walk (a checkable Artifact, 20–50 boxes,
exact logins) → the commit at the owner's yes only (branch `dev`, explicit pathspecs, partial files through a private index, **a clean-checkout typecheck before
the CAS update** — it caught a real break in 3a — and no Co-Authored-By footer).
