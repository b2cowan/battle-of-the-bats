# PM Brief — Coach Roster + Player Page review

**One line:** the August rework got the shape right; this pass closes the seams it left — no new data,
no migration, two screens.

**Plan:** `COACH_ROSTER_AND_PLAYER_PAGE_REVIEW_PLAN.md` ·
**Hub (mockups, this brief, the plan, decisions):** `COACH_ROSTER_AND_PLAYER_PAGE_REVIEW_HUB.html`,
published as an Artifact: https://claude.ai/code/artifact/b6e9645a-e34b-4a28-b84d-7624482d2504

---

## What a coach sees differently

**On the roster.** The list keeps its five columns and its toolbar. A player's name is underlined
quietly so it reads as the door it already is. Jersey numbers take the same data face the rest of the
portal uses for numbers. A pitcher's row says **Ace** or **P2** in the Positions column instead of
"Add a position". The two "Add a…" prompts lose their dashed underline, so a brand-new roster reads as
a list of names with quiet gaps rather than a grid of dashes — and tapping one lands on the right tab
of the player's page, scrolled to the right field. On a phone the whole card opens the player, and a
card whose family has a phone number on file carries a thumb-sized Call button in its corner.

**On a player's page.** The header gains previous / next arrows, in the coach's own roster order,
that keep whatever tab is open — logging a measurable for twelve players is twelve taps of the arrow,
never a trip back to the roster. The four glance tiles become doors: Attendance jumps to attendance,
Dues to dues, Awards to awards, Family to the guardian contact; the red "Medical notes" chip jumps to
Safety. The three tabs stay; everything inside them is **flat** — the drawers are gone, each section
is a card with a heading, and the tab a coach opened shows what they opened it for. The family season
recap moves from a tinted box in the middle of the season to one quiet line at its foot. A family
that has over-paid reads "credit" in both places the balance appears, instead of "Paid" above and
"$-945.15" below. An assistant coach who cannot edit sees a clean read-only record instead of editable
boxes that refuse to save.

## Why it matters

The roster is the page everything else reads from, and the player page is where a coach answers "how
is this kid doing" and "who do I call" — often standing on a field with a phone. Today both pages hide
their answers one step further away than they need to: a name that doesn't look like a door, a
contact that isn't on the card, an attendance figure shown three times with no way to reach it, a form
folded inside a tab that holds nothing else. None of it is broken; all of it costs a tap or a moment of
doubt, dozens of times a week.

## Customer impact

Every coach with portal access, on every team, every time they open the roster or a player.
Assistants without contact access stop seeing blank editable boxes. Families are not affected — the
recap they receive is unchanged; only the coach's preview of it moves.

## Deliberately not changing

- **No dues or attendance on the roster list.** The August reason still holds: a coach opens this
  list beside a parent. Both re-examined on merit and left off — recorded as open questions.
- **No filters, counts or sort.** Twelve rows on one screen.
- **The three tabs, the glance card, the named removal at the foot of Details, the depth chart, the
  off-roster shelf, reordering** — untouched.

## Trade-offs

- Flattening the tabs makes "This season" longer for a player with many measurables. The tiles are
  the index, and the whole tab fully open measures about two desktop screens today.
- The player stepper is the portal's first record-to-record navigation. It is drawn so it can be
  judged before it becomes a pattern.

## Priority

After the depth-chart and development work in flight. No data model change, so no migration window.

## Success criteria

- A coach can call a parent from the phone roster in one tap, and open the player in one tap.
- A coach can log a measurable for every player without returning to the roster.
- "Add a contact" on the roster lands on Guardian contact; reloading a player page keeps the tab.
- No roster cell is off the type ladder; no accordion remains inside a player-page tab.
- One balance, one reading: no page shows "Paid" and a negative dollar figure for the same player.

## Open questions (Decisions tab on the hub)

Q1 chevron on the roster row (recommend no) · Q2 attendance on the roster (no) · Q3 age column (not
now) · Q4 stepper order (roster order) · Q5 keep the Dues section on This season (yes) · Q6 read-only
Details for non-writers in this pass (yes).

---

## Round 2 (2026-09-13) — five tabs, and Notes

On reading round 1 the owner ruled: Development gets its own tab, Details lands first, and a
per-player Notes tab exists with a general "Add a note". The player page now has **five tabs** —
Details · This season · Skills & Goals · Notes · Family & paperwork — each answering one question:
who is this · what happened · how are they developing · what have we noticed · who do I call.

**Notes** is one timeline of everything dated a coach has written about the player — a line from
the bench, a skill observation, a goal review, a general note — newest first, grouped by month,
each entry marked with where it came from and who wrote it, linking back to its source. Nothing is
written twice. The private box on Details becomes the pinned "About" note at the top; "Moments you
logged" stops being its own section. Families never see the tab and the season recap never reads
from it.

**Trims proposed to keep it simple** (open questions Q7–Q10): no separate Observations view inside
the player's Skills & Goals (they read under their goal and in Notes — needs the Phase 2 session's
agreement); the Details notes box moves rather than duplicates; playing time moves to This season;
no filter or search on Notes in the first build.


---

## Built (2026-09-13, on dev, uncommitted)

Everything above is built and can be walked: the roster list changes, the five-tab player page, the Notes tab (one new table, applied to dev), the help guide updated, and the coach demo reseeded so its Notes tab has two notes. Three things to know before walking:

- **The Observations view inside Skills & Goals was kept**, not trimmed (Q7). The development session had already built and shipped it, and you asked that session for a holistic re-evaluation of Phase 2 — the trim belongs in that conversation, not ahead of it.
- **On a phone, Switch player is a dropdown under the player's name**, not an icon button as drawn. A native dropdown cannot be a bare icon; it is the same control as the team switcher in the sidebar.
- **Playing time has no "by position" line.** The figures behind it do not break innings down by position; the "Playing time report →" door does.

The QA walk (§182) is on the hub's QA Walk tab: nine parts, thirty-three steps; the demo part is waivable.
