# Club Website Enhancements — Stage 2 · closed places, summarized (build prompt, two sessions)

> Written 2026-11-26, after the owner ruled the drawing's six asks (owner: "I agree with your recommendations, get me
> the build prompt"). **Two sessions**, each pasted into a fresh chat (`/clear` first), on Opus, A before B:
> *"Read and follow docs/projects/active/CLUB_WEBSITE_STAGE2_SUMMARY_BUILD_PROMPT.md, Session A"*
>
> **The drawing is the spec:** [CLUB_WEBSITE_STAGE2_SUMMARY_DRAWINGS.html](CLUB_WEBSITE_STAGE2_SUMMARY_DRAWINGS.html),
> published https://claude.ai/artifact/WAAu5RtuYUsZw95GGjBXoh (tabs 1–6 what people see, tab 7 the asks; the Case
> switch holds five situations; the blue numbers hold behaviour notes). Names, counts and games are made up. The
> drawing's script is a sketch of the rules, not code to copy.
> Plan: `CLUB_WEBSITE_ENHANCEMENTS_PLAN.md` (§7 Stage 2). Where this prompt and the plan differ, the plan wins; where
> either differs from the CODE, the code wins — say so out loud before building on it.

## Why

The owner closed two diamonds, then all fields. The club site printed three bold lines saying one thing, and the Venue
library stacked three cards. Ten diamonds: the site names three, then "And 7 more places are closed." with no way to
learn which, and the library stacks ten cards. And Reopen can say something false (see B).

## What the owner ruled (all A, 2026-11-26; build exactly this)

- **S1** On the site, a wider closure speaks for a narrower one, for as long as it covers the same days.
- **S2** Several closed places: one heading for the day and one row per park. A single park stays one sentence.
- **S3** Up to five rows all show; past five, four show and "Show N more places" opens the rest where it is.
- **S4** The Venue library: one box, one row per park and dates.
- **S5** Reopening a park with several diamonds: one window, diamonds ticked, one press, each coach gets one email.
- **S6** Reopening all fields names what is closed on its own and offers one tick to reopen it too, unticked.

Fixed whatever else: Reopen never says the site has stopped saying a place is closed while it is still saying it; a
park with only some diamonds closed is not tagged "Closed today".

**Also in this build: two Close a place changes ruled earlier on 2026-11-26** (plan §7, under "Closed places,
summarized"; owner, to putting them here: "yes go for it"):

- **T1** (Session A) The no-places window offers **"All our fields"** to owners and admins, and to the house league
  admin from the schedule's button, and at a desk opens without shrinking from the form's height.
- **T2** (Session B) Two separate presses on two diamonds of one park behave as one press: a game with no diamond
  recorded stays marked until both reopen, with no second email to its coach.

**S1 and S2 replace K4's "a line per closed place, in the order closed". S4 replaces Session 2D's row per diamond.**
Still holding: K12 (never on a tournament's pages), K16 (fixed words, place words and days only), K4's separate box
above the club's own notice.

## ⛔ Start conditions (both sessions)

1. `git status`. Other sessions share this working copy. At writing the closure code was clean; the drawing and this
   prompt were untracked, and the plan, PM brief and board file held uncommitted edits from two sessions. Commit by
   path or private index (`reference_partial_commit_shared_tree.md`), never `git add -A`; if a file in your list holds
   someone else's uncommitted change, ask the owner first. The Close a place window, the shared form table and the
   shared window changed on 2026-11-26 (`565d44d02`, `6447157a5`): read them as they are now.
2. Walk §577 (several places in one press) passed 45 of 45. Walk seeds delete the Kestrel club's closures: don't seed
   while the owner is walking.
3. Session B starts only when A is committed.

## ⛔ Blocking gate, before any code (both sessions)

Present the plain-language UX summary (AGENCY_RULES) and a task list. The mockups are approved; build to them. Under
the same summary, say what you propose for **each item in that session's "Not drawn" list**, with a recommendation.
Show it on a small drawing if words cannot settle it. Add nothing the rulings did not rule.

---

## Session A — what families see, and the Close window (S1–S3, T1)

**Design log:** record S1–S6 in `memory/design_decisions.md` (and the in-repo `memory/MEMORY.md` index rule).

### The cover rule (one pure home; B reuses it)
Closure W **covers** closure N when all of these hold: W is wider (all fields over any park or diamond; a whole park
over a diamond **of the same venue id**, never matched by name); W's days include all of N's remaining days (first day
no later than N's, counting a past first day as today; last day no earlier); W is showing. A covered closure is left
off the site only — its record, marks and Reopen are untouched, and it returns by itself if W is reopened. A closure
that runs longer or starts a day the wider one misses keeps its own words.

### The strip (drawing tabs 1–2; words)
- Group what is left by the **when** phrase `stripSentence` produces ("closed today", "closed tomorrow (Fri, Nov 27)",
  "closed through Sun, Nov 29", …). Order: by first day, then last day; all fields first, then park name.
- A group of **one place**: today's sentence. One park with several diamonds: "Diamond 1 and Diamond 2 at Lions Park
  are closed today."
- A group of **two or more places**: a bold heading (the phrase, capitalised: "Closed today"), then a row per park:
  "**Lions Park**: Diamond 1 and Diamond 2" · "**Alder Fields**: all diamonds" · a place with no diamonds is its name
  alone. Only the heading and park names are bold.
- **Fold (S3):** count place rows across all groups (a single-sentence group is one). More than five: four show, then
  "Show N more places"; open, the button reads "Show fewer". 44 px tall on a phone. The older "And N more places are
  closed." goes (`CLOSURE_STRIP_MAX_LINES`, `closureMoreSentence`, `stripLinesShown`).
- **Small line:** today's words, computed from the **visible** closures; "ends tonight" / "both end tonight" / "all end
  tonight" by the number of rows.
- A page left open past an end still takes that line down by itself.

### The Close a place window (drawing tab 6)
- Preview: "Your site shows this at once, until the end of {day}:" over the strip in its public shape (no second rail
  around it).
- When the choice is already covered: "**Your site won’t change.** It already says all our fields are closed today."
  The press stays available. `W.empty`'s "Closing it still tells families on your site." is also false then.
- The result screen's "Your site says …" (`doneSite`) follows the same rule.

### T1 · the no-places window (not on the drawing)
- Today it offers only "Open the Venue library" (`ClosePlaceWindow.tsx`, `noPlaces`; words `W.noPlaces*`). It also
  offers "All our fields", and holds the form's height at a desk.
- **Who:** owner and admin; and the house league admin **only from the schedule's button**. The owner took this with
  its cost put to them: in a club with no places that admin can then close fields for every program, which they cannot
  where places are listed. K1's refusal stays everywhere else, enforced **on the server**
  (`app/api/admin/org/place-closures/route.ts` refuses all-places to a house league admin today): allow it only when
  the club has no places and the request comes from a season. Reopen's roles are unchanged.
- A house league admin still reads other programs as counts only.

### Not drawn — propose at the gate
1. Preview when some of the choice is covered, or closures already show: recommend the strip **exactly as it will read
   after the press** (existing plus chosen), and say what the "until the end of" sentence becomes with mixed days. The
   window's own reads return no closures today.
2. Covered by a **whole park** (not all fields): the "won't change" words.
3. "all diamonds" needs to know the park has diamonds; the strip read doesn't. Say how you get it, and what a venue
   whose facilities aren't diamonds reads.
4. The no-places window with "All our fields": its layout, button words and what it lists that day (games there carry
   only typed places), and whether `/legal` or the help needs a word for it.

### Census (traced 2026-11-26; re-check each line)
- `lib/club-notice.ts` (`closureStrip`), `lib/place-closures.ts` (`stripSentence`, `StripClosure`, `stripClosureOf`,
  `STRIP_CLOSURE_COLUMNS` — no venue id today), `lib/place-closures-server.ts` (`closuresShowing`),
  `lib/club-frame-data.ts`, `components/public/ClubFrame.tsx` → `ClubClosureStrip.tsx` (keys lines by sentence;
  `components/public/ClubMoreRow.tsx` is the existing in-place expander).
- `lib/place-closure-window.ts` (`previewSentences`, `doneSite`, `empty`, `site`), `ClosePlaceWindow.tsx`.
- **Tests that pin today's behaviour:** `place-closures-2c.test.ts` (shapes, order, four-line cap, and **192–197
  forbids any button in the strip component** — allow the one fold button; links and motion stay forbidden);
  `place-closure-several.test.ts` (preview "And 7 more", `doneSite`); `place-closure-window.test.ts`;
  `place-closures.test.ts` (exact strip keys and column list); `place-closure-window-route.test.ts` 207–209 (**the
  body of `previewSentences` may not contain the substring `line`**; keep that K16 guard true under any new name).
- **Help:** `lib/help-content/org.tsx`, the `close-a-place` section ("Your site": a line per place, past four…), its
  `searchText`; `coaches.tsx` `event-details-club-closed` ("strip says the place is closed").

---

## Session B — the Venue library and Reopen (S4–S6, T2)

### The Venue library (drawing tabs 3–4)
- One box headed "Closed places". A row per **park and dates**: "Lions Park · Diamond 1 and Diamond 2" ·
  "Lions Park · all diamonds" · "All our fields". The line under it keeps today's facts (days, closed at and by,
  postponed, rep games marked), totalled for the row **with each game counted once**; two press times read
  "3:25 p.m. and 3:40 p.m.". One Reopen per row.
- With "All our fields" showing, it is first, then the band "Also closed on their own. These stay closed if you reopen
  all our fields." and the others indented under it, each with its own Reopen.
- Phone: name and Reopen share the top line (44 px), the facts run full width under them.
- Venue table tag: "Closed today" for a whole park or all fields; otherwise "1 diamond closed today" / "N diamonds
  closed today". (Today any diamond closure tags the whole park.)

### Reopen (drawing tab 5; words)
- **A park row with several diamonds:** "Reopen diamonds at Lions Park?" · a tick per diamond, all ticked, each with
  "Thu, Nov 26 · closed 3:25 p.m. · 1 postponed, 1 rep game marked" · none ticked: "Tick a diamond to reopen it.",
  button off · "Your site stops saying they’re closed, at once." (+ "It still says **Diamond 2 at Lions Park is closed
  today.**" when one stays) · "2 rep games lose their marks. Each coach gets one email: the diamond reopened, the game
  wasn’t moved, keep it or move it." · the existing postponed sentence · "Reopen 2 diamonds and email 2 coaches".
  One diamond alone keeps today's window.
- **A closure covered by a wider one:** "Remove Diamond 1’s own closure?" · warning notice "**It stays closed.** All
  our fields are closed today, so your site doesn’t change." · "Diamond 1 will then open when you reopen all our
  fields." · the existing still-marked sentence · **Not now** / **Remove its closure**. Its result says the same.
- **All fields, with others closed on their own:** warning "Diamond 1 and Diamond 2 at Lions Park are also closed on
  their own." · unticked "Reopen those two diamonds as well" · "Your site will then say **…**" (ticked: "Your site
  will stop saying anything is closed, at once.") · marks and postponed counts follow the tick · "Reopen all our
  fields" / "Reopen everything and email 2 coaches".

### One press, one email (S5, S6)
- Never call today's one-closure route N times: a coach with games on two diamonds would get two emails. Stamp the
  chosen closures, then **one** read of whom to tell over all of them, then **one** coach send.
- The counts and coaches shown for a set come **from the server**. Adding rows up in the browser is wrong: a game
  marked twice counts twice, a mark held by a sibling being reopened reads as kept, and a house league admin's team
  list is anonymised per closure.
- If one stamp fails, still tell the coaches of those that did reopen (they leave the list and would never be told),
  and say what didn't reopen. A retry after a stamp must still return the waiting games and seasons.
- Today's guards must survive: tell **after** the stamps; claim a game's marks whole; a failed send gives the claim
  back (`lib/place-closure-window-server.ts`, `reopenTold` / `reopenCoachEmails`; the claim is chunked, mind a large
  set).
- No migration looks necessary (`org_place_closure_reopen` stamps one closure and touches nothing else). It is then
  not all-or-nothing. If you want it atomic, say why before writing one (`/db`, dictionary, both snapshots, prod step
  after 549, apply to dev on the owner's word).
- **Coach words:** `reopenedPlace` (`lib/place-closure-mail-words.ts`) reads only the first game's place, so a coach
  with games on different diamonds would be told one. The combined wording is new and goes through **`/legal` (K10)
  before code settles it**. Keep the fixed skeleton: no link, no free text.

### Not drawn — propose at the gate
1. The result screen for each of the three windows.
2. **"One email per coach":** today it is per team per recipient (someone coaching two teams gets two, each with its
   own reason line). Recommend keeping that; say so to the owner.
3. A closure only **partly** covered (all fields today, a diamond through Sunday): what its Reopen says.
4. A park row that sits under all fields (your S5 window and the covered window together).
5. A whole park and one of its diamonds both closed (library nesting and Reopen), with no all-fields closure.
6. S6 when the others are many, or on other days: how they are named in the warning and on the tick.
7. All fields unticked but with coaches of its own to tell (button words).
8. Different closers on one grouped row.
9. The windows on a phone.
10. T2: how the second press's window and result show the already-marked game (today it is listed again, unticked).

### T2 · two separate presses behave as one (not on the drawing)
Today the second press lists the no-diamond game again, unticked, and covers it only if ticked (its coach then gets a
second email); left unticked, reopening the first diamond clears the mark and tells the coach while the other is still
closed. Ruled: it behaves as one press — **marked until both diamonds reopen, no second email**. Only the press
function writes marks (mig 549), so this needs a migration (next free number; `/db`, dictionary, both snapshots, prod
step after 549, apply to dev on the owner's word). The send emails any mark with no `coach_emailed_at`, so an added
mark must arrive stamped. The unticked-game result words need a look. `place-closures-guard.test.ts` reads function
bodies from migration files: keep its guards true of the newest definition; extend the rolled-back check. The
"no migration" note above is about S5 only.

### Census
- `app/[orgSlug]/admin/org/venues/page.tsx` (closure rows, the tag), `components/admin/kit/club/VenueLibrary.module.css`,
  `components/admin/kit/club/places/ReopenPlaceWindow.tsx`,
  `app/api/admin/org/place-closures/[closureId]/route.ts`, `…/place-closures/route.ts` (the K1 anonymising),
  `lib/place-closure-window.ts` (`StaffClosure` — no facility id; `rowName`, `rowLine`, `reopen*`, `closedParks`),
  `lib/place-closure-window-server.ts`.
- The Overview's "Places closed" counts parks already; confirm it still reads right, change nothing unasked.
- **Tests:** `place-closure-window-route.test.ts` (one-id route harness), `place-closure-reopen-told.test.ts` (its fake
  database supports few verbs), `place-closure-several.test.ts` (reopen words), `place-closure-window.test.ts`,
  `place-closures-guard.test.ts` (reopen stamps one closure, touches no game),
  `scripts/club-website-stage2-closure-check.sql`. Add: one email for a coach across two diamonds; a repeat or
  simultaneous press emails nobody twice; part failure; covered Reopen says nothing false.
- **Help:** `org.tsx` (`venue-library-t-closed`, `close-a-place-t-reopen`, the FAQ "your site already says…", the
  section `searchText` "your site stops saying it's closed"), `house-league.tsx` (the Rainout article's mistake FAQ),
  `coaches.tsx` (the reopen line).

---

## Close each session

1. Focused tests; `npm run verify:changed`; `npm run typecheck`; `npm run check:layout -- --changed` for the screens
   touched.
2. `/simplify`, then `/review`, `/docs`, `/design` against the drawing, `/legal` for any public or email word.
3. Restart the dev server (shared modules).
4. A walk Artifact for the owner: 20–50 boxes, one action per step, exact logins (password `UATPassword2026!`),
   computer and phone, on the `--places-walk` seed (`scripts/seed-on-sale-pictures-extras.mjs`; run
   `seed-prospect-demo.mjs --club=kestrel` first). A covers: two diamonds then all fields; many diamonds and the fold;
   mixed days; reopening the wider one brings the narrower back; the preview; a club with no places, as owner and as
   house league admin. B covers: the grouped box and tags; the three Reopen windows; one email per coach; two separate
   presses, then each reopened. Say how the walk gets a no-places club if the seed has none. Next free section in
   `OWNER_QA_LEDGER.md`; grep older walks for the words you changed.
5. Plan progress entry and the board line (project `club-website`) in the same commit as the work. Commit only on the
   owner's word.

## Not in scope

Any change to who may close or reopen beyond T1; the plan gate; the postpone/cancel step; the press's limit of 10; the
tournament Rain delay.
