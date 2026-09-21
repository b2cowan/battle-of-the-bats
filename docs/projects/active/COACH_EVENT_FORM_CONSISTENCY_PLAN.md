# Coach Schedule — the Add / Edit Event form, held to the portal's own form rules

**Status:** RULED 2026-09-21 (owner, on the mockup — all eight items as recommended, plus the
optional "ask the date once"). BUILT ON DEV 2026-09-21. **/review run 2026-09-21 (Standard tier,
3 lenses): 1 High + 3 Medium + 1 Low confirmed and FIXED, 1 Advisory fixed — see §7.** Help synced
the same day (/docs). Owner QA walk §212 owed. **Committed `aa1421a0` 2026-09-21.**
**Mockup (the gate, published as an Artifact):** `docs/projects/active/COACH_EVENT_FORM_CONSISTENCY_MOCKUP.html`
· https://claude.ai/artifact/VzYmNKQ2DTqXRFaPiWKgKx
**PM brief:** `docs/projects/active/COACH_EVENT_FORM_CONSISTENCY_PM_BRIEF.md`
**Surface:** `app/[orgSlug]/coaches/teams/[teamId]/schedule/page.tsx` (the add/edit event modal), plus a
small sweep of sibling forms.

## 1. Why

The event form was built before several standing rulings and drifted against each of them:
the 2026-08-22 "a one-value form field is a dropdown", the 2026-08-25/26 "one plain asterisk, mark
the few required, never the many optional", the 2026-07-30 "never a filled CTA on a panel tinted with
its own hue" (and the Staff screen's 2026-09 drop of the tinted panel), the List · Room · Question
shell (twenty forms stand in `QuestionShell`; this one was hand-built), and the portal's sentence-case,
square-button footer. The owner's read from a screenshot ("blue background", "* Required first", "pills
or a dropdown?") was the trigger; the review widened it to eight items and one optional idea.

## 2. Decisions (owner, 2026-09-21 — all as recommended)

| # | Item | Ruling |
|---|------|--------|
| 1 | Event type picker inside the form | **Removed.** Every door already chooses the type (the Add Event menu, the practice hub's `?add=practice`, a tournament's game slot). The title carries it, with the event's colour dot after the title text. Wrong pick → Cancel and pick again. `changeEventType` survives for the one remaining in-form hop ("Create a tournament first"). |
| 2 | "* Required" legend | **Dropped** here and on the seven sibling forms that still carried it (Add Player, Add Budget Line, dues credit, head-coach editor, free schedule editor, interest form). The asterisk is the whole signal (08-25 ruling). |
| 3 | Boxed, tinted When / Where / Who sections | **Flattened at the CSS rule** (`.formSection`): no fill, no border, no padding; groups separate by space. The When/Where/Who headings are dropped (they repeated the labels beneath them). The same rule draws every open `CoachFormDisclosure`, Give Award and Paste-a-roster — all flatten together. Headings that carry information stay (From the organizer / Your game-day plan). |
| 4 | Pill footer buttons, "Save Event" | **Retired** `.eventFormModal` (the private 600px width and the pill radius). Footer = the ordinary square buttons; the create label is the title's verb in sentence case — **Add game / Add practice / Add tournament / Add team event**; editing keeps "Save changes"; a series keeps "Add 11 games". |
| 5 | Home / Away segmented row | **Dropdown**, beside Opponent on one row; the consequence hint sits under the row. (Ruled with the counter-argument on the table.) |
| 6 | "Arrival / call time" vs "Arrival time" | **One name: Arrival time**, on all three branches (one-off, repeating, mirrored). Help keeps "call time" as a search keyword. |
| 7 | "Add details (optional)" | **"More — field, uniform, tags, links, notes"** on a game, **"More — field, address, links, notes"** otherwise; open title "More". The premium "(optional)" label pile is swept in the same pass (§4). |
| 8 | Hand-built modal | **Stands in `QuestionShell`** (`wide`), which brings the dialog floor (role, label, Escape, Tab trap, focus restore), the shared overlay (a full-screen sheet ≤640 with no opt-in) and the busy-gated close. The page's own overlay-lock line no longer counts the form (the shell registers it — the expenses panel's double-count lesson). |
| 9 | Optional — ask the date once | **Accepted.** A one-off event asks **Date · Start time · End time** (the repeat branch's own shape) instead of two datetime pickers. A multi-day tournament keeps Start date / End date. |

## 3. How "date once" is built (the only real logic change)

`form.startsAt` / `form.endsAt` (`YYYY-MM-DDTHH:mm`) stay canonical — the save, the guards, the
tournament prefill and the mirrored facts all read them unchanged. The three visible pieces are the
form's EXISTING `startDate` / `startTime` / `endTime` fields (the repeat branch's own), and:

- `withWhenPieces(form)` seeds the three from `startsAt`/`endsAt` wherever the form is (re)built —
  `openAddForm`, `openEditForm` (after the D9 practice-end seed), `selectParentTournament`.
- `setWhen(patch)` writes a piece and recomposes both datetimes; it keeps the "end follows the start
  by two hours unless the coach set a custom end" rule `setStartsAt` carried.
- Clearing a piece leaves the other pieces on screen and empties `startsAt` (Save greys) — no state
  is lost to a native input's clear button.
- Toggling **Repeat weekly** now opens with First date pre-filled from the one-off date (the pieces
  are shared), which is a small improvement rather than a side effect.
- **Known limit, accepted:** an event whose end is on the NEXT day (23:00–01:00) is recomposed
  same-day if its date or times are edited. Youth-team events do not cross midnight and the repeat
  branch already assumed same-day.

## 4. The sweep (same rules, other forms)

- **Legend removals (7):** `roster/page.tsx` (keeps the "Adding several? Paste a list →" line),
  `accounting/budget/panel.tsx`, `accounting/dues/panel.tsx`, `CoachStartInterest.tsx`,
  `HeadCoachEditor.tsx`, `ScheduleEditor.tsx`.
- **`.formSection` flattened** (one CSS rule): open disclosures everywhere, `GiveAwardModal`,
  `RosterBulkAddSheet`. A sibling rule adds the group gap inside `.formBody`.
- **"(optional)" labels, premium forms:** `GiveAwardModal` (2), `GoalSheet` (3), `RecordResultSheet`,
  `ReviewGoalDialog` (2), `MetricDefinitionSheet`, the game console's "About a player?",
  `ScoutObservationForm`, the budget period grid's "Label (optional)" (2 + one aria-label).
  **Out of scope:** the FREE portal's `RosterEditor` / `ScheduleEditor` / `FeeEditor` "+ Add …
  (optional)" panels — a different, older idiom (the disclosure's own doc names it as such); a
  separate call.
- **Help:** the game-day-details article's term and FAQ say **Arrival time** (keywords keep
  "call time"); the schedule article's Premium line says "arrival time".
- **CSS retired:** `.eventFormModal` (+ its pill-radius rule), `.eventTypePicker`, `.eventTypeOption`,
  `.eventTypeOptionActive` and their two warm overrides; `EVENT_TYPE_PILLS`. `.eventTypeDot` stays
  (the title mark). `.modal:has(.modalFooter)` widens to `:has(.modalFooter, .editScope)` so the
  repeating-series scope chooser lands flush the way the footer does (it used to rely on the
  event modal's explicit `modalFlushFooter`).
- **New CSS:** `.formSectionGrid3` (Date · Start · End; ≤640 the date spans the row and the two
  times share the second), `.modalTitleMark` (title text + the colour dot).

## 5. Verification

- `npm run verify:changed` (spelling gate, dictionary gate, lint on the touched files); `npm run
  typecheck` (shared CSS module + a shared component pattern touched).
- Unit: `tests/unit/coach-page-actions-guard.test.ts` still holds (the Add Event door is untouched).
- UAT `coach-schedule-smoke.spec.ts` drives the recurrence through the API, not the form's controls
  — no locator changes.
- Browser (owner): the QA walk in the Owner QA Ledger (§212).

## 7. /review findings (2026-09-21) — all fixed in the same unit of work

| Sev | Finding | Fix |
|---|---|---|
| High | The repeat branch's First date / Start time / End time wrote the pieces directly, so Repeat weekly ON → edit → OFF showed the edited time and saved the pre-toggle one (and a cleared piece left Save enabled off the stale datetime). | Every piece write goes through `setWhen`, both branches; the +2h auto-end applies to a one-off only (a series never auto-filled its end, and still doesn't). |
| Medium | A dialog opened from a `CoachToolbarMenu` item returned focus to `<body>` on close — the item unmounts on select, the menu's rescue yields to the self-focusing dialog, and the floor's two-deep history recorded `<body>` as the opener. (Not a regression — the form had no floor before — but every menu-opened QuestionShell had it.) | `useDialogFloor`'s history is six deep and the opener is the newest element still in the document outside the panel: the menu's trigger. Shared primitive; every menu-opened dialog benefits. |
| Medium | `selectParentTournament` re-seeded the pieces even when the picked tournament had no start date, blanking a piece the coach still had typed after clearing another. | Re-seeds only when it moved the date. |
| Medium | An imported game with a blank Home/Away cell holds no side; the new `<select>` painted "Home" over an empty value (the segmented control showed nothing selected). | A "—" option renders while the value is empty. Saving untouched still sends no side, as before. |
| High (blast radius) | `InstallmentPlanEditor` (the bill's payment-schedule editor) roots on `shared.formSection` and its owner-approved D1 drawing (2026-08-29) IS the tint — "rows on one tinted surface", a transparent repeat tray, white cards on phone. The flatten reached a fifth surface nobody ruled on. My consumer search had matched `styles.formSection` and missed the `shared.` alias. | The tint/border/padding moved onto `.planEditor` byte-for-byte, so that editor looks exactly as approved. **Open for the owner:** whether it should flatten too (§8). |
| Low | Clearing the Date on a practice read "A practice needs an end time" (the composed end emptied with the date). | "Missing" reads the End time piece; "before the start" compares the datetimes only when both exist. |
| Advisory | `.formSubGroup`'s comment assumed a bordered parent. | Comment rewritten. |

Also swept by the review, clean: no double dialog floor (both doors close the slide-over first); the overlay counter registers through the provider; the ≤640 sheet is the overlay's default; the footer and the scope chooser land flush; no test asserts the retired strings; help keywords intact.

Rendered check (`check:layout`): `--changed` widened to the whole registry (shared stylesheet) and cold-compiled into "did not render" lines; re-run `--only=coach-schedule,coach-schedule-attendance,coach-roster,coach-payables-schedule` — one NEW finding, `coach-payables-schedule @768` "19 days overdue · partly paid" spilling 65px: **pre-existing and already baselined on the sibling screen** with the reason "the key rots with the calendar" (it read "4 days" when baselined). Not this diff's; COACH_TABLET_BAND territory.

## 8. Open for the owner

- **The bill's payment-schedule editor** still sits on its tinted surface (its own approved drawing). It is now the portal's one remaining tinted form section. Flatten it under the same ruling, or keep it as the one place where rows-on-a-surface was the design? Not decided here.

## 6. Not built, on purpose

- No "change the type inside the form" affordance — the door is one tap away.
- No `DateField` (our calendar glyph) on this form — it lives in the budget module's CSS; adopting it
  here is a shared-primitive move for its own session.
- The free-tier editors' "(optional)" idiom (§4).
