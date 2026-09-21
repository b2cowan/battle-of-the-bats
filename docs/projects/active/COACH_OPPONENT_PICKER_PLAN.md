# Opponent Picker — the Opponent field reads the Scouting Book

**Status:** ruled 2026-09-21 (D1–D7 as drawn; D5 in, D6 held) · built on dev + /review (8 findings, 1 High fixed) + committed `606a6861` the same day · owner QA walk owed
**Hub (mockup · brief · plan · decisions on ONE URL):** https://claude.ai/artifact/7BJir7hhGj6C39eVrXGXcn
— source `docs/projects/active/COACH_OPPONENT_PICKER_HUB.html` (republish the SAME path to stack a round).
**PM brief:** `COACH_OPPONENT_PICKER_PM_BRIEF.md`.

## 1. How it started

Owner, 2026-09-21, reading the rebuilt Add Game form: *"shouldn't we make opponent part of the tags
system? how else can we drive consistency with the scouting book if we rely on free text opponent
entry?"* The answer re-framed the question: the instinct (the form is where drift is born) is right;
the shelf (tags) is wrong. Mockup round 1 published the same day; owner: *"looks good, go for it"*.

## 2. What the code does (verified 2026-09-21) — the facts the rulings rest on

- **The Scouting Book is an overlay, not an entity.** `rep_team_events.opponent` is free text;
  `rep_team_opponents` is keyed by `normalizeOpponentName()` (`lib/opponent-name-key.ts`: casefold,
  strip punctuation, collapse whitespace, drop a leading "the") + `rep_team_opponent_aliases` for the
  coach's merges ("Same team as…" on `history/opponents/[opponentKey]`). **No FK from events to
  opponents — ever** (book plan, archived; the reason still holds — see next).
- **Three writers of the opponent string, and the coach types only one:**
  1. the Add/Edit Game form (`app/[orgSlug]/coaches/teams/[teamId]/schedule/page.tsx`, a bare
     `<input id="event-opponent" placeholder="Team name">`);
  2. the schedule importer (`lib/coach-schedule-import.ts` — the sheet's `opponent`/`vs`/`versus`/
     `against` column, as-is);
  3. tournament mirroring (`lib/tournament-game-mirror.ts` — the organizer's `opponentName`; the edit
     form shows it read-only under "From the organizer", `editingMirrored`).
  A key on the game would be null on paths 2 and 3, so every reader would need both paths for nothing
  the alias table does not already give. **Consistency is a spelling, not a key.**
- **`PlaceCombobox`** (`components/coaches/PlaceCombobox.tsx`, Arrival & Places D4–D6, built the same
  morning) is "the tag picker's grammar, for one value": type to find, most-recently-used first, pick
  to fill, type over to detach, `＋ Add` row, `Manage places…` last row. Reuses `.tagCombo*` CSS, the
  drop-up flip inside a clipping box, and `claimEscape` ownership. **Opponent is the second
  single-value book field on that grammar.**
- **The list route** `GET /api/coaches/[orgSlug]/teams/[teamId]/opponents` returns `{ opponents:
  OpponentBookEntry[], clubKeys: string[] }`. Gate: `canLogScoutingObservation` (any schedule holder —
  the row chips read it), with the pooled fields redacted unless `canViewScoutingBook`. The schedule
  page already fetches it (`bookByKey`, keyed by `key` AND every `aliasKeys` entry) for the row record
  chips. The picker reads the SAME fetch — no new endpoint.
- **Club Shared Book** (`lib/coach-club-book.ts`): matches across the club's sharing teams by spelling,
  with **no cross-team guesser** — its stated blind spot: *"a same-club-different-spelling miss shows
  nothing."* `clubContentKeys()` already does the cheap sibling read (their minted opponent rows +
  aliases + observation counts) to light the list's club badge. `reader.opponents()` returns full
  `RepTeamOpponent` rows (with `displayName`), so the sibling SPELLINGS are already in hand.
- **Record chips key off each game's OWN spelling** (`bookRecordFor` → `bookByKey.get(normalize(
  e.opponent))`), with merges folded server-side. The picker must write the DISPLAY spelling, never the
  normalized key.
- Both the book and Add Game are **live-season instruments**; no closed-season surface is involved.

## 3. Rulings (owner, 2026-09-21, "looks good, go for it" on the hub as drawn)

| # | Ruling | Why |
|---|--------|-----|
| D1 | Opponent is a type-to-find field over the Scouting Book — **not a tag library** | one value naming a record (a place, not a label); the Place grammar exists; two vocabularies = two merge tools that don't know about each other |
| D2 | Picking writes the book's **spelling**; the game holds **no link** | two of three writers can only supply a name; the book resolves names already |
| D3 | A name the book doesn't know **saves as typed**; the list shows one quiet "new to your book" line; **no "Add an opponent" sheet** | an opponent carries nothing but a name; the book mints its page after the game as today |
| D4 | **No "Manage…" row** at the foot of the list | nothing is minted on the form; merge lives on the opponent's page; a page-door from a half-filled form was turned down 09-01 |
| D5 | A sharing club team's list also offers the club's spellings, as a second group **"Your club has notes on"** — **accepted** | turns the club book's stated blind spot into the case that cannot happen; same gate as the club layer (Club plan + sharing), no club record, no link |
| D6 | "Same team as…?" nudge on the form — **held** | the guess the book refused, dressed as a question; count a season's merges first; slots in later without changing what is drawn |
| D7 | League imports and tournament games untouched | they can only supply a name; the book reads them as today |

## 4. Scope

- The **Opponent** field on the rep-team Schedule's Add Game / Edit Game form, desktop modal and phone
  sheet, wherever `needsOpponent(form.eventType)` is true and the game is not organizer-mirrored.
- Help: the Scouting Book's "same team twice" answer points at the field; the Add Event article names
  the field's behaviour in its existing sentence.

**Out of scope (stated on the hub):** the basic/standalone `ScheduleEditor` (no book to read — stays a
text box); the importer's preview (a "matches your book" column is a separate, later idea); mirrored
tournament games (read-only); the book's own pages and merge tool; any org-level opponent registry;
the nudge (D6).

## 5. Build (as built 2026-09-21)

### 5.1 Pure logic — `lib/coach-opponent-picker.ts` (new, unit-tested)
- `filterOpponentEntries(entries, query, limit)` — entries with meetings OR book content; match on the
  normalized query against `key`, every `aliasKeys` entry and the normalized display name (substring);
  ordered by last meeting newest first, no-meeting entries last, ties by name.
- `resolveOpponentText(entries, text)` → `{ entry, viaAlias } | null` — the picked state is DERIVED
  from whether the current text resolves in the book (directly, or through a merged-away spelling).
  There is no picked id; typing over the name is the detach.
- `opponentPickedLine(resolved, formatDate)` — "2-1 vs them · last met Jun 14" / "Same team as
  Oakville Thunder · 2-2 vs them" / "No games yet · 2 observations".
- `filterClubSpellings(spellings, query, limit)` — same matching over the club rows.
- `ClubPickerSpelling` shape: `{ key, displayName, teamNames: string[], observationCount }`.

### 5.2 Club spellings — `lib/coach-club-book.ts` + `-server.ts` + the list route
- `clubPickerSpellings({ viewerEntries, siblingTeams, siblingOpponents, siblingAliases,
  observationCounts })` (pure): every sibling opponent row WITH content (summary or observations),
  dropped when its spelling or any alias resolves to a viewer entry (the viewer's own row wins),
  grouped by normalized name across siblings (team names joined, observation counts summed),
  `displayName` from the first sibling row. Sorted by name.
- `buildClubListExtras(reader, opts)` → `{ keys, spellings }` — ONE cheap read for both; the existing
  `buildClubContentKeys` becomes a wrapper over it (the adversarial two-org test keeps its seam).
- Server: `resolveClubListExtras` (absent-on-failure, like every club read).
- Route: `GET …/opponents` now returns `{ opponents, clubKeys, clubSpellings }`; `clubSpellings` rides
  the SAME gate as `clubKeys` (`scoutingBookAccess && clubAccess.canSeeClubLayer`) — a non-sharing or
  non-Club team gets `[]`.

### 5.3 The field — `components/coaches/OpponentCombobox.tsx` (new)
- Props: `id`, `value` (the text), `onChange(text)`, `entries: OpponentBookEntry[]`, `clubSpellings`,
  `onOpen()` (the host's re-read — the tag picker's rule), `disabled`.
- Renders the same input + `.tagComboDropdown` as `PlaceCombobox`, with the drop-up flip and Escape
  ownership copied. Groups: "Your opponents" (≤8) then "Your club has notes on" (≤4). Each own row:
  name, sub-line "Last met Jun 14 · W 5–3", trailing `.scoutRecChip` with `data-tone`. Each club row:
  name, sub-line = team names, trailing "club notes".
- New name (query non-empty, no match, book non-empty): `.tagComboEmpty` line — *New to your book —
  saves as typed. "…" gets its own page after this game.*
- Empty book AND no club spellings: the dropdown never opens — the field is the text box it was.
- Under the input, when the text resolves: the picked line (5.1) as `.formHint`; for a club spelling
  with no own meetings: *Your club has notes on them (Millwoods 12U).*
- No ✕ clear button (the built Location field has none either — the mockup drew one; parity with the
  sibling field wins, flagged in the hand-off).

### 5.4 The schedule page
- `loadBook` keeps `bookEntries` (array) and `clubSpellings` alongside `bookByKey`; the combobox's
  `onOpen` calls `loadBook` (a merge made in another tab shows on the next open).
- The `<input id="event-opponent">` is replaced by `<OpponentCombobox …>` with the same id, value and
  setter. Nothing about the payload changes — `opponent` stays the trimmed text.

### 5.5 Help — `lib/help-content/coaches.tsx`
- Add Event article: "the opponent" → "the opponent (start typing and your Scouting Book offers the
  teams you've met, so the spelling stays the same)".
- Scouting Book duplicate FAQ: a closing sentence — the Opponent field now offers the book's names as
  you type, so a split is a thing you can avoid, not only fix.
- Keywords/searchText: `opponent picker`, `type the opponent`, `same spelling`.

### 5.6 Tests
- `tests/unit/coach-opponent-picker.test.ts` — filter (name, alias, casefold, punctuation), ordering,
  resolve (direct, via alias, none), picked line wording, club filter, and a source scan that the
  combobox writes `displayName` (never `key`) and mounts on the schedule form under `event-opponent`.
- `tests/unit/coach-club-book.test.ts` — `clubPickerSpellings`: viewer-owned spellings dropped, only
  content rows, grouped across siblings, and the two-org adversarial reader still leaks nothing through
  `buildClubListExtras`.

## 6. Rollout

- No migration, no schema change, no change to a stored game. Nothing prod-owed beyond the code.
- Demo sandbox: the coach demo's book already holds opponents, so the field shows a real list; no tour
  stop added; no demo sentence quotes a figure from it.
- Dev server restart required before browser testing (new files + a shared module).
- Owner QA walk: appended to the hub as its QA Walk tab; ledger § assigned at walk time.

## 7. Risks, and where they sit

- The row chips key off the game's own spelling — the picker writes `displayName` (source-scan test).
- The club group must never leak across orgs — it rides `buildClubListExtras`, which the adversarial
  two-org test exercises through the same reader seam.
- A coach who deliberately types a different name for the same team is not second-guessed: the list
  shows, the coach types past it, the text saves. The free-text guarantee is kept (D3).
