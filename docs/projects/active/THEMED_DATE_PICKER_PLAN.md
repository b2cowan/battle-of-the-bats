# Themed Date Picker — Plan

**Status:** owner ruled 2026-10-25 ("I agree with your recommendations"), all four asks as recommended. BUILT on dev 2026-10-25, all 138 fields converted; /simplify and /review (five lenses, 22 confirmed findings fixed) done 2026-10-25; owner browser walk owed. The bookkeeping screen's rebuilt form and the owner ledger (another session's uncommitted work) carry their date fields into that session's own commit. Unit suite: the new guard + logic tests pass; the 9 remaining failures belong to other sessions' in-flight files.
Drawing: https://claude.ai/artifact/Rvo2a36tonsHRyEeeWf4Cp (source `THEMED_DATE_PICKER_MOCKUP.html`, this folder).
Decision record: `memory/design_decisions.md` 2026-10-25 "A DATE OR TIME FIELD OPENS OUR CALENDAR…".
PM brief: `THEMED_DATE_PICKER_PM_BRIEF.md`.

## What changes

Every `<input type="date">`, `type="time"` and `type="datetime-local"` in the product is replaced by one of
three shared fields:

| Field | Value contract (unchanged from the native control) | Desk (fine pointer, >768px) | Touch / ≤768px |
|---|---|---|---|
| `DateInput` | `YYYY-MM-DD` or `''` | typeable box showing "Oct 25, 2026" + our calendar | native `type="date"` |
| `TimeInput` | `HH:MM` (24h) or `''` | typeable box showing "8:00 a.m." + a field-menu list in steps | native `type="time"` |
| `DateTimeInput` | `YYYY-MM-DDTHH:MM` or `''` | a `DateInput` + a `TimeInput` side by side | native `type="datetime-local"` |

The value strings are exactly what the native control produced, so no API, database or save path changes.
Each field takes the host's `className` for the box itself, so a field keeps its screen's look (36px in the
admin kit, 44px in the coach rooms). Only what opens changes.

## Rules the fields carry (from the ruling)

- Calendar: Monday first; today = 2px olive edge; picked day = solid olive (lime in dark, by token); range
  shading from `rangeStart`; days outside `min`/`max` wear the 0.5 disabled face; month/year view from the title;
  Today in the foot (faded when outside the range); Clear only when the field is not `required`.
- Keyboard: arrows move a day/week, Page Up/Down a month, Home/End the week, Enter picks, Esc closes and returns
  focus. Typing works: ISO commits at once; "Oct 25 2026", "25 Oct 2026", "Oct 25" (current year) and
  unambiguous numeric dates commit on blur/Enter. An unreadable entry stays visible and marks the field invalid.
- `required` / `min` / `max` keep browser form validation (custom validity on the visible box).
- `name` + `defaultValue` keep FormData forms working (a hidden input carries the stored value).
- The panel hangs over its window (`useFieldMenu`, which gains a `height` in its shape for a panel taller than a list).
- Dates are plain calendar strings end to end; no `Date` in local time anywhere (the wrong-day bug class).
  "Today" is `tournamentToday()`.

## Order of work

1. Shared logic (`lib/date-field.ts`) + unit tests; the three fields + one stylesheet; the `useFieldMenu` height.
2. Sweep, portal by portal: coaches → club admin kit → tournament admin → platform admin → public/other.
   The accounting `DateField` wrapper keeps its API and wraps `DateInput`.
3. Guard: `tests/unit/native-date-input-guard.test.ts` fails on any native date/time/datetime-local control outside
   the shared fields.
4. Help content: any guide that says how to pick a date (`/docs` pass).

## Build notes (2026-10-25)

- A host's save-on-leave (`onBlur`) runs AFTER the value committed on leaving has reached it (`useLeaveAfterCommit`): a typed date followed by Tab otherwise saved the old date (found in the season block during the sweep).
- `useFieldMenu` takes `shape.height` for a panel taller than a list; `tests/unit/field-menu-hangs-over-guard.test.ts` rolls both new callers.
- A field in a flex row that relied on its input's own `flex: 1` passes `style={{ flex: 1 }}` (the field's wrapper is the flex item now): BracketBuilder, DateRangeDropdown, the dues installment row, BillWindow chips.

## Risks and checks

- Wrong-day: covered by the pure-logic tests (grid math, parsing, month stepping) — no local-time `Date`.
- Playwright/UAT specs that select `input[type="date"]` or `.fill()` one: listed by the census, updated in the sweep.
- A host stylesheet that targets `input[type="date"]` (indicator hacks) becomes dead CSS on a desk and is removed
  where the field is the only consumer.
- Owner walk: one date, one range pair, one time and one date-and-time field per portal, warm and dark, plus a
  phone check that the native picker still opens.
