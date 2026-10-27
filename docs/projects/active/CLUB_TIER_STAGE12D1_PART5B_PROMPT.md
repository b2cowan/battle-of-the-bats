# Club Tier Stage 12d-1, Part 5b: build the owner's 2026-10-27 rulings, then true up the help and the walks (handoff prompt)

> **Written 2026-10-27** at the end of the first Part 5 session. Paste into a new chat on `dev`. The parent prompts are
> `CLUB_TIER_STAGE12D1_BUILD_PROMPT.md` ("Definition of done", "Do not") and `CLUB_TIER_STAGE12D1_PART5_PROMPT.md`.
> **Your work is that prompt's §0, then the follow-through below.** Re-verify every lead against the code. Other sessions
> share this working copy: commit only your own hunks from a temporary index, then `git reset -q -- <your paths>`.
> Recommended model: Opus 5.5; helpers on Sonnet (broad reading goes to a helper).

## Why this is a separate part

The first Part 5 session read an early draft of the Part 5 prompt (no §0). The committed prompt (`dc235b749`, `4c3d34b69`)
puts five owner rulings FIRST. By the time that showed, the session had done §1–§5 against the code as it stood. The owner
chose (2026-10-27) to commit that work and hand §0 to a fresh session.

## Done in the first Part 5 session (committed; read before building)

- **Help** (`/docs`): tournaments `online-payments` gains *When a team pays twice, or more than it owes*
  (`online-payments-paid-twice`), *When a card payment is disputed* (`online-payments-dispute`) and *How a card dispute
  ends, and its fees* (`online-payments-dispute-ends`), the refund line, and three new Needs attention items; house league
  `registrations` gains `registrations-dispute` and `registrations-dispute-ends`, the open-page note on Mark received, the
  "fee was paid twice" item and the refund line; families' Record a payment closes an open page; org gains a new section
  **`stripe-fees`** (*Stripe fees on your online payments*), and the Payouts paragraph points at it. Search terms added to
  each. ⚠ The Part 5 prompt's lead "12c's help says a card dispute is 12d's" was **false**: no help said so.
- ⚠ **Corrected a Part 4 help line**: the Payouts paragraph said both dispute fees "go on the same invoice". The 10-27
  probe and ruling 5 say a card dispute's fee usually comes from the club's own Stripe balance and is billed only when
  Stripe charged FieldLogicHQ. The help now says that.
- **Stripe setup guide**: the five `charge.dispute.*` events in window 1 and the staging destination; the billing
  webhook's full event list (it was behind the code) plus the fee-invoice events; one "⚑ Owner's step" table (12c + 12d-1).
- **Tests:** the done list is covered (107 tests in the 12d-1 files pass); the dispute's whole life lives in
  `scripts/online-payments-12d1-check.sql` T5–T12. Nothing added.
- **Gates:** spelling clean; typecheck's one error and the unit suite's 10 failures are other sessions' (11b practice time,
  tryout address, S7 leads, team move, staff memberships, toolbar, table access). `DisputeBlock.tsx` gained its
  `org-slug-ok` comment (the gate's false alarm: the route reads the org from the POST body).
- **Walks** (§395 paid twice, §396 disputes and fees in `OWNER_QA_LEDGER.md`; artifacts
  `GmV1oKgXPb1RmVRNSeHw2i`, `RKnhTRAFymveVggrXCUTnG`). Helpers `.probe/s12d1-p5-answer.cjs` (answer a test dispute won/lost)
  and `.probe/s12d1-p5-monthly.mjs` (the monthly invoice step as of next month).

## 1 · Build Part 5 prompt §0 (rulings 2, 3, 5, 6, 7)

Exactly as `CLUB_TIER_STAGE12D1_PART5_PROMPT.md` §0 says: `/billing` first; build, test, `/review`, commit each. Ruling 3
updates the Facts doc and `/strategy`'s drift check in the same unit of work. Ruling 7 is a migration (credit note id on the
fee row) with the dictionary and snapshots; check Stripe's credit-note docs, not memory. Words go to `/marketing`.

## 2 · Then true up what the first session wrote

Grep and fix each, in the same commit as the ruling that changes it:
- **Ruling 7:** `lib/help-content/org.tsx` `stripe-fees`, the "Credited to your account" row ("It comes off your bill.")
  and the card-dispute row ("comes back if you win"); the tournaments and house-league *How a card dispute ends* "The
  fees" paragraphs. Say what the credit note does on a paid and an open invoice, in the list's new words.
- **Ruling 3:** `org.tsx` `stripe-fees` "A returned bank debit" row ("Stripe's fee when a bank debit comes back or is
  reversed") gains "nothing when Stripe charged nothing"; house-league `registrations-bank-debit` and tournaments
  `online-payments-bank-debit-returned` say "Stripe charges a fee when a debit comes back". Check each against the build.
- **Ruling 5:** house-league `registrations-dispute-ends` "Lost" row says the bulk send leaves the family out; add that a
  single "Email the pay link" warns first.
- **Ruling 2:** `org.tsx` `stripe-fees` ("the owner's Plan & billing page shows Stripe fees") holds for a cancelled club too;
  say so if the build adds words for it.
- **Walk §396** (`CLUB_TIER_STAGE12D1_WALK_DISPUTES_FEES.html`): add steps for rulings 5 and 7 where they show (C after the
  loss; B or E for a returned answering fee), and republish to the same artifact (pass its URL; read it first). Update
  the ledger §396 note "Written before Part 5's §0 rulings…".
- Run `npm run measure:help` (the `stripe-fees` section sits near the 350-word line).

## 3 · Still owed from the first session

- **`check:layout` did not run.** The first try aborted at the memory floor; the re-runs (after refreshing the sessions)
  landed every screen on "Page not found", the help pages included, in both themes. Parts 2 and 3 saw the same and blamed
  the UAT fixture; a dev server low on memory is the other suspect. Find which before re-running (a fixture check, or a
  dev-server restart when no other session is using it), then run the nine screens
  at 390 and 1440, Warm and Dark: `admin-hl-registrations, admin-hl-ledger, admin-t-registrations, admin-org-billing,
  admin-org-settings, admin-help-house-league, admin-help-tournaments, admin-help-org, admin-help-families`. No fixture
  holds a dispute, an overpaid team or a fee, so the new blocks are measured only by the walks.
- **`check:demos` is red since 12c Part 4** (`171a4ea91`): `lib/registration-attention.ts` imports `./tournament-teams`
  without its extension, which plain Node (the demo sandbox check) cannot load, and that file does the same with
  `./utils`. Not 12d-1's; the clean fix moves `lowerEntry`/`lowerEntryRow` to a dependency-free module. Bring it to the
  owner before touching shared modules.
- **Records:** this session wrote plan §0's Part 5 line, the PM brief, the Club index, memory and TODO. Update them again
  when §0 is built.

## Not this part

12d-2. Any Stripe dashboard setting, live key or real money. Applying 395 on production (a release step, its own yes).
