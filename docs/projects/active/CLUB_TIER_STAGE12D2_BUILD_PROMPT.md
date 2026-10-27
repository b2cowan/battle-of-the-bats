# Club Tier Stage 12d-2: matching payouts, leaving online payments, the terms, and the platform view (build prompt)

> **Written 2026-10-27**, after all of 12d's asks were ruled. **Build this only after 12d-1 is committed**
> (`CLUB_TIER_STAGE12D1_BUILD_PROMPT.md`): the platform view here reads the disputes and Stripe fees that 12d-1 records,
> and the leaving windows count disputes that 12d-1 makes visible.
>
> **Paste this into a new chat on `dev` and re-verify every lead first.** The leads come from a census at `490fb4e94`
> (a helper's read, with the load-bearing lines re-read by me), and code moves. Other sessions share this working copy:
> stage explicit paths only, and commit only your own hunks.
>
> **Recommended model: Opus 5.5.** The work is a new Stripe read (payouts and their contents), the plan-move and deletion
> paths, and a new platform-admin area. Helpers stay on Sonnet as configured.
>
> Build in **parts, each committed locally after its own checks**, in the order below. **Nothing charges real money:**
> test mode only, and `LIVE_PAYMENTS_ALLOWED` stays false.

## What 12d-2 makes true

- **A treasurer can match a Stripe payout to a line on the bank statement.**
  - An **Accounting › Payouts** tab sits at the end of Accounting's tab row, for everyone who reads Accounting.
  - Each payout opens to the payments inside it, by name and receipt, with dates, Find and Export (the house format).
  - A club without Accounting gets the same list, collapsed, on the owner's Payouts card.
- **Leaving online payments never strands money or a family mid-payment.**
  - **Every ending closes the pay pages already open, and its window counts them.** An ending is: Disconnect, a downgrade
    on its date, or a cancel.
  - The Disconnect window also counts **house-league** registrations still to pay. That is a correction: today it counts
    tournament teams only.
  - **A downgrade follows one rule.** Online payments stop being offered on the move date. Clearing debits, refunds and
    disputes still finish. The owner is told what's outstanding. Payouts stay connected.
  - Deletion and the operator's paths behave as the drawing shows.
- **The terms read out and can be agreed again.**
  - The Payouts card shows who agreed, when, and to which version.
  - When the terms change, the club sees a notice on the card and the owner gets an item. Payments stay on.
  - The new version is required to set up again, to reconnect, or to change who pays the fee.
  - **Agree is absent until the box is ticked**, both in this window and in the existing set-up window, which today
    disables its button instead.
  - Counsel's text replaces the placeholder when it arrives. The product never writes legal text.
- **The platform team can see a club's online payments, read only.**
  - An **Online payments** tab sits on the club's record.
  - One **Health › Online payments** list runs across clubs. It covers open disputes, unpaid Stripe-fee invoices, fees
    whose billing failed, and debits clearing.

## The rulings (do not reopen; record nothing they did not rule)

Verbatim in `CLUB_TIER_STAGE12_PAYMENTS_PLAN.md` §0 state ("12d drawn" plus the three ruling blocks, 2026-10-26/27). This
build uses:
- **Ask 4:** one downgrade rule; payouts stay connected.
- **Ask 5:** the Payouts tab for everyone who reads Accounting; the collapsed list on the owner's card for a club without
  Accounting.
- **Ask 6:** a notice and an owner item; payments stay on; new version required to set up again, reconnect, or change who
  pays; Agree absent until ticked, in both windows.
- **Ask 7:** read only; a club tab plus one Health list.
- **Ask 11:** every ending closes open pay pages and counts them.
- **The treasurer never refunds (§0f)**, and Settings stays the owner's. The treasurer reads the Payouts tab and never
  gets a door that moves money.
- **The terms must name the Stripe costs billed to the club**, comped and free included: a returned bank debit, a card
  dispute, and a card from outside the club's country (owner 2026-10-27, plan §6). That is counsel's text. This build only makes sure
  the read-out and "agree again" carry whatever version counsel ships.

## Read first

- The plan sections above, and the PM brief `CLUB_TIER_STAGE12_PAYMENTS_PM_BRIEF.md` item 6.
- **Build to the drawings:** https://claude.ai/artifact/WutBgX8o56jBWN2zXXvZvg (`CLUB_TIER_STAGE12D_DRAWINGS.html`). This
  build covers frames **3 (payouts list)**, **4 (leaving)**, **5 (terms)** and **6 (platform admin)**, plus the review
  table, including the /ux findings on loading and error states, deadline emails and wind-down gaps.
- **The words (settled; build from these, don't re-word):** `CLUB_TIER_STAGE12D_COPY.md`. The words doc wins over a
  drawing's provisional words.
- What 12d-1 built: its plan §0 record and its commits (the dispute record, the Stripe-fee rows, the standalone invoice).
- `AGENTS.md` (Next 16; read the route-handler guide in `node_modules/next/dist/docs/` before a new route).
- **Stripe's current docs, not memory.** See Before any code, step 2.

## Verified state (leads; re-check each)

**Payouts**
- `components/admin/kit/club/PayoutsCard.tsx` holds five states, the rates, who pays the fee, the refund policy and
  Disconnect. It is mounted on the club home (`SettingsKit.tsx`) and the tournament home
  (`app/[orgSlug]/admin/tournaments/settings/payouts/page.tsx`). `PayoutsStatusLine.tsx` shows on the Accounting page
  and the house-league money page.
- **There is no payouts list**, and nothing calls Stripe's payouts or balance transactions today.
- `lib/admin-kit-nav.ts` `accountingTabs` gates tabs only by `runsRepTeams`. Page access is in
  `app/[orgSlug]/admin/accounting/layout.tsx` (`canOpenModule(..., 'module_accounting')`). The Money and Accounting tab
  row is one row (memory: "Money + Accounting = one tab row").
- The treasurer's reach is `isPayoutsTreasurer` / `canSeePayouts` in `lib/online-payment-access.ts`.

**Leaving**
- The Disconnect window (`PayoutsCard.tsx`) gets its counts from `app/api/admin/payouts/route.ts`:
  - `teamsStillOwing` counts **tournament teams only; house league is not counted**;
  - `debitsClearing` covers the whole org;
  - the disconnect itself only stamps `disconnected_at`.
- **No ending expires an open Checkout session.** `expireCheckout` (`lib/stripe-connect.ts`) is called only by the two pay
  routes, plus 12d-1's hand-recording path.
- Owner plan moves are in `app/api/billing/downgrade/{preflight,confirm}`, `app/api/billing/cancel/{preflight,confirm}`,
  `app/api/billing/move` and `lib/plan-move.ts`. Operator moves are in `app/api/platform-admin/orgs/[id]/cancel-subscription`,
  `.../plan` (via `lib/operator-plan-change.ts`) and `.../delete`. Retention is in `lib/billing-retention.ts`. **None of
  these mention online payments or Connect.**
- The delete route refuses only while a subscription is live. `online_payments`, `online_payment_refunds`,
  `org_payment_accounts` and `platform_debit_fees` (or 12d-1's successor) all **cascade on org delete**. Decide with the
  drawing and `/dba` what a deletion must refuse or keep: a money record of a club that still owes Stripe fees must not
  vanish silently.
- The plan gate is `online_payments` at `tournament_plus` (`lib/plan-features.ts`). Check that losing the gate on a
  downgrade **never stops a webhook from landing** a clearing debit, a refund or a dispute.

**Terms**
- `org_payment_accounts` holds `terms_version`, `terms_agreed_by`, `terms_agreed_by_email` and `terms_agreed_at` (mig 358,
  with an all-or-none check). They are written by `app/api/admin/payouts/route.ts`, which refuses without
  `agreeToTerms` and audits.
- `PAYMENTS_TERMS_VERSION = 'placeholder-counsel-pending'` and `TERMS_PLACEHOLDER` live in `lib/online-payment-words.ts`.
- The set-up window is `BeforeWindow` in `PayoutsCard.tsx`. Its Continue button is `disabled={!agreed || busy}`; ask 6
  makes it absent until ticked.

**Platform admin**
- The club record is `app/platform-admin/orgs/[id]/page.tsx`, with tabs in `ClubRecord.tsx` (Story, Money, Access, People
  & tournaments). Money is `MoneyTab.tsx` and the Story is `lib/platform-story.ts`.
- A new Health page needs three things:
  - a `PlatformArea` and its access in `lib/platform-areas.ts`;
  - a menu item in `app/platform-admin/console-menu.ts`;
  - optionally, a Today count in `lib/platform-waiting.ts` (`QUEUES`, `group: 'health'`).
- `PLATFORM_POWERS` is in `lib/platform-areas.ts`. It has no payments power. **Read only needs no new power**, but it does
  need an area and its access, so choose who reads it with the console's existing roles. One rulebook: never a second
  permission list.

## Before any code

1. **Product-manager UX summary** (AGENCY_RULES, blocking). Cover the treasurer, the owner, the house-league desk, the
   tournament organizer, a family or team mid-payment when an ending lands, and each console role. Get the owner's yes.
2. **Stripe facts, from the current docs, written into plan §0 (12d state):**
   - listing payouts on a connected account, and the balance transactions inside one (contents are listable **for
     automatic payouts only**; say what the tab shows for a manual one);
   - how a payout's line ties back to our payment (charge → payment intent → our row);
   - the arrival date versus the created date, and which one the bank statement shows;
   - a failed or cancelled payout, and how to show one;
   - rate limits when a season holds hundreds of payments;
   - expiring an open Checkout session (what happens if it completes at the same moment);
   - whether a disconnected or downgraded club's account still receives dispute and refund events.
3. **Bring these to the owner as short proposals with a recommendation, before building them:**
   a. **Read through, or keep a copy:** whether the Payouts tab reads Stripe live each time or stores payouts. Recommend
      live, with a short cache, unless Stripe's limits say otherwise; a stored copy is a second record that can drift.
   b. **What a deletion does while money is in flight** (a debit clearing, a dispute open, a Stripe-fee invoice unpaid).
      Recommend refusing, with the window naming what's in flight, as the subscription check already does.
   c. **Who in the console reads the new tab and Health list.**
4. **`/dba`** only if a migration is needed: a terms-change notice table or columns, deletion guards, or a payout cache
   if 4a goes that way. Dev only, with RLS, the dictionary, both snapshots, `check:dictionary`, and
   `MANUAL_PROD_STEPS.json`.

## What to build, in parts

**Part 1 · Schema (only if Before-any-code 4 needs it; commit first).**

**Part 2 · Accounting › Payouts (frame 3).**
- The tab is last in Accounting's row, for everyone who reads Accounting, with loading, error and empty states (the /ux
  findings). **It is hidden for a club that has never connected payouts** (owner 2026-10-27, words §7 question 6). The
  "not connected" words exist but are not used.
- Each payout opens to its payments by name and receipt (both flows), dates, Find, and Export in the house format.
- The owner's Payouts card carries the same list, collapsed, for a club without Accounting.
- Refunds, returned debits, dispute withdrawals and Stripe-fee lines inside a payout are named as such. Never a bare
  Stripe type.
- Read once per screen, never per row.

**Part 3 · Leaving (frame 4).**
- **Disconnect:** the window adds the house-league count and the count of open pay pages. Disconnect closes those pages.
- **Downgrade:** online payments stop on the move date, open pages close on that date, clearing debits, refunds and
  disputes finish, and payouts stay connected. The preflight windows tell the owner what's outstanding, and the operator's
  plan change does the same.
- **Cancel:** the same, with the window's count.
- **Deletion:** as ruled in Before-any-code 3b.
- Webhooks keep landing whatever the plan. Unit tests cover every ending against an open page, a clearing debit, an open
  dispute and a pending refund.

**Part 4 · The terms (frame 5).**
- The Payouts card's read-out: who, when, which version.
- A terms-version change raises the notice on the card and an owner item, and payments stay on.
- Set up again, reconnect, and change who pays the fee each require the current version, through the same agree window.
- Agree is absent until ticked, in both windows.
- The version and text stay counsel's placeholder until counsel ships. Changing the constant is the whole act of
  publishing new terms.

**Part 5 · Platform admin (frame 6).**
- The club record's **Online payments** tab, read only: the account's state, payments, refunds, disputes, Stripe fees
  billed and their invoices, and the terms read-out.
- **Health › Online payments** across clubs (an unpaid own invoice gets its row here; owner 2026-10-27): open disputes
  by due date, unpaid Stripe-fee invoices, failed fee billing,
  and debits clearing.
- The Story gains the online-payment events the drawing names.
- No write anywhere. 12d-1's retry for failed fee billing stays where 12d-1 put it.

**Part 6 · Help, records, layout.**
- `/docs` for the Payouts tab, leaving (Disconnect, downgrade, cancel), the terms read-out and agreeing again, and the
  console's new tab and list.
- `npm run check:spelling`.
- `check:layout --changed` on the touched screens at 1440 and 390, in Warm and Dark.
- Demos follow the product.

## Definition of done

- Parts committed; `npm run verify:changed` and `npm run typecheck` clean. Run `/review` on Part 3 (plan moves and
  deletion) and on the whole.
- Unit tests:
  - a payout's lines mapped to payments in both flows (a refund, a returned debit and a dispute inside one);
  - every ending against each kind of money in flight;
  - the terms version gate on set-up, reconnect and who-pays;
  - Agree absent until ticked;
  - console access by role;
  - the treasurer never offered a door that moves money.
- **End to end in test mode** on the test Express account:
  - a payout (Stripe's test payouts) read on the tab and exported;
  - a downgrade and a Disconnect with a page open and a debit clearing;
  - a terms version bumped, then agreed again.
  - Email checks go in the ONE final end-to-end pass on Amplify dev.
- **The walk:** a checkable Artifact plus the next § in `OWNER_QA_LEDGER.md`, one purpose per walk. That is likely two:
  payouts and terms, and leaving plus the console.
- **Records:**
  - plan §0 and §4 (12d-2 state; **Stage 12's build is then complete**), and PM brief item 6;
  - the Club index (`ArtifactData`, `MBKRySURVFu3V9cZJvmjVr`, stage `s12`; read first and pin `if_version`);
  - the memory file `project_club_stage12_payments`;
  - the task list.

## Do not

- Charge real money, use a live key, switch the feature on in production, or change any Stripe dashboard setting.
- Write the terms' legal text, or publish a new terms version yourself.
- Give the treasurer, or any console role, a door that moves money. The platform view is read only (ask 7).
- Disconnect payouts on a downgrade (ask 4), or stop a webhook from landing because a plan lost the gate.
- Keep a second record of payouts without the owner's yes (Before any code, step 3a).
- Rebuild 12d-1's parts, or anything for GST/HST (paused) or US clubs (a separate review).
- Type a rate or a Stripe timing.
- Reopen a ruling. If the code says one can't be built as drawn, bring it to the owner drawn, before building around it.
- Push or promote.

## Git

- `dev` only; explicit pathspecs; `git show --stat HEAD` after every commit. Build your commit in a temporary index when
  other sessions' work is staged.
- No push and no promote without the owner's word.
