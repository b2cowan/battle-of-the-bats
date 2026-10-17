# Club Tier Readiness, Stage 5: Families (a measured walk, a ladder, and the first stage drawn)

> Paste into a fresh session on `dev`. Written 2026-10-16 from the owner's task list (Wave 1, item 5: "the next drawing
> session on the Club hub — Families first"). **This session walks, measures, draws and settles rulings. It does not
> build.** The build prompts are written only after the owner rules.
>
> **This prompt supersedes `CLUB_FAMILIES_BOOK_P3_PROMPT.md`'s gates.** That prompt (August) says to start P3 only "when
> the trigger fires" and only after §54 passes. Both gates are gone:
> - the owner retired the trigger gate on 2026-08-18;
> - the child-identity question (§8.5) was answered ("a household is CONFIRMED, not inferred, before money moves");
> - the owner put the Families redesign (D9's P3) **inside the Club release** on 2026-10-12;
> - a QA walk of earlier work is never a gate in front of a design walk (memory `feedback_deep_dive_is_walk_then_stages`).
>
> Its §3 "Settled — do not reopen" and §4 "Lessons P2 paid for" still bind you: read them.
>
> **Why Families is first among Stages 4, 5 and 7** (the plan leaves the order open: "pick by what the first club
> needs"): Families is **already on production** behind the League and Club plans, with four High defects in guardian
> data and walks §54 / §56 never passed. Stage 4 (the public face) and Stage 7 (tournaments inside a club) change
> screens nobody can misuse a child's record through.

## Read first

- `CLUB_TIER_PRODUCTION_READINESS_PLAN.md`: **§4E (Families: what exists, E01–E09 with anchors, what P3 never
  built)**, §6 Stage 5, §7 (sequencing; ⚖ 2026-10-12 everything is inside the release), and "Across every stage —
  formatting". Also the PM brief's Stage 5 paragraph.
- `CLUB_FAMILIES_BOOK_PLAN.md`: the 2026-09-25 truth-up at the top, §5.3 (P2's design decisions, several binding),
  §5.4 (what P2 built and the review lessons), §8 (open questions; §8.5 answered). Also `CLUB_FAMILIES_BOOK_PM_BRIEF.md`.
- `CLUB_FAMILIES_BOOK_P3_PROMPT.md` §2 (the six P3 items A–F), §3 and §4.
- Ledger §54 and §56 (`OWNER_QA_LEDGER.md`): what they were meant to prove; Stage 5 re-runs them as one walk.
- Memory: `project_club_families_book`, `project_family_email_suppression`, `project_club_tier_readiness`,
  `feedback_deep_dive_is_walk_then_stages`, `feedback_portal_is_the_formatting_benchmark`,
  `feedback_build_to_approved_mockups`, `feedback_mockups_as_claude_artifacts`, `feedback_always_run_design_on_mockups`,
  `feedback_clickable_design_annotations`, `feedback_money_figures_one_joined_band`,
  `decision_record_reads_first_edits_whole`, `decision_edit_autosaves_create_asks` (and its 10-09 exception: a change
  that tells families is held until ✓ and asks), `decision_drawer_layers_form_vs_menu`,
  `decision_one_toolbar_rare_tools_behind_tools`, `decision_export_is_one_button`,
  `feedback_qa_walkthroughs_as_checkable_artifacts`, `reference_artifact_publish_needs_full_read`,
  `reference_hub_script_parse_trap`.
- The binding family-layer rulings: the guardian tier is **switched off** behind counsel; family chat was **cut**; the
  family link and follower tier were **removed** 2026-09-12 (mig 290). No drawing may assume any of them.

## Step 0 · Production first (read-only, and the owner approves the read)

Count, on production: League and Club orgs; how many have **ever opened Families** (person rows minted by
`families_attach_people`, merges in `org_person_merges`, any family message or export), and how many households E01–E04
would touch today:
- merged addresses still typed on source rows (E01);
- guardian emails edited after attachment (E02);
- families with partial dues payments (E03).

Auto mode has refused service-role reads of production before (2026-10-16). **Tell the owner what the read answers and
let them approve or run it.** Never route around a refusal.

**What the count decides:**
- **If no real organization can reach Families today** (Club and League Plus are not on sale; League's free floor is
  parked), the four Highs ride Stage 5's build.
- **If any can**, recommend a **fix-now part**, as Club Stage 0 did: the server halves of E01–E04, its own commit,
  ahead of the drawings. Put it to the owner as the first ask.

## Step 1 · The measured walk (the hub's Stage 5 walk section)

On the club fixture UAT Rep Club (`uat-rep-club`, the club owner; the layout sweep already measures
`admin-families`, `admin-family`, `admin-families-duplicates` there) and the Families fixture `qa-families-fixture`
(`node scripts/seed-families-fixture.mjs`; it manufactures every §5.3 case, including two rep + league households and
the opt-out-under-former-address row). **Ask the owner before seeding or reseeding either.** Read-only probes in
`.probe/`; one browser tester at a time.

Stations, in the order a club admin meets them:
1. the worklist and its lenses;
2. a family page;
3. the duplicate queue and a merge;
4. "Message this family";
5. the export;
6. who can open Families (the explicit grant; a scoped staff member, E07);
7. a phone (390).

Each station:
- *as built*: captures and browser-measured numbers, at 1440 and 390, Warm and Dark;
- *my read*: what works, what gets in the way, what you'd change, with clickable finding flags. **Re-verify E01–E09
  against today's code**: the anchors are from 2026-09-25, and Stage 3's money work (dues payments, credits, the
  ledger) has changed what E03 reads;
- **shape questions** (Keep · Reshape · Not yet), each with a recommendation and a notes box.

Then **"Standing back"**: the rules that cut across stations. Two questions at minimum:
- Is the Families area one page with tabs or separate jobs in the rail? Apply the 2026-09-30 rule the plan quotes:
  *"a program whose pages are views of one body of records is one page with tabs"*.
- Does the family page **read first and edit whole** like every record since 10-01?

## Step 2 · The ladder (a table: stage · covers · asks · state)

A recommended shape, for you to argue with:
- **5a**: the correctness fixes with little or no screen: E01 (a merge that undoes itself), E02 (an edited guardian
  email follows the child, through the one attach home), E03 (family money read through the money module's own helper,
  never `installments.paid_at`), E05 (paging), E08 (children counted once), and the message door's cap and Reply-To
  (E07). E04's export either says exactly what it holds or holds what it says, a privacy statement. Draw E04 and E07's
  visible parts only.
- **5b**: the Families screens redrawn to the portal benchmark (worklist, family page, duplicate queue), whatever Step 1
  finds.
- **5c**: P3 A–F: contact preferences through the PERSON for every sender (A, pure correctness, first), record a
  payment against the family (B, through the money hub's one write path), a real send log with a privacy story (C),
  the second guardian's write (D, blocked while the guardian tier is off: say so), internal notes (E), the
  person-to-staff match (F).
- **Ask, don't assume:** the household-money four (sibling discount, assistance, payment plan, credit moves). They are
  inside the release by the 10-12 rule unless the owner cancels them. Recommend whether they are a stage of their own
  after 5c, and say what §8.5's answer requires of them.

## Step 3 · Stage 5's first stage drawn (in the SAME first publish)

Draw the first stage the ladder recommends at **true size**:
- before = captures, after = drawn;
- NEW / RESTYLED / UNCHANGED tags, each with its own note;
- fix chips naming the E-number a drawing answers;
- 390 phone frames with the 44px block;
- "after" drawn Warm with a Dark copy.

Check every drawing against the formatting benchmark's written rules before the owner sees it. **Run `/design` on the
drawings before the hand-off** (owner, 2026-10-10: always, not offered), apply its changes, and record them on the hub's
check screen.

## The hub (ONE artifact; republish the SAME path)

`docs/projects/active/CLUB_TIER_PRODUCTION_READINESS_HUB.html` = https://claude.ai/artifact/K4MPu4ni53Ct7yrDcmWJd9.
Add a "Stage 5 · Families" walk, ladder and Mockups section, and its Decisions rows (`open`, then `accepted` as ruled).
- ⚠ **The working copy of the hub carried ~420 uncommitted lines from another session on 2026-10-16.** Before your first
  edit, check `git status` and `git diff --stat` on it, and read the live artifact **in full** (the Artifact tool
  refuses a publish until it has been read once this session; the file was 3.6 MB on 2026-10-16, so hand that read and
  the first publish to a subagent). If the working copy and the live copy differ, ask the owner which is current. Never `force`.
- **One drawing session per hub at a time.** If another session is drawing a Club stage, stop and ask.
- Parse every `<script>` before every publish (one unescaped apostrophe kills every tab). QA walks keep their ticks by
  step position: never insert or reorder steps in a walk the owner may have started.

## The asks (Decisions rows, each with a recommendation)

1. (If Step 0 found real orgs) a fix-now part for E01–E04 ahead of the drawings.
2. The ladder as proposed.
3. Every shape question from the walk.
4. The first stage's drawings, one ask per screen.
5. The household-money four: a stage of their own, or cancelled from this release (the owner's call).
6. §54 + §56 re-run as one walk after 5a and 5b are built (recommended), on the fixture.

## Do not

- Build anything, or change routes, gates, seeds, help or copy files.
- Turn on the guardian tier, draw family chat, or bring back the family link. Counsel holds the first; the owner cut and
  removed the others.
- Draw a money write that forks the money hub's path, or a sibling claim from a name match.
- Change a price, a plan, the Families capability's default (off for every role), or write customer copy. Draw the
  placement and tag it `/marketing`.
- Mint a second artifact. The hub is the only one.

## Hand-off

- In product-owner voice: what a club admin sees differently, what a treasurer and a scoped staff member see, what a
  family receives differently (messages, the export), and what a head coach sees (probably nothing; say so).
- **Tell the owner to open the hub on a phone too.**
- The asks as numbered questions, each with a recommendation.
- Records: the Club plan's Stage 5 section ("5 WALKED + DRAWN"), its PM brief paragraph, the Families plan's top note
  pointing here, the TODO Club line, memory `project_club_families_book` and `project_club_tier_readiness`.
- **Write the Stage 5 build prompts only after the owner rules.** Their definition of done carries:
  - E01–E04 proven by tests that fail on today's code;
  - the through-the-person suppression test for every sender (P3 A);
  - the old-look ratchet (`check:old-look`);
  - Families joining the layout sweep's baseline;
  - the §54 + §56 walk.
- Git: a private index and explicit paths for your files only (the hub, the plan sections, the brief, TODO, memory).
  **Commit only when the owner says.**
