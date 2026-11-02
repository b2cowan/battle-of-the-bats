# Signed-in family accounts · Stage 2, Tournament registration tidy-up: build (prompt)

> **Written 2026-11-01.** Plan of record: `SIGNED_IN_FAMILY_ACCOUNTS_PLAN.md`, Stage 2 (items 1–5 and the **"Ruled 2026-11-01"**
> list under them, which wins where they differ). Drawing: `SIGNED_IN_FAMILY_STAGE2_DRAWINGS.html`
> (https://claude.ai/artifact/LcsxtXG1eQ5HRwEPqLp9CV). **Open the drawing before building each Part** (Artifact `read`): its
> words, frames and tags are the spec. Where the drawing and this prompt disagree, the drawing's words win and the prompt's
> mechanics win. **Paste this into a new chat on `dev`.**
>
> **Binding inputs, do not reopen:** a tournament coach keeps their account at registration; tournaments stay public; the team
> pay link stays a sent link; no new sent links; and the five Stage 2 asks, **all ruled A on 2026-11-01** (one email leading with
> the registration; nothing replaces the address in links, the join page asks for it; finish screen keeps "You're In Motion"
> with no big button; the form gets its own limits with the same numbers and words; the coach's address is masked on the team
> pay page AFTER the Stage 7 walk passes, no reset).
>
> **No migration.** The claim table stays (Part 2). No schema change means no dictionary or snapshot work; if
> `docs/agents/db/DATA_DICTIONARY.md` describes the claim table as something a link is sent for, correct the sentence only.
>
> Re-verify every lead before building on it: other sessions share this working copy. Lines marked **[V]** were opened by the
> author on 2026-11-01; lines marked **[H]** came from a helper's search and were not opened. Stage explicit paths only, commit
> only your own hunks, check `git diff --cached --name-only` before every commit, **commit only when the owner says**. Read
> "Shared-file traps" at the bottom first.
>
> **Recommended model: Opus 5.5, two sessions.** Session 1 = Parts 1–3 (the limit, the old door that goes, no address in links).
> Session 2 = Parts 4–7 (the one email, the finish screen, the pay-page mask, closeout). Update the Progress block after each
> Part. Helpers stay on Sonnet for reading.

## ▶ Progress (read first when resuming)

- Fill in as each Part lands: Part, date, commit hash (written when the owner says to commit), tests run, anything done differently from this prompt and why.
- **Session 1 (Parts 1–3) built 2026-11-01; commit hash to be recorded when the owner commits.** Tests: new `register-form-throttle`, `team-claim-link-removed`, `coach-portal-links-no-address`; updated `account-first-signup`, `support-console-stage4b-coach-guard`, `signup-verification-guard`; the related files (`coach-signup-throttle-guard`, `first-look-stage2-emails`, `public-face-s3b-family-emails`, `observability`, `team-checkout-customer`, `first-look-stage3`) all pass; `tsc` clean (needs `NODE_OPTIONS=--max-old-space-size=8192`, the default 4 GB heap runs out); eslint on the changed files shows only 3 warnings that were already there; spelling, dictionary-coverage, observability-coverage and token checks pass.
  - **Part 1.** `throttleRegisterForm` (first line of the handler) and `throttleRegisterRecipient` (right after the address is read) in `lib/public-form-throttle.ts`, own buckets, same numbers; `TOO_MANY` is now exported. The 429 reaches the "Registration Failed" card verbatim (`postRegistration` throws the route's `error`). Tests are source guards, not behaviour: `lib/rate-limit.ts` uses a TypeScript parameter property, which the node test runner cannot load, so the limiter cannot be imported (same reason the lead-form guard reads source). **Order trap: left as is.** In the fallback branch (verification off, dev only) a 429 after the account is made leaves an account and no registration, but the coach's Try Again signs in through the existing 409 path and registers; the production branch registers first so it cannot happen.
  - **Part 2.** Confirmed by grep first: the dev seed route was the only creator of a claim. Gone: `/coaches/claim`, `/team/claim` (and its rewrite), the dev seed route, its status counter and dev-tools card, the claim branch of `create-team-checkout`, `claimToken` in `lib/team-checkout.ts` / `portal-keep-premium.ts`, the claim prefill in `TeamSignupClient`, the route-list entries (`proxy.ts`, `consumer-routes.ts`, `coaches-portal-routes.ts`), the token code in `lib/team-workspace-claims.ts`, and the UAT claim scenario. **Kept:** the table, Tournament Chat's three reads of it, `assertTeamWorkspaceClaimAvailableForProvisioning` / `markTeamWorkspaceClaimed` / `TeamWorkspaceClaimError` (checkout metadata that already carries a claim id), the organizer's invitation. Left alone on purpose: the cleanup of claims in `seed-stripe-walk-tournament.mjs` and the table list in `seed-uat-standalone-coach.mjs` (both are about the table, which stays). **Found, not changed:** `/api/auth/team-signup` still accepts a `claim: true` flag nothing sends now (harmless; its test still pins it). Dictionary sentence corrected. Old `/team/claim/…` links now 404 (none were ever sent).
  - **Part 3.** Address removed from `coachPortalUrl` / `coachPortalFooter` (so every template), the schedule email, game-day reminder, accepted email, resend-access and remind-signups links, the Claim team button on `/coaches`, and the Register form's confirm-return path. **Join page:** a signed-out visitor with a registration sees "Open your team" (the drawing's words) with one email box; Continue asks `/api/coaches/registration-account-status`, which now answers `matches` as well as `accountExists` and has limits of its own (20 per source and 10 per registration in 15 minutes, 300 together in 5). A mismatch says "That isn't the email this registration was made with. Use the address you registered with." (my words; the drawing has none, **owner to confirm**). A failed check is an error with Try again, no longer "fail open to Create account" (the typed address is unproven now). Signed in as someone else: "You're signed in as …, which isn't linked to this registration", never naming the other address. **Left alone, reported:** the `/auth/login?…&email=` hand-offs on the join page now carry the address the visitor typed on that page (a pre-fill for the next screen, not a link we send); `accountExistsSignInHref` and the other flows' in-app sign-in links are untouched as ruled. **Residual risk:** someone holding a forwarded registration link can still try addresses against the box, at 10 tries per 15 minutes per registration.

- **Session 2 · Part 4 built 2026-11-01; commit hash to be recorded when the owner commits.** Tests: new `registration-one-email` (every row of the table run through the plan, the never-drop-a-link invariant over every combination, each account-step failure branch, the rendered panel and subject, the route's and form's order); updated `signup-verification-guard`, `coach-portal-links-no-address`, `public-face-s3b-family-emails`, `team-coach-notices`; `first-look-stage2-emails`, `coach-signup-throttle-guard`, `register-form-throttle`, `account-first-signup`, `coach-register`, `observability`, `demo-sandbox-write-guard`, `registrable-teams`, `sign-in-words-and-no-tell-guard` pass; `tsc` clean (heap flag); eslint and spelling clean.
  - **Mechanism: NOT the prompt's hold.** A hold released by a second call from the browser cannot keep the zero-emails invariant: a closed tab, a lost signal or a crash between the calls leaves the coach with nothing, and no server test can cover a call that never arrives. Instead the form's one post carries the new coach's password and names (verify path only, `postRegistration(true)`), and `/api/register` runs the account step ITSELF after the entry is filed and the organizer's alert has left (`lib/registration-account.ts`: existing account looked up first; a waiting one gets a magic link, a new one a signup link; own limiters with the coach sign-up's numbers; never throws, every failure is `failed`). Then `planCoachRegistrationEmails` (`lib/registration-email-plan.ts`, pure) picks the coach's emails. So: no hold flag, no registration-id/email match check (the account is the registration's own address, same request), no "send my registration email" route, and the coach sign-up and resend routes are untouched.
  - **The email.** One panel builder (`registrationPortalPanelHtml`, in the plan module so the tests render it; `lib/email.ts` cannot load under the node runner) used by both `registrationConfirmationHtml` and `waitlistConfirmationHtml`. Subject and heading "We’ve got your registration" (waitlist keeps its subject and heading, gains the panel when there is a link). The combined email goes through `sendEmail` with the template's kind, never the template resolver, so a template customised between the check and the send cannot drop the button. Keys unchanged; no new email kind. `isPlatformTemplateCustomised` never throws (a throw there would 500 after the entry was filed). `registrationPortalPath` moved to `lib/coaches-portal-routes.ts`, shared by the form and the route; `signupConfirmUrl` is the one spelling of the confirm address.
  - **Rows, as built.** New coach / waitlist / waiting account: one email with the confirm panel. Signed in, manager, confirmed account, or account step failed: one email, "Open your Coaches Portal", no "is ready". Switch off: the plain confirm email only. Customised template: the custom email plus the plain confirm email.
  - **Rare path, reported:** where Step 1's check was busy, the dev-style branch calls the coach sign-up first (which sends the plain confirm email) and then `registerForWaitingAccount`, whose registration email carries a fresh link. Two emails there (three before). Same as before Part 4, a fresh magic link may make the first email's link stale.
  - **`/review` 2026-11-01 (high-risk tier, 4 lenses: logic, security/auth, regression, concurrency): no Critical or High.** Fixed: (1) the account step refuses when `RESEND_API_KEY` is unset (the coach sign-up's rule; it made a waiting account with no email possible); (2) `registerForWaitingAccount` shows the "couldn't set up" note on `failed` instead of "check your email" (shared `ACCOUNT_STEP_FAILED_NOTE`); (3) the dev email preview used the old subject and had no new-coach sample: both added. Pinned in `registration-one-email`. **Reported, not changed (parity with the old flow):** the `exists` note says "we’ve sent the link again" even when no link went (confirmed account, or a failed magic link); the 60-per-5-minutes global and 15-per-15-minutes per-source account limits are the coach sign-up's, so a registration-night rush on one network still lands some coaches on the "couldn't set up" note; a second registration for a still-waiting address mints a fresh link that may stale the first email's; the account step adds the account lookup and a link to the registration request (a host timeout after the entry is filed shows an error card and Try Again meets "already registered"; very unlikely at current scale); a stranger can still make a waiting account for someone else's address with their own password (inherent to verify-by-link; before Part 4 the victim got the same two emails, now one). **Left for the owner:** the platform-admin template editor's seed for this email (migration 083) still names it "Registration Received!"; it only shows once an admin customises the template, and changing it is a migration. Gate note: `verify:changed` stops on 5 unit failures that predate this work (plan-billing-usage, public-tournament-stage6-walk ×3, support-console-stage3-guard) and its eslint step crashes on a config error over 69 changed files; the checks after it that fail name only other sessions' files.
  - **For the walk:** the new path runs only with verification on. Dev needs `REQUIRE_SIGNUP_EMAIL_VERIFICATION=true` (and a Resend key) to see the one email.

- **Session 2 · Part 5 built 2026-11-01; commit hash to be recorded when the owner commits.** Tests: new `registration-finish-screen` (7, source guards); `signup-verification-guard`, `registration-one-email`, `coach-portal-links-no-address`, `account-first-signup`, `register-form-throttle` pass; `tsc` clean (heap flag); lint and spelling clean.
  - **As drawn (tab 3, with round 2's corrections).** The check-your-email block keeps its place under the opening sentence (it was already above the rows) and gains the heading "Confirm your email to open your portal" and the first line "Open the link we sent. It works for 1 hour."; its shipped "Verification email sent to …", "You’ll hear from the organizer…" and "Send the link again" stay; its "Already confirmed? Sign in" foot is turned on. `VerifyEmailSent` gained an optional `heading`, rendered in the `register` look only (the one caller). "Watch your email" adds "and the link to confirm your email" only where a confirm link went (`confirmation.verifyEmail`): the already-has-an-account and account-step-failed cards keep today's words (round 2, item 4); with the organizer's confirmation switched off the row keeps "What happens next". The "Create your Coaches Portal" row and the "Create Coaches Portal Account" button are gone for a signed-out coach; the already-has-an-account card (new `accountExists` flag on the confirmation) has one "Sign in" button. The signed-in fallback card (only when an entry comes back without an id) keeps "Track your team" and "Open Coaches Portal".
  - **Sign-in links:** both go to `/auth/login?next=<the join link>`, through `www()` (FieldLogicHQ on a club's own address), with **no address** (the drawing's "address in a link 1 → 0"). The join link carries `verified=1`, so signing in there links the registration and opens it, as the confirm button does.
  - **Done differently: no `check:layout --changed`.** Other sessions' uncommitted changes under `components/coaches/` and `components/admin/` make `--changed` select every screen (a whole sweep on the dev server, which the rules forbid), and no listed screen is the public Register page or its post-submit card. The CSS change is one heading line in a shipped block; true size at phone and desk goes to the owner's walk.
  - **Account-step-failed card has no button now** (the drawing: "today's note stays… Not drawn: it is a sentence, no new screen"). Before, its "Create Coaches Portal Account" opened the join page; now the note points to the registration email's "Open your Coaches Portal", which opens the same page.
  - **No other stage touched this card:** `PUBLIC_TOURNAMENT_SITE_REVIEW_PLAN.md` never names it, and the file's last commits are 12a / 4e / auth work.
  - **Owner to confirm (not decided here):** the join page's mismatch line "That isn't the email this registration was made with. Use the address you registered with." is Session 1's wording; the drawing has none.

- **Session 2 · Part 6 built 2026-11-01 (gate open: the Owner QA Ledger records §440 "WALKED 2026-11-01, PASSED 34/34, no changes asked … Stage 7 closed"); commit hash to be recorded when the owner commits.** Tests: new `team-pay-address-masked` (5); `league-pay`, `public-focused-page`, `team-entry-lowered`, `league-signup-link`, `bank-debit`, `online-payments-12c-review-fixes` pass.
  - The three spots, as the league page does them: `lib/team-pay-view.ts` masks `payerEmail` with `maskEmail` (the view is the only thing the page hands the browser; `TeamPayFacts` never leaves the server); `TeamPayContent` sends an empty email while the field still holds the masked value; `/api/pay/team/[token]` refuses a masked address (`isMaskedEmail`) and both fallbacks (Stripe's `customer_email` and the payment row's `payer_email`) use the address on file. `PayBlock`: `PayerEmailField` only edits what it is given and `ConfirmingState` shows the masked address, as the league block does. No reset, no database change.

- **Session 2 · Part 7 `/simplify` 2026-11-01** (4 lenses over Parts 1–6's files). **Applied:** (1) the coach sign-up and the registration's account step shared the sign-up's three limits as two copies, so alternating the doors doubled the budget: one `takeCoachSignupBudget` in `lib/signup-verification.ts` now serves both (same numbers; `coach-signup-throttle-guard` pins them there); (2) `/api/register` starts the customised-template check and the online-payments lookup beside the account step instead of after it (both never throw); (3) the registration email's link no longer branches on whether an address was passed (`coachPortalUrl` always, with the registrationId): `coachEmail` left `RegistrationEmailParams`, the route and the dev preview. Guards updated in `registration-one-email`, `coach-signup-throttle-guard`, `signup-verification-guard`. **Skipped, with reason:** the remaining optional `coachEmail` fields on ~8 other builders are dead but harmless, and removing them edits ~10 admin routes outside this work (left for a tidy-up); the register form's limiter trio stays its own copy (the lead form's twin is pinned by another project's guard, and the separate buckets are ruled); one shared link-generation helper for the three verify doors (touches the live coach sign-up and resend routes; the shared budget took the behavioural part); folding the two signed-out finish paths (they map a waiting account differently on purpose); the join page's two flags (they diverge after "Create a new account"); a resolver-level "required footer" (Part 4 records why the combined email bypasses the resolver); a discriminated type for `heading`; an indexed account lookup in place of the paged `listUsers` scan (an existing shared helper; a separate piece of work).
  - ~~Found while reading, for `/review`: the registration's account step does not refuse a staff address.~~ **Wrong, refuted by `/review`:** `/api/register` refuses a staff address (`isPlatformAdminEmail`, 403) before the entry is filed, so before the account step; and platform-admin auth needs a confirmed email anyway.

- **Session 2 · Part 7 `/review` 2026-11-01** (high-risk tier; scope = Parts 5–6 and the `/simplify` changes; Part 4 had its own). Gate: full unit suite 13,141 pass / 25 fail, every failure another session's (billing cancel, plan ending, support console); `tsc` clean but for `lib/plan-ending-server.ts` (not ours); lint clean; `verify:changed`'s later checks run one by one, the failing ones name only other sessions' files; `check:layout` skipped (no listed screen is the Register finish card or the pay page's receipt field, and the shared tree widens `--changed` to every screen). Lenses: correctness, security/multi-tenant, regression, concurrency. **No Critical or High.** **Fixed (confirmed in the main loop):** (1) Medium, two lenses: the finish screen read "a link went" from the outcome, so `exists` with no link (a confirmed account, or a magic link that failed) still showed "Open the link we sent" on the waiting-account path; `/api/register` now returns `linkSent: !!actionLink` (a made link always goes, the plan's invariant) and both signed-out paths share one mapping, `signedOutFinish` (link → the check-your-email block; else `exists` → the already-has-an-account card with Sign in; else the account-step note). A waiting account that got a fresh link now sees the check-your-email block, not a Sign in that would fail until it confirms. (2) Medium/Low, two lenses: the organizer's alert promise sat un-handled across the account step's awaits (a send that rejects there was an unhandled rejection); it now carries its handler at creation, swallowing as `allSettled` did. Guards updated in `registration-finish-screen` and `registration-one-email`. **Reported, not changed:** a stranger can still make a waiting account on someone else's address with a password they chose, and if the owner confirms, the stranger knows the password (Part 4 reported it; inherent to verify-by-link with a caller's password, same in the coach sign-up; the fix is a product decision: make the account passwordless and set the password at confirm); the response's `created`/`exists` is the same account-existence answer the coach sign-up's 409 already gives; the shared per-address budget (5 an hour) can be spent by a stranger, as before, and on the registration path it degrades to the account-step note after the entry is in; the already-has-an-account note's "we’ve sent the link again" stays (the drawing keeps today's words) though no link goes to a confirmed account; a payer who half-edits the masked receipt address is silently given the address on file (the league page's behaviour); emails already sent with `?email=` no longer pre-fill the join page (by design).
  - **Not ours, named:** `tsc` reports one error in `lib/plan-ending-server.ts` (another session's file).

- **Session 2 · Part 7 `/docs` 2026-11-02.** `lib/help-content/coaches.tsx` `faq-coach-confirm-email`: a tournament registration has no separate email, the **Confirm my email** button is inside the registration email; an address that already has an account is told so on the finish screen and offered Sign in (answer + `answerText` + keywords). `lib/help-content/tournaments.tsx` `faq-new-coach-confirm-email`: one email with the button inside; with **Registration received** switched off (Event settings → Coach Emails, the toggle's real label) a short confirm email goes instead; `online-payments-team-pays` step 2: the receipt box shows the address on file partly hidden, left as is the receipt goes there, a different one can be typed (+ section `searchText`). `lib/help-content/platform-admin.tsx` `faq-confirm-email-safe`: the same one-email sentence. Lint, `check:spelling` and the 10 tests that read these modules + `help-articles` / `help-subtopics` (259) pass. Not documented: the join page asking for the address (no help article describes the join page). Pre-existing, named: `measure:help` flags "Review and accept teams" (413) and "What a team sees when it pays online" (454, was ~420 before this edit) over the standard.

- **Session 2 · Part 7 records + walk 2026-11-02.** Plan Stage 2 "Built" block, TODO line, auto-memory. Walk §443 published https://claude.ai/artifact/2dA8ScXrLPJ5uNFQXxrRKe (source `SIGNED_IN_FAMILY_STAGE2_WALK.html`, ledger entry §443): 9 parts, 27 steps, on the Stripe walk tournament fixture; dev's `RESEND_API_KEY` is empty, so the walk has the owner set it and `REQUIRE_SIGNUP_EMAIL_VERIFICATION=true` (Part A uses the empty key on purpose to show the account-failed card). Not walkable on dev, left out and named in the walk: the form's limits, a customised template, the hour itself. The pay-page mask (Part 6) has no walk yet. Found while writing it (pre-existing, Part 4's flow, an owner call in H): a coach whose account still waits enters their address at Step 1, is asked to sign in, and sign-in refuses until they confirm.

## Part 1 · The tournament Register form gets its own limit (ask 4 = A)

Today `app/api/register/route.ts` has no throttle [V: the handler starts at 221 and never imports `public-form-throttle`].

- `lib/public-form-throttle.ts` [H] holds three buckets (30 an hour per source, 150 per five minutes together, 8 emails an hour
  per address) and the words "Too many attempts. Please wait a few minutes and try again." Its early-access lead form already
  has its OWN buckets (`throttleLeadForm`, the `lead*` limiters): copy that pattern. Add `throttleRegisterForm` (own buckets,
  **same numbers, same words**) and the per-address one for the registrant's email. **Do not touch the family forms' buckets.**
- Call it first in the handler, before the body is parsed; the per-address check goes where the email is first known.
- A refused coach already reads it: the route's error comes through `postRegistration` into the "Registration Failed" card with
  Try Again, form still filled in [H: RegisterContent 651–663, 863–865, 1329–1335]. Check that the 429 message reaches that card
  verbatim and write the test.
- ⚠ **Order trap to report, not necessarily fix:** in the fallback branch (verification off, dev) the account is made BEFORE the
  registration is posted [H: RegisterContent 730–845]. A 429 there leaves an account and no registration. The production path
  (`!signedIn && verifies`, 689–725 [V]) registers first, so it cannot. Decide: leave it (dev-only) and say so in the Progress
  block, or fix it if it is a few lines.
- Tests: refused after the limit; same words as the family forms (a string-equality assertion against the shared constant);
  the family forms' buckets unchanged; the account-check's own limits (`app/api/register/account-check/route.ts`) unchanged.

## Part 2 · The old tournament-team claim link goes (plan item 5)

A link that let a tournament coach claim a paid team page. Nothing in production code creates a claim: the only creator is the
dev seed route [H: `createTournamentTeamWorkspaceClaim` has one caller, `app/api/dev/seed/team-claim/route.ts`]. **Re-confirm
that with a grep before deleting anything.**

**Goes:** `app/coaches/claim/[token]/page.tsx`; the legacy redirect `app/team/claim/[token]/page.tsx` and its rewrite in
`lib/coaches-portal-routes.ts`; `app/api/dev/seed/team-claim/route.ts` and its counter in `app/api/dev/seed/status/route.ts` and
the dev-tools page (`app/platform-admin/dev-tools/page.tsx`); the claim branch in `app/api/billing/create-team-checkout/route.ts`
(the `claimToken` block, ~65–90, and its error handling) and the claim input in `lib/team-checkout.ts`; the claim prefill in
`app/team/TeamSignupClient.tsx`; the public-path entry in `proxy.ts` (~295–302) and the other route lists that name
`/coaches/claim` (`lib/consumer-routes.ts`, `components/SiteChrome.tsx`, `components/consumer/CoachJourneyChrome.tsx`,
`app/coaches/layout.tsx`); the token code in `lib/team-workspace-claims.ts` that nothing else uses; seed scripts and the UAT
spec that exercise it (`scripts/seed-stripe-walk-tournament.mjs`, `scripts/seed-uat-standalone-coach.mjs`,
`tests/uat/scenarios/team-direct-checkout-smoke.spec.ts` ~285–359). **Every path above is [H]: grep each name and read it first.**

**Stays — do not delete:** the `team_workspace_claims` TABLE and anything that reads it. **Tournament Chat reads it to work out
which coaches are in a tournament's chat** [V: `lib/chat-resolvers.ts` reads `team_workspace_claims` at 126, 250 and 310, and
its header comment names the bridge]. Also stays: the organizer's "invitation" for a team added by hand (a different, live
thing; the help text "Claim your team" describes THAT email, not this link), `lib/portal-keep-premium.ts` and
`lib/team-workspace-entitlements.ts` unless a grep proves their only claim path was this one. Where the checkout library stores
`teamWorkspaceClaimId` for other flows, leave the storage and remove only the way a token enters. If a deletion would strand a
live reader, stop and report.

- Update the tests that name the claim page or token: `account-first-signup.test.ts` (~435–455, ~485),
  `support-console-stage4b-coach-guard.test.ts` (~183–185), `team-checkout-customer.test.ts`, and any guard listing the route.
  Add one test that the claim page, the dev seed route and the token reader no longer exist AND that Tournament Chat's resolver
  still reads the table.
- Remove "claim" mentions from `refresh-db-schema` / dictionary-coverage scripts only if they reference deleted files (not the
  table).

## Part 3 · No email address inside a coach's portal link (ask 2 = A)

**Scope (ruled): every coach EMAIL that links to the portal, not only the registration email.** The writers [V: `coachPortalUrl`
in `lib/email.ts:224–236` sets `email` at 227]:

- `coachPortalUrl` itself and its callers: `coachPortalFooter` (and the ~7 templates using the footer), `registrationConfirmationHtml`
  (`email.ts:306–308` [V]), `teamInvitationHtml`, `acceptanceHtml`; `app/api/admin/schedule-publish/route.ts` (~282),
  `app/api/admin/tournaments/[tournamentId]/registrations/bulk/route.ts` (~169), `lib/game-day-reminders.ts` (~128), the
  organizer's remind-signups and resend-access routes (`.../chat/remind-signups/route.ts` ~206,
  `.../registrations/[regId]/resend-access/route.ts` ~62), `app/coaches/page.tsx` (~139).
- Where the confirm button RETURNS to: `registrationPortalPath` (`RegisterContent.tsx:257` [H]) is also the confirm link's `next`.
  The confirm link signs the coach in, so the page already knows who they are: drop the address from it too.
- The join page's own hand-offs to sign-in (`app/coaches/join/page.tsx` ~223, 268, 303–319 [H]) and the finish screen's button
  (that button goes in Part 5).
- **Keep:** `registrationId` (what joins the coach to their entry; on its own it opens nothing, the join page only links a
  registration to an account whose email matches), `registered=1`, `next`.
- **Not in scope, leave alone:** sign-in links in non-coach-email flows that carry an address the person typed (assistant
  invite, league coach invite, Start door, team sign-up, `accountExistsSignInHref`) — they are in-app navigations, not
  addresses written into a sent email. If you find one that IS inside a sent coach email, it is in scope. Report any you leave.

**The join page** (`app/coaches/join/page.tsx`; `emailParam` ~46 and its uses [H]) today uses the address to (a) pre-fill,
(b) tell a signed-out visitor "You're already set up. Sign in to see {team}" by asking `/api/coaches/registration-account-status`
[H: line 108], and (c) name the invited address when someone opens the link signed in as somebody else. Build the drawing's tab 4:

- Signed out: **one email box first** (the Register form's first step wording), Continue checks it against the registration,
  then Sign in or Create account as today. Signed in on that device: straight to the team, no box.
- Signed in as someone else: "You're signed in as …, which isn't linked to this registration" **without naming the other
  address** (the drawing's measure strip; read the exact words there).
- Re-check `registration-account-status`: it must still answer only when the typed address matches the registration, and it
  needs a limit if it has none (a box that anyone can type into is a probe). Report what you find; do not weaken it.
- `next` is still handled by `normalizeCoachPortalNext` (join page ~47) and `consumeNextOnce` (login ~129) [H].

**Guard (build-enforced):** a unit test that none of the coach-email URL builders can produce a URL with an `email=` query
(call each builder with an address and assert the address does not appear in any link). This is the test that keeps a ninth
template from reintroducing it.

## Part 4 · One email, not two (ask 1 = A) — the design part, read all of it

**What is true today [V unless noted].** For a new coach on production, `submitRegistration` runs `postRegistration()` FIRST
(`RegisterContent.tsx:697`), which makes `/api/register` send the organizer's alert and "Registration Received" to the coach
(`route.ts:618–658`); THEN it calls `/api/auth/coach-signup` (699), which builds the confirm link with `generateLink` and sends
a **separate** "Confirm your FieldLogicHQ email" (`route.ts:117–140` of coach-signup). The registration email's green panel says
"Your free FieldLogicHQ Coaches Portal account is ready" (`email.ts:333`), which is not true yet. The registration goes in
before the account on purpose ("the organizer never waits on the coach's inbox", RegisterContent 686–688): **keep that order**,
and the organizer alert stays exactly as it is.

**What it becomes (drawing tabs 1, 2).** The coach's one email is the registration email with the confirm panel in the place
the portal panel is today, sent AFTER the account step. Read the drawing for the exact subject ("We've got your registration"),
heading, panel words, the two small-print lines (the one-hour limit and what happens after it; "If you didn't register this
team, you can ignore this email"), and tab 2's table. In short:

| Case | Result |
|---|---|
| New coach, team goes in | One email, "We've got your registration", Confirm my email inside |
| New coach, division full | The waitlist email with the same confirm panel (it keeps its own waitlist words) |
| Already signed in ("Which team?") | One email, same heading, "Open your Coaches Portal", **no** "account is ready" sentence |
| Manager registering for a head coach | As the row above, keeping the "Organizer emails go to …" sentence |
| Address already has an account | One email with the confirm panel if the account is still waiting for its email, else the signed-in version |
| Organizer switched off coach confirmation | **Unchanged**: no registration email; the confirm email still goes (without it the portal cannot open) |
| Registration email customised in platform admin | **Unchanged**: two emails (custom words have no place for the panel) |
| Invite-only; the organizer's alert | Unchanged |

**Mechanism — a recommendation, not a spec; decide, then say what you chose.** The server decides, never the client.

1. `/api/register` sends the coach's email as today in every case EXCEPT one: a signed-out new coach on the verify path, with
   the switch on and no customised template. There it sends only the organizer's alert and returns that the coach's email is
   held (e.g. `coachEmailHeld: true`). The client sends a flag asking for the hold only from the two verify-path calls
   (`RegisterContent` 689–725 and `registerForWaitingAccount` 677–684); a request without it behaves exactly as today.
2. `/api/auth/coach-signup` accepts the `registrationId`. **It must read the registration itself and check that the
   registration's email is the signup email** before it puts any registration detail in an email (otherwise it is a way to
   send one person's registration to another address). With a match it sends the ONE combined email in place of
   `sendSignupVerificationEmail`; without one, it sends the plain confirm email as today.
3. The resend route (`app/api/auth/resend-verification/route.ts`, used after a 409 and by "Send the link again") gets the same
   `registrationId` handling so a held registration whose account already existed still gets its one email.
4. **Invariant, the one that matters: a coach is never left with zero emails.** If the hold was granted and the account step then
   fails (409, 500, network, throttle), something must still send the coach's registration email: the 409 path through the
   resend route, anything else through a small throttled "send me my registration email" path (or the same route). Write a
   test per branch. A held email that never goes is a silent failure the coach cannot see and the organizer cannot fix.
5. The combined email is built once, in `lib/email.ts`, by one function that takes an optional confirm link. With a link it
   renders the confirm panel; without it, the signed-in "Open your Coaches Portal" panel (no "is ready" sentence). The two
   existing builders (`registrationConfirmationHtml`, `waitlistConfirmationHtml`) become callers/variants of it, not copies
   (the waitlist email has no portal panel today [H: only `coachPortalFooter`]; the drawing gives it the confirm panel).
6. Keep: the link works for one hour (the comment at `email.ts` ~1472 says the hour is the sign-in service's own expiry, change
   both together if you ever touch it); an old button lands on sign-in with "That link has expired or was already used…" and
   "Email me a new link" [H: `expiredLinkSignInHref`, `ResendLink`]. The plain confirm email (`signupVerificationHtml`,
   `lib/verification-next-step.ts`) stays for every non-registration door (Start a team / league, the Register form with the
   coach confirmation off, a customised template).
7. The email's key and kind: keep `tournament_registration_confirmation` / `_waitlist` so a platform admin's customised version
   still resolves and the email-kind registry (`lib/email-kinds.ts` ~57–58 [H]) needs no new kind. If a new kind is truly needed,
   say why.

Tests: each row of the table above (which emails fire, in which order, with which links); the zero-emails invariant per failure
branch; the registration-id/email match refusal; the customised-template case still sends two; the "is ready" sentence appears
nowhere; the existing `signup-verification-guard.test.ts`, `first-look-stage2-emails.test.ts` and
`public-face-s3b-family-emails.test.ts` updated, not deleted.

## Part 5 · The finish screen says what is really next (ask 3 = A)

`components/public/RegisterContent.tsx`, `step === 'success'` [H: ~1497–1593]; drawing tab 3 has every frame (new coach, waitlist,
"the address already has an account", phone).

- Title **stays** "You're In Motion" (waitlist title as today).
- The check-your-email block moves up and is headed "Confirm your email to open your portal": names the address, says the
  registration is in either way, keeps "Send the link again", and shows the quiet **"Already confirmed? Sign in"** line (the
  shipped `VerifyEmailSent` block already has it; this screen never turned it on).
- "Watch your email" row now says the registration email holds the confirm link (read the exact words in the drawing).
- **Removed:** the "Create your Coaches Portal / Set a password…" row and the "Create Coaches Portal Account" button. No big
  button replaces them.
- "The address already has an account" variant: the shipped note stays; under it one real "Sign in" button.
- Unchanged: tick, countdown, Save the dates, the three tournament buttons. A signed-in coach never sees this screen.
- ⚠ Public tournament pages Stage 2 Part 3 owns the Register CARD above the form (closing date, spots taken, the "free Coaches
  Portal" line). This Part owns the finish screen only. Check `PUBLIC_TOURNAMENT_SITE_REVIEW_PLAN.md` for a stage that has
  since touched this file, and rebase onto its look.
- Check both phone and desk at true size (`npm run check:layout --changed`; never a whole-product sweep on the dev server).
- The "Create a Password" step (1133–1148 [H]) stays as the form's field; only its stale finish-screen promise goes.

## Part 6 · Mask the coach's address on the team pay page (ask 5 = A) — **HELD until the Stage 7 walk passes**

**Gate:** the team pay page (public tournament pages Stage 7) is under walk §440. **Before touching it, read the Owner QA
Ledger entry for §440 and that project's plan.** If §440 is not recorded PASSED, do NOT build this Part: write that in the
Progress block, leave Part 7 to close out the rest, and tell the owner this Part is still owed. Never rework a page under test.

When the gate is open, mirror what Stage 1 did for families [V: `lib/utils.ts:152–168` `maskEmail` / `isMaskedEmail`; league
use at `lib/league-pay-view.ts` ~161, `components/public/LeaguePayBlock.tsx` ~82/92, `app/api/pay/league/[token]/route.ts`
~16/83]. Three spots [V]:

1. `lib/team-pay-view.ts:156` passes `payerEmail: f.teamEmail` unmasked, so the full address reaches the browser. Mask it.
2. `components/public/TeamPayContent.tsx` seeds the receipt field with `view.payerEmail` (~156) and sends what is typed (~170):
   send an empty email when the field still holds the masked value, as the league block does.
3. `app/api/pay/team/[token]/route.ts:75` takes `body.email` with no masked check, and 114 and 134 fall back to
   `facts.teamEmail`: reject a masked address and fall back to the one on file (the league route is the model). Also check
   `PayBlock.tsx` (`PayerEmailField` ~130, `ConfirmingState` ~67–71) so a masked value never reaches Stripe or the receipt line.
- **No reset** (ruled): no "Send a new link" for a team, no database change.
- Test: the view never carries the full address; a masked value posted back uses the on-file address; a typed address still
  wins; the receipt still goes to the address the coach sees.

## Part 7 · Closeout

- Tests: `npm run verify:changed`, `npm run typecheck` (API and auth contracts), the unit tests named above, plus
  `signup-verification-guard`, `coach-signup-throttle-guard`, `team-coach-notices`, `coach-register`, `observability`,
  `demo-sandbox-write-guard`, and (if Part 6 ran) `league-pay`, `public-focused-page`, `team-entry-lowered`. Other sessions' failures in the
  full suite are theirs: name them, don't fix them.
- **`/simplify` then `/review`** (this adds a shared email builder and a hold path across three routes), then **`/docs`**:
  help articles that describe what this changes [H]: `lib/help-content/coaches.tsx` ~217–228 (`faq-coach-confirm-email`, the
  expired link and the hour) and ~165–213 (first login; "Why don't I see my team?"); `lib/help-content/tournaments.tsx`
  ~737–742 (`faq-new-coach-confirm-email`), ~908–912 (accepted/declined emails), ~1105–1110 (the pay page's "Email for the
  receipt", if Part 6 ran); `lib/help-content/platform-admin.tsx` ~571–576 (confirm-email support article). The "Claim your
  team" help text is about the organizer's invitation email and stays. Demo sandboxes: nothing found naming these emails or
  screens [H]; the build fails on a missing tour destination, which is the only demo signal — do nothing else for the demos.
- One spelling: grep the other spelling of any new word first (`npm run check:spelling`); the clock is "8:00 a.m."
- Records, positive-fact wording with anchors (never "uncommitted"): the plan's Stage 2 (a "Built" note per Part, with commit),
  TODO line (one clause), the auto-memory note `project_end_state_signed_in_family_app.md` and its MEMORY.md line, and a QA
  walk for the owner (a checkable Artifact, one purpose: the registration emails and the finish screen; the pay-page mask goes
  in its own walk after §440). The walk covers: a new coach on a phone, one email in the inbox, the button, the expired
  link, a coach who already has an account, the waitlist, the join page asking for the email, the refused-after-too-many card.
- **Restart the dev server before handing over** (files were deleted and added). Stop it first, clear `.next`, `npm run dev`,
  wait for Ready; never `.next` while it runs.
- **No production step** (no migration, no new secret). The release record needs only the commit hashes.
- Do not commit unless the owner says.

## Shared-file traps

- `components/public/RegisterContent.tsx` and `lib/email.ts` are big shared files: public tournament pages and billing sessions
  edit nearby. Edit by exact hunks; `git diff` your own file before staging; never `git add -A`.
- `lib/email.ts` carries ~8 coach templates through `coachPortalFooter`: changing it changes all of them. The Part 3 guard test
  is what proves you changed all and only the right ones.
- `TeamPayContent.tsx` and the team pay page are another session's walked work (Part 6 gate).
- A helper's file list is a lead. Open the cited lines, grep a name before you delete it, and re-read this prompt's [H] marks
  as "not yet checked".
- Probes and scratch go in `.probe/`; `npm test` wipes `test-results/`.
