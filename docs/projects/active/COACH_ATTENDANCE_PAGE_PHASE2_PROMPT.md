# New-chat prompt — Coach Attendance page (Phase 2)

Paste everything below the line into a fresh chat.

---

Work on **Phase 2 of `docs/projects/active/COACH_NAV_AND_PRACTICE_PLANS_PLAN.md`** — fixing the
coach **Attendance** page. Phase 1 (the Practice plans hub) is committed on `dev`; Phases 3 and 4 are
approved but NOT started, and **Phase 2 must not touch them**.

Read the plan first. Mockups (approved by the owner, rev 3):
`https://claude.ai/code/artifact/ed56fe2c-0749-4c18-b504-3d3b3ee6c7c7` — §01 is this phase.

## What the owner reported

They opened Attendance on a team with an empty schedule and found **three "nothing here" blocks
stacked on three different left edges**, and asked why they were stacked and why they were
misaligned.

## What is actually wrong (verified in code — re-verify, don't trust this summary)

Three regions render independently and none knows the other two are also empty:

| Block | Width | Horizontal anchor |
| --- | --- | --- |
| The `CoachEmptyState` card ("Nothing to take attendance for yet") | 560px | centred in the column |
| The methodology paragraph | 640px | left, but inset **2rem** |
| The `.emptyState` block ("No attendance recorded yet") | full width | centred |

1. **Two empty states, one situation.** Same icon, near-identical message in two registers. The
   second answers a question the first already answered.
2. **The misalignment is an inherited-padding accident, not a layout decision.** The shared "muted
   text" style carries `padding: 2rem`, and the page's inline `margin` override does not reset it.
   ⚠ **Fix it on the Attendance page, NOT on the shared class** — that class is used widely, and
   changing it would move text on every other page that uses it.
3. **Methodology before there is anything to explain.** The paragraph describes how figures are
   counted, on a page with no figures. Good copy, wrong slot.
4. **Prose sits between the action and the data**, even when the page is full: do this → counting
   rules → table.

## The rule that resolves it (owner-approved)

> A page shows **one** empty state, and when it does, it is the only thing on the page. Everything
> else shares a single left edge and a single width — the centred card is the exception precisely
> because it is alone.

## What to build

- **No schedule at all** → the single empty card, alone. Nothing else renders. (This is the
  screenshot case, and the rarest.)
- **Schedule has games, nothing marked yet** → the existing "Take attendance" shortcut card, then
  the **real table with the roster and dashes**, above one quiet line saying totals fill in as you
  mark attendance. This replaces the second empty state: it proves the roster is connected and shows
  the shape that is coming. This state matters more than the screenshot one — it is the common
  first-week case.
- **Data exists** → shortcut card, table, and the methodology folded into a collapsed
  **"How these figures are counted"** disclosure under the table. Same words, kept, out of the path
  between the coach and their data, and absent when there is no data.
- **Column headings once** on the table, replacing the per-row `GAMES` / `PRACTICES` micro-labels.

**Unchanged:** the "Take attendance" shortcut card and its three-state loading behaviour, the
season/read-only handling, the loading skeletons, and the per-player drill-in. The page's copy about
what attendance is for ("a season view to inform playing-time decisions… not a ranking") is
deliberate wording under a standing ruling — **keep its meaning**; see
`memory/decision_playing_time_vocabulary.md`.

**Out of scope for this phase:** the back link to Insights, moving Attendance into Insights, and the
sidebar regroup. Phase 3 deletes that back link entirely, so do not spend effort on it now.

## Verification expected

`npm run verify:changed`, `npm run lint:focused`, `npm test`, and the rendered layout check on the
`coach-attendance` screen at phone and desktop widths — that check is the only one that can see a
misalignment, which is the whole complaint. It needs a dev server already running.

## ⚠ This working copy is shared with other sessions

Everything happens on `dev`. **Stage explicit pathspecs only, never `git add -A`, and read the
actual diff of every file before committing** — filenames are not enough. In this project's own
Phase 1 commit, `TODO.md`, the QA ledger, the coaches help guide, the demo world and its seed, and
the layout screen list all carried two other sessions' in-progress work; staging them by name swept
that work into the commit and it had to be reset. Those files may still be entangled.

Directories with brackets need `:(literal)` pathspecs or they stage nothing.

## Follow-ups already recorded, not for this phase

- The lineup **builder** page still formats times in the reader's timezone rather than the org's —
  the one stale sibling next to the hub that was fixed in Phase 1.
- The demo world needs a re-seed for its new upcoming practice plan to appear; best bundled with the
  sponsorships session, which needs the same re-seed.
