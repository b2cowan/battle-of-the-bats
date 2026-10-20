# The first look — Stage 2 build prompt: the wait and the way back

Paste into a fresh session. Written 2026-10-20 by the session that closed Stage 1 (walk §348 passed, `/docs` and
`/marketing` run). **This session builds Stage 2 only.** Stage 3 (the first screen inside) is ruled but is a separate
build. Stage 1 is built and its pieces are the ones you reuse.

---

## Read first, in this order

1. `CLAUDE.md`, `AGENTS.md`, `AGENCY_RULES.md`. The rules that bite here:
   - one `dev` branch;
   - stage explicit pathspecs only, ask before every commit, never push;
   - the spelling and clock gates;
   - "disagree out loud";
   - argue from what the code does, not from what a plan says;
   - **a shared agent-automation path changes only when the owner asked** (this build touches none).
   This working copy is shared: run `git status` first and leave other sessions' files alone. `TODO.md`, the QA
   ledger and `memory/design_decisions.md` regularly carry other sessions' uncommitted hunks; partial-stage them.
2. **The spec is the drawing.** Hub https://claude.ai/artifact/AdLSGDCii8xExFuVdZxvsx, tab **End state drawn**,
   sub-nav **S2 · Email, link, sign-in**. Source: `docs/projects/active/FIRST_LOOK_SIGNUP_HUB.html` (~6.9 MB of
   embedded images: never open it whole; grep the S2 section, about lines 561–568). Today's captures are in the
   **Walk** tab, stations 3 (*Waiting for the email*) and 4 (*Signing in, and the refusals*).
3. `docs/projects/active/FIRST_LOOK_SIGNUP_PLAN.md`: findings **F04, F09, F10, F11**; the rules 1–8 (*Standing back*);
   **Ask 1** and **Ask 8** (ruled 2026-10-19, as recommended); *As built, Stage 1* (what you reuse and why).
4. The Stage 1 pieces you build on, all in `components/auth/`: `AccountForm.tsx` (`StartColumn`, `StartHead`, `Field`,
   `EmailField`, `PasswordField purpose="current"` — made for sign-in —, `StartFoot`, `accountForm` classes),
   `ResendLink.tsx`, `VerifyEmailSent.tsx`. Read `FIRST_LOOK_STAGE1D_BUILD_PROMPT.md` only for the Warm/Dark part
   (`warmTab`, `--home-field-edge`).
5. House rules the drawings were checked against: the `--type-*` ladder in `app/globals.css` (including the first-run
   heading exception Stage 1 wrote into it), `memory/design_decisions.md`, and `docs/agents/strategy/PLAN_PRICING_FACTS.md`
   for any price or date a line shows (never type one; read it from `lib/plan-config.ts`).

Delegate the broad reading (CLAUDE.md). Read the lines a decision turns on yourself.

---

## The blocking gate (before any code)

1. **A product-manager UX summary in the chat** (AGENCY_RULES). What a newcomer or a returning customer sees and does
   differently on each screen and in each of the two emails, phone and computer.
2. **Re-check the drawing against the code.** The drawings were made against DEV on 2026-10-19; Stage 1 changed the
   screens around them. Anything the code now does that the drawing does not show goes to the owner as a question
   with a drawing, before you build it.
3. **Eight things were not drawn: now drawn AND RULED (owner, 2026-10-20, all eight as recommended).** Stage 1's lesson (and the owner's rule, auto-memory `feedback_build_to_approved_mockups`)
   is that an undrawn state is found in QA. **Drawn 2026-10-20, as their own page** (the hub is an index now):
   https://claude.ai/artifact/353241emo2NHrP1m6tPyjQ (source `docs/projects/active/FIRST_LOOK_STAGE2_UNDRAWN.html`, built by `.probe/first-look/build-stage2.cjs`;
   it went through `/design` before publishing). It holds U1–U8 at true phone size beside today's behaviour, each with
   a recommendation, plus the red and amber notices in Dark (the spec for Dark; nothing to rule). **The owner's pasted
   answers: U1–U8 each "as drawn" / "as listed" / the recommended option.** The table below is therefore the ruling.
   Nothing is left to draw before the build; the only open step on the words is `/marketing` reading U1, U2, U5, U6 and
   U7 (see "Decided for the build"). If the code shows the page missed a state, draw it and ask before building.

| # | Was not drawn | What the code does today | RULED 2026-10-20 (as recommended) |
|---|---|---|---|
| U1 | **Sign-in, wrong password** | Red-edged box: "Incorrect email or password. Please try again." (`lib/auth-errors.ts`); no way forward beside it | Keep the red edge (D-F9: red is kept for a wrong password). One sentence with the way forward: "That email and password don't match. Try again, or reset your password." with *Reset your password* as a link in the sentence |
| U2 | **Sign-in, an existing address** (the 409 hand-off from a sign-up, email already filled) | Lands on sign-in with no word of why (F09) | A neutral notice above the fields (the expired-link notice's box): "You already have an account with that email. Sign in below." |
| U3 | **The Continue page's invalid link** | "This verification link is invalid. Return to sign up and request a new one." and a *Create account* link to `/auth/signup`, which opens the organization door whatever door the person came from | No screen of its own: send the person to sign-in with the **same** expired-link notice Ask 8 drew ("broken links also go to the sign-in notice") |
| U4 | **Forgot password and the two reset screens**, every state | Only a one-line note in the hub: "Reset your password" / "Send me a reset link"; "Choose a new password" / "Save password" | Draw: forgot (form, sent), reset-confirm (the scanner-safe tap page + its invalid state), reset-password (waiting, ready, expired, success). All in the start column, the shared fields, the Continue page's wording ("Reset my password" for the tap button) |
| U5 | **The password-reset email** | Named in Ask 1, never drawn. The default builder has its own 480px dark monospace card | Same warm envelope as the verification email. Heading "Reset your password", body "We got a request to reset the password for your FieldLogicHQ account.", "Use the button to choose a new one. The link works for 1 hour." (**the hour is true: Supabase's email-link expiry is 3600 s on both dev and production, checked 2026-10-20; if it is ever changed, change the email with it**), button "Reset my password", "If you didn't ask for this, ignore this email. Your password won't change." |
| U6 | **The verification email's next-step sentence for every door** | Only the Start a team sentence is drawn ("Then you'll name your team."). The old email named the typed team or organization | One sentence per door, owner and `/marketing` rule it: Start a team *Then you'll name your team.* · Start a league season *Then you'll set up your season.* · Run a tournament *Then you'll name your organization and pick a plan.* · Coach Premium *Then you'll name your team and choose how you'd like to start.* · account only / an invitation *Then you're in.* · registration / join page *Then you'll see your team's registration.* |
| U7 | **What "Email me a new link" says after it sends** | Nothing exists (see the flag below) | "If that address is waiting to be confirmed, a new link is on its way. Check your spam folder too." Never "Sent" |
| U8 | **The email on a phone and in a dark mail app** | Drawn at 600px only | Draw the 390px version and a dark-mail-app rendering, from the real builder (`.probe/first-look/cap-extra.mjs` renders emails through jiti) |

4. **Flags from the code that change what you build.** Raise each with the owner in the UX summary; they are not
   re-openings of a ruling, they are places the drawing and the code disagree.
   - ⚠ **"Email me a new link" cannot honestly promise a link for a used link.** `POST /api/auth/resend-verification`
     returns the same `{ok:true}` whether or not an account exists, is already confirmed, is staff, or verification is
     off, and sends nothing in all but one of those cases. That sameness is deliberate (no account enumeration).
     A person whose link was *already used* is a confirmed account: the button would say it sent a link and nothing
     would arrive. Hence U7's wording, and the notice must keep "Sign in" first. Do not change the route's sameness
     to fix the copy.
   - ⚠ **`SIGN_IN_ERROR_COPY` is shared with tournament registration** (`RegisterContent`, which spreads the map and
     overrides lines). The drawn waiting-account notice ("Confirm your email first. We sent a link to {email} when you
     signed up.") is built **in sign-in from `waitingEmail`**; do not edit the shared map's `email_not_confirmed` line
     unless you also check that page. The map's line still says "verify"; if you change a word there, change it in
     both places in one commit.
   - ⚠ **`/auth/callback` is shared with invitations.** Org-member invites (`app/api/admin/members/invite/route.ts`),
     invite links (`lib/invite-links.ts`) and every verification link redirect through it. Adding the "expired or used"
     reason must leave every success path byte-for-byte as it is and change only the `router.replace('/auth/login')`
     fall-through (L68) — and it must carry a reason **only when the URL really failed** (an error in the hash such as
     `otp_expired`, or no code at all), never invent one for a cancelled sign-in.
   - ⚠ **`proxy.ts` and `lib/consumer-routes.ts` also send people to `/auth/login`.** The notice appears only when the
     new reason parameter is present; a plain redirect there stays plain.
   - ⚠ **The email templates live in the database too** (`platform_email_templates`, rows `signup_verification` and
     `password_reset`). **Checked 2026-10-20: neither row is customised on dev or on production**, so the builders
     decide today. A customised row, once a platform admin saves one, is rendered through `renderPlatformEmailHtml`
     → `wrap()` instead. Apply the new envelope in **both** paths for these two keys, or a saved edit silently brings
     back the old dark card. The variables stay exactly `orgName`, `verifyUrl`, `resetLink` (there is no `firstName`
     variable; the greeting is in the default builder only). The seed body says "continue setting up {{orgName}}" while
     the builder sends "your account" for `orgName`: note it in the plan, do not "fix" the seed here.
   - ⚠ **`wrap()` is not yours to edit.** It is the shared dark envelope of about 46 other builders, `club-schedule-send`,
     `feedback-email`, the marketing campaigns and the test-send route, and a comment at `lib/email.ts` ~119 forbids
     adding a footer to it. Build **a new warm envelope helper next to it** and use it only for the two emails (and
     the customised path for those two keys). Migrating the rest is The public face's S3, and is a migration onto
     your envelope, not a design.

---

## What Stage 2 delivers (the owner's rulings, 2026-10-19: Ask 1, Ask 8, rules 1–8)

### The warm email envelope and the two emails (part 2a)
- **One envelope, built once.** Email cannot load the product's fonts or know Warm/Dark, so it is warm and fixed:
  600px, ground `#f6f1ea` with a 1px `#c9c1b2` edge and a 10px radius, a white 12px-radius card (padding 28px 26px)
  holding the content, ink `#211c15`, Arial/Helvetica, secondary text `#665f57`.
  - **Wordmark** (D-F11): Courier New 15px bold — `FIELD` in ink, `LOGIC` in olive `#55641c`, `HQ` in `#4b463f`.
  - **Heading** 24px/1.2 bold; **body** 16px/1.55.
  - **Button**: `#d9f99d`, 16px bold, padding 14px 26px, radius 10px, **plus a 1px solid `#55641c` olive edge** so it
    holds against the white card (D-F11).
  - **Footer** outside the card, centred, 12px: the word "FieldLogicHQ".
  - It must also work at 390px wide (U8), in Gmail, Apple Mail and Outlook, light and dark. Test with real clients;
    this is the "owed before Stage 2 is ruled" item in the plan and it is still open.
  - Mail needs inline styles throughout (that is why the hub drew it with them); no web fonts, no CSS classes.
- **The verification email**, as drawn: "Confirm your email" / "Hi {firstName}, welcome to FieldLogicHQ." / "Confirm
  your email to finish your account. {door's next step}" / **Confirm my email** / "If you didn't create this account,
  you can ignore this email." Subject: **"Confirm your FieldLogicHQ email"** (`/marketing` 2026-10-20: a bare "Confirm your email" has no sender in the inbox preview, and it matches the reset email's "Reset your FieldLogicHQ password"; the seed's "Verify your email — FieldLogicHQ" is the
  customised-path default; keep the two in step and say so in the plan).
- **The password-reset email**: U5.
- **Both go through the new helper**, in the builders **and** in the customised-render path for these two keys.
- Add both to `app/dev/email-preview/page.tsx` (it has none of the account emails) so the owner can see them.

### Sign-in and the way back into it (part 2b)
- **Sign-in on the Stage 1 pieces** (`StartColumn`, `StartHead`, the shared fields, 48px button, no card round the
  form) — rule 1 and 2, fixes F04: heading **Sign in**, sub **Welcome back.**, Email, Password (the eye),
  *Forgot your password?* as a right-aligned 44px olive row, the lime **Sign in** button, and one foot link **New here?
  Get started** to `/start` in place of the three foot lines. Keep the `#login-email`, `#login-password` and
  `#login-submit` ids (UAT scenarios use them) and the `next` handling, the 10-second loop breaker and the demo
  account's local sign-out exactly as they are.
- **The notice box** (D-F8, D-F9): white box, 14px body with a 16px bold title, an **amber** left edge `#b7791f`.
  Red `#b23b2e` only for the wrong password.
  - **Expired or used link** (above the fields): **"That link has expired or was already used."** + "Sign in, or send
    yourself a new one." + the secondary button **Email me a new link** (below the *Sign in* button, white, field-edge
    border). It sends to the email typed above, the same resend V3 built; with the field empty it asks for the address
    first (one sentence, no alert).
  - **A waiting account** (below the fields, above the buttons; the order on the page is fields, notice, *Send the
    link again*, *Sign in*): **"Confirm your email first."** + "We sent a link to {email} when you signed up." — amber,
    not red, because nothing has gone wrong. D12's behaviour is unchanged: the resend sits with the error.
  - U1 and U2 as ruled.
- **The callback passes the reason** (see the flag): an unusable link ends on `/auth/login` with the reason; sign-in
  opens with the expired-link notice. Success paths untouched.
- **Loading lines**: sign-in's "CHECKING SESSION…" / "VERIFYING CREDENTIALS…" in capitals go to the product's one
  loading line (auto-memory `decision_one_loading_line`; `LoadingState`), sentence case.

### The Continue page, forgot password, reset (part 2c)
- **The Continue page** (`/auth/signup-confirm`, fixes F11): heading **Confirm your email**, sub "One tap and you're
  back to finish setting up.", the lime button **Confirm my email**, foot "Already confirmed? Sign in". **Keep the extra
  tap** (it stops a mail scanner spending the one-time link) and keep `verifyLink()`'s Supabase-host check and its
  `onClick`-only navigation exactly. The invalid state is U3.
- **Forgot password, reset-confirm, reset-password** on the same column and type, as drawn under U4 and ruled. The
  hub's only words: "Reset your password" / "Send me a reset link"; "Choose a new password" / "Save password".
  Keep: the always-`{ok:true}` forgot route, the scanner-safe tap page, `authActionLink()`'s Supabase-origin check,
  the return-path stamp (`RESET_RETURN_KEY`), the destination logic after a successful reset, and reset-password's
  five states.
  - ⚠ **Do not add a rate limit to the forgot route "on the way past"** (it has none; resend has three per hour per
    address). Report it as a finding; it is the owner's call.
- **Inline colours**: forgot, reset and signup-confirm style themselves with inline `var(--fl-text)`, `--data-gray`,
  `--danger-light`, `--logic-lime`. Those tokens are remapped by `.authSurface` for Warm. Move a page off
  `auth.module.css` and its inline colours go with it, or lime text lands on paper.

---

## `/marketing` read of the ruled words (2026-10-20)

Every string the owner ruled was checked against the code and the voice canon (plain, direct, no superlatives; sentence
case; curly apostrophes; "confirm", not "verify"; no arrows on buttons). **All ruled strings stand except one, which is
an owner call below.** Final strings to build:

| Where | Final string |
|---|---|
| U1 wrong password | **That email and password don't match.** / Try again, or use "Forgot your password?" below. |
| U2 hand-off notice | **You already have an account with that email.** / Sign in below. |
| U5 reset email | Reset your password / We got a request to reset the password for your FieldLogicHQ account. / Use the button to choose a new one. The link works for 1 hour. / [Reset my password] / If you didn't ask for this, ignore this email. Your password won't change. Subject: Reset your FieldLogicHQ password (as today) |
| U6 verification email | Confirm your email to finish your account. + the door's sentence: team *Then you'll name your team.* · tournament *Then you'll name your organization and pick a plan.* (matches its step line, Account · Organization · Plan) · Coach Premium *Then you'll name your team and choose its sport.* · account only *Then you'll land on your Home page.* (the confirm link's fallback is `/home`) · join page / a registration *Then we'll connect you to your team's registration.* · league: **see owner call 1** |
| U7 after "Email me a new link" | **Check your email.** / If that address is waiting to be confirmed, a new link is on its way. Check your spam folder too. |
| Reset screens | Reset your password / Enter your email and we'll send you a link. / [Send me a reset link] · Check your email / If an account exists for {email}, a reset link is on its way. Check your spam folder too. · Reset your password / One tap and you can choose a new password. / [Reset my password] · Choose a new password / [Save password] / At least 8 characters. · Password saved / Taking you to your account… |

**Owner calls (two; neither is built until the owner answers, and the build uses the ruled wording meanwhile):**
1. **The league sentence.** Ruled: "Then you'll set up your season." The league door's step 2 asks for one thing, the league
   or organization name (the button says "Start your season", the code's own next-step line is "naming your league"), so
   "set up your season" promises more than step 2 asks. *Recommended:* **"Then you'll name your league."**
2. **How long the confirm link lasts.** The confirmation link expires after the same hour as the reset link, and a
   volunteer who signs up in the evening and opens the email the next morning meets the expired-link notice. The
   verification email says nothing about it. *Recommended:* one small line under the button, "The link works for 1 hour.",
   as the reset email has. A real addition to the ruled email, so it is the owner's call.

## Keep (behaviours a restyle must not lose)

- **V1** one tap creates, never automatically · **V2** registration first · **V3** *Send the link again* wherever a
  wait or a refusal shows · **D12** the resend sits inside the waiting-account refusal.
- The 409 hand-off to sign-in with the email filled; `next` carried through sign-in, forgot, reset and resend.
- Every behaviour listed in `tests/unit/account-first-signup.test.ts` and `tests/unit/signup-verification-guard.test.ts`.
  **Those tests are source-regex pins on exact code**: the login error-box JSX, `ResendLink`'s "Sent again at {clock}.
  Check your spam folder too." line, the `classes={{ button: styles.errorAction, … }}` object, the resend route's
  limiter and `verificationReturnPath` lines, the confirm-URL literal in `lib/signup-verification.ts`, `verifyLink`
  in signup-confirm, the `.errorAction { min-height: 44px }` rule. Moving sign-in onto the shared module changes
  several of those lines: **update the pin in the same change and keep what it protects** (a 44px tap target on the
  resend, the announced status line, the `next` pass-through). Do not delete a pin to get green.
- `tests/unit/account-first-signup.test.ts` also forbids the Stage 1 screens from importing `auth.module.css` and
  forbids some old class names in it. **`auth.module.css` is still imported by forgot, reset-confirm, reset-password,
  signup-confirm and `suspended`, and its `.authSurface` rule is the layout's.** Delete a class only when nothing
  imports it; the file can shrink across 2b and 2c but is not removed in this stage unless `suspended` moves too (it
  is not on the drawings; leave it).

## Not in Stage 2 (ruled, later: don't build them on the way past)

- **Stage 3:** the plan step, the welcome card and checkout complete, a fan's start line on Home, the pricing buttons'
  doors. The "first plan choice" reading (an inherited open call) is due before Stage 3.
- **The public face, warm:** migrating the other ~46 builders onto the new envelope (S3), marketing (S4), the system
  screens (S5), the `/auth/callback` "Completing sign in…" holding screen's own look.
- **Not this project:** the free team's first home (F16), the claim link (Ask 7), rate-limiting the forgot route.

## Decided for the build (so you don't stop to ask)

- **Three parts, each committable alone; ask before each commit.**
  - **2a — the envelope and the two emails** (U5, U6, U8, all ruled).
  - **2b — sign-in, the notices, the callback's reason, "Email me a new link"** (U1, U2, U3, U7, all ruled).
  - **2c — the Continue page, forgot, reset-confirm, reset-password** (U3, U4, all ruled).
- **Words: `/marketing` read U1, U2, U5, U6 and U7 on 2026-10-20** (see *the `/marketing` read of the ruled words*
  above); build the final strings there. The drawn words (Ask 8) are fixed and are not re-opened. Two owner calls are
  open (the league sentence; a one-hour line in the verification email); build the ruled wording until answered.
- **"Confirm", not "verify"**, in every customer-visible word these screens and emails use; grep the other spelling
  first (`npm run check:spelling` runs in `verify:changed`).
- **No schema change.** If you find yourself wanting a column, stop and ask.

---

## Verify

- **During the work:** `npm run verify:changed`; `npm run typecheck` once per part (shared modules change; on Next 16.3
  run `npx next typegen` first); the unit tests that cover these flows.
- **Emails:** render both through the real builders (`.probe/first-look/cap-extra.mjs`) at 600px and 390px; send both
  to a real inbox through the platform admin's test-send; open them in Gmail, Apple Mail and Outlook, light and dark.
  That check belongs to this build and is not a staging nicety. Also test-send a **customised** copy of each template
  (and delete the customisation after) to prove the second render path wears the envelope.
- **Layout:** `npm run check:layout --changed` on the dev server for the screens each part touched. **No `/auth/*`
  screen is in the layout sweep's list today** (`scripts/layout-screens.mjs` has none): add sign-in, the Continue page,
  forgot and reset-confirm as anonymous entries with `ready` selectors (the waiting-account state needs an `interact`),
  or say in the plan why not. Never a whole-product sweep on the dev server (AGENTS.md).
- **Dev server:** this adds/changes shared modules and a layout; restart before handing to the owner (stop the server
  before clearing `.next`).
- **Localhost has verification off.** To see the waiting-account state and the check-your-email screens, answer the
  sign-up POST with `requiresEmailVerification: true` in Playwright (`.probe/first-look/cap-in.mjs`). A real
  expired/used link needs a real link: use an old verification link on staging.
- **Screen reader:** one pass on sign-in (labels tied to fields, the notice announced, the waiting-account notice read
  before the buttons) together with Stage 1's owed pass on the shared form.
- **Before each commit:** `/simplify` (a new shared envelope helper), then `/review`: these are auth and email flows,
  high risk. **After each part:** offer `/docs` (help quotes "Send the link again" and the sign-in error placement:
  `lib/help-content/coaches.tsx` ~L191 and ~L219–227, `platform-admin.tsx` ~L42 and ~L122–124, `tournaments.tsx`
  ~L724–729).
- **Design rules:** the rulings that settle U1–U8 go into `memory/design_decisions.md` as one dated entry.

## QA

- **One checkable walk on the same hub** (auto-memory `feedback_qa_walkthroughs_as_checkable_artifacts`; one purpose per
  walk): phone and computer, Warm and Dark: the verification email and the reset email in three mail apps; the Continue
  page; an expired link and a used link; a waiting account; a wrong password; an existing address; forgot and reset
  end to end.
- Take the next free § in `OWNER_QA_LEDGER.md` at build time (§349 was the last on 2026-10-20; re-check, other
  sessions number too). Never sort the §s.
- The email checks need a real inbox and staging for the live link: say which steps are staging-only in the walk.

## Success

- Sign-in, the Continue page, forgot and reset look and read like the sign-up that sent the person there: one column,
  one type, 48px buttons, no typewriter capitals, the button in view on a 390 × 844 phone and a 1366 × 768 laptop.
- The two account emails wear one warm envelope that says what comes next, and read right in Gmail, Apple Mail and
  Outlook, light and dark.
- An expired, used or broken link says so in one sentence and shows the way forward; it never lands on a bare
  sign-in again and never promises a link that will not come.
- Every Account-First behaviour (V1–V3, D12, the 409 hand-off, `next`) still works, every pinned test still protects
  what it protected, and nothing about invitations or the 46 other emails changed.
