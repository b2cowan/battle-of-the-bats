# Kickoff prompt — Practices re-evaluation: Stage 0 (Arrive)

*(paste into a fresh chat)*

**Pick up the Practices re-evaluation at stage 0 — "Arrive", the Practice plans hub — and only that.**
The walk is published and the stage 0 proposal is drawn; your job is to (a) get the eight stage 0
decisions ruled by the owner, (b) build stage 0 exactly as drawn, (c) walk it, and (d) open the
stage 1 tab ("The blank page") on the same artifact. Stages 1–6 are out of scope for code. Where this
prompt and the drawn frames disagree, the frames win; where the owner's rulings and the frames
disagree, the rulings win — and you redraw before you build.

**Already ruled by the owner (2026-09-14), do not re-litigate:**
- **Practice plans is the hub for three things — the season's practices, plan templates and the
  drill library.** Skills & Goals is metrics, player goals and sessions only, linked to a practice
  only by *when a session happened* (the session ↔ practice link). The two library pages leave
  Skills & Goals.
- **Tabs, not a dashboard and not stacked headers.** Practices · Templates · Drills; Practices is the
  landing. No overview tab, no tile row. The next-practice card and the "Needs a plan" chip are the
  room's whole state.
- **The nav entry keeps its name, "Practice plans."** (Nav gates are keyed by label; Lineups is
  named for the instrument too.)

---

## 1. Read first, in this order

1. **The artifact — the spec:** https://claude.ai/code/artifact/5c3d2f1b-5159-4d99-bad7-c48b2820da28
   Tab **"0 · Arrive"** is what you build: *Before* (the hub as built, five amber markers), *After* in
   three states plus the Drills tab moved whole plus the phone, the Overview card before/after, and
   **Decisions D1–D8**. Click every marker — the popover is the ruling for that element. Tab **"The
   walk"** is the record: stations 0, 2 and 6 and standing-back questions S.3 and S.4 are the reasoning
   behind stage 0; read them so you argue from the same evidence. Source file:
   `docs/projects/active/COACH_PRACTICES_REEVALUATION.html` — **republish the SAME path** (or pass its
   `url`) so the version history threads; a new path mints a new artifact.
2. **Memory** (auto-loaded): `project_coach_practices_reevaluation` (this walk — the owner's direction,
   D1–D8, the open boundary question, the artifact's build mechanics and the traps),
   `project_coach_practice_plans` (what the maker is and every ruling it carries — template = scaffolding
   vs drill = identity; people at one level; autosave; "Plan set" means at least one BLOCK),
   `project_coach_nav_and_practice_plans` (the hub: no new API, readiness rides the events read, the
   `isStale()` guard, templates LINKED never re-listed), `project_coach_development_lifecycle` (the
   sibling Skills & Goals stage 0 — Overview landing, tiles removed — check whether it has LANDED
   before you touch that page).
3. **The code you will change:**
   - `app/[orgSlug]/coaches/teams/[teamId]/practice/page.tsx` — the hub (header comment explains why
     it is not `CoachNotOnTeam`, why there is no per-practice probe, and the `isStale()` guard).
   - `app/[orgSlug]/coaches/teams/[teamId]/development/drills/page.tsx` and
     `…/development/templates/page.tsx` (+ `templates/[templateId]`) — the two pages that move whole.
   - `app/[orgSlug]/coaches/teams/[teamId]/development/page.tsx` — Skills & Goals' landing: the Drills
     and Plan templates tiles (the Drills tile is the drill library's ONLY door today — the tiles leave in
     the SAME commit the tabs arrive).
   - `app/[orgSlug]/coaches/teams/[teamId]/page.tsx` — the Overview's next-event card (D7).
   - `app/[orgSlug]/coaches/teams/[teamId]/schedule/page.tsx` — only if D6's deep link needs the
     Add Practice dialog to open from a query parameter (check what `?event=` already does and add the
     smallest sibling).
   - `components/coaches/CoachTabBar` (the Skills & Goals tab idiom on `?section=`), `CoachEventListRow`,
     `CoachEmptyState`, `CoachesSidebar.tsx` / `CoachesBottomNav.tsx` (no label change — read only).
   - Guards that name these routes: `tests/unit/coach-page-actions-guard.test.ts` (a header's help host is
     derived from the PATH; a page rendered by a component derives it from its importers — all must
     agree), `tests/unit/coach-staff-routes-guard.test.ts` (route-gating registry — moved routes are
     re-registered, never dropped), `tests/unit/coach-history-endpoint-guard.test.ts` (`HISTORY_ENDPOINTS`
     — no moved route may learn a year), `scripts/layout-screens.mjs` (ids `coach-development-drills`,
     `coach-development-templates`, the template drill-in, `coach-practice-plans` — update the paths;
     baseline only NEW keys, with sibling reasons).
   - Help: `lib/help-content/coaches.tsx` — `premium-drill-library` ("Skills & Goals → Drills") and
     `premium-plan-templates` ("Development → Plan templates") both name the old door; `faq-practice-plan-where`
     names two ways in. Run `/docs` after the build.

## 2. Step one: get D1–D8 ruled, in chat, before any code

The owner rules on the artifact (Build as drawn / Change it / Not now, with a note) and pastes the
**"Build the stage summary"** text into the chat. If the paste has not happened, walk them through
D1–D8 one at a time here — one sentence each, the drawn answer, the one thing that rides on it — and
record the ruling. Do not start code with an unruled decision; "Change it" means redraw that frame
and republish, then build.

The eight, as drawn:
- **D1** The hub opens on the **next practice** as one card that owns the room's one lime — *Plan this
  practice* (no plan) · *Open the plan* (plan set) · *Run practice* (within the run window, the same
  ±3-hour window the row already uses). No upcoming practice → no card. Nothing new stored.
- **D2** **"Needs a plan" counts upcoming practices only**, absent at zero. (A defect today: it counts
  practices that already happened. Fix even if everything else is Not now.)
- **D3** A **past** practice is a record: chip "No plan written", action "Open" (read-only) — never
  "Plan this practice". A past practice with a recap shows the recap's first line on its row.
- **D4** A planned row states the fit — "3 blocks · 60 of 90 min" — only when the practice has an end
  time; otherwise as today.
- **D5** A **tab bar — Practices · Templates · Drills** — Practices the landing. The Templates and Drills
  pages move under it **whole** (same rows, same actions, no back arrow to Skills & Goals). Stage 4
  redraws their rows; this stage does not.
- **D6** The fresh-team empty state keeps its shape, loses half its words, gains the arc
  ("Schedule it → Plan it → Print it or run it → Write how it went"), and its button opens the Add
  Practice **form**, not the Schedule list it sits behind.
- **D7** The Overview's next-event card, when the next event is a practice, follows the practice's
  state (Plan this practice / Open the plan / Run practice); "Take attendance" stays as the quiet link.
- **D8** No overview tab, no tiles.

**The open boundary question is NOT stage 0's** — the practice room reads goals in two places (the
rail beside the plan; the printed sheet's last section) and Insights reads plans for coverage. The
recommendation on record is to keep those reads (rail folded shut by default). It is ruled at the top
of the stage 1 tab. Do not touch the rail, the sheet or Insights in this stage.

## 3. Scope — what stage 0 builds

- The hub's landing becomes: page header → tab bar → next-practice card → "Needs a plan" chip →
  Coming up / Recent practices lists → nothing else. The past rows change chip and action (D3), the
  recap line appears (D3), the fit line appears (D4). The foot link to templates goes (it is a tab).
- Tabs are **real addresses** in the portal's existing idiom (Skills & Goals: `CoachTabBar` on
  `?section=`); the drill and template drill-ins move under the Practice plans room. **Old addresses
  redirect** (`/development/board` → Players is the in-repo precedent). A link that 404s is the same bug
  wearing a politer face.
- Skills & Goals loses the Drills and Plan templates tiles — coordinate with the sibling stage 0
  there (its Overview landing may or may not have landed; check `git log` and memory; do not duplicate
  and do not leave the drill library door-less for a single commit).
- The Overview card (D7) — the smallest change, on another screen.
- The empty state (D6) and its deep link.
- Gates that must stay green and what they will say: `npm run verify:changed` (spelling gate included),
  `npm run typecheck` (routes move — `npx next typegen` first), the unit guards named in §1.3,
  `npm run check:layout -- --only=<ids>` for every touched screen, `npm run check:demos` (a tour
  destination that stops existing fails the build; the demo tour lands on `/development` expecting
  the sessions card — untouched by you, but run it).

**Out of scope, do not build:** anything on the plan page (stages 1–3), the library rows and the
docked panel and drag (stage 4), the run door's window on the plan page and "everyone" chips
(stage 5), "How it went" timing (stage 6), a nav rename, a per-practice probe, a fourth tab, tiles.

## 4. Rules that bite (from the code, not from plans)

- **Lime is earned, never decorative.** The card owns the room's one lime; no other lime on the
  landing. The header has no action.
- **"Has a plan" = at least one block** (`practicePlan.blocks.length > 0`) — never the row's existence;
  a goal typed and abandoned is not a plan. The hub's `hasPlan` and the card must share one definition.
- **No new API on the hub.** `RepTeamEvent.practicePlan` rides the events read; the recap (D3) and
  end time (D4) must too — check the events read carries `practice_recap` and `endsAt` before
  assuming; if the recap is not on the events read, D3's recap line is a question back to the owner,
  not a new per-row fetch.
- **One run window.** The card and the row use the SAME constant (today `RUN_WINDOW_MS` on the hub).
- **`isStale()` on every state write** — the page does not unmount when the team segment changes.
- **Live-season only.** The hub, the tabs and the drill-ins never gain a year parameter
  (`HISTORY_ENDPOINTS` guard); the closed-season page keeps its own practice shelf and guards.
- **Templates are ONE home** — moved, never duplicated. Nothing about a drill or a template changes.
- **Capability gates travel with the pages:** the hub reads on `schedule`; the templates door gated on
  `canManageSchedule`; the drills page's write gate — keep each page's gate exactly as it is at its new
  address, and make the tab ABSENT (not disabled) for a viewer the page would refuse.
- **Every customer-visible word passes the spelling gate**; times read "3:31 p.m."; one spelling of
  "practice plan" everywhere (`data-label`s included).
- **Reorder with buttons, never drag** still stands in this stage (S.4 is the owner's call at stage 4).

## 5. Process gates (blocking, in order)

1. **PM UX summary in chat before code** — what a coach sees and does differently, per decision.
2. **Rulings in hand** (§2). Any deviation you discover mid-build goes back as a question with a
   redrawn frame, never a silent judgment call.
3. **Plan + PM brief:** create `docs/projects/active/COACH_PRACTICES_REEVALUATION_PLAN.md` (the stage
   ladder 0–6, stage 0 in full, the boundary question logged as OPEN) and
   `COACH_PRACTICES_REEVALUATION_PM_BRIEF.md`; update the TODO line (it exists — under the Practice
   plans hub entry). Add "Plan" and "PM brief" tabs to the SAME artifact so the project reads as one
   page (the hub template `docs/agents/design/PROJECT_HUB_TEMPLATE.html` shows the tab pattern; the
   artifact's `panels` map in its script must gain the new keys).
4. **Build to the frames.** NEW / RESTYLED / UNCHANGED is the scope; an existing element the frame
   shows restyled is restyled.
5. **`/simplify`** (only if a new abstraction appeared — e.g. a shared "practice state → action"
   helper used by the card, the row and the Overview: that is the one to want), then **`/review`**,
   then **`/docs`** (the two door sentences and the "two ways in" FAQ).
6. **QA walk as a tab on the same artifact** — checkboxes persisted in `localStorage`, progress count,
   per-part verdict, notes, paste-back, and the **Sign in as** card (localhost:3000 ·
   `uat-coach@uat-test-org.local` · the dev password from `.env.local` · UAT Test Team · plus
   `uat-asst-nomoney@` for the view-only assistant on the tabs). Pin **identities**, never as-of-today
   figures. Ledger section at the next free § at the tail of `OWNER_QA_LEDGER.md` (never re-sort).
7. **Then open the stage 1 tab** — "1 · The blank page": the plan page as a document (date · time ·
   length; the timeline; the first block; the rail as a fold; the sheet-shaped page — S.1 is decided
   there), before/after at TRUE SIZE in the portal's tokens, desktop 1440 and phone 390 with the 844
   fold drawn, clickable markers, decisions with Build-as-drawn / Change-it / Not-now and a paste-back;
   the boundary question (goal reads on the plan page and sheet) as its first decision. Mockups before
   any code — no stage 1 code in this chat.
8. **Commit only on the owner's word**, on `dev`, explicit pathspecs, `git show --stat HEAD` after; if
   peers have staged work in shared files, build the commit in a private index. Update memory.

## 6. Fixture, and how to look

- UAT: `uat-test-org` · UAT Test Team `3127a094-458f-4b78-8726-17342a8e37a6` · head coach
  `uat-coach@uat-test-org.local`. Practices: Team practice 1 (May 5, no plan), Practice review — written
  up (May 14, one block + recap), UAT probe practice `773afff0-5777-447f-87bd-7686ec4bc6b1` (Sep 13,
  three blocks, rotation), Practice review — next week (Sep 20, the next). Library: one drill, sixteen
  templates (fifteen empty — the fixture's noise, and a real product gap for stage 4).
- The dev server: `npm run dev` only (never a bare `next dev`); restart after routes move (new files);
  stop it BEFORE deleting `.next`.
- Screens: Playwright with `storageState: tests/uat/.auth/coach.json`; the walk's capture scripts lived
  in the previous session's scratchpad and may be gone — ten lines recreate them. ⚠ The builder's
  drill-picker dialog does not close on Escape (a walk finding); close via the dialog's Close button.
- A fresh team with no practices is NOT in the fixture; the empty state is walked by temporarily
  filtering, or by seeding a second team — say which in the walk.

## 7. Artifact mechanics (so you edit it without breaking it)

- The file is assembled: `<title>` + Google Fonts links + a `<style>` block copied verbatim from
  `COACH_DEVELOPMENT_LIFECYCLE_REEVALUATION.html` (lines 3–341 there) + the walk panel + the proposal
  panel + one `<script>`. Embedded screenshots are JPEG data URIs (~690 KB total); keep the whole page
  under 16 MB. Edit the assembled file directly from here on.
- Tabs: `.tabs` nav with `.tab[data-tab]` buttons; panels `#tab-walk`, `#tab-arrive`; the script's
  `panels` map decides which ids exist — add `stage1`, `plan`, `brief`, `qa` there when you add tabs.
  State lives in `localStorage` under `reeval-practices-v1` (`a-<q>` answers, `n-<q>` notes,
  `d-<station>` design notes, `-tab`, `-fit`). Never use the artifact runtime capability for tick
  state (every open view reloads).
- Frames: `.framewrap > .frame > .pf` (portal facsimile; phone = `.pf.ph.tall` with `.bar` and
  `.fold`); markers sit INSIDE the element they explain — `.an` wrapper + `.mk` (amber) / `.mk.ok`
  (green) + the `.pop` immediately after it; `.mk.r` for a right-anchored marker. "Fit to window" is the
  default; "True size" is the second option.
- Traps met: the inherited `.u` (quoted copy) is `white-space:nowrap` — overridden in this file, keep
  it; `html{scroll-behavior:smooth}` blanks `scrollIntoView` screenshots (use element screenshots); a
  flex line with two `<b>` separated by a bare " · " loses the separator — wrap the pair in a `<span>`;
  the rail reads `#tab-walk section[data-title]` — a new walk section must carry `data-title`.

## 8. Do not

- Do not build stages 1–6, or fix the plan page's listed defects "while you are there" — they are
  logged and belong to their stages (the walk's "Across the walk" section lists them).
- Do not add a per-practice probe, a fourth tab, a tile row, a "Practices" nav rename, or drag.
- Do not touch the rail, the sheet or Insights (the boundary question is stage 1's).
- Do not leave the drill library without a door for even one commit.
- Do not re-seed the demos by hand or add "re-read the demo" notes; `check:demos` is the only per-commit
  demo signal.
