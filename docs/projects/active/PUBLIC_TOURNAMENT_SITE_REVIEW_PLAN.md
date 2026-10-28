# Public tournament pages — the redesign plan

**Status: DRAWN 2026-10-27 (round 1: the walk, the end state, Stage 1 the frame; Stage 1a; round 2: every public
page's whole-screen end state, asks 14–17). ALL 17 ASKS RULED 2026-10-27 as recommended (§10). Nothing built.**
Logged
2026-10-24 by the owner while walking Club Tier Stage 4d. Codex wrote a first-pass review the same day
(`PUBLIC_TOURNAMENT_SITE_REVIEW_FINDINGS.md` + `_DRAWINGS.html`); this plan is the Claude second review. It keeps
what Codex got right, corrects what the code contradicts, and sets the stage ladder.

- **Hub (the mockups, the walk, the asks):** `PUBLIC_TOURNAMENT_SITE_REVIEW_HUB.html`, published as a Claude Artifact.
- **PM brief:** `PUBLIC_TOURNAMENT_SITE_REVIEW_PM_BRIEF.md`.
- Not a gate on Club Tier. Ask A (the club's Tournaments tab) is Club Tier Stage 4f, committed `f818df35e`
  2026-10-25, and is treated here as existing.

---

## 1. What the owner asked for (record, unchanged)

1. **A review of the public tournament sites**, content and flow.
2. **Mainly: simplify the phone experience.** Text-heavy areas first. "Simplify" does not mean "remove".
3. **Sponsor sections on tournament pages**, as the club now has (Stage 4d).
4. **Tournament → club link as advertising for the club** (Ask B). Ruled 2026-10-24: Ask A (the Tournaments tab
   in the club's top row) is Club Tier Stage 4f; Ask B stays here.
5. Logged finding 2026-10-25 (Club Tier 12a walk E4): the team pay page's date/countdown line printed over the
   page heading, and the tournament sidebar sits beside a payment page.

## 2. What the walk found (Claude, from Codex's captures + the code)

Measured on the demo at 390px (captures in `.probe/public-tournament-review/`, gitignored):

| # | Finding | Evidence | Severity |
|---|---|---|---|
| W1 | **On game day the next scheduled game is about 1,950px down the phone home** (≈2,070px with the demo tour bar). Above it, in order: header, tabs, ticker, follow/share, Live now, "Tournament Day / What To Check Now" + a Full Schedule button, a "Follow your team" card inside a card, four Latest Finals cards, an Event Snapshot of four rows that repeats the sections around it. | capture `riverdale-minor-ball_summer-classic_390.png`; `TournamentHomeContent` render order | Blocks the job |
| W2 | **Empty parts render as large cards.** Before the event, "No announcements yet" and "No upcoming games yet" are each an icon, kicker, title, paragraph and button, about 700px together, and then a "Full Schedule" button leads to an empty schedule. The club frame's rule is the opposite: a part with nothing to show is absent. | `invitational_390.png` | Slows the job |
| W3 | **The same moment has four names.** "Game day" (phone header chip), "In progress" (desktop chip), "Tournament Day" (home heading), and "Live" on the club home for any active tournament, including one three weeks away. The club's 4f Tournaments tab already uses Live now · This weekend · Registration open · Finished. | captures + `app/[orgSlug]/page.tsx:225` | Slows the job; a one-spelling bug |
| W4 | **"Hard on the eyes" is mostly type and ground.** IBM Plex Mono in capitals for the org line, the dates, every tab label, the ticker, buttons and table numbers (38 rules in the schedule styles alone); a near-black ground with lime and 40–60% white text; cards inside cards. These pages are read outdoors, in daylight, on a phone. | spec extraction; Public Face Warm Q6 audit row | Slows the job |
| W5 | **Repetition:** the ticker and Live now show the same two games one above the other; the bottom "Explore" row of buttons repeats the tab row (Rules is already a tab); the Event Snapshot repeats Upcoming and Results. | captures; `TournamentTopTabs` order | Slows the job |
| W6 | **Desktop:** the giant centred hero repeats the name the side rail already shows, and the rail's panel stops partway down the page. | `riverdale-minor-ball_summer-classic_1440.png` | Cosmetic |

### Defects found under the redesign (Stage 0: these are bugs, not design)

| # | Defect | Cause in code | Note |
|---|---|---|---|
| D1 | **A schedule the organizer has not published still reaches families.** The Overview lists every game; the schedule page shows "coming soon"; the team page says 0-0-0 and "No games scheduled yet". | Home reads `getGames(..., {admin:true})` with no publish check (`TournamentHomeContent.tsx:51`); the schedule and scores feeds send every game to the browser and the page hides them (`lib/public-tournament-data.ts:174-189`); the team profile gates on the server (`app/api/public/team-profile/route.ts:57`). The demo seed never sets `scheduleVisibility`, so it defaults to unpublished. | **Codex called this a fixture problem. It is not:** any customer with an unpublished division gets it. The publish gate belongs on the server, in every public read (home, schedule, scores ticker, team profile). Then fix the demo seed. |
| D2 | A game that is live by the clock but has no score prints a lone "–". | `TournamentHomeContent.tsx:322` prints raw nulls | Show "No score yet". |
| D3 | The club home (fallback list for an org with no club site) labels every active tournament "Live", even one weeks away. | `app/[orgSlug]/page.tsx:225-227` hard-codes it; the date-aware chip exists in `lib/club-site-home.ts:33-56` | Use the 4f chip words. |
| D4 | "First pitch in 20 days" is written for one sport. | `TournamentNavStatus.tsx:80`, `TournamentHomeContent.tsx:483, :977`, `Countdown.tsx` | Sport-neutral rule: "Starts in 20 days" / "First game in 20 days". |
| D5 | The standings table pins Team only; the 2026-06-01 ruling pins Team left and PTS right. | spec extraction, `standings.module.css` | Drift from a ruling; fix with Stage 4. |
| D6 | The pay page overlap: **the fix is committed** (`ced733337`, 2026-10-27, a page offset in `TeamPayContent.tsx`), not only in the working copy as Codex wrote. The page still renders inside the full tournament layout (rail, ticker, my-team dock). | `pay/[token]/page.tsx` has no layout of its own | The overlap needs a walk with a real token; the shell is Stage 1. |

## 3. Codex's review: where it holds and where it does not

**Holds (adopted):** the core problem is chrome and repetition before the useful content, not missing information;
keep the event's own structure (header, tabs, the global phone bar, the dock), do not copy the club frame wholesale
(Codex's Direction B, rejected); standings stays a table; the pay link opens a focused page; a club sponsor is not
automatically a tournament sponsor; the host link appears only when a real club page exists; nothing is removed
outright.

**Does not hold:**
1. **D1 is a real defect** (above), and it is the most important thing the review turned up.
2. **The light ground is not "superseding an old dark-ground handoff". It reverses two standing rulings**, and the
   owner should rule it knowingly: Tournament Nav Unification (2026-07-20) says "do not warm-theme tournament pages",
   and Club Tier Stage 4 Ask 1 kept tournament pages "the venue", as a family "would walk into a venue". This plan
   recommends the reversal on merit (§4), but as an explicit ask.
3. **"Warm paper" is a third ground.** Continuity with the club means the club frame's own ground, cards, ink and
   colour roles, not the marketing palette (`#F8F4ED`), which the club pages do not use either.
4. **Codex's drawn header loses the organizer.** A paper header with a small mark gives the organizer's colour almost
   nothing to do, which weakens TH-1 ("the organizer's brand wins"). The venue feeling was always the organizer's
   colour and name, not the darkness. This plan keeps it as a colour band.
5. **The host card at the end of the Overview is the right idea, but too small an answer.** On game day few scroll
   that far, and "Visit the club" is a back link with a bigger button. §6 widens it.
6. **"One sponsor list per tournament, managed separately"** makes a club enter the same business twice. §7.
7. **Empty parts:** Codex shrank the empty cards but kept placeholders ("Games are being scheduled / Check back
   soon"). The club rule is that an empty part is absent.

## 4. The recommendation: the venue keeps its colours, on the club's daylight ground

**One sentence:** a tournament page becomes the organizer's colour band over the club frame's light ground, with the
club's type, the club's white tab row, and the club's footer shape; its own pages, tabs and game-day tools stay.

- **Ground and cards:** the club frame's tokens exactly: ground `#F6F5F2`, white cards with a 1px hairline, ink
  `#1F1B16`, no shadows, no tints. Same tokens, so club → tournament is one place.
- **The band (replaces today's event header):** the club bar's shape, 72px on a phone, logo 44px (or initials when the
  plan allows a mark and there is no logo), the event name in the title face (2 lines max), one line under it: dates
  and the state chip. The band scrolls away; the white tab row (44px) pins, as on the club site.
- **Colour roles:** the organizer's colour goes through the same derivation as the club's (`clubColourRoles`): fill,
  text on fill, ink (4.5 : 1), edge (3 : 1), accent as decoration only. Which colour a club's tournament wears is
  §4a; a standalone paid organizer uses its saved tournament colour; **a free event gets a neutral ink band
  (`#1F1B16`, white text) and no mark**, which keeps the rule that a free event carries no host logo or custom colour.
  Nothing depends on a club existing.
- **Type:** Barlow Condensed 700 for titles, Inter for everything else, sentence case. **No typewriter face.** Scores
  and table numbers use tabular figures (big scores in the title face). This reverses the G4 label system (uppercase
  mono kickers) for public tournament pages; Public Face Warm Q6 ruled that the type is this project's to decide.
- **The organizer's Dark / Light switch goes away** (it is a Tournament Plus option today). That is the cost.

**Why, on merit:**
- These pages are read outdoors in daylight on phones: dark text on a light ground holds up in sun; 40–60% white on
  near-black does not.
- The reason the venue rule exists ("you step into the tournament's own page") is kept by the band: the organizer's
  colour, name and logo are the first 72px.
- The club and its tournament stop looking like two products, which is the continuity ask.
- It removes the separate light-mode token set and the "lift toward white" colour recipe, so tournaments and clubs share
  one colour system.

**What the owner gives up:** the dramatic dark game-day look and the organizer's dark option. If the owner wants that
kept, the fallback is option B in Ask 1 (light by default, dark still offered).

## 4a. Who owns the look: a club's tournaments vs a standalone organizer's (Stage 1a)

Added 2026-10-27 at the owner's question ("can clubs enforce club branding on their tournaments, make it optional?").
Round 1 had assumed it in one line. Census of the code and both admin screens (captures in `.probe/branding-flow/`):

**Today.** The club sets Logo, Colours, Type and Banner on its Public site editor (`LookPanel`, owner or admin; the
public site exists on League Plus, Club and Club · Association). Each tournament has its own Branding page, also titled
"Public site" (owner, admin, or a coach granted the tournament via `manage_branding`): Logo, App icon, Theme
(presets, custom, Dark/Light), Hero banner, Font, Card style. The read rule is already "the tournament's own, else the
club's" for colours, logo, banner and card style (`lib/public-tournament-theme.ts:21-58`, layout :154, :262). There is no
host field, no club policy, and nothing on either screen tells the club its tournaments inherit. Standalone tiers brand
per event by a ruled business decision ("tournament tiers are not orgs-with-a-brand", `BUSINESS_DECISIONS.md:2300`).

**Defects found:**
- **D7, inheritance locks itself off.** The Branding page drafts an unset theme as `'platform'` (`branding/page.tsx:95`)
  and every autosave sends the whole draft (`bodyOf` :109-125), so any save, even a Pages switch, writes
  `theme_preset='platform'` and the club's colours stop applying. The Theme card also shows the platform swatch as
  chosen when nothing is. Stage 0: write theme fields only when the theme changed.
- **D8.** `theme_font` is saved but never read publicly; the org font always applies.
- **D9.** `app_name` is saved but shown nowhere (install prompt and iOS name are fixed); G1 in
  `PLAN_PRICING_FACTS.md` may give it a job.
- **D10.** The tournament share image reads the tournament's raw theme with no org fallback and no plan check.
- Tournament emails (registration, acceptance, payment, schedule) use the plain platform envelope; the club's own
  family emails wear its band (`lib/email-club-identity.ts`).

**Recommendation:**
1. **A club rule, one new row on the club's Public site, "Tournaments"**, built like "Coaches on team pages"
   (`lib/coach-names-policy.ts`), drawn with its shipped parts (BuilderRow, the SendRows radio list, KitDialog
   question): *Club's look by default* (a tournament may choose its own) or *Always the club's look*. It is applied at
   read time and **never writes a tournament's own saved look**; switching back restores each one. *Always* asks first
   when tournaments have their own look today, naming them; the choice does not move until confirmed.
2. **Under the default**, the tournament's Theme card gets a real first choice, "The club's colours", chosen when
   nothing is saved, with a live band preview. Its swatches become the club Look card's control made shared (two-tone,
   double ring), so both screens pick colour the same way. Logo and Hero banner show "The club's logo / banner".
3. **Under "Always"**, the tournament's colour, type, banner and card-style cards give way to one plain lock line, with
   "Change the club's look" only for those who may (absent, not greyed), and the **logo stays the tournament's**
   (recommended; Ask 10).
4. **Standalone (Tournament Plus):** unchanged per-event control, on the club's picker with the preview. Free: the
   existing lock line.
5. **Type:** tournaments use the club's three type looks; the font list goes (it does nothing today). **Card style goes**
   (dark-ground era; the club frame has one card): listed as content that goes. **App name** hidden until it has a job.
6. **Emails and link previews** wear the page's look (club band, event colours, or platform for free). Later stage.
7. **Changing the club's look later** changes every tournament that follows the club, finished ones included; one with
   its own look keeps it.
8. **Hosted by** shows on every club tournament whichever rule applies.
9. **Naming:** the club's "Public site" and a tournament's "Public site" are different screens with one name; a
   `/marketing` question.

## 5. The Overview (end state, both states)

**Game day, phone, top to bottom:** band → tabs (pinned) → *My team* (one line when not following: "Follow a team to
see its next game here"; when following: next game, time, field, Directions) → **Live now** (one card per game: teams,
scores, field, Directions) → **Up next** (the schedule's row recipe, 4 rows, "Full schedule") → **Latest results** (3
rows, "All results") → **News** (only when there is any) → **the host card** → **Sponsors** (only when there are any)
→ **footer** → the global phone bar.

- The ticker does **not** show on the Overview (Live now is the fuller copy of the same thing); it stays on every other
  tab.
- **Goes from the Overview, and where each fact still lives:** Event Snapshot (registration → absent once closed;
  today's count → Up next; results → Latest results; field → every game row and the footer); "Tournament Day / What
  To Check Now" heading; the Explore button row (every page is a tab, and the footer lists them); empty News / Upcoming
  cards (absent). The org eyebrow moves from the band to the host card and the footer on a phone, and to the band's
  right side on a desk.
- Measured in the drawing: the first Up next row starts at about 600px (from about 1,950px).

**Before the event:** band (chip "Registration open") → **Register card** (starts date and countdown, "11 of 16 team
spots taken" from data, *Register a team*, one line about the free Coaches Portal) → **facts list** (Divisions,
Where + Directions, Schedule: "Posted before the event" while unpublished, Rules) → **host card** (higher, because
attention is free before the event) → News if any → Sponsors → footer.

**After the event:** champions first (Champions recap), then final standings door, host card, sponsors, footer.

**Every other page (round 2, 2026-10-27):** the whole-screen end state for Schedule (+ its options sheet and a
1280px desk frame), a game's page, Standings, Playoffs, Teams (360px, long name), a team's page, News, Rules (free
event), Register (open + closed) and Champions (pale colour) is drawn on the hub's **Every page** tab, before and
after, with one measured number per page. All drawings are the **phone-browser** view (no app bar; Sign in in the band,
the club bar's plain word); the end-state tab adds one inside-the-app Overview with the bar. What the census of the
shipped pages changed in the drawings, and what the drawings decide:
- **Schedule:** two control rows (division dropdown + the shipped "My games" pill; the shipped Pool play / Playoffs
  sliding track on light + search symbol + the calendar symbol), the shipped day chips, today's finished games folded
  into one "Earlier today" row (new), the live game as a Live now card, rows in the Overview recipe. **No field or
  team filter exists today and none is added. No options sheet:** after the owner's notes (below) it would hold only
  List/Bracket, which goes with the bracket to Playoffs (Ask 15); the Playoffs half lists the playoff games and ends
  with a door to the bracket. The year picker has been switched off on public pages since 2026-06-03 and stays off.
- **Owner direction 2026-10-27 (on round 2): alerts only inside the installed app.** No alerts control on a public page
  opened in a browser, phone or desk (the schedule's Alerts pill, the team page's bell). This replaces, for browsers,
  the Rain Delay A2 placement of the fan bell "on every public tab, mobile + desktop" (`memory/design_decisions.md`).
  Cost named: Android browsers can receive alerts without installing; under this direction those parents install the
  app to get them, which fits §10a ("installing becomes the reason for the bar").
- **A game's page:** when/where + Directions (primary, worded) first; "Final" stops being a round name (today a
  "Final" chip sits beside "Live" on a game in play); no ticker.
- **Standings:** table first, Team + PTS pinned (D5), legend + tie-breakers behind a tap; **the bracket moves to
  Playoffs** (today it lives on Standings, and opens *above* the table once the playoffs start; Playoffs has no bracket
  drawing). Ask 15.
- **Tabs follow content (Ask 14):** News/Rules hidden when empty (today they always show, with an empty card);
  Register a tab while open and Champions a tab from the first title (**neither is a tab today**).
- **Rules:** tap-open sections; the phone drops the jump chips because the closed list is the index (differs from the
  session brief; each section keeps its own link). Desk keeps the chips.
- **The ticker** also leaves the Schedule and a game's page (Ask 17).
- Measured (drawn): Schedule first game row 394px (today: no games, D1); Directions on a game 303px (≈730); Standings
  first row 310px (≈735); next playoff game 270px (≈1,190); Teams 4 of 8 on the first screen at 360px (3 at 390px);
  a team's next game 352px (today none, D1); newest news post 181px; Rules 7 of 9 section names with one open;
  Register form 392px; first champion 136px. The hub prints these from the drawings.

## 6. Ask B: the club as advertising (widened)

The owner's point is that strangers should **find the club**. A link back is not that. What a club can honestly offer a
visiting parent is **what is open right now**: a tryout, a house-league sign-up, the club's teams. The club home
already leads with that list (Stage 4 Ask 3).

**Recommendation, three places, all absent when the organizer has no public club page:**
1. **The host card on the Overview**: club logo tile and name, "Open now at Riverdale: U13 tryouts · House league
   sign-up" (from the club home's own open-now list, nothing typed for it), and a *Visit the club* button. Game day:
   after the results. Before and after the event: right after the register card or the champions.
2. **The footer on every tournament page**: "Hosted by Riverdale Minor Ball Association" with a link. This is the
   continuity piece: the club's footer and the tournament's footer look alike.
3. **Desktop band**: "Hosted by {club} ›" on the band's right side.

A tournament-only organizer (no club site) gets the footer line as plain text and no card. An org with two or more
tournaments but no club site keeps today's link to its tournament list. When the open-now list is empty, the card
reads "Riverdale Minor Ball Association runs teams and programs all year" and the button.

## 7. Sponsors

> **Owner's note with Ask 5 (2026-10-27):** "this applies similar logic to branding, organization can put their sponsors
> there or let their tournament organizers put their own. Tournament organizers not linked to club get their own
> sponsors section." The drawing of that choice (where the organization's choice lives, what a tournament organizer
> sees under each) belongs to Stage 7 and is not drawn yet; the plan gate is still `/strategy`'s.

- **One list per organization, and each sponsor says where it shows:** the club site, and/or chosen tournaments.
  Today's list is the club's (`org_public_site_content.sponsors`, at most 20, no tiers, ended ones hidden). A club adds a
  business once and ticks the tournaments it backs; a tournament-only organizer uses the same list for its events only.
- **Where:** a Sponsors strip at the foot of the tournament Overview, above the footer: the club strip itself (2 tiles a
  row on a phone, equal size, no tiers). Overview only, as the club shows sponsors on its home only.
- **Which plans:** an owner + `/strategy` call. Today a free event cannot show its own host's logo; showing sponsors'
  logos there would look inconsistent. **Lean: sponsors follow the Tournament Plus branding gate**; on a free event the
  editor shows them locked with the plan that includes them. No pricing restated here: see
  `docs/agents/strategy/PLAN_PRICING_FACTS.md`.
- **Needs new work:** where-it-shows on each sponsor, the editor control, an org with no club site getting a sponsor
  list, and the Overview strip.

## 8. The pay page

A focused page: a slim band (the organizer's colour, event name, no tabs), no side rail, ticker, my-team dock, follow
nudge or demo pitch, then the existing pay block unchanged, then the footer without the page list. The overlap fix is
committed (D6); it gets walked with a real token in the same walk.

## 9. Stage ladder

**Structure accepted by the owner 2026-10-27.** All asks are ruled, so no stage waits on a ruling except where named.
Sequenced by dependency and rework risk, never by date.

**Two rules for the whole ladder:**
- **Everything from Stage 1 on is built behind a preview switch** (on for the owner, dev and a preview link; off for
  customers and the public demo) and turned on for everyone once, in the last stage. Why: every page today is built
  from dark-ground colours (light text, lime, faint white borders), so the light frame cannot ship alone without a
  half-converted public site, demo included, for as long as the pages take.
- **One page group at a time, walked before the next starts.** Each stage: a build prompt written from the drawings
  (the whole-screen drawings are the spec; a close-up drawing only for a control the owner has not seen up close) →
  the build, in session-sized chunks with a `/clear` between them → `/review` → a QA walk → the owner walks it on
  the preview → the next stage. Pages that share a rule move together (the bracket move; the tab rule).

| Stage | Covers | Ships to customers | State |
|---|---|---|---|
| **0 · Trust fixes** | D1 publish gate on the server in every public read + demo seed; D2 "No score yet"; D3 the club fallback chip; D4 "Starts in"; D7 the Branding page writes the theme only when it changed | **Yes, on its own** (no visual change) | **Go (Ask 7).** Build prompt: `PUBLIC_TOURNAMENT_STAGE0_BUILD_PROMPT.md` (two sessions). **Part 1 (D1) committed `7e5a6eff0` + `bf95ebacd` 2026-10-27**, /review done, walk §406 ✅ 14/14 2026-10-27; prod impact read-only 2026-10-27: no customer event (only the demo). **Part 2 (D2–D4, D7) committed `f8525e019` 2026-10-27**, /review done (its three missed live-score surfaces fixed in the same commit), walk §407 ✅ closed on the owner’s word 2026-10-27 (C4 + D2–D6 not exercised on dev); prod read-only 2026-10-27: 0 of 6 tournaments on branding plans carry an accidental platform theme. **Stage 0 is built; next = the Stage 1 build prompt.** **Follow-up (owner 2026-10-27, its own step):** the database still lets the public key read every game, and the live bracket refresh relies on it — a permission change with `/db`, planned separately |
| **1 · The frame + readable baseline** | Ground, band, tab row, type, colour roles (club / paid standalone / free), state words, footer with host line, the app bar by where a page is opened (Sign in in the band in a browser), desk band + rail on light; **every page's current content made readable on light, no layout change**; the preview switch itself. **The ticker:** restyled here (shared chrome), and the owner's Ask 17 note is due here: propose better versions (e.g. a soft scoreboard) before building it | Behind the switch | Ruled (Asks 1, 2, 8, 16, 17). **Build prompt written 2026-10-27:** `PUBLIC_TOURNAMENT_STAGE1_BUILD_PROMPT.md` (four sessions; Part 2 draws the ticker options for a ruling before Part 4 builds it). **Part 1 (the switch, the frame on a phone) committed `21dac8e87` 2026-10-28. Part 2 (the desk, the footer, the admin preview) committed `b7639fe83` 2026-10-28**; ticker options drawn 2026-10-28 (https://claude.ai/artifact/8rt2PdvZEV617tdrDDG35H), owner ruling owed (second opinion first). **Part 3 (the readable baseline A: Overview, Schedule, a game, My Team, Register) committed `d2b80b61a` 2026-10-28.** Next: Part 4 (needs the ticker ruling) |
| **2 · The Overview** | Game day, before, after; absent beats empty; ticker off; host card. **Builds the shared parts** later pages reuse: the game row, the Live now card, the tap-open row, the door row | Behind the switch | Ruled (Asks 3, 4) |
| **3 · Schedule + a game's page** | Two control rows; day chips; finished games fold; the Playoffs half; no ticker; where/when + Directions first on a game | Behind the switch | Ruled (Ask 17) |
| **4 · Standings + Playoffs** | Team + PTS pinned (D5); legend and tie-breakers behind a tap; **the bracket moves to Playoffs** (one stage, so it is never on both or neither); next game first; "How seeding works" behind a tap | Behind the switch | Ruled (Ask 15) |
| **5 · Teams + a team's page** | Grouped rows, the star alone, next game first; no alerts control in a browser | Behind the switch | Ruled |
| **6 · News, Rules, Register, Champions** | **Tabs follow what there is** (one rule, one stage); rules as tap-open sections; register card + the form unchanged; the champions recap | Behind the switch | Ruled (Ask 14) |
| **7 · The pay page** | The focused page (§8); walk the 10-25 overlap fix with a real link | Behind the switch | Ruled (Ask 6) |
| **8 · On for everyone** | Remove the switch and the dark-ground code it kept alive; `/docs` (the help guides mention the dark/light switch and the public pages); `/demos` (the demo's story); one release | **Yes** | — |
| *Side · 1a Who owns the look* | §4a: the club rule, the tournament Branding page under each rule, type looks, card style goes, app name hidden; D8–D10. Starts after Stage 1 (its preview uses the new band) | Admin screens: with Stage 8, or alone if they read right on today's pages | Ruled (Asks 9–13) |
| *Side · Sponsors* | §7 + the owner's Ask 5 note (organization's sponsors or the organizers' own, like branding); the plan gate is `/strategy`'s first. Any time after Stage 2 | With Stage 8 | Ruled (Ask 5); the choice is not drawn; gate owed |
| *Later · Emails and link previews* | Ask 12: they wear the page's look | Own release | Ruled (Ask 12) |

After each built stage: `/review`, then a QA walk; `/docs` and `/demos` run once, at Stage 8 (the public pages do
not change for customers before then), except Stage 0, which checks the help guides for the countdown words.

## 10. Asks for the owner (ranked by how much they change)

> **RULED 2026-10-27 (owner, paste-back from the hub): every ask 1–17 as recommended**, with two notes, verbatim in
> substance: **Ask 5** — sponsors follow branding's logic: the organization can put its sponsors on its tournaments or
> let its tournament organizers put their own; an organizer not linked to a club gets its own sponsors section (§7).
> **Ask 17** — when the ticker's stage comes, propose better versions of it, visually or functionally ("maybe like a
> soft flashing scoreboard"); something to review for enhancement. Logged in `memory/design_decisions.md` 2026-10-27
> with the rulings this reverses (Nav Unification, Stage 4 Ask 1, G4, Stage 4 Ask 8's tournament half, the Rain Delay
> A2 bell for browsers). The options below are kept as the record of what was offered.

1. **The ground.** A) Light for every tournament, the organizer's colour as the band; the dark/light switch goes
   *(recommended)*. B) Light by default, dark still offered to paid organizers. C) Keep dark; fix only order and type.
   Reverses Nav Unification's "do not warm-theme tournament pages" and Stage 4 Ask 1's venue carve-out (its reason is
   kept by the band).
2. **The type.** Retire the uppercase typewriter labels on public tournament pages; club type everywhere
   *(recommended)*. Reverses G4 for these pages.
3. **The Overview order** in §5, the ticker leaving the Overview, and empty parts absent *(recommended)*.
4. **Ask B as §6:** host card with the club's open-now list + footer line + desk band link *(recommended)*, or
   Codex's card at the foot only.
5. **Sponsors:** one list with where-it-shows *(recommended)* vs a separate tournament list; and the plan gate, routed
   to `/strategy`.
6. **The pay page** as a focused page *(recommended)*.
7. **Stage 0 goes now**, ahead of the design rulings, because D1 shows families a draft schedule *(recommended)*.
8. **One set of state words:** the 4f chips (Live now · This weekend · Registration open · Finished) on the band, the
   club home and the club's Tournaments tab *(recommended)*.
9. **The club's rule for its tournaments** (§4a): a two-choice club setting, default "the club's look unless a
   tournament chooses its own" *(recommended)*; or always the club's; or no club rule.
10. **Under enforcement, the event logo stays the tournament's** *(recommended)*, or the club's logo too.
11. **Retire what doesn't fit or does nothing:** club type looks for tournaments, Card style goes, App name hidden
    *(recommended)*.
12. **Emails and link previews wear the page's look**, a later stage *(recommended)*.
13. **Who sets the rule:** the owner and admins who edit the club's Look *(recommended)*, or the owner only.
14. **Tabs follow what there is** (round 2): News and Rules hidden while empty; Register a tab while registration is
    open; Champions a tab from the first title, second after Overview *(recommended)*; or only hide News/Rules; or
    today's tabs.
15. **Where the bracket lives** (round 2): on Playoffs under the next game, Standings ends with a door to it
    *(recommended)*; or always below the Standings table behind a tap; or as today (above the table once playoffs start).
16. **The web app opened in a phone browser** (§10a): nothing extra, the page behaves like a website and back returns
    *(recommended)*; or a thin "Back to FieldLogicHQ" line; or keep the app bar when opened from the web app.
17. **The ticker** (round 2): also off the Schedule and a game's page, kept on Standings, Playoffs, Teams, team pages,
    News, Rules *(recommended)*; or off the Overview only (round 1); or everywhere.

## 10a. Raised by the owner 2026-10-27, after round 1

- **The end state covers only the Overview.** Round 1 drew the Overview (game day, before, desk) and the frame. The
  end state should show **every public page as a whole screen**, before and after, so the cumulative result can be
  judged before any stage is ruled: Schedule, game detail, Standings, Playoffs, Teams, team page, News, Rules,
  Register, Champions, pay. Detailed controls stay with their stages (3–6). **Drawn 2026-10-27 (round 2), hub tab
  "Every page"; see §5.**
- **The app's phone bar on club and team pages (proposed follow-on, not ruled).** Tournament pages keep the platform
  phone bar (Home · Scores · Sign in signed out; Home · Scores · Account signed in; Chat hidden while paused). Club pages
  dropped it (Stage 4 Ask 8), so a parent on a team page has no bar. The owner's direction: this is where parents sign in,
  see their kids' schedules, follow teams and tournaments, and later talk to the coach. Claude's read: the real question
  is **where a parent lives on a phone**, not one footer.
  - *Claude's first proposal (withdrawn the same day):* no bar for strangers on club pages, the family bar for
    signed-in visitors. **The owner's objection holds:** a stranger who arrives from the app loses the way back, and
    club → tournament (both public pages of one club) would make the bar appear and vanish, which is the very
    discontinuity this project removes.
  - **Owner's refinement, same day — DIRECTION ACCEPTED by the owner 2026-10-27 ("I think this is the right
    direction"); the sub-points below are not ruled: the bar follows WHERE the page is opened, not which page it is.** In a phone browser, club and tournament pages are a website: no app bar on either (consistent between
    them; Stage 4 Ask 8's reason holds). Opened inside the installed app (today the installed FieldLogicHQ web app;
    later the store apps), every page has the app bar. Claude's read: workable and better than both earlier shapes.
    Technically, an installed web app can be recognized by the page itself as it first draws (the "standalone" display
    mode), so there is no flicker; a store app identifies itself when it opens pages. Nothing detects it today: new work,
    small. What it changes and leaves open:
    - It **also takes the bar off tournament pages in a browser**, the half of Ask 8 that kept it ("where Scores is the
      point"). Sign in then moves into the band, as on club pages; the tournament's own scores are on its Overview.
    - **The web app opened in a phone browser** (Discover, Scores, Account) keeps its bar; tapping into a club or
      tournament page from there leaves it, and the browser's back is the way home. Accepted as a website's normal
      behaviour, or the owner may want a "back to the app" line in that case.
    - **A club's own web address (Stage 4e)** is a different address from the app, so inside the installed app a club
      page must open on the app's address to stay in the app; the club's own domain is the website.
    - **Installing becomes the reason for the bar**, so the install prompt's place and words matter more (and stay out of
      the next-game and payment jobs).
    - Owner walk needs both: a phone browser and the installed app.
  - *Superseded intermediate proposal:* one bar on every public page (club, team, tournament), the same
    tabs everywhere, changing only with signed in vs out. Signed out: the way back to the app, Scores, Sign in. Signed
    in: the family's own home (kids' schedules), Following, Chat when it returns, Account.
  - **Two things to settle with it.** (1) It reverses Stage 4 **Ask 8** (no platform phone bar on club pages) and, if the
    first tab opens Discover, **Ask 2** (no Discover on club pages). Their reason was that a club's paid site sends nobody
    to our directory; that is a positioning call (is the club site the club's own website, or the door into the
    family app?), worth logging with `/strategy`. (2) **The first tab cannot be called "Home" on a club page**: the club's
    tab row already has a Home that means the club. Name it for what it opens; words to `/marketing`.
  - Height: band 72 + rule and tabs 48 + bar 64 = 184px at rest on a 667px phone, the same as tournament pages and
    inside the Nav Unification budget. *(Under the accepted direction, in a phone browser: band 72 + rule and tabs 48 =
    120px at rest, 48px pinned; inside the app add the 64px bar. Drawn round 2: the browser Sign in is the club bar's
    plain word at the band's right end; inside the app the band drops it because the bar carries it.)*
  - **Not a dependency of this project:** Stage 1 draws the bar as a shared slot, so a later change to its tabs costs
    no rework here.
- **Review the app's own phone pages (Home/Discover, Scores, Following, Account) against the product's formatting**
  (owner note, after this project). Recommended to run as part of the family-bar project above, since the bar decides
  what those pages are.

## 11. Needs new work

- Server-side publish gate across the public reads (Stage 0).
- Tournament colour roles from `clubColourRoles` for a tournament's own saved colour; the neutral free band.
- The band component for tournaments (the club bar's shape with event content) and a pinned white tab row.
- A tournament footer (event contact, page list, host line, credit).
- The host card's open-now list for a tournament page (reuse the club home's query).
- Sponsors: where-it-shows, editor control, an org without a club site, the Overview strip.
- A focused layout for `pay/[token]`.
- Fixtures: a free standalone event, a paid standalone with a custom colour, a pale colour, a long name, a long
  schedule, an empty event.

## 12. Engineer pointers

Layout `app/[orgSlug]/[tournamentSlug]/layout.tsx` (dark default at :125, rail :321, ticker :323, dock :343);
`components/public/TournamentHomeContent.tsx`, `ScheduleContent.tsx`, `StandingsContent.tsx`,
`TournamentTopTabs.tsx`, `ScoreTicker.tsx`, `MyTeamDock.tsx`, `TournamentNavStatus.tsx`, `Navbar.tsx` (event header);
`lib/public-tournament-theme.ts`, `lib/themes.ts` (`ensureLightTint`), `lib/tournament-branding.ts`;
club frame `components/public/ClubFrame*.tsx|css`, `ClubBar`, `ClubFooter`, `ClubSponsors`, `OrgSectionTabs`,
`lib/club-colour-roles.ts`, `lib/club-site-home.ts`; host link `lib/module-entitlements.ts:109-136`; sponsors
`supabase/migrations/353_the_clubs_sponsors.sql`; global phone bar `components/consumer/ConsumerNav.tsx:455-462`.
Rulings: `memory/design_decisions.md` 2026-06-01 mobile remediation, TH-1, G3/G4, Nav Unification (2026-07-20),
The Flip amendment, Stage 4 Ask 1 / Ask 8.
