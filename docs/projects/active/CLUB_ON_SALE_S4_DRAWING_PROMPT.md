# On-sale pages S4 · Buying from inside the product (DRAWING session first, build prompt after)

> Written 2026-11-20, after S3b's walk §552 passed 38/38 and its commit. Paste into a **fresh chat on `dev`**:
> `execute @docs/projects/active/CLUB_ON_SALE_S4_DRAWING_PROMPT.md`
>
> **This is a drawing-and-ruling session, not a build session.** It changes no product code. The output is:
> - one published drawing (a Claude Artifact) of Plan & billing and its windows, **before and after**;
> - the owner's rulings on whatever is genuinely open (numbered asks, each with a recommendation);
> - then the **S4 build prompt**, written to `docs/projects/active/CLUB_ON_SALE_S4_BUILD_PROMPT.md`.
>
> Model: Opus. Helpers read on Sonnet. Run `/design` and `/ux` on the drawing before hand-off; `/marketing` on every new
> word; `/billing` on the gating; `/accounting` on what a move charges (it changes what we charge, so it runs BEFORE
> hand-off, not as an offer); `/legal` only if a drawn line adds a promise or a consent.
> **Do not overlap a Plan & billing build session** (plan §Sequencing): check the board (`plan-billing`) and `git log` for
> one in flight before you start, and say so in your first message.

## What S4 is, and why it is the last piece

S1 made the public pages follow the on-sale switch, S2 built the two doors (a Club start and a League Plus start for a
NEW organization), S3 built the open state of the pages, S3b the selling sections. **What is still missing:** a person
already inside the product (a free Tournament organization, a paying Tournament Plus one, a free-time one) has no way to
start League Plus or Club from Plan & billing. Today the only door is the public pages. S4 gives them one, and it also
unlocks the one S3b line that is true only once S4 ships.

Plan of record: `docs/projects/active/CLUB_ON_SALE_PAGES_PLAN.md`, **S4** in full (about L457), the S2 record, the S3
record, "Owner asks" (all ruled; do not re-open one), and the C1 note at the end (League Plus to Club after launch).
PM brief: `CLUB_ON_SALE_PAGES_PM_BRIEF.md`. Prices, plan names and gates: `docs/agents/strategy/PLAN_PRICING_FACTS.md`
(canonical; never restate a number, draw from the plan config and say which). Earlier drawings, for house look and the
card/pill conventions: `CLUB_ON_SALE_PAGES_DRAWINGS.html` (version 4 in the repo; the published copy is
https://claude.ai/artifact/CJ39nz8YunjGxRViXtQ3K7, and republishing it needs a full read of the live page first). Do not
edit that file in this session: S4 gets its OWN drawing.

## What S4 covers (plan L457–L480; every row is [H] until you open it)

1. **Plan & billing for a free Tournament organization:** a start for Club, Club · Association and League Plus
   (checkout), each only while its own plan is open. Today `upgradePlansFor` offers a free Tournament org Tournament
   Plus only (`lib/plan-upgrade.ts:28-30`) and the panel's plan list has no Club · Association; only Premium's
   discovery card has a button. **This is also the abandoned-checkout resume** (someone who left Stripe halfway comes
   back to a finished step).
2. **The monthly / yearly choice in the plan panel.** The panel drawer passes monthly only
   (`components/billing/PlanPanelDrawer.tsx` ~L54, ~L93).
3. **The moves ruled in Ask 12:** a paying Tournament Plus organization → League Plus (one move row). **League Plus →
   Club is NOT at launch** (nobody holds League Plus then; owner call C1 of walk §550, built after launch). The move
   rows live in `lib/plan-move-options.ts`; `/api/billing/move` has no "terms not accepted" refusal today (S2's record).
4. **A free-time organization moving to Club.** The Founding Season is gone; its three holders are ordinary free-time
   accounts. Draw that move and read its words; do NOT draw a Founding-specific sentence.
5. **A closed plan's row** keeps its contact link ("write to us", not the prospect interest form; `/billing` Q7). It
   already reads the live gate; the drawing must show the row in both gate states.
6. **The in-product chooser** (the onboarding "change plan" window keeps its four cards: plan L346).
7. **Moved here from S3b (W71):** on `/for-tournament-organizers`, the League Plus and Club cross-sells gain "Already
   running tournaments here? Start League Plus from Plan & billing. Your events, teams and staff stay where they are."
   (Club the same), each only while its own plan is open. Words are in `PRICING_PAGE_COPY.md`'s S3b section. **Prove
   first, by reading the code and by a dev probe, that a paying Tournament Plus organization can really start League
   Plus** (not only a free Tournament one); if it cannot, the line waits and the drawing says so.

## Capture first, draw second (owner rule: the real screen, at true size)

Read `memory/` feedback on drawings before you draw (the index lines under "Drawings"): the portal is the formatting
benchmark; draw a control from its SHIPPED component; money figures are one joined band; phone figures are rows; every
highlight is clickable; mockups are Claude Artifacts (HTML page, never the canvas), house layout 10-28 (sticky tabs,
Everything / Show-only-what-differs), whole-screen before/after, true size; `/design` runs on the mockup before hand-off.

- **Capture the screens as they are today** (dev, desktop and phone) with the capture scripts under `.probe/club-on-sale/`
  (they refuse non-demo paths on purpose; make a sibling script with its own guard rather than loosening one):
  Plan & billing for a free Tournament org, a paying Tournament Plus org, a free-time org, a Premium coach (to prove
  it is untouched); the plan panel drawer; the plan move window; the onboarding change-plan window. **Both gate
  states**: dev shows a plan as closed with the cookie `dev_plan_gates=closed` (Dev tools › Plan gates › "Show as closed").
  The dev server must be `npm run dev`; read `AGENTS.md` first. Name each capture as the evidence for the screen you draw.
- **Draw from the shipped components** (read `components/billing/BillingBody.tsx`, `PlanPanelDrawer.tsx`,
  `ClubUpgradeSetup.tsx`, the S2 `PaidPlanStep` and `StartPlanSetup`): S2 already built a purchase flow for a NEW
  organization. **Recommend reuse over a second flow** wherever it fits, and say plainly where it does not.
- Draw **both states** of every screen that follows the switch (plan open / plan closed), the **empty and in-between
  states** (a checkout left half-done; the wait after Stripe returns before the webhook lands; a purchase that fails),
  and **phone width**. A screen drawn only in its happy state fails the session.
- No numbers from memory: every price and trial sentence comes from the plan config helpers; the tax line follows
  the billing tax words. Use a fictional org name, never a real customer's.

## Constraints that already bind (do not re-open; each has a source)

- **Team limits count the teams given a Premium Coaches Portal**; house league teams are unlimited (`BUSINESS_DECISIONS.md`
  2026-11-19). Any card that says a team count must say what it counts.
- **No coach surface says "free"** (2026-11-19). A Premium coach's Plan & billing is out of S4's scope and must be shown
  unchanged.
- **League Plus can change to no other plan** at launch; do not draw a League Plus → Club button. League Plus's and
  Club's closed word is "Coming soon"; the status pill sits on a card's first line, on the right when the card has a small
  label on the left (owner 2026-11-19).
- **One spelling:** "installment", the clock as "8:00 a.m.", no "module" on any customer surface (S3b removed it).
- **Concurrent plan moves, terms acceptance and trap B/D from S2** (a fresh org still reads "tournament" until the
  webhook lands; terms tick needed before any paid start) apply to every start you draw. Read S2's record for the four
  traps and show each one's screen.
- **A database check or a production change is never part of this session.** Gates stay closed; the flip is the runbook's.

## Questions you must settle, out loud, each with a recommendation (they become the asks)

Do not ask what you can decide from the code or the plan. Do disagree where the plan is wrong: argue from what the code
does. Likely open, in the order they matter:
- **Where the start lives on Plan & billing** (a row per plan in the existing list, a "Compare plans" panel, the drawer
  only), and what a free-time organization sees there.
- **What a move charges and when** (a paying Tournament Plus org → League Plus: the credit for unused time, the first
  charge, the yearly vs monthly mix). `/accounting` reads the drawn sentence.
- **Yearly vs monthly in the drawer:** default, how the saving is said (the words come from the plan config, not from you).
- **The free-time organization's move to Club:** does the free time carry over, end, or stack (read the free-time rules
  in `FREE_TIME_SAME_RULES_PLAN.md` before you recommend).
- **The abandoned-checkout resume:** where it shows, how long it is offered, and what it says when Stripe's session has
  expired.
- **Whether S4 ships before the flip or just after** (the owner's 2026-11-17 ruling says marketing follows launch; S4 is
  product, so it is likely a launch item: give your recommendation and the reason, he rules it).

## Process and standing rules

- **Before any work, give the Product Manager UX summary** (what a person sees and does differently, by role) and a task
  list, per `AGENCY_RULES.md`, even though this session writes no code.
- **Mark each fact [V]** (you opened it this session, with `file:line` or the capture's name) **or [H]** (handed here,
  unverified). Everything in this prompt is [H] unless it says otherwise. A helper's summary is a lead, not evidence.
- **Delegate broad reading to helpers** (Explore for locating, general-purpose when it must run commands); read the exact
  lines a decision turns on yourself.
- Disagree out loud before the work, not in the summary. Do not manufacture disagreement.
- **Publish the drawing as an Artifact** (load `artifact-design` first; the quickstart call comes before the file). Source
  file `docs/projects/active/CLUB_ON_SALE_S4_DRAWINGS.html`, captures in `docs/projects/active/club-on-sale-s4/`. Every
  highlight is a numbered, clickable note; the last tab is "Your calls".
- Then write the asks into the plan (S4 section, numbered from 35, each with its recommendation and nothing the owner has
  not ruled), update the PM brief, and add the S4 line to the board in the SAME unit of work as the files.
- **Branch `dev`; explicit pathspecs only; no commit without the owner's word; never push.** `git status` is shared with
  other sessions: before staging a shared file (the plan, the ledger, the board), diff it and stage only your hunks.
- **Finish with** the published link, the numbered calls with your recommendations, and one line for the owner: "say
  'accept' and I write the S4 build prompt" (or write it at once if he has already ruled every call as recommended).

## The S4 build prompt (written after the owner rules)

Same shape as `CLUB_ON_SALE_S3B_BUILD_PROMPT.md`: read-first list, what changed since the asks, the drawn screens as the
build target, the proofs (a dev Stripe test-mode probe for each start and move, with teardown), the guards to add, the
reviews (`/review` high-risk, `/accounting`, `/billing`, `/design`, `/docs` since a customer flow changes), the walk
(ledger section, one purpose, 20–50 boxes with exact logins), and the owner steps. Also name the S3b line that ships with
S4 (W71) and the guard that keeps it from rendering while its plan is closed.
