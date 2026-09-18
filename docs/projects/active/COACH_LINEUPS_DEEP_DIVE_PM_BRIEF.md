# Coach Lineups Deep Dive — PM Brief

**Status:** Phase 0/1/2/3 implemented (2026-09-18) — including the persisted Draft/Ready handoff, the Setup/Auto-fill toolbar hierarchy, the retired docked footer, and the Auto-fill "why here" explanation below. Statically verified + full unit suite green. An owner browser walk is still owed. The Phase 4 inning inspector followed the same day (D5): tap any inning number in the grid to open that inning as a short list — every field role, who holds it, a fact from your own depth chart beside each name, who is on the Bench and who is still Open — and assign straight from the list: tap the word beside a role and the candidates open as a dropdown floating over the panel (the same list the money chooser uses), each with what your depth chart knows about them (pitcher and cap use, Best positions, Never positions) and a coloured word only when it is about that role. When a role is open it says who is eligible right now, and names a cause only when it can prove one (everyone idle has that spot set to Never; every idle pitcher is at their cap); it never guesses. Retiring the hard-coded position list in the grid cell (the other half of Phase 4) stays open.

## What changes for the coach

Lineups becomes a guided preparation flow instead of three quiet tables and a row of equal-looking controls.

The coach still works through Batting order, Positions, and Playing time, but the page now shows where they are in the process and what remains. Auto-fill is the clear primary action and names the mode it will use. The position grid and dropdowns sit on a solid, high-contrast surface. Blank decisions say `Open`; deliberate sits say `Bench`; required roles that are not covered are named by inning and can be jumped to directly.

The shared coverage check now calls an unfinished inning a Draft and names its open roles without guessing why they are open. Each started inning shows its coverage count, duplicate assignments identify their exact controls, and Playing time explicitly shows Field, Bench, pitching against the applicable cap, and any attention item.

The games list stops calling any partly filled lineup “set.” It shows Not started, Draft, Ready, or Needs review. The recommended version lets a coach mark the lineup ready and records who did it; any later edit returns it to Draft.

Playing time shifts from a colour-heavy count matrix to a review surface: field and bench totals, consecutive-sit attention, position variety, and pitching innings against the cap the team set. Season trends remain in Insights.

Auto-fill now keeps every multi-inning pitcher in one uninterrupted stint. A generated rotation will not return a player to `P` after Bench or another field position. Competitive, Balanced, and Development modes keep their existing intent and arm-care caps; only pitching gains this continuity rule, and manual coach assignments remain under coach control.

## Why it matters

The current tool is functionally rich but visually under-signalled. On the warm theme, page grid lines show through both tables, headings and controls use quiet gray ink, and translucent dropdowns look disabled. A first-time coach has to discover the workflow and the meaning of blanks by trial.

More seriously, the product currently calls a lineup “set” after any single assignment is saved. Its incomplete-lineup warning also guesses that a Never preference caused the hole even though the analysis has no eligibility or cap data.

In the attached Milton lineup, inning 7 genuinely has two open field roles (`P` and `LF`). The two blank player cells belong to pitchers, but that does not assign either pitcher to `P`; both are still eligible under their caps, and one can cover LF. The useful message is therefore “Inning 7 is a draft with P and LF open,” not an amber claim that a Never setting made the inning impossible.

## Customer impact

This affects every head or assistant coach who can edit lineups, especially a coach building one for the first time or making changes on a tablet at the field.

The benefits are:

- faster first-use comprehension;
- fewer incomplete lineups presented as ready;
- fewer false or unhelpful warnings;
- clearer position controls in both coach themes;
- safer manual overrides because real cap/Never conflicts are named;
- better staff handoff through ready-by/time;
- faster playing-time and pitching review before game day.
- realistic pitching rotations without `P → Bench/field → P` patterns.

Access does not change. Any coach who can edit lineups can complete the flow. In the recommended readiness model, the product records who marked it ready; it does not create a new head-coach-only gate.

## Priority

**P0 for truth and legibility; P1 for workflow and analysis; P2 for the inning inspector.**

The warning cause, false “Lineup set” state, translucent table grounds, and low-contrast controls undermine trust in a marquee Premium feature and should be fixed together. The inning-first inspector is valuable but should follow the shared truth model rather than delay it.

## Success criteria

- A partly filled lineup is never labelled Ready or Lineup set.
- An open-role message names the inning and roles without inventing a reason.
- Proven cap, Never, or position-conflict issues point to the exact player cells.
- The blueprint grid does not show through positions or playing-time tables.
- Headings, values, and dropdowns meet the approved table and semantic-ink standards in warm and dark themes.
- A first-time coach can build, review, and mark a lineup ready without needing Help.
- Playing time answers who sits, who sits consecutively, where players rotate, and pitcher cap headroom.
- Auto-fill places every multi-inning pitcher in one consecutive block and leaves non-pitching rotation behaviour unchanged.
- Any edit after readiness visibly returns the lineup to Draft.

## Built (2026-09-18) — Auto-fill "why here"

Right now, after Auto-fill runs, a coach sees where everyone landed but not why. This piece adds that explanation:

- Hover (or keyboard-focus, on desktop) over a filled cell and it says why Auto-fill put that player there — a top-rated spot, an even-rotation pick, or "only eligible pitcher" for the mound.
- When the mound is left open because no pitcher is available under the innings cap, that cell says so specifically. Every other open cell keeps today's plain "Open" — no attempt to explain every possible blank.
- The explanation is a live comment on this Auto-fill result, not a saved fact — it disappears if the coach reopens the lineup later or edits a cell by hand, until they run Auto-fill or Reshuffle again.
- **Fixed 2026-09-18:** a roster short a second pitcher can leave the mound open for most of the game. The first build repeated the same open-role sentence once per inning (six near-identical lines for a six-inning gap), burying the actual lineup below them. It now reads as one line covering the whole span — "Innings 2–7 each have 1 open role: P. No eligible pitcher was available under the innings cap." — with a single button to jump to the first affected inning.

**Known tradeoff, accepted:** this reuses the same hover-only mechanism already on the page for clash/open warnings, which is faster to build and consistent with the rest of the tool — but it only works with a mouse or a keyboard, not a finger. A coach working purely by touch on a phone or tablet won't see the per-cell reason; they still get the plain-language mode summary shown before generating and the per-inning open-role list. A tap-friendly version was considered and set aside for now as a larger build.

## Built (2026-09-18) — Two tabs, not three (D8)

The owner's question on review: if the grid already reorders players, why is there a separate Batting order tab? The honest answer was that it was a duplicate on a laptop and the only reorder door on a phone — the grid hid its drag handle at phone width because a drag and a sideways swipe begin the same way. So:

- The builder is now **two tabs at every width**: **Lineup** (who bats when, who plays where, who's in) and **Playing time** (read it back). The strip is the portal's usual segmented control, sized to its labels on a laptop and full-width, 44px tall, on a phone. The Batting order tab and its list are gone.
- On a laptop nothing else changes: drag the grip beside a number to reorder, × beside a name to remove.
- On a phone the **batting number is the handle** — a 44px square in the pinned first column. **Hold** it (about a quarter second) and drag to move the player; swiping across the innings from any other cell still scrolls. **Tap** it for a small sheet: Move up · Move down · Remove from lineup · Cancel. Move up/down are the non-drag path, so a coach who finds hold-and-drag fiddly on their phone is never stuck.
- Nine-player ball keeps the Start checkbox for promoting or benching. What went with the old tab: the "usual positions" line under each name (the depth chart has it) and the "drag above this line" bench cut (the checkbox does the same job).
- The in-app Help article for Lineups describes the two views and the hold/tap gestures.

**What to test on a real phone** (hub QA part I): hold must lift, swipe must scroll, every time. If it ever lifts when you meant to scroll, the fix is the hold time — not a third tab.

## Recommended delivery

1. Shared validation/readiness model plus regression tests.
2. Solid table/control treatment and actionable inning completeness.
3. Draft/Ready workflow and hub/game-day status updates.
4. Playing-time and Auto-fill explanation improvements.
5. Inning inspector (built 2026-09-18) and Sport Pack position vocabulary (still open).
