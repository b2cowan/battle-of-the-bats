# Club Tier Readiness, Stage 12d: draw "hardening" (prompt)

> **Written 2026-10-26**, after walks §389 and §390 (12c). **Paste this into a new Opus chat on `dev`.** Other sessions share this working
> copy (TODO, the Stage 12 plan, the PM brief and the Club Tier index carry their edits): stage explicit paths only, and commit only your
> own hunks.
>
> **This is a drawing session, not a build.** No product code, migration, seed, help article or demo change.

## What this is, and what the census corrected

The Stage 12 plan's 12d row lists eight items. A code census on 2026-10-26 (a helper read the code, and the lead opened the lines marked
✔; **re-verify the rest yourself before drawing on them**) found the real gap is smaller and different:

| 12d item as the plan lists it | What the code actually does today | So the drawing is |
|---|---|---|
| Card disputes | `charge.dispute.created` is routed to `reverseDebit` (`lib/online-payment-landing.ts:358`), which returns silently for anything that is not a bank debit ✔. **A card dispute is ignored, not errored:** no notice, no email, nothing recorded; the event is logged as processed. The dispute's later events (updated, closed, funds withdrawn, funds reinstated) are not handled at all; `online_payments` has no dispute state. | **Draw it. This is the biggest real gap.** Stripe takes the money back at once; the club cannot see it in the product. |
| Paid twice | House league: a second payment for an already-paid child is refused by the writer (`already_received`), the payment stays PAID, and the item `online_payment_not_recorded` is raised with the refund door, **but its label is generic**. Open-payment unique indexes and idempotent landing already stop a double press. Team: **not confirmed** — no "team already paid in full" check was found in `online_payment_land`; the writer's only amount check seen was 0 to 1,000,000. | Draw the clear "paid twice" item for both flows. **First read `online_payment_land` and `tournament_team_payment_record` and state what really happens to an overpaid team; if an overpayment books silently, that is a finding to put at the top of the page.** |
| Terms checkbox | **Already built** ✔: the "Before you set up payouts" window has the agree box, the button is disabled until ticked, the server refuses without it and stores version, who and when (`app/api/admin/payouts/route.ts:146`). Missing: counsel's real text (a placeholder, `TERMS_PLACEHOLDER`, shows today ✔) and any read-out of who agreed. | Draw only the read-out and the "new version, agree again" state. Leave the text slot marked counsel's. |
| Payouts list | Absent. Nothing reads Stripe payouts or balance transactions. The Payouts card shows state, rate, who pays the fee, the refund policy, and an "Open Stripe" door. | Draw it. |
| Offboarding | Disconnect only stamps `disconnected_at`; its window counts tournament teams still owing (draft or active) and debits clearing, **not unpaid house-league sign-ups**. Debits still clearing finish after a disconnect and the money still reaches the club. Downgrade, cancel and the organization-deletion request say nothing about payments, and the account stays connected and keeps landing money (the plan gate only hides the card and the pay routes). | Draw it. |
| Platform-admin oversight | Nothing in the console reads online payments, payments accounts or `stripe_connect_events` (which has an error column nobody reads). One read: the console's find box looks up a pasted `ch_` or `pi_` number. | Draw one Payments tab. Check Stage 5's drawings first (see Read first). |
| GST/HST, international cards, negative balance | Absent. | **Decision pages, below. These need the owner.** |

## Settled — do not reopen (record as ruled; add nothing)

- Direct charges on the club's own Stripe Express account; **FieldLogicHQ never holds the funds** (2026-07-28).
- **Stripe covers a club's losses** (`losses_collector: 'stripe'`) and **FieldLogicHQ pays Stripe's fees** (`fees_collector: 'application'`) — `lib/stripe-connect.ts:46` ✔.
  So a negative balance on a club's account is Stripe's loss, not ours; what lands on FieldLogicHQ is Stripe's per-event **fees** (a
  dispute fee, a failed-debit fee). **Correct this on the page if any plan text says "the platform carries losses."**
- A returned or reversed **bank debit's CA$5** is the club's, billed as a line on its next FieldLogicHQ invoice; free and comped clubs are
  not billed (`RETURNED_BANK_DEBIT_FEE_CENTS`, §0k answer 2). The card dispute fee is **not** ruled — that is an ask below.
- The family pays the processing fee by default and the club may choose to pay it (A14). The fee is the application fee: the whole
  all-in fee, FieldLogicHQ pays Stripe out of it. **Rates are in `lib/plan-config.ts` and the Facts doc: never type one.**
- Treasurer logs the accounting and never refunds (§0f). A registration's payment state is a fact on the payment, never a status.
- Counsel's gate: online payments are off in production until counsel signs off (plan §3, §6).

## Read first

`AGENTS.md`, `AGENCY_RULES.md`, `CLAUDE.md` (broad reading goes to a helper; a helper's summary is a lead, open the cited lines
yourself; disagree out loud). The Stage 12 plan `docs/projects/active/CLUB_TIER_STAGE12_PAYMENTS_PLAN.md` **§0 state, §0k, §3, §4 (the
12d row) and §6**, its PM brief, `docs/agents/ops/stripe-setup-guide.md`, `CLUB_TIER_STAGE12C_BUILD_PROMPT.md` (what 12c built, so you
do not redraw it), and for the pattern the last round: `CLUB_TIER_STAGE12C_PARTREFUND_BANKDEBIT_DRAWINGS.html` (hand-written; its kit
CSS is spliced from the refund page's first `<style>` block) and the Stage 12 drawings
https://claude.ai/artifact/X7quYgnDpiWV9Dh76TYm57. For frame 6: `docs/projects/active/PLATFORM_ADMIN_SUPPORT_CONSOLE_STAGE5_DRAWINGS.html`
(grep "online payment" and "payouts" — if it already owns a home for this, draw only the delta and say so) and
`app/platform-admin/orgs/[id]/` for the tab pattern. House UI rulings (auto-memory index): mockups are Claude Artifacts at true size,
whole-screen before/after, never the blank design canvas; every highlight is clickable; money figures are one joined band; a waiting
count is the amber pill; a window's foot is sentence left, buttons right; a pay button's label is ONE row; absent beats disabled; one
spelling; "8:00 a.m."; the bare possessive. **Verify Stripe facts against Stripe's current docs, not memory** (the dashboard and API
knowledge was stale twice in 12a).

## Push back (out loud, on the drawings page, before the work)

1. **Is a payouts list worth building when Stripe's own dashboard has one?** Stripe cannot name the child or team, or our receipt
   number. Recommend yes, collapsed by default and quiet (the current season stays the primary focus), with an export; say what a club
   loses if you say no. Draw it small beside the Stripe door.
2. **Do not build a dispute workflow we cannot finish.** The club answers a dispute in Stripe's own Express dashboard with evidence. We
   show it, hold the line, and link out. Recommend that nothing in the product submits evidence. Say what it would cost to do more.
3. **When does a card dispute change the book?** Recommend: the book line **stays** while the dispute is open, a **lost** dispute writes
   a returned line beside the receipt exactly like 12c's reversed debit, a **won** one returns to plain paid. Draw the alternative
   (take it off the book at once) small, with the reason you reject it (the money can come back).
4. **What a downgrade does.** Recommend one rule: online payments stop being offered; clearing debits, open refunds and disputes still
   finish; the owner is told what is outstanding. Disconnecting is not a side effect of billing.

## What to produce

1. **One published Artifact** (source `docs/projects/active/CLUB_TIER_STAGE12D_DRAWINGS.html`; load `artifact-design` first and call the
   Artifact tool's quickstart before writing). Before = today's screen; after = **true size**, desktop and phone; NEW / RESTYLED /
   UNCHANGED tags; clickable flags; one checkbox per option for each ask; a paste-back summary at the end. The first tab carries a short
   plain-language "What the census corrected" box (the table above, trimmed).
2. **Frames (draw each in its empty, working and edge states):**
   1. **A card dispute** — the registration's Fee cell and record window, the Needs-attention item for whoever may refund plus the owner,
      the won and lost outcomes, the evidence due date, "Answer in Stripe" door, who is and is not told (recommend: the family is not
      emailed by us), the money held figure. Show the fee case: what the dispute costs FieldLogicHQ (Ask A1).
   2. **Paid twice** — the item with a plain label, the refund-the-extra door, house league and team. Open with the team finding.
   3. **The payouts list** — a collapsed section on the Payouts card; each Stripe payout (date, amount, status, arrival) expanding to the
      payments inside it by child or team name and receipt number, so a bank-statement line can be matched; Export; "Open Stripe" stays.
   4. **Offboarding** — (a) the Disconnect window also counting unpaid house-league sign-ups; (b) the downgrade, cancel and
      organization-deletion confirmations each saying plainly what happens to a connected account, to money still clearing and to
      unpaid registrations.
   5. **Terms** — the read-out ("Agreed by … on …, version …") on the Payouts card; the "terms changed, agree again" state; counsel's
      text slot marked. Ask: does a new version block new connects only, with a notice for existing clubs (recommend), or block payments?
   6. **Platform-admin Payments tab** — account state, terms agreed by and when, payments clearing, open disputes, failed or
      unprocessed Stripe events, disconnected or closed accounts. Read-only; any write would need a `PLATFORM_POWERS` entry (recommend
      none).
3. **Three DECISION PAGES (not build commitments).** Each is one page that makes the owner's answer map to a screen, drawn so the
   choice is concrete. Each ends with **"What I need from you"**, written as a short checklist.

   **D1 · GST/HST on the processing fee — the owner needs the accountant.** The page states the question in plain language, then
   draws the three outcomes on the family's pay button and receipt, the club's Payouts card rate line, and the "Before you set up
   payouts" window:
   - **(a) No tax on the fee** (the fee is not taxable, or FieldLogicHQ is under the small-supplier line): nothing changes.
   - **(b) "+ GST/HST" on top:** the family's total rises by tax, the pay button shows it before paying, the receipt shows a tax line and
     our registration number. The rate depends on where the supply is made (the club's province or the family's) — draw one Ontario
     example and name that Quebec adds its own tax. **Ask the owner which province the accountant treats as the place of supply.**
   - **(c) Tax inside the fee:** the family sees no tax; FieldLogicHQ remits a share of what it keeps. **Show the margin effect
     computed from `lib/plan-config.ts` today.** The scoping plan's illustration (about −$2.40 on an $800 card fee) was at the old 3.25%
     rate, before the rate-differentiated pricing ruled on 2026-07-28; recompute it, do not quote it.

   The page must hand the owner **this accountant sheet, ready to forward** (these are questions, not conclusions; do not assert tax law):
   1. Is FieldLogicHQ registered for GST/HST today, or under the small-supplier threshold? (Owner knows or can check; nothing in the
      repo says whether FieldLogicHQ collects tax on its own subscriptions.)
   2. Is the processing fee FieldLogicHQ takes (a percentage plus a flat part, deducted as Stripe's application fee on a club's payment)
      a taxable supply of FieldLogicHQ's, or an exempt financial service? And **who is the customer** for it: the club (the merchant) or
      the family who pays it? (The scoping plan's reading was "likely taxable", unconfirmed.)
   3. If taxable: do we charge tax **on top** of the fee, or is the fee **tax-inclusive** and we remit a share? Which province's rate applies
      when a family in one province pays a club in another? How does Quebec's QST apply?
   4. What must the receipt show? The receipt is in the **club's** name, the fee is **ours**: who issues the tax line, and does our
      registration number go on it?
   5. When the **club** pays the fee (A14, it comes out of each payout) and when we bill a returned-debit fee on the club's next invoice
      (the CA$5 line): is each of those a taxable supply to the club, and does the tax go on that invoice?
   6. Does Stripe charge GST/HST on the fees it bills FieldLogicHQ, and can FieldLogicHQ claim those input credits? It changes the net.

   **D2 · International cards — the owner decides the policy; `/billing` and `/strategy` own the number.** A US team at a cross-border
   tournament pays by a card issued outside Canada; Stripe charges an extra percentage on that card and FieldLogicHQ pays Stripe out
   of the fee, so the margin on that payment can go negative (the scoping plan's illustration was about −$5.70 on an $800 card fee at the
   old rate; recompute from `lib/plan-config.ts`, and look up Stripe's current extra percentage in Stripe's docs). Draw three policies
   on the pay block: **(a) absorb it** and watch it (recommend to start, with a count of how often it happens); **(b) charge more for a
   foreign card** — check in Stripe's docs whether a surcharge can be applied after the card is entered (the fee is shown before) and
   say what the family sees; **(c) refuse foreign cards** and offer bank debit or another way — check what Stripe lets a platform
   restrict, and what the family sees when refused. **End with:** pick one; and the card-surcharge counsel question already owed
   (a card-only family fee may be a surcharge under the card networks' Canadian rules, which club-pays avoids).

   **D3 · Negative balance and disputes' cost — a question about money, not a screen.** State plainly what the code does (Stripe covers
   losses; FieldLogicHQ pays Stripe's fees) and what that means in a bad month: **a dispute costs FieldLogicHQ a Stripe dispute fee
   whether or not it is later won (check Stripe's current docs for whether a won dispute returns it); a club whose balance is
   negative is Stripe's problem, but a club that disconnects with open disputes leaves us the fees.** Ask A1 below is the decision.

4. **Words:** provisional, marked provisional. Final words go through `/marketing` after the owner rules, before any code (sentence case,
   "8:00 a.m.", the bare possessive, `npm run check:spelling`).
5. **Flow + design:** run `/ux` on the journeys (the registrar who finds a child's payment disputed; the owner who downgrades with a
   debit clearing; the treasurer matching a payout to the bank) and `/design` on the whole page **before the hand-off**; apply fixes,
   republish, report what it changed.
6. **Asks:** numbered, each with a recommendation, answerable by number. **Must include:**
   **A1** who bears a card dispute's Stripe fee (recommend the returned-debit rule: billed on the club's next invoice, free and comped
   clubs exempt, the amount taken from Stripe's own figure at the time, never typed; and ask whether a won dispute's refunded fee is
   returned to the club) · **A2** is the family told of a dispute (recommend: no) · **A3** where the book stands during a dispute
   (push-back 3) · **A4** the downgrade rule (push-back 4) · **A5** payouts list yes/no (push-back 1) · **A6** terms re-agree rule ·
   **A7** whether the platform-admin Payments tab is read-only (recommend yes) · **A8** the GST/HST outcome (a, b or c — waits for
   the accountant) · **A9** the international-card policy (a, b or c) · **A10** does a payment above what a team owes get refused at
   landing or booked and flagged (only if the team finding shows a gap).
7. **Records, same unit of work:** plan gets a "12d drawn, asks open" paragraph with the link; the 12d row of §4 is corrected from the
   census table above (terms, paid twice and card-dispute facts); `TODO.md` (the one Stage 12 line only); a PM brief line (what a
   registrar, a club owner and the platform team see differently); the Club Tier index `s12` stage (read `stages` first, pin
   `if_version`; state `ruled` only after the owner rules); the Stage 12 auto-memory file. Record rulings as ruled and add nothing the
   owner did not rule.

## Do not

- Build, migrate, seed, or touch Stripe, AWS or DNS. Do not enable Connect webhook events.
- Reopen §0f, A14, the CA$5 returned-debit rule, or direct charges.
- Redraw anything 12a–12c built (refund visibility, part refund, bank debit, the desk, the family record).
- Assert tax law or Stripe policy from memory. The accountant sheet is questions; Stripe facts come from Stripe's current docs.
- Restate a plan name, price, rate or gate: point at `PLAN_PRICING_FACTS.md` and `lib/plan-config.ts`. A figure in a drawing is computed
  from there, never typed.
- Promise timing anywhere.

## Definition of done

The drawings page is published and linked from the plan; `/ux` and `/design` have run and their changes are reported; every frame in item
2 is drawn in its empty, working and edge states; the team-overpayment question is answered from the code and put first on the page;
D1 hands the owner a forwardable accountant sheet and a concrete picture of each outcome; D2 and D3 each end in a plain "what I need from
you"; ask 1 and the others carry a recommendation; the records say "drawn, asks open"; and a 12d build prompt can be written from the
owner's answers without re-deciding anything.
