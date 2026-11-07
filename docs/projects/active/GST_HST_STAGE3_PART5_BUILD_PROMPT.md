# GST/HST Stage 3 · Part 5 build prompt (closeout + the owner's walk)

GST/HST Stage 3 Part 5 is the closeout. Parts 0 to 4 are committed (Part 4 is `4f74d04eb`, plan log `329b1bedd`). Part 5 builds **no new
feature**: it proves Stage 3 end to end, writes the owner's walk, settles what the earlier parts left open, and closes the stage's paperwork.
Do not start Stage 4 (the return worksheet). Recommended model: Opus (it judges money records and writes the owner's test).

Mark each fact [V] (you opened it, file:line) or [H] (handed to you). Line numbers drift: re-open before relying on one. Nothing below was
opened by the session that wrote this prompt except where marked [V].

## Read first (in this order)
1. docs/projects/active/GST_HST_STAGE3_BUILD_PROMPT.md: the "Part 5, closeout" paragraph (about line 133) and the whole ▶ Progress log,
   especially the open items listed under "What Part 5 must settle" below. [V paragraph exists at 133]
2. memory (auto-memory) feedback_qa_walkthroughs_as_checkable_artifacts.md and feedback_deep_dive_is_walk_then_stages.md: how an owner walk is
   built (a published checkable Artifact, ONE purpose per walk, a "Sign in as" card, Do → You should see, localStorage ticks, paste-back).
3. docs/projects/active/OWNER_QA_LEDGER.md: the entry format (`## §N · …` with `<!-- §N -->` … `<!-- /§N -->`); copy §471 or §474.
   [V the highest section is §476, so the next free number is §477; re-check before writing, another session may have taken it]
4. docs/projects/active/GST_HST_STAGE3_PART2_DRAWINGS.html (https://claude.ai/artifact/NwkZe2YiwiN7Ydua9JVntA): the screens the walk looks at.
5. supabase/migrations/MANUAL_PROD_STEPS.json: entries `451_every_charge_keeps_its_tax.sql` and `452_a_sale_can_be_marked_looked_at.sql`
   [V both exist, status "pending"; 451's note carries the order, a verify SQL, the backfill check and the Stripe event steps; 452 has no Stripe step].

## What Part 5 does (the plan's paragraph, plus what the later parts added)
A. **Re-run the Stripe test matrix rows that create invoices and prove every one produced a record.** [H] The Stage 2 scripts are the base:
   `.probe/gst2/part6-checkout.mjs --make` / `--after` (clubs ON, NB, US, ON with its own GST/HST number, plus a coach, on test clocks),
   `part6-renew.mjs`, `part6-moves.mjs`, `part6-founding.mjs`, `part6-fees.mjs`, and the refund and credit-note rows
   (`part6b-part7-refunds.mjs` is the last all-pass re-run). Run: `node --env-file=.env.local --import ./.probe/gst2/part6-loader.mjs <script>`;
   needs `STRIPE_SECRET_KEY` starting `sk_test_`, the dev Supabase keys, and the dev server up for the route-driven ones. **Test mode and the dev
   database only.** The matrix never had a record to check before Stage 3, so ADD the check: after each row, look up
   `platform_charge_tax_records` by `stripe_invoice_id` (and `platform_credit_note_tax_records` for notes) and assert a record exists with the
   right position and reason. Save results beside the others (`.probe/gst3/part5-matrix-run1.txt`).
B. **Prove the backfill once on dev.** [H] The daily job's `tax_records_backfill` step (every invoice and credit note from 2026-05-01, 120 a run)
   is not probe-verified; it is covered only by the migration note's "check the job's audit row". Run it once on dev and read the audit row.
C. **Write the owner's walk(s)** as published checkable Artifacts, source files `docs/projects/active/GST_HST_STAGE3_*_WALK.html` [V none exists
   yet], one ledger section each. The memory rule is ONE purpose per walk (about 4 to 11 steps), so recommend three, grouped under one Stage 3 line:
   - **Walk A, the record is kept** (Part 1): a new test buyer pays; the record exists with the right reason and evidence; change the buyer's
     address afterwards and the OLD sale still shows the OLD address ("As it stood"); delete a test club and its records survive; a refund made by
     issuing a **credit note** in Stripe's dashboard appears as a credit note record.
   - **Walk B, the Money tab tells the tax story** (Parts 2, 3a, 3b): one row per sale with its Tax column; Show: All sales / Not paid;
     "Show older sales" (a gap year; a half-failed older page); a deliberately contradicted sale is flagged and the dot lights before the tab
     opens; the strip and Show them; Mark as looked at (needs a why) and Put it back; Today's Sales tax row and the Clubs filter; Support sees
     the list but not the mark door.
   - **Walk C, the band is before tax** (Part 4): see "The Part 4 looks" below.
   Each walk opens with What this walk is for / It passes when / Not in this walk / Sign in as (URL, email, org, the dev cast; never a prod
   account) / Where and on what. A destructive step goes last and says so. Pin identities and relationships, never as-of-today figures.
D. **Settle the open items** (next section), then **close the stage's paperwork** (last section).

### ⚠ A trap in the plan's wording
The plan says "refund in the Stripe dashboard → the credit note appears". Two different dashboard actions exist and the built product treats
them differently. **Issuing a credit note** in Stripe's dashboard creates a credit note, and our record gets it (by the webhook, or the daily
catch-up up to a day later if the credit-note events are not subscribed). A plain **Refund payment** on an invoice's charge creates NO credit
note, so the tax is not reduced: Part 3a's seventh check flags it ("refunded … in Stripe's dashboard with no credit note, so the tax was not
reduced") and Part 4's band says "no credit note, so no tax split". [H] Write the walk with BOTH, labelled, and never say a plain dashboard
refund makes a note.

### The Part 4 looks (Walk C)
- A club with a part refund that has a credit note: the Refunded cell shows it **once**, "Refunded, before tax", at the note's before-tax amount.
  [The Part 4 /review recorded a risk: a stored credit note's `refund_cents` is write-once, so if Stripe ever delivered a note before attaching
  its refund the refund would count twice (note, then unsplit). This step is the check. Read the row in the database to confirm `refund_cents`.]
- A club with a Stripe-dashboard refund and no note: "1 refund, <day> · no credit note, so no tax split"; with both kinds, "2 refunds, 1 with no
  credit note, so no tax split" and the label drops "before tax".
- Stripe unreachable: both cells end "· our record". (Find how Part 2's walk or tests made Stripe unreadable on dev; if there is no safe way,
  give the step two boxes, Did it / Skipped it.) Our record unreadable: the Paid cell says "includes tax; our records could not be read" (the same
  two boxes).
- The Story: a console refund reads "credit note CN-…, $44.25 + $5.75 tax"; a dispute says "including tax".
- Business numbers and Today: "about $X a month at list price, before tax".
- Paid is a **view by payment date, not the return** (it counts by the day paid; the return counts by invoice date). The walk should not ask the
  owner to compare the band with a return.

## What Part 5 must settle (owner questions and flags the earlier parts parked) [H, re-open each at the BP line shown]
Present these to the owner in a plain-language summary BEFORE any code or publishing (repo rule: a state not drawn is an owner question),
each with a recommendation. Build nothing new unless the owner rules it; a ruled change is its own small, reviewed commit.
1. **An eighth Needs-a-look check** (BP about 545 and 582): a sale Stripe zero-rated on a Canadian line to a buyer with a Canadian address is
   `zero_rated`, so none of the seven checks lists it. Recommended yes; it changes 3a's rules and Today's count.
2. **A customer held by two or more organizations** (BP about 584): a coach paying for two portals counts as shared, so its sales are on no club
   list and not in Today's count, against the 3a drawing. Either count them on Today and list every holder, or change the sharing rule.
3. **Check 7 clears on ANY issued note** (BP about 587): a note smaller than the refund leaves part of it unreduced. Leave as ruled unless tightened.
4. **Support sees the buyer's street address** in plain fields while the credit-note PDF with the same address is hidden from that role (BP about
   436): Ask 7 was ruled A; say whether the PDF reasoning should reach the address lines.
5. **Words the owner may reword** (BP about 445 and 489): "Read this tab again to see whether this charge can be refunded."; "1 sale needs a look
   at its tax."; "Which sales need a look could not be read."; "· no credit note, so the tax was not reduced"; and the empty state when the
   registration date is unread ("not checked" or the shipped sentence).
6. **USD before the first US club** (BP about 638): the band must sum the stored Canadian-dollar valuation or say more than one currency is
   present; today a mixed sum wears the first sale's currency. Ruled "leave as is"; confirm it stays recorded, not built.
7. **/accounting, the five flags the plan routed here** (BP 232 to 235): a USD credit note is valued at its OWN date's rate, not the invoice's;
   zero-rating rests on a US address plus the declaration; the pre-existing `platform_fee_invoices` cascade; a refund with no note leaves the tax
   unreduced; retention vs a delete of the Stripe customer. Run `/accounting` on these (and `/legal` on the retention-vs-deletion point and the
   six-year copy of a person's home address). Apply what they find or record each as an owner question.
8. **Known gaps to state in the walk's "Known before the walk"** (BP 236 and 237): `refunded_cents` stays 0 on a record the catch-up first wrote
   after a refund until the next refund event; and the credit-note events are on NEITHER Stripe endpoint yet, so a credit note lands by the
   catch-up up to a day late. **Before Walk A, ask the owner to add `credit_note.created`, `credit_note.updated`, `credit_note.voided` to the TEST
   billing destination** (dev.fieldlogichq.ca/api/billing/webhook) per 451's note, or the walk must run the catch-up and say so.
9. **Carried to Stage 4, not built here** (write them into the Stage 4 plan or the Progress log): the return worksheet must list sales with a
   missing GST/HST answer as unresolved items, marked or not; sum GST/HST from `tax_lines`, not `tax_total_cents`; a lost card dispute has no credit
   note so its tax stays remitted unless written off (line 107); the band counts by payment date and the return by invoice date; a blended Refunded
   cell never feeds the return; the FX day (a USD invoice issued before the Bank of Canada posts its rate takes the prior day's rate).

## Do not
- Do not touch live Stripe, production, hooks or settings. Owner steps go in `MANUAL_PROD_STEPS.json`; the probes use test-mode keys only
  (the scripts refuse a key that is not `sk_test_`), and every object they make is deleted after.
- Do not change the record tables, their writer or reader contract, a migration, plan prices or any plan-config number.
- Do not build the eighth check, the shared-customer change, a currency change or any reworded string unless the owner rules it in the summary.
- Do not call a walk PASSED unless the owner pastes back ticks. A skipped or owner-closed walk is recorded as a waiver or CLOSED, never PASSED.
- Do not restart the dev server mid-session; restart once near hand-off only if files outside tests/docs changed. If you start it, use
  `npm run dev` with network access and check `http://localhost:3000/platform-admin/login?next=%2Fplatform-admin` returns 200.
- The tree is shared and dirty: re-read each file fresh and commit ONLY your hunks with explicit pathspecs (templates `.probe/gst3/commit-4.cjs`
  and `commit-4-record.cjs`; never `git add -A`). No commit or push without the owner's yes; earlier yeses do not carry over.

## Rules for the session
- Before anything is built or published, a plain-language summary for a product owner: what the three walks cover and why three, the nine items
  above each with your recommendation, and the setup the owner must do first (the TEST webhook events, the dev server). That is a blocking step.
- Walk contents come from the shipped strings, not memory: read the words from `SALES_WORDS`, `NEEDS_LOOK_WORDS`, `BAND_WORDS` and the Story code,
  and pin identities (a club, a buyer, a sale) rather than figures. Verify every identity against the fixture AND the code before publishing; open
  the published URL once as the cast account.
- A step that writes leaves a fingerprint: when the paste-back comes in, read every writing step's row (`node scripts/db-query.mjs --dev -q "…"`)
  and the put-backs before recording a pass.
- Write the walks ALONGSIDE `/simplify` and `/review`, never gated on them; if a fix changes a quoted line, update and republish.

## Done when
- The matrix re-run shows a record for every invoice-creating row (results saved), and one dev backfill run is read from the audit row.
- Three walk Artifacts are published (source `.html` files in docs/projects/active, URLs in three new ledger sections starting at the next free §),
  each with a Sign in as card, Known before the walk, and the paste-back button.
- Each of the nine items is ruled by the owner or recorded as an owner question; `/accounting` and `/legal` have run on item 7.
- `MANUAL_PROD_STEPS.json` 451 and 452 are confirmed final (order, verify SQL, backfill check, the Stripe event steps for TEST and LIVE).
- ▶ Progress entries in GST_HST_STAGE3_BUILD_PROMPT.md (positive facts with anchors, never "uncommitted"); TODO.md's Stage 3 line and the
  auto-memory project_gst_hst_collection.md plus its MEMORY.md line updated. **Stage 3 is marked CLOSED only after the owner's walks pass**; until
  then say "walks published, owed".
- Hand-off in product-owner voice: what the owner must do first, the three walk links, what each looks at, what was settled or left open, the commit
  hash if the owner said yes.
