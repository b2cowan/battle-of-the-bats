# Plan & billing — rules every Codex session starts from

> **Read this first, then the one stage prompt you were given.** Plan: `PLAN_AND_BILLING_ONE_EXPERIENCE_PLAN.md`
> (the *why*, the owner rulings, the open questions). Stage prompts: `PLAN_AND_BILLING_STAGE{1..5}_BUILD_PROMPT.md`.
> Written 2026-10-28 so the build can run on Codex. **Every file name below is a lead, not a fact: re-verify before
> you build on it.** The leads came from read-only audits of the code; a plan or an audit has been wrong in this repo before.

## 0. What you are building, in one breath

One **Plan & billing** experience for every plan (Premium Coaches Portal, Tournament, Tournament Plus, League Plus,
Club, Club · Association): the **same sections in the same order, the same words, the same buttons**, rendered in
each portal's **own chrome** (the admin look for admin users, the Coaches Portal look for a standalone coach). **"Same
place" means the same look, navigation and experience — not the same URL and not the same shell** (owner, 2026-10-28).
The Club page is the benchmark layout. A new or changed plan must be **a data edit, not a screen edit**.

## 1. Load these before touching anything

1. `AGENTS.md` (Next.js 16 differs from your training: read the relevant guide in `node_modules/next/dist/docs/` before
   writing route, layout, redirect or proxy code; the request interceptor is **`proxy.ts`**, never a root `middleware.ts`).
2. `AGENCY_RULES.md` and `CLAUDE.md` (the coaches-portal rulings and the demo/help rules live there).
3. `memory/MEMORY.md` (index) → open the entries for the control you are about to draw or change, and
   `memory/design_decisions.md` (LIVE). `memory/agents/design-review-agent.md` and `memory/agents/ux-flow-agent.md`
   are the shared design and UX-flow reviews.
4. `docs/agents/design/NAV_STANDARD.md` (any nav row, sheet row, icon or tile is checked against it),
   `docs/agents/design/TABLE_AND_LIST_STANDARD.md` (the change-plan table), `docs/agents/design/COACH_SURFACE_DESIGN_ADDENDUM.md`
   (anything in the Coaches Portal).
5. `docs/agents/strategy/PLAN_PRICING_FACTS.md` — the canonical plan names, prices, bands and gating. **Never type a plan
   price, name or gate as a fresh copy.** Read from `lib/plan-config.ts`; if the Facts doc and the config disagree, stop
   and tell the owner (do not pick one).

## 2. Design and UX rules that bind this work (the ones that bite)

- **Build to the approved drawings (Stage A), nothing invented.** If a drawing is silent, reuse the nearest **shipped
  component** (a control is drawn from its shipped component, never from a look-alike) and say so in your hand-off. If no
  shipped component fits, stop and ask.
- **Absent beats disabled.** A control a person cannot use is **removed**, not greyed. (Today the Club page removes
  Payment method / Move / Cancel during staff free time; keep that for every plan.) Where a control must show disabled,
  `.btn` fades by the one global rule — do not restyle it.
- **Words:** one spelling everywhere a customer reads it (`npm run check:spelling`; `installment`, "fiscal year" club-side
  only, coaches say "season"; clock `8:00 a.m.` via `formatTime()` only; dates via `formatStoredDate`). A name ending in
  *s* takes the bare apostrophe through the one `possessive()` helper. Sport-neutral language. Mark required fields;
  never tag optional ones. A transient "Saved" fades; only an error persists.
- **Windows (dialogs):** use `KitDialog` / the shipped window. The foot is **a sentence on the left, buttons on the
  right** (`footerStart`); the close × is the plain glyph; the primary action names what it does ("Cancel and suspend",
  never "OK"). One loading line names the screen (`LoadingState`), in both portals.
- **A phone's secondary action is its symbol alone** at a 44px tap floor; a list reorders by hold-and-drag, never arrows.
- **Navigation:** follow `NAV_STANDARD.md` (rows 14px, icons 14px, foot 12px, sheet rows 16px with 17px icons, group
  headings 11px capitals). A new row is added to the nav's **own data**, and the tests that pin the nav are updated in the
  same change, never loosened.
- **Money figures read as one connected band.** Do not draw separate floating tiles for the plan price / renewal /
  usage; copy the Club page's shape.
- **Coaches Portal standing rulings (CLAUDE.md):** a team with no live season has ONE door (`CoachTeamSeasonGate`, decided
  server-side) — **the billing page is workspace-level, so it must live OUTSIDE `[teamId]` and must stay reachable with
  several teams, no team, or only closed seasons.** Do not add a finished-season branch anywhere. A page that cannot be
  honest for a surface hides its entry point rather than dead-ending.
- **Standard flows to walk in your head for every state before you call it done:** empty (no card on file, no invoices,
  no fees), loading, error (a Stripe call fails), success return (`?success`, `?card_saved`, `?next_season`), past due,
  trial, free time (running / last 14 days / ended), Founding Season comp, cancelled, **non-owner who types the URL**,
  and a phone at 390px. Say which you walked and which you could not.

## 3. Data and safety rules

- **Billing access** is enforced by the server capability (`billing`), not by hiding a button. **Owner ruling in the
  Part 3 build, 2026-10-28:** the owner may delegate billing through that capability; no role gains it by default.
  Only the owner grants/revokes it. **Cancel and downgrade (the four routes under `cancel/` and `downgrade/`) stay owner-only (ruling 2026-10-29) — never widen them, and never show a delegate their doors.** Suspended billing users retain the count-only usage read for recovery. Every billing route
  already checks it; any new route you add must too, and must pass `orgSlug` (the repo's `check:org-slug-callers` /
  `check:admin-org-context` fail otherwise).
- **Cancelled / suspended orgs must still reach billing and reactivate.** Files that use `allowSuspendedOrg: true` are
  load-bearing and are listed in `tests/unit/org-billing-access-guard.test.ts` — add any new file on that path to the guard;
  never remove the flag.
- **No migration is expected anywhere in this project.** If you think you need a column, stop and say so (schema =
  dictionary + snapshots, same unit of work).
- **Do not merge or rewrite the server logic** of the two plan-change mechanisms (Club move vs downgrade). This project
  unifies the *presentation*. **Do not change prices, plan gating, or what a plan includes.** Pricing questions go to the owner.
- **Do not touch** hooks or permissions in `.claude/settings*.json`, any script a hook runs, `scripts/check-agent-automation.mjs`
  watched paths, the database checks, or anything that runs against production. A **new unit test** for this project is fine;
  changing a gate is not.
- **Stripe return paths are the easiest thing to break silently.** For every one you touch, say which of: portal return,
  card saved, next-season choice, checkout success/cancel, plan move you re-walked and how.

## 4. Process

- **Branch `dev` only.** `git rev-parse --abbrev-ref HEAD` before you commit; never `master`, never a feature branch.
  Other sessions share this working copy: **stage explicit paths only** (never `git add -A` / `.`), and after every commit
  run `git show --stat HEAD` and confirm only your files landed. **Commit only when the owner has said to** — until then
  leave the tree modified and list your files in the hand-off.
- **Verification:** `npm run verify:changed` after each part (it runs the unit tests, spelling, type and token checks);
  `npm run typecheck` as well here (shared modules, routes and link helpers change). Run expensive checks one at a time.
  **Browser testing is the owner's.** You may start `npm run dev` (with network access) to render a screen; do not run a
  whole-product layout sweep on the dev server (`check:layout --changed` on the few screens you touched is fine; the full
  sweep and the layout baselines are refreshed on staging, not by you). New files or shared-module edits mean the dev
  server needs a restart before the owner tests — say so.
- **Tests that read the old billing page's source** must be **repointed to the new files in the same change** — not
  weakened, not deleted without a replacement assertion. Each stage prompt lists the ones it breaks.
- **Slash commands (`/review`, `/simplify`, `/docs`, `/design`, `/demos`) are Claude commands.** You do not run them. In
  your hand-off, write which ones are **owed** for this stage (every substantive stage owes `/review`; a stage that adds a
  new shared abstraction owes `/simplify` first; a stage that changes a screen a customer follows owes `/docs`).
  Their instruction files are in `.claude/commands/` if you want to self-check against them.
- **Disagree out loud.** If a drawing, a ruling or this prompt conflicts with what the code does, say so **before** you
  build, with the evidence. Do not manufacture objections; do not silently work around one.
- **Hand-off format (end every stage with this):** (1) what the user now sees and does differently, in plain words, by
  role; (2) the files changed, grouped; (3) checks run and their results (a failure is reported with its output; a
  skipped check is named); (4) the state/flow checklist from §2 — walked / not walked; (5) owed: `/review`, `/simplify`,
  `/docs`, the owner walk, any dev-server restart; (6) anything you decided that the drawings did not rule.
- **Tracking:** tick or amend this project's TODO line only when a stage is verified; progress notes go in the plan's
  §9, not in `TODO.md` (one line per item there).
