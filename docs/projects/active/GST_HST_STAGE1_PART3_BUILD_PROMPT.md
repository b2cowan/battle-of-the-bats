# GST/HST · Stage 1 · Part 3: keep the address current (build prompt)

> Written 2026-11-04 at the end of the session that committed Parts 1+2. Parent prompt (read its ▶ Progress block FIRST: every
> ruling, the `/review` findings and 8 open owner questions are there): [GST_HST_STAGE1_BUILD_PROMPT.md](GST_HST_STAGE1_BUILD_PROMPT.md).
> Plan of record: [GST_HST_COLLECTION_PLAN.md](GST_HST_COLLECTION_PLAN.md) §4 Stage 1. Recommended model: **Opus** (a webhook and
> money-adjacent records). Mark facts [V] (verified by you this session, file:line) or [H] (handed over, unverified). Everything
> here is [H] unless marked: it was read on 2026-11-04 and other sessions move fast.

## Already true when you start

- **Parts 1+2 are COMMITTED on `dev`: `fd55a1df3`** (record `fb6f580a3`), not pushed. Migration **433** (`billing_locations`) is
  applied to DEV only. Do not re-read the Part 2 prompt; read the parent Progress block instead.
- `billing_locations` already has the columns this part writes: `card_country`, `review_reason`, `review_note`, `review_set_at`
  [V: dictionary section + migration 433]. **No new migration is expected.** If you think you need one, re-run `ls supabase/migrations`
  first (numbers are being taken fast) and stop to say why.
- `lib/billing-location.ts` already holds the pure pieces Part 3 needs: `fromStripeAddress`, `sameBillingLocation`,
  `evidenceReview({ country, cardCountry, payoutCountry })`, `countryChangeReview`, `reviewSentence`, `REVIEW_CONSEQUENCE`,
  `REVIEW_REASONS` (four reasons). Today only `evidenceReview`'s tests call them: **nothing in app code uses them yet. That is this part.**
  `checkBillingLocation(input, { usSalesOpen, requireDeclaration })`: `requireDeclaration: false` exists for exactly this part
  (Stripe's page cannot carry the US tick).
- `lib/billing-location-server.ts`: `saveBillingLocation` already clears `stripe_edit_invalid` on any valid save on our own form, sets
  `country_changed_after_paying`, and copies the saved address to the buyer's Stripe customers (`stampStripeCustomerAddress`).
  `buyerCustomerIds(buyer)` is the customer→buyer rule in one direction; **Part 3 needs the reverse** (customer id → which row), with the
  same exclusions (a coach's own portals only; not `org_team_addon`, not `org_owned`).
- The Stripe customer portal already lets the buyer edit name, email, address and tax ID (`lib/stripe-portal-settings.ts:24`). The
  webhook (`app/api/billing/webhook/route.ts`) handles `payment_method.attached` (:347, `recordCardOnFile`) but **has no
  `customer.updated` case**: a portal address edit never reaches us today.
- ⚠ **`app/api/billing/webhook/route.ts` has another session's UNCOMMITTED edits** (Plans end at the renewal date). Run `git diff --stat`
  on it before you touch it. Put the new logic in a new lib module and add only a thin dispatch hunk to the route; commit only your
  hunk (partial-commit method, memory `reference_partial_commit_shared_tree`: temp index, `git diff HEAD` not `git diff`, one
  script for build → commit-tree → hook → compare-and-swap).

## What the owner sees after this part

1. **Nothing new for the buyer on screen.** An address edited on Stripe's billing page now shows up on Plan & billing, validated
   by the same rules as our own form. An edit that is not a valid billing address is kept out; our record stays as it was and is
   flagged for staff ("An address change on Stripe's billing page wasn't a valid billing address, so the one shown was kept.").
2. **Platform admin, one read-only block** on the organization record they already open (the Money tab,
   `app/platform-admin/orgs/[id]/MoneyTab.tsx`, no new tab, no edit, no buttons): the stored address, the country, for a US address the
   declaration date and its wording version, and, when set, an amber **Needs review** chip with `review_note` and `REVIEW_CONSEQUENCE`
   ("Until this is looked at, the buyer is treated as Canadian."). A coach's portal shows the coach's own row (a coach buys as a
   person). Follow the support console's existing reader and block conventions; keep it to one small block.
3. **Disagreeing evidence is flagged, never acted on.** A US address with a non-US card or non-US payouts, and the reverse (a
   Canadian address with a US card or US payouts), sets `card_country_mismatch` or `payout_country_mismatch`. **Never blocks a
   purchase, never emails the buyer** (owner Ask 3).

## Before any code: verify, then ask (no code)

**Verify, reading the code (a helper agent is fine for the reads; open the cited lines yourself):**
1. **Which Stripe event carries the portal address edit, and is it enabled?** Expected `customer.updated`
   (`event.data.object` is the Customer; `previous_attributes.address` says whether the address changed). Find where the
   webhook endpoint's enabled events are documented or configured for test and live (ops docs, the release checklist). A new event
   type must be switched on in the Stripe dashboard for **both** test and live endpoints: that is an **owner step**; list it, do not
   assume it. Say how the dev walk can fire one (Stripe CLI forward, or a dashboard edit on the dev customer).
2. **Our own write comes back as an event.** `saveBillingLocation` and `ensureStripeCustomer` stamp the customer, which fires
   `customer.updated` at our own handler. Design so that echo is a no-op: compare the event's address with the stored row through
   `sameBillingLocation` after `fromStripeAddress`, and write nothing when equal. Prove there is no ping-pong (a normalising
   difference, e.g. postal-code spacing, must not loop).
3. **The reverse mapping, and the shared-customer trap.** A Coaches Portal's Premium customer belongs to the coach's PERSON row.
   [V in the Part 2 `/review`] a Premium coach's REFUSED move/checkout to Club already writes the CLUB address onto that live
   Premium customer (`saveBillingLocation` → `stampStripeCustomerAddress` runs before the move is accepted; `app/api/billing/move/route.ts`
   and the in-place branch of `create-checkout/route.ts`). **Once Part 3 reads customer edits back, that stamp would flow into the
   coach's home-address row.** Confirm by reading, then see Ask 2.
4. **Where the card country can be read.** `recordCardOnFile` receives the whole payment method on `payment_method.attached`
   (`pm.card.country`). Confirm what it stores and where (`organization_billing_facts` keeps brand + last4 only [H]); say how the
   card country reaches `billing_locations.card_country` for a customer with several cards (use the default payment method;
   say what you chose and why) and what happens on a card swap (`payment_method.detached` frequently arrives after the new one attached).
5. **Where the payout country is written** (`org_payment_accounts.country`, the country Stripe verified for club payouts; clubs only,
   a coach has none). Find every writer, so the evidence check re-runs when it changes, not only when the address does.
6. **What `storedLocationStillValid` does with a Stripe-sourced US address** (no declaration on file). A buyer on Canada who edits to a
   US address on Stripe's page cannot tick the declaration there. Read it and say what the record looks like afterwards and what
   the buyer sees next time they press a paid button.

**Asks for the owner (present each with a recommendation; do not build before they are answered):**
- **Ask 1 · Which flags clear themselves.** Recommend: the two evidence flags (`card_country_mismatch`, `payout_country_mismatch`)
  are RE-EVALUATED on every relevant event and clear when the evidence agrees again (a corrected address, a new card);
  `stripe_edit_invalid` already clears on the buyer's next valid save; **`country_changed_after_paying` stays** until Stage 2's
  tax-reason record gives staff a way to resolve it (Stage 1 has no edit in platform admin, by ruling). Say plainly that until
  then such a buyer is taxed as Canadian.
- **Ask 2 · The refused-move stamp.** Recommend fixing it **in this part**, because Part 3 would turn a harmless divergence into
  a wrong home address: for the in-place "Start your club" paths, stamp the club address on Stripe only after the move or
  checkout is accepted, not when the address is saved. (The other order of work, leaving it for Stage 2, is wrong: Stage 2 reads
  that customer address for tax.) Present what changes for the buyer: nothing visible.
- **Ask 3 · Does a Founding next-season choice count as "paid"?** `hadSubscriptionBefore` (`lib/plan-move.ts` ~:467) skips any
  subscription with `metadata.choiceKind`, so a comped Founding club that will be charged on Oct 1 can change Canada↔US with no
  `country_changed_after_paying` flag. Recommend: count it, because it is a real Stripe subscription that will charge. This changes
  `hadSubscriptionBefore`'s other callers: read them before touching it, and say if they differ.
- **(Carried, not Part 3 unless the owner pulls it in; one line to confirm "leave for a later pass":)** the PO Box rule is easy to
  get around ("PO Box No. 12", "Lockbox 5"); region is not checked against the postal code or ZIP; US territories and military codes
  are not offered; the `ON DELETE CASCADE` question belongs to `/accounting` before Stage 2.

## Build

**A · Stripe → our record (`customer.updated`).** A new server module (e.g. `lib/billing-location-sync.ts`) with one entry point the
webhook calls. Resolve the customer to its row (org or user; ignore a customer that maps to neither; ignore a customer the buyer
no longer pays through). If `previous_attributes` shows no address change, stop. Run `fromStripeAddress` then `checkBillingLocation(...,
{ usSalesOpen, requireDeclaration: false })`; valid and different → save it (keep the existing declaration fields when the country
is unchanged; use `countryChangeReview` when it changed and the buyer has paid; settle item 6 with the owner's Ask answers); invalid →
keep the stored row and set `stripe_edit_invalid` with its sentence. Idempotent: Stripe retries and delivers out of order, so the
handler decides from the event's current object, never from counting events. Echo of our own write = no-op (item 2).
Errors go to `captureError` and the route still answers 200 for a bad payload that retrying cannot fix, as the other cases do.

**B · Evidence (`card_country`, payout country).** One function, e.g. `reviewEvidence(buyer)`, that reads the stored country, the
card country and the payout country, calls `evidenceReview`, and sets or clears the evidence flags per Ask 1 (never overwriting
`country_changed_after_paying` or `stripe_edit_invalid` with an evidence reason: say in a comment which wins and why). Call it from:
`saveBillingLocation` (an address changed), the new `customer.updated` handler, the `payment_method.attached` case (store the card
country first), and the payout-country writers from item 5. Store `card_country` upper-case. A missing card or payout country is no
evidence either way (the helper already says so).

**C · Ask 2's fix (if the owner agrees).** Move the Stripe stamp of the club address behind acceptance on the two in-place paths;
keep `saveBillingLocation` stamping on the Billing address window's own save (that is the person or club editing their own
address). Add a source guard test for the ordering, in the style of `tests/unit/billing-location-checkout-guard.test.ts`.

**D · Platform admin block.** Read-only, on the Money tab's reader. Words in the product's voice, one spelling everywhere
(`npm run check:spelling`); the clock only through `formatTime()`; dates only through the shared date helpers. Phone width and
the console's formatting rules apply; run `check:layout --changed` for the touched screen only if the dev server is up (otherwise say
"skipped, no dev server").

**E · Tests.** Pure behaviour tests for every branch of the sync decision (valid/invalid/echo/country change/unmapped customer/stale
retry) and of `reviewEvidence` (set, clear, precedence); a source guard that the webhook dispatches `customer.updated` to the
sync module and that no code writes `billing_locations` review fields outside the two server modules. Webhook tests in this repo
follow the existing webhook test style: find it with a grep for `webhook` in `tests/unit/` before inventing a new one.

## Rules (from AGENCY_RULES and memory; blocking)

- Present a short task list before code. Ask the owner's questions first and wait. Disagree out loud if the code says something here is wrong.
- Do not edit `.claude/settings*.json`, hooks, `package.json` scripts, `scripts/check-*.mjs` or anything in `WATCHED_PATHS`.
- Never block a purchase and never email a buyer from this part (Ask 3, ruled).
- Verify: your new tests, the Part 2 billing tests (`billing-location*`, `plan-billing-actions`, `org-billing-access-guard`,
  `team-move-coverage`, `workspace-flip-guard`, `demo-sandbox-write-guard`), `npm run typecheck`, `npm run check:spelling`,
  `npm run check:dictionary` if any field meaning changed. Report anything skipped. Four tests belong to other sessions and fail in
  the shared tree (`plan-billing-usage`, `public-tournament-stage6-walk`, `stripe-mode`, `support-console-stage3`): leave them alone.
- Offer `/simplify` (a new shared module) then `/review` once each, BEFORE committing. A clean-worktree typecheck of the commit's tree
  is the real proof of a partial commit (`NODE_OPTIONS=--max-old-space-size=8192`).
- **Commit** on `dev` (re-check the branch), explicit pathspecs, only your hunks in shared files (`TODO.md`, the dictionary, the
  webhook route, the Owner QA Ledger), `git show --stat HEAD` after; do not push. Record "committed `<hash>` <date>" in the parent
  Progress block and the TODO line as a small follow-up commit. If you add a migration (not expected): dev only, dictionary +
  `npm run refresh:snapshots` + `MANUAL_PROD_STEPS.json`, in the same unit of work.
- Leave a Progress entry naming exactly where you stopped. Stage 1 then still owes **Part 4** (the guard), the **`/accounting`
  review** (blocking before the stage's hand-off), **`/docs`**, and the owner's **walk** on the dev site.

## Out of scope

Tax of any kind, "plus applicable taxes", tax IDs, the tax-reason record and any platform-admin edit or resolve button (Stage 2),
the guard on new checkout paths (Part 4), help articles (Part 5), an address search box (TODO, research later), and the strictness
items listed under "Carried" unless the owner pulls them in.
