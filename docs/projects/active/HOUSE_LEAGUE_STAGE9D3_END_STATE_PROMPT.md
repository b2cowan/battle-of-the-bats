# House League Stage 9d-3: bring the drawings into line with the end-state direction, and log that direction (prompt)

> **Written 2026-10-29**, straight after the 9d-3 drawings were published and the owner changed the frame: the product's end
> state is a **mobile app where everyone signs in**. **Paste this into a new chat on `dev`.** Other sessions share this working
> copy (TODO, the plan, the PM brief and the QA ledger carry their edits): stage explicit paths only, and commit only your own
> hunks, and only when the owner says.
>
> **This is a documents session, not a build.** No product code, migration, seed, help article or demo change. Two jobs, in
> this order: **A** amend the 9d-3 drawings and their records, **B** log the direction through `/strategy`.

## What the owner said (2026-10-29, paraphrased closely; the auto-memory file `project_end_state_signed_in_family_app.md` has the record)

- The objective of the end state is a **mobile app**. Parents, coaches, admins, treasurers all have email-and-password sign-ins.
- **Public = tournaments and team public pages only**, and a team page may or may not contain just games.
- A house-league parent signs in with their email and is **linked to their child**, as in TeamSnap or TeamLinkt. Whether the app
  shares pages with the public site is a decision for later. The **team schedule (practices included), chat and so on live there**,
  so parents and coaches have a private place to communicate.
- **No stop-gap of secret calendar links.** The owner does not want to go down a path that would be reversed. The product is not
  live and there is no rush.

**Decided direction vs not decided.** The end state above is the owner's direction. These are **my proposals, not accepted**, so
record them as Proposed and never as ruled: a rule that no new family feature works without a sign-in (except public tournaments
and team pages); Stage 14 ("one player across seasons") as a prerequisite of the app; parent accounts as people, not club
members; counsel on the critical path (the guardian tier is built and switched off pending the PIPEDA and CASL review); the
installed web app first, store packaging later; the app as a named end-state stage in the Club readiness plan, decisions first.
**Not decided at all:** native versus installed web app, what a parent sees, what is shared with the public site, which plan the
app belongs to.

## Job A: amend the 9d-3 drawings and their records

The drawings are published at https://claude.ai/artifact/Uazj5c2RKqVPAs1Gwpm9pM, source
`docs/projects/active/HOUSE_LEAGUE_STAGE9D3_DRAWINGS.html` (written 2026-10-29, may still be uncommitted). **Read the live copy
first (`action: "read"`, build the republish from the saved file)**, then edit the repo file and republish with `url`.
Load `artifact-design` first. Same rules as the drawing session: one HTML page with tabs, a written explanation beside each frame,
**never** the design canvas, never an empty artifact.

**Why the change.** The family calendar link was my best answer inside the old brief ("do not draw the family app"). With the app
as the end state it is a stop-gap: a second way to identify a family with no account behind it, which has to be kept alive or
killed once it sits in a parent's calendar. It also had a flaw I drew myself: a family cannot sign in, so nobody can show them
their link again. **Withdraw it; do not redraw it as something else.**

**Withdraw (keep a collapsed "Kept for the record" note so the reasoning survives, do not leave live frames):**
- Asks **9d3·2** (what a family's calendar carries) and **9d3·8** (the change email gets the calendar button). Keep their numbers
  as grey "Withdrawn 2026-10-29" cards with the reason and **no checkboxes**, so they drop out of the paste-back and the numbering
  that other records cite does not move.
- The **A family's calendar** tab, replaced by one short verdict: the family half is the signed-in app, not a link; what was drawn
  and why it was withdrawn; what survives (the finding that a connected-family feed already exists for rep teams, and that
  signing in is what lets a family find a link again).
- In the coach's Subscribe window and Reset frames (b3, b5): the **For your families** section, Copy the family link, Reset the
  family link, and the "link was reset" window. The coach's own link and its Reset stay.
- In the first email (c4): the **Add the Twins / Add the Rays buttons** and the sentence about the calendar. The list of dates stays
  (practices rotate week by week, so it must list dates). Fix the "Why it reads this way" bullets that mention the link.
- In the Gate tab: the rows for copying or resetting the families' link and for the no-login "Add to calendar" page.
- In the build notes: the family-link migration on the team, the family reader and its "told teams only" rule, and the no-login page.
  Keep the coach-link migration and the feed mapper (the app's calendar will reuse the mapper).
- In the Edges tab: the cards or bullets that lean on the family link (the child moved to another team, the family with no email
  "can be sent the link by the coach", the coach removed, the convenor walking away).
- In the words table: the rows for the family link, the families' Reset and the no-login page.
- In the Push-backs tab: the push-back 2 table stays as a **record**, with its verdict line changed to "withdrawn: the family half
  is the signed-in app"; push-back 3's split changes (see below).

**Keep as drawn:** the first practice email's rule (last step of Practice time, one email per household, held until Send, "first"
per team), its edge states (See them, failed send, stale list, already told, teams skipped), the hand-out-again rule (ask 9d3·6),
the coach's "told on…" line and copy email (9d3·7), who is told and the opt-out precedent **9c·4** (9d3·4), the coach's own
Subscribe (9d3·5, minus the families section), the history row, and findings D01 to D07 (they stay true; D02, D03 and D06 are now
background, say so).

**Re-ask 9d3·3 (one build or two).** With the family link gone, 9d-3 is the coach's Subscribe (small) and the first notice with the
hand-out-again rule (medium). Recommend one build in the order notice first, because it fixes the silent re-hand-out, then the
coach's Subscribe, which can slide without loss. Say what a split costs (nothing is built twice either way).

**Add one short card on the Push-backs tab: "What the end state changes."** What survives (the first notice: it stays the way a
family hears a time, and later becomes the invitation into the app; the rule that a hand-out never moves a told team silently; the
coach's feed, the first instance of the final design, a personal link tied to a sign-in), what is withdrawn, and the one thing to
keep in mind: the notice goes to the guardian email on the registration, which is the same key the app will link a parent to a
child by, so nothing in the notice's recipient logic needs reversing.

**Run `/ux` and `/design` on the changed frames only** (not the whole page again) and put a line in the page's reviews card.

**Records, same unit of work** (record the direction as direction, never as ruled; the asks stay open):
- `docs/projects/active/HOUSE_LEAGUE_STAGE9_PLAN.md`: the §4 9d-3 row (asks column "9d3·2 and 9d3·8 withdrawn, rest open") and a
  new §9 status-log entry at the end.
- `docs/projects/active/HOUSE_LEAGUE_STAGE9_PM_BRIEF.md`: the 9d-3 paragraph mentions the family link; rewrite it, plain language.
- The auto-memory file `project_club_stage9_house_league.md` (the log is oldest first, append at the end) and its line in `MEMORY.md`.
- The Club Tier project index (`https://claude.ai/artifact/MBKRySURVFu3V9cZJvmjVr`, document `stages/s9`): read it, pin
  `if_version`, change the 9d-3 sentence in `summary` and `anchor` only.
- `TODO.md`: the existing 9d-3 line.

## Job B: log the direction through `/strategy`

Run `/strategy` (`.claude/commands/strategy.md`) and record in `docs/agents/strategy/BUSINESS_DECISIONS.md`:
- **Decided (the owner's direction, 2026-10-29):** the end state is a mobile app with sign-ins for every role; public means
  tournaments and team public pages only; parents are linked to their child; no stop-gap no-login family doors; no rush, pre-customer.
- **Proposed** (the list above), each marked as awaiting the owner.
- **Open questions, not decided:** native versus installed web app; what a parent sees and what is shared with the public site;
  **which plan the app belongs to** (do not decide it, and do not restate any plan name, price or gate: point at
  `docs/agents/strategy/PLAN_PRICING_FACTS.md`).
- Route the follow-through, do not do it: the plan change (a named end-state stage and a decisions-first stage in
  `CLUB_TIER_PRODUCTION_READINESS_PLAN.md`) goes to `/plan` **only if the owner asks**; copy goes to `/marketing`. **Do not edit the
  Club readiness plan in this session.**
- Say plainly in the entry that this changes 9d-3 (the family calendar link withdrawn) and that Stage 14 becomes a prerequisite
  of the app if the owner accepts it.

## Do not

- Build, migrate, seed, or touch AWS or DNS.
- Reopen 9d2·2, 9d2·13, 9d2·16, the games-only public team page, 6d's rulings, 9c·4 or Q12c.
- Rule any of the open asks, or write "ruled" for anything the owner has not accepted.
- Add `module_families` to any role's defaults, or promise timing anywhere.
- Run the census of no-login family doors. It is parked (`SIGNED_IN_FAMILY_CENSUS_PROMPT.md`).

## Definition of done

The drawings page is republished to the same link with 9d3·2 and 9d3·8 shown as withdrawn, the family tab replaced, no live frame
leaning on a family link, 9d3·3 re-asked, and a reviews line. The five records say the same thing. `BUSINESS_DECISIONS.md` carries
the decided direction, the Proposed items and the open questions. Nothing is committed unless the owner said so.
