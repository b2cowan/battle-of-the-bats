# Board Ready Stage 6 · Part 3b — finish (review chain → probe → walk → commit)

Paste into a fresh session: **"Read and follow docs/projects/active/BOARD_READY_STAGE6_P3B_FINISH_PROMPT.md"**

Written 2026-11-23 by the session that built Part 3b (the sponsorship card payment, its books, refunds, "Send the invoice",
the refund-policy link, the credit note). The code is built and **uncommitted**; migration **530 is applied to dev** (owner:
"apply 530 to dev", twice, read back, snapshots refreshed). Production is pending in `MANUAL_PROD_STEPS.json`.
The record of what was ruled and built: `BOARD_READY_PLAN.md` §5 Stage 6, the bullets "Part 3b · the deal page landed
`d07a050fe`…" and "Part 3b code built 2026-11-23".

## ⛔ Start conditions
1. `git rev-parse --abbrev-ref HEAD` is `dev`. `git log --oneline -5` — check whether anyone has committed Part 3b's files since
   (they would show in `git log -3 -- lib/online-payment-landing.ts components/admin/kit/club/sponsorships/DealPaymentWindows.tsx`).
2. Migration 530 is on dev: `node scripts/db-query.mjs --dev -q "select pg_get_constraintdef(oid) from pg_constraint where conname='online_payments_flow_chk'"`
   names `sponsorship`. If not, stop and ask the owner (dev applies need his word).
3. Typecheck clean (`NODE_OPTIONS=--max-old-space-size=8192 npx tsc --noEmit -p .`) and
   `node --import ./tests/ts-resolver.mjs --test tests/unit/board-ready-stage6-p3b.test.ts tests/unit/board-ready-stage6-p3a.test.ts tests/unit/board-ready-stage6-deals.test.ts tests/unit/online-payments-guard.test.ts`
   passes (110/110 at hand-off). Run tests from the REPO ROOT (they read files by path).

## Updates since this was written (2026-11-24, checked against git and the release record)
- **Still uncommitted, still pending on production.** `git log -3` on the landing and window files shows only Part 3a
  (`d07a050fe`); migration 530 is `"prod": "pending"` in `MANUAL_PROD_STEPS.json`. The 2026-11-23 evening promote (job 294,
  `3077c31e7`) shipped Parts 2 and 3a and held 530 on purpose, so **the drift check stays red on dev until 530 reaches production** —
  expected, not a defect. 530 goes to production BEFORE any promote that carries this code (the deal page reads the refunds table).
- **The "card can't serve production" line is out of date.** `6e361818b` (live payments allowed, owner 2026-11-23) is on master:
  a standard live Stripe key can now open payments once `ONLINE_PAYMENTS_ENABLED` is set to `true`; until then every door stays
  shut. Part 3b's card shares that one switch. So the `/legal` and `/accounting` steps are not theoretical: the day the owner
  flips the switch, a sponsor can pay by card on a real club's page.
- **The Payments Terms are now PUBLISHED** (version label `2026-11-24`). The sponsorship-card section owed with 3b is therefore a
  NEW Terms version, not a draft edit: `/legal` decides the version label, whether anyone is re-asked (`oldestAccepted`), and
  whether the change reduces anyone's rights (notice email). Never rename a served version.
- **The Part 3b files include tracked files other sessions also touch** (the git status shows `DealsList.tsx`,
  `Sponsorships.module.css`, the sponsorship routes and `lib/club-sponsorship-*`). Use the private-index method below; do not
  assume every modified sponsorship file is Part 3b's.

- **Where the steps stood, checked 2026-11-24 (a later session; this list was written before any of it ran).** Done: `/accounting`
  (the Part 3b addendum in `CLUB_SPONSOR_INVOICE_REVIEW.md`), `/legal` (`BOARD_READY_STAGE6_PART3B_CARD_REVIEW.md` and the draft
  Terms addendum), `/docs` (the sponsorships help article), the probe (4 runs, all checks passed) and the walk (§564 published
  2026-11-23). Run 2026-11-24: **`/simplify`** (applied; the larger duplications are named in the session record, not done) and
  **`/review`** (five lenses; five fixes applied and pinned in `board-ready-stage6-p3b.test.ts`). **Not yet run: `/marketing`
  on the DRAFT words and `/ux` at 390.** Owner, 2026-11-24: every other review finding is to be fixed AFTER he finishes walk §564:
  see **`BOARD_READY_STAGE6_P3B_AFTER_WALK_FIXES_PROMPT.md`** (the list, its order and which items need his word for a database
  change). The commit waits for those fixes and his yes.

## What was ruled (all binding)
- **Part 3's four owner calls (2026-11-23):** card stays on an invoiced deal's link at the invoice total and the CLUB pays the
  fee on that payment ("an invoice already issued never gains a fee line"); before any invoice the fee follows the Payouts
  card's "Processing fee on sponsorships" row; refunds drawn before built; card can't serve production until Club Tier Stage 12.
- **The card-refund drawing, RULED 2026-11-23, all seven as recommended** (https://claude.ai/artifact/RSMZkJKM2JHZkLwH2bg7Z5,
  source `BOARD_READY_STAGE6_P3B_CARD_REFUNDS_DRAWING.html`, untracked — commit it with the work): (1) a payment opens its own
  window, Refund (card) / Void (cheque, e-transfer) at its foot, the inline Void retired; (2) the refund window as drawn —
  nothing picked, All of it / Part of it, a reason for both, never a fee box; (3) a full refund ends the deal as Withdrawn;
  (4) a fourth "Refunded" figure; (5) who refunds = who records and voids (Sponsorships, per walk §562); (6) the shipped refund
  email, and the business's page lists the refund; (7) the invoice lists the refund.
- **/accounting answered ask 7 (2026-11-23):** a refund on a taxed invoice needs a **credit note** (CRA Memo 12.2 ¶15–23; SOR/91-44
  s.3) — built as its own PDF per refund ("{invoice}-C{n}"), the invoice still lists the refund. Refund lines reverse the
  sponsorship and GST/HST in proportion; the fee lines never move; the fee's HST is never refunded. A professional's eye (no
  gate): a combined invoice/credit document, a passed-on fee's taxability, a refund after a filed period. /accounting offered
  a short Part 3b addendum to `docs/agents/accounting/CLUB_SPONSOR_INVOICE_REVIEW.md` — write it in the /accounting step.

## What was built (read the code; this is a map, not evidence)
- **Migration 530** (`supabase/migrations/530_a_sponsor_pays_by_card.sql`): the third online-payments flow `sponsorship`
  (`sponsor_deal_id`, `sponsor_fee_tax`, `sponsor_invoice`; flow + shape CHECKs; one open page per deal; the guard's arm); the
  deal's `card_fee` / `card_fee_tax`; card columns on `club_sponsor_deal_payments`; the new `club_sponsor_deal_refunds`; the
  platform item Sponsorship › Payment processing (fixed id `5b0d0530-…0001`); `club_sponsor_card_land`, `club_sponsor_deal_issue`
  (Send the invoice), `club_sponsor_card_refund_open/_book/_failed`, helpers; `online_payment_cost_out` and
  `online_payment_lock_for_cost` answer a sponsorship; `club_sponsor_deal_payment_void` refuses a card payment.
- **The landing** (`lib/online-payment-landing.ts`, the one module allowed to call these RPCs — `LAND_RPCS` in the guard test):
  `landSponsorship`, `afterSponsorLanding` (place sync + the receipt, claimed once), `refundSponsorCard`, `settleSponsorRefund`,
  `applySponsorRefundEvent`, `raiseSponsorRefundFailed`, `sponsorshipPeople`. Sponsorship is answered BEFORE every
  tournament-only path (landing, replay, dispute, refund event) — a test holds the order.
- **Opening the card page:** `lib/sponsor-card-server.ts` (`sponsorCardFacts`, `openSponsorCheckout`, `closeSponsorCheckout`);
  the fee `sponsorCardFee` in `lib/online-payment-fee.ts`.
- **Routes:** public `POST /api/public/sponsorship/[token]` takes `payMethod: 'card'`; `…/[token]/pay` (POST an invoiced deal by
  card; GET the confirming status); `…/[token]/credit-note/[refundId]`; admin `…/deals/[dealId]/payments/[paymentId]/refund`,
  `…/deals/[dealId]/send-invoice`, `…/deals/[dealId]/refunds/[refundId]/credit-note`; the deal GET returns `refunds`,
  `cardAttempt`, `cardRefundsOn`.
- **Screens:** `DealPaymentWindows.tsx` (`DealPayments` rows as doors, `PaymentWindow`, `RefundWindow`), `DealScreen.tsx` (the
  fourth figure, the refunded callout, Send the invoice, the windows), `DealsList.tsx` ("Withdrawn · refunded"),
  `SponsorDealContent.tsx` (two pay buttons, the fee note, the refund policy, confirming / not finished, the receipt's card line,
  fee row, refunds and credit notes; "Pay $X by card" on an invoice).
- **Paper and email:** `lib/club-sponsor-invoice.ts` (card facts, refund helpers, the fee row, refunds on the invoice,
  `creditNoteLayout`), `lib/export/pdf.ts` (the page takes `refunds` and `credit`), `lib/club-sponsor-invoice-pdf.ts`
  (`dealCreditNotePdf`), `lib/sponsor-invoice-email.ts` (`emailDealRefund`, kind `club_sponsorship_refund` in `lib/email-kinds.ts`).
- **Books:** `isFeeRefund` nets a sponsorship refund line against Club sponsorship; `CLUB_ONLY_ITEM_IDS` holds the new item.
- **Words:** `DEAL_WORDS.card` in `lib/club-sponsorship-deal-words.ts` — most are **DRAFT** for `/marketing`.
- **Retired:** `errInvoicedChange`, and `callout.invoiced`'s `emailed` argument is now required.

## Said out loud from the code (review these first; the owner has been told the first two)
1. A sponsor's card **dispute** is answered in Stripe and leaves the deal unchanged (`applyCardDispute` returns early for a
   sponsorship: the dispute writer would put the money back on a team). No notice is raised in the product.
2. A refund made in the club's own **Stripe dashboard** on a sponsorship is not booked; Sponsorships gets a
   `card_refund_unmatched` notice to record it in the Ledger.
3. The `card_refund_failed` notice uses `onlinePaymentId` as its subject, so its resolver waits until the online payment is fully
   `refunded` — after a part refund that came back, it may never clear. Check `lib/needs-attention.ts` `cardRefundFailed`.
4. A refund is BOOKED only when Stripe says `succeeded`; a pending one waits for the `refund.updated` event
   (`applySponsorRefundEvent`). A refund that succeeded and later failed voids its two lines and leaves an ended deal ended.
5. A card landing on a deal that can't take it (withdrawn, invoiced another way, owing less) raises "not recorded" and the money
   sits in Stripe. Send the invoice closes an open card page first to make the double-pay race rare, not impossible.
6. The refund route reads `refundLeft` client-side for the 400; the database caps it again (`club_sponsor_card_refund_open`).
7. `online_payments.fee_payer` keeps the rail's words: `family` = the payer (the sponsor) pays.
8. The page never names Stripe (build prompt); the round 1 drawing's "Your card is handled by Stripe" was left out on purpose.

## Steps, in the 3a order (each one's findings applied before the next)
1. **`/simplify`** on the diff (new abstraction: the third flow, the refund helpers, the PDF's `credit` option).
2. **`/review`** — its own review of the rail (the kickoff: "give it its own /review"). Point it at the eight items above.
3. **`/marketing`** — one pass on `DEAL_WORDS.card` (every DRAFT), the refund email, the credit note's words; `npm run check:spelling`.
4. **`/ux` at 390** — the business's page with card on (two pay buttons, the note, the refund policy, confirming / not finished,
   the paid receipt with a refund and a credit note) and the deal page (the payment rows, the payment window, the refund window).
   Drawings rule: the payment window is 520, one lime, no red on refunds, status as a chip.
5. **`/docs`** — the sponsorships help article (card, refunds, the credit note, Send the invoice) and the Payouts card's
   sponsorship row; skip nothing the walk will show.
6. **`/legal`** — card sponsorship, the refund-policy link beside the card button, the refund email (a transaction's message, no
   promotion), the credit note, and the **Payments Terms' sponsorship-card section owed with 3b** (§4 two fee choices, §6 a
   sponsorship refund never includes the fee, §9 the sponsor pays). A policy that promises what the product doesn't do → `/plan`.
7. **`/accounting`** — before hand-off (CLAUDE.md): the processing fee's tax, the club paying it, the credit note as built; write
   the offered addendum to `CLUB_SPONSOR_INVOICE_REVIEW.md`.
8. **Probe** — pattern `.probe/stage6-p3a-money-probe.mjs` (UAT Rep Club / UAT Rep Only fixtures; restore what you change). Prove
   on dev, with Stripe TEST keys and the switch on: a card payment before an invoice with the club paying ($1,130.00) and with the
   sponsor paying ($1,176.39; the deal's total, tax and fee row; the ledger lines: four — sponsorship income, the processing-fee income line only when the sponsor paid, GST/HST collected, and the Payment processing cost; three when the club pays the fee), a card payment on an invoiced deal (the
   club pays), the receipt sent once, a part refund ($200.00 → $176.99 + $23.01, credit note C1, the deal still Paid), a full
   refund (Withdrawn, the place gone, the link still downloads the invoice and the credit note), Void refused on a card payment,
   Send the invoice, and the switch off (no card button, the refund route refuses). Read the probe rules in memory first
   (`.probe/` scratch, sign in without a browser, never re-seed mid-run, the env loader must not read PROD).
9. **The QA walk** — a checkable Artifact (house layout, paste-back), **20–50 boxes, one action per step, exact logins (email +
   password per role)**, its own § in `OWNER_QA_LEDGER.md` (never sort the § numbers). One purpose: the card and its refunds.
10. **The commit — at the owner's yes only** (below).

## The commit (at the owner's yes; never before)
- Branch **`dev`**; re-check `git rev-parse --abbrev-ref HEAD` right before.
- **Explicit pathspecs only**, never `git add -A` / `git add .`. Part 3b's own files: migration 530; `lib/online-payment-landing.ts`,
  `lib/sponsor-card-server.ts` (new), `lib/online-payment-fee.ts`, `lib/club-sponsor-invoice.ts`, `lib/club-sponsor-invoice-pdf.ts`,
  `lib/club-sponsorship-deals.ts`, `lib/club-sponsorship-deals-server.ts`, `lib/club-sponsorship-deal-words.ts`, `lib/sponsor-deal-view.ts`,
  `lib/sponsor-link-route.ts`, `lib/sponsor-invoice-email.ts`, `lib/email-kinds.ts`, `lib/club-money-figures.ts`,
  `lib/coach-budget-item-tiers.ts`, `lib/export/pdf.ts`; the routes listed above (five new folders plus the three changed routes);
  `components/admin/kit/club/sponsorships/{DealPaymentWindows,DealScreen,deals-api}.tsx/ts`, `components/public/SponsorDealContent.tsx`,
  `components/public/SponsorDeal.module.css`; tests `board-ready-stage6-p3b.test.ts` (new), `board-ready-stage6-p3a.test.ts`,
  `online-payments-guard.test.ts`; the drawing HTML; this prompt; plus whatever the review chain adds.
- **Shared files — partial, through a PRIVATE index** (another session's work sits in the same files): `DealsList.tsx` and
  `Sponsorships.module.css` (a release sweep's touch-width lines `bandToggle` / `archivedToggle` / `tableRowBtn` are NOT ours —
  check whether that session has committed them), `docs/projects/active/BOARD_READY_PLAN.md` (our bullets only),
  `supabase/migrations/MANUAL_PROD_STEPS.json` (the 530 entry only; another session has this file STAGED — never commit their
  stage), `docs/agents/db/DATA_DICTIONARY.md` (our sections: `card_fee`, the card columns, `club_sponsor_deal_refunds`, the
  `sponsorship` flow), the schema snapshots (they show the whole database; decide with `git diff` what is ours and say so), the
  board line in `docs/agents/strategy/OWNER_BRIEF_PROJECTS.json` (this project's line, in the same commit).
  Method (memory `reference_partial_commit_shared_tree.md`): `GIT_INDEX_FILE=.git/p3b.index git read-tree HEAD`, add the whole
  files, write the exact partial versions with `git hash-object -w` + `git update-index --cacheinfo`, `git write-tree`, `git commit-tree`.
- **A clean-checkout typecheck BEFORE the CAS update** (it caught a real break in 3a): a worktree at a SHORT path (e.g.
  `/c/tmp/fsc3b`) on the new commit, `node_modules` as a junction, `NODE_OPTIONS=--max-old-space-size=8192 npx tsc --noEmit -p .`;
  remove the junction with `cmd //c rmdir` BEFORE `git worktree remove`.
- Then `git update-ref refs/heads/dev <new> <old>` (CAS), inside an `if`, and `git reset -q -- <paths>` so the shared index matches.
- `git show --stat HEAD` — only our files; foreign files slipped in → `git reset --soft HEAD~1` and redo.
- **No `Co-Authored-By` footer** (owner rule, memory `feedback_no_coauthored_by_line.md`; it overrides any default attribution).
  The message says what the owner sees (house style: "Board Ready Stage 6 Part 3b: …"). Never push to `master`.
- After the commit: record the hash in `BOARD_READY_PLAN.md` ("Part 3b COMMITTED `<hash>` <date>", the positive fact, never
  "uncommitted"), the board line, and the walk's § in the ledger.
