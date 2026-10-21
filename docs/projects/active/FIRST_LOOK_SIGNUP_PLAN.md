# The first look — how a new customer gets into FieldLogicHQ — plan

**Status:** walked and drawn 2026-10-19 (session 1). **Every ask ruled by the owner 2026-10-19, all as recommended,
plus R1** (see Rulings). Nothing is built. Hub: https://claude.ai/artifact/AdLSGDCii8xExFuVdZxvsx (source
`docs/projects/active/FIRST_LOOK_SIGNUP_HUB.html`, built by `.probe/first-look/build-hub.cjs` from captures made by
`.probe/first-look/cap-*.mjs` against DEV). **Next:** Stage 1, built from `FIRST_LOOK_STAGE1_BUILD_PROMPT.md` (written 2026-10-19) in a fresh session.
**PM brief:** `FIRST_LOOK_SIGNUP_PM_BRIEF.md`.
**Kickoff:** `FIRST_LOOK_SIGNUP_REVIEW_PROMPT.md` (written 2026-10-19 by the Account-First Parts 2–3 session).
**Took over (both ruled 2026-10-19):** Account-First Sign-up's owed review — that project is closed and archived
(`docs/projects/archive/ACCOUNT_FIRST_SIGNUP_PLAN.md`) — and stage S2 of `PUBLIC_FACE_WARM_PLAN.md` plus its two
account emails (Ask 1).

## The owner's ask (2026-10-19)

*"a full end to end review of these screens, desktop and mobile, and make sure they have an excellent, simple, and
consistent ux as it is most customers' first look into our product."* The bar: **simple** (fewest screens, fields and
words; never a button below the fold), **consistent** (one form, one heading style, one button wording, one step line,
one check-your-email, one look, whatever the door), **excellent** (made for volunteers, not a terminal; every failure
says what to do next).

## How the walk was done

- **Captures:** a phone at 390 × 844, a computer at 1440 × 900 and a laptop at 1366 × 768 (the fold), Warm by
  default plus a Dark pass. Every door was walked **for real** on the DEV database with fresh probe accounts
  (`probe-fl-*@fieldlogichq.test`): Start a team to its first team home, Run a tournament to the plan step and the
  New tournament window, Coach Premium to its welcome, a fan to Home, an unconfirmed account to sign-in.
- **What localhost cannot show:** verification is off on localhost, so the check-your-email screens were shown by
  answering the sign-up request with "verification required" in the browser (nothing written). The verification
  email was rendered from its own builder. **Not walked, owed:** the email in a real inbox (Gmail, Apple Mail,
  Outlook; light and dark) and the staging round trip; what a screen reader hears on each station.
- **Measured:** words on the screen, fields, the primary button's position against the fold, tap targets, type face /
  size / case on headings, labels and buttons.
- Route census by a helper; every finding below that leads to a recommendation was re-checked in the code.

## What the walk found

### F01 — One account form, six designs
The same four fields (first name, last name, email, password) are drawn six ways:
- the start forms (`/start/team`, `/start/league`, `/auth/signup`): white 46px fields, labels in the **typewriter face**
  ("First Name");
- the older sign-in look (`/auth/signup?account=1`, sign-in, the invitation accepts): square fields, labels and
  button in **monospace capitals** ("FIRST NAME", "CREATE ACCOUNT");
- the coach join page (`/coaches/join`): the older look, **always dark**;
- the Coach Premium card (`/coaches/start`, the claim link): beige fields, Inter labels ("First name *"), its own
  Create / Sign in toggle;
- tournament registration and the family claim each have their own.
Placeholder emails differ (`you@example.com`, `coach@example.com`), and so does the password hint ("At least 8
characters", "Create a password" + "Minimum 8 characters").

### F02 — Two heading cases, and capitals
Title Case: "Create Your Team Home", "Create Your Organization", "Start Your Season", "Create Your Coaches Portal
Account", "Reset Password", "Set New Password". Capitals: "SIGN IN", "CREATE YOUR ACCOUNT", "VERIFY EMAIL". Sentence
case: "Create your Coaches Portal", "Run a tournament", "What do you want to do?", "Start free or choose an upgrade".

### F03 — Five spellings of one button
"Create Account" (start forms, join), "CREATE ACCOUNT" (account-only sign-up), "Create account" (Premium — design
review D7 split it from the start forms on purpose), "Create account & join" (assistant invite), "Create password and
join" (club invite). Step 2: "Create Team", "Create Organization", "Start Your Season" beside Premium's "Start free".
Run a tournament's intro: "Create your free account →".

### F04 — The terminal look is on the screens people come back to
Sign-in, the account-only sign-up and its check-your-email, forgot / reset password and the email's Continue page are
**recoloured, not restyled**: warm colours, still monospace capitals and letter-spaced ("SIGN IN · FIELDLOGICHQ",
"VERIFY EMAIL · FIELDLOGICHQ - ACCOUNT SECURITY", "SEND RESET LINK"). Their buttons are 42px tall.

### F05 — The coach join page is a different product
`/coaches/join` (where an organizer's coach email lands) sits inside the **marketing** bar and the full marketing
footer, always dark, whatever Warm/Dark says. Its button is 39px tall. Its check-your-email is the dark monospace
block. Signed out on a phone it is 1,470px tall for a four-field form.

### F06 — Checkout complete is the old dark marketing frame
`/coaches/checkout/complete` ("Payment received — setting up your portal") wears the marketing bar and footer and
inline dark styles: the first thing a paying coach sees after Stripe looks unlike everything before and after it.

### F07 — The plan step: the heading twice, four feature lists, buttons two screens down
`/{org}/admin/onboarding?choosePlan=1`, after naming the organization:
- "Start free or choose an upgrade" is the page title **and** the card title, each with its own paragraph.
- 432 words: four cards of feature lists in the old monospace type, buttons in letter-spaced capitals.
- **The choose buttons sit at 1,365px on a 1440 × 900 screen, 1,417px on a 1366 × 768 laptop (the screen ends at
  768) and 1,567px on a phone (the screen ends at 844).** Nothing to press is in view on arrival.

### F08 — The plan step offers plans this door cannot sell
Two of the four cards are League Plus ("Not open yet") and Club ("Coming soon" — two words for the same state), each
with Express interest, in the middle of a tournament organization's first run.
- **The W5 question is narrower than it looked.** The pricing page never offers a start button for a plan that is not
  on sale: in its marketing layout those plans move to the interest strip (`PricingSection` `cardPlans`). So nobody
  arrives at the plan step having picked League Plus on the pricing page; W5's `plan=league` came from a typed
  address. The highlight rule (a plan not on sale is never featured) is right.
- **The real problem is the door, and it will bite later:** every organization plan's pricing button points at
  `/auth/signup`, the **Run a tournament** door (`PricingSection` `ctaHref`). The day League Plus or Club opens, its
  pricing button will create a tournament organization and show it this step.

### F09 — An expired or used link explains nothing
`/auth/callback` with no usable code does `router.replace('/auth/login')`: plain sign-in, no message, no way to ask for
a new link (the resend appears only after a failed sign-in). The Continue page's "This verification link is invalid"
offers "Create account", which opens the **organization** door whatever door the person came from.

### F10 — The verification email is the old dark layout and says nothing about what's next
Rendered from `signupVerificationHtml` (through the shared dark `wrap()`): near-black ground, lime letter-spaced
wordmark, "Verify Your Email", "Verify Email →". The line is "Confirm your email address to finish creating your
account." for every door (a typed team or league name fills "continue setting up …" when there is one). The screen
the person just left promised "It brings you straight to naming your team"; the email does not repeat it. A platform
admin can customise this template, so the redesign keeps its variables.

### F11 — The Continue page is the right extra tap in the wrong words
The page exists so a mail scanner that opens links cannot spend the one-time token (`lib/signup-verification.ts`).
Keep the tap. Its words and type are a system's: "VERIFY EMAIL", "FIELDLOGICHQ - ACCOUNT SECURITY", "CONTINUE".

### F12 — Run a tournament alone has an intro page, and its step 1 lives elsewhere
Signed out, `/start/tournament` is a 65-word intro with "Create your free account →" and "I already have an account".
Step 1 is then `/auth/signup` under a different heading ("Create Your Organization"); step 2 is back at
`/start/tournament`. Team and league show the form at once, at one address for both steps.

### F13 — Premium step 2 hides its button under the sales page
Signed in, `/coaches/start` still opens with the sales hero and the offer panel, so on a phone **Start free sits at
1,367px** (the screen ends at 844). "Free through September 30, 2027" appears three times on one screen. The annual
choice is called "Seasonal" (pricing and the plan step say Annual). "Signed in and ready for checkout." is a monospace
status line. Premium alone has a Create / Sign in toggle. Signed out it is the same story: Create account at 1,197px
under the sales hero, the Founding Season panel and (on a computer) a season-setup checklist beside the form.

### F14 — The doors disagree about where they lead
- `/start`'s **Coach a team** opens Coach Premium; the top bar's **Coach a team** opens the free Basic team
  (`lib/start-menu.ts` `coachHref`). Same words, two products.
- The coach demo's **"Start your own team — free"** opens the **organization** sign-up (`SandboxChrome.tsx:803`,
  one href for both demo kinds). The demo doors are dev-only today, so no customer has hit it yet.
- The top bar's start menu reads **"Run a tournament ▾"** on every page, the team sign-up included; its first item is
  "Organize a tournament".
- `/for-tournament-organizers`'s Tournament Plus card drops the plan (`href="/auth/signup"`), so its pick is lost.

### F15 — Warm / Dark flips inside one journey
Sign-in follows the setting, the start doors are always warm, the join page is always dark: someone who chose Dark
goes dark → warm → dark between three screens.

### F16 — The first free team home leads with an empty box and three lime buttons
After Create team the coach lands on the team's Overview: an empty "This team isn't in any tournaments yet" box
**above** "Let's set up your team"; three lime buttons in one card (the portal's rule is one lime per screen); then
four "Not on" tiles repeating the three steps. (The free coach portal's own territory — see the ladder.)

### F17 — Premium's welcome says the date twice
The welcome card's sentence gives the Founding Season dates; the monospace capitals pill under it repeats them.

### F18 — A fan has no way to start something
Home for an account that came from no start door says "Nothing here yet — follow a team, tournament, or organization"
and nothing else. The only start doors are the desktop top bar's "Run a tournament ▾" and the phone Account tab's
"Start a tournament →". (A4 revised ruled this out of Account-First's scope, not out of the product.)

### F19 — System words in the small print
Step 2's subtitle is the account's email ("Adding an organization to probe-…@fieldlogichq.test"). Under every start
form the fine print is in the typewriter face ("Free, no credit card.", "Starts on the free Tournament plan.").

### What already works (keep)
- The start forms' **shape**: four fields, one button, the two-step line, "Already have an account? Sign in", 44px
  rows, the button above the fold everywhere (415px on a phone, 518px on a laptop).
- **The start check-your-email block** ("Your account is almost ready… It brings you straight to naming your team",
  Send the link again, Use a different email): the right words; it becomes the one block.
- **Sign-in for a waiting account** puts Send the link again inside the error (D12). Right behaviour, old look.
- **The New tournament window** on the first run is on the current look, buttons in view. Unchanged.
- **Home's waiting workspace card** (A4 revised) does its job.

## Standing back: the rules for the first run

These are proposed to `/design` and `/marketing` as the written public type rules (Ask 3), and handed to The public
face, warm (its S1) so marketing and email follow the same rules.

1. **One frame.** Every first-run screen — start doors, step 2, check-your-email, the Continue page, sign-in,
   forgot / reset, the account-only sign-up, the join page, invitations, welcome, checkout complete, an expired link —
   sits in the consumer shell (the white top bar, the phone tabs), on the paper ground, in one centred column of
   420px with no card around a form. Never the marketing bar or footer.
2. **One type, on the ladder** (`--type-*` in `globals.css`; no ninth size). Heading: the display face (Barlow
   Condensed 700), sentence case, 32px (the display step; today's start forms use an off-ladder 26px at 800). Sub:
   Inter 16, dim. Labels: Inter 600 14, sentence case. Fields: 48px, white, 10px radius, 16px text. Button: Inter 700
   16, sentence case, 48px, lime. Fine print and foot links: Inter 14. Monospace only for the wordmark and a plan chip —
   never a label, a button, a sentence or a heading. The step line keeps today's look (D2), uppercase Inter 12.
3. **One wording.** The heading names what the person came to do, in the words of the button they tapped ("Start a
   team", "Run a tournament"). Step 1's button is always **Create account**. Step 2's button names the thing
   ("Create team", "Create organization"). Sign-in says **Sign in**. No arrows on buttons.
4. **One account form.** First name, last name, email, password (with the eye), in that order, the same placeholders
   and hint, everywhere an account is made. A door adds only what it must (an invitation drops the email it already
   knows; the registration keeps its email-first step, V2).
5. **One step line, one check-your-email, one email.** Every two-step door shows the same line; every wait shows the
   start block; every account email wears one warm envelope.
6. **The button is in view.** On a 390 × 844 phone and a 1366 × 768 laptop the primary button is above the fold on
   every first-run screen.
7. **Every failure says what to do, in one sentence, with the way forward beside it** (a new link, sign in, use
   another email).
8. **One door per thing.** Every "Coach a team" leads to the same place; a demo's start button opens its own kind of
   door; a pricing plan opens the door that makes it.

## Rulings

- **R1 — Coach Premium's sign-up looks like the other doors** (owner, 2026-10-19, looking at the walk's step 2
  captures: *"if someone is already signing up, I don't see why we need this much marketing on the coaches portal sign
  up. it should look like the other 2"*). Both steps of `/coaches/start` (and the claim card that shares it) take the
  shape of Start a team and Run a tournament: the centred heading ("Coach a team"), the step line, the shared fields,
  one button, the same foot link; no sales hero, no Founding Season panel, no season-setup checklist, no Create / Sign
  in toggle. Premium keeps only what is its own: the offer in the sub line, and on step 2 the sport and what it moves to
  after the Founding Season. The selling stays on `/for-coaches` and the pricing page, which people read before they
  tap Start. This moves Premium's step 2 from Stage 3 into Stage 1.
  *How I applied it:* the owner's words name the coaches portal sign-up and pointed at step 2; I drew step 1 the same
  way, because a person on step 1 has also already tapped a start button. Say if step 1 should keep any of it.
- **The asks, ruled 2026-10-19 (owner, the hub's paste-back), every one as recommended.** The reasoning for each is in
  *Shape questions* below; what was ruled:
  - **Ask 1:** this project takes The public face's S2 whole plus the verification and password-reset emails, and
    builds the warm email envelope once. The public face keeps marketing (S4), the other emails (S3, moved onto this
    envelope) and system screens (S5), and gets the type rules for its S1.
  - **Ask 2:** one account form at every door. Registration keeps its email-first step on the same fields;
    invitations drop the email they already know. *The pasted pick still carried the option's earlier wording
    ("Premium keeps its sales column beside it on a computer"), written before R1 and rewritten after it; R1 is the
    later and explicit word, so Coach Premium follows R1. Flagged to the owner the same day.*
  - **Ask 3:** sentence case, the display face at 32px, "Create account" on every step 1; rules written for `/design`
    and `/marketing`; **no build guard**.
  - **Ask 4:** the tournament first run's plan step offers two choices, Tournament and Tournament Plus, with one
    heading and both buttons in view. League Plus and Club come off this step and get their own doors and their own
    pricing buttons when they open.
  - **Ask 5a:** the coach join page is rebuilt on the shared form, in the app's frame, keeping every registration
    state. **Ask 5b:** checkout complete folds into the welcome card as its "Setting up your portal" state.
  - **Ask 6:** Run a tournament's intro folds into step 1. The form shows at once, both steps live at one address,
    and old links forward with their plan.
  - **Ask 7:** the claim link is parked outside this project; whether it should be reachable goes to `/strategy`.
  - **Ask 8:** as drawn. An expired, used or broken link opens sign-in with a notice and "Email me a new link". The
    Continue page and the email say "Confirm your email" / "Confirm my email", and the email names the door's next step.
  - **Ask 9:** a fan's empty Home gets one line opening the start page.
  - **Ask 10:** the whole first run follows Warm / Dark. A newcomer has no setting, so they see warm.
  - **Ask 11:** Account-First Sign-up closes now; its plan and brief are archived with a pointer here.
  - **Ask 12:** the 32px first-run heading is written into the type ladder as a **named exception**: a first-run page
    heading, one per screen, with no back arrow.
  - **Ask 13:** the consumer top bar and phone tabs go to sentence case, like the coach and admin bars, for every
    visitor and fan. "Get started ▾" replaces "Run a tournament ▾".

## Inherited from Account-First (open owner calls, carried here when it closed)

- **How "first plan choice" is read** (Founding Season ruling (c)). The build reads it as **the first-run choice**:
  while the plan step is still editable, Tournament Plus stays $0 for an organization that holds the comp. A strict
  first-click reading needs a server-side record of that first choice, which is a schema change. Detail is in the
  archived plan's *As built, Part 2*. This project redraws that step (Ask 4), so the call was due before Stage 3 is
  built. **SETTLED 2026-10-20 (owner): keep the as-built reading** — the owner called it a niche case with a low chance of
  happening and asked for whatever is easiest, so no schema change; Stage 3 builds on the first-run reading.
- **The production organization from a sign-up that never confirmed** (one, made 2026-08-29: free plan, no
  tournaments, holds a Founding comp). Whether to clean it up is a separate owner call; the probe is read-only.

## Shape questions (each with a recommendation, all ruled as recommended 2026-10-19)

- **Ask 1 — The boundary with The public face, warm.** *Recommended:* this project takes **S2 whole** (`/auth/*`, the
  check-your-email block, `/coaches/join`, checkout complete, the consumer bar) **plus the two account emails**
  (verification and password reset), because they are first-look stations; it builds the **warm email envelope** once,
  for those two, and The public face's S3 moves the other ~44 builders onto it. The public type rules (above) go to
  its S1. It keeps marketing (S4) and system screens (S5). *Rides on it:* building the envelope here means S3 is a
  migration, not a design.
- **Ask 2 — One account form for every door.** *Recommended:* yes. Coach Premium is settled by R1. Registration keeps
  its email-first step and uses the same fields. Invitations drop the email field (they know it).
- **Ask 3 — One heading style and one button wording, written as rules.** *Recommended:* the rules above; sentence
  case everywhere ("Create account", reversing D7's split — its reason was each form's own case, which this replaces).
  A build guard over the first-run screens' headings and buttons, like the spelling gate, **only if you want one**.
- **Ask 4 — The plan step for a first run.** *Recommended:* re-frame it. A tournament organization's first run chooses
  between **the two plans this door sells**: Tournament (free) and Tournament Plus (Founding Season $0). Two short
  choice rows, three differences each, both buttons in view on a laptop and a phone; "Compare every plan" opens the
  pricing page in a new tab; the plan picked on the pricing page is preselected and says so. League Plus and Club are
  **not on this step** — when they open they get their own doors (`/start/league`, a club door), and their pricing
  buttons point there (F08). One heading, said once: "How do you want to start?"
- **Ask 5 — The join page and checkout complete.** *Recommended:* rebuild the join page on the shared start form,
  in the consumer shell, keeping all its registration states (Registration submitted, already set up, signed in as
  someone else, choose a team profile). Fold checkout complete into the welcome card (one card, a "Setting up your
  portal" state), so a paid coach and a Founding Season coach see the same screen.
- **Ask 6 — Run a tournament's intro page.** *Recommended:* fold it into step 1. `/start/tournament` shows the account
  form at once, headed "Run a tournament", with the intro's promise as its one sub line; both steps live at
  `/start/tournament`, like team and league. `/auth/signup` forwards there (with its plan) so old links keep working.
- **Ask 7 — The claim link.** *Recommended:* **park it**, outside this project. Whether an organizer can send a claim is
  a product and selling call (`/strategy`), not a look. Its card already shares the Premium form, so Stage 1 restyles it
  for free.
- **Ask 8 — The expired link and the wait.** *Recommended:* an expired, used or broken link lands on sign-in with a
  plain notice at the top — "That link has expired or was already used. Sign in, or send yourself a new one." — with
  the email field and **Send a new link** beside it; a valid Continue page reads "Confirm your email" / "Confirm my
  email" in the house type. The email says what comes next for its door ("Then you'll name your team").
- **Ask 9 — A fan's way to start something.** *Recommended:* here, small: one line under Home's empty state, "Want to
  run your own? Start a team or a tournament", opening `/start`. No card.
- **Ask 10 — Warm / Dark on the first run.** *Recommended:* the whole first run **follows the setting**, like sign-in
  does today; a newcomer has no setting, so they see warm. Same answer as The public face's Q4, so the two agree.
  *Rides on it:* the start forms have never been drawn dark; Stage 1 draws them.
- **Ask 12 — How big is a first-run heading?** (from `/design` D-F1). The drawings use the ladder's 32px display
  step; the ladder keeps it for a number read across a room ("a title is a title however large it grew", 2026-08-28),
  and the portal's title step is 20px. *Recommended:* 32px as a **written ladder exception** for a first-run page
  heading (one per screen, no back arrow, one job), because a sign-up screen is not a working page. *Alternative:* the
  portal's 20px, which frees about 40px of fold.
- **Ask 13 — The consumer top bar and phone tabs** (from `/design` D-F2). Sentence case there reaches every fan, not
  only the first run; the 2026-09-27 ruling covered only the coach and admin bars. *Recommended:* sentence case, like
  those bars, with "Get started ▾" replacing "Run a tournament ▾". The 2026-08-01 top-bar rule (one label size, one
  30px pill) holds either way.
- **Ask 11 — Account-First can close.** *Recommended:* yes, once you accept this project as the owner of its owed
  review. Its plan and brief move to the archive with a pointer here.

## Stage ladder (the walk decides it; each stage is drawn as its end state and ruled before build)

| Stage | Covers | Asks | State |
|---|---|---|---|
| **1 — One account step** | The rules; the account form at every door (team, league, tournament with the intro folded in, account-only, both Coach Premium steps (R1), the join page, both invitations); step 2 naming; the one check-your-email; the door links (F14) | 1, 2, 3, 5 (join), 6, 10, 12, 13 | **Built 2026-10-20** (1a `f45f7d019`, 1b `df295fdc6`, 1c `658cb84e5`, 1d see *As built, Stage 1*); owner walk §348 |
| **2 — The wait and the way back** | The verification and password-reset emails on the warm envelope; the Continue page; the expired / invalid link; sign-in (waiting account, wrong password); forgot / reset | 1, 8 | Drawn + ruled 2026-10-19; build prompt written 2026-10-20 (`FIRST_LOOK_STAGE2_BUILD_PROMPT.md`); its eight undrawn states (U1–U8) drawn 2026-10-20, after `/design`, at https://claude.ai/artifact/353241emo2NHrP1m6tPyjQ, **all eight ruled 2026-10-20 as recommended**; **Built 2026-10-20** (2a `d1a5742c2`, 2b `04c0ea1c2`, 2c `5cc4b3227`); owner walk §351 https://claude.ai/artifact/Gw7a23Ud1FRXoGevpHbvr7 **PASSED 2026-10-20** (41 of 42, the call: full ink everywhere); the two emails then lost their beige frame (owed: a fresh email seen in the three mail apps) |
| **3 — The first screen inside** | The plan step (two choices, in view); the welcome card with checkout complete folded in; Home's fan line; the pricing buttons' doors (F08) | 4, 5 (checkout), 9 | Drawn + ruled 2026-10-19; the "first plan choice" call settled 2026-10-20 (as built); **gate G1–G6 drawn after `/design` at https://claude.ai/artifact/CtzAZMhmvnJZQxMTtn5xjj and all six ruled 2026-10-20 as recommended** (see *Stage 3 gate* below); build prompt rewritten 2026-10-20 with the rulings in (`FIRST_LOOK_STAGE3_BUILD_PROMPT.md`); **Built 2026-10-20** (`dc3735034`, 3a–3c in one commit); owner walk §355 https://claude.ai/artifact/BibiAY5Yt5GkutCfpW3WU9 |
| **4 — Not yet** | The free team's first home (F16: belongs to the free coach portal's tap-target work, `FREE_COACH_TAP_TARGETS_PROMPT.md`, handed there); a league's first season and the club setup kit (neither on sale); the claim link (Ask 7) | 7 | Reported, not drawn; claim link parked (Ask 7) |

The end state of stages 1–3 is drawn on the hub in one round, each changed part tagged with its stage; the build
order stays in this ladder (Stage 1 first: it sets the shared form every later stage uses).

### Stage 3 gate (ruled 2026-10-20, owner, all as recommended)

Drawn against DEV after the `/design` pass (its ten drawing fixes applied):
https://claude.ai/artifact/CtzAZMhmvnJZQxMTtn5xjj.

- **G1 — the welcome for a paid coach.** Both coaches get the same first line ("Premium is on for {team}"). The
  Founding sentence shows only when the team **holds the comp, read from its record, not the calendar**. A paid coach
  gets no second sentence. (Found at the gate: today the welcome decides by the sign-up window, so a coach who
  qualifies after the close, edge (b), loses the sentence.)
- **G2 — the wait after paying.** Three cards: *Setting up your portal* ("Payment received. This takes a few
  seconds.", the one loading line, no button); *Still setting up your portal* after the ~50 s poll ("Payment received.
  We'll email you a link the moment it's ready, so you can close this page.", lime **Check again**); *We can't find
  that payment*, shown **at once** when the link carries no payment or one Stripe does not know ("If you've just paid,
  your portal link is on its way to your email.", lime **Go to Home**). When the portal is ready the card **turns into
  the paid welcome** (G1) and the waiting line drops "we'll take you straight in". "Open your team" keeps the portal's
  `?success=1` hand-off.
- **G3 — the plan step's frame.** Build the drawn page in the admin's bare first-run frame (no top bar, as today).
  Moving the plan step into the app's frame is a later call. Two up on a laptop is a named exception to rule 1, forced
  by rule 6 (two up from 900px wide, the 420px column below).
- **G4 — the pricing pick.** Carry the free Tournament pick from the pricing page too (step 1's sentence says
  "Tournament (free)", no billing period). The plan step's sub line names the pick ("You picked … on the pricing page.
  You can change it here, or any time in Plan & billing."). With no pick it keeps the drawn line, and Tournament Plus
  comes first.
- **G5 — Tournament Plus without the Founding offer.** The price follows the billing choice; the choice drops "Then";
  annual carries the pricing page's own savings line.
- **G6 — League Plus and Club's pricing buttons.** A guard, not a build: a test that fails when a plan other than
  Tournament or Tournament Plus points its start button at the tournament door. Its own door comes the day it opens.

## As built, Stage 1 (2026-10-19 → 2026-10-20)

| Part | What | Commit |
|---|---|---|
| 1a | The shared pieces (`components/auth/AccountForm`, `StartSteps`, `VerifyEmailSent`) + Start a team, Start a league season, Run a tournament (intro folded in; `/auth/signup` forwards in `next.config.ts`), step 2, the one check-your-email | `f45f7d019` |
| 1b | Coach Premium, both steps (R1), one column for new / claim / upgrade / reactivation; the two-option control (`components/shared/ChoicePair`) | `df295fdc6` |
| 1c | The account-only sign-up, both invitations, the coach join page in the app's frame | `658cb84e5` |
| 1d | The top bar and phone tabs in sentence case, "Get started ▾"; the one coach rule; the door links; Warm / Dark | `5ca0b8242` |

**Owner walk:** §348, https://claude.ai/artifact/RtyhSgLER7LmhxtvAsFFCC (source `FIRST_LOOK_STAGE1_WALK.html`): seven
walks of one job each, plus Part C, the open calls.

**1d, as built.**
- **The one coach rule** is `coachStartDoor()` / `coachStartHref()` in `lib/start-menu.ts` (premium / free / gated).
  `/start`'s card takes its words and link from the same decision; the menu reads it through `getStartMenuConfig()`;
  the coach demo through the org layout (`app/[orgSlug]/layout.tsx` → `SandboxChrome startHref`). The unread
  `?source=start` tag is gone.
- **The demo's start buttons are plain links, not client-side ones** (/review 2026-10-20). Leaving the demo ends the
  demo in the proxy only on a full page load. A soft navigation would render Coach Premium's step 2 signed in as the
  shared demo account, one tap from making a team on it. (The old `/auth/signup` button had the same gap, reaching
  "Create organization".) Pinned in `demo-sandbox-exit.test.ts`.
- **The door links** go to `/start/tournament`; the Tournament Plus buttons on `/for-tournament-organizers` **and the
  pricing page's Tournament → Tournament Plus bridge** carry `?plan=tournament_plus&billing=monthly` (the bridge
  dropped its plan too; same rule). Only comments, `account=1` links, the API and the expired-link screen still name
  `/auth/signup`.
- **The bar** is the body face in sentence case at T1's size and weight (one 30px pill). **The tournament pages' slim
  strip keeps the typewriter capitals, its Get started menu included**, until The public face, warm moves the public
  bars' whole idiom at once (Admin type sweep P1, owner 2026-10-19; `.topbarStrip` exception, marked for deletion).
  The phone tabs are sentence case everywhere they show.
- **Warm / Dark:** the start column, the `/start` chooser and waitlists, the Premium welcome and the gated Premium
  interest page all wear `.warmTab`. The bar follows (`…WarmTab` markers retired: every warm bar now follows the
  setting), as do the browser-bar tint and the page base (`data-warm-base="always"` retired). **Departure from the 1d
  prompt:** the prompt said leave the gated Premium page warm. Its own stylesheet says it was warmed *to match the
  bar*, so a pinned page under a dark bar would rebuild the seam it was made to remove; it follows, its content
  untouched.
- **The dark field edge (D-F10)** is a new warm-palette token, `--home-field-edge` (Warm = `--home-line-strong`, Dark
  = `--white-40`, about 3.8:1; the drawing's `#646b77` is 3.4:1). Fields, the secondary button, the sent-again box,
  ChoicePair and the gated page's field use it; decorative hairlines stay quiet. Not `--white-35`: the start column
  re-points that token for its loading line. `--home-fill` gained its dark value in the shared dark set.

**Deliberate departures from the drawings (1a–1c).** Run a tournament's step 2 sub is "Free to start." (step 1's
"…You'll name your organization next." would be wrong on the step that names it). Step 2 drops its small print, except
Start a league season, which keeps its limits line (people land there from the email, often on another device). The
tournament intro's "← Back to all options" is gone. Premium: no Portal URL preview; a reactivating coach has no
"Create account" foot link; Create team is always tappable and says why it cannot go (no name, wrong account). The club
invitation's name fields lost the 60-character typing limit (the server trims to 60).

**Owner calls (walk §348 Part C) — RULED 2026-10-20, all four as recommended:** The join page's sub cannot name the team and the tournament (signed out it
knows only the registration and the email; *rec:* keep the plain line). The foot links are bold olive with no
underline, as drawn (WCAG 1.4.1 prefers one: a `/design` call). Fainter-than-3:1 field edges outside this stage
(Discover's search and filter in Dark; every field in Warm, about 1.4:1) (*rec:* The public face, warm). The footer's
"Coaches" link opens Coach Premium directly.

**For `/marketing`** (sentences the rulings did not fix word for word): the account-only sub ("Your teams, scores and
alerts in one place."); the join page's subs; "Create account and join"; Premium's reactivation sub; the menu's Coach a
team line ("A free team home for your season — no organization needed.", now leading to Premium while the Founding
Season runs).

**/marketing pass on those sentences, 2026-10-20: no change needed.** "Your teams, scores and alerts in one place.", the join page's subs, "Create account and join" and the reactivation sub ("Restore your team workspace instead of starting a new one.") are in voice and say what happens. Two small notes, neither made: (1) the menu's Coach a team line ("A free team home for your season — no organization needed.") is true while the door opens Coach Premium (free through the Founding Season) and for the free Basic door, but would promise "free" in front of the gated "Coming soon" page; it is one fixed string for three doors, so a menu that takes its words from the one coach rule (as /start's card does) is the cleaner end state, an owner call; (2) the two invitation buttons load differently ("Joining…" on the club invitation, "Setting up…" on the assistant-coach invitation); one word is tidier.

**Owed.** The whole-product layout sweep (1d touches the shared bar and the palette; the dev-server run widened to
every screen and aborted on memory, 2026-10-20) on staging at the next promote (`/release` §1d-5). The email round trip,
"Check your email" and a live invitation on staging. The screen-reader pass on the shared form (line below). `/docs`:
help quotes "Create Team", Premium's "Create / Sign in", "Run a Tournament" on the strip, and "Sign In" for the phone
bar.

## As built, Stage 2 (2026-10-20 →)

Built from `FIRST_LOOK_STAGE2_BUILD_PROMPT.md`, in three parts (2a, 2b, 2c), each committed alone.

**Owner calls answered at the gate, 2026-10-20 (all three as recommended).** (1) The league door's sentence is "Then
you'll name your league." (step 2 asks only for the name). (2) The confirmation email says "The link works for 1 hour."
in a small line under its button. (3) An account made alone reads "Then you'll land on your Home page." only when its
link returns to Home (`/discover`, or `/home`, which redirects there); a link that returns anywhere else (a tournament
the fan followed, an invitation, a team claim) reads "Then you're in." `/marketing`'s Home-page sentence was untrue for
those people, because the account-only sign-up carries their `next`.

**2a — the warm envelope and the two emails.**
- **The envelope is a module of its own** (`lib/email-envelope-warm.ts`), not a change to `wrap()`, which every other
  email still wears. It sits beside `wrap()` and not inside `lib/email.ts` because the template editor's live preview
  (a client component) renders it too. Moving the other emails onto it is The public face's S3.
- It is a whole document, so its head can ask mail apps for light only and tighten the padding on a phone (U8). Both
  are progressive: the inline styles alone are the full design. That one phone rule needs a class hook, a deliberate
  exception to "no CSS classes". The 600px Outlook table and the button drawn in a table cell are both for Outlook's
  desktop app. The plain-text part now drops the head (it never had one before, so no other email changes).
- **The next step** (`lib/verification-next-step.ts`) is chosen from facts the senders already hold: the account's
  start door, else a registration (the tournament registration's sign-up and resend say so; the join page's return
  carries its `registrationId`), else Home or onward by where the link returns. The typed team no longer reaches the
  built-in email, and `continueName` is a template variable only (Coach Premium passes a fixed "your Coaches Portal",
  which must never make a team claim read as a registration; `/simplify` caught that).
- Which templates wear the envelope is one decision (`emailLookFor`), asked by the send, the preview, the editor and
  test-send; the renderer requires the key, so a new caller cannot quietly render an account email dark.
- **A customised template wears the envelope on every path:** the send (`renderResolvedEmail`), the preview route
  (`renderTemplateEmail`), test-send (with a note readable on the white card) and the editor's live preview. The
  markup renderer gained a `warm` look (ink on the card, the envelope's button). The `house` look is the default and
  its output is unchanged, byte for byte (pinned).
- **Subject** "Confirm your FieldLogicHQ email". ⚠ **Kept apart on purpose, not fixed here:** the template rows' seed
  words (mig 083) still say "Verify your email — FieldLogicHQ" / "Verify Your Email" / "Verify Email", and the seed body
  says "continue setting up {{orgName}}" while the sender fills `orgName` with "your account". They show only in the
  platform admin's editor and only reach a customer once someone saves a customisation. Bringing the seed in step with
  the built-in email is a data migration, owed when The public face's S3 moves the templates (or sooner on the
  owner's word).
- **For The public face's S3 (moving the other emails onto the envelope):** the marketing transport keeps its own copy
  of the plain-text conversion (`lib/email-sender.ts`), which does not drop a head yet; and the campaign preview route
  (`/api/admin/email/preview`) drops server HTML straight into the admin page, so a warm document there would carry its
  head's style into the page. Neither is reachable by the two account emails today. The envelope is table cells, not
  divs, because Outlook's desktop app drops a div's padding (`/review`, 2026-10-20).
- Coach Premium's email now greets by first name (the sign-up collects it; it was simply not passed before).
- **Findings, not fixed:** the assistant-coach invitation page sends no `next` to the coach sign-up, so an invited
  person who signs up with a different address than the invitation's gets a link that lands on `/coaches` with no
  invitation to accept. It is an existing gap, separate from the email's words.
- **Owed for 2a:** the real-inbox check (Gmail, Apple Mail and Outlook, light and dark, phone) through the platform
  admin's test-send, plus a customised copy of each template sent and then removed. Localhost has no mail key, so
  this runs on staging. The renders from the real builders at 600 and 390, light and dark, are in
  `.probe/first-look/out-2a/` (`cap-stage2a.mjs`).

**2b — sign-in and the way back into it.**
- **Sign-in is the one account step** (F04): the start column, `EmailField` / `PasswordField purpose="current"`, the
  48px lime button, one foot link, the product's one loading line ("Loading sign-in…", "Signing in…"). The ids the UAT
  scenarios sign in with are kept, as are the `next` handling, the 10-second loop breaker and the demo account's local
  sign-out (pinned in `tests/unit/first-look-stage2b-signin.test.ts`).
- **The notices** are the kit's (`AccountForm.module.css` `.notice` / `.noticeWarn` / `.noticeError` / `.noticeSent`):
  the callout with a bold 16px title line. Olive when nothing went wrong, amber (`--home-notice-amber`, a new warm token,
  `var(--warning)` in Dark) for a wait or a nobody's-fault refusal, red composing the kit's `.error` for the wrong
  password. Each variant lists `callout` itself: Turbopack's `composes` is not transitive, and the first build drew no
  box at all (caught on the captures).
- **Why the person is there** rides on the URL (`SIGN_IN_REASON` in `lib/auth-errors.ts`): `reason=expired-link` from
  the callback, `reason=account-exists` from the three sign-ups that hand a 409 to sign-in (`accountExistsSignInHref`:
  Start a team / league / tournament, the coach join page, the assistant-coach invitation). A plain redirect has none.
- **The callback's fall-through** (F09): every success path is byte for byte as it was. A backed-out sign-in
  (`error=access_denied`, no code) keeps the plain sign-in; an organization invitation's failed link goes to its own
  expired screen (owner, at the 2b review: sign-in's "new link" would be a confirmation email, or nothing); everything
  else (expired, used, a code that will not exchange, no code) lands on the expired-link notice with where the link
  was headed, so the new link and its email's next-step sentence land in the same place.
- **"Email me a new link"** is `ResendLink` (one send, one limit, one cooldown), with a label, the U7 sent notice and an
  empty-field check; keyed on the address, so a corrected address can send at once.
- **Owner calls at the 2b gate (all as recommended):** "Get started" keeps the destination (the plain account sign-up
  carrying it, else `/start`); the coach deep-link lines are dropped; the undrawn failures (too many attempts, slow
  connection, service unreachable) are amber in their own sentence; the Forgot row is hidden for a waiting account.
- **Fixed on the way, inside the screen's own refusals:** Supabase's rate-limit code (`over_request_rate_limit`) showed
  raw on sign-in; `signIn` now returns `too_many_requests` for it, which every sign-in screen already words.
- **The shared map's two lines say "confirm"**, not "verify" (tournament registration can show the waiting one).
- **The 17 UAT specs** that filled the password by `getByLabel(/password/i)` now ask for the exact label: the shared
  eye button is named "Show password", which the loose pattern also matched.
- **Layout sweep:** four anonymous sign-in entries (plain, expired link, the hand-off, the wrong password with the
  password grant answered by the runner). Their only finding is the app bar's FieldLogicHQ home link, 27px tall on a
  phone: shared chrome, every consumer page, not 2b's; reported, not baselined. The waiting account is not in the sweep
  (it needs an unconfirmed account; localhost has confirmation off): the Stage 2 walk reaches it on staging.
- **Departures from the drawing:** the password field has no placeholder ("Your password" was drawn); the shared field
  carries none at any door. The Dark edges use the shell's own lime, amber and red rather than the drawing's three
  approximations.
- **Findings, not fixed:** the team sign-up (`app/team`) and the platform-admin sign-in keep their own copies of the old
  words ("Incorrect email or password", "Please verify…"); the account-only sign-up shows a sign-in failure's raw code
  (pre-existing); the UAT scenarios each carry their own sign-in steps (a shared helper would stop the next markup
  change touching 17 files); help (`coaches.tsx` ~L219–227, `tournaments.tsx` ~L724–729, `platform-admin.tsx`
  ~L122–124) still says the resend sits "in" the message and that sign-in says "verify" — `/docs` after 2c;
  `.claude/commands/helpdesk.md` matches the old error text.

**2c — the Continue page, forgot and reset.**
- **All four screens are the one account step** (`StartColumn` / `StartHead` / `EmailField` / `PasswordField`, the 48px
  lime, `StartFoot`, the one loading line: "Loading confirmation…", "Loading password reset…"), in the Reset screens
  row's words. Only `suspended` still imports `auth.module.css`; the form, field, eye, error-box and foot-link rules
  went, and with them the warm lime-button and skeleton re-pins and two token remaps nothing read any more. The file
  and `.authSurface` stay (the layout's).
- **A link that cannot be used has no screen of its own** (U3, U4): the Continue page's broken or missing link
  `router.replace`s to sign-in's expired-link notice (`expiredLinkSignInHref(null)`: the link carries no destination of
  its own); the tap page's broken link and reset-password's expired, used or missing one go to the forgot screen with
  the same notice (`expiredResetLinkHref`, new in `lib/auth-errors.ts`, both built on one private helper), keeping the
  registration a reset started from (from the URL on the tap page, from the tab's note on reset-password, which clears
  the note: the forgot screen's address carries it and the next tap page notes it again).
- **Kept exactly:** `verifyLink()` and `authActionLink()`, the tap-only navigation on both one-tap pages, the
  return-path stamp, the destination after a saved password (platform admin first, then the registration, then the
  resolver), the always-`{ok:true}` forgot route. Pinned in `tests/unit/first-look-stage2c-reset.test.ts`.
- **Owner calls at the 2c gate (all as recommended):** (1) the sent screen keeps "Once you set a new password, you'll
  come back to your registration." for the coach who started from one, and only for them; (2) the forgot page's
  coach note ("Registered a team for a tournament?…") is dropped, like sign-in's coach lines at 2b; (3) the undrawn
  failures take 2b's rule, amber and one sentence: a save the provider refuses in plain words (the current password,
  a weak one, too many tries, anything else "We couldn't save your password."), a reset whose session is gone goes to
  the forgot screen's notice, and a forgot send that did not happen says "We couldn't send the link." rather than
  "Check your email" (it used to hang on "Sending…").
- **Departures and small decisions:** the new-password field has no placeholder ("Your new password" was drawn), as at
  2b; the cursor starts in the forgot field except under the expired notice (a screen reader would start below the
  sentence that says why the person is there); the email field is held while sending; reset-password's fifth state
  (`error`) was declared and never set, and is removed rather than kept as a state that would now render an endless
  loading line; the kit gained `PasswordField`'s `label` / `autoFocus`, `.sub strong` (bold ink), `.focusBlock` and one
  rule so a foot straight under the heading shares its line. ⚠ `.sub strong` also reaches two existing screens (the
  join page's and the assistant-coach invitation's "You're signed in as a different account"): the walk's Part C asks.
- **Hardened at `/review`:** a failed PKCE code exchange asks for the session before calling the link expired (the
  client may have exchanged the code itself; "expired" now leaves the page, where it used to heal on
  `PASSWORD_RECOVERY`). Today's emails never take that path: both reset senders use `admin.generateLink`, which returns
  hash tokens.
- **Layout sweep:** six anonymous entries (the Continue page, its broken link, forgot, forgot sent, the tap page, its
  broken link), clean at every width but for the known 27px app-bar link. Choose a new password is not in the sweep
  (it needs a recovery session); the captures (`.probe/first-look/cap-stage2c.mjs`, phone + laptop, Warm + Dark) reach
  it with browser-answered auth calls.
- **Findings, not fixed:** the forgot route has no rate limit (and an existing account answers slower, because the
  send is awaited: a timing side channel); `SIGN_IN_REASON` now names a reason the forgot screen also reads (a rename
  touches 2b's sign-in page and test); the reset's 1.5-second hop to the account has no cancel (pre-existing).
- **Three of those findings fixed after the commit (owner, 2026-10-20, "fix those 3 items"):** (1) forgot password has
  "Send the link again"'s budget (three per address an hour, ten per network in 15 minutes, a ceiling); past it the
  page says "Too many tries." in the amber notice, not "check your connection"; and both no-tell routes answer their
  200 no sooner than a 2-second floor (`lib/no-tell-floor.ts`), so a found account is no slower (the resend route had
  the same leak; sending after the answer is not possible on Amplify). Every reset request now takes about 2 seconds.
  (2) Every password sign-in screen (sign-in, tournament registration, the team sign-up, the platform-admin sign-in, the
  account-only sign-up) words a failure through `signInErrorCopy` in `lib/auth-errors.ts`: the shared map, a screen's
  override, else "Sign-in didn't work. Try again in a moment.", never a raw code; the team sign-up's and platform admin's
  own copies are gone. (3) The helpdesk agent's command file quotes the new words. Pinned in
  `tests/unit/sign-in-words-and-no-tell-guard.test.ts`.

## As built, Stage 3 (2026-10-20)

| Part | What | Commit |
|---|---|---|
| 3a | The plan step (`PlanStep`: two choices, the pick named, two up from 900px), the free pick carried (G4), one $0 rule (`showsFoundingZero`, G5), the G6 guard | `dc3735034` |
| 3b | One card (`CoachWelcomeCard`) for the welcome and checkout complete; the comp read from the workspace's record (G1); the three waiting cards and the ready welcome (G2) | `dc3735034` |
| 3c | A fan's empty Home: the line to /start | `dc3735034` |

One commit for all three, because they share the plan settings, the coach sign-up and the test file. Built after `/marketing` (no change; one point to the owner), `/simplify` and `/review` (four lenses).

**Owner walk:** §355, https://claude.ai/artifact/BibiAY5Yt5GkutCfpW3WU9 (source `FIRST_LOOK_STAGE3_WALK.html`): nine walks of one job each, W4, W5 and W8 staging-only, plus Part C (the "Fees" bullet). **PASSED 2026-10-21** (44 of 45; Part C: keep "Fees, check-in and volunteers"). The walk caught one build defect: the welcome card and checkout complete read `accountForm` from a client module in a server component, so they rendered unstyled; fixed by importing the stylesheet directly.

**The pieces a later stage reuses.**
- `lib/start-door.ts`: `StartPricing` is a union (only a paid pick carries billing); `'tournament'` is a start plan; `withStartPricing()` for every link that carries the pick; `runATournamentPick()` is the one "this door can sell it" test (step 1's callout and the plan step); `RUN_A_TOURNAMENT_STEPS`.
- `lib/plan-config.ts`: `showsFoundingZero()` (the one $0 rule), `pickedPlanLabel()` ("Tournament (free)" / "…, billed annually"), `formatPlanPeriodPrice()` ("$39/month"), `FOUNDING_SEASON_DECISION_MONTH_NAME`.
- `lib/founding-season.ts`: `workspaceHoldsFoundingComp()` reads the comp row (`liveFoundingCompRow`, shared with `foundingSeasonOfferOnPlanChoice`) and fails closed.
- `components/consumer/CoachWelcomeCard.tsx`: `CoachWelcomeCard`, `PremiumWelcome`, `WaitLine`.
- `/coaches/checkout` is on the warm journey (`WARM_JOURNEY_PREFIXES`) with its own `CoachJourneyChrome` layout.
- The admin's focused frame names its padding (`--admin-focused-pad`), so a focused page can paint edge to edge.

**Deliberate departures and calls made in the build.**
- The plan step is its own component rather than the marketing cards (the prompt's recommended build). The change-plan window keeps `PricingSection`, whose unused compact mode was deleted.
- The waiting line composes LoadingState's dot but is not `<LoadingState>`: that line's label must read "Loading …" for the layout sweep to wait it out, and this is a wait of up to ~50 seconds the sweep should photograph.
- The coach sign-up routes to the welcome on the server's `comped` answer, not the sign-up window, so edge (b) gets it too.
- From `/review`: the free choice shows "Starting…" and reports a failure (it did neither); a completed checkout whose money is still clearing waits instead of "can't find"; an id Stripe refuses is "can't find"; step 1 names only picks this door can sell; "Go to Home" opens Home (`/discover`) like the portal's other walls.
- Noted, not built (all Low): the welcome tells anyone who knows a team's address whether it holds the comp; checkout complete shows the team name to whoever holds the session id; the $0 can show the list price for a moment after the window closes while the offer answer loads; the buttons wake again as Stripe opens (holding them would trap the Back button).

**Owed.** The whole-product layout sweep on staging (the admin stylesheet change widens `--changed` to it; the fixture sessions had expired). Layout entries for the plan step (it needs a fresh tournament-plan organization fixture: an owner call before widening the UAT fixtures), the welcome and checkout complete. The G6 guard reads the code only: a plan opened at runtime by the `plan_gating` table (or the dev cookie / env switch, `lib/plan-gating-server.ts`) is not seen by any unit test; opening one is `/billing`'s release checklist. `/docs`.

## /design review of the drawings (2026-10-19)

Run before hand-off; its changes are in the drawings and listed on the hub's Your answers tab. D-F1 and D-F2 became
Asks 12 and 13. Applied: D-F3 the billing choice 44px / 14px with a check on the picked option (one control shared
with the pricing page's toggle); D-F4 the password rule as a hint line, not a placeholder; D-F5 the step line kept
uppercase as D2's named exception, finished steps at full strength; D-F6 Premium step 2 says "Create team"; D-F7
48px buttons in the plan cards and the phone tab bar drawn where it really sits; D-F8 notices at 14px; D-F9 a waiting
account's notice amber, red kept for a wrong password; D-F10 Dark field borders to about 3.4:1; D-F11 the email's
wordmark in a mail-safe face, an olive edge on its lime button. Plan rule 2's 32px heading stands only if Ask 12 is
ruled as recommended.

## Notes for the build (when ruled)

- **Shared pieces, not page CSS.** The account form, the step line, the check-your-email block and the start column
  become one set of components with one module; `auth.module.css`, `join.module.css` and `app/team/page.module.css`
  stop carrying their own field, label and button styles. A new `*.module.css` needs a token scope (staging build 346).
- **Keep every behaviour Account-First built:** the remembered door, the locked Founding door, V1 (one tap creates),
  V2 (registration first), V3 (Send the link again everywhere), A4 revised (the waiting workspace card), the 409 → sign
  in with the email filled, the invited-address branch.
- **Words** go through `/marketing` before the build; the spelling and clock gates apply; help articles that quote
  these screens' wording are updated with `/docs`.
- **Demo tours** may anchor on `/start` and the sign-up; keep anchors or move them in the same change.
- **The email template** stays customisable: the warm envelope wraps the template body; the variables do not change.
- **Not walked yet, owed before Stage 2 is ruled:** the email in a real inbox (light and dark mail apps, a phone) and
  the staging round trip; a screen-reader pass on Stage 1's form.
