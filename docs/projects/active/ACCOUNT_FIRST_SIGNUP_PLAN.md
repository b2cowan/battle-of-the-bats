# Account-First Sign-up — plan

**Status:** drawn 2026-10-18 and design-reviewed the same day (hub: https://claude.ai/artifact/PY5MgHrj9kjY6tCRPi7oLx v1,
source `docs/projects/active/ACCOUNT_FIRST_SIGNUP_HUB.html`, built by `.probe/account-first/build-hub.cjs`). **A1–A7
ruled as recommended by the owner 2026-10-18** (see Rulings). **Part 1 (shared pieces + Start a team + Start a
league) built and committed `8647a4e8` 2026-10-18** on `dev` after /simplify and /review (high risk) — see *As built,
Part 1* below; owner walk §336 owed (hub QA tab). Parts 2 and 3 next, from `ACCOUNT_FIRST_SIGNUP_BUILD_PROMPT.md`.
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
- **A5** The Founding Season offer counts from the day the **account** was made: an account created before the
  sign-up close (`FOUNDING_SEASON_SIGNUP_CLOSE`, end of 2026-12-31) still gets the comp when its organization is created
  after it. The comp's end date is fixed for everyone (`FOUNDING_SEASON_END`), so a late organization gains nothing.
  Logged in `BUSINESS_DECISIONS.md` 2026-10-18 (refines 2026-09-07 part 2). Two edges are **Proposed** there: (a) after
  the close only the start sign-up's own creation counts, not further organizations; (b) the same rule for Coach Premium.
  Eligibility reads the auth user's `created_at`, never `user_metadata` (the user can edit that).
- **A6** The pricing page's plan and billing ride on the account and open the plan step with that plan chosen; the
  person can still change it.
- **A7** Sign-in offers Send the link again to a waiting account, in this project, with the resend's existing limit.

Design review 2026-10-18 (D1–D12, on the hub's Decisions tab) is part of the drawings these rulings approved: no icon
well on phone start forms, the plain "Your email is confirmed." sentence, 44px foot links, "Create Account" in the start
forms and "Create account" on the Premium card, the resend inside the sign-in error box.

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
- Creating **either** a team or a league clears the door.
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
