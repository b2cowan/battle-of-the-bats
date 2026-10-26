# House league — the draft board at scale (plan)

**Status:** drawn and RULED 2026-10-26 (A1–A12 yes, as recommended; the steps drawer requested by the owner in
round 3). Build prompt: `HOUSE_LEAGUE_DRAFT_BOARD_AT_SCALE_BUILD_PROMPT.md`. **Built and committed 2026-10-26:** the board
`4aad77562`, families together in the draft `a12fd32e2`, help and records after them. Owner QA walk §387 owed
(https://claude.ai/artifact/F3P4GoqonbFY9fjh2NPPn3). See §6.
**Drawing (the spec):** https://claude.ai/artifact/D8WBeMERFDdBpVNHcdUQMz — source
`docs/projects/active/HOUSE_LEAGUE_DRAFT_BOARD_AT_SCALE.html` (republish the SAME path).
**PM brief:** `HOUSE_LEAGUE_DRAFT_BOARD_AT_SCALE_PM_BRIEF.md`.
**Follows:** Club Tier Stage 9c (the Teams & draft board, walk §381 closed). 9c was drawn with five players in the pool.

## 1. The finding

Seeded a real-size division (Dev League Org → *Draft Test 2027*, U12, 120 accepted players in 101 households, 10 teams,
nobody placed, 80 paid through the money writer). Measured from the drawing's true-size frames:

- The pool is the first card in the teams' own `repeat(auto-fill, minmax(240px,1fr))` grid
  (`components/admin/kit/club/league/teams/Teams.module.css` `.board`; `TeamsBoard.tsx` `DropCard id="pool"`). Its height
  sets row 1, so 3 teams sit beside a ~12,000 px column and teams 4–10 start ~12,500 px down (page ≈ 13,000 px).
- A pool row is ~96 px (name + a wrapping sentence "Age N · counts as a 3 · owes $X" + a 54 px bordered ⋯).
- No search, filter or sort; households and sign-up notes are not on the board.
- The steps list (4 × 60 px rows inside the division card) costs ~260 px above the board.
- The screen is in `repKit.moneyFrame` (max 1200 px), so width never rescues it.

Side finding fixed the same day: the document scrollbar thumb read `--home-line-strong` on `<html>`, where the Warm
admin/coach/guest pages never define it → white on cream (since the 2026-09-28 admin Warm move). `app/globals.css`
now gives `<html>` the two warm tokens on those pages too.

## 2. Rulings (owner, 2026-10-26)

| Ask | Ruling |
|---|---|
| A1 | Pool leaves the teams' grid: its own 344 px left column, `position: sticky` once scrolled past the steps, its list scrolls inside it; teams in their own `auto-fill minmax(264px,1fr)` grid. Beside the pool that is 2 across at every width (the 1200 cap). |
| A2 | One row everywhere: rating · name · marks · age · ⋯. 40 px desk (house compact), 44 px ≤768 (tap floor), 52 px phone. A state (Locked · Moved by you · Asked to withdraw) drops to a second line spanning the row; a long name wraps (never clipped). Column headings in the table recipe (uppercase, `--type-support`, 700, 0.05em). |
| A3 | Search in the pool (player, or a family by guardian name) — the one rounded search. |
| A4 | Filter menu (ticks + counts at row ends, button marks itself on): Not rated · Has player notes · Owing · Has a sibling here — the same words as the Registrations filter. No chip row. |
| A5 | Sort pick-one (olive pill): Last name · Rating (strongest first) · Age · Family. Not sortable headings. |
| A6 | Family mark (household = same guardian email, never surname) with a count; click opens where each child is and lights them up in olive (`--home-olive-soft` + 3 px inset `--home-olive`), never a new colour. |
| A7 | The draft keeps a household's children in one division together, ON by default, with a switch by Run the draft. **Its own build after the layout** (changes `runDraft` in `lib/house-league-draft.ts`). |
| A8 | Note mark opens the family's sign-up note — shown only to people who can already open that registration. |
| A9 | Owing becomes an amber `$` mark that opens the amount, replacing "owes $X" on the row. **Words via /marketing before the build.** |
| A10 | One home for averages: "12 players · avg 3.1" at the top of each team card (moved from the foot). The balance line keeps only "Moved by hand". |
| A11 | When everyone is placed, the pool folds to one sticky line ("Everyone is on a team · 120 of 120", a drop target); teams take the full width (3 across at 1440, 4 wider). Reopens when anyone is off a team. |
| Drawer (owner request, round 3) | The steps become a drawer: starts open, "Hide steps" folds it into one 48 px line — "Steps · N of 4 done · Next: …" plus the next step's own button (Rate players when ratings are next; Run the draft / Publish already sit in the division head). The step rows themselves are unchanged. Already hidden once published (owner 2026-10-26, uncommitted in the working tree). |
| A12 | Yes (owner 2026-10-26): a closed drawer stays closed for that person on that division until reopened (browser-remembered, per division; reading it fails safe to open). |

Unchanged and drawn as built: the division card and its head, drag (desk) and Move to… (phone), the "Moved by you" tag
and its Put back menu, Locked, Asked to withdraw, pencil/trash (44 px), the dashed "–" for an unrated player, the phone's
list of groups. Anyone without ratings access sees no Rating column, sort or average (as today).

## 3. Build parts

1. **Board layout** (A1–A6, A8–A11, drawer): `TeamsScreen.tsx`, `TeamsBoard.tsx`, `Teams.module.css`, the screen words
   file; the board read gains household id, the note and the paid state per player (the note only for readers allowed
   registrations). Phone: the opened pool gets Search on its own row, Filter + Sort below.
2. **Families together in the draft** (A7): `runDraft` treats a household as one unit (its summed rating, its size
   against the "smaller team first" rule), with the switch; locked players still win.
3. Words for A9 (and any new label) through /marketing; help article for Teams & draft via /docs.

## 4. Before the build

- ⚠ Another session has uncommitted edits in `TeamsScreen.tsx`, `TeamWindow.tsx`, `Teams.module.css` (steps hidden once
  published; TeamWindow only for `run`). Build on top of them; do not revert.
- /marketing words for A9 (and the drawer's "Hide steps / Show steps / Next: …" lines).

## 5. Verification

- Dev fixture: Dev League Org → Draft Test 2027 (U12, 120 players, 10 teams). Small case: any 9c walk season.
- `check:layout --changed` on the Teams screen; the type-ladder and list-ground gates.
- A QA walk (checkable Artifact) after the build: 120-player pool scroll/stick, filter + sort + search, family popover,
  drag from the stuck pool to a low team, fold-when-empty, drawer open/close, phone group view, the 6-player case.
  → §387, https://claude.ai/artifact/F3P4GoqonbFY9fjh2NPPn3.
- ⚠ `check:layout --only=admin-hl-teams` could not run on 2026-10-26: the UAT fixture's house-league season is gone, so
  every house-league screen (Registrations too) lands on "Page not found". Re-seeding the UAT fixture signs every
  session out — run it on the owner's word, then the check.

## 6. Status log

**2026-10-26 — built (one session, from the build prompt).**
- UX summary approved by the owner ("yes go ahead") with the five arguments answered:
  1. **Who sees a note.** The registrations read and the board open on the same gate (`read`), so every board reader can
     already open the registration (the registrar too); a house-league coach never reaches the board. The note travels in
     its own read (`readBoardNotes`), never in `readDivisionBoard` (which the draft and Publish share), behind the
     registrations read's own action; `tests/unit/house-league-board-notes-guard.test.ts` holds the two together.
  2. **The household unit.** A household = one guardian email (blank stands alone). Families are dealt before single
     players, biggest first, on the same snake and size rule; a household locked to one team pulls its unlocked
     children there; locks on two teams win and the unlocked ones stay together; switch off = today's deal byte for
     byte. Added while building: an **evening-out** step (single players swap teams while that narrows the gap between
     averages) — without it the averages came out 0.6 apart on every seed of the 120/10 fixture; with it 0–0.1.
  3. "Has a sibling here" → **"Has a sibling in this division"** (/marketing).
  4. Filter, sort and search per visit, as Registrations; cleared when the pool empties and when "go to" needs a hidden
     child.
  5. One read; marks computed from it; guardian first name added for search.
- Words via /marketing: Search is Registrations' own "Search players or parents"; the owing line "$165 owing. Record a
  payment on Registrations."; the family and note windows; the drawer; the folded line; "Keep families together".
- Filled from house parts where the drawing was silent: the owing window (one line), the 44 px tablet rows, the phone's
  Filter and Sort sheets (FilterMenu and SingleSelectDropdown's own sheets), the drawer's "of 3" for a reader without
  ratings, Create teams as the closed line's button when teams are next.
- Drag at real size: dnd-kit shifts every drop target by the page's scroll, wrong for a sticky pool — the pool is
  measured live in collision detection; auto-scroll band 10%; mouse 5 px, touch hold 250 ms (a tablet can scroll the
  pool).
- Commits: `4aad77562` (Parts 1–4, carrying the owner's "steps hidden once published" line from the drawing session,
  which the drawer sits inside), `a12fd32e2` (Part 5, its own commit), then help (`recipe-build-teams`: new
  `build-teams-board`, families switch, two FAQs) and these records. The drawing session's TeamWindow change and
  `.preview` margin stay with that session.
- /review: board — three lenses (notes gate clean; 13 findings fixed); dealing — fuzz of 6,000 divisions, no family split,
  off path byte-identical, two Low findings fixed.
