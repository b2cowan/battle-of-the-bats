# The first look — Stage 1 build prompt: one account step, at every door

Paste into a fresh session. Written 2026-10-19 by the session that walked, drew and got the owner's rulings on The
first look. **This session builds Stage 1 only.** Stages 2 (the wait and the way back) and 3 (the first screen inside)
are ruled but are separate builds.

---

## Read first, in this order

1. `CLAUDE.md`, `AGENTS.md`, `AGENCY_RULES.md`. The rules that bite here:
   - one `dev` branch;
   - stage explicit pathspecs only, ask before every commit, never push;
   - the spelling and clock gates;
   - "disagree out loud";
   - argue from what the code does, not from what a plan says.
   This working copy is shared: run `git status` first and leave other sessions' files alone.
2. **The spec is the drawing.** Hub https://claude.ai/artifact/AdLSGDCii8xExFuVdZxvsx, tab **End state drawn**: every
   screen tagged **S1** (*S1 · The account form*, *S1 · Tournament, Premium, join*, *S1 · Step 2 and the wait*,
   *S1 · Dark*). The owner ruled those screens, so they are the visual spec, NEW / CHANGED / UNCHANGED tags included
   (auto-memory `feedback_build_to_approved_mockups`).
   - A part you deliberately don't match is flagged at build time, never found by the owner in QA.
   - The same drawings live in the source file `docs/projects/archive/FIRST_LOOK_SIGNUP_HUB.html`.
3. `docs/projects/archive/FIRST_LOOK_SIGNUP_PLAN.md`: the findings F01–F19, **Standing back: the rules for the first
   run** (rules 1–9), **Rulings** (R1 and every ask, 2026-10-19), the /design review (D-F1–D-F11) and *Notes for the
   build*.
4. `docs/projects/archive/ACCOUNT_FIRST_SIGNUP_PLAN.md`, the *As built* Parts 1–3. Every behaviour those parts built
   stays (see "Keep" below). Read its /review lessons before touching the door code.
5. The house rules the drawings were checked against:
   - the `--type-*` ladder in `app/globals.css` (~680–720);
   - the top-bar ruling T1 in `memory/design_decisions.md` (2026-08-01: one nav-label size, `--nav-label-size`, and
     one 30px pill);
   - the 2026-09-27 sentence-case tab-label ruling for the coach and admin bars.
6. Plan facts for every price or date a sub line shows: `docs/agents/strategy/PLAN_PRICING_FACTS.md`. **Never type a
   date or price.** Read them from `lib/plan-config.ts` (`FOUNDING_SEASON_END_LABEL`, `isFoundingSeasonPromoActive(...)`,
   the plan prices), so the line changes by itself when the window closes.

Delegate the broad reading (CLAUDE.md). Read the lines a decision turns on yourself.

---

## The blocking gate (before any code)

1. **A product-manager UX summary in the chat** (AGENCY_RULES). Say what a newcomer sees and does differently at each
   door, phone and computer, and who it affects: newcomers, invited staff, coaches arriving from an organizer's email,
   and every visitor through the top bar.
2. **Re-check the drawing against the code.**
   - The drawings were made against DEV on 2026-10-19. Another session may have moved a screen since.
   - Anything the code now does that the drawing does not show goes to the owner as a question, with a drawing, before
     you build it.
3. **Open questions this prompt already answers** are listed under "Decided for the build". Re-open one only with a
   reason from the code.

---

## What Stage 1 delivers (the owner's rulings, 2026-10-19)

### The one account step
- **One set of shared pieces for every door:** the account fields, the step line, the check-your-email block and the
  start column (420px, centred, no card around the form), in **one** module.
  - The doors stop carrying their own field, label and button styles. That means `startForm.module.css`, the parts of
    `auth.module.css` the account-only sign-up and the invitations use, `join.module.css`, and
    `app/team/page.module.css`'s form rules.
  - ⚠ **`auth.module.css` is also sign-in's, forgot password's and the Continue page's**, and those are Stage 2. Move
    the Stage 1 screens off it. Do not restyle it in place, or sign-in changes a stage early.
  - A new `*.module.css` needs a token scope: staging build 346 failed on exactly that (auto-memory
    `reference_public_token_guardrail`).
- **Type, on the ladder** (rule 2 and Ask 12):
  - heading: the display face, 700, sentence case, at the `--type-display` step (32px);
  - sub line: Inter 16, dim; labels: Inter 600 14, sentence case;
  - fields: 48px, white, 10px radius, 16px text;
  - button: Inter 700 16, 48px, lime; fine print and foot links: Inter 14.
  - Monospace appears only on the wordmark and a plan chip.
  - **Write the ladder exception into the `globals.css` ladder comment** (Ask 12): "a first-run page heading — one per
    screen, no back arrow — takes the display step". Use no new token.
- **Words** (rule 3, Ask 3: written rules, **no build guard**):
  - step 1's button is **Create account** at every door;
  - step 2 names the thing: "Create team", "Create organization", "Start your season" for a league;
  - Coach Premium step 2 says **Create team** while the Founding Season comp applies, and "Continue to checkout" when
    a card is needed (D-F6);
  - no arrows on buttons;
  - the password rule sits **under** the field as a hint ("At least 8 characters."), not in the placeholder (D-F4);
  - one email placeholder, `you@example.com`.
- **The step line** keeps its look (D2, uppercase Inter 12, a named exception, D-F5) with single-noun labels:
  - "Account · Team", "Account · League";
  - **"Account · Organization · Plan"** for Run a tournament, which now shows its third step;
  - finished steps at full strength, no fade.
- **Headings and subs per door** (as drawn):

  | Door | Heading | Sub line |
  |---|---|---|
  | Start a team | Start a team | A free team home, no organization needed |
  | Start a league | Start a league season | (the /start card's words) |
  | Run a tournament | Run a tournament | Free to start. You'll name your organization next. |
  | Coach Premium | Coach a team | the offer, read from plan-config |
  | Account-only | Create your account | (one plain line) |
  | Join page | Create your account | names the team and the tournament the page already reads |

  Step 2 keeps step 1's heading and sub line. **Drop the "Adding a team to <email>" subtitle** (F19).

### Door by door
- **Start a team and Start a league:** onto the shared pieces. Behaviour unchanged.
- **Run a tournament (Ask 6):**
  - The intro page is folded in. Signed out, `/start/tournament` shows the account form at once; both steps live
    there.
  - `/auth/signup` (no `account=1`) **forwards** to `/start/tournament`, carrying `plan`, `billing` and `next`.
  - Update the internal links that point at `/auth/signup` for this door so they skip the hop: pricing, the
    `/for-*` pages, the footer, the walkthrough, login's foot, the sandbox and `user-contexts`. Census them yourself;
    the 2026-10-19 census found about 14 files.
  - ⚠ `/auth/signup?account=1` is the **account-only** page and must not forward.
  - The pricing-plan chip stays (D10), restyled as the white callout with an olive edge.
- **Coach Premium, both steps (R1).** Owner: *"if someone is already signing up, I don't see why we need this much
  marketing on the coaches portal sign up. it should look like the other 2"*.
  - Remove: the sales hero, the Founding Season panel, the season-setup checklist, the Get started / Compare pricing
    buttons, and the Create / Sign in toggle (the foot link does that job).
  - **Step 1:** the shared form.
  - **Step 2:** heading and step line, Team name, Sport (a dropdown), the post-Founding billing choice, Create team,
    and "Not now, go to Home".
    - The billing choice is a two-option control, 44px, 14/600, with a check and a 2px olive edge on the picked one
      (D-F3). Build it as a shared component the pricing page can adopt later (The public face's S4), but **do not
      restyle the pricing page here**.
    - "Seasonal" becomes the annual price wording.
  - The claim card shares this client: it inherits the look and keeps its own heading and behaviour (**Ask 7 parked
    the claim link**; change nothing about how it works).
  - The gated `CoachStartInterest` branch is untouched.
- **The account-only sign-up** (`/auth/signup?account=1`): onto the shared pieces and the one check-your-email.
- **The two invitations** (`/auth/accept-invite`, `/auth/accept-assistant-invite`):
  - the shared fields, without an email field (they know it);
  - one button wording, **"Create account and join"**, for both (was "Create password and join" / "Create account &
    join"; run it past `/marketing`); "Accept and join team" for a signed-in invitee;
  - every expired / wrong-account state keeps its words and gets the type.
- **The coach join page** (`/coaches/join`, Ask 5a):
  - Rebuilt on the shared pieces, **in the app's frame**. Today `app/coaches/layout.tsx` passes `/coaches/join`
    through to the marketing Navbar and Footer; give it the warm journey chrome as `/coaches/start` has (see
    `isWarmJourneyPath`, `CoachJourneyChrome`).
  - **Every state keeps its job, byte for byte in behaviour:** Registration submitted, You're already set up, choose a
    team profile, signed in as someone else, the verification return and its one auto-link request.
  - The registration-linking logic is the riskiest code in Stage 1. Move markup, not logic.
  - ⚠ `/coaches/checkout/complete` shares that pass-through but is **Stage 3** (Ask 5b). Leave it.
- **The one check-your-email** (rule 5): the start tone (`VerifyEmailSent` `tone="start"`) for the start doors, the
  account-only page and the join page.
  - The "Verification email sent to" panel becomes the white callout with an olive edge, in one line.
  - "Already verified?" becomes "Already confirmed?".
  - The two foot links share one 44px row.
  - Each door keeps its own last clause (the join page: "…straight to your team's registration").
- **Tournament registration** (Ask 2: "registration keeps its email-first step on the same fields"): **the field
  content only**, meaning the same labels, order, placeholder and password hint.
  - That page wears the organizer's brand (the standing R1-2 / M2 rule).
  - Its colours, frame and `register` check-your-email tone stay as they are. Say so in the UX summary.

### The top bar, the phone tabs and the doors (Ask 13, rule 8)
- **The consumer bar and phone tabs go to sentence case** for every visitor and fan: "Home · Scores · Sign in /
  Account", "Pricing".
  - Follow T1: `--nav-label-size`, 600, one 30px pill.
  - The start menu's button reads **"Get started ▾"** (was "Run a tournament ▾"). Its items are Run a tournament,
    Coach a team, Join a team, and Start a league season (beta only).
- **One door per thing.** Today `/start`'s `coachOption()` sends "Coach a team" to Coach Premium while checkout is
  open **and** the Founding Season promo runs, while `lib/start-menu.ts` `coachHref` sends it to the free team.
  - Make **one rule**: `coachOption`'s. The menu and the **coach demo's** "Start your own team — free" read it. The
    coach demo's start button wrongly opens the organization sign-up today (`SandboxChrome.tsx` ~803, ~964); the
    tournament demo keeps Run a tournament.
  - `/for-tournament-organizers`'s Tournament Plus card keeps its plan (`?plan=tournament_plus&billing=…`, as the
    pricing card builds it).
- **Warm / Dark (Ask 10):** the whole first run follows the setting, as sign-in does today.
  - The start forms and the Premium journey stop pinning `warmVars` / `.warm` and use the same setting-gated surface
    `/auth` uses (`warm.warmTab` + the dark vocabulary remap).
  - A newcomer has no setting, so they see warm.
  - In Dark, a field's edge reaches 3:1 against the ground (D-F10: about `#646b77` on the dark field). The *S1 · Dark*
    drawing is the spec.

---

## Keep (Account-First and Verify Every Sign-up behaviours a restyle must not lose)

- **The remembered door and the locked Founding door:** the email link lands on step 2 on any device.
- **V1:** one tap creates, never automatically. **V2:** registration first. **V3:** Send the link again on every wait.
- **A4 revised:** Home's waiting workspace card. Premium's "Not now" relies on it ("Setup not finished · Continue
  setup").
- The 409 hand-off to sign-in with the email filled; the invited-address branch ("You've Been Invited" — its words
  get rule 3's case); Use a different email clears only the password.
- **The no-create guard list** in `tests/unit/account-first-signup.test.ts`, and every other unit test on these flows.
- **Demo tours** anchor on `/start` and the start menu. The build fails if an anchor disappears, so keep the anchors or
  move them in the same change.

## Not in Stage 1 (ruled, later stages: don't build them on the way past)

- **Stage 2:** sign-in, forgot / reset password, the Continue page, the expired-link notice, the verification and
  password-reset emails and the warm envelope.
- **Stage 3:**
  - the plan step (and the pricing buttons for League Plus and Club);
  - the welcome card and checkout complete;
  - a fan's start line on Home.
  - The "first plan choice" reading (an inherited open call) is due before Stage 3, not here.
- **Not this project:** the free team's first home (F16) and the claim link's reachability (Ask 7, with `/strategy`).

## Decided for the build (so you don't stop to ask)

- **Build order: four parts, each committable alone.**
  - **1a:** the shared pieces plus Start a team, Start a league and Run a tournament (the intro folded in, the
    forward); step 2; the one check-your-email.
  - **1b:** Coach Premium, both steps (R1), and the billing control.
  - **1c:** the account-only sign-up, both invitations and the join page.
  - **1d:** the top bar and tabs, the one coach rule and the door links, and Warm / Dark.
  - Ask before each commit.
- **League's step 2 button:** "Start your season", sentence case of today's words, not "Create league".
- **Invitations:** "Create account and join" for both.
- **Registration:** field content only (see above).

---

## Verify

- **During the work:** focused checks (`npm run verify:changed`, which includes the spelling gate and the dictionary
  check). Run `npm run typecheck` once per part, because shared modules change; on Next 16.3 run `npx next typegen`
  first. Run the unit tests that cover these flows.
- **Layout:** `npm run check:layout --changed` on the dev server for the screens each part touched. Never a
  whole-product sweep on the dev server (AGENTS.md).
- **Dev server:** this adds files and changes shared modules and a layout, so restart before handing to the owner
  (AGENTS.md restart rule; stop the server before clearing `.next`).
- **Localhost has verification off.** To see the check-your-email screens, answer the sign-up POST with
  `requiresEmailVerification: true` in Playwright, as `.probe/first-look/cap-in.mjs` does. The email round trip is
  walked on staging.
- **Screen reader:** a pass on the shared form and the check-your-email block. It is owed from the review, so do it
  with this build. Check that labels are tied to fields, the error is announced, and the step line reads "Step 1 of
  2: Account".
- **Before each commit:** `/simplify` (it adds a shared abstraction), then `/review`. These are sign-up and auth
  flows, so treat them as high risk.
- **After each part:** offer `/docs`. Help articles quote "Create Account", the "Run a tournament" menu and the
  Premium page.
- **Copy:** `/marketing` on the few sentences the rulings did not fix word for word (the account-only sub, the join
  page's sub, the invitation button).
- **Rules:** record rules 1–9 for `/design` (in-repo `memory/design_decisions.md`, one dated entry) and for
  `/marketing` (Ask 3).

## QA

- **One checkable walk on the same hub** (a QA tab; auto-memory `feedback_qa_walkthroughs_as_checkable_artifacts`):
  one purpose per walk, phone and computer, Warm and Dark, each door to its first screen, plus the join page's states
  and both invitations.
- Take the next free § in `OWNER_QA_LEDGER.md` at build time. It was §348 or later on 2026-10-19; re-check, because
  other sessions number too.
- Never sort the §s.
- Staging walks cover the email round trip; localhost walks cover Start a league (beta).

## Success

- From every door, the account step is the same page: one form, one heading style, Create account, the button in view
  on a 390 × 844 phone and a 1366 × 768 laptop.
- The join page is in the app's frame.
- Every "Coach a team" leads to the same place.
- The top bar says Get started.
- Dark users stay dark.
- Every Account-First behaviour still works.
