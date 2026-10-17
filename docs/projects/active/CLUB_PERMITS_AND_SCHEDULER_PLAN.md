# Club permits and the club scheduler — Implementation Plan (Club Tier Stages 10 + 11)

> **⚖ RATIFIED 2026-10-11 — all twenty-seven asks as recommended** (owner: *"looks great, go ahead and write the build
> prompt based on your recommendations"*; hub v86, every "Stages 10 + 11" Decisions row Accepted). Consequences: Stage 11
> Ask 1 (2026-10-08) is amended by Ask 24 (an optional review round that never blocks); Ask 8b's split by hours is in the
> first cut through Ask 23; **Ask 4 (permits on League Plus and both Club bands) is a packaging change to a Decided
> entry** (2026-09-25: Club inclusion) and must be logged by `/strategy` (`BUSINESS_DECISIONS.md` + the Facts doc) before
> its gate is built; Ask 26's two open gaps are answered as recommended at ratification (print setup — landscape, fit to
> width — and a text page footer on the new workbooks; the FieldLogicHQ mark stays the last row). **Build prompts:**
> `CLUB_PERMITS_BUILD_PROMPT.md` (10a) → `CLUB_SCHEDULER_A_BUILD_PROMPT.md` (11a part A, the server) →
> `CLUB_SCHEDULER_B_BUILD_PROMPT.md` (11a part B, the screens) → 11b (house league's half) with Stage 9. **Stage 6d**
> (calendar feeds) is drawn and built on its own (`CLUB_TIER_STAGE6D_MOCKUP_PROMPT.md`): **owner 2026-10-11, the scheduler
> waits for permits only** — the feed reads the scheduler's practices whenever it lands, never the other way round.
>
> **🔨 10a BUILT 2026-10-11 (uncommitted at writing; the owner commits) — permits, to hub v87/88.** Mig 322 (`org_permits`,
> `org_time_blocks` owned by a permit, `org_time_block_facilities`, `org_permit_facility_shares`, `org_time_dates_off`,
> `org_venues.bookings_email`, the private `org-permit-documents` bucket, `org_permit_save`) applied to DEV, ⚠ prod at the
> promote (`MANUAL_PROD_STEPS.json`, order-critical). The rule `lib/permit-time.ts` (`permitAnswer`, `heldTime`,
> `fieldPrices`, `permitUse`), the words `lib/permit-words.ts`, the reads `lib/permit-lookup.ts` / `lib/permit-server.ts`,
> the form `lib/permit-form.ts`, the use workbook `lib/permit-use-workbook.ts`; the routes `/api/admin/org/permits`
> (+ `/document`); the Venue library's Venues · Permits switch, a permit's window, Add permit, Renew, Delete, the venue
> window's Permits section and Bookings contact; the quiet line on every check and Where form (coach event form, tryout
> day, house-league game/practice/series + the generator's count, tournament game + timeline move, the club calendar's
> read window) and in every writer's reply (`permits`, its own field — never a third `ClashKind`); the budget line's
> "Pays for"; the house-format workbooks (`XlsxPrint`: landscape, fit to width, page footer) and the club's Excel reports
> now wear the club's logo; fixture `--club-permits` (also in the full build). Gates: unit suite 6,705 ✓, typecheck,
> lint, verify:changed for this diff ✓; `/simplify` and `/review` (high-risk, five lenses) run — 1 High + 14 fixed, see
> §7 "10a as built". **Owed:** `check:layout` both themes and a `/design` pass at 1440/390 (both need captures — the
> owner's OK), the dev-server restart (new files), walks **§296** on the QA ledger, the commit.
> **Departures from the drawings** (each said in the code's header): (1) a permit's MONEY (cost, an hour held, the field
> prices' dollars, the budget line) reads only to those who hold the club's Accounting — the drawing showed it to every
> reader (owner, 10a build: "time to all, money to accounting"); such a saver types the issuer's name (payees are
> Accounting's) and keeps the stored money on a save; (2) the fiscal year is a RULE (`fiscalYearOf(starts_on)`), never
> a stored link (mig 318 re-spans year rows); (3) "Hand out this time in a schedule ›" is 11a's — absent, never a dead
> door; (4) a block's own dates are stored but not offered (no drawing shows them; a save clears them — 11a note);
> (5) a permit carrying money in a closed year can't be DELETED either (/review — the ruling's "money is locked" read
> through to delete); (6) the venue window lists the permits that still hold time there (ended ones live on the Permits
> view by year). **Owner's addition (build session, recorded as direction, not packaging):** coaches will later enter
> their own team permits (supplemental gym time, exhibitions) with the club seeing them — plan §6 **Ask 28**, open;
> `held_for = 'team'` is informational today, NOT that holder.
> **⚖ The /review's three owner calls — RULED 2026-10-11 (owner), nothing changes:** (a) the issuer's DOCUMENT opens for
> everyone who reads permits ("that is fine") — it is not money; (b) a block need not run to midnight ("no need for
> midnight") — the form's clock stops at 11:59 p.m.; (c) "Used" stays booked ÷ the whole term ("used is fine").
> **⚖ "Outside it" REMOVED — owner 2026-10-11** (from the §296 walk: "what does 'Outside it' mean?", then "do we really
> need to show a list of everything happening at that diamond outside of the permit?"). A permit's Use reads **Held ·
> Booked · Unused** and a row per field; the "Outside it" tile, its rows and "And N more…", the use workbook's "Outside the
> permit" sheet and note, the export catalog's sentence and the help term are gone, and `permitUse` no longer works it
> out (nor reads every other club permit to do so). **Why, from the code:** the figure was the club's own bookings at the
> permit's PARKS on its DATES that NO club permit covered — a question about the park, asked on a permit. It fell on
> whichever permit's dates spanned the booking (a season permit became the catch-all), on every such permit at once, and
> read longest for a club that hadn't entered all its permits (a coach can't enter a team's own yet — Ask 28). The
> booking still says so where it is made (the quiet line), once in the calendar's read window, and in the generator's
> count — all unchanged. **Cost accepted:** no one list of the club's unpermitted bookings; if renewal wants one, it
> belongs on the VENUE and is drawn first. Decision sheet: https://claude.ai/artifact/MaSwbkNjaL2pPT6SEeVPX7
> (`CLUB_PERMIT_USE_OUTSIDE_MOCKUP.html`). The hub is trued (v95, 2026-10-11): specimen 2 at a desk and on a phone, the
> calendar window's note and the workbook specimen redrawn, a Decisions row, and §296 walks W2, W9 and W12 reworded.
> **⚖ Export heads the permit; its cost reads as rows — owner 2026-10-11** (the §296 walk: "why is export hidden so far
> down the window? … the export is a summary of the whole permit … why not just move export up?"; and "should this be
> turned into rows instead of blocks? … the text is already wrapping a lot"; decision sheet
> https://claude.ai/artifact/VA6EkqanHhEadNuDYeN3x5, `CLUB_PERMIT_WINDOW_COST_MOCKUP.html` — "yes that looks way better,
> go ahead and build it"). Built: Export at the right of The permit, the 44px icon on a phone (the workbook is the whole
> permit, and an Export sits above what it exports, 2026-10-09); the Cost band holds TWO figures (Cost · A full field, an
> hour, or An hour held) — no half tile, no budget tile; "What each field costs" folds into Cost as ONE ROW PER PRICE
> (`priceGroups`: the product's field-list words, never across two venues); the line under them says how the hour was
> worked out (`fieldHourSentence`), never the prices again; On the budget is a read line under them. The form keeps its
> per-field price inputs and its sentence. Help (Reading a permit) and §296 W2, W3 (its Cost step a re-check — W3 passed
> before the change), W8, W9, W12 trued; hub v96 (specimen 2 and the dome flow's permit redrawn, a Decisions row).
> **⚖ A field's price says what it is — owner 2026-10-11** (from the §296 walk: "it isn't clear what a 'share'
> represents ($ or % or something else?)"; approved "go ahead" on all four parts). Ask 21's **"A share" is now "A
> percent"**; the form's box carries a **%** beside it; every price row in the FORM shows the field's **"$46.96 an hour"**,
> worked out live from the cost typed (only once every block is whole and every percent stores, so the figure shown is
> the one that saves), with the prices line under them; the WINDOW's rows read **"75% of a full field" · "$46.96 an
> hour"** (was "75% of the cost" — read as 75% of the $27,000.00 above it), and the line no longer says "1 field at a
> share share the …" ("1 field at 75%"). Also fixed on the way: the box couldn't take a decimal ("33." lost its point)
> or be cleared, typing "50" on the way to "50.5" flipped the row to Half cost under the cursor (/review), a box takes a
> plain figure only (what it shows is what saves), and the use workbook's Cost cell read "75% of the" for a percent (now
> "75%"). `/marketing` 2026-10-11
> reworded the pending line and the held line ("Enter each percent above 0 and below 100 (100 is Full cost)."). The hub's
> Ask 21 drawing still says "a share you type" — owed when the hub is next trued.
>
> **🚀 ON PROD 2026-10-13 (master job 279, `8e140430`): 10a, 11a–11c and 11d part A, with migs 322, 325, 326, 328 applied to prod first — Club still not on sale.**
>
> **🔨 11d PART A BUILT 2026-10-13 (committed 2026-10-13: `88f02a86` bells · `bb86e953` stage · `c45ec888` sweep step) — a hand-back that asks for
> money back: the ask, the answer, the credit (§6d).** Mig **328** applied to DEV, and to prod 2026-10-13 after 326 (
> `MANUAL_PROD_STEPS.json`): the hand-back's record and its ask, the credit (`rep_allocation_credits` + parts and each
> payment's `credited_amount` — a payment's DUE is amount less credited), requests `accepted` / `credited` carried by a
> hand-back or a send, the steps (ask · withdraw · decline · accept · the daily sweep · Send the changes' losses) and the
> four money steps it replaces (allocated, receive, approve, reverse), and a backfill giving any earlier hand-back its
> record. The coach's tick on Hand back; the asked practices keep the amber Hand-back asked pill; the club's Answer window
> from Payment requests; Record paying; every money figure reads billed less credited (bills, reminders, both statements,
> Owed by the teams, Budget vs. Actual both sides, the fiscal year, exports, the register); Send the changes credits a team
> that lost time; a hand-back never marks Changed since sent; the club→team money bells that 404'd fixed. Gates: typecheck,
> lint, the unit suite (7,249 — the one failure another session's stylesheet), money arithmetic, **atomicity 105 of 105
> mutations caught** (T37 builds its own schedule club), dictionary, spelling, contrast, CSS, `check:layout` Warm on every
> touched screen (Dark: one finding, the Game day pill, not this stage); two Accepts at once proven on dev with two
> connections; `/simplify`, `/review` (high-risk, five lenses — 18 fixed, 2 High), `/design` at 1440/390 Warm and Dark (five
> fixes and one owner ruling — a phone's ask status ends the body), `/marketing` (nine changes), `/docs` (six articles).
> **Owed:** walks **§308** (six, hub QA tab "Stage 11d" — W1–W4 ✅ passed 2026-10-16 (9/9, 9/9, 8/8, 4/4 — W4 run on Jan 10, since a plain hand-back had already taken Jan 24) and W6 ✅ 2026-10-16 (6/6 — walked as 15U AAA’s coach); W5 ✅ on the owner’s word — **§308 ✅ CLOSED 2026-10-16**); part B (§6d "Notes for part B").
> **11d part C DRAWN 2026-10-16** (a hand-back the coach can change, from the owner after §308 W3): hub v108, Mockups →
> Stage 11d → "C" links (C1b: how a handed-back row reads, six options); `/design` D1–D8 applied; **⚖ Asks 10–14 RATIFIED 2026-10-16 as recommended** (Ask 10's families clause corrected and
> re-asked the same day: families see each kept practice as Cancelled), hub v109. Build prompt
> `CLUB_SCHEDULER_11D_C_BUILD_PROMPT.md`. **🔨 BUILT + COMMITTED 2026-10-16** (`6855d986`; the sweep `69d20a8e`, its own commit) — migs 330 + 331 on dev (prod pending); the sweep skips a late
> ask (the owner's call in the build session, "Skip late asks"); /simplify, /review (high-risk), /design, /marketing and /docs run;
> walks §319 ✅ CLOSED 2026-10-16 (§6d part C, As built).
>
> **🔨 11d PART B BUILT + COMMITTED 2026-10-16 — the schedule's page: an ask above the grid, the asked Sundays ringed,
> Fair shares B (`40df0587` the build · `25c55023` the /marketing words + the help; not pushed; no migration).** One callout
> per waiting ask (oldest first), Answer the page's one lime (Send the changes outlined beside it); each asked Sunday ringed
> with Hand back's glyph (a late ask's not); the slot window's Hand-back asked line; `?answer=` opens Answer over the page;
> the changes callout's hand-back branch removed (Ask 9). **Fair shares B built in this pass** (owner at the build start:
> "one pass over one panel" — Sidebar Strip & Grid Width Stage 1): the band above the toolbar, the week's lines above the
> grid, the team card under it. Its Bill once billed = what each team pays (as Money › Club). /simplify, /review (high-risk,
> 3 fixed), /design (1440/390 Warm/Dark), /marketing (3 changes), /docs. **Walks §322** (six, hub QA tab "Stage 11d part B").
> Two owner calls listed in §6d As built — part B. Departures and the found-and-fixed there too.
>
> **⚖ 2026-10-16 · A team's bill: money on one row, the date under Outstanding (owner, from a §308 W2 screenshot;
> decision sheet https://claude.ai/artifact/EDktV4ykGYaSx6fLxMKC2t, option A — "I agree with your recommendations, go
> ahead"). Built and committed `6952c544` 2026-10-16 after /review; walk §316 on the sheet.** D3's Credited-as-a-fifth-figure fell to a row of its own
> (the band holds four across; five could not fit the bill's 800px window). The club's bill window now draws Billed ·
> Credited · Collected · Outstanding (three without a credit) and one line under Outstanding — late (red) › sent ›
> next due › nothing. The coach's bill room keeps its five. Reverses D3 for the club's window only (design log 2026-10-16).
>
> **🔨 11c BUILT 2026-10-13, committed `691170b1` — New schedule round two, to hub v101 (§6c).** Sharing a facility (a rule
> about teams, 2–4 at once, paired whenever a partner is free, alone otherwise, never on a half facility; a shared slot is
> half a facility for shares, Fair shares' Hours and the bill), Each team's time (The same each week · Moved around, days
> kept), prime time whole in Who, and how much, rules as sentences with one Add a rule. Settings v2, **no migration**:
> `teamsAtOnce` stays stored as a worked-out ceiling because mig 326's `slot_full` floor reads it; a v1 Teams at once above 1
> reads as one rule naming every ticked team, a v1 rotate as Moved around. Every drawing number is a unit test (250 of 300,
> 37.5 h and $2,700.00 each; Moved around 12 or 13 early starts, at least three facilities) and was generated on dev
> through the engine (`.probe/s11c/figures.mts`). Gates: typecheck and lint on the build's files, the scheduler's tests (208),
> spelling, contrast, CSS, dictionary; `/simplify`, `/review` (high-risk, five lenses: 9 fixed — 2 High), `/marketing`
> (five words), `/docs`. **Owed:** walks **§307** (six, hub QA tab "Stage 11c" — ✅ CLOSED 2026-10-13 on the owner's word, re-checks included; the ledger keeps the dev read-back that disagreed with several steps, and that why W2's Undo did not stay is not established); `check:layout` both themes on
> `admin-schedule-new`, `admin-schedule`, `admin-schedule-slot` (the owner's dev server); a `/design` pass at 1440 and Dark;
> a dev-server restart (a new file). Departures: §6c "As built".
>
> **🔨 11a PART B BUILT 2026-10-11, committed `2adfeb62` · `c46ee0ed` (help) 2026-10-12 — the scheduler's screens, to hub v87;
> walks §300 on the hub (v99).** Schedules under Calendar (owner and admins, `club_scheduler`, rep teams — one rule,
> `lib/club-schedule-gate.ts`, read by the server's gate and every door), New schedule (two steps, from a permit or last
> year's), the drafts, a schedule's page (the grid, Fair shares, moves, Undo, Tools), Bill the teams, Send / Finalize /
> Send the changes, the send log; the club calendar's From row and one booking per shared slot; a permit's "Hand out this
> time in a schedule"; the coach's practice from the schedule, Hand back, the review card and the Budget's callout; the
> schedule's PDF, workbook and Calendar file in the house format. No migration. Gates: typecheck, lint, the unit suite
> (7,004 of 7,005 — the one failure another session's stylesheet test), spelling, contrast, export catalog, PDF check,
> masthead guard, `check:layout` both themes; `/simplify`, `/review` (high-risk, five lenses — 26 fixed, none High),
> a `/marketing` words pass (seven changes), `/docs` help, `/design` at 1440/390 Warm and Dark (four fixes). See §7 "11a
> part B as built" for the departures. **Walked:** the dome walk, QA §300 ✅ CLOSED
> 2026-10-12 (fifteen walks; ledger `25d3e82b`), its findings' fixes `b49a989b` · `9f516b7c` · `cfe43638` · `0f525c6d`.
> A hand-back that asks for money back (owner direction 2026-10-12, from W10) is Stage 11d (§6d). **Owed:** `/demos`
> at the next session (whether the coach demo shows a club slot).
>
> **🔨 11a PART A BUILT 2026-10-11, committed `60728a7c` · `f5a0a23d` the same day — the scheduler's server, to hub v87.**
> Nothing a person sees yet: part B (`CLUB_SCHEDULER_B_BUILD_PROMPT.md`, its item 2a is part A's note) puts it on screen.
> Mig **326** applied to DEV (prod `pending` in `MANUAL_PROD_STEPS.json`, after 318/322/325): the five schedule tables,
> the block and dates-off's second owner, `rep_team_events.club_schedule_slot_id`, split `time`, and the steps — save,
> hand edits, review, Finalize (the practices AND the bill in one step), Send the changes, hand-back, the send claim, the
> season roll's carry. The engine (`lib/club-schedule-engine.ts`, its own — never the tournament's), the bill
> (`lib/club-schedule-bill.ts`), the words, the sends, the coach's side and the routes (§7 "11a part A as built"); the
> feature key `club_scheduler` (League Plus + both Club bands; the Facts doc). Every drawing number is a unit test (the
> lanes' 354 / 288 / 64, the 60/40 → 211/141 → 53/53/53/52 · 36/35/35/35, the dome's 300 slots, $2,700.00 / $4,050.00 and
> $972.00 / $864.00 / $864.00); the money gate's section 11 recomputes a finalized bill from its rows. **Build questions
> A and B ruled 2026-10-11** (§6, after Ask 27; the hub's two rows ruled, v98). Gates: typecheck, lint, the unit suite (6,961 of 6,962 — the one failure
> another session's stylesheet test), money, dictionary, spelling, observability; `/simplify` and `/review` (high-risk,
> five lenses) run — 2 High + 13 more fixed, see §7. **Departure:** the dome's sample grid has two teams on two fields at
> once at 9:30; the engine never does (the schedule's one refusal) — same totals, different times. **Owed:** the commit,
> a dev-server restart (new files), part B.
>
> **Status (before ratification): PROPOSED 2026-10-10. Drawn, nothing built.** Written by the joint Stage 10 + 11 mockup session
> (`CLUB_TIER_STAGE10_11_MOCKUP_PROMPT.md`). The drawings are on the club hub
> (https://claude.ai/artifact/K4MPu4ni53Ct7yrDcmWJd9 → Mockups → **Stages 10 + 11**, screens `s1011-*`); the asks are
> rows on its Decisions tab, **all OPEN** (twenty-seven: Asks 18–20 added by the owner 2026-10-11 — the time shared by percentage, reviewing a draft before keeping it, a team’s days off — and Asks 21–27 from the owner’s dome flow, walked the same day (§6a), and the export instruction (§6b)). PM brief: `CLUB_PERMITS_AND_SCHEDULER_PM_BRIEF.md`. Parent plan:
> `CLUB_TIER_PRODUCTION_READINESS_PLAN.md` §6 Stage 10 and Stage 11, which now point here.
>
> **`/design` review 2026-10-10 (hub v82, the owner's standing rule: every mockup goes through /design before the
> hand-off):** nine drawing changes against the written rules, listed on the hub's Formatting check screen — phone lists
> as one frame with hairlined rows (P1, 2026-09-29), no colour rail on list rows and one lead mark (§3.10.7), centred table
> cells (§3.4), bare facts in a read row (2026-10-08), one foot door in the calendar's read window (C12), the coach's
> "Only the club can move or remove this practice." at the body's end, Cancel beside Generate drafts (2026-10-09), and
> one empty-day mark (C7). Found, not this stage's: the tournament generator's step 1 has no Cancel. Proposals until
> ruled; nothing written to the design log.
>
> **This plan is the pair's own record from here on.** The parent plan keeps one pointer per stage. Rulings land in §6
> (each ask) as they happen, and the parent's two stage sections are trued in the same unit of work.

## 0. Goal

A club records the time it holds — a town's diamond permit, a dome's winter contract — once, and hands that time out to
its teams and programs with a scheduler: a few parameters in, ranked drafts out, adjusted by hand, finalized, sent to the
people who need it, and kept by name to reopen next year. Every program reads the result: a rep team finds its slots on
its own schedule, the club calendar lists them, the clash check knows them, families see their team's slots where they
already look.

Both stages hold the Club release (owner, 2026-09-25 for permits; 2026-10-08 for the scheduler; 2026-10-10, *"the club
release will only happen when all of this work is either complete or deemed cancelled by me"*). They are drawn together
because a permit and a schedule share **one model of the club's time** (Stage 11 Ask 2, ruled 2026-10-08), and built as
two (permits first).

## 1. Scope, and what this plan does not hold

**In:** the permit record and where it lives; the clash check's second question; a permit's use; a permit's cost on the
club budget; the scheduler (the record, its settings, drafts, the grid, adjusting, summaries, export, finalize and send,
changes after sending); what a finalized slot becomes on a rep team's schedule, on house league's practices, on the club
calendar and in the clash check; what a head coach, a house-league admin and a family see.

**Not here (each has its own owner):**
- **Calendar feeds (Stage 6d).** A slot reaches a family through the team's feed; this plan says what the feed must
  carry (§5.8) and 6d designs it. (Owner 2026-10-11: the scheduler doesn't wait for 6d — the feed reads the
  scheduler's practices whenever it lands.)
- **House league's own redesign (Stage 9).** This plan draws only what the scheduler needs from house league (§5.7,
  Ask 6). Whether Stage 9 holds the release is the owner's open call.
- **"Message every family" (Stage 7).** Ask 9 names the one send pattern both use; Stage 7 draws its own door.
- **Prices, plans, gates.** Ask 4 is `/strategy`'s; the drawings tag the placement. Customer words are `/marketing`'s;
  every sentence drawn is a draft. The homepage's "field bookings" line returns with permits, through `/marketing`.
- **No code, help, gates, seeds or routes change in this session.**

## 2. Already ruled — drawn to, not re-asked

| Ruling | Source | What it fixes here |
|---|---|---|
| **One model of the club's time** — a block (venue, facility, days, hours, date range) a permit records and a schedule hands out; never two slot models | Stage 11 Ask 2, 2026-10-08 | §5.1 |
| **A finalized club slot on a team's schedule is the club's own booking, read-only to the coach**; the coach keeps arrival, notes, attendance, the lineup; the coach can hand a slot back, which frees it | Stage 11 Ask 1, 2026-10-08; D3 amended narrowly | §5.6 |
| **Who builds and finalizes:** owner and admin for any team or program; a league admin for house league's own teams; a head coach reads the schedule that includes their team, never edits it | Stage 11 Ask 3 | §5.3, §5.6 |
| **Time only** — practice, training and facility time; game pairing stays with house league's and the tournament's generators | Stage 11 Ask 4 | §5.3 |
| **The release waits for both stages** | Stage 11 Ask 5 (against the recommendation), 2026-10-08 | §7 |
| **League Plus and both Club bands carry the scheduler**, alike, never an upgrade lever | Stage 11 Ask 6; `BUSINESS_DECISIONS.md` 2026-10-08 | Ask 4 |
| **Warn, never block, across programs**; a program's own refusal stays its own | Stage 6, 2026-10-08 | §5.2, §5.4 |
| **The draft grid is not the club calendar's Week**; it takes "the Timeline's shape" and wears the calendar recipe | Stage 6c Ask 18, 2026-10-10 | §3.3, Ask 12 (what "the Timeline's shape" turns out to mean) |
| The calendar recipe C1–C13 and register R1–R11 | `TABLE_AND_LIST_STANDARD.md` §11, 2026-10-10 | every grid and list drawn |
| A record reads first and edits whole; edit autosaves, create asks; a change that tells families is held and asks once; a rare door ends the body; an export sits above what it exports; one Export, Excel first; a move can be taken back; a published change asks once | design log 2026-10-01 → 2026-10-10 | every window drawn |

**A record corrected (done in this session):** the parent plan's Stage 11 "Asks for the mockup session (all OPEN…)" list
predates its own RULED block, which settled Asks 1–6 on 2026-10-08. The parent now says so in place.

## 3. Evidence — read from the code, 2026-10-10 (dev at `43678430`)

Five read-only surveys (club time and the tournament mirror; house league and the feeds; the tournament generator as
built; sending and money; counts on both databases). Anchors are `path:line`.

### 3.1 What holds club time today
- **Nothing records time the club holds.** No table for a permit, block, slot, booking or club schedule (columns
  snapshot: 0 matches for permit / club_schedule / club_booking / venue_booking / time_block). Club time today is only
  the bookings themselves, across five tables: `rep_team_events`, `rep_tryout_sessions`, `league_games`,
  `league_practices`, and a tournament's `games` on a library-linked copy.
- **The venue book** (`org_venues`, `org_venue_facilities`, mig 094 + 319 + 321): a venue has name, address, notes,
  `is_active` (Archive); a facility has name, kind (`diamond|field|court|rink|gym|other`), order, notes. No sport on a
  facility, no facility archive, **no contact of any kind** (the venue holds no email; `org_payees` holds no email).
  Server-only writes since mig 321. Saving: owner, admin, league admin, or `create_tournaments` (`lib/venue-library.ts:25-29`).
  Plans: `league`, `club`, `club_large` (`hasOrgVenueLibrary`, `lib/plan-features.ts:150`).
- **The clash rule** (`lib/venue-clash.ts`): two findings, `booked_by` (same venue + same facility + overlap) and
  `busy_then` (same venue, a facility missing on either side). It never refuses. **The permit hook** (`:37-38`):
  "Stage 10 adds `outside_permit` … without changing a caller." ⚠ **That claim is optimistic**: `clashLine` filters only
  the two kinds (`venue-clash-words.ts:108-109`, a third would be dropped silently), the sort treats anything else as
  busy (`:250`), and the calendar's clash pairs and clashes-only count assume two kinds. And a booking against a permit is
  **not a pair** (`findClashPairs` is pair-shaped). See finding P11-04.
- **The lookup** (`lib/venue-clash-lookup.ts` `readClubPool`): club-venue bookings only (typed places and a team's own
  places are never in the pool); cancelled never; postponed league games never; **draft tournaments count** (ruled
  2026-10-08); mirrored tournament copies skipped; pages past 1,000; one check reaches 800 days.
- **The club calendar** (`lib/club-calendar.ts`, `app/[orgSlug]/admin/calendar/page.tsx`): one window ≤ 42 days; List ·
  Week · Month; one toolbar line; a read window with "Clashes with" / "Busy then" and a door to the booking's own
  schedule; "Nothing here writes (D3)". It already reads `rep_team_events` and `league_practices` directly — **a slot
  written as a real row in either table needs nothing new on the calendar or in the clash pool.**
- **The test club** (`scripts/seed-club-fixture.mjs --club-venues`, uat-rep-club): Lions Park (Diamonds 1–3), Kinsmen
  Park (A, B), Westfield School (none). Rep groups Senior (15U AAA, 15U AA, 16U AA, 14U AA; 18U AA archived) and Junior
  (13U AAA, 12U AA, 11U AA, 9U AA); two ungrouped (UAT Test Team, UAT Between Seasons). Bookings float with the seed day
  (from today's run: Tue Oct 20 and 27, Wed Oct 21, Thu Oct 22): 14U AA and 13U AAA overlap on Lions Park Diamond 2 (the
  seeded `booked_by`), 11U AA on Lions Park with no diamond (a `busy_then`), 11U AA and house league's Reds on Kinsmen
  Diamond B. Payee "Town of Milton"; a plan line "Diamond permits — city fields" under Facilities › Diamond Permits. **No
  dome, no indoor venue.** The drawings add one, tagged "drawn, not seeded".

### 3.2 The writers a finalized slot must reach
- **A rep team's schedule — the tournament mirror is the precedent** (`lib/rep-tournament-game-mirror.ts`,
  `lib/tournament-game-mirror.ts`):
  - The link is `rep_team_events.source_tournament_game_id` (not a foreign key; unique per season). Rows are
    `event_type:'tournament_game'`; the mirror never writes `org_venue_id`.
  - **It writes on READ, not on publish** (finding S6-06 still holds): the coach's events GET and the admin's team GET
    sync before reading, debounced 10 s per season. A copy of this would put a club slot on a team only when someone
    opens that schedule — and the club calendar, which reads the rows, would miss it until then (P11-05).
  - A moved game is overwritten in place; a removed game is deleted if the coach did nothing on it, cancelled if
    attendance, a lineup, tags, awards, expenses or coach fields exist.
  - **The server refuses, not just the screen**: PATCH 409 on any organizer-owned field ("This game comes from {name} …
    You can still set arrival time, uniform, field, notes, links and tags — and take attendance or build the lineup"),
    DELETE 409 ("Ask the organizer to remove it"). The coach's sheet reads "From **{name}** · organizer’s schedule" and
    "Only {name} can cancel or remove this game." (`ScheduleEventSheet.tsx:702-717, 1096`).
  - **No hand-back or decline exists** anywhere.
  - Every rep event belongs to **one season** (`program_year_id` NOT NULL). There is no club, permit or booking source
    column; the provenance columns are `source_tournament_game_id` and `source_basic_event_id`. Rep events can be
    cancelled, never postponed.
- **House league's practices** (`league_practices`; `house-league/.../schedule/page.tsx:636-769`):
  - Columns: team (required), season, division (informational, never checked against the team), `scheduled_at` /
    `ends_at`, one line of `location` ("Venue — Facility"), the two venue links, notes, status `scheduled|cancelled`,
    `recurrence_group_id`. **No source, no creator.**
  - **After a practice is made it can only be cancelled** (one / remaining / all); no edit, move, delete or un-cancel.
  - **Writes: owner and league admin only; a club admin is refused** (403 on every write, `practices/route.ts:65-66`).
  - **Families never see practices**: the public league pages read games only; no feed; no notice on create or cancel.
  - House-league team coaches have **no accounts** (`league_teams.coach_name` is free text).
  - The admin's Practices view lists one team at a time, "Week of …" groups (a Stage 9 finding already, 6c).
- **The club calendar and the clash check:** read the rows above directly (§3.1).
- **The team's feed:** the per-family feed exists (`/api/family/calendar/[token]`) but **drops cancelled events** and
  needs a verified guardian link, which the guardian switch keeps off — so effectively no family receives it; the
  team-wide feed's token still has no caller (D07); the coach has a download only. **Today a "From the club" practice
  could reach a family only through the team's public page** (visibility "Public link"), and only as a real row in the
  team's current season. 6d is where this changes.

### 3.3 The tournament generator as built (Tournament Stage 3, built 2026-10-09: `279f1e5d` … `35e6ec2b`)
- **The window** (`schedule/Generator.tsx`, words `lib/schedule-words.ts:168-272`): `KitDialog kind="form" wide`,
  "Round-robin generator", "{event} · step 1 of 2 · settings" → "step 2 of 2 · drafts for {division}".
  - Settings, one scroll: *What it pairs* (division, games per team, pair) · *When* (Day / From / Until rows, "Add a
    day", game length, turnover) · *Where* (venue + facility chips, All · None, a taken line) · *Rules* ("Aim for"
    presets; "More rules" folded). Foot: "{div} has N games." + lime **Generate drafts**.
  - Drafts: up to three cards in a 17rem column (label, a score "/100", measures), "Three more drafts", the chosen
    draft's games by day as the kit's row list, **one statement of what saving does**, foot "Back to settings" + lime
    "Save and replace N games" (asks once).
- **Nothing in it is shared yet** — its own header says so (`Generator.tsx:16`: "The frame is tagged for Club Stage
  11's scheduler (A40); nothing here is shared yet"). The "shared candidates" are a look, not code:
  - The engine (`lib/schedule-generator.ts`) assigns **two-sided matchups** to point slots of **one length**, ranked
    by per-game penalties (games a day, rest, back-to-backs, field moves). Slot building lives in the component.
  - ⚠ Its `isEdgeSlot` penalises slots **before noon or from 5 p.m.** (`:466-469`) — for weeknight practices that is
    backwards: evening is prime time.
  - The draft cards' measures, the health score and `draftStatement` are game measures.
- **The Timeline** (`ScheduleTimeline.tsx`): **facilities run ACROSS as 190 px columns and time runs DOWN** (~69 px an
  hour), **one day at a time**; a column exists only where a game stands that day; **an empty slot is never drawn**
  (free time is blank space). A drag shows a dashed preview green / amber / red, a red drop carries its reason and
  springs back, played games don't drag, every move ends in the 8-second notice with Undo (`NoticePill`,
  `RepKit.tsx:444` — already shared by every kit screen). The club booking's amber line arrives after the save.
- **⚠ So the words the ruling carries describe neither shape.** The 6c register's R3 and this session's prompt say "fields
  down, time across"; the built Timeline is fields across, time down, one day. The parent plan's item 3 says "facilities
  down, the hours in each day, an open slot on the page" — which is 6c's specimen 4 (facility rows, a day per column,
  each day's slots listed in clock order), the drawing the owner saw and ratified as a specimen. What the Timeline and
  specimen 4 truly share is the **question** (place time by facility and clock, with the empty time visible), and the
  **behaviour** (drag with a preview, a refusal with its reason, Undo). Finding P11-01, Ask 12.
- **Publish** (`PublishScheduleModal.tsx`): "Who sees them" sections, an "Email the teams" checkbox (a lock line on the
  free plan), a lime that counts what it publishes ("Publish U11"). "Your game moved" notices: a 10-minute quiet window,
  a move and its move-back inside it tell nobody (`lib/schedule-change-classify.ts`, `-notices.ts`).
- Gating: `auto_schedule` = Tournament Plus (League and Club pass by rank). **No practice or scheduler key exists.**

### 3.4 Sending
- **Nothing sends to the club's staff.** No door to every rep coach, every league admin or an outside contact. Narrow
  per-team notices exist (`tellClubTeamStaff`, `tellTeamMoneyPeople`).
- **The complete precedent is Stage 3a's reminders** (`/api/admin/accounting/reminders`, `RemindersWindow.tsx`): a GET
  preview (per team: recipients, lines, amount; `unreachable` with reasons — *has no head coach* / *has a head coach
  invitation nobody has accepted yet* / *has no one with money access but you*), a sample email ("See {name}'s email"),
  "Last sent {day} by {name}", a POST of the confirmed teams that the server recomputes, a database claim that refuses a
  second wave inside 60 s, reply-to the sender, the sender never a recipient. Log: `rep_allocation_reminder_waves`.
- **Who has schedule access on a team:** `canViewSchedule` over the staff membership's capabilities
  (`lib/coach-capabilities.ts:656`; every preset includes the schedule, a head coach can hide it). Head coaches:
  `coach_role='head_coach'` (several allowed); unanswered invitations via `loadHeadCoaches`.
- **Family email** goes through one choke point (`sendFamilyEmail`, `lib/family-email.ts:184-198`: suppression list,
  CASL footer, unsubscribe). **Staff email** goes as colleague mail (`sendEmail` with reply-to; the practice-plan email is
  the colleague precedent, which checks the demo org itself). Bounces aren't tracked anywhere.
- **No email carries an attachment; every PDF is made in the browser** (jsPDF). A schedule PDF exists for tournaments
  only; the coach's schedule, house league's and the club calendar owe one in the export catalog.
- **A coach notice fits the existing pattern**: a new event in the coach's "Your club" notification group
  (`AccountNotificationsClient.tsx:159-191`), linking to the team's Schedule. Today **a club change to a booking
  notifies no one** (a venue rename is copied onto upcoming bookings without a notice).
- The tournament's coach send caps the free plan at 100 recipients and 10 sends a day; its preview shows a count only.
  ⚠ Its send loop counts a failed `sendEmail` as sent (`communications/route.ts:316-331`) — found, not this stage's.

### 3.5 Money
- **The club budget** (`org_budget_lines`: fiscal year, category, item, description, total, notes; one line per word
  per fiscal year). **Entries carry a budget WORD, not a line** (mig 317 superseded J4-024); Budget vs. Actual matches by
  word. Allocate draws from a line (`rep_cost_allocations.source_budget_line_id`).
- **The words already exist:** platform category **Facilities** with Diamond Permits, Dome Time, Field Equipment,
  Lighting Fees, Indoor space, Cage or tunnel rental (migs 027, 241, 242; Diamond Permits and Dome Time tagged
  softball/baseball only). No "Field rental" word.
- **The fiscal year** (mig 318, `org_fiscal_years`): a ledger line files by its date, a plan line by its year, an
  allocation by its line's year; a closed year is locked.
- **Splits:** Evenly · By amount · By percentage · **By sessions** — and sessions are already weighted by each team's
  count (`lib/club-bill-split.ts:146-156`; ⚠ the dictionary still says "entered manually", stale). **"A dome rental split
  by the hours each team got" is the sessions split with hours as the weights** — new words and a prefill from a
  finalized schedule, not a new split.

### 3.6 Counts (read-only, `.probe/s1011/counts.mjs`, 2026-10-10)

| | Dev | Prod |
|---|---|---|
| Orgs on a plan with the Venue library (League Plus, Club, Club · Association) | 10 | 1 (the coach demo) |
| … of those with at least one venue | 1 (uat-rep-club: 3 venues, 5 facilities) | **0** (no venue rows at all) |
| Club budget lines under a permit or facility word | 5 of 18 ("Diamond permits — city fields" ×4, $29,000; "Diamond & facility permits" $11,200) | 0 of 0 |
| **Coach (team) budget lines under one** | Diamond permits 12 ($30,800); Dome time / winter dome block 6 ($24,000); Diamond rentals 2 ($6,000); others | **Dome time $10,000; Diamond rentals $6,000; Cage or tunnel $4,983.30; Diamond and dome $2,800; Diamond permits $1,600; Winter cage $1,400** |
| House-league seasons · practices | 8 · 6 (2 seasons have practices; uat-rep-club's Fall 2026: 4, one series, all on a club venue) | 0 · 0 |
| Rep events on a club venue | 9 of 279 (all uat-rep-club practices) | 0 of 133 |
| Rep events that mention a dome, cage, tunnel, gym, bullpen or indoor time | 0 | 0 |

**What the numbers say.** No customer holds a venue, a permit or a house league on production, so nothing migrates and
nothing breaks. **Facility time is real money on production today, and it sits in the TEAMS' budgets** — coaches budget
dome time and diamond rentals themselves — **and on no schedule**: nobody records indoor time as an event. The features
assume the club holds the time and hands it out. That is the owner's design for a club, and it is right for one; it
also means a team that rents its own dome time keeps doing what it does today (a practice on a typed place). Recorded,
not an ask.

### 3.7 Records this session corrects or flags
- Parent plan, Stage 11: "Asks … (all OPEN)" → ruled 2026-10-08 (corrected in place).
- Parent plan, Stage 10: its shape now lives here (a pointer added).
- **The 6c register's R3 and the prompt's "fields down, time across"** — the built Timeline is fields across, time down
  (P11-01). The standard's text is `/design`'s and Stage 8's to true when Ask 12 is ruled; this session doesn't edit it.
- The permit hook's "without changing a caller" (P11-04); the dictionary's "sessions entered manually" (stale); the
  dictionary's three stale house-league lines (the practice entitlement gate, game DELETE now a hard delete, the fixed
  server-timezone trap) — for the next dictionary pass, not this session's file.

## 4. Findings (P11-01 … P11-12)

| ID | Sev | What it is | Where it lands |
|---|---|---|---|
| **P11-01** | H | **"The Timeline's shape" names two different layouts.** The built Timeline is one day, facilities across, time down, no empty slot drawn; the ruling's words say "fields down, time across"; the drawing the owner saw (6c specimen 4) is facility rows × a week of days, each day's slots in clock order. A scheduler that copied the built Timeline could not show a week or an open slot. | Ask 12 |
| **P11-02** | H | **Nothing in the tournament generator is shared yet** (its own header says so). Its engine pairs two-sided games, and its edge-slot rule penalises evenings — prime time for practices. "Wear the shared candidates as built" can only mean the frame and the look. | Ask 5 |
| **P11-03** | M | **"From the club" already means money.** The coach's Money › Club tab labels a request the club pays as "From the club". The same words on a practice would give one phrase two meanings in one portal. | Ask 16 |
| **P11-04** | H | **The clash rule would misread the club's own slots.** (a) Two teams sharing one lane in one slot ("teams at once") are two rows on one facility at one time — `booked_by` would flag the club's own plan as a clash. (b) "Not inside a permit" is not a pair, so it cannot ride the pair machinery the hook assumed. (c) The pool holds club-venue bookings only, so "never on a team's game day" cannot read it: an away game is on a typed place. | §5.2, §5.4, Not drawn |
| **P11-05** | H | **The mirror writes on read.** Copied, a club slot would reach a team (and the club calendar, the clash check, the team's feed) only when someone opens that team's schedule. A send must write the rows, once, when it is sent. | §5.4, Not drawn |
| **P11-06** | H | **A team event belongs to one season.** A January dome slot lands in the team's working season at the send; a team with no running season can't take one (New allocation already refuses those); a team that starts its next season mid-schedule would strand its upcoming slots in the closed season (which becomes one page). | Ask 15 |
| **P11-07** | H | **House league cannot hold a club slot today**: no source or creator column, cancel-only, owner and league admin only (a club admin is refused), families never see a practice. Ask 6's "reads as the club's own booking" needs a source link, a writer the schedule runs, and the role answer. | Ask 6, Ask 10 |
| **P11-08** | M | **Nothing sends to staff, there is no facility contact anywhere, and no email carries an attachment** (every PDF is drawn in the browser). The send needs a contact field and either an attachment pipeline or the schedule in the email's body. | Ask 7 |
| **P11-09** | M | **Edits to a sent schedule have no honest home in the plan's shape.** If a move reached the teams at once, a rearrangement in progress (swap two, then move a third) would land on families' calendars half done, before anyone was told. | Ask 14 |
| **P11-10** | L | **The split by hours already exists as By sessions** (weighted by count). A finalized schedule can prefill hours as the weights — words and a prefill, not a new split. | Ask 8 |
| **P11-11** | L | **Facility time on production is the teams' money today** (coach budgets: dome time $10,000, diamond rentals $6,000, cage $4,983) and is on no schedule. | §3.6, recorded |
| **P11-12** | L | **A move in a weekly schedule has no "which weeks" answer.** The grid shows a real week; a drag must say whether it moves this week's slot or every week's. The coach's repeating-event pencil already asks this (design log 2026-10-09). | Ask 13 |

## 5. The proposed shape (drawn on the hub; every word a draft for `/marketing`)

### 5.1 One model of the club's time — the block
A **block** is one weekly stretch of time at one place: a venue, a facility (or every facility there), the days of the
week, a start and an end, and a date range; dates off are held beside it. **A permit is a set of blocks** the club holds,
with its issuer, reference, cost and document. **A schedule's time is a set of blocks** too — picked from a permit in
one choice, or entered by hand where the club holds no permit (its own field, a school gym it books by phone). A schedule
cuts its blocks into **slots** (slot length, changeover, teams at once) and gives each slot to a team. There is never a
second model of the club's time.

### 5.2 Permits (Stage 10)
**Where they live (Ask 1).** In the Venue library, which becomes **the club's venues and the time it holds there**:
- The page's toolbar gains a two-way switch **Venues · Permits** (the olive switch: it chooses what is read). Permits is
  a table at 1200: *Permit* (its name; issuer · reference under it) · *Where* · *Dates* · *A week* (hours held a week) ·
  *Used* (a percentage, "51 of 80 h" under it) · *Cost* · chevron; band rows *In use now* · *Starts later* · *Ended*;
  the fiscal-year pill scopes it (the year a permit starts in, Ask 2). Export (Excel first) above the table; **Add
  permit** the one lime, for savers.
- **A permit can cover several venues** (a town's season allocation often lists several parks under one number), so it
  is the club's record, not a venue's child. Each venue's window gains a **Permits** section listing the permits that
  hold time there, each row opening that permit (the window turns into the permit's, the 3d door rule).
- Not under Accounting, which cites a permit's cost and never owns it.

**The permit's window** (the kit's form window, reads first, the head's pencil edits the whole record, autosaved):
- Eyebrow "Permit · 2026–27" (its fiscal year); title its name ("Fall diamonds 2026").
- **The permit:** Issuer (a payee from the club's payees — "Town of Milton"), Reference ("P-2026-1187"), For (the club ·
  rep teams · house league · a team), Dates ("Sep 8 – Oct 29, 2026"), Document (the issuer's PDF, its name and size; a
  new upload).
- **The time:** its blocks as rows — "Lions Park · Diamond 2 · Tue, Thu · 5:30–9:00 p.m."; dates off; "80 h held".
- **Cost:** the joined band (Cost $3,200.00 · An hour held $40.00 · On the budget *Diamond permits · 2026–27* →).
- **Use** (the number a facilities person takes to the municipality): the joined band (Held 80 h · Booked 51.5 h ·
  Unused 28.5 h — the drawn fourth tile, "Outside it", was removed by the owner 2026-10-11, see the header), then a row
  per block (held, booked, unused, who booked it); **Export the use** above the rows (Excel); a door for builders, "Hand
  out this time in a schedule ›".
- The body ends with **Renew for next year** (a copy a year on: the same blocks and issuer, dates +1 year, no reference,
  document or cost — `RecordAction`) and **Delete this permit** (red, only when no schedule hands it out).
- **Add permit** (create asks): Name, Issuer, Reference, For, Dates, the blocks (rows with "+ Add a block"), Dates off,
  Cost, Budget line, Document; foot Cancel · **Add permit**.

**The clash check's second question (Ask 3).** A booking at a venue where the club holds a permit for those dates, but
outside every block of it, gets **one quiet line** under the Venue field (never amber, never a refusal): *"Not inside the
club’s permit for Diamond 2. It covers Tue and Thu, 5:30–9:00 p.m., until Oct 29."* It appears on every form that asks
where (the coach's Add Event, house league's game and practice, the tryout day, the tournament's game window) — where
the booking can still change. It is **not** on the club calendar's rows (they stay as quiet as 6c drew them); the read
window says it once (the permit's Use counted it too, until the owner removed "Outside it" 2026-10-11). A club with no permits, and a venue the club holds no permit at,
sees nothing new. Built as its own answer beside the pair rule, not a third clash kind (P11-04b).

**Money (Ask 8a).** A permit names its budget line (the line's fiscal year + word, e.g. *Diamond permits · 2026–27*), and
that line's window gains a **Permits** row listing what it pays for (name, dates, cost). Allocating the cost to teams is
today's **Allocate** from the line. Paying the town is an ordinary Ledger expense filed under the same word.

### 5.3 The scheduler (Stage 11) — where it lives and its list
- **Schedules** is a rail row directly under **Calendar**, shown to those who build (owner, admin, a league admin); the
  More sheet carries it too. Calendar reads what is booked; Schedules is where the club hands its time out — two jobs,
  two rows (the 2026-09-30 rule: separate jobs list in the rail).
- **The Schedules list** (1200 table): *Schedule* (name; where under it, "Lakeshore Dome · Lanes 1–2") · *Dates* ·
  *Teams* · *Slots* ("288 handed out · 64 open") · *Last sent* ("Dec 14 by Jordan Reyes" / "Not sent") · chevron; one
  state chip only where it needs saying (**Draft**, amber **Changed since sent**; a sent schedule says nothing more);
  band rows *In use now* · *Coming up* · *Ended*. **New schedule** the one lime.

### 5.4 The scheduler — settings, drafts, the grid
**New schedule** opens the tournament generator's frame (the kit's wide form window, two steps), worn as a look (Ask 5):
*"New schedule · step 1 of 2 · settings"*. Three sections (Who and How much became one table on 2026-10-11, Ask 18), the rare ones folded:
1. **The time.** Name ("Winter dome 2026–27") · **Start from** (Nothing · a permit — "Lakeshore Dome · Winter 2027" fills
   the venue, facilities, dates, hours and dates off in one pick · last year's schedule, its settings a year on) · Venue
   and facilities (the library's venue search, then facility chips with All · None) · From / To · Days and hours (rows:
   *days* · *from* · *until*, "+ Add hours") · Slot length · Changeover ("Between slots on one facility") · Teams at once
   ("Teams sharing one facility in one slot", 1 by default) · Dates off (chips). A summary line: "12 weeks · 2 lanes ·
   30 slots a week · 354 slots".
2. **Who, and how much** (one card — ⚖ redrawn 2026-10-11 at the owner's ask, Ask 18): **New allocation's form table
   (3c Ask 11) for time.** *Split the time* · **Evenly** · **By percentage** · **A set number a week** (one dropdown, as
   New allocation's Split). The teams sit under their group headings (the club's own groups from Rep Teams, in its
   order; "Not in a group" last); a heading's tick ticks its teams (tri-state); each team shows the season it is running;
   teams with no season running sit in one disclosure line. Under By percentage or A set number a week, **a group row
   takes a figure that spreads over its ticked teams** (60% over four teams = 15% each, exact to the hundredth by the
   largest remainder; "3 each") and **any team can be retyped**, the heading then showing the group's sum; a Slots column
   says what each share comes to in whole slots. The **closing row** says what the ticked teams take and what is left
   open ("8 teams · 100% · 352 · Nothing left open"); **under 100% leaves slots open, over 100% holds Generate drafts**
   with the reason beside the button (the money window's refusal in the foot). Two things money never had: **Prime
   time** — *Shared the same way* (recommended: a 60% group gets 60% of the prime-time slots too, so a share can't be met
   with late nights) or *Shared evenly by team*; and **the shares hold every week** (recommended, so a group can't take
   its share early; said in one line, not a control). A rule that stops a share being met (a weekly cap of 3 would hold
   Senior to about 41%) shows in amber on the draft card and in Fair shares. House league's divisions join as groups with
   Stage 9 (Ask 6). The foot counts what Generate will hand out ("288 slots for 8 teams.").
3. **Rules** (folded, "Rules · 4 on"): earliest and latest start by age group ("9U AA, 11U AA · finish by 8:00 p.m."),
   at most N a week per team, **never on a team's game day** (read from each team's whole schedule — away games
   included, P11-04c), **never over a booking already on the books** (6a's pool), **prime time** (which hours count:
   "weeknights 6:00–8:00 p.m.") with *keep each team’s nights* or *rotate prime time weekly*, no back-to-back days, and
   ⚖ **Teams’ days off** (added 2026-10-11, Ask 20): a team and a date ("13U AAA · Sat, Feb 6 · away at a tournament")
   or every week ("11U AA · Every Tuesday"); the club-wide Dates off stay in The time.
Foot: "288 slots for 8 teams." (what Generate hands out) · Cancel · lime **Generate drafts**.

**Step 2, drafts** — the tournament's layout: three ranked cards (label, a score, the measures that matter here: *every
team gets its share*, *prime time 23–24 each*, *the same nights every week* or *rotated*, *clear of club bookings* /
*leaves out the 2 slots 13U AAA’s tryout day holds*), "Three more drafts". ⚖ **Redrawn 2026-10-11 (owner, Ask 19):** the
chosen draft reads **By team · By day** (the olive switch) — By team (team · slots · prime time · nights) for fairness,
**By day** for the full review: a band per day and every slot of every day as one compact row (time · team · lane;
open slots say Open), the whole schedule scrolling in the window — with **Export** above it (Excel, PDF; "Best overall ·
a draft · 354 slots"; no Calendar file for a draft). Then **one statement**: *"Saving keeps Winter dome 2026–27 as a
draft. Nothing reaches a team until you send it. On its page you can read every week, export it, change these settings
and adjust it by hand."* Foot: Back to settings · lime **Save as a draft** (was "Save the draft", which read as a
commitment; /marketing). The draft opens on its page. A grid inside the window is not drawn: the 1200 grid doesn't fit
an 800 window, and a smaller second grid would be a fourth calendar shape.

**The schedule's page** (1200; back arrow to Schedules; title its name; the eyebrow says where and when; **Draft** chip):
- **The toolbar line (C4):** the view switch **Grid · By team · By group** · the week ("‹ Jan 4 – 10, 2027 ›") ·
  Facility · Team pills · the amber clash pill (only when there is one) · ~~"Times in Eastern time."~~ · Tools (Regenerate the
  unlocked slots… · Lock this week · Clear this week… · Settings… · Send log) · Export · the lime (**Send** on a draft,
  **Send the changes** once changed, absent when nothing waits). **The zone sentence REMOVED here (owner, 2026-10-12,
  walking §300):** the page's readers are the club's own admins, in the club's zone; the PDF and workbook keep it.
- **The grid (Ask 12): facilities down, the week across, each day's slots in clock order** — 6c specimen 4's layout. A
  slot chip: the time range on its first line (R9), the team on its second, the team's colour as its edge (R4); an
  **Open** slot dashed; a locked slot's padlock; 6a's amber flag on a clash; a day with no time held reads "—"; today's
  column "Today · …" when the week holds it (C7). Monday first (C2), "Jan 4 – 10, 2027" (C8).
- **Beside it, the fairness panel** (a 300 px card): the joined band for the whole schedule (*Handed out 288 of 354* ·
  *Open 64* · *Short 0* · *Clashes 0*), then a row per team (swatch · team · this week · the schedule · prime time),
  short teams and clashes in amber words with the date. It updates as slots move.
- **Adjusting (the Timeline's behaviour, not its axes):** drag a team onto an open slot (move) or onto another team's slot
  (swap); the dashed preview reads green / amber (a rule broken, a club booking there — warns, drops) and a refusal only
  for the schedule's own overlap (the same team twice at once); **a drop asks which weeks** (Ask 13: *This week only* ·
  *This & later weeks* · *Every week*); every move ends in the 8-second notice with **Undo**. A slot opens a small window
  (when, where, team; *Change team ▾*, *Lock*, *Clear*). Locked slots stay put through **Regenerate the unlocked slots**.
- **Back to the settings (Ask 19):** Tools › **Settings…** (first in the menu) reopens step 1 with every value as saved.
  **A slot moved by hand locks itself** (its padlock appears; unlock to free it), so generating again never undoes a
  decision made on the grid; keeping a new draft asks once — *"Regenerate Winter dome 2026–27? … The 3 slots you locked
  and the 6 you moved by hand stay where they are. It hasn’t been sent, so no team is told."* · Keep it · Regenerate. On a
  sent schedule a regenerate is a change to send.

### 5.5 Summaries, export, print
- **By team:** a table — team · slots · hours · a week · prime time (count and share) · nights · a short mark; band rows
  by group; a row opens that team's slots as a list.
- **By group:** Senior · Junior (a rep club’s first fairness question); house league joins as its own row with Stage 9.
- **The whole schedule** is the Grid stepped week by week. **Export** (one button, Excel first): *Winter dome 2026–27 ·
  354 slots* — Excel (a row per slot), PDF (by facility and week: the printed schedule), Calendar (.ics, once sent).
  Print = the PDF.

### 5.6 Send, and after it is sent
> **⚖ AMENDED 2026-10-12 (owner, walking §300 W7): the venue is never told.** *"I think the permit contact should not be
> part of this communication, this is between clubs and their coaches."* The bookings contact's row, its email and its
> place in the count are gone from every send (review, final, changes) and from the Sent log; a club that wants its venue
> to have the schedule sends it the Export. The venue keeps its **Bookings contact** field as a contact (owner's pick:
> keep it rather than remove it — no schema change mid-walk). Why it holds on merit: the owner's own stakeholder list
> (2026-10-08) was league admins and rep coaches; the venue came in with P11-08 and was ratified in the batch; an email to
> an outside business, ticked by default, wrote to the club's landlord on every Finalize and offered to on every Send the
> changes. The text below keeps the words it was ratified with; Ask 7 carries the same note.

**Send** (a form window over the page, the reminders window's shape — Ask 7, Ask 9):
- **What sending does**, one statement: *"288 slots become bookings: on 8 teams’ schedules, on the club calendar and in
  the clash check. Families see their team’s slots on the team’s schedule."*
- **Who is told:** per team, its head coaches and staff with schedule access ("15U AAA · Dana Whitfield, Sam Ortiz ·
  36 slots"); house-league admins (the whole schedule by team); the venue's **bookings contact**
  ("bookings@lakeshore-dome.example · the whole schedule by facility"), each row ticked by default; **Nobody to send
  to** for a team that can't be reached, with the reason (the reminders' words); **See 15U AAA’s email** (the sample).
- "Last sent … by …" under it; foot Cancel · lime **Send to 12** (eleven coaches and the dome).
- **What a coach receives:** one email per team, the slots as a pattern ("Tuesdays 6:00–7:00 p.m. · Lane 1, Jan 5 – Mar
  23, not Feb 16"), a link to the team's Schedule, and how to hand one back; a **Your club** notice in the bell. The
  bookings contact receives the whole schedule by facility in the email's body (no attachment in the first cut, P11-08).
  Families are never sent it.
- **After it is sent (Ask 14):** the teams keep what they were sent until the next send. An edit marks the schedule
  **Changed since sent**; a white callout with an amber edge above the grid lists what moved ("13U AAA · Tue, Jan 12,
  7:00 p.m. → Wed, Jan 13, 8:00 p.m. · Lane 2") and **Send the changes** (the line's lime) applies them to the teams'
  schedules and tells only the teams whose slots moved (and the bookings contact, ticked). Undo works until then.
- **Handed back:** a coach's hand-back is the coach's own act and lands at once — the slot reads *Open · handed back by
  13U AAA* on the grid, the builders get a notice, and reassigning it is a change to send.
- **The send log:** Tools → Send log lists every send (when, by whom, how many people and teams, the whole schedule or
  the changes).

### 5.7 What each person sees
- **A club admin** records the town's permit once (Venue library › Permits), sees at a glance how much of it the club
  uses, names the budget line it is paid from, builds the winter dome schedule in one window, adjusts it on a grid that
  shows every open slot, reads it by team for fairness, sends it to the coaches with a preview of who gets what, and
  sends only the changes afterwards.
- **A head coach** finds the club's slots on the team's Schedule, each marked as coming from the club's schedule, with
  their own arrival, notes, attendance and practice plan; can't move or delete one; can **hand one back** (this one,
  this & future, or all), which frees it for another team. One email when the schedule is sent, one when their slots
  change.
- **A house-league admin** builds house league's practice schedule the same way (their own teams only); the practices
  it makes read as the schedule's on house league's Practices view and change only in the schedule (Ask 6).
- **A family** sees their team's club slots on the schedule they already use (the team's public page today; the
  team's feed once 6d lands). Nothing new to learn, and no email from the club about it.

### 5.8 What 6d's feed must carry for this
Every club slot as an ordinary practice in the team's feed; a slot the club cancels stays in the feed marked cancelled
(today's family feed drops it — 6c already handed 6d that fix); a handed-back slot leaves the feed; the slot's time in
the club's clock. 6d designs it. (Owner 2026-10-11: the dependency runs the other way — the feed reads the practice rows
the scheduler writes — so 6d no longer gates the scheduler.)

### 5.9 A phone
The scheduler is desk first. **A phone reads:** the Schedules list (white cards), a schedule By team (cards) and its week
as day frames (one frame a day, its slots as hairlined rows — C13), the send log, and **Send the changes** (a confirm).
**Not on a phone:** New schedule and the grid's dragging — their doors are absent at phone width, not dead-ended.
> **⚖ CHANGED 2026-10-12 (owner, walking §300 on a phone): a phone reads Day · By team — "Week" is gone there.** The
> owner: *"should a phone on schedule only see 1 week if 'week' is selected? also, should there be a 'day' option for a
> phone since these schedules could be quite large? it should only toggle days with actual events."* What the code did:
> the phone's Week borrowed the desk grid's seven columns, which on a one-weekday schedule are seven DATES (the dome:
> "Oct 4 – Nov 15", seven Sundays, 84 rows). Ruled as recommended (Day replaces Week rather than joining it — on a
> one-weekday schedule a week IS a day, and the club calendar dropped its phone List for being the same stack): **Day**
> is one day's slots in one frame, its arrows stepping only through the dates the schedule has slots on (a date off is
> never a stop; a day of open slots still is), opening on today or the next day with slots (else the first), its label
> "Sun, Oct 18" (or "Today · …") over "12 slots · 2 open", tapping it lists every day to jump to — the tournament's Day
> control, `ScopeNav`, moved unchanged into the admin kit for both. The desk is unchanged.
**A coach's phone:** the club slot in the schedule list and its window at 390, Hand back at the body's end, 44 px.

## 6. The asks (each with a recommendation) — ⚖ ALL RULED 2026-10-11 AS RECOMMENDED

1. **Where permits live.** *Recommended:* in the Venue library, a **Venues · Permits** switch; a permit is the club's
   record (it may cover several venues), shown on each venue's window in a Permits section; not under Accounting.
   (Refines the prompt's "on the venue": a permit isn't one venue's child.)
   - ⚖ **Who reads a permit — RULED 2026-10-11 in the 10a build session** (the build prompt's precondition 4; owner: *"I
     agree with time to all, money to accounting"*). The question asked was "who reads a permit?"; the code made it "who
     reads a permit's MONEY?" — the Venue library opens to every admin-side role (tournament officials, staff, league
     registrars, league admins, a treasurer), and most of them can't open Accounting. **A permit's time and use read to
     everyone who opens the Venue library; its money (Cost, an hour held, the budget line) reads only to those who hold
     the club's Accounting, and only a Venue-library saver who also holds Accounting sets it.** For anyone else those parts
     are absent, not greyed. The same savers as the library write the rest. **A coach never reads a permit**: the quiet line
     names a facility, days and hours, never a cost, issuer or reference. A departure from the drawing, which showed the
     cost to whoever reads. ⚠ The issuer picker reads the club's payees, which are Accounting's: a saver without
     Accounting types the issuer's name instead (a one-time name, the Ledger's own "not saved as a payee" shape).
   - ⚖ **Added by the owner in the same answer — Ask 28 below:** coaches will enter their own team's permits.
2. **A permit's period.** *Recommended:* its own dates, filed under the fiscal year it starts in (a budget line belongs
   to one year); **Renew for next year** copies it a year on.
   - ⚠ **Built as a rule over the start date, not a stored link** (10a build, 2026-10-11 — a departure from the build
     prompt's `org_permits` column list, which named "the fiscal year it starts in" as a column). The club's fiscal-year
     rows are deleted and re-spanned by a change of first month and by the first close (mig 318's
     `club_fiscal_year_set_first_month`, `club_fiscal_year_close`); a stored link would either block those steps or lose
     the permit. So the permit's year is `fiscalYearOf(starts_on)` wherever it is read, the closed-year lock is
     `starts_on <= club_books_closed_through(org)`, and a named budget line must be a line of the year the permit starts
     in (checked at every save, in the route and in the database).
3. **What the clash check says about permits.** *Recommended:* one quiet line under the Venue field on every form that
   asks where, at a venue where the club holds a permit for those dates; said once in the calendar's read window, never
   on its rows; counted in the permit's Use; never blocks; a club with no permits sees nothing; built beside the pair
   rule, not as a third clash kind.
4. **Which plans carry permits** (open since 2026-10-08). *Recommended:* League Plus and both Club bands — the same as
   the scheduler and the Venue library, because they are one model of time and a League Plus scheduler with no permit to
   start from would be half a tool. Today the Facts doc says Club inclusion. **A packaging call: `/strategy` logs it and
   the Facts doc follows.**
5. **The scheduler and the tournament's parts.** *Recommended (reframed by P11-02):* the scheduler **wears the
   generator's frame and look** — the two-step wide window, the ranked cards, the row-list preview, one statement, the
   Undo notice, the publish window's "who is told" sections, 6a's amber rule — and **builds its own engine and grid**
   (time handed to teams, one-sided, measured in hours and prime time). Lifting the two-step frame into one shared window
   part, with no visible change to the tournament, is a **shared ask to the tournament redesign**; a shared engine is not
   recommended (it would rewrite the tournament's for no tournament gain).
6. **What a finalized slot becomes in house league.** *Recommended:* a house-league practice that reads *From {schedule}*
   on the Practices view and changes only in the schedule; it asks of house league's practice records a source link, a
   writer the schedule runs (move and cancel, past the owner/league-admin gate only through the scheduler's own check),
   and nothing for families yet (house league shows families no practices today — Stage 9's). **It ships with Stage 9**
   (League Plus un-parks there, and the release target runs no house league); the first cut hands time to rep teams.
7. **The send step and the stakeholders.** *Recommended:* coaches (head coaches and staff with schedule access): one email
   per team listing its slots as a pattern, a link, how to hand one back, and a Your club notice; house-league admins:
   the whole schedule by team; the venue's **bookings contact** (a new field on the venue): the whole schedule by
   facility in the email's body, no attachment in the first cut; sent when the schedule is sent and when its changes are;
   reply-to the sender. Families: never. **⚖ Amended 2026-10-12 (owner, §300 W7): the venue's bookings contact is never
   sent to — "this is between clubs and their coaches"; the field stays on the venue as a contact (§5.6's note).**
8. **Money tie-ins.** *Recommended:* (a) **first cut** — a permit names its budget line and the line lists its permits;
   allocating is today's Allocate; (b) **later** — split a cost by the hours each team got as the existing **By
   sessions** split, prefilled with hours from a sent schedule (small: words and a prefill, P11-10).
9. **One club send, or two?** *Recommended:* one send window and one send log shape for every club send — the reminders
   (built), the schedule, and Stage 7's message every family — with two mail paths (families through the family choke
   point and its suppression; staff as colleague mail). Said now so Stage 7 doesn't draw a second one.
10. **The build split.** *Recommended:* **10a permits** (the record, the venue window's section, the quiet line, the
    use, the budget line) → **6d feeds** → **11a the scheduler for rep teams** (the record, settings, drafts, the grid,
    summaries, send, changes, hand-back, the club calendar) → **11b house league's half with Stage 9**. Each its own walk
    (§K, §L, §L-b). The release waits for 10a and 11a (and for 11b: ⚖ Stage 9 is inside the release since 2026-10-12, so 11b holds it too).
    ⚖ **Amended by the owner 2026-10-11:** 11a waits for 10a only; 6d is drawn and built on its own (the feed reads the
    scheduler's practices, never the other way round); 11a is two build prompts, part A the server and part B the screens.
11. **What the verification found** — asks 12 to 17 below, each from the code.
12. **The grid's shape (P11-01).** *Recommended:* 6c specimen 4's layout — facilities down, a week across, each day's
    slots in clock order, an open slot drawn — which is what "the Timeline's shape" meant on that drawing; it takes the
    Timeline's **behaviour** (drag with a preview, a refusal with its reason, Undo), not its axes; the standard's R3 is
    reworded to match (`/design`, Stage 8).
13. **Which weeks a move reaches (P11-12).** *Recommended:* the drop asks, with the series pencil's three rows — *This
    week only* · *This & later weeks* · *Every week* — and Undo takes back whichever was chosen.
14. **Does an edit to a sent schedule reach the teams at once? (P11-09)** *Recommended:* **no — when it is sent.** The
    teams keep what they were told; **Send the changes** applies and tells together; until then the page says *Changed
    since sent* and lists what moved. (The alternative, at once with a later email, puts half-finished rearrangements on
    families' calendars.)
15. **Which season a slot lands in (P11-06).** *Recommended:* the team's running season when the schedule is sent; Who
    lists only teams with a season running (as New allocation); **starting a team's next season carries its upcoming club
    slots into the new season**, so none strands on a closed season's page.
16. **The words on a team's schedule (P11-03).** *Recommended:* the mirror's construction — *"From Winter dome 2026–27 ·
    the club’s schedule"* and *"Only the club can move or remove this practice."* — rather than a bare "From the club",
    which the coach's Money already uses for money the club pays. Words: `/marketing`.
17. **Handing a slot back.** *Recommended:* *Hand back this practice* ends the practice's window (a rare door); it asks
    which dates with the series rows (*This practice only* · *This & future* · *All practices*) and says what it does
    ("The club can give the time to another team. Your families stop seeing it."); the builders get a notice and the
    slot reads *Open · handed back by {team}*.
18. **Sharing the time by percentage, by group and by team** (added by the owner 2026-10-11: *"can we also add the
    ability to allocate a percentage of the times to allocate by teams and groups, similar to money allocations? i.e.
    there might be a group of rep and a group of select teams, the admin might want to give 60% of the slots to the rep
    teams and 40% to the select teams"*). *Recommended:* New allocation's split, for time (§5.4 item 2): one table with
    the teams; a group's figure spreads over its ticked teams and any team can be retyped; under 100% leaves slots open,
    over 100% holds Generate with the reason beside it. **Two sub-questions money never had:** (a) **prime time** —
    *shared the same way as the slots* (recommended) or *evenly by team*; (b) **when the shares hold** — *every week*
    (recommended) or *across the whole schedule*. The groups are the club's own groups from Rep Teams, so a club that
    groups its teams as Rep and Select gets exactly that split. Drawn: specimen 4 and its By percentage frame.
19. **Reviewing a draft before keeping it** (added by the owner 2026-10-11: *"can a user export the draft and/or see a
    full list/calendar mode of every day in case they want to do a full review before saving? … (like oh I forgot 13U AAA
    asked for a day off on the sunday before Christmas)"*). *Recommended:* the drafts step reads **By team · By day** and
    has **Export** (Excel, PDF) before anything is kept; the button says **Save as a draft** and the statement says the
    draft's page is the full review (every week on the grid, by team, by group, Export, print); **Tools › Settings…** goes
    back to the parameters; **a slot moved by hand locks itself**, so a regenerate keeps every hand change and asks once.
    The reframe: saving a draft was already safe (it reaches nobody), but nothing on the window said so. Not
    recommended: a grid inside the window.
20. **A team's days off** (found in the owner's own example for Ask 19). *Recommended:* a rule, **Teams’ days off** — a
    team and a date, or every week (a weekday); the generator gives those slots to others. Today's Dates off are the
    club's only, so one team's day off could be fixed only by hand after generating. A date a coach has already put on
    the team's own schedule needs no rule: "never over a booking already on the books" reads it.

**Asks 21–27 come from the owner's common flow, walked 2026-10-11 (§6a), and the export instruction (§6b):**

21. **A permit prices its fields.** *Recommended:* a block covers several facilities ("Fields 1–6"), and each field in a
    permit takes **Full cost · Half cost · a share you type**; the permit works out an hour of each ($72.00 a full field,
    $36.00 a half). The prices are the permit's, never the venue's (the venue keeps the sizes; next winter's contract may
    price them differently); Renew carries them.
22. **Fields by group.** *Recommended:* a rule that keeps facilities for a group or a team ("Fields 5–6 · only for
    Junior"); the generator places nobody else there (also: pitching lanes for pitchers, the turf for older teams).
23. **Bill the teams from the schedule.** *Recommended:* "The bill" in Fair shares opens **Bill the teams**, filled in
    from the schedule and its permit: the budget line, the cost (all of it, or a part when the club covers some), the
    split **By the time each team got** (each field at its price), payments that **follow the time** (One · Monthly ·
    Every two months · Dates I choose; each payment that team's slots in its months), a form-table closing row that says
    whether it matches the permit. The bill **rides with the schedule** and becomes one club allocation, each team with
    its own payments, **at Finalize** (a bill goes live when made and its terms never change, 3d Ask 7b). This brings
    Ask 8b into the first cut. Sub-questions: (a) a change after Finalize that moves a team's time is billed as a
    correction (a second small bill) — recommended — rather than reopening the first; (b) a team still on last season at
    Finalize gets its bill on that season (today's rule), so finalize once the teams have started their winter season.
24. **A review round before Finalize.** *Recommended:* Send gains **For review first** (the default when a bill rides
    with it): each coach sees their slots and their bill together and answers **Looks good** or **Ask for a change** by a
    reply date; the replies show on the schedule's page; **Finalize and send** whenever the admin is ready — never held
    up by a team that doesn't answer. *Final now* stays. ⚠ **Amends Stage 11 Ask 1 (2026-10-08)**, which rejected
    coach acceptance ("slow, leaves slots unclaimed"); the round keeps that reason (nothing waits for a team) and meets
    the owner's own step, "for review and approval".
25. **The team's budget reads the club's bill.** *Recommended:* at Finalize the bill arrives **filed under the club
    line's word** (Facilities › Dome Time), so Budget vs. Actual puts its payments on that row; where the coach's own
    plan for that word differs, one callout offers **Use $2,700.00** or **Keep mine**. The club never writes the team's
    budget (D1); the coach presses Use. The filing stays the coach's to change.
26. **Every export in the house format** (an owner instruction, §6b; only its three gaps were asked): the club Excel
    reports get the club's logo (fixed with these exports); the new workbooks set print setup (landscape, fit to width)
    and a text page footer ("Page n of N · Generated by FieldLogicHQ"); the FieldLogicHQ mark stays the last row (an
    image can't go in an Excel page footer reliably). Every other report keeps its format until the owner asks.
27. **A one-day-a-week schedule reads its dates across.** *Recommended:* when the time falls on one weekday, the grid's
    columns are that day's dates, seven at a time ("Oct 4 – Nov 15, 2026"), the facilities down; a register entry R12.
28. **Coaches enter their own team's permits — OPEN, its own drawing** (added by the owner 2026-10-11 in the 10a build
    session, answering who reads a permit: *"we will need to leave this open to allowing coaches to enter their own
    permits as well. while the club will often take care of the larger permit items (i.e. a season diamond schedule, off
    season dome training, etc.) often coaches on the side get permits for supplemental events for their team (their own
    gym practices, exhibition games, etc.). the club should have visibility into permits the coaches got so they can see
    where they can get permits for their other teams and also as a way to verify the coaches are getting the permits they
    should be getting."*). Read in the 10a session as **design for it now, draw and build it as its own step** — no
    drawing shows a coach entering a permit or the club reading the coaches' permits, and a screen is never built
    without an approved drawing; said to the owner before the work. *Recommended shape, for its drawing session:*
    - **One record, two holders.** A permit is held by the club or by one team (a holder column added then), never a
      second table: the coach's permit is the same record, its blocks the same blocks (the one model of time).
    - **Where a coach enters it:** the team's own places (the coach's place book, mig 307) are where a team's gym lives;
      a coach's permit names one of the club's venues OR one of the team's own places — so the block's place becomes
      "a club venue or a team place", the one shape 10a deliberately did not build (`org_time_blocks.org_venue_id` is
      NOT NULL today).
    - **Money:** a team's permit cost is the TEAM's (its budget, its ledger, D1 — the club never writes a team's book);
      it never files under the club's fiscal year.
    - **What the club sees:** the Permits view lists the teams' permits in their own band ("Held by teams"), each naming
      its team, read-only to the club; the "where can our other teams get permits" question reads the issuer and place.
    - **The quiet line for a team's own permit** applies to that team's bookings only.
    - **Packaging:** whether a standalone Premium Coaches Portal team gets permits is NOT ruled — a `/strategy` question
      at its drawing (Ask 4 covers League Plus and both Club bands only).
    - **What 10a leaves ready:** nothing is built for it; the additions are a holder column and a block place that may
      be a team place — an `ADD COLUMN` and a relaxed `NOT NULL`, no rewrite. The fiscal year is already a rule over the
      start date (Ask 2's note), which a team's permit simply never reads.

**⚠ Found 2026-10-11 while writing the build prompts — two questions the ratified asks did not see** (hub Decisions
"Build question A / B", open; `CLUB_SCHEDULER_A_BUILD_PROMPT.md` precondition 4). The rulings stand; these narrow how two
of them are built, and are the owner's before 11a's money part.
- **A · Who files the club's bill on the team's budget (Ask 25).** Ask 25 pre-files the bill under the club line's word.
  Mig 250's money design (owner question 2026-08-17) files a team's share **by the coach, never by the club**, for two
  reasons: the club doesn't know the team's words, and two teams may file one shared cost differently. *Recommended:*
  keep both reasons — pre-file only under a platform word the team's own budget already has; otherwise unfiled, as
  today; the coach changes it per team, as now.
  ⚖ **RULED 2026-10-11 as recommended** (owner, in the 11a part A build session: "Only if team has word"). At Finalize
  a team's share arrives filed under the club line's word **only when that word is a platform word** (a standard item,
  no org or team of its own) **and the team's running-season budget already has a line under it**; otherwise it
  arrives unfiled, as today. The coach changes the filing per team on Money › Club, as now. Both of mig 250's reasons
  stand: the club never files under a word the team doesn't use, and each team's filing stays its own.
- **B · A team that loses time after Finalize (Ask 23a).** A correction bill works for a team that gains time; a team
  that loses time is owed money, and a bill can't be negative or change its terms. *Recommended:* Send the changes
  previews the corrections; the loser gets a credit recorded the way the club already covers a cost for a team; the
  first bill never changes; if nothing in the money loop fits, the build stops and asks.
  ⚖ **RULED 2026-10-11 — "Bill gains, show losses"** (owner, in the 11a part A build session, after the build checked
  the money loop). **What the check found:** the club cannot give a team money on its own initiative. Club money reaches
  a team only through a bill (the team owes) or a request the COACH files and the club approves (`charge_to_org`,
  "reimbursement" — the way the club already covers a cost); a transfer into a team's book is refused (C12). So the
  "credit the money loop already offers" exists only in the coach-filed form. **Ruled:** Send the changes works out each
  team's difference since the last send, at the bill's own prices and scale. A team that **gains** time gets a small
  correction bill (one allocation per send, split `time`, its payments following the gained slots' months; it draws on
  the same budget line, so the preview says so when the line has no room, and the admin may send the changes without
  it). A team that **loses** time is shown *"owed $108.00 back"* in the preview, its email and the send log, and gets it
  back the way it would today: its coach asks on Money › Club and the club approves. The first bill never changes;
  nothing new enters the money loop; no negative allocation exists. A hand-back's money is settled the same way, at the
  next Send the changes (a hand-back marks the schedule *Changed since sent*).
- Also recorded, not a question: **the season roll's "the SCHEDULE starts fresh"** (a locked coach-portal decision,
  `lib/rep-season-rollover.ts:33`) is about the old season's own events; Ask 15's carry of a team's upcoming club slots
  keeps that reason (a club slot is the club's booking), and the build says so in the roll's header.

## 6a. The owner's common flow, walked (2026-10-11)

> Owner: *"when all the pages are done, I would like you to do a full walkthrough of the common user flow … 1. org
> owner/admin get permits for a winter dome program that runs for 6 months 2. the dome is split into 6 'facilities'
> (fields), 4 full cost fields and 2 half cost fields (size differences) 3. based on those permit times, the admin splits
> into segments (i.e. permit every sunday from 8am-11am, times are 1.5 hours for each team practice in each facility)
> 4. after schedule is made the admin allocates the cost of the permits to the teams and sets a payment schedule (i.e.
> Oct 1 pays for the Oct and Nov practices, Dec 1 pays for Dec and Jan practices, etc.) 5. admin distributes schedule and
> allocation to teams for review and approval 6. teams schedules and budgets get updated accordingly … the simpler and
> more streamlined we can make this the better we will be able to market our product. this is a real pain point for orgs
> at present."* Read as: walk it through the drawings now (nothing is built), and make it the builds' definition of done.

**Walked on the hub** (Mockups → Stages 10 + 11 → **14 · The dome, walked**) with real numbers: Lakeshore Dome (drawn),
Fields 1–4 full and 5–6 half, Sundays 8:00–11:00 a.m., Oct 4, 2026 – Mar 28, 2027 (25 Sundays, Dec 27 off), $27,000.00.
**The figures add up:** 450 field-hours held; a half field counts half, so $27,000.00 buys 375 full-field hours at $72.00
($36.00 a half). 90-minute slots: 12 a Sunday, 300 in all. Senior 1 full field a week (25 slots, $2,700.00 a team), Junior
1 full + 1 half (50 slots, $4,050.00); 4 × $2,700.00 + 4 × $4,050.00 = $27,000.00. Every two months from Oct 1: 9, 8 and 8
Sundays, so $972.00 / $864.00 / $864.00 (Senior) and $1,458.00 / $1,296.00 / $1,296.00 (Junior).

| Step | In the drawings | Found → drawn |
|---|---|---|
| 1 The permit | Add permit: one form, ~10 fields | One cost, one facility a block → field prices and a block over several fields (Ask 21) |
| 2 Six fields, two half | The venue's fields, once | Holds; the price lives on the permit |
| 3 Sundays in 90-min slots | New schedule › Start from the permit, slot 90 min, Senior 1 / Junior 2, Generate, By day, Save as a draft — ~12 presses | No way to keep half fields for Junior → Fields by group (Ask 22); a Sundays-only grid wastes six days → its dates across (Ask 27) |
| 4 Cost to the teams, a payment schedule | "The bill" → Bill the teams, filled in — 2 presses | A bill can't price each team's time or make each payment its months (24 amounts by hand today) → the split and payments that follow the time; billed at Finalize (Ask 23) |
| 5 Review and approval | Send for review → replies → Finalize and send | No review step (Ask 1 ruled none) → an optional round that never blocks (Ask 24) |
| 6 Schedules and budgets | Slots land as practices; the bill on Money › Club | The team's Budget never reads the bill → filed under the club's word, Use $2,700.00 / Keep mine (Ask 25) |

**End to end:** one permit form, one schedule window, one press to bill, one send for review, one finalize; the teams'
schedules, Club tabs and Budget vs. Actual follow by themselves; a coach answers twice (Looks good; Use $2,700.00).
**The money facts behind it** (survey 2026-10-11): an allocation already stores each team's own payments, any dates and
amounts (only the arithmetic is missing); it has no proposed state and its terms never change; no notice is sent when a
bill is made; the coach's Budget never reads club bills (Budget vs. Actual counts them once sent, under the coach's
filing); a bill binds to the team's running season. **This flow is the definition of done for 10a + 11a** (one walk, end
to end, every figure read back on both sides).

## 6b. Exports in the house format (owner instruction, 2026-10-11)

> *"when you work on the exports, can you make sure they are in the more polished formats that we have established over
> time (i.e. practice plans and lineups for pdfs, accounting reports for excel). include flhq logo in excel footers, any
> disclaimers/notes below the tables, orgs logo in top left, nice titles/headers, professional stylings in pdf, details in
> excel header with frozen pane at header row, etc."*

Drawn on the hub (**15 · Exports**) from the documents the product renders today (`npm run check:pdf -- --keep=… --only=…`:
the practice run sheet and the tournament schedule, page 1, as the reference).
- **PDF** (the schedule "by facility and week", landscape, compact): through the shared document engine — the club's
  colour band, its crest top-left beside its name and a subtitle, a hairline, the title and subtitle, a section per
  day ruled in the club's colour, the club-colour table heading row (sentence case), a faint alternate row, notes under
  the tables, the footer line (site · email · Exported · Generated by FieldLogicHQ · Page n of N). The tournament schedule
  builder's column set becomes parameters rather than a fork (its own header asks for that); a fixture in the documents
  gate holds it.
- **Excel** (the schedule: a row per slot; By team; By field — and a permit's use): the accounting reports' format — the
  masthead (title, what it holds, "As at" and who; the club's logo top-left), the slate header row frozen under it, real
  figures in the money format, a bold totals row, notes under the table, the FieldLogicHQ mark and "Generated by
  FieldLogicHQ" as the last row; the call-site joins the masthead allowlist (not a round-trip file).
- **Gaps found** (Ask 26): the club's Excel reports never get the club's logo (its export fetches paper settings for PDFs
  only); no workbook sets print setup; the FieldLogicHQ mark is a sheet row, not a page footer; no PDF draws the
  FieldLogicHQ mark (text only) — the owner's "flhq logo in excel footers" is today's row.

## 6c. Stage 11c — rules as sentences, sharing a facility, times that move (drawn and ⚖ RATIFIED 2026-10-12)

> **⚖ RATIFIED 2026-10-12** (owner: *"looks good"*, then "Yes, all seven"): all seven asks as recommended. Ask 7's
> timing: the owner first picked "build right away", then the same day *"I will kick it off when qa 300 is complete"* —
> so the build starts in its own session once §300's walks close, inside the Club release. Build prompt:
> `CLUB_SCHEDULER_11C_BUILD_PROMPT.md`. Hub v102 Decisions rows "Stage 11c · Ask 1–7".

Three owner asks from walking §300 W1, 2026-10-12: *"a simple way to have certain teams share a field but not all"* (the
junior teams split one, or "only 2 of the junior teams … because of their age"); *"is there a better way to group and
organize this page so it reads easier?"*; and *"an option for consistent times vs. spread out … sometimes they have the
early one and sometimes the later one, sometimes field 1 and sometimes field 3"*. **Ruled before drawing (owner,
2026-10-12): a shared slot counts as half a field from a cost perspective.**

**Drawn** on the hub (https://claude.ai/artifact/K4MPu4ni53Ct7yrDcmWJd9 v100, Mockups → **Stage 11c**; generator
`.probe/s11c-hub/`), `/design`-reviewed (seven drawing changes D1–D7, on its Formatting check screen):
1. **The window, regrouped** — The time keeps only time (Teams at once leaves it); Who, and how much gains *Each team's
   time* beside Split the time and Prime time whole (its hours and how it is shared); Rules lists only the rules the club
   added, each as its sentence with a pencil, opened in place (✓ in the pencil's spot, *Remove this rule* in ink at its
   end), one *Add a rule* menu for every kind, the three safeguards as ticks under *Always*.
2. **Sharing a facility** — a rule naming teams or a group, 2–4 at once; named teams are paired whenever a partner is free,
   everyone else keeps a facility; a shared chip shows both names stacked, the edge in both teams' colours; Fair shares
   counts hours (a shared slot and a half field each half); the bill charges half each.
3. **Times that move** — *Each team's time*: The same each week (today, the default) · Moved around (start and facility
   taken in turn within each team's rules, days kept); it answers prime time's Keep/Rotate too; the drafts follow.

**Findings (S11C-01…06, read from the code 2026-10-12):** 01 Teams at once is one number for every slot (any team takes
any seat); 02 Bill already splits a shared slot's minutes among its teams, but the generator's results and Fair shares
count it whole for each team; 03 continuity keeps each team's facility, start and day, and only prime time rotates (and
only where it is set — the dome has none, so every Sunday is identical); 04 prime time is set in Rules and shared in Who;
05 Rules draws every kind, empty (≈13 controls for one rule); 06 a permit's half facility already counts half, so a
shared half facility would be a quarter.

**Asks (⚖ ratified 2026-10-12 as recommended; the reasons on the hub's Decisions tab):** 1 sharing is a rule about teams; 2 paired
whenever a partner is free; 3 a shared slot counts half toward a share everywhere time is measured (A set number a week
still counts practices); 4 Each team's time, days kept; 5 prime time whole, one keep-or-move choice, the drafts follow
(Moved around drops Youngest earliest and "Prime time rotated"); 6 rules as sentences with one Add a rule; 7 11c inside
the Club release, built once §300's walks close. **Not drawn** (the hub's last screen): the settings shape (a saved
Teams at once above 1 reads as one rule naming every team), the generator's variable seats and its moving cost, refusing
a sharing rule on a half facility, the slot window, measures, words (/marketing), help (/docs), walks.

**As built (2026-10-13, `691170b1`; walks §307).** *The settings* (`lib/club-schedule-settings.ts`, v2): `rules.sharing`
`[{teamIds, groupIds, atOnce 2–4}]` and `timeMode`; the reader refuses in words a rule with no ticked team, an unknown group,
a team in two rules (through its groups when the routes pass each running team's group), `atOnce` outside 2–4; an old
shape is upgraded before it is read (`upgradeV1`). `teamsAtOnce` is written as the largest rule's number — mig 326's
`slot_full` floor reads it on every save and hand edit — and a slot's own room (`slotRoom`: one rule's teams up to its
number, one team otherwise, one on a half facility) is asked by the save, the hand edit and Undo before the floor. A copied
or reopened rule keeps only teams with a season running (`sharingInSeason`). *The generator*: each week a rule's teams are
matched into partner groups (`matchPool` — the most still to place first, the youngest first on a tie), each group placed
as one on a full facility it can all use that week; what a group can't take its teams play alone. Evenly and By
percentage count a shared slot 1 ÷ its teams ("units"); A set number a week counts practices. Moved around costs last
week's start and facility and how often each was had, the day keeping its pull. A facility kept for a group pulls that
group's teams to it first (40 — stronger than Moved around's pull away). A week whose attempts run out with a team twice at
once keeps only what each team can hold. *The drafts*: Best overall · Another mix · Youngest earliest, or Best overall ·
Another mix · A third mix when moved; measures `sharing`, `early`, `facilities`, `open`. *The screens*: New schedule's
three cards (`lib/club-schedule-form.ts` holds the form↔settings conversion, round-trip tested); the shared chip (names
stacked, a gradient edge); the slot window's partners; Fair shares' columns as one list per mode (Hours · "50 shared" ·
Early · the facility word); By team / By group hours priced; the bill's caption and closing line.
**Departures:** (1) Fair shares' facility column is the schedule's own word, not "Fields" everywhere; (2) Moved around's
table drops the bill column at 300 px (back when the Sidebar Strip build moves the table under the grid); (3) "Field 5 and
Field 6 only for Junior" (the product's list words), not "Field 5 · Field 6"; (4) "Prime time rotated" retired in both modes;
(5) the kept-facility pull (the drawing's $2,700.00 each needs it; the open time falls on full fields, $5,400.00 the club
covers); (6) every card names open slots and keeps the nights line when moved; (7) a lone sharing team's Change team keeps
the swap list and adds "Share with"; (8) Undo asks a slot's room. **Found writing the walks, fixed the same day:** the
page's By team (desk table and phone rows) counted a sharing team's slots bare; it says "50 shared" now, as Fair shares and
the drafts do. **Found, not fixed:** the weekly cap's warning
(`capWarnings`) does not count a shared slot as half; the Schedules list's open count includes slots a booking holds (as
before 11c).
**Notes to others:** *Sidebar Strip & Grid Width* — Fair shares' columns are one list per mode (`columns` in
`FairShares.tsx`): move the list with the rows, and at that width Moved around can carry the bill's column again.
*Stage 9 / 11b* — house league's practices meet sharing and moving the same way: a division is a group, so "the U9
divisions share a facility" is a group rule. *6d* — a shared slot is one booking naming its teams, as built; nothing
changes for the feed.

## 6d. Stage 11d — a hand-back that asks for money back (drawn and ⚖ RATIFIED 2026-10-12)

> **⚖ RATIFIED 2026-10-12** (owner: *"I agree with the recommendations proposed in the club scheduler 11d's mockups"*):
> all nine asks as recommended, and the `/design` review's D1–D7 with them. **Built in two parts** (owner asked whether
> it could run beside 11c): **part A** — the ask, the answer, the credit, Payment requests, the coach's Money › Club,
> Send the changes' settlement and the hand-back step (`CLUB_SCHEDULER_11D_A_BUILD_PROMPT.md`) — **may run while 11c
> builds**: it touches none of 11c's screens and shares only a few files by hunks (the scheduler's server and words, two
> guards, help, the dictionary). **Part B** — the schedule's page: the callout, the asked Sundays on the grid, the slot
> window, Fair shares (`CLUB_SCHEDULER_11D_B_BUILD_PROMPT.md`) — **waits for 11c's commit**, because 11c rebuilds those
> four files. Readings the prompts carry (said, not silent): a *sent* installment counts as paid for a credit; the
> treasurer's bell opens Payment requests (D5's page is one they can't open); Fair shares' plain-hand-back frame prints
> two numbers for one bill (S11D-05 itself) — built as the Not-drawn row says, agreeing with Money › Club; a waiting ask
> holds the season's payout like any waiting request and never blocks closing (CLAUDE.md); Ask 7's lapse notice needs a
> scheduled step, the owner's call in the build session (AGENCY_RULES 2026-09-26). Part A also fixes the three club→team
> money bells that 404 (found drawing this stage), in their own commit. Hub v104: Decisions rows "Stage 11d · Ask 1–9"
> Accepted, the brief and the plan card trued.

The owner's direction, from walking §300 W10 (2026-10-12): *"for handing back, can we give the option to include money
back (i.e. equivalent of requesting money) so then the club confirms the hand back, thus opening the time slot and also
making a 'payment request' that they later have to action as 'paid' once they do it. if the money is still owing from
the team the amount they owe just goes down by that amount and there is nothing for the club to further action."* Then:
*"go ahead and draw it up."* It amends Stage 10 + 11's Ask 17 (a hand-back lands at once) and build question B (§6,
ruled 2026-10-11 "Bill gains, show losses", whose reason was that **nothing new enters the money loop**: the club can't
put money into a team's books unasked). The refund half keeps that reason (the coach's ask is the coach's own request);
the "goes down" half is new — a **credit**, which lowers a debt the club wrote and gives no money (Ask 6).

**Drawn** on the hub (https://claude.ai/artifact/K4MPu4ni53Ct7yrDcmWJd9, Mockups → **Stage 11d**; generator
`.probe/s11d-hub/`, captures of the built screens from dev 2026-10-12), `/design`-reviewed (seven drawing changes D1–D7,
on its Formatting check screen). Figures from the dome: a Sunday is $108.00 (90 minutes of a full field at the permit's
$72.00 an hour), so 15U AA's four March Sundays are $432.00.
1. **The coach asks** — Hand back gains one tick, *Ask the club for $432.00 back*, its figure worked out from the bill and
   following the choice above it; the second button reads *Ask the club*; the same on a phone.
2. **While the club decides** — the practices stay (families still see them), each with the amber *Hand-back asked*
   pill; the practice ends with what was asked and *Withdraw the ask*; on Money › Club the ask is a From-club,
   money-back request, *Awaiting the club*.
3. **The club sees it** — on the schedule's page a callout (who, which Sundays, how much) with *Answer*, the Sundays ringed
   with Hand back's glyph, the chip still Final; a plain hand-back leaves the page Final with nothing waiting; the same
   ask in Accounting › Payment requests.
4. **The answer** — one window: the Sundays, who asked, the figure and how it was worked out, the team's bill (billed ·
   paid · still owed), one statement of what Accept does, a quiet line on what the open time costs the club; Decline…
   (a reason the coach reads) · Accept. The three ways it settles, one statement each.
5. **After** — the team that still owed: its latest payment drops ($864.00 → $432.00), the ask reads *Credited*, the
   bill gains a fifth figure *Credited*, the club's statement a *Credit* row (the bill row untouched). The team that had
   paid: an accepted request waits in Payment requests and is paid with the Approve window, titled *Record paying*.
6. **The club's own changes** — Send the changes credits a team that loses time (or makes a request to pay) under the same
   *Bill the corrections* switch, instead of "is owed $108.00 back: its coach asks for it".

**Findings (S11D-01…06, read from the code and dev 2026-10-12):** 01 Hand back lands at once and asks nothing about
money; 02 a hand-back marks a final schedule Changed since sent, but the page offers Send the changes only for the
club's own changes — a dead end, and its sentence is false (walk §300 W10's finding); 03 the next changes send works out
a hand-back team's owed-back ($432.00 for 15U AA) and writes it to the send log, but emails only teams whose practices it
changes, so nobody is told; 04 a bill's terms have no writer (Ask 7b), paying a team never lowers what it owes, and no
credit exists in club money; 05 Fair shares' Bill column prices the time now ($2,268.00 for 15U AA after W10) while the
team's bill still reads $2,700.00; 06 a club move tells the losing team it is owed money and leaves the coach to ask.

**Asks (⚖ ratified 2026-10-12 as recommended; the reasons on the hub's Decisions tab, "Stage 11d · Ask 1–9"):** 1 money back
is a tick on Hand back, shown only when the club billed the team for this time and the coach can use the team's money,
its figure worked out, never typed; 2 with money, a hand-back waits for the club (the practices stay); 3 the club accepts
or declines the whole ask, and the coach can withdraw an unanswered one; 4 the ask is a payment request on both lists and
the schedule's page, answered by whoever holds the club's Accounting; 5 an accepted ask comes off what the team still
owes, latest payment first, and what it had paid becomes a request to pay; 6 "goes down" is a credit row, the bill never
changes, and every figure that reads a bill reads billed less credited; 7 a Sunday that comes unanswered drops out of the
ask; 8 the club's own changes settle the same way, and build question B's owed-back line (and the hidden owed-back for a
hand-back) goes; 9 a hand-back never makes the schedule Changed since sent. **Not drawn** (the hub's last screen): the
ask's record, the request it carries and the season close-out, a lapsed Sunday, Accept as one step, the credit row and
every figure that reads it (reminders, both statements, Owed by the teams, Budget vs. Actual both sides, the fiscal year,
exports, Fair shares), a closed fiscal year refusing a credit, who asks and who answers, bells and email, help, walks
(W10b from §300 — the correction money, never walked — rides with them).

**As built — part A (2026-10-13; walks §308).** *The record* (mig 328): `club_schedule_hand_backs` (landed · waiting ·
accepted · declined · withdrawn · lapsed) and `club_schedule_hand_back_slots` (each slot's priced minutes and figure,
`waiting`, `handed_back`); the credit `rep_allocation_credits` (one per bill touched) with `rep_allocation_credit_parts`,
and `rep_allocation_installments.credited_amount` written in the same step (CHECK: never above the amount; a payment
covered whole can't be sent or received). Requests gain `accepted` (the club owes it — Record paying approves it) and
`credited` (closed, no money moved), linked by `club_hand_back_id` or `club_schedule_send_id`; a guard trigger lets only a
step change, raise or remove a linked request. *The steps* (SECURITY DEFINER, `service_role`, each locks the schedule
first): `club_hand_back_ask` (the figure worked out on the server, capped by the team's room), `_withdraw`, `_decline`,
`_accept` (one step: the live Sundays, the credit `club_credit_apply` latest unpaid-and-unsent first, the rest an accepted
request, the slots handed back, never Changed since sent), `_sweep` (the daily scheduled step in the dues-reminders route —
the owner's answer to precondition 3: lapses an ask with no Sunday still to come, trues a waiting one), `club_schedule_hand_back`
(plain, records itself), `club_schedule_apply_changes` (+ `p_losses`, Ask 8; `settled` replaces `owed_back`, retired).
*The reads* (one definition each): `clubInstallmentDue` / `installmentFactsOf` / `creditApplication` / `requestWaitsOnClub`
/ `requestIsSettled` (`lib/club-money-figures.ts`), `previewCredit` (`lib/club-money-reads.ts` — Answer and Send the
changes read the step's own application and its closed year), `askSummaries` (`lib/club-hand-back-reads.ts` — the coach's
pill and the club's Answer count the Sundays Accept would). *The reader census* (every reader of a bill or a request,
`.probe/s11d/census.md`): installments → receive (writes the due), coming due, reminders (ask the due), the team
account (+ Credit rows), both bill windows, the coach's Money › Club (fifth figure Credited, "less a credit"), money summary,
upcoming payables, Budget vs. Actual both sides (actuals and scheduled by the due), the fiscal reads and the close
snapshot, season settlement, the register book, exports, the team card's overdue count, `club_line_allocated` /
`lineAllocated` (net of credits); requests → waiting on the club = pending or accepted everywhere (payout hold, close-out,
the hub's brief, fiscal "still open", both lists), credited = closed with no money (no ledger line, no BvA actual, no
register row). Held by `club-money-one-definition-guard` ("a credit reaches every reader of a bill") and
`check:club-money-arithmetic` (credits in its walk).

*Departures and readings (said in the code's headers):* (1) a SENT payment counts as paid for a credit; (2) D5's treasurer
lands on Payment requests with the ask open (the schedule's page is one a treasurer can't open), and a builder without
Accounting gets the ask's bell without its figure (`/review`); (3) the figure is the schedule's own billed rate
(`bill_scale`); (4) a waiting ask stays out of the club's Budget vs. Actual scheduled column (a decision, not money);
(5) "still to come" is read from the slot as it stands, by Accept, the sweep and both screens alike (`/review`: the sweep
had read the time as asked); (6) taking back Record paying on a linked request returns it to Accepted · to pay, never
Reversed (`/review`); (7) an ask past the room keeps every chosen practice, the latest at no figure; (8) on a phone the
ask's status ends the sheet's body, the foot keeps Withdraw the ask (owner, `/design` 2026-10-13); (9) the coach's
accepted chip reads "Accepted · to be paid" (words pass); (10) mig 328 backfills a landed record for any hand-back made
under 326 (dev: §300 W10's four Sundays), and dev's dome's leftover Changed since sent was cleared — the page now offers
nothing to send until a club change; (11) **changed after build (owner, §308 W5 2026-10-16):** a credit Send the changes
writes names the Sundays the team lost — "Sun, Jan 10, moved by the club" (several: "Sun, Jan 10, Jan 17 and Feb 7, …";
past four, "6 Sundays, Jan 10 – Feb 28, …"; none, "Time moved by the club") — on the payment's note and the club's
statement, and the coach's Credited caption for such a credit reads "Moved by the club". The drawn "Time moved at Send the
changes" named the club's button, which a coach never sees. One sentence is stored per credit, so the caption is fixed
words read from the credit's source rather than a second stored line (the owner's pick over a migration). Left for the owner: the Answer route takes no Schedules-plan check (money in flight
stays answerable when a club leaves the scheduler's plan).

*Notes for part B* (`CLUB_SCHEDULER_11D_B_BUILD_PROMPT.md`): the schedule's page must show the waiting ask's **callout**
(who, which Sundays, how much) with **Answer** opening the same `AnswerWindow` (`?answer={handBackId}` — the builder-who-
moves-money bell already links there and part A's page ignores it); the asked slots **ringed with Hand back's glyph** (D1)
and the slot window naming "Hand-back asked"; `changesSummary`'s `handedBack` branch is always `[]` since part A — remove
it with the page's last reader; Fair shares' Bill column must read **the money side's figure per team for this schedule**
(billed less credited, plus corrections) so a plain hand-back's frame says "its bill stays $2,700.00" (D4) and a credited
one agrees with Money › Club. Dev's state for part B: the dome is Final with nothing changed since sent; 14U AA carries
the `/design` pass's three asks (one waiting on Dec 20); 15U AA and 15U AAA are as the §308 walks leave them.

**As built — part B (2026-10-16, committed `40df0587` + `25c55023` words and help; walks §322).** *Build-start answers
(owner):* Fair shares B in this pass — **yes** ("one pass over one panel"); the layout sweep at the end — yes. The late ask's
look was not asked: part C's Not drawn already says "part B's schedule page shows a late ask the way it shows any ask,
without ringed Sundays (their time is already open)".
*The read* (`scheduleView`, `lib/club-schedule-server.ts`): `asks` — the schedule's waiting asks, oldest first
(`waitingAsksOfSchedule`, its asker named in the same wave; an ask with no Sunday left to count is left out — Accept could
only refuse it), each ask's figure `null` for a reader without the club's Accounting, its Sundays as they stand (no
per-Sunday figure). For a money reader on a billed final schedule, ONE money read (`scheduleMoney`,
`lib/club-money-reads.ts`): the pool (`club_schedule_bill_pool`'s: the Finalize allocation + landed corrections) with each
split's payments embedded, and the requests the schedule's accepted hand-backs and landed sends carry —
`pays` = `schedulePaysCents` (`lib/club-money-figures.ts`: Σ installments − Σ credited − Σ requests `accepted`/`approved`)
and `made` = the Finalize allocation's shares and payments. `kept` (`keptHandBacks`): each team's Sundays handed back by a
LANDED hand-back still `handed_back`, not on the team's slot again, no accepted late ask over it; with `billMoved` (pays ≠
billed). *The page:* `AskCallout` (ScheduleParts), `askedSlots` (a late ask rings none; a slot two asks reach reads the
older), `slotAskGlyph` (`Undo2`) on the chip, the slot window's Hand-back asked row, the phone's Day row a warn `RepChip`,
`?answer=` read into a ref and consumed inside `load` (stale → notice; non-mover → the callout), `changesSummary` without
`handedBack`, `lowerFirst` keeping a weekday's capital. *Fair shares B* (`FairShares.tsx`): `fairShares()` worked out once,
`FairSharesBand` (`JoinedBand across`, the "Fair shares by team ↓" door — grid lens only), `FairSharesLines`,
`FairSharesTeams` (the bill's door at its title row's right; notes beside the table); `fairBill` (`lib/club-schedule-view.ts`):
`pays` › the bill riding with the schedule › the permit's estimate. Moved around carries the Bill column again.
*Dev's figures at the build* (read, `.probe/s11db/`): 14U AA pays $1,296.00 ($2,700.00 − $1,188.00 credited − $216.00 to pay),
matching its account; 15U AA $2,268.00 ($2,700.00 + a $108.00 correction − $432.00 − $108.00 paid back); the bill as made
$27,000.00.

*Departures and readings (said in the code's headers):* (1) a plain hand-back's Bill reads the bill ($2,700.00), not the
frame's $2,268.00 (S11D-05 itself); the band's total follows. (2) Several asks at once: one callout each, oldest first;
only the oldest's Answer is lime, and Send the changes is outlined while an ask waits. (3) A late ask's Sundays are not
ringed (part C's Not drawn). (4) A shared slot asked by one of its teams: ringed, the slot window naming the team (not
drawn). (5) The no-Answer reader's tail is part A's bell sentence ("…until someone who holds the club’s Accounting
answers.") — the drawn "until you answer" beside "someone else answers it" said two things (/marketing). (6) D4's note
when money already moved for other Sundays reads "it still pays for them ($X in all)" — "its bill stays" would be false.
(7) The phone's mark is the admin's warn chip (mono caps), the coach portal's the badge — each its portal's own.
*Found and fixed while building:* on a final schedule, The bill window and the schedule's export re-priced each team from
the slots as they stand (after a plain hand-back, $2,268.00 where the bill says $2,700.00) — `billViewOf(…, made)` now
reads the bill Finalize made (hours stay the time each team holds now); a moved change line read "sun, Dec 13".
*The passes:* **/simplify** (four lenses) — one money read where three were (`scheduleMoney` replaced
`scheduleTeamPays` + `loadClubLoop`; the per-team `schedulePoolInstallments` restored as committed), names and the late
asks read beside the rows, `dayWord`, the callout handed its ask whole, the kit's chip on the phone. Skipped: one note
sentence for both cases (the drawn one is ratified), hiding a no-Sunday ask on Payment requests (part A's list), the
lime juggling. **/review** (high-risk, five lenses; no Critical or High) — fixed: an empty `made` falls back to the
time priced now; a share is what its payments add up to (Money › Club's Billed); the stale door's words cover passed
Sundays. Refuted: Answer's GET showing the figure to a Rep Teams holder (they read it on Payment requests already —
part A's rule); a second late ask after an accepted one (the step refuses it); the door overriding an open window (none
can open before the first read). **/design** (1440/390, Warm/Dark) — matches specimen 3 and sidebar B; no change.
**/marketing** — three changes (above, 5–6, and the late tail "…and your answer moves only the money."). **/docs** — org ›
Schedules: "A coach asks for money back" (new), "A schedule's page", "Fair shares", "Bill the teams", "Changes after it's
sent", a FAQ, Who sees what; the Accounting guide's Payment requests one sentence.
*For the owner (not built):* (1) **Bill vs The bill** — once money moves, Fair shares' Bill (what the team pays) and the
bill window (the bill as made) differ and nothing says which is which; /marketing proposes one line under the table,
shown only then. (2) The two looks of Hand-back asked across the portals (kept).
*Notes to others:* **Sidebar Strip & Grid Width** — its Stage 1 (Fair shares B) is built here; the Bill column and the
note sit on the team card; Stage 2 (the strip) is next. **Stage 9 / 11b** — house league's practices meet hand-backs the
same way: an ask on the schedule's page, its Sundays ringed, Fair shares' Bill what a division pays.
*Walks §322 ✅ CLOSED 2026-10-16* (six of six; four steps rest on the owner’s word — the ledger says which).

### 6d part C — a hand-back the coach can change (drawn and ⚖ RATIFIED 2026-10-16; build prompt `CLUB_SCHEDULER_11D_C_BUILD_PROMPT.md`)

The owner, after passing §308 W3 (2026-10-16): *"if a coach hands back a practice but does not ask for the money, it
should still sit in a pending state where the practice is visible on the schedule until the club accepts it. they may
have not ticked that by mistake and need to re adjust, it automatically disappearing gives the coach no ability to change
the request."* **Weighed before drawing:** making every hand-back wait for the club fixes the mistake but taxes every
correct hand-back — families keep seeing practices the team has given up until the club answers; a last-minute hand-back
lapses unanswered under Ask 7 and the time is wasted; the club answers a one-answer question; and a hand-back without
money has no payment request to answer from (it would need part B's schedule-page Answer). Recommended instead, and the
owner agreed (*"I agree with your recommendation, draw it up"*): the hand-back still lands at once, and the coach keeps it
on their own schedule where it can be changed.

**Findings (read from the code, `bb86e953` as committed, 2026-10-16):** **S11D-07** a landed hand-back has no way back for
the coach (`handBack` deletes untouched practices and cancels worked-on ones; `ClubPracticeEnd` offers nothing on a
cancelled practice; the coach-side reads skip `landed` records). **S11D-08** a hand-back's money can be asked only in the
Hand back window (the tick); nothing offers it afterwards. **S11D-09** a coach with `canManageSchedule` but not
`canWriteMoney` never sees the tick (Ask 1), and the money people get no bell. **Families (corrected 2026-10-16):** a deleted practice vanishes for families,
but a cancelled one is KEPT on the family schedule (`FamilyTeamClient` "· Cancelled"), the public team page
(`RepTeamPublicSchedule`) and the family calendar feed (`teamFeedEntries`, F2 "Cancelled · …") — C9, never hidden. The
first draft said families never see a kept one, reading `lib/family-view.ts`'s next-up filter (~:162) as the schedule's;
Ask 10 was ratified on that sentence, so its families clause was re-asked: the owner chose **"Show as Cancelled"**.

**Drawn** on the hub (https://claude.ai/artifact/K4MPu4ni53Ct7yrDcmWJd9 v107, Mockups → Stage 11d → the "C" links;
generator `.probe/s11d-c-hub/`; ratified as v109), `/design`-reviewed (D1–D8 on its C · Formatting check screen):
- **C1** the coach's Schedule list, before/after: every handed-back practice stays, struck through, with a filled quiet
  *Handed back* pill right after its title; a waiting *Money asked* (amber) sits at the row's end.
- **C1b** (v108, the owner: *"can we make these handed back ones a little more clear? … the single cross through of the
  title isn't that clear"*): six ways compared at true size — A as drawn in v107 (grey outline pill at the far end), **B the
  pill beside the title, filled (recommended)**, C a filled pill at the far end, D words in the caption, E italic, F a run
  folded into one row — with B at 390 and in Dark. Why B: fading is spent (the struck title is already the caption grey,
  6.8 : 1; the faint grey is 2.7 : 1 Warm / 3.4 : 1 Dark, under the 4.5 : 1 floor), italic means a placeholder in this
  portal, and v107's pill was ~600 px from the title at 1440 and (after D1) a grey hairline.
- **C2** the handed-back practice: one sentence (when, with how many others, families see it as cancelled, until when it
  can come back), then two rare doors — *Ask the club for $432.00 back* and *Take it back* — and the club's sentence; four other
  states (time given away · a late ask waits · settled · a coach without money access); the phone with both doors ending
  the body and no pinned foot (a departure from the 10-13 foot, said — D2).
- **C3** *Take back which practices?* (Hand back's three rows, limited to that hand-back, only what can come back;
  Keep it handed back · Take it back) and *Ask the club for money back?* (no choice: every practice of the hand-back still
  handed back, Ask 1's figure; Cancel · Ask the club); Hand back's lead reads "Your families see it as cancelled. Until the club gives it away, you can take it back." (replacing
  the built "Your families stop seeing it") and its tick line adds "You can also ask later, from the practice."
- **C4** the late Answer (a *Handed back* row; the statement is money only) and two bells — the schedulers' "15U AA took
  back 3 practices" and the money people's "Riley Chen handed back 4 practices without asking for money".

**Asks (⚖ RATIFIED 2026-10-16 as recommended — owner: *"go ahead with your recommendations"*; the reasons on the hub's
Decisions tab; `/design` D1–D8 and D2's phone departure with them):** **10** every handed-back practice stays on the coach's
schedule, never deleted, and families see each as Cancelled (no message; Hand back says so); **11** Take it back (not started, the club hasn't given the time away, no ask
waiting, no money settled; lands at once; families see them again without a message; schedulers told; never Changed since
sent); **12** ask for the money later (one ask over the hand-back's practices still handed back; Accept settles money only;
never lapses by date); **13** the money people's bell when someone without money access hands back billed time; **14**
(from `/design` D1, rewritten v108) a row that isn't happening reads struck with a filled quiet pill beside its title
(Handed back, Cancelled), at every width and in the window's head; amber stays for what waits, at the row's end — an
exception to the 2026-10-12 one-chip-place ruling, ruled with it.

**/design D6–D8, found and not changed:** the Answer's bill line says "paid · still owed" where the club's bill window now
says Collected · Outstanding (2026-10-16); "Handed back" already means a family refund in Player Dues; "Money asked" is a
third name for a waiting ask — all for `/marketing` or the bill-words owner at the build.

**Build shape (ratified; the hub's C · Not drawn; the build prompt has the detail):** its own small part, needing none of part B. Keep, never
delete (a hand-back cancels every practice it reaches; earlier hand-backs keep what they did). A take-back step (the
schedule locked first; per practice: not started, slot still open, no waiting ask, no settled money; restore team + event
as it was, clear `handed_back`, builders' bell; never `changed_since_sent`). The late ask: a new ask over already-handed-
back slots, its Accept skipping the opening, the daily sweep skipping it, Ask 5's three settlements unchanged; its quiet
line counts only Sundays still open (D3). The money people's bell. Who: Take it back = `canManageSchedule`; the late ask
and Withdraw = `canWriteMoney`. Walks, one purpose each, listed on the hub.

**As built — part C (2026-10-16, committed `6855d986` + the sweep `69d20a8e`; walks §319).** *The database* — mig 330 (`club_hand_back_events` cancels every practice
it reaches, never `club_practice_retire`; `club_hand_back_take_back`; `club_hand_back_ask_later`; `club_hand_back_accept`
with a late branch that opens nothing; `club_schedule_hand_backs.late_for`) and mig 331 (the sweep's one condition), both
on dev, prod `pending` in `MANUAL_PROD_STEPS.json`; proved by `check:club-money-atomicity -- --mutate` T38 (every refusal
for real, 8 new mutations killed, 113 of 113). *The server* — `lib/club-hand-back-reads.ts` `practiceHandBacks` (the
practice's hand-back, the rest of it, where its Sunday stands, the late ask, the money), `lib/club-hand-back.ts`
`takeBackChoices`/`takeBack`, `lateAskOffer`/`askLater`, `tellMoneyOfUnasked`, the Answer's `late` read; routes
`events/[eventId]/take-back` (GET, POST; `canManageSchedule`) and `events/[eventId]/money-back` (GET, POST, DELETE —
the late ask's Withdraw; `canWriteMoney`), both through `lib/club-practice-route.ts` (the hand-back route's reading,
on the billing rail). Guards: `tests/unit/club-hand-back-change-guard.test.ts`.

*The census of not-on renders* (every place the coaches portal shows a cancelled event; everything else — Overview's
next-up and This week, the masthead, Practice plans, Lineups, Attendance history, Insights, Season Wrapped — already
leaves cancelled events out): (1) the Schedule's LIST row — the pill moved beside the struck title (`notOnTitle`), the
whole-row fade (`rowListMuted`) gone, the struck name in the caption grey; (2) the phone Month's chosen-day rows and the
day sheet — the same row; (3) the WEEK cell chip and the desk MONTH cell chip (`CellChip`, `calChipCancelled`) — a cell
has no room beside its title (C6), so the strike stays and the same pill rides the time line, quiet (the desk Month cell
draws no states; its tooltip now says Handed back for a practice this team handed back — it always said Cancelled);
(4) the touch Month's dot (`calMonthDotCancelled`) — unchanged, a dot has no word; (5) the event sheet's HEAD — the same
filled quiet pill (`.eventChipCancelled`), Cancelled through `STATE_WORDS` (it was a hand-typed literal); (6) the game
page's recap " · Cancelled" — plain text, unchanged (games only, no chip). Out of the coaches portal and unchanged: the
admin's team schedule (reuses the views without `clubSourceOf`, so a handed-back practice reads Cancelled there) and the
ICS exports ("Cancelled · …").

*The retire callers* (`club_practice_retire`): `club_hand_back_events` (mig 328 — the plain hand-back and an accepted
ask) — replaced in mig 330 to cancel always; `club_schedule_apply_changes` (mig 328 — Send the changes, the club's own
moves) — unchanged (cancel worked-on, delete untouched), as Ask 10 rules. 326's earlier `club_schedule_hand_back(uuid,
uuid, uuid, uuid[])` was dropped by 328.

*The sweep:* the owner's call in the build session (2026-10-16, AGENCY_RULES 2026-09-26): **"Skip late asks"** (option a
of three) — mig 331, its own commit.

*Families:* nothing built — every family surface keeps a cancelled practice and labels it (the family schedule "·
Cancelled", the team's public page "· Cancelled", both calendar feeds "Cancelled · …" with STATUS:CANCELLED; read from
the code 2026-10-16), and none reads the club's slots, so a handed-back practice reaches families as Cancelled with no
message (Ask 10). The coach's cancel notice to families fires only from the coach's own PATCH; a hand-back sends none.

*Departures and readings (said in the code's headers):* (1) Ask 10 reaches an ACCEPTED ask with its tick too (it runs the
same step): its practices stay, struck, and their end reads the settled sentence. (2) A late ask counts EVERY practice of
the hand-back still handed back — a Sunday that started since, or that the club gave to another team, included (the
team was billed for time it gave back) — EXCEPT one the club has given back to this team, which is the team's again and
never asked for or paid for (/review 2026-10-16: three lenses found it; the step, the offer, the lists and Accept all
leave it out); its Accept sets the counted rows `handed_back`, so Send the changes reads those Sundays as an accepted
ask's (one the club later gives back is time gained, and billed). (3) Once the club DECLINES a late ask, Ask the club for $X back does not come back ("no money asked" is
false); Take it back does. (4) Take it back also refuses a practice whose team now holds an overlapping slot of the
schedule (the schedule's one rule), and a practice a pre-330 hand-back deleted (nothing to restore). (5) Two Sunday
states the drawings don't show, given a sentence each: the club took the time OFF its schedule ("…so it can't come back
to you") and the club gave it BACK to this team before sending ("…it's back on your schedule when the club sends its
changes"). (6) The late ask's request is named "4 Sundays handed back" on both lists (the credit's own reason). (7) A
money-only staff member (money write, no schedule access) sees a handed-back practice's end with the ask door and no
Take it back — Ask 13's bell sends them there. (8) Two new bells: `club_schedule_taken_back` (builders; the Schedules
row of the club's notification settings) and `club_hand_back_unasked` (the team's money WRITE people; "Your club"). (9)
The not-on pill's fill is `--home-fill` (Warm) / 9 % white (Dark) — the drawing's `--w-fill2` has no portal token.

*The passes (2026-10-16, the owner: "go ahead with review, design, marketing, and commit"):* **`/simplify`** — one reading
of where a handed-back Sunday stands (`slotStanding`, used by the practice's end, Take it back's rows and the Answer's
D3 count), one figure for the door, the bell and the ask (the bell reads `practiceHandBacks`), the schedule's name and
billing read in the same query, the room read only where an ask is still possible, the hand-back route on
`resolveClubPractice`, one filing helper (`askFiling`), one `dayRange`, the series rows shared (`ScopeRows`), one
`notOnWord`, "handed back" decided once on the server; skipped as larger than the pass: one withdraw route (the two need
different permissions), an ask "kind" in place of the `late` flag, a shared fetch hook for the four question windows.
**`/review`** (high-risk, five lenses; no Critical or High) — fixed: a late ask counted a Sunday the club had since given
back to the TEAM (three lenses; mig 330 re-applied on dev — the step, the offer, the lists and Accept now leave it out,
two new mutations, atomicity 114/114); the Answer offered Accept on a late ask with nothing left to pay (now its own
refusal, `lateStale`); a 409 in the two new windows left a stale door (they now close and say so, as Withdraw does); the
Answer read a UTC day beside a club day; Take it back's counts ignored the team-twice rule. Refuted or accepted: the money
figures shown to a coach without money access (the ratified C2 drawing; part A showed the ask's figure the same way), the
refusal order, cancelled games losing the row fade (Ask 14), part A's re-ask edge, zero-cent rows past the room (part
A's rule), and — a behaviour change worth knowing — a handed-back practice now rides the season roll as a struck
practice (`club_practices_carry` carries every future club practice; untouched ones used to be deleted). **`/design`**
(1440/390, Warm/Dark, on a throwaway hand-back of 15U AAA's Nov 15 + 22, withdrawn and taken back after): matches C1–C4;
fixed D-1 only the title struck, the pill right after it, the source unstruck (struck whole, the phone pushed the pill to
its own row), D-2 the shared loading line in the three question windows ("Loading the practices…", "Loading what the
club billed…"), D-3 a cancelled calendar cell no longer fades (the pill's ink stayed under 4.5 : 1). **`/marketing`** —
the drawn sentences stand; changed: the take-back notice ("…and your families see them again"), the late-ask notice
("Whatever it answers, the practices stay handed back."), D3's line ("2 other Sundays already went to another team."),
three refusals that now arrive as the page's notice lose "Close this and look again", an accepted ask with its tick reads
one sentence ("The club accepted your hand-back of this practice and 3 others on Oct 14: it took $432.00 off what 15U AA
owes for them."), and the settings row "Practices handed back without asking for money". D6 (the Answer's "paid · still
owed" vs the bill window's Collected · Outstanding) is part A's walked line — left for whoever next touches the club's bill
words; D7 and D8 kept as ruled.

*Help, 2026-10-16 (`/docs`):* the coach's Hand back article (every hand-back stays, struck, families see Cancelled), its
new page "Changed your mind?" (Take it back, asking later, when the time is already gone, without money access) and an
FAQ; the schedule views' cancelled look (the grey pill beside the struck title). The club's Payment requests article —
in the Accounting guide, not Org — gains the late ask; Schedules › Changes after it's sent gains Take it back.

*Walks:* §319 ✅ CLOSED 2026-10-16 (six of six, W5 on the owner's word; a coach without money access never seeing the tick is held by `club-hand-back-change-guard` § 6, not walked). Migs 330 + 331 applied to prod 2026-10-16 (release record `85a5428d`).

## 6e. New schedule opens on the choice — Copy a schedule, or start blank (⚖ RULED + BUILT 2026-10-13, committed `db59b21c`)

The owner, on a screenshot of step 1: the **Copy a schedule** dropdown above the cards "seems out of place" — should the
window open on "copy from … or start from scratch", as other copies do? Decision sheet
https://claude.ai/artifact/1eReDtSsJLkLNAunzRredf (source `CLUB_SCHEDULER_COPY_OPENING_SCREEN_MOCKUP.html`), `/design`-reviewed
(D1–D5) → *"looks good, go ahead and build it"* — **Asks 1–2 and D1–D5 as recommended.** Design log: "A COPY THAT REWRITES A
CREATE FORM IS HOW THE WINDOW OPENS".
- **Ask 1:** once the club has a schedule, New schedule opens on its schedules (newest first; dates · venues), an "or",
  Cancel and the lime Start blank. A pick opens step 1 filled in ("Step 1 of 2 · settings · copied from …"); the Copy field
  is gone. From a permit's page: "Copy a schedule, or start from the permit.", the permit named in the sentence, the lime
  **Start from the permit**, and a copy keeps the permit's time. Settings… never shows it. The Permit field stays (§5.4's
  2026-10-12 reason).
- **Ask 2:** changing your mind is Cancel — no Back to the list.
- **As built:** the inputs route adds each schedule's venues; the window's own opening level (no step bar); `/docs` line in
  the Schedules article; guard `club-scheduler-screens-guard` §12. No migration.
- **Departure:** the sheet's first version drew it on a phone; New schedule is a desk door (P11-10), so version 2 removed
  those frames. Walks: ledger **§309 ✅ PASSED 2026-10-13** (W1–W3, on the owner's word).

## 7. Build split, migrations, gates, walks (ruled 2026-10-11)

**10a · Permits** (build prompt `CLUB_PERMITS_BUILD_PROMPT.md`, 2026-10-11):
- Migrations (expected): `org_permits` (org, name, issuer payee, reference, for-scope, dates, fiscal year by start,
  cost, budget line, document path, notes); `org_time_blocks` (venue, facility or every facility, weekdays, start, end,
  dates; owned by a permit or a schedule — the one model); `org_time_dates_off`; a document bucket (an org-level file,
  none exists today); `org_venues.bookings_email` (Ask 7). Dictionary + snapshots, RLS members-read / server-writes (mig
  321's shape).
- The quiet line beside the pair rule (`lib/venue-clash*`), every Where form; the permit's use read over the one pool;
  the budget line's Permits row; the Venue library's switch, table and windows; the plan gate per Ask 4 (`/billing`).
- Walk §K → **§296** on the Owner QA Ledger (thirteen walks, the build prompt's definition of done).

**10a as built (2026-10-11).** Mig **322** (five tables, the venue's column, the bucket, the save step; RLS on, service-role
only; the members' `org_venues` read is a column list without `bookings_email`). The plan gate rides `hasOrgVenueLibrary`
— no new feature key (Ask 4 logged by `/strategy`, `BUSINESS_DECISIONS.md` 2026-10-11). Guards:
`tests/unit/club-permits-guard.test.ts` (one model of time; the plan and who; the closed year; the house format; the venue
links and the club's removal), `club-stage6a-guard` §7 (every Where form and every writer reply carries the answer; never a
third clash kind), `permit-time.test.ts` (the answer case by case, the dome's $72.00 / $36.00, the use's arithmetic, Renew's
names), `permit-use-workbook.test.ts` (the workbook recomputed from its rows), the masthead guard's two new report call
sites. **`/simplify`:** the save replies carry clashes and permits from ONE parallel read (`clashesForSaved*` return
`{ clashes, permits }`); `checkClubPermitsQuietly` everywhere a permit line may fail; the shared date, id, time-range and
used-ratio helpers; one workbook-branding helper; the route reads the club's places and the fiscal setting once.
**`/review` (high-risk) fixed:** the form re-seeded from the read BEFORE ✓'s save (the next pencil autosaved old values
back — High); delete of a money permit in a closed year (route + trigger); `bookings_email` readable from a member's own
session (column grant); the two RESTRICT links broke the platform-admin org delete and the fixture's `--reset` (NO ACTION +
blocks cleared first); a booking with no field set counted once per block; Renew's names for a date or a four-digit span;
window state (a landed autosave never refreshed the lists, Add's lost document line, a renewed copy reopening in its form,
the budget pages' unkeyed permit window, the game window's stale note, Renew's notice never seen); worded refusals for every
floor error, bounds on a share and a cost, the upload capped before it is read, quiet library and clash reports. Proved on
dev in rolled-back blocks (`.probe/s10a/save-probe.sql`, `review-floor-probe.sql`). **Recorded, not fixed (Low):** a block
added during an open edit gets a new id each autosave until ✓; a booking crossing midnight is read on its start day; two quick timeline moves can race their notes (as the clash
note does). (A downgraded club reading the line was closed the same day: the permit read checks the plan itself —
`/strategy` drift check, owner's go.)

**`/design` pass, 2026-10-11 (owner's go; built screens against specimens 1, 2, 3, 12, 13 and 14 at 1440 and 390, Warm,
Dark spot-checked; captures `.probe/s10a-design/`, writes blocked):** fixed — a permit's budget line rendered at the money
figure's size (three lines; now the body step, as drawn); "$27,000.00" overflowed its tile in a window's four-up band (a
permit's two bands take the band's phone figure step); a row's figure ("56 h", "$3,200.00") was the muted support step
(now body ink, as drawn); Facilities claimed "The whole venue" before a venue was chosen (now "Choose a venue first"); a
block's × sat alone on a row at phone width (now beside Days); the Permits view's Export · Add permit wrapped to a row of
their own on a phone (now the page head's icons, as Add venue is) and the empty year carried a second lime. **Kept,
consistent with the built kit rather than the drawing:** section labels in the kit's small capitals (the venue window's
own), read rows stacked label-over-value on a phone (the venue window's), the head's phone actions under the title (the
shared admin header). **Follow-up, not this stage's:** the shared money band has no narrow-container step — any window
with four money tiles can overflow the same way. `check:layout` both themes on every touched screen: no new findings
(the club calendar's read window entry now steps to a week with bookings).

**`/marketing` sign-off, 2026-10-11 (every `[marketing]` tag in `lib/permit-words.ts` closed):** the quiet line says
**"Outside the club's permit for Diamond 2. It covers …"** (the drawing's "Not inside" was the one surface not saying
"outside" — the series line, a date's mark, the generator's count and the Use band all do; the calendar's no-facility
form is "Outside the club's permit at Lions Park."); the empty year explains rather than instructs and is sport-neutral
("a town's field permit"); Delete's question says "Nothing booked at its venues changes" (a permit holds time, never
bookings); the bookings contact's hint says what it is ("Who to email about bookings at this venue."), never the
schedule send 11a builds. Help, the walks (hub v93 — walk 5's series line also trued to "All 4 dates …"), the PM brief
and the ledger follow. The drawings above keep the words they were ratified with.

**The issuer list, walking §296, 2026-10-11 (owner: *"why can I not edit the list of issuers? … how would I add new
ones?"* → *"yes"*):** the permit form's Issuer picker had no **"Manage payees…"** row — the Ledger's picker carries it
(Stage 3d Ask 7a) and the permit build reused the picker without it. Both permit windows (Add permit, a permit's form)
now raise the club's Payees window BESIDE themselves, and the form follows what it changed: a rename, a merge, and a
payee deleted from under the form (kept as the typed name). With it, the club's own payee list drops its lone
"ORGANIZATION" heading — one group has nothing to tell apart (the 2026-10-09 menu ruling); a team's picker keeps its two
headings. Guard: `club-permits-guard` "the issuer list ends with Manage payees". **Found with it, then fixed the same
day (owner: *"can you fix that problem"*) — mig 325:** the payee MERGE (`club_payee_merge`, mig 316) moved the club's
lines and the teams' records but not `org_permits.issuer_payee_id`, so merging away a payee a permit names dropped the
link (ON DELETE SET NULL) and the permit read the merged-away spelling; the Payees window also offered Delete for a payee
only a permit named. **Mig 325** replaces the merge to carry every permit naming the payee to the one kept (link and
`issuer_name`), returning `permits`; `lib/club-payees.ts` counts a permit's issuer as in use (Merge, never Delete) and
the server refuses its delete. Applied to DEV 2026-10-11; prod `pending` in `MANUAL_PROD_STEPS.json`, AFTER 322 at the
same promote. Proved: `.probe/s10a/payee-merge-probe.sql` (before: link NULL, the old name; after: the payee kept),
`check:club-money-atomicity -- --mutate` T10 + a new mutation (82 of 82 killed), `club-permits-guard`.

**For 11a (precondition 2a of `CLUB_SCHEDULER_A_BUILD_PROMPT.md`):** the block table is `org_time_blocks` (owner column
`permit_id`, NOT NULL today — 11a adds `schedule_id` and a one-owner CHECK); its facilities `org_time_block_facilities`
(none = every facility); dates off `org_time_dates_off` (permit-owned); field prices `org_permit_facility_shares` →
`fieldPrices` in `lib/permit-time.ts`; the answer `permitAnswer` / `checkClubPermits(Quietly)` in `lib/permit-lookup.ts`.

**6d · Feeds** (its own design session, `CLUB_TIER_STAGE6D_MOCKUP_PROMPT.md`, then its build; owner 2026-10-11: on its own,
no longer before 11a).

**11a · The scheduler for rep teams** (build prompts `CLUB_SCHEDULER_A_BUILD_PROMPT.md`, the server, then `CLUB_SCHEDULER_B_BUILD_PROMPT.md`, the screens;
2026-10-11):
- Migrations (expected): `club_schedules` (name, state, settings jsonb, the time as blocks, sent_at / sent_by,
  changed_since_sent); `club_schedule_slots` (block, facility, start, end, teams[], locked, handed_back_at / by);
  `club_schedule_sends` (the log: when, by, kind full/changes, people, teams); `rep_team_events.club_schedule_slot_id`
  (the source link, unique per season, as the mirror's); the feature key (League Plus + both Club bands) in
  `lib/plan-features.ts` + the Facts doc (`/billing`).
- **Not drawn, the build carries it:** the time-allocation engine (one-sided, hours and prime time; not the tournament's);
  writes **at the send**, never on read (P11-05); the server refuses a coach's write to a club slot's time and place, as
  the mirror does; rows from one club slot never clash with each other, and the club calendar reads a shared slot as one
  booking (P11-04a); the availability rule reads each team's whole schedule (P11-04c); the season roll carries upcoming
  club slots (Ask 15); hand-back's route and notice; the send as the reminders' pattern (preview, claim lock, reply-to,
  the demo-org guard), the colleague-mail path; the coach notice in "Your club"; the club calendar's read window door
  "Open the schedule"; the export catalog entries (the schedule's Excel, PDF and Calendar; a permit's use); help;
  `check:layout` both themes; a screens guard.
- **From the dome walk (§6a), ruled 2026-10-11:** permit field prices (a weight per facility in a permit; Ask 21); a block over
  several facilities; the Fields-by-group and Teams'-days-off rules; the proposed bill held in the schedule (line, cost,
  split, payment plan) and created at Finalize through `club_allocation_create` with each team's own installments (the
  arithmetic: slots × field price, grouped by the payment's months; Ask 23); review replies (team, answer, words, when,
  by whom) and the review state (Ask 24); the bill's filing preset to the club line's word and the coach's "Use the
  club's figure" (Ask 25); a bell + email when the bill and slots land; the one-day grid (Ask 27).
- **Exports (§6b):** the schedule PDF through `buildTablePDF` (the schedule builder parameterised), its fixture in
  `scripts/pdf-documents.mjs` + `npm run check:pdf`; the workbooks through `buildXLSXWorkbook` with the masthead
  (settings fetched for Excel too), `columnNumFmts`, notes, the FieldLogicHQ footer row, the masthead allowlist.
- Walk §L — **its definition of done is the dome flow of §6a**, end to end, every figure read back on the club's and a
  team's side.

**11a part A as built (2026-10-11, `CLUB_SCHEDULER_A_BUILD_PROMPT.md`).** Mig **326** (the dictionary's "The club's
schedules"; RLS on, service-role only; every write a SECURITY DEFINER step scoped by org). Modules:
`lib/club-schedule-engine.ts` (cut, held, shares by group by largest remainder, a min-cost flow per week with a convex
same-day cost and each team's usual week seeded by a dry typical week, value swaps, three ranked drafts, `planMove`,
`teamTwice`, `diffAgainstSent`), `-settings.ts`, `-bill.ts` (priced time, the split, payments that follow the time,
corrections), `-words.ts` (every sentence, `[marketing]` tags open), `-server.ts` (the gate `resolveScheduler`, the
reads, `computeBill` — the one bill-now for the page, the send and the coach's card — the writers), `-send.ts` (three
sends, one shape: preview, claim, one step, emails reply-to the sender, bells, the log), `-coach.ts` (review cards,
replies, hand-back), `lib/club-slot-event.ts` (the coach's refusal, the mirror's shape). Routes `/api/admin/schedules`
(+ `generate`, `[scheduleId]`, `[scheduleId]/send`), the coach's `club-schedules` and `events/[eventId]/hand-back`; the
coach's event PATCH/DELETE and the schedule import refuse the club's fields. Guards: `club-scheduler-guard` (the gate,
money to money readers, writes only at the steps, the claim, the baseline in the step, A and B), `club-stage6a-guard`
(the new writers), `club-permits-guard` (one model of time), `team-move-coverage`; unit tests are the drawings' numbers;
`check:club-money-arithmetic` §11. The season roll carries a team's upcoming club practices (`club_practices_carry`).
**`/simplify`:** one bill-now (`computeBill`, the club's team order everywhere), one request reader (`readScheduleRequest`
/ `draftToSave`), one seat count (`seatCounts`), the shared date and id helpers, reads in parallel, the held-slot scan
bucketed by day, the rules and seats worked out once per round, the line's allocated sum through `lineAllocated`.
**`/review` (high-risk, five lenses) fixed:** a practice MOVED by Send the changes kept its old slot's link (the next
send doubled or cancelled it — **High**); a send's billing baseline was written after the emails, so a lost completion
billed every team its whole share again (**High** — now written in the step, with `landed_at`; the review send is a step
too); a rounding cent billed or owed an unchanged team (only touched teams are measured, `valuesAfterChanges`); a
non-money admin read bill figures in the send preview and the send log; the schedule import could change a club
practice; a review was refused for the line's room and year (Finalize's questions); a cancelled practice on a removed
slot kept a dead link (and could never be removed); hand-back read its slot before the lock; "teams at once" was not
the floor on a save; DELETE said "deleted" when Finalize won; a "started from" schedule of another club; malformed ids
as 500s; a drag onto a slot the team already holds (`already_there`); a kept slot a booking holds left out of its team's
count; a failed bookings email counted as a person told. Proved on dev in rolled-back blocks (`.probe/s11a/review-fix-probe*.sql`). **Recorded, not fixed (Low):** a
carried practice's expenses, evaluations and call-ups stay on the old season; a reply can land in the breath after
Finalize; a slot handed back twice keeps the last stamp; the 60-second claim covers every kind (a review then Finalize
inside a minute reads "just sent"); hand-back has no plan check (a downgraded club's coaches can still hand back what
exists — intended); unticking a team only skips its email (its practices and bill are written — intended).

**11a part B as built (2026-10-11, `CLUB_SCHEDULER_B_BUILD_PROMPT.md`).** No migration. **Screens:**
`app/[orgSlug]/admin/schedules/` (the list; a schedule's page), `components/admin/kit/club/schedules/` (New schedule,
the grid, Fair shares, the slot / swap / which-weeks / send-log / team windows, Bill the teams, Send),
`lib/club-schedule-view.ts` (what the screens lay out: the grid's columns — a week, or a one-weekday schedule's dates
seven at a time — the cell index, the drop verdict, the week's counts and shortfalls, the summary and closing words),
`lib/club-schedule-document.ts` + `lib/export/club-schedule-export.ts` (the PDF through the generalised
`buildDayDocument`, the workbook with By team and By field, the Calendar file; catalog entry `club-schedule`), and the
coach's `ClubSlotParts` (source line, Hand back), `ClubReviewCard`, `ClubBillBudgetCallout`. **The one rule** for who
builds schedules (`lib/club-schedule-gate.ts`): the server's `resolveScheduler`, the nav row, the permit's door and the
calendar's From link all read it. **Shared parts extended, never forked:** `ScheduleDateNav` (a `range`),
`ScheduleRowDecor.clubSourceOf`, the event sheet's and form's club branch (beside the mirrored game's), `FormTable`'s
`closing.noteRow`, `notification-labels` sections' `roles`. **Server touches:** the view's team colours, the money
reader's `pricing` and `teamOrder` (the bill's rounding order); the edit route's exact `undo`; a team already on a slot
may stay after its season ends; the builders' notices reach only current owners and admins; the list's places in order.
**`/review` (high-risk, five lenses) fixed 26, none High:** "Use $X" refused on a split budget line (the split now
rescales in the same save); Fair shares priced a shared slot whole for each team; a stale version left Send / Bill /
Settings refusing every retry (the page now re-reads); Undo could send the pre-move version or fail silently; "A week" and
the shortfalls summed a one-weekday schedule's seven dates; a rename lost after a regenerate; settings changed during
Generate paired with old drafts; an ended-season team blocked its partner's moves; replies reached removed admins; last
year's days off not moved a year on; and sixteen Low (see §300). **Departures from the drawings:** listed in §300 —
the calendar's From row is the door; untouched handed-back practices leave the schedule; Tools' "Delete this draft…";
the review card stays after an answer; "was your $X" said, not stored; a 90-minute time wraps at 1440; the Bill
window's whole option reads "The time at the permit's price · $X"; a shared slot's chip moves by its window, not a drag;
"Facilities by group" (sport-neutral). **The `/marketing` pass (2026-10-11):** "A week" one name for one figure (Fair
shares' column was "Week"); "Facilities by group" / "Add a facility rule"; By team's "Days" (was "Nights"); "your Money ›
Club tab"; the placeholder's clock ("9:30 a.m. instead of 8:00 a.m."); "regenerating can move it again"; the rename-lost
notice without a mid-sentence menu name. **Help:** org › Schedules (twelve sub-topics, three FAQs), the calendar's club
slots, the permit's door, the allocations article's "A schedule's bill", the coach's "Your club's schedule" (four
sub-topics); the help hub's Owner path. **Recorded, not fixed:** the server's preview re-reads the bookings pool per
keystroke pause (the client now cancels a superseded preview); every hand edit is PATCH + a full re-read; the coach's
form keeps two "owned elsewhere" branches (the organizer's game, the club's practice) — one mechanism when a third owner
arrives; a bill changed while In review isn't flagged to the coaches (part A's design).

**11b · House league's half** (with Stage 9): `league_practices.club_schedule_slot_id` + `created_by`; the scheduler's
house-league writer (move, cancel); the Practices view's "From {schedule}"; the role path for a club admin. Walk §L-b.

**Gates to add:** a "one model of time" guard (no second slot table); the screens guards; the arithmetic of a permit's
use recomputed from rows (the `check:club-money-arithmetic` pattern) for the Held / Booked / Unused band.

## 8. Not in the first cut (proposed)
Requesting or paying for permits through the platform; municipal integrations; public booking; families requesting or
swapping slots; coaches trading slots with each other; a public schedule page; paying for time per slot; any optimizer
beyond the listed rules; an email attachment; facility archive. (The split by hours left this list on 2026-10-11: Ask 23.)

## 9. Hand-offs (ruled 2026-10-11)
- **Tournament redesign:** the shared ask in Ask 5 (lift the two-step frame); P11-01's R3 wording.
- **6d:** §5.8; it can draw now (`CLUB_TIER_STAGE6D_MOCKUP_PROMPT.md`); it no longer gates 11a (owner 2026-10-11).
- **Stage 7:** Ask 9's one send pattern.
- **Stage 9:** Ask 6 and 11b; the house-league facts in §3.2.
- **`/strategy`:** Ask 4. **`/marketing`:** every drawn sentence, Ask 16, the homepage's "field bookings". **`/billing`:**
  the scheduler's key and Ask 4's gate at build. **`/design`:** a review pass of the drawings; R3.
- Found, not this stage's: the tournament send loop counts a failed email as sent (§3.4); the dictionary's stale lines
  (§3.7).
- **Notes from 11a part B (2026-10-11), for each owner:**
  - **Tournament redesign (Ask 5):** the scheduler wears the generator's look with its own code (`components/admin/kit/
    club/schedules/`); `lib/export/schedule-document.ts` is now one `buildDayDocument` that both the tournament's schedule
    PDF and the club's use. If the redesign lifts its two-step frame into a shared part, New schedule can wear it then.
  - **Stage 7 (Ask 9):** the one send window and its log are `SendWindow.tsx` + the send log window over part A's
    `club_schedule_sends` — preview first, who is told with ticks, the sample email, the bookings contact; Stage 7's
    "message every family" can take the same shape.
  - **Stage 9 / 11b:** house league's practices need `club_schedule_slot_id` and a creator, the scheduler's house-league
    writer, league admins in the send, and the Schedules row on League Plus (today `kitSchedulesLink` asks for rep teams;
    the one rule is `lib/club-schedule-gate.ts`).
  - **6d (built):** its feeds already read club practices as ordinary practice rows carrying `club_schedule_slot_id`; a
    handed-back one the coach never touched is deleted, one with notes or attendance stays cancelled and reads "Handed back".

## 10. Owner QA walks
§K (permits) and §L (the scheduler) on the Owner QA Ledger when built, checkable on the hub's QA tab; each walk one
purpose; every write read back.
