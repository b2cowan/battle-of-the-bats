# Board Ready Stage 6 · Part 2 — finish it (steps 1–7)

Paste into a fresh session: **"Read and follow docs/projects/active/BOARD_READY_STAGE6_P2_FINISH_PROMPT.md"**

Written 2026-11-23 by the Part 2 build session, for the session that closes Part 2 out. Part 2 (offering a deal, the
business's no-login page, the Deals list, one deal's page, the link-only drawing's 1A/2A/3A) is **built, uncommitted, and
running on dev**. Your job is the close-out, in this order. Plan of record: `BOARD_READY_PLAN.md` §5 Stage 6 (read Part 2's
calls (a)–(f) and the 2026-11-23 1A/2A/3A paragraph first). Build prompt: `BOARD_READY_STAGE6_SPONSORSHIPS_BUILD_PROMPT.md`
Part 2 (its `/legal` build rules and standing rules still bind). The drawing the owner approved:
https://claude.ai/artifact/HtZy3KAvEfbSY9MkqzFaSH.

## Where it stands (2026-11-23)
- Migrations **526 and 527 are applied to dev** (owner's word, 2026-11-22; the walk hold is lifted, §560 passed 46/46).
  Both are `pending` for production in `MANUAL_PROD_STEPS.json`, to go **only** with the promote that ships Part 2.
  ⚠ Today's release does not carry Part 2: if the release's dev-vs-prod migration check flags 526/527, they are skipped, not applied.
- The dev server was restarted after the last code change; Part 2 guard tests 41/41, typecheck clean.
- Full suite: 36 failures, none in Part 2's files (checked: team move, layout, grants, possessive — the rest belong to other
  sessions' tables and words). Don't fix other sessions' failures; list them if you touch them.

## Progress (2026-11-23, finish session 1) — steps 1 and 2 DONE; start at step 3
- Step 1 probe passed (before and after the step-2 edits). Step 2 `/simplify` and `/review` applied: 44/44 deal tests, typecheck clean.
- `/simplify` applied: one `gstHstRateOn`, `isUuid`/`joinWithAnd`/`formatInvoiceNumber`/`addCalendarMonths`/`canonicalAppOrigin` reused,
  `findTarget` shared, `DEAL_BANDS` used, the unused `readDeals` range and `docsTitle` removed, `markDealOpened` only when never opened.
  **Skipped on purpose (wide, touches the CASL send checks or signed-link code just before `/legal`; own unit of work):** one shared
  offer-email preflight for deals POST / Email the offer / Send the link again; one `dealTax` rule; the unsubscribe token/scope factory;
  one link-validity resolver; the signed-link codec shared with team-pay; the document hand-over and file-attach routes shared with the
  family form; the public-routes wrapper; sponsor-page query/round-trip trimming (page reads the deal 3×, org 2×).
- `/review` fixed: (1) **the service worker kept an offline copy of a business's sponsorship page** — now never-cache, cache v14, guard
  test extended; (2) a stale tab could submit for a deleted place and get an invoice — the public send re-checks the place;
  (3) a business was invoiced at the deal's CURRENT price, not the one its page showed — the page now sends the total it showed and a
  mismatch refreshes the page ("The price changed…", code `terms_changed`); (4) a document tick survived a changed document after a
  refresh — ticks now drop for a changed version; (5) tax is worked out in whole cents ($1.90 at 15% was 28¢, now 29¢); (6) Make a new
  link / Send the link again says so when someone else replaced the link first; (7) Do not offer again now also stops the address the
  business typed on its form; (8) Change this deal no longer half-applies (everything checked, then written); (9) the deal page reloads
  after a refused action.
- `/review` left OPEN (record in plan §5 Stage 6, none blocks the walk): Email the offer can double-send on two simultaneous presses;
  an emailed amount goes stale after a club edit (no re-email); Send the link again on an invoiced/paid deal kills the business's
  invoice link (a confirm dialog exists; by design? — owner call); a first offer that fails after a provider timeout deletes the deal
  and may leave a new business row; a sponsor-send result of "skipped" is recorded as sent (dev without a mail key); the stop list and
  `readDeals`/`doneFor` are unpaged (1000-row cap); a scanner prefetching the link marks the deal "opened"; the business's page and
  pending files are scoped to the club, not the deal; the Deals tab loads deals twice; **a club with its public site OFF probably shows
  the business page without the club frame — put it in the walk**; the Part 1 tabs read the deals, so migrations 526/527 must be on prod
  BEFORE the promote that carries Part 2 (strict order; do not make the read forgiving — it would hide Taken counts).
- Full-suite failures now 34, none in Part 2 (billing tax words, possessive, warm email shell, team move, plan-reader door, etc.). The
  dev-vs-prod schema parity and index-coverage gates are red for other sessions' tables and for 526/527 (expected until they ship).

## Progress (2026-11-23, finish session 2) — step 3 DONE; start at step 4
- Step 3 `/ux` at 390 (`.probe/stage6-p2-ux390.mjs`, `.probe/ux390-offer.mjs`; screenshots in `.probe/ux390/`): the form, the error box, the
  thank-you, withdrawn and replaced all fit with no sideways scroll; the phone Offer window is full screen with Cancel on the ←, two 44px
  buttons in the foot. `check:layout` on the three Sponsorships screens at 361: only "Show 1 archived" on Packages (19px, Part 1's screen,
  another session's file). ⚠ `--changed` on this shared tree picks up dozens of other sessions' screens and hits the memory floor — name
  the screens with `--only=` instead.
- Step 3 finding for the owner (words, not applied): the pay block says "will email your invoice" / "Your invoice comes by email" and the
  Email field's hint says "Your invoice and receipt go here", but Part 2 emails no invoice (Part 3 does); the thank-you shows it on screen.
- Step 3 fixes applied (owner's word 2026-11-23): the pay block and the Email hint no longer promise an emailed invoice (the page shows it);
  Copy and the footer address are 44px; the withdrawn/replaced page shows the address once (the frame's foot); a gap above the thank-you's
  closing line. 44/44 deal tests, typecheck clean, spelling clean.
- Step 4 `/docs` DONE: three sub-topics added to `club-sponsorships` in `lib/help-content/org.tsx` (Offering a deal · Emailing the offer: why
  you can email them · Unsubscribe and Do not offer again) with keywords/searchText; no new hub card (same section). 152 help tests pass.
  ⚠ `org.tsx` also holds another session's uncommitted hunk (plan & billing, ~9 lines): at step 7 stage only the sponsorships hunks.
  ⚠ When Part 3 emails the invoice, the offering topic's "it is not emailed" sentence and the page words must change together.
- Step 5 `/legal` DONE (record: `BOARD_READY_STAGE6_SPONSORSHIPS_DRAWING_REVIEW.md` § "Part 2 as built", index row updated): link-only, Email the
  offer, the run-out rule, the unsubscribe page and the pay-block words all hold. **One defect fixed:** the club's sponsorship stop list was read
  without paging (a stop past the 1,000th row would not suppress); it now reads every row in order (`readOfferBars`). The help's link-only
  paragraph now says a link pasted into the club's own email or text is the club's to justify. One owner question recorded (a Copy-the-link
  hint in the deal callout). 63 tests pass, typecheck, lint and spelling clean.
- Step 6 walk DONE: Owner QA Ledger §561, https://claude.ai/artifact/6kiJA8iXNDWnk31rzPdfkb (4 walks, 50 steps, 2 owner calls: a Copy-the-link hint;
  Send the link again on an invoiced deal). Source `BOARD_READY_STAGE6_P2_WALK.html`. UAT Rep Club (dev) set up through the product's own
  Setup save: mailing address 1 Walk Street, contact sponsors@uat-rep-club.local, e-transfer/cheque, one package; UAT Rep Only untouched.
  The walk writes deals Walk Pizza and Walk Bakery (withdrawn at the end), a stop for the owner's inbox address and for walk-bakery@example.com,
  and one invoice number; its mailing-address step clears and restores. **Step 7 (commit) waits for the owner's yes.**
- The probe's runs used invoice numbers 2026-001 to 2026-003 on UAT Rep Only (its deals were deleted; the numbers are spent on dev).

## The steps
1. **Probe** — `node --env-file=.env.local .probe/stage6-p2-link-only-probe.mjs` (passed 2026-11-23; re-run it after any
   code change in steps 2–5). Probes and your own checks use **UAT Rep Only (`uat-rep-only`) only**, and its sponsorship
   mailing address must be empty when you finish (it is null today). The probe sends no email; keep it that way.
2. **`/simplify`, then `/review`** on Part 2's diff (the file list below). Apply what holds up; re-run the deal tests
   (`node --import ./tests/ts-resolver.mjs --test tests/unit/board-ready-stage6-deals.test.ts`) and typecheck
   (`NODE_OPTIONS=--max-old-space-size=6144 npx tsc --noEmit`; plain `npm run typecheck` runs out of memory).
3. **`/ux` at 390** on the business's page (`/{club}/sponsorship/{token}`: the form, the thank-you, withdrawn, replaced)
   and the phone Offer window (2A: two buttons in the foot, Cancel on the ←). `check:layout --changed` only, never a full sweep on dev.
4. **`/docs`** — the help for offering a deal, Make the link only, Email the offer, the reason's When?, Do not offer
   again, and the sponsor unsubscribe. The full sponsorships guide is Part 4's; write only what Part 2 changes.
5. **`/legal`** on the offer email (its CASL foot: the reason, the club's mailing address, the unsubscribe), the
   sponsorship-only unsubscribe page and confirmation, and the business's page. Its re-check of 2026-11-22 is applied
   (findings 1, 2, 4, 5, 10 and calls (e)/(f)); this pass covers what was built since: Make the link only (an in-person
   link is not a message), Email the offer, and the run-out rule. Apply what it finds or record an owner question.
6. **The QA walk Artifact** — one purpose, 20–50 boxes, one action per step, exact logins (email + password per role,
   from walk §560 in `OWNER_QA_LEDGER.md`: an owner, a registrar with Sponsorships on, a treasurer), paste-back; owner
   calls never in the counter. Give it the next § number in the ledger. Cover: Offer a deal → Send; Make the link only
   (and all four "Send can't go" cases); the When? red line; the deal page's Copy / Email the offer / Make a new link /
   Send the link again on a run-out reason; the business's page on a phone and its thank-you with the invoice number;
   Do not offer again; the sponsor unsubscribe; Withdraw. A walk that emails needs a real inbox the owner reads and a
   mailing address on the walk club — set those up, say exactly what you set, and leave UAT Rep Only alone.
7. **Commit — only at the owner's yes.** Branch `dev`; explicit pathspecs only; after the commit `git show --stat HEAD`
   and confirm only Part 2's files landed. Record the hash in plan §5 Stage 6 and change the project's board line
   (`OWNER_BRIEF_PROJECTS.json`) in the same commit. No Co-Authored-By footer.

## Part 2's files (check each diff before staging — the tree is shared)
New: `app/[orgSlug]/admin/sponsorships/[dealId]/`, `app/[orgSlug]/sponsorship/`, `app/api/admin/sponsorships/deals/`,
`app/api/public/sponsorship/`, `components/admin/kit/club/sponsorships/{BusinessPicker,DealScreen,DealsList,OfferDealWindow,OfferReasonFields}.tsx`,
`components/admin/kit/club/sponsorships/deals-api.ts`, `components/public/SponsorDeal{Content.tsx,.module.css}`,
`lib/{club-form-deal,club-sponsorship-deal-actions,club-sponsorship-deal-words,club-sponsorship-deals-server,club-sponsorship-deals,gst-hst-rates,sponsor-deal-link,sponsor-deal-view,sponsor-link-route,sponsor-link-words,sponsor-offer-email}.ts`,
migrations 526 and 527, `tests/unit/board-ready-stage6-deals.test.ts`, the drawing HTML.
Changed: `app/api/admin/sponsorships/route.ts`, `…/sponsors/[sponsorId]/route.ts`, `app/api/unsubscribe/route.ts`,
`app/unsubscribe/page.tsx`, `components/admin/kit/club/sponsorships/{DealsScreen,SponsorWindow,SponsorsScreen}.tsx` +
`Sponsorships.module.css`, `components/league/SignupFormFields.tsx`, `lib/{admin-kit-nav,club-form-staff,club-host,club-sponsorships-words,console-money-needs-look,consumer-routes,email-kinds,public-club-access,unsubscribe-token,unsubscribe-words}.ts`,
`tests/unit/{club-form-staff-guard,field-menu-hangs-over-guard,public-page-layout-guard,team-move-coverage}.test.ts`,
`DATA_DICTIONARY.md`, the schema snapshots, `memory/reference_db_schema.md`, `MANUAL_PROD_STEPS.json` (the 526/527 entries
only), `BOARD_READY_PLAN.md` (§5 Stage 6 only).
⚠ `InvoiceDetailsWindow.tsx`, `PackageWindow.tsx`, `PackagesScreen.tsx`, `api.ts` and `places.ts` in the same folder may
hold the §560 walk's fixes from another session, not Part 2 — read their hunks and stage only Part 2's (temp-index partial
commit if a file mixes both). The shared files (dictionary, snapshots, ledgers) get the same care.

## Rules that still hold
- Production reads are counts and schema only. Don't seed or reset the demo worlds (`/demos` is told, never run from here).
- Don't restart the dev server mid-walk; restart only after new files or shared-module changes, and say so.
- Status words: record "committed `<hash>` <date>", never "uncommitted" or "not on prod".
- Owed elsewhere, don't build here: the Part 3 items (invoice PDF and its email — then the invoiced callout's "was issued"
  becomes "was emailed"; Record a payment; card; the revised invoice that brings back "Changing it now sends a revised
  invoice"; the refund-policy link by the card button), Part 4's Offer again (it reads the kept reason date, 3A), and the
  policy sentences `/legal` routes in Part 4.
