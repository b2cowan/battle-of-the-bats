# Product Ideas Backlog

A standing, curated list of product ideas to pick from when there's downtime. This is a **living document** — it never archives. When an idea graduates to real work, it gets a proper `_PLAN.md` + `_PM_BRIEF.md` pair in `docs/projects/active/` and its status here changes to **Planned** with a link.

- **Provenance:** 2026-08-02 wow-factor brainstorm (six surface surveys + six creative lenses, 54 raw ideas, deduped below).
- **Scope at time of capture:** coaches portal, tournament admin, main app pages (Home/Scores/Chat/Account), login/signup, public tournament pages. Club-admin and house-league-admin surfaces deliberately out of scope for now.
- **Ratings:** Wow is 1–5 (5 = someone physically shows their phone to the person beside them). Effort is S/M/L at concept level — real sizing happens at planning time.
- **Statuses:** `New` → `Shortlisted` (owner flagged interest) → `Planned` (has a plan doc) → `Built` / `Passed` (decided against — keep the entry, note why).

## Owner shortlist (2026-08-02)

Flagged for detailed exploration, in the owner's order:

1. The Big Board
2. The Bracket Draws Itself
3. The Draft Brief
4. Ask the Front Office
5. The Motion Pack
6. Play With a Live One First
7. Watch Your Event Come Alive While You Type
8. Meet Your Team

### Grounding notes (2026-08-02, code-verified)

One-line reality check per shortlisted idea — full detail lives in the conversation that produced this; each graduates to a proper plan before build.

- **The Big Board** — public live-score data, the 30s live-refresh pattern, a broadcast-style ticker precedent, and the admin ops stats all exist. Slim v1 (big-font auto-cycling board + existing announcement banner as the delay notice) is **S/M**; "biggest moments" detector and a no-login staff ops toggle are the L-makers — cut both to fast-follows. Open: free vs plan-gated; how staff unlock ops mode on a shared tablet.
- **The Bracket Draws Itself** — **~80% already built**: the public bracket already has a draw-itself reveal animation, instant live score updates, and tier handling. Slim v1 = **S**: make winner-advancement instant (today it rides the 30s refresh) + a pulse on the live matchup. Open: when organizers generate the bracket relative to pool play; fate of the separate static "Playoff Picture" page.
- **The Draft Brief** — per-evaluator scores AND notes are already stored separately; the live tryout board already polls every 6s and ships an analogous evaluator-bias flag. Catches: "scoring closes" isn't a real event yet, and AI prose = the platform's **first AI dependency + minors'-PII egress ruling**. Slim v1 = split-opinion flag + template-built (non-AI) synthesis paragraph — most of the promise, zero new dependency.
- **Ask the Front Office** — zero AI in the codebase today; the insights engine ("assemble, never generate", capability-filtered per assistant) is the exact ancestor. Some asked-for answers need data shapes that don't exist yet (per-position recency beyond pitchers; family-grouped dues). Slim v1 = **"Quick Asks"**: ~6–8 tappable pre-written questions, each backed by real math, answer + receipts. Open free-text goes L→XL and forces the AI decision.
- **The Motion Pack** — a production odometer/flip primitive already exists on several score surfaces, reduced-motion is globally handled, and standings already detect who moved up/down. New: the color wash, the row slide (risky inside sticky-column tables), per-card change detection on the admin board, haptics (Android-only). Catch: "team color" on public surfaces is a generated tint from the name, not a set color. Slim v1 = color wash on the already-animated surfaces + admin card glow. **M**.
- **Play With a Live One First** — public pages are already anonymous with live refresh, and a seeded demo tournament already exists as a dev tool — but it's a frozen snapshot. New: an always-on prod demo org, a scheduled "tick + reset" driver, and a **client-side-only** draggable bracket (never real writes — concurrent visitors would clobber each other). Cut the compressed pre-event→live→finished time flip (credibility risk). **L** even slim, but the spine exists.
- **Watch Your Event Come Alive While You Type** — creation is a one-shot modal wizard; colors/branding live on a separate post-creation page and custom colors are Tournament-Plus-gated, so the "colors repaint" beat is a plan-gating decision, not a freebie. The real public hero can't be reused live (server-rendered), so the preview is a hand-built mimic → drift risk to manage. Slim v1 = desktop-only phone frame with name, date range, live countdown in the org's current theme. **M** (L with a color step).
- **Meet Your Team** — most shovel-ready of the eight: teams already carry a real coach-set color, record + next-game are already computed at team entry, and the share-a-PNG mechanism (with the kid-safe first-name+jersey rule) has shipped twice. The invite-accept seam is clean and empty today. Catch: a brand-new head coach's team is empty and that moment is already owned by the cold-start welcome card — v1 should fire on assistant-invite accept only. **M**.

---

## Signature moments — season close, champions, keepsakes

- **Season Wrapped, the Story** (Wow 5 · L · New) — A closed season opens as a full-screen, swipeable five-or-six-slide sequence — record, attendance milestone, most-worked focus area, an honest standout moment — each slide animating its one number into place, ending on a shareable image. Connected parents get the same story format for their own kid's recap. The platform's Spotify-Wrapped moment; nothing in it is a ranking or a grade.
- **The Season Reel / Champion Reel** (Wow 5 · L · New) — At tournament or season close, the platform auto-assembles a 30–60 second vertical video from data it already has (score progression, standout stat, photo timeline, final result) in the org's colors, sized for Instagram/TikTok. One tap, no editing skill. Every share is branded marketing.
- **Trading Cards** (Wow 5 · M · New) — Every rostered player gets an auto-generated trading card: jersey-number front in team colors, season stat line + one honest standout fact on the back. One tap generates the team set; parents can share their own kid's card. Cheapest viral moment in the whole list.
- **The Yearbook Page** (Wow 4 · M · New) — At season close, teammates' families and staff each get a one-time chance to leave a short signed note per player. Notes collect into a yearbook-style page per kid, coach-previewed before release (same preview pattern the family recap already uses), unlocked with the closing recap.
- **Memory Lane** (Wow 4 · M · New) — One-tap, caption-optional photo drops by staff (and, if the coach opts in, parents) build a season-long visual timeline beside the record book. Becomes the visual spine of Season Wrapped, and the raw material for cards/reels/books. Closes the read-only family gap as a side effect.
- **Bound & Mailed** (Wow 5 · L · New) — From a closed season's Wrapped card, order a real printed photo book (or cheaper poster) auto-laid-out from the season's data, previewed live in the browser, delivered to the family's door. New emotionally-anchored revenue line that doesn't compete with the subscription.
- **The Career Book** (Wow 5 · L · New) — Once a player has multiple seasons under one org, their profile grows a "Career" tab stringing every season together; when they age out, a one-time "Career Wrapped" retrospective spans every year they played. The strongest anti-churn feature a family can experience.
- **The Locker Room Poster** (Wow 3 · S · New) — One-tap printable commemorative team poster at season close: photo strip, final record, honestly-earned team facts (practices run, most-used drill, longest attendance streak). Zero writing required from the coach.
- **Alumni Wall** (Wow 3 · M · New) — For orgs with the public-site module: a standing public hall-of-fame page of aged-out rep players (photo, years, highlights), shown only with family consent. Turns private roster history into club brand equity for recruiting season.
- **On This Day** (Wow 4 · S · New) — A year after a sealed tournament/season moment, a gentle push or email resurfaces it ("One year ago today, the Lions beat the Hawks 7–4 in the semifinal"), opening the frozen record exactly as it was. Respects existing notification preferences.

## Live game day — fans & parents

- **The Bracket Draws Itself** (Wow 5 · L · **Shortlisted**) — The playoff bracket lives on the public page all day, filling in seed by seed as pool results land, a soft pulse on whichever matchup is live. When the last pool game ends, viewers watch the final line draw itself and the last team slide into place — a broadcast-style reveal instead of a silent page-state flip. During playoffs, winners' lines visibly travel to the next round in real time.
- **Crunch Time** (Wow 5 · L · New) — When a live game reaches a genuinely tense moment (close score, late stage — defined sport-neutrally), the game page itself changes: subtle color pulse, a "This Is It" banner, and a window-limited "cheer" button feeding a shared energy meter everyone on the page watches rise together. Earned by real drama, never manufactured.
- **Instant Game Story** (Wow 4 · M · New) — Every final becomes a one-line story ("Final: Lions 7, Hawks 4 — Lions led wire-to-wire after a 3-run 2nd"), automatically. Dramatic finishes (walk-off, blown lead, comeback) earn a bold badge and their own distinct push to followers.
- **This Morning's Storylines** (Wow 4 · M · New) — Each morning of a live event, the tournament home page opens with a short, warmly-written paragraph built from real results ("Riverside hasn't allowed a run since Friday…"), refreshed as games finish, with a native share button. Reads like the local paper covered the tournament.
- **The Schedule Tells the Truth** (Wow 3 · M · New) — When a field runs long, public "Up Next" times quietly shift to the real predicted start (the schedule-health engine already computes this for admins). One admin button texts the corrected time to the next teams.
- **Command Your Day** (Wow 3 · M · New) — Multi-kid families get one merged live rundown ("Field 3 now (Emma) — Field 1 in 40 min (Jake)") with walking-buffer math that recalculates in real time when a game runs long.
- **Listen Along** (Wow 3 · S · New) — A live game page left open in a tab reads like a radio transcript, updating line by line ("Top 6, 2 outs, Lions lead 4-3") with an optional soft chime on score changes.
- **Kickoff Clock** (Wow 2 · S · New) — Followers get one precise nudge — "Lions take the field in 8 minutes" — with one tap landing them on the live page at first pitch.
- **The Star That Proves Itself** (Wow 3 · S · New) — First-ever Follow tap: the team dock slides up in the same motion already carrying a live score or countdown — immediate visible proof the follow is working, no toast.

## Visual craft & motion

- **The Motion Pack** (Wow 4 · M · **Shortlisted**) — Three coordinated live-data behaviors, identical everywhere a score can appear: (1) score digits physically flip like stadium tiles with a brief color wash in the scoring team's colors + a light haptic tap; (2) standings rows visibly slide past each other when ranks change, lifting with a soft shadow and settling with a small bounce; (3) on the admin game-day board, the specific card whose score just changed gets a quiet border glow that fades in about a second — a peripheral-vision cue, no toast.
- **The Fairness Gauge** (Wow 3 · S · New) — Overview's playing-time and attendance tiles replace their one-word verdicts with thin per-player horizontal gauges that fill in on load; outliers get a slow, quiet pulse. The whole team's shape at a glance, no extra click.
- **Watch the Rotation** (Wow 4 · M · New) — Any practice-plan station block gets a "preview" tap that plays a short looping diagram — player-group dots moving between labelled stations on a field outline, in the plan's actual order and timing.
- **This Is What It'll Look Like** (Wow 3 · M · New) — Genuinely empty Overview/Scores tiles briefly render a clearly-labelled example version in the team's own colors and sport before fading to the true empty state. The promise shown, not described.
- **The Front Door, Warming Up** (Wow 2 · S · New) — The /start role-picker cards arrive with a soft staggered entrance over cream paper with faint grain and a light-shift on cursor move / phone tilt. The first half-second feels considered.

## Coach intelligence — the portal that thinks

- **The Monday Morning Brief** (Wow 4 · M · New) — A coach returning after days away gets one dismissible card ahead of the six tiles: a two-or-three-sentence written brief of what changed ("3 dues payments landed, Emma's medical form is still outstanding, Tuesday attendance hit a season low"), each clause tapping through to the record behind it. Quiet weeks produce a short brief or none.
- **The Lineup Whisperer** (Wow 4 · M · New) — While dragging a player into a batting-order or fielding slot, an inline chip speaks up before the click lands ("Jordan threw 62 pitches Tuesday — recommend Thursday") and ranks the best rested, fairness-balanced alternatives at the top of the picker. Advisory only; one tap accepts or overrides.
- **Team Readiness Score** (Wow 3 · S · New) — A tile that merges everything that could silently block game day — unsigned waivers, missing medical forms, no guardian email, unpaid roster spot — into one score with a one-line reason it isn't 100, sharpening as a real deadline nears.
- **Collection Forecast** (Wow 3 · S · New) — The Dues tile predicts ("At this pace you'll collect 100% by October 3rd — 12 days late"), names the families driving the shortfall, and offers a ready-drafted personalized reminder the coach reads and approves before anything sends.
- **The Draft Brief** (Wow 5 · L · **Shortlisted**) — During live tryout scoring, far-apart evaluator scores flag in the moment ("Split opinion — worth a second look"). When scoring closes, every prospect gets a short plain-English paragraph synthesized from all evaluators' scores and notes, so cut-day opens with a defensible case per player instead of a raw spreadsheet.
- **Ask the Front Office** (Wow 5 · L · **Planned** → `docs/projects/active/ASK_FRONT_OFFICE_PLAN.md`) — A single question box at the top of the portal: "Who hasn't played catcher in three weeks?" "How much has the Nguyen family paid?" Answered only from that team's own recorded data, with the exact records used shown underneath as proof. Never a guess, never outside data.
- **Playing Time in Context** (Wow 3 · M · New) — Owner-sourced 2026-08-04. Playing-time metrics filtered to the group a coach actually rotates between, not the whole roster: "of our top 3 pitchers, who has pitched the most in the last week?" — pick a position or a hand-picked set of players plus a time window, get the ranked minutes/innings within it. Descriptive by design (per the 2026-08-04 vocabulary ruling: measurement-in-context, never a fairness verdict). Natural fit as Ask the Front Office quick-asks or a filter bar on the playing-time report.

## Tournament director command center

- **Storm Mode** (Wow 5 · L · New) — One button: "Declare a Delay." Pick the kind and affected games (pre-selected from the live board); every affected game tags "Delayed" everywhere, the schedule drops into a reflow view surfacing every new conflict with accept/adjust per game, a plain-English mass message is pre-drafted, **and every public page for the event grows/drops the same truth banner automatically while followers get a push.** Three taps instead of forty-five frantic minutes. (Absorbs "Live Status Bridge" — the public auto-sync half is non-negotiable to the concept.)
- **The Big Board** (Wow 5 · L · **Shortlisted**) — One tap casts the tournament to any TV/tablet propped at the gate, concessions, or coaches' tent: a slow, auto-rotating, broadcast-style board of field-by-field live scores, up-next call times, today's biggest moments, and any active delay notice. No login on the display, readable from thirty feet, updating itself. A toggle flips the same screen into an internal ops board (schedule health, games missing scores) for staff rooms.
- **Schedule Weather Radar** (Wow 4 · L · New) — While building a schedule, a forward-looking layer flags venue-specific risk from that venue's own history ("Field 3 historically runs 12+ minutes over — your 2:00 game will likely bump"), directly on the timeline as games are dragged into place.
- **Official/Volunteer No-Show Radar** (Wow 4 · M · New) — 15 minutes before game time, any assigned umpire/scorekeeper who hasn't checked in turns amber, then red at 5 — with one tap to blast the backup pool and auto-swap the assignment the instant someone accepts.
- **"What Changed Today" Auto-Recap** (Wow 4 · S · New) — One tap: an auto-drafted plain-English digest of everything that moved today (reschedules, forfeits, field swaps, delays declared/lifted), ready to post as one clean announcement or read aloud at a coaches' meeting.
- **Smart-Audience & Triggered Announcements** (Wow 3 · M · New) — The composer's audience list grows live condition-based groups ("everyone with a game in the next hour," "teams still on Field 3"), plus schedule-for-later and fire-on-condition options.
- **Ripple Preview for Field & Time Swaps** (Wow 3 · S · New) — The existing drag-conflict warning grows a "who's affected" panel (teams + following-family counts) and a "Notify only these families" button, so the fix and the heads-up happen in one motion.
- **Guided Forfeit & Dispute Resolution** (Wow 3 · S · New) — Declaring a forfeit opens a short guided flow with a locked, pre-approved neutral message auto-filled for both coaches, while standings and bracket update in the same motion. Protects everyone from off-the-cuff wording on a high-emotion day.

## The first five minutes — login, signup, onboarding

- **Play With a Live One First** (Wow 5 · L · **split, both Planned**) — coach track expanded + **Planned** as the Season-Phase Coach Sandbox (→ `docs/projects/archive/COACH_SANDBOX_SEASON_PHASES_PLAN.md`); organizer track **Planned** as the Tournament Admin Sandbox (→ `docs/projects/archive/TOURNAMENT_ADMIN_SANDBOX_PLAN.md`). Original pitch: From the /start picker: "See it running live" — no signup, no email. One tap into a real ticking demo tournament: live scores updating, a bracket you can drag a game inside, a schedule-health score that visibly reacts when you create a conflict, a fan page flipping pre-event → live → finished. Banner: "live sandbox — nothing here is saved," with a CTA to start your own.
- **Watch Your Event Come Alive While You Type** (Wow 5 · M-slim · **Planned** → `docs/projects/archive/TOURNAMENT_CREATION_LIVE_PREVIEW_PLAN.md`) — The first tournament-creation wizard gains a live phone-frame beside the form that updates in real time as the organizer types: event name lands in the hero, colors repaint the page, dates populate a countdown. By "Create," they've watched their actual public page assemble itself.
- **Meet Your Team** (Wow 4 · M · **Shortlisted**) — When an invited assistant accepts, or a new coach's first signup completes, one animated one-time reveal precedes the dashboard: team colors and name fill the frame, record and next-game countdown drop in, player initials tile in like a lineup card. Screenshot-shaped by design.
- **Peek Before You Sign In** (Wow 3 · S · New) — Invite links open with a warm preview card — who invited you, to what, one concrete real detail ("next game Saturday," "3 teammates already here") — before any form appears.
- **You've Already Been Found** (Wow 3 · S · New) — While typing an email into org signup, a matching existing invite/account surfaces inline mid-type ("Looks like you were invited to coach the Lions — join instead?") with a one-tap swap. No submit-then-error.
- **You're Live** (Wow 3 · S · New) — Flipping a first tournament from Draft to Active becomes a moment: the status pill turns live-green, and a ready-to-copy public link + QR code appear framed as "text this to your coaches right now."
- **The First Question Isn't a Form** (Wow 3 · M · New) — Three quick ungraded taps after choosing "Run a tournament" (sport, rough team count, how they run things today) and the next screen already has divisions roughed in, a dues structure suggested, and the checklist reordered around what they said.

## Main app & cross-workspace

- **Your Morning, Across Every Team** (Wow 3 · M · New) — Multi-workspace users get one ranked "3 things need you today" card on Home spanning every hat they wear, instead of a row of workspace tiles to individually scan.
- **Welcome Back, Here's What Changed** (Wow 3 · M · New) — The first screen after a returning sign-in is a single warm summary card ("Since you were last here: 2 new messages, dues due Friday, next game in 3 days"), once per session, each line tapping straight through.

## Moved from TODO.md on 2026-11-17 (One Board Session 2)

Each was an open TODO line with no plan and no owner ruling to build it. Status `New` unless the line says otherwise.

- **A reader-only Accounting seat for a board member** — from the bank check evaluation (A12, ruled "route to /plan" 2026-11-08): today anyone who can open Accounting can also write; plan whether a view-only seat exists (see [the plan](docs/projects/active/BANK_CHECK_NOVICE_UX_PLAN.md) §3).
- 📱 The lineup builder's three form drawers do not hold keyboard focus — Setup, Templates and Call up declare themselves modal but…
- 📱 Owner calls carried out of "Coaching from a phone" (2026-09-25) — whether Generate wears the lime · the Chat tab on a plan…
- 📚 The standard budget vocabulary needs one review — two seed generations were stacked, never merged (owner asked during QA §158…
- 🔔 Three open calls from the Insights portal (mockups published 2026-08-19, NO decisions taken, nothing built)
- 📧 A free coach's "Email families" ignores a family's unsubscribe — the paid coach's identical announcement honours it, so…
- 💡 Product Ideas Backlog (2026-08-02) — standing curated wow-factor idea list (54 raw → deduped, themed, wow/effort-rated) to…
- 🧹 Collapse the `sponsorship` budget-line kind into `funding` (DEFERRED BY DECISION 2026-08-16 — do NOT do this in passing)
- Tech debt: prod build on webpack → revisit Turbopack — prod build is pinned to `next build --webpack` (+`NODE_OPTIONS` heap in…
- Player-PII retention/purge policy — (spun out of Player Development D3, 2026-07-17) — no purge job exists for declined/withdrawn…
- Platform privacy-page gap — (flagged from Player Development D2, 2026-07-17) — no in-platform org privacy page exists (only a…
- In-Org Coach-to-Coach Chat — (Coach Chat · Project 2; owner restructure 2026-06-19) — NOT STARTED, PLANNED; paid coaches within…
- Cross-Org Coach Messaging — (Coach Chat · Project 3; owner request 2026-06-19; scoped + adversarially verified same day) — NOT…
- Plan / Tier Trial — (Proposed/deferred, NOT scheduled; strategy 2026-06-29) — operator-granted, timed, auto-reverting WHOLE-PLAN…
- Public IA — "Season"/edition model rethink — (raised 2026-06-03; picker REMOVED for now, needs spec before re-adding) — the…
- Mobile app strategy — PM brief for a focused FieldLogicHQ companion app versus mobile web, including level of effort, release…
- 🗂 Sheet frame follow-ups — carried from the project’s close (owner QA §277 ✅ 2026-10-07; every phone sheet in the portal now…
- 🔔 The Install banner over the remaining low layers — found 2026-10-06 fixing the portals' phone sheets (`2ea62042`: the "Install…
- 🔔 The admin's Notifications page gets the coach page's one row (the 09-25 "One Row for Notifications" ruling) — the settings…
- Schedule · the day list on a tablet behaves like a dialog — found 2026-10-06 in Sheet Frame step 4: a month cell's "+N more"…
- 🏆 Tournament admin redesign — follow-ups (gathered at the project's close-out 2026-10-13; the project itself is in ✅ Completed…
- 🔘 Switched-off buttons look live, product-wide — the global `.btn` has no switched-off look in any portal, so a disabled button…
- 💰 Coach money — a family with dues payments and NO schedule is missing from the Statement's Player dues actual (found by…
- 💳 Coach Money — Player dues opens into the families (D1–D7 settled · D6 SHIPPED + walked 28/28 · ❌ STEP 2 DELETED 09-07, D8 spun…
- 📚 Platform budget-item library review — its own session (owner-ruled 2026-09-02, Q7 of the budget-tab deep dive)
- 🖨️ One small tidy-up left in the rendered document check (QA §107) — the gate matches three of the product’s own phrases by…
- Pre-sales walkthrough layer — APPROVED 2026-08-19; P1 (tournament) + P2 (present mode + PDF) + P3 (coach) built on `dev`, owner…
- 💬 Chat Consistency — one WhatsApp-like chat on every door: home, the coaches portal (paid and free), the tournament admin (owner…
- Multi-org creation for existing users — Logged-in users cannot currently self-serve a second organization; `/auth/signup` creates…
- Tournament owner/admin mobile implementation — Mobile-first owner/admin improvements for base Tournament, starting with shared…
- Future platform-admin Plans & Pricing workspace follow-up — Consider folding Feature Matrix editing/publishing deeper into the…
- QA Infrastructure — Design and build a layered automated test suite (unit, integration, E2E smoke) with a test catalog, plan-gate…
- Investigate chart libraries — Evaluate recharts, chart.js, or @nivo for use in budget vs. actual and dashboard screens; assess…
- Per-user light/dark theme preference — Allow each user to toggle light/dark theme from their own settings screen (org admins in…
- Family season-end recap card — format, export and placement need a fresh look (owner, on the Development lifecycle §193 walk…
- 🖨️ Two printable schedules a family could put on a fridge — coach team-season + house-league season (decided OWED in the PDF…
- 📌 Sticky column headings on the By-installment grid (G4 of "Set once, chase weekly", deferred by the owner at ruling time…
- F4 — Trial checkpoint emails (League + Club) — League orgs on a 30-day trial receive setup check-in emails at day 7, day 21, and…
- House League — Coach Draft Room — Shareable per-team link (no login required) that lets coaches participate in the draft live.…
- Calendar Sync for Team Schedules — Allow parents/coaches to export a team's game schedule as an `.ics` file or subscribe via a…
- Bulk Operations for Admins — Bulk-change registration statuses, bulk-assign teams, bulk-edit schedule slots. High value for orgs…
- Tournament setup templates — Post-clone enhancement for orgs that run several similar tournaments and want reusable setup…
- Tournament staff role presets — Later enhancement for Plus orgs if real usage shows registrar, scheduler, communications, and…
- 🔎 Address search box (type, pick, the fields fill in) — research later (owner 2026-11-03, left out of GST/HST Stage 1); first home = family sign-up, then Billing details + venue addresses; needs a Google Cloud key (owner step) and a privacy-policy line (GST/HST Stage 6); see docs/projects/active/GST_HST_STAGE1_BUILD_PROMPT.md Progress block
- Custom domain investigation — Research feasibility and effort of allowing orgs to point a custom domain (e.g. miltonbats.com) to…
- Public Site Offering Evaluation — After the first external org enables `module_public_site`, review the offering across three…

## Moved from TODO.md on 2026-11-17 (owner, One Board Session 2): plans not put on the board

The owner agreed these go to the backlog rather than the board. Each has a plan file; it graduates by going on the board.

- **📋📱 Practice plans on a phone** · [COACH_PRACTICE_PLANS_PHONE_PLAN.md](docs/projects/active/COACH_PRACTICE_PLANS_PHONE_PLAN.md)
- **🏷 Tagging across the coaches portal** · [COACH_TAGGING_PLAN.md](docs/projects/active/COACH_TAGGING_PLAN.md)
- **Codebase Cleanup Execution** · [CODEBASE_CLEANUP_PLAN.md](docs/projects/active/CODEBASE_CLEANUP_PLAN.md)
- **Coach Chat program — owner GREENLIT 2026-07-29** · [PROGRAM_COACH_CHAT.md](docs/projects/active/PROGRAM_COACH_CHAT.md)
- **🎨 Table standard — the three things §149 deliberately did not do** · [APP_WIDE_TABLE_CONSISTENCY_PLAN.md](docs/projects/active/APP_WIDE_TABLE_CONSISTENCY_PLAN.md)
- **📥 Coach Budget Import** · [COACH_BUDGET_IMPORT_VOCABULARY_PLAN.md](docs/projects/active/COACH_BUDGET_IMPORT_VOCABULARY_PLAN.md)
- **Dependency Update Process** · [DEPENDENCY_UPDATE_PROCESS_PLAN.md](docs/projects/active/DEPENDENCY_UPDATE_PROCESS_PLAN.md)
- **The Flip — role⇄public navigation** · [PROGRAM_PLATFORM_SURFACES.md](docs/projects/active/PROGRAM_PLATFORM_SURFACES.md)

## From the on-sale pages audience review (2026-11-18): needs product work, so not in that build

Found while judging the public pages by audience for the Club release (`docs/projects/active/CLUB_ON_SALE_PAGES_PLAN.md`,
section "Audience review, 2026-11-18"). Each is something a marketing page wanted to say and the product cannot yet back.
Status `New` for all.

- **A house league or club demo.** League Plus and Club are the only plans a buyer cannot walk before adding a payment
  method. Ruled "not for launch" on 2026-11-18, and the launch definition (2026-11-17) puts the demo after it. The
  release ships pictures of real screens instead (W67). A demo would replace those pictures as the proof.
- **Bring an existing house league season in from a spreadsheet.** No import exists on the club or house league side
  (tournament teams, tournament schedules and a coach's roster can be imported). The pages say so plainly ("the easiest
  time to switch is your next registration"). An import of registrations and teams would let a league switch mid-season.
- **A demo link that opens on a chosen screen.** The demo doors take no destination by design, so a page cannot send a
  treasurer straight to a coach's budget or a registrar to the registrations list. Wanted for "see this screen live" links.
- **Change a club's owner without writing to us.** Today only our staff can move ownership, so the board's "what happens
  when the president changes?" is answered with an email address. A hand-over the current owner starts would make it a
  product answer.
- **One download of everything a club holds.** Exports are per list. The pages say "download your lists, or ask us for a
  full copy". Already on the legal backlog as L10 (`docs/agents/legal/`); listed here so the marketing reason is recorded.
- **A page a president can print for a board meeting.** Price for the year with tax, what is included, the trial, the
  data promises. Belongs with the board pack project's public version rather than the marketing pages; the on-sale pages
  only link to /pricing for now.
- Related, already above: "F4 — Trial checkpoint emails (League + Club)". The new "How the trial works" section promises
  one email before a trial ends; check-in emails during the trial would strengthen it.
- **Event settings Save: all or nothing.** One Save on a tournament's settings page sends three writes together (name and dates, scoring, default game length). When the game length is refused by the game-order rule, the other two have already been saved, so the page shows a refusal beside changes that landed. Owner ruled 2026-11-19 (Stage 9 walk call C3) to make it all-or-nothing as its own item.
- **Move a League Plus organization to Club or Club · Association.** Today League Plus has no plan moves in either direction (Tournament Plus and Club do), so the pricing FAQ says "League Plus can't be moved to another plan yet." A league that adds rep teams would reasonably expect to move up to Club on its existing subscription, and the Club page says Club "combines everything in League Plus". Owner ruled 2026-11-20 (on-sale pages S3 walk call C1): not urgent, do it after the club release; nobody holds League Plus at launch. When built, drop the FAQ's closing sentence and the matching line on the For Leagues page, and re-run `/legal` and `/accounting` (it changes what is charged and prorated).
- **"Make this parent the coach" on the draft board.** A family that answers the club's "Can a parent help?" with Coach is only a note on the child's card today: the admin locks the child to a team and types the parent's name and email into the team's coaches by hand. One action from the child's answer (lock the child, add the guardian as the team's coach) would close it. Seen while building the Milton demo's house-league walk, 2026-11-21 (MILTON_DEMO_WORLD_PLAN.md §9).
