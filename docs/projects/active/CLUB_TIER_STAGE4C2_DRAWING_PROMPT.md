# Club Tier Readiness, Stage 4c-2: draw the four pieces that were ruled but never drawn

> **Written 2026-10-22** in the session that passed walk §357 (4c-1 and the Public site builder) and re-verified the 4c build
> prompt before 4c-2. **Paste this into a new chat on `dev`.** This is a **drawing session: nothing is built.** It ends with one
> published drawings page, its asks put to the owner, and the records saying "drawn, asks open". The build prompt is
> `CLUB_TIER_STAGE4C_BUILD_PROMPT.md`; 4c-2 is its item 4. Do not build from it until this session's asks are ruled.

**What 4c-2 is for.** 4c-1 gave the club its own editor. 4c-2 is the same idea from the **team's** side: a family sees a team's
born years, a parent with a tryout question writes to the person running that team's tryouts, the coach decides whether
their name is public, and the club can say in its own words what a tryout costs and who may come.

**Who reads it:** a parent or player on a phone (the team page, the tryout page); the head coach who shares the team's page
and runs its tryouts; the club admin who sets the team up and writes the tryout blurb.

## Draw these four. Everything else in 4c-2 is already drawn and ruled.

Already drawn in `CLUB_TIER_STAGE4_DRAWINGS.html`, all ruled A on 2026-10-19 (do **not** redraw; only link to them and check
your new frames sit beside them): the coach's "Your team's public page" door (frame `e-coach`, L1555-1620), the "Show my name on
the team's public page" switch (off by default, name and role only), the team page's **Coaches** section (L1145-1175, L1221,
L1255), and the **Born in** picker on the Teams and Tryouts pages (L1793, L1843-1890).

| # | Draw | Ruled already | Still open (your drawing and asks must settle) |
|---|---|---|---|
| 1 | **Where born years are entered** (the team record, and the house-league division screens) | Ask 15 A: "two small fields, entered where the team and division are set up"; a team with no years always stays in the Born in list | One range or from/to; how it is checked (a year in the past, from not after to); what a family sees for one year vs a range; whether the form **suggests** years from the team's age label ("13U") for the admin to confirm, or leaves it blank (see Push back, below) |
| 2 | **The tryout blurb's editor**, on the admin's Tryouts page | Ask 5 A: it "gains an editor on the admin's Tryouts page"; no fee field is invented; the past-year hint covers the blurb (any four-digit year before this calendar year, a founding year skipped) | Where it sits on that page; autosave or a held Save (it tells families, so check the 2026-10-09 exception); its size and count; how the hint reads **here** (it is drawn only for the About field); whether next season's tryout starts with last season's words (rollover does **not** carry the blurb today) |
| 3 | **The head coach's tryout address** | Owner ask 2026-10-21 (walk §356) + gate ruling the same day: a **separate address the coach types**, blank by default, **never the sign-in email**, ending with their role, shown on the team's own tryout page only; the club Tryouts page and the footer keep the club's line | Where the coach types it (beside the coach's door? in the tryout setup?); label and help text; what a family sees, and the "Copy" button and share card that follow it; whether it still shows once sign-ups are closed or finished; who may set it (the coach alone, or the club can see and clear it); what happens when the head coach changes |
| 4 | **The c3 line** in the coach's tryout setup | Walk §356 c3 A: one plain line saying the days are public before sign-ups open | The exact wording; whether it sits in the "Tryout dates" row's empty text or beside the day cards |

## Read first

- `CLUB_TIER_STAGE4C_BUILD_PROMPT.md` (gate asks 2 and 3; the 4c gate ruling; item 4 "4c-2"); `CLUB_TIER_STAGE4_DRAWINGS.html` (the
  frames named above; its Ask 2, 5 and 15 text); `CLUB_TIER_PRODUCTION_READINESS_PLAN.md` L1163-1177 (the head-coach ask and its six
  numbered questions) and L1182-1188 (the gate ruling); `OWNER_QA_LEDGER.md` §356 (the ask, c3) and §357 (the rulings in the 4c-1 build).
- `CLUB_TIER_STAGE4C1_COPY.md`: the house words already approved for the editor, including section **K2**. Match its voice; do not
  restate its words.
- The writing standards, **before drawing**: `docs/agents/design/TABLE_AND_LIST_STANDARD.md`, `TABLE_EXCEPTION_REGISTER.md`, the
  coach kit's CSS, the `--type-*` ladder in `app/globals.css`. The Premium Coaches Portal is the formatting benchmark. Auto-memory
  `design_principles.md` and `design_system.md` are obsolete.
- Auto-memory (outside the repo), how to draw and hand off: `feedback_mockups_as_claude_artifacts`,
  `feedback_always_run_design_on_mockups` (run `/design` **before** the hand-off, never just offer it),
  `feedback_clickable_design_annotations` (every flag, fix chip and NEW/RESTYLED/UNCHANGED tag opens its explanation on click),
  `feedback_build_to_approved_mockups` (every element tagged NEW, RESTYLED or UNCHANGED), `feedback_portal_is_the_formatting_benchmark`,
  `feedback_sport_neutral_no_debt` (no "diamonds", no baseball-only words in an example),
  `decision_edit_autosaves_create_asks` (and its 2026-10-09 exception), `decision_record_reads_first_edits_whole`,
  `feedback_mobile_icon_only_actions` (a phone's secondary action is its symbol alone), `feedback_push_back_by_default`.
- `AGENTS.md`, `AGENCY_RULES.md`, `CLAUDE.md`. **CLAUDE.md's rule binds you: broad reading goes to a helper agent**, and a
  helper's summary is a lead, not evidence. Open the cited lines before a drawing or a claim to the owner rests on them.

## State of the code (re-checked 2026-10-22 at `4c8faf1d8`; re-check anything a drawing rests on)

| Row | Today | Where |
|---|---|---|
| Tryout blurb | **No screen edits it.** Written only by the admin program-year APIs and seeds; shown on the public tryout page only while sign-ups are open. Rollover does not carry it. | `app/api/admin/rep-teams/teams/[teamId]/program-years/[yearId]/route.ts:103`; `components/rep-teams/TryoutLandingView.tsx:49`; `lib/rep-season-rollover.ts:224-239` |
| Admin Tryouts page | A header with a state chip and Add applicant, a **Sign-ups** section (Open/Closed chip, Copy link, Close/Open sign-ups, the address), status views, Export, an applicants table. No blurb field. | `app/[orgSlug]/admin/rep-teams/teams/[teamId]/tryouts/page.tsx` (~L341-361) |
| Born years | **No column, field, picker or filter anywhere.** `rep_teams.division` is free text; tournament divisions have min/max **age**; DOB lives on registrations and rosters. | `docs/agents/db/DATA_DICTIONARY.md` (`rep_teams.division`, `league_divisions`) |
| Staff names | No public-name flag on any staff or coach record. `organization_members.display_name` is "UI only". No public page reads a coach. | `lib/club-team-board.ts:155-170`; `lib/coach-membership.ts` |
| Coach's Sharing | Schedule visibility and "Share our book with the club" only. The 4a site-off notice is still inside it, and its comment says 4c moves it to the new door. No team address, Copy or Open. | `app/[orgSlug]/coaches/teams/[teamId]/settings/page.tsx:906-1009`; `components/coaches/ClubSiteOffNotice.tsx` |
| Team page | Parts: concluded · tryout door/quiet · schedule · about. No Coaches section. The only address it shows is the club's contact email. | `lib/club-team-page.ts`; `app/[orgSlug]/teams/[teamSlug]/page.tsx` |
| Tryout setup | Empty text: "No sessions yet — they show on your schedule once added." | `components/rep-teams/TryoutSetupChecklist.tsx:37` |
| Two guard tests will fail the day 4c-2 builds, by design | One forbids "Born in" on the tryout surfaces; one asserts the team page has no "Coaches" text. A **no player, no email on the team page** guard does not exist yet. | `tests/unit/club-stage4b2b-guard.test.ts:134-138`; `club-stage4b2a-guard.test.ts:93-95` |

Not read when this was written: `TryoutDayCard.tsx` (the session list and Add session), and the seed fixtures.

## Push back (the owner asked for disagreement, out loud, before the work)

Say these in the drawings page, not in a summary afterwards. Argue from what the code does.

1. **The carve-out from Ask 2.** Ask 2 rules a public team page shows a coach's name and role, **never an email**. A coach-typed tryout
   address is an email on the open web. The ruling was made for a good reason (spam, and a family writing to someone who left). Say
   plainly what the carve-out costs, and draw the safeguards: opt-in per team, blank by default, a visible end when the head coach
   changes, and the club able to see and clear it. If you think the real need is "a different contact per team" and not "the coach's own
   inbox", say so and draw both.
2. **Born years could be suggested, not typed.** The team's label (for example "13U AAA") already carries an age. Entering it twice
   is a chance to disagree. The cut-off date varies by sport and club, so do **not** assume the arithmetic. Ask whether the form should
   suggest a range from the label for the admin to confirm. If the answer is "no, sports differ", record why.
3. **Is the blurb editor the right size?** The ruling says no fee field is invented. Check that a plain-text blurb actually answers
   what a parent asks (what it costs, who may come). If it does not, say what is missing instead of silently drawing a bigger editor.

## What to produce

1. **One published Artifact** (source in `docs/projects/active/`, e.g. `CLUB_TIER_STAGE4C2_DRAWINGS.html`; load `artifact-design`
   first), in the shape of the Stage 4 drawings: before = captures of today's screen, after = drawn at **true size**, a phone and a
   desktop for each family-facing or coach-facing frame, NEW / RESTYLED / UNCHANGED tags, clickable flags and fix chips, one checkbox per
   option for each ask, and a paste-back summary at the end.
2. **Frames:** (1) the born-years fields on a team and on a house-league division; (2) the blurb editor on the Tryouts page, hint
   included; (3) the head coach's tryout address, the coach's side **and** what a family sees on the team's tryout page (open, and
   closed/finished); (4) the c3 line in the tryout setup. Draw the empty, filled and refused states of each field.
3. **Words:** provisional copy in the frames, marked as provisional. Final words go through `/marketing` **after the owner rules**,
   before any code (house rules: sentence case, "8:00 a.m.", the bare possessive, `npm run check:spelling`). Do not run it on drafts.
4. **Flow:** run `/ux` on the head coach's address (who, where, when it ends). Run `/design` on the whole page **before the hand-off**,
   apply its fixes, republish, and report what it changed (proposals until ruled).
5. **Asks:** a numbered asks list with a recommendation on each. The owner's answer to the head-coach address changes the build,
   so make it the first ask.
6. **Records, same unit of work:** `CLUB_TIER_PRODUCTION_READINESS_PLAN.md` (4c-2 "drawn, asks open", link the Artifact),
   `TODO.md` (one line), and a PM brief row (plain language: what a parent, a coach and an admin see differently). Write the
   Artifact link into the memory file `project_club_tier_readiness.md`. Record rulings **as ruled**, adding nothing the owner did not rule.

## Do not

- Build, migrate or seed anything. If the walk fixture needs a head coach and an assistant (one opted in, one not) and born years on most
  teams but not one, **list it for the owner**. The build session asks before changing a seed, and never seeds mid-sweep.
- Draw a player, a sibling or any household money on a public page, or an email that is the coach's sign-in address.
- Reopen what is ruled: the door, the name switch, the Coaches section, the Born in picker, the club's line staying on the club's
  Tryouts page and the footer. Push back on them only if the new frames expose a real conflict, and say which frame shows it.
- Add a navigation change. Where the club's navigation goes is Stage 13.

## Definition of done

The drawings page is published and linked from the plan; `/ux` and `/design` have run and their changes are reported; every
open point in the table above is either drawn with options or has a stated reason it is deferred; the first ask is the head
coach's address; the records say "drawn, asks open"; and a build prompt for 4c-2 can be written from the owner's answers without
re-deciding anything.
