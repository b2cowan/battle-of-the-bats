# Club Website Enhancements — Plan

> **Status:** on the board (`docs/agents/strategy/OWNER_BRIEF_PROJECTS.json`, project `club-website`). Never restated here.
> **Created:** 2026-11-24 (owner: "log this as a project called Club Website Enhancements")
> **Branch:** dev
> **PM brief:** [CLUB_WEBSITE_ENHANCEMENTS_PM_BRIEF.md](CLUB_WEBSITE_ENHANCEMENTS_PM_BRIEF.md)
> **Nothing is built, drawn or ruled.** The ten ideas are recommendations from one evaluation session. The stage
> ladder in §6 is PROPOSED, not accepted.

## 1. Goal

A club's public website that a family has a reason to open every week and that a club president wants the first time
they see it. Two tests, both the owner's (2026-11-24): real-world function that offers true value, and a demo public
site that immediately impresses a new club owner.

The owner's standing instruction for this project (2026-11-24): **"do this right the first time and not have to
continue to add on later because we rushed."** Every stage below is shaped by that sentence.

## 2. What the evaluation found (2026-11-24)

Read from the code by four helper censuses, with the lines the conclusions turn on re-opened by the session. Items
marked ◦ are helper findings that were NOT re-opened; a build session re-checks them before relying on them.

### 2.1 What a club gets today

- **Look:** logo, colours "From your logo", nine presets or two own colours, three type looks, a banner photo, the
  club's own web address (`app/[orgSlug]/admin/public-site/`).
- **Club pages:** home (`components/public/ClubSiteHome.tsx`: Open now, Teams, House league, Tournaments, About, a
  sponsor strip), About (contacts, document links, FAQ, sponsor list), rep team pages (published schedule, calendar
  subscribe ◦, coach names by policy), tryouts with sign-up, house league season pages (sign-up, schedule, standings),
  one notice banner (`ClubNoticeBanner.tsx`).
- **Tournament pages:** scores refresh every 30 seconds on game days ◦ (`lib/hooks/usePublicTournamentLive.ts`),
  brackets, champions, directions, score share images, the installable app with following and alerts (app only).
- **Privacy:** no player is named on any public surface, by design.

### 2.2 The three findings that matter more than any missing feature

1. **The site only changes when something opens.** Nothing on the club home moves between registration windows: no
   news, no photos, no club-wide results. `/{org}/news` only forwards to a running tournament and is "not found"
   otherwise (`lib/club-shortcut.ts:26-38`, verified).
2. **The shop window shows none of it.** The no-login tournament demo is seeded with the platform look and no logo
   (`scripts/seed-demo-tournament.mjs:124`, verified), no sponsors, photos or news ◦. The coach demo has no public side
   ◦. There is no club or house-league demo (IDEAS_BACKLOG "From the on-sale pages audience review"). The Clubs
   marketing page never pitches the club site ◦.
3. **Two demo lines overclaim.** The fan-side demo banner says "A real tournament, running right now"
   (`lib/sandbox-chrome.ts:352`) and `/demos` says "running right now" and "one running live right now"
   (`app/demos/page.tsx:44,53`). The demo has been a fixed daily snapshot where nothing is ever live since the owner's
   2026-09-02 ruling (`lib/demo-tournament.ts:12-67`). Routed to `/marketing` as a finding; not changed.

### 2.3 Gaps

| Area | Gap | Evidence |
|---|---|---|
| Content | No club news; no photo gallery; no custom pages; documents are links only ◦; contacts are a role and an email ◦ | `lib/club-shortcut.ts`; helper greps empty for news/blog/gallery/custom page |
| Phones | The banner photo is left out on phones | `lib/public-site-words.ts:85` ("Phones leave it out"), verified |
| Game day | No field or rainout status; no club-wide "tonight"; house league pages do not refresh ◦ | helper greps empty for rainout/field status/weather |
| Sponsors | Every tile the same size; a team's sponsor shows on About only; no evidence of what a placement earned | `components/public/ClubSponsors.tsx:14-21,58-61`, verified |
| Promotion | No QR code, poster or social image for the club site ◦; no "tell me when registration opens" ◦ | QR exists only in the tournament staff kit and the rules PDF ◦ |
| Identity | On a club's own web address the browser tab shows FieldLogicHQ's icon | `app/layout.tsx:78-81`; no icon declared under `app/[orgSlug]`, verified |

### 2.4 Already planned elsewhere (not this project's to build twice)

- Club events and camps "postable on the club site": Board Ready Stages 5 and 7 (`BOARD_READY_PLAN.md:38-43,99-101`).
- Sponsors on tournament pages: the Public tournament pages project (drawing can start).
- Families paying online (Stage 12) and the signed-in family app: built, switched off.
- Every tournament game on a real venue: `TOURNAMENT_REAL_VENUES_ONLY_PLAN.md` (field status leans on it, §5 idea 3).
- **How rep teams are grouped** (levels, then age groups, then teams; who runs each level): the Team structure project,
  `TEAM_STRUCTURE_PLAN.md` (owner 2026-11-24). The public Teams page, the home's Teams section and Tryouts are drawn
  from **its** Stage 0 end state, as a fixed input. Stage 0 here does not invent a team layout of its own, and it does
  not read levels or ages out of team names.

## 3. Rulings that bound every idea here

Read each ruling's REASON before leaning on it or proposing to re-open it. BD = `docs/agents/strategy/BUSINESS_DECISIONS.md`.

- **Nothing that names a child leaves the signed-in product.** Public sharing is deferred, not cancelled, and needs a
  new entry plus a consent model (BD 2026-08-01, line 3755, verified). Rules out public player stats, trading cards and
  an alumni wall as drawn in the backlog.
- **No pitch-by-pitch stats, no play-by-play** (same entry).
- **Following and alerts live in the installed app only** (owner 2026-10-27/28, `PUBLIC_TOURNAMENT_SITE_REVIEW_PLAN.md`).
- **No new no-login family doors.** Public = tournaments and team public pages (BD 2026-10-29 ◦). The public team page
  is games only; practices are never public.
- **No follower tier, no "share one link", no page for one game** (BD 2026-09-12 line 2864 and 2026-09-20 line 2801,
  verified). Marketing may never say "follow the team" or "share a game".
- **Club pages advertise nothing of ours** beyond a quiet credit (BD 2026-10-19 ◦).
- **Sponsors: one list per club, each sponsor says where it shows; same-size tiles, no tiers** (Stage 4d Ask 17,
  2026-10-19; `ClubSponsors.tsx:20`).
- **A club's information is never given to an AI service** (the Data Terms' promise, AGENCY_RULES). Anything
  "written by the site" in ideas 2 and 4 is written from fixed sentence patterns over the club's own data.
- **Marketing claims only what ships** (BD ◦). The demo and any picture of these ideas follow the product.
- **The demo comes after the Canadian launch** (owner 2026-11-17; no club demo for launch, 2026-11-18). Idea 1 asks the
  owner to move this; see §7.
- **A demo sandbox is never live** (owner 2026-09-02). That ruling is about a read-only sandbox faking a scoreboard. A
  writable prospect world where a real score is entered is a different thing; say which one is meant.

## 4. Why this is not ten features

Drawn one at a time with no shared picture, the ideas collide. Seven shared foundations sit under the ten:

| Foundation | What it is | Ideas resting on it |
|---|---|---|
| F1 The home's moving part | One region of the club home that holds "what is happening": games, results, field status, news, events. "Open now" is locked first today (2026-10-19). | 2, 3, 4, Board Ready's club events |
| F2 The club's games, read once | One read of the club's games today and this week across rep teams (only those whose schedule is public), published house league divisions and the club's tournaments. Must honour every publish and visibility rule (the Stage 0 D1 lesson: a draft schedule reached families). | 2, 3, 6, 9 |
| F3 Places | A field can only be closed if games and permits point at the same real field. | 3, 6 |
| F4 Photos and consent | Whose picture may be shown, asked at registration, before any photo surface. | 7, 4, 8 |
| F5 Sponsor places | Where a sponsor can show and what gets counted. | 5, 6, 10 |
| F6 How fast a score arrives | Today 30 seconds. The live bracket's faster path rests on an open database read that already has a `/db` follow-up owed. | 9, 2, 6 |
| F7 A club made before it buys | The prospect world: today by hand, two named clubs, on dev. | 1 |

## 5. The ten ideas

Order = the session's recommendation. The owner sets the order.

| # | Idea | What a visitor sees | Rests on | Touches | Open before drawing |
|---|---|---|---|---|---|
| 1 | Your club, already built | Before a meeting: the prospect's name and logo make a full site in their colours with their teams, a tournament in flight and sponsors. In the room they scan a code and their club opens on their phone; "claim it" starts the trial. | F7 | `scripts/seed-prospect-demo.mjs` ◦ (allow-list of two clubs), Milton demo world, the start flow | The demo ruling (§7 C3). `/legal`: a real club's name and logo on a page they did not make (unlisted, never indexed, clearly ours). Where it runs (today dev only). |
| 2 | Game day on the club home | When games are on, the home leads with tonight's games and the weekend's results across rep, house league and tournaments. Built from scores already entered. | F1, F2, F6 | `ClubSiteHome.tsx`, house league pages (no refresh today) | Which rep teams count (public schedules only). What the home shows on a day with no games. |
| 3 | Field status board | One tap closes a field; the home and every affected game say so. | F1, F2, F3 | notice banner, game rows on every public page, permits, real-venues project | Who may close a field. Whether closing a field cancels, or only flags, its games. Backlog "Storm Mode" is the tournament half. |
| 4 | The club writes its own news | The site posts when a team wins, tryouts open or a division is nearly full; an admin can add a post with a photo. | F1, F4 | `/{org}/news` forward (printed links and QR codes rely on it), tournament news | The sentence patterns (no AI). What `/{org}/news` does once a club has its own news AND a running tournament. |
| 5 | A site that pays for itself | Sponsors on game-day surfaces and score share images; a season report of views and taps per sponsor. | F5 | Sponsorships (Board Ready Stage 6), `ClubSponsors.tsx`, share images | Tiers (§7 C1). `/legal` + privacy policy: counting views. `/strategy`: the gate. |
| 6 | The Big Board | One tap puts live scores, up-next times and rotating sponsors on a TV. Backlog shortlisted. | F2, F3, F5, F6 | tournament pages, house league nights | No sign-in on the display: what it may show. `/strategy`: the gate. |
| 7 | Give the site a face | The banner photo on phones, a team photo per team page, albums per event. | F4 | `LookPanel.tsx`, team pages, custom sign-up forms | `/legal`: children's photos and the consent question. Reverses the 2026-10-19 "phones leave it out". |
| 8 | Trophy case and club history | Every championship the club's teams have won, year by year, team level only. | (F4 for photos) | archives, finished house league seasons, tournament champions | What counts as a win the club did not host. Entered by hand, or only what the product recorded. |
| 9 | Scores that land in a second | A score entered on a phone flips on the public page almost at once; standings rows slide. Backlog "Motion Pack" and "The Bracket Draws Itself". | F6 | every public score surface | The `/db` follow-up on the open games read comes FIRST. |
| 10 | Fence poster and share kit | A printable QR poster, a "registration is open" social image, "tell me when registration opens". | F5 | staff kit QR, share images, registration pages | `/legal`: anti-spam consent for the email sign-up. |

**Left out, and why:** public player stats, trading cards, the alumni wall (the 2026-08-01 child ruling); following or
alerts in a browser (ruled app only); AI-written recaps (the Data Terms); a merch store, French and volunteer sign-up
(real gaps, none decides a purchase; volunteer sign-up belongs in the signed-in app).

## 6. Stage ladder (PROPOSED 2026-11-24, not accepted)

Sequenced by dependency and rework risk. No timing. Every stage after Stage 0 is one deep dive at a time:
its own drawing session from real captures → `/ux` and `/design` before hand-off → the owner's asks ruled → a build
prompt → the build → `/simplify`, `/review`, `/legal` or `/accounting` where its change calls for them, `/docs` → one walk.

- [ ] **Stage 0 — The walk and the end state, in one publish.** Today's club site captured on a phone and a computer
  for a dressed club; the census questions in §8 answered from code; **every club page drawn once as it stands when all
  ten ideas are in** (phone first, frames, not finished drawings); this ladder; the owner calls in §7. Nothing built.
  The point: ideas 2, 3 and 4 all want the top of the home page, and 5, 6 and 10 all want the sponsors. Deciding the
  shared page once is what stops the add-on-later problem.
- [ ] **Stage 1 — The home's moving part, with Game day as its first tenant (idea 2; F1, F2).** First because it needs
  no new typing from a volunteer, so it proves the frame on real data. The one read of the club's games is built so
  Stage 6 can change how fast it arrives without touching a page.
- [ ] **Stage 2 — Field status (idea 3; F3).** Second tenant. Waits on the answer to "do games point at real fields"
  (the real-venues project for tournaments; house league and rep to be read in Stage 0).
- [ ] **Stage 3 — The site's face (idea 7; F4).** `/legal` and the consent question first. Before news, so a news post
  is built with its photo from the start.
- [ ] **Stage 4 — News (idea 4).** Third tenant: the automatic posts and the admin's own.
- [ ] **Stage 5 — Sponsors that prove themselves (idea 5; F5).** Club surfaces and the report. Sponsors on tournament
  pages stay with the Public tournament pages project; the two drawings are read side by side.
- [ ] **Stage 6 — Scores that land in a second (idea 9; F6).** After the `/db` follow-up. After Stages 1 and 2, so the
  motion is applied once to every score surface that exists.
- [ ] **Stage 7 — The Big Board (idea 6).** Needs F2, field status, sponsors and the fast score.
- [ ] **Stage 8 — Trophy case (idea 8).** Independent; placed late only because nothing waits on it.
- [ ] **Stage 9 — Share kit (idea 10).** Last, so the poster and the social images carry the finished pages.
- [ ] **Track P — Your club, already built (idea 1; F7).** A separate track with its own drawing session. It shows
  whatever the site is, so it depends on no stage and gets better with each one. Starts on the owner's word (§7 C3).

**Standing rules for every build stage:** a migration is the first task, with `docs/agents/db/DATA_DICTIONARY.md` and
`npm run refresh:snapshots` in the same unit of work; the plan gate goes to `/strategy` and `PLAN_PRICING_FACTS.md`
before any gate is written (the club site rides the public site module today: League Plus and Club; team pages are
Club); a stage that changes what is collected about people, shown about them or emailed runs `/legal` before hand-off;
the demos follow the product and are curated with `/demos`, never as a build step.

## 7. Owner calls open

- [x] **C0 — The approach. RULED 2026-11-24:** the whole-site pass goes first, started "with what we have proposed",
  and Milton Bats' feedback is added later (the owner's words: "can we start the site pass with what we havce proposed
  and add their feedback later?"). Kick-off prompt: [CLUB_WEBSITE_STAGE0_PROMPT.md](CLUB_WEBSITE_STAGE0_PROMPT.md); its
  feedback slot is where the meeting's answers go, and the asks are not ruled until that slot has been looked at.
  The rest of §6's ladder (the order after Stage 0) is still PROPOSED.
- [ ] **C1 — Sponsor tiers.** Idea 5 is stronger with larger tiles for bigger sponsors; same-size tiles is the
  2026-10-19 ruling. Recommendation: keep the ruling, lead with the report.
- [ ] **C2 — House league team pages.** A public games-only page per team is where a team's sponsor would show. On
  2026-11-22 the owner kept a team's sponsor on About only ("there is no public team page").
- [ ] **C3 — The demo ruling.** Idea 1 puts a club demo ahead of "the demo comes after launch". Recommendation: move
  it up as Track P; it is the only item that changes a prospect's first minute.
- [ ] **C4 — The order of the ten.** §5's order is a recommendation.

## Progress

- 2026-11-24 — Logged. Roadmap rows added and shown on the Milton deck (slide 13) and the public roadmap drawing; the
  owner confirmed the same day that the game day line stays at "Q2 2027 · targeted" on the slide ("those are all
  settled"; the session's reading of his answer, the roadmap's Ruled column is left blank until he places the row in
  his own words). Stage 0 kick-off prompt written; the owner is asking Milton three questions in the meeting (in the
  prompt's feedback slot). Nothing drawn, nothing built.

## 8. Census questions for Stage 0 (answer from code, not from this plan)

- [ ] Do house league and rep team games point at a real field record, or a typed name?
- [ ] Which rep team schedules are public today, and how does the home learn that without leaking a private one?
- [ ] What does a club with nothing open and no games see on the home today, on a phone?
- [ ] Re-check every ◦ item in §2 that the stage being drawn leans on.
- [ ] Is the prospect seed's allow-list the only thing holding it to two clubs, and what does it write that a real
  club's sign-up would collide with?

## 9. Findings routed, not acted on

- [ ] `/marketing`: the two "running right now" demo lines (§2.2 item 3).
- [ ] The browser-tab icon on a club's own web address (§2.3 Identity): a small truth fix, the owner's word to build.
- [ ] Stale records met on the way: `BRAND_STRATEGY.md` and `PRODUCT_ROADMAP.md` still read as if Club is not on sale ◦;
  `lib/club-shortcut.ts:15` still says `/teams` forwards "until Stage 4b" though the club Teams page exists ◦.
- [ ] IDEAS_BACKLOG "Public Site Offering Evaluation" now points here.

## 10. Words for /marketing

> Customer-visible wording written during a build, settled in ONE `/marketing` pass per stage, before the walk.
- [ ] (none yet; the first words arrive with Stage 1)

## 11. Architectural decisions

- **Decision:** nothing in this project names a child on a public page. **Rationale:** BD 2026-08-01; re-opening it is
  a `/strategy` entry with a consent model, never a side effect of a stage here.
- **Decision:** "the site writes it" means fixed sentence patterns over the club's own data. **Rationale:** the Data
  Terms' promise that a club's information is never given to an AI service.
- **Decision:** the ten ideas share one drawn end state before any one is built. **Rationale:** the owner's
  2026-11-24 instruction; §4.
