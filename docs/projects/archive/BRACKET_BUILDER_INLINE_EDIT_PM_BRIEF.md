# PM Brief — Bracket editing on the main screen (inline, not a modal)

**Status:** Planned · 2026-06-12
**Plan:** [BRACKET_BUILDER_INLINE_EDIT_PLAN.md](BRACKET_BUILDER_INLINE_EDIT_PLAN.md)

## What this is
Today a free organizer builds and edits a playoff bracket inside a pop-up modal, and the "Add Game" button is buggy
for playoffs. This change moves **all manual bracket editing onto the main Schedule screen** as a proper **edit mode**,
and reserves the modal **only** for the paid auto-generator (which shows the options and a non-editable preview).

## What changes for the user
- **A clear View ⇄ Edit flow.** You view your bracket (tree / list / timeline). Hit **"Edit Bracket"** (or a game's
  edit pencil) and the screen turns into the **bracket editor** — the same visual canvas, but full-size on the page.
  Add/remove rounds and games, set teams/dates/times, wire winners and losers, then **Save** (or **Cancel** to throw
  the changes away). One editor for everything — no more pop-up.
- **Editing never loses results.** Saving updates your bracket intelligently — games that have already been played keep
  their scores; only what you changed is changed.
- **The paid auto-generator is just for generating.** It shows the format options and a preview of what it will build;
  after it generates, you tweak the result in the same on-page editor everyone uses.
- **No more buggy "Add Game" for playoffs** — adding a playoff game is part of the editor.

## Why it matters
The current modal feels bolted-on, the per-game add path is unreliable, and there's no clean way to re-edit a saved
bracket without clearing it. Putting editing on the main screen makes the bracket feel like a first-class, directly
manipulable object — and gives free organizers a confident, professional editing experience while keeping the paid
value (one-click generation + auto-scheduling) crisp.

## Customer impact
- Free organizers can build, re-open, restructure, and reschedule a bracket end-to-end on one screen.
- Played brackets stay safe — editing won't wipe scores.
- A cleaner free→paid story: manual editing is free and excellent; the modal is purely the paid generator.

## Priority
High — it resolves real friction (buggy add, no re-edit, modal confusion) and is the foundation for the rest of the
bracket-builder UX roadmap.

## Success criteria
- Editing a bracket happens on the main screen with explicit Save/Cancel; no modal for manual edits.
- Saving preserves completed-game scores (diff, not replace).
- The auto-generate modal is preview-only; post-generate editing uses the same inline editor.
- Leaving with unsaved edits warns before discarding.

## Build order
P1 inline editor + diff-save (free) → P2 auto-generate modal becomes preview-only (Plus) → P3 polish (round names,
live health, list/timeline edit entry, mobile).
