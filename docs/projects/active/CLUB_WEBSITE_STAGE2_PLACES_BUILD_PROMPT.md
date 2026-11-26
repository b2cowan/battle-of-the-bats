# Club Website Enhancements — Stage 2 · Session 2D build prompt (close several places in one press)

> Written 2026-11-26, after the owner ruled the drawing's eight asks (owner: "all A, go ahead and get the build
> prompt"). **One session**, pasted into a fresh chat (`/clear` first), on Opus:
> *"Read and follow docs/projects/active/CLUB_WEBSITE_STAGE2_PLACES_BUILD_PROMPT.md"*
>
> **The drawing is the spec:** [CLUB_WEBSITE_STAGE2_PLACES_DRAWINGS.html](CLUB_WEBSITE_STAGE2_PLACES_DRAWINGS.html),
> published https://claude.ai/artifact/6DBZd4dZaLwLMBnJA4TYps (tabs 1–6 what people see, tab 7 the asks; the blue
> numbers hold behaviour notes). Its names, counts and games are made up. It supersedes tab 2 of the Stage 2 drawing for
> the Place and diamond controls only; everything else in that window is unchanged.
> Plan: `CLUB_WEBSITE_ENHANCEMENTS_PLAN.md` (§7 Stage 2: K1–K17 and M1–M8). Where this prompt and the plan differ, the
> plan wins; where either differs from the CODE, the code wins — say so out loud before building on it.

## Why

Two of three parks closed, one open: the window could only close one park or all of the season's, so it took two runs
(families with games at both got two emails). Two of three diamonds at one park: the same problem one level down.

## ⛔ Start conditions

1. **Uncommitted work sits in your files.** At writing, the 2026-11-26 rename of the schedule's "Rainout" button to
   "Close a place" (and the Overview button) was uncommitted in `ClosePlaceWindow.tsx`, the venues page, the house
   league schedule page, `ClubHubKit.tsx`, `lib/league-rainout.ts`, `lib/help-content/{org,house-league}.tsx` and two
   tests; the plan and the board file were modified too. Run `git status`. If it is still uncommitted, ask the owner to
   commit it first. Never fold it into your commit.
2. Other sessions share this working copy. Commit by path or private index (`reference_partial_commit_shared_tree.md`),
   never `git add -A`.
3. Walk §573 (Close a place) was owed at writing. If it has since passed or reported defects, read its record first.

## ⛔ Blocking gate, before any code

1. Present the plain-language UX summary (AGENCY_RULES) and a task list. The mockups are approved; build to them.
2. Under the same summary, say what you propose for the surfaces the drawing did **not** show with two diamonds at one
   park: the result screen, the Reopen window (including D1's still-marked games), the Venue library rows, the
   Overview's "Places closed" count (it counts closure rows, so two diamonds read "2"), the same-day waiting banners in
   Changes to send (one per diamond), the tournament Rain delay sentence and the rep coach email.

## What the owner ruled (plan §7, M1–M8 and D1, all A, 2026-11-26; build exactly this)

- **M1** A "Places" dropdown with a tick per place, and a row under it for each chosen place, with ✕ to remove it.
- **M2** From the house league schedule's button, the season's places on the window's days are already chosen and listed
  first in the dropdown. (K15 holds.)
- **M3** From the Venue library or the Overview, nothing is chosen; the button is off until something is.
- **M4** Day and Until sit above Places.
- **M5** "All our fields" is the last choice; choosing it shows one line and locks the other ticks; removing it brings
  the earlier choice back. Owner and admin only (K1).
- **M6** The limit stays 10 per press and the dropdown says so.
- **M7** On a phone, places and diamonds each open a bottom drawer with large rows and Done.
- **M8** Several diamonds at one park are ticked in the row's diamond dropdown and closed in one press. **This replaces
  K2's "two diamonds = two closures".** A whole place or any set of its diamonds.
- **D1** (owner: "D1 A, add it to the prompt"; raised by this prompt's census, not on the drawing) A ticked game at the
  park with **no diamond recorded**, when **two or more** of that park's diamonds close, **keeps its mark until every
  one of those diamonds is reopened, and the words name the park, not a single diamond.**
  - Today (to change): it is attributed to the first closed diamond in the window's order (mig 539, the assignment
    step), its mark names that one, and reopening that one drops the mark and tells the coach the place reopened.
  - So while any of those diamonds stays closed, its coach gets no "reopened" line for that game. Either mark every
    matching closure (the table allows one row per closure and game; then count and list the game once everywhere), or
    hand the mark to a still-closed sibling at Reopen. Your choice; say which, and why.
  - The question was put about one press. If two separate presses on two diamonds of a park would behave differently,
    say so to the owner rather than deciding it.
  - A change to the coach's words goes through `/legal` (K10).

## Behaviour the drawing fixes

- The row's diamond control reads "All diamonds", one diamond's name, or "N of M diamonds". Ticking every diamond
  collapses to "All diamonds" **and is sent as one whole-park entry** (otherwise a game with no diamond reads as typed).
  One tick always stays; unticking the last does nothing. ✕ removes the park. Two or more diamonds only.
- The limit counts closure entries: a whole park is one, each chosen diamond is one. Message: "Up to 10 parks or
  diamonds in one press. To close every one, tick “All our fields”." A house league admin has no All our fields, so no
  second sentence. At 10, further ticks dim.
- Search box in the places dropdown above eight places; it only narrows, and ticked places stay listed. "All our fields"
  and the limit line sit **below** the scrolling list.
- With the season: bands "This season’s places today" / "that day", then "Other places".
- The collapsed field reads "Choose places", "1 place chosen", "N places chosen" or "All our fields" (it counts parks).
- Nothing chosen: no radios or games; "Choose a place to see what’s on it."; the footer sentence is absent; the button
  reads "Close a place", disabled.
- **Game ticks survive a change of places or diamonds** (today every change resets them and Link). A newly added place's
  games arrive with the default ticks; a started game is never auto-ticked (K6).
- Game rows name the park when two or more places are chosen, or All.
- Words group by park: "2 diamonds at Lions Park" in the games heading. The button counts parks: one park with several
  diamonds "Close 2 diamonds"; two parks "Close both"; three or more "Close N places".
- The public strip keeps **one line per closure** (a line per diamond), unchanged. The window's preview adopts the
  strip's own rule past four lines (three, then "And N more places are closed.") — reuse `CLOSURE_STRIP_MAX_LINES` and
  its logic in `lib/club-notice.ts`, do not re-write it.
- Reopen stays per closure row.

**The shipped `MultiSelectDropdown` is a report filter where nothing chosen means everything. That meaning here would
close every park.** Build a form field where empty means none; reuse its look and the kit's tick rows (name what you
reuse in the diff). A phone drawer for a multi-pick field is new (the design log's 2026-10-18 entry left it open; M7
answers it for this window — log it).

## Census (2026-11-26, traced from code; re-check each line, other sessions commit daily)

**Hard blockers for two diamonds of one park**
- `supabase/migrations/539_…sql:361` refuses a press whose distinct venue ids differ from its entry count. A **new
  migration** (next free number at build; 549 at writing) replaces `org_place_closure_press`: distinct
  (venue, facility) pairs; still refuse a repeated pair and a whole-park entry beside a diamond of that park. 539 is
  applied to dev and **pending on prod** (`MANUAL_PROD_STEPS.json`); the new one follows it, before the promote.
  `/db` review; `DATA_DICTIONARY.md` (`org_place_closures`, the `press_seq` note) and both snapshots in the same unit.
- `lib/place-closures-server.ts:258` mirrors the same rule (the window's read answers 404, and a house league admin's
  press with rep games answers 403).
- `tests/unit/place-closures-guard.test.ts` reads function bodies from the 539 file only (lines 12–19) and asserts no
  other migration contains `'league.quiet_link'` (lines 94–96). Point the press's body at the newest definition and
  keep both guards true of it. The `concat_ws` count (line 117) is also per file.
- `scripts/club-website-stage2-closure-check.sql` (rolled back, dev): keep T1e (whole park + its diamond is invalid);
  add "two diamonds of one park pass" and "the same diamond twice is refused".

**Window (`components/admin/kit/club/places/ClosePlaceWindow.tsx`)**
- One `Pick` plus one `diamond` string become a selection; emit entries in the displayed order (that order decides which
  closure claims a game).
- **Two existing defects to fix with it** (read in code, not reproduced): an empty `placesParam` returns early and
  leaves the previous games and an enabled button (about lines 161–175); with the season choice, moving to a day where
  the season uses no place leaves the old list under the new day (about lines 129–152).
- The server accepts 1–10 entries already (`route.ts`); the season's places are already capped at 10.

**Words (`lib/place-closure-window.ts`)** — each assumes one entry per place: `placesWord`, the link words (say the
park, never the diamond: a link sets only the park), `tournamentAt` ("those places’" for one park), `go`, `empty`,
`doneTitle`, `doneTournament`, `rainDelayLine` and the `closed` URL value, `doneSite` ("Reopen it" with two rows),
`typedCount` / `doneTyped` (a game with no diamond is not "typed").

**Mail** — `lib/place-closure-mail-words.ts`: with two diamonds a rep coach reads "… at Diamond 1 at Lions Park and …
at Diamond 3 at Lions Park", subject "Fields are closed". These are `/legal`'s fixed words (K10): any change goes
through `/legal` before hand-off. Family and team-coach sends are merged per season and need no change.

**Reading surfaces** — mark attribution and Reopen (D1): `lib/place-closures-server.ts`,
`app/api/admin/org/place-closures/[closureId]/route.ts`, `lib/place-closure-window-server.ts` (counts and Reopen).
Overview count: `ClubHubKit.tsx`. The venue library's "Closed today" chip is already per park.

**Help** — `lib/help-content/org.tsx` (the Close a place topic, incl. `searchText`: "one diamond"),
`house-league.tsx` ("check the Place"), `coaches.tsx` ("or one diamond there").

## Close the session

1. Focused tests for the selection rules, the words with two diamonds, tick survival, the empty state and D1 (reopen
   one of two: the mark stays, no "reopened" line; reopen the last: it clears); the rolled-back check on dev; `npm run verify:changed`; `npm run typecheck`. Apply the migration to dev on the owner's word.
2. `/simplify`, then `/review` (migration and API), `/docs`, `/design` against the drawing, `/legal` if any email or
   public word changed. `/demos` nothing (no demo presses a closure; confirm).
3. Restart the dev server (shared modules and a migration).
4. A walk Artifact for the owner: 20–50 boxes, one action per step, exact logins (password `UATPassword2026!`), computer
   and phone, covering: two of three parks; two of three diamonds with a game left on; a game with no diamond (D1);
   nothing chosen; All our fields; one email per family; Reopen of one diamond, then the other. Next free section in
   `OWNER_QA_LEDGER.md`.
5. Plan Progress entry and the board line (project `club-website`) in the same commit as the work.
   Commit only on the owner's word.

## Not in scope

Combining the public strip's lines per park; raising the limit of 10; reopening several closures at once; any change to
who may close a place, the plan gate, or the postpone/cancel step.
