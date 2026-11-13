# Build prompt — Navigation, Phase 6 (remainder): the closing walk

> One session, pasted into a fresh chat (`/clear` first). Written 2026-11-13, after Phase 6b's walk §522 PASSED 35/35.
> Plan of record: `docs/projects/active/ADMIN_NAV_EVALUATION_PLAN.md` (§5, the Phase 6 record and the 6b record). Index:
> `ADMIN_NAV_BUILD_PROMPTS_INDEX.md`. **Model: Sonnet.** This session builds ONE walk page and its ledger entry. **No code, no
> screen, no help sentence changes.** The older `ADMIN_NAV_BUILD_PHASE6_PROMPT.md` is history for the words half (done); its
> gate questions are all answered below.

## The one-paragraph version
Every navigation phase has been built and walked on its own (§504 … §522). What has never been walked is the thing the project
is FOR: one person who runs a club, runs a tournament and coaches a team, moving between the three portals on a computer and
on a phone, and finding their way every time without thinking. This session builds that single closing walk as a checkable
Artifact, writes its ledger entry, and records it. The owner walks it afterwards.

## What is already true (verify each: `git log --oneline -30`, the plan's §5)
- Phase 6's words are committed `4955fb85f` (the standard rewritten whole, help synced, `check:demos` ✓). Phases 0–5, 5b
  `484cc4115`, N13 `dc1351820` and 6b `06ddfa1d5` are committed. Walks PASSED: §504 §507 §508 §509 §512 §514 §517 §519 §521
  §522. **Nothing in this list is open.** The page's top row was drawn and built as Phase 6b; the tournament and club "?"
  moved in 6b; Phase 5b has its own walk.
- **Do not repeat any checked step from §519, §521 or §522.** A walk step that was already passed is history.

## Gate (answer from the records, not from the owner — only the last item is his)
1. Confirm §519, §521 and §522 each carry a `**Result:** PASSED` line in the ledger. If one does not, say so and stop.
2. Find or make ONE dev sign-in that holds all three roles — club owner (rep teams), tournament director and coach of a team —
   and works on both a computer and a phone. Look at `scripts/uat-fixture-context.mjs` and `tests/uat/.auth/`; the UAT owners
   (`uat-owner@uat-test-org.local`, `uat-club-owner@uat-rep-club.local`) and coach (`uat-coach@uat-test-org.local`) work; a dead
   password is the usual reason a walk's sign-in fails (`.probe/nav-phase2b/signin.mjs` writes fresh states). A new fixture must
   be re-runnable, undoable, and must never touch a `riverdale-*` demo org or any real org. **If a fixture needs a write to the
   dev database, say so and wait for the owner's yes.**
3. Present a short plain-language summary of the walk (how many walks, what each proves, what it leaves out) and the task list.
   **No page is published without the owner's yes.**

## Read first (a helper reads; you read what you edit)
1. The last walk's builder `.probe/nav-phase6b/build-walk.cjs` and the published page `docs/projects/active/ADMIN_NAV_PHASE6B_WALK.html`
   — copy their approach (the checkable page, paste-back text, one purpose per walk). Memory: QA walks are checkable Artifacts.
2. `docs/agents/design/NAV_STANDARD.md` (N1–N13) — every closing-walk step should land on a rule the standard states.
3. The plan's Phase 5, 5b and 6b records — the "open owner calls" lists.

## The walk — one purpose per walk, a person's journey, not a screen census
Write these as separate walks, each short, each ending on something the owner SEES:
1. **Start in the club (computer):** sign in; the club's sidebar names the club; go to a team; the way back is obvious.
2. **Cross to the tournaments (computer):** use the sidebar foot's door, not the address bar; the event is named in the
   sidebar; the strip says where you are; go back to the club the same way.
3. **Cross to the Coaches Portal (computer):** the door in the foot; the team cell; a drill-in and its back arrow; Workspaces.
4. **The same three journeys on a phone (390):** the bar names the page, the small line switches, the More sheet's foot holds
   the doors; the "?" is last in the bar in each.
5. **Help from anywhere:** the account menu's Help, and the "?" on one page of each portal opens the right section.
6. **A finished thing:** a closed season is one page; a finished event reads normally.
7. **The demos:** `/see-it-live` (tournament) and the coach demo show the same chrome (no sign-in).
Leave out: anything §519/§521/§522 already walked (the player page, the "?" placement per screen, Roster's row).

## Carry into the walk as OPEN questions (the owner's; not yours to decide)
- Phase 5: the Game day chip's colour (olive vs drawn red); the phone's lone "+" row; a live team's Season's End title;
  the team sheet's season-only rows.
- Phase 5b: the Family figure reads "No contact" / "Kept to the head coach" for a coach without the contact grant.
- Phase 6b: the Coaches off-team pages' phone "?" on the title row (ticked through at §522 = stands); a Tournament plan's
  Plan & billing has no help topic; phone pages that lost their row start at 61 px not the drawn 69.
- Handed to `/demos`, not walked: the in-product tour card eyebrowed "Season" that names Insights (a "Progress" group item).

## Gotchas
- Shared working copy: `git diff <file>` before editing a shared document (TODO.md, the ledger, the plan); stage exact
  hunks only (never `git add -A`); re-check the branch is `dev` before committing.
- The ledger: add the next section number; never re-sort the § numbers. Writes to read back before a pass: say "none" if none.
- The full layout sweep does not run on the dev server (AGENTS.md); it is the release's, on staging — record "full sweep owed
  at the next release". Restart nothing; this session adds no app file.
- Product-owner voice in anything the owner reads.

## Steps
1. Gate. 2. Build the walk page and `build-walk.cjs` copy under `.probe/nav-phase6-close/`. 3. Ask the owner, then publish
(Artifact), and write the ledger §. 4. Records: the plan's Phase 6 section, the prompts index row, one TODO line, project
memory. 5. Ask before committing; on a yes, only this session's files.

## Done when
- The closing walk is published, its ledger § written with sign-ins, "writes to read back" and "not walked" lines.
- The open questions above sit in the walk's open list, unchanged.
- The plan, index row, TODO and memory say what happened in positive terms with anchors.
