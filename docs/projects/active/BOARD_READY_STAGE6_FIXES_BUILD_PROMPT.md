# Board Ready Stage 6 · four fixes before sponsor card payments go live — build prompt

> Written 2026-11-25, after Part 4b's walks closed (§570, `065d70a35`), on the owner's "yes, write the build prompt for
> the four items". **Two sessions**, each pasted into a fresh chat (`/clear` first):
> - **Part A** (Opus): *"Read and follow docs/projects/active/BOARD_READY_STAGE6_FIXES_BUILD_PROMPT.md — Part A"*
> - **Part B** (Sonnet is enough): *"… — Part B"*
>
> **Part A** is the refund made in Stripe's own dashboard. It is not a small fix: it needs a drawing, the owner's rulings
> and almost certainly a database change. **Part B** is three small fixes with no migration. The owner ruled Part A's gate:
> it is **built before a club takes a sponsor card payment on production** (plan §5 Stage 6, Part 4a call 11, L1834–35).
> Production's payments switch has been on since 2026-11-24; sponsor cards arrive with the Part 3b promote.
> Recommended order: start Part A's drawing first (it waits on the owner), build Part B while it waits. Both edit
> `lib/online-payment-landing.ts`, `lib/online-payment-words.ts`, the sponsorship words and `lib/help-content/org.tsx`,
> so don't edit them in two chats at once.

## ⛔ Start conditions (both parts)
1. Branch `dev`. Other sessions have uncommitted work in the tree (club website, schedules, the plan, the board JSON).
   Commit only your own lines through a private index (memory `reference_partial_commit_shared_tree.md`).
2. Every fact below was read on 2026-11-25. **Re-check the lines you touch**; where this prompt and the code differ, the
   code wins — say so.
3. Numbers move: at writing the next free migration is **542** (540 and 541 are another session's, untracked) and the next
   ledger entry is **§571**. Check both at commit time. Migrations **530–534 are pending on production**.
4. A database change, a dev apply, a production data change and a commit each need the owner's yes **in that chat**.
5. The 2026-11-22 sponsorships build prompt's standing rules and `/legal` build rules still bind
   (`BOARD_READY_STAGE6_SPONSORSHIPS_BUILD_PROMPT.md`). No Co-Authored-By footer.

---

## Part A — a refund made in the club's Stripe dashboard

### What is recorded
- "A refund made in the club's own **Stripe dashboard** counts against `refundable` (and is offered to be booked) instead
  of only being announced" (`BOARD_READY_STAGE6_P3B_AFTER_WALK_FIXES_PROMPT.md` item 8; needs a screen and a Ledger door).
- Accounting: no booking and no credit note today; "Offer to book it with its credit note"
  (`docs/agents/accounting/CLUB_SPONSOR_INVOICE_REVIEW.md` L39).
- Legal: "Build before the first sponsor card payment on production"
  (`docs/agents/legal/BOARD_READY_STAGE6_SPONSORSHIPS_DRAWING_REVIEW.md` L132). Shipped meanwhile with a help note.
- No plan or drawing of its own exists.

### Today (`lib/online-payment-landing.ts`)
- `applyRefundEvent` (~1776) routes a sponsorship payment to `applySponsorRefundEvent` (~2183). A refund the app didn't
  start books nothing: it raises `card_refund_unmatched` ("Record it in the Ledger, and refund from the deal's payment
  next time", `lib/club-sponsorship-deal-words.ts` ~718).
- So: the deal still reads paid; books and GST/HST collected are unchanged; no credit note, no email to the business; its
  place stays on the club's site; **Offer again** still counts the payment.
- "Record it in the Ledger" has no manual way to write the GST/HST part (accounting review).
- The notice never clears itself: its resolver reads only the family tables (`lib/needs-attention.ts` ~715–735). Its label
  says "Record it, then press Done" (`lib/notification-labels.ts` ~169). A pending dashboard refund that later fails leaves
  the notice standing.
- The app's refundable figure ignores it (mig 532 ~342–347), so a later in-app refund can ask for money already returned.
- Before the payment has landed, the family-worded "goes on the registration" notice is raised (`raiseUnmatched` ~1827),
  and the shared subject id may then suppress the sponsor one (inferred; prove or disprove it).
- One case is already handled: a "not recorded" payment refunded **in full** from Stripe (mig 531, ~2205).
- **Family payments record these themselves** (12c: house league ~1850, team ~1953; mig 384). A whole refund or a one-child
  part is recorded and booked at once; a person is asked only "whose was it?" or "what now?". Mig 384 writes
  `online_payment_refunds` and fits those two flows only: reuse the pattern, not the function.

### Why the database almost certainly changes
`club_sponsor_deal_refunds` (mig 530): the server can only read it and update `emailed_at` / `stripe_refund_id`; there is
no origin or Stripe-date column; `reason` and `created_by_name` are required. The open function caps at the refundable
amount, which excludes the card fee, so a full dashboard refund on a sponsor-paid fee exceeds it. Booking dates the lines
today (mig 534). Opening is not idempotent by Stripe's refund id.

### First: `/accounting`, then a small drawing, then the owner rules. No code before that.
`/accounting`: the date the books take (Stripe's or the day recorded), the credit note and its date, a returned fee.
`/design`: one drawing of the differences (desktop and 390, true size, the house layout) with these asks:
- **A1. Recorded by itself, or offered?** The record says "offered to be booked"; family refunds record themselves, and a
  sponsor payment always pins to one deal. Booking a full return ends the deal or puts it back to owing, issues a credit
  note and emails the business. Lean: count it against refundable at once, show it on the deal as waiting, and let the club
  record it with a reason. Argue against this if the books are worse while it waits.
- **A2. The card fee given back** in a dashboard refund when the sponsor paid it.
- **A3. A refund that arrives before the payment has landed**, and a part refund of a "not recorded" payment (still open,
  after-walk call 4).
- **A4. A refund that is pending, then fails** (what the deal shows, and the notice clearing).
- **A5. Refunds already sitting as a notice** when this ships (dev; production has none if it ships before sponsor cards).

### Traps
- The daily retry sweep (`sweepStuckSponsorRefunds` ~2299) **re-asks Stripe** for any pending row with no Stripe id older
  than 15 minutes. A recorded dashboard refund must never sit in that state, or the club refunds twice.
- Refund metadata is the club's to write: keep the UUID guard before any filter string.
- Webhook events repeat and arrive out of order; correctness lives in the database functions, keyed on the Stripe refund id.
- A lost dispute refuses refunds (mig 532). A deal withdrawn or paid twice must not reverse the same money twice (mig 534).
- A change to the daily job step goes in its own commit (as `7f2015740`).

### Also in Part A
- Help `lib/help-content/org.tsx` ~2376 ("Refunded in Stripe itself?"), ~2489–2493 and the FAQs ~2530 change with it.
- `lib/club-sponsorships-words.ts` ~256 (shown on Payouts) tells the club to "Refund the fee line yourself", only possible
  in Stripe; `/legal` asked for a fix (`BOARD_READY_STAGE6_PART3B_CARD_REVIEW.md` L43).
- Tests to extend: `board-ready-stage6-p3b`, `online-refund-pinning` (counts the `reconcileDashboardRefunds` call sites),
  `online-payments-guard` (the function list), `online-payouts-list`, `sponsor-card-unrecorded`.
- Ends with: `/simplify` → `/review` (high-risk money) → `/dba` on the migration → `/marketing` → `/legal` (the email and
  credit note the business receives) → `/ux` at 390 → `/docs` → a probe with a real dashboard refund on a dev connected
  account → the QA walk → the commit at the owner's yes.

---

## Part B — three small fixes, no migration

Ask the owner the calls B1–B4 **in one message before building**; each has a recommendation.

### B-1. Private links in error reports (ruled: fix)
**Ruled 2026-11-25** (Part 4b legal call 5): error reports keep the private link of five no-sign-in pages for 30 days;
fix as its own small fix. Source: `docs/agents/legal/drafts/PRIVACY_POLICY_SPONSORSHIP_ADDENDUM.md` ~L124.

**Wider than recorded:**
- `error_groups` (route, title, `sample_context`) is deleted only 90 days after being **resolved**
  (`122_observability_phase4.sql` ~127–152). An open or ignored group keeps the link with no end date, while the published
  privacy policy says error reports are deleted after 30 days (`lib/legal-documents/privacy/2026-11-24.md` ~66 and ~280).
- Server errors too: `instrumentation.ts` ~23–31 stores `request.path`, **query string included**, so links with the secret
  after `?` leak there (unsubscribe, second-parent and invitation stop, the invite accept pages, two-step reset, password
  and sign-up confirm, the club claim pass).
- More secret-in-the-path pages than five: `/pitch/[slug]` and the three calendar feeds (coach, league coach, family).

**The five and their shapes** (a club's own address drops the org slug): `/[orgSlug]/sponsorship/[token]` ·
`/[orgSlug]/[tournamentSlug]/pay/[token]` · `/[orgSlug]/league/[seasonSlug]/status/[token]` · `/family/claim/[token]` ·
`/tryout-score/[token]`.

**Paths in:** client boundaries send `window.location.pathname` (`lib/observability/client.ts` ~17; `app/error.tsx`,
`app/[orgSlug]/error.tsx`, `app/global-error.tsx`) → `captureError` (`lib/observability/capture.ts`) writes it to the
title, route, fingerprint and the server log line. Message, stack and component stack get email scrubbing only.

**Build:** one redactor at the `captureError` choke point covering route, title, request context (the `path` key too),
message, stack, component stack and the console line, for every private-link shape above, so the route becomes its
template (this also stops each link making its own error group). A build test that fails when a new token page isn't
covered, with real club-host shapes. Dev check: post a fake-token route to `/api/client/error-capture`, then read it back
in `/platform-admin/observability`. Check whether the feedback window (it stores the pathname,
`app/api/feedback/route.ts` ~107–132, no deletion found) opens on any of these pages; if it does, redact there too.

- **B1. Rows already stored.** A write-time fix leaves them. Recommend a one-off cleanup of stored routes, titles and
  context: counts first on dev and production (**counts only on production**, binding), the owner's yes, then run.
- Then `/legal`: whether the 30-day sentence holds for the grouped summary, or the policy or the daily sweep changes. The
  sweep is a job that runs on production: change it only on the owner's ask in that chat, in its own commit.

### B-2. "Send the link again" says it will email when it won't
- The confirm always says "A new link goes to the business by email" (`lib/club-sponsorship-deal-words.ts` ~307;
  `DealScreen.tsx` ~354–358 branches only on `linkMade`).
- The route (`app/api/admin/sponsorships/deals/[dealId]/again/route.ts` ~59–63) emails nothing on an **invoiced or paid**
  deal, a run-out reason, a missing address, mailing address or contact, a stop or opt-out, or a refused paid reason.
- Afterwards the window says "It couldn't be emailed" (~328), though on an invoiced or paid deal nothing was attempted. The
  reason check runs first, so an invoiced deal with an old reason reads "Their reason to be emailed has run out".
- The old link then shows "This link has been replaced. Look for the club's newer email, or contact {club}." (~542). On an
  invoiced or paid deal no newer email was sent.
- **Ruled 2026-11-23** (ledger ~28776, walk §561): keep the button on invoiced and paid deals; "the confirm is enough,
  nothing added". The question asked (walk §561 choices) did not say the confirm promises an email.
- **B2. Recommend:** the button stays; the confirm says what will happen (where the screen can tell nothing will be
  emailed: "The old link stops working. Nothing is emailed, so copy the new link and give it to them."); the invoiced or
  paid case gets its own after-press words; the old link's page drops "newer email" for those deals. Words are DRAFT for
  `/marketing`. The alternative, emailing those deals, is a new email and needs `/legal` first.
- The screen already has the state, `data.offers`, `data.today`, the address, the bar and the two mailing flags; it can't
  know a paid-reason refusal or a send failure, so keep the after-press window for those.
- Help already says it (`org.tsx` ~2334) but names only two of the cases. `board-ready-stage6-deals` ~209–219 pins the
  `ran_out` line before `sendOffer`; change it deliberately.

### B-3. A card inquiry reads as a dispute
- An inquiry (`warning_*` status, `lib/online-payment-dispute.ts` ~24) takes no money and **never blocks a refund**
  (~152), yet a sponsor's raises "…card payment is disputed" / "The sponsor's bank is disputing {amount}… Don't refund this
  sponsor while it is open" (`lib/online-payment-words.ts` ~230–233; no inquiry branch in `afterSponsorDispute`
  ~2251–2267). The advice is wrong: a refund is one way to settle an inquiry.
- **B3. Draft words** (for `/marketing`): "{business}'s card company is asking about a payment" / "The sponsor's bank is
  asking about {amount}. No money has been taken. Answer it in Stripe by {date}. If the money should go back, you can
  refund the payment."
- **B4. Scope.** Family, tournament and house-league payments already say "Bank asking" on chips and the opened email, but
  the notification title still says "is disputed" (~638), the answered and overdue chips say "Disputed", the reminder says
  "card dispute" (~741) and the email footer says "If the club wins". Recommend fixing every false word in this pass. Ruled
  family wording is in `CLUB_TIER_STAGE12D_COPY.md`; 12d ruled an inquiry **raises** an item and email like a dispute —
  keep that, change only words.
- **Traps:** an inquiry can become a dispute under the **same id** (mig 396). An open notice blocks a second one
  (`lib/notify.ts` ~285), so inquiry words would go stale and the club would never hear "don't refund": the escalation must
  replace or re-raise the notice. A closed inquiry settles as "The club won the dispute."
  (`lib/needs-attention-words.ts` ~83) — give it its own line.
- Tests: `board-ready-stage6-p3b` ~419 and ~655, `online-payments-card-dispute` and `-screens`, `notification-facts`.
  Help `org.tsx` ~2491 and ~2530–2533.

### Part B ends with
`/review` → `/marketing` → `/legal` (B-1's policy question) → `/docs` → the QA walk (short; the error-report check is a
probe, not a walk step) → **two commits** (the error reports alone; the sponsorship wording) at the owner's yes only.

---

## Both parts: walk and records
- Walks are checkable Artifacts, 20–50 boxes, one action per step, exact logins
  (`uat-club-owner@uat-rep-club.local` / `UATPassword2026!`, UAT Rep Club). Dev data only.
- Record each part in plan §5 Stage 6, the prompts index and the board's Board Ready line, positive facts only, in the
  same commit as the work.
- Not here: the dispute reminder email to a sponsor (later, §565 call b); Part 3b's rare SQL cases other than A3.
