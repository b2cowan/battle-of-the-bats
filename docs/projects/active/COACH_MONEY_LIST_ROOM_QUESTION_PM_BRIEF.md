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

## Phase B — Fundraising, built 2026-09-02 (Owner QA §135 owed)

**What a coach sees now.** The Fundraising tab is two clean lists. A drive row reads its name, what
it raised, what the team keeps, an Active/Closed chip and a chevron; a sponsor row reads its name,
what was pledged, what is in, what is still to come, and a chip that says where it stands —
Pledged, Part received, or Received — worked out from the money, never typed. Nothing unfolds in
the tables any more. Tapping a drive opens its room: three figures up top, the entries table with
Edit and Remove on every line, "Edit drive" and Record above it, a guarded Delete at the foot, and
named previous/next across the drives. Tapping a sponsor opens the one two-panel room: Pledged /
Arrived / To come (with the expected-by date, red once it has passed), a Cheques panel where every
arrival can now be **edited** as well as undone, and a Credited-to-players panel where the split is
changed right there and saved with its own button — with any refusal shown beside it before the
button will save. Editing an entry or a cheque is a small window over the room; Escape closes only
the top layer. In the Record conversation's "Which sponsor?" list there is a new row, "This is a
promise — nothing arrived yet", which carries the typed name and amount into the pledge sheet; the
sheet's "Record it instead" carries them back. On a phone every room is a full-screen sheet.

**Why it matters.** Correcting a mis-typed cheque used to mean undo-and-retype; a coach now fixes
the amount, date or method in place and every family's credit is re-figured for them. The credit
split is no longer buried behind an Edit sheet. Read-only money coaches see the same rooms with no
write controls.

**Trade-offs, named.** No History fold yet (nothing accumulates beyond the entries and cheques —
we did not draw empty theatre). Drive entries show no method column (they never carried one). The
Delete door at the room's foot is pressable and answers with the reason, per the owner's 2026-08-30
ruling, rather than a permanently dead button with a sentence. "Part received" is a new third word
for a half-kept pledge — an owner wording call at the walk.

## Success criteria

- A coach can describe how to open any money record in one sentence.
- No form control renders inside any money table row.
- Recording across several bills/families at month end takes no more taps than today.
- Every room passes keyboard-only and screen-reader use.
- Demo tours and help articles describe the new screens in the same release that ships them.

**Priority:** high (owner-initiated). **Plan:** `COACH_MONEY_LIST_ROOM_QUESTION_PLAN.md`.
**Mockups:** artifact `11607f0a-e0c1-4bb4-bbd5-b6f81d834fbc`.
