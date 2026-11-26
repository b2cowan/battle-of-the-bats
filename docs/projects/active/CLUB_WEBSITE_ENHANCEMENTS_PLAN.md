# Club Website Enhancements — Plan

> **Status:** on the board (`docs/agents/strategy/OWNER_BRIEF_PROJECTS.json`, project `club-website`). Never restated here.
> **Created:** 2026-11-24 (owner: "log this as a project called Club Website Enhancements")
> **Branch:** dev
> **PM brief:** [CLUB_WEBSITE_ENHANCEMENTS_PM_BRIEF.md](CLUB_WEBSITE_ENHANCEMENTS_PM_BRIEF.md)
> **Nothing is built. Stage 0's 26 asks were RULED 2026-11-24** (§7; A on 25, and A12 the middle path after `/legal`;
> C8 softened).
> The end state is drawn ([CLUB_WEBSITE_STAGE0_DRAWINGS.html](CLUB_WEBSITE_STAGE0_DRAWINGS.html)). The stage ladder in
> §6 is ACCEPTED as drawn (C4 = A).
> **An eleventh idea was added after the drawings were published** (the club's own feed: photos and wins from coaches,
> and Instagram; Milton Bats' meeting, 2026-11-24). It is in §5 and §5.1, PROPOSED, and it is **drawn as tab 11 of the
> drawings** (republished 2026-11-24, version 2), with ten asks of its own. The page holds 26 asks, ruled 2026-11-24.
> **Club events drawn into the end state 2026-11-25** (the owner split events work with Board Ready on 11-24; handover
> [CLUB_WEBSITE_EVENTS_HANDOVER_PROMPT.md](CLUB_WEBSITE_EVENTS_HANDOVER_PROMPT.md)). Drawn on its own page,
> [CLUB_WEBSITE_EVENTS_DRAWINGS.html](CLUB_WEBSITE_EVENTS_DRAWINGS.html) = https://claude.ai/artifact/QVdzG948rq23zPAxMUFhRk,
> with nine asks E1–E9, **all ruled A 2026-11-25** (§7). `/design` ran before publish (12 findings, all applied).
> Read it before Stage 1's drawing session.

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
| Social and photos | The club's Instagram, Facebook and X are footer links only ◦; no page shows a post from them. No photo of a team or an event exists anywhere in the product. A coach can hand the club money and schedule items and nothing else ◦. Only the owner or an admin may change the site. | `lib/db.ts:1347-1348` (the link fields, verified); `components/public/ClubFooter.tsx:59-70` ◦; `lib/public-site-rules.ts:17`, verified; §5.1 |
| Phones | The banner photo is left out on phones | `lib/public-site-words.ts:85` ("Phones leave it out"), verified |
| Game day | No field or rainout status; no club-wide "tonight"; house league pages do not refresh ◦ | helper greps empty for rainout/field status/weather |
| Sponsors | Every tile the same size; a team's sponsor shows on About only; no evidence of what a placement earned | `components/public/ClubSponsors.tsx:14-21,58-61`, verified |
| Promotion | No QR code, poster or social image for the club site ◦; no "tell me when registration opens" ◦ | QR exists only in the tournament staff kit and the rules PDF ◦ |
| Identity | On a club's own web address the browser tab shows FieldLogicHQ's icon | `app/layout.tsx:78-81`; no icon declared under `app/[orgSlug]`, verified |

### 2.4 Already planned elsewhere (not this project's to build twice)

- Club events and camps: Board Ready Stages 5 and 7 own everything a person DOES with an event (the club side, sign-ups,
  the sign-up path, and the one rule for what is public: shown to Everyone = public, Club staff never, gone the day
  after it ends). **This project owns everything that SHOWS events to the public** (owner's split, 2026-11-24,
  `BOARD_READY_PLAN.md` §5 Stage 5 "SPLIT"): where they sit on the home, the News page, each event's page, the champs
  day's public page, events in Close a place, event sponsor places. Board Ready's 8A (an Events tab) is withdrawn to
  here. Every sign-up gets a shareable link (ruled in Board Ready, 2026-11-24). Ruled 2026-11-25: §7 E1–E9, all A;
  Board Ready Stage 5 builds the event page and the Open now row to the events drawing (E5).
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
- **No new sent links to families beyond Your sign-up and unsubscribe** (BD 2026-10-29, narrowed 2026-10-31). Public
  pages are tournaments, team public pages, and what a club itself marks public: its seasons and tryouts, its news, and
  its events shown to Everyone, a champs day's games among them. The public team page is games only; practices are
  never public. *(Reworded 2026-11-25 with E1–E4's rulings; the line before quoted BD 10-29 as first written.)*
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
| F4 Photos and consent | Whose picture may be shown, asked at registration, before any photo surface. | 7, 4, 8, 11 |
| F5 Sponsor places | Where a sponsor can show and what gets counted. | 5, 6, 10 |
| F6 How fast a score arrives | Today 30 seconds. The live bracket's faster path rests on an open database read that already has a `/db` follow-up owed. | 9, 2, 6 |
| F7 A club made before it buys | The prospect world: today by hand, two named clubs, on dev. | 1 |
| F8 The club's photo shelf (PROPOSED 2026-11-24, with idea 11) | ONE place a club's pictures live, each one knowing who sent it, which team and event it belongs to, whether it may be shown, and where it shows. Today every picture has its own upload and its own rules (logo, banner, sponsor logo, team crest), and none is a photo of people. Without it, ideas 4, 7, 8 and 10 each build their own photo upload. | 11, 7, 4, 8, 10 |

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
| 11 | The club's own feed (added 2026-11-24 from Milton Bats' meeting; PROPOSED, not drawn) | A coach sends photos from a phone after a win or a tournament trip. They reach the club already filed by team, event and date. An admin picks what shows: the home's News, the team's page, a Photos page. A post the club already made on Instagram or Facebook shows by pasting its link. | F8, F4, F1 | Coaches Portal (no way to hand the club content today), who may change the site, idea 4's News, idea 7's photos, the footer's social links | Calls C5–C9 (§7). `/legal` before it is drawn. Full write-up: §5.1. |

**Left out, and why:** public player stats, trading cards, the alumni wall (the 2026-08-01 child ruling); following or
alerts in a browser (ruled app only); AI-written recaps (the Data Terms); a merch store, French and volunteer sign-up
(real gaps, none decides a purchase; volunteer sign-up belongs in the signed-in app).

### 5.1 Idea 11 in full — the club's own feed (PROPOSED 2026-11-24; nothing ruled, nothing drawn)

**What the club said** (Milton Bats, in the 2026-11-24 demo, as the owner reported it): scores and schedules for every
rep team and for house league are welcome, and the organization also wants to promote its wins, tournament trips and
the like through its site. It already uses the large social platforms, Instagram among them. The owner's question:
what are the options for an enhanced social feed; how do items posted by coaches and club admins get organized and
categorized; a drop location for media, or an easy way to embed Instagram; where the images go; how they are
collected, collated and selected for the site.

**The session's reading (not the owner's words):** this is not an eleventh feature beside the others. It is ideas 4
(news) and 7 (photos) asked for by a real club, plus three things neither idea had: **more hands** (coaches, not only
an admin), **one place to gather** (the shelf, F8) and **a pick step** between what is sent and what the public sees.
One club is one data point (the Stage 0 prompt's rule): it tests the end state, it does not redraw the product.

**What exists today** (helper census 2026-11-24; ◦ = not re-opened by the session):
- Pictures the product stores are all marks, never people: club logo, banner, sponsor logos, tournament logo, a
  coach's team crest ◦. No team photo, no event photo, no player photo ◦.
- Each has its own upload and its own rules. The sponsor logo is opened and re-saved, which drops a phone's hidden
  data (`lib/sponsor-logo-image.ts:31-35`, verified). **The banner photo is stored exactly as sent**
  (`app/api/admin/org-hero-banner/route.ts:60-68`, verified), and the club and tournament logos the same ◦; see §9.
- The club's Instagram, Facebook, X and website addresses are held (`lib/db.ts:1347-1348`, verified) and shown as
  footer links ◦. No YouTube or TikTok ◦. Nothing from another site is shown inside any public page ◦.
- Tournament news is a title and words, no picture, and belongs to one tournament ◦. There is no club news (§2.2).
- A coach can upload a team crest and private player documents. A coach can hand the club money requests and
  schedule hand-backs, and no content ◦.
- Only the owner or an admin may change the public site (`lib/public-site-rules.ts:17`, verified). There is no
  narrower "can post, nothing else" permission ◦.
- No photo consent is asked anywhere (Progress item 6; `family_consents` holds three other scopes ◦).
- Backlog ideas this touches, all still New: Memory Lane (staff, and parents if the coach opts in, drop photos into a
  season timeline), the Season Reel (a video sized for Instagram), the Alumni Wall (`IDEAS_BACKLOG.md:41,44,48`, verified).

**What Instagram allows a site like ours** (web research 2026-11-24 from Meta's developer pages; re-check before a
build, this has changed three times in two years):
- **One post at a time, no approval.** Since 2026-06-15 Meta's embed for a single public Instagram, Facebook or Threads
  post needs no Meta app, no key and no review. The caption can be left off. Private accounts and accounts that turned
  embedding off do not work. The embed loads Instagram's own script in each visitor's browser, so Meta sees the visit
  (secondary source; what it sets in the browser was NOT confirmed).
- **A club's whole feed: no official widget exists.** Reading an account's recent posts needs the account to be a
  professional one (Business or Creator; a personal account cannot be read since 2024-12-04), the club to connect it,
  and FieldLogicHQ to pass Meta's app review AND business verification before any club but ourselves can connect. The
  connection lapses after 60 days unless renewed; a lapsed one needs the club to connect again. Picture addresses from
  Meta should be treated as temporary, so a picture chosen for the site would be copied to our own shelf.
- **Posting TO Instagram from us:** possible for professional accounts, behind the same review plus a publishing
  permission; about 100 posts a day.
- **Third-party feed widgets** (Elfsight, Smash Balloon, Behold and others) do the whole-feed job by having the
  account owner connect through them. Competitors lean on these (TeamSnap and LeagueApps point clubs at such plugins;
  SportsEngine shows single posts only; TeamLinkt lets any team member add to an album and mark a photo public).
  Secondary sources, partly confirmed.
- Meta's terms have no rule against showing a connected account's own posts on its own website; they do require
  deleting the data when the club disconnects or asks.

**Showing ONE post from a pasted link, in detail** (owner's follow-up question 2026-11-24; second research pass the
same day, Meta's developer pages; "confirmed" = read on Meta's own page, "not confirmed" = Meta's pages are silent):
- **Yes, Instagram offers it, officially.** Meta's oEmbed service takes a post's address and returns the block that
  shows it. Since 2026-06-15 it needs no Meta app, no key and no review (confirmed: Meta's 2026-06-15 developer blog
  and its Instagram oEmbed page). Facebook posts and videos are named in the same announcement; their options were
  not read.
- **What shows:** photo posts, carousels, videos and Reels from a public account, with the account's name and a link
  to it. Not Stories. Not a private or age-restricted account, nor one that turned embedding off (confirmed). Whether
  a carousel swipes and a Reel plays in place: not confirmed.
- **Options we would use:** caption off (Meta's reference lists a hide-caption setting; whether it works on the
  no-key service is not confirmed), width between 320 and 658 px, so it fits a 390 px phone (confirmed). The height
  is not known until it loads, so the page keeps a space for it.
- **What a build is:** a paste field; a check at save time that Meta will show the post, with a plain refusal when it
  will not; the post's address kept, not a copy of its picture; a holder on the page that loads Instagram's script
  only when the post is shown.
- **What can go wrong later:** the post is deleted or the account goes private, and the embed goes blank. Meta does
  not say how that looks or whether it can be detected. A build re-checks kept links and hides a dead one.
- **Rules Meta sets:** use it only to show the content; no analytics on it; its platform terms apply (confirmed).
  Nothing found on pasting someone else's post or on posts that show children: our rule, not Meta's.
- **The visitor:** the embed's script comes from Instagram, so Instagram learns that a browser opened the club's
  page. What it stores in a signed-out visitor's browser is NOT confirmed by Meta or a regulator (one consent-tool
  vendor lists a two-year Facebook identifier). This is why the drawing shows the post behind a "Show this Instagram
  post" tap (option B1) as well as loading at once (B2); `/legal` in §9.
- **Not confirmed, to settle in a build spike:** the no-key service's request limit (the keyed one is 1,000 an
  hour), whether the returned block may be kept, and which outside hosts a page must allow.

**The options:**

| | Option | What it takes from the club | What it costs us | Verdict |
|---|---|---|---|---|
| A | Links to their social accounts | Nothing | Shipped (footer) | Stays. Not a feed. |
| B | Paste one post's link (Instagram or Facebook); it shows in News | A copy and a paste per post | Small; no approval from Meta | **Recommended, as the Instagram answer for now.** The admin chooses each one; caption off by default. |
| C | Connect the club's Instagram; its posts arrive on the shelf to be picked | A professional account, connecting it, re-connecting when it lapses | Meta's review and business verification; a connection to keep alive per club | **Parked** until a second club asks. Arrives ON the shelf, so nothing built before it is redone. |
| D | The club's photo shelf, fed by coaches, picked by the club | A coach's ten seconds after a game; an admin's pick | The real build: F8, F4, a coach's send, a club's inbox | **Recommended, as the spine.** The only option that works for a club with no Instagram, and the only one our consent rule can govern. |
| E | Made-for-Instagram pictures OUT: a win or a result as a ready image to download and post | One download | Small; score share images already exist | **Recommended**, with idea 10's share kit. Publishing straight to Instagram is parked with C. |
| F | A third-party feed widget on the club's page | An account with that company | Their script and their name on a club page | **No.** A club page advertises nothing of ours, let alone a stranger's; no consent rule reaches it. |

**How D files itself (why the product is better placed than a shared folder):** the schedule already knows which team
played where and what the score was. A coach sends from a game, a tournament or the team's home, so each photo arrives
with its team, its event, its date and its sender and nobody types a label. The club's side is one inbox ("Photos to
look at") grouped by team and event; each group says whether it may be shown (C8) and the admin picks where: a News
post, the team's page, a Photos page that filters by team and by event. One optional label is added at the pick, from
a short fixed list (a win, a tournament trip, a team photo, a club event, a thank-you to a sponsor). The coach sees
what became of what they sent ("On the site" or "Not used"); a coach who never hears back stops sending.
A win post is composed from what the product holds (the team, the tournament, the score) in fixed sentence patterns,
with the picked photo; no AI (§3).

**Where the pictures live:** in the club's own space in our storage, beside its logo and banner. Every picture is
opened and re-saved at web sizes on arrival, which also removes a phone's hidden location data (the sponsor logo
already works this way). No original is kept beyond one large web size. No video is stored: a video is a link to where
the club already posted it. A storage allowance per club is a `/strategy` call (C9). A build checks that a phone's
HEIC photos can be read.

**What it changes in the other ideas:** idea 7's team photo, banner and albums and idea 4's news photo stop being four
uploads and become four places a shelf picture can show. Idea 8's trophy case can show the shelf's photo of the win.
Idea 10's share kit gains E. The record of "who sent it" is kept from the start so that a parent can become a sender
later (the backlog's Memory Lane, inside the signed-in family app) without the shelf being rebuilt.

**Not in this idea:** a parent uploading from a public page (no new no-login family doors, §3); comments, likes or
follows on the club site (following is the installed app's, §3); the club site as a place a coach publishes with no
club pick, unless C6 rules otherwise; a standalone coach's team with no club (it has no club site).

## 6. Stage ladder (ACCEPTED 2026-11-24: C4 = A, with idea 11 widening Stages 3, 4 and 9)

Sequenced by dependency and rework risk. No timing. Every stage after Stage 0 is one deep dive at a time:
its own drawing session from real captures → `/ux` and `/design` before hand-off → the owner's asks ruled → a build
prompt → the build → `/simplify`, `/review`, `/legal` or `/accounting` where its change calls for them, `/docs` → one walk.

- [ ] **Stage 0 — The walk and the end state, in one publish.** Today's club site captured on a phone and a computer
  for a dressed club; the census questions in §8 answered from code; **every club page drawn once as it stands when all
  ten ideas are in** (phone first, frames, not finished drawings); this ladder; the owner calls in §7. Nothing built.
  The point: ideas 2, 3 and 4 all want the top of the home page, and 5, 6 and 10 all want the sponsors. Deciding the
  shared page once is what stops the add-on-later problem.
- [x] **Stage 1 — The home's moving part, with Game day as its first tenant (idea 2; F1, F2).** First because it needs
  no new typing from a volunteer, so it proves the frame on real data. The one read of the club's games is built so
  Stage 6 can change how fast it arrives without touching a page.
  *(Corrected by Stage 0: Open now stays first, capped at two rows; the games part sits after it, titled "Today" or
  "Latest results"; house league pages get the 30-second refresh here.)*
  *(Drawn 2026-11-25; its 11 asks G1–G11 ruled the same day, all as recommended (§7). Build order as drawn: the public
  rep page's running-score defect ("T 4–2") first → the one games read with its guards → the home's games part.
  Build prompt: [CLUB_WEBSITE_STAGE1_BUILD_PROMPT.md](CLUB_WEBSITE_STAGE1_BUILD_PROMPT.md), sessions 1A and 1B.)*
  *(Club events, E1/E5/E6 ruled 2026-11-25: an event with an open sign-up is an Open now row; a champs day is one Today
  row opening its page, its games left out of Today's own rows, and the champs page's games join here.)*
  *(Club events on the schedules, E10/E11 ruled 2026-11-25: a "Champs day" band over that day's games on its season's
  schedule, in every division tab that plays that day, opening the champs page, kept the day after with no door; an
  Everyone event that names a season is a row in its week on that season's public schedule.)*
  *(Session 1A, 2026-11-25: the rep running-score fix committed `45bb8676f`; Pass 1 — the one house league rule, the
  one games read and its guards — built and reviewed (Progress). Club events do not exist in code yet, so Stage 1 builds
  the PLACE for a champs day (first in Today's order, G4) and none of its rows: **E6** (a champs day as one Today row,
  its games left out of Today's own rows), **E10** (the "Champs day" band on the season's schedule) and **E11**'s schedule
  row ride with whichever of this stage and Board Ready Stage 5 lands second. Stage 1 lands first, so they ride with
  Board Ready Stage 5, which builds them on the one games read and the house league rule (its split record says so).)*
  *(Session 1B and its close, 2026-11-25: Pass 2 built (the home's games part, the rows, the house league pages'
  30-second refresh, "Games today", the site editor's rep line, the failure line), `/simplify`, `/review`, `/marketing`,
  `/docs` and `/design` run and applied (Progress). Walk published:
  [CLUB_WEBSITE_STAGE1_WALK.html](CLUB_WEBSITE_STAGE1_WALK.html), https://claude.ai/artifact/SYSsX7HKAXMVLno4UeVZo7
  (29 steps, Owner QA Ledger §567), committed `d574a5f9b`. **Walk closed 2026-11-25** (owner: "walk b was done, we
  can hold d until our push to staging, close this walk for now"): A, B and C passed (B with a score note); D, the
  staging edge check (§9), is held until the push to staging. Detail in §567.)*
- [ ] **Stage 2 — Field status (idea 3; F3).** Second tenant. *(Corrected by Stage 0: it is today's Rainout widened to
  a place ("Close a place"), not a third tool; tournament games ride their own Rain delay, so it does NOT wait on the
  real-venues project. It needs only a count of typed-only games first, dev, counts only.)*
  *(Club events, E7: the window also lists the club's events at that place, each opening in Events.)*
  *(Drawing prompt written 2026-11-25: [CLUB_WEBSITE_STAGE2_DRAWING_PROMPT.md](CLUB_WEBSITE_STAGE2_DRAWING_PROMPT.md) —
  the walk and the typed-only count, then the drawing finishing Stage 0's tabs 10, 4 and 2 and the events drawing's
  tab 6, with `/legal` (emails) and `/strategy` (the Rainout is Tournament Plus today) heard before the asks.)*
  *(Drawn 2026-11-25: [CLUB_WEBSITE_STAGE2_DRAWINGS.html](CLUB_WEBSITE_STAGE2_DRAWINGS.html),
  https://claude.ai/artifact/N332KzJg8NgFJb4oZvJhwM; 17 asks K1–K17 **ruled 2026-11-25, all A** (§7). Build prompt
  written 2026-11-25: [CLUB_WEBSITE_STAGE2_BUILD_PROMPT.md](CLUB_WEBSITE_STAGE2_BUILD_PROMPT.md), three sessions: 2A
  the migration and the press (nothing anyone sees), 2B the window, the result and Reopen, 2C what families and coaches
  see, then the close.)*
  *(Session 2A built 2026-11-25: migration 539 (applied to dev at the owner's word), the press, Reopen, "Link both" not
  news, the reads; /review run and applied. Progress 2026-11-25 "Stage 2 Session 2A". Next: 2B.)*
  *(Session 2B built 2026-11-25: the window, the result, Reopen, the rep coach email, the Rain delay hand-off, the places
  gate, the Rainout button opening it, "Rainout" one word; /billing, /strategy, /legal heard; /review run and applied.
  Progress 2026-11-25 "Stage 2 Session 2B". Commit at the owner's word. Next: 2C.)*
  *(Session 2C built 2026-11-26: the strip on every club page, the rep mark on the five surfaces, "Needs a new date" on
  top of the public house league schedule for a week, the help, the walk's day; /simplify, /review, /docs, /marketing,
  /design, /legal run and applied. Walk §573 published. Progress 2026-11-26 "Stage 2 Session 2C". Commit at the
  owner's word; the stage closes when the walk passes and the owner says so.)*
- [ ] **Stage 3 — The site's face (idea 7; F4).** `/legal` and the consent question first. Before news, so a news post
  is built with its photo from the start. *(Club events, E9: the one photo question is this stage's; camps ask it in
  the same words. P1–P5 ruled 2026-11-25: optional, blank = No; one Yes names the website and the club's own social
  pages; camp and team answers separate; changeable after the lock while Your sign-up works; fixed, versioned words.)*
- [ ] **Stage 4 — News (idea 4).** Third tenant: the automatic posts and the admin's own. *(Club events, E1–E3: the
  home's "Coming up" rows, the News page opening with "Coming up", the News tab shown for a coming event alone; no
  Events tab.)*
- [ ] **Stage 5 — Sponsors that prove themselves (idea 5; F5).** Club surfaces and the report. Sponsors on tournament
  pages stay with the Public tournament pages project; the two drawings are read side by side. *(Club events, E8: an
  event is a sponsor place, a line on its page, counted in the season report.)*
- [ ] **Stage 6 — Scores that land faster (idea 9; F6).** *(Corrected by Stage 0 Part 1: NOT a wait on `/db` — the
  old fast path was deleted. It is a choice: a faster check while a game is live, recommended because it adds no
  exposure, or instant updates over the open games read, only after `/db` says what that read exposes. It can run any
  time after Stage 1.)* The motion (rows slide when a final lands) is applied once to every score surface that exists. *(The champs page counts as one.)*
- [ ] **Stage 7 — The Big Board (idea 6).** Needs F2, field status, sponsors and the fast score.
- [ ] **Stage 8 — Trophy case (idea 8).** Independent; placed late only because nothing waits on it.
- [ ] **Stage 9 — Share kit (idea 10).** Last, so the poster and the social images carry the finished pages.
- [x] **Track P — Your club, already built (idea 1; F7).** A separate track with its own drawing session. It shows
  whatever the site is, so it depends on no stage and gets better with each one. Starts on the owner's word (§7 C3).
  *(Drawn 2026-11-25; its 16 asks T1–T16 ruled the same day, all as recommended (§7). Build order as drawn: the
  preview marker and its build check → Prospect clubs + Make one → the marking → the room → the claim → the removal.
  Build prompt: [CLUB_WEBSITE_TRACK_P_BUILD_PROMPT.md](CLUB_WEBSITE_TRACK_P_BUILD_PROMPT.md), sessions P1–P4.)*
  *(**Closed 2026-11-26** on the owner's word: all four sessions committed, P2–P4 walked (§571, §575; P2's walk
  passed 37 of 37). Going live is the release's work, listed in Progress ("Track P closed").)*

**What idea 11 would do to this ladder (PROPOSED 2026-11-24; the stages above are unchanged until the owner rules):**
it adds no stage, it widens two and moves nothing ahead of Stage 1.
- **Stage 3 becomes "the photo shelf, then the site's face"** (F8 and F4 first, idea 7's surfaces as their first
  users). The coach's send and the club's inbox and pick arrive here. This is the rework guard: built as drawn before
  idea 11, Stage 3 would have made a banner upload, a team photo upload and an album upload, and the feed would have
  been a fourth.
- **Stage 4 (News) gains the feed's public half:** a post carries shelf photos, the win post is composed from the
  score, and a pasted Instagram or Facebook link shows as a post (option B).
- **Stage 9 (share kit) gains option E.**
- **Parked, no stage:** connecting an Instagram account (C) and posting to Instagram from the product.
- **Where it sits, said plainly (owner asked 2026-11-24, "I don't see idea 11 in the ladder"):** no stage of its own.
  Stage 3 = the shelf, the family's question, the coach's send, the club's pick (now the largest stage; its own
  drawing session decides one build pass or two). Stage 4 = the public half, where a club first sees the win post and
  an Instagram post. Stage 9 = the made-for-Instagram image. The Instagram post cannot ship ahead of Stage 3: it meets
  the same published promise as a photo. Stages 3 and 4 depend on Stage 1 only, so they could run before Stage 2 with
  no rework; that is option C on ask C4, and the session's recommendation stays field status second. The drawings'
  Ladder tab now names idea 11 in rows 3, 4 and 9 and in a note above the table (version 3).
- **Drawn 2026-11-24** as tab 11 of the Stage 0 page, after `/legal`, with `/ux`, `/design` and `/marketing` on the
  drawing (Progress). It changes the shape of ask A8 (C8 widens it).

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
- [x] **Stage 0's 26 asks — RULED 2026-11-24 by the owner's paste-back** (before Milton's three answers reached the
  prompt's feedback slot; the owner's call, so C0's "not ruled until that slot has been looked at" is spent). The
  recommended option on 25; **A12 is B**. The wording ruled is the drawings' Asks tab (tab 16). His words where he
  added any are quoted; what they ask for is in brackets.
  - **A1–A5, A7, A10, A11: A** as recommended (fixed home order; one region in two parts; a running tournament as one
    row; one Close a place window over the Rainout; rep games marked, coach emailed; `/{club}/news` = News with a door
    to a live tournament; "Email me when it opens" to CASL, no confirmation email; trophy case = recorded rows plus
    rows the club adds, marked).
  - **A6: A** — *"we already are working on stopping this from happening in tournaments, can we ensure that all
    schedules that enter locations populate official venues? not necessarily in this project but something to work on
    separately so we don't have to worry about exceptions like this."* [Recorded against the `real-venues` project as a
    request to widen it from tournament games to every schedule (house league, rep, tournament); not this project's
    work. A6 = A stays the interim answer until that ships.]
  - **A8: A** — *"can you confirm with legal about the stance here? how do apps like instagram and facebook get away
    from posting whatever anyone wants to post and we are so restricted? its hard to show images of teams at a diamond
    without potentially having someone else in the background. these are public parks"* [→ `/legal`.]
  - **A9: A** — *"I would be interested to see the drawings of both, so when we get to this phase show both in the
    drawings before I confirm."* [Stage 3's drawing session draws the banner on a phone AND without it; A9 is
    confirmed there.]
  - **A12: B** (it loads at once; the privacy policy and the outside-services list are reworded first) — *"i want to
    have /legal review and let me know the ramifications of this decision. clearly loading at once is the better user
    experience, and the loading of images is left to discretion of the club, it is a hard thing for us to have to
    police. also it looks like so many products offer this like instagram and twitter and facebook"* [→ `/legal`: the
    ramifications.] **⟶ CHANGED 2026-11-24 to the middle path** after `/legal`'s answer (owner: "take the middle
    path"): the club's own picture shows at once from our copy of it, with "See this post on Instagram" as a plain
    link. Nothing is sent to Meta unless the visitor taps the link, so Privacy §4 and the subprocessor list stay true
    as written and the same page works for a Québec club. The picture goes through the photo rule like any shelf
    photo, which also settles A16 for these posts. Instagram's own box (likes, comments) does not show. The admin
    picks the picture as well as pasting the link (the coach has usually already sent it). Stage 4 draws the add
    window again around this; whether the link alone (no picture) is ever allowed is for that drawing.
    `docs/agents/legal/CLUB_WEBSITE_STAGE0_RULINGS_REVIEW.md`.
  - **A16: A** — *"similar thought to A12, would like to hear the legal logic behind such restrictions."* [→ `/legal`.]
  - **A13: A** — *"don't the clubs have their own terms and conditions that they need to follow? why are we policing
    things like this?"* [→ `/legal`.]
  - **C5, C6, C7, C8, A14, A15, C9: A** as recommended (one Instagram post at a time from a pasted link, connecting an
    account parked; coaches send, the club picks; one "News and Photos" permission, drawn with Team structure; A8's
    rule widens to any photo filed under a team; asked every season; a post is the unit, no Photos page; no video
    stored, unused photos removed after 12 months, allowance and gate to `/strategy`).
    **C8 SOFTENED 2026-11-24** after `/legal`'s answer to A8 (owner: "yes soften it"): "only that team in the photo"
    becomes **"the players in it are from this team; anyone else is in the background, not the subject"**. The
    coach's tick on the send window reads that way. A recognizable child from another team as a subject still does
    not show (we hold no answer for them).
  - **C1: A** (same-size tiles, lead with the season report) · **C2: A** (no public house league team page) ·
    **C3a: A** (Track P runs alongside the stages, starting now) · **C3b: A** (a prospect's club is made on production,
    unlisted, marked as our preview, removed 30 days after the meeting unless claimed in place) · **C4: A** (the
    ladder's order as recommended, field status second).
- [x] **C1 — Sponsor tiers. RULED A 2026-11-24** (above). Idea 5 is stronger with larger tiles for bigger sponsors; same-size tiles is the
  2026-10-19 ruling. Recommendation: keep the ruling, lead with the report.
- [x] **C2 — House league team pages. RULED A 2026-11-24.** A public games-only page per team is where a team's sponsor would show. On
  2026-11-22 the owner kept a team's sponsor on About only ("there is no public team page").
- [x] **C3 — The demo ruling. RULED 2026-11-24: C3a A, C3b A.** Idea 1 puts a club demo ahead of "the demo comes after launch". Recommendation: move
  it up as Track P; it is the only item that changes a prospect's first minute. *(Stage 0 split it: **C3a** move it up,
  yes/no; **C3b** where a prospect's club lives: on production, unlisted and claimed in place (recommended), or on dev
  with a copy into production at claim.)*
- [x] **C4 — The order of the ten. RULED A 2026-11-24.** §5's order is a recommendation; the corrected ladder is on the drawings' Ladder tab.
- [x] **Stage 0 shape asks, A1–A11** (RULED 2026-11-24, all A; see the first item of this section): A1 the
  home's order (fixed: Open now capped at two rows → games → News); A2 one region in two parts; A3 a running tournament
  as one row; A4 one Close a place act over the Rainout; A5 rep games marked, not moved; A6 typed-place games listed
  unticked; A7 `/{club}/news` = the club's News page with a door to a live tournament; A8 a player photo only while
  everyone in it has said yes; A9 the banner stays computer-only (keeps 2026-10-20); A10 "Email me when it opens"
  built to CASL, no confirmation email; A11 the trophy case holds recorded rows plus rows the club adds, marked.
- [x] **Idea 11's ten asks are on the drawings' Asks tab** (tab 16, group "The club's feed"), RULED 2026-11-24, A
  each time except A12 (B): C5, A12, A16, C6, C7, C8, A13, A14, A15, C9. The wording there is the current one; the five
  calls below are as first written and are kept for the reasoning.
- [x] **Idea 11's calls, C5–C9** (added 2026-11-24; RULED A 2026-11-24, in tab 16's wording):
  - **C5 — Instagram on a club's page: how far.** Recommended: paste one post's link, chosen by the admin, shown in
    News with the caption off (§5.1 option B); connecting an account parked until a second club asks; no third-party
    widget. A pasted post is the club's own publication on Instagram, shown on a site that promises no child is named,
    which is why the caption is off by default; `/legal` reads it, with Meta's script loading for every visitor.
  - **C6 — Who sends, and who publishes.** Recommended: any coach or team staff sends for their own team; nothing
    reaches the public until the club picks it; the sender sees what became of it. The other option: a coach publishes
    to their own team's page with no club pick.
  - **C7 — A "can post, nothing else" permission.** Today only the owner or an admin may change the site. A club's
    social volunteer is usually neither. Recommended: yes, one narrow permission for news and photos, drawn with the
    Team structure project's people work so there is one set of permissions.
  - **C8 — A recognizable child in a win photo.** Stage 0's `/legal` read says a news photo shows no recognizable
    player; the photo this club is asking to post is exactly that. Recommended: ask A8's rule widens to every photo
    filed under a team (it shows only while everyone on that team's roster has said yes; a missing answer is no;
    withdrawal hides it at once), and a photo filed under no team shows no recognizable player. `/legal` before it is
    drawn. **The rep door comes first** (§9): rep teams are the ones with wins and trips, and if a rep family has no
    place to answer the question, no rep photo ever shows.
  - **C9 — How much a club may keep, and video.** Recommended: no video is stored (a link to where it was posted);
    a storage allowance and the gate are `/strategy` calls against `PLAN_PRICING_FACTS.md`.

- [x] **Club events in the end state, E1–E9 — RULED 2026-11-25 (owner pasted "E1: A … E9: A", all nine as
  recommended).** Wording as on the events drawing's Asks tab
  ([CLUB_WEBSITE_EVENTS_DRAWINGS.html](CLUB_WEBSITE_EVENTS_DRAWINGS.html), tab 10). Each is option A:
  - **E1** an event on the home: one row per event, an Open now row while its sign-up is open, otherwise a "Coming
    up" row in the home's News part; never both.
  - **E2** the News page opens with "Coming up" (every public event), then the posts; the News tab shows when there
    is a post OR a coming event.
  - **E3** no Events tab (the phone row already scrolls past its fifth tab; News makes six); Board Ready 8A stays withdrawn.
  - **E4** one page per public event, lighting News; its address is the shareable sign-up link; after the event an
    old link reads "This event has ended" with a door on.
  - **E5** if Board Ready Stage 5 ships first, it builds the event page and the Open now row to this drawing; events
    with nothing to sign up for travel by link until Stage 4; a champs day's games join its page with Stage 1.
  - **E6** a champs day is one Today row opening the champs page (A3's pattern); the day after, one Latest results row
    opening the season's schedule for that day.
  - **E7** Close a place lists the club's events at that place, each opening in Events; nothing moves by itself.
  - **E8** an event is a sponsor place: a line on its page, counted in the season report.
  - **E9** this project's Stage 3 owns the one photo question; camps and clinics ask it in place of Board Ready's
    12A; a photo filed under a camp follows the team rule; `/legal` settles required versus optional. **Owner
    2026-11-25: "legal now".** `/legal` answered the same day
    ([CLUB_WEBSITE_E9_PHOTO_QUESTION_REVIEW.md](../../agents/legal/CLUB_WEBSITE_E9_PHOTO_QUESTION_REVIEW.md)):
    optional, neither picked, blank = No (reverses the Stage 0 drawing's required mark); its five owner calls are
    P1–P5 on the events drawing's asks tab, **RULED 2026-11-25: all five A, as recommended, no notes** (owner
    paste-back: P1 A · P2 A · P3 A · P4 A · P5 A). In the asks' own words:
    - **P1** optional: two choices, neither picked, a blank answer counts as No (the Stage 0 drawing's required
      mark is corrected under it).
    - **P2** one Yes covers the club's public website AND its own social media pages, both named in the question;
      never posters, share images, sponsor places or downloads.
    - **P3** a camp Yes and a team Yes are separate answers, each read only for its own program, and only for
      accepted sign-ups.
    - **P4** the photo answer stays changeable after the answers-closed lock for as long as Your sign-up works; the
      website hides the photo at once and the club takes down its own posts; a club may record a written change,
      marked "recorded by the club".
    - **P5** fixed words, versioned with each answer; a club can't edit them.

- [x] **Club events on the schedules people read (owner question 2026-11-25; drawn the same day as tab 10 of the
  events drawing; asks E10–E12 RULED 2026-11-25: all three A, as recommended, no notes** (owner paste-back: E10 A ·
  E11 A · E12 A)**).** Owner: *"will we
  be able to link club events with certain calendars like house league and rep schedules? there might be an internal
  banquet for all rep teams, or champs day is a part of house league so users will want to see that all in the same
  schedule. has that been ironed out?"* **Settled already** (Board Ready §5 Stage 5 rulings 3, 5, 7 and 10): the club
  calendar carries club events as a fourth program; a champs day names a house-league season and gathers that day's
  games under it, one block that opens to them; the family app (built with it) lists coming events below the family's
  teams and says when their child plays. **Not settled:**
  - (a) *A champs day on the house-league season's own public schedule.* Its games are there already, with no word that
    the day is champs day and no door to its page. This project's (what shows events); fits Stage 1, which already
    gives the house league pages their refresh.
  - (b) *An event for part of the club* (every rep team; one house-league division). "Shown to" is Everyone or Club
    staff, with "Our families" only once the family app is on; "Who it's for" holds birth years for camps. An internal
    rep banquet today is Club staff plus a Communications message. Board Ready's (it owns who an event is for).
  - (c) *A club event on a club rep team's schedule* (the public team page is games only, §3; the coach's own schedule
    is the coach's, D3 and the coach books ruling). Neither project has it; an owner call.
  Owner 2026-11-25: "yes draw the tab now". Recommended A each time, and ruled A each time the same day:
  - **E10** (a), this project's: a band over a champs day's games on its season's schedule, in every division tab that
    plays that day ("Champs day", its name and place), opening the champs page; it stays the day after with no door.
    Into Stage 1's page.
  - **E11** (b), Board Ready's to record: "Also on these schedules" in its event window (None · a house league season,
    all divisions or some · rep teams, all or some). It decides where the event is listed, never who may see it
    ("Shown to" still does). An Everyone event for a season is a row in its week on that season's public schedule.
  - **E12** (c), owner call: a read-only row on each named club team's schedule in the coaches portal, "From the club ·
    Club event" (the pattern of the club's practices, Club Tier 11a, the shipped exception to D3), opening the event
    with "Ask the club"; never on the public team page; the team's families see it only if shown to Everyone or, with
    the family app, Our families. Built by Board Ready Stage 5 beside the calendar.
  Code facts the drawing rests on: the public house league schedule groups by week with a Today line and has no
  whole-day label (rainouts never show there); the coach's schedule shows club practices "From {schedule} · the club’s
  schedule"; the signed-in family pages read the team's schedule (so E12 needs its staff-only rule); the club calendar
  has three programs today and no club-level kind.

- [x] **Track P — 16 asks T1–T16, RULED 2026-11-25: all sixteen A, as recommended, no notes** (owner paste-back:
  T1 A · T2 A · T3 A · T4 A · T5 A · T6 A · T7 A · T8 A · T14 A · T9 A · T10 A · T15 A · T16 A · T11 A · T12 A ·
  T13 A). Two things the A answers do not settle, said on the asks themselves: **T11** rules the behaviour (removed by
  itself nightly); the production job is shared automation and is built only on the owner's word in the session that
  builds it. **T13** is ruled, but its one email cannot send until the mailing address below exists.
  Drawn 2026-11-25. Page: [CLUB_WEBSITE_TRACK_P_DRAWINGS.html](CLUB_WEBSITE_TRACK_P_DRAWINGS.html),
  published https://claude.ai/artifact/Tx3So1rUqL6shn7CzM93Zr, tab 9 with a paste-back. (Named T, not P, because the
  events drawing's photo calls are P1–P5.) Ruled A on each: T1 one preview marker read by every count, list,
  search and email, held by a build check · T2 the owner only makes one · T3 the public site only, no people · T4 one
  fixed sample, every name made up · T5 one tournament game live at the meeting time, the owner types its score · T6 5
  open at once · T7 the claim code on the room card, never emailed · T8 keeps name, address, logo, colours, sport and
  line; clears all sample in one all-or-nothing step · T14 cleared at the press · T15 masked claimant + undo until a
  plan starts · T16 the Terms §3 paragraph and Privacy sentence ride the next Terms version · T9 exactly Start a club's
  plans, trial and checkout · T10 a customer from the claim day · T11 removed by itself nightly (a new production job,
  the owner's word in that session) · T12 "This preview has ended" for 90 days, then not-found · T13 one email, to the
  person met only. Recommended build order: T1's marker → Prospect clubs + Make one → the marking → the room → the
  claim → the removal. **Owed from the owner, not an ask:** a mailing address (`FIELDLOGICHQ_SELLER_MAILING_ADDRESS`
  is `''` by his 2026-11-17 ruling); T13's email cannot send without one.
- [x] **Stage 2 (Close a place) — 17 asks K1–K17, RULED 2026-11-25: all seventeen A, as recommended, no notes**
  (owner: "Agree with all recommendations. Can you make the build prompt?"). K11 is A, not B: Reopen does NOT put back
  the games that haven't started. Drawn 2026-11-25. Page:
  [CLUB_WEBSITE_STAGE2_DRAWINGS.html](CLUB_WEBSITE_STAGE2_DRAWINGS.html), https://claude.ai/artifact/N332KzJg8NgFJb4oZvJhwM
  (tab 10, paste-back). Build prompt: [CLUB_WEBSITE_STAGE2_BUILD_PROMPT.md](CLUB_WEBSITE_STAGE2_BUILD_PROMPT.md). Ruled A
  on each, in its wording: **K1** the Rainout's people (owner, admin, house league admin) close and
  reopen; others' programs show as counts with no door · **K2** a whole place or one diamond · **K3** Day + Until; the
  strip from the press ("closed tomorrow"), gone by itself after Until · **K4** one strip box, a line per place, then the
  club's own notice · **K5** a closure sends at once (no hold) · **K6** scored games never listed; a started game listed
  unticked, "Started at 9:00 a.m." · **K7** typed places found by the place's name inside the text, any case; unticked;
  "Link both" tells no family · **K8** no wait on R4; a no-places state opens the Venue library · **K9** the rep mark on
  the coach's schedule and game sheet, the public team page, the family schedule and the home; cleared by the coach's
  move or cancel, or Reopen · **K10** the coach email in /legal's fixed words, at the press, "{Club} via FieldLogicHQ",
  admin reply-to; no head coach = other coaches, none = the result says so · **K17** "Needs a new date" at the top of
  the public schedule while it holds a game postponed in the last 7 days (every Rainout) · **K12** no strip on a
  tournament's pages · **K13** every tournament playing that day listed; the Rain delay opens on that day with the
  place's diamonds · **K11** Reopen: strip and marks down, one line to each marked game's coach, games stay waiting
  (B adds "put back the games that haven't started") · **K16** the strip in fixed words only · **K14** League Plus,
  Club, Club · Association on the places gate, no new key, replaces the Rainout everywhere · **K15** the house league
  "Rainout" button opens Close a place on that season's places that day; "Rainout" one word everywhere. Milton's
  three answers were not in when drawn.
  - **K15 amended, owner 2026-11-26** ("not a huge fan of the format of this link … why is it called rainout in house
    league and close a place in the dashboard and venue library?", then "go ahead and build it"): the house league button
    is named **"Close a place"**, keeps its rain-cloud icon and still opens on that season's places that day. All three
    buttons (house league schedule, Venue library, Overview) read the same words with the same icon. On the Overview the
    underlined link beside This morning is now an outlined button at the right end of the page's first heading (The club
    today; This morning for those without that band), and it opens the window on the Overview. "Rainout" stays one word
    where it still appears (the older held Rainout's banner, help search words).
  - **K3's two lists became calendars, owner 2026-11-26** ("we don't need a time follow up, just do the calendar
    swap"): Day and Until are the product's date field, with the same limits and defaults; the second is labelled **"Until
    the end of"**. A closure stays whole days; part-of-a-day closing is not wanted. Then, "yes" the same day: while Until
    matches the Day, changing the Day moves both; a longer range the admin picked keeps its last day while the new Day
    allows it.
- [x] **Stage 2 follow-up (close several places in one press) — 8 asks M1–M8, RULED 2026-11-26: all eight A** (owner:
  "all A, go ahead and get the build prompt"). Raised by the owner on the built window ("should this not be multi select
  for the parks?", then "did we cover the scenario if 2 out of 3 diamonds at a park are closed?"). Drawn 2026-11-26.
  Page: [CLUB_WEBSITE_STAGE2_PLACES_DRAWINGS.html](CLUB_WEBSITE_STAGE2_PLACES_DRAWINGS.html),
  https://claude.ai/artifact/6DBZd4dZaLwLMBnJA4TYps. Build prompt (Session 2D):
  [CLUB_WEBSITE_STAGE2_PLACES_BUILD_PROMPT.md](CLUB_WEBSITE_STAGE2_PLACES_BUILD_PROMPT.md). Ruled A on each, in its
  wording: **M1** a dropdown with ticks, and a row under it for each chosen park · **M2** from the schedule, the season's
  parks already chosen, removed with ✕ · **M3** from the Venue library, nothing chosen · **M4** Day and Until above the
  parks · **M5** All our fields replaces the parks with one line and locks the other ticks; removing it brings them back ·
  **M6** the limit of 10 stays and the dropdown says so · **M7** on a phone, a bottom drawer with large rows and Done, for
  places and diamonds · **M8** several diamonds at one park ticked and closed in one press (a small database change).
  **M8 replaces K2's "two diamonds = two closures".**
  - [x] **D1, RULED 2026-11-26: A** (owner: "D1 A, add it to the prompt"): a ticked game with no diamond recorded, when
    two or more of that park's diamonds close, keeps its mark until every one is reopened, and the words name the park.
    (B was: the first diamond owns it, as today.)
  - [ ] **Session 2D BUILT and committed 2026-11-26; walk §577 is the owner's.** The owner said yes to the
    recommendation the build session put before code ("yes to the recommendation, go ahead"): D1 by **marking every
    matching closure** (mig 549: one mark row per closure the game is at; nothing written at Reopen), and the surfaces
    the drawing did not show: the result "2 diamonds at Lions Park closed" and "Reopen them"; Reopen counts only the marks
    that come off and adds "1 rep game stays marked while Diamond 1 at Lions Park is still closed…"; the Venue library
    keeps a row per diamond; the Overview's **Places closed counts parks** ("2 diamonds at Lions Park"); Changes to send's
    waiting banners unchanged; the Rain delay line and the rep email say the park ("2 diamonds at Lions Park"), the
    email lists a D1 game once, and the last reopen says "the diamonds at Lions Park that were closed" reopened (/legal 2026-11-26, its words; passed otherwise). Mig 549 proved by a rolled-back dev dry
    run (T1–T16, 35 of 35), then **applied to dev 2026-11-26** at the owner's word ("apply 549 to dev"), twice, read back,
    35 of 35 on the applied schema; snapshots refreshed. Found in the build: the house league "Place closed" reason read
    (`leagueClosureReasons`) has no caller, so D1's words have no house league surface to change. Two defects fixed with
    it (an empty choice left the old games and an enabled button; a day the season uses no place left the old day's
    parks). **⚠ Open for the owner (raised before code, not decided):** two SEPARATE presses on two diamonds of one park
    behave differently from one press — the second lists the no-diamond game again, unticked, and covers it only if
    ticked again (its coach then gets a second email); left unticked, reopening the first diamond clears the mark and
    tells the coach, though the other is still closed.
    **Close-out, 2026-11-26** (owner: "give me the prompt for simplify, review, design, publish the walk then commit"):
    **/simplify** applied (one title in the phone drawer, one home for the 10-entry limit, the window's reads no longer
    load the closed rows, dead helpers removed). **/review** (high-risk, five readers) applied: only the admin's own
    ticks are remembered (the window's own tick had been carried, so narrowing a park left a "maybe" game ticked); one
    cancellable re-read after a refusal; **Reopen now reads whom to tell after the stamp and claims a game's marks
    together** (two diamonds reopened at once had told nobody; Reopen pressed again on an earlier diamond emailed twice),
    pinned by `place-closure-reopen-told.test.ts`; a closure past its last day holds nothing; the Reopen window, the
    Rain delay line (several parks: "Their diamonds") and the help's one-email sentence corrected. **/design** against the
    drawing applied (the open Places list was cut off in the short window; a "Typed" line under a game picked from the
    library). Mig 549 unchanged. Left, for the owner to know: a typed rep game naming two closed parks is marked by both
    (changing it edits 549); a tournament's Rain delay picks every diamond linked to the park (older: diamonds link to a
    park only); Close and Reopen check the role, not a person's module switches (older); a mixed Reopen email names the
    one diamond (built so); past four lines the strip's "And N more places" counts diamonds; `leagueClosureReasons` has
    never had a caller and can be deleted in a later tidy-up; the house league band heading in the window wraps (older).
    **Walk §577** published (five walks, 45 steps; the seed's new `--places-walk`):
    https://claude.ai/artifact/NSxAyvXrBcjaDXcsNxNSXr.
- [x] **Stage 1 (game day on the club home) — 11 asks G1–G11, RULED 2026-11-25: all eleven A, as recommended, no
  notes** (owner paste-back: G1 A · G2 A · G3 A · G4 A · G5 A · G6 A · G7 A · G8 A · G9 A · G10 A · G11 A). G6 is A,
  not D: no "Updated" time line. Drawn 2026-11-25. Page:
  [CLUB_WEBSITE_STAGE1_DRAWINGS.html](CLUB_WEBSITE_STAGE1_DRAWINGS.html), published
  https://claude.ai/artifact/Y8yvdP4H5dzAhDiEtG6TdL (tab 9, paste-back). Ruled A on each, in its wording:
  **G1** no look-ahead on a day with no games (the part is absent) · **G2** Latest results holds today and two days ·
  **G3** no filter chips in Stage 1 · **G4** four rows a band in a stated order (tournament or champs day first, then
  time, then house league by division from the youngest, then rep, then place), the rest open in place, a link to the
  season's own schedule when a band is capped · **G5** a rep team's away games show · **G6** schedule, standings and
  season page check every 30 seconds from half an hour before the day's first game to the end of the last window, the
  home's games part the same (D = A plus an "Updated 10:15 a.m." line) · **G7** one live rule for all three programs
  (house league "Score after the game", then "No score yet" in Latest results; rep the coach's running score), the rep
  "T 4–2" defect fixed first · **G8** stacked rows in the 540 column on a computer (the prompt asked for one-line; the
  layout standard's R6 says stacked under 600 px) · **G9** the Tournaments card says "Games today", not "Live now" ·
  **G10** no change to who makes a rep team public; the site editor says how many show · **G11** a failed first read
  shows "Games can't be shown right now…" with a link and Try again, all or nothing; a failed check says nothing.
  Milton's three answers were still not in when he ruled (the asks tab said so). E10 (a champs day band on the season's schedule) is
  drawn on tab 5 at its recommended A and is ruled on the events drawing, not here (ruled A there, 2026-11-25).

## Progress

- 2026-11-24 — Logged. Roadmap rows added and shown on the Milton deck (slide 13) and the public roadmap drawing; the
  owner confirmed the same day that the game day line stays at "Q2 2027 · targeted" on the slide ("those are all
  settled"; the session's reading of his answer, the roadmap's Ruled column is left blank until he places the row in
  his own words). Stage 0 kick-off prompt written; the owner is asking Milton three questions in the meeting (in the
  prompt's feedback slot). Nothing drawn, nothing built.
- 2026-11-24 — **Stage 0 Part 1 done (the walk and the census). Nothing drawn yet; Part 2 next.** Captures at true size
  (390 and 1280, DPR 1) in `docs/projects/active/club-website-stage0/`: `today/` and `gameday/` = Kestrel Bay on dev
  (the extras seed run at 09:55 Toronto for a live Fall Classic), `milton-staging/` = Milton's public pages on staging
  (the notice-up state; the only fixture with sponsors). Script `.probe/club-website-stage0/capture.mjs` (read-only).
  **States that could not be staged:** a true quiet day (Kestrel's 2026 house league is open until Dec 25; its home is
  otherwise the quiet day — Teams, House league, a finished tournament, About); a rep team page WITH its public schedule
  (no team on dev is both "public link" and has games: 2 public-link teams, 0 games; Kestrel's team is not public, and
  Milton's team pages are broken, below). Part 2 draws those from the shipped component and says so on the page.
  **What the walk found, in the order it changes the work:**
  1. *On game day the home does not change.* Kestrel with two games live: the only difference is a green "Live now" chip
     on the fourth card down. Milton's home is 3,076 px on a phone, and 20 team rows in one list are most of it
     (Team structure's Stage 0 has not run, so the Teams section is a placeholder frame in Part 2).
  2. *F2 does not exist publicly, and the nearest thing must not be reused.* `readClubCalendar` (`lib/club-calendar.ts:128`)
     reads rep, house league and tournament games club-wide, but for staff, with NONE of the publish rules. The public
     rules live per program: rep = `getPublicTeamSchedule` (`lib/public-team-schedule.ts:29-38`, one team at a time,
     guard test `club-stage6d-feeds-guard`); house league = season not draft + `schedule_published_at` + unsent changes
     held back (`lib/league-game-changes-server.ts:143-151`, but standings and the season page repeat it inline);
     tournaments = status active/completed + division published (`lib/public-games.ts:19-28`, the literal repeated in 6
     files). Stage 1's read must CALL these, never copy them. A rep team's draft season counting as live
     (`lib/family-view.ts:233`) is the 2026-09-28 ruling (`lib/season-live.ts`), not a leak: a rep game is public the
     moment it is typed, if the team is set to "public link". Few are, so rep games will be thin on the home.
  3. *F3 is closer than the plan assumed, and it collides with something built.* Permits always point at a real place
     (`org_time_blocks.org_venue_id` NOT NULL); house league and rep games can (pick from the library, or type a name:
     `lib/league-venue.ts:60-66`); tournament games reach the club's place only through an import link. The rep public
     page shows the typed copy. **House league already has a Rainout** (`league_rainouts`: a whole day called off,
     matched on the place NAME) and tournaments a Rain delay by venue. Field status must be drawn as the same act as
     those, not a third one beside them. A count of typed-only games is owed before Stage 2 (dev, counts only).
  4. *F6's premise is gone.* The live bracket's faster path (`LogicSyncBracket`) was deleted and a test stops it coming
     back (`tests/unit/public-tournament-stage4-guard.test.ts:151`). Pages poll every 30 seconds, pausing when the tab
     is hidden; house league pages do not refresh at all. The open read is still there (`games_anon_read USING true`,
     27 columns granted, DATA_DICTIONARY.md:1194; line 1195 still names the deleted reader). Stage 6 is a choice
     (faster polling, which adds no exposure, or a realtime path that leans on the open read), not a wait on `/db`.
  5. *F7: "claim it" cannot work from today's seed.* Four guards hold it, not one: dev host only, the config slug, a
     marker on the organization, a dry-run (`scripts/seed-prospect-demo.mjs:54-59,84-88,135-138`). Staging reads the dev
     database, so a prospect's world lives on dev and a real sign-up happens on production: no collision, and no way to
     claim. Track P is a copy-into-production step or a prospect world on production; that is C3's real shape.
  6. *F4 is empty:* no photo or media consent anywhere, no team photo, and the phone banner is hidden by CSS
     (`ClubSiteHome.module.css:9-11`). *F5:* sponsors show in three places (home strip, About, "Sponsored by" on house
     league schedule and standings); none on rep, tryout, tournament or share images; nothing is counted.
  7. *◦ items re-checked:* calendar subscribe TRUE (public-link teams only); tournament demo has no sponsors/news TRUE;
     coach demo not public TRUE; Clubs page never pitches the site PARTLY (one passing line); documents are links and
     contacts role + email TRUE; QR only in the staff kit and rules PDF TRUE, but club share-preview images DO exist
     (home, team, tryout); no house league public team page TRUE (the `/league/.../team/` page is the coach's, signed in);
     BRAND_STRATEGY and PRODUCT_ROADMAP still read as if Club is not on sale TRUE; `lib/club-shortcut.ts:14-15` stale TRUE.
  8. *Notice:* `org_site_notices` has a posted and an end time, no start (shows the moment it is posted).
- 2026-11-24 — **Stage 0 Part 2 + Part 3 done: the end state is published, the asks wait.** Drawings:
  [CLUB_WEBSITE_STAGE0_DRAWINGS.html](CLUB_WEBSITE_STAGE0_DRAWINGS.html), published as
  https://claude.ai/artifact/QuKPkzWBcLFLxgreaLVzvB (15 tabs: walk, home in five states + computer, rep team page,
  house league, news, sponsors, trophy case, Big Board, share kit, admin doors, Track P, Teams placeholders,
  foundations, ladder, 16 asks with a paste-back). New capture: Milton U15 Rep Purple on staging
  (`milton-staging/teams__u15-rep-purple.*.png`); its schedule is `families` with 0 games (dev, counts only), so the
  page has no Schedule section and the frame draws it from `RepTeamPublicSchedule`. The broken `u15-rep%20purple`
  captures were removed. **Milton's feedback slot was still empty at publish;** the asks tab carries the prompt's line.
  `/ux`, `/design`, `/legal` (three items) and `/marketing` (one words pass) ran before the owner saw it; what changed:
  1. *The home's order is FIXED* (A1 recommendation changed after `/ux`, from "Today lifts above Open now on game
     days"): notice slot → Open now capped at two rows + "N more" → the games part ("Today" / "Latest results") →
     News → Teams…; a dashed 844 px line on every phone frame shows the first live game still in the first screen
     with four things open.
  2. *Field status = "Close a place"*: today's Rainout window widened to a place, with Until (the notice's Ends
     choices), Reopen, a result line; house league postponed/cancelled as built, rep games MARKED for the coach,
     tournament games handed to the Rain delay, typed-place games listed unticked with "link both". The strip rides
     the notice slot; no closure news post while it is up.
  3. *Words (`/marketing`)*: "This week" → "News"; "Lions Park closed · waits for a new date" everywhere;
     "{Division} has N spots left" (never "nearly full"); "Registration opens {date}" only from a typed date; no
     pills under a heading that already says it (`PublicGameRow` rule); sponsor report "Page opens · Clicked ·
     Counting since"; "Close a place". Settled for the drawings; each stage still runs its own `/marketing` pass (§10).
  4. *`/design`*: bands are rows inside one list; Postponed is the shipped pill (no amber edge); type scale 12–24;
     60 px link rows; computer one-line game row; the Big Board named as an exception (club fill as ground, white
     cards, ×2 scale); the phone banner made an ask (A9) because it reverses 2026-10-20.
  5. *`/legal`*: team photo consent belongs to the people IN the photo (roster kept at save, checked every time the
     page is served, a missing answer = no, withdrawal hides at once); news photos show no recognizable player; no
     player photo in posters, share images or previews. Sponsor counts: no consent needed if nothing about a visitor
     is kept (no IP, no hashed id, apart from hosting logs, no analytics vendor) + one privacy-policy sentence.
     "Email me when it opens" is a CASL commercial message sent by the CLUB: name + mailing address + withdrawal in
     the consent sentence, an unsubscribe even for one email, records 3 years. Track P: visible "Prepared by
     FieldLogicHQ for {club}. Not their site yet.", noindex, their own published logo only, fictional sponsors.
  Nothing built, nothing ruled, nothing committed.
- 2026-11-24 — **Idea 11 added from Milton Bats' meeting (the club's own feed). PROPOSED; not drawn, not ruled.** The
  owner brought one piece of feedback from the demo: the club wants to promote wins and tournament trips through its
  site, already uses Instagram, and asked how items from coaches and admins would be gathered, sorted and chosen. Two
  helper reads ran (what the product holds for pictures and posts; what Meta allows today) and the lines the
  conclusions turn on were re-opened. Recorded: the gap row in §2.3, foundation F8 in §4, idea 11 in §5 with the full
  write-up in §5.1 (six options, D + B + E recommended, C parked, F refused), the ladder note in §6, calls C5–C9 in
  §7, two findings in §9, and the feedback itself in the kick-off prompt's slot. **The three questions the owner was
  asking in the room are still unanswered in that slot.** The drawings do not show idea 11; drawing it in comes before
  the asks are ruled, on the owner's word.
- 2026-11-24 — **Idea 11 read by `/legal`, then drawn into the Stage 0 page as tab 11 (owner: "yes, run /legal first
  then draw it in"). Republished, version 2, same address. Nothing built, nothing ruled, nothing committed.**
  1. *`/legal` first* (topic `docs/agents/legal/MINORS_IMAGES_AND_CLUB_FEED.md`; primary sources and our own published
     texts): a child's photo is sensitive information; the family's yes is its own question, neither answer chosen for
     them, never a condition of signing up (OPC finding #2025-005, read twice); the club is the publisher and we host;
     **the published Privacy Policy and Data Terms both say children's information "is never shown on public pages", so
     a new version of each comes before any player photo is public**; an Instagram post should load on the visitor's
     tap, which keeps "no tracking cookies" true as written; four product findings routed in §9.
  2. *The owner's follow-up (one Instagram post from a link):* yes, Instagram offers it officially, with no approval
     from Meta since 2026-06-15. Detail and what is not confirmed: §5.1.
  3. *The tab, five steps:* a coach's Send to the club (phone; a Photos / A link switch; the coach says who is in the
     photos); the club's Photos shelf and the pick (two decisions; Take down on everything posted); the public side
     (News with pictures, one post with stacked photos, a team's own posts); an Instagram post (the add window, the
     post behind "Show this post", Instagram's own box marked as not ours); a family's yes (the question, the club's
     answers list with Change and Record an answer, where it is asked).
  4. *What the reviews changed:* `/ux` (12 findings): Photos and A link are one switch, the note folds away, "Waiting"
     says who it waits on, the coach and not the admin says who is in a photo, the club gets Take down and Change, and
     an Instagram post that shows players became its own ask (A16). `/design` (12): the pick lost three fields
     including the typed Kind, photos stack with no dots, phone links are 44 px, Instagram's box is dashed and
     labelled, the answers table is 800 wide with an action column. `/marketing` (18 strings): "Sending publishes
     nothing", "Nothing is public yet", the family's question now says "Anyone can see them". One local look at the
     rendered page before and one after the redraw; no overflow at 1400 or 400 px, no script error, 26 asks render.
  5. *Recommendations that changed from §5.1 as first written:* no separate Photos page (a post is the unit; photos
     live in News, the home page and their team's page; ask A15); no typed category at all (team, event, date and
     sender arrive with the photo); the window names Instagram only until Stage 4 confirms Facebook's options.
  6. *The ten asks on tab 11:* C5 Instagram, how far · A12 how an Instagram post loads (a tap, recommended) · A16 an
     Instagram post that shows players · C6 who sends and who publishes · C7 a seat that can post and nothing else ·
     C8 a recognizable child in a win photo · A13 where a rep family's answer comes from · A14 how long a yes lasts ·
     A15 where photos live on the site · C9 what a club keeps. Tabs after 10 moved down one (Track P is 12, Asks is 16).
- 2026-11-24 — **Stage 0's 26 asks RULED by the owner's paste-back** (§7: A on 25, B on A12). A6's request (every
  schedule saves a real place) recorded on the `real-venues` project as R4, not scoped. **`/legal` answered the four
  "why" questions** (`docs/agents/legal/CLUB_WEBSITE_STAGE0_RULINGS_REVIEW.md`); no ruling changed. Two things come
  back to the owner:
  1. *Open call, recommended:* C8's "only that team in the photo" softens to "the players in it are from this team;
     anyone else is in the background, not the subject". It answers the public-park point without weakening the rule.
  2. *For A12 (B stands):* before Stage 4 ships, Privacy §4's cookie sentence and the subprocessor list's "not on this
     list" gain an Instagram line (most likely a material change); build B with a setting, because a Québec club will
     need the tap. **A middle path was offered, not ruled:** the club's own picture shown at once from our copy, with
     "See this post on Instagram" as a link. It is as fast, sends nothing to Meta, and puts the post under our photo
     rule (which also settles A16).
  A13 and A16 unchanged; the logic is in the review. Nothing built, nothing committed.
- 2026-11-24 — **The owner ruled both `/legal` calls: "yes soften it, take the middle path, commit".** C8 softened and
  A12 changed from B to the middle path; both recorded in §7.
- 2026-11-25 — **Two drawing prompts written (owner: "yes write both prompts"), to run side by side:**
  [CLUB_WEBSITE_TRACK_P_DRAWING_PROMPT.md](CLUB_WEBSITE_TRACK_P_DRAWING_PROMPT.md) (half census, half drawing: making a
  preview on production, every production surface that counts, lists or emails an organization, the claim, the 30-day
  removal) and [CLUB_WEBSITE_STAGE1_DRAWING_PROMPT.md](CLUB_WEBSITE_STAGE1_DRAWING_PROMPT.md) (finishes tab 2's frame;
  traces the one games read to each program's own publish rule; draws to E1–E9's recommendations, marked, if they are
  still unruled). Order recommended to the owner: Track P first because Club is on sale and it is the only item aimed at
  a club signing up; Stage 1 first instead if no prospect meeting is near. **Track P's sequencing note:** Club went on
  sale on 2026-11-23, so C3a reverses nothing; it orders Track P beside the stages (BUSINESS_DECISIONS 2026-11-24, as
  corrected the same day). Prompts for Stages 2–9 are written one at a time, just before each session.
- 2026-11-25 — **Club events drawn into the end state (handover from the Board Ready Stages 5 + 7 session). Nine asks
  E1–E9 wait; nothing built, nothing ruled.** Drawn on a page of its own
  ([CLUB_WEBSITE_EVENTS_DRAWINGS.html](CLUB_WEBSITE_EVENTS_DRAWINGS.html)) so the ruled Stage 0 page is not reopened.
  It uses the same stylesheet and script, Kestrel Bay as the club, and a June weekday, champs day and the day after.
  Read from code and records on the way (the lines re-opened by the session):
  1. *The shareable sign-up link is already ruled* (Board Ready plan, §5 Stage 5, "yes to the shareable link"). The
     handover's question 2 said it was not, so E5 builds on it.
  2. *The phone tab row scrolls sideways* (`components/public/OrgSectionTabs.tsx` header: Tournaments, fifth, is past
     the edge at 390 px). News makes six tabs and an Events tab seven. This is E3's main reason.
  3. *Open now's rows are "you can sign up now", nearest deadline first* (`ClubSiteHome.tsx`). An event's open sign-up
     is that kind of row. It is E1's reason for one row per event, in the place that matches what a family can do.
  4. *§3's "no new no-login family doors" line quotes BD 2026-10-29 as first written.* BD 2026-10-31 narrowed point 4 to
     "no new SENT links beyond pay and unsubscribe". The reworded line is on the drawing's tab 9, and it goes into §3
     when E1–E4 are ruled. Board Ready's Your sign-up is the pay-link pattern that 10-31 kept, so there is no conflict.
  5. *Board Ready's drawing, two small drifts, for that project:* its camp page shows "17 left" and "Full" where its
     ask 19 rules "17 spots left" and "Full · waitlist open". Its camp form also puts the photo question ahead of the
     guardian line, which its 12A says comes first.
  6. *Champs day scores expose nothing new:* `show_standings` (mig 423) hides only the table, so a game's score is
     already on the public schedule.
  Written down with no ask (tab 9): the champs page reads through the one house league public-games rule
  (whichever of Stage 1 and the champs page builds first pulls it into one place, with a guard test); the 30-second
  refresh and Stage 6's motion count the champs page; the staff-calendar guard names the event and champs pages.
- 2026-11-25 — **Schedules tab drawn and `/legal` read the photo question (owner: "yes draw the tab now, legal now,
  commit").** The E1–E9 records were committed first (f53441db4). Tab 10 of the events drawing draws the three
  schedule gaps (E10–E12, §7); the asks tab now holds E10–E12 and `/legal`'s P1–P5, and the ruled E1–E9 tags are grey
  marks. `/legal`'s review is `docs/agents/legal/CLUB_WEBSITE_E9_PHOTO_QUESTION_REVIEW.md`: optional (blank = No), one
  Yes names the website and the club's own social pages, camp and team answers separate, changeable after the lock,
  fixed words; the camp form puts the guardian line first and ships with no photo question if Board Ready Stage 7
  builds before this project's Stage 3. `/design` ran on tab 10 before publish. Nothing built.
- 2026-11-25 — **E10–E12 and P1–P5 ruled, all A, no notes** (owner pasted "E10: A … P5: A"). §7 ticked and each ask
  recorded in its own words; Stage 1 names E10/E11, Stage 3 names P1–P5. E11 and E12 recorded on Board Ready's side
  (its Stage 5 builds both); the drawing's asks tab shows them as ruled; `/legal`'s review and index note the five
  calls ruled. Nothing built.
- 2026-11-25 — **From Board Ready Stage 5 round 3 (team sign-ups), ruled 43A:** "Only people with the link" is a third
  "Who it's for" choice on a club event. Such an event is kept off the site, the calendar feed, News, Open now,
  schedules and search, so this project's listing pieces (E4 and E5's Open now and Coming up rows, E10 to E12's schedule
  rows) leave it out. Recorded in full in `BOARD_READY_PLAN.md` §5 Stage 5. Nothing built.
- 2026-11-25 — **Club events E1–E9 ruled, all A** (owner pasted "E1: A … E9: A"). §7 ticked; §3's no-login line
  reworded to tab 9's text; each stage line in §6 now names its events piece (Stage 1 E1/E5/E6, Stage 2 E7, Stage 3
  E9, Stage 4 E1–E3, Stage 5 E8, Stage 6 the champs page); one line added to Board Ready's Stage 5 split record. Still
  open: whether `/legal` reads E9 now or when Stage 3 is drawn. In the same message the owner asked whether club
  events reach the house league and rep schedules; logged in §7 as a new open item (a)–(c), not drawn.
- 2026-11-25 — **Stage 1 Part 1 done (the walk and the census). Nothing drawn yet; Part 2 next.** Prompt:
  [CLUB_WEBSITE_STAGE1_DRAWING_PROMPT.md](CLUB_WEBSITE_STAGE1_DRAWING_PROMPT.md). Milton's three answers are still not in
  (Stage 0 prompt's slot); the meeting note "glad of scores and schedules for ALL rep teams" is tested in item 2. E1–E9
  still unruled: Part 2 draws to their A, marked.
  **Captures.** Stage 0's `today/`, `gameday/` and `milton-staging/` are reused: no commit has touched the club home, its
  CSS, the house league public pages or the game row since they were taken (11-24). New, true size (390 and 1280, DPR 1),
  in `docs/projects/active/club-website-stage1/today/`: the Kestrel home on a Wednesday with nothing on (the quiet
  day), the 2026 House League season page, and its schedule and standings on U11, a published division with two
  Saturdays of games behind it and the rest to come (`.probe/club-website-stage1/capture.mjs`, read-only). The schedule's
  bare address opens on U7, an unpublished division ("U7's schedule is coming"), so `?d=` picks U11. **What the house
  league schedule already does that the games part should match:** a "Today · Wed, Nov 25" marker in the week list,
  "Times in Eastern time.", past weeks folded behind "Show 6 earlier weeks". A mid-game house league page looks the same
  as any other: there is no live state (item 3).
  **What the census found, in the order it changes the work:**
  1. *The house league rule is split, so it must become one before the home may read it.* `publicSeasonGames`
     (`lib/league-game-changes-server.ts:143-151`) applies "published division" and "as families last heard it"
     (`asLastSent`, :56-65, a pure function over any set of games), but **not "season not draft"**: every caller checks
     that inline (schedule `page.tsx:75`, season `page.tsx:30,76`, standings `:29,60`, register, status, the league
     index :41, the home `app/[orgSlug]/page.tsx:125`, `lib/club-home-data.ts:84,148`, `lib/club-public-teams.ts:85`).
     Standings and the season page repeat "published division" inline (season :103, :220-221; standings :66, :96) and
     read `computeStandings` raw. Publication is per DIVISION; draft is per SEASON. Stage 1's first build task: one
     house league public-games rule holding all three, called by the schedule, the season page, standings, the champs
     page (E5/E6) and the home's read. This is the "whichever builds first pulls it into one place" line above.
  2. *Rep: one rule, one team at a time, and few teams pass it.* `getPublicTeamSchedule` (`lib/public-team-schedule.ts:29-38`)
     passes `public_link` only (`lib/family-access.ts:243-245`), the club not cancelled, the family layer on, and a live
     season (active OR draft, the 2026-09-28 ruling). "Families only" never reaches a public page: the rule returns null
     at :34 and the team page draws no schedule (`lib/club-team-page.ts:31-32`). A passing team costs about four reads in
     sequence and reads its whole season (no date window); non-public teams cost nothing (filtered from one
     `getRepTeams` read). Away games are included (`homeAway` home/away/neutral; no place id on the public view, so "at
     our field" is only `homeAway`). A rep team's mirrored tournament game (`source_tournament_game_id`,
     `lib/rep-tournament-game-mirror.ts:36-38`) duplicates the club's own tournament game; the staff calendar removes it
     (`lib/club-calendar.ts:336`) and the new read must too. **Dev: 71 rep teams, 2 `public_link`; Kestrel and Milton
     have 0** (Milton's 20 are all `families`). So Milton's "scores for all rep teams" is NOT what Stage 1 gives them
     unless each coach sets the team to a public link. That is a fact for the asks, not a reason to widen the rule.
  3. *Live and final are three different things.* Tournament: live is derived, never stored (`lib/game-status.ts:52-67`,
     start to start + length + 30 minutes; final = completed/forfeit; `submitted` reads Final or "Unofficial"). House
     league: **no live state anywhere public** (status scheduled/completed/cancelled/postponed; completed = both scores
     in); a coach's score is the score. Rep: no status but scheduled/cancelled, `result` win/loss/tie is the final;
     the coach's Game-Day console saves a running score "quietly" with `result` left empty
     (`app/api/coaches/[orgSlug]/teams/[teamId]/events/[eventId]/route.ts:105-112,228-237`). So a rep "live" exists in
     fact (a score, no result, inside the game window) and is drawable. **Defect found on the way (§9):** today's
     public rep page and the family schedule read any score as a finished game (`lib/family-view.ts:117-119`) and print
     "T 4–2" for a running score (`lib/family-schedule-format.ts:48-51`). Postponed exists for house league only.
  4. *Tournaments: no single public-games helper.* The full gate is status active/completed (`isPublicTournamentStatus`,
     `lib/public-pages.ts:43-45`; the literal repeated in 14 more files), published division (`readPublicGames` /
     `onlyPublishedGames`, `lib/public-games.ts:19-47`), the organizer's Schedule page switch (round-robin games drop when
     it is off, `lib/public-tournament-data.ts:221-222`), the club not cancelled, and a crossover opponent from a held-back
     division blanked (:191-195). **Counts for a tournament's row exist only in pieces:** live = `gameDayLists(...).live`
     (`lib/public-overview.ts:22-38`), played = `playedCounts` (`lib/event-recap.ts:127-142`); "N on now · N today" is
     computed inline in the share image only (`opengraph-image.tsx:81-95`). The home's chip today says "Live now" all day
     from the dates alone (`lib/club-site-home.ts:51-66`), between games too.
  5. *There is no club time zone.* No column on organizations, tournaments, seasons or places; every helper defaults to
     `ORG_TIME_ZONE = 'America/Toronto'` (`lib/timezone.ts:23`, its own note says "promote to a per-org column"), and
     tournament setup writes Toronto (`app/api/admin/setup-tournament/route.ts:119`). So "a game in a different zone"
     cannot happen today, and **every club outside Eastern time reads Eastern times and an Eastern "today"** (§9; not
     this project's to fix, but Stage 1's "today" and "the day after" use the shared helpers so they follow when it is).
  6. *Nothing guards the staff calendar from a public page.* No test stops a public file importing `readClubCalendar`
     (the 13c guard only covers `lib/club-band-read.ts`). Guard the build adds: (a) the new read's imports `deepEqual` a
     fixed list (the three program rules, `public-club-access`, `timezone`, types); (b) no `.from('games'|'league_games'|
     'rep_team_events')` in it; (c) each rule is called and no `'public_link'`, `=== 'published'` or
     `schedulePublishedAt` literal appears; (d) no file under `components/public`, `app/[orgSlug]` (not admin) or
     `app/api/public` imports `lib/club-calendar'` (anchor on the quote: the league schedule imports the pure
     `club-calendar-view`); (e) the home calls it once, behind the `teams` and `league` site switches
     (`lib/public-club-access.ts:32-33`) and the home's section toggles. Copies `club-stage6d-feeds-guard` and
     `public-games-guard`.
  7. *A busy Saturday on dev is tournament-shaped.* Busiest mixed day: Milton 2026-11-21, 21 games (3 house league in 2
     divisions, 0 rep, 18 in one tournament, which A3 makes ONE row). No dev club has more than 6 house league games in
     a day or more than 2 rep games; the busiest single day anywhere is 100 tournament games across 7 tournaments (a
     test fixture, 7 rows under A3). So "N more" on a real club is driven by house league divisions (a Milton-sized
     club runs ~10), drawn from that, not from dev. Kestrel's extras seed puts only its Fall Classic on "today" (14
     games, 2 live for ~85 minutes after the run); house league dates are fixed Saturdays.
  8. *Refresh and cost.* Nothing caches across requests: every club page and the `[orgSlug]` layout are
     `force-dynamic`, no `unstable_cache`, no `revalidateTag` anywhere, no score save invalidates anything, no
     `Cache-Control` on public pages. The tournament hook polls a narrow JSON route every 30 seconds, paused when hidden
     (`lib/hooks/usePublicTournamentLive.ts:36,53`), about 9–13 queries a tick. House league pages never refresh; a
     whole-page refresh would be ~15–18 queries a tick per open tab (layout ~9 + page), a narrow games endpoint ~3–4.
     The home renders in ~17–21 queries today and reads no games. **So:** the games part and the house league refresh
     each poll a narrow endpoint, never a page refresh; the games part refreshes only while a game is in its window; a
     cache is a short time limit (15–30 seconds, a final shows at most that late) unless a tag cache is built with
     invalidation at the ~5 score-save points, which needs a check that Amplify shares the data cache across
     instances. **Found on the way (§9):** the tournament schedule page runs up to three identical polls per tick (the
     page, the My Team dock and the ticker do not share), ~27–39 queries every 30 seconds per tab.
- 2026-11-25 — **Track P Part 1 done (the census). Nothing drawn, nothing built; Part 2 waits on the owner.** Four
  helper reads; every line below re-opened by the session. Prompt: `CLUB_WEBSITE_TRACK_P_DRAWING_PROMPT.md`.
  1. *The seed is not a preview and must not become one.* It makes the club as `plan_id 'club'` +
     `subscription_status 'active'` with no Stripe row (`scripts/seed-prospect-demo.mjs:215-220`), which every gate and
     count reads as a paying Club (`lib/plan-config.ts:308` isFreePlan is tournament-only; gates read plan + status +
     add-ons). It makes fictional CHILDREN with birthdates, guardians, emergency contacts and two medical notes
     (`scripts/lib/prospect-demo-rep.mjs:328-335`, families `scripts/lib/prospect-demo-world.mjs:104-138`); none of
     that reaches a public page. Eight of its sign-ins are the owner's own Gmail `+` aliases, so deliverable
     (`scripts/prospect-demo.milton.config.mjs:32,43-50,197-198`); the rest are `.local`. Its logo is a stock mark, not
     the club's published one (`seed-prospect-demo.mjs:225-243`). No live game: past = completed, the tournament
     finished the Saturday before (`prospect-demo-rep.mjs:725,778`). Stage 0's guard lines corrected: `:54-60`,
     `:84-88`, `:136-139`, dry run `:174-193`. Its uncommitted change (team tiles carry the club logo,
     `prospect-demo-rep.mjs:285-307`) belongs to another session.
  2. *Nothing can make a club with no owner, and staff cannot own one.* The only creation route needs a signed-in,
     Terms-accepted, non-staff user with no other real club and no live invite (`app/api/org/create/route.ts:51-90`);
     platform admin has no create route. There is no preview state: no `trial_ends_at` (the trial is Stripe's,
     `app/api/billing/create-checkout/route.ts:411`), and free time is the wrong tool: it is a customer grant with an
     end date (Free time list, reminders, re-close), and a WHOLE-PLAN grant refuses checkout for that plan or lower
     (`create-checkout/route.ts:175-181`, `below_free_plan`; a section grant does not; corrected by `/billing` the same day).
  3. *THERE IS NO ONE MARKER.* Demos are left out by a code list (`lib/demo-org.ts:102-118`) read through five
     predicates wired in by hand; public lists by two database flags (`lib/directory.ts:142-147,390-399`);
     `is_test_organization` is read only by two-step; email skips only `.local` (`lib/email.ts:78-80,129`).
     **Reads nothing today, so a preview would be counted, listed or reached:** platform admin Orgs list
     (`app/platform-admin/orgs/page.tsx:17-24`), bulk operations, the email opt-out page, Plans & pricing org impact,
     online payments health, plan-ending / sent-log / watching-Stripe, and inside Business numbers the people,
     registrations, accounting and subscription-event figures (`lib/platform-metrics.ts:176-217`) and
     `platform_events`. **Search:** noindex, robots and sitemap exclude the demo list only (`app/[orgSlug]/layout.tsx:67-69`,
     `lib/robots-rules.ts:38`, `app/sitemap.ts:41-52`); a preview is indexed. **Public lists:** the seed sets
     `is_discoverable false` and the tournament's `list_in_directory false` (`prospect-demo-rep.mjs:731`), but both are
     switches anyone signed into the club can turn on. **Email:** `sendEmail` (~75 callers) has no organization check;
     only `sendMarketingEmail` (two callers) and `notify`/`fan-notify` check the demo list. What actually silences the
     demos is the write block (`proxy.ts:62-73`). **Clean already:** Owner Bookkeeping (real Stripe invoices only), the
     Morning Brief and board (no org reads), `npm run health`, `check:demos`, the installable app (no org list).
     **The real finding:** the demo list means two things at once, "not a customer, silent, unindexed" (a preview needs
     all of it) and "read-only shared sandbox with a banner and a no-login door" (a preview must have none of it).
     Adding a preview to it is wrong; one preview marker read by every surface above, held by a guard test, is the shape.
  4. *The claim.* Terms are per person, accepted at sign-up and re-checked at checkout (`legal_acceptances`,
     `app/api/auth/signup/route.ts:209`, `create-checkout/route.ts:108`). Checkout is owner-only and makes the Stripe
     customer then, from the owner's email (`create-checkout/route.ts:104,385`), so a preview that never checked out
     has nothing to re-tie. The only owner hand-over is platform admin's transfer, and it needs the person to be a
     member already (`transfer-ownership/route.ts:48-53`); a club invite cannot give owner. A claimer who already
     belongs to another real club is refused (`lib/org-membership-policy.ts:46`). So "Claim it" is a new door, not a
     reuse. The seed's reset (`seed-prospect-demo.mjs:289-323`) is the nearest thing to "clear the sample", and it keeps
     the org row, site content, venues and sponsors and leaves sponsorship offers it cannot delete (`prospect-demo-rep.mjs:208-211`).
  5. *The removal.* Nothing scheduled deletes or expires an organization (pg_cron jobs listed; none touch orgs). The
     owner's deletion request deletes nothing (`app/api/admin/org/request-deletion/route.ts:37`). Platform admin delete
     removes the org, its files and optionally the Stripe customer (`orgs/[id]/delete/route.ts:131-332`). A deleted
     club's address shows the generic "We can't find that page" (`app/[orgSlug]/layout.tsx:102`, `app/not-found.tsx:15`);
     "This club's site isn't available" needs the row kept (`components/public/ClubNotFound.tsx:44`). A removal "done
     by itself" is a new production job: shared automation, the owner's word in that session (AGENCY_RULES).
  6. *A live score.* "Live now" is the clock, not a button: a game is live from its start to its length + 30 minutes
     unless completed or cancelled (`lib/game-status.ts:52-67`). The demos are deliberately never live (snapshot,
     `lib/demo-tournament.ts:33-51`, nightly re-anchor). On the club HOME, "Live now" is only a chip on the tournament
     card, judged by its dates (`app/[orgSlug]/page.tsx:199-203`); tab 12's home score is Stage 1's, not today's. A
     score needs a signed-in scorer with a role in the club (`app/api/scorekeeper/[orgSlug]/score/route.ts:23-34`).
     Since the meeting time is known when the preview is made, one game set at that hour is honestly live in the room
     with no shifting; who types the score is the open part (staff cannot hold a seat as owner; a scorer seat is untested).
- 2026-11-25 — **Track P Parts 2 and 3 done: the drawings are published, 16 asks wait (§7, T1–T16). Nothing built,
  nothing ruled, nothing committed.** [CLUB_WEBSITE_TRACK_P_DRAWINGS.html](CLUB_WEBSITE_TRACK_P_DRAWINGS.html),
  https://claude.ai/artifact/Tx3So1rUqL6shn7CzM93Zr (9 tabs: the census with every surface and how a preview stays
  out; Prospect clubs (computer, phone, empty); Make one (filled, refused, making); into the room (the owner's phone
  window with QR, code, live score, Email the link; the printed card); the marking (home, the live tournament,
  computer, a closed Register); the claim (code, account + Terms, the claim, plan, landing, kept and gone, six failure
  frames); after 30 days; a forwarded link and the one email; asks + order). Captures of today beside it in
  `club-website-trackp/` (Start a club account step and the setup landing, from `.probe/club-on-sale/s2/shots/`).
  Read on the way: **the live game must be a tournament game** (only tournament pages show a live card and refresh;
  house league pages never refresh); today's Start a club is Account · Club · Plan with the Terms tick at step 1 and
  the plan step's trial line from `lib/plan-trial-line.ts:27`; a new club lands on "Set up your club".
  What the reviews changed:
  1. *`/ux` (12):* the claim says the claimer becomes the owner and the site stays off until a plan; the code page has
     a way back and "For the club's board"; "Lost the card"; lockout and ended-mid-claim frames; making + its failure;
     the room window gains Copy link, New code, Mark final, a save failure, Email the link; the closed Register says
     to ask the club; counts split open/claimed/removed. Its "when is the sample cleared" became T14. A "keep 30 more
     days" button was NOT added: it would change the ruled 30-day rule.
  2. *`/billing`:* a preview runs on a marker folded in at the entitlement door that grants only the site parts it
     shows, `plan_id` left at the free start, cleared in the claim's own write; never `club`+`active`, never free
     time (a whole-plan grant refuses checkout; any grant is a customer grant). The claim writes `start_plan` and
     re-checks the door and the one-club rule. A claimed club is a customer from `claimed_at`, not `created_at`
     (`platform-metrics.ts:279-284`). Words and prices match the Facts doc; the Club · Association card was redrawn
     to the shipped one. `/accounting` is not needed unless T9 C.
  3. *`/design`:* the room window's lone Remove now ends the body (rare-door ruling); × gets a 44 px area; the band
     drops to 13 px and gains a hairline; the computer frame uses the 960 column; 44 px Register links, Sign in and
     Menu; the list toolbar is count left, Search and the action right; the door bar drawn from the shipped header;
     the QR gets a print quiet zone; the code avoids 0, O, 1 and I.
  4. *`/legal`* ([CLUB_WEBSITE_TRACK_P_REVIEW.md](../../agents/legal/CLUB_WEBSITE_TRACK_P_REVIEW.md)): its claim
     paragraph and tick wording; "already claimed" asserts nothing; "Sample" in the event names; a footer removal
     route; no ages in the club's line; **no robots.txt line per preview** (public, it would list our prospects; noindex
     + header instead); share images, posters and the calendar feed refused; closed forms hold server-side; the make
     window refuses Québec and needs a web address as the logo source; the email's CASL wording and a consent record
     (date, role, send; no name), the unsubscribe keyed to the address; the ended page for 90 days. Its calls became
     T15 and T16; the mailing address is owed.
  5. *`/marketing` (one pass, 16 strings):* "Registration isn't open on this preview"; "we" not "FieldLogicHQ" on our
     own pages; "Your club's site, already built"; "Removal date" and "Comes down"; "Sample House League 2027". Kept
     against it: the preview home still shows registration open, as their own site would.
- 2026-11-25 — **Track P's 16 asks ruled: all A, as recommended, no notes (§7).** Nothing built, nothing committed by
  the ruling. Still open: the owner's mailing address (T13's email waits on it) and, at build time, the owner's word on
  the nightly removal job (T11).
- 2026-11-25 — **Stage 1 Parts 2 and 3 done: the drawings are published, 11 asks wait (§7, G1–G11). Nothing built,
  nothing committed.** Page [CLUB_WEBSITE_STAGE1_DRAWINGS.html](CLUB_WEBSITE_STAGE1_DRAWINGS.html) (published
  https://claude.ai/artifact/Y8yvdP4H5dzAhDiEtG6TdL), generated by `.probe/club-website-stage1/build.cjs` (the house
  stylesheet copied from the events drawing; edit the generator, not the HTML). Tabs: the walk · the home in eleven
  states (quiet day, house league only, + a public rep team, + a running tournament, early morning, evening, rained
  out, no public rep teams, the day after, a Milton-sized busy Saturday shut and opened, the computer at 1280 in A and
  B) · twelve row kinds · the filter chips · the house league schedule and standings refreshing, and E10's champs band
  · empty and failure · the one games read with file and line · the build's shape · the asks. Every phone frame's
  first game row starts between 377 and 505 px (measured; the fold is 843). E1 and E6 are drawn as ruled.
  **Reviews before hand-off, all applied:**
  1. *`/ux` (15 findings):* the home showed games from Kestrel's unpublished U9 and U13 divisions (the drawing broke
     its own rule; now only U11 and U15, which are published); a stated sort order; a house league game whose window
     ended with no score (it stays in Latest results, never vanishes); house league live wording that promises no
     running score; the check starts half an hour before the first game; a failure line with a link, Try again, and an
     all-or-nothing read; a season-schedule link on a busy day; postponed, cancelled and moved games in their own band,
     a rainout collapsed to one row; early-morning and evening states. Not taken, with the reason on the page: a
     chevron on game rows (R5's registered exception: the whole game row is the link); "sign in to see your team's"
     for rep families (the signed-in family app is switched off); an "Updated" time line (offered as G6 · D).
  2. *`/db` (verdict: the three rules alone do not stop an unpublished game):* a rep team's copied tournament game can
     be stale and cannot be told apart, so the home drops every copy; the rep rule has no site or plan check, so the
     read asks it per program; tournament games pass the shipped public-game and held-back-opponent steps and the read
     returns its own short list of fields; the house league "today" window is applied after the unsent-changes view;
     a tournament with its Schedule page off has NO row (the shipped scores feed's rule; tab 7 had said playoff games
     stay, which is the bracket page only). Costs corrected: rep is 5 reads per team (100 for 20 Public teams), so a
     batch version inside the rep rule's module; a "today" version inside the house league rule's module; the check
     is held at the edge 15–30 seconds with no serve-stale, never a tag cache (nothing shows the host shares it).
     Two pre-existing findings to §9: the open games read (yes, it exposes unpublished divisions to anyone with the
     public key) and the stale copied game on a rep team's own page.
  3. *`/marketing` (one pass plus a follow-up for the words `/ux` added):* §10.
  4. *`/design` (13 findings):* a live tournament row wears the green live edge, not the club colour, and a finished
     one none; tags and the first-screen line moved off text; Directions is the shipped Navigation icon on a phone and
     the labelled small button on a computer; the "score lands" row keeps its time and place with the pill top-right;
     option B's one-line row redrawn on the shipped grid (field centred under the teams); unchanged parts redrawn to
     match the captures (diamond logo, card chevrons, the early-bird line, all eight standings columns with dots);
     one line under a tournament row; rejected chips drawn at 44 px; the Families team drawn as a visible absence.
  `/legal` not owed: no person is shown. **Build shape (tab 8):** the rep "T 4–2" fix first on its own; then Pass 1 (no
  visible change: the one house league rule with its draft check moved in, the batch and "today" versions, the one
  read, the live rule, the check request, the guards) and Pass 2 (Open now's cap, the games part, the house league
  refresh, the card's word, the failure line, the editor's rep line; then `/simplify`, `/review`, `/docs`, one walk).
  The walk needs house league games and a Public rep team on today's date in a seed (a walk task, not a demo step).
- 2026-11-25 — **Stage 1's 11 asks ruled: all A, as recommended, no notes (§7).** G6 is A, so no "Updated" time line.
  Nothing built, nothing committed by the ruling. Milton's three answers were still not in when he ruled. Records
  committed `2ce4cc003` with Track P's. Build prompt written the same day:
  [CLUB_WEBSITE_STAGE1_BUILD_PROMPT.md](CLUB_WEBSITE_STAGE1_BUILD_PROMPT.md), two sessions (1A the defect + Pass 1,
  1B Pass 2 + the close). It says club events do not exist in code yet, so E6/E10/E11's rows are not built in Stage 1.
- 2026-11-25 — **Track P build prompt written** (owner: "yes write the track p build prompt"):
  [CLUB_WEBSITE_TRACK_P_BUILD_PROMPT.md](CLUB_WEBSITE_TRACK_P_BUILD_PROMPT.md), four sessions in the drawing's order:
  P1 the preview marker and its build check, alone; P2 Prospect clubs, Make one, the sample and the marking; P3 the
  room and the claim; P4 the removal, the ended page and the one email (the nightly job asked for in P4 itself).
  Runs beside Stage 1; the one shared screen is the public club frame. No real preview on production before P4's
  removal is live there, or the owner removes each by hand.
- 2026-11-25 — **Stage 1 Session 1A: the running-score fix committed, Pass 1 built and reviewed.** Start conditions held
  (G1–G11 ticked; Milton's three answers still not in; no migration). **Part 0 committed `45bb8676f`** (owner "yes
  commit"): one live rule (`lib/club-game-live.ts`, the tournament's window: start to scheduled end, or start plus the
  booking length, plus 30 minutes, ended by the final) on the public rep team page and the family schedule; a coach's
  running score reads "Live now" over "4–2", End game reads W/L/T as before, a score whose game was never ended reads
  "4–2" with no letter once its window has passed (the season record counts results only), a game copied from a
  tournament is never live there. **Pass 1** (nothing a visitor sees): the house league public rule is
  `isPublicLeagueSeason` / `isDivisionSchedulePublic` inside `lib/league-game-changes-server.ts`, asked by the nine
  public pages and routes and the two home readers (none tests "draft" or `schedulePublishedAt` itself), with a window
  version applied after the as-last-sent view (`lastSentInWindow`, pure, pinned with a moved game; a sent move is found
  by the day it left, `moved_from`); the rep batch `getPublicTeamGamesBetween` (three reads for every Public team);
  the tournament part `publicTournamentGamesBetween` through the `scores` section's own gates; the one read
  `lib/club-games-read.ts` (its own fields, all or nothing); the games-only check `GET /api/public/club-games/{club}`
  (no query string, held at the edge 20 s, no serve-stale, never held on a refusal or a failure); the live rule for house
  league and the check window (G6, G7). Guards: `club-website-stage1-reads-guard` (all nine of tab 7's, plus all or
  nothing), `club-stage6d-feeds-guard` 1c (the batch), `public-games-guard` (the read joined its surfaces). `/review`
  (four lenses) confirmed and fixed two Highs before hand-off: shared readers returned an empty list on a failed read
  (now strict on the home's path only), and the club travelled in the query string (now in the path). Found on the way,
  §9: the season status page and several sign-up routes ask no draft question; whether the edge honours `s-maxage`.
- 2026-11-25 — **Track P Session P1 built: the preview marker and its build check (T1). Nothing a visitor sees; nothing
  makes a preview yet.** Migration **535** (`organizations.is_preview` + `organization_previews`, kept after a claim and
  after a removal, no FK on purpose; a trigger keeps the marker, a removed club stamps `removed_at`; a row for a club
  with people is refused) **applied to dev 2026-11-25 at the owner's word** ("Apply 535 to dev now"), twice; triggers
  probed rolled back; production pending on the steps list, ORDER before the promote that ships P1 (without the column
  the sender refuses every club's mail). `/db` reshaped it before writing (the record must outlive the club; no stored
  removal date; no stored plan; creation is ONE database step, P2's). The rule is `lib/preview-org.ts` +
  `lib/preview-org-server.ts` (fail closed). **What reads it:** the door folds `PREVIEW_SECTIONS` (site, house league,
  rep teams) onto the free plan, never a plan or free time; the three org mappers (`isPreview`, discoverable false);
  Business numbers (the shared not-a-customer set, plus registrations, accounting entries, retention and subscription
  events, which also counted the demos until now), Renewals, Clubs & portals, Bulk changes (page and a refusal), Plans
  & pricing, Find (still finds one, labelled "Preview club"), the lead picker, Leads (accounts, sign-ups, offers, link),
  Free time (list and a give refusal), Online payments, Stripe watch, the email opt-out list; the directory
  (`getUnlistedOrgIds`, `scopeFollowableOrgs`: /discover, /scores, search, follows, every sitemap) and the coach link
  finder; the org layout's "don't index". **Silent:** `sendEmail` now REQUIRES `orgId` (`null` = our own mail), so ~45
  sends were given their club; it refuses a preview's mail before any log row, failing closed; the batch and template
  senders too; `notify`, fan alerts, the marketing sender, the coach notices and `writePlatformEvent` refuse a preview.
  Error alerts stay on. **`/billing`:** the fold is clean (no billing action reads it; `PREVIEW_SECTIONS` is the set the
  public pages gate on; sample sponsors need none); applied: the preview read fails closed on the SNAPSHOT only (Today
  and the menu counts warn and go on, the club list still drops previews by its own column), and the console's plan and
  sections writers refuse a preview. For P2: the sections open the public sign-up pages, so P2's closed forms are what
  keep people out (T3); a free-plan preview shows no tournament branding or tournament-place sponsors (a design call,
  never a fake plan). **`/db` after the build and `/review` (four lenses), all applied:** the database now holds T3 and
  "never billed" itself (PV001 on the marker however it is written and on an undone claim, PV002 a real club, PV003
  nobody joins an open preview, PV004 the record stays with its club, a row lock against the join race, a CHECK that a
  preview holds no Stripe ids, a 5-second lock wait), each probed rolled back on dev; **a High fixed:** a failed preview
  read on a REAL club returned `skipped`, which several senders count as delivered, so it is now `provider_error` (failed,
  retryable) and only a preview is `skipped`; only a "not a preview" answer is remembered, so a club the moment it is
  claimed sends its welcome. For P2/P3: the public sign-up, tryout and registration POSTs must refuse a preview (the
  sections open them; the database's "no people" covers members only); make the club with the marker set in one step;
  a preview must hold no dues (the dues sweep would report failures daily); fan follows and the scores feed read clubs
  by id (a preview is never followable through search, but a direct follow should refuse one). Pre-existing, seen on
  the way: two dues routes stamp "reminder sent" whatever the send answered. **Build check:** `tests/unit/preview-org-guard.test.ts` (every platform-wide `organizations`
  list or count decided as `rule`/`clean`; the other-table surfaces; the sender shape; indexing; alerts; the door).
  **Shared frame with Stage 1:** P1 changed only the "don't index" line of `app/[orgSlug]/layout.tsx`; the home stays
  Stage 1's. **Owner ruling 2026-11-25 ("go with your header recommendation"): no `X-Robots-Tag` response header.**
  `proxy.ts` never sees a public club page, and putting every public visit through it for a database lookup would repeat
  the page's own tag; instead the "don't index" page tag on every page, and **P2 refuses every non-page route** a preview
  could serve (share images, posters, the calendar feed, PDFs), so nothing is left for a header to cover. **Left to P2 on purpose:** share
  images, posters, the calendar feed and every form refusing a preview (no preview can exist before P2).
- 2026-11-25 — **Stage 1 Session 1B built Pass 2 and ran the close; the walk waits for the owner.** Start conditions
  held (Pass 1 `b2233a3c9`, Part 0 `45bb8676f`; Milton's three answers still not in; no migration). **Built:** the pure
  view `lib/club-games-home.ts` (title, bands, G4's order and caps, the tournament row's words, the rainout fold, the
  "N more" words, the season-schedule door); the part `components/public/ClubGamesPart.tsx` (failure line + Try again,
  G11); the one "N more / Show fewer" row (`ClubMoreRow`) used by Open now (capped at two) and every band; the
  30-second check `lib/hooks/useClubGamesCheck.ts` on `useVisiblePoll` (paused when hidden, checks at once on return,
  15-second timeout, past the close it checks until it has seen an answer made after the close); the house league
  pages' `LeagueScoresRefresher` (a server re-render only when the season's games changed, plus one on the first check
  if it is newer than the render); the schedule's live row (edge, pill, "Score after the game"; live beats Moved while
  on); "Games today" on the Tournaments card (G9); the site editor's rep line under Home page sections (G10;
  `countPublicRepTeams`, the home's own Public rule); the seed's sections b and d. **Build calls** (none re-rules an
  ask): the season-schedule door shows whenever any band on a game day is capped, so the evening frame gains it; a
  tournament between rounds sits in Later today; Open now's "N more open now" opens in place; a rep game past its
  window with a score and no End game is its score alone in Latest results; a house league game with no score shows
  "No score yet" on its day only. **The close:** the walk's day re-seeded; **`/marketing`** (one pass; about 30 strings
  matched §10) changed four: a tournament past its last window with nothing entered reads "5 games today · no results
  yet" (not "0 of 5 games final"); between rounds with some finals it reads "14 of 22 games final"; the editor line
  gains "Both rep teams show their games on your site." and, for a one-team club with it not Public, "Your rep team's
  games aren't on your site yet."; the failure line for a club with no house league link reads "Games can't be shown
  right now. Each team's page still has them." **`/docs`:** a new club-site topic "What your home page shows on a game
  day" (`public-site-editor-game-day`), the house league "who sees standings" topic gains the 30-second update and "Live
  now", and the coach's Public setting says it also puts the team's games on the club home. **`/design`** (phone 390,
  computer 1280): first live game inside a phone's first screen, stacked rows in the 540 column, the green live edge
  (`--club-ok`), bands, rows and the live place strip all as drawn; **one defect fixed:** on a computer the schedule's
  live row printed "Score after the game" over the place (both in grid row 2) — it now sits under the place, as Moved's
  line does. Typecheck clean; `check:spelling` green; 397 help and club-site tests pass. **Walk:**
  [CLUB_WEBSITE_STAGE1_WALK.html](CLUB_WEBSITE_STAGE1_WALK.html), https://claude.ai/artifact/SYSsX7HKAXMVLno4UeVZo7,
  Owner QA Ledger §567 (29 steps; walk D is the staging edge-hold check from §9). **Committed 2026-11-25 at the owner's
  word ("yes commit now"), ahead of the walk,** through a private index: the seed's and the help guides' "E-transfer"
  spelling edits, the ledger's other lines and Track P P2's plan and board entries are other sessions' and stayed out.
- 2026-11-25 — **Stage 1 closed: the walk passed A, B and C (§567); Stage 1 ticked.** Walk D (does the staging edge
  hold the games check, §9) is held until the push to staging (owner: "close this walk for now"). Next on this ladder:
  Stage 2 (field status), which starts with its count of typed-only games (dev, counts only) and its drawing session;
  Track P continues with Session P3 beside it.
- 2026-11-25 — **Track P Session P2 built: Prospect clubs, Make one, the sample and the marking (T2–T6; drawing tabs 2,
  3, 5).** Nothing committed at writing; the owner's word commits it through a private index. **Migration 536**
  (`organization_previews.sport` + `.province_code`, and `make_preview_club(...)`, the ONE creation step, SECURITY
  DEFINER, service role only) **applied to dev 2026-11-25 at the owner's word** ("Apply it to dev now"), re-applied
  after review; production on the steps list, ORDER after 535. In one transaction it makes the club with `is_preview` in
  its own insert (never a customer first; free start, `is_discoverable false`), its record, its site words, and the fixed
  sample (T4): "Sample House League {year}" open until Mar 31 (3 divisions × 4 teams), 4 rep teams in a "Rep" group
  ("{first word} U11 Comets"…; "St. Mary's" keeps its "St."), "Sample Indoor Classic" on the meeting day with its
  listing switch OFF and its first game at the meeting time (T5, live by the clock), opponents from invented towns
  (/marketing found Fenwick and Pelham are real), 3 sponsors named "(sample)"; no member, no team contact, no
  registration, no dues (T3). Refusals re-checked under one advisory lock: PV010 five open (T6), PV011 a club of that
  name, PV015 a preview of that name, PV012 the address, PV013 Québec, PV014 the meeting outside the next 60 days.
  Probed on dev: a rolled-back make (every row as above), PV011/PV013/PV014 live, then one real make ("Probe Valley
  Softball") whose pages were fetched and then deleted (the sample went with it; the record stayed, stamped Removed, and
  the walk shows it). **Who owns which part of the shared frame:** P2 owns the band line in `app/[orgSlug]/layout.tsx`,
  the title template and description there, and the footer line in `ClubFrame`/`ClubFooter`; Stage 1 owns the home
  (`ClubSiteHome.tsx`, untouched here).
  **What was built:** Prospect clubs (`app/platform-admin/prospect-clubs/`; owner only by the ONE owner allowlist,
  re-exported as `lib/platform-owner.ts`, menu entry after Leads; table → cards at 640, count line, Search, empty state;
  claimed rows open Clubs & portals, open rows open the club's site in a new tab until P3's room window); the make window
  (`MakeClubWindow.tsx`; every refusal in place; colours read from the logo in the browser; "Nothing was made. Try
  again." reported to Errors); the route (`app/api/platform-admin/prospect-clubs/route.ts` → `lib/prospect-clubs-server.ts`:
  owner gate, the logo's bytes sniffed, upload to `org-logos/{id}/logo.{ext}`, the one step, the logo taken back out on a
  refusal and kept when a lost answer turns out to have made the club). **The marking:** `PreviewBand` above the club's
  bar on every page under the org layout (tournament pages too), not pinned; the footer line with a mail link to the
  removal route (`previewFoot`, also at the foot of pages without the club frame); "(preview)" in every title and share
  title and the band's words as the description (club pages, the org template, the tournament layout, a game page); the
  "Built on FieldLogicHQ" credit shown on a preview though it is on the free start. **Closed on the server:**
  `lib/preview-write-refusal.ts` in every public write (the house league sign-up and its five sibling routes, the family
  form door, the tryout sign-up, tournament registration, both pay links, the sponsor link door, tournament and team
  follows), before the body is read where the route knows the club first; the house league and tryout Register pages
  show "Registration isn't open on this preview" (`PreviewClosedForm`); the tournament Register page already forwards a
  free-plan club to the event. **Refused files:** club, team and tryout share images fall back to the plain card;
  tournament, game and team share images draw none; the team calendar feed, the rules PDF and the form's documents.
  **Build check:** `tests/unit/preview-club-p2-guard.test.ts` (every public write route in the visitor-facing folders
  refuses, goes through a door that does, or says why it cannot be reached; the files; the marking; the creation step;
  the list and window rules as behaviour). **Reviews, all applied:** `/marketing` (14 strings; kept as drawn: the
  "Preview" pill and the plain "Rep" heading, T4's "team rows carry no tag"); `/design` (no must-fix; phone cards, 44 px
  Change buttons, the meeting field's error, the close-only cap window, quieter removed rows, the band's 16 px inset,
  the handshake icon, the mail link); `/review` (no high; the lost-answer logo, the `*` wildcard in a name pre-check
  removed in favour of PV011/PV015, the owner-allowlist coupling noted in `lib/bookkeeping-access.ts`). `/docs`: none
  needed, a platform-admin-only page has no customer help. **Deliberate departures from the drawing, said to the
  owner:** no "Claim it" on the band until P3 builds its page; logos PNG/JPG/WebP, not SVG (a public bucket); after
  Make the window closes with a link instead of opening the room window (P3). **⚠ Before the first real preview on
  production, P4's removal must be live there, or the owner removes each one by hand (Find → the club → Delete).** Walk:
  [CLUB_WEBSITE_TRACK_P_P2_WALK.html](CLUB_WEBSITE_TRACK_P_P2_WALK.html), https://claude.ai/artifact/GE3Toi49EBuJbdUVUGXrZp
  (3 walks, 37 steps). Pre-existing, seen on the way: `app/api/public/stats` reads a tournament by id without its club.
- 2026-11-25 — **Stage 2 Part 1 done (the walk and the census, from code). Nothing drawn, nothing built.** Milton's three
  answers are still not in (`CLUB_WEBSITE_STAGE0_PROMPT.md` slot: "not in yet"). Counts: `.probe/club-website-stage2/`
  (`counts.sql`, `run.mjs`; production read as counts only, grouped by an anonymous index). Captures: see the capture
  line at the end of this entry. **Two corrections to the drawing prompt, from the code:** the Rainout's emails carry NO
  unsubscribe (they are service notices, `lib/league-schedule-mail.ts:5,316` → `lib/family-email.ts:270-273`); and a
  house league game DOES carry its diamond (`league_games.org_venue_facility_id`, on prod; DATA_DICTIONARY.md:8719 still
  says "dev-only"), the Rainout just never filters on it. **What the walk found, in the order it changes the work:**
  1. *Matching by place barely works, so A6's "typed by hand" group is the main path, not the edge.* Production has
     **0 places and 0 diamonds** in any club's list (6 organizations, none a paying club); all 134 rep events there are
     typed or blank, and no tournament diamond is linked to a club place. Dev: house league 107 of 120 games point at a
     real place (5 typed-only, all past, one fixture club); rep games 12 of 203 do (111 typed-only; the coach demo club
     alone has 13 upcoming / 47 past); tournament diamonds linked **2 of 62** (both Kestrel's). Of 116 typed-only games on
     dev, **5 match a place's name exactly**: typed text carries the diamond ("Riverdale Park — Diamond 2" 31 times), so
     a whole-name match misses it. The Rainout today matches the display string exactly, case and all
     (`lib/league-rainout.ts:106`), never sends the place to the server (route :58-71) and stores none
     (migration 427:36-51). A third place system also exists: `rep_team_events.place_id` (the team's own places).
  2. *Tournament games reach the club's place only through a linked diamond* (`diamonds.source_org_venue_id`, set only
     by importing from the Venue library, `lib/tournament-venue-copy.ts:91-118`). So the hand-off finds nothing for most
     tournaments. And the Rain delay cannot be opened pre-filled: `?tool=rain-delay` opens it
     (`schedule/page.tsx:259-272`), but there is no day or field input, and its Field filter takes ONE diamond
     (`ShiftDayModal.tsx:118-137`). Its families hear through a pinned post on the public schedule and push (fans on
     Tournament Plus, staff and coaches); it sends no email (`ShiftDayModal.tsx:277-294`).
  3. *A held Rainout is invisible to the public* (`lib/league-game-changes-server.ts:147-177`): with "Email now" off, the
     games stay "on" on every public page until the changes are sent. A closure strip written at once over a held
     Rainout would say "closed" above a schedule that says "playing". One act cannot offer hold the way the Rainout does
     without the strip waiting too.
  4. *A game being played is called off with the rest.* Neither tool has a live state: both take every `scheduled` game
     on the day, so a noon closure postpones the 11:00 a.m. game mid-play; a scored game (`completed`, or the
     tournament's `submitted`/`completed`/`forfeit`) is never offered (Rainout: `lib/league-rainout-server.ts:27`,
     migration 427:119; Rain delay: `ShiftDayModal.tsx:109`, migration 178). Already postponed or cancelled: never
     listed. Both refuse the whole press if a game changed since the window opened (migration 427:121-122).
  5. *The notice holds one line at a time, now, with no place.* `org_site_notices` (migration 343:83-96): no start time,
     no place, no link; "showing" = newest not ended (`lib/db.ts:1420-1431`), and posting a new one ends the old
     (`lib/db.ts:1440-1463`). So a closure strip would end the club's own notice; two closed places = the second
     replaces the first; tomorrow's closure cannot be set tonight. Ends: "Tonight", "Tomorrow night", "Pick a date and
     time" (`lib/public-site-words.ts:167-174`). It shows on club and team pages and house league pages, **not on a
     tournament's pages** (`lib/consumer-routes.ts:66-71`, `components/public/ClubFrame.tsx:73`), and carries no link.
  6. *The home's band knows only a status, for today.* "Not being played today" takes today's postponed, cancelled and
     moved rows (`lib/club-games-home.ts:207`); more than 3 in one season fold to "N house league games postponed" with
     "{season} · {place if all at one} · from {time}" (:166-191). It cannot tell a closure from a coach's cancel, and a
     closure for tomorrow reaches only the notice slot. Rep has no postponed state; a cancelled tournament game is
     dropped (`lib/club-games-read.ts:186,218`). The home has no News section yet (`lib/club-site-sections.ts:75`).
  7. *Rep games have nowhere to put a mark.* `rep_team_events.status` is `scheduled|cancelled` only (migration 135:14);
     no note or flag column. The Coaches Portal already has the idioms to reuse: the "Moved" chip ("The organizer moved
     this game", `components/coaches/ScheduleCalendarViews.tsx:261-263`), `ClubSourceNote` and the amber "Hand-back
     asked" pill (`components/coaches/ClubSlotParts.tsx:57-80`). The only club-to-coach email today is the club schedule
     send (`lib/club-schedule-send.ts:1107,1194`, practices only, the platform sender with the admin as reply-to).
  8. *Four different role sets.* Rainout: owner, admin, league admin (`lib/house-league-access.ts:47,104-113`). Rain
     delay: `update_schedule` = owner, admin, staff, staff only on assigned tournaments (`app/api/admin/games/route.ts:1048`,
     `lib/api-auth.ts:460-465`). Notice: owner, admin (`lib/public-site-builder.ts:36`). Places: owner, admin, league
     admin, or `create_tournaments` (`lib/venue-library.ts:27-31`). There is no tournament-admin or rep-registrar role.
     Two shipped patterns show a person what other programs hold without a door: the club calendar's clash line
     (`lib/club-calendar-view.ts:278-290`) and the Venue library's "Booked by" (`lib/venue-library.ts:89-105`).
  9. *Two gates already disagree.* Rainout and Rain delay: `bulk_reschedule` = Tournament Plus (`lib/plan-features.ts:107`).
     The club's places: League, Club, Club · Association only (`hasOrgVenueLibrary`, :174-176). A club-wide closure is
     built on places, so it cannot reach a Tournament Plus club. For `/strategy`.
  10. *Sends on a busy Saturday (dev, counts only).* The busiest upcoming mixed day is Milton Sat Dec 5: 3 house league
      games in 2 divisions + 2 rep games. Closing the whole day: **54 family emails, 6 coaches copied, 1 rep head coach**.
      The busiest place that day (Sam Sherritt Park): 34 families, 4 coaches. A ceiling by a few (bad addresses drop at
      send). `league_rainouts`: 0 rows on dev and prod. Dev data is thin; a real Milton Saturday would be larger.
  11. *Put back.* The Rainout's "Put all back" works only while every change is still held and no game changed since
      (migration 427:145-191); once sent: "These changes were already sent, so they can't be put back." Stage 0's Reopen
      words already say this. The Rain delay has its own undo (`bulk-restore`, `games/route.ts:1231-1305`).
  12. *Club events do not exist in code* (no table, no admin screen). E7 rides with whichever of this stage and Board
      Ready Stage 5 lands second, as E6 and E10 do.
  **What a build would need that does not exist (for `/db`):** a closure record (place, optional diamond, first day,
  until, postpone or cancel, the families' line, who, Reopen who/when); the Rainout's record gaining its closure and
  place (one per season per day, so a closure "Until" Sunday is several); a mark on a rep event (status cannot carry it);
  the notice gaining a start time and a link to its closure, or the strip read from closures rather than notices (which
  also lets two places show); the Rain delay taking a day and a set of diamonds (code, no migration). Stale dictionary
  lines for the same unit: DATA_DICTIONARY.md:8146 and :8692 (house league "postponed" called dead; the Rainout and
  Postpone write it, and migration 411's time move does too) and :8719 (the diamond column called dev-only).
  **Spelling (§9):** "Rainout" on the house league button, window and help (`lib/league-rainout.ts:163-164,291`;
  `lib/help-content/house-league.tsx:969-1077`); "rain-out" in coach copy (`coaches.tsx:1403,1409`, the announcements
  page :61, the team page :1022, `RepAnnouncementEditor.tsx:291`); "rained out" in help titles and release notes.
  **Captures** (390 and 1280, DPR 1, Kestrel Bay on dev, 2026-11-25): `docs/projects/active/club-website-stage2/today/`
  (41 files; scripts `.probe/club-website-stage2/`): the house league admin schedule, the Rainout window (whole, and
  with Email unticked), its held result and its put-back question, the public schedule (U11), standings, season page,
  the club home, the rep team page (u13-ospreys), the tournament Rain delay open (not pressed), the Venue library, and a
  rep coach's schedule, event sheet and game page. The result was made by a held Rainout on Sat Nov 28 (3 games,
  postponed, no email) and put straight back, twice; checked after: the 3 games are `scheduled` with only `updated_at`
  changed, no change rows or email log for the season, 2 `league_rainouts` rows left stamped put back. The notice-up home
  is Stage 0's Milton staging capture (the notice frame has not changed since). Window seen: the place picker lists
  whole places ("Alder Fields", "Harbourview Park"); the diamond shows only on each game's line.
- 2026-11-25 — **Stage 2 Part 2 drawn and published (Close a place). Nothing built, nothing ruled, nothing committed.**
  Page: [CLUB_WEBSITE_STAGE2_DRAWINGS.html](CLUB_WEBSITE_STAGE2_DRAWINGS.html), https://claude.ai/artifact/N332KzJg8NgFJb4oZvJhwM
  (built by `.probe/club-website-stage2/build.cjs`; 10 tabs; 17 asks K1–K17 with a paste-back, listed in §7). Kestrel Bay,
  Sat, Nov 28, phone first (390) and computer (640 kit dialog, 1280 home), before = Part 1's captures. Milton's three
  answers still not in (the asks tab says so). **Heard before the asks:** `/strategy` (K14: League Plus, Club, Club ·
  Association on the places gate, no new key, Close a place replaces the Rainout everywhere; verified Tournament Plus has
  no house league, `lib/plan-config.ts:35-39,83,96-98`; drift flagged, not fixed: `PLAN_PRICING_FACTS.md:128` still calls
  the Rainout "not built"); `/legal` (the rep coach's email is most likely not commercial, no unsubscribe, must carry the
  club, who sent it, why, a reply line, no link or offer, sender "{Club} via FieldLogicHQ", admin reply-to; families'
  emails unchanged on the Rainout's path; the strip fixed words only; verified `lib/family-email.ts:270-273`, Privacy
  2026-11-24 §12; review `docs/agents/legal/CLUB_WEBSITE_STAGE2_CLOSE_A_PLACE_REVIEW.md` + its index row, written by that
  pass, uncommitted); `/db` (the build's shape on tab 9: a closure record, each Rainout linked to its closure, the rep mark
  as its own record beside the game so two closures never overwrite each other; one press that locks every division
  first and undoes everything on any refusal (migration 427's refusals are returned, not raised); the strip read from
  closures, the notice untouched; **"Link both" is not harmless today**: a newly linked place counts as a moved game and
  would email families, `lib/league-game-changes.ts` `placeDiffers` compares ids (verified), so the change log must learn
  it; dictionary lines stale at DATA_DICTIONARY.md:8146, :8692, and :8717/:8720/:8723 + :9000/:9003 ("dev-only")).
  **What the drawing recommends** (each an ask): the Rainout's people close and reopen (K1); a place or one diamond (K2);
  Day + Until, the strip from the press ("closed tomorrow (Sat, Nov 28)"), ending by itself (K3); one strip box, a line
  per place, before the club's own notice (K4); no hold, it sends at once (K5); a started game listed unticked (K6);
  typed games found by name inside the typed text, "Link both" silent (K7); no wait on R4, a no-places state (K8); the
  rep mark on the coach's schedule and game sheet and on public team pages, family schedule and the home's band (K9);
  the coach email in /legal's words (K10); Reopen takes down the strip and marks, emails the coach one line, games stay
  waiting (K11); no strip on tournament pages (K12); the Rain delay opens on that day and those diamonds (K13); the gate
  (K14); the house league "Rainout" button opens on that season's places, "Rainout" one word (K15); the strip carries no
  admin words (K16); "Needs a new date" at the top of the public schedule while it holds a game postponed this week
  (K17, every Rainout). **Reviews applied:** `/ux` (4 must-fix: button count = the summary; typed games left unticked get
  an amber result row; Reopen gets a result with "Give them new dates" and a coach line; the Rainout button opens on the
  season's places, not the whole club — K15 reframed; plus the phone window folds decided groups, "Place closed" rows
  say why, K11 gains the "put back unstarted" option, K17 labelled as every Rainout, no-head-coach case); `/design` (7
  must-fix: the view switch at 44 px on a phone, group headers in the display face, the partial tick, w-typed's count,
  the coach chips and the club source note redrawn as shipped (`coaches.module.css:6457,6481,3327`), 44 px links and
  Reopen); `/marketing` (one pass: the coach email subject/body/foot in the shipped group-email lines, "From {Club} ·" not
  a bare "From the club" (`ClubSlotParts.tsx:9`), "Needs a new date" not "New date needed", the rep row's line = Stage
  0's "Lions Park closed · waits for a new date", "Diamond 2 at Lions Park is closed today.", "closed tomorrow (Sat, Nov
  28)"; picks **"Rainout"**: 6 coach strings say "rain-out" (`coaches/teams/[teamId]/announcements/page.tsx:61,86`,
  `coaches/teams/[teamId]/page.tsx:1022`, `RepAnnouncementEditor.tsx:291`, `help-content/coaches.tsx:1403,1409`); "Rained
  out" titles are a different word; the spelling check has no rule for it, adding one is the owner's call).
  **Recommended order after ruling:** the migration (with the dictionary and snapshots) → Pass 1, the window and the
  press → Pass 2, what people see (tab 9).
- 2026-11-25 — **Stage 2 ruled and its build prompt written. Nothing built.** The owner: "Agree with all
  recommendations. Can you make the build prompt?" — K1–K17 all A (§7). Prompt:
  [CLUB_WEBSITE_STAGE2_BUILD_PROMPT.md](CLUB_WEBSITE_STAGE2_BUILD_PROMPT.md), three sessions (2A the migration and the
  press, 2B the window and Reopen, 2C what people see and the close). Read as part of K15 and K14, and named to the owner
  at hand-off: K15's "one word everywhere" adds a "Rainout" rule to `check:spelling` (not watched automation;
  AGENCY_RULES needs a ruling to widen it, and this is it); K14 is a gate change, so `/strategy` logs it and fixes
  `PLAN_PRICING_FACTS.md:128` in the gate's commit (2B).
- 2026-11-25 — **Stage 2 Session 2A built (the database half of Close a place; nothing anyone sees).** Start conditions
  held (K1–K17 ticked; Milton's answers still "not in yet"; club events still not in code, so E7 waits for 2B's check).
  **Landed:** migration `539_a_closed_place_closes_for_every_program.sql` — `org_place_closures` (one row per closed place
  per press: place / one diamond / every place, by id and name, Day and Until, shows from the press to midnight after
  Until, postpone or cancel, the families' line, who closed and reopened), `league_rainouts.closure_id` + `org_venue_id`
  (one Rainout row per closure, season and day; unique, the retry guard), `rep_event_closure_marks` (the mark beside the
  game, its time and place when marked; "the coach moved it" is read); `org_place_closure_press` (one step: places held,
  divisions locked in id order, rows locked, every refusal before the first write, a retried press key replays) and
  `org_place_closure_reopen` (stamps only; no game moves, K11 A); the recorder learns "Link both" is not news, ONLY while
  the press's transaction-local `league.quiet_link` is on around its own link step. Server: `lib/place-closures.ts` (the
  one matching rule mirrored, the mark rule, the strip's place-words-only shape) and `lib/place-closures-server.ts` (the
  press and Reopen wrappers; `closuresShowing`, `standingRepMarks(orgId, ids)`, `leagueClosureReasons(orgId, ids)`,
  `placeClosureSource` for 2B's window: house league, rep, tournaments K13, practices). The send's net effect reads the
  quiet link from the gap it leaves between held rows (`quietLinkOf` in `lib/league-game-changes.ts`), so the claim, the
  email's Now and its "Was" all agree, with no extra read. **How rep's own places are read (the prompt's "say how"):** a
  team place (`rep_team_events.place_id` → `rep_team_places.name`) is typed text — searched beside the game's own typed
  place, "maybe" at most, never ticked. **Proof:** `scripts/club-website-stage2-closure-check.sql` (rolled back, dev):
  T1–T15, 31 checks, all pass on the applied schema — all or nothing across two seasons, a retry runs once, "Link both"
  records no row while any other writer's link still does, the strip's window, a second closure keeps the first mark,
  Reopen moves nothing, draft / finished / another club / a gone game, one diamond, two places, the matching cases.
  Unit: `tests/unit/place-closures.test.ts`, `tests/unit/place-closures-guard.test.ts` (83 with the change-log and Rainout
  suites, all pass); typecheck and focused lint clean. Dictionary: both tables, the two columns, and the stale lines
  (house league "postponed" called dead; the place columns called dev-only — on production, schema read 2026-11-25).
  Production step: `MANUAL_PROD_STEPS.json` 539, pending (safe to apply ahead of the code: nothing turns the quiet link on).
  **/review (four lenses) found no Critical or High; applied:** the quiet rule had been on for EVERY writer (the club
  schedule's time move keeps old typed text, so a real move to a place whose name sat inside it would have gone
  unheard) — now the press's switch only; the email's "Was" line would have called a quietly linked game's place
  changed — the net now carries the place with the link; places held FOR SHARE first (a rename or delete mid-press);
  "finished" read after the locks; rep rows locked only when games (a practice id could have taken a lock in the club
  schedule's opposite order); a game gone since named as changed, not "not found"; a link must be on and unscored; the
  two id readers fenced by club; more lock errors read as "try again"; the window read refuses a place twice; indexes on
  the mark's team and the Rainout's place. **Accepted, recorded:** Undo of an OLDER held change unlinks a quietly linked
  game (families' place unchanged); a malformed id is a 500, not a refusal (2B's route validates, as the Rainout's does);
  a typed game naming two closed places is filed under the first. **For the owner (named, not ruled):** once a typed
  game is linked, family pages label it with the place's name ("Lions Park"), not the typed words ("Lions Park —
  Diamond 2") — how every linked game reads today; and a tournament diamond links to a place, never one diamond, so a
  one-diamond closure lists the tournament by its place. **For 2B:** make a press key per window open; the route maps
  refusals to words and validates ids.
- 2026-11-25 — **Stage 2 Session 2B built (the window, the result and Reopen; families' pages unchanged until 2C).** Start
  conditions held (2A committed `7d8c0d984` and reviewed; Milton's answers still "not in yet"; **club events still not in
  code**, so the window's events group is not built and E7 rides with whichever of club events and this lands second, as
  E6 and E10 do). **Landed:** `lib/place-closure-window.ts` (pure: K1's `canClosePlace` / `seesEveryProgram`, the ticks,
  the counts — the Rainout's arithmetic, one email per family per division —, "Link both"'s targets, the strip preview,
  every word as `CLOSE_WORDS`), `lib/place-closure-window-server.ts` (the frame, the window's read over 2A's
  `placeClosureSource` with names, families as team sets and each rep team's reach; a house league admin gets rep as ids
  and times only; the sends after the press per season through the Rainout's own `sendRainout`; the rep coach email with
  its marks CLAIMED first; the Venue library's closed rows; Reopen's emails, claimed on `reopen_told_at`),
  `lib/place-closure-mail-words.ts` + `lib/place-closure-mail.ts` (K10, /legal's skeleton on the shipped group-email lines,
  kind `place_closure_coach`, From "{Club} via FieldLogicHQ", reply-to the pressing admin; no address → not sent, said in
  the result), routes `app/api/admin/org/place-closures/` (GET frame / read / a season's places; POST the press, then the
  sends) and `[closureId]` (Reopen), `components/admin/kit/club/places/ClosePlaceWindow.tsx` + `ReopenPlaceWindow.tsx`;
  doors: the Venue library's toolbar, the closed row at its top with Reopen, "Closed today" on the place's row, the
  Overview's "Close a place" beside This morning (`?close=1`) and a "Places closed" card while one shows, and the house
  league schedule's Rainout button (K15, on that season's places on the window's days, opening on its next day with games
  as the Rainout did). The Rain delay opens on the closure's day with the place's diamonds picked and one amber line (K13;
  `?day=&diamonds=&closed=`, the first open of the visit only). The shared `FormTable` gained an optional phone `fold`.
  **K5's evidence (the prompt's "say which"):** a held Rainout can still exist — every one made by the old window with
  "Email the families now" unticked, and a closure division whose send failed. So **Put all back is KEPT for an old held
  Rainout and RETIRED for a closure's** (the banner retries the send, says "A closed place on …", and the route refuses
  `back` for a closure record). **The one-season Rainout window and its press route are retired** (nothing opens them;
  its server read went with them). **K14:** the places gate on every route (404 below League Plus), the held Rainout's
  route moved onto it too (/billing: one gate, not an accident of the plan ladder); `/strategy` logged the decision in
  `BUSINESS_DECISIONS.md` and trued `PLAN_PRICING_FACTS.md:128`; no key, no price, `plan-config.ts` untouched. **K15:**
  `check:spelling` rule `rainout-one-word` (`\b[Rr]ain[- ]outs?\b`); the six coach strings changed; the help's hidden
  search synonyms keep "rain out" with `spelling-ok`, as `canceled` does. **/legal (shipped words):** holds; applied: an
  admin with no name on file → "Reply to this email to reach the admin at {Club} who sent it." / "Not right for you? Reply
  and tell them." (never "reach {Club}": the reply reaches the admin); the rep row says who is really emailed (its head
  coach, its coaches when it has none, or nobody). **/review (four lenses) applied:** a house league admin's press answer
  carried rep team names (now counts only, server side), their rep games are re-checked on the server against what the
  window offers; a retried press with a CHANGED selection after a lost answer would have replayed the first (the key now
  follows what is pressed); coach and Reopen emails claimed before sending (no double email on a retry); one season's
  failed send no longer hides the others ("Some house league emails didn't go"); Reopen's "still need new dates" counts
  postponed games only; the Rainout door followed TODAY's places after the Day changed (now the window's days); "Link
  both" counted a draft division's game; a re-read after a refusal kept a game ticked that had since started (K6); the
  Overview's door vanished for a house league admin and a League Plus club without rep teams; the "past" refusal ran
  before the replay check; the window promised "its coaches are emailed" for staff with no address. **Accepted,
  recorded:** an opponent typed like a web address may be auto-linked by a mail app (the email writes no link);
  a crafted `closed=` link can word the Rain delay's amber line (admin-only, escaped); a replay by another admin of the
  same club runs the owed sends with their reply-to; multi-day closures say "that day" for the tournament and practice
  counts and open the Rain delay on the first day. **Proof:** typecheck clean; 169 unit tests across the closure, Rainout
  and guard suites (new: `place-closure-window.test.ts`, `place-closure-window-route.test.ts`); `check:spelling` green;
  focused lint warnings only. The full suite's other failures are other sessions' files (named in the hand-off).
  `check:layout --changed` widened to the whole product (shared files) and does not run on the dev server: **skipped**,
  owed at the release sweep. **For 2C:** the help still describes the old Rainout window ("Email the families now", "Put
  all back") in `lib/help-content/house-league.tsx` (the Rainout article and its "by mistake" FAQ) — 2C's `/docs` pass;
  the old window's pure plan (`rainDays`, `rainList`, `rainSummary`, …) is now used only by its tests — 2C's `/simplify`.
  **For the owner (named, not ruled):** see §9's no-places item.
- 2026-11-25 — **Track P Session P3 built: the room and the claim (T5, T7–T10, T14–T16; drawing tabs 4, 6, 8). Walk
  published; nothing committed at writing.** Start condition held (P2 committed `74a7365c3`, walk closed `98cc31e3c`).
  **Migration 540** (`organization_previews.claim_code`, `preview_claim_tries`, the append-only `preview_claim_records`,
  the sample as reusable steps, and the room's and the claim's one-step functions, refusals PV020–PV027; see
  DATA_DICTIONARY) **applied to dev 2026-11-25 at the owner's word** ("Apply 540 to dev now"), re-applied after /legal and
  /review; production on the steps list, ORDER after 535 and 536. `/db` reviewed the shape before apply (one must-fix: the
  undo's "nothing added" check became a fail-closed scan of every club-owned table; lock order, guards on the sample steps,
  an advisory lock on the code door, the code only while open, all applied). **Who owns the shared frame:** P3 changed only
  the band line in `app/[orgSlug]/layout.tsx` (the band gains Claim it); the home stays Stage 1's.
  **What was built:** the room window (`app/platform-admin/prospect-clubs/RoomWindow.tsx`; opens from an open row and right
  after Make): QR (medium correction, wide quiet border) and the code, Copy link, full screen, the room card PDF (half
  letter, `lib/preview-room-card.ts`), New code, Let them try again after five wrong codes; the live game's score and Mark
  final (asks first) through `save_preview_score` (a save writes `submitted`, live by the clock; final `completed`); the
  save-failure line keeping the numbers; Change the meeting (the whole sample made again on the new day, the removal date
  with it); Email the link shown and refused while the mailing address is blank (nothing stored); Remove now through
  platform admin's own Delete. The claim (`app/(consumer)/start/claim/[slug]/`, `app/api/start/claim/…`): the code page
  first (our look), a 24-hour pass bound to the club and its current code carrying the claim through Start a club's own
  account step (its Terms tick unchanged) and its confirm email, the claim step (Stays/Cleared, /legal's paragraph, the
  authority tick), every failure frame; the claim route holds every Start a club rule (Terms first, one club, invitation,
  portal, Club on sale) and the one database step clears the sample, the marker and the tries, seats the owner, records the
  plan they came for (`club`), restamps `organizations.created_at` to the claim (T10 in every count) and keeps the paragraph
  with the tick in the record. Then today's plan step, trial and checkout, unchanged (probed: Club and Club · Association,
  90 days). Set up your club shows the "is yours" line for a claimed club. Prospect clubs: the claimed row's "{day} · Club, on
  trial" and the masked claimant; its window offers Undo the claim (T15) until a plan or checkout. One help line on Start a
  club (`recipe-set-up-your-club-t-next`). **Build calls, said to the owner:** Remove now types back the web address, as
  Delete does (the drawing said the name); Undo is narrower than "until a plan starts" (no checkout, no rename, nobody else,
  nothing added); step 4 of the checklist is not drawn ticked (its done rule needs a contact email); a forwarded link's code
  page keeps "For the club's board"; the room card sits outside the export engine's check (an owner-only staff card).
  **Reviews, all applied:** `/legal` (the record keeps the paragraph, the prune on every visit, the email help, "Not now"
  24 hours, the card's headline "A site for your club, already built", Terms linked in the tick, no fixed visitor salt;
  appended to its Track P review); `/billing` (no must-fix; T9 word for word, `/accounting` not needed; the claim forgets
  the start door; Undo hidden once checkout started; the cache forgets an undone club); `/design` (six must-fix: tokens in
  the room styles, the shared date field, the window closable while loading, the red code error, the card's long address
  and fitted logo; the card's type to the drawn sizes and centred, 44 px doors, the full-screen close hint, notices that
  clear); `/review` (no high; two medium: a claimer whose answer was lost goes on to the plan step instead of "already
  claimed", and one account cannot claim two clubs at once, PV027); `/docs` (the one line). **Proof:** typecheck clean (the
  one error is another session's test); 243 tests across the P3/P2/P1 guards, the Terms census and gates, sign-in
  destinations, the console colour guard and the window-foot guard; `check:spelling`, `check:dictionary` green; a
  rolled-back SQL probe of every function; page fetches (band, code page, codes, account step, forged pass, ended); a
  signed-in claim through the real routes (Terms first, the plan offer, the undo). **Accepted, recorded:** anyone can rest
  a club's door for an hour with five wrong codes (T7 as ruled; Let them try again is the remedy); an undo keeps the
  claimant's edits to the site words and logo. **Owed to P4:** the ended page on the club's own address (90 days), the one
  email and its consent record (and /legal's tick wording and roles for it), the removal. **⚠ Before the first real preview
  on production, P4's removal must be live there, or the owner removes each one by hand (Prospect clubs › the room window ›
  Remove now).** Walk: [CLUB_WEBSITE_TRACK_P_P3_WALK.html](CLUB_WEBSITE_TRACK_P_P3_WALK.html),
  https://claude.ai/artifact/4VxedNNBxzvLdKUToKKtV9, Owner QA Ledger §571 (3 walks, 47 steps).
  **Room window relaid out (owner, 2026-11-26, during the walk; replaces the drawn order):** code, Meeting, live game,
  Email the link (now a titled box, with Their role its own field), then the removal date and Remove now (the record
  Delete's look, no rule above it); the score is locked until the start; doubled spacing fixed. Walk A steps 7, 8, 10,
  13 and 19 reworded and republished.
- 2026-11-26 — **Stage 2 Session 2C built (what families and coaches see, the help, the walk). Nothing committed at
  writing.** Start condition held (2B committed `26f69ab8e`). **Landed:** the strip (K3, K4, K12, K16) on `stripSentence`,
  not a second sentence: `closureStrip` (`lib/club-notice.ts`) over `closuresShowing`, read by the club frame on every
  club page and only while the club site is on, never on a tournament's (the frame's own `wearsClubFrame`); at most four
  lines ("And N more places are closed." past four), the small line "Posted 7:10 a.m. by the club" (two times, or "by the
  club" for three or more) with " · ends tonight" only when every line does; it carries place words, days and two
  instants only, and takes an ended line down at its end time without a reload (`ClubClosureStrip`, no motion, no
  control), above the club notice. The rep mark (K9) on the five surfaces: the entry carries it (`FamilyScheduleEntry.mark`,
  read by `getFamilyTeamView` for its waiting games only, after the rule that made the view public), so the public team
  page, the club home's games part, the family schedule and the family home's Up next all read one field; a played,
  live or scored game shows its score, never the mark (`markShown`); the coach's schedule route returns the marks for
  the "Needs a new date" chip (list and week) and the amber note on the game's sheet. K17: `postponedLately` puts
  "Needs a new date" first on the public house league schedule for seven days after a postponement is SENT (the change
  rows' `sent_at`; nothing records the postponing itself). The old window's pure plan retired from
  `lib/league-rainout.ts` (`/simplify`: only its tests read it). The walk's day: `--closure-walk` on the extras seed
  (Lions Park, three house league games, one typed; the Ospreys' game; a Fall Classic game; daytime guard).
  **Heard:** `/simplify` (the mark onto the entry; one rule for played-anyway); `/review`, four lenses, high-risk (8
  fixed: played-anyway, the coach word, the extra read narrowed to waiting games, K17 chunked, the strip timer on the
  real clock, the empty "From ·", the dictionary; 4 rejected with reasons; footer in the hand-off); `/docs` (a "Close a
  place" topic in the club's guide, the Venue library's closed row, the house league Rainout article and its "by
  mistake" FAQ rewritten to point at it, the coach's "When the club closes a field", a role-path link, the popular
  "fields are closed tonight" answer pointing at Close a place); `/marketing` (§10, the 2B list settled with 2C's words;
  one proposal not applied with reason); `/design` at 390 and 1280 (the coach's week chip wrapped; the mark line made
  the row's second line under the title and the pill, after it wrapped to three lines beside the pill on a phone; four
  findings to §9); `/legal` (holds; the help now says the mark shows on the team page and the club home only when the
  team's schedule is Public). **Proof:** typecheck clean in scope; the closure, Rainout, guard and help suites green
  (`place-closures-2c.test.ts` new, 22 tests); `check:spelling` green; focused lint warnings only; the full suite's
  other failures are other sessions' files. `check:layout --changed` not run (§9). **Walk:** Owner QA Ledger §573,
  four walks, 34 steps. **For the owner:** §9's no-places call is still open; nothing was built for it.
- 2026-11-26 — **Track P Session P3 closed: the walk passed 47 of 47 (§571; A 19, B 16, C 12; no notes).** It saw the
  sample game go live at the meeting time, the check P2's walk missed. Committed `15da5e57a`, with the walk's two layout
  fixes `efb7df706` and `317704c69`. Track P's last session is P4 (the removal, the ended page, the one email); the
  nightly job still needs the owner's word in that session, and the email waits on the mailing address.
- 2026-11-26 — **Track P Session P4 built: the removal, the ended page and the one email (T11–T13; drawing tab 7).
  Committed `d3d1bcc5e`, the nightly job `0142cdf23` (2026-11-26, ahead of the walk).** Start condition held (P3 committed `15da5e57a`, walk passed §571). **Owner rulings in
  the session (asked before building, as the prompt required):** the nightly removal job **yes** (shared automation; its
  own commit, AGENCY_RULES 2026-09-26; T11 B's by-hand list NOT built); Today's **"Removal overdue (N)"** line yes (a
  missed or refused removal shows until it is gone); the address stop honoured by **every** FieldLogicHQ promotional send
  yes. **Migrations 547** (`remove_due_preview`, the removal record written by the removal stamp, `preview_email_consents`,
  `email_address_stops`, `purge_preview_email_consents`) **and 548** (the `preview-removal-nightly` schedule, 08:05 UTC)
  **applied to dev 2026-11-26 at the owner's word**; production on the steps list, ORDER 547 → the code → 548 (⚠ without
  547 every promotional email is suppressed: the stop is read fail-closed). **Who owns the shared frame:** P4 changed only
  the not-found branch of `app/[orgSlug]/layout.tsx` (and its metadata's): a missing club asks for a removed preview
  first; the home and the band are untouched. **Built:** the removal (`lib/preview-removal-server.ts`): every unclaimed
  preview past its day goes through ONE database step that takes the claim's own locks in the claim's order and re-checks
  "a preview, unclaimed, not removed, due" before Delete's own pre-cascade list and the club (a build check holds the two
  lists equal), then the stored files by Delete's same calls; files of previews removed in the last 7 days are cleared
  again; nothing emails the club. The route `app/api/platform-admin/preview-removal-nightly` (receipt-carrying, `run_jobs`
  by hand). **The removal record** is written by the removal stamp itself, so Remove now and Delete write it too (how:
  `day_30` | `removed_now`); no person. **The ended page** (`components/public/PreviewEnded.tsx`, our system-screen family)
  on the club's address and every page under it, and the claim page, /legal rec. 7's words, for 90 days, then the ordinary
  not-found; never the meeting, maker or logo; a live club always wins. **Today:** owner-only Growth rows "Removed
  tomorrow" and "Removal overdue". **The one email:** `lib/preview-link-email.ts` (/legal rec. 5 word for word; cannot be
  built without a mailing address) and its send (refuses on the address FIRST, keeping nothing; an officer's role, none
  pre-picked, no "Other"; not before the meeting day; the address stop; the consent record before the send; one per
  preview; our own mail); the room window's Email the link now posts and shows the one email once it has gone. **The
  unsubscribe** follows the address (its own token family and table), and `sendMarketingEmail` reads it fail-closed.
  **Build calls, said to the owner:** the removal runs early on the removal day (3:05 a.m. Toronto in winter), so a
  Tue, Dec 8 meeting comes down on Thu, Jan 7, the day every surface names; an undone claim past day 30 is removed that
  night (T11 as ruled); the deep tournament address of an ended preview keeps the tab title "Tournament" (the page itself
  is right). **Reviews, all applied:** `/db` before apply (no must-fix: one lock order with claim/undo/move; the only
  NO ACTION key into organizations is the facilities, whose own children go first); `/legal` (recs 5 and 7 and finding 4
  met; a build check that every sender of our unsubscribe link reads the stop; no Privacy/Terms change now, **the
  Privacy prospect sentence must be PUBLISHED before the mailing address is set**; appended to its Track P review);
  `/design` (the 404's own broken-link tile, the help as its quieter note line, the claim page's ended frame on the same
  system screen inline, its tab title, the send result as the kit's good notice); `/marketing` (the before-the-meeting
  line, `removeBody` in the ended page's nouns with the 90 days from its one constant, the two Today clear labels; spelling
  green); `/docs` (one sentence on Start a club's claim line; Prospect clubs stays owner-only with no help);
  `/review`, four lenses, high-risk (7 fixed: a consent row stranded by a request that died, a key reused after a
  refusal, an unset mail service using up the one email, the send allowed before the meeting's start, the claim page
  "ended" over a club that took the address, a silent recurring refusal now alerts, the ended read cached per request;
  2 refuted; accepted: a 200 with noindex, the small table's index, the domain release before the re-check (a preview
  has none), the sent-email log's 90 days of the address for staff, Remove now's record naming "platform-admin" beside
  Delete's own row, "stays up until" the removal day). **Proof:** typecheck clean in scope (the one error file is another session's test); the P4 guard (28) with
  the P1–P3 guards, the receipt, unsubscribe, email-kind and help suites; `check:dictionary` green; `.probe/p4-prove.mjs`
  on dev 18/18 (only the due preview removed with its sample and logo; the record; the ended page; the not-due one, a
  claimed club and a real club refused by the step itself; a second run removes nothing; the key without a receipt runs
  nothing; a by-hand delete writes `removed_now`); `.probe/p4-unsub-prove.mjs` 7/7. **Found, Track P's own from P3 (not
  in P4's lines, a small follow-up):** the grants guard fails on mig 540's `preview_claim_tries` (no UPDATE grant, by
  design); `club-share-census` (the room window's copy link reads `window.location.origin`, not the club's public origin);
  `legal-links-surfaces-guard` (the claim page's refused frame opts `StartFoot` into the legal line outside the census);
  `plan-reader-door-guard` (`lib/preview-claim-server.ts` reads a plan raw). **⚠ Before the first real
  preview on production,** 547 + the code + 548 must be live there, or the owner removes each one by hand. **The email
  stays refused until the mailing address is set, and the Privacy prospect sentence (/legal's P4 review) must be
  PUBLISHED before that.** Walk: [CLUB_WEBSITE_TRACK_P_P4_WALK.html](CLUB_WEBSITE_TRACK_P_P4_WALK.html),
  https://claude.ai/artifact/FEDVf85o1pc1j81gBQgzJB, Owner QA Ledger §575 (3 walks, 33 steps; the helper
  `.probe/p4-walk.mjs`, dev only, makes a preview due and runs the removal by hand).
  **`/simplify` before the commit (2026-11-26, four reviewers).** Applied: Delete’s file step is one shared helper
  (`lib/org-files-purge-server.ts`) that Delete and the removal both call; one day label (`previewDayLabel`, built like the
  removal date); the claim page’s ended frame is drawn by the ended page’s own component; the room window’s reads run
  together; unused state removed; the P4 guard reads source through the shared test helpers. No behaviour change, so no
  second `/review`. Proof after: typecheck and the guards (the one failure is P3’s known grants finding), spelling,
  dictionary, `.probe/p4-prove.mjs` 18/18, `.probe/p4-unsub-prove.mjs` 7/7. Seen and left: Today’s two owner rows are not
  in the shared waiting list; Delete’s record row and address release are still written twice; a preview’s files are
  cleared a second time in the run that removed it. The schema snapshots stay for the release (they carry other
  sessions’ migrations too).

- 2026-11-26 — **Stage 2 follow-up drawn and ruled (nothing built).** The owner found that Close a place takes one park,
  or all of the season's, so two of three needs two runs; then the same for two of three diamonds. Drawn in three
  versions (an always-open tick list; the owner's dropdown with chosen rows; ticked diamonds), M1–M8 ruled all A (§7),
  design check applied. Census from code for the build: the press and its window read both refuse the same park twice,
  and one guard test reads the press from mig 539's file only. Session 2D's prompt written; D1 ruled A the same day.
- 2026-11-26 — **Track P Session P4 closed: the walk passed 33 of 33 (§575; A 18, B 9, C 6; no notes).** Every session of
  Track P's build is committed, and the three with something to see (P2, P3, P4) are walked. Still owed before the first
  real preview on production: 547, the code and 548 live there. Before the email can send: the Privacy prospect
  sentence published, then the mailing address set. The four guards listed under P4's build entry (grants, club share
  census, legal-line surfaces, plan-reader door) were rerun after the pass and all four still fail.
- 2026-11-26 — **Track P closed (owner: "go ahead with 1-3").** The four failing guards pass again (`cf85bc916`): the
  claim page joined the legal-line census, the room window's link the club share census, the claim step's plan read the
  plan door's list; migration 540 carries the grants guard's own comment for the wrong-code table's narrow grant (the
  guard and the database unchanged). The plan door guard also named two files that were not Track P's: the tournament
  card-payment yes/no now asks the door whether the organization is canceled (the one behaviour change), and the guard
  reads CRLF files correctly. **Carried to the release:** 547 → the code → 548 on production before the first real
  preview; the Privacy prospect sentence published, then the mailing address set, before the email can send.

## 8. Census questions for Stage 0 (answer from code, not from this plan)

Answered 2026-11-24 (Stage 0 Part 1); evidence in the Progress block.
- [x] Do house league and rep team games point at a real field record, or a typed name? **Either:** a picked place is a
  real link; a typed name is allowed by design in both. Permits always link. See Progress item 3.
- [x] Which rep team schedules are public today, and how does the home learn that without leaking a private one? **Only
  "public link" teams**, decided in one helper per team; the home must call it (and the house league and tournament
  rules), never the staff calendar read. Item 2.
- [x] What does a club with nothing open and no games see on the home today, on a phone? Teams, House league (a "past
  seasons" door if none is live), Tournaments (finished in the last 30 days), About, sponsors. Item 1; Kestrel `today/`.
- [x] Re-check every ◦ item in §2 that the stage being drawn leans on. Item 7.
- [x] Is the prospect seed's allow-list the only thing holding it to two clubs, and what does it write that a real
  club's sign-up would collide with? **No, four guards; nothing collides, because it runs on dev only.** Item 5.

## 9. Findings routed, not acted on

- [ ] `/marketing`: the two "running right now" demo lines (§2.2 item 3).
- [ ] The browser-tab icon on a club's own web address (§2.3 Identity): a small truth fix, the owner's word to build.
- [ ] Stale records met on the way: `BRAND_STRATEGY.md` and `PRODUCT_ROADMAP.md` still read as if Club is not on sale ◦;
  `lib/club-shortcut.ts:15` still says `/teams` forwards "until Stage 4b" though the club Teams page exists ◦.
- [ ] IDEAS_BACKLOG "Public Site Offering Evaluation" now points here.
- [x] **Milton's rep team pages were all "not found" on staging (found 2026-11-24).** `scripts/lib/prospect-demo-rep.mjs:54`
  built the web address with `/s+/g` where it meant `/\s+/g`, so "U11 Select Purple" became `u11--elect purple`,
  spaces included. **Fixed and re-seeded 2026-11-24 on the owner's word** (`npm run demo:milton`): addresses now read
  `u11-select-purple`; the team pages and their tryout pages answer 200 on staging. Team ids are derived from the address,
  so each team's Coaches Portal link changed once (the dressed team is now `45f793be-…`); no run sheet, QR card or walk
  holds a team id. Uncommitted.
- [ ] `/{club}/news` forwards to the club's latest tournament even after it finished (Kestrel, 4 days after its Fall
  Classic ended). Part 2's news frame answers this.
- [ ] `/legal` (Stage 0 read, 2026-11-24): the published **Data Terms §4 and Privacy §5** say no "roster" is shown on a
  public page; a team photo arguably is one. Before Stage 3 builds, the wording gains "a photo your organization
  chooses to publish is its own publication; we never add a name to it", and Privacy §5/§9 gain uploaded photos and the
  consent answers; Privacy §4 gains one sentence for sponsor counts (Stage 5). A `/legal` topic file on minors' images
  is owed (none exists). Lawyer's eye flagged: minors' images and withdrawal, whether "Email me when it opens" is a
  commercial message, Track P's use of a real club's name and logo.
- [ ] A rep team's family sign-up may sit behind the guardian tier (switched off). If so, the photo consent question
  has no rep door and a rep team photo never shows until it is on. Stage 3 checks.
- [ ] **A banner photo is published exactly as it was uploaded (found 2026-11-24, idea 11's census).** The banner
  upload stores the file as sent (`app/api/admin/org-hero-banner/route.ts:60-68`, verified), so a photo taken on a
  phone can carry its hidden location and device data onto a public address. The club logo and tournament logo are
  stored the same way ◦. The sponsor logo already re-saves and drops it (`lib/sponsor-logo-image.ts:31-35`). A small
  privacy fix that does not wait on this project; the owner's word to build. F8 makes re-saving the rule for every picture.
- [x] `/legal` read idea 11 before it was drawn (2026-11-24): topic file
  `docs/agents/legal/MINORS_IMAGES_AND_CLUB_FEED.md`. What it set for the drawing: the photo question is its own
  yes or no, neither chosen for the family, never a condition of signing up (OPC finding #2025-005); the all-yes rule
  reads only the players the club says are in the photo; asked each season; a photo under no team shows no
  recognizable player; an Instagram post loads on the visitor's tap; caption off by default; a coach sends a link, the
  club publishes it; pictures re-saved without location data; one line on the public page for a parent who wants a
  photo down. **Before any player photo is public:** the published Privacy Policy and Data Terms both say children's
  information "is never shown on public pages"; a new version of each, most likely a material change, comes first.
- [ ] **Four product findings from that read, for `/plan`:** a family cannot change or withdraw any consent answer in
  the product and no code records a withdrawal; a parent has no way to ask for a photo to come down, and staff have no
  take-down; the banner and logos carry location data (the entry above); the house league help text suggests a
  required "photo release" document, the pattern the regulator found against.
- [ ] DATA_DICTIONARY.md:1195 names the deleted `LogicSyncBracket` as a reader of the open games read; `/db` to correct,
  and to say whether `USING true` lets anyone read games in an unpublished division (Progress item 4).
- [ ] **A rep team's running score reads as a finished tie (found 2026-11-25, Stage 1 Part 1 item 3; a live defect
  today, not this project's).** The coach's Game-Day console saves the running score with no result; the public team
  page (public-link teams) and the family schedule treat any score as a finished game and print "T 4–2" until End
  game. `lib/family-view.ts:117-119`, `lib/family-schedule-format.ts:48-51`. To `/plan`: read "score, no result, inside
  the game window" as live (or say nothing) on both. Stage 1's rep rows use the same rule, so the fix comes first or
  with it.
- [ ] **No club time zone (Stage 1 Part 1 item 5).** Every club reads Eastern times and an Eastern "today"
  (`lib/timezone.ts:23`). A launch-wide fact for a club west of Ontario; to `/plan` (and `/strategy` if a western club
  is in the launch). Not Stage 1's work; Stage 1 uses the shared helpers so it follows.
- [ ] **The tournament schedule polls up to three times per tick (Stage 1 Part 1 item 8).** The page, the My Team dock
  and the ticker each fetch the same section every 30 seconds. To `/db` or `/plan` with Stage 6, which touches the same
  hooks.
- [ ] Stale dictionary lines met on the way, for `/db`: DATA_DICTIONARY.md:3369 (rep scores "prod-pending", they are on
  prod) and :8098 (house league "postponed" called dead; rainouts and Postpone write it).
- [ ] **The open games read, answered (`/db`, Stage 1 review, 2026-11-25; pre-existing, not Stage 1's).** Yes: anyone
  holding the public key can read every tournament game straight from the database, unpublished divisions included
  (`games` is the only game table with anonymous SELECT, 27 of 30 columns; `league_games`, `rep_team_events` and the
  house league tables have none). The app's pages never do; Stage 1 adds no such path and its guard forbids a browser
  database client or live channel on the home. To `/plan`. (The item above about line 1195 stays for the dictionary fix.)
- [ ] **A rep team's copied tournament game goes stale on its public page (`/db`, 2026-11-25; pre-existing).** The copy
  is made from published divisions only, but re-synced only when a coach or admin opens the team's events
  (`lib/rep-tournament-game-mirror.ts:288`, callers `app/api/coaches/[orgSlug]/teams/[teamId]/events/route.ts:86` and the
  admin events route); an organizer's later unpublish, time change or score stays on a Public team's page until then,
  and the public view has no field telling a copy from a typed game. Stage 1 drops every copied game from the home. To
  `/plan` for the team page itself.
- [ ] **Some house league routes ask no draft question (Stage 1 Pass 1, 2026-11-25; pre-existing).** The public
  status page by link (`app/[orgSlug]/league/[seasonSlug]/status/[token]/page.tsx`) and the sign-up routes
  (`register`, `friends`, `withdraw-request`, `email-my-link`, `form/files/[fileId]`, `lib/club-form-family-route.ts`)
  load a season without asking `isPublicLeagueSeason`. Each needs a token or a form a draft season never hands out, so
  it may be fine; nobody has checked. Pass 1 left them alone (not Stage 1's). To `/plan`.
- [ ] **Does the edge honour `s-maxage`? (Stage 1, 2026-11-25.)** The games check sends `public, max-age=0,
  s-maxage=20` and puts the club in its path, so an edge keyed on the path alone cannot mix two clubs; nothing in the
  repo shows whether Amplify's edge holds it at all (the calendar feed's comment is the same open question). Stage 1's
  walk checks it on staging (two requests within 20 s, the second's age header). If it does not hold, every 30-second
  check is a full read: the cost tab 7 priced, not a defect.
- [ ] **The games check's window ends on the platform's game length for a tournament's last game (Stage 1, 2026-11-25).**
  A tournament game's own length is the tournament's; the read counts it with the default 90 minutes plus 30, so a long
  final can stop the home's checks before it ends (the tournament's own pages keep checking). Low; Stage 6 can widen it.
- [ ] **The home reads tournaments and seasons twice per render (Stage 1 Session 1B, 2026-11-25).** Its own loader and
  the one games read each read them. Database load, not latency; fixing it changes the reviewed read. Low.
- [ ] **The games check has no rate limit (Stage 1, 2026-11-25).** Pass 1's route; cost only, and the edge hold (above)
  softens it if it holds.
- [ ] **A tab left open past midnight keeps yesterday's "Today" until reload (Stage 1, 2026-11-25).** Likewise a
  tournament awaiting a score confirmation, or with untimed games, can sit in Later today after its games. Low.
- [ ] **`check:layout --changed` was not run for Stage 1 (2026-11-25).** Another session's edit to
  `app/[orgSlug]/layout.tsx` widened it to 371 screens, and its sign-in and fixtures have lapsed; the repair signs
  everyone out, so it needs the owner's yes. `/design` checked the Stage 1 screens by capture instead.
- [ ] **"Rainout" and "rain-out" both reach customers (found by `/marketing`, 2026-11-25; not Stage 1's).** The house
  league button says "Rainout" (`lib/league-rainout.ts`); coach copy says "rain-out" (the announcements page and the
  team overview). One spelling per the binding rule; to `/marketing` to pick, then `check:spelling` to hold it.
- [ ] **The drawing's tab 8 word list says "Rep · {team}" where plan §10 and the code say "Rep" / "Rep · away"
  (2026-11-25).** The plan wins (the team line already names the team, G5); the drawing's list is stale on that one line.

- [x] **`PLAN_PRICING_FACTS.md:128` still says the Rainout is "not built" and must not be advertised (found by
  `/strategy`, Stage 2 drawing, 2026-11-25).** It ships today (the routes gate on `bulk_reschedule`). To `/strategy`;
  K14's ruling corrects it in the same unit if Close a place replaces the Rainout. *(Trued by `/strategy` in Session 2B,
  2026-11-25, with the decision logged in `BUSINESS_DECISIONS.md`.)*
- [ ] **A club with no places: the Rainout button now opens "Your club has no places yet" (found building Session 2B,
  2026-11-25; an OWNER CALL, named, not ruled).** K8 (a club with no places opens the Venue library) and K15 (the Rainout
  button opens Close a place) together mean a house league whose games carry only typed places — every club on
  production today has no places — can no longer call off a rainy day from the schedule until it adds its places. Today's
  Rainout does it with typed places. An owner or admin can still close "All our fields" (it needs no place) once the club
  has one place; a house league admin cannot (K1/K15). Built as ruled. Options for the owner: (A) as built; (B) the
  no-places state also offers "All our fields" to an owner or admin; (C) B, and a house league admin may close every
  place from the Rainout button only. Pre-customer, so the reach today is the demos and any trial club.
- [x] **The old Rainout's help is stale until 2C's `/docs` pass (Session 2B, 2026-11-25).** `lib/help-content/house-league.tsx`'s
  Rainout article and its "I pressed Rainout by mistake" FAQ still describe "Email the families now" and "Put all back".
  2C rewrites them to point at the new "Close a place" topic (build prompt 2C step 6). *(Done in 2C, 2026-11-26: both
  rewritten; Put all back is described only for an older held Rainout; the club's guide gained the topic.)*
- [ ] **A server read for house league games' closure words is built and unused (Session 2C, 2026-11-26).**
  `leagueClosureReasons` (`lib/place-closures-server.ts`, 2B) has no caller: the drawing's club home shows a closed
  place's house league games as a plain "Postponed", which is what ships. Remove it, or give it a surface, in a later
  stage. Low.
- [ ] **Calendar feeds don't carry the rep mark (Session 2C, 2026-11-26).** K9's five surfaces are the screens; a
  subscribed calendar keeps the game at its time until the coach moves it. Named, not ruled. Low.
- [ ] **A page left open keeps the strip after a Reopen until it reloads (Session 2C, 2026-11-26).** The strip takes
  an ended line down by itself at its end time, but a Reopen is only seen on the next load, as the club notice's
  End now is. Low.
- [ ] **The strip's small line repeats the day for a several-day closure pressed earlier (`/marketing`, 2C,
  2026-11-26).** "Posted Fri, Nov 27 at 7:10 a.m. and Fri, Nov 27 at 9:05 a.m. by the club": honest and rare; saying the
  day once is a code change. Low.
- [ ] **`check:layout --changed` was not run for Stage 2 (Sessions 2B and 2C).** Shared files widen it to the whole
  product, which doesn't run on the dev server. `/design` checked the stage's screens by capture at 390 and 1280
  instead; the release sweep owes the rest.
- [ ] **The Overview's "Close a place" door is under the phone tap floor (`/design`, 2C, 2026-11-26).** 104 × 26 px:
  it is the club kit's shared text link (`ck.link`, `ClubHubKit.tsx`), the same height as the Overview's other text
  links ("Continue setup", 19 px). A kit-wide fix, not this stage's. Low.
- [ ] **"Give them new dates" is a secondary button on the close result and the primary green on the Reopen result
  (`/design`, 2C, 2026-11-26).** Check against the drawing's tab 3 and settle one. Low.
- [ ] **The coach's month view shows no "Needs a new date" chip (`/design`, 2C, 2026-11-26).** The list and the week
  show it, and the game's sheet carries the note; the month cell is a dot-and-title cell with no chips today. Named, not
  ruled. Low.
- [ ] **The family app's mark has not been seen in a browser (2C, 2026-11-26).** No made-up family follows the U13
  Ospreys, so neither `/design` nor the walk can reach it; tests pin its words and its rule. A fixture guardian on the
  Ospreys would let a later walk see it. Low.

## 10. Words for /marketing

> Customer-visible wording written during a build, settled in ONE `/marketing` pass per stage, before the walk.
- [x] **Stage 1 (drawing, 2026-11-25), settled by `/marketing` in one pass plus a follow-up for the words the `/ux`
  review added.** Already settled by Stage 0: "Today", "Latest results", "Live now", "N more open now". Kept: "Later
  today" (not "Up next": the band holds the whole rest of the day), "N more live now" / "N more later today" / "N more
  results" with singulars "1 more live now" / "1 more later today" / "1 more result", "Show fewer" (no second line),
  "No score yet" (tournament live rows, and a house league game whose window ended with no score), "Score after the
  game" (a live house league row: there is no running score), "22 games today · first at 8:00 a.m.", context lines
  "House league · U11", "Rep", "Rep · away", "N house league games postponed" (cancelled; "not being played" for a mix;
  singular "1 house league game postponed"), "Moved to Sat, Dec 5" (the Moved pill alone when no date is set), "{season}
  schedule" / "Today, by division", failure title "Games" + "Games can't be shown right now. The house league schedule
  and each team's page still have them." + "Try again". Changed: "N games on now" → **"N live now"**; "22 finals today"
  → **"22 games today · all final"** ("20 of 22 games final" when some were called off; "finals" means championship
  games on tournament pages); "38 finals" → **"38 results"**; the Tournaments card's "Today" → **"Games today"**;
  "Called off" → **"Not being played today"**; the site editor line → **"3 of 20 rep teams show their games on your
  site. Each team's coach chooses this in Schedule visibility."** with "1 of 20 … shows its games", "All 20 …", "No rep
  team shows its games on your site yet." The coach setting is **Schedule visibility: Staff only · Families · Public**
  ("public link" is code only). Option only (G6 · D): "Updated 10:15 a.m." = the last successful check, unchanged by a
  failed one. Run `npm run check:spelling` after the build.
- [x] **Stage 1 (build close, 2026-11-25), settled by `/marketing` in one pass over the shipped words.** About 30 strings
  match the list above. Added for states the drawing did not word: a tournament past its last window with nothing
  entered **"5 games today · no results yet"**; between rounds with some finals **"14 of 22 games final"** (none final:
  "22 games today"); the editor line's **"Both rep teams show their games on your site."**, **"Your rep team shows its
  games on your site."** and **"Your rep team's games aren't on your site yet."**; the failure line for a club with no
  house league link **"Games can't be shown right now. Each team's page still has them."** Kept as ruled: "Each team's
  coach chooses this in Schedule visibility." (`/marketing` floated adding "(Public shows games on your site)"; not
  applied, the ruled words stand). `check:spelling` green.

- [x] **Stage 2 (drawing, 2026-11-25), settled by `/marketing` in one pass.** The full list is the drawing's tab 9
  ("Words"). Changed by the pass: the coach email's subject "Lions Park is closed: U13 Ospreys game needs a new date",
  its body ending "Give it a new date, or cancel it.", its foot in the shipped group-email lines ("{Name} ({role},
  {Club}) sent this. You get it because you're head coach of {Team}. Reply to this email to reach {Name}. Not right for
  you? Reply and tell {Name}."); the coach sheet "From {Club} · Lions Park closed on Sat, Nov 28. Give this game a new
  date with Edit, or cancel it." (never a bare "From the club"); the coach pill **"Needs a new date"**; the public rep
  line Stage 0's **"Lions Park closed · waits for a new date"** under the "Place closed" pill; "Diamond 2 at Lions Park is
  closed today."; "Lions Park is closed tomorrow (Sat, Nov 28)."; "…they still show as scheduled."; "The U13 Ospreys have
  no coach to email, so let the team know yourself." Kept: "Close a place", "Not now" (shipped in 8 files), "Reopen",
  "Place closed", "Closed", "Closed today", "All our fields are closed today." **"Rainout"** one word (6 coach strings
  to change at build). The Reopen line to the coach is a full coach email (same sender, reason and reply lines).
- [x] **Stage 2 (build, Sessions 2B + 2C), settled by `/marketing` in one pass, 2026-11-26.** Everything listed below
  is KEPT except: "The closure didn't reach us…" → **"We couldn't tell if the closure went through. Check your connection,
  then press again: it closes once, however many times you press."** (a lost answer can follow a closure that was made);
  "Don't link them" → **"Don't link"** (the label says "Link it to…" for one game); Reopen's "its head coach gets one line"
  / "their head coaches…" / "The {Team}'s head coach was emailed." → **"coach" / "coaches"** (with no head coach on file
  the Reopen email goes to the team's other coaches; the close side already says this through who is reached); the coach
  chip's hover title → **"The club closed this place. Give the game a new date."** 2C's own words KEPT: "And N more places
  are closed." (N is always 2 or more), "Posted 7:10 a.m. by the club" / "Posted 7:10 a.m. and 9:05 a.m. by the club" /
  "Posted by the club" with " · ends tonight" / " · both end tonight" / " · all end tonight", "All our fields closed ·
  waits for a new date". The help copy for Close a place got three voice fixes (Reopen takes the strip off the site, not
  "it all"; the tool tells the site, house league families and rep coaches, not "everyone"; the coach's email comes from
  the club, not "as the head coach") and one consistency fix ("the day's email limit", not a hard-coded "3 a day").
  **Not applied, with reason:** `/marketing` proposed rewording the window's malformed-request answer "The request was
  not understood"; it is the house string across eight routes and only a broken request meets it, so it stays one
  string. Noted, not changed: a several-day closure pressed on an earlier day words its small line "Posted Fri, Nov 27 at
  7:10 a.m. and Fri, Nov 27 at 9:05 a.m. by the club" (honest, rare; saying the day once is a code change for later).
  `check:spelling` green.
- [x] **Stage 2 (build, Session 2B, 2026-11-25): words the drawing did not word, for 2C's `/marketing` pass** (all in
  `CLOSE_WORDS`, `lib/place-closure-window.ts`, and `COACH_MAIL`, `lib/place-closure-mail-words.ts`): the refusals
  ("Some games changed while the window was open. Nothing was changed. Look again.", "That day has passed…", the draft,
  finished and not-found lines, "The closure didn't reach us. Check your connection, then press again: it closes once,
  however many times you press."); "Link it to …" / "Link all N to …" and, once chosen, "N are linked to Lions Park when you
  close. Families aren't told." with "Don't link them"; "Closing…"; "Close all our fields"; "Rep · N games · marked for its
  coach" and "It is marked for its coach when you close." (a house league admin's count); the rep row for a team with no
  head coach ("Marked, not moved. Its coaches are emailed (it has no head coach on file) and set the new date.") or no
  coach ("… It has no coach to email, so let the team know yourself."); "N practices at Lions Park that day aren't
  changed here."; the result's "Those families were already emailed. Nothing more was sent.", "Some house league emails
  didn't go: their changes are waiting in Changes to send.", "The {Team}'s coaches weren't emailed, so let the team know
  yourself.", "{Tournament} plays today." + "… If it plays at Lions Park, open its Rain delay.", "This closure was already
  made. Nothing more was sent."; Reopen's "N rep games lose their marks…", "N coaches were emailed."; the Venue library's
  row line for several days ("Sat, Nov 28 to Sun, Nov 29 · closed 7:10 a.m. by Dana Reyes · 4 postponed"); the Overview's
  **"Places closed"** card with "Lions Park · reopen from the Venue library" (the drawing names this line, never words
  it); the banner "A closed place on Sat, Nov 28: 4 games postponed, waiting to be sent." and the refusal "These games are
  from a closed place, so they can't be put back. Send them, or give each a new date."; the Rain delay's "{Club} closed
  Lions Park on Sat, Nov 28. Its diamonds are picked below."; the coach email for two games ("Your 2 games there need new
  dates: … Give each a new date, or cancel it."), with no head coach ("You get it because you coach {Team} and it has no
  head coach on file."), with a nameless admin ("Reply to this email to reach the admin at {Club} who sent it." / "Not
  right for you? Reply and tell them.", /legal), and Reopen's subject "{Place} reopened: {Team} game wasn't moved".
  Drawn words changed at build: the multi-day site preview reads "… at once, until the end of Sun, Nov 29." (the drawing's
  "It comes down by itself at midnight Sunday."); the computer table keeps the Rainout's "Time and place" column (the
  tournament and events rows the drawing dropped it for sit outside the table); a multi-day closure lists its games with
  their day in one group per program (the drawing groups by day).

## 11. Architectural decisions

- **Decision:** nothing in this project names a child on a public page. **Rationale:** BD 2026-08-01; re-opening it is
  a `/strategy` entry with a consent model, never a side effect of a stage here.
- **Decision:** "the site writes it" means fixed sentence patterns over the club's own data. **Rationale:** the Data
  Terms' promise that a club's information is never given to an AI service.
- **Decision:** the ten ideas share one drawn end state before any one is built. **Rationale:** the owner's
  2026-11-24 instruction; §4.
