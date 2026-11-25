# Board Ready Stage 6 · Part 4a — finish (review chain → probe → walk → commit)

Paste into a fresh session: **"Read and follow docs/projects/active/BOARD_READY_STAGE6_P4A_FINISH_PROMPT.md"**

Written 2026-11-25 by the session that ruled, `/legal`-checked and built Part 4a (Offer again). The code is built on dev
and **not committed**. The ruling records went in `e57935262`. No migration: Part 4a has no schema change.
The record of what was ruled and built is `BOARD_READY_PLAN.md` §5 Stage 6, in three bullets: "Part 4a — Offer again"
(rulings 1–12, verbatim), "Part 4a: `/legal` read ask 8 before any code" and "Part 4a BUILT on dev 2026-11-25". Read those three
bullets first. They are the brief; this file is the order of work. The drawing is
`BOARD_READY_STAGE6_P4A_OFFER_AGAIN_DRAWINGS.html` (https://claude.ai/artifact/UDHBeMq7hwLkmtJP3MHryJ); the build prompt is
`BOARD_READY_STAGE6_P4_BUILD_PROMPT.md` § Part 4a.

## ⛔ Start conditions
1. `git rev-parse --abbrev-ref HEAD` is `dev`. Run `git log --oneline -5 -- lib/club-sponsorship-offer-send.ts lib/club-sponsorship-deals.ts components/admin/kit/club/sponsorships/OfferAgainWindow.tsx`;
   if anyone has committed Part 4a's files since, stop and read what they did.
2. Typecheck is clean (`NODE_OPTIONS=--max-old-space-size=8192 npx tsc --noEmit -p .`) and, **from the repo root**:
   `node --import ./tests/ts-resolver.mjs --test tests/unit/board-ready-stage6-offer-again.test.ts tests/unit/board-ready-stage6-deals.test.ts tests/unit/board-ready-stage6-sponsorships.test.ts tests/unit/board-ready-stage6-p3a.test.ts tests/unit/board-ready-stage6-p3b.test.ts`
   passes (215 at hand-off). The full suite had 41 failures at hand-off, all in other sessions' files (org-slug callers,
   platform-admin css selectors, the schedule-admin old look, and a possessive guard on files outside sponsorships). Confirm
   none of the failures are in the files below before treating them as someone else's.
3. **The dev server needs a restart** before any browser use (new files and shared modules changed). Follow AGENTS.md: stop it, then `npm run dev`
   with network access, then the login-page 200 check.

## The files (all Part 4a's; checked 2026-11-25: no other session has hunks in them)
- **New:** `lib/club-sponsorship-offer-send.ts` (the one send step), `lib/club-sponsorship-offer-again.ts` (pure rows),
  `lib/club-sponsorship-offer-again-server.ts`, `app/api/admin/sponsorships/deals/offer-again/route.ts`,
  `components/admin/kit/club/sponsorships/OfferAgainWindow.tsx`, `tests/unit/board-ready-stage6-offer-again.test.ts`.
- **Changed:** `app/api/admin/sponsorships/route.ts`; `deals/route.ts`; `deals/[dealId]/route.ts`; `deals/[dealId]/email/route.ts`;
  `deals/[dealId]/again/route.ts`; `lib/club-sponsorship-deals.ts`; `lib/club-sponsorship-deals-server.ts`;
  `lib/club-sponsorship-deal-actions.ts`; `lib/club-sponsorship-deal-words.ts`; `lib/club-sponsorships.ts`;
  `lib/club-sponsorships-server.ts`; `DealScreen.tsx`; `DealsList.tsx`; `OfferDealWindow.tsx`; `OfferReasonFields.tsx`;
  `Sponsorships.module.css` (the `.again*` block at the end; its lines 91/95/107 predate this work); `deals-api.ts`;
  `tests/unit/board-ready-stage6-deals.test.ts`.
- **Records, also uncommitted:** `docs/agents/legal/BOARD_READY_STAGE6_SPONSORSHIPS_DRAWING_REVIEW.md` (the § Part 4a addendum)
  and `docs/agents/legal/LEGAL_INDEX.md` row 69. In `BOARD_READY_PLAN.md`, `BOARD_READY_PROMPTS_INDEX.md` and
  `OWNER_BRIEF_PROJECTS.json`, the Part 4a lines are this work's. **Other sessions have unsaved hunks in those three files**
  (club website, Stage 5), so commit them with a private index and exact hunks only (see memory: partial commit out of
  shared files).

## The chain, in this order
Each step's findings get fixed before the next step runs, and each fix gets a test where the bug class allows one. Record
each step's outcome in the plan's "Part 4a BUILT" bullet as you go (one line per step, positive facts).

1. **`/simplify`** on the Part 4a diff. Known candidates: the two near-copies of the "again" input (the deals GET builds one
   inline, and `readAgainInput` builds the same thing), and whether `offerAgainFill` in `deals/[dealId]/route.ts` belongs
   next to `canOfferAgainOne`. Do not merge the single Offer window with the batch window. The drawing keeps them apart.
2. **`/review`** (the repo's adversarial funnel). Point its lenses at:
   - the batch press re-deriving every row (bars, the reason's date, the place, Full against the running list, a duplicate
     sponsor and package);
   - the per-club busy guard and rate limit, which are per instance, so say what that leaves open on Amplify;
   - `readStandingPaidOn`'s paging and what it excludes (voided, returned, future-dated, a pending refund that ends the
     deal, an open dispute);
   - make → send → remove-if-failed in `offerNewDeal`;
   - **ask 1's Full fix across all four routes.** This is the part that fixes a bug live on production, so it needs the
     hardest look.
3. **`/marketing`** on the words. Everything in `DEAL_WORDS.again` marked DRAFT needs a voice pass. The drawn words stay
   verbatim unless the owner rules otherwise. The words were drawn and ruled, so a change to them goes to the owner as a
   call; it is not made silently.
4. **`/ux` at 390** on the Offer again window (full screen, Send in the foot, the head's ← is Cancel, the rows shown before
   "Show" set to 2 · 1 · 1) and on 12A's filled-in Offer window. Check that the in-row pickers and the date field fit
   without sideways scroll.
5. **`/legal` on the built batch.** Ask it to check the code against its own five must-fixes and two should-fixes (the
   addendum lists them), with path:line for each: the date worked out per row at the press, never posted; every bar read
   again at the press; one message per address with its own unsubscribe and the single offer's foot; one offer record per
   email; 12A hidden once the reason has run out, and a later typed "paid" date refused. It also writes the addendum's
   "built" note. `/accounting` is **not** needed: Part 4a changes nothing about what is charged, invoiced or recorded (the
   price and tax switch carry from the existing deal rules). Say so in the plan line.
6. **`/docs`:** add a new **Offer again** topic to the `club-sponsorships` article (`lib/help-content/org.tsx`, about line
   2171) with "offer again", "next year" and "renew" in its keywords. No topic covers this today. Cover the callout, the
   three groups and why a row waits or can't be emailed, the result line, and Offer again on one old deal. Also explain
   the Full change in one plain sentence: a package frees up when the new year starts, unless last year's deal is still
   showing.
7. **A probe** (in `.probe/`; password sign-in without a browser; read `reference_probe_signin_without_browser.md`):
   - GET the rows;
   - POST a press of two rows, one of which must fail (an unsubscribed address, or a package filled mid-press);
   - confirm one offer record per email, the reason's date equal to the latest standing payment, and the failed row's deal
     removed;
   - confirm a package that was Full last year reads free this year.
8. **The QA walk:** a checkable Artifact, 20–50 boxes, one action per step, exact logins, its own ledger § (the next free
   number in `OWNER_QA_LEDGER.md`; §565 was the last Stage 6 walk). Sign in as club owner `owner@dev.local` / `devpass123`,
   club **Dev Club Org**, at `http://localhost:3000`, which is the club the Part 3 walks used.
   - **Seed on dev first, never the demo worlds.** Dev Club Org needs a prior fiscal year of deals covering every row kind:
     a ready row, a price change, a tournament to pick, a team that waits, two divisions to choose from, a passed last day,
     an unsubscribed business, never paid, a payment over 2 years old, an archived package, and a paid deal from last year
     for 12A.
   - Write the seed as a re-runnable dev script. Tell the owner what it adds before you run it.
   - Walk order: the Full fix → the callout → the window at a desk → a press with one failure → the result line → 12A → the
     window on a phone.
9. **The commit, at the owner's yes only.** Two commits, both built through a private index:
   - (1) **ask 1's Full fix**: `holdsPlace` and `holdingDeals` and their uses in the four routes. Because it fixes
     production, it can go in a promote on its own.
   - (2) **the rest of Part 4a**: the records' lines and the walk HTML go with it.
   - After each commit, check that `git show --stat HEAD` lists only Part 4a's files.
   - No Co-Authored-By line. Do not push unless he says so.

## Owner calls to put to him (after `/review`, before the walk, in one message, each with a recommendation)
The build made these readings where the rulings were silent. The plan's "Part 4a BUILT" bullet holds them as (a)–(e), and
each is a small change to reverse.
- (a) A team row's "new teams" are teams outside last year's own season.
- (b) A package last day that passed over a year ago rolls forward a year at a time.
- (c) A package that fills mid-press fails that row with "the package is full".
- (d) A payment under an open card dispute doesn't count as "paid us" (`/legal`'s should-fix).
- (e) The DRAFT words, after `/marketing` has been through them.

**Not built, his call:** should the typed-date check (a "paid" date later than the latest payment on record is refused)
apply to **every** single offer of a business with payments on record, not only the one opened from 12A? `/legal`
recommends yes. If he says yes, build it in this session, before the walk, with a test.

## Not this session
Part 4b (the product-wide e-transfer sweep, the old sponsor list column, the `/legal` close-out) has its own part in
`BOARD_READY_STAGE6_P4_BUILD_PROMPT.md`. Do not start it here.
