# Public tournament pages — Stage 7, the team pay page (build prompt, two sessions)

> Written 2026-11-01 (Claude), after Stage 6 closed (walk §435 ✅ 68/68, amendments committed `19f551396`).
> Plan row: `PUBLIC_TOURNAMENT_SITE_REVIEW_PLAN.md` §9 Stage 7, spec §8, finding D6, Ask 6 (ruled 2026-10-27:
> "a focused page"). Stage 1's walk deferred the pay page (its E5) to here. The drawing is the hub's "The team pay
> page" frame (`PUBLIC_TOURNAMENT_SITE_REVIEW_HUB.html`, grep "The team pay page").
>
> **Why two sessions, not four:** one page, one job, and the pay block itself is not redrawn. The work is the
> shell around it, the states the hub did not draw, and a walk with a real link — which no stage has had yet.
>
> Read `AGENTS.md` and `AGENCY_RULES.md` first. Everything the customer sees is behind the preview switch; the one
> exception (Part 1 step 0) ships on its own and needs the owner's yes.

## What Stage 7 is (one paragraph, so both parts share it)

A coach opens the team pay page from an emailed link (or the Coaches Portal's *Pay now*) to pay the team's entry. Under
the preview switch it becomes a **focused page**: a slim band (52 px: the organizer's colour role and the event name,
no tabs), no side rail, no today's-results line, no my-team dock, no follow/alerts/install prompts, no free-plan
acquisition banner; then the **pay block unchanged**; then a short footer (event name and credit, no page list). It
stays private and not indexed. Switch off, the page is byte-for-byte what it is today. Both desk and phone. The
10-25 overlap (the date line over the title) is walked with a real link for the first time.

## How this runs: two sessions, a `/clear` between them

| Part | Covers | Ends with |
|---|---|---|
| 1 | Step 0 (the offline-copy fix, own commit), the states drawing for the owner, the real-link fixture, the plumbing | The drawing ruled; step 0 committed on the owner's word; fixture prints working links |
| 2 | The focused page built to the ruled drawing, phone and desk; cleanup + `/review`; the QA walk; records | Walk published; plan §9, TODO, ledger updated |

**Every part:** the `dev` branch only; stage explicit pathspecs (the tree is shared — the ledger and TODO usually carry
other sessions' hunks, commit only yours); a product-owner summary before any code; the owner does browser testing.
**Token discipline:** broad reads go to a helper; read the hunk you are about to edit, not the whole file.

### Rulings this stage stands on (do not re-open them; cite them)
- **Ask 6 (2026-10-27):** the focused page as drawn. Not "keep it in the full shell".
- **The pay block is not redrawn** (hub caption: "The pay block is the shipped one, untouched"). Its words live in the
  online-payment words module; this stage changes no pay copy, amount, option or button.
- **The emailed pay link stays** (signed-in family accounts, owner 2026-10-31): this page is permanent, so build the end
  state, not a stopgap.
- **Behind the switch until Stage 8; one page group at a time, walked before the next.**
- **Following is installed-app only** (Stage 2); the pay page carries none of it anyway.
- Spelling and time rules (`formatTime()`, "8:00 a.m."); `check:spelling` is part of `verify:changed`.

## What the code does today (a 2026-11-01 census; re-check before you rely on a line)

**The page** (`app/[orgSlug]/[tournamentSlug]/pay/[token]/page.tsx`, 26 lines) does not read the switch; it renders
`TeamPayContent` from `buildTeamPayView`. `robots: noindex, nofollow`; `force-dynamic`.

**The states** (`lib/team-pay-view.ts` `kind`, from `lib/team-pay-facts.ts`'s refusal order; words in
`lib/online-payment-words.ts` `PAY_WORDS` / `BANK_DEBIT_WORDS`):
- *invalid* — bad or mangled token, missing secret, missing rows, or the URL's org/tournament slug is not the team's.
  A bare card with **no title**: "This payment link doesn't work. Ask the organizer to email you a new one."
- *confirming* — `?paid=` (Stripe's return); polls the status route every 2 s, slow copy after 20 s.
- *not finished* — `?left=1` while owing: "You left the secure payment page before paying. Nothing was charged."
- *owing* — deposit or full (deposit pre-selected), full only, or balance; the shared tail (receipt email, card and
  bank-debit buttons, refund policy, "Or pay another way"); a returned or reversed bank debit shows above it.
- *clearing* — a bank debit clearing; no buttons. **The only state with a contact line** ("Wrong account, or a
  question? Contact {club} at {email}").
- *already* (paid in full, with or without receipts), *nothing* (no fee, or the club's own team), *refused* (not
  accepted yet / no longer in the tournament or the tournament is completed / a payment still being recorded),
  *not taking* (switch, plan, suspension, no Stripe account, or the fee is not tracked: "Pay the organizer directly").
- Test mode adds "Test payment: no money moves." Receipts list on every state but invalid and confirming.
- A draft or archived tournament, or a cancelled org, never reaches the page: the layout 404s first.

**The shell around it** (`app/[orgSlug]/[tournamentSlug]/layout.tsx`): under the frame it renders the band
(`TournamentBand`, which always includes `TournamentTopTabs` and the browser's Sign in), the desk rail as a grid cell,
`TodaysResultsLine` (whose page list `lib/public-ticker-pages.ts` **includes `pay`**), `TournamentFooter` (no variant
without its page list), the my-team dock, `FollowDeepLinkPrompt`, `AlertsNudge`, `InstallAppPrompt`, and on a free plan
`PoweredByBadge` + `TournamentAcquisitionBanner`. The demo pitch is the org layout's `SandboxChrome`. **Nothing in the
layout special-cases a route;** each client piece decides from `usePublicPathname()` (precedents:
`isAcquisitionHiddenOnPath`, `pageCarriesTicker`, the dock's minimize paths, the install prompt's sign-up prefixes).

**The overlap fix** `ced733337` (2026-10-27) pads the page with `page-content` below the old fixed header and ticker.
Under the focused page there is no fixed header: check the padding does not leave a gap.

**The link:** `lib/team-pay-link.ts` — HMAC over the team id with `PAY_LINK_SECRET`, never expires, never stored.
Producers: the coach's *Pay now*, the admin *Email the pay link*, the receipt and bank-debit emails. **Dev fixtures:**
`scripts/seed-stripe-walk-tournament.mjs --inbox <addr> [--reset]` builds "Stripe Walk Invitational" under
`uat-rep-club` (the only dev club with a Stripe test account), including an accepted, unpaid "Walk Filler Team"
(deposit $100, total $300). `.probe/paylink.cjs` prints links but its team-name filter is hard-coded.

**Tests:** `tests/unit/online-payments-pay.test.ts` (options, token, refusal copy), `bank-debit.test.ts`,
`coach-pay-now-guard.test.ts`. No render test of `TeamPayContent`.

## The one technical choice, settled here: branch per piece, do not move the routes

A nested layout cannot escape its parent's chrome, and a layout cannot see its child segment on the server. The two
real options are (a) a route group that moves every tournament page except `pay` into `(event)/`, or (b) one
"focused page" rule that every chrome piece consults through `usePublicPathname()`, as the ticker and the acquisition
banner already do. **Use (b).** (a) moves a dozen route folders for one page, rewrites ~125 path references in 80
test/script files, and collides with every concurrent session touching a tournament page. (b) is the codebase's own
pattern, and it paints right first time: these are client components, and `usePathname` resolves during the server
render. The two server-side pieces are handled directly: the desk grid's rail cell (give the grid a focused variant so
it does not keep an empty column) and `BuiltOnCredit` (off-frame only, untouched). Put the rule in one helper beside
`lib/public-ticker-pages.ts` (e.g. `isFocusedPublicPage(path)` = the `pay/{token}` segment), drop `pay` from the
ticker's list, and pin both with a guard test. Every piece gates only when the frame is on, so the switch-off page is
unchanged.

## Part 1 · The offline-copy fix, the states drawing, the fixture, the plumbing

0. **Ships to customers on its own, its own commit, only on the owner's yes.** The installed app's service worker
   (`public/sw.js`) keeps an offline copy of every public tournament page, and `isNeverCache` checks only the segment
   after the org, so `/{org}/{tournament}/pay/{token}` — **including the `?paid=` and `?left=1` variants** — is stored
   in the shared page cache and replayed offline. The page's own comment says "never cached", and the family league
   pay page is already excluded (`league` is a private org section). Exclude a `pay` third segment from the page
   cache, bump the cache version so stored copies drop, and add a guard test. A pay link is a key; its page must not
   sit on a shared phone.
1. **Draw the states the hub skipped**, whole-screen at true size, phone 390 and desk 1280, as a Claude Artifact,
   through `/design` before the owner sees it (house layout: sticky tabs, minimal scroll, Everything / Show only what
   differs). Draw: owing (deposit or full), confirming, not finished, paid in full with receipts, not taking (pay the
   organizer directly), refused, a broken link, and a **free** event (the neutral band, no mark). The pay block is
   drawn from its shipped component, not reinterpreted. **Asks to put on the drawing, each with a recommendation:**
   - **A1 · Contact line.** The hub drew "Questions about this payment? {email}" on the page; today only the clearing
     state has one. *Recommend:* one line on every state, from the organizer's public contact; clearing keeps its own.
   - **A2 · The broken link.** Today a bare card with no title. *Recommend:* the slim band (the URL names a real
     tournament, so its name is known), the existing sentence, and the A1 contact line — the one person who can send
     a new link is named.
   - **A3 · A way out.** No tabs means no route back to the event. *Recommend:* the event name in the band links to
     the Overview, styled as the name, not as navigation.
   - **A4 · Sign in in the band.** Stage 1 put Sign in in a browser's band. *Recommend:* absent here; paying never needs
     an account, and the page has one job.
   - **A5 · A free event's credit.** A free event normally shows the floating "Powered by" badge and no footer credit.
     *Recommend:* on this page, no badge and no acquisition banner; the short footer carries "Built on FieldLogicHQ"
     for every plan, as the hub drew it.
   - **A6 · The desk.** *Recommend:* one centred column at the pay block's width, band full width.
2. **The real-link fixture.** Make `.probe/paylink.cjs` take a tournament slug and print a link per team with its
   state (owing, paid, not accepted), and extend `seed-stripe-walk-tournament.mjs` (reversibly, marked) so the walk
   can reach owing, paid in full with a receipt, not accepted and not taking from one tournament. Test-mode Stripe
   only; the walk pays with a test card.
3. **The plumbing** (the choice above): the helper, `pay` out of the ticker list, the guard test; nothing visible yet.
4. Verify (`npm run verify:changed`, the focused tests), record Part 1 in this file, and hand Part 2 a kick-off.
   `/clear`.

## Part 2 · The focused page, review, the walk, the records

1. **Build to the ruled drawing**, phone and desk, under the switch: the slim band variant of `TournamentBand` (no
   `TournamentTopTabs`, no Sign in, the A3 link), every chrome piece listed in the census gated by the helper, the
   short footer (a `TournamentFooter` prop that drops the page list and the host line, not a hidden-pages hack), the
   page padding re-checked against the 10-25 overlap. The pay block's code is not edited beyond its outer frame.
2. **Measure** at 360, 390 and 1280 on each fixture state: no sideways scroll, no tap under 44 px, the band at 52 px,
   first pay button above the fold on a 390 phone with a deposit choice. Add the page to `check:layout --changed`.
3. **Cleanup and `/review`** (lenses: switch-off unchanged; the helper is the only rule and no piece hard-codes `pay`;
   the admin preview is unaffected; a confirming page does not flash the old chrome; the offline-copy fix holds).
4. **The QA walk** as a checkable Artifact (one purpose: the pay page, focused, with a real link). Cover: switch off
   unchanged; each state on a phone; a real test-card payment through confirming to the receipt; leaving Stripe
   (not finished); the desk; a free event; the broken link; the old overlap gone; installed app opens it with no
   prompts and, offline, does not show a stored copy. Next ledger §.
5. **Records:** plan §9 Stage 7 row, TODO, the ledger, memory; tell the owner and name what follows (Stage 1a, or the
   Stage 8 switch-on once 1a is decided).

## ▶ Part 1 execution (2026-11-01, Claude) — built, uncommitted, the drawing awaiting the owner's ruling

- **Step 0, the offline-copy fix (ships on its own).** The owner gave the yes in the session's kick-off ("include your
  small fix"). `public/sw.js`: `isNeverCache` also refuses a third segment `pay` (`/{org}/{tournament}/pay/{token}`,
  and so its `?paid=` / `?left=1` returns, which share the path), so a pay page takes the never-cache branch (network
  only, the branded offline page when offline, never stored); `CACHE_VERSION` v12 → **v13** so stored copies drop.
  Guard `tests/unit/sw-pay-page-never-cached.test.ts` runs the real worker in `node:vm` and asks its own classifier
  (pay paths never cached; the Overview, Schedule and a team page still kept; a tournament or team named "pay" is not a
  pay page; version ≥ 13). The status poll is `/api/pay/…`, already never cached. **Its own commit is owed, on the
  owner's word** (standing rule: no commit without a per-action yes).
- **Step 1, the states drawing:** https://claude.ai/artifact/Hag6q9kkPzHiYKkRh1A1fS (source
  `PUBLIC_TOURNAMENT_STAGE7_PAY_PAGE_DRAWINGS.html`). Tabs: whole screen today/after, paying (owing, not finished,
  balance only, confirming), paid/clearing/nothing/refused, pay directly, broken link, free event, desk 1280, asks.
  Amounts are the product's own figures for the fixture's $100 / $300 entry (read from the rendered page: card
  $105.00 / $312.00, bank $103.50 / $308.50; the balance's $208.50 / $206.00 follow from the same fees). **/design ran
  before the hand-off** and its findings were applied: the Today caption (it is the switch-on shell; switch off keeps
  the old dark page), the deposit hint verbatim with a due date, bold choice titles and the shipped 0.9 rem stack gap,
  the 12 px Refund policy link, the 44 px footer credit and the desk footer's credit row, the slim band's 3 px accent
  rule (52 + 3, one line at 18 px as the hub drew — /design's two-line suggestion NOT taken, the hub ruled one), desk
  name 24 px, the clearing / balance-only / nothing-to-pay states added, the View switch inverted on tab 1, the
  broken-link contact limited to the token-valid case. **Two asks added by the review:** A7 the team title's size (the
  hub drew 32 px = `--type-display`, the score's size; the ladder's page title is 20 px; today 16) and A8 a 44 px tap
  height on the pay block's Refund policy link (the one edit inside the pay block; no visible change). **Eight asks,
  A1–A8, await the owner** (recommendations: A1 contact line on every state but clearing; A2 band + sentence + contact
  when the token is valid; A3 name links to the Overview; A4 no Sign in; A5 no badge/banner, footer credit for every
  plan; A6 one 640 px column; A7 20 px; A8 give the link the tap height).
  - Found on the way: **a free event can never take online payments** (`online_payments` is Tournament Plus and up),
    so a free event's pay page is always "Pay the organizer directly" or the receipt-free paid state; the free
    specimen draws that.
- **Step 2, the real-link fixture.** `scripts/seed-stripe-walk-tournament.mjs --pay-page` (with the usual `--inbox`)
  adds, all named "Pay Page …": division "Walk Pay Page" in the Stripe Walk Invitational (its own, so the Stripe walks'
  13U/15U counts never move) holding **Pay Page Owing** (look only), **Pay Page Pay Me** (the walk pays it in full with
  a test card → paid in full + receipt) and **Pay Page Not Accepted** (pending → refused); and a second tournament
  **Stripe Walk Pay Direct** (`stripe-walk-pay-direct`, fee not tracked) with **Pay Page Pay Direct** (not taking:
  "not taking payments" is decided per tournament or club, so it cannot share the first tournament). It prints a signed
  link per team plus the `?left=1` and a broken variant, on `NEXT_PUBLIC_APP_URL` (the environment whose
  `PAY_LINK_SECRET` signed them; the deployed dev site's secret may differ). `--reset` removes the three teams (and a
  walk payment) with every other walk team; `--pay-page` puts them back unpaid; the team the walk paid is left paid
  until `--reset`. Run on dev 2026-11-01 (twice, idempotent); all four links fetched 200 from the local server with the
  expected state words. `.probe/paylink.cjs <tournament-slug> [org-slug]` (local, gitignored) prints any tournament's
  links with a state guess. Not built: a free event's fixture (Part 2's walk needs a free-plan club's tournament with a
  tracked fee; `uat-rep-club` is Club).
- **Step 3, the plumbing.** `lib/public-focused-page.ts`: `isFocusedPublicPage(path, org, tournament)` (the `pay`
  section with a token segment after it; `FOCUSED_SECTIONS = ['pay']`) and `tournamentPageSegments`, which
  `pageCarriesTicker` now reuses. `pay` is off `TICKER_PAGES` (the line is frame-only, so switch-off is unchanged).
  Guard `tests/unit/public-focused-page.test.ts`: the rule's cases, a focused section is never a ticker page, and no
  `components/public` piece that reads the path hard-codes `/pay` (`/api/pay/…` fetches excluded). Nothing visible.
- **Verification.** The three new/changed test files pass (10 tests); `npm run typecheck` exit 0; ESLint on the changed
  files 0 errors (4 pre-existing `sw.js` unused-`e` warnings); `check:spelling` clean. `npm run verify:changed`: `npm test`
  13,002 / 13,008 — **the 6 failures are other sessions' working-tree hunks, none in a Stage 7 file**
  (house-league-signup-guard, plan-billing-usage, public-tournament-stage6-walk, support-console-stage3-guard,
  workspace-move-money); the chain stopped there, and `scripts/verify-changed.mjs`'s focused ESLint crashed on a config
  error ("could not find plugin react-hooks"), not on these files.
- **Uncommitted Stage 7 files:** `public/sw.js` + `tests/unit/sw-pay-page-never-cached.test.ts` (step 0's own commit);
  then `lib/public-focused-page.ts`, `lib/public-ticker-pages.ts`, `tests/unit/public-focused-page.test.ts`,
  `scripts/seed-stripe-walk-tournament.mjs`, `docs/projects/active/PUBLIC_TOURNAMENT_STAGE7_PAY_PAGE_DRAWINGS.html`,
  this file, and the plan's §9 Stage 7 row.

### ✅ The owner's rulings on A1–A8 (2026-11-01, pasted from the drawing's Asks tab) — all eight **a**, as recommended

- **A1** · One contact line under the pay block on every state, from the organizer's public contact; the clearing state
  keeps its own sentence and skips this one. Absent when the organizer hides the contact.
- **A2** · The broken link: the slim band (the address names a real tournament), the existing sentence word for word,
  and the A1 contact line. When the link is a real one opened under another tournament's address, the band shows and
  the contact line does not.
- **A3** · The event name in the band links to the Overview, styled as the name (no arrow, no button look).
- **A4** · No Sign in on this page.
- **A5** · On this page, no badge and no banner; the short footer carries "Built on FieldLogicHQ" for every plan.
- **A6** · The desk: one centred column at the pay block's width (640 px), the band full width.
- **A7** · The team title at 20 px, the written page-title size (`--type-title`).
- **A8** · The Refund policy link gets a 44 px tap height (no visible change) — the one edit inside the pay block.

Step 0's commit was not part of this answer and is still owed on the owner's word.

### ▶ Part 2 kick-off (paste after `/clear`; A1–A8 are ruled above)

```
On dev. Execute Part 2 of docs/projects/active/PUBLIC_TOURNAMENT_STAGE7_BUILD_PROMPT.md. Read its "Part 1 execution"
block first, then the owner's A1–A8 rulings recorded under it (all eight as recommended). Build the focused pay page to the
ruled drawing (https://claude.ai/artifact/Hag6q9kkPzHiYKkRh1A1fS), every chrome piece asking isFocusedPublicPage — no
piece hard-codes `pay`. Fixture: node --env-file=.env.local scripts/seed-stripe-walk-tournament.mjs --inbox
b2cowan+setupcheck@gmail.com --pay-page (prints the links). Product-owner summary before code; then measure, /review,
the QA walk (next ledger §), records.
```

## ▶ Part 2 execution (2026-11-01, Claude) — built, reviewed, walk §440 published; committed 2026-11-01 on the owner's word

- **The build (to the ruled drawing).** `components/public/NotOnFocusedPage.tsx` is the one gate: under the frame only,
  the layout's `unlessFocused(…)` wraps the frame rail, the my-team dock, the follow deep-link prompt, the alerts nudge,
  the install prompt, the follow-account nudge, the account follow sync and the growth chrome (badge + banner); switch
  off, nothing is wrapped. `TournamentBand` returns the slim band (`data-public-frame-focused-band`, its own marker so
  none of the full band's width rules reach it; 52 px + the 3 px rule, the name only, 18 px / 24 px from 901, links to
  the Overview — A3, A4). `TournamentFooter` returns the short footer (name + credit for every plan but the demo — A5).
  Both ask `isFocusedPublicPage`, never in the preview (`basePath`). `TournamentFrame.module.css`: `.focusBand` /
  `.focusName` and a `:has()` one-column desk grid (A6). The page reads the switch and the URL tournament's public
  contact (`publicTournamentContactEmail`, the footer's own answer); `TeamPayContent` (focused only): "Team payment" eyebrow,
  the title at `--type-title` (A7), the contact line under the pay block on every state but clearing and a misaddressed
  link (A1, A2 — `misaddressed` on the view), no `page-content` floor (it left a ~250 px gap above the footer; the 10-25
  overlap padding is 0 under the frame), the broken-link card tightened to the drawing. A8: `PayBlock.module.css`
  gives `.link` 44 px under `[data-pay-focused]` with −12 px margins (no visible change; the switch-off page untouched).
  Two words added to `PAY_WORDS` (`focusedEyebrow`, `questions`); no pay copy changed.
- **Fixture.** `--pay-page` now gives "Stripe Walk Pay Direct" a PUBLIC made-up contact (`payments@stripe-walk.example`)
  so the walk sees the A1 line (the Invitational hides its contact on purpose) and prints two more links (broken under Pay
  Direct; a real link under the wrong tournament). Free event: a team in `stage1-northfield/fall-ball` (paylink probe).
- **Measured** (`.probe/stage7-measure.mjs`, real links, 360/390/1280): owing, not finished, refused, pay direct, broken ×2,
  misaddressed, free — no sideways scroll, band 55 = 52 + 3, no rail/ticker/dock/badge/banner/Sign in, title 20 px, column
  640 centred at 1280, refund link 44 px, first Pay button bottom 518 px at 390 × 844, no tap under 44 but the site-wide
  skip link. Switch off: no frame, eyebrow = event name, title 16 px, refund link 19 px (unchanged). `check:layout
  --only=pubt-pay-focused` (new entry; a broken link on a Stage 1 fixture, so it is stable across fixture resets) clean at
  361/390/768/1440.
- **`/review`** (high-risk tier; 3 lenses): **one High, fixed** — the step 0 rule missed a club's own web address
  (`/{tournament}/pay/{token}` has no org segment there), so `isNeverCache` also refuses `seg[1] === 'pay'`; guard extended.
  Fixed: the A8 margin no longer uses `1lh` (older Safari). Updated: three guards that pinned the layout's exact markup
  (Stage 1 ×2, Stage 5 ×2). Added guard cases (the gate, the frame-only wrapping, band/footer rule, A5 credit, the pay route
  is a focused section). Accepted, Low: the page looks up the org and tournament again (the layout's lookups are not
  request-cached), frame-on only. **Found outside Stage 7, not fixed:** the worker's `PRIVATE_ORG_SECTIONS` check has the
  same own-address blind spot, so a family's league sign-up/pay page on a club's own address can be kept offline — owned
  by the signed-in family accounts plan; reported to the owner.
- **Verification.** Focused suites 99/99; `npm run typecheck` 0; ESLint 0 errors on the changed files; `check:spelling`
  clean. `npm run verify:changed`: 13,041 / 13,047 before the Stage 5 guard update; the other five failures are other
  sessions' working-tree hunks (plan-billing-usage, public-tournament-stage6-walk ×3, support-console-stage3-guard).
- **Walk §440** published: https://claude.ai/artifact/4ioawHQVFheWCkR76LpRCd (source `PUBLIC_TOURNAMENT_STAGE7_WALK.html`),
  one walk, 10 parts, 34 steps, including a real test-card payment. Offline is not walkable on the dev server (the worker
  is production-only); it is pinned by the worker guard and walked at Stage 8.
- **Committed 2026-11-01 (owner: "commit"), two commits.** Step 0's own commit: `public/sw.js`, `tests/unit/sw-pay-page-never-cached.test.ts`. The
  rest: `lib/public-focused-page.ts`, `lib/public-ticker-pages.ts`, `components/public/NotOnFocusedPage.tsx`,
  `TournamentBand.tsx`, `TournamentFooter.tsx`, `TeamPayContent.tsx`, `TeamPay.module.css`, `PayBlock.module.css`,
  `TournamentFrame.module.css`, `app/[orgSlug]/[tournamentSlug]/layout.tsx`, `…/pay/[token]/page.tsx`,
  `lib/team-pay-view.ts`, `lib/online-payment-words.ts` (two words), the three guard tests plus
  `public-focused-page.test.ts`, `scripts/seed-stripe-walk-tournament.mjs`, `scripts/layout-screens.mjs` (one entry), the
  drawing and walk HTML, this file, the plan row, TODO, ledger §440 (only this stage's lines of the shared TODO and
  ledger). **Restart owed before the owner's browser test** (new
  files, a layout and a shared words module changed).

## Not in Stage 7 (say so if a step drifts toward one)

The pay block's words, options, fees or buttons; the family league pay page (a different page, owned by the signed-in
family accounts plan); sponsors (a side stage, its plan gate is `/strategy`'s); who owns the colour (Stage 1a — this
page reads the same colour role as every other page, so 1a changes it for free); emails and link previews (the
"Later" row); turning the switch on (Stage 8).
