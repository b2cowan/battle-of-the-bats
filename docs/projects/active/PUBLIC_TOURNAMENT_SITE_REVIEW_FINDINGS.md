# Public tournament pages: independent review and proposed direction

**Review date:** 2026-10-27  
**Status:** Review and mockups only. No product code or shared project records changed.

## Recommendation in one minute

Keep the tournament's event navigation and game-day tools, but retire its visual carve-out. Put every public tournament on a warm, light, readable ground; keep the tournament as a distinct event shell; and let a club's or paid standalone organizer's saved brand show through safe colour roles. A free standalone event stays complete and neutral, with no host logo. This lets a club's page and tournament feel related without making tournament pages depend on a club or copying the club's 72-pixel bar onto a screen that has different jobs.

The biggest phone problem is **too much chrome and repetition before the useful content**, not a lack of information. In the live demo, a fan sees an active tournament, a date/status header, a horizontally moving score ticker, then a second block of the live matchups before getting to the tournament-day content. A demo-only walkthrough adds three more full-width rows before all of that. The upcoming event is calmer, but its invitation and registration explainer occupy much of the first screen before the visitor reaches the schedule. The actual schedule page in the active demo says it has not been published even while its home page shows live games. That mismatch is a fixture/content problem and a trust failure, not a reason to hide the schedule tab.

## What a family does on a phone

The useful order on game day is:

1. **Find the next game and its start time.** Put the followed team's next or live game first, with opponent and status visible.
2. **Find the field and get directions.** The venue name, diamond/field, and directions link belong in the same game row or the first tap from it.
3. **See whether the game is live and the score.** Show one strong live-score surface; do not repeat the same matchup in a ticker and a second list without a clear reason.
4. **Check the score and standings.** Keep the compact standings table and its team/points anchors on a phone; let a person choose a division.
5. **See what happens next.** Show the next game or round and a clear link to the full schedule/bracket.
6. **Find rules, news, registration, teams, and the host club.** Keep these doors easy to reach, but give them less first-screen weight during play.

**Evidence captured:** the active demo home and key tabs at 390px and 360px, plus a 1440px desktop pass; the upcoming Riverdale Invitational home at 390px and 1440px; a game-detail page at 390px; and the club home at 390px for comparison. Screen captures are listed in the appendix. The captures are from the existing local development server, which returned 200 for the required platform-admin login check and showed no Supabase `EACCES` fetch failures in its log.

There are important limits to this evidence. The active demo is intentionally a guided sales sandbox, and its walkthrough banner is not normal tournament chrome. Its active home shows live games while its schedule tab renders an unpublished empty state. The only public demo organization available here has a visible club identity; I could not capture a standalone free event with no logo, another organizer's custom colour, a paid custom event, a valid team-payment token, or seeded long-team/many-game cases. The drawings mark these as stress fixtures or unavailable live evidence instead of claiming they were observed. The page-by-page findings below separate captured behaviour from source-backed behaviour and known project records.

## Page-by-page audit

Severity means how much the current screen impedes the family job: **blocks the job**, **slows the job**, or **cosmetic**.

| Page | What is there today | What gets in the way / text-heavy offenders | Worth keeping | Severity |
|---|---|---|---|---|
| **Overview / home** | Event identity, date/status, follow/share, game-day ticker, live games, a follow-my-team card, results, event snapshot, upcoming games, announcements, and page links. Before the event it can lead with a hero and registration; while active it leads with data by the 2026-06-01 ruling. | At 390px the live ticker is followed by a second live-game block, so the same matchups occupy two attention layers. “Tournament Day / What To Check Now” and “My Team / Follow your team” each add explanatory copy before the later upcoming-games section. The sandbox-only “LIVE DEMO / Start your own — free / Registration week / 3 weeks before / Game day / The morning after / Step 1 of 4” stack masks the real first screen in this demo and must not be generalized to customer pages. Before the event, the registration lead and Coaches Portal explanation are a long block before schedule data. | State-dependent home; live data first on game day; follow without account; share; next game with field; finals and status snapshot; pre-event registration when genuinely open. | **Slows the job**; the sandbox banner **blocks the job in the demo**. |
| **News** | Announcement cards, date/author context, empty state, and links to schedule/standings. | The heading and explanatory line both say what the page is; the empty state adds a second sentence explaining that announcements appear later, then offers several doors. On a phone this page can be reduced to a short title, announcements, and one useful empty-state sentence. | Announcements, organizer attribution, dates, and links from an announcement to schedule changes. | **Cosmetic** when populated; **slows the job** in the empty state. |
| **Schedule** | Day-first schedule, division selection, Pool Play/Playoffs control, list/bracket switch, search and team filters, game rows, venue links, and an unpublished/empty state. The owner has already ruled the smart landing, one day at a time, local time, strict time order, and the pool/playoff stage switch. | The captured active event says “Schedule coming soon” and “The tournament schedule has not been published yet. Check back before game day,” while the same event is live. This makes the core job fail. In a populated event, the phone control stack can become a second page before the games: division, day, stage, list/bracket, search, and team filter. “No games yet” and an additional “schedule coming soon” layer should not repeat the same absence. | One-day view, automatic landing on the relevant day, all-day game order, “My games,” search, directions, time-zone clarity, and the existing Pool Play/Playoffs distinction. Keep the shared fields and dropdown behavior. | **Blocks the job** when the published schedule is unavailable or falsely empty; otherwise **slows the job** if controls push games down. |
| **Game detail** | Opponents and score/status, division and game type, date/time, venue/diamond, address, directions, and game context. | The captured route inherits the event ticker and all tournament navigation before the game facts. The detail itself is useful, but the relevant fact—where and when to go—should outrank descriptive or administrative context. Keep long team names wrapping instead of truncating to an unreadable fragment. | Direct deep link from a schedule row; both teams; game status/score; local start time; full venue/diamond and directions; game type. | **Slows the job** through inherited shell height; the content itself is useful. |
| **Standings** | A real table, division selector, score-state summary, optional followed-team card, recent scores, playoff bracket, tie-breaker order, and metric legend. The captured phone table contains four teams and remains a table. | Several useful sections stack: division, three status totals, bracket, table, six metric definitions, and tie-break order. The metric legend repeats short column names below the table, but those definitions matter when columns are abbreviated. On a narrow phone, horizontally scrolling data can hide the middle values; keep Team pinned left and PTS pinned right as ruled. | Table on every width; sticky Team and PTS; division selection; record and points; real pending/final distinction; the bracket when relevant; explanations of columns and tie-break order. | **Slows the job** due to stacked supporting sections. The table is not a problem to solve by replacing it with cards. |
| **Teams** | Teams grouped by division with name, record, rank/points, next opponent or pool state, and follow action. The captured page groups eight accepted teams into two divisions. | Each team card can carry initials, name, record, rank, points, live opponent, pool completion, and Follow. Repeated metadata makes a long list read as a stack of mini dashboards. Long names need one or two readable lines, not ellipses that conceal which team is playing. | Division grouping, team page door, Follow, rank/record, live/next-game context. Preserve any public coach/player information only where it is already enabled. | **Slows the job** in a long list; **cosmetic** in a short list. |
| **Team profile** | Team identity, record/standing, game list, upcoming/live result context, follow/alerts, and available public team information. | After the profile finishes loading, the captured Riverdale Rapids page says “0-0-0” and “No games scheduled yet” while the same event's Overview and ScoreTicker show the Rapids playing and having completed games. This demo mismatch blocks the expected team lookup; it may be a fixture/read discrepancy and is not proof that a customer event is wrong. A family comes here for this team's next game and results, so long names and duplicate game surfaces also need care. | Team-specific schedule/results; follow and alert actions; record/standing; public information allowed by the organizer. | **Blocks the job in the captured demo** because the team view contradicts the event's other public views. |
| **Playoffs / picture** | Seeding method, top seed, best offense, stingiest defense, seed list, opening matchups, scores, dates, venues, and a full bracket. | The captured 390px page runs to roughly 1,675px before the full bracket finishes. “The Bracket Is Set,” the one-line format explanation, three key-number panels, the complete seed ranking, and repeated matchups all precede/compete with the games a parent may need to attend. Put the next matchup and its field/time first; put how the seeding was calculated behind a tap. | Full bracket, seed order, matchup scores, round names, venue/directions, shareable bracket. | **Slows the job** substantially on a phone. |
| **Results** | The `/results` route resolves to the same Results & Standings experience. | A separate label or mental model suggests a second destination, but the captured route presents the standings content. Do not build or advertise a duplicate results page. | One source of truth for final scores and standings; the existing route can remain as an address/shortcut. | **Cosmetic**; the duplication is conceptual, not a second screen. |
| **Rules** | Organizer-authored sections, jump links when there are many sections, and the full rules/resources. | Rules are necessarily text-heavy. The empty-state page still spends a paragraph telling visitors that rules/resources are not published and to check later. For populated rules, all sections open by default make a phone scan long. Make each section a tap-open disclosure and keep section jump links when they genuinely help. | Complete rules, conduct requirements, required resources, jump-to-section links, and the notice that rules can change. | **Slows the job** when populated; missing rules before game day can **block** a family who must know a rule. |
| **Register** | Registration state, team/coach flow, division availability, form fields, and closed/unavailable states. The captured upcoming event is accepting teams; the active event is correctly closed. | On the upcoming home, the registration card includes a full sentence about setting up a free Coaches Portal and another for people who only want to follow. That context is useful but consumes space before games. In the closed state, the message and three navigation actions repeat doors the site already has. The form itself should not be compressed into an unreadable long wall. | Eligibility/capacity, all fields and consent, saved progress if supported, registration-open/closed states, rules and contact doors. | **Slows the job** on the home; **blocks registration** only if the real form is unavailable or a state is wrong. |
| **Team pay** | A private emailed-link page with owing/paid/returned/confirming states, receipts, deposit/full choice, payment methods, and the test-payment explanation. | The project record reports that event date/countdown text overlapped the team heading and “Test payment” line, and that the event side rail has no task here. In the current local working copy the valid payment content now uses the page offset that should clear the header and ticker; that working-copy change is already present, so the collision note may be stale for local code. A valid token was unavailable, so this was not visually rechecked. The irrelevant rail remains part of the outer tournament shell by composition. Payment should open as a focused task page without the event sidebar/tabs, demo pitch, score ticker, or unrelated nudges. | Private non-indexed link; honest test mode; clear amount/choice; safe confirmation; receipts and balance; contact when payment is handled by the organizer. | The recorded overlap **blocks payment comprehension** if still present in a deployed build. The irrelevant rail **slows the task**. Local evidence is insufficient to call the overlap live-fixed. |
| **Champions** | Champion recap after a title is decided; otherwise a short “No champions crowned yet” state with a door to the playoff picture and tournament home. | The empty state is clear but repeats the future behavior in another sentence. When complete, make winners/results the first focus; historical summary can expand below. | Champion identity, result, division/tier, shareable recap, next door to playoff history. | **Cosmetic** before the event is done; **slows** if the completed recap repeats the bracket. |

### Shared shell audit

| Shell part | Finding | Severity |
|---|---|---|
| Event header | The unified header successfully carries event identity, date/status, and compact identity actions. On the 390px capture the active header plus tab row is readable, but it still consumes a large first-screen slice before the page begins. Keep it compact and avoid a second hero that repeats the event title. | **Slows the job** slightly. |
| Desktop rail | The tournament identity and event pages are useful orientation on wide screens. It has no task on an emailed team-pay link and should be suppressed there. | **Cosmetic** on ordinary pages; **slows** payment. |
| Top tabs | The tabs expose real event sections and horizontally bring the active section into view. At 360px, many labels require a swipe. Keep the current event navigation decision; keep rarely used but useful pages reachable through the existing navigation pattern rather than expanding the first screen. | **Slows discovery** of the far tabs. |
| Persistent phone bar | It is a deliberate global product bar with a different purpose from the tournament tabs. It differs from the club's site, which intentionally removes the platform phone bar. Keep the event/global bar for its account and cross-product job, but apply the same warm surface, type, and spacing language. Do not put a second tournament-specific bottom bar beside it. | **Cosmetic** continuity gap; no reason to reopen navigation by itself. |
| Score ticker | A quick glance at current scores is valuable on game day. It is a moving, compact strip and should remain pausable/minimizable. On home, the same games then reappear in the “LIVE NOW” list; the second surface should be the full matchup/field card, not a second ticker-sized summary. | **Slows the job** through repetition. |
| My Team dock | A strong game-day shortcut once a family follows a team. Expand to opponent, venue, start, share, and alerts. It duplicates the home's “My Team” follow card when no team has been selected; avoid showing two prompts for the same action. | **Cosmetic** once followed; **slows** before following. |
| Follow / alerts nudges | Follow is account-free and the sign-in nudge is optional, which is right. Keep install/alerts nudges away from the next game and payment task; a game-day sales message is badly timed. | **Cosmetic**, unless it covers content. |
| Flip pill | It is a role-switching tool, not a family job. Keep it only for a viewer who can actually switch into an event role; otherwise hide the entry point. | **Cosmetic** for most families. |
| Free-event acquisition / platform credit | A free event needs its platform attribution and offer. The existing rule folds the free acquisition treatment into a small credit while the score ticker is live. Keep that restraint; the sandbox's large demo walkthrough is a separate guided-sales layer and should not be read as production chrome. | **Slows the job** if it occupies multiple rows. |

## Where tournament pages and club pages differ today

| Part | Club pages today | Tournament pages today | Recommendation |
|---|---|---|---|
| Ground | One light `#F6F5F2` ground, white cards. | Dark by default; optional light mode uses a cool pale ground. | Warm paper family on all public pages. Use the event brand in safe roles on this light ground. |
| Bar | Club-owned 72px colour band, logo/initials, name/tagline, then a white tab row on a phone. | Compact event header and event tabs; platform navigation remains part of the shell. | Keep the event-specific header and tabs. Restyle their surface and type with the warm system; do not copy a 72px club bar. |
| Type | Barlow Condensed 700 and Inter by default; selected club font choices are a club-specific exception. No typewriter face for body. | More uppercase data-face labels and mono treatment; the schedule has 38 typewriter-face uses per the public-type audit. | Barlow Condensed 700 for headlines and Inter for reading; reserve data type for score/readout labels. |
| Colour roles | Saved club colour resolves to fill, on-fill text, readable ink, edge, and decorative accent; no tints. | Tournament theme colour uses a separate dark-ground recipe; a free event ignores stored custom branding. | Reuse the role logic on the light ground. Keep logo visibility gated by existing branding entitlements. |
| Footer | One club footer, absent parts omitted, with club contact/social/about doors and a quiet platform credit when applicable. | Platform credit/acquisition treatment; no shared event footer or host-club promotional card. | Add a compact host card and a small tournament footer. Club's regular contact/social footer should not be inherited wholesale. |
| Tab row | White phone row; club sections can be hidden/ordered from its editor. | Event tabs, with their own visibility and event-specific destinations. | Keep separate IA and rules; align appearance and spacing. |
| Cards | White, calm cards on a fixed light ground. | Cards adapt to the dark/light tournament theme; token names are remapped in the club frame. | White cards, near-black ink, visible edges; use spacing and grouping before decorative panels. |
| Spacing | Deliberate club page rhythm, common frame and title convention. | Tighter after earlier mobile-remediation work, but the live home still stacks repeated shell/data modules. | Share the rhythm and first-screen discipline. Audit duplicated modules instead of applying a blanket spacing value. |
| Titles | “Page · club”; a club home is the club name. | Event/tournament titles; live mobile shell may suppress repeated page titles. | Keep event titles and event-oriented route names. Do not rename pages to club titles. |
| Sponsors | Club's own list: home strip and About section; ended sponsors disappear. | No tournament sponsor capability. | Keep host-club sponsors distinct from tournament sponsors. A club sponsor is not automatically a tournament sponsor. |
| Phone bar | Removed from the club site; sign-in is in the club's own bar. | The shared platform phone bar remains. | Keep this deliberate structural exception. Share warm surfaces and keep only one global phone bar. |

The continuity target is **the same visual language and legible relationship**, not identical page chrome. The tournament has a live-score shell and a date-sensitive job; the club has a year-round identity bar and section editor. Copying the club bar into the event would duplicate identity, take vertical room, and make a standalone organizer look like a club by implication.

## The carve-out and the organizer's brand

The existing decisions pull in two directions. Club Tier Stage 4b-1 kept tournament pages out of the club frame and left their platform phone bar in place. The theming decision says organizer identity wins on tournament pages. Today that identity is expressed through a different colour recipe on a dark ground; free events deliberately get neither a host logo nor custom branding.

I recommend keeping the **structural carve-out** and retiring the **visual carve-out**:

- Keep the event header, event tabs, global phone bar, event-specific page titles, and game-day dock. They serve event jobs and have settled navigation rules.
- Move the public event pages to a warm light ground and the Barlow/Inter type system. A user coming from a club page then recognizes the same product.
- Let paid custom tournament branding or a club's saved colour populate the same safe roles used on a light surface: fill, text on fill, ink, edge, decoration. The organizer remains visible, without depending on arbitrary tinting or low-contrast accent text.
- If the event is standalone, use the organizer's saved colour/logo only where the paid branding entitlement allows it. If a free event has no host logo, show the event name and neutral olive action color; do not manufacture a host mark.
- Do not let a family member's personal theme override the organizer's public identity.

This costs the dramatic dark “venue” switch and the organizer's ability to choose dark mode. It keeps the actual brand signal—the saved name, eligible logo, and safe colour roles—and makes it work on a shared light surface. The captures do not show that dark is causing the current information overload; the duplicate data and many stacked sections do. So darkness is not a justified reason to keep the full visual carve-out. This recommendation would supersede the old dark-ground handoff, not the organizer-brand precedence or the event-navigation rulings.

### Whole-experience directions

| Direction | Idea | Keeps | Changes | Cost | Risk |
|---|---|---|---|---|---|
| **A — Warm event venue (recommended)** | One warm public design system; the tournament keeps its own event shell and its organizer's colour roles. | Event identity, organizer precedence, event tabs, phone/global bar, live ticker/dock, all family content, no-logo free-event rule. | Ground, typography, role mapping, home hierarchy, game-day duplication, mobile control grouping, collapsible long-form sections, host/sponsor placement. | Medium-to-large design and implementation pass across all public routes; needs contrast and narrow-width checking. | A light surface could feel less like entering a specific event. The logo, saved colour band, event title, and clear status preserve that identity. |
| **B — Club frame everywhere** | Tournament pages use the club's complete bar/footer and section-row pattern. | Warm ground, type, safe colour roles, host recognition, club sponsors where applicable. | The event header becomes a club bar; tournament tabs and footer inherit club frame behavior. Standalone organizers need a generic substitute. | Large frame rewrite and two organizational modes; event shell decisions need reopening. | Misrepresents a standalone organizer as a club; loses the direct date/status event header and spends more phone height. |

**Recommendation: Direction A.** It follows the warm public-face rule and club continuity without claiming every tournament is a club. It respects TH-1 by preserving the organizer's identity in accessible brand roles, and it preserves the event navigation whose purpose differs from the club nav. The actual fixes are information hierarchy, repetition, and control disclosure—not making every screen structurally identical.

### Content that goes

Nothing is proposed for permanent removal. The proposals move less-frequent information behind a tap and reduce repeated presentations while leaving each fact reachable.

| Content moved or reduced in the first view | Where it remains |
|---|---|
| Seeding explanation and “best offense / stingiest defense” summary on the phone playoff page | A “How seeding works” disclosure and the full bracket. |
| Full rules text and secondary team filters on phones | Tap-open rule sections and a filter sheet. |
| Repeated live matchup summaries | One ticker glance plus one fuller live-game/field card; do not show two compact summaries of the same game. |
| Long “what happens after you register” explanation | A short registration note with the full explanation still available beside the form. |

## Club advertising and sponsors

### Make the host club findable

| Option | Assessment |
|---|---|
| A band under the event header | Easy to notice, but it adds another fixed-looking identity band before the games and duplicates the event header. |
| Make the existing host name link louder in the header | One tap, but an event header is the family's event orientation; it is too easy to mistake the host crumb for event navigation. |
| **A host card near the end of the Overview, before sponsor rows/footer (recommendation)** | A clear “Run by [club]” message with a prominent “Visit [club]” action. The host is advertised after the family has reached useful game data, while remaining one tap away from the Overview. |

Show the card only when the host has a real public club destination. For a standalone organizer or a club without an open public page, omit the card and keep the organizer's name in the event identity. Never leave a dead “visit” door. The club's “Tournaments” tab remains the already-drawn 4f route back to the event; it is outside this review.

### Sponsors

| Option | Assessment |
|---|---|
| Reuse the club's sponsor list automatically | Not recommended. The club's list speaks for the year-round club; it does not prove those businesses sponsor this event. It would also make a tournament depend on a public club site. |
| **A tournament-owned sponsor list, shown at the foot of the Overview (recommendation)** | Correct attribution for a tournament, whether hosted by a club or standalone. Keep it small, equal-size, no tiers, and absent when empty. A club host may add the same business to both lists only by managing both records. |
| No sponsors on free events | Not recommended without a business reason. The event's supporters are public event information; do not make their visibility depend on the organizer's branding tier. |

The club sponsor section is a good presentation pattern, but its underlying data belongs to clubs. The tournament-owned list, public editor controls, upload validation, end dates, and event-home placement are **new work**. Recommend letting configured event sponsors appear on every tournament plan, including free events; this is an owner business call because there is no tournament sponsor entitlement today.

## Questions for the owner, ranked by design impact

1. **May tournament pages use the warm light ground while keeping organizer colour/logo as safe roles?** This supersedes the tournament dark/light venue treatment but preserves the organizer-brand ruling. It is the decision that changes every screen.
2. **Should tournament sponsors be a separate event-owned list and show on every plan, including free events?** This adds an editor/data capability and changes attribution.
3. **Approve the host-club card near the foot of Overview, only when a real public club page exists?** This answers the advertising ask without delaying game data.
4. **Should a pay link open a focused payment shell with no event navigation, ticker, or sales nudges?** The current rail has no task there; the local offset seems to address the logged overlap, but valid-token browser evidence is still needed.

The question “should the tournament wear the club frame or keep its own look?” is too broad. The evidence supports keeping the tournament's event shell and brand ownership while changing its ground, type, colour-role method, and information order. The club's full frame is not the continuity goal.

## Needs new work

- Tournament-owned sponsor records and editor: name, optional logo/link/end day; safe upload/read rules; an event home strip; hide ended sponsors; absent when empty. No tournament sponsor list exists today.
- A role-derivation path for custom tournament branding on a light ground, including standalone paid organizers; the existing public tournament theme resolver uses the dark-ground recipe and free tournaments suppress saved custom branding.
- Host-card eligibility based on an actual public club destination and an event that has an organization-host relationship. The current host name link can lead to the org page only when it is a real destination; the prominent Overview card is a new presentation.
- A phone filter sheet for existing schedule controls. This is a new presentation of the existing division, stage, search, and team filters; it needs no new schedule data field.
- A focused payment layout that suppresses the normal tournament navigation and game-day/growth chrome. The valid-token view was not available to verify whether part of this already exists in the current uncommitted working copy.
- Fixture coverage for a free standalone event with no logo, a paid standalone custom colour/logo, a long team name, a long schedule, a pale colour, and a low-contrast dark colour. The drawing includes these layout cases, clearly marked as test data.
- Any editor control to assign tournament sponsors or choose which club sponsors also sponsor an event. The recommendation does not silently reuse or copy the club's list.

## Appendix: evidence and engineer pointers

### Captures and limitations

Screens were saved to `.probe/public-tournament-review/` and are gitignored. Captured files include:

- `riverdale-minor-ball_summer-classic_390.png`, `_360.png`, and `_1440.png` — active game-day Overview.
- `riverdale-minor-ball_summer-classic_schedule_390.png`, `_360.png`, and `_1440.png` — schedule/unpublished mismatch.
- `riverdale-minor-ball_summer-classic_standings_390.png`, `_360.png`, and `_1440.png` — table/bracket/legend.
- `riverdale-minor-ball_summer-classic_teams_390.png`, `_360.png`, and `_1440.png` — division/team cards.
- `riverdale-minor-ball_summer-classic_news_390.png`, `_360.png`, and `_1440.png`; corresponding `rules`, `playoffs`, `results`, and `register` captures at the same widths.
- `riverdale-minor-ball_invitational_390.png` and `_1440.png` — pre-event home.
- `summer-classic_schedule_75bafae4-7e56-42ac-85da-8a0438b70553_390.png` and `_1440.png` — game detail.
- `team-profile_390_final.png` — team profile after it finished loading; `summer-classic_teams_0e363d21-d765-47d2-8b6d-bb4f44cd2dc8_390.png` and `_1440.png` are the earlier short loading-state captures.
- `riverdale-minor-ball_390.png` and `_1440.png` — club-site continuity comparison.

The active screenshot includes the demo-only guided tour. The profile resolved after a longer wait and exposed a record/schedule mismatch with the same team's home-page data. The payment route was exercised only with an invalid token, which correctly shows a refusal rather than payment content. No capture is claimed for a no-logo standalone organizer, custom organizer colours, or realistic long-list fixtures.

### Source and decision pointers

| Topic | Pointers |
|---|---|
| Public route inventory / event frame | `app/[orgSlug]/[tournamentSlug]/layout.tsx`; route folders `champions`, `news`, `pay/[token]`, `playoffs`, `register`, `results`, `rules`, `schedule`, `schedule/[gameId]`, `standings`, `teams`, `teams/[id]`. |
| Shared public components | `components/public/TournamentSideRail.tsx`, `TournamentTopTabs.tsx`, `ScoreTicker.tsx`, `MyTeamDock.tsx`, `TournamentHomeContent.tsx`, `ScheduleContent.tsx`, `StandingsContent.tsx`, `TeamsContent.tsx`, `NewsContent.tsx`, `RulesContent.tsx`, `RegisterContent.tsx`, `PayBlock.tsx`, `TeamPayContent.tsx`, `PlayoffPicture.tsx`, `ChampionsRecap.tsx`, and Follow components. |
| Public tournament theming | `lib/public-tournament-theme.ts`, `lib/tournament-branding.ts`, `app/globals.css`, `components/public/TournamentSideRail.module.css`, `TournamentTopTabs.module.css`, and page-specific public styles. |
| Club frame and colour roles | `components/public/ClubFrame.tsx`, `ClubBar.tsx`, `ClubFooter.tsx`, `ClubSponsors.tsx`, `OrgSectionTabs.tsx`, their CSS modules, and `lib/club-colour-roles.ts`. |
| Club decisions | `docs/projects/active/CLUB_TIER_PRODUCTION_READINESS_PLAN.md` Stage 4; `CLUB_TIER_STAGE4_DRAWINGS.html`; `CLUB_TIER_STAGE4B1_BUILD_PROMPT.md`; `CLUB_TIER_STAGE4D_COPY.md`; `CLUB_TIER_STAGE4F_DRAWINGS.html`; `CLUB_TIER_STAGE4F_COPY.md`; `PUBLIC_SITE_BUILDER_PLAN.md` and `PUBLIC_SITE_BUILDER_DRAWINGS.html`. |
| Relevant standing decisions | `memory/design_decisions.md`: 2026-06-01 public mobile remediation and standings-table ruling; 2026-07-14 G3/G4/G5; 2026-07-20 Tournament Nav Unification; 2026-07-21 TH-1; 2026-07-23 The Flip and its public-tournament amendment. |
| Business and visual standards | `docs/agents/strategy/BUSINESS_DECISIONS.md`; `lib/tournament-branding.ts`; `docs/agents/design/TABLE_AND_LIST_STANDARD.md`; `NAV_STANDARD.md`; `LAYOUT_INVARIANTS_REPORT.md`; `docs/agents/brand/VISUAL_IDENTITY.md`; `BRAND_FOUNDATIONS.md`. |
| Source of known payment finding | `docs/projects/active/PUBLIC_TOURNAMENT_SITE_REVIEW_PLAN.md`; current working-copy offset in `components/public/TeamPayContent.tsx`; shared payment structure in `components/public/PayBlock.tsx`. |

