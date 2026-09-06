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

## Phase C — the Ledger's bill room, built 2026-09-04 (Owner QA §141 ✅ PASSED 2026-09-06, 36/36, zero defects)

**What a coach sees differently.** Tapping a bill on the Ledger used to **replace the whole tab** —
the list, its filters, its toolbar and the coach's scroll position all disappeared, and a hardcoded
"Ledger" arrow was the only way back. The bill now opens as a **panel over the list**, the same
shape a club bill, a fundraiser and a sponsor already open. The Ledger stays underneath: close the
panel and the coach is exactly where they were, filters and all.

Inside, four figures answer the question first — **Total · Paid · Left · Next due** — with a chip
beside the name reading *2 of 3 paid*. The schedule stays the main event and leads the panel: every
payment still offers Record, Change and Remove, and Change/Remove still ask *this one, this and
later, or all unpaid?* as a single window over the panel. What has already been paid folds away
under **History**, closed by default and opening itself the moment a new payment lands. At the foot,
named **Previous / Next** walk the bills the coach is actually looking at — *"3 of 5 bills"* — so a
season's bills can be read without closing and reopening; the arrow keys do the same on a computer.

Three field fixes ride along, all owner-flagged: the **Tags** box loses its one-off "+" reveal and
goes back to the always-visible search every other field uses; **Filing** gets the same paper
background its neighbours have; and the field column narrows to the house width, so a one-word
payment method stops sitting in a box wide enough for a paragraph.

**The bills list gains a real door.** Every row now ends in a right-aligned chevron button. That is
not decoration: the rows were plain clickable table rows, which a keyboard or a screen reader cannot
reach at all — so before this, those coaches had **no way into a bill**. **Record stays beside it**
(owner ruling, asked before building): unlike the club tab's one-tap pill, Record fires on nearly
every unpaid row, and the by-due-date view is where a treasurer works down a month's payments in one
pass.

**Read-only money staff** open the same panel with plain values and no write control — this stays
the only place in the product they can read a bill's payee and its tags.

**Why it matters.** Month-end reconciliation was the flow the old page shape punished: filter to
Overdue, scroll, open a bill, pay it, come back to a rebuilt list with the filter gone and the
scroll at the top. That is fixed structurally rather than by a workaround. And the bill is now the
last money record in the portal that behaved differently from its neighbours — the grammar has no
money-area exceptions left.

**Trade-offs, named.** Browser Back no longer closes the panel (it leaves the Ledger) — the ruled
convention for every room, because opening a record must not stack history entries; ✕ and Escape
close it. The panel's own scroll replaces the page's, which is what stops a long schedule falling
off the bottom the way it did in 2026-08. And the schedule now sits **above** the details rather
than below them — the reverse of the page, and correct for a panel whose figures never scroll away.

**Two defects found while building, both fixed here.** The three-way scope window had **no keyboard
or screen-reader support of any kind** — no Escape, no focus trap, no dialog role; over a page that
was survivable, over a panel it meant Escape closed the record underneath it. And the History fold
could not open itself after the fact, so a coach recording a payment saw nothing happen.

## Success criteria

- A coach can describe how to open any money record in one sentence.
- No form control renders inside any money table row.
- Recording across several bills/families at month end takes no more taps than today.
- Every room passes keyboard-only and screen-reader use.
- Demo tours and help articles describe the new screens in the same release that ships them.

**Priority:** high (owner-initiated). **Plan:** `COACH_MONEY_LIST_ROOM_QUESTION_PLAN.md`.
**Mockups:** artifact `11607f0a-e0c1-4bb4-bbd5-b6f81d834fbc`.
