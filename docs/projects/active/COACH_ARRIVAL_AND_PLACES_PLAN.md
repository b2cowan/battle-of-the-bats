# Coach Schedule — Arrival as a lead time, and a place the team keeps

**Status:** RULED 2026-09-21 (owner, on the hub — D1–D9 all as recommended). **BUILT ON DEV 2026-09-21** — mig 307 applied to dev (PROD-OWED with the promote, before the code); typecheck + `verify:changed` clean; help synced. Owner QA walk §214 owed. **Committed `aa1421a0` 2026-09-21** (with §212).
**Hub (mockup · PM brief · decisions; the plan and QA tabs join it as they exist):**
`docs/projects/active/COACH_ARRIVAL_AND_PLACES_HUB.html` · https://claude.ai/artifact/GHsg5ucCcPnr9USu3E5std
**PM brief:** `docs/projects/active/COACH_ARRIVAL_AND_PLACES_PM_BRIEF.md`
**Sits on:** the rebuilt Add Event form (`COACH_EVENT_FORM_CONSISTENCY_PLAN.md`, same day).

## 1. Why

Two owner asks from the first look at the rebuilt form: *"default the arrival time to 1 hour before the
game rather than the time I open it — maybe pills for 15 / 30 / 45 / 1 hour"* and *"we separate
location from address and field, so a saved location has no address link unless I type it every
time — maybe a location button that opens a modal to create or select."* What the code does: the
Recent chips carry the address of the MOST RECENT event with that name (usually blank) and never the
diamond; the org venue library is admin-only; `arrival_time` is an `HH:mm` clock the native picker
opens at the current time of day.

## 2. Decisions (owner, 2026-09-21)

| # | Ruling |
|---|--------|
| D1 | Arrival is a **dropdown of lead times** (None · 15 · 30 · 45 min · 1 h · 1½ h · 2 h · A specific time…), the clock shown beside each. Not pills (the 08-22 convention; seven answers need the list anyway). |
| D2 | **No hard "1 hour before" on every new game.** Team Settings gains "Arrive before a game / a practice"; new events start there; blank until the team says. |
| D3 | "A specific time…" **opens at start − 1 hour**. |
| D4 | A **place book per team**, reached by **typing into Location** (the tag picker's grammar: find, add inline, Manage inside) — not a button that opens a chooser. |
| D5 | A **free-typed location** still saves as text and creates no place; "Add … as a place" is offered, never forced. |
| D6 | Events keep their own copy of name / address / diamond, plus a link to the place. Editing a place's address **offers** to update upcoming events at it; past events keep what they had; removing a place leaves its events' text alone. |
| D7 | The book is **seeded from the team's history** on migration (every distinct location, best address, most common diamond). |
| D8 | **Address leaves More**; the **diamond stays** there, pre-filled from the place, per game. |
| D9 | The **schedule import matches** a row's location to a place by name and takes its address (and diamond when the row has none). |

## 3. Build

### 3.1 Migration 307 `307_arrival_and_places.sql` (dev now; PROD-OWED with the promote, BEFORE the code)
- `rep_team_places`: `id, org_id, team_id NOT NULL, name (1–120), address, field_number, note (≤160),
  created_by, created_at, updated_at`. Unique `(team_id, lower(btrim(name)))`. RLS = the tag book's
  (read: org members + assigned coaches; write: assigned coaches + org admins) — every route runs
  service-role and gates on `canManageSchedule`.
- `rep_team_events.place_id uuid NULL REFERENCES rep_team_places ON DELETE SET NULL` + index.
- `rep_teams.arrival_before_game_min`, `rep_teams.arrival_before_practice_min` (int NULL, CHECK in
  15·30·45·60·90·120). Team-scoped — a habit, not a season fact.
- **Seed (data, idempotent):** per team, one place per distinct `lower(btrim(location))` over its
  events (mirrored games excluded — the organizer's venue is not the team's place): name = the
  spelling on the most recent event, address = the most recent non-empty, field = the most common
  non-empty; then `place_id` set on every event whose location matches. Registered in
  `MANUAL_PROD_STEPS.json` (the seed is invisible to the drift check). Verify queries at the foot.

### 3.2 Model + data (`lib/types.ts`, `lib/db.ts`)
- `RepTeamPlace`; `RepTeamEvent.placeId`; `RepTeam.arrivalBeforeGameMin / PracticeMin`.
- Places: list (with event counts + last-used from events), create, update (+ optional
  `updateUpcoming`: rewrite `location_address` / `field_number`… only `location`, `location_address`
  on upcoming events at that place; the diamond is per-game and is NOT rewritten), delete (FK sets
  `place_id` NULL; text stays). Event create/update carry `placeId`. Team update carries the two
  minutes.

### 3.3 Pure helpers (`lib/coach-arrival.ts`, `lib/coach-places.ts`) + unit tests
- `ARRIVAL_PRESETS`, `arrivalClockFor(startHHmm, minutes)` (same-day; null when it would cross
  midnight), `arrivalPresetOf(startHHmm, arrivalHHmm)` (a preset or null), and the follow rule.
- `matchPlace(places, name)` — case-insensitive trimmed name match for the import and the picker.

### 3.4 API
- `GET/POST /api/coaches/[orgSlug]/teams/[teamId]/places`; `PATCH/DELETE …/places/[placeId]`
  (`{ …fields, updateUpcoming?: boolean }`). Read = `resolveCoachTeamRead` + `canManageSchedule`;
  writes = live season + `canManageSchedule` (the game-tag library's gates).
- Events POST/PATCH accept `placeId` (proved to be this team's). Import: a row's location that
  matches a place takes its `place_id`, its address when the row has none, its field when the row
  has none.
- Team GET returns `arrivalDefaults: { game, practice, canEdit }`; PATCH `arrivalDefaults` gated on
  `canManageSchedule`.

### 3.5 Client
- **Arrival control** (`components/coaches/ArrivalSelect.tsx`): a `<select>` of presets + "A specific
  time…"; derived from `startTime` + `arrivalTime`; local `custom` mode so picking "A specific time…"
  (which pre-fills start − 60) does not snap back to the "1 hour" preset; consequence line "Arrive by
  5:15 p.m. — shows on the event and the calendar export." Used on all three form branches. The
  form's `setWhen` moves a PRESET arrival with the start (not a specific time).
- `openAddForm` seeds `arrivalTime` from the team default for games (league/tournament game) and
  practices.
- **Place picker** (`components/coaches/PlaceCombobox.tsx`): combobox over the team's places (most
  recently used first, "N events"), free text allowed, "＋ Add “…” as a place" → `PlaceSheet`
  (QuestionShell: name *, address, field/diamond, note), "Manage places…" → `ManagePlacesSheet`
  (QuestionShell: rows with Edit → PlaceSheet, Remove with confirm; the address edit asks about
  upcoming events). Picking fills `location`, `locationAddress`, `fieldNumber` (only when empty)
  and `placeId`; clearing clears `placeId` and the name (address/field stay editable per event).
- Form: **Address leaves More** (a free-typed location with no place: the "Add as a place" path is
  where an address is typed; the mirrored branch shows the organizer's). Field / Diamond # keeps its
  seat under More with the hint "Diamond 2 is Sherwood Park's usual — change it here for this game
  only" when it came from the place. The Recent chips retire.
- Team Settings: a **Schedule** section with "Arrive before a game / a practice" selects, optimistic
  save (the visibility switch's idiom).
- Event slide-over: the place's note under the location line when the event's place has one.
- The export/ICS read the text columns — unchanged.

### 3.6 Help + records
- Schedule article: the place book (find / add / manage; free text still fine; the diamond per game);
  game-day details: "Arrival" as a lead time, the address lives on the place; Team Settings: the two
  defaults. Keywords/searchText carry "place", "venue", "saved location", "arrive before".
- Dictionary rows for the new table/columns; `refresh:snapshots`; TODO; Owner QA Ledger §214; hub
  gains the Full Plan + QA Walk tabs; memory.

## 4. Verification
`verify:changed` (incl. `check:migrations`, dictionary, spelling, CSS gates), `typecheck` (types +
db.ts touched), focused lint, the new unit tests, the rendered check on `coach-schedule` +
`coach-settings`; owner walk §214.

## 5. Not built, on purpose
- No org-level venue library for coaches (admin's `org_venues` stays admin's).
- No merge of two places (rename covers the spelling case; the unique index blocks a duplicate).
- No arrival on tournaments / team events by default (the team default covers games and practices).
