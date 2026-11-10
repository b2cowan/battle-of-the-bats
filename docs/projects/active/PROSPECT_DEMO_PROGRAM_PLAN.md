# Prospect Demo Program — a house-league admin, then his president — Implementation Plan

> **Status:** Planning
> **Created:** 2026-11-09
> **Branch:** dev
> **PM brief:** `PROSPECT_DEMO_PROGRAM_PM_BRIEF.md`
> **Walkthroughs (prep page):** "House League Demo Playbook" — https://claude.ai/artifact/EYVHAbnWZVK292AKZso31L
> (source: session scratchpad `prospect-demo-walkthroughs.html`; republish to the same URL)

## Goal

Win a real club (17 rep teams, an annual tournament, a house league run on TeamSnap — registration included) as a
**free first-year beta club**. Two demos, in order:

1. **Demo 1 — the house-league admin, signed in as himself**, in a club built from his own structure on staging. It
   proves his season is easier end to end: sign-up → money → club books, the draft, the schedule from field time, a
   rainout, delegated seats, coach scores, family email — and that the president sees the league without being sent
   spreadsheets.
2. **Demo 2 — the president**, whose question is *"how do we connect with families?"*. It needs the family gaps
   buttoned up first: phone alerts, a postponed game that says so, house-league coach posts, In / Out / Maybe, and a
   parent app that is legally ready to switch on.

Then a separate exploration: **payment options in both places that take family/team money** (house-league
registration and tournament team entry) — sibling pricing, custom discounts, payment plans — which **re-opens the
2026-10-19 "No household money" ruling** on its merits.

This program **sequences existing projects rather than restating them** (the family app, Android push, In / Out /
Maybe, Stage 12 payments each keep their own plan). It owns only: the prospect world, the demo-gap builds that have no
other home, the walkthroughs, and the payments exploration.

## PM Brief

See `PROSPECT_DEMO_PROGRAM_PM_BRIEF.md` (kept in sync; the brief is the plain-language half of this file).

## Facts this plan stands on (verified 2026-11-09, read from the code)

- **Staging** is `https://dev.fieldlogichq.ca` (the Amplify `dev` branch) and reads the **dev** database — the same one
  every seed script writes. It installs as a separate phone app, "FieldLogicHQ (Dev)". There is no third environment.
- **Staging lags local `dev` by 93 commits** (2026-11-09), including Signed-in family Stage 4a. Only the owner pushes.
- **The family app cannot be switched on on staging today.** `GUARDIAN_TIER_ENABLED` is not echoed by `amplify.yml`, so
  the hosted build never sees it whatever the console says; likewise `LEGAL_PAGES_PREVIEW`. `ONLINE_PAYMENTS_ENABLED`,
  `RESEND_*` and the VAPID keys ARE echoed; their staging values are not readable from the repo.
- **Demo orgs are a hard-coded two-slug list** (`riverdale-minor-ball`, `riverdale-ridge`) that suppresses every email,
  bell and push and blocks writes. A seeded club is NOT on it — real email goes out. Riverdale is unusable here.
- **House-league families get EMAIL only.** No push, and the family app has no alerts list (`lib/family-notify.ts`
  header). Rep game changes write in-app rows that no family screen shows.
- **A postponed house-league game drops off the family schedule and calendar until it has a new date**; only a
  cancelled one stays, struck through (`lib/house-league-coach.ts` ~382-398).
- **The get-the-app QR is a static image of production** (`/get-the-app-qr.svg` → fieldlogichq.ca/discover). Invitation
  links and the family calendar follow `NEXT_PUBLIC_APP_URL`, so they follow the staging host.
- **The consent block shows "Draft wording — not final."** until the 0.2 wording lands.
- **The president's view of house league today:** the club home's "This morning" card shows one total, "League
  registrations · N · waiting for review"; on the Club plan, "The club today" band folds house league's Still owing into
  "Owed to the club" and "Needs someone" counts players owing. No per-division picture, no capacity, no trend.
- **House-league coaches post nothing in the product** (the family team page omits "From the coach" for house league by
  design; rep coach posts are one-way emails saved as announcements).
- **Online family payments run on test keys only** (`LIVE_PAYMENTS_ALLOWED = false` in code). Pay by card shows on the
  sign-up only when the club has payouts set up AND the child is accepted on the spot (auto-approve).
- **Free time** (super admin, any length, Club allowed though not on sale) is on dev and prod — the beta club's free
  year is a grant, not a build.
- **Seed traps:** the club fixture re-sets every seeded user's password on each run (signs that account out everywhere,
  including a phone); fixture addresses are `.local` and receive nothing.

## Phases

Sequenced by dependency. **Demo 1 needs P0, P1, P2 and P4a. Demo 2 needs P3 and P4b on top.** P5 is the beta's own
go-live list; P6 is the payments exploration and gates nothing above.

### P0 — Owner decisions and the staging switch-on (blocking)
- [ ] **D1 · Push local `dev` to staging** (owner). Everything below is demoed on staging.
- [ ] **D2 · The family app on STAGING ONLY.** Echo `GUARDIAN_TIER_ENABLED` and `LEGAL_PAGES_PREVIEW` in `amplify.yml`
      and set them on the `dev` branch only in the Amplify console; production stays off. This is hosted-build config —
      its own commit, owner-asked in that conversation, message states the behavior change; confirm against
      `WATCHED_PATHS` in `scripts/check-agent-automation.mjs` first. `/legal` one-pager: a real person (the prospect)
      ticks v0.1 consent on staging about fictional children — confirm acceptable for a demo.
- [ ] **D3 · Email really reaches a phone from staging.** Confirm `RESEND_FROM` is a verified sender on the `dev`
      branch (an empty one falls back to Resend's test sender, which only delivers to the account owner). One test send
      to a non-owner inbox.
- [ ] **D4 · Online payments on staging.** Confirm `ONLINE_PAYMENTS_ENABLED=true` on the `dev` branch and a test-mode
      connected account can be onboarded for the prospect club (Stripe test onboarding, done once by hand).
- [ ] **D5 · The beta-club arrangement** — free first year, "ease into the functionality" — logged with `/strategy`
      (Proposed until the club says yes). The Founding Season offer is closed (2026-10-26); this is a new decision.
- [ ] **D6 · His club's structure** (owner supplies): club name, division names + birth-year bands, field/diamond names,
      season dates, the fee, rep team names (or let us invent), the tournament's name. **No real families' data.**

### P1 — The prospect world (seed, dev DB only)
- [ ] Committed seed script (`scripts/seed-prospect-demo.mjs`, adapted from `.probe/nav-journeys/seed-navj-base.mjs` +
      `seed-navj-extras.mjs`, which are gitignored), refusing any project but dev, driven by a small config file of
      D6's answers. Not a demo org; Club plan.
- [ ] **People.** Owner as **Owner** (the president role in the demo) on his real email. The prospect gets a real
      **Members › Invite → League admin** invitation to his own email — he sets his own password through the product,
      so we never hold it and a re-seed never signs him out. A registrar seat is left EMPTY (Demo 1 invites it live to
      the owner's second address). One house-league coach and one parent account on inboxes the owner's phones receive.
- [ ] **The world.** About 120 fictional children across his divisions with siblings, a review queue, a waitlist in one
      division and a few owing; a finished previous season (gives the president snapshot a "last season"); 17 rep teams
      by name with light rosters; the tournament; the public club site carrying the season's Register door; the club's
      contact email + mailing address set (Publish refuses without them once the family app is on); the club schedule
      with field time already given to house league.
- [ ] **Staging one division as the story** (the walkthrough's spine). The **demo division** (e.g. U9): registration
      open, auto-approve + card payments on, ~25 children, teams created, ratings mostly done, not drafted, no games —
      so the prospect's own pretend child signs up, is drafted, placed, scheduled and rained out in one continuous story.
      A **history division** (e.g. U11): published teams, a published schedule with games played and two coach-entered
      scores waiting in "Scores to check" (one "Reported").
      ⚠ Verify in the build that a season permits divisions at different stages while registration stays open.
- [ ] **Dates relative to the demo day** (a `--demo-day` argument): the demo division's first Saturday sits a few days
      after it, so the rainout window finds it under "still to play".
- [ ] **`--reset-world`**: restores the starting state (registrations, ratings, teams, games, money, sent history)
      WITHOUT touching any user — the rehearsal → real demo reset. Never runs during a demo.
- [ ] Record the slug, logins (never passwords in docs) and the reset command in the walkthrough page's pre-flight.

### P2 — Demo 1 gaps (the admin)
- [ ] **P2a · The president's season snapshot** (drawing session FIRST — `/design`, mockup rules; then build).
      A house-league card on the club home for Owner/Admin: sign-ups by division against capacity, the waitlist, the
      review queue, received vs still owing, this season against last at the same date. Every figure opens its existing
      screen (no new screens). Option, ruled at the drawing: a weekly summary email to Owner/Admin (staff mail,
      not family mail). Plan gate: wherever the club home's house-league program card shows today.
- [x] **P2b · The postponed game says so.** (built 2026-11-10; calendars keep it marked "Postponed ·" as free time — owner ruling 2026-11-10, recipe F3 amended) The family team page and the family calendar keep a postponed game with
      "Postponed · new date to come" instead of dropping it (house-league coach view checked for the same gap). Small;
      it is the parent half of the rainout walk.
- [ ] **P2c · The get-the-app QR follows the host.** Generate the QR from the app origin instead of the static
      production image, so a staging QR opens staging. (The walkthrough page also carries its own QR, so the demo
      does not depend on this.)
- [ ] **P2d · Check, not build:** the Register door on the public club site reads naturally for a club that will use
      our site (D6 asks whether they keep their own). If they keep theirs, the answer is a plain link to the season
      page — note it in the walkthrough.
- [ ] `/review` per chunk; `/docs` for P2a and P2b (user-facing); `/marketing` words pass for P2a.

### P3 — Demo 2 gaps (families) — sequencing only where another plan owns the work
- [ ] **P3a · Android push delivery confirmed on staging** — the standing manual test (`PUSH_DELIVERY_TEST_PLAN.md`,
      TODO "Android push delivery"). Prerequisite for P3b.
- [ ] **P3b · Phone alerts for house-league parents + an alerts list in the family app** (drawing session first: the
      list, and when the app asks permission). Push on: teams set (placement), schedule up, games changed / rainout,
      and the rep game update that already writes in-app rows. The alerts list shows the in-app rows those events
      already write, so a missed buzz is findable. Email stays — push is in addition. `/legal`: push to parents as a
      service message (CASL scope of a push notification). Likely no new table (in-app rows exist) — confirm; if a
      migration is needed it is the first task, with DATA_DICTIONARY + `npm run refresh:snapshots`.
- [ ] **P3c · House-league coaches post to their team's families** (drawing session first). The house-league coach's
      team page gains a post box; families see it as "From the coach" on the family team page and by email. This
      reverses a design choice ("house-league coaches post no updates in the product") — owner ruling at the drawing.
      Likely generalises the rep announcement store → migration first + dictionary + snapshots. One-way, no replies
      (Messages-with-replies stays the later chat return).
- [ ] **P3d · In / Out / Maybe** — owned by `COACH_AVAILABILITY_RSVP_PLAN.md` (Signed-in family Stage 4b). This program
      only asks for its coach-side drawing session to be scheduled ahead of Demo 2. If it cannot land, Demo 2 shows the
      parent's drawing and says "next".
- [ ] **P3e · The family app's go-live prerequisites** — owned by `SIGNED_IN_FAMILY_ACCOUNTS_PLAN.md`: the published
      privacy page, the consent record naming exactly the children shown (R2), the 0.2 consent wording (removes the
      "Draft wording" banner). Needed for the beta anyway, not just the demo.

### P4 — The walkthroughs and rehearsals
- [ ] **P4a · Demo 1 walkthrough** — published v1 2026-11-09 (prep page: pre-flight, the seven walks with "you do /
      he sees / say this", the TeamSnap questions and honest answers, a QR for staging). Refresh the labels after P2.
- [ ] **P4b · Demo 2 walkthrough** — outline in v1, each beat tagged with the phase it waits on; finalised after P3.
- [ ] **P4c · Full rehearsal on staging** before each demo, on one iPhone and one Android, from `--reset-world`, then
      reset again. Any label that drifted goes back into the page.

### P5 — The beta club's own go-live (not demo work; listed so it is not forgotten)
- [ ] Club plan for a year via **free time** (platform admin, Club, one-year last day) on PRODUCTION.
- [ ] **Live family payments** — the remaining Stage 12 list (`CLUB_TIER_STAGE12_PAYMENTS_PLAN.md`): payments terms
      (/legal L3), the owner's ruling + the reviewed commit that allows live keys, the Amplify dev end-to-end pass with
      payouts, prod migrations, Connect webhooks, the PSP-registration question (L4), D13 registration tax. Without this
      the beta keeps TeamSnap for payments and Demo 1's headline is unbuyable.
- [ ] The family app on in production (P3e done first) — owner's call.
- [ ] **Bringing last year's families over from TeamSnap** — an import is not built; plan it with `/legal` (children's
      records). Until then a beta season starts from fresh sign-ups.

### P6 — Payment options exploration (both places that take money) — a decision sheet, not a build
Scope: **house-league registration** and **tournament team entry**. (Rep team dues already have per-player
installment schedules and credits in the coach's own book — the precedent to learn from, not a target.)
- [ ] **Start from the ruling being re-opened**: BUSINESS_DECISIONS 2026-10-19 "No household money" (cancelled sibling
      discount, financial assistance, household payment plan, moving credit between siblings; "house league is one flat
      fee, paid or not"; no surface may list them). Its reasons: a club must not write into a team's book; house league
      had no credit or schedule to write into; each feature moved real money on an **inferred** sibling relationship.
      New evidence: a real prospect runs registration in TeamSnap today.
- [ ] **What exists** (the census): house league = per-division price + one early-bird date, whole-fee paid/not, price
      correction with a reason, full/partial refunds; tournament = deposit + balance with due dates (per tournament or
      per division), part payments recorded, deposit-or-full online choice; no discount codes anywhere for families.
- [ ] **Options to lay out, each with its cost to the books, refunds, receipts and tax:**
      - *Multi-child pricing inside ONE sign-up* (a fact the family typed, not an inferred sibling — answers the
        ruling's sharpest reason); the cross-sign-up case named separately.
      - *Club-made discount codes* (amount or percent, limits, expiry), both places.
      - *A manual reduction with a reason* (financial assistance as a reduction, not a fund) — extends the existing
        price correction.
      - *Payment plans*: house league (2–4 installments, online card/bank debit charged on dates — card-on-file and
        pre-authorised-debit consent, failed-charge handling) vs. tournament (more than deposit + balance).
      - *Tournament*: early bird / late fee, a multi-team discount for a club entering several teams.
- [ ] **TeamSnap's registration feature set** researched (what they offer, what clubs use) — the comparison row.
- [ ] Reviews: `/accounting` (discount = net revenue vs a cost line in the club's books; refunds of a discounted fee;
      receipts), `/legal` (installment consent, PAD rules, card-on-file), `/strategy` (gate placement; re-wording the
      2026-10-19 entry if reversed).
- [ ] Output: an owner decision sheet (Artifact) with a recommendation per option; rulings logged; any build becomes its
      own plan.

## Architectural Decisions
- **Decision:** Demo on staging with a seeded, non-demo club. **Rationale:** a phone can reach it; demo orgs suppress
  every email/push and block writes; production has no house-league world and must not carry fictional families.
- **Decision:** The prospect's seat comes from a real product invitation. **Rationale:** we never hold his password, a
  re-seed cannot sign him out, and accepting it is itself a demo of the roles flow.
- **Decision:** One demo division carries the whole Demo 1 story (his own pretend child from sign-up to rainout).
  **Rationale:** a continuous story beats seven disconnected screens, and each beat's email lands on his phone.
- **Decision:** No full chat before Demo 2. **Rationale:** chat is paused product-wide; parent–coach messaging about
  minors is the hardest piece to get right; one-way coach posts + In / Out / Maybe + push is a credible family story.
- **Decision:** Push is in addition to email, never instead. **Rationale:** iOS push needs the installed app and
  Android delivery is still unconfirmed on staging; email is the floor every family has.

## Words for /marketing
> Customer-visible wording written during the build, settled in ONE `/marketing` pass per stage, before the walk.
- [ ] P2a snapshot card title, figure labels, "this time last season" line — club home — Owner/Admin.
- [ ] P2b "Postponed · new date to come" — family team page + calendar — parents.
- [ ] P3b alert texts (teams set / schedule up / games changed) and the permission ask — parents' phones.
- [ ] P3c "From the coach" on house-league teams; the coach's post box label and note — coach, parents.

## Open Questions
- [ ] (D6) His club's structure; does the club keep its own website?
- [ ] Does his TeamSnap registration use sibling discounts or payment plans today? (Feeds P6's urgency, and whether
      the beta can move registration in season one.)
- [ ] D2: is a real person ticking v0.1 consent on staging acceptable (`/legal`)?
- [ ] P2a: is the weekly summary email in or out?
- [ ] P3c: owner ruling to reverse "house-league coaches post no updates".
- [ ] P3d: can In / Out / Maybe's coach drawing session run ahead of Demo 2?
