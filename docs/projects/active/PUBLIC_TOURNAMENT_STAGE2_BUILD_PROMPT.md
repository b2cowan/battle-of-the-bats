# Public tournament pages — Stage 2, the Overview (build prompt, four sessions)

> Written 2026-10-28. Stage 2 of `PUBLIC_TOURNAMENT_SITE_REVIEW_PLAN.md` (§9). **Ruled: Asks 3, 4 and 17, as
> recommended** (§10), and the "Live now" change (owner, 2026-10-28; found by Stage 1's `/review`). Stage 1 is built and
> its walk §417 passed 40 of 40 (D3, the installed app, and E5, the pay page, were optional and skipped).
> **Everything here is built behind the preview switch**: with it off, customers and the public demo see today's
> Overview, unchanged. Stage 8 turns it on for everyone, once.

## What Stage 2 is (one paragraph, so every part shares it)

The Overview stops being a pile and becomes a short page that answers the family's question for the moment they are in.
**Game day:** *My team* (one line) → **Live now** (one card per game in play) → **Up next** (4 rows + "Full schedule") →
**Latest results** (3 rows + "All results") → News (only if any) → **the host card** → footer. **Before the event:** the
**Register card** (starts date and countdown, "11 of 16 team spots taken", *Register a team*, one line about the free
Coaches Portal) → a **facts list** → the host card (higher, because attention is free) → News → footer. **After the
event:** **the champions first**, a door to the final standings, the host card, footer. Plan §5 has the order and the
words; the hub's "The end state" tab has the drawings (game day phone, the same page inside the installed app, before
the event phone, game day desk 1280). **Absent beats empty: a part with nothing in it does not render.** The ticker does
not show on the Overview (Live now is its fuller copy). Stage 2 also **builds the shared parts later pages reuse**: the
game row, the Live now card, the tap-open row and the door row.

## How this runs: four sessions, a `/clear` between them

| Part | Covers | Ends with |
|---|---|---|
| **1** | The owner's two quick rulings (below); the **moment helper**; the **band stops saying "Live now" after the champion**; the shared parts (game row, Live now card, door row, tap-open row) built and unit-checked on their own; the slim "open now" read | Committed; nothing visible on the Overview yet except the band's word |
| **2** | **Game day**, phone: My team line, Live now, Up next, Latest results, News; the ticker off the Overview | Committed; a short owner check at 360/390 on the fixtures (not the stage walk) |
| **3** | **Before** and **after** the event; the **host card**; the Register card; the facts list; the **desk** frame | Committed |
| **4** | `/simplify`, `/review` of Stage 2's diff, the QA walk (next free §), records | Committed, reviewed, walk written and published |

At the end of each part, tell the owner in one line that it is a good place to `/clear`, and where the next part starts.

**Token discipline (owner, 2026-10-27, unchanged).** Nearly all of a session's cost is re-reading its own history.
- **Read this prompt, plan §5 (the Overview) and §6 (Ask B)**, and nothing else of the plan unless a step names it.
- **The drawings are the spec and the hub is 185 KB: never read it whole.** Slice "The end state" (about 18 KB, between
  the `<h2>The end state</h2>` and `<h2>Every page: the whole experience</h2>` headings) with a short node script. The
  drawings are HTML and CSS, so sizes, colours and words are readable in the markup. **Build to the drawing, but the
  Stage 1 band, tab row, footer and tokens already exist: reuse them, don't redraw them.**
- Send censuses to a helper and ask for path:line plus a verdict. A helper's claim is a lead: open the cited lines
  before you rely on it. (The census this prompt stands on was spot-checked on 2026-10-28; its line numbers will have
  moved.)
- Prefer `npm run verify:changed`; `npm run typecheck` once per part. `check:layout --changed` only on the screens a part
  touched, **with the switch on**. Leave the dev server running unless a restart rule applies (AGENTS.md); new files mean
  a restart before handing the owner a check.

**Every part:** work on `dev`, stage explicit paths only; other sessions share this working copy (AGENCY_RULES). Commit
only after the owner says yes. ⚠ For a partial commit out of a file another session has also edited, build the blob from
HEAD plus your own lines, name the staging copy so it cannot collide with a repo file (Windows paths ignore case), and
diff each blob against HEAD before committing. Present the product-owner summary before writing code (AGENCY_RULES).
**Commit this prompt file with Part 1's first commit**, with the Stage 2 row of plan §9 ("Build prompt written") and the
public-tournament TODO line. TODO.md also holds other sessions' uncommitted hunks, so take only yours.

### Rulings this stage stands on (do not re-open them; cite them)
- **Ask 3, the Overview order and absent-beats-empty** (plan §5). The Event Snapshot, the "Tournament Day / What To Check
  Now" heading, the Explore button row and empty News / Upcoming cards are **gone** from the Overview, each fact still
  living somewhere (plan §5's "Goes from the Overview" list: registration → absent once closed; today's count → Up next;
  results → Latest results; field → every game row; the org line → the host card and footer).
- **Ask 4 / Ask B, the host card** (plan §6): club logo tile and name, "Open now at {club}: …" from the club home's own
  open-now list (nothing typed for it), a *Visit the club* button. **Absent when the organizer has no public club page**;
  a tournament-only organizer gets the footer line as plain text and no card. An organization with two or more
  tournaments but no club site keeps today's link to its tournament list. When the open-now list is empty the card reads
  "{club} runs teams and programs all year" and the button.
- **Ask 8, one set of state words:** Live now · This weekend · Registration open · Finished (`TOURNAMENT_STATUS_WORD`,
  `tournamentHomeStatus` in `lib/club-site-home.ts`). "Game day", "In progress", "Tournament Day" and "First pitch" do not
  appear behind the switch. "Starts in" replaces "First pitch in" (Stage 0 already did that).
- **Ask 17:** the ticker leaves the Overview (and Stage 3 takes it off the Schedule and a game's page). The layout mounts
  it above every page's content, so the Overview cannot simply not render it: see Part 2 step 5.
- **Alerts only inside the installed app** (owner, 2026-10-27): no alerts control on the Overview in a browser.
- **Stage 1's frame is the frame**: light ground, the band, the white tab row, the club's type, no typewriter face, 12 px
  minimum, tabular figures for scores and times, 4.5:1 text and 3:1 edges. `check:contrast`, `check:text-contrast` and
  `check:public-tokens` run in `verify:changed`.
- **Nothing here reaches a customer before Stage 8.** With the switch off, today's Overview, ticker, "Live now" band and
  explore row are exactly as they were. A guard test (the Stage 1 guard's style, `tests/unit/_source-code.ts`) holds
  that every new part renders only under the marker or `isPublicFrameOn()`.

## What the code does today (a 2026-10-28 census; re-check before you rely on a line)

- The Overview is `app/[orgSlug]/[tournamentSlug]/page.tsx` rendering `components/public/TournamentHomeContent.tsx`
  (about 1,160 lines, one async server component, **every section inline JSX**; no section components exist). The
  organizer's admin preview renders the same component with `isPreview`.
- It already branches on the switch in three places (`isPublicFrameOn()`): the eyebrow word, the Explore row, and a rule
  that hides the old hero. Its sections, in order: follow strip, hero (and a separate "The Bracket Is Set" playoff
  takeover), share row, Live now (shows only while not finished and games are live), the pre-event panel, the champion
  banner, the completed-record panel, the "Tournament Day" panel (Follow your team + Latest Finals + Event Snapshot), the
  schedule block ("Next On The Schedule", placed before News in progress and after it before the event), News, the
  Explore row.
- **The "moment" is derived inline, and the same finished rule is copied six times.** `isFinished` is games-derived
  (completed, or playoffs done with no unplayed games, or a round robin done after the end date, and **never while a
  division's schedule is withheld**, D1). The layout uses a cheaper copy (`effectivelyFinished`: completed, **champion
  crowned**, or past the end date). `lib/entity-follow-status.ts` carries a comment saying it MUST match the Overview.
- **The band's word ignores the crown.** `tournamentHomeStatus` returns Finished only for completed/archived or past the
  end date; "inside the dates" is Live now. So the last day, after the final, still reads "Live now" while the body is
  already the finished experience (the disagreement Stage 1's `/review` found). Callers: the band and the admin preview
  (`publicFrameBand`), the club home and the club's Tournaments tab (`clubTournamentRows`), and the club-home fallback
  list. One rule, five readers.
- The followed team lives in the browser (localStorage, no account); the server renders everything the card filters. The
  Overview is `force-dynamic` and the service worker caches anonymous HTML, so **never thread per-user data into the
  server render**: the My team line is a client component fed full server data, as `MyTournamentCard` is now.
- The host card has no home yet. The band and footer take their "Hosted by / Run by" from `publicFrameHost` in
  `lib/public-frame.ts`; the Overview body hard-codes "Hosted by {org}" twice and does not use it.
- The "open now" list exists only inside `loadClubHome` in `lib/club-home-data.ts` (league sign-ups + tryouts, ordered by
  `orderOpenNow`). It loads far more than a tournament page needs and asks **no access question** (each caller asks
  first: `isPublicClubSiteOpen` and the public-site module entitlement).
- There is no shared game row, tap-open row or register card. `ClubKit.module.css`'s `kit.row` family is the best
  door-row model (club pages only).

---

## Part 1 · The rulings, the moment helper, the band word, the shared parts

0. **Ask the owner two things before building** (one `AskUserQuestion`, recommendations first; both were left unruled on
   2026-10-28):
   - **The word that replaces "Live now" once a champion is crowned.** *Recommended: "Finished"* — it is already one of
     the four words (Ask 8), the body is already the finished experience, and a fifth word ("Complete", "Champions
     crowned") breaks the one-set rule. Alternative: a new word for "decided but not yet over", which only helps if a
     tournament has real games after the final; say so if the code shows one.
   - **Does the club home's word move with it?** *Recommended: yes.* It is one rule today, read by the band, the club
     home and the Tournaments tab; a family should not see "Live now" on the club home and "Finished" on the tournament.
     The cost: the club home and the Tournaments tab change behind no switch (the club site is live today), so this part
     of the change is **customer-visible before Stage 8**. If the owner wants the switch to gate it, the band calls the
     rule with the crown and the club side keeps calling it without; say plainly that this leaves two answers for one
     tournament until Stage 8.
   - Also tell the owner (do not ask): **tab order** (Overview, Schedule, Standings, Teams, Playoffs, News, Rules in the
     drawing; News is second today) and **tabs that appear and disappear** both belong to **Stage 6** with Ask 14, "one
     rule, one stage". The Overview is drawn with the new order; building it is Stage 6's.
1. **The moment helper.** One pure function in `lib/`, e.g. `tournamentMoment(...)`, returning `'before' | 'gameDay' |
   'after'` plus the flags the Overview needs (registration open, games today, champion crowned, schedule withheld). It
   takes the inputs `TournamentHomeContent` already computes (`isFinished`'s own inputs, the dates, `scheduleWithheld`).
   **It must reproduce today's `isFinished` exactly** and have a unit test that pins the table of cases (completed;
   playoffs done and no unplayed games; round robin done on the end date; withheld schedule; crowned champion; before
   start; in the dates with nothing played). **Do not rewire the six other copies in this stage** (follow status, the
   layout, `usePublicTournamentLive`, Schedule, Standings, Teams): list them in the plan row as a follow-up, because a
   behaviour-preserving refactor of six surfaces is its own review. The new frame-only Overview uses the helper; the old
   body keeps its inline logic until Stage 8 deletes it.
2. **The band's word.** Apply the owner's ruling: `tournamentHomeStatus` (or the band's call site) treats a crowned
   champion as Finished. The layout already carries the crown (`championsCrownedAt`). Add the case to the status tests
   (`club-stage4b2a`, the Stage 1 frame guard). Check what "Finished" does to the band's live dot and to the follow/share
   chrome (`data-live`).
3. **The shared parts, built and checked on their own** (new files under `components/public/`, CSS modules, no use on a
   page yet except what Part 2 wires). Read the drawings' markup for sizes. Each is a small server-or-client component
   with a unit or guard test:
   - **Game row**: time, both teams, division and field (the schedule's row recipe from the drawings), with a *finished*
     face (state word Final, both scores, the date) and a *scheduled* face. Tabular figures. Also the *desk* wide form.
   - **Live now card**: one per game in play: teams, scores, "No score yet" before the first score (Stage 0's D2 words),
     field, Directions. This card is also what the Schedule's live game uses in Stage 3, so keep it free of Overview
     assumptions.
   - **Door row**: the club kit's `kit.row` family restyled for these pages (a label, an optional sub-line, a chevron;
     44 px minimum). Used for "Full schedule", "All results", the final-standings door, the facts list.
   - **Tap-open row**: a disclosure with a real button, `aria-expanded`, 44 px, one open at a time optional. Nothing on the
     Overview uses it yet; Stage 4 (tie-breakers) and Stage 6 (rules) do. **Build it only if a Part 2 or Part 3 step uses
     it**; otherwise leave it to Stage 4 and say so in the plan row. (Absent beats speculative.)
4. **The slim open-now read.** Extract the open-now block of `loadClubHome` into its own function that the club home
   then calls (a behaviour-preserving move: the club home's output must not change; pin it with a test before moving).
   The tournament page calls it **only** when the club's public site is open and the module is entitled
   (`isPublicClubSiteOpen`, `hasModuleEntitlement(org,'module_public_site')`); otherwise the host card is absent. Decide
   with the code, and say which, whether a second tournament page load hitting league + tryout reads per request is
   acceptable (the Overview is `force-dynamic`) or wants the club home's existing caching.
5. Fixtures: the Stage 1 fixture script (`scripts/seed-public-frame-fixtures.mjs`) and `.probe/stage1walk/walk.mjs`
   already move Lakeshore through live / soon / new. Reuse them; add the three moments (a registration-open event, a
   game-day event, a crowned event) if they are not already there, and name them in the walk later.
6. Verify, then `/clear` note. Nothing on the Overview changes yet except the band's word; say so.

## Part 2 · Game day, phone

Read the hub's "Game day, phone browser" frame and its "What changed" list. **Build the frame-on Overview as a new
body** (a new component the page renders when `isPublicFrameOn()` is true), fed by the same loaded data and the moment
helper, **leaving `TournamentHomeContent`'s current JSX untouched for the switch-off path**. That keeps "off = today"
trivially true and gives Stage 8 one thing to delete. Extract the data-loading half of `TournamentHomeContent` only as
far as both bodies need it, and do not change what the old body computes.

1. **My team line.** One line when no team is followed: "Follow a team to see its next game here." Following: next game,
   time, field, Directions. A client component, fed full server data, reading the followed team from the same hook the
   current card uses. **Tournament-level follow (`FollowTournamentStrip`, with its account sync) is not in the drawing**,
   which shows one prompt where today there is a follow strip and a My-team card. Census what tournament-follow gives a
   family today and where else it can be reached (the band's Share is there; the team page has its star). **If the
   drawing silently drops a capability, stop and ask the owner; don't delete it.**
2. **Live now.** One card per game in play, from the shared card; the section is absent when none is live. Playoff
   picture link: keep today's link only if the Playoffs page is where it lands (the bracket's move is Stage 4).
3. **Up next**: 4 rows from the shared game row, "Full schedule" door. **Latest results**: 3 rows, "All results" door.
   Both absent when empty, and both **absent while the schedule is withheld** (D1: "Schedule: posted before the event"
   is the pre-event fact, not an empty card). Check that withheld divisions never leak into either list, and add that to
   the tests (Stage 0's D1 rule).
4. **News**: the newest posts, only when there are any, with its door ("All announcements"). Take the post card from the
   News page's recipe if it is shared; don't invent a third.
5. **The ticker off the Overview.** The layout mounts the ticker line above every page. Make the line itself decide by
   path: a client check (`usePathname`) against a short list of "pages that carry the ticker" kept in one place, so
   Stage 3 can remove the Schedule and a game's page by editing the list. Don't turn the layout into something that
   knows each page. With the switch off, the old strip is unchanged.
6. **Not on this page, said in the PO summary:** no alerts control; no Event Snapshot; no Explore row; no "Tournament
   Day" heading; no follow strip above the title. The "The Bracket Is Set" playoff takeover is **not drawn**: today it is
   a hero the frame hides, so check what a family sees during the playoffs under the switch, and show the owner a
   frame of it. The bracket's home is Stage 4; don't design it here, but don't leave a hole either.
7. Owner check on the fixtures at 360 and 390 (game day, no team followed, a team followed, nothing live, schedule
   withheld). Measured in the drawing: **the first Up next row starts at about 600 px** (from about 1,950 today); check
   the build lands near it and say the number.

## Part 3 · Before, after, the host card, the desk

> **Part 2 done (committed `705c63cdf` 2026-10-28; plan §9).** Read before starting: **following was RULED at Part 2
> (plan §10a): the installed app only, and on the Overview "Follow this tournament" alone** (no My team line was built;
> it is not in the before/after frames either). The new body is `components/public/TournamentOverview.tsx`; the old
> Overview hands over to it in one `if (frameOn)` branch, today only when `moment === 'gameDay'` — Part 3 widens that
> to every moment and adds the before/after sections there. Reuse `.note` (one-line fact card), `PublicDoorRow`,
> `PublicPostList`, and the app-only follow line (top of every moment). The desk is still the phone column held to
> 760 px; the columns are this part's.

1. **Before the event** (hub: "Before the event, phone browser"). The **Register card**: "Starts {date}" and the
   countdown together with the button, "{n} of {total} team spots taken · {divisions}" **from data** (the code computes a
   total capacity only when every division has one, and counts follow the team list's visibility; capacity is never
   private: read the existing rules at the inline copies in `TournamentHomeContent` before reusing them), *Register a
   team*, one line about the free Coaches Portal and following a team without an account. Absent when registration is
   not open or the Register page is off. **Two inline register CTAs exist today (hero and mobile panel); this is where
   they become one card**, using `getRegistrationState` for the label and CTA. The **facts list**: Divisions, Where
   (+ Directions), Schedule ("Posted before the event" while unpublished), Rules ("Format and rules"), each a door row.
   News if any. The Schedule and Standings tabs waiting for a schedule is Stage 6's tab rule; the facts list's row is
   this stage's.
2. **After the event** (no hub frame for the phone; plan §5 gives the order, the Champions page frame gives the look):
   the champions first (reuse the champions recap's markup and `deriveTierChampions` / `tierBadgeLabel`; the recap is
   duplicated markup today, so extract rather than copy a third), a door to the final standings, the host card, footer.
   The Share-results button: keep it where it is if the band's Share does not cover it; say which.
3. **The host card** (Ask 4, plan §6). Club logo tile (initials when none), name, the open-now line from Part 1's read,
   *Visit the club*. Placement: game day, after the results; before the event, right after the facts; after the event,
   after the final-standings door. Absent when the organizer has no public club page. **Use `publicFrameHost` so the card,
   the band and the footer cannot disagree.** The Overview body's two hard-coded "Hosted by" lines go in the new body.
   The admin preview shows the card as plain text, as the band does.
4. **The desk** (hub: "Desktop, game day · 1280px"). Same order, two columns where the drawing has them; the band already
   carries "Hosted by …" on its right from 1,024 px (Stage 1), so the card still shows on the desk (a visitor scrolls).
   Check 901–1,023 px, where Stage 1 kept the phone's white tab row.
5. **The demo.** With the switch off the demo is today's Overview. With it on, check the demo tournament reads sensibly in
   all three moments; **do not edit the demo seed in this stage** (CLAUDE.md: the demos follow the product).
6. Owner check on the fixtures at 360 / 390 / 1280 (each moment; a club with open-now items, an empty list, no club
   site, a free event, a pale club colour).

## Part 4 · Simplify, review, the walk, the records

1. **`/simplify` first**: Stage 2 adds new shared parts and a moment helper, so offer it (CLAUDE.md), especially for the
   game-row family and any duplicated markup between Part 2 and Part 3. Then **`/review` on all of Stage 2's diff**. The
   places this stage can be wrong: the moment helper disagreeing with the old `isFinished`; a withheld division leaking
   into Up next / Latest results / the champions; the band's word and the club home's word disagreeing; a client
   component reading per-user data on the server render; the switch-off path changing by one pixel; the host card
   showing for a closed public site; the ticker still on the Overview (or gone from a page that should keep it).
2. **The QA walk**: one purpose, *"with the preview on, the Overview answers the moment you are in; with it off, nothing
   changed"*. A checkable Artifact in §417's style (parts, fixtures, a stop check, read-backs on every step that
   writes). **Grep `OWNER_QA_LEDGER.md` for the next free §; other sessions add §s.** Parts: game day (a team followed,
   none, nothing live, schedule withheld); before the event (the Register card's numbers read back against the data); after
   the event (champions first, the door); the band's word the day the champion is crowned (and the club home's);
   the host card under each kind of organizer; the desk; the ticker gone from the Overview and still on the other tabs;
   the switch off is today's Overview; the demo. Keep installed-app and live-payment steps optional, as §417 did.
   ⚠ §407's lesson: the walk is the only rendered check; ask for a read-back on every step that writes and compare the
   server log with what the owner ticked before recording a pass.
3. Records: plan §9's Stage 2 row (commit hashes, walk §), the TODO line, and the ledger entry. List the six copies of the
   finished rule as a named follow-up. `/docs` and `/demos` wait for Stage 8 (the club-home "Finished" word, if the owner
   moved it before Stage 8, is the one customer-visible change: check the help guides for the old word then).
4. **Then tell the owner Stage 2 is done and a good place to `/clear`.** Next is Stage 3's build prompt (Schedule and a
   game's page, which reuses the game row and the Live now card), or Stage 1a (who owns the look). Name both and let him
   choose.

## Not in Stage 2 (say so if a step drifts toward one)
Schedule controls, day chips and the Playoffs half (Stage 3). The bracket's move and Standings pinning (Stage 4). Teams
and a team's page (Stage 5). Tabs following what there is, the tab order, Rules as tap-open sections (Stage 6). The pay
page (Stage 7). Sponsors strip (side track; the Overview will make room for it above the footer once `/strategy` has
ruled the plan gate). The club's rule for its tournaments' look (Stage 1a). Rewiring the six other copies of the
finished rule. Emails and link previews.
