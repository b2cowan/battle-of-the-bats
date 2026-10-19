# Club Tier Readiness, Stage 5c and 5d: Families after the screens (5c drawn first; 5d drawn in its own session)

> Paste into a fresh session on `dev`. Written 2026-10-19 from the owner's "the next drawing session on the Club hub" task.
> **This session measures, draws and settles rulings. It does not build.** The build prompts are written only after the
> owner rules.
>
> **Precondition (met 2026-10-19; re-check it, do not trust this line):** Stage 5a (`799da264`) and 5b (`05eaa588`) are
> built, walk **§329 passed 44 of 44 on 2026-10-18** (the house-league fee fix `3acd23cc` re-checked), and both are on
> production (master job 281, 2026-10-18). Owed, **none of them a gate**: counsel on the family file's
> statement; the owner's phone check of the pick-one pill sheet; a /strategy answer, needed only before **Part B** (5d).
> A QA walk of earlier work is never a gate in front of a design walk (memory `feedback_deep_dive_is_walk_then_stages`).
>
> **⚠ A production release is being promoted right now.** Commit locally, and **do NOT push** until the owner says the
> release's staging sweep is done. Do not start a layout sweep or a whole-product pass on the dev server; this session
> needs only `check:layout --changed`-sized looks, and it draws, it does not change screens.

## The call: ONE file, TWO sessions. This paste draws 5c; 5d waits for 5c's rulings (Part B at the foot)

Why not both in one session (argue with this if you can; the owner may overrule it):
1. **The owner already ruled the shape.** Stage 5 Ask 21 (ratified 2026-10-17) reads "5d, its own mockup session", and the
   ladder row reads "5c and 5d: their own mockup sessions".
2. **5d cannot be drawn honestly yet.** Ask 21's own text says who pays for a sibling discount (each team's book or the
   club's) "is a /strategy question before it is drawn". Nothing in `BUSINESS_DECISIONS.md` answers it.
3. **5d is drawn on 5c's record.** It starts with a new "confirm this household" step on the family record, and its writes
   reuse 5c's payment path and the record's top-line room. Drawing 5d beside an unruled 5c draws it on a premise the owner
   may change; if 5c's payment door is cut, 5d changes shape.
4. **The weight.** 5c alone is a payment window, a notes section, a staff-match line and the question below. One drawing the
   owner can rule in one sitting is the point (memory `feedback_deep_dive_is_walk_then_stages`).
5. **5d may shrink.** Ask 21 lets the owner "cancel some" or all four; an unsplit session would draw work that may go.

Order of work in this session: Step 0 (checks and the question that decides B) → Step 1 (measure today) → Step 2 (draw the
end state of 5c) → /design → publish → asks. **Part B is not run now**; it is the paste for the later 5d session.

## Read first

- `CLUB_TIER_PRODUCTION_READINESS_PLAN.md`: **§6 Stage 5**, especially "5b BUILT", "5a BUILT" (their *Departures* and *Found,
  not fixed* lists are your starting map) and "5 RATIFIED / WALKED"; **§4E** (E01-E09); the rulings **D1** ("the coach's
  records are the source of truth for team money; the club READS them"), **D3** (the franchise: coaches own day to day, the
  admin does not write a team's schedule), **D8** (Families stays an explicit grant; the treasurer gets Accounting), **D9**;
  §7 (everything inside the release). The PM brief's Stage 5 paragraph.
- `CLUB_FAMILIES_BOOK_PLAN.md`: the banners at the top; **§1.3** (two doors, one mechanism, never a fork); **§5.3** (binding
  P2 decisions); **§5.4** (review lessons); **§5.5** (the 2026-08-18 rulings: dues reminders transactional, **a household is
  CONFIRMED, not inferred, before money moves**, the message log is a date only); §6 (catalogue); §8.4 (retention and erasure:
  deferred, and anything this session stores lands inside it).
- `CLUB_FAMILIES_BOOK_P3_PROMPT.md` **§2 (the six P3 items A-F), §3 (settled), §4 (lessons)**. Its §0 gates are gone (see the
  consumed `CLUB_TIER_STAGE5_FAMILIES_MOCKUP_PROMPT.md` header). Item A is built; D waits for the guardian tier (Ask 22).
- The consumed model prompt `CLUB_TIER_STAGE5_FAMILIES_MOCKUP_PROMPT.md` (the method this session repeats; **do not re-run its
  Step 0 production read**: answered 2026-10-16, one org carries Families, the demo `riverdale-ridge`, never opened) and the
  build prompts `CLUB_TIER_STAGE5A_BUILD_PROMPT.md`, `CLUB_TIER_STAGE5B_BUILD_PROMPT.md`.
- `OWNER_QA_LEDGER.md` **§329** (the walk, the named accounts, the fixture's state after W9/W10).
- The hub: https://claude.ai/artifact/K4MPu4ni53Ct7yrDcmWJd9 (source `docs/projects/active/CLUB_TIER_PRODUCTION_READINESS_HUB.html`,
  3.9 MB / ~19,000 lines on 2026-10-19). Mockups → **Stage 5**: P1-P5 are the house style you draw next to; Decisions rows
  **Asks 2, 9, 15, 21, 22** are the rulings that bind you. The captures are in `docs/projects/active/club-tier-5/`.
- `memory/design_decisions.md`: the top-of-file Stage 5 entry (2026-10-17 "CLUB STAGE 5 · FAMILIES"), 2026-10-18 (every
  pick-one pill opens the phone sheet), 2026-10-01 (a record reads first, edits whole), the toolbar-rules entry (search right).
- `docs/agents/strategy/BUSINESS_DECISIONS.md`: 2026-10-16 (the Club release waits for everything), 2026-10-18 (chat PAUSES;
  messaging returns later as announcements with replies, with counsel; **this session draws no family replies and no
  chat**) and `PLAN_PRICING_FACTS.md` (module inclusions: League Plus carries Families, Club carries Families **and** rep teams).
- Auto-memory (outside the repo): `feedback_mockups_as_claude_artifacts`, `feedback_always_run_design_on_mockups`,
  `feedback_deep_dive_is_walk_then_stages`, `feedback_portal_is_the_formatting_benchmark`, `feedback_money_figures_one_joined_band`,
  `feedback_project_hub_single_artifact`, `reference_artifact_publish_needs_full_read`, `reference_hub_script_parse_trap`,
  `feedback_clickable_design_annotations`, `decision_record_reads_first_edits_whole`, `decision_edit_autosaves_create_asks`
  (and its 10-09 exception: a change that tells families is held until ✓ and asks), `decision_rare_door_ends_body`,
  `decision_window_foot_text_left`, `decision_possessive_bare_apostrophe`, `project_club_families_book`,
  `project_club_tier_readiness`, `feedback_push_back_by_default`.
- `AGENTS.md`, `AGENCY_RULES.md`, `CLAUDE.md`. **CLAUDE.md's rule binds you: broad reading and searching go to a helper
  agent** (`Explore` to locate, `general-purpose` when it must run commands), and **a helper's summary is a lead, not
  evidence**: open the cited lines before you build a drawing, or tell the owner, on one. The hub read below is the biggest
  such job.
- Binding family-layer rulings, no drawing may assume otherwise: the guardian tier is **switched off** behind counsel;
  family chat was **cut** and in-app chat is **paused**; the family link and follower tier were **removed** (mig 290);
  Families is **off by default for every role** and **never given to a member limited to some teams**; **no sibling claim
  from a name match, anywhere**; money is asymmetric (rep = ledger dollars, house league = paid or not, never summed into
  one figure); attachment has ONE home (`families_attach_people`); a merge never happens by itself; **Ask 15 is ruled: the
  record has no record-level pencil, and notes arrive as a create ("Add a note", the create asks), each note editable on its
  own**; do not reopen it, draw to it.

## Step 0 · Before the first drawing

1. **Is the hub yours?** One drawing session per hub at a time. `git log -5 -- docs/projects/active/CLUB_TIER_PRODUCTION_READINESS_HUB.html`,
   `git status`, and ask the owner if any other session is drawing a Club stage (Stages 4, 7 and 8 are still open in the
   plan, so one could be). If one is, stop and say so.
2. **Branch and tree.** `git rev-parse --abbrev-ref HEAD` is `dev`. Other sessions leave files modified in this shared tree
   (on 2026-10-19: `docs/agents/ops/TASK_LIST_PROMPT.md`); you stage nothing of theirs.
3. **Read the live hub, whole, once, by a helper.** Use the Artifact `read` action first and check its header: if it says
   the version "counts as viewed", no full Read is needed. If a publish is refused for want of a read, hand **one**
   dedicated subagent the whole job (read every line in ~300-line chunks through the last line, never split across
   agents; diff the live content against the working copy; if identical, publish unchanged once, expect the "resent
   unchanged" refusal, then publish again). If the working copy and the live copy differ, ask the owner which is current.
   Never `force`.
4. **Verify this prompt's claims from the code, by a helper, and read the cited lines yourself.** The claims, all of them
   leads written from the plan on 2026-10-19:
   - the **only** door that writes `rep_dues_payments` and dues credits is the coach's:
     `app/api/coaches/[orgSlug]/teams/[teamId]/players/[playerId]/dues-payments/route.ts` (+ `[paymentId]`) and `.../dues-credits/`;
     no `app/api/admin/**` route writes a payment (`app/api/admin/rep-teams/dues/` is reminders only). What is the house-league
     fee "paid" door, and who holds it?
   - `components/admin/kit/club/families/FamilyRecordWindow.tsx`: the record's top line is Message + Export, it has no
     pencil, and its sections are band, Children, Contact (with "Named on"), Forms and consent, History.
   - there is **no** family-notes table, no sibling-discount code and no person-to-staff match anywhere (a grep on
     2026-10-19 found none; the word "sibling" appears only in unrelated code).
   - `lib/families-export.ts`'s section list (5a: "the statement IS the section list"), and the 5a *Found, not fixed* line
     "staff-only notes ride in the family file (a policy call, counsel)": which existing notes, in which sections?
   - the treasurer cannot open Families (§329 W7) and D8 keeps it an explicit grant.
5. **The question that decides B, asked before anything is drawn.** B (record a payment against the family) was ratified as
   "through the money hub's one write path (split across children)" in Ask 2, but **D1 says the coach's records are the
   source of truth for team money and the club reads them, and D3 says the admin does not write what the coach owns.** A club
   admin writing a payment into a coach's Player dues is a write into the team's book. Argue it from the code, not from the
   plan: what does the coach's payment route check (team membership? the head-coach grant?), what would a club-admin door
   have to pass, what does the coach see afterwards, what does a closed season (CLAUDE.md: a closed season is one page and has
   no live tools) do to it? **Say plainly on the hub's first 5c screen whether B as ratified reverses D1/D3.** If it does,
   that is **Ask 26 and the first thing the owner rules**; draw the recommended shape and a small "if the answer is no" frame
   (the family record shows the balance and each child's line opens the team's Player dues, with Ask the coach; the club
   records only what the club owns: a house-league fee). Do not decide it by drawing one and leaving the other as a footnote.

## Step 1 · The measured look (the hub's "Stage 5c · walk" section)

Fixtures and accounts (the standing UAT password; find the last-known state in §329):
- `qa-families-fixture` (the Families test club): `uat-families-owner@qa-families-fixture.local`, open
  `http://localhost:3000/qa-families-fixture/admin/families` directly (no onboarding). Reyes is the money family (Riley
  part-paid; Milan's house-league fee). **W9/W10 left a remembered pair and a merge on it**; reseeding is
  `node --env-file=.env.local scripts/seed-families-fixture.mjs`. **Ask the owner before seeding or reseeding.**
- UAT Rep Club (`uat-rep-club`): owner `uat-club-owner@uat-rep-club.local`, treasurer `uat-club-treasurer@uat-rep-club.local`,
  admin `uat-club-admin@uat-rep-club.local`, registrar `uat-club-registrar@uat-rep-club.local`, coaches `uat-club-coach-15aaa@`,
  `-13aaa@`, `-15aa@`, `-11aa@uat-rep-club.local`. ⚠ Only 3 of its ~85 current players carry a dues plan (5a record) and the
  test club has **no coach sign-in**: find which coach, if any, can open a Player dues payment window with a real
  player, and say so if none can. `.env.local`'s `UAT_CLUB_ORG_SLUG` is **not** `uat-rep-club`: use the slug explicitly.
- Dev email cannot reach `.local` inboxes. **Read-only**: open every window, save nothing. Probes live in `.probe/` (the
  scratchpad cannot resolve `node_modules`); one browser tester at a time; start the server only with `npm run dev`
  (network access), and verify `http://localhost:3000/platform-admin/login?next=%2Fplatform-admin` returns 200.

Stations, in the order a club admin meets them (each: *as built*: captures and browser-measured numbers at 1440 and 390,
Warm and Dark; *my read*: what works, what gets in the way, what you would change, with clickable finding flags;
**shape questions** Keep · Reshape · Not yet, each with a recommendation and a notes box, beside the drawing that answers it):
1. **The family record today** (Reyes at 1440 and 390): the top line, the band, Children, Contact, Forms, History. Measure
   its height, how far a phone scrolls, and what is above the fold at 390. Where would a payment door, a notes section and a
   staff line go without pushing the family's money and state down? A co-guardian is a **separate person with a separate
   page** (the cap is per guardian record): how would a note or a payment on Dana's page look from her co-guardian's page?
2. **Where money is recorded today**: the coach's Player dues payment window (fields, words, the allocation across a
   player's installments, credit modes, void), the house-league fee mark-paid door, and Accounting › Teams as the owner and as
   the treasurer: does any club door write a team's dues? Inherit the money module's words; never re-derive its arithmetic.
3. **Notes today**: every place staff-only notes already exist (roster, registrations, tryouts?) and their recipe, so a family
   note is not a third dialect; and which of them ride in the family file.
4. **The staff join F would use**: Organization › Members and a team's staff, and the guardian email → auth account → staff
   membership path. Read-only probe: how many guardians on the two test clubs share an email with a staff account? If none,
   say that a drawing cannot be measured against data and ask whether the fixture grows a case (Ask 24's pattern).
5. **The export** (a family's file): the first page's "holds / does not hold" statement and the section list, so you can draw
   where payments (already there), notes and the staff match land, and the words this changes.
6. **A phone** (390) for stations 1, 2 and 5, and Dark for the record.

**Standing back** (the rules that cut across): (a) the cumulative effect: with a payment door, notes and a staff line, does
the record still read first with the family's state and next action above the fold at 390? (draw the whole record before and
after); (b) B is "two doors, one mechanism" (§1.3): which two doors, given the **treasurer holds Accounting but cannot open
Families**? A payment door that lives only inside Families is invisible to the person who takes the cheque; (c) notes are the
record's first fact of its own: confirm Ask 15 still holds once drawn; (d) what each addition tells a family (nothing, if you
can help it: a change that tells families is held until ✓ and asks; recommend no receipt email from this door, a receipt is its
own feature).

## Step 2 · What to draw: the END STATE of 5c, every part tagged, in the SAME first publish

Draw the finished 5c, **never a server stage in today's look** (the 10-17 lesson: owner, "it is hard for me to see what you are
proposing"). Before = the captures; after = drawn; **NEW / RESTYLED / UNCHANGED** tags each with its own click-open note;
fix chips naming the finding or E-number a drawing answers; 390 frames with the 44 px block; "after" drawn Warm with a Dark
copy; true size (the record window's real width, measured, in a fixed frame). Starting positions for you to argue with:

- **B · Record a payment** (a create: it asks, with a Save-style act; the lime is the one that sends or records). A window
  from the record's top line, in the club send window's frame (10-11: what it does in one statement, who it reaches; a foot
  with the sentence left and buttons right). The family's children with a balance, an amount per child pre-placed in the money
  module's own order, a "left to place" line, date, method, reference, a note; a house-league fee as a paid row (whole or
  none); the figures a joined band (10-08), never separate cards. Draw: the refusals (a child with no live season; an amount
  above what is owed, which the money module turns into a credit, not this window), the after (the record's band moves; the
  coach's Player dues line says who recorded it: draw that coach frame), and where a mistaken payment is voided or corrected
  (never a row action). Roles: owner, admin, treasurer, registrar, a Families-granted member; the capability that gates the
  write is **both** Families and money-write. Phone: the window as a sheet.
- **E · Notes**: a Notes section on the record; an "Add a note" create; a note = author, date, text; each note editable on its own
  (Ask 15) with delete inside its edit state (delete is never a row action); who can read and write them; whether a merge
  carries them (it must: `families_merge_people` carries message dates and proposals today); whether they ride in the
  family file and how the statement then reads (a **counsel** question: recommend the statement say exactly what the file
  holds, so notes in means the statement says so); never family-visible, and the screen says so once.
- **F · The staff match**: a read line on the record ("Also staff: …") from a **proposed** match the reviewer confirms or
  dismisses ("Not them", remembered, like the duplicate queue's tombstones), never assumed; what a confirmed match does (does
  anything read it?). **Disagree out loud if the feature has no customer**: say what decision it serves and whether to cut it.
- **D** (a second guardian's write): one hub line, "Not yet: waits for the guardian tier (Ask 22)". Nothing drawn.
- **The whole record, before and after, at 1440 and 390**, all three additions together. This is the drawing that decides.
- **The family file's first page** with the statement revised for whatever 5c adds (placement only; the sentences are
  `/marketing` and counsel's, tag them).
- **The test club's new cases** (a two-child family paying across two teams, a note, a staff-matched guardian) as an ask.

Check every drawing against the benchmark's **written** rules before the owner sees it: `docs/agents/design/TABLE_AND_LIST_STANDARD.md`
+ `TABLE_EXCEPTION_REGISTER.md`, `components/coaches/kit/CoachKit.module.css`, the portal's page-header and section rules, and
the toolbar rules (the pick-one is a pill; search sits right). Not the previous hub's CSS. **Run `/design` on the drawings before
the hand-off** (owner, 2026-10-10: always, not offered), apply its changes, record them on the hub's check screen. New customer
sentences are drawn as placement and tagged `/marketing`; use the product's existing words (Dues · Paid · Balance) and the
spelling gate ("installment", "8:00 a.m.", the bare possessive).

## The hub (ONE artifact; republish the SAME path)

Add to `CLUB_TIER_PRODUCTION_READINESS_HUB.html`: a "Stage 5c · Families" walk section and Mockups group (ids `s5c-*`; do not
renumber or reorder the §329 walk's steps, the owner's ticks are by step position), its Formatting check block, and Decisions
rows, `open`, then `accepted` as ruled, **continuing the Stage 5 numbering at Ask 26** ("Stage 5c · Ask 26 · …"), each with a
recommendation, "what rides on it" and a notes box. Inline the new captures (name them `5c-…` in `club-tier-5/`).
- Parse every `<script>` before every publish (one unescaped apostrophe kills every tab); keep new navigation in its own small
  script. The three traps from this hub's lineage: an assembler anchor that is a comment string also matches a style block
  (anchor on `<script>\n/* ══ …`); the tag labels live in a closed scope (give a new tag kind its own capture-phase click
  handler); a frame id equal to its screen id makes the Dark copy clone the whole screen. Dry-render from disk with Playwright
  (click the stage switch, a tag, a flag; count the Decisions rows) before the publish.
- Every highlight (finding flag, fix chip, NEW/RESTYLED/UNCHANGED tag) opens its explanation on click.

## The asks (Decisions rows, each with a recommendation; numbers are the hub's)

26. **B and the franchise (D1/D3):** may a club admin record a payment into a coach's team dues? (The recommended answer comes
    from Step 0's code reading. Options: through the one path with a "recorded by the club" line the coach sees; the club
    records only what it owns and the record opens the team's Player dues; or cancel B for rep dues.)
27. **B's door and roles:** the record's top line, Accounting's team view, or both, and the capability behind it.
28. **B's window and its after-effects:** the split across children, the house-league row, the refusals, the coach's line, voiding
    a mistake, no receipt email.
29. **E · Notes:** placement, who reads and writes, what a merge carries, the family file.
30. **F · The staff match:** keep, shrink, or cut; the proposal and its dismissal.
31. **D** stays "Not yet" (restate Ask 22; nothing to rule unless the owner wants "a second contact on the child's row").
32. **The record's top line with its third act:** order, one lime, the phone's 44 px.
33. **The test club grows the cases** it cannot show (owner approves any seeding).
34. **The 5c walk** is its own walk after the build, not a re-run of §329.
35. **5d:** a stage of its own after 5c, as Ask 21 ruled; restate it, and list what must happen first (Part B's gates).

## Do not

- Build anything, or change routes, gates, seeds, help or copy files; seed or reseed without the owner's yes; write to production.
- Turn on the guardian tier, draw family chat or replies, or bring back the family link.
- Draw a money write that forks the money hub's path, a household ledger, or a sibling claim from a name match.
- Change a price, a plan, the Families capability's default (off for every role), or write customer copy.
- Decide **packaging or gating** (route it: `/strategy` for who pays and what a tier includes, `/billing` for plan gates and
  `lib/plan-config.ts`; log nothing in `BUSINESS_DECISIONS.md` yourself). For 5c nothing here needs it; Part B does.
- Mint a second artifact. The hub is the only one. Do not write the 5c/5d build prompts, the design-log rulings or the
  Families plan's "ratified" notes until the owner rules.

## Hand-off

- In product-owner voice: what a club admin sees differently, what a treasurer and a Families-granted member see, what a head
  coach sees (their Player dues line now says who recorded a payment; say so if nothing else changes), what a family receives
  (nothing new is the recommendation), and what the family file says. **Tell the owner to open the hub on a phone too.**
- The asks as numbered questions, each with a recommendation. Say which one decides the rest (Ask 26).
- Records written this session (as drawn, asks open, no ruling invented): the Club plan's Stage 5 section ("5c WALKED + DRAWN,
  asks 26-35 open"), its PM brief paragraph, the Families plan's top note, the TODO Club line, memory `project_club_families_book`
  and `project_club_tier_readiness`, and the hub. **Nothing ruling-dependent** until the owner rules; then, and only as
  ruled, the design log, the build prompts (`CLUB_TIER_STAGE5C_BUILD_PROMPT.md`; their definition of done: tests that fail on
  today's code for the payment path through the one write; the through-the-person suppression test unchanged; the old-look
  ratchet; the 5c walk) and, for 5d, nothing yet.
- Git: a private index and explicit paths for your files only (the hub, the captures you added, the plan, the brief, TODO,
  this prompt only if you edit it); confirm with `git show --stat HEAD`. **Commit only when the owner says, locally, and do not
  push** until the owner says the release's staging sweep is done.

---

# Part B · The 5d session (household money): paste this part later

> **✂ RETIRED 2026-10-19: do not run.** The owner cancelled 5d in full: all four features and the
> confirm-household step. Teams already lower one player's fee in their own book, and house league is one flat
> fee (`BUSINESS_DECISIONS.md` 2026-10-19 "No household money"; Club plan Stage 5). Gates 2 and 3 below are moot.
> The text is kept as history.

**Do not run Part B in the 5c session.** Run it in a fresh session, on `dev`, only when all of these are true; if one is
not, say which and stop:
1. **5c is ruled** (Asks 26-35 accepted on the hub) and, if it changed the record's shape or the payment path, the hub's
   5c drawings are updated; draw 5d on what was ruled, not on what was proposed.
2. **/strategy has ruled who funds a sibling discount** (each team's book, or the club's own money) and logged it in
   `BUSINESS_DECISIONS.md`. If it has not, **do not decide it and do not draw around it**: offer the owner `/strategy` and stop.
   The same question carries **the club's side of D1**: if the answer is "the club funds it", the club is writing into a team's
   book, which is Ask 26 again.
3. **A packaging answer exists** (`/strategy`, then `/billing` for the gates): Families rides League Plus **and** Club, but
   rep dues exist only with Club's rep teams, and a house-league fee is paid-or-not with no ladder to take a credit or a
   schedule. So is household money Club-only, or does League Plus get any of it? Draw nothing a League Plus org would see
   until that is answered; "inapplicable = absent".
4. The owner has not cancelled any of the four (Ask 21: "Cancel some" / "Cancel all four" stay the owner's).

**What 5d is.** The four: sibling discount, financial assistance, a household payment plan, moving a credit between siblings.
The ruled shape (Ask 21, the 2026-08-18 answer to §8.5): **first a "confirm this household" step**, where a human confirms
which rows are one child and which children are siblings, and **every money feature refuses an unconfirmed household**
(propose, verify, never assume, as the duplicate queue and the returning-player check do); then **each feature writes through
each child's own dues** (a credit, a schedule), **never a household ledger**. Two exist per child on the coach's side today
(verify in `lib/dues-credits.ts`, the `dues-credits` routes and the installment schedule routes): assistance is a forgiveness
credit, a payment plan is an installment schedule. A date of birth is a **confidence signal** on the confirmation screen, not a
prerequisite (public rep tryout forms require one and it carries onto the roster; public league registration asks without
insisting). `rep_player_continuity_links` is **not** the seam (same team, season to season); it is only a good pattern
(suggested → confirmed or rejected, confidence tier, decided_by, tombstones).

**What the session does** (the same method as above): Step 0 checks (hub yours, branch, live hub read by a helper, claims
verified from code by a helper), a measured look at today's family record **as 5c left it**, at the coach's Player dues
credit and schedule windows (what a household feature would write through), and at the three real cases (a family with two
rep children on two teams, one rep child and one house-league child, a child on two rosters by mistake); then draw the
**end state** at true size: the household state on the record (Not confirmed / Confirmed by whom and when) and where the
confirm step lives, the confirm step itself (rows side by side, DOB and team as signals, "Same child" / "Not the same",
remembered), each of the four features as a window over a **confirmed** household with the refusal an unconfirmed one gets,
what the coach sees on each child's own dues afterwards, the whole record before and after, 390 phone frames, Warm and Dark.
`/design` before the hand-off; clickable annotations; ids `s5d-*`; Decisions rows continuing from the last 5c ask, each with a
recommendation (including "which of the four to cancel" and "Part B rides before or after the 5c build"). A sibling discount
is real money against an inference: if the confirmation cannot be made safe, **say the feature should not ship**.

**Do not** (adds to the list above): store a household ledger; let any money feature act on an unconfirmed household; claim
siblings from a name match; write customer copy; touch a price or a plan.
