# Prompt — Board Ready Stage 6 · BUILD: the club's sponsorships

> Four build sessions, one Part each, each pasted into a fresh chat (`/clear` first) as
> *"Read and follow docs/projects/active/BOARD_READY_STAGE6_SPONSORSHIPS_BUILD_PROMPT.md — Part N"*. Written 2026-11-22,
> after the owner ruled both drawing rounds (24 asks) and said "write the build prompt". Parts run **in order** (2 offers
> what 1 stores; 3 takes the money for what 2 offers; 4 renews and closes out). Plan of record: `BOARD_READY_PLAN.md` §5
> Stage 6 (round 1's 15 rulings, round 2's 9, the hint, what is still open) and §9 (the gates and the tax shape). Index:
> `BOARD_READY_PROMPTS_INDEX.md`. Where this prompt and the plan differ, the plan wins; where the plan and the CODE
> differ, the code wins — say so out loud.

## The source of truth
**Two drawings, as ruled:**
- **Round 1:** https://claude.ai/artifact/1z9y6ctHK3PNLaJ2HR11U8 (source `BOARD_READY_STAGE6_SPONSORSHIPS_DRAWINGS.html`).
  Tabs: 1 the empty place and three steps · 2 Packages · 3 Offering a deal + the email · 4 the business's page · 5 Deals and
  one deal · 6 the invoice · 7 recording a cheque or e-transfer + the ledger · 8 one sponsor list + the public spots ·
  9 Offer again · 10 plans, the fee in figures, the code read (F1–F12) · 11 the asks.
- **Round 2:** https://claude.ai/artifact/Jw44YSkZ6dFFGTmAVW6ScQ (source
  `BOARD_READY_STAGE6_SPONSORSHIPS_ROUND2_DRAWINGS.html`). Tabs: 1 the Payouts card's sponsorship fee row + the pay block +
  the receipt · 2 the paid-by-card invoice + the books (F13, F14) · 3 Manage member's Sponsorships row + the read-only
  Invoice details · 4 the conflicts and /legal's questions · 5 the asks.
- **Where the two differ, round 2 wins** (it was drawn to correct round 1: the pay block, the invoice totals, "Full" grey).
  Click every tag in both: the notes carry build rules. **Build to the drawings.** Where the code makes a drawn thing wrong
  or impossible, STOP and draw the difference for the owner; never decide it silently (`feedback_build_to_approved_mockups`).

## The rulings the build must hold (plan §5 Stage 6 has the full text; add nothing)
- **One record (1A).** A business is kept once and has *places*: a kind (club · house-league division · house-league team ·
  tournament; a club event joins later **without a change to the deal**), which one, and a last day. A paid deal whose
  package has "Your logo on our website" on IS a place; a typed place is set on the Sponsors tab. The club place fills the
  home strip; a division or team place puts a quiet "Sponsored by" line under its name; About lists the club's places. A
  deal's place changes on the deal.
- **Tournament place (2A):** the place kind is built and chosen here; a tournament place is shown only when the tournament
  passes the existing `advanced_tournament_branding` gate (Tournament Plus and up, no new key), server and screen. **The
  public tournament Overview strip itself is the tournament sponsors drawing's build** (`PUBLIC_TOURNAMENT_SPONSORS_DESIGN_PROMPT.md`,
  unblocked 2026-11-22): store and choose the place; do not draw or build its public look here.
- **States follow the money (4A):** Offered → Form received → Invoiced → Paid, delivery counted beside; Delivered = paid and
  every checklist item ticked. Choosing a cheque or e-transfer issues the invoice at once, so Form received only waits
  after an unfinished card payment. Withdraw until paid. Callout words = round 1 tab 5's table, verbatim.
- **Logo up/down (5A):** up by itself when paid, or earlier when the club ticks the logo line; down by itself after the
  deal's last day (the shipped `sponsorEnded` rule: the last day is inclusive, club time zone).
- **Packages (6A, 7A, 5 of round 2):** a package names its kind of place; each deal picks which one; a taken place warns,
  never blocks. An open offer holds its place; a package reads **Full (grey)** when every place is paid, invoiced or
  offered; no business opens a link for a place that has gone.
- **The sponsorship form (8A):** one per club, Setup › Sponsorship form, Stage 4's editor with no "for each child" groups
  and no Health switch; fixed business fields the club can't remove: business name as it should appear, contact name,
  email, invoice address (required); phone, website (asked, optional); the logo (can come later).
- **Tax (9A + the hint):** Invoice details holds "Registered for GST/HST" and the number (off by default). Each deal's
  Charge switch is off by default and shown only to a registered club; the rate comes from the province of the business's
  invoice address, never a hard-coded 13%; deliverables listed on the invoice; the tax posts to its own new ledger word,
  **GST/HST collected**. The switch's hint, verbatim (plan §5 "Still open after both rounds", `/accounting` addendum
  2026-11-22): **"13% for an Ontario address, added to the amount. A sponsorship that shows a name or logo is usually not
  charged tax. Turn this on only if your accountant says this deal is taxable."** — the rate sentence follows the province;
  static; never the word "advertising" for a banner or web placement; never "donation", "gift" or "tax receipt" anywhere.
- **Receipt (10A):** the paid invoice is the receipt — the same PDF, its subtitle led by "Paid in full", payments received,
  no stamp.
- **Limits (11A):** 20 is the home strip's limit only; the list holds up to 100.
- **The place and who opens it (12A + note, round 2 ask 4):** its own club place, **Sponsorships** (Deals · Packages ·
  Sponsors · Setup); the site editor's Sponsors line becomes a door to it. A new per-member access **Sponsorships** in the
  shipped Manage member window ("What {first} can open"), default on for owner, admin, treasurer, off for every other role,
  grantable to anyone (e.g. a registrar), paired with the plan's entitlement like every area. **Invoice details** (mailing
  address, GST/HST, how businesses pay) are changed by owner, admins and treasurer only; anyone else with Sponsorships
  reads them with the drawn line saying who changes them (round 2 tab 3).
- **The offer email (13A, 8 of round 2):** sent in the club's name, replies to the club, the club's note optional. The club
  must pick why it may email them (paid in 2 years · asked in 6 months · gave the address · published it for business),
  kept with the date **and who sent it** (a name snapshot, /legal round 2) and said back in the foot. Foot: the club's
  mailing address alone, an unsubscribe for that club's sponsorship offers only, "Sent through FieldLogicHQ". An
  unsubscribed or family-opted-out address can't be offered again; nobody at the club can clear it; "Do not offer again"
  for a stop said by reply or phone. **Sending waits for the club's mailing address.**
- **Offer again (14A):** from next year's empty Deals, one window with last year's deals ticked; this year's price (last
  year's as a hint); club and tournament places carry over; a division carries over by name; a team is picked again, so
  its row waits until the new teams exist; a business that hasn't paid in two years, or is unsubscribed, is listed but
  can't be ticked.
- **The card fee (3C, round 2 asks 1–3, 9):** a second club-wide choice on the Payouts card, "Processing fee on
  sponsorships": "The sponsor pays it" listed first, **"The club pays it" the default**; the registration row is relabelled
  "Processing fee on registrations" and is unchanged in meaning. Both rows carry the card-network hint (the 2.4% limit, none
  in Québec, passing the fee on is the club's decision and responsibility); the sponsorship row also says a refund never
  returns the fee, and that cheque/e-transfer carries no fee. Fee = `onlineFee()` on the amount owed incl. HST, **never
  grossed up** (F13). When the sponsor pays it, the fee is its own invoice row with the club's GST/HST on it, and is
  **booked both ways**: income under Club sponsorship (its own line) and the same amount as a Payment processing cost.
  The pay block is the shipped `PayBlock` (one button per way to pay, each with its total, the fee note under the card
  button: "Includes a $41.05 card processing fee and $5.34 HST on it."), never a radio; the page never names the processor.
  The invoice follows the coach recipe: every charge a row of the one table; Invoiced · Paid · Balance due carry the
  total; no totals block.
- **Words (15A, round 2 ask 6):** club side "Sponsorships", "Deals", "Packages", "Sponsors", "Setup", "Offer a deal",
  "Shows on", "Record a payment", "Offer again", the five states; the business reads "Sponsorship", "About your business",
  "Questions from {club}", "How you'll pay". **"e-transfer" in a sentence, "E-transfer" at the start of a label or
  sentence**, everywhere, including the stored method name. One `/marketing` pass per Part; `npm run check:spelling`.
- **Charities (round 2 ask 7):** build for clubs that are not registered charities; nothing charity-specific.
- **Gates:** Stage 6 rides League Plus + both Club bands (2026-11-10). Display stays with the public site.
  Tournament-only organizers get display only. No price is restated here; `PLAN_PRICING_FACTS.md` is the record.
- **Not touched:** the Coaches Portal's team sponsorships, sponsor invoices and fundraisers (2026-11-06; its invoice's
  no-tax ruling R2 stays — the club invoice is a **separate** builder that shares the recipe, never a tax switch on the
  coach one).

## `/legal` build rules (from both reviews; not optional)
- `docs/agents/legal/BOARD_READY_STAGE6_SPONSORSHIPS_DRAWING_REVIEW.md` (round 1 + its round 2 section). Read it whole.
- Every offer keeps: the reason picked, its date, who sent it (name snapshot), the address, the club. Unsubscribes and
  "Do not offer again" are kept for good, are per club and for sponsorship offers only, and no club seat can clear them.
- The offer email never goes through Communications: its words forbid promotion ("Don't use this to sell or promote
  anything, for you or for a sponsor", `lib/club-group-email-words.ts:188`). It is its own sender with its own CASL foot.
- The business's page is a business, not a family: the 2026-10-31 family-links rule does not apply, but the page is
  no-index, token-only, throttled, and shows nothing about any other deal or business.
- **Owed with the next policy versions (`/legal` writes, routed in Part 4):** Payments Terms §4 (two fee choices,
  sponsorships default the club), §6 (a sponsorship refund never includes the fee), §9 (the sponsor pays; name
  sponsorships in the card-network sentence); Privacy §5 (who sent an offer is kept with its reason), §9, §12; Terms §4;
  Payments Terms §3. A policy that promises what the product doesn't do is a defect for `/plan`.
- Lawyer's eye (flag in the close-out; no gate): the CASL sender question, the two-year clock, a passed-on fee under
  Québec law. A tax professional: the province-of-the-buyer rule and whether recognition alone is a supply.

## Facts read from the code (2026-11-22; re-check the lines you touch)
- **The sponsor list today** is a jsonb column, `org_public_site_content.sponsors` (`{id,name,logoUrl?,link?,endsOn?}`),
  capped at 20 three times: editor (`app/[orgSlug]/admin/public-site/page.tsx` ~601), `lib/public-site-patch.ts` ~31/157,
  and a DB CHECK (mig 353). Ended logic `lib/club-sponsors.ts` ~18–26 (an ended sponsor stays stored; loaders filter).
  Logos: public bucket `org-logos`, `{org}/sponsors/{uuid}.png`, re-encoded PNG ≤480×216 (`lib/sponsor-logo*.ts`).
  Public: home strip `components/public/ClubSponsors.tsx` ~37 via `ClubSiteHome.tsx` ~220 (fed by `lib/club-home-data.ts`
  ~118); About list ~57 via `app/[orgSlug]/about/page.tsx` ~108. **The one-record move (1A, 11A) replaces this column with
  the new tables**: migrate every existing row to a business + a typed club place (keep ids, order, logos, last days),
  switch every reader, then retire the column and its CHECK in a later migration (old code reads it by name: the schema
  parity order of migrations 509/511 is the precedent — a drop goes on production after the new code serves). Counts
  first: clubs with sponsors and rows per club, on dev and production (**counts and schema only on production**,
  binding rule); show the owner and stop for his yes before the move runs anywhere.
- **⚠ There may be no public team page.** The only `league/[seasonSlug]/team/[teamId]` page is behind a sign-in gate (its
  `layout.tsx`). Public division names: the season page's division cards (`app/[orgSlug]/league/[seasonSlug]/page.tsx`
  ~325) and the standings division tabs (`standings/page.tsx` ~91). Round 1 drew the line under "U9 · Standings" and
  "U13 Rockets" and its F6 note cites a "public team page = games only" ruling. **Find where that page is before building
  the team line; if there is no public team page, STOP and ask the owner** (the line under the team in the standings and
  schedule rows, the About page only, or wait for a team page). Do not build a new public page to hold it.
- **Forms (8A):** Stage 4's engine (`club_forms` … `club_form_files`, dictionary ~7129–7342). `subject_kind` already allows
  `'business'` (mig 513 ~55) **but nothing reads it** (`FormSubjectKind`, `lib/club-form.ts` ~20, unused); the editor
  always shows the Asked groups and the Health switch (`QuestionWindow.tsx` ~191–222). Hard-coded to house league:
  `owner_table` CHECK (`league_seasons`), `subject_table` CHECKs (`league_registrations`) on files/answers/ticks, the
  cleanup triggers (513 ~337–360), `lib/club-form-server.ts` ~264/351. Widen each for a club-owned sponsorship form and a
  deal subject; make the editor read `subject_kind`. Answers are written only through RPCs (mig 515) and read only through
  `lib/club-form-staff.ts` behind a guard test — extend both, don't route around them. Questions gate on
  `custom_registration_fields`; documents are never gated.
- **The no-login link:** the team pay link is the precedent (`lib/team-pay-link.ts`: HMAC over a prefixed message,
  `PAY_LINK_SECRET`, never stored, version bump stops an old link; `teamFromPayToken` the one door). A sponsor link takes
  its **own** message prefix and version column. Throttle: `throttlePublicForm` (in-memory, per instance, budget shared
  with the family forms); the page render and status poll are unthrottled today — throttle the sponsor page's posts and
  uploads, and don't widen that gap.
- **Access:** add `module_sponsorships` to the `Capability` union and `ALL_CAPABILITY_KEYS` (`lib/roles.ts` ~4–38, 96–104;
  the member PATCH silently drops unknown keys), `ROLE_DEFAULTS` for admin and treasurer (owner always passes), a row in
  `MEMBER_PROGRAMS` (`lib/member-access.ts` ~81–92), the `LOSES`/`GAINS` sentences (`member-summary.ts` ~72/82), audit
  labels, `RoleGuide.tsx`, `roleOpensSentence`. **A Manage member row only appears when the plan carries a MODULE**
  (`whatTheyCanOpen` reads `PLAN_CONFIG.moduleEntitlements`, not plan features): add the module to the league, club and
  club_large entitlements (`lib/plan-config.ts`) and `MODULE_CATALOG`; `role-defaults-guard.test.ts` then requires the
  admin default, which the ruling wants. Plan gate template: `club_scheduler: 'league'` (`lib/plan-features.ts` ~91/143,
  `lib/club-schedule-gate.ts`); `requiresPlanCopy` needs an explicit case (the two copy helpers recurse on an unknown
  key). Changing `plan-config.ts` = the Facts doc in the same unit (`/billing`, `/strategy` drift check).
- **Nav:** `lib/admin-kit-nav.ts` is the one source for rail, phone bar and More sheet. Copy **Communications**, a
  non-program place (`kitCommunicationsLink`, `clubPlaceGroups`, `litClubPlace`, `clubPlaceAt`, `ClubPlaceAccess`), not
  the program pattern. Server gate in the layout like `app/[orgSlug]/admin/club-emails/layout.tsx` ~29–37, with a pure
  client-safe "opens Sponsorships" helper asked by the row, the layout and every route (`lib/club-communications-place.ts`
  is the model). Tabs via `HubTabBar`/`PlaceTab`. ⚠ `tests/unit/admin-kit-nav.test.ts` ~531 regex-matches the
  `clubPlaceGroups(...)` call — update it deliberately. The nav hides, never locks.
- **Email:** `sendEmail` (`lib/email.ts` ~118, `kind` required, guarded); From name `familySenderName` → "{Club} via
  FieldLogicHQ"; Reply-To the club's public-site contact (`familyReplyPlan`, `clubPublicContact`). Unsubscribe tokens
  (`lib/unsubscribe-token.ts`) have four families, none per category: a sponsorship-offer token is a fifth, keyed on club +
  address, with `oneClickUnsubscribeHeaders`. Family opt-outs (`family_email_optouts`, any source suppresses all family
  mail) are read through `getFamilySuppressionList` (it expands a person's other addresses) — an opted-out family address
  can't be offered. `family_consents` is the model for basis + date, but it is keyed on guardians: the business record
  is new. Never use `lib/email-sender.ts` (FieldLogicHQ's own marketing sender).
- **⚠ The mailing address:** stored at `org_public_site_content.mailing_address` (mig 454), but the editor box shows only
  when `GUARDIAN_TIER_ENABLED` (`app/api/admin/public-site/route.ts` ~26) — most clubs can't set it today, and ruling 13
  makes sending wait on it. **Invoice details owns it** (round 2 ask 4): edit the same column there, for every club, by
  owner/admin/treasurer; the public-site box keeps its own rule. Say what you did.
- **Payments:** the one pay block `components/public/PayBlock.tsx` (`PayButtons` ~146–170; note words
  `lib/online-payment-words.ts` ~716). Direct charge `createCheckout` (`lib/stripe-connect.ts` ~144–186, application fee,
  no `receipt_email`). `online_payments.flow` CHECK allows only `tournament_team` and `league_signup` (mig 374 ~46): add a
  sponsorship flow with its own shape check and land/post RPCs (the land RPCs: migs 390, 388; the webhook
  `landCheckoutSession`). The live switch is `onlinePaymentsOn()` (`lib/online-payments-switch.ts`): while off, **the card
  button is absent, not broken**, and everything else ships. Fee payer is `org_payment_accounts.fee_payer` (mig 358;
  each payment keeps its own copy): add a separate sponsorship column, default `club`, audited like
  `payouts_fee_payer_changed`. Refunds: a part refund never includes the fee; our application fee is never refunded
  (`refundToCard`); a sponsorship refund never returns the fee (round 2 tab 1).
- **Books:** there is **no "Club sponsorship" category** (only the team-side 'Sponsorship' / 'Team sponsorship' and each
  event's own word) and no club general-book "Payment processing" helper (`club_league_out_word` /
  `club_tournament_out_word` know only season and event books), and no club "GST/HST collected" word. Create all three
  for the club's general book (`club_general_ledger`, mig 315), the way round 1 tab 7 and round 2 tab 2 draw the lines.
  Method tokens `DUES_PAYMENT_METHODS` (`lib/types.ts` ~2942) and labels ~2949; `SEEDED_PAYMENT_METHODS`
  (`lib/payment-methods.ts` ~39–45) holds the stored name "E-Transfer".
- **Tax rates:** a province → GST/HST table exists but is private to a console helper (`lib/console-money-needs-look.ts`
  ~34–49, `gstHstRateFor(region, issuedAt)`, NS's 15→14 cut handled, source noted). Move it to a shared module and reuse
  it; it covers GST/HST only, so a QST/PST province shows the GST rate and nothing else (a professional confirms — flag).
- **Invoice:** the coach builder `buildSponsorInvoiceDoc` (`lib/export/pdf.ts` ~2746–2939) is the recipe; build a club
  builder beside it sharing its helpers. Numbering: the coach scheme (`rep_sponsor_invoices`, mig 339: `{year}-{seq}`,
  max+1 on first issue, never reused, a revised amount keeps the number with a "Revised" date) is the model, per club.
- Latest migration at writing: **524**. Check again at commit time; other sessions add migrations.

## Part 1 — The place, the access, Setup, Packages and the one sponsor list
Round 1 tabs 1, 2, 8; round 2 tabs 1 (the Payouts rows only) and 3; the gate half of round 1 tab 10.
- **Migration first:** businesses, places (kind · which one · last day · source deal or typed · order), packages (name,
  price, deliverables list, kind of place, how many, optional document, archived), the club's sponsorship settings
  (registered, number, how businesses pay), the sponsorship fee payer column, the form widening above. RLS as the club
  money tables have it; **no browser access**; explicit `service_role` grants. `DATA_DICTIONARY.md` + `npm run
  refresh:snapshots` in the same unit. Dev only; the prod step in `MANUAL_PROD_STEPS.json`.
- The access end to end (Facts above); the place in the nav with its four tabs and the empty state's three steps; the
  site editor's Sponsors line becomes the door.
- Setup: Invoice details (incl. the mailing address and the read-only view for other seats), the sponsorship form (the
  Stage 4 editor reading `subject_kind`; the fixed business card), the Payouts card's two fee rows and both hints.
- Packages: list, new package, Full (grey).
- The Sponsors tab and the move (counts → owner's yes → move), the 100 limit, the home strip's 20, About, the division
  line; the team line per the ⚠ above.
- Ends with: `/legal` re-check on the built words, `/docs`, one `/marketing` pass, `/simplify` then `/review`, then a QA
  walk (an Artifact, `feedback_qa_walkthroughs_as_checkable_artifacts`, 20–50 boxes, exact logins incl. a registrar with
  Sponsorships turned on and a treasurer).

## Part 2 — Offering a deal and the business's page
Round 1 tabs 3, 4, 5; the email and its foot.
- Offer a deal (business, package, place, price, the reason picked, the optional note); the offer email (own sender, CASL
  foot, the sponsorship-offer unsubscribe, one-click headers); "Do not offer again"; sending waits for the mailing address
  and refuses an unsubscribed or family-opted-out address, with the drawn words.
- The business's page: package, About your business (the fixed fields), Questions from {club} (the form), the logo upload
  (the sponsor-logo re-encode, a public link only once the place shows), How you'll pay; cheque/e-transfer issues the
  invoice at once; the card button only while `onlinePaymentsOn()`; a place that has gone shows the drawn words and no form.
- Deals: this year's list by state, one deal's page (state callouts verbatim, withdraw, the checklist, the logo line, the
  Charge switch with its hint, "Shows on" and changing the place), Full and the warn-never-block rule.
- Guard tests: the token's own prefix and version; nothing of another deal on the page; offer records always carry reason,
  date and sender.
- Ends as Part 1 does (+ `/legal` on the email, the foot and the page; `/ux` on the business's page at 390).

## Part 3 — The invoice, the money and the books
Round 1 tabs 6, 7; round 2 tabs 1 (pay block, receipt) and 2.
- The club invoice PDF (coach recipe; tax rows only when registered and switched on; deliverables listed; the GST/HST
  number; "Paid in full" receipt); numbering.
- Record a payment (cheque, e-transfer) and its two ledger lines; GST/HST collected; Club sponsorship.
- Card: the sponsorship flow, land/post RPCs, the webhook, the fee booked both ways when the sponsor pays, a Payment
  processing cost when the club pays; the receipt email; refunds without the fee.
- The shared province rate module (moved, not copied); the card-network hint on the registration row.
- Tests: the drawn deal to the cent ($1,000 + HST 13% → $1,130.00 by cheque; $1,176.39 by card with the sponsor paying,
  club receives $1,135.34, keeps $1,000.00 after $135.34 HST; $1,036.50 with no tax), both fee payers, both rails' absence
  while the switch is off.
- `/accounting` runs **before hand-off** (CLAUDE.md: our application fee and its tax are on this payment). Ends as Part 1.

## Part 4 — Offer again, the spelling sweep and the close-out
Round 1 tab 9; round 2 ask 6.
- Offer again (the window, carry-over rules, the team rows waiting, the two-year and unsubscribed rows).
- The e-transfer sweep: every screen, PDF, email, help article and demo string; the stored method name in existing clubs'
  ledgers (a data migration: counts first on both databases, show the owner, stop for his yes); `check:spelling` holds it.
- Retire the old sponsors column (a production drop after the new code serves; plan it with the parity baseline).
- `/legal` close-out: the owed policy sentences above, routed, and the lawyer's-eye flags. `/docs` (the sponsorships
  guide, Manage member's new row, the Payouts card). `/demos` is told, never run from here.
- Ends as Part 1 does.

## Not in this stage (recorded, don't build)
- The public tournament sponsors look (its own drawing, now unblocked).
- Club events as a place (Stage 5; the place kind is left open for it).
- Coaches Portal team sponsorships; charity-specific behaviour; QST/PST on a sponsorship; switching live card payments
  on in production (Club Tier Stage 12).

## Standing rules
- Branch `dev`. Explicit paths only. **No commit without the owner's yes.** Shared files go through a private index
  (`reference_partial_commit_shared_tree.md`).
- `npm run verify:changed` per part; `npm run typecheck` (shared modules, routes, migrations).
- Dev server: restart only as `AGENTS.md` says (new files, `lib/` shared changes).
- Production reads: counts and schema only.
- Don't seed or reset the demo worlds from here.
- Record each part's commit hash and walk number in plan §5 Stage 6, the index row and the board line (positive facts
  only, same commit as the work).
