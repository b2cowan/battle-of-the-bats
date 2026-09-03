# PM Brief — List · Room · Question

**One-line:** every money record — a family's dues, a fundraiser, a sponsor, a club bill, a team
bill — now opens the exact same way, and forms stop living inside table rows.

## What a coach sees differently

Today the Money area answers "open this record" four different ways: dues opens an overlay, a
fundraiser expands between its table rows, a club bill unfolds a beige slab with form fields inside
it, a team bill takes over the whole screen. After this project there is **one gesture**: every
money table is a clean, scannable list, and tapping a row opens that record's **room** — the same
layout every time (the numbers that matter up top, the record's own schedule or entries, history
tucked away until wanted, edit and delete at the foot, one Record button). On a phone every room is
a full-screen sheet. Next to the close button, **"‹ previous · next ›" links carry the neighbouring
records' names**, so working through five families or five bills never means going back to the list.

Two records deliberately *don't* get rooms, each for a stated reason: a **club request** is just a
form with a status — so its form reopens pre-filled as the one editor, and its facts (including a
declined request's reason, which is currently unreachable) show right on the row. A **budget line**
works the same way today and stays.

## Why it matters

- **The pattern the owner flagged as bad UX disappears**: no more dropdowns, search boxes and
  warning paragraphs unfolding inside a table and shoving other rows off screen.
- **One thing to learn.** Coaches never see "patterns" — they see that every money screen now
  behaves like the dues screen they already like.
- **Speed is protected, not sacrificed.** Simple bills keep a one-tap "Record as paid" right on the
  row; declined reasons read without opening anything; prev/next replaces open-close-open loops.
- **Every room is reachable by keyboard and screen reader** (Escape, focus handling, proper
  announcements) — today only one money overlay is.
- **Field consistency rides along:** the bill screen's odd "+"-to-add-tags control (the only one of
  its kind in the product) and a mismatched field background get fixed in the same pass.

## Scope of the ruling (owner, 2026-09-02)

Binding for the Money area now; the **default for anything new built anywhere in the app**; older
screens elsewhere adopt it when next touched — no app-wide rebuild. Dashboards and live-operation
screens (Overview, Insights, Game-Day) are a different kind of surface and are exempt on purpose.

## Honest trade-offs (accepted with eyes open)

- Holding several club records open at once goes away; the pills, previews and prev/next exist
  precisely to keep month-end work fast. If it still pinches, the recorded fallback is a read-only
  glance on that list — never forms back in rows.
- This reverses several in-place decisions made earlier the same week, with tested mockups. That's
  recorded as a deliberate, dated blank-sheet re-decision, not drift.
- Fundraising is the biggest rebuild (its in-place machinery is days old). Sequenced last of the
  big pieces; club — the screen that hurt — goes first.

## Success criteria

- A coach can describe how to open any money record in one sentence.
- No form control renders inside any money table row.
- Recording across several bills/families at month end takes no more taps than today.
- Every room passes keyboard-only and screen-reader use.
- Demo tours and help articles describe the new screens in the same release that ships them.

**Priority:** high (owner-initiated). **Plan:** `COACH_MONEY_LIST_ROOM_QUESTION_PLAN.md`.
**Mockups:** artifact `11607f0a-e0c1-4bb4-bbd5-b6f81d834fbc`.
