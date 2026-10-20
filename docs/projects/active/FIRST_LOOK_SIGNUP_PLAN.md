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
  archived plan's *As built, Part 2*. This project redraws that step (Ask 4), so the call is due before Stage 3 is
  built.
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
| **2 — The wait and the way back** | The verification and password-reset emails on the warm envelope; the Continue page; the expired / invalid link; sign-in (waiting account, wrong password); forgot / reset | 1, 8 | Drawn + ruled 2026-10-19 |
| **3 — The first screen inside** | The plan step (two choices, in view); the welcome card with checkout complete folded in; Home's fan line; the pricing buttons' doors (F08) | 4, 5 (checkout), 9 | Drawn + ruled 2026-10-19 |
| **4 — Not yet** | The free team's first home (F16: belongs to the free coach portal's tap-target work, `FREE_COACH_TAP_TARGETS_PROMPT.md`, handed there); a league's first season and the club setup kit (neither on sale); the claim link (Ask 7) | 7 | Reported, not drawn; claim link parked (Ask 7) |

The end state of stages 1–3 is drawn on the hub in one round, each changed part tagged with its stage; the build
order stays in this ladder (Stage 1 first: it sets the shared form every later stage uses).

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

**Open owner calls (walk §348 Part C).** The join page's sub cannot name the team and the tournament (signed out it
knows only the registration and the email; *rec:* keep the plain line). The foot links are bold olive with no
underline, as drawn (WCAG 1.4.1 prefers one: a `/design` call). Fainter-than-3:1 field edges outside this stage
(Discover's search and filter in Dark; every field in Warm, about 1.4:1) (*rec:* The public face, warm). The footer's
"Coaches" link opens Coach Premium directly.

**For `/marketing`** (sentences the rulings did not fix word for word): the account-only sub ("Your teams, scores and
alerts in one place."); the join page's subs; "Create account and join"; Premium's reactivation sub; the menu's Coach a
team line ("A free team home for your season — no organization needed.", now leading to Premium while the Founding
Season runs).

**Owed.** The whole-product layout sweep (1d touches the shared bar and the palette; the dev-server run widened to
every screen and aborted on memory, 2026-10-20) on staging at the next promote (`/release` §1d-5). The email round trip,
"Check your email" and a live invitation on staging. The screen-reader pass on the shared form (line below). `/docs`:
help quotes "Create Team", Premium's "Create / Sign in", "Run a Tournament" on the strip, and "Sign In" for the phone
bar.

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
