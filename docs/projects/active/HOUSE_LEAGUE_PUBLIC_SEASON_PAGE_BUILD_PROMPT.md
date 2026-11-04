# House league public season page: the season shape (build prompt)

> **Written 2026-11-04**, after the owner ruled asks **P1–P5** as recommended (plan `HOUSE_LEAGUE_STAGE9_PLAN.md` **§0k**).
> **Paste this into a new chat on `dev`.** Size **S**. **No migration** (the highest on 2026-11-04 is **431**; nothing here stores
> anything).
>
> ⛔ **GATE: the words.** The copy doc `HOUSE_LEAGUE_PUBLIC_SEASON_PAGE_COPY.md` is **proposed** (2026-11-04, open questions W1–W7
> each with a recommendation). **Before any code, check the doc's header and plan §0k for the owner's acceptance.** If neither
> records it, stop and ask the owner to accept the words (or answer W1–W7). Build with the accepted words only.
>
> **Binding, do not reopen:** P1 (the season shape from the day registration closes), P2 (the top three of each age group, first
> place highlighted, Full table →), P3 (the next-season line at the top, above the title), P4 ("Already signed up? Email me my link"
> kept, unchanged, in every state), P5 (the same table, titled Standings, while the season is played). Also 9f·3 ("Final standings"
> only once the club completes the season; "Ended {date}" before), 9f·4 (no chip on a finished season; "This season has
> concluded."), Q16 (house-league seasons read in place). House league records **no champion**: never write "Champion" or "winner".
>
> **Not this build:** the standings page and the schedule page (unchanged), the club's House league index and the site home (their
> Running now / Past seasons rows are unchanged), the sign-up shape (opens soon / registration open: today's page exactly), 9f-2
> (Start next season), any link between seasons (none exists; do not add a column).
>
> **Read first, in this order:** (1) plan §0k; (2) the copy doc, whole (≈140 lines); (3) the drawings
> https://claude.ai/artifact/VpHxm3YFtkfjPeYrT3bPJK (source `HOUSE_LEAGUE_PUBLIC_SEASON_PAGE_DRAWINGS.html`): **tab 1** (the
> state table), **tab 2** (finished, desktop and phone, after), **tab 3** (registration closed, playing, ended), **tab 4** (the
> next-season card: one, two or more, none); (4) the page itself, `app/[orgSlug]/league/[seasonSlug]/page.tsx` (286 lines);
> (5) the standings page `app/[orgSlug]/league/[seasonSlug]/standings/page.tsx` and its table classes in
> `app/[orgSlug]/league/league-column.module.css` (`.standTable` … `.standLink`, ~170–229), which the cards reuse.
>
> Supporting evidence the owner has not seen in this form: the UAT journey J7 parent-lens notes flagged both problems
> independently (`tests/uat/results/journeys/J7/walk-findings.json`: "0 / 12 spots filled" and "no path forward" from last
> season's bookmark to the open season).
>
> Re-verify every lead below before building on it: other sessions share this working copy. Stage **explicit paths only**, commit only
> your own hunks, check `git diff --cached --name-only` before every commit, **commit only when the owner says**, on `dev`.
>
> **Recommended model: Opus 5.5, one session.** Before any code, present the Product-Manager UX summary below (the repo's rules make it
> a blocking step) and a task list. Update the Progress block after each Part. Reading and searching go to helpers (Sonnet); a
> helper's summary is a lead, not evidence.

## ▶ Progress (read first when resuming)

- **Gate passed 2026-11-04:** owner accepted the words, W1–W7 all as recommended (copy doc header + plan §0k record it).
- **Parts 1–5 BUILT 2026-11-04** (one session). `seasonPageShape` in `lib/league-registration-state.ts`; `seasonDatesLine`,
  `nextSeasonDoor`, `NEXT_SEASON_WORDS`, `SEASON_CONCLUDED` in `lib/house-league-season.ts`; `STANDINGS_WORDS.card` in
  `lib/league-standings.ts`; the page split into its two shapes (sign-up shape renders today's output; its dead
  `active`/`finished` branches dropped); `.topGrid`/`.topCard`/`.topHead`/`.topName`/`.topMore`/`.nextDoor` in
  `league-column.module.css`. Tests: new `tests/unit/house-league-public-season-page.test.ts`; the pinning test in
  `house-league-public-seasons.test.ts` rewritten. Focused tests 103/103, lint clean, spelling/dates/tokens/contrast/purity
  clean; typecheck's one error and the 17 failing suite tests are other sessions' files (9f-2 `startFromId`, team-move,
  public tournament guards…), none in this build. Rendered on dev `dev-league-org`: finished 2025 (card + concluded line,
  no band), ended 2026 (card, chip, "Ran …", Standings band with T-1 and dashes), closed-by-date, sign-up unchanged.
- **Build calls beyond the copy doc (owner may overrule):** a finished season with only a start day reads "This season has
  concluded. It started May 2, 2026." (copy §1 names the end-only case, not this one); the dates line sits directly under
  the title, above the club's description (the drawing's order).
- ⚠ `lib/house-league-season.ts` is SHARED with the 9f-2 session (its `newestFirstSeasons` hunk): commit only this build's hunks.
- **`/review` DONE 2026-11-04** (high-risk tier, 3 lenses: correctness, security/tenant, regression+a11y). Fixed: the
  next-season card now shows on any season past its last day whatever its status (`isOldSeason`; a season stuck on
  "Registration closed" had "Ran …" and no card), and the club's seasons are read only when the card can show; the card
  grid no longer overflows a 320 px phone (`minmax(min(280px, 100%), 1fr)`); `.topName` resets the global h2 letter-spacing;
  tests added for a stored timestamp, closed-by-date, the stuck season, and the sign-up shape keeping Register now / price.
  Security lens: no findings. Kept as spec (not changed): "newer" is the switcher's start-date order; the top three cut
  through a tie (copy `card.tie`); each table is named by its age group (copy `a11y.table`). check:layout SKIPPED (its
  `--changed` widened to 344 screens on other sessions' shared files, and the free-coach UAT fixture is broken).
- **`/docs` DONE 2026-11-04:** help `house-league.tsx` "Sharing the public season page" (`id: 'public-page'`, unchanged)
  converted to an overview + three sub-topics (`public-page-listed`, `public-page-signup`, `public-page-season`); the
  season-shape answer covers the dates line, the top three, Final standings, the concluded line, the newer-season card and
  "Email me my link"; keywords/searchText extended. Lint clean (one pre-existing unused-directive warning), spelling clean,
  `measure:help` 0 unconverted. No other help text described the closed page (the early-bird lines describe the sign-up shape).
- **Walk §451 WRITTEN 2026-11-04** (§450 is reserved for the 9f-2 walk): https://claude.ai/artifact/XBVRrJDBkK7uksrfX6CyS1
  (source `HOUSE_LEAGUE_PUBLIC_SEASON_PAGE_WALK.html`), 20 steps in six parts (A sign-up unchanged · B closed · C playing
  top three · D ended and finished · E the card · F phone). Fixture `.probe/season-page-walk/fixture.mjs` (dev only; three
  throwaway clubs `walk-spp-club` / `walk-spp-one` / `walk-spp-none`, `--reset` removes them); every walk step's expected
  text was read from the rendered dev pages on 2026-11-04. Dates fixed for a walk before Dec 12, 2026.
- **Walk §451 PASSED 20/20 2026-11-04** (A 2/2 · B 3/3 · C 5/5 · D 3/3 · E 4/4 · F 3/3), recorded here, plan §0k, ledger §451, TODO. After the walk: the card's "Full table →" link set to 14px 600 in the club face (`.topHead .standLink`, league-column.module.css) — a type-scale fix, not a behaviour change.
- **Owner calls CLOSED 2026-11-04, all three left as built** (dates line above the description; "It started {date}."; the card above the status chip).
- **Next:** commit this build's hunks only when the
  owner says (`lib/house-league-season.ts`, `TODO.md`, the plan, the ledger and `house-league.tsx` are shared).

## What a person sees after this build (the PM / UX summary to present before any code)

- **A family opening a season that is still taking sign-ups** (or opens soon) sees today's page, unchanged: price, early bird,
  age groups with spots, Register now.
- **From the day registration closes** (the club closed it, or its close date passed), the page stops describing a purchase. The
  price, the registration dates, the age-group "spots filled" tiles and the grey notice box are gone. Under the title, one line
  gives the season's dates ("Runs May 2 to October 25, 2026.").
- **Once games have scores**, the page leads with each age group's **top three**, first place in bold, each with **Full table →**
  to that age group on the standings page. The band reads **Standings** while the season is played or has ended, and **Final
  standings** once the club completes it. An age group that keeps no standings, or whose schedule is not published, is not
  listed. Before any score, there is no table and **Schedule** is the one button.
- **A finished season** reads "This season has concluded. It ran May 2 to October 25, 2026." under the title, with no chip.
- **An old season's page** (past its last day, or finished) shows a slim card above the title when the club has a newer season
  taking sign-ups today: "Fall 2026 · Registration open", its registration line, **See Fall 2026 →**. Two or more name them and
  link to the club's House league page. None: nothing.
- **Unchanged:** the chip words, the Schedule button, "Already signed up? Email me my link" in every state (a family who owes
  keeps its page open past the season), the standings and schedule pages, the House league index.
- **Who:** families and anyone on the club's public site. No admin, coach or plan-gating change.

## Facts checked in the code on 2026-11-04 (re-check before relying)

1. **Registration state** is `registrationState(season, nowWall)` (`lib/league-registration-state.ts:45-57`): `opensAhead`, `open`,
   `closedByDate`, `closedByYou`, `ended` (active/completed/archived), `draft`/`notSet`. `takesSignups` = `open` (`:59-61`).
   `publicRegistrationLine` (`:109-117`) returns "Registration closes Sep 13." for `open` with a close day, **null** with none.
2. **The page today** (`app/[orgSlug]/league/[seasonSlug]/page.tsx`): `finished` = completed or archived (`:85`); the chip is
   `publicSeasonState(season, today)` (`:88`, `lib/house-league-season.ts:172-182`); the Registration / Season dates / Price bands
   (`:115-145`); the Divisions tiles with spots (`:148-227`); the CTA block, the grey notice and the Standings / Schedule buttons
   (`:230-277`); "Already signed up?" (`:279-284`, hidden only before registration opens).
3. **Standings** come from `computeStandings(divisionId, sport)` (`lib/db.ts` ~2960), already ranked: rows with `place` (shared
   places repeat), `tied`, `counted`, plus `scored`, `labels`, `rules`. The standings page shows a division's table only when
   `showStandings` **and** `schedulePublishedAt` (`standings/page.tsx:58-63`). Column words are `STANDINGS_WORDS.col`
   (`lib/league-standings.ts:197`); the band word is `standingsTitle(status)` (`:267-269`, "Final standings" for completed or
   archived); a shared place renders "T-3" (`:204-206`); first place is `column.standLead` by weight only (DC-02, no row tint).
4. **Seasons for the next-season card:** `getLeagueSeasons(orgId)` (`lib/db.ts`, used by `app/[orgSlug]/league/page.tsx:39`);
   `newerSeasons(season, seasons)` (`lib/house-league-season.ts:148-150`) is the switcher's own "newer" (start day, then created);
   drafts are never public. Nothing links one season to another (`LeagueSeason`, `lib/types.ts:955-987`).
5. **Kit pieces to reuse, not restyle:** the door card `kit.door` / `kit.doorTitle` (`components/public/ClubKit.module.css:255-271`),
   `kit.card`, `kit.cardHead` (`:275`), `kit.srOnly` (`:301`), `kit.btn kit.btnSecondary kit.btnSm`, `kit.band`, `kit.title`,
   `column.header`; the table classes `column.standTable`, `standRank`, `standTeam`, `standLead`, `standDot`, `standStrong`,
   `standLink`.
6. **Dates:** `formatStoredDate(value, { longMonth: true, withYear })` (`lib/timezone.ts:582-591`) is the one formatter; the club's
   today is `tournamentToday()`. Never `new Date(dateOnly)` (the date rule in the code-gotchas memory; `npm run check:dates`).
7. **The pinning test:** `tests/unit/house-league-public-seasons.test.ts:58-66` asserts `{finished && 'This season has
   concluded.'}` and `{finished ? 'Final standings →' : 'Standings →'}` on the page. Both lines move; rewrite the test to pin the
   new behaviour, keep its "retired words are gone" assertion.
8. **Help:** `lib/help-content/house-league.tsx:1612` describes the public season page ("their page says *This season has
   concluded*…"). `/docs` updates it after the build.

## Build decisions the prompt makes (say so in your report; the owner can overrule)

- **The shape is one pure function**, e.g. `seasonPageShape(season, nowWall): 'signup' | 'season'` beside the registration helpers:
  `signup` for `opensAhead` and `open`, `season` for everything else public. A `registration_open` season whose close date has
  passed (`closedByDate`) gets the **season** shape: registration has closed, which is P1's trigger.
- **The dates line is one pure function** returning the copy doc §1 sentence for every case (both days, start only, end only,
  neither, same day, across a new year; "Runs"/"Ran" by the end day against the club's today; finished always "It ran").
- **Top three = the first three rows in table order** (copy `card.tie`); the foot counts the rest. No new tie rule.
- **"No table yet"** = no listed division has a scored game: the band is absent and Schedule is the primary button. If at least one
  has, a listed division without a scored game shows its card with the copy doc's empty sentence and no link (W5).
- **The next-season card shows only on an old season's page:** the chip is "Ended {date}" or the season is finished. Seasons counted:
  newer (fact 4), not draft, `takesSignups` today. One links to its season page; two or more link to the House league page.
- **The "Final standings →" / "Standings →" button goes** in the season shape; each card's Full table link replaces it. Schedule
  stays: secondary when the standings band shows, primary when it is the only button.
- **N `computeStandings` calls in parallel** (one per listed division, `Promise.all`), the same reads the standings page makes for
  one. A house-league season has a handful of divisions; no new query.

## Parts (build in this order; stop and update Progress after each)

**Part 1 · The shape and the line under the title.** The two pure functions above, with unit tests for every branch (each
registration state; each dates case in copy §1, including the year-crossing and one-day seasons). In the page: the season shape
renders the chip (unchanged), the title, the description (unchanged), the dates line; it does **not** render the Registration /
Season dates / Price bands, the Divisions tiles or the grey notice box. The sign-up shape is byte-for-byte today's.

**Part 2 · The standings cards.** Listed divisions (fact 3), their standings in parallel, the band word from `standingsTitle`. Each
card: `kit.card` with the division name as its heading and **Full table →** (`standLink`, `?d={id}`, hidden "for {division}" in
`kit.srOnly`, arrow `aria-hidden`), a four-column table (#, Team, W-L-T, Pts) on the standings page's classes with
`aria-labelledby` the heading, the team dot, T-n places, first place `standLead`, the "{n} more team(s)" foot. Two cards per row at
a desk, one on a phone (the drawing). The empty card (W5). The whole band absent before any score.

**Part 3 · The next-season card.** Above the title, `kit.door` in an `aside` labelled per the copy doc (W7), heading as a paragraph
(`kit.doorTitle`), the line, one `btnSecondary btnSm` button. One / two-or-more / none per copy §4; W6's cap (three names, then "·
{n} more").

**Part 4 · Buttons.** The season shape's button row (Schedule only; primary or secondary per the decision above). "Already signed
up? Email me my link" untouched, same condition as today.

**Part 5 · Words, spelling, tests, hand-off.** Every string from the accepted copy doc, nowhere else invented; grep each against
the copy doc §6 "must not appear" list; `npm run check:spelling`. Rewrite the pinning test (fact 7) and add the new unit tests.
Then the hand-off steps below.

## Rules that bite

- **One spelling:** "sign-ups" (hyphen), never "signups". Dates long-month in the sentence, short in the chip (settled). Times, if
  any appear: `formatTime()` only.
- **Do not restyle the kit.** The design review on the drawings (2026-11-03) found the drawing's first attempt invented a row tint
  and a typewriter header face; the shipped table has neither (DC-02, DC-03). Reuse the classes in fact 5.
- **The public site is the club's colours.** Links are `--club-ink`, the door's edge `--club-edge`; never a FieldLogicHQ colour.
- **Every count and date on this page comes from the season's data.** No hard-coded example text.
- Server component only; no client JS is needed.

## Verification

`npm run verify:changed`; `npm run typecheck` (the shared helpers in `lib/league-registration-state.ts` /
`lib/house-league-season.ts` move); the focused unit tests. If you add a new module file, the **dev server must be restarted**
before the owner walks it (`npm run dev` only; stop it before clearing `.next`). `npm run check:layout --changed` on the season
page at phone and desk widths if the dev server is free.

## After the build (in this order)

1. `/review` (the repo's adversarial funnel). Fix what it confirms.
2. `/docs`: the public-pages article (fact 8) and anything else describing the season page.
3. **The owner's walk**, a checkable Artifact (one purpose; paste-back), with a dev fixture that creates one club with: a season
   registration-open (sign-up shape check), one registration-closed before its first day, one playing with scores in two
   divisions and one division unscored, one ended-not-completed, one finished with a newer season taking sign-ups, and a second
   newer open season to show the two-or-more card. Next free ledger § in `OWNER_QA_LEDGER.md` (grep, never assume).
4. Record: this prompt's Progress block, plan §0k (the commit hash and the walk), the TODO line. Positive facts with anchors only
   ("committed `<hash>` <date>"), never "uncommitted".

## Shared-file traps

`TODO.md`, the plan, `OWNER_QA_LEDGER.md` and `lib/help-content/house-league.tsx` carry other sessions' edits. Commit only your
hunks (a temporary index and exact edits if a file is shared), then `git show --stat HEAD` and confirm only your files landed.
