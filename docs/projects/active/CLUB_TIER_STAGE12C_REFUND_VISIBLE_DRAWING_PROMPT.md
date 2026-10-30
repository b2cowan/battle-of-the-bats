# Club Tier Readiness, Stage 12c: draw "a refund you can see" (prompt)

> **Written 2026-10-26**, after the 12b walk (§380). **Paste this into a new chat on `dev`.** Other sessions share this working copy
> (TODO, the Stage 12 plan, the PM brief and the Club Tier index carry their edits): stage explicit paths only, and commit only
> your own hunks.
>
> **This is a drawing session, not a build.** No product code, migration, seed, help article or demo change.

## What this is, and what is already settled

During the 12b walk a house-league child was declined while the family's Checkout was open. The family's card payment then arrived
for a registration already ended, and the club refunded it to the card through the "couldn't go on this row" door. The refund
worked (Stripe has it, the fee share came back as a "Payment processing" cost), but nothing on the registration says the family
paid and was refunded: the Fee column reads "—". The book is right (nothing came in, nothing went out against the child); the gap
is that the refund is a fact no screen shows. The owner asked for three things and agreed to all of them.

**Ruled 2026-10-26, plan §0g — do not reopen** (record each as ruled; add nothing):
1. **A card refund is visible on the registration.** Amount, date, status (Pending / Refunded / Failed) and Stripe's refund
   reference, for refunds that never reached the book as well as ones that did. The Fee column never reads "—" for a child who
   paid. The full detail (reference with a copy button, card, fee share, who, when) is in the row's record window.
2. **A refund made in the club's own Stripe dashboard on a house-league payment is recorded automatically.** Today it raises a
   Needs-attention item for a person. Tournaments already auto-record a full dashboard refund.
3. **A house-league refund email goes to the family, in the club's name:** amount, date, card, reference, the club's contact. Not
   Stripe's own receipt (it is not sent in test mode and follows each club's Stripe settings).

Also ruled earlier and binding here: **the treasurer logs the accounting and does not refund, in either flow** (§0f); **the family
pays the processing fee by default and the club may choose to pay it (A14)**, and the fee share of a refund comes back only when the
club ticks the box; a partial refund never takes our own fee (§0e); **a refund books when Stripe accepts it** for house league; **a
registration's payment state is a fact on the payment, never a registration status**.

## The facts the drawing rests on (re-verify each against the code before drawing on it)

| Fact | Where to look | Consequence for the screen |
|---|---|---|
| Card refunds live in `online_payment_refunds` and no screen reads that table; the house-league Money tab's Refunds list reads **book lines**, so a refund that never reached the book appears nowhere | `lib/online-payment-landing.ts` (`refundOnlinePayment`, `landRefund`), `app/[orgSlug]/admin/house-league/seasons/[seasonId]/money/page.tsx` | Draw the registration AND the Money tab's Refunds list for the same child so the two agree; say which one carries a refund that never booked |
| The registrations screen has the Fee column, the row's record window and the "couldn't go on this row" door | `app/[orgSlug]/admin/house-league/seasons/[seasonId]/registrations/page.tsx` and the components it mounts | Draw the cell and the window for: paid and refunded in full, refunded in part, refund pending, refund failed, refund never booked, and a plain unpaid child (unchanged) |
| A refund's states in the table are pending / succeeded / failed; a failed refund already raises a Needs-attention item for whoever may refund | `lib/online-payment-landing.ts` (`refundFailed`, `card_refund_failed`) | The cell's "Failed" must lead to the same door as the bell item, not a second one |
| A dashboard refund on a house-league payment currently raises `online_payment_not_recorded` ("refunded in Stripe") for a person; for tournaments `applyRefundEvent` already settles a full one | `lib/online-payment-landing.ts` `applyRefundEvent` (~line 548-600) | After the change that item goes away for the clean case. Draw what the club SEES instead (the registration shows it, marked as made in Stripe), and the cases that still need a person: a partial refund, a refund on a child still enrolled, a payment that never landed |
| `sendRefundEmail(refundId)` already exists and is called when a refund lands with a Stripe refund id. **The plan says only tournament refunds email the family; the code at `landRefund` does not look tournament-only. Check what a house-league refund sends today and in what words**, then draw only the difference | `lib/online-payment-receipt.ts:126`, `lib/online-payment-landing.ts:351` | If the email already goes, the ask shrinks to its words, a dashboard refund, and a failed or pending one; say so on the drawings page |
| Receipt and refund wording already ruled for 12a/12b (club's name, club as reply-to, test-mode mark, no bank-account line) | `docs/projects/active/CLUB_TIER_STAGE12A_COPY.md`, `CLUB_TIER_STAGE12B_COPY.md` | Reuse, do not re-word |
| The Families record's "Paid online · card ·" line and "View the payment" were named and NOT built in 12b | plan §0 state, §0f | Do not draw them here unless a frame needs them; if it does, say so as a dependency |
| A partial refund of a tournament team's card payment is built in 12c too, but it is its own change (an amount field in the team's refund window) | plan §4 12c row, §0f | Out of this round. Draw the tournament side ONLY if a team's payment row has the same visibility gap, and say so |

## Read first

`AGENTS.md`, `AGENCY_RULES.md`, `CLAUDE.md` (broad reading goes to a helper; a helper's summary is a lead, open the cited lines
yourself; disagree out loud). The Stage 12 plan `docs/projects/active/CLUB_TIER_STAGE12_PAYMENTS_PLAN.md` **§0e, §0f, §0g, §3 and
§4**, and its PM brief. The Stage 12 drawings https://claude.ai/artifact/X7quYgnDpiWV9Dh76TYm57 (the club frame and the house-league
registration frames to follow). The 12b walk (§380, `CLUB_TIER_STAGE12B_WALK.html`) for what was actually seen. The house UI rulings
in the auto-memory index that touch this screen: mockups are Claude Artifacts at true size, whole-screen before/after; a record
READS first and EDITS whole; a waiting count is the amber pill, never "· 1 to review" in a name; every highlight is clickable; money
figures are one joined band; the autosave word is transient; absent beats disabled; one spelling; "8:00 a.m."; the bare possessive.
Check each against the code before drawing on it.

## Push back (out loud, on the drawings page, before the work)

1. **"Fee column never reads —" vs a book that says nothing came in.** A child refunded in full has a fee of $0 in the book. A cell
   that reads "Refunded $156.75" is true, but a column called Fee now means two things (what the child owes, and what happened on a
   card). Weigh: the refund as a **quiet second line under the fee figure**, a small status pill beside it, or its own column that
   shows only while the season has a card refund. Recommend one, draw the other two small.
2. **Money tab and registration must tell one story.** The Refunds list on the Money tab shows booked refunds only. A refund that
   never booked would be visible on the registration and absent from Money, which is the bug moved one screen over. Recommend whether
   the Money tab's Refunds list also lists unbooked card refunds (marked as not in the book) or points at the registration.
3. **A dashboard refund records itself: when must it NOT?** The owner agreed it should. A refund of part of a payment, or on a child
   who is still enrolled, changes what the club has collected with no person at the keyboard. Draw the recorded state AND the
   "needs a person" state, and recommend the dividing line (for example: record only a full refund of a payment whose registration is
   ended; everything else stays a Needs-attention item with the refund already shown).
4. **The email on a failed or pending refund.** A family should not be told "refunded" for a refund that is pending or failed.
   Recommend: no email until it lands; a pending refund shows to the club only; a failed one goes to the club's refund people, never
   the family. Say what the family hears if the club refunds in Stripe's dashboard on a day Stripe's webhook is late.

## What to produce

1. **One published Artifact** (source `docs/projects/active/CLUB_TIER_STAGE12C_REFUND_VISIBLE_DRAWINGS.html`; load `artifact-design`
   first), in the shape of the Stage 12 drawings: before = today's screen; after = drawn at **true size**, a desktop and a phone for
   each frame; NEW / RESTYLED / UNCHANGED tags; clickable flags; one checkbox per option for each ask; a paste-back summary at the end.
2. **Frames:** (a) the registrations screen with the Fee cell in each state listed in the facts table, desktop and phone; (b) the
   row's record window with the refund detail (reference with copy, card, fee share, who, when; the refund made in Stripe marked as
   such); (c) the Money tab's Refunds list for the same children (ask 2); (d) the family's refund email in the club's name, in each
   state it can be sent (and the states it must not be sent in, named); (e) the Needs-attention item before and after (the clean
   dashboard refund no longer raises one; the cases that still do); (f) what a club with no card payments sees: nothing changes.
3. **Words:** provisional, marked provisional. Final words go through `/marketing` **after the owner rules**, before any code
   (house rules: sentence case, "8:00 a.m.", the bare possessive, `npm run check:spelling`).
4. **Flow + design:** run `/ux` on the journey (who, where, how long, what goes wrong: the registrar who finds the child refunded; the
   club that refunds in Stripe and expects the book to follow). Run `/design` on the whole page **before the hand-off**, apply its
   fixes, republish, report what it changed.
5. **Asks:** numbered, each with a recommendation; **ask 1 = where the refund sits on the row** (push-back 1).
6. **Records, same unit of work:** plan §0g gets "drawn, asks open" with the link; `TODO.md` (the 12c line only); a PM brief line (what
   a registrar, a club admin and a family see differently); the Club Tier index `s12` stage (read `stages` first, pin `if_version`,
   state `ruled` only after the owner rules); the Stage 12 auto-memory file. Record rulings as ruled.

## Do not

- Build, migrate, seed or touch Stripe, AWS or DNS.
- Reopen §0f (the treasurer does not refund), A14 (who pays the fee), or the three §0g asks. Push back only on where, when and how
  they show, and name any real conflict.
- Draw bank debit, the tournament partial refund, the Families "Paid online" line or disputes (12d). Name each as a dependency if a
  frame touches it.
- Restate a plan name, price, rate or gate: point at `PLAN_PRICING_FACTS.md`. A fee figure in a drawing is computed from the Facts doc
  line, never typed.
- Promise timing anywhere.

## Definition of done

The drawings page is published and linked from plan §0g; `/ux` and `/design` have run and their changes are reported; every frame in
item 2 is drawn in its empty, working and edge states; ask 1 is answered with a recommendation and the other two placements drawn
small; the email question (does a house-league refund already email, and what does it say) is answered from the code; the records say
"drawn, asks open"; and a build prompt for the 12c refund-visibility piece can be written from the owner's answers without
re-deciding anything.
