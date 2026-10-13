# Tournament admin redesign · Stage 5 drawn — Create and set up (the last stage)

> Paste into a fresh session on `dev`. Written 2026-10-10, after Stage 3 (the schedule) was built. **Design only: no
> product code until the owner rules.** Read "Working beside the other sessions" before touching the dev server or a
> shared file.
>
> **This is the redesign's last stage.** When it is built and walked, every tournament screen has been redrawn, and the
> project closes: its plan and brief move to the archive, and its follow-ups become one TODO group. Draw with that in
> mind: anything left unruled here has no later stage to land in.
>
> **Why now.** It waited for Club Tier Stage 6. The Venue library (6b) and the one Venue field (6a) are built, so the
> tournament's venue setup can be drawn against what exists. Club Tier's 6c drawing (one calendar) may run at the same
> time; it publishes to the club hub and draws no setup screen.

## Read first

- `TOURNAMENT_ADMIN_REDESIGN_PLAN.md`:
  - §1: evidence. Label every guess as a guess.
  - §2: the rulings not reopened. The Club Tier paragraph: Stages 3 and 5 draw against the club hub's Stage 6
    specimens 4 and 7, and wire to 6a's check and shared field.
  - §3 **"Create and set up", F25–F31**, plus F26's after-event half, **F33** (a third reuse flow: the draft board's
    "copy into this draft") and **F55** (the before-event board's "Set up fees →" opens the Tournaments list).
  - §4: the nine rules across the stations. Rules 1 (name the event once), 8 (one way to do one thing: one creation
    question set, one reuse flow) and 9 (say the true thing) are this stage's.
  - §5: the ladder, row 5. **Desk first, phone usable.**
  - **§6d Stage 4 as built**: the one reuse flow (the wizard's step, every door) and what it left to Stage 5:
    - **A18, ruled:** Stage 5 owns the dashboard's before-event view (the checklist and the guidance card, with their
      share of the kit rules);
    - the draft board's copy-into-this-draft;
    - **P5:** whether Event Settings keeps its own Draft / Active / Completed switch;
    - the live board's header (its help "?");
    - the full-screen reuse step on a phone, tagged "shared, Stage 5".
  - **§6c Stage 3**, and its build: the game window, and the Venue field it now carries.
  - §6f Stage 6 as drawn and as built: the newest record; yours (§6e) follows its shape.
  - §7: A2, A5 (the Club seams: "Import from library" is Club and League only), A6 (plan gating), and A23's route
    (below).
  - §8 (Part B skips the screens a redesign replaces) and §11 (the formatting check; run it before the owner sees
    anything).
- `CLUB_TIER_PRODUCTION_READINESS_PLAN.md` §6 **Stage 6**: the 6a and 6b records. Two of their findings are yours:
  - **6a's F2:** a clone, import-from-past and populate-from lose a venue's facilities (and populate-from keeps the
    library link while the others may not). Re-read the code after 6a's changes.
  - **S6-04's wizard half:** the setup wizard's venue search returns other tournaments' venue copies, not the club's
    Venue library.
  - The 6a guard's "asks where" not-yet list names **the setup wizard (this stage)**.
- **A23, the one-slot question, lands here, and it is RULED (2026-10-10, "one at a time"): a Completed event stops
  holding the one tournament slot.** Decided, not built; **this stage builds it.** Read `BUSINESS_DECISIONS.md` and
  `PLAN_PRICING_FACTS.md`'s 2026-10-10 reconciliation:
  - the live sentences that describe today's rule (the finished board's sentence, the slot refusal, three help answers)
    are routed to change with this build;
  - the plan's tournament limit stays 1.

  Draw the creation path a free organizer meets under the ruled rule: next year's event once last year's is Completed.
- ⚠ **The free tier is about to be redefined** (owner 2026-10-10: a separate "free tournament tier" project, after this
  redesign). The owner expects the free tier to serve small exhibition tournaments, including coaches with a Coaches
  Portal, with no registration management, no payment tracking and no staff kits. **Draw the paid path, and leave what a
  free organizer sees on each setup screen as it is today, tagged "free tier review".** Don't redesign a lock or a
  hidden section that project will decide; list each one you meet so it starts from your list.
- The June organizer journey (J1, *Dana*) in `docs/projects/archive/journeys/`: its setup rows (J1-028, J1-029, J1-033,
  J1-034, J1-041, J1-046, J1-058, J1-064 and the rest). Re-verify each against today's code; tag it open, fixed (with
  its commit) or partly.
- The hub (ONE artifact; republish the SAME path): `docs/projects/archive/TOURNAMENT_ADMIN_REDESIGN_HUB.html` =
  https://claude.ai/artifact/HQoRuEsKd7i6cAvCrMNzgM. The Walk tab's stations 1–5 (`#st1` … `#st5`) and the Stage 1, 2, 3,
  4 and 6 tabs for the drawing method. Add an `s5` tab (the tabs are `data-hub` buttons; s1–s4 and s6 exist).
- ⚖ **Four of this stage's questions were already ruled on the walk** (the hub's recorded ruling: "Q 1.1 3.1 4.1
  reshape in Stage 5, Q 2.1 keep and make it the model"). They are your starting points, not asks:
  - **Q 1.1:** both wizards ask the same questions, and the wizard seeds Diamond 1…N.
  - **Q 2.1:** Event settings stays, and it is the model for the setup screens (closed cards, autosave); on a phone the
    Fee model becomes a dropdown.
  - **Q 3.1:** Divisions, Venues and Rules take one save model (autosave), Delete sits inside each record's editor, and
    "Full" reads as good news.
  - **Q 4.1:** Public site gets a "See your public site" door: the preview while the event is a draft, the live page
    after.

  Q 3.1 was ruled **before** the 2026-10-01 record standard ("a record reads first and edits whole") and the 2026-10-09
  rare-door ruling. Say plainly where they meet (Ask 4); don't pick one silently.
- The club hub (read only; never publish it): https://claude.ai/artifact/K4MPu4ni53Ct7yrDcmWJd9 → Mockups → Stage 6,
  **specimen 7** ("Where, on every form") and the Venue library's drawings.
- Memory: `project_tournament_admin_redesign`, `project_club_stage6_venues`, `feedback_portal_is_the_formatting_benchmark`,
  `feedback_build_to_approved_mockups`, `feedback_clickable_design_annotations`, `feedback_mockups_as_claude_artifacts`,
  `decision_edit_autosaves_create_asks`, `decision_record_reads_first_edits_whole`, `decision_rare_door_ends_body`,
  `decision_one_toolbar_rare_tools_behind_tools`, `decision_export_is_one_button`, `reference_hub_script_parse_trap`.

## The rulings your drawings follow (in-repo `memory/design_decisions.md`)

- **Edit autosaves, create asks** (2026-09-24). F30 (four setup screens, four save models) is this rule's test. The
  2026-10-09 exception: a change that tells families is held until ✓ and asks.
- **A record reads first and edits whole** (2026-10-01); **a record's rare door ends its body, never a foot row**
  (2026-10-09: Archive, Bring back, Merge join Delete); **an admin record's Delete wears the portal's look** (a trash icon
  and red words at body weight, 2026-10-09).
- **A create form keeps "Cancel" beside its button; a window's head and foot are pinned** (2026-10-09).
- **One toolbar in every view; rare tools behind Tools** (2026-10-01). **Export is one button, above what it exports**
  (2026-10-01, 2026-10-09).
- **Form selects are dropdowns; mark required, not optional.**
- **Control height:** 34px on a computer (2026-10-03); the admin's 38px height exception at touch widths (K-18) never
  excuses width.
- **One Venue field** (Club Stage 6, Ask 13): the venue, then the sport's word for the surface (Diamond, Court, Field).
  Built; drawn as built, tagged "shared, Club Stage 6".

## Verify before drawing

**A starting map (read from the code 2026-10-10; re-read each line before you rely on it).** `[o]` below means
`app/[orgSlug]/admin`.

- **Two wizards that disagree (F25).**
  - **First run:** `[o]/onboarding/page.tsx` (about 2,700 lines; a League path too).
    - Steps: qualifying ("how many tournaments a year"), tournament, divisions, welcome, venues, review.
    - **Its venues step asks "How many" (1–30) and the surface type, so Diamond 1…N are created.** It also asks
      Country.
    - It asks no fees, has no reuse step and no live preview.
  - **New tournament:** `components/admin/TournamentSetupWizard.tsx` (about 1,800 lines).
    - Steps: tournament, divisions, welcome, venues, review.
    - A "Start blank, or reuse" choice first when past events exist, leading to Stage 4's reuse step (full screen at
      640 and below; doors through `SetupWizardOpener`).
    - A live phone-frame preview (`TournamentCreationPreview`, shown only at 1280 and wider).
    - **Its venues step asks a street address only (no count, no surface type, no Country).** It saves **one lane named
      after the venue, of type "other"**: F25 exactly.
  - Both use `TournamentStyleCards` (Round robin + playoffs, bracket, **Exhibition**).
  - **There is no layout-sweep id for the New tournament or reuse wizard** (only `admin-onboarding`). Record it: the
    build adds one.
- **The wizard's venue search (S6-04):** it calls `/api/admin/venues?scope=org`, which returns every tournament's venue
  copies across the org (duplicates included, no facilities). Picking one copies name, address and notes only, dropping
  the library link and the facilities. **The club's Venue library (`org_venues`) can't be reached from either
  wizard**; only Venues & Facilities' Import door reaches it (League and Club only, `hasOrgVenueLibrary`).
- **Event settings:** `[o]/tournaments/settings/event/page.tsx` (about 2,000 lines).
  - Seven closed cards: Tournament Overview (with the **Draft / Active / Completed switch**, P5), Registration Questions,
    Roster Requirements, Fees & Payments (the Fee model's four buttons, spilling at 360), Contact, Coach Emails, and
    Schedule Rules (format, game timing, travel buffers, tie-breakers, score finalization).
  - It autosaves about a second after a change, with a "Saving… / Saved" note **at the page's foot**. The 2026-09-24
    autosave ruling says a transient floating "Saved": a delta.
  - The slug and the org address each have their own Update confirm. A status change asks first.
  - Its header still carries `legacy=`.
- **Divisions** (`[o]/tournaments/divisions/page.tsx`):
  - An Add/Edit window that also holds per-division fees, timing and tie-breakers.
  - Validation through the browser's `alert()`.
  - Twin Edit / Delete icons on every card (35×25); "Full" and "Closed" in the danger colour.
  - Delete is refused when the division has games, with a force option.
- **Venues & Facilities** (`[o]/tournaments/venues/page.tsx`):
  - Game counts on each venue; "Import from Library" (gated; `?import=library` deep-links it).
  - Add / edit through `components/admin/AddVenueModal.tsx`, which **sends no field count**.
  - Facilities edited inline at a desk and in a window on a phone.
  - **An in-use guard exists** (refused if games were played, a warning if some are upcoming). An Export menu.
- **"Rules" is the rulebook, not the schedule rules.** `[o]/tournaments/rules/RulesAdmin.tsx` holds the rulebook and
  downloads. It saves per section, with a leave guard, a three-way leave dialog, and `alert()` on failure. **Game timing
  and tie-breakers live in Event settings' Schedule Rules and the division window.**
- **Public site** (`[o]/tournaments/branding/page.tsx`):
  - Public Pages toggles on every plan; logo, app icon and colours locked to Tournament Plus.
  - **One "Save Changes" at the bottom** (F29: 1,255px down on a phone).
  - **No link to the site it edits.** The organizer's preview exists separately (`[o]/tournaments/preview/…`), which
    is where Q 4.1's door goes while the event is a draft.
- **The settings screens:**
  - The settings hub (three cards; `legacy=` header).
  - Registration questions (Tournament Plus): Move up / Move down / Save / Archive on every question, Archive through
    the browser's `confirm()`, two `legacy=` headers.
  - Notifications: switches that save at once; a `legacy=` header.
  - Members, audit, PDF and subscription are the org's own pages, re-exported.
- **The before-event board** (`[o]/tournaments/dashboard/page.tsx`, about 2,300 lines). A draft shows the checklist
  board; an active event with no game today, the guidance rail; game day, Stage 1's board; a completed event, Stage 4's.
  - The "Draft Launch Checklist" has two required items (dates, divisions), then optional items in three tiers behind a
    toggle ("Schedule, venues, tie-breakers & more — n of m reviewed").
  - The guidance card is `components/admin/tournament/GuidanceRail.tsx` with `lib/tournament-guidance.ts`. The persona
    panel shows on a draft only.
  - **"Copy into this draft" (F33)** appears when other events exist and the draft has no divisions. It opens the
    **populate-from window**: pick an event, then "Replace this draft setup with …?" as a danger button.
  - **F55:** "Set up fees →" goes to the Tournaments list, not to Fees & Payments.
- **What each copy path keeps (6a's F2):**
  - **Clone** (Reuse this setup) keeps each venue's library link but **copies no facilities** (the code's own comment
    says "recorded for Tournament Stage 5").
  - **Populate-from** (copy into this draft) copies venues **and** facilities with both links.
  - **Import-from-org** (the library door) copies both and returns the existing copy on a second import.
  - **Import-from-past** exists as a route with **no screen calling it**: retire it or give it a door (Ask 5).
- **The shared Venue field** (`components/venue/WhereField.tsx`) is on Stage 3's game window and move sheet, house
  league, the coach's event form and the tryout day. **Not on either wizard, Venues & Facilities or `AddVenueModal`.**
- **The old look:** every setup file above is on the old-look baseline (Event settings, Divisions, Venues, Rules, Public
  site, the dashboard, Registration questions, Notifications and the settings hub), several with `legacy=` headers and
  large kit-scope stylesheets. Communications, Summary, the creation preview and `AddVenueModal` are not on it.
- **The phone:**
  - Event settings' seven cards fit 602px, but the Fee model spills at 360.
  - Divisions' icons are 35×25; Rules' buttons 36×26; Venues' export 32×32.
  - Public site's Save is 1,255px down.
  - Registration questions' controls are 36×27; notification switches 36×20.
  - Plan & billing is 2,436px long.
- **Layout sweep ids:** `admin-t-dashboard`, `-branding`, `-divisions`, `-rules`, `-venues`, `-manage`, `-settings`,
  `-settings-event`, `-settings-fields`, `-settings-notifications`, `-settings-audit`, `-settings-pdf`,
  `-settings-subscription`, `-settings-subscription-panel`, `-settings-members`, `admin-t-preview`, `admin-onboarding`,
  `admin-club-setup`.
- **The demo tour** has no anchor on any setup screen (its dashboard anchors are on the live and game-day boards).

- **F25–F31, F26's after-event half, F33, F55 and every J1 setup row.** Tag each on the hub: open, fixed (with its
  commit) or partly. Draw only what is open.
- **Every way a tournament comes into being:** the first-run setup, the New tournament wizard, Reuse this setup (Stage 4's
  one flow), the draft board's copy-into-this-draft, import-from-past and populate-from. For each: the questions it asks,
  what it copies, and what it drops.
- **The save model of every setup screen** (F30), read from the code, not the plan.
- **Plan gating (A6):** what a free Tournament organizer meets on each setup screen, and how a lock is said (F38's bare
  padlock is the anti-pattern).
- **The Exhibition format** in both creation paths and in Event settings: what it removes (playoffs, the bracket) and
  whether every screen agrees.

## What Stage 5 draws (desk first; every screen also at 390)

1. **One set of creation questions (F25).** The first-run setup and the New tournament wizard ask the same questions,
   including venues with their diamonds, through the one Venue field and the club's Venue library where the plan has
   one. Draw the path for a free organizer, a Tournament Plus organizer and a club.
2. **The before-event board (A18):** the setup checklist and the guidance card, the draft board, "copy into this draft"
   (F33), and the doors that go to the wrong place today (F55's "Set up fees →").
3. **Event settings (F27; Q 2.1: it stays, and it is the model):** what the other setup screens copy from it, whether its
   status switch stays (P5), the Fee model as a dropdown on a phone (Q 2.1, F27's spill at 360), and its "Saved" as the
   transient floating pill.
4. **Divisions (F28):** "FULL" said in words, not red; Delete as the rare door at a division's end; no browser alert box.
5. **Venues & Facilities:** "Import from library" (Club and League), the venue and its facilities as a record that
   reads first, the in-use guard, and what a clone keeps (6a's F2). The tournament's venue copy keeps its link to the
   library.
6. **The rulebook (Rules & Resources) and the remaining settings screens** (registration questions, notifications, the
   settings hub): one save model per kind of screen (F30, Ask 4), the small controls (F31), and no browser `alert()` or
   `confirm()`. Game timing and tie-breakers are Event settings' (Schedule Rules) and the division window's; draw them
   there.
7. **Public site (F29; Q 4.1):** "See your public site" (the preview while a draft, the live page after), and a save that
   follows the settings model instead of one Save at the bottom.
8. **The live board's header**, where its help "?" sits (Stage 4 left it here).

**Not drawn. List these on the hub as the build's work:**
- the old look's retirement in every file Stage 5 rebuilds, held by `npm run check:old-look` and the strict admin colour
  gate;
- the wizard's venue search reading the Venue library (S6-04), and the clone paths keeping facilities and the library
  link (6a's F2), if Asks 1 and 5 rule them;
- the setup wizard leaving the 6a guard's "asks where" not-yet list;
- a layout-sweep id for the New tournament and reuse wizard (none exists today);
- Event settings' foot "Saving… / Saved" note replaced by the transient floating pill (the 2026-09-24 ruling);
- **the project's close-out**: the final walk, the plan and brief archived, the follow-ups as one TODO group.

**Out of scope here:** the schedule (Stage 3, built); game day and Results (Stage 1); Teams and Communications (Stage 2,
except a settings screen it doesn't own); the volunteers (Stage 6); "Add my team" and tournament fees in a club's ledger
(Club Tier Stage 7); the public pages themselves (a door only); the Venue library's own screens (Club 6b's).

## Method (Stage 4's and Stage 6's)

1. **Measure before you draw.**
   - Put the probe in `.probe/`, never in `test-results/`.
   - Use the organizer accounts on the Plus and the free test clubs (`uat-plus-org`, `uat-test-org`) and the club
     fixture (`uat-rep-club`, which has a Venue library since 6a's `--club-venues`).
   - Measure at 1440×900, 768×1024, 390×844 and 360×780, in Warm and Dark, reading numbers from the browser's
     geometry.
   - Record: taps and screens from "New tournament" to a draft that is ready to open registration, on both creation
     paths and on Reuse; questions asked by each path; every control under 38px at touch widths and every sideways
     spill; each screen's save model.
   - ⚠ **Probes write nothing.** Refuse every non-GET. Creating a tournament is a write: walk a creation path to its
     last screen without finishing it, or finish it only on the owner's word and remove what it made, then read the
     removal back. **Mind the one-slot plans:** a probe that creates an event on the free club takes its only slot.
   - **Seed, move or add nothing without asking.** Where real data is missing, draw the "before" from the code and say
     so on the drawing.
2. **Draw on a new "Stage 5" tab.**
   - True size: the whole screen before (today's captures) and after.
   - Every flag and fix chip is clickable, with its `data-here` sentence.
   - Every element is tagged NEW, RESTYLED or UNCHANGED, with its own note; the club's shared parts are tagged "shared,
     Club Stage 6".
   - Put the 44px block beside every phone frame.
3. **Run the formatting check before the owner sees anything.** Put it on the tab's last section.
4. **Write the asks.** Each one gets options, a recommendation, the tradeoff, and a checkbox per option on the
   paste-back.
5. **Taps to beat.** Record today's and the drawing's for:
   - a first tournament, from sign-up to a draft ready to open registration;
   - next year's tournament from last year's (Reuse);
   - adding a venue with three diamonds;
   - changing the game length;
   - opening the public site from its editor.

## The asks (each with a recommendation; Decisions rows, `open`)

1. **The one question set (F25; Q 1.1 ruled "both wizards ask the same").** What remains is its shape. Recommended:
   - one question set in one frame for the first run and New tournament, with Reuse (Stage 4's step) as the other way
     in;
   - venues asked with their count and surface (Diamond 1…N, Q 1.1), through the one Venue field;
   - the club's Venue library offered first where the plan has one, and other tournaments' copies never;
   - fees still optional (owner, 2026-06-16).

   Say what the first run keeps that New tournament doesn't need (the qualifying question), and whether the live
   preview belongs to both.
2. **The before-event board (A18).** Recommended:
   - one checklist, the required steps first and the rest quiet;
   - every item a door to the screen that does it, so "Set up fees →" opens Fees & Payments (F55);
   - the guidance card saying the one next step;
   - "copy into this draft" folded into Stage 4's one reuse flow, never a danger-button "Replace this draft setup?"
     (F33: one way to do one thing).
3. **The status switch (P5).** Recommended: Event Settings loses its own Draft / Active / Completed switch, and the
   event's status changes only through its record's sentences (one home, built in Stage 4). Ask; don't assume.
4. **Where Q 3.1 meets the record standard (F30).** Q 3.1 ruled one save model (autosave) and Delete inside each
   record's editor, before 2026-10-01's "a record reads first and edits whole" and 2026-10-09's "a rare door ends the
   body". Recommended reconciliation:
   - a division or a venue reads first, its pencil opens it, and what you change inside then autosaves (Q 3.1 and
     2026-09-24 together; nothing here tells families, so no held save);
   - Delete ends the record's body (Q 3.1 and 2026-10-09 agree);
   - a settings card autosaves like Event settings (Q 2.1), with the transient floating "Saved";
   - creating anything asks;
   - the rulebook's per-section Save and three-way leave dialog become the card model.

   Draw a division both ways for one frame so the owner sees the choice.
5. **Venues, the library and the copy paths.** Recommended:
   - every way a venue arrives keeps its library link and every facility: the clone too (6a's F2), and the wizard's
     search reading the library (S6-04);
   - `AddVenueModal` asks the count and surface like the first run;
   - the unused import-from-past route is retired, because Reuse covers it.
6. **Divisions (F28; Q 3.1 "Full reads as good news").** Recommended: "Full" as a plain word on the row, Edit by opening
   the row, Delete as the rare door at the record's end, inline messages instead of the browser's alert box, and the
   force-delete of a division with games said in words.
7. **Public site (F29; Q 4.1 ruled the door).** Recommended: "See your public site" in the header (the preview while a
   draft, the live page after), the editor following the settings model (Q 2.1: autosave, no bottom Save), and the theme
   preview showing the real page.
8. **The small controls (F31) and the phone.** Recommended: the setup screens stay desk first, and wherever a phone reaches
   them, the admin's 38px height and full width for the daily job.
9. **The one-slot path (A23, ruled 2026-10-10: one at a time).** Draw what a free organizer meets when last year's event
   is Completed (it no longer holds the slot, so next year starts without archiving it), and while it is still live
   (refused, in words that say why). List the live sentences that change with it.
10. **The live board's header.** Recommended: its help "?" where every other board has it.
11. **Anything the measuring finds** that F25–F31 and J1 miss. Say so; don't force-fit it.

## Working beside the other sessions

- **Club Tier 6c's drawing** may run at the same time. It publishes the club hub, never this one, and draws calendars,
  not setup screens. Read the club hub; **never publish it**. A change you want to the Venue library or the Venue field
  is an ask on the Club project, tagged "shared, Club Stage 6", not a drawing here.
- **One browser tester at a time.** Before any probe, capture or `auth-setup`, ask the owner whether another session is
  measuring. A second runner rotates the shared UAT sessions and signs the other one out mid-run. **Never reset a test
  club** without asking.
- **A new shared pattern is an ask, not an invention.** The sheets have one frame, rows have one recipe, the Venue field
  is Club Stage 6's. A change to any of them is drawn as an ask tagged "shared".
- **No code, no help, no gates.** Your files:
  - this project's hub: the Stage 5 tab, and its FINDINGS / INTENTS / Decisions additions;
  - the plan's §5 row 5 and a §6-style Stage 5 section (`§6e`);
  - the PM brief, your TODO line, and memory.

  Read the hub fresh before every edit. **Parse its scripts before every publish**, because one bad apostrophe kills
  every tab. Never `force` a refused publish.
- **Git:** use a private index and explicit pathspecs. Build a shared file as HEAD plus your own hunks, and re-read HEAD
  immediately before committing. After committing, run `git reset -q -- <paths>` on the shared index. Commit only when
  the owner says.

## Hand-off

- Write in product-owner voice.
- Lead with what a first-time organizer sees and does differently, from sign-up to a draft ready to open registration,
  and what a returning organizer sees when next year starts from last year.
- Give the measured "before" and the drawn "after" (taps, questions asked, the first screen).
- **Tell the owner to open the hub on a phone.**
- Put the asks as numbered questions with a recommendation each.
- Offer `/design` for a review pass if the session has budget.
- **Don't write the Stage 5 build prompt until Stage 5 is ruled.** Its definition of done will include:
  - the old-look retirement;
  - the creation paths asking one question set;
  - the clone paths keeping facilities and the library link;
  - the wizard off the 6a guard's not-yet list;
  - the demo's tour anchors kept, each with its home named;
  - the project's close-out.

## Do not

- Build anything, or change routes, gates, seeds, help or copy files.
- Change a price, a plan name, a gate or what a plan includes. A one-slot or fee question is `/strategy`'s; draw the
  placement and tag it.
- Redraw the Venue library or the Venue field (Club Stage 6 built them), the schedule (Stage 3), the admin frame or
  navigation, or the public pages (a door only).
- Write customer copy. Draw the placement and tag it `/marketing`.
- Remove a demo tour anchor without naming its new home.
- Mint a second artifact. The hub is the only one.
