# Account-First Sign-up — build prompt

Paste this into a fresh session. Written 2026-10-18 by the session that drew and ruled it.

**Part 1 built and committed `8647a4e8` 2026-10-18** (owner walk §336 owed). Before Part 2, read the plan's *As built,
Part 1* section: the shared pieces exist (`lib/start-door.ts`, `StartDoorForm`, `ResendLink`), a caller's own `next`
wins over the door, and the org sign-up joins the no-create guard's list.

## What you are building

Every **start** sign-up — Start a team (free), Start a league, Run a tournament, Coach Premium (and its claim link) —
asks for the **account only** (first name, last name, email, password). After the email link, the person lands on
**step 2** and names the one thing they came to start. Owner direction 2026-10-18; all seven asks ruled as recommended
the same day.

**Read first, in this order:**
1. `CLAUDE.md`, `AGENTS.md` (Next.js 16 — read the relevant guide in `node_modules/next/dist/docs/`; `proxy.ts`, never
   `middleware.ts`), `AGENCY_RULES.md` (one `dev` branch; explicit pathspecs; spelling and clock rules).
2. `docs/projects/active/ACCOUNT_FIRST_SIGNUP_PLAN.md` — findings F01–F08 with code locations, **§ Rulings A1–A7**, the
   build order, the notes for the build. This is the spec.
3. The hub, https://claude.ai/artifact/PY5MgHrj9kjY6tCRPi7oLx (v3). **The drawings are approved — build to them**
   (`memory/feedback_build_to_approved_mockups`): every NEW / CHANGED / UNCHANGED tag is a requirement, and the Decisions
   tab lists the design review's D1–D12, which are part of the approved drawings. Its source is
   `docs/projects/active/ACCOUNT_FIRST_SIGNUP_HUB.html`, built by `.probe/account-first/build-hub.cjs` (the drawings'
   exact copy lives in the builder).
4. `docs/projects/active/SIGNUP_EMAIL_VERIFICATION_HUB.html` + `lib/signup-verification.ts` — Verify Every Sign-up
   (`80f25c09`, on prod 2026-10-18), which this builds on. Its V1 (create on a tap, never automatically), V2
   (tournament registration goes first — **out of scope, do not touch**) and V3 (resend everywhere) all stand.
5. `docs/agents/strategy/BUSINESS_DECISIONS.md`, top entry (2026-10-18, Founding Season eligibility).

Before any code: present the plan's Part 1 as a short task list and the PM-voice UX summary (`AGENCY_RULES.md` requires
it), then build. Drawings already exist; a deviation from them is a redraw on the hub, not a judgement call in code.

## The parts — one build, three commits, each shippable alone

**Part 1 — shared pieces + Start a team + Start a league.**
- One account step for the start doors, in the warm start look (`app/(consumer)/start/startForm.module.css`), headed with
  the door's own name; no icon well below 640px (D1); the two-step line reusing the register page's step bar shape
  (`app/[orgSlug]/register/register.module.css` `.steps`, 24px circles, sans 12px/700/.05em, line ≤ 40px) in warm
  tokens, not clickable (A2, D2). "Create Account" (D7). Foot links get a 44px row (D6).
- **The account remembers its start door.** Write it at sign-up (the sign-up routes' `userMetadata`, passed to
  `generateLink`'s `options.data`), e.g. `start: { door, plan?, billing?, claim? }`. Link landing = the door's create
  step via `verificationRedirect(origin, next)` (A3).
- ⚠ **`user_metadata` is editable by the signed-in user** (`supabase.auth.updateUser({ data })`). It may steer
  SCREENS only (which step 2, which plan is preselected, whether the Home card shows). It must never decide an
  entitlement, a price, or Founding Season eligibility — those read server-side facts (`auth.users.created_at`, the
  plan rules, checkout validation).
- Step 2 = today's signed-in create screens (`StartTeamForm.tsx`, `StartLeagueForm.tsx`), field empty and focused,
  "Your email is confirmed." as today's plain sentence (D5), one tap creates (V1). Way out: "Not now, go to Home" for an
  account with no workspace; "← Back to your workspaces" stays for one that has some (F07).
- **Links already in inboxes** (`?team=` / `?league=` with `confirmed=1`) keep filling in for one release.
- **Home finish card** (A4, D8, D9): only for an account whose remembered start is unfinished. "Finish creating your
  team / league / organization" (Coach Premium: "Finish setting up your Coaches Portal" + "Continue setup"); primary
  button opens step 2; **Not now** hides it until the next sign-in; a **second** Not now hides it for good (persist the
  count on the account so it holds across devices). "Nothing here yet" hides while the card shows. Clear the remembered
  start when the creation completes. Fans/parents (account-only, follow, family claim) never see it.
- **Sign-in resend** (A7, D12): on `email_not_confirmed`, the error box gains "Send the link again" as its own action,
  calling the existing `app/api/auth/resend-verification` with its existing per-address limit; after a send the button
  gives way to "Sent again at 2:14 p.m. Check your spam folder too." (`formatTime()` — house clock), announced
  (`role="status"`). The link it sends must land on step 2 when the account has an unfinished start.

**Part 2 — Run a tournament + the pricing plan + Founding Season.**
- `/auth/signup` (organization) becomes the account step (it currently creates the org, slug, owner membership and the
  Founding comp before the link — F01, `app/api/auth/signup/route.ts` L268–338). Step 2 = the add-organization form
  (`/start/tournament`, `app/api/org/create`), retitled for a first organization ("Adding an organization to …", F07)
  and its public address in the olive the signed-out form already uses (F08). Then the plan step.
- **Pricing plan (A6, F03):** pricing's `?plan=&billing=` ride on the account and open the plan step with that plan
  chosen (today onboarding reads only `billing`; `featuredPlan` is hard-coded). The person can change it.
- **Founding Season (A5, decision log 2026-10-18):** the organization created on step 2 gets the comp when the
  **account's `created_at`** is before `FOUNDING_SEASON_SIGNUP_CLOSE`, not only while the window is open. End date
  unchanged. **Edges (a) "only the start door's own creation counts after the close" and (b) "the same rule for Coach
  Premium" are Proposed** — check the decision log for the owner's ratification before coding them; if still Proposed,
  ask. Put the check in one shared helper used by every comp-granting path (`app/api/auth/signup`, `org/create`,
  `league/create`, the onboarding plan route, `billing/create-checkout`, `billing/create-team-checkout`), and keep the
  Club exclusion (2026-09-25) intact. `/billing` reviews this piece.
- Before this part ships: count, read-only and **only with the owner's approval for a prod read**, the organizations on
  production made by sign-ups that never confirmed. Cleaning them is a separate owner call.

**Part 3 — Coach Premium + the claim link.**
- `app/team/TeamSignupClient.tsx`: step 1 is the account card only (Create / Sign in tabs kept); team, sport and billing
  move to step 2 (today's signed-in card). Remove the `sessionStorage` draft (F02). A billing choice from pricing rides on
  the account. The claim link keeps its server re-fill.
- `app/api/auth/team-signup/route.ts` gets the coach sign-up's throttle (`7bbfbebb`) and its check-your-email state
  gets Send the link again (V3).

## Guards, tests, docs

- **New guard:** no signed-out sign-up route creates an organization, team or league row (source scan of the sign-up
  routes); mutation-check it (break it on purpose, confirm it fails).
- Update: `tests/unit/signup-verification-guard.test.ts`, `coach-signup-throttle-guard`, `assistant-invite-account-states`,
  `coach-register`, `plan-panel-host`, `gated-plan-availability-copy`; UAT `marketing-seam.spec.ts`,
  `pricing-team-smoke.spec.ts`; `tests/unit/founding-season-dates.test.ts` if the eligibility helper touches it.
- `npm run verify:changed` per part; `npm run typecheck` (shared auth/API modules change). `check:spelling` and the
  possessive guard apply.
- No migration is expected (account data lives on the auth user). If you add a column after all: data dictionary +
  `npm run refresh:snapshots` in the same unit of work.
- After the build: offer `/simplify` (a shared helper is new), then `/review` at high risk (auth + money), then
  `/docs` — help articles to update: `lib/help-content/coaches.tsx` (first login, confirm-email FAQ),
  `tournaments.tsx` (new coach confirm email), `platform-admin.tsx` (Confirm Email).

## Working rules

- Branch `dev` only; stage explicit pathspecs; `git show --stat HEAD` after each commit. **Ask the owner before each
  commit; never push** without being asked.
- New files and shared-module changes mean a dev-server restart before the owner tests (`AGENTS.md`), with
  `npm run dev` only.
- Localhost has email verification off: the account step signs straight in there, so step 2, the Home card and the
  remembered door can be walked locally; the email round trip, the second-device case and the sign-in resend are walked
  on **staging**.
- When the build is done: add a QA walk to the hub's QA tab (a new Owner QA Ledger §, never renumber), one purpose per
  walk, and republish the same hub path; update the plan's status line, `TODO.md` and the hub's stage strip with
  anchored facts (commit hashes, dates), never "pending".
- Known neighbours, out of scope unless the owner says otherwise: an expired verification link lands on sign-in with no
  message; the public schedule payload carries unpublished divisions' games.
