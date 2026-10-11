# Club Tier Readiness — Stage 6d session prompt ("Calendar feeds: a calendar that stays current")

> Paste into a fresh session on `dev`. Written 2026-10-11. **This session verifies, draws, records and settles rulings.
> It does not build.** When the owner rules, it writes one build prompt.
>
> **Why now:** 6c ruled what a feed carries (2026-10-10, built and walked, §289 closed), and the owner decided on
> 2026-10-11 that 6d **no longer gates the club scheduler** (Stage 11): the feed reads the practices the scheduler writes
> whenever it lands, so 6d runs on its own. Whether 6d holds the Club release is still open (the plan recommends no).
>
> **Beside you:** the permits build (Stage 10a, `CLUB_PERMITS_BUILD_PROMPT.md`) may be running in another chat. It shares
> the hub (its QA tab), the club plan, the TODO, the ledger, the dev server and the test club — none of 6d's screens.

## What this session produces, in order

1. **The record**, in the parent plan's §6 **Stage 6d** section (a "🎨 DRAWN" block, as 6c's), the club PM brief's 6d
   row, and the D07 finding trued (below). 6d is a stage of the Club readiness plan, as 6c was; **if the verification
   shows it is larger than one stage** (for example a family door that needs its own consent work), say so and propose
   its own `_PLAN.md` + `_PM_BRIEF.md` pair rather than squeezing it in.
2. **The mockups** on the club hub (the ONE artifact), a new **"Stage 6d"** stage: whole screen, before and after, true
   size, both themes, every highlight clickable.
3. **The asks**, each with a recommendation, on the Decisions tab (rows `open`, then their ruling) and in the plan.
4. **`/design` review of every drawing before the hand-off** (the owner's standing rule: run it, don't offer it).
5. **When ruled:** `docs/projects/active/CLUB_TIER_STAGE6D_BUILD_PROMPT.md` (one build, unless the record says two).

## Read first

- `docs/projects/active/CLUB_TIER_PRODUCTION_READINESS_PLAN.md`:
  - **§6 Stage 6d** in full: the outcome, "From Stage 6c — what a feed carries", the sequencing (amended 2026-10-11) and
    the "6d can draw now" note;
  - the **D07** finding (search `| D07 |`): the team-wide feed's token has no caller, help says a subscription link is
    "planned for a future release", the public team page skips the checks the feed makes;
  - **§6 Stage 6b, Ask 10** (the club calendar's subscribable link was handed here; 6b shipped the download only) and
    **§6 Stage 6c** (the recipe, C6-07: the public tournament's "Add My Games to Calendar" writes the device's clock).
- `docs/projects/active/COACH_SCHEDULE_DEEP_DIVE_PLAN.md`: its **stage 4** (merged into 6d 2026-10-09) — a "Subscribe on
  this phone" row beside the download; every kind including organizer games; cancelled events marked cancelled; tryout
  sessions only when the coach runs them; "a coach-scoped feed token is new storage — a migration may appear". And
  **D-1 / D-2** (the export's late-evening day shift, fixed 2026-09-25 — the feed must not reintroduce it).
- `docs/projects/active/CLUB_PERMITS_AND_SCHEDULER_PLAN.md` **§3.2** ("The team's feed") and **§5.8** (what the club's
  schedule slots need from a feed).
- `docs/agents/design/TABLE_AND_LIST_STANDARD.md` **§11** (the calendar recipe's words: the clock's spelling, "vs" / "@",
  a cancelled event's word, the event's own clock).
- `docs/agents/strategy/PLAN_PRICING_FACTS.md`, the **family layer** bullet (the per-family subscription feed is a Premium
  Coaches Portal / Club inclusion; the **guardian** tier is built but **switched off pending PIPEDA/CASL counsel
  sign-off**) and the **Venue library / club calendar** bullet (League Plus and both Club bands); `BUSINESS_DECISIONS.md`
  2026-08-01 and 2026-09-12 (the family layer; the team family link and follower tier removed).
- The hub: `docs/projects/active/CLUB_TIER_PRODUCTION_READINESS_HUB.html` = https://claude.ai/artifact/K4MPu4ni53Ct7yrDcmWJd9.
  Its Stage 6c section is your drawing method; Stages 10 + 11 (`.probe/s1011-hub/` — the kit, the assembler, the
  screenshot and check scripts) is the newest example of building a stage's parts and splicing them in.
- In-repo `memory/design_decisions.md`, 2026-10-01 → 2026-10-11 (a record reads first; a rare door ends the body; one
  Export; an export sits above what it exports; the calendar recipe).
- Memory: `project_club_tier_readiness`, `project_club_stage6c_one_calendar`, `project_schedule_deep_dive_inputs`,
  `project_club_stage11_scheduler`, `feedback_portal_is_the_formatting_benchmark`, `feedback_clickable_design_annotations`,
  `feedback_mockups_as_claude_artifacts`, `feedback_always_run_design_on_mockups`, `decision_export_is_one_button`,
  `decision_rare_door_ends_body`, `reference_hub_script_parse_trap`, `reference_artifact_publish_needs_full_read`,
  `reference_backticks_in_shell_strings`, `reference_js_replace_dollar_patterns`.

## Already ruled. Draw to these; don't re-ask them

- **What a feed carries** (Stage 6c, ratified 2026-10-10): a cancelled event **stays in the feed, marked cancelled**
  (today's family feed drops it); "Arrive by 5:30 p.m." in the clock's spelling (today the raw stored string); "vs" / "@"
  for home and away (today always "vs"); **every time in the event's own clock** (C6-07: the public tournament's "Add My
  Games to Calendar" writes the device's).
- **The family app and the public team page are parked here** (6c): their lists already read the recipe's words; only
  their calendar doors are 6d's.
- **The club's schedule slots** (Stages 10 + 11, ratified 2026-10-11; plan §5.8): every finalized club slot is an ordinary
  practice row on the team's schedule; a slot the club cancels stays, marked cancelled; a slot the coach hands back
  leaves; the club's clock. The feed reads the rows — **it never needs to know a slot came from the club** beyond what the
  row already says.
- **6d does not gate the scheduler** (owner, 2026-10-11).
- **The family layer's gates and the guardian switch are not this session's.** The guardian tier stays off until counsel
  signs off; a door that only a guardian could use is drawn as what it will be, tagged, never as live.
- **Out:** two-way sync (a calendar app writing back).

## Verify before drawing (read the code; plans in this repo have been wrong — D07 already is)

- **D07, re-read.** `lib/export/ics.ts`'s "STUB" header was **trued on 2026-09-25** (its own header says so) — the plan's
  row is stale on that point; correct it. Is `ensureTeamCalendarToken` (`lib/family-access.ts`, ~`:265`) still without a
  caller? Does help still say "planned for a future release" (`lib/help-content/exports.tsx:354`, `:358`)?
- **The feed route** `app/api/family/calendar/[token]/route.ts`: one route, two token kinds (a per-family token while the
  link is verified; a team-wide token at Public link only); visibility re-checked on every read; no identity in the feed.
  Read what it carries (which kinds — games, practices, mirrored tournament games, tryout days?), what it drops (it
  filters cancelled at ~`:65`), the words and the clock it writes (`composeICSFromInstants`, `lib/export/ics.ts:73`), its
  caching and rate limits (`lib/no-login-token.ts`).
- **Who can receive a feed today, counted** (read-only, dev and prod): teams at each schedule visibility (Staff only ·
  Families · Public link), team-wide tokens minted, family links verified and per-family tokens minted. With the guardian
  switch off, the per-family audience is likely nil — say so with the number.
- **The coach's download:** `CoachExportButton`, `lib/export/schedule-calendar.ts:58` (`coachScheduleCalendarEntries`),
  the catalog's `coaches-schedule` entry (`lib/export/catalog.ts:625`, xlsx / csv / ics), the phone's export row and the
  desk's Export → Calendar. What it carries that a family feed doesn't (staff-only events, tryouts).
- **The club calendar's Calendar file** (6b; `app/[orgSlug]/admin/calendar/page.tsx`, export ~`:163-168`;
  `lib/export/catalog.ts:759`): what it writes, who can open the calendar. A subscribable club link is a URL to every
  booking in the club: read what a booking carries (team names, coaches' names, house league, tournaments) before
  proposing who may hold one.
- **The public team page** `app/[orgSlug]/teams/[teamSlug]/page.tsx` (D07: it skips the cancelled-org / public checks the
  feed makes) and the public tournament's "Add My Games to Calendar" (C6-07).
- **Token storage:** `rep_teams.family_calendar_token_hash`, the family link's `calendar_token_hash`. A coach-scoped
  token is new storage (a migration in the build) — or can a coach's feed be served another way? Removing a coach must
  end their feed (the access lesson: "removing a coach doesn't remove them" was a real defect class here).
- **How calendar apps behave:** they poll on their own schedule (Google can take hours); a subscription can't be forced
  to refresh. Help words must say that honestly. Read whether the route sends caching headers.

## The proposed shape (the session draws and tests it)

- **A coach:** **Subscribe** beside the download — on a phone, a "Subscribe on this phone" row with the calendar icon's
  door (6c's phone Export); on a computer, inside the one Export. A personal, revocable link to the team's whole schedule
  (every kind, organizer games included; cancelled marked; tryout days only when they run them; staff-only events, since
  it is the coach's own), with **Reset the link** and what it does; it ends when the coach leaves the team.
- **A family:** the **team-wide feed** at Public link, offered on the public team page (a "Subscribe" row) — the only
  family door that can be live while the guardian switch is off. The per-family feed (the family view) drawn as it will
  be, tagged as waiting for the guardian switch.
- **A club admin:** the club calendar's **subscribable link** (6b Ask 10) — personal, revocable, carrying what the club
  calendar shows that person.
- **Every feed:** the recipe's words; the event's own clock; a cancelled event kept and marked; the club's slots as
  ordinary practices; help that says how often calendar apps check.

## Blocking gate — item ONE is the mockup

1. **The mockups on the hub's Mockups tab, before any code.** Add one stage: **`6d`, labelled "Stage 6d"**, placed after
   Stage 6c's button.
2. **Whole screen, before and after,** for every surface that changes: the coach's schedule (desk Export and the phone's
   calendar door), the public team page, the family view's calendar door, the club calendar's Export, and the
   **Subscribe** window or sheet itself (the link, Copy, Open in Google / Apple / Outlook if offered, Reset the link, what
   reaches the feed and how often it updates). Draw **what a subscribed event looks like** in a calendar app (an
   illustration, tagged as the app's, not ours): a practice, an away game ("@"), a cancelled event, a club slot.
3. **Every highlight is clickable:** NEW / RESTYLED / UNCHANGED / SHARED tags, each with its own `data-note`.
4. **True size:** the coach's 1440 and 390 frames, the club's 1200, phone frames with the 44 px block; **both themes**
   ("after" drawn Warm, a Dark copy cloned at load).
5. **Check against the formatting benchmark and the calendar recipe** before the owner sees a drawing, then run
   `/design` and list its fixes on a "Formatting check" screen.
6. **Record every ruling on the Decisions tab as it happens**, and in the plan.

## The asks (each with a recommendation; Decisions rows, `open`)

1. **Whose link is a coach's?** Recommended: one per coach per team, personal and revocable, ended when the coach leaves
   the team or loses schedule access — never the team-wide token (which a family may hold).
2. **What a coach's feed carries.** Recommended: everything on the team's schedule the coach can see, including
   staff-only events and tryout days they run; cancelled kept and marked.
3. **The family's door while the guardian switch is off.** Recommended: the team-wide feed at Public link, offered on the
   public team page; nothing at Families or Staff only; the per-family feed waits for the guardian switch (counsel).
4. **The club calendar's link.** Recommended: personal to the admin who mints it, revocable, carrying what the club
   calendar shows that person; never public.
5. **How a cancelled event reads in a calendar app.** Recommended: kept, marked cancelled in the calendar file's own way
   and with the recipe's word in its title.
6. **Does 6d hold the Club release?** Recommended: no (the plan's recommendation; the owner never ruled it).
7. **Anything the verification finds** that this list misses. Say so; don't force-fit it.

## Working beside the other sessions

- **The hub is published from the shared working copy by several sessions** (the permits build will republish its QA tab).
  - Before every edit, read it fresh and check `git status`.
  - Parse its scripts before every publish: one unescaped apostrophe kills every tab (memory
    `reference_hub_script_parse_trap` — and a straight apostrophe inside a single-quoted string in your own generator does
    the same).
  - The Artifact tool refuses a publish until the live version has been read **in full**, every line through the Read
    tool, once per session (about 2.9 MB now). Hand that read and the first publish to a subagent.
  - Diff a refused publish against the live copy; never `force`.
  - The stage switch hard-codes its stage list (`data-stg` buttons, `walkset` spans, `stageOf()`). Add one entry, `6d`,
    labelled "Stage 6d", and change nothing else in the script. Build your parts outside the hub (a `.probe/s6d-hub/`
    kit and assembler, as `.probe/s1011-hub/`) and splice them in from HEAD's copy plus your hunks.
- **One browser tester at a time.** Before any probe, capture or `auth-setup`, ask the owner whether another session is
  measuring. **Probes write nothing.** Never reset the test club without asking.
- **QA walks keep their ticks by step POSITION.** Add steps only at a walk's end.
- **No code, no help, no gates.** Your files: the hub's Stage 6d section and its Decisions rows; the parent plan's Stage
  6d section and its D07 row; the club PM brief's 6d row; your TODO line (the Stage 6d line exists); memory.
- **Git:** a private index and explicit pathspecs. Build shared files as HEAD plus your own hunks, and re-read HEAD
  immediately before committing. After committing, `git reset -q -- <paths>` on the shared index. Commit only when the
  owner says.

## Hand-off

- Write in product-owner voice. Lead with what each person sees and does differently: **a coach** (subscribe once on a
  phone; the team's schedule stays current in their own calendar), **a family** (a Subscribe row on the public team page,
  where the team shares its schedule publicly), **a club admin** (the club calendar in their own calendar app), and what
  waits for counsel.
- **Tell the owner to open the hub on a phone.**
- Put the asks as numbered questions with a recommendation each.
- **When ruled:** write `CLUB_TIER_STAGE6D_BUILD_PROMPT.md` (the structure of `CLUB_PERMITS_BUILD_PROMPT.md`: the hub as
  the spec, lessons, preconditions, the code read with anchors, Part 0 design log, what to build, help, words, walks,
  gates, hand-off).

## Do not

- Build anything, or change routes, gates, seeds, help or copy files.
- Re-ask a question ruled above.
- Redraw the coach's schedule, the club calendar, the public team page or the family view beyond their calendar doors;
  a change to anything else on them is a shared ask.
- Turn on, or design around turning on, the guardian tier; change a plan, a price or a gate (a packaging question is
  `/strategy`'s); write customer copy (tag words for `/marketing`).
- Mint a second artifact. The club hub is the only one.
