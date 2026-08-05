# Tournament Admin Sandbox — Phase 2 build prompt (the moments dock)

**Written 2026-08-03 by the chat that built Phase 1.** Phase 1 is code-complete on `dev`,
uncommitted, and has not had owner browser QA. This document is the handoff for Phase 2.

---

## ⛔ STOP — read this before anything else

**Phase 2 does NOT start with code. It starts with mockups, and they must be approved before a
single component, stylesheet or copy string changes.**

The required order, and it is not negotiable:

1. **Understand the existing sandbox** — read, measure the running app, form a view. No edits.
2. **Present an Implementation Plan / task list, and a plain-language PM UX summary** — written for
   a product manager, not an engineer: what a visitor sees and does differently, and why.
   `AGENCY_RULES.md` makes this a **blocking step**: no code may begin until it has been presented.
3. **Produce mockups**, published as a **Claude Artifact**, every element labelled
   **NEW / RESTYLED / UNCHANGED**. Phase 2 has **no approved visual spec** — see "The gate" below
   for what they must cover.
4. **Get the owner's explicit approval.**
5. **Only then build** — then `/simplify` if the diff grew a new abstraction, `/review`, and
   `/docs` if a user-facing flow changed.

You MAY, before approval: **read anything**, and **measure the running app** (Playwright, curl,
probes — measurement is how Phase 1's worst defects were actually found, after screenshots misled
twice). You may fix an **outright defect you trip over** — something visibly broken, not something
you would redesign — provided you say so plainly and keep it separate from the design work.

If you cannot tell which side of that line something falls on, **it is design. Put it in the mockups
and ask.**

---

## ⚠ SEQUENCING — do not start Phase 2 cold

**A demo-UX investigation runs BEFORE this** —
`TOURNAMENT_SANDBOX_DEMO_UX_INVESTIGATION_PROMPT.md`, opened 2026-08-03 after the owner's first QA
pass ("*I honestly still don't know what these buttons are supposed to accomplish*").

That is not a separate concern from Phase 2 — **it is the same surface**. The moments dock would be
a **third** piece of fixed chrome, stacked on a band that has already produced three defects, and it
answers the same question the tour does: *how does a stranger move through this demo?* Design them
apart and they will fight.

**Confirm with the owner that the UX investigation has landed before you begin.** Its outcome may
change what the dock should be — or may make the dock the answer it arrives at, in which case much
of this document is already satisfied and you should say so rather than rebuild it.

---

## Read these first, in this order

1. `TOURNAMENT_ADMIN_SANDBOX_PLAN.md` — the plan, ratified decisions D0–D4, and **build notes 1–24**,
   which record every deviation Phase 1 made and why. Notes 14–22 are defects found in QA and
   review; read them before you touch anything, because three of them describe traps you can walk
   straight back into.
2. `TOURNAMENT_SANDBOX_MOCKUPS.html` — the **approved, BINDING** visual spec for Phase 1 (artifact
   `118b8d75-1b83-4272-b9f2-bfe0ae9f7ddf`). Phase 2's dock has **no approved mockup yet** — see
   "The gate you must clear first" below.
3. `docs/agents/strategy/BUSINESS_DECISIONS.md`, entry 2026-08-02 — **the door is UNGATED,
   permanently. No email, no form, no lead capture, ever.** Nothing in Phase 2 may add one.
4. `OWNER_QA_LEDGER.md` §5.2 — the Phase 1 QA steps, still outstanding.

---

## Where Phase 1 got to

All eight slices are built: the canonical seed, the write block + outbound silence, the reconcile
job, the door, the chrome, hygiene, the marketing doors, and the drag beat. 43 contract tests.
**Nothing is committed and no browser QA has happened.**

| You get, for free | Where |
|---|---|
| "Is this a demo org?", hardcoded and org-agnostic | `lib/demo-org.ts` (+ `demo-org-server.ts` for ids) |
| Every write refused, above every route | `lib/demo-guard.ts` + `proxy.ts` |
| Outbound silence, three independent chokepoints | `lib/notify.ts`, `lib/email-sender.ts`, `lib/fan-notify.ts` |
| Banner · tour chips · countdown · blocked-save toast · locked-outbound control | `components/sandbox/*` |
| The door, the confirm screen, the session swap | `app/see-it-live/*`, `app/api/sandbox/switch` |
| Curated-surface hiding | `lib/sandbox-curation.ts` |
| Search / metrics / alerting exclusion | robots + sitemap + `platform-metrics` + `observability/capture` |
| The world, and `resolveDemoState(now)` — a pure function of the clock | `lib/demo-tournament.ts` |
| Seed · tick runner · health probe | `scripts/{seed-demo-tournament,tick-demo-sandbox,check-demo-sandbox}.mjs` |

**Run the health probe after any change.** It asserts the demo is presentable — a live game exists,
the dashboard has work in it, the bracket is right, the schedule reads HEALTHY.

---

## What Phase 2 is

**The moments dock** (ratified D4 — *deferred, not cut*). Today the sandbox shows **one** canonical
moment: semifinal morning, pool play done, bracket seeded, a semifinal live. Phase 2 lets a visitor
switch between **three moments in a tournament's life** without leaving the demo:

- **Registration week** — teams arriving, payments part-collected, the Registration Command Center
  with real work in it, nothing scheduled yet.
- **Game day** — the moment that exists today. Untouched.
- **The morning after** — results in, standings final, the archive and the summary.

The sales argument: an organizer's year is not one Saturday. The dock lets a prospect see the part
of the year *they* are dreading, which is rarely the part we happened to seed.

**The owner has explicitly cleared Phase 2 to start without waiting for real-prospect feedback**
(2026-08-03), which overrides D4's "design it after watching prospects" rationale. D4's other half
still stands: **registration week needs a second seeded state**, and that is the long pole.

---

## The gate (restated — it is the top of this document, and it is the first deliverable)

**Mockups are binding in this project, and Phase 2 has none.** Phase 1's approved spec covers the
banner, the chip rail, the fan side, the dashboard, the schedule editor, the nudge family and the
marketing doors — **it says nothing about a dock**, so there is nothing to build to yet.

Before writing a line of feature code, produce and get approval for:

1. **The dock itself** — where it sits relative to the existing banner + chip rail (three pieces of
   fixed chrome is already a lot of hat), what a moment looks like selected vs not, and what happens
   on a narrow screen.
2. **The transition** — what a visitor sees between pressing a moment and the new state being on
   screen. This is the risky one: see "the hard problem" below.
3. **Registration week itself** — the Command Center with believable work in it, and what the fan
   side shows when nothing is scheduled yet.
4. **The morning after** — standings final, and whatever the archive/summary surface actually is.

Publish them as a **Claude Artifact** (owner convention — always, for version history; republish to
the same path on revision). Label every element **NEW / RESTYLED / UNCHANGED**. Then stop and get
approval before building. Flag anything the code forces you to deviate from rather than diverging
quietly, and record it in the plan's Build notes as you go.

---

## The hard problem, stated honestly

**Phase 1's state is a pure function of the clock. A dock is a pure function of the visitor.** Those
are different things, and reconciling them is the whole design problem in Phase 2.

Today, `resolveDemoState(now)` says what every game's date, time, status and score should be, and
the reconcile job writes exactly that. It is stateless, idempotent and self-healing — which is why
there is no cursor table, no migration, and no way for the demo to get stuck. **That property is
worth more than the dock.** Do not trade it away casually.

Three shapes are worth considering, in rough order of how much I'd trust them:

- **A) Three orgs, one dock.** Each moment is its own demo org in the allow-list, each with its own
  seed, each still a pure function of the clock. The dock is navigation. **Nothing about the safety
  machinery changes** and the reconcile job stays stateless — it just has three orgs to reconcile.
  Costs: three seeds to maintain, and the URL changes when a visitor switches moment (which may be
  fine, or may feel like leaving).
- **B) One org, three tournaments.** Same event family, three tournament rows in different
  lifecycle states. Closer to how a real org looks, and the org-level chrome stays put. The clock
  function has to become "per tournament", which is a real change to `lib/demo-tournament.ts`.
- **C) One org, one tournament, a per-visitor overlay.** The dock changes what the visitor sees
  without changing what is stored. **This is the one that threatens the invariant** — it needs
  per-session state, which the sandbox deliberately has none of today. If you go here, be very
  clear about where that state lives and what happens when it is absent.

I would start by pricing A honestly. It is the only one that leaves the "self-healing, no cursor, no
migration" property completely intact.

---

## Traps that will cost you a day each

1. **"Live" is a TIME WINDOW, not a status.** `lib/game-status.ts` decides liveness from a game's
   scheduled window, which is why the semifinal floats with the clock instead of sitting at a
   literal 9:00 AM. Do not tidy the times — you will kill the liveness.
2. **The schedule-health baseline is fragile and was hard-won.** 89–92 / HEALTHY at every hour with
   zero conflicts, measured across all 72 cycle × phase combinations. Four diamonds, midday pool
   play and 75-minute games are each load-bearing and commented as such. The "try to break it" beat
   needs an intact baseline. **Re-run the sweep if you touch times, facilities or durations** — and
   any new moment needs its own sweep.
3. **Never write demo data through the app's own write paths.** They fire notifications. The
   reconcile job uses the service-role client directly, deliberately.
4. **Any guard that reads a URL must decode exactly the way the router does.** Phase 1 shipped a
   live write-block bypass because it didn't (build note 19). If you add a second demo org, re-run
   the encoded-slug probes.
5. **Never cache a partial demo-org resolution.** Build note 21 — the cache is what outbound silence
   consults, and caching an empty result once let the demo email real people in principle. Three
   orgs makes "complete" mean three, not one.
6. **Top-pinned chrome must carry `--sandbox-chrome-h`.** The failure is silent: the banner keeps
   its space and something paints over it. A dock added to the fixed chrome changes that height —
   check both halves of the product and every width.
7. **`lib/` modules imported by scripts need explicit `.ts` extensions** on relative imports.
8. **Other agents share this working copy.** Re-check the branch is `dev` before committing, stage
   explicit pathspecs only, and confirm afterwards that only your files landed. During Phase 1 a
   concurrent session silently reverted one of my files mid-build.

---

## Do this before Phase 2, not during

These are Phase 1's tail. They are small, and leaving them makes Phase 2 harder to judge.

- [ ] **Owner browser QA of Phase 1** (`OWNER_QA_LEDGER.md` §5.2). Not yet done for ANY slice.
- [ ] **Schedule the reconcile job.** It exists and is ready but **nothing runs it** — on dev the
      owner runs it by hand. There is an established pattern for timed jobs; adding a schedule is a
      migration that creates no tables or columns. **The owner asked to be consulted before any
      database change — ask.** Without it the demo freezes, and a frozen live demo is worse than no
      demo.
- [ ] **Commit Phase 1** (owner's per-action OK required, explicit pathspecs).

---

## Working agreements with the owner

- **Mockups are binding.** Label NEW / RESTYLED / UNCHANGED. Publish as a Claude Artifact. Flag
  deviations; never diverge quietly. Record them in the plan's Build notes as you go.
- **Present a plain-language PM summary before implementing** — what the user sees and does
  differently, written for a product manager, not an engineer. This is a blocking step.
- **No commits without an explicit, per-action OK.** Approval never carries across turns.
- **Ask before restarting the dev server**, and before any schema change.
- **Dev only.** Production is a separate release step the owner decides, with its own decisions-log
  entry.
- Report in **product-owner voice** — UX and consequences, not file paths and mechanics.
- Offer `/simplify` if the diff grows a new abstraction, then `/review`, then `/docs` if a
  user-facing flow changed.

## Definition of done for Phase 2

A visitor can move between three moments in a tournament's life inside two minutes, each one looks
like a real Saturday somebody actually lived, the demo still repairs itself without a cursor, and
nothing a visitor does is saved or sent to anyone.
