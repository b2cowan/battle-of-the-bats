# Club Tier Stage 12d-1, Part 4: every club pays its Stripe fees (handoff prompt)

> **Written 2026-10-27** at the end of Part 3's session. Paste this into a new chat on `dev`. The parent prompt is
> `CLUB_TIER_STAGE12D1_BUILD_PROMPT.md`: its rulings, its "Do not" list and its Git rules all apply. **Re-verify every
> lead below before building on it.** Other sessions share this working copy: commit only your own hunks, from a
> temporary index (memory: "Partial commit out of shared files"), then `git reset -q -- <your paths>` only.
>
> **Recommended model: Opus 5.5.** Helpers stay on Sonnet. Part 4 is billing on every plan plus a new scheduled job (its
> own commit: AGENCY_RULES watched paths). `/billing` reads `docs/agents/strategy/PLAN_PRICING_FACTS.md` first.

## Where things stand

- **Part 1 (schema):** `c938e871a` (mig 390), `380528304` (mig 391). Dev only, declared pending in `MANUAL_PROD_STEPS.json`.
- **Part 2 (paid twice):** `23510b099` + its /review `2668e40f7`.
- **Part 3 (card disputes):** `20525a222` (server), `77cddf92b` (screens), `717f6811b` (its /review). No schema change.
  What you can lean on:
  - `applyCardDispute` (`lib/online-payment-landing.ts`) writes every dispute event through `online_payment_dispute_apply`.
    The dispute row holds `stripe_fee` and `fee_paid_from` as Stripe reported them on the **club's** balance (ruling 5:
    recorded, never invoiced). `disputeFromStripe` (`lib/online-payment-dispute.ts`) sums the fee of the withdrawal balance
    transactions; no answering fee was ever seen separately.
  - A fee Stripe charges the **platform** for a dispute (a platform balance transaction whose `source` is the dispute: the
    sandbox showed this for a BANK DEBIT's CA$5) is **not read anywhere yet**. That is Part 4's: read it, record a
    `platform_stripe_fees` row at Stripe's figure, bill it.
  - `disputeAnswerer(orgId)` is the person who set up payouts (owners; `connected_by` leads).
  - The dispute email kind is `card_dispute_opened` (unlogged, class `team`); `opened_emailed_at` is stamped.
  - `DISPUTE_WORDS` / `DISPUTE_EMAIL_WORDS` (`lib/online-payment-words.ts`) hold §1.1–§1.6; `disputeDue()` formats a due
    date, `endSentence()` absorbs a clock's own full stop.

## What Part 3 learned (read before you design)

1. **Raise from the rows, never from a call's answer.** The /review found the lost item raised only on the call that
   booked the loss: a failure after the commit lost it for good. Every item and email in the daily job must be decided by
   the row's state plus a once-only stamp, so a rerun owes nothing twice and loses nothing.
2. **The daily job must skip a lost dispute.** "Email families who owe" skips a child whose dispute was lost (words §1.5:
   a family that took its money back hears from a person). That rule is **client-side only today**. The single "Email the
   pay link", the tournament payment reminders and any reminder the job sends must skip it on the server too.
3. **The three-days-before reminder** (§1.6 email 2) is the job's: only while unanswered, `reminder_emailed_at` stamped.
   Reuse `disputeOpenedEmailHtml`'s envelope; the words are `disputeEmail.reminder.*` (add them to `DISPUTE_EMAIL_WORDS`).
4. **Long id lists fail.** A `.in()` over a season's registrations rides in the URL and a select stops at 1,000 rows with
   no error. Start from the small table (the club's fees, disputes) or use `fetchAllIn` (`lib/supabase-paging.ts`).
5. **An extra read never takes a screen down:** the records read disputes with `.catch(() => empty)`. Do the same for a
   fee list on Plan & billing.
6. **The gates on this tree** (none from Part 3; re-check): `npm test` fails in files no 12d-1 part touched (the possessive
   guard on `TryoutCoachAddressLine.tsx`, coach membership, migration grants ×3, team move, org_id moves, the Teams
   toolbar regex, a coin-toss S7). `check:layout` needs the UAT fixture (broken on 2026-10-27; reseeding signs everyone
   out: ask first).
7. **Shell edits:** heredocs here drop backslashes (a regex in a test edit went in wrong). Edit tests with the Edit tool.

## Deferred from Part 3's /review (take the SQL ones to `/dba`, one migration)

- **A refused returned line rolls back the whole dispute write.** `online_payment_reverse` raises when
  `club_league_money('reverse')` refuses (the child's money already undone another way). Inside
  `online_payment_dispute_apply` that rolls back the status write too: the dispute stays "open" for good, Stripe retries for
  ~3 days, and refunds stay blocked. Catch it: store the dispute lost with `lost_booked_at` NULL and tell the desk.
- **Is `warning_closed` → `needs_response` the same dispute id?** Mig 391 treats a closed inquiry as final. Check Stripe's
  docs: if an escalation reuses the id, a chargeback after a closed inquiry is ignored.
- **Open statuses are not ordered:** a slow `needs_response` read can overwrite `under_review` (status text, `held`,
  `due_by`) until the next event. Cosmetic, but cheap to order in the same migration.
- **A payment paid but never landed** records its dispute, but a loss books nothing, and nothing re-books it if the desk
  later records the payment by hand. Rare; decide with `/dba` whether to book it then.
- **Part 2's open item, still open:** `online_payment_over_left` measures the team's whole surplus (two extras on one
  team). A loss then a win can now create the second extra.

## Found, not ruled (bring to the owner, don't build around)

- **Ending a child with an open dispute:** the ending's refund to the card is refused, so an ending that refunds is
  blocked until the bank decides (an ending without a refund still works). The words only speak of the refund door.
- **Every owner is an answerer:** with two owners, both get amber and "Answer in Stripe"; the email goes to the one who
  connected. `dispute.answererGone` (the person who set up payouts left) is still held by the words.
- **The dispute email is unlogged,** so the support console's Sent emails can't show a missed one. Logging it changes the
  owner's approved list of 37 (G1).
- **The tournament Money band has no note slot,** so `band.disputed` shows on house league only.
- **The refund policy in "Copy the facts" is today's,** not the one shown when the family paid (it isn't frozen on the
  payment).
- **A card dispute that arrives before its payment landed** finds no row (the charge id is written at landing) and is
  acknowledged. It needs a multi-day landing outage; listing the session by its payment intent would close it.

## Part 4: what to build (parent prompt §"Part 4", words §1.7, §3.4)

As the parent prompt says, unchanged: one billing path for every fee kind (`test_mode` exempt, `comped` gone; a live
undiscounted subscription rides its next invoice; every other club gets ONE own invoice a month, sent on the 1st, in our
email); a platform-charged dispute fee at Stripe's figure; the foreign-card cost from the ruled constant (plan §0: Stripe
gives no per-charge figure), compared with the club's connected account's country; "other Stripe fees" lines; platform
admin recognises a fee invoice and shows a failed bill with a retry; the three help articles; the Facts doc's built
status. **The daily job (the 3-days dispute reminder, the one unpaid-invoice reminder, the monthly invoice) is its own
commit.** Unit tests per the parent's Definition of done. `/review` on the whole of 12d-1 at the end.

## Not this part

Help for disputes and the Stripe setup guide's event list (the owner adds `charge.dispute.updated`, `.closed`,
`.funds_withdrawn`, `.funds_reinstated` in Stripe himself), the walks (Part 5). Anything in 12d-2.
