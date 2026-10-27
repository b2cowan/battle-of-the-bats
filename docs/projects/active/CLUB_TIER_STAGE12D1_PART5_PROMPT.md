# Club Tier Stage 12d-1, Part 5: help, the Stripe setup guide, layout, the end-to-end pass, the walks and the records (handoff prompt)

> **Written 2026-10-27** at the end of Part 4b's session. Paste into a new chat on `dev`. The parent prompt is
> `CLUB_TIER_STAGE12D1_BUILD_PROMPT.md` — its "Part 5", "Definition of done" and "Do not" apply unchanged. **Re-verify every
> lead against the code.** Other sessions share this working copy: commit only your own hunks from a temporary index, then
> `git reset -q -- <your paths>`. Recommended model: Opus 5.5; helpers on Sonnet (broad reading goes to a helper).

## Where things stand

- **Parts 1–4b are committed** (plan `CLUB_TIER_STAGE12_PAYMENTS_PLAN.md` §0 holds each part's record, builder's calls and
  owner asks): Part 1 `c938e871a` + review `380528304` (migs 390, 391) · Part 2 `23510b099` + review `2668e40f7` · Part 3
  `20525a222`, `77cddf92b` + review `717f6811b` · Part 4 `296ca4014` (every club pays its Stripe fees) + `378dc1fb0` (the
  daily job; mig 395 **applied on dev** 2026-10-27 on the owner's yes, `f09401090`) · Part 4b `50e66927c` (mig 396) + the /review of 12d-1
  `a5da8b0e4`.
- Migrations 390, 391, 396 are on dev; all four (390, 391, 395, 396) are prod-pending in `MANUAL_PROD_STEPS.json`.
- **No help article covers disputes, the paid-twice item or the hand-recording warning yet** — Parts 1–3 changed none.
  Part 4 changed three (`lib/help-content/house-league.tsx`, `org.tsx`, `tournaments.tsx`); read what they now say first.
- `docs/agents/ops/stripe-setup-guide.md` still lists only `charge.dispute.created` among the dispute events.

## 0 · The owner's rulings of 2026-10-27, built FIRST (the help describes them)

Ruled in the Part 4b session (plan §0, "Owner rulings on Part 4's asks"). Mig 395 is **applied on dev** (`f09401090`).
Build, test, `/review`, commit each before §1:
- **(2) A cancelled club sees its fee list.** It is still billed (no reprieve) and is emailed the invoice; Plan & billing
  must show the Stripe fees list to it — read the billing rail's cancelled-club gate (what a cancelled club can reach) and
  give the list its exemption. `/billing` first.
- **(3) A returned debit is billed at Stripe's own figure,** read from the platform balance as a reversed one is (ruling
  5); nothing when Stripe charged nothing. The CA$5 constant stops deciding a bill — update the Facts doc's line and
  `/strategy`'s drift check in the same unit of work (pricing rule in CLAUDE.md).
- **(5) The single "Email the pay link" after a lost dispute warns, never skips** (the bulk send keeps skipping). The
  warning's words go to `/marketing` (one pass, the dispute words' voice).
- **(6) A fee on a subscription cancelled or discounted before its invoice** goes to the club's own monthly invoice: the
  daily job finds a `billed_on = 'subscription'` fee whose Stripe line is still pending on a subscription that can no
  longer carry it, deletes that pending line from Stripe, and returns the fee to unbilled — billed once, never twice
  (read the line from Stripe before and after).
- **(7) A credits-only month** — awaiting the owner's ruling on the recommendation (see "Open with the owner").

## 1 · Help (`/docs`)

Run `/docs` over every flow 12d-1 changed. The words are settled in `CLUB_TIER_STAGE12D_COPY.md` (§1 disputes, §2 paid
twice, §3.4 / §1.7 fees) — the help says what the screens say, in the same spellings:
- **A card dispute, two readers:** the desk's quiet copy (who answers, by when) and the person who answers (Answer in
  Stripe, Copy the facts, the 3-days email, an inquiry versus a chargeback, no refund door while a dispute is open, an
  inquiry never blocks a refund). A lost dispute's own words (owes again, the child or team); won after lost (plain paid
  again; what was paid again meanwhile is extra). Never "fraud".
- **Paid twice:** the item, refunding the extra (refund set to the extra), "Keep it" with a reason, and the hand-recording
  warning (recording by hand closes an open pay page).
- **Every club pays its Stripe fees:** the Plan & billing "Stripe fees" list (absent until a fee exists), the club's own
  monthly invoice and its email (a comped or free club included; sent on the 1st; due in 30 days), a card from outside
  the club's country (the club's cost, never the family's). The platform-admin fee panel is platform-only — no help.
- **12c's help that says a card dispute is 12d's** changes too (grep the help content for it).
- Keep help search findable: each changed article's `keywords` / `searchText`.

## 2 · The Stripe setup guide

Add to `docs/agents/ops/stripe-setup-guide.md`, **named as the owner's step** (never change a dashboard setting yourself):
- the Connect webhook's dispute events — read `app/api/payments/connect-webhook/route.ts` for exactly which
  `charge.dispute.*` it handles, and update the `stripe listen` line to match;
- the platform billing webhook's invoice events a fee invoice needs (read `app/api/billing/webhook/route.ts` and
  `syncFeeInvoiceFromEvent`), and whether they are already subscribed for subscriptions;
- check the memory note "owner adds 2 Connect events" (12c) against what the guide then says, so the owner gets ONE list.

## 3 · Tests, gates, layout

- **Unit tests:** walk the parent's Definition-of-done list against `tests/unit/` (`online-payments-paid-twice`,
  `online-payments-card-dispute*`, `stripe-fees-every-club`, `bank-debit*`) and add only what is missing.
- `npm run check:spelling`, `npm run verify:changed`, `npm run typecheck`. Six unit failures belonged to other sessions
  on 2026-10-27 (staff club, tryout address, 11b's tables, a toolbar, two table-access checks) — confirm before treating
  any as yours.
- `check:layout --changed` on the touched screens at 1440 and 390, Warm and Dark: the record's dispute block (house
  league and tournament), the paid-twice item and its refund window, Plan & billing's Stripe fees list, the Payouts card,
  the platform-admin fee panel. Never a whole-product sweep on dev.
- Demos follow the product: nothing per commit beyond `check:demos` staying green.

## 4 · End to end in test mode

On the test Express account from the 12a–12c walks, as the parent lists (team overpaying through a pay page left open;
Stripe's test dispute cards won and lost, family and team; a returned debit on a comped club raising its own invoice and
paid on Stripe's hosted page; a card issued outside Canada). Two things learned in Part 4b:
- The monthly invoice gathers only fees recorded **before this month's 1st**. To see one today, run the monthly step
  with a `now` in next month from a probe (`.probe/`) — never by back-dating rows.
- The daily job runs on dev once a day (11:15 GMT) and can be run by hand (`run_jobs`) for a test.
- The email checks go in the ONE final end-to-end pass on Amplify dev once Stage 12 is built — write them into that pass,
  don't run them here.

## 5 · The walks

A checkable Artifact plus the next § in `OWNER_QA_LEDGER.md` (§394 was the latest on 2026-10-27 — check). One purpose per
walk; likely two: **paid twice** and **disputes and fees**. Pin names and relationships, never counts or amounts. Each
Part's builder's calls (plan §0) go on the step where they show, to confirm or reverse.

## 6 · Records

Plan §0 and §4 (12d-1 state, anchors) and PM brief item 6; the Club index (`ArtifactData`, artifact
`MBKRySURVFu3V9cZJvmjVr`, stage `s12` — read first, pin `if_version`); the memory file `project_club_stage12_payments`;
the Facts doc (built status only, no rate moves); TODO.md's one line.

## Open with the owner (don't build around; carry into the walk where they show)

- **(7) A credits-only month** (a returned answering fee with nothing to set it against): the recommendation put to the
  owner is to return it against the invoice that carried the answering fee — a Stripe credit note, refunded to the card
  if that invoice was paid, lowering it if still open; netted on the same invoice, as today, when both fall in one month.
  Build only once ruled.
- **(4) The invoice's contact address** is deferred to the owner's later company-wide email sweep (with noreply and
  support). Leave `hello@fieldlogichq.ca`; do not ask again.

## Not this part

12d-2 (the Payouts tab, leaving, terms, the platform-admin Online payments tab and Health list). Any Stripe dashboard
setting, live key or real money. Applying 395 on production (a release step, its own yes).
