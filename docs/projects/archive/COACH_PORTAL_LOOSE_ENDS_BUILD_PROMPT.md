# Build Prompt — Free Coach Portal: the four loose ends

Paste everything below this line into a fresh chat.

---

Pick up the **four loose ends** left behind by the Free Coach Portal Experience program
(A1–B3 + B2.1 + B2.3). None of them is part of that program's remaining phase (B2.2, the
alerts panel) — they were deliberately flagged and left alone so they wouldn't ride in on
someone else's unit of work. They are **unrelated to each other**; treat them as four
separate units of work with their own verification, not one batch.

**Do them in this order.** It runs cheapest-and-safest first, and puts the one that needs an
owner ruling before any code where you can't accidentally build it.

## Context to load first

- `docs/projects/active/FREE_COACH_PORTAL_EXPERIENCE_PLAN.md` — the **header (the PROCESS GATE
  is binding)**, then the B2.1 and B2.3 build records for items 3 and 1 respectively.
- Auto-memory: `project_free_coach_portal_experience`, `reference_turbopack_composes_and_theming`
  (item 2 is a documented instance of that gotcha), `feedback_doc_structure` +
  `feedback_docs_folder_convention` (item 4 is governed by them).
- `AGENCY_RULES.md` — the doc-structure rules item 4 has to satisfy.

---

## Item 1 — The admin animation that silently does nothing (smallest, do it first)

**Verified 2026-07-28 — re-verify, don't trust.** `adminSlideDown` is defined in
`app/[orgSlug]/admin/admin-common.module.css:430` but *animated* from **two** sites in a
different module: `schedule-admin.module.css:2985` and `:3046`. A CSS Module can't see another
module's keyframes — Turbopack rewrites `animation: <name>` to a module-scoped identifier, so
the reference resolves to nothing and the animation silently no-ops. It never *looks* broken
(an unmatched animation-name just doesn't run), which is why this survived.

> ⚠ Note the count: an earlier note called this "a one-line fix". It is **two** call sites.

**Fix:** define the keyframes in `schedule-admin.module.css` too (duplicating a 4-line keyframe
across modules is the correct answer here — `composes` is non-transitive and there is no shared
non-module stylesheet these both reach). Confirm against **compiled** output, not source:
`.next/dev/static/chunks/*_module_css_*.css`. The 2026-07-27 sweep that fixed 13 public
animations used exactly this method — reuse it.

**Also worth doing in the same pass:** grep every `*.module.css` for an `animation:` /
`animation-name:` whose keyframe is not defined in that same file. The public sweep covered
`app/(public)` and friends; **admin was never swept**. Report what you find before fixing en
masse — if it's large, that's its own unit of work, not this one.

**Accept:** the schedule-admin dropdowns visibly animate; every remaining cross-module
animation reference is either fixed or listed.

---

## Item 2 — `getStandings` reads the whole platform (real perf debt, own unit of work)

**Verified 2026-07-28 — re-verify, don't trust.** `lib/db.ts:1395`:

```ts
export async function getStandings(divisionId, config?, options = {}, tournamentSettings?) {
  const games = await getGames(undefined, options);   // ← no tournament filter
  const teams = await getTeams(undefined, options);   // ← no tournament filter
  return computeTournamentStandings(divisionId, teams, games, config, tournamentSettings);
}
```

Both reads skip the `tournament_id` filter and pull **platform-wide**, then narrow in memory.
This is pre-existing (public standings/champions/playoffs have always done it) — but **B1.6
added a high-frequency caller**: `components/coaches/CoachTournamentRecord.tsx:491`, which runs
on every coach's tournament record during a live event. It gets worse with every tournament
ever created, on a page load path, which is why it's now worth fixing.

**7 call sites** (verified): `preview/[tournamentSlug]/[section]/page.tsx:88`,
`[tournamentSlug]/champions/page.tsx:101`, `[tournamentSlug]/playoffs/page.tsx:88`,
`lib/db.ts:1528` (internal), `lib/public-tournament-data.ts:99`,
`CoachTournamentRecord.tsx:491`, `TournamentHomeContent.tsx:79`.

**Scope:** thread a `tournamentId` through `getStandings` and push the filter down into
`getGames`/`getTeams`. Every call site already has the tournament in hand — check each before
assuming. Prefer a **required** parameter over an optional one: an optional filter that a future
caller forgets silently restores the bug.

**Cautions:**
- This is a **shared-module signature change** → `npm run typecheck` is mandatory, not optional.
- `computeTournamentStandings` narrows by `divisionId`. Confirm that filtering the input set
  doesn't change any *result* — particularly tie-breakers, which read other teams' games.
  **A standings number that changes is a bug, not an optimization.**
- Check whether `getGames`/`getTeams` have other unfiltered callers with the same shape while
  you're in there — report, don't silently expand scope.

**Accept:** standings render identically before/after on a real multi-tournament org (compare a
division's full table, not just the top row), and the queries carry a tournament filter.

---

## Item 3 — ⚠ B2.1 bar placement: **get a ruling BEFORE writing code**

**This is NOT approved work.** Do not build it on the strength of this prompt.

B2.1's approved sketch (Plate 1) drew the "Schedule updated" bar at **page level**, above the
zone head. It ships **inside the schedule block**, which on game day sits *below* the standings
snapshot and the calendar button. The owner was told at build time and it was left as a
deviation.

**Why it wasn't just moved:** the 30s poll must stay single-owner (`CoachLiveSchedule` owns it
by design — see its header comment), and the tournament record page is a **server component**
that can't hold this client state. Lifting the bar means either a second poll (rejected) or a
portal/context indirection. That's a real structural change, not a tweak.

**What to do:** present the owner with the actual trade — the cost of the indirection, and what
they gain (the bar sits where the eye lands first on game day) — and get an explicit decision.
If they say build it, **the PROCESS GATE applies**: mockups showing the new placement in both
themes, approved before code.

**Related, same file, also undecided:** the poll runs on **game day only**
(`pollEnabled = canLinkPublic && phase === 'game_day'`), so a change made the night before
raises no bar — it simply renders correctly on next load. Widening that window has load
implications across every coach's record page and is its own decision. Raise it at the same
time so the owner rules on the pair.

---

## Item 4 — `docs/projects/active/` has become unusable as a signal

**Verified 2026-07-28:** `docs/projects/active/` holds **183** files; `docs/projects/archive/`
holds 304. Most of the 183 are finished work that was never moved, which makes *"what is
actually in flight?"* unanswerable by inspection — the exact question the folder exists to
answer.

**Scope:** an audit + archive sweep, governed by `AGENCY_RULES.md` and
`memory/feedback_docs_folder_convention.md`.

1. Classify every file in `active/` as **in flight** / **complete** / **abandoned** /
   **reference-that-should-never-have-been-here**. Judge from the doc's own status header AND
   from git/prod reality — a "Status: Planning" header on a shipped feature is exactly the drift
   that was caught on the discovery-directory plan on 2026-07-28.
2. `Move-Item` the complete/abandoned ones to `archive/`. Plans and their PM briefs move
   **together** — never orphan one from the other.
3. **Update every `TODO.md` link that pointed into `active/`.** A broken doc link is worse than a
   stale folder. Verify each moved path.
4. Anything that is really a *living reference* belongs in `docs/agents/<agent>/`, which is
   **never archived** — check before archiving it by mistake.
5. Report the surviving in-flight list. That list is the deliverable; the tidy folder is a side
   effect.

**Cautions:**
- **Read before moving.** A doc with an optimistic "COMPLETE" header may still carry open
  follow-ups in its body — those need to land in `TODO.md` before the file leaves `active/`, or
  the work is lost.
- This working copy is **shared with concurrent sessions**. A file you're about to move may be
  one another agent is actively writing. Check `git status` immediately before each move, and
  re-check `git rev-parse --abbrev-ref HEAD` before committing.
- Do this as **one commit**, separate from items 1–3, so a bad move is trivially revertible.

---

## Binding rules (all four items)

- **`dev` branch only.** Shared working copy — re-check `git rev-parse --abbrev-ref HEAD` before
  committing, stage **explicit pathspecs only** (`:(literal)` for `[bracketed]` route dirs), and
  verify `git show --stat HEAD` after every commit.
- **Never commit without the owner's explicit per-action OK.**
- **Four separate commits.** These items share nothing; one commit would make any of them
  painful to revert.
- Report to the owner in **product-owner voice**: UX outcomes, not file paths.
- Item 2 touches a shared module and item 1 touches admin CSS → run `/review` on those two.
  Items 3 (if approved) and 4 use judgement: review the code, not the doc moves.

## Verification per item

- **1:** compiled-CSS check + `npm run verify:changed` (the colour-token ratchets cover CSS).
- **2:** `npm run typecheck` **mandatory** + a real before/after standings comparison.
- **3:** N/A until approved.
- **4:** every `TODO.md` link resolves; no `docs/agents/**` file moved.
- Dev-server restart before handoff only if item 2 or 3 lands (shared modules / new files).

## What is NOT in scope here

- **B2.2 — the alerts panel** is the Free Coach Portal program's last real phase and has its own
  sequencing. Don't absorb it.
- **The B2.3 release** (mig 205 to prod, push re-test, promoting B3 + B2.1 + B2.3) is release
  work, not this. See the B2.3 build record.
- **Notice-row retention** — `game_change_notices` never prunes sent/superseded rows. Both
  partial indexes exclude them so reads stay cheap; this is a *watch item*, not work, until
  volume justifies it.
- **Orphaned duplicate PATCH** `app/api/registrations/[id]/route.ts` (writes `payment_status`
  without the `markPaidInFullPatch` stamp; no live caller found) — same housekeeping family as
  item 4, but it's **code**, so delete-or-fix it deliberately with a review, not in a doc sweep.
