# BUILD PROMPT — Playing-Time Vocabulary Sweep

> Paste this whole file into a fresh chat. It is self-contained: the ruling, the exact words, a
> verified file inventory taken **2026-08-05**, the discipline rules, and the definition of done.
> Read `docs/projects/active/PLAYING_TIME_VOCAB_SWEEP_PLAN.md` first — this prompt executes it.

---

## 0. What this is

A **copy-only sweep**. No schema, no gates, no features, no new components, no migration. You are
changing the words the app uses about playing time so that they **measure** and never **judge**.

**The ruling (owner, 2026-08-04 — logged in `docs/agents/strategy/BUSINESS_DECISIONS.md`, binding,
do not re-litigate):** rep teams deliberately skew playing time toward stronger players. The app
must never imply the platform expects, audits, or scores "fair" playing time across the whole team.
The metrics all stay exactly as they are. Only the framing changes: *where minutes go*, *who the
team leans on* — never *is this fair*.

Nothing about the underlying features changes — bench-sit warnings, pitching caps, the even-rotation
auto-fill option, and A-squad skew modes all behave identically after this sweep.

---

## 1. The ratified reword set (owner-approved — use these words verbatim)

| Surface | Today | Becomes |
|---|---|---|
| Insights doorway tile + playing-time report title | "Is playing time fair?" | **"Where is playing time going?"** |
| Overview Playing time tile verdicts | "Fairly even" / "Uneven" | **"Evenly spread" / "Leans on a few"** |
| Family player recap band copy | "the team's fair-play band" | **"the team's typical range"** |
| Lineup auto-fill / Reshuffle copy | "a fresh fair arrangement" | **"a fresh arrangement with even bench rotation"** |

Everything else you find follows the same principle — **describe the mechanic or the distribution,
never judge it**. Those extra words are your judgment call; keep them consistent with the four
above, and list every one you invented in the handoff so the owner can veto individually.

---

## 2. Verified inventory (grepped 2026-08-05 — confirm before editing, the tree moves)

### Coach-facing screens
- `app/[orgSlug]/coaches/teams/[teamId]/history/page.tsx` — Insights doorway tile: *"Is playing time fair?"*
- `app/[orgSlug]/coaches/teams/[teamId]/history/playing-time/page.tsx` — page `<h1>`: *"Is playing time fair?"* (plus a code comment on the sort order — comment optional)
- `app/[orgSlug]/coaches/teams/[teamId]/page.tsx` — Overview tile verdicts `'Fairly even' : 'Uneven'` (and a design comment above the tile block)
- `app/[orgSlug]/coaches/teams/[teamId]/lineups/page.tsx` — the "why save a lineup" payoff line: *"…Insights uses it to answer whether playing time has been fair across the season."*
- `app/[orgSlug]/coaches/teams/[teamId]/lineups/_LineupEditor.tsx` — **four hits**: the Reshuffle confirm dialog (*"a fresh fair arrangement"*), the auto-fill note (*"Auto-fill shares playing time fairly"*), the Reshuffle button `title` (*"Fresh fair arrangement…"*), and the bench-spread pill `'Uneven' : 'Balanced'` (align with the Overview verdicts)
- `app/[orgSlug]/coaches/teams/[teamId]/attendance/page.tsx` — *"A season view to support fair playing-time and spot when someone's drifting away"*
- `components/coaches/PositionProfileEditor.tsx` — *"Playing time stays fair (no back-to-back sits)"* → describe the mechanic

### Family-facing (highest stakes — a parent reads this)
- `components/family/PlayerRecapView.tsx` — `in_band: "Right in the team's fair-play band all season"` → typical-range wording. The `above_band` / `below_band` labels already read neutrally; leave them.
- `lib/player-season-recap.ts` — a doc comment describing the band as "fair-play band"; the band **keys** (`in_band`/`above_band`/`below_band`) are internal — do not rename.

### Help content (same pass, not a follow-up)
- `lib/help-content/coaches.tsx` — ~12 display hits across the Insights guide, the Lineups guide,
  the Overview-tiles FAQ, the attendance/season-view entries, and the family-recap entries
  (*"Is playing time fair?"*, *"whether it's coming out fair"*, *"shares playing time fairly"*,
  *"keeps the bench fair"*, *"fair-play band"*, *"support fair playing-time"*).
  **Every `answerText` must stay a faithful plain-text mirror of its rendered `answer`** — change
  both or search results will quote wording the screen no longer shows.
  **`keywords` / `searchText` KEEP the word "fair"** — coaches will still type it, and search only
  matches those fields. Add the new phrasing as additional keywords; don't remove the old ones.

### Verify-only (already ships the new vocabulary — do not re-edit)
- Game-Day Mode P1/P2/P3 (`…/coaches/teams/[teamId]/game/[eventId]/page.tsx`) — built after the
  ruling. Confirm it reads correctly alongside your new wording; its only `fairPlay` reference is
  the internal data field.

### Out of scope — leave every one of these alone
- **Tryout fairness vocabulary** (blind evaluation, "names hidden for fairness", the fairness
  receipt in the report + PDF export, tryout help entries). Owner ruling: it is an
  **evaluation-integrity promise**, a different concept, deliberately KEPT.
- **Tournament schedule generator** — *"Default fairness across rest, facility moves, daily load…"*
  is scheduling equity between teams, not playing time. Out of scope; flag it in the handoff if you
  think it deserves its own ruling later.
- **Old release notes** — historical record, stays as written.
- **Internal identifiers and comments** — `fairPlay`, `PlayerFairPlay`, tier `'fairness'`,
  `lineupFairness`/`lineupFairPill` CSS class names, `.fairPlay` API payload keys, the "fair
  denominator" comment. Renaming these buys nothing user-facing and costs a large, risky diff.
  Leave them. (Rewording an adjacent explanatory comment while you're in the file is fine.)

---

## 3. Discipline (shared working copy — several other sessions are live in this tree)

- Branch is **`dev`**. Confirm before you commit; another agent may have switched it.
- **~55 files are uncommitted from other sessions.** Several of your in-scope files carry *their*
  hunks (help content, coach overview, ask-questions). **Never `git add -A` / `git add .`** — stage
  explicit pathspecs only, split mixed files hunk-level, and after committing run `git show --stat HEAD`
  to confirm only your changes landed.
- **Commit only with the owner's explicit OK**, per action. Do not carry an earlier OK forward.
- ⚠ **NEVER round-trip a source file through PowerShell `Get-Content | Set-Content`** — the default
  ANSI read re-encodes every non-ASCII character and mojibakes the whole file (this cost a session
  already). Use the Edit tool, or bash. Check `git diff --stat` after any scripted rewrite: a
  40-line change that shows 400+ lines means you corrupted the file — `git restore` it and redo.
- Bracketed directories need `:(literal)` pathspecs (`[orgSlug]`, `[teamId]`) or git stages nothing.
- No dev-server restart is needed for copy edits (hot reload). Don't restart one — the owner has
  QA sessions queued.

---

## 4. Definition of done

1. Every in-scope display string reworded; the four ratified phrasings used verbatim.
2. Help content updated **in the same pass**, with `answerText` mirrors in sync and "fair" retained
   in `keywords`/`searchText`.
3. `npm run verify:changed` clean; `npm test` full suite green (unit tests reference only the
   internal `fairPlay`/`'fairness'` identifiers, so a clean sweep should not move a single
   assertion — **if a test breaks, you touched an identifier you were told to leave alone**).
4. `npm run typecheck` if you touched anything under `lib/`.
5. **Grep gate:** `[Ff]air` across `app/`, `components/`, `lib/` — every survivor must be tryouts,
   the schedule generator, internal, or historical. List the survivors in your handoff.
6. Add a **QA section to `docs/projects/active/OWNER_QA_LEDGER.md`** covering: Overview tile
   wording; Insights doorway + report title; a family recap preview showing "typical range"; lineup
   Reshuffle copy and the bench-spread pill; the auto-fill note; and an explicit check that
   **tryout surfaces are UNCHANGED** (the fairness receipt still says "fairness").
7. Update `TODO.md` (one line, linked to the plan doc) and the memory index entry for
   `decision_playing_time_vocabulary.md` — flip it from "APPROVED NOT RUN" to run/QA-pending.
8. Move `PLAYING_TIME_VOCAB_SWEEP_PLAN.md` to `docs/projects/archive/` only **after** owner QA
   passes — not at build time.

**Quality passes:** `/simplify` is not warranted (no new abstraction — it's a copy diff). `/review`
at trivial-to-standard tier is worth one pass for the help-content edits, because a broken `.tsx`
string or a desynced `answerText` is the realistic failure mode here. `/docs` is **already folded
into step 2** — the help files are in-scope, not a follow-up.

**Report to the owner in product-owner voice**: what a coach and a parent now read differently,
which screens to spot-check, and the list of words you invented beyond the ratified four.
