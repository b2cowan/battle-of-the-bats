# The first look — an end-to-end review of how a new customer gets into FieldLogicHQ — kickoff prompt

Paste this into a fresh session. Written 2026-10-19 by the session that built Account-First Sign-up Parts 2–3, at the
owner's request: *"a full end to end review of these screens, desktop and mobile, and make sure they have an excellent,
simple, and consistent ux as it is most customers' first look into our product."*

This session **plans and draws; it writes no product code.** It ends with one hub the owner reviews and rules on.

---

## Why this exists

Account-First Sign-up (hub https://claude.ai/artifact/PY5MgHrj9kjY6tCRPi7oLx) rebuilt *what* each sign-up asks and
*when*: the account first, the team, league or organization named after the email link. Walking it (§343, 2026-10-19)
the owner found that the **look and shape** of the first run are still uneven, and asked for a review before that project
closes. Two screens prompted it, but they are symptoms. **The scope is the whole first run**, from the first button a
visitor taps on the marketing site to the first screen they land on inside the product, through every door, on a phone
and on a computer.

The bar the owner set: **excellent, simple, consistent.** For a newcomer that means:
- **Simple:** the fewest screens, fields and words between "I want this" and "I'm in", and never a wall of text or a
  button below the fold.
- **Consistent:** one account form, one heading style, one button wording, one step line, one check-your-email, one
  look — whichever door they came in by. A person who starts a free team today and a tournament next season should feel
  they are in the same product.
- **Excellent:** it reads as made for volunteer coaches and organizers, not as a terminal (owner, 2026-10-19), and every
  state — waiting, wrong, expired, already-have-an-account — tells them plainly what to do next.

---

## Read first, in this order

1. `CLAUDE.md`, `AGENTS.md`, `AGENCY_RULES.md` — one `dev` branch; explicit pathspecs; **ask before every commit, never
   push**; the spelling and clock gates (`check:spelling`); "disagree out loud"; argue from the code, not from plans.
2. **The method — read and follow:** the auto-memory `feedback_deep_dive_is_walk_then_stages` (a measured walk + a stage
   ladder + **the end state drawn, tagged by stage** — never today's look redrawn — in ONE first publish),
   `feedback_project_hub_single_artifact` (one hub per project: walk, mockup, brief, plan, later QA, as tabs),
   `feedback_mockups_as_claude_artifacts`, `feedback_always_run_design_on_mockups` (run `/design` on the drawings
   **before** handing off, not as an offer), `feedback_clickable_design_annotations`, `feedback_build_to_approved_mockups`.
3. **The formatting benchmark:** `feedback_portal_is_the_formatting_benchmark` — read the WRITTEN rules it lists
   (`docs/agents/design/TABLE_AND_LIST_STANDARD.md`, the kit, the `--type-*` ladder in `app/globals.css`), not an old
   hub's CSS. `reference_on_the_kit_is_not_current_look`: "recoloured" is not "restyled" — check the TYPE.
4. `docs/projects/active/ACCOUNT_FIRST_SIGNUP_PLAN.md` — Rulings A1–A7, *A4 revised*, *As built* Parts 1–3, and the
   section **"Owed before this project closes"** (the owner's notes from W5 and W15, recorded 2026-10-19). Its hub's
   Decisions tab holds design review D1–D17.
5. `docs/projects/active/PUBLIC_FACE_WARM_PLAN.md` + `_PM_BRIEF.md` — the queued project to bring marketing, sign-in and
   emails onto the warm look. **Its stage S2 ("Sign-in and sign-up": `/auth/*`, the check-your-inbox block,
   `/coaches/join`, checkout-complete, the consumer bar) is largely this review's ground** — see Ask 1.
6. `docs/projects/active/SIGNUP_EMAIL_VERIFICATION_HUB.html` (Verify Every Sign-up: V1–V3) and
   `docs/agents/strategy/BUSINESS_DECISIONS.md` (the Founding Season entries, the free floors, the plan names) — the
   commercial facts any plan-step proposal must respect; `docs/agents/strategy/PLAN_PRICING_FACTS.md` is canonical.
7. `docs/agents/brand/` — the brand voice canon (never "tournament management platform"; "community sport", not
   "Canadian sport"; the words a volunteer uses).

Delegate the broad reading and the route census to helpers (CLAUDE.md); read the lines a decision turns on yourself.

---

## The stations — walk them in the order a newcomer meets them

Census these from the code first (a helper can map them; re-verify the routes, this list is a starting point, not a
contract). For each: **as built** (captured on a **phone at 390 wide** and a **computer at 1440 wide**, and checked at a
laptop **1366×768** for the fold), **measured** (screens, fields and words to get in; tap targets ≥ 44px; type sizes and
faces; contrast; where the primary button sits relative to the fold), **my read** (what works, what gets in the way, what
I'd change, with clickable finding flags), and a **shape question** (Keep · Reshape · Not yet, with a recommendation).

1. **The way in:** the marketing home's calls to action, `/pricing` (each plan card's button and where it leads, with its
   `?plan=&billing=`), the four `/for-*` pages, the `/start` picker, the consumer bar's *Run a tournament*, the signed-in
   *Start* menu, a demo sandbox's *Start free*. Do they say the same thing about what happens next?
2. **The account step, every door:**
   - Start a team (`/start/team`), Start a league (`/start/league` — beta, localhost only), Run a tournament
     (`/start/tournament`'s intro page, then `/auth/signup`), the account-only sign-up (`/auth/signup?account=1`, the
     follow nudge).
   - Coach Premium (`/coaches/start` — the sales page and its card), the claim link (`/coaches/claim/<token>` — reached
     only from platform-admin Dev Tools today; see Ask 7).
   - The free coach join page an organizer's email lands on (`/coaches/join` — **still the old dark look**).
   - Tournament registration's account step (`/{org}/{t}/register` — the registration goes to the organizer first,
     V2), the assistant-coach invitation, the organization member invitation, a family claim.
3. **Waiting for the email:** the check-your-email block in each of its three settings, **the email itself** (in a real
   inbox, light and dark mail apps, on a phone), the *Continue* page it opens, **an expired or used link** (today it lands
   on sign-in with no message — a known gap), sign-in for a waiting account (Send the link again), forgot / reset
   password.
4. **Step 2, naming the thing:** the team, league and organization name steps; Coach Premium's team-sport-plan card;
   someone who is already signed in arriving at any door.
5. **The first screen inside:**
   - **The plan step** a new organization lands on (`/{org}/admin/onboarding?choosePlan=1`). Owner, W5: the old look,
     too much feature list, the heading said twice, the buttons below the fold on a laptop, and nothing highlighted when
     the plan picked on the pricing page is not on sale (League Plus) — *what should someone who came for League Plus
     see?*
   - The first tournament (the New tournament window on a first run), a league's first season, the Club setup kit.
   - A Coach Premium buyer's welcome (`/coaches/welcome`) and `/coaches/checkout/complete` (old look).
   - A free coach's first team home and its *Let's set up your team* card.
   - **Home** for a brand-new account: the waiting workspace cards (*Not named yet*, *Setup not finished*), and a fan's
     "Nothing here yet" (a fan has no way to start something — A4 revised left it out of scope; say whether it belongs
     here).
6. **Everywhere:** the consumer shell around these pages (top bar, phone tabs), the **Warm / Dark setting** (a warm
   start card on a dark sign-in ground today), every error and refusal (already has an account, too many attempts,
   wrong password, a staff address, an address with a pending invitation), and what a screen reader hears.

**Known inconsistencies to confirm or refute in the walk** (found while building Account-First; argue each from the code):
- **Three account-form designs:** the start forms, the Premium sales card, and the older sign-in look (fan sign-up,
  sign-in, forgot password, the join page).
- **Heading case:** "Create Your Team Home", "Create Your Organization", "Start Your Season" (Title Case) beside
  "Create your Coaches Portal" and "Create your account" (sentence case).
- **Button wording:** "Create Account" (start forms) vs "Create account" (Premium card) — split on purpose by design review
  D7 — and "Create Team" / "Create Organization" in Title Case.
- **Run a tournament alone has an intro page,** and its step 1 lives at a different address from its step 2.
- The check-your-email block wears three settings; the verification email still wears the old dark layout.
- After December 31 the plan step's Founding Season banner reads the window, not the account (a known neighbour).

---

## What is settled — reference, not a cage

These were ruled for their reasons; treat them as reference (auto-memory `feedback_past_decisions_are_reference_not_authority`).
If the walk shows one is wrong for the first-look goal, **say so out loud as a shape question, cite the ruling's reason,
and recommend** — never redesign around it silently.
- V1: one tap creates, never automatically. V2: a tournament registration reaches the organizer before the coach
  verifies. V3: Send the link again everywhere.
- Account-First A1–A7 and design review D1–D17, A4 revised (the waiting workspace), the Founding Season edges (a), (b), (c).
- `decision_edit_autosaves_create_asks`, `decision_disabled_btn_face` ("absent beats disabled"),
  `feedback_clickable_design_annotations`, one spelling, the house clock.
- Prices, plan names, the free floors and Founding Season dates come from `PLAN_PRICING_FACTS.md` — never restate one.

---

## Asks to bring to the owner (shape them in the walk; each with a recommendation and what rides on it)

1. **The boundary with "The public face, warm".** Its S2 covers `/auth/*`, the check-your-inbox block, `/coaches/join` and
   checkout-complete. Recommended: **this review takes S2 whole** (the same screens, reviewed once, as one journey), and
   hands the public type rules it settles to that project's S1 so marketing and email follow the same rules; that project
   keeps marketing (S4), emails (S3 — but the verification email is a first-look station here: propose which owns it) and
   system screens (S5). Confirm with the owner before drawing beyond Stage 1.
2. **One account form for every door** — or say where a door genuinely needs its own (Premium's sales page, the
   tournament registration, an invitation).
3. **One heading style and one button wording** for the first run (proposed to `/marketing` and `/design` as rules, then
   enforced like the spelling gate if the owner wants).
4. **The plan step for a first run:** what it shows, how short it can be, where the buttons sit on a laptop and a phone,
   and what someone whose pricing-page plan is not on sale sees.
5. **The coach join page** and **checkout-complete:** rebuilt onto the shared pieces, or retired into another door.
6. **Run a tournament's intro page:** keep, fold into step 1, or give every door the same intro.
7. **The claim link:** built end to end but reachable only from Dev Tools. In scope (make it reachable — an organizer
   action, or the registration emails), or parked? (Open owner question from W15.)
8. **The expired link, and the wait:** what the expired-link landing and the email itself should say and look like.
9. **A fan's way to start something** from Home — here, or later.

---

## What to deliver (one session, one first publish)

- **A new project hub** (one Artifact, its source under `docs/projects/active/`, built from a `.probe/<project>/` script
  that inlines captures; reuse `.probe/account-first/capture.mjs` and `shot-screens.mjs` patterns). Tabs: **Walk**
  (stations, as built on phone and computer with measurements, my read, shape questions), **Standing back** (the rules
  that cut across every station), **Stage ladder** (stage · covers · asks · state), **Stage 1 drawn** — the *end state*
  at true size, phone and computer, NEW / RESTYLED / UNCHANGED tags, fix chips, one checkbox per option per ask —
  **PM Brief**, **Full Plan**, and a paste-back summary. Desktop/phone toggle on the drawings.
- **`/design` runs on the drawings before the hand-off**; apply its fixes, republish, and list what it changed on the hub.
- **Files:** `docs/projects/active/FIRST_LOOK_SIGNUP_PLAN.md` + `FIRST_LOOK_SIGNUP_PM_BRIEF.md` (AGENCY_RULES: every
  significant project gets the pair), one `TODO.md` line linking them, and a line in
  `ACCOUNT_FIRST_SIGNUP_PLAN.md`'s "Owed before this project closes" section pointing here — Account-First can close
  once this project owns the review (say so as an ask if you disagree).
- **Accounts for the walk:** localhost has email verification off (step 2 opens at once); the email round trip, the
  *Continue* page and the expired link are walked on **staging**. Use the UAT fixtures (`reference_probe_signin_without_browser`,
  probes in `.probe/`), never a real customer's data, and **never write to production**.

## What not to do

- No product code, no migrations, no pushes. Commit only the plan, brief, hub source and TODO line, and only after the
  owner's OK.
- Do not redraw today's screens as the proposal; draw where they should end up.
- Do not split this into one walk per door — one journey, one hub; the stages can be per surface.
- Do not restate a price or plan name from memory; read `PLAN_PRICING_FACTS.md`.
- Do not touch another session's uncommitted work (`git status` first; this working copy is shared).

## Success looks like

A newcomer on a phone, arriving from any button on the marketing site, reaches their own team, league or organization in
the fewest screens possible; every screen on the way looks and speaks the same; nothing they need is below the fold; and
when something goes wrong — a typo, an old link, an address that already has an account — the screen says what to do in
one sentence. The owner can rule on Stage 1 from the hub alone.
