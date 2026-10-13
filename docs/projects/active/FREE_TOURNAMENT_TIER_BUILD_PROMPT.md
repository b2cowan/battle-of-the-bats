# The free tournament tier — build prompt (session 3: build the invite-only free event)

> Paste into a fresh session on `dev`. Written 2026-10-12, after the owner ruled the drawings. **Do not start until the
> tournament admin redesign has closed** (precondition 1): this build changes locks and areas on the same screens.
>
> **Where it comes from.** The owner asked (2026-10-10) to review what the free Tournament plan shows, locks and hides,
> expecting free to serve small events "including the coaches with coach portals" with "no public or internal
> registration management, no payment tracking, no staff kits". Session 1 reviewed and the owner ruled R1–R10 the same
> day (2026-10-12; logged by `/strategy` in `BUSINESS_DECISIONS.md` "The free Tournament plan is the INVITE-ONLY
> event"); session 2 drew it and the owner ruled the twelve drawing asks: *"I agree with your recommendations"* (M1–M12).
>
> **The spec is the hub's Mockups tab:** https://claude.ai/artifact/VEXd9cimTQaSN9jmXfK6hU (v5 or later; source
> `docs/projects/active/FREE_TOURNAMENT_TIER_REVIEW_HUB.html`, the tab spliced from `.probe/ftr-mk/`). Its fourteen
> drawings are the visual spec, and every NEW / RESTYLED / UNCHANGED / GONE tag's note says what changes and why. Plan
> of record: `FREE_TOURNAMENT_TIER_REVIEW_PLAN.md` §6 (R1–R10, the area table) and §11 (the drawings, M1–M12, and the
> facts verified in code). PM brief: `FREE_TOURNAMENT_TIER_REVIEW_PM_BRIEF.md`.

## The rulings, in one place

**R1–R10 (packaging, 2026-10-12):** free = the invite-only event (the host adds the teams; the coach's email is the
invitation; the coach claims the team into their Coaches Portal). **Hidden on free:** public registration (form, page,
"Registration open"), the review queue, the waitlist and Select many's registration actions, the Registration questions
card, Fees & payments and the Payment column and Mark paid, payment tools, check-in and the gate job, **the Staff kit and
every volunteer job**, **Tournament Chat** (nav entry, phone tab, the board's coaches card). **Lock line (the one shape,
opening the Tournament Plus panel):** targeting and fan push, the Teams export, imports, the generators, the rain delay,
the publish email, Summary (no nav row; one line on the finished board), Reuse, sealed archives, advanced branding (one
line), more events at once, PDF exports. **Included:** Roster requirements, Add team / Add my team / pools, announcements
to every team (the limit shown before Send), Coach emails reduced to what applies, the public site with live scores,
following and the app. **A Premium coach's event follows free + PDFs (R1)** and carries the free Powered-by badge and
banner (R6). **Founding Season (R2):** on 2027-10-01 a non-paying organization keeps everything; on an open event public
registration closes, teams in stay, recorded payments stay readable not editable, Plus tools lock; one still on free
sees its locks say Tournament Plus is free for it through September 30, 2027 (R10). **Events created before the build
keep today's tools until they finish (R8).** Any style, no size cap; one event at a time; 3 staff seats (unchanged).

**M1–M12 (the drawings, 2026-10-12, all as recommended):**
- **M1** Select many on free: only on a division with pools, offering only Move to pool. No bulk remove.
- **M2** Teams Export: free = ONE locked row "Export the team list"; a coach's event = PDF report open + one locked row
  "Excel and CSV".
- **M3** Field scores (the scorekeeper screen) stays open to the host and staff seats; only the volunteer job goes;
  Results stays. The host is never shown "Submit for review" when the score saves final.
- **M4** An event made before the build shows nothing new; the next New tournament window's reuse step says one
  sentence about how teams join on free.
- **M5** Coach emails on free: one switch (Game-day reminder, no master switch) + two lock lines (the publish email,
  the final results email).
- **M6** The phone bar on a live free event: Results · Dashboard · Schedule · Messages · More. Draft bar unchanged.
- **M7** Teams on free: no At a glance panel; a team with no coach email says "No email" in its row; no band on a
  division without pools.
- **M8** "Add team" as the window's title and button; "Added" not "Registered"; "Resend the invitation"; no status chip;
  the invitation box ticked whenever there is an email.
- **M9** The Founding Season line: a quiet second line in the lock's own grey, "Free for you through September 30,
  2027"; said once at the foot of a Tools menu.
- **M10** On 2027-10-01 a team still waiting stays listed and can be accepted or declined; nothing new comes in. Chat,
  check-in and volunteers follow the free rules from that day.
- **M11** The composer says the limit always, and says before Send when a send would break it.
- **M12** Add team's account check stays; confirm it is rate-limited.

**Not built (the unchosen options):** per-format locked rows on the free Teams export (M2 b); Results-only scoring with
Field scores hidden (M3 b); a notice on an older event (M4 c); a master switch over one email (M5 b); Teams instead of
Dashboard in the bar (M6 b); Registration health kept on free (M7 b); waiting teams hidden on 2027-10-01 (M10 b); a
bulk remove; the chip itself carrying the Founding Season words (M9 b).

## Read first

- **The hub, whole:** the Mockups tab (every drawing, every tag note, the Design check screen), the Decisions tab (R1–R10
  and M1–M12), and plan §6 + §11 ("Facts the drawing session verified in code").
- **The gate today:** `lib/plan-features.ts` (one plan-level ladder: `FEATURE_MIN_PLAN`, `PLAN_RANK` with `team` = 0,
  `PLAN_FEATURE_GRANTS.team` = `pdf_exports`, `pdf_template_settings`, `coach_peer_chat`; `hasPlanFeature`),
  `lib/plan-config.ts` (`isFreePlan`, `officialsFreeSeats`, `FOUNDING_SEASON_END` / `_LABEL`), `lib/founding-season.ts`,
  `app/api/admin/org/founding-season-status/route.ts` (no single helper means "a comp still on free" today: it is
  `isFreePlan(planId)` + `isFoundingSeason`), `lib/tournament-slot.ts`. **Nothing in the gate is per event today** — R8
  needs it (B1).
- **The nav:** `components/admin/admin-nav-config.ts` (`TOUR_GROUPS`), `components/admin/kit/kit-tournament-groups.ts`
  (Summary appended for completed/archived), `AdminKitRail.tsx`, `AdminKitBottomNav.tsx` (the phone bar rule ≈ lines
  84–98; More ≈ 223–350), `components/admin/AdminContextStrip.tsx`, `components/admin/AdminEventHeader.tsx`. ⚠ The admin
  frame is shared with the Club programme: touch only the tournament branch.
- **Teams:** `app/[orgSlug]/admin/tournaments/registrations/page.tsx` (title row, toolbar, Tools ≈ 1780–1825, Select many
  ≈ 1607–1727, Add Team window ≈ 2071–2127, Add my team, the export guard ≈ 851–858), `components/TeamList.tsx`,
  `TeamsGlance.tsx`, `RegistrationHealthPanel.tsx`, `TeamRecord.tsx` (all under `registrations/components/`),
  `lib/tournament-teams.ts` (bands), `lib/registration-words.ts`, `lib/registration-health.ts`,
  `components/admin/ExportMenu.tsx`, `app/api/admin/teams/route.ts` (add team, the notify email ≈ 337–351),
  `lib/email.ts` ("Team Registered" ≈ 165–191), `app/coaches/join/page.tsx` (the claim; unchanged).
- **Event settings:** `settings/event/page.tsx` (seven cards ≈ 850–894; Registration questions callout ≈ 1067; Contact ≈
  1353; Coach emails ≈ 1434–1489), `lib/event-settings-words.ts`, `lib/tournament-settings-words.ts`.
- **Boards:** `dashboard/page.tsx`, `WeeksBeforeBoard.tsx` (Registration / Payments / Coaches cards), `FinishedBoard.tsx`
  (Reuse + Summary lock lines ≈ 75–101; the "$ collected" foot), `DraftBoard.tsx` (≈ 193–199, the lime "Review
  Tournament Plus"), `GameDayBoard.tsx` (unchanged), `lib/after-event-words.ts`, `summary/page.tsx`.
- **Areas that leave free:** `check-in/page.tsx` (+ the gate page `app/[orgSlug]/check-in/`), `staff-kit/page.tsx`,
  `chat/page.tsx` (`UpgradeGate`), the public `app/[orgSlug]/[tournamentSlug]/register/page.tsx`, Public site's
  Registration switch (`lib/public-pages.ts`), the volunteer role (`lib/roles.ts`, `lib/member-access.ts`, the members
  invite).
- **Scores:** `results/page.tsx` (the Scorekeeper button ≈ 541–552), `app/[orgSlug]/scorekeeper/` (layout `canScore` ≈
  76; page ≈ 917–962), `app/api/official/[orgSlug]/score/get-score.ts` (≈ 264–268: the client reads only the policy),
  `lib/tournament-scoring-service.ts` (≈ 136–139: only official and staff are held for review).
- **Composer:** `communication/MessageComposer.tsx`, `lib/communication-words.ts`, `app/api/admin/communications/route.ts`
  (the caps ≈ 21–22, 170–194: 10 sends per tournament per rolling 24 h; 100 recipients).
- **Public site:** `branding/page.tsx` (Pages ≈ 391–405; the free block ≈ 407–437), the public layout
  `app/[orgSlug]/[tournamentSlug]/layout.tsx` (≈ 282–336: `PoweredByBadge`, `TournamentAcquisitionBanner`,
  `BuiltOnCredit`, all on `isFreePlan`).
- **Locks:** `components/admin/tournament/PlanLockLine.tsx` (+ `PlanLockedTool`, `tournamentPlusPanelHref`) and every
  usage (plan §11 lists them); `components/admin/TournamentSetupWizard.tsx` (the reuse step ≈ 706–753);
  `app/[orgSlug]/admin/org/tournaments/page.tsx`; `schedule/components/PublishScheduleModal.tsx`.
- **Memory:** `project_free_tournament_tier_review`, `feedback_build_to_approved_mockups`,
  `feedback_mockups_as_claude_artifacts`, `feedback_qa_walkthroughs_as_checkable_artifacts`,
  `decision_disabled_btn_face`, `decision_window_foot_text_left`, `decision_export_is_one_button`,
  `decision_record_reads_first_edits_whole`, `reference_code_gotchas_index` (dates via `formatStoredDate` /
  `formatTime` only), `reference_partial_commit_shared_tree`.

## Preconditions (check before code)

1. **The tournament admin redesign has closed:** its final walk (§306), Club Stage 6c's calendar findings, and its
   close-out are recorded in `TOURNAMENT_ADMIN_REDESIGN_PLAN.md` and the Owner QA Ledger. **If not, stop and tell the
   owner.** Then re-read the redesigned screens as built: if any drawing on the hub no longer matches the screen it
   changes (a card renamed, a menu reshaped), list the deltas to the owner before building — the drawing shows the
   intent; a changed base is a question, not a silent adaptation.
2. **`/marketing`'s fix-now pass (R9)** on the home page's free card, the Plus card's badge line and the Premium portal's
   seats line is its own change. Check whether it landed; it does not block the build, but say which it was.
3. **`/billing` owns the gate changes and `/strategy` runs the drift check** (the Facts doc's free inclusion list moves
   from "Decided, not built" to built; `lib/plan-config.ts` and `lib/plan-features.ts` change in the same unit of work;
   F14's dead keys are removed). Run both before the first commit.
4. **`/marketing` confirms the words before you build them** (the list below). The placements are ruled; the words are
   `/marketing`'s.
5. **The UX summary for the owner comes first** (AGENCY_RULES), short and in product words: what a free organizer and a
   coach host stop seeing; where the one lock sits; what changes on the public page; who it reaches (production had no
   free event on 2026-10-12; one coach draft; one Founding Season organization).
6. **One browser tester at a time:** ask the owner whether another session is measuring before any probe, sweep or
   `auth-setup`. **Never create an event in `uat-test-org`** (the free test club has one slot); ask before resetting a
   test club or switching a test club's plan.
7. **Settle B1–B3 with the owner at the start** (below), each with its recommendation.

## Build-start questions (ask, with the recommendation)

- **B1 · How an event knows which rules it runs under (R8, R2).** The gate is per plan today; R8 is per event.
  *Rec.:* a migration adds one column to `tournaments` (e.g. `keeps_pre_invite_tools boolean not null default false`)
  and stamps **true** on every existing event of a free or Premium-coach organization that is not finished; new events
  start false. One helper (e.g. `lib/tournament-free-rules.ts`) answers per event: **invite-only** (a free or coach plan,
  not stamped), **keeps today's tools** (stamped, until it finishes), or **paid** — and, for an invite-only event that
  holds registration-era records (a team that came in by registering, a recorded payment, fees set: an event made on
  Plus whose organization dropped to free, R2), **shows those records read-only** (M10). A stamped event keeps only the
  free tools it had (registration, review, the waitlist, payments, check-in, the Staff kit, volunteers); everything that
  was already locked takes the new presentation (Chat hidden, no Summary row, the one lock shape). Production on
  2026-10-12 would stamp one event (the coach's empty draft). *Alt.:* a cutoff date constant in `lib/plan-config.ts`
  compared with `created_at` (no migration; a second home for "the build date", set at the promote).
- **B2 · Server enforcement for what free hides.** Today several free-plan screens are the only lock (F13). *Rec.:* on an
  invite-only event the server refuses each hidden area's writes — a public registration submit, accept / decline /
  waitlist on an invite-only event (allowed on an R2 event per M10), payment updates, check-in, a volunteer invite
  (the `official` role) for a free or coach organization with no stamped event, Chat posts (already gated), and the
  Teams export's Excel/CSV (already refused; let the coach's PDF through, M2). Reads stay. The hidden pages (Register,
  Check-in, Staff kit, Chat, Summary) redirect to the dashboard rather than render a wall. *Alt.:* screens only, as
  today's F13 locks (a known gap).
- **B3 · The invitation email.** *Rec.:* the existing "team added" email (`lib/email.ts`) becomes the invitation on an
  invite-only event, in `/marketing`'s words: no "has been registered", no payment sentence, the claim link as today.
  Paid events keep today's email. *Alt.:* a second template for invite-only events.

## Running beside other work

- **Club Tier sessions** share the admin frame (`components/admin/kit/*`), the dev server, the test clubs and the
  browser. Touch only the tournament branch of the rail, bar and More; re-run the club nav's tests.
- **The demos** run the real product on an unlimited plan: the free change does not reach them, but the build fails if
  a tour anchor stops existing (`registration-health`, `now-playing`, `schedule-health`, `post-event-summary`) — keep
  them on paid plans and run `check:demos`.
- **Git:** `dev` only; explicit pathspecs; a shared file is HEAD plus your own hunks (`reference_partial_commit_shared_tree`);
  re-read HEAD right before each commit; **commit only when the owner says**. A migration's prod step goes into
  `supabase/migrations/MANUAL_PROD_STEPS.json` with its order; read the release record first.

## The build, in parts (each part matches its drawing; a visual delta found mid-build is a question for the owner)

**Part 0 · The rules (B1, B2) and the gate.** The per-event helper and its unit tests (free new · free stamped · free
with R2 records · coach new · coach stamped · Plus · Founding Season comp still on free); the migration (B1) with the
data dictionary and snapshot refresh; `/billing`'s key changes (registration, review, waitlist collection, payment
tracking, check-in and volunteers move off free; `bulk_registration_actions` and `waitlist_collection` leave free; F14's
`online_tournament_payments`, `bulk_operational_workbook` and the never-checked free keys removed or renamed); the Facts
doc and plan config with `/strategy`'s drift check; the server refusals (B2). One helper for "a Founding Season comp
still on free", used by every lock (M9).

**Part 1 · The navigation (hub screen 5, M6).** Rail: no Check-in, Staff kit or Chat on an invite-only event; no
Summary row when it finishes. Phone bar on a live invite-only event: Results · Dashboard · Schedule · Messages · More
(the Messages tab opens Communications); draft bar unchanged; Chat's unread count no longer rides More. More: no Staff
kit, Check-in, Chat or Summary; on an Active event no "Open dashboard" link (Dashboard is a tab). The context strip
never offers "N teams to review" on an invite-only event. Settings & access: the Volunteer role leaves the invite
window for an organization with no stamped event. A stamped event keeps today's rows.

**Part 2 · Teams, Add team and the record (screens 1–2, specimen 9; M1, M2, M7, M8, M12).** The list: no At a glance,
no Payment column, no Filter, no review / waitlist bands or row actions, pool bands only (no band without pools), "No
email" in amber in the Coach cell. Tools: Select many only on a pool division with Move to pool only; the import lock;
Randomize as today. Export: free = one locked row "Export the team list"; coach = "Excel and CSV" locked + PDF report
open (and working — the server lets the coach's PDF through). Add team: title and button "Add team", no Payment status,
the three sentences under Email (an existing account / a new coach / no email), the invitation box ticked whenever an
email is entered and absent without one; confirm the account check is rate-limited (M12) — if it is not, add a limit
and say so. Add my team: no Payment status. The record: no status chip (the header says pool · division), no Payment,
Decision, Registration answers or Registration sections, "Added", "Resend the invitation" (it re-sends the invitation,
B3).

**Part 3 · Event settings (screen 3, M5).** Registration questions and Fees & payments cards absent. Contact keeps the
public contact; Registration alert routing goes; summary "Contact public". Coach emails: one switch (Game-day reminder)
+ two lock lines ("Email the teams when you publish the schedule", "Email every team the final results"); summary
"Game-day reminder on"; the four registration and payment emails never fire on an invite-only event.

**Part 4 · The boards and Summary (screen 4, specimen 12).** Weeks before: Registration card → Teams card (per division
"8 teams · 2 pools", door to Teams, no count beside the title); Payments and Coaches cards absent. Finished: the foot
line drops money; Reuse and Summary keep their lock lines; no Summary nav row; the Summary page redirects on free.
Draft board: "Reuse a past tournament's setup" as the one lock line (no lime button, opens the Tournament Plus panel).

**Part 5 · Public site and the public pages (screens 6–7).** Admin: no Registration switch; one lock line for branding
replacing the Unlock box and six Locked cards. Public: no "Registration is open", no Register a Team button or note, no
Register page (B2), Teams shows the count; the badge and banner on a Premium coach's event (R6) — the layout's free
check must treat `team` as free for the credit only, never for features or theme.

**Part 6 · The lock line everywhere and the composer (specimens 8, 11; M9, M11).** One shape: Schedule/Results Export's
PDF row as a Tools-menu lock (no sentence under it); the New tournament reuse step as one lock line ("Reuse a past
tournament's setup") plus M4's sentence; the Founding Season variant everywhere (quiet grey second line; once at a
Tools menu's foot). Composer: "To each team's coach" (no "accepted") on an invite-only event; the limit line under the
email count; before Send, the over-limit states (the day's 10 used: the email box switched off with the time it frees,
from the rolling 24 h; over 100 people: the button keeps its name with the switched-off face and the foot's left says
why); "Pin it at the top" unchanged; targeting lock words "Choose which teams get it".

**Part 7 · Scores from the field (specimen 10, M3).** Field scores stays for owner, admin and staff on free; no
volunteer role there; the Results page's Scorekeeper button stays. Fix the review note: an owner or admin is shown
"Finalize score" and "This score is final as soon as you save it." when their score saves final.

**Part 8 · The older and the carried events (specimens 13–14, R2, R8, M4, M10).** A stamped event: today's tools until
it finishes, nothing new shown. An invite-only event with registration-era records: "Registration closed" with its
sentence and the "Reopen registration" lock; the Payment column and the record's figures read-only with the "Record
payments" lock; waiting teams listed and acceptable or declinable; Chat, check-in and volunteers hidden. The
2027-10-01 turn-off itself is the Founding Season plan's Phase 3, not this build; test the state by switching a dev
test organization's plan (ask first).

**Part 9 · Words, help and the shop window.** `/marketing` writes the words below (precondition 4) and, after the build,
R9's repositioning (the free card, the organizer page, `/start`, the coach page, the brand promise; "Free to start" in
the acquisition banner). `/docs` updates help (registration, payments, check-in, volunteers, Chat, Summary and the
export answers that describe free). `/demos` only if the release cycle earns it.

## The words for `/marketing` (placements ruled; words theirs)

Lock lines: "Export the team list" · "Excel and CSV" · "Reuse a past tournament's setup" · "Email the teams when you
publish the schedule" · "Email every team the final results" · "Your logo, theme, banner and fonts on this site" ·
"Choose which teams get it" · "Reopen registration" · "Record payments" · the Founding Season line "Free for you
through September 30, 2027" / "Tournament Plus is free for you through September 30, 2027." Composer: "On your plan: up
to 100 people a send and 10 emails a day for this event." · "This event has sent its 10 emails for today. You can email
the teams again after {time}." · "That's {n} people; one email reaches up to 100 on your plan." Add team: the title and
button, the three Email sentences, "Email the coach an invitation to claim this team". The record: "Added", "Resend the
invitation" and its confirmation. Teams: "No email". New tournament: "On the free plan you add each team yourself, and
its coach gets an email to claim it." The Teams card's name; "Game-day reminder on"; "Contact public"; the R2 sentence
"Registration closed on October 1, 2027, when this organization's Tournament Plus ended. Teams already in stay." The
invitation email (B3). The phone tab "Messages". One spelling throughout (`npm run check:spelling`); times as "8:00
a.m."; dates via the product's formatters.

## Not in this build

Prices; Tournament Plus screens (unchanged); the Founding Season offer and its 2027-10-01 turn-off (Phase 3); a coach's
two ways to host (a later coach-portal pass, R10); the Plans & Pricing matrix (the platform admin console project,
R10); an accept step or bulk add for invited teams (Q4 B, C were not chosen); the club calendar or anything Club Tier
owns.

## Verification

- Unit: the rules helper across the seven cases (Part 0); the server refusals (B2) with a free, a coach, a stamped and
  a Plus fixture; the composer's before-Send states; the phone bar rule by status and plan.
- `npm run typecheck` (shared modules change), `npm run verify:changed` (spelling, dictionary, focused lint), the
  route-coverage gate, `check:demos` (the anchors), and the existing nav and Teams tests.
- Render each drawn screen on a free test event, a coach's event and a Plus event at 1280 and 390, and compare with
  the hub's drawings (ask before any browser work). A difference from a drawing is a question for the owner, never a
  silent judgment.
- `/simplify` (a new shared helper), then `/review`, then `/docs` and `/marketing`, before the owner's walk.
- **The owner's walk:** a checkable QA Walk tab on this same hub (one purpose per walk; checkboxes, notes and a
  paste-back), and its § in the Owner QA Ledger. Record the build's anchors on the hub's stage strip ("Built `<hash>`
  <date>"), never a perishable negative.
