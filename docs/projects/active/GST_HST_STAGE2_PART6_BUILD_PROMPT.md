# GST/HST · Stage 2 Part 6: the Stripe test matrix (build prompt)

> Written 2026-11-05. Parent: [GST_HST_STAGE2_BUILD_PROMPT.md](GST_HST_STAGE2_BUILD_PROMPT.md) — read its ▶ Progress block first
> (Parts 0–5 and 2b are committed; Part 5's guard is `tests/unit/billing-location-every-path-guard.test.ts`). The part's spec is the
> parent's "Part 6 · The test matrix". Recommended model: Opus (money: judging whether a Stripe answer is a defect is the work).
> Mark each fact you rely on [V] (verified by you this session, with file:line or a probe output file) or [H] (handed to you).
> Everything below is [H] unless marked **[V 2026-11-05]**; line numbers drift — grep, do not trust them.

## What this part is

Proof, in Stripe **test mode**, that every paid step charges the tax it quoted, for every Canadian tax group, a US buyer and a
flagged buyer. No product change. Throwaway scripts in `.probe/gst2/` (they refuse any key that is not `sk_test_`, like
`.probe/gst2/account-taxid.mjs`), each run saved beside it as `*-run1.txt`, and one table recorded in the parent's Progress block.

## ⚠ Your FIRST message: the owner's steps, as a numbered list (owner 2026-11-05, binding for this part)

Before any probe runs, read what is already true (by API, not by asking), then give the owner **one numbered list of exactly what
they must do**, in order, written for a product owner. Each step says: where to click (click by click, Stripe's own labels as you
read them now — do not trust the paths below, Stripe renames its menus), what to type or choose, what they should see when it
worked, and what to tell you back. Say for each one whether the matrix **waits on it** or not. Never ask the owner for something a
script can read or do; never put our GST/HST number, a key, or a card number other than Stripe's public test cards in the repo or
in a chat message you write.

The list, as known on 2026-11-05 — verify each before you list it, drop what is already done, add what you find:
1. **Our GST/HST number on TEST-mode invoices — the matrix waits on it.** Read 2026-11-05: the test account has no account tax ID
   (`.probe/gst2/account-taxid.mjs`). Stripe Dashboard, test mode on → Settings → Billing → Invoices (template) → Tax ID → add the
   Canadian GST/HST number → set it as the default. After the owner says done, re-run the probe and confirm it reads one `ca_gst_hst`
   and the invoice default is set. (Accounting review 6a: every invoice and credit note of $100 or more must show it.)
2. **The test-mode Canada registration** — Part 0 added it by script (`.probe/gst2/add-sandbox-registration.mjs`). Read it by API;
   list it as an owner step ONLY if it is missing or its start date is not 2026-09-26.
3. **Paying Stripe's own Checkout page, where a script cannot.** A hosted Checkout page needs a person. Script everything up to
   the page and after it; hand the owner the few session links in one batch (say which province each is for), with Stripe's
   public test card `4242 4242 4242 4242`, any future date, any CVC. On the ONE row that tests a buyer's own number, tell them
   to enter Stripe's test GST/HST number format on the page (read the accepted format from Stripe's docs and give it). Keep the
   batch small: one club and one coach checkout per tax group is the most this needs; fewer if a script can prove the rest.
4. **A look at two invoice PDFs (does not gate the matrix):** a script can read `account_tax_ids` and the customer name on an
   invoice, but not that they print. Give the owner two links (a yearly club invoice over $500 and a credit note) and ask:
   "is our GST/HST number on it, and the buyer's name?"
5. **The owner check from the `/accounting` review (not a decision, does not gate the matrix):** does Stripe charge GST/HST on its
   own fees to our account? Where to look: the live Dashboard → Settings → Documents (tax invoices). It decides our input tax credit
   and the "net of Stripe's tax" base for recovered fees. Record the answer in the parent's Progress block if given.

End the list with one line: what you will do as soon as step 1 (and 3, when you reach it) is done.

## ⚠ Correct before you build on it (disagree out loud)

- The parent's Part 6 paragraph said **"NS (Atlantic 15%)"** (corrected there 2026-11-05 when this prompt was written): Nova
  Scotia's HST is **14% since 2025-04-01** (`/accounting` review item 5, already confirmed). Expected rates for our ONE registration (federal
  GST/HST): ON 13% · NS 14% · NB, NL, PE 15% · AB, BC, SK, MB, QC and the territories 5%. Provincial taxes (BC PST, SK PST, MB RST,
  QST) are **Stage 7, out of scope**: a 5% row that shows only GST is correct, not a defect. Read each rate from Stripe's answer;
  if one differs from this list, check the CRA rate before calling it a defect.

## The matrix

**Buyers** (one throwaway test customer per row, metadata `gst2_part6: true`, deleted at the end): ON, NS, NB/NL/PE (one), AB or a
territory, BC, SK, MB, QC; a **US** buyer; a **flagged** buyer (Ask 1: a US address whose card or payout points at Canada is HELD,
no paid step; a flagged Canadian address is taxed by its address); and a **club with its own GST/HST number** (the tax stays on).
Read dev's US-sales switch first: if US sales are closed, the US row's expected answer is "refused by the address check", not "0 tax".

**Paths** (the parent's Part 0 list, A–E, plus the fee and refund rows):
- A · new club checkout · B · new coach (Premium) checkout · C · the Founding next-season choice (no charge at creation; its first
  charge on a test clock)
- Premium → Club in place (the club address stamped first, Ask 2) · a move up with its preview and the press-time check (D2) ·
  E · a move down: the renewal it schedules (test clock)
- a renewal of a taxed subscription (test clock)
- a recovered fee riding a subscription invoice, and the club's own monthly fee invoice; **plus the 2026-11-05 safety net:** a
  subscription with tax OFF (made the pre-Stage-2 way) must send that club's fees to its own taxed invoice, never onto the
  subscription's (`subscriptionToRide`)
- a refund and a credit note — **including platform admin's refund** (`lib/console-money-stripe.ts` `refunds.create`), which the
  Part 5 review found makes no credit note (accounting 6c says a refund of a taxed invoice goes through one). Test and record what it
  does; a fix is a `/plan` item, not this part's.

Not every path × buyer cell is worth a run. Every path runs for ON; every buyer group runs through at least A and a move up; the
GST/HST-number buyer runs A; US and flagged run A and a move up. Say in the table which cells you skipped and why.

**For each run, record:** the quoted figure (our preview, through OUR code where it exists: `previewUp`, the workspace upgrade
preview) equals the charged figure to the cent; the invoice names its tax ("HST 13%"); `automatic_tax.status` is `complete`; our
GST/HST number is on the invoice or credit note (after owner step 1); the buyer's name is on any invoice of $500 or more (6b).
Prefer calling our own builders (`buildNextSeasonCheckoutParams`, `previewUp`, `applyMove`) over retyping their parameters — a
matrix that retypes them tests the script, not the product. Where a builder needs database rows, use a throwaway org on **DEV**
and delete it after. Never production, never a live key.

## When the matrix finds something

A cell where the quote and the charge differ, the tax is missing, the rate is wrong, or the number does not print is a **money
defect**: stop that row, record it with the probe output, and report it to the owner with a recommendation. Do not fix product code
in this part without the owner's yes in this conversation. A defect in the probe itself is yours to fix.

## Out of scope (do not build, do not "just add")

Any change to what a buyer sees or is charged; provincial registrations and their taxes (Stage 7); US tax (Stage 8); the per-charge
tax record (Stage 3); the walk (Part 7 has the ONE Stage 2 walk); the refund-without-credit-note fix (`/plan`).

## Closeout

1. Clean up: delete every `gst2_part6` test customer, subscription, test clock and dev org the scripts made, and say so.
2. Records: the matrix table + skipped cells + any defect in the parent's Progress block; the plan's Stage 2
   status line; the TODO line (one line). Record the owner's answers to steps 4 and 5 if given. Mark nothing "owed" you did not verify.
3. No `/docs`, no `/marketing`, no walk. `/review` only if product code changed (it should not have).
4. Do not push. Ask before committing. Stage explicit pathspecs only.

## What comes next

Part 7 (closeout: the revenue-readiness audit re-run, `/accounting` again, `/simplify` + `/review`, `/docs`, the ONE Stage 2 walk).
