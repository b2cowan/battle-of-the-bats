# Practice Sheet Structure — plan of record

**Status: BUILT on dev 2026-08-24** (Owner QA Ledger §91, PDF Export Quality Phase 2 pass 4 —
Working sheets; built gallery https://claude.ai/code/artifact/771dd950-ab5c-40db-9b2d-79b0ab05e854).
Structure DECIDED by the owner 2026-08-22 from rendered exhibits; built to it, with three open edges
resolved at that pass’s checkpoint 1 (all seven recommendations taken:
https://claude.ai/code/artifact/d3675cd6-ea40-47a6-b7c9-73c1d7a90616).
**The spec is the approved mockup gallery:** https://claude.ai/code/artifact/2213fc25-0ee5-4a6d-bb3a-efe82ab17f7f
(candidate A — every page there was produced by a PDF renderer against a content-heavy fixture and a
typical-night fixture; the current sheet renders alongside for contrast).
**PM brief:** `PRACTICE_SHEET_STRUCTURE_PM_BRIEF.md` · **Raised:** owner 2026-08-21 (PDF plan
decision 9); session prompt served and archived at
`docs/projects/archive/PRACTICE_SHEET_STRUCTURE_PLANNING_PROMPT.md`.

## 1 · The ruling this answers

> *"I don't like the chart form as there are a lot of sentences, point form notes, etc. in a
> practice plan and logging these charts removes and disorients a lot of that data."* — owner, 2026-08-21

A practice plan's payload is mostly prose. The shared report table gave nearly half the width to
columns repeating "Everyone / All staff / 10 min", chopped the coach's sentences into a narrow
ribbon, split one mid-sentence across a page break, and spent over half the rotation grid on a
"Round" column. All of that is visible in the gallery's "what ships today" exhibit.

## 2 · The decided structure (run sheet)

The sheet **leaves the table engine** for a drawn layout — the tryout board summary is the in-repo
precedent — but **stays on the shared identity/footer/page-count plumbing** (PDF plan decisions
7/8: team-layer identity with team-name fallback, true page totals). No second print pipeline.

Top to bottom:

1. **Identity header** (shared plumbing): accent bar, aspect-fit logo, team name + season line,
   then "Practice plan" + one date/where line.
2. **Tonight's facts as labelled prose lines** — PRACTICE / GOAL / EQUIPMENT as small-caps labels
   with wrapped text. No table, no dark band (kills the practice sheet's D1 blank header band).
3. **THE PLAN as a timeline**: time + duration in a left gutter (~22mm), a thin accent spine with a
   node per block, and beside it each block's **title, staff · players meta line, and full-width
   prose notes**. Empty notes take no vertical space.
4. **Rotation grids render compact INSIDE the block that owns them**: accent header row, "Round"
   column ~22mm, group columns splitting the rest; the honest-arithmetic statements print as
   bullet **sentences under the grid, never as grid rows**; group membership lines ("Group A —
   names…") directly beneath — an assistant reads one region and has everything.
   ⚠ **Built 2026-08-24, with a correction to this note.** The real build associates a rotation
   with the block it was configured on — and the “fall back to after the timeline” case describes
   something the DATA MODEL CANNOT PRODUCE: a rotation is a property of its block, so it always has
   an owner. The real edge next door was a live defect — a rotation the coach had STARTED but not
   finished printed nothing at all. It now prints its statements and its groups, with no grid.
5. **"What everyone's working on"** last: player name + prose with hanging indent. Printed only
   when the generator can see focus areas; otherwise the section is absent, not redacted-looking
   (standing rule, unchanged).

**Paging behaviour:** blocks are atomic — a block that doesn't fit moves whole to the next page;
continuation pages carry a compact identity header ("Practice plan — {date} (continued)"); page
totals are true (post-pass, the board-summary technique). A typical night fits the whole evening on
page 1 (a long focus list may ride to page 2); a heavy night breaks to two pages honestly. A
sentence never splits across a page break.

**Constraints that survive any future restyle:** vocabulary is PLANNED, never DONE — no tick box,
no blank "did it" column, no wording that implies anything happened; the sheet is hand-carried,
never a shareable link (it names children beside a date, time and address).

## 3 · Rejected (owner, 2026-08-22, from the same gallery)

- **Station cards (candidate B)** — one cuttable card per block. Best answer for the assistant
  running one station, but spends paper on card chrome and makes the head coach flip cards to
  follow the night. **Its tear-off idea is parked, not dead:** a per-station print could become a
  variant later if real coaches ask.
- **Glance strip + prose (candidate C)** — a compact schedule strip above prose sections. The strip
  duplicates every time and title and pushed the heavy night to three pages; the run sheet's time
  gutter already provides the at-a-glance read.

## 4 · Build sequencing

- Builds in the **Working sheets** pass of the PDF plan's Phase 2 (decision 9's hold is now
  resolved; that plan's Phase-2 bullet points here). Phase 1's generic plumbing still reaches the
  current sheet incidentally in the meantime.
- The exhibit renderer that produced the approved pages lives in the planning session's scratchpad
  (`practice-sheet/candidates.mjs`, candidate A) — it is the dimensional reference for the build,
  alongside the gallery.
- Owner QA walk goes to the Owner QA Ledger when built, as usual.
