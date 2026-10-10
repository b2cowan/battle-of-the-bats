# Tournament admin redesign · Stage 5 build: create and set up, built to hub v45 — the redesign's last build

> Paste into a fresh session on `dev`.
>
> **Run AFTER Stage 3's build** (the schedule; committed 2026-10-10, `c554fde8` and the commits beside it). This stage
> adds an import to the schedule's Tools menu and restyles screens that share its header. Check `git log` shows Stage 3's
> Part 7 and its `/simplify` + `/review` commit (`e1d40e40`). If it isn't committed, stop and tell the owner.
>
> Written 2026-10-10, the day the owner ruled Stage 5 from the hub's paste-back and in the session after it:
> - **E1–E7 as drawn, A47–A58 as recommended.** One note, on A56: the "?" is the other portals' one format — the bare
>   glyph, the same size, no box or circle around it (the drawings were fixed the same day).
> - **The `/design` review's eleven changes**, all applied to the drawing on the owner's word ("All 11"): desk drawings at
>   true size first.
> - **The A57 addendum**, drawn and ruled: **E10 — Data tools retires** (the owner's own question: each import lives
>   with its data) · **E11 — Chat gets its title** · A59 retire it · A60 Chat's free-plan wall as today.
> - **F92 (owner, on the drawing):** no fees set up means the payments aren't tracked here — never "free".
> - **A23 (owner, at the session's start, logged by `/strategy`): one tournament at a time.** On the one-slot plans a
>   finished event no longer holds the slot. Decided, not built: **this build builds it** (Part 0).
>
> **This is the redesign's last build.** When it is built and walked, every tournament screen has been redrawn, and the
> project closes (the Close-out section). Nothing left unbuilt here has a later stage to land in: put it in the
> close-out's one TODO group, by name.
>
> **The spec is the hub:** https://claude.ai/artifact/HQoRuEsKd7i6cAvCrMNzgM → the **Stage 5** tab (v45 or later), read
> one part at a time from its bar (Overview · E1 Create · E2 Board · E3 Event settings · E4 Divisions · E5 Venues · E6
> Rules & settings · E7 Public site · E9 One slot · E10 Imports & Chat · Asks · Formatting check · Not drawn).
> - Build **to the drawings, exactly** (memory `feedback_build_to_approved_mockups`), at **true size** at a desk and at
>   390. Every NEW / RESTYLED / UNCHANGED tag note is a requirement; open each one.
> - **"Shared, Club Stage 6"** tags are built as built: the one Venue field (`components/venue/WhereField.tsx`), the
>   Venue library's reading and the four things adding a venue asks. A change wanted there is a Club ask, not a build here.
> - **"Free tier review" tags are NOT redesigned.** A free tournament tier review (`FREE_TOURNAMENT_TIER_REVIEW_PLAN.md`,
>   queued) owns every free-plan lock. Leave what a free organizer sees exactly as today. The one exception is a lock
>   whose DOOR this build moves (the imports, Part 8): the lock moves with its door, in Stage 3's Tools-lock words (A44).
>   **List every free-plan lock you meet** for that project (the Overview's A6 table is the start).
> - The **Formatting check** part is your checklist, every row, the second reviewer's and the `/design` review's included.
> - Where you must depart, say so at build time and record why. Never depart silently.
> - The rulings' **unchosen options** are not built:
>   - E1 keep the welcome step / two wizards kept
>   - E2 the guidance card on the draft / the draft's board only
>   - E3 the Fee model a dropdown on a phone only / keep the status switch
>   - E4 record B (straight into the form) / today's cards recoloured
>   - E5 today's fold-open rows
>   - E6 Rules keeps a per-section Save
>   - E7 the header pill on phones instead / keep one Save for branding
>   - A51 retire import-from-past / a separate Import from Library button
>   - A55 a finished event's name may repeat / the refusal naming Archive
>   - A56 the boards only
>   - A57 name them as follow-ups / Data tools only
>   - A58 route everything
>   - A59 keep Data tools, imports only
>   - A60 a lock line for Chat now
>
> **Read first:**
> - **Plan** `TOURNAMENT_ADMIN_REDESIGN_PLAN.md`: §3 "Create and set up" (F25–F31 re-measured, **F77–F92**), **§6e** (E1–E9,
>   the asks, the ruling, the `/design` review, the addendum, "Not drawn", the taps), §7, §9.
> - **`docs/agents/strategy/BUSINESS_DECISIONS.md`**, the 2026-10-10 entry (A23, one at a time: what it changes, its
>   follow-through, the name-and-link finding) and `PLAN_PRICING_FACTS.md`'s one-slot line.
> - **The in-repo `memory/design_decisions.md`**, the 2026-10-10 entries: *an import lives with its data* · *setup screens:
>   one creation window, records that read first, one checklist, the portal's bare "?"* · *no fees set up means "not
>   tracked here", never "free"* · and Club 6c's *one calendar: the recipe* (C4: a rare door lives in the create button's
>   menu or in Tools). `TABLE_AND_LIST_STANDARD.md` §11.
> - **`CLUB_TIER_PRODUCTION_READINESS_PLAN.md` §6 Stage 6**: 6a's record (the copy paths after 6a; F2 the clone copies no
>   facilities) and 6b's (the Venue library window this stage's venue record copies).
> - **Memory:** `project_tournament_admin_redesign`, `feedback_build_to_approved_mockups`,
>   `feedback_portal_is_the_formatting_benchmark`, `decision_record_reads_first_edits_whole`,
>   `decision_edit_autosaves_create_asks`, `decision_autosave_word_is_transient`, `decision_rare_door_ends_body`,
>   `decision_one_toolbar_rare_tools_behind_tools`, `decision_export_is_one_button`, `decision_close_x_is_plain_glyph`,
>   `feedback_form_selects_are_dropdowns`, `decision_drawer_layers_form_vs_menu`, `feedback_shared_component_over_shared_class`,
>   `project_club_stage6_venues`, `reference_code_gotchas_index` (dates and clocks: `formatStoredDate` / `formatTime` only).
> - **Models already built — never a second one:** the kit's record window (`KitDialog` with its `edit` prop and named
>   Previous / Next, Stage 2's team record, Stage 4's event record `TournamentRecord.tsx`), the row recipe (`ClubRow*` in
>   `components/admin/kit/club/RepKit.tsx`), `SavePill` / `NoticePill`, `RecordDelete`, `Callout`, the Sheet Frame, the
>   reuse step and its opener (`SetupWizardProvider`, `SetupWizardOpener`), the help trigger (`HelpButton iconOnly`), and
>   **the coach budget's import sheet** (`components/coaches/BudgetImportSheet.tsx`) as the import's shape.

## Preconditions (check before code)

1. **Stage 3's build is committed** (above). The dev server works: don't fix another session's code; start it only with
   `npm run dev`, with network access.
2. **Two placements go to the owner at the start** (one question each, with the recommendation):
   - **P1 · Teams' import door.** The drawing puts *Import teams from a spreadsheet* in Teams' one Export menu (the
     menu already holds an import row, today labelled "Data tools"). Club 6c's calendar recipe, ratified the same day,
     says a rare door like Import lives **in the create button's menu or in Tools** — the schedule's import (Tools) obeys
     it; Teams' Export-menu row is a third home. **Recommend: Teams' Tools** (it already holds Select many, Swap,
     Randomize, Registration questions), so every import door in the product is a Tools or create-menu row and the
     Export menu only exports. Tradeoff: the drawing as ruled put it in Export, beside the file it mirrors.
   - **P2 · Venues already named the old way.** The first run made lanes called "Lions Park — Diamond 1" (F77) and the
     New tournament wizard one lane named after the park. **Recommend: leave stored names as they are** (an organizer
     can rename them on the venue's record; production holds few such copies); only new venues get "Diamond 1…N".
     Tradeoff: an old event's schedule keeps the doubled name.
3. **`/marketing` confirms the words before you build them.** The placements are ruled; the words are `/marketing`'s.
   Run it once, on this list:
   - the wizard's three steps and review (step names, *Your venues*, *A new venue*, *How many* / *Of what*, the line
     naming the diamonds, *Post a welcome message*, *Create the draft*), the name suggestion (*Your 2026 event has this
     name. Use "… 2027"*), *Start from a past tournament* / *Bring it in*;
   - the draft's checklist (*Before you activate*, *Who teams can write to*, *The rest, when you're ready*, every row's
     state line — **"Not set up — payments aren't tracked here", never "free"** (F92)), *Ready to activate*, the
     preview door card;
   - the weeks-before board (the guidance note, each card's head figure and row lines, Payments' two sentences);
   - Event settings: the status line and *Change*, the Fee model's fourth choice (**today "Free"** → the fees aren't
     tracked here, its summary and its line), the divisions-that-set-their-own line, and **the two untrue activation
     sentences** (J1-032);
   - Divisions: *full*, the record's sections, the one delete question and its button (*Delete U11 Girls, its 4 games
     and 8 teams*);
   - Venues: the record's library line, the in-use line, *Add a venue*, *A venue that isn't the club's*, the repeat
     import line;
   - Rules, Registration questions (Reorder), Notifications (the event names), the settings hub;
   - Public site: *See your public site* (Preview / Live);
   - the one-slot sentences (E9's table: the slot line, the refusal, the finished board's sentence, the archive
     question, Mark complete's question on a one-slot plan);
   - the import sheet (*Import teams* / *Import games from a spreadsheet*, the template choices, the preview's verbs, the
     blocked line, *Apply N rows*, *N earlier imports*);
   - Chat's title band.
4. **Ask the owner whether another session is measuring** before any probe, `auth-setup` or sweep. One browser tester at
   a time; scope sweeps with `--only=`.
5. **A draft fixture.** No test club holds a draft, so the draft board can't be probed or swept. Ask the owner, then ask
   `/uat` to add one throwaway draft to the Plus test club's fixture (seeded, never by hand). Without the owner's word,
   probe the draft board by rewriting the dashboard's read in the probe only and say so.
6. **The UX summary for the owner comes first** (AGENCY_RULES), short: a first tournament from sign-up to a draft ready
   to open registration; next year on Tournament Plus and on the free plan; setting up at a desk; what goes (Data tools).
7. **Consequences to say in the summary (not questions):**
   - **A23:** a free organizer's finished event stays online while next year is set up; **Reopen** and **Move back to
     draft** of a finished event are refused while another event holds the slot; **Bring back** no longer needs a slot.
   - **A59:** Data tools' page and rail row go; its address opens Teams. Its help article moves.
   - **A56:** every board and setup screen gains the bare "?" (the layout sweep's tap floor applies at touch widths).
   - **F92:** the Fee model's "Free" stops saying teams aren't charged.

## ⚠ Running beside other work (as of 2026-10-10)

- **Club Tier 6c** (one calendar) has its build prompt (`CLUB_TIER_STAGE6C_BUILD_PROMPT.md`) and may be building. Its
  handover to this redesign (plan §6c "Findings handed over by Club Tier Stage 6c") touches the **schedule**, not Stage
  5's screens; don't take it on here. Shared with it: the kit, the toolbar's C4 rule, the dev server, the UAT sessions.
- **Queued after this build:** the free tournament tier review and the platform admin support console. Don't start them.
- **Club Stage 6's parts** (`WhereField`, `lib/venue-*`, the 6a guard `tests/unit/club-stage6a-guard.test.ts`): wear
  them; the guard's not-yet list only shrinks — the setup wizard leaves it in Part 1.

Five rules, Stage 2's:
1. **Neither session edits the other's files.** If a shared file has someone else's uncommitted edits, stop and tell the
   owner. Typecheck your commit's own tree in an isolated copy (`git archive` of the staged tree, `node_modules`
   junctioned in) when the whole tree is red from other work.
2. **`check:old-look --init` reads the whole tree.** `git status` the baseline's other files first; if another session
   has any modified, run `--init` in the isolated copy and commit only your lines.
3. **Stay off the dev server during another session's captures or sweeps.**
4. **Stage by explicit pathspecs from a private index**; commit only your hunks of shared docs.
5. **Take the next free Owner QA Ledger §** when you write a walk, after re-reading the ledger.

## Fixtures, and what never gets written

- **The Plus test club's Championship** (June, active, its first game played → "Game day" in the header) draws Event
  settings, Divisions (U11 Girls 6 of 6 + 2 waitlisted, U13 Boys 8 of 8, U15 Open 4 of 4), Rules, Registration
  questions, Notifications and Public site. Its venues are the old habit (one lane each, F87).
- **The club fixture** (`uat-rep-club`): the Venue library (Lions Park Diamond 1–3, Kinsmen Park Diamond A–B, Westfield
  School none) and an active invitational with no venue — the library import and the club's wizard step.
- **The free club** holds two live events on a one-slot plan (an old fixture): it proves the refusals. A one-at-a-time
  probe needs a finished event on a one-slot plan: rewrite the read in the probe only, or ask the owner.
- **The demo** (`riverdale-minor-ball`): the Invitational, 21 days out, is the weeks-before board — and today holds
  Riverdale Community Park with **zero diamonds** (copied from the Season Opener before the clone kept them). The demo
  re-seeds itself on the master build; don't re-seed it.
- **Probes write nothing** (refuse every non-GET). Creating a tournament, an import's Apply, a status change or a delete
  happens only on the owner's word, then is undone and read back. **Dev email is live.**

## Retire the old look as you rebuild (definition of done)

Every file this stage rebuilds loses its old look in the same build, by Stage 1's method:
- fold `kx()`;
- drop `useAdminKit()` false branches and `legacy` props;
- fold `[data-admin-kit] .x` rules one at a time, with the kit-shadow and background-shorthand audits;
- keep every `:where(:not([data-public-preview] *))` guard.

`npm run check:old-look:report` on 2026-10-10:

| Group (rename the dashboard's to Stage 5 in `scripts/lib/admin-old-look.mjs`) | Files | Old look |
|---|---|---|
| Stage 4 — the dashboard before and after the event (its before-event share is Stage 5's, A18) | `dashboard.module.css` (192: ≈58 draft, ≈91 weeks-before panels, 34 customize, 8 dead stat cards, 1 shared), `dashboard/page.tsx` (kx 23), `LiveEventLog.tsx` (kx 6), `GuidanceRail.module.css` (26), `PersonaPanel.module.css` (12) | kx 29 · kitScope 230 |
| Stage 5 — the creation wizards | `TournamentSetupWizard.module.css` (59), `.tsx` (kx 4), `TournamentStyleCards.module.css` (5) | kx 4 · kitScope 64 |
| Stage 5 — the first-run setup | `onboarding.module.css` (80), `onboarding/page.tsx` (useAdminKit 1) | kitScope 80 |
| Stage 5 — the settings screens | the hub, `event/page.tsx` (kx 22), notifications (28), registration-fields (kx 9), 5 `legacy` props | kx 31 · kitScope 34 |
| Stage 5 — Divisions | `admin-page.module.css` (22), `page.tsx` (kx 21) | kx 21 · kitScope 22 |
| Stage 5 — Venues | `venues/page.tsx` (kx 8) | kx 8 |
| Stage 5 — Rules | `rules-kit.module.css` (75), `RulesAdmin.tsx` (kx 6), `TieBreakerEditor.module.css` (18) | kx 6 · kitScope 93 |
| Stage 5 — Public site | `branding.module.css` (71), `page.tsx` (kx 2) | kx 2 · kitScope 71 |
| Chat (no stage named it — now this one, A57) | `chat/page.tsx` (kx 2), `chat-admin` (2), `ChatManagePanel` (24), `ChatRoomsPanel` (15), `NewRoomDialog` (21) | kx 2 · kitScope 62 |
| Data tools | deleted with the page (A59) | — |

Lock in every drop with `--init` in the same commit (rule 2).
- **Never fold** `globals.css`'s kit layer, `ExportMenu`, `CollapsibleCard`, `admin-common.module.css`, the shared
  tournament header and toolbar in `components/admin/tournament/`, or the shared helpers (`useKitStyle`, `kitStyler`,
  `useKitButtons`, `useKitAsterisk`). **`branding.module.css` is also Event settings' and Registration questions'
  stylesheet** (both import it): fold its rules only with all three proven.
- **`TieBreakerEditor` is shared** (Event settings, a division's record): fold it with both proven.
- Report what was retired and anything left.

## What to build (all ruled 2026-10-10)

Commits, one per part. **Part 0 first, on its own** (a packaging rule, shared with billing).

### Part 0 · One tournament at a time (A23): its own commit, with `/billing`

The handoffs are in the 2026-10-10 decisions entry. Run `/billing` for this part.
- **The rule, one home:** a slot is held by a **Draft or Active** event (today: anything not archived). Write it once
  (beside `lib/tournament-status-words.ts`'s slot words) and read it at **every** limit check:
  - New tournament (`api/admin/setup-tournament`) and the clone route;
  - the status-change route (`api/admin/tournaments`, `set-status`): **Reopen** and **Move back to draft** of a finished
    event need a free slot; **Bring back** (archived → completed) no longer does;
  - the billing downgrade's keep/archive step (`api/billing/downgrade/confirm`): only Draft and Active events beyond the
    limit are archived — never a finished one;
  - the Tournaments list's slot line and the coach portal's hosted-tournament limit (`hosted-tournaments`).
- **The words** (`/marketing`, E9's table): the slot line, the refusal (names the live or draft event that holds it,
  "mark it complete when it's done"), the finished board's one-slot sentence, the archive question's slot clause, Mark
  complete's question on a one-slot plan.
- **Unchanged:** `lib/plan-config.ts`'s `tournamentLimit` (1), prices, plan names, feature keys. True the Facts doc's
  one-slot line to "built" in the same commit; run its drift check.
- **Tests:** every limit check counts Draft and Active only; Reopen refused at the limit; Bring back allowed; the
  downgrade keeps finished events.

### Part 1 · One set of creation questions (E1, A47, A51's wizard half, A55; F77–F79, F83, F84, F91)

- **One window for both doors.** The first run (`[o]/onboarding`) opens the New tournament window after the plan page;
  the wizard is the kit's form window — full screen with ← on a phone (Stage 4 made only the reuse step so), a 640
  window at a desk with the live preview beside it at 1280+ (unchanged). ← leaves (asking first once anything is typed,
  Stage 4's "Leave setup?"); the foot's Back steps back; a create form keeps Cancel on step 1.
- **Three steps and a review:** the tournament (name, dates, style, link — each marked required) · divisions (each a
  labelled card on a phone, J1-031; "divisions or divisions" fixed, J1-038) · venues · review (rows that are doors back
  to their step; the welcome message a switch with its text). The "how many tournaments a year" step leaves the flow
  (F91; it is stored and read by nothing) and with it J1-019's Plus offer to a free chooser. Fees not asked.
- **The style saved with the tournament** (F78): `setup-tournament` takes the format; the swallowed second call goes.
- **Venues: one ticked list, for everyone** (the `/design` review): the club's Venue library for a plan that has one
  (`hasOrgVenueLibrary`), never other tournaments' copies; **"Your venues"** for everyone else — each venue a past event
  used, **once** (name + address, the newest copy), **with its facilities**, through the import-from-past route (its
  first door; `GET /api/admin/venues?scope=past` exists unused). The field above narrows the list; *A new venue* opens
  the sheet with the four things (Name · Address one line · How many + the sport's word · Note). The raw `scope=org`
  search retires (S6-04's wizard half). The wizard takes `WhereField`'s list shape and leaves the 6a guard's not-yet list.
- **Facilities named "Diamond 1…N"** in the tournament's sport word (F77), at every way a venue is added — the venue
  route's `save` names them so (never "Venue — Diamond N"; a count of one is "Diamond 1"). P2 decides existing names.
- **The name and link under one at a time** (A55): as the name is typed, a finished event that holds it is named in an
  amber line under the field with the year-bumped name to take in one tap; the link follows. Uniqueness unchanged.
- **The limit before the door** (F83): every New tournament door — the rail's +, the list, **`?create=1`** — checks
  the slot first and shows the refusal (Part 0's words); the wizard never opens to fail at its last step.
- **The clone** (F84): the server refuses a duplicate live name and a start date before today, as New tournament does.
  **It copies facilities with both library links** (6a's F2; the `lib/db.ts` comment "recorded for Tournament Stage 5").
- **On the Tournament plan** the "Start blank, or reuse" step stays as today (free tier review).
- **A layout-sweep id** for the New tournament window and the reuse step (none exists).

### Part 2 · The board before the event (E2, A48, A56; F80–F82, F85)

- **The draft's board:** one card *Before you activate* — required rows first (dates, a division, **who teams can
  write to**), then *The rest, when you're ready* (venues, fees, schedule, rules, game timing and tie-breakers, public
  site), every row a door to the exact place (`?section=` for Event settings' cards; Teams for registration, not
  Divisions — J1-040). The board's "ready" and Activate's server check read **one rule** (F82: today the board ignores the
  contact). The guidance card, "What everyone else sees" and the reuse banner go from the draft; one preview door card.
- **Activate:** a *Ready to activate* card, the board's one lime, shown only when Activate can work; **above the
  checklist on a phone once ready**, the right-hand column at a desk. Its question is the event record's
  (`lib/tournament-status-words.ts`), with the public link and Copy.
- **Start from a past tournament** (F33, F80): a draft with no divisions offers one quiet row (Tournament Plus; the free
  plan's offer as today) opening **Stage 4's reuse step in its "into this draft" mode**: the source as a dropdown, the
  five areas as checkboxes, the draft's name, link and dates kept. **The populate route changes:** area options;
  **nothing replaced unasked** (what the draft holds in a ticked area is kept, the source's added beside it); **one step
  that finishes or leaves the draft as it was**; the `create_tournaments` capability required. It lands with the toast.
- **The weeks before:** the guidance as Stage 1's one-line note (its action a door); the five panels as kit section
  cards, each one row a door; **Payments says the true thing** (F81: "fees set, nobody due yet" vs "not set up — payments
  aren't tracked here") and opens Fees & Payments (F55). The `schedule-health` anchor stays on the Schedule card.
  *Customize this board* unchanged.
- **The bare "?" on every board** (draft, weeks before, game day; the finished board has it) and every setup screen,
  opening its own help sub-topic; the help drawer counts days as the board does.

### Part 3 · Event settings (E3, A49; F27, F92, J1-032, J1-042)

- The seven cards unchanged; on a phone each summary sits **under** its title, whole; at a desk on the right.
- **The status switch goes:** Tournament Overview says the status once in the record's sentence, *Change* opens the
  event's record.
- **The Fee model a dropdown at every width** (and *Where they appear*); its fourth choice's label, its summary and its
  line say the fees aren't tracked here (F92) — **the stored value `free` is unchanged** (an identifier, not copy).
- Which divisions set their own fee, said in the card as a door to Divisions (J1-042).
- The save word: the floating `SavePill` (today a note at the page's foot); the two untrue activation sentences fixed.

### Part 4 · Divisions (E4, A50 record A, A52; F28, F88)

- Rows on a phone ("6 of 6 · full" in the row's ink, registration in words), a table at a desk (the figure alone in the
  right-aligned Teams column, "full" with Registration); a row opens the division's record (`KitDialog`): reads first,
  the pencil edits all of it with autosave, its own fee / length / tie-breakers / contact said plainly, Previous · Next.
- **Delete ends the body and asks once**, naming what goes (*…its 4 games and 8 teams*) — the record already knows the
  counts; no "not empty" second round. **No `alert()`**: mistakes under their field, a failed save in the pill.
- Create (*Add division*) asks, with Cancel. An Exhibition's division stops speaking of playoff seeding and saves no
  playoff setting (F88).

### Part 5 · Venues & facilities (E5, A51; F87)

- Rows / a table (Venue + its library line · Address · Diamonds · Games); a row opens the **venue's record** in the Venue
  library window's shape: reads first (address + Maps, note, facilities with games, the library line and its door), the
  pencil edits the venue and its facilities in one form (rename, add, ✕ absent on a facility with played games), the
  in-use guard said before the tap, Delete at the body's end. Previous · Next in both modes.
- **Add a venue**: one window — the club's library first (checkboxes, each venue's facilities), "your venues" for plans
  without one, a new venue with its count; the separate Import from Library button goes; a repeat import says it is
  already here. `?import=library` opens this window.
- The address is one line (today's edit splits it); every facility write reports its failure (today silent).

### Part 6 · Rules & resources, Registration questions, Notifications, the settings hub (E6, A50, A54; F30, F31)

- **Rules:** sections and resources as records (read as the public sees them; the pencil edits all of it with
  autosave; Delete ends it); no per-section Save, no one-dirty-section lock, no patched browser Back, no three-way leave
  dialog, **no `alert()`** (eight today). Add a section / Add a link or file ask; samples a row; drag handles at a desk;
  the public layout choice behind Tools.
- **Registration questions:** rows; a question's record (reads first, the pencil, autosave; Archive at its end asking in
  the product — no `window.confirm`); **Reorder as a mode of the same list** (Tools → Reorder; Move up / down at 44px;
  Done). The free plan's lock as today.
- **Notifications:** 52px switch rows, the whole row the target; the floating pill on each save.
- **The settings hub:** the "?"; otherwise unchanged.

### Part 7 · Public site (E7, A53; F29, F90's page half, J1-064)

- **A door card, *See your public site*, at the top** (the organizer's preview while a draft; the live page in a new
  tab after) at every width.
- Pages first (switch rows); the six branding parts as closed cards with summaries that save themselves (`SavePill`; no
  bottom Save, no success pop-ups, no leave risk); the drawn theme mock goes; a colour can be typed as a hex code.
- **The Tournament plan's view as today** (free tier review).

### Part 8 · Imports where their data lives; Data tools retires; Chat (E10, E11, A59, A60)

- **One import sheet** on the kit in `BudgetImportSheet`'s shape: start from a template (the event's rows to update or
  an empty one — a dropdown — Excel or CSV), choose the file, a preview that says what each row will do (new, updated,
  blocked and why), *Apply N rows*; nothing changes until a clean preview is applied (today's rule); *N earlier imports*
  inside it. **Teams** (P1's home) and **the schedule's Tools** open it; each empty list offers it beside its create
  button. Don't refactor the coach's sheet in this build: share the shell later (a follow-up, named).
- **Data tools retires:** its rail row leaves the Admin group (`components/admin/admin-nav-config.ts`); its address
  redirects to Teams (as Past tournaments' did); `lib/tournament-guidance.ts`'s "Import a team list" shortcut and the
  help article `data-tools-imports` move to Teams' and the schedule's topics (with `/docs`); `lib/sandbox-curation.ts`
  drops it (tell `/demos`); the registration workbook stays on Teams' Export. Free plan: the moved door's lock in Stage
  3's Tools-lock words (A44); everything else about free imports is the free tier review's.
- **Chat:** its title band (*Chat*, Manage room, the bare "?"); the room chosen by the olive pill (rooms: today's sheet on
  a phone, a docked column at a desk, New room at its foot); Manage room's panel restyled, its row actions 44px on a
  phone. **The free plan's full-page wall as today** (A60).

## Don't

- Redesign any free-plan lock (the free tier review's) — beyond moving the import's lock with its door.
- Change a price, a plan name, a slot count or a feature key (Part 0 changes only what holds a slot).
- Redraw the Venue field or the Venue library (Club 6's), the schedule (Stage 3's), the admin frame, or the public pages.
- Take on Club 6c's schedule handover; it is its own session's.
- Add a second record window, row recipe, notice, import sheet or reuse flow.
- Remove a demo tour anchor without naming its new home (`schedule-health` stays on the weeks-before Schedule card).
- Rename an identifier, column or enum value to fix copy (the Fee model's `free` stays).

## Verification

- `npm run verify:changed` and `npm run typecheck` (shared libraries, the slot rule, the venue route, the kit).
- **Tests, by file:** Part 0's slot rule at every check; the facility naming; the populate route's options and its
  all-or-nothing; the clone's facilities, name and date checks; the board's one ready rule; the 6a guard's shrunken lists.
- **The layout sweep:** every `admin-t-*` Stage 5 touches (dashboard, branding, divisions, rules, venues, settings,
  settings-event, settings-fields, settings-notifications, manage) + the new wizard and draft-board ids at 390 / 360 /
  768 / 1440 in both themes; contrast 0/0; one runner, `--only=`. Prune the Data tools entries.
- **Probes** (in `.probe/`), asserting on state:
  - taps: a first tournament to a ready draft (drawn 7 + typing); a venue with three diamonds (2 + typing); the public
    site from its editor (1 at every width); next year on the free plan without archiving (6 + typing);
  - the draft's three required rows end ≈394px at 390; the weeks-before board's first card ≈232px;
  - nothing a thumb taps under 38px on any Stage 5 screen at 390 / 360 / 768, the daily job at 44;
  - no `alert()` / `confirm()` reachable on Divisions, Rules or Registration questions;
  - every "?" is the bare glyph (no border, no fill) at every width;
  - the clock: every time through `formatTime()`.
- Re-measure the built screens against the hub's figures; report any gap.

## Close-out (the stage's and the project's)

- **Offer `/simplify`, then `/review`**, before the commits: a slot rule on every limit check, a destructive route made
  transactional, a shared import sheet, a page retired.
- **Commit only when the owner says**, one commit per part, on `dev`, from a private index, explicit pathspecs.
- **Help (`/docs`):** creation, the board, Event settings (the Fee model's words), Divisions, Venues, Rules, Registration
  questions, Public site, Teams' and the schedule's imports (Data tools' article retires), the one-slot answers (three).
- **Demos (`/demos`):** Data tools in the sandbox curation; the Invitational's diamonds after the clone fix; any tour
  line about creating or setting up.
- **The owner's walks** (checkable, the hub's QA tab, ONE artifact; read the live copy before publishing): one purpose
  each — **"a first tournament, at a desk"** (sign-up to a draft ready to open registration) · **"next year"** (Reuse on
  Tournament Plus; one at a time on the free plan) · **"setting up from a phone"** (Event settings, a division, a venue,
  the public site) · **"imports"** (teams and games, a blocked row). Each its own Owner QA Ledger §.
- **The project's close-out**, after the walks pass:
  - **the final walk** — the redesign end to end, one pass across every stage's screens (create → set up → teams → the
    schedule → game day → the volunteers → after the event), its own §;
  - the plan, the PM brief and the hub HTML moved to `docs/projects/archive/` (TODO and memory point at the archive);
  - **the follow-ups as ONE TODO group** "Tournament admin redesign — follow-ups", by name: the frame's (F39, F89 the
    Registration questions door, F90 the header pill on phones), the public pages' (F51, F56, a tied final), `/strategy`'s
    (J1-053 the free logo), `/billing`'s (J1-020 the dropped plan choice), the shared import shell (the coach's and the
    admin's sheets), a record-form hook shared with Teams, and everything this build leaves;
  - `PROGRAM_TOURNAMENTS.md`'s pointer; memory `project_tournament_admin_redesign` closed with its archive path.
- **Migrations:** none expected. If one appears (the populate route's options or the slot rule need none), it is the
  build's call with the data dictionary in the same unit of work.
