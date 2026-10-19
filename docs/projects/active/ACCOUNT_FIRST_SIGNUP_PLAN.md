# Account-First Sign-up — plan

**Status:** drawn 2026-10-18 and design-reviewed the same day (hub: https://claude.ai/artifact/PY5MgHrj9kjY6tCRPi7oLx v1,
source `docs/projects/active/ACCOUNT_FIRST_SIGNUP_HUB.html`, built by `.probe/account-first/build-hub.cjs`). **A1–A7
ruled as recommended by the owner 2026-10-18** (see Rulings). **Part 1 (shared pieces + Start a team + Start a
league) built and committed `8647a4e8` 2026-10-18** on `dev` after /simplify and /review (high risk) — see *As built,
Part 1* below; **owner walk §336 ✅ PASSED 2026-10-19 — all 17 walks, 48 of 48 steps** (hub QA tab; one walk with
Verify Every Sign-up since 2026-10-19 — owner: §326's still-true checks carried into §336, its "name filled in" checks
retired; this hub is the one home). W5 (Start a league) is a localhost walk: League self-sign-up is off on staging and the
hosted build is never handed the switch. Parts 2 and 3 next, from `ACCOUNT_FIRST_SIGNUP_BUILD_PROMPT.md`.
**A4 revised 2026-10-19** (owner direction, walking §336): a workspace that waits for its name replaces the finish card —
drawn on the hub's Home screen (v7), **OK'd by the owner the same day ("I approve") and built** (see *A4 revised* below).
Part 1 is on `origin/dev` (staging) since its push, not on production; the revision reaches staging with its own push.
Follows Verify Every Sign-up (`SIGNUP_EMAIL_VERIFICATION_HUB.html`, committed `80f25c09`, on prod 2026-10-18 job 281).
PM brief: `ACCOUNT_FIRST_SIGNUP_PM_BRIEF.md`.

## Why

Owner, 2026-10-18, walking §326: *"why do we ask them to create a team name twice?"* The free team sign-up asks for
the team name on its first form, then brings the coach back from the email link to a second form with the name filled
in and one tap to create (V1, ruled 2026-10-16 for its reason: an automatic create would make a second team from a
link opened twice). Filled in or not, the second screen reads as being asked again.

Owner direction, same day: *"users create accounts first (no org, tournament, team name, etc) then after confirmation
do the create steps based on where they came from."* The census below makes the case stronger than tidiness.

## What the code does today (census 2026-10-18)

Nine doors make an account while signed out. Four start something new; five make the account on the way to
something else.

| Door | Asks before the link | Made before the link | Comes back to |
|---|---|---|---|
| Run a tournament (`/auth/signup`) | organization, first, last, email, password | **the organization, its address, the owner seat and the Founding Season comp** | the organization's plan step |
| Start a team (`/start/team`) | team name, first, last, email, password | the account only | the same page, name filled in, one tap |
| Start a league (`/start/league`, beta) | league name, first, last, email, password | the account only | the same page, name filled in, one tap |
| Coach Premium (`/coaches/start`, `/coaches/claim/[token]`) | team, sport, billing, first, last, email, password | the account only | the same page; the details survive only in that browser tab |
| Account only (`/auth/signup?account=1`), family claim, join, follow nudge | first, last, email, password | the account only | where they were going |
| Tournament registration (`/{org}/{t}/register`) | the registration, then the account | **the registration** (V2, on purpose) | the join page, which links it |

Findings (each has a flag on the hub's drawings):

- **F01 — The tournament sign-up builds the organization before the email is proven.** `app/api/auth/signup/route.ts`
  makes the auth user (L268–300), then the organization with its slug (L303), the owner membership (L312) and the
  Founding Season `comp_period` override (L326–338), all before the link is opened. An abandoned sign-up leaves a live
  organization; an address typed by someone who does not own it still takes the club's name and URL.
- **F02 — The paid team sign-up forgets what was typed.** Team, sport and billing live only in a `sessionStorage` draft
  (`app/team/TeamSignupClient.tsx` L181–217). A link opened in another tab or on another device comes back blank.
  Its route (`app/api/auth/team-signup/route.ts`) has no sign-up throttle (the coach sign-up has one, `7bbfbebb`) and
  its check-your-email state has no Send the link again.
- **F03 — The plan picked on the pricing page is dropped in production.** Pricing links to `/auth/signup?plan=&billing=`;
  the page reads them only on the instant (verification off) path, and the verification redirect is hard-coded to
  `?choosePlan=1` (`route.ts` L275). Onboarding reads only `billing`; `featuredPlan` is fixed to Tournament Plus.
- **F04 — The team and league name is asked before the link and shown again after it.** It travels in the link
  (`?team=` / `?league=` with `confirmed=1`) and returns in an editable field under the same heading, which reads as a
  second ask.
- **F05 — A confirmed account with nothing started has no way to start.** Home shows "Nothing here yet — follow a team,
  tournament, or organization" (`components/consumer/HomePersonalization.tsx` L231) and no start door; the persona
  Start menu lives in the top bar. Account-first makes this state common: everyone who confirms and walks away lands here.
- **F06 — A waiting account that signs in is told to verify, with no way to get the link again** (found by `/docs`
  2026-10-17, recorded on the Verify Every Sign-up memory).

## Scope

**In:** the four "start something" doors — Run a tournament, Start a team, Start a league, Coach Premium (including
the claim link) — plus the shared check-your-email state, the Home landing for an account with nothing started, and
Send the link again on sign-in for a waiting account.

**Out, deliberately:**
- Tournament registration keeps V2: the registration goes to the organizer before the coach verifies, so organizers
  are never blind to a coach who never opens the email.
- Invites (the assistant invite's instant path, org member invites), family claims, the join page and the follow nudge
  already ask for the account alone.
- R1 (pre-hijack by password, accepted 2026-10-17) is unchanged by this work.

## The end state

1. **One account step for every start door.** First name, last name, email, password. Headed with the door's own name
   (Create Your Team Home, Run Your Tournament, Start Your Season, Coach Premium) and a line that says what comes next
   (A1, A2).
2. **One check-your-email state**, the Verify Every Sign-up block: the address, Send the link again, Use a different
   email (keeps the entries), Already verified? Sign in. It names what is next ("…then you'll name your team"), not a
   name the person has not typed yet.
3. **The link lands on the door's create step** (A3) — the signed-in screens that already exist: Adding a team (team
   name), Adding a league (league name), the add-organization form (organization name, then the plan step), the Premium
   form (team, sport, billing, then checkout). The field is empty and focused; the screen says "Step 2 of 2".
4. **The account remembers where it came from**, not the browser and not only the link: the door, and the pricing
   page's plan and billing when there were any, are written onto the account at sign-up (auth `user_metadata.start`).
   The link, the sign-in destination and Home all read it, so a laptop sign-up opened on a phone still lands on the
   right step (F02, F03).
5. **Home finishes what was started** (A4). An account with an unfinished start sees "Finish setting up your team" at
   the top of Home until it creates one or dismisses the card; an account with nothing sees a way to start something on
   a phone as well as a computer.
6. **Sign-in offers Send the link again** to a waiting account (A7, F06).
7. **The tournament door makes the organization after the link** (F01). The Founding Season comp attaches when the
   organization is made; whether the window is counted from the account or the organization is A5. The plan picked on
   the pricing page is chosen on the plan step (A6).

## Rulings (owner, 2026-10-18 — all seven as recommended)

- **A1** One account form for every start door, in the warm start look (`startForm.module.css`), headed with each door's
  own name. Coach Premium keeps its sales page; only its setup card changes.
- **A2** A two-step line on both steps ("1 Your account · 2 Your team / league / organization"), reusing the tournament
  registration page's step-bar shape (`register.module.css` `.steps`) in warm tokens; not clickable.
- **A3** The link lands straight on the create step, field empty and focused. V1 holds: one tap creates, never automatic.
- **A4** Home shows a finish card ("Finish creating your team" / league / organization; Coach Premium: "Finish setting
  up your Coaches Portal" + Continue setup) only to an account that came from a start door and has not finished. Not now
  hides it until the next sign-in; a **second** Not now hides it for good. "Nothing here yet" is hidden while it shows.
  **Revised 2026-10-19** — see *A4 revised* below.
- **A5** The Founding Season offer counts from the day the **account** was made: an account created before the
  sign-up close (`FOUNDING_SEASON_SIGNUP_CLOSE`, end of 2026-12-31) still gets the comp when its organization is created
  after it. The comp's end date is fixed for everyone (`FOUNDING_SEASON_END`), so a late organization gains nothing.
  Logged in `BUSINESS_DECISIONS.md` 2026-10-18 (refines 2026-09-07 part 2). **Edges Decided 2026-10-19** (owner, Part 2
  build session, each as recommended): (a) after the close only the creation the account's start sign-up came for
  counts — read from a **locked copy** of the door on `app_metadata`, since the remembered door is the account holder's
  to edit; (b) the same rule for Coach Premium (Part 3); (c) the plan step honours it — after the close, an organization
  that got the comp when it was made picks Tournament Plus at $0 on its **first plan choice** only. Eligibility reads the
  auth user's `created_at` and the locked door, never `user_metadata`.
- **A6** The pricing page's plan and billing ride on the account and open the plan step with that plan chosen; the
  person can still change it.
- **A7** Sign-in offers Send the link again to a waiting account, in this project, with the resend's existing limit.

Design review 2026-10-18 (D1–D12, on the hub's Decisions tab) is part of the drawings these rulings approved: no icon
well on phone start forms, the plain "Your email is confirmed." sentence, 44px foot links, "Create Account" in the start
forms and "Create account" on the Premium card, the resend inside the sign-in error box.

## A4 revised (owner, 2026-10-19)

**Why:** walking §336, two taps on Not now left the account on "Nothing here yet — follow a team" with no way back to
the team it came to start (F05 was fixed only while the card showed; the plan's promise above, "an account with nothing
sees a way to start something", was never built). Owner direction: a pending workspace that stays on Home for good, with
no team name, so it is always there without being a nagging message, and it fills in with the team once it is named.

**Ruled the same day:**
- It shows **beside every other workspace**, not only when there is none: *"otherwise they lose that team … it should
  look like a second team they still owe if it truly is."*
- Wording: **Coaches Portal · Not named yet · Name your team**; no plan badge (nothing to price yet); Coach Premium has
  its own words, **Setup not finished · Continue setup**.
- A way for a fan (an account that never came from a start door) to start something stays **out of this project**.

**Held from standing rulings:** it is a **placeholder drawn from the remembered door**, never a real nameless team,
league or organization — a real row would bring back F01's orphans and V1's second-team-from-a-link-opened-twice, and
would flip every rule that asks whether the account has a workspace. Nothing is made until the name is typed and
Create is tapped.

**As drawn (hub Home screen, v7; OK'd 2026-10-19):** the real Home workspace card, unchanged in frame; three slots differ —
an amber **Not named yet** badge (the warm badge ink), the title **Your team**, and **Name your team** in the meta
line's place, olive, in the sans at 12px because it is the one thing on the card that must be read (/design D13). The
whole card opens step 2; its one door mark is the chevron every workspace card carries (D14). Solid edge — dashed
already means a record that left a list (D16). /design 2026-10-19 D13–D17 are on the hub's Decisions tab. It sits after the workspaces already in use. League and organization wait as the Admin Area card they
become (blue icon well); Coach Premium as a Coaches Portal card. Two free teams already share one Home card ("Your
teams · N teams"), so for a coach who also assists on another free team, the waiting card folds into that one when
named rather than filling in alone (today's rule, unchanged).

**OK'd by the owner 2026-10-19 ("I approve") and built the same day.** What the build changed:
- Home: the finish card becomes the waiting workspace, inside the Workspaces section; "Nothing here yet" stays hidden
  while it shows (Home is not empty).
- The card's rule drops the no-workspace condition (owner: every case) and the Not now count. The Not now write, its
  route and the session sign-in-time read (`sessionSignedInAt`, `getClaims()` amr) go with it; `notNow`/`notNowAt`
  on existing accounts are simply ignored.
- It goes when the thing is made by any route. **The finish card hid itself once there was any workspace, so only two
  paths cleared the door; now that the card shows beside every workspace, a missed path is a "Not named yet" card next
  to the real team.** Census 2026-10-19 (helper, cited lines read): `clearStartDoor` is now also called by
  `provisionStandaloneTeamWorkspace` once committed (every Coach Premium team: the checkout's comp and mock paths, both
  Stripe webhook events) and by `linkTournamentRegistrationToBasicCoachTeam` when it creates or adopts a free team (the
  join page; a signed-in tournament registration). Deliberately not cleared: a staff seat (owner: "otherwise they lose
  that team"), a season rollover, a team moved into a club, and a tournament organization from the add-organization
  form — not the team or league the door came to start; the organization door and its clear are Part 2's.
- The waiting card is the Home workspace card itself (`WaitingWorkspaceCard`, `WAITING_WORKSPACE` in
  `lib/start-door.ts`): the family's label, icon and accent; the amber badge Home already uses; the step as `.wsAction`
  (sans, 0.75rem, olive). The payload field is `waitingWorkspace: { door }` (no email: the card no longer says "You
  confirmed …"). Gone: `startCardVisible`, `withNotNow`, `sessionSignedInAt`, `recordStartDoorNotNow`,
  `POST /api/account/start-door`, the `.start*` styles.
- The league card keeps today's rule: only while Start a league can open (the beta is on and no invitation waits).
- Walk §336: W3 and W5 rewritten (saved under their own keys, so old ticks never land on new steps); W4 and W6 reworded;
  W16 (Coach Premium takes the waiting card's place, localhost) and W17 (beside a team they help with, staging after
  the push) added. Help: the two answers that named the finish card (coaches first login; platform-admin Confirm
  Email) say what Home shows now.
- Guard `tests/unit/account-first-signup.test.ts` pins the new rule, the card, and every clear above.

**Fixed in /review (high risk, four lenses, 2026-10-19):**
- **A waiting league that could never open** (High): `/start/league` and `/api/league/create` turn away an account
  already in a real organization, and the finish card's no-workspace rule had been hiding that case. The league door's
  card now carries all three of the page's gates (beta on, no pending invite, `!userBelongsToOtherRealOrg`).
- **Only a matching door clears** (Medium, two lenses): `clearStartDoor(userId, fulfils)` — a free team or a claim
  clears `team`; a Premium team clears `team` and `premium`; a league clears `league`. **This supersedes Part 1's build
  call "creating either a team or a league clears the door"**, made while the card hid itself on any workspace (so the
  cross-clear was invisible); under "beside every workspace", a team made by a league-door account would have wiped the
  league it still owes.
- The card's link has no `aria-label` of its own: like every workspace card, its name is what it shows, so the visible
  "Coaches Portal" / "Admin Area" is in it (label in name). The "route is gone" test resolves from the repo root.
- Help search keywords gain "not named yet" (the old "finish creating your team" stays, for people who remember it).

**Accepted, left as they are:** a failed clear (an auth hiccup, logged) leaves the card beside the real team until a
later creation of that kind — Stripe's retry takes the already-provisioned path, which does not clear; a door set by
hand in the account's own metadata can show a card for `organization`/`premium` whose page then turns the person away
(their own Home only; nothing gated is exposed); accounts made on staging since `8647a4e8` that made a team by Premium
or a claim keep their door until they make another (no backfill: staging-only, about a day). **Part 2 must call
`clearStartDoor(user.id, ['organization'])` wherever an organization is made for the account** (`/api/org/create` and
the new step 2), or the organization door's card stays beside the real organization.

## Build order (one build, three parts, each shippable alone)

1. **Shared pieces + team + league.** The account step, the remembered door, the link landing, Home's card and start
   door, sign-in's resend. Team and league are already half there, so they prove the shared pieces on the lowest-risk
   doors.
2. **Run a tournament + the pricing plan.** The organization moves after the link; the Founding comp moves with it;
   the plan rides on the account. Before this part ships, count (read-only, owner-approved) the organizations on
   production made by sign-ups that never confirmed; cleaning them is a separate owner call (the platform admin's
   empty-organization filter already finds them).
3. **Coach Premium + the claim link.** Account first, then team, sport and billing, then checkout. The route gets the
   coach sign-up's throttle and the resend.

## Notes for the build

- **Links already in people's inboxes** (`?team=`/`?league=` with `confirmed=1`) keep filling in for one release.
- **Signed-in people** at any door keep going straight to the create step, as today.
- **The org sign-up's public-address field**: today the address is checked before the account; it moves to the create
  step with the name. Confirm from the add-organization form whether it offers the address field before building.
- **Tests:** `tests/unit/signup-verification-guard.test.ts` changes shape; add a guard that no signed-out sign-up route
  creates an organization, team or league row (mutation-checked). Also `coach-signup-throttle-guard`,
  `assistant-invite-account-states`, `coach-register`, `plan-panel-host`, `gated-plan-availability-copy`; UAT
  `marketing-seam.spec.ts`, `pricing-team-smoke.spec.ts`.
- **Help:** `lib/help-content/coaches.tsx` (first login, confirm-email FAQ), `tournaments.tsx` (new coach confirm
  email), `platform-admin.tsx` (Confirm Email) — `/docs` after the build.
- **Demos:** the sign-up forms have no tour anchors; marketing and sandbox buttons keep their URLs.
- **Verification:** localhost has email verification off, so the account step signs straight in there; the link
  round trip is walked on staging only (as §326 was).

## As built, Part 1 (committed `8647a4e8` 2026-10-18)

**What exists now, for Parts 2 and 3 to build on:**
- `lib/start-door.ts` — the remembered door on `user_metadata.start` (`{ door, notNow?, notNowAt? }`), its paths, Home's
  card rule and copy (all four doors). `parseStartDoor(value, allowed)` is how a route takes only its own doors.
- `lib/start-door-server.ts` — `clearStartDoor(userId)` (call it from every creation path; it reads fresh), the Not now
  write, and `startStepViewer(user)` (signed in + first day) for the start pages. Writes send only the `start` key.
- `verificationReturnPath(next, fallback, door)` — the one rule for where a link returns: **the caller's own `next`
  wins**, the door fills in when there is none, then the fallback.
- `app/(consumer)/start/StartDoorForm.tsx` — the account step and the name step for team and league (per-door copy
  table). `components/auth/ResendLink.tsx` — the one Send the link again control (the check-your-email block and
  sign-in's error box both render it).
- Guard `tests/unit/account-first-signup.test.ts`: no signed-out sign-up route writes a table row (coach-signup,
  team-signup); **the org sign-up joins its list in Part 2**. Mutation-checked.

**Calls made in the build** (the drawings did not decide them; told to the owner before building):
- Home's card also needs **no workspace yet**, so a Premium buyer never sees a stale "Finish creating your team".
- Creating **either** a team or a league clears the door. *(Superseded 2026-10-19 by A4 revised + /review: only the
  matching door clears — see "Fixed in /review" under A4 revised.)*
- The step line shows on step 2 only on a **first day** (no workspace), the same condition as "Not now, go to Home".
- The league's public address is **olive** (the drawing), not pale lime on cream — F08's fix on this form too.

**Fixed in /review (high risk, five lenses):**
- The door overrode a caller's explicit `next`: a waiting /start/team account that then registered for a tournament
  got a link to "Name your team" instead of the join page that links its registration. Now `next` wins.
- `last_sign_in_at` is re-stamped by the auth service on every token refresh, so "Not now until the next sign-in"
  would have meant about an hour. The card reads the **session's own sign-in time** (the access token's `amr`, via
  `getClaims()`, only for a once-dismissed card).
- No league card where `/start/league` would not open (a pending invite sends the person back to Home; beta off).

**Left for later, on purpose:**
- Part 2: the org sign-up should adopt `StartDoorForm`'s pieces (`AddOrgForm` still writes its own header and inline
  lime/grey styles); the three sign-up routes repeat the name-metadata block (`signup`, `team-signup`, `coach-signup`)
  — a `signupUserMetadata()` builder belongs with Part 2/3, which add plan/billing/claim to it.
- R1 (pre-hijack by password, accepted 2026-10-17): a door makes a squatted account's link more convincing; the root
  cause is unchanged and still accepted.
- Two open tabs can each create a team (as before: the create API has no one-team check).

## As built, Part 2 (2026-10-19)

**Run a tournament, account first.** `/api/auth/signup` makes the auth account and nothing else for both of its callers:
the organization door (`startDoor: 'organization'`, or a page loaded before the release that still sends a name) and the
account-only sign-up (no door). The door is remembered with the pricing page's plan and billing
(`user_metadata.start = { door, plan?, billing? }`, read as `pricing` by `readStartDoor`), the link lands on
`/start/tournament?confirmed=1`, and the email no longer names an organization. The Sign-up Invite Guard and the staff
refusal stay. The route joins the no-create guard (mutation-checked 2026-10-19: `createOrganization(`, an
`.from('organizations')` read and an `org_overrides` insert put back each fail it).

- **Step 1** is `StartAccountStep` (exported from `StartDoorForm`) at `/auth/signup`, where the pricing page and every
  "create your free account" link already point: "Create Your Organization", "Run your tournament, league or club", the
  step line, the pricing chip (A6, D10 solid edge), Create Account, "No credit card required.". `?account=1` keeps its
  own form (the organization-only parts taken out). The invited branch keeps its words in the start look
  (`InvitedInstead`); the inline "account already exists" notice gives way to the start forms' rule (sign in, then
  step 2) — one rule for every start door.
- **Step 2** is the shared name step (`StartTournamentForm`), "Adding an organization to …", the address in olive (F08),
  Not now on a first day (F07). `AddOrgForm` is gone. `/api/org/create` clears the organization door. The plan step
  opens with the pricing page's plan featured and its billing chosen (`planStepPath`); an existing account that signs
  in from step 1 carries the plan through sign-in (`?plan=&billing=` on `/start/tournament`).
- **Home:** the organization door's waiting card carries `/start/tournament`'s two gates (a pending invite, already in
  a real organization), as the league's does.
- The signed-out `/start/tournament` heads-up keeps its screen; its sentence "…and your organization's name. That's the
  whole form." was untrue after this and now says the name comes after the account (build call, told to the owner).

**The Founding Season rule (A5 + edges ratified 2026-10-19).** One rule, `isFoundingSeasonOpenFor(accountCreatedAt,
cameToStart)` in `lib/plan-config.ts`, read through `foundingSeasonOfferFor(user, creates)` in `lib/founding-season.ts`
by `/api/org/create` and `/api/league/create` (Part 3 adds `create-team-checkout`). The locked door is
`app_metadata.start_door`, written by `lockStartDoorOrUndo` at sign-up for the doors that carry an offer (organization,
league, premium) — a failed lock undoes the account — and cleared by `clearStartDoor` with the remembered door. The plan
step after the close: `foundingSeasonOfferOnPlanChoice(org)` (a live Founding comp row while the plan is still the
**first-run choice** — no tournament, no saved setup work, onboarding not finished, `lib/first-run-plan.ts`, the same
lock the free-plan route applies; server facts only; fails closed) gates `create-checkout`'s no-Stripe Tournament Plus and, through `founding-season-status?planChoice=1`, the
plan card's $0 (`PricingSection` `foundingOfferHeld`, Tournament Plus only). The onboarding plan route is not a grant path
(census 2026-10-19: it only schedules the upsell email), so it was left on the window. The Club exclusion holds: every
creation makes a `tournament` org, and the plan-step rule checks `foundingCompAppliesToPlan`.

**Production count (owner-approved read, 2026-10-19):** 5 organizations; **1** made by a sign-up that never confirmed
(made 2026-08-29, free Tournament plan, no tournaments, owner never signed in, holds a Founding comp). Cleaning it is a
separate owner call. Probe: `.probe/account-first/prod-unconfirmed-orgs.mjs` (read-only; slugs to a local file only).

**How "first plan choice" (ruling (c)) is read — flagged to the owner 2026-10-19, not a ruling.** The plan step's own
"plan chosen" mark is written by the browser and wiped by every first-run plan change (the free-plan route, an
abandoned checkout), so /review showed an owner could reopen $0 by starting a checkout and walking away. The build reads
the first plan choice as **the first-run choice**: while the plan is still editable on the plan step (before setup
starts) Tournament Plus stays $0 for an organization holding the comp, even if it picked free a minute earlier; once a
tournament or setup work exists, an upgrade pays the list price. A strictly-first-click reading needs a server-side
record of the first choice (a schema change) — the owner's call.

**/simplify (2026-10-19, four lenses):** one `lockStartDoorOrUndo` for both sign-up routes; the org sign-up answers an
existing account one way (409, as account-only always did) and has one response shape; `ensureFoundingSeasonCompPeriod`
writes the comp at organization and league creation (idempotent; same row); one `slugifyOrgName` (lib/utils) for both
start forms and both create routes; the leftover invited-panel and divider rules in `auth.module.css` removed; Home's
gate reads plainly. Skipped on purpose: one copy of the door instead of two (Part 1's storage is on production); a
per-plan promo callback on `PricingSection`; a shared "would the step open" helper across Home, the two pages and the
two create routes; a server-component split of `/auth/signup`; merging the account-only form into the start form.

**/review (2026-10-19, high risk, five lenses; gate green for this scope, `check:layout` admin-onboarding ✓ at four
widths; the start and sign-up forms are not in the layout registry):**
- Fixed (Medium): the plan-step rule keyed on the browser-written plan mark — now server facts (above); mutation-checked
  (the plan mark or the tournament check put back each fail the guard).
- Fixed (Low): the plan card's $0 could go stale after a choice on the same page — it is asked again whenever the
  chooser appears and shown only for the state it was asked in; a newer pricing-page plan in the address beats the one
  remembered at sign-up; a second submit that races past the account check gets the same 409; the lock-or-undo also
  catches a thrown error; the team and league pages keep Part 1's localhost behaviour; Club is ruled out before the
  window in the plan-step rule; the data dictionary no longer names the sign-up as a comp writer.
- Accepted: two tabs on step 2 at once can each make an organization (the single-organization check is not atomic — as
  before); a failed comp write at creation still clears the lock (logged, as before); an undo that itself fails leaves
  an unconfirmed account behind (two admin failures in a row); for an account that chose the dark look, step 1 shows
  the warm card on the dark sign-in ground; the add-organization route has no rate limit (as before); the startup-tasks
  route lets any member mark a task (pre-existing — it can only close the first run, never reopen it).

**Accepted, left as they are:**
- League door accounts made between Part 1's release and this one carry no locked copy; League self-sign-up is off
  everywhere but localhost, so nobody is affected.
- The plan step's "Welcome to your Founding Season" banner still reads the window, so an organization that gets
  Tournament Plus free on its first choice after the close does not see it (a neighbour, not built here).
