# Club Tier Readiness — Stages 10 + 11 session prompt ("Permits and the club scheduler: the plan, the brief and the mockups")

> Paste into a fresh session on `dev`. Written 2026-10-10. **This session writes the plan and the PM brief, draws, and
> settles rulings. It does not build.**
>
> **Why now:** Club Tier 6c's rulings were the only thing this session waited on (6c ratified 2026-10-10). Both stages
> hold the Club release (owner, 2026-09-25 and 2026-10-08; and 2026-10-10, *"the club release will only happen when all of
> this work is either complete or deemed cancelled by me"*). They are the two largest new features left in the project,
> with nothing built today.
>
> **One session for both, by ruling:** Stage 11's Ask 2 (2026-10-08) made a permit and a schedule share **one model of
> the time the club holds**. A permit records a block of time with its cost, reference and document; a schedule hands that
> time out. So they are drawn together and built as two (permits first).

## What this session produces, in order

1. **The plan and the PM brief** (the plan names them as this stage pair's own):
   - `docs/projects/active/CLUB_PERMITS_AND_SCHEDULER_PLAN.md`
   - `docs/projects/active/CLUB_PERMITS_AND_SCHEDULER_PM_BRIEF.md`

   The plan holds the evidence, the rulings already made (below), the proposed shape, the asks, the build split, the
   migrations expected and the walks. The brief is plain language for the owner: what a club admin, a coach and a
   house-league admin see differently, why it matters, success criteria. Write both before drawing, as **proposed**;
   record rulings in them as they land.
2. **The mockups** on the club hub (the ONE artifact for this project), a new "Stages 10 + 11" section: whole screen,
   before and after, at true size, clickable notes, both themes.
3. **The asks**, each with a recommendation, ruled by the owner.
4. **When ruled:** two build prompts (permits, then the scheduler), and the note to 6d (calendar feeds) that it can draw.
   6d must land before the scheduler is built: the scheduler's slots reach families through the team's feed.

## Read first

- `docs/projects/active/CLUB_TIER_PRODUCTION_READINESS_PLAN.md`:
  - **§6 Stage 10** (permits: the starting shape, the money and utilization ideas, what is out of the first cut).
  - **§6 Stage 11** in full: the owner's words, the 2026-10-08 RULED block, "Read first (the code)", the framing, the
    seven-part shape, and the asks list. ⚠ **That asks list still reads "all OPEN", but the RULED block above it settled
    them on 2026-10-08.** Treat Asks 1–6 as ruled (below); the stale "OPEN" text is a record to correct in your plan.
  - **§5 D3 as amended** (the club publishes its own bookings, "From the club", and never writes, moves or deletes a
    coach's) and **D4 as amended** (permits in scope; the release waits).
  - **§6 Stage 6**: 6a (one venue book; one clash rule with its `booked_by` and `busy_then` answers, where `busy_then` is
    the permit hook) and 6b (the club calendar, the Venue library).
  - **§6 Stage 6c**: the calendar recipe and Ask 18's correction. **The scheduler's draft grid takes the tournament
    Timeline's shape** (facilities down, the hours across, an open slot on the page), not the club calendar's Week, and it
    wears the recipe.
  - **§6 Stage 3** (club money): 3a's allocation loop, 3c's fiscal year, and New allocation's group picking (Ask 11) and
    split shapes. The scheduler's "Who" step picks teams the way New allocation does.
  - **§6 Stage 7** (tournaments inside a club, and "message every family"): see Ask 9.
  - **§7** sequencing.
- `docs/agents/design/TABLE_AND_LIST_STANDARD.md` **§11, the calendar recipe** (C1–C13, the register R1–R11; R3 "Stage 11's
  draft grid shares the Timeline's shape", R9 "a club-wide row shows the time as a range").
- `docs/agents/strategy/BUSINESS_DECISIONS.md`, both **2026-10-08** entries:
  - the scheduler is carried by League Plus and both Club bands, never an upgrade lever, and not by the Tournament plans or
    the standalone Premium Coaches Portal;
  - the release waits for Stage 11. Note its open line: **"whether permits also reach League Plus is NOT ruled"**.
- `docs/agents/strategy/PLAN_PRICING_FACTS.md`, the inclusions lines (the Venue library and the club calendar; the
  scheduler, not yet built).
- `TOURNAMENT_ADMIN_REDESIGN_PLAN.md` §6c Stage 3, **S3–S4**. Its generator was rebuilt 2026-10-09, and its generic parts
  are tagged **"Shared candidate · Club Stage 11"**:
  - When, Where and Rules;
  - the ranked drafts;
  - the one statement of what saving does;
  - adjust with Undo;
  - publish saying who is told.

  "The tournament's own" parts (pairing, games per team, pools, bracket order) are not yours. **Read the built screens, not
  only the drawings.**
- In-repo `memory/design_decisions.md`, the 2026-10-09 and 2026-10-10 entries:
  - a move can be taken back;
  - a published change asks once;
  - an event's own overlap is refused and another program's is amber;
  - one game length;
  - a record reads first;
  - a rare door ends the body;
  - an export sits above what it exports;
  - one calendar: the recipe.
- The hub (ONE artifact; republish the SAME path): `docs/projects/active/CLUB_TIER_PRODUCTION_READINESS_HUB.html` =
  https://claude.ai/artifact/K4MPu4ni53Ct7yrDcmWJd9. Its Stage 6, 6b and 6c sections are your drawing method; 6c's
  specimen 4 is the grid's starting point.
- Memory: `project_club_tier_readiness`, `project_club_stage6_venues`, `project_club_stage11_scheduler`,
  `project_tournament_admin_redesign`, `feedback_portal_is_the_formatting_benchmark`, `feedback_clickable_design_annotations`,
  `feedback_mockups_as_claude_artifacts`, `feedback_money_figures_one_joined_band`, `decision_record_reads_first_edits_whole`,
  `decision_edit_autosaves_create_asks`, `decision_rare_door_ends_body`, `decision_one_toolbar_rare_tools_behind_tools`,
  `decision_export_is_one_button`, `reference_hub_script_parse_trap`, `reference_artifact_publish_needs_full_read`.

## Already ruled. Draw to these; don't re-ask them

- **One model of the club's time** (Stage 11, Ask 2): a block of time (venue, facility, days, hours, date range) that a
  permit records and a schedule hands out. Never two slot models.
- **A finalized club slot on a team's schedule is the club's own booking, "From the club", read-only to the coach**
  (Ask 1; D3 amended narrowly):
  - it reads the way a published tournament game already does;
  - the coach still sets arrival, notes, attendance and the lineup;
  - the coach can hand a slot back ("we won't use it"), which frees it on the club's schedule.
- **Who builds and finalizes** (Ask 3): the owner and an admin for any team or program; a league admin for house league's
  own teams only. A head coach reads the club schedule that includes their team and never edits it.
- **Time only** (Ask 4): the scheduler hands out practice, training and facility time. Game pairing stays with house
  league's and the tournaments' generators.
- **The release waits for both stages** (Ask 5, against the recommendation, 2026-10-08).
- **League Plus and both Club bands carry the scheduler** (Ask 6), alike, and never as an upgrade lever.
- **Warn, never block, across programs** (Stage 6): a slot that clashes with another program's booking gets the amber
  line; a program's own refusal stays its own.

## Verify before drawing (read the code; plans in this repo have been wrong)

- **What holds club time today.** Stage 11's record said nothing (2026-10-08). Re-check after 6a, 6b and 6c: the venue
  book, the clash rule's `busy_then` answer (what it reads, and what it would read once a permit exists), the club
  calendar's read, and the test club's venues, facilities and bookings (6a's `--club-venues` seed).
- **The writers a finalized slot must reach,** and what each can hold today:
  - a rep team's schedule (the tournament mirror is the precedent: how it writes, refreshes and refuses edits);
  - **house league's practices** (made by hand today; afterwards only cancelled, never moved);
  - the club calendar;
  - the clash check;
  - the team's calendar feed (6d).
- **The tournament generator as built** (Stage 3): its two steps, the drafts, the statement, Undo, publish. Which parts can
  serve time slots as they are, and which would need changing? A change to a built tournament part is an ask tagged
  "shared, tournament redesign", never a redraw.
- **Sending:** what exists for a club to send to its own staff (Stage 11's record: nothing; no email carries an
  attachment). Read the family-email choke point and its suppression rules, the capped tournament send, and Stage 3a's
  reminder preview and send log, the precedent the record names.
- **Money:** where a permit's cost would live (an org budget line under a word; 3c's fiscal year), and how New
  allocation's split by sessions could later read a finalized schedule.
- **Count before you propose:** on dev and prod, read-only:
  - clubs and leagues with a Venue library;
  - the budget lines filed under a permit or facility word;
  - house-league practices per season;
  - the rep events already placed on club venues.

  Put the numbers in the plan.

## The proposed shape (from the plan; the session draws and tests it)

**Permits (Stage 10):**
- A permit is a club-held record:
  - the venue (from the one venue book) and the date range;
  - weekly blocks (day, start, end, facility);
  - cost and payee;
  - the issuer's reference;
  - who it is for (the club, a program, a team);
  - the issuer's document.

  Season or fiscal-year scoped: say which.
- The clash check gains its second question, "is this slot inside a permit we hold?", and warns, never blocks.
- A permit's cost can be cited by a budget line and allocated to teams.
- **Utilization:** used versus unused hours per permit, the number a facilities person takes to the municipality.
- Out of the first cut: requesting or paying for permits through the platform, municipal integrations, public booking.

**The scheduler (Stage 11):**
1. **A schedule is a named club record:** Draft → Final (sent) → Changed since sent. It is kept and reopened, with "Start
   from last winter's".
2. **Parameters in four short steps, the rare ones folded:**
   - **The time:** venue and facilities, date range, days and hours, slot length, changeover, dates off, and teams per
     facility at once. A permit's blocks fill this step in one pick.
   - **Who:** picked by group, as New allocation picks.
   - **How much:** an equal share, N per team per week, or a share by group.
   - **Rules** (folded): earliest and latest start by age, a weekly cap, never on a game day or over an existing
     booking, the same night or prime time rotated, no back-to-back days.
3. **Generate, then adjust by hand** on the Timeline-shaped grid. Drag, swap, clear, lock (a regenerate keeps a locked
   slot), and Undo. A fairness summary sits beside it: hours per team, prime-time share, anyone short, every clash.
4. **Summaries:** the whole schedule, by team, by program. One Export (Excel first, then PDF), and print.
5. **Finalize and send:** the slots become real bookings everywhere above.
   - Send picks the stakeholders (house-league admins, each team's head coach and staff with schedule access, a named
     facility contact) and previews who receives what.
   - It keeps a send log ("last sent … by …").
   - Families are never sent it directly; they see their team's slots on the team schedule and its feed.
6. **After it is final:** an edit marks it "changed since sent" and lists what moved. "Send the changes" tells only the
   teams whose slots moved.
7. **Money, later:** a dome rental split by the hours each team got. Recorded as a tie-in to rule (Ask 8), not first-cut
   scope.

## Blocking gate — item ONE is the mockup

1. **The plan and brief, then the mockups on the hub's Mockups tab, before any code.** Add one "Stages 10 + 11" stage.
2. **Whole screen, before and after,** for every surface that changes, including the "before" of:
   - the Venue library and a venue's window (where permits will live, if Ask 1 says so);
   - the club calendar;
   - a coach's schedule with a "From the club" slot;
   - house league's practice form;
   - the tournament generator (the precedent).

   The "after" covers the permit list and record, the scheduler's four steps, the grid, the summaries, the send step, the
   "changed since sent" state, and a coach's view of a club slot at 390.
3. **Every highlight is clickable:** NEW / RESTYLED / UNCHANGED / SHARED tags, each with its own `data-note`.
4. **True size:**
   - the club's two widths (960 reading, 1200 tables and grids); the scheduler's grid is a 1200 screen;
   - phone frames at 390 with the 44px block. The scheduler is desk first; say what a phone gets (reading a schedule,
     a coach's slot).
   - **Both themes:** "after" drawn Warm, with a Dark copy cloned at load (`.spec.darkcopy`).
5. **Check against the formatting benchmark and the calendar recipe before the owner sees a drawing.**
6. **Record every ruling on the Decisions tab as it happens** (rows `open`, then `accepted`), and in the plan.

## The asks (each with a recommendation; Decisions rows, `open`)

1. **Where permits live.** Recommended: on the venue they cover (the Venue library's venue window gains a Permits part),
   with one Permits list for the club's year. Not under Accounting, which only cites a permit's cost.
2. **A permit's period:** the club's fiscal year (3c), a season, or its own dates. Recommended: its own dates, filed under
   the fiscal year it starts in, with "Renew for next year" copying it.
3. **What the clash check says about permits.** Recommended:
   - a booking outside every permit at a venue the club holds permits for gets one quiet line ("Not inside a permit");
   - a club with no permits sees nothing new;
   - it never blocks.
4. **Which plans carry permits** (open since 2026-10-08). Recommended: the same plans as the scheduler (League Plus and
   both Club bands), because they are one model of time. A packaging call: `/strategy` logs it and the Facts doc follows.
5. **The scheduler's grid and the tournament's parts.** Recommended: it wears Stage 3's shared candidates as built, and
   any change they need is a shared ask to the tournament redesign, not a fork.
6. **What a finalized slot becomes in house league.** Recommended: a house-league practice the league reads as the
   club's own booking (like Ask 1 for rep teams), so the practices a league admin made by hand and the ones the
   scheduler made read the same. Say what that asks of house league's practice records. ⚠ Stage 9 (house league) is
   awaiting the owner's ruling on whether it holds the release; draw only what the scheduler needs from it.
7. **The send step and the stakeholders,** including what a coach receives, in which words, and when.
8. **Money tie-ins:** a permit's cost on a budget line (first cut, recommended) and the dome split by hours (later,
   recommended). Ask both.
9. **One club send, or two?** Stage 7 will draw "message every family" (an org-wide announcement door with a send log).
   The scheduler's send goes to staff, not families. Recommended: one send log and one preview pattern for both, with
   two audiences. Say it now, so Stage 7 doesn't draw a second one.
10. **The build split.** Recommended: permits first (the record, the clash check's second question, utilization, the
    budget citation), then 6d (feeds), then the scheduler. Each has its own walk.
11. **Anything the verification finds** that the plan's lists miss. Say so; don't force-fit it.

## Working beside the other sessions

- **Running now or soon:**
  - the tournament redesign's **Stage 5 build** (code; it shares the dev server, never this hub);
  - the owner's walks of 6b (walk 9 and its re-checks) and 6c (§289);
  - possibly other club work publishing this hub.
- **The hub is published from the shared working copy by several sessions.**
  - Before every edit, read it fresh and check `git status`.
  - Parse its scripts before every publish: one unescaped apostrophe kills every tab.
  - The Artifact tool refuses a publish until the live version has been read **in full**, every line through the Read
    tool, once per session (about 1.6 MB). Hand that read and the first publish to a subagent.
  - Diff a refused publish against the live copy; never `force`.
  - The hub's stage switch hard-codes its stage list (`data-stg` buttons, `walkset` spans, `stageOf()`). Add one entry,
    `10-11`, labelled "Stages 10 + 11", and change nothing else in the script.
- **One browser tester at a time.** Before any probe, capture or `auth-setup`, ask the owner whether another session is
  measuring. **Probes write nothing.** Never reset the test club without asking: a reset ends every session's club
  sign-ins.
- **QA walks keep their ticks by step POSITION.** Add steps only at a walk's end.
- **No code, no help, no gates.** Your files:
  - the new plan and brief;
  - the hub's Mockups "Stages 10 + 11" section and its Decisions additions;
  - the Club plan's Stage 10 and 11 sections (a pointer to the new plan, and the stale "all OPEN" corrected);
  - your TODO line, and memory.
- **Git:** use a private index and explicit pathspecs. Build shared files as HEAD plus your own hunks, and re-read HEAD
  immediately before committing. After committing, run `git reset -q -- <paths>` on the shared index. Commit only when
  the owner says.

## Hand-off

- Write in product-owner voice. Lead with what each person sees and does differently:
  - **a club admin** recording a permit, building the winter dome schedule, adjusting it, and sending it;
  - **a head coach** finding "From the club" slots on the team's schedule, and handing one back;
  - **a house-league admin**;
  - **a family:** their team's slots on the schedule they already use.
- **Tell the owner to open the hub on a phone.**
- Put the asks as numbered questions with a recommendation each.
- Offer `/design` for a review pass if the session has budget, and `/strategy` for Ask 4.
- **When ruled:** write the two build prompts, and tell the owner 6d (calendar feeds) can draw.

## Do not

- Build anything, or change routes, gates, seeds, help or copy files.
- Re-ask a question ruled above.
- Redraw a built tournament part, the club calendar, the Venue library's existing screens or a coach's event form, beyond
  the parts this stage adds; a change to any of them is a shared ask.
- Design the feeds (6d), house league's own redesign (Stage 9) or "message every family" (Stage 7); Ask 9 only names the
  shared send.
- Change a price, a plan or a gate. Ask 4 is `/strategy`'s; draw the placement and tag it. Write no customer copy: tag
  words `/marketing`. The homepage's "field bookings" line returns with permits, through `/marketing`.
- Mint a second artifact. The club hub is the only one.
