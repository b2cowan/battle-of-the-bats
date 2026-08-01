# Program — Coaches Portal (free + premium)

> **Consolidated 2026-07-28.** Replaces 32 separate coach-portal plan/brief files (listed in §5).
> **Scope of this doc:** outstanding work only. Shipped work appears as one-line reference in §4.
> **NOT in this doc:** the in-flight coach projects, which stay as their own files —
> `FREE_COACH_PORTAL_EXPERIENCE_PLAN.md` and the launch batches
> (`COACH_PORTAL_LAUNCH_BATCH1/2/3_PLAN.md` shipped; `..._BATCH4_BUILD_PROMPT.md` in flight).
> This doc holds everything *they don't cover* — and **§1.1 is the ledger that says which is which.**
> **Start at §1.1.** "All P0s done" is NOT "program done"; 12 P1s, ~24 polish items and 6 wow ideas
> remain, grouped into pickable chunks at the end of §1.1.

---

## 0. Ground truth (release state re-verified against `origin/master` 2026-07-30)

**`origin/master` is at `cf90d626` — the 2026-07-29 coach-portal launch release. ALL FOUR launch
batches are LIVE IN PRODUCTION** (1 `934e5275` · 2 `8040f4e6` · 3 `85d2a015` · 4 `13e2c021`), along
with the coach onboarding tour + chat quiet-mode work. Migrations **204–210 are on prod** and the
dev↔prod drift report is **green (zero structural drift)**. **Therefore the readiness review's
entire P0 list is not just closed — it is in customers' hands.**

⚠ **Only 5 commits sit on `dev` ahead of prod:** the overlay-hooks relocation, the admin dropdown
consolidation, the free-portal welcome (**which carries dev-only migration 211**), **Chunk A —
Money on a phone (`a737acbf`)**, and its docs record. The unreleased queue is now SMALL — the
opposite of the situation this section described before the release.

⚠⚠ **Migration 211 is FUNCTION-only, and the drift gate is blind to it.** It replaces a stored
function (an atomic fix for a lost-update race on a coach's activated-tools flag). The drift report
compares tables, columns, indexes, constraints and RLS — **not functions** — so its "no drift"
verdict proves nothing about 211. **Verify it against live prod before the next promote.**

*(Superseded, kept so the correction is legible: this section previously stated `origin/master` was
at `6afa1429` and that "NOTHING from launch Batches 1–3 is on prod". Both were true when written and
are now wrong.)*

Practical consequence: the large "awaiting owner browser verification" tail across the June coach
plans is **not blocking work** — it shipped and has been in customers' hands for weeks. It is
folded into §3 as a single verification-debt item, not carried as N separate open projects.

---

## 1. Outstanding work

### 1.1 Readiness review — THE LEDGER (status of all 85 findings)

Source of findings: `docs/agents/design/PREMIUM_COACH_PORTAL_UX_READINESS_REVIEW.md`. That doc is a
**review, not a backlog** — it has no status and never learns what shipped. **This section is the
backlog.** Ledger opened 2026-07-29 because several items had already been silently absorbed into
batches and a future reader would have re-planned shipped work.

**Rule: when a batch absorbs a review item, tick it HERE in the same unit of work.**

#### P0 — go-to-market blockers (8): ✅ ALL 8 SHIPPED

| # | Item | Status |
|---|------|--------|
| #3 | Tournaments page dead end | ✅ Batch 1 (`934e5275`) |
| #4 | Mobile Save/Add buttons under the bottom nav | ✅ Batch 1 |
| #5 | Mobile More menu has no scroll cap | ✅ Batch 1 |
| #6 | Onboarding never mentions half the product | ✅ Batch 2 (`8040f4e6`) |
| #7 | No fast way to add a roster | ✅ Batch 2 |
| #8 | Heavy forms — 10–13 fields, no progressive disclosure | ✅ Batch 2 |
| #1 | Season-end lockout | ✅ Batch 3 (`85d2a015`) |
| #2 | Real tournament games have no attendance/lineup tools | ✅ Batch 4 (`13e2c021`) |

**The P0 list is CLEAR as of 2026-07-29 (Batch 4, `13e2c021`). That does NOT mean this program is
finished — everything below is still open.**

#### P1 — high value, soon after launch (17): 6 resolved, 11 open

| # | Item | Status |
|---|------|--------|
| 1 | Chat vs Announcements are indistinguishable in the nav | ✅ **Chunk B (built on dev 2026-07-31)** — `Announcements` → **"Email families"** (audience + medium), `Chat` kept as the app-wide word for a conversation; the SCREEN was renamed too, so the door and its destination agree. ⚠ Found in build: the review's premise was stale — Chat also carries the standing **staff room**, so the shipped tour copy calling it "the organizer line" was wrong and was corrected. ⚠ The capability gate is keyed by DISPLAY LABEL; the new label is a case and the old one a fallthrough |
| 2 | Chat has no honest empty state outside a tournament | ✅ **ALREADY SHIPPED** (verified 2026-07-31 while scoping Chunk B — absorbed by an earlier batch without being ticked here). `CoachChatView` renders `CoachEmptyState`: *"Only the organizer can open a chat, and only for a tournament your team is entered in — so there's nothing here until then."* **Do not re-plan it.** |
| 3 | Attendance has no home in the nav (×2 reviewers) | ✅ **Batch 4** — own Squad item, gated on attendance + roster; page opens on "take attendance for {next event}" |
| 4 | No notification bell anywhere on mobile | ✅ **Chunk B (built on dev 2026-07-31)** — worse than reported at pickup: the feed page had **exactly ONE inbound link in the product**, inside the desktop-only bell's panel, so on a phone it was unreachable by any route. Fixed by REUSING the admin shell's shipped answer (2026-07-22) — a **Notifications row first in the More sheet** opening the **full page** (not the bell's panel, whose phone rules anchor it under an *admin* top bar this portal lacks), with the unread count badging the More tab. A 6th tab and a page-header bell were rejected with reasons drawn in the mockups |
| 5 | Unsaved-changes guard missing on Accounting + Tryout-setup forms | ✅ **COMPLETE — Chunk A (Money) + Chunk E (tryouts, built on dev 2026-07-30)** — session form, scorecard builder, accept drawer, walk-up modal and evaluator modal all guard through `useDiscardGuard` with stake-naming copy; the scorecard save also stopped silently dropping typed-but-unnamed rows |
| 6 | Weekly recurrence locks every game to one opponent | ✅ **Chunk C (built on dev 2026-07-31)** — "Repeat weekly" shows the occurrences as ROWS before any exist, each with its own opponent; a bye week is removed before commit; the button names the real count. ≈120 taps → ≈23 for a 12-game round robin |
| 7 | No schedule import | ✅ **Chunk C (built on dev 2026-07-31)** — paste or file, verdict per row, reads its own export back; refuses an ambiguous date rather than guessing; a look-alike organizer game is surfaced, never merged |
| 8 | Game-day card downgrades on the actual game day | ✅ **Batch 4** — game day now offers the same one-tap lineup + attendance the in-season card does. The *fuller* card (wow #2: arm-care warning, richer chips) is still open |
| 9 | Lineup touch targets under the standard (×2 reviewers) | ✅ **Chunk C (built on dev 2026-07-31)** — reordering LEFT the grid into its own `Batting order` view with press-and-hold drag restored + 44px arrows; the 18px in-grid arrows are retired, the per-inning cell reaches 44, and the **36-vs-44 disagreement in the same screen family is settled onto one token**. The grid's pinned column narrowed, so a 360px phone shows one more inning |
| 10 | Money's reports have zero mobile adaptation (×2 reviewers) | ✅ **Chunk A** (built on dev 2026-07-30) — lists became cards, Budget vs. Actual stayed a comparison grid that scrolls with the line name pinned + a visible swipe hint; `budget.module.css` and `bva.module.css` gained their first-ever media queries |
| 11 | Forms don't reflow to one column on phones | ✅ **absorbed into Batch 1** (verified 2026-07-29: reaches Player Detail too) |
| 12 | No orientation for coaches who never had a free team | ✅ **Chunk B (built on dev 2026-07-31)** — found half-built at pickup: Quiet Mode's portal tour existed but was offered from inside ONE card, so a coach whose Overview resolved to a game / a lull / nothing was never offered it. Now a **`welcome` state at the top of Chunk I's ordered resolver** (pre-season only — an introduction never outranks game day), inheriting the pre-season door, retired permanently by `tourDismissed`. ⚠ `/review` caught that it must ALSO honour the independent Quiet Mode hints switch, or a coach who turned hints off met an onboarding card |
| 13 | Guardian fields are contact-only, unexplained | ➡️ **moved to §1.4** (guardian model) |
| 14 | Tournaments list unsorted, no in-context help | ✅ **absorbed into Batch 1** |
| 15 | Season winding-down gives no cue | ✅ **absorbed into Batch 3** |
| 16 | Tryout scoring hidden behind an evaluator detour | ✅ **Chunk E (built on dev 2026-07-30)** — "Score players" on the Tryout Day tab opens the SAME field scorer signed-in (shared component, one persistent self identity per coach, "(you)" on the scoreboard); the Evaluators card is now genuinely for helpers |
| 17 | Help "?" icons promised everywhere, present on 3 of ~25 pages | ✅ **Chunk B (built on dev 2026-07-31)** — the "29 pages missing" framing was the wrong denominator: all 12 existing icons were already **nav destinations** and every drill-in correctly had none, so the promise was **12 of 17 kept and the gap was FIVE doors**. Rule now binding: *every nav destination carries help; a page reached by drilling into one inherits its parent's guide.* Closed: Attendance · Chat (its own header — the page is full-bleed) · Settings · Season's End · closed-season Insights. **Settings had no guide, so one was WRITTEN** — a "?" that opens the hub is a broken promise. A probe walks the RENDERED nav, so a future nav item shipped without help fails |

#### P2 — polish (~30, prose paragraph in the review): mostly open

Not enumerated here — the review's paragraph stays the source. **Absorbed so far:**
- Native `window.confirm` for removing an assistant → ✅ Batch 2 (portal dialog)
- Native `alert()` on budget-delete failure → ✅ **Chunk A** — the reason now appears inside the delete dialog, which is still open when the failure lands. **This was the LAST native browser dialog anywhere under `app/[orgSlug]/coaches/`**; a probe now asserts none fires
- Inconsistent "(paid only)" caveats on Money's headline numbers (f4-6) → ✅ **Chunk A** — the cash basis is stated once above the row
- No cross-link between Payment Requests and Org Allocations (f4-7) → ✅ **Chunk A** (both directions)
- Desktop grids capped to a narrow column then scrolling internally (f9-2) → ✅ **COMPLETE — Chunk A (BvA) + Chunk E (Depth Chart, built on dev 2026-07-30)** — the depth VIEW of Roster takes `.pageWide` (Schedule's view-conditional shape) and its bare scroller became `CoachScrollX` (honest swipe hint; the portal's last silent sideways scroll)
- "Save & add another" on the one-player flow → ✅ Batch 2
- Live duplicate-jersey check → ⚠️ **PARTIAL** — Batch 2 flags clashes in the *bulk preview*; the
  single Add Player form still only reports them after saving
- Two position-editing UIs → ✅ Batch 2 (owner call: one "Best Position" on the add form)
- Settings rollover copy omits development history/awards → ✅ Batch 3

#### Wow shortlist (8): 2 shipped, 6 open

| # | Idea | Status |
|---|------|--------|
| 1 | First-10-minutes setup momentum ring | ✅ Batch 2 |
| 7 | Season Wrapped | ✅ Batch 3 |
| 2 | Real game-day card for regular-season games | ✅ **COMPLETE — Batch 4 + Chunk C (built on dev 2026-07-31)** — the anchor gained call time + uniform and an arm-care warning that claims ONLY what the coach's own cap and saved lineups prove (no invented season ceiling), including the double-header |
| 3 | One-tap postgame recap draft into Announcements | **OPEN** |
| 4 | No-login "follow this game" link for parents | **OPEN** — review's pick for most likely to spread |
| 5 | Shareable player trading card | **OPEN** |
| 6 | Per-player season recap | **OPEN** |
| 8 | Printable award certificates | **OPEN** |

#### What's left, grouped into pickable chunks

The open items above are not a to-do list to work top-down — they cluster into seven coherent pieces.
Sized so one chat can plan → mock → build → review each. **Chunk A is the recommended next build**
(collision-free while Batch 4 runs; every other chunk overlaps something in flight or needs a decision).

**A · Money on a phone** — ✅ **COMMITTED TO DEV 2026-07-30 (`a737acbf`)** (plan + PM brief: `COACH_PORTAL_CHUNK_A_MONEY_ON_A_PHONE_PLAN.md`; mockups `claude.ai/code/artifact/dc2eb969-1f4d-4743-9bfc-d1cd55575e3d`). No migration, as predicted. Also caught and fixed **two pre-existing capability leaks** the mobile work had nothing to do with: the Expenses page's Add Expense/Add Payable buttons and the whole Payment Requests page offered write forms to a `read`-only money coach. Remaining: `/simplify` → `/review` → `/docs` → owner QA → commit. *(original scope below)*
P1 #10 (reports have zero mobile adaptation, ×2 reviewers) + the remaining mobile-pass tables from
§1.3 (expenses, allocations, budget-vs-actual, fundraiser detail — "mechanical, follows the Dues
exemplar") + P1 #5 (unsaved-changes guard on accounting forms — a hand-built budget split is the
worst thing in the product to retype) + the P2 native `alert()` on budget-delete failure.
*Why it hangs together:* one area, one proven pattern, one QA pass. A treasurer-coach can do dues on
a phone today but cannot read their own budget report on one. **Accounting is untouched by every
other active stream** — verified 2026-07-29.

**B · Findability & portal chrome** — ✅ **BUILT ON DEV 2026-07-31 (uncommitted)** — plan + PM brief `COACH_PORTAL_CHUNK_B_FINDABILITY_{PLAN,PM_BRIEF}.md`; mockups artifact `96e4a359-7966-4f1c-9105-3ddbb85dd969` rev 1 (approved = binding); **D-B1–D-B4 ALL RATIFIED at the recommendations 2026-07-31** ("I agree with all of your recommendations"). **NO migration, no write path, no API change**, as predicted. What shipped: the mobile **Notifications** door (More-sheet row → full feed page, count on the row AND the More tab, reusing admin's 2026-07-22 answer) · **`Announcements` → "Email families"** in both navs, the page it opens, the tour and the guide — with the **label-keyed capability gate** given the new case + the old one as a fallthrough · the **help rule** closing five nav doors and a newly-written **Team settings** guide · a **`welcome` anchor state** at the top of Chunk I's resolver for cold signups. Gate green (typecheck 0 / **651 unit tests** / lint 0 errors / all six colour baselines ZERO / date ZERO / parity 0) + new findability probe suite. `/simplify` (3 applied — incl. a probe that asserted a LIST instead of the RULE) + `/review` (high-risk tier, **3 confirmed-fixed**, security lens clean) + `/docs` done. **`coaches.module.css` deliberately untouched** (a concurrent stream held uncommitted hunks there). Remaining: fresh dev restart → owner QA → commit with per-action OK. *(original scope below)*
*Original entry:* — *small–medium; handoff prompt
`COACH_PORTAL_CHUNK_B_FINDABILITY_BUILD_PROMPT.md`.* It
carries ground truth re-verified 2026-07-31: **P1 #2 is already shipped and must be dropped from
scope**, the help-icon count has moved to **12 of 41** pages, the notification bell exists in the
desktop sidebar but **not** in the mobile bottom nav (which already carries an unread-dot precedent
to reuse), and three concurrent streams — the nav rename, Desktop Phase 2 and Quiet Mode — have all
been editing this exact area. *(original entry below)*
P1 #1 (Chat vs Announcements), #2 (Chat's honest empty state), #4 (mobile notification bell),
#17 (the help-icon promise), #12 (welcome moment for cold signups). Batch 4 has landed, so the nav
collision is gone — but note the concurrent Coach Onboarding Quiet Mode stream is also editing empty
states and page headers; check its state before starting #2 and #17.

**C · Schedule intelligence** — *medium* — **PLANNED 2026-07-30, NO CODE WRITTEN. Blocked at the
owner gate: mockup approval + D-C1…D-C10.** Plan + PM brief:
`COACH_PORTAL_CHUNK_C_SCHEDULE_INTELLIGENCE_{PLAN,PM_BRIEF}.md`; mockups
`claude.ai/code/artifact/81a33e54-42db-4fbb-bd73-c9007b4ab06b` **rev 3** (binding on approval).
Six items: **C0** time truth · **C1** recurrence preview (P1 #6) · **C2** import (P1 #7) ·
**C3** lineup touch targets (P1 #9) · **C4** game-day card (wow #2) · **C5** discard-guard
migration. Design thesis: *a recurring series and an imported file are the same thing — a set of
proposed events the coach reviews before any exist* — so ONE verdict-per-row preview serves both.

⚠⚠ **FOUND AT PICKUP — a LIVE defect on a shipped surface.** `rep_team_events.starts_at` is
`timestamptz`, but the coach form writes a **naive** wall-clock string (`isoFromInputs` →
`` `${date}T${time}` ``) which Postgres resolves in the UTC session zone, while every display path
converts back to the **reader's** zone (`new Date(iso).toLocaleTimeString`). A Toronto coach types
6:00 PM and sees **2:00 PM**; re-saving an untouched event shifts it again (`toLocalInput` converts
before the next naive write). **The Batch 4 mirror writes naive too** (`tests/unit/tournament-game-mirror.test.ts:101`
asserts `starts_at: '2026-05-17T14:00'`), so organizer-owned games are shifted as well — the coach's
calendar can disagree with the tournament they're playing in. **House League already does this
correctly** via `zonedWallClockToUtc()`. Both conventions are visible side by side in dev data.
This is the precondition for import (bulk-writing through a broken convention multiplies it).

⚠ Two handoff assumptions were **wrong** and are corrected in the plan: the event modal's discard
guard is **not bare** (it is hand-rolled with the banned "unsaved changes" copy — a migration, not a
build), and the schedule **does** have an export to round-trip against (`SCHEDULE_EXPORT_COLS`).
*(original entry below)*
P1 #6 (weekly recurrence locks one opponent — currently *more* clicks than not using it) + #7
(schedule import) + #9 (lineup touch targets) + the remainder of wow #2 (arm-care warning and richer
chips on the game-day card — its *downgrade* half shipped in Batch 4). ⚠ Recurrence and import both
write events; Batch 4 made the schedule carry organizer-owned mirrored games that must never be
touched by a bulk path — any new write path must respect `isMirroredEvent`.

**D · The parent-facing set** — *large; the commercial upside; needs an owner decision first*
Wow #4 (no-login "follow this game" link — the review's pick for most likely to spread), #5 (player
trading card), #6 (per-player season recap), #3 (postgame recap draft), #8 (printable certificates).
The review's judgement: the ingredients already exist server-side, so this is presentation work — but
**verify that before promising it.** Decide first whether this is a *retention* play or an
*acquisition* play; that changes what gets built and whether it's gated.

**E · Tryouts + Development tidy-up** — ✅ **BUILT ON DEV 2026-07-30 (uncommitted)** — plan + PM brief `COACH_PORTAL_CHUNK_E_TRYOUTS_TIDY_UP_{PLAN,PM_BRIEF}.md`; mockups artifact `82b6eac7-89b0-4c28-9d75-777e54e7f86d` rev 2 (approved = binding); **D-E1–D-E8 ratified at the recommendations + D-E9 owner-directed 2026-07-30: decision emails default OFF, opt-in switch.** 12 work items in one pass, NO migration: the signed-in "Score players" door (shared scorer component + persistent per-coach self identity, "(you)" chip) · discard guards on all five tryout forms + the silent-row-drop fix · the decision-email switch + per-row "Email this offer" + no-email/no-show chips + family's note surfaced + awaited sends + the offer-email timezone fix · depth-chart `.pageWide` + CoachScrollX · Development door copy split + "Returning player" relabel + awards/test-types honesty trio · evaluator link reissue-on-same-row + expiry display + loud mid-session lockout + revoke confirm · check-in client gate + hub fail-open fix + canWrite threading · rollover unfinished-tryout warning. Gate green (typecheck 0 / 600 units / lint 0 errors / six colour baselines ZERO / date ZERO / parity 0) + NEW tryouts probe suite **10/10** + Money regression 35/35. `/simplify` (11 applied) + `/review` (12 confirmed-fixed incl. a High rubric-category-loss case, 4 refuted, security lens clean) + `/docs` done. Remaining: fresh dev restart → owner QA → commit with per-action OK. *(original scope below)*
*Original entry:* — *small; independent of everything* — handoff prompt `COACH_PORTAL_CHUNK_E_TRYOUTS_TIDY_UP_BUILD_PROMPT.md`. It carries verified ground truth (the scoring surface at `/tryout-score/{token}` is good and must be REUSED — only the route to it is the defect; the hub's four cards + phase-auto-select behaviour; the two competing Development doors, both self-described as "a coverage view") and, at the owner's request 2026-07-30, a **discovery brief**: walk the tryout as the head coach, the volunteer evaluator handed a cold link, and the parent/candidate — including what a *declined* candidate currently experiences. ⚠ Its own D-G1 analogue: **the product must never appear to make the cut** — ranking and bias flags are decision support, not the answer.
P1 #16 (tryout scoring hidden behind an evaluator detour) + the Development-hub polish (two
overlapping "coverage" doors, a permanent "coming later" placeholder on brand-new teams, a blank
award picker). Good filler work; collision-free.

**F · The frozen past season** — ✅ **BUILT ON DEV 2026-08-01 (uncommitted, owner QA pending)** —
plan + PM brief `COACH_PORTAL_CHUNK_F_FROZEN_SEASON_{PLAN,PM_BRIEF}.md`; mockups artifact
`16ff15b9-09f5-4063-81f1-36b673d06adf` **rev 3 = approved = binding**. D-F1…D-F7 all settled;
**D-F1 and D-F3 and D-F4 were CHANGED by the owner** against the recommendations (tryout history
back IN · switcher off the phone's pages into More · no per-screen read-only banner). What shipped:
a year-aware season read rail resolving capabilities from **that season's** assignment row · ~20 GET
routes season-scoped · a season switcher (sidebar + More sheet) and a tappable `2025 · Complete` chip
that doubles as the phone exit · the closed-season nav opened 2 → 11 capability-gated doors ·
Staff kept live on a past season as read-access-only · a new tryout-history archive + returning-
candidate recognition · help rewritten with 28 new keywords + a new guide. NO migration.
**Three ledger claims were verified FALSE and are corrected in `memory/design_decisions.md`
(2026-08-01)** — most importantly *"capabilities resolved from the season's own assignment row"*,
which the shipped resolver did **not** do. Gate green (typecheck 0 · 730/730 tests · lint 0 errors ·
six colour baselines ZERO · date ZERO). Remaining: owner QA → run the new probe → commit with
per-action OK. *(original entry below)*
*Original:* — ***owner-picked next build 2026-07-31; handoff prompt ready:
`COACH_PORTAL_CHUNK_F_FROZEN_SEASON_BUILD_PROMPT.md` — run in a FRESH chat.*** Scope + the three
governing rules stay owner-DECIDED in §1.5; no decision outstanding on WHAT it does.
⚠ **RE-SIZE IT BEFORE COMMITTING TO "medium".** Verified 2026-07-31 while writing the prompt: the
season-READ resolver (`lib/coach-season-read.ts`) genuinely exists and is the right rail — but the
claim below that *"every rail it needs already exists… not new plumbing"* is **OVERSTATED**. Exactly
**one** route accepts `?year=` (`wrapped`) and exactly **two** use the season-read resolver
(`wrapped`, `history`); roster, schedule/results, lineups, attendance, money, documents, awards and
staff have **no year-parameterised read path at all**. The per-row "read-only past season" write
guards are likewise **partial** — roster/player paths only, not portal-wide. Treat F as a
**permissions chunk wearing a rendering chunk's clothes**: rules 1 + 3 mean a revoked assistant must
lose access to a *past* season, so every new read path is a potential leak of a former team-mate's
data. `/review` at the **high-risk** tier.
*(original entry below)*
Promoted from §1.5 to a first-class chunk (owner call, 2026-07-29) — it was being tracked as a
footnote and kept getting deferred. Full scope and the governing rules stay in §1.5.
*What it accomplishes:* a closed season becomes the whole portal again, read-only — roster,
schedule and results, lineups, attendance, money records, documents, awards — instead of the two
doors Batch 3 shipped (Season's End + the results archive). Every coach who was on that season's
staff keeps exactly the access their capabilities gave them at the time; staff management stays the
one live write surface and governs read access only.
*Why it hangs together:* every rail it needs already exists — the season-read resolver, the
per-season capability rule, the year-parameterised pattern and the read-only write guards all
shipped in Batch 3. This is the section pages learning a read-only mode, not new plumbing.
*Not a launch blocker* — the lockout is fixed and records are readable today.

**G · The budget starter** — ✅ **BUILT ON DEV 2026-07-30 (uncommitted)** — plan + PM brief `COACH_PORTAL_CHUNK_G_BUDGET_STARTER_{PLAN,PM_BRIEF}.md`; mockups artifact `77f5175e-7e5b-4f18-ba24-0a0eabc46729` rev 1 (approved = binding); **D1–D6 ALL RATIFIED at the recommendations 2026-07-30** ("I agree with all of your recommendations"). NO migration, as predicted. What shipped: first-run surface with three doors (starter / sample / manual) replacing the empty state · five tap-only questions → worksheet-as-preview → real lines through the existing write route with per-row outcomes · the derived "Not in your plan yet" checklist strip (taxonomy minus plan minus device-remembered dismissals — zero storage; the DB's `total_amount > 0` CHECK is why it is derived) · the fenced Riverdale 12U sample (budget + BvA tabs, uncopyable by construction) · `?starter=1` deep-link from the Money hub anchor · honest read-only empty state. Probes: full Money suite **18/18** @360×740 + desktop, incl. a data-level D-G1 assertion (no default item ever gains a `suggested_amount`). Remaining: owner phone QA → commit with per-action OK. *(original scope below)*
*Original entry (decided + built as above):*
*The gap:* a first-season coach opens Budget and gets a blank page. The Money hub names a next
action, but the action is "set a budget" and there is nothing behind it — no structure, no example,
no sense of what finished looks like. Coaches are volunteers, not accountants.
*Framing that narrows it (verified 2026-07-29):* this is a **first-season** problem, not a budgeting
problem. Season rollover already carries a planned budget and fee template into year 2+, so the coach
staring at a blank page is specifically the one starting out.
*What it accomplishes:* a coach answers a few plain questions (how many tournaments, roughly what
each costs, any off-season training block) and lands on a real starting budget they can edit — plus a
clearly-labelled **sample** budget and sample budget-vs-actual so they can see what they are building
toward before they build it.
*Two things the build must respect:*
1. **Structure beats numbers.** The real question is "what am I forgetting?" — forgetting umpire fees
   or tournament deposits wrecks a season; being 10% off on a line does not. A checklist of what teams
   like theirs budget for, with amounts blank, is most of the value at a fraction of the risk.
2. **⚠ Do NOT ship invented dollar figures.** Anchoring a coach low means they under-collect and end
   the season short — a real harm to a real family. Costs swing hard by region, sport, age and level.
   See the gating decision below.
*Cheapest high-value slice:* the sample/preview. Presentation only, asserts no number is right for
them, and answers most of the reassurance need on its own. Good candidate to ship first and alone.
*Sequencing:* **after chunk A** — ✅ satisfied; Chunk A shipped 2026-07-30 (`a737acbf`) and
deliberately left the Budget/BvA empty states minimal for this chunk to replace.
*✅ OWNER-DECIDED 2026-07-30 — no longer gated:*
1. **STRUCTURE ONLY. The product never proposes a dollar figure.** The starter says *what* to budget
   for, never *how much*. A number the **coach types** is theirs and is fine; a number the product
   supplies, prefills or suggests is not. Grounding suggestions in the platform's own real
   tournament entry fees was **considered and rejected** — costs swing hard by region, sport, age
   and level, and anchoring a coach low means they under-collect and a real family ends up short.
   ⚠ `budget_items.suggested_amount` exists as a column and the budget-line form honours it, but is
   NULL for every seeded default — **keep it that way.**
2. **Build the FULL starter in one chunk** — the guided questions producing a real editable starting
   budget **and** the clearly-labelled sample. (The "ship the sample slice alone first" option was
   offered and declined.)
*Handoff prompt ready:* `COACH_PORTAL_CHUNK_G_BUDGET_STARTER_BUILD_PROMPT.md` — **run in a FRESH
chat.** It carries the verified ground truth, including the big one: **the "what am I forgetting?"
checklist already exists in the database** (mig 027 seeds a global taxonomy — Tournaments /
Facilities / Officials / Training / Events with default items, **names only, not one carrying an
amount**), and season rollover already carries a planned budget forward — which is what makes this
a genuinely first-season-only problem.

**H · Money by month (the treasurer's ledger)** — **H1 (the view half) ✅ BUILT ON DEV 2026-07-30 (uncommitted)**; **H2 (import) planned + mocked, NOT built** — plan + PM brief `COACH_PORTAL_CHUNK_H_MONEY_BY_MONTH_{PLAN,PM_BRIEF}.md`; mockups artifact `ab72877e-c0e7-4a46-a1ce-89e6982c104e` rev 1 (approved = binding); **D-H1–D-H10 + the sequencing call ALL RATIFIED 2026-07-30** ("agree with your recommendations"). NO migration, as predicted.
*What H1 shipped:* a **Months view** on Budget vs. Actual (device-remembered) — rows = category → line, columns = the season's derived months, totals both ways — with a **Budget · Scheduled · Actual · Difference** lens toggle · a **"No date yet"** column for undated plan money (and the cumulative chart on the same page corrected to stop smearing it) · **cash-flow rows** inside the grid (Money in · Money out · Running balance) that project with the selected lens and name the month the team goes short · a **prior-season column** plus the "in last season's plan, not in this one" list · **drill-ins through the EXISTING forms** (a budget cell deep-links to the line editor with its dates open; an Actual/Scheduled cell opens a read-only breakdown) · **payables generalized** ("Expenses & Payables"; stored `expense_type` untouched) with a new **Payment schedule** tab (unpaid/paid/all, overdue flagged, money-out only) and a hub link into it · a lens-aware month-grid **export** (xlsx/csv/pdf from one column definition). Plus two folded-in fixes: the **line-PATCH taxonomy-ownership gap** Chunk G's review flagged (CONFIRMED present, now closed + probed) and the shared **`.modalFlushFooter`** desktop sticky-footer fix, retiring three private copies.
*Remaining for H1:* `/simplify` → `/review` → `/docs` → owner QA → commit with per-action OK.
*H2 (import)* — ✅ **ALSO BUILT ON DEV 2026-07-30 (uncommitted).** All three templates (month grid · simple list · payables schedule) on the roster-bulk pattern: paste **or** file, one editable preview with a verdict per row (Adds / Updates-naming-the-old-figure / Can't-import-with-a-reason), nothing written until confirmed, per-row outcomes reported after, and an honest error when nothing lands. **Templates carry structure and never a figure (D-G1)** — probe-asserted by downloading each one and checking no cell holds a digit. The month-grid reader also re-reads the app's OWN export (indented line rows, derived columns, total/cash-flow rows skipped), so export → edit → import genuinely round-trips. Doors: Import beside Add Line on Budget (plus a fourth door on Chunk G's first-run surface) and Import payables on Expenses & Payables. Gated on `money: write` only — **never** the org's `bulk_data_imports` plan feature. No migration; **no change to the public lines POST** (the commit route writes sort order directly). Gate green (typecheck / 533 unit tests / lint / six colour baselines) + Money probe suite **35/35**. *(original entry below)*
*What it accomplishes:* the month-grid view of the budget the owner runs in a spreadsheet today —
rows = category/line, columns = the season's months, cells = amounts, totals both ways — as a
desktop-first view on Budget vs. Actual (which already computes the monthly series for its
cumulative chart), with a **Budget · Scheduled · Actual · Difference** lens toggle and cell
drill-ins (budget cells edit that line's periods; actual cells list the month's paid expenses)
through the EXISTING forms. Payables generalize beyond tournaments (the machinery is already
category-aware; the "Tournament" framing is the only tournament-specific part — single-amount
payables already work) + one full payment-schedule view (every commitment by due date, paid
filterable). **Import/export templates** (owner-raised 2026-07-30): month-grid template (rows ×
month columns → lines + dated periods), simple list template (lump-sum lines), payables-schedule
template — all round-trippable with export, preview-first with per-row outcomes (roster-importer
pattern), and **amount cells ship EMPTY** (a template with example dollars is a product-supplied
figure — D-G1 applies). Chunk G's first-run surface gains an "Import a spreadsheet" door when H
ships. *Key ruled call:* **Scheduled is a separate LENS, not a write into the budget column** —
payables never merge into the estimate, so nothing double-counts and no payable↔line link
migration is needed for v1 (revisit linking only if lens-flipping proves annoying). *Ideas
accepted for the plan round:* cash-flow projection (dues in vs payables+periods out by month —
"do we run dry in July?"), a "last season" comparison column for year-2+ teams (rollover already
carries the data), month-grid export. *Sequencing:* after G (G creates the budget; H displays it).

**Not in any chunk, tracked separately:** the guardian model (§1.4, gated on CP-7), assistant-coach
first-run and inline roster quick-edit (§1.2 below).

### 1.2 Premium portal — walkthrough findings left open
From the owner-driven premium walkthrough (2026-06-26 → 06-28). These were explicitly deferred, not fixed:

- **Premium-specific getting-started help.** The coach guide's getting-started describes the FREE "Explore" model, which misleads paying coaches. → route through `/docs`.
- **Assistant-coach first-run.** Team Overview shows head-coach rail/checklist to assistants who can't action it. → belongs with the assistant-capabilities work.
- **Inline roster quick-edit.** Every jersey/position/contact change requires opening the full player profile — slow for first-time setup. Larger interaction change; deliberately deferred.

### 1.3 Mobile pass — ✅ COMPLETE (Chunk A, 2026-07-30)
Conventions are LOCKED (2026-06-29, logged in `memory/design_decisions.md`). Overview, Roster,
Schedule and the Accounting **Dues** exemplar were done; **Chunk A finished the tail** —
expenses, tournament payables, allocations, budget-vs-actual and fundraiser detail.

⚠ **It was NOT "mechanical, follows the Dues exemplar exactly", and a future reader should not
repeat that assumption elsewhere.** Two of the five surfaces were never tables at all: Budget and
Budget vs. Actual are fixed-pixel CSS grids, and Budget vs. Actual is a **comparison** that would
have been destroyed by card-stacking. The list-vs-grid ruling and the scroll-hint primitive that
came out of it are binding (`memory/design_decisions.md`, 2026-07-30). Chunk A also fixed the
Budget line form, which uses its own local layout and therefore never received Batch 1's shared
one-column phone reflow at all.

### 1.4 Get the guardian model right — NOT BUILT
The only fully unbuilt item in this program. Free portal stores player + guardian as a **single name
box**; Premium stores **first and last separately**. On upgrade we have to guess where the first name
ends. Owner-decided in principle 2026-06-24; never built. **Decisions still open — see §2.**

**Scope widened 2026-07-28 (owner raised it at Batch 2 QA): a player can hold only ONE parent/guardian.**
Separated parents, two working parents, a grandparent doing the driving — all common, none supported.
The emergency contact is the only second person we store and it's name + phone, never messaged.
**Do this WITH the name split, not as its own project:** both reshape the same guardian fields, and
every surface they touch is the same one — the add-player form, bulk-import columns, the spreadsheet
template, exports, the PDF, the player profile, and the announcement / dues-reminder recipient logic.
Shipping them apart means disturbing all of that twice, including two rounds of owner QA.
Also fold in the readiness review's P1 *"clarify what guardian fields actually do"* (today they're
contact-only — no parent login or account link — and support fields the question); one piece of work
that makes the guardian model correct, consistent, plural, and honestly described.
⚠ **The decision that gates it is a money decision, not a UI one — see CP-7.**
Note: CP-3 ("guardian optional on the Premium add form") is effectively satisfied — Batch 2 collapsed
guardian contact behind a disclosure, so it no longer reads as required.

### 1.5 Past-season read-only DETAIL views for coaches — NOT BUILT (owner-requested 2026-07-29, at Batch 3 QA)

**The ask (owner):** on a standalone team the coach *is* the admin — when they want to look
something up from a past season (who was on the roster, what the schedule looked like, what a
specific game was), they should get read-only detail views of that season, not only the
summaries-and-Wrapped archive Batch 3 shipped. Today the coach-side archive (Insights →
results report → Past seasons) shows every score + per-season record/roster-count/money
summaries + Season Wrapped; club ADMINS additionally have full read-only past-year detail
pages (roster / schedule / coaches tabs) that standalone coaches have no equivalent of.

**Scope — OWNER-DECIDED 2026-07-29 (supersedes the earlier "decisions to bring to build"):**
a past season stays **as if it were live, but read-only** — the full portal view of that
season, not a curated subset. The governing rules:

1. **Same access as when it was live, for everyone who had it.** Every coach on that
   season's staff — head or assistant, org-owned or standalone — keeps read access to
   exactly what their capabilities showed them then. An assistant who couldn't see money
   during the season can't see it in the archive either; one who could, still can (read-only).
   Capabilities are already stored per season, so "what they had then" is the recorded truth,
   not a reconstruction.
2. **Everything is read-only** — every section they could reach renders view-only; no
   writes anywhere in a closed season...
3. **...except staff/entitlement management, which stays live — but now only governs
   READ access.** The head coach (and, for club teams, the org admin) can still manage the
   closed season's staff list at any time: revoking an assistant removes their read access
   to that past season; capability changes narrow/widen what of it they can see. This is
   the one deliberate write surface on a closed season, and it writes only to who-can-see.

**What Batch 3 already shipped (the interim + the rails):** Season's End + Wrapped + the
results archive as the closed-season surface; the season-READ resolver
(`lib/coach-season-read.ts`, GET-only, closed assignments admitted, capabilities resolved
from the SEASON'S OWN assignment row — rule 1 falls out of this design); the `?year=`
pattern (`/wrapped`, `/season-end?year=`); per-row "past season is read-only" write guards.

**Build outline (follow-up project, own plan + mockups when picked up):**
year-parameterized READ routes for the sectioned data (roster, schedule/results, lineups,
attendance, money records, documents, awards/development, staff) + a portal-wide read-only
rendering mode for the section pages (controls hidden/disabled, "read-only — season
complete" chrome) + the staff page kept operative on closed seasons with its revoke/caps
writes re-pointed at the closed year (a scoped exception to the write guards) + nav that
opens the full section set for a closed season instead of the current two doors. Larger
than the earlier "three detail tabs" cut — it is the full frozen portal — but every write
guard and access rail it needs already exists. No migration expected.

**Sizing/priority:** medium; natural slot right after Batch 4 (tournament-game tools). Not
a launch blocker — the lockout is fixed and records are readable today; this deepens the
archive into the full frozen season.

### 1.6 Coach Portal Growth — Phases 2+
Phase 1 (per-page education strip, cross-shell brand continuity) shipped. Open:
- Phases 2–4 — brand-chrome continuity + education depth.
- Phase 5 — **self-serve checkout** (flipping the existing upsell CTAs from "express interest" to real checkout is a *label change*; the infrastructure is already built). Not blocked by 2–4.
- Phase 6 — modal-layer admin inside the coach shell. **Large, deferred.**

### 1.7 Lineup — deferred sport-neutrality gaps
Lineup Intelligence P0–P5 and the Lineup Builder Phases 1–4 are built and live. Known gap carried
forward: parts of the lineup surface assume diamond sports. Benign while only softball/baseball are
offered and Multi-Sport Phase 2 is paused — **must be swept before any non-diamond sport is enabled**.
Cross-reference: `PROGRAM_TOURNAMENT_ENGINE.md` §Multi-Sport.

### 1.8 Free-coach removal safeguard — Phase 4 tail
Phases 1–2 (preserve a free Coaches Portal when removing an org admin who is also a free coach) are
built and live. Phase 4 — the same informed-consent warning on the **platform-admin customer-user
delete** path — was owner-approved 2026-06-27; confirm at pickup whether it landed.

---

## 2. Decisions required from you

| # | Decision | Recommendation |
|---|----------|----------------|
| CP-1 | **Retire the Coach Nav Rebuild plan?** It has 7 unanswered design questions (OQ-1…OQ-7) about the *free* coach shell — but the in-flight Free Coach Portal Experience (A1–A4, B1–B3) rebuilt that shell on a different model (consumer-family chrome). The two plans now contradict each other. | **Retire it.** Carry forward only **OQ-7** (how to persist which team-ops capabilities a coach has activated per team) — that question is still unanswered and still real. |
| CP-2 | **Player/guardian name split — does the coach's own name get the same treatment?** The person registering a team is a coach, not a player/guardian. | Treat separately; don't bundle. |
| CP-3 | **Guardian becomes optional in the Premium add-player form** (to match the free side)? | Yes — "consistent across the board" was the point of the project. |
| CP-4 | **Tournament registration rosters in scope** for the name split? | Yes if they capture a single name field; first build step verifies. |
| CP-5 | **Coach Portal Growth Phase 5 — flip self-serve checkout to live?** Infrastructure is ready; it's a label change. Gated by the Premium-$0-until-2027-01-01 founding decision. | Hold until the January 2027 conversion runbook is scheduled — flipping now sells something you're currently giving away. |
| CP-6 | **Premium getting-started help rewrite** — schedule now or bundle with the next `/docs` sweep? | Bundle with the next `/docs` sweep. |
| CP-7 | ✅ **DECIDED 2026-07-30 (owner): the model STAYS one guardian per player.** The multi-guardian expansion raised 2026-07-28 is declined — no second contact, no nominated-payer machinery; dues and announcements keep today's single addressee. §1.4 shrinks back to the name-split + "clarify what guardian fields do" work only. ~~When a player has two guardians, who gets the dues reminder — both, or one nominated payer?~~ (raised 2026-07-28; gates §1.4's multi-contact scope.) The same question decides whether announcements go to every contact, which changes what the pre-send recipient count means. Getting it wrong means a household is chased twice for one payment, or one parent silently never hears anything. | **Needs an owner ruling before build** — it's a money/messaging call, not a UI one. Leaning: announcements → all contacts; dues → one nominated **billing contact** per player, defaulting to the first, so money has exactly one addressee and no family is double-chased. |

---

## 3. Verification debt (single item, replaces ~14 stale "awaiting browser verification" markers)

The following shipped to production without a recorded owner browser sign-off. They have been live
for 4–8 weeks with no reported defect, so treat this as **cleanup, not risk**: Phase-5 season &
division rollover · premium migration retry · player-profile Wave B · lineup builder · lineup
intelligence P0–P5 · mobile pass (Overview/Roster/Schedule/Dues) · free-coach removal safeguard
P1–P2 · registration form Stage-1 polish · free-tier coach slices 5·0–5j.

**Suggested close-out:** one owner pass through the premium portal on a phone during the Batch 1/2 QA
you already have queued, then strike this section.

---

## 4. Shipped — reference only

- **Unified Coaches Portal** — one portal for tournament-coach records, paid standalone workspaces, org-billed and Club coach access; legacy `/my` routes migrated to `/coaches`.
- **Free (Basic) coach floor** — org-less team route, master roster, standalone coach home, claim-by-email, phase-adaptive Team HQ, live schedule bridge, coach-side roster submit.
- **Premium upgrade flow** — two-screen value → confirm+pay, team pre-filled, roster/schedule/fees carried across with an honest "check this" summary; auto-retry + manual retry on partial carry.
- **Season & division rollover** — head coach starts next season themselves; roster carries, optional fee-template and planned-budget carry, previous season goes read-only.
- **Player profile Wave B** — emergency/medical, handedness, jersey size, dues + attendance at a glance.
- **Lineup builder + lineup intelligence** — Best/Okay/Never position ranking, pitching depth chart + arm-care caps, fairness checks, one-click auto-generate, field-ready printout, team depth-chart board.
- **Assistant coaches** — capability enforcement, head-coach invite/manage, admin oversight (free-side assistants dropped by owner decision).
- **Mobile pass** — Overview, Roster, Schedule, Accounting Dues exemplar.
- **Coach Portal Growth Phase 1** — per-page education strip + cross-shell brand continuity.
- **Free-coach removal safeguard P1–P2** — removing an org admin no longer silently destroys their free Coaches Portal.
- **Practice Plans 1a — "Write it"** *(BUILT 2026-08-01, awaiting owner QA; **uncommitted, NOT on prod**)* — the plan on the practice event: goal + kit, timed blocks (fixed / a range / one "rest of practice"), staff labels, players, coaching points, stations, groups incl. a deliberately-dumb random draw, and rotation blocks with a **computed group×round grid**; plus the focus rail, copy-from-a-previous-practice, and the one-page printed sheet. Rode along: the evaluation-session editable date + practice link with a re-stamp confirm (D10), the practice's "Recorded here" return section, and the Development hub pointer line (D9). ⚠ **mig 213 is dev-only — apply to prod before promoting.** Next slices: 1b run it → 2 drill library → 3 plan library → 4 helpers (gated). See `COACH_PRACTICE_PLANS_PLAN.md`.

---

## 5. Source files consolidated (archive candidates)

`COACHES_PORTAL_UNIFIED_PROJECT_PLAN.md` · `COACHES_PORTAL_UNIFIED_PM_BRIEF.md` ·
`COACHES_EXPERIENCE_EVAL_PLAN.md` · `COACHES_EXPERIENCE_EVAL_PM_BRIEF.md` ·
`COACH_EXPERIENCE_WALKTHROUGH_PLAN.md` · `COACH_EXPERIENCE_WALKTHROUGH_PM_BRIEF.md` ·
`COACH_EXPERIENCE_WALKTHROUGH_TEST_SCRIPT.md` · `PREMIUM_COACHES_PORTAL_WALKTHROUGH_PLAN.md` ·
`PREMIUM_COACHES_PORTAL_WALKTHROUGH_PM_BRIEF.md` · `COACHES_PORTAL_MOBILE_PLAN.md` ·
`COACHES_PORTAL_MOBILE_PM_BRIEF.md` · `COACH_NAV_REBUILD_PLAN.md` · `COACH_NAV_REBUILD_PM_BRIEF.md` ·
`COACH_PORTAL_GROWTH_PLAN.md` · `COACH_PORTAL_GROWTH_PM_BRIEF.md` ·
`COACHES_PORTAL_LINEUP_INTELLIGENCE_PLAN.md` · `COACHES_PORTAL_LINEUP_INTELLIGENCE_PM_BRIEF.md` ·
`COACH_LINEUP_BUILDER_PLAN.md` · `COACH_LINEUP_BUILDER_PM_BRIEF.md` ·
`PREMIUM_COACHES_PORTAL_PLAYER_PROFILE_WAVE_B_PLAN.md` ·
`PREMIUM_COACHES_PORTAL_PLAYER_PROFILE_WAVE_B_PM_BRIEF.md` ·
`COACH_PREMIUM_UPGRADE_FLOW_PLAN.md` · `COACH_PREMIUM_UPGRADE_FLOW_PM_BRIEF.md` ·
`COACH_PREMIUM_PHASE5_SEASON_DIVISION_PLAN.md` · `COACH_PREMIUM_PHASE5_SEASON_DIVISION_PM_BRIEF.md` ·
`COACH_PREMIUM_MIGRATION_RETRY_PLAN.md` · `COACH_PREMIUM_MIGRATION_RETRY_PM_BRIEF.md` ·
`COACH_PREMIUM_RELEASE_CHECKLIST.md` ·
`FREE_COACH_REMOVAL_SAFEGUARD_PLAN.md` · `FREE_COACH_REMOVAL_SAFEGUARD_PM_BRIEF.md` ·
`CONSISTENT_PLAYER_GUARDIAN_NAMES_PLAN.md` · `CONSISTENT_PLAYER_GUARDIAN_NAMES_PM_BRIEF.md` ·
`FREE_TIER_COACHES_UNIFIED_PLAN.md` · `FREE_TIER_COACHES_UNIFIED_PM_BRIEF.md` ·
`FREE_TIER_COACHES_PHASE_5_BUILD.md`
