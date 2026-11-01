# Signed-in family accounts · Stage 1: harden the "Your sign-up" door (build prompt)

> **Written 2026-11-01.** Plan of record: `SIGNED_IN_FAMILY_ACCOUNTS_PLAN.md`, Stage 1 (items 1–7 and the **"Ruled 2026-11-01"**
> list under them, which wins where they differ). Drawing: `SIGNED_IN_FAMILY_STAGE1_DRAWINGS.html`
> (https://claude.ai/artifact/P1FrRZ9cyLU1oCUpptCEim), through `/design` round 2. **Paste this into a new chat on `dev`.**
> Binding inputs, do not reopen: the owner's 2026-10-31 rulings (account at team placement; the emailed "Your sign-up" link
> STAYS, hardened; no other sent links) and the seven Stage 1 asks, **all ruled A on 2026-11-01**. Build to the drawing: its
> words, its frames, its tags. Where the drawing and this prompt disagree, the drawing's words win and the prompt's mechanics win.
> **It adds one migration.** `ls supabase/migrations` right before you create it: on 2026-11-01 the highest is 418 (billing,
> untracked, another session's), so the first free number is 419; another session may take it the same hour.
>
> Re-verify every lead below before building on it: other sessions share this working copy. Lines marked **[V]** were opened by
> the author of this prompt on 2026-11-01; lines marked **[H]** came from a helper's search and were not opened. Stage explicit
> paths only, commit only your own hunks, check `git diff --cached --name-only` before every commit, **commit only when the
> owner says**. Read "Shared-file traps" at the bottom first.
>
> **Recommended model: Opus 5.5, two sessions.** Each ends at a point that can ship alone.
> Session 1 = Parts 1–4 (the link learns to end and be replaced; the family's page; "Email me my link").
> Session 2 = Parts 5–8 (the emails, the club's "Send a new link", the unsubscribe secret, closeout).
> Update the Progress block after each Part. Helpers stay on Sonnet for reading.

## ▶ Progress (read first when resuming)

- Fill this in as each Part lands: Part, date, commit (or "uncommitted"), migration number and whether it is on dev only, tests
  run, anything the Part did differently from this prompt and why.
- **Session 1 (Parts 1–4) built 2026-11-01, not committed (owner's word owed).** Tests: `league-signup-link.test.ts` (new),
  `league-pay`, `house-league-signup-guard`, `club-frame-guard`, `club-stage4a-guard`, `house-league-ratings-guard`,
  `family-email-guard`, `support-console-stage5-*` all pass; `tsc` clean; ESLint clean on every touched file; spelling,
  tokens, type, contrast, dates, dictionary, manual-migrations checks pass. Full `npm test` has other sessions' failures
  (bank-debit-desk on the billing session's `lib/platform-stripe-fees.ts`, public-tournament stage 6, support-console stage 3,
  plan-billing-usage, stage0 follower dock); `verify-changed.mjs`'s ESLint step errors on a react-hooks plugin config issue
  that a direct `npx eslint` does not hit.
  - **Part 1** — mig **419** `419_a_familys_link_can_be_replaced.sql`, **applied to dev only** 2026-11-01; MANUAL_PROD_STEPS
    `pending`; dictionary + snapshots refreshed. Shape as recommended (`link_version` + `link_replaced_at`, version folded into
    the HMAC, a third token segment when ≥ 1). **Deliberate difference from plan item 3: no separate secret** (reason above).
    `readLeaguePayToken` now returns `{ registrationId, version }`; `registrationFromPayToken` is DELETED so nothing can read
    a token around the door. Minting takes the version: `LeaguePayFacts.linkVersion` (anchor's) feeds every facts-based
    sender; the placement mail reads `link_version` with its rows; the register route signs version 0 (a row made a moment ago).
  - **Part 2** — `lib/league-signup-link.ts` `openSignupLink(token, { at?, afterCheckout? })`. The clock is
    `signupLinkClockRanOut` in `lib/house-league-access.ts` (beside `coachPageOpenUntil`, so it is unit-testable). "Owes"
    = any child owing or clearing, or an `open` online payment for the sign-up. The poll passes `afterCheckout` (skips the
    clock only). All four doors go through it; the test pins that only the door calls `readLeaguePayToken`.
  - **Part 3** — `StatusLookupForm.tsx` renamed **`YourSignup.tsx`** (form removed; first names only; reference line + foot
    line as drawn; "Your registrations" band removed). `buildSignupStatus` no longer sends `playerLastName` at all. Pay block
    lines and receipt lines are first names (`firstNameLabel` shapes stored descriptions at read; nothing rewritten). The
    Stripe checkout's own line names are untouched (paying is out of scope).
  - **Part 4** — `EmailMyLinkForm.tsx` (+ `.module.css`, full-width button on a phone) on the plain status page and inside
    the "This link no longer works" card. Route `email-my-link` (replaces `status-lookup`, deleted): per-IP public throttle,
    per-inbox throttle, new durable rail `signup_link_email` (10/hour); one `{ ok: true }` body and a **1.5 s answer floor**
    whether or not anything matched; a failed send answers the same. **Choice to report:** ONE email per address, one
    "Your sign-up" button per sign-up (the drawing's tab 2 note); with several sign-ups each button sits under "For {first
    names}" and its reference — words `SIGNUP_LINK_WORDS.mail.bodyMany` / `forChildren` are not drawn. New kind
    `league_signup_link`, sent through `sendTransactionalEmail` (an account notice like the sign-up email, the drawn "Sent by
    … because someone asked for this link on the club's site" footnote); no stored template, so the built HTML is sent.
    **Default to report (not drawn):** the sign-up success screen's link is "Your sign-up →" to the signed link (falls back to
    "Email me my link →" when the server signs no links), and its two lines that promised a reference lookup now read "Keep
    your reference to quote if you contact the club." / "Didn't get it? Check your spam folder."
  - **Gap until Part 5 lands:** every family email's reference line still says "Check your registration any time: {plain
    page}. You'll need this reference and your email." The plain page now emails the link, so it still leads somewhere, but
    "you'll need this reference" is false. Part 5 replaces it; do not ship Session 1 to production without Part 5.

## What the owner sees after this build (present a version of this as the PM summary BEFORE any code)

- **The family's page is called "Your sign-up"** (it was "Check your registration") and shows each child by **first name only**,
  on the page and in its pay block. The reference number stays, as a number to quote to the club; it opens nothing. A quiet line
  at the foot says the club can replace the link if it has been shared. The club's own screens keep full names. Emails keep full
  names (ask 7).
- **Lost the email?** The season page's "Already signed up?" line now reads **"Email me my link"**. The family types their email;
  if they have a sign-up this season, the link goes **to that inbox only**. The screen says the same thing either way, so it never
  tells a stranger whether an email is signed up. The email-plus-reference lookup is gone, and a reference alone no longer opens
  a page or a withdraw request.
- **The link ends.** It works while the season runs and for **30 days after the club marks the season finished**; a family that
  still owes money keeps theirs until they have paid (ask 1). After that the family sees **"This season has finished"** (no
  form). A link the club has replaced shows **"This link no longer works"** with "Email me my link" right there (ask 5).
- **The club can replace a link.** The registration window gains a **"Send a new link"** row for anyone who can change
  registrations (ask 4). A confirm names every child on the sign-up; the old link stops at once **for every brother and sister on
  that sign-up**, and one new link is emailed (ask 6). The registration's history gains "New link sent; the old one stopped".
- **Every family email has one button, "Your sign-up"** (ask 2), in place of "Pay now", "Check your registration", "See your
  registration" and "View your receipt". The sign-up confirmation always carries it; every later email carries it **only when
  money is owed** (ask 3; the table on drawing tab 5 is the spec).
- **Behind the scenes:** the unsubscribe link refuses to work without its secret instead of falling back to a fixed one.
- Who can do what is unchanged, except the new row (anyone who can change registrations).
- **Tournaments are untouched.** A family's link and a tournament team's pay link share a secret today; a reset here never
  changes that secret, so it can never touch a tournament (see Part 1 for why no separate secret is needed).

## Before any code (AGENCY_RULES, blocking)

1. **The product-manager UX summary**, in the conversation (above is the raw material).
2. **Ask the owner nothing up front.** Every default below is a recommendation to REPORT. One thing is genuinely his and is
   marked **⚖ report**: confirming `UNSUBSCRIBE_SECRET` is set on production before the release that carries Part 7.
3. **Schema = dictionary, same unit of work** for the migration: `docs/agents/db/DATA_DICTIONARY.md`, `npm run refresh:snapshots`,
   `npm run check:dictionary`, a `supabase/migrations/MANUAL_PROD_STEPS.json` entry (prod `pending`, applied **before** the code
   ships). Apply to **dev only**. Club Tier is not on sale, so production has no real house-league families, but the migration
   must still be safe on a table with rows (defaults, no rewrite of existing values).
4. **No watched automation.** Nothing here touches a hook, `.claude/settings*.json`, a `WATCHED_PATHS` file
   (`scripts/check-agent-automation.mjs`) or a database check. If something seems to need one, stop and ask.
5. **Copy.** Every family- or club-facing string goes through `npm run check:spelling`; no em dashes in customer words; new
   strings go in the surface's words file (`lib/league-pay-words.ts`, `lib/house-league-money-words.ts`,
   `lib/online-payment-words.ts`), not inline. Words exactly as drawn.

## What the code does today (verified or flagged; re-read every line)

**The token.**
- [V] `lib/league-pay-link.ts:1-13` — "Signed, never stored, never expiring". token = `{registration id b64url}.{HMAC-SHA256 over
  "league-pay:{id}", 16 bytes}`. Secret `PAY_LINK_SECRET`, imported from `lib/team-pay-link.ts` (:16) and shared with the
  tournament team link, whose message is `team-pay:{teamId}` [H :28]. Exports `signLeaguePayToken` :27, `readLeaguePayToken`
  :34, `registrationFromPayToken` :47 (pure, no database), `leaguePayPath` :53, `leaguePayToken` :58, `leaguePayUrl` :64.
- [V] `lib/league-signup-status.ts:67-78` `signupRowsForLink` — the anchor by id; no `signup_ref` → the anchor alone; else every
  row in the season + org with the same `signup_ref` **and** the same `guardian_email` (or null email). **This set is "the
  sign-up" for every rule below** (ask 6).
- [V] `lib/league-pay-view.ts:183-184` `buildLeaguePayView` mints a fresh token from a registration id. [H] It is used by the token
  page, the lookup route (:99, so the lookup hands out a working pay key today) and the register route (:211).
- **Every door that reads a token goes through `registrationFromPayToken`** [H]: the token page
  `app/[orgSlug]/league/[seasonSlug]/status/[token]/page.tsx:50`; the Stripe checkout `app/api/pay/league/[token]/route.ts:71`;
  the post-checkout poll `app/api/pay/league/[token]/status/route.ts:23`; the withdraw route
  `app/api/league/[orgSlug]/[seasonSlug]/withdraw-request/route.ts:53`. Re-grep for any other caller before Part 2.

**The family's pages.**
- [H] Token page: h1 "Check your registration" :66, metadata :21 [V :21, :66]; invalid-link card `LW.error.linkInvalid`
  (`lib/league-pay-words.ts:44`).
- [H] Lookup page `app/[orgSlug]/league/[seasonSlug]/status/page.tsx` [V h1 :53, metadata :17] renders
  `StatusLookupForm.tsx` (same folder): email + reference state :109-110, POST `{email, refCode}` :128-131, fields :196-224,
  "couldn't find" :248, withdraw POST :166-172 (token, else email + refCode + child). **Full names** render at :271, :318,
  :331-332, :358; in the pay block at `lib/league-pay-view.ts:150,160` (`childName`), `lib/league-pay-facts.ts:409` (share
  description) and receipt lines from `online_payment_items.description` (`league-pay-view.ts:93-98`), drawn by
  `components/public/LeaguePayBlock.tsx`. ⚠ Stored item descriptions carry full names: shape the name at read for the page;
  do not rewrite stored rows.
- [V] Lookup route `app/api/league/[orgSlug]/[seasonSlug]/status-lookup/route.ts`: the possession comment and match :80-84, the
  `wholeSignup` pay-block gate :94-100.
- [H] Withdraw route: body `{email, refCode, child, note, token}` :36; code path when no token :46, :60-68; token path :51-59;
  refuses a finished season by `status` :72.
- [V] Links into the lookup: season page `app/[orgSlug]/league/[seasonSlug]/page.tsx:285` ("Already registered? Check your
  registration"), register page `.../register/page.tsx:108` ("Already signed up? Check your registration"), the sign-up success
  screen `components/league/RegisterForm.tsx:137,439` ("Check your registration →" to the plain status page).

**The season's end.**
- [H] `league_seasons.finished_at` is stamped by trigger `league_seasons_finished()` (mig 377 :70-80) on the move to
  completed/archived and cleared on reopen. [V] `lib/house-league-access.ts:127` `COACH_PAGE_DAYS_AFTER_FINISH = 30` and
  :164-168 `coachPageOpenUntil(finishedAt, now)` — reuse it, do not restate 30.
- [H] Money owed comes from `loadLeaguePayFacts`; `facts.refusal` is set when nothing is owed (and for other refusals: read the
  refusal kinds and use only "nothing owed" for the keep-until-paid rule).

**The emails** (the drawing's tab 5 table is the spec; this is where each lives) [H unless marked]:
- `lib/email.ts` `payBlock` :883-904 (button `M.payButton` "Pay now", `lib/league-pay-words.ts:91`; nothing when `toPay <= 0`);
  [V] `refBlock` :907-911 ("Check your registration any time: {plain /status url}. You'll need this reference and your email"),
  so **today's emails carry two kinds of link**.
- `leagueSignupHtml` :919 (payBlock :984, refBlock :986; sender `register/route.ts:223`, [V] `statusPath` :225).
- `leagueAdminApprovedHtml` :1000, `leagueAdminWaitlistedHtml` :1042, `leagueWaitlistPromotedHtml` :1073 (senders in
  `app/api/admin/house-league/seasons/[seasonId]/registrations/[regId]/route.ts` :567-580, :607, :70-94).
- `leagueTeamsPlacedHtml` :1261 and `leagueTeamMovedHtml` :1294 ("See your registration", **sent even when nothing is owed**),
  from [V] `lib/house-league-placement-mail.ts:45-48` `statusUrl()` (signed link, else the plain page), used :163, :171-175,
  :191-193; callers `.../publish/route.ts:45,85`, `.../placement/route.ts:53`.
- Receipt `lib/online-payment-receipt.ts` `sendLeagueReceipt` :77 (button `E.viewReceipt` "View your receipt",
  `lib/online-payment-words.ts:202`).
- Club "Email the pay link" `sendLeaguePayLink` :247 (button "Pay now" `league-pay-words.ts:55`; refused when nothing owed :271;
  stamps `pay_link_sent_at` :297; kind `league_pay_link`; three callers in the [regId] route :280, :324, :395 — a guard test pins
  that count at 3).
- Bank debit `lib/bank-debit-email.ts`: returned :120 (button :129), reversed :141 (button :151), both "Pay now" when
  `canPayAgain`.
- No family link today, leave alone: declined :1114, withdrawn :1198, spot released :1219, practices changed :1336, schedule mail.
- ⚠ These go through `sendTransactionalEmail` (`lib/platform-email-templates.ts:197`): an operator-customised template row
  replaces the default HTML. Query dev and prod for customised rows of these kinds and report; do not edit stored templates.

**The club side.**
- [H] `components/admin/kit/club/league/registrations/RegistrationRecordWindow.tsx:145-154` renders the doList from `model.sheet`
  with no gating of its own. Rows are labelled in `RegistrationsScreen.tsx:271` and handled at :444 (`payLinkOne` :505-513,
  PATCH `{ payLink: true }`); rights :174-178.
- [H] `lib/house-league-registrations.ts` `RegRights` :347-357, `rowActions` :373 (payLink :390 needs `takeFees && owing &&
  payLinks`; `register` rows :386, :393-394, :398). [V] `lib/house-league-access.ts:107` `register: desk && !finished` (= "can
  change registrations"), :108 `takeFees: desk`.
- [H] PATCH `.../registrations/[regId]/route.ts:257`; register-gated actions refuse with `houseLeagueRefusal(ctx,'register',
  season)` :435, :500.
- [H] **History has no event table.** `registrationHistory` (`lib/house-league-registrations.ts:645-697`) derives lines from
  stored timestamps through `add(iso, text)` :657; words in `REG_RECORD_WORDS.timeline` (`lib/house-league-money-words.ts`).
  A "new link sent" line needs a stored timestamp (Part 1).

**The unsubscribe secret.** [V] `lib/unsubscribe-token.ts:13-22` warns and returns
`'insecure-dev-fallback-do-not-use-in-production'` when `UNSUBSCRIBE_SECRET` is missing. [H] `amplify.yml:68` notes it is a
console variable, not echoed.

**Rate limiting.** [H] `lib/no-login-token.ts`: `checkNoLoginRateLimit` :113, `tooManyRequests` :139, rails in `NoLoginRail` :52
and `POLICIES` :68 (a new rail goes in both).

**Tests that will move** [H]: `tests/unit/league-pay.test.ts` (signing; team and family tokens never cross, :17-31; routes
:60-85); `tests/unit/house-league-signup-guard.test.ts` (reads StatusLookupForm, the lookup route and league-signup-status;
regex-pins the lookup match :83 and `wholeSignup` :94; slices `payBlock`..`refBlock` :67-68 and `leagueSignupHtml` :50);
`league-practice-tell.test.ts:228,236`; `stripe-fees-owner-rulings.test.ts:95,103`; `public-face-s3b-family-emails.test.ts:321`;
file lists in `club-frame-guard.test.ts:49`, `club-stage4a-guard.test.ts:37`, `house-league-ratings-guard.test.ts:58`. Repoint a
guard to the rule's new home; never delete a guard's intent.

## Build, in this order, each committed (when the owner says) after its checks

### Session 1 — the link learns to end and be replaced; the family's page; "Email me my link"

**Part 1 — the per-sign-up link state (migration 419 or next free).**
- Recommended shape (report if you choose otherwise): two columns on `league_registrations`, `link_version int not null default
  0` and `link_replaced_at timestamptz null`. **Fold the version into the HMAC message** rather than storing a hashed token: the
  product mints the link in many places (`buildLeaguePayView`, every sender) and must keep doing so, and "Email me my link"
  re-sends the same link ("Your link has not changed", drawing tab 5). **Version 0 keeps today's message exactly**
  (`league-pay:{id}`), so links already in inboxes keep working until a reset; version n ≥ 1 signs `league-pay:{id}:v{n}`.
- **No separate secret.** The plan asked to separate the family secret from the tournament one "so a reset never touches a
  tournament". A version-based reset never rotates the secret, and the two messages are already domain-separated (the existing
  test pins that they never cross), so a new env var would only add an owner step and a release-order risk. Record this in the
  Progress block as a deliberate difference from plan item 3.
- The token itself must carry the version (e.g. a third dot-segment, absent = 0) so the pure reader can check the signature
  before any database read. Keep `readLeaguePayToken` pure; the database check is Part 2.
- Dictionary, snapshots, `check:dictionary`, MANUAL_PROD_STEPS (pending), dev only.

**Part 2 — one door decides whether a link opens.**
- One server function (in `lib/league-signup-status.ts` or a new `lib/league-signup-link.ts`), e.g.
  `openSignupLink(token, { orgId, seasonId, season })` → `{ ok: rows }` | `{ ended: 'finished' }` | `{ ended: 'replaced' }` |
  `{ ended: 'invalid' }`. Rules, in order:
  1. Signature fails, wrong club or wrong season → `invalid` (draw it as "This link no longer works": the family cannot tell a
     mangled link from a replaced one, and "Email me my link" is the honest way out).
  2. The token's version ≠ the anchor row's `link_version` → `replaced`.
  3. Season finished and `coachPageOpenUntil(finishedAt)` is null **and the sign-up owes nothing** → `finished`. A sign-up that
     still owes keeps its link until paid (ask 1). A reopened season (`finished_at` cleared) opens again.
  4. Otherwise `ok` with `signupRowsForLink`.
- **Every door goes through it**: the token page, the Stripe checkout, the post-checkout poll (⚠ a family who pays the last
  dollar must still see their success poll: do not let rule 3 close the poll mid-checkout; a payment in flight counts as owing,
  or let the poll through for its session), and the withdraw route. Re-grep `registrationFromPayToken` callers; none may bypass.
- Minting: `leaguePayToken` / `leaguePayUrl` / `buildLeaguePayView` sign with the anchor's current `link_version` (they need the
  row, or the version passed in; pick one and make every caller follow).
- Tests: version 0 still opens today's links; a bumped version refuses the old token and opens the new; finished + 30 days +
  nothing owed → finished; finished + owing → ok; reopened → ok; team and family tokens still never cross.

**Part 3 — the family's page (drawing tabs 1, 3, 6).**
- Title and h1 "Your sign-up" on the token page (metadata too). First names only on the page and its pay block (shape at read;
  stored item descriptions untouched). The quiet foot line as drawn.
- The two ended screens exactly as drawn (`endFinished`: no form, the receipts sentence, the club's contact as text with the
  frame's Copy; `endReplaced`: "Email me my link" form inline). Both in ClubFrame, both at phone width.
- The withdraw request on the page stays (it rides the link).

**Part 4 — "Email me my link" replaces the lookup (drawing tab 2, tab 5 email).**
- The plain status page becomes the "Email me my link" form; the season page and register page lines read "Already signed up?
  Email me my link" as drawn. The sign-up success screen's link: **default** = "Your sign-up →" straight to the signed link (the
  register route already knows the sign-up); report it, it is not drawn.
- A new route (replacing `status-lookup`): takes the email only; rate-limited through a new `NoLoginRail` with its own policy;
  finds every sign-up in that season under that email **whose link would open** (Part 2 rules) and sends one email per sign-up
  (or one email naming each, if the drawing's single-sign-up email reads naturally that way: report the choice) with the
  drawn subject, body and footnote ("someone asked for this link on the club's site"); a new email kind. **Always the same
  answer and the same response time shape** whether or not anything matched; never a pay key in the response.
- The withdraw route accepts the link only; the email + reference path goes. The lookup route is deleted (and its
  `status-lookup` callers), its possession comment's intent moves to the new route's guard.
- Repoint `house-league-signup-guard.test.ts` to the new homes.

### Session 2 — the emails, the club's door, the unsubscribe secret, closeout

**Part 5 — one button, "Your sign-up" (drawing tab 5 table is the spec).**
- `refBlock` keeps the reference ("Quote it if you contact the club", as drawn) and loses the plain-page link and "You'll need
  this reference and your email". One "Your sign-up" button carrying the signed link replaces "Pay now", "Check your
  registration", "See your registration" and "View your receipt".
- Which email carries it: sign-up confirmation **always**; accepted, waitlist spot opened, placed on a team, moved team, receipt
  (a balance left), club's pay link, bank debit returned/reversed **only when owed**; waitlisted **never** (nothing is owed);
  the two new emails always. `house-league-placement-mail.ts` needs an owing check it does not have today; its plain-page
  fallback goes (no secret → no button, as the pay block already does).
- The receipt with nothing left owing carries no button ("the receipt is in the email").
- Emails keep full names (ask 7). The `sendLeaguePayLink` call count stays 3.
- Report any customised template rows found (see "What the code does today").

**Part 6 — "Send a new link" (drawing tab 4).**
- A row after "Email the pay link", offered for every registration with an email while its season's link is live (Part 2's
  rules, so not on a finished-and-closed one), whatever the child's status, gated on `register` ("can change registrations"),
  not `takeFees`. Its hint names the brothers and sisters it covers ("Stops the link they have now, for Maya and Leo").
- The "Email the pay link" hint before first send: "Opens their sign-up page to pay by card" (was "status page").
- The confirm (shipped `ConfirmWindow`, the drawn width and body), then: bump `link_version` and stamp `link_replaced_at` on
  **every row of the sign-up** in one statement, email one new link (a new email kind, the drawn words), toast "New link sent
  to {email}." in the shipped NoticePill. The route refuses with `houseLeagueRefusal(ctx,'register',season)`.
- History line "New link sent; the old one stopped" from `link_replaced_at`, no actor name (as drawn).
- Tests: a reset stops every sibling's old token; a sibling's new link opens; a member without `register` is refused.

**Part 7 — the unsubscribe secret.**
- `lib/unsubscribe-token.ts` refuses to sign or verify without `UNSUBSCRIBE_SECRET` (signing returns no link, so no unsubscribe
  link is drawn rather than a dead one; verifying answers "this link doesn't work"). Make sure local dev has it set or say how.
- **⚖ report:** the owner confirms `UNSUBSCRIBE_SECRET` is set in the Amplify console for production before the release that
  carries this. Add it to the release-history record's pre-promote steps, not to this file only.

**Part 8 — closeout.**
- `npm run verify:changed`, `npm run typecheck` (8 GB heap), the moved tests, `check:spelling`, `check:dictionary`.
- Offer `/simplify` (Part 2's door is a new shared helper), then `/review`, then `/docs`: the help articles name the old page and
  the reference lookup (`lib/help-content/house-league.tsx:961, 1055, 1058` [V], and the "Paying by card" article).
- A checkable QA walk Artifact for the owner (one purpose: the family's door end to end, plus the club's row), and an Owner QA
  Ledger entry pointing at it.
- Update the plan's Stage 1 with what shipped and the commits; TODO line; the memory note
  `project_end_state_signed_in_family_app.md` and its MEMORY.md line.
- Restart the dev server before the owner's browser test (new files + migration).

## Not in this stage (stay out)

- Family accounts, the claim step, the second guardian email, anything signed-in (Stages 3–5).
- Tournament registration tidy-up (Stage 2). The tournament team pay link, its secret, its pages.
- Any change to how a family pays (Stripe checkout, fees, bank debit) beyond the door check in Part 2.
- Rewriting stored payment item descriptions; editing stored email templates.
- A new env var for the family link (see Part 1).

## Shared-file traps

- `TODO.md`, `docs/projects/active/OWNER_QA_LEDGER.md` and `supabase/migrations/MANUAL_PROD_STEPS.json` carry other sessions'
  uncommitted edits (2026-11-01: the billing session's 416–418): stage only your own hunks (temp-index method in the memory note
  "Partial commit out of shared files").
- `lib/email.ts` and `lib/email-kinds.ts` are touched by the house-league and billing sessions: re-read before editing, add only
  your kinds.
- The `[regId]` registrations route and `lib/house-league-registrations.ts` are edited by House league 9d work: `git log -5 --
  <file>` before you start, and re-read the file at the moment you edit it.
- Typecheck needs the 8 GB heap on this repo. `verify:changed` may stop on other sessions' failures; report them, do not fix them.
- Dev server: new files and a migration mean a restart before the owner's browser testing (AGENTS.md); do not delete `.next`
  while it runs.
- Never put a backtick or `$` in a shell string while writing files; use the Write/Edit tools.
