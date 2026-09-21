# Coaches portal — the tinted panel retires

**Status:** RULED 2026-09-21 (owner: *"remove this blue tinted panel from the app altogether so we have
consistency in formatting throughout"*; D1–D3 as drawn — the whole coaches-portal list in one pass;
D4 the family/public pages as a second wave). **BUILT ON DEV 2026-09-21** — CSS only, no migration.
Owner QA walk §215 owed. Commit owed.
**Hub:** `docs/projects/active/COACH_TINTED_PANEL_RETIREMENT_HUB.html` ·
https://claude.ai/artifact/Rj3qtLWpPXDQGUTPnmzBxF (Mockup · Everywhere the tint paints · Decisions ·
Full Plan · QA Walk). **PM brief:** `COACH_TINTED_PANEL_RETIREMENT_PM_BRIEF.md`.

## 1. Why

`--home-olive-soft` (olive at 10% on paper; blueprint-blue at 18% in the dark gate — the owner's "blue
tinted panel") was the ground of a whole family of surfaces. The event-form pass flattened the shared
`.formSection` on 2026-09-21 and kept one exception — the bill's payment-schedule editor, whose approved
August drawing was built on the tint. The owner's answer to that open call was the wider ruling: no
tinted panel anywhere.

## 2. The rule (D1, D2)

- **Inside a white form**, a section goes FLAT and separates by space (the event form's rule).
- **On the paper page**, a panel becomes a WHITE CARD with a hairline (the Staff screen's 2026-09 rule).
- **State fills keep the colour** — selected / on / now / drag-over / active-filter are states, not
  panels; the same token is the warm theme's "on" fill and a selected thing must still look selected.

## 3. What changed (all CSS)

`coaches.module.css`:
- White card + hairline: `.tableAsCards tr`, `.rowListItem` (≤640 — every phone card portal-wide),
  `.rosterTable tr`, `.setupItem`, `.setupPanel` (and its blue hairline → the house hairline),
  `.linkCard` (same), `.miniRow`, `.calWeekDay`, `.attendanceRow`, `.lineupPeekStats`.
- Fill off, own border stays: `.attendanceStatusGroup`, `.attendanceStatusBadge`, `.lineupNotPlaying`,
  `.lineupPeekEmpty`, `.rosterPitchChip`, `.ppRailBadge summary`, `.ppYoureOn` (keeps its olive
  border), `.scrollXHint` (gains a hairline — it had none).
- Fill off, nothing replaces it: `.tableFoot td`, `.driveHandIn td`, `.calMonthHeader`, `.occHead`.

`budget.module.css`: `.planEditor` flat (the bill's schedule editor is a group of the form; its
D1 comment rewritten); the `.planEditor .repeatBox` transparent override gone (moot on white); the
SHARED ≤640 `.periodInputRow` card is white (bill, budget line and dues editors agree), the two
per-editor overrides gone; `.sandboxNote` a white card with a hairline.
`SampleBudgetSheet.module.css`: `.fence` keeps its dashed lime border, loses the fill.
`components/accounting/BudgetItemPicker.module.css` + `.tsx` (found after the ruling — the owner pointed
at it on Add Budget Line): the "add an item" tray `.addForm` was a LITERAL blue (`rgba(96,165,250,…)`)
with an olive override in warm — the inventory's token grep could not see it. Now a hairline tray on
white (kept a hairline, not flat: an inline tool with its own Cancel / Add item inside a form that has
a footer — the bill editor's "Repeat monthly" tray's shape); the warm override retired; "Suggested $"
loses "(optional)"; "Add Item" → "Add item". Shared by nine forms (every money form, the club tab,
the drives and sponsors, the admin budget page).
`CoachExploreCatalog.module.css`: `.orgNudge` (warm) a white card.

**Left alone, by kind:** the state fills above; the game console's identity chips (`.gdPos`,
`.gdPeriodChip`, `.gdMomentWho` — its own day-of palette, flagged for the owner); the dues matrix's
pinned-column gradient (mechanics — an opaque ground under a sticky column); `.autoChip` / the
budget's open-category tint (open = a state); `.detailSection` (admin surfaces, not the coach portal);
three dead selectors the dead-CSS gate already grandfathers.

## 4. Verification
CSS purity / selectors / palette + text contrast / spelling gates clean; `verify:changed` clean.
Rendered check on schedule-attendance, roster, player, lineup builder, payables clean; Season's End
reports four findings (a 29px "Share your season" button, the team switcher spilling at 1440) that
**reproduce with the pre-sweep stylesheet** (A/B'd against a fresh backup) — pre-existing, not this
pass's; the payables "19 days overdue" caption is the baselined calendar-rotting key.

## 5. Second wave (D4, not built)
The consumer/family side paints the tint on ~20 panels (family, account, notifications, sign-in,
discover, chat, start) and the tryout day cards (`components/rep-teams/Tryout*`) on ~14 — same rule,
own drawing, own session.
