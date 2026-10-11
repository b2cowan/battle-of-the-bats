# Club Tier Stage 6d — Calendar feeds: a coach's, and the team's public one (built to hub version 91)

> Paste into a fresh session on `dev`, **after the permits build (10a) is committed** (precondition 1). Written
> 2026-10-11, the day Stage 6d was drawn and **ratified**: every ask as recommended, with the revisions from the owner's
> question about what feeds cost to serve (owner: *"yes fold it into the hub and write the build prompt"*). **In this
> build:** a coach's own feed and the team's public feed, on one set of feed words, behind one Subscribe window. **Not in
> this build:** the club admin's feed (Ask 4, ruled and **deferred**) and the family view's door (waits for counsel; the
> guardian switch stays off). 6d gates nothing: the scheduler (11a) does not wait for it, and it does not hold the Club
> release (Ask 6).
>
> **The spec is the hub:** https://claude.ai/artifact/K4MPu4ni53Ct7yrDcmWJd9 → Mockups → **Stage 6d** (version 91).
> - Build **to the drawings, exactly** (memory `feedback_build_to_approved_mockups`). Every NEW, RESTYLED, UNCHANGED,
>   SHARED and Words tag note is a requirement; open each one. **This build's screens:** *Where the feeds stand*
>   (`#s6d-status`, the evidence), **1 · A coach** (`#s6d-coach`), **2 · The Subscribe window** (`#s6d-window`), **3 · A
>   family** (`#s6d-family`) — **the public team page frames only**, **5 · In a calendar app** (`#s6d-feed`, the feed
>   words F1–F10). **4 · A club admin** (`#s6d-club`) and specimen 3's **family view** frames are drawn and ruled for a
>   later build: do not build them.
> - **"Formatting check"** (`#s6d-format`) is your checklist, every row, including the thirteen `/design` changes and the
>   three proposed sentences (a)–(c). **"Not drawn"** (`#s6d-build`) holds the build as ratified and **What feeds cost to
>   serve, and what keeps it cheap** — those controls are requirements, not suggestions.
> - The Decisions tab holds the rulings with their reasons (rows "Stage 6d · Ask 1–12" and "What do feeds cost to serve").
>   **This build's: Asks 1, 2, 3, 5, 8, 9, 10, 11, 12 and the cost row.** Where you must depart from a drawing, say so at
>   build time and record why; never silently.
>
> **Read first:** `CLUB_TIER_PRODUCTION_READINESS_PLAN.md` §6 **Stage 6d** (the "🎨 DRAWN" and "⚖ RATIFIED" blocks — the
> findings S6D-01…14, the asks, the shape) and §5 **D07**; the hub's Full Plan tab headings S6D-01…14;
> `COACH_SCHEDULE_DEEP_DIVE_PLAN.md` stage 4 and D-1 / D-2 (the download's day-shift and cancelled fixes of 2026-09-25 —
> this build must not reintroduce either); `CLUB_PERMITS_AND_SCHEDULER_PLAN.md` §5.8 (what a club slot needs from the
> feed); `docs/agents/design/TABLE_AND_LIST_STANDARD.md` §11 (the calendar recipe). Memory `project_club_stage6d_feeds`,
> `project_club_stage6c_one_calendar`, `project_club_tier_readiness`, `feedback_build_to_approved_mockups`,
> `feedback_portal_is_the_formatting_benchmark`, `decision_drawer_layers_form_vs_menu` and the in-repo design log's
> 2026-10-05 Sheet Frame entry, `decision_rare_door_ends_body`, `decision_export_is_one_button`,
> `decision_autosave_word_is_transient`, `decision_close_x_is_plain_glyph`, `reference_artifact_publish_needs_full_read`,
> `reference_hub_script_parse_trap`, `reference_backticks_in_shell_strings`, `reference_js_replace_dollar_patterns`. The
> in-repo `memory/design_decisions.md` entries from 2026-10-01 on.

## ⚠ The lessons this stage already paid for

- **A link that is stored only as a fingerprint can be shown once.** That is why the team-wide feed was never wired
  (`ensureTeamCalendarToken` mints a NEW token on every call, despite its name) and why the family view's Subscribe makes
  a new link on every press, silently stopping the one already in a calendar (S6D-02). A coach's link must be shown again
  every time the window opens, until Reset: **sign it**, don't store it readable (Part A2).
- **"Removing a coach doesn't remove them" is a real defect class here.** Removal flips the staff membership to revoked
  and **re-adding reactivates the same row** (`lib/coach-membership.ts` header, `removeStaffMember` `:630`, the update
  `:650`). A coach's link must therefore die on revoke and **never come back** when the coach is re-added: the feed checks
  the membership on every read *and* removal retires the link (Part A2).
- **A feed that stops answering "not found" freezes in the subscriber's calendar** — calendar apps keep the last copy
  they read (S6D-04). An issued link that has stopped answers with an **empty calendar** under its name; only a link we
  never issued is "not found".
- **The read limit counts by caller address across every feed** (`lib/no-login-token.ts` `POLICIES` `:68`,
  `subjectKey` `:79`): Google and iCloud fetch from shared servers, so one server polling many teams' feeds would exhaust
  one budget and every feed it reads would stop, with nothing to tell anyone (S6D-03). It also writes a row on every read.
- **There are no staff-only events.** An event has no visibility of its own (S6D-06). What a coach's feed adds over the
  family's is the tryout days (a coach with the tryouts capability), each event's notes and uniform, and the organizer's
  games not yet copied onto the team's list (S6D-05: nothing on either database is copied from a tournament today, so
  every tournament game a coach sees arrives as an overlay).
- **A calendar entry is an instant.** The feed already composes from instants (`composeICSFromInstants`,
  `lib/export/ics.ts:73`); the download's day shift (D-1) came from slicing an instant for its date. Keep every new entry
  on instants; only the words inside (the arrival time) are written in the club's clock, and they say which clock.
- **Google doesn't strike a cancelled entry, and its handling of one in a subscribed feed isn't documented** (Apple
  strikes it through). The word leads the title and the build walks it in the real apps before help says anything.
- **Calendar services can't reach `localhost`.** Google and iCloud fetch a subscription from their own servers, so on
  dev only a desktop calendar app that fetches the URL itself (Apple Calendar on a Mac, Outlook desktop) can subscribe.
  The Google walk happens on production after the promote (Walks).
- **`lib/db.ts` holds a NUL byte**: ripgrep treats it as binary and silently skips it. Search it with `grep -a`.
- **Shared files are shared.** The hub, the club plan, the TODO, the QA ledger, the dev server and the test club are
  everyone's; the scheduler build (11a) may be running beside you.

## Preconditions (check before code)

1. **The permits build (10a) is committed** — its code landed 2026-10-11 (`e56f4748` · `6b636d6e` · `7503485e` ·
   `b3fe456e`, mig 322). Before it, it held edits in six files this build must also edit — `lib/help-content/exports.tsx`,
   `lib/help-content/coaches.tsx`, `lib/export/catalog.ts`, `docs/agents/db/DATA_DICTIONARY.md`, the schema snapshots and
   `memory/design_decisions.md`. **Every path this build edits must be free of another session's uncommitted hunks before
   you touch it:** read `git log` and `git status` fresh; if one isn't (on 2026-10-11 the tournament redesign held
   uncommitted edits in `docs/agents/design/TABLE_AND_LIST_STANDARD.md`, which Part 0 extends, and in the shared
   `KitDialog` and `FormTable`, which this build doesn't need), build that file as HEAD plus your own hunks, or **stop and
   ask the owner**. Other sessions' hunks in shared docs (TODO, plans, briefs, ledger, hub, the strategy docs) are theirs.
2. **Ask 11 is logged** — `BUSINESS_DECISIONS.md` 2026-10-11 "Calendar feeds ride the screens they live on" and the Facts
   doc's **Calendar feeds** bullet (logged 2026-10-11): the coach's feed rides the coaches-portal Schedule — **the Premium
   Coaches Portal and both Club bands** (League Plus carries no rep teams, so it has no coach Schedule; the ratified row's
   "League Plus or Club" was corrected when logged); the public team feed rides Public link, which is already the family
   layer's (Premium / Club); the club admin's feed is deferred. **No new feature key, no new gate** — the gate is
   architectural. Read the entry and follow any newer one. This build never writes the strategy docs itself; `/billing`'s
   hand-off in that entry (what each feed re-checks on every read) is part of this build's gates.
3. **A new server secret** signs the coach's links (Part A2). It goes in `.env.local` for dev and in the Amplify
   environment for production **before the promote** — an owner step: write it into `MANUAL_PROD_STEPS.json` (or the
   release notes the release manager reads) as `pending`, and tell the owner. Rotating it stops every coach's link (say so
   in its comment).
4. **The UX summary for the owner comes first** (AGENCY_RULES), short and in owner voice:
   - **a coach:** Export at a desk gains "Subscribe in your calendar app"; on a phone the calendar mark opens a two-row
     menu (Subscribe on this phone · Download a copy (.ics)); the window shows their own link (Apple · Google · Outlook ·
     Copy), what's in it, how often it updates, whether a calendar has read it today, and Reset the link; the link stops if
     they leave the team; the download now carries tryout days and the organizer's games too;
   - **a family:** a Subscribe button on the team's public page, above the schedule, when the coach shares the schedule
     publicly (Public link); nothing else changes for families;
   - **everyone's calendar entries:** the team leads the title, "@" for away, cancelled events stay marked "Cancelled ·",
     arrival in the club's clock;
   - **not in this build:** the club admin's feed, the family view's door;
   - any departure from the drawings.
5. **One browser tester at a time.** Ask the owner before any capture, probe, `check:layout` sweep or `auth-setup`, and
   whether another session is measuring. A dev-server restart is owed before the walks (new files, a shared module, a new
   env var): ask before it. **Never reset the test club.**

## The code, read 2026-10-11 (re-grep before you trust a line number)

- **The feed route** `app/api/family/calendar/[token]/route.ts`: the read limit `:41`; the two token kinds (family link
  first, then the team-wide one); `getEnabledFamilyOrg` (premium + not cancelled); `getFamilyTeamView` with
  `requireVisibility`; `composeICSFromInstants` `:63`; **cancelled dropped `:65`**; the title (`— Practice`, always
  " vs ") `:68`; the defaults `:74` (1.5 h practice, 2 h otherwise); **arrival as stored `:76`**; `Cache-Control: private,
  max-age=300` `:89`. Header comment: visibility re-checked every read, no identity in the feed.
- **The composer** `lib/export/ics.ts`: `composeICSFromInstants` `:73` (UTC in → UTC out; `status` `:108`; `calName`
  `:110` — written per event, so an empty feed has no name); `downloadICSFromInstants`; `downloadICS` is for stored LOCAL
  date+time callers only (its header says which caller is which).
- **The read limit** `lib/no-login-token.ts`: `POLICIES` `:68` (`family_calendar` 240 / hour), `subjectKey` `:79` (a
  hashed IP), `checkNoLoginRateLimit` `:98` (an RPC that WRITES — `bump_no_login_rate_limit`,
  `supabase/migrations/215_…sql:204`), fail-open.
- **The control plane** `lib/family-access.ts`: `getOrgForGate` `:149` (returns null for a cancelled club — the chokepoint
  every family surface uses), `isPubliclyVisible` `:221`, **`ensureTeamCalendarToken` `:265` (rotates; no caller)**,
  `revokeFamilyLink` `:347` (nulls the family's token), `resolveLinkByCalendarToken` `:413`, `resolveTeamByCalendarToken`
  `:424`. The family's own mint: `app/api/family/teams/[teamId]/route.ts` POST (leave it — the family door is untouched).
- **The read plane** `lib/family-view.ts`: `EVENT_COLUMNS` `:81` (an allow-list: no description, no uniform),
  `getFamilyTeamView` `:190` (archived team → null; visibility; the live season `.in('status', ['active','draft'])`
  `:224`; every event of that season). Words `lib/family-schedule-format.ts` (the family's sentence "at {opponent}" —
  register R10; it stays on the page; the FEED says "@").
- **The coach's download** `lib/export/schedule-calendar.ts`: `DEFAULT_HOURS` `:36` (2 h for everything),
  `coachScheduleCalendarEntries` `:58` (title `name + opponentSuffix`, "Arrive by" through `formatStoredClock`, uniform and
  notes in the description, cancelled marked — D-2). `opponentSuffix` / **`sideWord` (`'@' | 'vs'`, neutral = vs)** in
  `lib/coach-tournament-games.ts:137`, `:146`. **The outside tournament's span:** `tournamentSpan` in
  `lib/coach-schedule-view.ts:82` (start day → end day in the club's zone).
- **The coach's Schedule** `app/[orgSlug]/coaches/teams/[teamId]/schedule/page.tsx`: the overlays — tryout sessions
  (`/tryout-sessions`, refused without the tryouts capability) and the tournament's games (`/tournament-games`) `:379-380`;
  `unmirroredGames` `:426`; `handleExportICS` `:677` (writes `events` only — S6D-05); `scheduleExportChoices` `:742`
  (Excel · CSV · Calendar, the last `phone: 'keep'`); `<CoachExportButton` `:748` (the phone's calendar mark,
  `phoneIcon`). The organizer's games' server read: `app/api/coaches/[orgSlug]/teams/[teamId]/tournament-games/route.ts`
  (`getRegistrationGamesForTeam`, `getSeasonTournamentHistoryForRepTeam`, `onOrAfterSeasonFloor`) — the feed reads the
  same function, never the route.
- **The Export control** `components/coaches/CoachExportButton.tsx`: `CoachExportChoice` (the phone rule `phone` `:63`),
  `CoachExportButton` `:92` (`variant` `:107`), `ExportChoiceDialog` `:261` (title, ×, FILE TYPE, full-width choices,
  no sentence under any); `.dialog { max-width: 360px; }` (`CoachExportButton.module.css:62`). It is shared by the
  Schedule and every Money tab (`MoneyExportButton` wraps it): the Subscribe row must be an opt-in prop no other caller
  sees.
- **Staff and capabilities:** `lib/coach-membership.ts` (`rep_team_staff_memberships` is the only access truth; revoke
  flips status, re-add reactivates; the live-season projection row is deleted on revoke), `lib/coach-capabilities.ts`
  (`schedule` `:74` — see the schedule; `tryouts` `:84` — head only in V1). Dictionary
  `DATA_DICTIONARY.md` `### rep_team_staff_memberships` (`:2376`).
- **The public team page** `app/[orgSlug]/teams/[teamSlug]/page.tsx`: the org by slug `:34` (**no cancelled-club check —
  D07 / S6D-09**), `publicSchedule` `:57` (Public link → premium → `getFamilyTeamView('public_link')`),
  `<RepTeamPublicSchedule` `:257`; the component `components/public/RepTeamPublicSchedule.tsx` (the kicker "Schedule"
  `:66` — the button goes on this line) and its module (dark public tokens). Proxy: read `proxy.ts` for `/{org}/teams/…`
  before adding a route under it.
- **The origin for a link:** `resolveTrustedAppOrigin` `lib/app-origin.ts:16` (the family mint uses it).
- **Help:** `lib/help-content/exports.tsx` `faq-exports-update` `:354` (the "planned for a future release" answer `:361`
  and its `answerText` `:365`); the coaches' schedule articles in `lib/help-content/coaches.tsx` (find the export /
  calendar subtopic); the public page has no article (a line in the family-facing help, if one exists — `/docs` decides).
- **The dead column:** `rep_teams.family_calendar_token_hash` (`DATA_DICTIONARY.md:2142`; mig 215) — never handed out
  (0 rows on both databases).
- **Migrations:** the latest on 2026-10-11 was `322_the_club_holds_its_time.sql` (permits); take the number **at the
  moment you write it**. `supabase/migrations/MANUAL_PROD_STEPS.json` entries are
  `"<file>.sql": { "prod": "applied|pending|held|unverified", "note": "…" }`.

## Part 0 · Record the rulings where the product reads them (its own commit, first)

- **`memory/design_decisions.md`**, newest first, and its line in `memory/MEMORY.md` in the same change:
  1. **A subscription lives behind the surface's one Export** (or its phone calendar mark), and on the schedule heading's
     line on a page without an Export (the public team page); never on a toolbar line (sentence (a)).
  2. **One Subscribe window for every feed:** it reads first; three equal app doors + Copy; what's in it; how often (the
     honest sentence); "Read by your calendar today" (recorded once a day); Reset the link ends the body in
     RecordAction's look and asks first; a floating "New link made" that fades; on a phone a tall menu-layer sheet (the
     Sheet Frame's test: nothing is typed), a record head, the bar live.
  3. **A link that is a credential** is shown again until Reset; a stopped link empties itself; a link never issued is
     "not found" (sentence (c)).
  4. **What feeds cost to serve** — the controls, ruled: the public feed cached, a four-hour refresh hint, the last read
     once a day, a read limit that writes nothing on a good read.
- **`docs/agents/design/TABLE_AND_LIST_STANDARD.md` §11.4** (new): the feed recipe **F1–F10** from the hub's specimen 5,
  each line with its reason (sentence (b)), and §11.3's "The Export menu and the calendar file" row gains Subscribe.
- **The plan** (§6 Stage 6d): nothing to add unless a precondition's answer changes something.

## What to build

### A · The feed (its own commit after Part 0)

**A1 · One set of feed words (F1–F10), one module, one table test.** Every calendar entry the product writes for a team —
the coach's feed, the public feed, the family's existing feed and **the coach's download** — goes through it:
- **F1 title:** "{team} · Practice", "{team} vs {opponent}", "{team} @ {opponent}" (`sideWord`: away → "@", home /
  neutral / unknown → "vs"), "{team} · {the event's name}" for anything else; a tryout day "{team} · Tryouts"; an
  organizer's game "{team} vs/@ {opponent}" with the tournament's name in the notes.
- **F2 cancelled:** kept; **"Cancelled · "** leads the title; `STATUS:CANCELLED`; shown as free time (`TRANSP:TRANSPARENT`).
- **F3 postponed:** not on a team's schedule today (rep events are scheduled or cancelled); the rule is written for the
  deferred club feed.
- **F4 when:** the instant; no end entered → a game 2 h, a practice 1.5 h (one default per kind — the download wrote
  2 h for everything); an outside tournament an **all-day** entry across `tournamentSpan`'s days (S6D-08).
- **F5 where:** "{venue} · {facility}, {street address}" (the recipe's place; the address lets a phone open directions).
- **F6 notes:** "Arrive by 5:30 p.m. (Eastern time)" — the arrival read from **either** stored form ("17:30" or
  "5:45 PM", both exist) and spelled through the house clock (`formatTime`, "8:00 a.m."), the zone read from the club
  (`timesInZoneSentence`'s name). **A coach's** feed and the download add "Uniform: …" and the event's notes; a family's
  carries arrival only (the family list's allow-list). A club slot adds nothing.
- **F7 a link back:** a coach's entry → the event in the portal; the public feed's → the team page.
- **F8 the calendar:** named "{team} · {club}" **even when empty** (write the header yourself if the library won't);
  `REFRESH-INTERVAL;VALUE=DURATION:PT4H` and `X-PUBLISHED-TTL:PT4H` — **four hours, never one** (the cost ruling).
- **F9 span:** a team's feed is the live season only (the season `getFamilyTeamView` reads).
- **F10 stopped:** see A2/A3. Each entry keeps the event's id as its identity, so a calendar moves a block rather than
  adding a second.
- **The table test** (run under `TZ=America/Toronto` and `TZ=America/Vancouver`, byte-identical apart from DTSTAMP, as
  the D-1 test is): practice; home; away; neutral; a named event; cancelled (title + status + free); an outside tournament
  over two days; arrival "17:30" and "5:45 PM"; an evening event after 8 p.m. Eastern lands on its own day; no end
  entered (both kinds); an empty feed still named; the hint present.

**A2 · A coach's feed (new).**
- **Storage (one migration):** on `rep_team_staff_memberships`, a **link generation** (integer, default 0) and **the day
  the link was last read** (date, nullable). One link per coach per team by construction (Ask 1). Removal
  (`removeStaffMember`) **bumps the generation** in the same write that revokes, so a re-added coach never revives an
  old link. Dictionary in the same change; `npm run refresh:snapshots`; `npm run check:dictionary`;
  `MANUAL_PROD_STEPS.json` `pending`.
- **The link:** `webcal://{origin}/…/{membership id}.{generation}.{signature}` (shape yours; record it), the signature an
  HMAC of the membership id and generation under the new secret (precondition 3). The server rebuilds it for its owner
  whenever the window opens; a database read alone cannot.
- **The read** (a route with no session — calendar apps send none): bad shape or bad signature → "not found" (counted
  against the abuse limit, A4). A good signature → the membership: revoked, a different generation, no `schedule`
  capability, the team archived, the club cancelled (`getOrgForGate`), the team not entitled, or no live season → **an
  empty calendar under the team's name** (Ask 9). Otherwise: every event of the live season, **plus** the organizer's
  games not yet copied (the same server read the Schedule's overlay uses, de-duplicated by `source_tournament_game_id`
  exactly as `unmirroredGames` does), **plus** the team's tryout days **only if** the membership holds `tryouts`, in the
  coach's words (F6 with uniform and notes). `Cache-Control: private, max-age=300`.
- **The last read:** on a good read, if the stored day is before today (the club's clock), write today — **at most one
  write per feed per day** (the cost ruling).
- **Reset:** a coach-only POST that bumps the generation and returns the new link; the old link then answers empty.

**A3 · The team's public feed (new).**
- **The address is the page's own:** `{origin}/{orgSlug}/teams/{teamSlug}/calendar` (or the nearest shape `proxy.ts` and
  the App Router allow — record it), **no secret, nothing to reset** (Ask 3).
- **One question, asked once:** a predicate shared by the page's schedule, its Subscribe button and this feed — Public
  link, the team entitled (`isFamilyLayerEnabled`), the club not cancelled (`getOrgForGate`), the team not archived, a
  live season — so the three can never disagree (S6D-09; it also closes D07's page defect: the page stops showing a
  Public link schedule for a cancelled club). An unknown org or team slug → "not found"; a known team failing the
  predicate → an **empty calendar** under its name (its families' entries leave).
- **Cached so every family shares one read:** `Cache-Control: public, s-maxage=300, stale-while-revalidate=600` (or the
  host's equivalent). **Verify on the host** that the CDN in front of the server honours it (a second request served
  without reaching the server — read the response's cache header on production after the promote); if it does not,
  memoise the composed calendar per team server-side for five minutes and say so.
- The family's words (F6 arrival only), the family list's events (no tryout days, no organizer overlay).

**A4 · The read limit writes nothing on a good read** (S6D-03). Count only refused reads (bad shape, bad signature,
unknown team) per caller address against the abuse ceiling; a good read is not counted. The family's existing feed keeps
its current limit unless the same change is trivially safe for it — say which.

**A5 · The family's existing feed** keeps working for any connected guardian (there are none outside the demo) and takes
the F1–F10 words: cancelled kept and marked, "@", arrival in the clock's spelling. **Its door and its mint are
untouched** (the family view waits for counsel; its rotate-per-press defect, S6D-02, is recorded as found-not-fixed and
belongs to the build that rebuilds that door).

**A6 · The dead column.** Nothing reads or writes `rep_teams.family_calendar_token_hash` after this build
(`ensureTeamCalendarToken` and `resolveTeamByCalendarToken` go; the old route's team-wide branch goes). **Dropping the
column is a separate migration applied last at a promote** (memory: a DROP-COLUMN migration goes on LAST) — ask the owner
whether to include it now or leave it for the release; the hub's "retires in the same migration" line is satisfied
either way. Dictionary updated.

### B · The doors (its own commit)

**B1 · The Subscribe window and sheet** (specimen 2) — one shared component for the coach (and, later, the club admin
and the family): the coach's **520** wide over the dimmed page (the portal's window); three equal app doors at 34 px —
**Apple Calendar** (the `webcal://` link), **Google Calendar**
(`https://calendar.google.com/calendar/r?cid=` + the encoded `webcal://` link), **Outlook**
(`https://outlook.live.com/calendar/0/addfromweb?url=` + the encoded `https://` link `&name=` the calendar's name); the
link in a read-only field with **Copy**; *What's in it* (with the season line); *How often* ("Your calendar app checks on
its own schedule: usually within a few hours; Google Calendar can take up to a day."); *Your link*; *Your calendar*
("Not read by a calendar yet." / "Read by your calendar today."); **Reset the link** ending the body (RecordAction's look,
no caption), opening the question (Cancel · Reset the link), then the floating "New link made" that fades. No foot; a
plain × closes it. **On a phone** (≤640): a tall **menu-layer** sheet (on top of the bar, the bar live — the Sheet Frame's
test), a record head ("Subscribe on this phone" over "{team} · Schedule") with its 44 px ×, four 44 px doors with **this
phone's app first** (an iPhone lists Apple first; anything else Google), Copy the link last; no colour marks a door.

**B2 · The coach's Schedule** (specimen 1): `CoachExportButton` gains an opt-in **subscribe** prop. At a desk the Export
dialog (360 wide, as built) shows, under a hairline after the three files, one row **"Subscribe in your calendar app"**
in the files' own card and ink, with its calendar mark and a chevron; it opens the window **in the dialog's place**. On a
phone the calendar mark opens a **menu drawer** headed by the small-capitals label "Calendar" (no ×), rows **Subscribe on
this phone** ("Stays current") and **Download a copy (.ics)** ("Today's schedule only") — the file unchanged. Only the
Schedule passes the prop; every Money tab is byte-identical (a guard says so). Shown to every coach with `schedule`.
**The download** (`handleExportICS`) now writes through A1, including the tryout days (when the coach runs them) and the
organizer's games (S6D-05).

**B3 · The public team page** (specimen 3, its public frames only): a 44 px **Subscribe** button at the right of the
Schedule heading's line, shown exactly when the A3 predicate holds; at 390 it opens a sheet (record head "Subscribe to
this schedule" over "{team} · {club}", ×, four doors this phone's app first, one sentence: the How-often sentence +
"Cancelled events stay, marked."), at a desk a panel under the button with the same choices. The page's dark public
tokens (one skin; no Warm/Dark pair). The list itself is unchanged.

**B4 · Help** (`/docs`): rewrite `faq-exports-update` (the snapshot answer stays for files; the subscription is named,
with the honest how-often sentence and "a feed is never how an urgent change reaches you"); a coach's article —
"Subscribe to your team's schedule" (what's in it, the apps, how often, Reset, it stops if you leave the team, a closed
season leaves your calendar); a line for families wherever the public page is explained. Keep "subscribe", "iCal",
"webcal", "calendar feed", "sync", "Google Calendar", "Apple Calendar", "Outlook" as search terms.

**B5 · Words** (`/marketing`): every Words-tagged sentence on the hub (the window's lead and lines, the drawer's two rows,
the public sheet's sentence, Reset's question, "New link made"), and the feed titles' "Cancelled · ". Draft, tagged;
never ship a placeholder.

## Walks

A new Owner QA ledger § (take the number **at the moment you write it**; grep the ledger before and after appending), as
checkable walks on the hub's QA tab under a "Stage 6d" group, one purpose each, with the sign-in card:
1. **The coach's Export at a desk:** the Subscribe row; the window (first time); Copy; the three doors' targets.
2. **The coach on a phone (390):** the Calendar drawer (the bar live); the Subscribe sheet as it opens and scrolled to
   Reset.
3. **Reset:** the question; the new link; the old link now returns an **empty** calendar (open both URLs in a browser:
   the old one downloads a named calendar with no events).
4. **What's in it:** open the coach's feed URL in a browser and read the file: the season's events, a tryout day (head
   coach only — an assistant without tryouts sees none), an organizer's game, a cancelled one titled "Cancelled · …",
   "@" on an away game, "Arrive by … (Eastern time)", the hint and the name.
5. **Removed means removed:** remove an assistant who subscribed → their URL returns empty; re-add them → the old URL
   still returns empty and the window shows a new link.
6. **The public team page:** set a test team to Public link → the Subscribe button and its sheet (390) and panel
   (1440); set it back to Families → the button goes and the feed URL returns empty.
7. **A desktop calendar app on dev** (if the owner has Apple Calendar on a Mac or Outlook desktop): subscribe to the
   coach's `http://localhost` URL; move an event in the portal; the app shows the move at its next refresh.
8. **After the promote, on production (the post-release truth-up):** subscribe from **Google Calendar** to a real
   team's public feed and a coach's feed; record how Google shows a cancelled event and how long a move took to arrive;
   confirm the public feed is served from the cache on a second request. Help's wording follows what this walk shows.
9. **Dark:** every new frame.

## Gates

- `npm run verify:changed`, `npm run typecheck` (after `npx next typegen`), the targeted unit files, `check:dictionary`,
  `check:spelling` (the house clock), `check:css-selectors`, `check:contrast` + `check:text-contrast`, `check:old-look`,
  `check:export-catalog` (the coach schedule entry's help summary says Subscribe exists).
- **The feed-words table test** (A1); **the link test** (a tampered signature → not found; an old generation → empty;
  revoked → empty; `schedule` off → empty; re-added → the old link still empty); **the one-question test** (the page, the
  button and the public feed read one predicate — a guard that no second copy exists); **the read-limit test** (a good
  read writes nothing; a refused one is counted); **the last-read test** (two reads on one day → one write); **the
  download test** (tryouts and organizer games present; D-1's evening case still on its day); **the Export guard** (only
  the Schedule passes `subscribe`; Money tabs unchanged); the D-1 / D-2 tests still pass.
- **`check:layout`, both themes,** on every touched screen (ask the owner first; `--only=` batches): the coach's Schedule
  at 1440 / 768 / 390 with the Export dialog, the drawer, the window and the sheet; the public team page at 390 and 1440;
  new baseline entries with reasons.
- Then `/simplify`, `/review` at the **high-risk** tier (a migration, a credential and a public no-login route, a shared
  export control, the family feed's words), and a `/design` review of the built screens against the hub at 1440 and 390.

## Hand-off

- An owner-voice summary; the walks to run (and that walk 8 waits for the promote); departures from the drawings;
  anything found and not fixed (at least S6D-02's family door).
- The plan record (§6 Stage 6d: a "🔨 6d BUILT" block), the PM brief's 6d row, memory `project_club_stage6d_feeds`, the
  TODO line, `MANUAL_PROD_STEPS.json` (the migration and the secret, both `pending`), and the hub's QA tab republished at
  the same address (read it fresh first; the session's first publish may need the live copy READ in full — memory
  `reference_artifact_publish_needs_full_read`; parse every script before publishing).
- **A note for the deferred club feed** under the plan's Stage 6d record: the shared window's props, the feed-words
  module, the link scheme (the club admin's link needs its own home — the membership columns are a coach's), and S6D-13's
  read window.
- **Commit only when the owner says**, from a private index with this session's files and hunks only; Part 0, Part A and
  Part B are three commits. Export and typecheck the staged tree before committing; after it, `git reset -q -- <paths>`
  on the shared index.
