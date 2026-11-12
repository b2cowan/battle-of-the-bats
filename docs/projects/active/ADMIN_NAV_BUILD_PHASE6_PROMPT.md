# Build prompt — Navigation, Phase 6: words, help, the written standard, demos, the sweep, the closing walk

> One session, pasted into a fresh chat (`/clear` first). Written 2026-11-12 after Phase 5 (the Coaches Portal on a phone)
> was committed `768ef37a3` 2026-11-12 (walk §519 owed). Plan of record: `docs/projects/active/ADMIN_NAV_EVALUATION_PLAN.md`
> (§3 the standard, §4 rulings E1–E16, §5 every phase's record, §6, §7). Index: `ADMIN_NAV_BUILD_PROMPTS_INDEX.md`.
> **Model: Sonnet** (owner's choice). This phase is words and checking, not design: **no new screen, control or layout is
> invented here.** Where this prompt and the plan differ, the plan wins. Where the plan and the CODE differ, the code wins —
> say so out loud and record it; never "fix" code to match a document in this phase.

## The one-paragraph version
Phases 0–5 changed how every operator finds their way around: the club admin, the tournament admin and the Coaches Portal now
share one grammar (a sidebar headed by the place's cell; a top strip that names the page; on a phone, a bar that names the page
with the place on a small line that switches; tabs pinned in a band; doors to the other portals in the sidebar's foot; Help in
the account menu). This phase makes everything that DESCRIBES the product true again — the written navigation standard, the help
articles, the demo tours' words — runs the checks that prove nothing broke, and ends with **one closing walk** for the owner:
a person who is club owner, tournament admin and coach, moving through all three portals on a computer and a phone.

## What already happened (verify each before relying on it — `git log --oneline -40`, the plan's §5)
- Phase 0 `fd857b765`; Phase 1 A `664f9113d`, B `eb30602fb`; Phase 2 A `c9502c6a1`, B `33ac442a3`; Phase 3 `98294c616`;
  Phase 4 `dcddf7c80`; Phase 4b `24054c127`; Phase 5 `768ef37a3`. Walks §504, §507, §508, §509, §512, §514, §517 PASSED;
  **§519 (Phase 5) owed.**
- Each phase already synced the help sentences it touched (`/docs` per phase) and corrected the NAV_STANDARD rules it made
  false — but **the standard was never rewritten whole** (Phase 4's record: "the full rewrite is Phase 6").
- Phase 5's owner calls are still open (plan §5 Phase 5, "Owner calls, open"): the Game day chip's colour, the lone "+" row,
  a live team's Season's End title, the team sheet's season-only rows. **Not yours to decide** — carry them into the walk's
  "open" list.

## Gate (blocking, before any edit) — bring the owner these answers, then stop
1. **Has walk §519 been walked?** Read the ledger §519 `**Result:**` line. If it is missing, say so: the closing walk (step 6)
   must wait for it, because a Phase 5 finding could change words you are about to write. Steps 1–5 may proceed.
2. **The page top-row review** (plan §5, "Owner review owed … before Phase 6's closing walk"): has it been drawn and ruled?
   Search the plan and `TODO.md` for it. If not, tell the owner it is owed BEFORE the closing walk and ask whether to (a) hold
   the walk until it lands, or (b) walk now and note the top row as a known open item. **Do not draw it** (that is an owner
   drawing session on Opus).
3. **Help's place across the portals.** Phase 4b put the coach "?" in the strip; Phase 5 kept the phone's "?" in the bar (F3 A).
   The owner said the tournament admin and the club follow **only if he likes it after walking the Coaches Portal**. Ask him the
   question in one line ("move the tournament and club '?' into the strip / bar too — yes, no, later?"). **Whatever he answers,
   this phase writes it down and builds nothing** — a yes becomes its own phase.
4. Present a short plain-language summary of what this phase will change (words only, which documents, which checks, the walk)
   and the task list. **No code, no commit, without the owner's yes.**

## Read first (helpers read; you read the hunks you edit)
Broad reading goes to a helper (`Explore`), returning paths + line numbers + a verdict, never a dump (CLAUDE.md). A helper's
claim is a lead: open the cited lines yourself before you write a sentence that depends on it.
1. The plan: §0 (rounds 1–3), §3 (the standard, items 1–6), §4 (E1–E16 as ruled), §5 every phase's "Built" and "Measured" record,
   §6, §7. `memory/design_decisions.md` entries 2026-11-07 → 2026-11-12 (navigation).
2. `docs/agents/design/NAV_STANDARD.md` — the whole file. Its rows N1–N12 were patched phase by phase; several now carry
   "until Phase N" sentences that are history.
3. The code the standard describes (read to verify, do not change): the sidebars (`components/admin/kit/AdminKitRail*`,
   `components/coaches/CoachesSidebar*`, `CoachTeamCell.tsx`), the strips (`AdminTopStrip*`, `CoachTopStrip.tsx`), the phone bars
   (`components/admin/AdminEventHeader.tsx`, `components/coaches/CoachTeamHeader.tsx`), the More sheets (`CoachesBottomNav.tsx`,
   `AdminKitBottomNav.tsx`, `MoreSheetFoot.tsx`), the band (`HubTabBar.tsx`, `coachBandAt` in `lib/coach-team-nav.ts`), the
   page headers (`CoachPageHeader.tsx`, `components/admin/AdminPageHeader*`), and the guards that pin them
   (`tests/unit/nav-standard-guard.test.ts`, `coach-nav-phase4.test.ts`, `coach-nav-phase5.test.ts`, `coach-band-phase4b.test.ts`,
   `admin-header-bar-guard.test.ts`, `sidebar-strip-guard.test.ts`).
4. The help content: `lib/help-content/*.tsx` — the club (`org.tsx`), the tournament admin (`tournaments.tsx`), the Coaches
   Portal (`coaches.tsx`), and the hubs (`app/[orgSlug]/admin/help/page.tsx`, `app/platform-admin/help/page.tsx`).
5. The demos: `.claude/commands/demos.md` (what a tour is and who curates it), the tour files it names, `npm run check:demos`.

## What this phase changes (words only)
- **A. NAV_STANDARD rewritten whole.** One row per rule, in the present tense, describing what ships at both widths for all
  three portals, each rule naming the component and the guard that hold it. Remove every "until Phase N" and "(Phase N)" clause
  whose phase is done; keep each rule's REASON (one clause) and the date it was ruled. Keep the free Coaches Portal's exceptions
  (E13: out of this project) and the house-league exception (13a Ask 8). Where the code and a rule disagree, the code is the
  fact: write it as it is and add the disagreement to your report — never change code here.
- **B. Help articles.** Every sentence in `lib/help-content/*.tsx` that describes navigation — the sidebar, the place's cell and
  its list, the top strip, the bar on a phone and its small line, the More sheet, the band, the "?", Help in the account menu,
  the doors to the other portals — matches the product now. Run the `/docs` agent with that exact scope. Known leftovers:
  Phase 4's record names one pre-existing contradiction ("the whole menu still opens them, read-only" vs the one-page closed
  season). Keep the house format (`npm run measure:help`), the search fields in sync (`keywords`, `searchText`, `answerText`),
  and anchors unchanged. **`lib/help-content/org.tsx` may hold another session's uncommitted hunks** — `git diff` it first and
  edit around them; commit only your own hunks.
- **C. Demos.** `npm run check:demos` passes (it fails if a tour destination or anchor vanished). Read each tour step's words
  that describe navigation ("tap the team name", "the dropdown at the top", "the menu on the left") and list the stale ones for
  the owner. **Do not rewrite tour copy here** — the story is `/demos`'s, once per release cycle (CLAUDE.md); hand the list over.
- **D. Records.** The plan's Phase 6 section (what changed, the checks, the walk); the prompts index row; one TODO line; the
  ledger § for the closing walk; project memory (positive facts, "built 2026-MM-DD"); `memory/design_decisions.md` only if the
  owner rules something at the gate.

**Not this phase:** any visual or behaviour change; the top-row review; moving the tournament/club "?"; the free Coaches
Portal; the 404 page's bottom bar (its own TODO line); the owed production steps (migrations 458 and 460, the logo pass, the
crest backfill — the release session's); the old walks' stale checks (walks are history: do not edit them).

## Gotchas
- **Shared working copy.** Several sessions edit this tree at once. `git diff <file>` before editing any shared document
  (TODO.md, the ledger, the plan, `org.tsx`, `design_decisions.md`). Never `git add -A`. Commit through a private index:
  `GIT_INDEX_FILE=.git/p6.index git read-tree HEAD`, add exact paths, `git write-tree`, `git commit-tree -p <HEAD>`,
  `git update-ref refs/heads/dev <new> <old>`. **Then resync the shared index for the same paths** (`git reset -q -- <paths>`):
  without it, the next `git status` shows your commit as staged reverts (this bit Phase 5). Check `git diff --name-only
  <parent> <new>` lists only your files.
- **The dev server is shared.** Never run a full layout sweep on it (AGENTS.md: the whole-product sweep runs on staging or a
  local production build). `npm run check:layout -- --changed` only, and this phase changes no screen, so expect nothing to sweep.
  Restart only if you add or delete an app file (you should not); `npm run dev` only.
- **The staging sweep** (`/release` §1d-5) needs this code on staging. If staging does not have it, record "full sweep owed at
  the next release" — do not deploy to get it.
- **Spelling gate** (`npm run check:spelling`, part of `npm run verify:changed`): one spelling per word; the clock is
  "8:00 a.m."; "colour" is right. Grep for a word's other spelling before introducing it.
- **The full `npm test` currently fails in areas other sessions own** (signup, billing, club, payments, support console,
  practice plans' arrival words — seen 2026-11-12). Run the navigation guards by name; report any OTHER new failure.
- **Product-owner voice** in everything the owner reads (CLAUDE.md hook): what a person sees, not file names.
- **Past rulings are reference, not authority** (memory): cite a ruling's reason, decide on merit, and when a document says
  something the code no longer does, say which is true.

## Steps
1. Gate items 1–4. Stop for the owner.
2. A — rewrite NAV_STANDARD; run `nav-standard-guard` and the other navigation guards by name
   (`node --import ./tests/ts-resolver.mjs --test tests/unit/<name>.test.ts`).
3. B — `/docs` with the scope above; `npm run lint:focused -- <changed help files>`, `npm run measure:help`,
   `npm run check:spelling`.
4. C — `npm run check:demos`; the stale-words list for `/demos`.
5. `npm run verify:changed` (expect the known unrelated failures; list them, separate from yours). `/review` on your diff
   (it is words: a trivial tier — say so).
6. **The closing walk** (only after §519 is walked, and per the owner's gate answer on the top row): a checkable Artifact built
   from the last walk's page (`.probe/nav-phase5/build-walk.cjs` shows how — copy its approach, ONE PURPOSE PER WALK). One person
   who is club owner, tournament admin and coach: find or make a DEV sign-in that holds all three (look at
   `scripts/uat-fixture-context.mjs` and `tests/uat/.auth/`; a dev-only fixture must be re-runnable and must not touch a
   `riverdale-*` demo org or any real org). Walks, each one purpose: the club on a computer; a tournament on a computer; the
   Coaches Portal on a computer; each of the three on a phone; moving between portals (the sidebar foot's doors, Workspaces);
   Help (the account menu, the "?"); a closed season and a finished event; the demos. Write the ledger § and publish the walk.
7. D — the records. Then present the summary and **ask before committing**; on a yes, only this session's files, as above.

## Done when
- NAV_STANDARD describes the shipped product in the present tense, every rule with its reason, its component and its guard;
  no "until Phase N" left; disagreements with the code listed for the owner.
- No help sentence describes a navigation that no longer exists (spot-list in the report: section ids changed).
- `check:demos` passes and the stale tour words are handed to `/demos`.
- The navigation guards, typecheck (if any `.ts` changed), spelling and `verify:changed` (known unrelated failures aside) pass.
- The closing walk is published with its ledger §, or recorded as waiting on §519 / the top-row review, with the reason.
- The plan, the index row, TODO, memory and the ledger say what happened in positive terms with anchors.
